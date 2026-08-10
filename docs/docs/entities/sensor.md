---
sidebar_position: 2
---

# Sensor

Read sensor values: temperature, humidity, power usage, anything Home Assistant reports as a sensor.

## Quick Example

```tsx
// Component approach
<Sensor entityId="sensor.living_room_temperature">
  {({ value, unitOfMeasurement, deviceClass }) => (
    <div>
      Temperature: {value}{unitOfMeasurement}
    </div>
  )}
</Sensor>

// Hook approach
const tempSensor = useSensor('sensor.living_room_temperature')
<div>
  {tempSensor.attributes.friendly_name}: {tempSensor.value}{tempSensor.unitOfMeasurement}
</div>
```

## Component API

### Basic Usage

```tsx
import { Sensor } from 'hass-react'

<Sensor entityId="sensor.living_room_temperature">
  {(sensorProps) => (
    // Your UI here
  )}
</Sensor>
```

### Render Props

The render function receives:

#### State Properties
- **`value`** (`string | number | null`) - Current sensor value
- **`numericValue`** (`number | null`) - Numeric value (if parseable)
- **`unitOfMeasurement`** (`string | undefined`) - Unit of measurement (°C, %, kWh, etc.)
- **`deviceClass`** (`string | undefined`) - Device class (temperature, humidity, power, etc.)
- **`stateClass`** (`string | undefined`) - State class (measurement, total, etc.)
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
import { useSensor } from 'hass-react'

function MyComponent() {
  const sensor = useSensor('sensor.living_room_temperature')
  
  // All the same properties as component render props
  return <div>{sensor.value}{sensor.unitOfMeasurement}</div>
}
```

Everything from the component's render props is on this object.

## List All Sensors

`useSensors` returns every sensor entity as an array:

```tsx
import { useSensors } from 'hass-react'

function SensorList() {
  const sensors = useSensors()

  return (
    <div>
      <h2>Available Sensors ({sensors.length})</h2>
      {sensors.map(sensor => (
        <div key={sensor.entity_id}>
          {sensor.attributes.friendly_name || sensor.entity_id}
        </div>
      ))}
    </div>
  )
}
```

## Examples

### Temperature Sensor

```tsx
<Sensor entityId="sensor.outdoor_temperature">
  {({ value, numericValue, unitOfMeasurement, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Temperature: {value}{unitOfMeasurement}</p>
      {numericValue !== null && (
        <p>Condition: {numericValue > 80 ? 'Hot' : numericValue > 60 ? 'Warm' : numericValue > 32 ? 'Cool' : 'Freezing'}</p>
      )}
    </div>
  )}
</Sensor>
```

### Humidity Sensor

```tsx
<Sensor entityId="sensor.bathroom_humidity">
  {({ value, numericValue, unitOfMeasurement, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Humidity: {value}{unitOfMeasurement}</p>
      {numericValue !== null && (
        <p>Level: {numericValue > 60 ? 'High humidity' : numericValue > 40 ? 'Normal' : 'Low humidity'}</p>
      )}
    </div>
  )}
</Sensor>
```

### Power Usage Sensor

```tsx
<Sensor entityId="sensor.washing_machine_power">
  {({ value, numericValue, unitOfMeasurement, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Power: {value}{unitOfMeasurement}</p>
      {numericValue !== null && (
        <p>Status: {numericValue > 100 ? 'Running' : numericValue > 10 ? 'Standby' : 'Off'}</p>
      )}
    </div>
  )}
</Sensor>
```

### Multiple Sensors

```tsx
function SensorGrid() {
  const sensors = [
    'sensor.living_room_temperature',
    'sensor.living_room_humidity', 
    'sensor.outdoor_temperature',
    'sensor.energy_usage'
  ]
  
  return (
    <div>
      <h2>Sensor Dashboard</h2>
      {sensors.map(entityId => (
        <Sensor key={entityId} entityId={entityId}>
          {({ value, unitOfMeasurement, deviceClass, attributes }) => (
            <div>
              <strong>{attributes.friendly_name}</strong>: {value}{unitOfMeasurement}
              <br />
              Type: {deviceClass}
            </div>
          )}
        </Sensor>
      ))}
    </div>
  )
}
```

### Sensor with Details

```tsx
<Sensor entityId="sensor.solar_power_generation">
  {({ value, numericValue, unitOfMeasurement, attributes, lastUpdated }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Current Generation: {value}{unitOfMeasurement}</p>
      <p>Status: {numericValue !== null && numericValue > 0 ? 'Generating' : 'No Generation'}</p>
      <p>Last Updated: {lastUpdated.toLocaleTimeString()}</p>
      <p>Device Class: {attributes.device_class || 'Generic'}</p>
    </div>
  )}
</Sensor>
```

### Battery Sensor

```tsx
<Sensor entityId="sensor.phone_battery_level">
  {({ value, numericValue, unitOfMeasurement, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Battery Level: {value}{unitOfMeasurement}</p>
      {numericValue !== null && (
        <p>Status: {numericValue > 50 ? 'Good' : numericValue > 20 ? 'Low' : 'Critical'}</p>
      )}
    </div>
  )}
</Sensor>
```

### Using Hooks

```tsx
import { useSensor } from 'hass-react'

function SensorCard({ entityId }) {
  const sensor = useSensor(entityId)
  
  const getTypeLabel = (deviceClass: string | undefined) => {
    switch (deviceClass) {
      case 'temperature': return 'Temperature'
      case 'humidity': return 'Humidity'
      case 'power': return 'Power'
      case 'energy': return 'Energy'
      case 'pressure': return 'Pressure'
      case 'illuminance': return 'Light'
      case 'battery': return 'Battery'
      default: return 'Sensor'
    }
  }
  
  return (
    <div>
      <h3>{sensor.attributes.friendly_name}</h3>
      <p>Type: {getTypeLabel(sensor.deviceClass)}</p>
      <p>Value: {sensor.value}{sensor.unitOfMeasurement}</p>
      <p>Updated: {sensor.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}
```