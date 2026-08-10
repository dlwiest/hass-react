import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSensor } from '../useSensor'
import { useEntity } from '../useEntity'

// Mock useEntity since useSensor depends on it
vi.mock('../useEntity')

// Mock sensor entity response
const createMockSensorEntity = (
  state: string = '23.5',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'sensor.test',
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

describe('useSensor', () => {
  const mockUseEntity = useEntity as any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockSensorEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Entity ID validation', () => {
    it('should normalize bare IDs and warn for the wrong domain', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useSensor('living_room'))
      expect(mockUseEntity).toHaveBeenCalledWith('sensor.living_room')

      renderHook(() => useSensor('light.sensor_hook_wrong_domain'))
      expect(mockUseEntity).toHaveBeenLastCalledWith('light.sensor_hook_wrong_domain')
      expect(warn).toHaveBeenCalledOnce()

      warn.mockRestore()
    })
  })

  describe('Value Parsing and Device Classes', () => {
    it('should parse temperature values as numbers', () => {
      const attributes = {
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('23.5', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(23.5)
      expect(result.current.deviceClass).toBe('temperature')
      expect(result.current.unitOfMeasurement).toBe('°C')
    })

    it('should parse humidity values as numbers', () => {
      const attributes = {
        device_class: 'humidity',
        unit_of_measurement: '%'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('65.2', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(65.2)
      expect(result.current.deviceClass).toBe('humidity')
      expect(result.current.unitOfMeasurement).toBe('%')
    })

    it('should parse pressure values as numbers', () => {
      const attributes = {
        device_class: 'pressure',
        unit_of_measurement: 'hPa'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('1013.25', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(1013.25)
      expect(result.current.deviceClass).toBe('pressure')
      expect(result.current.unitOfMeasurement).toBe('hPa')
    })

    it('should keep string values for non-numeric device classes', () => {
      const attributes = {
        device_class: 'battery',
        unit_of_measurement: '%'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('85', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe('85') // Should remain string
      expect(result.current.deviceClass).toBe('battery')
    })

    it('should keep string values when no device class is specified', () => {
      const attributes = {
        unit_of_measurement: 'count'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('42', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe('42') // Should remain string
      expect(result.current.deviceClass).toBeUndefined()
    })

    it('should handle non-numeric values for numeric device classes gracefully', () => {
      const attributes = {
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('unknown', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBeNull() // Should return null for unknown state
      expect(result.current.numericValue).toBeNull() // Should return null for unknown state
      expect(result.current.deviceClass).toBe('temperature')
    })

    it('should handle negative numbers correctly', () => {
      const attributes = {
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('-15.3', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(-15.3)
    })

    it('should handle decimal numbers correctly', () => {
      const attributes = {
        device_class: 'humidity',
        unit_of_measurement: '%'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('23.456789', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(23.456789)
    })

    it('should handle integer values for numeric device classes', () => {
      const attributes = {
        device_class: 'pressure',
        unit_of_measurement: 'hPa'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('1013', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(1013)
    })

    it('should handle zero values correctly', () => {
      const attributes = {
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('0', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(0)
    })
  })

  describe('Unit and Icon Handling', () => {
    it('should return unitOfMeasurement of measurement', () => {
      const attributes = {
        unit_of_measurement: 'kWh',
        device_class: 'energy'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('125.7', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.unitOfMeasurement).toBe('kWh')
    })

    it('should return icon', () => {
      const attributes = {
        icon: 'mdi:thermometer',
        device_class: 'temperature'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('22.1', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.icon).toBe('mdi:thermometer')
    })

    it('should handle missing unitOfMeasurement of measurement', () => {
      const attributes = {
        device_class: 'battery'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('85', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.unitOfMeasurement).toBeUndefined()
    })

    it('should handle missing icon', () => {
      const attributes = {
        device_class: 'temperature',
        unit_of_measurement: '°F'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('72.5', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.icon).toBeUndefined()
    })

    it('should handle missing device class', () => {
      const attributes = {
        unit_of_measurement: 'count',
        icon: 'mdi:counter'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('42', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.deviceClass).toBeUndefined()
      expect(result.current.unitOfMeasurement).toBe('count')
      expect(result.current.icon).toBe('mdi:counter')
    })

    it('should handle completely empty attributes', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockSensorEntity('some_value', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe('some_value')
      expect(result.current.unitOfMeasurement).toBeUndefined()
      expect(result.current.deviceClass).toBeUndefined()
      expect(result.current.icon).toBeUndefined()
    })

    it('should handle special sensor types correctly', () => {
      // Test various sensor device classes
      const testCases = [
        { device_class: 'battery', state: '75', expectedValue: '75', unitOfMeasurement: '%' },
        { device_class: 'illuminance', state: '250', expectedValue: '250', unitOfMeasurement: 'lx' },
        { device_class: 'power', state: '1500.5', expectedValue: '1500.5', unitOfMeasurement: 'W' },
        { device_class: 'energy', state: '42.3', expectedValue: '42.3', unitOfMeasurement: 'kWh' },
        { device_class: 'timestamp', state: '2023-01-01T12:00:00Z', expectedValue: '2023-01-01T12:00:00Z', unitOfMeasurement: undefined }
      ]

      testCases.forEach(({ device_class, state, expectedValue, unitOfMeasurement }) => {
        const attributes = { device_class, unit_of_measurement: unitOfMeasurement }
        mockUseEntity.mockReturnValue(createMockSensorEntity(state, attributes))
        
        const { result } = renderHook(() => useSensor('sensor.test'))
        
        expect(result.current.value).toBe(expectedValue)
        expect(result.current.deviceClass).toBe(device_class)
        expect(result.current.unitOfMeasurement).toBe(unitOfMeasurement)
      })
    })
  })

  describe('Integration with useEntity', () => {
    it('should pass entityId to useEntity', () => {
      const entityId = 'sensor.temperature'
      
      renderHook(() => useSensor(entityId))

      expect(mockUseEntity).toHaveBeenCalledWith(entityId)
    })

    it('should inherit all base entity properties', () => {
      const mockEntity = createMockSensorEntity('25.2', { 
        device_class: 'temperature',
        unit_of_measurement: '°C',
        test: 'value'
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useSensor('sensor.test'))

      // Should inherit all base properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.attributes).toBe(mockEntity.attributes)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)

      // Plus sensor-specific properties
      expect(result.current.value).toBe(25.2)
      expect(result.current.deviceClass).toBe('temperature')
      expect(result.current.unitOfMeasurement).toBe('°C')
      expect(result.current.icon).toBeUndefined()
    })

    it('should update when useEntity data changes', () => {
      // Start with low temperature
      mockUseEntity.mockReturnValue(createMockSensorEntity('18.5', { 
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }))

      const { result, rerender } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(18.5)

      // Update to higher temperature
      mockUseEntity.mockReturnValue(createMockSensorEntity('24.7', { 
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }))
      rerender()

      expect(result.current.value).toBe(24.7)
    })

    it('should handle state changes that affect parsing', () => {
      // Start with valid numeric value
      mockUseEntity.mockReturnValue(createMockSensorEntity('23.5', { 
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }))

      const { result, rerender } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(23.5)

      // Update to non-numeric value (sensor unavailable)
      mockUseEntity.mockReturnValue(createMockSensorEntity('unavailable', { 
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }))
      rerender()

      expect(result.current.value).toBeNull() // Should be null for unavailable state
      expect(result.current.isUnavailable).toBe(true)
    })

    it('should handle device class changes', () => {
      // Start as temperature sensor (numeric parsing)
      mockUseEntity.mockReturnValue(createMockSensorEntity('23.5', { 
        device_class: 'temperature',
        unit_of_measurement: '°C'
      }))

      const { result, rerender } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(23.5)
      expect(result.current.deviceClass).toBe('temperature')

      // Change to battery sensor (string parsing)
      mockUseEntity.mockReturnValue(createMockSensorEntity('85', { 
        device_class: 'battery',
        unit_of_measurement: '%'
      }))
      rerender()

      expect(result.current.value).toBe('85') // Now string
      expect(result.current.deviceClass).toBe('battery')
      expect(result.current.unitOfMeasurement).toBe('%')
    })

    it('should handle complex sensor with all attributes', () => {
      const attributes = {
        device_class: 'humidity',
        unit_of_measurement: '%',
        icon: 'mdi:water-percent',
        friendly_name: 'Living Room Humidity',
        accuracy_decimals: 1,
        state_class: 'measurement'
      }
      mockUseEntity.mockReturnValue(createMockSensorEntity('45.8', attributes))

      const { result } = renderHook(() => useSensor('sensor.test'))

      expect(result.current.value).toBe(45.8)
      expect(result.current.deviceClass).toBe('humidity')
      expect(result.current.unitOfMeasurement).toBe('%')
      expect(result.current.icon).toBe('mdi:water-percent')
      
      // Should still have access to full attributes
      expect(result.current.attributes).toEqual(attributes)
    })
  })
})