# Forensic Exports - 5-Minute Quick Start Guide

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Status:** Production Ready

## What is Forensic Export?

Forensic export is a set of 4 WebSocket commands that capture and analyze browser state for forensic investigation, bot detection evasion verification, and compliance auditing:

1. **export_raw_html** - Capture page HTML with HTTP status codes and response headers
2. **export_network_log** - Export network requests with statistics and filtering
3. **export_device_ids** - Export device fingerprints and browser identifiers
4. **modify_element** - Modify DOM elements for testing and verification

---

## Getting Started (5 Minutes)

### Step 1: Start the Browser Server

```bash
# Via Docker (recommended)
docker run -d -p 8765:8765 basset-hound-browser:latest

# Via Node.js (development)
npm start
```

Verify it's running: Open `ws://localhost:8765` in your WebSocket client.

### Step 2: Connect Your Client

**Node.js/JavaScript:**
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('Connected to Basset Hound Browser');
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

**Python:**
```python
import asyncio
from basset_hound import BrowserClient

async def main():
    async with BrowserClient('ws://localhost:8765') as client:
        # Commands go here
        pass

asyncio.run(main())
```

**cURL (Testing):**
```bash
# Test connection
wscat -c ws://localhost:8765
```

### Step 3: Navigate to a Page

```javascript
const navigationCommand = {
  command: 'navigate',
  url: 'https://example.com',
  id: 'nav_1'
};

ws.send(JSON.stringify(navigationCommand));

// Wait for response (2-4 seconds for page load)
await new Promise(resolve => setTimeout(resolve, 3000));
```

**Expected response:**
```json
{
  "id": "nav_1",
  "command": "navigate",
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain"
  }
}
```

---

## The 4 Forensic Export Commands

### 1. Export Raw HTML (Capture Page Content)

**Use Case:** Archive page HTML with HTTP metadata for forensic analysis and compliance

```javascript
const command = {
  command: 'export_raw_html',
  includeMetadata: true,
  id: 'html_1'
};

ws.send(JSON.stringify(command));
```

**Response (Success):**
```json
{
  "id": "html_1",
  "command": "export_raw_html",
  "success": true,
  "data": {
    "url": "https://example.com",
    "statusCode": 200,
    "contentType": "text/html; charset=utf-8",
    "htmlLength": 1234,
    "html": "<!DOCTYPE html><html>...",
    "responseHeaders": {
      "content-type": "text/html; charset=utf-8",
      "server": "ECAcc/3.8.2",
      "cache-control": "max-age=86400"
    },
    "timestamp": 1718863200000
  }
}
```

### 2. Export Network Log (Analyze HTTP Requests)

**Use Case:** Track all network requests, identify tracking, analyze performance

```javascript
// Get all requests
const command = {
  command: 'export_network_log',
  format: 'json',
  id: 'net_1'
};

ws.send(JSON.stringify(command));
```

**Response (Success):**
```json
{
  "id": "net_1",
  "command": "export_network_log",
  "success": true,
  "data": {
    "totalRequests": 47,
    "statistics": {
      "totalSize": 2456789,
      "totalDuration": 3245,
      "byResourceType": {
        "document": { "count": 1, "totalSize": 15000, "totalDuration": 450 },
        "stylesheet": { "count": 3, "totalSize": 25000, "totalDuration": 120 },
        "script": { "count": 12, "totalSize": 250000, "totalDuration": 1200 },
        "xhr": { "count": 5, "totalSize": 50000, "totalDuration": 800 }
      },
      "byStatusCode": { "200": 45, "304": 2 },
      "slowestRequest": { "url": "https://cdn.example.com/app.js", "duration": 1200 },
      "largestRequest": { "url": "https://example.com/data", "contentLength": 250000 }
    },
    "requests": [
      {
        "url": "https://example.com",
        "method": "GET",
        "statusCode": 200,
        "contentLength": 15000,
        "duration": 450,
        "resourceType": "document"
      },
      // ... more requests
    ]
  }
}
```

### 3. Export Device IDs (Get Fingerprints)

**Use Case:** Verify device fingerprints, validate evasion profiles, audit identifiers

```javascript
const command = {
  command: 'export_device_ids',
  id: 'device_1'
};

ws.send(JSON.stringify(command));
```

**Response (Success):**
```json
{
  "id": "device_1",
  "command": "export_device_ids",
  "success": true,
  "data": {
    "deviceIdentifiers": {
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
      "platform": "Win32",
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "language": "en-US",
      "timezone": -300,
      "webdriver": false
    },
    "screen": {
      "width": 1920,
      "height": 1080,
      "colorDepth": 24,
      "orientation": "landscape"
    },
    "fingerprint": {
      "canvas": {
        "hash": "8fe3d4a8c2f9e1b6",
        "confidence": 0.95
      },
      "webgl": {
        "hash": "a1b2c3d4e5f6g7h8",
        "renderer": "ANGLE (Intel HD Graphics 630)"
      },
      "webrtc": {
        "ipv4": "192.168.1.100",
        "ipv6": null
      },
      "storage": {
        "localStorage": 12,
        "sessionStorage": 5,
        "indexedDB": true
      }
    },
    "proxyInfo": {
      "enabled": true,
      "currentProxy": {
        "host": "proxy.example.com",
        "port": 8080
      },
      "rotationMode": "round-robin"
    },
    "timestamp": 1718863200000
  }
}
```

### 4. Modify Element (Test DOM Changes)

**Use Case:** Test website functionality, modify elements for verification, inject test content

