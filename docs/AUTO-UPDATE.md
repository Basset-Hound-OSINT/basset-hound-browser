# Basset Hound Browser - Auto-Update System

## Overview

Basset Hound Browser includes a comprehensive auto-update system built on `electron-updater`. This system provides automatic update checking, downloading, installation, and rollback capabilities with full WebSocket API integration.

## Features

- **Automatic Update Checking**: Configurable intervals for checking updates on startup and periodically
- **Delta/Differential Updates**: Download only changed parts for faster updates
- **GitHub Releases Integration**: Default provider using GitHub releases
- **Custom Update Servers**: Support for S3, Spaces, or custom update servers
- **Rollback Support**: Keep previous versions for rollback capability
- **Real-time Progress**: WebSocket notifications for download progress
- **UI Notifications**: Toast-style notifications in the browser window
- **Pre-release Channels**: Optional support for beta/pre-release versions

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Main Process                               │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      UpdateManager                               ││
│  │  - Checks for updates via electron-updater                      ││
│  │  - Manages download progress                                    ││
│  │  - Handles installation                                          ││
│  │  - Maintains version history for rollback                       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│                              │ IPC                                   │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    WebSocket Server                              ││
│  │  - Exposes update commands via API                              ││
│  │  - Broadcasts progress events                                    ││
│  │  - Handles update configuration                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         External Clients                             │
│  - Python scripts                                                    │
│  - Node.js applications                                              │
│  - CLI tools                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Config File (config.yaml)

```yaml
updater:
  enabled: true
  checkOnStartup: true
  checkInterval: 3600000  # 1 hour in milliseconds
  autoDownload: false
  autoInstallOnAppQuit: true
  allowPrerelease: false
  allowDowngrade: false
  provider: github
  owner: your-github-username
  repo: basset-hound-browser
  notifyOnAvailable: true
  notifyOnDownloaded: true
  notifyOnError: true
  differentialDownload: true
  keepPreviousVersion: true
  maxPreviousVersions: 2
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASSET_UPDATER_ENABLED` | Enable/disable auto-update | `true` |
| `BASSET_UPDATER_CHECK_ON_STARTUP` | Check on app start | `true` |
| `BASSET_UPDATER_CHECK_INTERVAL` | Check interval (ms) | `3600000` |
| `BASSET_UPDATER_AUTO_DOWNLOAD` | Auto-download updates | `false` |
| `BASSET_UPDATER_ALLOW_PRERELEASE` | Include pre-releases | `false` |
| `BASSET_UPDATER_PROVIDER` | Update provider | `github` |
| `BASSET_UPDATER_OWNER` | GitHub owner/org | `null` |
| `BASSET_UPDATER_REPO` | GitHub repo name | `null` |

### Default Values

```javascript
{
  enabled: true,
  checkOnStartup: true,
  checkInterval: 3600000,  // 1 hour
  autoDownload: false,
  autoInstallOnAppQuit: true,
  allowPrerelease: false,
  allowDowngrade: false,
  provider: 'github',
  owner: null,
  repo: null,
  updateServerUrl: null,
  notifyOnAvailable: true,
  notifyOnDownloaded: true,
  notifyOnError: true,
  differentialDownload: true,
  keepPreviousVersion: true,
  maxPreviousVersions: 2
}
```

## WebSocket API

### Commands

#### `check_for_updates`

Check if updates are available.

**Request:**
```json
{
  "id": "1",
  "command": "check_for_updates"
}
```

**Response:**
```json
{
  "id": "1",
  "success": true,
  "updateAvailable": true,
  "updateInfo": {
    "version": "8.1.0",
    "releaseDate": "2024-12-28T10:00:00.000Z",
    "releaseNotes": "Bug fixes and improvements"
  },
  "currentVersion": "8.0.0"
}
```

#### `download_update`

Download the available update.

**Request:**
```json
{
  "id": "2",
  "command": "download_update"
}
```

**Response:**
```json
{
  "id": "2",
  "success": true,
  "message": "Download started"
}
```

Progress events are sent via WebSocket:
```json
{
  "type": "update_progress",
  "data": {
    "percent": 45.5,
    "bytesPerSecond": 1048576,
    "transferred": 4772185,
    "total": 10485760,
    "delta": true
  }
}
```

