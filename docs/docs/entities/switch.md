---
sidebar_position: 2
---

# Switch

Simple on/off control for switches and plugs.

## Quick Example

```tsx
// Component approach
<Switch entityId="switch.coffee_maker">
  {({ isOn, toggle }) => (
    <button onClick={toggle}>
      Coffee Maker: {isOn ? 'ON' : 'OFF'}
    </button>
  )}
</Switch>

// Hook approach
const coffeeSwitch = useSwitch('switch.coffee_maker')
<button onClick={coffeeSwitch.toggle}>
  Coffee Maker: {coffeeSwitch.isOn ? 'ON' : 'OFF'}
</button>
```

## Component API

### Basic Usage

```tsx
import { Switch } from 'hass-react'

<Switch entityId="switch.coffee_maker">
  {(switchProps) => (
    // Your UI here
  )}
</Switch>
```

### Render Props

Props passed to your render function:

#### State Properties
- **`isOn`** (`boolean`) - Whether the switch is currently on

#### Control Methods
- **`toggle()`** - Toggle the switch on/off
- **`turnOn()`** - Turn the switch on
- **`turnOff()`** - Turn the switch off

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useSwitch } from 'hass-react'

function MyComponent() {
  const switchEntity = useSwitch('switch.coffee_maker')
  
  // All the same properties as component render props
  return <div>{switchEntity.isOn ? 'ON' : 'OFF'}</div>
}
```

Same object shape as the component's render props.

## List All Switches

To list every switch, use `useSwitches`. It returns an array of switch entities:

```tsx
import { useSwitches } from 'hass-react'

function SwitchList() {
  const switches = useSwitches()

  return (
    <div>
      <h2>Available Switches ({switches.length})</h2>
      {switches.map(switchEntity => (
        <div key={switchEntity.entity_id}>
          {switchEntity.attributes.friendly_name || switchEntity.entity_id}
        </div>
      ))}
    </div>
  )
}
```

## Examples

### Simple Toggle

```tsx
<Switch entityId="switch.living_room_lamp">
  {({ isOn, toggle, attributes }) => (
    <button onClick={toggle}>
      {attributes.friendly_name}: {isOn ? 'ON' : 'OFF'}
    </button>
  )}
</Switch>
```

### Switch Card

```tsx
<Switch entityId="switch.outdoor_lights">
  {({ isOn, toggle, turnOn, turnOff, attributes }) => (
    <div style={{ 
      padding: '1rem', 
      border: '1px solid #ccc', 
      borderRadius: '8px' 
    }}>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isOn ? 'ON' : 'OFF'}</p>
      
      <div>
        <button onClick={turnOn} disabled={isOn}>
          Turn On
        </button>
        <button onClick={turnOff} disabled={!isOn}>
          Turn Off
        </button>
        <button onClick={toggle}>
          Toggle
        </button>
      </div>
    </div>
  )}
</Switch>
```

### Multiple Switches

```tsx
function SwitchPanel() {
  const switches = [
    'switch.living_room_lamp',
    'switch.coffee_maker',
    'switch.outdoor_lights'
  ]
  
  return (
    <div>
      <h2>Switch Panel</h2>
      {switches.map(entityId => (
        <Switch key={entityId} entityId={entityId}>
          {({ isOn, toggle, attributes }) => (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '0.5rem',
              borderBottom: '1px solid #eee'
            }}>
              <span>{attributes.friendly_name}</span>
              <button onClick={toggle}>
                {isOn ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </Switch>
      ))}
    </div>
  )
}
```

### Using Hooks

```tsx
import { useSwitch } from 'hass-react'

function SwitchCard({ entityId }) {
  const switchEntity = useSwitch(entityId)
  
  return (
    <div>
      <h3>{switchEntity.attributes.friendly_name}</h3>
      <button 
        onClick={switchEntity.toggle}
        style={{
          backgroundColor: switchEntity.isOn ? '#4CAF50' : '#f44336',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '4px'
        }}
      >
        {switchEntity.isOn ? 'ON' : 'OFF'}
      </button>
      
      <p>
        Last updated: {switchEntity.lastUpdated.toLocaleTimeString()}
      </p>
    </div>
  )
}
```

### Conditional Rendering

```tsx
<Switch entityId="switch.irrigation_system">
  {({ isOn, toggle, attributes }) => {
    const isWaterRestricted = new Date().getMonth() >= 6 && new Date().getMonth() <= 8
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        {isWaterRestricted && (
          <p style={{ color: 'orange' }}>
            Water restrictions in effect
          </p>
        )}
        <button 
          onClick={toggle}
          disabled={isWaterRestricted && !isOn}
        >
          {isOn ? 'Turn Off' : 'Turn On'}
        </button>
      </div>
    )
  }}
</Switch>
```