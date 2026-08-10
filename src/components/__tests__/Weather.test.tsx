import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Weather } from '../Weather'
import { useWeather } from '../../hooks/useWeather'
import type { WeatherState } from '../../types'

vi.mock('../../hooks/useWeather')

const mockUseWeather = vi.mocked(useWeather)

const createWeatherState = (overrides: Partial<WeatherState> = {}): WeatherState => ({
  entityId: 'weather.home',
  state: 'sunny',
  attributes: { temperature: 72, temperature_unit: '°F' },
  lastChanged: new Date('2026-08-10T12:00:00Z'),
  lastUpdated: new Date('2026-08-10T12:00:00Z'),
  isUnavailable: false,
  isConnected: true,
  refresh: vi.fn(),
  condition: 'sunny',
  temperature: 72,
  temperatureUnit: '°F',
  humidity: 45,
  pressure: 1013,
  pressureUnit: 'hPa',
  windSpeed: 5,
  windSpeedUnit: 'mph',
  windBearing: 180,
  visibility: 10,
  visibilityUnit: 'mi',
  cloudCoverage: 0,
  dewPoint: 48,
  apparentTemperature: 72,
  precipitationUnit: 'in',
  ...overrides
})

describe('Weather', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWeather.mockReturnValue(createWeatherState())
  })

  it('renders the weather render prop', () => {
    render(
      <Weather entityId="weather.home">
        {weather => <span>{weather.condition}: {weather.temperature}{weather.temperatureUnit}</span>}
      </Weather>
    )

    expect(screen.getByText('sunny: 72°F')).toBeInTheDocument()
    expect(mockUseWeather).toHaveBeenCalledWith('weather.home')
  })

  it('allows unavailable weather to render a fallback', () => {
    mockUseWeather.mockReturnValue(createWeatherState({
      state: 'unavailable',
      isUnavailable: true,
      temperature: null,
      error: new Error('Weather is unavailable')
    }))

    render(
      <Weather entityId="weather.home">
        {weather => weather.isUnavailable ? <span>Weather unavailable</span> : <span>{weather.condition}</span>}
      </Weather>
    )

    expect(screen.getByText('Weather unavailable')).toBeInTheDocument()
  })
})
