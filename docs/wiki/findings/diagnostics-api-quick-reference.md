# Self-Documenting Diagnostics API - Quick Reference

**Version:** 12.10.0  
**Last Updated:** June 22, 2026  
**Status:** ✅ Production Ready

## One-Minute Overview

The Basset Hound Browser includes a **self-documenting API** that serves its own documentation. No external files needed!

```bash
# Start the browser and it listens on port 8765
# All documentation is available via HTTP GET endpoints

curl http://localhost:8765/api/help              # List all commands
curl http://localhost:8765/api/help?command=navigate  # Get command details
curl http://localhost:8765/api/health            # Check reliability metrics
curl http://localhost:8765/api/diagnostics       # Get browser health
curl http://localhost:8765/api/openapi.yaml      # Get OpenAPI schema
```

## Core Endpoints (v1 & v2)

### Help Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/help` | List all commands by category |
| `GET /api/help?command=<name>` | Get details for specific command |
| `GET /api/help?search=<keyword>` | Search commands by keyword |
| `GET /api/help?error=<code>` | Get error details + recovery hints |
| `GET /api/version` | Version info and negotiation methods |

### Health & Status

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Per-command reliability metrics (SLA status) |
| `GET /api/diagnostics` | Browser health, system info, memory usage |
| `GET /api/status` | Operational status and uptime |
| `GET /api/metrics` | Detailed per-command metrics |

### Schema & Integration

| Endpoint | Purpose |
| `GET /api/schema` | OpenAPI 3.0 JSON schema |
| `GET /api/openapi` | OpenAPI 3.0 JSON schema (alias) |
| `GET /api/openapi.yaml` | OpenAPI 3.0 YAML schema |

## API Versioning

Choose your API version using **any of these three methods** (in priority order):

### Method 1: Accept-Version Header
```bash
curl -H "Accept-Version: 2.0" http://localhost:8765/api/help
```

### Method 2: URL Prefix
```bash
curl http://localhost:8765/api/v2/help
```

### Method 3: Query Parameter
```bash
curl http://localhost:8765/api/help?apiVersion=2
```

**Version Differences:**
- **v1.0**: Stable, production-ready, all endpoints available
- **v2.0**: Enhanced with deprecation warnings, telemetry, recommendations

## Common Use Cases

### 1. Discover All Available Commands

```bash
curl http://localhost:8765/api/help | jq '.commands | keys'
```

Response shows commands grouped by category:
```json
{
  "Navigation": ["navigate", "goBack", "goForward", ...],
  "Interaction": ["click", "fill", "type", ...],
  "Screenshots": ["screenshot", "captureElement", ...]
}
```

### 2. Get Command Documentation

```bash
curl http://localhost:8765/api/help?command=navigate | jq
```

Response includes:
- Parameter definitions (types, constraints, examples)
- Required vs optional fields
- Error codes this command can return
- Recovery hints for common errors
- Usage examples

### 3. Search for Commands

```bash
curl http://localhost:8765/api/help?search=proxy | jq '.results'
```

Finds all commands related to proxies in name or description.

### 4. Check Command Health

```bash
curl http://localhost:8765/api/health | jq '.commandMetrics.navigate'
```

See per-command metrics:
- Success rate
- Latency (average, p50, p95, p99)
- Attempt counts
- SLA compliance status

### 5. Get Browser Status

```bash
curl http://localhost:8765/api/diagnostics | jq '.memory, .system'
```

Shows:
- Memory usage (heap, RSS, external)
- System info (platform, CPU count)
- API statistics (total commands, categories)
- Active features

### 6. Get Error Recovery Hints

```bash
curl http://localhost:8765/api/help?error=TIMEOUT
```

Returns:
- Error description
- Suggested recovery action
- Related error codes
- Best practices

### 7. Generate OpenAPI Schema

