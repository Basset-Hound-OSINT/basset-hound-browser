# Cookie Management API

The Basset Hound Browser provides comprehensive cookie management capabilities for import, export, and manipulation of browser cookies. This is essential for OSINT workflows that require session persistence across browser restarts or sharing sessions between tools.

## Supported Formats

### JSON Format
Standard JSON array of cookie objects. Native format for Electron.

### Netscape/Mozilla Format
Tab-separated format compatible with:
- curl (`--cookie` and `--cookie-jar` options)
- wget
- HTTPie
- Most HTTP clients and automation tools

### EditThisCookie Format
JSON format compatible with the popular browser extension. Useful for:
- Importing cookies from browser extensions
- Cross-browser cookie migration

## WebSocket API Commands

All commands are sent via WebSocket on port 8765.

### get_cookies
Get cookies for a specific URL.

**Request:**
```json
{
  "command": "get_cookies",
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expirationDate": 1735689600
    }
  ]
}
```

### get_all_cookies
Get all cookies from the browser, optionally filtered.

**Request:**
```json
{
  "command": "get_all_cookies",
  "filter": {
    "domain": ".example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "cookies": [...],
  "count": 42
}
```

### set_cookie
Set a single cookie.

**Request:**
```json
{
  "command": "set_cookie",
  "cookie": {
    "url": "https://example.com",
    "name": "session_id",
    "value": "abc123",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "expirationDate": 1735689600
  }
}
```

### set_cookies
Set multiple cookies at once.

**Request:**
```json
{
  "command": "set_cookies",
  "cookies": [
    {
      "url": "https://example.com",
      "name": "session_id",
      "value": "abc123"
    },
    {
      "url": "https://example.com",
      "name": "csrf_token",
      "value": "xyz789"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "set": 2,
  "failed": 0,
  "errors": []
}
```

### delete_cookie
Delete a specific cookie.

**Request:**
```json
{
  "command": "delete_cookie",
  "url": "https://example.com",
  "name": "session_id"
}
```

### clear_all_cookies
Clear all cookies, optionally for a specific domain.

**Request:**
```json
{
  "command": "clear_all_cookies",
  "domain": ".example.com"
}
```

**Response:**
```json
{
  "success": true,
  "cleared": 15
}
```

### export_cookies
Export cookies to a specified format.

**Request:**
```json
{
  "command": "export_cookies",
  "format": "netscape",
  "domain": ".example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": "# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tTRUE\t1735689600\tsession_id\tabc123",
  "cookies": [...],
  "format": "netscape"
}
```

### import_cookies
Import cookies from a data string.

**Request:**
```json
{
  "command": "import_cookies",
  "data": "[{\"url\":\"https://example.com\",\"name\":\"session_id\",\"value\":\"abc123\"}]",
  "format": "json"
}
```

**Response:**
```json
{
  "success": true,
  "set": 1,
  "failed": 0,
  "errors": []
}
```

### export_cookies_file
Export cookies directly to a file.

**Request:**
```json
{
  "command": "export_cookies_file",
  "filepath": "/tmp/cookies.txt",
  "format": "netscape",
  "domain": ".example.com"
}
```

**Response:**
```json
{
  "success": true,
  "filepath": "/tmp/cookies.txt",
  "count": 15,
  "format": "netscape"
}
```

### import_cookies_file
Import cookies from a file.

**Request:**
```json
{
  "command": "import_cookies_file",
  "filepath": "/tmp/cookies.txt",
  "format": "auto"
}
```

**Response:**
```json
{
  "success": true,
  "set": 15,
  "failed": 0,
  "errors": []
}
```

### get_cookies_for_domain
Get all cookies for a specific domain.

**Request:**
```json
{
  "command": "get_cookies_for_domain",
  "domain": ".example.com"
}
```

### get_cookie_stats
Get statistics about stored cookies.

**Request:**
```json
{
  "command": "get_cookie_stats"
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 42,
    "domains": 5,
    "secure": 38,
    "httpOnly": 25,
    "session": 10,
    "persistent": 32
  }
}
```

