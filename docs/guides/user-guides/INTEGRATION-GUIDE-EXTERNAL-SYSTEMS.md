# Basset Hound Browser - External Systems Integration Guide

**Version**: 1.0.0  
**Date**: 2026-05-11  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Integration Targets](#integration-targets)
3. [Getting Started](#getting-started)
4. [WebSocket API Integration](#websocket-api-integration)
5. [MCP Server Integration](#mcp-server-integration)
6. [palletai Agent Integration](#palletai-agent-integration)
7. [Automation Script Integration](#automation-script-integration)
8. [Real-World Workflows](#real-world-workflows)
9. [Error Handling](#error-handling)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Basset Hound Browser is fully integrated and ready for production use with external systems. This guide covers integration patterns for:

- **palletai Agents**: AI agents that control the browser for OSINT tasks
- **Claude AI Agents**: Via MCP server for Claude-based automation
- **Automation Scripts**: External Node.js and Python scripts
- **Custom Systems**: Any system that can speak WebSocket or MCP

### Integration Readiness Checklist

- [x] WebSocket API: 164 commands, all documented
- [x] Error handling: Comprehensive recovery mechanisms
- [x] Response format: Consistent JSON schema
- [x] Authentication: Optional token-based security
- [x] Performance: <1s response time for most operations
- [x] State management: Reliable across command sequences
- [x] Documentation: Complete API reference
- [x] Examples: Node.js, Python, and MCP implementations

---

## Integration Targets

### 1. palletai Integration

**Status**: Ready for production  
**Protocol**: WebSocket (JSON)  
**Port**: 8765  
**Connection**: Persistent WebSocket

palletai agents can control Basset Hound for:
- Reconnaissance and OSINT data collection
- Multi-page website analysis
- Content extraction and forensics
- Behavioral simulation and evasion

### 2. Claude AI Agents

**Status**: Ready for production  
**Protocol**: MCP (Model Context Protocol)  
**Server**: `python browser_mcp/server.py`  
**Features**: Tool discovery, parameter validation, response parsing

Claude agents can:
- Navigate websites
- Extract data and metadata
- Take screenshots
- Analyze page structure
- Manage cookies and proxies

### 3. Automation Scripts

**Status**: Ready for production  
**Protocol**: WebSocket (JSON)  
**Libraries**: `integrations/nodejs_client.js`, `integrations/python_client.py`  
**Languages**: Node.js, Python, any WebSocket-capable language

Scripts can:
- Automate browser workflows
- Integrate with data pipelines
- Combine with external tools
- Run on schedule or demand

---

## Getting Started

### Prerequisites

- **Node.js 14+** (for WebSocket server and Node.js integrations)
- **Python 3.8+** (for MCP server and Python integrations)
- **Electron** (packaged with Basset Hound)

### Starting Basset Hound

#### Production Mode (Electron)

```bash
npm start
# Browser window opens, WebSocket server starts on port 8765
```

#### Headless Mode (Docker)

```bash
docker-compose up -d
# WebSocket server available on port 8765
```

#### Development Mode

```bash
npm run dev
# WebSocket server on port 8765 with verbose logging
```

### Verifying Connection

```bash
# Test connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8765

# Or use Node.js
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
  ws.send(JSON.stringify({ id: '1', command: 'ping' }));
});
ws.on('message', (msg) => {
  console.log(JSON.parse(msg));
  ws.close();
});
"
```

---

## WebSocket API Integration

### Connection

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    id: '1',
    command: 'ping'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log(response);
});

ws.on('error', (err) => {
  console.error('Connection error:', err);
});
```

### Command Structure

All commands follow this structure:

```json
{
  "id": "unique-string-id",
  "command": "command_name",
  "param1": "value1",
  "param2": "value2"
}
```

### Response Structure

Success response:
```json
{
  "id": "unique-string-id",
  "command": "command_name",
  "success": true,
  "data": { ... }
}
```

Error response:
```json
{
  "id": "unique-string-id",
  "command": "command_name",
  "success": false,
  "error": "Error description",
  "recovery": {
    "suggestion": "Try this instead...",
    "alternativeCommands": ["cmd1", "cmd2"]
  }
}
```

### Essential Commands

#### Navigation

```javascript
// Navigate to URL
ws.send(JSON.stringify({
  id: '1',
  command: 'navigate',
  url: 'https://example.com',
  wait_until: 'load'  // load, domcontentloaded, networkidle0, networkidle2
}));

// Get current URL
ws.send(JSON.stringify({
  id: '2',
  command: 'get_url'
}));

// Go back/forward
ws.send(JSON.stringify({
  id: '3',
  command: 'go_back'
}));
```

#### Content Extraction

```javascript
// Get page HTML and text
ws.send(JSON.stringify({
  id: '4',
  command: 'get_content'
}));

// Get page state (title, URL, forms, links)
ws.send(JSON.stringify({
  id: '5',
  command: 'get_page_state'
}));

// Extract links
ws.send(JSON.stringify({
  id: '6',
  command: 'extract_links'
}));

// Extract forms
ws.send(JSON.stringify({
  id: '7',
  command: 'extract_forms'
}));
```

#### Screenshots

```javascript
// Full page screenshot
ws.send(JSON.stringify({
  id: '8',
  command: 'screenshot'
}));

// Viewport screenshot
ws.send(JSON.stringify({
  id: '9',
  command: 'screenshot_viewport'
}));

// Element screenshot
ws.send(JSON.stringify({
  id: '10',
  command: 'screenshot_element',
  selector: '#my-element'
}));
```

#### Interaction

```javascript
// Click element
ws.send(JSON.stringify({
  id: '11',
  command: 'click',
  selector: 'button.submit'
}));

// Fill form field
ws.send(JSON.stringify({
  id: '12',
  command: 'fill',
  selector: 'input[name="email"]',
  text: 'user@example.com'
}));

// Type text
ws.send(JSON.stringify({
  id: '13',
  command: 'type',
  selector: 'input[name="search"]',
  text: 'query'
}));

// Scroll
ws.send(JSON.stringify({
  id: '14',
  command: 'scroll',
  x: 0,
  y: 500
}));
```

#### Evasion & Configuration

```javascript
// Set user agent
ws.send(JSON.stringify({
  id: '15',
  command: 'set_user_agent',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}));

// Rotate user agent
ws.send(JSON.stringify({
  id: '16',
  command: 'rotate_user_agent'
}));

// Set proxy
ws.send(JSON.stringify({
  id: '17',
  command: 'set_proxy',
  host: 'proxy.example.com',
  port: 8080,
  type: 'http'  // http, https, socks4, socks5
}));

// Set Tor mode
ws.send(JSON.stringify({
  id: '18',
  command: 'set_tor_mode',
  mode: 'on'  // on, off, auto
}));
```

---

## MCP Server Integration

### Starting MCP Server

```bash
# With FastMCP
python -m fastmcp run browser_mcp/server.py

# Or directly
python browser_mcp/server.py
```

### Claude Desktop Configuration

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "basset-hound-browser": {
      "command": "python",
      "args": ["browser_mcp/server.py"],
      "cwd": "/path/to/basset-hound-browser",
      "env": {
        "WS_HOST": "localhost",
        "WS_PORT": "8765"
      }
    }
  }
}
```

### Using with Claude

In Claude, you can now use browser commands:

```
Me: Navigate to example.com and extract all links

Claude: I'll help you extract links from example.com.
<uses MCP tool: navigate(url="https://example.com")>
<uses MCP tool: extract_links()>

The links found are:
- https://www.iana.org/domains/example
- ...
```

### Available MCP Tools

All 164 WebSocket commands are available as MCP tools:

- **Navigation**: navigate, get_url, go_back, go_forward, reload
- **Content**: get_content, get_page_state, extract_links, extract_forms, extract_all
- **Screenshots**: screenshot, screenshot_viewport, screenshot_element
- **Interaction**: click, fill, type, scroll, wait_for_element
- **Proxy/UA**: set_proxy, get_proxy_status, set_user_agent, rotate_user_agent
- **Tor**: set_tor_mode, get_tor_mode, tor_new_identity
- **Cookies**: get_cookies, set_cookies, clear_cookies
- **JavaScript**: execute_script, eval_script
- **And more...**

---

## palletai Agent Integration

### Architecture

palletai agents control Basset Hound for distributed OSINT:

```
palletai Agent
    ↓
WebSocket Client (JSON)
    ↓
Basset Hound Browser (WebSocket Server)
    ↓
Chromium Browser
```

### Integration Pattern

```javascript
// In palletai agent code
const BassetHoundClient = require('./basset-hound-browser/integrations/nodejs_client.js');

class OSINTAgent {
  constructor() {
    this.browser = new BassetHoundClient('basset-host', 8765);
  }

  async investigate(target) {
    await this.browser.connect();
    
    try {
      // Navigate to target
      await this.browser.navigate(`https://${target}`);
      
      // Extract OSINT data
      const pageState = await this.browser.getPageState();
      const links = await this.browser.extractLinks();
      const screenshot = await this.browser.screenshot();
      
      // Process results
      return {
        target,
        title: pageState.title,
        url: pageState.url,
        links: links.length,
        screenshotBase64: screenshot
      };
    } finally {
      await this.browser.disconnect();
    }
  }
}
```

### Multi-Agent Coordination

For multiple palletai agents:

```javascript
// Connection pooling
const ConnectionPool = require('./basset-hound-browser/websocket/connection-pool');

const pool = new ConnectionPool({
  maxConnections: 5,
  host: 'basset-host',
  port: 8765
});

// Each agent gets a pooled connection
async function agentTask(targetId) {
  const connection = await pool.acquire();
  try {
    const client = new BassetHoundClient(connection);
    // ... perform OSINT work
  } finally {
    pool.release(connection);
  }
}

// Run 5 agents in parallel
await Promise.all([
  agentTask('target1'),
  agentTask('target2'),
  agentTask('target3'),
  agentTask('target4'),
  agentTask('target5')
]);
```

---

## Automation Script Integration

### Node.js Scripts

```javascript
const { BassetHoundClient } = require('./integrations/nodejs_client.js');

async function runWorkflow() {
  const browser = new BassetHoundClient('localhost', 8765, 30000, true);
  
  try {
    await browser.connect();
    
    // Workflow: Search → Extract → Store
    await browser.navigate('https://example.com');
    const content = await browser.getContent();
    const links = await browser.extractLinks();
    const screenshot = await browser.screenshot();
    
    // Store results
    fs.writeFileSync('results.json', JSON.stringify({
      content: content.text,
      links,
      screenshot
    }, null, 2));
    
  } catch (err) {
    console.error('Workflow failed:', err);
  } finally {
    await browser.disconnect();
  }
}

runWorkflow();
```

### Python Scripts

```python
import asyncio
from integrations.python_client import BassetHoundClient

async def run_workflow():
    async with BassetHoundClient() as browser:
        # Navigate
        await browser.navigate('https://example.com')
        
        # Extract data
        content = await browser.get_content()
        links = await browser.extract_links()
        screenshot = await browser.screenshot()
        
        # Store results
        import json
        with open('results.json', 'w') as f:
            json.dump({
                'content': content.get('text'),
                'links': links,
                'screenshot': screenshot
            }, f, indent=2)

asyncio.run(run_workflow())
```

### Scheduling with Node.js

```javascript
const cron = require('node-cron');
const { BassetHoundClient } = require('./integrations/nodejs_client.js');

// Run every hour
cron.schedule('0 * * * *', async () => {
  const browser = new BassetHoundClient();
  try {
    await browser.connect();
    
    // Perform monitoring task
    const url = 'https://example.com';
    await browser.navigate(url);
    const content = await browser.getContent();
    
    // Check for changes
    if (content.text !== lastContent) {
      console.log('Website changed!');
      // Alert, log, store change, etc.
    }
    
    lastContent = content.text;
  } finally {
    await browser.disconnect();
  }
});
```

---

## Real-World Workflows

### Workflow 1: Web Reconnaissance

```javascript
async function performReconnaissance(targetUrl) {
  const browser = new BassetHoundClient();
  await browser.connect();
  
  try {
    // Navigate with evasion
    await browser.rotateUserAgent();
    await browser.setProxy('proxy.example.com', 8080);
    await browser.navigate(targetUrl);
    
    // Extract intelligence
    const pageState = await browser.getPageState();
    const links = await browser.extractLinks();
    const forms = await browser.extractForms();
    const screenshot = await browser.screenshot();
    
    return {
      title: pageState.title,
      url: pageState.url,
      links,
      forms,
      screenshot,
      timestamp: new Date().toISOString()
    };
  } finally {
    await browser.disconnect();
  }
}
```

### Workflow 2: Login & Post-Auth Extraction

```javascript
async function authenticatedExtraction(site, credentials) {
  const browser = new BassetHoundClient();
  await browser.connect();
  
  try {
    // Navigate to login
    await browser.navigate(site.loginUrl);
    await browser.waitForElement(site.emailSelector, 10000);
    
    // Fill login form
    await browser.fill(site.emailSelector, credentials.email);
    await browser.fill(site.passwordSelector, credentials.password);
    await browser.click(site.submitSelector);
    
    // Wait for redirect
    await browser.waitForElement(site.postAuthSelector, 15000);
    
    // Extract authenticated content
    const content = await browser.getContent();
    const links = await browser.extractLinks();
    
    return { content, links };
  } finally {
    await browser.disconnect();
  }
}
```

### Workflow 3: Multi-Page Analysis

```javascript
async function analyzeWebsite(baseUrl) {
  const browser = new BassetHoundClient();
  await browser.connect();
  
  const pages = [];
  const toVisit = [baseUrl];
  const visited = new Set();
  
  try {
    while (toVisit.length > 0 && visited.size < 10) { // Limit to 10 pages
      const url = toVisit.shift();
      if (visited.has(url)) continue;
      
      visited.add(url);
      
      // Visit page
      await browser.navigate(url);
      const state = await browser.getPageState();
      const links = await browser.extractLinks();
      
      pages.push({
        url,
        title: state.title,
        linksFound: links.length
      });
      
      // Add new links to visit
      links.forEach(link => {
        if (link.url && link.url.startsWith(baseUrl) && !visited.has(link.url)) {
          toVisit.push(link.url);
        }
      });
    }
    
    return { baseUrl, pagesAnalyzed: pages.length, pages };
  } finally {
    await browser.disconnect();
  }
}
```

### Workflow 4: Screenshot Comparison

```javascript
async function compareWebsiteVersions(url, interval = 3600000) { // 1 hour
  const browser = new BassetHoundClient();
  let lastScreenshot = null;
  
  setInterval(async () => {
    try {
      await browser.connect();
      await browser.navigate(url);
      const screenshot = await browser.screenshot();
      
      if (lastScreenshot && screenshot !== lastScreenshot) {
        console.log(`Website ${url} has changed`);
        // Store new screenshot, alert, etc.
      }
      
      lastScreenshot = screenshot;
      await browser.disconnect();
    } catch (err) {
      console.error('Screenshot comparison failed:', err);
    }
  }, interval);
}
```

---

## Error Handling

### Connection Errors

```javascript
const browser = new BassetHoundClient('localhost', 8765);

try {
  await browser.connect();
} catch (err) {
  if (err instanceof BassetHoundConnectionError) {
    console.error('Cannot connect to browser. Is it running on port 8765?');
  }
}
```

### Command Timeouts

```javascript
try {
  const result = await browser.waitForElement('#element-that-may-not-appear', 5000);
} catch (err) {
  if (err instanceof BassetHoundTimeoutError) {
    console.error('Element did not appear within 5 seconds');
    // Use fallback extraction method
  }
}
```

### Navigation Errors

```javascript
const result = await browser.navigate('https://invalid-domain.test');
if (!result.success) {
  console.error('Navigation failed:', result.error);
  if (result.recovery?.alternativeCommands) {
    // Try alternatives
  }
}
```

### Retry Logic

```javascript
async function executeWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Usage
await executeWithRetry(() => browser.navigate(url));
```

---

## Performance Considerations

### Connection Pooling

For multiple parallel operations:

```javascript
const { ConnectionPool } = require('./websocket/connection-pool');

const pool = new ConnectionPool({
  maxConnections: 5,
  host: 'localhost',
  port: 8765,
  idleTimeout: 30000
});

// Get connection
const client = pool.acquire();
await client.navigate('https://example.com');
pool.release(client);
```

### Batch Operations

```javascript
async function batchNavigate(urls) {
  const browser = new BassetHoundClient();
  await browser.connect();
  
  const results = [];
  
  for (const url of urls) {
    await browser.navigate(url);
    const content = await browser.getContent();
    results.push({ url, contentLength: content.text.length });
    
    // Brief pause between requests to avoid overload
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.disconnect();
  return results;
}
```

### Resource Management

```javascript
// Clean up cookies and cache periodically
const browser = new BassetHoundClient();
await browser.connect();

// Clear cookies
await browser.clearCookies();

// Clear cache
await browser.executeScript('window.localStorage.clear()');

await browser.disconnect();
```

### Timeout Configuration

```javascript
// Longer timeout for slow networks
const browser = new BassetHoundClient(
  'localhost',
  8765,
  60000, // 60 second timeout for each command
  true   // auto-reconnect
);
```

---

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to localhost:8765  
**Solution**:
- Verify Basset Hound is running: `npm start` or `docker-compose up`
- Check port is not in use: `lsof -i :8765`
- Look for firewall blocks if connecting remotely

### Commands Timing Out

**Problem**: Commands consistently timeout  
**Solution**:
- Wait 2-4 seconds after `navigate` before page-dependent commands
- Increase `COMMAND_TIMEOUT` in client configuration
- Check browser performance: take screenshot, check page complexity

### Invalid Response Format

**Problem**: Responses don't parse as JSON  
**Solution**:
- Verify request JSON is valid
- Check command name is correct
- Ensure all required parameters are provided

### State Inconsistency

**Problem**: Setting proxy/UA doesn't persist  
**Solution**:
- Confirm command returns success
- Check `get_proxy_status` / `get_user_agent_status` after setting
- Navigate to verify settings are applied

### Memory Leaks

**Problem**: Browser memory usage increases over time  
**Solution**:
- Disconnect after each session: `await browser.disconnect()`
- Periodically clear cookies: `await browser.clearCookies()`
- Clear local storage: `await browser.executeScript('localStorage.clear()')`
- Monitor with `docker stats` if running in container

### High Latency

**Problem**: Commands are slow  
**Solution**:
- Check network latency to browser
- Reduce screenshot frequency
- Use connection pooling for parallel operations
- Check browser CPU usage during operations

---

## Integration Checklist

Before deploying to production:

- [ ] WebSocket connection tested
- [ ] Error handling implemented for timeouts
- [ ] Authentication (if needed) configured
- [ ] Connection pooling set up for parallel operations
- [ ] Timeouts appropriate for use case
- [ ] Resource cleanup (disconnect) implemented
- [ ] Logging configured for debugging
- [ ] Performance tested under expected load
- [ ] Failover/retry logic implemented
- [ ] Documentation updated with integration details

---

## Next Steps

1. **Review Examples**: Check `examples/integration-examples/` for code samples
2. **Run Tests**: Execute `npm test -- tests/integration-readiness-suite.js`
3. **Start Development**: Use provided client libraries for your integration
4. **Monitor Production**: Set up logging and alerting for integration health

---

## Support & Documentation

- **API Reference**: `/docs/API-REFERENCE.md`
- **WebSocket Server**: `/websocket/server.js`
- **Client Libraries**: `/integrations/` (Node.js, Python)
- **MCP Server**: `/browser_mcp/server.py`
- **Examples**: `/examples/integration-examples/`

For issues or questions, refer to the troubleshooting section above or check integration test results in `/tests/results/`.
