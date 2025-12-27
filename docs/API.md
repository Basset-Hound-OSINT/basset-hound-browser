# Basset Hound Browser - WebSocket API Reference

Complete documentation for the WebSocket API that enables programmatic control of the Basset Hound Browser.

## Table of Contents

- [Connection](#connection)
- [Message Format](#message-format)
- [Response Format](#response-format)
- [Commands Reference](#commands-reference)
  - [Navigation](#navigation)
  - [DOM Manipulation](#dom-manipulation)
  - [Content Extraction](#content-extraction)
  - [Script Execution](#script-execution)
  - [Cookie Management](#cookie-management)
  - [Utility Commands](#utility-commands)
- [Error Handling](#error-handling)
- [Client Examples](#client-examples)
- [Best Practices](#best-practices)

## Connection

### WebSocket Endpoint

```
ws://localhost:8765
```

The WebSocket server starts automatically when the browser launches and listens on port 8765 by default.

### Connection Events

Upon successful connection, the server sends a status message:

```json
{
  "type": "status",
  "message": "connected",
  "clientId": "client-1703123456789-abc123def"
}
```

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
