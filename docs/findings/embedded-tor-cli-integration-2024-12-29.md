# Embedded Tor CLI Integration - December 29, 2024

## Summary

This document details the implementation of CLI argument support for Tor modes and the configuration of embedded Tor as the default behavior for Basset Hound Browser.

## Changes Implemented

### 1. CLI Arguments for Tor Modes

New command-line arguments added to `config/cli.js`:

| Argument | Description | Config Path |
|----------|-------------|-------------|
| `--tor` | Enable Tor routing | `network.tor.enabled` |
| `--embedded-tor` | Use embedded Tor (default) | `network.tor.useEmbedded` |
| `--system-tor` | Use system-installed Tor | `network.tor.useSystem` |
| `--tor-auto-download` | Auto-download embedded Tor | `network.tor.autoDownload` |
| `--no-tor-auto-download` | Disable auto-download | `network.tor.autoDownload` |

### 2. Default Configuration Updates

Updated `config/defaults.js` with new Tor settings:

```javascript
tor: {
  enabled: false,
  socksPort: 9050,
  controlPort: 9051,
  dataDirectory: null,
  useEmbedded: true,     // Default to embedded Tor when enabled
  useSystem: false,       // Use system-installed Tor instead
  autoDownload: true      // Auto-download embedded Tor if not present
}
```

### 3. Help Text Categories

Added dedicated "Tor" category in help output:

```
Tor:
  --tor                                 Enable Tor routing (uses embedded Tor by default)
  --embedded-tor                        Use embedded Tor (default when --tor is enabled)
  --system-tor                          Use system-installed Tor instead of embedded
  --tor-auto-download                   Auto-download embedded Tor if not present (default: true)
  --no-tor-auto-download                Disable auto-download of embedded Tor
```

### 4. Main Application Integration

Updated `main.js` to properly read Tor configuration:

```javascript
const torConfig = appConfig.network?.tor || {};
if (torConfig.autoDownload !== false && torConfig.useEmbedded !== false) {
  // Check for embedded Tor and download if needed
}
```

### 5. System Tor Installation Guide

Created `docs/SYSTEM-TOR-INSTALLATION.md` with:
- Installation instructions for Linux, macOS, Windows
- Docker configuration
- Custom torrc examples
- Troubleshooting guide
- Security considerations

### 6. .gitignore Updates

Added entries for local application data:
```
# Local application data
.bhb/
bhb-data/
```

## Usage Examples

### Default (Embedded Tor)
```bash
# Tor is auto-downloaded on first use
npm start -- --tor
```

### System Tor
```bash
# Use locally installed Tor daemon
npm start -- --tor --system-tor
```

### Disable Auto-Download
```bash
# Skip auto-download (useful if Tor is pre-installed)
npm start -- --tor --no-tor-auto-download
```

### Configuration File
```yaml
# config.yaml
network:
  tor:
    enabled: true
    useEmbedded: true   # or useSystem: true
    autoDownload: true
```

## Test Results

All CLI argument parsing tests pass:

```
Test 1: --tor --system-tor
  network.tor.enabled: true
  network.tor.useSystem: true

Test 2: --tor --embedded-tor
  network.tor.enabled: true
  network.tor.useEmbedded: true

Test 3: --tor --no-tor-auto-download
  network.tor.enabled: true
  network.tor.autoDownload: false
```

## Module Verification

The `tor-auto-setup.js` module was verified to work correctly:

- Platform detection: linux-x64 (supported)
- Embedded Tor detection: Working (bin/tor/tor/tor found)
- Version info: Tor 0.4.8.21, Bundle 15.0.3
- Download URLs: All platforms supported

## Files Modified

1. `config/cli.js` - Added Tor CLI arguments and help categories
2. `config/defaults.js` - Added new Tor configuration options
3. `main.js` - Fixed config path for Tor settings
4. `.gitignore` - Added local data folder entries
5. `docs/SYSTEM-TOR-INSTALLATION.md` - New documentation file

## Recommendations

1. **User Experience**: Consider adding a GUI prompt for first-time Tor setup
2. **Progress Indication**: The download progress is logged to console; could be shown in UI
3. **Fallback Handling**: If embedded Tor fails, gracefully fall back to system Tor
4. **Bridge Support**: Document bridge configuration for censored regions

## Conclusion

The embedded Tor is now the default behavior when `--tor` is enabled. Users who prefer system Tor can use `--system-tor`. Auto-download functionality ensures a smooth first-run experience without requiring manual Tor installation.
