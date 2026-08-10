import type { BaseEntityHook } from '../core'

// Alarm Control Panel types
export interface AlarmControlPanelAttributes {
  friendly_name?: string
  supported_features?: number
  code_format?: string
  changed_by?: string | null
  code_arm_required?: boolean
}

export interface AlarmControlPanelState extends BaseEntityHook<AlarmControlPanelAttributes> {
  isDisarmed: boolean
  isArmedHome: boolean
  isArmedAway: boolean
  isArmedNight: boolean
  isArmedVacation: boolean
  isArmedCustomBypass: boolean
  isPending: boolean
  isArming: boolean
  isDisarming: boolean
  isTriggered: boolean
  changedBy?: string | null
  codeFormat?: string
  supportsArmHome: boolean
  supportsArmAway: boolean
  supportsArmNight: boolean
  supportsArmVacation: boolean
  supportsArmCustomBypass: boolean
  supportsTrigger: boolean
  disarm: (code?: string) => Promise<void>
  armHome: (code?: string) => Promise<void>
  armAway: (code?: string) => Promise<void>
  armNight: (code?: string) => Promise<void>
  armVacation: (code?: string) => Promise<void>
  armCustomBypass: (code?: string) => Promise<void>
  trigger: () => Promise<void>
}

export const AlarmControlPanelFeatures = {
  SUPPORT_ARM_HOME: 1,
  SUPPORT_ARM_AWAY: 2,
  SUPPORT_ARM_NIGHT: 4,
  SUPPORT_ARM_VACATION: 32,
  SUPPORT_ARM_CUSTOM_BYPASS: 16,
  SUPPORT_TRIGGER: 8,
} as const
