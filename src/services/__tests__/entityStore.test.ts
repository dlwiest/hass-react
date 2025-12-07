import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useStore, selectEntity } from '../entityStore'
import type { EntityState } from '../../types'
import type { Connection } from 'home-assistant-js-websocket'

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

describe('EntityStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state before each test
    useStore.getState().clear()
  })

  afterEach(() => {
    // Clean up any remaining subscriptions
    useStore.getState().clear()
  })

  describe('Initial State', () => {
    it('should start with empty state', () => {
      const state = useStore.getState()
      
      expect(state.entities.size).toBe(0)
      expect(state.componentSubscriptions.size).toBe(0)
      expect(state.websocketSubscriptions.size).toBe(0)
      expect(state.registeredEntities.size).toBe(0)
      expect(state.connection).toBeNull()
    })
  })

  describe('Entity Management', () => {
    it('should update single entity and notify subscribers', () => {
      const callback = vi.fn()
      const entity = createMockEntity('light.living_room', 'on')

      // Register a subscriber first
      useStore.getState().registerEntity('light.living_room', callback)
      
      // Update the entity
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity)
      })

      // Check entity was stored (get fresh state)
      const storedEntity = useStore.getState().entities.get('light.living_room')
      expect(storedEntity).toEqual(entity)

      // Check subscriber was notified
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should create new entity if it does not exist', () => {
      const entity = createMockEntity('switch.bedroom', 'off')

      act(() => {
        useStore.getState().updateEntity('switch.bedroom', entity)
      })

      const storedEntity = useStore.getState().entities.get('switch.bedroom')
      expect(storedEntity).toEqual(entity)
      expect(useStore.getState().entities.size).toBe(1)
    })

    it('should update multiple entities at once with batchUpdate', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')

      // Register subscribers
      useStore.getState().registerEntity('light.living_room', callback1)
      useStore.getState().registerEntity('switch.bedroom', callback2)

      // Batch update
      act(() => {
        useStore.getState().batchUpdate([
          ['light.living_room', entity1],
          ['switch.bedroom', entity2]
        ])
      })

      // Check entities were stored (get fresh state)
      const state = useStore.getState()
      expect(state.entities.get('light.living_room')).toEqual(entity1)
      expect(state.entities.get('switch.bedroom')).toEqual(entity2)

      // Check subscribers were notified
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should handle empty batch update gracefully', () => {
      expect(() => {
        act(() => {
          useStore.getState().batchUpdate([])
        })
      }).not.toThrow()

      expect(useStore.getState().entities.size).toBe(0)
    })

    it('should overwrite existing entities with batchUpdate', () => {
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('light.living_room', 'off', { brightness: 100 })

      // First update
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity1)
      })
      expect(useStore.getState().entities.get('light.living_room')?.state).toBe('on')

      // Batch update overwrites
      act(() => {
        useStore.getState().batchUpdate([['light.living_room', entity2]])
      })
      const storedEntity = useStore.getState().entities.get('light.living_room')
      expect(storedEntity?.state).toBe('off')
      expect(storedEntity?.attributes.brightness).toBe(100)
    })

    it('should only notify subscribers of updated entities in batchUpdate', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')

      // Register subscribers for 3 entities, but only update 2
      useStore.getState().registerEntity('light.living_room', callback1)
      useStore.getState().registerEntity('switch.bedroom', callback2)
      useStore.getState().registerEntity('sensor.temperature', callback3)

      // Batch update only 2 entities
      act(() => {
        useStore.getState().batchUpdate([
          ['light.living_room', entity1],
          ['switch.bedroom', entity2]
        ])
      })

      // Only callbacks for updated entities should be called
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).not.toHaveBeenCalled()
    })
  })

  describe('Component Subscription System', () => {
    it('should register component callback and call when entity updates', () => {
      const callback = vi.fn()
      const entity = createMockEntity('light.living_room', 'on')

      useStore.getState().registerEntity('light.living_room', callback)
      
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity)
      })

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should support multiple callbacks for same entity', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const entity = createMockEntity('light.living_room', 'on')

      useStore.getState().registerEntity('light.living_room', callback1)
      useStore.getState().registerEntity('light.living_room', callback2)
      
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity)
      })

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should unregister specific callback without affecting others', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const entity = createMockEntity('light.living_room', 'on')

      useStore.getState().registerEntity('light.living_room', callback1)
      useStore.getState().registerEntity('light.living_room', callback2)
      
      // Unregister first callback
      useStore.getState().unregisterEntity('light.living_room', callback1)
      
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity)
      })

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should clean up entity when last callback is unregistered', () => {
      const callback = vi.fn()
      
      useStore.getState().registerEntity('light.living_room', callback)
      expect(useStore.getState().registeredEntities.has('light.living_room')).toBe(true)
      expect(useStore.getState().componentSubscriptions.has('light.living_room')).toBe(true)
      
      useStore.getState().unregisterEntity('light.living_room', callback)
      expect(useStore.getState().registeredEntities.has('light.living_room')).toBe(false)
      expect(useStore.getState().componentSubscriptions.has('light.living_room')).toBe(false)
    })

    it('should not call callbacks for unregistered entities', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')

      useStore.getState().registerEntity('light.living_room', callback1)
      useStore.getState().registerEntity('switch.bedroom', callback2)
      
      // Update only living room
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity1)
      })

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).not.toHaveBeenCalled()
    })

    it('should handle unregistering non-existent callback gracefully', () => {
      const callback = vi.fn()
      
      expect(() => {
        useStore.getState().unregisterEntity('nonexistent.entity', callback)
      }).not.toThrow()
      
      expect(useStore.getState().componentSubscriptions.size).toBe(0)
    })
  })

  describe('Connection Management', () => {
    it('should set connection and clear when connection changes', async () => {
      const mockConn1 = createMockConnection()
      const mockConn2 = createMockConnection()

      await act(async () => {
        await useStore.getState().setConnection(mockConn1)
      })
      expect(useStore.getState().connection).toBe(mockConn1)

      await act(async () => {
        await useStore.getState().setConnection(mockConn2)
      })
      expect(useStore.getState().connection).toBe(mockConn2)
    })

    it('should clear connection when set to null', async () => {
      const mockConn = createMockConnection()

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })
      expect(useStore.getState().connection).toBe(mockConn)

      await act(async () => {
        await useStore.getState().setConnection(null)
      })
      expect(useStore.getState().connection).toBeNull()
    })

    it('should clean up websocket subscriptions when connection changes', async () => {
      const mockConn1 = createMockConnection()
      const mockConn2 = createMockConnection()
      const unsubscribeMock = vi.fn()

      // Manually add a websocket subscription
      act(() => {
        useStore.getState().setConnection(mockConn1)
      })
      
      const state = useStore.getState()
      state.websocketSubscriptions.set('light.test', { unsubscribe: unsubscribeMock })

      // Change connection should clean up old subscriptions
      await act(async () => {
        await useStore.getState().setConnection(mockConn2)
      })

      expect(unsubscribeMock).toHaveBeenCalled()
      expect(useStore.getState().websocketSubscriptions.size).toBe(0)
    })

    it('should fetch initial states when connection is established with registered entities', async () => {
      const mockConn = createMockConnection()
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')

      // Mock sendMessagePromise to return states
      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([entity1, entity2])
      mockConn.subscribeEvents = vi.fn().mockResolvedValue(() => {})

      // Register entities first
      useStore.getState().registerEntity('light.living_room', vi.fn())
      useStore.getState().registerEntity('switch.bedroom', vi.fn())

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      expect(mockConn.sendMessagePromise).toHaveBeenCalledWith({
        type: 'get_states'
      })
      
      const state = useStore.getState()
      expect(state.entities.get('light.living_room')).toEqual(entity1)
      expect(state.entities.get('switch.bedroom')).toEqual(entity2)
    })

    it('should not fetch states if no entities are registered', async () => {
      const mockConn = createMockConnection()
      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([])

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      expect(mockConn.sendMessagePromise).not.toHaveBeenCalled()
    })
  })

  describe('WebSocket Subscription Logic', () => {
    it('should subscribe to entity when registering with active connection', async () => {
      const mockConn = createMockConnection()
      const entity = createMockEntity('light.living_room', 'on')
      
      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([entity])
      mockConn.subscribeEvents = vi.fn().mockResolvedValue(() => {})

      // Set connection first
      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      // Register entity should trigger subscription
      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', vi.fn())
      })

      expect(mockConn.subscribeEvents).toHaveBeenCalledWith(
        expect.any(Function),
        'state_changed'
      )
      expect(useStore.getState().websocketSubscriptions.has('light.living_room')).toBe(true)
    })

    it('should unsubscribe from websocket when entity is fully unregistered', async () => {
      const mockConn = createMockConnection()
      const unsubscribeMock = vi.fn()
      const callback = vi.fn()
      
      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([])
      mockConn.subscribeEvents = vi.fn().mockResolvedValue(unsubscribeMock)

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', callback)
      })

      expect(useStore.getState().websocketSubscriptions.has('light.living_room')).toBe(true)

      // Unregister the callback (should clean up websocket sub)
      act(() => {
        useStore.getState().unregisterEntity('light.living_room', callback)
      })

      expect(unsubscribeMock).toHaveBeenCalled()
      expect(useStore.getState().websocketSubscriptions.has('light.living_room')).toBe(false)
    })

    it('should handle websocket state change events correctly', async () => {
      const mockConn = createMockConnection()
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('light.living_room', 'off')
      const callback = vi.fn()
      let stateChangeHandler: (event: any) => void

      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([entity1])
      mockConn.subscribeEvents = vi.fn().mockImplementation((handler) => {
        stateChangeHandler = handler
        return Promise.resolve(() => {})
      })

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', callback)
      })

      // Simulate state change event
      act(() => {
        stateChangeHandler({
          data: {
            entity_id: 'light.living_room',
            new_state: entity2
          }
        })
      })

      expect(useStore.getState().entities.get('light.living_room')).toEqual(entity2)
      expect(callback).toHaveBeenCalledTimes(2) // Once for initial registration, once for update
    })

    it('should ignore state change events for non-matching entities', async () => {
      const mockConn = createMockConnection()
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')
      const callback = vi.fn()
      let stateChangeHandler: (event: any) => void

      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([entity1])
      mockConn.subscribeEvents = vi.fn().mockImplementation((handler) => {
        stateChangeHandler = handler
        return Promise.resolve(() => {})
      })

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', callback)
      })

      // Simulate state change event for different entity
      act(() => {
        stateChangeHandler({
          data: {
            entity_id: 'switch.bedroom',
            new_state: entity2
          }
        })
      })

      // Should still have original entity, not updated
      expect(useStore.getState().entities.get('light.living_room')).toEqual(entity1)
      expect(useStore.getState().entities.has('switch.bedroom')).toBe(false)
      expect(callback).toHaveBeenCalledTimes(1) // Only once for initial registration
    })

    it('should clean up old subscription when reconnecting to same entity', async () => {
      const mockConn1 = createMockConnection()
      const mockConn2 = createMockConnection()
      const entity = createMockEntity('light.living_room', 'on')
      const unsubscribe1 = vi.fn()
      const unsubscribe2 = vi.fn()
      const callback = vi.fn()

      // Set up first connection with subscription
      mockConn1.sendMessagePromise = vi.fn().mockResolvedValue([entity])
      mockConn1.subscribeEvents = vi.fn().mockResolvedValue(unsubscribe1)

      await act(async () => {
        await useStore.getState().setConnection(mockConn1)
      })

      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', callback)
      })

      expect(useStore.getState().websocketSubscriptions.has('light.living_room')).toBe(true)
      expect(mockConn1.subscribeEvents).toHaveBeenCalledTimes(1)

      // Change connection - should clean up old subscriptions and create new ones
      mockConn2.sendMessagePromise = vi.fn().mockResolvedValue([entity])
      mockConn2.subscribeEvents = vi.fn().mockResolvedValue(unsubscribe2)

      await act(async () => {
        await useStore.getState().setConnection(mockConn2)
      })

      // Old subscription should have been unsubscribed
      expect(unsubscribe1).toHaveBeenCalled()

      // New subscription should be created for registered entity
      expect(mockConn2.subscribeEvents).toHaveBeenCalled()
      expect(useStore.getState().websocketSubscriptions.has('light.living_room')).toBe(true)

      // Should only have one subscription in the Map
      expect(useStore.getState().websocketSubscriptions.size).toBe(1)
    })

    it('should remove old subscription from Map after unsubscribing during reconnect', async () => {
      const mockConn = createMockConnection()
      const entity = createMockEntity('light.living_room', 'on')
      const callback = vi.fn()
      let subscriptionCount = 0

      // Mock subscribeEvents to track how many times it's called
      mockConn.sendMessagePromise = vi.fn().mockResolvedValue([entity])
      mockConn.subscribeEvents = vi.fn().mockImplementation(() => {
        subscriptionCount++
        return Promise.resolve(vi.fn())
      })

      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', callback)
      })

      // Should have 1 subscription in the Map
      expect(useStore.getState().websocketSubscriptions.size).toBe(1)
      expect(subscriptionCount).toBe(1)

      // Simulate reconnection by setting the same connection again
      // This triggers resubscription logic in setConnection
      await act(async () => {
        await useStore.getState().setConnection(null)
      })

      expect(useStore.getState().websocketSubscriptions.size).toBe(0)

      // Reconnect
      await act(async () => {
        await useStore.getState().setConnection(mockConn)
      })

      // After reconnection, should still have exactly 1 subscription
      expect(useStore.getState().websocketSubscriptions.size).toBe(1)
      expect(subscriptionCount).toBe(2) // One for initial, one for reconnect
    })

    it('should not delete newer subscription if it was added during cleanup', async () => {
      const mockConn1 = createMockConnection()
      const mockConn2 = createMockConnection()
      const entity = createMockEntity('light.living_room', 'on')
      const callback = vi.fn()
      const unsubscribe1 = vi.fn()
      const unsubscribe2 = vi.fn()

      // Set up first connection
      mockConn1.sendMessagePromise = vi.fn().mockResolvedValue([entity])
      mockConn1.subscribeEvents = vi.fn().mockResolvedValue(unsubscribe1)

      await act(async () => {
        await useStore.getState().setConnection(mockConn1)
      })

      await act(async () => {
        await useStore.getState().registerEntity('light.living_room', callback)
      })

      // Should have the first subscription
      expect(useStore.getState().websocketSubscriptions.size).toBe(1)
      const firstSub = useStore.getState().websocketSubscriptions.get('light.living_room')
      expect(firstSub?.unsubscribe).toBe(unsubscribe1)

      // Set up second connection - this will trigger resubscription
      mockConn2.sendMessagePromise = vi.fn().mockResolvedValue([entity])
      mockConn2.subscribeEvents = vi.fn().mockResolvedValue(unsubscribe2)

      // Change connection - this triggers cleanup of old subs and creation of new ones
      await act(async () => {
        await useStore.getState().setConnection(mockConn2)
      })

      // Old subscription should have been unsubscribed
      expect(unsubscribe1).toHaveBeenCalled()

      // Should have exactly 1 subscription (the new one)
      expect(useStore.getState().websocketSubscriptions.size).toBe(1)
      const finalSub = useStore.getState().websocketSubscriptions.get('light.living_room')

      // The subscription in the Map should be the NEW one from mockConn2
      expect(finalSub?.unsubscribe).toBe(unsubscribe2)
      expect(finalSub?.unsubscribe).not.toBe(unsubscribe1)
    })
  })

  describe('Store Cleanup', () => {
    it('should clear all state and unsubscribe from websockets', () => {
      const unsubscribeMock1 = vi.fn()
      const unsubscribeMock2 = vi.fn()
      const mockConn = createMockConnection()
      const entity = createMockEntity('light.living_room', 'on')

      // Set up some state
      act(() => {
        useStore.getState().setConnection(mockConn)
        useStore.getState().updateEntity('light.living_room', entity)
        useStore.getState().registerEntity('light.living_room', vi.fn())
      })

      // Manually add websocket subscriptions
      const state = useStore.getState()
      state.websocketSubscriptions.set('light.living_room', { unsubscribe: unsubscribeMock1 })
      state.websocketSubscriptions.set('switch.bedroom', { unsubscribe: unsubscribeMock2 })

      expect(state.entities.size).toBeGreaterThan(0)
      expect(state.registeredEntities.size).toBeGreaterThan(0)
      expect(state.componentSubscriptions.size).toBeGreaterThan(0)

      // Clear everything
      act(() => {
        useStore.getState().clear()
      })

      const clearedState = useStore.getState()
      expect(clearedState.entities.size).toBe(0)
      expect(clearedState.componentSubscriptions.size).toBe(0)
      expect(clearedState.websocketSubscriptions.size).toBe(0)
      expect(clearedState.registeredEntities.size).toBe(0)
      expect(clearedState.connection).toBeNull()

      // Should have called unsubscribe on all websocket subscriptions
      expect(unsubscribeMock1).toHaveBeenCalled()
      expect(unsubscribeMock2).toHaveBeenCalled()
    })

    it('should handle clearing empty store gracefully', () => {
      // Store should already be empty from beforeEach
      expect(useStore.getState().entities.size).toBe(0)

      expect(() => {
        act(() => {
          useStore.getState().clear()
        })
      }).not.toThrow()

      const state = useStore.getState()
      expect(state.entities.size).toBe(0)
      expect(state.componentSubscriptions.size).toBe(0)
      expect(state.websocketSubscriptions.size).toBe(0)
      expect(state.registeredEntities.size).toBe(0)
      expect(state.connection).toBeNull()
    })
  })

  describe('Selector Function', () => {
    it('should select entity by ID correctly', () => {
      const entity = createMockEntity('light.living_room', 'on')
      
      // Add entity to store
      act(() => {
        useStore.getState().updateEntity('light.living_room', entity)
      })

      // Use selector to get entity
      const selectedEntity = selectEntity('light.living_room')(useStore.getState())
      expect(selectedEntity).toEqual(entity)

      // Test non-existent entity
      const nonExistentEntity = selectEntity('nonexistent.entity')(useStore.getState())
      expect(nonExistentEntity).toBeUndefined()
    })
  })
})