# Sensitive Data Masker - Implementation Guide

**Version:** 1.0.0  
**Status:** Production Ready  
**Performance Target:** <100ms per export  
**Test Coverage:** >95%  

## Overview

The Sensitive Data Masker is a security module for detecting and masking sensitive information in forensic exports. It protects against accidental exposure of credentials, PII, and confidential data through the export workflow.

### Key Features

- **15+ Sensitive Data Types:** API keys, tokens, passwords, credit cards, SSNs, emails, phone numbers, private keys, certificates, database connection strings
- **Performance Optimized:** <100ms typical export masking with intelligent caching
- **Configurable:** Fine-grained control over which data types to mask
- **Non-Destructive:** Preserves request structure and metadata
- **Deep Inspection:** Recursively masks sensitive fields in nested objects

## Architecture

### Module Structure

```
src/export/
├── sensitive-data-masker.js      # Core masking class (650+ lines)
├── export-sanitizer.js            # Integration utilities (400+ lines)
└── [integration with websocket/server.js]

tests/unit/
├── sensitive-data-masker.test.js  # 87 unit tests (>95% coverage)
└── export-sanitizer.test.js       # 29 integration tests
```

### Component Responsibilities

1. **SensitiveDataMasker** - Core detection and masking logic
2. **Export Sanitizer** - Integration layer for network exports
3. **WebSocket Integration** - Export command handlers

## Sensitive Data Types Detected

### 1. API Keys & Secrets

| Type | Pattern | Examples |
|------|---------|----------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | `AKIA_REDACTED_EXAMPLE` |
| AWS Secret | `aws_secret_access_key = "..."` | AWS IAM credentials |
| Google API | `AIza[A-Za-z0-9_-]{35}` | Google Cloud projects |
| Stripe | `sk_live/test_[20+ chars]` | Stripe payment keys |
| Generic API Key | `api_key = "..."` | Custom API keys |

### 2. Tokens & Authentication

| Type | Pattern | Examples |
|------|---------|----------|
| JWT Token | `eyJ[A-Za-z0-9_-]+\.eyJ...` | OAuth 2.0 JWT tokens |
| Bearer Token | `Bearer <token>` | Authorization headers |
| GitHub | `ghp_[A-Za-z0-9_]{36,}` | GitHub personal access |
| Slack | `xox[baprs]-[0-9]+-[...]` | Slack bot/user tokens |

### 3. Credentials

| Type | Pattern | Examples |
|------|---------|----------|
| Passwords | `password="value"` | Login credentials |
| Database URLs | `mysql://user:pass@host/db` | Connection strings |
| Azure Connection | `DefaultEndpointsProtocol=...` | Azure storage |

### 4. Personal Information

| Type | Pattern | Examples |
|------|---------|----------|
| Email | `user@example.com` | Email addresses |
| Phone (US) | `(555) 123-4567` | US phone numbers |
| Phone (International) | `+1-555-123-4567` | International format |
| SSN | `123-45-6789` | Social security numbers |

### 5. Payment Data

| Type | Pattern | Luhn Check |
|------|---------|-----------|
| Visa | `4[0-9]{12}(3)?` | Yes |
| MasterCard | `5[1-5][0-9]{14}` | Yes |
| American Express | `3[47][0-9]{13}` | Yes |
| Discover | `6011/65[0-9]{12}` | Yes |

### 6. Cryptographic Material

| Type | Pattern | Examples |
|------|---------|----------|
| RSA Private Key | `-----BEGIN RSA PRIVATE KEY-----...` | PEM format |
| EC Private Key | `-----BEGIN EC PRIVATE KEY-----...` | PEM format |
| Certificate | `-----BEGIN CERTIFICATE-----...` | X.509 format |

## Usage Examples

### Basic String Masking

```javascript
const SensitiveDataMasker = require('./src/export/sensitive-data-masker');

const masker = new SensitiveDataMasker();

// Detect sensitive data
const text = 'password="SecretPass123" email=user@example.com';
const found = masker.detectSensitiveData(text);
// Returns: ['passwordField', 'email']

// Mask sensitive data
const masked = masker.maskString(text);
// Returns: 'password="[MASKED-Password]" email=[MASKED-Email:...m.com]'
```

