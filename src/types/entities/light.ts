import type { BaseEntityHook } from '../core'

// Light types
export type LightColorMode = 'onoff' | 'brightness' | 'color_temp' | 'hs' | 'xy' | 'rgb' | 'rgbw' | 'rgbww'

export interface LightAttributes {
  friendly_name?: string
  brightness?: number
  rgb_color?: [number, number, number]
  xy_color?: [number, number]
  hs_color?: [number, number]
  color_temp_kelvin?: number
  min_color_temp_kelvin?: number
  max_color_temp_kelvin?: number
  effect?: string
  effect_list?: string[]
  supported_features?: number
  supported_color_modes?: LightColorMode[]
  color_mode?: LightColorMode
}

export interface LightTurnOnParams {
  brightness?: number
  color_temp_kelvin?: number
  rgb_color?: [number, number, number]
  effect?: string
  transition?: number
}

export interface LightCapabilities {
  supportsBrightness: boolean
  supportsColorTemp: boolean
  supportsRgb: boolean
  supportsEffects: boolean
}

export interface LightState extends BaseEntityHook<LightAttributes>, LightCapabilities {
  isOn: boolean
  brightness: number
  brightnessPercent: number
  colorTemp?: number
  minColorTempKelvin?: number
  maxColorTempKelvin?: number
  rgbColor?: [number, number, number]
  effect?: string
  availableEffects: string[]
  toggle: () => Promise<void>
  turnOn: (params?: LightTurnOnParams) => Promise<void>
  turnOff: () => Promise<void>
  setBrightness: (brightness: number) => Promise<void>
  setColorTemp: (kelvin: number) => Promise<void>
  setRgbColor: (rgb: [number, number, number]) => Promise<void>
  setEffect: (effect: string | null) => Promise<void>
}

// Feature flags for supported features
export const LightFeatures = {
  SUPPORT_BRIGHTNESS: 1,
  SUPPORT_COLOR_TEMP: 2,
  SUPPORT_EFFECT: 4,
  SUPPORT_FLASH: 8,
  SUPPORT_COLOR: 16,
  SUPPORT_TRANSITION: 32,
  SUPPORT_WHITE_VALUE: 128,
} as const
