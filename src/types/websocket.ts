import type { EntityState } from './core'

// WebSocket event types
export interface StateChangedEvent {
  event_type: 'state_changed'
  data: {
    entity_id: string
    old_state: EntityState | null
    new_state: EntityState | null
  }
}
