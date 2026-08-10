import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Number } from '../Number'
import { useNumber } from '../../hooks/useNumber'
import type { NumberState } from '../../types'

vi.mock('../../hooks/useNumber')

const mockUseNumber = vi.mocked(useNumber)

const createNumberState = (overrides: Partial<NumberState> = {}): NumberState => ({
  entityId: 'number.target_temperature',
  state: '21.5',
  attributes: { min: 10, max: 30, step: 0.5, unit_of_measurement: '°C' },
  lastChanged: new Date('2026-08-10T12:00:00Z'),
  lastUpdated: new Date('2026-08-10T12:00:00Z'),
  isUnavailable: false,
  isConnected: true,
  refresh: vi.fn(),
  value: 21.5,
  min: 10,
  max: 30,
  step: 0.5,
  mode: 'slider',
  unit: '°C',
  deviceClass: 'temperature',
  setValue: vi.fn(),
  increment: vi.fn(),
  decrement: vi.fn(),
  ...overrides
})

describe('Number', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNumber.mockReturnValue(createNumberState())
  })

  it('renders the number render prop', () => {
    render(
      <Number entityId="number.target_temperature">
        {number => <span>{number.value}{number.unit}</span>}
      </Number>
    )

    expect(screen.getByText('21.5°C')).toBeInTheDocument()
    expect(mockUseNumber).toHaveBeenCalledWith('number.target_temperature')
  })

  it('allows an unavailable number to render a fallback', () => {
    mockUseNumber.mockReturnValue(createNumberState({
      state: 'unavailable',
      isUnavailable: true,
      error: new Error('Number is unavailable')
    }))

    render(
      <Number entityId="number.target_temperature">
        {number => number.isUnavailable ? <span>Number unavailable</span> : <span>{number.value}</span>}
      </Number>
    )

    expect(screen.getByText('Number unavailable')).toBeInTheDocument()
  })
})
