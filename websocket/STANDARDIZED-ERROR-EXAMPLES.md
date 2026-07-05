# Standardized WebSocket Error Response Examples

This document provides concrete examples of standardized error responses for the Basset Hound Browser WebSocket API. All error responses follow the unified schema defined in `/websocket/ERROR-SCHEMA.md`.

## Example 1: Missing Required Parameter (navigate command)

**Request:**
```json
{
  "id": "msg-123",
  "command": "navigate",
  "params": {}
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Required parameter 'url' is missing",
  "errorCode": "VALIDATION_MISSING_REQUIRED_PARAM",
  "command": "navigate",
  "id": "msg-123",
  "recoveryHint": "Check the command documentation and ensure all required parameters are provided.",
  "details": {
    "parameter": "url"
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'VALIDATION_MISSING_REQUIRED_PARAM') {
  const param = response.details.parameter;
  console.log(`Missing required parameter: ${param}`);
  // Prompt user for the parameter
}
```

---

## Example 2: Invalid Parameter Value (navigate command)

**Request:**
```json
{
  "id": "msg-124",
  "command": "navigate",
  "params": {
    "url": "not-a-valid-url"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid URL: Invalid URL",
  "errorCode": "VALIDATION_INVALID_PARAM_VALUE",
  "command": "navigate",
  "id": "msg-124",
  "recoveryHint": "Review the error details for the specific parameter that failed validation. Correct the value according to the specified constraints.",
  "details": {
    "parameter": "url",
    "provided": "not-a-valid-url",
    "expectedFormat": "Valid HTTP/HTTPS URL"
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'VALIDATION_INVALID_PARAM_VALUE') {
  const { parameter, expectedFormat } = response.details;
  console.log(`${parameter} should be: ${expectedFormat}`);
  // Show validation error to user
}
```

---

## Example 3: Payload Too Large

**Request:**
```json
{
  "id": "msg-125",
  "command": "screenshot",
  "params": {
    "large_binary_data": "..."  // 150 MB payload
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Request size 150.00 MB exceeds limit of 100.00 MB",
  "errorCode": "COMMAND_PAYLOAD_TOO_LARGE",
  "command": "screenshot",
  "id": "msg-125",
  "recoveryHint": "This command has a stricter size limit than others. Reduce the request size. Check error details for the specific limit.",
  "details": {
    "actual": 157286400,
    "limit": 104857600,
    "actualFormatted": "150.00 MB",
    "limitFormatted": "100.00 MB"
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'COMMAND_PAYLOAD_TOO_LARGE') {
  const { actual, limit, actualFormatted, limitFormatted } = response.details;
  console.log(`Payload ${actualFormatted} exceeds limit ${limitFormatted}`);
  // Split request or reduce data
}
```

---

## Example 4: Rate Limit Exceeded

**Request:**
```json
{
  "id": "msg-126",
  "command": "screenshot",
  "params": {}
}
```

**Error Response (106th screenshot in 60 seconds):**
```json
{
  "success": false,
  "error": "Rate limit exceeded for command 'screenshot'. Limit: 5 req/min. Retry in 45s",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "command": "screenshot",
  "id": "msg-126",
  "recoveryHint": "You have exceeded the rate limit for this command. Wait the specified time (see 'resetIn' in response details) before retrying. Consider spacing out requests or authenticating for higher limits.",
  "details": {
    "limit": 5,
    "current": 106,
    "remaining": 0,
    "resetIn": 45000,
    "retryAfter": 45,
    "authenticated": false
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'RATE_LIMIT_EXCEEDED') {
  const { retryAfter } = response.details;
  console.log(`Rate limited. Retry in ${retryAfter} seconds`);
  
  // Wait and retry
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  ws.send(originalRequest);
}
```

---

## Example 5: Authentication Required

