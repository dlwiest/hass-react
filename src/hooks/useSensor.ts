import { useEntity } from './useEntity'
import type { SensorState, SensorAttributes } from '../types'
import { createDomainValidator } from '../utils/entityId'

const validateSensorEntityId = createDomainValidator('sensor', 'useSensor')

export function useSensor(entityId: string): SensorState {
  const normalizedEntityId = validateSensorEntityId(entityId)
  const entity = useEntity<SensorAttributes>(normalizedEntityId)
  const { attributes, state } = entity

  // Return null for unavailable/unknown states
  if (state === 'unavailable' || state === 'unknown') {
    return {
      ...entity,
      value: null,
      numericValue: null,
      unitOfMeasurement: attributes.unit_of_measurement,
      deviceClass: attributes.device_class,
      stateClass: attributes.state_class,
      icon: attributes.icon,
    }
  }

  // Parse value based on device class
  let value: string | number = state
  if (attributes.device_class === 'temperature' || attributes.device_class === 'humidity' || attributes.device_class === 'pressure') {
    const parsed = parseFloat(state)
    if (!isNaN(parsed)) {
      value = parsed
    }
  }

  // Calculate numericValue for any numeric state
  const numericValue = isNaN(parseFloat(state)) ? null : parseFloat(state)

  return {
    ...entity,
    value,
    numericValue,
    unitOfMeasurement: attributes.unit_of_measurement,
    deviceClass: attributes.device_class,
    stateClass: attributes.state_class,
    icon: attributes.icon,
  }
}
