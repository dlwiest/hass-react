import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StreamPlayer } from '../StreamPlayer'
import type { StreamState } from '../../../types'

describe('Camera.StreamPlayer', () => {
  const mockVideoPlay = vi.fn()
  const mockVideoPause = vi.fn()
  const mockVideoLoad = vi.fn()

  beforeEach(() => {
    // Mock HTMLVideoElement methods
    mockVideoPlay.mockReset().mockResolvedValue(undefined)
    mockVideoPause.mockReset()
    mockVideoLoad.mockReset()
    // Mock canPlayType
    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      value: mockVideoPlay,
      writable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
      value: mockVideoPause,
      writable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'load', {
      value: mockVideoLoad,
      writable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'canPlayType', {
      value: vi.fn().mockReturnValue('probably'),
      writable: true
    })

    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should return null when stream is not active', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: false,
        error: null,
        url: null,
        type: null
      }

      const { container } = render(<StreamPlayer stream={streamState} />)
      expect(container.firstChild).toBeNull()
    })

    it('should return null when stream has no URL', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: null,
        type: 'hls'
      }

      const { container } = render(<StreamPlayer stream={streamState} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render video element for HLS stream', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      render(<StreamPlayer stream={streamState} />)

      const video = document.querySelector('video') as HTMLVideoElement
      expect(video).toBeInTheDocument()
      expect(video.controls).toBe(true)
      expect(video.autoplay).toBe(true)
      expect(video.muted).toBe(true)
    })

    it('should render img element for MJPEG stream', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.mjpeg',
        type: 'mjpeg'
      }

      render(<StreamPlayer stream={streamState} />)

      const img = document.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'http://example.com/stream.mjpeg')
      expect(img).toHaveAttribute('alt', 'Camera stream')
    })
  })

  describe('Props', () => {
    it('should apply className', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      render(<StreamPlayer stream={streamState} className="custom-stream-player" />)

      const video = document.querySelector('video')
      expect(video).toHaveClass('custom-stream-player')
    })

    it('should not play when autoPlay is false', async () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { rerender } = render(<StreamPlayer stream={streamState} autoPlay={false} />)

      let video = document.querySelector('video') as HTMLVideoElement
      expect(video.autoplay).toBe(false)
      expect(mockVideoPlay).not.toHaveBeenCalled()

      rerender(<StreamPlayer stream={streamState} autoPlay={true} />)
      video = document.querySelector('video') as HTMLVideoElement
      expect(video.autoplay).toBe(true)
      await waitFor(() => expect(mockVideoPlay).toHaveBeenCalledTimes(1))
    })

    it('should respect muted prop', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { rerender } = render(<StreamPlayer stream={streamState} muted={false} />)

      let video = document.querySelector('video') as HTMLVideoElement
      expect(video.muted).toBe(false)

      rerender(<StreamPlayer stream={streamState} muted={true} />)
      video = document.querySelector('video') as HTMLVideoElement
      expect(video.muted).toBe(true)
    })

    it('should respect controls prop', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { rerender } = render(<StreamPlayer stream={streamState} controls={false} />)

      let video = document.querySelector('video') as HTMLVideoElement
      expect(video.controls).toBe(false)

      rerender(<StreamPlayer stream={streamState} controls={true} />)
      video = document.querySelector('video') as HTMLVideoElement
      expect(video.controls).toBe(true)
    })
  })

  describe('Stream Management', () => {
    it('should update video src when stream URL changes', async () => {
      const initialStream: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream1.m3u8',
        type: 'hls'
      }

      const { rerender } = render(<StreamPlayer stream={initialStream} />)

      await waitFor(() => {
        const video = document.querySelector('video') as HTMLVideoElement
        expect(video.src).toContain('stream1.m3u8')
      })

      const updatedStream: StreamState = {
        ...initialStream,
        url: 'http://example.com/stream2.m3u8'
      }

      rerender(<StreamPlayer stream={updatedStream} />)

      await waitFor(() => {
        const video = document.querySelector('video') as HTMLVideoElement
        expect(video.src).toContain('stream2.m3u8')
      })
    })

    it('should tear down video when stream becomes inactive', async () => {
      const activeStream: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { rerender, container } = render(<StreamPlayer stream={activeStream} />)
      const video = document.querySelector('video') as HTMLVideoElement

      await waitFor(() => expect(video).toHaveAttribute('src', activeStream.url))

      const inactiveStream: StreamState = {
        isLoading: false,
        isActive: false,
        error: null,
        url: null,
        type: null
      }

      rerender(<StreamPlayer stream={inactiveStream} />)

      expect(container.firstChild).toBeNull()
      expect(mockVideoPause).toHaveBeenCalledTimes(1)
      expect(video).not.toHaveAttribute('src')
      expect(mockVideoLoad).toHaveBeenCalledTimes(1)
    })

    it('should tear down video on unmount', async () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { unmount } = render(<StreamPlayer stream={streamState} />)
      const video = document.querySelector('video') as HTMLVideoElement
      await waitFor(() => expect(video).toHaveAttribute('src', streamState.url))

      unmount()

      expect(mockVideoPause).toHaveBeenCalledTimes(1)
      expect(video).not.toHaveAttribute('src')
      expect(mockVideoLoad).toHaveBeenCalledTimes(1)
    })

    it('should handle stream type changes', () => {
      const hlsStream: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { rerender } = render(<StreamPlayer stream={hlsStream} />)
      expect(document.querySelector('video')).toBeInTheDocument()
      expect(document.querySelector('img')).not.toBeInTheDocument()

      const mjpegStream: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.mjpeg',
        type: 'mjpeg'
      }

      rerender(<StreamPlayer stream={mjpegStream} />)
      expect(document.querySelector('video')).not.toBeInTheDocument()
      expect(document.querySelector('img')).toBeInTheDocument()
    })

    it('should report unsupported native HLS without assigning the source', async () => {
      let unsupportedVideo: HTMLVideoElement | null = null
      Object.defineProperty(HTMLVideoElement.prototype, 'canPlayType', {
        value: vi.fn(function (this: HTMLVideoElement) {
          unsupportedVideo = this
          return ''
        }),
        writable: true
      })
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const onError = vi.fn()
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      const { container } = render(<StreamPlayer stream={streamState} onError={onError} />)

      await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error)))
      expect(unsupportedVideo).not.toHaveAttribute('src')
      expect(mockVideoPlay).not.toHaveBeenCalled()
      expect(container.firstChild).toBeNull()
      consoleWarn.mockRestore()
    })

    it('should route video and play failures to onError', async () => {
      const playError = new Error('Playback denied')
      mockVideoPlay.mockRejectedValueOnce(playError)
      const onError = vi.fn()
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      render(<StreamPlayer stream={streamState} onError={onError} />)

      await waitFor(() => expect(onError).toHaveBeenCalledWith(playError))

      const video = document.querySelector('video') as HTMLVideoElement
      fireEvent.error(video)
      expect(onError).toHaveBeenLastCalledWith(expect.any(Error))
      await waitFor(() => expect(document.querySelector('video')).not.toBeInTheDocument())
    })

    it('should ignore AbortError play rejections', async () => {
      const abortError = new Error('Playback interrupted')
      abortError.name = 'AbortError'
      mockVideoPlay.mockRejectedValueOnce(abortError)
      const onError = vi.fn()
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.m3u8',
        type: 'hls'
      }

      render(<StreamPlayer stream={streamState} onError={onError} />)

      await waitFor(() => expect(mockVideoPlay).toHaveBeenCalled())
      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('MJPEG Streams', () => {
    it('should render MJPEG as img element', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/camera_proxy_stream',
        type: 'mjpeg'
      }

      render(<StreamPlayer stream={streamState} />)

      const img = document.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'http://example.com/camera_proxy_stream')
    })

    it('should apply className to MJPEG img', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.mjpeg',
        type: 'mjpeg'
      }

      render(<StreamPlayer stream={streamState} className="mjpeg-stream" />)

      const img = document.querySelector('img')
      expect(img).toHaveClass('mjpeg-stream')
    })

    it('should hide failed MJPEG images and report the error', () => {
      const onError = vi.fn()
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream.mjpeg',
        type: 'mjpeg'
      }

      render(<StreamPlayer stream={streamState} onError={onError} />)
      fireEvent.error(document.querySelector('img') as HTMLImageElement)

      expect(document.querySelector('img')).not.toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing stream type gracefully', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/stream',
        type: null as any
      }

      render(<StreamPlayer stream={streamState} />)
      // Should render video by default for non-mjpeg types
      expect(document.querySelector('video')).toBeInTheDocument()
    })

    it('should handle webrtc type as video', () => {
      const streamState: StreamState = {
        isLoading: false,
        isActive: true,
        error: null,
        url: 'http://example.com/webrtc',
        type: 'webrtc'
      }

      render(<StreamPlayer stream={streamState} />)
      expect(document.querySelector('video')).toBeInTheDocument()
    })
  })
})
