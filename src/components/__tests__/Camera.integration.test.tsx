import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

const connectionMocks = vi.hoisted(() => ({
  sendMessagePromise: vi.fn(),
  subscribeEvents: vi.fn().mockResolvedValue(() => undefined)
}))

vi.mock('../../providers/HAProvider', () => ({
  useHAConnection: () => ({
    connection: connectionMocks,
    connected: true,
    connecting: false,
    error: null,
    config: {
      url: 'http://homeassistant.local:8123',
      options: {}
    }
  })
}))

import { Camera } from '../Camera'
import { useStore } from '../../services/entityStore'
import type { EntityState } from '../../types'

const cameraEntity: EntityState = {
  entity_id: 'camera.front_door',
  state: 'idle',
  attributes: {
    friendly_name: 'Front Door',
    access_token: 'camera-token',
    supported_features: 2
  },
  last_changed: '2026-08-10T12:00:00Z',
  last_updated: '2026-08-10T12:00:00Z',
  context: {
    id: 'camera-context',
    parent_id: null,
    user_id: null
  }
}

const videoPlay = vi.fn()
const videoPause = vi.fn()
const videoLoad = vi.fn()

describe('Camera compound integration', () => {
  beforeEach(() => {
    useStore.getState().clear()
    useStore.getState().batchUpdate([[cameraEntity.entity_id, cameraEntity]])
    connectionMocks.sendMessagePromise.mockReset().mockResolvedValue({
      url: '/api/hls/camera.front_door/playlist.m3u8'
    })
    connectionMocks.subscribeEvents.mockClear()
    videoPlay.mockReset().mockResolvedValue(undefined)
    videoPause.mockReset()
    videoLoad.mockReset()

    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      value: videoPlay,
      writable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
      value: videoPause,
      writable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'load', {
      value: videoLoad,
      writable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'canPlayType', {
      value: vi.fn().mockReturnValue('probably'),
      writable: true
    })
  })

  afterEach(() => {
    useStore.getState().clear()
  })

  it('renders the camera image and tears down a real hook-managed stream', async () => {
    render(
      <Camera entityId="camera.front_door">
        {camera => (
          <div>
            <Camera.Image url={camera.imageUrl} alt="Front door camera" />
            <button onClick={() => camera.startStream()}>Start stream</button>
            <button onClick={() => camera.stopStream()}>Stop stream</button>
            <Camera.StreamPlayer stream={camera.streamState} />
          </div>
        )}
      </Camera>
    )

    expect(screen.getByAltText('Front door camera')).toHaveAttribute(
      'src',
      'http://homeassistant.local:8123/api/camera_proxy/camera.front_door?token=camera-token&_cb=0'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start stream' }))

    const video = await waitFor(() => {
      const element = document.querySelector('video')
      expect(element).toHaveAttribute(
        'src',
        'http://homeassistant.local:8123/api/hls/camera.front_door/playlist.m3u8'
      )
      return element as HTMLVideoElement
    })
    expect(connectionMocks.sendMessagePromise).toHaveBeenCalledWith({
      type: 'camera/stream',
      entity_id: 'camera.front_door'
    })

    fireEvent.click(screen.getByRole('button', { name: 'Stop stream' }))

    await waitFor(() => expect(document.querySelector('video')).not.toBeInTheDocument())
    expect(videoPause).toHaveBeenCalledTimes(1)
    expect(video).not.toHaveAttribute('src')
    expect(videoLoad).toHaveBeenCalledTimes(1)
  })
})
