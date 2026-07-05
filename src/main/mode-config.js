// ==========================================
// Mode Configuration (headless / GUI / Tor / viewport)
// ==========================================
//
// Extracted from src/main/main.js (Monolith-2 modularization, 2026-07-04).
//
// This module is IMPORT-SIDE-EFFECT-FREE: requiring it defines a factory and
// nothing else. The actual side effects (app.commandLine mutation for Tor /
// headless, virtual-display startup, random viewport selection) only happen when
// the returned functions are invoked by main.js at the SAME boot points as before.
//
// `createModeConfig({ app, appConfig, headlessManager, getRandomViewport })`
// returns the six mode helpers, each closed over the injected deps instead of
// module-scope globals. Behavior is identical to the original inline functions.

'use strict';

/**
 * Build the mode-configuration helpers.
 * @param {Object} deps
 * @param {Electron.App} deps.app - Electron app (for commandLine switches).
 * @param {Object} deps.appConfig - Resolved application configuration.
 * @param {Object} deps.headlessManager - Headless manager singleton.
 * @param {Function} deps.getRandomViewport - Random viewport generator (evasion/fingerprint).
 * @returns {{ getHeadlessOptions, getGuiOptions, configureHeadlessMode, getTorOptions, configureTorMode, getViewportConfig }}
 */
