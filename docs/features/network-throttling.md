# Network Throttling API Documentation

The Network Throttling module provides network condition simulation for the Basset Hound Browser, enabling bandwidth limiting, latency simulation, and preset network profiles using the Chrome DevTools Protocol.

## Overview

The `NetworkThrottler` class (`network/throttling.js`) provides:

- **Bandwidth Limiting**: Control download and upload speeds
- **Latency Simulation**: Add network delay
- **Offline Mode**: Simulate no network connectivity
- **Preset Profiles**: Pre-configured network conditions (3G, 4G, WiFi, etc.)
- **Custom Settings**: Define custom throttling parameters

## Architecture

The Network Throttler uses Electron's debugger API to communicate with Chrome DevTools Protocol (CDP), specifically the `Network.emulateNetworkConditions` command.

```
┌─────────────────────────────────────────────────────────────┐
│                    NetworkThrottler                          │
│                                                              │
│  ┌─────────────────┐    CDP    ┌──────────────────────┐     │
│  │  Configuration  │ ───────▶ │   Chromium Debugger  │     │
│  │  - downloadSpeed│          │   Network Domain     │     │
│  │  - uploadSpeed  │          │                      │     │
│  │  - latency      │          │   Network.emulate-   │     │
│  │  - offline      │          │   NetworkConditions  │     │
│  └─────────────────┘          └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Network Presets

The following network condition presets are available:

| Preset | Download | Upload | Latency | Description |
|--------|----------|--------|---------|-------------|
| `offline` | 0 | 0 | 0ms | No connection |
| `gprs` | 50 Kbps | 20 Kbps | 500ms | GPRS mobile |
| `edge` | 250 Kbps | 50 Kbps | 300ms | 2G EDGE |
| `3g` | 750 Kbps | 250 Kbps | 100ms | Regular 3G |
| `3g-fast` | 1.5 Mbps | 750 Kbps | 40ms | Fast 3G |
| `4g` | 4 Mbps | 3 Mbps | 20ms | 4G LTE |
| `dsl` | 2 Mbps | 1 Mbps | 5ms | DSL connection |
| `wifi` | 30 Mbps | 15 Mbps | 2ms | WiFi |

---

## API Reference

### Constructor and Initialization

```javascript
const { NetworkThrottler, networkThrottler } = require('./network/throttling');

// Use the singleton instance
const throttler = networkThrottler;

// Or create a new instance
const throttler = new NetworkThrottler();
```

### initialize(webContents)

Initialize the throttler with a webContents instance.

**Parameters:**
- `webContents` - Electron WebContents to throttle

**Example:**
```javascript
throttler.initialize(mainWindow.webContents);
```

---

## Debugger Management

### attachDebugger()

Attach the Chrome DevTools Protocol debugger to the webContents.

**Returns:** `Promise<boolean>`
```javascript
const attached = await throttler.attachDebugger();
// true if successful, false otherwise
```

**Note:** This is called automatically when enabling throttling.

---

### detachDebugger()

Detach the debugger from the webContents.

```javascript
throttler.detachDebugger();
```

---

## Throttling Control

### enable()

Enable network throttling with current settings.

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  status: {
    enabled: true,
    offline: false,
    downloadSpeed: 196608,
    downloadSpeedFormatted: '192.00 KB/s',
    uploadSpeed: 96000,
    uploadSpeedFormatted: '93.75 KB/s',
    latency: 40,
    activePreset: '3g-fast',
    debuggerAttached: true
  }
}
```

**WebSocket Command:**
```json
{
  "command": "network:throttle:enable"
}
```

---

### disable()

Disable network throttling (return to normal network conditions).

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  status: {
    enabled: false,
    offline: false,
    downloadSpeed: -1,
    downloadSpeedFormatted: 'Unlimited',
    uploadSpeed: -1,
    uploadSpeedFormatted: 'Unlimited',
    latency: 0,
    activePreset: null,
    debuggerAttached: true
  }
}
```

**WebSocket Command:**
```json
{
  "command": "network:throttle:disable"
}
```

---

## Preset Configuration

### setPreset(presetName)

Apply a predefined network condition preset.

**Parameters:**
- `presetName` (string) - Name of the preset to apply

**Available Presets:**
- `offline`, `gprs`, `edge`, `3g`, `3g-fast`, `4g`, `dsl`, `wifi`

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  preset: {
    name: '3g',
    displayName: 'Regular 3G',
    downloadSpeed: 96000,
    uploadSpeed: 32000,
    latency: 100,
    offline: false
  }
}
```

**Error Response:**
```javascript
{
  success: false,
  error: 'Unknown preset: invalid-preset',
  availablePresets: ['offline', 'gprs', 'edge', '3g', '3g-fast', '4g', 'dsl', 'wifi']
}
```

**WebSocket Command:**
```json
{
  "command": "network:throttle:setPreset",
  "params": {
    "preset": "3g"
  }
}
```

**Example:**
```javascript
// Simulate slow 3G connection
await throttler.setPreset('3g');
await throttler.enable();

// Test page load time under slow conditions
// ...

// Return to fast connection
await throttler.setPreset('wifi');
```

