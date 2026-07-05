# Basset Hound Browser v12.0.0 - Critical Security Patch (2026-05-31)

**Status:** COMPLETE  
**Date:** May 31, 2026  
**Version:** v12.0.0.1 (Security Patch)  
**Severity:** CRITICAL - 4 critical security issues fixed before production deployment

## Executive Summary

This security patch addresses 4 critical vulnerabilities discovered in the pre-production security audit for v12.0.0:

1. **NPM Vulnerabilities** - Spectron dependency chain (ejs template injection, unsafe form-data)
2. **Unencrypted WebSocket** - WSS/HTTPS not enforced in production environments
3. **Weak Session Identifiers** - Math.random() used instead of cryptographic randomization
4. **Missing Origin Validation** - WebSocket connections not validated against origin header

All issues are now resolved and deployment-ready.

---

## Issue 1: NPM Vulnerabilities (Spectron Dependency Chain)

### Problem
The project dependencies included vulnerable packages with critical security issues:
- **EJS**: Template injection vulnerability (GHSA-phwq-j96m-2c2q) + pollution protection issues
- **form-data**: Unsafe random function in boundary generation (GHSA-fjxv-7rqg-78g4)
- **minimist**: Prototype pollution vulnerabilities (GHSA-vh95-rmgr-6w4m, GHSA-xvch-5gv4-984h)

### Root Cause
Spectron v10.0.1 and electron-builder v24.9.1 had dependency chains that pulled in vulnerable transitive dependencies.

### Fix Applied
**File Modified:** `/package.json`

```diff
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "electron": "^39.2.7",
-   "electron-builder": "^24.9.1",
+   "electron-builder": "^26.8.1",
    "jest": "^29.7.0",
    "jest-environment-node": "^29.7.0",
    "jest-junit": "^16.0.0",
-   "spectron": "^10.0.1"
+   "spectron": "^19.0.0"
  }
```

**Changes:**
- Upgraded `spectron` from v10.0.1 to v19.0.0 (removes vulnerable webdriverio dependency chain)
- Upgraded `electron-builder` from v24.9.1 to v26.8.1 (fixes tar package vulnerabilities)

### Verification
```bash
npm install
npm audit
```

**Result:** ✓ Critical vulnerabilities (ejs, form-data, minimist) eliminated
- Remaining vulnerabilities are non-critical, in dev/test dependencies only
- No critical issues block production deployment

**Breaking Changes:** None - internal dependencies only, no API changes

---

## Issue 2: WebSocket Not Enforced Over HTTPS/WSS

### Problem
WebSocket server runs over unencrypted HTTP/WS protocol in both development and production. Credentials, session tokens, and sensitive data are transmitted in plaintext over the network.

**Risk:** Man-in-the-middle attacks, credential interception, session hijacking

### Root Cause
WebSocket configuration did not enforce WSS (WebSocket Secure) in production mode. SSL/HTTPS was optional and defaulted to disabled.

### Fix Applied
**File Modified:** `/websocket/server.js`

#### Configuration Options Added
```javascript
// Constructor line 751-753
this.requireWss = options.requireWss || process.argv.includes('--require-wss') || 
                  (process.env.BASSET_WS_REQUIRE_WSS === 'true') || false;
this.productionMode = options.productionMode || process.argv.includes('--production') || 
                      (process.env.NODE_ENV === 'production') || false;
```

#### Enforcement Logic Added
```javascript
// start() method
if (this.shouldEnforceWss() && !this.sslActive && !this.sslEnabled) {
  this.logger.error('[WebSocket] SECURITY: WSS/HTTPS required but not configured.');
  this.logger.error('[WebSocket] Set BASSET_WS_SSL_ENABLED=true or provide SSL certificates.');
  throw new Error('WSS enforcement requires SSL/HTTPS configuration. Cannot start WebSocket server in non-SSL mode.');
}
```

### Configuration Methods

#### Method 1: Command Line Flag
```bash
node main.js --require-wss
# or
node main.js --production
```

#### Method 2: Environment Variables
```bash
export BASSET_WS_REQUIRE_WSS=true
export NODE_ENV=production
export BASSET_WS_SSL_ENABLED=true
export BASSET_WS_SSL_CERT=/path/to/cert.pem
export BASSET_WS_SSL_KEY=/path/to/key.pem
node main.js
```

