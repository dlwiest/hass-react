import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withRetry,
  createRetryableFunction,
  delay,
  getRetryOptionsFromConfig,
} from '../retry'

describe('retry utilities', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await withRetry(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')
      
      const result = await withRetry(operation, { 
        maxAttempts: 3, 
        baseDelay: 10 // Small delay for test speed
      })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should fail after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fail'))
      
      await expect(withRetry(operation, { 
        maxAttempts: 2, 
        baseDelay: 10 
      })).rejects.toThrow('always fail')
      
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry for FeatureNotSupportedError', async () => {
      class FeatureNotSupportedError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'FeatureNotSupportedError'
        }
      }
      
      const operation = vi.fn().mockRejectedValue(new FeatureNotSupportedError('not supported'))
      
      await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow('not supported')
      expect(operation).toHaveBeenCalledTimes(1) // Should not retry
    })

    it('should not retry for InvalidParameterError', async () => {
      class InvalidParameterError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'InvalidParameterError'
        }
      }
      
      const operation = vi.fn().mockRejectedValue(new InvalidParameterError('invalid param'))
      
      await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow('invalid param')
      expect(operation).toHaveBeenCalledTimes(1) // Should not retry
    })

    it('should not retry for EntityNotAvailableError', async () => {
      class EntityNotAvailableError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'EntityNotAvailableError'
        }
      }
      
      const operation = vi.fn().mockRejectedValue(new EntityNotAvailableError('entity not found'))
      
      await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow('entity not found')
      expect(operation).toHaveBeenCalledTimes(1) // Should not retry
    })

    it('should use the stable error name instead of the constructor name', async () => {
      class MinifiedError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'FeatureNotSupportedError'
        }
      }

      const operation = vi.fn().mockRejectedValue(new MinifiedError('not supported'))

      await expect(withRetry(operation, { maxAttempts: 3 })).rejects.toThrow('not supported')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should respect custom shouldRetry function', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('custom error'))
      const shouldRetry = vi.fn().mockReturnValue(false)
      
      await expect(withRetry(operation, { 
        maxAttempts: 3, 
        shouldRetry 
      })).rejects.toThrow('custom error')
      
      expect(operation).toHaveBeenCalledTimes(1)
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1)
    })

    it('should use custom retry options', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      await expect(withRetry(operation, {
        maxAttempts: 1,
        baseDelay: 500,
        exponentialBackoff: false
      })).rejects.toThrow('fail')
      
      expect(operation).toHaveBeenCalledTimes(1) // Only one attempt with maxAttempts: 1
    })

    it('should jitter the retry delay into the lower half-to-full delay window', async () => {
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('retry'))
        .mockResolvedValue('success')

      const result = withRetry(operation, {
        maxAttempts: 2,
        baseDelay: 1000,
        exponentialBackoff: false,
      })
      await Promise.resolve()

      expect(operation).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(499)
      expect(operation).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      await expect(result).resolves.toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })
  })

  describe('createRetryableFunction', () => {
    it('should create a function that automatically retries', async () => {
      const originalFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const retryableFn = createRetryableFunction(originalFn, { 
        maxAttempts: 2, 
        baseDelay: 10 
      })
      
      const result = await retryableFn('arg1', 'arg2')
      
      expect(result).toBe('success')
      expect(originalFn).toHaveBeenCalledTimes(2)
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('getRetryOptionsFromConfig', () => {
    it('should clamp maxAttempts to at least one', () => {
      expect(getRetryOptionsFromConfig({ maxAttempts: 0 }).maxAttempts).toBe(1)
      expect(getRetryOptionsFromConfig({ maxAttempts: -5 }).maxAttempts).toBe(1)
      expect(getRetryOptionsFromConfig({ maxAttempts: 4 }).maxAttempts).toBe(4)
    })
  })

  describe('delay', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should delay for specified milliseconds', async () => {
      const promise = delay(1000)
      
      // Promise should not resolve immediately
      let resolved = false
      promise.then(() => { resolved = true })
      
      // Fast-forward time
      vi.advanceTimersByTime(999)
      await Promise.resolve() // Let microtasks run
      expect(resolved).toBe(false)
      
      vi.advanceTimersByTime(1)
      await promise // Should resolve now
      expect(resolved).toBe(true)
    })
  })
})