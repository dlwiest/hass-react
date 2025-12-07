import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { EntityState, StateChangedEvent } from '../types'
import type { Connection } from 'home-assistant-js-websocket'
import { withRetry } from '../utils/retry'

// Central store for managing Home Assistant entity states and WebSocket subscriptions
// Handles automatic subscription/unsubscription as React components mount/unmount

interface WebSocketSubscription {
  unsubscribe: () => void
}

interface EntityStore {
  // Current entity states indexed by entity_id
  entities: Map<string, EntityState>

  // Component callbacks that want updates for each entity
  componentSubscriptions: Map<string, Set<() => void>>

  // Active WebSocket subscriptions for each entity
  websocketSubscriptions: Map<string, WebSocketSubscription>

  // All entities that any component has requested
  registeredEntities: Set<string>

  // Subscription errors for each entity
  subscriptionErrors: Map<string, Error>

  // Current Home Assistant WebSocket connection
  connection: Connection | null

  // Actions
  setConnection: (connection: Connection | null) => void
  updateEntity: (entityId: string, state: EntityState) => void
  setSubscriptionError: (entityId: string, error: Error | null) => void
  registerEntity: (entityId: string, callback: () => void) => void
  unregisterEntity: (entityId: string, callback: () => void) => void
  batchUpdate: (updates: Array<[string, EntityState]>) => void
  clear: () => void
}

export const useStore = create<EntityStore>()(
  subscribeWithSelector((set, get) => ({
    entities: new Map(),
    componentSubscriptions: new Map(),
    websocketSubscriptions: new Map(),
    registeredEntities: new Set(),
    subscriptionErrors: new Map(),
    connection: null,

    // Update the WebSocket connection and resubscribe to all registered entities
    setConnection: async (connection) => {
      const oldConnection = get().connection

      // Clean up old subscriptions if connection changed
      if (oldConnection && oldConnection !== connection) {
        // Unsubscribe from all existing subscriptions
        // Use allSettled to wait for all unsubscribes to complete (or fail) before clearing
        await Promise.allSettled(
          Array.from(get().websocketSubscriptions.values()).map(sub =>
            Promise.resolve(sub.unsubscribe())
          )
        )
        set({
          websocketSubscriptions: new Map(),
          connection
        })
      } else {
        set({ connection })
      }
      
      // Set up new subscriptions if we have a connection
      if (connection) {
        const registeredEntities = get().registeredEntities
        
        if (registeredEntities.size > 0) {
          // Fetch current states for all registered entities
          const states = await connection.sendMessagePromise<EntityState[]>({
            type: 'get_states',
          })
          
          // Update store with current entity states
          const entityMap = new Map(states.map(s => [s.entity_id, s]))
          registeredEntities.forEach(entityId => {
            const entity = entityMap.get(entityId)
            if (entity) {
              get().updateEntity(entityId, entity)
            }
          })
          
          // Subscribe to real-time updates for all registered entities
          await Promise.all(
            Array.from(registeredEntities).map(entityId => 
              subscribeToEntityUpdates(connection, entityId, get, set)
            )
          )
        }
      }
    },

    // Update entity state and notify all subscribed components
    updateEntity: (entityId, state) => {
      set((store) => {
        const newEntities = new Map(store.entities)
        newEntities.set(entityId, state)
        return { entities: newEntities }
      })

      // Notify component subscribers to trigger re-renders
      const subs = get().componentSubscriptions.get(entityId)
      if (subs) {
        subs.forEach((callback) => callback())
      }
    },

    // Set or clear subscription error for an entity
    setSubscriptionError: (entityId, error) => {
      set((store) => {
        const newErrors = new Map(store.subscriptionErrors)
        if (error) {
          newErrors.set(entityId, error)
        } else {
          newErrors.delete(entityId)
        }
        return { subscriptionErrors: newErrors }
      })
    },

    // Register a component's interest in an entity (called on component mount)
    registerEntity: async (entityId, callback) => {
      
      // Add entity to global registry and add component callback
      set((store) => {
        const newRegistered = new Set(store.registeredEntities)
        newRegistered.add(entityId)
        
        const newSubs = new Map(store.componentSubscriptions)
        const entitySubs = newSubs.get(entityId) || new Set()
        entitySubs.add(callback)
        newSubs.set(entityId, entitySubs)
        
        return { 
          registeredEntities: newRegistered,
          componentSubscriptions: newSubs 
        }
      })
      
      // Subscribe to WebSocket updates if connected and not already subscribed
      const { connection, websocketSubscriptions } = get()
      if (connection && !websocketSubscriptions.has(entityId)) {
        await subscribeToEntity(connection, entityId, get, set)
      }
    },

    // Unregister a component's interest in an entity (called on component unmount)
    unregisterEntity: (entityId, callback) => {
      
      set((store) => {
        const newSubs = new Map(store.componentSubscriptions)
        const entitySubs = newSubs.get(entityId)
        
        if (entitySubs) {
          entitySubs.delete(callback)
          
          // If no components are watching this entity, clean up completely
          if (entitySubs.size === 0) {
            newSubs.delete(entityId)
            
            const newRegistered = new Set(store.registeredEntities)
            newRegistered.delete(entityId)
            
            // Unsubscribe from WebSocket to avoid unnecessary updates
            const wsSub = store.websocketSubscriptions.get(entityId)
            if (wsSub) {
              wsSub.unsubscribe()
              const newWsSubs = new Map(store.websocketSubscriptions)
              newWsSubs.delete(entityId)
              return {
                componentSubscriptions: newSubs,
                registeredEntities: newRegistered,
                websocketSubscriptions: newWsSubs
              }
            }
            
            return {
              componentSubscriptions: newSubs,
              registeredEntities: newRegistered
            }
          }
          
          newSubs.set(entityId, entitySubs)
        }
        
        return { componentSubscriptions: newSubs }
      })
    },

    // Update multiple entities at once (more efficient than individual updates)
    batchUpdate: (updates) => {
      set((store) => {
        const newEntities = new Map(store.entities)
        updates.forEach(([entityId, state]) => {
          newEntities.set(entityId, state)
        })
        return { entities: newEntities }
      })

      // Notify subscribers for all updated entities
      const componentSubs = get().componentSubscriptions
      updates.forEach(([entityId]) => {
        const subs = componentSubs.get(entityId)
        if (subs) {
          subs.forEach((callback) => callback())
        }
      })
    },

    // Clean up all subscriptions and reset store to initial state
    clear: () => {
      // Unsubscribe all WebSocket subscriptions
      get().websocketSubscriptions.forEach(sub => sub.unsubscribe())

      set({
        entities: new Map(),
        componentSubscriptions: new Map(),
        websocketSubscriptions: new Map(),
        registeredEntities: new Set(),
        subscriptionErrors: new Map(),
        connection: null,
      })
    },
  }))
)

