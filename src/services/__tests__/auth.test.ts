import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Auth } from 'home-assistant-js-websocket'

const { 
  mockGetAuth,
  mockCreateConnection, 
  mockCreateLongLivedTokenAuth,
  mockAuth,
  mockSaveAuthData,
  mockLoadAuthData,
  mockRemoveAuthData,
  mockHasStoredAuth
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockCreateConnection: vi.fn(),
  mockCreateLongLivedTokenAuth: vi.fn(),
  mockAuth: vi.fn(),
  mockSaveAuthData: vi.fn(),
  mockLoadAuthData: vi.fn(),
  mockRemoveAuthData: vi.fn(),
  mockHasStoredAuth: vi.fn()
}))

// Mock the home-assistant-js-websocket module
vi.mock('home-assistant-js-websocket', () => ({
  getAuth: mockGetAuth,
  createConnection: mockCreateConnection,
  createLongLivedTokenAuth: mockCreateLongLivedTokenAuth,
  Auth: mockAuth,
  ERR_CANNOT_CONNECT: 1,
  ERR_INVALID_AUTH: 2
}))

// Mock tokenStorage
vi.mock('../tokenStorage', () => ({
  saveAuthData: mockSaveAuthData,
  loadAuthData: mockLoadAuthData,
  removeAuthData: mockRemoveAuthData,
  hasStoredAuth: mockHasStoredAuth
}))

import { 
  getOAuthUrl, 
  handleOAuthCallback, 
  createAuthenticatedConnection,
  logout,
  isOAuthCallback,
  refreshTokenIfNeeded,
  isTokenExpiring
} from '../auth'

// Mock window methods
const mockWindow = {
  location: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    search: '',
    pathname: '/'
  },
  history: {
    replaceState: vi.fn()
  },
  sessionStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}

Object.defineProperty(window, 'location', {
  value: mockWindow.location,
  writable: true
})
Object.defineProperty(window, 'history', {
  value: mockWindow.history,
  writable: true
})
Object.defineProperty(window, 'sessionStorage', {
  value: mockWindow.sessionStorage,
  writable: true
})

