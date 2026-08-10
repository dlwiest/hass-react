---
sidebar_position: 3
---

# External Transports

Use an external transport when the browser should not authenticate directly with Home Assistant. This is useful for kiosks, wall-mounted dashboards, server-rendered applications, and backend-for-frontend architectures where a server owns the Home Assistant credentials.

```text
Home Assistant
      ↕ authenticated WebSocket
application gateway
      ↕ application-defined HTTP/SSE/WebSocket
browser using hass-react
```

`hass-react` continues to manage entity subscriptions, hook state, service calls, connection status, and retries. Your transport adapts the application protocol to the small connection surface used by the library.

## Why Use an External Transport

Connecting the browser directly to Home Assistant means every viewer authenticates against it. An external transport removes that requirement, which matters in three common situations:

- **Always-on dashboards that must never show a login screen.** Browser sessions depend on refresh tokens that Home Assistant can expire or invalidate, and browsers can evict stored credentials. A wall-mounted dashboard eventually lands back on a login prompt. With a transport, the gateway holds a long-lived token on the server and the browser never authenticates with Home Assistant, so there is nothing in the client to expire.
- **Keeping credentials out of the browser.** Embedding a long-lived token in client code exposes it to every device that can load the page. The gateway keeps the credential server-side and exposes only what the application needs.
- **Viewers who are not Home Assistant users.** Family members, guests, or kiosk hardware can use the application without individual Home Assistant accounts. Authorization becomes the application's decision instead of Home Assistant's.

## Provider Setup

```tsx
import { HAProvider, type HATransport } from 'hass-react'

const gatewayTransport: HATransport = createGatewayTransport()

export function App() {
  return (
    <HAProvider url="https://dashboard.example.com" transport={gatewayTransport}>
      <Dashboard />
    </HAProvider>
  )
}
```

Set `url` to the public application or gateway base URL. It is used to resolve relative media URLs; it does not need to be the private Home Assistant URL. `token` and `authMode` are not used in this mode. If `transport` is supplied alongside `mockMode`, the external transport takes precedence.

Keep the transport instance stable. Create it outside the component or memoize it rather than constructing it during every render.

## Transport Contract

```ts
interface HAConnection {
  sendMessagePromise<T = unknown>(
    message: Record<string, unknown>
  ): Promise<T>

  subscribeEvents<T = StateChangedEvent>(
    callback: (event: T) => void,
    eventType?: string
  ): Promise<() => void>
}

interface HATransportHandlers {
  onDisconnected(): void
}

interface HATransport {
  connect(handlers: HATransportHandlers): Promise<HAConnection>
  disconnect(connection: HAConnection): void | Promise<void>
  logout?(): void | Promise<void>
}
```

A native `home-assistant-js-websocket` connection already satisfies `HAConnection`. Custom transports can implement the same behavior using another browser-facing protocol.

Existing direct-connection code keeps the native `Connection` return type from `useHAConnection()`. Code that accesses the low-level connection in external mode should select the transport surface explicitly:

```ts
const { connection } = useHAConnection<HAConnection>()
```

### `connect`

Open the browser-facing channel and resolve with an `HAConnection` when it is ready. Reject the promise if the initial connection fails.

Call `handlers.onDisconnected()` if an established channel is unexpectedly lost. `HAProvider` then applies its normal `autoReconnect` policy and calls `connect` again.

### `sendMessagePromise`

Send a Home Assistant WebSocket-shaped command through the gateway and resolve with its response. Existing hooks use messages such as:

- `get_states`
- `call_service`
- Service calls with `return_response: true`, including `todo.get_items`

Reject unsupported commands and gateway errors rather than returning fabricated responses.

### `subscribeEvents`

Register a callback for Home Assistant-shaped events. State events must retain the structure expected by the entity store, including `event.data.entity_id` and `event.data.new_state`.

Return an unsubscribe function. A transport may multiplex all subscribers over one SSE or WebSocket connection; it does not need to create a network connection for every subscription.

### `disconnect` and `logout`

`disconnect` closes local resources and should be safe to call during reconnect and unmount cleanup. It should not report an intentional close through `onDisconnected`.

`logout` is optional. Use it only if the application gateway maintains a browser session that can be invalidated.

## Minimal Shape

This abbreviated example uses one event stream and an HTTP command endpoint:

```ts
import type {
  HAConnection,
  HATransport,
  HATransportHandlers,
} from 'hass-react'

export function createGatewayTransport(): HATransport {
  let events: EventSource | null = null
  const subscribers = new Map<string | undefined, Set<(event: unknown) => void>>()

  const connection: HAConnection = {
    async sendMessagePromise<T>(message: Record<string, unknown>): Promise<T> {
      const response = await fetch('/ha-gateway/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message),
      })

      if (!response.ok) throw new Error(`Gateway returned ${response.status}`)
      return response.json() as Promise<T>
    },

    async subscribeEvents<T>(
      callback: (event: T) => void,
      eventType?: string
    ): Promise<() => void> {
      const callbacks = subscribers.get(eventType) ?? new Set()
      callbacks.add(callback as (event: unknown) => void)
      subscribers.set(eventType, callbacks)

      return () => {
        callbacks.delete(callback as (event: unknown) => void)
      }
    },
  }

  return {
    async connect(handlers: HATransportHandlers) {
      events = new EventSource('/ha-gateway/events')

      events.onmessage = ({ data }) => {
        const event = JSON.parse(data)
        subscribers.get(event.event_type)?.forEach((callback) => callback(event))
        subscribers.get(undefined)?.forEach((callback) => callback(event))
      }

      events.onerror = () => handlers.onDisconnected()
      return connection
    },

    disconnect() {
      events?.close()
      events = null
    },
  }
}
```

Production transports should wait for an explicit ready signal before resolving `connect`, handle duplicate disconnect notifications, and validate response bodies.

## Camera Media

Still images and MJPEG streams from `useCamera` require the camera entity's access token plus direct HTTP access to Home Assistant's `/api/camera_proxy` endpoints, so they are disabled in external transport mode: `imageUrl` is `null` and `getStreamUrl({ type: 'mjpeg' })` resolves to `null`.

HLS streaming can work through a transport: the `camera/stream` command is sent over the connection, and the returned playlist path is resolved against `url`. For HLS to play, the gateway must permit the `camera/stream` command and proxy the returned `/api/hls/...` playlist and segment paths under that same base URL.

## Security Boundary

An external transport does **not** make an unrestricted Home Assistant proxy safe automatically. The gateway is part of your application's authorization boundary.

At minimum, the gateway should:

- Keep Home Assistant credentials exclusively on the server
- Authenticate or otherwise restrict browser access appropriately
- Allowlist entity IDs, command types, domains, services, and fields
- Sanitize state and event payloads before forwarding them
- Enforce request size limits and timeouts
- Protect writable HTTP endpoints against cross-site requests
- Avoid logging tokens or sensitive service data

For example, a shopping dashboard could permit selected `todo` services only for `todo.shopping_list` instead of forwarding arbitrary `call_service` messages.
