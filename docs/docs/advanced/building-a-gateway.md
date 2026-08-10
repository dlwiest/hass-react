---
sidebar_position: 4
---

# Building a Gateway

[External Transports](/docs/advanced/external-transports) covers the contract hass-react expects. This page builds the other half: the gateway server that owns your Home Assistant credential, plus the browser transport that talks to it.

```text
Home Assistant  <-- WebSocket, long-lived token -->  gateway (Node)
gateway  <-- SSE events + HTTP commands -->  browser running hass-react
```

The browser never sees the token. It sends commands to an HTTP endpoint and receives `state_changed` events over one Server-Sent Events stream. hass-react treats the pair as a connection and keeps all of its usual behavior: entity subscriptions, service calls, and reconnection.

## Running the example

The complete server is about 130 lines and lives in [`examples/transport-gateway`](https://github.com/dlwiest/hass-react/tree/master/examples/transport-gateway). Grab both halves directly:

```bash
curl -O https://raw.githubusercontent.com/dlwiest/hass-react/master/examples/transport-gateway/server.mjs
curl -O https://raw.githubusercontent.com/dlwiest/hass-react/master/examples/transport-gateway/client-transport.js
```

Node 22 or newer, one dependency:

```bash
npm install home-assistant-js-websocket
HA_URL=http://homeassistant.local:8123 HA_TOKEN=<long-lived token> node server.mjs
```

The rest of this page walks through how it's put together, in the order you'd write it.

## Connecting upstream

The gateway talks to Home Assistant with `home-assistant-js-websocket`, the same client Home Assistant's own frontend uses (Node 22 provides the WebSocket implementation it needs). A long-lived token from your profile page authenticates it:

```js
import {
  createConnection,
  createLongLivedTokenAuth,
} from 'home-assistant-js-websocket'

const HA_URL = process.env.HA_URL ?? 'http://homeassistant.local:8123'
const HA_TOKEN = process.env.HA_TOKEN

const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN)
const connection = await createConnection({auth})
```

Upstream reconnection is free: `createConnection` retries on its own when Home Assistant restarts or drops.

The gateway holds exactly one upstream subscription and fans events out to every connected browser:

```js
const sseClients = new Set()

await connection.subscribeEvents((event) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const res of sseClients) res.write(payload)
}, 'state_changed')
```

## The browser-facing routes

Two routes on a plain `http` server. `GET /api/events` registers a browser for the event stream:

```js
if (req.method === 'GET' && req.url === '/api/events') {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  res.write(': connected\n\n')
  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))
  return
}
```

`POST /api/command` parses one JSON message and forwards it upstream:

```js
if (req.method === 'POST' && req.url === '/api/command') {
  // ...read the request body with a size bound (see the full example)...

  let message
  try {
    message = JSON.parse(body)
  } catch {
    res.writeHead(400).end(JSON.stringify({error: 'invalid JSON'}))
    return
  }

  if (!authorize(message)) {
    res.writeHead(403).end(JSON.stringify({error: `not allowed: ${message.type}`}))
    return
  }

  try {
    const result = await connection.sendMessagePromise(message)
    res.writeHead(200, {'content-type': 'application/json'})
    res.end(JSON.stringify(result ?? null))
  } catch (error) {
    const id = crypto.randomUUID()
    console.error(`command failed [${id}]`, error)
    res.writeHead(502, {'content-type': 'application/json'})
    // Error details stay in the gateway log; the browser gets a reference.
    res.end(JSON.stringify({error: 'upstream command failed', ref: id}))
  }
  return
}
```

Two details to keep: upstream error text stays in the gateway log and the browser gets a reference id, not Home Assistant internals. And that `authorize` call is load-bearing, because everything else on this page is an open proxy.

## The authorization boundary

Without `authorize`, any client that can reach the gateway can send any command to Home Assistant: unlock doors, disarm the alarm, call `homeassistant.stop`. The gateway's job is to narrow that to what your dashboard actually does. Enumerate it:

```js
const ALLOWED_COMMANDS = new Set(['get_states', 'auth/current_user'])

// domain -> allowed services. Extend deliberately, entry by entry.
const ALLOWED_SERVICES = {
  light: new Set(['turn_on', 'turn_off', 'toggle']),
  switch: new Set(['turn_on', 'turn_off', 'toggle']),
}

// domain -> entities the browser may target. null = any entity in the domain.
// Scope this to the entities your dashboard actually shows.
const ALLOWED_ENTITIES = {
  light: null,
  switch: null,
}

function targetedEntities(message) {
  // Home Assistant accepts the target in either field, as one id or a list.
  const raw = message.service_data?.entity_id ?? message.target?.entity_id
  if (raw === undefined) return []
  return Array.isArray(raw) ? raw : [raw]
}

function authorize(message) {
  if (ALLOWED_COMMANDS.has(message.type)) return true
  if (message.type !== 'call_service') return false

  if (!(ALLOWED_SERVICES[message.domain]?.has(message.service) ?? false)) {
    return false
  }

  const allowedEntities = ALLOWED_ENTITIES[message.domain]
  // A domain allowlisted without an entity decision fails closed.
  if (allowedEntities === undefined) return false
  if (allowedEntities === null) return true
  const targets = targetedEntities(message)
  return targets.length > 0 && targets.every((id) => allowedEntities.has(id))
}
```

A request that doesn't match is rejected before it touches Home Assistant. Setting an entity set instead of `null` narrows control to exactly the devices your dashboard shows.

## The client transport

The browser half implements `HATransport` over `fetch` and `EventSource`:

```js
export function createGatewayTransport(baseUrl) {
  // connection -> its EventSource, so disconnect() closes the right session.
  const sessions = new Map()

  return {
    connect(handlers) {
      return new Promise((resolve, reject) => {
        const events = new EventSource(`${baseUrl}/api/events`)
        const subscribers = new Map() // eventType|undefined -> Set<callback>
        let settled = false
        let notifiedDisconnect = false

        const connection = {
          async sendMessagePromise(message) {
            const response = await fetch(`${baseUrl}/api/command`, {
              method: 'POST',
              headers: {'content-type': 'application/json'},
              body: JSON.stringify(message),
            })
            if (!response.ok) {
              throw new Error(`gateway returned ${response.status}`)
            }
            return response.json()
          },

          async subscribeEvents(callback, eventType) {
            const callbacks = subscribers.get(eventType) ?? new Set()
            callbacks.add(callback)
            subscribers.set(eventType, callbacks)
            return () => {
              callbacks.delete(callback)
            }
          },
        }

        events.onopen = () => {
          settled = true
          sessions.set(connection, events)
          resolve(connection)
        }

        events.onmessage = ({data}) => {
          const event = JSON.parse(data)
          subscribers.get(event.event_type)?.forEach((cb) => cb(event))
          subscribers.get(undefined)?.forEach((cb) => cb(event))
        }

        events.onerror = () => {
          if (!settled) {
            settled = true
            events.close()
            reject(new Error('gateway event stream unavailable'))
          } else if (!notifiedDisconnect) {
            notifiedDisconnect = true
            events.close()
            sessions.delete(connection)
            handlers.onDisconnected()
          }
        }
      })
    },

    disconnect(connection) {
      sessions.get(connection)?.close()
      sessions.delete(connection)
    },
  }
}
```

One design rule matters here: **every `connect()` call builds an independent session.** The EventSource, the subscriber registry, and the settled flags all live inside the call. HAProvider can legitimately run overlapping connect attempts (React StrictMode double-mounts in development, and fast reconnect cycles in production), and it disconnects the attempts it abandons. If sessions share state, a stale attempt's `disconnect()` tears down the live one and the provider hangs in `connecting`. We know because our first draft did exactly that.

The transport also reports a lost stream once and stops. `EventSource` would happily retry on its own, but HAProvider owns reconnection policy; let it call `connect()` again with its own backoff.

## Wiring it up

```jsx
import { HAProvider } from 'hass-react'
import { createGatewayTransport } from './gateway-transport'

const transport = createGatewayTransport('http://dashboard.local:8131')

function App() {
  return (
    <HAProvider url="http://dashboard.local:8131" transport={transport}>
      <Dashboard />
    </HAProvider>
  )
}
```

Create the transport once, outside the component (or memoize it). `url` only resolves relative media URLs in this mode.

## What failure looks like

Verified against the example implementation:

- **Gateway dies:** the transport reports the loss, hass-react shows `disconnected`, then retries `connect()` on its usual backoff (1s, 2s, 4s...). When the gateway returns, the next attempt connects and entity state re-hydrates.
- **Home Assistant dies:** the gateway's upstream client reconnects on its own. Browsers stay connected to the gateway throughout; commands during the outage fail with 502 and a log reference.
- **Blocked command:** the gateway returns 403, which surfaces in hass-react as a normal failed service call.

## Hardening beyond the LAN

The example assumes a trusted network, which fits the wall-dashboard case. Before exposing a gateway any wider:

- Put a session in front of both routes (cookie or reverse-proxy auth). Token possession is the whole game.
- Set `ALLOWED_ORIGIN` to your dashboard's exact origin instead of `*`.
- Add rate limiting on `/api/command`.
- If the dashboard shows cameras, proxy `/api/camera_proxy` and `/api/hls/*` too; see [Camera Media](/docs/advanced/external-transports#camera-media).

The [Security Boundary](/docs/advanced/external-transports#security-boundary) section covers the full checklist.
