# Headers Module Documentation

The Headers module provides comprehensive HTTP header management for both requests and responses, including profiles, conditional rules, and URL-based header modification.

## Overview

The Headers module consists of two main components:

- **HeaderManager** (`headers/manager.js`): Core API for header modification, profiles, and conditional rules
- **Profiles** (`headers/profiles.js`): Predefined header profiles for common use cases

## Features

- Add, modify, and remove request headers
- Add, modify, and remove response headers
- Conditional headers based on URL patterns
- Predefined profiles (anonymous, mobile, bot, CORS bypass, etc.)
- Custom profile creation and management
- Configuration export/import
- Header modification statistics

---

## API Reference

### HeaderManager

#### Constructor

```javascript
const { HeaderManager } = require('./headers/manager');

const headerManager = new HeaderManager({
  storagePath: '/path/to/profiles'  // Optional: persist profiles to disk
});
```

#### Initialization

##### initialize()

Initialize the header manager and set up request/response handlers.

```javascript
const result = headerManager.initialize();

// Result:
// { success: true }
```

##### enable() / disable()

Enable or disable header modification.

```javascript
headerManager.disable();  // Stop modifying headers
headerManager.enable();   // Resume modifying headers
```

#### Request Headers

##### setRequestHeader(name, value)

Add or modify a request header.

```javascript
const result = headerManager.setRequestHeader('X-Custom-Header', 'custom-value');

// Result:
// {
//   success: true,
//   header: 'X-Custom-Header',
//   value: 'custom-value',
//   totalRequestHeaders: 5
// }
```

##### removeRequestHeader(name)

Remove a request header from all requests.

```javascript
const result = headerManager.removeRequestHeader('Cookie');

// Result:
// {
//   success: true,
//   header: 'Cookie',
//   totalRemoveHeaders: 3
// }
```

##### getRequestHeaders()

Get all custom request header settings.

```javascript
const result = headerManager.getRequestHeaders();

// Result:
// {
//   success: true,
//   headers: {
//     'X-Custom-Header': 'custom-value',
//     'Accept-Language': 'en-US'
//   },
//   removeHeaders: ['Cookie', 'Referer'],
//   conditionalHeaders: [
//     { pattern: '*://api.example.com/*', name: 'Authorization', value: 'Bearer token', remove: false }
//   ]
// }
```

##### clearRequestHeaders()

Clear all custom request header settings.

```javascript
const result = headerManager.clearRequestHeaders();

// Result:
// {
//   success: true,
//   cleared: 10
// }
```

#### Response Headers

##### setResponseHeader(name, value)

Add or modify a response header.

```javascript
const result = headerManager.setResponseHeader('Access-Control-Allow-Origin', '*');

// Result:
// {
//   success: true,
//   header: 'Access-Control-Allow-Origin',
//   value: '*',
//   totalResponseHeaders: 3
// }
```

##### removeResponseHeader(name)

Remove a response header from all responses.

```javascript
const result = headerManager.removeResponseHeader('X-Frame-Options');

// Result:
// {
//   success: true,
//   header: 'X-Frame-Options',
//   totalRemoveHeaders: 2
// }
```

##### getResponseHeaders()

Get all custom response header settings.

```javascript
const result = headerManager.getResponseHeaders();

// Result:
// {
//   success: true,
//   headers: {
//     'Access-Control-Allow-Origin': '*'
//   },
//   removeHeaders: ['X-Frame-Options', 'Content-Security-Policy'],
//   conditionalHeaders: [...]
// }
```

##### clearResponseHeaders()

Clear all custom response header settings.

```javascript
const result = headerManager.clearResponseHeaders();
```

#### Conditional Headers

##### setConditionalHeader(pattern, name, value)

Set a request header for specific URL patterns.

