import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBinarySensor } from '../useBinarySensor'
import { useEntity, type EntityHook } from '../useEntity'

// Mock useEntity since useBinarySensor depends on it
vi.mock('../useEntity')

// Mock binary sensor entity response
const createMockBinarySensorEntity = (
  state: string = 'off',
  attributes: Record<string, unknown> = {}
): EntityHook => ({
  entityId: 'binary_sensor.test',
  state,
  attributes,
  lastChanged: new Date(),
  lastUpdated: new Date(),
  isUnavailable: state === 'unavailable',
  isConnected: true,
  callService: vi.fn(),
  callServiceWithResponse: vi.fn(),
  refresh: vi.fn()
})

describe('useBinarySensor', () => {
  const mockUseEntity = useEntity as any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockBinarySensorEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('State Parsing', () => {
    it('should handle "off" state correctly', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('off'))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(false)
      expect(result.current.isOff).toBe(true)
    })

    it('should handle "on" state correctly', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on'))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(true)
      expect(result.current.isOff).toBe(false)
    })

    it('should handle unknown states', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('unknown'))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(false)
      expect(result.current.isOff).toBe(false)
    })

    it('should handle unavailable state', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('unavailable'))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(false)
      expect(result.current.isOff).toBe(false)
      expect(result.current.isUnavailable).toBe(true)
    })
  })

  describe('Device Classes', () => {
    it('should handle door device class', () => {
      const attributes = {
        device_class: 'door',
        friendly_name: 'Front Door'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.deviceClass).toBe('door')
      expect(result.current.isOn).toBe(true)
    })

    it('should handle window device class', () => {
      const attributes = {
        device_class: 'window',
        friendly_name: 'Kitchen Window'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('off', attributes))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.deviceClass).toBe('window')
      expect(result.current.isOff).toBe(true)
    })

    it('should handle motion device class', () => {
      const attributes = {
        device_class: 'motion',
        friendly_name: 'Living Room Motion'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.deviceClass).toBe('motion')
      expect(result.current.isOn).toBe(true)
    })

    it('should handle occupancy device class', () => {
      const attributes = {
        device_class: 'occupancy',
        friendly_name: 'Room Occupancy'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.deviceClass).toBe('occupancy')
      expect(result.current.isOn).toBe(true)
    })

    it('should handle opening device class', () => {
      const attributes = {
        device_class: 'opening',
        friendly_name: 'Garage Door'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.deviceClass).toBe('opening')
      expect(result.current.isOn).toBe(true)
    })
  })

  describe('Attributes', () => {
    it('should expose icon attribute', () => {
      const attributes = {
        icon: 'mdi:door',
        device_class: 'door'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.icon).toBe('mdi:door')
    })

    it('should handle missing attributes', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', {}))

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.deviceClass).toBeUndefined()
      expect(result.current.icon).toBeUndefined()
    })

    it('should expose all base entity properties', () => {
      const mockEntity = createMockBinarySensorEntity('on', {
        friendly_name: 'Test Binary Sensor'
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      // Should have all base entity properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.attributes).toBe(mockEntity.attributes)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)
    })
  })

  describe('Entity ID Validation', () => {
    it('should accept full binary_sensor entity ID', () => {
      const { result } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(mockUseEntity).toHaveBeenCalledWith('binary_sensor.test')
      expect(result.current).toBeDefined()
    })

    it('should normalize short entity ID', () => {
      const { result } = renderHook(() => useBinarySensor('test'))

      expect(mockUseEntity).toHaveBeenCalledWith('binary_sensor.test')
      expect(result.current).toBeDefined()
    })

    it('should warn about wrong domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useBinarySensor('sensor.temperature'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('useBinarySensor: Entity "sensor.temperature" has domain "sensor" but expects "binary_sensor" domain')
      )
      expect(result.current).toBeDefined()
      
      consoleSpy.mockRestore()
    })
  })

  describe('State Transitions', () => {
    it('should handle off to on transition', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('off'))

      const { result, rerender } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(false)
      expect(result.current.isOff).toBe(true)

      // Simulate state change
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on'))
      rerender()

      expect(result.current.isOn).toBe(true)
      expect(result.current.isOff).toBe(false)
    })

    it('should handle on to off transition', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on'))

      const { result, rerender } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(true)
      expect(result.current.isOff).toBe(false)

      // Simulate state change
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('off'))
      rerender()

      expect(result.current.isOn).toBe(false)
      expect(result.current.isOff).toBe(true)
    })

    it('should handle becoming unavailable', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on'))

      const { result, rerender } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isOn).toBe(true)
      expect(result.current.isUnavailable).toBe(false)

      // Simulate becoming unavailable
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('unavailable'))
      rerender()

      expect(result.current.isOn).toBe(false)
      expect(result.current.isOff).toBe(false)
      expect(result.current.isUnavailable).toBe(true)
    })

    it('should handle becoming available again', () => {
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('unavailable'))

      const { result, rerender } = renderHook(() => useBinarySensor('binary_sensor.test'))

      expect(result.current.isUnavailable).toBe(true)

      // Simulate becoming available
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on'))
      rerender()

      expect(result.current.isUnavailable).toBe(false)
      expect(result.current.isOn).toBe(true)
    })
  })

  describe('Common Binary Sensor Types', () => {
    it('should work with door sensors', () => {
      const attributes = {
        device_class: 'door',
        friendly_name: 'Kitchen Door',
        icon: 'mdi:door'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('kitchen_door'))

      expect(result.current.isOn).toBe(true) // Door open
      expect(result.current.deviceClass).toBe('door')
    })

    it('should work with motion sensors', () => {
      const attributes = {
        device_class: 'motion',
        friendly_name: 'Living Room Motion',
        icon: 'mdi:motion-sensor'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('off', attributes))

      const { result } = renderHook(() => useBinarySensor('motion_sensor'))

      expect(result.current.isOff).toBe(true) // No motion
      expect(result.current.deviceClass).toBe('motion')
    })

    it('should work with window sensors', () => {
      const attributes = {
        device_class: 'window',
        friendly_name: 'Bedroom Window',
        icon: 'mdi:window-open'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('window_sensor'))

      expect(result.current.isOn).toBe(true) // Window open
      expect(result.current.deviceClass).toBe('window')
    })

    it('should work with occupancy sensors', () => {
      const attributes = {
        device_class: 'occupancy',
        friendly_name: 'Office Occupancy',
        icon: 'mdi:account'
      }
      mockUseEntity.mockReturnValue(createMockBinarySensorEntity('on', attributes))

      const { result } = renderHook(() => useBinarySensor('occupancy_sensor'))

      expect(result.current.isOn).toBe(true) // Room occupied
      expect(result.current.deviceClass).toBe('occupancy')
    })
  })
})