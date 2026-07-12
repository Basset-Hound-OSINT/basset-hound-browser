# JSON Schema Validation System for WebSocket Commands

## Quick Overview

A comprehensive validation system for all 140+ WebSocket commands that provides:

- **Field-level validation** with specific error types
- **Helpful error messages** with recovery suggestions
- **Type checking** - ensures parameters are correct types
- **Range validation** - numbers within acceptable ranges
- **Pattern validation** - URLs, formats, etc.
- **Enum validation** - values from allowed lists
- **Clear documentation** for all commands

## Files

| File | Purpose |
|------|---------|
| `/websocket/command-schemas.js` | JSON Schema definitions for all 140+ commands |
| `/websocket/command-validator.js` | Validation engine with error formatting |
| `/websocket/validation-middleware.js` | Integration middleware for server.js |
| `/docs/VALIDATION-INTEGRATION-GUIDE.md` | Complete integration guide with examples |
| `/tests/unit/command-validator.test.js` | Comprehensive unit tests (100+ test cases) |
| `/tests/unit/validation-examples.js` | Runnable examples demonstrating validation |
| `/examples/validation-usage.js` | Practical usage examples |

## 5 Example Schemas

### 1. Navigate Command
```javascript
{
  command: 'navigate',
  required: ['url'],
  properties: {
    url: { type: 'string', pattern: '^https?://', minLength: 10, maxLength: 2048 },
    timeout: { type: 'number', default: 10000, minimum: 1000, maximum: 600000 }
  }
}
```

**Valid:** `{ command: 'navigate', url: 'https://example.com' }`  
**Invalid:** `{ command: 'navigate', timeout: 5000 }` → Missing required `url`

### 2. Click Command
```javascript
{
  command: 'click',
  required: ['selector'],
  properties: {
    selector: { type: 'string', minLength: 1, maxLength: 1024 },
    button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
    delay: { type: 'number', default: 0, minimum: 0, maximum: 60000 }
  }
}
```

**Valid:** `{ command: 'click', selector: 'button.submit', button: 'left' }`  
**Invalid:** `{ command: 'click', selector: 'button', button: 'double-click' }` → Invalid enum value

### 3. Screenshot Command
```javascript
{
  command: 'screenshot',
  required: [],
  properties: {
    quality: { type: 'number', default: 90, minimum: 0, maximum: 100 },
    format: { type: 'string', enum: ['png', 'jpeg', 'jpg'], default: 'png' }
  }
}
```

**Valid:** `{ command: 'screenshot', quality: 90, format: 'png' }`  
**Invalid:** `{ command: 'screenshot', quality: 150 }` → Value exceeds maximum (100)

### 4. Fill Command
```javascript
{
  command: 'fill',
  required: ['selector', 'text'],
  properties: {
    selector: { type: 'string', minLength: 1, maxLength: 1024 },
    text: { type: 'string', maxLength: 100000 },
    delay: { type: 'number', default: 0, minimum: 0, maximum: 1000 }
  }
}
```

**Valid:** `{ command: 'fill', selector: 'input#email', text: 'user@example.com' }`  
**Invalid:** `{ command: 'fill', selector: 'input#email' }` → Missing required `text`

### 5. Set Proxy Command
```javascript
{
  command: 'setProxy',
  required: ['host', 'port'],
  properties: {
    host: { type: 'string', minLength: 1, maxLength: 256 },
    port: { type: 'number', minimum: 1, maximum: 65535 },
    proxyType: { type: 'string', enum: ['http', 'https', 'socks4', 'socks5'], default: 'http' }
  }
}
```

**Valid:** `{ command: 'setProxy', host: 'proxy.example.com', port: 8080 }`  
**Invalid:** `{ command: 'setProxy', host: 'proxy.example.com', port: 70000 }` → Port exceeds maximum (65535)

## Validation Error Example

Invalid request:
```json
{
  "command": "navigate",
  "timeout": 30000
}
```

Error response:
```json
{
  "success": false,
  "error": "INVALID_PARAMETERS",
  "message": "Invalid parameters for command 'navigate'",
  "hint": "Add the required parameter 'url' to your request",
  "details": {
    "errors": [
      {
        "field": "url",
        "type": "MISSING_REQUIRED_FIELD",
        "message": "Missing required parameter: 'url'",
        "suggestion": "Add 'url' to your request. Example: { 'url': 'https://example.com' }",
        "expectedType": "string"
      }
    ],
    "errorCount": 1,
    "errorSummary": "url: Missing required parameter: 'url'"
  }
}
```

