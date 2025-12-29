# Downloads Manager API Documentation

The Downloads Manager provides complete download management functionality for the Basset Hound Browser, including download tracking, progress monitoring, pause/resume/cancel controls, and event notifications.

## Overview

The Downloads module (`downloads/manager.js`) provides:

- **Download Tracking**: Monitor all downloads with detailed progress information
- **Download Control**: Pause, resume, and cancel downloads
- **Event Notifications**: Real-time download status updates via EventEmitter
- **Queue Management**: Handle concurrent downloads with configurable limits
- **Auto-save Configuration**: Set default download directory

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DownloadManager                          │
│  ┌─────────────────┐         ┌──────────────────────┐       │
│  │    Downloads    │         │   Event Emitters     │       │
│  │  Map<id, item>  │         │  download-started    │       │
│  │                 │         │  download-progress   │       │
│  │                 │         │  download-completed  │       │
│  │                 │         │  download-failed     │       │
│  │                 │         │  download-cancelled  │       │
│  └─────────────────┘         └──────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼ Electron DownloadItem
┌─────────────────────────────────────────────────────────────┐
│                   will-download Event                        │
│  - Intercepts browser download requests                      │
│  - Sets save path                                            │
│  - Monitors progress                                         │
└─────────────────────────────────────────────────────────────┘
```

## Download States

```javascript
const DOWNLOAD_STATE = {
  PENDING: 'pending',       // Download queued, not started
  IN_PROGRESS: 'in_progress', // Actively downloading
  PAUSED: 'paused',         // Download paused
  COMPLETED: 'completed',   // Download finished successfully
  FAILED: 'failed',         // Download failed
  CANCELLED: 'cancelled'    // Download cancelled by user
};
```

---

## API Reference

### Constructor

```javascript
const { DownloadManager } = require('./downloads/manager');

