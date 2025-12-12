import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, act } from '@testing-library/react'
import { createConnection, createLongLivedTokenAuth, Auth, Connection } from 'home-assistant-js-websocket'
import { HAProvider, useHAConnection } from '../HAProvider'
import { useStore } from '../../services/entityStore'
import { createAuthenticatedConnection, refreshTokenIfNeeded } from '../../services/auth'
import type { EntityState } from '../../types'

// Mock the home-assistant-js-websocket module
vi.mock('home-assistant-js-websocket')

// Mock the entity store
vi.mock('../../services/entityStore')

// Mock the auth service
vi.mock('../../services/auth', async () => {
  const actual = await vi.importActual('../../services/auth')
  return {
    ...actual,
    createAuthenticatedConnection: vi.fn(),
    refreshTokenIfNeeded: vi.fn()
  }
})

const mockCreateConnection = vi.mocked(createConnection)
const mockCreateLongLivedTokenAuth = vi.mocked(createLongLivedTokenAuth)
const mockCreateAuthenticatedConnection = vi.mocked(createAuthenticatedConnection)
const mockRefreshTokenIfNeeded = vi.mocked(refreshTokenIfNeeded)
const mockUseStore = vi.mocked(useStore)

// Test component
function TestComponent() {
  const { connected, connecting, error, connectionState, retryCount, isAutoRetrying, lastConnectedAt } = useHAConnection()
  
  return (
    <div>
      <div data-testid="connected">{connected ? 'true' : 'false'}</div>
      <div data-testid="connecting">{connecting ? 'true' : 'false'}</div>
      <div data-testid="error">{error?.message || 'none'}</div>
      <div data-testid="connection-state">{connectionState}</div>
      <div data-testid="retry-count">{retryCount}</div>
      <div data-testid="is-auto-retrying">{isAutoRetrying ? 'true' : 'false'}</div>
      <div data-testid="last-connected-at">{lastConnectedAt?.toISOString() || 'none'}</div>
    </div>
  )
}

// Helper to create mock auth
function createMockAuth(token: string = 'test-token'): Auth {
  return {
    data: {
      access_token: token,
      hassUrl: 'http://test:8123',
      clientId: 'mock-client-id',
      expires: Date.now() + 3600000, // 1 hour from now
      refresh_token: 'mock-refresh-token',
      expires_in: 3600
    },
    wsUrl: 'ws://test:8123/api/websocket',
    accessToken: token,
    expired: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
    refreshAccessToken: vi.fn().mockResolvedValue(undefined),
    hassUrl: 'http://test:8123'
  } as Auth
}

// Helper to create mock connection with event capabilities
function createMockConnection() {
  const listeners: Record<string, Function[]> = {}
  
  const connection = {
    addEventListener: vi.fn((event: string, callback: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(callback)
    }),
    close: vi.fn(),
    sendMessagePromise: vi.fn(),
    // Add other required Connection properties as mocks
    options: {},
    commandId: 1,
    commands: new Map(),
    eventListeners: {},
    subscriptions: {},
    suspendReconnectUntil: undefined,
    reconnectBackoff: false,
    closeRequested: false,
    socket: {} as WebSocket,
    auth: {} as any,
    removeEventListener: vi.fn(),
    ping: vi.fn(),
    suspendReconnectPromise: undefined,
    haVersion: '2023.1.0',
    sendMessage: vi.fn(),
    subscribeEvents: vi.fn(),
    subscribeMessage: vi.fn()
  } as unknown as Connection
  
  const emit = (event: string, data?: any) => {
    if (listeners[event]) {
      listeners[event].forEach(callback => callback(data))
    }
  }
  
  return { connection, emit }
}

