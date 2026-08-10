import type { StoredAuthData } from '../types/auth'

const STORAGE_KEY = 'hass-react-auth'

// Store authentication data for a specific Home Assistant URL
export function saveAuthData(hassUrl: string, authData: Omit<StoredAuthData, 'hassUrl' | 'created_at'>): void {
  try {
    const stored = getStoredAuth()
    const dataToStore: StoredAuthData = {
      ...authData,
      hassUrl,
      created_at: Date.now()
    }
    
    stored[hassUrl] = dataToStore
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch (error) {
    console.warn('Failed to save auth data:', error)
  }
}

// Load authentication data for a specific Home Assistant URL
export function loadAuthData(hassUrl: string): StoredAuthData | null {
  try {
    const stored = getStoredAuth()
    const authData = stored[hassUrl]
    
    if (!authData) {
      return null
    }
    
    // An expired access token can still be renewed with its refresh token
    if (authData.expires_at && Date.now() > authData.expires_at && !authData.refresh_token) {
      removeAuthData(hassUrl)
      return null
    }
    
    return authData
  } catch (error) {
    console.warn('Failed to load auth data:', error)
    return null
  }
}

// Remove authentication data for a specific Home Assistant URL
export function removeAuthData(hassUrl: string): void {
  try {
    const stored = getStoredAuth()
    delete stored[hassUrl]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch (error) {
    console.warn('Failed to remove auth data:', error)
  }
}

// Clear all authentication data
export function clearAllAuthData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear auth data:', error)
  }
}

// Get all stored authentication data
function getStoredAuth(): Record<string, StoredAuthData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return {}
    }

    const parsed: unknown = JSON.parse(stored)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, StoredAuthData>
      : {}
  } catch (error) {
    console.warn('Failed to parse stored auth data:', error)
    return {}
  }
}

// Check if stored auth data exists for a URL
export function hasStoredAuth(hassUrl: string): boolean {
  return loadAuthData(hassUrl) !== null
}