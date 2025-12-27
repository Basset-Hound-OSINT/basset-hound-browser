# Basset Hound Browser Node.js Client

A Node.js client library for controlling the Basset Hound Browser via WebSocket.

## Installation

```bash
npm install basset-hound-client
```

Or install from source:

```bash
cd clients/nodejs
npm install
```

## Quick Start

```javascript
const { BassetHoundClient } = require('basset-hound-client');

async function main() {
  const client = new BassetHoundClient();

  await client.connect();

  await client.navigate('https://example.com');
  console.log(await client.getTitle());

  await client.disconnect();
}

main().catch(console.error);
```

## Configuration

```javascript
const client = new BassetHoundClient({
  host: 'localhost',           // WebSocket host
  port: 8765,                  // WebSocket port
  connectionTimeout: 10000,    // Connection timeout in ms
  commandTimeout: 30000,       // Default command timeout in ms
  autoReconnect: false,        // Auto-reconnect on disconnect
  reconnectInterval: 1000,     // Reconnect interval in ms
  maxReconnectAttempts: 5      // Max reconnect attempts
});
```

## Events

```javascript
client.on('connected', () => {
  console.log('Connected to browser');
});

client.on('disconnected', ({ code, reason }) => {
  console.log(`Disconnected: ${reason}`);
});

client.on('reconnecting', (attempt) => {
  console.log(`Reconnecting attempt ${attempt}`);
});

client.on('error', (error) => {
  console.error('Error:', error);
});

client.on('message', (message) => {
  console.log('Received:', message);
});
```

## API Reference

### Navigation

```javascript
// Navigate to URL
await client.navigate('https://example.com');
await client.navigate('https://example.com', 'networkidle');

// Navigation history
await client.goBack();
await client.goForward();
await client.reload();
await client.reload(true); // ignore cache

// Get page info
const url = await client.getUrl();
const title = await client.getTitle();
```

### Content Extraction

```javascript
// Extract metadata
const metadata = await client.extractMetadata();

// Extract links
const links = await client.extractLinks();
const internalLinks = await client.extractLinks(false);

// Extract forms
const forms = await client.extractForms();

// Extract images
const images = await client.extractImages();

// Extract scripts
const scripts = await client.extractScripts();

// Extract structured data
const structured = await client.extractStructuredData();

// Extract everything
const all = await client.extractAll();
```

### Technology Detection

```javascript
// Detect technologies
const techs = await client.detectTechnologies();

// Get categories
const categories = await client.getTechnologyCategories();

// Get technology info
const info = await client.getTechnologyInfo('React');

// Search
const results = await client.searchTechnologies('framework');
```

### Network Analysis

```javascript
// Start capture
await client.startNetworkCapture();
await client.startNetworkCapture(['xhr', 'fetch']);

// Navigate
await client.navigate('https://example.com');

// Get requests
const requests = await client.getNetworkRequests();
const filtered = await client.getNetworkRequests({
  filterType: 'xhr',
  filterDomain: 'api.example.com'
});

// Get statistics
const stats = await client.getNetworkStatistics();

// Export
const har = await client.exportNetworkCapture('har');

// Stop and clear
await client.stopNetworkCapture();
await client.clearNetworkCapture();
```

### Screenshots

```javascript
// Take screenshot (returns base64)
const screenshot = await client.screenshot();
const fullPage = await client.screenshot({ fullPage: true });
const jpeg = await client.screenshot({ format: 'jpeg', quality: 90 });

// Save to file
await client.saveScreenshot('page.png');
await client.saveScreenshot('page.png', { fullPage: true });
```

### Cookies

```javascript
// Get cookies
const cookies = await client.getCookies();
const filtered = await client.getCookies('https://example.com');

// Set cookie
await client.setCookie({
  name: 'session',
  value: 'abc123',
  domain: 'example.com',
  secure: true,
  httpOnly: true
});

// Delete cookies
await client.deleteCookies();
await client.deleteCookies({ url: 'https://example.com' });
```

### Tab Management

```javascript
// Get tabs
const tabs = await client.getTabs();

// Open new tab
await client.newTab();
await client.newTab('https://example.com');

// Switch tab
await client.switchTab('tab-123');

// Close tab
await client.closeTab();
await client.closeTab('tab-123');
```

### Input Simulation

```javascript
// Click
await client.click('#button');

// Type
await client.type('#input', 'Hello World');
await client.type('#input', 'Hello', 100); // with delay

// Scroll
await client.scroll({ y: 500 });
await client.scroll({ x: 100, y: 200 });
await client.scroll({ y: 300, selector: '#container' });
```

### JavaScript Execution

```javascript
const result = await client.executeScript('return document.title');
await client.executeScript('document.body.style.background = "red"');
```

### Proxy

```javascript
// Set proxy
await client.setProxy({
  host: 'proxy.example.com',
  port: 8080,
  protocol: 'http'
});

await client.setProxy({
  host: 'proxy.example.com',
  port: 1080,
  protocol: 'socks5',
  username: 'user',
  password: 'pass'
});

// Clear proxy
await client.clearProxy();
```

### Fingerprint / Evasion

```javascript
// Set user agent
await client.setUserAgent('Mozilla/5.0 ...');

// Set viewport
await client.setViewport(1920, 1080);

// Get fingerprint
const fingerprint = await client.getFingerprint();

// Randomize
await client.randomizeFingerprint();
```

## Error Handling

```javascript
const {
  BassetHoundClient,
  ConnectionError,
  CommandError,
  TimeoutError
} = require('basset-hound-client');

try {
  await client.connect();
  await client.navigate('https://example.com');
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
  } else if (error instanceof CommandError) {
    console.error('Command failed:', error.message);
    console.error('Details:', error.details);
  } else if (error instanceof TimeoutError) {
    console.error(`Timeout after ${error.timeout}ms`);
  }
}
```

## Custom Command Timeout

```javascript
// Set timeout for specific command
const result = await client.sendCommand(
  'navigate',
  { url: 'https://slow-site.com' },
  60000 // 60 second timeout
);
```

## License

MIT License
