# WebSocket Error Response Schema

## Standard Error Response Format

All error responses from the Basset Hound Browser WebSocket API follow this standardized schema:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "errorCode": "MACHINE_READABLE_CODE",
  "command": "commandName",
  "id": "msg-123",
  "recoveryHint": "What the user should do to recover",
  "details": {}
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `false` for error responses |
| `error` | string | Yes | Human-readable error message (100-200 chars recommended) |
| `errorCode` | string | Yes | Machine-readable error code (UPPERCASE_SNAKE_CASE) |
| `command` | string | Yes | Name of the command that failed |
| `id` | string | Yes | Message ID from the request (for correlation) |
| `recoveryHint` | string | Yes | Specific guidance on how to recover from this error |
| `details` | object | No | Additional error context (varies by error type) |

### Success Field Behavior

The `success` field serves as the primary indicator:
- **Success responses:** `success: true`
- **Error responses:** `success: false`
- External clients should check this field first

## Error Code Taxonomy

Error codes follow UPPERCASE_SNAKE_CASE and are categorized by type:

### Validation Errors (VALIDATION_*)
| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_MISSING_REQUIRED_PARAM` | 400 | Required parameter is missing |
| `VALIDATION_INVALID_PARAM_TYPE` | 400 | Parameter type is incorrect |
| `VALIDATION_INVALID_PARAM_VALUE` | 400 | Parameter value is invalid (bad URL, out of range, etc.) |
| `VALIDATION_CONFLICTING_PARAMS` | 400 | Parameters conflict with each other |
| `VALIDATION_MALFORMED_JSON` | 400 | Request JSON is malformed |

### Payload Errors (PAYLOAD_*)
| Code | HTTP | Description |
|------|------|-------------|
| `PAYLOAD_TOO_LARGE` | 413 | Request size exceeds global limit |
| `COMMAND_PAYLOAD_TOO_LARGE` | 413 | Request size exceeds command-specific limit |

### Authentication & Authorization (AUTH_*)
| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required but not provided |
| `AUTH_INVALID_TOKEN` | 401 | Authentication token is invalid or expired |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | Authenticated but lacks permission for this command |
| `AUTH_SESSION_EXPIRED` | 401 | Authentication session has expired |

### Rate Limiting (RATE_LIMIT_*)
| Code | HTTP | Description |
|------|------|-------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests for this command |
| `RATE_LIMIT_BURST_EXCEEDED` | 429 | Burst allowance exceeded even within rate limit window |
| `CONCURRENT_LIMIT_EXCEEDED` | 429 | Too many concurrent operations from this client |

### Command Execution (COMMAND_*)
| Code | HTTP | Description |
|------|------|-------------|
| `COMMAND_NOT_FOUND` | 404 | Command is not recognized |
| `COMMAND_DISABLED` | 403 | Command is disabled or not available |
| `COMMAND_TIMED_OUT` | 504 | Command execution exceeded timeout |
| `COMMAND_EXECUTION_ERROR` | 500 | General command execution failure |

### Resource Errors (RESOURCE_*)
| Code | HTTP | Description |
|------|------|-------------|
| `RESOURCE_NOT_FOUND` | 404 | Referenced resource (profile, session, etc.) not found |
| `RESOURCE_UNAVAILABLE` | 503 | Resource temporarily unavailable |
| `RESOURCE_LOCKED` | 423 | Resource is locked by another operation |
| `RESOURCE_ALREADY_EXISTS` | 409 | Cannot create resource that already exists |

### System Errors (SYSTEM_*)
| Code | HTTP | Description |
|------|------|-------------|
| `SYSTEM_INTERNAL_ERROR` | 500 | Unexpected internal error |
| `SYSTEM_OUT_OF_MEMORY` | 503 | System out of memory |
| `SYSTEM_BROWSER_CRASH` | 503 | Browser process crashed or unresponsive |
| `SYSTEM_CONFIGURATION_ERROR` | 500 | System configuration is invalid |

### Browser/Navigation Errors (BROWSER_*)
| Code | HTTP | Description |
|------|------|-------------|
| `BROWSER_NAVIGATION_FAILED` | 400 | URL navigation failed |
| `BROWSER_TIMEOUT` | 504 | Browser operation timed out |
| `BROWSER_NOT_READY` | 503 | Browser is not ready for this operation |
| `BROWSER_NETWORK_ERROR` | 503 | Network error during navigation |

### Script Execution Errors (SCRIPT_*)
| Code | HTTP | Description |
|------|------|-------------|
| `SCRIPT_EXECUTION_ERROR` | 400 | JavaScript execution failed |
| `SCRIPT_SYNTAX_ERROR` | 400 | Script has invalid syntax |
| `SCRIPT_TIMEOUT` | 504 | Script execution exceeded timeout |

### Storage/Session Errors (STORAGE_*)
| Code | HTTP | Description |
|------|------|-------------|
| `STORAGE_OPERATION_FAILED` | 500 | Storage operation (cookie, localStorage, etc.) failed |
| `STORAGE_QUOTA_EXCEEDED` | 413 | Storage quota exceeded |

## Recovery Hints

Each error code has an associated recovery hint that guides users:

### Example Recovery Hints

```javascript
{
  "VALIDATION_MISSING_REQUIRED_PARAM": "Check the command documentation and ensure all required parameters are provided.",
  "PAYLOAD_TOO_LARGE": "Reduce the payload size or split the request into smaller chunks.",
  "RATE_LIMIT_EXCEEDED": "Wait {retryAfter} seconds before retrying. Consider reducing request frequency.",
  "AUTH_REQUIRED": "Send an 'authenticate' command with a valid token before retrying.",
  "COMMAND_TIMED_OUT": "The operation took too long. Try again with a longer timeout or smaller data set.",
  "BROWSER_NAVIGATION_FAILED": "Check that the URL is valid and the target site is accessible.",
  "SCRIPT_EXECUTION_ERROR": "Review the script for syntax errors or runtime exceptions."
}
```

## Details Field Examples

The `details` field provides additional context specific to the error:

### Rate Limit Error
```json
{
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "current": 105,
    "remaining": 0,
    "resetIn": 45000,
    "retryAfter": 45
  }
}
```

### Validation Error
```json
{
  "errorCode": "VALIDATION_INVALID_PARAM_VALUE",
  "details": {
    "parameter": "url",
    "provided": "not-a-url",
    "expectedFormat": "Valid HTTP/HTTPS URL",
    "example": "https://example.com"
  }
}
```

### Timeout Error
```json
{
  "errorCode": "COMMAND_TIMED_OUT",
  "details": {
    "timeout": 10000,
    "command": "navigate",
    "elapsedTime": 10150
  }
}
```

### Concurrent Operation Error
```json
{
  "errorCode": "CONCURRENT_LIMIT_EXCEEDED",
  "details": {
    "current": 10,
    "max": 10,
    "clientId": "client-123",
    "activOperations": ["navigate", "screenshot", "execute_script"]
  }
}
```

## Client Implementation Guidelines

### Parsing Errors Reliably

**Correct approach:**
```javascript
const response = JSON.parse(message);