**Request:**
```json
{
  "id": "msg-127",
  "command": "create_profile",
  "params": { "name": "test" }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Authentication required. Send authenticate command with token.",
  "errorCode": "AUTH_REQUIRED",
  "command": "create_profile",
  "id": "msg-127",
  "recoveryHint": "Send an 'authenticate' command with a valid authentication token before retrying this command."
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'AUTH_REQUIRED') {
  // Authenticate first
  ws.send({
    id: 'auth-001',
    command: 'authenticate',
    params: { token: 'your-token' }
  });
  
  // Retry the original request after authentication
  // (after receiving successful auth response)
}
```

---

## Example 6: Command Execution Error

**Request:**
```json
{
  "id": "msg-128",
  "command": "click",
  "params": {
    "selector": "#nonexistent-element"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error executing command 'click': Element not found",
  "errorCode": "COMMAND_EXECUTION_ERROR",
  "command": "click",
  "id": "msg-128",
  "recoveryHint": "An error occurred while executing the command. Check the error message for details. Verify the state of the browser and try again.",
  "details": {
    "originalError": "Element not found"
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'COMMAND_EXECUTION_ERROR') {
  const { originalError } = response.details;
  console.log(`Execution failed: ${originalError}`);
  // Check selector, retry, or adjust strategy
}
```

---

## Example 7: Command Timeout

**Request:**
```json
{
  "id": "msg-129",
  "command": "navigate",
  "params": {
    "url": "https://slow-website.com",
    "timeout": 5000
  }
}
```

**Error Response (navigation took 5.2 seconds):**
```json
{
  "success": false,
  "error": "Command 'navigate' exceeded timeout of 5000ms",
  "errorCode": "COMMAND_TIMED_OUT",
  "command": "navigate",
  "id": "msg-129",
  "recoveryHint": "The command execution took too long and exceeded the timeout. Try again with a longer timeout value or with a simpler request (e.g., smaller page).",
  "details": {
    "timeout": 5000,
    "elapsedTime": 5200
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'COMMAND_TIMED_OUT') {
  const { timeout, elapsedTime } = response.details;
  console.log(`Timeout exceeded: ${elapsedTime}ms > ${timeout}ms`);
  
  // Retry with longer timeout
  ws.send({
    id: 'msg-130',
    command: 'navigate',
    params: {
      url: params.url,
      timeout: 15000  // Increase timeout
    }
  });
}
```

---

## Example 8: Concurrent Operation Limit Exceeded

**Request:**
```json
{
  "id": "msg-131",
  "command": "navigate",
  "params": { "url": "https://example.com" }
}
```

**Error Response (10 concurrent operations already active):**
```json
{
  "success": false,
  "error": "Concurrent operation limit exceeded. Current: 10/10",
  "errorCode": "CONCURRENT_LIMIT_EXCEEDED",
  "command": "navigate",
  "id": "msg-131",
  "recoveryHint": "You have too many concurrent operations. Wait for current operations to complete or consider using a connection pool.",
  "details": {
    "current": 10,
    "max": 10,
    "activeOperations": [
      "navigate",
      "screenshot",
      "execute_script",
      "wait_for_element",
      "navigate",
      "screenshot",
      "click",
      "fill",
      "navigate",
      "get_content"
    ]
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'CONCURRENT_LIMIT_EXCEEDED') {
  const { current, max, activeOperations } = response.details;
  console.log(`Too many concurrent ops: ${current}/${max}`);
  console.log(`Active: ${activeOperations.join(', ')}`);
  
  // Wait for operations to complete
  await waitForOperationCompletion();
  ws.send(originalRequest);
}
```

---

## Example 9: Browser Navigation Failed

