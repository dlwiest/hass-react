---
sidebar_position: 5
---

# Cover

Open, close, and position covers: blinds, garage doors, curtains, shades.

## Quick Example

```tsx
// Component approach
<Cover entityId="cover.garage_door">
  {({ isOpen, isClosed, open, close }) => (
    <div>
      <p>Garage: {isOpen ? 'OPEN' : isClosed ? 'CLOSED' : 'PARTIAL'}</p>
      <button onClick={isOpen ? close : open}>
        {isOpen ? 'Close' : 'Open'}
      </button>
    </div>
  )}
</Cover>

// Hook approach
const garage = useCover('cover.garage_door')
<div>
  <p>Garage: {garage.isOpen ? 'OPEN' : garage.isClosed ? 'CLOSED' : 'PARTIAL'}</p>
  <button onClick={garage.isOpen ? garage.close : garage.open}>
    {garage.isOpen ? 'Close' : 'Open'}
  </button>
</div>
```

## Component API

### Basic Usage

```tsx
import { Cover } from 'hass-react'

<Cover entityId="cover.garage_door">
  {(coverProps) => (
    // Your UI here
  )}
</Cover>
```

### Render Props

The Cover component provides these props to your render function:

#### State Properties
- **`isOpen`** (`boolean`) - Whether the cover is fully open
- **`isClosed`** (`boolean`) - Whether the cover is fully closed
- **`isOpening`** (`boolean`) - Whether the cover is currently opening
- **`isClosing`** (`boolean`) - Whether the cover is currently closing
- **`position`** (`number | undefined`) - Current position (0-100, where 0 is closed and 100 is open)

#### Support Properties
- **`supportsSetPosition`** (`boolean`) - Cover supports position control
- **`supportsStop`** (`boolean`) - Cover can be stopped mid-travel

#### Control Methods
- **`open()`** - Open the cover completely
- **`close()`** - Close the cover completely
- **`stop()`** - Stop the cover movement. Throws `FeatureNotSupportedError` if the device can't stop, so check `supportsStop` first
- **`setPosition(position: number)`** - Move the cover to a specific position (0-100). Throws `FeatureNotSupportedError` if the device doesn't support positioning, so check `supportsSetPosition` first

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useCover } from 'hass-react'

function MyComponent() {
  const cover = useCover('cover.garage_door')
  
  // All the same properties as component render props
  return <div>{cover.isOpen ? 'OPEN' : 'CLOSED'}</div>
}
```

Everything the component passes to its render function is also on the object `useCover` returns.

## List All Covers

To list every cover entity, use the `useCovers` hook:

```tsx
import { useCovers } from 'hass-react'

