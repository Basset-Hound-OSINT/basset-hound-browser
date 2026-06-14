# Video Recording Integration Guide

**Version:** 1.0.0  
**Date:** June 14, 2026  
**Status:** Ready for Integration

## Quick Start

### 1. Install FFmpeg (Required Dependency)

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
choco install ffmpeg

# Verify installation
ffmpeg -version
ffprobe -version
```

### 2. Register WebSocket Commands

Add this to your WebSocket server initialization (e.g., `websocket/server.js`):

```javascript
const {
  registerVideoRecordingCommands,
  initializeVideoRecording
} = require('./commands/video-recording-commands');

// In your server initialization function:
function initializeWebSocketServer(mainWindow) {
  // ... existing initialization code ...
  
  // Initialize video recording system
  initializeVideoRecording({
    outputDir: path.join(app.getPath('userData'), 'videos'),
    maxDiskUsage: 10 * 1024 * 1024 * 1024, // 10GB
    cleanupPolicy: 'lru'
  });
  
  // Register video recording commands
  registerVideoRecordingCommands(commandHandlers, mainWindow);
  
  // ... rest of initialization ...
}
```

### 3. Integrate with Screenshot Capture

Update your screenshot capture loop to feed frames to video recording:

```javascript
// In your screenshot/recording loop
async function captureAndRecordFrame(sessionId) {
  // Capture screenshot
  const screenshot = await mainWindow.webContents.capturePage();
  const frameBuffer = screenshot.toPNG().toString('base64');
  
  // Add to video recording if active
  if (activeSessions.has(sessionId)) {
    await websocket.send({
      command: 'add_video_frame',
      params: {
        sessionId,
        frameData: frameBuffer,
        metadata: {
          timestamp: Date.now(),
          url: currentUrl
        }
      }
    });
  }
}
```

## File Structure

```
basset-hound-browser/
├── src/recording/
│   ├── video-encoder.js          # Video encoding engine
│   ├── video-storage.js          # Storage management
│   ├── video-player.js           # Playback & export
│   └── ... (other recording files)
│
├── websocket/commands/
│   ├── video-recording-commands.js # WebSocket API
│   └── ... (other commands)
│
├── tests/unit/
│   ├── video-recording.test.js   # Unit tests
│   └── ... (other tests)
│
└── docs/
    ├── VIDEO-API-REFERENCE.md       # API documentation
    ├── VIDEO-CODEC-GUIDE.md         # Codec selection guide
    ├── VIDEO-INTEGRATION-GUIDE.md   # This file
    └── handoffs/
        └── VIDEO-RECORDING-IMPLEMENTATION-COMPLETE.md
```

## Module Overview

### VideoEncoder (`src/recording/video-encoder.js`)

Main video encoding engine with multi-codec support.

```javascript
const { VideoEncoder } = require('./src/recording/video-encoder');

// Create encoder instance
const encoder = new VideoEncoder({
  codec: 'vp9',           // or vp8, h264, h265
  fps: 24,                // or 10, 30
  outputDir: '/path/to/videos'
});

// Create recording session
const session = encoder.createSession('unique-id');

// Start recording
await session.start();

// Add frames (from screenshots)
await session.addFrame(frameBuffer, { metadata: {} });

// Finalize recording
const metrics = await session.finalize();
```

### VideoStorage (`src/recording/video-storage.js`)

Manages video files, metadata, and cleanup.

```javascript
const { VideoStorage } = require('./src/recording/video-storage');

const storage = new VideoStorage({
  storageDir: '/path/to/videos',
  maxDiskUsage: 10 * 1024 * 1024 * 1024,
  cleanupPolicy: 'lru'
});

// Register video after recording
storage.registerVideo('/path/to/video.webm', {
  codec: 'vp9',
  fps: 24,
  duration: 60,
  tags: ['forensic', 'important']
});

// List videos
const videos = storage.listVideos({ codec: 'vp9' });

// Get stats
const stats = storage.getStorageStats();