#### `install_update`

Install the downloaded update and restart the application.

**Request:**
```json
{
  "id": "3",
  "command": "install_update",
  "params": {
    "silent": false,
    "forceRunAfter": true
  }
}
```

**Response:**
```json
{
  "id": "3",
  "success": true,
  "message": "Installing update and restarting..."
}
```

#### `get_update_status`

Get the current update status.

**Request:**
```json
{
  "id": "4",
  "command": "get_update_status"
}
```

**Response:**
```json
{
  "id": "4",
  "success": true,
  "status": "idle",
  "currentVersion": "8.0.0",
  "updateInfo": null,
  "downloadProgress": null,
  "error": null,
  "config": {
    "autoDownload": false,
    "autoInstallOnAppQuit": true,
    "allowPrerelease": false,
    "channel": "latest"
  }
}
```

**Status Values:**
- `idle` - No update activity
- `checking` - Checking for updates
- `available` - Update available
- `not-available` - No update available
- `downloading` - Downloading update
- `downloaded` - Update downloaded, ready to install
- `installing` - Installing update
- `error` - Error occurred

#### `set_update_config`

Configure update settings at runtime.

**Request:**
```json
{
  "id": "5",
  "command": "set_update_config",
  "params": {
    "autoDownload": true,
    "allowPrerelease": true,
    "checkInterval": 1800000
  }
}
```

**Response:**
```json
{
  "id": "5",
  "success": true,
  "config": {
    "autoDownload": true,
    "autoInstallOnAppQuit": true,
    "allowPrerelease": true,
    "allowDowngrade": false,
    "checkInterval": 1800000,
    "channel": "beta"
  }
}
```

#### `get_update_history`

Get update history and events.

**Request:**
```json
{
  "id": "6",
  "command": "get_update_history",
  "params": {
    "limit": 10,
    "eventType": "update-downloaded"
  }
}
```

**Response:**
```json
{
  "id": "6",
  "success": true,
  "history": [
    {
      "event": "update-downloaded",
      "timestamp": "2024-12-28T10:30:00.000Z",
      "version": "8.0.0",
      "downloadedAt": "2024-12-28T10:30:00.000Z"
    }
  ],
  "currentVersion": "8.0.0",
  "rollbackVersions": [
    {
      "version": "7.9.0",
      "appPath": "/path/to/app",
      "timestamp": "2024-12-27T10:00:00.000Z"
    }
  ]
}
```

#### `rollback_update`

Initiate rollback to a previous version.

**Request:**
```json
{
  "id": "7",
  "command": "rollback_update",
  "params": {
    "version": "7.9.0"
  }
}
```

**Response:**
```json
{
  "id": "7",
  "success": true,
  "message": "Rollback to version 7.9.0 is available",
  "version": {
    "version": "7.9.0",
    "appPath": "/path/to/app",
    "timestamp": "2024-12-27T10:00:00.000Z"
  },
  "note": "Full rollback requires downloading the previous version..."
}
```

#### `start_auto_update_check`

Start automatic periodic update checking.

**Request:**
```json
{
  "id": "8",
  "command": "start_auto_update_check",
  "params": {
    "interval": 3600000
  }
}
```

**Response:**
```json
{
  "id": "8",
  "success": true,
  "message": "Auto-check started",
  "interval": 3600000
}
```

#### `stop_auto_update_check`

Stop automatic update checking.

**Request:**
```json
{
  "id": "9",
  "command": "stop_auto_update_check"
}
```

**Response:**
```json
{
  "id": "9",
  "success": true,
  "message": "Auto-check stopped"
}
```

#### `get_rollback_versions`

Get available versions for rollback.

**Request:**
```json
{
  "id": "10",
  "command": "get_rollback_versions"
}
```

**Response:**
```json
{
  "id": "10",
  "success": true,
  "versions": [
    {
      "version": "7.9.0",
      "appPath": "/path/to/app",
      "timestamp": "2024-12-27T10:00:00.000Z"
    }
  ],
  "currentVersion": "8.0.0"
}
```

## WebSocket Events

The update system sends real-time events over WebSocket:

### `update_progress`

Sent during download with progress information.

```json
{
  "type": "update_progress",
  "data": {
    "percent": 65.2,
    "bytesPerSecond": 2097152,
    "transferred": 6838067,
    "total": 10485760,
    "delta": true
  }
}
```