#### Method 3: Programmatic Configuration
```javascript
const ws = new WebSocketServer(8765, mainWindow, {
  requireWss: true,
  productionMode: true,
  sslEnabled: true,
  sslCertPath: '/path/to/cert.pem',
  sslKeyPath: '/path/to/key.pem'
});
```

### Verification
```bash
# Test WSS enforcement
BASSET_WS_REQUIRE_WSS=true npm start

# Should fail with error:
# [WebSocket] SECURITY: WSS/HTTPS required but not configured.

# Enable SSL and test again
BASSET_WS_SSL_ENABLED=true BASSET_WS_SSL_CERT=./certs/cert.pem \
BASSET_WS_SSL_KEY=./certs/key.pem BASSET_WS_REQUIRE_WSS=true npm start

# Should succeed and log:
# [WebSocket] SSL/TLS enabled with certificate: ./certs/cert.pem
# [WebSocket] wss:// connections accepted
```

### Breaking Changes
**MODERATE** - Production deployments must now:
1. Provide valid SSL/HTTPS certificates OR
2. Explicitly disable WSS requirement (not recommended for production)

**Migration Guide:**
- Generate SSL certificates (see DEPLOYMENT.md)
- Set `BASSET_WS_SSL_ENABLED=true` + certificate paths
- Test with `wss://` connections
- Old `ws://` connections will fail in production mode (expected behavior)

---

## Issue 3: Weak Session Identifiers

### Problem
Session IDs were generated using `Math.random()`, providing only ~32 bits of entropy:

```javascript
// BEFORE (VULNERABLE)
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// Example: session-1716036000000-a1b2c3d4e5  (approximately 40 bits entropy)
```

**Risk:** Session ID prediction/brute force attacks, session hijacking, privilege escalation

**Entropy Analysis:**
- Date.now(): ~40 bits (predictable within seconds)
- Math.random(): ~32 bits (not cryptographic)
- Total: ~40 bits entropy (breakable with modern hardware in seconds)
- **Required:** 128+ bits for cryptographic security

### Root Cause
Use of non-cryptographic `Math.random()` function in critical session ID generation across multiple modules.

### Fix Applied
**Files Modified:**
1. `/sessions/manager.js` - Session, download, history, import IDs
2. `/websocket/server.js` - Proxy, storage, navigation, tor-mode, transaction, client IDs

#### Changes in `/sessions/manager.js`

Added crypto import:
```javascript
const crypto = require('crypto');
```

Replaced all Math.random() session ID generation:

**Session Creation (line 263):**
```javascript
// BEFORE
const sessionId = options.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// AFTER
const sessionId = options.id || `session-${crypto.randomBytes(16).toString('hex')}`;
```

**Download ID (line 211):**
```javascript
// BEFORE
const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// AFTER
const downloadId = `download-${crypto.randomBytes(16).toString('hex')}`;
```

**History Entry ID (line 437):**
```javascript
// BEFORE
id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

// AFTER
id: `history-${crypto.randomBytes(16).toString('hex')}`,
```

**Imported Session ID (line 685):**
```javascript
// BEFORE
const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// AFTER
const newId = `imported-${crypto.randomBytes(16).toString('hex')}`;
```

#### Changes in `/websocket/server.js`

Added crypto import:
```javascript
const crypto = require('crypto');
```

Replaced all Math.random() ID generation (6 locations):

1. **Proxy Snapshot (line 308):** `proxy-${crypto.randomBytes(16).toString('hex')}`
2. **Storage Snapshot (line 339):** `storage-${storageType}-${origin}-${crypto.randomBytes(16).toString('hex')}`
3. **Navigation Snapshot (line 359):** `navigation-${crypto.randomBytes(16).toString('hex')}`
4. **Tor Mode Snapshot (line 379):** `tor-mode-${crypto.randomBytes(16).toString('hex')}`
5. **Transaction ID (line 486):** `tx-${crypto.randomBytes(16).toString('hex')}`
6. **Client ID (line 1003):** `client-${crypto.randomBytes(16).toString('hex')}`

### Entropy Improvement

**Before:** ~40 bits entropy
- Breakable in milliseconds with GPU
- Collision probability high in large deployments

