# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Mock mode now transitions media player state (play/pause/stop, volume, mute, source, shuffle, repeat, power) and legacy vacuum power (`turn_on`/`turn_off`); `media_player.toggle` correctly acts as a power toggle

## [1.0.0] - 2026-08-10

### Added
- External transport support through the `HAProvider` `transport` prop and the public `HAConnection`, `HATransport`, and `HATransportHandlers` types
- RGBW and RGBWW light color-mode support

### Changed
- **BREAKING:** Camera service methods now require their Home Assistant targets: migrate `snapshot()` to `snapshot(filename)`, `record(undefined, duration)` to `record(filename, duration)`, and `playStream()` to `playStream(mediaPlayer)`
- **BREAKING:** `setColorTemp` now accepts kelvin and sends `color_temp_kelvin`, aligned with Home Assistant 2026.3; migrate mired values to kelvin and read the bounds from the new `minColorTempKelvin` and `maxColorTempKelvin` state fields

### Fixed
- Connection failures are normalized into typed authentication errors, including numeric errors from `home-assistant-js-websocket`
- Provider disconnect and reconnect cleanup no longer leaks connections or event listeners
- Entity updates use one shared, connection-aware `state_changed` subscription and remove entities when Home Assistant sends a null state
- Refreshed OAuth credentials are persisted so sessions survive reloads
- CommonJS consumers load the complete package from the corrected `.cjs` entry point
- Alarm trigger and vacation-arm feature bits now match Home Assistant
- Todo clear-completed support is gated by the delete-item feature bit
- Calendar `getEvents` unwraps Home Assistant's `return_response` envelope
- Cover controls are gated by their corresponding Home Assistant feature bits

## [0.15.8] - 2025-12-10

### Fixed
- Reconnects close the previous Home Assistant connection and clean up entity subscriptions before replacing them, preventing subscription cleanup races and connection leaks

## [0.15.7] - 2025-12-05

### Fixed
- Entity-store reconnects wait for old subscriptions to settle and remove an existing entity subscription before installing its replacement

## [0.15.6] - 2025-12-02

### Fixed
- Periodic OAuth refresh now refreshes on every configured interval
- Replacing a closed connection tolerates unsubscribe failures while clearing old entity subscriptions

## [0.15.5] - 2025-12-01

### Fixed
- The date-time sensor warning effect now cleans up correctly across connected, available, and unavailable states

## [0.15.4] - 2025-12-01

### Fixed
- Stale or mismatched OAuth callback parameters are removed before starting a fresh authorization flow
- Date-time sensor warnings wait for initial entity state updates before reporting a missing sensor

## [0.15.3] - 2025-11-30

### Fixed
- OAuth refresh retries clean up their pending timers and report failures consistently
- OAuth redirect URIs are normalized to avoid loops, and refresh requests receive the correct client ID
- Date-time sensor warnings are suppressed until Home Assistant is connected

## [0.15.2] - 2025-11-29

### Added
- Exponential-backoff retries for periodic and visibility-triggered OAuth token refreshes

### Fixed
- OAuth redirect loops and unreliable token renewal with stored sessions
- Default proactive token refresh buffer restored to 5 minutes

## [0.15.1] - 2025-01-27

### Fixed
- Home Assistant login page refreshing multiple times during OAuth authentication flow due to duplicate redirect attempts within 1 second window

## [0.15.0] - 2025-01-27

### Added
- Automatic token refresh for OAuth sessions to prevent authentication expiration
- `tokenRefreshIntervalMinutes` configuration option (default: 30) for periodic token refresh checks
- `tokenRefreshBufferMinutes` configuration option (default: 5) for proactive token refresh timing
- Visibility change handler that refreshes tokens when users return to the app after being away
- Comprehensive test coverage for token refresh functionality (8 new tests)

### Fixed
- OAuth authentication expiring after a couple hours of inactivity, forcing users to re-authenticate
- Sessions now persist correctly across long periods with app open or when returning after hours away

### Changed
- Default token refresh buffer set to 5 minutes for proactive session renewal
- Internal: `createAuthenticatedConnection` now returns `{ connection, auth }` instead of just connection (non-breaking for public API)

### Documentation
- Added OAuth Token Refresh configuration section to authentication docs
- Updated OAuth benefits to mention persistent sessions and automatic refresh behavior
- Added examples for configuring token refresh intervals

## [0.14.0] and earlier

See [GitHub Releases](https://github.com/dlwiest/hass-react/releases) for historical changes.