```javascript
// Change text content
const command = {
  command: 'modify_element',
  selector: 'h1',
  type: 'text',
  value: 'Modified Title',
  id: 'mod_1'
};

ws.send(JSON.stringify(command));
```

**Response (Success):**
```json
{
  "id": "mod_1",
  "command": "modify_element",
  "success": true,
  "data": {
    "matched": 1,
    "modified": 1,
    "selector": "h1",
    "type": "text"
  }
}
```

---

## Common Workflows

### Workflow 1: Capture Complete Page State

```javascript
async function capturePageState(url) {
  // 1. Navigate
  send({
    command: 'navigate',
    url: url,
    id: 'nav_1'
  });
  await delay(3000); // Wait for load

  // 2. Capture HTML
  send({
    command: 'export_raw_html',
    includeMetadata: true,
    id: 'html_1'
  });

  // 3. Capture Network
  send({
    command: 'export_network_log',
    id: 'net_1'
  });

  // 4. Capture Device
  send({
    command: 'export_device_ids',
    id: 'device_1'
  });

  // Collect all responses
}
```

### Workflow 2: Filter Network Requests

```javascript
// Get only slow requests (>500ms)
send({
  command: 'export_network_log',
  minDuration: 500,
  id: 'slow_1'
});

// Get only XHR/Fetch requests
send({
  command: 'export_network_log',
  resourceType: 'xhr',
  id: 'xhr_1'
});

// Get only error requests (4xx, 5xx)
send({
  command: 'export_network_log',
  statusCode: '4[0-9]{2}|5[0-9]{2}', // regex
  id: 'errors_1'
});
```

### Workflow 3: Validate Evasion Profile

```javascript
// Verify device fingerprint matches expected profile
const deviceData = await send({
  command: 'export_device_ids',
  id: 'device_1'
});

if (deviceData.data.deviceIdentifiers.webdriver === false) {
  console.log('✓ Webdriver detection: PASSED');
} else {
  console.log('✗ Webdriver detection: FAILED');
}

if (deviceData.data.fingerprint.canvas.confidence > 0.9) {
  console.log('✓ Canvas fingerprint: VALID');
}
```

---

## Quick Reference: Command Parameters

| Command | Parameter | Type | Required | Default |
|---------|-----------|------|----------|---------|
| export_raw_html | includeMetadata | boolean | No | false |
| export_raw_html | timeout | number | No | 5000 |
| export_network_log | format | string | No | json |
| export_network_log | resourceType | string | No | all |
| export_network_log | minDuration | number | No | 0 |
| export_network_log | maxDuration | number | No | ∞ |
| export_device_ids | includeProxy | boolean | No | true |
| modify_element | selector | string | Yes | - |
| modify_element | type | string | Yes | - |
| modify_element | value | string/object | Yes | - |
| modify_element | allMatches | boolean | No | false |

---

## Performance Expectations

| Operation | Typical Time | Max Time | Notes |
|-----------|-------------|----------|-------|
| Navigate to page | 2-4 sec | 10 sec | Depends on page complexity |
| export_raw_html | <100 ms | 1 sec | Blocks during HTML serialization |
| export_network_log | 10-50 ms | 500 ms | Filters on size of request log |
| export_device_ids | <50 ms | 100 ms | Pure data collection |
| modify_element | <10 ms | 50 ms | Single selector, scales with DOM size |

---

## Troubleshooting

### Connection Issues

**Problem:** `Failed to connect to ws://localhost:8765`

**Solution:**
```bash
# Check if server is running
curl -i http://localhost:8765

# Restart server
docker restart basset-hound-browser

# Check logs
docker logs basset-hound-browser
```

### Command Timeout

**Problem:** Command never returns a response

**Solution:**
```javascript
// Add timeout to requests
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Command timeout')), 5000)
);

Promise.race([commandPromise, timeoutPromise])
  .catch(err => console.error('Timeout:', err));
```

### Page Not Loaded

**Problem:** `export_raw_html` returns empty HTML or old content

**Solution:**
```javascript
// Wait longer for complex pages
await delay(5000); // Increase from default 3000

// Or use wait_for_element to wait for specific content
send({
  command: 'wait_for_element',
  selector: '#main-content',
  timeout: 10000,
  id: 'wait_1'
});

await getResponse('wait_1');

// Then capture
send({
  command: 'export_raw_html',
  id: 'html_1'
});
```

### Memory Issues with Large Pages

**Problem:** Network log is huge and slow to process

**Solution:**
```javascript
// Filter for important requests only
send({
  command: 'export_network_log',
  resourceType: 'xhr', // Only API requests
  id: 'net_1'
});

// Or limit by duration
send({
  command: 'export_network_log',
  minDuration: 100,  // Only requests >100ms
  id: 'net_1'
});
```

---

## Next Steps

- **Read the [API Reference](./FORENSIC-EXPORTS-API-REFERENCE.md)** for detailed parameter documentation
- **Check [Usage Examples](./FORENSIC-EXPORTS-EXAMPLES.md)** for 8+ real-world patterns
- **See [Troubleshooting Guide](./FORENSIC-EXPORTS-TROUBLESHOOTING.md)** for error recovery
- **Review [Best Practices](./FORENSIC-EXPORTS-BEST-PRACTICES.md)** for security and performance

---

## Support

- **Documentation:** See `/docs/` directory
- **Issues:** Create an issue on GitHub with `[forensic-export]` prefix
- **Examples:** Check `/examples/forensic-export-examples.js`
- **Tests:** Review `/tests/forensic-commands-unit-test.test.js`

---

**Ready to get started?** Try the quick start above, then move on to the API reference for full details.
