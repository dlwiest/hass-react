import type { BaseEntityHook } from '../core'

// Weather types
export type WeatherCondition =
  | 'clear-night'
  | 'cloudy'
  | 'exceptional'
  | 'fog'
  | 'hail'
  | 'lightning'
  | 'lightning-rainy'
  | 'partlycloudy'
  | 'pouring'
  | 'rainy'
  | 'snowy'
  | 'snowy-rainy'
  | 'sunny'
  | 'windy'
  | 'windy-variant'

export interface WeatherAttributes {
  friendly_name?: string
  temperature?: number
  temperature_unit?: string
  humidity?: number
  pressure?: number
  pressure_unit?: string
  wind_speed?: number
  wind_speed_unit?: string
  wind_bearing?: number
  visibility?: number
  visibility_unit?: string
  cloud_coverage?: number
  dew_point?: number
  apparent_temperature?: number
  precipitation_unit?: string
  supported_features?: number
}

export interface WeatherState extends BaseEntityHook<WeatherAttributes> {
  condition: WeatherCondition | string
  temperature: number | null
  temperatureUnit?: string
  humidity: number | null
  pressure: number | null
  pressureUnit?: string
  windSpeed: number | null
  windSpeedUnit?: string
  windBearing: number | null
  visibility: number | null
  visibilityUnit?: string
  cloudCoverage: number | null
  dewPoint: number | null
  apparentTemperature: number | null
  precipitationUnit?: string
}
