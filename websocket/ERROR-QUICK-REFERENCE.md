# WebSocket Error Response - Quick Reference Guide

## Updated _sendResponse() Method

```javascript
/**
 * Send a response to a WebSocket client
 * Handles serialization, error recovery, and standardized error response format
 *
 * Features:
 * - Enforces standardized error response schema for all error responses
 * - Validates error responses before sending
 * - Maintains backward compatibility for success responses
 * - Includes recovery hints for error codes
 */
_sendResponse(ws, responseData, templateName = null) {
  // Validate and standardize error responses
  if (responseData.success === false) {
    // This is an error response - ensure it conforms to the standard schema
    const standardizedError = this._standardizeErrorResponse(responseData);
    responseData = standardizedError;
  }

  try {
    if (this.responseSerializer) {
      const serialized = this.responseSerializer.serialize(responseData, templateName);
      ws.send(serialized);
    } else {
      ws.send(JSON.stringify(responseData));
    }
  } catch (error) {
    this.logger.error('[ErrorResponse] Error sending response', {
      error: error.message,
      clientId: ws.clientId
    });
    // Attempt fallback send
    try {
      ws.send(JSON.stringify(responseData));
    } catch (fallbackError) {
      this.logger.error('[ErrorResponse] Failed to send response via fallback', {
        error: fallbackError.message
      });
    }
  }
}

/**
 * Standardize an error response to conform to the unified error schema
 */
_standardizeErrorResponse(errorResponse) {
  const standardized = {
    success: false,
    error: errorResponse.error || 'An error occurred',
    errorCode: errorResponse.errorCode || 'SYSTEM_INTERNAL_ERROR',
    command: errorResponse.command || 'unknown',
    id: errorResponse.id === undefined ? null : errorResponse.id,
    recoveryHint: errorResponse.recoveryHint || this._getRecoveryHint(errorResponse.errorCode)
  };

  if (errorResponse.details && Object.keys(errorResponse.details).length > 0) {
    standardized.details = errorResponse.details;
  }

  const validation = ErrorFormatter.validateErrorResponse(standardized);
  if (!validation.valid) {
    this.logger.warn('[ErrorResponse] Validation failed', { errors: validation.errors });
  }

  return standardized;
}

/**
 * Get recovery hint for an error code
 */
_getRecoveryHint(errorCode) {
  try {
    if (!this._recoveryHints) {
      const hintsPath = path.join(__dirname, 'ERROR-RECOVERY-HINTS.json');
      const content = fs.readFileSync(hintsPath, 'utf8');
      this._recoveryHints = JSON.parse(content);
    }

    const hint = this._recoveryHints[errorCode];
    return hint ? hint.hint : 'Please check the error details and try again.';
  } catch (error) {
    this.logger.debug('[ErrorResponse] Failed to load recovery hints', { errorCode });
    return 'Please check the error details and try again.';
  }
}
```

---

## ErrorFormatter Usage Examples

### Missing Parameter
```javascript
return ErrorFormatter.missingParameterError('url', 'navigate');
// Returns:
// {
//   success: false,
//   error: "Required parameter 'url' is missing",
//   errorCode: 'VALIDATION_MISSING_REQUIRED_PARAM',
//   command: 'navigate',
//   id: null,
//   recoveryHint: "Check the command documentation..."
// }
```

### Invalid Parameter Value
```javascript
return ErrorFormatter.validationError(
  'Invalid URL: Invalid URL',
  'navigate',
  null,
  { parameter: 'url', provided: 'not-a-url', expectedFormat: 'Valid HTTP/HTTPS URL' }
);
// Returns:
// {
//   success: false,
//   error: "Invalid URL: Invalid URL",
//   errorCode: 'VALIDATION_INVALID_PARAM_VALUE',
//   command: 'navigate',
//   id: null,
//   recoveryHint: "Review the error details...",
//   details: { parameter: 'url', ... }
// }
```

### Rate Limit Exceeded
```javascript
return ErrorFormatter.rateLimitError(rateLimitInfo, 'screenshot', 'msg-123');
// Returns:
// {
//   success: false,
//   error: "Rate limit exceeded for command 'screenshot'...",
//   errorCode: 'RATE_LIMIT_EXCEEDED',
//   command: 'screenshot',
//   id: 'msg-123',
//   recoveryHint: "You have exceeded the rate limit...",
//   details: {
//     limit: 5,
//     current: 106,
//     remaining: 0,
//     resetIn: 45000,
//     retryAfter: 45,
//     authenticated: false
//   }
// }
```

