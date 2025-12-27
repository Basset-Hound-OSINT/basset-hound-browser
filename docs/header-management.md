# Header Management

The Basset Hound Browser provides comprehensive HTTP header management for both requests and responses. This allows you to modify headers for privacy, testing, and OSINT research purposes.

## Overview

The Header Management system includes:
- Request header modification (add, modify, remove)
- Response header modification (add, modify, remove)
- URL-based conditional header rules
- Header profiles for common use cases
- Import/export of header configurations

## Architecture

### HeaderManager Class

Located at `/headers/manager.js`, this is the core class that handles all header operations using Electron's `webRequest` API.

### Predefined Profiles

Located at `/headers/profiles.js`, this module contains ready-to-use header profiles:

| Profile | Description |
|---------|-------------|
| `anonymous` | Removes tracking headers, adds privacy headers |
| `mobile` | Simulates mobile device headers |
| `bot` | Simulates search engine crawler headers |
| `api-client` | Headers optimized for API requests |
| `desktop-chrome` | Standard desktop Chrome browser headers |
| `desktop-firefox` | Standard desktop Firefox browser headers |
| `minimal` | Only essential headers for reduced fingerprinting |
| `cors-bypass` | Headers to help with CORS restrictions |
| `osint` | Headers optimized for OSINT research |

## WebSocket Commands

All header management is available via WebSocket commands.

### Request Header Commands

#### set_request_header
Add or modify a request header.
```json
{
  "command": "set_request_header",
  "name": "X-Custom-Header",
  "value": "custom-value"
}
```

#### remove_request_header
Remove a header from all requests.
```json
{
  "command": "remove_request_header",
  "name": "User-Agent"
}
```

### Response Header Commands

#### set_response_header
Modify or add a response header.
```json
{
  "command": "set_response_header",
  "name": "Content-Security-Policy",
  "value": ""
}
```

#### remove_response_header
Remove a header from all responses.
```json
{
  "command": "remove_response_header",
  "name": "X-Frame-Options"
}
```

### Header Query Commands

#### get_custom_headers
Get all custom request and response headers.
```json
{
  "command": "get_custom_headers"
}
```

Response:
```json
{
  "success": true,
  "requestHeaders": {
    "headers": { "Accept-Language": "en-US" },
    "removeHeaders": ["Sec-Ch-Ua-Platform"],
    "conditionalHeaders": []
  },
  "responseHeaders": {
    "headers": {},
    "removeHeaders": [],
    "conditionalHeaders": []
  }
}
```

#### clear_headers
Clear all custom headers.
```json
{
  "command": "clear_headers",
  "type": "request"  // or "response" or omit for all
}
```

### Profile Commands

#### create_header_profile
Save current or specified headers as a profile.
```json
{
  "command": "create_header_profile",
  "name": "my-profile",
  "headers": {
    "requestHeaders": {
      "Accept": "application/json"
    },
    "removeRequestHeaders": ["Cookie"],
    "responseHeaders": {},
    "removeResponseHeaders": []
  }
}
```

#### load_header_profile
Load a saved or predefined profile.
```json
{
  "command": "load_header_profile",
  "name": "anonymous"
}
```

#### list_header_profiles
List all available profiles.
```json
{
  "command": "list_header_profiles"
}
```

#### delete_header_profile
Delete a custom profile.
```json
{
  "command": "delete_header_profile",
  "name": "my-profile"
}
```

#### get_predefined_header_profiles
Get list of predefined profiles with descriptions.
```json
{
  "command": "get_predefined_header_profiles"
}
```

### Conditional Header Commands

#### set_conditional_header
Set a header that only applies to URLs matching a pattern.
```json
{
  "command": "set_conditional_header",
  "pattern": "*://api.example.com/*",
  "name": "Authorization",
  "value": "Bearer token123",
  "type": "request"  // or "response"
}
```

Pattern syntax:
- `*` - matches any characters
- `<all_urls>` - matches all URLs
- Exact URL - matches only that URL

To remove a header conditionally, set `value` to `null`.

#### get_conditional_headers
Get all conditional header rules.
```json
{
  "command": "get_conditional_headers"
}
```

#### remove_conditional_header
Remove a conditional header rule by ID.
```json
{
  "command": "remove_conditional_header",
  "ruleId": "cond_123456789_abc123"
}
```

#### clear_conditional_headers
Remove all conditional header rules.
```json
{
  "command": "clear_conditional_headers"
}
```

### Status and Configuration Commands

#### get_header_status
Get current header manager status and statistics.
```json
{
  "command": "get_header_status"
}
```

#### enable_header_manager
Enable header modification (enabled by default).
```json
{
  "command": "enable_header_manager"
}
```

