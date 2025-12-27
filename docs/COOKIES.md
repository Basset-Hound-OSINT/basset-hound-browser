# Cookie Management API

The CookieManager module provides comprehensive cookie management capabilities for the Basset Hound Browser. It supports multiple import/export formats and provides a complete API for cookie manipulation.

## Overview

The Cookie Management system enables:
- Getting, setting, and deleting cookies
- Multiple export/import formats (JSON, Netscape, EditThisCookie)
- File-based import/export operations
- Cookie synchronization and persistence
- Domain-based cookie filtering
- Cookie statistics and analytics

## Module Location

```
basset-hound-browser/cookies/manager.js
```

## Supported Cookie Formats

### COOKIE_FORMATS Constant

```javascript
const COOKIE_FORMATS = {
  JSON: 'json',
  NETSCAPE: 'netscape',
  EDIT_THIS_COOKIE: 'editthiscookie'
};
```

| Format | Description | Use Case |
|--------|-------------|----------|
| `json` | Standard JSON array format | Native Electron format, general storage |
| `netscape` | Netscape/Mozilla tab-separated format | Compatible with curl, wget, HTTPie |
| `editthiscookie` | EditThisCookie browser extension format | Import from browser extensions |

## CookieManager Class

### Constructor

```javascript
const { CookieManager } = require('./cookies/manager');

// Use default session
const cookieManager = new CookieManager();

// Use custom Electron session
const cookieManager = new CookieManager(customSession);
```

### Session Management Methods

#### getSession()

Get the current Electron session used for cookie operations.

```javascript
const session = cookieManager.getSession();
```

**Returns:** `Electron.Session` - The session object

#### setSession(electronSession)

Set the Electron session to use for cookie operations.

```javascript
cookieManager.setSession(session.fromPartition('persist:myprofile'));
```

**Parameters:**
- `electronSession` (Electron.Session) - The session to use

---

## Core Cookie Operations

### getCookies(url)

Get all cookies for a specific URL.

```javascript
const result = await cookieManager.getCookies('https://example.com');
```

**Parameters:**
- `url` (string, required) - The URL to get cookies for

**Returns:**
```javascript
{
  success: true,
  cookies: [
    {
      name: 'session_id',
      value: 'abc123',
      domain: '.example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      expirationDate: 1735689600
    }
  ]
}
// Or on error:
{ success: false, error: 'URL is required' }
```

### getAllCookies(filter)

Get all cookies from the browser with optional filtering.

```javascript
// Get all cookies
const result = await cookieManager.getAllCookies();

// Filter by domain
const result = await cookieManager.getAllCookies({ domain: '.example.com' });

// Filter by name
const result = await cookieManager.getAllCookies({ name: 'session_id' });
```

**Parameters:**
- `filter` (Object, optional) - Filter object (domain, name, path, etc.)

**Returns:**
```javascript
{
  success: true,
  cookies: [...],
  count: 42
}
```

### setCookie(cookie)

Set a single cookie.

```javascript
const result = await cookieManager.setCookie({
  url: 'https://example.com',
  name: 'session_id',
  value: 'abc123',
  domain: '.example.com',
  path: '/',
  secure: true,
  httpOnly: true,
  expirationDate: 1735689600
});
```

**Parameters:**
- `cookie` (Object, required) - Cookie object with the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | string | Yes | Full URL for setting the cookie |
| `name` | string | Yes | Cookie name |
| `value` | string | Yes | Cookie value |
| `domain` | string | No | Domain (e.g., ".example.com") |
| `path` | string | No | Path (default: "/") |
| `secure` | boolean | No | Requires HTTPS |
| `httpOnly` | boolean | No | HTTP-only cookie |
| `sameSite` | string | No | "no_restriction", "lax", "strict" |
| `expirationDate` | number | No | Unix timestamp (omit for session cookie) |

**Returns:**
```javascript
{ success: true }
// Or on error:
{ success: false, error: 'Cookie must have url and name' }
```

### setCookies(cookies)

