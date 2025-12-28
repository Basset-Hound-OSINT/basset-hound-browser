/**
 * Basset Hound Browser - Headless Manager Unit Tests
 * Tests for headless mode operation, Xvfb detection, and offscreen rendering
 */

// Mock Electron app module
const mockApp = {
  commandLine: {
    appendSwitch: jest.fn()
  }
};

jest.mock('electron', () => ({
  app: mockApp
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Mock child_process module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawn: jest.fn(() => ({
    unref: jest.fn(),
    kill: jest.fn(),
    pid: 12345
  }))
}));

const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { HeadlessManager, HEADLESS_PRESETS, HEADLESS_FLAGS } = require('../../headless/manager');

describe('HEADLESS_PRESETS', () => {
  test('should define minimal preset', () => {
    expect(HEADLESS_PRESETS).toHaveProperty('minimal');
    expect(HEADLESS_PRESETS.minimal.name).toBe('Minimal');
    expect(HEADLESS_PRESETS.minimal.disableGpu).toBe(true);
    expect(HEADLESS_PRESETS.minimal.disableAcceleration).toBe(true);
    expect(HEADLESS_PRESETS.minimal.reduceMemory).toBe(true);
    expect(HEADLESS_PRESETS.minimal.offscreenRendering).toBe(true);
    expect(HEADLESS_PRESETS.minimal.frameRate).toBe(1);
  });

  test('should define standard preset', () => {
    expect(HEADLESS_PRESETS).toHaveProperty('standard');
    expect(HEADLESS_PRESETS.standard.name).toBe('Standard');
    expect(HEADLESS_PRESETS.standard.disableGpu).toBe(true);
    expect(HEADLESS_PRESETS.standard.disableAcceleration).toBe(false);
    expect(HEADLESS_PRESETS.standard.reduceMemory).toBe(false);
    expect(HEADLESS_PRESETS.standard.offscreenRendering).toBe(true);
    expect(HEADLESS_PRESETS.standard.frameRate).toBe(30);
  });

  test('should define performance preset', () => {
    expect(HEADLESS_PRESETS).toHaveProperty('performance');
    expect(HEADLESS_PRESETS.performance.name).toBe('Performance');
    expect(HEADLESS_PRESETS.performance.disableGpu).toBe(false);
    expect(HEADLESS_PRESETS.performance.disableAcceleration).toBe(false);
    expect(HEADLESS_PRESETS.performance.reduceMemory).toBe(false);
    expect(HEADLESS_PRESETS.performance.offscreenRendering).toBe(true);
    expect(HEADLESS_PRESETS.performance.frameRate).toBe(60);
  });

  test('presets should have descriptions', () => {
    expect(HEADLESS_PRESETS.minimal.description).toBeDefined();
    expect(HEADLESS_PRESETS.standard.description).toBeDefined();
    expect(HEADLESS_PRESETS.performance.description).toBeDefined();
  });
});

describe('HEADLESS_FLAGS', () => {
  test('should define GPU-related flags', () => {
    expect(HEADLESS_FLAGS).toHaveProperty('disable-gpu');
    expect(HEADLESS_FLAGS).toHaveProperty('disable-gpu-compositing');
    expect(HEADLESS_FLAGS).toHaveProperty('disable-software-rasterizer');
  });

  test('should define sandbox-related flags', () => {
    expect(HEADLESS_FLAGS).toHaveProperty('no-sandbox');
    expect(HEADLESS_FLAGS).toHaveProperty('disable-setuid-sandbox');
  });

  test('should define rendering flags', () => {
    expect(HEADLESS_FLAGS).toHaveProperty('enable-features');
  });
});

