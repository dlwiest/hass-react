---
sidebar_position: 4
---

# Lock

Lock and unlock smart locks. Locks with a latch can also be opened.

## Quick Example

```tsx
// Component approach
<Lock entityId="lock.front_door">
  {({ isLocked, lock, unlock }) => (
    <div>
      <p>Front Door: {isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
      <button onClick={isLocked ? unlock : lock}>
        {isLocked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  )}
</Lock>

// Hook approach
const frontLock = useLock('lock.front_door')
<div>
  <p>Front Door: {frontLock.isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
  <button onClick={frontLock.isLocked ? frontLock.unlock : frontLock.lock}>
    {frontLock.isLocked ? 'Unlock' : 'Lock'}
  </button>
</div>
```

## Component API

### Basic Usage

```tsx
import { Lock } from 'hass-react'

<Lock entityId="lock.front_door">
  {(lockProps) => (
    // Your UI here
  )}
</Lock>
```

### Render Props

The Lock component provides these props to your render function:

#### State Properties
- **`isLocked`** (`boolean`) - Whether the lock is currently locked
- **`isUnlocked`** (`boolean`) - Whether the lock is currently unlocked
- **`isUnknown`** (`boolean`) - Whether the lock state is unknown
- **`changedBy`** (`string | undefined`) - Who last changed the lock state

#### Support Properties
- **`supportsOpen`** (`boolean`) - Lock supports open functionality (door latch)

#### Control Methods
- **`lock()`** - Lock the lock
- **`unlock(code?: string)`** - Unlock the lock with optional code
- **`open(code?: string)`** - Open the lock (if supported) with optional code

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useLock } from 'hass-react'

function MyComponent() {
  const lock = useLock('lock.front_door')
  
  // All the same properties as component render props
  return <div>{lock.isLocked ? 'LOCKED' : 'UNLOCKED'}</div>
}
```

`useLock` gives you the same properties and methods as the component's render props.

## List All Locks

`useLocks` returns every lock entity:

```tsx
import { useLocks } from 'hass-react'

function LockList() {
  const locks = useLocks()

  return (
    <div>
      <h2>Available Locks ({locks.length})</h2>
      {locks.map(lock => (
        <div key={lock.entity_id}>
          {lock.attributes.friendly_name || lock.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns an array of lock entity objects.

## Examples

### Simple Lock Control

```tsx
<Lock entityId="lock.front_door">
  {({ isLocked, isUnlocked, lock, unlock, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isLocked ? 'LOCKED' : isUnlocked ? 'UNLOCKED' : 'UNKNOWN'}</p>
      
      <button onClick={lock} disabled={isLocked}>
        Lock
      </button>
      
      <button onClick={unlock} disabled={isUnlocked}>
        Unlock
      </button>
    </div>
  )}
</Lock>
```

### Lock with Code

```tsx
<Lock entityId="lock.smart_deadbolt">
  {({ isLocked, lock, unlock, attributes }) => {
    const [code, setCode] = useState('')
    
    const handleUnlock = () => {
      unlock(code)
      setCode('')
    }
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Status: {isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
        
        <button onClick={lock}>
          Lock
        </button>
        
        <div>
          <input
            type="password"
            placeholder="Enter code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={handleUnlock}>
            Unlock
          </button>
        </div>
      </div>
    )
  }}
</Lock>
```

### Lock with Open Support

```tsx
<Lock entityId="lock.front_door">
  {({ isLocked, lock, unlock, open, supportsOpen, changedBy, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>Status: {isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
      {changedBy && <p>Last changed by: {changedBy}</p>}
      
      <div>
        <button onClick={lock} disabled={isLocked}>
          Lock
        </button>
        
        <button onClick={unlock} disabled={!isLocked}>
          Unlock
        </button>
        
        {supportsOpen && (
          <button onClick={open}>
            Open Door
          </button>
        )}
      </div>
    </div>
  )}
</Lock>
```

### Multiple Locks

```tsx
function LockPanel() {
  const locks = [
    'lock.front_door',
    'lock.back_door',
    'lock.garage_door'
  ]
  
  return (
    <div>
      <h2>Lock Status</h2>
      {locks.map(entityId => (
        <Lock key={entityId} entityId={entityId}>
          {({ isLocked, lock, unlock, attributes }) => (
            <div>
              <strong>{attributes.friendly_name}</strong>: {isLocked ? 'LOCKED' : 'UNLOCKED'}
              <br />
              <button onClick={isLocked ? unlock : lock}>
                {isLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
          )}
        </Lock>
      ))}
    </div>
  )
}
```

### Lock Status Indicator

```tsx
<Lock entityId="lock.front_door">
  {({ isLocked, isUnlocked, isUnknown, attributes, lastChanged }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      
      <div>
        Status: 
        {isLocked && <span style={{ color: 'green' }}> SECURED</span>}
        {isUnlocked && <span style={{ color: 'orange' }}> UNLOCKED</span>}
        {isUnknown && <span style={{ color: 'red' }}> UNKNOWN</span>}
      </div>
      
      <p>Last changed: {lastChanged.toLocaleString()}</p>
    </div>
  )}
</Lock>
```

### Auto-Lock Timer

```tsx
<Lock entityId="lock.front_door">
  {({ isLocked, lock, unlock, attributes }) => {
    const [autoLockTimer, setAutoLockTimer] = useState<number | null>(null)
    
    const handleUnlock = () => {
      unlock()
      
      // Auto-lock after 30 seconds
      const timer = setTimeout(() => {
        lock()
        setAutoLockTimer(null)
      }, 30000)
      
      setAutoLockTimer(timer)
    }
    
    const handleLock = () => {
      lock()
      if (autoLockTimer) {
        clearTimeout(autoLockTimer)
        setAutoLockTimer(null)
      }
    }
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        <p>Status: {isLocked ? 'LOCKED' : 'UNLOCKED'}</p>
        {autoLockTimer && <p>Auto-lock in 30 seconds...</p>}
        
        <button onClick={handleLock} disabled={isLocked}>
          Lock
        </button>
        
        <button onClick={handleUnlock} disabled={!isLocked}>
          Unlock (30s auto-lock)
        </button>
      </div>
    )
  }}
</Lock>
```

### Using Hooks

```tsx
import { useLock } from 'hass-react'

function LockCard({ entityId }) {
  const lock = useLock(entityId)
  
  const getStatusColor = () => {
    if (lock.isLocked) return 'green'
    if (lock.isUnlocked) return 'orange'
    return 'red'
  }
  
  const getStatusText = () => {
    if (lock.isLocked) return 'SECURED'
    if (lock.isUnlocked) return 'UNLOCKED'
    return 'UNKNOWN'
  }
  
  return (
    <div>
      <h3>{lock.attributes.friendly_name}</h3>
      
      <div style={{ color: getStatusColor() }}>
        Status: {getStatusText()}
      </div>
      
      {lock.changedBy && <p>Changed by: {lock.changedBy}</p>}
      
      <div>
        <button 
          onClick={lock.lock} 
          disabled={lock.isLocked}
        >
          Lock
        </button>
        
        <button 
          onClick={lock.unlock} 
          disabled={lock.isUnlocked}
        >
          Unlock
        </button>
        
        {lock.supportsOpen && (
          <button onClick={lock.open}>
            Open
          </button>
        )}
      </div>
      
      <p>Last updated: {lock.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}