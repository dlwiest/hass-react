import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEntityList } from '../useEntityList'
import { useStore } from '../../services/entityStore'
import type { EntityState, HAConnection, StateChangedEvent } from '../../types'

function createEntity(entityId: string, state: string): EntityState {
  return {
    entity_id: entityId,
    state,
    attributes: {},
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
    data: { entity_id: entityId, old_state: oldState, new_state: newState },
  } as StateChangedEvent
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

describe('useEntityList', () => {
  let stateChangedHandler: ((event: StateChangedEvent) => void) | undefined
  let sendMessagePromise = vi.fn()
  let subscribeEvents = vi.fn()
  let connection: HAConnection

  beforeEach(async () => {
    useStore.getState().clear()
    stateChangedHandler = undefined
    sendMessagePromise = vi.fn().mockResolvedValue([])
    subscribeEvents = vi.fn().mockImplementation(
      (handler: (event: StateChangedEvent) => void) => {
        stateChangedHandler = handler
        return Promise.resolve(vi.fn())
      }
    )
    connection = { sendMessagePromise, subscribeEvents } as unknown as HAConnection

    await (useStore.getState().setConnection(connection) as unknown as Promise<void>)
  })

  afterEach(() => {
    useStore.getState().clear()
    vi.restoreAllMocks()
  })

  it('fetches and filters the requested domain', async () => {
    sendMessagePromise.mockResolvedValue([
      createEntity('light.living_room', 'on'),
      createEntity('light.bedroom', 'off'),
      createEntity('switch.kitchen', 'on'),
    ])

    const { result } = renderHook(() => useEntityList<EntityState>('light'))

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current.map((entity) => entity.entity_id)).toEqual([
      'light.living_room',
      'light.bedroom',
    ])
  })

  it('uses the store firehose instead of opening a subscription per list', async () => {
    sendMessagePromise.mockResolvedValue([
      createEntity('light.living_room', 'on'),
      createEntity('switch.kitchen', 'off'),
    ])

    const { result } = renderHook(() => ({
      lights: useEntityList<EntityState>('light'),
      switches: useEntityList<EntityState>('switch'),
    }))

    await waitFor(() => {
      expect(result.current.lights).toHaveLength(1)
      expect(result.current.switches).toHaveLength(1)
    })

    expect(subscribeEvents).toHaveBeenCalledTimes(1)
    expect(subscribeEvents).toHaveBeenCalledWith(
      expect.any(Function),
      'state_changed'
    )
    expect(sendMessagePromise).toHaveBeenCalledTimes(2)
  })

  it('applies additions, updates, and removals from the shared firehose', async () => {
    const initial = createEntity('light.living_room', 'off')
    sendMessagePromise.mockResolvedValue([initial])
    const { result } = renderHook(() => useEntityList<EntityState>('light'))
    await waitFor(() => expect(result.current).toEqual([initial]))

    const updated = createEntity(initial.entity_id, 'on')
    act(() => stateChangedHandler?.(createEvent(initial.entity_id, updated, initial)))
    expect(result.current).toEqual([updated])

    const added = createEntity('light.bedroom', 'on')
    act(() => stateChangedHandler?.(createEvent(added.entity_id, added)))
    expect(result.current).toEqual([updated, added])

    act(() => stateChangedHandler?.(createEvent(initial.entity_id, null, updated)))
    expect(result.current).toEqual([added])
  })

  it('replays events that beat a stale get_states response', async () => {
    const staleLight = createEntity('light.living_room', 'off')
    const currentLight = createEntity('light.living_room', 'on')
    const removedSwitch = createEntity('switch.kitchen', 'on')
    const snapshot = createDeferred<EntityState[]>()
    sendMessagePromise.mockReturnValue(snapshot.promise)

    const { result } = renderHook(() => ({
      lights: useEntityList<EntityState>('light'),
      switches: useEntityList<EntityState>('switch'),
    }))
    await waitFor(() => expect(sendMessagePromise).toHaveBeenCalledTimes(2))

    act(() => {
      stateChangedHandler?.(createEvent(staleLight.entity_id, currentLight, staleLight))
      stateChangedHandler?.(createEvent(removedSwitch.entity_id, null, removedSwitch))
    })
    snapshot.resolve([staleLight, removedSwitch])

    await waitFor(() => expect(result.current.lights).toEqual([currentLight]))
    expect(result.current.switches).toEqual([])
  })

  it('keeps live events when the initial snapshot fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const snapshot = createDeferred<EntityState[]>()
    sendMessagePromise.mockReturnValue(snapshot.promise)
    const liveEntity = createEntity('sensor.temperature', '21')
    const { result } = renderHook(() => useEntityList<EntityState>('sensor'))
    await waitFor(() => expect(sendMessagePromise).toHaveBeenCalledTimes(1))

    act(() => stateChangedHandler?.(createEvent(liveEntity.entity_id, liveEntity)))
    snapshot.reject(new Error('snapshot failed'))

    await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1))
    expect(result.current).toEqual([liveEntity])
  })
})
