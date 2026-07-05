# Advanced Troubleshooting Guide

**Version**: 12.2.0
**Status**: Enterprise Ready
**Last Updated**: June 4, 2026
**Coverage**: 50+ common issues with solutions

## Quick Reference

| Issue | Common Cause | Fix |
|-------|-------------|-----|
| Navigation Timeout | Slow network/page | Increase timeout, use proxy |
| Element Not Found | Page not loaded | Use `wait_for_element` |
| Proxy Errors | Invalid config | Test with `test_proxy` |
| Screenshot Fails | Memory limit | Clear cache, reduce quality |
| Auth Fails | Expired token | Regenerate and refresh token |
| WebSocket Disconnect | Network issue | Implement reconnect logic |

---

## Navigation Issues

### Problem: Navigation Timeout

**Symptoms:**
```
Error: Navigation timeout: Page load exceeded 30000ms
```

**Causes:**
1. Page is genuinely slow
2. Network issues
3. JavaScript errors on page
4. Blocked resources

**Solutions:**

**Step 1: Increase timeout**
```javascript
await client.navigate('https://slow-site.com', {
  timeout: 120000  // 2 minutes instead of 30s
});
```

**Step 2: Use proxy**
```javascript
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  type: 'http'
});
```

**Step 3: Wait for specific element instead**
```javascript
await client.navigate('https://slow-site.com', { timeout: 60000 });
await client.waitForElement('.content', { timeout: 30000 });
```

**Step 4: Check browser logs**
```javascript
const logs = await client.execute('get_console_logs');
console.log(logs);
```

**Root Cause Verification:**
```bash
curl -I https://slow-site.com --connect-timeout 5
# Check if domain is accessible at all
```

---

### Problem: Navigation to .onion URL Fails

**Error:**
```
.onion domains require TOR_MODE=1 at startup
```

**Solution:**

**Start browser with Tor mode:**
```bash
TOR_MODE=1 npm start
```

**Or set programmatically:**
```bash
export TOR_MODE=1
node index.js
```

**Then navigate:**
```javascript
const result = await client.navigate('https://example.onion');
```

---

### Problem: "Page not fully loaded" or Elements Missing

**Symptoms:**
- Elements not found immediately after navigation
- Partial content visible
- Form fields empty

**Solution: Use proper wait strategy**

```javascript
// ❌ WRONG: Navigate and immediately interact
await client.navigate(url);
await client.click('.search');  // May fail!

// ✅ CORRECT: Wait for page state
await client.navigate(url);
const state = await client.getPageState();
if (state.dom_ready) {
  await client.click('.search');
}

// ✅ OR: Wait for specific element
await client.navigate(url);
await client.waitForElement('.search', { visible: true });
await client.click('.search');

// ✅ OR: Use explicit delay
await client.navigate(url);
await new Promise(r => setTimeout(r, 3000));
await client.click('.search');
```

---

## Content Extraction Issues

### Problem: Extract Returns Empty Results

**Symptoms:**
```javascript
const links = await client.extractLinks();
console.log(links.length);  // 0, but links are visible
```

**Causes:**
1. Page not fully loaded
2. Links loaded via JavaScript
3. Incorrect selectors in page

**Solutions:**

**Step 1: Verify page load**
```javascript
const state = await client.getPageState();
console.log(`Ready: ${state.dom_ready}`);
console.log(`Resources: ${state.resources_loaded}`);
```

**Step 2: Wait for JavaScript to load content**
```javascript
await client.navigate(url);
await new Promise(r => setTimeout(r, 5000));  // Wait for JS
const links = await client.extractLinks();
```

**Step 3: Manual JavaScript extraction**
```javascript
const links = await client.executeScript(`
  return Array.from(document.querySelectorAll('a')).map(a => ({
    href: a.href,
    text: a.textContent
  }));
`);
console.log(links);
```

---

### Problem: Image Extract Shows "src" as empty

**Causes:**
- Lazy-loaded images
- Images not in DOM
- Dynamic image loading

**Solution: Scroll before extract**
```javascript
// Scroll to load lazy images
await client.scroll({ selector: 'body', y: document.height });
await new Promise(r => setTimeout(r, 2000));

// Now extract
const images = await client.extractImages();
```

---

## Screenshot Issues

### Problem: Screenshot Returns Blank/Black Image

**Symptoms:**
- Screenshot file created but completely black/white
- Viewport shows blank area

**Causes:**
1. Page not rendered yet
2. Browser not fully initialized
3. Display server issues (headless)

**Solutions:**

**Step 1: Add page load delay**
```javascript
await client.navigate(url);
await new Promise(r => setTimeout(r, 5000));  // Increase delay
const screenshot = await client.screenshot();
```

**Step 2: Check browser status**
```javascript
const status = await client.status();
console.log(`Memory: ${status.memory}%`);
console.log(`Proxy Active: ${status.proxy.active}`);
```

