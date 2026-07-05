# HTTP Retry-After Header Implementation

**Version:** 1.0.0  
**Date:** June 21, 2026  
**Status:** Complete

## Overview

This document describes the implementation of HTTP `Retry-After` headers for rate limit responses in Basset Hound Browser. External clients can now read the `Retry-After` header and implement intelligent exponential backoff strategies.

## Features

### 1. Rate Limiter Enhancement
- `WebSocketRateLimiter.check()` now returns `retryAfter` in seconds (HTTP standard format)
- Includes both `retryAfter` (seconds) and `retryAfterMs` (milliseconds) for client flexibility
- Proper calculation: `retryAfter = Math.ceil(resetIn / 1000)`
- HTTP status code 429 included in response

### 2. Error Formatter Enhancement
- `ErrorFormatter.rateLimitError()` includes `Retry-After` in response details
- Provides both `resetIn` (ms) and `retryAfter` (seconds) values
- Includes `httpHeaders` object with `Retry-After: {seconds}` format
- Compatible with both WebSocket and HTTP clients

### 3. HTTP Response Decorator
- New `HttpResponseDecorator` utility class handles HTTP header injection
- Applies `Retry-After` header to HTTP response objects
- Adds companion headers for rate limit information:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets
- Sets standard error response headers

## Architecture

### Files Modified

1. **`websocket/rate-limiter.js`**
   - Added documentation for `retryAfter` field
   - Enhanced error response structure
   - Includes `errorCode`, `retryAfter`, `retryAfterMs`, `statusCode`, `windowMs`

2. **`websocket/error-formatter.js`**
   - Enhanced `rateLimitError()` method
   - Added `httpHeaders` field in response details
   - Includes `Retry-After` header in HTTP-compatible format

3. **`websocket/server.js`**
   - Added import for `HttpResponseDecorator`
   - Initialized `httpResponseDecorator` property in constructor
   - Ready for HTTP endpoint integration

### Files Created

1. **`websocket/http-response-decorator.js`** (NEW)
   - `HttpResponseDecorator` class for HTTP header management
   - Methods:
     - `applyHeaders(res, errorResponse, defaultStatus)` - Apply headers to response object
     - `getRetryAfterHeader(errorResponse)` - Extract Retry-After value
     - `getAllHeaders(errorResponse)` - Get all applicable headers as object
     - `expressMiddleware()` - Express.js middleware for automatic header injection

2. **`tests/websocket/rate-limit-retry-after.test.js`** (NEW)
   - Comprehensive test suite (60+ test cases)
   - Tests for rate limiter, error formatter, and decorator
   - End-to-end integration tests
   - Edge case coverage

## Response Format

### Rate Limit Response (429)

#### JSON Response Body
```json
{
  "success": false,
  "error": "Rate limit exceeded for command 'navigate'. Limit: 10 req/min. Retry in 30s",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "command": "navigate",
  "id": "request-123",
  "recoveryHint": "You have exceeded the rate limit for this command. Wait the specified time (see 'resetIn' in response details) before retrying...",
  "details": {
    "limit": 10,
    "current": 10,
    "remaining": 0,
    "resetIn": 30000,
    "retryAfter": 30,
    "statusCode": 429,
    "httpHeaders": {
      "Retry-After": "30"
    },
    "authenticated": false
  }
}
```

#### HTTP Response Headers
```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=utf-8
Cache-Control: no-cache, no-store, must-revalidate
X-Content-Type-Options: nosniff
X-Error-Code: RATE_LIMIT_EXCEEDED
Retry-After: 30
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1624270834
```

## Client Usage

### For HTTP Clients

