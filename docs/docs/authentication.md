---
sidebar_position: 2
---

# Authentication

hass-react supports OAuth 2.0 and long-lived token authentication, and detects which to use based on the props you pass.

## OAuth 2.0 (Recommended)

OAuth gives users a normal Home Assistant login and keeps tokens out of your code:

```tsx
<HAProvider url="http://homeassistant.local:8123" authMode="oauth">
  <YourApp />
</HAProvider>
```

When using OAuth:
- Users get a standard login flow
- No tokens to manage or secure
- Tokens refresh automatically in the background and when the app regains focus
- Sessions persist across app restarts and long periods of inactivity
- Users can revoke access from Home Assistant settings

## Long-lived Token

Already have a long-lived access token? Pass it directly:

```tsx
<HAProvider 
  url="http://homeassistant.local:8123" 
  token="your-long-lived-access-token"
>
  <YourApp />
</HAProvider>
```

### Creating a Long-lived Token

1. Open Home Assistant
2. Go to your profile (click your name in the sidebar)
3. Scroll to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Give it a name and copy the generated token

## Server-side Authentication

Applications that keep Home Assistant credentials on a server can supply an external transport instead of authenticating the browser directly:

```tsx
<HAProvider url="https://dashboard.example.com" transport={gatewayTransport}>
  <YourApp />
</HAProvider>
```

This mode is for always-on deployments like kiosks and wall-mounted dashboards. The browser never authenticates with Home Assistant, so there's no session or token to expire and the dashboard never lands back on a login screen. The gateway holds the authenticated connection while the browser receives sanitized events and sends allowlisted commands.

See [External Transports](/docs/advanced/external-transports) for the transport contract and security requirements.

## Auto-detection (Default)

By default, hass-react picks the authentication method based on whether you pass a token:

```tsx
// Uses OAuth if no token provided
<HAProvider url="http://homeassistant.local:8123">
  <YourApp />
</HAProvider>

// Uses token auth if token provided  
<HAProvider url="http://homeassistant.local:8123" token="your-token">
  <YourApp />
</HAProvider>
```

## Connection Management

### Monitoring Connection Status

Use the `useHAConnection` hook to monitor connection health:

```tsx
import { useHAConnection } from 'hass-react'

function ConnectionIndicator() {
  const { connected, connecting, error, reconnect } = useHAConnection()
  
  if (connecting) return <span>🔄 Connecting...</span>
  if (!connected && error) return (
    <div>
      ⚠️ Connection failed: {error.message}
      <button onClick={reconnect}>Retry</button>
    </div>
  )
  if (!connected) return <span>🔴 Disconnected</span>
  return <span>🟢 Connected</span>
}
```

### Logout (OAuth Only)

For OAuth authentication, you can programmatically log users out:

```tsx
import { useHAConnection } from 'hass-react'

function LogoutButton() {
  const { logout, connected } = useHAConnection()

  return (
    <button onClick={logout} disabled={!connected}>
      Logout
    </button>
  )
}
```

The logout function:
- Clears stored OAuth tokens from localStorage
- Immediately closes the WebSocket connection
- Stops all entity controls from working
- Triggers a new OAuth flow on the next connection attempt

## Configuration Options

### Connection Settings

```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  options={{
    reconnectInterval: 5000,    // Time between reconnection attempts (ms)
    reconnectAttempts: 10,      // Max reconnection attempts
    autoReconnect: true,        // Auto-reconnect on connection loss
  }}
/>
```

### OAuth Token Refresh (OAuth Only)

Configure token refresh to keep long-running sessions alive:

```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  authMode="oauth"
  options={{
    tokenRefreshIntervalMinutes: 30,  // Check for token refresh every 30 minutes (default)
    tokenRefreshBufferMinutes: 5,     // Refresh token if expires within 5 minutes (default)
  }}
/>
```

**How it works:**
- **Periodic Refresh**: Tokens are checked and refreshed every 30 minutes (default) while connected
- **Visibility Refresh**: When you return to the app after being away, tokens are automatically refreshed if needed
- **Retry with Exponential Backoff**: If token refresh fails (e.g., network issue), the library automatically retries:
  - Periodic refresh: up to 5 retries (1min, 2min, 4min, 8min, 16min delays)
  - Visibility refresh: up to 3 retries (30s, 60s, 120s delays)

