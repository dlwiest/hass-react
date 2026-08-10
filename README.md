# hass-react

[![npm version](https://img.shields.io/npm/v/hass-react.svg)](https://www.npmjs.com/package/hass-react)
[![npm downloads](https://img.shields.io/npm/dm/hass-react.svg)](https://www.npmjs.com/package/hass-react)
[![Documentation](https://img.shields.io/badge/docs-hass--react.com-blue.svg)](https://hass-react.com)

A React library for building custom Home Assistant interfaces. Headless components and hooks give you live entity state and typed controls. The UI is entirely yours.

## Features

- **Headless & Unstyled** - Use with any UI library or custom CSS
- **Easy Real-time Updates** - One managed WebSocket connection shared by every hook and component
- **Optimized Re-renders** - Components only re-render when their entity data changes
- **Full TypeScript Support** - Complete type definitions for all supported entities
- **OAuth & Token Auth** - Flexible authentication with connection state tracking
- **External Transports** - Keep Home Assistant authentication server-side for kiosks and gateway-backed apps
- **Error Handling** - Typed errors with optional automatic retry for network failures
- **Mock Mode** - Develop and test without a live Home Assistant instance
- **17 Entity Types** - Lights, climate, alarms, cameras, media players, sensors, and more
- **Camera Streaming** - HLS and MJPEG stream support with static images

## Installation

```bash
npm install hass-react
```

## Quick Start

Every entity works as a render-prop component or a hook. Use whichever fits:

```jsx
import { HAProvider, Light, useLight } from 'hass-react'

// As a component
function LightCard() {
  return (
    <Light entityId="light.living_room">
      {({ isOn, brightness, toggle, setBrightness }) => (
        <div>
          <h3>Living Room</h3>
          <button onClick={toggle}>{isOn ? 'ON' : 'OFF'}</button>
          {isOn && (
            <input
              type="range"
              min="0"
              max="255"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
            />
          )}
        </div>
      )}
    </Light>
  )
}

// As a hook
function LightCard() {
  const light = useLight('light.living_room')

  return (
    <div>
      <h3>Living Room</h3>
      <button onClick={light.toggle}>{light.isOn ? 'ON' : 'OFF'}</button>
      {light.isOn && (
        <input
          type="range"
          min="0"
          max="255"
          value={light.brightness}
          onChange={(e) => light.setBrightness(parseInt(e.target.value))}
        />
      )}
    </div>
  )
}

// Wrap your app with HAProvider
function App() {
  return (
    <HAProvider url="http://homeassistant.local:8123">
      <LightCard />
    </HAProvider>
  )
}
```

## Documentation

📚 **[Full Documentation](https://hass-react.com)** - Complete guides, API reference, and examples

### Key Topics
- **[Getting Started](https://hass-react.com/docs/intro)** - Setup and basic usage
- **[Authentication](https://hass-react.com/docs/authentication)** - OAuth and token configuration  
- **[External Transports](https://hass-react.com/docs/advanced/external-transports)** - Server-side authentication and custom connection adapters
- **[Entity Documentation](https://hass-react.com/docs/entities/light)** - All 17 supported entity types
- **[Error Handling](https://hass-react.com/docs/error-handling)** - Connection status and error patterns
- **[Development & Testing](https://hass-react.com/docs/development-testing)** - Mock mode and testing utilities

## Examples

Three complete dashboard examples showing different UI approaches:
- **[Vanilla React](./examples/vanilla-dashboard)** - Custom CSS
- **[shadcn/ui](./examples/shadcn-dashboard)** - Tailwind + Radix UI components  
- **[Material-UI](./examples/mui-dashboard)** - Material Design

## Contributing

The library works and is in active use, but the API may still grow as new entity types and features are added.

**Help wanted:**
- 🐛 **Bug reports** - If something breaks, open an issue
- 🧪 **Testing feedback** - Try it against your own setup and tell me what you find
- 💡 **Feature requests** - Missing an entity type or feature you need?
- 🤝 **Contributions** - PRs welcome, whether it's a new entity type or a docs fix

[Open an issue](https://github.com/dlwiest/hass-react/issues) or [start a discussion](https://github.com/dlwiest/hass-react/discussions)

## License

MIT © [dlwiest](https://github.com/dlwiest)
