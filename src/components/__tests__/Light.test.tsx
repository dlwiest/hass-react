import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Light } from '../Light'
import { useLight } from '../../hooks/useLight'
import type { LightState } from '../../types'

// Mock useLight hook
vi.mock('../../hooks/useLight')

const mockUseLight = useLight as any

// Mock light entity response
const createMockLightEntity = (
  entityId: string = 'light.test',
  state: string = 'on',
  attributes: Record<string, any> = {}
) => ({
  entityId,
  state,
  attributes,
  lastChanged: new Date(),
  lastUpdated: new Date(),
  isUnavailable: state === 'unavailable',
  isConnected: true,
  callService: vi.fn(),
  callServiceWithResponse: vi.fn(),
  refresh: vi.fn(),
  isOn: state === 'on',
  brightness: attributes.brightness || 0,
  brightnessPercent: Math.round(((attributes.brightness || 0) / 255) * 100),
  rgbColor: attributes.rgb_color,
  colorTemp: attributes.color_temp_kelvin,
  effect: attributes.effect,
  supportsBrightness: !!(attributes.supported_features & 1),
  supportsColorTemp: !!(attributes.supported_features & 2),
  supportsEffects: !!(attributes.supported_features & 4),
  availableEffects: attributes.effect_list || [],
  supportsRgb: !!(attributes.supported_features & 16),
  turnOn: vi.fn(),
  turnOff: vi.fn(),
  toggle: vi.fn(),
  setBrightness: vi.fn(),
  setColorTemp: vi.fn(),
  setRgbColor: vi.fn(),
  setEffect: vi.fn()
})

