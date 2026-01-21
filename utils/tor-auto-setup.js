/**
 * Basset Hound Browser - Tor Auto Setup Utility
 *
 * Provides automatic download and setup of embedded Tor on first run.
 * Integrates with AdvancedTorManager to check availability and trigger
 * downloads when needed.
 *
 * @module TorAutoSetup
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { execSync } = require('child_process');

// Import AdvancedTorManager to check embedded Tor availability
const { AdvancedTorManager, EMBEDDED_PATHS } = require('../proxy/tor-advanced');

// Configuration - matches embedded-tor-setup.js
const TOR_VERSION = '15.0.3';
const TOR_DAEMON_VERSION = '0.4.8.21';

const DOWNLOAD_URLS = {
  'linux-x64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-linux-x86_64-${TOR_VERSION}.tar.gz`,
  'darwin-x64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-macos-x86_64-${TOR_VERSION}.tar.gz`,
  'darwin-arm64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-macos-aarch64-${TOR_VERSION}.tar.gz`,
  'win32-x64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-x86_64-${TOR_VERSION}.tar.gz`,
  'win32-ia32': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-i686-${TOR_VERSION}.tar.gz`
};

/**
 * Setup states for progress tracking
 */
const SETUP_STATES = {
  IDLE: 'idle',
  CHECKING: 'checking',
  DOWNLOADING: 'downloading',
  EXTRACTING: 'extracting',
  CONFIGURING: 'configuring',
  VERIFYING: 'verifying',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * TorAutoSetup class
 * Handles automatic download and setup of embedded Tor
 */
class TorAutoSetup extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.projectRoot = options.projectRoot || path.resolve(__dirname, '..');
    this.torDir = options.torDir || path.join(this.projectRoot, 'bin', 'tor');
    this.tempDir = options.tempDir || path.join(this.projectRoot, 'tor_tmp');
    this.dataDir = options.dataDir || path.join(this.torDir, 'data_local');

    // State tracking
    this.state = SETUP_STATES.IDLE;
    this.progress = 0;
    this.progressMessage = '';
    this.error = null;

    // Download tracking
    this.downloadedBytes = 0;
    this.totalBytes = 0;

    // Manager instance for availability checks
    this._torManager = new AdvancedTorManager({ autoStart: false, killOnExit: false });
  }

  /**
   * Get platform key for downloads
   * @returns {string} Platform key (e.g., 'linux-x64')
   */
  getPlatformKey() {
    const platform = os.platform();
    const arch = os.arch();
    return `${platform}-${arch}`;
  }

  /**
   * Check if Tor is available (quick check)
   * @returns {boolean} True if embedded Tor is available
   */
  checkTorAvailability() {
    return this._torManager.isEmbeddedAvailable();
  }

  /**
   * Get detailed information about Tor availability
   * @returns {Object} Availability information
   */
  getAvailabilityInfo() {
    const info = this._torManager.getEmbeddedInfo();
    const platformKey = this.getPlatformKey();

    return {
      available: info.available,
      embeddedMode: info.embeddedMode,
      paths: info.paths,
      exists: info.exists,
      platformSupported: !!DOWNLOAD_URLS[platformKey],
      platform: platformKey,
      torVersion: TOR_VERSION,
      torDaemonVersion: TOR_DAEMON_VERSION
    };
  }

  /**
   * Update state and emit progress event
   * @param {string} state - New state
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Progress message
   * @private
   */
  _updateProgress(state, progress, message) {
    this.state = state;
    this.progress = progress;
    this.progressMessage = message;

    this.emit('progress', {
      state: this.state,
      progress: this.progress,
      message: this.progressMessage,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes
    });
  }

  /**
   * Download file with progress tracking
   * @param {string} url - URL to download
   * @param {string} destPath - Destination file path
   * @returns {Promise<string>} Path to downloaded file
   * @private
   */
  _downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      // Ensure directory exists
      const dir = path.dirname(destPath);
      fs.mkdirSync(dir, { recursive: true });

      const file = fs.createWriteStream(destPath);
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          try { fs.unlinkSync(destPath); } catch (e) {}
          return this._downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(destPath); } catch (e) {}
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }

        this.totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        this.downloadedBytes = 0;

        response.on('data', (chunk) => {
          this.downloadedBytes += chunk.length;

          if (this.totalBytes > 0) {
            const downloadProgress = Math.floor((this.downloadedBytes / this.totalBytes) * 100);
            // Download is 10-60% of total progress
            const overallProgress = 10 + Math.floor(downloadProgress * 0.5);
            this._updateProgress(
              SETUP_STATES.DOWNLOADING,
              overallProgress,
              `Downloading Tor bundle... ${downloadProgress}% (${this._formatBytes(this.downloadedBytes)} / ${this._formatBytes(this.totalBytes)})`
            );
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          this.emit('downloadComplete', {
            path: destPath,
            size: this.downloadedBytes
          });
          resolve(destPath);
        });

        file.on('error', (err) => {
          file.close();
          try { fs.unlinkSync(destPath); } catch (e) {}
          reject(err);
        });
      });

      request.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch (e) {}
        reject(err);
      });

      request.on('timeout', () => {
        request.destroy();
        file.close();
        try { fs.unlinkSync(destPath); } catch (e) {}
        reject(new Error('Download timeout'));
      });

      // Set timeout for the request
      request.setTimeout(300000); // 5 minute timeout
    });
  }

  /**
   * Extract tar.gz archive
   * @param {string} archivePath - Path to archive
   * @param {string} destDir - Destination directory
   * @returns {Promise<string>} Destination directory
   * @private
   */
  _extractArchive(archivePath, destDir) {
    return new Promise((resolve, reject) => {
      this._updateProgress(SETUP_STATES.EXTRACTING, 65, 'Extracting Tor bundle...');

      try {
        // Ensure destination exists
        fs.mkdirSync(destDir, { recursive: true });

        // Use tar command (available on Linux, macOS, and Git Bash on Windows)
        execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, {
          stdio: 'pipe',
          timeout: 120000 // 2 minute timeout
        });

        this._updateProgress(SETUP_STATES.EXTRACTING, 75, 'Extraction complete');
        resolve(destDir);
      } catch (error) {
        // Try with Node.js tar module if available
        try {
          const tar = require('tar');
          tar.x({
            file: archivePath,
            cwd: destDir,
            sync: true
          });
          this._updateProgress(SETUP_STATES.EXTRACTING, 75, 'Extraction complete');
          resolve(destDir);
        } catch (e) {
          reject(new Error(`Failed to extract: ${error.message}\nInstall 'tar' or run: npm install tar`));
        }
      }
    });
  }

  /**
   * Configure Tor after extraction
   * @returns {Promise<void>}
   * @private
   */
  async _configureTor() {
    this._updateProgress(SETUP_STATES.CONFIGURING, 80, 'Configuring Tor...');

    const platform = os.platform();
    const torBinary = platform === 'win32'
      ? path.join(this.torDir, 'tor', 'tor.exe')
      : path.join(this.torDir, 'tor', 'tor');

    // Make binary executable on Unix
    if (platform !== 'win32') {
      if (fs.existsSync(torBinary)) {
        fs.chmodSync(torBinary, 0o755);
      }

      // Make pluggable transports executable
      const ptDir = path.join(this.torDir, 'tor', 'pluggable_transports');
      if (fs.existsSync(ptDir)) {
        const files = fs.readdirSync(ptDir);
        for (const file of files) {
          const filePath = path.join(ptDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && !file.endsWith('.json') && !file.endsWith('.md')) {
            fs.chmodSync(filePath, 0o755);
          }
        }
      }
    }

    // Create data directory
    fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });

    // Create default torrc
    await this._createDefaultTorrc();

    // Create version info file
    this._createVersionInfo();

    this._updateProgress(SETUP_STATES.CONFIGURING, 85, 'Configuration complete');
  }

  /**
   * Create default torrc configuration
   * @returns {Promise<string>} Path to torrc
   * @private
   */
  async _createDefaultTorrc() {
    const torrcPath = path.join(this.dataDir, 'torrc');
    const platform = os.platform();

    const ptDir = platform === 'win32'
      ? path.join(this.torDir, 'tor', 'pluggable_transports').replace(/\\/g, '/')
      : path.join(this.torDir, 'tor', 'pluggable_transports');

    const lyrebird = platform === 'win32' ? 'lyrebird.exe' : 'lyrebird';
    const conjure = platform === 'win32' ? 'conjure-client.exe' : 'conjure-client';

    const torrc = `
# Basset Hound Browser - Embedded Tor Configuration
# Generated: ${new Date().toISOString()}
# Auto-generated by tor-auto-setup.js

# Network ports
SocksPort 9050
ControlPort 9051
DNSPort 9053

# Data directory
DataDirectory ${this.dataDir}

# Authentication
CookieAuthentication 1

# Logging
Log notice stdout

# GeoIP files
GeoIPFile ${path.join(this.torDir, 'data', 'geoip')}
GeoIPv6File ${path.join(this.torDir, 'data', 'geoip6')}

# Performance tuning
AvoidDiskWrites 1
CircuitBuildTimeout 30
LearnCircuitBuildTimeout 0

# Pluggable Transports
ClientTransportPlugin meek_lite,obfs2,obfs3,obfs4,scramblesuit,webtunnel exec ${path.join(ptDir, lyrebird)}
ClientTransportPlugin snowflake exec ${path.join(ptDir, lyrebird)}
ClientTransportPlugin conjure exec ${path.join(ptDir, conjure)} -registerURL https://registration.refraction.network/api
`.trim();

    fs.writeFileSync(torrcPath, torrc, { mode: 0o600 });
    return torrcPath;
  }

  /**
   * Create version info file
   * @private
   */
  _createVersionInfo() {
    const infoPath = path.join(this.torDir, 'version.json');
    const info = {
      bundleVersion: TOR_VERSION,
      torVersion: TOR_DAEMON_VERSION,
      platform: this.getPlatformKey(),
      installedAt: new Date().toISOString(),
      downloadedFrom: DOWNLOAD_URLS[this.getPlatformKey()],
      bassetHoundBrowser: true,
      autoSetup: true
    };

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  }

  /**
   * Verify Tor installation
   * @returns {Promise<Object>} Verification result
   * @private
   */
  async _verifyInstallation() {
    this._updateProgress(SETUP_STATES.VERIFYING, 90, 'Verifying Tor installation...');

    const platform = os.platform();
    const torBinary = platform === 'win32'
      ? path.join(this.torDir, 'tor', 'tor.exe')
      : path.join(this.torDir, 'tor', 'tor');

    if (!fs.existsSync(torBinary)) {
      throw new Error(`Tor binary not found at: ${torBinary}`);
    }

    // Test the binary
    try {
      // Set LD_LIBRARY_PATH for Linux to find shared libraries
      const libDir = path.join(this.torDir, 'tor');
      const envOptions = {};
      if (platform === 'linux') {
        envOptions.env = {
          ...process.env,
          LD_LIBRARY_PATH: libDir + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : '')
        };
      } else if (platform === 'darwin') {
        envOptions.env = {
          ...process.env,
          DYLD_LIBRARY_PATH: libDir + (process.env.DYLD_LIBRARY_PATH ? `:${process.env.DYLD_LIBRARY_PATH}` : '')
        };
      }

      const output = execSync(`"${torBinary}" --version`, {
        encoding: 'utf8',
        timeout: 10000,
        ...envOptions
      });

      const versionMatch = output.match(/Tor version ([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      this._updateProgress(SETUP_STATES.VERIFYING, 95, `Tor ${version} verified`);

      return {
        success: true,
        version,
        binary: torBinary
      };
    } catch (error) {
      throw new Error(`Tor binary failed to execute: ${error.message}`);
    }
  }

  /**
   * Format bytes to human readable
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Download and setup Tor bundle
   * @param {Object} options - Download options
   * @param {boolean} options.force - Force re-download even if exists
   * @returns {Promise<Object>} Setup result
   */
  async downloadTorBundle(options = {}) {
    const { force = false } = options;

    this._updateProgress(SETUP_STATES.CHECKING, 5, 'Checking platform compatibility...');

    const platformKey = this.getPlatformKey();

    if (!DOWNLOAD_URLS[platformKey]) {
      const error = new Error(`Platform not supported: ${platformKey}. Supported: ${Object.keys(DOWNLOAD_URLS).join(', ')}`);
      this.state = SETUP_STATES.ERROR;
      this.error = error;
      this.emit('error', error);
      throw error;
    }

    // Check if already installed
    const versionFile = path.join(this.torDir, 'version.json');
    if (fs.existsSync(versionFile) && !force) {
      try {
        const existing = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        this._updateProgress(SETUP_STATES.COMPLETE, 100, `Tor already installed: v${existing.torVersion}`);

        this.emit('complete', {
          success: true,
          existing: true,
          ...existing
        });

        return {
          success: true,
          existing: true,
          torDir: this.torDir,
          dataDir: this.dataDir,
          version: existing.torVersion,
          bundleVersion: existing.bundleVersion
        };
      } catch (e) {
        // Version file corrupted, proceed with install
      }
    }

    this._updateProgress(SETUP_STATES.DOWNLOADING, 10, 'Starting download...');

    // Create directories
    fs.mkdirSync(this.torDir, { recursive: true });
    fs.mkdirSync(this.tempDir, { recursive: true });

    // Download
    const downloadUrl = DOWNLOAD_URLS[platformKey];
    const archiveName = path.basename(downloadUrl);
    const archivePath = path.join(this.tempDir, archiveName);

    try {
      // Check for cached download
      if (!fs.existsSync(archivePath) || force) {
        await this._downloadFile(downloadUrl, archivePath);
      } else {
        this._updateProgress(SETUP_STATES.DOWNLOADING, 60, 'Using cached download');
      }

      // Clear target directory for clean install if forcing
      if (force && fs.existsSync(this.torDir)) {
        fs.rmSync(this.torDir, { recursive: true, force: true });
        fs.mkdirSync(this.torDir, { recursive: true });
      }

      // Extract
      await this._extractArchive(archivePath, this.torDir);

      // Configure
      await this._configureTor();

      // Verify
      const verification = await this._verifyInstallation();

      // Complete
      this._updateProgress(SETUP_STATES.COMPLETE, 100, 'Tor setup complete!');

      const result = {
        success: true,
        torDir: this.torDir,
        dataDir: this.dataDir,
        torBinary: verification.binary,
        version: verification.version,
        bundleVersion: TOR_VERSION,
        platform: platformKey
      };

      this.emit('complete', result);
      return result;

    } catch (error) {
      this.state = SETUP_STATES.ERROR;
      this.error = error;
      this._updateProgress(SETUP_STATES.ERROR, this.progress, `Error: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Ensure embedded Tor is available
   * Downloads and sets up if not present
   * @param {Object} options - Options
   * @param {boolean} options.force - Force re-download
   * @param {boolean} options.skipIfAvailable - Skip if already available (default: true)
   * @returns {Promise<Object>} Setup result
   */
  async ensureEmbeddedTor(options = {}) {
    const { force = false, skipIfAvailable = true } = options;

    this._updateProgress(SETUP_STATES.CHECKING, 0, 'Checking for embedded Tor...');

    // Check if already available
    if (skipIfAvailable && !force && this.checkTorAvailability()) {
      const info = this.getAvailabilityInfo();

      this._updateProgress(SETUP_STATES.COMPLETE, 100, 'Embedded Tor is already available');

      const result = {
        success: true,
        existing: true,
        available: true,
        ...info
      };

      this.emit('complete', result);
      return result;
    }

    // Download and setup
    return await this.downloadTorBundle({ force });
  }

  /**
   * Get current setup state
   * @returns {Object} Current state
   */
  getState() {
    return {
      state: this.state,
      progress: this.progress,
      message: this.progressMessage,
      error: this.error ? this.error.message : null,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes
    };
  }

  /**
   * Clean up temporary files
   * @returns {Object} Cleanup result
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
      return { success: true, message: 'Temporary files cleaned up' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance for convenience
let defaultInstance = null;

/**
 * Get or create default TorAutoSetup instance
 * @returns {TorAutoSetup}
 */
function getDefaultInstance() {
  if (!defaultInstance) {
    defaultInstance = new TorAutoSetup();
  }
  return defaultInstance;
}

/**
 * Check if Tor is available (convenience function)
 * @returns {boolean}
 */
function checkTorAvailability() {
  return getDefaultInstance().checkTorAvailability();
}

/**
 * Ensure embedded Tor is available (convenience function)
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function ensureEmbeddedTor(options = {}) {
  return await getDefaultInstance().ensureEmbeddedTor(options);
}

/**
 * Download Tor bundle (convenience function)
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function downloadTorBundle(options = {}) {
  return await getDefaultInstance().downloadTorBundle(options);
}

// Export
module.exports = {
  TorAutoSetup,
  SETUP_STATES,
  checkTorAvailability,
  ensureEmbeddedTor,
  downloadTorBundle,
  getDefaultInstance,
  TOR_VERSION,
  TOR_DAEMON_VERSION,
  DOWNLOAD_URLS
};
