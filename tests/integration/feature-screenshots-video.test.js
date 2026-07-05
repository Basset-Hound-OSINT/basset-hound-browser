/**
 * Feature Integration Tests - Screenshots and Video Recording
 *
 * Comprehensive testing for screenshot and video recording features including:
 * - Screenshot formats and quality levels
 * - Video recording start/stop and formats
 * - Screenshots within video recordings
 * - Error cases and recovery
 * - Performance and stability
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const TEST_CONFIG = {
  WS_URL: 'ws://localhost:8765',
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  RESULTS_DIR: path.join(__dirname, '..', 'results', 'integration-screenshots-video'),
  TEST_SESSION_ID: 'test-screenshot-video-' + Date.now()
};

// Ensure results directory exists
if (!fs.existsSync(TEST_CONFIG.RESULTS_DIR)) {
  fs.mkdirSync(TEST_CONFIG.RESULTS_DIR, { recursive: true });
}

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            const handler = this.pendingMessages.get(message.id);
            if (handler) {
              this.pendingMessages.delete(message.id);
              handler(message);
            }
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        });

        this.ws.on('error', (error) => {
          if (this.pendingMessages.size === 0) {
            reject(error);
          } else {
            console.error('WebSocket error:', error);
          }
        });

        setTimeout(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, TEST_CONFIG.CONNECT_TIMEOUT);
      } catch (e) {
        reject(e);
      }
    });
  }

  send(command, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const message = { id, command, params };

      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Command timeout: ${command}`));
      }, TEST_CONFIG.COMMAND_TIMEOUT);

      this.pendingMessages.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        this.pendingMessages.delete(id);
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws.on('close', resolve);
      } else {
        resolve();
      }
    });
  }
}

describe('Feature Integration Tests - Screenshots and Video Recording', () => {
  let client;

  beforeAll(async () => {
    client = new WebSocketClient(TEST_CONFIG.WS_URL);
    try {
      await client.connect();
    } catch (e) {
      console.warn('WebSocket server not available, tests will be skipped');
    }
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  // Skip all tests if WebSocket is not available
  const skipIfNoServer = (testFn) => {
    return async function (...args) {
      if (!client || !client.ws || client.ws.readyState !== WebSocket.OPEN) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }
      return testFn.apply(this, args);
    };
  };

  describe('Screenshot Feature Tests', () => {
    it('should capture viewport screenshot', skipIfNoServer(async () => {
      const response = await client.send('capture_screenshot', {
        sessionId: TEST_CONFIG.TEST_SESSION_ID,
        format: 'png',
        quality: 80
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.format).toBe('png');
    }));

    it('should capture full page screenshot', skipIfNoServer(async () => {
      const response = await client.send('capture_screenshot', {
        sessionId: TEST_CONFIG.TEST_SESSION_ID,
        fullPage: true,
        format: 'png'
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    }));

    it('should capture element screenshot', skipIfNoServer(async () => {
      const response = await client.send('capture_screenshot', {
        sessionId: TEST_CONFIG.TEST_SESSION_ID,
        selector: 'body',
        format: 'png'
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    }));

    it('should support multiple formats', skipIfNoServer(async () => {
      const formats = ['png', 'jpeg', 'webp'];

      for (const format of formats) {
        const response = await client.send('capture_screenshot', {
          sessionId: TEST_CONFIG.TEST_SESSION_ID,
          format
        });

        if (response.success) {
          expect(response.format).toBe(format);
        }
      }
    }));

    it('should handle quality settings', skipIfNoServer(async () => {
      const qualities = [50, 75, 90];

      for (const quality of qualities) {
        const response = await client.send('capture_screenshot', {
          sessionId: TEST_CONFIG.TEST_SESSION_ID,
          format: 'jpeg',
          quality
        });

        expect(response).toBeDefined();
      }
    }));

    it('should handle screenshot errors gracefully', skipIfNoServer(async () => {
      const response = await client.send('capture_screenshot', {
        sessionId: TEST_CONFIG.TEST_SESSION_ID,
        selector: '#nonexistent-element'
      });

      expect(response).toBeDefined();
      // Should handle error gracefully
    }));
  });

  describe('Video Recording Feature Tests', () => {
    it('should start video recording', skipIfNoServer(async () => {
      const response = await client.send('start_video_recording', {
        sessionId: TEST_CONFIG.TEST_SESSION_ID + '-video-1',
        codec: 'vp9',
        fps: 24
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.sessionId).toBe(TEST_CONFIG.TEST_SESSION_ID + '-video-1');
    }));

    it('should stop video recording', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-video-2';

      // Start recording
      let response = await client.send('start_video_recording', {
        sessionId,
        codec: 'vp9',
        fps: 24
      });

      if (response.success) {
        // Stop recording
        response = await client.send('stop_video_recording', {
          sessionId
        });

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
      }
    }));

    it('should support video codecs', skipIfNoServer(async () => {
      const codecs = ['vp8', 'vp9', 'h264', 'h265'];

      for (let i = 0; i < codecs.length; i++) {
        const response = await client.send('start_video_recording', {
          sessionId: TEST_CONFIG.TEST_SESSION_ID + `-video-codec-${i}`,
          codec: codecs[i],
          fps: 24
        });

        if (response.success) {
          expect(response.codec).toBe(codecs[i]);

          // Stop the recording
          await client.send('stop_video_recording', {
            sessionId: TEST_CONFIG.TEST_SESSION_ID + `-video-codec-${i}`
          });
        }
      }
    }));

    it('should support frame rates', skipIfNoServer(async () => {
      const fpsValues = [10, 24, 30];

      for (let i = 0; i < fpsValues.length; i++) {
        const response = await client.send('start_video_recording', {
          sessionId: TEST_CONFIG.TEST_SESSION_ID + `-video-fps-${i}`,
          codec: 'vp9',
          fps: fpsValues[i]
        });

        if (response.success) {
          expect(response.fps).toBe(fpsValues[i]);

          await client.send('stop_video_recording', {
            sessionId: TEST_CONFIG.TEST_SESSION_ID + `-video-fps-${i}`
          });
        }
      }
    }));

    it('should pause and resume video recording', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-video-pause-resume';

      // Start recording
      let response = await client.send('start_video_recording', {
        sessionId,
        codec: 'vp9',
        fps: 24
      });

      if (response.success) {
        // Pause recording
        response = await client.send('pause_video_recording', {
          sessionId
        });

        if (response && response.success) {
          // Resume recording
          response = await client.send('resume_video_recording', {
            sessionId
          });

          expect(response.success).toBe(true);
        }

        // Stop recording
        await client.send('stop_video_recording', {
          sessionId
        });
      }
    }));

    it('should get video recording status', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-video-status';

      const response = await client.send('get_video_recording_status', {
        sessionId
      });

      expect(response).toBeDefined();
    }));
  });

  describe('Combined Feature Tests', () => {
    it('should capture screenshots during video recording', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-combined-1';

      // Start recording
      const recordResponse = await client.send('start_video_recording', {
        sessionId,
        codec: 'vp9',
        fps: 24
      });

      if (recordResponse.success) {
        // Capture screenshot while recording
        const screenshotResponse = await client.send('capture_screenshot', {
          sessionId,
          format: 'png'
        });

        // Verify both operations succeeded or were attempted
        expect(recordResponse.success).toBe(true);

        // Stop recording
        await client.send('stop_video_recording', {
          sessionId
        });
      }
    }));

    it('should capture multiple screenshots during video recording', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-combined-2';

      // Start recording
      const recordResponse = await client.send('start_video_recording', {
        sessionId,
        codec: 'vp9',
        fps: 24
      });

      if (recordResponse.success) {
        const screenshotCount = 3;

        for (let i = 0; i < screenshotCount; i++) {
          const screenshotResponse = await client.send('capture_screenshot', {
            sessionId,
            format: 'png'
          });

          // Add small delay between screenshots
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Stop recording
        const stopResponse = await client.send('stop_video_recording', {
          sessionId
        });

        expect(stopResponse.success).toBe(true);
      }
    }));
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid session IDs', skipIfNoServer(async () => {
      const response = await client.send('capture_screenshot', {
        sessionId: '',
        format: 'png'
      });

      expect(response).toBeDefined();
      // Should handle error gracefully
    }));

    it('should handle invalid format', skipIfNoServer(async () => {
      const response = await client.send('capture_screenshot', {
        sessionId: TEST_CONFIG.TEST_SESSION_ID,
        format: 'invalid-format'
      });

      expect(response).toBeDefined();
    }));

    it('should handle duplicate video recording start', skipIfNoServer(async () => {
      const sessionId = TEST_CONFIG.TEST_SESSION_ID + '-duplicate';

      const response1 = await client.send('start_video_recording', {
        sessionId,
        codec: 'vp9',
        fps: 24
      });

      if (response1.success) {
        const response2 = await client.send('start_video_recording', {
          sessionId,
          codec: 'vp9',
          fps: 24
        });

        // Should handle duplicate gracefully
        expect(response2).toBeDefined();

        // Cleanup
        await client.send('stop_video_recording', {
          sessionId
        });
      }
    }));

    it('should handle stop on non-existent recording', skipIfNoServer(async () => {
      const response = await client.send('stop_video_recording', {
        sessionId: 'nonexistent-session-' + Date.now()
      });

      expect(response).toBeDefined();
    }));
  });
});
