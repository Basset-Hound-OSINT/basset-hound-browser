# API Versioning Guide

## Overview

The Basset Hound Browser API now supports versioning with v1 (stable, legacy) and v2 (stable, enhanced) endpoints. This guide explains how to use the versioning features.

## Supported API Versions

| Version | Status | Release Date | Features |
|---------|--------|--------------|----------|
| 1.0 | Stable | 2026-01-01 | Core functionality, backward compatible |
| 2.0 | Stable | 2026-06-21 | Enhanced telemetry, deprecation warnings, recommendations |

## Version Negotiation

The API supports three methods to specify the desired API version, with priority order:

### 1. Accept-Version Header (Highest Priority)
The HTTP `Accept-Version` header is the preferred method:

```bash
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help
curl -H "Accept-Version: 1.0" http://localhost:8765/api/help
```

### 2. URL Prefix (Medium Priority)
Use versioned URL paths:

```bash
# V1 endpoints
curl http://localhost:8765/api/v1/help
curl http://localhost:8765/api/v1/diagnostics
curl http://localhost:8765/api/v1/status
curl http://localhost:8765/api/v1/schema

# V2 endpoints
curl http://localhost:8765/api/v2/help
curl http://localhost:8765/api/v2/diagnostics
curl http://localhost:8765/api/v2/status
curl http://localhost:8765/api/v2/schema
```

### 3. Query Parameter (Lowest Priority)
Use the `apiVersion` query parameter:

```bash
curl http://localhost:8765/api/help?apiVersion=1
curl http://localhost:8765/api/help?apiVersion=2
curl http://localhost:8765/api/diagnostics?apiVersion=2
```

### 4. Legacy Endpoints (Default to V1)
For backward compatibility, unversioned endpoints default to v1:

```bash
# These default to V1
curl http://localhost:8765/api/help
curl http://localhost:8765/api/diagnostics
curl http://localhost:8765/api/status
curl http://localhost:8765/api/schema
```

## Version Information

### Get Available Versions

```bash
curl http://localhost:8765/api/version
```

Response includes:
- Current API version
- List of supported versions
- Version status (stable, beta, deprecated)
- Release dates
- Request metrics per version

### Example Response

```json
{
  "currentVersion": "12.7.0",
  "apiVersions": [
    {
      "version": "1.0",
      "name": "v1",
      "status": "stable",
      "releaseDate": "2026-01-01",
      "metrics": {
        "count": 145,
        "avgResponseTime": 2.34
      }
    },
    {
      "version": "2.0",
      "name": "v2",
      "status": "stable",
      "releaseDate": "2026-06-21",
      "metrics": {
        "count": 89,
        "avgResponseTime": 2.41
      }
    }
  ],
  "defaultVersion": "1.0",
  "versionNegotiation": {
    "description": "Specify API version using one of these methods (priority order)",
    "methods": [
      {
        "method": "HTTP Header",
        "example": "Accept-Version: 2.0",
        "priority": 1
      },
      {
        "method": "URL Prefix",
        "example": "/api/v2/help",
        "priority": 2
      },
      {
        "method": "Query Parameter",
        "example": "/api/help?apiVersion=2",
        "priority": 3
      }
    ]
  }
}
```

## V1 vs V2 Differences

### Help Endpoint

**V1** (`/api/v1/help`):
- Basic command listing
- Command details (name, category, description, parameters)
- Error information
- Search functionality

**V2** (`/api/v2/help`):
- All V1 features plus:
- Version information
- Deprecation warnings for deprecated commands
- Enhanced recovery hints
- Performance metrics

Example V2 response includes:

```json
{
  "apiVersion": "2.0",
  "versionInfo": {
    "version": "2.0",
    "status": "stable",
    "releaseDate": "2026-06-21",
    "improvements": [
      "Extended command metadata",
      "Deprecation warnings for v1 commands",
      "Performance metrics",
      "Enhanced error recovery hints"
    ]
  },
  "deprecations": [
    {
      "command": "getScreenshot",
      "reason": "Replaced with more powerful captureElement command",
      "alternative": "captureElement",
      "deprecatedSince": "2026-05-01",
      "removedIn": "2027-01-01"
    }
  ]
}
```

### Diagnostics Endpoint

**V1** (`/api/v1/diagnostics`):
- Browser version
- Status (operational)
- Uptime
- System information (platform, arch, CPUs, Node version)
- Memory usage
- API statistics
- Features list

**V2** (`/api/v2/diagnostics`):
- All V1 features plus:
- Telemetry data (request metrics)
- Health recommendations
- Resource optimization hints
- Performance analysis

Example V2 enhancements:

```json
{
  "apiVersion": "2.0",
  "versionInfo": {
    "version": "2.0",
    "status": "stable",
    "releaseDate": "2026-06-21",
    "improvements": [
      "Extended telemetry",
      "Performance recommendations",
      "Resource optimization hints"
    ]
  },
  "telemetry": {
    "requestMetrics": {
      "v1": { "count": 145, "avgResponseTime": 2.34 },
      "v2": { "count": 89, "avgResponseTime": 2.41 }
    }
  },
  "recommendations": [
    {
      "severity": "success",
      "recommendation": "System is operating optimally",
      "metric": "Memory usage: 45.67%"
    }
  ]
}
```

