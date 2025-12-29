# Geolocation Spoofing API

The Geolocation module provides comprehensive GPS spoofing capabilities for the Basset Hound Browser. It includes custom coordinate setting, preset city locations, timezone matching, and script injection for overriding browser geolocation APIs.

## Overview

The Geolocation Spoofing system enables:
- Custom GPS coordinates (latitude, longitude, altitude)
- Preset locations for 40+ major cities worldwide
- Automatic timezone matching with location
- Override of `navigator.geolocation` API
- Override of `navigator.permissions.query()` for geolocation
- Timezone spoofing via `Date.prototype.getTimezoneOffset()`
- Watch position simulation with realistic GPS drift
- Region and country-based preset filtering

## Module Locations

```
basset-hound-browser/geolocation/manager.js  - GeolocationManager class
basset-hound-browser/geolocation/presets.js  - Preset locations and utilities
```

---

## GeolocationManager Class

### Constructor

```javascript
const { GeolocationManager, geolocationManager } = require('./geolocation/manager');

// Use the singleton instance
const geoManager = geolocationManager;

// Or create a new instance
const geoManager = new GeolocationManager();
```

### Properties (Getters/Setters)

| Property | Type | Description | Validation |
|----------|------|-------------|------------|
| `latitude` | number | Latitude coordinate | -90 to 90 |
| `longitude` | number | Longitude coordinate | -180 to 180 |
| `accuracy` | number | Accuracy in meters | > 0 |
| `altitude` | number/null | Altitude in meters | number or null |
| `altitudeAccuracy` | number/null | Altitude accuracy in meters | > 0 or null |
| `heading` | number/null | Heading in degrees | 0-360 or null |
| `speed` | number/null | Speed in m/s | >= 0 or null |
| `timezone` | string | IANA timezone name | read-only |
| `timezoneOffset` | number | Timezone offset in minutes | read-only |

### Default Values

- **Location:** New York City (40.7128, -74.0060)
- **Accuracy:** 100 meters
- **Timezone:** America/New_York (-300 minutes offset)
- **Enabled:** false

---

## Location Setting Methods

### setLocation(lat, lng, options)

Set a custom geolocation with optional parameters.

```javascript
const result = geoManager.setLocation(48.8566, 2.3522, {
  accuracy: 50,
  altitude: 35,
  altitudeAccuracy: 10,
  heading: 90,
  speed: 5,
  timezone: 'Europe/Paris'
});
```

**Parameters:**
- `lat` (number, required) - Latitude (-90 to 90)
- `lng` (number, required) - Longitude (-180 to 180)
- `options` (Object, optional):
  - `accuracy` (number) - Accuracy in meters
  - `altitude` (number) - Altitude in meters
  - `altitudeAccuracy` (number) - Altitude accuracy in meters
  - `heading` (number) - Heading in degrees (0-360)
  - `speed` (number) - Speed in m/s
  - `timezone` (string) - IANA timezone name

**Returns:**
```javascript
{
  success: true,
  location: {
    coords: {
      latitude: 48.8566,
      longitude: 2.3522,
      accuracy: 50,
      altitude: 35,
      altitudeAccuracy: 10,
      heading: 90,
      speed: 5
    },
    timestamp: 1703123456789,
    timezone: 'Europe/Paris',
    timezoneOffset: 60,
    spoofingEnabled: false
  }
}
// On validation error:
{ success: false, error: 'Latitude must be a number between -90 and 90' }
```

### setLocationByCity(cityName)

Set location using a preset city name.

```javascript
const result = geoManager.setLocationByCity('Tokyo');
```

**Parameters:**
- `cityName` (string, required) - City name (case-insensitive, supports partial matching)

**Returns:**
```javascript
{
  success: true,
  location: {
    coords: {
      latitude: 35.6762,
      longitude: 139.6503,
      accuracy: 100,
      ...
    },
    timezone: 'Asia/Tokyo',
    timezoneOffset: 540
  }
}
// On city not found:
{
  success: false,
  error: 'City not found: InvalidCity',
  availableCities: ['New York City', 'Los Angeles', ...]
}
```

### getLocation()

Get the current spoofed location.

