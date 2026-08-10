---
sidebar_position: 2
---

# Custom Service Calls

Call Home Assistant services directly when the entity hooks don't cover what you need.

## Overview

`useServiceCall` gives you Home Assistant's raw service call API, so you can call any service with any parameters. Reach for it when:

- You need to call services not covered by entity-specific hooks
- You want to control multiple entities with a single service call
- You're working with custom integrations or scripts
- You need fine-grained control over service parameters

## Basic Usage

```tsx
import { useServiceCall } from 'hass-react'

function CustomControl() {
  const { callService } = useServiceCall()

  const handleAction = async () => {
    await callService('light', 'turn_on', {
      entity_id: 'light.living_room',
      brightness: 255,
      rgb_color: [255, 0, 0]
    })
  }

  return <button onClick={handleAction}>Red Light</button>
}
```

## API Reference

### `useServiceCall()`

Returns an object with service call methods:

#### `callService(domain, service, data?)`

Make a service call without expecting a response.

**Parameters:**
- `domain` (string) - Service domain (e.g., 'light', 'switch', 'homeassistant')
- `service` (string) - Service name (e.g., 'turn_on', 'toggle', 'restart')
- `data` (object, optional) - Service data including entity_id and other parameters

**Returns:** `Promise<void>`

#### `callServiceWithResponse<R>(domain, service, data?)`

Make a service call and return the response.

**Parameters:**
- `domain` (string) - Service domain
- `service` (string) - Service name
- `data` (object, optional) - Service data

**Returns:** `Promise<R>` - The service response

## Examples

### Control Multiple Entities

```tsx
function RoomControl() {
  const { callService } = useServiceCall()

  const allLightsOn = async () => {
    await callService('light', 'turn_on', {
      entity_id: ['light.living_room', 'light.kitchen', 'light.bedroom'],
      brightness: 200
    })
  }

  const allLightsOff = async () => {
    await callService('light', 'turn_off', {
      entity_id: ['light.living_room', 'light.kitchen', 'light.bedroom']
    })
  }

  return (
    <div>
      <button onClick={allLightsOn}>All Lights On</button>
      <button onClick={allLightsOff}>All Lights Off</button>
    </div>
  )
}
```

### Service with Response

```tsx
function SystemInfo() {
  const { callServiceWithResponse } = useServiceCall()
  const [config, setConfig] = useState(null)

  const getConfig = async () => {
    const response = await callServiceWithResponse('homeassistant', 'check_config')
    setConfig(response)
  }

  return (
    <div>
      <button onClick={getConfig}>Check Config</button>
      {config && <pre>{JSON.stringify(config, null, 2)}</pre>}
    </div>
  )
}
```

### Trigger Automation

```tsx
function AutomationTrigger() {
  const { callService } = useServiceCall()

  const triggerAutomation = async () => {
    await callService('automation', 'trigger', {
      entity_id: 'automation.morning_routine',
      skip_condition: true
    })
  }

  return <button onClick={triggerAutomation}>Run Morning Routine</button>
}
```

### Send Notification

```tsx
function NotificationSender() {
  const { callService } = useServiceCall()
  const [message, setMessage] = useState('')

  const sendNotification = async () => {
    await callService('notify', 'mobile_app_my_phone', {
      message: message,
      title: 'Custom Notification',
      data: {
        push: {
          sound: 'default'
        }
      }
    })
    setMessage('')
  }

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter message"
      />
      <button onClick={sendNotification}>Send</button>
    </div>
  )
}
```

### Combine with Entity Hooks

You can mix `useServiceCall` with entity-specific hooks:

```tsx
function HybridControl() {
  const { callService } = useServiceCall()
  const light = useLight('light.living_room')

  // Use entity hook for state
  const isOn = light.isOn

  // Use custom service call for advanced control
  const customEffect = async () => {
    await callService('light', 'turn_on', {
      entity_id: 'light.living_room',
      effect: 'colorloop',
      brightness: 150
    })
  }

  return (
    <div>
      <p>Light is {isOn ? 'on' : 'off'}</p>
      <button onClick={customEffect}>Color Loop</button>
    </div>
  )
}
```

## Error Handling

Service calls include automatic retry logic with exponential backoff:

```tsx
function LightControl() {
  const { callService } = useServiceCall()
  const [error, setError] = useState(null)

  const handleAction = async () => {
    try {
      setError(null)
      await callService('light', 'turn_on', {
        entity_id: 'light.living_room'
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <button onClick={handleAction}>Turn On</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
```

## Configuration

Retry behavior can be configured in the `HAProvider`:

```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  options={{
    serviceRetry: {
      maxAttempts: 5,
      baseDelay: 500,
      exponentialBackoff: true,
      maxDelay: 10000
    }
  }}
>
  <App />
</HAProvider>
```

## When to Use

**Use `useServiceCall` when:**
- Calling services on multiple entities at once
- Working with custom integrations
- Triggering automations or scripts
- Sending notifications
- Calling services not covered by entity hooks

**Use entity-specific hooks when:**
- Working with a single entity
- You need reactive state updates
- The entity type has a dedicated hook
- You want type-safe methods and attributes

## Notes

- Service calls are not entity-specific, so you must specify `entity_id` in the data
- The hook automatically includes retry logic for failed calls
- Errors are thrown as `ServiceCallError` or `ConnectionError`
- Service calls don't update entity state on their own. Use entity hooks for reactive updates