// Cleanup old files
await storage.cleanup();
```

### VideoPlayer (`src/recording/video-player.js`)

Playback, export, and video manipulation.

```javascript
const { VideoPlayer } = require('./src/recording/video-player');

const player = new VideoPlayer();

// Get metadata
const metadata = await player.getVideoMetadata('/path/to/video.webm');

// Export to different format
await player.exportVideo('/path/to/video.webm', {
  format: 'mp4',
  quality: 23,
  startTime: 10,
  endTime: 50
});

// Extract frames
const frames = await player.extractFrames('/path/to/video.webm', {
  startTime: 5,
  endTime: 15,
  format: 'png'
});

// Create thumbnail
await player.createThumbnail('/path/to/video.webm', {
  timestamp: '00:00:05',
  width: 640,
  height: 360
});
```

## Integration Patterns

### Pattern 1: Simple Recording Session

```javascript
// Start recording
const recordResult = await websocket.send({
  command: 'start_video_recording',
  params: {
    sessionId: 'session-001',
    codec: 'vp9',
    fps: 24,
    tags: ['investigation']
  }
});

// Add frames at regular intervals (e.g., every 100ms for 10fps)
const frameInterval = setInterval(async () => {
  const screenshot = await captureScreenshot();
  
  await websocket.send({
    command: 'add_video_frame',
    params: {
      sessionId: 'session-001',
      frameData: screenshot.toString('base64')
    }
  });
}, 100);

