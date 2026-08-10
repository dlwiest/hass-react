import { useState, useEffect } from 'react'
import { useStore } from '../services/entityStore'
import type { EntityState } from '../types'

export function useEntityGroup(pattern: string | string[]): EntityState[] {
  const patterns = Array.from(new Set(Array.isArray(pattern) ? pattern : [pattern]))
  const [entities, setEntities] = useState<EntityState[]>([])

  useEffect(() => {
    // Resolve only the requested keys and preserve the previous array when no
    // member reference changed.
    const updateEntities = () => {
      const entityMap = useStore.getState().entities
      const matchingEntities = patterns
        .map((entityId) => entityMap.get(entityId))
        .filter((entity): entity is EntityState => entity !== undefined)

      setEntities((currentEntities) => {
        const unchanged =
          currentEntities.length === matchingEntities.length &&
          currentEntities.every((entity, index) => entity === matchingEntities[index])
        return unchanged ? currentEntities : matchingEntities
      })
    }

    // Initial update
    updateEntities()

    // Subscribe to changes for all matching patterns
    const unsubscribes: (() => void)[] = []
    patterns.forEach((p) => {
      useStore.getState().registerEntity(p, updateEntities)
      unsubscribes.push(() => useStore.getState().unregisterEntity(p, updateEntities))
    })

    return () => {
      unsubscribes.forEach((fn) => fn())
    }
  }, [patterns.join(',')]) // Use patterns.join(',') for dependency array

  return entities
}
