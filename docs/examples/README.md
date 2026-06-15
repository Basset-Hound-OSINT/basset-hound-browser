# Basset Hound Browser - Code Examples

**Version**: 12.3.0  
**Last Updated**: June 14, 2026

This directory contains working code examples for integrating with Basset Hound Browser.

## Quick Start

### Choose Your Language

- **Python**: Examples 01, 03, 05
- **Node.js**: Example 02
- **Bash/cURL**: Example 04

### Install Dependencies

**Python:**
```bash
pip install websocket-client
```

**Node.js:**
```bash
npm install ws
```

**Bash:**
```bash
npm install -g wscat  # Optional, for interactive testing
```

## Examples

### 01-python-hello-world.py

**Language**: Python  
**Difficulty**: Beginner  
**Time**: 5 minutes  
**What it does**:
- Connects to the WebSocket server
- Sends a `ping` command
- Gets server status
- Navigates to a website
- Extracts links from the page

**Run it:**
```bash
python3 01-python-hello-world.py
```

**Key concepts**:
- WebSocket connection
- Basic command structure
- Response parsing
- Error handling

---

### 02-nodejs-hello-world.js

**Language**: Node.js  
**Difficulty**: Beginner  
**Time**: 5 minutes  
**What it does**:
- Connects to the WebSocket server
- Sends commands asynchronously
- Handles responses with Promises
- Demonstrates async/await pattern

**Prerequisites:**
```bash
npm install ws
```

**Run it:**
```bash
node 02-nodejs-hello-world.js
```

**Key concepts**:
- Async/await patterns
- Promise-based responses
- Event-driven programming
- Error handling

---

### 03-python-web-scraping.py

**Language**: Python  
**Difficulty**: Intermediate  
**Time**: 10 minutes  
**What it does**:
- Scrapes a website for all content
- Extracts text, links, forms, images
- Saves results to JSON
- Captures a screenshot
- Saves screenshot as PNG file

**Run it:**
```bash
python3 03-python-web-scraping.py https://example.com scrape.json
```

**Output**:
- `scrape.json` - All extracted content
- `scrape_screenshot.png` - Page screenshot

**Key concepts**:
- Full-page scraping
- Content extraction
- File operations
- Base64 image decoding
- Custom client class

**Example output:**
```json
{
  "url": "https://example.com",
  "timestamp": "2026-06-14 12:34:56",
  "page_state": {
    "title": "Example Domain",
    "url": "https://example.com/",
    "links": [...],
    "forms": [...]
  },
  "extracted_content": {
    "links": [...],
    "images": [...],
    "forms": [...]
  },
  "screenshot": "scrape_screenshot.png"
}
```

---

### 04-bash-curl-examples.sh

**Language**: Bash  
**Difficulty**: Beginner to Intermediate  
**Time**: 5-10 minutes  
**What it does**:
- Interactive test suite for WebSocket connectivity
- Multiple test backends (wscat, websocat, Python, Node.js)
- Health checks and Docker status
- Netcat connectivity test

**Run it:**
```bash
bash 04-bash-curl-examples.sh
```

**Interactive mode:**
```
Available tests:
  1) HTTP Health Check
  2) Docker Status
  3) Netcat Connectivity
  4) Python WebSocket Test
  5) Node.js WebSocket Test
  6) websocat Test
  7) wscat Interactive (Recommended)
  8) Run All Tests
```

**Or run specific tests:**
```bash
bash 04-bash-curl-examples.sh http        # HTTP health check
bash 04-bash-curl-examples.sh docker      # Docker status
bash 04-bash-curl-examples.sh python      # Python test
bash 04-bash-curl-examples.sh wscat       # Interactive mode
```

**Key concepts**:
- Shell scripting
- curl and HTTP requests
- WebSocket testing with various tools
- Docker integration
- Error handling in bash

---

### 05-form-automation.py

**Language**: Python  
**Difficulty**: Intermediate  
**Time**: 10 minutes  
**What it does**:
- Demonstrates form automation
- Fills form fields with text
- Submits forms
- Verifies success messages
- Shows humanization techniques

**Run it:**
```bash
python3 05-form-automation.py
```

**Key concepts**:
- Form detection and parsing
- Field identification
- Form submission
- Page state verification
- Human-like behavior (humanize parameter)
- Error recovery

**Example workflow:**
```python
client = FormAutomationExample()
client.connect()
client.navigate('https://example.com/form')
client.wait_for_element('#form-container')
client.fill_field('#email', 'user@example.com')
client.fill_field('#password', 'password123')
client.click_button('#submit')
client.wait_for_element('.success-message')
client.close()
```

---