```javascript
// Add header for API requests
const result = headerManager.setConditionalHeader(
  '*://api.example.com/*',
  'Authorization',
  'Bearer my-token'
);

// Remove header for specific URLs (pass null as value)
headerManager.setConditionalHeader(
  '*://public.example.com/*',
  'Cookie',
  null  // null = remove header
);

// Result:
// {
//   success: true,
//   rule: {
//     id: 'cond_1703123456789_abc123',
//     pattern: '*://api.example.com/*',
//     name: 'Authorization',
//     value: 'Bearer my-token',
//     remove: false,
//     type: 'request',
//     createdAt: '2024-12-21T10:30:00.000Z'
//   },
//   totalConditionalHeaders: 5
// }
```

##### setConditionalResponseHeader(pattern, name, value)

Set a response header for specific URL patterns.

```javascript
// Add CORS headers for API responses
headerManager.setConditionalResponseHeader(
  '*://api.example.com/*',
  'Access-Control-Allow-Origin',
  '*'
);
```

##### getConditionalHeaders()

Get all conditional header rules.

```javascript
const result = headerManager.getConditionalHeaders();

// Result:
// {
//   success: true,
//   requestHeaders: [
//     { id: '...', pattern: '*://api.*/*', name: 'Authorization', value: '...', remove: false }
//   ],
//   responseHeaders: [
//     { id: '...', pattern: '*://api.*/*', name: 'Access-Control-Allow-Origin', value: '*', remove: false }
//   ]
// }
```

##### removeConditionalHeader(ruleId)

Remove a conditional header rule by ID.

```javascript
const result = headerManager.removeConditionalHeader('cond_1703123456789_abc123');
```

##### clearConditionalHeaders()

Clear all conditional header rules.

```javascript
const result = headerManager.clearConditionalHeaders();
```

#### Profiles

##### createHeaderProfile(name, headers)

Create a new header profile.

```javascript
const result = headerManager.createHeaderProfile('my-profile', {
  requestHeaders: {
    'Accept-Language': 'fr-FR',
    'X-Custom': 'value'
  },
  responseHeaders: {
    'Access-Control-Allow-Origin': '*'
  },
  removeRequestHeaders: ['Cookie'],
  removeResponseHeaders: ['X-Frame-Options'],
  conditionalRequestHeaders: [],
  conditionalResponseHeaders: []
});

// Result:
// {
//   success: true,
//   profile: { ... },
//   totalProfiles: 3
// }
```

##### loadHeaderProfile(name)

Load and apply a header profile.

```javascript
const result = headerManager.loadHeaderProfile('anonymous');

// Result:
// {
//   success: true,
//   profile: { ... },
//   activeProfile: 'anonymous'
// }
```

##### listHeaderProfiles()

List all available profiles.

```javascript
const result = headerManager.listHeaderProfiles();

// Result:
// {
//   success: true,
//   profiles: [
//     {
//       name: 'anonymous',
//       requestHeaderCount: 7,
//       responseHeaderCount: 0,
//       removeRequestHeaderCount: 8,
//       removeResponseHeaderCount: 7,
//       conditionalHeaderCount: 0,
//       createdAt: '...',
//       updatedAt: '...'
//     },
//     ...
//   ],
//   activeProfile: 'anonymous',
//   totalProfiles: 5
// }
```

##### getHeaderProfile(name)

Get a specific profile by name.

```javascript
const result = headerManager.getHeaderProfile('mobile');
```

##### deleteHeaderProfile(name)

Delete a custom profile.

```javascript
const result = headerManager.deleteHeaderProfile('my-profile');
```

##### saveCurrentAsProfile(name)

Save current header settings as a profile.

```javascript
const result = headerManager.saveCurrentAsProfile('current-config');
```

#### Status and Statistics

##### getStatus()

Get current header manager status.

```javascript
const result = headerManager.getStatus();

// Result:
// {
//   enabled: true,
//   activeProfile: 'anonymous',
//   stats: {
//     requestsModified: 1500,
//     responsesModified: 1200,
//     headersAdded: 8500,
//     headersRemoved: 3200
//   },
//   requestHeaders: { ... },
//   responseHeaders: { ... },
//   removeRequestHeaders: [...],
//   removeResponseHeaders: [...],
//   conditionalRequestHeaders: 5,
//   conditionalResponseHeaders: 3,
//   profileCount: 10
// }
```

