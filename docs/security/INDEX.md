# Security Documentation Index

**Basset Hound Browser v12.1.0**  
**Last Updated:** May 31, 2026

---

## Quick Start

**New to Basset Hound Security?** Start here:

1. [Security Overview](SECURITY.md) - High-level security architecture
2. [PATH-TRAVERSAL-PREVENTION.md](PATH-TRAVERSAL-PREVENTION.md) - Critical file system protection
3. [COMMAND-AUTHORIZATION.md](COMMAND-AUTHORIZATION.md) - Request signing and validation

---

## Core Security Features

### 1. File System Protection

**[PATH-TRAVERSAL-PREVENTION.md](PATH-TRAVERSAL-PREVENTION.md)**
- Directory traversal attack prevention
- Sandbox boundaries
- Path validation and normalization
- Real-world attack scenarios
- Testing procedures

**When to read:** Before implementing file operations (downloads, uploads, script loading)

---

### 2. Request Authorization

**[COMMAND-AUTHORIZATION.md](COMMAND-AUTHORIZATION.md)**
- HMAC-based request signing
- Role-based access control
- Per-command authorization rules
- Authorization bypass prevention
- Configuration examples

**When to read:** Before integrating with WebSocket API

---

### 3. Input Validation

**[INPUT-VALIDATION-GUIDE.md](INPUT-VALIDATION-GUIDE.md)**
- Type checking
- Format validation
- Encoding validation
- SQL injection prevention
- XSS prevention
- Validation framework

**When to read:** When building custom commands or integrations

---

### 4. Safe Script Execution

**[JS-EXECUTOR-SAFETY.md](JS-EXECUTOR-SAFETY.md)**
- Sandboxed JavaScript execution
- Resource limits (CPU, memory, time)
- API restrictions
- Variable/function whitelisting
- Safe execution patterns

**When to read:** Before executing dynamic JavaScript

---

### 5. Authentication

**[HMAC-AUTHENTICATION.md](HMAC-AUTHENTICATION.md)**
- SHA-256 HMAC signatures
- Request/response signing
- Timestamp validation
- Replay attack prevention
- Key management

**When to read:** When setting up production authentication

---

### 6. Data Protection

**[DATA-CLEANING.md](DATA-CLEANING.md)**
- Sensitive data redaction
- Password masking
- API key sanitization
- Credentials protection
- Custom cleaning policies

**When to read:** When handling sensitive data output

---

## Security Architecture

```
Request Flow with Security Layers
════════════════════════════════════════════════════════

Client Request
    ↓
┌─ Layer 1: HMAC Validation ─────────────────────────┐
│ • Verify request signature                          │
│ • Check timestamp (prevent replay)                  │
│ • Validate client authorization                     │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─ Layer 2: Input Validation ───────────────────────┐
│ • Type checking                                    │
│ • Format validation                                │
│ • Encoding detection                               │
│ • Length limits                                    │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─ Layer 3: Input Sanitization ────────────────────┐
│ • Remove dangerous characters                     │
│ • Normalize paths                                 │
│ • Decode entities                                 │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─ Layer 4: Boundary Checking ─────────────────────┐
│ • Path traversal check                            │
│ • Sandbox verification                            │
│ • Resource permission check                       │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─ Layer 5: Execution ──────────────────────────────┐
│ • Safe operation (file ops, JS execution, etc.)  │
│ • Resource limits enforced                        │
│ • Output controlled                               │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─ Layer 6: Output Cleaning ───────────────────────┐
│ • Redact sensitive data                           │
│ • Remove credentials                              │
│ • Sanitize output                                 │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─ Layer 7: Audit Logging ─────────────────────────┐
│ • Log all operations                              │
│ • Record access patterns                          │
│ • Maintain compliance trail                       │
└────────────────────┬────────────────────────────────┘
                     ↓
Response to Client
```

---

## By Use Case

### I'm building a client library or integration

**Essential reading:**
1. [COMMAND-AUTHORIZATION.md](COMMAND-AUTHORIZATION.md) - How to sign requests
2. [HMAC-AUTHENTICATION.md](HMAC-AUTHENTICATION.md) - Signature generation
3. [INPUT-VALIDATION-GUIDE.md](INPUT-VALIDATION-GUIDE.md) - Input requirements

### I'm implementing file operations

