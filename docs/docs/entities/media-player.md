---
sidebar_position: 6
---

# Media Player

Playback, volume, source selection, and track info for media player entities.

## Quick Example

```tsx
// Component approach
<MediaPlayer entityId="media_player.living_room_speaker">
  {({ isPlaying, toggle, mediaTitle, volumeLevel }) => (
    <div>
      <p>{mediaTitle || 'No media playing'}</p>
      <button onClick={toggle}>
        {isPlaying ? 'PAUSE' : 'PLAY'}
      </button>
      <p>Volume: {Math.round(volumeLevel * 100)}%</p>
    </div>
  )}
</MediaPlayer>

// Hook approach
const speaker = useMediaPlayer('media_player.living_room_speaker')
<div>
  <p>{speaker.mediaTitle || 'No media playing'}</p>
  <button onClick={speaker.toggle}>
    {speaker.isPlaying ? 'PAUSE' : 'PLAY'}
  </button>
  <p>Volume: {Math.round(speaker.volumeLevel * 100)}%</p>
</div>
```

## Component API

### Basic Usage

```tsx
import { MediaPlayer } from 'hass-react'

<MediaPlayer entityId="media_player.living_room_speaker">
  {(playerProps) => (
    // Your UI here
  )}
</MediaPlayer>
```

### Render Props

The MediaPlayer component passes these props to your render function:

#### State Properties
- **`isPlaying`** (`boolean`) - Whether media is currently playing
- **`isPaused`** (`boolean`) - Whether media is paused
- **`isIdle`** (`boolean`) - Whether player is idle (no media loaded)
- **`isOff`** (`boolean`) - Whether player is turned off
- **`isOn`** (`boolean`) - Whether player is turned on

#### Media Information
- **`mediaTitle`** (`string | null`) - Current media title
- **`mediaArtist`** (`string | null`) - Current media artist
- **`mediaAlbum`** (`string | null`) - Current media album
- **`mediaContentType`** (`string | null`) - Type of media content
- **`mediaDuration`** (`number | null`) - Total duration in seconds
- **`mediaPosition`** (`number | null`) - Current position in seconds

#### Audio Control
- **`volumeLevel`** (`number`) - Current volume level (0-1)
- **`isMuted`** (`boolean`) - Whether audio is muted
- **`currentSource`** (`string | null`) - Current input source
- **`sourceList`** (`string[]`) - Available input sources
- **`currentSoundMode`** (`string | null`) - Current sound mode
- **`soundModeList`** (`string[]`) - Available sound modes

#### Advanced Features
- **`shuffle`** (`boolean | null`) - Shuffle mode status
- **`repeat`** (`string | null`) - Repeat mode (off, one, all)
- **`appName`** (`string | null`) - Current app name

#### Support Properties
- **`supportsPlay`** (`boolean`) - Player supports play
- **`supportsPause`** (`boolean`) - Player supports pause
- **`supportsStop`** (`boolean`) - Player supports stop
- **`supportsNextTrack`** (`boolean`) - Player supports next track
- **`supportsPreviousTrack`** (`boolean`) - Player supports previous track
- **`supportsVolumeSet`** (`boolean`) - Player supports volume control
- **`supportsVolumeMute`** (`boolean`) - Player supports mute/unmute
- **`supportsSeek`** (`boolean`) - Player supports seeking
- **`supportsTurnOn`** (`boolean`) - Player supports power on
- **`supportsTurnOff`** (`boolean`) - Player supports power off
- **`supportsSelectSource`** (`boolean`) - Player supports source selection
- **`supportsSelectSoundMode`** (`boolean`) - Player supports sound mode selection
- **`supportsShuffle`** (`boolean`) - Player supports shuffle
- **`supportsRepeat`** (`boolean`) - Player supports repeat modes

