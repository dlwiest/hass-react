import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClimate } from '../useClimate'
import { useEntity } from '../useEntity'
import { ClimateFeatures } from '../../types'

// Mock useEntity since useClimate depends on it
vi.mock('../useEntity')

// Mock climate entity response
const createMockClimateEntity = (
  state: string = 'heat',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'climate.test',
  state,
  attributes,
  lastChanged: new Date(),
  lastUpdated: new Date(),
  isUnavailable: state === 'unavailable',
  isConnected: true,
  callService: vi.fn(),
  callServiceWithResponse: vi.fn(),
  refresh: vi.fn(),
  // Add required ClimateState properties
  currentTemperature: attributes.current_temperature,
  targetTemperature: attributes.temperature,
  targetTempHigh: attributes.target_temp_high,
  targetTempLow: attributes.target_temp_low,
  humidity: attributes.current_humidity,
  mode: attributes.hvac_mode || state,
  fanMode: attributes.fan_mode,
  presetMode: attributes.preset_mode,
  supportedModes: attributes.hvac_modes || [],
  supportedFanModes: attributes.fan_modes || [],
  supportedPresetModes: attributes.preset_modes || [],
  minTemp: attributes.min_temp || 60,
  maxTemp: attributes.max_temp || 90,
  supportsTargetTemperature: Boolean(attributes.supported_features & ClimateFeatures.SUPPORT_TARGET_TEMPERATURE),
  supportsTargetTemperatureRange: Boolean(attributes.supported_features & ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE),
  supportsFanMode: Boolean(attributes.supported_features & ClimateFeatures.SUPPORT_FAN_MODE),
  supportsPresetMode: Boolean(attributes.supported_features & ClimateFeatures.SUPPORT_PRESET_MODE),
  setMode: vi.fn(),
  setTemperature: vi.fn(),
  setTemperatureRange: vi.fn(),
  setFanMode: vi.fn(),
  setPresetMode: vi.fn()
})