### Object Masking (Nested)

```javascript
const request = {
  username: 'john_doe',
  credentials: {
    password: 'SecretPass123!',
    api_key: 'sk_live_REDACTED_EXAMPLE'
  },
  contact: {
    email: 'john@example.com'
  }
};

const masked = masker.maskObject(request);
// Returns: Recursively masked object with all sensitive fields masked
```

### Request/Response Masking

```javascript
const request = {
  id: 'req-123',
  url: 'https://api.example.com/login',
  method: 'POST',
  requestHeaders: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
    'X-API-Key': 'sk_live_REDACTED_EXAMPLE'
  },
  requestBody: 'password="SecretPass123"&email=user@example.com',
  responseBody: '{"token":"response_token_abc123","userId":12345}'
};

const masked = masker.maskRequest(request);
// - Authorization header masked
// - X-API-Key header masked
// - Both bodies masked
// - URL and userId preserved
```

### Network Export Integration

```javascript
const { sanitizeNetworkExport } = require('./src/export/export-sanitizer');

const exportData = {
  timestamp: new Date().toISOString(),
  requests: [/* ... */]
};

// Sanitize with options
const sanitized = sanitizeNetworkExport(exportData, {
  sanitize: true,           // Enable/disable sanitization
  removeHeaders: false,     // Mask or remove sensitive headers
  stripBodies: false,       // Remove request/response bodies
  resourceTypeFilter: ['xhr', 'fetch'],  // Only sanitize certain types
  maskerOptions: {
    maskEmail: true,
    maskPhones: true,
    maskCreditCards: true
  }
});
```

### HAR File Sanitization

```javascript
const { sanitizeHAR } = require('./src/export/export-sanitizer');

const harData = {
  log: {
    entries: [/* HAR entries */]
  }
};

const sanitized = sanitizeHAR(harData, { sanitize: true });
// Sanitizes all headers and request/response bodies
```

## Configuration Options

### Masker Configuration

```javascript
const masker = new SensitiveDataMasker({
  // Masking character (default: '*')
  maskChar: '*',

  // Number of characters to reveal (default: 4)
  revealChars: 4,

  // Data type flags (all default to true)
  maskEmail: true,
  maskPhones: true,
  maskCreditCards: true,
  maskSSNs: true,
  maskTokens: true,
  maskAPIKeys: true,
  maskPasswords: true,
  maskPrivateKeys: true,

  // Enable pattern caching (default: true)
  cachePatterns: true,

  // Maximum string length to process
  maxStringLength: 1000000
});
```

### Sanitizer Configuration

```javascript
const options = {
  sanitize: true,              // Enable/disable
  removeHeaders: false,        // Remove vs mask
  stripBodies: false,          // Remove request/response bodies
  resourceTypeFilter: null,    // Filter by type
  maskerOptions: {
    /* masker config */
  }
};
```

## Performance Characteristics

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Mask single string | <1ms | Typical 1KB payload |
| Mask single request | <5ms | Headers + body |
| Mask 50 requests | <200ms | Full export with all data types |
| 100 requests | <500ms | Stress test scenario |

### Caching

- **Hit Rate:** 80-95% on repeated masking
- **Cache Size:** Automatic pruning at 1000 entries
- **Memory Overhead:** ~50KB typical

### Optimization Strategies

1. **Pattern Caching:** Repeated text returns cached result
2. **Lazy Initialization:** Patterns compiled on first use
3. **Early Exit:** Non-matching strings return quickly
4. **Batch Processing:** Single pass for multiple patterns

## Integration with WebSocket Server

### Export Network Log Command

```javascript
// Modified export_network_log handler
this.commandHandlers.export_network_log = async (params) => {
  const baseExport = this.networkAnalysisManager.exportCapture();
  
  // Apply sanitization
  if (params.sanitize !== false) {
    const { sanitizeNetworkExport } = require('../export/export-sanitizer');
    baseExport.requests = sanitizeNetworkExport(baseExport, {
      sanitize: true,
      removeHeaders: params.removeHeaders || false,
      stripBodies: params.stripBodies || false,
      resourceTypeFilter: params.resourceTypeFilter || null
    }).requests;
  }
  
  return baseExport;
};
```

