---
sidebar_position: 1
---

# Climate

Control thermostats and HVAC systems: target temperature, mode, fan, and presets.

## Quick Example

```tsx
// Component approach
<Climate entityId="climate.living_room">
  {({ currentTemperature, targetTemperature, mode, setMode, setTemperature }) => (
    <div>
      <p>Current: {currentTemperature}°F</p>
      <p>Target: {targetTemperature}°F</p>
      <button onClick={() => setMode(mode === 'heat' ? 'off' : 'heat')}>
        Mode: {mode}
      </button>
    </div>
  )}
</Climate>

// Hook approach
const thermostat = useClimate('climate.living_room')
<div>
  <p>Current: {thermostat.currentTemperature}°F</p>
  <button onClick={() => thermostat.setTemperature(72)}>
    Set to 72°F
  </button>
</div>
```

## Component API

### Basic Usage

```tsx
import { Climate } from 'hass-react'

<Climate entityId="climate.living_room">
  {(climateProps) => (
    // Your UI here
  )}
</Climate>
```

### Render Props

The Climate component provides these props to your render function:

#### State Properties
- **`currentTemperature`** (`number | undefined`) - Current temperature reading
- **`targetTemperature`** (`number | undefined`) - Target temperature setting
- **`targetTempHigh`** (`number | undefined`) - High target for heat/cool mode
- **`targetTempLow`** (`number | undefined`) - Low target for heat/cool mode
- **`humidity`** (`number | undefined`) - Current humidity percentage
- **`mode`** (`string`) - Current HVAC mode (heat, cool, auto, off, etc.)
- **`fanMode`** (`string | undefined`) - Current fan mode (auto, on, low, etc.)
- **`presetMode`** (`string | undefined`) - Current preset mode (away, home, sleep, etc.)

#### Support Properties
- **`supportsTargetTemperature`** (`boolean`) - Device supports setting target temperature
- **`supportsTargetTemperatureRange`** (`boolean`) - Device supports temperature range
- **`supportsFanMode`** (`boolean`) - Device supports fan mode control
- **`supportsPresetMode`** (`boolean`) - Device supports preset modes
- **`supportedModes`** (`string[]`) - List of available HVAC modes
- **`supportedFanModes`** (`string[]`) - List of available fan modes
- **`supportedPresetModes`** (`string[]`) - List of available preset modes
- **`minTemp`** (`number`) - Minimum supported temperature. If the device doesn't report one, falls back to 45°F or 7°C depending on the entity's temperature unit
- **`maxTemp`** (`number`) - Maximum supported temperature. Falls back to 95°F or 35°C the same way

#### Control Methods
- **`setMode(mode: string)`** - Set HVAC mode (heat, cool, auto, off, etc.)
- **`setTemperature(temp: number)`** - Set target temperature
- **`setTemperatureRange(low: number, high: number)`** - Set temperature range
- **`setFanMode(mode: string)`** - Set fan mode
- **`setPresetMode(preset: string)`** - Set preset mode

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useClimate } from 'hass-react'

function MyComponent() {
  const climate = useClimate('climate.living_room')
  
  // All the same properties as component render props
  return <div>Mode: {climate.mode} - {climate.currentTemperature}°F</div>
}
```

`useClimate` returns the same properties and methods as the component's render props.

## List All Climate Devices

The `useClimates` hook returns every climate entity Home Assistant knows about:

```tsx
import { useClimates } from 'hass-react'

