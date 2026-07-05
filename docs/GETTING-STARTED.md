> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

# Getting Started with Basset Hound Browser

**Version:** 12.8.0  
**Last Updated:** June 21, 2026  
**Time to First Command:** 5 minutes

---

## Before You Start

**Choose Your Path:**
- **Path A (5 min):** Run with Docker (recommended for testing/CI)
- **Path B (10 min):** Run from source (recommended for development)
- **Path C (2 min):** Use cloud (SaaS version - if available)

---

## Path A: Docker (Recommended)

### Step 1: Install Docker

```bash
# Ubuntu/Debian
sudo apt-get install docker.io

# macOS (or use Docker Desktop)
brew install docker

# Windows: Download Docker Desktop
# https://www.docker.com/products/docker-desktop
```

### Step 2: Run Browser Container

```bash
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  basset-hound-browser:12.8.0
```

### Step 3: Verify It's Running

```bash
docker ps | grep basset-hound
# Should show: basset-hound ... Up ...

curl http://localhost:8765
# Should return WebSocket upgrade message or 426 response
```

---

## Path B: Run from Source

### Step 1: Clone & Install

```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
npm install
```

### Step 2: Install Tor (Optional)

Tor is optional but enables geolocation spoofing and privacy features:

```bash
# Ubuntu/Debian
sudo apt-get install tor

# macOS
brew install tor
sudo brew services start tor
```

### Step 3: Start Browser

```bash
# Development mode (with DevTools)
npm run dev

# Production mode
npm start

# Headless mode
npm run headless
```

### Step 4: Verify Connection

```bash
# Should show: WebSocket server listening on ws://localhost:8765
# Look for: "Status: ready"
```

---

## Path C: Cloud (SaaS)

If using managed cloud version:

```bash
export BASSET_URL=wss://api.basset-hound.cloud
export BASSET_TOKEN=your_api_token_here
```

See [Cloud Deployment Guide](deployment/CLOUD-DEPLOYMENT.md) for details.

---

## Your First Command (2 minutes)

### Option 1: Using Python

```python
import asyncio
import json
import websockets

async def first_command():
    async with websockets.connect("ws://localhost:8765") as ws:
        # 1. Navigate to example.com
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        response = json.loads(await ws.recv())
        print(f"Navigation: {response['success']}")
        
        # 2. Wait for page to load
        await asyncio.sleep(2)
        
        # 3. Take screenshot
        await ws.send(json.dumps({
            "id": "2",
            "command": "screenshot"
        }))
        response = json.loads(await ws.recv())
        
        # 4. Save screenshot
        if response.get("success"):
            import base64
            img_data = response["data"].split(",")[1]
            with open("screenshot.png", "wb") as f:
                f.write(base64.b64decode(img_data))
            print("Screenshot saved: screenshot.png")

asyncio.run(first_command())
```

### Option 2: Using Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
    // 1. Navigate
    ws.send(JSON.stringify({
        id: '1',
        command: 'navigate',
        url: 'https://example.com'
    }));
});

ws.on('message', async (data) => {
    const response = JSON.parse(data);
    console.log('Response:', response);
    
    if (response.id === '1') {
        // Wait for page load
        await new Promise(r => setTimeout(r, 2000));
        
        // 2. Take screenshot
        ws.send(JSON.stringify({
            id: '2',
            command: 'screenshot'
        }));
    } else if (response.id === '2' && response.success) {
        // 3. Save screenshot
        const fs = require('fs');
        const base64 = response.data.split(',')[1];
        fs.writeFileSync('screenshot.png', Buffer.from(base64, 'base64'));
        console.log('Screenshot saved: screenshot.png');
        ws.close();
    }
});
```

### Option 3: Using cURL

```bash
# 1. Create WebSocket connection and send navigate command
# (Note: curl has limited WebSocket support, use netcat + jq for better control)

# Using websocat (install: cargo install websocat)
websocat ws://localhost:8765 <<< '{"id":"1","command":"navigate","url":"https://example.com"}'

