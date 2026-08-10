---
sidebar_position: 1
---

# Getting Started

**hass-react** is a headless React library that provides hooks and components for building Home Assistant user interfaces without the hassle of WebSockets or service calls.

## Installation

```bash
npm install hass-react
```

## Setup

Wrap your app with `HAProvider` and point it to your Home Assistant instance:

```tsx
import { HAProvider } from 'hass-react'

function App() {
  return (
    <HAProvider url="http://homeassistant.local:8123">
      <YourApp />
    </HAProvider>
  )
}
```

The provider handles authentication automatically using OAuth 2.0 (recommended) or long-lived tokens.

## Your First Control

hass-react offers two ways to work with entities: **components** with render props or **hooks** for direct access.

### Using Components (Render Props)

```tsx
import { Light } from 'hass-react'

function LightControl() {
  return (
    <Light entityId="light.floor_lamp">
      {({ isOn, toggle, attributes }) => (
        <div>
          <h3>{attributes.friendly_name}</h3>
          <button onClick={toggle}>
            {isOn ? 'Turn Off' : 'Turn On'}
          </button>
        </div>
      )}
    </Light>
  )
}
```

### Using Hooks

```tsx
import { useLight } from 'hass-react'

function LightControl() {
  const light = useLight('light.floor_lamp')
  
  return (
    <div>
      <h3>{light.attributes.friendly_name}</h3>
      <button onClick={light.toggle}>
        {light.isOn ? 'Turn Off' : 'Turn On'}
      </button>
    </div>
  )
}
```

Both do the same thing. Pick whichever pattern you prefer.

## Performance Benefits

Subscriptions are managed for you:

- **One server subscription** - The store opens a single `state_changed` subscription and fans events out locally, no matter how many components are mounted
- **Targeted notifications** - Each component registers for its own entity, so an event only wakes the components watching that entity
- **Batched initial load** - Components mounting together share one `get_states` snapshot instead of sending a request each
- **Automatic cleanup** - Registrations are removed when a component unmounts

## Next Steps

- **[Authentication](/docs/authentication)** - Configure OAuth or token authentication
- **[Lights](/docs/entities/light)** - Control lights with brightness, color, and effects
- Browse the [GitHub repository](https://github.com/dlwiest/hass-react) for more examples