describe('useClimate', () => {
  const mockUseEntity = useEntity as any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockClimateEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Feature Detection and Attributes', () => {
    it('should detect target temperature support correctly', () => {
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportsTargetTemperature).toBe(true)
      expect(result.current.supportsTargetTemperatureRange).toBe(false)
      expect(result.current.supportsFanMode).toBe(false)
      expect(result.current.supportsPresetMode).toBe(false)
    })

    it('should detect target temperature range support correctly', () => {
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('auto', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportsTargetTemperatureRange).toBe(true)
      expect(result.current.supportsTargetTemperature).toBe(false)
      expect(result.current.supportsFanMode).toBe(false)
      expect(result.current.supportsPresetMode).toBe(false)
    })

    it('should detect fan mode support correctly', () => {
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_FAN_MODE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('cool', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportsFanMode).toBe(true)
      expect(result.current.supportsTargetTemperature).toBe(false)
      expect(result.current.supportsTargetTemperatureRange).toBe(false)
      expect(result.current.supportsPresetMode).toBe(false)
    })

    it('should detect preset mode support correctly', () => {
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_PRESET_MODE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportsPresetMode).toBe(true)
      expect(result.current.supportsTargetTemperature).toBe(false)
      expect(result.current.supportsTargetTemperatureRange).toBe(false)
      expect(result.current.supportsFanMode).toBe(false)
    })

    it('should detect multiple features correctly', () => {
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE | ClimateFeatures.SUPPORT_FAN_MODE | ClimateFeatures.SUPPORT_PRESET_MODE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportsTargetTemperature).toBe(true)
      expect(result.current.supportsFanMode).toBe(true)
      expect(result.current.supportsPresetMode).toBe(true)
      expect(result.current.supportsTargetTemperatureRange).toBe(false)
    })

    it('should handle missing supported_features attribute', () => {
      const attributes = {} // No supported_features
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportsTargetTemperature).toBe(false)
      expect(result.current.supportsTargetTemperatureRange).toBe(false)
      expect(result.current.supportsFanMode).toBe(false)
      expect(result.current.supportsPresetMode).toBe(false)
    })

    it('should return current temperature value', () => {
      const attributes = {
        current_temperature: 22.5
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.currentTemperature).toBe(22.5)
    })

    it('should return target temperature value', () => {
      const attributes = {
        temperature: 24.0,
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.targetTemperature).toBe(24.0)
    })

    it('should return temperature range values', () => {
      const attributes = {
        target_temp_low: 20.0,
        target_temp_high: 26.0,
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('auto', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.targetTempLow).toBe(20.0)
      expect(result.current.targetTempHigh).toBe(26.0)
    })

    it('should return humidity value', () => {
      const attributes = {
        current_humidity: 45
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('cool', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.humidity).toBe(45)
    })

    it('should use the entity state as the HVAC mode', () => {
      const attributes = { hvac_mode: 'fictional-attribute-value' }
      mockUseEntity.mockReturnValue(createMockClimateEntity('cool', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.mode).toBe('cool')
    })

    it('should return fan mode value', () => {
      const attributes = {
        fan_mode: 'auto',
        supported_features: ClimateFeatures.SUPPORT_FAN_MODE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('cool', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.fanMode).toBe('auto')
    })

    it('should return preset mode value', () => {
      const attributes = {
        preset_mode: 'eco',
        supported_features: ClimateFeatures.SUPPORT_PRESET_MODE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.presetMode).toBe('eco')
    })

    it('should return supported modes lists', () => {
      const attributes = {
        hvac_modes: ['off', 'heat', 'cool', 'auto'],
        fan_modes: ['auto', 'low', 'medium', 'high'],
        preset_modes: ['none', 'eco', 'comfort', 'boost']
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportedModes).toEqual(['off', 'heat', 'cool', 'auto'])
      expect(result.current.supportedFanModes).toEqual(['auto', 'low', 'medium', 'high'])
      expect(result.current.supportedPresetModes).toEqual(['none', 'eco', 'comfort', 'boost'])
    })

    it('should return empty arrays when mode lists are missing', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.supportedModes).toEqual([])
      expect(result.current.supportedFanModes).toEqual([])
      expect(result.current.supportedPresetModes).toEqual([])
    })

    it('should preserve explicit temperature limits including zero', () => {
      const attributes = { min_temp: 0, max_temp: 35, temperature_unit: '°C' }
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.minTemp).toBe(0)
      expect(result.current.maxTemp).toBe(35)
    })

    it.each([
      ['°C', 7, 35],
      ['°F', 45, 95],
    ])('should derive %s temperature limits when attributes are absent', (unit, min, max) => {
      mockUseEntity.mockReturnValue(
        createMockClimateEntity('heat', { temperature_unit: unit })
      )

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.minTemp).toBe(min)
      expect(result.current.maxTemp).toBe(max)
    })

    it('should handle undefined attribute values gracefully', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockClimateEntity('off', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      expect(result.current.currentTemperature).toBeUndefined()
      expect(result.current.targetTemperature).toBeUndefined()
      expect(result.current.targetTempLow).toBeUndefined()
      expect(result.current.targetTempHigh).toBeUndefined()
      expect(result.current.humidity).toBeUndefined()
      expect(result.current.fanMode).toBeUndefined()
      expect(result.current.presetMode).toBeUndefined()
    })
  })

  describe('Service Calls', () => {
    it('should call climate.set_hvac_mode service on setMode()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity(),
        callService: mockCallService
      })

      const { result } = renderHook(() => useClimate('climate.test'))

      await act(async () => {
        await result.current.setMode('cool')
      })

      expect(mockCallService).toHaveBeenCalledWith('climate', 'set_hvac_mode', { hvac_mode: 'cool' })
    })

    it('should call climate.set_temperature service on setTemperature()', async () => {
      const mockCallService = vi.fn()
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE
      }
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity('heat', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useClimate('climate.test'))

      await act(async () => {
        await result.current.setTemperature(22.5)
      })

      expect(mockCallService).toHaveBeenCalledWith('climate', 'set_temperature', { temperature: 22.5 })
    })

    it('should call climate.set_temperature with range on setTemperatureRange()', async () => {
      const mockCallService = vi.fn()
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE
      }
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity('auto', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useClimate('climate.test'))

      await act(async () => {
        await result.current.setTemperatureRange(20, 26)
      })

      expect(mockCallService).toHaveBeenCalledWith('climate', 'set_temperature', {
        target_temp_low: 20,
        target_temp_high: 26
      })
    })

    it('should call climate.set_fan_mode service on setFanMode()', async () => {
      const mockCallService = vi.fn()
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_FAN_MODE
      }
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity('cool', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useClimate('climate.test'))

      await act(async () => {
        await result.current.setFanMode('high')
      })

      expect(mockCallService).toHaveBeenCalledWith('climate', 'set_fan_mode', { fan_mode: 'high' })
    })

    it('should call climate.set_preset_mode service on setPresetMode()', async () => {
      const mockCallService = vi.fn()
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_PRESET_MODE
      }
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity('heat', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useClimate('climate.test'))

      await act(async () => {
        await result.current.setPresetMode('eco')
      })

      expect(mockCallService).toHaveBeenCalledWith('climate', 'set_preset_mode', { preset_mode: 'eco' })
    })

    it('should handle service call errors', async () => {
      const mockCallService = vi.fn().mockRejectedValue(new Error('Service call failed'))
      const attributes = {
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE |
                           ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE |
                           ClimateFeatures.SUPPORT_FAN_MODE |
                           ClimateFeatures.SUPPORT_PRESET_MODE
      }
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity('heat', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useClimate('climate.test'))

      await expect(result.current.setMode('cool')).rejects.toThrow('Service call failed')
      await expect(result.current.setTemperature(25)).rejects.toThrow('Service call failed')
      await expect(result.current.setTemperatureRange(20, 26)).rejects.toThrow('Service call failed')
      await expect(result.current.setFanMode('high')).rejects.toThrow('Service call failed')
      await expect(result.current.setPresetMode('eco')).rejects.toThrow('Service call failed')
    })

    it('should maintain callback references for performance', () => {
      mockUseEntity.mockReturnValue(createMockClimateEntity())

      const { result, rerender } = renderHook(() => useClimate('climate.test'))

      const firstCallbacks = {
        setMode: result.current.setMode,
        setTemperature: result.current.setTemperature,
        setTemperatureRange: result.current.setTemperatureRange,
        setFanMode: result.current.setFanMode,
        setPresetMode: result.current.setPresetMode
      }

      rerender()

      // Callbacks should be the same reference (useCallback working)
      expect(result.current.setMode).toBe(firstCallbacks.setMode)
      expect(result.current.setTemperature).toBe(firstCallbacks.setTemperature)
      expect(result.current.setTemperatureRange).toBe(firstCallbacks.setTemperatureRange)
      expect(result.current.setFanMode).toBe(firstCallbacks.setFanMode)
      expect(result.current.setPresetMode).toBe(firstCallbacks.setPresetMode)
    })
  })

  describe('Integration with useEntity', () => {
    it('should pass entityId to useEntity', () => {
      const entityId = 'climate.living_room'
      
      renderHook(() => useClimate(entityId))

      expect(mockUseEntity).toHaveBeenCalledWith(entityId)
    })

    it('should inherit all base entity properties', () => {
      const mockEntity = createMockClimateEntity('heat', { 
        test: 'value',
        current_temperature: 20.5,
        temperature: 22.0 
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useClimate('climate.test'))

      // Should inherit all base properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)

      // Plus climate-specific properties exist (values can be undefined if not in attributes)
      expect(result.current.currentTemperature).toBe(20.5)
      expect(result.current.targetTemperature).toBe(22.0)
      expect(result.current.mode).toBe('heat') // Should be defined (from state)
      expect(result.current.supportsTargetTemperature).toBeDefined()
      expect(result.current.setMode).toBeDefined()
      expect(result.current.setTemperature).toBeDefined()
      expect(result.current.setTemperatureRange).toBeDefined()
      expect(result.current.setFanMode).toBeDefined()
      expect(result.current.setPresetMode).toBeDefined()
    })

    it('should update when useEntity data changes', () => {
      // Start with basic climate state
      mockUseEntity.mockReturnValue(createMockClimateEntity('off', {}))

      const { result, rerender } = renderHook(() => useClimate('climate.test'))

      expect(result.current.mode).toBe('off')
      expect(result.current.currentTemperature).toBeUndefined()

      // Update to heating with temperature
      mockUseEntity.mockReturnValue(createMockClimateEntity('heat', { 
        hvac_mode: 'heat',
        current_temperature: 21.5,
        temperature: 24.0 
      }))
      rerender()

      expect(result.current.mode).toBe('heat')
      expect(result.current.currentTemperature).toBe(21.5)
      expect(result.current.targetTemperature).toBe(24.0)
    })

    it('should handle callService dependency changes correctly', () => {
      const mockCallService1 = vi.fn()
      const mockCallService2 = vi.fn()
      
      // Initial render with first callService
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity(),
        callService: mockCallService1
      })

      const { result, rerender } = renderHook(() => useClimate('climate.test'))
      const firstSetMode = result.current.setMode

      // Update with new callService reference
      mockUseEntity.mockReturnValue({
        ...createMockClimateEntity(),
        callService: mockCallService2
      })
      rerender()

      // setMode function should have new reference due to callService dependency
      expect(result.current.setMode).not.toBe(firstSetMode)
    })

    it('should handle complex climate configuration', () => {
      const attributes = {
        current_temperature: 22.0,
        temperature: 24.0,
        target_temp_low: 20.0,
        target_temp_high: 26.0,
        current_humidity: 45,
        hvac_mode: 'auto',
        fan_mode: 'medium',
        preset_mode: 'comfort',
        hvac_modes: ['off', 'heat', 'cool', 'auto', 'dry', 'fan_only'],
        fan_modes: ['auto', 'silent', 'low', 'medium', 'high', 'turbo'],
        preset_modes: ['none', 'eco', 'comfort', 'boost', 'sleep'],
        min_temp: 7,
        max_temp: 35,
        supported_features: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE | 
                           ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE |
                           ClimateFeatures.SUPPORT_FAN_MODE |
                           ClimateFeatures.SUPPORT_PRESET_MODE
      }
      mockUseEntity.mockReturnValue(createMockClimateEntity('auto', attributes))

      const { result } = renderHook(() => useClimate('climate.test'))

      // Temperature values
      expect(result.current.currentTemperature).toBe(22.0)
      expect(result.current.targetTemperature).toBe(24.0)
      expect(result.current.targetTempLow).toBe(20.0)
      expect(result.current.targetTempHigh).toBe(26.0)
      expect(result.current.humidity).toBe(45)

      // Modes
      expect(result.current.mode).toBe('auto')
      expect(result.current.fanMode).toBe('medium')
      expect(result.current.presetMode).toBe('comfort')

      // Supported options
      expect(result.current.supportedModes).toHaveLength(6)
      expect(result.current.supportedFanModes).toHaveLength(6)
      expect(result.current.supportedPresetModes).toHaveLength(5)

      // Temperature limits
      expect(result.current.minTemp).toBe(7)
      expect(result.current.maxTemp).toBe(35)

      // Feature support
      expect(result.current.supportsTargetTemperature).toBe(true)
      expect(result.current.supportsTargetTemperatureRange).toBe(true)
      expect(result.current.supportsFanMode).toBe(true)
      expect(result.current.supportsPresetMode).toBe(true)

      // All service methods available
      expect(typeof result.current.setMode).toBe('function')
      expect(typeof result.current.setTemperature).toBe('function')
      expect(typeof result.current.setTemperatureRange).toBe('function')
      expect(typeof result.current.setFanMode).toBe('function')
      expect(typeof result.current.setPresetMode).toBe('function')
    })
  })
})