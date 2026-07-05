# Sensitive Data Masker - Quick Reference

## Installation & Import

```javascript
// ES6 Import
const SensitiveDataMasker = require('./src/export/sensitive-data-masker');
const { sanitizeNetworkExport } = require('./src/export/export-sanitizer');

// Create instance
const masker = new SensitiveDataMasker();
```

## Common Tasks

### 1. Mask a String

```javascript
const text = 'password="secret123" email=user@example.com';
const masked = masker.maskString(text);
// Result: 'password="[MASKED-Password]" email=[MASKED-Email:...m.com]'
```

### 2. Detect Sensitive Data

```javascript
const found = masker.detectSensitiveData(text);
// Returns: ['passwordField', 'email']

if (found.length > 0) {
  console.log(`Found ${found.length} types of sensitive data`);
}
```

### 3. Mask an Object

```javascript
const user = {
  username: 'john',
  password: 'SecretPass123',
  email: 'john@example.com'
};

const safe = masker.maskObject(user);
// {
//   username: 'john',
//   password: '[MASKED-Password]',
//   email: '[MASKED-Email:...m.com]'
// }
```

### 4. Mask HTTP Headers

```javascript
const headers = {
  'Authorization': 'Bearer token123',
  'X-API-Key': 'sk_live_REDACTED_EXAMPLE',
  'Content-Type': 'application/json'
};

// Option 1: Mask (keep header, hide value)
const masked = masker.maskHeaders(headers);
// { Authorization: '[MASKED-authorization]', ... }

// Option 2: Remove entirely
const removed = masker.maskHeaders(headers, true);
// { Content-Type: 'application/json' }
```

### 5. Mask Request/Response

```javascript
const request = {
  id: 'req-123',
  url: 'https://api.example.com/login',
  requestHeaders: { 'Authorization': 'Bearer token' },
  requestBody: 'password="secret"',
  responseBody: '{"token":"response_token"}'
};

const safe = masker.maskRequest(request);
// Headers and bodies masked, URL preserved
```

### 6. Sanitize Network Export

```javascript
const { sanitizeNetworkExport } = require('./src/export/export-sanitizer');

const exportData = {
  requests: [/* ... */]
};

const sanitized = sanitizeNetworkExport(exportData, {
  sanitize: true,
  removeHeaders: false,
  stripBodies: false
});
```

### 7. Configuration

```javascript
const masker = new SensitiveDataMasker({
  maskChar: '*',
  revealChars: 4,
  maskEmail: true,
  maskPhones: true,
  maskCreditCards: true,
  maskSSNs: true,
  maskTokens: true,
  maskAPIKeys: true,
  maskPasswords: true,
  maskPrivateKeys: true,
  cachePatterns: true
});
```

### 8. Performance Optimization

```javascript
// Get cache statistics
const stats = masker.getStatistics();
console.log(stats);
// {
//   cacheHits: 150,
//   cacheMisses: 10,
//   cacheSize: 5,
//   hitRate: '93.75%'
// }

// Clear cache when done
masker.clearCache();
```

### 9. Batch Processing

```javascript
const { sanitizeBatch } = require('./src/export/export-sanitizer');

const exports = [export1, export2, export3];
const sanitized = sanitizeBatch(exports, {
  sanitize: true,
  maskEmail: true
});
```

### 10. Generate Report

```javascript
const { generateSanitizationReport } = require('./src/export/export-sanitizer');

const report = generateSanitizationReport(original, sanitized);
console.log(`Masked ${report.maskedRequests} out of ${report.totalRequests}`);
// {
//   timestamp: '2026-06-20T...',
//   totalRequests: 50,
//   maskedRequests: 35,
//   maskedHeaders: 28,
//   maskedBodies: 12,
//   detailedStats: { ... }
// }
```

## Pattern Reference

### What Gets Masked

| Pattern | Example | Result |
|---------|---------|--------|
| `AKIA[0-9A-Z]{16}` | `AKIA_REDACTED_EXAMPLE` | `[MASKED-AWS Access Key]` |
| `sk_live_[20+ chars]` | `sk_live_REDACTED_EXAMPLE` | `[MASKED-Stripe Key]` |
| `Bearer <token>` | `Bearer eyJ...` | `[MASKED-Bearer Token]` |
| `password="value"` | `password="secret"` | `password="[MASKED-Password]"` |
| `user@example.com` | `user@example.com` | `[MASKED-Email:...m.com]` |
| `(555) 123-4567` | `(555) 123-4567` | `[MASKED-Phone (US)]` |
| `123-45-6789` | `123-45-6789` | `[MASKED-SSN]` |
| `4[0-9]{12}(3)?` | `4532123456789010` | `[MASKED-Credit Card (Visa)]` |

