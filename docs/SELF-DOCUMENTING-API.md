# Self-Documenting API (v12.10.0)

## Overview

The Basset Hound Browser includes a built-in self-documenting API that allows users to query the browser for help and documentation without relying on external files. This is powered by the **Command Registry** and **Diagnostics API**.

## Why Self-Documenting?

- **No external files needed**: Users can query help directly from the browser
- **Always up-to-date**: Documentation is generated dynamically from the command registry
- **Better discoverability**: Users can search, filter, and explore commands interactively
- **Error recovery**: Built-in recovery hints for every error code
- **Real-time capabilities**: Query what the browser actually supports

## Architecture

### Two Core Components

1. **Command Registry** (`websocket/command-registry.js`)
   - Single source of truth for all 140+ commands
   - Metadata: name, description, parameters, examples, error codes, recovery hints
   - Dynamic queries: search, categorize, validate

2. **Diagnostics API** (`websocket/diagnostics-api.js`)
   - HTTP endpoints: `/api/help`, `/api/diagnostics`, `/api/status`, `/api/schema`
   - Queries command registry for information
   - Returns formatted JSON responses

## HTTP Endpoints

### GET /api/help
List all available commands grouped by category

**Example:**
```bash
curl http://localhost:8765/api/help
```

**Response:**
```json
{
  "totalCommands": 140,
  "totalCategories": 20,
  "commands": {
    "Navigation": [
      { "command": "navigate", "description": "Navigate to a URL" },
      { "command": "goBack", "description": "Go back in browser history" }
    ],
    "Screenshots": [
      { "command": "screenshot", "description": "Capture a screenshot of the entire page" }
    ]
  },
  "helpEndpoints": {
    "listCommands": "GET /api/help",
    "getCommand": "GET /api/help?command=<name>",
    "getError": "GET /api/help?error=<code>",
    "searchCommands": "GET /api/help?search=<keyword>",
    "diagnostics": "GET /api/diagnostics",
    "status": "GET /api/status",
    "schema": "GET /api/schema"
  }
}
```

### GET /api/help?command=<name>
Get detailed information for a specific command

**Example:**
```bash
curl http://localhost:8765/api/help?command=navigate
```

**Response:**
```json
{
  "command": "navigate",
  "category": "Navigation",
  "description": "Navigate to a URL",
  "required": ["url"],
  "parameters": {
    "url": {
      "type": "string",
      "description": "The URL to navigate to",
      "pattern": "^https?://",
      "minLength": 10,
      "maxLength": 2048,
      "example": "https://example.com"
    },
    "timeout": {
      "type": "number",
      "description": "Navigation timeout in milliseconds",
      "default": 10000,
      "minimum": 1000,
      "maximum": 600000,
      "example": 30000
    },
    "waitUntil": {
      "type": "string",
      "description": "Wait condition (load, domcontentloaded, networkidle)",
      "enum": ["load", "domcontentloaded", "networkidle0", "networkidle2"],
      "default": "load",
      "example": "networkidle2"
    }
  },
  "examples": [
    {
      "description": "Navigate to Google",
      "request": { "url": "https://google.com" }
    },
    {
      "description": "Navigate with custom timeout",
      "request": { "url": "https://example.com", "timeout": 60000 }
    }
  ],
  "errorCodes": ["INVALID_URL", "TIMEOUT", "NAVIGATION_FAILED", "INTERNAL_ERROR", "BROWSER_NOT_READY"],
  "recoveryHints": {
    "INVALID_URL": "Check URL format (must start with http:// or https://)",
    "TIMEOUT": "Increase timeout parameter or check network connectivity",
    "NAVIGATION_FAILED": "Check URL validity and network connectivity",
    "INTERNAL_ERROR": "Check server logs and contact support if problem persists",
    "BROWSER_NOT_READY": "Wait a moment and retry, or check browser health with /api/diagnostics"
  }
}
```

### GET /api/help?error=<code>
Get error details and recovery hints

**Example:**
```bash
curl http://localhost:8765/api/help?error=INVALID_URL
```

**Response:**
```json
{
  "errorCode": "INVALID_URL",
  "description": "The provided URL is invalid",
  "recoveryHint": "Check URL format (must start with http:// or https://)",
  "relatedErrors": ["NAVIGATION_FAILED"]
}
```

### GET /api/help?search=<keyword>
Search for commands by keyword

**Example:**
```bash
curl http://localhost:8765/api/help?search=screenshot
```

**Response:**
```json
{
  "keyword": "screenshot",
  "resultCount": 4,
  "results": [
    {
      "command": "screenshot",
      "description": "Capture a screenshot of the entire page",
      "category": "Screenshots"
    },
    {
      "command": "screenshotViewport",
      "description": "Capture a screenshot of the visible viewport",
      "category": "Screenshots"
    },
    {
      "command": "screenshotElement",
      "description": "Capture a screenshot of a specific element",
      "category": "Screenshots"
    }
  ]
}
```

