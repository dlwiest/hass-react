import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateAndNormalizeDomain,
  createDomainValidator,
  extractDomain,
  extractEntityName
} from '../entityId'

describe('entityId utilities', () => {
  let consoleMock: any

  beforeEach(() => {
    consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleMock.mockRestore()
  })

  describe('validateAndNormalizeDomain', () => {
    it('should add domain prefix when missing', () => {
      const result = validateAndNormalizeDomain('living_room', 'light')
      expect(result).toBe('light.living_room')
    })

    it('should return unchanged when domain already present and correct', () => {
      const result = validateAndNormalizeDomain('light.living_room', 'light')
      expect(result).toBe('light.living_room')
    })

    it('should return unchanged when domain is wrong but warnings disabled', () => {
      const result = validateAndNormalizeDomain('fan.ceiling_fan', 'light', {
        warnOnWrongDomain: false
      })
      expect(result).toBe('fan.ceiling_fan')
      expect(consoleMock).not.toHaveBeenCalled()
    })

    it('should warn when domain is wrong and warnings enabled', () => {
      const result = validateAndNormalizeDomain('fan.ceiling_fan', 'light', {
        warnOnWrongDomain: true
      })
      
      expect(result).toBe('fan.ceiling_fan')
      expect(consoleMock).toHaveBeenCalledWith(
        'Entity "fan.ceiling_fan" has domain "fan" but expects "light" domain. ' +
        'This may not work as expected. Use useEntity() or the appropriate domain-specific hook instead.'
      )
    })

    it('should include hook name in warning when provided', () => {
      validateAndNormalizeDomain('switch.outlet', 'light', {
        warnOnWrongDomain: true,
        hookName: 'useLight'
      })

      expect(consoleMock).toHaveBeenCalledWith(
        'useLight: Entity "switch.outlet" has domain "switch" but expects "light" domain. ' +
        'This may not work as expected. Use useEntity() or the appropriate domain-specific hook instead.'
      )
    })

    it('should warn only once for repeated wrong-domain entity IDs', () => {
      const options = { warnOnWrongDomain: true, hookName: 'useLight' }

      validateAndNormalizeDomain('cover.repeated_warning', 'light', options)
      validateAndNormalizeDomain('cover.repeated_warning', 'light', options)

      expect(consoleMock).toHaveBeenCalledOnce()
    })

    it('should handle entities with multiple dots', () => {
      const result = validateAndNormalizeDomain('light.living_room.main', 'light')
      expect(result).toBe('light.living_room.main')
    })

    it('should handle empty entity name', () => {
      const result = validateAndNormalizeDomain('', 'light')
      expect(result).toBe('light.')
    })
  })

  describe('createDomainValidator', () => {
    it('should create a validator function for a specific domain', () => {
      const validateLight = createDomainValidator('light', 'useLight')
      
      const result = validateLight('living_room')
      expect(result).toBe('light.living_room')
    })

    it('should create validator that warns on wrong domain', () => {
      const validateLight = createDomainValidator('light', 'useLight')

      const result = validateLight('cover.garage')
      expect(result).toBe('cover.garage')
      expect(consoleMock).toHaveBeenCalledWith(
        'useLight: Entity "cover.garage" has domain "cover" but expects "light" domain. ' +
        'This may not work as expected. Use useEntity() or the appropriate domain-specific hook instead.'
      )
    })
  })

  describe('extractDomain', () => {
    it('should extract domain from full entity ID', () => {
      expect(extractDomain('light.living_room')).toBe('light')
      expect(extractDomain('fan.ceiling_fan')).toBe('fan')
      expect(extractDomain('switch.outlet')).toBe('switch')
    })

    it('should return null for entity ID without domain', () => {
      expect(extractDomain('living_room')).toBeNull()
    })

    it('should handle empty string', () => {
      expect(extractDomain('')).toBeNull()
    })

    it('should handle entity with multiple dots', () => {
      expect(extractDomain('light.living_room.main')).toBe('light')
    })
  })

  describe('extractEntityName', () => {
    it('should extract entity name from full entity ID', () => {
      expect(extractEntityName('light.living_room')).toBe('living_room')
      expect(extractEntityName('fan.ceiling_fan')).toBe('ceiling_fan')
      expect(extractEntityName('switch.outlet')).toBe('outlet')
    })

    it('should return original string for entity ID without domain', () => {
      expect(extractEntityName('living_room')).toBe('living_room')
    })

    it('should handle empty string', () => {
      expect(extractEntityName('')).toBe('')
    })

    it('should handle entity with multiple dots', () => {
      expect(extractEntityName('light.living_room.main')).toBe('living_room.main')
    })

    it('should handle entity ID with empty name', () => {
      expect(extractEntityName('light.')).toBe('')
    })
  })
})