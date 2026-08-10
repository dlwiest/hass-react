---
sidebar_position: 3
---

# Binary Sensor

Track on/off sensors: doors and windows, motion, smoke, water leaks.

## Quick Example

```tsx
// Component approach
<BinarySensor entityId="binary_sensor.front_door">
  {({ isOn, isOff, deviceClass }) => (
    <div>
      Front Door: {isOn ? 'OPEN' : 'CLOSED'}
    </div>
  )}
</BinarySensor>

// Hook approach
const doorSensor = useBinarySensor('binary_sensor.front_door')
<div>
  {doorSensor.attributes.friendly_name}: {doorSensor.isOn ? 'OPEN' : 'CLOSED'}
</div>
```

## Component API

### Basic Usage

```tsx
import { BinarySensor } from 'hass-react'

<BinarySensor entityId="binary_sensor.front_door">
  {(sensorProps) => (
    // Your UI here
  )}
</BinarySensor>
```

### Render Props

Available render props:

#### State Properties
- **`isOn`** (`boolean`) - Whether the sensor is in the "on" state (triggered)
- **`isOff`** (`boolean`) - Whether the sensor is in the "off" state (not triggered)
- **`deviceClass`** (`string | undefined`) - Device class (door, motion, smoke, etc.)
- **`icon`** (`string | undefined`) - Icon for the sensor

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useBinarySensor } from 'hass-react'

function MyComponent() {
  const sensor = useBinarySensor('binary_sensor.front_door')
  
  // All the same properties as component render props
  return <div>{sensor.isOn ? 'TRIGGERED' : 'CLEAR'}</div>
}
```

The returned object matches the component's render props.

## List All Binary Sensors

`useBinarySensors` lists every binary sensor:

```tsx
import { useBinarySensors } from 'hass-react'

function BinarySensorList() {
  const binarySensors = useBinarySensors()

  return (
    <div>
      <h2>Available Binary Sensors ({binarySensors.length})</h2>
      {binarySensors.map(sensor => (
        <div key={sensor.entity_id}>
          {sensor.attributes.friendly_name || sensor.entity_id}
        </div>
      ))}
    </div>
  )
}
```

## Examples

### Door Sensor

```tsx
<BinarySensor entityId="binary_sensor.front_door">
  {({ isOn, deviceClass, attributes, lastChanged }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isOn ? 'OPEN' : 'CLOSED'}</p>
      <p>Device Class: {deviceClass}</p>
      <p>Last Changed: {lastChanged.toLocaleString()}</p>
    </div>
  )}
</BinarySensor>
```

### Motion Sensor

```tsx
<BinarySensor entityId="binary_sensor.living_room_motion">
  {({ isOn, attributes, lastChanged }) => {
    const secondsAgo = Math.floor((Date.now() - lastChanged.getTime()) / 1000)
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Motion: {isOn ? 'DETECTED' : 'NONE'}</p>
        {isOn && <p>Detected {secondsAgo} seconds ago</p>}
      </div>
    )
  }}
</BinarySensor>
```

### Smoke/Fire Alarm

```tsx
<BinarySensor entityId="binary_sensor.smoke_detector">
  {({ isOn, deviceClass, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isOn ? 'ALARM TRIGGERED' : 'ALL CLEAR'}</p>
      <p>Device Class: {deviceClass}</p>
      {isOn && <p style={{ color: 'red' }}>IMMEDIATE ATTENTION REQUIRED</p>}
    </div>
  )}
</BinarySensor>
```

### Multiple Sensors

```tsx
function SecurityPanel() {
  const sensors = [
    'binary_sensor.front_door',
    'binary_sensor.back_door', 
    'binary_sensor.living_room_motion',
    'binary_sensor.smoke_detector'
  ]
  
  return (
    <div>
      <h2>Security System Status</h2>
      {sensors.map(entityId => (
        <BinarySensor key={entityId} entityId={entityId}>
          {({ isOn, deviceClass, attributes }) => (
            <div>
              <strong>{attributes.friendly_name}</strong>: {isOn ? 'TRIGGERED' : 'SECURE'}
              <br />
              Type: {deviceClass}
            </div>
          )}
        </BinarySensor>
      ))}
    </div>
  )
}
```

### Water Leak Sensor

```tsx
<BinarySensor entityId="binary_sensor.basement_water_leak">
  {({ isOn, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isOn ? 'WATER DETECTED' : 'DRY'}</p>
      {isOn && <p style={{ color: 'red' }}>Check for water damage immediately!</p>}
    </div>
  )}
</BinarySensor>
```

### Conditional Display

```tsx
<BinarySensor entityId="binary_sensor.garage_door">
  {({ isOn, attributes }) => (
    <div>
      <span>{attributes.friendly_name}: {isOn ? 'Open' : 'Closed'}</span>
      {isOn && <span style={{ color: 'orange' }}> - Action Required</span>}
    </div>
  )}
</BinarySensor>
```

### Using Hooks

```tsx
import { useBinarySensor } from 'hass-react'

function BinarySensorCard({ entityId }) {
  const sensor = useBinarySensor(entityId)
  
  const getStatusText = (deviceClass: string | undefined, isOn: boolean) => {
    switch (deviceClass) {
      case 'door':
      case 'window':
        return isOn ? 'OPEN' : 'CLOSED'
      case 'motion':
      case 'occupancy':
        return isOn ? 'DETECTED' : 'CLEAR'
      case 'smoke':
      case 'safety':
        return isOn ? 'ALARM' : 'SAFE'
      case 'moisture':
        return isOn ? 'WET' : 'DRY'
      default:
        return isOn ? 'ON' : 'OFF'
    }
  }
  
  return (
    <div>
      <h3>{sensor.attributes.friendly_name}</h3>
      <p>Status: {getStatusText(sensor.deviceClass, sensor.isOn)}</p>
      <p>Device Class: {sensor.deviceClass}</p>
      <p>Last Changed: {sensor.lastChanged.toLocaleTimeString()}</p>
    </div>
  )
}