### get_cookie_formats
Get available export/import formats.

**Request:**
```json
{
  "command": "get_cookie_formats"
}
```

**Response:**
```json
{
  "success": true,
  "formats": ["json", "netscape", "editthiscookie"],
  "descriptions": {
    "json": "Standard JSON array format",
    "netscape": "Netscape/Mozilla format (compatible with curl, wget)",
    "editthiscookie": "EditThisCookie browser extension format"
  }
}
```

### flush_cookies
Flush cookies to persistent storage.

**Request:**
```json
{
  "command": "flush_cookies"
}
```

## Renderer API (preload.js)

The following methods are available via `window.electronAPI`:

```javascript
// Get cookies for a URL
await window.electronAPI.getCookies('https://example.com');

// Get all cookies with optional filter
await window.electronAPI.getAllCookies({ domain: '.example.com' });

// Set a single cookie
await window.electronAPI.setCookie({
  url: 'https://example.com',
  name: 'session_id',
  value: 'abc123'
});

// Set multiple cookies
await window.electronAPI.setCookies([...cookies]);

// Delete a cookie
await window.electronAPI.deleteCookie('https://example.com', 'session_id');

// Clear cookies (optionally for a domain)
await window.electronAPI.clearCookies('.example.com');

// Export cookies
const result = await window.electronAPI.exportCookies('netscape', { domain: '.example.com' });
console.log(result.data);

// Import cookies
await window.electronAPI.importCookies(cookieData, 'json');

// Export to file
await window.electronAPI.exportCookiesFile('/tmp/cookies.txt', 'netscape');

// Import from file
await window.electronAPI.importCookiesFile('/tmp/cookies.txt', 'auto');

// Get cookie stats
const stats = await window.electronAPI.getCookieStats();

// Get available formats
const formats = await window.electronAPI.getCookieFormats();

// Flush to storage
await window.electronAPI.flushCookies();
```

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
  },
  {
    "name": "csrf_token",
    "value": "xyz789",
    "domain": "www.example.com",
    "path": "/app",
    "secure": true,
    "httpOnly": false,
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
    "id": 1
  }
]
```

## Use Cases

### Persist Session Across Browser Restarts
```javascript
// Export before closing
const result = await ws.send({
  command: 'export_cookies_file',
  filepath: '/data/session.json',
  format: 'json'
});

// Import when starting
await ws.send({
  command: 'import_cookies_file',
  filepath: '/data/session.json'
});
```

### Share Session with curl
```bash
# Export in Netscape format
ws.send({ command: 'export_cookies_file', filepath: '/tmp/cookies.txt', format: 'netscape' })

# Use with curl
curl -b /tmp/cookies.txt https://example.com/api/endpoint
```

### Import Cookies from Browser Extension
```javascript
// Export from EditThisCookie extension and save as cookies.json
await ws.send({
  command: 'import_cookies_file',
  filepath: 'cookies.json',
  format: 'editthiscookie'
});
```

### Clone Session from One Domain to Another
```javascript
// Get cookies from source domain
const { cookies } = await ws.send({
  command: 'get_cookies_for_domain',
  domain: '.source.com'
});

// Modify and set for target domain
const targetCookies = cookies.map(c => ({
  ...c,
  domain: '.target.com',
  url: `https://target.com${c.path}`
}));

await ws.send({
  command: 'set_cookies',
  cookies: targetCookies
});
```

## Cookie Object Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| url | string | Yes* | Full URL for setting the cookie |
| name | string | Yes | Cookie name |
| value | string | Yes | Cookie value |
| domain | string | No | Domain for the cookie (e.g., ".example.com") |
| path | string | No | Path for the cookie (default: "/") |
| secure | boolean | No | Whether cookie requires HTTPS |
| httpOnly | boolean | No | Whether cookie is HTTP-only |
| sameSite | string | No | SameSite policy: "no_restriction", "lax", "strict" |
| expirationDate | number | No | Unix timestamp for expiration (omit for session cookie) |

*URL is required when setting cookies, not when reading them.
