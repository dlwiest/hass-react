import { describe, it, expect, vi } from 'vitest'
import {
  createMockEntity,
  createMockEntityFactory,
  createMockLightEntity,
  createMockFanEntity,
  createMockEntityWithDefaults,
  createMockEntityWithFeatures,
  getMockServiceCall,
  expectServiceCalled
} from '../mockHelpers'
import { EntityNotAvailableError } from '../../../utils/errors'

describe('mockHelpers', () => {
  describe('createMockEntity', () => {
    it('should create a basic mock entity', () => {
      const entity = createMockEntity('light.test', 'on', { brightness: 255 })
      
      expect(entity.entityId).toBe('light.test')
      expect(entity.state).toBe('on')
      expect(entity.attributes).toEqual({ brightness: 255 })
      expect(entity.isUnavailable).toBe(false)
      expect(entity.isConnected).toBe(true)
      expect(typeof entity.callService).toBe('function')
      expect(typeof entity.refresh).toBe('function')
    })

    it('should handle unavailable state correctly', () => {
      const entity = createMockEntity('light.test', 'unavailable')
      expect(entity.isUnavailable).toBe(true)
    })

    it('should derive an availability error for unavailable entities', () => {
      const entity = createMockEntity('light.test', 'unavailable')

      expect(entity.error).toBeInstanceOf(EntityNotAvailableError)
      expect(entity.error?.message).toContain('Entity is unavailable')
    })

    it('should accept disconnected and explicit error states', () => {
      const error = new Error('Subscription failed')
      const entity = createMockEntity('light.test', 'unknown', {}, false, error)

      expect(entity.isConnected).toBe(false)
      expect(entity.error).toBe(error)
    })

    it('should use default values when not provided', () => {
      const entity = createMockEntity('light.test')
      
      expect(entity.state).toBe('on')
      expect(entity.attributes).toEqual({})
      expect(entity.isUnavailable).toBe(false)
    })

    it('should have proper date objects', () => {
      const entity = createMockEntity('light.test')
      
      expect(entity.lastChanged).toBeInstanceOf(Date)
      expect(entity.lastUpdated).toBeInstanceOf(Date)
    })

    it('should have mock functions for service calls', () => {
      const entity = createMockEntity('light.test')
      
      expect(vi.isMockFunction(entity.callService)).toBe(true)
      expect(vi.isMockFunction(entity.refresh)).toBe(true)
    })
  })

  describe('createMockEntityFactory', () => {
    it('should create a factory function for a domain', () => {
      const createLightEntity = createMockEntityFactory('light')
      
      expect(typeof createLightEntity).toBe('function')
    })

    it('should create entities with correct domain prefix', () => {
      const createLightEntity = createMockEntityFactory('light')
      const entity = createLightEntity('living_room', 'off', { brightness: 128 })
      
      expect(entity.entityId).toBe('light.living_room')
      expect(entity.state).toBe('off')
      expect(entity.attributes).toEqual({ brightness: 128 })
    })

    it('should use default values in factory', () => {
      const createFanEntity = createMockEntityFactory('fan')
      const entity = createFanEntity()
      
      expect(entity.entityId).toBe('fan.test')
      expect(entity.state).toBe('on')
      expect(entity.attributes).toEqual({})
    })
  })

  describe('pre-built domain factories', () => {
    it('should create light entities correctly', () => {
      const entity = createMockLightEntity('bedroom', 'off')
      
      expect(entity.entityId).toBe('light.bedroom')
      expect(entity.state).toBe('off')
    })

    it('should create fan entities correctly', () => {
      const entity = createMockFanEntity('ceiling', 'on', { percentage: 75 })
      
      expect(entity.entityId).toBe('fan.ceiling')
      expect(entity.state).toBe('on')
      expect(entity.attributes.percentage).toBe(75)
    })
  })

  describe('createMockEntityWithDefaults', () => {
    it('should create light entity with default attributes', () => {
      const entity = createMockEntityWithDefaults.light('bedroom', 'on')
      
      expect(entity.entityId).toBe('light.bedroom')
      expect(entity.state).toBe('on')
      expect(entity.attributes.friendly_name).toBe('Test Light bedroom')
      expect(entity.attributes.supported_features).toBe(1) // SUPPORT_BRIGHTNESS
      expect(entity.attributes.brightness).toBe(255)
    })

    it('should create light entity with off state defaults', () => {
      const entity = createMockEntityWithDefaults.light('bedroom', 'off')
      
      expect(entity.attributes.brightness).toBe(0)
    })

    it('should create fan entity with default attributes', () => {
      const entity = createMockEntityWithDefaults.fan('ceiling', 'on')
      
      expect(entity.entityId).toBe('fan.ceiling')
      expect(entity.attributes.friendly_name).toBe('Test Fan ceiling')
      expect(entity.attributes.supported_features).toBe(1) // SUPPORT_SET_SPEED
      expect(entity.attributes.percentage).toBe(50)
    })

    it('should create lock entity with default state', () => {
      const entity = createMockEntityWithDefaults.lock('front_door')
      
      expect(entity.entityId).toBe('lock.front_door')
      expect(entity.state).toBe('locked')
      expect(entity.attributes.supported_features).toBe(0)
    })
  })

  describe('createMockEntityWithFeatures', () => {
    it('should create entity with specific features enabled', () => {
      const entity = createMockEntityWithFeatures(
        'light',
        'living_room',
        [1, 16], // SUPPORT_BRIGHTNESS | SUPPORT_COLOR
        'on',
        { brightness: 200 }
      )
      
      expect(entity.entityId).toBe('light.living_room')
      expect(entity.attributes.supported_features).toBe(17) // 1 | 16
      expect(entity.attributes.brightness).toBe(200)
      expect(entity.attributes.friendly_name).toBe('Test light living_room')
    })

    it('should handle single feature', () => {
      const entity = createMockEntityWithFeatures('fan', 'bedroom', [1])
      
      expect(entity.attributes.supported_features).toBe(1)
    })

    it('should handle no features', () => {
      const entity = createMockEntityWithFeatures('switch', 'outlet', [])
      
      expect(entity.attributes.supported_features).toBe(0)
    })
  })

  describe('getMockServiceCall', () => {
    it('should return the mock function from entity', () => {
      const entity = createMockEntity('light.test')
      const mockFn = getMockServiceCall(entity)
      
      expect(vi.isMockFunction(mockFn)).toBe(true)
      expect(mockFn).toBe(entity.callService)
    })
  })

  describe('expectServiceCalled', () => {
    it('should create expect assertion for service call with parameters', () => {
      const entity = createMockEntity('light.test')
      const mockCall = getMockServiceCall(entity)
      
      // Mock a service call
      mockCall('light', 'turn_on', { brightness: 255 })
      
      // This should not throw
      expectServiceCalled(entity, 'light', 'turn_on', { brightness: 255 })
    })

    it('should create expect assertion for service call without parameters', () => {
      const entity = createMockEntity('light.test')
      const mockCall = getMockServiceCall(entity)
      
      mockCall('light', 'toggle')
      
      // This should not throw
      expectServiceCalled(entity, 'light', 'toggle')
    })
  })

  describe('TypeScript type safety', () => {
    it('should handle typed attributes correctly', () => {
      interface LightAttributes {
        brightness: number
        color_temp_kelvin?: number
      }
      
      const entity = createMockEntity<LightAttributes>(
        'light.test', 
        'on', 
        { brightness: 255, color_temp_kelvin: 2700 }
      )
      
      expect(entity.attributes.brightness).toBe(255)
      expect(entity.attributes.color_temp_kelvin).toBe(2700)
    })
  })
})