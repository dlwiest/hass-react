---
sidebar_position: 15
---

# Vacuum

Start, pause, and dock robot vacuums, and keep an eye on battery and cleaning status.

## Quick Example

```tsx
// Component approach
<Vacuum entityId="vacuum.roborock_s7">
  {({ isDocked, isCleaning, batteryLevel, start, returnToBase }) => (
    <div>
      <p>Status: {isDocked ? 'Docked' : isCleaning ? 'Cleaning' : 'Idle'}</p>
      <p>Battery: {batteryLevel}%</p>
      <button onClick={start}>Start</button>
      <button onClick={returnToBase}>Dock</button>
    </div>
  )}
</Vacuum>

// Hook approach
const vacuum = useVacuum('vacuum.roborock_s7')
<div>
  <p>Battery: {vacuum.batteryLevel}%</p>
  <button onClick={vacuum.start}>Start</button>
</div>
```

## Component API

### Basic Usage

```tsx
import { Vacuum } from 'hass-react'

<Vacuum entityId="vacuum.roborock_s7">
  {(vacuumProps) => (
    // Your UI here
  )}
</Vacuum>
```

### Render Props

The Vacuum component provides these props to your render function:

#### State Properties
- **`batteryLevel`** (`number | null`) - Current battery level percentage (0-100)
- **`fanSpeed`** (`string | null`) - Current fan speed/suction power setting
- **`status`** (`string | null`) - Detailed status message from the vacuum
- **`availableFanSpeeds`** (`string[]`) - List of available fan speed modes
- **`isCharging`** (`boolean`) - Whether the vacuum is currently charging
- **`isDocked`** (`boolean`) - Whether the vacuum is docked at its base
- **`isCleaning`** (`boolean`) - Whether the vacuum is actively cleaning
- **`isReturning`** (`boolean`) - Whether the vacuum is returning to base
- **`isIdle`** (`boolean`) - Whether the vacuum is idle
- **`isError`** (`boolean`) - Whether the vacuum has an error

#### Support Properties
- **`supportsStart`** (`boolean`) - Whether the vacuum can start cleaning
- **`supportsPause`** (`boolean`) - Whether the vacuum can pause cleaning
- **`supportsStop`** (`boolean`) - Whether the vacuum can stop cleaning
- **`supportsReturnHome`** (`boolean`) - Whether the vacuum can return to base
- **`supportsFanSpeed`** (`boolean`) - Whether the vacuum can adjust fan speed
- **`supportsLocate`** (`boolean`) - Whether the vacuum can play locate sound/light
- **`supportsCleanSpot`** (`boolean`) - Whether the vacuum can perform spot cleaning
- **`supportsTurnOn`** (`boolean`) - Whether the vacuum supports `turn_on` (older vacuums that model power state)
- **`supportsTurnOff`** (`boolean`) - Whether the vacuum supports `turn_off`

#### Control Methods
- **`start()`** (`Promise<void>`) - Start or resume cleaning
- **`pause()`** (`Promise<void>`) - Pause current cleaning operation
- **`stop()`** (`Promise<void>`) - Stop cleaning and stay in place
- **`returnToBase()`** (`Promise<void>`) - Return to charging dock
- **`locate()`** (`Promise<void>`) - Play a sound/light to locate the vacuum
- **`cleanSpot()`** (`Promise<void>`) - Perform spot cleaning
- **`setFanSpeed(speed: string)`** (`Promise<void>`) - Set fan speed mode
- **`sendCommand(command: string, params?: object)`** (`Promise<void>`) - Send custom command
- **`turnOn()`** (`Promise<void>`) - Turn on (legacy vacuums only; throws if `supportsTurnOn` is false)
- **`turnOff()`** (`Promise<void>`) - Turn off (legacy vacuums only; throws if `supportsTurnOff` is false)

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useVacuum } from 'hass-react'

function MyComponent() {
  const vacuum = useVacuum('vacuum.roborock_s7')

  return (
    <div>
      <p>Battery: {vacuum.batteryLevel}%</p>
      <button onClick={vacuum.start}>Start</button>
    </div>
  )
}
```

The `useVacuum` hook returns an object with all the same properties and methods as the component's render props.

## List All Vacuums

The `useVacuums` hook returns every vacuum entity Home Assistant knows about:

```tsx
import { useVacuums } from 'hass-react'