---

### getPresets()

Get all available network presets with their configurations.

**Returns:** `Object`
```javascript
{
  success: true,
  presets: {
    offline: {
      name: 'Offline',
      downloadSpeed: 0,
      downloadSpeedFormatted: '0 B/s',
      uploadSpeed: 0,
      uploadSpeedFormatted: '0 B/s',
      latency: 0,
      offline: true
    },
    gprs: {
      name: 'GPRS',
      downloadSpeed: 6400,
      downloadSpeedFormatted: '6.25 KB/s',
      uploadSpeed: 2560,
      uploadSpeedFormatted: '2.50 KB/s',
      latency: 500,
      offline: false
    },
    // ... more presets
  }
}
```

**WebSocket Command:**
```json
{
  "command": "network:throttle:getPresets"
}
```

---

## Custom Throttling

### setThrottling(download, upload, latency)

Set custom throttling parameters.

**Parameters:**
- `download` (number) - Download speed in bytes/second (-1 for unlimited)
- `upload` (number) - Upload speed in bytes/second (-1 for unlimited)
- `latency` (number) - Latency in milliseconds

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  downloadSpeed: 524288,
  uploadSpeed: 131072,
  latency: 50
}
```

**WebSocket Command:**
```json
{
  "command": "network:throttle:setThrottling",
  "params": {
    "download": 524288,
    "upload": 131072,
    "latency": 50
  }
}
```

**Example - Simulate 500 KB/s download, 100 KB/s upload, 100ms latency:**
```javascript
await throttler.setThrottling(
  512 * 1024,  // 500 KB/s
  100 * 1024,  // 100 KB/s
  100          // 100ms latency
);
await throttler.enable();
```

---

## Status and Information

### getStatus()

Get current throttling status.

**Returns:** `Object`
```javascript
{
  enabled: true,
  offline: false,
  downloadSpeed: 524288,
  downloadSpeedFormatted: '512.00 KB/s',
  uploadSpeed: 131072,
  uploadSpeedFormatted: '128.00 KB/s',
  latency: 50,
  activePreset: null,
  debuggerAttached: true
}
```

**WebSocket Command:**
```json
{
  "command": "network:throttle:getStatus"
}
```

---

### formatSpeed(bytesPerSecond)

Format speed value to human-readable string.

**Parameters:**
- `bytesPerSecond` (number) - Speed in bytes per second

**Returns:** `string`
```javascript
throttler.formatSpeed(-1);        // 'Unlimited'
throttler.formatSpeed(0);         // '0 B/s'
throttler.formatSpeed(1024);      // '1.00 KB/s'
throttler.formatSpeed(1048576);   // '1.00 MB/s'
```

---

## Speed Conversion Utilities

### NetworkThrottler.kbpsToBytes(kbps)

Convert Kilobits per second to bytes per second.

**Parameters:**
- `kbps` (number) - Speed in Kilobits per second

**Returns:** `number` - Speed in bytes per second

```javascript
const bytes = NetworkThrottler.kbpsToBytes(1000);  // 128000
```

---

### NetworkThrottler.mbpsToBytes(mbps)

Convert Megabits per second to bytes per second.

**Parameters:**
- `mbps` (number) - Speed in Megabits per second

**Returns:** `number` - Speed in bytes per second

```javascript
const bytes = NetworkThrottler.mbpsToBytes(10);  // 1310720
```

---

## Internal Methods

### applyThrottling()

Apply current throttling settings via CDP. Called automatically by `enable()` and when settings change.

**Returns:** `Promise<Object>`
```javascript
{
  success: true
}
// or
{
  success: false,
  error: 'Failed to attach debugger'
}
```

---

### clearThrottling()

Clear throttling settings (reset to unlimited). Called automatically by `disable()`.

**Returns:** `Promise<Object>`
```javascript
{
  success: true
}
```

---

### cleanup()

Cleanup resources - detach debugger and reset state.

```javascript
throttler.cleanup();
```

---

## Complete WebSocket Command Reference

| Command | Description |
|---------|-------------|
| `network:throttle:enable` | Enable throttling |
| `network:throttle:disable` | Disable throttling |
| `network:throttle:setPreset` | Apply preset profile |
| `network:throttle:getPresets` | Get available presets |
| `network:throttle:setThrottling` | Set custom throttling |
| `network:throttle:getStatus` | Get current status |

---

## Configuration Reference

### Preset Configurations

```javascript
const NETWORK_PRESETS = {
  offline: {
    name: 'Offline',
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0,
    offline: true
  },
  gprs: {
    name: 'GPRS',
    downloadSpeed: 6400,       // 50 Kbps
    uploadSpeed: 2560,         // 20 Kbps
    latency: 500,
    offline: false
  },
  edge: {
    name: 'Regular 2G / EDGE',
    downloadSpeed: 32000,      // 250 Kbps
    uploadSpeed: 6400,         // 50 Kbps
    latency: 300,
    offline: false
  },
  '3g': {
    name: 'Regular 3G',
    downloadSpeed: 96000,      // 750 Kbps
    uploadSpeed: 32000,        // 250 Kbps
    latency: 100,
    offline: false
  },
  '3g-fast': {
    name: 'Fast 3G',
    downloadSpeed: 196608,     // 1.5 Mbps
    uploadSpeed: 96000,        // 750 Kbps
    latency: 40,
    offline: false
  },
  '4g': {
    name: '4G / LTE',
    downloadSpeed: 524288,     // 4 Mbps
    uploadSpeed: 393216,       // 3 Mbps
    latency: 20,
    offline: false
  },
  dsl: {
    name: 'DSL',
    downloadSpeed: 262144,     // 2 Mbps
    uploadSpeed: 131072,       // 1 Mbps
    latency: 5,
    offline: false
  },
  wifi: {
    name: 'WiFi',
    downloadSpeed: 3932160,    // 30 Mbps
    uploadSpeed: 1966080,      // 15 Mbps
    latency: 2,
    offline: false
  }
};
```

---

## Usage Examples

### Simulate Mobile Network

```javascript
const { networkThrottler } = require('./network/throttling');