#### Control Methods
- **`play()`** - Start playback
- **`pause()`** - Pause playback
- **`stop()`** - Stop playback
- **`toggle()`** - Toggle play/pause
- **`nextTrack()`** - Skip to next track
- **`previousTrack()`** - Skip to previous track
- **`turnOn()`** - Turn player on
- **`turnOff()`** - Turn player off
- **`setVolume(volume: number)`** - Set volume (0-1)
- **`toggleMute()`** - Toggle mute
- **`mute()`** - Mute audio
- **`unmute()`** - Unmute audio
- **`selectSource(source: string)`** - Select input source
- **`selectSoundMode(soundMode: string)`** - Select sound mode
- **`setShuffle(shuffle: boolean)`** - Enable/disable shuffle
- **`setRepeat(repeat: string)`** - Set repeat mode
- **`seek(position: number)`** - Seek to position in seconds
- **`playMedia(mediaType: string, mediaId: string)`** - Play specific media

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useMediaPlayer } from 'hass-react'

function MyComponent() {
  const player = useMediaPlayer('media_player.living_room_speaker')
  
  // All the same properties as component render props
  return <div>{player.isPlaying ? 'PLAYING' : 'PAUSED'}</div>
}
```

The `useMediaPlayer` hook returns an object with all the same properties and methods as the component's render props.

## List All Media Players

The `useMediaPlayers` hook returns every media player entity Home Assistant knows about:

```tsx
import { useMediaPlayers } from 'hass-react'

