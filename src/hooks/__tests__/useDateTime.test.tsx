import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDateTime } from '../useDateTime'
import { useEntity } from '../useEntity'
import { useHAConnection } from '../../providers/HAProvider'

// Mock dependencies
vi.mock('../useEntity')
vi.mock('../../providers/HAProvider')

// Mock datetime entity response
const createMockDateTimeEntity = (
  state: string = '2024-01-15T14:30:00+00:00',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'sensor.date_time_iso',
  state,
  attributes,
  lastChanged: new Date(),
  lastUpdated: new Date(),
  isUnavailable: state === 'unavailable',
  isConnected: true,
  callService: vi.fn(),
  callServiceWithResponse: vi.fn(),
  refresh: vi.fn()
})

describe('useDateTime', () => {
  const mockUseEntity = useEntity as any
  const mockUseHAConnection = useHAConnection as any

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockDateTimeEntity())

    // Default mock for useHAConnection - connected by default
    mockUseHAConnection.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      reconnect: vi.fn(),
      logout: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Date Parsing', () => {
    it('should parse ISO 8601 date string into Date object', () => {
      const isoDate = '2024-01-15T14:30:00+00:00'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(isoDate))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.date?.toISOString()).toBe('2024-01-15T14:30:00.000Z')
      expect(result.current.isAvailable).toBe(true)
    })

    it('should handle different ISO 8601 formats', () => {
      const testCases = [
        '2024-01-15T14:30:00Z',
        '2024-01-15T14:30:00.000Z',
        '2024-01-15T14:30:00+05:30',
        '2024-12-31T23:59:59-08:00'
      ]

      testCases.forEach(isoDate => {
        mockUseEntity.mockReturnValue(createMockDateTimeEntity(isoDate))

        const { result } = renderHook(() => useDateTime())

        expect(result.current.date).toBeInstanceOf(Date)
        expect(result.current.date?.toISOString()).toBeDefined()
        expect(result.current.isAvailable).toBe(true)
      })
    })

    it('should return null for invalid date strings', () => {
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('invalid-date'))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date).toBeNull()
      expect(result.current.isAvailable).toBe(false)
    })

    it('should handle dates with milliseconds', () => {
      const isoDate = '2024-01-15T14:30:00.123Z'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(isoDate))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.date?.getMilliseconds()).toBe(123)
    })
  })

  describe('Unavailable State Handling', () => {
    it('should return null and isAvailable false when sensor is unavailable', () => {
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date).toBeNull()
      expect(result.current.isAvailable).toBe(false)
    })

    it('should return null and isAvailable false when sensor is unknown', () => {
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unknown'))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date).toBeNull()
      expect(result.current.isAvailable).toBe(false)
    })

    it('should log warning when sensor is unavailable after delay', () => {
      vi.useFakeTimers()
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))

      renderHook(() => useDateTime())

      // Warning should not appear immediately
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('sensor.date_time_iso) is unavailable')
      )

      consoleWarnSpy.mockRestore()
      vi.useRealTimers()
    })

    it('should only log warning once even with multiple rerenders', () => {
      vi.useFakeTimers()
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))

      const { rerender } = renderHook(() => useDateTime())

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000)

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)

      rerender()
      rerender()

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)

      consoleWarnSpy.mockRestore()
      vi.useRealTimers()
    })

    it('should not log warning if sensor becomes available before delay expires', () => {
      vi.useFakeTimers()
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Start with unavailable
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))

      const { rerender } = renderHook(() => useDateTime())

      // Advance time by 1 second
      vi.advanceTimersByTime(1000)

      // Become available before the 3 second delay expires
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('2024-01-15T14:30:00Z'))
      rerender()

      // Advance remaining time
      vi.advanceTimersByTime(3000)

      // Warning should not have been logged
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
      vi.useRealTimers()
    })

    it('should not log warning before connection is established', () => {
      vi.useFakeTimers()
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock not connected
      mockUseHAConnection.mockReturnValue({
        connected: false,
        connecting: true,
        error: null,
        reconnect: vi.fn(),
        logout: vi.fn(),
      })

      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))

      renderHook(() => useDateTime())

      // Advance time
      vi.advanceTimersByTime(5000)

      // Warning should not appear when not connected
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
      vi.useRealTimers()
    })
  })

  describe('Integration with useEntity', () => {
    it('should use sensor.date_time_iso entity', () => {
      renderHook(() => useDateTime())

      expect(mockUseEntity).toHaveBeenCalledWith('sensor.date_time_iso')
    })

    it('should inherit all base entity properties', () => {
      const mockEntity = createMockDateTimeEntity('2024-01-15T14:30:00Z', {
        friendly_name: 'Date & Time',
        icon: 'mdi:clock'
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useDateTime())

      // Should inherit all base properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.attributes).toBe(mockEntity.attributes)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)

      // Plus datetime-specific properties
      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.isAvailable).toBe(true)
    })

    it('should update when entity state changes', () => {
      // Start with one time
      const firstTime = '2024-01-15T14:30:00Z'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(firstTime))

      const { result, rerender } = renderHook(() => useDateTime())

      expect(result.current.date?.toISOString()).toBe('2024-01-15T14:30:00.000Z')

      // Update to later time
      const secondTime = '2024-01-15T14:35:00Z'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(secondTime))
      rerender()

      expect(result.current.date?.toISOString()).toBe('2024-01-15T14:35:00.000Z')
    })

    it('should handle transition from available to unavailable', () => {
      // Start with valid time
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('2024-01-15T14:30:00Z'))

      const { result, rerender } = renderHook(() => useDateTime())

      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.isAvailable).toBe(true)

      // Become unavailable
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))
      rerender()

      expect(result.current.date).toBeNull()
      expect(result.current.isAvailable).toBe(false)
    })

    it('should handle transition from unavailable to available', () => {
      // Start unavailable
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('unavailable'))

      const { result, rerender } = renderHook(() => useDateTime())

      expect(result.current.date).toBeNull()
      expect(result.current.isAvailable).toBe(false)

      // Become available
      mockUseEntity.mockReturnValue(createMockDateTimeEntity('2024-01-15T14:30:00Z'))
      rerender()

      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.isAvailable).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle midnight correctly', () => {
      const midnight = '2024-01-15T00:00:00Z'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(midnight))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date?.getUTCHours()).toBe(0)
      expect(result.current.date?.getUTCMinutes()).toBe(0)
      expect(result.current.date?.getUTCSeconds()).toBe(0)
    })

    it('should handle end of day correctly', () => {
      const endOfDay = '2024-01-15T23:59:59Z'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(endOfDay))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date?.getUTCHours()).toBe(23)
      expect(result.current.date?.getUTCMinutes()).toBe(59)
      expect(result.current.date?.getUTCSeconds()).toBe(59)
    })

    it('should handle leap year dates', () => {
      const leapDay = '2024-02-29T12:00:00Z'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(leapDay))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date?.getUTCMonth()).toBe(1) // February (0-indexed)
      expect(result.current.date?.getUTCDate()).toBe(29)
    })

    it('should handle timezone offsets correctly', () => {
      const withOffset = '2024-01-15T14:30:00+05:30'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(withOffset))

      const { result } = renderHook(() => useDateTime())

      // JavaScript Date should convert to UTC internally
      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.date?.toISOString()).toBe('2024-01-15T09:00:00.000Z')
    })

    it('should handle negative timezone offsets', () => {
      const withNegativeOffset = '2024-01-15T14:30:00-08:00'
      mockUseEntity.mockReturnValue(createMockDateTimeEntity(withNegativeOffset))

      const { result } = renderHook(() => useDateTime())

      expect(result.current.date).toBeInstanceOf(Date)
      expect(result.current.date?.toISOString()).toBe('2024-01-15T22:30:00.000Z')
    })
  })
})