function CoverList() {
  const covers = useCovers()

  return (
    <div>
      <h2>Available Covers ({covers.length})</h2>
      {covers.map(cover => (
        <div key={cover.entity_id}>
          {cover.attributes.friendly_name || cover.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns an array of cover entity objects.

## Examples

### Simple Cover Control

```tsx
<Cover entityId="cover.living_room_blinds">
  {({ isOpen, isClosed, isOpening, isClosing, open, close, stop, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <p>
        Status: {
          isOpening ? 'OPENING' :
          isClosing ? 'CLOSING' :
          isOpen ? 'OPEN' :
          isClosed ? 'CLOSED' : 'PARTIAL'
        }
      </p>
      
      <button onClick={open} disabled={isOpen || isOpening}>
        Open
      </button>
      
      <button onClick={close} disabled={isClosed || isClosing}>
        Close
      </button>
      
      {(isOpening || isClosing) && (
        <button onClick={stop}>
          Stop
        </button>
      )}
    </div>
  )}
</Cover>
```

### Position Control

```tsx
<Cover entityId="cover.bedroom_shades">
  {({ position, setPosition, isOpening, isClosing, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <p>Position: {position !== undefined ? `${position}%` : 'Unknown'}</p>
      
      {position !== undefined && (
        <div>
          <input
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(e) => setPosition(parseInt(e.target.value))}
            disabled={isOpening || isClosing}
          />
          
          <div>
            <button onClick={() => setPosition(0)}>
              Fully Closed
            </button>
            <button onClick={() => setPosition(25)}>
              25%
            </button>
            <button onClick={() => setPosition(50)}>
              50%
            </button>
            <button onClick={() => setPosition(75)}>
              75%
            </button>
            <button onClick={() => setPosition(100)}>
              Fully Open
            </button>
          </div>
        </div>
      )}
    </div>
  )}
</Cover>
```

### Garage Door Control

```tsx
<Cover entityId="cover.garage_door">
  {({ isOpen, isClosed, isOpening, isClosing, open, close, stop, attributes, lastChanged }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <div>
        Status: {
          isOpening ? 'OPENING' :
          isClosing ? 'CLOSING' :
          isOpen ? 'OPEN' :
          isClosed ? 'CLOSED' : 'UNKNOWN'
        }
      </div>
      
      <div>
        <button 
          onClick={isOpen ? close : open}
          disabled={isOpening || isClosing}
        >
          {isOpen ? 'Close Garage' : 'Open Garage'}
        </button>
        
        {(isOpening || isClosing) && (
          <button onClick={stop}>
            Emergency Stop
          </button>
        )}
      </div>
      
      {isOpen && (
        <p style={{ color: 'orange' }}>
          Warning: Garage door is open
        </p>
      )}
      
      <p>Last changed: {lastChanged.toLocaleString()}</p>
    </div>
  )}
</Cover>
```

### Multiple Covers

```tsx
function CoverPanel() {
  const covers = [
    'cover.living_room_blinds',
    'cover.bedroom_shades',
    'cover.kitchen_curtains'
  ]
  
  return (
    <div>
      <h2>Window Coverings</h2>
      {covers.map(entityId => (
        <Cover key={entityId} entityId={entityId}>
          {({ isOpen, isClosed, position, open, close, attributes }) => (
            <div>
              <strong>{attributes.friendly_name}</strong>
              <br />
              Status: {isOpen ? 'OPEN' : isClosed ? 'CLOSED' : 'PARTIAL'}
              {position !== undefined && ` (${position}%)`}
              <br />
              <button onClick={open} disabled={isOpen}>
                Open
              </button>
              <button onClick={close} disabled={isClosed}>
                Close
              </button>
            </div>
          )}
        </Cover>
      ))}
    </div>
  )
}
```

### Smart Blinds with Scheduling

```tsx
<Cover entityId="cover.office_blinds">
  {({ position, setPosition, attributes }) => {
    const [autoMode, setAutoMode] = useState(false)
    
    useEffect(() => {
      if (!autoMode) return
      
      const now = new Date()
      const hour = now.getHours()
      
      // Auto-adjust based on time of day
      if (hour >= 6 && hour < 9) {
        // Morning: 25% open
        setPosition(25)
      } else if (hour >= 9 && hour < 17) {
        // Daytime: 75% open
        setPosition(75)
      } else if (hour >= 17 && hour < 20) {
        // Evening: 50% open
        setPosition(50)
      } else {
        // Night: Closed
        setPosition(0)
      }
    }, [autoMode, setPosition])
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Position: {position !== undefined ? `${position}%` : 'Unknown'}</p>
        
        <div>
          <label>
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
            />
            Auto-scheduling
          </label>
        </div>
        
        {!autoMode && position !== undefined && (
          <input
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(e) => setPosition(parseInt(e.target.value))}
          />
        )}
      </div>
    )
  }}
</Cover>
```

### Cover Status Indicator

```tsx
<Cover entityId="cover.patio_awning">
  {({ isOpen, isClosed, isOpening, isClosing, position, attributes }) => {
    const getStatusColor = () => {
      if (isOpening || isClosing) return 'blue'
      if (isOpen) return 'green'
      if (isClosed) return 'gray'
      return 'orange'
    }
    
    const getStatusText = () => {
      if (isOpening) return 'OPENING...'
      if (isClosing) return 'CLOSING...'
      if (isOpen) return 'OPEN'
      if (isClosed) return 'CLOSED'
      return 'PARTIAL'
    }
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        
        <div style={{ color: getStatusColor() }}>
          Status: {getStatusText()}
          {position !== undefined && ` (${position}%)`}
        </div>
        
        {position !== undefined && (
          <div>
            Progress: {position}%
          </div>
        )}
      </div>
    )
  }}
</Cover>
```

### Using Hooks

```tsx
import { useCover } from 'hass-react'

function CoverCard({ entityId }) {
  const cover = useCover(entityId)
  
  const getStatusDisplay = () => {
    if (cover.isOpening) return { text: 'OPENING', color: 'blue' }
    if (cover.isClosing) return { text: 'CLOSING', color: 'blue' }
    if (cover.isOpen) return { text: 'OPEN', color: 'green' }
    if (cover.isClosed) return { text: 'CLOSED', color: 'gray' }
    return { text: 'PARTIAL', color: 'orange' }
  }
  
  const status = getStatusDisplay()
  
  return (
    <div>
      <h3>{cover.attributes.friendly_name}</h3>
      
      <div style={{ color: status.color }}>
        Status: {status.text}
        {cover.position !== undefined && ` (${cover.position}%)`}
      </div>
      
      <div>
        <button 
          onClick={cover.open} 
          disabled={cover.isOpen || cover.isOpening}
        >
          Open
        </button>
        
        <button 
          onClick={cover.close} 
          disabled={cover.isClosed || cover.isClosing}
        >
          Close
        </button>
        
        {(cover.isOpening || cover.isClosing) && (
          <button onClick={cover.stop}>
            Stop
          </button>
        )}
      </div>
      
      {cover.position !== undefined && (
        <div>
          <input
            type="range"
            min="0"
            max="100"
            value={cover.position}
            onChange={(e) => cover.setPosition(parseInt(e.target.value))}
            disabled={cover.isOpening || cover.isClosing}
          />
        </div>
      )}
      
      <p>Last updated: {cover.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}