# Comprehensive FAQ - Basset Hound Browser

**Version**: 12.2.0
**Status**: Enterprise Ready  
**Last Updated**: June 4, 2026
**Coverage**: 100+ frequently asked questions

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation & Setup](#installation--setup)
3. [Authentication](#authentication)
4. [API Usage](#api-usage)
5. [Proxies & Network](#proxies--network)
6. [Screenshots & Content](#screenshots--content)
7. [Performance & Optimization](#performance--optimization)
8. [Security & Privacy](#security--privacy)
9. [Integration](#integration)
10. [Troubleshooting](#troubleshooting)
11. [Licensing & Support](#licensing--support)

---

## Getting Started

### Q: What is Basset Hound Browser?

**A:** Basset Hound Browser is an enterprise-grade OSINT browser automation tool built on Electron/Chromium. It provides 300+ WebSocket commands for browser control, content extraction, bot evasion, and OSINT operations with advanced features like proxy rotation, session management, and recording capabilities.

### Q: What can I do with it?

**A:** 
- Automated web scraping
- OSINT intelligence gathering
- Bot detection evasion
- Web application testing
- Content monitoring
- Automated reporting
- Browser automation
- Research workflows

### Q: What are the system requirements?

**A:** 
- Linux, macOS, or Windows
- 2GB RAM minimum (4GB+ recommended)
- 1GB disk space
- Node.js 14+ (for API)
- Modern Chromium-based browser

### Q: Is it headless or does it need a display?

**A:** It's built on Electron so it requires:
- X11/Wayland display on Linux
- Or virtual display (Xvfb on Linux, xvfb-run)
- Docker image includes virtual display

### Q: Can I run it on a server without GUI?

**A:** Yes, use Docker or virtual display:

```bash
# Docker
docker run -d basset-hound-browser

# Linux with Xvfb
xvfb-run -a npm start
```

### Q: What protocols are supported?

**A:** 
- WebSocket (real-time, bidirectional)
- HTTP/REST (request-response)
- Webhook (event-driven)
- gRPC (coming soon)

### Q: Is there an official Python SDK?

**A:** Yes! See `/docs/PYTHON-SDK-COMPLETE.md`

### Q: Is there an official JavaScript SDK?

**A:** Yes! See `/docs/JS-SDK-COMPLETE.md`

---

## Installation & Setup

### Q: How do I install Basset Hound Browser?

**A:**
```bash
git clone https://github.com/basset-hound/browser.git
cd browser
npm install
npm start
```

### Q: What if npm install fails?

**A:** 
```bash
# Clear cache
npm cache clean --force

# Try again with verbose output
npm install --verbose

# Or use yarn
yarn install
```

### Q: How do I run it in Docker?

**A:**
```bash
docker build -t basset-hound:latest .
docker run -d -p 8765:8765 basset-hound:latest
```

### Q: How do I use it with Docker Compose?

**A:**
```yaml
version: '3.8'
services:
  basset:
    build: .
    ports:
      - "8765:8765"
      - "8766:8766"
    environment:
      TOR_MODE: "0"
      LOG_LEVEL: "info"
```

### Q: What's the default WebSocket port?

**A:** 8765 (configurable via `PORT` environment variable)

### Q: What's the default REST API port?

**A:** 8766 (configurable via `REST_PORT`)

### Q: How do I check if it's running?

**A:**
```bash
# WebSocket endpoint
wscat -c ws://localhost:8765

# REST endpoint
curl http://localhost:8766/api/v1/status

# Or from browser API
const status = await client.status();
console.log(status);
```

---

## Authentication

### Q: How do I authenticate?

**A:**
```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: 'your-token'
});
```

### Q: How do I generate a token?

**A:** 
1. Go to admin dashboard
2. Settings → API Tokens
3. Click "Generate Token"
4. Copy the token

### Q: Where do I store tokens securely?

**A:** 
```javascript
// ✅ USE Environment variables
const token = process.env.BASSET_TOKEN;

// ❌ NEVER hardcode
const token = 'xoxb-abc123...';
```

### Q: What if my token expires?

**A:** 
```bash
# Generate a new token
# Restart with new token
export BASSET_TOKEN=new-token
npm start
```

### Q: Can I use API keys instead of tokens?

**A:** Yes:
```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  apiKey: 'your-api-key'
});
```

### Q: Can I have multiple tokens?

**A:** Yes, each token is independent with its own permissions.

---

## API Usage

### Q: What's the difference between WebSocket and REST API?

**A:**
| Feature | WebSocket | REST |
|---------|-----------|------|
| Real-time | Yes | No |
| Bi-directional | Yes | No |
| Overhead | Low | Higher |
| Stateless | No | Yes |
| Best for | Real-time control | Simple requests |

### Q: How many commands are available?

**A:** 300+ commands across:
- Navigation (15+)
- Content extraction (10+)
- Screenshots (8+)
- Interaction (12+)
- Storage (10+)
- Sessions (12+)
- Proxy management (10+)
- And more...

See `/docs/API-REFERENCE-COMPLETE.md` for full list.

### Q: What's the timeout for commands?

**A:** Default is 30 seconds, customizable per command:
```javascript
await client.navigate(url, { timeout: 60000 });
```

### Q: Can I send multiple commands at once?

**A:** 
```javascript
// ✅ Parallel
const [content, links, images] = await Promise.all([
  client.getContent(),
  client.extractLinks(),
  client.extractImages()
]);

// ❌ Avoid sequential unless dependent
await client.navigate(url);
await client.click('button');
await client.screenshot();
```

### Q: How do I handle errors?

**A:**
```javascript
try {
  await client.navigate('https://invalid.url');
} catch (error) {
  console.error(error.message);
  console.error(error.code);
  console.error(error.recovery);
}
```

### Q: Can I get automatic retries?

**A:** Yes, implement retry logic:
```javascript
async function retry(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## Proxies & Network

### Q: How do I use a proxy?

**A:**
```javascript
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  type: 'http'
});
```

### Q: What proxy types are supported?

**A:**
- HTTP
- HTTPS
- SOCKS4
- SOCKS5

### Q: How do I rotate proxies?

**A:**
```javascript
await client.startProxyRotation({
  proxies: [
    { host: 'proxy1.com', port: 8080 },
    { host: 'proxy2.com', port: 8080 }
  ],
  interval: 300000  // Rotate every 5 min
});
```

### Q: Can I use Tor?

**A:** Yes, with Tor mode enabled:
```bash
TOR_MODE=1 npm start
```

Then:
```javascript
await client.navigate('https://example.onion');
```

### Q: How do I test if a proxy is working?

**A:**
```javascript
const result = await client.testProxy({
  host: 'proxy.example.com',
  port: 8080
});
console.log(result.working);
```

### Q: How do I use proxy authentication?

**A:**
```javascript
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  auth: {
    username: 'user',
    password: 'pass'
  }
});
```

### Q: Can I see my exit IP?

**A:**
```javascript
const status = await client.getProxyStatus();
console.log(status.exitIp);     // 203.0.113.45
console.log(status.exitCountry); // US
```

### Q: How do I bypass proxy for certain sites?

**A:**
```javascript
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  bypassRules: ['localhost', '127.0.0.1', 'internal.com']
});
```

---

## Screenshots & Content

### Q: How do I take a screenshot?

**A:**
```javascript
const screenshot = await client.screenshot();
// Returns: { screenshot: 'base64', format: 'png', ... }
```

### Q: How do I save a screenshot?

**A:**
```javascript
const screenshot = await client.screenshot();
const fs = require('fs');
fs.writeFileSync('page.png', 
  Buffer.from(screenshot.screenshot, 'base64')
);
```

### Q: What image formats are supported?

**A:**
- PNG (default, lossless)
- JPEG (lossy, smaller)
- WebP (modern, efficient)

### Q: How do I change screenshot quality?

**A:**
```javascript
const screenshot = await client.screenshot({
  format: 'jpeg',
  quality: 75  // 0-100
});
```

### Q: Can I screenshot just one element?

**A:** Yes:
```javascript
const screenshot = await client.screenshotElement('#main-content');
```

### Q: Can I screenshot a specific area?

**A:** Yes:
```javascript
const screenshot = await client.screenshotArea({
  x: 0, y: 0,
  width: 800, height: 600
});
```

### Q: How do I extract page content?

**A:**
```javascript
// Get HTML
const content = await client.getContent();

// Extract specific types
const links = await client.extractLinks();
const images = await client.extractImages();
const forms = await client.extractForms();
const metadata = await client.extractMetadata();
```

### Q: How do I extract text only?

**A:**
```javascript
// Get text content
const page = await client.executeScript(`
  return document.body.innerText;
`);
```

### Q: How do I detect technologies on a page?

**A:**
```javascript
const techs = await client.detectTechnologies();
techs.forEach(t => {
  console.log(`${t.name} (${t.version})`);
});
```

---

## Performance & Optimization

### Q: How can I speed up my workflow?

**A:**
1. Use connection pooling (multiple clients)
2. Batch operations with Promise.all
3. Avoid unnecessary screenshots
4. Use element selectors not full-page waits
5. Enable compression
6. Use appropriate timeouts

### Q: How many concurrent operations?

**A:** Up to 200 concurrent connections in load testing. Start with 10-50 and scale based on your hardware.

### Q: How much memory does it use?

**A:** Typical: 200-400MB for browser + API. Grows with screenshots and data extraction.

### Q: How do I reduce memory usage?

**A:**
```javascript
// Periodic cleanup
setInterval(async () => {
  await client.clearAllCookies();
  await client.clearCaches();
  await client.force_gc();
}, 300000);  // Every 5 minutes
```

### Q: Should I use HTTP or WebSocket?

**A:** 
- WebSocket: Real-time control, lower latency
- HTTP: Simple requests, stateless, easier scaling

### Q: How do I enable compression?

**A:** It's enabled by default. Check browser logs to verify.

### Q: What's the throughput?

**A:** ~200-300 requests/sec per connection under load, scales linearly.

---

## Security & Privacy

### Q: Is data encrypted?

**A:** 
- WebSocket can use WSS (WebSocket Secure)
- REST API uses HTTPS
- Token transmitted in headers

### Q: Should I use HTTPS?

**A:** Yes, in production:
```bash
SSL_CERT=cert.pem SSL_KEY=key.pem npm start
```

### Q: How do I secure my tokens?

**A:**
```bash
# Use environment variables
export BASSET_TOKEN=xoxb-...
export BASSET_API_KEY=api_key_...

# NEVER commit to git
echo "*.env" >> .gitignore
```

### Q: Is user data collected?

**A:** No, all data stays local. Nothing is sent externally unless you configure webhooks.

### Q: Can I use it with VPNs?

**A:** Yes:
```javascript
// VPN as proxy
await client.setProxy({
  host: 'vpn-server.com',
  port: 1194,
  type: 'socks5'
});
```

### Q: Does it evade bot detection?

**A:** Yes, with fingerprinting and behavioral simulation:
```javascript
await client.randomizeProfileFingerprint();
await client.startUserAgentRotation({ category: 'desktop' });
```

### Q: Can I disable JavaScript?

**A:** No, JavaScript is required for modern web interaction. But you can control what runs:
```javascript
await client.executeScript('return window.blockedElements;');
```

---

## Integration

### Q: Can I use it with my existing automation?

**A:** Yes, it works with any system that can make HTTP/WebSocket requests.

### Q: How do I integrate with Slack?

**A:** See `/docs/SLACK-COMPLETE-INTEGRATION.md`

### Q: How do I integrate with custom systems?

**A:** See `/docs/CUSTOM-INTEGRATION-GUIDE.md`

### Q: What about webhooks?

**A:** See `/docs/WEBHOOK-INTEGRATION-GUIDE.md`

### Q: Can I use it with my existing tests?

**A:** Yes, it's compatible with:
- Puppeteer (similar API)
- Playwright (via wrapper)
- Selenium (via adapter)
- Custom frameworks

### Q: Does it work with CI/CD?

**A:** Yes:
```yaml
# GitHub Actions
- name: Run OSINT
  run: |
    npm install basset-hound-browser
    node my-script.js
  env:
    BASSET_TOKEN: ${{ secrets.BASSET_TOKEN }}
```

### Q: Can I run multiple instances?

**A:** Yes, use Docker with port mapping:
```bash
docker run -p 8765:8765 basset:1
docker run -p 8766:8765 basset:2  # Different port
```

---

## Troubleshooting

### Q: "Navigation timeout" - what should I do?

**A:** See `/docs/TROUBLESHOOTING-ADVANCED.md` for detailed diagnosis.

### Q: "Element not found" - how do I fix it?

**A:**
1. Verify page loaded: `await client.waitForElement('.element')`
2. Check selector: Use browser DevTools
3. Wait for JavaScript: `await new Promise(r => setTimeout(r, 3000))`

### Q: "Out of memory" - how do I fix it?

**A:**
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

### Q: "WebSocket disconnected" - is it serious?

**A:** Normal during network issues. Client auto-reconnects. If frequent, check network.

### Q: I'm getting CORS errors, why?

**A:** CORS shouldn't affect desktop automation. This suggests:
- Wrong endpoint
- Network proxy stripping headers
- Browser configuration issue

### Q: Screenshot is black/blank, why?

**A:**
1. Page not loaded: Increase wait time
2. CSS issue: Check page renders
3. Hardware acceleration: Disable if headless

### Q: Commands are very slow, why?

**A:** Check:
1. Network latency (use proxy closer to target)
2. Page load time (use faster Internet)
3. System resources (CPU/RAM/disk)

---

## Licensing & Support

### Q: What's the license?

**A:** Apache 2.0 (permissive open source)

### Q: Can I use it commercially?

**A:** Yes, Apache 2.0 permits commercial use.

### Q: Do I need to attribute?

**A:** Yes, include LICENSE file and notice for Apache compliance.

### Q: Is enterprise support available?

**A:** Contact sales for enterprise support options.

### Q: How do I report bugs?

**A:** 
1. Search existing issues
2. Create detailed issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Logs (with debug enabled)

### Q: How do I request features?

**A:** Create feature request issue with:
- Use case
- Expected behavior
- Why it's important
- Potential implementation

### Q: Where do I get help?

**A:**
- GitHub Issues: Bug reports and discussions
- Documentation: `/docs/`
- Troubleshooting: `/docs/TROUBLESHOOTING-ADVANCED.md`
- FAQ: This file
- Examples: `/examples/`

### Q: Is there a community?

**A:** Join our GitHub discussions and contribute!

### Q: Can I contribute?

**A:** Yes! 
1. Fork repository
2. Create feature branch
3. Submit pull request
4. Follow code style
5. Add tests/docs

### Q: What's the roadmap?

**A:** See `/docs/ROADMAP.md` for planned features and timeline.

---

## Quick Reference

### Most Common Commands

```javascript
// Navigate
await client.navigate('https://example.com');

// Wait
await client.waitForElement('.content');

// Click
await client.click('button.submit');

// Fill
await client.fill('input[name="q"]', 'search term');

// Extract
const links = await client.extractLinks();

// Screenshot
await client.screenshot();

// Get status
const status = await client.status();
```

### Common Patterns

```javascript
// Navigate and extract
await client.navigate(url);
await new Promise(r => setTimeout(r, 3000));
const result = await client.extractAll(['links', 'images', 'metadata']);

// Search workflow
await client.navigate('https://search-engine.com');
await client.fill('input[name="q"]', 'search term');
await client.click('button[type="submit"]');
await new Promise(r => setTimeout(r, 3000));
const links = await client.extractLinks();

// Multi-URL batch
for (const url of urls) {
  await client.navigate(url);
  const screenshot = await client.screenshot();
  // Process screenshot
}
```

---

## Additional Resources

- **Full API Reference**: `/docs/API-REFERENCE-COMPLETE.md`
- **REST API**: `/docs/REST-API-REFERENCE.md`
- **Python SDK**: `/docs/PYTHON-SDK-COMPLETE.md`
- **JavaScript SDK**: `/docs/JS-SDK-COMPLETE.md`
- **Slack Integration**: `/docs/SLACK-COMPLETE-INTEGRATION.md`
- **Webhook Integration**: `/docs/WEBHOOK-INTEGRATION-GUIDE.md`
- **Custom Integration**: `/docs/CUSTOM-INTEGRATION-GUIDE.md`
- **Troubleshooting**: `/docs/TROUBLESHOOTING-ADVANCED.md`
- **Examples**: `/examples/`

