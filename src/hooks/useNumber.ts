import { useCallback } from 'react'
import { z } from 'zod'
import { useEntity } from './useEntity'
import type { NumberState, NumberAttributes } from '../types'
import { createDomainValidator } from '../utils/entityId'

const validateNumberEntityId = createDomainValidator('number', 'useNumber')

// Service validations
const numberValueSchema = z.number().finite()

export function useNumber(entityId: string): NumberState {
  const normalizedEntityId = validateNumberEntityId(entityId)
  const entity = useEntity<NumberAttributes>(normalizedEntityId)
  const { attributes, state, callService } = entity

  const parsedValue = parseFloat(state)
  const value = Number.isNaN(parsedValue) ? null : parsedValue

  // Extract configuration with defaults
  const min = attributes.min ?? 0
  const max = attributes.max ?? 100
  const step = attributes.step ?? 1
  const mode = attributes.mode ?? 'auto'
  const unit = attributes.unit_of_measurement
  const deviceClass = attributes.device_class

  // Actions
  const setValue = useCallback(
    async (newValue: number) => {
      numberValueSchema.parse(newValue)
      // Clamp value to min/max range
      const clampedValue = Math.max(min, Math.min(max, newValue))
      await callService('number', 'set_value', { value: clampedValue })
    },
    [callService, min, max]
  )

  const increment = useCallback(async () => {
    if (value === null) return
    const newValue = Math.min(max, value + step)
    await setValue(newValue)
  }, [value, step, max, setValue])

  const decrement = useCallback(async () => {
    if (value === null) return
    const newValue = Math.max(min, value - step)
    await setValue(newValue)
  }, [value, step, min, setValue])

  return {
    ...entity,
    value,
    min,
    max,
    step,
    mode,
    unit,
    deviceClass,
    setValue,
    increment,
    decrement,
  }
}
