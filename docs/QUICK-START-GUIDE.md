> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

# Basset Hound Browser - Quick Start Guide

**Version:** 12.8.0  
**Last Updated:** June 21, 2026  
**Status:** Production Ready

## Quick Navigation

1. [Installation](#installation)
2. [Connection](#connection)
3. [Basic Usage](#basic-usage)
4. [Common Workflows](#common-workflows)
5. [Troubleshooting](#troubleshooting)
6. [Next Steps](#next-steps)

---

## Installation

### Prerequisites
- Node.js 14+ OR Python 3.8+
- WebSocket support in your client library
- Network access to Basset Hound Browser instance (port 8765)

### Node.js Client

```bash
npm install basset-hound-client
# or
yarn add basset-hound-client
```

### Python Client

```bash
pip install basset-hound-client
# or
pip install websockets
```

### Docker Deployment

```bash
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  --network basset-hound-browser \
  basset-hound-browser:12.8.0
```

---

## Connection

### JavaScript/Node.js

```javascript
const { BassetClient } = require('basset-hound-client');

// Create client
const client = new BassetClient({
  url: 'ws://localhost:8765',
  timeout: 30000,
  token: process.env.BASSET_TOKEN  // Optional
});

// Connect
await client.connect();

// Use client...
const screenshot = await client.screenshot();

// Disconnect
await client.disconnect();
```

### Python

```python
import asyncio
from basset_hound import BassetClient

async def main():
    # Create client
    client = BassetClient(
        url='ws://localhost:8765',
        timeout=30000,
        token=os.environ.get('BASSET_TOKEN')
    )
    
    # Connect
    await client.connect()
    
    # Use client...
    screenshot = await client.screenshot()
    
    # Disconnect
    await client.disconnect()

# Run
asyncio.run(main())
```

### Environment Variables

Create a `.env` file for sensitive configuration:

```bash
# Connection
BASSET_URL=ws://localhost:8765
BASSET_TOKEN=your_api_token_here

# Logging
BASSET_LOG_LEVEL=info
```

---

## Basic Usage

### 1. Navigate to a Website

```javascript
// JavaScript
await client.navigate('https://example.com');
await client.navigate('https://example.com', {
  waitUntil: 'networkidle2'  // Wait for network idle
});
```

```python
# Python
await client.navigate(url='https://example.com')
await client.navigate(
    url='https://example.com',
    wait_until='networkidle2'
)
```

### 2. Take a Screenshot

```javascript
// Full page screenshot
const screenshot = await client.screenshot({ fullPage: true });

// Viewport screenshot
const screenshot = await client.screenshot();

// Element screenshot
const element = await client.screenshotElement('body > header');
```

```python
# Full page
screenshot = await client.screenshot(full_page=True)

# Viewport
screenshot = await client.screenshot()

# Element
element = await client.screenshot_element('body > header')
```

### 3. Interact with Page

```javascript
// Click element
await client.click('button.submit');

// Fill input
await client.fill('input[name=email]', 'user@example.com');

// Type text (with delay for human-like behavior)
await client.typeText('search text', { delay: 100 });

// Scroll
await client.scroll({ x: 0, y: 1000 });

// Wait for element
await client.waitForSelector('div.results', { timeout: 10000 });
```

```python
# Click
await client.click(selector='button.submit')

# Fill
await client.fill(
    selector='input[name=email]',
    text='user@example.com'
)

# Type
await client.type_text(text='search text', delay=100)

# Scroll
await client.scroll(x=0, y=1000)

# Wait
await client.wait_for_selector(
    selector='div.results',
    timeout=10000
)
```

### 4. Extract Content

```javascript
// Get page content
const content = await client.getContent({ type: 'text' });
const html = await client.getContent({ type: 'html' });

// Get current URL
const { url } = await client.getUrl();

// Get page title
const { title } = await client.getTitle();

// Execute JavaScript
const result = await client.executeScript(
  'return document.querySelectorAll("a").length'
);
```

```python
# Get content
content = await client.get_content(type='text')
html = await client.get_content(type='html')

# Get URL
url_data = await client.get_url()

# Get title
title_data = await client.get_title()

# Execute JavaScript
result = await client.execute_script(
    'return document.querySelectorAll("a").length'
)
```

---

## Common Workflows

### Workflow 1: Web Scraping with Evidence

```javascript
const client = new BassetClient({ url: 'ws://localhost:8765' });
await client.connect();

try {
  // 1. Navigate
  await client.navigate('https://example.com/products');
  
  // 2. Wait for content
  await client.waitForSelector('div.product-list');
  
  // 3. Extract data
  const products = await client.executeScript(
    `return Array.from(document.querySelectorAll('.product')).map(el => ({
      name: el.querySelector('.name').textContent,
      price: el.querySelector('.price').textContent,
      url: el.querySelector('a').href
    }))`
  );
  
  // 4. Take screenshot for evidence
  const screenshot = await client.screenshot({ fullPage: true });
  
  // 5. Capture as evidence
  const evidence = await client.captureScreenshotEvidence({
    imageData: screenshot.imageData,
    url: 'https://example.com/products',
    title: 'Product List Capture',
    fullPage: true
  });
  
  console.log('Scraped products:', products);
  console.log('Evidence ID:', evidence.evidenceId);
  
} finally {
  await client.disconnect();
}
```

### Workflow 2: Forensic Evidence Capture

```javascript
const client = new BassetClient({ url: 'ws://localhost:8765' });
await client.connect();

try {
  // 1. Start network forensics capture
  await client.startNetworkForensics({
    enableHashing: true,
    enableTimeline: true
  });
  
  // 2. Navigate to target
  await client.navigate('https://example.com');
  
  // 3. Interact
  await client.click('button.load-more');
  await new Promise(r => setTimeout(r, 2000));  // Wait for network
  
  // 4. Capture screenshots
  const screenshot = await client.screenshot();
  const domSnapshot = await client.executeSc('return document.documentElement.outerHTML');
  
  // 5. Capture evidence
  const screenEvidence = await client.captureScreenshotEvidence({
    imageData: screenshot.imageData,
    url: 'https://example.com'
  });
  
  const domEvidence = await client.captureDomEvidence({
    domString: domSnapshot,
    url: 'https://example.com'
  });
  
  // 6. Stop forensics and get results
  const forensicsResult = await client.stopNetworkForensics();
  
  console.log('Forensics captured:');
  console.log(`- DNS queries: ${forensicsResult.itemsCaptured.dnsQueries}`);
  console.log(`- TLS certs: ${forensicsResult.itemsCaptured.tlsCertificates}`);
  console.log(`- HTTP headers: ${forensicsResult.itemsCaptured.httpHeaders}`);
  
} finally {
  await client.disconnect();
}
```

### Workflow 3: Session Management with Evasion

```javascript
const client = new BassetClient({ url: 'ws://localhost:8765' });
await client.connect();

try {
  // 1. Create isolated profile
  const profile = await client.createProfile('evasion-session-1');
  
  // 2. Set evasion parameters
  await client.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await client.setGeolocation(34.0522, -118.2437, 100);  // Los Angeles
  await client.setTimezone('America/Los_Angeles');
  await client.setLocale('en-US');
  
  // 3. Set proxy (optional)
  await client.setProxy({
    proxyType: 'http',
    host: '127.0.0.1',
    port: 8080
  });
  
  // 4. Navigate and interact
  await client.navigate('https://httpbin.org/user-agent');
  const result = await client.getContent({ type: 'text' });
  
  console.log('User-Agent seen by server:', result);
  
  // 5. Capture session state
  const cookies = await client.getCookies();
  const localStorage = await client.getLocalStorage();
  
  console.log('Cookies captured:', cookies.length);
  console.log('Local storage items:', Object.keys(localStorage).length);
  
} finally {
  await client.disconnect();
}
```

### Workflow 4: Batch Operations

```javascript
const client = new BassetClient({ url: 'ws://localhost:8765' });
await client.connect();

try {
  const urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3'
  ];
  
  const results = [];
  
  for (const url of urls) {
    try {
      // Navigate
      await client.navigate(url);
      
      // Extract title
      const { title } = await client.getTitle();
      
      // Take screenshot
      const screenshot = await client.screenshot();
      
      // Store result
      results.push({
        url,
        title,
        screenshotSize: screenshot.imageData.length,
        timestamp: new Date().toISOString()
      });
      
      // Rate limit check
      const limits = await client.getRateLimitStatus();
      console.log(`Processed ${results.length}/${urls.length} - ` +
        `${limits.remaining} requests remaining`);
      
      // Respect rate limits
      if (limits.remaining < 5) {
        console.log('Rate limit approaching, waiting...');
        await new Promise(r => setTimeout(r, 10000));
      }
      
    } catch (error) {
      console.error(`Failed to process ${url}:`, error.message);
      results.push({ url, error: error.message });
    }
  }
  
  console.log('Batch processing complete:', results);
  
} finally {
  await client.disconnect();
}
```

### Workflow 5: Form Filling and Submission

```javascript
const client = new BassetClient({ url: 'ws://localhost:8765' });
await client.connect();

try {
  // 1. Navigate to form
  await client.navigate('https://example.com/contact');
  await client.waitForSelector('form');
  
  // 2. Fill form fields
  await client.fill('input[name=firstName]', 'John');
  await client.fill('input[name=lastName]', 'Doe');
  await client.fill('input[name=email]', 'john@example.com');
  await client.fill('textarea[name=message]', 'Hello, I am interested in your services.');
  
  // 3. Select dropdown
  await client.executeScript(
    `document.querySelector('select[name=country]').value = 'US'`
  );
  
  // 4. Check checkbox
  await client.click('input[name=agree]');
  
  // 5. Submit form
  await client.click('button[type=submit]');
  
  // 6. Wait for confirmation
  await client.waitForSelector('div.success-message', { timeout: 5000 });
  
  // 7. Capture proof
  const screenshot = await client.screenshot();
  const evidence = await client.captureScreenshotEvidence({
    imageData: screenshot.imageData,
    url: window.location.href,
    title: 'Form Submission Confirmation'
  });
  
  console.log('Form submitted, evidence ID:', evidence.evidenceId);
  
} catch (error) {
  console.error('Form submission failed:', error);
} finally {
  await client.disconnect();
}
```

---

## Error Handling

### Basic Error Handling

```javascript
const client = new BassetClient({ url: 'ws://localhost:8765' });

try {
  await client.connect();
  await client.navigate('https://example.com');
} catch (error) {
  if (error.name === 'ConnectionError') {
    console.error('Failed to connect to server');
  } else if (error.name === 'TimeoutError') {
    console.error('Command timeout:', error.command);
  } else if (error.name === 'RateLimitError') {
    console.error('Rate limited, retry after:', error.rateLimit.retryAfter, 'ms');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Retry with Exponential Backoff

```javascript
async function executeWithRetry(client, command, params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.execute(command, params);
    } catch (error) {
      if (error.name === 'RateLimitError') {
        // Respect rate limit
        const wait = error.rateLimit.retryAfter || 1000 * Math.pow(2, attempt);
        console.log(`Rate limited, waiting ${wait}ms before retry...`);
        await new Promise(r => setTimeout(r, wait));
      } else if (error.name === 'TimeoutError' && attempt < maxRetries - 1) {
        // Retry on timeout
        const wait = 1000 * Math.pow(2, attempt);
        console.log(`Timeout, waiting ${wait}ms before retry...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw error;
      }
    }
  }
}

// Usage
const result = await executeWithRetry(client, 'screenshot', { fullPage: true });
```

---

## Rate Limiting

### Understanding Rate Limits

The API enforces per-command rate limiting:

| Client Type | Global Limit | Window |
|------------|--------------|--------|
| Unauthenticated | 100 req/min | 60 seconds |
| Authenticated | 1000 req/min | 60 seconds |

Command-specific limits:
- `screenshot`, `screenshot_full_page`: 5 req/min
- `navigate`: 15 req/min
- `execute_script`: 20 req/min
- `get_content`, `get_url`: 100 req/min

### Check Rate Limit Status

```javascript
// Get rate limit info
const limits = await client.getRateLimitStatus();
console.log(`Remaining: ${limits.remaining}/${limits.limit}`);
console.log(`Resets at: ${new Date(limits.resetAt)}`);

// Respect limits before making requests
if (limits.remaining < 5) {
  const wait = limits.resetAt - Date.now();
  console.log(`Waiting ${wait}ms for rate limit reset...`);
  await new Promise(r => setTimeout(r, wait));
}
```

### Authenticating for Higher Limits

```javascript
const client = new BassetClient({
  url: 'ws://localhost:8765',
  token: process.env.BASSET_API_TOKEN  // Increases limit from 100 to 1000 req/min
});

await client.connect();
```

---

## Troubleshooting

### Cannot Connect to Server

**Problem:** `ConnectionError: Failed to connect`

**Solutions:**
1. Check server is running: `docker ps | grep basset-hound`
2. Check port 8765 is listening: `netstat -tuln | grep 8765`
3. Verify URL is correct: `ws://localhost:8765`
4. Check firewall rules
5. Try from different machine: `ws://server-ip:8765`

### Timeout Errors

**Problem:** `TimeoutError: Command 'navigate' timeout after 30000ms`

**Solutions:**
1. Increase timeout: `await client.navigate(url, { timeout: 60000 })`
2. Simplify page (disable JS, block ads)
3. Check network connectivity
4. Use proxy or different network
5. Split large operations into smaller commands

### Rate Limit Exceeded

**Problem:** `RateLimitError: Rate limit exceeded`

**Solutions:**
1. Check rate limit status: `await client.getRateLimitStatus()`
2. Add authentication for higher limits
3. Reduce request frequency
4. Implement exponential backoff retry
5. Batch operations (parallel doesn't increase limit)

### Memory Issues

**Problem:** Responses incomplete or connection drops

**Solutions:**
1. Use viewport screenshots instead of full-page
2. Break operations into smaller batches
3. Cleanup resources regularly
4. Monitor memory with `docker stats`
5. Consider compression: `gzip` or `brotli`

### SSL/TLS Certificate Errors

**Problem:** `Error: unable to verify the first certificate`

**Solutions:**
```bash
# Use self-signed certificate (dev only)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Or specify CA certificate
export NODE_EXTRA_CA_CERTS=/path/to/ca-cert.pem
```

---

## Next Steps

1. **Read Full API Reference**
   - `/docs/api/API-REFERENCE-AUTHORITATIVE.md`
   - Contains all 140+ commands

2. **View Examples**
   - `/docs/EXAMPLES.md` - Real-world workflow examples
   - `clients/nodejs/examples/` - Node.js examples
   - `clients/python/examples.py` - Python examples

3. **Integration**
   - Check `/integration_readiness.md` for integration status
   - Review `/docs/SCOPE.md` for architectural boundaries

4. **Advanced Features**
   - Forensic evidence capture
   - Network forensics
   - Session management
   - Evasion frameworks

5. **Monitoring & Debugging**
   - Enable debug logging: `logLevel: 'debug'`
   - Monitor rate limits
   - Use WebSocket inspector tools

6. **Deployment**
   - Review `docs/DEPLOYMENT.md`
   - Check `scripts/deploy.sh` for production deployment
   - Configure environment variables

---

## Getting Help

### API Issues
- Check `/docs/api/API-REFERENCE-AUTHORITATIVE.md` for command docs
- Review error codes in `/QUICK-START-GUIDE.md#error-handling`

### Connection Issues
- Verify Docker container is running
- Check logs: `docker logs basset-hound`
- Review `/SECURITY.md` for security config

### Performance Issues
- Check `/docs/PERFORMANCE-OPTIMIZATION-QUICK-REFERENCE.md`
- Monitor resource usage with `docker stats`
- Review timeout and compression settings

### Code Examples
- `/clients/nodejs/examples/` - Node.js examples
- `/clients/python/examples.py` - Python examples
- `/docs/EXAMPLES.md` - Full workflow examples

---

## API Status & Support

**Current Version:** 12.8.0 (Production Ready)  
**WebSocket Port:** 8765  
**Default Protocol:** ws:// (TLS available via wss://)  
**Commands:** 140+  
**Categories:** 16

For latest updates and status, visit:
- Repository: https://github.com/basset-hound/browser
- Issues: https://github.com/basset-hound/browser/issues
- Documentation: `/docs/`