// Initialize with webContents
networkThrottler.initialize(webview.getWebContents());

// Simulate 3G conditions
await networkThrottler.setPreset('3g');
await networkThrottler.enable();

console.log('Testing under 3G conditions...');
// Perform tests...

// Restore normal conditions
await networkThrottler.disable();
```

### Test Offline Behavior

```javascript
// Simulate offline mode
await networkThrottler.setPreset('offline');
await networkThrottler.enable();

// Page should show offline behavior
// ...

// Restore connection
await networkThrottler.disable();
```

### Custom Bandwidth Limiting

```javascript
// Simulate a 1 Mbps connection with 150ms latency
const downloadSpeed = NetworkThrottler.mbpsToBytes(1);  // 131072 bytes/s
const uploadSpeed = NetworkThrottler.kbpsToBytes(500);  // 64000 bytes/s

await networkThrottler.setThrottling(downloadSpeed, uploadSpeed, 150);
await networkThrottler.enable();

console.log('Throttling status:', networkThrottler.getStatus());
```

### Progressive Testing

```javascript
// Test page load across different network conditions
const presets = ['4g', '3g-fast', '3g', 'edge', 'gprs'];

for (const preset of presets) {
  await networkThrottler.setPreset(preset);
  await networkThrottler.enable();

  const startTime = Date.now();
  await page.reload();
  const loadTime = Date.now() - startTime;

  console.log(`${preset}: ${loadTime}ms`);
}

await networkThrottler.disable();
```

### WebSocket Integration

```javascript
// Handle throttling commands via WebSocket
ws.on('message', async (message) => {
  const { command, params } = JSON.parse(message);

  let result;

  switch (command) {
    case 'network:throttle:enable':
      result = await networkThrottler.enable();
      break;

    case 'network:throttle:disable':
      result = await networkThrottler.disable();
      break;

    case 'network:throttle:setPreset':
      result = await networkThrottler.setPreset(params.preset);
      if (result.success) {
        await networkThrottler.enable();
      }
      break;

    case 'network:throttle:setThrottling':
      result = await networkThrottler.setThrottling(
        params.download,
        params.upload,
        params.latency
      );
      break;

    case 'network:throttle:getStatus':
      result = { success: true, status: networkThrottler.getStatus() };
      break;

    case 'network:throttle:getPresets':
      result = networkThrottler.getPresets();
      break;
  }

  ws.send(JSON.stringify(result));
});
```

### Speed Comparison

```javascript
// Compare download speeds across presets
const presets = networkThrottler.getPresets();

console.log('Network Preset Comparison:');
console.log('─'.repeat(60));

for (const [key, preset] of Object.entries(presets.presets)) {
  console.log(`${preset.name.padEnd(20)} | Down: ${preset.downloadSpeedFormatted.padEnd(12)} | Up: ${preset.uploadSpeedFormatted.padEnd(12)} | Latency: ${preset.latency}ms`);
}
```

Output:
```
Network Preset Comparison:
────────────────────────────────────────────────────────────
Offline              | Down: 0 B/s        | Up: 0 B/s        | Latency: 0ms
GPRS                 | Down: 6.25 KB/s    | Up: 2.50 KB/s    | Latency: 500ms
Regular 2G / EDGE    | Down: 31.25 KB/s   | Up: 6.25 KB/s    | Latency: 300ms
Regular 3G           | Down: 93.75 KB/s   | Up: 31.25 KB/s   | Latency: 100ms
Fast 3G              | Down: 192.00 KB/s  | Up: 93.75 KB/s   | Latency: 40ms
4G / LTE             | Down: 512.00 KB/s  | Up: 384.00 KB/s  | Latency: 20ms
DSL                  | Down: 256.00 KB/s  | Up: 128.00 KB/s  | Latency: 5ms
WiFi                 | Down: 3.75 MB/s    | Up: 1.88 MB/s    | Latency: 2ms
```
