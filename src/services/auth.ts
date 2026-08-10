import {
  getAuth,
  createConnection,
  createLongLivedTokenAuth,
  Auth,
  Connection,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  type AuthData,
  type SaveTokensFunc
} from 'home-assistant-js-websocket'
import type { AuthConfig, AuthError, StoredAuthData } from '../types/auth'
import { saveAuthData, loadAuthData, removeAuthData } from './tokenStorage'

// Constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_TOKEN_BUFFER_MINUTES = 5 // Buffer time before token expiration to trigger refresh
const OAUTH_REDIRECT_IN_PROGRESS_KEY = 'hass-oauth-redirecting'
const refreshPromises = new WeakMap<Auth, Promise<Auth>>()

// Generate OAuth authorization URL for Home Assistant
export function getOAuthUrl(hassUrl: string, redirectUri?: string): string {
  if (!hassUrl || typeof hassUrl !== 'string') {
    throw createAuthError('config_error', 'hassUrl is required and must be a string')
  }

  const cleanUrl = hassUrl.replace(/\/$/, '')
  // Convert WebSocket URL to HTTP URL for OAuth
  const httpUrl = cleanUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://')

  // Clean redirect URI - remove query params to avoid including old OAuth codes
  let redirect: string
  if (redirectUri) {
    // Remove query parameters from provided redirectUri for consistency
    const url = new URL(redirectUri)
    redirect = url.origin + url.pathname
  } else {
    // Use current URL without query parameters to prevent OAuth code reuse issues
    redirect = window.location.origin + window.location.pathname
  }

  const state = generateRandomState()

  // Store state for verification
  sessionStorage.setItem('hass-oauth-state', state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: new URL(redirect).origin, // Use origin only as client_id
    redirect_uri: redirect,
    state
  })

  return `${httpUrl}/auth/authorize?${params.toString()}`
}

// Handle OAuth callback with authorization code
export async function handleOAuthCallback(hassUrl: string): Promise<Auth> {
  if (!hassUrl || typeof hassUrl !== 'string') {
    throw createAuthError('config_error', 'hassUrl is required and must be a string')
  }
  
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const state = urlParams.get('state')
  const error = urlParams.get('error')
  
  if (error) {
    const errorType = error === 'access_denied' ? 'oauth_cancelled' : 'invalid_credentials'
    const errorCode = error
    throw createAuthError(errorType, urlParams.get('error_description') || error, errorCode)
  }
  
  if (!code) {
    throw createAuthError('oauth_cancelled', 'No authorization code received', 'no_code')
  }
  
  // Verify state parameter
  const storedState = sessionStorage.getItem('hass-oauth-state')
  if (state !== storedState) {
    // Clean up the invalid OAuth parameters from URL regardless of the reason
    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    window.history.replaceState({}, document.title, url.toString())

    // Log appropriate message based on whether this is stale or a genuine mismatch
    if (storedState === null) {
      console.warn('Detected stale OAuth callback parameters (sessionStorage cleared) - cleaning up and will redirect to fresh OAuth flow')
    } else {
      console.warn('OAuth state parameter mismatch - possible security issue. Cleaning up and will redirect to fresh OAuth flow.', { received: state, stored: storedState })
    }

    // Throw auth_expired to trigger a fresh OAuth flow instead of infinite retries
    throw createAuthError('auth_expired', 'Invalid OAuth state - redirecting to authentication')
  }
  
  // Clean up state and redirect flag
  sessionStorage.removeItem('hass-oauth-state')
  sessionStorage.removeItem(OAUTH_REDIRECT_IN_PROGRESS_KEY)

  // Exchange code for tokens
  const saveTokens = createSaveTokens(hassUrl)

  const auth = await getAuth({
    hassUrl,
    authCode: code,
    clientId: window.location.origin, // Use origin as client_id to match OAuth request
    redirectUrl: window.location.href.split('?')[0], // Use current URL without query params
    saveTokens
  })
  
  // Clean up OAuth parameters from URL
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, document.title, url.toString())
  
  return auth
}