## Common Patterns

### Pattern 1: Simple Request-Response

```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect('ws://localhost:8765')

# Send command
ws.send(json.dumps({'id': 1, 'command': 'ping'}))

# Get response
response = json.loads(ws.recv())
print(response)

ws.close()
```

### Pattern 2: Navigate and Extract

```python
# Navigate
ws.send(json.dumps({'id': 1, 'command': 'navigate', 'url': 'https://example.com'}))
ws.recv()  # Wait for navigation

# Wait for page
time.sleep(2)

# Extract
ws.send(json.dumps({'id': 2, 'command': 'extract_all'}))
response = json.loads(ws.recv())
content = response['data']
```

### Pattern 3: Error Handling

```python
response = json.loads(ws.recv())

if response.get('success'):
    print("Success!")
    data = response.get('data')
else:
    error = response.get('error')
    recovery = response.get('recovery')
    print(f"Error: {error}")
    print(f"Recovery: {recovery['suggestion']}")
```

### Pattern 4: Rate Limiting

```python
import time

requests_sent = 0
start_time = time.time()

for item in items:
    # Check rate limit
    if requests_sent >= 1000:
        elapsed = time.time() - start_time
        if elapsed < 60:
            wait_time = 60 - elapsed
            time.sleep(wait_time)
        requests_sent = 0
        start_time = time.time()

    # Send request
    ws.send(json.dumps({'id': request_id, 'command': 'navigate', 'url': item}))
    ws.recv()
    requests_sent += 1
```

## Testing

### Test Server Connectivity

```bash
# HTTP health check
curl http://localhost:8765/health

# WebSocket connectivity (with wscat)
wscat -c ws://localhost:8765
# Then type: {"id":1,"command":"ping"}

# Or use the test script
bash 04-bash-curl-examples.sh all
```

### Run Examples in Order

1. **Start with**: `01-python-hello-world.py` or `02-nodejs-hello-world.js`
2. **Then try**: `04-bash-curl-examples.sh` for testing
3. **Move to**: `03-python-web-scraping.py` for real scraping
4. **Advanced**: `05-form-automation.py` for automation

## Troubleshooting

### "Connection refused"

- Ensure server is running: `docker ps | grep basset-hound`
- Check port 8765 is open: `netcat -zv localhost 8765`
- Verify firewall allows connection

### "Command timeout"

- Wait 2-3 seconds after `navigate` before other commands
- Use `wait_for_element` before interacting with page
- Increase timeout parameter if needed

### "Element not found"

- Verify CSS selector is correct
- Check page has fully loaded
- Use `wait_for_element` to wait for dynamic content

### Python: "No module named 'websocket'"

```bash
pip install websocket-client
```

### Node.js: "Cannot find module 'ws'"

```bash
npm install ws
```

## Advanced Usage

### Multi-threaded/Async Requests

For high-throughput scenarios:

**Python (async):**
```bash
pip install aiowebsocket
```

**Node.js (native):**
Use `async/await` with `Promise.all()` for concurrent requests

### Connection Pooling

For many operations, reuse connection:

```python
class ConnectionPool:
    def __init__(self, pool_size=5):
        self.connections = [create_connection() for _ in range(pool_size)]
        self.current = 0

    def get_connection(self):
        conn = self.connections[self.current]
        self.current = (self.current + 1) % len(self.connections)
        return conn
```

### Retry Logic

```python
import time

def send_with_retry(ws, request, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            ws.send(json.dumps(request))
            response = json.loads(ws.recv())
            if response.get('success'):
                return response
        except Exception as e:
            if attempt == max_retries:
                raise
            wait_time = 2 ** attempt  # Exponential backoff
            time.sleep(wait_time)
    return None
```

## Next Steps

1. **Run the examples** - Start with hello-world
2. **Read the docs** - Check [USER-ACCESS-GUIDE.md](../USER-ACCESS-GUIDE.md)
3. **API Reference** - See [API-QUICK-REFERENCE.md](../API-QUICK-REFERENCE.md)
4. **Integration** - Follow [INTEGRATION-CHECKLIST.md](../INTEGRATION-CHECKLIST.md)

## Support

- **Getting Started**: [USER-ACCESS-GUIDE.md](../USER-ACCESS-GUIDE.md)
- **All Commands**: [API-QUICK-REFERENCE.md](../API-QUICK-REFERENCE.md)
- **Detailed Reference**: [API-REFERENCE.md](../API-REFERENCE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **FAQ**: [FAQ-COMPLETE.md](../FAQ-COMPLETE.md)

---

**Version**: 12.3.0 | **Updated**: June 14, 2026 | **Status**: Production Ready
