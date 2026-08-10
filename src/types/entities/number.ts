import type { BaseEntityHook } from '../core'

// Number entity types
export interface NumberAttributes {
  friendly_name?: string
  min?: number
  max?: number
  step?: number
  mode?: 'auto' | 'box' | 'slider'
  unit_of_measurement?: string
  device_class?: string
}

export interface NumberState extends BaseEntityHook<NumberAttributes> {
  value: number | null
  min: number
  max: number
  step: number
  mode: 'auto' | 'box' | 'slider'
  unit?: string
  deviceClass?: string
  setValue: (value: number) => Promise<void>
  increment: () => Promise<void>
  decrement: () => Promise<void>
}
