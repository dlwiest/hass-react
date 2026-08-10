import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { HAProvider, useHAConnection } from '../HAProvider'
import { useTodo } from '../../hooks/useTodo'
import { useStore } from '../../services/entityStore'
import { TodoFeatures } from '../../types'
import type {
  EntityState,
  HAConnection,
  HATransport,
  HATransportHandlers,
  TodoItem,
} from '../../types'

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  createAuthenticatedConnection: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ logout: authMocks.logout }),
}))

vi.mock('../../services/auth', async () => {
  const actual = await vi.importActual<typeof import('../../services/auth')>('../../services/auth')
  return {
    ...actual,
    createAuthenticatedConnection: authMocks.createAuthenticatedConnection,
  }
})

const shoppingListEntity: EntityState = {
  entity_id: 'todo.shopping_list',
  state: '0',
  attributes: {
    friendly_name: 'Shopping List',
    supported_features:
      TodoFeatures.SUPPORT_ADD_ITEM |
      TodoFeatures.SUPPORT_REMOVE_ITEM |
      TodoFeatures.SUPPORT_UPDATE_ITEM |
      TodoFeatures.SUPPORT_CLEAR_COMPLETED,
  },
  last_changed: '2026-01-01T00:00:00.000Z',
  last_updated: '2026-01-01T00:00:00.000Z',
  context: { id: 'context', parent_id: null, user_id: null },
}

function createExternalFixture() {
  let handlers: HATransportHandlers | undefined
  const handlerHistory: HATransportHandlers[] = []
  let items: TodoItem[] = []
  const stateSubscribers = new Set<(event: unknown) => void>()

  const connection: HAConnection = {
    sendMessagePromise: vi.fn(async <T,>(message: Record<string, unknown>): Promise<T> => {
      if (message.type === 'get_states') {
        return [shoppingListEntity] as T
      }

      if (message.type === 'call_service') {
        const data = message.service_data as Record<string, unknown>
        const service = message.service

        if (service === 'get_items') {
          return {
            response: {
              'todo.shopping_list': { items: [...items] },
            },
          } as T
        }

        if (service === 'add_item') {
          items = [
            ...items,
            {
              uid: `item-${items.length + 1}`,
              summary: data.item as string,
              status: 'needs_action',
            },
          ]
          return undefined as T
        }
      }

      return undefined as T
    }),
    subscribeEvents: vi.fn(async (callback: (event: unknown) => void) => {
      stateSubscribers.add(callback)
      return () => stateSubscribers.delete(callback)
    }),
  }

  const transport: HATransport = {
    connect: vi.fn(async (nextHandlers) => {
      handlers = nextHandlers
      handlerHistory.push(nextHandlers)
      return connection
    }),
    disconnect: vi.fn(),
    logout: vi.fn(),
  }

  return {
    connection,
    transport,
    getHandlers: () => handlers,
    getHandlerHistory: () => handlerHistory,
  }
}

