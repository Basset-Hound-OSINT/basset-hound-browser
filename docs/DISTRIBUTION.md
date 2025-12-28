# Basset Hound Browser - Distribution Guide

This guide covers building, packaging, and distributing Basset Hound Browser for Windows, macOS, and Linux.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building from Source](#building-from-source)
3. [Platform-Specific Builds](#platform-specific-builds)
4. [Docker Deployment](#docker-deployment)
5. [Continuous Integration](#continuous-integration)
6. [Release Process](#release-process)

---

## Prerequisites

### Development Environment

Before building, ensure you have:

```bash
# Install all dependencies
./scripts/install/main-install.sh --all

# Or manually:
# 1. Node.js 18+ (via nvm recommended)
# 2. npm 8+
# 3. git
# 4. Platform-specific build tools (see below)
```

### Platform-Specific Requirements

**Windows:**
- Visual Studio Build Tools 2019+ (or full Visual Studio)
- Windows 10 SDK

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- Apple Developer certificate (for signing)

**Linux:**
- Build essentials: `sudo apt-get install build-essential`
- Additional: `rpm` for RPM builds, `fakeroot` for DEB builds

### Icon Generation

Icons must be generated before building:

```bash
# If ImageMagick is installed
cd assets
./generate-icons.sh

# Or use electron-icon-builder
npm install -g electron-icon-builder
electron-icon-builder --input=assets/icon.svg --output=assets/
```

Required icon files:
- `assets/icon.ico` - Windows (multi-resolution ICO)
- `assets/icon.icns` - macOS (Apple Icon Image)
- `assets/icon.png` - Linux (512x512 PNG)

---

## Building from Source

### Quick Build

```bash
# Install dependencies
npm install

# Build for current platform
npm run build

# Build for specific platform
npm run build:linux
npm run build:mac
npm run build:win
```

### Build Output

All build artifacts are placed in the `dist/` directory:

```
dist/
├── Basset Hound Browser-1.0.0-linux-x64.AppImage
├── Basset Hound Browser-1.0.0-linux-x64.deb
├── Basset Hound Browser-1.0.0-linux-x64.rpm
├── Basset Hound Browser-1.0.0-linux-x64.tar.gz
├── Basset Hound Browser-1.0.0-mac-x64.dmg
├── Basset Hound Browser-1.0.0-mac-x64.zip
├── Basset Hound Browser-1.0.0-win-x64.exe
├── Basset Hound Browser-1.0.0-win-portable-x64.exe
└── ...
```

### Development Build (Unpacked)

For testing without creating installers:

```bash
npm run pack
# Creates unpacked app in dist/linux-unpacked/, dist/mac/, or dist/win-unpacked/
```

---

## Platform-Specific Builds

### Linux

**Supported Formats:**
- AppImage (portable, no installation needed)
- DEB (Debian/Ubuntu)
- RPM (Fedora/RHEL/CentOS)
- tar.gz (portable archive)

```bash
# Build all Linux formats
npm run build:linux

# The AppImage is recommended for most users
./dist/Basset\ Hound\ Browser-1.0.0-x64.AppImage
```

**AppImage Usage:**
```bash
chmod +x Basset\ Hound\ Browser-*.AppImage
./Basset\ Hound\ Browser-*.AppImage
```

**DEB Installation:**
```bash
sudo dpkg -i dist/basset-hound-browser_1.0.0_amd64.deb
sudo apt-get install -f  # Fix any dependency issues
```

**RPM Installation:**
```bash
sudo rpm -i dist/basset-hound-browser-1.0.0.x86_64.rpm
# Or with dnf
sudo dnf install dist/basset-hound-browser-1.0.0.x86_64.rpm
```

### macOS

**Supported Formats:**
- DMG (disk image with drag-to-Applications)
- ZIP (portable archive)

```bash
# Build for macOS (requires macOS or cross-compilation)
npm run build:mac
```

**Architecture Support:**
- x64 (Intel Macs)
- arm64 (Apple Silicon M1/M2/M3)

**Code Signing (Production):**

For distribution outside the App Store, you need:
1. Apple Developer ID certificate
2. Notarization with Apple

```bash
# Set environment variables
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your-password
export APPLE_ID=your-apple-id
export APPLE_APP_SPECIFIC_PASSWORD=app-specific-password

npm run build:mac
```

### Windows

**Supported Formats:**
- NSIS installer (.exe with installation wizard)
- Portable (.exe, no installation)

```bash
# Build for Windows (requires Windows or Wine on Linux)
npm run build:win
```

**Architecture Support:**
- x64 (64-bit)
- ia32 (32-bit, NSIS only)

**Code Signing (Production):**

For trusted installers, you need a code signing certificate:

```bash
# Set environment variables
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your-password

npm run build:win
```

---

## Docker Deployment

For headless server deployments, use Docker:

### Quick Start

```bash
# Build Docker image
docker build -t basset-hound-browser .

# Run container
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  -v ./downloads:/app/downloads \
  -v ./screenshots:/app/screenshots \
  basset-hound-browser
```

### Docker Compose

```bash
# Start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Docker Configuration

Environment variables in docker-compose.yml:

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY` | `:99` | X11 display for Xvfb |
| `SCREEN_RESOLUTION` | `1920x1080x24` | Virtual screen resolution |
| `ELECTRON_DISABLE_GPU` | `true` | Disable GPU acceleration |
| `BASSET_WS_PORT` | `8765` | WebSocket server port |

### Resource Limits

Recommended container resources:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build:linux
      - uses: actions/upload-artifact@v3
        with:
          name: linux-builds
          path: dist/*.AppImage

  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build:mac
      - uses: actions/upload-artifact@v3
        with:
          name: mac-builds
          path: dist/*.dmg

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build:win
      - uses: actions/upload-artifact@v3
        with:
          name: windows-builds
          path: dist/*.exe
```

---

## Release Process

### Version Update

1. Update version in `package.json`:
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. Update ROADMAP.md version history

3. Create git tag:
   ```bash
   git tag -a v1.0.1 -m "Release 1.0.1"
   git push origin v1.0.1
   ```

### Release Checklist

- [ ] All tests passing (`npm test`)
- [ ] Version updated in package.json
- [ ] ROADMAP.md updated
- [ ] Icons generated for all platforms
- [ ] Build successful for all target platforms
- [ ] Code signed (production releases)
- [ ] Release notes written
- [ ] GitHub release created with artifacts

### Distribution Channels

1. **GitHub Releases** - Attach build artifacts
2. **Docker Hub** - Push container image
3. **Package Managers** (future):
   - Homebrew (macOS)
   - Chocolatey (Windows)
   - Snap/Flatpak (Linux)

---

## Build Configuration Reference

The build configuration is in `package.json` under the `"build"` key:

### Key Options

| Option | Description |
|--------|-------------|
| `appId` | Unique application identifier |
| `productName` | Display name of the application |
| `directories.output` | Build output directory |
| `files` | Files to include in the build |
| `extraResources` | Additional files to bundle |

### Platform Options

**Windows (win):**
- `target`: NSIS, portable, MSI
- `icon`: Path to .ico file
- `publisherName`: Publisher name for installer

**macOS (mac):**
- `target`: DMG, ZIP, PKG
- `icon`: Path to .icns file
- `category`: App Store category
- `hardenedRuntime`: Enable hardened runtime

**Linux (linux):**
- `target`: AppImage, DEB, RPM, tar.gz
- `icon`: Path to .png file
- `category`: Desktop category
- `maintainer`: Package maintainer

---

## Troubleshooting

### Common Issues

**Build fails with "icon not found":**
```bash
# Generate icons first
cd assets && ./generate-icons.sh
```

**Linux build fails with "rpm not found":**
```bash
sudo apt-get install rpm
```

**macOS notarization fails:**
- Ensure Apple Developer ID is valid
- Check entitlements file exists
- Verify hardened runtime is enabled

**Windows build fails on Linux:**
```bash
# Install Wine for cross-compilation
sudo apt-get install wine
```

### Getting Help

- GitHub Issues: Report bugs and request features
- Documentation: Check docs/ directory
- Logs: Check build output for detailed errors

---

## Security Considerations

### Code Signing

Always sign production releases:
- **Windows**: EV Code Signing Certificate recommended
- **macOS**: Apple Developer ID + Notarization required
- **Linux**: GPG signatures for packages

### Secure Defaults

The built application includes:
- Sandboxed renderer process
- Context isolation enabled
- Node integration disabled in renderer
- WebSocket authentication available

### Update Security

When implementing auto-updates:
- Use HTTPS for update server
- Sign update packages
- Verify signatures before applying
- Consider delta updates for efficiency

---

*Last Updated: December 2024*
