/**
 * Basset Hound Browser - Headless Manager
 * Manages headless mode operation, virtual framebuffer detection,
 * offscreen rendering, and headless-specific optimizations.
 */

const { EventEmitter } = require('events');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

/**
 * Headless mode configuration presets
 */
const HEADLESS_PRESETS = {
  minimal: {
    name: 'Minimal',
    description: 'Minimal resource usage for simple automation',
    disableGpu: true,
    disableAcceleration: true,
    reduceMemory: true,
    offscreenRendering: true,
    frameRate: 1
  },
  standard: {
    name: 'Standard',
    description: 'Balanced mode for most headless tasks',
    disableGpu: true,
    disableAcceleration: false,
    reduceMemory: false,
    offscreenRendering: true,
    frameRate: 30
  },
  performance: {
    name: 'Performance',
    description: 'Higher resource usage for complex pages',
    disableGpu: false,
    disableAcceleration: false,
    reduceMemory: false,
    offscreenRendering: true,
    frameRate: 60
  }
};

/**
 * Default Electron flags for headless operation
 */
const HEADLESS_FLAGS = {
  // GPU related
  'disable-gpu': 'Disable GPU hardware acceleration',
  'disable-gpu-compositing': 'Disable GPU compositing',
  'disable-software-rasterizer': 'Disable software rasterizer',

  // Sandbox related
  'no-sandbox': 'Disable sandbox (needed for Docker/root)',
  'disable-setuid-sandbox': 'Disable setuid sandbox',

  // Display related
  'disable-dev-shm-usage': 'Disable /dev/shm usage (Docker)',
  'disable-extensions': 'Disable extensions for headless',

  // Memory optimization
  'js-flags': '--max-old-space-size=512',
  'disable-background-networking': 'Disable background network requests',

  // Rendering
  'enable-features': 'NetworkService,NetworkServiceInProcess'
};

/**
 * HeadlessManager class
 * Detects and manages headless operation mode
 */
class HeadlessManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.enabled = false;
    this.initialized = false;
    this.preset = options.preset || 'standard';
    this.presetConfig = HEADLESS_PRESETS[this.preset] || HEADLESS_PRESETS.standard;

    // State
    this.displayDetected = true;
    this.virtualDisplay = null;
    this.virtualDisplayProcess = null;
    this.offscreenRenderingEnabled = false;
    this.xvfbRunning = false;

    // Command line options (parsed from process.argv)
    this.cliOptions = {
      headless: false,
      disableGpu: false,
      noSandbox: false,
      virtualDisplay: false
    };

    // Rendering statistics
    this.renderStats = {
      framesRendered: 0,
      lastFrameTime: 0,
      averageFrameTime: 0,
      frameTimeHistory: [],
      maxHistoryLength: 100
    };

    // BrowserWindow reference (set later)
    this.mainWindow = null;

    // WebSocket server reference for broadcasting
    this.wsServer = null;

    console.log('[HeadlessManager] Initialized');
  }

  /**
   * Set WebSocket server reference for broadcasting
   * @param {WebSocketServer} server - WebSocket server instance
   */
  setWebSocketServer(server) {
    this.wsServer = server;
    console.log('[HeadlessManager] WebSocket server attached');
  }

  /**
   * Set main window reference
   * @param {BrowserWindow} window - Main browser window instance
   */
  setMainWindow(window) {
    this.mainWindow = window;
    console.log('[HeadlessManager] Main window attached');
  }

  /**
   * Parse command-line arguments for headless options
   * @returns {Object} Parsed CLI options
   */
  parseCommandLineArgs() {
    const args = process.argv;

    this.cliOptions = {
      headless: args.includes('--headless'),
      disableGpu: args.includes('--disable-gpu'),
      noSandbox: args.includes('--no-sandbox'),
      virtualDisplay: args.includes('--virtual-display')
    };

    console.log('[HeadlessManager] CLI options parsed:', this.cliOptions);
    return this.cliOptions;
  }

  /**
   * Detect if running in a headless environment (no display)
   * @returns {Object} Detection result with details
   */
  detectHeadlessEnvironment() {
    const result = {
      hasDisplay: true,
      displayVariable: process.env.DISPLAY || null,
      xvfbDetected: false,
      dockerEnvironment: false,
      ciEnvironment: false,
      wslEnvironment: false,
      platform: process.platform
    };

    // Check for Docker environment
    result.dockerEnvironment = fs.existsSync('/.dockerenv') ||
      fs.existsSync('/proc/1/cgroup') &&
      fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');

    // Check for CI environment
    result.ciEnvironment = !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL ||
      process.env.TRAVIS
    );

    // Check for WSL environment
    result.wslEnvironment = process.platform === 'linux' &&
      fs.existsSync('/proc/version') &&
      fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

    // Check for display on Linux
    if (process.platform === 'linux') {
      // No DISPLAY variable set
      if (!process.env.DISPLAY) {
        result.hasDisplay = false;
      } else {
        // Check if Xvfb is running
        result.xvfbDetected = this.checkXvfbRunning();

        // Check if DISPLAY is accessible
        try {
          execSync('xdpyinfo -display ' + process.env.DISPLAY + ' >/dev/null 2>&1');
          result.hasDisplay = true;
        } catch (error) {
          // Display not accessible
          result.hasDisplay = result.xvfbDetected;
        }
      }
    }

    this.displayDetected = result.hasDisplay;
    console.log('[HeadlessManager] Environment detection:', result);

    return result;
  }

  /**
   * Check if Xvfb (virtual framebuffer) is running
   * @returns {boolean} True if Xvfb is detected
   */
  checkXvfbRunning() {
    if (process.platform !== 'linux') {
      return false;
    }

    try {
      // Check for Xvfb process
      const output = execSync('pgrep -a Xvfb 2>/dev/null || true', { encoding: 'utf8' });
      return output.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start Xvfb virtual display
   * @param {Object} options - Xvfb options
   * @returns {Object} Start result
   */
  startVirtualDisplay(options = {}) {
    if (process.platform !== 'linux') {
      return {
        success: false,
        error: 'Virtual display (Xvfb) is only supported on Linux'
      };
    }

    const displayNum = options.displayNum || 99;
    const resolution = options.resolution || '1920x1080x24';
    const screen = options.screen || 0;

    const display = `:${displayNum}`;

    try {
      // Check if Xvfb is installed
      execSync('which Xvfb', { encoding: 'utf8' });
    } catch (error) {
      return {
        success: false,
        error: 'Xvfb is not installed. Install with: apt-get install xvfb'
      };
    }

    try {
      // Kill any existing Xvfb on this display
      try {
        execSync(`pkill -9 -f "Xvfb ${display}" 2>/dev/null || true`);
      } catch (e) {
        // Ignore errors
      }

      // Start Xvfb
      const args = [display, '-screen', String(screen), resolution];
      this.virtualDisplayProcess = spawn('Xvfb', args, {
        detached: true,
        stdio: 'ignore'
      });

      this.virtualDisplayProcess.unref();

      // Wait briefly and check if it started
      execSync('sleep 0.5');

      // Verify it's running
      const running = this.checkXvfbRunning();

      if (running) {
        this.virtualDisplay = display;
        this.xvfbRunning = true;
        process.env.DISPLAY = display;

        console.log(`[HeadlessManager] Xvfb started on display ${display} with resolution ${resolution}`);

        return {
          success: true,
          display,
          resolution,
          pid: this.virtualDisplayProcess.pid
        };
      } else {
        return {
          success: false,
          error: 'Xvfb failed to start'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to start Xvfb: ${error.message}`
      };
    }
  }

  /**
   * Stop virtual display
   * @returns {Object} Stop result
   */
  stopVirtualDisplay() {
    if (!this.xvfbRunning) {
      return { success: false, error: 'Virtual display not running' };
    }

    try {
      if (this.virtualDisplayProcess) {
        this.virtualDisplayProcess.kill();
        this.virtualDisplayProcess = null;
      }

      // Also try to kill by display
      if (this.virtualDisplay) {
        try {
          execSync(`pkill -9 -f "Xvfb ${this.virtualDisplay}" 2>/dev/null || true`);
        } catch (e) {
          // Ignore
        }
      }

      this.virtualDisplay = null;
      this.xvfbRunning = false;

      console.log('[HeadlessManager] Virtual display stopped');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop virtual display: ${error.message}`
      };
    }
  }

  /**
   * Get BrowserWindow configuration for headless mode
   * @param {Object} baseConfig - Base window configuration
   * @returns {Object} Modified configuration for headless mode
   */
  getBrowserWindowConfig(baseConfig = {}) {
    const config = { ...baseConfig };

    if (!this.enabled) {
      return config;
    }

    // Hide window in headless mode
    config.show = false;

    // Enable offscreen rendering if configured
    if (this.presetConfig.offscreenRendering) {
      config.webPreferences = config.webPreferences || {};
      config.webPreferences.offscreen = true;
    }

    // Disable background throttling
    config.webPreferences = config.webPreferences || {};
    config.webPreferences.backgroundThrottling = false;

    console.log('[HeadlessManager] BrowserWindow config modified for headless mode');

    return config;
  }

  /**
   * Apply Electron command line switches for headless operation
   */
  applyElectronFlags() {
    if (!this.enabled) {
      return;
    }

    // Always disable GPU in headless mode
    if (this.presetConfig.disableGpu || this.cliOptions.disableGpu) {
      app.commandLine.appendSwitch('disable-gpu');
      app.commandLine.appendSwitch('disable-gpu-compositing');
      app.commandLine.appendSwitch('disable-software-rasterizer');
    }

    // Sandbox settings
    if (this.cliOptions.noSandbox) {
      app.commandLine.appendSwitch('no-sandbox');
      app.commandLine.appendSwitch('disable-setuid-sandbox');
    }

    // Memory optimization
    if (this.presetConfig.reduceMemory) {
      app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
      app.commandLine.appendSwitch('disable-background-networking');
    }

    // Dev/shm usage (important for Docker)
    app.commandLine.appendSwitch('disable-dev-shm-usage');

    // Single process mode for reduced memory
    if (this.presetConfig.reduceMemory) {
      app.commandLine.appendSwitch('single-process');
    }

    console.log('[HeadlessManager] Electron flags applied');
  }

  /**
   * Enable offscreen rendering for a webContents
   * @param {WebContents} webContents - The webContents to configure
   * @returns {Object} Result
   */
  enableOffscreenRendering(webContents) {
    if (!webContents) {
      return { success: false, error: 'WebContents not provided' };
    }

    try {
      // Set the frame rate for offscreen rendering
      webContents.setFrameRate(this.presetConfig.frameRate || 30);

      // Handle paint events for offscreen rendering
      webContents.on('paint', (event, dirty, image) => {
        this.onOffscreenPaint(dirty, image);
      });

      this.offscreenRenderingEnabled = true;

      console.log(`[HeadlessManager] Offscreen rendering enabled at ${this.presetConfig.frameRate} fps`);

      return {
        success: true,
        frameRate: this.presetConfig.frameRate
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to enable offscreen rendering: ${error.message}`
      };
    }
  }

  /**
   * Disable offscreen rendering
   * @param {WebContents} webContents - The webContents to configure
   * @returns {Object} Result
   */
  disableOffscreenRendering(webContents) {
    if (!webContents) {
      return { success: false, error: 'WebContents not provided' };
    }

    try {
      webContents.removeAllListeners('paint');
      this.offscreenRenderingEnabled = false;

      console.log('[HeadlessManager] Offscreen rendering disabled');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to disable offscreen rendering: ${error.message}`
      };
    }
  }

  /**
   * Handle offscreen paint event
   * @param {Object} dirty - Dirty rectangle
   * @param {NativeImage} image - Rendered image
   * @private
   */
  onOffscreenPaint(dirty, image) {
    const now = Date.now();
    const frameTime = this.renderStats.lastFrameTime > 0 ?
      now - this.renderStats.lastFrameTime : 0;

    this.renderStats.framesRendered++;
    this.renderStats.lastFrameTime = now;

    // Track frame time history for averaging
    if (frameTime > 0) {
      this.renderStats.frameTimeHistory.push(frameTime);
      if (this.renderStats.frameTimeHistory.length > this.renderStats.maxHistoryLength) {
        this.renderStats.frameTimeHistory.shift();
      }

      // Calculate average
      const sum = this.renderStats.frameTimeHistory.reduce((a, b) => a + b, 0);
      this.renderStats.averageFrameTime = sum / this.renderStats.frameTimeHistory.length;
    }

    // Emit paint event for external handling
    this.emit('paint', {
      dirty,
      image,
      frameTime,
      frameNumber: this.renderStats.framesRendered
    });
  }

  /**
   * Set offscreen rendering frame rate
   * @param {number} frameRate - Desired frame rate
   * @param {WebContents} webContents - The webContents to configure
   * @returns {Object} Result
   */
  setFrameRate(frameRate, webContents) {
    if (!webContents) {
      return { success: false, error: 'WebContents not provided' };
    }

    if (frameRate < 1 || frameRate > 120) {
      return { success: false, error: 'Frame rate must be between 1 and 120' };
    }

    try {
      webContents.setFrameRate(frameRate);
      this.presetConfig.frameRate = frameRate;

      console.log(`[HeadlessManager] Frame rate set to ${frameRate}`);

      return { success: true, frameRate };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set frame rate: ${error.message}`
      };
    }
  }

  /**
   * Initialize headless mode
   * @param {Object} options - Initialization options
   * @returns {Object} Initialization result
   */
  async initialize(options = {}) {
    // Parse command line args
    this.parseCommandLineArgs();

    // Check if headless mode requested
    if (!this.cliOptions.headless && !options.forceHeadless) {
      console.log('[HeadlessManager] Headless mode not requested');
      return { success: true, enabled: false };
    }

    // Detect environment
    const envDetection = this.detectHeadlessEnvironment();

    // Set preset if provided
    if (options.preset && HEADLESS_PRESETS[options.preset]) {
      this.preset = options.preset;
      this.presetConfig = HEADLESS_PRESETS[options.preset];
    }

    // Enable headless mode
    this.enabled = true;

    // Start virtual display if needed and requested
    if (this.cliOptions.virtualDisplay || options.virtualDisplay) {
      if (!envDetection.hasDisplay) {
        const vdResult = this.startVirtualDisplay(options.displayOptions);
        if (!vdResult.success) {
          console.warn('[HeadlessManager] Failed to start virtual display:', vdResult.error);
        }
      }
    }

    // Apply Electron flags
    this.applyElectronFlags();

    this.initialized = true;

    console.log('[HeadlessManager] Headless mode initialized');

    return {
      success: true,
      enabled: true,
      preset: this.preset,
      presetConfig: this.presetConfig,
      environment: envDetection,
      virtualDisplay: this.virtualDisplay
    };
  }

  /**
   * Get current headless status
   * @returns {Object} Status information
   */
  getStatus() {
    const envDetection = this.detectHeadlessEnvironment();

    return {
      enabled: this.enabled,
      initialized: this.initialized,
      preset: this.preset,
      presetConfig: this.presetConfig,
      cliOptions: this.cliOptions,
      display: {
        hasDisplay: this.displayDetected,
        displayVariable: process.env.DISPLAY || null,
        virtualDisplay: this.virtualDisplay,
        xvfbRunning: this.xvfbRunning
      },
      environment: {
        platform: process.platform,
        dockerEnvironment: envDetection.dockerEnvironment,
        ciEnvironment: envDetection.ciEnvironment,
        wslEnvironment: envDetection.wslEnvironment
      },
      rendering: {
        offscreenEnabled: this.offscreenRenderingEnabled,
        frameRate: this.presetConfig.frameRate
      }
    };
  }

  /**
   * Get rendering statistics
   * @returns {Object} Render statistics
   */
  getRenderStats() {
    return {
      framesRendered: this.renderStats.framesRendered,
      lastFrameTime: this.renderStats.lastFrameTime,
      averageFrameTime: Math.round(this.renderStats.averageFrameTime * 100) / 100,
      averageFps: this.renderStats.averageFrameTime > 0 ?
        Math.round(1000 / this.renderStats.averageFrameTime * 100) / 100 : 0,
      offscreenEnabled: this.offscreenRenderingEnabled
    };
  }

  /**
   * Reset rendering statistics
   * @returns {Object} Result
   */
  resetRenderStats() {
    this.renderStats = {
      framesRendered: 0,
      lastFrameTime: 0,
      averageFrameTime: 0,
      frameTimeHistory: [],
      maxHistoryLength: 100
    };

    console.log('[HeadlessManager] Render stats reset');

    return { success: true };
  }

  /**
   * Apply a preset configuration
   * @param {string} presetName - Name of the preset
   * @returns {Object} Result
   */
  applyPreset(presetName) {
    if (!HEADLESS_PRESETS[presetName]) {
      return {
        success: false,
        error: `Unknown preset. Available: ${Object.keys(HEADLESS_PRESETS).join(', ')}`
      };
    }

    this.preset = presetName;
    this.presetConfig = { ...HEADLESS_PRESETS[presetName] };

    console.log(`[HeadlessManager] Applied preset: ${presetName}`);

    return {
      success: true,
      preset: presetName,
      config: this.presetConfig
    };
  }

  /**
   * Get available presets
   * @returns {Object} Available presets
   */
  getPresets() {
    return {
      success: true,
      currentPreset: this.preset,
      presets: Object.entries(HEADLESS_PRESETS).map(([name, config]) => ({
        name,
        description: config.description,
        ...config
      }))
    };
  }

  /**
   * Cleanup and release resources
   */
  cleanup() {
    // Stop virtual display if running
    if (this.xvfbRunning) {
      this.stopVirtualDisplay();
    }

    // Clear event listeners
    this.removeAllListeners();

    this.initialized = false;

    console.log('[HeadlessManager] Cleanup complete');
  }
}

// Create singleton instance
const headlessManager = new HeadlessManager();

module.exports = {
  HeadlessManager,
  headlessManager,
  HEADLESS_PRESETS,
  HEADLESS_FLAGS
};
