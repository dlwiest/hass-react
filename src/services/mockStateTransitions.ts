// Mock state transitions for testing Home Assistant entity behavior

// State transition result for mock service calls
export interface MockStateTransition {
  state: string
  attributes: Record<string, unknown>
}

// Simulates a toggle operation on any toggleable entity
export function mockToggle(currentState: string): string {
  return currentState === 'on' ? 'off' : 'on'
}

// Simulates a service call and returns the resulting state and attributes
export function mockServiceCall(
  domain: string,
  service: string,
  currentState: string,
  currentAttributes: Record<string, unknown>,
  serviceData: Record<string, unknown>
): MockStateTransition {
  let newAttributes = { ...currentAttributes }
  let newState = currentState
  
  // Extract entity_id from service_data - it's not part of the actual service parameters
  const { entity_id: _entityId, ...params } = serviceData
  
  switch (domain) {
    case 'light':
      ({ state: newState, attributes: newAttributes } = mockLightService(
        service, currentState, newAttributes, params
      ))
      break
      
    case 'fan':
      ({ state: newState, attributes: newAttributes } = mockFanService(
        service, currentState, newAttributes, params
      ))
      break
      
    case 'switch':
      ({ state: newState, attributes: newAttributes } = mockSwitchService(
        service, currentState, newAttributes, params
      ))
      break
      
    case 'lock':
      ({ state: newState, attributes: newAttributes } = mockLockService(
        service, currentState, newAttributes, params
      ))
      break
      
    case 'cover':
      ({ state: newState, attributes: newAttributes } = mockCoverService(
        service, currentState, newAttributes, params
      ))
      break
      
    case 'climate':
      ({ state: newState, attributes: newAttributes } = mockClimateService(
        service, currentState, newAttributes, params
      ))
      break

    case 'number':
      ({ state: newState, attributes: newAttributes } = mockNumberService(
        service, currentState, newAttributes, params
      ))
      break

    case 'vacuum':
      ({ state: newState, attributes: newAttributes } = mockVacuumService(
        service, currentState, newAttributes, params
      ))
      break

    case 'scene':
      ({ state: newState, attributes: newAttributes } = mockSceneService(
        service, currentState, newAttributes, params
      ))
      break

    case 'alarm_control_panel':
      ({ state: newState, attributes: newAttributes } = mockAlarmControlPanelService(
        service, currentState, newAttributes, params
      ))
      break

    case 'media_player':
      ({ state: newState, attributes: newAttributes } = mockMediaPlayerService(
        service, currentState, newAttributes, params
      ))
      break

    default:
      // For unknown domains, just handle basic toggle/turn_on/turn_off
      ({ state: newState, attributes: newAttributes } = mockBasicService(
        service, currentState, newAttributes, params
      ))
  }
  
  return { state: newState, attributes: newAttributes }
}

// Mock light-specific services for testing
function mockLightService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'toggle':
      return { state: mockToggle(currentState), attributes }
    
    case 'turn_on':
      return { 
        state: 'on', 
        attributes: { ...attributes, ...params } 
      }
    
    case 'turn_off':
      return { state: 'off', attributes }
    
    default:
      return { state: currentState, attributes }
  }
}

// Mock fan-specific services
function mockFanService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'toggle':
      return { state: mockToggle(currentState), attributes }
    
    case 'turn_on':
      return { 
        state: 'on', 
        attributes: { ...attributes, ...params } 
      }
    
    case 'turn_off':
      return { 
        state: 'off', 
        attributes: { ...attributes, percentage: 0 } 
      }
    
    case 'set_percentage': {
      const percentage = params.percentage as number
      return { 
        state: percentage > 0 ? 'on' : 'off',
        attributes: { ...attributes, percentage }
      }
    }
    
    case 'oscillate':
      return { 
        state: currentState,
        attributes: { ...attributes, oscillating: params.oscillating }
      }
    
    case 'set_direction':
      return { 
        state: currentState,
        attributes: { ...attributes, direction: params.direction }
      }
    
    case 'set_preset_mode':
      return { 
        state: 'on',
        attributes: { ...attributes, preset_mode: params.preset_mode as string }
      }
    
    default:
      return { state: currentState, attributes }
  }
}

// Mock switch-specific services
function mockSwitchService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  _params?: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'toggle':
      return { state: mockToggle(currentState), attributes }
    
    case 'turn_on':
      return { state: 'on', attributes }
    
    case 'turn_off':
      return { state: 'off', attributes }
    
    default:
      return { state: currentState, attributes }
  }
}

// Mock lock-specific services
function mockLockService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  _params?: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'lock':
      return { 
        state: 'locked',
        attributes: { ...attributes, changed_by: 'Manual' }
      }
    
    case 'unlock':
      return { 
        state: 'unlocked',
        attributes: { ...attributes, changed_by: 'Manual' }
      }
    
    case 'open':
      return { 
        state: 'open',
        attributes: { ...attributes, changed_by: 'Manual' }
      }
    
    default:
      return { state: currentState, attributes }
  }
}

// Mock cover-specific services
function mockCoverService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'open_cover':
      return { 
        state: 'opening',
        attributes: { ...attributes, current_position: 100 }
      }
    
    case 'close_cover':
      return { 
        state: 'closing',
        attributes: { ...attributes, current_position: 0 }
      }
    
    case 'stop_cover':
      return {
        state: attributes.current_position === 0 ? 'closed' : 'open',
        attributes
      }
    
    case 'set_cover_position': {
      const position = params.position
      return {
        state: position === 0 ? 'closed' : 'open',
        attributes: { ...attributes, current_position: position }
      }
    }
    
    default:
      return { state: currentState, attributes }
  }
}

