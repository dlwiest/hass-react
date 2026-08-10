import { useEffect, useRef } from 'react'
import { useEntity } from './useEntity'
import { useHAConnection } from '../providers/HAProvider'
import type { DateTimeState, DateTimeAttributes } from '../types'

const DATETIME_ENTITY_ID = 'sensor.date_time_iso'

export function useDateTime(): DateTimeState {
  const entity = useEntity<DateTimeAttributes>(DATETIME_ENTITY_ID)
  const { connected } = useHAConnection()
  const { state } = entity
  const hasLoggedWarning = useRef(false)

  // Log warning once if sensor is unavailable (but only after connection is established and a delay)
  useEffect(() => {
    if (!connected || (state !== 'unavailable' && state !== 'unknown') || hasLoggedWarning.current) {
      return
    }

    // Wait 3 seconds before showing warning to allow time for initial state updates
    // If state becomes available before this fires, the cleanup will cancel this timeout
    const timeoutId = setTimeout(() => {
      if (!hasLoggedWarning.current) {
        console.warn(
          'Home Assistant Date & Time (ISO) sensor (sensor.date_time_iso) is unavailable. ' +
          'To enable it: Go to Settings → Devices & Services → Integrations → Time & Date → Add Service → Select "Date & Time (ISO)" → Submit. ' +
          'See https://hass-react.com/docs/entities/datetime for more information.'
        )
        hasLoggedWarning.current = true
      }
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [connected, state])

  // Return null for unavailable/unknown states
  if (state === 'unavailable' || state === 'unknown') {
    return {
      ...entity,
      date: null,
      isAvailable: false,
    }
  }

  // Parse ISO 8601 date string into Date object
  let date: Date | null = null
  const parsed = new Date(state)
  // Validate that the date is valid
  if (!isNaN(parsed.getTime())) {
    date = parsed
  }

  return {
    ...entity,
    date,
    isAvailable: date !== null,
  }
}
