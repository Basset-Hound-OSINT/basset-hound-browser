# Basset Hound Browser - Installation Guide

Complete installation guide for setting up Basset Hound Browser on Linux, macOS, and Windows.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Install](#quick-install)
- [Detailed Installation](#detailed-installation)
  - [Linux (Ubuntu/Debian)](#linux-ubuntudebian)
  - [Linux (Fedora/RHEL)](#linux-fedorarhel)
  - [macOS](#macos)
  - [Windows](#windows)
- [Docker Installation](#docker-installation)
- [Verifying Installation](#verifying-installation)
- [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Linux (Ubuntu 18.04+), macOS 10.15+, Windows 10+ |
| RAM | 4 GB |
| Disk Space | 500 MB |
| Node.js | 18.x or higher (20.x recommended) |
| npm | 9.x or higher |

### Recommended Requirements

| Component | Requirement |
|-----------|-------------|
| RAM | 8 GB |
| Disk Space | 1 GB |
| Node.js | 20.x LTS |
| Display | 1920x1080 for GUI mode |

### For Headless Mode (Linux)

| Component | Purpose |
|-----------|---------|
| Xvfb | Virtual framebuffer for headless operation |
| libgtk-3-0 | GTK3 libraries for Electron |
| libnss3 | Network Security Services |
| libasound2 | ALSA sound library |

---

## Quick Install

```bash
# Clone the repository
git clone <repository-url>
cd basset-hound-browser

# Install Node.js 20.x (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc  # or ~/.zshrc
nvm install 20
nvm use 20

# Install dependencies
npm install

# Run the browser
npm start
```

---

## Detailed Installation

### Linux (Ubuntu/Debian)

#### 1. Install System Dependencies

```bash
# Update package list
sudo apt-get update

# Install required system packages
sudo apt-get install -y \
    build-essential \
    libgtk-3-0 \
    libnotify-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb \
    libgbm1 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2
```

#### 2. Install Node.js via nvm (Recommended)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm (restart terminal or run:)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20.x LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

#### 3. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd basset-hound-browser

# Install npm dependencies
npm install

# Run tests to verify
npm test
```

#### 4. Run the Browser

```bash
# Standard mode (with GUI)
npm start

# Development mode (with DevTools)
npm run dev

# Headless mode (no GUI)
npm start -- --headless
```

### Linux (Fedora/RHEL)

```bash
# Install system dependencies
sudo dnf install -y \
    gcc-c++ \
    make \
    gtk3 \
    nss \
    alsa-lib \
    libXScrnSaver \
    libXtst \
    xorg-x11-server-Xvfb \
    libdrm \
    libgbm \
    atk \
    at-spi2-atk

# Continue with Node.js installation (same as Ubuntu)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Clone and install
git clone <repository-url>
cd basset-hound-browser
npm install
```

### macOS

#### 1. Install Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. Install Node.js

```bash
# Option A: Using Homebrew
brew install node@20

# Option B: Using nvm (Recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc  # or ~/.bash_profile
nvm install 20
nvm use 20
```

#### 3. Clone and Install

```bash
git clone <repository-url>
cd basset-hound-browser
npm install
npm start
```

### Windows

#### 1. Install Node.js

Download and install from: https://nodejs.org/en/download/

Or using Chocolatey:
```powershell
choco install nodejs-lts
```

Or using winget:
```powershell
winget install OpenJS.NodeJS.LTS
```

#### 2. Install Build Tools

```powershell
# Run as Administrator
npm install --global windows-build-tools
```

#### 3. Clone and Install

```powershell
git clone <repository-url>
cd basset-hound-browser
npm install
npm start
```

---

## Docker Installation

### Using Dockerfile

```bash
# Build the image
docker build -t basset-hound-browser .

# Run in headless mode
docker run -d --name basset-browser \
    -p 8765:8765 \
    basset-hound-browser

# Run with display (Linux with X11)
docker run -d --name basset-browser \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -p 8765:8765 \
    basset-hound-browser
```

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Verifying Installation

### 1. Run Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- tests/unit/websocket-server.test.js

# Run tests with coverage
npm test -- --coverage
```

### 2. Start the Browser

```bash
# Start in standard mode
npm start

# Verify WebSocket server is running
curl -s http://localhost:8765 || echo "WebSocket server is running on port 8765"
```

### 3. Test WebSocket Connection

```javascript
// test-connection.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
    console.log('Connected to Basset Hound Browser');
    ws.send(JSON.stringify({ id: '1', command: 'get_status' }));
});

ws.on('message', (data) => {
    console.log('Response:', JSON.parse(data));
    ws.close();
});
```

```bash
node test-connection.js
```

### 4. Python Client Test

```python
# test-client.py
import asyncio
import websockets
import json

async def test():
    async with websockets.connect('ws://localhost:8765') as ws:
        await ws.send(json.dumps({'id': '1', 'command': 'get_status'}))
        response = await ws.recv()
        print('Status:', json.loads(response))

asyncio.run(test())
```

```bash
pip install websockets
python test-client.py
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| BASSET_WS_PORT | 8765 | WebSocket server port |
| BASSET_WS_HOST | 0.0.0.0 | WebSocket server host |
| BASSET_WS_AUTH_TOKEN | - | Authentication token |
| BASSET_WS_SSL_CERT | - | Path to SSL certificate |
| BASSET_WS_SSL_KEY | - | Path to SSL private key |
| BASSET_HEADLESS | false | Enable headless mode |
| BASSET_LOG_LEVEL | info | Logging level (trace,debug,info,warn,error,fatal) |
| BASSET_CONFIG_FILE | - | Path to YAML/JSON config file |

### Configuration File

Create `basset.yaml` in the project root:

```yaml
server:
  port: 8765
  host: 0.0.0.0
  auth:
    enabled: false
    token: null

browser:
  headless: false
  userDataDir: ./user-data
  defaultViewport:
    width: 1920
    height: 1080

evasion:
  enabled: true
  fingerprint: true
  humanize: true

logging:
  level: info
  file: ./logs/basset.log
  console: true
```

---

## Troubleshooting

### Common Issues

#### Error: `EACCES: permission denied`

```bash
# Fix npm permissions
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Error: `Cannot find module 'electron'`

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### Error: `No display available` (Linux)

```bash
# Install and start Xvfb
sudo apt-get install xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Or run with xvfb-run
xvfb-run npm start
```

#### Error: `libnss3.so: cannot open shared object file`

```bash
# Install missing libraries
sudo apt-get install libnss3 libnss3-tools
```

#### Error: `electron.gpu process isn't usable`

```bash
# Disable GPU acceleration
npm start -- --disable-gpu
```

### Getting Help

- Check [docs/DEVELOPMENT.md](DEVELOPMENT.md) for development setup
- Check [docs/API.md](API.md) for WebSocket API reference
- Open an issue on GitHub for bugs

---

## Updating

```bash
# Pull latest changes
git pull

# Update dependencies
npm install

# Run tests to verify
npm test
```

---

## Uninstalling

```bash
# Remove project directory
rm -rf basset-hound-browser

# Remove nvm (optional)
rm -rf ~/.nvm

# Remove from ~/.bashrc or ~/.zshrc:
# export NVM_DIR="$HOME/.nvm"
# [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

---

*Last Updated: December 2024*