##### resetStats()

Reset modification statistics.

```javascript
const result = headerManager.resetStats();

// Result:
// {
//   success: true,
//   previousStats: { ... }
// }
```

#### Configuration Management

##### exportConfiguration()

Export all header configuration.

```javascript
const result = headerManager.exportConfiguration();

// Result:
// {
//   success: true,
//   configuration: {
//     requestHeaders: { ... },
//     responseHeaders: { ... },
//     removeRequestHeaders: [...],
//     removeResponseHeaders: [...],
//     conditionalRequestHeaders: [...],
//     conditionalResponseHeaders: [...],
//     profiles: { ... },
//     activeProfile: 'anonymous',
//     exportedAt: '2024-12-21T10:30:00.000Z'
//   }
// }
```

##### importConfiguration(config, merge)

Import header configuration.

```javascript
// Replace all configuration
const result = headerManager.importConfiguration(config, false);

// Merge with existing configuration
const result = headerManager.importConfiguration(config, true);
```

##### clearAllHeaders()

Clear all header modifications.

```javascript
const result = headerManager.clearAllHeaders();
```

##### cleanup()

Clean up and save before shutdown.

```javascript
headerManager.cleanup();
```

---

### Predefined Profiles

#### Available Profiles

| Profile | Description |
|---------|-------------|
| `anonymous` | Removes tracking headers, adds privacy headers |
| `mobile` | Simulates mobile device headers |
| `bot` | Simulates search engine crawler |
| `api-client` | Optimized for API requests |
| `desktop-chrome` | Standard Chrome browser headers |
| `desktop-firefox` | Standard Firefox browser headers |
| `minimal` | Only essential headers |
| `cors-bypass` | Headers to bypass CORS restrictions |
| `osint` | Optimized for OSINT research |

#### Using Predefined Profiles

```javascript
const { PREDEFINED_PROFILES, getPredefinedProfile } = require('./headers/profiles');

// Get profile configuration
const anonymousProfile = getPredefinedProfile('anonymous');

// List all predefined profiles
const profileNames = Object.keys(PREDEFINED_PROFILES);
```

#### Profile Details

##### anonymous

```javascript
{
  requestHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': '...',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Sec-GPC': '1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  removeRequestHeaders: [
    'X-Requested-With', 'X-Forwarded-For', 'X-Real-IP',
    'X-Client-IP', 'CF-Connecting-IP', 'Referer', 'Cookie', ...
  ],
  removeResponseHeaders: [
    'X-Request-Id', 'Set-Cookie', 'X-Cache', ...
  ]
}
```

##### mobile

```javascript
{
  requestHeaders: {
    'Sec-CH-UA-Mobile': '?1',
    'Sec-CH-UA-Platform': '"Android"',
    ...
  }
}
```

##### cors-bypass

```javascript
{
  responseHeaders: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  },
  removeResponseHeaders: [
    'X-Frame-Options',
    'Content-Security-Policy'
  ]
}
```

---

## WebSocket Command Examples

### Initialize

```json
{
  "command": "headers.initialize"
}
```

### Enable/Disable

```json
{
  "command": "headers.enable"
}
```

```json
{
  "command": "headers.disable"
}
```

### Set Request Header

```json
{
  "command": "headers.setRequestHeader",
  "params": {
    "name": "X-Custom-Header",
    "value": "custom-value"
  }
}
```

### Remove Request Header

```json
{
  "command": "headers.removeRequestHeader",
  "params": {
    "name": "Cookie"
  }
}
```

### Get Request Headers

```json
{
  "command": "headers.getRequestHeaders"
}
```

### Clear Request Headers

```json
{
  "command": "headers.clearRequestHeaders"
}
```

### Set Response Header