// Mock climate-specific services
function mockClimateService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'set_hvac_mode': {
      const hvacMode = params.hvac_mode as string
      return {
        state: hvacMode,
        attributes: { ...attributes, hvac_mode: hvacMode }
      }
    }

    case 'set_temperature':
      return {
        state: currentState,
        attributes: { ...attributes, temperature: params.temperature as number }
      }

    case 'turn_on':
      return {
        state: (attributes.hvac_mode as string) || 'heat',
        attributes
      }

    case 'turn_off':
      return {
        state: 'off',
        attributes
      }

    default:
      return { state: currentState, attributes }
  }
}

// Mock number-specific services
function mockNumberService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'set_value': {
      const value = params.value as number
      // Clamp to min/max if they exist
      const min = attributes.min as number | undefined
      const max = attributes.max as number | undefined
      let clampedValue = value
      if (min !== undefined) clampedValue = Math.max(min, clampedValue)
      if (max !== undefined) clampedValue = Math.min(max, clampedValue)

      return {
        state: clampedValue.toString(),
        attributes
      }
    }

    default:
      return { state: currentState, attributes }
  }
}

// Mock vacuum-specific services
function mockVacuumService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'start':
      return {
        state: 'cleaning',
        attributes: { ...attributes, status: 'Cleaning' }
      }

    case 'pause':
      return {
        state: 'paused',
        attributes: { ...attributes, status: 'Paused' }
      }

    case 'stop':
      return {
        state: 'idle',
        attributes: { ...attributes, status: 'Stopped' }
      }

    case 'return_to_base':
      return {
        state: 'returning',
        attributes: { ...attributes, status: 'Returning to dock' }
      }

    case 'set_fan_speed':
      return {
        state: currentState,
        attributes: { ...attributes, fan_speed: params.fan_speed as string }
      }

    case 'turn_on':
      return {
        state: 'idle',
        attributes: { ...attributes, status: 'Idle' }
      }

    case 'turn_off':
      return {
        state: 'off',
        attributes: { ...attributes, status: 'Off' }
      }

    case 'locate':
      return {
        state: currentState,
        attributes: { ...attributes, status: 'Locating...' }
      }

    case 'clean_spot':
      return {
        state: 'cleaning',
        attributes: { ...attributes, status: 'Spot cleaning' }
      }

    default:
      return { state: currentState, attributes }
  }
}

// Mock media-player-specific services
function mockMediaPlayerService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'media_play':
      return { state: 'playing', attributes }

    case 'media_pause':
      return { state: 'paused', attributes }

    case 'media_stop':
      return { state: 'idle', attributes }

    case 'volume_set':
      return {
        state: currentState,
        attributes: { ...attributes, volume_level: params.volume_level as number }
      }

    case 'volume_mute':
      return {
        state: currentState,
        attributes: { ...attributes, is_volume_muted: params.is_volume_muted as boolean }
      }

    case 'media_play_pause':
      return {
        state: currentState === 'playing' ? 'paused' : 'playing',
        attributes
      }

    case 'toggle':
      // media_player.toggle is a power toggle in Home Assistant, not play/pause
      return {
        state: currentState === 'off' ? 'idle' : 'off',
        attributes
      }

    case 'select_source':
      return {
        state: currentState,
        attributes: { ...attributes, source: params.source as string }
      }

    case 'shuffle_set':
      return {
        state: currentState,
        attributes: { ...attributes, shuffle: params.shuffle as boolean }
      }

    case 'repeat_set':
      return {
        state: currentState,
        attributes: { ...attributes, repeat: params.repeat as string }
      }

    case 'turn_on':
      return { state: 'idle', attributes }

    case 'turn_off':
      return { state: 'off', attributes }

    default:
      return { state: currentState, attributes }
  }
}

// Mock scene-specific services
function mockSceneService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  _params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'turn_on':
      // Scenes don't change state when activated, they just trigger actions
      // The state typically remains as 'scening'
      return {
        state: currentState,
        attributes
      }

    default:
      return { state: currentState, attributes }
  }
}

// Mock alarm control panel-specific services
function mockAlarmControlPanelService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  _params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'alarm_disarm':
      return {
        state: 'disarmed',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    case 'alarm_arm_home':
      return {
        state: 'armed_home',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    case 'alarm_arm_away':
      return {
        state: 'armed_away',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    case 'alarm_arm_night':
      return {
        state: 'armed_night',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    case 'alarm_arm_vacation':
      return {
        state: 'armed_vacation',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    case 'alarm_arm_custom_bypass':
      return {
        state: 'armed_custom_bypass',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    case 'alarm_trigger':
      return {
        state: 'triggered',
        attributes: { ...attributes, changed_by: 'Manual' }
      }

    default:
      return { state: currentState, attributes }
  }
}

// Mock basic services for unknown domains in testing
function mockBasicService(
  service: string,
  currentState: string,
  attributes: Record<string, unknown>,
  params: Record<string, unknown>
): MockStateTransition {
  switch (service) {
    case 'toggle':
      return { state: mockToggle(currentState), attributes }

    case 'turn_on':
      return { state: 'on', attributes: { ...attributes, ...params } }

    case 'turn_off':
      return { state: 'off', attributes }

    default:
      return { state: currentState, attributes }
  }
}