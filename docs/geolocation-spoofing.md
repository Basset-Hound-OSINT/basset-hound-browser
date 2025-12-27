# Geolocation Spoofing

The Basset Hound Browser includes comprehensive geolocation spoofing capabilities that allow you to override the browser's location API with custom coordinates or predefined city locations.

## Overview

Geolocation spoofing enables:
- Custom latitude/longitude coordinates
- Preset city locations (40+ major cities worldwide)
- Timezone synchronization with spoofed location
- Override of `navigator.geolocation.getCurrentPosition()`
- Override of `navigator.geolocation.watchPosition()`
- Automatic permission granting for geolocation requests

## API Reference

### WebSocket Commands

#### `set_geolocation`
Set custom geolocation coordinates.

**Parameters:**
- `latitude` (required): Latitude coordinate (-90 to 90)
- `longitude` (required): Longitude coordinate (-180 to 180)
- `accuracy` (optional): Accuracy in meters (default: 100)
- `altitude` (optional): Altitude in meters
- `altitudeAccuracy` (optional): Altitude accuracy in meters
- `heading` (optional): Heading in degrees (0-360)
- `speed` (optional): Speed in meters per second
- `timezone` (optional): IANA timezone name (e.g., 'America/New_York')

**Example:**
```json
{
  "command": "set_geolocation",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "accuracy": 50,
  "timezone": "Europe/Paris"
}
```

#### `set_geolocation_city`
Set geolocation by city name from preset locations.

**Parameters:**
- `city` (required): City name (case-insensitive)

**Example:**
```json
{
  "command": "set_geolocation_city",
  "city": "Tokyo"
}
```

#### `get_geolocation`
Get current geolocation settings.

**Example:**
```json
{
  "command": "get_geolocation"
}
```

**Response:**
```json
{
  "success": true,
  "coords": {
    "latitude": 48.8566,
    "longitude": 2.3522,
    "accuracy": 50,
    "altitude": null,
    "altitudeAccuracy": null,
    "heading": null,
    "speed": null
  },
  "timestamp": 1703123456789,
  "timezone": "Europe/Paris",
  "timezoneOffset": 60,
  "spoofingEnabled": true
}
```

#### `enable_geolocation_spoofing`
Enable geolocation spoofing.

**Example:**
```json
{
  "command": "enable_geolocation_spoofing"
}
```

#### `disable_geolocation_spoofing`
Disable geolocation spoofing and use real location.

**Example:**
```json
{
  "command": "disable_geolocation_spoofing"
}
```

#### `get_preset_locations`
Get list of available preset city locations.

**Parameters (optional):**
- `country`: Filter by country name
- `region`: Filter by region (north_america, south_america, europe, asia, oceania, africa)

**Example:**
```json
{
  "command": "get_preset_locations",
  "region": "europe"
}
```

#### `get_geolocation_status`
Get current geolocation spoofing status.

**Example:**
```json
{
  "command": "get_geolocation_status"
}
```

#### `reset_geolocation`
Reset geolocation to default (New York City).

**Example:**
```json
{
  "command": "reset_geolocation"
}
```

### JavaScript API (Preload)

```javascript
// Set custom geolocation
await window.electronAPI.setGeolocation(48.8566, 2.3522, { accuracy: 50 });

// Set by city name
await window.electronAPI.setGeolocationCity('Paris');

// Get current settings
const location = await window.electronAPI.getGeolocation();

// Enable/disable spoofing
await window.electronAPI.enableGeolocationSpoofing();
await window.electronAPI.disableGeolocationSpoofing();

// Get preset locations
const presets = await window.electronAPI.getPresetLocations();
const europeanCities = await window.electronAPI.getPresetLocations({ region: 'europe' });

// Get status
const status = await window.electronAPI.getGeolocationStatus();

// Reset to default
await window.electronAPI.resetGeolocation();

// Listen for script injection
window.electronAPI.onInjectGeolocationScript((script) => {
  // Script is injected into webview
});
```

## Preset Locations

### North America
| City | Country | Latitude | Longitude | Timezone |
|------|---------|----------|-----------|----------|
| New York City | United States | 40.7128 | -74.0060 | America/New_York |
| Los Angeles | United States | 34.0522 | -118.2437 | America/Los_Angeles |
| Chicago | United States | 41.8781 | -87.6298 | America/Chicago |
| San Francisco | United States | 37.7749 | -122.4194 | America/Los_Angeles |
| Miami | United States | 25.7617 | -80.1918 | America/New_York |
| Seattle | United States | 47.6062 | -122.3321 | America/Los_Angeles |
| Toronto | Canada | 43.6532 | -79.3832 | America/Toronto |
| Vancouver | Canada | 49.2827 | -123.1207 | America/Vancouver |
| Mexico City | Mexico | 19.4326 | -99.1332 | America/Mexico_City |

### Europe
| City | Country | Latitude | Longitude | Timezone |
|------|---------|----------|-----------|----------|
| London | United Kingdom | 51.5074 | -0.1278 | Europe/London |
| Paris | France | 48.8566 | 2.3522 | Europe/Paris |
| Berlin | Germany | 52.5200 | 13.4050 | Europe/Berlin |
| Amsterdam | Netherlands | 52.3676 | 4.9041 | Europe/Amsterdam |
| Madrid | Spain | 40.4168 | -3.7038 | Europe/Madrid |
| Rome | Italy | 41.9028 | 12.4964 | Europe/Rome |
| Moscow | Russia | 55.7558 | 37.6173 | Europe/Moscow |
| Stockholm | Sweden | 59.3293 | 18.0686 | Europe/Stockholm |
| Vienna | Austria | 48.2082 | 16.3738 | Europe/Vienna |

