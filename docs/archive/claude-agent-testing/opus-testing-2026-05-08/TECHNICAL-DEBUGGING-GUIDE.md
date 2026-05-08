# Basset Hound Browser MCP Testing
## Technical Debugging Guide & Implementation Notes

---

## Issue #1: Screenshot Capture Returns No Image Data

### Problem
```
Command: screenshot (full_page=true)
Response: { success: true, image: undefined/empty }
```

### Investigation Steps

1. **Check Electron Screenshot Implementation**
   ```bash
   grep -r "screenshot" /app/*.js | grep -E "(mainWindow|.screenshot)"
   ```
   Look for:
   - Where screenshot command is handled
   - How image is encoded/serialized
   - Whether base64 encoding is applied

2. **Verify Response Serialization**
   Location: `websocket/server.js` handler for screenshot
   ```javascript
   // Check if image data is being included in response:
   if (screenshot_result && screenshot_result.data) {
       response.image = Buffer.from(screenshot_result.data).toString('base64');
   }
   ```

3. **Test Command Directly**
   ```bash
   # WebSocket test via nc
   echo '{"id":"1","command":"screenshot","full_page":true}' | nc localhost 8765
   ```

### Root Cause Candidates

**Candidate A: Missing Image Encoding**
- Electron returns buffer
- Buffer not converted to base64
- Response includes success but empty image field

**Candidate B: Image Generation Failed**
- Screenshot command executed
- Page capture failed (returns null)
- Success flag set incorrectly

**Candidate C: Response Format Issue**
- Image data present but under different key
- Base64 encoding causes size issues
- Chunked response not reassembled

### Fix Implementation

Check `/home/devel/basset-hound-browser/websocket/server.js`:

```javascript
// Line ~XXX - Screenshot handler
case 'screenshot':
    try {
        // ISSUE: Check if image is being encoded
        const imagePath = `/tmp/screenshot_${Date.now()}.png`;
        
        // Option 1: File-based (more reliable)
        await mainWindow.webContents.capturePage(
            rect,
            { format: 'png' }
        ).then(image => {
            fs.writeFileSync(imagePath, image.toPNG());
            response.image = fs.readFileSync(imagePath).toString('base64');
            response.image_path = imagePath;
        });
        
        // Option 2: Direct Buffer (current, might be issue)
        const image = await mainWindow.webContents.capturePage();
        response.image = image.toPNG().toString('base64');
        
        response.success = true;
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    break;
```

### Testing the Fix

```python
import asyncio
import websockets
import json
import base64

async def test_screenshot():
    async with websockets.connect('ws://localhost:8765') as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "screenshot",
            "full_page": True
        }))
        response = json.loads(await ws.recv())
        
        if response.get('image'):
            # Decode and save
            img_data = base64.b64decode(response['image'])
            with open('/tmp/test.png', 'wb') as f:
                f.write(img_data)
            print(f"✓ Screenshot captured: {len(img_data)} bytes")
        else:
            print(f"✗ No image data: {response}")

asyncio.run(test_screenshot())
```

---

## Issue #2: Content Extraction Returns Empty Results

### Problem
```
Command: extract_links, extract_images
Response: { success: true, links: [], images: [] }

On page: example.com (has HTML with links)
Expected: At least 1 link found
```

### Investigation Steps

1. **Locate Extraction Module**
   ```bash
   find /app -name "*extract*" -type f | head -20
   ls -la /home/devel/basset-hound-browser/extraction/
   ```

2. **Check DOM Traversal Logic**
   Location: `extraction/links.js` or similar
   ```javascript
   // Likely issue: missing wait for DOM
   document.querySelectorAll('a').map(a => ({
       href: a.href,
       text: a.innerText
   }))
   
   // Should be wrapped in: wait for page load
   ```

3. **Test JavaScript Execution Directly**
   ```python
   # Test if JavaScript can access DOM
   import asyncio
   import websockets
   import json
   
   async def test_js():
       async with websockets.connect('ws://localhost:8765') as ws:
           # Navigate first
           await ws.send(json.dumps({
               "id": "1",
               "command": "navigate",
               "url": "https://example.com",
               "wait_until": "load",
               "timeout": 30000
           }))
           resp = json.loads(await ws.recv())
           print(f"Navigate: {resp.get('success')}")
           
           # Test DOM access
           await asyncio.sleep(2)  # Wait for render
           
           await ws.send(json.dumps({
               "id": "2",
               "command": "execute_javascript",
               "script": "document.querySelectorAll('a').length"
           }))
           resp = json.loads(await ws.recv())
           print(f"Link count via JS: {resp.get('result')}")
   
   asyncio.run(test_js())
   ```

### Root Cause Candidates

**Candidate A: Timing Issue**
- Extraction runs before JavaScript renders
- DOM not populated yet
- Need wait_for condition

