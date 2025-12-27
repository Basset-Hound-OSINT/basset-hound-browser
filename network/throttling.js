/**
 * Network Throttler for Basset Hound Browser
 * Simulates various network conditions using Chrome DevTools Protocol
 *
 * Uses Electron's debugger API to apply network emulation via CDP
 */

// Network condition presets (speeds in bytes per second)
const NETWORK_PRESETS = {
  // Offline - no connection
  offline: {
    name: 'Offline',
    downloadSpeed: 0,
    uploadSpeed: 0,
    latency: 0,
    offline: true
  },
  // GPRS - 50 Kbps down, 20 Kbps up, 500ms latency
  gprs: {
    name: 'GPRS',
    downloadSpeed: 50 * 1024 / 8,    // 50 Kbps = 6.25 KB/s = 6400 bytes/s
    uploadSpeed: 20 * 1024 / 8,      // 20 Kbps = 2.5 KB/s = 2560 bytes/s
    latency: 500,
    offline: false
  },
  // EDGE - 250 Kbps down, 50 Kbps up, 300ms latency
  edge: {
    name: 'Regular 2G / EDGE',
    downloadSpeed: 250 * 1024 / 8,   // 250 Kbps = 31.25 KB/s = 32000 bytes/s
    uploadSpeed: 50 * 1024 / 8,      // 50 Kbps = 6.25 KB/s = 6400 bytes/s
    latency: 300,
    offline: false
  },
  // Regular 3G - 750 Kbps down, 250 Kbps up, 100ms latency
  '3g': {
    name: 'Regular 3G',
    downloadSpeed: 750 * 1024 / 8,   // 750 Kbps = 93.75 KB/s = 96000 bytes/s
    uploadSpeed: 250 * 1024 / 8,     // 250 Kbps = 31.25 KB/s = 32000 bytes/s
    latency: 100,
    offline: false
  },
  // Fast 3G - 1.5 Mbps down, 750 Kbps up, 40ms latency
  '3g-fast': {
    name: 'Fast 3G',
    downloadSpeed: 1.5 * 1024 * 1024 / 8,  // 1.5 Mbps = 192 KB/s = 196608 bytes/s
    uploadSpeed: 750 * 1024 / 8,           // 750 Kbps = 93.75 KB/s = 96000 bytes/s
    latency: 40,
    offline: false
  },
  // 4G/LTE - 4 Mbps down, 3 Mbps up, 20ms latency
  '4g': {
    name: '4G / LTE',
    downloadSpeed: 4 * 1024 * 1024 / 8,   // 4 Mbps = 512 KB/s = 524288 bytes/s
    uploadSpeed: 3 * 1024 * 1024 / 8,     // 3 Mbps = 384 KB/s = 393216 bytes/s
    latency: 20,
    offline: false
  },
  // DSL - 2 Mbps down, 1 Mbps up, 5ms latency
  dsl: {
    name: 'DSL',
    downloadSpeed: 2 * 1024 * 1024 / 8,   // 2 Mbps = 256 KB/s = 262144 bytes/s
    uploadSpeed: 1 * 1024 * 1024 / 8,     // 1 Mbps = 128 KB/s = 131072 bytes/s
    latency: 5,
    offline: false
  },
  // WiFi - 30 Mbps down, 15 Mbps up, 2ms latency
  wifi: {
    name: 'WiFi',
    downloadSpeed: 30 * 1024 * 1024 / 8,  // 30 Mbps = 3.84 MB/s = 3932160 bytes/s
    uploadSpeed: 15 * 1024 * 1024 / 8,    // 15 Mbps = 1.92 MB/s = 1966080 bytes/s
    latency: 2,
    offline: false
  }
};

/**
 * NetworkThrottler class
 * Manages network throttling using Chrome DevTools Protocol via Electron's debugger API
 */
class NetworkThrottler {
  constructor() {
    this.downloadSpeed = -1;  // -1 means no throttling (unlimited)
    this.uploadSpeed = -1;
    this.latency = 0;
    this.enabled = false;
    this.offline = false;
    this.activePreset = null;
    this.webContents = null;
    this.debuggerAttached = false;
  }

  /**
   * Initialize the throttler with a webContents instance
   * @param {Electron.WebContents} webContents - The webContents to throttle
   */
  initialize(webContents) {
    this.webContents = webContents;
    console.log('[NetworkThrottler] Initialized');
  }

