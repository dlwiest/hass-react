---
sidebar_position: 18
---

# DateTime

Access Home Assistant server time as a JavaScript Date object.

## Setup Required

**Before using this component**, you must enable the Time & Date sensor in Home Assistant:

1. Go to **Settings** → **Devices & Services** → **Integrations**
2. Find **Time & Date** integration (or add it if not present)
3. Click **Add Service**
4. Select **Date & Time (ISO)** as the sensor type
5. Click **Submit**

This creates the `sensor.date_time_iso` entity that this component uses.

## Quick Example

```tsx
// Component approach
<DateTime>
  {({ date }) => (
    <div>Server Time: {date?.toLocaleString()}</div>
  )}
</DateTime>

// Hook approach
const { date, isAvailable } = useDateTime()
<div>Server Time: {date?.toLocaleString()}</div>
```

## Why Use Server Time?

Your browser's clock and your HA server's clock aren't always in sync, and they may not share a timezone. Automations and schedules run on server time, so if your UI needs to line up with them, read the server's clock instead of the client's.

## Component API

### Basic Usage

```tsx
import { DateTime } from 'hass-react'

<DateTime>
  {(datetime) => (
    // Your UI here
  )}
</DateTime>
```

### Render Props

#### DateTime Properties
- **`date`** (`Date | null`) - JavaScript Date object representing HA server time
- **`isAvailable`** (`boolean`) - Whether the time sensor is available

#### Entity Properties
- **`entityId`** (`string`) - The entity ID (`sensor.date_time_iso`)
- **`state`** (`string`) - Raw ISO 8601 date string from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useDateTime } from 'hass-react'

function MyComponent() {
  const { date, isAvailable } = useDateTime()

  return <div>{date?.toLocaleTimeString()}</div>
}
```

## Examples

### Basic Display

```tsx
<DateTime>
  {({ date, isAvailable }) => {
    if (!isAvailable) return <div>Time unavailable</div>
    if (!date) return <div>Loading...</div>

    return (
      <div>
        <h3>Server Time</h3>
        <p>{date.toLocaleString()}</p>
      </div>
    )
  }}
</DateTime>
```

### Coordinating with Automations

```tsx
import { useDateTime } from 'hass-react'

function AutomationStatus() {
  const { date } = useDateTime()

  if (!date) return null

  // Check if we're within automation schedule
  const hour = date.getHours()
  const isNightMode = hour >= 22 || hour < 6

  return (
    <div>
      <p>Current Mode: {isNightMode ? 'Night' : 'Day'}</p>
      <small>Matches automation schedule</small>
    </div>
  )
}
```

### Comparing with Entity State Changes

```tsx
import { useDateTime, useLight } from 'hass-react'

function LightLastChanged() {
  const { date: serverTime } = useDateTime()
  const light = useLight('light.living_room')

  if (!serverTime) return null

  const timeSinceChange = serverTime.getTime() - light.lastChanged.getTime()
  const minutesAgo = Math.floor(timeSinceChange / 60000)

  return (
    <div>
      <p>Light turned {light.isOn ? 'on' : 'off'} {minutesAgo} minutes ago</p>
      <small>Server time: {serverTime.toLocaleTimeString()}</small>
    </div>
  )
}
```

### Using with date-fns or dayjs

```tsx
import { format } from 'date-fns'

<DateTime>
  {({ date }) => date && (
    <div>HA Server: {format(date, 'PPpp')}</div>
  )}
</DateTime>
```

## Notes

- Uses the `sensor.date_time_iso` entity (requires setup, see above)
- Updates every minute via WebSocket
- `date` is `null` while the sensor is unavailable
- Logs a console warning with setup steps if the sensor isn't configured
