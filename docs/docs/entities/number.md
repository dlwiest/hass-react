---
sidebar_position: 8
---

# Number

Numeric input controls with configurable min/max/step values.

## Quick Example

```tsx
// Component approach
<Number entityId="number.speaker_volume">
  {({ value, setValue, increment, decrement }) => (
    <div>
      <button onClick={decrement}>-</button>
      <span>{value}%</span>
      <button onClick={increment}>+</button>
    </div>
  )}
</Number>

// Hook approach
const volume = useNumber('number.speaker_volume')
<input
  type="range"
  min={volume.min}
  max={volume.max}
  step={volume.step}
  value={volume.value ?? volume.min}
  onChange={(e) => volume.setValue(parseFloat(e.target.value))}
/>
```

## Component API

### Basic Usage

```tsx
import { Number } from 'hass-react'

<Number entityId="number.speaker_volume">
  {(numberProps) => (
    // Your UI here
  )}
</Number>
```

### Render Props

The Number component passes these props to your render function:

#### State Properties
- **`value`** (`number | null`) - Current numeric value, or `null` when the entity is unavailable
- **`min`** (`number`) - Minimum allowed value
- **`max`** (`number`) - Maximum allowed value
- **`step`** (`number`) - Step increment/decrement size
- **`unit`** (`string | undefined`) - Unit of measurement (e.g., "%", "°F")
- **`deviceClass`** (`string | undefined`) - Device class (e.g., "temperature", "humidity")
- **`mode`** (`'auto' | 'box' | 'slider'`) - UI mode hint from Home Assistant (defaults to `'auto'`)

#### Control Methods
- **`setValue(value: number)`** - Set the value (rejects non-finite numbers, clamps to min/max)
- **`increment()`** - Increase value by step amount (does nothing while `value` is `null`)
- **`decrement()`** - Decrease value by step amount (does nothing while `value` is `null`)

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useNumber } from 'hass-react'

function MyComponent() {
  const numberEntity = useNumber('number.speaker_volume')

  // All the same properties as component render props
  return <div>{numberEntity.value}{numberEntity.unit}</div>
}
```

The `useNumber` hook returns an object with all the same properties and methods as the component's render props.

## List All Numbers

The `useNumbers` hook returns every number entity Home Assistant knows about:

```tsx
import { useNumbers } from 'hass-react'

function NumberList() {
  const numbers = useNumbers()

  return (
    <div>
      <h2>Available Numbers ({numbers.length})</h2>
      {numbers.map(number => (
        <div key={number.entity_id}>
          {number.attributes.friendly_name || number.entity_id}
        </div>
      ))}
    </div>
  )
}
```

Each item in the array is a raw entity object with `entity_id`, `state`, and `attributes`.

## Examples

### Simple Slider

```tsx
<Number entityId="number.speaker_volume">
  {({ value, setValue, min, max, step, unit }) => (
    <div>
      <label>Volume: {value}{unit}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => setValue(parseFloat(e.target.value))}
      />
    </div>
  )}
</Number>
```

### Number Card with Buttons

```tsx
<Number entityId="number.thermostat_offset">
  {({ value, increment, decrement, min, max, unit, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <div>
        <button onClick={decrement} disabled={value === null || value <= min}>
          -
        </button>
        <span>{value}{unit}</span>
        <button onClick={increment} disabled={value === null || value >= max}>
          +
        </button>
      </div>
      <p>Range: {min} - {max}{unit}</p>
    </div>
  )}
</Number>
```

### Combined Slider and Buttons

```tsx
<Number entityId="number.brightness_threshold">
  {({ value, setValue, increment, decrement, min, max, step, unit }) => (
    <div>
      <h4>Brightness Threshold</h4>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => setValue(parseFloat(e.target.value))}
      />
      <div>
        <span>{min}{unit}</span>
        <div>
          <button onClick={decrement}>-</button>
          <span>{value}{unit}</span>
          <button onClick={increment}>+</button>
        </div>
        <span>{max}{unit}</span>
      </div>
    </div>
  )}
</Number>
```

### Number Input Field

```tsx
<Number entityId="number.countdown_timer">
  {({ value, setValue, min, max, step, attributes }) => (
    <div>
      <label htmlFor="timer">{attributes.friendly_name}</label>
      <input
        id="timer"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => setValue(parseFloat(e.target.value))}
      />
    </div>
  )}
</Number>
```

### Using Hooks

```tsx
import { useNumber } from 'hass-react'

function VolumeControl({ entityId }) {
  const volume = useNumber(entityId)

  return (
    <div>
      <h3>{volume.attributes.friendly_name}</h3>
      <input
        type="range"
        min={volume.min}
        max={volume.max}
        step={volume.step}
        value={volume.value ?? volume.min}
        onChange={(e) => volume.setValue(parseFloat(e.target.value))}
      />
      <p>{volume.value}{volume.unit}</p>
      <div>
        <button onClick={() => volume.setValue(volume.min)}>Min</button>
        <button onClick={volume.decrement}>-</button>
        <button onClick={volume.increment}>+</button>
        <button onClick={() => volume.setValue(volume.max)}>Max</button>
      </div>
    </div>
  )
}
```

### Validation Display

```tsx
<Number entityId="number.pool_temperature">
  {({ value, setValue, min, max, step, unit }) => {
    const [inputValue, setInputValue] = React.useState(value?.toString() ?? '')
    const [error, setError] = React.useState('')

    const handleChange = (e) => {
      const newValue = e.target.value
      setInputValue(newValue)

      const num = parseFloat(newValue)
      if (isNaN(num)) {
        setError('Please enter a valid number')
      } else if (num < min) {
        setError(`Value must be at least ${min}${unit}`)
      } else if (num > max) {
        setError(`Value must be at most ${max}${unit}`)
      } else if (Math.abs((num - min) % step) > 1e-8) {
        setError(`Value must be in increments of ${step}${unit}`)
      } else {
        setError('')
        setValue(num)
      }
    }

    return (
      <div>
        <label>Pool Temperature</label>
        <input
          type="number"
          value={inputValue}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
        />
        {error && <p>{error}</p>}
      </div>
    )
  }}
</Number>
```

## Notes

- `value` is `null` while the entity is unavailable or its state isn't numeric. `increment` and `decrement` do nothing in that case, and controlled inputs need a fallback (the examples above use `value ?? min`)
- `setValue` rejects non-finite numbers (NaN, Infinity) with a thrown error and clamps everything else to the min/max bounds
- `increment` and `decrement` move by `step` and stop at the bounds
- Typical number entities: volume, temperature offsets, brightness thresholds