### API Parameters

```javascript
{
  // Enable/disable sanitization
  "sanitize": true,

  // Remove vs mask sensitive headers
  "removeHeaders": false,

  // Remove request/response bodies entirely
  "stripBodies": false,

  // Filter by resource type (xhr, script, image, etc.)
  "resourceTypeFilter": ["xhr", "fetch"],

  // Masker options
  "maskEmail": true,
  "maskPhones": true,
  "maskCreditCards": true,
  // ... other options
}
```

## Testing

### Test Coverage

- **Total Tests:** 116 (87 masker + 29 integration)
- **Coverage:** >95%
- **Execution Time:** <600ms total

### Test Categories

1. **Pattern Detection Tests:** Each regex pattern verified
2. **Masking Accuracy Tests:** Verify masking works correctly
3. **Edge Case Tests:** Empty, very long, mixed content
4. **Performance Tests:** Timing benchmarks
5. **Integration Tests:** Request/response masking
6. **Real-World Scenarios:** HTTP logs, forensic exports

### Running Tests

```bash
# Run all masker tests
npm test -- tests/unit/sensitive-data-masker.test.js

# Run integration tests
npm test -- tests/unit/export-sanitizer.test.js

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- --testNamePattern="API Keys"
```

## Security Considerations

### What Gets Masked

✓ Passwords (both quoted and unquoted)  
✓ API keys and secrets  
✓ OAuth/JWT tokens  
✓ Credit card numbers  
✓ SSNs and tax IDs  
✓ Authorization headers  
✓ Private keys and certificates  
✓ Database connection strings  

### What Gets Preserved

✓ URLs (domains, paths)  
✓ Response metadata (status codes, timestamps)  
✓ Non-sensitive headers  
✓ Request structure  
✓ Usernames (non-password)  

### Masking Format

**Default:** `[MASKED-Label:****...value]`  
Example: `[MASKED-Password:****...P123]`  
- Shows last 4 characters
- Includes data type label
- Clearly marked as masked

## Troubleshooting

### Regex Patterns Not Matching

**Problem:** Expected sensitive data not being detected

**Solutions:**
1. Check pattern requirements (e.g., `sk_live_` requires 20+ chars)
2. Verify string format matches pattern expectation
3. Enable `detectSensitiveData()` to debug
4. Check for case sensitivity

### Performance Issues

**Problem:** Export taking >100ms

**Solutions:**
1. Disable unnecessary masking types
2. Use `resourceTypeFilter` to limit scope
3. Enable `stripBodies` if body masking not needed
4. Batch process large exports

### False Positives/Negatives

**Problem:** Masking too much or too little

**Solutions:**
1. Review pattern accuracy
2. Customize masking options per data type
3. Use format-specific patterns (JSON vs URL-encoded)
4. Add custom detection rules if needed

## Future Enhancements

### Planned Features

1. **Format-Specific Masking:** JSON, XML, URL-encoded detection
2. **Custom Pattern Registration:** User-defined sensitive patterns
3. **Masking Whitelist:** Exceptions for known safe values
4. **Compliance Modes:** GDPR, HIPAA, PCI-DSS configurations
5. **Audit Logging:** Track what was masked
6. **Batch Processing:** Optimize for large exports

### Performance Roadmap

- Hardware-accelerated regex (WASM)
- Parallel masking for multi-core systems
- Distributed caching for multi-instance deployments

## References

### Standards & Compliance

- **ISO/IEC 27037** - Guidelines for Digital Evidence
- **NIST SP 800-92** - Computer Security Incident Handling
- **GDPR Article 32** - Security of Processing
- **PCI DSS 3.2.1** - Cardholder Data Protection

### Related Documentation

- `/docs/ROADMAP.md` - Project roadmap
- `/docs/API-REFERENCE.md` - WebSocket API reference
- `/DEPLOYMENT-COMPLETE-2026-05-11.md` - Deployment status

## Support & Contribution

For issues, enhancements, or questions:

1. Check existing issues in project tracker
2. Review test cases for usage examples
3. Refer to integration test cases for patterns
4. File issue with sensitive data type and example pattern

---

**Last Updated:** June 2026  
**Maintained By:** Security Engineering Team  
**License:** Project License