if (!response.success) {
  const errorCode = response.errorCode;
  const recoveryHint = response.recoveryHint;
  
  switch (errorCode) {
    case 'RATE_LIMIT_EXCEEDED':
      wait(response.details.retryAfter * 1000);
      retry();
      break;
    case 'AUTH_REQUIRED':
      authenticate();
      retry();
      break;
    default:
      log(`Error: ${response.error}`);
  }
}
```

**Avoid pattern matching on error strings:**
```javascript
// DON'T DO THIS - fragile and breaks with message changes
if (response.error.includes('Rate limit')) { ... }
```

### Error Response Validation

External clients should validate error responses:
```javascript
function isValidErrorResponse(response) {
  return (
    response.success === false &&
    typeof response.error === 'string' &&
    typeof response.errorCode === 'string' &&
    typeof response.command === 'string' &&
    (response.id === null || typeof response.id === 'string') &&
    typeof response.recoveryHint === 'string'
  );
}
```

## Versioning

- **Schema Version:** 1.0
- **Last Updated:** June 21, 2026
- **Stability:** STABLE - No breaking changes planned
- **Deprecation:** Error codes are never removed; new codes are added as needed

## Changes from Previous Format

### Pre-Standardization Errors
- Some responses had `errorCode`, others didn't
- Error messages varied in format and detail
- No recovery hints provided
- Inconsistent field naming across different error types

### Standardized Format Benefits
- All error responses have consistent structure
- Machine-readable error codes enable reliable parsing
- Recovery hints guide users to resolution
- Additional details enable debugging and logging
- Compatible with monitoring and alerting systems

## Related Documentation

- `/websocket/ERROR-RECOVERY-HINTS.json` - Complete error code to recovery hint mapping
- `/websocket/server.js` - _sendResponse() method implementation
- `/websocket/request-validator.js` - Validation error generation
- `/websocket/rate-limiter.js` - Rate limit error generation
