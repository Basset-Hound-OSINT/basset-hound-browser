# Request Size Limits - DoS Protection

**Version:** 1.0.0  
**Created:** June 21, 2026  
**Status:** Production Ready

## Overview

This document describes the request size limit feature implemented to protect against Denial of Service (DoS) attacks via excessively large WebSocket message payloads.

## Problem Statement

**Critical Issue:** No request size limits allowed DoS attacks via large payloads
- Attackers could send massive payloads (100+ MB) to exhaust server memory
- No per-command size differentiation (screenshot commands vs. simple toggles)
- No monitoring or metrics for rejected requests
- Vulnerability exposed in WebSocket server initialization

## Solution Architecture

### Component Overview

The solution consists of three main components:

1. **RequestSizeValidator** (`websocket/request-validator.js`)
   - Core validation logic
   - Per-command categorization
   - Metrics tracking and monitoring
   - Configuration management

2. **WebSocket Server Integration** (`websocket/server.js`)
   - `maxPayload` limit in WebSocket.Server initialization
   - Message size validation on reception
   - Command-specific validation
   - Error response handling

3. **Monitoring Commands**
   - `get_request_size_metrics` - View rejection statistics
   - `get_request_size_limits` - View current configuration

## Default Size Limits

### Global Limit
- **Default:** 100 MB
- **Environment Variable:** `BASSET_WS_MAX_PAYLOAD`
- **WebSocket Config:** `maxPayload: 100 * 1024 * 1024`

### Per-Command Category Limits

| Category | Commands | Default Limit | Use Case |
|----------|----------|---------------|----------|
| **screenshot** | `screenshot`, `screenshot_element`, `capture_screenshot`, `screenshot_region`, etc. | 100 MB | Large image payloads |
| **capture** | `capture`, `capture_page`, `capture_element`, `capture_annotations` | 100 MB | Large capture operations |
| **extraction** | `extract`, `extract_html`, `extract_dom_snapshot`, `use_extraction_template`, etc. | 50 MB | Large HTML/DOM content |
| **analysis** | `analyze`, `analyze_page`, `get_forensic_report`, `correlate_evidence` | 50 MB | Large analysis payloads |
| **default** | All other commands | 10 MB | Regular operations |

### Environment Variable Overrides

```bash
# Override global payload limit (100 MB)
export BASSET_WS_MAX_PAYLOAD=150MB

# Override screenshot command limits
export BASSET_WS_MAX_SCREENSHOT=120MB

# Override extraction command limits
export BASSET_WS_MAX_EXTRACTION=75MB

# Override default limit for unknown commands
export BASSET_WS_MAX_DEFAULT=15MB
```

### Programmatic Configuration

```javascript
const server = new WebSocketServer(8765, mainWindow, {
  requestSizeLimits: {
    global: 200 * 1024 * 1024,  // 200 MB
    categories: {
      screenshot: 150 * 1024 * 1024,
      extraction: 75 * 1024 * 1024,
      default: 15 * 1024 * 1024
    }
  }
});
```

## Validation Flow

### Request Processing Pipeline

```
1. WebSocket message received
   ↓
2. Calculate message size
   ↓
3. Check global limit (100 MB)
   ↓
4. Parse JSON to get command
   ↓
5. Check command-specific limit
   ↓
6. If valid → Process command
   If invalid → Send 413 error + log + track metrics
```

### Error Response Format

When a request is rejected, the server responds with:

```json
{
  "id": <request_id>,
  "command": "<command_name>",
  "success": false,
  "error": "Request size 125.00 MB exceeds limit for 'screenshot' command (100.00 MB)",
  "errorCode": "COMMAND_PAYLOAD_TOO_LARGE"
}
```

### Error Codes

- **PAYLOAD_TOO_LARGE** - Message exceeds global limit (100 MB)
- **COMMAND_PAYLOAD_TOO_LARGE** - Message exceeds command-specific limit

## Monitoring and Metrics

### Get Request Size Metrics

**Command:** `get_request_size_metrics`

```javascript
// Request
{
  "id": 1,
  "command": "get_request_size_metrics"
}

// Response
{
  "success": true,
  "metrics": {
    "totalValidated": 1524,
    "totalRejected": 23,
    "rejectionRate": "1.51%",
    "rejectionsByCommand": {
      "screenshot": 5,
      "extract_html": 8,
      "unknown_cmd": 10
    },
    "rejectionsBySize": {
      "small": 0,
      "medium": 2,
      "large": 5,
      "xlarge": 10,
      "massive": 6
    },
    "recentRejections": [
      {
        "timestamp": "2026-06-21T10:15:23.456Z",
        "command": "screenshot",
        "sizeBytes": 105000000,
        "sizeFormatted": "100.10 MB",
        "errorCode": "PAYLOAD_TOO_LARGE",
        "message": "Request size 100.10 MB exceeds global limit of 100.00 MB"
      }
    ]
  }
}
```

### Get Request Size Limits

**Command:** `get_request_size_limits`

