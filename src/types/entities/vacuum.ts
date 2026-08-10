import type { BaseEntityHook } from '../core'

// Vacuum types
export const VacuumFeatures = {
  SUPPORT_TURN_ON: 1,
  SUPPORT_TURN_OFF: 2,
  SUPPORT_PAUSE: 4,
  SUPPORT_STOP: 8,
  SUPPORT_RETURN_HOME: 16,
  SUPPORT_FAN_SPEED: 32,
  SUPPORT_BATTERY: 64,
  SUPPORT_STATUS: 128,
  SUPPORT_SEND_COMMAND: 256,
  SUPPORT_LOCATE: 512,
  SUPPORT_CLEAN_SPOT: 1024,
  SUPPORT_MAP: 2048,
  SUPPORT_STATE: 4096,
  SUPPORT_START: 8192
} as const

export interface VacuumAttributes {
  friendly_name?: string
  battery_level?: number
  battery_icon?: string
  fan_speed?: string
  fan_speed_list?: string[]
  status?: string
  supported_features?: number
}

export interface VacuumState extends BaseEntityHook<VacuumAttributes> {
  batteryLevel: number | null
  fanSpeed: string | null
  status: string | null
  availableFanSpeeds: string[]
  isCharging: boolean
  isDocked: boolean
  isCleaning: boolean
  isReturning: boolean
  isIdle: boolean
  isError: boolean
  supportsTurnOn: boolean
  supportsTurnOff: boolean
  supportsPause: boolean
  supportsStop: boolean
  supportsReturnHome: boolean
  supportsFanSpeed: boolean
  supportsLocate: boolean
  supportsCleanSpot: boolean
  supportsStart: boolean
  turnOn: () => Promise<void>
  turnOff: () => Promise<void>
  start: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  returnToBase: () => Promise<void>
  locate: () => Promise<void>
  cleanSpot: () => Promise<void>
  setFanSpeed: (speed: string) => Promise<void>
  sendCommand: (command: string, params?: Record<string, unknown>) => Promise<void>
}
