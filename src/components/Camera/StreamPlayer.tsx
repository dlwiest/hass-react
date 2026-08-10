import { useRef, useEffect, useState, CSSProperties } from 'react'
import type { StreamState } from '../../types'
import { Image } from './Image'

export interface StreamPlayerProps {
  stream: StreamState
  style?: CSSProperties
  className?: string
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  onError?: (error: Error) => void
}

export function StreamPlayer({
  stream,
  style,
  className,
  autoPlay = true,
  muted = true,
  controls = true,
  onError
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onErrorRef = useRef(onError)
  const [hasPlaybackError, setHasPlaybackError] = useState(false)

  onErrorRef.current = onError

  useEffect(() => {
    setHasPlaybackError(false)
  }, [stream.isActive, stream.url, stream.type])

  // Handle stream URL changes and playback
  useEffect(() => {
    if (
      !videoRef.current ||
      !stream.isActive ||
      !stream.url ||
      stream.type === 'mjpeg' ||
      hasPlaybackError
    ) {
      return
    }

    const video = videoRef.current
    const reportError = (error: unknown) => {
      const playbackError = error instanceof Error
        ? error
        : new Error('Camera stream playback failed')
      onErrorRef.current?.(playbackError)
    }
    const handleVideoError = () => {
      reportError(new Error(video.error?.message || 'Camera stream playback failed'))
      setHasPlaybackError(true)
    }
    const cleanup = () => {
      video.removeEventListener('error', handleVideoError)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener('error', handleVideoError)

    if (stream.type === 'hls') {
      if (!video.canPlayType('application/vnd.apple.mpegurl')) {
        const error = new Error('Native HLS playback is not supported in this browser')
        console.warn('HLS not natively supported. Consider adding hls.js library.')
        reportError(error)
        setHasPlaybackError(true)
        return cleanup
      }

      video.src = stream.url
      if (autoPlay) {
        video.play().catch(error => {
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }
          reportError(error)
        })
      }
    }

    return cleanup
  }, [autoPlay, hasPlaybackError, stream.isActive, stream.url, stream.type])

  if (!stream.isActive || !stream.url || hasPlaybackError) {
    return null
  }

  const defaultStyle: CSSProperties = {
    width: '100%',
    maxWidth: '640px',
    height: 'auto',
    backgroundColor: '#000',
    ...style
  }

  // Use img element for MJPEG streams (more efficient)
  if (stream.type === 'mjpeg') {
    return (
      <Image
        url={stream.url}
        alt="Camera stream"
        style={defaultStyle}
        className={className}
        onError={() => onErrorRef.current?.(new Error('MJPEG stream failed to load'))}
      />
    )
  }

  // Use video element for HLS and other streams
  return (
    <video
      ref={videoRef}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      style={defaultStyle}
      className={className}
    />
  )
}
