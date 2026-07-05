# Self-Documenting API - Quick Reference

## Endpoints at a Glance

### Help & Documentation
```bash
GET /api/help                           # List all commands
GET /api/help?command=navigate          # Get command help
GET /api/help?command=click
GET /api/help?command=screenshot
GET /api/help?error=TIMEOUT             # Get error recovery
GET /api/help?error=INVALID_URL
GET /api/help?error=ELEMENT_NOT_FOUND
GET /api/help?search=proxy              # Search commands
GET /api/help?search=form
GET /api/help?search=screenshot
```

### Diagnostics & Status
```bash
GET /api/diagnostics                    # Browser health & capabilities
GET /api/status                         # Current status
GET /api/schema                         # OpenAPI schema
```

### Health (Existing)
```bash
GET /health                             # Full status
GET /health/live                        # Liveness probe
GET /health/ready                       # Readiness probe
GET /health/metrics                     # Metrics
```

## Quick Examples

### Discover Commands
```bash
# List all
curl http://localhost:8765/api/help

# Get categories
curl http://localhost:8765/api/help | jq '.commands | keys[]'

# Count by category
curl http://localhost:8765/api/help | jq '.commands | map(length)'
```

### Get Command Help
```bash
curl http://localhost:8765/api/help?command=navigate

# Just parameters
curl http://localhost:8765/api/help?command=navigate | jq '.parameters'

# Just examples
curl http://localhost:8765/api/help?command=navigate | jq '.examples'

# Just errors
curl http://localhost:8765/api/help?command=navigate | jq '.errorCodes'
```

### Get Error Help
```bash
curl http://localhost:8765/api/help?error=TIMEOUT

# Just recovery hint
curl http://localhost:8765/api/help?error=TIMEOUT | jq '.recoveryHint'
```

### Search Commands
```bash
curl http://localhost:8765/api/help?search=proxy
curl http://localhost:8765/api/help?search=form
curl http://localhost:8765/api/help?search=cookie
```

### Check Browser Health
```bash
curl http://localhost:8765/api/diagnostics

# Just memory
curl http://localhost:8765/api/diagnostics | jq '.memory'

# Just features
curl http://localhost:8765/api/diagnostics | jq '.features'

# API info
curl http://localhost:8765/api/diagnostics | jq '.api'
```

### Get Current Status
```bash
curl http://localhost:8765/api/status

# Just endpoints
curl http://localhost:8765/api/status | jq '.endpoints'
```

### Get OpenAPI Schema
```bash
curl http://localhost:8765/api/schema > openapi.json
```

## Response Structure

### Command Help Response
```json
{
  "command": "navigate",
  "category": "Navigation",
  "description": "...",
  "required": ["url"],
  "parameters": { "url": {...}, "timeout": {...} },
  "examples": [{...}],
  "errorCodes": ["INVALID_URL", "TIMEOUT", ...],
  "recoveryHints": { "INVALID_URL": "...", "TIMEOUT": "..." }
}
```

### Error Help Response
```json
{
  "errorCode": "TIMEOUT",
  "description": "...",
  "recoveryHint": "...",
  "relatedErrors": ["NAVIGATION_FAILED"]
}
```

### Diagnostics Response
```json
{
  "version": "12.10.0",
  "status": "operational",
  "uptime": { "ms": 3600000, "seconds": 3600, "readable": "1h 0m 0s" },
  "system": { "platform": "linux", "arch": "x64", "cpus": 8 },
  "memory": { "heapUsed": "145.25 MB", "heapTotal": "256 MB", ... },
  "api": { "totalCommands": 140, "totalCategories": 20, "errorCodes": 20 },
  "features": { "navigation": true, "screenshots": true, ... }
}
```

### Help List Response
```json
{
  "totalCommands": 140,
  "totalCategories": 20,
  "commands": {
    "Navigation": [
      { "command": "navigate", "description": "..." },
      { "command": "goBack", "description": "..." }
    ],
    "Screenshots": [...]
  }
}
```

## Integration Patterns

### JavaScript/Node.js
```javascript
const response = await fetch('http://localhost:8765/api/help?command=navigate');
const command = await response.json();
console.log(command.parameters);
```