```javascript
const location = geoManager.getLocation();
```

**Returns:**
```javascript
{
  coords: {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 50,
    altitude: 35,
    altitudeAccuracy: 10,
    heading: 90,
    speed: 5
  },
  timestamp: 1703123456789,
  timezone: 'Europe/Paris',
  timezoneOffset: 60,
  spoofingEnabled: true
}
```

---

## Spoofing Control

### enableSpoofing()

Enable geolocation spoofing.

```javascript
const result = geoManager.enableSpoofing();
```

**Returns:**
```javascript
{
  success: true,
  enabled: true,
  location: {...}  // Current location data
}
```

### disableSpoofing()

Disable geolocation spoofing (browser will use real location).

```javascript
const result = geoManager.disableSpoofing();
```

**Returns:**
```javascript
{
  success: true,
  enabled: false
}
```

### isEnabled()

Check if spoofing is currently active.

```javascript
const enabled = geoManager.isEnabled();
// Returns: true or false
```

---

## Preset Locations

### getPresetLocations(filter)

Get list of preset city locations.

```javascript
// Get all presets
const presets = geoManager.getPresetLocations();

// Filter by country
const usPresets = geoManager.getPresetLocations({ country: 'United States' });

// Filter by region
const europePresets = geoManager.getPresetLocations({ region: 'europe' });
```

**Parameters:**
- `filter` (Object, optional):
  - `country` (string) - Filter by country name
  - `region` (string) - Filter by region: 'north_america', 'south_america', 'europe', 'asia', 'oceania', 'africa'

**Returns:** Array of preset location objects

---

## Watch Position Simulation

### addWatcher(callback)

Register a callback for position updates (simulates watchPosition).

```javascript
const watchId = geoManager.addWatcher((location) => {
  console.log('Position updated:', location);
});
```

**Parameters:**
- `callback` (Function) - Callback function receiving location data

**Returns:** `number` - Watch ID for later removal

### removeWatcher(watchId)

Remove a registered watch callback.

```javascript
const removed = geoManager.removeWatcher(watchId);
// Returns: true if removed, false if not found
```

---

## Script Generation

### getGeolocationSpoofScript()

Generate JavaScript code to inject for geolocation spoofing.

```javascript
const script = geoManager.getGeolocationSpoofScript();
```

**Returns:** `string` - JavaScript code that:
- Overrides `navigator.geolocation.getCurrentPosition()`
- Overrides `navigator.geolocation.watchPosition()`
- Overrides `navigator.geolocation.clearWatch()`
- Overrides `navigator.permissions.query()` for geolocation
- Adds realistic response delays (50-150ms)
- Simulates GPS drift for watchPosition

**Note:** Returns `'// Geolocation spoofing disabled'` if spoofing is disabled.

### getTimezoneSpoofScript()

Generate JavaScript code for timezone spoofing.

```javascript
const script = geoManager.getTimezoneSpoofScript();
```

**Returns:** `string` - JavaScript code that:
- Overrides `Date.prototype.getTimezoneOffset()`
- Overrides `Intl.DateTimeFormat` to report spoofed timezone

### getFullSpoofScript()

Get combined geolocation and timezone spoofing script.

```javascript
const script = geoManager.getFullSpoofScript();
```

**Returns:** `string` - Combined geolocation and timezone spoofing scripts

---

## Utility Methods

### GeolocationManager.calculateDistance(lat1, lng1, lat2, lng2)

Calculate distance between two coordinates using Haversine formula (static method).

```javascript
const distance = GeolocationManager.calculateDistance(
  40.7128, -74.0060,  // New York
  51.5074, -0.1278    // London
);
// Returns: 5570222.8 (meters)
```

**Parameters:**
- `lat1`, `lng1` - First coordinate
- `lat2`, `lng2` - Second coordinate

**Returns:** `number` - Distance in meters

### addNoise(meters)

Add random noise to coordinates for more realistic spoofing.

```javascript
const noisyCoords = geoManager.addNoise(10);
```

**Parameters:**
- `meters` (number, optional) - Maximum deviation in meters (default: 10)

