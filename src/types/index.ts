// Core types
export type {
  HAConfig,
  CurrentUser,
  ConnectionStatus,
  EntityState,
  BaseEntityHook,
} from './core'

export type {
  HAConnection,
  HATransport,
  HATransportHandlers,
} from './transport'

// WebSocket types
export type {
  StateChangedEvent,
} from './websocket'

// Entity types - Light
export type {
  LightColorMode,
  LightAttributes,
  LightTurnOnParams,
  LightCapabilities,
  LightState,
} from './entities/light'

export { LightFeatures } from './entities/light'

// Entity types - Climate
export type {
  ClimateAttributes,
  ClimateState,
} from './entities/climate'

export { ClimateFeatures } from './entities/climate'

// Entity types - Sensor
export type {
  SensorAttributes,
  SensorState,
} from './entities/sensor'

// Entity types - Binary Sensor
export type {
  BinarySensorAttributes,
  BinarySensorState,
} from './entities/binary_sensor'

// Entity types - Cover
export { CoverFeatures } from './entities/cover'

// Entity types - Todo
export type {
  TodoItem,
  TodoAttributes,
  TodoState,
} from './entities/todo'

export { TodoFeatures } from './entities/todo'

// Entity types - Fan
export type {
  FanAttributes,
  FanDirection,
  FanTurnOnParams,
  FanState,
} from './entities/fan'

export { FanFeatures } from './entities/fan'

// Entity types - Lock
export type {
  LockAttributes,
  LockState,
} from './entities/lock'

export { LockFeatures } from './entities/lock'

// Entity types - Media Player
export type {
  MediaPlayerAttributes,
  MediaPlayerCapabilities,
  MediaPlayerState,
} from './entities/media_player'

export { MediaPlayerFeatures } from './entities/media_player'

// Entity types - Camera
export type {
  CameraAttributes,
  StreamType,
  StreamState,
  StreamOptions,
  CameraCapabilities,
  CameraStreamMethods,
  CameraState,
} from './entities/camera'

export { CameraFeatures } from './entities/camera'

// Entity types - Number
export type {
  NumberAttributes,
  NumberState,
} from './entities/number'

// Entity types - Weather
export type {
  WeatherCondition,
  WeatherAttributes,
  WeatherState,
} from './entities/weather'

// Entity types - Vacuum
export type {
  VacuumAttributes,
  VacuumState,
} from './entities/vacuum'

export { VacuumFeatures } from './entities/vacuum'

// Entity types - Calendar
export type {
  CalendarEvent,
  CalendarAttributes,
  CalendarState,
} from './entities/calendar'

export { CalendarFeatures } from './entities/calendar'

// Entity types - Scene
export type {
  SceneAttributes,
  SceneState,
} from './entities/scene'

// Entity types - Alarm Control Panel
export type {
  AlarmControlPanelAttributes,
  AlarmControlPanelState,
} from './entities/alarm_control_panel'

export { AlarmControlPanelFeatures } from './entities/alarm_control_panel'

// Entity types - DateTime
export type {
  DateTimeAttributes,
  DateTimeState,
} from './entities/datetime'