```json
{
  "command": "headers.setResponseHeader",
  "params": {
    "name": "Access-Control-Allow-Origin",
    "value": "*"
  }
}
```

### Remove Response Header

```json
{
  "command": "headers.removeResponseHeader",
  "params": {
    "name": "X-Frame-Options"
  }
}
```

### Get Response Headers

```json
{
  "command": "headers.getResponseHeaders"
}
```

### Set Conditional Header

```json
{
  "command": "headers.setConditionalHeader",
  "params": {
    "pattern": "*://api.example.com/*",
    "name": "Authorization",
    "value": "Bearer token123"
  }
}
```

### Set Conditional Response Header

```json
{
  "command": "headers.setConditionalResponseHeader",
  "params": {
    "pattern": "*://api.*/*",
    "name": "Access-Control-Allow-Origin",
    "value": "*"
  }
}
```

### Get Conditional Headers

```json
{
  "command": "headers.getConditionalHeaders"
}
```

### Remove Conditional Header

```json
{
  "command": "headers.removeConditionalHeader",
  "params": {
    "ruleId": "cond_1703123456789_abc123"
  }
}
```

### Create Profile

```json
{
  "command": "headers.createProfile",
  "params": {
    "name": "my-profile",
    "headers": {
      "requestHeaders": {
        "Accept-Language": "fr-FR"
      },
      "removeRequestHeaders": ["Cookie"]
    }
  }
}
```

### Load Profile

```json
{
  "command": "headers.loadProfile",
  "params": {
    "name": "anonymous"
  }
}
```

### List Profiles

```json
{
  "command": "headers.listProfiles"
}
```

### Get Profile

```json
{
  "command": "headers.getProfile",
  "params": {
    "name": "mobile"
  }
}
```

### Delete Profile

```json
{
  "command": "headers.deleteProfile",
  "params": {
    "name": "my-profile"
  }
}
```

### Save Current as Profile

```json
{
  "command": "headers.saveCurrentAsProfile",
  "params": {
    "name": "backup-config"
  }
}
```

### Get Status

```json
{
  "command": "headers.getStatus"
}
```

### Reset Statistics

```json
{
  "command": "headers.resetStats"
}
```

### Export Configuration

```json
{
  "command": "headers.exportConfig"
}
```

### Import Configuration

```json
{
  "command": "headers.importConfig",
  "params": {
    "config": { ... },
    "merge": false
  }
}
```

### Clear All

```json
{
  "command": "headers.clearAll"
}
```

### Get Known Profiles

```json
{
  "command": "headers.getKnownProfiles"
}
```

---

## Code Examples

### Basic Header Modification

```javascript
const { HeaderManager } = require('./headers/manager');

const headerManager = new HeaderManager();
headerManager.initialize();

// Add custom request headers
headerManager.setRequestHeader('Accept-Language', 'en-US,en;q=0.9');
headerManager.setRequestHeader('DNT', '1');

// Remove tracking headers
headerManager.removeRequestHeader('Cookie');
headerManager.removeRequestHeader('Referer');

// Add CORS headers to responses
headerManager.setResponseHeader('Access-Control-Allow-Origin', '*');
headerManager.removeResponseHeader('X-Frame-Options');
```

### Using Profiles

```javascript
// Load predefined profile
headerManager.loadHeaderProfile('anonymous');

// Check active profile
const status = headerManager.getStatus();
console.log(`Active profile: ${status.activeProfile}`);

// Switch to mobile profile
headerManager.loadHeaderProfile('mobile');

// Create custom profile based on current settings
headerManager.saveCurrentAsProfile('my-custom-profile');

// Load custom profile later
headerManager.loadHeaderProfile('my-custom-profile');
```

### Conditional Headers for APIs

