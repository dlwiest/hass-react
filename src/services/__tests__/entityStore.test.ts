import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  selectEntity,
  subscribeAllStateChanges,
  useStore,
} from '../entityStore'
import type { EntityState, HAConnection, StateChangedEvent } from '../../types'

function createEntity(
  entityId: string,
  state = 'on',
  attributes: Record<string, unknown> = {}
): EntityState {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: '2026-08-10T00:00:00.000Z',
    last_updated: '2026-08-10T00:00:00.000Z',
    context: { id: 'test-context', parent_id: null, user_id: null },
  }
}

function createEvent(
  entityId: string,
  newState: EntityState | null,
  oldState: EntityState | null = null
): StateChangedEvent {
  return {
    event_type: 'state_changed',
    data: {
      entity_id: entityId,
      old_state: oldState,
      new_state: newState,
    },
  } as StateChangedEvent
}

function createConnection(states: EntityState[] = []) {
  let eventHandler: ((event: StateChangedEvent) => void) | undefined
  const unsubscribe = vi.fn()
  const sendMessagePromise = vi.fn().mockResolvedValue(states)
  const subscribeEvents = vi.fn().mockImplementation(
    (handler: (event: StateChangedEvent) => void) => {
      eventHandler = handler
      return Promise.resolve(unsubscribe)
    }
  )
  const connection = {
    sendMessagePromise,
    subscribeEvents,
  } as unknown as HAConnection

  return {
    connection,
    sendMessagePromise,
    subscribeEvents,
    unsubscribe,
    emit(event: StateChangedEvent) {
      if (!eventHandler) {
        throw new Error('state_changed subscription is not ready')
      }
      eventHandler(event)
    },
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('entityStore', () => {
  beforeEach(() => {
    useStore.getState().clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    useStore.getState().clear()
    vi.restoreAllMocks()
  })

  it('keeps only selectable data in Zustand state', () => {
    const state = useStore.getState()

    expect(state.entities).toEqual(new Map())
    expect(state.subscriptionErrors).toEqual(new Map())
    expect(state.connection).toBeNull()
    expect(state).not.toHaveProperty('registeredEntities')
    expect(state).not.toHaveProperty('componentSubscriptions')
    expect(state).not.toHaveProperty('websocketSubscriptions')
  })

  it('opens one state_changed subscription for any number of entities', async () => {
    const light = createEntity('light.kitchen')
    const switchEntity = createEntity('switch.fan', 'off')
    const mock = createConnection([light, switchEntity])
    const lightHandler = vi.fn()
    const switchHandler = vi.fn()

    useStore.getState().registerEntity(light.entity_id, lightHandler)
    useStore.getState().registerEntity(switchEntity.entity_id, switchHandler)

    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)

    expect(mock.subscribeEvents).toHaveBeenCalledTimes(1)
    expect(mock.subscribeEvents).toHaveBeenCalledWith(
      expect.any(Function),
      'state_changed'
    )
    expect(mock.sendMessagePromise).toHaveBeenCalledTimes(1)
    expect(useStore.getState().entities.get(light.entity_id)).toEqual(light)
    expect(useStore.getState().entities.get(switchEntity.entity_id)).toEqual(switchEntity)
    expect(lightHandler).toHaveBeenCalledTimes(1)
    expect(switchHandler).toHaveBeenCalledTimes(1)
  })

  it('establishes the shared subscription even when no entity is registered', async () => {
    const mock = createConnection()

    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)

    expect(mock.subscribeEvents).toHaveBeenCalledTimes(1)
    expect(mock.sendMessagePromise).not.toHaveBeenCalled()
  })

  it('batches late entity snapshots without adding server subscriptions', async () => {
    const light = createEntity('light.kitchen')
    const sensor = createEntity('sensor.temperature', '21')
    const mock = createConnection()
    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)
    mock.sendMessagePromise.mockResolvedValue([light, sensor])

    const lightRegistration = useStore.getState().registerEntity(light.entity_id, vi.fn())
    const sensorRegistration = useStore.getState().registerEntity(sensor.entity_id, vi.fn())
    await Promise.all([
      lightRegistration as unknown as Promise<void>,
      sensorRegistration as unknown as Promise<void>,
    ])

    expect(mock.sendMessagePromise).toHaveBeenCalledTimes(1)
    expect(mock.sendMessagePromise).toHaveBeenCalledWith({ type: 'get_states' })
    expect(mock.subscribeEvents).toHaveBeenCalledTimes(1)
    expect(useStore.getState().entities.get(light.entity_id)).toEqual(light)
    expect(useStore.getState().entities.get(sensor.entity_id)).toEqual(sensor)
  })

  it('deduplicates concurrent registration for the same entity', async () => {
    const entity = createEntity('light.kitchen')
    const snapshot = createDeferred<EntityState[]>()
    const mock = createConnection()
    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)
    mock.sendMessagePromise.mockReturnValue(snapshot.promise)
    const firstHandler = vi.fn()
    const secondHandler = vi.fn()

    const firstRegistration = useStore.getState().registerEntity(entity.entity_id, firstHandler)
    await Promise.resolve()
    const secondRegistration = useStore.getState().registerEntity(entity.entity_id, secondHandler)
    snapshot.resolve([entity])
    await Promise.all([
      firstRegistration as unknown as Promise<void>,
      secondRegistration as unknown as Promise<void>,
    ])

    expect(mock.sendMessagePromise).toHaveBeenCalledTimes(1)
    expect(mock.subscribeEvents).toHaveBeenCalledTimes(1)

    firstHandler.mockClear()
    secondHandler.mockClear()
    mock.emit(createEvent(entity.entity_id, createEntity(entity.entity_id, 'off'), entity))
    expect(firstHandler).toHaveBeenCalledTimes(1)
    expect(secondHandler).toHaveBeenCalledTimes(1)
  })

  it('does not retain a StrictMode registration that unmounts while loading', async () => {
    const entity = createEntity('light.kitchen')
    const snapshot = createDeferred<EntityState[]>()
    const mock = createConnection()
    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)
    mock.sendMessagePromise.mockReturnValue(snapshot.promise)
    const abandonedHandler = vi.fn()
    const mountedHandler = vi.fn()

    const abandonedRegistration = useStore.getState().registerEntity(
      entity.entity_id,
      abandonedHandler
    )
    useStore.getState().unregisterEntity(entity.entity_id, abandonedHandler)
    const mountedRegistration = useStore.getState().registerEntity(
      entity.entity_id,
      mountedHandler
    )

    snapshot.resolve([entity])
    await Promise.all([
      abandonedRegistration as unknown as Promise<void>,
      mountedRegistration as unknown as Promise<void>,
    ])
    abandonedHandler.mockClear()
    mountedHandler.mockClear()

    mock.emit(createEvent(entity.entity_id, createEntity(entity.entity_id, 'off'), entity))

    expect(abandonedHandler).not.toHaveBeenCalled()
    expect(mountedHandler).toHaveBeenCalledTimes(1)
    expect(mock.sendMessagePromise).toHaveBeenCalledTimes(1)
  })

  it('ignores stale setConnection completions and disposes their handles', async () => {
    const entity = createEntity('light.kitchen')
    const firstSubscription = createDeferred<() => void>()
    const firstUnsubscribe = vi.fn()
    const first = createConnection([entity])
    const second = createConnection([entity])
    let staleHandler: ((event: StateChangedEvent) => void) | undefined

    first.subscribeEvents.mockImplementation((handler) => {
      staleHandler = handler
      return firstSubscription.promise
    })
    const callback = vi.fn()
    useStore.getState().registerEntity(entity.entity_id, callback)

    const firstConnection = useStore.getState().setConnection(first.connection)
    const secondConnection = useStore.getState().setConnection(second.connection)
    await (secondConnection as unknown as Promise<void>)

    firstSubscription.resolve(firstUnsubscribe)
    await (firstConnection as unknown as Promise<void>)

    expect(useStore.getState().connection).toBe(second.connection)
    expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
    expect(second.subscribeEvents).toHaveBeenCalledTimes(1)

    callback.mockClear()
    staleHandler?.(createEvent(entity.entity_id, createEntity(entity.entity_id, 'stale')))
    expect(callback).not.toHaveBeenCalled()
    expect(useStore.getState().entities.get(entity.entity_id)).toEqual(entity)
  })

  it('unsubscribes the previous connection without reusing its handle', async () => {
    const first = createConnection()
    const second = createConnection()

    await (useStore.getState().setConnection(first.connection) as unknown as Promise<void>)
    await (useStore.getState().setConnection(second.connection) as unknown as Promise<void>)

    expect(first.unsubscribe).toHaveBeenCalledTimes(1)
    expect(first.subscribeEvents).toHaveBeenCalledTimes(1)
    expect(second.subscribeEvents).toHaveBeenCalledTimes(1)
  })

  it('deletes removed entities and notifies their watchers', async () => {
    const entity = createEntity('light.kitchen')
    const mock = createConnection([entity])
    const callback = vi.fn()
    useStore.getState().registerEntity(entity.entity_id, callback)
    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)
    callback.mockClear()

    mock.emit(createEvent(entity.entity_id, null, entity))

    expect(useStore.getState().entities.has(entity.entity_id)).toBe(false)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('clears reconnect errors after the shared subscription succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const entity = createEntity('light.kitchen')
    const failure = new Error('subscription failed')
    const failed = createConnection([entity])
    failed.subscribeEvents.mockRejectedValue(failure)
    const recovered = createConnection([entity])
    const callback = vi.fn()
    useStore.getState().registerEntity(entity.entity_id, callback)

    await expect(
      useStore.getState().setConnection(failed.connection) as unknown as Promise<void>
    ).resolves.toBeUndefined()
    expect(useStore.getState().subscriptionErrors.get(entity.entity_id)).toBe(failure)

    await (useStore.getState().setConnection(recovered.connection) as unknown as Promise<void>)
    expect(useStore.getState().subscriptionErrors.has(entity.entity_id)).toBe(false)
  })

  it('records snapshot failures per entity without rejecting setConnection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const firstEntity = createEntity('light.kitchen')
    const secondEntity = createEntity('switch.fan')
    const failure = new Error('invalid snapshot')
    failure.name = 'InvalidParameterError'
    const mock = createConnection()
    mock.sendMessagePromise.mockRejectedValue(failure)
    useStore.getState().registerEntity(firstEntity.entity_id, vi.fn())
    useStore.getState().registerEntity(secondEntity.entity_id, vi.fn())

    await expect(
      useStore.getState().setConnection(mock.connection) as unknown as Promise<void>
    ).resolves.toBeUndefined()

    expect(mock.sendMessagePromise).toHaveBeenCalledTimes(1)
    expect(useStore.getState().subscriptionErrors.get(firstEntity.entity_id)).toBe(failure)
    expect(useStore.getState().subscriptionErrors.get(secondEntity.entity_id)).toBe(failure)
  })

  it('deletes a subscription error when the last watcher unregisters', () => {
    const callback = vi.fn()
    useStore.getState().registerEntity('light.kitchen', callback)
    useStore.getState().setSubscriptionError('light.kitchen', new Error('failed'))

    useStore.getState().unregisterEntity('light.kitchen', callback)

    expect(useStore.getState().subscriptionErrors.has('light.kitchen')).toBe(false)
  })

  it('shares the connection firehose across ref-counted all-state listeners', async () => {
    const mock = createConnection()
    const handler = vi.fn()
    const firstUnsubscribe = subscribeAllStateChanges(handler)
    const secondUnsubscribe = subscribeAllStateChanges(handler)
    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)
    const event = createEvent('switch.fan', createEntity('switch.fan', 'off'))

    mock.emit(event)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(mock.subscribeEvents).toHaveBeenCalledTimes(1)

    firstUnsubscribe()
    mock.emit(event)
    expect(handler).toHaveBeenCalledTimes(2)

    secondUnsubscribe()
    mock.emit(event)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('keeps the shared server subscription until the connection is cleared', async () => {
    const mock = createConnection()
    const callback = vi.fn()
    await (useStore.getState().setConnection(mock.connection) as unknown as Promise<void>)
    await (useStore.getState().registerEntity(
      'light.kitchen',
      callback
    ) as unknown as Promise<void>)

    useStore.getState().unregisterEntity('light.kitchen', callback)
    expect(mock.unsubscribe).not.toHaveBeenCalled()

    useStore.getState().clear()
    expect(mock.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('updates and selects entities through the public store actions', () => {
    const light = createEntity('light.kitchen')
    const switchEntity = createEntity('switch.fan', 'off')
    const callback = vi.fn()
    useStore.getState().registerEntity(light.entity_id, callback)

    useStore.getState().batchUpdate([
      [light.entity_id, light],
      [switchEntity.entity_id, switchEntity],
    ])

    expect(selectEntity(light.entity_id)(useStore.getState())).toEqual(light)
    expect(selectEntity(switchEntity.entity_id)(useStore.getState())).toEqual(switchEntity)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
