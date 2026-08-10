import { create } from 'zustand'
import type { EntityState, StateChangedEvent } from '../types'
import type { HAConnection } from '../types'
import { withRetry } from '../utils/retry'

type EntityUpdateHandler = () => void
type StateChangedHandler = (event: StateChangedEvent) => void

interface EntityStore {
  entities: Map<string, EntityState>
  subscriptionErrors: Map<string, Error>
  connection: HAConnection | null
  setConnection: (connection: HAConnection | null) => void
  updateEntity: (entityId: string, state: EntityState) => void
  setSubscriptionError: (entityId: string, error: Error | null) => void
  registerEntity: (entityId: string, callback: EntityUpdateHandler) => void
  unregisterEntity: (entityId: string, callback: EntityUpdateHandler) => void
  batchUpdate: (updates: Array<[string, EntityState]>) => void
  clear: () => void
}

interface ActiveStateSubscription {
  connection: HAConnection
  generation: number
  unsubscribe: () => void
}

interface PendingSnapshot {
  connection: HAConnection
  generation: number
  promise: Promise<EntityState[]>
}

interface InFlightRegistration {
  generation: number
  promise: Promise<void>
}

type StoreSetter = (
  partial: Partial<EntityStore> | ((state: EntityStore) => Partial<EntityStore>)
) => void

// Subscription bookkeeping is intentionally kept outside Zustand. Components only
// select entities, errors, and the connection; publishing these maps made every
// mount clone O(N) state and notify every selector.
const entitySubscriptions = new Map<string, Set<EntityUpdateHandler>>()
const allStateChangeSubscriptions = new Map<StateChangedHandler, number>()
const inFlightRegistrations = new Map<string, InFlightRegistration>()
const entityEventVersions = new Map<string, number>()

let activeStateSubscription: ActiveStateSubscription | null = null
let pendingSnapshot: PendingSnapshot | null = null
let stateSubscriptionError: Error | null = null
let connectionGeneration = 0