const downloadManager = new DownloadManager({
  downloadPath: '/custom/downloads/path',
  maxConcurrentDownloads: 5,
  autoOpenCompleted: false
});
```

**Options:**
- `downloadPath` (string) - Default download directory
  - Default: System downloads folder (`app.getPath('downloads')`)
- `maxConcurrentDownloads` (number) - Maximum simultaneous downloads
  - Default: `5`
- `autoOpenCompleted` (boolean) - Auto-open completed downloads
  - Default: `false`

---

## Download Directory Management

### setDownloadPath(downloadPath)

Set the default download directory.

**Parameters:**
- `downloadPath` (string) - Path to set as default download directory

**Returns:** `Object`
```javascript
{
  success: true,
  downloadPath: '/home/user/downloads'
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:setPath",
  "params": {
    "path": "/home/user/custom-downloads"
  }
}
```

**Example:**
```javascript
const result = downloadManager.setDownloadPath('/home/user/browser-downloads');
if (result.success) {
  console.log('Downloads will save to:', result.downloadPath);
}
```

---

### getDownloadPath()

Get the current download directory.

**Returns:** `string` - Current download path

**WebSocket Command:**
```json
{
  "command": "downloads:getPath"
}
```

---

## Download Initiation

### startDownload(url, options)

Start a new download programmatically.

**Parameters:**
- `url` (string) - URL to download
- `options` (Object, optional)
  - `filename` (string) - Custom filename
  - `path` (string) - Custom save path

**Returns:** `Object`
```javascript
{
  success: true,
  download: {
    id: 'download-1705312200000-abc123',
    url: 'https://example.com/file.zip',
    filename: 'file.zip',
    path: '/home/user/downloads/file.zip',
    size: 0,
    received: 0,
    state: 'pending',
    startTime: 1705312200000,
    endTime: null,
    mimeType: '',
    error: null,
    progress: 0,
    speed: 0,
    formattedSpeed: '0 B/s',
    eta: null,
    formattedSize: '0 B',
    formattedReceived: '0 B'
  }
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:start",
  "params": {
    "url": "https://example.com/file.zip",
    "filename": "my-file.zip"
  }
}
```

---

### registerDownload(downloadItem, webContents)

Register a download from Electron's `will-download` event. This is typically called internally.

**Parameters:**
- `downloadItem` - Electron DownloadItem object
- `webContents` - WebContents that initiated the download

**Returns:** `Download` - Download instance

**Note:** This method is automatically called when the browser initiates a download.

---

## Download Control

### pauseDownload(id)

Pause an active download.

**Parameters:**
- `id` (string) - Download ID

**Returns:** `Object`
```javascript
{
  success: true,
  download: { /* download info */ }
}
```

**Error Cases:**
```javascript
{ success: false, error: 'Download not found' }
{ success: false, error: 'Download is not in progress' }
{ success: false, error: 'Download item not available' }
```

**WebSocket Command:**
```json
{
  "command": "downloads:pause",
  "params": {
    "id": "download-1705312200000-abc123"
  }
}
```

---

### resumeDownload(id)

Resume a paused download.

**Parameters:**
- `id` (string) - Download ID

**Returns:** `Object`
```javascript
{
  success: true,
  download: { /* download info */ }
}
```

**Error Cases:**
```javascript
{ success: false, error: 'Download not found' }
{ success: false, error: 'Download is not paused' }
{ success: false, error: 'Download item not available' }
{ success: false, error: 'Download cannot be resumed' }
```

**WebSocket Command:**
```json
{
  "command": "downloads:resume",
  "params": {
    "id": "download-1705312200000-abc123"
  }
}
```

---

### cancelDownload(id)

Cancel a download.

**Parameters:**
- `id` (string) - Download ID

**Returns:** `Object`
```javascript
{
  success: true,
  download: { /* download info */ }
}
```

**Error Cases:**
```javascript
{ success: false, error: 'Download not found' }
{ success: false, error: 'Download already finished' }
```

**WebSocket Command:**
```json
{
  "command": "downloads:cancel",
  "params": {
    "id": "download-1705312200000-abc123"
  }
}
```

---

## Download Information

### getDownload(id)

Get information about a specific download.

**Parameters:**
- `id` (string) - Download ID

**Returns:** `Object`
```javascript
{
  success: true,
  download: {
    id: 'download-1705312200000-abc123',
    url: 'https://example.com/file.zip',
    filename: 'file.zip',
    path: '/home/user/downloads/file.zip',
    size: 104857600,        // 100 MB in bytes
    received: 52428800,     // 50 MB in bytes
    state: 'in_progress',
    startTime: 1705312200000,
    endTime: null,
    mimeType: 'application/zip',
    error: null,
    progress: 50,           // Percentage
    speed: 1048576,         // bytes/sec
    formattedSpeed: '1.00 MB/s',
    eta: 50,                // seconds remaining
    formattedSize: '100.00 MB',
    formattedReceived: '50.00 MB'
  }
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:get",
  "params": {
    "id": "download-1705312200000-abc123"
  }
}
```

---

### getActiveDownloads()

Get all active downloads (in progress or paused).

**Returns:** `Object`
```javascript
{
  success: true,
  downloads: [
    { /* download info */ },
    { /* download info */ }
  ],
  count: 2
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:getActive"
}
```

---

### getCompletedDownloads()

Get all completed downloads.

**Returns:** `Object`
```javascript
{
  success: true,
  downloads: [
    { /* download info */ }
  ],
  count: 1
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:getCompleted"
}
```

---

### getAllDownloads(options)

Get all downloads with optional filtering.

**Parameters:**
- `options` (Object, optional)
  - `state` (string) - Filter by download state
  - `limit` (number) - Maximum downloads to return

**Returns:** `Object`
```javascript
{
  success: true,
  downloads: [ /* sorted by start time, newest first */ ],
  count: 10,
  total: 50
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:getAll",
  "params": {
    "state": "completed",
    "limit": 20
  }
}
```

---

### getStatus()

Get download manager status overview.

**Returns:** `Object`
```javascript
{
  downloadPath: '/home/user/downloads',
  total: 50,
  active: 2,
  paused: 1,
  completed: 45,
  failed: 1,
  cancelled: 1,
  queued: 0,
  maxConcurrent: 5
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:getStatus"
}
```

---

## Download History Management

### clearCompleted()

Clear completed, cancelled, and failed downloads from history.

**Returns:** `Object`
```javascript
{
  success: true,
  cleared: 47
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:clearCompleted"
}
```

---

### clearAll()

Clear all downloads. Active downloads will be cancelled.

**Returns:** `Object`
```javascript
{
  success: true,
  cleared: 50
}
```

**WebSocket Command:**
```json
{
  "command": "downloads:clearAll"
}
```

---

### cleanup()

Cleanup resources. Cancels active downloads and removes event listeners.

```javascript
downloadManager.cleanup();
```

---

## Event Notifications

The DownloadManager extends EventEmitter and emits the following events:

### download-started

Emitted when a download begins.

```javascript
downloadManager.on('download-started', (downloadInfo) => {
  console.log(`Started: ${downloadInfo.filename}`);
});
```

**Event Data:** Download info object

---

### download-progress

Emitted during download progress updates.

```javascript
downloadManager.on('download-progress', (downloadInfo) => {
  console.log(`${downloadInfo.filename}: ${downloadInfo.progress}% at ${downloadInfo.formattedSpeed}`);
});
```

**Event Data:** Download info object with updated progress

---

### download-completed

Emitted when a download completes successfully.

```javascript
downloadManager.on('download-completed', (downloadInfo) => {
  console.log(`Completed: ${downloadInfo.filename} saved to ${downloadInfo.path}`);
});
```

**Event Data:** Download info object

---

### download-failed

Emitted when a download fails.

```javascript
downloadManager.on('download-failed', (downloadInfo) => {
  console.log(`Failed: ${downloadInfo.filename} - ${downloadInfo.error}`);
});
```

**Event Data:** Download info object with error details

---

### download-cancelled

Emitted when a download is cancelled.

```javascript
downloadManager.on('download-cancelled', (downloadInfo) => {
  console.log(`Cancelled: ${downloadInfo.filename}`);
});
```

**Event Data:** Download info object

---

## Download Object Structure

```javascript
{
  id: 'download-1705312200000-abc123',  // Unique identifier
  url: 'https://example.com/file.zip',   // Source URL
  filename: 'file.zip',                  // Filename
  path: '/home/user/downloads/file.zip', // Full save path
  size: 104857600,                       // Total size in bytes
  received: 52428800,                    // Bytes received
  state: 'in_progress',                  // Current state
  startTime: 1705312200000,              // Start timestamp
  endTime: null,                         // End timestamp (null if not finished)
  mimeType: 'application/zip',           // MIME type
  error: null,                           // Error message if failed
  progress: 50,                          // Progress percentage (0-100)
  speed: 1048576,                        // Current speed (bytes/sec)
  formattedSpeed: '1.00 MB/s',           // Human-readable speed
  eta: 50,                               // Estimated seconds remaining
  formattedSize: '100.00 MB',            // Human-readable total size
  formattedReceived: '50.00 MB'          // Human-readable received
}
```

---

## Utility Functions

### formatBytes(bytes)

Format bytes to human-readable string.

```javascript
const { formatBytes } = require('./downloads/manager');

