---
sidebar_position: 14
---

# Weather

Read current conditions from Home Assistant weather integrations: temperature, humidity, wind, pressure, and more.

## Quick Example

```tsx
// Component approach
<Weather entityId="weather.home">
  {({ condition, temperature, temperatureUnit, humidity, windSpeed, windSpeedUnit }) => (
    <div>
      <p>Condition: {condition}</p>
      <p>Temperature: {temperature}{temperatureUnit}</p>
      <p>Humidity: {humidity}%</p>
      <p>Wind: {windSpeed} {windSpeedUnit}</p>
    </div>
  )}
</Weather>

// Hook approach
const weather = useWeather('weather.home')
<div>
  <p>{weather.condition}</p>
  <p>{weather.temperature}{weather.temperatureUnit}</p>
</div>
```

## Component API

### Basic Usage

```tsx
import { Weather } from 'hass-react'

<Weather entityId="weather.home">
  {(weatherProps) => (
    // Your UI here
  )}
</Weather>
```

### Render Props

The Weather component provides these props to your render function:

#### State Properties
- **`condition`** (`string`) - Current weather condition (sunny, cloudy, rainy, etc.)
- **`temperature`** (`number | null`) - Current temperature
- **`temperatureUnit`** (`string | undefined`) - Temperature unit as reported by Home Assistant (°C or °F); `undefined` if the integration doesn't report one
- **`humidity`** (`number | null`) - Current humidity percentage
- **`pressure`** (`number | null`) - Current atmospheric pressure
- **`pressureUnit`** (`string | undefined`) - Pressure unit (hPa, inHg, etc.); `undefined` when not reported
- **`windSpeed`** (`number | null`) - Wind speed
- **`windSpeedUnit`** (`string | undefined`) - Wind speed unit (km/h, mph, etc.); `undefined` when not reported
- **`windBearing`** (`number | null`) - Wind direction in degrees (0-360)
- **`visibility`** (`number | null`) - Visibility distance
- **`visibilityUnit`** (`string | undefined`) - Visibility unit (km or mi); `undefined` when not reported
- **`cloudCoverage`** (`number | null`) - Cloud coverage percentage
- **`dewPoint`** (`number | null`) - Dew point temperature
- **`apparentTemperature`** (`number | null`) - "Feels like" temperature
- **`precipitationUnit`** (`string | undefined`) - Precipitation unit (mm or in); `undefined` when not reported

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useWeather } from 'hass-react'

function MyComponent() {
  const weather = useWeather('weather.home')

  // All the same properties as component render props
  return (
    <div>
      <p>Condition: {weather.condition}</p>
      <p>Temperature: {weather.temperature}{weather.temperatureUnit}</p>
    </div>
  )
}
```

`useWeather` returns the same properties as the component's render props.

## Examples

### Simple Weather Card

```tsx
<Weather entityId="weather.home">
  {({ condition, temperature, temperatureUnit, humidity, attributes }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <p>{condition.replace('-', ' ')}</p>
      {temperature !== null && (
        <p>{temperature}{temperatureUnit}</p>
      )}
      {humidity !== null && (
        <p>Humidity: {humidity}%</p>
      )}
    </div>
  )}
</Weather>
```

### Detailed Weather Display

```tsx
<Weather entityId="weather.forecast_home">
  {({
    condition, temperature, temperatureUnit,
    humidity, pressure, pressureUnit,
    windSpeed, windSpeedUnit, windBearing,
    apparentTemperature, attributes
  }) => {
    const getWindDirection = (degrees) => {
      if (degrees === null) return 'N/A'
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
      const index = Math.round(degrees / 45) % 8
      return directions[index]
    }

    return (
      <div>
        <h2>{attributes.friendly_name}</h2>
        <div>
          <h4>Condition</h4>
          <p>{condition.replace('-', ' ')}</p>
        </div>
        {temperature !== null && (
          <div>
            <h4>Temperature</h4>
            <p>{temperature}{temperatureUnit}</p>
          </div>
        )}
        {apparentTemperature !== null && (
          <div>
            <h4>Feels Like</h4>
            <p>{apparentTemperature}{temperatureUnit}</p>
          </div>
        )}
        {humidity !== null && (
          <div>
            <h4>Humidity</h4>
            <p>{humidity}%</p>
          </div>
        )}
        {pressure !== null && (
          <div>
            <h4>Pressure</h4>
            <p>{pressure} {pressureUnit}</p>
          </div>
        )}
        {windSpeed !== null && (
          <div>
            <h4>Wind</h4>
            <p>{windSpeed} {windSpeedUnit} {getWindDirection(windBearing)}</p>
          </div>
        )}
      </div>
    )
  }}
</Weather>
```

### Weather with Icon Mapping

```tsx
const getWeatherIcon = (condition) => {
  const iconMap = {
    'clear-night': '🌙',
    'cloudy': '☁️',
    'exceptional': '⚠️',
    'fog': '🌫️',
    'hail': '🧊',
    'lightning': '⚡',
    'lightning-rainy': '⛈️',
    'partlycloudy': '⛅',
    'pouring': '🌧️',
    'rainy': '🌦️',
    'snowy': '❄️',
    'snowy-rainy': '🌨️',
    'sunny': '☀️',
    'windy': '💨',
    'windy-variant': '🌬️'
  }
  return iconMap[condition] || '🌡️'
}

