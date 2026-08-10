import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { useEntity } from '../useEntity'
import { useStore } from '../../services/entityStore'
import type { EntityState } from '../../types'
import type { Connection } from 'home-assistant-js-websocket'

// Mock the HAProvider and entityStore
const mockEntities = new Map()
const mockSubscriptionErrors = new Map()
const mockRegisterEntity = vi.fn()
const mockUnregisterEntity = vi.fn()
const mockUpdateEntity = vi.fn()
const mockSetConnection = vi.fn()
const mockClear = vi.fn()

vi.mock('../../services/entityStore', () => {
  return {
    useStore: vi.fn((selector) => {
      if (typeof selector === 'function') {
        const mockState = {
          entities: mockEntities,
          subscriptionErrors: mockSubscriptionErrors,
          registerEntity: mockRegisterEntity,
          unregisterEntity: mockUnregisterEntity,
          updateEntity: mockUpdateEntity,
          setConnection: mockSetConnection,
          clear: mockClear
        }
        return selector(mockState)
      }
      return undefined
    })
  }
})

// Helper to create mock entity state
function createMockEntity(entityId: string, state: string = 'on', attributes: Record<string, any> = {}): EntityState {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'test-context', parent_id: null, user_id: null }
  }
}

// Helper to create mock connection
function createMockConnection(): Connection {
  return {
    sendMessagePromise: vi.fn(),
    subscribeEvents: vi.fn(),
    addEventListener: vi.fn(),
    close: vi.fn(),
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
    sendMessage: vi.fn()
  } as unknown as Connection
}

// Mock HAProvider
const mockUseHAConnection = vi.fn()
vi.mock('../../providers/HAProvider', () => ({
  default: ({ children }: { children: ReactNode }) => children,
  useHAConnection: () => mockUseHAConnection()
}))

// Test wrapper component that provides HAProvider context
function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

