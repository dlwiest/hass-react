// The browser half: an HATransport that speaks to server.mjs.
// Pass it to HAProvider:
//
//   const transport = createGatewayTransport('http://127.0.0.1:8131')
//   <HAProvider url="http://127.0.0.1:8131" transport={transport}>
//
// `url` is only used to resolve relative media URLs; commands and events go
// through the transport.
//
// Each connect() call builds an independent session (its own EventSource and
// subscriber registry). That matters: HAProvider may start a second attempt
// while an earlier one is still settling (React StrictMode double-mounts,
// fast reconnects), and it will disconnect the stale attempt. A transport
// with shared mutable state would let the stale disconnect tear down the
// live session.

export function createGatewayTransport(baseUrl) {
  // connection -> its EventSource, so disconnect() closes the right session.
  const sessions = new Map();

  return {
    connect(handlers) {
      return new Promise((resolve, reject) => {
        const events = new EventSource(`${baseUrl}/api/events`);
        const subscribers = new Map(); // eventType|undefined -> Set<callback>
        let settled = false;
        let notifiedDisconnect = false;

        const connection = {
          async sendMessagePromise(message) {
            const response = await fetch(`${baseUrl}/api/command`, {
              method: 'POST',
              headers: {'content-type': 'application/json'},
              body: JSON.stringify(message),
            });
            if (!response.ok) {
              throw new Error(`gateway returned ${response.status}`);
            }
            return response.json();
          },

          async subscribeEvents(callback, eventType) {
            const callbacks = subscribers.get(eventType) ?? new Set();
            callbacks.add(callback);
            subscribers.set(eventType, callbacks);
            return () => {
              callbacks.delete(callback);
            };
          },
        };

        events.onopen = () => {
          settled = true;
          sessions.set(connection, events);
          resolve(connection);
        };

        events.onmessage = ({data}) => {
          const event = JSON.parse(data);
          subscribers.get(event.event_type)?.forEach((cb) => cb(event));
          subscribers.get(undefined)?.forEach((cb) => cb(event));
        };

        events.onerror = () => {
          if (!settled) {
            settled = true;
            events.close();
            reject(new Error('gateway event stream unavailable'));
          } else if (!notifiedDisconnect) {
            // EventSource retries internally, but HAProvider owns reconnect
            // policy: report the loss once and let it call connect() again.
            notifiedDisconnect = true;
            events.close();
            sessions.delete(connection);
            handlers.onDisconnected();
          }
        };
      });
    },

    disconnect(connection) {
      sessions.get(connection)?.close();
      sessions.delete(connection);
    },
  };
}
