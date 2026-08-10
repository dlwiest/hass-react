---
sidebar_position: 3
---

# Fan

Control fans: speed, preset modes, oscillation, direction.

## Quick Example

```tsx
// Component approach
<Fan entityId="fan.bedroom_ceiling">
  {({ isOn, toggle, percentage }) => (
    <div>
      <button onClick={toggle}>
        Fan: {isOn ? 'ON' : 'OFF'}
      </button>
      {isOn && <span> ({percentage}%)</span>}
    </div>
  )}
</Fan>

// Hook approach
const fan = useFan('fan.bedroom_ceiling')
<div>
  <button onClick={fan.toggle}>
    Fan: {fan.isOn ? 'ON' : 'OFF'}
  </button>
  {fan.isOn && <span> ({fan.percentage}%)</span>}
</div>
```

## Component API

### Basic Usage

```tsx
import { Fan } from 'hass-react'

<Fan entityId="fan.bedroom_ceiling">
  {(fanProps) => (
    // Your UI here
  )}
</Fan>
```

### Render Props

The Fan component provides these props to your render function:

#### State Properties
- **`isOn`** (`boolean`) - Whether the fan is currently on
- **`percentage`** (`number`) - Current speed as percentage (0-100)
- **`presetMode`** (`string`) - Current preset mode (e.g., "auto", "sleep")
- **`isOscillating`** (`boolean`) - Whether oscillation is enabled
- **`direction`** (`string`) - Current rotation direction ("forward" or "reverse")

#### Support Properties
- **`supportsSetSpeed`** (`boolean`) - Fan supports speed control
- **`supportsPresetMode`** (`boolean`) - Fan supports preset modes
- **`supportsOscillate`** (`boolean`) - Fan supports oscillation
- **`supportsDirection`** (`boolean`) - Fan supports direction control
- **`availablePresetModes`** (`string[]`) - List of available preset modes

#### Control Methods
- **`toggle()`** - Toggle the fan on/off
- **`turnOn()`** - Turn the fan on
- **`turnOff()`** - Turn the fan off
- **`setPercentage(value: number)`** - Set fan speed percentage (0-100)
- **`setPresetMode(mode: string)`** - Set preset mode
- **`setOscillating(oscillating: boolean)`** - Enable/disable oscillation
- **`setDirection(direction: string)`** - Set rotation direction

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useFan } from 'hass-react'

function MyComponent() {
  const fan = useFan('fan.bedroom_ceiling')
  
  // All the same properties as component render props
  return <div>{fan.isOn ? 'ON' : 'OFF'} - {fan.percentage}%</div>
}
```

The `useFan` hook returns the same properties and methods the component passes to its render function.

## List All Fans

Need every fan at once? `useFans` returns them all:

```tsx
import { useFans } from 'hass-react'

function FanList() {
  const fans = useFans()

  return (
    <div>
      <h2>Available Fans ({fans.length})</h2>
      {fans.map(fan => (
        <div key={fan.entity_id}>
          {fan.attributes.friendly_name || fan.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns an array of fan entity objects.

## Examples

### Simple Speed Control

```tsx
<Fan entityId="fan.living_room">
  {({ isOn, percentage, toggle, setPercentage, supportsSetSpeed, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <button onClick={toggle}>
        {isOn ? 'Turn Off' : 'Turn On'}
      </button>
      
      {isOn && supportsSetSpeed && (
        <div>
          <label>Speed: {percentage}%</label>
          <input
            type="range"
            min="0" max="100"
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value))}
          />
        </div>
      )}
    </div>
  )}
</Fan>
```

### Preset Modes

```tsx
<Fan entityId="fan.bedroom_ceiling">
  {({ 
    isOn, presetMode, availablePresetModes, 
    toggle, setPresetMode, supportsPresetMode,
    attributes 
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <button onClick={toggle}>
        {isOn ? 'Turn Off' : 'Turn On'}
      </button>
      
      {isOn && supportsPresetMode && availablePresetModes.length > 0 && (
        <div>
          <label>Mode:</label>
          <select 
            value={presetMode || ''} 
            onChange={(e) => setPresetMode(e.target.value)}
          >
            <option value="">Manual</option>
            {availablePresetModes.map(mode => (
              <option key={mode} value={mode}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )}
</Fan>
```

### Full Feature Control

```tsx
<Fan entityId="fan.master_bedroom">
  {({
    isOn, percentage, presetMode, isOscillating, direction,
    supportsSetSpeed, supportsPresetMode, supportsOscillate, supportsDirection,
    availablePresetModes,
    toggle, setPercentage, setPresetMode, setOscillating, setDirection,
    attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <div>
        <button onClick={toggle}>{isOn ? 'Turn Off' : 'Turn On'}</button>
        <span>Status: {isOn ? 'ON' : 'OFF'}</span>
      </div>

      {isOn && supportsSetSpeed && (
        <div>
          <label>Speed: {percentage}%</label>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value))}
          />
        </div>
      )}

      {isOn && supportsPresetMode && availablePresetModes.length > 0 && (
        <div>
          <label>Preset Mode:</label>
          <select value={presetMode || ''} onChange={(e) => setPresetMode(e.target.value)}>
            <option value="">Manual</option>
            {availablePresetModes.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>
      )}

      {isOn && supportsOscillate && (
        <div>
          <label>
            <input
              type="checkbox"
              checked={isOscillating}
              onChange={(e) => setOscillating(e.target.checked)}
            />
            Oscillate
          </label>
        </div>
      )}

      {isOn && supportsDirection && (
        <div>
          <label>Direction:</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="forward">Forward</option>
            <option value="reverse">Reverse</option>
          </select>
        </div>
      )}
    </div>
  )}
</Fan>
```

### Speed Buttons

```tsx
<Fan entityId="fan.office">
  {({ isOn, percentage, toggle, setPercentage, supportsSetSpeed, attributes }) => {
    const speedLevels = [0, 25, 50, 75, 100]

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <button onClick={toggle}>{isOn ? 'Turn Off' : 'Turn On'}</button>

        {supportsSetSpeed && (
          <div>
            <p>Speed: {percentage}%</p>
            <div>
              {speedLevels.map(speed => (
                <button key={speed} onClick={() => setPercentage(speed)}>
                  {speed === 0 ? 'Off' : `${speed}%`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }}
</Fan>
```

### Using Hooks

```tsx
import { useFan } from 'hass-react'

function FanCard({ entityId }) {
  const fan = useFan(entityId)

  return (
    <div>
      <h3>{fan.attributes.friendly_name}</h3>
      <div>
        <button onClick={fan.toggle}>
          {fan.isOn ? 'OFF' : 'ON'}
        </button>

        {fan.isOn && (
          <>
            <span>{fan.percentage}%</span>

            {fan.supportsSetSpeed && (
              <input
                type="range"
                min="0"
                max="100"
                value={fan.percentage}
                onChange={(e) => fan.setPercentage(parseInt(e.target.value))}
              />
            )}

            {fan.supportsOscillate && (
              <button onClick={() => fan.setOscillating(!fan.isOscillating)}>
                Oscillate
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```