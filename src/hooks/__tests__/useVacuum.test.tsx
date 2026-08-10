import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVacuum } from '../useVacuum'
import { useEntity } from '../useEntity'
import { VacuumFeatures } from '../../types'
import { FeatureNotSupportedError } from '../../utils/errors'

// Mock useEntity since useVacuum depends on it
vi.mock('../useEntity')

// Mock vacuum entity response
const createMockVacuumEntity = (
  state: string = 'idle',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'vacuum.test',
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

describe('useVacuum', () => {
  const mockUseEntity = useEntity as any

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockVacuumEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Entity ID Validation', () => {
    it('should warn when using wrong domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useVacuum('light.test'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('useVacuum: Entity "light.test" has domain "light" but expects "vacuum" domain')
      )

      consoleSpy.mockRestore()
    })

    it('should accept entity ID with vacuum domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useVacuum('vacuum.roborock'))

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should auto-prefix entity ID without domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useVacuum('roborock'))

      expect(mockUseEntity).toHaveBeenCalledWith('vacuum.roborock')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Basic Vacuum Properties', () => {
    it('should return battery level', () => {
      const attributes = {
        battery_level: 85
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('cleaning', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.batteryLevel).toBe(85)
    })

    it('should return null for missing battery level', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('cleaning', {}))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.batteryLevel).toBeNull()
    })

    it('should return fan speed', () => {
      const attributes = {
        fan_speed: 'Turbo',
        fan_speed_list: ['Silent', 'Standard', 'Medium', 'Turbo']
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('cleaning', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.fanSpeed).toBe('Turbo')
      expect(result.current.availableFanSpeeds).toEqual(['Silent', 'Standard', 'Medium', 'Turbo'])
    })

    it('should reuse the empty fan-speed fallback across renders', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('idle', {}))

      const { result, rerender } = renderHook(() => useVacuum('vacuum.test'))
      const firstFanSpeeds = result.current.availableFanSpeeds

      rerender()

      expect(result.current.availableFanSpeeds).toBe(firstFanSpeeds)
    })

    it('should return status', () => {
      const attributes = {
        status: 'Cleaning main room'
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('cleaning', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.status).toBe('Cleaning main room')
    })
  })

  describe('State Booleans', () => {
    it('should detect docked state', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('docked'))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isDocked).toBe(true)
      expect(result.current.isCharging).toBe(false)
      expect(result.current.isCleaning).toBe(false)
    })

    it('should detect charging state based on status attribute', () => {
      mockUseEntity.mockReturnValue(
        createMockVacuumEntity('docked', { status: 'Charging' })
      )

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isDocked).toBe(true)
      expect(result.current.isCharging).toBe(true)
    })

    it('should detect cleaning state', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('cleaning'))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isCleaning).toBe(true)
      expect(result.current.isDocked).toBe(false)
      expect(result.current.isReturning).toBe(false)
      expect(result.current.isIdle).toBe(false)
    })

    it('should detect returning state', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('returning'))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isReturning).toBe(true)
      expect(result.current.isCleaning).toBe(false)
      expect(result.current.isIdle).toBe(false)
    })

    it('should detect idle state', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('idle'))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isIdle).toBe(true)
      expect(result.current.isCleaning).toBe(false)
      expect(result.current.isReturning).toBe(false)
    })

    it('should detect error state', () => {
      mockUseEntity.mockReturnValue(createMockVacuumEntity('error'))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isError).toBe(true)
    })

    it('should detect charging from status', () => {
      const attributes = {
        status: 'Charging'
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('idle', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.isCharging).toBe(true)
    })
  })

  describe('Feature Support', () => {
    it('should detect start support', () => {
      const attributes = {
        supported_features: VacuumFeatures.SUPPORT_START
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('idle', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.supportsStart).toBe(true)
      expect(result.current.supportsPause).toBe(false)
    })

    it('should detect pause support', () => {
      const attributes = {
        supported_features: VacuumFeatures.SUPPORT_PAUSE
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('cleaning', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.supportsPause).toBe(true)
    })

    it('should detect all features', () => {
      const attributes = {
        supported_features:
          VacuumFeatures.SUPPORT_TURN_ON |
          VacuumFeatures.SUPPORT_TURN_OFF |
          VacuumFeatures.SUPPORT_START |
          VacuumFeatures.SUPPORT_PAUSE |
          VacuumFeatures.SUPPORT_STOP |
          VacuumFeatures.SUPPORT_RETURN_HOME |
          VacuumFeatures.SUPPORT_FAN_SPEED |
          VacuumFeatures.SUPPORT_LOCATE |
          VacuumFeatures.SUPPORT_CLEAN_SPOT
      }
      mockUseEntity.mockReturnValue(createMockVacuumEntity('idle', attributes))

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.supportsTurnOn).toBe(true)
      expect(result.current.supportsTurnOff).toBe(true)
      expect(result.current.supportsStart).toBe(true)
      expect(result.current.supportsPause).toBe(true)
      expect(result.current.supportsStop).toBe(true)
      expect(result.current.supportsReturnHome).toBe(true)
      expect(result.current.supportsFanSpeed).toBe(true)
      expect(result.current.supportsLocate).toBe(true)
      expect(result.current.supportsCleanSpot).toBe(true)
    })
  })

  describe('Control Methods', () => {
    it('should call turn_on and turn_off for legacy vacuum features', async () => {
      const mockEntity = createMockVacuumEntity('off', {
        // HA VacuumEntityFeature.TURN_ON is 1 and TURN_OFF is 2:
        // https://github.com/home-assistant/core/blob/dev/homeassistant/components/vacuum/const.py
        supported_features: 1 | 2
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      expect(result.current.supportsTurnOn).toBe(true)
      expect(result.current.supportsTurnOff).toBe(true)

      await act(async () => {
        await result.current.turnOn()
        await result.current.turnOff()
      })

      expect(mockEntity.callService).toHaveBeenNthCalledWith(1, 'vacuum', 'turn_on')
      expect(mockEntity.callService).toHaveBeenNthCalledWith(2, 'vacuum', 'turn_off')
    })

    it('should reject unsupported turn_on and turn_off actions', async () => {
      const mockEntity = createMockVacuumEntity('off', {
        supported_features: 0
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await expect(result.current.turnOn()).rejects.toThrow(FeatureNotSupportedError)
      await expect(result.current.turnOff()).rejects.toThrow(FeatureNotSupportedError)
      expect(mockEntity.callService).not.toHaveBeenCalled()
    })

    it('should call start service', async () => {
      const mockEntity = createMockVacuumEntity('idle', {
        supported_features: VacuumFeatures.SUPPORT_START
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.start()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'start')
    })

    it('should throw error when start not supported', async () => {
      const mockEntity = createMockVacuumEntity('idle', {
        supported_features: 0
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await expect(result.current.start()).rejects.toThrow(FeatureNotSupportedError)
    })

    it('should call pause service', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: VacuumFeatures.SUPPORT_PAUSE
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.pause()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'pause')
    })

    it('should call stop service', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: VacuumFeatures.SUPPORT_STOP
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.stop()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'stop')
    })

    it('should call return to base service', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: VacuumFeatures.SUPPORT_RETURN_HOME
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.returnToBase()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'return_to_base')
    })

    it('should call locate service', async () => {
      const mockEntity = createMockVacuumEntity('idle', {
        supported_features: VacuumFeatures.SUPPORT_LOCATE
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.locate()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'locate')
    })

    it('should call clean spot service', async () => {
      const mockEntity = createMockVacuumEntity('idle', {
        supported_features: VacuumFeatures.SUPPORT_CLEAN_SPOT
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.cleanSpot()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'clean_spot')
    })
  })

  describe('Fan Speed Control', () => {
    it('should set fan speed', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: VacuumFeatures.SUPPORT_FAN_SPEED,
        fan_speed: 'Standard',
        fan_speed_list: ['Silent', 'Standard', 'Turbo']
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.setFanSpeed('Turbo')
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'set_fan_speed', {
        fan_speed: 'Turbo'
      })
    })

    it('should throw error for unsupported fan speed', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: VacuumFeatures.SUPPORT_FAN_SPEED,
        fan_speed_list: ['Silent', 'Standard', 'Turbo']
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await expect(result.current.setFanSpeed('Invalid')).rejects.toThrow(
        'Fan speed "Invalid" is not available'
      )
    })

    it('should throw error when fan speed control not supported', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: 0
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await expect(result.current.setFanSpeed('Turbo')).rejects.toThrow(FeatureNotSupportedError)
    })

    it('should validate fan speed is not empty', async () => {
      const mockEntity = createMockVacuumEntity('cleaning', {
        supported_features: VacuumFeatures.SUPPORT_FAN_SPEED
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await expect(result.current.setFanSpeed('')).rejects.toThrow()
    })
  })

  describe('Send Command', () => {
    it('should send command without parameters', async () => {
      const mockEntity = createMockVacuumEntity('idle')
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.sendCommand('app_start')
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'send_command', {
        command: 'app_start',
        params: undefined
      })
    })

    it('should send command with parameters', async () => {
      const mockEntity = createMockVacuumEntity('idle')
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await act(async () => {
        await result.current.sendCommand('app_segment_clean', { segments: [1, 2, 3] })
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('vacuum', 'send_command', {
        command: 'app_segment_clean',
        params: { segments: [1, 2, 3] }
      })
    })

    it('should validate command is not empty', async () => {
      const mockEntity = createMockVacuumEntity('idle')
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useVacuum('vacuum.test'))

      await expect(result.current.sendCommand('')).rejects.toThrow()
    })
  })
})