### GET /api/diagnostics
Get browser health, version, and capabilities

**Example:**
```bash
curl http://localhost:8765/api/diagnostics
```

**Response:**
```json
{
  "version": "12.10.0",
  "status": "operational",
  "uptime": {
    "ms": 3600000,
    "seconds": 3600,
    "readable": "1h 0m 0s"
  },
  "system": {
    "platform": "linux",
    "arch": "x64",
    "cpus": 8,
    "nodeVersion": "v18.16.0"
  },
  "memory": {
    "heapUsed": "145.25 MB",
    "heapTotal": "256 MB",
    "heapUsedPercent": "56.74%",
    "external": "12.5 MB",
    "rss": "512 MB"
  },
  "api": {
    "totalCommands": 140,
    "totalCategories": 20,
    "errorCodes": 15
  },
  "features": {
    "navigation": true,
    "screenshots": true,
    "contentExtraction": true,
    "formInteraction": true,
    "proxySupport": true,
    "fingerprinting": true,
    "forensicCapture": true,
    "sessionRecording": true,
    "selfDocumentation": true
  },
  "health": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "checks": {
      "websocket": { "ok": true, "message": "5 connected clients" }
    }
  }
}
```

### GET /api/status
Get current browser status

**Example:**
```bash
curl http://localhost:8765/api/status
```

**Response:**
```json
{
  "status": "operational",
  "version": "12.10.0",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600000,
  "endpoints": {
    "websocket": "ws://localhost:8765",
    "help": "http://localhost:8765/api/help",
    "diagnostics": "http://localhost:8765/api/diagnostics",
    "status": "http://localhost:8765/api/status",
    "schema": "http://localhost:8765/api/schema"
  }
}
```

### GET /api/schema
Get OpenAPI-compatible schema

Returns a complete OpenAPI 3.0.0 specification describing all commands, parameters, and responses.

**Example:**
```bash
curl http://localhost:8765/api/schema | jq '.info'
```

## Usage Examples

### Scenario 1: Discover Commands
```bash
# Get all commands
curl http://localhost:8765/api/help | jq '.commands'

# Count commands per category
curl http://localhost:8765/api/help | jq '.commands | map(length)'
```

### Scenario 2: Get Help for a Command
```bash
# Get help for navigate
curl http://localhost:8765/api/help?command=navigate | jq '.parameters'

# Get examples
curl http://localhost:8765/api/help?command=navigate | jq '.examples'
```

### Scenario 3: Understand an Error
```bash
# Get error details
curl http://localhost:8765/api/help?error=ELEMENT_NOT_FOUND

# Get recovery hint
curl http://localhost:8765/api/help?error=ELEMENT_NOT_FOUND | jq '.recoveryHint'
```

### Scenario 4: Search for Functionality
```bash
# Find all proxy-related commands
curl http://localhost:8765/api/help?search=proxy

# Find all forms commands
curl http://localhost:8765/api/help?search=form
```

### Scenario 5: Check Browser Health
```bash
# Get diagnostics
curl http://localhost:8765/api/diagnostics

# Check memory usage
curl http://localhost:8765/api/diagnostics | jq '.memory'

# Check available features
curl http://localhost:8765/api/diagnostics | jq '.features'
```

## Integration Examples

### JavaScript/Node.js
```javascript
// Get command help
const response = await fetch('http://localhost:8765/api/help?command=navigate');
const command = await response.json();

console.log(`Command: ${command.command}`);
console.log(`Required params: ${command.required.join(', ')}`);
console.log(`Parameters:`, command.parameters);
```

### Python
```python
import requests
import json

# Get all commands
response = requests.get('http://localhost:8765/api/help')
data = response.json()

for category, commands in data['commands'].items():
    print(f"{category}: {len(commands)} commands")

# Get command help
response = requests.get('http://localhost:8765/api/help?command=click')
command = response.json()
print(json.dumps(command, indent=2))
```

### Shell/Bash
```bash
#!/bin/bash

# List all commands
echo "Available Commands:"
curl -s http://localhost:8765/api/help | jq '.commands | keys[]'

# Get command help
COMMAND=$1
curl -s "http://localhost:8765/api/help?command=$COMMAND" | jq '.'

# Search commands
KEYWORD=$1
curl -s "http://localhost:8765/api/help?search=$KEYWORD" | jq '.results'
```

### cURL
```bash
# Get help for navigate command
curl -X GET http://localhost:8765/api/help?command=navigate

# Get error recovery hints
curl -X GET http://localhost:8765/api/help?error=TIMEOUT

# Get diagnostics
curl -X GET http://localhost:8765/api/diagnostics

# Get OpenAPI schema
curl -X GET http://localhost:8765/api/schema > openapi.json
```

## Running the Example Script

Use the included example script to test all API endpoints:

```bash
node websocket/diagnostics-api-example.js
```