### Status Endpoint

**V1** (`/api/v1/status`):
- Status (operational)
- Browser version
- Timestamp
- Uptime
- Endpoints listing

**V2** (`/api/v2/status`):
- All V1 features plus:
- Version information
- Recommendations for next steps

### Schema Endpoint

**V1** (`/api/v1/schema`):
- OpenAPI 3.0.0 schema
- Endpoint paths
- Request/response definitions
- API version in extension fields

**V2** (`/api/v2/schema`):
- All V1 features plus:
- Extended version information
- Deprecated commands list
- Versioning metadata

## Response Headers

All API responses include version information in HTTP headers:

```
X-API-Version: 2.0        # The API version used for this response
X-Response-Time-Ms: 2.34  # Response time in milliseconds
```

## Migration Guide: V1 to V2

### Why Migrate?

1. **Better diagnostics**: V2 includes telemetry and recommendations
2. **Deprecation warnings**: Know which commands will be removed
3. **Performance insights**: Track API performance per version
4. **Enhanced error recovery**: Better hints for resolving errors

### Migration Steps

1. **Update your client** to use versioned endpoints:
   ```javascript
   // Before (implicit v1)
   fetch('http://localhost:8765/api/help')

   // After (explicit v2)
   fetch('http://localhost:8765/api/v2/help',
     { headers: { 'Accept-Version': '2.0' } })
   ```

2. **Handle new V2 fields** in responses:
   - Check for `versionInfo` in responses
   - Parse `deprecations` array
   - Use `recommendations` for optimization hints

3. **Test backward compatibility**:
   - Keep V1 endpoints available during transition
   - Test both versions in parallel
   - Gradually phase out V1 usage

### Staying on V1

V1 will remain stable and supported. No timeline for deprecation has been announced:

```bash
# Explicitly request V1
curl -H "Accept-Version: 1.0" http://localhost:8765/api/help
curl http://localhost:8765/api/v1/help
```

## Common Use Cases

### Check API Health with Telemetry (V2)

```bash
curl http://localhost:8765/api/v2/diagnostics | jq '.telemetry'
```

### Get Deprecation Warnings

```bash
curl http://localhost:8765/api/v2/help | jq '.deprecations'
```

### Verify Version Support

```bash
curl http://localhost:8765/api/version | jq '.apiVersions'
```

### Monitor API Performance

```bash
curl http://localhost:8765/api/version | jq '.apiVersions[].metrics'
```

### Switch Between Versions in Script

```bash
#!/bin/bash
API_VERSION=${API_VERSION:-2}  # Default to v2

curl -H "Accept-Version: ${API_VERSION}.0" \
  http://localhost:8765/api/help
```

## Testing

### Run Standalone Tests

```bash
# Requires server running on localhost:8765
node /home/devel/basset-hound-browser/tests/test-api-versioning-standalone.js
```

### Run Shell Tests

```bash
# Requires server running on localhost:8765
bash /home/devel/basset-hound-browser/tests/test-api-versioning.sh
```

### Manual Testing with curl

```bash
# Test version endpoint
curl http://localhost:8765/api/version

# Test V1 vs V2 differences
curl http://localhost:8765/api/v1/help > v1-help.json
curl http://localhost:8765/api/v2/help > v2-help.json
diff v1-help.json v2-help.json

# Test header-based negotiation
curl -H "Accept-Version: 1.0" http://localhost:8765/api/help
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help

# Test query parameter
curl "http://localhost:8765/api/help?apiVersion=1"
curl "http://localhost:8765/api/help?apiVersion=2"
```

## Troubleshooting

### Getting Wrong Version

Check the priority order of version negotiation:

1. **Check HTTP headers** (highest priority):
   ```bash
   curl -i http://localhost:8765/api/help  # Look for X-API-Version header
   ```

2. **Check URL path** (medium priority):
   - Ensure path starts with `/api/v1/` or `/api/v2/`
   - Check for typos in version number

3. **Check query parameter** (lowest priority):
   - Use `?apiVersion=1` or `?apiVersion=2`
   - Ensure no conflicting URL prefix

### Server Not Recognizing Version

Ensure the DiagnosticsAPI is properly initialized:

```javascript
const { DiagnosticsAPI } = require('./websocket/diagnostics-api');
const api = new DiagnosticsAPI({
  version: '12.7.0',
  // ... other options
});
```

### Response Headers Missing

If `X-API-Version` header is missing, the server may not be updated. Verify:

```bash
curl -i http://localhost:8765/api/v2/help | grep X-API-Version
```

## Future Versions

Plans for future API versions:

- **V3.0** (planned): Advanced analytics, machine learning insights
- **V4.0** (planned): Real-time streaming, WebSocket API versioning

## Support & Feedback

For issues or suggestions regarding API versioning:

1. Check this documentation
2. Review test files in `/tests/`
3. Check response headers and JSON payloads
4. File an issue with version details

---

**Last Updated**: 2026-06-21  
**API Version**: 2.0