**Candidate B: Sandbox/Security Issue**
- Content Security Policy blocking access
- iframe isolation preventing traversal
- Cross-origin restrictions

**Candidate C: Element Filtering**
- Selector too strict
- Hidden elements filtered out
- Dynamic content not captured

### Fix Implementation

Check each extraction file:

**1. `/extraction/links.js`**
```javascript
async function extractLinks(page) {
    // FIX: Add explicit wait
    await page.evaluate(() => {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
                setTimeout(resolve, 5000); // timeout
            }
        });
    });
    
    // Now extract
    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(link => ({
            href: link.getAttribute('href'),
            text: link.textContent.trim(),
            title: link.getAttribute('title')
        }));
    });
}
```

**2. `/extraction/images.js`**
```javascript
async function extractImages(page) {
    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height
        }));
    });
}
```

**3. WebSocket Command Handler**
```javascript
case 'extract_links':
    try {
        // Wait for navigation to complete
        await mainWindow.webContents.executeJavaScript(`
            (async () => {
                await new Promise(resolve => {
                    if (document.readyState === 'complete') {
                        resolve();
                    } else {
                        window.addEventListener('load', resolve);
                        setTimeout(resolve, 3000);
                    }
                });
                return true;
            })()
        `);
        
        // Then extract
        const links = await mainWindow.webContents.executeJavaScript(`
            Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.textContent,
                title: a.title
            }))
        `);
        
        response.links = links;
        response.success = true;
    } catch (err) {
        response.error = err.message;
    }
    break;
```

### Testing the Fix

```python
import asyncio
import websockets
import json
import time

async def test_extraction():
    async with websockets.connect('ws://localhost:8765') as ws:
        # Navigate
        cmd = {
            "id": "1",
            "command": "navigate",
            "url": "https://example.com",
            "wait_until": "load",
            "timeout": 30000
        }
        await ws.send(json.dumps(cmd))
        nav_resp = json.loads(await ws.recv())
        print(f"Navigation: {nav_resp.get('success')}")
        
        # Wait a bit for rendering
        await asyncio.sleep(3)
        
        # Extract links
        cmd = {
            "id": "2",
            "command": "extract_links"
        }
        await ws.send(json.dumps(cmd))
        ext_resp = json.loads(await ws.recv())
        
        links = ext_resp.get('links', [])
        print(f"Links found: {len(links)}")
        if links:
            print(f"Sample: {links[0]}")
        else:
            print("ERROR: No links found")
            
            # Debug: Try JavaScript directly
            cmd = {
                "id": "3",
                "command": "execute_javascript",
                "script": "document.querySelectorAll('a').length"
            }
            await ws.send(json.dumps(cmd))
            js_resp = json.loads(await ws.recv())
            print(f"JS link count: {js_resp.get('result')}")

asyncio.run(test_extraction())
```

---

## Issue #3: User Agent Rotation Not Working

### Problem
```
Command: list_user_agents
Response: { user_agents: [] }

Command: set_random_user_agent  
Response: { success: false }
```

### Investigation Steps

1. **Check User Agent Database**
   ```bash
   find /app -name "*agent*" -o -name "*ua*" -o -name "*fingerprint*" | grep -E "(json|db|list)"
   
   # Likely location
   ls -la /home/devel/basset-hound-browser/evasion/
   ls -la /home/devel/basset-hound-browser/data/
   ```

2. **Check Phase 2 Data**
   ```bash
   # Phase 2 evasion should have user agents
   find /home/devel/basset-hound-browser -name "*user*agent*" -o -name "*fingerprint*" | head -20
   ```

3. **Verify Agent Source**
   ```javascript
   // In evasion/user-agents.js or similar
   const USER_AGENTS = [
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
       'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
       // ... many more
   ];
   ```

### Root Cause

**Most Likely:** User agent database not populated or not loaded at startup.

### Fix Implementation

**1. Create/Update User Agent Database**

Location: `/home/devel/basset-hound-browser/evasion/user-agents.json`

```json
{
  "desktop": {
    "windows": [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
    ],
    "macos": [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0"
    ],
    "linux": [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0"
    ]
  },
  "mobile": {
    "ios": [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    ],
    "android": [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
    ]
  }
}
```

**2. Load Database on Startup**

Location: `websocket/server.js` or main initialization

```javascript
// At module load time
const fs = require('fs');
const path = require('path');

let USER_AGENTS = [];

function loadUserAgents() {
    try {
        const ua_path = path.join(__dirname, '../evasion/user-agents.json');
        const data = JSON.parse(fs.readFileSync(ua_path, 'utf8'));
        
        // Flatten all categories
        USER_AGENTS = [];
        Object.values(data).forEach(category => {
            Object.values(category).forEach(agents => {
                USER_AGENTS.push(...agents);
            });
        });
        
        console.log(`Loaded ${USER_AGENTS.length} user agents`);
    } catch (err) {
        console.error('Failed to load user agents:', err);
        // Fallback list
        USER_AGENTS = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        ];
    }
}

// Call on startup
loadUserAgents();
```

