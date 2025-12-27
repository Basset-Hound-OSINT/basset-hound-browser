# Download Management

The Basset Hound Browser includes a comprehensive download manager that enables tracking, controlling, and monitoring file downloads via both the UI and WebSocket API.

## Features

- Track download progress in real-time
- Pause, resume, and cancel downloads
- Configurable download directory
- WebSocket API for external control
- UI download progress indicator in status bar
- Download notifications for start, complete, and error events

## Download States

Downloads can be in one of the following states:

| State | Description |
|-------|-------------|
| `pending` | Download queued but not yet started |
| `in_progress` | Download actively transferring data |
| `paused` | Download temporarily paused |
| `completed` | Download finished successfully |
| `failed` | Download failed due to an error |
| `cancelled` | Download cancelled by user |

## Download Object Structure

Each download is represented by an object with the following properties:

```javascript
{
  id: "download-1703...-abc123",     // Unique download identifier
  url: "https://example.com/file",   // Source URL
  filename: "file.zip",              // Local filename
  path: "/path/to/downloads/file.zip", // Full local path
  size: 1048576,                     // Total size in bytes
  received: 524288,                  // Bytes received
  state: "in_progress",              // Current state
  startTime: 1703123456789,          // Start timestamp
  endTime: null,                     // End timestamp (null if not finished)
  mimeType: "application/zip",       // MIME type
  error: null,                       // Error message if failed
  progress: 50,                      // Progress percentage (0-100)
  speed: 1024000,                    // Download speed in bytes/sec
  formattedSpeed: "1 MB/s",          // Human-readable speed
  eta: 60,                           // Estimated seconds remaining
  formattedSize: "1 MB",             // Human-readable total size
  formattedReceived: "512 KB"        // Human-readable received size
}
```

## WebSocket API Commands

### start_download

Start a new download.

**Request:**
```json
{
  "command": "start_download",
  "params": {
    "url": "https://example.com/file.zip",
    "filename": "custom-name.zip",  // Optional
    "path": "/custom/path/"         // Optional
  }
}
```

**Response:**
```json
{
  "success": true,
  "download": { /* download object */ }
}
```

### pause_download

Pause an active download.

**Request:**
```json
{
  "command": "pause_download",
  "params": {
    "downloadId": "download-1703...-abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "download": { /* download object */ }
}
```

### resume_download

Resume a paused download.

**Request:**
```json
{
  "command": "resume_download",
  "params": {
    "downloadId": "download-1703...-abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "download": { /* download object */ }
}
```

### cancel_download

Cancel a download.

**Request:**
```json
{
  "command": "cancel_download",
  "params": {
    "downloadId": "download-1703...-abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "download": { /* download object */ }
}
```

### get_download

Get information about a specific download.

**Request:**
```json
{
  "command": "get_download",
  "params": {
    "downloadId": "download-1703...-abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "download": { /* download object */ }
}
```

### get_downloads

Get all downloads with optional filtering.

**Request:**
```json
{
  "command": "get_downloads",
  "params": {
    "limit": 50,           // Optional: max results
    "state": "in_progress" // Optional: filter by state
  }
}
```

**Response:**
```json
{
  "success": true,
  "downloads": [ /* array of download objects */ ],
  "count": 5,
  "total": 10
}
```

### set_download_path

Set the default download directory.

**Request:**
```json
{
  "command": "set_download_path",
  "params": {
    "path": "/path/to/downloads"
  }
}
```

**Response:**
```json
{
  "success": true,
  "downloadPath": "/path/to/downloads"
}
```

### clear_downloads

Clear completed download history.

**Request:**
```json
{
  "command": "clear_downloads"
}
```

**Response:**
```json
{
  "success": true,
  "cleared": 5
}
```

### get_download_status

Get download manager status.

**Request:**
```json
{
  "command": "get_download_status"
}
```

**Response:**
```json
{
  "success": true,
  "status": {
    "downloadPath": "/path/to/downloads",
    "total": 10,
    "active": 2,
    "paused": 1,
    "completed": 5,
    "failed": 1,
    "cancelled": 1,
    "queued": 0,
    "maxConcurrent": 5
  }
}
```