function MediaPlayerList() {
  const mediaPlayers = useMediaPlayers()

  return (
    <div>
      <h2>Available Media Players ({mediaPlayers.length})</h2>
      {mediaPlayers.map(player => (
        <div key={player.entity_id}>
          {player.attributes.friendly_name || player.entity_id}
        </div>
      ))}
    </div>
  )
}
```

Each item in the array is a raw entity object with `entity_id`, `state`, and `attributes`.

## Examples

### Simple Media Control

```tsx
<MediaPlayer entityId="media_player.bedroom_speaker">
  {({ isPlaying, isPaused, isOff, play, pause, stop, turnOn, mediaTitle, mediaArtist, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <div>
        <strong>{mediaTitle || 'No media'}</strong>
        {mediaArtist && <p>by {mediaArtist}</p>}
      </div>
      
      <div>
        {isOff ? (
          <button onClick={turnOn}>Turn On</button>
        ) : (
          <>
            <button onClick={play} disabled={isPlaying}>
              Play
            </button>
            <button onClick={pause} disabled={!isPlaying}>
              Pause
            </button>
            <button onClick={stop}>
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  )}
</MediaPlayer>
```

### Volume Control

```tsx
<MediaPlayer entityId="media_player.kitchen_speaker">
  {({ volumeLevel, isMuted, setVolume, toggleMute, supportsVolumeSet, supportsVolumeMute, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      {supportsVolumeSet && (
        <div>
          <label>Volume: {Math.round(volumeLevel * 100)}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={volumeLevel * 100}
            onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
          />
        </div>
      )}
      
      {supportsVolumeMute && (
        <button onClick={toggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      )}
    </div>
  )}
</MediaPlayer>
```

### Track Navigation

```tsx
<MediaPlayer entityId="media_player.spotify">
  {({ 
    isPlaying, toggle, nextTrack, previousTrack, 
    supportsNextTrack, supportsPreviousTrack,
    mediaTitle, mediaArtist, mediaAlbum, attributes 
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <div>
        <strong>{mediaTitle || 'No track'}</strong>
        {mediaArtist && <p>{mediaArtist}</p>}
        {mediaAlbum && <p>Album: {mediaAlbum}</p>}
      </div>
      
      <div>
        {supportsPreviousTrack && (
          <button onClick={previousTrack}>Previous</button>
        )}
        
        <button onClick={toggle}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        {supportsNextTrack && (
          <button onClick={nextTrack}>Next</button>
        )}
      </div>
    </div>
  )}
</MediaPlayer>
```

### Progress Bar with Seeking

```tsx
<MediaPlayer entityId="media_player.music_player">
  {({ mediaPosition, mediaDuration, seek, supportsSeek, mediaTitle, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>{mediaTitle || 'No media'}</p>
      
      {supportsSeek && mediaDuration && (
        <div>
          <input
            type="range"
            min="0"
            max={mediaDuration}
            value={mediaPosition || 0}
            onChange={(e) => seek(parseInt(e.target.value))}
          />
          
          <div>
            {Math.floor((mediaPosition || 0) / 60)}:
            {String(Math.floor((mediaPosition || 0) % 60)).padStart(2, '0')} / 
            {Math.floor(mediaDuration / 60)}:
            {String(Math.floor(mediaDuration % 60)).padStart(2, '0')}
          </div>
        </div>
      )}
    </div>
  )}
</MediaPlayer>
```

### Source Selection

```tsx
<MediaPlayer entityId="media_player.av_receiver">
  {({ currentSource, sourceList, selectSource, supportsSelectSource, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Current Source: {currentSource}</p>
      
      {supportsSelectSource && sourceList.length > 0 && (
        <div>
          <label>Select Source:</label>
          <select value={currentSource || ''} onChange={(e) => selectSource(e.target.value)}>
            {sourceList.map(source => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )}
</MediaPlayer>
```

### Shuffle and Repeat

```tsx
<MediaPlayer entityId="media_player.music_service">
  {({ 
    shuffle, repeat, setShuffle, setRepeat, 
    supportsShuffle, supportsRepeat, attributes 
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      {supportsShuffle && (
        <label>
          <input
            type="checkbox"
            checked={shuffle || false}
            onChange={(e) => setShuffle(e.target.checked)}
          />
          Shuffle
        </label>
      )}
      
      {supportsRepeat && (
        <div>
          <label>Repeat:</label>
          <select value={repeat || 'off'} onChange={(e) => setRepeat(e.target.value)}>
            <option value="off">Off</option>
            <option value="one">One</option>
            <option value="all">All</option>
          </select>
        </div>
      )}
    </div>
  )}
</MediaPlayer>
```

### Multiple Players

```tsx
function MediaPlayerPanel() {
  const players = [
    'media_player.living_room',
    'media_player.kitchen',
    'media_player.bedroom'
  ]
  
  return (
    <div>
      <h2>Media Players</h2>
      {players.map(entityId => (
        <MediaPlayer key={entityId} entityId={entityId}>
          {({ isPlaying, toggle, mediaTitle, volumeLevel, attributes }) => (
            <div>
              <strong>{attributes.friendly_name}</strong>
              <br />
              Playing: {mediaTitle || 'Nothing'}
              <br />
              Volume: {Math.round(volumeLevel * 100)}%
              <br />
              <button onClick={toggle}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          )}
        </MediaPlayer>
      ))}
    </div>
  )
}
```

### Using Hooks

```tsx
import { useMediaPlayer } from 'hass-react'

function MediaPlayerCard({ entityId }) {
  const player = useMediaPlayer(entityId)
  
  const getStatusText = () => {
    if (player.isOff) return 'OFF'
    if (player.isPlaying) return 'PLAYING'
    if (player.isPaused) return 'PAUSED'
    if (player.isIdle) return 'IDLE'
    return 'UNKNOWN'
  }
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }
  
  return (
    <div>
      <h3>{player.attributes.friendly_name}</h3>
      
      <div>Status: {getStatusText()}</div>
      
      {player.mediaTitle && (
        <div>
          <strong>{player.mediaTitle}</strong>
          {player.mediaArtist && <div>{player.mediaArtist}</div>}
        </div>
      )}
      
      {player.mediaPosition !== null && player.mediaDuration !== null && (
        <div>
          {formatTime(player.mediaPosition)} / {formatTime(player.mediaDuration)}
        </div>
      )}
      
      <div>
        <button onClick={player.toggle} disabled={player.isOff}>
          {player.isPlaying ? 'Pause' : 'Play'}
        </button>
        
        {player.supportsNextTrack && (
          <button onClick={player.nextTrack}>Next</button>
        )}
      </div>
      
      {player.supportsVolumeSet && (
        <div>
          Volume: {Math.round(player.volumeLevel * 100)}%
          <input
            type="range"
            min="0"
            max="100"
            value={player.volumeLevel * 100}
            onChange={(e) => player.setVolume(parseInt(e.target.value) / 100)}
          />
        </div>
      )}
      
      <p>Last updated: {player.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}