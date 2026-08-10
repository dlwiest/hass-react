import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Vacuum } from '../Vacuum'
import { useVacuum } from '../../hooks/useVacuum'
import type { VacuumState } from '../../types'

vi.mock('../../hooks/useVacuum')

const mockUseVacuum = vi.mocked(useVacuum)

const createVacuumState = (overrides: Partial<VacuumState> = {}): VacuumState => ({
  entityId: 'vacuum.downstairs',
  state: 'cleaning',
  attributes: { battery_level: 82, fan_speed: 'standard' },
  lastChanged: new Date('2026-08-10T12:00:00Z'),
  lastUpdated: new Date('2026-08-10T12:00:00Z'),
  isUnavailable: false,
  isConnected: true,
  refresh: vi.fn(),
  batteryLevel: 82,
  fanSpeed: 'standard',
  status: 'Cleaning',
  availableFanSpeeds: ['quiet', 'standard', 'turbo'],
  isCharging: false,
  isDocked: false,
  isCleaning: true,
  isReturning: false,
  isIdle: false,
  isError: false,
  supportsTurnOn: true,
  supportsTurnOff: true,
  supportsPause: true,
  supportsStop: true,
  supportsReturnHome: true,
  supportsFanSpeed: true,
  supportsLocate: true,
  supportsCleanSpot: true,
  supportsStart: true,
  start: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  returnToBase: vi.fn(),
  locate: vi.fn(),
  cleanSpot: vi.fn(),
  setFanSpeed: vi.fn(),
  sendCommand: vi.fn(),
  ...overrides
})

describe('Vacuum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseVacuum.mockReturnValue(createVacuumState())
  })

  it('renders the vacuum render prop', () => {
    render(
      <Vacuum entityId="vacuum.downstairs">
        {vacuum => <span>{vacuum.isCleaning ? 'Cleaning' : 'Idle'} at {vacuum.batteryLevel}%</span>}
      </Vacuum>
    )

    expect(screen.getByText('Cleaning at 82%')).toBeInTheDocument()
    expect(mockUseVacuum).toHaveBeenCalledWith('vacuum.downstairs')
  })

  it('allows an unavailable vacuum to render a fallback', () => {
    mockUseVacuum.mockReturnValue(createVacuumState({
      state: 'unavailable',
      isUnavailable: true,
      isCleaning: false,
      error: new Error('Vacuum is unavailable')
    }))

    render(
      <Vacuum entityId="vacuum.downstairs">
        {vacuum => vacuum.isUnavailable ? <span>Vacuum unavailable</span> : <span>{vacuum.state}</span>}
      </Vacuum>
    )

    expect(screen.getByText('Vacuum unavailable')).toBeInTheDocument()
  })
})