function createModeConfig({ app, appConfig, headlessManager, getRandomViewport }) {
  /**
   * Get headless options from configuration
   * Falls back to command-line arguments for backwards compatibility
   * @returns {Object} Headless options
   */
  function getHeadlessOptions() {
    const args = process.argv;
    // Config takes precedence, with CLI fallback for backwards compatibility
    return {
      headless: appConfig.headless?.enabled || args.includes('--headless'),
      disableGpu: appConfig.headless?.disableGpu || args.includes('--disable-gpu'),
      noSandbox: appConfig.headless?.noSandbox || args.includes('--no-sandbox'),
      virtualDisplay: appConfig.headless?.virtualDisplay || args.includes('--virtual-display'),
      preset: appConfig.headless?.preset || null
    };
  }

  /**
   * Get GUI (window-visibility) options.
   *
   * GUI mode is strictly OPT-IN: the browser stays headless/hidden by default and the
   * window is only shown when the operator explicitly asks for it (`--gui` CLI flag,
   * `gui.enabled` config, or `BASSET_GUI=1|true`) AND a real display is available. A
   * BrowserWindow cannot paint without an X/Xvfb display, so when GUI is requested on a
   * display-less host we fall back to headless (see createWindow()).
   *
   * This is decoupled from getHeadlessOptions(): headless controls runtime tuning
   * (GPU/sandbox/offscreen), GUI controls only window visibility.
   * @returns {{ enabled: boolean, hasDisplay: boolean, isGuiMode: boolean }}
   */
  function getGuiOptions() {
    const args = process.argv;
    const enabled = Boolean(
      appConfig.gui?.enabled ||
      args.includes('--gui') ||
      ['1', 'true'].includes(process.env.BASSET_GUI)
    );
    // A real window cannot paint without a display; detect X/Xvfb availability.
    let hasDisplay = false;
    try {
      hasDisplay = headlessManager.detectHeadlessEnvironment().hasDisplay;
    } catch (error) {
      console.warn('[GUI] Display detection failed, assuming no display:', error.message);
    }
    return { enabled, hasDisplay, isGuiMode: enabled && hasDisplay };
  }

  /**
   * Configure Electron app for headless operation
   * Must be called before app.whenReady()
   */
  function configureHeadlessMode() {
    const headlessOpts = getHeadlessOptions();

    if (!headlessOpts.headless) {
      console.log('[Headless] Headless mode not enabled');
      return false;
    }

    console.log('[Headless] Configuring headless mode...');

    // Apply preset if specified
    if (headlessOpts.preset) {
      headlessManager.applyPreset(headlessOpts.preset);
      console.log(`[Headless] Applied preset: ${headlessOpts.preset}`);
    }

    // Initialize headless manager
    headlessManager.parseCommandLineArgs();

    // Apply GPU flags
    if (headlessOpts.disableGpu) {
      app.commandLine.appendSwitch('disable-gpu');
      app.commandLine.appendSwitch('disable-gpu-compositing');
      app.commandLine.appendSwitch('disable-software-rasterizer');
      console.log('[Headless] GPU disabled');
    }

    // Apply sandbox flags (needed for Docker/root)
    if (headlessOpts.noSandbox) {
      app.commandLine.appendSwitch('no-sandbox');
      app.commandLine.appendSwitch('disable-setuid-sandbox');
      console.log('[Headless] Sandbox disabled');
    }

    // Apply common headless flags
    app.commandLine.appendSwitch('disable-dev-shm-usage');
    app.commandLine.appendSwitch('disable-background-networking');

    // Detect and configure virtual display
    if (headlessOpts.virtualDisplay) {
      const envDetection = headlessManager.detectHeadlessEnvironment();
      if (!envDetection.hasDisplay) {
        const result = headlessManager.startVirtualDisplay();
        if (result.success) {
          console.log(`[Headless] Virtual display started: ${result.display}`);
        } else {
          console.warn(`[Headless] Failed to start virtual display: ${result.error}`);
        }
      }
    }

    // Enable headless manager
    headlessManager.enabled = true;
    headlessManager.initialized = true;

    console.log('[Headless] Headless mode configured');
    return true;
  }

  /**
   * Get Tor options from configuration
   * @returns {Object} Tor options
   */
  function getTorOptions() {
    const args = process.argv;
    return {
      // Enable Tor mode via config, env var, or CLI flag
      enabled: appConfig.tor?.enabled ||
               process.env.TOR_MODE === '1' ||
               process.env.TOR_MODE === 'true' ||
               args.includes('--tor-mode'),
      // SOCKS proxy host/port (defaults to standard Tor)
      socksHost: appConfig.tor?.socksHost || process.env.TOR_SOCKS_HOST || '127.0.0.1',
      socksPort: parseInt(appConfig.tor?.socksPort || process.env.TOR_SOCKS_PORT || '9050', 10),
      // Disable DNS prefetching to prevent leaks
      disableDnsPrefetch: appConfig.tor?.disableDnsPrefetch !== false
    };
  }

  /**
   * Configure Electron app for Tor routing
   * Must be called before app.whenReady()
   *
   * This sets command-line flags that prevent DNS leaks and ensure
   * all traffic (including DNS resolution) goes through the Tor SOCKS proxy.
   * This is critical for .onion domain support.
   */
  function configureTorMode() {
    const torOpts = getTorOptions();

    if (!torOpts.enabled) {
      console.log('[Tor] Tor mode not enabled (use --tor-mode, TOR_MODE=1, or config.tor.enabled)');
      return false;
    }

    console.log('[Tor] Configuring Tor mode...');

    const proxyUrl = `socks5://${torOpts.socksHost}:${torOpts.socksPort}`;

    // Set proxy server - this routes all traffic through Tor SOCKS proxy
    app.commandLine.appendSwitch('proxy-server', proxyUrl);
    console.log(`[Tor] Proxy server set: ${proxyUrl}`);

    // Prevent local DNS resolution - critical for .onion domains
    // The EXCLUDE clause allows resolving the proxy server itself
    app.commandLine.appendSwitch('host-resolver-rules', `MAP * ~NOTFOUND , EXCLUDE ${torOpts.socksHost}`);
    console.log('[Tor] Host resolver rules set (DNS via proxy)');

    // Disable DNS prefetching to prevent DNS leaks
    if (torOpts.disableDnsPrefetch) {
      app.commandLine.appendSwitch('dns-prefetch-disable');
      console.log('[Tor] DNS prefetching disabled');
    }

    console.log('[Tor] Tor mode configured - all traffic will route through Tor');
    return true;
  }

  // Get viewport configuration from config or use random
  function getViewportConfig() {
    const browserConfig = appConfig.browser?.window || {};

    // Use config values if randomization is disabled, otherwise use random viewport
    if (!browserConfig.randomizeSize) {
      return {
        width: browserConfig.width || 1280,
        height: browserConfig.height || 720
      };
    }

    // Use random viewport for fingerprint evasion
    return getRandomViewport();
  }

  return {
    getHeadlessOptions,
    getGuiOptions,
    configureHeadlessMode,
    getTorOptions,
    configureTorMode,
    getViewportConfig
  };
}

module.exports = { createModeConfig };
