# Error Handling & Connection Status

Networks drop, entities disappear, service calls fail. hass-react gives you typed errors and connection state hooks so your UI can handle all of it.

## Error Types and Handling

Errors are typed so you can branch on what actually went wrong. All custom errors extend `HomeAssistantError` and include:

- **message**: Technical error message for logging/debugging
- **userMessage**: User-friendly message safe to display in UI
- **recoverable**: Whether the error can be retried (used by automatic retry logic)
- **retryAction**: Suggested action to take (`'retry'`, `'check_entity'`, `'check_network'`, `'check_config'`, `'contact_admin'`, or `'none'`)
- **code**: Unique error code for programmatic handling
- **context**: Additional error context data

### Displaying User-Friendly Error Messages

```tsx
import { getUserFriendlyErrorMessage } from 'hass-react';

function LightControl() {
  const light = useLight('light.living_room');
  const [error, setError] = useState(null);

  const handleToggle = async () => {
    try {
      await light.toggle();
      setError(null);
    } catch (err) {
      // Display user-friendly message in UI
      setError(getUserFriendlyErrorMessage(err));
      // Log technical details for debugging
      console.error('Toggle failed:', err.message, err.context);
    }
  };

  return (
    <div>
      <button onClick={handleToggle}>Toggle Light</button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Automatic Retry for Recoverable Errors

Service calls automatically retry recoverable errors with exponential backoff. You can configure retry behavior in `HAProvider`:

```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  options={{
    serviceRetry: {
      maxAttempts: 3,              // Maximum retry attempts (default: 3)
      baseDelay: 1000,             // Initial delay in ms (default: 1000)
      exponentialBackoff: true,    // Use exponential backoff (default: true)
      maxDelay: 10000              // Maximum delay in ms (default: 10000)
    }
  }}
>
  <App />
</HAProvider>
```

The retry logic automatically handles:
- Network timeouts
- Temporary service unavailability (503, 502 errors)
- Connection errors
- Any error where `error.recoverable === true`

Non-retryable errors (like feature not supported, invalid parameters) fail immediately.

### Connection Errors

```tsx
import { ConnectionError } from 'hass-react';