  /**
   * Attach the debugger to the webContents
   * @returns {Promise<boolean>} - Whether the debugger was successfully attached
   */
  async attachDebugger() {
    if (!this.webContents) {
      console.error('[NetworkThrottler] No webContents available');
      return false;
    }

    if (this.debuggerAttached) {
      return true;
    }

    try {
      this.webContents.debugger.attach('1.3');
      this.debuggerAttached = true;
      console.log('[NetworkThrottler] Debugger attached');

      // Enable Network domain
      await this.webContents.debugger.sendCommand('Network.enable');
      console.log('[NetworkThrottler] Network domain enabled');

      // Handle debugger detach
      this.webContents.debugger.on('detach', (event, reason) => {
        console.log(`[NetworkThrottler] Debugger detached: ${reason}`);
        this.debuggerAttached = false;
      });

      return true;
    } catch (error) {
      console.error('[NetworkThrottler] Failed to attach debugger:', error.message);
      this.debuggerAttached = false;
      return false;
    }
  }

  /**
   * Detach the debugger from the webContents
   */
  detachDebugger() {
    if (this.webContents && this.debuggerAttached) {
      try {
        this.webContents.debugger.detach();
        this.debuggerAttached = false;
        console.log('[NetworkThrottler] Debugger detached');
      } catch (error) {
        console.error('[NetworkThrottler] Failed to detach debugger:', error.message);
      }
    }
  }

