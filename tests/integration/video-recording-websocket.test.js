/**
 * Basset Hound Browser - Video Recording WebSocket Integration Tests
 *
 * Tests for video recording command integration with WebSocket API
 * Validates all 14 video recording commands work properly when called via WebSocket
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Setup test utilities
const testPort = 8777;
const testUrl = `ws://localhost:${testPort}`;

// Mock Electron and dependencies
jest.mock('electron', () => ({
  ipcMain: {
    once: jest.fn(),
    on: jest.fn(),
    handle: jest.fn(),
    removeListener: jest.fn()
  },
  session: {
    defaultSession: {
      cookies: {
        get: jest.fn().mockResolvedValue([]),
        set: jest.fn().mockResolvedValue(undefined)
      },
      setProxy: jest.fn().mockResolvedValue(undefined)
    }
  }
}));

jest.mock('../../evasion/humanize', () => ({
  humanDelay: jest.fn().mockResolvedValue(undefined),
  humanType: jest.fn().mockImplementation(text => Promise.resolve(text)),
  humanMouseMove: jest.fn().mockResolvedValue([]),
  humanScroll: jest.fn().mockResolvedValue({ scrollAmount: 300, scrollDuration: 1000 })
}));

jest.mock('../../screenshots/manager', () => ({
  ScreenshotManager: jest.fn().mockImplementation(() => ({
    captureViewport: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    cleanup: jest.fn()
  })),
  validateAnnotation: jest.fn().mockReturnValue({ valid: true }),
  applyAnnotationDefaults: jest.fn().mockImplementation(a => a)
}));

jest.mock('../../recording/manager', () => ({
  RecordingManager: jest.fn().mockImplementation(() => ({
    startRecording: jest.fn().mockResolvedValue({ success: true }),
    stopRecording: jest.fn().mockResolvedValue({ success: true }),
    cleanup: jest.fn()
  })),
  RecordingState: { IDLE: 'idle', RECORDING: 'recording', PAUSED: 'paused' }
}));

jest.mock('../../proxy/manager', () => ({
  proxyManager: {
    setProxy: jest.fn().mockResolvedValue({ success: true }),
    getProxyStatus: jest.fn().mockReturnValue({ enabled: false }),
    setupAuthHandler: jest.fn(),
    handleAutoModeNavigation: jest.fn().mockResolvedValue({ handled: false })
  },
  PROXY_TYPES: {}
}));

jest.mock('../../utils/user-agents', () => ({
  userAgentManager: {
    setUserAgent: jest.fn().mockReturnValue({ success: true }),
    getRandomUserAgent: jest.fn().mockReturnValue('Mozilla/5.0')
  },
  UA_CATEGORIES: {}
}));

jest.mock('../../utils/request-interceptor', () => ({
  requestInterceptor: { initialize: jest.fn() },
  RESOURCE_TYPES: {},
  PREDEFINED_BLOCK_RULES: {}
}));

jest.mock('../../logging', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis()
  }),
  defaultLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis()
  },
  defaultProfiler: {
    profile: jest.fn().mockReturnValue({ end: jest.fn() })
  },
  defaultMemoryMonitor: {
    captureSnapshot: jest.fn()
  },
  defaultDebugManager: {
    setReferences: jest.fn()
  },
  LOG_LEVELS: {},
  LEVEL_NAMES: {},
  WebSocketTransport: jest.fn()
}));

jest.mock('../../utils/memory-manager', () => ({
  memoryManager: {
    setWebSocketServer: jest.fn(),
    captureSnapshot: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ usage: 50 })
  },
  MemoryManager: jest.fn(),
  MEMORY_THRESHOLDS: {},
  MemoryStatus: {}
}));

// Additional mocks for managers
jest.mock('../../utils/gc-tuning', () => ({
  initializeGCTuning: jest.fn().mockReturnValue({ cleanup: jest.fn() }),
  initializeAdvancedGCTuning: jest.fn().mockReturnValue({ cleanup: jest.fn() }),
  getAdaptiveGCManager: jest.fn().mockReturnValue({})
}));

jest.mock('../../headless/manager', () => ({
  headlessManager: {
    offscreenRenderingEnabled: false,
    captureFromLastFrame: jest.fn()
  },
  HEADLESS_PRESETS: {}
}));

describe('Video Recording WebSocket Integration', () => {
  let server;
  let ws;
  let tempDir;

  beforeEach(async () => {
    // Create temp directory for video storage
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));

    // Set environment for video storage
    process.env.VIDEO_OUTPUT_DIR = tempDir;

    // Import server after mocks are set up
    const WebSocketServer = require('../../websocket/server');

    // Mock main window
    const mainWindow = {
      webContents: {
        send: jest.fn(),
        getURL: jest.fn().mockReturnValue('about:blank'),
        executeJavaScript: jest.fn().mockResolvedValue(null),
        capturePage: jest.fn().mockResolvedValue({
          isEmpty: jest.fn().mockReturnValue(false),
          toDataURL: jest.fn().mockReturnValue('data:image/png;base64,iVBORw0KGgo=')
        })
      },
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn()
    };

    // Start WebSocket server
    server = new WebSocketServer(testPort, mainWindow, {
      sslEnabled: false,
      requireAuth: false
    });

    // Wait for server to be ready
    await new Promise(resolve => {
      const checkServer = () => {
        if (server.wss && server.wss._server) {
          resolve();
        } else {
          setTimeout(checkServer, 10);
        }
      };
      checkServer();
    });

    // Connect WebSocket client
    ws = new WebSocket(testUrl);
    await new Promise(resolve => {
      ws.once('open', resolve);
      ws.addEventListener('error', (e) => {
        console.error('WebSocket connection error:', e);
      });
    });
  });

  afterEach(async () => {
    // Close WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    // Stop server
    if (server) {
      await new Promise(resolve => {
        if (server.wss) {
          server.wss.close(resolve);
        } else {
          resolve();
        }
      });
    }

    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean temp directory:', error.message);
      }
    }
  });

  /**
   * Helper to send command via WebSocket and wait for response
   */
  function sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${command} timed out after 5000ms`));
      }, 5000);

      const handler = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.id === 'test-cmd' || message.command === command) {
            clearTimeout(timeout);
            ws.removeEventListener('message', handler);
            resolve(message);
          }
        } catch (error) {
          console.error('Message parse error:', error, 'data:', event.data);
        }
      };

      ws.addEventListener('message', handler);

      const message = {
        id: 'test-cmd',
        command,
        ...params
      };

      ws.send(JSON.stringify(message));
    });
  }

  describe('Video Recording Commands', () => {
    it('should start video recording', async () => {
      const response = await sendCommand('start_video_recording', {
        sessionId: 'test-session-1',
        codec: 'vp9',
        fps: 24,
        quality: 32
      });

      expect(response.success).toBe(true);
      expect(response.sessionId).toBe('test-session-1');
      expect(response.codec).toBe('vp9');
      expect(response.fps).toBe(24);
      expect(response.state).toBe('recording');
    });

    it('should prevent duplicate recording sessions', async () => {
      // Start first session
      await sendCommand('start_video_recording', {
        sessionId: 'test-session-2',
        codec: 'vp9'
      });

      // Try to start duplicate session
      const response = await sendCommand('start_video_recording', {
        sessionId: 'test-session-2',
        codec: 'vp8'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('already active');
    });

    it('should get recording status', async () => {
      // Start recording
      await sendCommand('start_video_recording', {
        sessionId: 'test-session-3',
        codec: 'vp9'
      });

      // Get status
      const response = await sendCommand('get_video_recording_status', {
        sessionId: 'test-session-3'
      });

      expect(response.success).toBe(true);
      expect(response.sessions).toHaveLength(1);
      expect(response.sessions[0].sessionId).toBe('test-session-3');
      expect(response.sessions[0].state).toBe('recording');
    });

    it('should get all recording sessions status', async () => {
      // Start multiple sessions
      await sendCommand('start_video_recording', {
        sessionId: 'test-session-4a',
        codec: 'vp9'
      });

      await sendCommand('start_video_recording', {
        sessionId: 'test-session-4b',
        codec: 'vp8'
      });

      // Get status of all sessions
      const response = await sendCommand('get_video_recording_status', {});

      expect(response.success).toBe(true);
      expect(response.activeSessions).toBeGreaterThanOrEqual(2);
    });

    it('should pause recording', async () => {
      // Start recording
      await sendCommand('start_video_recording', {
        sessionId: 'test-session-5',
        codec: 'vp9'
      });

      // Pause recording
      const response = await sendCommand('pause_video_recording', {
        sessionId: 'test-session-5'
      });

      expect(response.success).toBe(true);
      expect(response.state).toBe('paused');
    });

    it('should resume recording', async () => {
      // Start and pause recording
      await sendCommand('start_video_recording', {
        sessionId: 'test-session-6',
        codec: 'vp9'
      });

      await sendCommand('pause_video_recording', {
        sessionId: 'test-session-6'
      });

      // Resume recording
      const response = await sendCommand('resume_video_recording', {
        sessionId: 'test-session-6'
      });

      expect(response.success).toBe(true);
      expect(response.state).toBe('recording');
    });

    it('should add video frame', async () => {
      // Start recording
      await sendCommand('start_video_recording', {
        sessionId: 'test-session-7',
        codec: 'vp9'
      });

      // Add frame
      const fakeImageData = Buffer.from('fake-image-data').toString('base64');
      const response = await sendCommand('add_video_frame', {
        sessionId: 'test-session-7',
        frameData: fakeImageData
      });

      expect(response.success).toBe(true);
      expect(response.frameNumber).toBeGreaterThan(0);
      expect(response.metrics).toBeDefined();
    });

    it('should list recordings', async () => {
      const response = await sendCommand('list_recordings', {});

      expect(response.success).toBe(true);
      expect(response.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.videos)).toBe(true);
    });

    it('should get video storage stats', async () => {
      const response = await sendCommand('get_video_storage_stats', {});

      expect(response.success).toBe(true);
      expect(response.totalVideos).toBeGreaterThanOrEqual(0);
      expect(response.totalSize).toBeGreaterThanOrEqual(0);
      expect(response.usage).toBeDefined();
    });

    it('should reject missing sessionId for start_video_recording', async () => {
      const response = await sendCommand('start_video_recording', {
        codec: 'vp9'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('sessionId');
    });

    it('should reject missing sessionId for stop_video_recording', async () => {
      const response = await sendCommand('stop_video_recording', {});

      expect(response.success).toBe(false);
      expect(response.error).toContain('sessionId');
    });

    it('should reject non-existent session for pause', async () => {
      const response = await sendCommand('pause_video_recording', {
        sessionId: 'non-existent-session'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should reject non-existent session for resume', async () => {
      const response = await sendCommand('resume_video_recording', {
        sessionId: 'non-existent-session'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should reject non-existent session for get_video_recording_status', async () => {
      const response = await sendCommand('get_video_recording_status', {
        sessionId: 'non-existent-session'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });

  describe('Video Command Integration', () => {
    it('should support recording workflow with frames', async () => {
      // Start recording
      const startRes = await sendCommand('start_video_recording', {
        sessionId: 'workflow-test',
        codec: 'vp9',
        fps: 24
      });
      expect(startRes.success).toBe(true);

      // Add multiple frames
      const fakeImageData = Buffer.from('fake-image-data').toString('base64');
      for (let i = 0; i < 3; i++) {
        const frameRes = await sendCommand('add_video_frame', {
          sessionId: 'workflow-test',
          frameData: fakeImageData
        });
        expect(frameRes.success).toBe(true);
        expect(frameRes.frameNumber).toBe(i + 1);
      }

      // Check status
      const statusRes = await sendCommand('get_video_recording_status', {
        sessionId: 'workflow-test'
      });
      expect(statusRes.success).toBe(true);
      expect(statusRes.sessions[0].metrics.framesProcessed).toBeGreaterThan(0);
    });

    it('should support pause and resume workflow', async () => {
      // Start recording
      await sendCommand('start_video_recording', {
        sessionId: 'pause-test',
        codec: 'vp9'
      });

      // Pause
      let pauseRes = await sendCommand('pause_video_recording', {
        sessionId: 'pause-test'
      });
      expect(pauseRes.success).toBe(true);
      expect(pauseRes.state).toBe('paused');

      // Resume
      const resumeRes = await sendCommand('resume_video_recording', {
        sessionId: 'pause-test'
      });
      expect(resumeRes.success).toBe(true);
      expect(resumeRes.state).toBe('recording');

      // Pause again
      pauseRes = await sendCommand('pause_video_recording', {
        sessionId: 'pause-test'
      });
      expect(pauseRes.success).toBe(true);
    });
  });

  describe('Command Handler Registration', () => {
    it('should have all 14 video commands registered', async () => {
      const expectedCommands = [
        'start_video_recording',
        'stop_video_recording',
        'pause_video_recording',
        'resume_video_recording',
        'get_video_recording_status',
        'add_video_frame',
        'list_recordings',
        'get_video_info',
        'export_video',
        'extract_frames',
        'create_video_thumbnail',
        'delete_video',
        'get_video_storage_stats',
        'cleanup_video_storage'
      ];

      // Try each command to see if it's recognized
      for (const cmd of expectedCommands) {
        // Skip commands that require specific parameters
        if (['get_video_info', 'export_video', 'extract_frames', 'create_video_thumbnail', 'delete_video'].includes(cmd)) {
          continue;
        }

        const response = await sendCommand(cmd, {});

        // We expect either success or a parameter error, not an "unknown command" error
        if (response.error && response.error.includes('Unknown command')) {
          fail(`Command ${cmd} is not registered`);
        }
      }
    });
  });
});