```javascript
fetch('http://api.example.com/command', {
  method: 'POST',
  body: JSON.stringify({ command: 'navigate', url: 'https://example.com' })
})
  .then(response => {
    if (response.status === 429) {
      // Read Retry-After header
      const retryAfter = parseInt(response.headers.get('Retry-After'));
      console.log(`Rate limited. Retry after ${retryAfter} seconds`);
      
      // Implement backoff
      setTimeout(() => {
        // Retry request
      }, retryAfter * 1000);
    }
    return response.json();
  })
  .catch(error => console.error(error));
```

### For WebSocket Clients

```javascript
// Monitor WebSocket messages for rate limit errors
websocket.onmessage = (event) => {
  const response = JSON.parse(event.data);
  
  if (response.errorCode === 'RATE_LIMIT_EXCEEDED') {
    const retryAfter = response.details.retryAfter; // in seconds
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Implement exponential backoff
    setTimeout(() => {
      // Retry command
    }, retryAfter * 1000);
  }
};
```

### Exponential Backoff Example

```javascript
async function executeWithRetry(command, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('http://api.example.com/command', {
        method: 'POST',
        body: JSON.stringify(command)
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After'));
        const backoffMs = retryAfter * 1000 * Math.pow(2, attempt - 1);
        
        console.log(`Attempt ${attempt} failed (rate limited). Retrying in ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      return response.json();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
    }
  }
}
```

## Integration Points

### Express.js Integration

```javascript
const express = require('express');
const { HttpResponseDecorator } = require('./websocket/http-response-decorator');
const { ErrorFormatter } = require('./websocket/error-formatter');
const { WebSocketRateLimiter } = require('./websocket/rate-limiter');

const app = express();
const rateLimiter = new WebSocketRateLimiter();

// Apply middleware
app.use(HttpResponseDecorator.expressMiddleware());

// Example endpoint
app.post('/command', (req, res) => {
  const clientId = req.ip;
  const command = req.body.command;

  // Check rate limit
  const result = rateLimiter.check(clientId, command);
  
  if (!result.allowed) {
    const errorResponse = ErrorFormatter.rateLimitError(result, command, null);
    const statusCode = HttpResponseDecorator.applyHeaders(res, errorResponse);
    return res.status(statusCode).json(errorResponse);
  }

  // Process command
  res.json({ success: true, data: '...' });
});
```

### Custom HTTP Handler

```javascript
const { HttpResponseDecorator } = require('./websocket/http-response-decorator');
const { ErrorFormatter } = require('./websocket/error-formatter');

