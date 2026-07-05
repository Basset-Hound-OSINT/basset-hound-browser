# Installation & Setup

Get Basset Hound Browser installed and ready to use.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git (for cloning the repository)
- **Tor** (required for Tor integration features, optional for basic use)

## Quick Install (5 minutes)

### Option 1: Local Development (npm)

```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
npm install
npm start:dev
```

Verify with:
```bash
curl http://localhost:8765/api/diagnostics
```

### Option 2: Docker Development

```bash
docker build -f Dockerfile.dev -t basset-hound:dev .
docker run -p 8765:8765 basset-hound:dev
```

Verify with:
```bash
curl http://localhost:8765/api/diagnostics
```

### Option 3: Docker Production

```bash
docker build -f Dockerfile.prod -t basset-hound:prod .
docker run -p 8765:8765 -d basset-hound:prod
```

Verify with:
```bash
curl http://localhost:8765/api/diagnostics
```

## Detailed npm Installation

### 1. Install System Dependencies

For Ubuntu/Debian:
```bash
sudo ./scripts/install/main-install.sh --all
```

Or install individual components:
```bash
sudo ./scripts/install/install-node.sh     # Node.js v20 LTS
sudo ./scripts/install/install-tor.sh      # Tor with control port
sudo ./scripts/install/install-electron-deps.sh  # Electron dependencies
sudo ./scripts/install/install-xvfb.sh     # Xvfb for headless mode
```

### 2. Install npm Dependencies

```bash
npm install
```

### 3. Start the Browser

Development (with DevTools):
```bash
npm run dev
```

Production:
```bash
npm start
```

## Tor Installation (Optional)

Tor is required for Tor integration features. The browser can run without it, but Tor-related commands will fail.

### Quick Install (Ubuntu 22.04)

```bash
sudo ./scripts/install/install-tor.sh
```

This script will:
- Add the official Tor Project repository
- Install Tor with latest stable version
- Configure ControlPort 9051 for programmatic access
- Set up SOCKS proxy on port 9050
- Start and enable Tor service

### Manual Installation

```bash
# Ubuntu/Debian
sudo apt-get install tor

# Fedora/RHEL
sudo dnf install tor

# macOS
brew install tor

# Then start Tor service
sudo systemctl start tor    # Linux
brew services start tor     # macOS
```

### Verify Tor Installation

```bash
# Check Tor is running
sudo systemctl status tor

# Test SOCKS proxy (should show Tor exit IP)
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

## Building for Distribution

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows (NSIS installer)
npm run build:mac    # macOS (DMG)
npm run build:linux  # Linux (AppImage)

# Create unpacked directory (for testing)
npm run pack
```

Build outputs go to the `dist/` directory.

## npm Commands

### Development
```bash
npm start:dev      # Development (hot reload, verbose logging)
npm run dev        # Alternative dev command
```

### Production
```bash
npm start:prod     # Production (optimized, minimal logging)
npm start          # Alternative prod command
```

### Building
```bash
npm run build:dev  # Development build
npm run build:prod # Production build
npm run build      # Build for current platform
```

## Environment Variables

### Development (.env.dev)
```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=basset-hound:*
ELECTRON_ENABLE_LOGGING=true
HOT_RELOAD=true
```

### Production (.env.prod)
```bash
NODE_ENV=production
LOG_LEVEL=error
WEBSOCKET_PORT=8765
RATE_LIMIT=true
SECURITY_STRICT=true
```

## Troubleshooting Installation

**Issue:** npm install fails with permission errors
- Solution: Check Node.js/npm installation, or use `npm install --no-optional`

**Issue:** Electron dependencies fail to install
- Solution: Install build-essential: `sudo apt-get install build-essential`

**Issue:** Tor installation fails
- Solution: Run `sudo apt-get update` first, then retry install script

**Issue:** Port 8765 already in use
- Solution: Kill process using port: `lsof -i :8765 | kill -9 $(lsof -t -i :8765)`

See [Connection Issues](../troubleshooting/CONNECTION-ISSUES.md) for more help.

---

**Next Step:** [Run Your First Command](FIRST-COMMAND.md)
