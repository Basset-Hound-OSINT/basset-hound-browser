# Forensic Exports - Troubleshooting Guide

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Navigation Problems](#navigation-problems)
3. [Export Command Issues](#export-command-issues)
4. [Performance Problems](#performance-problems)
5. [Data Quality Issues](#data-quality-issues)
6. [Error Recovery](#error-recovery)
7. [Debugging Tools](#debugging-tools)

---

## Connection Issues

### Problem: "Failed to connect to ws://localhost:8765"

**Symptoms:**
- WebSocket connection times out
- Connection refused error
- Cannot reach the browser server

**Root Causes:**
1. Browser server not running
2. Port 8765 already in use
3. Firewall blocking connection
4. Wrong hostname/port

**Solutions:**

**Step 1: Verify server is running**
```bash
# Check if server is listening on port 8765
netstat -tuln | grep 8765

# Or use lsof
lsof -i :8765
```

**Step 2: Start the server**
```bash
# Via Docker (recommended)
docker run -d -p 8765:8765 --name basset-hound-browser \
  basset-hound-browser:latest

# Via Node.js
cd /path/to/basset-hound-browser
npm install
npm start

# Check logs
docker logs basset-hound-browser
```

**Step 3: Test connection**
```bash
# Using wscat (install: npm install -g wscat)
wscat -c ws://localhost:8765

# Using curl
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8765

# Using telnet
telnet localhost 8765
```

**Step 4: Check firewall**
```bash
# macOS
sudo lsof -i :8765

# Linux
sudo ufw allow 8765

# Windows
netsh advfirewall firewall add rule name="Allow WebSocket" \
  dir=in action=allow protocol=tcp localport=8765
```

**Step 5: Verify network connectivity**
```javascript
// JavaScript test
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('✓ Connected!');
  ws.send(JSON.stringify({ command: 'ping', id: 'test_1' }));
};

ws.onerror = (error) => {
  console.error('✗ Connection error:', error);
};

ws.onmessage = (event) => {
  console.log('Response:', event.data);
  ws.close();
};

setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('✗ Connection failed after 5 seconds');
  }
}, 5000);
```

**If still failing:**
- Check if another process is using port 8765: `lsof -i :8765`
- Kill existing process: `kill -9 <PID>`
- Restart browser server
- Check browser server logs: `docker logs basset-hound-browser --tail 50`

---

## Navigation Problems

### Problem: "No page loaded" or navigation times out

**Symptoms:**
- export_raw_html returns empty HTML
- export_network_log shows no requests
- Navigation command hangs

**Root Causes:**
1. Page takes too long to load (>10s default timeout)
2. URL is unreachable or returns error
3. Page redirects to blocked content
4. JavaScript required but not executed

**Solutions:**

**Step 1: Verify URL is valid**
```bash
curl -v -L https://example.com | head -20
```

**Step 2: Increase wait time**
```javascript
// Default 3 second wait may not be enough
await send(ws, {
  command: 'navigate',
  url: 'https://example.com',
  timeout: 15000,  // 15 seconds
  id: 'nav_1'
});

// For complex pages, wait longer
await new Promise(r => setTimeout(r, 5000));  // 5 seconds instead of 3
```

**Step 3: Use wait_for_element to ensure page loads**
```javascript
// Wait for specific element to appear
await send(ws, {
  command: 'wait_for_element',
  selector: '#main-content',
  timeout: 10000,
  id: 'wait_1'
});

// Then export
await send(ws, {
  command: 'export_raw_html',
  id: 'html_1'
});
```

**Step 4: Check network log to see what loaded**
```javascript
const netData = await send(ws, {
  command: 'export_network_log',
  id: 'net_1'
});

if (netData.data.totalRequests === 0) {
  console.error('✗ No network requests recorded - page may not have loaded');
}

// Check if main document loaded
const mainDoc = netData.data.requests.find(r => 
  r.resourceType === 'document' && 
  r.statusCode === 200
);

if (mainDoc) {
  console.log(`✓ Main document loaded: ${mainDoc.url}`);
  console.log(`  Status: ${mainDoc.statusCode}, Size: ${mainDoc.contentLength} bytes`);
} else {
  console.error('✗ Main document not found or failed');
}
```

**Step 5: Debug with screenshot**
```javascript
// Take screenshot to see current state
const screenshot = await send(ws, {
  command: 'screenshot',
  id: 'screenshot_1'
});

// Save to file to inspect
const fs = require('fs');
fs.writeFileSync('debug-screenshot.png', 
  Buffer.from(screenshot.data.data, 'base64'));

console.log('Screenshot saved to debug-screenshot.png');
```

---

## Export Command Issues

### Problem 1: export_raw_html returns empty or truncated HTML

**Symptoms:**
- `htmlLength` is 0 or much smaller than expected
- HTML contains only `<html><body></body></html>`
- Response headers are empty

**Root Causes:**
1. Page hasn't finished loading when export runs
2. Page uses JavaScript to render content (SPA)
3. Page blocked our request (403, 401)
4. Content loaded asynchronously after initial render

**Solutions:**

**Solution 1: Add wait time for SPA pages**
```javascript
// For Single Page Applications
await send(ws, { command: 'navigate', url, id: 'nav_1' });

// Wait for React/Vue/Angular to render
await new Promise(r => setTimeout(r, 5000));

// Wait for specific content
await send(ws, {
  command: 'wait_for_element',
  selector: '[data-testid="main-content"]',
  timeout: 10000,
  id: 'wait_1'
});

// Now export
const htmlData = await send(ws, {
  command: 'export_raw_html',
  includeMetadata: true,
  id: 'html_1'
});
```

**Solution 2: Execute JavaScript to trigger rendering**
```javascript
// Force page to fully render
await send(ws, {
  command: 'execute_script',
  script: `
    // Trigger any lazy-loaded content
    document.addEventListener('load', function() {
      console.log('Page fully loaded');
    });
    
    // Scroll to bottom to trigger infinite scroll
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));
  `,
  id: 'exec_1'
});
```

**Solution 3: Check what HTTP status code was returned**
```javascript
const htmlData = await send(ws, {
  command: 'export_raw_html',
  includeMetadata: true,
  id: 'html_1'
});

if (htmlData.data.statusCode === 403) {
  console.error('✗ Access forbidden (403)');
  console.error('  Possible causes:');
  console.log('  - IP address blocked');
  console.log('  - User-Agent blocked');
  console.log('  - Require bot detection evasion');
  
  // Try with different user-agent
  await send(ws, {
    command: 'set_user_agent',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    id: 'ua_1'
  });
  
  // Retry navigation
  await send(ws, { command: 'navigate', url, id: 'nav_retry' });
}
```

### Problem 2: export_network_log shows no or few requests

**Symptoms:**
- `totalRequests` is 0
- Network log is empty
- Missing expected API calls

**Root Causes:**
1. Requests haven't been recorded yet (timing issue)
2. Requests are being filtered out
3. Page is cached (304 Not Modified)
4. Requests happened before we started recording

**Solutions:**

**Solution 1: Export network log AFTER page fully loads**
```javascript
// Step 1: Navigate
await send(ws, {
  command: 'navigate',
  url: 'https://example.com',
  id: 'nav_1'
});

// Step 2: Wait for all requests to complete
// Use wait_for_navigation to ensure all requests finish
await send(ws, {
  command: 'wait_for_navigation',
  timeout: 10000,
  id: 'wait_1'
});

// Step 3: Then export (requests are now recorded)
const networkData = await send(ws, {
  command: 'export_network_log',
  id: 'net_1'
});

console.log(`Captured ${networkData.data.totalRequests} requests`);
```

**Solution 2: Export without filters first**
```javascript
// Get all requests without filtering
const allRequests = await send(ws, {
  command: 'export_network_log',
  limit: 10000,  // Max requests
  id: 'net_all'
});

console.log(`Total: ${allRequests.data.totalRequests}`);
console.log(`First request: ${allRequests.data.requests[0]?.url}`);

// Check resource types
const types = {};
allRequests.data.requests.forEach(r => {
  types[r.resourceType] = (types[r.resourceType] || 0) + 1;
});
console.log('By type:', types);
```

**Solution 3: Check if requests are blocked**
```javascript
// Some requests might be blocked (by ad blockers, etc.)
const networkData = await send(ws, {
  command: 'export_network_log',
  id: 'net_1'
});

// Check for blocked requests
const blockedCount = networkData.data.requests.filter(r => 
  r.statusCode === 0 || r.statusCode === null
).length;

if (blockedCount > 0) {
  console.warn(`⚠ ${blockedCount} requests were blocked`);
}

// Check by status code
const statusCodes = networkData.data.statistics.byStatusCode;
console.log('Requests by status:', statusCodes);
```

### Problem 3: export_device_ids returns missing fingerprint data

**Symptoms:**
- `fingerprint.canvas` is null or empty
- `fingerprint.webgl` is missing
- Fingerprint confidence is very low (<0.5)

**Root Causes:**
1. Page hasn't fully loaded (fingerprinting happens asynchronously)
2. Canvas/WebGL not available on this page
3. Fingerprinting disabled in evasion settings
4. Browser doesn't support certain APIs

**Solutions:**

**Solution 1: Wait for page to fully load**
```javascript
// Fingerprinting happens after page load
await send(ws, { command: 'navigate', url, id: 'nav_1' });
await new Promise(r => setTimeout(r, 4000));  // Wait 4 seconds

// Now export device data
const deviceData = await send(ws, {
  command: 'export_device_ids',
  includeFingerprints: true,
  id: 'device_1'
});

if (!deviceData.data.fingerprint.canvas) {
  console.warn('⚠ Canvas fingerprint not available');
}
```

**Solution 2: Check if page loads Canvas/WebGL**
```javascript
// Execute script to check canvas support
const result = await send(ws, {
  command: 'execute_script',
  script: `
    return {
      canvasSupported: !!document.createElement('canvas').getContext('2d'),
      webglSupported: !!document.createElement('canvas').getContext('webgl'),
      canvasImagesCount: document.querySelectorAll('canvas').length
    };
  `,
  id: 'check_1'
});

console.log('Canvas support:', result.data.result);
```

---

## Performance Problems

### Problem 1: Commands are very slow (>1 second)

**Symptoms:**
- Commands take 5-10 seconds to complete
- Network requests are slow
- export_network_log times out

**Root Causes:**
1. Server is under heavy load
2. Page has large number of requests (1000+)
3. Network is slow (high latency)
4. Large response payload (>100MB)

**Solutions:**

**Solution 1: Filter network log to reduce payload**
```javascript
// Instead of exporting all requests (slow)
const slowRequests = await send(ws, {
  command: 'export_network_log',
  minDuration: 500,  // Only slow requests
  limit: 100,        // Cap number returned
  id: 'net_1'
});

// Only specific types
const xhrRequests = await send(ws, {
  command: 'export_network_log',
  resourceType: 'xhr',  // Just API calls
  id: 'net_xhr'
});
```

**Solution 2: Check server load**
```bash
# Check CPU usage
top -l 1 | grep basset-hound

# Check memory usage
docker stats basset-hound-browser

# Check open connections
netstat -an | grep 8765 | wc -l
```

**Solution 3: Optimize page capture**
```javascript
// Don't include unnecessary metadata
const htmlData = await send(ws, {
  command: 'export_raw_html',
  includeMetadata: false,  // Faster
  id: 'html_1'
});

// Capture HTML then selectively get metadata
const device = await send(ws, {
  command: 'export_device_ids',
  id: 'device_1'
});
```

### Problem 2: Memory usage growing unbounded

**Symptoms:**
- Server memory increases with each command
- Eventually reaches 100% and crashes
- No memory being freed

**Root Causes:**
1. Large pages not being garbage collected
2. Large network logs accumulated
3. Screenshots cached in memory
4. Session data leaking

**Solutions:**

**Solution 1: Clear session between captures**
```javascript
// Capture page
const data = await send(ws, { command: 'export_raw_html', id: 'html_1' });

// Clear memory
await send(ws, {
  command: 'clear_cache',
  id: 'clear_1'
});

// Or create new session for each capture
await send(ws, {
  command: 'create_session',
  id: 'new_session'
});
```

**Solution 2: Close unused WebSocket connections**
```javascript
// WRONG: Keeps connection open
const ws = new WebSocket('ws://localhost:8765');
ws.send(JSON.stringify({ command: 'navigate', url, id: 'nav_1' }));

// RIGHT: Close after use
const ws = new WebSocket('ws://localhost:8765');
try {
  await send(ws, { command: 'navigate', url, id: 'nav_1' });
} finally {
  ws.close();
}
```

**Solution 3: Monitor server metrics**
```bash
# Monitor memory every 5 seconds
watch -n 5 'docker stats basset-hound-browser'

# Get memory usage
docker stats basset-hound-browser --no-stream --format "table {{.MemUsage}}"

# If memory keeps growing, restart
docker restart basset-hound-browser
```

---

## Data Quality Issues

### Problem 1: Network log has missing or duplicate requests

**Symptoms:**
- Same request appears twice
- Some requests appear in page but not in log
- Request counts inconsistent

**Root Causes:**
1. Requests are being retried
2. Network log not fully populated yet
3. Filtering is removing requests
4. Timing issue with concurrent exports

**Solutions:**

**Solution 1: Wait before exporting network log**
```javascript
// Wait for all in-flight requests to complete
await send(ws, {
  command: 'wait_for_navigation',
  timeout: 10000,
  id: 'wait_1'
});

// Then export (allows network log to fully populate)
const networkData = await send(ws, {
  command: 'export_network_log',
  id: 'net_1'
});
```

**Solution 2: Use network log with detailed options**
```javascript
// Get complete network data
const networkData = await send(ws, {
  command: 'export_network_log',
  includeRequest: true,      // Include request headers
  includeResponse: true,     // Include response headers
  limit: 10000,              // Don't truncate
  id: 'net_1'
});

// Check for duplicates
const urlCounts = {};
networkData.data.requests.forEach(req => {
  const key = `${req.method}:${req.url}:${req.statusCode}`;
  urlCounts[key] = (urlCounts[key] || 0) + 1;
});

const duplicates = Object.entries(urlCounts)
  .filter(([_, count]) => count > 1)
  .map(([url, count]) => ({ url, count }));

if (duplicates.length > 0) {
  console.warn('⚠ Found duplicate requests:');
  duplicates.forEach(d => console.log(`  ${d.url} (${d.count}x)`));
}
```

### Problem 2: Fingerprints keep changing on same page

**Symptoms:**
- Canvas hash different each time
- WebGL hash different
- Fingerprint confidence varies

**Root Causes:**
1. Evasion randomization is enabled
2. Page is actually rendering different content
3. API response is non-deterministic
4. Timing affects fingerprinting

**Solutions:**

**Solution 1: Use consistent evasion profile**
```javascript
// Disable randomization for testing
await send(ws, {
  command: 'set_evasion_mode',
  mode: 'static',  // Don't randomize
  id: 'ev_1'
});

// Now fingerprints should be consistent
const device1 = await send(ws, {
  command: 'export_device_ids',
  id: 'device_1'
});

// Same page, same fingerprint
await send(ws, { command: 'navigate', url, id: 'nav_2' });
await new Promise(r => setTimeout(r, 3000));

const device2 = await send(ws, {
  command: 'export_device_ids',
  id: 'device_2'
});

console.log('Fingerprints match:', 
  device1.data.fingerprint.canvas.hash === device2.data.fingerprint.canvas.hash);
```

---

## Error Recovery

### Pattern 1: Graceful Error Handling

```javascript
async function robustExport(url) {
  const results = {
    success: true,
    errors: [],
    data: {}
  };
  
  try {
    // Navigate with retry
    let navSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await send(ws, {
          command: 'navigate',
          url: url,
          timeout: 15000,
          id: `nav_${attempt}`
        });
        navSuccess = true;
        break;
      } catch (error) {
        results.errors.push(`Navigation attempt ${attempt} failed: ${error.message}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }
    
    if (!navSuccess) {
      results.success = false;
      return results;
    }
    
    // Wait for page
    await new Promise(r => setTimeout(r, 4000));
    
    // Export with error handling for each command
    const exports = [
      { name: 'html', command: 'export_raw_html', params: { includeMetadata: true } },
      { name: 'network', command: 'export_network_log', params: { limit: 1000 } },
      { name: 'device', command: 'export_device_ids', params: { includeFingerprints: true } }
    ];
    
    for (const exp of exports) {
      try {
        const response = await send(ws, {
          command: exp.command,
          ...exp.params,
          id: `${exp.name}_1`
        });
        results.data[exp.name] = response.data;
      } catch (error) {
        results.errors.push(`${exp.name} export failed: ${error.message}`);
        // Continue with other exports
      }
    }
  } catch (error) {
    results.success = false;
    results.errors.push(`Unexpected error: ${error.message}`);
  }
  
  return results;
}

// Usage
const results = await robustExport('https://example.com');
if (results.success) {
  console.log('✓ Export successful');
} else {
  console.log('✗ Export failed with errors:');
  results.errors.forEach(e => console.log(`  - ${e}`));
}
```

---

## Debugging Tools

### Tool 1: Network Inspector Script

```javascript
async function inspectNetworkDeep() {
  const networkData = await send(ws, {
    command: 'export_network_log',
    id: 'net_full'
  });
  
  console.log('=== NETWORK INSPECTION ===\n');
  
  // Summary
  console.log('SUMMARY:');
  console.log(`  Total requests: ${networkData.data.totalRequests}`);
  console.log(`  Total size: ${(networkData.data.statistics.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total time: ${networkData.data.statistics.totalDuration}ms`);
  
  // By status code
  console.log('\nSTATUS CODES:');
  for (const [code, count] of Object.entries(networkData.data.statistics.byStatusCode)) {
    const requests = networkData.data.requests.filter(r => r.statusCode == code);
    const size = requests.reduce((sum, r) => sum + r.contentLength, 0);
    console.log(`  ${code}: ${count} requests, ${(size / 1024).toFixed(1)} KB`);
  }
  
  // Slowest
  console.log('\nSLOWEST REQUESTS:');
  networkData.data.requests
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5)
    .forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.duration}ms - ${req.url.substring(0, 60)}...`);
    });
  
  // Largest
  console.log('\nLARGEST REQUESTS:');
  networkData.data.requests
    .sort((a, b) => b.contentLength - a.contentLength)
    .slice(0, 5)
    .forEach((req, i) => {
      console.log(`  ${i + 1}. ${(req.contentLength / 1024 / 1024).toFixed(2)}MB - ${req.url.substring(0, 60)}...`);
    });
}
```

