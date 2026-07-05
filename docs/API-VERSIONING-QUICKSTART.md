# API Versioning - Quick Start

## Start Here

API versioning is now available with v1 (legacy) and v2 (enhanced) endpoints.

## 30-Second Overview

```bash
# Check versions available
curl http://localhost:8765/api/version

# Use V1 (simple, legacy)
curl http://localhost:8765/api/v1/help
curl http://localhost:8765/api/v1/diagnostics

# Use V2 (enhanced, with recommendations)
curl http://localhost:8765/api/v2/help
curl http://localhost:8765/api/v2/diagnostics

# Legacy (defaults to V1)
curl http://localhost:8765/api/help
```

## Three Ways to Request a Version

### Method 1: URL Path (Recommended)

```bash
curl http://localhost:8765/api/v1/help      # V1
curl http://localhost:8765/api/v2/help      # V2
```

### Method 2: HTTP Header

```bash
curl -H "Accept-Version: 1.0" http://localhost:8765/api/help
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help
```

### Method 3: Query Parameter

```bash
curl "http://localhost:8765/api/help?apiVersion=1"
curl "http://localhost:8765/api/help?apiVersion=2"
```

## What's Different in V2?

### V2 Help Endpoint Adds:
```json
{
  "versionInfo": { "version": "2.0", "status": "stable" },
  "deprecations": [
    {
      "command": "getScreenshot",
      "reason": "Use captureElement instead",
      "removedIn": "2027-01-01"
    }
  ]
}
```

### V2 Diagnostics Endpoint Adds:
```json
{
  "telemetry": {
    "requestMetrics": {
      "v1": { "count": 145, "avgResponseTime": 2.34 },
      "v2": { "count": 89, "avgResponseTime": 2.41 }
    }
  },
  "recommendations": [
    {
      "severity": "success",
      "recommendation": "System is operating optimally"
    }
  ]
}
```

## Common Tasks

### Compare V1 and V2

```bash
curl http://localhost:8765/api/v1/help > v1.json
curl http://localhost:8765/api/v2/help > v2.json
diff v1.json v2.json
```

### Get Deprecation Warnings

```bash
curl http://localhost:8765/api/v2/help | jq '.deprecations'
```

### Monitor Performance Metrics

```bash
curl http://localhost:8765/api/version | jq '.apiVersions[].metrics'
```

### Extract V2 Recommendations

```bash
curl http://localhost:8765/api/v2/diagnostics | jq '.recommendations'
```

## Response Headers

Every response includes version information:

```
X-API-Version: 2.0        # Which version was used
X-Response-Time-Ms: 2.34  # Response time in milliseconds
```

Check with:
```bash
curl -i http://localhost:8765/api/v2/help | grep "X-API-Version"
```

## All Available Endpoints

### Version Information
```
GET /api/version
```

### V1 Endpoints
```
GET /api/v1/help
GET /api/v1/help?command=<name>
GET /api/v1/help?error=<code>
GET /api/v1/help?search=<keyword>
GET /api/v1/diagnostics
GET /api/v1/status
GET /api/v1/schema
```

### V2 Endpoints
```
GET /api/v2/help
GET /api/v2/help?command=<name>
GET /api/v2/help?error=<code>
GET /api/v2/help?search=<keyword>
GET /api/v2/diagnostics
GET /api/v2/status
GET /api/v2/schema
```

### Legacy (Default to V1)
```
GET /api/help
GET /api/diagnostics
GET /api/status
GET /api/schema
```

## Testing

### Quick Test
```bash
curl -s http://localhost:8765/api/version | jq '.apiVersions | length'
# Output: 2
```

### Run Full Test Suite
```bash
# Node.js tests
node /home/devel/basset-hound-browser/tests/test-api-versioning-standalone.js

# Bash/curl tests
bash /home/devel/basset-hound-browser/tests/test-api-versioning.sh
```

### Interactive Demo
```bash
bash /home/devel/basset-hound-browser/examples/api-versioning-demo.sh
```

## Backward Compatibility

✅ **Don't worry about breaking changes**

- V1 endpoints work exactly as before
- Legacy endpoints (without /v1/ or /v2/) default to V1
- All your existing code continues to work
- V2 is optional enhancement

## Troubleshooting

### Version not showing?
```bash
# Check if server is running
curl http://localhost:8765/api/version

# Check response headers
curl -i http://localhost:8765/api/v2/help | grep X-API-Version
```

### Wrong version returned?
Version negotiation priority:
1. HTTP Header (highest)
2. URL path
3. Query parameter (lowest)

```bash
# This returns V2 (header has priority)
curl -H "Accept-Version: 2.0" http://localhost:8765/api/v1/help
# Output: apiVersion: "2.0"
```

### Getting V1 when want V2?
```bash
# Make sure you're using correct syntax
curl http://localhost:8765/api/v2/help         # ✓ V2
curl http://localhost:8765/api/v1/help         # ✓ V1
curl http://localhost:8765/api/help            # ✓ Defaults to V1

# With header
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help  # ✓ V2

# With query
curl "http://localhost:8765/api/help?apiVersion=2"  # ✓ V2
```

## Need More Details?

- **Full Guide**: See `/docs/API-VERSIONING.md`
- **curl Examples**: See `/docs/API-VERSIONING-CURL-EXAMPLES.md`
- **Implementation Details**: See `/docs/API-VERSIONING-IMPLEMENTATION.md`
- **Run Tests**: See test files in `/tests/`

## Next Steps

1. Try the endpoints:
   ```bash
   curl http://localhost:8765/api/v1/help | jq .
   curl http://localhost:8765/api/v2/help | jq .
   ```

2. Check the differences:
   ```bash
   curl http://localhost:8765/api/v2/help | jq '.deprecations'
   curl http://localhost:8765/api/v2/diagnostics | jq '.recommendations'
   ```

3. Update your code to explicitly request V2 (or stay with V1):
   ```bash
   # Update your client to use versioned endpoints
   curl -H "Accept-Version: 2.0" http://localhost:8765/api/help
   ```

---

**Last Updated**: 2026-06-21  
**Status**: Ready to use  
**Tested**: ✅ All tests passing