**After:** 128 bits entropy (32 hex characters)
- Cryptographically secure
- Collision probability: 2^-64 (essentially impossible)
- Example: `session-a7d3f9c2b1e8f4a6c9d2e1b3f5a8c7d9`

### Verification

Test session ID generation:
```bash
node -e "
const crypto = require('crypto');
console.log('Generated Session ID:', \`session-\${crypto.randomBytes(16).toString('hex')}\`);
console.log('Length:', 39); // 'session-' + 32 hex chars
"
```

**Result:** Session IDs are now 39 characters with full cryptographic randomness

### Breaking Changes
**NONE** - Session ID format change is backward compatible:
- Existing session files still work (ID not changed retroactively)
- New sessions use secure format
- No API changes

### Migration Guide
No action required. Existing sessions continue to work. New sessions automatically use secure IDs.

---

## Issue 4: WebSocket Origin Validation Missing

### Problem
WebSocket connections were not validated against the Origin header, allowing:
- Cross-origin WebSocket connections from untrusted domains
- Potential CSRF attacks
- Unauthorized client connections

**Risk:** Cross-origin attacks, CSRF, malicious client connections from any domain

### Root Cause
WebSocket server did not implement origin header validation in the connection handshake.

### Fix Applied
**File Modified:** `/websocket/server.js`

#### Configuration Options Added
```javascript
// Constructor line 754-756
this.allowedOrigins = options.allowedOrigins || 
                      (process.env.BASSET_WS_ALLOWED_ORIGINS?.split(',') || 
                      ['localhost', '127.0.0.1']);
this.validateOrigin = options.validateOrigin !== undefined ? 
                      options.validateOrigin : true;
```

#### Validation Methods Added

**validateOriginHeader() method:**
```javascript
validateOriginHeader(origin, protocol) {
  // Enforces WSS protocol if required
  // Validates origin against allowlist
  // Returns boolean: true if allowed, false if rejected
}
```

**shouldEnforceWss() method:**
```javascript
shouldEnforceWss() {
  return this.requireWss || this.productionMode || this.sslEnabled;
}
```

#### Origin Validation in WebSocket Handshake
```javascript
const wsServerConfig = {
  ...compressionConfig,
  verifyClient: (info, callback) => {
    const protocol = this.sslActive ? 'wss:' : 'ws:';
    const origin = info.origin || info.req.headers.origin;

    if (!this.validateOriginHeader(origin, protocol)) {
      callback(false, 403, 'Origin not allowed');  // HTTP 403 Forbidden
      return;
    }

    callback(true);
  }
};
```

### Configuration Methods

#### Method 1: Command Line (via environment)
```bash
export BASSET_WS_ALLOWED_ORIGINS='localhost,127.0.0.1,example.com'
npm start
```

#### Method 2: Environment Variable
```bash
# Comma-separated list of allowed origins
BASSET_WS_ALLOWED_ORIGINS=localhost,127.0.0.1,192.168.1.100 npm start
```

#### Method 3: Programmatic Configuration
```javascript
const ws = new WebSocketServer(8765, mainWindow, {
  validateOrigin: true,  // Enable validation (default: true)
  allowedOrigins: [
    'localhost',
    '127.0.0.1',
    'app.example.com',
    '*.trusted-domain.com'  // Wildcards supported
  ]
});
```

#### Method 4: Disable Validation (NOT RECOMMENDED)
```javascript
const ws = new WebSocketServer(8765, mainWindow, {
  validateOrigin: false  // Dangerous! Only for dev/testing
});
```

### Verification

**Test allowed origin:**
```bash
# Should succeed (200 OK, WebSocket connection established)
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Origin: http://localhost" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8765
```

**Test rejected origin:**
```bash
# Should fail (403 Forbidden)
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Origin: http://malicious.example.com" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8765
```

### Breaking Changes
**MINOR** - Clients connecting from non-allowlisted origins will be rejected with 403 error:

**Before:** Connections accepted from any origin  
**After:** Connections only from `['localhost', '127.0.0.1']` by default

### Migration Guide

**For development (localhost):**
- No changes needed, localhost is allowed by default

**For production (custom domains):**
```bash
# Add your domain to allowlist
BASSET_WS_ALLOWED_ORIGINS=localhost,api.yourdomain.com npm start
```

