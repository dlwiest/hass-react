---
sidebar_position: 8
---

# Calendar

Read events from Home Assistant calendars and create new ones. Update and delete are wired up too, but they're waiting on Home Assistant (see the warning below).

:::warning Home Assistant Limitation
Home Assistant only ships `calendar.create_event` and `calendar.get_events` right now (as of November 2025). There's no `calendar.delete_event` or `calendar.update_event` service yet. The `deleteEvent` and `updateEvent` methods here follow the planned API shape, so they'll start working as soon as Home Assistant adds the services. Until then, events can be created and read but not changed or removed.
:::

## Quick Example

```tsx
// Component approach
<Calendar entityId="calendar.personal">
  {({ hasActiveEvent, currentEvent, startTime, endTime, getEvents, createEvent }) => (
    <div>
      <h3>Personal Calendar</h3>
      {hasActiveEvent && currentEvent && (
        <div>
          <p>Current Event: {currentEvent.summary}</p>
          {startTime && <p>Started: {new Date(startTime).toLocaleString()}</p>}
          {endTime && <p>Ends: {new Date(endTime).toLocaleString()}</p>}
        </div>
      )}
      <button onClick={async () => {
        const events = await getEvents(
          new Date().toISOString(),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        )
        console.log('Upcoming events:', events)
      }}>
        Load Events
      </button>
    </div>
  )}
</Calendar>

// Hook approach
const calendar = useCalendar('calendar.personal')
<div>
  <h3>Personal Calendar</h3>
  {calendar.hasActiveEvent && calendar.currentEvent && (
    <div>
      <p>Current Event: {calendar.currentEvent.summary}</p>
      {calendar.startTime && <p>Started: {new Date(calendar.startTime).toLocaleString()}</p>}
      {calendar.endTime && <p>Ends: {new Date(calendar.endTime).toLocaleString()}</p>}
    </div>
  )}
</div>
```

## Component API

### Basic Usage

```tsx
import { Calendar } from 'hass-react'

<Calendar entityId="calendar.personal">
  {(calendarProps) => (
    // Your UI here
  )}
</Calendar>
```

### Render Props

The Calendar component provides these props to your render function:

#### State Properties
- **`hasActiveEvent`** (`boolean`) - Whether there's a current or upcoming event
- **`currentEvent`** (`CalendarEvent | null`) - The current or next event
- **`message`** (`string | null`) - Event summary/title (shorthand for currentEvent.summary)
- **`startTime`** (`string | null`) - Event start time in ISO 8601 format
- **`endTime`** (`string | null`) - Event end time in ISO 8601 format
- **`location`** (`string | null`) - Event location
- **`description`** (`string | null`) - Event description
- **`isAllDay`** (`boolean`) - Whether the current event is all-day

#### Support Properties
- **`supportsCreate`** (`boolean`) - Calendar supports creating events
- **`supportsUpdate`** (`boolean`) - Calendar supports updating events
- **`supportsDelete`** (`boolean`) - Calendar supports deleting events

#### Control Methods
- **`getEvents(start: string, end: string): Promise<CalendarEvent[]>`** - Fetch events in date range (ISO 8601 format)
- **`createEvent(event: Omit<CalendarEvent, 'uid'>): Promise<void>`** - Create a new calendar event
- **`updateEvent(uid: string, event: Partial<CalendarEvent>, recurrenceRange?: 'THIS_AND_FUTURE' | 'THIS' | 'ALL'): Promise<void>`** - Update an existing event
- **`deleteEvent(uid: string, recurrenceRange?: 'THIS_AND_FUTURE' | 'THIS' | 'ALL'): Promise<void>`** - Delete an event

#### Calendar Event Structure
```tsx
interface CalendarEvent {
  start: string           // Start time (ISO 8601 datetime or date)
  end: string             // End time (ISO 8601 datetime or date)
  summary: string         // Event title/summary
  uid?: string            // Unique identifier
  description?: string    // Detailed description
  location?: string       // Event location
  rrule?: string         // Recurrence rule (RFC 5545)
}
```

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value ('on' for active event, 'off' otherwise)
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useCalendar } from 'hass-react'

function MyComponent() {
  const calendar = useCalendar('calendar.personal')

  // All the same properties as component render props
  return <div>{calendar.hasActiveEvent ? 'Event in progress' : 'No event'}</div>
}
```

The `useCalendar` hook returns the same properties and methods the component passes to its render function.

## List All Calendars

Use the `useCalendars` hook to retrieve all available calendar entities:

```tsx
import { useCalendars } from 'hass-react'

