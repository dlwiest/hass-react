import { useCallback } from 'react'
import { z } from 'zod'
import { useEntity } from './useEntity'
import type { ClimateState, ClimateAttributes } from '../types'
import { ClimateFeatures } from '../types'
import { createDomainValidator } from '../utils/entityId'
import { checkFeatures } from '../utils/features'
import { FeatureNotSupportedError } from '../utils/errors'

const validateClimateEntityId = createDomainValidator('climate', 'useClimate')

// Service validations
const temperatureSchema = z.number()
const hvacModeSchema = z.string().min(1)
const fanModeSchema = z.string().min(1)
const presetModeSchema = z.string().min(1)

export function useClimate(entityId: string): ClimateState {
  const normalizedEntityId = validateClimateEntityId(entityId)
  const entity = useEntity<ClimateAttributes>(normalizedEntityId)
  const { attributes, state, callService } = entity

  // Extract feature support
  const features = checkFeatures(attributes.supported_features, {
    targetTemperature: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE,
    targetTemperatureRange: ClimateFeatures.SUPPORT_TARGET_TEMPERATURE_RANGE,
    fanMode: ClimateFeatures.SUPPORT_FAN_MODE,
    presetMode: ClimateFeatures.SUPPORT_PRESET_MODE
  })
  
  const { targetTemperature: supportsTargetTemperature, targetTemperatureRange: supportsTargetTemperatureRange, fanMode: supportsFanMode, presetMode: supportsPresetMode } = features

  // Actions
  const setMode = useCallback(
    async (mode: string) => {
      hvacModeSchema.parse(mode)
      await callService('climate', 'set_hvac_mode', { hvac_mode: mode })
    },
    [callService]
  )

  const setTemperature = useCallback(
    async (temp: number) => {
      if (!supportsTargetTemperature) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'target temperature control')
      }
      temperatureSchema.parse(temp)
      await callService('climate', 'set_temperature', { temperature: temp })
    },
    [callService, supportsTargetTemperature, normalizedEntityId]
  )

  const setTemperatureRange = useCallback(
    async (low: number, high: number) => {
      if (!supportsTargetTemperatureRange) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'target temperature range control')
      }
      temperatureSchema.parse(low)
      temperatureSchema.parse(high)
      await callService('climate', 'set_temperature', {
        target_temp_low: low,
        target_temp_high: high,
      })
    },
    [callService, supportsTargetTemperatureRange, normalizedEntityId]
  )

  const setFanMode = useCallback(
    async (mode: string) => {
      if (!supportsFanMode) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'fan mode control')
      }
      fanModeSchema.parse(mode)
      await callService('climate', 'set_fan_mode', { fan_mode: mode })
    },
    [callService, supportsFanMode, normalizedEntityId]
  )

  const setPresetMode = useCallback(
    async (preset: string) => {
      if (!supportsPresetMode) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'preset mode control')
      }
      presetModeSchema.parse(preset)
      await callService('climate', 'set_preset_mode', { preset_mode: preset })
    },
    [callService, supportsPresetMode, normalizedEntityId]
  )

  // HA reports °C or °F; use metric defaults unless Fahrenheit is explicit.
  const isFahrenheit = attributes.temperature_unit === '°F' || attributes.temperature_unit === 'F'
  const defaultMinTemp = isFahrenheit ? 45 : 7
  const defaultMaxTemp = isFahrenheit ? 95 : 35

  return {
    ...entity,
    currentTemperature: attributes.current_temperature,
    targetTemperature: attributes.temperature,
    targetTempHigh: attributes.target_temp_high,
    targetTempLow: attributes.target_temp_low,
    humidity: attributes.current_humidity,
    mode: state,
    fanMode: attributes.fan_mode,
    presetMode: attributes.preset_mode,
    supportedModes: attributes.hvac_modes || [],
    supportedFanModes: attributes.fan_modes || [],
    supportedPresetModes: attributes.preset_modes || [],
    minTemp: attributes.min_temp ?? defaultMinTemp,
    maxTemp: attributes.max_temp ?? defaultMaxTemp,
    supportsTargetTemperature,
    supportsTargetTemperatureRange,
    supportsFanMode,
    supportsPresetMode,
    setMode,
    setTemperature,
    setTemperatureRange,
    setFanMode,
    setPresetMode,
  }
}
