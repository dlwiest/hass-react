import { describe, it, expect } from 'vitest'
import { mockToggle, mockServiceCall } from '../mockStateTransitions'

describe('mockStateTransitions', () => {
  describe('mockToggle', () => {
    it('should toggle on to off', () => {
      expect(mockToggle('on')).toBe('off')
    })

    it('should toggle off to on', () => {
      expect(mockToggle('off')).toBe('on')
    })

    it('should toggle other states to on', () => {
      expect(mockToggle('unavailable')).toBe('on')
      expect(mockToggle('unknown')).toBe('on')
      expect(mockToggle('idle')).toBe('on')
    })
  })

  describe('mockServiceCall', () => {
    describe('light domain', () => {
      it('should handle toggle service', () => {
        const result = mockServiceCall(
          'light', 
          'toggle', 
          'on', 
          { brightness: 255 },
          { entity_id: 'light.test' }
        )
        
        expect(result.state).toBe('off')
        expect(result.attributes).toEqual({ brightness: 255 })
      })

      it('should handle turn_on service', () => {
        const result = mockServiceCall(
          'light',
          'turn_on',
          'off',
          { brightness: 0 },
          { entity_id: 'light.test', brightness: 128, color_temp_kelvin: 2700 }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes).toEqual({ brightness: 128, color_temp_kelvin: 2700 })
      })

      it('should handle turn_off service', () => {
        const result = mockServiceCall(
          'light',
          'turn_off',
          'on',
          { brightness: 255 },
          { entity_id: 'light.test' }
        )
        
        expect(result.state).toBe('off')
        expect(result.attributes).toEqual({ brightness: 255 })
      })

      it('should ignore entity_id in service data', () => {
        const result = mockServiceCall(
          'light',
          'turn_on',
          'off',
          {},
          { entity_id: 'light.test', brightness: 100 }
        )
        
        expect(result.attributes.entity_id).toBeUndefined()
        expect(result.attributes.brightness).toBe(100)
      })
    })

    describe('fan domain', () => {
      it('should handle toggle service', () => {
        const result = mockServiceCall(
          'fan',
          'toggle',
          'off',
          { percentage: 0 },
          { entity_id: 'fan.test' }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.percentage).toBe(0)
      })

      it('should handle turn_on service', () => {
        const result = mockServiceCall(
          'fan',
          'turn_on',
          'off',
          {},
          { entity_id: 'fan.test', percentage: 75 }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.percentage).toBe(75)
      })

      it('should handle turn_off service and reset percentage', () => {
        const result = mockServiceCall(
          'fan',
          'turn_off',
          'on',
          { percentage: 75 },
          { entity_id: 'fan.test' }
        )
        
        expect(result.state).toBe('off')
        expect(result.attributes.percentage).toBe(0)
      })

      it('should handle set_percentage service', () => {
        const result = mockServiceCall(
          'fan',
          'set_percentage',
          'off',
          { percentage: 0 },
          { entity_id: 'fan.test', percentage: 50 }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.percentage).toBe(50)
      })

      it('should turn off when percentage is 0', () => {
        const result = mockServiceCall(
          'fan',
          'set_percentage',
          'on',
          { percentage: 75 },
          { entity_id: 'fan.test', percentage: 0 }
        )
        
        expect(result.state).toBe('off')
        expect(result.attributes.percentage).toBe(0)
      })

      it('should handle oscillate service', () => {
        const result = mockServiceCall(
          'fan',
          'oscillate',
          'on',
          { oscillating: false },
          { entity_id: 'fan.test', oscillating: true }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.oscillating).toBe(true)
      })

      it('should handle set_direction service', () => {
        const result = mockServiceCall(
          'fan',
          'set_direction',
          'on',
          { direction: 'forward' },
          { entity_id: 'fan.test', direction: 'reverse' }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.direction).toBe('reverse')
      })

      it('should handle set_preset_mode service', () => {
        const result = mockServiceCall(
          'fan',
          'set_preset_mode',
          'off',
          { preset_mode: 'low' },
          { entity_id: 'fan.test', preset_mode: 'high' }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.preset_mode).toBe('high')
      })
    })

    describe('switch domain', () => {
      it('should handle basic switch services', () => {
        const toggleResult = mockServiceCall(
          'switch', 'toggle', 'off', {}, { entity_id: 'switch.test' }
        )
        expect(toggleResult.state).toBe('on')

        const turnOnResult = mockServiceCall(
          'switch', 'turn_on', 'off', {}, { entity_id: 'switch.test' }
        )
        expect(turnOnResult.state).toBe('on')

        const turnOffResult = mockServiceCall(
          'switch', 'turn_off', 'on', {}, { entity_id: 'switch.test' }
        )
        expect(turnOffResult.state).toBe('off')
      })
    })

    describe('lock domain', () => {
      it('should handle lock service', () => {
        const result = mockServiceCall(
          'lock',
          'lock',
          'unlocked',
          { changed_by: 'User' },
          { entity_id: 'lock.test' }
        )
        
        expect(result.state).toBe('locked')
        expect(result.attributes.changed_by).toBe('Manual')
      })

      it('should handle unlock service', () => {
        const result = mockServiceCall(
          'lock',
          'unlock',
          'locked',
          {},
          { entity_id: 'lock.test', code: '1234' }
        )
        
        expect(result.state).toBe('unlocked')
        expect(result.attributes.changed_by).toBe('Manual')
      })

      it('should handle open service', () => {
        const result = mockServiceCall(
          'lock',
          'open',
          'locked',
          {},
          { entity_id: 'lock.test' }
        )
        
        expect(result.state).toBe('open')
        expect(result.attributes.changed_by).toBe('Manual')
      })
    })

    describe('cover domain', () => {
      it('should handle open_cover service', () => {
        const result = mockServiceCall(
          'cover',
          'open_cover',
          'closed',
          { current_position: 0 },
          { entity_id: 'cover.test' }
        )
        
        expect(result.state).toBe('opening')
        expect(result.attributes.current_position).toBe(100)
      })

      it('should handle close_cover service', () => {
        const result = mockServiceCall(
          'cover',
          'close_cover',
          'open',
          { current_position: 100 },
          { entity_id: 'cover.test' }
        )
        
        expect(result.state).toBe('closing')
        expect(result.attributes.current_position).toBe(0)
      })

      it('should handle stop_cover service', () => {
        const result = mockServiceCall(
          'cover',
          'stop_cover',
          'opening',
          { current_position: 50 },
          { entity_id: 'cover.test' }
        )
        
        expect(result.state).toBe('open')
        expect(result.attributes.current_position).toBe(50)
      })

      it('should handle set_cover_position service', () => {
        const result = mockServiceCall(
          'cover',
          'set_cover_position',
          'open',
          { current_position: 50 },
          { entity_id: 'cover.test', position: 75 }
        )
        
        expect(result.state).toBe('open')
        expect(result.attributes.current_position).toBe(75)
      })

      it('should set state based on position', () => {
        // Fully closed
        const closedResult = mockServiceCall(
          'cover', 'set_cover_position', 'open', {},
          { entity_id: 'cover.test', position: 0 }
        )
        expect(closedResult.state).toBe('closed')

        // Fully open
        const openResult = mockServiceCall(
          'cover', 'set_cover_position', 'closed', {},
          { entity_id: 'cover.test', position: 100 }
        )
        expect(openResult.state).toBe('open')

        // Partially open
        const partialResult = mockServiceCall(
          'cover', 'set_cover_position', 'open', {},
          { entity_id: 'cover.test', position: 50 }
        )
        expect(partialResult.state).toBe('open')
      })
    })

    describe('climate domain', () => {
      it('should handle set_hvac_mode service', () => {
        const result = mockServiceCall(
          'climate',
          'set_hvac_mode',
          'off',
          { hvac_mode: 'off' },
          { entity_id: 'climate.test', hvac_mode: 'heat' }
        )
        
        expect(result.state).toBe('heat')
        expect(result.attributes.hvac_mode).toBe('heat')
      })

      it('should handle set_temperature service', () => {
        const result = mockServiceCall(
          'climate',
          'set_temperature',
          'heat',
          { temperature: 20 },
          { entity_id: 'climate.test', temperature: 22 }
        )
        
        expect(result.state).toBe('heat')
        expect(result.attributes.temperature).toBe(22)
      })

      it('should handle turn_on service', () => {
        const result = mockServiceCall(
          'climate',
          'turn_on',
          'off',
          { hvac_mode: 'heat' },
          { entity_id: 'climate.test' }
        )
        
        expect(result.state).toBe('heat')
      })

      it('should handle turn_off service', () => {
        const result = mockServiceCall(
          'climate',
          'turn_off',
          'heat',
          { hvac_mode: 'heat' },
          { entity_id: 'climate.test' }
        )
        
        expect(result.state).toBe('off')
      })
    })

    describe('unknown domain', () => {
      it('should handle basic services for unknown domains', () => {
        const result = mockServiceCall(
          'unknown_domain',
          'toggle',
          'off',
          {},
          { entity_id: 'unknown_domain.test' }
        )
        
        expect(result.state).toBe('on')
      })

      it('should handle turn_on with parameters for unknown domains', () => {
        const result = mockServiceCall(
          'unknown_domain',
          'turn_on',
          'off',
          {},
          { entity_id: 'unknown_domain.test', some_param: 'value' }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.some_param).toBe('value')
      })

      it('should return unchanged state for unknown services', () => {
        const result = mockServiceCall(
          'light',
          'unknown_service',
          'on',
          { brightness: 255 },
          { entity_id: 'light.test' }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes).toEqual({ brightness: 255 })
      })
    })

    describe('edge cases', () => {
      it('should preserve existing attributes when adding new ones', () => {
        const result = mockServiceCall(
          'light',
          'turn_on',
          'off',
          { brightness: 128, existing_attr: 'keep_me' },
          { entity_id: 'light.test', color_temp_kelvin: 2700 }
        )
        
        expect(result.attributes).toEqual({
          brightness: 128,
          existing_attr: 'keep_me',
          color_temp_kelvin: 2700
        })
      })

      it('should handle empty service data', () => {
        const result = mockServiceCall(
          'light',
          'turn_on',
          'off',
          { brightness: 0 },
          { entity_id: 'light.test' }
        )
        
        expect(result.state).toBe('on')
        expect(result.attributes.brightness).toBe(0)
      })
    })
  })
})