### Payload Too Large
```javascript
return ErrorFormatter.payloadTooLargeError(
  157286400,        // actual size
  104857600,        // limit
  'screenshot',
  'msg-125',
  true              // isCommandLimit
);
// Returns:
// {
//   success: false,
//   error: "Request size 150.00 MB exceeds limit of 100.00 MB",
//   errorCode: 'COMMAND_PAYLOAD_TOO_LARGE',
//   command: 'screenshot',
//   id: 'msg-125',
//   recoveryHint: "This command has a stricter size limit...",
//   details: {
//     actual: 157286400,
//     limit: 104857600,
//     actualFormatted: "150.00 MB",
//     limitFormatted: "100.00 MB"
//   }
// }
```

### Command Execution Error
```javascript
try {
  // ... execution logic
} catch (error) {
  return ErrorFormatter.commandExecutionError('click', error);
}
// Returns:
// {
//   success: false,
//   error: "Error executing command 'click': Element not found",
//   errorCode: 'COMMAND_EXECUTION_ERROR',
//   command: 'click',
//   id: null,
//   recoveryHint: "An error occurred while executing...",
//   details: { originalError: "Element not found" }
// }
```

### Command Timeout
```javascript
return ErrorFormatter.commandTimeoutError('navigate', 5000, 'msg-129', 5200);
// Returns:
// {
//   success: false,
//   error: "Command 'navigate' exceeded timeout of 5000ms",
//   errorCode: 'COMMAND_TIMED_OUT',
//   command: 'navigate',
//   id: 'msg-129',
//   recoveryHint: "The command execution took too long...",
//   details: { timeout: 5000, elapsedTime: 5200 }
// }
```

### Authentication Required
```javascript
return ErrorFormatter.authRequiredError('create_profile', 'msg-127');
// Returns:
// {
//   success: false,
//   error: "Authentication required. Send authenticate command with token.",
//   errorCode: 'AUTH_REQUIRED',
//   command: 'create_profile',
//   id: 'msg-127',
//   recoveryHint: "Send an 'authenticate' command..."
// }
```

### Concurrency Limit Exceeded
```javascript
return ErrorFormatter.concurrencyLimitError(
  { current: 10, max: 10, activeOperations: ['navigate', 'screenshot'] },
  'navigate',
  'msg-131'
);
// Returns:
// {
//   success: false,
//   error: "Concurrent operation limit exceeded. Current: 10/10",
//   errorCode: 'CONCURRENT_LIMIT_EXCEEDED',
//   command: 'navigate',
//   id: 'msg-131',
//   recoveryHint: "You have too many concurrent operations...",
//   details: { current: 10, max: 10, activeOperations: [...] }
// }
```

### Browser Error
```javascript
return ErrorFormatter.browserError('net::ERR_NAME_NOT_RESOLVED', 'navigate', 'msg-132');
// Returns:
// {
//   success: false,
//   error: "Browser error: net::ERR_NAME_NOT_RESOLVED",
//   errorCode: 'BROWSER_NAVIGATION_FAILED',  // auto-detected
//   command: 'navigate',
//   id: 'msg-132',
//   recoveryHint: "The browser failed to navigate...",
//   details: { reason: 'net::ERR_NAME_NOT_RESOLVED' }
// }
```

### Script Error
```javascript
try {
  await executeScript(code);
} catch (error) {
  return ErrorFormatter.scriptError(error.message, 'execute_script');
}
// Returns:
// {
//   success: false,
//   error: "Script execution error: SyntaxError: ...",
//   errorCode: 'SCRIPT_SYNTAX_ERROR',  // auto-detected for syntax errors
//   command: 'execute_script',
//   id: null,
//   recoveryHint: "The JavaScript script has a syntax error..."
// }
```

---

## Standard Error Response Structure

### Required Fields (Always Present)
```javascript
{
  success: false,           // Boolean - Always false for errors
  error: "...",            // String - Human-readable error message
  errorCode: "...",        // String - UPPERCASE_SNAKE_CASE error code
  command: "...",          // String - Name of the command that failed
  id: "..." or null,       // String or null - Request message ID
  recoveryHint: "..."      // String - Guidance for user
}
```

### Optional Fields (Include if Applicable)
```javascript
{
  details: {               // Object - Additional context (only if non-empty)
    // Contents vary by error type
    // Examples: parameter, limit, current, retryAfter, etc.
  }
}
```

---

## Error Code Quick Reference

