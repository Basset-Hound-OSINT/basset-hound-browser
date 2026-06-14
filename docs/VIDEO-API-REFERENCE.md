# Video Recording & Playback API Reference

**Version:** 1.0.0  
**Last Updated:** June 14, 2026  
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Core Commands](#core-commands)
3. [Data Types](#data-types)
4. [Error Handling](#error-handling)
5. [Examples](#examples)
6. [Performance Notes](#performance-notes)

## Overview

The Video Recording & Playback API provides comprehensive WebSocket commands for capturing, managing, and manipulating video recordings. The system supports multiple codecs, frame rates, and storage management policies.

### Key Capabilities

- Real-time video recording from screenshots
- Multiple codec support (VP8, VP9, H.264, H.265)
- Configurable frame rates (10, 24, 30 fps)
- Stream-based storage with automatic compression
- Video export to multiple formats
- Frame extraction and thumbnail generation
- Intelligent storage cleanup

## Core Commands

### Recording Control

#### `start_video_recording`

Begin a new video recording session.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Unique identifier for recording session |
| codec | string | No | 'vp9' | Video codec: 'vp8', 'vp9', 'h264', 'h265' |
| fps | number | No | 24 | Frame rate: 10, 24, or 30 |
| quality | number | No | null | Codec-specific quality (see codec table) |
| maxWidth | number | No | 1920 | Maximum video width in pixels |
| maxHeight | number | No | 1080 | Maximum video height in pixels |
| enableAudio | boolean | No | false | Include audio track |
| enableCompression | boolean | No | true | Enable frame compression |
| tags | array | No | [] | Metadata tags for organizing videos |
| metadata | object | No | {} | Custom metadata object |

**Response:**

```javascript
{
  "success": true,
  "sessionId": "session-123",
  "codec": "vp9",
  "fps": 24,
  "quality": 32,
  "resolution": { "width": 1920, "height": 1080 },
  "state": "recording"
}
```

**Errors:**

- `sessionId is required` - Missing required parameter
- `Recording session already exists` - Session ID already in use
- `FFmpeg is not available` - FFmpeg not installed on system
- `Unsupported codec` - Invalid codec specified

**Example:**

```javascript
// Start high-quality recording at 30 fps
await websocket.send({
  command: "start_video_recording",
  params: {
    sessionId: "forensic-001",
    codec: "vp9",
    fps: 30,
    quality: 25,
    tags: ["forensic", "important"],
    metadata: { case: "case-2026-001", investigator: "agent-1" }
  }
});
```

---

#### `stop_video_recording`

Finalize and save a recording session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Session ID from start_video_recording |

**Response:**

```javascript
{
  "success": true,
  "sessionId": "session-123",
  "outputPath": "/path/to/session-123.webm",
  "metrics": {
    "framesProcessed": 1440,
    "duration": 60.0,
    "fileSize": 15728640,
    "codec": "vp9",
    "fps": 24
  }
}
```

**Errors:**

- `sessionId is required` - Missing required parameter
- `Recording session not found` - Invalid session ID

**Example:**

```javascript
// Stop recording after 1 minute
await websocket.send({
  command: "stop_video_recording",
  params: { sessionId: "forensic-001" }
});

// Receive: { success: true, outputPath: "...", metrics: {...} }
```

---

#### `pause_video_recording`

Pause recording without terminating the session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Active session ID |

**Response:**

```javascript
{
  "success": true,
  "sessionId": "session-123",
  "state": "paused"
}
```

---

#### `resume_video_recording`

Resume a paused recording session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Paused session ID |

**Response:**

```javascript
{
  "success": true,
  "sessionId": "session-123",
  "state": "recording"
}
```

---

#### `add_video_frame`

Add a screenshot frame to active recording.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Active session ID |
| frameData | string | Yes | Base64-encoded image (PNG, JPEG, WebP) |
| metadata | object | No | Frame metadata (timestamp, coordinates, etc.) |

**Response:**

```javascript
{
  "success": true,
  "sessionId": "session-123",
  "frameNumber": 42,
  "metrics": {
    "framesProcessed": 42,
    "bytesWritten": 8388608,
    "avgFrameSize": 199475,
    "state": "encoding"
  }
}
```

**Example:**

```javascript
// Capture and add frame every second
const frameInterval = setInterval(async () => {
  const screenshot = await captureScreenshot();
  const base64 = screenshot.toString('base64');
  
  const result = await websocket.send({
    command: "add_video_frame",
    params: {
      sessionId: "session-123",
      frameData: base64,
      metadata: { timestamp: Date.now() }
    }
  });
  
  if (!result.success) {
    clearInterval(frameInterval);
    console.error("Recording failed:", result.error);
  }
}, 1000);
```

---

### Status & Management

#### `get_video_recording_status`

Get status of active recording sessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | No | Specific session ID (all if omitted) |

**Response (all sessions):**

```javascript
{
  "success": true,
  "activeSessions": 2,
  "sessions": [
    {
      "sessionId": "session-123",
      "state": "recording",
      "startTime": 1718400000000,
      "elapsedTime": 45000,
      "metrics": {
        "framesProcessed": 45,
        "bytesWritten": 8388608,
        "avgFrameSize": 186413
      }
    }
  ]
}
```

---

#### `list_recordings`

List recorded videos with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| tags | array | No | Filter by tags |
| codec | string | No | Filter by codec |
| sortBy | string | No | Sort field: 'created', 'size', 'duration' |
| sortOrder | string | No | 'asc' or 'desc' |

**Response:**

```javascript
{
  "success": true,
  "count": 5,
  "videos": [
    {
      "filename": "session-123.webm",
      "codec": "vp9",
      "duration": 60.0,
      "size": 15728640,
      "created": 1718400000000,
      "fps": 24,
      "resolution": { "width": 1920, "height": 1080 },
      "tags": ["forensic", "important"]
    }
  ]
}
```

**Example:**

```javascript
// Find all forensic recordings from the past 7 days
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

const forensicVideos = await websocket.send({
  command: "list_recordings",
  params: {
    tags: ["forensic"],
    sortBy: "created",
    sortOrder: "desc"
  }
});

// Filter by date manually
const recent = forensicVideos.videos.filter(
  v => v.created > sevenDaysAgo
);
```

---

#### `get_video_info`

Get detailed metadata for a specific video.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| filename | string | Yes | Video filename from list_recordings |

**Response:**

```javascript
{
  "success": true,
  "video": {
    "filename": "session-123.webm",
    "codec": "vp9",
    "duration": 60.0,
    "size": 15728640,
    "created": 1718400000000,
    "fps": 24,
    "resolution": { "width": 1920, "height": 1080 },
    "tags": ["forensic"],
    "accessCount": 5,
    "lastAccess": 1718450000000,
    "detailed": {
      "bitRate": 2097152,
      "video": {
        "codec": "vp9",
        "width": 1920,
        "height": 1080,
        "fps": 24
      },
      "audio": null
    }
  }
}
```

---

### Video Manipulation

#### `export_video`

Convert video to different format with optional editing.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| filename | string | Yes | - | Source video filename |
| format | string | Yes | - | Target format: 'mp4', 'webm', 'mkv', 'mov' |
| quality | number | No | null | Format-specific quality |
| startTime | number | No | null | Trim start (seconds) |
| endTime | number | No | null | Trim end (seconds) |
| speed | number | No | 1.0 | Playback speed (0.5-2.0) |
| resolution | string | No | null | Target resolution (e.g., '1280x720') |

**Response:**

```javascript
{
  "success": true,
  "outputPath": "/path/to/session-123-1718400000.mp4",
  "format": "mp4",
  "fileSize": 12345678,
  "created": 1718400000000
}
```

**Example:**

```javascript
// Export first 30 seconds as MP4 at 1280x720
await websocket.send({
  command: "export_video",
  params: {
    filename: "session-123.webm",
    format: "mp4",
    endTime: 30,
    resolution: "1280x720",
    quality: 23
  }
});

// Create slow-motion 2x speed export
await websocket.send({
  command: "export_video",
  params: {
    filename: "session-123.webm",
    format: "webm",
    speed: 0.5,  // Slow down to 50%
    quality: 32
  }
});
```

---

#### `extract_frames`

Extract individual frames from video.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| filename | string | Yes | - | Source video filename |
| startTime | number | No | 0 | Start time in seconds |
| endTime | number | No | null | End time in seconds |
| format | string | No | 'png' | Output format: 'png', 'jpg', 'webp' |

**Response:**

```javascript
{
  "success": true,
  "outputDir": "/path/to/frames",
  "format": "png",
  "frameCount": 150,
  "frames": [
    "/path/to/frames/frame-0001.png",
    "/path/to/frames/frame-0002.png",
    // ... more frames
  ]
}
```

**Use Cases:**

```javascript
// Extract all frames for analysis
const result = await websocket.send({
  command: "extract_frames",
  params: {
    filename: "session-123.webm",
    format: "png"
  }
});

// Extract specific time range for zoomed analysis
await websocket.send({
  command: "extract_frames",
  params: {
    filename: "session-123.webm",
    startTime: 10.5,
    endTime: 20.3,
    format: "jpg"
  }
});
```

---

#### `create_video_thumbnail`

Generate thumbnail from video at specific timestamp.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| filename | string | Yes | - | Source video filename |
| timestamp | string/number | No | '00:00:01' | Timestamp (HH:MM:SS or seconds) |
| width | number | No | 320 | Thumbnail width |
| height | number | No | 180 | Thumbnail height |

**Response:**

```javascript
{
  "success": true,
  "outputPath": "/path/to/session-123-thumb.jpg",
  "width": 320,
  "height": 180
}
```

**Example:**

```javascript
// Create thumbnail at 30-second mark
await websocket.send({
  command: "create_video_thumbnail",
  params: {
    filename: "session-123.webm",
    timestamp: 30,  // 30 seconds in
    width: 640,
    height: 360
  }
});

// Create thumbnail at specific time code
await websocket.send({
  command: "create_video_thumbnail",
  params: {
    filename: "session-123.webm",
    timestamp: "00:01:30",  // 1 minute 30 seconds
    width: 160,
    height: 90
  }
});
```

---

#### `delete_video`

Delete a recorded video.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| filename | string | Yes | Video filename to delete |

**Response:**

```javascript
{
  "success": true,
  "filename": "session-123.webm",
  "size": 15728640
}
```

---

### Storage Management

#### `get_video_storage_stats`

Get comprehensive storage statistics.

**Parameters:** None

**Response:**

```javascript
{
  "success": true,
  "totalVideos": 15,
  "totalSize": 268435456,
  "totalSizeGB": "0.25",
  "totalDuration": 900,
  "totalDurationHours": "0.25",
  "maxDiskUsage": 10737418240,
  "usagePercentage": "2.50",
  "averageFileSize": 17895697,
  "oldestVideo": 1718300000000,
  "newestVideo": 1718400000000
}
```

---

#### `cleanup_video_storage`

Execute cleanup based on configured policy.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| policy | string | No | Override policy: 'lru', 'lfu', 'fifo', 'age' |

**Response:**

```javascript
{
  "success": true,
  "policy": "lru",
  "cleaned": 3,
  "freed": 53687091,
  "freedGB": "0.05"
}
```

---

## Data Types

### Codec Configuration

```typescript
interface CodecPreset {
  name: 'vp8' | 'vp9' | 'h264' | 'h265'
  container: 'webm' | 'mp4'
  mime: string
  ffmpegCodec: string
  quality: 'q:v' | 'crf'
  qualityRange: string
  defaultQuality: number
  preset: 'realtime' | 'good' | 'best' | 'fast'
}
```

### Frame Rate Presets

```typescript
interface FrameRatePreset {
  fps: 10 | 24 | 30
  latency: 'high' | 'medium' | 'low'
  quality: 'low' | 'medium' | 'high'
}
```

### Video Metadata

```typescript
interface VideoMetadata {
  filename: string
  codec: string
  fps: number
  duration: number
  resolution: {
    width: number
    height: number
  }
  size: number
  created: number
  tags: string[]
  metadata: Record<string, any>
  compressed: boolean
  accessCount: number
  lastAccess: number
}
```

## Error Handling

### Standard Error Response

```javascript
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `FFMPEG_NOT_AVAILABLE` | FFmpeg not installed | Install FFmpeg |
| `SESSION_NOT_FOUND` | Invalid session ID | Check session ID |
| `VIDEO_NOT_FOUND` | Invalid filename | Use list_recordings first |
| `CODEC_UNSUPPORTED` | Invalid codec | Use: vp8, vp9, h264, h265 |
| `INVALID_PARAMETER` | Missing/invalid param | Check API docs |
| `DISK_SPACE_EXCEEDED` | Out of storage | Run cleanup_video_storage |
| `ENCODING_FAILED` | FFmpeg error | Check FFmpeg installation |

### Error Handling Example

```javascript
try {
  const response = await websocket.send({
    command: "start_video_recording",
    params: { sessionId: "test", codec: "invalid" }
  });

  if (!response.success) {
    console.error(`Recording failed: ${response.error}`);
    
    // Handle specific errors
    if (response.error.includes("FFmpeg")) {
      console.log("Install FFmpeg to enable recording");
    }
  }
} catch (error) {
  console.error("WebSocket error:", error);
}
```

## Examples

### Complete Recording Workflow

```javascript
// 1. Start recording
const startResult = await websocket.send({
  command: "start_video_recording",
  params: {
    sessionId: "investigation-001",
    codec: "vp9",
    fps: 24,
    tags: ["forensic"]
  }
});

if (!startResult.success) {
  throw new Error(startResult.error);
}

// 2. Capture and add frames
const captureLoop = setInterval(async () => {
  const screenshot = await getScreenshot();
  
  const frameResult = await websocket.send({
    command: "add_video_frame",
    params: {
      sessionId: "investigation-001",
      frameData: screenshot.toString('base64')
    }
  });
  
  if (!frameResult.success) {
    clearInterval(captureLoop);
  }
}, 1000 / 24); // 24 fps

// 3. Stop recording after duration
setTimeout(async () => {
  clearInterval(captureLoop);
  
  const stopResult = await websocket.send({
    command: "stop_video_recording",
    params: { sessionId: "investigation-001" }
  });
  
  console.log("Recording saved:", stopResult.outputPath);
  console.log("Duration:", stopResult.metrics.duration, "seconds");
}, 60000); // Record for 1 minute
```

### Post-Recording Processing

```javascript
// 1. List all recordings
const listResult = await websocket.send({
  command: "list_recordings",
  params: { sortBy: "created", sortOrder: "desc" }
});

// 2. Export for presentation
const videoFile = listResult.videos[0].filename;

await websocket.send({
  command: "export_video",
  params: {
    filename: videoFile,
    format: "mp4",
    quality: 23,
    resolution: "1280x720"
  }
});

// 3. Create thumbnail
await websocket.send({
  command: "create_video_thumbnail",
  params: {
    filename: videoFile,
    timestamp: "00:00:05",
    width: 640,
    height: 360
  }
});

// 4. Extract key frames
await websocket.send({
  command: "extract_frames",
  params: {
    filename: videoFile,
    startTime: 10,
    endTime: 20,
    format: "png"
  }
});
```

## Performance Notes

### Memory Usage During Recording

| Buffer Size | Duration | Memory | Stability |
|------------|----------|--------|-----------|
| 50 frames | 2s @ 24fps | 30 MB | Excellent |
| 100 frames | 4s @ 24fps | 60 MB | Excellent |
| 200 frames | 8s @ 24fps | 120 MB | Good |

### Encoding Throughput

| Codec | Quality | Throughput | Latency |
|-------|---------|-----------|---------|
| VP8 | 6 | 200 fps | 50ms |
| VP9 | 32 | 100 fps | 80ms |
| H.264 | 23 | 150 fps | 60ms |
| H.265 | 28 | 80 fps | 100ms |

### Storage Efficiency (1 hour @ 1920x1080 @ 24fps)

| Format | Quality | File Size | Compression |
|--------|---------|-----------|-------------|
| VP8 | 6 | 180 MB | 64% |
| VP9 | 32 | 140 MB | 76% |
| H.264 | 23 | 240 MB | 60% |
| H.265 | 28 | 100 MB | 82% |

---

**For more information, see:**
- [Implementation Guide](./VIDEO-RECORDING-IMPLEMENTATION-COMPLETE.md)
- [Codec Trade-offs Guide](./VIDEO-CODEC-GUIDE.md)
- [Integration Examples](./examples/video-recording/)
