import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEntity } from './useEntity'
import { useHAConnection } from '../providers/HAProvider'
import type { CameraState, CameraAttributes, StreamState, StreamOptions } from '../types'
import { CameraFeatures } from '../types'
import { createDomainValidator } from '../utils/entityId'
import { checkFeatures } from '../utils/features'
import { FeatureNotSupportedError } from '../utils/errors'

const validateCameraEntityId = createDomainValidator('camera', 'useCamera')

export function useCamera(entityId: string): CameraState {
  const normalizedEntityId = validateCameraEntityId(entityId)
  const entity = useEntity<CameraAttributes>(normalizedEntityId)
  const { config, connection } = useHAConnection()
  const { attributes, state, callService } = entity
  const [imageRefreshKey, setImageRefreshKey] = useState(0)
  const hasWarnedExternalTransport = useRef(false)

  const warnExternalTransportSuppression = useCallback(() => {
    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV !== 'production' &&
      !hasWarnedExternalTransport.current
    ) {
      hasWarnedExternalTransport.current = true
      console.warn(
        '[useCamera] Direct camera image and MJPEG URLs are unavailable when using an external transport.'
      )
    }
  }, [])

  // Streaming state management
  const [streamState, setStreamState] = useState<StreamState>({
    isLoading: false,
    isActive: false,
    error: null,
    url: null,
    type: null
  })

  // Feature detection using bit flags
  const features = useMemo(() => {
    return checkFeatures(attributes.supported_features, {
      onOff: CameraFeatures.SUPPORT_ON_OFF,
      stream: CameraFeatures.SUPPORT_STREAM,
    })
  }, [attributes.supported_features])

  // State derivations
  const isOn = state !== 'off' && state !== 'unavailable' && state !== 'unknown'
  const isRecording = state === 'recording'
  const isStreaming = state === 'streaming' 
  const isIdle = state === 'idle'
  const motionDetectionEnabled = attributes.motion_detection ?? false
  const accessToken = attributes.access_token
  const usesExternalTransport = Boolean(config.transport)

  useEffect(() => {
    if (usesExternalTransport) {
      warnExternalTransportSuppression()
    }
  }, [usesExternalTransport, warnExternalTransportSuppression])

  // Generate camera image URL using the access token from entity attributes
  const imageUrl = useMemo(() => {
    if (usesExternalTransport || !accessToken || !config.url) {
      return null
    }

    // Convert WebSocket URL to HTTP URL if needed
    const httpUrl = config.url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://')
    const baseUrl = httpUrl.replace(/\/$/, '') // Remove trailing slash
    
    // Add cache-busting parameter to ensure fresh images
    return `${baseUrl}/api/camera_proxy/${normalizedEntityId}?token=${accessToken}&_cb=${imageRefreshKey}`
  }, [accessToken, config.url, normalizedEntityId, imageRefreshKey, usesExternalTransport])

  // Camera control actions
  const turnOn = useCallback(async () => {
    if (!features.onOff) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'turn on')
    }
    await callService('camera', 'turn_on')
  }, [callService, features.onOff, normalizedEntityId])

  const turnOff = useCallback(async () => {
    if (!features.onOff) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'turn off')
    }
    await callService('camera', 'turn_off')
  }, [callService, features.onOff, normalizedEntityId])

  const enableMotionDetection = useCallback(async () => {
    await callService('camera', 'enable_motion_detection')
  }, [callService])

  const disableMotionDetection = useCallback(async () => {
    await callService('camera', 'disable_motion_detection')
  }, [callService])

  const snapshot = useCallback(async (filename: string) => {
    await callService('camera', 'snapshot', { filename })
  }, [callService])

  const playStream = useCallback(async (mediaPlayer: string) => {
    if (!features.stream) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'streaming')
    }

    try {
      await callService('camera', 'play_stream', {
        media_player: mediaPlayer
      })
    } catch (error) {
      console.error('Play stream failed:', error)
      throw error
    }
  }, [callService, features.stream, normalizedEntityId])

  const record = useCallback(async (filename: string, duration?: number) => {
    await callService('camera', 'record', {
      filename,
      ...(duration !== undefined ? { duration } : {})
    })
  }, [callService])

  // Force refresh the camera image by updating the cache-busting key
  const refreshImage = useCallback(async () => {
    setImageRefreshKey(prev => prev + 1)
    // Also refresh entity state to get any updated access token
    await entity.refresh()
  }, [entity.refresh])

  // Get stream URL for different streaming types
  const getStreamUrl = useCallback(async (options: StreamOptions = {}): Promise<string | null> => {
    if (!connection) {
      throw new Error('No connection available')
    }

    if (!features.stream) {
      throw new FeatureNotSupportedError(normalizedEntityId, 'streaming')
    }

    const streamType = options.type || 'hls'
    
    try {
      if (streamType === 'hls') {
        // Request HLS stream URL via WebSocket
        const response = await connection.sendMessagePromise({
          type: 'camera/stream',
          entity_id: normalizedEntityId,
        }) as { url?: string }

        if (!response?.url) {
          throw new Error('No HLS stream URL received. The stream integration may not be configured in Home Assistant.')
        }
        
        // Convert relative URL to absolute URL
        const baseUrl = config.url?.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://').replace(/\/$/, '')
        return response.url.startsWith('/') ? `${baseUrl}${response.url}` : response.url
      }
      
      if (streamType === 'mjpeg') {
        // Use camera proxy stream for MJPEG
        if (usesExternalTransport) {
          warnExternalTransportSuppression()
          return null
        }
        if (!accessToken || !config.url) {
          return null
        }
        const baseUrl = config.url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://').replace(/\/$/, '')
        return `${baseUrl}/api/camera_proxy_stream/${normalizedEntityId}?token=${accessToken}`
      }
      
      if (streamType === 'webrtc') {
        // WebRTC requires more complex setup, return placeholder for now
        throw new Error('WebRTC streaming requires specialized setup - use HLS for now')
      }
      
      return null
    } catch (error) {
      console.error('Failed to get stream URL:', error)
      // Enhance error message for common issues
      if (error instanceof Error) {
        if (error.message.includes('invalid_format') || error.message.includes('extra keys')) {
          throw new Error('Camera streaming API error. Try MJPEG instead.')
        }
        if (streamType === 'hls' && (error.message.includes('not') || error.message.includes('No'))) {
          throw new Error('HLS streaming not available. The stream integration may not be configured. Try MJPEG instead.')
        }
      }
      throw error
    }
  }, [connection, features.stream, normalizedEntityId, accessToken, config.url, usesExternalTransport, warnExternalTransportSuppression])

  // Start streaming
  const startStream = useCallback(async (options: StreamOptions = {}) => {
    const streamType = options.type || 'hls'
    setStreamState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const streamUrl = await getStreamUrl(options)
      if (!streamUrl) {
        throw new Error('Failed to obtain stream URL')
      }

      setStreamState({
        isLoading: false,
        isActive: true,
        error: null,
        url: streamUrl,
        type: streamType
      })
    } catch (error) {
      const streamError = error instanceof Error ? error : new Error(String(error))
      setStreamState({
        isLoading: false,
        isActive: false,
        error: streamError,
        url: null,
        type: streamType  // Keep the type so we can retry
      })
    }
  }, [getStreamUrl])

  // Stop streaming
  const stopStream = useCallback(async () => {
    setStreamState({
      isLoading: false,
      isActive: false,
      error: null,
      url: null,
      type: null
    })
  }, [])

  // Retry streaming with last options
  const retryStream = useCallback(async () => {
    if (!streamState.type) {
      throw new Error('No previous stream to retry')
    }
    
    await startStream({ type: streamState.type })
  }, [startStream, streamState.type])

  return {
    ...entity,
    isOn,
    isRecording,
    isStreaming,
    isIdle,
    motionDetectionEnabled,
    imageUrl,
    streamState,
    accessToken,
    brand: attributes.brand,
    model: attributes.model,
    supportsOnOff: features.onOff,
    supportsStream: features.stream,
    turnOn,
    turnOff,
    enableMotionDetection,
    disableMotionDetection,
    snapshot,
    playStream,
    record,
    refreshImage,
    getStreamUrl,
    startStream,
    stopStream,
    retryStream,
  }
}