function ClimateList() {
  const climates = useClimates()

  return (
    <div>
      <h2>Available Climate Devices ({climates.length})</h2>
      {climates.map(climate => (
        <div key={climate.entity_id}>
          {climate.attributes.friendly_name || climate.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns an array of climate entity objects, one per device.

## Examples

### Simple Thermostat

```tsx
<Climate entityId="climate.main_floor">
  {({ 
    currentTemperature, targetTemperature, mode,
    setMode, setTemperature, supportsTargetTemperature,
    supportedModes, minTemp, maxTemp, attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <div>
        <strong>Current: {currentTemperature}°F</strong>
        {supportsTargetTemperature && (
          <p>Target: {targetTemperature}°F</p>
        )}
      </div>
      
      <div>
        <label>Mode:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {supportedModes.map(modeOption => (
            <option key={modeOption} value={modeOption}>
              {modeOption.charAt(0).toUpperCase() + modeOption.slice(1)}
            </option>
          ))}
        </select>
      </div>
      
      {supportsTargetTemperature && mode !== 'off' && (
        <div>
          <label>Temperature: {targetTemperature}°F</label>
          <input
            type="range"
            min={minTemp}
            max={maxTemp}
            value={targetTemperature || minTemp}
            onChange={(e) => setTemperature(parseInt(e.target.value))}
          />
        </div>
      )}
    </div>
  )}
</Climate>
```

### Temperature Range Control

```tsx
<Climate entityId="climate.bedroom">
  {({ 
    currentTemperature, targetTempLow, targetTempHigh, mode,
    setMode, setTemperatureRange, supportsTargetTemperatureRange,
    supportedModes, minTemp, maxTemp, attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <p>Current: {currentTemperature}°F</p>
      
      <div>
        <label>Mode:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {supportedModes.map(modeOption => (
            <option key={modeOption} value={modeOption}>
              {modeOption.charAt(0).toUpperCase() + modeOption.slice(1)}
            </option>
          ))}
        </select>
      </div>
      
      {supportsTargetTemperatureRange && mode === 'heat_cool' && (
        <div>
          <div>
            <label>Low: {targetTempLow}°F</label>
            <input
              type="range"
              min={minTemp}
              max={maxTemp}
              value={targetTempLow || minTemp}
              onChange={(e) => setTemperatureRange(
                parseInt(e.target.value), 
                targetTempHigh || maxTemp
              )}
            />
          </div>
          
          <div>
            <label>High: {targetTempHigh}°F</label>
            <input
              type="range"
              min={minTemp}
              max={maxTemp}
              value={targetTempHigh || maxTemp}
              onChange={(e) => setTemperatureRange(
                targetTempLow || minTemp,
                parseInt(e.target.value)
              )}
            />
          </div>
        </div>
      )}
    </div>
  )}
</Climate>
```

### Full Featured Control

```tsx
<Climate entityId="climate.master_bedroom">
  {({
    currentTemperature, targetTemperature, humidity, mode, fanMode, presetMode,
    supportsTargetTemperature, supportsFanMode, supportsPresetMode,
    supportedModes, supportedFanModes, supportedPresetModes,
    setMode, setTemperature, setFanMode, setPresetMode,
    minTemp, maxTemp, attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <div>
        <div>
          <strong>Current Temp</strong>
          <p>{currentTemperature}°F</p>
        </div>
        {supportsTargetTemperature && (
          <div>
            <strong>Target Temp</strong>
            <p>{targetTemperature}°F</p>
          </div>
        )}
        {humidity !== undefined && (
          <div>
            <strong>Humidity</strong>
            <p>{humidity}%</p>
          </div>
        )}
      </div>

      <div>
        <label>HVAC Mode:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {supportedModes.map(modeOption => (
            <option key={modeOption} value={modeOption}>
              {modeOption.charAt(0).toUpperCase() + modeOption.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {supportsTargetTemperature && mode !== 'off' && (
        <div>
          <label>Temperature: {targetTemperature}°F</label>
          <input
            type="range"
            min={minTemp}
            max={maxTemp}
            value={targetTemperature || minTemp}
            onChange={(e) => setTemperature(parseInt(e.target.value))}
          />
          <div>
            <span>{minTemp}°F</span>
            <span>{maxTemp}°F</span>
          </div>
        </div>
      )}

      {supportsFanMode && supportedFanModes.length > 0 && (
        <div>
          <label>Fan Mode:</label>
          <select value={fanMode || ''} onChange={(e) => setFanMode(e.target.value)}>
            {supportedFanModes.map(fan => (
              <option key={fan} value={fan}>
                {fan.charAt(0).toUpperCase() + fan.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {supportsPresetMode && supportedPresetModes.length > 0 && (
        <div>
          <label>Preset:</label>
          <select value={presetMode || ''} onChange={(e) => setPresetMode(e.target.value)}>
            <option value="">None</option>
            {supportedPresetModes.map(preset => (
              <option key={preset} value={preset}>
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )}
</Climate>
```

### Quick Temperature Controls

```tsx
<Climate entityId="climate.office">
  {({
    currentTemperature, targetTemperature, mode,
    setTemperature, setMode, supportsTargetTemperature,
    attributes
  }) => {
    const quickTemps = [68, 70, 72, 74, 76]

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <div>
          <p>Current: {currentTemperature}°F</p>
          <p>Target: {targetTemperature}°F</p>
          <p>Mode: {mode}</p>
        </div>

        <button onClick={() => setMode(mode === 'off' ? 'heat' : 'off')}>
          {mode === 'off' ? 'Turn On' : 'Turn Off'}
        </button>

        {supportsTargetTemperature && mode !== 'off' && (
          <div>
            <p>Quick Set:</p>
            <div>
              {quickTemps.map(temp => (
                <button
                  key={temp}
                  onClick={() => setTemperature(temp)}
                >
                  {temp}°F
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }}
</Climate>
```

### Using Hooks

```tsx
import { useClimate } from 'hass-react'

function ThermostatCard({ entityId }) {
  const climate = useClimate(entityId)

  return (
    <div>
      <h3>{climate.attributes.friendly_name}</h3>
      <div>
        <div>
          <strong>{climate.currentTemperature}°F</strong>
          <div>Current</div>
        </div>
        {climate.supportsTargetTemperature && (
          <div>
            <strong>{climate.targetTemperature}°F</strong>
            <div>Target</div>
          </div>
        )}
        <div>
          <strong>{climate.mode}</strong>
          <div>Mode</div>
        </div>
      </div>

      <div>
        <button
          onClick={() => climate.setMode('heat')}
          disabled={climate.mode === 'heat'}
        >
          Heat
        </button>
        <button
          onClick={() => climate.setMode('cool')}
          disabled={climate.mode === 'cool'}
        >
          Cool
        </button>
        <button
          onClick={() => climate.setMode('off')}
          disabled={climate.mode === 'off'}
        >
          Off
        </button>
      </div>

      {climate.supportsTargetTemperature && climate.mode !== 'off' && (
        <div>
          <button onClick={() => climate.setTemperature((climate.targetTemperature || 70) - 1)}>
            -
          </button>
          <span>{climate.targetTemperature}°F</span>
          <button onClick={() => climate.setTemperature((climate.targetTemperature || 70) + 1)}>
            +
          </button>
        </div>
      )}
    </div>
  )
}