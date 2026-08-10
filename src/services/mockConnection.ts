import { useStore } from './entityStore'
import type { HAConnection } from '../types'
import { mockServiceCall } from '../test/utils/mockStateTransitions'
import { mockTodoItems, mockCalendarEvents, type MockTodoItem, type MockCalendarEvent } from './mockData'

interface ServiceData {
  entity_id: string
  [key: string]: string | number | boolean | undefined | Record<string, unknown>
}

interface ServiceCallMessage {
  type: 'call_service'
  domain: string
  service: string
  service_data: ServiceData
  return_response?: boolean
}

interface GetStatesMessage {
  type: 'get_states'
}

type MockMessage = ServiceCallMessage | GetStatesMessage | { type: string }

export function createMockConnection(): HAConnection {
  return {
    sendMessagePromise: async (message: MockMessage) => {
      const { type } = message

      if (type === 'call_service') {
        const { domain, service, service_data, return_response } = message as ServiceCallMessage
        const entityId = service_data.entity_id

        // Handle service calls that return data
        if (return_response) {
          // Mock response for todo.get_items service
          if (domain === 'todo' && service === 'get_items') {
            const items = mockTodoItems[entityId] || []
            return {
              response: {
                [entityId]: { items }
              }
            }
          }

          // Mock response for calendar.get_events service
          if (domain === 'calendar' && service === 'get_events') {
            const events = mockCalendarEvents[entityId] || []
            const startDate = service_data.start_date_time as string
            const endDate = service_data.end_date_time as string

            // Filter events by date range
            const filteredEvents = events.filter(event => {
              return event.start >= startDate && event.start <= endDate
            })

            return { events: filteredEvents }
          }

          // Return empty object for other services
          return {}
        }

        // Handle todo service calls
        if (domain === 'todo') {
          const currentItems = mockTodoItems[entityId] || []
          
          switch (service) {
            case 'add_item': {
              const newItem: MockTodoItem = {
                uid: `item-${Date.now()}`,
                summary: service_data.item as string,
                status: 'needs_action'
              }
              mockTodoItems[entityId] = [...currentItems, newItem]
              
              // Update entity state to reflect new count
              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  state: mockTodoItems[entityId].length.toString(),
                  last_updated: new Date().toISOString()
                })
              }
              return
            }
            
            case 'remove_item': {
              const itemId = service_data.item as string
              mockTodoItems[entityId] = currentItems.filter(item => item.uid !== itemId)
              
              // Update entity state
              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  state: mockTodoItems[entityId].length.toString(),
                  last_updated: new Date().toISOString()
                })
              }
              return
            }
            
            case 'update_item': {
              const itemId = service_data.item as string
              const newStatus = service_data.status as 'needs_action' | 'completed'
              mockTodoItems[entityId] = currentItems.map(item =>
                item.uid === itemId ? { ...item, status: newStatus } : item
              )
              
              // Update entity state
              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  last_updated: new Date().toISOString()
                })
              }
              return
            }
            
            case 'remove_completed_items': {
              mockTodoItems[entityId] = currentItems.filter(item => item.status !== 'completed')
              
              // Update entity state
              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  state: mockTodoItems[entityId].length.toString(),
                  last_updated: new Date().toISOString()
                })
              }
              return
            }
          }
        }

        // Handle calendar service calls
        if (domain === 'calendar') {
          const currentEvents = mockCalendarEvents[entityId] || []

          switch (service) {
            case 'create_event': {
              const newEvent: MockCalendarEvent = {
                uid: `event-${Date.now()}`,
                start: service_data.start_date_time as string,
                end: service_data.end_date_time as string,
                summary: service_data.summary as string,
                description: service_data.description as string | undefined,
                location: service_data.location as string | undefined,
                rrule: service_data.rrule as string | undefined
              }
              mockCalendarEvents[entityId] = [...currentEvents, newEvent]

              // Update entity state if event is currently active
              const now = new Date().toISOString().slice(0, 19)
              const hasActiveEvent = mockCalendarEvents[entityId].some(
                e => e.start <= now && e.end >= now
              )

              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  state: hasActiveEvent ? 'on' : 'off',
                  last_updated: new Date().toISOString()
                })
              }
              return
            }

            case 'update_event': {
              const uid = service_data.uid as string
              mockCalendarEvents[entityId] = currentEvents.map(event =>
                event.uid === uid ? {
                  ...event,
                  start: (service_data.start_date_time as string) || event.start,
                  end: (service_data.end_date_time as string) || event.end,
                  summary: (service_data.summary as string) || event.summary,
                  description: service_data.description !== undefined ? (service_data.description as string) : event.description,
                  location: service_data.location !== undefined ? (service_data.location as string) : event.location,
                  rrule: service_data.rrule !== undefined ? (service_data.rrule as string) : event.rrule
                } : event
              )

              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  last_updated: new Date().toISOString()
                })
              }
              return
            }

            case 'remove_event': {
              const uid = service_data.uid as string
              mockCalendarEvents[entityId] = currentEvents.filter(event => event.uid !== uid)

              // Update entity state
              const now = new Date().toISOString().slice(0, 19)
              const hasActiveEvent = mockCalendarEvents[entityId].some(
                e => e.start <= now && e.end >= now
              )

              const currentEntity = useStore.getState().entities.get(entityId)
              if (currentEntity) {
                useStore.getState().updateEntity(entityId, {
                  ...currentEntity,
                  state: hasActiveEvent ? 'on' : 'off',
                  last_updated: new Date().toISOString()
                })
              }
              return
            }
          }
        }

        // Handle regular service calls (actions)
        const currentEntity = useStore.getState().entities.get(entityId)
        if (!currentEntity) return

        // Use mock state transition utilities to handle the service call
        const { entity_id: _entityId, ...serviceData } = service_data
        const transition = mockServiceCall(
          domain,
          service,
          currentEntity.state,
          currentEntity.attributes,
          serviceData
        )

        // For scenes, always update last_changed when activated (even though state doesn't change)
        const shouldUpdateLastChanged = domain === 'scene' && service === 'turn_on'
          ? true
          : transition.state !== currentEntity.state

        const newTimestamp = new Date().toISOString()

        // Update the entity in the store
        useStore.getState().updateEntity(entityId, {
          ...currentEntity,
          state: transition.state,
          attributes: transition.attributes,
          last_updated: newTimestamp,
          last_changed: shouldUpdateLastChanged ? newTimestamp : currentEntity.last_changed,
        })

        return
      } else if (type === 'get_states') {
        // Return all entities as an array
        return Array.from(useStore.getState().entities.values())
      }

      // Default response
      return {}
    },

    subscribeEvents: () => {
      // Mock subscription - return a no-op unsubscribe that returns a promise
      return Promise.resolve(() => Promise.resolve())
    },

    addEventListener: () => {},
    removeEventListener: () => {},
    close: () => {},
  } as HAConnection
}