# Or Python one-liner
python3 << 'EOF'
import asyncio, json, websockets
async def main():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({"id":"1","command":"navigate","url":"https://example.com"}))
        print(await ws.recv())
asyncio.run(main())
EOF
```

---

## Common First Commands

### 1. Check if Browser is Ready

```python
import json, websockets, asyncio

async def check_status():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({"id": "1", "command": "ping"}))
        response = json.loads(await ws.recv())
        print(f"Status: {response['success']}")  # Should be True

asyncio.run(check_status())
```

### 2. Get Current Page Title

```python
async def get_title():
    async with websockets.connect("ws://localhost:8765") as ws:
        # First navigate
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()  # Consume response
        
        # Then get title
        await ws.send(json.dumps({"id": "2", "command": "get_title"}))
        response = json.loads(await ws.recv())
        print(f"Title: {response['data']['title']}")

asyncio.run(get_title())
```

### 3. Extract All Links from Page

```python
async def extract_links():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        
        await ws.send(json.dumps({"id": "2", "command": "extract_links"}))
        response = json.loads(await ws.recv())
        links = response['data']['links']
        print(f"Found {len(links)} links:")
        for link in links[:5]:  # Show first 5
            print(f"  - {link['text']}: {link['href']}")

asyncio.run(extract_links())
```

---

## Troubleshooting

### Error: "Connection refused"

**Cause:** Browser not running

**Solution:**
```bash
# Check if browser is running
docker ps | grep basset-hound
# OR
ps aux | grep "npm start"

# If not running, start it
npm start
# OR
docker run -d -p 8765:8765 basset-hound-browser:12.8.0
```

### Error: "Cannot find module 'websockets'"

**Cause:** Python dependency not installed

**Solution:**
```bash
pip install websockets
```

### Error: "Page blank / navigation timeout"

**Cause:** Page taking too long to load

**Solution:**
```python
# Increase timeout
await client.navigate(url, timeout=60000)  # 60 seconds

# Or disable JavaScript to speed up
await client.navigate(url, timeout=10000, disable_js=True)
```

### Error: "Rate limit exceeded"

**Cause:** Too many requests in short time

**Solution:**
```python
import asyncio

# Add delay between requests
await ws.send(json.dumps({"id": "1", "command": "navigate", "url": "https://example.com"}))
await ws.recv()
await asyncio.sleep(2)  # Wait 2 seconds

# Check rate limit status
await ws.send(json.dumps({"id": "2", "command": "get_rate_limit_status"}))
response = json.loads(await ws.recv())
print(f"Remaining: {response['data']['remaining']}/{response['data']['limit']}")
```

### Error: "Certificate verification failed"

**Cause:** HTTPS site with invalid certificate

**Solution (dev only):**
```bash
# Python
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

# Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

# cURL
curl --insecure https://...
```

---

## Next Steps

### Learn the API (10 minutes)

1. **Review command categories:**
   - Navigation & Interaction (navigate, click, fill, scroll)
   - Content Extraction (get_content, extract_links, screenshot)
   - Automation (wait_for_element, execute_script)
   - Profile/Identity (set_user_agent, set_proxy, set_cookies)

2. **Read Quick Reference:**
   - [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md) - Overview
   - [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md) - Full guide with examples
   - [API-REFERENCE-AUTHORITATIVE.md](API-REFERENCE-AUTHORITATIVE.md) - Complete command reference

3. **See Real Examples:**
   - [EXAMPLES.md](EXAMPLES.md) - Web scraping, forensics, form filling
   - [integrations/README.md](../integrations/README.md) - Client libraries

### Build Your First Workflow (30 minutes)

```python
# Example: Scrape product information
async def scrape_products(url):
    async with websockets.connect("ws://localhost:8765") as ws:
        # 1. Navigate
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": url
        }))
        await ws.recv()
        await asyncio.sleep(2)
        
        # 2. Wait for products to load
        await ws.send(json.dumps({
            "id": "2",
            "command": "wait_for_element",
            "selector": ".product",
            "timeout": 10000
        }))
        await ws.recv()
        
        # 3. Extract product data
        await ws.send(json.dumps({
            "id": "3",
            "command": "execute_script",
            "script": """
            return Array.from(document.querySelectorAll('.product')).map(el => ({
                name: el.querySelector('.name').textContent,
                price: el.querySelector('.price').textContent,
                url: el.querySelector('a').href
            }));
            """
        }))
        response = json.loads(await ws.recv())
        return response['data']['result']