**Request:**
```json
{
  "id": "msg-132",
  "command": "navigate",
  "params": {
    "url": "https://unreachable-site.invalid"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Browser error: net::ERR_NAME_NOT_RESOLVED",
  "errorCode": "BROWSER_NAVIGATION_FAILED",
  "command": "navigate",
  "id": "msg-132",
  "recoveryHint": "The browser failed to navigate to the URL. Verify that the URL is valid, the target site is accessible, and network connectivity is available.",
  "details": {
    "reason": "net::ERR_NAME_NOT_RESOLVED"
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'BROWSER_NAVIGATION_FAILED') {
  const { reason } = response.details;
  console.log(`Navigation failed: ${reason}`);
  
  // Check URL, network connectivity
  if (reason.includes('ERR_NAME_NOT_RESOLVED')) {
    console.log('Domain name resolution failed. Check domain name.');
  }
}
```

---

## Example 10: Script Execution Error

**Request:**
```json
{
  "id": "msg-133",
  "command": "execute_script",
  "params": {
    "script": "return invalid javascript here }"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Script execution error: SyntaxError: Unexpected token '}' at position 30",
  "errorCode": "SCRIPT_SYNTAX_ERROR",
  "command": "execute_script",
  "id": "msg-133",
  "recoveryHint": "The JavaScript script has a syntax error. Review the script for correct JavaScript syntax and try again.",
  "details": {
    "syntaxError": true
  }
}
```

**Client Handling:**
```javascript
if (response.errorCode === 'SCRIPT_SYNTAX_ERROR') {
  console.log(`Syntax error in script: ${response.error}`);
  // Show user the syntax error and request code review
}
```

---

## General Error Response Validation

Always validate incoming error responses:

```javascript
function validateErrorResponse(response) {
  const requiredFields = ['success', 'error', 'errorCode', 'command', 'id', 'recoveryHint'];
  
  for (const field of requiredFields) {
    if (!(field in response)) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }
  
  if (typeof response.success !== 'boolean') {
    console.error('success must be boolean');
    return false;
  }
  
  if (!response.errorCode.match(/^[A-Z_]+$/)) {
    console.error('errorCode must be UPPERCASE_SNAKE_CASE');
    return false;
  }
  
  return true;
}

ws.on('message', (messageData) => {
  const response = JSON.parse(messageData);
  
  if (!response.success) {
    if (!validateErrorResponse(response)) {
      console.error('Invalid error response format:', response);
      return;
    }
    
    // Handle error using errorCode
    handleError(response);
  }
});
```

---

## HTTP Status Code Mapping

For REST gateway implementations, map error codes to HTTP status codes:

| Error Code | HTTP Status |
|-----------|------------|
| VALIDATION_* | 400 Bad Request |
| AUTH_* | 401 Unauthorized |
| AUTH_INSUFFICIENT_PERMISSIONS | 403 Forbidden |
| RATE_LIMIT_* | 429 Too Many Requests |
| COMMAND_PAYLOAD_TOO_LARGE | 413 Payload Too Large |
| RESOURCE_NOT_FOUND | 404 Not Found |
| COMMAND_TIMED_OUT | 504 Gateway Timeout |
| BROWSER_TIMEOUT | 504 Gateway Timeout |
| SYSTEM_* | 500 Internal Server Error |
| COMMAND_EXECUTION_ERROR | 500 Internal Server Error |

---

## Implementation Checklist

- [x] All error responses use `success: false`
- [x] All error responses include `errorCode` (UPPERCASE_SNAKE_CASE)
- [x] All error responses include human-readable `error` message
- [x] All error responses include `recoveryHint` guidance
- [x] Error details are in `details` object only
- [x] Command name is always included
- [x] Message ID is preserved for correlation
- [x] Recovery hints match the error code
- [x] HTTP status codes are mappable from error codes

---

## Related Files

- `/websocket/ERROR-SCHEMA.md` - Full error schema specification
- `/websocket/ERROR-RECOVERY-HINTS.json` - Recovery hints for all error codes
- `/websocket/error-formatter.js` - ErrorFormatter utility class
- `/websocket/server.js` - _sendResponse() and _standardizeErrorResponse() implementation