export const useStore = create<EntityStore>((set, get) => ({
  entities: new Map(),
  subscriptionErrors: new Map(),
  connection: null,

  setConnection: async (connection) => {
    const generation = ++connectionGeneration
    const previousSubscription = activeStateSubscription

    activeStateSubscription = null
    pendingSnapshot = null
    stateSubscriptionError = null
    inFlightRegistrations.clear()

    if (previousSubscription) {
      unsubscribeSafely(previousSubscription.unsubscribe)
    }

    set({ connection })

    if (!connection) {
      return
    }

    try {
      const [subscriptionResult] = await Promise.allSettled([
        connection.subscribeEvents(
          (event: StateChangedEvent) => dispatchStateChanged(event, connection, generation),
          'state_changed'
        ),
      ])

      if (!isCurrentConnection(connection, generation)) {
        if (subscriptionResult.status === 'fulfilled') {
          unsubscribeSafely(subscriptionResult.value)
        }
        return
      }

      if (subscriptionResult.status === 'fulfilled') {
        activeStateSubscription = {
          connection,
          generation,
          unsubscribe: subscriptionResult.value,
        }
        setSubscriptionErrors(entitySubscriptions.keys(), null, set)
      } else {
        stateSubscriptionError = toError(subscriptionResult.reason)
        console.error('Failed to subscribe to state_changed events:', stateSubscriptionError)
        setSubscriptionErrors(entitySubscriptions.keys(), stateSubscriptionError, set)
      }

      const entityIds = Array.from(entitySubscriptions.keys())
      const registrationResults = await Promise.allSettled(
        entityIds.map((entityId) => initializeEntity(connection, generation, entityId))
      )

      if (!isCurrentConnection(connection, generation)) {
        return
      }

      const errorUpdates = new Map<string, Error | null>()
      registrationResults.forEach((result, index) => {
        const entityId = entityIds[index]
        if (!entitySubscriptions.has(entityId)) {
          return
        }

        if (stateSubscriptionError) {
          errorUpdates.set(entityId, stateSubscriptionError)
        } else if (result.status === 'rejected') {
          errorUpdates.set(entityId, toError(result.reason))
        } else {
          errorUpdates.set(entityId, null)
        }
      })
      setSubscriptionErrorUpdates(errorUpdates, set)
    } catch (error) {
      if (!isCurrentConnection(connection, generation)) {
        return
      }

      stateSubscriptionError = toError(error)
      console.error('Failed to initialize entity subscriptions:', stateSubscriptionError)
      setSubscriptionErrors(entitySubscriptions.keys(), stateSubscriptionError, set)
    }
  },

  updateEntity: (entityId, state) => {
    set((store) => {
      const entities = new Map(store.entities)
      entities.set(entityId, state)
      return { entities }
    })

    notifyEntitySubscribers(entityId)
  },

  setSubscriptionError: (entityId, error) => {
    setSubscriptionErrors([entityId], error, set)
  },

  registerEntity: async (entityId, callback) => {
    let subscriptions = entitySubscriptions.get(entityId)
    if (!subscriptions) {
      subscriptions = new Set()
      entitySubscriptions.set(entityId, subscriptions)
    }
    subscriptions.add(callback)

    const connection = get().connection
    const generation = connectionGeneration
    if (!connection) {
      return
    }

    try {
      await initializeEntity(connection, generation, entityId)
    } catch {
      // initializeEntity records the per-entity error. Registration is intentionally
      // fire-and-forget for React effects, so failures must not escape.
    }
  },

  unregisterEntity: (entityId, callback) => {
    const subscriptions = entitySubscriptions.get(entityId)
    if (!subscriptions) {
      return
    }

    subscriptions.delete(callback)
    if (subscriptions.size > 0) {
      return
    }

    entitySubscriptions.delete(entityId)
    entityEventVersions.delete(entityId)
    get().setSubscriptionError(entityId, null)
  },

  batchUpdate: (updates) => {
    set((store) => {
      const entities = new Map(store.entities)
      updates.forEach(([entityId, state]) => {
        entities.set(entityId, state)
      })
      return { entities }
    })

    updates.forEach(([entityId]) => notifyEntitySubscribers(entityId))
  },

  clear: () => {
    ++connectionGeneration

    const subscription = activeStateSubscription
    activeStateSubscription = null
    pendingSnapshot = null
    stateSubscriptionError = null

    if (subscription) {
      unsubscribeSafely(subscription.unsubscribe)
    }

    entitySubscriptions.clear()
    allStateChangeSubscriptions.clear()
    inFlightRegistrations.clear()
    entityEventVersions.clear()

    set({
      entities: new Map(),
      subscriptionErrors: new Map(),
      connection: null,
    })
  },
}))

/**
 * Subscribe to the store-wide state_changed firehose.
 *
 * Every caller is ref-counted locally while all callers share the single
 * server-side subscription owned by setConnection.
 */
export function subscribeAllStateChanges(handler: StateChangedHandler): () => void {
  allStateChangeSubscriptions.set(
    handler,
    (allStateChangeSubscriptions.get(handler) ?? 0) + 1
  )

  let subscribed = true
  return () => {
    if (!subscribed) {
      return
    }
    subscribed = false

    const count = allStateChangeSubscriptions.get(handler)
    if (count === undefined || count <= 1) {
      allStateChangeSubscriptions.delete(handler)
    } else {
      allStateChangeSubscriptions.set(handler, count - 1)
    }
  }
}

function dispatchStateChanged(
  event: StateChangedEvent,
  connection: HAConnection,
  generation: number
): void {
  if (!isCurrentConnection(connection, generation)) {
    return
  }

  const entityId = event.data.entity_id
  if (entitySubscriptions.has(entityId)) {
    entityEventVersions.set(entityId, (entityEventVersions.get(entityId) ?? 0) + 1)

    if (event.data.new_state) {
      useStore.getState().updateEntity(entityId, event.data.new_state)
    } else {
      deleteEntity(entityId)
      notifyEntitySubscribers(entityId)
    }
  }

  allStateChangeSubscriptions.forEach((_count, handler) => handler(event))
}