formatBytes(0);            // '0 B'
formatBytes(1024);         // '1.00 KB'
formatBytes(1048576);      // '1.00 MB'
formatBytes(1073741824);   // '1.00 GB'
```

---

## Complete WebSocket Command Reference

| Command | Description |
|---------|-------------|
| `downloads:setPath` | Set download directory |
| `downloads:getPath` | Get download directory |
| `downloads:start` | Start a download |
| `downloads:pause` | Pause a download |
| `downloads:resume` | Resume a download |
| `downloads:cancel` | Cancel a download |
| `downloads:get` | Get download info |
| `downloads:getActive` | Get active downloads |
| `downloads:getCompleted` | Get completed downloads |
| `downloads:getAll` | Get all downloads |
| `downloads:getStatus` | Get manager status |
| `downloads:clearCompleted` | Clear completed downloads |
| `downloads:clearAll` | Clear all downloads |

---

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| downloadPath | System downloads | Default save directory |
| maxConcurrentDownloads | 5 | Maximum parallel downloads |
| autoOpenCompleted | false | Auto-open finished downloads |

---

## Usage Examples

### Basic Download Monitoring

```javascript
const { DownloadManager } = require('./downloads/manager');

const manager = new DownloadManager();

// Monitor all downloads
manager.on('download-started', (info) => {
  console.log(`Download started: ${info.filename}`);
});

manager.on('download-progress', (info) => {
  process.stdout.write(`\r${info.filename}: ${info.progress}% (${info.formattedSpeed})`);
});

manager.on('download-completed', (info) => {
  console.log(`\nDownload complete: ${info.path}`);
});

manager.on('download-failed', (info) => {
  console.error(`\nDownload failed: ${info.error}`);
});
```

### Download Queue Management

```javascript
// Set max concurrent downloads
const manager = new DownloadManager({
  maxConcurrentDownloads: 3
});

// Check active download count
const status = manager.getStatus();
console.log(`Active: ${status.active}/${status.maxConcurrent}`);
```

### Pause All Downloads

```javascript
const active = manager.getActiveDownloads();
for (const download of active.downloads) {
  if (download.state === 'in_progress') {
    manager.pauseDownload(download.id);
  }
}
```

### Resume All Paused Downloads

```javascript
const all = manager.getAllDownloads();
for (const download of all.downloads) {
  if (download.state === 'paused') {
    manager.resumeDownload(download.id);
  }
}
```

### Download Progress Reporter

```javascript
const progressReport = () => {
  const active = manager.getActiveDownloads();

  console.clear();
  console.log('Active Downloads:');
  console.log('─'.repeat(60));

  for (const dl of active.downloads) {
    const bar = '█'.repeat(Math.floor(dl.progress / 5)).padEnd(20);
    console.log(`${dl.filename.substring(0, 30).padEnd(30)}`);
    console.log(`[${bar}] ${dl.progress}% - ${dl.formattedSpeed}`);
    if (dl.eta !== null) {
      console.log(`ETA: ${dl.eta} seconds`);
    }
    console.log('');
  }
};

// Update every second
setInterval(progressReport, 1000);
```

### WebSocket Integration Example

```javascript
// Handle WebSocket commands
ws.on('message', async (message) => {
  const { command, params } = JSON.parse(message);

  let result;

  switch (command) {
    case 'downloads:pause':
      result = manager.pauseDownload(params.id);
      break;
    case 'downloads:resume':
      result = manager.resumeDownload(params.id);
      break;
    case 'downloads:cancel':
      result = manager.cancelDownload(params.id);
      break;
    case 'downloads:getAll':
      result = manager.getAllDownloads(params);
      break;
    default:
      result = { success: false, error: 'Unknown command' };
  }

  ws.send(JSON.stringify(result));
});

// Send events to WebSocket clients
manager.on('download-progress', (info) => {
  ws.send(JSON.stringify({
    event: 'download-progress',
    data: info
  }));
});
```
