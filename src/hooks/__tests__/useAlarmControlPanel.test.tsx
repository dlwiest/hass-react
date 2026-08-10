import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlarmControlPanel } from '../useAlarmControlPanel'
import { useEntity } from '../useEntity'
import { AlarmControlPanelFeatures } from '../../types'
import { createMockAlarmControlPanelEntity } from '../../test/utils'

// Mock useEntity since useAlarmControlPanel depends on it
vi.mock('../useEntity')

describe('useAlarmControlPanel', () => {
  const mockUseEntity = useEntity as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('State Helpers', () => {
    it('should handle disarmed state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        friendly_name: 'Test Alarm',
        supported_features: 0,
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isDisarmed).toBe(true)
      expect(result.current.isArmedHome).toBe(false)
      expect(result.current.isArmedAway).toBe(false)
      expect(result.current.isArmedNight).toBe(false)
      expect(result.current.isArmedVacation).toBe(false)
      expect(result.current.isArmedCustomBypass).toBe(false)
      expect(result.current.isPending).toBe(false)
      expect(result.current.isArming).toBe(false)
      expect(result.current.isDisarming).toBe(false)
      expect(result.current.isTriggered).toBe(false)
    })

    it('should handle armed_home state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_home', {
        friendly_name: 'Test Alarm',
        changed_by: 'User',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isDisarmed).toBe(false)
      expect(result.current.isArmedHome).toBe(true)
      expect(result.current.isArmedAway).toBe(false)
      expect(result.current.changedBy).toBe('User')
    })

    it('should handle armed_away state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_away', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isArmedAway).toBe(true)
      expect(result.current.isArmedHome).toBe(false)
      expect(result.current.isDisarmed).toBe(false)
    })

    it('should handle armed_night state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_night', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isArmedNight).toBe(true)
      expect(result.current.isArmedHome).toBe(false)
      expect(result.current.isArmedAway).toBe(false)
    })

    it('should handle armed_vacation state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_vacation', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isArmedVacation).toBe(true)
      expect(result.current.isArmedNight).toBe(false)
    })

    it('should handle armed_custom_bypass state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_custom_bypass', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isArmedCustomBypass).toBe(true)
      expect(result.current.isDisarmed).toBe(false)
    })

    it('should handle pending state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'pending', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isPending).toBe(true)
      expect(result.current.isTriggered).toBe(false)
    })

    it('should handle arming state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'arming', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isArming).toBe(true)
      expect(result.current.isDisarming).toBe(false)
    })

    it('should handle disarming state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarming', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isDisarming).toBe(true)
      expect(result.current.isArming).toBe(false)
    })

    it('should handle triggered state correctly', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'triggered', {
        friendly_name: 'Test Alarm',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.isTriggered).toBe(true)
      expect(result.current.isDisarmed).toBe(false)
      expect(result.current.isPending).toBe(false)
    })
  })

  describe('Feature Support', () => {
    it('should detect all supported features', () => {
      const allFeatures =
        AlarmControlPanelFeatures.SUPPORT_ARM_HOME |
        AlarmControlPanelFeatures.SUPPORT_ARM_AWAY |
        AlarmControlPanelFeatures.SUPPORT_ARM_NIGHT |
        AlarmControlPanelFeatures.SUPPORT_ARM_VACATION |
        AlarmControlPanelFeatures.SUPPORT_ARM_CUSTOM_BYPASS |
        AlarmControlPanelFeatures.SUPPORT_TRIGGER

      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        friendly_name: 'Full Featured Alarm',
        supported_features: allFeatures,
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.supportsArmHome).toBe(true)
      expect(result.current.supportsArmAway).toBe(true)
      expect(result.current.supportsArmNight).toBe(true)
      expect(result.current.supportsArmVacation).toBe(true)
      expect(result.current.supportsArmCustomBypass).toBe(true)
      expect(result.current.supportsTrigger).toBe(true)
    })

    it('should handle no supported features', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        friendly_name: 'Basic Alarm',
        supported_features: 0,
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.supportsArmHome).toBe(false)
      expect(result.current.supportsArmAway).toBe(false)
      expect(result.current.supportsArmNight).toBe(false)
      expect(result.current.supportsArmVacation).toBe(false)
      expect(result.current.supportsArmCustomBypass).toBe(false)
      expect(result.current.supportsTrigger).toBe(false)
    })

    it('should support only arm home and away', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        friendly_name: 'Simple Alarm',
        supported_features: AlarmControlPanelFeatures.SUPPORT_ARM_HOME | AlarmControlPanelFeatures.SUPPORT_ARM_AWAY,
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.supportsArmHome).toBe(true)
      expect(result.current.supportsArmAway).toBe(true)
      expect(result.current.supportsArmNight).toBe(false)
      expect(result.current.supportsArmVacation).toBe(false)
    })
  })

  describe('Attributes', () => {
    it('should expose code format', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        friendly_name: 'Test Alarm',
        code_format: 'number',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.codeFormat).toBe('number')
    })

    it('should handle changed_by attribute', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_away', {
        friendly_name: 'Test Alarm',
        changed_by: 'John Doe',
      })

      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.changedBy).toBe('John Doe')
    })
  })

  describe('Service Calls', () => {
    it('should call disarm service without code', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_away')
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.disarm()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_disarm', undefined)
    })

    it('should call disarm service with code', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_away')
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.disarm('1234')
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_disarm', { code: '1234' })
    })

    it('should call arm_home service without code', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        supported_features: AlarmControlPanelFeatures.SUPPORT_ARM_HOME
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.armHome()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_arm_home', undefined)
    })

    it('should call arm_home service with code', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        supported_features: AlarmControlPanelFeatures.SUPPORT_ARM_HOME
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.armHome('5678')
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_arm_home', { code: '5678' })
    })

    it('should call arm_away service without code', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        supported_features: AlarmControlPanelFeatures.SUPPORT_ARM_AWAY
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.armAway()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_arm_away', undefined)
    })

    it('should call arm_night service with code', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        supported_features: AlarmControlPanelFeatures.SUPPORT_ARM_NIGHT
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.armNight('9999')
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_arm_night', { code: '9999' })
    })

    it('should call arm_vacation for an ARM_VACATION-only panel', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        // HA AlarmControlPanelEntityFeature.ARM_VACATION is bit 32:
        // https://github.com/home-assistant/core/blob/dev/homeassistant/components/alarm_control_panel/const.py
        supported_features: 32
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.supportsArmVacation).toBe(true)
      expect(result.current.supportsTrigger).toBe(false)

      await act(async () => {
        await result.current.armVacation()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_arm_vacation', undefined)
    })

    it('should call arm_custom_bypass service', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'disarmed', {
        supported_features: AlarmControlPanelFeatures.SUPPORT_ARM_CUSTOM_BYPASS
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      await act(async () => {
        await result.current.armCustomBypass('0000')
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_arm_custom_bypass', { code: '0000' })
    })

    it('should call trigger for a TRIGGER-only panel', async () => {
      const mockEntity = createMockAlarmControlPanelEntity('test', 'armed_away', {
        // HA AlarmControlPanelEntityFeature.TRIGGER is bit 8:
        // https://github.com/home-assistant/core/blob/dev/homeassistant/components/alarm_control_panel/const.py
        supported_features: 8
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useAlarmControlPanel('test'))

      expect(result.current.supportsTrigger).toBe(true)
      expect(result.current.supportsArmVacation).toBe(false)

      await act(async () => {
        await result.current.trigger()
      })

      expect(mockEntity.callService).toHaveBeenCalledWith('alarm_control_panel', 'alarm_trigger')
    })
  })

  describe('Feature Not Supported Errors', () => {
    it('should throw error when trying to arm_home without support', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockAlarmControlPanelEntity('test', 'disarmed', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useAlarmControlPanel('alarm_control_panel.test'))

      await expect(
        act(async () => {
          await result.current.armHome()
        })
      ).rejects.toThrow('Feature "arm home" is not supported by entity "alarm_control_panel.test"')

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to arm_away without support', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockAlarmControlPanelEntity('test', 'disarmed', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useAlarmControlPanel('alarm_control_panel.test'))

      await expect(
        act(async () => {
          await result.current.armAway()
        })
      ).rejects.toThrow('Feature "arm away" is not supported by entity "alarm_control_panel.test"')

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to arm_night without support', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockAlarmControlPanelEntity('test', 'disarmed', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useAlarmControlPanel('alarm_control_panel.test'))

      await expect(
        act(async () => {
          await result.current.armNight()
        })
      ).rejects.toThrow('Feature "arm night" is not supported by entity "alarm_control_panel.test"')

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to arm_vacation without support', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockAlarmControlPanelEntity('test', 'disarmed', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useAlarmControlPanel('alarm_control_panel.test'))

      await expect(
        act(async () => {
          await result.current.armVacation()
        })
      ).rejects.toThrow('Feature "arm vacation" is not supported by entity "alarm_control_panel.test"')

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to arm_custom_bypass without support', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockAlarmControlPanelEntity('test', 'disarmed', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useAlarmControlPanel('alarm_control_panel.test'))

      await expect(
        act(async () => {
          await result.current.armCustomBypass()
        })
      ).rejects.toThrow('Feature "arm custom bypass" is not supported by entity "alarm_control_panel.test"')

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to trigger without support', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockAlarmControlPanelEntity('test', 'armed_away', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useAlarmControlPanel('alarm_control_panel.test'))

      await expect(
        act(async () => {
          await result.current.trigger()
        })
      ).rejects.toThrow('Feature "trigger" is not supported by entity "alarm_control_panel.test"')

      expect(mockCallService).not.toHaveBeenCalled()
    })
  })

  describe('Entity ID Normalization', () => {
    it('should normalize entity ID', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test')
      mockUseEntity.mockReturnValue(mockEntity)

      renderHook(() => useAlarmControlPanel('home_alarm'))

      expect(useEntity).toHaveBeenCalledWith('alarm_control_panel.home_alarm')
    })

    it('should not normalize full entity ID', () => {
      const mockEntity = createMockAlarmControlPanelEntity('test')
      mockUseEntity.mockReturnValue(mockEntity)

      renderHook(() => useAlarmControlPanel('alarm_control_panel.home_alarm'))

      expect(useEntity).toHaveBeenCalledWith('alarm_control_panel.home_alarm')
    })
  })

  describe('Warning Behavior', () => {
    let consoleMock: any

    beforeEach(() => {
      consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleMock.mockRestore()
    })

    it('should warn when using wrong domain', () => {
      mockUseEntity.mockReturnValue(createMockAlarmControlPanelEntity('test', 'disarmed'))

      renderHook(() => useAlarmControlPanel('binary_sensor.motion'))

      expect(consoleMock).toHaveBeenCalledWith(
        'useAlarmControlPanel: Entity "binary_sensor.motion" has domain "binary_sensor" but expects "alarm_control_panel" domain. This may not work as expected. Use useEntity() or the appropriate domain-specific hook instead.'
      )
    })
  })
})