function initializeEntity(
  connection: HAConnection,
  generation: number,
  entityId: string
): Promise<void> {
  const existing = inFlightRegistrations.get(entityId)
  if (existing?.generation === generation) {
    return existing.promise
  }

  const eventVersion = entityEventVersions.get(entityId) ?? 0
  let promise!: Promise<void>
  promise = (async () => {
    try {
      const states = await getBatchedSnapshot(connection, generation)
      if (!isCurrentConnection(connection, generation) || !entitySubscriptions.has(entityId)) {
        return
      }

      if ((entityEventVersions.get(entityId) ?? 0) === eventVersion) {
        const entity = states.find((state) => state.entity_id === entityId)
        if (entity) {
          useStore.getState().updateEntity(entityId, entity)
        }
      }

      if (activeStateSubscription?.generation === generation) {
        useStore.getState().setSubscriptionError(entityId, null)
      } else if (stateSubscriptionError) {
        useStore.getState().setSubscriptionError(entityId, stateSubscriptionError)
      }
    } catch (error) {
      if (isCurrentConnection(connection, generation) && entitySubscriptions.has(entityId)) {
        const normalizedError = toError(error)
        console.error(`Failed to initialize entity ${entityId}:`, normalizedError)
        useStore.getState().setSubscriptionError(entityId, normalizedError)
      }
      throw error
    } finally {
      const current = inFlightRegistrations.get(entityId)
      if (current?.promise === promise) {
        inFlightRegistrations.delete(entityId)
      }
    }
  })()

  inFlightRegistrations.set(entityId, { generation, promise })
  return promise
}

function getBatchedSnapshot(
  connection: HAConnection,
  generation: number
): Promise<EntityState[]> {
  if (
    pendingSnapshot?.connection === connection &&
    pendingSnapshot.generation === generation
  ) {
    return pendingSnapshot.promise
  }

  const snapshot: PendingSnapshot = {
    connection,
    generation,
    promise: Promise.resolve().then(() => {
      if (!isCurrentConnection(connection, generation)) {
        return []
      }

      return withRetry(
        () => connection.sendMessagePromise<EntityState[]>({ type: 'get_states' }),
        {
          maxAttempts: 3,
          baseDelay: 1000,
          exponentialBackoff: true,
        }
      )
    }),
  }

  pendingSnapshot = snapshot
  snapshot.promise.then(
    () => clearPendingSnapshot(snapshot),
    () => clearPendingSnapshot(snapshot)
  )
  return snapshot.promise
}

function clearPendingSnapshot(snapshot: PendingSnapshot): void {
  if (pendingSnapshot === snapshot) {
    pendingSnapshot = null
  }
}

function deleteEntity(entityId: string): void {
  useStore.setState((store) => {
    if (!store.entities.has(entityId)) {
      return store
    }

    const entities = new Map(store.entities)
    entities.delete(entityId)
    return { entities }
  })
}

function notifyEntitySubscribers(entityId: string): void {
  entitySubscriptions.get(entityId)?.forEach((callback) => callback())
}

function setSubscriptionErrors(
  entityIds: Iterable<string>,
  error: Error | null,
  set: StoreSetter
): void {
  const updates = new Map<string, Error | null>()
  for (const entityId of entityIds) {
    updates.set(entityId, error)
  }
  setSubscriptionErrorUpdates(updates, set)
}

function setSubscriptionErrorUpdates(
  updates: Map<string, Error | null>,
  set: StoreSetter
): void {
  if (updates.size === 0) {
    return
  }

  set((store) => {
    let changed = false
    const subscriptionErrors = new Map(store.subscriptionErrors)

    updates.forEach((error, entityId) => {
      if (error) {
        if (subscriptionErrors.get(entityId) !== error) {
          subscriptionErrors.set(entityId, error)
          changed = true
        }
      } else if (subscriptionErrors.delete(entityId)) {
        changed = true
      }
    })

    return changed ? { subscriptionErrors } : store
  })
}

function isCurrentConnection(connection: HAConnection, generation: number): boolean {
  return (
    generation === connectionGeneration &&
    useStore.getState().connection === connection
  )
}

function unsubscribeSafely(unsubscribe: () => void): void {
  try {
    Promise.resolve(unsubscribe()).catch(() => {})
  } catch {
    // A transport may expose a synchronous unsubscribe. Cleanup is best-effort.
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export const selectEntity = (entityId: string) => (state: EntityStore) =>
  state.entities.get(entityId)
