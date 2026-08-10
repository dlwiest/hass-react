import { createContext, useContext, useEffect, useReducer, useCallback, useRef, useState, ReactNode } from 'react'
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

function observeTransportOperation(operation: void | Promise<void>, warning: string): void {
  if (operation) {
    void operation.catch((error) => console.warn(warning, error))
  }
}

// Token refresh retry state
interface RetryState {
  timeouts: Set<NodeJS.Timeout>
  inProgress: boolean
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
    config.retryState.inProgress = true

    try {
      const result = await fn()
      config.retryState.inProgress = false
      return result
    } catch (error) {
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
          executeWithRetry(fn, retryCount + 1).catch(err => {
            console.error(`${config.logContext} retry attempt threw an unhandled error:`, err)
          })
        }, delayMs)
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
      return {
        type: 'idle',
        connection: null,
        error: null,
        retryCount: 0
      }

    case 'READY_EVENT':
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
  options = {}
}: HAProviderProps) => {
  const usesExternalTransport = transport !== undefined
  const usesMockMode = mockMode && !usesExternalTransport
  const [state, dispatch] = useReducer(connectionReducer, {
    type: 'idle',
    connection: null,
    error: null,
    retryCount: 0
  })

  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  const currentConnectionRef = useRef<HAConnection | null>(null)
  const currentAuthRef = useRef<Auth | null>(null)
  const connectionCleanupRef = useRef<(() => void) | null>(null)
  const connectionAttemptRef = useRef(0)
  const manuallyStoppedRef = useRef(false)

  // Grouped token refresh state
  const periodicRefreshState = useRef({
    intervalRef: undefined as NodeJS.Timeout | undefined,
    retry: { timeouts: new Set<NodeJS.Timeout>(), inProgress: false } as RetryState
  })
  const visibilityRefreshState = useRef({
    retry: { timeouts: new Set<NodeJS.Timeout>(), inProgress: false } as RetryState
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

  // Development warnings for configuration issues
  useEffect(() => {
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
  }, [url, token, redirectUri, mockMode, mockData, authMode, usesExternalTransport, usesMockMode])

  // Async connection function
  const attemptConnection = useCallback(async () => {
    if (manuallyStoppedRef.current) return
    const attemptId = ++connectionAttemptRef.current

    if (usesExternalTransport && transport) {
      try {
        cleanupConnection()

        let transportConnection: HAConnection | null = null
        const handlers: HATransportHandlers = {
          onDisconnected: () => {
            // Ignore a late disconnect notification from a connection that has
            // already been replaced by a manual or automatic reconnect.
            if (
              attemptId !== connectionAttemptRef.current ||
              !transportConnection ||
              currentConnectionRef.current !== transportConnection
            ) return

            const connection = transportConnection
            currentConnectionRef.current = null
            try {
              observeTransportOperation(
                transport.disconnect(connection),
                'Failed to disconnect external transport:'
              )
            } catch (error) {
              console.warn('Failed to disconnect external transport:', error)
            }
            try {
              setStoreConnection(null)
            } catch (error) {
              console.warn('Failed to clear store connection:', error)
            }
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
        currentConnectionRef.current = connection
        setLastConnectedAt(new Date())
        dispatch({ type: 'CONNECTION_SUCCESS', connection })
        try {
          setStoreConnection(connection)
        } catch (error) {
          console.warn('Failed to set store connection:', error)
        }
      } catch (error) {
        if (attemptId !== connectionAttemptRef.current || manuallyStoppedRef.current) return
        console.error('External Home Assistant transport failed to connect:', error)
        dispatch({ type: 'CONNECTION_ERROR', error: error as Error })
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
      try {
        setStoreConnection(mockConn)
      } catch (error) {
        console.warn('Failed to set store connection:', error)
      }
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
      const handleDisconnected = () => {
        currentConnectionRef.current = null
        try {
          setStoreConnection(null)
        } catch (error) {
          console.warn('Failed to clear store connection:', error)
        }
        dispatch({ type: 'DISCONNECTED' })
      }

      const handleReady = () => {
        // Use READY_EVENT action - reducer will only accept if in valid state
        currentConnectionRef.current = conn
        setLastConnectedAt(new Date())
        dispatch({ type: 'READY_EVENT', connection: conn })
        try {
          setStoreConnection(conn)
        } catch (error) {
          console.warn('Failed to set store connection:', error)
        }
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
      try {
        setStoreConnection(conn)
      } catch (error) {
        console.warn('Failed to set store connection:', error)
      }
    } catch (err) {
      if (attemptId !== connectionAttemptRef.current || manuallyStoppedRef.current) return
      const error = err as Error
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
    }

    dispatch({ type: 'START_CONNECTING' })
    attemptConnection()
  }, [attemptConnection])

  // Manual reconnection (resets retry count)
  const reconnect = useCallback(() => {
    manuallyStoppedRef.current = false
    connectionAttemptRef.current += 1
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }

    if (!usesMockMode) {
      cleanupConnection()
    }

    dispatch({ type: 'MANUAL_RECONNECT' })
    // Manual reconnect starts immediately
    setTimeout(() => {
      dispatch({ type: 'START_CONNECTING' })
      attemptConnection()
    }, 0)
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
        auth.logout()
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
    periodicRefreshState.current.retry.timeouts.forEach(clearTimeout)
    periodicRefreshState.current.retry.timeouts.clear()
    periodicRefreshState.current.retry.inProgress = false

    visibilityRefreshState.current.retry.timeouts.forEach(clearTimeout)
    visibilityRefreshState.current.retry.timeouts.clear()
    visibilityRefreshState.current.retry.inProgress = false

    // Immediately close WebSocket connection
    cleanupConnection()
    try {
      setStoreConnection(null)
    } catch (error) {
      console.warn('Failed to clear store connection:', error)
    }
    dispatch({ type: 'DISCONNECTED' })
  }, [auth, transport, usesExternalTransport, setStoreConnection, cleanupConnection])

  // Handle auto-retry for disconnections and errors
  useEffect(() => {
    const shouldAutoRetry = (state.type === 'disconnected' || state.type === 'error') &&
      !usesMockMode &&
      !manuallyStoppedRef.current &&
      options.autoReconnect !== false

    if (shouldAutoRetry) {
      const delay = Math.min(1000 * Math.pow(2, state.retryCount - 1), 30000)
      setNextRetryIn(delay)

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        setNextRetryIn(prev => prev && prev > 1000 ? prev - 1000 : undefined)
      }, 1000)

      retryTimeoutRef.current = setTimeout(() => {
        setNextRetryIn(undefined)
        dispatch({ type: 'RETRY_SCHEDULED' })
        attemptConnection()
      }, delay)

      return () => {
        clearInterval(countdownInterval)
        setNextRetryIn(undefined)
      }
    } else {
      setNextRetryIn(undefined)
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [state.type, state.retryCount, usesMockMode, options.autoReconnect, attemptConnection])

  // Periodic token refresh - runs when connected and using OAuth
  useEffect(() => {
    if (state.type === 'connected' && currentAuthRef.current && !usesMockMode && !usesExternalTransport && authMode !== 'token') {
      const refreshIntervalMs = (options.tokenRefreshIntervalMinutes || 30) * 60 * 1000

      // Create retry executor with exponential backoff
      const executePeriodicRefresh = createRetryExecutor({
        maxRetries: 5,
        baseDelayMs: BASE_PERIODIC_RETRY_DELAY_MS,
        maxDelayMs: MAX_PERIODIC_RETRY_DELAY_MS,
        retryState: periodicRefreshState.current.retry,
        logContext: 'Token refresh'
      })

      // Set up periodic refresh interval
      periodicRefreshState.current.intervalRef = setInterval(() => {
        // Skip if a retry is already in progress
        if (periodicRefreshState.current.retry.inProgress) {
          return
        }

        // Clear any pending retry timeouts before starting a new sequence
        periodicRefreshState.current.retry.timeouts.forEach(clearTimeout)
        periodicRefreshState.current.retry.timeouts.clear()

        // Periodically refresh the access token to keep it valid
        executePeriodicRefresh(async () => {
          if (!currentAuthRef.current) return
          await currentAuthRef.current.refreshAccessToken()
        })
      }, refreshIntervalMs)

      return () => {
        if (periodicRefreshState.current.intervalRef) {
          clearInterval(periodicRefreshState.current.intervalRef)
          periodicRefreshState.current.intervalRef = undefined
        }
        // Clear any pending retry timeouts
        periodicRefreshState.current.retry.timeouts.forEach(clearTimeout)
        periodicRefreshState.current.retry.timeouts.clear()
        periodicRefreshState.current.retry.inProgress = false
      }
    }
    return undefined
  }, [state.type, usesMockMode, usesExternalTransport, authMode, options.tokenRefreshIntervalMinutes, options.tokenRefreshBufferMinutes])

  // Visibility change handler - refresh tokens when app becomes visible
  useEffect(() => {
    if (!usesMockMode && !usesExternalTransport && authMode !== 'token') {
      const bufferMinutes = options.tokenRefreshBufferMinutes || DEFAULT_TOKEN_BUFFER_MINUTES

      // Create retry executor with exponential backoff
      const executeVisibilityRefresh = createRetryExecutor({
        maxRetries: 3,
        baseDelayMs: BASE_VISIBILITY_RETRY_DELAY_MS,
        retryState: visibilityRefreshState.current.retry,
        logContext: 'Visibility change token refresh'
      })

      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible' && currentAuthRef.current && state.type === 'connected') {
          // Skip if a retry is already in progress
          if (visibilityRefreshState.current.retry.inProgress) {
            return
          }

          // Clear any pending retry timeouts before starting a new sequence
          visibilityRefreshState.current.retry.timeouts.forEach(clearTimeout)
          visibilityRefreshState.current.retry.timeouts.clear()

          // Execute token refresh with retry
          executeVisibilityRefresh(async () => {
            if (!currentAuthRef.current) return
            const refreshedAuth = await refreshTokenIfNeeded(currentAuthRef.current, bufferMinutes)
            currentAuthRef.current = refreshedAuth
          })
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        // Clear any pending visibility refresh retry timeouts
        visibilityRefreshState.current.retry.timeouts.forEach(clearTimeout)
        visibilityRefreshState.current.retry.timeouts.clear()
        visibilityRefreshState.current.retry.inProgress = false
      }
    }
    return undefined
  }, [state.type, usesMockMode, usesExternalTransport, authMode, options.tokenRefreshBufferMinutes])

  // Auto-connect on mount
  useEffect(() => {
    connect()

    return () => {
      manuallyStoppedRef.current = true
      connectionAttemptRef.current += 1
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (periodicRefreshState.current.intervalRef) {
        clearInterval(periodicRefreshState.current.intervalRef)
      }
      // Clear all pending retry timeouts and reset state
      periodicRefreshState.current.retry.timeouts.forEach(clearTimeout)
      periodicRefreshState.current.retry.timeouts.clear()
      periodicRefreshState.current.retry.inProgress = false

      visibilityRefreshState.current.retry.timeouts.forEach(clearTimeout)
      visibilityRefreshState.current.retry.timeouts.clear()
      visibilityRefreshState.current.retry.inProgress = false

      cleanupConnection()
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
  const contextValue: HAContextValue<HAConnection> = {
    connection: state.connection,
    connected: state.type === 'connected',
    connecting: state.type === 'connecting',
    error: state.type === 'error' ? state.error : null,
    reconnect,
    logout: handleLogout,
    connectionState: state.type,
    retryCount: state.retryCount,
    nextRetryIn,
    isAutoRetrying: (state.type === 'disconnected' || state.type === 'error') &&
                   !usesMockMode &&
                   !manuallyStoppedRef.current &&
                   options.autoReconnect !== false &&
                   !!nextRetryIn,
    lastConnectedAt,
    config: { url, token, authMode, redirectUri, mockMode, mockData, mockUser, transport, options },
  }

  return <HAContext.Provider value={contextValue}>{children}</HAContext.Provider>
}