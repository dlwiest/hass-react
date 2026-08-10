# Development & Testing

You won't always have a real Home Assistant instance to point at while you build. Mock mode and the built-in development warnings cover that gap.

## Mock Mode

Mock mode lets you develop without connecting to anything. Set `mockMode: true` on `HAProvider` and pass the entities you want:

```tsx
import { HAProvider } from 'hass-react';

const mockEntities = {
  'light.living_room': {
    entity_id: 'light.living_room',
    state: 'on',
    attributes: {
      friendly_name: 'Living Room Light',
      brightness: 180,
      color_temp_kelvin: 3000
    },
    last_changed: '2024-01-15T10:30:00Z',
    last_updated: '2024-01-15T10:30:00Z',
    context: { id: '1', parent_id: null, user_id: null }
  },
  'sensor.temperature': {
    entity_id: 'sensor.temperature',
    state: '22.5',
    attributes: {
      friendly_name: 'Living Room Temperature',
      unit_of_measurement: '°C',
      device_class: 'temperature'
    },
    last_changed: '2024-01-15T10:25:00Z',
    last_updated: '2024-01-15T10:30:00Z',
    context: { id: '2', parent_id: null, user_id: null }
  }
};

function App() {
  return (
    <HAProvider 
      url="mock://localhost" 
      mockMode={true} 
      mockData={mockEntities}
    >
      <YourApp />
    </HAProvider>
  );
}
```

## Mock Entity Behavior

Mock entities behave like real entities with state transitions:

```tsx
function MockLightDemo() {
  const light = useLight('light.living_room');
  
  return (
    <div>
      <h3>{light.attributes.friendly_name}</h3>
      <p>State: {light.isOn ? 'On' : 'Off'}</p>
      <p>Brightness: {light.brightness}</p>
      
      {/* These actions will update mock state */}
      <button onClick={light.toggle}>
        {light.isOn ? 'Turn Off' : 'Turn On'}
      </button>
      
      <button onClick={() => light.setBrightness(255)}>
        Max Brightness
      </button>
    </div>
  );
}
```

## Mock Service Calls

Service calls in mock mode go through the same feature checks as real ones, so give the mock entity the `supported_features` bits it needs:

```tsx
// Add to your mockData so the service calls are allowed
const mockTodoData = {
  'todo.shopping_list': {
    entity_id: 'todo.shopping_list',
    state: '2',
    attributes: {
      friendly_name: 'Shopping List',
      supported_features: 7 // 1 = add items, 2 = delete, 4 = update
    },
    last_changed: '2024-01-15T10:00:00Z',
    last_updated: '2024-01-15T10:00:00Z',
    context: { id: '3', parent_id: null, user_id: null }
  }
};

function MockTodoDemo() {
  const todos = useTodo('todo.shopping_list');
  
  const addItem = async () => {
    // This works in mock mode and updates the mock state
    await todos.addItem('Buy groceries');
  };
  
  const toggleItem = async (uid: string) => {
    // State transitions are simulated
    await todos.toggleItem(uid);
  };
  
  return (
    <div>
      <h3>Shopping List ({todos.itemCount} items)</h3>
      
      <ul>
        {todos.items.map((item) => (
          <li key={item.uid}>
            <input 
              type="checkbox"
              checked={item.status === 'completed'}
              onChange={() => toggleItem(item.uid)}
            />
            {item.summary}
          </li>
        ))}
      </ul>
      
      <button onClick={addItem}>Add Item</button>
      <button onClick={todos.clearCompleted}>Clear Completed</button>
    </div>
  );
}
```

## Development Environment Setup

Set up different configurations for development vs production:

```tsx
// config/environment.ts
interface AppConfig {
  hassUrl: string;
  mockMode: boolean;
  mockData?: Record<string, any>;
}

const config: AppConfig = {
  hassUrl: process.env.NODE_ENV === 'development' 
    ? 'mock://localhost'
    : process.env.REACT_APP_HASS_URL || 'http://homeassistant.local:8123',
  
  mockMode: process.env.NODE_ENV === 'development',
  
  mockData: process.env.NODE_ENV === 'development' ? {
    'light.kitchen': {
      entity_id: 'light.kitchen',
      state: 'off',
      attributes: { friendly_name: 'Kitchen Light', brightness: 0 },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: '1', parent_id: null, user_id: null }
    },
    'switch.coffee_maker': {
      entity_id: 'switch.coffee_maker',
      state: 'off',
      attributes: { friendly_name: 'Coffee Maker' },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: '2', parent_id: null, user_id: null }
    }
  } : undefined
};

export default config;
```

```tsx
// App.tsx
import { HAProvider } from 'hass-react';
import config from './config/environment';

function App() {
  return (
    <HAProvider 
      url={config.hassUrl}
      mockMode={config.mockMode}
      mockData={config.mockData}
    >
      <Dashboard />
    </HAProvider>
  );
}
```

## Validation and Development Warnings

hass-react warns about common mistakes during development:

