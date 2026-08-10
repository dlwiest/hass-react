# Transport gateway example

A minimal server that owns your Home Assistant credential so the browser never sees it, paired with the hass-react transport that talks to it. The full walkthrough lives in the docs: [Building a Gateway](https://hass-react.com/docs/advanced/building-a-gateway).

## Run it

```bash
HA_URL=http://homeassistant.local:8123 HA_TOKEN=<long-lived token> node server.mjs
```

Requires Node 22+ and `home-assistant-js-websocket` (`npm install home-assistant-js-websocket`).

Then in your dashboard:

```jsx
import { HAProvider } from 'hass-react'
import { createGatewayTransport } from './client-transport'

const transport = createGatewayTransport('http://127.0.0.1:8131')

<HAProvider url="http://127.0.0.1:8131" transport={transport}>
  <YourApp />
</HAProvider>
```

## What it enforces

- Home Assistant token stays in the gateway process
- Commands are allowlisted: `get_states`, `auth/current_user`, and `call_service` only for the domain/service pairs in `ALLOWED_SERVICES`
- Everything else is rejected with a 403
- Upstream reconnects are handled by `home-assistant-js-websocket`; browser reconnects by `HAProvider`
