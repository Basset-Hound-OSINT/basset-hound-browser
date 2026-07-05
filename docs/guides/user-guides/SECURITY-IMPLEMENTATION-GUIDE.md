# WebSocket Security Implementation Guide

## Overview

This guide covers the implementation of two critical security features for Basset Hound Browser:
1. **M-001: WSS/HTTPS Enforcement** - WebSocket Secure protocol enforcement
2. **M-003: WebRTC IP Leakage Prevention** - IP address redaction in device fingerprints

Both modules are designed for production deployment with comprehensive privacy and security controls.

---

## TASK A: WSS/HTTPS Enforcement (M-001)

### Module Location
- **Implementation**: `/websocket/security/wss-enforcer.js`
- **Tests**: `/tests/unit/wss-enforcer.test.js`

### Features
- ✅ Enforce WSS (WebSocket Secure) protocol in production
- ✅ Automatic HTTPS redirect for HTTP requests
- ✅ Certificate validation and enforcement
- ✅ Client certificate verification (optional)
- ✅ Mixed-mode fallback for development
- ✅ Secure cipher suite configuration
- ✅ TLS version enforcement (default: TLSv1.2+)

### Configuration

#### Environment Variables
```bash
# Enable WSS enforcement
NODE_ENV=production

# SSL/TLS Certificate Paths
BASSET_WS_SSL_CERT=/path/to/certificate.pem
BASSET_WS_SSL_KEY=/path/to/private-key.pem
BASSET_WS_SSL_CA=/path/to/ca-certificate.pem  # Optional, for client verification
```

#### Programmatic Configuration
```javascript
const { WSSEnforcer } = require('./websocket/security/wss-enforcer');

const enforcer = new WSSEnforcer({
  enforceWss: true,                    // Enforce WSS protocol
  enforceHttpsRedirect: true,          // Redirect HTTP to HTTPS
  allowMixedMode: false,               // Allow both HTTP and HTTPS (dev only)
  requireCertificate: true,            // Require SSL certificate
  minTlsVersion: 'TLSv1.2',           // Minimum TLS version
  certPath: '/path/to/cert.pem',      // SSL certificate
  keyPath: '/path/to/key.pem',        // Private key
  caPath: '/path/to/ca.pem',          // CA certificate (optional)
  httpPort: 8080,                      // HTTP redirect port
  httpsPort: 8765,                     // HTTPS/WSS port
  logger: logger                        // Logger instance
});
```

### Integration with WebSocket Server

#### Step 1: Initialize Enforcer
```javascript
const { WSSEnforcer } = require('./websocket/security/wss-enforcer');

// In WebSocketServer constructor
this.wssEnforcer = new WSSEnforcer({
  enforceWss: process.env.NODE_ENV === 'production',
  certPath: process.env.BASSET_WS_SSL_CERT,
  keyPath: process.env.BASSET_WS_SSL_KEY,
  logger: this.logger
});

// Validate configuration
const validation = this.wssEnforcer.validate();
if (!validation.valid) {
  this.logger.error('WSS Enforcer validation failed:', validation.errors);
  // Handle error based on enforceWss setting
}
```

#### Step 2: Load SSL Certificates
```javascript
// Replace _loadSslCertificates() with enforcer call
const sslOptions = this.wssEnforcer.loadSslOptions();

if (sslOptions) {
  this.httpsServer = https.createServer(sslOptions);
  this.wss = new WebSocket.Server({
    server: this.httpsServer
  });
} else {
  // Fall back to non-SSL server if not enforced
  const http = require('http');
  const server = http.createServer();
  this.wss = new WebSocket.Server({ server });
}
```

#### Step 3: Set Up HTTP Redirect (Optional)
```javascript
if (this.wssEnforcer.enforceHttpsRedirect) {
  const httpServer = this.wssEnforcer.createHttpRedirectServer();
  httpServer.listen(this.wssEnforcer.httpPort);
  this.logger.info(`HTTP redirect server listening on port ${this.wssEnforcer.httpPort}`);
}
```