**Returns:**
```javascript
{
  latitude: 48.8567,   // Original + noise
  longitude: 2.3521    // Original + noise
}
```

### getStatus()

Get comprehensive status information.

```javascript
const status = geoManager.getStatus();
```

**Returns:**
```javascript
{
  enabled: true,
  location: {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 50,
    altitude: 35,
    altitudeAccuracy: 10,
    heading: 90,
    speed: 5
  },
  timezone: 'Europe/Paris',
  timezoneOffset: 60,
  activeWatchers: 2
}
```

### reset()

Reset to default location (New York City).

```javascript
const result = geoManager.reset();
```

**Returns:**
```javascript
{
  success: true,
  location: {...}  // Default NYC location
}
```

### cleanup()

Cleanup resources and clear all watchers.

```javascript
geoManager.cleanup();
```

---

## Presets Module

### PRESET_LOCATIONS

Array of predefined city locations.

```javascript
const { PRESET_LOCATIONS } = require('./geolocation/presets');

console.log(PRESET_LOCATIONS[0]);
// {
//   name: 'New York City',
//   country: 'United States',
//   latitude: 40.7128,
//   longitude: -74.0060,
//   timezone: 'America/New_York'
// }
```

### getTimezoneOffset(timezone)

Get timezone offset in minutes for a timezone name.

```javascript
const { getTimezoneOffset } = require('./geolocation/presets');

const offset = getTimezoneOffset('America/Los_Angeles');
// Returns: -480
```

**Supported Timezones:**
- America: New_York, Los_Angeles, Chicago, Denver, Toronto, Vancouver, Mexico_City, Sao_Paulo, Lima, Bogota
- Europe: London, Paris, Berlin, Amsterdam, Madrid, Rome, Moscow, Stockholm, Vienna
- Asia: Tokyo, Shanghai, Hong_Kong, Singapore, Seoul, Kolkata, Dubai, Bangkok
- Pacific: Auckland
- Australia: Sydney, Melbourne
- Africa: Cairo, Johannesburg, Lagos, Nairobi

### findPresetByName(name)

Find a preset location by city name.

```javascript
const { findPresetByName } = require('./geolocation/presets');

const preset = findPresetByName('paris');
// Returns: { name: 'Paris', country: 'France', latitude: 48.8566, ... }

const partial = findPresetByName('york');
// Returns: { name: 'New York City', ... }
```

**Parameters:**
- `name` (string) - City name (case-insensitive, supports partial matching)

**Returns:** Preset object or `null` if not found

### getAllPresets()

Get all preset locations with timezone offsets.

```javascript
const { getAllPresets } = require('./geolocation/presets');

const presets = getAllPresets();
// Each preset includes timezoneOffset property
```

### getPresetsByCountry(country)

Get presets filtered by country.

```javascript
const { getPresetsByCountry } = require('./geolocation/presets');

const usaCities = getPresetsByCountry('United States');
```

### getPresetsByRegion(region)

Get presets filtered by continent/region.

```javascript
const { getPresetsByRegion } = require('./geolocation/presets');

const asiaCities = getPresetsByRegion('asia');
```

**Available Regions:**
- `north_america` - USA, Canada, Mexico
- `south_america` - Brazil, Argentina, Peru, Colombia
- `europe` - UK, France, Germany, Netherlands, Spain, Italy, Russia, Sweden, Austria
- `asia` - Japan, China, Singapore, South Korea, India, UAE, Thailand
- `oceania` - Australia, New Zealand
- `africa` - Egypt, South Africa, Nigeria, Kenya

---

## Preset Locations Reference

### North America

| City | Country | Coordinates | Timezone |
|------|---------|-------------|----------|
| New York City | United States | 40.7128, -74.0060 | America/New_York |
| Los Angeles | United States | 34.0522, -118.2437 | America/Los_Angeles |
| Chicago | United States | 41.8781, -87.6298 | America/Chicago |
| San Francisco | United States | 37.7749, -122.4194 | America/Los_Angeles |
| Miami | United States | 25.7617, -80.1918 | America/New_York |
| Seattle | United States | 47.6062, -122.3321 | America/Los_Angeles |
| Toronto | Canada | 43.6532, -79.3832 | America/Toronto |
| Vancouver | Canada | 49.2827, -123.1207 | America/Vancouver |
| Mexico City | Mexico | 19.4326, -99.1332 | America/Mexico_City |

