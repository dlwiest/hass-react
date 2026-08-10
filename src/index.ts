// Providers
export { HAProvider, useHAConnection } from './providers/HAProvider'
export type { HAProviderProps } from './providers/HAProvider'

// Auth
export { useAuth } from './hooks/useAuth'
export { useCurrentUser } from './hooks/useCurrentUser'

// Base hooks
export { useEntity } from './hooks/useEntity'
export { useEntityGroup } from './hooks/useEntityGroup'
export { useServiceCall } from './hooks/useServiceCall'

// Entity-specific hooks
export { useLight } from './hooks/useLight'
export { useClimate } from './hooks/useClimate'
export { useSensor } from './hooks/useSensor'
export { useBinarySensor } from './hooks/useBinarySensor'
export { useTodo } from './hooks/useTodo'
export { useSwitch } from './hooks/useSwitch'
export { useCover } from './hooks/useCover'
export { useFan } from './hooks/useFan'
export { useLock } from './hooks/useLock'
export { useMediaPlayer } from './hooks/useMediaPlayer'
export { useCamera } from './hooks/useCamera'
export { useNumber } from './hooks/useNumber'
export { useWeather } from './hooks/useWeather'
export { useVacuum } from './hooks/useVacuum'
export { useCalendar } from './hooks/useCalendar'
export { useScene } from './hooks/useScene'
export { useScenes } from './hooks/useScenes'
export { useAlarmControlPanel } from './hooks/useAlarmControlPanel'
export { useDateTime } from './hooks/useDateTime'

// List hooks
export { useLights } from './hooks/useLights'
export { useSwitches } from './hooks/useSwitches'
export { useSensors } from './hooks/useSensors'
export { useBinarySensors } from './hooks/useBinarySensors'
export { useFans } from './hooks/useFans'
export { useLocks } from './hooks/useLocks'
export { useCovers } from './hooks/useCovers'
export { useMediaPlayers } from './hooks/useMediaPlayers'
export { useCameras } from './hooks/useCameras'
export { useClimates } from './hooks/useClimates'
export { useVacuums } from './hooks/useVacuums'
export { useCalendars } from './hooks/useCalendars'
export { useTodos } from './hooks/useTodos'
export { useNumbers } from './hooks/useNumbers'
export { useAlarmControlPanels } from './hooks/useAlarmControlPanels'

// Headless components
export { Light } from './components/Light'
export { Climate } from './components/Climate'
export { Sensor } from './components/Sensor'
export { BinarySensor } from './components/BinarySensor'
export { Todo } from './components/Todo'
export { Switch } from './components/Switch'
export { Cover } from './components/Cover'
export { Entity } from './components/Entity'
export { Fan } from './components/Fan'
export { Lock } from './components/Lock'
export { MediaPlayer } from './components/MediaPlayer'
export { Camera } from './components/Camera'
export { Number } from './components/Number'
export { Weather } from './components/Weather'
export { Vacuum } from './components/Vacuum'
export { Calendar } from './components/Calendar'
export { Scene } from './components/Scene'
export { AlarmControlPanel } from './components/AlarmControlPanel'
export { DateTime } from './components/DateTime'
export type { StreamPlayerProps } from './components/Camera/StreamPlayer'
export type { ImageProps as CameraImageProps } from './components/Camera/Image'

// Types
export type { 
  EntityState, 
  LightState, 
  LightAttributes,
  LightColorMode,
  LightCapabilities,
  LightTurnOnParams,
  ClimateState, 
  ClimateAttributes,
  SensorState, 
  SensorAttributes,
  BinarySensorState, 
  BinarySensorAttributes,
  TodoState,
  TodoAttributes,
  TodoItem,
  FanState, 
  FanAttributes,
  FanTurnOnParams,
  FanDirection,
  LockState,
  LockAttributes,
  NumberState,
  NumberAttributes,
  WeatherState,
  WeatherAttributes,
  WeatherCondition,
  VacuumState,
  VacuumAttributes,
  CalendarState,
  CalendarAttributes,
  CalendarEvent,
  SceneState,
  SceneAttributes,
  AlarmControlPanelState,
  AlarmControlPanelAttributes,
  DateTimeState,
  DateTimeAttributes,
  CurrentUser,
  HAConfig,
  HAConnection,
  HATransport,
  HATransportHandlers,
  ConnectionStatus,
  BaseEntityHook
} from './types'
export type {
  AuthState,
  AuthError,
  AuthConfig,
  StoredAuthData
} from './types/auth'
export type { SwitchState } from './hooks/useSwitch'
export type { CoverState } from './hooks/useCover'
export type { MediaPlayerState, MediaPlayerAttributes, MediaPlayerCapabilities, CameraState, CameraAttributes, CameraCapabilities, StreamState, StreamOptions, StreamType } from './types'

// Constants
export { LightFeatures, FanFeatures, ClimateFeatures, LockFeatures, TodoFeatures, MediaPlayerFeatures, CameraFeatures, VacuumFeatures, CalendarFeatures, AlarmControlPanelFeatures } from './types'

// Error handling
export type { ErrorRetryAction } from './utils/errors'
export {
  HomeAssistantError,
  FeatureNotSupportedError,
  InvalidParameterError,
  EntityNotAvailableError,
  ConnectionError,
  ServiceCallError,
  DomainMismatchError,
  isRetryableError,
  getUserFriendlyErrorMessage,
  ErrorCategory,
  categorizeError
} from './utils/errors'

// Store (for advanced usage)
export { useStore, selectEntity } from './services/entityStore'