#### Step 4: Validate WebSocket Upgrades
```javascript
// In WebSocket connection handler
this.wss.on('connection', (ws, req) => {
  // Validate protocol enforcement
  const validation = this.wssEnforcer.validateWebSocketUpgrade(req);
  if (!validation.valid) {
    this.logger.warn(`WebSocket upgrade rejected: ${validation.error}`);
    ws.close(4001, validation.error);
    return;
  }

  // Continue with normal connection handling
  // ...
});
```

#### Step 5: Use Middleware (Express-based servers)
```javascript
// If using Express for HTTP server
app.use((req, res, next) => {
  this.wssEnforcer.httpsRedirectMiddleware(req, res, next);
});
```

#### Step 6: Status Monitoring
```javascript
// Add status endpoint
this.commandHandlers.get_wss_status = async (params) => {
  return {
    success: true,
    wssStatus: this.wssEnforcer.getStatus()
  };
};
```

### Certificate Generation (Development)

For development/testing with self-signed certificates:

```bash
# Generate private key
openssl genrsa -out server-key.pem 2048

# Generate certificate
openssl req -new -x509 -key server-key.pem -out server-cert.pem -days 365 \
  -subj "/CN=localhost"

# Set environment variables
export BASSET_WS_SSL_CERT=/path/to/server-cert.pem
export BASSET_WS_SSL_KEY=/path/to/server-key.pem
```

### API Reference

#### WSSEnforcer Class

**Constructor Options:**
```javascript
{
  enforceWss: boolean,              // Enforce WSS (auto: true in production)
  enforceHttpsRedirect: boolean,    // Auto-redirect HTTP to HTTPS
  allowMixedMode: boolean,          // Allow both HTTP/HTTPS (dev only)
  requireCertificate: boolean,      // Require certificate when enforced
  minTlsVersion: string,            // Min TLS version (default: TLSv1.2)
  ciphers: string,                  // Custom cipher suite
  certPath: string,                 // Path to SSL certificate
  keyPath: string,                  // Path to private key
  caPath: string,                   // Path to CA certificate (optional)
  httpPort: number,                 // HTTP redirect port (default: 8080)
  httpsPort: number,                // HTTPS/WSS port (default: 8765)
  logger: object                     // Logger instance
}
```

**Methods:**

```javascript
// Validate configuration
validate() -> { valid: boolean, errors: string[] }

// Load SSL certificates
loadSslOptions() -> object | null

// Create HTTP redirect server
createHttpRedirectServer() -> http.Server

// Middleware for Express-like servers
httpsRedirectMiddleware(req, res, next) -> void

// Validate WebSocket upgrade request
validateWebSocketUpgrade(req) -> { valid: boolean, error?: string }

// Get current status
getStatus() -> object
```

### Testing

Run the comprehensive test suite:
```bash
npm test -- tests/unit/wss-enforcer.test.js
```

Test coverage includes:
- ✅ SSL certificate validation
- ✅ Protocol enforcement
- ✅ HTTP redirect behavior
- ✅ Middleware functionality
- ✅ WebSocket upgrade validation
- ✅ Configuration validation

---

## TASK B: WebRTC IP Leakage Prevention (M-003)

### Module Location
- **Implementation**: `/evasion/ip-redaction.js`
- **Tests**: `/tests/unit/ip-redaction.test.js`

### Features
- ✅ Extract and redact IP addresses from WebRTC candidates
- ✅ Mask IPs while preserving network topology (optional)
- ✅ Privacy mode options: mask, remove, obfuscate
- ✅ IPv4 and IPv6 support
- ✅ Consistent masking within a session
- ✅ Private IP special handling

### Configuration

#### Privacy Modes

```javascript
// Mode 1: MASK (default)
// Preserves IP format but changes actual address
// Example: 203.0.113.42 -> 203.0.114.156
// Use case: Maximum compatibility, still provides privacy

// Mode 2: REMOVE
// Completely removes IP addresses
// Example: 203.0.113.42 -> null
// Use case: Maximum privacy, may break some features

// Mode 3: OBFUSCATE
// Randomizes all octets
// Example: 203.0.113.42 -> 45.123.89.201
// Use case: Minimal footprint, prevents IP tracking
```

