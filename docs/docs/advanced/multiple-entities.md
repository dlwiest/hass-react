---
sidebar_position: 1
---

# Working with Multiple Entities

Dashboards usually need more than one entity at a time. The `useEntityGroup` hook subscribes to a list of entities in a single call.

## useEntityGroup Hook

Pass `useEntityGroup` a list of entity IDs and it returns an array of raw `EntityState` objects, updated whenever any of them change:

```tsx
import { useEntityGroup } from 'hass-react';

function RoomLights() {
  // Track multiple light entities
  const entities = useEntityGroup([
    'light.living_room',
    'light.kitchen',
    'light.dining_room'
  ]);

  return (
    <div>
      {entities.map((entity) => (
        <div key={entity.entity_id}>
          <h3>{entity.attributes.friendly_name || entity.entity_id}</h3>
          <p>State: {entity.state}</p>
          <p>Last Updated: {new Date(entity.last_updated).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
```

## Working with Mixed Entity Types

You can group different types of entities together:

```tsx
function SecurityOverview() {
  const securityEntities = useEntityGroup([
    'lock.front_door',
    'lock.back_door',
    'binary_sensor.front_door',
    'binary_sensor.motion_detector',
    'alarm_control_panel.house'
  ]);

  const doors = securityEntities.filter(e => e.entity_id.startsWith('lock.'));
  const sensors = securityEntities.filter(e => e.entity_id.startsWith('binary_sensor.'));
  const alarm = securityEntities.find(e => e.entity_id.startsWith('alarm_control_panel.'));

  return (
    <div className="security-overview">
      <section>
        <h3>Door Locks</h3>
        {doors.map((door) => (
          <div key={door.entity_id}>
            {door.attributes.friendly_name}: {door.state}
          </div>
        ))}
      </section>
      
      <section>
        <h3>Security Sensors</h3>
        {sensors.map((sensor) => (
          <div key={sensor.entity_id}>
            {sensor.attributes.friendly_name}: {sensor.state}
          </div>
        ))}
      </section>
      
      {alarm && (
        <section>
          <h3>Alarm System</h3>
          <div>Status: {alarm.state}</div>
        </section>
      )}
    </div>
  );
}
```

## Dynamic Entity Lists

You can dynamically change which entities you're tracking:

```tsx
function FloorControl() {
  const [selectedFloor, setSelectedFloor] = useState('ground');
  
  const floorEntities = {
    ground: ['light.living_room', 'light.kitchen', 'light.dining_room'],
    upstairs: ['light.bedroom', 'light.bathroom', 'light.office']
  };
  
  const entities = useEntityGroup(floorEntities[selectedFloor]);

  return (
    <div>
      <nav>
        <button 
          onClick={() => setSelectedFloor('ground')}
          className={selectedFloor === 'ground' ? 'active' : ''}
        >
          Ground Floor
        </button>
        <button 
          onClick={() => setSelectedFloor('upstairs')}
          className={selectedFloor === 'upstairs' ? 'active' : ''}
        >
          Upstairs
        </button>
      </nav>
      
      <div className="entity-grid">
        {entities.map((entity) => (
          <LightCard key={entity.entity_id} entity={entity} />
        ))}
      </div>
    </div>
  );
}
```

## Combining with Individual Entity Hooks

`useEntityGroup` returns read-only state. When some entities also need controls, pair it with individual hooks:

```tsx
function LightingDashboard() {
  // Get overview of all lights
  const allLights = useEntityGroup([
    'light.living_room',
    'light.kitchen', 
    'light.bedroom',
    'light.bathroom'
  ]);

  // Individual hooks for lights that need controls
  const livingRoom = useLight('light.living_room');
  const kitchen = useLight('light.kitchen');

  const totalLights = allLights.length;
  const lightsOn = allLights.filter(light => light.state === 'on').length;

  return (
    <div>
      <div className="summary">
        <h2>Lighting Overview</h2>
        <p>{lightsOn} of {totalLights} lights are on</p>
        
        <button 
          onClick={() => {
            allLights.forEach(light => {
              // Would need individual hooks for each to control them
              // This is just for display
            });
          }}
          disabled={lightsOn === totalLights}
        >
          Turn All On
        </button>
      </div>

      <div className="light-controls">
        <LightControl 
          name="Living Room" 
          light={livingRoom} 
        />
        <LightControl 
          name="Kitchen" 
          light={kitchen} 
        />
        
        {/* Read-only displays for other lights */}
        {allLights
          .filter(light => !['light.living_room', 'light.kitchen'].includes(light.entity_id))
          .map(light => (
            <LightDisplay key={light.entity_id} entity={light} />
          ))
        }
      </div>
    </div>
  );
}
```

## Performance Considerations

`useEntityGroup` subscribes only to the entities you pass it and unsubscribes when they leave the list. It re-renders only when a tracked entity actually changes.

```tsx
function OptimizedDashboard() {
  const [showDetails, setShowDetails] = useState(false);
  
  // Always track core entities
  const coreEntities = useEntityGroup([
    'sensor.temperature',
    'sensor.humidity',
    'binary_sensor.motion'
  ]);
  
  // Only track detailed entities when needed
  const detailedEntities = useEntityGroup(
    showDetails ? [
      'sensor.pressure',
      'sensor.light_level', 
      'sensor.air_quality',
      'sensor.noise_level'
    ] : []
  );

  return (
    <div>
      <div className="core-stats">
        {coreEntities.map(entity => (
          <StatCard key={entity.entity_id} entity={entity} />
        ))}
      </div>
      
      <button onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
      
      {showDetails && (
        <div className="detailed-stats">
          {detailedEntities.map(entity => (
            <StatCard key={entity.entity_id} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Error Handling

Entities in the group might be unavailable or have errors:

```tsx
function AvailabilityAwareGroup() {
  const entities = useEntityGroup([
    'light.living_room',
    'light.possibly_offline',
    'sensor.temperature'
  ]);

  const availableEntities = entities.filter(entity => 
    entity.state !== 'unavailable' && entity.state !== 'unknown'
  );
  
  const unavailableCount = entities.length - availableEntities.length;

  return (
    <div>
      {unavailableCount > 0 && (
        <div className="warning">
          {unavailableCount} entities are currently unavailable
        </div>
      )}
      
      {availableEntities.map(entity => (
        <EntityCard key={entity.entity_id} entity={entity} />
      ))}
    </div>
  );
}
```

## Raw Entity State Access

`useEntityGroup` returns raw `EntityState` objects with the following structure:

```tsx
interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}
```

## Single Entity Pattern

If you only need raw state data, `useEntityGroup` works with a single entity too (it also accepts a bare string instead of an array):

```tsx
function SimpleEntityDisplay() {
  // Alternative to useLight when you only need to display state
  const [temperatureEntity] = useEntityGroup(['sensor.temperature']);
  
  if (!temperatureEntity) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3>{temperatureEntity.attributes.friendly_name}</h3>
      <p>
        {temperatureEntity.state}
        {temperatureEntity.attributes.unit_of_measurement}
      </p>
    </div>
  );
}
```

Use `useEntityGroup` anywhere you need to watch a batch of entities without wiring up an individual hook for each one.