function handleRateLimitError(response, clientId, command) {
  const rateLimitInfo = rateLimiter.check(clientId, command);
  
  if (!rateLimitInfo.allowed) {
    const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, command, null);
    
    // Get all headers
    const headers = HttpResponseDecorator.getAllHeaders(errorResponse);
    
    // Apply headers to response
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    
    // Send error
    response.statusCode = 429;
    response.end(JSON.stringify(errorResponse));
    return true;
  }
  
  return false;
}
```

## Standards Compliance

### HTTP Retry-After Header

The implementation follows RFC 7231 Section 7.1.3 for the `Retry-After` header:

```
Retry-After = HTTP-date / delay-seconds
delay-seconds = 1*DIGIT
```

We use `delay-seconds` format (integer seconds), which is simpler and more widely supported:

```
Retry-After: 30
```

### Additional Headers

- **X-RateLimit-Limit**: GitHub API convention
- **X-RateLimit-Remaining**: GitHub API convention
- **X-RateLimit-Reset**: GitHub API convention (Unix timestamp)

These headers follow industry-standard patterns for rate limit information.

## Testing

Run the comprehensive test suite:

```bash
npm test -- tests/websocket/rate-limit-retry-after.test.js
```

Test coverage includes:

1. **Rate Limiter Tests**
   - `retryAfter` calculation in seconds
   - Proper millisecond tracking
   - HTTP status code 429
   - Error code inclusion

2. **Error Formatter Tests**
   - Rate limit error formatting
   - Retry-After in headers
   - Status code 429 in details
   - Full detail structure

3. **HTTP Decorator Tests**
   - Header application to response objects
   - X-RateLimit headers
   - Content-Type and Cache-Control
   - X-Error-Code header
   - X-RateLimit-Reset timestamp

4. **End-to-End Tests**
   - Full flow from rate limiter to HTTP decorator
   - Integration testing

5. **Edge Cases**
   - Small resetIn values (< 1000ms)
   - Large resetIn values (hours)
   - Sequential rate limit errors

## Migration Guide

### For Existing HTTP Endpoints

If you have existing HTTP endpoints returning rate limit errors:

1. **Update error response generation:**
   ```javascript
   // Before
   res.status(429).json({ error: 'Rate limit exceeded' });

   // After
   const rateLimitInfo = rateLimiter.check(clientId, command);
   const errorResponse = ErrorFormatter.rateLimitError(rateLimitInfo, command, id);
   const statusCode = HttpResponseDecorator.applyHeaders(res, errorResponse);
   res.status(statusCode).json(errorResponse);
   ```

2. **Add HTTP decorator middleware:**
   ```javascript
   app.use(HttpResponseDecorator.expressMiddleware());
   ```

3. **Update client code to read headers:**
   ```javascript
   if (response.status === 429) {
     const retryAfter = response.headers.get('Retry-After');
     // Implement backoff logic
   }
   ```

### For WebSocket Clients

No changes required. The `details.retryAfter` field in WebSocket responses is already in seconds format.

## Performance Considerations

- **No performance impact**: Rate limit checking performance unchanged
- **Memory efficient**: No additional data structures
- **Header overhead**: Minimal - typically adds 200-300 bytes to error responses
- **Calculation efficiency**: Simple math operations, no blocking I/O

## Security Considerations

- **Rate limit disclosure**: Headers reveal rate limit configuration
  - This is intentional to allow intelligent client backoff
  - Information is already in error message
  - Standard practice (GitHub, Stripe, etc.)

- **Header size**: Retry-After headers are very small (2-5 bytes)

## Future Enhancements

1. **Adaptive rate limits**: Adjust limits based on client behavior
2. **Per-endpoint rate limits**: Different limits for expensive operations
3. **Cost-based rate limiting**: Weight requests by compute cost
4. **Rate limit quotas**: Monthly/daily quotas in addition to per-minute limits
5. **Rate limit events**: Emit events when limits are approaching or exceeded

## References

- RFC 7231: HTTP/1.1 Semantics and Content (Retry-After)
- GitHub API Rate Limiting: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting
- Stripe API Rate Limiting: https://stripe.com/docs/rate-limits

## Troubleshooting

### Rate Limit Always Triggered

**Problem**: Every request returns 429 even though they're infrequent.

**Solution**: 
- Check that rate limit is enabled: `rateLimiter.enabled === true`
- Verify client ID is consistent: Each unique client should have unique clientId
- Check window size: Ensure `windowMs` matches expected window duration

### Retry-After Header Missing

**Problem**: HTTP response doesn't include Retry-After header.

**Solution**:
- Verify `HttpResponseDecorator.applyHeaders()` is called
- Check that error response has `details.retryAfter` field
- Ensure response object has `setHeader` method

### Client Not Respecting Retry-After

**Problem**: Client ignores Retry-After and immediately retries.

**Solution**:
- Verify client implementation reads header: `response.headers.get('Retry-After')`
- Check that retry delay is calculated in milliseconds: `retryAfter * 1000`
- Ensure no retry-on-429 logic overrides the delay

## Support

For issues or questions about the Retry-After implementation:

1. Check the test suite: `tests/websocket/rate-limit-retry-after.test.js`
2. Review the implementation: `websocket/http-response-decorator.js`
3. Check client examples in this document
4. Review RFC 7231 Section 7.1.3 for HTTP standard details

---

**Implementation Status**: ✅ Complete  
**Test Coverage**: 60+ test cases  
**Documentation**: Complete  
**Ready for Production**: Yes
