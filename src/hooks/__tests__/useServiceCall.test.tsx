import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useServiceCall } from '../useServiceCall'

// Mock HAProvider
const mockConnection = {
  sendMessagePromise: vi.fn()
}

const mockConfig = {
  url: 'http://localhost:8123',
  options: {
    serviceRetry: {
      maxAttempts: 3,
      baseDelay: 1000,
      exponentialBackoff: true,
      maxDelay: 10000
    }
  }
}

const mockUseHAConnection = vi.fn()

vi.mock('../../providers/HAProvider', () => ({
  useHAConnection: () => mockUseHAConnection()
}))

describe('useServiceCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseHAConnection.mockReturnValue({
      connection: mockConnection,
      config: mockConfig,
      connected: true
    })
  })

  describe('callService', () => {
    it('should call service with correct parameters', async () => {
      mockConnection.sendMessagePromise.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useServiceCall())

      await result.current.callService('light', 'turn_on', {
        entity_id: 'light.living_room',
        brightness: 255
      })

      await waitFor(() => {
        expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
          type: 'call_service',
          domain: 'light',
          service: 'turn_on',
          service_data: {
            entity_id: 'light.living_room',
            brightness: 255
          },
        })
      })
    })

    it('should call service without data', async () => {
      mockConnection.sendMessagePromise.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useServiceCall())

      await result.current.callService('homeassistant', 'restart')

      await waitFor(() => {
        expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
          type: 'call_service',
          domain: 'homeassistant',
          service: 'restart',
          service_data: {},
        })
      })
    })

    it('should throw ConnectionError when not connected', async () => {
      mockUseHAConnection.mockReturnValue({
        connection: null,
        config: mockConfig,
        connected: false
      })

      const { result } = renderHook(() => useServiceCall())

      await expect(
        result.current.callService('light', 'turn_on')
      ).rejects.toThrow('call light.turn_on')
    })

    it('should retry on failure', async () => {
      mockConnection.sendMessagePromise
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useServiceCall())

      await result.current.callService('light', 'turn_on', {
        entity_id: 'light.bedroom'
      })

      await waitFor(() => {
        expect(mockConnection.sendMessagePromise).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('callServiceWithResponse', () => {
    it('should call service and return response', async () => {
      // HA return_response envelopes include context plus payloads keyed by entity_id:
      // https://github.com/home-assistant/core/blob/dev/homeassistant/components/calendar/__init__.py
      const mockResponse = {
        context: { id: 'calendar-context' },
        response: {
          'calendar.shared': {
            events: [{ summary: 'Test Event' }]
          }
        }
      }
      mockConnection.sendMessagePromise.mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useServiceCall())

      const response = await result.current.callServiceWithResponse('calendar', 'get_events', {
        entity_id: 'calendar.shared',
        start_date_time: '2024-01-01T00:00:00',
        end_date_time: '2024-01-31T23:59:59'
      })

      expect(response).toEqual(mockResponse)
      expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
        type: 'call_service',
        domain: 'calendar',
        service: 'get_events',
        service_data: {
          entity_id: 'calendar.shared',
          start_date_time: '2024-01-01T00:00:00',
          end_date_time: '2024-01-31T23:59:59'
        },
        return_response: true,
      })
    })

    it('should call service with response without data', async () => {
      const mockResponse = { status: 'ok' }
      mockConnection.sendMessagePromise.mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useServiceCall())

      const response = await result.current.callServiceWithResponse('system_log', 'clear')

      expect(response).toEqual(mockResponse)
      expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
        type: 'call_service',
        domain: 'system_log',
        service: 'clear',
        service_data: {},
        return_response: true,
      })
    })

    it('should throw ConnectionError when not connected', async () => {
      mockUseHAConnection.mockReturnValue({
        connection: null,
        config: mockConfig,
        connected: false
      })

      const { result } = renderHook(() => useServiceCall())

      await expect(
        result.current.callServiceWithResponse('light', 'turn_on')
      ).rejects.toThrow('call light.turn_on')
    })

    it('should retry on failure and return response', async () => {
      const mockResponse = { result: 'success' }
      mockConnection.sendMessagePromise
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useServiceCall())

      const response = await result.current.callServiceWithResponse('notify', 'mobile_app', {
        message: 'Test notification'
      })

      expect(response).toEqual(mockResponse)
      await waitFor(() => {
        expect(mockConnection.sendMessagePromise).toHaveBeenCalledTimes(2)
      })
    })
  })
})
