/**
 * Basset Hound Browser - Screenshot Headless Mode Tests
 * Tests for headless mode detection and fallback mechanisms
 */

const { ScreenshotManager, detectHeadlessMode } = require('../../screenshots/manager');

describe('ScreenshotManager - Headless Mode', () => {
  let screenshotManager;
  let mockMainWindow;

  beforeEach(() => {
    // Mock BrowserWindow
    mockMainWindow = {
      webContents: {
        send: jest.fn(),
        capturePage: jest.fn(),
        setUserAgent: jest.fn(),
        getURL: jest.fn(() => 'about:blank'),
        getTitle: jest.fn(() => 'Test Page'),
        getUserAgent: jest.fn(() => 'Mozilla/5.0 Test')
      },
      isDestroyed: jest.fn(() => false)
    };

    screenshotManager = new ScreenshotManager(mockMainWindow);
  });

  describe('Headless Mode Detection', () => {
    it('should detect headless mode from HEADLESS env var', () => {
      const originalEnv = process.env.HEADLESS;
      process.env.HEADLESS = 'true';

      const isHeadless = detectHeadlessMode();
      expect(isHeadless).toBe(true);

      process.env.HEADLESS = originalEnv;
    });

    it('should detect headless mode from missing DISPLAY', () => {
      const originalDisplay = process.env.DISPLAY;
      delete process.env.DISPLAY;

      const manager = new ScreenshotManager(mockMainWindow);
      expect(manager.headlessModeEnabled).toBe(true);

      process.env.DISPLAY = originalDisplay;
    });

    it('should detect headless mode from process arguments', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'test.js', '--headless'];

      const manager = new ScreenshotManager(mockMainWindow);
      expect(manager.headlessModeEnabled).toBe(true);

      process.argv = originalArgv;
    });
  });

  describe('Headless Screenshot Capture', () => {
    it('should capture viewport in headless mode with valid image', async () => {
      screenshotManager.headlessModeEnabled = true;

      const mockImage = {
        isEmpty: jest.fn(() => false),
        getSize: jest.fn(() => ({ width: 1920, height: 1080 })),
        toDataURL: jest.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
      };

      mockMainWindow.webContents.capturePage.mockResolvedValueOnce(mockImage);

      const result = await screenshotManager.captureViewport({ format: 'png' });

      expect(result.success).toBe(true);
      expect(result.captureMethod).toBe('mainWindowDirect');
      expect(result.headlessMode).toBe(true);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('should return error for empty image in headless mode', async () => {
      screenshotManager.headlessModeEnabled = true;

      const mockImage = {
        isEmpty: jest.fn(() => true)
      };

      mockMainWindow.webContents.capturePage.mockResolvedValueOnce(mockImage);

      const result = await screenshotManager.captureViewport({ format: 'png' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('zero dimensions');
      expect(result.headlessMode).toBe(true);
    });

    it('should use cached frame as fallback in headless mode', async () => {
      screenshotManager.headlessModeEnabled = true;
      screenshotManager.headlessAlternativeMethod = 'offscreen';

      const cachedFrameData = 'data:image/png;base64,cachedFrame';
      screenshotManager.lastHeadlessFrame = cachedFrameData;

      const mockImage = {
        isEmpty: () => true
      };

      mockMainWindow.webContents.capturePage.mockResolvedValueOnce(mockImage);

      const result = await screenshotManager.captureViewport({ format: 'png' });

      expect(result.success).toBe(true);
      expect(result.captureMethod).toBe('offscreenCache');
      expect(result.cached).toBe(true);
      expect(result.data).toBe(cachedFrameData);
    });

    it('should use GUI mode capture when not in headless', async () => {
      screenshotManager.headlessModeEnabled = false;

      const result = await screenshotManager.captureViewport({ format: 'png' });

      // In GUI mode, it uses IPC, so send should be called
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-viewport',
        expect.objectContaining({
          format: 'png',
          quality: 1.0
        })
      );
    });
  });

  describe('Frame Caching', () => {
    it('should cache last rendered frame', async () => {
      screenshotManager.headlessModeEnabled = true;

      const mockImage = {
        isEmpty: () => false,
        toDataURL: () => 'data:image/png;base64,cachedFrame'
      };

      mockMainWindow.webContents.capturePage.mockResolvedValueOnce(mockImage);

      const success = await screenshotManager.cacheLastRenderedFrame(mockMainWindow.webContents);

      expect(success).toBe(true);
      expect(screenshotManager.lastHeadlessFrame).toBe('data:image/png;base64,cachedFrame');
    });

    it('should return false if frame caching fails', async () => {
      screenshotManager.headlessModeEnabled = true;

      mockMainWindow.webContents.capturePage.mockRejectedValueOnce(new Error('Capture failed'));

      const success = await screenshotManager.cacheLastRenderedFrame(mockMainWindow.webContents);

      expect(success).toBe(false);
    });

    it('should not cache in non-headless mode', async () => {
      screenshotManager.headlessModeEnabled = false;

      const success = await screenshotManager.cacheLastRenderedFrame(mockMainWindow.webContents);

      expect(success).toBe(false);
    });
  });

  describe('Headless Mode Status', () => {
    it('should provide accurate headless mode status', () => {
      screenshotManager.headlessModeEnabled = true;
      screenshotManager.headlessAlternativeMethod = 'offscreen';
      screenshotManager.lastHeadlessFrame = 'data:image/png;base64,test';

      const status = screenshotManager.getHeadlessModeStatus();

      expect(status.headlessModeEnabled).toBe(true);
      expect(status.alternativeMethod).toBe('offscreen');
      expect(status.hasCachedFrame).toBe(true);
      expect(status.recommendation).toContain('headless mode');
    });

    it('should provide GUI recommendations when not in headless', () => {
      screenshotManager.headlessModeEnabled = false;

      const status = screenshotManager.getHeadlessModeStatus();

      expect(status.headlessModeEnabled).toBe(false);
      expect(status.recommendation).toContain('GUI mode');
    });
  });

  describe('Headless Alternative Method Detection', () => {
    it('should set xvfb as alternative method', () => {
      screenshotManager.headlessModeEnabled = true;
      screenshotManager.setHeadlessAlternativeMethod('xvfb');

      expect(screenshotManager.headlessAlternativeMethod).toBe('xvfb');
    });

    it('should set offscreen as alternative method', () => {
      screenshotManager.headlessModeEnabled = true;
      screenshotManager.setHeadlessAlternativeMethod('offscreen');

      expect(screenshotManager.headlessAlternativeMethod).toBe('offscreen');
    });

    it('should validate alternative method values', () => {
      screenshotManager.setHeadlessAlternativeMethod('invalid');

      // Should not change invalid method
      expect(screenshotManager.headlessAlternativeMethod).not.toBe('invalid');
    });
  });

  describe('Cleanup', () => {
    it('should clear cached frame on cleanup', () => {
      screenshotManager.lastHeadlessFrame = 'data:image/png;base64,test';

      screenshotManager.cleanup();

      expect(screenshotManager.lastHeadlessFrame).toBeNull();
    });

    it('should clear pending requests on cleanup', () => {
      screenshotManager.pendingRequests.set('test-1', () => {});
      screenshotManager.pendingRequests.set('test-2', () => {});

      screenshotManager.cleanup();

      expect(screenshotManager.pendingRequests.size).toBe(0);
    });
  });
});
