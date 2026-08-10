---
sidebar_position: 1
---

# Alarm Control Panel

Arm and disarm security panels, watch their state, and trigger the alarm on panels that support it.

## Quick Example

```tsx
// Component approach
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({ isDisarmed, isArmedAway, armAway, disarm }) => (
    <div>
      <p>Status: {isDisarmed ? 'DISARMED' : 'ARMED'}</p>
      <button onClick={() => isDisarmed ? armAway() : disarm()}>
        {isDisarmed ? 'Arm Away' : 'Disarm'}
      </button>
    </div>
  )}
</AlarmControlPanel>

// Hook approach
const alarm = useAlarmControlPanel('alarm_control_panel.home')
<div>
  <p>Status: {alarm.isDisarmed ? 'DISARMED' : 'ARMED'}</p>
  <button onClick={() => alarm.isDisarmed ? alarm.armAway() : alarm.disarm()}>
    {alarm.isDisarmed ? 'Arm Away' : 'Disarm'}
  </button>
</div>
```

## Component API

### Basic Usage

```tsx
import { AlarmControlPanel } from 'hass-react'

<AlarmControlPanel entityId="alarm_control_panel.home">
  {(alarmProps) => (
    // Your UI here
  )}
</AlarmControlPanel>
```

### Render Props

The AlarmControlPanel component provides these props to your render function:

#### State Properties
- **`isDisarmed`** (`boolean`) - Alarm is disarmed
- **`isArmedHome`** (`boolean`) - Alarm is armed in home mode
- **`isArmedAway`** (`boolean`) - Alarm is armed in away mode
- **`isArmedNight`** (`boolean`) - Alarm is armed in night mode
- **`isArmedVacation`** (`boolean`) - Alarm is armed in vacation mode
- **`isArmedCustomBypass`** (`boolean`) - Alarm is armed with custom bypass
- **`isPending`** (`boolean`) - Alarm is in pending state (countdown)
- **`isArming`** (`boolean`) - Alarm is currently arming
- **`isDisarming`** (`boolean`) - Alarm is currently disarming
- **`isTriggered`** (`boolean`) - Alarm has been triggered
- **`changedBy`** (`string | null | undefined`) - Who last changed the alarm state
- **`codeFormat`** (`string | undefined`) - Format of security code (e.g., "number", "text")

#### Support Properties
- **`supportsArmHome`** (`boolean`) - Alarm supports home arming mode
- **`supportsArmAway`** (`boolean`) - Alarm supports away arming mode
- **`supportsArmNight`** (`boolean`) - Alarm supports night arming mode
- **`supportsArmVacation`** (`boolean`) - Alarm supports vacation arming mode
- **`supportsArmCustomBypass`** (`boolean`) - Alarm supports custom bypass arming
- **`supportsTrigger`** (`boolean`) - Alarm supports manual trigger

#### Control Methods
- **`disarm(code?: string)`** - Disarm the alarm with optional security code
- **`armHome(code?: string)`** - Arm in home mode with optional security code
- **`armAway(code?: string)`** - Arm in away mode with optional security code
- **`armNight(code?: string)`** - Arm in night mode with optional security code
- **`armVacation(code?: string)`** - Arm in vacation mode with optional security code
- **`armCustomBypass(code?: string)`** - Arm with custom bypass with optional security code
- **`trigger()`** - Manually trigger the alarm

The arm methods and `trigger` are each gated on their matching support flag; only `disarm` always goes through. Panels declare features individually, so a panel that supports trigger doesn't necessarily support vacation arming (or any other mode). Calling a method the panel doesn't support, like `armVacation` on a trigger-only panel, throws a `FeatureNotSupportedError`. Check the `supports*` flags before rendering the controls.

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useAlarmControlPanel } from 'hass-react'

function MyComponent() {
  const alarm = useAlarmControlPanel('alarm_control_panel.home')

  // All the same properties as component render props
  return <div>{alarm.isDisarmed ? 'DISARMED' : 'ARMED'}</div>
}
```

The `useAlarmControlPanel` hook returns the same properties and methods the component passes to its render function.

## List All Alarm Control Panels

Use the `useAlarmControlPanels` hook to retrieve all available alarm control panel entities:

```tsx
import { useAlarmControlPanels } from 'hass-react'