```javascript
// Request
{
  "id": 2,
  "command": "get_request_size_limits"
}

// Response
{
  "success": true,
  "configuration": {
    "global": "100.00 MB",
    "categories": {
      "screenshot": "100.00 MB",
      "capture": "100.00 MB",
      "extraction": "50.00 MB",
      "analysis": "50.00 MB",
      "default": "10.00 MB"
    },
    "commands": {
      "screenshot": "screenshot",
      "screenshot_element": "screenshot",
      "extract_html": "extraction",
      "analyze_page": "analysis",
      ...
    }
  }
}
```

## Implementation Details

### Size Categorization for Metrics

Messages are categorized by size for better insights:

- **small**: < 1 MB
- **medium**: 1-10 MB
- **large**: 10-50 MB
- **xlarge**: 50-100 MB
- **massive**: > 100 MB

### Metrics Retention

The validator maintains:
- **Total counters:** All-time statistics
- **Recent rejections:** Last 100 rejected requests (circular buffer)
- **Per-command tracking:** Rejections grouped by command name
- **Size distribution:** Rejections categorized by size

### Command Mapping

Commands are automatically categorized based on their function:

```javascript
// Screenshot commands (100 MB limit)
'screenshot', 'screenshot_element', 'screenshot_region', etc.

// Extraction commands (50 MB limit)
'extract', 'extract_html', 'extract_dom_snapshot', etc.

// Analysis commands (50 MB limit)
'analyze', 'analyze_page', 'correlate_evidence', etc.

// All others (10 MB limit)
```

## Security Considerations

### Protection Mechanisms

1. **WebSocket Frame-Level Limit**
   - `maxPayload: 100 MB` in WebSocket.Server options
   - Prevents frame reassembly attacks
   - Enforced before message handler

2. **Message-Level Validation**
   - Global payload size check
   - Command-specific category checks
   - JSON parsing happens after validation

3. **Per-Command Differentiation**
   - Screenshot/capture operations: 100 MB (legitimate large images)
   - Extraction operations: 50 MB (legitimate large HTML/DOM)
   - Standard operations: 10 MB (typical command size)

4. **Monitoring and Logging**
   - All rejections logged with full context
   - Metrics tracked per command and size
   - Recent rejections available for analysis

### Vulnerability Mitigation

| Attack Vector | Mitigation |
|---------------|-----------|
| Memory exhaustion | Global 100 MB limit + WebSocket maxPayload |
| Resource starvation | Per-command limits prevent abuse scenarios |
| Metric pollution | Rejection tracking with circular buffer (max 100) |
| Silent failures | All rejections logged and tracked |
| Bypass via JSON | Validation before parsing |

## Testing

### Test Coverage

The implementation includes 23 unit tests covering:

1. **Basic Validation** (4 tests)
   - Accept under limit
   - Reject over limit
   - Buffer handling

2. **Per-Command Limits** (5 tests)
   - Screenshot limit verification
   - Extraction limit verification
   - Default limit assignment
   - Rejection behavior
   - Acceptance behavior

3. **Metrics Tracking** (5 tests)
   - Validation count tracking
   - Rejection count tracking
   - Per-command rejection tracking
   - Size category distribution
   - Circular buffer management

4. **Configuration** (4 tests)
   - Limit retrieval
   - Command mapping
   - Environment variable overrides
   - Custom limit configuration

5. **Size Handling** (2 tests)
   - Size formatting
   - Default configuration verification

6. **Error Format** (3 tests)
   - Rejection structure
   - Success structure
   - Error context inclusion

### Running Tests

```bash
# Run all request size validator tests
npx mocha tests/unit/security/request-size-validator.test.js

# Run with verbose output
npx mocha tests/unit/security/request-size-validator.test.js --reporter spec

# Run with custom timeout
npx mocha tests/unit/security/request-size-validator.test.js --timeout 15000
```

### Test Results

```
RequestSizeValidator
  Test 1: Basic Message Size Validation
    ✓ should accept messages under the global limit
    ✓ should reject messages exceeding the global limit
    ✓ should handle Buffer input correctly
    ✓ should handle Buffer exceeding limit
  Test 2: Per-Command Category Limits
    ✓ should apply screenshot command limits correctly
    ✓ should apply extraction command limits correctly
    ✓ should apply default limits for unknown commands
    ✓ should reject command payload exceeding category limit
    ✓ should accept command payload within category limit
  Test 3: Metrics and Tracking
    ✓ should track validated message count
    ✓ should track rejected message count
    ✓ should track rejections by command
    ✓ should track rejections by size category
    ✓ should keep only recent rejections (max 100)
  Test 4: Configuration and Limits
    ✓ should return current limits configuration
    ✓ should include command mappings in configuration
    ✓ should override limits with environment variables
    ✓ should support custom limits in constructor
  Test 5: Size Parsing and Formatting
    ✓ should format bytes correctly
    ✓ should handle size limits with default configuration
  Test 6: Error Response Format
    ✓ should return proper error structure for rejected requests
    ✓ should return proper success structure for accepted requests
    ✓ should include command in error context

23 passing
```

## Integration Examples