```bash
curl http://localhost:8765/api/openapi.yaml > schema.yaml

# Use with documentation tools
docker run -p 8080:80 \
  -e SPEC_URL=http://host.docker.internal:8765/api/openapi.yaml \
  redocly/redoc
```

## Integration Examples

### JavaScript/Node.js

```javascript
const http = require('http');

async function getCommand(commandName) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:8765/api/help?command=${commandName}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Usage
getCommand('navigate').then(cmd => {
  console.log(`Command: ${cmd.command}`);
  console.log(`Parameters: ${Object.keys(cmd.parameters)}`);
  console.log(`Required: ${cmd.required}`);
});
```

### Python

```python
import requests

def get_all_commands():
    """Get list of all commands with descriptions"""
    response = requests.get('http://localhost:8765/api/help')
    return response.json()

def get_command_details(name):
    """Get full details for a specific command"""
    response = requests.get(f'http://localhost:8765/api/help?command={name}')
    return response.json()

def get_health_metrics():
    """Get per-command reliability metrics"""
    response = requests.get('http://localhost:8765/api/health')
    return response.json()

# Usage
commands = get_all_commands()
print(f"Total commands: {commands['totalCommands']}")

navigate = get_command_details('navigate')
print(f"Navigate parameters: {navigate['parameters'].keys()}")
```

### cURL Cheatsheet

```bash
# List all commands
curl http://localhost:8765/api/help

# Get command details (formatted)
curl http://localhost:8765/api/help?command=screenshot | jq .

# Search
curl http://localhost:8765/api/help?search=proxy

# Error details
curl http://localhost:8765/api/help?error=TIMEOUT | jq .

# Health (compact)
curl http://localhost:8765/api/health | jq '.overallStatus'

# Diagnostics (compact)
curl http://localhost:8765/api/diagnostics | jq '.memory, .uptime'

# Save schema
curl http://localhost:8765/api/openapi.yaml > schema.yaml

# Pretty print any response
curl http://localhost:8765/api/help | jq .

# Get specific field
curl http://localhost:8765/api/help?command=navigate | jq '.parameters.url'

# Count total commands
curl http://localhost:8765/api/help | jq '.totalCommands'
```

## OpenAPI Schema Generation

The project includes a script to generate and validate OpenAPI schemas:

```bash
# Generate both JSON and YAML schemas
node scripts/generate-openapi.js

# Generate only JSON
node scripts/generate-openapi.js --json-only

# Generate and validate
node scripts/generate-openapi.js --validate

# Verbose output
node scripts/generate-openapi.js -v
```

**Note:** Generated `openapi.json` and `openapi.yaml` are gitignored. They're for tools and documentation generators.

### Use Generated Schemas With:

**SwaggerUI**
```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=http://host.docker.internal:8765/api/openapi \
  swaggerapi/swagger-ui
```

**ReDoc**
```bash
docker run -p 8080:80 \
  -e SPEC_URL=http://host.docker.internal:8765/api/openapi.yaml \
  redocly/redoc
```

**Code Generators**
```bash
# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:8765/api/openapi.yaml \
  -g typescript-fetch \
  -o client/
```

## Real-Time Monitoring

### Monitor Command Health

```bash
# Watch health metrics every 5 seconds
watch -n 5 'curl -s http://localhost:8765/api/health | jq ".overallStatus"'
```

### Get Uptime

```bash
curl -s http://localhost:8765/api/diagnostics | jq '.uptime.readable'
# Output: "2h 45m 32s"
```

### Check Memory Usage

```bash
curl -s http://localhost:8765/api/diagnostics | jq '.memory'
# Output:
# {
#   "heapUsed": "245.67 MB",
#   "heapTotal": "512.00 MB",
#   "heapUsedPercent": "48.00%",
#   "rss": "456.89 MB"
# }
```

## Performance Tips

1. **Cache OpenAPI Schema**
   - Schema is cached for 5 minutes
   - Safe to request frequently without overhead
   - Cache is auto-invalidated on schema changes