// Create connection using stored or provided authentication
export async function createAuthenticatedConnection(config: AuthConfig): Promise<{ connection: Connection; auth: Auth }> {
  const { hassUrl, token, authMode } = config
  
  // Determine auth method
  const shouldUseOAuth = authMode === 'oauth' || (authMode === 'auto' && !token)

  let auth: Auth | undefined
  
  if (shouldUseOAuth) {
    // Try to load stored OAuth tokens
    const storedAuth = loadAuthData(hassUrl)

    if (storedAuth) {
      // Check if stored token is already expired
      if (storedAuth.expires_at && storedAuth.expires_at < Date.now() && !storedAuth.refresh_token) {
        // An expired access token without a refresh token cannot be renewed
        removeAuthData(hassUrl)
      } else {
        // Keep refreshable records so Auth can silently renew the access token
        auth = createAuthFromStoredData(storedAuth)
      }
    }

    if (!auth) {
      // Check if this is an OAuth callback
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('code')) {
        auth = await handleOAuthCallback(hassUrl)
      } else {
        // Check if we're already redirecting to prevent multiple OAuth flows
        const redirectTimestamp = sessionStorage.getItem(OAUTH_REDIRECT_IN_PROGRESS_KEY)
        if (redirectTimestamp) {
          const parsedTimestamp = parseInt(redirectTimestamp, 10)
          if (isNaN(parsedTimestamp)) {
            // Clear corrupted data and allow redirect to proceed
            sessionStorage.removeItem(OAUTH_REDIRECT_IN_PROGRESS_KEY)
          } else {
            const timeSinceRedirect = Date.now() - parsedTimestamp
            // If redirect was initiated less than 1 second ago, block duplicate redirects
            if (timeSinceRedirect < 1000) {
              throw createAuthError('auth_expired', 'OAuth redirect already in progress')
            }
            // Clear stale flag since more than 1 second has passed
            sessionStorage.removeItem(OAUTH_REDIRECT_IN_PROGRESS_KEY)
          }
        }

        // Mark that we're redirecting
        sessionStorage.setItem(OAUTH_REDIRECT_IN_PROGRESS_KEY, Date.now().toString())

        // Redirect to OAuth
        window.location.href = getOAuthUrl(hassUrl, config.redirectUri)
        throw Object.assign(
          createAuthError('auth_expired', 'Redirecting to authentication'),
          { redirecting: true as const }
        )
      }
    }
  } else {
    // Use long-lived token
    if (!token) {
      throw createAuthError('invalid_credentials', 'No token provided for token-based authentication')
    }
    auth = createLongLivedTokenAuth(hassUrl, token)
  }
  
  // Normalize the websocket library's numeric connection errors at this boundary
  try {
    const connection = await createConnection({ auth })
    return { connection, auth }
  } catch (error) {
    if (error === ERR_INVALID_AUTH) {
      // An expired Auth with a refresh token reaches this path when refresh is rejected
      if (auth.expired && auth.data.refresh_token) {
        removeAuthData(hassUrl)
      }
      throw createAuthError('invalid_credentials', 'Home Assistant rejected the authentication credentials')
    }
    if (error === ERR_CANNOT_CONNECT) {
      throw createAuthError('network', 'Unable to connect to Home Assistant')
    }
    if (error instanceof Error) {
      throw error
    }
    throw createAuthError('unknown', 'Unable to create a Home Assistant connection')
  }
}

// Logout and clear stored authentication
export async function logout(hassUrl: string, auth?: Auth): Promise<void> {
  if (!hassUrl || typeof hassUrl !== 'string') {
    throw createAuthError('config_error', 'hassUrl is required and must be a string')
  }

  if (auth) {
    try {
      await auth.revoke()
    } catch (error) {
      console.warn('Failed to revoke authentication:', error)
    }
  }

  removeAuthData(hassUrl)
  sessionStorage.removeItem('hass-oauth-state')
  sessionStorage.removeItem(OAUTH_REDIRECT_IN_PROGRESS_KEY)

  // Clear URL parameters if they exist
  if (window.location.search.includes('code=')) {
    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    window.history.replaceState({}, document.title, url.toString())
  }
}

// Check if current URL contains OAuth callback parameters
export function isOAuthCallback(): boolean {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.has('code') || urlParams.has('error')
}

// Generate cryptographically secure random state for OAuth flow
function generateRandomState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Create a persistence callback shared by new and restored OAuth sessions
function createSaveTokens(hassUrl: string): SaveTokensFunc {
  return (data: AuthData | null) => {
    if (!data) {
      removeAuthData(hassUrl)
      return
    }

    saveAuthData(hassUrl, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires,
      client_id: data.clientId
    })
  }
}