function LightControl() {
  const light = useLight('light.living_room');
  const [error, setError] = useState(null);

  const handleToggle = async () => {
    try {
      await light.toggle();
      setError(null);
    } catch (err) {
      if (err instanceof ConnectionError) {
        setError('Not connected to Home Assistant. Please check your connection.');
      } else {
        setError(`Failed to toggle light: ${err.message}`);
      }
    }
  };

  return (
    <div>
      <button onClick={handleToggle}>Toggle Light</button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Entity Availability Errors

```tsx
function SensorDisplay() {
  const sensor = useSensor('sensor.temperature');
  const { connected } = useHAConnection();

  // Check for entity-level errors
  if (sensor.error) {
    return (
      <div className="warning">
        <h3>Sensor Unavailable</h3>
        <p>{sensor.error.message}</p>
        {connected && (
          <p>The sensor may not exist or be temporarily offline.</p>
        )}
      </div>
    );
  }

  // Check for connection issues
  if (!connected) {
    return (
      <div className="info">
        <p>Waiting for Home Assistant connection...</p>
      </div>
    );
  }

  return (
    <div>
      <h3>Temperature</h3>
      <p>{sensor.value}° {sensor.unitOfMeasurement}</p>
    </div>
  );
}
```

### Feature Support Errors

```tsx
function SmartLightControl() {
  const light = useLight('light.smart_bulb');
  const [error, setError] = useState(null);

  const handleColorChange = async (color) => {
    if (!light.supportsRgb) {
      setError('This light does not support color changes');
      return;
    }

    try {
      await light.setRgbColor(color);
      setError(null);
    } catch (err) {
      setError(`Failed to change color: ${err.message}`);
    }
  };

  return (
    <div>
      <h3>Smart Light</h3>
      <button onClick={() => light.toggle()}>
        {light.isOn ? 'Turn Off' : 'Turn On'}
      </button>

      {light.supportsRgb && (
        <button onClick={() => handleColorChange([255, 0, 0])}>
          Set Red
        </button>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

## Monitoring Connection Status

Many errors come down to connection state. The `useHAConnection` hook exposes all of it:

```tsx
import { useHAConnection } from 'hass-react';

function ConnectionStatus() {
  const {
    connected,
    connecting,
    error,
    connectionState,
    retryCount,
    nextRetryIn,
    isAutoRetrying,
    reconnect,
    config
  } = useHAConnection();

  if (connecting) {
    return <div>Connecting to Home Assistant...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Connection Error: {error.message}</p>
        <button onClick={reconnect}>Retry Connection</button>
      </div>
    );
  }

  if (!connected) {
    return <div>Disconnected from Home Assistant</div>;
  }

  return (
    <div className="status">
      <p>Connected to {config.url}</p>
      <p>Retry count: {retryCount}</p>
      {isAutoRetrying && nextRetryIn && (
        <p>Auto-retry in {Math.ceil(nextRetryIn / 1000)} seconds</p>
      )}
    </div>
  );
}
```

### Connection States

The `connectionState` property tells you exactly where the connection is:

```tsx
function DetailedConnectionStatus() {
  const { connectionState, connected, connecting, error } = useHAConnection();

  const getStatusMessage = () => {
    switch (connectionState) {
      case 'idle':
        return 'Ready to connect';
      case 'connecting':
        return 'Establishing connection...';
      case 'connected':
        return 'Successfully connected';
      case 'disconnected':
        return 'Connection lost';
      case 'error':
        return `Connection failed: ${error?.message}`;
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'green';
      case 'connecting':
        return 'orange';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <div style={{ color: getStatusColor() }}>
      <strong>{getStatusMessage()}</strong>
    </div>
  );
}
```

## Connection Recovery UI

```tsx
function App() {
  const { connected, connecting, error, reconnect, isAutoRetrying, nextRetryIn } = useHAConnection();

  if (!connected && !connecting) {
    return (
      <div className="connection-lost">
        <h2>Connection Lost</h2>
        <p>Unable to connect to Home Assistant</p>

        {error && (
          <div className="error-details">
            <p>Error: {error.message}</p>
          </div>
        )}

        {isAutoRetrying ? (
          <div className="auto-retry">
            <p>Auto-retrying in {Math.ceil((nextRetryIn || 0) / 1000)} seconds...</p>
            <button onClick={reconnect}>Retry Now</button>
          </div>
        ) : (
          <button onClick={reconnect}>Reconnect</button>
        )}
      </div>
    );
  }

  return <YourMainApp />;
}
```

## Global Error Boundary

For handling unexpected errors throughout your app:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  const { connected, reconnect } = useHAConnection();

  return (
    <div className="error-boundary">
      <h2>Something went wrong</h2>
      <details>
        <summary>Error details</summary>
        <pre>{error.message}</pre>
      </details>

      {!connected ? (
        <div>
          <p>You appear to be disconnected from Home Assistant.</p>
          <button onClick={reconnect}>Reconnect</button>
        </div>
      ) : (
        <button onClick={resetErrorBoundary}>Try Again</button>
      )}
    </div>
  );
}

function App() {
  return (
    <HAProvider url="http://homeassistant.local:8123">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <YourApp />
      </ErrorBoundary>
    </HAProvider>
  );
}
```

## Best Practices

### 1. Always Check Connection Status
```tsx
function MyComponent() {
  const { connected } = useHAConnection();
  const light = useLight('light.living_room');

  // Don't render controls when disconnected
  if (!connected) {
    return <div>Connecting to Home Assistant...</div>;
  }

  return <LightControls light={light} />;
}
```

### 2. Handle Entity Errors Gracefully
```tsx
function EntityDisplay({ entityId }) {
  const entity = useEntity(entityId);

  if (entity.error) {
    return (
      <div className="entity-error">
        <p>Warning: {entity.attributes.friendly_name || entityId}</p>
        <small>{entity.error.message}</small>
      </div>
    );
  }

  return (
    <div className="entity-display">
      <p>{entity.attributes.friendly_name || entityId}</p>
      <p>State: {entity.state}</p>
    </div>
  );
}
```

### 3. Provide User Feedback for Actions
```tsx
function LightControl() {
  const light = useLight('light.living_room');
  const [error, setError] = useState(null);

  const handleToggle = async () => {
    try {
      await light.toggle();
      setError(null); // Clear any previous errors
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <button onClick={handleToggle}>
        {light.isOn ? 'Turn Off' : 'Turn On'}
      </button>
      {error && (
        <div className="error-message">
          Failed to toggle light: {error}
        </div>
      )}
    </div>
  );
}
```

Most of this comes down to two habits: check `connected` before rendering controls, and surface errors instead of swallowing them.
