// Configuration options for retry logic
export interface RetryOptions {
  // Maximum number of retry attempts (default: 3)
  maxAttempts?: number
  // Delay between retries in milliseconds (default: 1000)
  baseDelay?: number
  // Whether to use exponential backoff (default: true)
  exponentialBackoff?: boolean
  // Maximum delay between retries in milliseconds (default: 10000)
  maxDelay?: number
  // Function to determine if an error should trigger a retry
  shouldRetry?: (error: Error, attempt: number) => boolean
}

// Default retry options
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
  maxDelay: 10000,
  shouldRetry: (error: Error) => {
    // Don't retry for validation errors or unsupported features
    const nonRetryableErrors = ['FeatureNotSupportedError', 'InvalidParameterError', 'EntityNotAvailableError']
    return !nonRetryableErrors.includes(error.name)
  }
}

// Executes an async function with retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error = new Error('No attempts made')
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry if this is the last attempt
      if (attempt === config.maxAttempts) {
        break
      }
      
      // Don't retry if error type indicates it shouldn't be retried
      if (!config.shouldRetry(lastError, attempt)) {
        break
      }
      
      // Calculate delay for next attempt
      let delay = config.baseDelay
      if (config.exponentialBackoff) {
        delay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay)
      }
      
      // Spread callers across the backoff window instead of retrying in lockstep.
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5)
      await new Promise(resolve => setTimeout(resolve, jitteredDelay))
    }
  }
  
  // If we get here, all retries failed
  throw lastError
}

// Creates a retryable version of an async function
export function createRetryableFunction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    return withRetry(() => fn(...args), options)
  }
}

// Delays execution for the specified number of milliseconds
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Extracts retry options from HAConfig, falling back to defaults
export function getRetryOptionsFromConfig(
  serviceRetry?: {
    maxAttempts?: number
    baseDelay?: number
    exponentialBackoff?: boolean
    maxDelay?: number
  }
): RetryOptions {
  return {
    maxAttempts: Math.max(1, serviceRetry?.maxAttempts ?? 3),
    baseDelay: serviceRetry?.baseDelay ?? 1000,
    exponentialBackoff: serviceRetry?.exponentialBackoff ?? true,
    maxDelay: serviceRetry?.maxDelay ?? 10000,
  }
}