2. **Use Compression**
   - All endpoints support gzip compression
   - Request headers: `Accept-Encoding: gzip`
   - Typical compression: 70-90% size reduction

3. **Pagination**
   - `/api/help` returns all commands (~150 KB)
   - Use `/api/help?search=keyword` to filter results
   - Individual command requests are very fast

4. **Batch Requests**
   - Query all metrics once with `/api/health`
   - Don't request individual command metrics repeatedly

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message",
  "suggestion": "What to do next"
}
```

**HTTP Status Codes:**
- `200` - Success
- `404` - Not found (command doesn't exist)
- `500` - Internal server error

**Example Error:**
```bash
curl http://localhost:8765/api/help?command=invalidcmd
```

Response:
```json
{
  "error": "Command not found",
  "command": "invalidcmd",
  "suggestion": "Use /api/help to list all available commands"
}
```

## Testing

Run the comprehensive test suite:

```bash
# Run diagnostics API tests
npm test -- --testPathPattern="diagnostics"

# Run with coverage
npm test -- --testPathPattern="diagnostics" --coverage

# Watch mode
npm test -- --testPathPattern="diagnostics" --watch
```

## Troubleshooting

**Q: Getting connection refused?**
```bash
# Check if browser is running
curl http://localhost:8765/api/health
# If fails, start the browser (see main README)
```

**Q: Getting `Command not found`?**
```bash
# List all available commands
curl http://localhost:8765/api/help | jq '.commands | keys'

# Search similar command names
curl http://localhost:8765/api/help?search=mycommand
```

**Q: Schema is outdated?**
```bash
# Regenerate from running server
node scripts/generate-openapi.js --validate

# Or clear cache and restart
rm openapi.json openapi.yaml
```

**Q: Response is slow?**
```bash
# Add gzip compression
curl -H "Accept-Encoding: gzip" http://localhost:8765/api/help | gunzip

# Use jq for efficient filtering
curl -s http://localhost:8765/api/help | jq '.totalCommands'
```

## Files & Modules

| File | Purpose | Lines |
|------|---------|-------|
| `websocket/diagnostics-api.js` | Core API with version negotiation | 770 |
| `websocket/help-server.js` | Modular help endpoint handler | 752 |
| `websocket/command-registry.js` | Command metadata registry | 541 |
| `websocket/command-schemas.js` | JSON schemas for parameters | 1000+ |
| `scripts/generate-openapi.js` | Schema generation utility | 300+ |
| `tests/websocket/diagnostics-api.test.js` | Comprehensive test suite | 600+ |

## Key Features

✅ **Zero External Dependencies** - All docs served by the API  
✅ **Real-time Metrics** - Live SLA compliance and latency data  
✅ **Version Negotiation** - Support v1 and v2 simultaneously  
✅ **OpenAPI Compatible** - Standard integration with tools  
✅ **Error Recovery** - Guidance for every error code  
✅ **Searchable** - Find commands by keyword  
✅ **Cached Schemas** - Fast response times  
✅ **CORS Enabled** - Cross-origin requests work  
✅ **Compressed** - 70-90% bandwidth reduction  

## What's Next?

1. **Query the API** - `curl http://localhost:8765/api/help`
2. **Find Commands** - `curl http://localhost:8765/api/help?search=navigate`
3. **Get Details** - `curl http://localhost:8765/api/help?command=navigate`
4. **Check Health** - `curl http://localhost:8765/api/health`
5. **Generate Schema** - `node scripts/generate-openapi.js`
6. **Integrate Tools** - Use OpenAPI with SwaggerUI, ReDoc, code generators

## Related Documentation

- [Diagnostics API Implementation](diagnostics-api.md) - Full technical details
- [API Reference](../API-REFERENCE.md) - WebSocket command reference
- [OpenAPI 3.0.0 Specification](https://spec.openapis.org/oas/v3.0.0)
- [JSON Schema Reference](https://json-schema.org/)
