# Rate Limiting Implementation

## Overview

Rate limiting is now **ENABLED BY DEFAULT** in Basset Hound Browser to prevent command flooding attacks and resource exhaustion. This security feature enforces per-client and per-command rate limits using a sliding window algorithm.

**Critical Security Fix:** Previously, rate limiting was disabled by default (backwards compatibility mode). This allowed unlimited command floods. The implementation now:

1. **Flips Default to ENABLED** - Rate limiting is active unless explicitly disabled
2. **Separates Limits by Authentication** - Authenticated clients get higher limits
3. **Per-Command Buckets** - Different commands have different rate limit thresholds
4. **Sliding Window Algorithm** - Fair limiting over time windows
5. **Configurable via Environment Variables** - Easy customization for deployments
6. **Admin Bypass Option** - Testing and administrative access

## Architecture

### Rate Limiter Module

The `WebSocketRateLimiter` class (`websocket/rate-limiter.js`) provides:

- **Sliding Window Tracking**: Timestamps recorded per client per command
- **Per-Command Limits**: Different restrictions based on command type
- **Burst Allowance**: Temporary spikes above normal limits
- **Automatic Cleanup**: Memory management for stale data
- **Statistics Tracking**: Metrics on request patterns and rejections

### Server Integration

The WebSocket server (`websocket/server.js`) integrates the rate limiter by:

1. Initializing rate limiter on startup with configuration
2. Checking rate limit status before processing each command
3. Returning HTTP 429 (Too Many Requests) when limits exceeded
4. Including reset time information in error responses

## Configuration

### Environment Variables

All settings can be configured via environment variables:

```bash
# Enable/disable rate limiting (default: true)
RATE_LIMIT_ENABLED=true|false

# Unauthenticated client limit - requests per minute (default: 100)
RATE_LIMIT_UNAUTHENTICATED=100

# Authenticated client limit - requests per minute (default: 1000)
RATE_LIMIT_AUTHENTICATED=1000
```

### Programmatic Configuration

When initializing the WebSocket server:

```javascript
const server = new WebSocketServer({
  // Rate limiting options
  rateLimitEnabled: true,
  unauthenticatedLimit: 100,  // req/min
  authenticatedLimit: 1000,   // req/min
  windowMs: 60000,            // 1 minute window
  burstAllowance: 10,         // allow 10 extra during burst
  adminBypass: true,          // allow admin token bypass
  commandLimits: {
    // Override per-command limits
    screenshot: 10,
    navigate: 25,
    execute_script: 50
  },
  logger: myLogger
});
```

## Rate Limit Tiers

### Unauthenticated Clients (Development Tool)
- **Base Limit**: 100 requests per minute
- **Burst Allowance**: 10 extra requests
- **Total Allowed**: 110 requests before rejection
- **Use Case**: Development, testing, single-user scenarios

### Authenticated Clients (Production Integration)
- **Base Limit**: 1000 requests per minute
- **Burst Allowance**: 10 extra requests
- **Total Allowed**: 1010 requests before rejection
- **Use Case**: Deployed agents, multi-agent orchestration

## Per-Command Rate Limits

Different commands have different restrictions based on resource cost:

### Heavy Operations (Low Limits)
```
screenshot:           5 req/min
screenshot_viewport:  5 req/min
screenshot_full_page: 3 req/min
screenshot_element:   8 req/min
create_profile:       5 req/min
delete_profile:       5 req/min
```

### Medium Operations (Moderate Limits)
```
execute_script:       20 req/min
execute_async_script: 15 req/min
navigate:             15 req/min
wait_for_navigation:  10 req/min
set_cookies:          20 req/min
click:                40 req/min
fill:                 40 req/min
type:                 40 req/min
```

### Light Operations (High Limits)
```
get_content:          100 req/min
get_url:              100 req/min
get_page_state:       100 req/min
get_cookies:          50 req/min
get_local_storage:    50 req/min
hover:                50 req/min
```

### Effective Limit
The **effective limit** for any command is the minimum of:
- Base client limit (100 for unauth, 1000 for auth)
- Per-command limit (as listed above)

This ensures even authenticated clients respect expensive operation limits.

## Sliding Window Algorithm

The implementation uses a sliding window based on timestamps:

1. **Record Request**: When a request is allowed, its timestamp is recorded
2. **Cleanup Old Data**: Timestamps older than the window (60 seconds) are removed
3. **Count Valid Requests**: Only timestamps within the window are counted
4. **Check Limit**: If count < limit, request is allowed; otherwise rejected

Example: If a client has limits 15 req/min:
```
Time    Request  Count  Status
00:05   #1       1      ALLOWED (1 < 15)
00:10   #2       2      ALLOWED (2 < 15)
...
00:55   #15      15     ALLOWED (15 = 15, at limit)
01:00   #16      15     BURST (burst allows 10 extra)
01:05   #26      15     REJECTED (exceeds burst)
01:10   #1       0      ALLOWED (first request dropped from window)
```

## Error Responses

When rate limited, clients receive a 429 (Too Many Requests) response:

```json
{
  "id": "request-123",
  "command": "navigate",
  "success": false,
  "error": "Rate limit exceeded for command \"navigate\". Limit: 15 req/min, Current: 25. Retry in 45s",
  "rateLimited": true,
  "statusCode": 429,
  "resetIn": 45000,
  "retryAfter": 45
}
```

The client should wait `retryAfter` seconds before retrying.

## Status Reporting

