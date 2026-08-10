---
sidebar_position: 9
---

# Scene

Activate scenes defined in Home Assistant. One call sets every device in the scene to its saved state.

## Quick Example

```tsx
// Component approach
<Scene entityId="scene.movie_night">
  {({ activate, lastChanged }) => (
    <div>
      <button onClick={() => activate()}>
        Activate Movie Night
      </button>
      <p>Last activated: {lastChanged.toLocaleTimeString()}</p>
    </div>
  )}
</Scene>

// Hook approach
const scene = useScene('scene.movie_night')
<button onClick={() => scene.activate()}>
  Activate Movie Night
</button>
```

## Component API

### Basic Usage

```tsx
import { Scene } from 'hass-react'

<Scene entityId="scene.movie_night">
  {(sceneProps) => (
    // Your UI here
  )}
</Scene>
```

### Render Props

The Scene component provides these props:

#### Control Methods
- **`activate(transition?: number): Promise<void>`** - Activate the scene with optional transition time in seconds

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value (typically 'scening')
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the scene was last activated
- **`lastUpdated`** (`Date`) - When the entity was last updated
- **`isConnected`** (`boolean`) - Connection status

## Hook API

### Basic Usage

```tsx
import { useScene } from 'hass-react'

function MyComponent() {
  const scene = useScene('scene.movie_night')

  // All the same properties as component render props
  return <button onClick={() => scene.activate()}>Activate</button>
}
```

Same properties and methods as the component.

## List All Scenes

For all scenes at once, there's `useScenes`:

```tsx
import { useScenes } from 'hass-react'

function SceneList() {
  const scenes = useScenes()

  return (
    <div>
      <h2>Available Scenes ({scenes.length})</h2>
      {scenes.map(scene => (
        <div key={scene.entity_id}>
          {scene.attributes.friendly_name || scene.entity_id}
        </div>
      ))}
    </div>
  )
}
```

## Examples

### Simple Scene Activation

```tsx
<Scene entityId="scene.good_morning">
  {({ activate, attributes, lastChanged }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <button onClick={() => activate()}>
        Activate
      </button>
      {lastChanged && (
        <p>Last activated: {lastChanged.toLocaleString()}</p>
      )}
    </div>
  )}
</Scene>
```

### Scene with Transition

```tsx
<Scene entityId="scene.sunset">
  {({ activate, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <button onClick={() => activate(5)}>
        Activate (5s transition)
      </button>
      <button onClick={() => activate(30)}>
        Activate (30s transition)
      </button>
    </div>
  )}
</Scene>
```

### Scene Selector

```tsx
function SceneSelector() {
  const scenes = useScenes()

  return (
    <div>
      <h3>Select a Scene</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {scenes.map(scene => (
          <Scene key={scene.entity_id} entityId={scene.entity_id}>
            {(sceneState) => (
              <button
                onClick={() => sceneState.activate()}
                disabled={!sceneState.isConnected}
              >
                {scene.attributes.friendly_name || scene.entity_id}
              </button>
            )}
          </Scene>
        ))}
      </div>
    </div>
  )
}
```

### Scene Grid

```tsx
function SceneGrid() {
  const scenes = useScenes()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
      {scenes.map(scene => (
        <Scene key={scene.entity_id} entityId={scene.entity_id}>
          {({ activate, attributes, lastChanged, isConnected }) => (
            <div style={{
              padding: '1rem',
              border: '1px solid #ccc',
              borderRadius: '8px'
            }}>
              <h4>{attributes.friendly_name || scene.entity_id}</h4>
              <button
                onClick={() => activate()}
                disabled={!isConnected}
              >
                Activate
              </button>
              {lastChanged && (
                <small>
                  Last: {lastChanged.toLocaleTimeString()}
                </small>
              )}
            </div>
          )}
        </Scene>
      ))}
    </div>
  )
}
```

### Scene with Custom Transition Control

```tsx
<Scene entityId="scene.bedtime">
  {({ activate, attributes, isConnected }) => {
    const [transition, setTransition] = useState(10)

    return (
      <div>
        <h3>{attributes.friendly_name}</h3>

        <label>
          Transition: {transition}s
          <input
            type="range"
            min="0"
            max="60"
            value={transition}
            onChange={(e) => setTransition(parseInt(e.target.value))}
          />
        </label>

        <button
          onClick={() => activate(transition > 0 ? transition : undefined)}
          disabled={!isConnected}
        >
          Activate Scene
        </button>
      </div>
    )
  }}
</Scene>
```

### Using Hooks

```tsx
import { useScene, useScenes } from 'hass-react'

function SceneManager() {
  const scenes = useScenes()
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)

  const handleActivateScene = async (sceneId: string) => {
    setActiveSceneId(sceneId)
    // Note: You can't call useScene conditionally, so for dynamic scenes
    // it's better to use the Scene component or structure your hooks differently
  }

  return (
    <div>
      <h2>Scene Manager</h2>
      <p>Found {scenes.length} scenes</p>

      <div>
        {scenes.map(scene => (
          <button
            key={scene.entity_id}
            onClick={() => handleActivateScene(scene.entity_id)}
          >
            {scene.attributes.friendly_name || scene.entity_id}
          </button>
        ))}
      </div>
    </div>
  )
}

// For a single known scene, hooks work well:
function QuickScene() {
  const movieNight = useScene('scene.movie_night')
  const goodMorning = useScene('scene.good_morning')

  return (
    <div>
      <button onClick={() => movieNight.activate()}>
        Movie Night
      </button>
      <button onClick={() => goodMorning.activate()}>
        Good Morning
      </button>
    </div>
  )
}
```

## Notes

- Scenes are stateless. Activating one triggers its actions; the scene's own state doesn't change
- `lastChanged` updates each time the scene is activated
- Transition time is in seconds