function AlarmPanelList() {
  const alarmPanels = useAlarmControlPanels()

  return (
    <div>
      <h2>Available Alarm Panels ({alarmPanels.length})</h2>
      {alarmPanels.map(panel => (
        <div key={panel.entity_id}>
          {panel.attributes.friendly_name || panel.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns plain entity objects, one per alarm panel in your Home Assistant instance.

## Examples

### Simple Alarm Control

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({ isDisarmed, isArmedAway, armAway, disarm, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isDisarmed ? 'DISARMED' : 'ARMED'}</p>

      <button onClick={() => armAway()} disabled={isArmedAway}>
        Arm Away
      </button>

      <button onClick={() => disarm()} disabled={isDisarmed}>
        Disarm
      </button>
    </div>
  )}
</AlarmControlPanel>
```

### Alarm with Security Code

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({ isDisarmed, armAway, disarm, codeFormat, attributes }) => {
    const [code, setCode] = useState('')

    const handleArmAway = () => {
      armAway(code)
      setCode('')
    }

    const handleDisarm = () => {
      disarm(code)
      setCode('')
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Status: {isDisarmed ? 'DISARMED' : 'ARMED'}</p>

        <input
          type={codeFormat === 'number' ? 'number' : 'password'}
          placeholder="Enter security code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <button onClick={handleArmAway} disabled={!isDisarmed}>
          Arm Away
        </button>

        <button onClick={handleDisarm} disabled={isDisarmed}>
          Disarm
        </button>
      </div>
    )
  }}
</AlarmControlPanel>
```

### Multiple Arming Modes

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({
    isDisarmed,
    isArmedHome,
    isArmedAway,
    isArmedNight,
    armHome,
    armAway,
    armNight,
    disarm,
    supportsArmHome,
    supportsArmAway,
    supportsArmNight,
    attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>

      <div>
        Status:
        {isDisarmed && ' DISARMED'}
        {isArmedHome && ' ARMED HOME'}
        {isArmedAway && ' ARMED AWAY'}
        {isArmedNight && ' ARMED NIGHT'}
      </div>

      <div>
        <button onClick={() => disarm()} disabled={isDisarmed}>
          Disarm
        </button>

        {supportsArmHome && (
          <button onClick={() => armHome()} disabled={isArmedHome}>
            Arm Home
          </button>
        )}

        {supportsArmAway && (
          <button onClick={() => armAway()} disabled={isArmedAway}>
            Arm Away
          </button>
        )}

        {supportsArmNight && (
          <button onClick={() => armNight()} disabled={isArmedNight}>
            Arm Night
          </button>
        )}
      </div>
    </div>
  )}
</AlarmControlPanel>
```

### Alarm Status Display

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({
    isDisarmed,
    isArmedHome,
    isArmedAway,
    isPending,
    isTriggered,
    changedBy,
    attributes,
    lastChanged
  }) => {
    const getStatusColor = () => {
      if (isTriggered) return 'red'
      if (isPending) return 'orange'
      if (isDisarmed) return 'green'
      return 'blue'
    }

    const getStatusText = () => {
      if (isTriggered) return 'TRIGGERED!'
      if (isPending) return 'PENDING'
      if (isDisarmed) return 'DISARMED'
      if (isArmedHome) return 'ARMED HOME'
      if (isArmedAway) return 'ARMED AWAY'
      return 'ARMED'
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>

        <div style={{ color: getStatusColor(), fontSize: '2em', fontWeight: 'bold' }}>
          {getStatusText()}
        </div>

        {changedBy && <p>Changed by: {changedBy}</p>}
        <p>Last changed: {lastChanged.toLocaleString()}</p>
      </div>
    )
  }}
</AlarmControlPanel>
```

### Alarm with Trigger Support

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({
    isDisarmed,
    armAway,
    disarm,
    trigger,
    supportsTrigger,
    attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isDisarmed ? 'DISARMED' : 'ARMED'}</p>

      <div>
        <button onClick={() => disarm()} disabled={isDisarmed}>
          Disarm
        </button>

        <button onClick={() => armAway()} disabled={!isDisarmed}>
          Arm Away
        </button>

        {supportsTrigger && (
          <button
            onClick={() => trigger()}
            style={{ backgroundColor: 'red', color: 'white' }}
          >
            Trigger Alarm
          </button>
        )}
      </div>
    </div>
  )}
</AlarmControlPanel>
```

### Auto-Arm Timer

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({ isDisarmed, armAway, disarm, attributes }) => {
    const [autoArmTimer, setAutoArmTimer] = useState<number | null>(null)
    const [countdown, setCountdown] = useState<number>(0)

    const handleDisarm = () => {
      disarm()
      if (autoArmTimer) {
        clearTimeout(autoArmTimer)
        setAutoArmTimer(null)
        setCountdown(0)
      }
    }

    const handleArmLater = () => {
      const seconds = 60
      setCountdown(seconds)

      const timer = setTimeout(() => {
        armAway()
        setAutoArmTimer(null)
        setCountdown(0)
      }, seconds * 1000)

      setAutoArmTimer(timer)

      // Update countdown every second
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    const cancelAutoArm = () => {
      if (autoArmTimer) {
        clearTimeout(autoArmTimer)
        setAutoArmTimer(null)
        setCountdown(0)
      }
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Status: {isDisarmed ? 'DISARMED' : 'ARMED'}</p>

        {countdown > 0 && (
          <p>Auto-arming in {countdown} seconds...</p>
        )}

        <div>
          <button onClick={handleDisarm} disabled={isDisarmed}>
            Disarm
          </button>

          <button onClick={() => armAway()} disabled={!isDisarmed}>
            Arm Now
          </button>

          <button onClick={handleArmLater} disabled={!isDisarmed || countdown > 0}>
            Arm in 60s
          </button>

          {countdown > 0 && (
            <button onClick={cancelAutoArm}>
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }}
</AlarmControlPanel>
```

### Using Hooks

```tsx
import { useAlarmControlPanel } from 'hass-react'

function AlarmCard({ entityId }) {
  const alarm = useAlarmControlPanel(entityId)

  const getStatusColor = () => {
    if (alarm.isTriggered) return 'red'
    if (alarm.isPending) return 'orange'
    if (alarm.isDisarmed) return 'green'
    return 'blue'
  }

  const getStatusText = () => {
    if (alarm.isTriggered) return 'TRIGGERED!'
    if (alarm.isPending) return 'PENDING'
    if (alarm.isArming) return 'ARMING'
    if (alarm.isDisarming) return 'DISARMING'
    if (alarm.isDisarmed) return 'DISARMED'
    if (alarm.isArmedHome) return 'ARMED HOME'
    if (alarm.isArmedAway) return 'ARMED AWAY'
    if (alarm.isArmedNight) return 'ARMED NIGHT'
    if (alarm.isArmedVacation) return 'ARMED VACATION'
    if (alarm.isArmedCustomBypass) return 'ARMED CUSTOM BYPASS'
    return 'UNKNOWN'
  }

  return (
    <div>
      <h3>{alarm.attributes.friendly_name}</h3>

      <div style={{ color: getStatusColor() }}>
        Status: {getStatusText()}
      </div>

      {alarm.changedBy && <p>Changed by: {alarm.changedBy}</p>}

      <div>
        <button
          onClick={() => alarm.disarm()}
          disabled={alarm.isDisarmed}
        >
          Disarm
        </button>

        {alarm.supportsArmHome && (
          <button
            onClick={() => alarm.armHome()}
            disabled={alarm.isArmedHome}
          >
            Arm Home
          </button>
        )}

        {alarm.supportsArmAway && (
          <button
            onClick={() => alarm.armAway()}
            disabled={alarm.isArmedAway}
          >
            Arm Away
          </button>
        )}

        {alarm.supportsArmNight && (
          <button
            onClick={() => alarm.armNight()}
            disabled={alarm.isArmedNight}
          >
            Arm Night
          </button>
        )}
      </div>

      <p>Last updated: {alarm.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}
```

### Conditional Code Entry

```tsx
<AlarmControlPanel entityId="alarm_control_panel.home">
  {({ isDisarmed, armAway, disarm, attributes }) => {
    const [showCodeInput, setShowCodeInput] = useState(false)
    const [code, setCode] = useState('')

    const handleDisarm = () => {
      if (attributes.code_arm_required && !code) {
        setShowCodeInput(true)
        return
      }

      disarm(code)
      setCode('')
      setShowCodeInput(false)
    }

    const handleArmAway = () => {
      armAway(code)
      setCode('')
      setShowCodeInput(false)
    }

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Status: {isDisarmed ? 'DISARMED' : 'ARMED'}</p>

        {showCodeInput && (
          <input
            type="password"
            placeholder="Security Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}

        <div>
          <button onClick={handleDisarm} disabled={isDisarmed}>
            Disarm
          </button>

          <button onClick={handleArmAway} disabled={!isDisarmed}>
            Arm Away
          </button>
        </div>
      </div>
    )
  }}
</AlarmControlPanel>
```