### Example 1: Monitoring Rejections

```javascript
// Client code
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (!data.success && data.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE') {
    console.warn(`Command "${data.command}" request too large: ${data.error}`);
  }
};

// Periodically check metrics
setInterval(async () => {
  ws.send(JSON.stringify({
    id: 1,
    command: 'get_request_size_metrics'
  }));
}, 60000);
```

### Example 2: Adaptive Client

```javascript
// Client dynamically adjusts based on limits
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 1,
    command: 'get_request_size_limits'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.command === 'get_request_size_limits') {
    const screenshotLimit = data.configuration.categories.screenshot;
    console.log(`Max screenshot size: ${screenshotLimit}`);
    // Adjust upload strategy accordingly
  }
};
```

### Example 3: Custom Limits

```javascript
// Server with custom limits
const server = new WebSocketServer(8765, mainWindow, {
  requestSizeLimits: {
    global: 200 * 1024 * 1024,  // 200 MB global
    categories: {
      screenshot: 150 * 1024 * 1024,  // 150 MB for screenshots
      extraction: 75 * 1024 * 1024,   // 75 MB for extraction
      default: 20 * 1024 * 1024       // 20 MB for others
    }
  }
});
```

## Deployment Notes

### Production Configuration

For production deployments:

```bash
# Standard production settings (recommended)
export BASSET_WS_MAX_PAYLOAD=100MB
export BASSET_WS_MAX_SCREENSHOT=100MB
export BASSET_WS_MAX_EXTRACTION=50MB
export BASSET_WS_MAX_DEFAULT=10MB

# High-load scenarios (CDNs, media platforms)
export BASSET_WS_MAX_PAYLOAD=200MB
export BASSET_WS_MAX_SCREENSHOT=150MB
export BASSET_WS_MAX_EXTRACTION=100MB
export BASSET_WS_MAX_DEFAULT=20MB

# Constrained environments (embedded, IoT)
export BASSET_WS_MAX_PAYLOAD=50MB
export BASSET_WS_MAX_SCREENSHOT=50MB
export BASSET_WS_MAX_EXTRACTION=25MB
export BASSET_WS_MAX_DEFAULT=5MB
```

### Monitoring in Production

```javascript
// Periodically log rejection metrics
setInterval(() => {
  const metrics = wsServer.requestSizeValidator.getMetrics();
  if (metrics.rejectionRate > '5%') {
    logger.warn('High rejection rate detected', {
      rejectionRate: metrics.rejectionRate,
      totalRejected: metrics.totalRejected,
      byCommand: metrics.rejectionsByCommand
    });
  }
}, 300000); // Every 5 minutes
```

## Troubleshooting

### Issue: Legitimate requests being rejected

**Symptom:** Clients report "COMMAND_PAYLOAD_TOO_LARGE" errors for legitimate operations

**Solutions:**
1. Check command type - might be miscategorized
2. Increase relevant category limit via environment variable
3. Use custom limits in constructor for fine-grained control

Example:
```bash
export BASSET_WS_MAX_EXTRACTION=100MB  # Increase extraction limit
```

### Issue: Memory usage not improving

**Symptom:** Server memory usage still high despite size limits

**Solutions:**
1. Verify `maxPayload` is set in WebSocket.Server
2. Check for data retained in metrics (circular buffer should prevent growth)
3. Monitor garbage collection

### Issue: Metrics not updating

**Symptom:** `get_request_size_metrics` returns zeros

**Solutions:**
1. Verify validator is initialized (check logs)
2. Ensure commands are being sent
3. Check that validation is running before parsing

## Future Enhancements

Potential improvements for future versions:

1. **Adaptive Limits**
   - Automatically adjust limits based on server load
   - Per-session limits instead of global

2. **Rate Limiting Integration**
   - Combine with rate limiting for multi-layer protection
   - Penalize clients with frequent rejections

3. **Compression Awareness**
   - Consider compressed size vs. uncompressed
   - Different limits for compressed payloads

4. **Forensic Analysis**
   - Deep packet inspection for rejected payloads
   - Signature detection for known attacks

5. **Dashboard Integration**
   - Real-time metrics visualization
   - Rejection trend analysis
   - Per-client metrics

## Related Files

- **Implementation:** `/websocket/request-validator.js`
- **Integration:** `/websocket/server.js` (lines 58, 1028, 1262, 1308, 1406-1442, 3703-3720)
- **Tests:** `/tests/unit/security/request-size-validator.test.js`
- **API Reference:** `/docs/API-REFERENCE.md` (updated with new commands)

## Changelog

### v1.0.0 (June 21, 2026)

- ✅ Initial implementation
- ✅ Global payload limit (100 MB)
- ✅ Per-command category limits
- ✅ Environment variable configuration
- ✅ Metrics tracking and monitoring
- ✅ Request validation commands
- ✅ Comprehensive test coverage (23 tests)
- ✅ Production-ready documentation

---

**Status:** Production Ready  
**Test Coverage:** 23/23 (100%)  
**Security:** Critical DoS vulnerability mitigated
