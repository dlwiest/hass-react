import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCover } from '../useCover'
import { useEntity } from '../useEntity'
import { CoverFeatures } from '../../types'
import { FeatureNotSupportedError } from '../../utils/errors'

// Mock useEntity since useCover depends on it
vi.mock('../useEntity')

// Mock cover entity response
const createMockCoverEntity = (
  state: string = 'closed',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'cover.test',
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

describe('useCover', () => {
  const mockUseEntity = useEntity as any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockCoverEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('State Detection', () => {
    it('should detect open state correctly', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('open'))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isOpen).toBe(true)
      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(false)
      expect(result.current.state).toBe('open')
    })

    it('should detect closed state correctly', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('closed'))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isOpen).toBe(false)
      expect(result.current.isClosed).toBe(true)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(false)
      expect(result.current.state).toBe('closed')
    })

    it('should detect opening state correctly', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('opening'))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isOpen).toBe(false)
      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(true)
      expect(result.current.isClosing).toBe(false)
      expect(result.current.state).toBe('opening')
    })

    it('should detect closing state correctly', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('closing'))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isOpen).toBe(false)
      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(true)
      expect(result.current.state).toBe('closing')
    })

    it('should handle unavailable state', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('unavailable'))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isOpen).toBe(false)
      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(false)
      expect(result.current.isUnavailable).toBe(true)
      expect(result.current.state).toBe('unavailable')
    })

    it('should handle unknown state', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('unknown'))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isOpen).toBe(false)
      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(false)
      expect(result.current.state).toBe('unknown')
    })
  })

  describe('Position Handling', () => {
    it('should return position when available', () => {
      const attributes = {
        current_position: 75
      }
      mockUseEntity.mockReturnValue(createMockCoverEntity('open', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.position).toBe(75)
    })

    it('should return undefined when position is not available', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockCoverEntity('closed', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.position).toBeUndefined()
    })

    it('should handle position 0 correctly', () => {
      const attributes = {
        current_position: 0
      }
      mockUseEntity.mockReturnValue(createMockCoverEntity('closed', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.position).toBe(0)
    })

    it('should handle position 100 correctly', () => {
      const attributes = {
        current_position: 100
      }
      mockUseEntity.mockReturnValue(createMockCoverEntity('open', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.position).toBe(100)
    })

    it('should handle fractional positions', () => {
      const attributes = {
        current_position: 42.5
      }
      mockUseEntity.mockReturnValue(createMockCoverEntity('open', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.position).toBe(42.5)
    })
  })

  describe('Feature Detection', () => {
    it('should expose HA set-position and stop support', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('open', {
        // HA CoverEntityFeature.SET_POSITION is 4 and STOP is 8:
        // https://github.com/home-assistant/core/blob/dev/homeassistant/components/cover/__init__.py
        supported_features: 4 | 8
      }))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.supportsSetPosition).toBe(true)
      expect(result.current.supportsStop).toBe(true)
    })

    it('should keep unsupported capabilities false', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity('closed', {
        supported_features: CoverFeatures.OPEN | CoverFeatures.CLOSE
      }))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.supportsSetPosition).toBe(false)
      expect(result.current.supportsStop).toBe(false)
    })
  })

  describe('Service Calls', () => {
    it('should call cover.open_cover service on open()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity(),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      await act(async () => {
        await result.current.open()
      })

      expect(mockCallService).toHaveBeenCalledWith('cover', 'open_cover')
    })

    it('should call cover.close_cover service on close()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity('open'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      await act(async () => {
        await result.current.close()
      })

      expect(mockCallService).toHaveBeenCalledWith('cover', 'close_cover')
    })

    it('should call cover.stop_cover service on stop()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity('opening', { supported_features: CoverFeatures.STOP }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      await act(async () => {
        await result.current.stop()
      })

      expect(mockCallService).toHaveBeenCalledWith('cover', 'stop_cover')
    })

    it('should call cover.set_cover_position service on setPosition()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity('closed', { supported_features: CoverFeatures.SET_POSITION }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      await act(async () => {
        await result.current.setPosition(50)
      })

      expect(mockCallService).toHaveBeenCalledWith('cover', 'set_cover_position', { position: 50 })
    })

    it('should handle setPosition with various values', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity('closed', { supported_features: CoverFeatures.SET_POSITION }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      // Test different position values
      await act(async () => {
        await result.current.setPosition(0)
      })
      expect(mockCallService).toHaveBeenCalledWith('cover', 'set_cover_position', { position: 0 })

      await act(async () => {
        await result.current.setPosition(100)
      })
      expect(mockCallService).toHaveBeenCalledWith('cover', 'set_cover_position', { position: 100 })

      await act(async () => {
        await result.current.setPosition(33)
      })
      expect(mockCallService).toHaveBeenCalledWith('cover', 'set_cover_position', { position: 33 })
    })

    it('should handle service call errors', async () => {
      const mockCallService = vi.fn().mockRejectedValue(new Error('Service call failed'))
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity('closed', {
          supported_features: CoverFeatures.SET_POSITION | CoverFeatures.STOP
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      await expect(result.current.open()).rejects.toThrow('Service call failed')
      await expect(result.current.close()).rejects.toThrow('Service call failed')
      await expect(result.current.stop()).rejects.toThrow('Service call failed')
      await expect(result.current.setPosition(50)).rejects.toThrow('Service call failed')
    })

    it('should reject unsupported stop and position actions before calling HA', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity('closed', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCover('cover.test'))

      await expect(result.current.stop()).rejects.toThrow(FeatureNotSupportedError)
      await expect(result.current.setPosition(50)).rejects.toThrow(FeatureNotSupportedError)
      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should maintain callback references for performance', () => {
      mockUseEntity.mockReturnValue(createMockCoverEntity())

      const { result, rerender } = renderHook(() => useCover('cover.test'))

      const firstCallbacks = {
        open: result.current.open,
        close: result.current.close,
        stop: result.current.stop,
        setPosition: result.current.setPosition
      }

      rerender()

      // Callbacks should be the same reference (useCallback working)
      expect(result.current.open).toBe(firstCallbacks.open)
      expect(result.current.close).toBe(firstCallbacks.close)
      expect(result.current.stop).toBe(firstCallbacks.stop)
      expect(result.current.setPosition).toBe(firstCallbacks.setPosition)
    })
  })

  describe('Integration with useEntity', () => {
    it('should pass entityId to useEntity', () => {
      const entityId = 'cover.garage_door'
      
      renderHook(() => useCover(entityId))

      expect(mockUseEntity).toHaveBeenCalledWith(entityId)
    })

    it('should inherit all base entity properties', () => {
      const mockEntity = createMockCoverEntity('closed', { 
        current_position: 0,
        test: 'value'
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useCover('cover.test'))

      // Should inherit all base properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.attributes).toBe(mockEntity.attributes)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)

      // Plus cover-specific properties
      expect(result.current.isOpen).toBe(false)
      expect(result.current.isClosed).toBe(true)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(false)
      expect(result.current.position).toBe(0)
      expect(result.current.open).toBeDefined()
      expect(result.current.close).toBeDefined()
      expect(result.current.stop).toBeDefined()
      expect(result.current.setPosition).toBeDefined()
    })

    it('should update when useEntity data changes', () => {
      // Start with closed cover
      mockUseEntity.mockReturnValue(createMockCoverEntity('closed', { current_position: 0 }))

      const { result, rerender } = renderHook(() => useCover('cover.test'))

      expect(result.current.isClosed).toBe(true)
      expect(result.current.position).toBe(0)

      // Update to opening
      mockUseEntity.mockReturnValue(createMockCoverEntity('opening', { current_position: 25 }))
      rerender()

      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(true)
      expect(result.current.position).toBe(25)

      // Update to open
      mockUseEntity.mockReturnValue(createMockCoverEntity('open', { current_position: 100 }))
      rerender()

      expect(result.current.isOpening).toBe(false)
      expect(result.current.isOpen).toBe(true)
      expect(result.current.position).toBe(100)
    })

    it('should handle callService dependency changes correctly', () => {
      const mockCallService1 = vi.fn()
      const mockCallService2 = vi.fn()
      
      // Initial render with first callService
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity(),
        callService: mockCallService1
      })

      const { result, rerender } = renderHook(() => useCover('cover.test'))
      const firstOpen = result.current.open

      // Update with new callService reference
      mockUseEntity.mockReturnValue({
        ...createMockCoverEntity(),
        callService: mockCallService2
      })
      rerender()

      // open function should have new reference due to callService dependency
      expect(result.current.open).not.toBe(firstOpen)
    })

    it('should handle complex cover with all features', () => {
      const attributes = {
        current_position: 42,
        friendly_name: 'Living Room Blinds',
        supported_features: 15, // Support open, close, stop, set position
        device_class: 'blind'
      }
      mockUseEntity.mockReturnValue(createMockCoverEntity('open', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      // State detection
      expect(result.current.isOpen).toBe(true)
      expect(result.current.isClosed).toBe(false)
      expect(result.current.isOpening).toBe(false)
      expect(result.current.isClosing).toBe(false)

      // Position
      expect(result.current.position).toBe(42)

      // All service methods available
      expect(typeof result.current.open).toBe('function')
      expect(typeof result.current.close).toBe('function')
      expect(typeof result.current.stop).toBe('function')
      expect(typeof result.current.setPosition).toBe('function')

      // Full attributes available
      expect(result.current.attributes).toEqual(attributes)
    })

    it('should handle cover without position support', () => {
      const attributes = {
        friendly_name: 'Garage Door',
        supported_features: 3, // Only open and close
        device_class: 'garage'
      }
      mockUseEntity.mockReturnValue(createMockCoverEntity('closed', attributes))

      const { result } = renderHook(() => useCover('cover.test'))

      expect(result.current.isClosed).toBe(true)
      expect(result.current.position).toBeUndefined() // No current_position attribute
      
      // Should still have all methods (though setPosition might not work)
      expect(typeof result.current.open).toBe('function')
      expect(typeof result.current.close).toBe('function')
      expect(typeof result.current.stop).toBe('function')
      expect(typeof result.current.setPosition).toBe('function')
    })
  })
})