// Subscribe to a single entity: fetch current state + set up real-time updates
// Used when an entity is registered after the connection is already established
async function subscribeToEntity(
  connection: Connection,
  entityId: string,
  get: () => EntityStore,
  set: (partial: Partial<EntityStore> | ((state: EntityStore) => Partial<EntityStore>)) => void
) {
  try {
    await withRetry(async () => {
      // Get current state from Home Assistant
      const states = await connection.sendMessagePromise<EntityState[]>({
        type: 'get_states',
      })

      const entity = states.find((s: EntityState) => s.entity_id === entityId)
      if (entity) {
        get().updateEntity(entityId, entity)
      }

      // Set up WebSocket subscription for real-time updates
      await subscribeToEntityUpdates(connection, entityId, get, set)
    }, {
      maxAttempts: 3,
      baseDelay: 1000,
      exponentialBackoff: true
    })

    // Clear any previous subscription errors
    get().setSubscriptionError(entityId, null)

  } catch (error) {
    console.error(`Failed to subscribe to entity ${entityId}:`, error)
    // Expose error to hooks so they can display it to users
    get().setSubscriptionError(entityId, error as Error)
  }
}

// Subscribe to real-time WebSocket updates for an entity
// Used when we already have the entity state and just need the subscription
async function subscribeToEntityUpdates(
  connection: Connection,
  entityId: string,
  get: () => EntityStore,
  set: (partial: Partial<EntityStore> | ((state: EntityStore) => Partial<EntityStore>)) => void
) {
  try {
    // First, unsubscribe from any existing subscription for this entity to prevent leaks
    // Do this BEFORE creating the new subscription to avoid race conditions
    const existingSub = get().websocketSubscriptions.get(entityId)
    if (existingSub) {
      await Promise.resolve(existingSub.unsubscribe()).catch(() => {
        // Ignore errors from cleaning up old subscription
      })
      // Remove the old subscription from the Map
      set((store) => {
        const newWsSubs = new Map(store.websocketSubscriptions)
        // Only delete if it's still the same subscription we just unsubscribed
        if (newWsSubs.get(entityId) === existingSub) {
          newWsSubs.delete(entityId)
        }
        return { websocketSubscriptions: newWsSubs }
      })
    }

    // Subscribe to state_changed events for this entity
    const unsubscribe = await connection.subscribeEvents(
      (event: StateChangedEvent) => {
        if (event.data.entity_id === entityId) {
          get().updateEntity(entityId, event.data.new_state)
        }
      },
      'state_changed'
    )

    // Store the subscription so we can clean it up later
    set((store) => {
      const newWsSubs = new Map(store.websocketSubscriptions)
      newWsSubs.set(entityId, { unsubscribe })
      return { websocketSubscriptions: newWsSubs }
    })

  } catch (error) {
    console.error(`Failed to subscribe to entity updates ${entityId}:`, error)
    // Expose error to hooks so they can display it to users
    get().setSubscriptionError(entityId, error as Error)
    throw error // Re-throw so caller (subscribeToEntity) can handle it
  }
}

// Zustand selector to get a specific entity's state
export const selectEntity = (entityId: string) => (state: EntityStore) =>
  state.entities.get(entityId)