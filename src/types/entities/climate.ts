import type { BaseEntityHook } from '../core'

// Climate types
export interface ClimateAttributes {
  friendly_name?: string
  temperature?: number
  current_temperature?: number
  temperature_unit?: string
  target_temp_high?: number
  target_temp_low?: number
  humidity?: number
  current_humidity?: number
  hvac_modes?: string[]
  hvac_mode?: string
  fan_modes?: string[]
  fan_mode?: string
  preset_modes?: string[]
  preset_mode?: string
  min_temp?: number
  max_temp?: number
  supported_features?: number
}

export interface ClimateState extends BaseEntityHook<ClimateAttributes> {
  currentTemperature?: number
  targetTemperature?: number
  targetTempHigh?: number
  targetTempLow?: number
  humidity?: number
  mode: string
  fanMode?: string
  presetMode?: string
  supportedModes: string[]
  supportedFanModes: string[]
  supportedPresetModes: string[]
  minTemp: number
  maxTemp: number
  supportsTargetTemperature: boolean
  supportsTargetTemperatureRange: boolean
  supportsFanMode: boolean
  supportsPresetMode: boolean
  setMode: (mode: string) => Promise<void>
  setTemperature: (temp: number) => Promise<void>
  setTemperatureRange: (low: number, high: number) => Promise<void>
  setFanMode: (mode: string) => Promise<void>
  setPresetMode: (preset: string) => Promise<void>
}

export const ClimateFeatures = {
  SUPPORT_TARGET_TEMPERATURE: 1,
  SUPPORT_TARGET_TEMPERATURE_RANGE: 2,
  SUPPORT_TARGET_HUMIDITY: 4,
  SUPPORT_FAN_MODE: 8,
  SUPPORT_PRESET_MODE: 16,
  SUPPORT_SWING_MODE: 32,
  SUPPORT_AUX_HEAT: 64,
} as const