// Create Auth from stored token data with refresh capability
function createAuthFromStoredData(storedAuth: StoredAuthData): Auth {
  if (storedAuth.refresh_token) {
    // Create OAuth auth with refresh capability
    const authData: AuthData = {
      hassUrl: storedAuth.hassUrl,
      clientId: storedAuth.client_id || null,
      expires: storedAuth.expires_at || Date.now() + ONE_DAY_MS,
      refresh_token: storedAuth.refresh_token,
      access_token: storedAuth.access_token,
      expires_in: Math.floor(((storedAuth.expires_at || Date.now() + ONE_DAY_MS) - Date.now()) / 1000)
    }
    
    return new Auth(authData, createSaveTokens(storedAuth.hassUrl))
  } else {
    // Fallback to long-lived token (no refresh capability)
    return createLongLivedTokenAuth(storedAuth.hassUrl, storedAuth.access_token)
  }
}

// Check if auth token is expired or will expire soon
export function isTokenExpiring(auth: Auth, bufferMinutes: number = DEFAULT_TOKEN_BUFFER_MINUTES): boolean {
  try {
    if (auth.expired) {
      return true
    }

    // Check if expires within buffer time
    const bufferMs = bufferMinutes * 60 * 1000
    const isExpiring = auth.data.expires <= Date.now() + bufferMs

    return isExpiring
  } catch {
    return false
  }
}

// Refresh auth token if needed
export function refreshTokenIfNeeded(auth: Auth, bufferMinutes: number = DEFAULT_TOKEN_BUFFER_MINUTES): Promise<Auth> {
  const inFlight = refreshPromises.get(auth)
  if (inFlight) {
    return inFlight
  }

  if (!isTokenExpiring(auth, bufferMinutes)) {
    return Promise.resolve(auth)
  }

  const refreshPromise = (async () => {
    try {
      await auth.refreshAccessToken()
      return auth
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error)
      const invalidGrant = isInvalidGrantError(error)
      if (invalidGrant) {
        removeAuthData(auth.data.hassUrl)
      }
      throw createAuthError(
        'auth_expired',
        'Token refresh failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        invalidGrant ? 'invalid_grant' : undefined
      )
    } finally {
      refreshPromises.delete(auth)
    }
  })()

  refreshPromises.set(auth, refreshPromise)
  return refreshPromise
}

function isInvalidGrantError(error: unknown): boolean {
  if (error === ERR_INVALID_AUTH || error === 'invalid_grant') {
    return true
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('invalid_grant')
  }

  if (typeof error !== 'object' || error === null) {
    return false
  }

  const errorRecord = error as { code?: unknown; error?: unknown }
  return errorRecord.code === 'invalid_grant' || errorRecord.error === 'invalid_grant'
}

// Create standardized auth errors with user-friendly messages
function createAuthError(type: AuthError['type'], message: string, code?: string): AuthError {
  const errorMap: Record<AuthError['type'], {
    userMessage: string
    recoverable: boolean
    retryAction?: AuthError['retryAction']
  }> = {
    network: {
      userMessage: 'Unable to connect to Home Assistant. Please check your network connection and try again.',
      recoverable: true,
      retryAction: 'retry_auth'
    },
    auth_expired: {
      userMessage: 'Your authentication has expired. Please sign in again.',
      recoverable: true,
      retryAction: 'retry_auth'
    },
    invalid_credentials: {
      userMessage: 'Authentication failed. Please check your credentials and try again.',
      recoverable: true,
      retryAction: 'retry_auth'
    },
    oauth_cancelled: {
      userMessage: 'Authentication was cancelled. Please try signing in again.',
      recoverable: true,
      retryAction: 'retry_auth'
    },
    config_error: {
      userMessage: 'There is a configuration problem with Home Assistant. Please contact your administrator.',
      recoverable: false,
      retryAction: 'contact_admin'
    },
    unknown: {
      userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      recoverable: true,
      retryAction: 'retry_auth'
    }
  }

  const errorInfo = errorMap[type]
  
  return {
    code: code || type,
    message,
    userMessage: errorInfo.userMessage,
    type,
    recoverable: errorInfo.recoverable,
    retryAction: errorInfo.retryAction
  }
}