import { useStore } from './entityStore'
import type { EntityState, HAConnection, StateChangedEvent } from '../types'
import { mockServiceCall } from './mockStateTransitions'
import {
  createMockTodoItems,
  createMockCalendarEvents,
  type MockTodoItem,
  type MockCalendarEvent
} from './mockData'

interface ServiceData {
  entity_id?: string
  [key: string]: unknown
}

interface ServiceCallMessage {
  type: 'call_service'
  domain: string
  service: string
  service_data?: ServiceData
  return_response?: boolean
}

interface GetStatesMessage {
  type: 'get_states'
}

type MockMessage = ServiceCallMessage | GetStatesMessage | { type: string }
type StateChangedListener = (event: StateChangedEvent) => void

export function createMockConnection(): HAConnection {
  const todoItems = createMockTodoItems()
  const calendarEvents = createMockCalendarEvents()
  const eventListeners = new Map<string | undefined, Set<StateChangedListener>>()
  let nextUid = 1
  let nextContextId = 1

  const createContext = () => ({
    id: `mock-context-${nextContextId++}`,
    parent_id: null,
    user_id: null
  })

  const emitStateChanged = (
    entityId: string,
    oldState: EntityState | null,
    newState: EntityState
  ) => {
    const event: StateChangedEvent = {
      event_type: 'state_changed',
      data: {
        entity_id: entityId,
        old_state: oldState,
        new_state: newState
      }
    }

    for (const eventType of [undefined, 'state_changed']) {
      for (const listener of eventListeners.get(eventType) || []) {
        listener(event)
      }
    }
  }

  const updateEntity = (entityId: string, newState: EntityState) => {
    const oldState = useStore.getState().entities.get(entityId) || null
    emitStateChanged(entityId, oldState, newState)
    if (useStore.getState().entities.get(entityId) !== newState) {
      useStore.getState().updateEntity(entityId, newState)
    }
  }

  return {
    sendMessagePromise: async (message: MockMessage) => {
      const { type } = message

      if (type === 'get_states') {
        return Array.from(useStore.getState().entities.values())
      }

      if (type === 'camera/stream') {
        return { url: '/api/hls/mock-playlist.m3u8' }
      }

      if (type === 'auth/current_user') {
        return {
          id: 'mock-user-id',
          name: 'Mock User',
          is_owner: true,
          is_admin: true,
          local_only: false,
          system_generated: false,
          group_ids: ['mock-group-1']
        }
      }

      if (type !== 'call_service') {
        throw new Error(`Unknown mock command type: ${type}`)
      }

      const {
        domain,
        service,
        service_data: serviceData = {},
        return_response: returnResponse
      } = message as ServiceCallMessage
      const entityId = serviceData.entity_id

      if (returnResponse) {
        if (domain === 'todo' && service === 'get_items' && entityId) {
          const items = todoItems[entityId] || []
          return {
            context: createContext(),
            response: {
              [entityId]: { items }
            }
          }
        }

        if (domain === 'calendar' && service === 'get_events' && entityId) {
          const events = calendarEvents[entityId] || []
          const startDate = serviceData.start_date_time as string | undefined
          const endDate = serviceData.end_date_time as string | undefined
          const filteredEvents = events.filter(event => {
            return (!startDate || event.start >= startDate) &&
              (!endDate || event.start <= endDate)
          })

          return {
            context: createContext(),
            response: {
              [entityId]: { events: filteredEvents }
            }
          }
        }

        return {
          context: createContext(),
          response: {}
        }
      }

      if (domain === 'todo' && entityId) {
        const currentItems = todoItems[entityId] || []

        switch (service) {
          case 'add_item': {
            const newItem: MockTodoItem = {
              uid: `item-${nextUid++}`,
              summary: serviceData.item as string,
              status: 'needs_action'
            }
            todoItems[entityId] = [...currentItems, newItem]

            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                state: todoItems[entityId].length.toString(),
                last_updated: new Date().toISOString()
              })
            }
            return
          }

          case 'remove_item': {
            const itemId = serviceData.item as string
            todoItems[entityId] = currentItems.filter(item => item.uid !== itemId)

            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                state: todoItems[entityId].length.toString(),
                last_updated: new Date().toISOString()
              })
            }
            return
          }

          case 'update_item': {
            const itemId = serviceData.item as string
            const newStatus = serviceData.status as 'needs_action' | 'completed'
            todoItems[entityId] = currentItems.map(item =>
              item.uid === itemId ? { ...item, status: newStatus } : item
            )

            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                last_updated: new Date().toISOString()
              })
            }
            return
          }

          case 'remove_completed_items': {
            todoItems[entityId] = currentItems.filter(item => item.status !== 'completed')

            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                state: todoItems[entityId].length.toString(),
                last_updated: new Date().toISOString()
              })
            }
            return
          }
        }
      }

      if (domain === 'calendar' && entityId) {
        const currentEvents = calendarEvents[entityId] || []

        switch (service) {
          case 'create_event': {
            const newEvent: MockCalendarEvent = {
              uid: `event-${nextUid++}`,
              start: serviceData.start_date_time as string,
              end: serviceData.end_date_time as string,
              summary: serviceData.summary as string,
              description: serviceData.description as string | undefined,
              location: serviceData.location as string | undefined,
              rrule: serviceData.rrule as string | undefined
            }
            calendarEvents[entityId] = [...currentEvents, newEvent]

            const now = new Date().toISOString().slice(0, 19)
            const hasActiveEvent = calendarEvents[entityId].some(
              event => event.start <= now && event.end >= now
            )
            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                state: hasActiveEvent ? 'on' : 'off',
                last_updated: new Date().toISOString()
              })
            }
            return
          }

          case 'update_event': {
            const uid = serviceData.uid as string
            calendarEvents[entityId] = currentEvents.map(event =>
              event.uid === uid ? {
                ...event,
                start: (serviceData.start_date_time as string) || event.start,
                end: (serviceData.end_date_time as string) || event.end,
                summary: (serviceData.summary as string) || event.summary,
                description: serviceData.description !== undefined
                  ? serviceData.description as string
                  : event.description,
                location: serviceData.location !== undefined
                  ? serviceData.location as string
                  : event.location,
                rrule: serviceData.rrule !== undefined
                  ? serviceData.rrule as string
                  : event.rrule
              } : event
            )

            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                last_updated: new Date().toISOString()
              })
            }
            return
          }

          case 'remove_event': {
            const uid = serviceData.uid as string
            calendarEvents[entityId] = currentEvents.filter(event => event.uid !== uid)

            const now = new Date().toISOString().slice(0, 19)
            const hasActiveEvent = calendarEvents[entityId].some(
              event => event.start <= now && event.end >= now
            )
            const currentEntity = useStore.getState().entities.get(entityId)
            if (currentEntity) {
              updateEntity(entityId, {
                ...currentEntity,
                state: hasActiveEvent ? 'on' : 'off',
                last_updated: new Date().toISOString()
              })
            }
            return
          }
        }
      }

      if (!entityId) {
        return
      }

      const currentEntity = useStore.getState().entities.get(entityId)
      if (!currentEntity) {
        return
      }

      const { entity_id: _entityId, ...transitionData } = serviceData
      const transition = mockServiceCall(
        domain,
        service,
        currentEntity.state,
        currentEntity.attributes,
        transitionData
      )
      const shouldUpdateLastChanged = domain === 'scene' && service === 'turn_on'
        ? true
        : transition.state !== currentEntity.state
      const newTimestamp = new Date().toISOString()

      updateEntity(entityId, {
        ...currentEntity,
        state: transition.state,
        attributes: transition.attributes,
        last_updated: newTimestamp,
        last_changed: shouldUpdateLastChanged ? newTimestamp : currentEntity.last_changed
      })
      return
    },

    subscribeEvents: async <T = StateChangedEvent>(
      callback: (event: T) => void,
      eventType?: string
    ) => {
      const listeners = eventListeners.get(eventType) || new Set<StateChangedListener>()
      const listener = callback as unknown as StateChangedListener
      listeners.add(listener)
      eventListeners.set(eventType, listeners)

      return async () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          eventListeners.delete(eventType)
        }
      }
    },

    addEventListener: () => {},
    removeEventListener: () => {},
    close: () => {}
  } as HAConnection
}