  /**
   * Apply network conditions using CDP Network.emulateNetworkConditions
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async applyThrottling() {
    if (!this.enabled) {
      return { success: true, message: 'Throttling is disabled' };
    }

    if (!await this.attachDebugger()) {
      return { success: false, error: 'Failed to attach debugger' };
    }

    try {
      // CDP Network.emulateNetworkConditions parameters:
      // - offline: boolean
      // - latency: number (in milliseconds)
      // - downloadThroughput: number (bytes per second, -1 for unlimited)
      // - uploadThroughput: number (bytes per second, -1 for unlimited)
      // - connectionType: optional string (e.g., 'cellular2g', 'cellular3g', 'cellular4g', 'bluetooth', 'ethernet', 'wifi', 'wimax', 'other')

      await this.webContents.debugger.sendCommand('Network.emulateNetworkConditions', {
        offline: this.offline,
        latency: this.latency,
        downloadThroughput: this.downloadSpeed,
        uploadThroughput: this.uploadSpeed
      });

      console.log(`[NetworkThrottler] Applied throttling - Download: ${this.downloadSpeed} B/s, Upload: ${this.uploadSpeed} B/s, Latency: ${this.latency}ms, Offline: ${this.offline}`);
      return { success: true };
    } catch (error) {
      console.error('[NetworkThrottler] Failed to apply throttling:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear network throttling
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async clearThrottling() {
    if (!this.debuggerAttached) {
      return { success: true, message: 'Debugger not attached' };
    }

    try {
      // Reset to no throttling
      await this.webContents.debugger.sendCommand('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1
      });

      console.log('[NetworkThrottler] Cleared throttling');
      return { success: true };
    } catch (error) {
      console.error('[NetworkThrottler] Failed to clear throttling:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set custom throttling speeds
   * @param {number} download - Download speed in bytes/second (-1 for unlimited)
   * @param {number} upload - Upload speed in bytes/second (-1 for unlimited)
   * @param {number} latency - Latency in milliseconds
   * @returns {Promise<{success: boolean, downloadSpeed: number, uploadSpeed: number, latency: number, error?: string}>}
   */
  async setThrottling(download, upload, latency) {
    this.downloadSpeed = download !== undefined ? download : this.downloadSpeed;
    this.uploadSpeed = upload !== undefined ? upload : this.uploadSpeed;
    this.latency = latency !== undefined ? latency : this.latency;
    this.offline = this.downloadSpeed === 0 && this.uploadSpeed === 0;
    this.activePreset = null;

    if (this.enabled) {
      const result = await this.applyThrottling();
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          downloadSpeed: this.downloadSpeed,
          uploadSpeed: this.uploadSpeed,
          latency: this.latency
        };
      }
    }

    return {
      success: true,
      downloadSpeed: this.downloadSpeed,
      uploadSpeed: this.uploadSpeed,
      latency: this.latency
    };
  }

  /**
   * Set throttling using a preset profile
   * @param {string} presetName - Name of the preset to use
   * @returns {Promise<{success: boolean, preset: object, error?: string}>}
   */
  async setPreset(presetName) {
    const preset = NETWORK_PRESETS[presetName.toLowerCase()];

    if (!preset) {
      return {
        success: false,
        error: `Unknown preset: ${presetName}`,
        availablePresets: Object.keys(NETWORK_PRESETS)
      };
    }

    this.downloadSpeed = preset.downloadSpeed;
    this.uploadSpeed = preset.uploadSpeed;
    this.latency = preset.latency;
    this.offline = preset.offline;
    this.activePreset = presetName.toLowerCase();

    if (this.enabled) {
      const result = await this.applyThrottling();
      if (!result.success) {
        return { success: false, error: result.error, preset };
      }
    }

    return {
      success: true,
      preset: {
        name: presetName.toLowerCase(),
        displayName: preset.name,
        downloadSpeed: this.downloadSpeed,
        uploadSpeed: this.uploadSpeed,
        latency: this.latency,
        offline: this.offline
      }
    };
  }

  /**
   * Get available presets
   * @returns {{success: boolean, presets: object}}
   */
  getPresets() {
    const presets = {};

    for (const [key, value] of Object.entries(NETWORK_PRESETS)) {
      presets[key] = {
        name: value.name,
        downloadSpeed: value.downloadSpeed,
        downloadSpeedFormatted: this.formatSpeed(value.downloadSpeed),
        uploadSpeed: value.uploadSpeed,
        uploadSpeedFormatted: this.formatSpeed(value.uploadSpeed),
        latency: value.latency,
        offline: value.offline
      };
    }

    return {
      success: true,
      presets
    };
  }

  /**
   * Enable network throttling
   * @returns {Promise<{success: boolean, status: object, error?: string}>}
   */
  async enable() {
    this.enabled = true;
    const result = await this.applyThrottling();

    return {
      success: result.success,
      error: result.error,
      status: this.getStatus()
    };
  }

  /**
   * Disable network throttling
   * @returns {Promise<{success: boolean, status: object, error?: string}>}
   */
  async disable() {
    this.enabled = false;
    const result = await this.clearThrottling();

    return {
      success: result.success,
      error: result.error,
      status: this.getStatus()
    };
  }

  /**
   * Get current throttling status
   * @returns {object}
   */
  getStatus() {
    return {
      enabled: this.enabled,
      offline: this.offline,
      downloadSpeed: this.downloadSpeed,
      downloadSpeedFormatted: this.formatSpeed(this.downloadSpeed),
      uploadSpeed: this.uploadSpeed,
      uploadSpeedFormatted: this.formatSpeed(this.uploadSpeed),
      latency: this.latency,
      activePreset: this.activePreset,
      debuggerAttached: this.debuggerAttached
    };
  }

  /**
   * Format speed in human-readable format
   * @param {number} bytesPerSecond - Speed in bytes per second
   * @returns {string}
   */
  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === -1) {
      return 'Unlimited';
    }
    if (bytesPerSecond === 0) {
      return '0 B/s';
    }

    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let unitIndex = 0;
    let speed = bytesPerSecond;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Convert Kbps to bytes per second
   * @param {number} kbps - Speed in Kilobits per second
   * @returns {number} - Speed in bytes per second
   */
  static kbpsToBytes(kbps) {
    return (kbps * 1024) / 8;
  }

  /**
   * Convert Mbps to bytes per second
   * @param {number} mbps - Speed in Megabits per second
   * @returns {number} - Speed in bytes per second
   */
  static mbpsToBytes(mbps) {
    return (mbps * 1024 * 1024) / 8;
  }

  /**
   * Cleanup - detach debugger and reset state
   */
  cleanup() {
    this.detachDebugger();
    this.enabled = false;
    this.webContents = null;
    console.log('[NetworkThrottler] Cleaned up');
  }
}

// Create singleton instance
const networkThrottler = new NetworkThrottler();

module.exports = {
  NetworkThrottler,
  networkThrottler,
  NETWORK_PRESETS
};