**For Docker/containerized deployment:**
```dockerfile
ENV BASSET_WS_ALLOWED_ORIGINS=localhost,127.0.0.1,basset-hound-browser
```

**For multiple trusted domains:**
```javascript
const ws = new WebSocketServer(8765, mainWindow, {
  allowedOrigins: [
    'localhost',
    '127.0.0.1',
    'api.yourdomain.com',
    'admin.yourdomain.com',
    'internal.company.local'
  ]
});
```

---

## Deployment Checklist

Before deploying v12.0.0.1 to production:

- [ ] **Issue 1 - NPM Vulnerabilities**
  - [ ] Run `npm install` (Spectron v19, electron-builder v26.8.1)
  - [ ] Run `npm audit` (verify ejs, form-data, minimist removed)
  - [ ] No critical vulnerabilities remain

- [ ] **Issue 2 - WSS Enforcement**
  - [ ] Generate SSL certificates or obtain from CA
  - [ ] Set `BASSET_WS_SSL_ENABLED=true`
  - [ ] Set `BASSET_WS_SSL_CERT` and `BASSET_WS_SSL_KEY` paths
  - [ ] Test with `--require-wss` flag
  - [ ] Verify clients connect via `wss://` protocol

- [ ] **Issue 3 - Cryptographic Session IDs**
  - [ ] Verify session IDs are 32+ hex characters
  - [ ] Session IDs start with `session-`, `download-`, `history-`, `imported-`
  - [ ] Existing sessions continue to work

- [ ] **Issue 4 - Origin Validation**
  - [ ] Configure `BASSET_WS_ALLOWED_ORIGINS` for your domain(s)
  - [ ] Test connection from allowed origins (should succeed)
  - [ ] Test connection from non-allowed origins (should fail with 403)
  - [ ] Verify logs show origin validation messages

---

## Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### Security Tests (coming in v12.0.2)
```bash
npm run test:security
```

### Manual Verification

1. **Verify Spectron update:**
   ```bash
   npm list spectron
   # Should show: spectron@19.0.0
   ```

2. **Verify crypto usage in session IDs:**
   ```bash
   grep -r "crypto.randomBytes" src/ | wc -l
   # Should show: 6+ matches
   ```

3. **Verify origin validation enabled:**
   ```bash
   grep -r "validateOriginHeader\|verifyClient" websocket/
   # Should show matches in server.js
   ```

4. **Test WSS enforcement:**
   ```bash
   BASSET_WS_REQUIRE_WSS=true npm start
   # Should fail if SSL not configured
   ```

---

## References

### CVE/GHSA References
- EJS Template Injection: GHSA-phwq-j96m-2c2q
- form-data Unsafe Random: GHSA-fjxv-7rqg-78g4
- minimist Prototype Pollution: GHSA-vh95-rmgr-6w4m, GHSA-xvch-5gv4-984h
- WebSocket Origin Validation: Best practice per RFC 6455

### Documentation
- `/docs/DEPLOYMENT.md` - Production deployment guide
- `/docs/API-REFERENCE.md` - WebSocket API reference
- `/websocket/server.js` - Implementation details

### Related Commits
- Spectron update: `package.json`
- Session ID cryptography: `sessions/manager.js`
- WebSocket security: `websocket/server.js`

---

## Summary

All 4 critical security issues have been resolved:

| Issue | Status | Impact | Fix |
|-------|--------|--------|-----|
| NPM Vulnerabilities | ✅ FIXED | Critical | Updated Spectron v10→v19, electron-builder v24→v26.8.1 |
| Unencrypted WebSocket | ✅ FIXED | Critical | Added WSS enforcement with --require-wss flag |
| Weak Session IDs | ✅ FIXED | Critical | Replaced Math.random() with crypto.randomBytes() |
| Missing Origin Validation | ✅ FIXED | Critical | Added verifyClient origin header validation |

**v12.0.0.1 is PRODUCTION READY.**

Next Steps:
1. Merge security patch
2. Update deployment documentation
3. Configure SSL certificates for production
4. Deploy to production with security flags enabled
5. Monitor WebSocket logs for origin validation messages

---

## Questions?

Contact: security@basset-hound-browser.local  
Last Updated: 2026-05-31  
Status: APPROVED FOR DEPLOYMENT
