# Camera

View camera images and streams with support for HLS, MJPEG, and WebRTC streaming.

## Quick Example

```tsx
import { Camera, useCamera } from 'hass-react'

// Streamlined approach with compound components
function CameraView() {
  const camera = useCamera('camera.front_door')

  return (
    <div>
      {camera.streamState.isActive ? (
        <Camera.StreamPlayer stream={camera.streamState} />
      ) : (
        <Camera.Image url={camera.imageUrl} />
      )}

      <button onClick={() => camera.startStream({ type: 'mjpeg' })}>
        Start Stream
      </button>
      {camera.streamState.isActive && (
        <button onClick={camera.stopStream}>Stop Stream</button>
      )}
    </div>
  )
}
```

## Streamlined API

The Camera module provides compound components for common use cases:

### Camera.Image

Display a static camera image with automatic error handling.

```tsx
import { Camera } from 'hass-react'

<Camera.Image
  url={camera.imageUrl}
  alt="Front door camera"
  className="camera-image"
  onError={() => console.log('Image failed to load')}
/>
```

**Props:**
- **`url`** (`string | null`) - Image URL
- **`alt`** (`string`) - Alt text (default: "Camera image")
- **`style`** (`CSSProperties`) - Custom styles
- **`className`** (`string`) - CSS class name
- **`onError`** (`() => void`) - Error callback

### Camera.StreamPlayer

Display a live camera stream (HLS, MJPEG, or WebRTC).

```tsx
import { Camera, useCamera } from 'hass-react'

function LiveStream() {
  const camera = useCamera('camera.backyard')

  return (
    <Camera.StreamPlayer
      stream={camera.streamState}
      autoPlay={true}
      muted={true}
      controls={true}
      className="camera-stream"
    />
  )
}
```

**Props:**
- **`stream`** (`StreamState`) - Stream state object from `useCamera`
- **`autoPlay`** (`boolean`) - Auto-play video (default: `true`)
- **`muted`** (`boolean`) - Mute audio (default: `true`)
- **`controls`** (`boolean`) - Show video controls (default: `true`)
- **`style`** (`CSSProperties`) - Custom styles
- **`className`** (`string`) - CSS class name

## Hook API

### Basic Usage

```tsx
import { useCamera } from 'hass-react'

function MyComponent() {
  const camera = useCamera('camera.front_door')

  return <div>{camera.isOn ? 'ON' : 'OFF'}</div>
}
```

The `useCamera` hook returns an object with the following properties and methods:

#### State Properties
- **`isOn`** (`boolean`) - Whether the camera is currently on
- **`isRecording`** (`boolean`) - Whether the camera is recording
- **`isStreaming`** (`boolean`) - Whether the camera is streaming
- **`isIdle`** (`boolean`) - Whether the camera is idle
- **`motionDetectionEnabled`** (`boolean`) - Motion detection status

#### Image and Stream Properties
- **`imageUrl`** (`string | null`) - URL for static camera image with authentication token
- **`streamState`** (`StreamState`) - Current stream state with properties:
  - **`isLoading`** (`boolean`) - Stream is being loaded
  - **`isActive`** (`boolean`) - Stream is active
  - **`error`** (`Error | null`) - Stream error if any
  - **`url`** (`string | null`) - Stream URL
  - **`type`** (`'hls' | 'mjpeg' | 'webrtc' | null`) - Stream type
- **`accessToken`** (`string`) - Authentication token for camera API

#### Camera Information
- **`brand`** (`string`) - Camera brand
- **`model`** (`string`) - Camera model

#### Feature Support
- **`supportsOnOff`** (`boolean`) - Camera supports turning on/off
- **`supportsStream`** (`boolean`) - Camera supports streaming

#### Control Methods
- **`turnOn()`** - Turn camera on (if supported)
- **`turnOff()`** - Turn camera off (if supported)
- **`enableMotionDetection()`** - Enable motion detection
- **`disableMotionDetection()`** - Disable motion detection
- **`snapshot(filename: string)`** - Save a snapshot to a Home Assistant-accessible filename
- **`record(filename: string, duration?: number)`** - Record to a Home Assistant-accessible filename
- **`refreshImage()`** - Force refresh the camera image

#### Streaming Methods
- **`getStreamUrl(options?: StreamOptions)`** - Get stream URL without starting playback
  - `options.type`: `'hls' | 'mjpeg' | 'webrtc'` (default: `'hls'`)
- **`startStream(options?: StreamOptions)`** - Start streaming
  - `options.type`: `'hls' | 'mjpeg' | 'webrtc'` (default: `'hls'`)
- **`stopStream()`** - Stop streaming
- **`retryStream()`** - Retry last failed stream
- **`playStream(mediaPlayer: string)`** - Play the stream on a media player entity

`startStream` reports failures through `streamState.error` and resolves without throwing.
Service methods return promises, so handle service-call failures explicitly:

```tsx
camera.snapshot('/config/www/snapshots/front-door.jpg').catch(console.error)
camera.record('/config/www/recordings/front-door.mp4', 30).catch(console.error)
camera.playStream('media_player.living_room').catch(console.error)
```

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Component API