function VacuumList() {
  const vacuums = useVacuums()

  return (
    <div>
      <h2>Available Vacuums ({vacuums.length})</h2>
      {vacuums.map(vacuum => (
        <div key={vacuum.entity_id}>
          {vacuum.attributes.friendly_name || vacuum.entity_id}
        </div>
      ))}
    </div>
  )
}
```

Each item in the array is a raw entity object with `entity_id`, `state`, and `attributes`.

## Examples

### Simple Control

```tsx
<Vacuum entityId="vacuum.roborock_s7">
  {({ batteryLevel, isDocked, isCleaning, start, returnToBase, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Battery: {batteryLevel}%</p>
      <button onClick={start} disabled={isCleaning}>
        Start Cleaning
      </button>
      <button onClick={returnToBase} disabled={isDocked}>
        Return to Dock
      </button>
    </div>
  )}
</Vacuum>
```

### Status Display

```tsx
<Vacuum entityId="vacuum.roborock_s7">
  {({ isDocked, isCleaning, isReturning, isError, batteryLevel, status, attributes }) => {
    const getStatusText = () => {
      if (isError) return 'Error'
      if (isCleaning) return 'Cleaning'
      if (isReturning) return 'Returning to Dock'
      if (isDocked) return 'Docked'
      return 'Idle'
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Status: {getStatusText()}</p>
        {status && <p>Details: {status}</p>}
        <p>Battery: {batteryLevel}%</p>
      </div>
    )
  }}
</Vacuum>
```

### Fan Speed Control

```tsx
<Vacuum entityId="vacuum.roborock_s7">
  {({ fanSpeed, availableFanSpeeds, supportsFanSpeed, setFanSpeed, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      {supportsFanSpeed && availableFanSpeeds.length > 0 && (
        <div>
          <label>Fan Speed</label>
          <select
            value={fanSpeed || ''}
            onChange={(e) => setFanSpeed(e.target.value)}
          >
            {availableFanSpeeds.map(speed => (
              <option key={speed} value={speed}>{speed}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )}
</Vacuum>
```

### Full Control Panel

```tsx
<Vacuum entityId="vacuum.roborock_s7">
  {({
    batteryLevel, fanSpeed, status,
    isDocked, isCleaning, isError,
    availableFanSpeeds, supportsFanSpeed,
    supportsStart, supportsPause, supportsStop,
    supportsReturnHome, supportsLocate, supportsCleanSpot,
    start, pause, stop, returnToBase, locate, cleanSpot,
    setFanSpeed, attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>

      <p>Status: {isError ? 'Error' : isCleaning ? 'Cleaning' : isDocked ? 'Docked' : 'Idle'}</p>
      {status && <p>{status}</p>}
      <p>Battery: {batteryLevel}%</p>

      {supportsFanSpeed && availableFanSpeeds.length > 0 && (
        <select
          value={fanSpeed || ''}
          onChange={(e) => setFanSpeed(e.target.value)}
        >
          {availableFanSpeeds.map(speed => (
            <option key={speed} value={speed}>{speed}</option>
          ))}
        </select>
      )}

      <div>
        {supportsStart && !isCleaning && (
          <button onClick={start}>Start</button>
        )}
        {supportsPause && isCleaning && (
          <button onClick={pause}>Pause</button>
        )}
        {supportsStop && isCleaning && (
          <button onClick={stop}>Stop</button>
        )}
        {supportsReturnHome && !isDocked && (
          <button onClick={returnToBase}>Dock</button>
        )}
        {supportsLocate && (
          <button onClick={locate}>Locate</button>
        )}
        {supportsCleanSpot && !isCleaning && (
          <button onClick={cleanSpot}>Spot Clean</button>
        )}
      </div>
    </div>
  )}
</Vacuum>
```

### Multiple Vacuums

```tsx
function VacuumDashboard() {
  const vacuums = [
    'vacuum.downstairs',
    'vacuum.upstairs',
    'vacuum.garage'
  ]

  return (
    <div>
      {vacuums.map(entityId => (
        <Vacuum key={entityId} entityId={entityId}>
          {({ batteryLevel, isDocked, isCleaning, start, returnToBase, attributes }) => (
            <div>
              <h4>{attributes.friendly_name}</h4>
              <p>Battery: {batteryLevel}%</p>
              <button onClick={isDocked || !isCleaning ? start : returnToBase}>
                {isCleaning ? 'Return to Dock' : 'Start Cleaning'}
              </button>
            </div>
          )}
        </Vacuum>
      ))}
    </div>
  )
}
```

### Using Hooks

```tsx
import { useVacuum } from 'hass-react'

function VacuumCard({ entityId }) {
  const vacuum = useVacuum(entityId)

  return (
    <div>
      <h3>{vacuum.attributes.friendly_name}</h3>
      <p>Status: {vacuum.isDocked ? 'Docked' : vacuum.isCleaning ? 'Cleaning' : 'Idle'}</p>
      <p>Battery: {vacuum.batteryLevel}%</p>

      {vacuum.supportsStart && !vacuum.isCleaning && (
        <button onClick={vacuum.start}>Start</button>
      )}
      {vacuum.supportsPause && vacuum.isCleaning && (
        <button onClick={vacuum.pause}>Pause</button>
      )}
      {vacuum.supportsStop && vacuum.isCleaning && (
        <button onClick={vacuum.stop}>Stop</button>
      )}
      {vacuum.supportsReturnHome && !vacuum.isDocked && (
        <button onClick={vacuum.returnToBase}>Dock</button>
      )}
      {vacuum.supportsLocate && (
        <button onClick={vacuum.locate}>Locate</button>
      )}
    </div>
  )
}
```

### Custom Commands

```tsx
import { useVacuum } from 'hass-react'

function AdvancedVacuumControl({ entityId }) {
  const vacuum = useVacuum(entityId)

  const cleanRoom = (roomName) => {
    vacuum.sendCommand('app_segment_clean', { segments: [roomName] })
  }

  const setWaterFlow = (level) => {
    vacuum.sendCommand('set_water_box_custom_mode', { mode: level })
  }

  return (
    <div>
      <h3>{vacuum.attributes.friendly_name}</h3>

      <div>
        <h4>Standard Controls</h4>
        <button onClick={vacuum.start}>Start</button>
        <button onClick={vacuum.pause}>Pause</button>
        <button onClick={vacuum.returnToBase}>Dock</button>
      </div>

      <div>
        <h4>Clean Specific Room</h4>
        <button onClick={() => cleanRoom('kitchen')}>Kitchen</button>
        <button onClick={() => cleanRoom('living_room')}>Living Room</button>
        <button onClick={() => cleanRoom('bedroom')}>Bedroom</button>
      </div>

      <div>
        <h4>Water Flow (for mopping models)</h4>
        <button onClick={() => setWaterFlow(1)}>Low</button>
        <button onClick={() => setWaterFlow(2)}>Medium</button>
        <button onClick={() => setWaterFlow(3)}>High</button>
      </div>
    </div>
  )
}
```