#### Programmatic Configuration
```javascript
const { IPRedactionManager } = require('./evasion/ip-redaction');

const redactor = new IPRedactionManager({
  enabled: true,                    // Enable IP redaction
  privacyMode: 'mask',             // 'mask', 'remove', 'obfuscate'
  consistentMasking: true,         // Consistent IP mapping per session
  preserveNetworkInfo: true,       // Preserve network topology hints
  logger: logger                    // Logger instance
});
```

### Integration with WebSocket Server

#### Step 1: Initialize IP Redaction Manager
```javascript
const { IPRedactionManager } = require('./evasion/ip-redaction');

// In WebSocketServer constructor
this.ipRedactor = new IPRedactionManager({
  enabled: process.env.NODE_ENV === 'production',
  privacyMode: process.env.IP_PRIVACY_MODE || 'mask',
  logger: this.logger
});
```

#### Step 2: Redact export_device_ids Command
```javascript
// Modify existing export_device_ids handler
this.commandHandlers.export_device_ids = async (params) => {
  try {
    // ... existing code to collect device data ...

    let deviceIdentifiers = {
      // ... device data ...
    };

    let fingerprint = {
      // ... fingerprint data ...
    };

    // Apply IP redaction
    if (this.ipRedactor && this.ipRedactor.enabled) {
      // Redact WebRTC data if present
      if (fingerprint.webrtc) {
        fingerprint.webrtc = this.ipRedactor.redactWebRTC(fingerprint.webrtc);
      }

      // Redact any direct IP fields
      if (deviceIdentifiers.ipv4) {
        deviceIdentifiers.ipv4 = this.ipRedactor.redactIPv4(deviceIdentifiers.ipv4);
      }
      if (deviceIdentifiers.ipv6) {
        deviceIdentifiers.ipv6 = this.ipRedactor.redactIPv6(deviceIdentifiers.ipv6);
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      deviceIdentifiers,
      fingerprint,
      ipRedactionApplied: this.ipRedactor?.enabled || false
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

#### Step 3: Add Privacy Mode Command
```javascript
this.commandHandlers.set_ip_privacy_mode = async (params) => {
  const { mode } = params;

  if (!['mask', 'remove', 'obfuscate'].includes(mode)) {
    return {
      success: false,
      error: `Invalid privacy mode: ${mode}. Must be 'mask', 'remove', or 'obfuscate'`
    };
  }

  this.ipRedactor.privacyMode = mode;

  return {
    success: true,
    privacyMode: mode,
    message: `IP privacy mode set to: ${mode}`
  };
};
```

#### Step 4: Add IP Redaction Status Command
```javascript
this.commandHandlers.get_ip_redaction_status = async (params) => {
  return {
    success: true,
    ipRedaction: this.ipRedactor.getStats()
  };
};
```

#### Step 5: Reset IP Mapping for New Sessions
```javascript
// When starting a new session or browser profile
this.commandHandlers.reset_session = async (params) => {
  // ... existing reset code ...

  // Reset IP mapping for new session
  if (this.ipRedactor) {
    this.ipRedactor.resetMapping();
  }

  return {
    success: true,
    message: 'Session reset, IP mapping cleared'
  };
};
```

### API Reference

#### IPRedactionManager Class

**Constructor Options:**
```javascript
{
  enabled: boolean,                // Enable IP redaction
  privacyMode: string,            // 'mask', 'remove', 'obfuscate'
  consistentMasking: boolean,     // Consistent mapping per session
  preserveNetworkInfo: boolean,   // Preserve topology hints
  logger: object                  // Logger instance
}
```

**Methods:**

```javascript
// Main redaction methods
redactFingerprint(fingerprintData) -> object
redactWebRTC(webrtcData) -> object
redactCandidate(candidate) -> string
redactIPv4(ipv4) -> string
redactIPv6(ipv6) -> string
redactIPsInString(str) -> string

// Session management
resetMapping() -> void

// Status and statistics
getStats() -> object
```

### Usage Examples

#### Example 1: Basic IP Redaction
```javascript
const redactor = new IPRedactionManager({ privacyMode: 'mask' });

const original = {
  webrtc: {
    ipv4: '203.0.113.42',
    ipv6: '2001:db8::1'
  }
};