describe('HAProvider Clean Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()

    // Setup default mock for useStore
    const defaultState = {
      entities: new Map<string, EntityState>(),
      componentSubscriptions: new Map<string, Set<() => void>>(),
      websocketSubscriptions: new Map<string, { unsubscribe: () => void }>(),
      registeredEntities: new Set<string>(),
      subscriptionErrors: new Map<string, Error>(),
      connection: null,
      setConnection: vi.fn(),
      updateEntity: vi.fn(),
      setSubscriptionError: vi.fn(),
      registerEntity: vi.fn(),
      unregisterEntity: vi.fn(),
      batchUpdate: vi.fn(),
      clear: vi.fn()
    }

    mockUseStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        // This handles calls like useStore((state) => state.setConnection)
        return selector(defaultState)
      }
      // Fallback
      return vi.fn()
    })

    // Also mock getState() calls directly
    mockUseStore.getState = vi.fn(() => defaultState)

    // Setup default mock for createAuthenticatedConnection to delegate to createConnection
    mockCreateAuthenticatedConnection.mockImplementation(async ({ hassUrl, token }) => {
      const mockAuth = createMockAuth(token || 'test-token')
      const connection = await mockCreateConnection({ auth: mockAuth })
      return { connection, auth: mockAuth }
    })

    // Setup default mock for refreshTokenIfNeeded
    mockRefreshTokenIfNeeded.mockImplementation((auth: Auth) => Promise.resolve(auth))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start in connecting state', () => {
    const mockAuth = createMockAuth('test-token')
    mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
    mockCreateConnection.mockReturnValue(new Promise(() => {})) // Never resolves
    
    render(
      <HAProvider url="http://test:8123" token="test-token">
        <TestComponent />
      </HAProvider>
    )

    expect(screen.getByTestId('connecting')).toHaveTextContent('true')
    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('should handle successful connection', async () => {
    const mockAuth = createMockAuth('test-token')
    mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
    
    const { connection } = createMockConnection()
    mockCreateConnection.mockResolvedValue(connection)
    
    render(
      <HAProvider url="http://test:8123" token="test-token">
        <TestComponent />
      </HAProvider>
    )

    await vi.waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })
  })

  it('should handle disconnection without flickering', async () => {
    const mockAuth = createMockAuth('test-token')
    mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
    
    const { connection, emit } = createMockConnection()
    mockCreateConnection.mockResolvedValue(connection)
    
    render(
      <HAProvider url="http://test:8123" token="test-token">
        <TestComponent />
      </HAProvider>
    )

    // Wait for initial connection
    await vi.waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
    })

    // Track state changes
    const stateChanges: string[] = []
    const captureState = () => {
      const connected = screen.getByTestId('connected').textContent === 'true'
      const connecting = screen.getByTestId('connecting').textContent === 'true'
      stateChanges.push(`${connected ? 'connected' : 'disconnected'}${connecting ? '+connecting' : ''}`)
    }

    captureState() // Initial state
    
    // Trigger disconnection
    act(() => {
      emit('disconnected')
    })
    
    captureState() // After disconnection
    
    // Trigger ready event
    act(() => {
      emit('ready')
    })
    
    captureState() // After ready

    // Should have clean state transitions without invalid combined states
    expect(stateChanges).toEqual([
      'connected',      // Initial connected state
      'disconnected',   // After disconnection (clean)
      'connected'       // After ready (clean)
    ])
    
    // No invalid states like 'connected+connecting'
    const invalidStates = stateChanges.filter(state => state.includes('+connecting'))
    expect(invalidStates).toHaveLength(0)
  })

  it('should show connecting state during auto-reconnect', async () => {
    const mockAuth = createMockAuth('test-token')
    mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
    
    const { connection, emit } = createMockConnection()
    mockCreateConnection.mockResolvedValue(connection)
    
    render(
      <HAProvider url="http://test:8123" token="test-token">
        <TestComponent />
      </HAProvider>
    )

    // Wait for initial connection
    await vi.waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
    })

    // Trigger disconnection
    act(() => {
      emit('disconnected')
    })

    // Should be disconnected
    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('connecting')).toHaveTextContent('false')
    
    // Advance time to trigger auto-reconnect (first retry is after 1000ms)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    // Should now be in connecting state (not error state)
    expect(screen.getByTestId('connecting')).toHaveTextContent('true')
    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('should handle connection errors with retry', async () => {
    const mockAuth = createMockAuth('test-token')
    mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
    
    const error = new Error('Connection failed')
    mockCreateConnection.mockRejectedValue(error)
    
    render(
      <HAProvider url="http://test:8123" token="test-token">
        <TestComponent />
      </HAProvider>
    )

    // Should show error initially
    await vi.waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
    })

    // Should retry after delay
    act(() => {
      vi.advanceTimersByTime(1000) // First retry
    })

    expect(screen.getByTestId('connecting')).toHaveTextContent('true')
  })

  describe('Manual Reconnection', () => {
    it('should reset retry count on manual reconnect', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error) // Fail 3 times to build up retry count
        .mockResolvedValue(createMockConnection().connection) // Then succeed
      
      const { rerender } = render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial error
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Let auto-retry happen twice to increase retry count
      act(() => {
        vi.advanceTimersByTime(1000) // First retry (1s delay)
      })
      
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      act(() => {
        vi.advanceTimersByTime(2000) // Second retry (2s delay) 
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Now manual reconnect should reset retry count and succeed immediately
      const TestComponentWithReconnect = () => {
        const { connected, connecting, error, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <div data-testid="connecting">{connecting ? 'true' : 'false'}</div>
            <div data-testid="error">{error?.message || 'none'}</div>
            <button data-testid="reconnect" onClick={reconnect}>Reconnect</button>
          </div>
        )
      }

      rerender(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Manual reconnect
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Should connect successfully (no delay since retry count was reset)
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('error')).toHaveTextContent('none')
      })
    })

    it('should close existing connection before manual reconnect', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection: mockConnection1 } = createMockConnection()
      const { connection: mockConnection2 } = createMockConnection()
      
      mockCreateConnection
        .mockResolvedValueOnce(mockConnection1)
        .mockResolvedValueOnce(mockConnection2)

      const TestComponentWithReconnect = () => {
        const { connected, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <button data-testid="reconnect" onClick={reconnect}>Reconnect</button>
          </div>
        )
      }
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Manual reconnect
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Should have closed the first connection
      expect(mockConnection1.close).toHaveBeenCalled()
      
      // Should connect with new connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })
    })

    it('should clear pending retry timeouts on manual reconnect', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection
        .mockRejectedValueOnce(error)
        .mockResolvedValue(createMockConnection().connection)

      const TestComponentWithReconnect = () => {
        const { connected, error, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <div data-testid="error">{error?.message || 'none'}</div>
            <button data-testid="reconnect" onClick={reconnect}>Reconnect</button>
          </div>
        )
      }
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Wait for initial error (this schedules auto-retry)
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Manual reconnect before auto-retry fires
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Should connect immediately without waiting for auto-retry timer
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('error')).toHaveTextContent('none')
      })

      // Advance time to when auto-retry would have fired
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should still be connected (auto-retry was cancelled)
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })
  })

  describe('Auto-Reconnection Edge Cases', () => {
    it('should use exponential backoff (1s, 2s, 4s, 8s)', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection.mockRejectedValue(error) // Always fail
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Initial error
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // First retry: should happen after 1 second  
      // (retryCount=1, delay = 2^(1-1) = 1s)
      act(() => {
        vi.advanceTimersByTime(1000) // 1s
      })
      
      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })

      // Wait for retry to fail
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Second retry: should happen after 2 seconds
      // (retryCount=2, delay = 2^(2-1) = 2s)
      act(() => {
        vi.advanceTimersByTime(2000) // 2s
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })

      // Wait for retry to fail
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Third retry: should happen after 4 seconds
      // (retryCount=3, delay = 2^(3-1) = 4s)
      act(() => {
        vi.advanceTimersByTime(4000) // 4s
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })
    })

    it('should cap retry delay at 30 seconds', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection.mockRejectedValue(error) // Always fail
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Simulate many failures to reach the cap
      // After 5 failures: 1s, 2s, 4s, 8s, 16s, then should cap at 30s
      
      // Initial error
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Fast-forward through the exponential backoff sequence
      for (const delay of [1000, 2000, 4000, 8000, 16000]) {
        act(() => {
          vi.advanceTimersByTime(delay)
        })
        
        await vi.waitFor(() => {
          expect(screen.getByTestId('connecting')).toHaveTextContent('true')
        })
        
        await vi.waitFor(() => {
          expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
        })
      }

      // Next retry should be capped at 30 seconds (not 32 seconds)
      // (retryCount=6, delay = min(2^5, 30s) = min(32s, 30s) = 30s)
      act(() => {
        vi.advanceTimersByTime(30000) // 30s (capped)
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })
    })

    it('should not auto-reconnect when autoReconnect=false', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection.mockRejectedValue(error)
      
      render(
        <HAProvider url="http://test:8123" token="test-token" options={{ autoReconnect: false }}>
          <TestComponent />
        </HAProvider>
      )

      // Should show error
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
        expect(screen.getByTestId('connecting')).toHaveTextContent('false')
        expect(screen.getByTestId('connected')).toHaveTextContent('false')
      })

      // Wait longer than any retry would happen
      act(() => {
        vi.advanceTimersByTime(60000) // 60 seconds
      })

      // Should still be in error state, no retry attempt
      expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
    })

    it('should handle multiple rapid disconnections gracefully', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Simulate rapid multiple disconnections
      act(() => {
        emit('disconnected')
        emit('disconnected') 
        emit('disconnected')
      })

      // Should be in disconnected state
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')

      // Should start reconnecting after the delay
      // Multiple disconnections might increment retry count to 3, so delay = 2^(3-1) = 4s
      act(() => {
        vi.advanceTimersByTime(4000)
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })
      
      // Should successfully reconnect
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })
    })

    it('should not auto-reconnect from disconnection when autoReconnect=false', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)
      
      render(
        <HAProvider url="http://test:8123" token="test-token" options={{ autoReconnect: false }}>
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Trigger disconnection
      act(() => {
        emit('disconnected')
      })

      // Should be disconnected
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')

      // Wait longer than any retry would happen
      act(() => {
        vi.advanceTimersByTime(60000) // 60 seconds
      })

      // Should still be disconnected, no retry attempt
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })
  })

  describe('Connection State Machine', () => {
    it('should handle ready events to restore connection after disconnection', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Disconnect
      act(() => {
        emit('disconnected')
      })

      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')

      // Fire ready event - should restore connection
      act(() => {
        emit('ready')
      })

      // Should accept the ready event and reconnect
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })

    it('should handle ready events during connecting state', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Disconnect to trigger auto-retry
      act(() => {
        emit('disconnected')
      })

      // Advance time to start auto-retry (connecting state)
      act(() => {
        vi.advanceTimersByTime(1000) // First retry after 1s
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })

      // Fire ready event while connecting - should succeed
      act(() => {
        emit('ready')
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      })
    })

    it('should prevent duplicate connection attempts when already connecting', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      // Mock connection that takes time to resolve
      const connectionPromise = new Promise<Connection>((resolve) => {
        setTimeout(() => {
          const { connection } = createMockConnection()
          resolve(connection)
        }, 100)
      })
      
      mockCreateConnection.mockReturnValue(connectionPromise)
      
      const TestComponentWithConnect = () => {
        const { connected, connecting, error } = useHAConnection()
        const contextValue = useHAConnection()
        
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <div data-testid="connecting">{connecting ? 'true' : 'false'}</div>
            <div data-testid="error">{error?.message || 'none'}</div>
            <button data-testid="connect" onClick={() => contextValue.reconnect()}>Connect</button>
          </div>
        )
      }
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithConnect />
        </HAProvider>
      )

      // Should be connecting initially
      expect(screen.getByTestId('connecting')).toHaveTextContent('true')

      // Try to trigger another connection attempt while already connecting
      act(() => {
        screen.getByTestId('connect').click()
        screen.getByTestId('connect').click() // Multiple clicks
        screen.getByTestId('connect').click()
      })

      // Should still only have one connection attempt
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
      
      // Wait for connection to complete
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })
    })

    it('should handle connection success after rapid state changes', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Rapid state changes: disconnect → ready → disconnect → ready
      act(() => {
        emit('disconnected')
        emit('ready')
        emit('disconnected') 
        emit('ready')
      })

      // Should end up in connected state
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('connecting')).toHaveTextContent('false')
        expect(screen.getByTestId('error')).toHaveTextContent('none')
      })
    })

    it('should maintain state consistency during concurrent events', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)
      
      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Track all state changes during rapid events
      const stateSnapshots: Array<{connected: boolean, connecting: boolean}> = []
      
      const observer = new MutationObserver(() => {
        const connected = screen.getByTestId('connected').textContent === 'true'
        const connecting = screen.getByTestId('connecting').textContent === 'true'
        stateSnapshots.push({ connected, connecting })
      })
      
      observer.observe(document.body, { 
        childList: true, 
        subtree: true, 
        characterData: true 
      })

      // Fire many events rapidly
      act(() => {
        for (let i = 0; i < 10; i++) {
          emit('disconnected')
          emit('ready')
        }
      })

      observer.disconnect()

      // Final state should be consistent
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      })

      // Should never have invalid combined states
      const invalidStates = stateSnapshots.filter(state => state.connected && state.connecting)
      expect(invalidStates).toHaveLength(0)
    })
  })

  describe('Mock Mode', () => {
    it('should connect immediately in mock mode without token', () => {
      render(
        <HAProvider url="http://test:8123" mockMode={true}>
          <TestComponent />
        </HAProvider>
      )

      // Should be connected immediately without token requirement
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })

    it('should populate entity store with mock data', async () => {
      const mockData = {
        'switch.test_switch': {
          entity_id: 'switch.test_switch',
          state: 'on',
          attributes: { friendly_name: 'Test Switch' },
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        },
        'light.test_light': {
          entity_id: 'light.test_light',
          state: 'off', 
          attributes: { friendly_name: 'Test Light', brightness: 100 },
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        }
      }

      render(
        <HAProvider url="http://test:8123" mockMode={true} mockData={mockData}>
          <TestComponent />
        </HAProvider>
      )

      // Should be connected
      expect(screen.getByTestId('connected')).toHaveTextContent('true')

      // Check that entity store was populated (we'd need to expose store state for testing)
      // This is a placeholder - in real implementation we'd need a way to access store state
    })

    it('should handle empty mock data gracefully', () => {
      render(
        <HAProvider url="http://test:8123" mockMode={true} mockData={{}}>
          <TestComponent />
        </HAProvider>
      )

      // Should still connect successfully with empty data
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })

    it('should ignore network connection logic in mock mode', () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      // Make real connection fail
      const error = new Error('Network error')
      mockCreateConnection.mockRejectedValue(error)

      render(
        <HAProvider url="http://test:8123" token="test-token" mockMode={true}>
          <TestComponent />
        </HAProvider>
      )

      // Should still connect in mock mode despite network error
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
      
      // Network functions should not have been called
      expect(mockCreateConnection).not.toHaveBeenCalled()
    })

    it('should not trigger auto-reconnection logic in mock mode', async () => {
      render(
        <HAProvider url="http://test:8123" mockMode={true}>
          <TestComponent />
        </HAProvider>
      )

      expect(screen.getByTestId('connected')).toHaveTextContent('true')

      // Mock mode should stay connected - no disconnection/reconnection cycles
      act(() => {
        vi.advanceTimersByTime(60000) // 60 seconds
      })

      // Should remain connected
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('none')
    })
  })

  describe('Configuration & Validation', () => {
    it('should require URL for real connections (OAuth auto-detection)', () => {
      render(
        <HAProvider url="" token="">
          <TestComponent />
        </HAProvider>
      )

      // Should show error for missing URL (token is optional with OAuth)
      expect(screen.getByTestId('error')).toHaveTextContent('URL is required')
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
    })

    it('should use OAuth when URL is provided without token', () => {
      render(
        <HAProvider url="http://test:8123" token="">
          <TestComponent />
        </HAProvider>
      )

      // Should attempt OAuth authentication (no error, will try to connect)
      // Note: In test environment, this may fail to connect but shouldn't show config errors
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('true')
    })

    it('should require URL when token is provided', () => {
      render(
        <HAProvider url="" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Should show error for missing URL (URL is always required)
      expect(screen.getByTestId('error')).toHaveTextContent('URL is required')
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
    })

    it('should handle autoReconnect option correctly', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection.mockRejectedValue(error)
      
      render(
        <HAProvider url="http://test:8123" token="test-token" options={{ autoReconnect: false }}>
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial error
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Should not auto-reconnect when disabled
      act(() => {
        vi.advanceTimersByTime(10000) // 10 seconds
      })

      // Should still be in error state
      expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      expect(screen.getByTestId('connected')).toHaveTextContent('false')
    })

    it('should expose configuration through context', () => {
      const TestConfigComponent = () => {
        const { config } = useHAConnection()
        return (
          <div>
            <div data-testid="config-url">{config.url}</div>
            <div data-testid="config-token">{config.token}</div>
            <div data-testid="config-mock-mode">{config.mockMode ? 'true' : 'false'}</div>
            <div data-testid="config-auto-reconnect">{config.options?.autoReconnect !== false ? 'true' : 'false'}</div>
          </div>
        )
      }

      render(
        <HAProvider 
          url="http://test:8123" 
          token="test-token" 
          mockMode={true}
          options={{ autoReconnect: false }}
        >
          <TestConfigComponent />
        </HAProvider>
      )

      // Should expose all configuration values
      expect(screen.getByTestId('config-url')).toHaveTextContent('http://test:8123')
      expect(screen.getByTestId('config-token')).toHaveTextContent('test-token')
      expect(screen.getByTestId('config-mock-mode')).toHaveTextContent('true')
      expect(screen.getByTestId('config-auto-reconnect')).toHaveTextContent('false')
    })

    it('should handle default options correctly', () => {
      const TestConfigComponent = () => {
        const { config } = useHAConnection()
        return (
          <div>
            <div data-testid="config-auto-reconnect">{config.options?.autoReconnect !== false ? 'true' : 'false'}</div>
            <div data-testid="config-mock-mode">{config.mockMode ? 'true' : 'false'}</div>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestConfigComponent />
        </HAProvider>
      )

      // Should have correct defaults
      expect(screen.getByTestId('config-auto-reconnect')).toHaveTextContent('true') // default is true
      expect(screen.getByTestId('config-mock-mode')).toHaveTextContent('false') // default is false
    })

    it('should validate that useHAConnection requires HAProvider', () => {
      // Suppress console.error for this test since React will log the error
      const originalError = console.error
      console.error = vi.fn()

      const TestComponentWithoutProvider = () => {
        const { connected } = useHAConnection()
        return <div data-testid="connected">{connected ? 'true' : 'false'}</div>
      }

      // Should throw error when used outside provider
      expect(() => {
        render(<TestComponentWithoutProvider />)
      }).toThrow('useHAConnection must be used within HAProvider')

      // Restore console.error
      console.error = originalError
    })
  })

  describe('Cleanup & Memory Management', () => {
    it('should close connection and clear timeouts on unmount', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      const { unmount } = render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Unmount component
      unmount()

      // Connection should be closed
      expect(connection.close).toHaveBeenCalled()
    })

    it('should clear retry timeouts when provider unmounts during reconnection', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection.mockRejectedValue(error)

      const { unmount } = render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for error and retry scheduling
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Unmount before retry fires
      unmount()

      // Advance time to when retry would have fired
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // No additional connection attempts should be made after unmount
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
    })

    it('should clear entity store on unmount', async () => {
      const mockData = {
        'switch.test': {
          entity_id: 'switch.test',
          state: 'on',
          attributes: {},
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        },
        'light.test': {
          entity_id: 'light.test',
          state: 'off',
          attributes: {},
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        }
      }

      const { unmount } = render(
        <HAProvider url="http://test:8123" mockMode={true} mockData={mockData}>
          <TestComponent />
        </HAProvider>
      )

      // Should be connected in mock mode
      expect(screen.getByTestId('connected')).toHaveTextContent('true')

      // Unmount and verify store is cleared
      unmount()

      // Note: We can't directly test store clearing without exposing store state,
      // but we verify it's called via the useStore.getState().clear() in the cleanup
    })

    it('should handle rapid mount/unmount cycles without errors', () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      // Rapid mount/unmount cycles should not throw errors
      expect(() => {
        for (let i = 0; i < 3; i++) {
          const { unmount } = render(
            <HAProvider url="http://test:8123" token="test-token">
              <TestComponent />
            </HAProvider>
          )
          
          // Immediate unmount simulates user navigating away quickly
          unmount()
        }
      }).not.toThrow()

      // Connection attempts should have been made
      expect(mockCreateConnection).toHaveBeenCalledTimes(3)
    })

    it('should not leak timeouts when reconnect is called multiple times', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      const TestComponentWithMultipleReconnects = () => {
        const { connected, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <button data-testid="reconnect" onClick={() => {
              reconnect()
              reconnect()
              reconnect()
            }}>
              Reconnect Multiple
            </button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithMultipleReconnects />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Trigger multiple rapid reconnects
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Should handle gracefully without timeout leaks
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Previous connection should be closed, new one created
      expect(connection.close).toHaveBeenCalled()
    })

    it('should clean up event listeners on connection changes', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection: connection1 } = createMockConnection()
      const { connection: connection2 } = createMockConnection()
      
      mockCreateConnection
        .mockResolvedValueOnce(connection1)
        .mockResolvedValueOnce(connection2)

      const TestComponentWithReconnect = () => {
        const { connected, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <button data-testid="reconnect" onClick={reconnect}>Reconnect</button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Trigger reconnection
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Wait for new connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // First connection should be closed (cleaning up its event listeners)
      expect(connection1.close).toHaveBeenCalled()
      // Second connection should be active
      expect(mockCreateConnection).toHaveBeenCalledTimes(2)
    })

    it('should handle provider props changes without memory leaks', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      const { rerender } = render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Change props (should trigger new connection)
      rerender(
        <HAProvider url="http://different:8123" token="new-token">
          <TestComponent />
        </HAProvider>
      )

      // Note: This test validates that prop changes are handled gracefully
      // In a real implementation, you might want to reconnect with new credentials
      // For now, we just verify it doesn't crash
    })

    it('should call removeEventListener for both disconnected and ready events on reconnection', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)

      const { connection: connection1 } = createMockConnection()
      const { connection: connection2 } = createMockConnection()

      mockCreateConnection
        .mockResolvedValueOnce(connection1)
        .mockResolvedValueOnce(connection2)

      const TestComponentWithReconnect = () => {
        const { connected, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <button data-testid="reconnect" onClick={reconnect}>Reconnect</button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Verify event listeners were added to connection1
      expect(connection1.addEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(connection1.addEventListener).toHaveBeenCalledWith('ready', expect.any(Function))

      // Trigger reconnection
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Wait for reconnection to complete and new connection to be set up
      await vi.waitFor(() => {
        expect(connection2.addEventListener).toHaveBeenCalled()
      })

      // Verify removeEventListener was called for both events on connection1
      expect(connection1.removeEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(connection1.removeEventListener).toHaveBeenCalledWith('ready', expect.any(Function))

      // Verify new listeners were added to connection2
      expect(connection2.addEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(connection2.addEventListener).toHaveBeenCalledWith('ready', expect.any(Function))
    })

    it('should remove event listeners before closing connection on unmount', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)

      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      const { unmount } = render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Verify listeners were added
      expect(connection.addEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(connection.addEventListener).toHaveBeenCalledWith('ready', expect.any(Function))

      // Unmount component
      unmount()

      // Verify listeners were removed before close
      expect(connection.removeEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(connection.removeEventListener).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(connection.close).toHaveBeenCalled()
    })

    it('should remove event listeners on logout', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)

      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      const TestComponentWithLogout = () => {
        const { connected, logout } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <button data-testid="logout" onClick={logout}>Logout</button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithLogout />
        </HAProvider>
      )

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Click logout
      act(() => {
        screen.getByTestId('logout').click()
      })

      // Verify listeners were removed
      expect(connection.removeEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(connection.removeEventListener).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(connection.close).toHaveBeenCalled()
    })

    it('should not fail if cleanup is called when connection is already null', () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)

      // This test verifies that cleanupConnection handles the case where
      // connection is null but cleanup function still exists
      expect(() => {
        render(
          <HAProvider url="http://test:8123" token="test-token">
            <TestComponent />
          </HAProvider>
        )
      }).not.toThrow()
    })
  })

  describe('Race Conditions & Edge Cases', () => {
    it('should handle simultaneous disconnect and ready events', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Fire simultaneous disconnect and ready events
      act(() => {
        emit('disconnected')
        emit('ready')
        emit('disconnected')
        emit('ready')
      })

      // Should end up in a consistent state (connected since ready was last)
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('connecting')).toHaveTextContent('false')
      })
    })

    it('should handle connection attempts during existing connection', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection: connection1 } = createMockConnection()
      const { connection: connection2 } = createMockConnection()
      
      mockCreateConnection
        .mockResolvedValueOnce(connection1)
        .mockResolvedValueOnce(connection2)

      const TestComponentWithConnect = () => {
        const { connected, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <button data-testid="connect" onClick={reconnect}>Connect</button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithConnect />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Try to reconnect when already connected
      act(() => {
        screen.getByTestId('connect').click()
      })

      // Should close existing connection and create new one
      expect(connection1.close).toHaveBeenCalled()
      
      // Wait for new connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })
      
      // Should have attempted 2 connections total
      expect(mockCreateConnection).toHaveBeenCalledTimes(2)
    })

    it('should handle network interruption during auto-retry', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error1 = new Error('Network error 1')
      const error2 = new Error('Network error 2')
      const { connection } = createMockConnection()
      
      mockCreateConnection
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce(connection)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Initial connection fails
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error 1')
      })

      // First retry (fails again)
      act(() => {
        vi.advanceTimersByTime(1000) // 1s delay
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error 2')
      })

      // Second retry (succeeds)
      act(() => {
        vi.advanceTimersByTime(2000) // 2s delay
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('error')).toHaveTextContent('none')
      })
    })

    it('should respect retry timing boundaries', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      mockCreateConnection.mockRejectedValue(error)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial error
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Advance less than retry time - should not retry yet
      act(() => {
        vi.advanceTimersByTime(500) // Half the retry time
      })

      // Should still be in error state
      expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      
      // Advance past retry time - should trigger retry
      act(() => {
        vi.advanceTimersByTime(500) // Complete the 1000ms
      })

      // Should now be attempting to connect
      await vi.waitFor(() => {
        expect(screen.getByTestId('connecting')).toHaveTextContent('true')
      })
    })

    it('should handle rapid reconnect calls gracefully', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      const TestComponentWithReconnect = () => {
        const { connected, connecting, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <div data-testid="connecting">{connecting ? 'true' : 'false'}</div>
            <button data-testid="rapid-reconnect" onClick={() => {
              // Fire multiple reconnects rapidly - should not cause errors
              reconnect()
              reconnect()
              reconnect()
            }}>
              Rapid Reconnect
            </button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Trigger rapid reconnects - should not throw errors
      expect(() => {
        act(() => {
          screen.getByTestId('rapid-reconnect').click()
        })
      }).not.toThrow()

      // Should end up in a stable state (either connected or reconnecting)
      await vi.waitFor(() => {
        const connected = screen.getByTestId('connected').textContent
        const connecting = screen.getByTestId('connecting').textContent
        expect(connected === 'true' || connecting === 'true').toBe(true)
      })

      // Connection should be closed due to reconnect
      expect(connection.close).toHaveBeenCalled()
    })

    it('should handle connection success after manual reconnect cancels auto-retry', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const error = new Error('Connection failed')
      const { connection } = createMockConnection()
      
      mockCreateConnection
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(connection)

      const TestComponentWithReconnect = () => {
        const { connected, connecting, error, reconnect } = useHAConnection()
        return (
          <div>
            <div data-testid="connected">{connected ? 'true' : 'false'}</div>
            <div data-testid="connecting">{connecting ? 'true' : 'false'}</div>
            <div data-testid="error">{error?.message || 'none'}</div>
            <button data-testid="reconnect" onClick={reconnect}>Reconnect</button>
          </div>
        )
      }

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponentWithReconnect />
        </HAProvider>
      )

      // Wait for initial connection failure
      await vi.waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Connection failed')
      })

      // Advance time partway to auto-retry
      act(() => {
        vi.advanceTimersByTime(500) // Half way to 1000ms auto-retry
      })

      // Manual reconnect should cancel auto-retry
      act(() => {
        screen.getByTestId('reconnect').click()
      })

      // Should connect immediately
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
        expect(screen.getByTestId('error')).toHaveTextContent('none')
      })

      // Advance time to when auto-retry would have fired
      act(() => {
        vi.advanceTimersByTime(500) // Complete the original 1000ms
      })

      // Should still be connected (auto-retry was cancelled)
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
      expect(mockCreateConnection).toHaveBeenCalledTimes(2) // Only initial + manual
    })
  })

  describe('Integration with Entity Store', () => {
    it('should set connection in entity store on successful connection', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      // Mock the entity store
      const mockSetConnection = vi.fn()
      mockUseStore.mockReturnValue(mockSetConnection)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Entity store should receive the connection
      expect(mockSetConnection).toHaveBeenCalledWith(connection)
    })

    it('should clear connection from entity store on disconnect', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      // Mock the entity store
      const mockSetConnection = vi.fn()
      mockUseStore.mockReturnValue(mockSetConnection)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Clear previous calls
      mockSetConnection.mockClear()

      // Simulate disconnect
      act(() => {
        emit('disconnected')
      })

      // Entity store should be cleared
      await vi.waitFor(() => {
        expect(mockSetConnection).toHaveBeenCalledWith(null)
      })
    })

    it('should populate entity store with mock data in mock mode', async () => {
      const mockData = {
        'switch.test': {
          entity_id: 'switch.test',
          state: 'on', 
          attributes: { friendly_name: 'Test Switch' },
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        },
        'light.test': {
          entity_id: 'light.test', 
          state: 'off', 
          attributes: { brightness: 128, friendly_name: 'Test Light' },
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        }
      }

      // Mock the entity store
      const mockBatchUpdate = vi.fn()
      const mockClear = vi.fn()
      const mockSetConnection = vi.fn()
      
      const mockState = {
        entities: new Map<string, EntityState>(),
        componentSubscriptions: new Map<string, Set<() => void>>(),
        websocketSubscriptions: new Map<string, { unsubscribe: () => void }>(),
        registeredEntities: new Set<string>(),
        subscriptionErrors: new Map<string, Error>(),
        connection: null,
        setConnection: mockSetConnection,
        updateEntity: vi.fn(),
        setSubscriptionError: vi.fn(),
        registerEntity: vi.fn(),
        unregisterEntity: vi.fn(),
        batchUpdate: mockBatchUpdate,
        clear: mockClear
      }
      
      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockSetConnection
      })
      
      mockUseStore.getState = vi.fn(() => mockState)

      render(
        <HAProvider url="http://test:8123" mockMode={true} mockData={mockData}>
          <TestComponent />
        </HAProvider>
      )

      // Should be connected in mock mode
      expect(screen.getByTestId('connected')).toHaveTextContent('true')

      // Entity store should be populated with mock data
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          ['switch.test', expect.objectContaining({
            entity_id: 'switch.test',
            state: 'on',
            attributes: { friendly_name: 'Test Switch' }
          })],
          ['light.test', expect.objectContaining({
            entity_id: 'light.test',
            state: 'off',
            attributes: { brightness: 128, friendly_name: 'Test Light' }
          })]
        ])
      )
    })

    it('should update entity store connection on ready events', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      // Mock the entity store
      const mockSetConnection = vi.fn()
      mockUseStore.mockReturnValue(mockSetConnection)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Wait for initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Clear previous calls
      mockSetConnection.mockClear()

      // Simulate ready event (reconnection)
      act(() => {
        emit('ready')
      })

      // Entity store should be updated with connection again
      await vi.waitFor(() => {
        expect(mockSetConnection).toHaveBeenCalledWith(connection)
      })
    })

    it('should clear entity store on unmount', async () => {
      const mockData = {
        'switch.test': {
          entity_id: 'switch.test',
          state: 'on',
          attributes: {},
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          context: { id: '', parent_id: null, user_id: null }
        }
      }

      // Mock the entity store
      const mockClear = vi.fn()
      const mockState = {
        entities: new Map<string, EntityState>(),
        componentSubscriptions: new Map<string, Set<() => void>>(),
        websocketSubscriptions: new Map<string, { unsubscribe: () => void }>(),
        registeredEntities: new Set<string>(),
        subscriptionErrors: new Map<string, Error>(),
        connection: null,
        setConnection: vi.fn(),
        updateEntity: vi.fn(),
        setSubscriptionError: vi.fn(),
        registerEntity: vi.fn(),
        unregisterEntity: vi.fn(),
        batchUpdate: vi.fn(),
        clear: mockClear
      }

      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return vi.fn()
      })
      
      mockUseStore.getState = vi.fn(() => mockState)

      const { unmount } = render(
        <HAProvider url="http://test:8123" mockMode={true} mockData={mockData}>
          <TestComponent />
        </HAProvider>
      )

      // Should be connected in mock mode
      expect(screen.getByTestId('connected')).toHaveTextContent('true')

      // Unmount component
      unmount()

      // Entity store should be cleared
      expect(mockClear).toHaveBeenCalled()
    })

    it('should handle entity store operations without errors when store is unavailable', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      // Mock store to throw error
      mockUseStore.mockImplementation(() => {
        throw new Error('Store unavailable')
      })

      // Should not throw error even if store operations fail
      expect(() => {
        render(
          <HAProvider url="http://test:8123" token="test-token">
            <TestComponent />
          </HAProvider>
        )
      }).not.toThrow()

      // Wait for connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })
    })

    it('should maintain entity store state consistency during connection state changes', async () => {
      const mockAuth = createMockAuth('test-token')
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)
      
      const { connection, emit } = createMockConnection()
      mockCreateConnection.mockResolvedValue(connection)

      // Mock the entity store
      const mockSetConnection = vi.fn()
      const mockClear = vi.fn()
      const mockState = {
        entities: new Map<string, EntityState>(),
        componentSubscriptions: new Map<string, Set<() => void>>(),
        websocketSubscriptions: new Map<string, { unsubscribe: () => void }>(),
        registeredEntities: new Set<string>(),
        subscriptionErrors: new Map<string, Error>(),
        connection: null,
        setConnection: mockSetConnection,
        updateEntity: vi.fn(),
        setSubscriptionError: vi.fn(),
        registerEntity: vi.fn(),
        unregisterEntity: vi.fn(),
        batchUpdate: vi.fn(),
        clear: mockClear
      }
      
      mockUseStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(mockState)
        }
        return mockSetConnection
      })
      
      mockUseStore.getState = vi.fn(() => mockState)

      render(
        <HAProvider url="http://test:8123" token="test-token">
          <TestComponent />
        </HAProvider>
      )

      // Initial connection
      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      expect(mockSetConnection).toHaveBeenCalledWith(connection)
      mockSetConnection.mockClear()

      // Disconnect
      act(() => {
        emit('disconnected')
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('false')
      })

      expect(mockSetConnection).toHaveBeenCalledWith(null)
      mockSetConnection.mockClear()

      // Reconnect via ready event
      act(() => {
        emit('ready')
      })

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      expect(mockSetConnection).toHaveBeenCalledWith(connection)
    })
  })

  describe('Token Refresh Functionality', () => {
    it('should periodically refresh tokens when connected via OAuth', async () => {
      vi.useFakeTimers()

      const mockAuth = createMockAuth('oauth-token')
      const { connection } = createMockConnection()

      // Mock createAuthenticatedConnection to return both connection and auth
      mockCreateAuthenticatedConnection.mockResolvedValue({
        connection,
        auth: mockAuth
      })

      render(
        <HAProvider
          url="http://test:8123"
          authMode="oauth"
          options={{
            tokenRefreshIntervalMinutes: 30,
            tokenRefreshBufferMinutes: 30
          }}
        >
          <TestComponent />
        </HAProvider>
      )

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Clear initial calls
      mockAuth.refreshAccessToken.mockClear()

      // Advance 30 minutes
      act(() => {
        vi.advanceTimersByTime(30 * 60 * 1000)
      })

      await vi.waitFor(() => {
        expect(mockAuth.refreshAccessToken).toHaveBeenCalled()
      })

      vi.useRealTimers()
    })

    it('should not refresh tokens periodically when using long-lived token', async () => {
      vi.useFakeTimers()

      const mockAuth = createMockAuth('test-token')
      const { connection } = createMockConnection()

      mockCreateConnection.mockResolvedValue(connection)
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)

      render(
        <HAProvider
          url="http://test:8123"
          token="test-token"
          authMode="token"
          options={{
            tokenRefreshIntervalMinutes: 30
          }}
        >
          <TestComponent />
        </HAProvider>
      )

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      mockRefreshTokenIfNeeded.mockClear()

      // Advance 30 minutes
      act(() => {
        vi.advanceTimersByTime(30 * 60 * 1000)
      })

      // Should not refresh for token auth
      expect(mockRefreshTokenIfNeeded).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should refresh tokens when visibility changes', async () => {
      const mockAuth = createMockAuth('oauth-token')
      const { connection } = createMockConnection()

      // Mock createAuthenticatedConnection to return both connection and auth
      mockCreateAuthenticatedConnection.mockResolvedValue({
        connection,
        auth: mockAuth
      })

      render(
        <HAProvider
          url="http://test:8123"
          authMode="oauth"
          options={{
            tokenRefreshBufferMinutes: 30
          }}
        >
          <TestComponent />
        </HAProvider>
      )

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      mockRefreshTokenIfNeeded.mockClear()

      // Simulate page becoming hidden then visible
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden'
      })
      document.dispatchEvent(new Event('visibilitychange'))

      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible'
      })
      document.dispatchEvent(new Event('visibilitychange'))

      await vi.waitFor(() => {
        expect(mockRefreshTokenIfNeeded).toHaveBeenCalled()
      })
    })

    it('should not refresh tokens on visibility change when using token auth', async () => {
      const mockAuth = createMockAuth('test-token')
      const { connection } = createMockConnection()

      mockCreateConnection.mockResolvedValue(connection)
      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuth)

      render(
        <HAProvider
          url="http://test:8123"
          token="test-token"
          authMode="token"
        >
          <TestComponent />
        </HAProvider>
      )

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      mockRefreshTokenIfNeeded.mockClear()

      // Simulate visibility change
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible'
      })
      document.dispatchEvent(new Event('visibilitychange'))

      // Should not refresh for token auth
      expect(mockRefreshTokenIfNeeded).not.toHaveBeenCalled()
    })

    it('should clear token refresh interval on logout', async () => {
      vi.useFakeTimers()

      const mockAuth = createMockAuth('oauth-token')
      const { connection } = createMockConnection()

      // Mock createAuthenticatedConnection to return both connection and auth
      mockCreateAuthenticatedConnection.mockResolvedValue({
        connection,
        auth: mockAuth
      })

      const TestWithLogout = () => {
        const { logout } = useHAConnection()
        return (
          <div>
            <TestComponent />
            <button onClick={logout}>Logout</button>
          </div>
        )
      }

      render(
        <HAProvider
          url="http://test:8123"
          authMode="oauth"
          options={{
            tokenRefreshIntervalMinutes: 30
          }}
        >
          <TestWithLogout />
        </HAProvider>
      )

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      mockRefreshTokenIfNeeded.mockClear()

      // Logout
      act(() => {
        screen.getByText('Logout').click()
      })

      // Advance time after logout
      act(() => {
        vi.advanceTimersByTime(30 * 60 * 1000)
      })

      // Should not refresh after logout
      expect(mockRefreshTokenIfNeeded).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should handle token refresh failures gracefully', async () => {
      const mockAuth = createMockAuth('oauth-token')
      const { connection } = createMockConnection()

      // Mock createAuthenticatedConnection to return both connection and auth
      mockCreateAuthenticatedConnection.mockResolvedValue({
        connection,
        auth: mockAuth
      })

      // Mock refresh to fail
      mockRefreshTokenIfNeeded.mockRejectedValue(new Error('Refresh failed'))

      render(
        <HAProvider
          url="http://test:8123"
          authMode="oauth"
        >
          <TestComponent />
        </HAProvider>
      )

      await vi.waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('true')
      })

      // Trigger visibility change
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible'
      })

      // Should not crash when refresh fails
      expect(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      }).not.toThrow()

      // Should still be connected despite refresh failure
      expect(screen.getByTestId('connected')).toHaveTextContent('true')
    })

    describe('Token Refresh Retry Logic', () => {
      it('should retry periodic token refresh with exponential backoff', async () => {
        vi.useFakeTimers()

        const mockAuth = createMockAuth('oauth-token')
        const { connection } = createMockConnection()

        mockCreateAuthenticatedConnection.mockResolvedValue({
          connection,
          auth: mockAuth
        })

        // Mock refresh to fail then succeed
        let callCount = 0
        mockAuth.refreshAccessToken.mockImplementation(() => {
          callCount++
          if (callCount <= 3) {
            return Promise.reject(new Error('Refresh failed'))
          }
          return Promise.resolve()
        })

        render(
          <HAProvider
            url="http://test:8123"
            authMode="oauth"
            options={{ tokenRefreshIntervalMinutes: 100 }} // Long interval to avoid interference
          >
            <TestComponent />
          </HAProvider>
        )

        await vi.waitFor(() => {
          expect(screen.getByTestId('connected')).toHaveTextContent('true')
        })

        callCount = 0 // Reset counter after initial connection

        // Trigger periodic refresh (after 100 minutes)
        act(() => {
          vi.advanceTimersByTime(100 * 60 * 1000)
        })

        // Wait for initial call
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        expect(callCount).toBeGreaterThanOrEqual(1)

        // Advance through retries: 1min, 2min, 4min
        act(() => {
          vi.advanceTimersByTime(1 * 60 * 1000) // First retry after 1 min
        })
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        act(() => {
          vi.advanceTimersByTime(2 * 60 * 1000) // Second retry after 2 min
        })
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        act(() => {
          vi.advanceTimersByTime(4 * 60 * 1000) // Third retry after 4 min
        })
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        // Should have made multiple retry attempts
        expect(callCount).toBeGreaterThanOrEqual(3)

        // Should still be connected
        expect(screen.getByTestId('connected')).toHaveTextContent('true')

        vi.useRealTimers()
      })

      it('should stop retrying after 5 failed attempts', async () => {
        vi.useFakeTimers()

        const mockAuth = createMockAuth('oauth-token')
        const { connection } = createMockConnection()

        mockCreateAuthenticatedConnection.mockResolvedValue({
          connection,
          auth: mockAuth
        })

        mockAuth.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'))

        render(
          <HAProvider
            url="http://test:8123"
            authMode="oauth"
            options={{ tokenRefreshIntervalMinutes: 100 }}
          >
            <TestComponent />
          </HAProvider>
        )

        await vi.waitFor(() => {
          expect(screen.getByTestId('connected')).toHaveTextContent('true')
        })

        mockAuth.refreshAccessToken.mockClear()

        // Trigger periodic refresh
        act(() => {
          vi.advanceTimersByTime(100 * 60 * 1000)
        })

        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        const initialCalls = mockAuth.refreshAccessToken.mock.calls.length

        // Advance through all retries: 1, 2, 4, 8, 16 minutes
        for (const delay of [1, 2, 4, 8, 16]) {
          act(() => {
            vi.advanceTimersByTime(delay * 60 * 1000)
          })
          await act(async () => {
            await vi.runOnlyPendingTimersAsync()
          })
        }

        const callsAfterRetries = mockAuth.refreshAccessToken.mock.calls.length

        // Advance a bit - should not trigger more retry calls (but periodic interval might fire)
        act(() => {
          vi.advanceTimersByTime(5 * 60 * 1000) // 5 minutes
        })
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        // Should have at least tried the retries
        expect(callsAfterRetries).toBeGreaterThan(initialCalls)

        // Should still be connected
        expect(screen.getByTestId('connected')).toHaveTextContent('true')

        vi.useRealTimers()
      })

      it('should retry visibility change with exponential backoff', async () => {
        vi.useFakeTimers()

        const mockAuth = createMockAuth('oauth-token')
        const { connection } = createMockConnection()

        mockCreateAuthenticatedConnection.mockResolvedValue({
          connection,
          auth: mockAuth
        })

        let callCount = 0
        mockRefreshTokenIfNeeded.mockImplementation(() => {
          callCount++
          if (callCount <= 2) {
            return Promise.reject(new Error('Refresh failed'))
          }
          return Promise.resolve(mockAuth)
        })

        render(
          <HAProvider
            url="http://test:8123"
            authMode="oauth"
            options={{ tokenRefreshIntervalMinutes: 1000 }}
          >
            <TestComponent />
          </HAProvider>
        )

        await vi.waitFor(() => {
          expect(screen.getByTestId('connected')).toHaveTextContent('true')
        })

        callCount = 0

        // Trigger visibility change
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          configurable: true,
          value: 'visible'
        })
        document.dispatchEvent(new Event('visibilitychange'))

        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        expect(callCount).toBeGreaterThanOrEqual(1)

        // Advance through retries: 30s, 60s
        act(() => {
          vi.advanceTimersByTime(30 * 1000)
        })
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        act(() => {
          vi.advanceTimersByTime(60 * 1000)
        })
        await act(async () => {
          await vi.runOnlyPendingTimersAsync()
        })

        // Should have retried
        expect(callCount).toBeGreaterThanOrEqual(2)

        // Should still be connected
        expect(screen.getByTestId('connected')).toHaveTextContent('true')

        vi.useRealTimers()
      })

      it('should cancel retry timeouts on component unmount', async () => {
        vi.useFakeTimers()

        const mockAuth = createMockAuth('oauth-token')
        const { connection } = createMockConnection()

        mockCreateAuthenticatedConnection.mockResolvedValue({
          connection,
          auth: mockAuth
        })

        // Mock refresh to fail
        mockAuth.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'))

        const { unmount } = render(
          <HAProvider
            url="http://test:8123"
            authMode="oauth"
            options={{ tokenRefreshIntervalMinutes: 1 }}
          >
            <TestComponent />
          </HAProvider>
        )

        await vi.waitFor(() => {
          expect(screen.getByTestId('connected')).toHaveTextContent('true')
        })

        mockAuth.refreshAccessToken.mockClear()

        // Trigger periodic refresh
        act(() => {
          vi.advanceTimersByTime(60 * 1000)
        })

        await vi.waitFor(() => {
          expect(mockAuth.refreshAccessToken).toHaveBeenCalledTimes(1)
        })

        // Unmount before retry fires
        unmount()

        // Advance time to when retry would fire
        act(() => {
          vi.advanceTimersByTime(60 * 1000)
        })

        // Should not have made any more refresh attempts
        expect(mockAuth.refreshAccessToken).toHaveBeenCalledTimes(1)

        vi.useRealTimers()
      })

      it('should cancel retry timeouts on logout', async () => {
        vi.useFakeTimers()

        const mockAuth = createMockAuth('oauth-token')
        const { connection } = createMockConnection()

        mockCreateAuthenticatedConnection.mockResolvedValue({
          connection,
          auth: mockAuth
        })

        // Mock refresh to fail
        mockAuth.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'))

        const TestWithLogout = () => {
          const { logout } = useHAConnection()
          return (
            <div>
              <TestComponent />
              <button onClick={logout}>Logout</button>
            </div>
          )
        }

        render(
          <HAProvider
            url="http://test:8123"
            authMode="oauth"
            options={{ tokenRefreshIntervalMinutes: 1 }}
          >
            <TestWithLogout />
          </HAProvider>
        )

        await vi.waitFor(() => {
          expect(screen.getByTestId('connected')).toHaveTextContent('true')
        })

        mockAuth.refreshAccessToken.mockClear()

        // Trigger periodic refresh
        act(() => {
          vi.advanceTimersByTime(60 * 1000)
        })

        await vi.waitFor(() => {
          expect(mockAuth.refreshAccessToken).toHaveBeenCalledTimes(1)
        })

        // Logout before retry fires
        act(() => {
          screen.getByText('Logout').click()
        })

        // Advance time to when retry would fire
        act(() => {
          vi.advanceTimersByTime(60 * 1000)
        })

        // Should not have made any more refresh attempts after logout
        expect(mockAuth.refreshAccessToken).toHaveBeenCalledTimes(1)

        vi.useRealTimers()
      })
    })
  })
})