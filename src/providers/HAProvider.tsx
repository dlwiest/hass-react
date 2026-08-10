import { createContext, useContext, useEffect, useReducer, useCallback, useMemo, useRef, useState, ReactNode } from 'react'
import type { Auth, Connection } from 'home-assistant-js-websocket'
import { useStore } from '../services/entityStore'
import { createMockConnection } from '../services/mockConnection'
import { createAuthenticatedConnection, refreshTokenIfNeeded, DEFAULT_TOKEN_BUFFER_MINUTES } from '../services/auth'
import { useAuth } from '../hooks/useAuth'
import type { HAConfig, HAConnection, HATransport, HATransportHandlers, ConnectionStatus, EntityState } from '../types'

// Token refresh retry constants
const BASE_PERIODIC_RETRY_DELAY_MS = 60 * 1000 // 1 minute
const MAX_PERIODIC_RETRY_DELAY_MS = 16 * 60 * 1000 // 16 minutes
const BASE_VISIBILITY_RETRY_DELAY_MS = 30 * 1000 // 30 seconds
const DEFAULT_PROVIDER_OPTIONS: NonNullable<HAConfig['options']> = {}

function observeTransportOperation(operation: void | Promise<void>, warning: string): void {
  if (operation) {
    void operation.catch((error) => console.warn(warning, error))
  }
}

// Token refresh retry state
interface RetryState {
  timeouts: Set<NodeJS.Timeout>
  inProgress: boolean
  cancelled: boolean
}

interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs?: number
  retryState: RetryState
  logContext: string // e.g., "Token refresh" or "Visibility change token refresh"
}

// Reusable retry helper with exponential backoff
function createRetryExecutor(config: RetryConfig) {
  return async function executeWithRetry<T>(
    fn: () => Promise<T>,
    retryCount = 0
  ): Promise<T | void> {
    if (config.retryState.cancelled) return
    config.retryState.inProgress = true

    try {
      const result = await fn()
      config.retryState.inProgress = false
      return result
    } catch (error) {
      if (config.retryState.cancelled) {
        config.retryState.inProgress = false
        return
      }

      if (retryCount < config.maxRetries) {
        const delayMs = Math.min(
          Math.pow(2, retryCount) * config.baseDelayMs,
          config.maxDelayMs || Infinity
        )
        const delayDisplay = config.baseDelayMs >= 60000
          ? `${delayMs / 60000} minutes`
          : `${delayMs / 1000} seconds`

        console.warn(
          `${config.logContext} failed on attempt ${retryCount + 1} of ${config.maxRetries + 1}. ` +
          `Retrying in ${delayDisplay}...`,
          error
        )

        // Schedule retry asynchronously (fire-and-forget pattern)
        // The caller doesn't need to wait for retries - state is tracked via inProgress flag
        const timeoutId = setTimeout(() => {
          config.retryState.timeouts.delete(timeoutId)
          if (config.retryState.cancelled) {
            config.retryState.inProgress = false
            return
          }
          executeWithRetry(fn, retryCount + 1).catch(err => {
            console.error(`${config.logContext} retry attempt threw an unhandled error:`, err)
          })
        }, delayMs)
        if (config.retryState.cancelled) {
          clearTimeout(timeoutId)
          config.retryState.inProgress = false
          return
        }
        config.retryState.timeouts.add(timeoutId)
      } else {
        console.error(
          `${config.logContext} failed after maximum retries.`,
          error
        )
        config.retryState.inProgress = false
      }
    }
  }
}

function normalizeConnectionError(error: unknown): Error {
  if (error instanceof Error) return error
  if (error === 1) return new Error('Unable to connect to Home Assistant')
  if (error === 2) return new Error('Home Assistant rejected the authentication credentials')

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String(error.message ?? error))
  }

  return new Error(String(error))
}

// Valid connection states
type ConnectionState =
  | { type: 'idle'; connection: null; error: null; retryCount: 0 }
  | { type: 'connecting'; connection: null; error: null; retryCount: number }
  | { type: 'connected'; connection: HAConnection; error: null; retryCount: 0 }
  | { type: 'disconnected'; connection: null; error: null; retryCount: number }
  | { type: 'error'; connection: null; error: Error; retryCount: number }

