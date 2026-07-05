# Run Your First Command

Get a simple WebSocket command working in 5 minutes.

## Prerequisites

- Basset Hound Browser installed and running
- WebSocket connection to `ws://localhost:8765`
- Basic understanding of JSON

## Step 1: Verify Browser is Running

```bash
curl http://localhost:8765/api/diagnostics
```

Expected response:
```json
{
  "status": "ok",
  "version": "12.8.0",
  "uptime": 12345
}
```

## Step 2: Connect via WebSocket

Choose your preferred method:

### Option A: Using Python (Recommended for beginners)

```python
import asyncio
import json
import websockets

async def main():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Send a ping command
        await ws.send(json.dumps({
            "id": "1",
            "command": "ping"
        }))
        
        # Wait for response
        response = json.loads(await ws.recv())
        print(f"Response: {response}")

asyncio.run(main())
```

Run it:
```bash
pip install websockets
python test.py
```

Expected output:
```
Response: {'id': '1', 'success': True, 'command': 'ping'}
```

### Option B: Using Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
    // Send a ping command
    ws.send(JSON.stringify({
        id: '1',
        command: 'ping'
    }));
});

ws.on('message', (data) => {
    const response = JSON.parse(data);
    console.log('Response:', response);
    ws.close();
});

ws.on('error', (error) => {
    console.error('Error:', error);
});
```

Run it:
```bash
node test.js
```

### Option C: Using cURL (Direct HTTP)

```bash
curl -X POST http://localhost:8765/api/command \
  -H "Content-Type: application/json" \
  -d '{"id": "1", "command": "ping"}'
```

## Step 3: Try a Navigation Command

Now let's navigate to a real website:

### Python Example

```python
import asyncio
import json
import websockets
import time

async def main():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate to a website
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        
        response = json.loads(await ws.recv())
        print(f"Navigation result: {response}")
        
        # Wait for page to load
        await asyncio.sleep(2)
        
        # Get page content
        await ws.send(json.dumps({
            "id": "2",
            "command": "get_content"
        }))
        
        response = json.loads(await ws.recv())
        print(f"Page title: {response.get('content', {}).get('title')}")
        print(f"Page text length: {len(response.get('content', {}).get('text', ''))}")

asyncio.run(main())
```

## Step 4: Take a Screenshot

```python
import asyncio
import json
import websockets
import base64

async def main():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate first
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        
        response = json.loads(await ws.recv())
        await asyncio.sleep(2)
        
        # Take a screenshot
        await ws.send(json.dumps({
            "id": "2",
            "command": "screenshot"
        }))
        
        response = json.loads(await ws.recv())
        if response.get("success"):
            # Save screenshot (base64 encoded PNG)
            img_data = response["data"].split(",")[1]
            with open("screenshot.png", "wb") as f:
                f.write(base64.b64decode(img_data))
            print("Screenshot saved to screenshot.png")
        else:
            print(f"Error: {response.get('error')}")

asyncio.run(main())
```

## Common Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ping` | Test connection | `{"command": "ping"}` |
| `status` | Get browser status | `{"command": "status"}` |
| `navigate` | Go to URL | `{"command": "navigate", "url": "https://example.com"}` |
| `get_content` | Get page HTML/text | `{"command": "get_content"}` |
| `screenshot` | Capture page | `{"command": "screenshot"}` |
| `click` | Click element | `{"command": "click", "selector": "button"}` |
| `fill` | Fill form field | `{"command": "fill", "selector": "input", "value": "text"}` |

## What Went Wrong?

### Connection Refused
- Browser not running: `npm start:dev`
- Wrong URL: Check it's `ws://localhost:8765` (not `http://`)

### Invalid JSON
- Missing quotes around property names
- Missing commas between properties
- Use a JSON validator: https://jsonlint.com/

### Command Not Found
- Check command spelling in [API Reference](../api/OVERVIEW.md)
- Some commands may not be available in your version

## Next Steps

- **[Docker Quick Start](DOCKER-QUICKSTART.md)** — Run in Docker instead of locally
- **[Basic Navigation Guide](../guides/BASIC-NAVIGATION.md)** — Learn common tasks
- **[Complete API Reference](../api/COMPLETE-REFERENCE.md)** — All 140+ commands

---

**Questions?** See [FAQ](../troubleshooting/FAQ.md) or [Troubleshooting](../troubleshooting/CONNECTION-ISSUES.md)
