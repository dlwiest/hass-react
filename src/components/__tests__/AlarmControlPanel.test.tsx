import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AlarmControlPanel } from '../AlarmControlPanel'
import { useAlarmControlPanel } from '../../hooks/useAlarmControlPanel'
import type { AlarmControlPanelState } from '../../types'

vi.mock('../../hooks/useAlarmControlPanel')

const mockUseAlarmControlPanel = vi.mocked(useAlarmControlPanel)

const createAlarmState = (
  overrides: Partial<AlarmControlPanelState> = {}
): AlarmControlPanelState => ({
  entityId: 'alarm_control_panel.home',
  state: 'armed_away',
  attributes: { friendly_name: 'Home Alarm' },
  lastChanged: new Date('2026-08-10T12:00:00Z'),
  lastUpdated: new Date('2026-08-10T12:00:00Z'),
  isUnavailable: false,
  isConnected: true,
  refresh: vi.fn(),
  isDisarmed: false,
  isArmedHome: false,
  isArmedAway: true,
  isArmedNight: false,
  isArmedVacation: false,
  isArmedCustomBypass: false,
  isPending: false,
  isArming: false,
  isDisarming: false,
  isTriggered: false,
  changedBy: null,
  codeFormat: 'number',
  supportsArmHome: true,
  supportsArmAway: true,
  supportsArmNight: true,
  supportsArmVacation: true,
  supportsArmCustomBypass: true,
  supportsTrigger: true,
  disarm: vi.fn(),
  armHome: vi.fn(),
  armAway: vi.fn(),
  armNight: vi.fn(),
  armVacation: vi.fn(),
  armCustomBypass: vi.fn(),
  trigger: vi.fn(),
  ...overrides
})

describe('AlarmControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAlarmControlPanel.mockReturnValue(createAlarmState())
  })

  it('renders the alarm render prop', () => {
    render(
      <AlarmControlPanel entityId="alarm_control_panel.home">
        {alarm => <span>{alarm.isArmedAway ? 'Armed away' : 'Disarmed'}</span>}
      </AlarmControlPanel>
    )

    expect(screen.getByText('Armed away')).toBeInTheDocument()
    expect(mockUseAlarmControlPanel).toHaveBeenCalledWith('alarm_control_panel.home')
  })

  it('allows an unavailable alarm to render a fallback', () => {
    mockUseAlarmControlPanel.mockReturnValue(createAlarmState({
      state: 'unavailable',
      isUnavailable: true,
      isArmedAway: false,
      error: new Error('Alarm is unavailable')
    }))

    render(
      <AlarmControlPanel entityId="alarm_control_panel.home">
        {alarm => alarm.isUnavailable ? <span>Alarm unavailable</span> : <span>{alarm.state}</span>}
      </AlarmControlPanel>
    )

    expect(screen.getByText('Alarm unavailable')).toBeInTheDocument()
  })
})
