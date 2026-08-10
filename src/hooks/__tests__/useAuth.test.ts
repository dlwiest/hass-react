import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { 
  mockHasStoredAuth,
  mockLoadAuthData, 
  mockAuthLogout,
  mockIsOAuthCallback
} = vi.hoisted(() => ({
  mockHasStoredAuth: vi.fn(),
  mockLoadAuthData: vi.fn(), 
  mockAuthLogout: vi.fn(),
  mockIsOAuthCallback: vi.fn()
}))

// Mock tokenStorage
vi.mock('../../services/tokenStorage', () => ({
  hasStoredAuth: mockHasStoredAuth,
  loadAuthData: mockLoadAuthData
}))

// Mock auth service
vi.mock('../../services/auth', () => ({
  logout: mockAuthLogout,
  isOAuthCallback: mockIsOAuthCallback
}))

import { useAuth } from '../useAuth'
import type { AuthError } from '../../types/auth'

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset defaults
    mockHasStoredAuth.mockReturnValue(false)
    mockLoadAuthData.mockReturnValue(null)
    mockIsOAuthCallback.mockReturnValue(false)
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize and complete auth check when hassUrl is provided', async () => {
      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      // Since mocks are synchronous, auth check completes immediately
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.hassUrl).toBe('http://homeassistant.local:8123')
        expect(result.current.authMode).toBe('auto')
      })
    })

    it('should initialize as not authenticated when hassUrl is null', async () => {
      const { result } = renderHook(() => useAuth(null))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.authMode).toBeNull()
        expect(result.current.hassUrl).toBeNull()
      })
    })
  })

  describe('Auth Mode Detection', () => {
    it('should detect OAuth mode when stored auth exists', async () => {
      mockHasStoredAuth.mockReturnValue(true)
      mockLoadAuthData.mockReturnValue({
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() + 3600000
      })

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.authMode).toBe('oauth')
      })
    })

    it('should detect OAuth callback and mark as authenticated', async () => {
      mockIsOAuthCallback.mockReturnValue(true)
      mockHasStoredAuth.mockReturnValue(false)

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.authMode).toBe('oauth')
      })
    })

    it('should deny OAuth error callbacks and surface the callback error', async () => {
      window.history.replaceState(
        {},
        '',
        '/?error=access_denied&error_description=The+user+denied+access'
      )
      mockIsOAuthCallback.mockReturnValue(true)
      mockHasStoredAuth.mockReturnValue(true)

      const { result } = renderHook(() =>
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.authMode).toBe('oauth')
        expect(result.current.error).toMatchObject({
          code: 'access_denied',
          message: 'The user denied access',
          userMessage: 'The user denied access',
          type: 'oauth_cancelled',
          recoverable: true,
          retryAction: 'retry_auth'
        })
      })
      expect(mockLoadAuthData).not.toHaveBeenCalled()
    })

    it('should use provided authMode when no stored auth exists', async () => {
      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123', 'token')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.authMode).toBe('token')
      })
    })
  })

  describe('Token Validation', () => {
    it('should mark as not authenticated when token is expired', async () => {
      mockHasStoredAuth.mockReturnValue(true)
      mockLoadAuthData.mockReturnValue({
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'expired-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() - 1000 // Expired 1 second ago
      })

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.authMode).toBe('oauth')
      })
    })

    it('should handle missing expires_at gracefully', async () => {
      mockHasStoredAuth.mockReturnValue(true)
      mockLoadAuthData.mockReturnValue({
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'test-token',
        refresh_token: 'test-refresh'
        // expires_at is undefined
      })

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.authMode).toBe('oauth')
      })
    })
  })

  describe('Login Function', () => {
    it('should clear error on login attempt', async () => {
      const testError: AuthError = {
        code: 'test_error',
        message: 'Test error',
        userMessage: 'Test user message',
        type: 'network',
        recoverable: true
      }

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Set an error first
      act(() => {
        result.current.setAuthError(testError)
      })

      expect(result.current.error).toBe(testError)

      // Login should clear the error
      act(() => {
        result.current.login()
      })

      expect(result.current.error).toBeNull()
    })

    it('should do nothing when hassUrl is null', async () => {
      const { result } = renderHook(() => useAuth(null))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.login()
      })

      // State should remain unchanged
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Logout Function', () => {
    it('should call auth logout and update state', async () => {
      mockHasStoredAuth.mockReturnValue(true)
      mockLoadAuthData.mockReturnValue({
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Date.now() + 3600000
      })

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123', 'oauth')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(true)
      })

      act(() => {
        result.current.logout()
      })

      expect(mockAuthLogout).toHaveBeenCalledWith('http://homeassistant.local:8123')
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.authMode).toBe('oauth')
    })

    it('should do nothing when hassUrl is null', async () => {
      const { result } = renderHook(() => useAuth(null))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.logout()
      })

      expect(mockAuthLogout).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle and set auth errors', async () => {
      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const testError: AuthError = {
        code: 'network_error',
        message: 'Network failed',
        userMessage: 'Unable to connect to Home Assistant',
        type: 'network',
        recoverable: true,
        retryAction: 'retry_auth'
      }

      act(() => {
        result.current.setAuthError(testError)
      })

      expect(result.current.error).toBe(testError)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should clear error when setting authenticated to true', async () => {
      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const testError: AuthError = {
        code: 'test_error',
        message: 'Test error',
        userMessage: 'Test user message', 
        type: 'network',
        recoverable: true
      }

      // Set error first
      act(() => {
        result.current.setAuthError(testError)
      })

      expect(result.current.error).toBe(testError)

      // Setting authenticated to true should clear error
      act(() => {
        result.current.setAuthenticated(true)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should preserve error when setting authenticated to false', async () => {
      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const testError: AuthError = {
        code: 'test_error',
        message: 'Test error',
        userMessage: 'Test user message',
        type: 'network',
        recoverable: true
      }

      // Set error first
      act(() => {
        result.current.setAuthError(testError)
      })

      // Setting authenticated to false should preserve error
      act(() => {
        result.current.setAuthenticated(false)
      })

      expect(result.current.error).toBe(testError)
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('State Updates', () => {
    it('should react to hassUrl changes', async () => {
      const { result, rerender } = renderHook(
        ({ hassUrl }) => useAuth(hassUrl),
        { initialProps: { hassUrl: 'http://first.local:8123' } }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.hassUrl).toBe('http://first.local:8123')
      })

      // Change hassUrl
      rerender({ hassUrl: 'http://second.local:8123' })

      await waitFor(() => {
        expect(result.current.hassUrl).toBe('http://second.local:8123')
      })
    })

    it('should call checkAuth when hassUrl changes', async () => {
      const { rerender } = renderHook(
        ({ hassUrl }: { hassUrl: string | null }) => useAuth(hassUrl),
        { initialProps: { hassUrl: null as string | null } }
      )

      // Initially no calls since hassUrl is null
      expect(mockHasStoredAuth).not.toHaveBeenCalled()

      // Change to valid URL should trigger auth check
      rerender({ hassUrl: 'http://homeassistant.local:8123' })

      await waitFor(() => {
        expect(mockHasStoredAuth).toHaveBeenCalledWith('http://homeassistant.local:8123')
      })
    })
  })

  describe('Referential stability', () => {
    it('should preserve the returned object across unrelated rerenders', async () => {
      const { result, rerender } = renderHook(() =>
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      const auth = result.current

      rerender()

      expect(result.current).toBe(auth)
    })
  })

  describe('Authentication Flow', () => {
    it('should handle complete OAuth flow simulation', async () => {
      // Start with no stored auth
      mockHasStoredAuth.mockReturnValue(false)
      mockIsOAuthCallback.mockReturnValue(false)

      const { result } = renderHook(() => 
        useAuth('http://homeassistant.local:8123')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.authMode).toBe('auto')
      })

      // Simulate OAuth callback
      mockIsOAuthCallback.mockReturnValue(true)

      // Trigger re-check
      act(() => {
        result.current.checkAuth()
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.authMode).toBe('oauth')
      })

      // Simulate logout
      act(() => {
        result.current.logout()
      })

      expect(mockAuthLogout).toHaveBeenCalledWith('http://homeassistant.local:8123')
      expect(result.current.isAuthenticated).toBe(false)
    })
  })
})