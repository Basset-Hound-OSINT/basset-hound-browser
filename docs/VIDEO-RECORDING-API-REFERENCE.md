# Video Recording WebSocket API Reference

**Version:** 1.0.0  
**Date:** June 14, 2026  
**Status:** Production Ready

## Quick Start

### Basic Recording Example
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

// Start recording
ws.send(JSON.stringify({
  command: 'start_video_recording',
  params: {
    sessionId: 'my-session-1',
    codec: 'vp9',
    fps: 24
  }
}));

// Add frames
const imageBase64 = Buffer.from(screenshotData).toString('base64');
ws.send(JSON.stringify({
  command: 'add_video_frame',
  params: {
    sessionId: 'my-session-1',
    frameData: imageBase64
  }
}));

// Stop recording
ws.send(JSON.stringify({
  command: 'stop_video_recording',
  params: {
    sessionId: 'my-session-1'
  }
}));

// Export as MP4
ws.send(JSON.stringify({
  command: 'export_video',
  params: {
    filename: 'my-session-1.webm',
    format: 'mp4'
  }
}));
```

## All Commands

### 1. start_video_recording
Start a new video recording session.

**Parameters:**
- `sessionId` (string, required): Unique identifier for this recording
- `codec` (string, optional): vp8, vp9, h264, h265 (default: vp9)
- `fps` (number, optional): 10, 24, or 30 (default: 24)
- `quality` (number, optional): Codec-specific quality (0-63 for VP9)
- `maxWidth` (number, optional): Default: 1920
- `maxHeight` (number, optional): Default: 1080
- `enableAudio` (boolean, optional): Default: false
- `enableCompression` (boolean, optional): Default: true
- `tags` (array, optional): For filtering recordings
- `metadata` (object, optional): Custom metadata

**Response:**
```json
{
  "success": true,
  "sessionId": "my-session-1",
  "codec": "vp9",
  "fps": 24,
  "quality": 32,
  "resolution": {"width": 1920, "height": 1080},
  "state": "recording"
}
```

**Error Cases:**
- Missing `sessionId`: "sessionId is required"
- Duplicate session: "Recording session ... already active"
- FFmpeg not available: "FFmpeg is not available"

---

### 2. add_video_frame
Add a screenshot frame to an active recording.

**Parameters:**
- `sessionId` (string, required): Session identifier
- `frameData` (string, required): Base64-encoded image data
- `metadata` (object, optional): Frame-specific metadata

**Response:**
```json
{
  "success": true,
  "sessionId": "my-session-1",
  "frameNumber": 42,
  "metrics": {
    "framesProcessed": 42,
    "duration": 1.75,
    "bytesWritten": 12345
  }
}
```

**Error Cases:**
- Missing parameters: "sessionId and frameData are required"
- Session not found: "Recording session ... not found"

---

### 3. stop_video_recording
Stop recording and finalize the video file.

**Parameters:**
- `sessionId` (string, required): Session identifier

**Response:**
```json
{
  "success": true,
  "sessionId": "my-session-1",
  "outputPath": "/path/to/my-session-1.webm",
  "metrics": {
    "framesProcessed": 100,
    "duration": 4.17,
    "fileSize": 512000,
    "codec": "vp9",
    "fps": 24
  }
}
```

**Error Cases:**
- Session not found: "Recording session ... not found"
- Encoding failure: [FFmpeg error details]

---

### 4. pause_video_recording
Pause recording without closing the session.

**Parameters:**
- `sessionId` (string, required): Session identifier

**Response:**
```json
{
  "success": true,
  "sessionId": "my-session-1",
  "state": "paused"
}
```

---

### 5. resume_video_recording
Resume recording from a paused state.

**Parameters:**
- `sessionId` (string, required): Session identifier

**Response:**
```json
{
  "success": true,
  "sessionId": "my-session-1",
  "state": "recording"
}
```

---

### 6. get_video_recording_status
Get status of recording session(s).

**Parameters:**
- `sessionId` (string, optional): If provided, get status of specific session

**Response (Specific Session):**
```json
{
  "success": true,
  "sessions": [{
    "sessionId": "my-session-1",
    "state": "recording",
    "metrics": {
      "framesProcessed": 50,
      "duration": 2.08
    },
    "startTime": 1718400000000,
    "elapsedTime": 2083
  }]
}
```

**Response (All Sessions):**
```json
{
  "success": true,
  "activeSessions": 2,
  "sessions": [/* ... */]
}
```

---

### 7. list_recordings
List all recorded videos with optional filtering.

**Parameters:**
- `tags` (array, optional): Filter by tags
- `codec` (string, optional): Filter by codec (vp8, vp9, h264, h265)
- `sortBy` (string, optional): created, size, duration (default: created)
- `sortOrder` (string, optional): asc, desc (default: desc)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "videos": [
    {
      "filename": "session-123.webm",
      "codec": "vp9",
      "duration": 120.5,
      "size": 1024000,
      "created": 1718400000000,
      "fps": 24,
      "resolution": {"width": 1920, "height": 1080},
      "tags": ["forensic", "important"]
    }
  ]
}
```

