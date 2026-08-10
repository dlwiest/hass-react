import { useCallback } from 'react'
import { z } from 'zod'
import { useEntity } from './useEntity'
import { createDomainValidator } from '../utils/entityId'
import { checkFeatures } from '../utils/features'
import { FeatureNotSupportedError } from '../utils/errors'
import type { VacuumState, VacuumAttributes } from '../types'
import { VacuumFeatures } from '../types'

const validateVacuumEntityId = createDomainValidator('vacuum', 'useVacuum')

const fanSpeedSchema = z.string().min(1)
const commandSchema = z.string().min(1)
const paramsSchema = z.record(z.any()).optional()

const EMPTY_FAN_SPEEDS: string[] = []

export function useVacuum(entityId: string): VacuumState {
  const normalizedEntityId = validateVacuumEntityId(entityId)
  const entity = useEntity<VacuumAttributes>(normalizedEntityId)
  const { attributes, state, callService } = entity

  const features = checkFeatures(attributes.supported_features, {
    turnOn: VacuumFeatures.SUPPORT_TURN_ON,
    turnOff: VacuumFeatures.SUPPORT_TURN_OFF,
    pause: VacuumFeatures.SUPPORT_PAUSE,
    stop: VacuumFeatures.SUPPORT_STOP,
    returnHome: VacuumFeatures.SUPPORT_RETURN_HOME,
    fanSpeed: VacuumFeatures.SUPPORT_FAN_SPEED,
    locate: VacuumFeatures.SUPPORT_LOCATE,
    cleanSpot: VacuumFeatures.SUPPORT_CLEAN_SPOT,
    start: VacuumFeatures.SUPPORT_START
  })

  const {
    turnOn: supportsTurnOn,
    turnOff: supportsTurnOff,
    pause: supportsPause,
    stop: supportsStop,
    returnHome: supportsReturnHome,
    fanSpeed: supportsFanSpeed,
    locate: supportsLocate,
    cleanSpot: supportsCleanSpot,
    start: supportsStart
  } = features

  // State properties
  const batteryLevel = attributes.battery_level ?? null
  const fanSpeed = attributes.fan_speed ?? null
  const status = attributes.status ?? null
  const availableFanSpeeds = attributes.fan_speed_list || EMPTY_FAN_SPEEDS

  // State booleans based on state string
  const isCharging = status?.toLowerCase().includes('charging') || false
  const isDocked = state === 'docked'
  const isCleaning = state === 'cleaning' || state === 'on'
  const isReturning = state === 'returning'
  const isIdle = state === 'idle' || state === 'off'
  const isError = state === 'error'

  // Control methods
  const turnOn = useCallback(async () => {
    if (!supportsTurnOn) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'turn on')
    }
    await callService('vacuum', 'turn_on')
  }, [callService, normalizedEntityId, supportsTurnOn])

  const turnOff = useCallback(async () => {
    if (!supportsTurnOff) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'turn off')
    }
    await callService('vacuum', 'turn_off')
  }, [callService, normalizedEntityId, supportsTurnOff])

  const start = useCallback(async () => {
    if (!supportsStart) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'start')
    }
    await callService('vacuum', 'start')
  }, [callService, normalizedEntityId, supportsStart])

  const pause = useCallback(async () => {
    if (!supportsPause) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'pause')
    }
    await callService('vacuum', 'pause')
  }, [callService, normalizedEntityId, supportsPause])

  const stop = useCallback(async () => {
    if (!supportsStop) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'stop')
    }
    await callService('vacuum', 'stop')
  }, [callService, normalizedEntityId, supportsStop])

  const returnToBase = useCallback(async () => {
    if (!supportsReturnHome) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'return to base')
    }
    await callService('vacuum', 'return_to_base')
  }, [callService, normalizedEntityId, supportsReturnHome])

  const locate = useCallback(async () => {
    if (!supportsLocate) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'locate')
    }
    await callService('vacuum', 'locate')
  }, [callService, normalizedEntityId, supportsLocate])

  const cleanSpot = useCallback(async () => {
    if (!supportsCleanSpot) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'spot cleaning')
    }
    await callService('vacuum', 'clean_spot')
  }, [callService, normalizedEntityId, supportsCleanSpot])

  const setFanSpeed = useCallback(
    async (speed: string) => {
      if (!supportsFanSpeed) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'fan speed control')
      }

      fanSpeedSchema.parse(speed)

      if (availableFanSpeeds.length > 0 && !availableFanSpeeds.includes(speed)) {
        throw new Error(
          `Fan speed "${speed}" is not available for vacuum "${normalizedEntityId}". Available speeds: ${availableFanSpeeds.join(', ')}`
        )
      }

      await callService('vacuum', 'set_fan_speed', { fan_speed: speed })
    },
    [callService, normalizedEntityId, supportsFanSpeed, availableFanSpeeds]
  )

  const sendCommand = useCallback(
    async (command: string, params?: Record<string, unknown>) => {
      commandSchema.parse(command)
      paramsSchema.parse(params)

      await callService('vacuum', 'send_command', {
        command,
        params
      })
    },
    [callService]
  )

  return {
    ...entity,
    batteryLevel,
    fanSpeed,
    status,
    availableFanSpeeds,
    isCharging,
    isDocked,
    isCleaning,
    isReturning,
    isIdle,
    isError,
    supportsTurnOn,
    supportsTurnOff,
    supportsPause,
    supportsStop,
    supportsReturnHome,
    supportsFanSpeed,
    supportsLocate,
    supportsCleanSpot,
    supportsStart,
    turnOn,
    turnOff,
    start,
    pause,
    stop,
    returnToBase,
    locate,
    cleanSpot,
    setFanSpeed,
    sendCommand
  }
}
