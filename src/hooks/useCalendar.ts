import { useCallback } from 'react'
import { z } from 'zod'
import { useEntity } from './useEntity'
import { createDomainValidator } from '../utils/entityId'
import { checkFeatures } from '../utils/features'
import { FeatureNotSupportedError } from '../utils/errors'
import type { CalendarState, CalendarAttributes, CalendarEvent } from '../types'
import { CalendarFeatures } from '../types'

const validateCalendarEntityId = createDomainValidator('calendar', 'useCalendar')
interface CalendarEventsResponse {
  response?: Record<string, { events?: CalendarEvent[] }>
}


const eventSchema = z.object({
  start: z.string(),
  end: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  rrule: z.string().optional(),
})

const dateRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
})

export function useCalendar(entityId: string): CalendarState {
  const normalizedEntityId = validateCalendarEntityId(entityId)
  const entity = useEntity<CalendarAttributes>(normalizedEntityId)
  const { attributes, state, callService, callServiceWithResponse } = entity

  const features = checkFeatures(attributes.supported_features, {
    create: CalendarFeatures.CREATE_EVENT,
    delete: CalendarFeatures.DELETE_EVENT,
    update: CalendarFeatures.UPDATE_EVENT,
  })

  const {
    create: supportsCreate,
    delete: supportsDelete,
    update: supportsUpdate,
  } = features

  // Extract current/next event info from attributes
  const message = attributes.message ?? null
  const isAllDay = attributes.all_day ?? false
  const startTime = attributes.start_time ?? null
  const endTime = attributes.end_time ?? null
  const location = attributes.location ?? null
  const description = attributes.description ?? null

  const currentEvent: CalendarEvent | null = message
    ? {
        start: startTime ?? '',
        end: endTime ?? '',
        summary: message,
        description: description ?? undefined,
        location: location ?? undefined,
      }
    : null

  const hasActiveEvent = state === 'on'

  // Get events within a date range
  const getEvents = useCallback(
    async (startDate: string, endDate: string): Promise<CalendarEvent[]> => {
      dateRangeSchema.parse({ start: startDate, end: endDate })

      const response = await callServiceWithResponse<CalendarEventsResponse>('calendar', 'get_events', {
        entity_id: normalizedEntityId,
        start_date_time: startDate,
        end_date_time: endDate,
      })

      return response?.response?.[normalizedEntityId]?.events ?? []
    },
    [callServiceWithResponse, normalizedEntityId]
  )

  // Create a new calendar event
  const createEvent = useCallback(
    async (event: Omit<CalendarEvent, 'uid'>) => {
      if (!supportsCreate) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'create event')
      }

      eventSchema.parse(event)

      await callService('calendar', 'create_event', {
        entity_id: normalizedEntityId,
        start_date_time: event.start,
        end_date_time: event.end,
        summary: event.summary,
        description: event.description,
        location: event.location,
        rrule: event.rrule,
      })
    },
    [callService, normalizedEntityId, supportsCreate]
  )

  // Delete a calendar event
  const deleteEvent = useCallback(
    async (
      uid: string,
      recurrenceRange?: 'THIS_AND_FUTURE' | 'THIS' | 'ALL'
    ) => {
      if (!supportsDelete) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'delete event')
      }

      z.string().parse(uid)

      await callService('calendar', 'delete_event', {
        entity_id: normalizedEntityId,
        uid,
        recurrence_range: recurrenceRange,
      })
    },
    [callService, normalizedEntityId, supportsDelete]
  )

  // Update a calendar event
  const updateEvent = useCallback(
    async (
      uid: string,
      event: Partial<CalendarEvent>,
      recurrenceRange?: 'THIS_AND_FUTURE' | 'THIS' | 'ALL'
    ) => {
      if (!supportsUpdate) {
        throw new FeatureNotSupportedError(normalizedEntityId, 'update event')
      }

      z.string().parse(uid)

      await callService('calendar', 'update_event', {
        entity_id: normalizedEntityId,
        uid,
        start_date_time: event.start,
        end_date_time: event.end,
        summary: event.summary,
        description: event.description,
        location: event.location,
        rrule: event.rrule,
        recurrence_range: recurrenceRange,
      })
    },
    [callService, normalizedEntityId, supportsUpdate]
  )

  return {
    ...entity,
    currentEvent,
    message,
    isAllDay,
    startTime,
    endTime,
    location,
    description,
    hasActiveEvent,
    supportsCreate,
    supportsDelete,
    supportsUpdate,
    createEvent,
    deleteEvent,
    updateEvent,
    getEvents,
  }
}