### Basic Usage

```tsx
import { Camera } from 'hass-react'

<Camera entityId="camera.front_door">
  {(cameraProps) => (
    // Your UI here
  )}
</Camera>
```

The Camera component provides all the same properties and methods as the `useCamera` hook to your render function.

## List All Cameras

Use the `useCameras` hook to retrieve all available camera entities:

```tsx
import { useCameras } from 'hass-react'

function CameraList() {
  const cameras = useCameras()

  return (
    <div>
      <h2>Available Cameras ({cameras.length})</h2>
      {cameras.map(camera => (
        <div key={camera.entity_id}>
          {camera.attributes.friendly_name || camera.entity_id}
        </div>
      ))}
    </div>
  )
}
```

The `useCameras` hook fetches all camera entities from Home Assistant and returns an array of camera objects.

## Examples

### Simple Image Display

```tsx
import { Camera, useCamera } from 'hass-react'

function CameraImage() {
  const camera = useCamera('camera.front_door')

  return (
    <div>
      <h3>Front Door</h3>
      <Camera.Image url={camera.imageUrl} />
      <button onClick={camera.refreshImage}>Refresh</button>
    </div>
  )
}
```

### Stream Toggle

```tsx
import { Camera, useCamera } from 'hass-react'

function CameraStream() {
  const camera = useCamera('camera.backyard')

  return (
    <div>
      <h3>Backyard Camera</h3>

      {camera.streamState.isActive ? (
        <>
          <Camera.StreamPlayer stream={camera.streamState} />
          <button onClick={camera.stopStream}>Stop Stream</button>
        </>
      ) : (
        <>
          <Camera.Image url={camera.imageUrl} />
          <button
            onClick={() => camera.startStream({ type: 'mjpeg' })}
            disabled={camera.streamState.isLoading}
          >
            {camera.streamState.isLoading ? 'Loading...' : 'Start Stream'}
          </button>
        </>
      )}

      {camera.streamState.error && (
        <div style={{ color: 'red' }}>
          Error: {camera.streamState.error.message}
          <button onClick={camera.retryStream}>Retry</button>
        </div>
      )}
    </div>
  )
}
```

### Stream Type Selection

```tsx
import { Camera, useCamera } from 'hass-react'

function CameraWithStreamOptions() {
  const camera = useCamera('camera.garage')

  const handleStreamStart = (type: 'hls' | 'mjpeg') => {
    camera.startStream({ type })
  }

  return (
    <div>
      <h3>Garage Camera</h3>

      {camera.streamState.isActive ? (
        <>
          <Camera.StreamPlayer stream={camera.streamState} />
          <p>Streaming ({camera.streamState.type})</p>
          <button onClick={camera.stopStream}>Stop</button>
        </>
      ) : (
        <>
          <Camera.Image url={camera.imageUrl} />
          <div>
            <button onClick={() => handleStreamStart('mjpeg')}>
              Start MJPEG Stream
            </button>
            <button onClick={() => handleStreamStart('hls')}>
              Start HLS Stream
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

### Motion Detection Control

```tsx
import { useCamera } from 'hass-react'

function MotionDetectionControl() {
  const camera = useCamera('camera.driveway')

  const toggleMotionDetection = () => {
    if (camera.motionDetectionEnabled) {
      camera.disableMotionDetection()
    } else {
      camera.enableMotionDetection()
    }
  }

  return (
    <div>
      <h3>{camera.attributes.friendly_name}</h3>

      <label>
        <input
          type="checkbox"
          checked={camera.motionDetectionEnabled}
          onChange={toggleMotionDetection}
        />
        Motion Detection
      </label>

      {camera.motionDetectionEnabled && (
        <span style={{ color: 'green' }}>● Recording on motion</span>
      )}
    </div>
  )
}
```

### Recording Control

```tsx
import { useCamera } from 'hass-react'

function CameraRecorder() {
  const camera = useCamera('camera.security')

  const startRecording = () => {
    camera
      .record('/config/www/recordings/security.mp4', 30)
      .catch((error) => console.error('Recording failed:', error))
  }

  const takeSnapshot = () => {
    camera
      .snapshot('/config/www/snapshots/security.jpg')
      .catch((error) => console.error('Snapshot failed:', error))
  }

  return (
    <div>
      <h3>{camera.attributes.friendly_name}</h3>

      <div>
        Status: {camera.isRecording ? 'Recording' : 'Idle'}
      </div>

      {!camera.isRecording && (
        <button onClick={startRecording}>
          Record 30 seconds
        </button>
      )}

      <button onClick={takeSnapshot}>
        Take Snapshot
      </button>
    </div>
  )
}
```

### Full Camera Control Panel

```tsx
import { Camera, useCamera } from 'hass-react'

