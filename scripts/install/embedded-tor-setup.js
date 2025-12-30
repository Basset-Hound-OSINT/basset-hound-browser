#!/usr/bin/env node
/**
 * Embedded Tor Setup Script for Basset Hound Browser
 *
 * Downloads and configures Tor Expert Bundle for embedded/portable operation.
 * This allows running Tor without system installation, keeping all files local.
 *
 * Usage:
 *   node scripts/install/embedded-tor-setup.js [--force] [--target <dir>]
 *
 * Options:
 *   --force    Force re-download even if files exist
 *   --target   Target directory (default: bin/tor)
 *
 * @module EmbeddedTorSetup
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');
const crypto = require('crypto');

// Configuration
const TOR_VERSION = '15.0.3';
const TOR_DAEMON_VERSION = '0.4.8.21';

const DOWNLOAD_URLS = {
  'linux-x64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-linux-x86_64-${TOR_VERSION}.tar.gz`,
  'darwin-x64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-macos-x86_64-${TOR_VERSION}.tar.gz`,
  'darwin-arm64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-macos-aarch64-${TOR_VERSION}.tar.gz`,
  'win32-x64': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-x86_64-${TOR_VERSION}.tar.gz`,
  'win32-ia32': `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-i686-${TOR_VERSION}.tar.gz`
};

// SHA256 checksums for verification (update with actual values from Tor Project)
const CHECKSUMS = {
  'linux-x64': null,  // Will be fetched from .sha256sum files
  'darwin-x64': null,
  'darwin-arm64': null,
  'win32-x64': null,
  'win32-ia32': null
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(msg) { log(`✅ ${msg}`, colors.green); }
function logError(msg) { log(`❌ ${msg}`, colors.red); }
function logInfo(msg) { log(`ℹ️  ${msg}`, colors.blue); }
function logWarning(msg) { log(`⚠️  ${msg}`, colors.yellow); }

/**
 * Get platform key for downloads
 */
function getPlatformKey() {
  const platform = os.platform();
  const arch = os.arch();
  return `${platform}-${arch}`;
}

/**
 * Download file with progress
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    logInfo(`Downloading: ${url}`);

    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;
      let lastPercent = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);

        if (percent > lastPercent && percent % 10 === 0) {
          process.stdout.write(`\r   Progress: ${percent}% (${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)})`);
          lastPercent = percent;
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('');  // New line after progress
        logSuccess(`Downloaded: ${path.basename(destPath)}`);
        resolve(destPath);
      });

      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extract tar.gz archive
 */
function extractArchive(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    logInfo(`Extracting to: ${destDir}`);

    try {
      // Ensure destination exists
      fs.mkdirSync(destDir, { recursive: true });

      // Use tar command (available on Linux, macOS, and Git Bash on Windows)
      execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, {
        stdio: 'pipe'
      });

      logSuccess('Extraction complete');
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
        logSuccess('Extraction complete');
        resolve(destDir);
      } catch (e) {
        reject(new Error(`Failed to extract: ${error.message}\nInstall 'tar' or run: npm install tar`));
      }
    }
  });
}

/**
 * Verify Tor binary works
 */
