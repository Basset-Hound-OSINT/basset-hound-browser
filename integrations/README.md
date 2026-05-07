# Basset Hound Browser - Client Libraries & Integrations

This directory contains client libraries and integration examples for Basset Hound Browser.

---

## Client Libraries

### Python Client (`python_client.py`)

**Complete async WebSocket client library for Python**

**Features:**
- Full async/await support
- Auto-reconnection capability
- Timeout handling
- 20+ browser control methods
- Error handling with custom exceptions

**Installation:**
```bash
# Requires websockets library
pip install websockets
```

**Usage:**
```python
import asyncio
from python_client import BassetHoundClient

async def main():
    browser = BassetHoundClient()
    await browser.connect()
    
    await browser.navigate("https://example.com")
    content = await browser.get_content()
    print(content['text'])
    
    await browser.disconnect()

asyncio.run(main())
```

**Or as context manager:**
```python
async def main():
    async with BassetHoundClient() as browser:
        await browser.navigate("https://example.com")
        links = await browser.extract_links()
        print(f"Found {len(links)} links")

asyncio.run(main())
```

**Key Methods:**
- Navigation: `navigate()`, `get_url()`, `get_title()`, `go_back()`, `go_forward()`, `reload()`
- Interaction: `click()`, `fill()`, `type()`, `scroll()`, `wait_for_element()`
- Extraction: `get_content()`, `get_page_state()`, `extract_links()`, `extract_forms()`
- Screenshots: `screenshot()`
- Advanced: `execute_script()`, `get_cookies()`, `set_cookies()`, `set_proxy()`, `set_tor_mode()`

**Convenience Functions:**
```python
# Quick navigate and get text
text = await quick_navigate("https://example.com")

# Quick navigate and screenshot
screenshot = await quick_screenshot("https://example.com")
```

**CLI Usage:**
```bash
python python_client.py https://example.com
```

---

### Node.js Client (`nodejs_client.js`)

**Promise-based WebSocket client for Node.js**

**Features:**
- Promise/async-await support
- Automatic reconnection
- Timeout handling
- All browser control methods
- Error handling with custom classes

**Installation:**
```bash
# Requires ws library (WebSocket)
npm install ws
```

**Usage:**
```javascript
const { BassetHoundClient } = require('./nodejs_client');

async function main() {
  const browser = new BassetHoundClient();
  await browser.connect();
  
  await browser.navigate("https://example.com");
  const content = await browser.getContent();
  console.log(content.text);
  
  await browser.disconnect();
}

main().catch(console.error);
```

**Key Methods:**
- Navigation: `navigate()`, `getUrl()`, `getTitle()`, `goBack()`, `goForward()`, `reload()`
- Interaction: `click()`, `fill()`, `type()`, `scroll()`, `waitForElement()`
- Extraction: `getContent()`, `getPageState()`, `extractLinks()`, `extractForms()`
- Screenshots: `screenshot()`
- Advanced: `executeScript()`, `getCookies()`, `setCookies()`, `setProxy()`, `setTorMode()`

**Convenience Functions:**
```javascript
// Quick navigate and get text
const text = await quickNavigate("https://example.com");

// Quick navigate and screenshot
const screenshot = await quickScreenshot("https://example.com");
```

**CLI Usage:**
```bash
node nodejs_client.js https://example.com
```

---

## Integration Examples

### OSINT Workflow (`sample_osint_workflow.py`)

**Complete open-source intelligence reconnaissance workflow**

**Features:**
- Target reconnaissance
- Content extraction
- Page structure analysis
- JavaScript analysis
- Screenshot capture
- Structured reporting

**Basic Usage:**
```bash
python sample_osint_workflow.py https://example.com
```

**Advanced Mode:**
```bash
python sample_osint_workflow.py https://example.com --advanced
```

**Output:**
- Screenshots: `osint_results/screenshot_*.png`
- Reports: `osint_results/report_*.json` (or `advanced_report_*.json`)

**Example Output Report:**
```json
{
  "timestamp": "2026-05-06T23:30:00.000000",
  "target_url": "https://example.com",
  "current_url": "https://example.com",
  "page_title": "Example Domain",
  "links": [
    {"text": "More information", "href": "https://www.iana.org/domains/example"}
  ],
  "forms": [],
  "screenshot": "osint_results/screenshot_1746800400.png",
  "page_state": {
    "title": "Example Domain",
    "forms": [],
    "links": 1,
    "buttons": 0
  }
}
```

---

### palletai Integration (`palletai_integration.md`)

**Complete guide for integrating with palletai agents**

**Covers:**
- MCP server registration
- Tool categories and naming
- Common integration patterns
- Performance optimization
- Error handling
- Advanced techniques
- Monitoring and logging
- Troubleshooting

**Key Sections:**
1. Setup Instructions
2. Tool Categories (166 tools across 15 categories)
3. Common Integration Patterns
4. Performance Optimization
5. Error Handling
6. Advanced Techniques
7. Monitoring and Logging
8. Testing Integration
9. Troubleshooting
10. Best Practices

---

## Quick Start

### For Python Users

```bash
# 1. Install dependencies
pip install websockets

# 2. Run OSINT workflow
python sample_osint_workflow.py https://example.com

# 3. Or use Python client library
python -c "
import asyncio
from python_client import BassetHoundClient

async def test():
    async with BassetHoundClient() as b:
        await b.navigate('https://example.com')
        print(await b.get_title())

asyncio.run(test())
"
```