// Stop after duration
setTimeout(async () => {
  clearInterval(frameInterval);
  
  const stopResult = await websocket.send({
    command: 'stop_video_recording',
    params: { sessionId: 'session-001' }
  });
  
  console.log('Recording saved:', stopResult.outputPath);
}, 60000); // 1 minute
```

### Pattern 2: Recording with Progress Tracking

```javascript
async function recordWithProgress(duration) {
  // Start
  const startResult = await websocket.send({
    command: 'start_video_recording',
    params: {
      sessionId: `session-${Date.now()}`,
      codec: 'vp9',
      fps: 24
    }
  });
  
  const sessionId = startResult.sessionId;
  const startTime = Date.now();
  const frameDuration = 1000 / 24; // 24 fps
  
  // Recording loop
  while (Date.now() - startTime < duration) {
    const screenshot = await captureScreenshot();
    
    const frameResult = await websocket.send({
      command: 'add_video_frame',
      params: {
        sessionId,
        frameData: screenshot.toString('base64')
      }
    });
    
    // Check status periodically
    if (frameResult.frameNumber % 240 === 0) { // Every 10 seconds at 24fps
      const status = await websocket.send({
        command: 'get_video_recording_status',
        params: { sessionId }
      });
      console.log(`Recording progress: ${status.sessions[0].metrics.framesProcessed} frames`);
    }
    
    // Frame timing
    await sleep(frameDuration);
  }
  
  // Stop
  const stopResult = await websocket.send({
    command: 'stop_video_recording',
    params: { sessionId }
  });
  
  return stopResult;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Pattern 3: Post-Processing Pipeline

```javascript
async function recordAndProcess(duration) {
  // 1. Record
  const recordResult = await recordWithProgress(duration);
  const videoFile = recordResult.outputPath;
  
  // 2. Get metadata
  const info = await websocket.send({
    command: 'get_video_info',
    params: { filename: videoFile }
  });
  
  // 3. Export for different uses
  
  // Create web-playable version
  await websocket.send({
    command: 'export_video',
    params: {
      filename: videoFile,
      format: 'mp4',
      quality: 23,
      resolution: '1280x720'
    }
  });
  
  // Create compressed archive version
  await websocket.send({
    command: 'export_video',
    params: {
      filename: videoFile,
      format: 'webm',
      quality: 40
    }
  });
  
  // 4. Create thumbnail
  await websocket.send({
    command: 'create_video_thumbnail',
    params: {
      filename: videoFile,
      timestamp: '00:00:05',
      width: 640,
      height: 360
    }
  });
  
  // 5. Extract key frames
  await websocket.send({
    command: 'extract_frames',
    params: {
      filename: videoFile,
      startTime: 10,
      endTime: 20,
      format: 'png'
    }
  });
}
```

## Configuration Examples

### Development Configuration

```javascript
const videoConfig = {
  codec: 'vp8',              // Fast encoding
  fps: 10,                   // Lower frame rate
  quality: 8,                // Lower quality
  maxWidth: 1280,
  maxHeight: 720,
  outputDir: './videos',     // Local directory
  maxDiskUsage: 1024 * 1024 * 1024, // 1GB
  cleanupPolicy: 'fifo'      // Simple cleanup
};
```

### Production Configuration

```javascript
const videoConfig = {
  codec: 'vp9',              // Best compression
  fps: 24,                   // Standard frame rate
  quality: 32,               // Balanced quality
  maxWidth: 1920,
  maxHeight: 1080,
  outputDir: '/data/videos', // Production path
  maxDiskUsage: 100 * 1024 * 1024 * 1024, // 100GB
  cleanupPolicy: 'lru'       // Smart cleanup
};
```

### Forensic Configuration

```javascript
const videoConfig = {
  codec: 'vp9',              // High compression
  fps: 30,                   // High frame rate
  quality: 20,               // High quality
  maxWidth: 1920,
  maxHeight: 1080,
  enableCompression: true,
  outputDir: '/evidence/videos', // Secure path
  maxDiskUsage: 500 * 1024 * 1024 * 1024, // 500GB
  cleanupPolicy: 'none'      // No automatic cleanup
};
```

## Testing

### Run Unit Tests

```bash
npm test -- tests/unit/video-recording.test.js
```

### Run Specific Test Suite

```bash
npm test -- tests/unit/video-recording.test.js -t "VideoEncoder"
npm test -- tests/unit/video-recording.test.js -t "VideoStorage"
npm test -- tests/unit/video-recording.test.js -t "Integration"
```

### Manual Testing

```javascript
// Manual test script
async function manualTest() {
  // 1. Test codec detection
  const ffmpegAvailable = await VideoEncoder.isAvailable();
  console.log('FFmpeg available:', ffmpegAvailable);
  
  if (!ffmpegAvailable) {
    console.error('FFmpeg not found. Install it with: brew install ffmpeg');
    return;
  }
  
  // 2. Test encoder creation
  const encoder = new VideoEncoder({ outputDir: './test-videos' });
  const session = encoder.createSession('test-1');
  
  // 3. Test session lifecycle
  await session.start();
  console.log('Session started:', session.getMetrics());
  
  // Simulate frames (in real usage, these come from screenshots)
  for (let i = 0; i < 100; i++) {
    const fakeFrame = Buffer.alloc(1920 * 1080 * 3, i % 256);
    await session.addFrame(fakeFrame);
  }
  
  const metrics = await session.finalize();
  console.log('Session completed:', metrics);
}
```

## Error Handling

### Common Integration Issues

**Issue: "FFmpeg is not available"**
```bash
# Solution: Install FFmpeg
sudo apt-get install ffmpeg  # Linux
brew install ffmpeg          # macOS
choco install ffmpeg         # Windows
```

**Issue: "Recording session not found"**
```javascript
// Verify session ID
console.log('Active sessions:', videoEncoder.listActiveSessions());

// Check that start_video_recording completed successfully
const startResult = await websocket.send({
  command: 'start_video_recording',
  params: { sessionId: 'my-session' }
});
console.assert(startResult.success, startResult.error);
```

**Issue: "High memory usage"**
```javascript
// Reduce frame buffer size
new VideoEncoder({
  chunkSize: 50  // Process frames more frequently
});

// Or reduce resolution
{
  maxWidth: 1280,
  maxHeight: 720
}
```

## Performance Tuning

### Optimize for Speed

```javascript
{
  codec: 'vp8',    // Fastest
  fps: 10,         // Lower frame rate
  quality: 8,      // Lower quality
  chunkSize: 50    // More frequent flushes
}
// ~250 fps encode speed, 20-30 MB/hour
```

### Optimize for Quality

```javascript
{
  codec: 'vp9',    // Good balance
  fps: 30,         // Higher frame rate
  quality: 20,     // Better quality
  chunkSize: 200   // Batch process
}
// ~80 fps encode speed, 100-140 MB/hour
```

### Optimize for Storage

```javascript
{
  codec: 'h265',   // Best compression
  fps: 24,
  quality: 35,     // Compressed
  chunkSize: 100
}
// ~100 fps encode speed, 50-70 MB/hour
```

## Monitoring & Logging

### Add Logging to Your Integration

```javascript
// Hook into storage events
storage.on('videoRegistered', (entry) => {
  logger.info(`Video registered: ${entry.filename} (${entry.size} bytes)`);
});

storage.on('videoCompressed', (event) => {
  logger.info(`Video compressed: ${event.ratio} ratio`);
});

storage.on('videoDeleted', (event) => {
  logger.info(`Video deleted: ${event.filename}`);
});

// Hook into encoder events
encoder.on('sessionCompleted', (data) => {
  logger.info(`Recording completed: ${data.sessionId}`);
  logger.info(`Metrics: ${JSON.stringify(data.metrics)}`);
});

encoder.on('sessionError', (data) => {
  logger.error(`Recording error: ${data.sessionId} - ${data.error}`);
});
```

### Monitor Storage

```javascript
// Periodic storage monitoring
setInterval(async () => {
  const stats = await websocket.send({
    command: 'get_video_storage_stats'
  });
  
  logger.info(`Storage usage: ${stats.usagePercentage}%`);
  logger.info(`Total videos: ${stats.totalVideos}`);
  
  if (stats.usagePercentage > 80) {
    logger.warn('Storage usage above 80%, triggering cleanup');
    await websocket.send({
      command: 'cleanup_video_storage'
    });
  }
}, 60000); // Every minute
```

## Deployment Checklist

- [ ] FFmpeg installed on target system
- [ ] WebSocket commands registered in server.js
- [ ] Video storage directory configured and writable
- [ ] Disk space sufficient for configured maxDiskUsage
- [ ] Tests passing: `npm test -- tests/unit/video-recording.test.js`
- [ ] Integration tested with live browser instance
- [ ] Monitoring/logging configured
- [ ] Documentation reviewed and updated
- [ ] Security review completed (if applicable)
- [ ] Performance tested with expected load

## Troubleshooting Checklist

- [ ] FFmpeg installed: `which ffmpeg` / `where ffmpeg`
- [ ] FFmpeg version: `ffmpeg -version`
- [ ] ffprobe available: `which ffprobe` / `where ffprobe`
- [ ] Storage directory writable: `ls -l /path/to/storage`
- [ ] Disk space available: `df -h`
- [ ] Node modules updated: `npm install`
- [ ] Tests run: `npm test`
- [ ] WebSocket server logs for errors

## Documentation References

- **API Reference**: [VIDEO-API-REFERENCE.md](./VIDEO-API-REFERENCE.md)
- **Codec Guide**: [VIDEO-CODEC-GUIDE.md](./VIDEO-CODEC-GUIDE.md)
- **Implementation Details**: [docs/handoffs/VIDEO-RECORDING-IMPLEMENTATION-COMPLETE.md](./handoffs/VIDEO-RECORDING-IMPLEMENTATION-COMPLETE.md)

## Support & Troubleshooting

For issues, check:
1. FFmpeg installation (`ffmpeg -version`)
2. WebSocket server logs
3. Test results (`npm test`)
4. Console logs for specific error messages
5. API reference for parameter validation

## Next Steps

1. Install FFmpeg on target system
2. Register WebSocket commands in server.js
3. Integrate with screenshot capture loop
4. Run tests to verify installation
5. Deploy to production
6. Monitor storage usage
7. Configure cleanup policies as needed

---

**Status:** Ready for Integration  
**Last Updated:** June 14, 2026  
**Version:** 1.0.0
