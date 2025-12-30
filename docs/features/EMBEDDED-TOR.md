# Embedded Tor Guide for Basset Hound Browser

## Overview

Basset Hound Browser supports **embedded Tor mode**, allowing you to run Tor without system-wide installation. This provides a portable, self-contained solution that runs entirely in user space with zero system impact.

---

## Table of Contents

- [Why Embedded Tor?](#why-embedded-tor)
- [Quick Start](#quick-start)
- [Setup Options](#setup-options)
- [Directory Structure](#directory-structure)
- [Usage in Code](#usage-in-code)
- [Pluggable Transports](#pluggable-transports)
- [Configuration](#configuration)
- [Deployment Strategies](#deployment-strategies)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Why Embedded Tor?

### System Tor vs Embedded Tor

| Feature | System Tor | Embedded Tor |
|---------|------------|--------------|
| **Installation** | Requires sudo/admin | No installation |
| **Permissions** | Root/admin required | User-space only |
| **System Impact** | Installs system service | Zero impact |
| **Sharing** | Shared by all applications | Isolated per-app |
| **Configuration** | `/etc/tor/torrc` | Local file |
| **Auto-Start** | Via systemd/launchd | Via application |
| **Memory** | Single shared daemon | Per-application |
| **Control** | Limited (service restart) | Full control |
| **Portability** | Not portable | Fully portable |

### Use Cases for Embedded Tor

1. **Portable Applications**: USB-drive deployments
2. **Sandboxed Environments**: Container/VM deployments
3. **No Admin Access**: Shared systems, restricted environments
4. **Multiple Configurations**: Different Tor configs per project
5. **Testing**: Isolated Tor instances for development
6. **Distribution**: Ship Tor bundled with your app

---

## Quick Start

### One-Command Setup

```bash
# Download and configure embedded Tor
node scripts/install/embedded-tor-setup.js
```

This command:
1. Downloads the Tor Expert Bundle for your platform
2. Extracts binaries to `bin/tor/`
3. Includes pluggable transports (obfs4, meek, snowflake)
4. Includes GeoIP databases
5. Creates default configuration
6. Verifies the installation

### Test the Installation

```bash
# Verify Tor binary works
./bin/tor/tor/tor --version

# Run bootstrap test (starts and stops Tor)
node scripts/install/embedded-tor-setup.js --test
```

---

## Setup Options

### Command Line Options

```bash
# Standard setup
node scripts/install/embedded-tor-setup.js

# Force re-download (overwrites existing)
node scripts/install/embedded-tor-setup.js --force

# Custom target directory
node scripts/install/embedded-tor-setup.js --target /path/to/tor

# Test mode (start Tor and verify bootstrap)
node scripts/install/embedded-tor-setup.js --test
```

### Programmatic Setup

```javascript
const { setup, testEmbeddedTor } = require('./scripts/install/embedded-tor-setup');

// Setup embedded Tor
const result = await setup({
  force: false,                    // Don't re-download if exists
  targetDir: './bin/tor'           // Custom target (optional)
});

console.log(result.torBinary);     // Path to tor executable
console.log(result.version);       // Tor daemon version

// Test the installation
const testResult = await testEmbeddedTor('./bin/tor');
console.log(testResult.success);   // true if bootstrap succeeded
```

---

## Directory Structure

After setup, the embedded Tor directory structure:

```
bin/tor/
├── tor/
│   ├── tor                    # Tor daemon binary
│   ├── libcrypto.so.3         # OpenSSL (Linux)
│   ├── libssl.so.3            # SSL library
│   ├── libevent-2.1.so.7      # Event library
│   └── pluggable_transports/
│       ├── lyrebird           # obfs4/meek/webtunnel/snowflake
│       ├── conjure-client     # Conjure transport
│       ├── pt_config.json     # Transport config
│       └── README.CONJURE.md  # Conjure documentation
├── data/
│   ├── geoip                  # IPv4 GeoIP database
│   ├── geoip6                 # IPv6 GeoIP database
│   └── torrc-defaults         # Default Tor Browser config
├── data_local/
│   └── torrc                  # Generated configuration
├── debug/                     # Debug symbols (optional)
├── docs/                      # Bundle documentation
└── version.json               # Installation metadata
```

---

## Usage in Code

### Using AdvancedTorManager

```javascript
const { AdvancedTorManager } = require('./proxy/tor-advanced');

// Create manager with embedded Tor
const tor = new AdvancedTorManager({
  torBinaryPath: './bin/tor/tor/tor',           // Embedded binary
  dataDirectory: './bin/tor/data_local',        // Local data
  socksPort: 9050,
  controlPort: 9051,
  autoStart: true,
  killOnExit: true  // Clean up when app exits
});

// Start Tor
const startResult = await tor.start();
if (startResult.success) {
  console.log('Tor started! PID:', startResult.pid);
}

// Listen for bootstrap progress
tor.on('bootstrap', (data) => {
  console.log(`Bootstrap: ${data.progress}% - ${data.phase}`);
});

// Listen for connection state changes
tor.on('stateChange', (data) => {
  console.log('State:', data.state);
});

// When connected
tor.on('connected', () => {
  console.log('Tor is ready!');
});

// Get new identity
await tor.newIdentity();

// Set exit countries
await tor.setExitCountries(['us', 'de', 'nl']);

// Stop Tor
await tor.stop();
```

### Connecting Browser to Embedded Tor

```javascript
const { app, session } = require('electron');

// Configure proxy after Tor is running
session.defaultSession.setProxy({
  proxyRules: 'socks5://127.0.0.1:9050'
});

// Or use the manager's helper
const proxyRules = tor.getProxyRules();
session.defaultSession.setProxy({ proxyRules });
```

### Via WebSocket API

```javascript
// Start embedded Tor
ws.send(JSON.stringify({
  command: 'tor_start',
  config: {
    embedded: true,
    binaryPath: './bin/tor/tor/tor'
  }
}));

// Monitor bootstrap
// Server will emit 'tor_bootstrap' events

// Stop Tor
ws.send(JSON.stringify({ command: 'tor_stop' }));
```

---

## Pluggable Transports

The embedded bundle includes pluggable transports for censorship circumvention:

### Available Transports

| Transport | Binary | Description |
|-----------|--------|-------------|
| **obfs4** | lyrebird | Obfuscated traffic (looks random) |
| **meek** | lyrebird | Domain fronting via CDN |
| **webtunnel** | lyrebird | HTTPS-based tunneling |
| **snowflake** | lyrebird | WebRTC peer-to-peer |
| **conjure** | conjure-client | Registration-based |

### Using Bridges

```javascript
// Enable built-in obfs4 bridges
await tor.enableBridges({
  transport: 'obfs4',
  useBuiltin: true
});

// Or add custom bridge
tor.addBridge('obfs4 192.168.1.1:443 FINGERPRINT cert=...');
await tor.restart();  // Apply bridge config
```

---

## Configuration

### Default Torrc (Generated)

```
# Basset Hound Browser - Embedded Tor Configuration

# Network ports
SocksPort 9050
ControlPort 9051
DNSPort 9053

# Data directory
DataDirectory /path/to/bin/tor/data_local

# Authentication
CookieAuthentication 1

# Logging
Log notice stdout

# GeoIP files
GeoIPFile /path/to/bin/tor/data/geoip
GeoIPv6File /path/to/bin/tor/data/geoip6

# Performance tuning
AvoidDiskWrites 1
CircuitBuildTimeout 30
LearnCircuitBuildTimeout 0

# Pluggable Transports
ClientTransportPlugin meek_lite,obfs4,... exec /path/to/lyrebird
ClientTransportPlugin snowflake exec /path/to/lyrebird
ClientTransportPlugin conjure exec /path/to/conjure-client ...
```

### Custom Configuration

```javascript
const tor = new AdvancedTorManager({
  torBinaryPath: './bin/tor/tor/tor',
  dataDirectory: './bin/tor/data_local',

  // Network ports (change if 9050/9051 in use)
  socksPort: 19050,
  controlPort: 19051,
  dnsPort: 19053,

  // Control authentication
  controlPassword: 'my-secure-password',

  // Timeouts
  connectionTimeout: 30000,
  circuitTimeout: 60000,
  bootstrapTimeout: 120000,

  // Exit node preferences
  exitCountries: ['us', 'de', 'nl'],
  excludeCountries: ['ru', 'cn'],
  strictNodes: true,

  // Process management
  autoStart: true,
  killOnExit: true
});
```

---

## Deployment Strategies

### Strategy 1: Download on First Run

```javascript
async function ensureTor() {
  const versionFile = './bin/tor/version.json';

  if (!fs.existsSync(versionFile)) {
    console.log('First run: downloading Tor...');
    const { setup } = require('./scripts/install/embedded-tor-setup');
    await setup();
  }

  return './bin/tor/tor/tor';
}
```

### Strategy 2: Bundle with Release

Add to `electron-builder` config:

```json
{
  "extraResources": [
    {
      "from": "bin/tor",
      "to": "tor",
      "filter": ["**/*"]
    }
  ]
}
```

Access bundled Tor:
```javascript
const { app } = require('electron');
const path = require('path');

const torBinary = path.join(
  app.getAppPath(),
  'tor/tor',
  process.platform === 'win32' ? 'tor.exe' : 'tor'
);
```

### Strategy 3: Per-Platform Bundles

```javascript
const PLATFORM_URLS = {
  'linux-x64': 'tor-expert-bundle-linux-x86_64-15.0.3.tar.gz',
  'darwin-x64': 'tor-expert-bundle-macos-x86_64-15.0.3.tar.gz',
  'darwin-arm64': 'tor-expert-bundle-macos-aarch64-15.0.3.tar.gz',
  'win32-x64': 'tor-expert-bundle-windows-x86_64-15.0.3.tar.gz'
};

const platformKey = `${process.platform}-${process.arch}`;
const downloadUrl = PLATFORM_URLS[platformKey];
```

---

## Troubleshooting

### Binary Not Found

```
Error: Tor binary not found at: ./bin/tor/tor/tor
```

**Solution**: Run the setup script:
```bash
node scripts/install/embedded-tor-setup.js
```

### Permission Denied (Unix)

```
Error: spawn EACCES
```

**Solution**: Make binary executable:
```bash
chmod +x bin/tor/tor/tor
chmod +x bin/tor/tor/pluggable_transports/*
```

### Bootstrap Timeout

```
Error: Tor bootstrap timed out
```

**Solutions**:
1. Check network connectivity
2. Try bridges if Tor is blocked
3. Increase `bootstrapTimeout`
4. Check firewall settings

### Port Already in Use

```
Error: Address already in use (9050)
```

**Solution**: Use different ports:
```javascript
const tor = new AdvancedTorManager({
  socksPort: 19050,
  controlPort: 19051
});
```

### Library Loading Errors (Linux)

```
error while loading shared libraries: libssl.so.3
```

**Solution**: Set library path:
```bash
export LD_LIBRARY_PATH="$PWD/bin/tor/tor:$LD_LIBRARY_PATH"
./bin/tor/tor/tor --version
```

---

## Security Considerations

### Data Directory Permissions

The data directory contains sensitive information:
- Control authentication cookie
- Circuit state
- Cached consensus data

Ensure proper permissions:
```javascript
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
```

### Process Isolation

Embedded Tor runs as the same user as your application. For stronger isolation:
- Use separate user accounts
- Run in containers
- Use OS-level sandboxing

### Binary Verification

The setup script downloads from official Tor Project archives. For production:
1. Verify GPG signatures
2. Check SHA256 checksums
3. Pin specific versions

### Control Port Security

Never expose the control port to network:
```javascript
// Good: localhost only
controlHost: '127.0.0.1',
controlPort: 9051

// Bad: network accessible
controlHost: '0.0.0.0',  // Don't do this!
```

---

## Platform Support

| Platform | Architecture | Status |
|----------|--------------|--------|
| Linux | x86_64 | Tested |
| macOS | x86_64 | Supported |
| macOS | arm64 (M1/M2) | Supported |
| Windows | x64 | Supported |
| Windows | ia32 | Supported |

---

## Related Documentation

- [TOR-INTEGRATION.md](TOR-INTEGRATION.md) - Tor integration overview
- [TOR-SETUP-GUIDE.md](../deployment/TOR-SETUP-GUIDE.md) - System Tor setup
- [PROXY.md](PROXY.md) - General proxy configuration
- [API.md](../core/API.md) - WebSocket API reference

---

*Last Updated: December 29, 2024*
*For Basset Hound Browser v8.2.0*