---

### 8. get_video_info
Get detailed metadata for a specific video.

**Parameters:**
- `filename` (string, required): Video filename

**Response:**
```json
{
  "success": true,
  "video": {
    "filename": "session-123.webm",
    "codec": "vp9",
    "duration": 120.5,
    "size": 1024000,
    "created": 1718400000000,
    "fps": 24,
    "resolution": {"width": 1920, "height": 1080},
    "detailed": {
      "streams": [
        {
          "index": 0,
          "codec_type": "video",
          "width": 1920,
          "height": 1080,
          "duration": 120.5
        }
      ]
    }
  }
}
```

---

### 9. export_video
Export/convert video to different format with optional transformations.

**Parameters:**
- `filename` (string, required): Source video filename
- `format` (string, required): mp4, webm, mkv, mov
- `quality` (number, optional): Output quality (0-51)
- `startTime` (number, optional): Trim start (seconds)
- `endTime` (number, optional): Trim end (seconds)
- `speed` (number, optional): Playback speed (default: 1.0)
- `resolution` (string, optional): WIDTHxHEIGHT (e.g., "1280x720")

**Response:**
```json
{
  "success": true,
  "outputPath": "/path/to/exported/session-123.mp4",
  "format": "mp4",
  "originalSize": 1024000,
  "exportedSize": 768000,
  "duration": 120.5
}
```

**Examples:**
```javascript
// Convert to MP4
{ filename: "video.webm", format: "mp4" }

// Trim and convert
{ filename: "video.webm", format: "mp4", startTime: 10, endTime: 60 }

// Speed up video
{ filename: "video.webm", format: "webm", speed: 1.5 }

// Scale down resolution
{ filename: "video.webm", format: "mp4", resolution: "1280x720" }
```

---

### 10. extract_frames
Extract frames from video as image files.

**Parameters:**
- `filename` (string, required): Source video filename
- `startTime` (number, optional): Start time (seconds, default: 0)
- `endTime` (number, optional): End time (seconds)
- `format` (string, optional): png, jpg (default: png)

**Response:**
```json
{
  "success": true,
  "outputDirectory": "/path/to/frames",
  "frameCount": 120,
  "frameRate": 24,
  "files": ["frame-001.png", "frame-002.png", ...]
}
```

---

### 11. create_video_thumbnail
Generate a thumbnail image from a specific timestamp.

**Parameters:**
- `filename` (string, required): Source video filename
- `timestamp` (string or number, optional): Time in format "00:00:01" or seconds (default: "00:00:01")
- `width` (number, optional): Thumbnail width (default: 320)
- `height` (number, optional): Thumbnail height (default: 180)

**Response:**
```json
{
  "success": true,
  "thumbnailPath": "/path/to/thumbnail.png",
  "width": 320,
  "height": 180,
  "timestamp": 1.0
}
```

---

### 12. delete_video
Delete a video file and update metadata.

**Parameters:**
- `filename` (string, required): Video filename to delete

**Response:**
```json
{
  "success": true,
  "filename": "session-123.webm",
  "freedSpace": 1024000
}
```

---

### 13. get_video_storage_stats
Get comprehensive storage statistics.

**Parameters:** None

**Response:**
```json
{
  "success": true,
  "totalVideos": 12,
  "totalSize": 12288000,
  "usage": 12.29,
  "maxSize": 10737418240,
  "usagePercentage": 0.1145,
  "oldestVideo": {
    "filename": "session-001.webm",
    "created": 1717900000000
  },
  "newestVideo": {
    "filename": "session-123.webm",
    "created": 1718400000000
  },
  "cleanupPolicy": "lru",
  "compressionEnabled": true
}
```

---

### 14. cleanup_video_storage
Execute cleanup to free disk space based on configured policy.

**Parameters:**
- `policy` (string, optional): Override cleanup policy (lru, lfu, fifo, age)

**Response:**
```json
{
  "success": true,
  "filesDeleted": 3,
  "spacedFreed": 3072000,
  "policy": "lru",
  "newUsage": 9216000,
  "newUsagePercentage": 0.086
}
```

## Codec Selection Guide

| Codec | Pros | Cons | Best For |
|-------|------|------|----------|
| **VP8** | Fast, good compression, open source | Lower quality | Quick captures, web playback |
| **VP9** | Best overall, 70-85% compression, future-proof | Slower encoding | Production recording (default) |
| **H.264** | Excellent compatibility, fast | Larger file sizes | Cross-platform compatibility |
| **H.265** | Best compression 75-93%, highest quality | Slow, limited support | Long-term archival, storage-critical |

