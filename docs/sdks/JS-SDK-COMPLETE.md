# Basset Hound Browser - JavaScript SDK Complete Guide

**Version**: 1.0.0
**Status**: Enterprise Ready
**Last Updated**: June 4, 2026
**Compatibility**: Node.js 14+, Browser environments

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Synchronous API](#synchronous-api)
5. [Asynchronous API](#asynchronous-api)
6. [Navigation](#navigation)
7. [Content Extraction](#content-extraction)
8. [Screenshots](#screenshots)
9. [Interaction](#interaction)
10. [Storage](#storage)
11. [Sessions](#sessions)
12. [Advanced Features](#advanced-features)
13. [Error Handling](#error-handling)
14. [Examples](#examples)

---

## Installation

### NPM

```bash
npm install basset-hound-browser
```

### Yarn

```bash
yarn add basset-hound-browser
```

### From Source

```bash
git clone https://github.com/basset-hound/js-sdk.git
cd js-sdk
npm install
npm run build
```

---

## Quick Start

### 5-Minute Example

```javascript
const { BassetHoundClient } = require('basset-hound-browser');

async function main() {
  // Create client
  const client = new BassetHoundClient({
    url: 'ws://localhost:8765',
    token: 'your-token'
  });

  try {
    // Connect
    await client.connect();

    // Navigate
    const nav = await client.navigate('https://example.com');
    console.log(`Navigated to: ${nav.url}`);

    // Wait for page
    await new Promise(r => setTimeout(r, 3000));

    // Take screenshot
    const screenshot = await client.screenshot({ format: 'png' });
    console.log(`Screenshot: ${screenshot.size} bytes`);

    // Extract links
    const links = await client.extractLinks();
    console.log(`Found ${links.length} links`);

    // Click element
    await client.click('a.link');

  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
```

---

## Authentication

### Bearer Token

```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: 'your-bearer-token'
});
```

### API Key

```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  apiKey: 'your-api-key'
});
```

### Custom Headers

```javascript
const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'value'
  }
});
```

---

## Synchronous API

### Create Synchronous Client

```javascript
const { SyncBassetHoundClient } = require('basset-hound-browser');

const client = new SyncBassetHoundClient({
  url: 'http://localhost:8766/api/v1',
  token: 'token'
});

// Synchronous operations
const result = client.navigate('https://example.com');
const content = client.getContent();
const screenshot = client.screenshot();
```

### Use Cases

- HTTP/REST-based operations
- Legacy callback-based code
- Blocking operations acceptable
- Simple scripts

---

## Asynchronous API

### Create Async Client

```javascript
const { BassetHoundClient } = require('basset-hound-browser');

const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: 'token'
});

// Async operations
await client.connect();
const result = await client.navigate('https://example.com');
const content = await client.getContent();
await client.disconnect();
```

### Async Context Manager

```javascript
const client = new BassetHoundClient(options);

async with(client, async (c) => {
  // Client auto-connects and disconnects
  const result = await c.navigate('https://example.com');
  return result;
});
```

---

## Navigation

### Navigate

```javascript
// Simple navigation
const result = await client.navigate('https://example.com');
console.log(`URL: ${result.url}`);
console.log(`Title: ${result.title}`);

// With options
const result = await client.navigate('https://example.com', {
  timeout: 60000,
  waitUntil: 'networkidle'  // 'load', 'domcontentloaded', 'networkidle'
});
```

### Get Current URL

```javascript
const { url, title } = await client.getUrl();
console.log(`Current: ${url}`);
```

### Get Page State

```javascript
const state = await client.getPageState();
console.log(`DOM Ready: ${state.domReady}`);
console.log(`Load Time: ${state.performanceMetrics.pageLoadTime}ms`);
console.log(`Resources: ${state.performanceMetrics.totalRequests}`);
```

### Reload

```javascript
await client.reloadTab();
```

### Navigation History

```javascript
// Go back
await client.tabBack();

// Go forward
await client.tabForward();

// Check history
const history = await client.getHistory();
console.log(`History length: ${history.length}`);
```

### Wait for Element

```javascript
const element = await client.waitForElement({
  selector: '.content',
  timeout: 10000,
  visible: true
});

console.log(`Element: ${element.tagName}`);
```

---

## Content Extraction

### Get Page Content

```javascript
// Get HTML
const content = await client.getContent();
console.log(`Size: ${content.size} bytes`);

// With metadata
const content = await client.getContent({
  includeMetadata: true
});
console.log(`Title: ${content.metadata.title}`);
```

### Extract Links

```javascript
// All links
const links = await client.extractLinks();
console.log(`Found ${links.length} links`);

links.forEach(link => {
  console.log(`- ${link.text}: ${link.href}`);
});

// With filters
const links = await client.extractLinks({
  includeInternal: true,
  includeExternal: true
});
```

### Extract Images

```javascript
// All images
const images = await client.extractImages();
console.log(`Found ${images.length} images`);

images.forEach(img => {
  console.log(`- ${img.alt}: ${img.src}`);
  console.log(`  ${img.width}x${img.height}`);
});
```

### Extract Forms

```javascript
// All forms
const forms = await client.extractForms();
console.log(`Found ${forms.length} forms`);

forms.forEach(form => {
  console.log(`Form: ${form.id}`);
  console.log(`Action: ${form.action}`);
  form.fields.forEach(field => {
    console.log(`  - ${field.name} (${field.type})`);
  });
});
```

### Extract Metadata

```javascript
const metadata = await client.extractMetadata();
console.log(`Title: ${metadata.title}`);
console.log(`Description: ${metadata.description}`);
console.log(`Canonical: ${metadata.canonical}`);
console.log(`OG Image: ${metadata.ogData.image}`);
console.log(`Twitter Card: ${metadata.twitterData.card}`);
```

### Detect Technologies

```javascript
const techs = await client.detectTechnologies();
console.log(`Found ${techs.length} technologies`);

techs.forEach(tech => {
  console.log(`- ${tech.name} (${tech.category})`);
  console.log(`  Version: ${tech.version}`);
  console.log(`  Confidence: ${tech.confidence}%`);
});
```

### Extract All

```javascript
const result = await client.extractAll({
  types: ['text', 'links', 'images', 'forms', 'metadata']
});

console.log(`Text length: ${result.text.length}`);
console.log(`Links: ${result.links.length}`);
console.log(`Images: ${result.images.length}`);
console.log(`Forms: ${result.forms.length}`);
```

---

## Screenshots

### Take Screenshot

```javascript
// Simple screenshot
const screenshot = await client.screenshot({ format: 'png' });
console.log(`Size: ${screenshot.size} bytes`);

// Save to file
const fs = require('fs');
fs.writeFileSync('screenshot.png', 
  Buffer.from(screenshot.screenshot, 'base64')
);
```

### Screenshot Options

```javascript
// Full page
const full = await client.screenshot({ fullPage: true });

// Viewport
const viewport = await client.screenshot({ fullPage: false });

// Different formats
const png = await client.screenshot({ format: 'png' });
const jpeg = await client.screenshot({ format: 'jpeg', quality: 85 });
const webp = await client.screenshot({ format: 'webp' });
```

### Screenshot Types

```javascript
// Full page
const full = await client.screenshotFullPage();

// Viewport only
const viewport = await client.screenshotViewport();

// Specific element
const element = await client.screenshotElement({ selector: '#main' });

// Specific area
const area = await client.screenshotArea({
  x: 100, y: 100,
  width: 800, height: 600
});
```

### Annotate Screenshot

```javascript
const annotated = await client.annotateScreenshot({
  screenshot: 'base64-image',
  annotations: [
    {
      type: 'box',
      x: 100, y: 100,
      width: 200, height: 200,
      color: 'red',
      label: 'Important'
    },
    {
      type: 'arrow',
      fromX: 100, fromY: 100,
      toX: 300, toY: 300,
      color: 'blue'
    },
    {
      type: 'circle',
      x: 250, y: 250,
      radius: 50,
      color: 'green'
    },
    {
      type: 'text',
      x: 100, y: 50,
      text: 'Label',
      color: 'black'
    }
  ]
});

console.log(annotated);
```

---

## Interaction

### Click Element

```javascript
// Basic click
const result = await client.click('button.submit');
console.log(`Clicked: ${result.clicked}`);

// With options
const result = await client.click('button', {
  button: 'left',    // 'left', 'right', 'middle'
  clickCount: 2      // Double click
});
```

### Fill Form Field

```javascript
// Simple fill
await client.fill('input[name="email"]', 'user@example.com');

// With options
await client.fill('input[name="password"]', 'secret', {
  humanize: true,    // Simulate human typing
  delay: 100         // Delay between keys
});
```

### Type Text

```javascript
// Type text
await client.typeText('Hello, World!');

// With delay
await client.typeText('Hello, World!', { delay: 100 });
```

### Keyboard Input

```javascript
// Press single key
await client.keyPress('Enter');
await client.keyPress('Tab');
await client.keyPress('Escape');

// Key combination
await client.keyCombination(['Control', 'a']);  // Select all
await client.keyCombination(['Control', 'c']);  // Copy
await client.keyCombination(['Control', 'v']);  // Paste
```

### Mouse Actions

```javascript
// Click at coordinates
await client.mouseClick(500, 300, { button: 'left' });

// Double click
await client.mouseDoubleClick(500, 300);

// Right click
await client.mouseRightClick(500, 300);

// Hover over element
await client.mouseHover({ selector: '#menu' });

// Move mouse
await client.mouseMove(500, 300);

// Drag
await client.mouseDrag({
  fromX: 100, fromY: 100,
  toX: 500, toY: 500
});

// Scroll
await client.scroll({
  selector: 'body',
  x: 0, y: 1000,
  smooth: true
});
```

---

## Storage

### Cookies

```javascript
// Set cookie
await client.setCookie({
  name: 'session_id',
  value: 'abc123',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Strict',
  expiresIn: 3600000  // 1 hour
});

// Get cookies
const cookies = await client.getCookies();
cookies.forEach(c => {
  console.log(`${c.name}=${c.value}`);
});

// Get all cookies
const allCookies = await client.getAllCookies();

// Delete cookie
await client.deleteCookie('session_id');

// Clear all
await client.clearAllCookies();

// Export
const filename = await client.exportCookies({ format: 'json' });

// Import
await client.importCookies({ path: 'cookies.json', merge: true });
```

### Local Storage

```javascript
// Set
await client.setLocalStorage('user_theme', 'dark');

// Get
const theme = await client.getLocalStorage('user_theme');
console.log(`Theme: ${theme}`);

// Clear
await client.clearLocalStorage();
```

### Session Storage

```javascript
// Set
await client.setSessionStorage('temp', 'value');

// Get
const value = await client.getSessionStorage('temp');

// Clear
await client.clearSessionStorage();
```

### IndexedDB

```javascript
// Get data
const data = await client.getIndexedDB({
  database: 'mydb',
  store: 'mystore'
});

// Delete
await client.deleteIndexedDB('mydb');
```

---

## Sessions

### Create & Manage

```javascript
// Create session
const session = await client.createSession({
  name: 'research_session',
  isolated: true
});
console.log(`Session ID: ${session.sessionId}`);

// List sessions
const sessions = await client.listSessions();
sessions.forEach(s => {
  console.log(`- ${s.name} (${s.sessionId})`);
});

// Get session info
const info = await client.getSessionInfo('sess_abc123');

// Switch session
await client.switchSession('sess_abc123');

// Delete session
await client.deleteSession('sess_abc123');
```

### Checkpoints

```javascript
// Create checkpoint
const checkpoint = await client.createSessionCheckpoint('checkpoint_1');

// List checkpoints
const checkpoints = await client.listCheckpoints();

// Rollback
await client.rollbackToCheckpoint('ckpt_123');

// Delete checkpoint
await client.deleteCheckpoint('ckpt_123');

// Export session
const filename = await client.exportSession('sess_abc123', {
  includeProfile: true
});

// Import session
const result = await client.importSession({ path: 'session.json' });
```

---

## Advanced Features

### Proxy Management

```javascript
// Set proxy
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  type: 'http',
  auth: { username: 'user', password: 'pass' },
  bypassRules: ['localhost', '127.0.0.1']
});

// Get status
const status = await client.getProxyStatus();
console.log(`Exit IP: ${status.exitIp}`);
console.log(`Country: ${status.exitCountry}`);

// Test proxy
const result = await client.testProxy({
  host: 'proxy.example.com',
  port: 8080
});
console.log(`Working: ${result.working}`);

// Rotate
await client.rotateProxy();

// Start auto-rotation
await client.startProxyRotation({
  proxies: [
    { host: 'proxy1.com', port: 8080 },
    { host: 'proxy2.com', port: 8080 }
  ],
  interval: 300000
});

// Stop rotation
await client.stopProxyRotation();

// Clear
await client.clearProxy();
```

### User Agent

```javascript
// Set user agent
await client.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
);

// Get status
const ua = await client.getUserAgentStatus();
console.log(`Browser: ${ua.browser} ${ua.version}`);

// Get random
const random = await client.getRandomUserAgent({ category: 'desktop' });

// Start rotation
await client.startUserAgentRotation({
  category: 'desktop',  // 'desktop', 'mobile', 'tablet'
  interval: 300000
});

// Stop
await client.stopUserAgentRotation();
```

### Geolocation

```javascript
// Set location
await client.setGeolocation({
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 100
});

// Set by city
await client.setGeolocationCity({
  city: 'New York',
  country: 'United States'
});

// Get status
const geo = await client.getGeolocation();

// Reset
await client.resetGeolocation();
```

### JavaScript Execution

```javascript
// Execute JavaScript
const result = await client.executeScript('return document.title;');
console.log(`Title: ${result}`);

// With arguments
const sum = await client.executeScript(
  'return arguments[0] + arguments[1];',
  [5, 3]
);
console.log(`Sum: ${sum}`);

// Complex operations
const data = await client.executeScript(`
  return {
    title: document.title,
    url: window.location.href,
    links: Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent,
      href: a.href
    }))
  };
`);
console.log(data);
```

### Recording & Replay

```javascript
// Start recording
const rec = await client.startRecording({
  name: 'my_recording',
  captureScreenshots: true,
  captureNetwork: true
});

// ... perform actions ...

// Stop recording
await client.stopRecording();

// Get status
const status = await client.getRecordingStatus();

// List recordings
const recordings = await client.listRecordings();

// Load and replay
await client.loadRecording('rec_123');
await client.startReplay('rec_123', { speed: 1.0 });
await new Promise(r => setTimeout(r, 5000));
await client.stopReplay();

// Export
const filename = await client.exportRecording('rec_123', { format: 'json' });
```

---

## Error Handling

### Try-Catch Pattern

```javascript
const { BassetError, NavigationError, ElementNotFoundError } = require('basset-hound-browser');

try {
  await client.navigate('https://invalid-url-!!!.com');
} catch (error) {
  if (error instanceof NavigationError) {
    console.error('Navigation failed:', error.message);
  } else if (error instanceof BassetError) {
    console.error('Basset error:', error.message);
    console.error('Code:', error.code);
    console.error('Recovery:', error.recovery);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Error Types

```javascript
// All errors are BassetError subclasses
- NavigationError         // Navigation failed
- ElementNotFoundError    // Element selector didn't match
- TimeoutError           // Operation timed out
- ProxyError             // Proxy connection issue
- AuthenticationError    // Auth failed
- StorageError           // Storage operation failed
```

### Retry Logic

```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Usage
const result = await retryOperation(() => 
  client.navigate('https://example.com')
);
```

---

## Examples

### Example 1: Complete Workflow

```javascript
const { BassetHoundClient } = require('basset-hound-browser');

async function completeWorkflow() {
  const client = new BassetHoundClient({
    url: 'ws://localhost:8765',
    token: 'your-token'
  });

  try {
    // Connect
    await client.connect();

    // 1. Navigate
    console.log('Navigating...');
    await client.navigate('https://example.com');

    // 2. Wait for page
    await new Promise(r => setTimeout(r, 3000));

    // 3. Fill and submit form
    console.log('Filling form...');
    await client.fill('input[name="q"]', 'search term');
    await client.click('button[type="submit"]');

    // 4. Wait for results
    await new Promise(r => setTimeout(r, 2000));

    // 5. Extract results
    console.log('Extracting results...');
    const links = await client.extractLinks();
    console.log(`Found ${links.length} results`);

    // 6. Take screenshot
    const screenshot = await client.screenshot();
    require('fs').writeFileSync('results.png',
      Buffer.from(screenshot.screenshot, 'base64')
    );

    console.log('✓ Complete!');

  } finally {
    await client.disconnect();
  }
}

completeWorkflow().catch(console.error);
```

### Example 2: Batch Processing

```javascript
async function processManyUrls(urls) {
  const client = new BassetHoundClient({
    url: 'ws://localhost:8765',
    token: 'token'
  });

  const results = [];

  try {
    await client.connect();

    for (const url of urls) {
      try {
        console.log(`Processing: ${url}`);
        
        await client.navigate(url);
        await new Promise(r => setTimeout(r, 3000));

        const [metadata, links] = await Promise.all([
          client.extractMetadata(),
          client.extractLinks()
        ]);

        results.push({
          url,
          title: metadata.title,
          linkCount: links.length,
          status: 'success'
        });

      } catch (error) {
        results.push({
          url,
          error: error.message,
          status: 'error'
        });
      }
    }

    return results;

  } finally {
    await client.disconnect();
  }
}

// Usage
processManyUrls([
  'https://example.com',
  'https://example.com/page1',
  'https://example.com/page2'
]).then(results => {
  console.log(JSON.stringify(results, null, 2));
}).catch(console.error);
```

### Example 3: Real-Time Monitoring

```javascript
const { BassetHoundClient } = require('basset-hound-browser');

async function monitorWebsite(url, interval = 300000) {
  const client = new BassetHoundClient({
    url: 'ws://localhost:8765',
    token: 'token'
  });

  await client.connect();

  const checkWebsite = async () => {
    try {
      console.log(`[${new Date().toISOString()}] Checking ${url}...`);
      
      const start = Date.now();
      await client.navigate(url);
      const loadTime = Date.now() - start;

      console.log(`✓ OK (${loadTime}ms)`);
      return { success: true, loadTime };

    } catch (error) {
      console.error(`✗ ERROR: ${error.message}`);
      return { success: false, error: error.message };
    }
  };

  // Initial check
  await checkWebsite();

  // Periodic checks
  setInterval(checkWebsite, interval);
}

// Usage
monitorWebsite('https://example.com', 60000);  // Every minute
```

---

## Browser Environment

### Using in Browser

```html
<script src="https://cdn.jsdelivr.net/npm/basset-hound-browser@1.0.0/dist/client.min.js"></script>

<script>
  const client = new BassetHound.Client({
    url: 'wss://example.com:8765',
    token: 'your-token'
  });

  async function demo() {
    await client.connect();
    const result = await client.navigate('https://example.com');
    console.log(result);
    await client.disconnect();
  }

  demo();
</script>
```

---

## TypeScript Support

```typescript
import { BassetHoundClient, NavigationResult } from 'basset-hound-browser';

const client = new BassetHoundClient({
  url: 'ws://localhost:8765',
  token: 'token'
});

async function example(): Promise<NavigationResult> {
  await client.connect();
  const result = await client.navigate('https://example.com');
  await client.disconnect();
  return result;
}
```

