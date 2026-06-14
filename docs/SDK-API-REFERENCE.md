# Basset Hound Browser SDK - Complete API Reference

## Table of Contents

1. [Client Initialization](#client-initialization)
2. [Connection Management](#connection-management)
3. [Navigation Commands](#navigation-commands)
4. [Interaction Commands](#interaction-commands)
5. [Content Extraction](#content-extraction)
6. [Screenshots](#screenshots)
7. [Cookie & Storage](#cookie--storage)
8. [Session Management](#session-management)
9. [Evasion & Detection Bypass](#evasion--detection-bypass)
10. [Batch Operations](#batch-operations)
11. [Monitoring](#monitoring)
12. [Connection Pooling](#connection-pooling)
13. [Streaming](#streaming)
14. [Event Handling](#event-handling)
15. [Type Definitions](#type-definitions)

---

## Client Initialization

### BrowserClient Constructor

```typescript
constructor(wsUrl?: string, options?: BrowserClientOptions)
```

**Parameters:**
- `wsUrl` (string, optional): WebSocket server URL (default: `ws://localhost:8765`)
- `options` (BrowserClientOptions, optional): Configuration options

**Options:**
```typescript
interface BrowserClientOptions {
  timeout?: number;           // Command timeout in ms (default: 30000)
  autoReconnect?: boolean;    // Auto-reconnect on disconnect (default: true)
  reconnectDelay?: number;    // Delay between reconnects ms (default: 1000)
  maxRetries?: number;        // Max command retries (default: 3)
  debug?: boolean;            // Enable debug logging (default: false)
}
```

**Example:**
```javascript
const client = new BrowserClient('ws://localhost:8765', {
  timeout: 30000,
  autoReconnect: true,
  maxRetries: 3,
  debug: false
});
```

---

## Connection Management

### connect()

```typescript
async connect(): Promise<boolean>
```

Establish WebSocket connection to server.

**Returns:** `true` if connection successful

**Example:**
```javascript
await client.connect();
console.log('Connected:', client.isConnected()); // true
```

---

### disconnect()

```typescript
async disconnect(): Promise<void>
```

Close WebSocket connection.

**Example:**
```javascript
await client.disconnect();
console.log('Connected:', client.isConnected()); // false
```

---

### isConnected()

```typescript
isConnected(): boolean
```

Check if client is currently connected.

**Returns:** `true` if connected

**Example:**
```javascript
if (client.isConnected()) {
  await client.navigate('https://example.com');
}
```

---

### healthCheck()

```typescript
async healthCheck(): Promise<boolean>
```

Ping the server to verify connection.

**Returns:** `true` if server is responding

**Example:**
```javascript
const healthy = await client.healthCheck();
if (!healthy) {
  await client.connect();
}
```

---

### sendCommand()

```typescript
async sendCommand(command: string, kwargs?: object): Promise<CommandResponse>
```

Send a command directly to the server.

**Parameters:**
- `command` (string): Command name
- `kwargs` (object, optional): Command parameters

**Returns:** `CommandResponse` object

**Example:**
```javascript
const response = await client.sendCommand('ping');
console.log(response.success); // true
```

---

## Navigation Commands

### navigate()

```typescript
async navigate(url: string, options?: NavigationOptions): Promise<CommandResponse>
```

Navigate to a URL.

**Parameters:**
- `url` (string): Target URL
- `options.waitTime` (number, optional): Wait time in ms before returning
- `options.waitFor` (string, optional): CSS selector to wait for

**Returns:** `CommandResponse`

**Example:**
```javascript
const response = await client.navigate('https://example.com', {
  waitTime: 2000,
  waitFor: '.content-loaded'
});
console.log(response.success); // true
```

---

### goBack()

```typescript
async goBack(): Promise<CommandResponse>
```

Navigate to previous page in history.

**Example:**
```javascript
await client.navigate('https://page1.com');
await client.navigate('https://page2.com');
await client.goBack(); // Back to page1
```

---

### goForward()

```typescript
async goForward(): Promise<CommandResponse>
```

Navigate to next page in history.

---

### refresh()

```typescript
async refresh(hard?: boolean): Promise<CommandResponse>
```

Refresh the current page.

**Parameters:**
- `hard` (boolean, optional): Force refresh without cache (default: false)

**Example:**
```javascript
await client.refresh(); // Soft refresh
await client.refresh(true); // Hard refresh
```

---

### getUrl()

```typescript
async getUrl(): Promise<CommandResponse>
```

Get the current page URL.

**Returns:** Response with `data.url`

**Example:**
```javascript
const response = await client.getUrl();
console.log(response.data.url); // https://example.com
```

---

### getTitle()

```typescript
async getTitle(): Promise<CommandResponse>
```

Get the page title.

**Returns:** Response with `data.title`

**Example:**
```javascript
const response = await client.getTitle();
console.log(response.data.title); // "Example Domain"
```

---

## Interaction Commands

### click()

```typescript
async click(selector: string, options?: InteractionOptions): Promise<CommandResponse>
```

Click an element.

**Parameters:**
- `selector` (string): CSS selector
- `options.humanize` (boolean, optional): Add realistic delays (default: true)

**Example:**
```javascript
await client.click('button.submit');
await client.click('a#next-page', { humanize: true });
```

---

### fill()

```typescript
async fill(selector: string, value: string, options?: InteractionOptions): Promise<CommandResponse>
```

Fill a form field with text.

**Parameters:**
- `selector` (string): CSS selector
- `value` (string): Text to fill
- `options.humanize` (boolean, optional): Add realistic delays

**Example:**
```javascript
await client.fill('input[name="email"]', 'user@example.com');
await client.fill('input[name="password"]', 'secret', { humanize: true });
```

---

### typeText()

```typescript
async typeText(text: string, options?: {selector?: string, humanize?: boolean}): Promise<CommandResponse>
```

Type text into focused element or specific field.

**Parameters:**
- `text` (string): Text to type
- `options.selector` (string, optional): Target selector
- `options.humanize` (boolean, optional): Add realistic delays

**Example:**
```javascript
await client.typeText('Hello world');
await client.typeText('test', { selector: 'input', humanize: true });
```

---

### hover()

```typescript
async hover(selector: string): Promise<CommandResponse>
```

Hover over an element.

**Example:**
```javascript
await client.hover('.menu-item');
```

---

### scroll()

```typescript
async scroll(options?: {x?: number, y?: number, selector?: string, humanize?: boolean}): Promise<CommandResponse>
```

Scroll the page.

**Parameters:**
- `options.x` (number, optional): Horizontal scroll amount (pixels)
- `options.y` (number, optional): Vertical scroll amount (pixels)
- `options.selector` (string, optional): Scroll specific element
- `options.humanize` (boolean, optional): Add realistic delays

**Example:**
```javascript
await client.scroll({ y: 500 }); // Scroll down
await client.scroll({ y: -500 }); // Scroll up
await client.scroll({ x: 100, y: 100 }); // Scroll diagonal
```

---

### waitForElement()

```typescript
async waitForElement(selector: string, timeout?: number): Promise<CommandResponse>
```

Wait for element to appear on page.

**Parameters:**
- `selector` (string): CSS selector to wait for
- `timeout` (number, optional): Timeout in ms (default: 10000)

**Example:**
```javascript
await client.waitForElement('.loader', 5000);
```

---

### executeScript()

```typescript
async executeScript(script: string): Promise<CommandResponse>
```

Execute JavaScript code in page context.

**Parameters:**
- `script` (string): JavaScript code

**Returns:** Response with `data.result`

**Example:**
```javascript
const response = await client.executeScript('return document.title;');
console.log(response.data.result); // Page title
```

---

## Content Extraction

### getContent()

```typescript
async getContent(): Promise<CommandResponse>
```

Get entire page HTML.

**Returns:** Response with `data.html`

**Example:**
```javascript
const response = await client.getContent();
console.log(response.data.html.length); // HTML length
```

---

### getPageState()

```typescript
async getPageState(): Promise<CommandResponse>
```

Get current page state (DOM, scroll position, etc.).

---

### extractLinks()

```typescript
async extractLinks(options?: {includeExternal?: boolean}): Promise<CommandResponse>
```

Extract all links from page.

**Parameters:**
- `options.includeExternal` (boolean, optional): Include external links (default: true)

**Returns:** Response with `data.links` array

**Example:**
```javascript
const response = await client.extractLinks();
console.log(response.data.links); // Array of URLs
```

---

### extractForms()

```typescript
async extractForms(): Promise<CommandResponse>
```

Extract all forms from page.

**Returns:** Response with `data.forms` array

**Example:**
```javascript
const response = await client.extractForms();
console.log(response.data.forms.length); // Number of forms
```

---

### extractImages()

```typescript
async extractImages(options?: {includeLazy?: boolean}): Promise<CommandResponse>
```

Extract all images from page.

**Parameters:**
- `options.includeLazy` (boolean, optional): Include lazy-loaded images (default: true)

**Returns:** Response with `data.images` array

---

### extractMetadata()

```typescript
async extractMetadata(): Promise<CommandResponse>
```

Extract page metadata (title, description, OpenGraph tags, etc.).

**Returns:** Response with `data` containing metadata

**Example:**
```javascript
const response = await client.extractMetadata();
console.log(response.data.title);
console.log(response.data.description);
```

---

### extractAll()

```typescript
async extractAll(): Promise<CommandResponse>
```

Extract all content at once (links, forms, images, metadata).

**Returns:** Response with complete `data` object

---

### detectTechnology()

```typescript
async detectTechnology(): Promise<CommandResponse>
```

Detect technologies (frameworks, libraries, services) used on page.

**Returns:** Response with `data` containing detected technologies

**Example:**
```javascript
const response = await client.detectTechnology();
console.log(response.data.frameworks); // Detected frameworks
```

---

### identifyCms()

```typescript
async identifyCms(html?: string): Promise<CommandResponse>
```

Identify CMS platform (WordPress, Drupal, Joomla, etc.).

**Parameters:**
- `html` (string, optional): HTML to analyze (defaults to page content)

---

### identifyAnalytics()

```typescript
async identifyAnalytics(html?: string): Promise<CommandResponse>
```

Identify analytics services (Google Analytics, Segment, etc.).

---

## Screenshots

### screenshot()

```typescript
async screenshot(options?: ScreenshotOptions): Promise<CommandResponse>
```

Take screenshot of entire page.

**Parameters:**
- `options.format` (string, optional): 'png' or 'jpeg' (default: 'png')
- `options.quality` (number, optional): JPEG quality 0-100 (default: 90)

**Returns:** Response with `data.buffer` and `data.size`

**Example:**
```javascript
const response = await client.screenshot({ format: 'jpeg', quality: 85 });
console.log(response.data.size); // Size in bytes
```

---

### screenshotViewport()

```typescript
async screenshotViewport(options?: ScreenshotOptions): Promise<CommandResponse>
```

Screenshot viewport (visible area) only.

---

### screenshotFullPage()

```typescript
async screenshotFullPage(options?: ScreenshotOptions): Promise<CommandResponse>
```

Screenshot full scrollable page.

---

### screenshotElement()

```typescript
async screenshotElement(selector: string, options?: ScreenshotOptions): Promise<CommandResponse>
```

Screenshot a specific element.

**Parameters:**
- `selector` (string): CSS selector
- `options` (ScreenshotOptions, optional): Format and quality

---

### screenshotForensic()

```typescript
async screenshotForensic(options?: ForensicScreenshotOptions): Promise<CommandResponse>
```

Screenshot with forensic metadata (hash, signature).

**Parameters:**
- `options.includeHash` (boolean, optional): Include SHA256 hash
- `options.includeSignature` (boolean, optional): Include digital signature
- `options.format` (string, optional): 'png' or 'jpeg'

---

## Cookie & Storage

### getCookies()

```typescript
async getCookies(url: string): Promise<CommandResponse>
```

Get cookies for a URL.

**Parameters:**
- `url` (string): URL to get cookies for

**Returns:** Response with `data.cookies` array

---

### setCookie()

```typescript
async setCookie(name: string, value: string, options?: CookieOptions): Promise<CommandResponse>
```

Set a cookie.

**Parameters:**
- `name` (string): Cookie name
- `value` (string): Cookie value
- `options` (object, optional): Cookie options
  - `domain` (string): Cookie domain
  - `path` (string): Cookie path
  - `expires` (number): Expiration timestamp
  - `httpOnly` (boolean): HttpOnly flag
  - `secure` (boolean): Secure flag
  - `sameSite` (string): 'Strict', 'Lax', or 'None'

**Example:**
```javascript
await client.setCookie('session', 'abc123', {
  domain: 'example.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict'
});
```

---

### deleteCookie()

```typescript
async deleteCookie(name: string): Promise<CommandResponse>
```

Delete a cookie.

---

### getLocalStorage()

```typescript
async getLocalStorage(): Promise<CommandResponse>
```

Get all local storage items.

**Returns:** Response with `data` object

---

### getSessionStorage()

```typescript
async getSessionStorage(): Promise<CommandResponse>
```

Get all session storage items.

---

## Session Management

### createCheckpoint()

```typescript
async createCheckpoint(checkpointName: string, description?: string): Promise<CheckpointDetails>
```

Create a checkpoint of current session state.

**Parameters:**
- `checkpointName` (string): Checkpoint name
- `description` (string, optional): Description

**Returns:** Object with `checkpointId` and `timestamp`

**Example:**
```javascript
const cp = await client.createCheckpoint('after-login', 'User logged in');
console.log(cp.checkpointId); // Unique ID
```

---

### rollbackToCheckpoint()

```typescript
async rollbackToCheckpoint(checkpointId: string): Promise<object>
```

Restore session to a checkpoint.

**Parameters:**
- `checkpointId` (string): Checkpoint ID

**Example:**
```javascript
await client.rollbackToCheckpoint(checkpointId);
```

---

### listCheckpoints()

```typescript
async listCheckpoints(): Promise<CheckpointDetails[]>
```

List all checkpoints.

**Returns:** Array of checkpoint objects

---

### deleteCheckpoint()

```typescript
async deleteCheckpoint(checkpointId: string): Promise<boolean>
```

Delete a checkpoint.

**Returns:** `true` if successful

---

### branchSession()

```typescript
async branchSession(checkpointId: string, branchName?: string): Promise<object>
```

Create a branch from a checkpoint.

**Parameters:**
- `checkpointId` (string): Checkpoint to branch from
- `branchName` (string, optional): Branch name

---

### resumeSession()

```typescript
async resumeSession(checkpointId: string, recoveryOptions?: object): Promise<object>
```

Resume session from checkpoint with recovery options.

---

## Evasion & Detection Bypass

### applyFingerprint()

```typescript
async applyFingerprint(profileName: string, options?: object): Promise<CommandResponse>
```

Apply a fingerprint profile.

**Parameters:**
- `profileName` (string): Profile name (e.g., 'chrome-100-windows')
- `options` (object, optional): Additional fingerprint options

**Example:**
```javascript
await client.applyFingerprint('chrome-100-windows');
await client.applyFingerprint('firefox-95-macos');
```

---

### rotateUserAgent()

```typescript
async rotateUserAgent(): Promise<CommandResponse>
```

Rotate to a random user agent.

**Returns:** Response with `data.userAgent`

---

### setProxy()

```typescript
async setProxy(proxyUrl: string, credentials?: ProxyCredentials): Promise<CommandResponse>
```

Set proxy for connections.

**Parameters:**
- `proxyUrl` (string): Proxy URL (http/https/socks4/socks5)
- `credentials` (object, optional): Proxy credentials
  - `username` (string): Username
  - `password` (string): Password

**Example:**
```javascript
await client.setProxy('http://proxy.example.com:8080');
await client.setProxy('socks5://proxy.example.com:1080', {
  username: 'user',
  password: 'pass'
});
```

---

### enableTor()

```typescript
async enableTor(): Promise<CommandResponse>
```

Enable Tor routing.

---

### disableTor()

```typescript
async disableTor(): Promise<CommandResponse>
```

Disable Tor routing.

---

### getProxyReputation()

```typescript
async getProxyReputation(proxyAddress: string, sessionId?: string): Promise<CommandResponse>
```

Get reputation score for a proxy.

**Returns:** Response with reputation data

---

### setGeoLock()

```typescript
async setGeoLock(config?: GeoLockConfig): Promise<CommandResponse>
```

Set geographic location spoofing.

**Parameters:**
- `config` (object, optional):
  - `country` (string): Country code
  - `region` (string): Region/state
  - `latitude` (number): Latitude
  - `longitude` (number): Longitude

**Example:**
```javascript
await client.setGeoLock({
  country: 'US',
  region: 'CA',
  latitude: 37.7749,
  longitude: -122.4194
});
```

---

### getProxyAnalytics()

```typescript
async getProxyAnalytics(sessionId?: string, aggregate?: boolean): Promise<CommandResponse>
```

Get proxy usage analytics.

---

## Batch Operations

### batchCommands()

```typescript
async batchCommands(commands: BatchCommand[]): Promise<CommandResponse[]>
```

Execute multiple commands in sequence.

**Parameters:**
- `commands` (array): Array of `{command, ...params}` objects

**Returns:** Array of `CommandResponse` objects

**Example:**
```javascript
const responses = await client.batchCommands([
  { command: 'navigate', url: 'https://page1.com' },
  { command: 'get_title' },
  { command: 'screenshot' }
]);
```

---

### batch()

```typescript
async batch(operations: BatchCommand[]): Promise<CommandResponse[]>
```

Execute batch with atomic semantics (all succeed or all fail).

---

### batchParallel()

```typescript
async batchParallel(operations: BatchCommand[], concurrency?: number): Promise<CommandResponse[]>
```

Execute commands in parallel with concurrency limit.

**Parameters:**
- `operations` (array): Command array
- `concurrency` (number, optional): Max parallel operations (default: 5)

---

## Monitoring

### addMonitor()

```typescript
async addMonitor(url: string, name: string, frequency?: string, alerts?: object): Promise<CommandResponse>
```

Add a monitor for a URL.

**Parameters:**
- `url` (string): URL to monitor
- `name` (string): Monitor name
- `frequency` (string, optional): 'hourly', 'daily', 'weekly', 'monthly'
- `alerts` (object, optional): Alert configuration

---

### listMonitors()

```typescript
async listMonitors(filter?: object): Promise<CommandResponse>
```

List all monitors.

---

### removeMonitor()

```typescript
async removeMonitor(monitorId: string): Promise<CommandResponse>
```

Remove a monitor.

---

### startMonitoringService()

```typescript
async startMonitoringService(): Promise<CommandResponse>
```

Start the monitoring service.

---

### stopMonitoringService()

```typescript
async stopMonitoringService(): Promise<CommandResponse>
```

Stop the monitoring service.

---

### getMonitoringServiceStatus()

```typescript
async getMonitoringServiceStatus(): Promise<CommandResponse>
```

Get monitoring service status.

---

## Connection Pooling

### ConnectionPool

```typescript
class ConnectionPool {
  constructor(wsUrl?: string, maxConnections?: number, options?: BrowserClientOptions)
}
```

Manage multiple client connections.

---

### connectAll()

```typescript
async connectAll(): Promise<void>
```

Connect all clients in pool.

---

### executeCommand()

```typescript
async executeCommand(command: string, kwargs?: object, strategy?: string): Promise<CommandResponse>
```

Execute command using least-busy client.

**Parameters:**
- `strategy` (string, optional): 'least-busy' or 'round-robin'

---

### executeBatch()

```typescript
async executeBatch(operations: BatchCommand[]): Promise<CommandResponse[]>
```

Execute batch across multiple clients.

---

### closeAll()

```typescript
async closeAll(): Promise<void>
```

Close all connections.

---

### getStats()

```typescript
getStats(): PoolStats
```

Get pool statistics.

---

## Streaming

### streamCommand()

```typescript
async streamCommand(command: string, kwargs?: object, onChunk?: Function): Promise<CommandResponse>
```

Stream a command response for large payloads.

**Parameters:**
- `command` (string): Command name
- `kwargs` (object, optional): Command parameters
- `onChunk` (Function, optional): Callback for each chunk

**Example:**
```javascript
const response = await client.streamCommand('screenshot', {}, (chunk) => {
  console.log('Received', chunk.length, 'bytes');
});
```

---

## Event Handling

### on()

```typescript
on(event: EventName, handler: EventHandler): void
```

Listen to client events.

**Parameters:**
- `event` (string): 'connect', 'disconnect', 'error', or 'message'
- `handler` (Function): Event handler

**Example:**
```javascript
client.on('connect', () => {
  console.log('Connected');
});

client.on('error', (error) => {
  console.error('Error:', error);
});
```

---

### off()

```typescript
off(event: EventName, handler: EventHandler): void
```

Stop listening to event.

---

## Type Definitions

### CommandResponse

```typescript
interface CommandResponse {
  id: string;
  command: string;
  success: boolean;
  data?: any;
  error?: string | null;
  recovery?: RecoverySuggestion;
  executionTime: number;

  isSuccess(): boolean;
  isError(): boolean;
  hasRecovery(): boolean;
}
```

### SessionCheckpoint

```typescript
interface SessionCheckpoint {
  id: string;
  name: string;
  timestamp: number;
  state: Record<string, any>;
  metadata: Record<string, any>;
  
  toJSON(): CheckpointDetails;
}
```

### SessionInfo

```typescript
interface SessionInfo {
  connected: boolean;
  sessionId: string | null;
  currentCheckpoint: string | null;
  checkpointCount: number;
}
```

---

**API Version:** 12.2.0  
**Last Updated:** June 2026