function CameraPanel() {
  const camera = useCamera('camera.main')

  return (
    <div>
      <h2>{camera.attributes.friendly_name}</h2>

      {/* Camera Info */}
      <div>
        {camera.brand && <p>Brand: {camera.brand}</p>}
        {camera.model && <p>Model: {camera.model}</p>}
        <p>Status: {camera.state}</p>
      </div>

      {/* Power Control */}
      {camera.supportsOnOff && (
        <div>
          <button onClick={camera.isOn ? camera.turnOff : camera.turnOn}>
            {camera.isOn ? 'Turn Off' : 'Turn On'}
          </button>
        </div>
      )}

      {/* Image/Stream Display */}
      {camera.isOn && (
        <div>
          {camera.streamState.isActive ? (
            <Camera.StreamPlayer stream={camera.streamState} />
          ) : (
            <Camera.Image url={camera.imageUrl} />
          )}
        </div>
      )}

      {/* Stream Controls */}
      {camera.isOn && camera.supportsStream && (
        <div>
          {camera.streamState.isActive ? (
            <button onClick={camera.stopStream}>Stop Stream</button>
          ) : (
            <>
              <button onClick={() => camera.startStream({ type: 'mjpeg' })}>
                MJPEG Stream
              </button>
              <button onClick={() => camera.startStream({ type: 'hls' })}>
                HLS Stream
              </button>
            </>
          )}
        </div>
      )}

      {/* Stream Error */}
      {camera.streamState.error && (
        <div style={{ color: 'red' }}>
          Stream Error: {camera.streamState.error.message}
          <button onClick={camera.retryStream}>Retry</button>
        </div>
      )}

      {/* Motion Detection */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={camera.motionDetectionEnabled}
            onChange={() => camera.motionDetectionEnabled
              ? camera.disableMotionDetection()
              : camera.enableMotionDetection()
            }
          />
          Motion Detection
        </label>
      </div>

      {/* Action Buttons */}
      <div>
        <button onClick={camera.refreshImage}>Refresh Image</button>
        <button onClick={() => camera.snapshot('/config/www/snapshots/main.jpg').catch(console.error)}>Take Snapshot</button>
        <button onClick={() => camera.record('/config/www/recordings/main.mp4', 60).catch(console.error)}>
          Record 60s
        </button>
      </div>

      <p>Last updated: {camera.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}
```

### Advanced: Custom Stream Player

For advanced use cases where you need full control over streaming:

```tsx
import { useCamera } from 'hass-react'
import { useEffect, useRef } from 'react'

function CustomStreamPlayer() {
  const camera = useCamera('camera.custom')
  const videoRef = useRef<HTMLVideoElement>(null)

  // Get stream URL and manage playback manually
  useEffect(() => {
    const setupStream = async () => {
      try {
        const streamUrl = await camera.getStreamUrl({ type: 'hls' })
        if (videoRef.current && streamUrl) {
          videoRef.current.src = streamUrl
          await videoRef.current.play()
        }
      } catch (error) {
        console.error('Stream setup failed:', error)
      }
    }

    setupStream()

    return () => {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
    }
  }, [camera])

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      muted
      style={{ width: '100%' }}
    />
  )
}
```

### Using Component API

```tsx
import { Camera } from 'hass-react'

<Camera entityId="camera.porch">
  {({ isOn, imageUrl, streamState, startStream, stopStream, refreshImage, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>

      {isOn && (
        <>
          {streamState.isActive ? (
            <>
              <Camera.StreamPlayer stream={streamState} />
              <button onClick={stopStream}>Stop</button>
            </>
          ) : (
            <>
              <Camera.Image url={imageUrl} />
              <button onClick={() => startStream({ type: 'mjpeg' })}>
                Start Stream
              </button>
              <button onClick={refreshImage}>Refresh</button>
            </>
          )}
        </>
      )}
    </div>
  )}
</Camera>
```

## Stream Types

### MJPEG
- **Best compatibility** - Works with most cameras
- **Lower latency** - Faster than HLS
- **Higher bandwidth** - Less efficient compression
- **Recommended for:** Local network viewing, maximum compatibility

### HLS (HTTP Live Streaming)
- **Better compression** - Lower bandwidth usage
- **Higher latency** - More delay than MJPEG
- **Requires Stream integration** - Must be configured in Home Assistant
- **Recommended for:** Remote access, bandwidth-constrained networks

### WebRTC
- **Lowest latency** - Real-time streaming
- **Complex setup** - Requires specialized configuration
- **Not yet fully supported** - Consider MJPEG or HLS for now

## Troubleshooting

### Stream Not Working

If HLS streaming fails, try MJPEG instead:

```tsx
// Try MJPEG first for better compatibility
camera.startStream({ type: 'mjpeg' })
```

HLS requires the Stream integration to be configured in Home Assistant. If you see errors about stream integration, use MJPEG instead.

### Image Not Loading

Make sure the camera entity has a valid `access_token` and is connected:

```tsx
if (!camera.imageUrl) {
  return <div>Camera not available</div>
}
```

### Force Image Refresh

If images appear stale, use the refresh method:

```tsx
<button onClick={camera.refreshImage}>Refresh</button>
```

The `imageUrl` includes automatic cache-busting to ensure fresh images.