### Entity ID Format Validation

```tsx
function BadExample() {
  // This will show a console warning in development:
  // "Invalid entity ID format. Entity IDs should be in format domain.entity_name"
  const light = useLight('invalid_id_without_domain');
  
  return <div>This won't work properly</div>;
}

function GoodExample() {
  // Proper entity ID format
  const light = useLight('light.living_room');
  
  return <div>This works correctly</div>;
}
```

### Missing Entity Warnings

```tsx
function EntityCheck() {
  const light = useLight('light.nonexistent');
  
  // After 2 seconds, you'll see:
  // "Entity light.nonexistent not found in Home Assistant. 
  //  Check that the entity exists and is available."
  
  if (light.error) {
    return <div>Entity not found: {light.error.message}</div>;
  }
  
  return <div>Light: {light.state}</div>;
}
```

## Testing Patterns

### Component Testing with Mock Data

```tsx
// tests/LightControl.test.tsx
import { render, fireEvent } from '@testing-library/react';
import { HAProvider } from 'hass-react';
import LightControl from '../components/LightControl';

const mockLightData = {
  'light.test': {
    entity_id: 'light.test',
    state: 'off',
    attributes: {
      friendly_name: 'Test Light',
      brightness: 0
    },
    last_changed: '2024-01-15T10:00:00Z',
    last_updated: '2024-01-15T10:00:00Z',
    context: { id: '1', parent_id: null, user_id: null }
  }
};

function TestWrapper({ children }) {
  return (
    <HAProvider 
      url="mock://test"
      mockMode={true}
      mockData={mockLightData}
    >
      {children}
    </HAProvider>
  );
}

test('light control toggles state', async () => {
  const { getByRole, findByText } = render(
    <TestWrapper>
      <LightControl entityId="light.test" />
    </TestWrapper>
  );
  
  // Initial state
  expect(await findByText('Off')).toBeInTheDocument();
  
  // Toggle light
  fireEvent.click(getByRole('button', { name: /turn on/i }));
  
  // Check updated state
  expect(await findByText('On')).toBeInTheDocument();
});
```

### Integration Testing

```tsx
// tests/integration/Dashboard.test.tsx
import { render, waitFor } from '@testing-library/react';
import { HAProvider } from 'hass-react';
import Dashboard from '../Dashboard';

const fullMockData = {
  'light.living_room': { /* ... */ },
  'sensor.temperature': { /* ... */ },
  'switch.coffee_maker': { /* ... */ }
};

test('dashboard displays all entities', async () => {
  const { getByText } = render(
    <HAProvider 
      url="mock://integration-test"
      mockMode={true}
      mockData={fullMockData}
    >
      <Dashboard />
    </HAProvider>
  );
  
  await waitFor(() => {
    expect(getByText('Living Room Light')).toBeInTheDocument();
    expect(getByText('22.5°C')).toBeInTheDocument();
    expect(getByText('Coffee Maker')).toBeInTheDocument();
  });
});
```

## Mock Data Helpers

Create reusable mock data generators:

```tsx
// utils/mockData.ts
export function createMockLight(
  entityId: string, 
  overrides: Partial<any> = {}
) {
  return {
    entity_id: entityId,
    state: 'off',
    attributes: {
      friendly_name: entityId.replace('light.', '').replace('_', ' '),
      brightness: 0,
      supported_features: 1,
      ...overrides.attributes
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: Math.random().toString(), parent_id: null, user_id: null },
    ...overrides
  };
}

export function createMockSensor(
  entityId: string, 
  value: string,
  overrides: Partial<any> = {}
) {
  return {
    entity_id: entityId,
    state: value,
    attributes: {
      friendly_name: entityId.replace('sensor.', '').replace('_', ' '),
      unit_of_measurement: '°C',
      device_class: 'temperature',
      ...overrides.attributes
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: Math.random().toString(), parent_id: null, user_id: null },
    ...overrides
  };
}

// Usage
const mockData = {
  'light.kitchen': createMockLight('light.kitchen', { state: 'on' }),
  'light.bedroom': createMockLight('light.bedroom'),
  'sensor.temperature': createMockSensor('sensor.temperature', '22.5'),
  'sensor.humidity': createMockSensor('sensor.humidity', '45', {
    attributes: { 
      unit_of_measurement: '%',
      device_class: 'humidity'
    }
  })
};
```

## Environment Variables

Use environment variables for flexible configuration:

```bash
# .env.development
REACT_APP_MOCK_MODE=true
REACT_APP_HASS_URL=mock://localhost

# .env.production
REACT_APP_MOCK_MODE=false
REACT_APP_HASS_URL=http://homeassistant.local:8123
```

```tsx
const config = {
  mockMode: process.env.REACT_APP_MOCK_MODE === 'true',
  hassUrl: process.env.REACT_APP_HASS_URL || 'http://localhost:8123'
};
```

Build against mocks during development, then point at your real instance when you deploy. The code doesn't change.