// Minimal Home Assistant gateway for hass-react external transports.
//
// The gateway owns the Home Assistant credential and the upstream WebSocket.
// Browsers never see either: they talk to this server over one SSE stream
// (events) and one HTTP endpoint (commands), through the matching client
// transport in client-transport.js.
//
// Run:  HA_URL=http://homeassistant.local:8123 HA_TOKEN=<long-lived token> node server.mjs
// Node 22+ (native WebSocket). The only dependency is home-assistant-js-websocket.

import http from 'node:http';
import crypto from 'node:crypto';
import {
  createConnection,
  createLongLivedTokenAuth,
} from 'home-assistant-js-websocket';

const HA_URL = process.env.HA_URL ?? 'http://homeassistant.local:8123';
const HA_TOKEN = process.env.HA_TOKEN;
const PORT = Number(process.env.PORT ?? 8131);
// Lock this down to your dashboard's origin in anything beyond LAN use.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';

if (!HA_TOKEN) {
  console.error('HA_TOKEN is required (Home Assistant profile -> long-lived access tokens)');
  process.exit(1);
}

// -- The authorization boundary --------------------------------------------
// Everything the browser may do is enumerated here. A request that does not
// match is rejected; the gateway never forwards arbitrary commands.

const ALLOWED_COMMANDS = new Set(['get_states', 'auth/current_user']);

// domain -> allowed services. Extend deliberately, entry by entry.
const ALLOWED_SERVICES = {
  light: new Set(['turn_on', 'turn_off', 'toggle']),
  switch: new Set(['turn_on', 'turn_off', 'toggle']),
};

// domain -> entities the browser may target. null = any entity in the domain.
// Scope this to the entities your dashboard actually shows.
const ALLOWED_ENTITIES = {
  light: null,
  switch: null,
};

function targetedEntities(message) {
  // Home Assistant accepts the target in either field, as one id or a list.
  const raw = message.service_data?.entity_id ?? message.target?.entity_id;
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function authorize(message) {
  if (ALLOWED_COMMANDS.has(message.type)) return true;
  if (message.type !== 'call_service') return false;

  if (!(ALLOWED_SERVICES[message.domain]?.has(message.service) ?? false)) {
    return false;
  }

  const allowedEntities = ALLOWED_ENTITIES[message.domain];
  // Missing entry means the domain was allowlisted without an entity scope
  // decision. Fail closed rather than throwing.
  if (allowedEntities === undefined) return false;
  if (allowedEntities === null) return true;
  const targets = targetedEntities(message);
  return targets.length > 0 && targets.every((id) => allowedEntities.has(id));
}

// -- Upstream connection ----------------------------------------------------

const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN);
const connection = await createConnection({auth});
console.log(`connected to Home Assistant at ${HA_URL}`);

// One upstream subscription; fan events out to every connected browser.
const sseClients = new Set();

await connection.subscribeEvents((event) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) res.write(payload);
}, 'state_changed');

connection.addEventListener('disconnected', () => {
  console.warn('upstream disconnected; home-assistant-js-websocket will reconnect');
});

// -- Browser-facing server --------------------------------------------------

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'GET' && req.url === '/api/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/command') {
    let body = '';
    req.setEncoding('utf8');
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 64 * 1024) {
        res.writeHead(413).end();
        return;
      }
    }

    let message;
    try {
      message = JSON.parse(body);
    } catch {
      res.writeHead(400).end(JSON.stringify({error: 'invalid JSON'}));
      return;
    }

    if (!authorize(message)) {
      res.writeHead(403).end(JSON.stringify({error: `not allowed: ${message.type}`}));
      return;
    }

    try {
      const result = await connection.sendMessagePromise(message);
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(JSON.stringify(result ?? null));
    } catch (error) {
      const id = crypto.randomUUID();
      console.error(`command failed [${id}]`, error);
      res.writeHead(502, {'content-type': 'application/json'});
      // Error details stay in the gateway log; the browser gets a reference.
      res.end(JSON.stringify({error: 'upstream command failed', ref: id}));
    }
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => {
  console.log(`gateway listening on http://127.0.0.1:${PORT}`);
});