describe('HeadlessManager', () => {
  let headlessManager;
  const originalArgv = process.argv;
  const originalEnv = process.env;

  beforeEach(() => {
    headlessManager = new HeadlessManager();
    jest.clearAllMocks();

    // Reset process.argv
    process.argv = ['node', 'app.js'];

    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    if (headlessManager) {
      headlessManager.cleanup();
    }
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(headlessManager.enabled).toBe(false);
      expect(headlessManager.initialized).toBe(false);
      expect(headlessManager.preset).toBe('standard');
      expect(headlessManager.displayDetected).toBe(true);
      expect(headlessManager.virtualDisplay).toBeNull();
      expect(headlessManager.xvfbRunning).toBe(false);
      expect(headlessManager.offscreenRenderingEnabled).toBe(false);
    });

    test('should accept custom preset', () => {
      const manager = new HeadlessManager({ preset: 'minimal' });

      expect(manager.preset).toBe('minimal');
      expect(manager.presetConfig).toEqual(HEADLESS_PRESETS.minimal);

      manager.cleanup();
    });

    test('should fallback to standard preset for unknown preset', () => {
      const manager = new HeadlessManager({ preset: 'unknown' });

      expect(manager.presetConfig).toEqual(HEADLESS_PRESETS.standard);

      manager.cleanup();
    });

    test('should initialize CLI options', () => {
      expect(headlessManager.cliOptions).toBeDefined();
      expect(headlessManager.cliOptions.headless).toBe(false);
      expect(headlessManager.cliOptions.disableGpu).toBe(false);
      expect(headlessManager.cliOptions.noSandbox).toBe(false);
      expect(headlessManager.cliOptions.virtualDisplay).toBe(false);
    });

    test('should initialize render stats', () => {
      expect(headlessManager.renderStats).toBeDefined();
      expect(headlessManager.renderStats.framesRendered).toBe(0);
      expect(headlessManager.renderStats.lastFrameTime).toBe(0);
      expect(headlessManager.renderStats.averageFrameTime).toBe(0);
      expect(headlessManager.renderStats.frameTimeHistory).toEqual([]);
    });
  });

  describe('setWebSocketServer', () => {
    test('should set WebSocket server reference', () => {
      const mockServer = { broadcast: jest.fn() };

      headlessManager.setWebSocketServer(mockServer);

      expect(headlessManager.wsServer).toBe(mockServer);
    });
  });

  describe('setMainWindow', () => {
    test('should set main window reference', () => {
      const mockWindow = { webContents: {} };

      headlessManager.setMainWindow(mockWindow);

      expect(headlessManager.mainWindow).toBe(mockWindow);
    });
  });

  describe('parseCommandLineArgs', () => {
    test('should parse --headless flag', () => {
      process.argv = ['node', 'app.js', '--headless'];

      const result = headlessManager.parseCommandLineArgs();

      expect(result.headless).toBe(true);
    });

    test('should parse --disable-gpu flag', () => {
      process.argv = ['node', 'app.js', '--disable-gpu'];

      const result = headlessManager.parseCommandLineArgs();

      expect(result.disableGpu).toBe(true);
    });

    test('should parse --no-sandbox flag', () => {
      process.argv = ['node', 'app.js', '--no-sandbox'];

      const result = headlessManager.parseCommandLineArgs();

      expect(result.noSandbox).toBe(true);
    });

    test('should parse --virtual-display flag', () => {
      process.argv = ['node', 'app.js', '--virtual-display'];

      const result = headlessManager.parseCommandLineArgs();

      expect(result.virtualDisplay).toBe(true);
    });

    test('should parse multiple flags', () => {
      process.argv = ['node', 'app.js', '--headless', '--disable-gpu', '--no-sandbox'];

      const result = headlessManager.parseCommandLineArgs();

      expect(result.headless).toBe(true);
      expect(result.disableGpu).toBe(true);
      expect(result.noSandbox).toBe(true);
    });

    test('should store parsed options in cliOptions', () => {
      process.argv = ['node', 'app.js', '--headless'];

      headlessManager.parseCommandLineArgs();

      expect(headlessManager.cliOptions.headless).toBe(true);
    });
  });

  describe('detectHeadlessEnvironment', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');
    });

    test('should detect Docker environment', () => {
      fs.existsSync.mockImplementation(path => path === '/.dockerenv');

      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.dockerEnvironment).toBe(true);
    });

    test('should detect CI environment from CI variable', () => {
      process.env.CI = 'true';

      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.ciEnvironment).toBe(true);
    });

    test('should detect CI environment from GITHUB_ACTIONS', () => {
      process.env.GITHUB_ACTIONS = 'true';

      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.ciEnvironment).toBe(true);
    });

    test('should detect CI environment from GITLAB_CI', () => {
      process.env.GITLAB_CI = 'true';

      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.ciEnvironment).toBe(true);
    });

    test('should include platform information', () => {
      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.platform).toBe(process.platform);
    });

    test('should check for DISPLAY variable', () => {
      process.env.DISPLAY = ':0';

      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.displayVariable).toBe(':0');
    });

    test('should detect no display when DISPLAY not set on Linux', () => {
      delete process.env.DISPLAY;
      headlessManager.setPlatform('linux');

      const result = headlessManager.detectHeadlessEnvironment();

      expect(result.hasDisplay).toBe(false);

      headlessManager.setPlatform(null);
    });
  });

  describe('checkXvfbRunning', () => {
    test('should return false on non-Linux platform', () => {
      headlessManager.setPlatform('darwin');

      const result = headlessManager.checkXvfbRunning();

      expect(result).toBe(false);

      headlessManager.setPlatform(null);
    });

    test('should detect Xvfb running on Linux', () => {
      headlessManager.setPlatform('linux');
      execSync.mockReturnValue('12345 Xvfb :99 -screen 0 1920x1080x24');

      const result = headlessManager.checkXvfbRunning();

      expect(result).toBe(true);

      headlessManager.setPlatform(null);
    });

    test('should return false when Xvfb not running', () => {
      headlessManager.setPlatform('linux');
      execSync.mockReturnValue('');

      const result = headlessManager.checkXvfbRunning();

      expect(result).toBe(false);

      headlessManager.setPlatform(null);
    });
  });

  describe('startVirtualDisplay', () => {
    test('should fail on non-Linux platform', () => {
      headlessManager.setPlatform('darwin');

      const result = headlessManager.startVirtualDisplay();

      expect(result.success).toBe(false);
      expect(result.error).toContain('only supported on Linux');

      headlessManager.setPlatform(null);
    });

    test('should fail when Xvfb not installed', () => {
      headlessManager.setPlatform('linux');
      execSync.mockImplementation((cmd) => {
        if (cmd === 'which Xvfb') {
          throw new Error('Command not found');
        }
        return '';
      });

      const result = headlessManager.startVirtualDisplay();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Xvfb is not installed');

      headlessManager.setPlatform(null);
    });

    test('should start Xvfb with default options', () => {
      headlessManager.setPlatform('linux');
      execSync.mockImplementation((cmd) => {
        if (cmd === 'which Xvfb') return '/usr/bin/Xvfb';
        if (cmd.includes('pgrep')) return '12345 Xvfb :99';
        return '';
      });

      const result = headlessManager.startVirtualDisplay();

      expect(result.success).toBe(true);
      expect(result.display).toBe(':99');
      expect(result.resolution).toBe('1920x1080x24');
      expect(spawn).toHaveBeenCalledWith('Xvfb', expect.arrayContaining([':99']), expect.any(Object));

      headlessManager.setPlatform(null);
    });

    test('should accept custom display options', () => {
      headlessManager.setPlatform('linux');
      execSync.mockImplementation((cmd) => {
        if (cmd === 'which Xvfb') return '/usr/bin/Xvfb';
        if (cmd.includes('pgrep')) return '12345 Xvfb :50';
        return '';
      });

      const result = headlessManager.startVirtualDisplay({
        displayNum: 50,
        resolution: '1280x720x24'
      });

      expect(result.success).toBe(true);
      expect(result.display).toBe(':50');

      headlessManager.setPlatform(null);
    });

    test('should set DISPLAY environment variable', () => {
      headlessManager.setPlatform('linux');
      execSync.mockImplementation((cmd) => {
        if (cmd === 'which Xvfb') return '/usr/bin/Xvfb';
        if (cmd.includes('pgrep')) return '12345 Xvfb :99';
        return '';
      });

      headlessManager.startVirtualDisplay();

      expect(process.env.DISPLAY).toBe(':99');

      headlessManager.setPlatform(null);
    });
  });

  describe('stopVirtualDisplay', () => {
    test('should fail when not running', () => {
      const result = headlessManager.stopVirtualDisplay();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not running');
    });

    test('should stop running virtual display', () => {
      headlessManager.setPlatform('linux');
      execSync.mockImplementation((cmd) => {
        if (cmd === 'which Xvfb') return '/usr/bin/Xvfb';
        if (cmd.includes('pgrep')) return '12345 Xvfb :99';
        return '';
      });

      headlessManager.startVirtualDisplay();
      const result = headlessManager.stopVirtualDisplay();

      expect(result.success).toBe(true);
      expect(headlessManager.xvfbRunning).toBe(false);
      expect(headlessManager.virtualDisplay).toBeNull();

      headlessManager.setPlatform(null);
    });
  });

  describe('getBrowserWindowConfig', () => {
    test('should return unmodified config when not enabled', () => {
      const baseConfig = { width: 800, height: 600 };

      const result = headlessManager.getBrowserWindowConfig(baseConfig);

      expect(result).toEqual(baseConfig);
    });

    test('should hide window when enabled', () => {
      headlessManager.enabled = true;

      const result = headlessManager.getBrowserWindowConfig({});

      expect(result.show).toBe(false);
    });

    test('should enable offscreen rendering when configured', () => {
      headlessManager.enabled = true;
      headlessManager.presetConfig.offscreenRendering = true;

      const result = headlessManager.getBrowserWindowConfig({});

      expect(result.webPreferences.offscreen).toBe(true);
    });

    test('should disable background throttling', () => {
      headlessManager.enabled = true;

      const result = headlessManager.getBrowserWindowConfig({});

      expect(result.webPreferences.backgroundThrottling).toBe(false);
    });

    test('should preserve existing webPreferences', () => {
      headlessManager.enabled = true;

      const result = headlessManager.getBrowserWindowConfig({
        webPreferences: {
          nodeIntegration: true
        }
      });

      expect(result.webPreferences.nodeIntegration).toBe(true);
      expect(result.webPreferences.backgroundThrottling).toBe(false);
    });
  });

  describe('applyElectronFlags', () => {
    test('should not apply flags when not enabled', () => {
      headlessManager.applyElectronFlags();

      expect(mockApp.commandLine.appendSwitch).not.toHaveBeenCalled();
    });

    test('should apply GPU flags when configured', () => {
      headlessManager.enabled = true;
      headlessManager.presetConfig.disableGpu = true;

      headlessManager.applyElectronFlags();

      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('disable-gpu');
      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('disable-gpu-compositing');
    });

    test('should apply sandbox flags when configured', () => {
      headlessManager.enabled = true;
      headlessManager.cliOptions.noSandbox = true;

      headlessManager.applyElectronFlags();

      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('no-sandbox');
      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('disable-setuid-sandbox');
    });

    test('should apply memory optimization flags when configured', () => {
      headlessManager.enabled = true;
      headlessManager.presetConfig.reduceMemory = true;

      headlessManager.applyElectronFlags();

      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('js-flags', '--max-old-space-size=512');
      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('disable-background-networking');
    });

    test('should always apply disable-dev-shm-usage', () => {
      headlessManager.enabled = true;

      headlessManager.applyElectronFlags();

      expect(mockApp.commandLine.appendSwitch).toHaveBeenCalledWith('disable-dev-shm-usage');
    });
  });

  describe('enableOffscreenRendering', () => {
    test('should fail without webContents', () => {
      const result = headlessManager.enableOffscreenRendering(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('WebContents not provided');
    });

    test('should enable offscreen rendering', () => {
      const mockWebContents = {
        setFrameRate: jest.fn(),
        on: jest.fn()
      };

      const result = headlessManager.enableOffscreenRendering(mockWebContents);

      expect(result.success).toBe(true);
      expect(mockWebContents.setFrameRate).toHaveBeenCalled();
      expect(mockWebContents.on).toHaveBeenCalledWith('paint', expect.any(Function));
      expect(headlessManager.offscreenRenderingEnabled).toBe(true);
    });

    test('should use configured frame rate', () => {
      headlessManager.presetConfig.frameRate = 60;
      const mockWebContents = {
        setFrameRate: jest.fn(),
        on: jest.fn()
      };

      headlessManager.enableOffscreenRendering(mockWebContents);

      expect(mockWebContents.setFrameRate).toHaveBeenCalledWith(60);
    });
  });

  describe('disableOffscreenRendering', () => {
    test('should fail without webContents', () => {
      const result = headlessManager.disableOffscreenRendering(null);

      expect(result.success).toBe(false);
    });

    test('should disable offscreen rendering', () => {
      const mockWebContents = {
        removeAllListeners: jest.fn()
      };

      const result = headlessManager.disableOffscreenRendering(mockWebContents);

      expect(result.success).toBe(true);
      expect(mockWebContents.removeAllListeners).toHaveBeenCalledWith('paint');
      expect(headlessManager.offscreenRenderingEnabled).toBe(false);
    });
  });

  describe('setFrameRate', () => {
    test('should fail without webContents', () => {
      const result = headlessManager.setFrameRate(30, null);

      expect(result.success).toBe(false);
    });

    test('should reject invalid frame rates', () => {
      const mockWebContents = { setFrameRate: jest.fn() };

      expect(headlessManager.setFrameRate(0, mockWebContents).success).toBe(false);
      expect(headlessManager.setFrameRate(121, mockWebContents).success).toBe(false);
    });

    test('should set valid frame rate', () => {
      const mockWebContents = { setFrameRate: jest.fn() };

      const result = headlessManager.setFrameRate(60, mockWebContents);

      expect(result.success).toBe(true);
      expect(result.frameRate).toBe(60);
      expect(mockWebContents.setFrameRate).toHaveBeenCalledWith(60);
    });
  });

  describe('initialize', () => {
    test('should return not enabled when headless not requested', async () => {
      process.argv = ['node', 'app.js'];

      const result = await headlessManager.initialize();

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
    });

    test('should enable headless mode when --headless flag present', async () => {
      process.argv = ['node', 'app.js', '--headless'];
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      const result = await headlessManager.initialize();

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(headlessManager.enabled).toBe(true);
    });

    test('should enable headless mode when forceHeadless option is true', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      const result = await headlessManager.initialize({ forceHeadless: true });

      expect(result.enabled).toBe(true);
    });

    test('should apply preset when specified', async () => {
      process.argv = ['node', 'app.js', '--headless'];
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      const result = await headlessManager.initialize({ preset: 'minimal' });

      expect(result.preset).toBe('minimal');
      expect(headlessManager.preset).toBe('minimal');
    });
  });

  describe('getStatus', () => {
    test('should return current status', () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      const status = headlessManager.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('preset');
      expect(status).toHaveProperty('presetConfig');
      expect(status).toHaveProperty('cliOptions');
      expect(status).toHaveProperty('display');
      expect(status).toHaveProperty('environment');
      expect(status).toHaveProperty('rendering');
    });

    test('should include display information', () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      const status = headlessManager.getStatus();

      expect(status.display).toHaveProperty('hasDisplay');
      expect(status.display).toHaveProperty('displayVariable');
      expect(status.display).toHaveProperty('virtualDisplay');
      expect(status.display).toHaveProperty('xvfbRunning');
    });
  });

  describe('getRenderStats', () => {
    test('should return render statistics', () => {
      const stats = headlessManager.getRenderStats();

      expect(stats).toHaveProperty('framesRendered');
      expect(stats).toHaveProperty('lastFrameTime');
      expect(stats).toHaveProperty('averageFrameTime');
      expect(stats).toHaveProperty('averageFps');
      expect(stats).toHaveProperty('offscreenEnabled');
    });

    test('should calculate FPS from average frame time', () => {
      headlessManager.renderStats.averageFrameTime = 16.67; // ~60fps

      const stats = headlessManager.getRenderStats();

      expect(stats.averageFps).toBeCloseTo(60, 0);
    });
  });

  describe('resetRenderStats', () => {
    test('should reset all render statistics', () => {
      headlessManager.renderStats.framesRendered = 100;
      headlessManager.renderStats.lastFrameTime = Date.now();
      headlessManager.renderStats.averageFrameTime = 16;
      headlessManager.renderStats.frameTimeHistory = [16, 17, 15];

      const result = headlessManager.resetRenderStats();

      expect(result.success).toBe(true);
      expect(headlessManager.renderStats.framesRendered).toBe(0);
      expect(headlessManager.renderStats.lastFrameTime).toBe(0);
      expect(headlessManager.renderStats.averageFrameTime).toBe(0);
      expect(headlessManager.renderStats.frameTimeHistory).toEqual([]);
    });
  });

  describe('applyPreset', () => {
    test('should fail for unknown preset', () => {
      const result = headlessManager.applyPreset('unknown');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown preset');
    });

    test('should apply valid preset', () => {
      const result = headlessManager.applyPreset('minimal');

      expect(result.success).toBe(true);
      expect(result.preset).toBe('minimal');
      expect(headlessManager.preset).toBe('minimal');
      expect(headlessManager.presetConfig).toEqual(HEADLESS_PRESETS.minimal);
    });
  });

  describe('getPresets', () => {
    test('should return available presets', () => {
      const result = headlessManager.getPresets();

      expect(result.success).toBe(true);
      expect(result.currentPreset).toBeDefined();
      expect(result.presets).toBeInstanceOf(Array);
      expect(result.presets.length).toBe(3);
    });

    test('should include preset details', () => {
      const result = headlessManager.getPresets();

      const minimalPreset = result.presets.find(p => p.name === 'minimal');
      expect(minimalPreset).toBeDefined();
      expect(minimalPreset.description).toBeDefined();
      expect(minimalPreset.disableGpu).toBe(true);
    });
  });

  describe('cleanup', () => {
    test('should stop virtual display if running', () => {
      headlessManager.setPlatform('linux');
      execSync.mockImplementation((cmd) => {
        if (cmd === 'which Xvfb') return '/usr/bin/Xvfb';
        if (cmd.includes('pgrep')) return '12345 Xvfb :99';
        return '';
      });

      headlessManager.startVirtualDisplay();
      headlessManager.cleanup();

      expect(headlessManager.xvfbRunning).toBe(false);

      headlessManager.setPlatform(null);
    });

    test('should set initialized to false', () => {
      headlessManager.initialized = true;

      headlessManager.cleanup();

      expect(headlessManager.initialized).toBe(false);
    });
  });

  describe('Paint event handling', () => {
    test('should track frame statistics on paint', () => {
      const mockWebContents = {
        setFrameRate: jest.fn(),
        on: jest.fn()
      };

      headlessManager.enableOffscreenRendering(mockWebContents);

      // Get the paint handler
      const paintHandler = mockWebContents.on.mock.calls.find(
        call => call[0] === 'paint'
      )[1];

      // Simulate paint events
      headlessManager.renderStats.lastFrameTime = Date.now() - 16;
      paintHandler({}, { x: 0, y: 0, width: 100, height: 100 }, {});

      expect(headlessManager.renderStats.framesRendered).toBe(1);
    });

    test('should emit paint event', () => {
      const mockWebContents = {
        setFrameRate: jest.fn(),
        on: jest.fn()
      };

      const paintSpy = jest.fn();
      headlessManager.on('paint', paintSpy);

      headlessManager.enableOffscreenRendering(mockWebContents);

      const paintHandler = mockWebContents.on.mock.calls.find(
        call => call[0] === 'paint'
      )[1];

      paintHandler({}, { x: 0, y: 0 }, { buffer: 'test' });

      expect(paintSpy).toHaveBeenCalled();
    });
  });
});
