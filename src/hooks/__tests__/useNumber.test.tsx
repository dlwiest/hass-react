import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNumber } from '../useNumber'
import { useEntity } from '../useEntity'

// Mock useEntity since useNumber depends on it
vi.mock('../useEntity')

// Mock number entity response
const createMockNumberEntity = (
  state: string = '50',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'number.test',
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

describe('useNumber', () => {
  const mockUseEntity = useEntity as any

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockNumberEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Value and Attributes', () => {
    it('should parse numeric value from state', () => {
      mockUseEntity.mockReturnValue(createMockNumberEntity('42.5'))

      const { result } = renderHook(() => useNumber('number.test'))

      expect(result.current.value).toBe(42.5)
    })

    it.each(['unknown', 'unavailable', 'not-a-number'])(
      'should return null for non-numeric state %s',
      (state) => {
        mockUseEntity.mockReturnValue(createMockNumberEntity(state))

        const { result } = renderHook(() => useNumber('number.test'))

        expect(result.current.value).toBeNull()
      }
    )

    it('should handle min/max/step attributes', () => {
      const attributes = {
        min: 0,
        max: 100,
        step: 5
      }
      mockUseEntity.mockReturnValue(createMockNumberEntity('50', attributes))

      const { result } = renderHook(() => useNumber('number.test'))

      expect(result.current.min).toBe(0)
      expect(result.current.max).toBe(100)
      expect(result.current.step).toBe(5)
    })

    it('should use defaults when attributes are missing', () => {
      mockUseEntity.mockReturnValue(createMockNumberEntity('50', {}))

      const { result } = renderHook(() => useNumber('number.test'))

      expect(result.current.min).toBe(0)
      expect(result.current.max).toBe(100)
      expect(result.current.step).toBe(1)
      expect(result.current.mode).toBe('auto')
    })

    it('should handle mode attribute', () => {
      const attributes = { mode: 'slider' as const }
      mockUseEntity.mockReturnValue(createMockNumberEntity('50', attributes))

      const { result } = renderHook(() => useNumber('number.test'))

      expect(result.current.mode).toBe('slider')
    })

    it('should handle unit_of_measurement', () => {
      const attributes = { unit_of_measurement: '°C' }
      mockUseEntity.mockReturnValue(createMockNumberEntity('22', attributes))

      const { result } = renderHook(() => useNumber('number.test'))

      expect(result.current.unit).toBe('°C')
    })

    it('should handle device_class', () => {
      const attributes = { device_class: 'temperature' }
      mockUseEntity.mockReturnValue(createMockNumberEntity('22', attributes))

      const { result } = renderHook(() => useNumber('number.test'))

      expect(result.current.deviceClass).toBe('temperature')
    })
  })

  describe('Service Calls', () => {
    it('should call number.set_value service on setValue()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('50'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.setValue(75)
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 75 })
    })

    it('should clamp value to max when setValue() exceeds max', async () => {
      const mockCallService = vi.fn()
      const attributes = { min: 0, max: 100 }
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('50', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.setValue(150)
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 100 })
    })

    it('should clamp value to min when setValue() is below min', async () => {
      const mockCallService = vi.fn()
      const attributes = { min: 0, max: 100 }
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('50', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.setValue(-10)
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 0 })
    })

    it('should increment value by step', async () => {
      const mockCallService = vi.fn()
      const attributes = { min: 0, max: 100, step: 5 }
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('50', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.increment()
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 55 })
    })

    it('should not increment beyond max', async () => {
      const mockCallService = vi.fn()
      const attributes = { min: 0, max: 100, step: 5 }
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('98', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.increment()
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 100 })
    })

    it('should decrement value by step', async () => {
      const mockCallService = vi.fn()
      const attributes = { min: 0, max: 100, step: 5 }
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('50', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.decrement()
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 45 })
    })

    it('should not decrement below min', async () => {
      const mockCallService = vi.fn()
      const attributes = { min: 0, max: 100, step: 5 }
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('2', attributes),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await act(async () => {
        await result.current.decrement()
      })

      expect(mockCallService).toHaveBeenCalledWith('number', 'set_value', { value: 0 })
    })

    it.each(['increment', 'decrement'] as const)(
      'should not %s when the current value is unavailable',
      async (action) => {
        const mockCallService = vi.fn()
        mockUseEntity.mockReturnValue({
          ...createMockNumberEntity('unavailable'),
          callService: mockCallService
        })

        const { result } = renderHook(() => useNumber('number.test'))

        await act(async () => {
          await result.current[action]()
        })

        expect(mockCallService).not.toHaveBeenCalled()
      }
    )

    it('should handle service call errors', async () => {
      const mockCallService = vi.fn().mockRejectedValue(new Error('Service call failed'))
      mockUseEntity.mockReturnValue({
        ...createMockNumberEntity('50'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useNumber('number.test'))

      await expect(result.current.setValue(75)).rejects.toThrow('Service call failed')
    })
  })

  describe('Entity ID Validation', () => {
    it('should accept full number entity ID', () => {
      const { result } = renderHook(() => useNumber('number.test'))

      expect(mockUseEntity).toHaveBeenCalledWith('number.test')
      expect(result.current).toBeDefined()
    })

    it('should normalize short entity ID', () => {
      const { result } = renderHook(() => useNumber('test'))

      expect(mockUseEntity).toHaveBeenCalledWith('number.test')
      expect(result.current).toBeDefined()
    })

    it('should warn about wrong domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useNumber('sensor.temperature'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('useNumber: Entity "sensor.temperature" has domain "sensor" but expects "number" domain')
      )
      expect(result.current).toBeDefined()

      consoleSpy.mockRestore()
    })
  })

  describe('Integration with useEntity', () => {
    it('should inherit all base entity properties', () => {
      const mockEntity = createMockNumberEntity('50', {
        friendly_name: 'Test Number'
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useNumber('number.test'))

      // Should have all base properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)

      // Plus number-specific properties
      expect(result.current.value).toBe(50)
      expect(result.current.setValue).toBeDefined()
      expect(result.current.increment).toBeDefined()
      expect(result.current.decrement).toBeDefined()
    })
  })
})