**Step 3: Check page content**
```javascript
const content = await client.getContent();
console.log(`HTML size: ${content.size}`);  // Should be >0
```

**Step 4: Force redraw**
```javascript
await client.executeScript('document.body.style.visibility="visible"');
const screenshot = await client.screenshot();
```

---

### Problem: Screenshot File Too Large

**Symptoms:**
- Screenshot files >20MB
- Upload failures
- Memory errors

**Solutions:**

**Use compression:**
```javascript
const screenshot = await client.screenshot({
  format: 'jpeg',
  quality: 60  // Lower quality = smaller file
});

// Or use webp
const screenshot = await client.screenshot({
  format: 'webp'
});
```

**Reduce area:**
```javascript
// Element only
const screenshot = await client.screenshotElement('.content');

// Area only
const screenshot = await client.screenshotArea({
  x: 0, y: 0, width: 800, height: 600
});
```

**Check memory:**
```javascript
await client.checkMemory();
await client.force_gc();  // Force garbage collection
```

---

## Proxy Issues

### Problem: Proxy Connection Refused

**Error:**
```
Error: Unable to connect to proxy at proxy.example.com:8080
```

**Diagnosis:**

**Step 1: Test proxy independently**
```bash
curl -x http://proxy.example.com:8080 -I https://httpbin.org/ip
```

**Step 2: Verify proxy settings**
```javascript
const status = await client.getProxyStatus();
console.log(status);
```

**Step 3: Test within browser API**
```javascript
const result = await client.testProxy({
  host: 'proxy.example.com',
  port: 8080
});
console.log(`Working: ${result.working}`);
```

**Solutions:**

**Check proxy credentials:**
```javascript
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  auth: {
    username: 'user',
    password: 'pass'  // Verify password
  }
});
```

**Try different proxy type:**
```javascript
// If HTTP fails, try SOCKS5
await client.setProxy({
  host: 'proxy.example.com',
  port: 1080,
  type: 'socks5'
});
```

---

### Problem: Proxy Rotation Not Working

**Symptoms:**
```javascript
await client.startProxyRotation({ proxies: [...] });
const status = await client.getProxyStatus();
// Status shows same proxy repeatedly
```

**Solution:**

**Check rotation settings:**
```javascript
await client.startProxyRotation({
  proxies: [
    { host: 'proxy1.com', port: 8080 },
    { host: 'proxy2.com', port: 8080 },
    { host: 'proxy3.com', port: 8080 }
  ],
  interval: 300000  // 5 minutes
});

// Verify each proxy works
for (const proxy of proxies) {
  const result = await client.testProxy(proxy);
  console.log(`${proxy.host}: ${result.working}`);
}
```

---

## Authentication Issues

### Problem: "Unauthorized" or "Invalid Token"

**Error:**
```
Error: 401 Unauthorized
```

**Solutions:**

**Step 1: Verify token format**
```javascript
const token = process.env.BROWSER_API_TOKEN;
console.log(`Token starts with: ${token.substring(0, 10)}...`);
// Should be: "xoxb-..." or "bearer ..."
```

**Step 2: Check token expiration**
```bash
# Get token info
curl -H "Authorization: Bearer $TOKEN" http://localhost:8766/api/v1/status
```

**Step 3: Regenerate token**
1. Go to admin dashboard
2. Revoke old token
3. Generate new token
4. Update environment variable
5. Restart application

---

## Connection Issues

### Problem: WebSocket Connection Fails

**Error:**
```
Error: WebSocket connection failed
Connection refused at localhost:8765
```

**Diagnosis:**

**Step 1: Verify browser is running**
```bash
lsof -i :8765
# Should show browser process listening
```

**Step 2: Check network**
```bash
nc -zv localhost 8765
# Should respond: Connection succeeded
```

**Step 3: Check URL format**
```javascript
// ✅ CORRECT
const client = new BassetHoundClient({ url: 'ws://localhost:8765' });

// ❌ WRONG
const client = new BassetHoundClient({ url: 'http://localhost:8765' });
```

**Solutions:**

**Start browser if not running:**
```bash
npm start
# Or with Tor
TOR_MODE=1 npm start
```

**Check firewall:**
```bash
sudo ufw allow 8765
```

**Use different port:**
```bash
PORT=9000 npm start

// Then connect to
const client = new BassetHoundClient({ url: 'ws://localhost:9000' });
```

---

### Problem: Frequent Disconnections

**Symptoms:**
```
Connection lost
Reconnecting...
(repeats multiple times)
```

**Solutions:**

**Implement reconnection logic:**
```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  maxReconnect: 10,
  reconnectDelay: 1000
});

client.on('disconnected', () => {
  console.log('Disconnected, will auto-reconnect');
});

client.on('error', (error) => {
  console.error('Connection error:', error);
});
```