**3. Implement WebSocket Handlers**

```javascript
case 'list_user_agents':
    response.user_agents = USER_AGENTS.map((ua, idx) => ({
        id: idx,
        user_agent: ua,
        category: identifyCategory(ua)
    }));
    response.success = true;
    break;

case 'set_random_user_agent':
    if (USER_AGENTS.length > 0) {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        await mainWindow.webContents.setUserAgent(ua);
        response.user_agent = ua;
        response.success = true;
    } else {
        response.error = 'No user agents available';
        response.success = false;
    }
    break;

case 'set_user_agent':
    if (params.user_agent) {
        await mainWindow.webContents.setUserAgent(params.user_agent);
        response.user_agent = params.user_agent;
        response.success = true;
    } else {
        response.error = 'user_agent parameter required';
        response.success = false;
    }
    break;
```

### Testing the Fix

```python
import asyncio
import websockets
import json

async def test_user_agents():
    async with websockets.connect('ws://localhost:8765') as ws:
        # List agents
        await ws.send(json.dumps({
            "id": "1",
            "command": "list_user_agents"
        }))
        resp = json.loads(await ws.recv())
        agents = resp.get('user_agents', [])
        print(f"Available agents: {len(agents)}")
        
        if agents:
            # Set random
            await ws.send(json.dumps({
                "id": "2",
                "command": "set_random_user_agent"
            }))
            resp = json.loads(await ws.recv())
            print(f"Random UA set: {resp.get('success')}")
            print(f"New UA: {resp.get('user_agent', 'N/A')[:50]}...")
            
            # Verify with httpbin
            await ws.send(json.dumps({
                "id": "3",
                "command": "navigate",
                "url": "https://httpbin.org/user-agent",
                "wait_until": "load"
            }))
            await json.loads(await ws.recv())  # nav response
            
            await asyncio.sleep(2)
            
            await ws.send(json.dumps({
                "id": "4",
                "command": "execute_javascript",
                "script": "document.body.innerText"
            }))
            resp = json.loads(await ws.recv())
            print(f"Verified UA: {resp.get('result', 'N/A')[:100]}")

asyncio.run(test_user_agents())
```

---

## Debugging Toolkit

### 1. WebSocket Console for Manual Testing

```python
#!/usr/bin/env python3
import asyncio
import websockets
import json
import sys

async def interactive_ws():
    async with websockets.connect('ws://localhost:8765') as ws:
        cmd_id = 1
        while True:
            try:
                cmd = input('> ').strip()
                if not cmd:
                    continue
                if cmd == 'quit':
                    break
                    
                await ws.send(json.dumps({
                    "id": str(cmd_id),
                    "command": cmd.split()[0],
                    **{
                        k.split('=')[0]: k.split('=')[1]
                        for k in cmd.split()[1:]
                        if '=' in k
                    }
                }))
                cmd_id += 1
                
                resp = json.loads(await ws.recv())
                print(json.dumps(resp, indent=2))
            except Exception as e:
                print(f"Error: {e}")

if __name__ == '__main__':
    asyncio.run(interactive_ws())
```

Usage:
```
> navigate url=https://example.com wait_until=load
> extract_links
> get_page_state
> execute_javascript script="document.title"
```

### 2. Logging Enhancement

Add to WebSocket handler:

```javascript
function logCommand(command, params, response) {
    console.log(`[${new Date().toISOString()}] Command: ${command}`);
    console.log(`  Input: ${JSON.stringify(params).substring(0, 100)}`);
    console.log(`  Output: ${JSON.stringify(response).substring(0, 100)}`);
}
```

### 3. Response Inspector

```python
import json

def inspect_response(resp):
    """Pretty print and analyze response"""
    print("=" * 60)
    print(json.dumps(resp, indent=2, default=str))
    print("-" * 60)
    print(f"Success: {resp.get('success', 'N/A')}")
    print(f"Keys: {list(resp.keys())}")
    if 'error' in resp:
        print(f"ERROR: {resp['error']}")
    print("=" * 60)
```

---

## Summary of Fixes

| Issue | Priority | Effort | Fix |
|-------|----------|--------|-----|
| Screenshot no image | HIGH | 2h | Check base64 encoding in server.js |
| Content extraction empty | CRITICAL | 4h | Add wait_for_load in DOM traversal |
| User agents empty | MEDIUM | 1h | Load JSON database at startup |

---

## Validation Checklist

After implementing fixes:

- [ ] Screenshot returns base64 encoded image data
- [ ] extract_links returns >=1 link for example.com
- [ ] extract_images returns valid image objects
- [ ] list_user_agents returns >=50 agents
- [ ] set_random_user_agent changes User-Agent header
- [ ] All 10 test scenarios pass
- [ ] Error messages include debugging info
- [ ] No WebSocket connection drops during testing