This will:
1. Discover all available commands
2. Get help for specific commands (navigate, click, screenshot)
3. Get error information
4. Search for commands
5. Get browser diagnostics
6. Get current status
7. Show integration patterns

## Command Registry Details

### Supported Error Codes
- `INVALID_URL` - URL format is incorrect
- `INVALID_PARAMETERS` - Parameter types or values are invalid
- `MISSING_PARAMETER` - Required parameter is missing
- `TIMEOUT` - Operation exceeded time limit
- `ELEMENT_NOT_FOUND` - Selector didn't match any element
- `INVALID_SELECTOR` - CSS selector syntax is invalid
- `NAVIGATION_FAILED` - URL navigation failed
- `BROWSER_NOT_READY` - Browser not initialized
- `SCREENSHOT_FAILED` - Screenshot capture failed
- `SCRIPT_ERROR` - JavaScript execution failed
- `PROFILE_NOT_FOUND` - Browser profile not found
- `PROFILE_LOAD_FAILED` - Failed to load profile
- `INVALID_PROXY` - Proxy configuration invalid
- `PROXY_CONNECTION_FAILED` - Cannot connect to proxy
- `STORAGE_ERROR` - Storage access failed
- `INVALID_CREDENTIALS` - Auth credentials invalid
- `SESSION_EXPIRED` - Session no longer valid
- `FEATURE_NOT_SUPPORTED` - Feature unavailable
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Unexpected error

### Command Categories
- Navigation
- Interaction
- Screenshots
- Content Extraction
- Forms
- Cookies & Storage
- Proxy & Network
- User Agent
- Browser Profiles
- JavaScript Execution
- DevTools & Debugging
- Status & Health
- Session Management
- Storage Management
- Request Interception
- Fingerprinting & Evasion
- Credentials & Auth
- Forensic Analysis
- DOM & Inspection
- Session Recording

## Architecture Details

### Command Registry Module
Location: `websocket/command-registry.js`

Key functions:
- `getCommand(name)` - Get full command metadata
- `getError(code)` - Get error details and recovery hints
- `searchCommands(keyword)` - Search by keyword
- `validateCommandParameters(name, params)` - Validate params
- `getCommandsByCategory()` - Get commands grouped by category
- `getAllCommands()` - Get all commands as list

### Diagnostics API Module
Location: `websocket/diagnostics-api.js`

Key methods:
- `handleHelpRequest()` - Route /api/help requests
- `handleDiagnosticsRequest()` - Route /api/diagnostics requests
- `handleStatusRequest()` - Route /api/status requests
- `handleSchemaRequest()` - Route /api/schema requests
- `createHttpHandler()` - Create HTTP handler for server

### Integration with WebSocket Server
- DiagnosticsAPI initialized in server constructor
- Composite HTTP handler routes `/api/*` to diagnostics, `/health/*` to health endpoint
- Attached to both HTTP and HTTPS servers

## Benefits Over External Docs

### Self-Documenting
- Documentation is embedded in the browser
- Always reflects current capabilities
- No need to maintain external docs

### Better Error Handling
- Each error code has recovery hints
- Users can query recovery strategy directly
- `GET /api/help?error=INVALID_URL` returns actionable advice

### Real-Time Discovery
- Users can discover features at runtime
- Search for functionality they need
- No need to read lengthy documentation

### Integration-Friendly
- OpenAPI schema available
- Easy to generate client SDKs
- Documentation accessible from any client

### Debugging
- `GET /api/diagnostics` shows browser health
- Memory usage, uptime, available features
- Can troubleshoot issues programmatically

## Future Enhancements

Potential improvements:
1. GraphQL endpoint for flexible queries
2. WebSocket-based help subscription
3. Interactive help command in browser console
4. Machine-readable parameter constraints
5. Performance profiling data in diagnostics
6. Feature request/tracking in help responses
7. Deprecation warnings for old commands
8. A/B testing for command variants
9. Usage analytics aggregation
10. Smart suggestions based on query patterns

## Troubleshooting

### Cannot connect to endpoints
```bash
# Check if browser is running
curl http://localhost:8765/api/status

# Check WebSocket is listening
netstat -tlnp | grep 8765
```

### Endpoints return 404
```bash
# Make sure you're using correct port
# Default: 8765
# Custom: check startup logs
```

### Need to find a command
```bash
# Search by keyword
curl http://localhost:8765/api/help?search=keyword

# Browse all commands by category
curl http://localhost:8765/api/help | jq '.commands'
```

### Error recovery help
```bash
# Get error details
curl http://localhost:8765/api/help?error=TIMEOUT

# Get recovery hint
curl "http://localhost:8765/api/help?error=TIMEOUT" | jq '.recoveryHint'
```

## References

- Command Registry: `websocket/command-registry.js`
- Diagnostics API: `websocket/diagnostics-api.js`
- Example Script: `websocket/diagnostics-api-example.js`
- Integration Example: `/api/help` endpoint
