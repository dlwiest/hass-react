import { useEffect, useCallback, useMemo, useState } from 'react'
import { useStore } from '../services/entityStore'
import { useHAConnection } from '../providers/HAProvider'
import type { BaseEntityHook, EntityState } from '../types'
import { useEntityIdValidation } from '../utils/entityValidation'
import { EntityNotAvailableError, ConnectionError, ServiceCallError } from '../utils/errors'
import { withRetry, getRetryOptionsFromConfig } from '../utils/retry'

// Includes service call methods for use within entity-specific hooks.
export interface EntityHook<T = Record<string, unknown>> extends BaseEntityHook<T> {
  callService: (domain: string, service: string, data?: object) => Promise<void>
  callServiceWithResponse: <R = unknown>(domain: string, service: string, data?: object) => Promise<R>
}

export function useEntity<T = Record<string, unknown>>(entityId: string): EntityHook<T> {
  const { connection, connected, config } = useHAConnection()
  const registerEntity = useStore((state) => state.registerEntity)
  const unregisterEntity = useStore((state) => state.unregisterEntity)
  const [error, setError] = useState<Error | null>(null)

  // Validate entity ID format using utility
  useEntityIdValidation(entityId)

  // Register entity and subscribe to updates
  useEffect(() => {
    const handleUpdate = () => {
      // Trigger re-render when entity updates
    }

    registerEntity(entityId, handleUpdate)
    return () => unregisterEntity(entityId, handleUpdate)
  }, [entityId, registerEntity, unregisterEntity])

  // Get current entity state
  const entity = useStore((state) => state.entities.get(entityId))

  // Get subscription errors from store
  const subscriptionError = useStore((state) => state.subscriptionErrors.get(entityId))

  // Handle subscription and entity availability errors
  useEffect(() => {
    // Subscription errors take priority over availability errors
    if (subscriptionError) {
      setError(subscriptionError)
      return
    }

    if (connected && entityId) {
      if (!entity) {
        // Wait for entities to populate before marking as error
        const timer = setTimeout(() => {
          const stillMissing = !useStore.getState().entities.get(entityId)
          if (stillMissing) {
            setError(new EntityNotAvailableError(entityId, 'Entity not found in Home Assistant'))
          }
        }, 2000)
        return () => clearTimeout(timer)
      } else if (entity.state === 'unavailable') {
        setError(new EntityNotAvailableError(entityId, 'Entity is unavailable'))
      } else {
        // Clear error if entity becomes available
        setError(null)
      }
    } else if (!connected) {
      // Clear errors when disconnected (connection state is handled by HAProvider)
      setError(null)
    }
    return undefined
  }, [connected, entity, entityId, subscriptionError])

  const callService = useCallback(
    async (domain: string, service: string, data?: object) => {
      if (!connection) {
        throw new ConnectionError(`call ${domain}.${service}`)
      }

      // Get retry configuration from provider options
      const retryOptions = getRetryOptionsFromConfig(config.options?.serviceRetry)

      const executeServiceCall = async () => {
        try {
          await connection.sendMessagePromise({
            type: 'call_service',
            domain,
            service,
            service_data: {
              entity_id: entityId,
              ...data,
            },
          })
        } catch (originalError) {
          throw new ServiceCallError(
            domain,
            service,
            originalError instanceof Error ? originalError : new Error(String(originalError)),
            entityId
          )
        }
      }

      // Execute with retry logic
      await withRetry(executeServiceCall, retryOptions)
    },
    [connection, entityId, config.options?.serviceRetry]
  )

  const callServiceWithResponse = useCallback(
    async <R = unknown>(domain: string, service: string, data?: object): Promise<R> => {
      if (!connection) {
        throw new ConnectionError(`call ${domain}.${service}`)
      }

      // Get retry configuration from provider options
      const retryOptions = getRetryOptionsFromConfig(config.options?.serviceRetry)

      const executeServiceCall = async () => {
        try {
          const response = await connection.sendMessagePromise({
            type: 'call_service',
            domain,
            service,
            service_data: {
              entity_id: entityId,
              ...data,
            },
            return_response: true,
          })
          return response as R
        } catch (originalError) {
          throw new ServiceCallError(
            domain, 
            service, 
            originalError instanceof Error ? originalError : new Error(String(originalError)),
            entityId
          )
        }
      }

      // Execute with retry logic
      return await withRetry(executeServiceCall, retryOptions)
    },
    [connection, entityId, config.options?.serviceRetry]
  )

  const refresh = useCallback(async () => {
    if (!connection) return

    // Force fetch latest state
    const states = await connection.sendMessagePromise<EntityState[]>({
      type: 'get_states',
    })
    const latestEntity = states.find((s) => s.entity_id === entityId)

    if (latestEntity) {
      useStore.getState().updateEntity(entityId, latestEntity)
    }
  }, [connection, entityId])

  // Keep the fallback stable until this hook starts tracking a different entity.
  const currentEntity = useMemo<EntityState<T>>(
    () => (entity as EntityState<T> | undefined) ?? {
      entity_id: entityId,
      state: 'unknown',
      attributes: {} as T,
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: '', parent_id: null, user_id: null },
    },
    [entity, entityId]
  )

  const lastChanged = useMemo(
    () => new Date(currentEntity.last_changed),
    [currentEntity.last_changed]
  )
  const lastUpdated = useMemo(
    () => new Date(currentEntity.last_updated),
    [currentEntity.last_updated]
  )

  // Internal methods for entity-specific hooks to use
  const internalMethods = {
    callService,
    callServiceWithResponse,
  }

  return {
    entityId,
    state: currentEntity.state,
    attributes: currentEntity.attributes as T,
    lastChanged,
    lastUpdated,
    isUnavailable: currentEntity.state === 'unavailable',
    isConnected: connected,
    error: error || undefined,
    refresh,
    // Expose internal methods for entity-specific hooks but not in public type
    ...internalMethods,
  }
}
