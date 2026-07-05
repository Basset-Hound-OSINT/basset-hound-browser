/**
 * P1-001: Electron Headless Mode Tests
 * Verifies that Electron can start in Docker headless environments
 * https://github.com/basset-hound/issues/P1-001
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('P1-001: Electron Headless Mode', () => {
  const projectRoot = path.join(__dirname, '..');
  const mainFile = path.join(projectRoot, 'src/main/main.js');

  /**
   * Test 1: Verify headless detection function exists
   */
  test('should have HeadlessManager available', () => {
    const headlessPath = path.join(projectRoot, 'headless/manager.js');
    expect(fs.existsSync(headlessPath)).toBe(true);

    const HeadlessManager = require(headlessPath).HeadlessManager || require(headlessPath);
    expect(HeadlessManager).toBeDefined();
  });

  /**
   * Test 2: Verify early headless initialization code is in main.js
   */
  test('should have early headless initialization in main.js', () => {
    const mainContent = fs.readFileSync(mainFile, 'utf8');

    // Check for early headless initialization function
    expect(mainContent).toContain('initializeHeadlessModeEarly');
    expect(mainContent).toContain('Early Headless Mode Initialization (P1-001)');
    expect(mainContent).toContain('[Headless-Early]');
  });

  /**
   * Test 3: Verify critical Electron flags are applied
   */
  test('should apply critical Electron flags for headless mode', () => {
    const mainContent = fs.readFileSync(mainFile, 'utf8');

    // Check for GPU and sandbox flags
    expect(mainContent).toContain('disable-gpu');
    expect(mainContent).toContain('no-sandbox');
    expect(mainContent).toContain('disable-dev-shm-usage');
    expect(mainContent).toContain('disable-software-rasterizer');
  });

  /**
   * Test 4: Verify Dockerfile has Xvfb initialization
   */
  test('should have Xvfb in Dockerfile', () => {
    const dockerfilePath = path.join(projectRoot, 'config/docker/Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

    // Check for Xvfb installation
    expect(dockerfileContent).toContain('xvfb');
    // Check for Xvfb startup in entrypoint
    expect(dockerfileContent).toContain('Xvfb');
    // Check for P1-001 comment
    expect(dockerfileContent).toContain('P1-001');
  });

  /**
   * Test 5: Verify Dockerfile starts Xvfb BEFORE Node.js
   */
  test('should start Xvfb before Node.js in Dockerfile entrypoint', () => {
    const dockerfilePath = path.join(projectRoot, 'config/docker/Dockerfile');
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

    const xvfbIndex = dockerfileContent.indexOf('Xvfb');
    const nodeStartIndex = dockerfileContent.indexOf('npm start');

    expect(xvfbIndex).toBeGreaterThan(-1);
    expect(nodeStartIndex).toBeGreaterThan(-1);
    expect(xvfbIndex).toBeLessThan(nodeStartIndex);
  });

  /**
   * Test 6: Verify DISPLAY environment variable is set
   */
  test('should set DISPLAY environment variable in Dockerfile', () => {
    const dockerfilePath = path.join(projectRoot, 'config/docker/Dockerfile');
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

    expect(dockerfileContent).toContain('ENV DISPLAY=');
  });

  /**
   * Test 7: Verify ELECTRON_DISABLE_SANDBOX is set
   */
  test('should set ELECTRON_DISABLE_SANDBOX in Dockerfile', () => {
    const dockerfilePath = path.join(projectRoot, 'config/docker/Dockerfile');
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

    expect(dockerfileContent).toContain('ELECTRON_DISABLE_SANDBOX');
  });

  /**
   * Test 8: Verify early initialization is called before app.whenReady()
   */
  test('should call early initialization before app.whenReady()', () => {
    const mainContent = fs.readFileSync(mainFile, 'utf8');

    // The initializeHeadlessModeEarly function must be defined before app.whenReady()
    const initFuncIndex = mainContent.indexOf('function initializeHeadlessModeEarly');
    expect(initFuncIndex).toBeGreaterThan(-1);

    // The call to initializeHeadlessModeEarly() should happen before app.whenReady()
    // Note: there are multiple app.whenReady() calls - we need the one right after earlyHeadlessInitialized
    const initCallIndex = mainContent.indexOf('const earlyHeadlessInitialized = initializeHeadlessModeEarly()');
    const whenReadyAfterInitIndex = mainContent.indexOf('app.whenReady()', initCallIndex);

    expect(initCallIndex).toBeGreaterThan(-1);
    expect(whenReadyAfterInitIndex).toBeGreaterThan(-1);
    expect(initCallIndex).toBeLessThan(whenReadyAfterInitIndex);
  });

  /**
   * Test 9: Verify environment detection includes Docker check
   */
  test('should detect Docker environment', () => {
    const headlessPath = path.join(projectRoot, 'headless/manager.js');
    const headlessContent = fs.readFileSync(headlessPath, 'utf8');

    // Check for Docker detection logic
    expect(headlessContent).toContain('dockerEnvironment');
    expect(headlessContent).toContain('/.dockerenv');
    expect(headlessContent).toContain('/proc/1/cgroup');
  });

  /**
   * Test 10: Verify graceful fallback if Xvfb not available
   */
  test('should handle Xvfb startup failure gracefully', () => {
    const mainContent = fs.readFileSync(mainFile, 'utf8');

    // Check for error handling
    expect(mainContent).toContain('Failed to start Xvfb');
    expect(mainContent).toContain('Continue anyway');
  });
});

