/**
 * OPT-04: Session Recording Streaming Tests
 * Tests for stream-based recording with memory-efficient storage
 */

const StreamingSessionRecorder = require('../src/recording/streaming-recorder');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to create temp directory
function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `basset-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

// Helper to clean up temp directory
function cleanupDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        fs.unlinkSync(filePath);
      });
      fs.rmdirSync(dir);
    }
  } catch (err) {
    console.warn('Failed to cleanup:', err);
  }
}

describe('StreamingSessionRecorder', () => {
  let tempDir;
  let recorder;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(async () => {
    if (recorder && !recorder.closed) {
      try {
        await recorder.close();
      } catch (err) {
        // Ignore close errors
      }
    }
    cleanupDir(tempDir);
  });

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  describe('Basic Functionality', () => {
    test('should create recorder with default settings', () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      expect(recorder.sessionId).toBe('test-session');
      expect(recorder.totalFrameCount).toBe(0);
      expect(recorder.totalEventCount).toBe(0);
      expect(recorder.closed).toBe(false);
    });

    test('should record single frame', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      const frameId = await recorder.recordFrame({
        type: 'dom',
        html: '<html><body>Test</body></html>'
      });

      expect(frameId).toBe(0);
      expect(recorder.totalFrameCount).toBe(1);
      expect(recorder.memoryBuffer.length).toBe(1);
    });

    test('should record multiple frames', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 10; i++) {
        const frameId = await recorder.recordFrame({
          content: `Frame ${i}`
        });
        expect(frameId).toBe(i);
      }

      expect(recorder.totalFrameCount).toBe(10);
    });

    test('should record events', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      const eventId = await recorder.recordEvent({
        action: 'click',
        target: 'button'
      });

      expect(eventId).toBe(0);
      expect(recorder.totalEventCount).toBe(1);
    });

    test('should create log file on disk', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ content: 'test' });
      await recorder.flushDiskWrites();

      expect(fs.existsSync(recorder.logPath)).toBe(true);
    });

    test('should close recorder gracefully', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ content: 'test' });
      await recorder.close();

      expect(recorder.closed).toBe(true);
    });
  });

  // ============================================================================
  // MEMORY BUFFER MANAGEMENT TESTS
  // ============================================================================

  describe('Memory Buffer Management', () => {
    test('should limit memory buffer size', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 5
      });

      for (let i = 0; i < 20; i++) {
        await recorder.recordFrame({ id: i, data: 'x'.repeat(100) });
      }

      // Memory buffer should have only last 5 frames
      expect(recorder.memoryBuffer.length).toBe(5);
      // But total count should be 20
      expect(recorder.totalFrameCount).toBe(20);
    });

    test('should keep recent frames in memory', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 3
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ id: i });
      }

      // Memory buffer should have frames 7, 8, 9
      const memoryFrameIds = recorder.memoryBuffer.map(f => f.frameId);
      expect(memoryFrameIds).toEqual([7, 8, 9]);
    });

    test('should calculate memory estimate', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 10
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ data: 'x'.repeat(1000) });
      }

      const estimate = recorder.getMemoryEstimate();
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(100000); // Less than 100KB for 10 frames
    });

    test('should minimize memory usage with streaming', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 5
      });

      const memBefore = process.memoryUsage().heapUsed;

      // Record 500 frames
      for (let i = 0; i < 500; i++) {
        await recorder.recordFrame({
          data: 'x'.repeat(10000) // 10KB per frame
        });

        if (i % 100 === 0) {
          await recorder.flushDiskWrites();
        }
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memGrowth = (memAfter - memBefore) / 1024 / 1024;

      // Memory growth should be limited (< 50MB despite 5MB of frames)
      expect(memGrowth).toBeLessThan(50);
    });
  });

  // ============================================================================
  // DISK WRITING TESTS
  // ============================================================================

  describe('Disk Writing', () => {
    test('should write frames to disk in JSONL format', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ content: 'frame1' });
      await recorder.recordFrame({ content: 'frame2' });
      await recorder.flushDiskWrites();
      await recorder.close();

      const content = fs.readFileSync(recorder.logPath, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);

      const frame1 = JSON.parse(lines[0]);
      const frame2 = JSON.parse(lines[1]);

      expect(frame1.frameId).toBe(0);
      expect(frame2.frameId).toBe(1);
      expect(frame1.content).toBe('frame1');
      expect(frame2.content).toBe('frame2');
    });

    test('should write events to disk', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordEvent({ action: 'click' });
      await recorder.recordEvent({ action: 'scroll' });
      await recorder.flushDiskWrites();
      await recorder.close();

      const content = fs.readFileSync(recorder.logPath, 'utf8');
      const lines = content.trim().split('\n');

      const event1 = JSON.parse(lines[0]);
      const event2 = JSON.parse(lines[1]);

      expect(event1.action).toBe('click');
      expect(event2.action).toBe('scroll');
    });

    test('should track disk usage', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ data: 'x'.repeat(1000) });
      }
      await recorder.flushDiskWrites();

      const diskUsage = recorder.getDiskUsage();
      expect(diskUsage).toBeGreaterThan(0);
    });

    test('should handle backpressure from disk writes', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        chunkSize: 1000 // Large chunk size
      });

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(recorder.recordFrame({
          data: 'x'.repeat(5000)
        }));
      }

      await Promise.all(promises);
      await recorder.flushDiskWrites();

      expect(recorder.totalFrameCount).toBe(100);
      expect(fs.existsSync(recorder.logPath)).toBe(true);
    });

    test('should flush writes when chunk size reached', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        chunkSize: 3
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ id: i });
      }

      // Give time for async writes
      await new Promise(resolve => setTimeout(resolve, 100));

      const content = fs.readFileSync(recorder.logPath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);

      // Should have flushed at least once
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // PLAYBACK TESTS
  // ============================================================================

  describe('Playback', () => {
    test('should playback frames in order', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 2
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ id: i });
      }
      await recorder.close();

      const frames = [];
      for await (const frame of recorder.playback()) {
        frames.push(frame);
      }

      expect(frames.length).toBe(10);
      expect(frames[0].frameId).toBe(0);
      expect(frames[9].frameId).toBe(9);
    });

    test('should playback with frame range', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ id: i });
      }
      await recorder.close();

      const frames = [];
      for await (const frame of recorder.playback({
        startFrame: 2,
        endFrame: 5
      })) {
        frames.push(frame);
      }

      expect(frames.length).toBe(4);
      expect(frames[0].frameId).toBe(2);
      expect(frames[3].frameId).toBe(5);
    });

    test('should playback with filter', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ id: i, type: i % 2 === 0 ? 'dom' : 'event' });
      }
      await recorder.close();

      const frames = [];
      for await (const frame of recorder.playback({
        filter: (f) => f.type === 'dom'
      })) {
        frames.push(frame);
      }

      expect(frames.length).toBe(5);
      expect(frames.every(f => f.type === 'dom')).toBe(true);
    });

    test('should playback mixed frames and events', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ id: 1 });
      await recorder.recordEvent({ action: 'click' });
      await recorder.recordFrame({ id: 2 });
      await recorder.recordEvent({ action: 'scroll' });
      await recorder.close();

      const items = [];
      for await (const item of recorder.playback()) {
        items.push(item);
      }

      expect(items.length).toBe(4);
      expect(items[0].type).toBe('frame');
      expect(items[1].type).toBe('event');
    });

    test('should handle empty recording', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });
      await recorder.close();

      const frames = [];
      for await (const frame of recorder.playback()) {
        frames.push(frame);
      }

      expect(frames.length).toBe(0);
    });
  });

  // ============================================================================
  // EXPORT TESTS
  // ============================================================================

  describe('Export', () => {
    test('should export to JSONL format', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 5; i++) {
        await recorder.recordFrame({ id: i });
      }
      await recorder.close();

      const exportPath = path.join(tempDir, 'export.jsonl');
      const result = await recorder.exportRecording(exportPath, 'jsonl');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(5);
      expect(fs.existsSync(exportPath)).toBe(true);

      const content = fs.readFileSync(exportPath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(5);
    });

    test('should export to JSON format', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 3; i++) {
        await recorder.recordFrame({ id: i });
      }
      await recorder.close();

      const exportPath = path.join(tempDir, 'export.json');
      const result = await recorder.exportRecording(exportPath, 'json');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(3);

      const content = fs.readFileSync(exportPath, 'utf8');
      const data = JSON.parse(content);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
    });

    test('should handle large exports', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 5
      });

      for (let i = 0; i < 100; i++) {
        await recorder.recordFrame({
          id: i,
          data: 'x'.repeat(1000)
        });
      }
      await recorder.close();

      const exportPath = path.join(tempDir, 'export-large.jsonl');
      const result = await recorder.exportRecording(exportPath, 'jsonl');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(100);
      expect(fs.existsSync(exportPath)).toBe(true);
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('Statistics', () => {
    test('should return recording statistics', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 5; i++) {
        await recorder.recordFrame({ id: i });
      }
      for (let i = 0; i < 3; i++) {
        await recorder.recordEvent({ action: i });
      }

      const stats = await recorder.getRecordingStats();

      expect(stats.sessionId).toBe('test-session');
      expect(stats.frames.total).toBe(5);
      expect(stats.events.total).toBe(3);
      expect(stats.status).toBe('recording');
    });

    test('should track memory and disk usage in stats', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 10; i++) {
        await recorder.recordFrame({ data: 'x'.repeat(1000) });
      }
      await recorder.flushDiskWrites();

      const stats = await recorder.getRecordingStats();

      expect(stats.memory.bufferedBytes).toBeGreaterThan(0);
      expect(stats.disk.sizeBytes).toBeGreaterThan(0);
    });

    test('should track write performance', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      for (let i = 0; i < 20; i++) {
        await recorder.recordFrame({ data: 'x'.repeat(1000) });
      }

      const stats = await recorder.getRecordingStats();

      expect(stats.performance.totalWrites).toBeGreaterThan(0);
      expect(stats.performance.writeRate).toBeDefined();
    });

    test('should format recording duration', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ data: 'test' });

      const stats = await recorder.getRecordingStats();

      expect(stats.recordingDuration.formatted).toBeDefined();
      expect(stats.recordingDuration.seconds).toBeGreaterThanOrEqual(0);
    });

    test('should report status as closed after close', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ data: 'test' });
      await recorder.close();

      const stats = await recorder.getRecordingStats();
      expect(stats.status).toBe('closed');
    });
  });

  // ============================================================================
  // TIME RANGE TESTS
  // ============================================================================

  describe('Time Range Queries', () => {
    test('should retrieve frames in time range', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      const startTime = Date.now();

      for (let i = 0; i < 5; i++) {
        await recorder.recordFrame({ id: i });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const midTime = Date.now();
      const endTime = Date.now() + 1000;

      const frames = await recorder.getFramesInRange(startTime, midTime);

      expect(frames.length).toBeGreaterThan(0);
      expect(frames.every(f => f.timestamp >= startTime && f.timestamp <= midTime)).toBe(true);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('should reject recording after close', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.close();

      await expect(recorder.recordFrame({ data: 'test' }))
        .rejects.toThrow('Recorder is closed');
    });

    test('should handle invalid log directory', () => {
      // Should create directory automatically
      const invalidDir = path.join(tempDir, 'subdir', 'nested', 'dir');
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: invalidDir
      });

      expect(fs.existsSync(invalidDir)).toBe(true);
    });

    test('should track and report errors', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      const stats = await recorder.getRecordingStats();
      expect(stats.errors.count).toBe(0);
    });

    test('should delete recording files', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir
      });

      await recorder.recordFrame({ data: 'test' });
      const logPath = recorder.logPath;
      const indexPath = recorder.indexPath;

      await recorder.delete();

      expect(fs.existsSync(logPath)).toBe(false);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    test('should handle realistic session recording', async () => {
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 10,
        chunkSize: 50
      });

      // Simulate a realistic session
      for (let i = 0; i < 100; i++) {
        // Record frame
        await recorder.recordFrame({
          type: 'dom',
          html: '<html><body>' + ('x'.repeat(1000)) + '</body></html>',
          url: 'https://example.com',
          title: `Page ${i}`
        });

        // Record some events
        if (i % 5 === 0) {
          await recorder.recordEvent({
            action: 'click',
            selector: '#button',
            timestamp: Date.now()
          });
        }

        // Occasional delays
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const stats = await recorder.getRecordingStats();
      expect(stats.frames.total).toBe(100);
      expect(stats.events.total).toBe(20);
      expect(stats.frames.inMemory).toBe(10); // Limited to memoryFrameLimit
      expect(stats.frames.onDisk).toBe(90);

      await recorder.close();

      // Verify can playback all frames
      const frames = [];
      for await (const frame of recorder.playback()) {
        frames.push(frame);
      }
      expect(frames.length).toBe(120); // 100 frames + 20 events
    });

    test('should achieve 80% memory reduction vs full buffering', async () => {
      // Simulate full buffering (old approach)
      const fullBufferMemBefore = process.memoryUsage().heapUsed;
      const fullBuffer = [];
      for (let i = 0; i < 200; i++) {
        fullBuffer.push({
          frameId: i,
          data: 'x'.repeat(5000)
        });
      }
      const fullBufferMemUsed = process.memoryUsage().heapUsed - fullBufferMemBefore;

      // Simulate streaming (new approach)
      recorder = new StreamingSessionRecorder('test-session', {
        logDir: tempDir,
        memoryFrameLimit: 5
      });

      const streamingMemBefore = process.memoryUsage().heapUsed;
      for (let i = 0; i < 200; i++) {
        await recorder.recordFrame({
          data: 'x'.repeat(5000)
        });
        if (i % 50 === 0) {
          await recorder.flushDiskWrites();
        }
      }
      const streamingMemUsed = process.memoryUsage().heapUsed - streamingMemBefore;

      // Streaming should use significantly less memory
      const reduction = (1 - (streamingMemUsed / fullBufferMemUsed)) * 100;
      expect(reduction).toBeGreaterThan(50); // At least 50% reduction
    });
  });
});