Set multiple cookies at once.

```javascript
const result = await cookieManager.setCookies([
  { url: 'https://example.com', name: 'session_id', value: 'abc123' },
  { url: 'https://example.com', name: 'csrf_token', value: 'xyz789' }
]);
```

**Parameters:**
- `cookies` (Array, required) - Array of cookie objects

**Returns:**
```javascript
{
  success: true,  // true if no failures
  set: 2,
  failed: 0,
  errors: []
}
// With errors:
{
  success: false,
  set: 1,
  failed: 1,
  errors: [{ cookie: 'invalid', error: 'Error message' }]
}
```

### deleteCookie(url, name)

Delete a specific cookie.

```javascript
const result = await cookieManager.deleteCookie(
  'https://example.com',
  'session_id'
);
```

**Parameters:**
- `url` (string, required) - The URL associated with the cookie
- `name` (string, required) - The name of the cookie to delete

**Returns:**
```javascript
{ success: true }
```

### clearCookies(domain)

Clear all cookies, optionally for a specific domain.

```javascript
// Clear all cookies
const result = await cookieManager.clearCookies();

// Clear cookies for a specific domain
const result = await cookieManager.clearCookies('.example.com');
```

**Parameters:**
- `domain` (string, optional) - Clear cookies only for this domain

**Returns:**
```javascript
{
  success: true,
  cleared: 15
}
```

### getCookiesForDomain(domain)

Get all cookies for a specific domain.

```javascript
const result = await cookieManager.getCookiesForDomain('.example.com');
```

**Parameters:**
- `domain` (string, required) - The domain to get cookies for

**Returns:**
```javascript
{
  success: true,
  cookies: [...],
  count: 5
}
```

---

## Export Operations

### exportCookies(format, filter)

Export cookies to a specific format.

```javascript
// Export all cookies as JSON
const result = await cookieManager.exportCookies('json');

// Export domain cookies as Netscape format
const result = await cookieManager.exportCookies('netscape', {
  domain: '.example.com'
});
```

**Parameters:**
- `format` (string, optional) - Export format: 'json', 'netscape', 'editthiscookie' (default: 'json')
- `filter` (Object, optional) - Filter for cookies to export

**Returns:**
```javascript
{
  success: true,
  data: '...', // String data in specified format
  cookies: [...], // Array of cookie objects
  format: 'netscape'
}
```

### exportToFile(filepath, format, filter)

Export cookies directly to a file.

```javascript
const result = await cookieManager.exportToFile(
  '/tmp/cookies.txt',
  'netscape',
  { domain: '.example.com' }
);
```

**Parameters:**
- `filepath` (string, required) - Path to save the file
- `format` (string, optional) - Export format (default: 'json')
- `filter` (Object, optional) - Filter for cookies to export

**Returns:**
```javascript
{
  success: true,
  filepath: '/tmp/cookies.txt',
  count: 15,
  format: 'netscape'
}
```

---

## Import Operations

### importCookies(data, format)

Import cookies from a data string.

```javascript
// Auto-detect format
const result = await cookieManager.importCookies(cookieData, 'auto');

// Specify format explicitly
const result = await cookieManager.importCookies(jsonData, 'json');
```

**Parameters:**
- `data` (string, required) - Cookie data string
- `format` (string, optional) - Import format or 'auto' for detection (default: 'auto')

**Returns:**
```javascript
{
  success: true,
  set: 10,
  failed: 0,
  errors: []
}
```

### importFromFile(filepath, format)

Import cookies from a file.

```javascript
const result = await cookieManager.importFromFile('/tmp/cookies.txt', 'auto');
```

**Parameters:**
- `filepath` (string, required) - Path to the cookie file
- `format` (string, optional) - Import format or 'auto' (default: 'auto')

**Returns:**
```javascript
{
  success: true,
  set: 15,
  failed: 0,
  errors: []
}
// Or on error:
{ success: false, error: 'File not found: /path/to/file' }
```

### detectFormat(data)