<Weather entityId="weather.home">
  {({
    condition, temperature, temperatureUnit,
    humidity, windSpeed, windSpeedUnit,
    attributes
  }) => (
    <div>
      <h3>{attributes.friendly_name}</h3>
      <div>{getWeatherIcon(condition)}</div>
      <p>{condition.replace('-', ' ')}</p>
      {temperature !== null && (
        <p>{temperature}{temperatureUnit}</p>
      )}
      {humidity !== null && (
        <div>
          <div>Humidity</div>
          <div>{humidity}%</div>
        </div>
      )}
      {windSpeed !== null && (
        <div>
          <div>Wind</div>
          <div>{windSpeed} {windSpeedUnit}</div>
        </div>
      )}
    </div>
  )}
</Weather>
```

### Compact Weather Display

```tsx
<Weather entityId="weather.home">
  {({ condition, temperature, temperatureUnit, humidity, windSpeed, windSpeedUnit }) => (
    <div>
      <div>{getWeatherIcon(condition)}</div>
      <div>
        {temperature !== null && <div>{temperature}{temperatureUnit}</div>}
        <div>{condition.replace('-', ' ')}</div>
      </div>
      <div>
        {humidity !== null && <div>💧 {humidity}%</div>}
        {windSpeed !== null && <div>💨 {windSpeed} {windSpeedUnit}</div>}
      </div>
    </div>
  )}
</Weather>
```

### Using Hooks

```tsx
import { useWeather } from 'hass-react'

function WeatherCard({ entityId }) {
  const weather = useWeather(entityId)

  const getWeatherEmoji = (condition) => {
    const emojiMap = {
      'sunny': '☀️',
      'cloudy': '☁️',
      'rainy': '🌦️',
      'snowy': '❄️',
      'windy': '💨'
    }
    return emojiMap[condition] || '🌡️'
  }

  return (
    <div>
      <h3>{weather.attributes.friendly_name}</h3>
      <div>
        <div>{getWeatherEmoji(weather.condition)}</div>
        <div>
          {weather.temperature !== null && (
            <div>{weather.temperature}{weather.temperatureUnit}</div>
          )}
          <div>{weather.condition.replace('-', ' ')}</div>
        </div>
      </div>
      <div>
        {weather.humidity !== null && (
          <div>Humidity: {weather.humidity}%</div>
        )}
        {weather.pressure !== null && (
          <div>Pressure: {weather.pressure} {weather.pressureUnit}</div>
        )}
        {weather.windSpeed !== null && (
          <div>Wind: {weather.windSpeed} {weather.windSpeedUnit}</div>
        )}
        {weather.apparentTemperature !== null && (
          <div>Feels Like: {weather.apparentTemperature}{weather.temperatureUnit}</div>
        )}
      </div>
    </div>
  )
}
```

### Multiple Weather Locations

```tsx
import { useWeather } from 'hass-react'

function WeatherDashboard() {
  const locations = [
    { id: 'weather.home', name: 'Home' },
    { id: 'weather.office', name: 'Office' },
    { id: 'weather.beach_house', name: 'Beach House' }
  ]

  return (
    <div>
      {locations.map(location => (
        <WeatherLocation key={location.id} entityId={location.id} />
      ))}
    </div>
  )
}

function WeatherLocation({ entityId }) {
  const weather = useWeather(entityId)

  return (
    <div>
      <h4>{weather.attributes.friendly_name}</h4>
      <div>
        {weather.temperature !== null && (
          <div>{weather.temperature}{weather.temperatureUnit}</div>
        )}
        <div>{weather.condition.replace('-', ' ')}</div>
      </div>
      {weather.humidity !== null && (
        <div>Humidity: {weather.humidity}%</div>
      )}
    </div>
  )
}
```

## Weather Conditions

Home Assistant reports these standard conditions:

- `clear-night` - Clear night sky
- `cloudy` - Cloudy
- `exceptional` - Exceptional weather
- `fog` - Foggy
- `hail` - Hailing
- `lightning` - Lightning
- `lightning-rainy` - Thunderstorm
- `partlycloudy` - Partly cloudy
- `pouring` - Heavy rain
- `rainy` - Rainy
- `snowy` - Snowing
- `snowy-rainy` - Mixed snow and rain
- `sunny` - Sunny
- `windy` - Windy
- `windy-variant` - Strong winds

## TypeScript

Weather entities come with these type definitions:

```typescript
import type { WeatherState, WeatherAttributes, WeatherCondition } from 'hass-react'

// WeatherCondition type includes all standard conditions:
type WeatherCondition =
  | 'clear-night'
  | 'cloudy'
  | 'exceptional'
  | 'fog'
  | 'hail'
  | 'lightning'
  | 'lightning-rainy'
  | 'partlycloudy'
  | 'pouring'
  | 'rainy'
  | 'snowy'
  | 'snowy-rainy'
  | 'sunny'
  | 'windy'
  | 'windy-variant'

// Use in your components
const weather: WeatherState = useWeather('weather.home')
```