**Recommendation:** Use VP9 as default (best balance), H.264 for compatibility, H.265 for storage optimization.

## Frame Rate Recommendations

| FPS | Latency | Quality | Use Case |
|-----|---------|---------|----------|
| **10** | Lowest | Lower | Real-time monitoring |
| **24** | Normal | Good | Standard web video (default) |
| **30** | Higher | Excellent | High-action captures |

## Quality Settings by Codec

### VP9 Quality (CRF: 0-63, lower = better)
- 0-10: Lossless/near-lossless (huge files)
- 15-25: High quality (recommended: 23)
- **32: Default**
- 40-50: Medium quality
- 50+: Low quality

### H.264 Quality (CRF: 0-51)
- 0-18: High quality
- **23: Default**
- 28-35: Medium quality
- 40+: Low quality

### H.265 Quality (CRF: 0-51)
- 0-18: Excellent quality
- **25: Default**
- 28-35: Good quality
- 40+: Fair quality

## Common Use Cases

### 1. Full Page Forensic Recording
```javascript
{
  "command": "start_video_recording",
  "params": {
    "sessionId": "forensic-session",
    "codec": "vp9",
    "fps": 24,
    "quality": 28,
    "tags": ["forensic", "legal-hold"],
    "metadata": {
      "purpose": "evidence-capture",
      "timestamp": new Date().toISOString()
    }
  }
}
```

### 2. Real-time Monitoring
```javascript
{
  "command": "start_video_recording",
  "params": {
    "sessionId": "monitor-session",
    "codec": "vp8",
    "fps": 10,
    "enableCompression": true
  }
}
```

### 3. High-Quality Archive
```javascript
{
  "command": "start_video_recording",
  "params": {
    "sessionId": "archive-session",
    "codec": "h265",
    "fps": 30,
    "quality": 25,
    "tags": ["archive"],
    "metadata": {
      "retention": "7-years",
      "compliance": "sox"
    }
  }
}
```

### 4. Export to Multiple Formats
```javascript
// Start recording
ws.send(JSON.stringify({
  "command": "start_video_recording",
  "params": { "sessionId": "session-1" }
}));

// ... capture frames ...

// Stop and export as multiple formats
ws.send(JSON.stringify({
  "command": "export_video",
  "params": {
    "filename": "session-1.webm",
    "format": "mp4"  // Client-friendly format
  }
}));

ws.send(JSON.stringify({
  "command": "export_video",
  "params": {
    "filename": "session-1.webm",
    "format": "mov"  // For Mac compatibility
  }
}));
```

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "sessionId is required" | Missing parameter | Provide sessionId |
| "already active" | Duplicate session | Use unique sessionId |
| "not found" | Session doesn't exist | Start session first |
| "FFmpeg is not available" | FFmpeg not installed | Install FFmpeg |
| "No space left on device" | Disk full | Run cleanup_video_storage |

## Response Codes

All responses follow this structure:
```json
{
  "success": true/false,
  "error": "string (if success=false)",
  "data": {} // Command-specific data (if success=true)
}
```

## Performance Tips

1. **Use VP9 with quality 32-40** for good compression and speed
2. **Use 24 fps** for balanced quality and file size
3. **Enable compression** for long recordings
4. **Set cleanup policy to LRU** for automatic space management
5. **Extract frames in batches** to avoid memory spikes
6. **Monitor storage stats** regularly with get_video_storage_stats

## Environment Variables

```bash
# Codec and format
VIDEO_CODEC=vp9              # Default codec
VIDEO_FPS=24                 # Default frame rate
VIDEO_QUALITY=32             # Default quality

# Storage
VIDEO_OUTPUT_DIR=/videos     # Where videos are saved
VIDEO_MAX_DISK=10GB          # Max total disk usage

# Cleanup
VIDEO_CLEANUP_POLICY=lru     # Cleanup strategy
VIDEO_COMPRESSION=true       # Enable gzip compression
```

## Integration Examples

### With Python SDK
```python
import json
import websocket

ws = websocket.WebSocketApp("ws://localhost:8765")

ws.send(json.dumps({
    "command": "start_video_recording",
    "params": {
        "sessionId": "python-session",
        "codec": "vp9"
    }
}))
```

### With Node.js
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  ws.send(JSON.stringify({
    command: 'start_video_recording',
    params: { sessionId: 'node-session' }
  }));
});
```

### With cURL
```bash
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  ws://localhost:8765

# Then send commands as JSON over WebSocket
```

---

**Documentation Version:** 1.0.0  
**Last Updated:** June 14, 2026  
**Status:** Production Ready