### Tool 2: Fingerprint Verification Script

```javascript
async function verifyFingerprintConsistency(url, iterations = 3) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    // Fresh navigation
    await send(ws, {
      command: 'navigate',
      url: url,
      id: `nav_${i}`
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Get fingerprint
    const device = await send(ws, {
      command: 'export_device_ids',
      id: `device_${i}`
    });
    
    results.push({
      iteration: i + 1,
      canvas: device.data.fingerprint.canvas?.hash || 'N/A',
      webgl: device.data.fingerprint.webgl?.hash || 'N/A',
      userAgent: device.data.deviceIdentifiers.userAgent.substring(0, 30),
      timestamp: Date.now()
    });
  }
  
  // Analysis
  console.log('FINGERPRINT CONSISTENCY:\n');
  results.forEach(r => {
    console.log(`Iteration ${r.iteration}:`);
    console.log(`  Canvas: ${r.canvas.substring(0, 16)}...`);
    console.log(`  WebGL:  ${r.webgl.substring(0, 16)}...`);
    console.log(`  UA:     ${r.userAgent}...`);
  });
  
  // Check consistency
  const allCanvasSame = new Set(results.map(r => r.canvas)).size === 1;
  const allWebglSame = new Set(results.map(r => r.webgl)).size === 1;
  
  console.log('\nCONSISTENCY:');
  console.log(`  Canvas: ${allCanvasSame ? '✓ CONSISTENT' : '✗ VARYING'}`);
  console.log(`  WebGL:  ${allWebglSame ? '✓ CONSISTENT' : '✗ VARYING'}`);
}
```

---

**Need more help?** Check the [Quick Start Guide](./FORENSIC-EXPORTS-QUICK-START.md) or [API Reference](../../archive/deprecated/FORENSIC-EXPORTS-API-REFERENCE.md).
