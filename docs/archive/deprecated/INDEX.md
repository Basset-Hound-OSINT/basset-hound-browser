# API Documentation Index

**Last Updated:** May 11, 2026  
**Version:** 11.3.0

---

## Overview

This directory contains API documentation and reference materials for integrating with Basset Hound Browser.

---

## WebSocket API

### Complete Reference
- See `/docs/API-REFERENCE.md` for complete 164-command documentation:
  - Navigation commands
  - Extraction commands
  - Interaction commands
  - Evasion commands
  - Session management
  - Recording commands
  - And more...

### Command Categories
- **Navigation:** 15+ commands
- **Extraction:** 20+ commands
- **Interaction:** 15+ commands
- **Evasion:** 30+ commands
- **Proxy:** 10+ commands
- **Recording:** 10+ commands
- **Session:** 15+ commands
- **Analysis:** 20+ commands

---

## Protocol Specification

### Message Format
```json
{
  "id": "unique-request-id",
  "command": "command-name",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

### Response Format
```json
{
  "id": "request-id",
  "status": "success",
  "result": {...},
  "timestamp": 1620000000000
}
```

### Error Format
```json
{
  "id": "request-id",
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

---

## Client Libraries

### Node.js Client
- WebSocket-based
- Promise-based API
- Event handling
- Connection management

### Python Client
- Socket-based
- Async support
- Wrapper utilities
- Example scripts

### CLI Client
- Command-line interface
- Script automation
- Batch operations

---

## Integration Examples

### Basic Navigation
```javascript
ws.send(JSON.stringify({
  id: '1',
  command: 'navigate',
  params: { url: 'https://example.com' }
}));
```

### Content Extraction
```javascript
ws.send(JSON.stringify({
  id: '2',
  command: 'getText',
  params: { selector: 'body' }
}));
```

### Screenshot Capture
```javascript
ws.send(JSON.stringify({
  id: '3',
  command: 'screenshot',
  params: { format: 'png' }
}));
```

---

## Error Codes

### Common Error Codes
- `COMMAND_NOT_FOUND` - Command doesn't exist
- `INVALID_PARAMS` - Parameter format error
- `TIMEOUT` - Operation timeout
- `BROWSER_ERROR` - Browser error
- `NETWORK_ERROR` - Network error
- `RESOURCE_EXHAUSTED` - Resource limit exceeded

---

## Performance Specifications

### Response Times
- **Navigation:** <100ms typical
- **Click:** <50ms typical
- **Screenshot:** <200ms typical
- **Extract Text:** <50ms typical
- **99th percentile:** <500ms

### Throughput
- **Throughput:** 100+ commands/sec
- **Concurrent Connections:** 1000+
- **Connection Overhead:** <100 MB each

---

## Security

### Authentication
- Token-based (optional)
- Rate limiting
- IP whitelisting (optional)

### Data Protection
- TLS encryption
- Credential handling
- Secret management

---

## Status Codes

### Success Codes
- `200` - OK
- `201` - Created
- `204` - No Content

### Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `408` - Timeout
- `429` - Too Many Requests
- `500` - Server Error

---

## Rate Limiting

### Default Limits
- 100 requests per second
- 10,000 requests per minute
- 1,000,000 requests per hour

### Exceeding Limits
- Returns 429 status
- Retry-After header provided
- Exponential backoff recommended

---

## Versioning

### Current Version
- **API Version:** 11.3.0
- **WebSocket Protocol:** 1.0

### Backward Compatibility
- All v11.x compatible
- Deprecated commands listed
- Migration guides provided

---

## References

- `/docs/API-REFERENCE.md` - Complete API documentation
- `/docs/integration/` - Integration guides
- `/docs/SCOPE.md` - Architectural boundaries
- `tests/integration/` - Example code

---

**Status:** ✅ Current  
**Last Updated:** May 11, 2026  
**API Version:** 11.3.0  
**Maintained By:** Development Team