**Monitor network:**
```javascript
// Too many rapid requests
setInterval(async () => {
  try {
    const status = await client.status();
    console.log('Connection OK');
  } catch (error) {
    console.error('Connection issue:', error);
  }
}, 60000);  // Check every minute
```

**Check resource limits:**
```bash
# Linux: Check connection limits
ulimit -n
# Should be >1024
```

---

## Memory Issues

### Problem: "Out of Memory" or Memory Growing Rapidly

**Symptoms:**
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed
JavaScript heap out of memory
```

**Solutions:**

**Step 1: Monitor memory**
```javascript
const stats = await client.getMemoryStats();
console.log(`Usage: ${(stats.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Limit: ${(stats.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
```

**Step 2: Clear caches**
```javascript
await client.clearAllCookies();
await client.clearLocalStorage();
await client.clearSessionStorage();
await client.clearCaches();
await client.force_gc();  // Force garbage collection
```

**Step 3: Don't keep large objects in memory**
```javascript
// ❌ WRONG: Accumulating all screenshots
const screenshots = [];
for (const url of urls) {
  await client.navigate(url);
  const ss = await client.screenshot();
  screenshots.push(ss);  // Memory grows!
}

// ✅ CORRECT: Process and discard
for (const url of urls) {
  await client.navigate(url);
  const ss = await client.screenshot();
  // Process immediately
  await saveScreenshot(ss);
  // Let garbage collector reclaim memory
}
```

**Step 4: Increase Node.js heap**
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm start
# Allocate 4GB instead of default 1-2GB
```

---

## Performance Issues

### Problem: Commands Are Slow

**Diagnosis:**
```javascript
const start = Date.now();
const result = await client.navigate(url);
const duration = Date.now() - start;
console.log(`Took ${duration}ms`);  // Should be <5000
```

**Solutions:**

**Enable compression:**
```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  compression: true  // Enable message compression
});
```

**Use connection pooling:**
```javascript
const pool = [];
for (let i = 0; i < 5; i++) {
  const client = new BassetHoundClient(options);
  await client.connect();
  pool.push(client);
}

// Use from pool
const client = pool[Math.floor(Math.random() * pool.length)];
```

**Batch operations:**
```javascript
// ❌ SLOW: Sequential
for (const url of urls) {
  await client.navigate(url);
  const screenshot = await client.screenshot();
}

// ✅ FAST: Parallel
const promises = urls.map(async (url) => {
  const client = new BassetHoundClient();
  await client.connect();
  await client.navigate(url);
  const screenshot = await client.screenshot();
  await client.disconnect();
  return screenshot;
});
await Promise.all(promises);
```

---

## Error Recovery Patterns

### Automatic Retry with Exponential Backoff

```javascript
async function executeWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

const result = await executeWithRetry(() => 
  client.navigate('https://example.com')
);
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.open = false;
  }

  async execute(fn) {
    if (this.open) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.threshold) {
        this.open = true;
        setTimeout(() => { this.open = false; }, 60000);
      }
      throw error;
    }
  }
}

const breaker = new CircuitBreaker(5);
const result = await breaker.execute(() => client.navigate(url));
```

---

## Debugging Tools

### Enable Debug Logging

```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  logLevel: 'debug'  // 'debug', 'info', 'warn', 'error'
});
```

### Get Comprehensive Status

```javascript
const status = await client.status();
console.log(JSON.stringify(status, null, 2));
```

### Capture Network Logs

```javascript
await client.startNetworkCapture();

// ... perform operations ...

const logs = await client.getNetworkLogs();
console.log(logs);

await client.stopNetworkCapture();
```

### Get Console Logs

```javascript
const logs = await client.getConsoleLogs();
logs.forEach(log => {
  console.log(`[${log.level}] ${log.message}`);
});
```

### Trace WebSocket Messages

```javascript
await client.traceWebSocket();

// ... perform operations ...

const trace = await client.getWebSocketTrace();
console.log(trace);
```

---

## Getting Help

When reporting issues:

1. **Describe the problem** - What were you trying to do?
2. **Show the error** - Exact error message and code
3. **Browser version** - `npm list basset-hound-browser`
4. **Environment** - OS, Node.js version, proxy setup
5. **Reproducible** - Can you reproduce consistently?
6. **Logs** - Enable debug mode and share relevant logs
7. **Minimal example** - Smallest code that reproduces issue

Example issue report:
```
Environment:
- OS: Ubuntu 20.04
- Node.js: 16.13.0
- Browser API: 12.2.0
- Proxy: No proxy

Error:
Error: Element not found: #search-form

Code:
await client.navigate('https://example.com');
await client.click('#search-form');  // Line fails

Logs:
[DEBUG] Navigation started: https://example.com
[DEBUG] Navigation complete: 2500ms
[DEBUG] Click command: #search-form
[ERROR] Element not found
```