// All possible state transitions
type ConnectionAction =
  | { type: 'START_CONNECTING' }
  | { type: 'CONNECTION_SUCCESS'; connection: HAConnection }
  | { type: 'CONNECTION_ERROR'; error: Error }
  | { type: 'DISCONNECTED' }
  | { type: 'RETRY_SCHEDULED' }
  | { type: 'MANUAL_RECONNECT' }
  | { type: 'MANUAL_STOP' }
  | { type: 'READY_EVENT'; connection: HAConnection }

// State machine
function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
  switch (action.type) {
    case 'START_CONNECTING':
      return {
        type: 'connecting',
        connection: null,
        error: null,
        retryCount: state.retryCount
      }

    case 'CONNECTION_SUCCESS':
      // Accept connection success in most states, but ignore if already connected with same connection
      if (state.type === 'connected' && state.connection === action.connection) {
        // Already connected with the same connection, ignore duplicate ready event
        return state
      }

      return {
        type: 'connected',
        connection: action.connection,
        error: null,
        retryCount: 0
      }

    case 'CONNECTION_ERROR':
      return {
        type: 'error',
        connection: null,
        error: action.error,
        retryCount: state.retryCount + 1
      }

    case 'DISCONNECTED':
      return {
        type: 'disconnected',
        connection: null,
        error: null,
        retryCount: state.retryCount + 1
      }

    case 'RETRY_SCHEDULED':
      return {
        type: 'connecting',
        connection: null,
        error: null,
        retryCount: state.retryCount
      }

    case 'MANUAL_RECONNECT':
    case 'MANUAL_STOP':
      return {
        type: 'idle',
        connection: null,
        error: null,
        retryCount: 0
      }

    case 'READY_EVENT':
      if (state.type === 'connected' && state.connection === action.connection) {
        return state
      }
      // Accept ready events in most states to allow reconnection
      return {
        type: 'connected',
        connection: action.connection,
        error: null,
        retryCount: 0
      }

    default:
      return state
  }
}

interface HAContextValue<TConnection extends HAConnection = HAConnection> extends ConnectionStatus {
  connection: TConnection | null
  config: HAConfig
  logout: () => void
}

const HAContext = createContext<HAContextValue<HAConnection> | null>(null)

export function useHAConnection<TConnection extends HAConnection = Connection>(): HAContextValue<TConnection> {
  const context = useContext(HAContext)
  if (!context) {
    throw new Error('useHAConnection must be used within HAProvider')
  }
  return context as HAContextValue<TConnection>
}

export interface HAProviderProps {
  children: ReactNode
  url: string
  token?: string
  authMode?: 'token' | 'oauth' | 'auto'
  redirectUri?: string
  mockMode?: boolean
  mockData?: Record<string, EntityState>
  mockUser?: HAConfig['mockUser']
  transport?: HATransport
  options?: HAConfig['options']
}

