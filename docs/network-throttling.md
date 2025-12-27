# Network Throttling

The Network Throttling feature allows you to simulate various network conditions in the Basset Hound Browser. This is useful for testing how web applications behave under different network speeds and latency conditions.

## Overview

Network throttling is implemented using Electron's debugger API and Chrome DevTools Protocol (CDP) `Network.emulateNetworkConditions` command. This allows precise control over:

- **Download speed** (bytes per second)
- **Upload speed** (bytes per second)
- **Latency** (milliseconds)
- **Offline mode**

## Available Presets

The following network condition presets are available:

| Preset | Download | Upload | Latency | Description |
|--------|----------|--------|---------|-------------|
| `offline` | 0 | 0 | 0ms | No network connection |
| `gprs` | 50 Kbps | 20 Kbps | 500ms | GPRS mobile connection |
| `edge` | 250 Kbps | 50 Kbps | 300ms | Regular 2G / EDGE |
| `3g` | 750 Kbps | 250 Kbps | 100ms | Regular 3G mobile |
| `3g-fast` | 1.5 Mbps | 750 Kbps | 40ms | Fast 3G mobile |
| `4g` | 4 Mbps | 3 Mbps | 20ms | 4G / LTE mobile |
| `dsl` | 2 Mbps | 1 Mbps | 5ms | DSL broadband |
| `wifi` | 30 Mbps | 15 Mbps | 2ms | WiFi connection |

## WebSocket API Commands

### set_network_throttling

Set custom network throttling speeds.

**Parameters:**
- `download` (number): Download speed in bytes per second. Use -1 for unlimited.
- `upload` (number): Upload speed in bytes per second. Use -1 for unlimited.
- `latency` (number): Latency in milliseconds.

**Example:**
```json
{
  "command": "set_network_throttling",
  "download": 1000000,
  "upload": 500000,
  "latency": 50
}
```

**Response:**
```json
{
  "success": true,
  "downloadSpeed": 1000000,
  "uploadSpeed": 500000,
  "latency": 50
}
```

### set_network_preset

Set throttling using a predefined preset.

**Parameters:**
- `preset` (string): Name of the preset (e.g., "3g", "4g", "wifi")

**Example:**
```json
{
  "command": "set_network_preset",
  "preset": "3g"
}
```

**Response:**
```json
{
  "success": true,
  "preset": {
    "name": "3g",
    "displayName": "Regular 3G",
    "downloadSpeed": 96000,
    "uploadSpeed": 32000,
    "latency": 100,
    "offline": false
  }
}
```

### get_network_presets

Get all available network presets.

**Example:**
```json
{
  "command": "get_network_presets"
}
```

**Response:**
```json
{
  "success": true,
  "presets": {
    "offline": {
      "name": "Offline",
      "downloadSpeed": 0,
      "downloadSpeedFormatted": "0 B/s",
      "uploadSpeed": 0,
      "uploadSpeedFormatted": "0 B/s",
      "latency": 0,
      "offline": true
    },
    "3g": {
      "name": "Regular 3G",
      "downloadSpeed": 96000,
      "downloadSpeedFormatted": "93.75 KB/s",
      "uploadSpeed": 32000,
      "uploadSpeedFormatted": "31.25 KB/s",
      "latency": 100,
      "offline": false
    }
    // ... other presets
  }
}
```

### enable_throttling

Enable network throttling with current settings.

**Example:**
```json
{
  "command": "enable_throttling"
}
```

**Response:**
```json
{
  "success": true,
  "status": {
    "enabled": true,
    "offline": false,
    "downloadSpeed": 96000,
    "downloadSpeedFormatted": "93.75 KB/s",
    "uploadSpeed": 32000,
    "uploadSpeedFormatted": "31.25 KB/s",
    "latency": 100,
    "activePreset": "3g",
    "debuggerAttached": true
  }
}
```

### disable_throttling

Disable network throttling and restore normal speeds.

**Example:**
```json
{
  "command": "disable_throttling"
}
```

**Response:**
```json
{
  "success": true,
  "status": {
    "enabled": false,
    "offline": false,
    "downloadSpeed": 96000,
    "uploadSpeed": 32000,
    "latency": 100,
    "activePreset": "3g",
    "debuggerAttached": true
  }
}
```

### get_throttling_status

Get current throttling status and settings.