**Essential reading:**
1. [PATH-TRAVERSAL-PREVENTION.md](PATH-TRAVERSAL-PREVENTION.md) - What paths are safe
2. [INPUT-VALIDATION-GUIDE.md](INPUT-VALIDATION-GUIDE.md) - How to validate filenames
3. [DATA-CLEANING.md](DATA-CLEANING.md) - Protecting sensitive files

### I'm executing JavaScript

**Essential reading:**
1. [JS-EXECUTOR-SAFETY.md](JS-EXECUTOR-SAFETY.md) - Safe execution patterns
2. [INPUT-VALIDATION-GUIDE.md](INPUT-VALIDATION-GUIDE.md) - Validating script input
3. [DATA-CLEANING.md](DATA-CLEANING.md) - Protecting script output

### I'm deploying to production

**Essential reading:**
1. [SECURITY.md](SECURITY.md) - Security configuration
2. [COMMAND-AUTHORIZATION.md](COMMAND-AUTHORIZATION.md) - HMAC setup
3. [HMAC-AUTHENTICATION.md](HMAC-AUTHENTICATION.md) - Key management
4. [../deployment/DEPLOYMENT-QUICK-START.md](../deployment/DEPLOYMENT-QUICK-START.md) - Deployment security

### I'm responding to a security incident

**Essential reading:**
1. [SECURITY.md](SECURITY.md) - Overview of all security features
2. [../INCIDENT-RESPONSE.md](../INCIDENT-RESPONSE.md) - Incident response procedures
3. Relevant guide based on incident type

---

## Security Testing

### Running Security Tests

```bash
# Run all security tests
npm test -- tests/unit/security/

# Run specific security feature tests
npm test -- tests/unit/security/path-traversal.test.js
npm test -- tests/unit/security/command-auth.test.js
npm test -- tests/unit/security/input-validation.test.js
npm test -- tests/unit/security/js-executor-safety.test.js
npm test -- tests/unit/security/hmac-auth.test.js
npm test -- tests/unit/security/data-cleaning.test.js

# Run with coverage
npm test -- --coverage tests/unit/security/
```

### Integration Testing

```bash
# Test security features against running instance
npm test -- tests/integration/security/

# Manual testing with curl
curl -X POST http://localhost:8765 \
  -H "Authorization: Bearer <HMAC_SIGNATURE>" \
  -H "Content-Type: application/json" \
  -d '{"command":"navigate","url":"https://example.com"}'
```

---

## Common Security Tasks

### Set Up HMAC Authentication

**Guide:** [HMAC-AUTHENTICATION.md](HMAC-AUTHENTICATION.md)

```javascript
// Generate HMAC signature
const crypto = require('crypto');
const secret = 'your-secret-key';
const message = JSON.stringify({command: 'navigate', url: 'https://example.com'});
const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');
```

### Validate User Input

**Guide:** [INPUT-VALIDATION-GUIDE.md](INPUT-VALIDATION-GUIDE.md)

```javascript
// Validate before processing
const validator = require('./validation');
try {
  const cleaned = validator.validatePath(userPath);
  // Use cleaned path
} catch (e) {
  // Reject with error
}
```

### Safely Execute JavaScript

**Guide:** [JS-EXECUTOR-SAFETY.md](JS-EXECUTOR-SAFETY.md)

```javascript
// Execute with safety constraints
const result = await jsExecutor.execute(userScript, {
  memoryLimitMB: 512,
  timeoutMs: 30000,
  allowedGlobals: ['console', 'JSON']
});
```

### Prevent Path Traversal

**Guide:** [PATH-TRAVERSAL-PREVENTION.md](PATH-TRAVERSAL-PREVENTION.md)

```javascript
// Validate file paths
const safePath = path.resolve(sandboxDir, userPath);
if (!safePath.startsWith(sandboxDir)) {
  throw new Error('Path outside sandbox');
}
```

---

## Security Audit Reports

### Wave 12 Security Audit (May 31, 2026)

**Status:** ✅ PASSED - Zero critical findings (post-fix)

**Report:** [../SECURITY-DEEP-DIVE-AUDIT-2026-05-31.md](../SECURITY-DEEP-DIVE-AUDIT-2026-05-31.md)

**Summary:**
- 125 security tests
- 100% pass rate
- 6 critical fixes implemented
- All OWASP Top 10 vectors addressed

### Previous Audits