### For Node.js Users

```bash
# 1. Install dependencies
npm install ws

# 2. Use Node.js client
node -e "
const { BassetHoundClient } = require('./nodejs_client');

(async () => {
  const b = new BassetHoundClient();
  await b.connect();
  await b.navigate('https://example.com');
  console.log(await b.getTitle());
  await b.disconnect();
})();
"
```

### For palletai Integration

```bash
# 1. Register MCP server
# Add to your palletai config:
# {
#   "mcpServers": {
#     "basset-hound": {
#       "command": "python",
#       "args": ["-m", "browser_mcp.server"],
#       "cwd": "/path/to/basset-hound-browser"
#     }
#   }
# }

# 2. Verify tools are available
palletai mcp list

# 3. Use in agent:
# Result: browser_navigate, browser_click, browser_extract_links, ... (166 tools)
```

---

## API Reference

All client libraries provide equivalent APIs. Here's the method mapping:

| Operation | Python | Node.js |
|-----------|--------|---------|
| Connect | `connect()` | `connect()` |
| Disconnect | `disconnect()` | `disconnect()` |
| Navigate | `navigate(url)` | `navigate(url)` |
| Get URL | `get_url()` | `getUrl()` |
| Get Title | `get_title()` | `getTitle()` |
| Click | `click(selector)` | `click(selector)` |
| Fill | `fill(selector, text)` | `fill(selector, text)` |
| Type | `type(selector, text)` | `type(selector, text)` |
| Scroll | `scroll(x, y)` | `scroll(x, y)` |
| Get Content | `get_content()` | `getContent()` |
| Extract Links | `extract_links()` | `extractLinks()` |
| Extract Forms | `extract_forms()` | `extractForms()` |
| Screenshot | `screenshot()` | `screenshot()` |
| Execute JS | `execute_script(code)` | `executeScript(code)` |
| Get Cookies | `get_cookies()` | `getCookies()` |
| Set Cookies | `set_cookies(cookies)` | `setCookies(cookies)` |
| Clear Cookies | `clear_cookies()` | `clearCookies()` |
| Set Proxy | `set_proxy(host, port)` | `setProxy(host, port)` |
| Set User Agent | `set_user_agent(ua)` | `setUserAgent(ua)` |
| Set Tor Mode | `set_tor_mode(mode)` | `setTorMode(mode)` |
| Ping | `ping()` | `ping()` |

---

## Configuration

### Python Client

**Environment Variables:**
- `BASSET_HOUND_HOST` - WebSocket host (default: localhost)
- `BASSET_HOUND_PORT` - WebSocket port (default: 8765)
- `BASSET_HOUND_TIMEOUT` - Command timeout in seconds (default: 30)

**Programmatic:**
```python
browser = BassetHoundClient(
    host="localhost",
    port=8765,
    timeout=30.0,
    auto_reconnect=True
)
```

### Node.js Client

**Programmatic:**
```javascript
const browser = new BassetHoundClient(
  "localhost",  // host
  8765,         // port
  30000,        // timeout (ms)
  true          // auto_reconnect
);
```

---

## Error Handling

### Python

```python
from python_client import (
    BassetHoundClient,
    BassetHoundClientError,
    BassetHoundConnectionError,
    BassetHoundTimeoutError
)

try:
    await browser.navigate(url)
except BassetHoundConnectionError as e:
    print(f"Connection failed: {e}")
except BassetHoundTimeoutError as e:
    print(f"Command timed out: {e}")
except BassetHoundClientError as e:
    print(f"Client error: {e}")
```

### Node.js

```javascript
const {
  BassetHoundClient,
  BassetHoundClientError,
  BassetHoundConnectionError,
  BassetHoundTimeoutError
} = require('./nodejs_client');

try {
  await browser.navigate(url);
} catch (err) {
  if (err instanceof BassetHoundConnectionError) {
    console.error("Connection failed:", err.message);
  } else if (err instanceof BassetHoundTimeoutError) {
    console.error("Command timed out:", err.message);
  } else {
    console.error("Client error:", err.message);
  }
}
```

---

## Performance Tips

1. **Reuse connections:** Keep browser connection open for multiple operations
2. **Batch operations:** Group related commands when possible
3. **Use appropriate waits:** 2-4 seconds after navigation is typical
4. **Handle errors gracefully:** Implement retry logic for timeouts
5. **Clean up resources:** Disconnect when done or use context managers
6. **Monitor memory:** Clear cookies/pages periodically in long-running workflows

---

## Troubleshooting

**Connection Refused:**
```bash
# Ensure browser is running
npm start  # Start browser
# OR
docker-compose up basset-hound-browser
```

**Timeout Errors:**
- Increase timeout in client initialization
- Wait longer after navigation
- Check network connectivity

**Script Errors:**
- Verify JavaScript syntax
- Check element selectors exist
- Use browser's developer tools to test

---

## Support

**Documentation:**
- [Basset Hound API Reference](../docs/API-REFERENCE.md)
- [Integration Guide](./palletai_integration.md)
- [Main SCOPE Documentation](../docs/SCOPE.md)

**Examples:**
- Python OSINT workflow: `sample_osint_workflow.py`
- Python client: `python_client.py`
- Node.js client: `nodejs_client.js`

---

**Version:** 1.0.0  
**Release Date:** May 6, 2026  
**Status:** Production Ready
