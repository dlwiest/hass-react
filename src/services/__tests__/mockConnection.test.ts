import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntityState, StateChangedEvent } from '../../types'
import { useStore } from '../entityStore'
import { createMockConnection } from '../mockConnection'

function createEntity(entityId: string, state: string): EntityState {
  return {
    entity_id: entityId,
    state,
    attributes: {},
    last_changed: '2026-01-01T00:00:00.000Z',
    last_updated: '2026-01-01T00:00:00.000Z',
    context: { id: 'initial-context', parent_id: null, user_id: null }
  }
}

describe('createMockConnection', () => {
  beforeEach(() => {
    useStore.getState().clear()
  })

  afterEach(() => {
    useStore.getState().clear()
  })

  it('emits real state_changed events and removes unsubscribed listeners', async () => {
    const connection = createMockConnection()
    const oldState = createEntity('light.kitchen', 'off')
    useStore.getState().updateEntity(oldState.entity_id, oldState)
    const listener = vi.fn<(event: StateChangedEvent) => void>()
    const unsubscribe = await connection.subscribeEvents(listener, 'state_changed')

    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'light',
      service: 'turn_on',
      service_data: { entity_id: oldState.entity_id }
    })

    const newState = useStore.getState().entities.get(oldState.entity_id)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({
      event_type: 'state_changed',
      data: {
        entity_id: oldState.entity_id,
        old_state: oldState,
        new_state: newState
      }
    })

    await unsubscribe()
    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'light',
      service: 'turn_off',
      service_data: { entity_id: oldState.entity_id }
    })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('emits state changes from every todo and calendar mutation path', async () => {
    const connection = createMockConnection()
    useStore.getState().updateEntity('todo.shopping_list', createEntity('todo.shopping_list', '2'))
    useStore.getState().updateEntity('calendar.personal', createEntity('calendar.personal', 'off'))
    const listener = vi.fn<(event: StateChangedEvent) => void>()
    await connection.subscribeEvents(listener, 'state_changed')

    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'todo',
      service: 'add_item',
      service_data: { entity_id: 'todo.shopping_list', item: 'Coffee' }
    })
    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'todo',
      service: 'update_item',
      service_data: { entity_id: 'todo.shopping_list', item: 'item-1', status: 'completed' }
    })
    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'todo',
      service: 'remove_item',
      service_data: { entity_id: 'todo.shopping_list', item: 'item-1' }
    })
    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'todo',
      service: 'remove_completed_items',
      service_data: { entity_id: 'todo.shopping_list' }
    })

    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'calendar',
      service: 'create_event',
      service_data: {
        entity_id: 'calendar.personal',
        start_date_time: '2026-08-10T10:00:00',
        end_date_time: '2026-08-10T11:00:00',
        summary: 'Audit fixes'
      }
    })
    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'calendar',
      service: 'update_event',
      service_data: {
        entity_id: 'calendar.personal',
        uid: 'event-2',
        summary: 'Audit fixes updated'
      }
    })
    await connection.sendMessagePromise({
      type: 'call_service',
      domain: 'calendar',
      service: 'remove_event',
      service_data: { entity_id: 'calendar.personal', uid: 'event-2' }
    })

    expect(listener).toHaveBeenCalledTimes(7)
    for (const [event] of listener.mock.calls) {
      expect(event.event_type).toBe('state_changed')
      expect(event.data.old_state).not.toBeNull()
      expect(event.data.new_state.entity_id).toBe(event.data.entity_id)
    }
  })

  it('returns Home Assistant response envelopes for todo and calendar data', async () => {
    const connection = createMockConnection()

    const todoResponse = await connection.sendMessagePromise<{
      context: { id: string; parent_id: null; user_id: null }
      response: Record<string, { items: Array<{ uid: string }> }>
    }>({
      type: 'call_service',
      domain: 'todo',
      service: 'get_items',
      service_data: { entity_id: 'todo.shopping_list' },
      return_response: true
    })
    expect(todoResponse).toEqual({
      context: { id: 'mock-context-1', parent_id: null, user_id: null },
      response: {
        'todo.shopping_list': {
          items: [
            { uid: 'shop-1', summary: 'Buy milk', status: 'needs_action' },
            { uid: 'shop-2', summary: 'Get bread', status: 'completed' }
          ]
        }
      }
    })

    const calendarResponse = await connection.sendMessagePromise<{
      context: { id: string; parent_id: null; user_id: null }
      response: Record<string, { events: Array<{ uid: string }> }>
    }>({
      type: 'call_service',
      domain: 'calendar',
      service: 'get_events',
      service_data: { entity_id: 'calendar.personal' },
      return_response: true
    })
    expect(calendarResponse.context).toEqual({
      id: 'mock-context-2',
      parent_id: null,
      user_id: null
    })
    expect(calendarResponse.response['calendar.personal'].events).toHaveLength(4)
    expect(calendarResponse).not.toHaveProperty('events')
  })

  it('isolates mutable data per connection and generates monotonic uids', async () => {
    const firstConnection = createMockConnection()

    for (const item of ['Coffee', 'Tea']) {
      await firstConnection.sendMessagePromise({
        type: 'call_service',
        domain: 'todo',
        service: 'add_item',
        service_data: { entity_id: 'todo.shopping_list', item }
      })
    }

    const firstResponse = await firstConnection.sendMessagePromise<{
      response: Record<string, { items: Array<{ uid: string }> }>
    }>({
      type: 'call_service',
      domain: 'todo',
      service: 'get_items',
      service_data: { entity_id: 'todo.shopping_list' },
      return_response: true
    })
    expect(firstResponse.response['todo.shopping_list'].items.map(item => item.uid)).toEqual([
      'shop-1',
      'shop-2',
      'item-1',
      'item-2'
    ])

    const secondConnection = createMockConnection()
    const secondResponse = await secondConnection.sendMessagePromise<{
      response: Record<string, { items: Array<{ uid: string }> }>
    }>({
      type: 'call_service',
      domain: 'todo',
      service: 'get_items',
      service_data: { entity_id: 'todo.shopping_list' },
      return_response: true
    })
    expect(secondResponse.response['todo.shopping_list'].items.map(item => item.uid)).toEqual([
      'shop-1',
      'shop-2'
    ])
  })

  it('supports core mock commands and rejects unknown command types', async () => {
    const connection = createMockConnection()
    const entity = createEntity('switch.desk', 'off')
    useStore.getState().updateEntity(entity.entity_id, entity)

    await expect(connection.sendMessagePromise({ type: 'get_states' })).resolves.toEqual([entity])
    await expect(connection.sendMessagePromise({
      type: 'call_service',
      domain: 'homeassistant',
      service: 'restart'
    })).resolves.toBeUndefined()
    await expect(connection.sendMessagePromise({
      type: 'camera/stream',
      entity_id: 'camera.front_door'
    })).resolves.toEqual({ url: '/api/hls/mock-playlist.m3u8' })
    await expect(connection.sendMessagePromise({ type: 'auth/current_user' })).resolves.toEqual({
      id: 'mock-user-id',
      name: 'Mock User',
      is_owner: true,
      is_admin: true,
      local_only: false,
      system_generated: false,
      group_ids: ['mock-group-1']
    })
    await expect(connection.sendMessagePromise({ type: 'unknown/command' })).rejects.toThrow(
      'Unknown mock command type: unknown/command'
    )
  })
})
