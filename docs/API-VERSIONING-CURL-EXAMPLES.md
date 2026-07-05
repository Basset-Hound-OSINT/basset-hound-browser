# API Versioning - curl Examples

Quick reference for testing API versioning with curl commands.

## Server Setup

Ensure the diagnostics API is running:

```bash
# The API should be available on localhost:8765
curl http://localhost:8765/api/version
```

## Basic Examples

### 1. Check Available Versions

```bash
curl http://localhost:8765/api/version | jq
```

Response shows supported versions, status, release dates, and metrics.

### 2. V1 Help via URL Prefix

```bash
curl http://localhost:8765/api/v1/help | jq
```

Shows V1 format: basic command listing without deprecation warnings.

### 3. V2 Help via URL Prefix

```bash
curl http://localhost:8765/api/v2/help | jq
```

Shows V2 format: includes version info and deprecation warnings.

### 4. Legacy Endpoint (Defaults to V1)

```bash
curl http://localhost:8765/api/help | jq '.apiVersion'
# Output: "1.0"
```

## Version Negotiation Examples

### Via HTTP Header (Highest Priority)

```bash
# Request V1
curl -H "Accept-Version: 1.0" http://localhost:8765/api/help | jq '.apiVersion'
# Output: "1.0"

# Request V2
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help | jq '.apiVersion'
# Output: "2.0"

# Test with diagnostics
curl -H "Accept-Version: 2.0" http://localhost:8765/api/diagnostics | jq '.telemetry'
```

### Via URL Prefix (Medium Priority)

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

### Via Query Parameter (Lowest Priority)

```bash
# Request V1
curl http://localhost:8765/api/help?apiVersion=1 | jq '.apiVersion'

# Request V2
curl http://localhost:8765/api/help?apiVersion=2 | jq '.apiVersion'

# With other query parameters
curl http://localhost:8765/api/help?search=navigate&apiVersion=2 | jq
```

## Testing All Endpoints

### Test V1 Help Endpoint

```bash
curl http://localhost:8765/api/v1/help | jq '.helpEndpoints'
```

### Test V2 Help Endpoint

```bash
curl http://localhost:8765/api/v2/help | jq '{apiVersion, versionInfo, deprecations}'
```

### Test V1 Diagnostics

```bash
curl http://localhost:8765/api/v1/diagnostics | jq '{apiVersion, version, status, uptime}'
```

### Test V2 Diagnostics

```bash
curl http://localhost:8765/api/v2/diagnostics | jq '{apiVersion, telemetry, recommendations}'
```

### Test V1 Status

```bash
curl http://localhost:8765/api/v1/status | jq '.status'
```

### Test V2 Status

```bash
curl http://localhost:8765/api/v2/status | jq '{status, recommendations}'
```

### Test V1 Schema

```bash
curl http://localhost:8765/api/v1/schema | jq '.openapi'
```

### Test V2 Schema

```bash
curl http://localhost:8765/api/v2/schema | jq '{openapi, "x-version-info": .["x-version-info"]}'
```

## Response Header Inspection

### Show All Headers

```bash
curl -i http://localhost:8765/api/v2/help | head -n 20
```

### Extract Version Header

```bash
curl -s -i http://localhost:8765/api/v2/help | grep "X-API-Version"
# Output: X-API-Version: 2.0
```

### Extract Response Time Header

```bash
curl -s -i http://localhost:8765/api/v2/help | grep "X-Response-Time-Ms"
# Output: X-Response-Time-Ms: 2.34
```

### Extract Both Headers

```bash
curl -s -i http://localhost:8765/api/v2/help | grep -E "(X-API-Version|X-Response-Time-Ms)"
```

## Comparing Versions

### Compare Help Output

```bash
curl -s http://localhost:8765/api/v1/help | jq 'keys | sort' > v1-keys.txt
curl -s http://localhost:8765/api/v2/help | jq 'keys | sort' > v2-keys.txt
diff v1-keys.txt v2-keys.txt
```

### Compare Diagnostics Output

```bash
curl -s http://localhost:8765/api/v1/diagnostics > diag-v1.json
curl -s http://localhost:8765/api/v2/diagnostics > diag-v2.json
diff diag-v1.json diag-v2.json
```

### Show V2-only Features

```bash
# V2-only fields in help
curl -s http://localhost:8765/api/v2/help | jq 'keys[] | select(IN("versionInfo","deprecations"))'

# V2-only fields in diagnostics
curl -s http://localhost:8765/api/v2/diagnostics | jq 'keys[] | select(IN("telemetry","recommendations","versionInfo"))'
```

## Extract Specific Information

### Get Deprecation Information