describe('Light', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLight.mockReturnValue(createMockLightEntity())
  })

  describe('Basic Functionality', () => {
    it('should render children with light entity data', () => {
      const mockLightEntity = createMockLightEntity('light.living_room', 'on', { brightness: 255 })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Light Content</div>)

      render(
        <Light entityId="light.living_room">
          {mockChildren}
        </Light>
      )

      expect(mockChildren).toHaveBeenCalledWith(mockLightEntity)
    })

    it('should pass correct entityId to useLight hook', () => {
      const entityId = 'light.bedroom_ceiling'
      
      render(
        <Light entityId={entityId}>
          {() => <div>Content</div>}
        </Light>
      )

      expect(mockUseLight).toHaveBeenCalledWith(entityId)
    })

    it('should render children function result', () => {
      const { container } = render(
        <Light entityId="light.test">
          {() => <div data-testid="light-content">Light Control</div>}
        </Light>
      )

      expect(container.querySelector('[data-testid="light-content"]')).toBeInTheDocument()
      expect(container.textContent).toBe('Light Control')
    })
  })

  describe('Light State Handling', () => {
    it('should handle light in on state', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', { brightness: 200 })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Light On</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      expect(mockChildren).toHaveBeenCalledWith(mockLightEntity)
      expect(mockLightEntity.state).toBe('on')
      expect(mockLightEntity.isOn).toBe(true)
      expect(mockLightEntity.isOn).toBe(true)
    })

    it('should handle light in off state', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'off')
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Light Off</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      expect(mockChildren).toHaveBeenCalledWith(mockLightEntity)
      expect(mockLightEntity.state).toBe('off')
      expect(mockLightEntity.isOn).toBe(false)
      expect(mockLightEntity.isOn).toBe(false)
    })

    it('should handle unavailable light', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'unavailable')
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Light Unavailable</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      expect(mockChildren).toHaveBeenCalledWith(mockLightEntity)
      expect(mockLightEntity.state).toBe('unavailable')
      expect(mockLightEntity.isUnavailable).toBe(true)
    })
  })

  describe('Light Control Actions', () => {
    it('should support turning light on', () => {
      const mockTurnOn = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'off')
      mockLightEntity.turnOn = mockTurnOn
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="turn-on" onClick={() => light.turnOn()}>
              Turn On
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('turn-on'))

      expect(mockTurnOn).toHaveBeenCalled()
    })

    it('should support turning light off', () => {
      const mockTurnOff = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'on')
      mockLightEntity.turnOff = mockTurnOff
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="turn-off" onClick={() => light.turnOff()}>
              Turn Off
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('turn-off'))

      expect(mockTurnOff).toHaveBeenCalled()
    })

    it('should support toggling light', () => {
      const mockToggle = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'on')
      mockLightEntity.toggle = mockToggle
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="toggle" onClick={() => light.toggle()}>
              Toggle
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('toggle'))

      expect(mockToggle).toHaveBeenCalled()
    })

    it('should support setting brightness', () => {
      const mockSetBrightness = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'on', { 
        brightness: 128,
        supported_features: 1 // SUPPORT_BRIGHTNESS
      })
      mockLightEntity.setBrightness = mockSetBrightness
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="set-brightness" onClick={() => light.setBrightness(200)}>
              Set Brightness
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('set-brightness'))

      expect(mockSetBrightness).toHaveBeenCalledWith(200)
    })

    it('should support setting RGB color', () => {
      const mockSetRgbColor = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 16 // SUPPORT_COLOR
      })
      mockLightEntity.setRgbColor = mockSetRgbColor
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="set-color" onClick={() => light.setRgbColor([255, 0, 0])}>
              Set Red
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('set-color'))

      expect(mockSetRgbColor).toHaveBeenCalledWith([255, 0, 0])
    })

    it('should support setting color temperature', () => {
      const mockSetColorTemp = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 2 // SUPPORT_COLOR_TEMP
      })
      mockLightEntity.setColorTemp = mockSetColorTemp
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="set-temp" onClick={() => light.setColorTemp(3000)}>
              Set Warm
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('set-temp'))

      expect(mockSetColorTemp).toHaveBeenCalledWith(3000)
    })

    it('should support setting effects', () => {
      const mockSetEffect = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 4 // SUPPORT_EFFECT
      })
      mockLightEntity.setEffect = mockSetEffect
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <button data-testid="set-effect" onClick={() => light.setEffect('rainbow')}>
              Set Rainbow
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('set-effect'))

      expect(mockSetEffect).toHaveBeenCalledWith('rainbow')
    })
  })

  describe('Light Features', () => {
    it('should expose brightness support', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 1, // SUPPORT_BRIGHTNESS
        brightness: 128
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Brightness Support</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsBrightness).toBe(true)
      expect(passedEntity.brightness).toBe(128)
    })

    it('should expose color temperature support', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 2, // SUPPORT_COLOR_TEMP
        color_temp_kelvin: 3000
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Color Temp Support</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsColorTemp).toBe(true)
      expect(passedEntity.colorTemp).toBe(3000)
    })

    it('should expose color support', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 16, // SUPPORT_COLOR
        rgb_color: [255, 128, 0],
        hs_color: [30, 100]
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Color Support</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsRgb).toBe(true)
      expect(passedEntity.rgbColor).toEqual([255, 128, 0])
      // hsColor not in LightState interface
    })

    it('should expose effect support', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        supported_features: 4, // SUPPORT_EFFECT
        effect: 'colorloop'
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Effect Support</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsEffects).toBe(true)
      expect(passedEntity.effect).toBe('colorloop')
    })
  })

  describe('Children Function Patterns', () => {
    it('should support conditional rendering based on light state', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', { brightness: 200 })
      mockUseLight.mockReturnValue(mockLightEntity)

      const { container } = render(
        <Light entityId="light.test">
          {(light) => (
            light.isOn 
              ? <div data-testid="light-on">Light is ON (Brightness: {light.brightness})</div>
              : <div data-testid="light-off">Light is OFF</div>
          )}
        </Light>
      )

      expect(container.querySelector('[data-testid="light-on"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="light-off"]')).not.toBeInTheDocument()
      expect(container.textContent).toBe('Light is ON (Brightness: 200)')
    })

    it('should support complex light controls', () => {
      const mockTurnOn = vi.fn()
      const mockTurnOff = vi.fn()
      const mockSetBrightness = vi.fn()
      const mockSetRgbColor = vi.fn()
      const mockLightEntity = createMockLightEntity('light.test', 'off', {
        supported_features: 17 // BRIGHTNESS + COLOR
      })
      mockLightEntity.turnOn = mockTurnOn
      mockLightEntity.turnOff = mockTurnOff
      mockLightEntity.setBrightness = mockSetBrightness
      mockLightEntity.setRgbColor = mockSetRgbColor
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.test">
          {(light) => (
            <div>
              <div data-testid="status">
                Status: {light.isOn ? 'ON' : 'OFF'}
              </div>
              <div data-testid="features">
                Brightness: {light.supportsBrightness ? 'Yes' : 'No'} |
                Color: {light.supportsRgb ? 'Yes' : 'No'}
              </div>
              <div>
                <button onClick={() => light.turnOn()}>On</button>
                <button onClick={() => light.turnOff()}>Off</button>
                <button onClick={() => light.setBrightness(128)}>Dim</button>
                <button onClick={() => light.setRgbColor([0, 255, 0])}>Green</button>
              </div>
            </div>
          )}
        </Light>
      )

      expect(getByTestId('status').textContent).toBe('Status: OFF')
      expect(getByTestId('features').textContent).toBe('Brightness: Yes | Color: Yes')
    })

    it('should support displaying current light attributes', () => {
      const mockLightEntity = createMockLightEntity('light.rgb_light', 'on', {
        friendly_name: 'RGB Light',
        brightness: 180,
        rgb_color: [255, 0, 255],
        color_mode: 'rgb',
        supported_features: 17
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const { container } = render(
        <Light entityId="light.rgb_light">
          {(light) => (
            <div data-testid="light-info">
              {light.attributes.friendly_name as string} - 
              Brightness: {light.brightness} - 
              Color: {light.rgbColor ? 'RGB' : 'Default'}
            </div>
          )}
        </Light>
      )

      expect(container.textContent).toBe('RGB Light - Brightness: 180 - Color: RGB')
    })
  })

  describe('Edge Cases', () => {
    it('should handle light with no features', () => {
      const mockLightEntity = createMockLightEntity('light.basic', 'on', {
        supported_features: 0
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Basic Light</div>)

      render(
        <Light entityId="light.basic">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsBrightness).toBe(false)
      expect(passedEntity.supportsRgb).toBe(false)
      expect(passedEntity.supportsColorTemp).toBe(false)
      expect(passedEntity.supportsEffects).toBe(false)
    })

    it('should handle light with all features', () => {
      const mockLightEntity = createMockLightEntity('light.advanced', 'on', {
        supported_features: 23, // ALL features
        brightness: 255,
        color_temp_kelvin: 4000,
        rgb_color: [255, 255, 255],
        effect: 'none'
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Advanced Light</div>)

      render(
        <Light entityId="light.advanced">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsBrightness).toBe(true)
      expect(passedEntity.supportsRgb).toBe(true)
      expect(passedEntity.supportsColorTemp).toBe(true)
      expect(passedEntity.supportsEffects).toBe(true)
    })

    it('should handle light entityId changes', () => {
      const mockChildren = vi.fn().mockReturnValue(<div>Content</div>)
      
      const { rerender } = render(
        <Light entityId="light.test1">
          {mockChildren}
        </Light>
      )

      expect(mockUseLight).toHaveBeenLastCalledWith('light.test1')

      rerender(
        <Light entityId="light.test2">
          {mockChildren}
        </Light>
      )

      expect(mockUseLight).toHaveBeenLastCalledWith('light.test2')
    })
  })

  describe('Integration', () => {
    it('should inherit all base entity properties', () => {
      const mockLightEntity = createMockLightEntity('light.test', 'on', {
        friendly_name: 'Test Light',
        brightness: 255
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Light</div>)

      render(
        <Light entityId="light.test">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      
      // Should have all base entity properties
      expect(passedEntity.entityId).toBe('light.test')
      expect(passedEntity.state).toBe('on')
      expect(passedEntity.attributes).toBeDefined()
      expect(passedEntity.lastChanged).toBeDefined()
      expect(passedEntity.lastUpdated).toBeDefined()
      expect(passedEntity.isUnavailable).toBeDefined()
      expect(passedEntity.isConnected).toBeDefined()
      expect(passedEntity.callService).toBeDefined()
      expect(passedEntity.refresh).toBeDefined()
      
      // Plus light-specific properties
      expect(passedEntity.isOn).toBeDefined()
      expect(passedEntity.isOn).toBeDefined()
      expect(passedEntity.brightness).toBeDefined()
      expect(passedEntity.turnOn).toBeDefined()
      expect(passedEntity.turnOff).toBeDefined()
      expect(passedEntity.toggle).toBeDefined()
      expect(passedEntity.setBrightness).toBeDefined()
      expect(passedEntity.setColorTemp).toBeDefined()
      expect(passedEntity.setRgbColor).toBeDefined()
      expect(passedEntity.setEffect).toBeDefined()
      expect(passedEntity.availableEffects).toBeDefined()
    })

    it('should expose available effects when supported', () => {
      const mockLightEntity = createMockLightEntity('light.effect_light', 'on', {
        supported_features: 4, // SUPPORT_EFFECT
        effect_list: ['colorloop', 'strobe', 'rainbow'],
        effect: 'colorloop'
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Effects Light</div>)

      render(
        <Light entityId="light.effect_light">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsEffects).toBe(true)
      expect(passedEntity.availableEffects).toEqual(['colorloop', 'strobe', 'rainbow'])
      expect(passedEntity.effect).toBe('colorloop')
    })

    it('should handle empty effects list when effects not supported', () => {
      const mockLightEntity = createMockLightEntity('light.basic_light', 'on', {
        supported_features: 1 // Only brightness, no effects
      })
      mockUseLight.mockReturnValue(mockLightEntity)

      const mockChildren = vi.fn().mockReturnValue(<div>Basic Light</div>)

      render(
        <Light entityId="light.basic_light">
          {mockChildren}
        </Light>
      )

      const passedEntity = mockChildren.mock.calls[0][0]
      expect(passedEntity.supportsEffects).toBe(false)
      expect(passedEntity.availableEffects).toEqual([])
      expect(passedEntity.effect).toBeUndefined()
    })

    it('should support setting effects', () => {
      const mockSetEffect = vi.fn()
      const mockLightEntity = createMockLightEntity('light.effect_light', 'on', {
        supported_features: 4, // SUPPORT_EFFECT
        effect_list: ['colorloop', 'strobe', 'rainbow'],
        effect: 'colorloop'
      })
      mockLightEntity.setEffect = mockSetEffect
      mockUseLight.mockReturnValue(mockLightEntity)

      const { getByTestId } = render(
        <Light entityId="light.effect_light">
          {(light) => (
            <button data-testid="set-strobe" onClick={() => light.setEffect('strobe')}>
              Set Strobe
            </button>
          )}
        </Light>
      )

      fireEvent.click(getByTestId('set-strobe'))

      expect(mockSetEffect).toHaveBeenCalledWith('strobe')
    })
  })
})