| Category | Code | When | Retryable |
|----------|------|------|-----------|
| **Validation** | `VALIDATION_MISSING_REQUIRED_PARAM` | Missing parameter | No |
| | `VALIDATION_INVALID_PARAM_VALUE` | Bad parameter value | No |
| | `VALIDATION_INVALID_PARAM_TYPE` | Wrong parameter type | No |
| | `VALIDATION_MALFORMED_JSON` | Invalid JSON | No |
| **Payload** | `PAYLOAD_TOO_LARGE` | Request > 100MB | Yes |
| | `COMMAND_PAYLOAD_TOO_LARGE` | Request > command limit | Yes |
| **Auth** | `AUTH_REQUIRED` | Not authenticated | Yes |
| | `AUTH_INVALID_TOKEN` | Bad token | Yes |
| | `AUTH_INSUFFICIENT_PERMISSIONS` | No permission | No |
| **Rate Limit** | `RATE_LIMIT_EXCEEDED` | Too many requests | Yes |
| | `CONCURRENT_LIMIT_EXCEEDED` | Too many concurrent ops | Yes |
| **Command** | `COMMAND_NOT_FOUND` | Unknown command | No |
| | `COMMAND_TIMED_OUT` | Execution too slow | Yes |
| | `COMMAND_EXECUTION_ERROR` | Execution failed | Yes |
| **Browser** | `BROWSER_NAVIGATION_FAILED` | Navigation error | Yes |
| | `BROWSER_TIMEOUT` | Browser slow | Yes |
| | `BROWSER_NOT_READY` | Browser not initialized | Yes |
| **Script** | `SCRIPT_SYNTAX_ERROR` | Invalid JavaScript | No |
| | `SCRIPT_EXECUTION_ERROR` | Script failed | No |
| | `SCRIPT_TIMEOUT` | Script too slow | Yes |
| **System** | `SYSTEM_INTERNAL_ERROR` | Unexpected error | Yes |
| | `SYSTEM_OUT_OF_MEMORY` | Memory exhausted | Yes |
| | `SYSTEM_BROWSER_CRASH` | Browser crashed | Yes |

---

## Implementation Checklist for New Handlers

When implementing a new command handler:

### 1. Parameter Validation
```javascript
if (!requiredParam) {
  return ErrorFormatter.missingParameterError('paramName', 'commandName');
}
```

### 2. Value Validation
```javascript
try {
  validateValue(param);
} catch (error) {
  return ErrorFormatter.validationError(
    error.message,
    'commandName',
    null,
    { parameter: 'paramName', provided: param, expectedFormat: '...' }
  );
}
```

### 3. Execution Error Handling
```javascript
try {
  const result = await executeCommand();
  return { success: true, data: result };
} catch (error) {
  return ErrorFormatter.commandExecutionError('commandName', error);
}
```

### 4. Timeout Handling
```javascript
try {
  const result = await withTimeout(operation(), timeout);
  return { success: true, data: result };
} catch (error) {
  if (error.code === 'TIMEOUT') {
    return ErrorFormatter.commandTimeoutError('commandName', timeout);
  }
  return ErrorFormatter.commandExecutionError('commandName', error);
}
```

---

## Client Integration Examples

### Error Code Based Routing
```javascript
ws.on('message', (msg) => {
  const response = JSON.parse(msg);
  
  if (!response.success) {
    switch (response.errorCode) {
      case 'RATE_LIMIT_EXCEEDED':
        const waitTime = response.details.retryAfter;
        setTimeout(() => retryRequest(), waitTime * 1000);
        break;
      
      case 'AUTH_REQUIRED':
        authenticate().then(() => retryRequest());
        break;
      
      case 'VALIDATION_INVALID_PARAM_VALUE':
        showValidationError(response.details);
        break;
      
      case 'COMMAND_TIMED_OUT':
        retryWithLongerTimeout();
        break;
      
      default:
        showError(response.error, response.recoveryHint);
    }
  }
});
```

### Automatic Retry Logic
```javascript
async function requestWithRetry(ws, request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await sendRequest(ws, request);
    
    if (response.success) {
      return response;
    }
    
    if (!ErrorFormatter.isRetryable(response.errorCode)) {
      throw new Error(`${response.error} (${response.errorCode})`);
    }
    
    if (response.errorCode === 'RATE_LIMIT_EXCEEDED') {
      await wait(response.details.retryAfter * 1000);
    } else {
      await wait(Math.pow(2, i) * 1000);  // Exponential backoff
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `/websocket/ERROR-SCHEMA.md` | Complete specification and guidelines |
| `/websocket/ERROR-RECOVERY-HINTS.json` | Error code to recovery hint mapping |
| `/websocket/error-formatter.js` | ErrorFormatter utility class |
| `/websocket/STANDARDIZED-ERROR-EXAMPLES.md` | Real-world examples |
| `/websocket/server.js` | Server integration and _sendResponse() |
| `/websocket/ERROR-QUICK-REFERENCE.md` | This file |

---

## Summary

All WebSocket error responses now follow a standardized schema with:
- Machine-readable error codes
- Recovery hints for user guidance
- Consistent field structure
- Detailed error context
- Client-friendly parsing

Use `ErrorFormatter` utility methods for all new error responses.