describe('OAuth Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window location
    mockWindow.location.href = 'http://localhost:3000'
    mockWindow.location.search = ''
    mockWindow.location.pathname = '/'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getOAuthUrl', () => {
    it('should generate correct OAuth URL with default redirect URI', () => {
      const mockRandomValue = '1234567890abcdef'
      vi.spyOn(Math, 'random').mockReturnValue(0.5) // Predictable random for testing

      const url = getOAuthUrl('http://homeassistant.local:8123')

      expect(url).toMatch(/^http:\/\/homeassistant\.local:8123\/auth\/authorize/)
      expect(url).toContain('response_type=code')
      expect(url).toContain('client_id=http%3A%2F%2Flocalhost%3A3000')
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000')
      expect(url).toContain('state=')
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('hass-oauth-state', expect.any(String))
    })

    it('should use custom redirect URI when provided', () => {
      const customRedirect = 'http://localhost:3000/auth/callback'
      
      const url = getOAuthUrl('http://homeassistant.local:8123', customRedirect)

      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback')
      expect(url).toContain('client_id=http%3A%2F%2Flocalhost%3A3000')
    })

    it('should remove trailing slash from hassUrl', () => {
      const url = getOAuthUrl('http://homeassistant.local:8123/')

      expect(url).toMatch(/^http:\/\/homeassistant\.local:8123\/auth\/authorize/)
    })

    it('should extract origin correctly for client_id', () => {
      const url = getOAuthUrl('http://homeassistant.local:8123', 'http://localhost:3000/some/path')

      expect(url).toContain('client_id=http%3A%2F%2Flocalhost%3A3000')
    })
  })

  describe('handleOAuthCallback', () => {
    beforeEach(() => {
      // Mirror getAuth's real behavior: it saves initial tokens through saveTokens
      const mockAuthResult = {
        data: {
          hassUrl: 'http://homeassistant.local:8123',
          clientId: 'http://localhost:3000',
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires: Date.now() + 3600000, // 1 hour from now
          expires_in: 3600
        }
      }
      mockGetAuth.mockImplementation(async (options: {
        saveTokens?: (data: typeof mockAuthResult.data) => void
      }) => {
        options.saveTokens?.(mockAuthResult.data)
        return mockAuthResult
      })
    })

    it('should handle successful OAuth callback', async () => {
      mockWindow.location.search = '?code=test-code&state=test-state'
      window.sessionStorage.getItem = vi.fn().mockReturnValue('test-state')

      const result = await handleOAuthCallback('http://homeassistant.local:8123')

      expect(window.sessionStorage.getItem).toHaveBeenCalledWith('hass-oauth-state')
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('hass-oauth-state')
      expect(mockSaveAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123', {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: expect.any(Number),
        client_id: 'http://localhost:3000'
      })
      expect(result).toBeDefined()
    })

    it('should persist tokens saved after an OAuth refresh', async () => {
      mockWindow.location.search = '?code=test-code&state=test-state'
      window.sessionStorage.getItem = vi.fn().mockReturnValue('test-state')

      await handleOAuthCallback('http://homeassistant.local:8123')

      const saveTokens = mockGetAuth.mock.calls[0][0].saveTokens
      mockSaveAuthData.mockClear()
      saveTokens({
        hassUrl: 'http://homeassistant.local:8123',
        clientId: 'http://localhost:3000',
        access_token: 'refreshed-access-token',
        refresh_token: 'test-refresh-token',
        expires: 5000000,
        expires_in: 3600
      })

      expect(mockSaveAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123', {
        access_token: 'refreshed-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: 5000000,
        client_id: 'http://localhost:3000'
      })
    })

    it('should handle access_denied error', async () => {
      mockWindow.location.search = '?error=access_denied&error_description=User%20denied%20access'

      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toThrow()
      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toMatchObject({
        type: 'oauth_cancelled',
        userMessage: 'Authentication was cancelled. Please try signing in again.'
      })
    })

    it('should handle missing authorization code', async () => {
      mockWindow.location.search = '?state=test-state'

      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toThrow()
      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toMatchObject({
        type: 'oauth_cancelled'
      })
    })

    it('should handle state parameter mismatch', async () => {
      mockWindow.location.search = '?code=test-code&state=wrong-state'
      mockWindow.location.href = 'http://localhost:3000/?code=test-code&state=wrong-state'
      window.sessionStorage.getItem = vi.fn().mockReturnValue('correct-state')

      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toThrow()
      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toMatchObject({
        type: 'auth_expired'
      })

      // Should clean up URL parameters
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        expect.any(String),
        'http://localhost:3000/'
      )
    })

    it('should handle stale OAuth parameters (sessionStorage cleared)', async () => {
      mockWindow.location.search = '?code=test-code&state=stale-state'
      mockWindow.location.href = 'http://localhost:3000/?code=test-code&state=stale-state'
      window.sessionStorage.getItem = vi.fn().mockReturnValue(null) // sessionStorage was cleared

      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toThrow()
      await expect(handleOAuthCallback('http://homeassistant.local:8123')).rejects.toMatchObject({
        type: 'auth_expired',
        message: 'Invalid OAuth state - redirecting to authentication'
      })

      // Should clean up stale OAuth parameters from URL
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        expect.any(String),
        'http://localhost:3000/'
      )
    })

    it('should clean up URL parameters after successful callback', async () => {
      mockWindow.location.search = '?code=test-code&state=test-state'
      mockWindow.location.href = 'http://localhost:3000/?code=test-code&state=test-state'
      window.sessionStorage.getItem = vi.fn().mockReturnValue('test-state')

      await handleOAuthCallback('http://homeassistant.local:8123')

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {}, 
        expect.any(String), 
        'http://localhost:3000/'
      )
    })
  })

  describe('isOAuthCallback', () => {
    it('should return true when code parameter is present', () => {
      mockWindow.location.search = '?code=test-code&state=test-state'
      
      expect(isOAuthCallback()).toBe(true)
    })

    it('should return true when error parameter is present', () => {
      mockWindow.location.search = '?error=access_denied'
      
      expect(isOAuthCallback()).toBe(true)
    })

    it('should return false when no OAuth parameters are present', () => {
      mockWindow.location.search = '?some=other&params=here'
      
      expect(isOAuthCallback()).toBe(false)
    })

    it('should return false when search is empty', () => {
      mockWindow.location.search = ''
      
      expect(isOAuthCallback()).toBe(false)
    })
  })

  describe('logout', () => {
    it('should remove stored auth data and OAuth session flags', async () => {
      await logout('http://homeassistant.local:8123')

      expect(mockRemoveAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123')
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('hass-oauth-state')
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('hass-oauth-redirecting')
    })

    it('should revoke reachable auth before clearing local data', async () => {
      const revoke = vi.fn().mockResolvedValue(undefined)
      // This test double only exercises logout's revoke boundary.
      const auth = { revoke } as unknown as Auth

      await logout('http://homeassistant.local:8123', auth)

      expect(revoke).toHaveBeenCalledOnce()
      expect(revoke.mock.invocationCallOrder[0])
        .toBeLessThan(mockRemoveAuthData.mock.invocationCallOrder[0])
    })

    it('should clear local data when revocation fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const revoke = vi.fn().mockRejectedValue(new Error('Revoke failed'))
      // This test double only exercises logout's revoke boundary.
      const auth = { revoke } as unknown as Auth

      await expect(logout('http://homeassistant.local:8123', auth)).resolves.toBeUndefined()

      expect(mockRemoveAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123')
    })

    it('should clean up OAuth callback parameters from URL', async () => {
      mockWindow.location.href = 'http://localhost:3000/?code=test-code&state=test-state'
      mockWindow.location.search = '?code=test-code&state=test-state'

      await logout('http://homeassistant.local:8123')

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        expect.any(String),
        'http://localhost:3000/'
      )
    })

    it('should not modify URL when no OAuth parameters are present', async () => {
      mockWindow.location.search = '?some=other&params=here'

      await logout('http://homeassistant.local:8123')

      expect(window.history.replaceState).not.toHaveBeenCalled()
    })
  })

  describe('Token Management', () => {
    describe('isTokenExpiring', () => {
      it('should return true when token is already expired', () => {
        const mockAuth = {
          expired: true,
          data: { expires: Date.now() - 1000 }
        } as any

        expect(isTokenExpiring(mockAuth)).toBe(true)
      })

      it('should return true when token expires within buffer time', () => {
        const mockAuth = {
          expired: false,
          data: { expires: Date.now() + 2 * 60 * 1000 } // 2 minutes from now
        } as any

        expect(isTokenExpiring(mockAuth, 5)).toBe(true) // 5 minute buffer
      })

      it('should return false when token is not expiring', () => {
        const mockAuth = {
          expired: false,
          data: { expires: Date.now() + 10 * 60 * 1000 } // 10 minutes from now
        } as any

        expect(isTokenExpiring(mockAuth, 5)).toBe(false) // 5 minute buffer
      })

      it('should handle errors gracefully', () => {
        const mockAuth = null as any

        expect(isTokenExpiring(mockAuth)).toBe(false)
      })
    })

    describe('refreshTokenIfNeeded', () => {
      it('should refresh token when expiring', async () => {
        const mockAuth = {
          expired: false,
          data: { expires: Date.now() + 2 * 60 * 1000 }, // 2 minutes from now
          refreshAccessToken: vi.fn().mockResolvedValue(undefined)
        } as any

        const result = await refreshTokenIfNeeded(mockAuth)

        expect(mockAuth.refreshAccessToken).toHaveBeenCalled()
        expect(result).toBe(mockAuth)
      })

      it('should share one refresh across concurrent callers', async () => {
        let resolveRefresh!: () => void
        const refreshResult = new Promise<void>(resolve => {
          resolveRefresh = resolve
        })
        const refreshAccessToken = vi.fn().mockReturnValue(refreshResult)
        // Only the token-expiry and refresh fields are relevant to this unit.
        const mockAuth = {
          expired: true,
          data: {
            hassUrl: 'http://homeassistant.local:8123',
            expires: Date.now() - 1000
          },
          refreshAccessToken
        } as unknown as Auth

        const firstRefresh = refreshTokenIfNeeded(mockAuth)
        const secondRefresh = refreshTokenIfNeeded(mockAuth)

        expect(firstRefresh).toBe(secondRefresh)
        expect(refreshAccessToken).toHaveBeenCalledOnce()

        resolveRefresh()
        await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual([mockAuth, mockAuth])
      })

      it('should not refresh token when not expiring', async () => {
        const mockAuth = {
          expired: false,
          data: { expires: Date.now() + 60 * 60 * 1000 }, // 60 minutes from now
          refreshAccessToken: vi.fn()
        } as any

        const result = await refreshTokenIfNeeded(mockAuth)

        expect(mockAuth.refreshAccessToken).not.toHaveBeenCalled()
        expect(result).toBe(mockAuth)
      })

      it('should throw auth error when refresh fails', async () => {
        const mockAuth = {
          expired: true,
          data: { expires: Date.now() - 1000 },
          refreshAccessToken: vi.fn().mockRejectedValue(new Error('Refresh failed'))
        } as any

        await expect(refreshTokenIfNeeded(mockAuth)).rejects.toMatchObject({
          type: 'auth_expired',
          userMessage: 'Your authentication has expired. Please sign in again.'
        })
      })

      it('should purge stored auth when refresh is rejected as invalid_grant', async () => {
        const refreshAccessToken = vi.fn().mockRejectedValue(2)
        // Only the token-expiry and refresh fields are relevant to this unit.
        const mockAuth = {
          expired: true,
          data: {
            hassUrl: 'http://homeassistant.local:8123',
            expires: Date.now() - 1000
          },
          refreshAccessToken
        } as unknown as Auth

        await expect(refreshTokenIfNeeded(mockAuth)).rejects.toMatchObject({
          code: 'invalid_grant',
          type: 'auth_expired'
        })
        expect(mockRemoveAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123')
      })

      it('should respect custom buffer time parameter', async () => {
        const mockAuth = {
          expired: false,
          data: { expires: Date.now() + 10 * 60 * 1000 }, // 10 minutes from now
          refreshAccessToken: vi.fn().mockResolvedValue(undefined)
        } as any

        // With 5 minute buffer, should not refresh (10 > 5)
        await refreshTokenIfNeeded(mockAuth, 5)
        expect(mockAuth.refreshAccessToken).not.toHaveBeenCalled()

        // Clear mock for next test
        mockAuth.refreshAccessToken.mockClear()

        // With 15 minute buffer, should refresh (10 < 15)
        await refreshTokenIfNeeded(mockAuth, 15)
        expect(mockAuth.refreshAccessToken).toHaveBeenCalled()
      })

      it('should use default buffer when not specified', async () => {
        const mockAuth = {
          expired: false,
          data: { expires: Date.now() + 3 * 60 * 1000 }, // 3 minutes from now
          refreshAccessToken: vi.fn().mockResolvedValue(undefined)
        } as any

        // Default buffer is 5 minutes, so should refresh (3 < 5)
        await refreshTokenIfNeeded(mockAuth)
        expect(mockAuth.refreshAccessToken).toHaveBeenCalled()
      })
    })
  })

  describe('createAuthenticatedConnection', () => {
    it('should use long-lived token when provided', async () => {
      const mockAuthResult = { data: { access_token: 'test-token' } }
      const mockConnectionResult = { close: vi.fn() }

      mockCreateLongLivedTokenAuth.mockReturnValue(mockAuthResult)
      mockCreateConnection.mockResolvedValue(mockConnectionResult)

      const result = await createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        token: 'test-token',
        authMode: 'auto'
      })

      expect(mockCreateLongLivedTokenAuth).toHaveBeenCalledWith(
        'http://homeassistant.local:8123',
        'test-token'
      )
      expect(mockCreateConnection).toHaveBeenCalledWith({ auth: mockAuthResult })
      expect(result).toEqual({ connection: mockConnectionResult, auth: mockAuthResult })
    })

    it('should use OAuth when no token provided', async () => {
      const storedAuth = {
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'stored-token',
        refresh_token: 'stored-refresh',
        expires_at: Date.now() + 3600000
      }

      mockLoadAuthData.mockReturnValue(storedAuth)

      const mockAuthResult = {
        data: storedAuth,
        expired: false,
        refreshAccessToken: vi.fn()
      }
      const mockConnectionResult = { close: vi.fn() }

      mockCreateConnection.mockResolvedValue(mockConnectionResult)

      // Mock the Auth constructor
      mockAuth.mockImplementation(() => mockAuthResult)

      const result = await createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        authMode: 'oauth'
      })

      expect(mockLoadAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123')
      expect(mockCreateConnection).toHaveBeenCalledWith({ auth: mockAuthResult })
      expect(result).toEqual({ connection: mockConnectionResult, auth: mockAuthResult })
    })

    it('should handle OAuth callback when URL has code parameter', async () => {
      mockWindow.location.search = '?code=test-code&state=test-state'
      window.sessionStorage.getItem = vi.fn().mockReturnValue('test-state')
      mockLoadAuthData.mockReturnValue(null)

      const mockAuthResult = {
        data: {
          hassUrl: 'http://homeassistant.local:8123',
          clientId: 'http://localhost:3000',
          access_token: 'callback-token',
          refresh_token: 'callback-refresh',
          expires: Date.now() + 3600000,
          expires_in: 3600
        }
      }
      const mockConnectionResult = { close: vi.fn() }

      mockGetAuth.mockImplementation(async options => {
        options.saveTokens(mockAuthResult.data)
        return mockAuthResult
      })
      mockCreateConnection.mockResolvedValue(mockConnectionResult)

      const result = await createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        authMode: 'auto'
      })

      expect(mockGetAuth).toHaveBeenCalled()
      expect(mockSaveAuthData).toHaveBeenCalledWith('http://homeassistant.local:8123', {
        access_token: 'callback-token',
        refresh_token: 'callback-refresh',
        expires_at: expect.any(Number),
        client_id: 'http://localhost:3000'
      })
      expect(result).toEqual({ connection: mockConnectionResult, auth: mockAuthResult })
    })

    it('should retain an expired access token when a refresh token is available', async () => {
      const storedAuth = {
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'expired-access-token',
        refresh_token: 'valid-refresh-token',
        expires_at: Date.now() - 1000,
        created_at: Date.now() - 3600000
      }
      const mockAuthResult = {
        data: storedAuth,
        expired: true,
        refreshAccessToken: vi.fn()
      }
      const mockConnectionResult = { close: vi.fn() }
      mockLoadAuthData.mockReturnValue(storedAuth)
      mockAuth.mockReturnValue(mockAuthResult)
      mockCreateConnection.mockResolvedValue(mockConnectionResult)

      await createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        authMode: 'oauth'
      })

      expect(mockAuth).toHaveBeenCalled()
      expect(mockRemoveAuthData).not.toHaveBeenCalled()
    })

    it('should floor stored token expiry after converting milliseconds to seconds', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1001)
      const storedAuth = {
        hassUrl: 'http://homeassistant.local:8123',
        access_token: 'stored-token',
        refresh_token: 'stored-refresh',
        expires_at: 2500,
        created_at: 1
      }
      const mockAuthResult = {
        data: storedAuth,
        expired: false,
        refreshAccessToken: vi.fn()
      }
      mockLoadAuthData.mockReturnValue(storedAuth)
      mockAuth.mockReturnValue(mockAuthResult)
      mockCreateConnection.mockResolvedValue({ close: vi.fn() })

      await createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        authMode: 'oauth'
      })

      expect(mockAuth).toHaveBeenCalledWith(
        expect.objectContaining({ expires_in: 1 }),
        expect.any(Function)
      )
    })

    it('should map ERR_INVALID_AUTH to invalid_credentials', async () => {
      mockCreateLongLivedTokenAuth.mockReturnValue({
        data: { access_token: 'test-token' }
      })
      mockCreateConnection.mockRejectedValue(2)

      await expect(createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        token: 'test-token',
        authMode: 'auto'
      })).rejects.toMatchObject({
        code: 'invalid_credentials',
        message: 'Home Assistant rejected the authentication credentials',
        type: 'invalid_credentials'
      })
    })

    it('should map ERR_CANNOT_CONNECT to network', async () => {
      mockCreateLongLivedTokenAuth.mockReturnValue({
        data: { access_token: 'test-token' }
      })
      mockCreateConnection.mockRejectedValue(1)

      await expect(createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        token: 'test-token',
        authMode: 'auto'
      })).rejects.toMatchObject({
        code: 'network',
        message: 'Unable to connect to Home Assistant',
        type: 'network'
      })
    })

    it('should preserve Error instances from createConnection', async () => {
      const connectionError = new Error('WebSocket handshake failed')
      mockCreateLongLivedTokenAuth.mockReturnValue({
        data: { access_token: 'test-token' }
      })
      mockCreateConnection.mockRejectedValue(connectionError)

      await expect(createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        token: 'test-token',
        authMode: 'auto'
      })).rejects.toBe(connectionError)
    })

    it('should mark an OAuth navigation error as redirecting', async () => {
      mockLoadAuthData.mockReturnValue(null)
      window.sessionStorage.getItem = vi.fn().mockReturnValue(null)

      await expect(createAuthenticatedConnection({
        hassUrl: 'http://homeassistant.local:8123',
        authMode: 'oauth'
      })).rejects.toMatchObject({
        type: 'auth_expired',
        message: 'Redirecting to authentication',
        redirecting: true
      })
    })
  })
})