## Error Handling

```javascript
try {
  const text = null;
  const masked = masker.maskString(text);
  // Returns null (safe)
  
  const obj = { nested: { data: 'value' } };
  const safe = masker.maskObject(obj);
  // Returns safely masked object
} catch (error) {
  console.error('Masking error:', error);
}
```

## WebSocket Integration

```javascript
// In export_network_log command handler
const { sanitizeNetworkExport } = require('../export/export-sanitizer');

const baseExport = this.networkAnalysisManager.exportCapture();

if (params.sanitize !== false) {
  baseExport.requests = sanitizeNetworkExport(baseExport, {
    sanitize: true,
    removeHeaders: params.removeHeaders || false,
    stripBodies: params.stripBodies || false
  }).requests;
}

return baseExport;
```

## API Call Example

```javascript
// WebSocket command
{
  "command": "export_network_log",
  "params": {
    "format": "json",
    "sanitize": true,
    "removeHeaders": false,
    "stripBodies": false,
    "resourceTypeFilter": ["xhr", "fetch"],
    "maskEmail": true,
    "maskPhones": true,
    "maskCreditCards": true
  }
}
```

## Performance Tips

1. **Batch Processing:** Sanitize multiple exports at once
```javascript
const sanitized = sanitizeBatch(exports); // Faster than individual calls
```

2. **Disable Unused Types:** Turn off masking for data types you don't have
```javascript
const masker = new SensitiveDataMasker({
  maskEmail: false,    // Not checking emails
  maskPhones: false,   // Not checking phones
  maskCreditCards: false  // Not checking cards
});
```

3. **Resource Type Filtering:** Only sanitize specific request types
```javascript
sanitizeNetworkExport(data, {
  resourceTypeFilter: ['xhr']  // Only XHR requests
});
```

4. **Strip Bodies:** Remove bodies if masking not needed
```javascript
sanitizeNetworkExport(data, {
  stripBodies: true  // Saves memory and time
});
```

5. **Cache Management:** Clear cache periodically
```javascript
setInterval(() => {
  clearMaskerCache();  // Free memory
}, 3600000);  // Every hour
```

## Testing

```bash
# Run all tests
npm test -- tests/unit/sensitive-data-masker.test.js \
              tests/unit/export-sanitizer.test.js

# Run specific test
npm test -- --testNamePattern="should mask passwords"

# Run with coverage
npm test -- --coverage

# Run performance tests only
npm test -- --testNamePattern="Performance"
```

## Debugging

```javascript
// Check what's being masked
const found = masker.detectSensitiveData(text);
console.log('Found sensitive data:', found);

// View cache stats
const stats = masker.getStatistics();
console.log('Cache hit rate:', stats.hitRate);

// Test specific patterns
const patterns = masker.patterns;
if (patterns.emailPattern.test(text)) {
  console.log('Email found in text');
}
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Pattern not matching | Check quote style (JSON needs `"`) |
| False positives | Review regex requirements (e.g., min length) |
| Slow performance | Disable unused masking types |
| High memory usage | Call `clearMaskerCache()` regularly |
| Headers not masked | Use `maskHeaders()` specifically |

## Memory Management

```javascript
// Good practice: Create instance once
const masker = new SensitiveDataMasker();

// Use across multiple operations
masker.maskString(text1);
masker.maskString(text2);
masker.maskString(text3);

// Clear cache periodically
masker.clearCache();

// Reset if needed
resetMasker();
```

## Type Definitions (Reference)

```javascript
// Request object structure
{
  id: string,
  url: string,
  method: string,
  resourceType: string,
  statusCode: number,
  requestHeaders: object,
  responseHeaders: object,
  requestBody: string|object|Buffer,
  responseBody: string|object|Buffer
}

// Sanitization options
{
  sanitize: boolean,
  removeHeaders: boolean,
  stripBodies: boolean,
  resourceTypeFilter: string[],
  maskerOptions: object
}

// Masker statistics
{
  cacheHits: number,
  cacheMisses: number,
  cacheSize: number,
  hitRate: string
}
```

## Resources

- Full Documentation: `/docs/SENSITIVE-DATA-MASKER.md`
- Implementation Details: `/SENSITIVE-DATA-MASKER-IMPLEMENTATION.md`
- Unit Tests: `/tests/unit/sensitive-data-masker.test.js`
- Integration Tests: `/tests/unit/export-sanitizer.test.js`

---

**Quick Start:** Copy example code, run tests, integrate into WebSocket handlers.

**Version:** 1.0 | **Status:** Production Ready | **Tests:** 116/116 passing
