import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, act } from '@testing-library/react'
import { HAProvider } from '../HAProvider'
import { useEntity } from '../../hooks/useEntity'
import { useStore } from '../../services/entityStore'
import { createAuthenticatedConnection } from '../../services/auth'
import type { EntityState, StateChangedEvent } from '../../types'

// Integration seam test: real entityStore + real hooks, mocked auth/socket layer.
// Pins the provider <-> store composition across a disconnect/reconnect cycle:
// exactly one live state_changed subscription afterward, on the new connection,
// with the old connection closed and its late events ignored.
vi.mock('../../services/auth', async () => {
  const actual = await vi.importActual('../../services/auth')
  return {
    ...actual,
    createAuthenticatedConnection: vi.fn(),
    refreshTokenIfNeeded: vi.fn().mockResolvedValue(undefined),
  }
})

const mockCreateAuthenticatedConnection = vi.mocked(createAuthenticatedConnection)

function createEntity(entityId: string, state: string): EntityState {
  return {
    entity_id: entityId,
    state,
    attributes: {},
    last_changed: '2026-08-10T00:00:00Z',
    last_updated: '2026-08-10T00:00:00Z',
    context: { id: 'ctx', parent_id: null, user_id: null },
  }
}

interface SeamConnection {
  connection: {
    addEventListener: Mock
    removeEventListener: Mock
    close: Mock
    subscribeEvents: Mock
    sendMessagePromise: Mock
  }
  fireDisconnected: () => void
  emitStateChanged: (event: StateChangedEvent) => void
  unsubscribe: Mock
}

function createSeamConnection(states: EntityState[]): SeamConnection {
  const listeners: Record<string, Array<() => void>> = {}
  let stateHandler: ((event: StateChangedEvent) => void) | null = null
  const unsubscribe = vi.fn()

  const connection = {
    addEventListener: vi.fn((event: string, cb: () => void) => {
      ;(listeners[event] ??= []).push(cb)
    }),
    removeEventListener: vi.fn((event: string, cb: () => void) => {
      listeners[event] = (listeners[event] ?? []).filter((fn) => fn !== cb)
    }),
    close: vi.fn(),
    subscribeEvents: vi.fn(async (cb: (event: StateChangedEvent) => void) => {
      stateHandler = cb
      return unsubscribe
    }),
    sendMessagePromise: vi.fn(async (message: { type: string }) => {
      if (message.type === 'get_states') return states
      return {}
    }),
  }

  return {
    connection,
    fireDisconnected: () => listeners['disconnected']?.forEach((fn) => fn()),
    emitStateChanged: (event) => stateHandler?.(event),
    unsubscribe,
  }
}

function stateChanged(entityId: string, newState: EntityState | null): StateChangedEvent {
  return {
    event_type: 'state_changed',
    data: {
      entity_id: entityId,
      old_state: null,
      new_state: newState as EntityState,
    },
    origin: 'LOCAL',
    time_fired: '2026-08-10T00:00:00Z',
    context: { id: 'ctx', parent_id: null, user_id: null },
  } as StateChangedEvent
}

function KitchenLight() {
  const { state } = useEntity('light.kitchen')
  return <div data-testid="kitchen-state">{state}</div>
}

const mockAuth = {
  data: { access_token: 't', expires: Date.now() + 3_600_000, refresh_token: '' },
  expired: false,
  accessToken: 't',
  refreshAccessToken: vi.fn(),
  revoke: vi.fn(),
} as never

describe('HAProvider + entityStore integration seam', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      useStore.getState().clear()
    })
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('holds exactly one live subscription on the new connection after disconnect/reconnect', async () => {
    const first = createSeamConnection([createEntity('light.kitchen', 'on')])
    const second = createSeamConnection([createEntity('light.kitchen', 'off')])
    mockCreateAuthenticatedConnection
      .mockResolvedValueOnce({ connection: first.connection, auth: mockAuth } as never)
      .mockResolvedValueOnce({ connection: second.connection, auth: mockAuth } as never)

    render(
      <HAProvider url="http://test:8123" token="token" authMode="token">
        <KitchenLight />
      </HAProvider>
    )

    // Initial connect: one subscription on C1, snapshot applied.
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(first.connection.subscribeEvents).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('kitchen-state')).toHaveTextContent('on')

    // Network drop: provider must close C1 and clear the store connection.
    await act(async () => {
      first.fireDisconnected()
      await Promise.resolve()
    })
    expect(first.connection.close).toHaveBeenCalledTimes(1)
    // The store must release its own handle on the dead connection, not rely on close() sweeping it.
    expect(first.unsubscribe).toHaveBeenCalledTimes(1)

    // Auto-retry (1s backoff) builds C2: exactly one subscription there too.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(second.connection.subscribeEvents).toHaveBeenCalledTimes(1)
    expect(first.connection.subscribeEvents).toHaveBeenCalledTimes(1) // never re-subscribed
    expect(screen.getByTestId('kitchen-state')).toHaveTextContent('off')

    // A late event from the dead connection must be ignored...
    await act(async () => {
      first.emitStateChanged(stateChanged('light.kitchen', createEntity('light.kitchen', 'stale')))
      await Promise.resolve()
    })
    expect(screen.getByTestId('kitchen-state')).toHaveTextContent('off')

    // ...while the live connection still drives updates.
    await act(async () => {
      second.emitStateChanged(stateChanged('light.kitchen', createEntity('light.kitchen', 'on')))
      await Promise.resolve()
    })
    expect(screen.getByTestId('kitchen-state')).toHaveTextContent('on')
  })

  it('drops the store subscription and closes the connection on unmount', async () => {
    const first = createSeamConnection([createEntity('light.kitchen', 'on')])
    mockCreateAuthenticatedConnection.mockResolvedValueOnce({
      connection: first.connection,
      auth: mockAuth,
    } as never)

    const { unmount } = render(
      <HAProvider url="http://test:8123" token="token" authMode="token">
        <KitchenLight />
      </HAProvider>
    )

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(first.connection.subscribeEvents).toHaveBeenCalledTimes(1)

    unmount()
    expect(first.connection.close).toHaveBeenCalledTimes(1)

    // Store must not dispatch to anything after teardown.
    await act(async () => {
      first.emitStateChanged(stateChanged('light.kitchen', createEntity('light.kitchen', 'off')))
      await Promise.resolve()
    })
    expect(useStore.getState().entities.get('light.kitchen')).toBeUndefined()
  })
})
