import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCalendar } from '../useCalendar'
import { useEntity } from '../useEntity'
import { CalendarFeatures } from '../../types'
import { FeatureNotSupportedError } from '../../utils/errors'

vi.mock('../useEntity')

const createMockCalendarEntity = (
  state: string = 'off',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'calendar.test',
  state,
  attributes,
  lastChanged: new Date(),
  lastUpdated: new Date(),
  isUnavailable: state === 'unavailable',
  isConnected: true,
  callService: vi.fn(),
  callServiceWithResponse: vi.fn(),
  refresh: vi.fn()
})

describe('useCalendar', () => {
  const mockUseEntity = useEntity as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEntity.mockReturnValue(createMockCalendarEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Entity ID Validation', () => {
    it('should warn when using wrong domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useCalendar('light.test'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('useCalendar: Entity "light.test" has domain "light" but expects "calendar" domain')
      )

      consoleSpy.mockRestore()
    })

    it('should accept calendar domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useCalendar('calendar.test'))

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Basic Properties', () => {
    it('should return basic entity properties', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          friendly_name: 'Test Calendar'
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.entityId).toBe('calendar.test')
      expect(result.current.state).toBe('off')
      expect(result.current.isConnected).toBe(true)
    })

    it('should extract message from attributes', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('on', {
          message: 'Team Meeting',
          start_time: '2024-01-15T10:00:00',
          end_time: '2024-01-15T11:00:00'
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.message).toBe('Team Meeting')
      expect(result.current.startTime).toBe('2024-01-15T10:00:00')
      expect(result.current.endTime).toBe('2024-01-15T11:00:00')
    })

    it('should handle all_day events', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('on', {
          message: 'Holiday',
          all_day: true
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.isAllDay).toBe(true)
    })

    it('should handle location and description', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('on', {
          message: 'Conference',
          location: 'Building A, Room 101',
          description: 'Annual tech conference'
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.location).toBe('Building A, Room 101')
      expect(result.current.description).toBe('Annual tech conference')
    })
  })

  describe('Current Event', () => {
    it('should create currentEvent object when event data exists', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('on', {
          message: 'Lunch Meeting',
          start_time: '2024-01-15T12:00:00',
          end_time: '2024-01-15T13:00:00',
          location: 'Cafe',
          description: 'Team lunch'
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.currentEvent).toEqual({
        start: '2024-01-15T12:00:00',
        end: '2024-01-15T13:00:00',
        summary: 'Lunch Meeting',
        location: 'Cafe',
        description: 'Team lunch'
      })
    })

    it('should return null currentEvent when no message', () => {
      mockUseEntity.mockReturnValue(createMockCalendarEntity('off'))

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.currentEvent).toBeNull()
    })
  })

  describe('Active Event State', () => {
    it('should detect active event when state is on', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('on', {
          message: 'Current Event'
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.hasActiveEvent).toBe(true)
    })

    it('should detect no active event when state is off', () => {
      mockUseEntity.mockReturnValue(createMockCalendarEntity('off'))

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.hasActiveEvent).toBe(false)
    })
  })

  describe('Feature Detection', () => {
    it('should detect all features when supported', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          supported_features:
            CalendarFeatures.CREATE_EVENT |
            CalendarFeatures.DELETE_EVENT |
            CalendarFeatures.UPDATE_EVENT
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.supportsCreate).toBe(true)
      expect(result.current.supportsDelete).toBe(true)
      expect(result.current.supportsUpdate).toBe(true)
    })

    it('should detect only create feature', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.CREATE_EVENT
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.supportsCreate).toBe(true)
      expect(result.current.supportsDelete).toBe(false)
      expect(result.current.supportsUpdate).toBe(false)
    })

    it('should handle no features', () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          supported_features: 0
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      expect(result.current.supportsCreate).toBe(false)
      expect(result.current.supportsDelete).toBe(false)
      expect(result.current.supportsUpdate).toBe(false)
    })
  })

  describe('Get Events', () => {
    it('should fetch events in date range', async () => {
      const mockEvents = [
        {
          start: '2024-01-15T10:00:00',
          end: '2024-01-15T11:00:00',
          summary: 'Event 1'
        },
        {
          start: '2024-01-16T14:00:00',
          end: '2024-01-16T15:00:00',
          summary: 'Event 2'
        }
      ]

      // HA entity-service responses are keyed by entity_id:
      // https://github.com/home-assistant/core/blob/dev/homeassistant/components/calendar/__init__.py
      const mockCallServiceWithResponse = vi.fn().mockResolvedValue({
        context: { id: 'calendar-context' },
        response: {
          'calendar.test': { events: mockEvents }
        }
      })

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity(),
        callServiceWithResponse: mockCallServiceWithResponse
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      const events = await result.current.getEvents(
        '2024-01-15T00:00:00',
        '2024-01-16T23:59:59'
      )

      expect(mockCallServiceWithResponse).toHaveBeenCalledWith(
        'calendar',
        'get_events',
        {
          entity_id: 'calendar.test',
          start_date_time: '2024-01-15T00:00:00',
          end_date_time: '2024-01-16T23:59:59'
        }
      )
      expect(events).toEqual(mockEvents)
    })

    it('should return empty array when no events', async () => {
      const mockCallServiceWithResponse = vi.fn().mockResolvedValue({
        context: { id: 'calendar-context' },
        response: {
          'calendar.test': { events: [] }
        }
      })

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity(),
        callServiceWithResponse: mockCallServiceWithResponse
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      const events = await result.current.getEvents(
        '2024-01-15T00:00:00',
        '2024-01-15T23:59:59'
      )

      expect(events).toEqual([])
    })
  })

  describe('Create Event', () => {
    it('should create event when feature is supported', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.CREATE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.createEvent({
          start: '2024-01-15T10:00:00',
          end: '2024-01-15T11:00:00',
          summary: 'New Meeting',
          description: 'Important meeting',
          location: 'Conference Room'
        })
      })

      expect(mockCallService).toHaveBeenCalledWith('calendar', 'create_event', {
        entity_id: 'calendar.test',
        start_date_time: '2024-01-15T10:00:00',
        end_date_time: '2024-01-15T11:00:00',
        summary: 'New Meeting',
        description: 'Important meeting',
        location: 'Conference Room',
        rrule: undefined
      })
    })

    it('should throw error when create not supported', async () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          supported_features: 0
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await expect(
        result.current.createEvent({
          start: '2024-01-15T10:00:00',
          end: '2024-01-15T11:00:00',
          summary: 'Test Event'
        })
      ).rejects.toThrow(FeatureNotSupportedError)
    })

    it('should create recurring event with rrule', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.CREATE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.createEvent({
          start: '2024-01-15T10:00:00',
          end: '2024-01-15T11:00:00',
          summary: 'Daily Standup',
          rrule: 'FREQ=DAILY'
        })
      })

      expect(mockCallService).toHaveBeenCalledWith(
        'calendar',
        'create_event',
        expect.objectContaining({
          rrule: 'FREQ=DAILY'
        })
      )
    })
  })

  describe('Delete Event', () => {
    it('should delete event when feature is supported', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.DELETE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.deleteEvent('event-uid-123')
      })

      expect(mockCallService).toHaveBeenCalledWith('calendar', 'delete_event', {
        entity_id: 'calendar.test',
        uid: 'event-uid-123',
        recurrence_range: undefined
      })
    })

    it('should throw error when delete not supported', async () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          supported_features: 0
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await expect(
        result.current.deleteEvent('event-uid-123')
      ).rejects.toThrow(FeatureNotSupportedError)
    })

    it('should delete with recurrence range', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.DELETE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.deleteEvent('event-uid-123', 'THIS_AND_FUTURE')
      })

      expect(mockCallService).toHaveBeenCalledWith(
        'calendar',
        'delete_event',
        expect.objectContaining({
          recurrence_range: 'THIS_AND_FUTURE'
        })
      )
    })
  })

  describe('Update Event', () => {
    it('should update event when feature is supported', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.UPDATE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.updateEvent('event-uid-123', {
          summary: 'Updated Meeting',
          start: '2024-01-15T11:00:00',
          end: '2024-01-15T12:00:00'
        })
      })

      expect(mockCallService).toHaveBeenCalledWith('calendar', 'update_event', {
        entity_id: 'calendar.test',
        uid: 'event-uid-123',
        start_date_time: '2024-01-15T11:00:00',
        end_date_time: '2024-01-15T12:00:00',
        summary: 'Updated Meeting',
        description: undefined,
        location: undefined,
        rrule: undefined,
        recurrence_range: undefined
      })
    })

    it('should throw error when update not supported', async () => {
      mockUseEntity.mockReturnValue(
        createMockCalendarEntity('off', {
          supported_features: 0
        })
      )

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await expect(
        result.current.updateEvent('event-uid-123', {
          summary: 'Updated'
        })
      ).rejects.toThrow(FeatureNotSupportedError)
    })

    it('should update with recurrence range', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.UPDATE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.updateEvent(
          'event-uid-123',
          { summary: 'Updated' },
          'THIS'
        )
      })

      expect(mockCallService).toHaveBeenCalledWith(
        'calendar',
        'update_event',
        expect.objectContaining({
          recurrence_range: 'THIS'
        })
      )
    })

    it('should allow partial updates', async () => {
      const mockCallService = vi.fn().mockResolvedValue(undefined)

      mockUseEntity.mockReturnValue({
        ...createMockCalendarEntity('off', {
          supported_features: CalendarFeatures.UPDATE_EVENT
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCalendar('calendar.test'))

      await act(async () => {
        await result.current.updateEvent('event-uid-123', {
          location: 'New Location'
        })
      })

      expect(mockCallService).toHaveBeenCalledWith(
        'calendar',
        'update_event',
        expect.objectContaining({
          location: 'New Location',
          summary: undefined,
          start_date_time: undefined,
          end_date_time: undefined
        })
      )
    })
  })
})