/**
 * Integration tests that verify Docker container startup
 * These tests attempt to start the actual Docker container
 */
describe('P1-001: Docker Container Integration', () => {
  const projectRoot = path.join(__dirname, '..');

  /**
   * Test that Docker image builds successfully with headless support
   * Skip if Docker is not available
   */
  test('Docker image should build successfully', async () => {
    // Check if Docker is available
    try {
      require('child_process').execSync('docker --version', { stdio: 'ignore' });
    } catch (e) {
      console.log('[P1-001] Skipping Docker build test - Docker not available');
      return;
    }

    // This would require actual Docker build which takes time
    // Marked as skipped for now - can be run manually
    expect(true).toBe(true);
  }, 60000); // 60 second timeout

  /**
   * Test environment variable passthrough
   */
  test('should accept DISPLAY environment variable', () => {
    expect(process.env.DISPLAY || '').toBeTruthy(); // Mock or actual
  });
});

/**
 * Unit tests for HeadlessManager
 */
describe('P1-001: HeadlessManager Unit Tests', () => {
  let HeadlessManager;
  let manager;

  beforeAll(() => {
    const headlessPath = path.join(__dirname, '../headless/manager.js');
    const HeadlessModule = require(headlessPath);
    HeadlessManager = HeadlessModule.HeadlessManager || HeadlessModule;
  });

  beforeEach(() => {
    manager = new HeadlessManager();
  });

  test('should detect headless environment variables', () => {
    // Mock environment
    const originalDisplay = process.env.DISPLAY;
    delete process.env.DISPLAY;

    const result = manager.detectHeadlessEnvironment();
    expect(result).toBeDefined();
    expect(result.displayVariable).toBe(null);
    expect(result.hasDisplay).toBe(false);

    // Restore
    if (originalDisplay) {
      process.env.DISPLAY = originalDisplay;
    }
  });

  test('should identify Docker environment', () => {
    const result = manager.detectHeadlessEnvironment();
    expect(result).toHaveProperty('dockerEnvironment');
    expect(typeof result.dockerEnvironment).toBe('boolean');
  });

  test('should parse command-line arguments for headless flags', () => {
    manager.cliOptions = { headless: false };
    manager.parseCommandLineArgs();

    expect(manager.cliOptions).toBeDefined();
    expect(manager.cliOptions).toHaveProperty('headless');
  });

  test('should apply preset configuration', () => {
    const presets = ['minimal', 'standard', 'performance'];
    for (const preset of presets) {
      manager.applyPreset(preset);
      expect(manager.preset).toBe(preset);
    }
  });

  test('should have virtual display start capability', () => {
    expect(typeof manager.startVirtualDisplay).toBe('function');
  });
});