function ConnectionHarness() {
  const { connected, connectionState, error, reconnect, logout, connection } = useHAConnection()
  return (
    <div>
      <span data-testid="connected">{String(connected)}</span>
      <span data-testid="state">{connectionState}</span>
      <span data-testid="error">{error?.message ?? 'none'}</span>
      <span data-testid="connection">{connection ? 'present' : 'missing'}</span>
      <button onClick={reconnect}>Reconnect</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

function TodoHarness() {
  const todo = useTodo('todo.shopping_list')
  return (
    <div>
      <span data-testid="todo-connected">{String(todo.isConnected)}</span>
      <span data-testid="items">{todo.items.map((item) => item.summary).join(',')}</span>
      <button onClick={() => void todo.addItem('Milk')}>Add milk</button>
    </div>
  )
}

describe('HAProvider external transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStore.getState().clear()
  })

  afterEach(() => {
    useStore.getState().clear()
  })

  it('connects without browser-side authentication', async () => {
    const fixture = createExternalFixture()

    render(
      <HAProvider url="http://gateway.local" transport={fixture.transport}>
        <ConnectionHarness />
      </HAProvider>
    )

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'))

    expect(screen.getByTestId('connection')).toHaveTextContent('present')
    expect(fixture.transport.connect).toHaveBeenCalledOnce()
    expect(authMocks.createAuthenticatedConnection).not.toHaveBeenCalled()
    expect(useStore.getState().connection).toBe(fixture.connection)
  })

  it('drives existing hooks through the supplied connection', async () => {
    const fixture = createExternalFixture()

    render(
      <HAProvider url="http://gateway.local" transport={fixture.transport}>
        <TodoHarness />
      </HAProvider>
    )

    await waitFor(() => expect(screen.getByTestId('todo-connected')).toHaveTextContent('true'))
    fireEvent.click(screen.getByRole('button', { name: 'Add milk' }))
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('Milk'))

    expect(fixture.connection.sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'call_service',
        domain: 'todo',
        service: 'add_item',
        service_data: expect.objectContaining({
          entity_id: 'todo.shopping_list',
          item: 'Milk',
        }),
      })
    )
    expect(fixture.connection.sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'call_service',
        domain: 'todo',
        service: 'get_items',
        return_response: true,
      })
    )
  })

  it('reflects transport disconnect and ready lifecycle events', async () => {
    const fixture = createExternalFixture()

    render(
      <HAProvider url="http://gateway.local" transport={fixture.transport} options={{ autoReconnect: false }}>
        <ConnectionHarness />
      </HAProvider>
    )

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'))

    act(() => fixture.getHandlers()?.onDisconnected())
    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('state')).toHaveTextContent('disconnected')
    expect(fixture.transport.disconnect).toHaveBeenCalledWith(fixture.connection)
    await waitFor(() => expect(useStore.getState().connection).toBeNull())
  })

  it('uses transport lifecycle methods for reconnect, logout, and unmount', async () => {
    const fixture = createExternalFixture()
    const rendered = render(
      <HAProvider url="http://gateway.local" transport={fixture.transport}>
        <ConnectionHarness />
      </HAProvider>
    )

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'))

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(fixture.transport.connect).toHaveBeenCalledTimes(2))
    expect(fixture.transport.disconnect).toHaveBeenCalledWith(fixture.connection)

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(fixture.transport.logout).toHaveBeenCalledOnce()
    expect(authMocks.logout).not.toHaveBeenCalled()

    rendered.unmount()
    expect(fixture.transport.disconnect).toHaveBeenCalled()
  })

  it('ignores stale disconnect callbacks after reconnecting', async () => {
    const fixture = createExternalFixture()

    render(
      <HAProvider url="http://gateway.local" transport={fixture.transport}>
        <ConnectionHarness />
      </HAProvider>
    )

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'))
    const firstHandlers = fixture.getHandlerHistory()[0]

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(fixture.transport.connect).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'))

    act(() => firstHandlers.onDisconnected())

    expect(screen.getByTestId('connected')).toHaveTextContent('true')
    expect(fixture.transport.disconnect).toHaveBeenCalledTimes(1)
    expect(useStore.getState().connection).toBe(fixture.connection)
  })

  it('disconnects a pending connection that resolves after unmount', async () => {
    let resolveConnection!: (connection: HAConnection) => void
    const connectionPromise = new Promise<HAConnection>((resolve) => {
      resolveConnection = resolve
    })
    const connection: HAConnection = {
      sendMessagePromise: vi.fn(),
      subscribeEvents: vi.fn(),
    }
    const transport: HATransport = {
      connect: vi.fn(() => connectionPromise),
      disconnect: vi.fn(),
    }

    const rendered = render(
      <HAProvider url="http://gateway.local" transport={transport}>
        <ConnectionHarness />
      </HAProvider>
    )
    rendered.unmount()

    await act(async () => {
      resolveConnection(connection)
      await connectionPromise
    })

    expect(transport.disconnect).toHaveBeenCalledWith(connection)
    expect(useStore.getState().connection).toBeNull()
  })

  it('does not auto-reconnect after logout', async () => {
    vi.useFakeTimers()
    const fixture = createExternalFixture()
    const rendered = render(
      <HAProvider url="http://gateway.local" transport={fixture.transport}>
        <ConnectionHarness />
      </HAProvider>
    )

    try {
      await act(async () => {
        await Promise.resolve()
      })
      expect(fixture.transport.connect).toHaveBeenCalledOnce()

      fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(fixture.transport.connect).toHaveBeenCalledOnce()
    } finally {
      rendered.unmount()
      vi.useRealTimers()
    }
  })

  it('surfaces connection failures and preserves provider retry semantics', async () => {
    const transport: HATransport = {
      connect: vi.fn().mockRejectedValue(new Error('Gateway unavailable')),
      disconnect: vi.fn(),
    }

    render(
      <HAProvider url="http://gateway.local" transport={transport} options={{ autoReconnect: false }}>
        <ConnectionHarness />
      </HAProvider>
    )

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('Gateway unavailable')
    expect(screen.getByTestId('connected')).toHaveTextContent('false')
  })
})