**Example:**
```json
{
  "command": "get_throttling_status"
}
```

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "offline": false,
  "downloadSpeed": 96000,
  "downloadSpeedFormatted": "93.75 KB/s",
  "uploadSpeed": 32000,
  "uploadSpeedFormatted": "31.25 KB/s",
  "latency": 100,
  "activePreset": "3g",
  "debuggerAttached": true
}
```

## Renderer API (via preload.js)

The following methods are available via `window.electronAPI`:

### setNetworkThrottling(download, upload, latency)

Set custom throttling speeds.

```javascript
// Set to 1 MB/s download, 500 KB/s upload, 50ms latency
await window.electronAPI.setNetworkThrottling(1000000, 500000, 50);
```

### setNetworkPreset(presetName)

Set throttling using a preset.

```javascript
// Use 3G preset
await window.electronAPI.setNetworkPreset('3g');

// Simulate offline
await window.electronAPI.setNetworkPreset('offline');
```

### getNetworkPresets()

Get all available presets.

```javascript
const { presets } = await window.electronAPI.getNetworkPresets();
console.log(presets);
```

### enableNetworkThrottling()

Enable throttling.

```javascript
await window.electronAPI.enableNetworkThrottling();
```

### disableNetworkThrottling()

Disable throttling.

```javascript
await window.electronAPI.disableNetworkThrottling();
```

### getNetworkThrottlingStatus()

Get current status.

```javascript
const status = await window.electronAPI.getNetworkThrottlingStatus();
console.log(status.enabled, status.downloadSpeedFormatted);
```

## IPC Handlers (main.js)

The following IPC handlers are available:

- `set-network-throttling` - Set custom throttling
- `set-network-preset` - Set preset
- `get-network-presets` - Get presets
- `enable-network-throttling` - Enable throttling
- `disable-network-throttling` - Disable throttling
- `get-network-throttling-status` - Get status

## Speed Conversion Helpers

The NetworkThrottler class provides static helper methods for converting speeds:

```javascript
const { NetworkThrottler } = require('./network/throttling');

// Convert Kbps to bytes/second
const bytesPerSecond = NetworkThrottler.kbpsToBytes(750); // 96000

// Convert Mbps to bytes/second
const bytesPerSecond = NetworkThrottler.mbpsToBytes(4); // 524288
```

## Usage Examples

### Simulate Slow 3G Connection

```javascript
// Via WebSocket
ws.send(JSON.stringify({
  command: 'set_network_preset',
  preset: '3g'
}));

ws.send(JSON.stringify({
  command: 'enable_throttling'
}));
```

### Simulate Offline Mode

```javascript
// Via WebSocket
ws.send(JSON.stringify({
  command: 'set_network_preset',
  preset: 'offline'
}));

ws.send(JSON.stringify({
  command: 'enable_throttling'
}));
```

### Custom Throttling Settings

```javascript
// Via WebSocket - 100 KB/s download, 50 KB/s upload, 200ms latency
ws.send(JSON.stringify({
  command: 'set_network_throttling',
  download: 100 * 1024,
  upload: 50 * 1024,
  latency: 200
}));

ws.send(JSON.stringify({
  command: 'enable_throttling'
}));
```

### Reset to Normal Speed

```javascript
// Via WebSocket
ws.send(JSON.stringify({
  command: 'disable_throttling'
}));
```

## Implementation Details

### Chrome DevTools Protocol

Network throttling uses the CDP `Network.emulateNetworkConditions` command with the following parameters:

- `offline` (boolean): Simulate offline mode
- `latency` (number): Minimum latency in milliseconds
- `downloadThroughput` (number): Maximum download throughput in bytes/second
- `uploadThroughput` (number): Maximum upload throughput in bytes/second

### Debugger Attachment

The throttler automatically attaches to the webContents using Electron's debugger API when throttling is enabled. The debugger is detached when:

- Throttling is disabled
- The window is closed
- Cleanup is called

### Limitations

1. **WebView Targeting**: Currently throttles the main window's webContents. For webview-specific throttling, the webContents reference needs to be updated.

2. **Per-Session**: Throttling applies to the session, affecting all requests from the throttled webContents.

3. **Debugger Conflicts**: Only one debugger can be attached at a time. If another tool (like DevTools) is using the debugger, throttling may fail.

## Troubleshooting

### "Failed to attach debugger"

This error occurs when the debugger cannot be attached. Common causes:

- DevTools is already open and using the debugger
- Another extension or tool has the debugger attached

**Solution**: Close DevTools or other debugging tools before enabling throttling.

### Throttling Not Working

If throttling appears to have no effect:

1. Check that `enabled` is `true` in the status
2. Verify `debuggerAttached` is `true`
3. Ensure the download/upload speeds are set correctly (not -1 for unlimited)
4. Try reloading the page after enabling throttling