const redacted = redactor.redactFingerprint(original);
// Result:
// {
//   webrtc: {
//     ipv4: '203.0.114.156',  // Masked
//     ipv6: '2001:db8::abc'   // Masked
//   }
// }
```

#### Example 2: WebRTC Candidate Redaction
```javascript
const redactor = new IPRedactionManager();

const candidate = 'candidate:1 1 udp 1234567 203.0.113.42 54321 typ srflx';
const redacted = redactor.redactCandidate(candidate);
// Result: 'candidate:1 1 udp 1234567 203.0.114.156 54321 typ srflx'
```

#### Example 3: Complete Removal
```javascript
const redactor = new IPRedactionManager({ privacyMode: 'remove' });

const ipv4 = '203.0.113.42';
const redacted = redactor.redactIPv4(ipv4);
// Result: null (completely removed)
```

#### Example 4: Session-Consistent Masking
```javascript
const redactor = new IPRedactionManager({ consistentMasking: true });

const ip = '203.0.113.42';
const mask1 = redactor._getMaskedIP(ip);
const mask2 = redactor._getMaskedIP(ip);
const mask3 = redactor._getMaskedIP(ip);

console.log(mask1 === mask2 === mask3); // true - consistent within session
```

### Testing

Run the comprehensive test suite:
```bash
npm test -- tests/unit/ip-redaction.test.js
```

Test coverage includes:
- ✅ All privacy modes (mask, remove, obfuscate)
- ✅ IPv4 and IPv6 redaction
- ✅ WebRTC candidate redaction
- ✅ Consistent session mapping
- ✅ Private IP special handling
- ✅ Mixed IPv4/IPv6 strings
- ✅ Edge cases and error handling

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] SSL certificates generated or obtained from certificate authority
- [ ] All environment variables configured correctly
- [ ] Security policies reviewed and approved
- [ ] Tests passing (100% success rate required)
- [ ] Load testing completed
- [ ] Documentation reviewed and updated

### Configuration Validation
```bash
# Test WSS enforcer validation
npm test -- tests/unit/wss-enforcer.test.js --verbose

# Test IP redaction
npm test -- tests/unit/ip-redaction.test.js --verbose

# Integration tests
npm test -- tests/integration/ --match "*security*"
```

### Monitoring
Monitor these metrics after deployment:
- WSS connection success rate (target: >99.9%)
- Certificate validation errors
- IP redaction statistics
- HTTPS redirect effectiveness
- TLS version distribution

### Rollback Procedure
If issues occur:
1. Set `NODE_ENV=development` to disable enforcement
2. Remove or comment out WSS enforcer initialization
3. Verify connectivity restored
4. Investigate root cause
5. Redeploy with fixes

---

## Security Considerations

### WSS/HTTPS
- ✅ TLSv1.2+ enforced in production
- ✅ Secure cipher suites only
- ✅ Certificate validation required
- ✅ HTTP requests redirected to HTTPS
- ✅ No fallback to unencrypted WebSocket

### IP Redaction
- ✅ All IPs masked or removed from fingerprints
- ✅ WebRTC candidates sanitized
- ✅ Consistent masking prevents unique identification
- ✅ Private IPs handled specially
- ✅ No IP leakage in device IDs export

---

## Troubleshooting

### Certificate Issues
```
Error: "SSL certificate file not found"
Solution: Verify BASSET_WS_SSL_CERT path and file permissions
```

```
Error: "Invalid certificate format: Expected PEM format"
Solution: Ensure certificate is in PEM format (-----BEGIN CERTIFICATE-----)
```

### WSS Connection Failures
```
Error: "WSS protocol required. Non-secure WebSocket connections not allowed"
Solution: Use wss:// protocol, not ws:// in production
```

### IP Redaction Not Working
```
Verify ipRedactor is initialized and enabled
Check privacy mode setting: 'mask', 'remove', or 'obfuscate'
Ensure redactFingerprint() is called before returning device IDs
```

---

## References

- [RFC 6455 - The WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [RFC 8446 - TLS 1.3](https://tools.ietf.org/html/rfc8446)
- [Mozilla TLS Configuration](https://wiki.mozilla.org/Security/Server_Side_TLS)
- [WebRTC Security](https://tools.ietf.org/html/draft-ietf-rtcweb-security)