Automatically detect the format of cookie data.

```javascript
const format = cookieManager.detectFormat(cookieData);
// Returns: 'json', 'netscape', or 'editthiscookie'
```

---

## Utility Methods

### copyCookies(fromDomain, toDomain)

Copy cookies from one domain to another.

```javascript
const result = await cookieManager.copyCookies(
  '.source.com',
  '.target.com'
);
```

**Parameters:**
- `fromDomain` (string) - Source domain
- `toDomain` (string) - Target domain

**Returns:**
```javascript
{
  success: true,
  set: 5,
  failed: 0
}
```

### getStats()

Get cookie statistics.

```javascript
const result = await cookieManager.getStats();
```

**Returns:**
```javascript
{
  success: true,
  stats: {
    total: 42,
    domains: 5,
    secure: 38,
    httpOnly: 25,
    session: 10,
    persistent: 32
  }
}
```

### getFormats()

Get available export/import formats with descriptions.

```javascript
const formats = cookieManager.getFormats();
```

**Returns:**
```javascript
{
  formats: ['json', 'netscape', 'editthiscookie'],
  descriptions: {
    json: 'Standard JSON array format',
    netscape: 'Netscape/Mozilla format (compatible with curl, wget)',
    editthiscookie: 'EditThisCookie browser extension format'
  }
}
```

### flushCookies()

Flush cookies to persistent storage.

```javascript
const result = await cookieManager.flushCookies();
```

**Returns:**
```javascript
{ success: true }
```

### buildCookieUrl(cookie)

Build a URL from a cookie object for removal/setting operations.

```javascript
const url = cookieManager.buildCookieUrl({
  domain: '.example.com',
  path: '/app',
  secure: true
});
// Returns: 'https://example.com/app'
```

---

## Internal Parsing Methods

### parseJSON(data)

Parse JSON format cookies and normalize for import.

```javascript
const cookies = cookieManager.parseJSON(jsonString);
```

### parseNetscape(data)

Parse Netscape/Mozilla format cookies.

```javascript
const cookies = cookieManager.parseNetscape(netscapeString);
```

### parseEditThisCookie(data)

Parse EditThisCookie format cookies.

```javascript
const cookies = cookieManager.parseEditThisCookie(etcString);
```

### normalizeCookie(cookie)

Normalize a cookie object for Electron's cookies.set().

```javascript
const normalized = cookieManager.normalizeCookie(rawCookie);
```

### normalizeSameSite(sameSite)

Normalize sameSite value to Electron-compatible format.

```javascript
const value = cookieManager.normalizeSameSite('Lax');
// Returns: 'lax'
```

---

## WebSocket Commands

All commands are sent via WebSocket on port 8765.

### get_cookies

```json
{
  "command": "get_cookies",
  "url": "https://example.com"
}
```

### get_all_cookies

```json
{
  "command": "get_all_cookies",
  "filter": { "domain": ".example.com" }
}
```

### set_cookie

```json
{
  "command": "set_cookie",
  "cookie": {
    "url": "https://example.com",
    "name": "session_id",
    "value": "abc123"
  }
}
```

### set_cookies

```json
{
  "command": "set_cookies",
  "cookies": [
    { "url": "https://example.com", "name": "a", "value": "1" },
    { "url": "https://example.com", "name": "b", "value": "2" }
  ]
}
```

### delete_cookie

```json
{
  "command": "delete_cookie",
  "url": "https://example.com",
  "name": "session_id"
}
```

### clear_all_cookies

```json
{
  "command": "clear_all_cookies",
  "domain": ".example.com"
}
```

### export_cookies

```json
{
  "command": "export_cookies",
  "format": "netscape",
  "domain": ".example.com"
}
```

### import_cookies

```json
{
  "command": "import_cookies",
  "data": "[{\"url\":\"https://example.com\",\"name\":\"a\",\"value\":\"1\"}]",
  "format": "json"
}
```

### export_cookies_file

