import type { HATransport } from './transport'

export interface HAConfig {
  url: string
  token?: string
  authMode?: 'token' | 'oauth' | 'auto'
  redirectUri?: string
  mockMode?: boolean
  mockData?: Record<string, EntityState>
  mockUser?: CurrentUser
  transport?: HATransport
  options?: {
    reconnectInterval?: number
    reconnectAttempts?: number
    cacheTimeout?: number
    autoReconnect?: boolean
    tokenRefreshBufferMinutes?: number
    tokenRefreshIntervalMinutes?: number
    serviceRetry?: {
      maxAttempts?: number
      baseDelay?: number
      exponentialBackoff?: boolean
      maxDelay?: number
    }
  }
}

// Current user information (from auth/current_user)
export interface CurrentUser {
  id: string
  name: string
  is_owner: boolean
  is_admin: boolean
  local_only: boolean
  system_generated: boolean
  group_ids: string[]
}

export interface ConnectionStatus {
  connected: boolean
  connecting: boolean
  error: Error | null
  reconnect: () => void
  connectionState: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'
  retryCount: number
  nextRetryIn?: number
  isAutoRetrying: boolean
  lastConnectedAt?: Date
}

export interface EntityState<T = Record<string, unknown>> {
  entity_id: string
  state: string
  attributes: T
  last_changed: string
  last_updated: string
  context: {
    id: string
    parent_id: string | null
    user_id: string | null
  }
}

export interface BaseEntityHook<T = Record<string, unknown>> {
  entityId: string
  state: string
  attributes: T
  lastChanged: Date
  lastUpdated: Date
  isUnavailable: boolean
  isConnected: boolean
  error?: Error
  refresh: () => Promise<void>
}
