---
sidebar_position: 1
---

# Light

Control lights with brightness, color, effects, and more.

## Quick Example

```tsx
// Component approach
<Light entityId="light.floor_lamp">
  {({ isOn, toggle }) => (
    <button onClick={toggle}>
      {isOn ? 'ON' : 'OFF'}
    </button>
  )}
</Light>

// Hook approach  
const light = useLight('light.floor_lamp')
<button onClick={light.toggle}>
  {light.isOn ? 'ON' : 'OFF'}
</button>
```

## Component API

### Basic Usage

```tsx
import { Light } from 'hass-react'

<Light entityId="light.floor_lamp">
  {(lightProps) => (
    // Your UI here
  )}
</Light>
```

### Render Props

The Light component provides these props to your render function:

#### State Properties
- **`isOn`** (`boolean`) - Whether the light is currently on
- **`brightness`** (`number`) - Current brightness (0-255)
- **`brightnessPercent`** (`number`) - Current brightness as percentage (0-100)
- **`rgbColor`** (`[number, number, number]`) - RGB color values
- **`colorTemp`** (`number | undefined`) - Current color temperature in kelvin from `color_temp_kelvin`
- **`effect`** (`string`) - Current effect name

#### Support Properties
- **`supportsBrightness`** (`boolean`) - Light supports brightness control
- **`supportsRgb`** (`boolean`) - Light supports RGB, RGBW, or RGBWW color control
- **`supportsColorTemp`** (`boolean`) - Light supports color temperature
- **`supportsEffects`** (`boolean`) - Light supports effects
- **`availableEffects`** (`string[]`) - List of available effect names

#### Control Methods
- **`toggle()`** - Toggle the light on/off
- **`turnOn()`** - Turn the light on
- **`turnOff()`** - Turn the light off
- **`setBrightness(value: number)`** - Set brightness (0-255)
- **`setRgbColor(rgb: [number, number, number])`** - Set RGB color
- **`setColorTemp(kelvin: number)`** - Set color temperature in kelvin
- **`setEffect(effect: string)`** - Set light effect

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useLight } from 'hass-react'

function MyComponent() {
  const light = useLight('light.floor_lamp')
  
  // All the same properties as component render props
  return <div>{light.isOn ? 'ON' : 'OFF'}</div>
}
```

The `useLight` hook returns an object with all the same properties and methods as the component's render props.

## List All Lights

Use the `useLights` hook to retrieve all available light entities:

```tsx
import { useLights } from 'hass-react'

function LightList() {
  const lights = useLights()

  return (
    <div>
      <h2>Available Lights ({lights.length})</h2>
      {lights.map(light => (
        <div key={light.entity_id}>
          {light.attributes.friendly_name || light.entity_id}
        </div>
      ))}
    </div>
  )
}
```

The `useLights` hook fetches all light entities from Home Assistant and returns an array of light objects.

## Examples

### Simple Toggle

```tsx
<Light entityId="light.living_room">
  {({ isOn, toggle, attributes }) => (
    <button onClick={toggle}>
      {attributes.friendly_name}: {isOn ? 'ON' : 'OFF'}
    </button>
  )}
</Light>
```

### Brightness Control

```tsx
<Light entityId="light.bedroom">
  {({ isOn, brightness, toggle, setBrightness, supportsBrightness }) => (
    <div>
      <button onClick={toggle}>
        {isOn ? 'Turn Off' : 'Turn On'}
      </button>
      {isOn && supportsBrightness && (
        <input
          type="range"
          min="0" max="255"
          value={brightness}
          onChange={(e) => setBrightness(parseInt(e.target.value))}
        />
      )}
    </div>
  )}
</Light>
```

### RGB Color Picker

```tsx
<Light entityId="light.rgb_strip">
  {({ isOn, rgbColor, setRgbColor, supportsRgb }) => (
    <div>
      {isOn && supportsRgb && (
        <input
          type="color"
          value={`#${rgbColor.map(c => c.toString(16).padStart(2, '0')).join('')}`}
          onChange={(e) => {
            const hex = e.target.value.slice(1)
            const rgb = [
              parseInt(hex.slice(0, 2), 16),
              parseInt(hex.slice(2, 4), 16),
              parseInt(hex.slice(4, 6), 16)
            ]
            setRgbColor(rgb)
          }}
        />
      )}
    </div>
  )}
</Light>
```

### Color Temperature in Kelvin

Color temperature uses Home Assistant's `color_temp_kelvin` value.
Use `min_color_temp_kelvin` and `max_color_temp_kelvin` from the entity attributes as the control bounds.

```tsx
<Light entityId="light.tunable_white">
  {({ colorTemp, setColorTemp, supportsColorTemp, attributes }) => {
    const minKelvin = attributes.min_color_temp_kelvin
    const maxKelvin = attributes.max_color_temp_kelvin

    if (!supportsColorTemp || minKelvin === undefined || maxKelvin === undefined) {
      return null
    }

    return (
      <label>
        Color temperature: {colorTemp ?? minKelvin} K
        <input
          type="range"
          min={minKelvin}
          max={maxKelvin}
          value={colorTemp ?? minKelvin}
          onChange={(event) => setColorTemp(Number(event.target.value))}
        />
      </label>
    )
  }}
</Light>
```

### Full Featured Control

```tsx
<Light entityId="light.smart_bulb">
  {({ 
    isOn, brightness, rgbColor, effect, availableEffects,
    supportsBrightness, supportsRgb, supportsEffects,
    toggle, setBrightness, setRgbColor, setEffect,
    attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <button onClick={toggle}>
        {isOn ? 'Turn Off' : 'Turn On'}
      </button>
      
      {isOn && supportsBrightness && (
        <div>
          <label>Brightness: {Math.round((brightness / 255) * 100)}%</label>
          <input
            type="range"
            min="0" max="255"
            value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value))}
          />
        </div>
      )}
      
      {isOn && supportsRgb && (
        <div>
          <label>Color:</label>
          <input
            type="color"
            value={`#${rgbColor.map(c => c.toString(16).padStart(2, '0')).join('')}`}
            onChange={(e) => {
              const hex = e.target.value.slice(1)
              const rgb = [
                parseInt(hex.slice(0, 2), 16),
                parseInt(hex.slice(2, 4), 16),
                parseInt(hex.slice(4, 6), 16)
              ]
              setRgbColor(rgb)
            }}
          />
        </div>
      )}
      
      {isOn && supportsEffects && availableEffects.length > 0 && (
        <div>
          <label>Effect:</label>
          <select value={effect || ''} onChange={(e) => setEffect(e.target.value)}>
            <option value="">None</option>
            {availableEffects.map(effectName => (
              <option key={effectName} value={effectName}>
                {effectName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )}
</Light>
```

### Using Hooks

```tsx
import { useLight } from 'hass-react'

function LightCard({ entityId }) {
  const light = useLight(entityId)
  
  return (
    <div>
      <h3>{light.attributes.friendly_name}</h3>
      <button onClick={light.toggle}>
        {light.isOn ? 'ON' : 'OFF'}
      </button>
      
      {light.isOn && light.supportsBrightness && (
        <input
          type="range"
          min="0" max="255"
          value={light.brightness}
          onChange={(e) => light.setBrightness(parseInt(e.target.value))}
        />
      )}
    </div>
  )
}
```