describe('useEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEntities.clear()
    mockSubscriptionErrors.clear()

    // Reset all mock functions
    mockRegisterEntity.mockClear()
    mockUnregisterEntity.mockClear()
    mockUpdateEntity.mockClear()
    mockSetConnection.mockClear()
    mockClear.mockClear()
    
    // Set up getState mock for refresh functionality
    const mockUseStore = useStore as any
    mockUseStore.getState = vi.fn().mockReturnValue({
      entities: mockEntities,
      registerEntity: mockRegisterEntity,
      unregisterEntity: mockUnregisterEntity,
      updateEntity: mockUpdateEntity,
      setConnection: mockSetConnection,
      clear: mockClear
    })
    
    // Default HAProvider mock
    mockUseHAConnection.mockReturnValue({
      connection: createMockConnection(),
      connected: true,
      connecting: false,
      error: null,
      reconnect: vi.fn(),
      config: {}
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockEntities.clear()
  })

  describe('Entity Registration', () => {
    it('should register entity on mount', () => {
      const entityId = 'light.living_room'

      renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(mockRegisterEntity).toHaveBeenCalledWith(
        entityId,
        expect.any(Function)
      )
    })

    it('should unregister entity on unmount', () => {
      const entityId = 'light.living_room'

      const { unmount } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      // Get the callback that was registered
      const registeredCallback = mockRegisterEntity.mock.calls[0][1]

      unmount()

      expect(mockUnregisterEntity).toHaveBeenCalledWith(
        entityId,
        registeredCallback
      )
    })

    it('should re-register when entityId changes', () => {
      const { rerender } = renderHook(
        ({ id }) => useEntity(id), 
        { 
          wrapper: TestWrapper,
          initialProps: { id: 'light.living_room' }
        }
      )

      expect(mockRegisterEntity).toHaveBeenCalledWith('light.living_room', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledTimes(1)

      // Change entityId
      rerender({ id: 'light.bedroom' })

      // Should unregister old and register new
      expect(mockUnregisterEntity).toHaveBeenCalledWith('light.living_room', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledWith('light.bedroom', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledTimes(2)
    })
  })

  describe('State Updates and Re-rendering', () => {
    it('should return entity state when entity exists', () => {
      const entityId = 'light.living_room'
      const entity = createMockEntity(entityId, 'on', { brightness: 255 })
      
      // Mock the store to return our entity
      mockEntities.set(entityId, entity)

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.entityId).toBe(entityId)
      expect(result.current.state).toBe('on')
      expect(result.current.attributes).toEqual({ brightness: 255 })
      expect(result.current.lastChanged).toBeInstanceOf(Date)
      expect(result.current.lastUpdated).toBeInstanceOf(Date)
      expect(result.current.isUnavailable).toBe(false)
    })

    it('should preserve timestamp Date references when wire values are unchanged', () => {
      const entityId = 'light.living_room'
      const entity = createMockEntity(entityId)
      mockEntities.set(entityId, entity)

      const { result, rerender } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })
      const lastChanged = result.current.lastChanged
      const lastUpdated = result.current.lastUpdated

      rerender()

      expect(result.current.lastChanged).toBe(lastChanged)
      expect(result.current.lastUpdated).toBe(lastUpdated)
    })

    it('should return default values when entity does not exist', () => {
      const entityId = 'light.nonexistent'

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.entityId).toBe(entityId)
      expect(result.current.state).toBe('unknown')
      expect(result.current.attributes).toEqual({})
      expect(result.current.lastChanged).toBeInstanceOf(Date)
      expect(result.current.lastUpdated).toBeInstanceOf(Date)
      expect(result.current.isUnavailable).toBe(false) // unknown !== 'unavailable'
    })

    it('should preserve missing-entity timestamp references across renders', () => {
      const { result, rerender } = renderHook(
        () => useEntity('light.still_missing'),
        { wrapper: TestWrapper }
      )
      const lastChanged = result.current.lastChanged
      const lastUpdated = result.current.lastUpdated

      rerender()

      expect(result.current.lastChanged).toBe(lastChanged)
      expect(result.current.lastUpdated).toBe(lastUpdated)
    })

    it('should detect unavailable state correctly', () => {
      const entityId = 'light.living_room'
      const entity = createMockEntity(entityId, 'unavailable')
      
      mockEntities.set(entityId, entity)

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.isUnavailable).toBe(true)
    })

    it('should handle custom attribute types', () => {
      const entityId = 'climate.living_room'
      const entity = createMockEntity(entityId, 'heat', { 
        temperature: 72.5,
        target_temp_high: 75,
        target_temp_low: 68,
        hvac_modes: ['heat', 'cool', 'auto']
      })
      
      mockEntities.set(entityId, entity)

      const { result } = renderHook(() => useEntity<any>(entityId), { wrapper: TestWrapper })

      expect(result.current.attributes.temperature).toBe(72.5)
      expect(result.current.attributes.hvac_modes).toEqual(['heat', 'cool', 'auto'])
    })

    it('should update when entity state changes via store', () => {
      const entityId = 'light.living_room'
      const initialEntity = createMockEntity(entityId, 'off')
      const updatedEntity = createMockEntity(entityId, 'on')
      
      mockEntities.set(entityId, initialEntity)

      const { result, rerender } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.state).toBe('off')

      // Simulate entity update in store
      act(() => {
        mockEntities.set(entityId, updatedEntity)
        // Force a rerender to pick up the new entity state
        rerender()
      })

      expect(result.current.state).toBe('on')
    })
  })

  describe('Service Calling Functionality', () => {
    it('should call service with correct parameters', async () => {
      const entityId = 'light.living_room'
      const mockConnection = createMockConnection()
      
      // Override the mock for this test
      mockUseHAConnection.mockReturnValue({
        connection: mockConnection,
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      await act(async () => {
        await result.current.callService('light', 'turn_on', { brightness: 255 })
      })

      expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
        type: 'call_service',
        domain: 'light',
        service: 'turn_on',
        service_data: {
          entity_id: entityId,
          brightness: 255,
        },
      })
    })

    it('should call service without additional data', async () => {
      const entityId = 'switch.bedroom'
      const mockConnection = createMockConnection()
      
      mockUseHAConnection.mockReturnValue({
        connection: mockConnection,
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      await act(async () => {
        await result.current.callService('switch', 'toggle')
      })

      expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
        type: 'call_service',
        domain: 'switch',
        service: 'toggle',
        service_data: {
          entity_id: entityId,
        },
      })
    })

    it('should throw error when not connected', async () => {
      const entityId = 'light.living_room'
      
      mockUseHAConnection.mockReturnValue({
        connection: null,
        connected: false,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      await expect(
        result.current.callService('light', 'turn_on')
      ).rejects.toThrow('Not connected to Home Assistant')
    })
  })

  describe('Error Handling for Missing Entities', () => {
    it('should set error state for missing entities when connected', async () => {
      const entityId = 'light.nonexistent'
      
      mockUseHAConnection.mockReturnValue({
        connection: createMockConnection(),
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      // Wait for the error timeout (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2100))

      expect(result.current.error).toBeDefined()
      expect(result.current.error?.message).toContain('Entity "light.nonexistent" is not available')
    })

    it('should not log warning when entity becomes available', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const entityId = 'light.living_room'
      const entity = createMockEntity(entityId, 'on')
      
      mockUseHAConnection.mockReturnValue({
        connection: createMockConnection(),
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      // Add entity before timeout
      act(() => {
        mockEntities.set(entityId, entity)
      })

      // Wait for the warning timeout
      await new Promise(resolve => setTimeout(resolve, 2100))

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should not log warning when not connected', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const entityId = 'light.nonexistent'
      
      mockUseHAConnection.mockReturnValue({
        connection: null,
        connected: false,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      // Wait for the warning timeout
      await new Promise(resolve => setTimeout(resolve, 2100))

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Subscription Error Handling', () => {
    it('should expose subscription errors from store', () => {
      const entityId = 'light.living_room'
      const subscriptionError = new Error('WebSocket subscription failed')

      // Set up subscription error in mock store
      mockSubscriptionErrors.set(entityId, subscriptionError)

      const { result } = renderHook(() => useEntity(entityId), {
        wrapper: TestWrapper
      })

      expect(result.current.error).toBe(subscriptionError)
    })

    it('should prioritize subscription errors over availability errors', async () => {
      const entityId = 'light.living_room'
      const subscriptionError = new Error('WebSocket subscription failed')

      // Set up subscription error
      mockSubscriptionErrors.set(entityId, subscriptionError)

      // Set up unavailable entity
      const unavailableEntity = createMockEntity(entityId, 'unavailable')
      mockEntities.set(entityId, unavailableEntity)

      const { result } = renderHook(() => useEntity(entityId), {
        wrapper: TestWrapper
      })

      // Subscription error should take priority
      expect(result.current.error).toBe(subscriptionError)
    })

    it('should clear error when subscription error is removed', () => {
      const entityId = 'light.living_room'
      const subscriptionError = new Error('WebSocket subscription failed')

      // Start with subscription error
      mockSubscriptionErrors.set(entityId, subscriptionError)

      const { result, rerender } = renderHook(() => useEntity(entityId), {
        wrapper: TestWrapper
      })

      expect(result.current.error).toBe(subscriptionError)

      // Clear subscription error and add available entity
      mockSubscriptionErrors.delete(entityId)
      const availableEntity = createMockEntity(entityId, 'on')
      mockEntities.set(entityId, availableEntity)

      rerender()

      expect(result.current.error).toBeUndefined()
    })
  })

  describe('Refresh Functionality', () => {
    it('should fetch fresh entity state on refresh', async () => {
      const entityId = 'light.living_room'
      const freshEntity = createMockEntity(entityId, 'off', { brightness: 128 })
      const mockConnection = createMockConnection()
      
      mockConnection.sendMessagePromise = vi.fn().mockResolvedValue([freshEntity])
      
      mockUseHAConnection.mockReturnValue({
        connection: mockConnection,
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
        type: 'get_states'
      })
      expect(mockUpdateEntity).toHaveBeenCalledWith(entityId, freshEntity)
    })

    it('should handle refresh when not connected', async () => {
      const entityId = 'light.living_room'
      
      mockUseHAConnection.mockReturnValue({
        connection: null,
        connected: false,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      // Should not throw error, just return early
      await act(async () => {
        await result.current.refresh()
      })

      expect(mockUpdateEntity).not.toHaveBeenCalled()
    })

    it('should handle refresh when entity not found in response', async () => {
      const entityId = 'light.nonexistent'
      const mockConnection = createMockConnection()
      
      mockConnection.sendMessagePromise = vi.fn().mockResolvedValue([])
      
      mockUseHAConnection.mockReturnValue({
        connection: mockConnection,
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
        type: 'get_states'
      })
      expect(mockUpdateEntity).not.toHaveBeenCalled()
    })
  })

  describe('Connection Dependency Behavior', () => {
    it('should return isConnected based on HAProvider state', () => {
      const entityId = 'light.living_room'
      
      mockUseHAConnection.mockReturnValue({
        connection: createMockConnection(),
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.isConnected).toBe(true)
    })

    it('should return false for isConnected when disconnected', () => {
      const entityId = 'light.living_room'
      
      mockUseHAConnection.mockReturnValue({
        connection: null,
        connected: false,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.isConnected).toBe(false)
    })

    it('should update when connection state changes', () => {
      const entityId = 'light.living_room'
      
      // Start disconnected
      mockUseHAConnection.mockReturnValue({
        connection: null,
        connected: false,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      const { result, rerender } = renderHook(() => useEntity(entityId), { wrapper: TestWrapper })

      expect(result.current.isConnected).toBe(false)

      // Connect
      mockUseHAConnection.mockReturnValue({
        connection: createMockConnection(),
        connected: true,
        connecting: false,
        error: null,
        reconnect: vi.fn(),
        config: {}
      })

      rerender()

      expect(result.current.isConnected).toBe(true)
    })
  })
})