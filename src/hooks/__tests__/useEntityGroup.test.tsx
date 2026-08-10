import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEntityGroup } from '../useEntityGroup'
import type { EntityState } from '../../types'

// Mock entityStore
const mockEntities = new Map<string, EntityState>()
const mockRegisterEntity = vi.fn()
const mockUnregisterEntity = vi.fn()

vi.mock('../../services/entityStore', () => ({
  useStore: {
    getState: () => ({
      entities: mockEntities,
      registerEntity: mockRegisterEntity,
      unregisterEntity: mockUnregisterEntity
    })
  }
}))

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

describe('useEntityGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEntities.clear()
    
    // Reset mock functions
    mockRegisterEntity.mockClear()
    mockUnregisterEntity.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockEntities.clear()
  })

  describe('Pattern Matching', () => {
    it('should handle single entity pattern', () => {
      const entity = createMockEntity('light.living_room', 'on')
      mockEntities.set('light.living_room', entity)

      const { result } = renderHook(() => useEntityGroup('light.living_room'))

      expect(result.current).toHaveLength(1)
      expect(result.current[0]).toEqual(entity)
    })

    it('should handle multiple entity patterns as array', () => {
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')
      mockEntities.set('light.living_room', entity1)
      mockEntities.set('switch.bedroom', entity2)

      const { result } = renderHook(() => useEntityGroup(['light.living_room', 'switch.bedroom']))

      expect(result.current).toHaveLength(2)
      expect(result.current).toContainEqual(entity1)
      expect(result.current).toContainEqual(entity2)
    })

    it('should return empty array when no entities match', () => {
      const entity = createMockEntity('light.kitchen', 'on')
      mockEntities.set('light.kitchen', entity)

      const { result } = renderHook(() => useEntityGroup('light.living_room'))

      expect(result.current).toHaveLength(0)
    })

    it('should return only matching entities when some patterns match', () => {
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('light.kitchen', 'off')
      mockEntities.set('light.living_room', entity1)
      mockEntities.set('light.kitchen', entity2)

      const { result } = renderHook(() => useEntityGroup(['light.living_room', 'switch.nonexistent']))

      expect(result.current).toHaveLength(1)
      expect(result.current[0]).toEqual(entity1)
    })

    it('should handle empty pattern array', () => {
      const entity = createMockEntity('light.living_room', 'on')
      mockEntities.set('light.living_room', entity)

      const { result } = renderHook(() => useEntityGroup([]))

      expect(result.current).toHaveLength(0)
    })

    it('should handle duplicate patterns gracefully', () => {
      const entity = createMockEntity('light.living_room', 'on')
      mockEntities.set('light.living_room', entity)

      const { result } = renderHook(() => useEntityGroup(['light.living_room', 'light.living_room']))

      // Should only return the entity once, even though pattern is duplicated
      expect(result.current).toHaveLength(1)
      expect(result.current[0]).toEqual(entity)
    })
  })

  describe('Entity Subscriptions', () => {
    it('should register for entity updates on mount', () => {
      renderHook(() => useEntityGroup('light.living_room'))

      expect(mockRegisterEntity).toHaveBeenCalledWith('light.living_room', expect.any(Function))
    })

    it('should register for multiple entity updates', () => {
      renderHook(() => useEntityGroup(['light.living_room', 'switch.bedroom']))

      expect(mockRegisterEntity).toHaveBeenCalledWith('light.living_room', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledWith('switch.bedroom', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledTimes(2)
    })

    it('should unregister on unmount', () => {
      const { unmount } = renderHook(() => useEntityGroup('light.living_room'))

      // Get the callback that was registered
      const registeredCallback = mockRegisterEntity.mock.calls[0][1]

      unmount()

      expect(mockUnregisterEntity).toHaveBeenCalledWith('light.living_room', registeredCallback)
    })

    it('should unregister multiple entities on unmount', () => {
      const { unmount } = renderHook(() => useEntityGroup(['light.living_room', 'switch.bedroom']))

      // Get the callbacks that were registered
      const callback1 = mockRegisterEntity.mock.calls[0][1]
      const callback2 = mockRegisterEntity.mock.calls[1][1]

      unmount()

      expect(mockUnregisterEntity).toHaveBeenCalledWith('light.living_room', callback1)
      expect(mockUnregisterEntity).toHaveBeenCalledWith('switch.bedroom', callback2)
      expect(mockUnregisterEntity).toHaveBeenCalledTimes(2)
    })

    it('should re-register when patterns change', () => {
      let patterns = ['light.living_room']
      
      const { rerender } = renderHook(
        ({ patterns }) => useEntityGroup(patterns),
        { initialProps: { patterns } }
      )

      expect(mockRegisterEntity).toHaveBeenCalledWith('light.living_room', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledTimes(1)

      // Change patterns
      patterns = ['switch.bedroom']
      rerender({ patterns })

      // Should unregister old and register new
      expect(mockUnregisterEntity).toHaveBeenCalledWith('light.living_room', expect.any(Function))
      expect(mockRegisterEntity).toHaveBeenCalledWith('switch.bedroom', expect.any(Function))
    })

    it('should update results when entities change in store', () => {
      const entity1 = createMockEntity('light.living_room', 'off')
      const entity2 = createMockEntity('light.living_room', 'on')
      
      mockEntities.set('light.living_room', entity1)

      const { result } = renderHook(() => useEntityGroup('light.living_room'))

      expect(result.current[0].state).toBe('off')

      // Simulate entity change by calling the registered callback
      act(() => {
        mockEntities.set('light.living_room', entity2)
        // Call the registered callback to trigger update
        const registeredCallback = mockRegisterEntity.mock.calls[0][1]
        registeredCallback()
      })

      expect(result.current[0].state).toBe('on')
    })

    it('should preserve the result reference when member references are unchanged', () => {
      const entity = createMockEntity('light.living_room', 'on')
      mockEntities.set(entity.entity_id, entity)

      const { result } = renderHook(() => useEntityGroup(entity.entity_id))
      const initialResult = result.current

      act(() => {
        const registeredCallback = mockRegisterEntity.mock.calls[0][1]
        registeredCallback()
      })

      expect(result.current).toBe(initialResult)
    })
  })

  describe('Store Integration', () => {
    it('should reflect current store state', () => {
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')
      const entity3 = createMockEntity('light.kitchen', 'on')
      
      mockEntities.set('light.living_room', entity1)
      mockEntities.set('switch.bedroom', entity2)
      mockEntities.set('light.kitchen', entity3)

      const { result } = renderHook(() => useEntityGroup(['light.living_room', 'switch.bedroom']))

      expect(result.current).toHaveLength(2)
      expect(result.current).toContainEqual(entity1)
      expect(result.current).toContainEqual(entity2)
      expect(result.current).not.toContainEqual(entity3) // Not in pattern
    })

    it('should handle entities being added to store', () => {
      // Start with empty store
      const { result } = renderHook(() => useEntityGroup('light.living_room'))

      expect(result.current).toHaveLength(0)

      // Add entity to store
      act(() => {
        const entity = createMockEntity('light.living_room', 'on')
        mockEntities.set('light.living_room', entity)
        // Call the registered callback to trigger update
        const registeredCallback = mockRegisterEntity.mock.calls[0][1]
        registeredCallback()
      })

      expect(result.current).toHaveLength(1)
      expect(result.current[0].entity_id).toBe('light.living_room')
    })

    it('should handle entities being removed from store', () => {
      const entity = createMockEntity('light.living_room', 'on')
      mockEntities.set('light.living_room', entity)

      const { result } = renderHook(() => useEntityGroup('light.living_room'))

      expect(result.current).toHaveLength(1)

      // Remove entity from store
      act(() => {
        mockEntities.delete('light.living_room')
        // Call the registered callback to trigger update
        const registeredCallback = mockRegisterEntity.mock.calls[0][1]
        registeredCallback()
      })

      expect(result.current).toHaveLength(0)
    })

    it('should handle complex entity updates', () => {
      const entities = [
        createMockEntity('light.living_room', 'on', { brightness: 255 }),
        createMockEntity('light.bedroom', 'off'),
        createMockEntity('light.kitchen', 'on', { brightness: 128 })
      ]

      entities.forEach(e => mockEntities.set(e.entity_id, e))

      const { result } = renderHook(() => 
        useEntityGroup(['light.living_room', 'light.bedroom', 'light.kitchen'])
      )

      expect(result.current).toHaveLength(3)

      // Update one entity
      act(() => {
        const updatedEntity = createMockEntity('light.bedroom', 'on', { brightness: 200 })
        mockEntities.set('light.bedroom', updatedEntity)
        // Call one of the registered callbacks to trigger update
        const registeredCallback = mockRegisterEntity.mock.calls[1][1] // bedroom callback
        registeredCallback()
      })

      const bedroomLight = result.current.find(e => e.entity_id === 'light.bedroom')
      expect(bedroomLight?.state).toBe('on')
      expect(bedroomLight?.attributes.brightness).toBe(200)
    })

    it('should maintain entity order consistently', () => {
      const entity1 = createMockEntity('light.a', 'on')
      const entity2 = createMockEntity('light.b', 'off')
      const entity3 = createMockEntity('light.c', 'on')
      
      mockEntities.set('light.a', entity1)
      mockEntities.set('light.b', entity2)
      mockEntities.set('light.c', entity3)

      const { result } = renderHook(() => useEntityGroup(['light.a', 'light.b', 'light.c']))

      // Should maintain consistent ordering
      expect(result.current).toHaveLength(3)
      const entityIds = result.current.map(e => e.entity_id)
      expect(entityIds).toEqual(['light.a', 'light.b', 'light.c'])
    })

    it('should handle pattern changes with existing entities', () => {
      const entity1 = createMockEntity('light.living_room', 'on')
      const entity2 = createMockEntity('switch.bedroom', 'off')
      const entity3 = createMockEntity('light.kitchen', 'on')
      
      mockEntities.set('light.living_room', entity1)
      mockEntities.set('switch.bedroom', entity2)
      mockEntities.set('light.kitchen', entity3)

      let patterns = ['light.living_room', 'switch.bedroom']
      
      const { result, rerender } = renderHook(
        ({ patterns }) => useEntityGroup(patterns),
        { initialProps: { patterns } }
      )

      expect(result.current).toHaveLength(2)

      // Change patterns to include different entity
      patterns = ['light.living_room', 'light.kitchen']
      rerender({ patterns })

      expect(result.current).toHaveLength(2)
      const entityIds = result.current.map(e => e.entity_id)
      expect(entityIds).toContain('light.living_room')
      expect(entityIds).toContain('light.kitchen')
      expect(entityIds).not.toContain('switch.bedroom')
    })
  })
})