### Europe

| City | Country | Coordinates | Timezone |
|------|---------|-------------|----------|
| London | United Kingdom | 51.5074, -0.1278 | Europe/London |
| Paris | France | 48.8566, 2.3522 | Europe/Paris |
| Berlin | Germany | 52.5200, 13.4050 | Europe/Berlin |
| Amsterdam | Netherlands | 52.3676, 4.9041 | Europe/Amsterdam |
| Madrid | Spain | 40.4168, -3.7038 | Europe/Madrid |
| Rome | Italy | 41.9028, 12.4964 | Europe/Rome |
| Moscow | Russia | 55.7558, 37.6173 | Europe/Moscow |
| Stockholm | Sweden | 59.3293, 18.0686 | Europe/Stockholm |
| Vienna | Austria | 48.2082, 16.3738 | Europe/Vienna |

### Asia

| City | Country | Coordinates | Timezone |
|------|---------|-------------|----------|
| Tokyo | Japan | 35.6762, 139.6503 | Asia/Tokyo |
| Beijing | China | 39.9042, 116.4074 | Asia/Shanghai |
| Shanghai | China | 31.2304, 121.4737 | Asia/Shanghai |
| Hong Kong | China | 22.3193, 114.1694 | Asia/Hong_Kong |
| Singapore | Singapore | 1.3521, 103.8198 | Asia/Singapore |
| Seoul | South Korea | 37.5665, 126.9780 | Asia/Seoul |
| Mumbai | India | 19.0760, 72.8777 | Asia/Kolkata |
| Dubai | UAE | 25.2048, 55.2708 | Asia/Dubai |
| Bangkok | Thailand | 13.7563, 100.5018 | Asia/Bangkok |

### South America

| City | Country | Coordinates | Timezone |
|------|---------|-------------|----------|
| Sao Paulo | Brazil | -23.5505, -46.6333 | America/Sao_Paulo |
| Buenos Aires | Argentina | -34.6037, -58.3816 | America/Argentina/Buenos_Aires |
| Rio de Janeiro | Brazil | -22.9068, -43.1729 | America/Sao_Paulo |
| Lima | Peru | -12.0464, -77.0428 | America/Lima |
| Bogota | Colombia | 4.7110, -74.0721 | America/Bogota |

### Oceania

| City | Country | Coordinates | Timezone |
|------|---------|-------------|----------|
| Sydney | Australia | -33.8688, 151.2093 | Australia/Sydney |
| Melbourne | Australia | -37.8136, 144.9631 | Australia/Melbourne |
| Auckland | New Zealand | -36.8485, 174.7633 | Pacific/Auckland |

### Africa

| City | Country | Coordinates | Timezone |
|------|---------|-------------|----------|
| Cairo | Egypt | 30.0444, 31.2357 | Africa/Cairo |
| Johannesburg | South Africa | -26.2041, 28.0473 | Africa/Johannesburg |
| Lagos | Nigeria | 6.5244, 3.3792 | Africa/Lagos |
| Nairobi | Kenya | -1.2921, 36.8219 | Africa/Nairobi |
| Cape Town | South Africa | -33.9249, 18.4241 | Africa/Johannesburg |

---

## WebSocket Commands

### set_geolocation

Set custom GPS coordinates.

```json
{
  "command": "set_geolocation",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "accuracy": 50,
  "altitude": 35,
  "altitudeAccuracy": 10,
  "heading": 90,
  "speed": 5,
  "timezone": "Europe/Paris"
}
```

### set_geolocation_city

Set location by city name.

```json
{
  "command": "set_geolocation_city",
  "city": "Tokyo"
}
```

### get_geolocation

Get current geolocation settings.

```json
{
  "command": "get_geolocation"
}
```

### enable_geolocation_spoofing

Enable spoofing.

```json
{
  "command": "enable_geolocation_spoofing"
}
```

### disable_geolocation_spoofing

Disable spoofing.

