import type { StateChangedEvent } from './websocket'

/**
 * The minimal connection surface consumed by hass-react hooks and the entity store.
 * Native Home Assistant WebSocket connections satisfy this interface, while custom
 * transports can implement it over an authenticated server-side gateway.
 */
export interface HAConnection {
  sendMessagePromise<T = unknown>(message: Record<string, unknown>): Promise<T>
  subscribeEvents<T = StateChangedEvent>(
    callback: (event: T) => void,
    eventType?: string
  ): Promise<() => void>
}

/** Lifecycle notifications an external transport can send back to HAProvider. */
export interface HATransportHandlers {
  onDisconnected(): void
}

/**
 * Connects hass-react to Home Assistant through an application-defined transport.
 *
 * This is intended for server-side authentication and backend-for-frontend
 * architectures where Home Assistant credentials must not reach the browser.
 * The transport remains responsible for authorization, command allowlisting,
 * sanitization, and reporting channel loss through onDisconnected. HAProvider
 * applies its normal reconnection policy by calling connect again.
 */
export interface HATransport {
  connect(handlers: HATransportHandlers): Promise<HAConnection>
  disconnect(connection: HAConnection): void | Promise<void>
  logout?(): void | Promise<void>
}