# Run it
products = asyncio.run(scrape_products("https://example.com/products"))
print(f"Found {len(products)} products")
```

### Explore Advanced Features

- **Bot Evasion:** Set user agents, proxies, fingerprints
  - See: [Bot Detection Evasion](README.md#bot-detection-evasion) section or advanced docs
  
- **Forensic Capture:** Extract evidence for legal cases
  - See: [FORENSIC-EVIDENCE-EXPORT-GUIDE](guides/FORENSIC-EVIDENCE-EXPORT-GUIDE-2026-05-31.md) in advanced docs
  
- **Multi-Profile Sessions:** Manage multiple accounts simultaneously
  - See: Advanced profiles documentation in [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)
  
- **Rate Limiting:** Understand and respect API limits
  - See: [RATE-LIMITING.md](RATE-LIMITING.md)

---

## Command Categories at a Glance

| Category | Common Commands | Use Case |
|----------|-----------------|----------|
| **Navigation** | navigate, back, forward, refresh | Basic browsing |
| **Interaction** | click, fill, scroll, type | Form filling, clicking |
| **Content** | get_content, extract_links, screenshot | Data extraction |
| **Evasion** | set_user_agent, set_proxy, set_cookies | Anti-detection |
| **Forensics** | capture_html, capture_dom_snapshot, export_forensic_data | Evidence capture |
| **Automation** | wait_for_element, execute_script | Complex workflows |

---

## Configuration Basics

### Connection

```python
# Default (localhost)
url = "ws://localhost:8765"

# Production
url = "wss://api.basset-hound.cloud"

# Custom host
url = f"ws://{os.environ.get('BASSET_HOST', 'localhost')}:8765"
```

### Environment Variables

```bash
# Connection
export BASSET_URL=ws://localhost:8765
export BASSET_TOKEN=your_api_token

# Logging (python)
export BASSET_LOG_LEVEL=debug

# TLS (production)
export BASSET_TLS_CERT=/path/to/cert.pem
export BASSET_TLS_KEY=/path/to/key.pem
```

---

## Getting Help

### Documentation
- **Full API Reference:** [API-REFERENCE-AUTHORITATIVE.md](API-REFERENCE-AUTHORITATIVE.md)
- **Code Examples:** [EXAMPLES.md](EXAMPLES.md)
- **OpenAPI Spec:** [openapi.yaml](openapi.yaml)

### Troubleshooting
- **Common Errors:** See [Troubleshooting](#troubleshooting) section above
- **Rate Limiting:** [RATE-LIMITING.md](RATE-LIMITING.md)
- **Performance:** [PERFORMANCE-OPTIMIZATION-QUICK-REFERENCE.md](PERFORMANCE-OPTIMIZATION-QUICK-REFERENCE.md)

### Support
- **Issues:** https://github.com/basset-hound/basset-hound-browser/issues
- **Discussions:** https://github.com/basset-hound/basset-hound-browser/discussions
- **Email:** support@basset-hound.dev

---

## What's Next?

**After first command works:**

1. ✅ Read [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md) for workflows
2. ✅ Explore [API-REFERENCE-AUTHORITATIVE.md](API-REFERENCE-AUTHORITATIVE.md) for all commands
3. ✅ Review [EXAMPLES.md](EXAMPLES.md) for real-world use cases
4. ✅ Check [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md) for production setup
5. ✅ Deploy using [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)

---

**Happy automating!** 🚀