```json
{
  "command": "disable_geolocation_spoofing"
}
```

### get_preset_locations

Get available preset locations.

```json
{
  "command": "get_preset_locations",
  "region": "europe"
}
```

Or filter by country:

```json
{
  "command": "get_preset_locations",
  "country": "United States"
}
```

### get_geolocation_status

Get full status.

```json
{
  "command": "get_geolocation_status"
}
```

### reset_geolocation

Reset to default (NYC).

```json
{
  "command": "reset_geolocation"
}
```

---

## Code Examples

### Basic Usage

```javascript
const { geolocationManager } = require('./geolocation/manager');

// Set location to Paris
geolocationManager.setLocationByCity('Paris');

// Enable spoofing
geolocationManager.enableSpoofing();

// Get the injection script
const script = geolocationManager.getFullSpoofScript();

// Inject into webview
webview.executeJavaScript(script);
```

### Custom Coordinates with All Options

```javascript
geolocationManager.setLocation(51.5074, -0.1278, {
  accuracy: 10,           // 10 meters - very precise
  altitude: 50,           // 50 meters altitude
  altitudeAccuracy: 5,    // 5 meters accuracy
  heading: 90,            // Heading east
  speed: 5,               // Walking speed (5 m/s)
  timezone: 'Europe/London'
});
```

### WebSocket Client (Python)

```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8765")

# Set location to Paris
ws.send(json.dumps({
    "command": "set_geolocation_city",
    "city": "Paris"
}))
response = json.loads(ws.recv())
print(f"Location set: {response}")

# Enable spoofing
ws.send(json.dumps({
    "command": "enable_geolocation_spoofing"
}))

# Navigate to location-aware page
ws.send(json.dumps({
    "command": "navigate",
    "url": "https://www.google.com/maps"
}))

ws.close()
```

### Filtering Presets

```javascript
const { getPresetsByRegion, getPresetsByCountry } = require('./geolocation/presets');

// Get all European cities
const europeCities = getPresetsByRegion('europe');
console.log('European cities:', europeCities.map(c => c.name));

// Get all US cities
const usCities = getPresetsByCountry('United States');
console.log('US cities:', usCities.map(c => c.name));
```

### Watch Position Simulation

```javascript
// Register a watcher
const watchId = geolocationManager.addWatcher((location) => {
  console.log('New position:', location.coords.latitude, location.coords.longitude);
});

// Later, remove the watcher
geolocationManager.removeWatcher(watchId);
```

---

## Configuration Options

### Anti-Detection Features

The generated spoofing script includes:
- **Response Delay:** 50-150ms random delay to simulate real GPS lookup
- **GPS Drift:** Slight coordinate variation (0.00001 degrees) in watchPosition updates
- **Permission Spoofing:** Always returns 'granted' for geolocation permission queries
- **Timestamp Generation:** Fresh timestamps for each position update

### Limitations

- Only affects JavaScript geolocation API calls
- IP-based geolocation (server-side) is not affected
- Some websites cross-reference IP location with GPS location
- WebRTC may leak real location if not handled separately

---

## Best Practices

1. **Match VPN/Proxy Location:** Use a proxy server in the same region as your spoofed location for consistency

2. **Enable Before Navigation:** Enable spoofing before navigating to location-aware pages

3. **Use Appropriate Accuracy:**
   - Urban areas: 10-50 meters
   - Suburban areas: 50-100 meters
   - Rural areas: 100-500 meters

4. **Match Timezone:** Always use matching timezones to avoid detection

5. **Combine with Fingerprint Evasion:** Use alongside profile fingerprint settings for comprehensive privacy

6. **Consider Altitude:** Major cities have known elevations - use realistic values

---

## Error Handling

Property setters throw errors on invalid values:

```javascript
try {
  geolocationManager.latitude = 100; // Invalid: > 90
} catch (error) {
  console.error(error.message);
  // "Latitude must be a number between -90 and 90"
}
```

Method return objects include success status:

```javascript
const result = geolocationManager.setLocationByCity('InvalidCity');
if (!result.success) {
  console.error('Error:', result.error);
  console.log('Available cities:', result.availableCities);
}
```
