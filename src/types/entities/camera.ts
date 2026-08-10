import type { BaseEntityHook } from '../core'

// Camera types
export interface CameraAttributes {
  friendly_name?: string
  access_token?: string
  brand?: string
  model?: string
  motion_detection?: boolean
  entity_picture?: string
  supported_features?: number
}

export type StreamType = 'hls' | 'webrtc' | 'mjpeg'

export interface StreamState {
  isLoading: boolean
  isActive: boolean
  error: Error | null
  url: string | null
  type: StreamType | null
}

export interface StreamOptions {
  type?: StreamType
  lowLatency?: boolean
  fallback?: boolean
}

export interface CameraCapabilities {
  supportsOnOff: boolean
  supportsStream: boolean
}

export interface CameraStreamMethods {
  getStreamUrl: (options?: StreamOptions) => Promise<string | null>
  startStream: (options?: StreamOptions) => Promise<void>
  stopStream: () => Promise<void>
  retryStream: () => Promise<void>
}

export interface CameraState extends BaseEntityHook<CameraAttributes>, CameraCapabilities, CameraStreamMethods {
  isOn: boolean
  isRecording: boolean
  isStreaming: boolean
  isIdle: boolean
  motionDetectionEnabled: boolean
  imageUrl: string | null
  streamState: StreamState
  accessToken?: string
  brand?: string
  model?: string
  turnOn: () => Promise<void>
  turnOff: () => Promise<void>
  enableMotionDetection: () => Promise<void>
  disableMotionDetection: () => Promise<void>
  snapshot: (filename: string) => Promise<void>
  playStream: (mediaPlayer: string) => Promise<void>
  record: (filename: string, duration?: number) => Promise<void>
  refreshImage: () => Promise<void>
}

export const CameraFeatures = {
  SUPPORT_ON_OFF: 1,
  SUPPORT_STREAM: 2,
} as const
