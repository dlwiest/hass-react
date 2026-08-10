import { useState, useEffect } from 'react'
import { subscribeAllStateChanges, useStore } from '../services/entityStore'
import type { EntityState } from '../types/core'
import type { StateChangedEvent } from '../types/websocket'

/**
 * Generic hook for fetching all entities of a specific domain
 * @internal
 */
export function useEntityList<T extends { entity_id: string }>(domain: string): T[] {
  const [entities, setEntities] = useState<T[]>([])
  const connection = useStore((state) => state.connection)

  useEffect(() => {
    if (!connection) return

    let isMounted = true
    let snapshotPending = true
    const eventsDuringSnapshot: StateChangedEvent[] = []
    const domainPrefix = `${domain}.`

    const applyEvent = (current: T[], event: StateChangedEvent): T[] => {
      const index = current.findIndex(
        (entity) => entity.entity_id === event.data.entity_id
      )

      if (event.data.new_state) {
        const entity = event.data.new_state as unknown as T
        if (index === -1) {
          return [...current, entity]
        }

        const updated = [...current]
        updated[index] = entity
        return updated
      }

      if (index === -1) {
        return current
      }
      return current.filter((entity) => entity.entity_id !== event.data.entity_id)
    }

    // Register locally before starting the snapshot so no event can land in the gap.
    const unsubscribe = subscribeAllStateChanges((event) => {
      if (!event.data.entity_id.startsWith(domainPrefix)) {
        return
      }

      if (snapshotPending) {
        eventsDuringSnapshot.push(event)
      }
      setEntities((current) => applyEvent(current, event))
    })

    const fetchEntities = async () => {
      try {
        const states = await connection.sendMessagePromise<EntityState[]>({
          type: 'get_states',
        })

        if (!isMounted) {
          return
        }

        const domainEntities = states.filter(
          (entity) => entity.entity_id.startsWith(domainPrefix)
        ) as unknown as T[]

        // Replay events that arrived after get_states was sent. In particular, a
        // removal event must remain a tombstone instead of being re-added by a
        // stale snapshot response.
        setEntities(() =>
          eventsDuringSnapshot.reduce(applyEvent, domainEntities)
        )
        snapshotPending = false
      } catch (error) {
        console.error(`Failed to fetch ${domain} entities:`, error)
        snapshotPending = false
      }
    }

    void fetchEntities()

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [connection, domain])

  return entities
}
