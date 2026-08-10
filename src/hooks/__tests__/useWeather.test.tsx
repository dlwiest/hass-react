import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWeather } from '../useWeather'
import { useEntity } from '../useEntity'
import type { WeatherCondition } from '../../types'

// Mock useEntity since useWeather depends on it
vi.mock('../useEntity')

// Mock weather entity response
const createMockWeatherEntity = (
  state: string = 'sunny',
  attributes: Record<string, any> = {}
) => ({
  entityId: 'weather.test',
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

describe('useWeather', () => {
  const mockUseEntity = useEntity as any

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock for useEntity
    mockUseEntity.mockReturnValue(createMockWeatherEntity())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Entity ID Validation', () => {
    it('should warn when using wrong domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useWeather('sensor.temperature'))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('useWeather: Entity "sensor.temperature" has domain "sensor" but expects "weather" domain')
      )

      consoleSpy.mockRestore()
    })

    it('should accept entity ID with weather domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useWeather('weather.home'))

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should auto-prefix entity ID without domain', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useWeather('home'))

      expect(mockUseEntity).toHaveBeenCalledWith('weather.home')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Basic Weather Properties', () => {
    it('should return current weather condition', () => {
      const attributes = {
        temperature: 22.5,
        temperature_unit: '°C',
        humidity: 65,
        pressure: 1013.25,
        pressure_unit: 'hPa'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('sunny')
      expect(result.current.temperature).toBe(22.5)
      expect(result.current.temperatureUnit).toBe('°C')
      expect(result.current.humidity).toBe(65)
      expect(result.current.pressure).toBe(1013.25)
      expect(result.current.pressureUnit).toBe('hPa')
    })

    it('should handle different weather conditions', () => {
      const conditions: WeatherCondition[] = [
        'clear-night',
        'cloudy',
        'fog',
        'hail',
        'lightning',
        'lightning-rainy',
        'partlycloudy',
        'pouring',
        'rainy',
        'snowy',
        'snowy-rainy',
        'sunny',
        'windy',
        'windy-variant'
      ]

      conditions.forEach(condition => {
        mockUseEntity.mockReturnValue(createMockWeatherEntity(condition))

        const { result } = renderHook(() => useWeather('weather.test'))

        expect(result.current.condition).toBe(condition)
      })
    })

    it('should handle exceptional weather condition', () => {
      mockUseEntity.mockReturnValue(createMockWeatherEntity('exceptional'))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('exceptional')
    })

    it('should handle unknown weather condition', () => {
      mockUseEntity.mockReturnValue(createMockWeatherEntity('unknown'))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('unknown')
    })

    it('should handle custom weather condition strings', () => {
      mockUseEntity.mockReturnValue(createMockWeatherEntity('custom-condition'))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('custom-condition')
    })
  })

  describe('Temperature Handling', () => {
    it('should return temperature in Celsius', () => {
      const attributes = {
        temperature: 18.7,
        temperature_unit: '°C'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('cloudy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperature).toBe(18.7)
      expect(result.current.temperatureUnit).toBe('°C')
    })

    it('should return temperature in Fahrenheit', () => {
      const attributes = {
        temperature: 75.2,
        temperature_unit: '°F'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperature).toBe(75.2)
      expect(result.current.temperatureUnit).toBe('°F')
    })

    it('should handle negative temperatures', () => {
      const attributes = {
        temperature: -15.3,
        temperature_unit: '°C'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('snowy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperature).toBe(-15.3)
    })

    it('should handle zero temperature', () => {
      const attributes = {
        temperature: 0,
        temperature_unit: '°C'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('snowy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperature).toBe(0)
    })

    it('should return null for missing temperature', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperature).toBeNull()
    })

    it('should leave temperature unit undefined when not specified', () => {
      const attributes = {
        temperature: 72.5
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperatureUnit).toBeUndefined()
    })

    it('should handle apparent temperature', () => {
      const attributes = {
        temperature: 25,
        apparent_temperature: 28.5,
        temperature_unit: '°C'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.temperature).toBe(25)
      expect(result.current.apparentTemperature).toBe(28.5)
    })
  })

  describe('Wind Handling', () => {
    it('should return wind speed and bearing', () => {
      const attributes = {
        wind_speed: 15.5,
        wind_speed_unit: 'km/h',
        wind_bearing: 180
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('windy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.windSpeed).toBe(15.5)
      expect(result.current.windSpeedUnit).toBe('km/h')
      expect(result.current.windBearing).toBe(180)
    })

    it('should handle wind speed in different units', () => {
      const attributes = {
        wind_speed: 10.5,
        wind_speed_unit: 'm/s'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('windy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.windSpeed).toBe(10.5)
      expect(result.current.windSpeedUnit).toBe('m/s')
    })

    it('should handle wind speed in mph', () => {
      const attributes = {
        wind_speed: 25,
        wind_speed_unit: 'mph'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('windy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.windSpeed).toBe(25)
      expect(result.current.windSpeedUnit).toBe('mph')
    })

    it('should leave wind speed unit undefined when not specified', () => {
      const attributes = {
        wind_speed: 12.3
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('windy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.windSpeedUnit).toBeUndefined()
    })

    it('should handle missing wind data', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.windSpeed).toBeNull()
      expect(result.current.windBearing).toBeNull()
    })

    it('should handle wind bearing directions correctly', () => {
      // Test all cardinal directions
      const bearings = [0, 90, 180, 270, 360]

      bearings.forEach(bearing => {
        const attributes = {
          wind_speed: 10,
          wind_bearing: bearing
        }
        mockUseEntity.mockReturnValue(createMockWeatherEntity('windy', attributes))

        const { result } = renderHook(() => useWeather('weather.test'))

        expect(result.current.windBearing).toBe(bearing)
      })
    })
  })

  describe('Pressure and Humidity', () => {
    it('should return pressure with unit', () => {
      const attributes = {
        pressure: 1013.25,
        pressure_unit: 'hPa'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.pressure).toBe(1013.25)
      expect(result.current.pressureUnit).toBe('hPa')
    })

    it('should handle pressure in different units', () => {
      const attributes = {
        pressure: 29.92,
        pressure_unit: 'inHg'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.pressure).toBe(29.92)
      expect(result.current.pressureUnit).toBe('inHg')
    })

    it('should leave pressure unit undefined when not specified', () => {
      const attributes = {
        pressure: 29.92
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.pressureUnit).toBeUndefined()
    })

    it('should return humidity percentage', () => {
      const attributes = {
        humidity: 65
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('rainy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.humidity).toBe(65)
    })

    it('should handle extreme humidity values', () => {
      const attributes = {
        humidity: 100
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('fog', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.humidity).toBe(100)
    })

    it('should handle low humidity values', () => {
      const attributes = {
        humidity: 10
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.humidity).toBe(10)
    })
  })

  describe('Additional Weather Attributes', () => {
    it('should return visibility with unit', () => {
      const attributes = {
        visibility: 10,
        visibility_unit: 'km'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.visibility).toBe(10)
      expect(result.current.visibilityUnit).toBe('km')
    })

    it('should handle visibility in miles', () => {
      const attributes = {
        visibility: 6.2,
        visibility_unit: 'mi'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('cloudy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.visibility).toBe(6.2)
      expect(result.current.visibilityUnit).toBe('mi')
    })

    it('should leave visibility unit undefined when not specified', () => {
      const attributes = {
        visibility: 10
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.visibilityUnit).toBeUndefined()
    })

    it('should return cloud coverage percentage', () => {
      const attributes = {
        cloud_coverage: 75
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('cloudy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.cloudCoverage).toBe(75)
    })

    it('should return dew point', () => {
      const attributes = {
        temperature: 22,
        dew_point: 14.5,
        temperature_unit: '°C'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.dewPoint).toBe(14.5)
    })

    it('should handle precipitation unit', () => {
      const attributes = {
        precipitation_unit: 'mm'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('rainy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.precipitationUnit).toBe('mm')
    })

    it('should leave precipitation unit undefined when not specified', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockWeatherEntity('rainy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.precipitationUnit).toBeUndefined()
    })

    it('should handle precipitation unit in inches', () => {
      const attributes = {
        precipitation_unit: 'in'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('rainy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.precipitationUnit).toBe('in')
    })
  })

  describe('Complete Weather Data', () => {
    it('should handle weather entity with all attributes', () => {
      const attributes = {
        temperature: 22.5,
        temperature_unit: '°C',
        humidity: 65,
        pressure: 1013.25,
        pressure_unit: 'hPa',
        wind_speed: 15.5,
        wind_speed_unit: 'km/h',
        wind_bearing: 180,
        visibility: 10,
        visibility_unit: 'km',
        cloud_coverage: 50,
        dew_point: 14.2,
        apparent_temperature: 24.1,
        precipitation_unit: 'mm',
        friendly_name: 'Home Weather'
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('partlycloudy', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('partlycloudy')
      expect(result.current.temperature).toBe(22.5)
      expect(result.current.temperatureUnit).toBe('°C')
      expect(result.current.humidity).toBe(65)
      expect(result.current.pressure).toBe(1013.25)
      expect(result.current.pressureUnit).toBe('hPa')
      expect(result.current.windSpeed).toBe(15.5)
      expect(result.current.windSpeedUnit).toBe('km/h')
      expect(result.current.windBearing).toBe(180)
      expect(result.current.visibility).toBe(10)
      expect(result.current.visibilityUnit).toBe('km')
      expect(result.current.cloudCoverage).toBe(50)
      expect(result.current.dewPoint).toBe(14.2)
      expect(result.current.apparentTemperature).toBe(24.1)
      expect(result.current.precipitationUnit).toBe('mm')
    })

    it('should handle weather entity with minimal attributes', () => {
      const attributes = {
        temperature: 68
      }
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('sunny')
      expect(result.current.temperature).toBe(68)
      expect(result.current.temperatureUnit).toBeUndefined()
      expect(result.current.humidity).toBeNull()
      expect(result.current.pressure).toBeNull()
      expect(result.current.windSpeed).toBeNull()
    })

    it('should handle completely empty attributes without invented units', () => {
      const attributes = {}
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', attributes))

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('sunny')
      expect(result.current.temperature).toBeNull()
      expect(result.current.temperatureUnit).toBeUndefined()
      expect(result.current.humidity).toBeNull()
      expect(result.current.pressure).toBeNull()
      expect(result.current.pressureUnit).toBeUndefined()
      expect(result.current.windSpeed).toBeNull()
      expect(result.current.windSpeedUnit).toBeUndefined()
      expect(result.current.visibility).toBeNull()
      expect(result.current.visibilityUnit).toBeUndefined()
      expect(result.current.precipitationUnit).toBeUndefined()
    })
  })

  describe('Integration with useEntity', () => {
    it('should pass entityId to useEntity', () => {
      const entityId = 'weather.home'

      renderHook(() => useWeather(entityId))

      expect(mockUseEntity).toHaveBeenCalledWith(entityId)
    })

    it('should normalize entity ID without domain', () => {
      const entityId = 'home'

      renderHook(() => useWeather(entityId))

      expect(mockUseEntity).toHaveBeenCalledWith('weather.home')
    })

    it('should not modify entity ID with domain', () => {
      const entityId = 'weather.backyard'

      renderHook(() => useWeather(entityId))

      expect(mockUseEntity).toHaveBeenCalledWith('weather.backyard')
    })

    it('should inherit all base entity properties', () => {
      const mockEntity = createMockWeatherEntity('sunny', {
        temperature: 22.5,
        temperature_unit: '°C'
      })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useWeather('weather.test'))

      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.attributes).toBe(mockEntity.attributes)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)
    })

    it('should update when useEntity data changes', () => {
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', {
        temperature: 22.5
      }))

      const { result, rerender } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('sunny')
      expect(result.current.temperature).toBe(22.5)

      mockUseEntity.mockReturnValue(createMockWeatherEntity('rainy', {
        temperature: 18.2
      }))
      rerender()

      expect(result.current.condition).toBe('rainy')
      expect(result.current.temperature).toBe(18.2)
    })

    it('should handle state changes between different conditions', () => {
      mockUseEntity.mockReturnValue(createMockWeatherEntity('sunny', {
        temperature: 25
      }))

      const { result, rerender } = renderHook(() => useWeather('weather.test'))

      expect(result.current.condition).toBe('sunny')

      mockUseEntity.mockReturnValue(createMockWeatherEntity('snowy', {
        temperature: -5
      }))
      rerender()

      expect(result.current.condition).toBe('snowy')
      expect(result.current.temperature).toBe(-5)
    })
  })
})