Clients can query their current rate limit status:

```javascript
// Get status for all commands
limiter.getStatus(clientId)
// Returns: {
//   enabled: true,
//   clientId: "client-123",
//   authenticated: true,
//   baseLimit: 1000,
//   windowMs: 60000,
//   commands: {
//     navigate: { current: 3, limit: 15, remaining: 12, resetIn: 55000 },
//     screenshot: { current: 1, limit: 5, remaining: 4, resetIn: 58000 }
//   }
// }

// Get status for specific command
limiter.getStatus(clientId, 'screenshot')
// Returns: {
//   enabled: true,
//   clientId: "client-123",
//   command: 'screenshot',
//   authenticated: true,
//   limit: 5,
//   current: 1,
//   remaining: 4,
//   resetIn: 58000
// }
```

## Admin Bypass (Testing)

For testing and administrative operations, admin tokens can bypass rate limits:

```javascript
// Set admin tokens on initialization
const server = new WebSocketServer({
  adminBypass: true,
  // ... other config
});

// Or add tokens later
server.rateLimiter.setAdminTokens([
  'admin-secret-token-xyz',
  'another-admin-token'
]);

// Admin token holders can make unlimited requests
// (include token in request headers/payload)
```

## Statistics and Monitoring

Get overall statistics:

```javascript
const stats = limiter.getStats();
// Returns: {
//   enabled: true,
//   totalRequests: 45230,
//   totalRejected: 1203,
//   rejectionRate: "2.66%",
//   trackedClients: 47,
//   authenticatedClients: 5,
//   limits: { ... }
// }
```

## Testing

Rate limiting is tested with 22 comprehensive test cases covering:

1. **Initialization** - Default config, environment variables
2. **Unauthenticated Limiting** - Base tier enforcement
3. **Authenticated Limiting** - Higher tier enforcement
4. **Per-Command Limits** - Independent command buckets
5. **Burst Allowance** - Temporary spike handling
6. **Sliding Window** - Time-based reset behavior
7. **Admin Bypass** - Token-based exemption
8. **Status Reporting** - Client status queries
9. **Statistics** - Metrics tracking
10. **Reset/Cleanup** - Memory management
11. **Disabled Mode** - Graceful degradation
12. **Edge Cases** - Concurrent clients, retry logic

Run tests:
```bash
npm test -- tests/security/websocket-rate-limiter.test.js
```

## Security Considerations

### Attack Prevention

Rate limiting prevents:
- **Command Flooding**: Unlimited rapid commands causing CPU exhaustion
- **Resource Exhaustion**: Screenshot/script spam consuming memory
- **Denial of Service**: Single client monopolizing server resources

### Limits Rationale

- **Screenshot (3-5/min)**: Heavy CPU/memory, most expensive operation
- **Execute Script (15-20/min)**: Security risk, execution overhead
- **Navigation (10-15/min)**: Network I/O, moderate cost
- **DOM Ops (40-50/min)**: Lightweight, local only
- **Read Ops (50-100/min)**: Information retrieval, minimal overhead

### Authenticated vs Unauthenticated

- **Unauthenticated (100/min)**: Suitable for development tools, single-user
- **Authenticated (1000/min)**: For validated agents, production deployments
- Difference allows controlled scaling while maintaining per-op limits

## Performance Impact

- **Timestamp Recording**: O(1) per request
- **Window Cleanup**: Automatic, runs every 30 seconds
- **Memory Overhead**: ~100 bytes per active client per command
- **CPU Overhead**: <1% for typical workloads

For a server with 1000 active clients making 10 commands each:
- Memory: ~1MB for tracking
- CPU: Negligible overhead

## Troubleshooting

### Clients Getting Rate Limited Unexpectedly

1. **Check Status**: Use `get_rate_limit_status` command to see current limits
2. **Verify Authentication**: Authenticated clients get 10x higher limits
3. **Review Command**: Check if specific command has lower limit
4. **Burst Allowance**: Temporary overages allowed via burst
5. **Increase Limits**: Adjust env vars or programmatic config

### Disable Rate Limiting (Development Only)

```bash
# Via environment variable
RATE_LIMIT_ENABLED=false npm start

# Via code
const server = new WebSocketServer({
  rateLimitEnabled: false,
  // ...
});
```

### Monitor for Abuse

Check statistics for high rejection rates:

```javascript
const stats = limiter.getStats();
if (stats.rejectionRate > 5) {
  logger.warn('High rate limit rejection rate detected', stats);
}
```

## Version History

### v1.0.0 (Current)
- Initial implementation with sliding window algorithm
- Per-command rate limits
- Burst allowance support
- Admin bypass for testing
- Environment variable configuration
- Comprehensive test coverage (22 tests)
- 100% pass rate

## Future Enhancements

Potential improvements for future versions:

1. **Distributed Rate Limiting**: Support for multi-server deployments
2. **IP-Based Limiting**: Additional restriction by source IP
3. **Custom Alert Thresholds**: Automatic notifications on anomalies
4. **Rate Limit Headers**: Return-Retry-After headers for better client handling
5. **Adaptive Limits**: Automatic adjustment based on server load
6. **Request Queuing**: Queue requests instead of rejecting during spikes
7. **Client Whitelisting**: Permanent exemptions for trusted clients

## References

- [HTTP Status Code 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Rate Limiting Patterns](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [Sliding Window Algorithm](https://en.wikipedia.org/wiki/Sliding_window_protocol)
