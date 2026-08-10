import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CameraFeatures } from '../../types'
import { createMockEntity } from '../../test/utils'
import { FeatureNotSupportedError } from '../../utils/errors'

// Mock dependencies
vi.mock('../useEntity', () => ({
  useEntity: vi.fn()
}))

vi.mock('../../providers/HAProvider', () => ({
  useHAConnection: vi.fn()
}))

// Import after mocking
import { useCamera } from '../useCamera'
import { useEntity } from '../useEntity'
import { useHAConnection } from '../../providers/HAProvider'
import type { CameraAttributes } from '../../types'

// Helper to create mock camera entities
function createMockCameraEntity(
  entityName: string = 'test',
  state: string = 'idle', 
  attributes: Partial<CameraAttributes> = {}
) {
  const defaultAttributes = {
    friendly_name: `Test Camera ${entityName}`,
    access_token: 'mock-access-token-123',
  }
  
  // Merge attributes, allowing explicit undefined to override defaults
  const finalAttributes = { ...defaultAttributes }
  Object.keys(attributes).forEach(key => {
    finalAttributes[key] = attributes[key]
  })
  
  return createMockEntity<CameraAttributes>(
    `camera.${entityName}`, 
    state, 
    finalAttributes
  )
}

describe('useCamera', () => {
  const mockUseEntity = useEntity as any
  const mockUseHAConnection = useHAConnection as any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mocks
    mockUseEntity.mockReturnValue(createMockCameraEntity('test'))
    mockUseHAConnection.mockReturnValue({
      config: { url: 'http://homeassistant.local:8123' }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Feature Detection', () => {
    it('should detect on/off support correctly', () => {
      const attributes = {
        supported_features: CameraFeatures.SUPPORT_ON_OFF
      }
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.supportsOnOff).toBe(true)
      expect(result.current.supportsStream).toBe(false)
    })

    it('should detect stream support correctly', () => {
      const attributes = {
        supported_features: CameraFeatures.SUPPORT_STREAM
      }
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.supportsStream).toBe(true)
      expect(result.current.supportsOnOff).toBe(false)
    })

    it('should detect multiple features correctly', () => {
      const attributes = {
        supported_features: CameraFeatures.SUPPORT_ON_OFF | CameraFeatures.SUPPORT_STREAM
      }
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.supportsOnOff).toBe(true)
      expect(result.current.supportsStream).toBe(true)
    })

    it('should handle missing supported_features attribute', () => {
      const attributes = {} // No supported_features
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.supportsOnOff).toBe(false)
      expect(result.current.supportsStream).toBe(false)
    })
  })

  describe('State Derivations', () => {
    it('should determine isOn state correctly', () => {
      // Test different states
      const testCases = [
        { state: 'idle', expectedOn: true },
        { state: 'recording', expectedOn: true },
        { state: 'streaming', expectedOn: true },
        { state: 'off', expectedOn: false },
        { state: 'unavailable', expectedOn: false },
        { state: 'unknown', expectedOn: false }
      ]

      testCases.forEach(({ state, expectedOn }) => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', state))
        const { result } = renderHook(() => useCamera('camera.test'))
        expect(result.current.isOn).toBe(expectedOn)
      })
    })

    it('should determine camera states correctly', () => {
      // Test idle state
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle'))
      let { result } = renderHook(() => useCamera('camera.test'))
      expect(result.current.isIdle).toBe(true)
      expect(result.current.isRecording).toBe(false)
      expect(result.current.isStreaming).toBe(false)

      // Test recording state
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'recording'))
      result = renderHook(() => useCamera('camera.test')).result
      expect(result.current.isRecording).toBe(true)
      expect(result.current.isIdle).toBe(false)
      expect(result.current.isStreaming).toBe(false)

      // Test streaming state
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'streaming'))
      result = renderHook(() => useCamera('camera.test')).result
      expect(result.current.isStreaming).toBe(true)
      expect(result.current.isIdle).toBe(false)
      expect(result.current.isRecording).toBe(false)
    })

    it('should handle motion detection state correctly', () => {
      // Test motion detection enabled
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', { motion_detection: true }))
      let { result } = renderHook(() => useCamera('camera.test'))
      expect(result.current.motionDetectionEnabled).toBe(true)

      // Test motion detection disabled
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', { motion_detection: false }))
      result = renderHook(() => useCamera('camera.test')).result
      expect(result.current.motionDetectionEnabled).toBe(false)

      // Test missing motion_detection attribute (defaults to false)
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {}))
      result = renderHook(() => useCamera('camera.test')).result
      expect(result.current.motionDetectionEnabled).toBe(false)
    })

    it('should extract camera metadata correctly', () => {
      const attributes = {
        brand: 'Hikvision',
        model: 'DS-2CD2T47G1-L',
        access_token: 'secret-token-456'
      }
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.brand).toBe('Hikvision')
      expect(result.current.model).toBe('DS-2CD2T47G1-L')
      expect(result.current.accessToken).toBe('secret-token-456')
    })
  })

  describe('Image URL Generation', () => {
    it('should generate correct image URL with access token', () => {
      const attributes = {
        access_token: 'test-token-123'
      }
      mockUseEntity.mockReturnValue(createMockCameraEntity('basement_door', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.basement_door'))

      expect(result.current.imageUrl).toBe(
        'http://homeassistant.local:8123/api/camera_proxy/camera.basement_door?token=test-token-123&_cb=0'
      )
    })

    it('should handle different URL formats', () => {
      const testCases = [
        { configUrl: 'http://homeassistant.local:8123', expected: 'http://homeassistant.local:8123' },
        { configUrl: 'http://homeassistant.local:8123/', expected: 'http://homeassistant.local:8123' },
        { configUrl: 'https://my-hass.com', expected: 'https://my-hass.com' },
        { configUrl: 'ws://homeassistant.local:8123', expected: 'http://homeassistant.local:8123' },
        { configUrl: 'wss://my-hass.com', expected: 'https://my-hass.com' }
      ]

      testCases.forEach(({ configUrl, expected }) => {
        mockUseHAConnection.mockReturnValue({
          config: { url: configUrl }
        })
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', { access_token: 'token' }))

        const { result } = renderHook(() => useCamera('camera.test'))
        expect(result.current.imageUrl).toContain(expected)
      })
    })

    it('should return null when no access token', () => {
      const attributes = { access_token: undefined } // Explicitly no access token
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', attributes))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.imageUrl).toBeNull()
    })

    it('should not expose camera access tokens through external transports', () => {
      mockUseHAConnection.mockReturnValue({
        config: { url: 'https://dashboard.example.com', transport: {} }
      })
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
        access_token: 'must-not-reach-the-browser'
      }))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.imageUrl).toBeNull()
    })

    it('should return null when no config URL', () => {
      mockUseHAConnection.mockReturnValue({
        config: { url: null }
      })
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', { access_token: 'token' }))

      const { result } = renderHook(() => useCamera('camera.test'))

      expect(result.current.imageUrl).toBeNull()
    })

    it('should update cache-busting parameter on refresh', async () => {
      const mockRefresh = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { access_token: 'token' }),
        refresh: mockRefresh
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      const initialUrl = result.current.imageUrl
      expect(initialUrl).toContain('&_cb=0')

      await act(async () => {
        await result.current.refreshImage()
      })

      expect(result.current.imageUrl).toContain('&_cb=1')
      expect(result.current.imageUrl).not.toBe(initialUrl)
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe('Service Calls', () => {
    it('should call camera.turn_on service on turnOn()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'off', { supported_features: CameraFeatures.SUPPORT_ON_OFF }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.turnOn()
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'turn_on')
    })

    it('should call camera.turn_off service on turnOff()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { supported_features: CameraFeatures.SUPPORT_ON_OFF }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.turnOff()
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'turn_off')
    })

    it('should call camera.snapshot service on snapshot()', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.snapshot()
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'snapshot')
    })

    it('should call motion detection services correctly', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.enableMotionDetection()
      })
      expect(mockCallService).toHaveBeenCalledWith('camera', 'enable_motion_detection')

      await act(async () => {
        await result.current.disableMotionDetection()
      })
      expect(mockCallService).toHaveBeenCalledWith('camera', 'disable_motion_detection')
    })

    it('should call camera.play_stream service with media player', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { supported_features: CameraFeatures.SUPPORT_STREAM }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.playStream('media_player.living_room_tv')
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'play_stream', { 
        media_player: 'media_player.living_room_tv' 
      })
    })

    it('should call camera.play_stream service without parameters', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { supported_features: CameraFeatures.SUPPORT_STREAM }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.playStream()
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'play_stream', undefined)
    })

    it('should call camera.record service with parameters', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.record('recording.mp4', 30)
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'record', { 
        filename: 'recording.mp4',
        duration: 30
      })
    })

    it('should call camera.record service without parameters', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test'),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await act(async () => {
        await result.current.record()
      })

      expect(mockCallService).toHaveBeenCalledWith('camera', 'record', undefined)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when trying to turn on unsupported camera', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'off', { supported_features: 0 }), // No features supported
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await expect(
        act(async () => {
          await result.current.turnOn()
        })
      ).rejects.toThrow(FeatureNotSupportedError)

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to turn off unsupported camera', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await expect(
        act(async () => {
          await result.current.turnOff()
        })
      ).rejects.toThrow(FeatureNotSupportedError)

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should throw error when trying to play stream on unsupported camera', async () => {
      const mockCallService = vi.fn()
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { supported_features: 0 }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await expect(
        act(async () => {
          await result.current.playStream()
        })
      ).rejects.toThrow(FeatureNotSupportedError)

      expect(mockCallService).not.toHaveBeenCalled()
    })

    it('should handle service call failures', async () => {
      const mockCallService = vi.fn().mockRejectedValue(new Error('Service call failed'))
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { 
          supported_features: CameraFeatures.SUPPORT_ON_OFF | CameraFeatures.SUPPORT_STREAM
        }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await expect(result.current.turnOn()).rejects.toThrow('Service call failed')
      await expect(result.current.snapshot()).rejects.toThrow('Service call failed')
      await expect(result.current.enableMotionDetection()).rejects.toThrow('Service call failed')
    })

    it('should handle play stream failures gracefully', async () => {
      const mockCallService = vi.fn().mockRejectedValue(new Error('play_stream not supported'))
      mockUseEntity.mockReturnValue({
        ...createMockCameraEntity('test', 'idle', { supported_features: CameraFeatures.SUPPORT_STREAM }),
        callService: mockCallService
      })

      const { result } = renderHook(() => useCamera('camera.test'))

      await expect(result.current.playStream()).rejects.toThrow('Camera streaming not supported or media player required')
    })
  })

  describe('Domain Validation', () => {
    let consoleMock: any

    beforeEach(() => {
      consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleMock.mockRestore()
    })

    it('should warn when using wrong domain', () => {
      mockUseEntity.mockReturnValue(createMockCameraEntity('test'))

      renderHook(() => useCamera('light.bedroom_light'))

      expect(consoleMock).toHaveBeenCalledWith(
        'useCamera: Entity "light.bedroom_light" has domain "light" but expects "camera" domain. This may not work as expected. Use useEntity() or the appropriate domain-specific hook instead.'
      )
    })
  })

  describe('Integration and State Management', () => {
    it('should inherit all base entity properties', () => {
      const mockEntity = createMockCameraEntity('test', 'idle', { brand: 'TestBrand' })
      mockUseEntity.mockReturnValue(mockEntity)

      const { result } = renderHook(() => useCamera('camera.test'))

      // Should inherit all base properties
      expect(result.current.entityId).toBe(mockEntity.entityId)
      expect(result.current.state).toBe(mockEntity.state)
      expect(result.current.lastChanged).toBe(mockEntity.lastChanged)
      expect(result.current.lastUpdated).toBe(mockEntity.lastUpdated)
      expect(result.current.isUnavailable).toBe(mockEntity.isUnavailable)
      expect(result.current.isConnected).toBe(mockEntity.isConnected)
      expect(result.current.refresh).toBe(mockEntity.refresh)

      // Plus camera-specific properties
      expect(result.current.isOn).toBeDefined()
      expect(result.current.isRecording).toBeDefined()
      expect(result.current.isStreaming).toBeDefined()
      expect(result.current.isIdle).toBeDefined()
      expect(result.current.motionDetectionEnabled).toBeDefined()
      expect(result.current.supportsOnOff).toBeDefined()
      expect(result.current.supportsStream).toBeDefined()
      expect(result.current.turnOn).toBeDefined()
      expect(result.current.snapshot).toBeDefined()
      expect(result.current.refreshImage).toBeDefined()
    })

    it('should update when useEntity data changes', () => {
      // Start with camera idle
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', { motion_detection: false }))

      const { result, rerender } = renderHook(() => useCamera('camera.test'))

      expect(result.current.isIdle).toBe(true)
      expect(result.current.motionDetectionEnabled).toBe(false)

      // Update to recording with motion detection
      mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'recording', { motion_detection: true }))
      rerender()

      expect(result.current.isRecording).toBe(true)
      expect(result.current.isIdle).toBe(false)
      expect(result.current.motionDetectionEnabled).toBe(true)
    })

    it('should maintain callback references for performance', () => {
      const mockEntityWithFeatures = createMockCameraEntity('test', 'idle', {
        supported_features: CameraFeatures.SUPPORT_ON_OFF | CameraFeatures.SUPPORT_STREAM
      })
      mockUseEntity.mockReturnValue(mockEntityWithFeatures)

      const { result, rerender } = renderHook(() => useCamera('camera.test'))

      const firstCallbacks = {
        turnOn: result.current.turnOn,
        turnOff: result.current.turnOff,
        snapshot: result.current.snapshot,
        enableMotionDetection: result.current.enableMotionDetection,
        playStream: result.current.playStream,
        record: result.current.record,
        refreshImage: result.current.refreshImage
      }

      // Re-render with the same mock entity to ensure callbacks remain stable
      mockUseEntity.mockReturnValue(mockEntityWithFeatures)
      rerender()

      // Callbacks should be the same reference (useCallback working)
      expect(result.current.turnOn).toBe(firstCallbacks.turnOn)
      expect(result.current.turnOff).toBe(firstCallbacks.turnOff)
      expect(result.current.snapshot).toBe(firstCallbacks.snapshot)
      expect(result.current.enableMotionDetection).toBe(firstCallbacks.enableMotionDetection)
      expect(result.current.playStream).toBe(firstCallbacks.playStream)
      expect(result.current.record).toBe(firstCallbacks.record)
      expect(result.current.refreshImage).toBe(firstCallbacks.refreshImage)
    })
  })

  describe('Streaming Functionality', () => {
    const mockConnection = {
      sendMessagePromise: vi.fn()
    }

    beforeEach(() => {
      mockUseHAConnection.mockReturnValue({
        config: { url: 'http://homeassistant.local:8123' },
        connection: mockConnection
      })
    })

    describe('getStreamUrl', () => {
      it('should get HLS stream URL', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: '/api/hls/camera.test/playlist.m3u8'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        const url = await result.current.getStreamUrl({ type: 'hls' })

        expect(url).toContain('/api/hls/camera.test/playlist.m3u8')
        expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
          type: 'camera/stream',
          entity_id: 'camera.test'
        })
      })

      it('should get MJPEG stream URL', async () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM,
          access_token: 'test-token-123'
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        const url = await result.current.getStreamUrl({ type: 'mjpeg' })

        expect(url).toContain('/api/camera_proxy_stream/camera.test')
        expect(url).toContain('token=test-token-123')
      })

      it('should not construct tokenized MJPEG URLs for external transports', async () => {
        mockUseHAConnection.mockReturnValue({
          config: { url: 'https://dashboard.example.com', transport: {} },
          connection: mockConnection
        })
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM,
          access_token: 'must-not-reach-the-browser'
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await expect(result.current.getStreamUrl({ type: 'mjpeg' })).resolves.toBeNull()
      })

      it('should convert relative HLS URLs to absolute', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: '/api/hls/camera.test/playlist.m3u8'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        const url = await result.current.getStreamUrl({ type: 'hls' })

        expect(url).toBe('http://homeassistant.local:8123/api/hls/camera.test/playlist.m3u8')
      })

      it('should handle absolute HLS URLs', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: 'https://external.com/stream/playlist.m3u8'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        const url = await result.current.getStreamUrl({ type: 'hls' })

        expect(url).toBe('https://external.com/stream/playlist.m3u8')
      })

      it('should throw error for WebRTC', async () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await expect(
          result.current.getStreamUrl({ type: 'webrtc' })
        ).rejects.toThrow('WebRTC streaming requires specialized setup')
      })

      it('should throw error when stream support is missing', async () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: 0
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await expect(
          result.current.getStreamUrl({ type: 'hls' })
        ).rejects.toThrow(FeatureNotSupportedError)
      })

      it('should throw error when no connection available', async () => {
        mockUseHAConnection.mockReturnValue({
          config: { url: 'http://homeassistant.local:8123' },
          connection: null
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await expect(
          result.current.getStreamUrl({ type: 'hls' })
        ).rejects.toThrow('No connection available')
      })
    })

    describe('startStream', () => {
      it('should start HLS stream successfully', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: '/api/hls/camera.test/playlist.m3u8'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await act(async () => {
          await result.current.startStream({ type: 'hls' })
        })

        expect(result.current.streamState.isActive).toBe(true)
        expect(result.current.streamState.type).toBe('hls')
        expect(result.current.streamState.url).toContain('/api/hls/camera.test')
        expect(result.current.streamState.error).toBeNull()
        expect(result.current.streamState.isLoading).toBe(false)
      })

      it('should start MJPEG stream successfully', async () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM,
          access_token: 'test-token-123'
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await act(async () => {
          await result.current.startStream({ type: 'mjpeg' })
        })

        expect(result.current.streamState.isActive).toBe(true)
        expect(result.current.streamState.type).toBe('mjpeg')
        expect(result.current.streamState.url).toContain('/api/camera_proxy_stream/camera.test')
      })

      it('should set loading state while starting', async () => {
        let resolveStream: any
        const streamPromise = new Promise(resolve => {
          resolveStream = resolve
        })

        mockConnection.sendMessagePromise.mockReturnValue(streamPromise)

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        let startPromise: Promise<void>
        act(() => {
          startPromise = result.current.startStream({ type: 'hls' })
        })

        // Should be loading
        expect(result.current.streamState.isLoading).toBe(true)
        expect(result.current.streamState.isActive).toBe(false)

        // Resolve the stream
        act(() => {
          resolveStream({ url: '/stream' })
        })

        await act(async () => {
          await startPromise!
        })

        // Should be active now
        expect(result.current.streamState.isLoading).toBe(false)
        expect(result.current.streamState.isActive).toBe(true)
      })

      it('should handle stream errors', async () => {
        const error = new Error('Stream not available')
        mockConnection.sendMessagePromise.mockRejectedValue(error)

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        let caughtError: any
        try {
          await act(async () => {
            await result.current.startStream({ type: 'hls' })
          })
        } catch (e) {
          caughtError = e
        }

        expect(caughtError).toBeTruthy()
        // Error message is enhanced by our error handling
        expect(caughtError.message).toContain('streaming')
        expect(result.current.streamState.isActive).toBe(false)
        expect(result.current.streamState.isLoading).toBe(false)
      })

      it('should default to HLS when type not specified', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: '/stream'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await act(async () => {
          await result.current.startStream()
        })

        expect(mockConnection.sendMessagePromise).toHaveBeenCalledWith({
          type: 'camera/stream',
          entity_id: 'camera.test'
        })
      })
    })

    describe('stopStream', () => {
      it('should stop active stream', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: '/stream'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        // Start stream
        await act(async () => {
          await result.current.startStream({ type: 'hls' })
        })

        expect(result.current.streamState.isActive).toBe(true)

        // Stop stream
        await act(async () => {
          await result.current.stopStream()
        })

        expect(result.current.streamState.isActive).toBe(false)
        expect(result.current.streamState.url).toBeNull()
        expect(result.current.streamState.type).toBeNull()
        expect(result.current.streamState.error).toBeNull()
      })

      it('should be safe to call when no stream is active', async () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await act(async () => {
          await result.current.stopStream()
        })

        expect(result.current.streamState.isActive).toBe(false)
      })
    })

    describe('retryStream', () => {
      it('should retry with previous stream type', async () => {
        mockConnection.sendMessagePromise
          .mockRejectedValueOnce(new Error('First attempt failed'))
          .mockResolvedValueOnce({ url: '/stream' })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        // First attempt fails
        try {
          await act(async () => {
            await result.current.startStream({ type: 'hls' })
          })
        } catch (e) {
          // Expected to throw
        }

        // Second attempt should work
        await act(async () => {
          await result.current.startStream({ type: 'hls' })
        })

        expect(result.current.streamState.isActive).toBe(true)
        expect(result.current.streamState.type).toBe('hls')
        expect(result.current.streamState.error).toBeNull()
      })

      it('should throw error when no previous stream to retry', async () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await expect(async () => {
          await act(async () => {
            await result.current.retryStream()
          })
        }).rejects.toThrow('No previous stream to retry')
      })
    })

    describe('streamState management', () => {
      it('should initialize with default state', () => {
        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle'))

        const { result } = renderHook(() => useCamera('camera.test'))

        expect(result.current.streamState).toEqual({
          isLoading: false,
          isActive: false,
          error: null,
          url: null,
          type: null
        })
      })

      it('should maintain separate state from entity state', async () => {
        mockConnection.sendMessagePromise.mockResolvedValue({
          url: '/stream'
        })

        mockUseEntity.mockReturnValue(createMockCameraEntity('test', 'idle', {
          supported_features: CameraFeatures.SUPPORT_STREAM
        }))

        const { result } = renderHook(() => useCamera('camera.test'))

        await act(async () => {
          await result.current.startStream({ type: 'hls' })
        })

        expect(result.current.state).toBe('idle')  // Entity state unchanged
        expect(result.current.streamState.isActive).toBe(true)  // Stream state changed
      })
    })
  })
})