### Python
```python
import requests
response = requests.get('http://localhost:8765/api/help?command=navigate')
command = response.json()
print(command['examples'])
```

### Shell/Bash
```bash
#!/bin/bash
COMMAND=$1
curl -s "http://localhost:8765/api/help?command=$COMMAND" | jq '.parameters'
```

### Python with Error Recovery
```python
import requests
try:
    response = requests.get('http://localhost:8765/api/help?error=TIMEOUT')
    error_info = response.json()
    print(f"Hint: {error_info['recoveryHint']}")
except Exception as e:
    print(f"Error: {e}")
```

## Error Codes (Quick List)

```
INVALID_URL              - Check URL format
INVALID_PARAMETERS       - Check parameter types
MISSING_PARAMETER        - Check required params
TIMEOUT                  - Increase timeout or check network
ELEMENT_NOT_FOUND        - Check selector is correct
INVALID_SELECTOR         - Fix CSS selector syntax
NAVIGATION_FAILED        - Check URL and network
BROWSER_NOT_READY        - Wait and retry
SCREENSHOT_FAILED        - Ensure page is loaded
SCRIPT_ERROR             - Check JavaScript syntax
PROFILE_NOT_FOUND        - List profiles first
PROFILE_LOAD_FAILED      - Check profile exists
INVALID_PROXY            - Check proxy format
PROXY_CONNECTION_FAILED  - Check proxy server
STORAGE_ERROR            - Check storage quotas
INVALID_CREDENTIALS      - Check username/password
SESSION_EXPIRED          - Start new session
FEATURE_NOT_SUPPORTED    - Check /api/diagnostics
RATE_LIMITED             - Wait and retry
INTERNAL_ERROR           - Check logs
```

## Command Categories

1. **Navigation** - navigate, goBack, goForward, reload
2. **Interaction** - click, fill, type, hover, scroll
3. **Screenshots** - screenshot, screenshotViewport, screenshotElement
4. **Content** - getText, getHTML, getImages, getLinks
5. **Forms** - analyzeForms, fillForm, submitForm
6. **Storage** - getCookies, setCookie, clearCookies
7. **Proxy** - setProxy, rotateProxy, getProxyStatus
8. **UserAgent** - setUserAgent, rotateUserAgent
9. **Profiles** - createProfile, loadProfile, deleteProfile
10. **JavaScript** - executeScript, runScript
11. **DevTools** - openDevTools, getConsole
12. **Health** - getHealth, status, ping, version
13. **Sessions** - createSession, deleteSession
14. **Storage** - getStorage, setStorage, clearStorage
15. **Intercept** - blockRequest, allowRequest
16. **Fingerprint** - spoof, canvas, webgl, webrtc
17. **Auth** - login, authenticate, credentials
18. **Forensic** - extractForensic, export, analyze
19. **DOM** - inspect, query, xpath, selector
20. **Recording** - startRecord, stopRecord, replay

## Files & Documentation

| File | Purpose |
|------|---------|
| `websocket/command-registry.js` | Command metadata source |
| `websocket/diagnostics-api.js` | HTTP endpoint handlers |
| `websocket/diagnostics-api-example.js` | Usage examples |
| `docs/SELF-DOCUMENTING-API.md` | Full documentation |
| `IMPLEMENTATION-COMPLETE.md` | Implementation guide |
| `SELF-DOCUMENTING-API-IMPLEMENTATION.md` | Technical details |

## Running Examples

```bash
node websocket/diagnostics-api-example.js
```

Shows:
- Command discovery
- Command help lookups
- Error recovery patterns
- Command searching
- Diagnostics querying
- Status checking
- Integration patterns

## Features

✅ 140+ commands documented  
✅ 20 error codes with recovery hints  
✅ 20 command categories  
✅ Dynamic searching  
✅ Parameter validation  
✅ OpenAPI schema generation  
✅ Browser diagnostics  
✅ Health status  
✅ Zero external documentation needed  
✅ Production-ready  

## No External Files Needed!

Everything you need is accessible via these endpoints:
- **Help & Examples** → `/api/help`
- **Health & Capabilities** → `/api/diagnostics`
- **Current Status** → `/api/status`
- **API Schema** → `/api/schema`

Query the browser directly. No external documentation files required.
