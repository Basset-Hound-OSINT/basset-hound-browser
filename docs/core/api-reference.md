# Basset Hound Browser - WebSocket API Reference

Complete documentation for the WebSocket API that enables programmatic control of the Basset Hound Browser.

## Table of Contents

- [Connection](#connection)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Message Format](#message-format)
- [Response Format](#response-format)
- [Commands Reference](#commands-reference)
  - [Navigation](#navigation)
  - [DOM Manipulation](#dom-manipulation)
  - [Content Extraction](#content-extraction)
  - [Technology Detection](#technology-detection) *(New in v4.0)*
  - [Advanced Content Extraction](#advanced-content-extraction) *(New in v4.0)*
  - [Network Analysis](#network-analysis) *(New in v4.0)*
  - [Script Execution](#script-execution)
  - [Cookie Management](#cookie-management)
  - [Utility Commands](#utility-commands)
- [Error Handling](#error-handling)
- [Client Examples](#client-examples)
- [Best Practices](#best-practices)

## Connection

### WebSocket Endpoint

```
ws://localhost:8765   # Unencrypted connection
wss://localhost:8765  # SSL/TLS encrypted connection (when SSL is enabled)
```

The WebSocket server starts automatically when the browser launches and listens on port 8765 by default. For secure connections, see [SSL/TLS Configuration](#ssltls-configuration) to enable `wss://` support.

### Authentication

The WebSocket server supports optional token-based authentication. When authentication is enabled (via `BASSET_WS_TOKEN` environment variable or constructor option), clients must authenticate before executing commands.

#### Authentication Methods

1. **Query Parameter** - Pass token in the connection URL:
   ```
   ws://localhost:8765?token=your-secret-token
   ```

2. **Authorization Header** - Pass token in the HTTP header:
   ```
   Authorization: Bearer your-secret-token
   ```

3. **Authenticate Command** - Send auth command after connecting:
   ```json
   {
     "id": "1",
     "command": "authenticate",
     "token": "your-secret-token"
   }
   ```

#### Setting Up Authentication

Set the `BASSET_WS_TOKEN` environment variable before starting the browser:

```bash
BASSET_WS_TOKEN=my-secure-token npm start
```

Or pass it in code when initializing the WebSocket server:

```javascript
const wsServer = new WebSocketServer(8765, mainWindow, {
  authToken: 'my-secure-token',
  requireAuth: true
});
```

### Connection Events

Upon successful connection, the server sends a status message:

```json
{
  "type": "status",
  "message": "connected",
  "clientId": "client-1703123456789-abc123def",
  "authenticated": true,
  "authRequired": false
}
```

### Heartbeat / Keepalive

The server implements automatic heartbeat monitoring to detect dead connections:

- **Ping Interval**: 30 seconds (configurable via `heartbeatInterval` option)
- **Timeout**: 60 seconds (configurable via `heartbeatTimeout` option)
- Clients that don't respond to ping within the timeout are automatically disconnected
- Standard WebSocket ping/pong frames are used (handled automatically by WebSocket libraries)

### Connection Example (JavaScript)

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected to Basset Hound Browser');
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Received:', response);
});

ws.on('close', () => {
  console.log('Disconnected');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Connection with Auto-Reconnect (JavaScript)

```javascript
const WebSocket = require('ws');

class ResilientWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectAttempts = 0;
    this.ws = null;
    this.messageHandlers = [];
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('Connected to Basset Hound Browser');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      const response = JSON.parse(data);
      this.messageHandlers.forEach(handler => handler(response));
    });

    this.ws.on('close', () => {
      console.log('Disconnected, attempting reconnect...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  send(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      console.error('WebSocket not connected');
    }
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }
}

// Usage
const client = new ResilientWebSocket('ws://localhost:8765');
client.onMessage((response) => console.log('Received:', response));
client.send({ id: '1', command: 'ping' });
```

### Connection Example (Python)

```python
import asyncio
import websockets
import json

async def connect():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Connection established
        response = await ws.recv()
        print(f"Connected: {response}")

        # Send commands here
        await ws.send(json.dumps({"command": "ping"}))
        response = await ws.recv()
        print(f"Response: {response}")

asyncio.run(connect())
```

### Connection with Auto-Reconnect (Python)

```python
import asyncio
import websockets
import json
from typing import Callable, Optional

class ResilientWebSocket:
    def __init__(
        self,
        url: str,
        reconnect_interval: float = 3.0,
        max_reconnect_attempts: int = 10,
        auth_token: Optional[str] = None
    ):
        self.url = url
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self.auth_token = auth_token
        self.ws = None
        self.reconnect_attempts = 0
        self.message_handlers = []
        self._running = False

    async def connect(self):
        self._running = True
        while self._running and self.reconnect_attempts < self.max_reconnect_attempts:
            try:
                # Add token to URL if provided
                url = f"{self.url}?token={self.auth_token}" if self.auth_token else self.url
                async with websockets.connect(url) as ws:
                    self.ws = ws
                    self.reconnect_attempts = 0
                    print("Connected to Basset Hound Browser")

                    async for message in ws:
                        response = json.loads(message)
                        for handler in self.message_handlers:
                            await handler(response)

            except websockets.ConnectionClosed:
                print("Connection closed, reconnecting...")
            except Exception as e:
                print(f"Connection error: {e}")

            if self._running:
                self.reconnect_attempts += 1
                print(f"Reconnect attempt {self.reconnect_attempts}/{self.max_reconnect_attempts}")
                await asyncio.sleep(self.reconnect_interval)

        if self.reconnect_attempts >= self.max_reconnect_attempts:
            print("Max reconnect attempts reached")

    async def send(self, command: dict):
        if self.ws:
            await self.ws.send(json.dumps(command))

    def on_message(self, handler: Callable):
        self.message_handlers.append(handler)

    def close(self):
        self._running = False

# Usage
async def main():
    client = ResilientWebSocket(
        'ws://localhost:8765',
        auth_token='your-token-here'
    )

    async def handle_message(response):
        print(f"Received: {response}")

    client.on_message(handle_message)

    # Run in background
    asyncio.create_task(client.connect())

    # Send commands
    await asyncio.sleep(1)  # Wait for connection
    await client.send({"id": "1", "command": "ping"})

    # Keep running
    await asyncio.sleep(10)
    client.close()

asyncio.run(main())
```

## SSL/TLS Configuration

Enable secure WebSocket connections (`wss://`) for encrypted communication between clients and the Basset Hound Browser.

### Environment Variables

Configure SSL/TLS by setting the following environment variables before starting the browser:

| Variable | Required | Description |
|----------|----------|-------------|
| `BASSET_WS_SSL_ENABLED` | Yes | Set to `true` to enable SSL/TLS |
| `BASSET_WS_SSL_CERT` | Yes | Path to the SSL certificate file (PEM format) |
| `BASSET_WS_SSL_KEY` | Yes | Path to the SSL private key file (PEM format) |
| `BASSET_WS_SSL_CA` | No | Path to the CA certificate file (PEM format) for client verification |

**Example:**

```bash
export BASSET_WS_SSL_ENABLED=true
export BASSET_WS_SSL_CERT=/path/to/cert.pem
export BASSET_WS_SSL_KEY=/path/to/key.pem
export BASSET_WS_SSL_CA=/path/to/ca.pem  # Optional: for mutual TLS

npm start
```

Or as a single command:

```bash
BASSET_WS_SSL_ENABLED=true \
BASSET_WS_SSL_CERT=/path/to/cert.pem \
BASSET_WS_SSL_KEY=/path/to/key.pem \
npm start
```

### Connection Examples with SSL/TLS

#### JavaScript (Node.js)

```javascript
const WebSocket = require('ws');

// Basic wss:// connection
const ws = new WebSocket('wss://localhost:8765');

ws.on('open', () => {
  console.log('Secure connection established');
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Received:', response);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

**With custom SSL options (e.g., self-signed certificates):**

```javascript
const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');

// For self-signed certificates in development
const ws = new WebSocket('wss://localhost:8765', {
  rejectUnauthorized: false  // WARNING: Only use in development!
});

// For production with custom CA
const ws = new WebSocket('wss://localhost:8765', {
  ca: fs.readFileSync('/path/to/ca.pem')
});
```

#### Python

```python
import asyncio
import websockets
import ssl
import json

async def connect_secure():
    # Create SSL context
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    # For production: load CA certificate
    ssl_context.load_verify_locations('/path/to/ca.pem')

    async with websockets.connect(
        "wss://localhost:8765",
        ssl=ssl_context
    ) as ws:
        response = await ws.recv()
        print(f"Connected: {response}")

        await ws.send(json.dumps({"command": "ping"}))
        response = await ws.recv()
        print(f"Response: {response}")

asyncio.run(connect_secure())
```

**With self-signed certificates (development only):**

```python
import asyncio
import websockets
import ssl
import json

async def connect_self_signed():
    # WARNING: Only use in development!
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    async with websockets.connect(
        "wss://localhost:8765",
        ssl=ssl_context
    ) as ws:
        response = await ws.recv()
        print(f"Connected: {response}")

asyncio.run(connect_self_signed())
```

**Note:** Disabling certificate verification (`rejectUnauthorized: false` in Node.js or `verify_mode = ssl.CERT_NONE` in Python) should only be used in development environments. Always use properly signed certificates in production.

### Generating Self-Signed Certificates

For development and testing, you can generate self-signed certificates using OpenSSL or the built-in generator.

#### Using OpenSSL

Generate a self-signed certificate valid for 365 days:

```bash
# Generate private key
openssl genrsa -out key.pem 2048

# Generate self-signed certificate
openssl req -new -x509 -key key.pem -out cert.pem -days 365 \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

For a certificate with Subject Alternative Names (recommended for modern browsers):

```bash
# Create a config file for SAN
cat > openssl.cnf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = Organization
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
EOF

# Generate key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem -config openssl.cnf
```

#### Using the Built-in Generator

The Basset Hound Browser includes a utility to generate development certificates:

```javascript
const { generateDevCertificates } = require('basset-hound-browser/utils/ssl');

// Generate certificates in the default location (~/.basset-hound/certs/)
await generateDevCertificates();

// Or specify a custom output directory
await generateDevCertificates({
  outputDir: '/path/to/certs',
  commonName: 'localhost',
  validDays: 365
});
```

This creates `cert.pem` and `key.pem` files that can be used with the `BASSET_WS_SSL_CERT` and `BASSET_WS_SSL_KEY` environment variables.

### Production Considerations

#### Using Let's Encrypt or CA-Signed Certificates

For production deployments, use certificates from a trusted Certificate Authority:

**Let's Encrypt with Certbot:**

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate (requires domain ownership)
sudo certbot certonly --standalone -d your-domain.com

# Certificates are stored in:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem (certificate)
# /etc/letsencrypt/live/your-domain.com/privkey.pem (private key)

# Start browser with Let's Encrypt certificates
BASSET_WS_SSL_ENABLED=true \
BASSET_WS_SSL_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
BASSET_WS_SSL_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem \
npm start
```

#### Certificate Renewal

Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e
# Add this line:
0 0 1 * * certbot renew --quiet && systemctl restart basset-hound
```

For other CA providers, follow their renewal procedures and ensure the browser is restarted after certificate updates.

#### Security Best Practices

1. **Protect Private Keys**
   - Store private keys with restrictive permissions (`chmod 600 key.pem`)
   - Never commit private keys to version control
   - Use environment variables or secrets management for key paths

2. **Use Strong Cipher Suites**
   - The server defaults to secure TLS 1.2+ cipher suites
   - Avoid deprecated protocols (SSLv3, TLS 1.0, TLS 1.1)

3. **Enable Certificate Verification**
   - Always verify certificates in production
   - Never use `rejectUnauthorized: false` or `verify_mode = ssl.CERT_NONE` in production

4. **Consider Mutual TLS (mTLS)**
   - For high-security environments, require client certificates:
   ```bash
   BASSET_WS_SSL_ENABLED=true \
   BASSET_WS_SSL_CERT=/path/to/cert.pem \
   BASSET_WS_SSL_KEY=/path/to/key.pem \
   BASSET_WS_SSL_CA=/path/to/client-ca.pem \
   npm start
   ```

5. **Monitor Certificate Expiration**
   - Set up alerts for certificate expiration
   - Automate renewal where possible

6. **Use Appropriate Key Sizes**
   - Minimum 2048-bit RSA keys
   - Consider 4096-bit for higher security requirements
   - ECDSA keys (P-256 or P-384) are also supported

## Message Format

### Request Structure

All commands must be sent as JSON objects with the following structure:

```json
{
  "id": "unique-request-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Recommended | Unique identifier to correlate request with response |
| `command` | string | **Yes** | The command to execute |
| `...params` | any | Varies | Command-specific parameters |

### Request ID

While optional, providing a unique `id` allows you to match responses to requests, especially when sending multiple commands:

```json
{
  "id": "nav-001",
  "command": "navigate",
  "url": "https://example.com"
}
```

Response will include the same `id`:

```json
{
  "id": "nav-001",
  "command": "navigate",
  "success": true,
  "url": "https://example.com"
}
```

## Response Format

### Success Response

```json
{
  "id": "request-id",
  "command": "command_name",
  "success": true,
  ...additional_data
}
```

### Error Response

```json
{
  "id": "request-id",
  "command": "command_name",
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Commands Reference

### Navigation

#### navigate

Navigate the browser to a specified URL.

**Request:**
```json
{
  "id": "1",
  "command": "navigate",
  "url": "https://example.com"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The URL to navigate to |

**Response:**
```json
{
  "id": "1",
  "command": "navigate",
  "success": true,
  "url": "https://example.com"
}
```

**Notes:**
- Navigation includes a human-like delay (100-300ms) before executing
- The response is sent after a 1-second delay to allow initial page load
- For full page load confirmation, use `wait_for_element` after navigation

---

#### get_url

Get the current page URL.

**Request:**
```json
{
  "id": "2",
  "command": "get_url"
}
```

**Parameters:** None

**Response:**
```json
{
  "id": "2",
  "command": "get_url",
  "success": true,
  "url": "https://example.com/current-page"
}
```

---

### DOM Manipulation

#### click

Click an element by CSS selector.

**Request:**
```json
{
  "id": "3",
  "command": "click",
  "selector": "#submit-button",
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for the element |
| `humanize` | boolean | No | `true` | Add human-like delay before click |

**Response:**
```json
{
  "id": "3",
  "command": "click",
  "success": true
}
```

**Error Response:**
```json
{
  "id": "3",
  "command": "click",
  "success": false,
  "error": "Element not found"
}
```

**Notes:**
- The click is performed at a random position within the element bounds
- Events dispatched: `click`

---

#### fill

Fill a form field with text.

**Request:**
```json
{
  "id": "4",
  "command": "fill",
  "selector": "#email-input",
  "value": "user@example.com",
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for the input element |
| `value` | string | Yes | - | Text to enter in the field |
| `humanize` | boolean | No | `true` | Simulate human typing delays |

**Response:**
```json
{
  "id": "4",
  "command": "fill",
  "success": true
}
```

**Notes:**
- Dispatches `input` and `change` events after filling
- When `humanize` is true, typing has variable delays between keystrokes
- Value is set directly (not character by character) for speed

---

#### scroll

Scroll to a position or element.

**Scroll to coordinates:**
```json
{
  "id": "5",
  "command": "scroll",
  "x": 0,
  "y": 500,
  "humanize": true
}
```

**Scroll to element:**
```json
{
  "id": "5",
  "command": "scroll",
  "selector": "#target-section",
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | number | No | 0 | Horizontal scroll position |
| `y` | number | No | 0 | Vertical scroll position |
| `selector` | string | No | - | CSS selector to scroll into view |
| `humanize` | boolean | No | `true` | Add human-like scroll behavior |

**Response:**
```json
{
  "id": "5",
  "command": "scroll",
  "success": true
}
```

**Notes:**
- If `selector` is provided, scrolls element into view with smooth behavior
- If coordinates are provided, scrolls to absolute position
- Humanized scroll includes natural timing variations

---

#### wait_for_element

Wait for an element to appear in the DOM.

**Request:**
```json
{
  "id": "6",
  "command": "wait_for_element",
  "selector": ".dynamic-content",
  "timeout": 10000
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for the element |
| `timeout` | number | No | 10000 | Maximum wait time in milliseconds |

**Response (found):**
```json
{
  "id": "6",
  "command": "wait_for_element",
  "success": true,
  "found": true
}
```

**Response (timeout):**
```json
{
  "id": "6",
  "command": "wait_for_element",
  "success": false,
  "error": "Timeout waiting for element"
}
```

**Notes:**
- Uses `requestAnimationFrame` for efficient polling
- Checks approximately every 16ms (60fps)

---

### Content Extraction

#### get_content

Get the page's HTML and text content.

**Request:**
```json
{
  "id": "7",
  "command": "get_content"
}
```

**Parameters:** None

**Response:**
```json
{
  "id": "7",
  "command": "get_content",
  "success": true,
  "content": {
    "html": "<!DOCTYPE html><html>...</html>",
    "text": "Page visible text content...",
    "title": "Page Title",
    "url": "https://example.com/page"
  }
}
```

**Content Fields:**
| Field | Description |
|-------|-------------|
| `html` | Complete HTML source (`document.documentElement.outerHTML`) |
| `text` | Visible text content (`document.body.innerText`) |
| `title` | Page title (`document.title`) |
| `url` | Current URL (`window.location.href`) |

---

#### get_page_state

Get structured information about forms, links, buttons, and inputs on the page.

**Request:**
```json
{
  "id": "8",
  "command": "get_page_state"
}
```

**Parameters:** None

**Response:**
```json
{
  "id": "8",
  "command": "get_page_state",
  "success": true,
  "state": {
    "url": "https://example.com/page",
    "title": "Page Title",
    "forms": [
      {
        "index": 0,
        "id": "login-form",
        "name": "login",
        "action": "/api/login",
        "method": "post",
        "fields": [
          {
            "type": "email",
            "name": "email",
            "id": "email-input",
            "value": "",
            "placeholder": "Enter email"
          },
          {
            "type": "password",
            "name": "password",
            "id": "password-input",
            "value": "***",
            "placeholder": "Enter password"
          }
        ]
      }
    ],
    "links": [
      {
        "href": "https://example.com/about",
        "text": "About Us",
        "title": ""
      }
    ],
    "buttons": [
      {
        "type": "submit",
        "text": "Sign In",
        "id": "submit-btn",
        "name": "",
        "disabled": false
      }
    ],
    "inputs": [
      {
        "type": "email",
        "name": "email",
        "id": "email-input",
        "placeholder": "Enter email",
        "value": ""
      }
    ]
  }
}
```

**Notes:**
- Password field values are masked as `***`
- Links are limited to first 100 found
- Link text is truncated to 100 characters

---

#### screenshot

Capture a screenshot of the current page.

**Request:**
```json
{
  "id": "9",
  "command": "screenshot"
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | "png" | Image format (currently only PNG supported) |

**Response:**
```json
{
  "id": "9",
  "command": "screenshot",
  "success": true,
  "data": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Notes:**
- Returns base64-encoded PNG image
- Captures the entire visible viewport
- Large pages may result in large response sizes

**Saving Screenshot (Python):**
```python
import base64

response = json.loads(await ws.recv())
if response.get("success"):
    # Remove data URL prefix
    img_data = response["data"].split(",")[1]
    with open("screenshot.png", "wb") as f:
        f.write(base64.b64decode(img_data))
```

---

### Technology Detection

#### detect_technologies

Detect web technologies used on the current page.

**Request:**
```json
{
  "id": "100",
  "command": "detect_technologies"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `html` | string | No | HTML content to analyze (if not provided, uses current page) |
| `url` | string | No | URL for context |
| `scripts` | array | No | Array of script URLs |
| `meta` | array | No | Array of meta tag objects |

**Response:**
```json
{
  "id": "100",
  "command": "detect_technologies",
  "success": true,
  "technologies": [
    {
      "name": "React",
      "category": "JavaScript frameworks",
      "confidence": 100,
      "version": "18.2.0"
    },
    {
      "name": "Cloudflare",
      "category": "CDN",
      "confidence": 100
    }
  ],
  "count": 2
}
```

#### get_technology_categories

Get all available technology categories.

**Request:**
```json
{
  "id": "101",
  "command": "get_technology_categories"
}
```

**Response:**
```json
{
  "id": "101",
  "success": true,
  "categories": [
    { "key": "javascript-frameworks", "name": "JavaScript frameworks", "technologyCount": 45 },
    { "key": "cms", "name": "CMS", "technologyCount": 30 }
  ],
  "totalCategories": 15
}
```

#### get_technology_info

Get information about a specific technology.

**Request:**
```json
{
  "id": "102",
  "command": "get_technology_info",
  "name": "React"
}
```

---

### Advanced Content Extraction

#### extract_metadata

Extract all metadata from the page (OG tags, meta tags, Twitter cards).

**Request:**
```json
{
  "id": "110",
  "command": "extract_metadata"
}
```

**Response:**
```json
{
  "id": "110",
  "success": true,
  "data": {
    "basic": {
      "title": "Page Title",
      "description": "Meta description",
      "canonical": "https://example.com/page"
    },
    "openGraph": {
      "og:title": "OG Title",
      "og:image": "https://example.com/image.jpg"
    },
    "twitterCard": {
      "twitter:card": "summary_large_image"
    }
  },
  "count": 15
}
```

#### extract_links

Extract all links from the page with categorization.

**Request:**
```json
{
  "id": "111",
  "command": "extract_links"
}
```

#### extract_forms

Extract all forms and their fields.

#### extract_images

Extract all images with attributes (src, alt, dimensions).

#### extract_scripts

Extract all scripts (external and inline).

#### extract_stylesheets

Extract all stylesheets.

#### extract_structured_data

Extract JSON-LD, Microdata, and RDFa structured data.

#### extract_all

Extract all content types at once.

**Request:**
```json
{
  "id": "118",
  "command": "extract_all"
}
```

---

### Network Analysis

#### start_network_capture

Start capturing network traffic.

**Request:**
```json
{
  "id": "120",
  "command": "start_network_capture"
}
```

**Response:**
```json
{
  "id": "120",
  "success": true,
  "captureStartTime": 1703123456789,
  "message": "Network capture started"
}
```

#### stop_network_capture

Stop capturing and get summary.

**Request:**
```json
{
  "id": "121",
  "command": "stop_network_capture"
}
```

#### get_network_requests

Get captured requests with optional filtering.

**Request:**
```json
{
  "id": "122",
  "command": "get_network_requests",
  "filter": {
    "resourceType": "script",
    "status": ["complete"]
  }
}
```

#### get_request_details

Get full details for a specific request.

**Request:**
```json
{
  "id": "123",
  "command": "get_request_details",
  "requestId": "req-12345"
}
```

#### analyze_security_headers

Analyze security headers for a URL.

**Request:**
```json
{
  "id": "124",
  "command": "analyze_security_headers",
  "url": "https://example.com"
}
```

#### get_requests_by_domain

Group captured requests by domain.

#### get_slow_requests

Get requests slower than a threshold.

**Request:**
```json
{
  "id": "126",
  "command": "get_slow_requests",
  "thresholdMs": 1000
}
```

#### get_failed_requests

Get all failed network requests.

#### export_network_capture

Export all captured data as JSON.

---

### Script Execution

#### execute_script

Execute arbitrary JavaScript in the page context.

**Request:**
```json
{
  "id": "10",
  "command": "execute_script",
  "script": "return document.querySelectorAll('a').length;"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `script` | string | Yes | JavaScript code to execute |

**Response:**
```json
{
  "id": "10",
  "command": "execute_script",
  "success": true,
  "result": 42
}
```

**Notes:**
- Script runs in the webview's page context
- Can return any JSON-serializable value
- Use IIFE pattern for complex scripts:

```json
{
  "command": "execute_script",
  "script": "(function() { const data = {}; /* ... */ return data; })()"
}
```

**Security Warning:** Only execute trusted scripts. Malicious scripts can access page data and perform actions.

---

### Cookie Management

#### get_cookies

Get cookies for a specific URL.

**Request:**
```json
{
  "id": "11",
  "command": "get_cookies",
  "url": "https://example.com"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to get cookies for |

**Response:**
```json
{
  "id": "11",
  "command": "get_cookies",
  "success": true,
  "cookies": [
    {
      "name": "session",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expirationDate": 1703123456
    }
  ]
}
```

---

#### set_cookies

Set one or more cookies.

**Request:**
```json
{
  "id": "12",
  "command": "set_cookies",
  "cookies": [
    {
      "url": "https://example.com",
      "name": "session",
      "value": "xyz789",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expirationDate": 1735689600
    }
  ]
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cookies` | array | Yes | Array of cookie objects |

**Cookie Object Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Cookie URL |
| `name` | string | Yes | Cookie name |
| `value` | string | Yes | Cookie value |
| `domain` | string | No | Cookie domain |
| `path` | string | No | Cookie path |
| `secure` | boolean | No | HTTPS only |
| `httpOnly` | boolean | No | HTTP only (no JS access) |
| `expirationDate` | number | No | Unix timestamp |

**Response:**
```json
{
  "id": "12",
  "command": "set_cookies",
  "success": true
}
```

---

### Utility Commands

#### ping

Health check to verify the connection is alive.

**Request:**
```json
{
  "id": "13",
  "command": "ping"
}
```

**Parameters:** None

**Response:**
```json
{
  "id": "13",
  "command": "ping",
  "success": true,
  "message": "pong",
  "timestamp": 1703123456789
}
```

---

#### status

Get browser and server status information.

**Request:**
```json
{
  "id": "14",
  "command": "status"
}
```

**Parameters:** None

**Response:**
```json
{
  "id": "14",
  "command": "status",
  "success": true,
  "status": {
    "clients": 1,
    "port": 8765,
    "ready": true
  }
}
```

**Status Fields:**
| Field | Description |
|-------|-------------|
| `clients` | Number of connected WebSocket clients |
| `port` | WebSocket server port |
| `ready` | Whether the browser is ready for commands |

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Command is required` | Missing `command` field | Include `command` in request |
| `Unknown command: X` | Invalid command name | Check command spelling |
| `URL is required` | Missing URL for navigate | Provide `url` parameter |
| `Selector is required` | Missing selector | Provide `selector` parameter |
| `Element not found` | Selector doesn't match | Verify selector is correct |
| `Timeout waiting for element` | Element didn't appear | Increase timeout or check page state |
| `Script is required` | Missing script for execute | Provide `script` parameter |

### Error Response Structure

```json
{
  "id": "request-id",
  "command": "command_name",
  "success": false,
  "error": "Descriptive error message"
}
```

### Handling Errors (Python)

```python
async def send_command(ws, command):
    await ws.send(json.dumps(command))
    response = json.loads(await ws.recv())

    if not response.get("success"):
        raise Exception(f"Command failed: {response.get('error')}")

    return response
```

---

## Client Examples

### Python: Complete Automation Script

```python
import asyncio
import json
import websockets
import base64

class BassetHoundClient:
    def __init__(self, uri="ws://localhost:8765"):
        self.uri = uri
        self.ws = None
        self.request_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.uri)
        # Wait for connection message
        await self.ws.recv()

    async def disconnect(self):
        if self.ws:
            await self.ws.close()

    async def send(self, command, **params):
        self.request_id += 1
        message = {
            "id": str(self.request_id),
            "command": command,
            **params
        }
        await self.ws.send(json.dumps(message))
        response = json.loads(await self.ws.recv())

        if not response.get("success"):
            raise Exception(f"Command failed: {response.get('error')}")

        return response

    async def navigate(self, url):
        return await self.send("navigate", url=url)

    async def click(self, selector, humanize=True):
        return await self.send("click", selector=selector, humanize=humanize)

    async def fill(self, selector, value, humanize=True):
        return await self.send("fill", selector=selector, value=value, humanize=humanize)

    async def get_content(self):
        response = await self.send("get_content")
        return response.get("content", {})

    async def screenshot(self, filename):
        response = await self.send("screenshot")
        img_data = response["data"].split(",")[1]
        with open(filename, "wb") as f:
            f.write(base64.b64decode(img_data))
        return filename

    async def wait_for(self, selector, timeout=10000):
        return await self.send("wait_for_element", selector=selector, timeout=timeout)

    async def execute(self, script):
        response = await self.send("execute_script", script=script)
        return response.get("result")

async def main():
    client = BassetHoundClient()
    await client.connect()

    try:
        # Navigate to website
        await client.navigate("https://example.com")
        await asyncio.sleep(2)  # Wait for page load

        # Get page title
        content = await client.get_content()
        print(f"Page title: {content.get('title')}")

        # Take screenshot
        await client.screenshot("example.png")
        print("Screenshot saved")

        # Execute custom script
        link_count = await client.execute("return document.querySelectorAll('a').length")
        print(f"Found {link_count} links")

    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

### Node.js: Event-Driven Client

```javascript
const WebSocket = require('ws');
const fs = require('fs');

class BassetHoundClient {
  constructor(uri = 'ws://localhost:8765') {
    this.uri = uri;
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.uri);

      this.ws.on('open', () => {
        console.log('Connected to Basset Hound Browser');
      });

      this.ws.on('message', (data) => {
        const response = JSON.parse(data);

        // Check for connection message
        if (response.type === 'status' && response.message === 'connected') {
          resolve();
          return;
        }

        // Handle command response
        if (response.id && this.pendingRequests.has(response.id)) {
          const { resolve: res, reject: rej } = this.pendingRequests.get(response.id);
          this.pendingRequests.delete(response.id);

          if (response.success) {
            res(response);
          } else {
            rej(new Error(response.error));
          }
        }
      });

      this.ws.on('error', reject);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  send(command, params = {}) {
    return new Promise((resolve, reject) => {
      this.requestId++;
      const id = String(this.requestId);

      this.pendingRequests.set(id, { resolve, reject });

      this.ws.send(JSON.stringify({
        id,
        command,
        ...params
      }));
    });
  }

  async navigate(url) {
    return this.send('navigate', { url });
  }

  async click(selector, humanize = true) {
    return this.send('click', { selector, humanize });
  }

  async fill(selector, value, humanize = true) {
    return this.send('fill', { selector, value, humanize });
  }

  async getContent() {
    const response = await this.send('get_content');
    return response.content;
  }

  async screenshot(filename) {
    const response = await this.send('screenshot');
    const base64Data = response.data.split(',')[1];
    fs.writeFileSync(filename, Buffer.from(base64Data, 'base64'));
    return filename;
  }

  async waitFor(selector, timeout = 10000) {
    return this.send('wait_for_element', { selector, timeout });
  }

  async execute(script) {
    const response = await this.send('execute_script', { script });
    return response.result;
  }
}

async function main() {
  const client = new BassetHoundClient();
  await client.connect();

  try {
    await client.navigate('https://example.com');
    await new Promise(r => setTimeout(r, 2000));

    const content = await client.getContent();
    console.log('Page title:', content.title);

    await client.screenshot('example.png');
    console.log('Screenshot saved');

    const linkCount = await client.execute("return document.querySelectorAll('a').length");
    console.log(`Found ${linkCount} links`);

  } finally {
    client.disconnect();
  }
}

main().catch(console.error);
```

---

## Best Practices

### 1. Use Request IDs

Always include unique request IDs to correlate responses:

```javascript
const id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### 2. Wait for Page Load

After navigation, wait for the page to fully load:

```python
await client.navigate("https://example.com")
await asyncio.sleep(2)  # Basic wait
# Or wait for specific element
await client.wait_for("#main-content", timeout=10000)
```

### 3. Handle Errors Gracefully

Always wrap commands in try-catch:

```python
try:
    await client.click("#submit")
except Exception as e:
    print(f"Click failed: {e}")
    # Take screenshot for debugging
    await client.screenshot("error.png")
```

### 4. Use Humanize Options

Enable humanization for more realistic behavior:

```json
{
  "command": "fill",
  "selector": "#search",
  "value": "search query",
  "humanize": true
}
```

### 5. Implement Rate Limiting

Add delays between commands to avoid detection:

```python
async def slow_automation():
    await client.navigate(url)
    await asyncio.sleep(random.uniform(1, 3))
    await client.click(selector)
    await asyncio.sleep(random.uniform(0.5, 1.5))
    await client.fill(input_selector, value)
```

### 6. Reuse Connections

Keep WebSocket connections open for multiple commands rather than reconnecting for each:

```python
# Good: Reuse connection
async with client:
    await client.navigate(url1)
    await client.navigate(url2)
    await client.navigate(url3)

# Avoid: Reconnecting for each command
```

### 7. Handle Large Responses

For large pages, consider streaming or chunking:

```python
# Get content in parts if needed
html = (await client.execute("return document.documentElement.outerHTML"))
```

### 8. Monitor Connection State

Implement reconnection logic:

```python
async def with_reconnect(client, func):
    try:
        return await func()
    except websockets.ConnectionClosed:
        await client.connect()
        return await func()
```