### `update_status`

Sent when update status changes.

```json
{
  "type": "update_status",
  "data": {
    "status": "downloaded",
    "info": {
      "version": "8.1.0",
      "releaseDate": "2024-12-28T10:00:00.000Z"
    }
  }
}
```

### `update_error`

Sent when an error occurs.

```json
{
  "type": "update_error",
  "data": {
    "message": "Network error",
    "code": "ECONNREFUSED"
  }
}
```

## Usage Examples

### Python

```python
import websockets
import asyncio
import json

async def check_for_updates():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Check for updates
        await ws.send(json.dumps({
            "id": "1",
            "command": "check_for_updates"
        }))
        response = json.loads(await ws.recv())

        if response.get("updateAvailable"):
            print(f"Update available: {response['updateInfo']['version']}")

            # Download update
            await ws.send(json.dumps({
                "id": "2",
                "command": "download_update"
            }))

            # Listen for progress
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("type") == "update_progress":
                    print(f"Download: {msg['data']['percent']:.1f}%")
                elif msg.get("type") == "update_status":
                    if msg['data']['status'] == 'downloaded':
                        print("Download complete!")
                        break

asyncio.run(check_for_updates())
```

### Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Check for updates
  ws.send(JSON.stringify({
    id: '1',
    command: 'check_for_updates'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.id === '1' && msg.updateAvailable) {
    console.log(`Update available: ${msg.updateInfo.version}`);

    // Download update
    ws.send(JSON.stringify({
      id: '2',
      command: 'download_update'
    }));
  }

  if (msg.type === 'update_progress') {
    console.log(`Download: ${msg.data.percent.toFixed(1)}%`);
  }

  if (msg.type === 'update_status' && msg.data.status === 'downloaded') {
    console.log('Download complete! Ready to install.');
  }
});
```

## Setting Up GitHub Releases

To use GitHub releases for auto-updates:

1. **Create GitHub Token** (for private repos):
   Set `GH_TOKEN` environment variable during build.

2. **Configure electron-builder**:
   Add to `package.json`:
   ```json
   {
     "build": {
       "publish": {
         "provider": "github",
         "owner": "your-username",
         "repo": "basset-hound-browser"
       }
     }
   }
   ```

3. **Create Release**:
   ```bash
   npm run build
   # Upload artifacts to GitHub release
   ```

4. **Configure Browser**:
   Set owner and repo in config:
   ```yaml
   updater:
     provider: github
     owner: your-username
     repo: basset-hound-browser
   ```

## Custom Update Server

For custom update servers:

```yaml
updater:
  provider: generic
  updateServerUrl: https://updates.example.com/basset-hound
```

The server should serve `latest.yml` (or `latest-mac.yml`, `latest-linux.yml`) files with update metadata.

## Files

| File | Description |
|------|-------------|
| `updater/manager.js` | Core UpdateManager class |
| `updater/index.js` | Module entry point |
| `websocket/commands/updater.js` | WebSocket command handlers |
| `renderer/update-notification.js` | UI notification component |
| `renderer/update-notification.css` | Notification styles |
| `renderer/update-manager.js` | Renderer-side update manager |
| `config/defaults.js` | Default configuration |
| `config/schema.js` | Configuration schema |

## Troubleshooting

### Update Not Detected

1. Verify GitHub release is published (not draft)
2. Check version in package.json is lower than release
3. Verify provider configuration (owner, repo)
4. Check network connectivity

### Download Fails

1. Check network/proxy settings
2. Verify release assets are properly uploaded
3. Check for sufficient disk space
4. Review error in `get_update_status` response

### Installation Fails

1. Verify app has write permissions
2. Check for antivirus interference
3. Ensure no other instance is running
4. Review system logs

### Rollback Not Working

1. Verify previous version was saved
2. Check `maxPreviousVersions` setting
3. Note: Full rollback requires re-downloading previous version

## Security Considerations

- Updates are verified using code signing (when configured)
- HTTPS is used for all update communications
- Update metadata is validated before installation
- Delta updates use checksums for verification

## Version History

| Version | Changes |
|---------|---------|
| 8.1.0 | Initial auto-update implementation |

---

*Last Updated: December 2024*