#### disable_header_manager
Temporarily disable all header modifications.
```json
{
  "command": "disable_header_manager"
}
```

#### reset_header_stats
Reset header modification statistics.
```json
{
  "command": "reset_header_stats"
}
```

#### export_header_config
Export complete header configuration.
```json
{
  "command": "export_header_config"
}
```

#### import_header_config
Import header configuration.
```json
{
  "command": "import_header_config",
  "config": { /* exported config */ },
  "merge": false  // true to merge with existing
}
```

## JavaScript API (via preload.js)

The header management API is exposed to the renderer process:

```javascript
// Request Headers
await electronAPI.setRequestHeader('X-Custom', 'value');
await electronAPI.removeRequestHeader('Cookie');
await electronAPI.getRequestHeaders();
await electronAPI.clearRequestHeaders();

// Response Headers
await electronAPI.setResponseHeader('X-Custom', 'value');
await electronAPI.removeResponseHeader('X-Frame-Options');
await electronAPI.getResponseHeaders();
await electronAPI.clearResponseHeaders();

// All Headers
await electronAPI.getCustomHeaders();
await electronAPI.clearAllHeaders();

// Profiles
await electronAPI.createHeaderProfile('my-profile', headers);
await electronAPI.loadHeaderProfile('anonymous');
await electronAPI.listHeaderProfiles();
await electronAPI.deleteHeaderProfile('my-profile');
await electronAPI.getPredefinedHeaderProfiles();

// Conditional Headers
await electronAPI.setConditionalHeader('*://api.*/*', 'Auth', 'token', 'request');
await electronAPI.getConditionalHeaders();
await electronAPI.removeConditionalHeader('ruleId');
await electronAPI.clearConditionalHeaders();

// Status
await electronAPI.getHeaderStatus();
await electronAPI.enableHeaderManager();
await electronAPI.disableHeaderManager();
await electronAPI.resetHeaderStats();

// Import/Export
await electronAPI.exportHeaderConfig();
await electronAPI.importHeaderConfig(config, merge);
```

## Use Cases

### Privacy/Anonymous Browsing
```json
{
  "command": "load_header_profile",
  "name": "anonymous"
}
```

### Mobile Device Emulation
```json
{
  "command": "load_header_profile",
  "name": "mobile"
}
```

### API Testing
```json
{
  "command": "set_request_header",
  "name": "Authorization",
  "value": "Bearer eyJhbGciOiJIUzI1NiIs..."
}
```

### CORS Bypass for Development
```json
{
  "command": "load_header_profile",
  "name": "cors-bypass"
}
```

### Search Engine Bot Simulation
```json
{
  "command": "load_header_profile",
  "name": "bot"
}
```

### Conditional API Authentication
```json
{
  "command": "set_conditional_header",
  "pattern": "*://api.example.com/*",
  "name": "X-API-Key",
  "value": "your-api-key",
  "type": "request"
}
```

## Profile Details

### anonymous
Removes tracking headers and adds privacy-focused headers:
- Removes: X-Forwarded-For, X-Real-IP, Referer, Cookie, tracking headers
- Adds: DNT, Sec-GPC, Cache-Control

### mobile
Simulates a mobile Chrome browser:
- Sets Sec-CH-UA-Mobile to "?1"
- Sets Sec-CH-UA-Platform to "Android"
- Uses mobile-appropriate Accept headers

### bot
Simulates Googlebot or similar crawlers:
- Removes browser-specific headers
- Adds From header with googlebot email
- Uses simple Accept headers

### api-client
Optimized for API requests:
- Sets Accept to application/json
- Sets Content-Type to application/json
- Removes browser-specific security headers

### cors-bypass
Helps bypass CORS restrictions:
- Adds Access-Control-Allow-* response headers
- Removes X-Frame-Options and CSP headers

### osint
Optimized for OSINT research:
- Removes tracking headers
- Adds DNT header
- Uses standard browser Accept headers

## Security Considerations

1. **Cookie Removal**: Removing cookies may break authentication on websites
2. **CSP Bypass**: Bypassing Content-Security-Policy is for testing only
3. **Fingerprinting**: Even with header modifications, other fingerprinting methods may identify your browser
4. **Legal**: Ensure your header modifications comply with applicable laws and terms of service

## Troubleshooting

### Headers not being modified
1. Check that the header manager is enabled: `get_header_status`
2. Verify no conflicting conditional rules exist
3. Check browser console for errors

### Profile not loading
1. Verify the profile name is correct (case-sensitive)
2. Check if it's a predefined or custom profile
3. Use `list_header_profiles` to see available profiles

### Conditional headers not applying
1. Verify the URL pattern matches your target URLs
2. Test with a simple pattern like `<all_urls>` first
3. Check the rule ID was returned when creating the rule