```json
{
  "command": "export_cookies_file",
  "filepath": "/tmp/cookies.txt",
  "format": "netscape"
}
```

### import_cookies_file

```json
{
  "command": "import_cookies_file",
  "filepath": "/tmp/cookies.txt",
  "format": "auto"
}
```

### get_cookies_for_domain

```json
{
  "command": "get_cookies_for_domain",
  "domain": ".example.com"
}
```

### get_cookie_stats

```json
{
  "command": "get_cookie_stats"
}
```

### get_cookie_formats

```json
{
  "command": "get_cookie_formats"
}
```

### flush_cookies

```json
{
  "command": "flush_cookies"
}
```

---

## Format Examples

### JSON Format

```json
[
  {
    "name": "session_id",
    "value": "abc123def456",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "lax",
    "expirationDate": 1735689600
  }
]
```

### Netscape Format

```
# Netscape HTTP Cookie File
# https://curl.se/docs/http-cookies.html
# This file was generated by Basset Hound Browser

.example.com	TRUE	/	TRUE	1735689600	session_id	abc123def456
www.example.com	FALSE	/app	TRUE	1735689600	csrf_token	xyz789
```

Field order: domain, include_subdomains, path, secure, expiration, name, value

### EditThisCookie Format

```json
[
  {
    "domain": ".example.com",
    "expirationDate": 1735689600,
    "hostOnly": false,
    "httpOnly": true,
    "name": "session_id",
    "path": "/",
    "sameSite": "lax",
    "secure": true,
    "session": false,
    "storeId": "0",
    "value": "abc123def456",
    "id": 123456
  }
]
```

---

## Code Examples

### Basic Cookie Management

```javascript
const { CookieManager } = require('./cookies/manager');

const manager = new CookieManager();

// Set a session cookie
await manager.setCookie({
  url: 'https://example.com',
  name: 'session_id',
  value: 'my-session-token'
});

// Get all cookies for a URL
const { cookies } = await manager.getCookies('https://example.com');
console.log('Cookies:', cookies);

// Clear all cookies
await manager.clearCookies();
```

### Export and Import Workflow

```javascript
// Export cookies to Netscape format file
await manager.exportToFile('/data/backup.txt', 'netscape');

// Later, import them back
await manager.importFromFile('/data/backup.txt', 'auto');
```

### Copy Session Between Domains

```javascript
// Clone cookies from development to staging
const result = await manager.copyCookies(
  '.dev.example.com',
  '.staging.example.com'
);
console.log(`Copied ${result.set} cookies`);
```

### Use with curl

```bash
# Export cookies
ws.send({ command: 'export_cookies_file', filepath: '/tmp/cookies.txt', format: 'netscape' })

# Use with curl
curl -b /tmp/cookies.txt https://example.com/api/endpoint
curl -c /tmp/cookies.txt https://example.com/login # Save new cookies
```

---

## Configuration Options

The CookieManager operates on Electron sessions and respects their configuration. To configure cookie behavior:

```javascript
const { session } = require('electron');

// Create a custom session with specific settings
const customSession = session.fromPartition('persist:myprofile');

// Configure cookie settings
customSession.cookies.on('changed', (event, cookie, cause, removed) => {
  console.log('Cookie changed:', cookie.name, cause);
});

// Use with CookieManager
const manager = new CookieManager(customSession);
```

---

## Error Handling

All methods return objects with a `success` boolean:

```javascript
const result = await manager.setCookie({ name: 'test' }); // Missing url

if (!result.success) {
  console.error('Error:', result.error);
  // Error: "Cookie must have url and name"
}
```

Common errors:
- `"URL is required"` - getCookies called without URL
- `"Cookie must have url and name"` - setCookie missing required fields
- `"Cookies must be an array"` - setCookies received non-array
- `"URL and name are required"` - deleteCookie missing parameters
- `"Unknown format: xxx"` - Invalid export/import format
- `"No valid cookies found in data"` - Import data has no valid cookies
- `"File not found: /path"` - Import file doesn't exist