- **v12.0.0** (May 11, 2026) - [../SECURITY-FIXES-IMPLEMENTATION-2026-05-31.md](../SECURITY-FIXES-IMPLEMENTATION-2026-05-31.md)
- **v11.2.0** (May 7, 2026) - Phase 2 completion included security review

---

## Compliance and Standards

### Supported Standards

| Standard | Scope | Documentation |
|----------|-------|-----------------|
| **OWASP Top 10** | A01, A03, A06 | [SECURITY.md#compliance](SECURITY.md#compliance-and-standards) |
| **CWE Top 25** | CWE-22, CWE-78 | [SECURITY.md#compliance](SECURITY.md#compliance-and-standards) |
| **PCI DSS** | 6.5.8, 10.3 | [SECURITY.md#compliance](SECURITY.md#compliance-and-standards) |
| **ISO/IEC 27001** | A.14.2.1 | [SECURITY.md#compliance](SECURITY.md#compliance-and-standards) |

### Audit Trail

All operations logged in: `/var/log/basset-hound/security.log`

Format:
```json
{
  "timestamp": "2026-05-31T14:23:45Z",
  "event_type": "AUTH|VALIDATION|EXECUTION",
  "status": "ALLOWED|BLOCKED|FAILED",
  "command": "command_name",
  "client_ip": "127.0.0.1",
  "details": {...}
}
```

---

## Vulnerability Reporting

### Report a Security Issue

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, email: **security@basset-hound-project.org**

Include:
- Detailed description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

**Response Time:** 48 hours for initial response

---

## FAQ

### Q: Is HTTPS required?

**A:** Use WSS (secure WebSocket over HTTPS) in production. WebSocket without HTTPS is acceptable for localhost development only.

### Q: How do I rotate HMAC secrets?

**A:** See [HMAC-AUTHENTICATION.md - Key Rotation](HMAC-AUTHENTICATION.md#key-rotation)

### Q: Can I disable security features?

**A:** All security features are enabled by default. Disabling is not recommended, but see [SECURITY.md - Configuration](SECURITY.md#security-configuration)

### Q: How are uploaded profiles validated?

**A:** See [PATH-TRAVERSAL-PREVENTION.md](PATH-TRAVERSAL-PREVENTION.md#layer-2-sandbox-directory-enforcement)

### Q: What happens if validation fails?

**A:** The operation is blocked and logged. See [SECURITY.md - Audit Logging](SECURITY.md#audit-trail)

---

## Related Documentation

### Architecture & Design
- [Main ARCHITECTURE.md](../ARCHITECTURE.md)
- [API Reference](../API-REFERENCE.md)
- [WebSocket Protocol](../API-REFERENCE.md#websocket-protocol)

### Operations
- [Deployment Guide](../deployment/DEPLOYMENT-QUICK-START.md)
- [Incident Response](../INCIDENT-RESPONSE.md)
- [Monitoring](../monitoring/)

### Features
- [Advanced Evasion](../ADVANCED-EVASION-IMPLEMENTATION-GUIDE.md)
- [Feature Index](../features/)

---

## Document Status

| Document | Version | Status | Updated |
|----------|---------|--------|---------|
| [SECURITY.md](SECURITY.md) | 12.1.0 | ✅ Current | May 31, 2026 |
| [PATH-TRAVERSAL-PREVENTION.md](PATH-TRAVERSAL-PREVENTION.md) | 12.1.0 | ✅ Current | May 31, 2026 |
| [COMMAND-AUTHORIZATION.md](COMMAND-AUTHORIZATION.md) | 12.1.0 | ✅ Current | May 31, 2026 |
| [INPUT-VALIDATION-GUIDE.md](INPUT-VALIDATION-GUIDE.md) | 12.1.0 | ✅ Current | May 31, 2026 |
| [JS-EXECUTOR-SAFETY.md](JS-EXECUTOR-SAFETY.md) | 12.1.0 | ✅ Current | May 31, 2026 |
| [HMAC-AUTHENTICATION.md](HMAC-AUTHENTICATION.md) | 12.1.0 | ✅ Current | May 31, 2026 |
| [DATA-CLEANING.md](DATA-CLEANING.md) | 12.1.0 | ✅ Current | May 31, 2026 |

---

**Last Updated:** May 31, 2026  
**Maintained By:** Security Team  
**Version:** 12.1.0