## Error Types

| Error Type | Meaning | Fix |
|-----------|---------|-----|
| `MISSING_REQUIRED_FIELD` | Missing required parameter | Add the parameter |
| `TYPE_MISMATCH` | Wrong parameter type | Convert to correct type |
| `INVALID_FORMAT` | Value doesn't match pattern | Follow format (e.g., URL pattern) |
| `INVALID_ENUM` | Value not in allowed list | Use one of allowed values |
| `TOO_SHORT` | String too short | Increase string length |
| `TOO_LONG` | String too long | Decrease string length |
| `TOO_SMALL` | Number too small | Increase number value |
| `TOO_LARGE` | Number too large | Decrease number value |
| `UNKNOWN_COMMAND` | Command not registered | Check command spelling |
| `UNKNOWN_FIELD` | Unknown parameter | Remove or check spelling |

## Integration Steps

### 1. Add to server.js
```javascript
const { createValidationMiddleware } = require('./validation-middleware');

// In constructor:
this.validationMiddleware = createValidationMiddleware({ logger: this.logger });

// In message handler (before command dispatch):
const validationResult = this.validationMiddleware.validateRequest(data);
if (!validationResult.valid) {
  return ws.send(JSON.stringify(
    this.validationMiddleware.createErrorResponse(validationResult)
  ));
}
```

### 2. Run Tests
```bash
# Run validation examples
node tests/unit/validation-examples.js

# Run unit tests
npm test -- tests/unit/command-validator.test.js

# Run practical usage examples
node examples/validation-usage.js
```

## Usage Examples

### Client-side validation (Node.js)
```javascript
const { CommandValidator } = require('./websocket/command-validator');
const validator = new CommandValidator();

const result = validator.validate('navigate', {
  url: 'https://example.com'
});

if (!result.valid) {
  console.log('Validation errors:');
  result.errors.forEach(err => {
    console.log(`  ${err.field}: ${err.message}`);
    console.log(`  Suggestion: ${err.suggestion}`);
  });
}
```

### Server-side middleware
```javascript
const { createValidationMiddleware } = require('./websocket/validation-middleware');
const middleware = createValidationMiddleware({ logger: console });

const request = { command: 'click', selector: 'button' };
const result = middleware.validateRequest(request);

if (!result.valid) {
  const errorResponse = middleware.createErrorResponse(result);
  // Send errorResponse to client
}
```

### Get command documentation
```javascript
const { getSchema, getAllCommandNames } = require('./websocket/command-schemas');

// Get schema for one command
const schema = getSchema('navigate');
console.log(schema.description);
console.log(schema.required); // ['url']
console.log(schema.properties); // Property definitions

// List all commands
const commands = getAllCommandNames();
console.log(commands.length); // 140+
```

## Key Features

✓ **Comprehensive** - All 140+ commands have schemas  
✓ **Helpful** - Error messages guide users to fix problems  
✓ **Fast** - Validation completes in <1ms  
✓ **Extensible** - Easy to add new command schemas  
✓ **Well-tested** - 100+ unit test cases  
✓ **Documented** - Complete API reference and examples  
✓ **Type-safe** - Full type checking for all parameters  

## Next Steps

1. **Review** the integration guide: `/docs/VALIDATION-INTEGRATION-GUIDE.md`
2. **Run** the examples: `node examples/validation-usage.js`
3. **Integrate** into server.js
4. **Update** API documentation with error response examples
5. **Test** with real client code

## Support

For detailed information:
- **Integration Guide**: `/docs/VALIDATION-INTEGRATION-GUIDE.md`
- **Examples**: `/examples/validation-usage.js`
- **Tests**: `/tests/unit/command-validator.test.js`
- **Schemas**: `/websocket/command-schemas.js`

## Files Summary

**Schemas (140+ commands):**
- `/websocket/command-schemas.js` (1,200+ lines)

**Validation Engine:**
- `/websocket/command-validator.js` (600+ lines)
- `/websocket/validation-middleware.js` (300+ lines)

**Tests & Examples:**
- `/tests/unit/command-validator.test.js` (800+ lines, 100+ tests)
- `/tests/unit/validation-examples.js` (500+ lines)
- `/examples/validation-usage.js` (600+ lines)

**Documentation:**
- `/docs/VALIDATION-INTEGRATION-GUIDE.md` (600+ lines)

**Total: 4,600+ lines of validation code and documentation**
