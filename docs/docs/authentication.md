---
sidebar_position: 2
---

# Authentication

hass-react supports both OAuth 2.0 and long-lived token authentication with automatic detection. Choose the method that works best for your setup.

## OAuth 2.0 (Recommended)

OAuth provides secure, user-friendly authentication without exposing tokens in your code:

```tsx
<HAProvider url="http://homeassistant.local:8123" authMode="oauth">
  <YourApp />
</HAProvider>
```

When using OAuth:
- Users get a standard login flow
- No tokens to manage or secure
- Automatic token refresh with periodic background refresh and visibility-based refresh
- Sessions persist across app restarts and long periods of inactivity
- Users can revoke access from Home Assistant settings

## Long-lived Token

Traditional token-based authentication for when you have a specific token:

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

This mode is intended for always-on deployments such as kiosks and wall-mounted dashboards. Because the browser never authenticates with Home Assistant, there is no browser session or token to expire — the dashboard does not land back on a login screen. The gateway maintains the authenticated Home Assistant connection while the browser receives sanitized events and sends allowlisted commands.

See [External Transports](/docs/advanced/external-transports) for the transport contract and security requirements.

## Auto-detection (Default)

By default, hass-react chooses the best authentication method automatically:

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

Configure automatic token refresh behavior to maintain long-lived sessions:

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
- **Default Values**: 30 minutes for refresh interval, 5 minutes for buffer

This ensures users don't get logged out when:
- Leaving the app open for extended periods (ideal for wall-mounted tablets)
- Experiencing temporary network connectivity issues
- Switching between apps/tabs frequently
- Returning to the app after hours away

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

**Note**: The retry mechanism ensures that even if refresh fails temporarily, the app will keep trying automatically without logging the user out. This is especially useful for always-on control panels like wall-mounted tablets.

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

For custom authentication flows, use the `useAuth` hook directly:

```tsx
import { useAuth } from 'hass-react'

function CustomAuth() {
  const { authenticated, login, logout, loading, error } = useAuth(
    'http://homeassistant.local:8123',
    'oauth'
  )

  if (loading) return <div>Authenticating...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!authenticated) return <button onClick={login}>Login</button>
  
  return <button onClick={logout}>Logout</button>
}
```

## Current User Information

The `useCurrentUser` hook provides information about the currently authenticated user. This is especially useful for:
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
- Ensure Home Assistant is running and reachable from your app
- For tokens: verify the token hasn't expired or been revoked

**"Connection refused"**
- Check the Home Assistant URL (including port 8123)
- Verify your network connection
- Check if Home Assistant is behind a firewall or proxy

**OAuth redirect issues**
- Ensure your app URL is whitelisted in Home Assistant
- Check browser console for CORS or redirect errors