# Basset Hound Browser

A custom Electron-based browser designed for OSINT (Open Source Intelligence) and automation tasks with advanced bot detection evasion capabilities. Part of the Basset Hound OSINT toolkit.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [WebSocket API](#websocket-api)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Directory Structure](#directory-structure)
- [Version History](#version-history)
- [License](#license)

## Overview

Basset Hound Browser is a specialized web browser built on Electron that enables:

- **Automated web browsing** with programmatic control via WebSocket
- **Bot detection evasion** through comprehensive fingerprint spoofing
- **Human-like interaction simulation** for realistic browsing behavior
- **OSINT data collection** with page content extraction and screenshot capabilities

The browser is designed to blend in with regular browser traffic while providing full automation capabilities for OSINT researchers and security professionals.

## Features

### Bot Detection Evasion
- **Navigator Property Spoofing**: Overrides `webdriver`, `plugins`, `languages`, `platform`, and other detectable properties
- **WebGL Fingerprint Randomization**: Spoofs vendor and renderer strings
- **Canvas Fingerprint Noise**: Injects subtle noise into canvas operations
- **Audio Context Fingerprint Modification**: Adds noise to audio frequency data
- **Timezone Spoofing**: Randomizes timezone offset and name
- **Screen Resolution Spoofing**: Uses realistic screen configurations
- **User Agent Rotation**: Rotates through realistic, up-to-date user agents

### Human-like Behavior Simulation
- **Natural Mouse Movement**: Bezier curve-based paths with jitter and overshoot
- **Realistic Typing**: Variable speed with occasional mistakes and pauses
- **Random Scroll Patterns**: Smooth, human-like scrolling behavior
- **Variable Delays**: Configurable random delays between actions

### Tab Management
- **Multi-tab Support**: Create, switch, close, and manage multiple browser tabs
- **Tab State Tracking**: Monitor tab URLs, titles, and loading states
- **Tab Groups**: Organize tabs into logical groups for complex workflows
- **Background Tab Execution**: Run commands in non-active tabs

### Profile and Identity Management
- **Browser Profiles**: Create and switch between isolated browser profiles
- **Fingerprint Spoofing**: Each profile can have unique fingerprint characteristics
- **Persistent Sessions**: Save and restore profile states including cookies and storage
- **Identity Isolation**: Complete separation between profiles for multi-account operations

### Cookie Management
- **Cookie Import/Export**: Support for multiple formats (JSON, Netscape, browser-specific)
- **Domain Filtering**: Import/export cookies for specific domains
- **Cookie Editing**: Create, modify, and delete individual cookies
- **Session Persistence**: Save and restore cookie jars across sessions

### Download Management
- **Download Tracking**: Monitor download progress and completion
- **Custom Download Paths**: Configure per-profile download directories
- **Download Queue**: Manage multiple concurrent downloads
- **Auto-save Options**: Configure automatic download handling

### DevTools Access
- **Console Access**: Execute JavaScript and view console output
- **Network Monitoring**: Inspect network requests and responses
- **DOM Inspection**: Examine and modify page structure
- **Performance Profiling**: Analyze page performance metrics

### Network Throttling
- **Connection Simulation**: Simulate various network conditions (3G, 4G, slow connections)
- **Bandwidth Limiting**: Control upload and download speeds
- **Latency Injection**: Add artificial latency to requests
- **Offline Mode**: Simulate offline conditions for testing

### Geolocation Spoofing
- **Custom Coordinates**: Set precise latitude/longitude for geolocation APIs
- **Location Presets**: Quick selection of common locations worldwide
- **Accuracy Control**: Configure geolocation accuracy radius
- **Timezone Alignment**: Automatic timezone adjustment based on location

### Storage Manager
- **LocalStorage Access**: Read, write, and clear localStorage data
- **SessionStorage Access**: Manage sessionStorage across tabs
- **IndexedDB Browser**: Inspect and modify IndexedDB databases
- **Storage Export**: Export storage data for backup or analysis

### Page History Tracking
- **Visit History**: Track all page visits with timestamps
- **Navigation Paths**: Record navigation sequences for analysis
- **History Search**: Search through browsing history
- **History Export**: Export history data in various formats

### Ad and Tracker Blocking
- **EasyList Integration**: Built-in support for EasyList filter rules
- **Custom Block Rules**: Define custom URL patterns to block
- **Tracker Prevention**: Block known tracking domains and scripts
- **Resource Type Filtering**: Selectively block images, scripts, fonts, etc.
- **Rule Statistics**: Track blocked requests and bandwidth saved

### Automation Scripts
- **Script Library**: Save and manage reusable automation scripts
- **Script Runner**: Execute multi-step automation workflows
- **Action Recording**: Record browser interactions as executable scripts
- **Script Scheduling**: Schedule scripts to run at specific times

### DOM Inspector
- **Element Selection**: Interactive element picker with highlighting
- **Selector Generation**: Automatically generate CSS/XPath selectors
- **Element Properties**: View computed styles and attributes
- **DOM Tree Navigation**: Explore page structure hierarchically

### Proxy Support
- **Multiple Proxy Types**: HTTP, HTTPS, SOCKS4, and SOCKS5 proxy support
- **Proxy Authentication**: Username/password authentication for proxies
- **Proxy Rotation**: Automatic rotation through a list of proxies (sequential or random)
- **Request-Based Rotation**: Rotate proxy after a configurable number of requests
- **Timed Rotation**: Rotate proxy at configurable time intervals
- **Proxy Statistics**: Track success/failure rates per proxy

### User Agent Management
- **Comprehensive UA Library**: 70+ realistic user agents across 10 categories
- **Category-Based Selection**: Chrome, Firefox, Safari, Edge, mobile browsers
- **User Agent Rotation**: Automatic rotation with configurable timing
- **Custom User Agents**: Add your own user agent strings
- **UA Parsing**: Parse user agent strings to extract browser/OS information

### Request Interception
- **Resource Blocking**: Block ads, trackers, and social widgets
- **Header Modification**: Add, modify, or remove request headers
- **Predefined Rules**: Built-in blocking rules for common ad/tracker domains
- **Custom Block Rules**: Define URL patterns to block
- **Resource Type Blocking**: Block specific resource types (scripts, images, etc.)
- **Rule Import/Export**: Save and load rule configurations

### WebSocket Control Interface
- Remote browser automation via WebSocket (default port: 8765)
- Full navigation control (navigate, back, forward, refresh)
- DOM manipulation (click, fill, scroll, wait for elements)
- Content extraction (HTML, text, screenshots)
- Cookie management
- Arbitrary JavaScript execution
- Proxy management commands
- User agent control commands
- Request interception rules management

### Modern Browser UI
- Clean, dark-themed interface
- URL bar with navigation controls (back, forward, refresh, home)
- Status bar showing WebSocket connection state
- Client connection count display
- Page loading indicators

## Quick Start

```bash
# Clone the repository (if not already done)
cd basset-hound/basset-hound-browser

# Install dependencies
npm install

# Start the browser
npm start
```

Once running, connect to `ws://localhost:8765` to control the browser programmatically.

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git (for cloning the repository)
- **Tor** (required for Tor integration features)

### Development Installation

```bash
# Navigate to the browser directory
cd basset-hound-browser

# Install system dependencies (Node.js, Tor, Electron dependencies)
# For Ubuntu/Debian:
sudo ./scripts/install/main-install.sh --all

# Or install individual components:
sudo ./scripts/install/install-node.sh     # Install Node.js via nvm (v20 LTS)
sudo ./scripts/install/install-tor.sh      # Install Tor with control port
sudo ./scripts/install/install-electron-deps.sh  # Install Electron dependencies
sudo ./scripts/install/install-xvfb.sh     # Install Xvfb for headless mode

# Install npm dependencies
npm install

# Run in development mode (with DevTools)
npm run dev

# Or run in production mode
npm start
```

#### Tor Installation

Tor is required for Tor integration features (circuit management, exit node selection, onion services, etc.). The browser can run without Tor, but Tor-related commands will fail.

**Quick Install (Ubuntu 22.04)**:
```bash
sudo ./scripts/install/install-tor.sh
```

This script will:
- Add the official Tor Project repository
- Install Tor with latest stable version
- Configure ControlPort 9051 for programmatic access
- Set up SOCKS proxy on port 9050
- Start and enable Tor service

**Manual Tor Installation**:
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

**Verify Tor Installation**:
```bash
# Check Tor is running
sudo systemctl status tor

# Test SOCKS proxy (should show Tor exit IP)
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip
```

See [docs/deployment/TOR-SETUP-GUIDE.md](docs/deployment/TOR-SETUP-GUIDE.md) for detailed Tor setup on all platforms (Ubuntu, Debian, Fedora, Arch, macOS, Windows).

### Building for Distribution

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows (NSIS installer)
npm run build:mac    # macOS (DMG)
npm run build:linux  # Linux (AppImage)

# Create unpacked directory (for testing builds)
npm run pack
```

Build outputs are placed in the `dist/` directory.

## Usage

### Manual Browsing

1. Launch the browser with `npm start`
2. Enter a URL in the address bar and press Enter or click "Go"
3. Use navigation buttons to go back, forward, refresh, or return home
4. The status bar shows WebSocket connection status and current URL

### Programmatic Control

Connect to the WebSocket server at `ws://localhost:8765` to control the browser:

#### Python Example

```python
import asyncio
import json
import websockets

async def automate_browser():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate to a website
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        response = json.loads(await ws.recv())
        print(f"Navigation: {response}")

        # Wait for page load
        await asyncio.sleep(2)

        # Get page content
        await ws.send(json.dumps({
            "id": "2",
            "command": "get_content"
        }))
        response = json.loads(await ws.recv())
        print(f"Page title: {response.get('content', {}).get('title')}")

        # Take a screenshot
        await ws.send(json.dumps({
            "id": "3",
            "command": "screenshot"
        }))
        response = json.loads(await ws.recv())
        if response.get("success"):
            # Save screenshot (base64 encoded PNG)
            import base64
            img_data = response["data"].split(",")[1]
            with open("screenshot.png", "wb") as f:
                f.write(base64.b64decode(img_data))

asyncio.run(automate_browser())
```

#### Node.js Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
    // Navigate to a website
    ws.send(JSON.stringify({
        id: '1',
        command: 'navigate',
        url: 'https://example.com'
    }));
});

ws.on('message', (data) => {
    const response = JSON.parse(data);
    console.log('Response:', response);
});
```

## WebSocket API

See [docs/API.md](docs/API.md) for complete API documentation.

### Quick Reference

#### Navigation & Interaction

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `navigate` | Navigate to URL | `url` |
| `get_url` | Get current URL | - |
| `click` | Click element | `selector` |
| `fill` | Fill form field | `selector`, `value` |
| `scroll` | Scroll page | `x`, `y` or `selector` |
| `wait_for_element` | Wait for element | `selector` |
| `get_content` | Get page HTML/text | - |
| `get_page_state` | Get forms/links/buttons | - |
| `screenshot` | Capture screenshot | - |
| `execute_script` | Run JavaScript | `script` |
| `get_cookies` | Get cookies | `url` |
| `set_cookies` | Set cookies | `cookies` |
| `ping` | Health check | - |
| `status` | Get browser status | - |

#### Proxy Management

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `set_proxy` | Configure proxy | `host`, `port` |
| `clear_proxy` | Disable proxy | - |
| `get_proxy_status` | Get current proxy info | - |
| `set_proxy_list` | Set proxies for rotation | `proxies` (array) |
| `add_proxy` | Add proxy to rotation list | `host`, `port` |
| `remove_proxy` | Remove proxy from list | `host`, `port` |
| `rotate_proxy` | Switch to next proxy | - |
| `start_proxy_rotation` | Start auto-rotation | - |
| `stop_proxy_rotation` | Stop auto-rotation | - |
| `test_proxy` | Test proxy connection | `host`, `port` |
| `get_proxy_stats` | Get proxy statistics | - |
| `get_proxy_types` | List supported proxy types | - |

#### User Agent Management

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `set_user_agent` | Set specific user agent | `userAgent` or `category` |
| `get_random_user_agent` | Get random user agent | - |
| `rotate_user_agent` | Switch to next user agent | - |
| `start_user_agent_rotation` | Start auto-rotation | - |
| `stop_user_agent_rotation` | Stop auto-rotation | - |
| `set_user_agent_categories` | Set enabled categories | `categories` (array) |
| `add_custom_user_agent` | Add custom user agent | `userAgent` |
| `clear_custom_user_agents` | Clear custom user agents | - |
| `get_user_agent_status` | Get current UA status | - |
| `get_user_agent_categories` | List available categories | - |
| `parse_user_agent` | Parse UA string info | `userAgent` |

#### Request Interception

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `set_request_rules` | Set all request rules | See below |
| `clear_request_rules` | Clear all rules | - |
| `add_block_rule` | Add URL block rule | `pattern` |
| `add_allow_rule` | Add allow rule (override) | `pattern` |
| `add_header_rule` | Add header modification | `header`, `action` |
| `remove_request_rule` | Remove rule by ID | `ruleId` |
| `set_custom_headers` | Set custom headers | `headers` (object) |
| `set_headers_to_remove` | Headers to remove | `headers` (array) |
| `block_resource_type` | Block resource type | `resourceType` |
| `unblock_resource_type` | Unblock resource type | `resourceType` |
| `apply_predefined_rules` | Apply built-in rules | `category` |
| `get_request_interceptor_status` | Get interceptor status | - |
| `export_request_rules` | Export all rules | - |
| `import_request_rules` | Import rules | `rules` |
| `reset_request_stats` | Reset statistics | - |
| `get_resource_types` | List resource types | - |
| `get_predefined_categories` | List predefined categories | - |
| `enable_request_interceptor` | Enable interception | - |
| `disable_request_interceptor` | Disable interception | - |

### Proxy Usage Examples

```python
import asyncio
import json
import websockets

async def proxy_example():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Set a SOCKS5 proxy with authentication
        await ws.send(json.dumps({
            "id": "1",
            "command": "set_proxy",
            "host": "proxy.example.com",
            "port": 1080,
            "type": "socks5",
            "auth": {
                "username": "user",
                "password": "pass"
            }
        }))
        response = json.loads(await ws.recv())
        print(f"Proxy set: {response}")

        # Set up proxy rotation with multiple proxies
        await ws.send(json.dumps({
            "id": "2",
            "command": "set_proxy_list",
            "proxies": [
                {"host": "proxy1.example.com", "port": 8080, "type": "http"},
                {"host": "proxy2.example.com", "port": 8080, "type": "http"},
                {"host": "proxy3.example.com", "port": 1080, "type": "socks5"}
            ]
        }))

        # Start automatic rotation every 5 minutes
        await ws.send(json.dumps({
            "id": "3",
            "command": "start_proxy_rotation",
            "intervalMs": 300000,
            "mode": "random"
        }))

asyncio.run(proxy_example())
```

### User Agent Usage Examples

```python
async def user_agent_example():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Set a specific user agent
        await ws.send(json.dumps({
            "id": "1",
            "command": "set_user_agent",
            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
        }))

        # Or use a category to get a random UA from that category
        await ws.send(json.dumps({
            "id": "2",
            "command": "set_user_agent",
            "category": "CHROME_MAC"
        }))

        # Enable only specific categories for rotation
        await ws.send(json.dumps({
            "id": "3",
            "command": "set_user_agent_categories",
            "categories": ["CHROME_WINDOWS", "FIREFOX_WINDOWS", "EDGE_WINDOWS"]
        }))

        # Start rotation every 10 minutes
        await ws.send(json.dumps({
            "id": "4",
            "command": "start_user_agent_rotation",
            "intervalMs": 600000,
            "mode": "random"
        }))

asyncio.run(user_agent_example())
```

### Request Interception Examples

```python
async def request_interception_example():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Block ads and trackers using predefined rules
        await ws.send(json.dumps({
            "id": "1",
            "command": "apply_predefined_rules",
            "category": "ads"
        }))
        await ws.send(json.dumps({
            "id": "2",
            "command": "apply_predefined_rules",
            "category": "trackers"
        }))

        # Add custom block rule
        await ws.send(json.dumps({
            "id": "3",
            "command": "add_block_rule",
            "pattern": "*://analytics.example.com/*",
            "description": "Block example analytics"
        }))

        # Block all images to speed up loading
        await ws.send(json.dumps({
            "id": "4",
            "command": "block_resource_type",
            "resourceType": "image"
        }))

        # Add custom headers to all requests
        await ws.send(json.dumps({
            "id": "5",
            "command": "set_custom_headers",
            "headers": {
                "X-Custom-Header": "MyValue",
                "DNT": "1"
            }
        }))

        # Remove specific headers from requests
        await ws.send(json.dumps({
            "id": "6",
            "command": "set_headers_to_remove",
            "headers": ["X-Requested-With"]
        }))

        # Get current status
        await ws.send(json.dumps({
            "id": "7",
            "command": "get_request_interceptor_status"
        }))
        status = json.loads(await ws.recv())
        print(f"Blocked: {status.get('stats', {}).get('blocked', 0)} requests")

asyncio.run(request_interception_example())
```

## Configuration

### WebSocket Port

The default WebSocket port is 8765. To change it, modify `main.js`:

```javascript
wsServer = new WebSocketServer(8765, mainWindow);  // Change 8765 to desired port
```

### Viewport Size

Viewport sizes are randomized from a predefined list in `evasion/fingerprint.js`. You can modify the `VIEWPORT_SIZES` array to customize available sizes.

### User Agents

User agents are rotated from the `USER_AGENTS` array in `evasion/fingerprint.js`. Update this array to add new browser versions.

### Human Behavior Timing

Adjust typing speed, mouse movement, and delays in `evasion/humanize.js`:

```javascript
// Typing options
const options = {
    minDelay: 30,      // Minimum delay between keystrokes (ms)
    maxDelay: 150,     // Maximum delay between keystrokes (ms)
    mistakeRate: 0.02, // Probability of making a typo
    pauseChance: 0.05  // Probability of pausing while typing
};
```

## Documentation

### Core Documentation
- [Architecture Guide](docs/ARCHITECTURE.md) - Electron app structure and design
- [API Reference](docs/API.md) - Complete WebSocket API documentation
- [Evasion Techniques](docs/EVASION.md) - Bot detection evasion details
- [Development Guide](docs/DEVELOPMENT.md) - Setup, development, and contribution guide
- [Roadmap](docs/ROADMAP.md) - Project roadmap and planned features

### Feature Documentation
- [Automation Scripts](docs/AUTOMATION.md) - Automation script creation and execution
- [Content Blocking](docs/BLOCKING.md) - Ad and tracker blocking configuration
- [Cookie Management](docs/COOKIES.md) - Cookie import/export and management
- [DevTools Access](docs/DEVTOOLS.md) - Developer tools integration
- [Download Management](docs/DOWNLOADS.md) - Download handling and configuration
- [Geolocation Spoofing](docs/GEOLOCATION.md) - Location spoofing setup
- [Header Management](docs/HEADERS.md) - HTTP header manipulation
- [History Tracking](docs/HISTORY.md) - Page history and navigation tracking
- [DOM Inspector](docs/INSPECTOR.md) - Element inspection and selector generation
- [Network Throttling](docs/NETWORK-THROTTLING.md) - Network condition simulation
- [Profile Management](docs/PROFILES.md) - Browser profile and identity management
- [Storage Management](docs/STORAGE.md) - localStorage, sessionStorage, and IndexedDB
- [Tab Management](docs/TABS.md) - Multi-tab operations and management

### Additional Guides
- [Input Simulation](docs/input-simulation.md) - Mouse and keyboard simulation details
- [Screenshots and Recording](docs/screenshots-and-recording.md) - Capture and recording features
- [Integration Testing](docs/INTEGRATION-TESTING.md) - Testing framework and guidelines
- [Testing Guide](docs/TESTING.md) - Unit and integration test documentation

### Project Continuity
- [TMP.md](TMP.md) - Project continuity file for developers containing current state, recent changes, and next steps

## Security Considerations

### Intended Use

This tool is designed for:
- Legitimate OSINT research
- Security testing (with authorization)
- Web scraping (where permitted by ToS)
- Automated testing of web applications

### Best Practices

1. **Authorization**: Always obtain proper authorization before automated data collection
2. **Rate Limiting**: Respect rate limits and implement delays between requests
3. **Terms of Service**: Review and comply with target website terms of service
4. **Data Protection**: Handle collected data in accordance with privacy regulations
5. **Network Security**: The WebSocket server binds to localhost by default; do not expose to untrusted networks

### Certificate Handling

The browser accepts self-signed certificates to enable OSINT on sites with certificate issues. This is intentional for research purposes but should be understood as a security trade-off.

## Troubleshooting

### WebSocket Connection Failed

**Symptom**: Unable to connect to `ws://localhost:8765`

**Solutions**:
1. Ensure the browser is running
2. Check if port 8765 is in use: `lsof -i :8765` (Linux/macOS) or `netstat -ano | findstr :8765` (Windows)
3. Check firewall settings
4. Try a different port

### Bot Detection Still Triggered

**Symptom**: Websites still detect automation

**Solutions**:
1. Add more random delays between actions
2. Include random mouse movements and scrolls
3. Adjust timing parameters in `humanize.js`
4. Try different user agents
5. Consider implementing more sophisticated evasion techniques

### Page Not Loading

**Symptom**: Blank page or loading errors

**Solutions**:
1. Check the URL is correct and accessible
2. Check browser console for errors (use `npm run dev`)
3. Some sites block Electron; try changing user agent
4. Check network connectivity

### High Memory Usage

**Symptom**: Browser consumes excessive RAM

**Solutions**:
1. Clear browsing data periodically
2. Navigate to `about:blank` when idle
3. Restart the browser between long sessions

### Build Failures

**Symptom**: `npm run build` fails

**Solutions**:
1. Ensure all dependencies are installed: `npm install`
2. For Windows builds on Linux/macOS, you may need Wine
3. Check electron-builder documentation for platform-specific requirements

## Directory Structure

```
basset-hound-browser/
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main process
│   │   └── preload.js       # Preload script with IPC bridge
│   └── renderer/
│       ├── index.html       # Browser UI
│       ├── index_main.js    # Renderer process logic
│       └── index_styles.css # UI styles
├── package.json             # Project configuration
├── README.md                # This file
├── TMP.md                   # Project continuity file for developers
│
├── automation/              # Automation script management
│   ├── runner.js            # Script execution engine
│   ├── scripts.js           # Script definitions and library
│   └── storage.js           # Script persistence
│
├── blocking/                # Ad and tracker blocking
│   ├── manager.js           # Block rule management
│   └── filters.js           # EasyList and custom filters
│
├── cookies/                 # Cookie management
│   └── manager.js           # Cookie import/export and manipulation
│
├── devtools/                # Developer tools integration
│   ├── manager.js           # DevTools window management
│   └── console.js           # Console access and logging
│
├── docs/                    # Documentation (see Documentation section)
│
├── downloads/               # Download management
│   └── manager.js           # Download tracking and configuration
│
├── evasion/                 # Bot detection evasion
│   ├── fingerprint.js       # Anti-fingerprinting module
│   └── humanize.js          # Human behavior simulation
│
├── extensions/              # Browser extension support
│
├── geolocation/             # Geolocation spoofing
│   ├── manager.js           # Location spoofing control
│   └── presets.js           # Predefined location presets
│
├── headers/                 # HTTP header management
│   ├── manager.js           # Header modification
│   └── profiles.js          # Header presets
│
├── history/                 # Page history tracking
│   ├── manager.js           # History management
│   └── storage.js           # History persistence
│
├── input/                   # Input simulation
│   ├── index.js             # Input module entry point
│   ├── keyboard.js          # Keyboard simulation
│   └── mouse.js             # Mouse movement simulation
│
├── inspector/               # DOM inspection tools
│   ├── manager.js           # Inspector management
│   ├── highlighter.js       # Element highlighting
│   └── selector-generator.js # CSS/XPath selector generation
│
├── network/                 # Network control
│   └── throttling.js        # Network throttling simulation
│
├── profiles/                # Browser profile management
│   ├── manager.js           # Profile creation and switching
│   └── storage.js           # Profile persistence
│
├── proxy/                   # Proxy management
│   └── manager.js           # Proxy rotation and configuration
│
├── recording/               # Session recording
│   └── manager.js           # Action recording and playback
│
├── renderer/                # Legacy renderer (see src/renderer)
│   ├── index.html
│   └── renderer.js
│
├── screenshots/             # Screenshot capture
│   └── manager.js           # Screenshot management
│
├── sessions/                # Session management
│   └── manager.js           # Session persistence
│
├── storage/                 # Browser storage management
│   └── manager.js           # localStorage, sessionStorage, IndexedDB
│
├── tabs/                    # Tab management
│   └── manager.js           # Multi-tab operations
│
├── tests/                   # Test suites
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
│
├── utils/                   # Utility modules
│   ├── user-agents.js       # User agent management
│   └── request-interceptor.js # Request interception and blocking
│
└── websocket/               # WebSocket API
    └── server.js            # WebSocket server for remote control
```

## Version History

### December 2024 - Advanced Features Release
Major feature expansion adding comprehensive browser automation and OSINT capabilities:

- **Tab Management**: Full multi-tab support with tab groups, background execution, and state tracking
- **Profile/Identity Management**: Isolated browser profiles with unique fingerprints for multi-account operations
- **Cookie Management**: Import/export in multiple formats (JSON, Netscape, browser-specific) with domain filtering
- **Download Management**: Download tracking, queue management, and per-profile download paths
- **DevTools Access**: Programmatic access to developer tools, console, and network inspection
- **Network Throttling**: Simulate various network conditions (3G, 4G, slow connections, offline mode)
- **Geolocation Spoofing**: Custom coordinates with location presets and automatic timezone alignment
- **Storage Manager**: Full access to localStorage, sessionStorage, and IndexedDB
- **Page History Tracking**: Complete navigation history with search and export capabilities
- **Ad/Tracker Blocking**: EasyList integration with custom rules and resource type filtering
- **Automation Scripts**: Script library, runner, action recording, and scheduling
- **DOM Inspector**: Interactive element picker with CSS/XPath selector generation
- **Header Management**: HTTP header modification with preset profiles
- **Input Simulation**: Enhanced mouse and keyboard simulation modules

### Initial Release
- Core browser functionality with WebSocket control interface
- Bot detection evasion (fingerprint spoofing, canvas noise, WebGL randomization)
- Human-like behavior simulation (mouse movement, typing, scrolling)
- Proxy support with rotation and authentication
- User agent management with comprehensive UA library
- Request interception with predefined blocking rules
- Modern dark-themed UI with navigation controls

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for development setup and contribution guidelines.
