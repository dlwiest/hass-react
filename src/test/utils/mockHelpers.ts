import { vi, expect } from 'vitest'
import type { EntityHook } from '../../hooks/useEntity'
import { EntityNotAvailableError } from '../../utils/errors'

// Creates a mock entity for testing purposes
export function createMockEntity<T = Record<string, unknown>>(
  entityId: string,
  state: string = 'on',
  attributes: T = {} as T,
  isConnected: boolean = true,
  error: Error | undefined = state === 'unavailable'
    ? new EntityNotAvailableError(entityId, 'Entity is unavailable')
    : undefined
): EntityHook<T> {
  return {
    entityId,
    state,
    attributes,
    lastChanged: new Date(),
    lastUpdated: new Date(),
    isUnavailable: state === 'unavailable',
    isConnected,
    error,
    callService: vi.fn(),
    callServiceWithResponse: vi.fn(),
    refresh: vi.fn()
  }
}

// Creates a domain-specific mock entity factory function
export function createMockEntityFactory(domain: string) {
  return <T = Record<string, unknown>>(
    entityName: string = 'test',
    state: string = 'on',
    attributes: T = {} as T
  ) => createMockEntity<T>(`${domain}.${entityName}`, state, attributes)
}

export const createMockLightEntity = createMockEntityFactory('light')
export const createMockFanEntity = createMockEntityFactory('fan')
export const createMockSwitchEntity = createMockEntityFactory('switch')
export const createMockLockEntity = createMockEntityFactory('lock')
export const createMockClimateEntity = createMockEntityFactory('climate')
export const createMockSensorEntity = createMockEntityFactory('sensor')
export const createMockCoverEntity = createMockEntityFactory('cover')
export const createMockCameraEntity = createMockEntityFactory('camera')
export const createMockAlarmControlPanelEntity = createMockEntityFactory('alarm_control_panel')

// DateTime is special - it always uses sensor.date_time_iso
export const createMockDateTimeEntity = (
  state: string = new Date().toISOString(),
  attributes: Record<string, unknown> = {}
) => createMockEntity('sensor.date_time_iso', state, {
  friendly_name: 'Date & Time',
  icon: 'mdi:clock',
  ...attributes
})

// Creates mock entities with typical default attributes for each domain
export const createMockEntityWithDefaults = {
  light: (entityName: string = 'test', state: string = 'on') =>
    createMockLightEntity(entityName, state, {
      friendly_name: `Test Light ${entityName}`,
      supported_features: 1, // SUPPORT_BRIGHTNESS by default
      brightness: state === 'on' ? 255 : 0
    }),

  fan: (entityName: string = 'test', state: string = 'on') =>
    createMockFanEntity(entityName, state, {
      friendly_name: `Test Fan ${entityName}`,
      supported_features: 1, // SUPPORT_SET_SPEED by default
      percentage: state === 'on' ? 50 : 0
    }),

  switch: (entityName: string = 'test', state: string = 'on') =>
    createMockSwitchEntity(entityName, state, {
      friendly_name: `Test Switch ${entityName}`
    }),

  lock: (entityName: string = 'test', state: string = 'locked') =>
    createMockLockEntity(entityName, state, {
      friendly_name: `Test Lock ${entityName}`,
      supported_features: 0
    }),

  climate: (entityName: string = 'test', state: string = 'heat') =>
    createMockClimateEntity(entityName, state, {
      friendly_name: `Test Climate ${entityName}`,
      supported_features: 1, // SUPPORT_TARGET_TEMPERATURE by default
      current_temperature: 22,
      target_temperature: 24
    }),

  sensor: (entityName: string = 'test', state: string = '23.5') =>
    createMockSensorEntity(entityName, state, {
      friendly_name: `Test Sensor ${entityName}`,
      unit_of_measurement: '°C',
      device_class: 'temperature'
    }),

  cover: (entityName: string = 'test', state: string = 'closed') =>
    createMockCoverEntity(entityName, state, {
      friendly_name: `Test Cover ${entityName}`,
      supported_features: 15, // SUPPORT_OPEN | SUPPORT_CLOSE | SUPPORT_STOP | SUPPORT_SET_POSITION
      current_position: state === 'open' ? 100 : 0
    }),

  camera: (entityName: string = 'test', state: string = 'idle') =>
    createMockCameraEntity(entityName, state, {
      friendly_name: `Test Camera ${entityName}`,
      supported_features: 3, // SUPPORT_ON_OFF | SUPPORT_STREAM by default
      access_token: 'mock-access-token-123',
      brand: 'TestBrand',
      model: 'TestModel'
    })
}

// Creates a mock entity with specific features enabled for testing
export function createMockEntityWithFeatures<T = Record<string, unknown>>(
  domain: string,
  entityName: string,
  features: number[],
  state: string = 'on',
  additionalAttributes: Partial<T> = {}
): EntityHook<T> {
  const supportedFeatures = features.reduce((acc, feature) => acc | feature, 0)
  
  return createMockEntity<T>(
    `${domain}.${entityName}`,
    state,
    {
      friendly_name: `Test ${domain} ${entityName}`,
      supported_features: supportedFeatures,
      ...additionalAttributes
    } as T
  )
}

// Extracts the mock callService function for assertions
export function getMockServiceCall(mockEntity: EntityHook) {
  return mockEntity.callService as ReturnType<typeof vi.fn>
}

// Helper to verify service calls with specific parameters
export function expectServiceCalled(
  mockEntity: EntityHook,
  domain: string,
  service: string,
  data?: object
) {
  const mockCall = getMockServiceCall(mockEntity)
  
  if (data !== undefined) {
    return expect(mockCall).toHaveBeenCalledWith(domain, service, data)
  } else {
    return expect(mockCall).toHaveBeenCalledWith(domain, service)
  }
}