```bash
curl -s http://localhost:8765/api/v2/help | jq '.deprecations'
curl -s http://localhost:8765/api/v2/help | jq '.deprecations[] | {command, alternative}'
```

### Get Health Recommendations

```bash
curl -s http://localhost:8765/api/v2/diagnostics | jq '.recommendations'
curl -s http://localhost:8765/api/v2/diagnostics | jq '.recommendations[] | {severity, recommendation}'
```

### Get Request Metrics

```bash
curl -s http://localhost:8765/api/version | jq '.apiVersions[].metrics'
curl -s http://localhost:8765/api/v2/diagnostics | jq '.telemetry.requestMetrics'
```

### Get Version Information

```bash
curl -s http://localhost:8765/api/v2/help | jq '.versionInfo'
curl -s http://localhost:8765/api/v2/diagnostics | jq '.versionInfo'
curl -s http://localhost:8765/api/v2/status | jq '.versionInfo'
```

## Complex Queries

### Search Commands (V1 vs V2)

```bash
# V1 search
curl -s http://localhost:8765/api/v1/help?search=navigate | jq '{apiVersion, resultCount, results: (.results | length)}'

# V2 search (with deprecation info)
curl -s http://localhost:8765/api/v2/help?search=navigate | jq '{apiVersion, resultCount, deprecations}'
```

### Get Specific Command Help

```bash
# V1 command help
curl -s http://localhost:8765/api/v1/help?command=navigate | jq '{command, category, description, required}'

# V2 command help (includes version info)
curl -s http://localhost:8765/api/v2/help?command=navigate | jq '{apiVersion, command, category, description, versionInfo}'
```

### Monitor API Performance

```bash
# Get metrics for both versions
curl -s http://localhost:8765/api/version | jq '.apiVersions[] | {version, metrics}'

# Track average response times
curl -s http://localhost:8765/api/v2/diagnostics | jq '.telemetry.requestMetrics | to_entries[] | {version: .key, avgResponseTime: .value.avgResponseTime}'
```

## Testing Version Priority

### Test Priority: Header > URL > Query

```bash
# Test 1: Header takes priority over URL
# Should return 2.0 (header wins)
curl -H "Accept-Version: 2.0" http://localhost:8765/api/v1/help | jq '.apiVersion'
# Output: "2.0"

# Test 2: URL takes priority over query param
# Should return 2.0 (URL prefix wins)
curl http://localhost:8765/api/v2/help?apiVersion=1 | jq '.apiVersion'
# Output: "2.0"

# Test 3: Query param is fallback
# Should return 2.0 (query param used when no URL/header)
curl http://localhost:8765/api/help?apiVersion=2 | jq '.apiVersion'
# Output: "2.0"
```

## Batch Testing

### Test All Endpoints

```bash
#!/bin/bash
endpoints=(
  "/api/version"
  "/api/v1/help"
  "/api/v2/help"
  "/api/v1/diagnostics"
  "/api/v2/diagnostics"
  "/api/v1/status"
  "/api/v2/status"
  "/api/v1/schema"
  "/api/v2/schema"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing: $endpoint"
  curl -s -o /dev/null -w "HTTP %{http_code} - Time: %{time_total}s\n" \
    http://localhost:8765$endpoint
done
```

### Test Version Headers

```bash
#!/bin/bash
for version in 1.0 2.0; do
  echo "Testing with Accept-Version: $version"
  curl -s -H "Accept-Version: $version" \
    http://localhost:8765/api/help | jq '.apiVersion'
done
```

### Save Responses for Comparison

```bash
# Save all endpoint responses
for version in v1 v2; do
  mkdir -p /tmp/api-responses/$version
  for endpoint in help diagnostics status schema; do
    curl -s http://localhost:8765/api/$version/$endpoint \
      > /tmp/api-responses/$version/$endpoint.json
  done
done

# Compare with diff
diff /tmp/api-responses/v1/help.json /tmp/api-responses/v2/help.json
```

## Troubleshooting

### Verify Server is Running

```bash
curl -v http://localhost:8765/api/version 2>&1 | grep "Connected\|refused"
```

### Check HTTP Status Code

```bash
curl -w "\nHTTP Status: %{http_code}\n" http://localhost:8765/api/v2/help
```

### Inspect Full Response (Headers + Body)

```bash
curl -i http://localhost:8765/api/v2/help | head -n 30
```

### Debug Version Negotiation

```bash
# Clear version from everything - should default to 1.0
curl http://localhost:8765/api/help | jq '.apiVersion'

# Explicitly set to 2.0
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help | jq '.apiVersion'

# Verify response headers
curl -i -H "Accept-Version: 2.0" http://localhost:8765/api/help | grep X-API-Version
```

---

**Last Updated**: 2026-06-21
