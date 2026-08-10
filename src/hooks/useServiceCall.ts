import { useCallback } from 'react'
import { useHAConnection } from '../providers/HAProvider'
import { ConnectionError, ServiceCallError } from '../utils/errors'
import { withRetry, getRetryOptionsFromConfig } from '../utils/retry'

export function useServiceCall() {
  const { connection, config } = useHAConnection()

  const callService = useCallback(
    async (domain: string, service: string, data?: Record<string, unknown>) => {
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
            service_data: data ?? {},
          })
        } catch (originalError) {
          throw new ServiceCallError(
            domain,
            service,
            originalError instanceof Error ? originalError : new Error(String(originalError))
          )
        }
      }

      // Execute with retry logic
      await withRetry(executeServiceCall, retryOptions)
    },
    [connection, config.options?.serviceRetry]
  )

  const callServiceWithResponse = useCallback(
    async <R = unknown>(domain: string, service: string, data?: Record<string, unknown>): Promise<R> => {
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
            service_data: data ?? {},
            return_response: true,
          })
          return response as R
        } catch (originalError) {
          throw new ServiceCallError(
            domain,
            service,
            originalError instanceof Error ? originalError : new Error(String(originalError))
          )
        }
      }

      // Execute with retry logic
      return await withRetry(executeServiceCall, retryOptions)
    },
    [connection, config.options?.serviceRetry]
  )

  return {
    callService,
    callServiceWithResponse,
  }
}
