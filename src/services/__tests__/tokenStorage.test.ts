import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { StoredAuthData } from '../../types/auth'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get store() { return store },
    set store(newStore: Record<string, string>) { store = newStore }
  }
})()

// Mock console methods before importing the module
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

import {
  saveAuthData,
  loadAuthData,
  removeAuthData,
  clearAllAuthData,
  hasStoredAuth
} from '../tokenStorage'

describe('Token Storage Service', () => {
  const testUrl = 'http://homeassistant.local:8123'
  const testUrl2 = 'http://second.local:8123'
  const mockAuthData = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600000 // 1 hour from now
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.store = {}
    mockConsoleWarn.mockClear()
    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockReturnValue(1000000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('saveAuthData', () => {
    it('should save auth data to localStorage', () => {
      saveAuthData(testUrl, mockAuthData)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'hass-react-auth',
        JSON.stringify({
          [testUrl]: {
            ...mockAuthData,
            hassUrl: testUrl,
            created_at: 1000000
          }
        })
      )
    })

    it('should merge with existing data when saving multiple URLs', () => {
      // Save first URL
      saveAuthData(testUrl, mockAuthData)
      
      // Save second URL
      const secondAuthData = {
        access_token: 'second-access-token',
        refresh_token: 'second-refresh-token',
        expires_at: Date.now() + 7200000 // 2 hours from now
      }
      saveAuthData(testUrl2, secondAuthData)

      const stored = JSON.parse(mockLocalStorage.store['hass-react-auth'])
      expect(stored).toHaveProperty(testUrl)
      expect(stored).toHaveProperty(testUrl2)
      expect(stored[testUrl].access_token).toBe('test-access-token')
      expect(stored[testUrl2].access_token).toBe('second-access-token')
    })

    it('should update existing data when saving to same URL', () => {
      // Save initial data
      saveAuthData(testUrl, mockAuthData)
      
      // Update with new data
      const updatedData = {
        access_token: 'updated-access-token',
        refresh_token: 'updated-refresh-token',
        expires_at: Date.now() + 1800000 // 30 minutes from now
      }
      saveAuthData(testUrl, updatedData)

      const stored = JSON.parse(mockLocalStorage.store['hass-react-auth'])
      expect(stored[testUrl].access_token).toBe('updated-access-token')
      expect(stored[testUrl].refresh_token).toBe('updated-refresh-token')
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      expect(() => saveAuthData(testUrl, mockAuthData)).not.toThrow()
    })

    it('should handle invalid JSON in existing storage', () => {
      mockLocalStorage.store['hass-react-auth'] = 'invalid-json'

      saveAuthData(testUrl, mockAuthData)

      // Should save new data despite invalid existing data
      const stored = JSON.parse(mockLocalStorage.store['hass-react-auth'])
      expect(stored[testUrl]).toBeDefined()
    })
  })

  describe('loadAuthData', () => {
    beforeEach(() => {
      // Pre-populate storage with test data
      const testData = {
        [testUrl]: {
          ...mockAuthData,
          hassUrl: testUrl,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(testData)
    })

    it('should load auth data for existing URL', () => {
      const result = loadAuthData(testUrl)

      expect(result).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: mockAuthData.expires_at,
        hassUrl: testUrl,
        created_at: 1000000
      })
    })

    it('should return null for non-existing URL', () => {
      const result = loadAuthData('http://nonexistent.local:8123')

      expect(result).toBeNull()
    })

    it('should remove an expired token that cannot be refreshed', () => {
      const expiredData = {
        [testUrl]: {
          access_token: 'expired-access-token',
          expires_at: Date.now() - 1000, // Expired 1 second ago
          hassUrl: testUrl,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(expiredData)

      const result = loadAuthData(testUrl)

      expect(result).toBeNull()
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'hass-react-auth',
        JSON.stringify({}) // Data should be removed
      )
    })

    it('should retain an expired access token when it has a refresh token', () => {
      const expiredData = {
        [testUrl]: {
          ...mockAuthData,
          expires_at: Date.now() - 1000,
          hassUrl: testUrl,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(expiredData)

      const result = loadAuthData(testUrl)

      expect(result).toEqual(expiredData[testUrl])
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
    })

    it('should handle tokens without expiration date', () => {
      const noExpiryData = {
        [testUrl]: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          hassUrl: testUrl,
          created_at: 1000000
          // No expires_at
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(noExpiryData)

      const result = loadAuthData(testUrl)

      expect(result).toEqual(noExpiryData[testUrl])
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied')
      })

      const result = loadAuthData(testUrl)
      expect(result).toBeNull()
    })

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.store['hass-react-auth'] = 'invalid-json'

      const result = loadAuthData(testUrl)
      expect(result).toBeNull()
    })

    it('should handle missing localStorage gracefully', () => {
      mockLocalStorage.store = {}

      const result = loadAuthData(testUrl)

      expect(result).toBeNull()
    })
  })

  describe('removeAuthData', () => {
    beforeEach(() => {
      // Pre-populate storage with multiple URLs
      const testData = {
        [testUrl]: {
          ...mockAuthData,
          hassUrl: testUrl,
          created_at: 1000000
        },
        [testUrl2]: {
          ...mockAuthData,
          hassUrl: testUrl2,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(testData)
    })

    it('should remove auth data for specific URL', () => {
      removeAuthData(testUrl)

      const stored = JSON.parse(mockLocalStorage.store['hass-react-auth'])
      expect(stored).not.toHaveProperty(testUrl)
      expect(stored).toHaveProperty(testUrl2) // Other URLs should remain
    })

    it('should handle removing non-existing URL gracefully', () => {
      removeAuthData('http://nonexistent.local:8123')

      const stored = JSON.parse(mockLocalStorage.store['hass-react-auth'])
      expect(stored).toHaveProperty(testUrl)
      expect(stored).toHaveProperty(testUrl2)
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage write failed')
      })

      expect(() => removeAuthData(testUrl)).not.toThrow()
    })

    it('should handle missing storage gracefully', () => {
      mockLocalStorage.store = {}

      expect(() => removeAuthData(testUrl)).not.toThrow()
    })
  })

  describe('clearAllAuthData', () => {
    beforeEach(() => {
      // Pre-populate storage
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify({
        [testUrl]: { ...mockAuthData, hassUrl: testUrl, created_at: 1000000 },
        [testUrl2]: { ...mockAuthData, hassUrl: testUrl2, created_at: 1000000 }
      })
    })

    it('should remove all auth data', () => {
      clearAllAuthData()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('hass-react-auth')
      expect(mockLocalStorage.store).not.toHaveProperty('hass-react-auth')
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage removal failed')
      })

      expect(() => clearAllAuthData()).not.toThrow()
    })
  })

  describe('hasStoredAuth', () => {
    it('should return true when valid auth data exists', () => {
      const testData = {
        [testUrl]: {
          ...mockAuthData,
          hassUrl: testUrl,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(testData)

      expect(hasStoredAuth(testUrl)).toBe(true)
    })

    it('should return false when no auth data exists', () => {
      expect(hasStoredAuth(testUrl)).toBe(false)
    })

    it('should return false when unrefreshable auth data is expired', () => {
      const expiredData = {
        [testUrl]: {
          access_token: 'expired-access-token',
          expires_at: Date.now() - 1000,
          hassUrl: testUrl,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(expiredData)

      expect(hasStoredAuth(testUrl)).toBe(false)
    })

    it('should return true when expired auth data can be refreshed', () => {
      const expiredData = {
        [testUrl]: {
          ...mockAuthData,
          expires_at: Date.now() - 1000,
          hassUrl: testUrl,
          created_at: 1000000
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(expiredData)

      expect(hasStoredAuth(testUrl)).toBe(true)
    })

    it('should return true when auth data has no expiration', () => {
      const noExpiryData = {
        [testUrl]: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          hassUrl: testUrl,
          created_at: 1000000
          // No expires_at
        }
      }
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(noExpiryData)

      expect(hasStoredAuth(testUrl)).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete auth lifecycle', () => {
      // Save auth data
      saveAuthData(testUrl, mockAuthData)
      expect(hasStoredAuth(testUrl)).toBe(true)

      // Load auth data
      const loaded = loadAuthData(testUrl)
      expect(loaded).toBeDefined()
      expect(loaded?.access_token).toBe('test-access-token')

      // Remove auth data
      removeAuthData(testUrl)
      expect(hasStoredAuth(testUrl)).toBe(false)
      expect(loadAuthData(testUrl)).toBeNull()
    })

    it('should handle multiple URLs independently', () => {
      // Save data for multiple URLs
      saveAuthData(testUrl, mockAuthData)
      saveAuthData(testUrl2, { ...mockAuthData, access_token: 'second-token' })

      expect(hasStoredAuth(testUrl)).toBe(true)
      expect(hasStoredAuth(testUrl2)).toBe(true)

      // Remove one URL
      removeAuthData(testUrl)

      expect(hasStoredAuth(testUrl)).toBe(false)
      expect(hasStoredAuth(testUrl2)).toBe(true)

      // Clear all
      clearAllAuthData()

      expect(hasStoredAuth(testUrl)).toBe(false)
      expect(hasStoredAuth(testUrl2)).toBe(false)
    })

    it('should handle storage corruption gracefully', () => {
      // Corrupt the storage
      mockLocalStorage.store['hass-react-auth'] = 'corrupted-data'

      // All operations should still work without throwing
      expect(() => {
        expect(hasStoredAuth(testUrl)).toBe(false)
        expect(loadAuthData(testUrl)).toBeNull()
        saveAuthData(testUrl, mockAuthData)
        expect(hasStoredAuth(testUrl)).toBe(true)
      }).not.toThrow()
    })

    it.each([
      null,
      5,
      'invalid-root',
      []
    ])('should recover when stored JSON is not a plain object: %j', invalidStoredValue => {
      mockLocalStorage.store['hass-react-auth'] = JSON.stringify(invalidStoredValue)

      saveAuthData(testUrl, mockAuthData)

      expect(JSON.parse(mockLocalStorage.store['hass-react-auth'])).toEqual({
        [testUrl]: {
          ...mockAuthData,
          hassUrl: testUrl,
          created_at: 1000000
        }
      })
    })
  })
})