```javascript
// Add auth header for API requests
headerManager.setConditionalHeader(
  '*://api.myservice.com/*',
  'Authorization',
  'Bearer ' + getToken()
);

// Add API key for another service
headerManager.setConditionalHeader(
  '*://api.thirdparty.com/*',
  'X-API-Key',
  'my-api-key'
);

// Remove cookies for public endpoints
headerManager.setConditionalHeader(
  '*://public.myservice.com/*',
  'Cookie',
  null
);

// Add CORS to specific API responses
headerManager.setConditionalResponseHeader(
  '*://api.myservice.com/*',
  'Access-Control-Allow-Origin',
  '*'
);
```

### Configuration Backup

```javascript
// Export current configuration
const exported = headerManager.exportConfiguration();
fs.writeFileSync('headers-config.json', JSON.stringify(exported.configuration, null, 2));

// Import configuration
const config = JSON.parse(fs.readFileSync('headers-config.json', 'utf-8'));
headerManager.importConfiguration(config, false);  // Replace all

// Or merge with existing
headerManager.importConfiguration(additionalConfig, true);
```

### Statistics Monitoring

```javascript
// Monitor header modifications
setInterval(() => {
  const status = headerManager.getStatus();
  console.log('Header Stats:');
  console.log(`  Requests modified: ${status.stats.requestsModified}`);
  console.log(`  Responses modified: ${status.stats.responsesModified}`);
  console.log(`  Headers added: ${status.stats.headersAdded}`);
  console.log(`  Headers removed: ${status.stats.headersRemoved}`);
}, 60000);

// Reset stats periodically
headerManager.resetStats();
```

---

## Configuration Options

### URL Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `*` | All URLs |
| `<all_urls>` | All URLs |
| `*://example.com/*` | All requests to example.com |
| `*://api.*.com/*` | API subdomains (api.example.com, api.test.com) |
| `*://*/api/*` | Any URL with /api/ path |
| `https://example.com/specific` | Exact URL match |

### Profile Structure

```javascript
{
  name: 'profile-name',
  description: 'Profile description',
  requestHeaders: {
    'Header-Name': 'value'
  },
  responseHeaders: {
    'Header-Name': 'value'
  },
  removeRequestHeaders: ['Header-1', 'Header-2'],
  removeResponseHeaders: ['Header-1'],
  conditionalRequestHeaders: [
    { pattern: '*://api.*/*', name: 'Auth', value: 'token', remove: false }
  ],
  conditionalResponseHeaders: [],
  createdAt: 'ISO date',
  updatedAt: 'ISO date'
}
```

### Common Tracking Headers

These headers are commonly removed for privacy:

| Header | Purpose |
|--------|---------|
| `X-Forwarded-For` | Client IP forwarding |
| `X-Real-IP` | Real client IP |
| `X-Client-IP` | Client IP |
| `CF-Connecting-IP` | Cloudflare client IP |
| `True-Client-IP` | True client IP |
| `X-Correlation-ID` | Request correlation |
| `X-Request-ID` | Request tracking |
| `X-Trace-ID` | Request tracing |
| `Via` | Proxy information |
| `Forwarded` | Forwarding info |

### Response Headers for Security Bypass

| Header | Effect of Removal |
|--------|------------------|
| `X-Frame-Options` | Allow iframe embedding |
| `Content-Security-Policy` | Remove CSP restrictions |
| `X-Content-Type-Options` | Allow MIME sniffing |
| `Set-Cookie` | Prevent cookie setting |

---

## Statistics Tracking

The HeaderManager tracks the following statistics:

| Statistic | Description |
|-----------|-------------|
| `requestsModified` | Number of requests with modified headers |
| `responsesModified` | Number of responses with modified headers |
| `headersAdded` | Total headers added across all requests/responses |
| `headersRemoved` | Total headers removed across all requests/responses |

Statistics are reset when `resetStats()` is called or when the manager is disabled/re-enabled.

---

## Storage

When `storagePath` is provided, profiles are automatically saved to `header-profiles.json` in that directory. Profiles persist across application restarts.

```javascript
const headerManager = new HeaderManager({
  storagePath: '/path/to/data'
});
// Creates /path/to/data/header-profiles.json
```