## WebSocket Events

The download manager broadcasts events to connected WebSocket clients:

### download-started

Broadcast when a download begins.

```json
{
  "type": "download-started",
  "download": { /* download object */ }
}
```

### download-progress

Broadcast periodically during active downloads.

```json
{
  "type": "download-progress",
  "download": { /* download object with updated progress */ }
}
```

### download-completed

Broadcast when a download completes successfully.

```json
{
  "type": "download-completed",
  "download": { /* download object */ }
}
```

### download-failed

Broadcast when a download fails.

```json
{
  "type": "download-failed",
  "download": { /* download object with error info */ }
}
```

### download-cancelled

Broadcast when a download is cancelled.

```json
{
  "type": "download-cancelled",
  "download": { /* download object */ }
}
```

## IPC API (Renderer Process)

The download manager exposes methods via the `electronAPI` object in the renderer process:

```javascript
// Start a download
await window.electronAPI.startDownload({ url: 'https://example.com/file.zip' });

// Pause a download
await window.electronAPI.pauseDownload('download-id');

// Resume a download
await window.electronAPI.resumeDownload('download-id');

// Cancel a download
await window.electronAPI.cancelDownload('download-id');

// Get download info
await window.electronAPI.getDownload('download-id');

// Get active downloads
await window.electronAPI.getActiveDownloads();

// Get completed downloads
await window.electronAPI.getCompletedDownloads();

// Get all downloads
await window.electronAPI.getDownloads({ limit: 50 });

// Clear completed downloads
await window.electronAPI.clearCompletedDownloads();

// Set download path
await window.electronAPI.setDownloadPath('/path/to/downloads');

// Get current download path
await window.electronAPI.getDownloadPath();

// Get download manager status
await window.electronAPI.getDownloadStatus();
```

### Event Listeners

```javascript
// Listen for download events
window.electronAPI.onDownloadStarted((download) => {
  console.log('Download started:', download);
});

window.electronAPI.onDownloadProgress((download) => {
  console.log(`Progress: ${download.progress}%`);
});

window.electronAPI.onDownloadCompleted((download) => {
  console.log('Download completed:', download.filename);
});

window.electronAPI.onDownloadFailed((download) => {
  console.error('Download failed:', download.error);
});

window.electronAPI.onDownloadCancelled((download) => {
  console.log('Download cancelled:', download.filename);
});
```

## UI Integration

The download manager is integrated into the browser UI:

1. **Status Bar Indicator**: Shows active download count and overall progress
2. **Progress Bar**: Visual indicator of download progress
3. **Notifications**: Toast notifications for download events

### Status Bar Display

- Hidden when no downloads are active
- Shows download count and average progress
- Animated download icon during active downloads
- Progress bar fills as downloads complete

### Notifications

Notifications appear in the bottom-right corner and auto-dismiss after 4 seconds:

- **Download Started**: Blue/info style
- **Download Completed**: Green/success style
- **Download Failed**: Red/error style
- **Download Cancelled**: Gray/info style

## Error Handling

The download manager handles various error scenarios:

| Error | Description |
|-------|-------------|
| Network errors | Connection issues, timeouts |
| Disk errors | Insufficient space, write permissions |
| Invalid URL | Malformed or inaccessible URLs |
| Resume not supported | Server doesn't support range requests |

Errors are returned in the response with `success: false` and an `error` message.

## Configuration

Default configuration options:

```javascript
{
  downloadPath: app.getPath('downloads'), // System downloads folder
  maxConcurrentDownloads: 5,              // Max parallel downloads
  autoOpenCompleted: false                // Open files after download
}
```

## Best Practices

1. **Check download state before operations**: Ensure download is in appropriate state before pause/resume/cancel
2. **Handle progress events efficiently**: Throttle UI updates for frequent progress events
3. **Monitor WebSocket events**: Subscribe to download events for real-time updates
4. **Clean up completed downloads**: Periodically clear download history to free memory
5. **Verify download path**: Ensure download directory exists and is writable