async function verifyInstallation(torDir) {
  const platform = os.platform();
  const torBinary = platform === 'win32'
    ? path.join(torDir, 'tor', 'tor.exe')
    : path.join(torDir, 'tor', 'tor');

  if (!fs.existsSync(torBinary)) {
    throw new Error(`Tor binary not found at: ${torBinary}`);
  }

  // Make executable on Unix
  if (platform !== 'win32') {
    fs.chmodSync(torBinary, 0o755);

    // Also make pluggable transports executable
    const ptDir = path.join(torDir, 'tor', 'pluggable_transports');
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

  // Test the binary
  try {
    const output = execSync(`"${torBinary}" --version`, { encoding: 'utf8', timeout: 10000 });
    const versionMatch = output.match(/Tor version ([\d.]+)/);
    if (versionMatch) {
      logSuccess(`Tor ${versionMatch[1]} verified`);
      return versionMatch[1];
    }
  } catch (error) {
    throw new Error(`Tor binary failed to execute: ${error.message}`);
  }

  return true;
}

/**
 * Create default torrc for embedded use
 */
function createDefaultTorrc(torDir, dataDir) {
  const torrcPath = path.join(dataDir, 'torrc');
  const platform = os.platform();

  // Get relative paths for portability
  const ptDir = platform === 'win32'
    ? path.join(torDir, 'tor', 'pluggable_transports').replace(/\\/g, '/')
    : path.join(torDir, 'tor', 'pluggable_transports');

  const lyrebird = platform === 'win32' ? 'lyrebird.exe' : 'lyrebird';
  const conjure = platform === 'win32' ? 'conjure-client.exe' : 'conjure-client';

  const torrc = `
# Basset Hound Browser - Embedded Tor Configuration
# Generated: ${new Date().toISOString()}

# Network ports
SocksPort 9050
ControlPort 9051
DNSPort 9053

# Data directory (relative to working dir)
DataDirectory ${dataDir}

# Authentication
CookieAuthentication 1

# Logging
Log notice stdout

# GeoIP files
GeoIPFile ${path.join(torDir, 'data', 'geoip')}
GeoIPv6File ${path.join(torDir, 'data', 'geoip6')}

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
  logSuccess(`Created torrc: ${torrcPath}`);

  return torrcPath;
}

/**
 * Create version info file
 */
function createVersionInfo(torDir, torVersion) {
  const infoPath = path.join(torDir, 'version.json');
  const info = {
    bundleVersion: TOR_VERSION,
    torVersion: torVersion || TOR_DAEMON_VERSION,
    platform: getPlatformKey(),
    installedAt: new Date().toISOString(),
    downloadedFrom: DOWNLOAD_URLS[getPlatformKey()],
    bassetHoundBrowser: true
  };

  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
  return info;
}

/**
 * Main setup function
 */
async function setup(options = {}) {
  const { force = false, targetDir = null } = options;

  log('\n' + '='.repeat(60), colors.cyan);
  log('  Basset Hound Browser - Embedded Tor Setup', colors.cyan);
  log('='.repeat(60) + '\n', colors.cyan);

  const platformKey = getPlatformKey();
  logInfo(`Platform: ${platformKey}`);

  // Check if platform is supported
  if (!DOWNLOAD_URLS[platformKey]) {
    logError(`Platform not supported: ${platformKey}`);
    logInfo('Supported platforms: ' + Object.keys(DOWNLOAD_URLS).join(', '));
    process.exit(1);
  }

  // Determine target directory
  const projectRoot = path.resolve(__dirname, '..', '..');
  const torDir = targetDir || path.join(projectRoot, 'bin', 'tor');
  const tempDir = path.join(projectRoot, 'tor_tmp');
  const dataDir = path.join(torDir, 'data_local');

  logInfo(`Target directory: ${torDir}`);

  // Check if already installed
  const versionFile = path.join(torDir, 'version.json');
  if (fs.existsSync(versionFile) && !force) {
    const existing = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    logInfo(`Tor already installed: v${existing.torVersion}`);
    logInfo(`Bundle version: ${existing.bundleVersion}`);
    logInfo('Use --force to reinstall');
    return { success: true, existing: true, ...existing };
  }

  // Create directories
  fs.mkdirSync(torDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  // Download
  const downloadUrl = DOWNLOAD_URLS[platformKey];
  const archiveName = path.basename(downloadUrl);
  const archivePath = path.join(tempDir, archiveName);

  if (!fs.existsSync(archivePath) || force) {
    try {
      await downloadFile(downloadUrl, archivePath);
    } catch (error) {
      logError(`Download failed: ${error.message}`);
      process.exit(1);
    }
  } else {
    logInfo('Using cached download');
  }

  // Extract
  try {
    // Clear target directory for clean install
    if (force && fs.existsSync(torDir)) {
      fs.rmSync(torDir, { recursive: true, force: true });
      fs.mkdirSync(torDir, { recursive: true });
    }

    await extractArchive(archivePath, torDir);
  } catch (error) {
    logError(`Extraction failed: ${error.message}`);
    process.exit(1);
  }

  // Verify
  let torVersion;
  try {
    torVersion = await verifyInstallation(torDir);
  } catch (error) {
    logError(`Verification failed: ${error.message}`);
    process.exit(1);
  }

  // Create torrc
  createDefaultTorrc(torDir, dataDir);

  // Create version info
  const versionInfo = createVersionInfo(torDir, torVersion);

  // Summary
  log('\n' + '-'.repeat(60), colors.cyan);
  logSuccess('Embedded Tor setup complete!');
  log('-'.repeat(60) + '\n', colors.cyan);

  console.log(`  Tor Binary:    ${path.join(torDir, 'tor', 'tor')}`);
  console.log(`  Data Dir:      ${dataDir}`);
  console.log(`  Version:       ${torVersion}`);
  console.log(`  SOCKS Port:    9050 (default)`);
  console.log(`  Control Port:  9051 (default)`);

  log('\nTo use embedded Tor:', colors.yellow);
  console.log(`  const { AdvancedTorManager } = require('./proxy/tor-advanced');`);
  console.log(`  const tor = new AdvancedTorManager({`);
  console.log(`    torBinaryPath: '${path.join(torDir, 'tor', 'tor')}',`);
  console.log(`    dataDirectory: '${dataDir}'`);
  console.log(`  });`);
  console.log(`  await tor.start();`);

  return {
    success: true,
    torDir,
    dataDir,
    torBinary: path.join(torDir, 'tor', os.platform() === 'win32' ? 'tor.exe' : 'tor'),
    version: torVersion,
    bundleVersion: TOR_VERSION
  };
}

/**
 * Test embedded Tor
 */
async function testEmbeddedTor(torDir) {
  const platform = os.platform();
  const absoluteTorDir = path.resolve(torDir);
  const torBinary = path.join(absoluteTorDir, 'tor', platform === 'win32' ? 'tor.exe' : 'tor');
  const dataDir = path.join(absoluteTorDir, 'test_data');

  log('\n' + '='.repeat(60), colors.cyan);
  log('  Testing Embedded Tor', colors.cyan);
  log('='.repeat(60) + '\n', colors.cyan);

  if (!fs.existsSync(torBinary)) {
    logError('Tor binary not found. Run setup first.');
    return { success: false };
  }

  // Create test data directory
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  // Check if default ports are in use and pick alternatives
  const socksPort = await findAvailablePort(9050);
  const controlPort = await findAvailablePort(socksPort + 1);  // Start after SOCKS port

  logInfo(`Using SOCKS port: ${socksPort}`);
  logInfo(`Using Control port: ${controlPort}`);

  // Create test-specific torrc with absolute paths
  const testTorrc = path.join(dataDir, 'torrc');
  const geoipPath = path.join(absoluteTorDir, 'data', 'geoip');
  const geoip6Path = path.join(absoluteTorDir, 'data', 'geoip6');

  const torrcContent = `
SocksPort ${socksPort}
ControlPort ${controlPort}
DataDirectory ${dataDir}
CookieAuthentication 1
Log notice stdout
GeoIPFile ${geoipPath}
GeoIPv6File ${geoip6Path}
AvoidDiskWrites 1
CircuitBuildTimeout 30
`.trim();

  fs.writeFileSync(testTorrc, torrcContent, { mode: 0o600 });

  logInfo('Starting Tor process...');

  return new Promise((resolve) => {
    // Set LD_LIBRARY_PATH for Linux
    const env = { ...process.env };
    if (platform === 'linux') {
      const torLibDir = path.join(absoluteTorDir, 'tor');
      env.LD_LIBRARY_PATH = torLibDir + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
    }

    const torProcess = spawn(torBinary, ['-f', testTorrc], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env
    });

    let bootstrapComplete = false;
    let output = '';

    const timeout = setTimeout(() => {
      if (!bootstrapComplete) {
        logError('Bootstrap timeout (120s)');
        torProcess.kill();
        // Cleanup test data
        try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
        resolve({ success: false, error: 'timeout', output });
      }
    }, 120000);

    torProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Parse bootstrap progress
      const match = text.match(/Bootstrapped (\d+)%/);
      if (match) {
        const progress = parseInt(match[1], 10);
        process.stdout.write(`\r   Bootstrap: ${progress}%`);

        if (progress >= 100 && !bootstrapComplete) {
          bootstrapComplete = true;
          clearTimeout(timeout);
          console.log('');
          logSuccess('Tor bootstrapped successfully!');

          // Give it a moment then stop
          setTimeout(() => {
            torProcess.kill('SIGTERM');
          }, 2000);
        }
      }
    });

    torProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Also check stderr for bootstrap messages
      const match = text.match(/Bootstrapped (\d+)%/);
      if (match) {
        const progress = parseInt(match[1], 10);
        process.stdout.write(`\r   Bootstrap: ${progress}%`);

        if (progress >= 100 && !bootstrapComplete) {
          bootstrapComplete = true;
          clearTimeout(timeout);
          console.log('');
          logSuccess('Tor bootstrapped successfully!');
          setTimeout(() => { torProcess.kill('SIGTERM'); }, 2000);
        }
      }
    });

    torProcess.on('exit', (code) => {
      // Cleanup test data
      try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}

      if (bootstrapComplete) {
        logSuccess('Embedded Tor test passed!');
        resolve({ success: true, output, socksPort, controlPort });
      } else {
        logError(`Tor exited with code ${code}`);
        if (output) {
          console.log('\nTor output:');
          console.log(output.slice(-1000));  // Last 1000 chars
        }
        resolve({ success: false, code, output });
      }
    });

    torProcess.on('error', (error) => {
      clearTimeout(timeout);
      logError(`Process error: ${error.message}`);
      try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort) {
  const net = require('net');

  const isPortAvailable = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  };

  let port = startPort;
  while (port < startPort + 100) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  return startPort + 100;  // Fallback
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const targetIndex = args.indexOf('--target');
  const targetDir = targetIndex >= 0 ? args[targetIndex + 1] : null;
  const testMode = args.includes('--test');

  if (testMode) {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const torDir = targetDir || path.join(projectRoot, 'bin', 'tor');
    testEmbeddedTor(torDir)
      .then((result) => process.exit(result.success ? 0 : 1))
      .catch((err) => {
        logError(err.message);
        process.exit(1);
      });
  } else {
    setup({ force, targetDir })
      .then((result) => {
        if (!result.success) process.exit(1);
      })
      .catch((err) => {
        logError(err.message);
        process.exit(1);
      });
  }
}

module.exports = { setup, testEmbeddedTor, getPlatformKey, DOWNLOAD_URLS };