export const HAProvider = ({
  children,
  url,
  token,
  authMode = 'auto',
  redirectUri,
  mockMode = false,
  mockData,
  mockUser,
  transport,
  options = DEFAULT_PROVIDER_OPTIONS
}: HAProviderProps) => {
  const usesExternalTransport = transport !== undefined
  const usesMockMode = mockMode && !usesExternalTransport
  const [state, dispatch] = useReducer(connectionReducer, {
    type: 'idle',
    connection: null,
    error: null,
    retryCount: 0
  })
  const connectedRef = useRef(false)
  connectedRef.current = state.type === 'connected'

  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  const currentConnectionRef = useRef<HAConnection | null>(null)
  const currentAuthRef = useRef<Auth | null>(null)
  const connectionCleanupRef = useRef<(() => void) | null>(null)
  const connectionAttemptRef = useRef(0)
  const manuallyStoppedRef = useRef(false)

  // Grouped token refresh state
  const periodicRefreshState = useRef({
    intervalRef: undefined as NodeJS.Timeout | undefined,
    retry: { timeouts: new Set<NodeJS.Timeout>(), inProgress: false, cancelled: false } as RetryState
  })
  const visibilityRefreshState = useRef({
    retry: { timeouts: new Set<NodeJS.Timeout>(), inProgress: false, cancelled: false } as RetryState
  })
  const [lastConnectedAt, setLastConnectedAt] = useState<Date>()
  const [nextRetryIn, setNextRetryIn] = useState<number>()
  const setStoreConnection = (() => {
    try {
      return useStore((state) => state.setConnection)
    } catch (error) {
      console.warn('Entity store unavailable, using fallback:', error)
      return () => {} // Fallback no-op function
    }
  })()

  // Helper function to close connection and remove event listeners
  // Note: home-assistant-js-websocket does NOT clean up listeners on close()
  const cleanupConnection = useCallback(() => {
    // Always clean up event listeners first, even if connection is already null
    if (connectionCleanupRef.current) {
      try {
        connectionCleanupRef.current()
      } catch (error) {
        console.warn('Failed to cleanup event listeners:', error)
      }
      connectionCleanupRef.current = null
    }

    const connection = currentConnectionRef.current
    currentConnectionRef.current = null
    if (connection) {
      try {
        if (usesExternalTransport && transport) {
          observeTransportOperation(
            transport.disconnect(connection),
            'Failed to disconnect external transport:'
          )
        } else {
          const nativeConnection = connection as Connection
          nativeConnection.close()
        }
      } catch (error) {
        console.warn('Failed to close connection:', error)
      }
    }
  }, [transport, usesExternalTransport])

  // Auth state management
  const auth = useAuth((usesMockMode || usesExternalTransport) ? null : (url ?? null), authMode)
  const authLogout = auth.logout

  // Development warnings for configuration issues
  useEffect(() => {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      if (usesExternalTransport) {
        if (mockMode) {
          console.warn('HAProvider: transport takes precedence over mockMode.')
        }
        if (token || redirectUri) {
          console.warn('HAProvider: token and redirectUri are ignored when transport is provided.')
        }
      } else if (!usesMockMode) {
        if (!url) {
          console.warn('HAProvider: url prop is required when neither mockMode nor transport is provided.')
        } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ws://') && !url.startsWith('wss://')) {
          console.warn(`HAProvider: url "${url}" should start with http://, https://, ws://, or wss://`)
        }

        // Only warn about missing token if using token auth mode
        const effectiveAuthMode = authMode === 'auto' ? (token ? 'token' : 'oauth') : authMode
        if (effectiveAuthMode === 'token' && !token) {
          console.warn('HAProvider: token prop is required when using token authentication. Create a long-lived access token in Home Assistant or use OAuth mode.')
        }
      } else {
        if (!mockData) {
          console.warn('HAProvider: mockMode is enabled but no mockData provided. Entities will have empty state.')
        }
        if (token) {
          console.warn('HAProvider: token prop provided in mock mode is unnecessary and will be ignored.')
        }
      }
    }
  }, [url, token, redirectUri, mockMode, mockData, authMode, usesExternalTransport, usesMockMode])

  // Async connection function
  const attemptConnection = useCallback(async () => {
    if (manuallyStoppedRef.current) return
    const attemptId = ++connectionAttemptRef.current

    if (usesExternalTransport && transport) {
      try {
        cleanupConnection()

        let transportConnection: HAConnection | null = null
        let disconnectedBeforeReady = false
        const handlers: HATransportHandlers = {
          onDisconnected: () => {
            // Ignore a late disconnect notification from a connection that has
            // already been replaced by a manual or automatic reconnect.
            if (attemptId !== connectionAttemptRef.current) return
            if (!transportConnection) {
              disconnectedBeforeReady = true
              return
            }
            if (currentConnectionRef.current !== transportConnection) return

            const connection = transportConnection
            try {
              observeTransportOperation(
                transport.disconnect(connection),
                'Failed to disconnect external transport:'
              )
            } catch (error) {
              console.warn('Failed to disconnect external transport:', error)
            }
            currentConnectionRef.current = null
            void Promise.resolve(setStoreConnection(null)).catch((error) => {
              console.warn('Failed to clear store connection:', error)
            })
            dispatch({ type: 'DISCONNECTED' })
          },
        }

        const connection = await transport.connect(handlers)
        if (attemptId !== connectionAttemptRef.current || manuallyStoppedRef.current) {
          observeTransportOperation(
            transport.disconnect(connection),
            'Failed to disconnect external transport:'
          )
          return
        }
        transportConnection = connection
        if (disconnectedBeforeReady) {
          try {
            observeTransportOperation(
              transport.disconnect(connection),
              'Failed to disconnect external transport:'
            )
          } catch (error) {
            console.warn('Failed to disconnect external transport:', error)
          }
          currentConnectionRef.current = null
          void Promise.resolve(setStoreConnection(null)).catch((error) => {
            console.warn('Failed to clear store connection:', error)
          })
          dispatch({ type: 'DISCONNECTED' })
          return
        }

        currentConnectionRef.current = connection
        setLastConnectedAt(new Date())
        dispatch({ type: 'CONNECTION_SUCCESS', connection })
        void Promise.resolve(setStoreConnection(connection)).catch((error) => {
          console.warn('Failed to set store connection:', error)
        })
      } catch (error) {
        if (attemptId !== connectionAttemptRef.current || manuallyStoppedRef.current) return
        const connectionError = normalizeConnectionError(error)
        console.error('External Home Assistant transport failed to connect:', connectionError)
        dispatch({ type: 'CONNECTION_ERROR', error: connectionError })
      }
      return
    }

    if (usesMockMode) {
      // Handle mock mode
      if (mockData) {
        const mockEntities = Object.entries(mockData).map(([id, data]) => ({
          entity_id: id,
          state: data.state || 'unknown',
          attributes: data.attributes || {},
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null },
        }))
        try {
          useStore.getState().batchUpdate(mockEntities.map((e) => [e.entity_id, e]))
        } catch (error) {
          console.warn('Failed to populate entity store:', error)
        }
      }

      const mockConn = createMockConnection()
      currentConnectionRef.current = mockConn
      setLastConnectedAt(new Date())
      dispatch({ type: 'CONNECTION_SUCCESS', connection: mockConn })
      void Promise.resolve(setStoreConnection(mockConn)).catch((error) => {
        console.warn('Failed to set store connection:', error)
      })
      return
    }

    if (!url) {
      dispatch({ type: 'CONNECTION_ERROR', error: new Error('URL is required') })
      return
    }

    try {
      // Close any existing connection and remove event listeners before creating a new one to prevent memory leaks
      cleanupConnection()

      const { connection: conn, auth } = await createAuthenticatedConnection({
        hassUrl: url!,
        token,
        authMode,
        redirectUri
      })

      if (attemptId !== connectionAttemptRef.current || manuallyStoppedRef.current) {
        conn.close()
        return
      }

      // Store auth object for token refresh
      currentAuthRef.current = auth

      // Set up event listeners with cleanup tracking
      let disconnectHandled = false
      const handleDisconnected = () => {
        if (disconnectHandled || currentConnectionRef.current !== conn) return
        disconnectHandled = true
        try {
          conn.close()
        } catch (error) {
          console.warn('Failed to close disconnected connection:', error)
        }
        currentConnectionRef.current = null
        void Promise.resolve(setStoreConnection(null)).catch((error) => {
          console.warn('Failed to clear store connection:', error)
        })
        dispatch({ type: 'DISCONNECTED' })
      }

      const handleReady = () => {
        // Use READY_EVENT action - reducer will only accept if in valid state
        const alreadyReady = connectedRef.current && currentConnectionRef.current === conn
        disconnectHandled = false
        currentConnectionRef.current = conn
        if (!alreadyReady) {
          setLastConnectedAt(new Date())
        }
        dispatch({ type: 'READY_EVENT', connection: conn })
        void Promise.resolve(setStoreConnection(conn)).catch((error) => {
          console.warn('Failed to set store connection:', error)
        })
      }

      conn.addEventListener('disconnected', handleDisconnected)
      conn.addEventListener('ready', handleReady)

      // Store cleanup function to remove event listeners
      connectionCleanupRef.current = () => {
        conn.removeEventListener('disconnected', handleDisconnected)
        conn.removeEventListener('ready', handleReady)
      }

      currentConnectionRef.current = conn
      setLastConnectedAt(new Date())
      dispatch({ type: 'CONNECTION_SUCCESS', connection: conn })
      void Promise.resolve(setStoreConnection(conn)).catch((error) => {
        console.warn('Failed to set store connection:', error)
      })
    } catch (err) {
      if (attemptId !== connectionAttemptRef.current || manuallyStoppedRef.current) return
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        'redirecting' in err &&
        err.code === 'auth_expired' &&
        err.redirecting === true
      ) {
        console.info('OAuth redirect in progress; connection retry is paused.')
        return
      }

      const error = normalizeConnectionError(err)
      let helpfulMessage = `Connection failed: ${error.message}`

      // Provide helpful debugging information
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        helpfulMessage += '\n\nPossible causes:\n• Home Assistant is not running\n• URL is incorrect\n• Network connectivity issues\n• CORS issues (try using ws:// instead of http://)'
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        helpfulMessage += '\n\nPossible causes:\n• Invalid or expired access token\n• Token lacks necessary permissions\n• Check your long-lived access token in Home Assistant'
      } else if (error.message.includes('WebSocket connection') || error.message.includes('ws://')) {
        helpfulMessage += '\n\nWebSocket connection issues:\n• Check if WebSocket is enabled in Home Assistant\n• Verify the WebSocket URL format\n• Check firewall/proxy settings'
      }

      console.error(helpfulMessage)
      dispatch({ type: 'CONNECTION_ERROR', error })
    }
  }, [url, token, authMode, redirectUri, mockData, transport, usesExternalTransport, usesMockMode, setStoreConnection, cleanupConnection])

  // Start a connection attempt
  const connect = useCallback(() => {
    manuallyStoppedRef.current = false
    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = undefined
    }

    dispatch({ type: 'START_CONNECTING' })
    void attemptConnection()
  }, [attemptConnection])

  // Manual reconnection (resets retry count)
  const reconnect = useCallback(() => {
    manuallyStoppedRef.current = false
    connectionAttemptRef.current += 1
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = undefined
    }

    if (!usesMockMode) {
      cleanupConnection()
    }

    dispatch({ type: 'MANUAL_RECONNECT' })
    // Manual reconnect starts immediately
    const reconnectTimeout = setTimeout(() => {
      if (retryTimeoutRef.current === reconnectTimeout) {
        retryTimeoutRef.current = undefined
      }
      if (manuallyStoppedRef.current) return
      dispatch({ type: 'START_CONNECTING' })
      void attemptConnection()
    }, 0)
    retryTimeoutRef.current = reconnectTimeout
  }, [attemptConnection, usesMockMode, cleanupConnection])

  // Logout function that immediately closes connection
  const handleLogout = useCallback(() => {
    manuallyStoppedRef.current = true
    connectionAttemptRef.current += 1
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = undefined
    }

    // Clear authentication owned by the active connection mode.
    try {
      if (usesExternalTransport) {
        const logoutResult = transport?.logout?.()
        observeTransportOperation(logoutResult, 'Failed to log out cleanly:')
      } else {
        authLogout()
      }
    } catch (error) {
      console.warn('Failed to log out cleanly:', error)
    }

    // Clear auth ref and token refresh state
    currentAuthRef.current = null
    if (periodicRefreshState.current.intervalRef) {
      clearInterval(periodicRefreshState.current.intervalRef)
      periodicRefreshState.current.intervalRef = undefined
    }

    // Clear all pending retry timeouts and reset state
    periodicRefreshState.current.retry.cancelled = true
    periodicRefreshState.current.retry.timeouts.forEach(clearTimeout)
    periodicRefreshState.current.retry.timeouts.clear()
    periodicRefreshState.current.retry.inProgress = false

    visibilityRefreshState.current.retry.cancelled = true
    visibilityRefreshState.current.retry.timeouts.forEach(clearTimeout)
    visibilityRefreshState.current.retry.timeouts.clear()
    visibilityRefreshState.current.retry.inProgress = false

    // Immediately close WebSocket connection
    cleanupConnection()
    void Promise.resolve(setStoreConnection(null)).catch((error) => {
      console.warn('Failed to clear store connection:', error)
    })
    dispatch({ type: 'MANUAL_STOP' })
  }, [authLogout, transport, usesExternalTransport, setStoreConnection, cleanupConnection])

  // Handle auto-retry for disconnections and errors
  const hasPendingAutoRetry = (state.type === 'disconnected' || state.type === 'error') &&
    !usesMockMode &&
    !manuallyStoppedRef.current &&
    options.autoReconnect !== false

  useEffect(() => {
    if (hasPendingAutoRetry) {
      const delay = Math.min(1000 * Math.pow(2, state.retryCount - 1), 30000)
      setNextRetryIn(delay)

      // Update countdown every second, including the final zero.
      const countdownInterval = setInterval(() => {
        setNextRetryIn(prev => prev === undefined ? undefined : Math.max(0, prev - 1000))
      }, 1000)

      const retryTimeout = setTimeout(() => {
        if (retryTimeoutRef.current === retryTimeout) {
          retryTimeoutRef.current = undefined
        }
        setNextRetryIn(0)
        if (manuallyStoppedRef.current) return
        dispatch({ type: 'RETRY_SCHEDULED' })
        void attemptConnection()
      }, delay)
      retryTimeoutRef.current = retryTimeout

      return () => {
        clearInterval(countdownInterval)
        clearTimeout(retryTimeout)
        if (retryTimeoutRef.current === retryTimeout) {
          retryTimeoutRef.current = undefined
        }
        setNextRetryIn(undefined)
      }
    }

    setNextRetryIn(undefined)
    return undefined
  }, [hasPendingAutoRetry, state.retryCount, attemptConnection])

  // Periodic token refresh - checks on a stable cadence while using OAuth
  const effectiveAuthMode = authMode === 'auto' ? (token ? 'token' : 'oauth') : authMode
  useEffect(() => {
    if (!usesMockMode && !usesExternalTransport && effectiveAuthMode !== 'token') {
      const refreshIntervalMs = (options.tokenRefreshIntervalMinutes || 30) * 60 * 1000
      const bufferMinutes = options.tokenRefreshBufferMinutes || DEFAULT_TOKEN_BUFFER_MINUTES
      const retryState: RetryState = {
        timeouts: new Set<NodeJS.Timeout>(),
        inProgress: false,
        cancelled: false
      }
      periodicRefreshState.current.retry = retryState

      // Create retry executor with exponential backoff
      const executePeriodicRefresh = createRetryExecutor({
        maxRetries: 5,
        baseDelayMs: BASE_PERIODIC_RETRY_DELAY_MS,
        maxDelayMs: MAX_PERIODIC_RETRY_DELAY_MS,
        retryState,
        logContext: 'Token refresh'
      })

      // Keep the interval stable across connection flaps and check live connectivity in the tick.
      periodicRefreshState.current.intervalRef = setInterval(() => {
        if (!connectedRef.current || retryState.inProgress) {
          return
        }

        // Clear any pending retry timeouts before starting a new sequence
        retryState.timeouts.forEach(clearTimeout)
        retryState.timeouts.clear()

        void executePeriodicRefresh(async () => {
          const currentAuth = currentAuthRef.current
          if (!currentAuth) return
          currentAuthRef.current = await refreshTokenIfNeeded(currentAuth, bufferMinutes)
        })
      }, refreshIntervalMs)

      return () => {
        if (periodicRefreshState.current.intervalRef) {
          clearInterval(periodicRefreshState.current.intervalRef)
          periodicRefreshState.current.intervalRef = undefined
        }
        retryState.cancelled = true
        retryState.timeouts.forEach(clearTimeout)
        retryState.timeouts.clear()
        retryState.inProgress = false
      }
    }
    return undefined
  }, [usesMockMode, usesExternalTransport, effectiveAuthMode, options.tokenRefreshIntervalMinutes, options.tokenRefreshBufferMinutes])

  // Visibility change handler - refresh tokens when app becomes visible
  useEffect(() => {
    if (!usesMockMode && !usesExternalTransport && effectiveAuthMode !== 'token') {
      const bufferMinutes = options.tokenRefreshBufferMinutes || DEFAULT_TOKEN_BUFFER_MINUTES
      const retryState: RetryState = {
        timeouts: new Set<NodeJS.Timeout>(),
        inProgress: false,
        cancelled: false
      }
      visibilityRefreshState.current.retry = retryState

      // Create retry executor with exponential backoff
      const executeVisibilityRefresh = createRetryExecutor({
        maxRetries: 3,
        baseDelayMs: BASE_VISIBILITY_RETRY_DELAY_MS,
        retryState,
        logContext: 'Visibility change token refresh'
      })

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && currentAuthRef.current && connectedRef.current) {
          // Skip if a retry is already in progress
          if (retryState.inProgress) {
            return
          }

          // Clear any pending retry timeouts before starting a new sequence
          retryState.timeouts.forEach(clearTimeout)
          retryState.timeouts.clear()

          // Execute token refresh with retry
          void executeVisibilityRefresh(async () => {
            if (!currentAuthRef.current) return
            const refreshedAuth = await refreshTokenIfNeeded(currentAuthRef.current, bufferMinutes)
            currentAuthRef.current = refreshedAuth
          })
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        retryState.cancelled = true
        retryState.timeouts.forEach(clearTimeout)
        retryState.timeouts.clear()
        retryState.inProgress = false
      }
    }
    return undefined
  }, [usesMockMode, usesExternalTransport, effectiveAuthMode, options.tokenRefreshBufferMinutes])

  const connectRef = useRef(connect)
  const cleanupConnectionRef = useRef(cleanupConnection)
  connectRef.current = connect
  cleanupConnectionRef.current = cleanupConnection

  // Auto-connect on mount
  useEffect(() => {
    connectRef.current()

    return () => {
      manuallyStoppedRef.current = true
      connectionAttemptRef.current += 1
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = undefined
      }
      if (periodicRefreshState.current.intervalRef) {
        clearInterval(periodicRefreshState.current.intervalRef)
      }
      // Clear all pending retry timeouts and reset state
      periodicRefreshState.current.retry.cancelled = true
      periodicRefreshState.current.retry.timeouts.forEach(clearTimeout)
      periodicRefreshState.current.retry.timeouts.clear()
      periodicRefreshState.current.retry.inProgress = false

      visibilityRefreshState.current.retry.cancelled = true
      visibilityRefreshState.current.retry.timeouts.forEach(clearTimeout)
      visibilityRefreshState.current.retry.timeouts.clear()
      visibilityRefreshState.current.retry.inProgress = false

      cleanupConnectionRef.current()
      currentAuthRef.current = null
      try {
        useStore.getState().clear()
      } catch (error) {
        // Handle store unavailability gracefully
        console.warn('Failed to clear entity store:', error)
      }
    }
  }, [])

  // Map internal state to public interface
  const config = useMemo<HAConfig>(() => ({
    url,
    token,
    authMode,
    redirectUri,
    mockMode,
    mockData,
    mockUser,
    transport,
    options
  }), [url, token, authMode, redirectUri, mockMode, mockData, mockUser, transport, options])

  const contextValue = useMemo<HAContextValue<HAConnection>>(() => ({
    connection: state.connection,
    connected: state.type === 'connected',
    connecting: state.type === 'connecting',
    error: state.type === 'error' ? state.error : null,
    reconnect,
    logout: handleLogout,
    connectionState: state.type,
    retryCount: state.retryCount,
    nextRetryIn,
    isAutoRetrying: hasPendingAutoRetry,
    lastConnectedAt,
    config,
  }), [state, reconnect, handleLogout, nextRetryIn, hasPendingAutoRetry, lastConnectedAt, config])

  return <HAContext.Provider value={contextValue}>{children}</HAContext.Provider>
}