### Asia
| City | Country | Latitude | Longitude | Timezone |
|------|---------|----------|-----------|----------|
| Tokyo | Japan | 35.6762 | 139.6503 | Asia/Tokyo |
| Beijing | China | 39.9042 | 116.4074 | Asia/Shanghai |
| Shanghai | China | 31.2304 | 121.4737 | Asia/Shanghai |
| Hong Kong | China | 22.3193 | 114.1694 | Asia/Hong_Kong |
| Singapore | Singapore | 1.3521 | 103.8198 | Asia/Singapore |
| Seoul | South Korea | 37.5665 | 126.9780 | Asia/Seoul |
| Mumbai | India | 19.0760 | 72.8777 | Asia/Kolkata |
| Dubai | United Arab Emirates | 25.2048 | 55.2708 | Asia/Dubai |
| Bangkok | Thailand | 13.7563 | 100.5018 | Asia/Bangkok |

### South America
| City | Country | Latitude | Longitude | Timezone |
|------|---------|----------|-----------|----------|
| Sao Paulo | Brazil | -23.5505 | -46.6333 | America/Sao_Paulo |
| Buenos Aires | Argentina | -34.6037 | -58.3816 | America/Argentina/Buenos_Aires |
| Rio de Janeiro | Brazil | -22.9068 | -43.1729 | America/Sao_Paulo |
| Lima | Peru | -12.0464 | -77.0428 | America/Lima |
| Bogota | Colombia | 4.7110 | -74.0721 | America/Bogota |

### Oceania
| City | Country | Latitude | Longitude | Timezone |
|------|---------|----------|-----------|----------|
| Sydney | Australia | -33.8688 | 151.2093 | Australia/Sydney |
| Melbourne | Australia | -37.8136 | 144.9631 | Australia/Melbourne |
| Auckland | New Zealand | -36.8485 | 174.7633 | Pacific/Auckland |

### Africa
| City | Country | Latitude | Longitude | Timezone |
|------|---------|----------|-----------|----------|
| Cairo | Egypt | 30.0444 | 31.2357 | Africa/Cairo |
| Johannesburg | South Africa | -26.2041 | 28.0473 | Africa/Johannesburg |
| Lagos | Nigeria | 6.5244 | 3.3792 | Africa/Lagos |
| Nairobi | Kenya | -1.2921 | 36.8219 | Africa/Nairobi |
| Cape Town | South Africa | -33.9249 | 18.4241 | Africa/Johannesburg |

## Usage Examples

### Python WebSocket Client

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
print(f"Set location: {response}")

# Enable spoofing
ws.send(json.dumps({
    "command": "enable_geolocation_spoofing"
}))
response = json.loads(ws.recv())
print(f"Enabled spoofing: {response}")

# Navigate to a geolocation-aware page
ws.send(json.dumps({
    "command": "navigate",
    "url": "https://www.google.com/maps"
}))

ws.close()
```

### Custom Coordinates with Options

```python
# Set precise location with all options
ws.send(json.dumps({
    "command": "set_geolocation",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "accuracy": 10,          # 10 meters accuracy
    "altitude": 50,           # 50 meters altitude
    "altitudeAccuracy": 5,    # 5 meters altitude accuracy
    "heading": 90,            # Heading east
    "speed": 5,               # 5 m/s speed
    "timezone": "Europe/London"
}))
```

### Filtering Preset Locations

```python
# Get all European cities
ws.send(json.dumps({
    "command": "get_preset_locations",
    "region": "europe"
}))

# Get cities in a specific country
ws.send(json.dumps({
    "command": "get_preset_locations",
    "country": "United States"
}))
```

## Implementation Details

### How It Works

1. **Location Override**: The geolocation manager generates JavaScript code that overrides the browser's native `navigator.geolocation` object.

2. **Permission Spoofing**: The script also overrides `navigator.permissions.query()` to always return 'granted' for geolocation requests.

3. **Watch Position Simulation**: For `watchPosition()`, the script simulates periodic updates with slight GPS drift to appear more realistic.

4. **Timezone Matching**: When using preset cities, the timezone is automatically matched to the location for consistency.

### Anti-Detection Features

- Simulated response delay (50-150ms) to mimic real GPS lookup
- Slight coordinate variation in `watchPosition()` to simulate GPS drift
- Proper timestamp generation for each position update
- Permission state spoofing to avoid permission prompts

### Limitations

- The spoofing only affects JavaScript geolocation API calls
- IP-based geolocation (server-side) is not affected
- Some websites may cross-reference IP location with GPS location
- WebRTC may leak real location through IP if not handled separately

## Best Practices

1. **Match VPN/Proxy Location**: For best results, use a proxy or VPN server in the same region as your spoofed location.

2. **Enable Before Navigation**: Enable geolocation spoofing before navigating to location-aware pages.

3. **Use Appropriate Accuracy**: Higher accuracy (lower number) for urban areas, lower accuracy (higher number) for rural areas.

4. **Consider Timezone**: Always use matching timezones to avoid detection.

5. **Combine with Other Evasion**: Use alongside fingerprint evasion and proxy settings for comprehensive privacy.