This keeps users logged in when:
- The app stays open for days (wall-mounted tablets)
- The network drops for a bit
- They switch between apps or tabs
- They come back after hours away

**Example with more frequent refresh checks:**
```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  authMode="oauth"
  options={{
    tokenRefreshIntervalMinutes: 5,   // Check for token refresh every 5 minutes
    tokenRefreshBufferMinutes: 10,    // Refresh if token expires within 10 minutes
  }}
/>
```

**Note**: If a refresh fails temporarily, the library keeps retrying instead of logging the user out. Handy for always-on panels like wall-mounted tablets.

### Service Call Retry

Configure how service calls retry on failure:

```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  options={{
    serviceRetry: {
      maxAttempts: 3,           // Retry up to 3 times
      baseDelay: 1000,          // Start with 1 second delay
      exponentialBackoff: true, // Delays: 1s, 2s, 4s
      maxDelay: 10000          // Cap delays at 10 seconds
    }
  }}
/>
```

## useAuth Hook

Use the `useAuth` hook to render custom authentication state inside `HAProvider`:

```tsx
import { useAuth } from 'hass-react'

function AuthStatus() {
  const { isAuthenticated, isLoading, logout, error } = useAuth(
    'http://homeassistant.local:8123',
    'oauth'
  )

  if (isLoading) return <div>Authenticating...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!isAuthenticated) return <div>Redirecting to Home Assistant...</div>

  return <button onClick={logout}>Logout</button>
}
```

`HAProvider` drives the OAuth redirect when no valid stored session exists.
`useAuth` reports authentication state for your own UI; you don't need a login button to start the flow.

## Current User Information

The `useCurrentUser` hook returns the authenticated user. Useful for:
- Displaying personalized greetings
- Conditional rendering based on user roles (admin/owner)
- Logging and analytics
- Multi-user applications

### Basic Usage

```tsx
import { useCurrentUser } from 'hass-react'

function UserGreeting() {
  const user = useCurrentUser()

  if (!user) {
    return null // Not yet loaded or no user
  }

  return (
    <div>
      <h2>Hello, {user.name}!</h2>
      {user.is_admin && <span>Admin</span>}
      {user.is_owner && <span>Owner</span>}
    </div>
  )
}
```

### User Properties

The hook returns a `CurrentUser` object with the following properties:

```typescript
interface CurrentUser {
  id: string                  // Unique user identifier
  name: string                // Display name
  is_owner: boolean           // True if user owns the Home Assistant instance
  is_admin: boolean           // True if user has admin privileges
  local_only: boolean         // True if user can only auth from local network
  system_generated: boolean   // True if user was created by the system
  group_ids: string[]         // Array of group IDs the user belongs to
}
```

### Conditional Rendering by Role

Use the user information to show/hide features based on permissions:

```tsx
function AdminPanel() {
  const user = useCurrentUser()

  // Only show admin panel to admins
  if (!user?.is_admin) {
    return <p>Access denied</p>
  }

  return (
    <div>
      <h2>Admin Panel</h2>
      {/* Admin-only controls */}
    </div>
  )
}
```

### Authentication Method Compatibility

The `useCurrentUser` hook works with both authentication methods:

- **OAuth**: Returns full user information for the authenticated user
- **Long-lived Token**: Returns user information associated with the token

The hook returns `null` when:
- Not yet connected to Home Assistant
- User information hasn't loaded
- An error occurred fetching user data

### Mock Mode

In mock mode, you can provide custom user data for development and testing:

```tsx
<HAProvider
  url="http://homeassistant.local:8123"
  mockMode={true}
  mockUser={{
    id: 'test-user-123',
    name: 'Test User',
    is_owner: true,
    is_admin: true,
    local_only: false,
    system_generated: false,
    group_ids: ['test-group']
  }}
>
  <YourApp />
</HAProvider>
```

If no `mockUser` is provided, mock mode uses a default mock user with admin and owner privileges.

## Troubleshooting

### Common Issues

**"Authentication failed"**
- Check that your Home Assistant URL is correct and accessible
- Make sure Home Assistant is running and reachable from your app
- For tokens: verify the token hasn't expired or been revoked

**"Connection refused"**
- Check the Home Assistant URL (including port 8123)
- Verify your network connection
- Check if Home Assistant is behind a firewall or proxy

**OAuth redirect issues**
- Make sure your app URL is whitelisted in Home Assistant
- Check browser console for CORS or redirect errors