function CalendarList() {
  const calendars = useCalendars()

  return (
    <div>
      <h2>Available Calendars ({calendars.length})</h2>
      {calendars.map(calendar => (
        <div key={calendar.entity_id}>
          {calendar.attributes.friendly_name || calendar.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns plain entity objects, one per calendar in your Home Assistant instance.

## Examples

### Display Current Event

```tsx
<Calendar entityId="calendar.work">
  {({ hasActiveEvent, currentEvent, startTime, endTime, location, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>

      {hasActiveEvent && currentEvent ? (
        <div>
          <h4>{currentEvent.summary}</h4>
          {startTime && <p>Start: {new Date(startTime).toLocaleString()}</p>}
          {endTime && <p>End: {new Date(endTime).toLocaleString()}</p>}
          {location && <p>Location: {location}</p>}
          {currentEvent.description && <p>{currentEvent.description}</p>}
        </div>
      ) : (
        <p>No upcoming events</p>
      )}
    </div>
  )}
</Calendar>
```

### List Upcoming Events

```tsx
<Calendar entityId="calendar.personal">
  {({ getEvents, attributes }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([])

    useEffect(() => {
      const fetchEvents = async () => {
        const start = new Date().toISOString()
        const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        const upcomingEvents = await getEvents(start, end)
        setEvents(upcomingEvents)
      }
      fetchEvents()
    }, [getEvents])

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <h4>Next 14 Days</h4>

        {events.length === 0 ? (
          <p>No upcoming events</p>
        ) : (
          <ul>
            {events.map((event, index) => (
              <li key={index}>
                <strong>{event.summary}</strong>
                <p>{new Date(event.start).toLocaleString()}</p>
                {event.location && <p>📍 {event.location}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }}
</Calendar>
```

### Create New Event

```tsx
<Calendar entityId="calendar.personal">
  {({ createEvent, supportsCreate, attributes }) => {
    const [summary, setSummary] = useState('')
    const [startDateTime, setStartDateTime] = useState('')
    const [endDateTime, setEndDateTime] = useState('')

    const handleCreate = async () => {
      if (!summary || !startDateTime || !endDateTime) {
        alert('Please fill in all fields')
        return
      }

      try {
        await createEvent({
          summary,
          start: startDateTime + ':00',  // Add seconds
          end: endDateTime + ':00'
        })

        // Clear form
        setSummary('')
        setStartDateTime('')
        setEndDateTime('')

        alert('Event created successfully!')
      } catch (error) {
        alert(`Failed to create event: ${error}`)
      }
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>

        {supportsCreate ? (
          <div>
            <input
              type="text"
              placeholder="Event title"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <input
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
            />
            <input
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
            />
            <button onClick={handleCreate}>Create Event</button>
          </div>
        ) : (
          <p>This calendar does not support creating events</p>
        )}
      </div>
    )
  }}
</Calendar>
```

### Update and Delete Events

```tsx
<Calendar entityId="calendar.family">
  {({ getEvents, updateEvent, deleteEvent, supportsUpdate, supportsDelete, attributes }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([])

    const loadEvents = useCallback(async () => {
      const start = new Date().toISOString()
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const fetchedEvents = await getEvents(start, end)
      setEvents(fetchedEvents)
    }, [getEvents])

    useEffect(() => {
      loadEvents()
    }, [loadEvents])

    const handleUpdateEvent = async (uid: string, newSummary: string) => {
      try {
        await updateEvent(uid, { summary: newSummary })
        await loadEvents()
      } catch (error) {
        alert(`Failed to update event: ${error}`)
      }
    }

    const handleDeleteEvent = async (uid: string) => {
      if (confirm('Delete this event?')) {
        try {
          await deleteEvent(uid)
          await loadEvents()
        } catch (error) {
          alert(`Failed to delete event: ${error}`)
        }
      }
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>

        {events.length === 0 ? (
          <p>No upcoming events</p>
        ) : (
          <ul>
            {events.map((event, index) => (
              <li key={index}>
                <strong>{event.summary}</strong>
                <p>{new Date(event.start).toLocaleString()}</p>
                {event.location && <p>📍 {event.location}</p>}

                {supportsUpdate && event.uid && (
                  <button onClick={() => {
                    const newSummary = prompt('New title:', event.summary)
                    if (newSummary) handleUpdateEvent(event.uid!, newSummary)
                  }}>
                    Edit
                  </button>
                )}

                {supportsDelete && event.uid && (
                  <button onClick={() => handleDeleteEvent(event.uid!)}>
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }}
</Calendar>
```

### Full Calendar Manager

```tsx
<Calendar entityId="calendar.family">
  {({
    hasActiveEvent,
    currentEvent,
    startTime,
    getEvents,
    createEvent,
    deleteEvent,
    supportsCreate,
    supportsDelete,
    attributes
  }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newEvent, setNewEvent] = useState({
      summary: '',
      start: '',
      end: '',
      location: '',
      description: ''
    })

    const loadEvents = useCallback(async () => {
      const start = new Date().toISOString()
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const fetchedEvents = await getEvents(start, end)
      setEvents(fetchedEvents)
    }, [getEvents])

    useEffect(() => {
      loadEvents()
    }, [loadEvents])

    const handleCreateEvent = async () => {
      if (!newEvent.summary || !newEvent.start || !newEvent.end) {
        alert('Please fill in required fields')
        return
      }

      try {
        await createEvent({
          summary: newEvent.summary,
          start: newEvent.start + ':00',
          end: newEvent.end + ':00',
          location: newEvent.location || undefined,
          description: newEvent.description || undefined
        })

        setNewEvent({ summary: '', start: '', end: '', location: '', description: '' })
        setShowCreateForm(false)
        await loadEvents()
      } catch (error) {
        alert(`Failed to create event: ${error}`)
      }
    }

    const handleDeleteEvent = async (uid: string) => {
      if (confirm('Delete this event?')) {
        try {
          await deleteEvent(uid)
          await loadEvents()
        } catch (error) {
          alert(`Failed to delete event: ${error}`)
        }
      }
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>

        {/* Current Event */}
        {hasActiveEvent && currentEvent && (
          <div className="current-event">
            <h4>Current/Next Event</h4>
            <p><strong>{currentEvent.summary}</strong></p>
            {startTime && <p>Start: {new Date(startTime).toLocaleString()}</p>}
          </div>
        )}

        {/* Create Event Form */}
        {supportsCreate && (
          <div>
            {!showCreateForm ? (
              <button onClick={() => setShowCreateForm(true)}>
                + Create Event
              </button>
            ) : (
              <div className="create-form">
                <h4>New Event</h4>
                <input
                  type="text"
                  placeholder="Event title *"
                  value={newEvent.summary}
                  onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                />
                <input
                  type="datetime-local"
                  value={newEvent.start}
                  onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                />
                <input
                  type="datetime-local"
                  value={newEvent.end}
                  onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Location (optional)"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
                <button onClick={handleCreateEvent}>Create</button>
                <button onClick={() => {
                  setShowCreateForm(false)
                  setNewEvent({ summary: '', start: '', end: '', location: '', description: '' })
                }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Event List */}
        <div>
          <h4>Upcoming Events</h4>
          {events.length === 0 ? (
            <p>No upcoming events</p>
          ) : (
            <ul>
              {events.map((event, index) => (
                <li key={index}>
                  <p><strong>{event.summary}</strong></p>
                  <p>{new Date(event.start).toLocaleString()}</p>
                  {event.location && <p>📍 {event.location}</p>}
                  {event.description && <p>{event.description}</p>}
                  {supportsDelete && event.uid && (
                    <button onClick={() => handleDeleteEvent(event.uid!)}>
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }}
</Calendar>
```

### Using Hooks

```tsx
import { useCalendar } from 'hass-react'

function CalendarWidget({ entityId }) {
  const calendar = useCalendar(entityId)
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const start = new Date().toISOString()
        const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const events = await calendar.getEvents(start, end)
        setUpcomingEvents(events.slice(0, 5))
      } catch (error) {
        console.error('Failed to fetch events:', error)
      }
    }

    fetchEvents()
  }, [calendar.getEvents])

  return (
    <div>
      <h3>{calendar.attributes.friendly_name}</h3>

      {/* Current Event */}
      {calendar.hasActiveEvent && calendar.currentEvent && (
        <div className="current-event">
          <h4>Now</h4>
          <p><strong>{calendar.currentEvent.summary}</strong></p>
          {calendar.startTime && (
            <p>Started: {new Date(calendar.startTime).toLocaleTimeString()}</p>
          )}
          {calendar.endTime && (
            <p>Until: {new Date(calendar.endTime).toLocaleTimeString()}</p>
          )}
          {calendar.location && <p>📍 {calendar.location}</p>}
        </div>
      )}

      {/* Upcoming Events */}
      <div>
        <h4>Coming Up</h4>
        {upcomingEvents.length === 0 ? (
          <p>No events this week</p>
        ) : (
          <ul>
            {upcomingEvents.map((event, index) => (
              <li key={index}>
                <strong>{event.summary}</strong>
                <p>
                  {new Date(event.start).toLocaleDateString()} at{' '}
                  {new Date(event.start).toLocaleTimeString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Capabilities */}
      <p>
        <small>
          Capabilities:
          {calendar.supportsCreate && ' Create'}
          {calendar.supportsUpdate && ' Update'}
          {calendar.supportsDelete && ' Delete'}
        </small>
      </p>

      <p>
        <small>Last updated: {calendar.lastUpdated.toLocaleTimeString()}</small>
      </p>
    </div>
  )
}
```

## Notes

- All datetime values must be in ISO 8601 format (e.g., `2024-01-15T10:00:00`)
- For all-day events, use date format (e.g., `2024-01-15`)
- When using `datetime-local` inputs, append `:00` for seconds (e.g., `value + ':00'`)
- The `getEvents` method requires `start` and `end` parameters in ISO 8601 format
- Not all calendars support create, update, or delete. Check the support properties first
- Recurring events use the `rrule` property following RFC 5545 format
- When updating or deleting recurring events, use `recurrenceRange` to specify the scope:
  - `'THIS'` - Only this occurrence
  - `'THIS_AND_FUTURE'` - This and all future occurrences
  - `'ALL'` - All occurrences
