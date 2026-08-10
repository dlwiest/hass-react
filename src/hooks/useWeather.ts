import { useEntity } from './useEntity'
import { createDomainValidator } from '../utils/entityId'
import type { WeatherState, WeatherAttributes, WeatherCondition } from '../types'

const validateWeatherEntityId = createDomainValidator('weather', 'useWeather')

export function useWeather(entityId: string): WeatherState {
  const normalizedEntityId = validateWeatherEntityId(entityId)
  const entity = useEntity<WeatherAttributes>(normalizedEntityId)
  const { attributes, state } = entity

  return {
    ...entity,
    condition: (state || 'unknown') as WeatherCondition | string,
    temperature: attributes.temperature ?? null,
    temperatureUnit: attributes.temperature_unit,
    humidity: attributes.humidity ?? null,
    pressure: attributes.pressure ?? null,
    pressureUnit: attributes.pressure_unit,
    windSpeed: attributes.wind_speed ?? null,
    windSpeedUnit: attributes.wind_speed_unit,
    windBearing: attributes.wind_bearing ?? null,
    visibility: attributes.visibility ?? null,
    visibilityUnit: attributes.visibility_unit,
    cloudCoverage: attributes.cloud_coverage ?? null,
    dewPoint: attributes.dew_point ?? null,
    apparentTemperature: attributes.apparent_temperature ?? null,
    precipitationUnit: attributes.precipitation_unit,
  }
}
