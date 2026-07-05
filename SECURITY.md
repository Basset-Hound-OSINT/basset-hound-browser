# Security Documentation - Basset Hound Browser

**Version**: 12.8.0  
**Last Updated**: June 21, 2026  
**Status**: Production Ready  

---

## Overview

Basset Hound Browser implements comprehensive security controls to protect the API and system from common web automation and WebSocket vulnerabilities. This document describes the four critical security fixes that protect the browser's open WebSocket API.

**CRITICAL NOTICE**: This is a development tool with open access by design. No authentication is enforced. All commands are unrestricted in development mode. The security measures described here protect the system itself, not access control.

---

## Four Critical Security Fixes

### 1. Request Size Validation (DoS Prevention)

**What It Does**:
Validates incoming WebSocket request payloads to prevent denial-of-service attacks through oversized messages.

**Attack Vector Protected Against**:
- Memory exhaustion attacks (sending 1GB+ payload)
- Slowloris-style memory pressure
- Payload flooding with large binary data
- screenshot/capture command abuse with huge image data

**Implementation**:
Location: `/websocket/request-validator.js`

```javascript
const DEFAULT_LIMITS = {
  global: 100 * 1024 * 1024,           // 100 MB global maximum
  categories: {
    screenshot: 100 * 1024 * 1024,     // Large image payloads
    capture: 100 * 1024 * 1024,
    extraction: 50 * 1024 * 1024,      // HTML/DOM extraction
    analysis: 50 * 1024 * 1024,
    default: 10 * 1024 * 1024          // 10 MB default for others
  }
};
```

**Configuration Options**:

| Environment Variable | Default | Purpose |
|----------------------|---------|---------|
| `REQUEST_SIZE_LIMIT_GLOBAL` | 104857600 | Global max payload size (bytes) |
| `REQUEST_SIZE_LIMIT_SCREENSHOT` | 104857600 | Screenshot command limit |
| `REQUEST_SIZE_LIMIT_CAPTURE` | 104857600 | Capture command limit |
| `REQUEST_SIZE_LIMIT_EXTRACTION` | 52428800 | Extraction command limit |
| `REQUEST_SIZE_LIMIT_ANALYSIS` | 52428800 | Analysis command limit |
| `REQUEST_SIZE_LIMIT_DEFAULT` | 10485760 | Default for other commands |

**How to Configure**:
```bash
# Reduce screenshot limit to 50 MB for stricter control
export REQUEST_SIZE_LIMIT_SCREENSHOT=52428800

# Reduce global limit to 50 MB
export REQUEST_SIZE_LIMIT_GLOBAL=52428800

# Use in Docker
docker run -e REQUEST_SIZE_LIMIT_GLOBAL=52428800 basset-hound-browser
```

**Testing Protection**:
```bash
# Test that oversized request is rejected
node tests/security/request-size-validation.test.js
```

---

### 2. Rate Limiting (Command Flooding Prevention)

**What It Does**:
Enforces per-client and per-command rate limits using a sliding window algorithm to prevent command flooding attacks.

**Attack Vector Protected Against**:
- Rapid command flooding (1000s of requests/second)
- Expensive command spam (screenshots, script execution)
- Resource exhaustion through command repetition
- Denial of service through burst attacks

**Implementation**:
Location: `/websocket/rate-limiter.js`

**Default Rates** (requests per minute):
- Unauthenticated clients: 100 req/min
- Authenticated clients: 1000 req/min (auth disabled in dev)

**Per-Command Limits** (requests per minute):
| Command | Limit | Reason |
|---------|-------|--------|
| `screenshot` | 5 | CPU/memory intensive |
| `screenshot_viewport` | 5 | I/O heavy |
| `screenshot_element` | 8 | DOM query + render |
| `screenshot_full_page` | 3 | Most resource intensive |
| `execute_script` | 20 | Dangerous operation |
| `execute_async_script` | 15 | Async execution risk |
| `navigate` | 15 | Network/parsing cost |
| `create_profile` | 5 | File system operations |
| `get_content` | 100 | Safe read operation |
| `get_url` | 100 | Safe read operation |

**Configuration Options**:

| Environment Variable | Default | Purpose |
|----------------------|---------|---------|
| `RATE_LIMIT_ENABLED` | true | Enable rate limiting globally |
| `RATE_LIMIT_UNAUTHENTICATED` | 100 | Req/min for unauthenticated |
| `RATE_LIMIT_AUTHENTICATED` | 1000 | Req/min for authenticated |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Sliding window duration (ms) |
| `RATE_LIMIT_BURST_ALLOWANCE` | 10 | Extra requests allowed for spikes |
| `RATE_LIMIT_CLEANUP_INTERVAL` | 30000 | Cleanup data interval (ms) |

**How to Configure**:
```bash
# Disable rate limiting (not recommended)
export RATE_LIMIT_ENABLED=false

# Tighten limits for public deployment
export RATE_LIMIT_UNAUTHENTICATED=50

# Increase limits for internal testing
export RATE_LIMIT_AUTHENTICATED=5000

# Reduce window to 30 seconds
export RATE_LIMIT_WINDOW_MS=30000

# Use in Docker
docker run \
  -e RATE_LIMIT_UNAUTHENTICATED=50 \
  -e RATE_LIMIT_AUTHENTICATED=500 \
  basset-hound-browser
```

**Checking Rate Limit Status**:
```javascript
// Special command to check current rate limit status (doesn't count against limit)
{
  "id": "status-check-1",
  "command": "get_rate_limit_status"
}

// Response
{
  "success": true,
  "data": {
    "clientId": "client-abc123",
    "remaining": 47,
    "limit": 100,
    "window": "60000ms",
    "resetAt": 1687345678000,
    "commandLimits": {
      "screenshot": { "remaining": 4, "limit": 5 }
    }
  }
}
```

**Testing Protection**:
```bash
# Test rate limiting enforcement
node tests/security/rate-limiting.test.js
```

---

### 3. Path Validation (Path Traversal Prevention)

**What It Does**:
Validates all file system paths to prevent attackers from accessing files outside allowed directories through path traversal attacks (e.g., `../../etc/passwd`).

**Attack Vector Protected Against**:
- Directory traversal via `../` sequences
- Symlink escapes to system files
- Absolute path access to restricted areas
- Null byte injection in paths
- Access to configuration files, logs, or sensitive data

**Implementation**:
Location: `/utils/path-validator.js`

**Allowed Directories** (by default):
```javascript
allowedDirs: [
  path.join(homeDir, 'tmp'),
  path.join(process.cwd(), 'tmp'),
  path.join(process.cwd(), 'exports'),
  path.join(process.cwd(), 'logs'),
  path.join(process.cwd(), 'data')
]
```

**Security Checks Performed**:
1. Null byte detection (`\0` in path)
2. Parent directory reference detection (`../`)
3. Path resolution to absolute form
4. Symlink validation
5. Whitelist comparison
6. Real path verification (prevents symlink escapes)

**Configuration Options**:

| Option | Default | Purpose |
|--------|---------|---------|
| `allowedDirs` | See above | Directories accessible by commands |
| `strict` | true | Reject outside whitelist |
| `logViolations` | true | Log security violations |

**How to Configure**:
```javascript
// Custom configuration in server initialization
const validator = new PathValidator({
  allowedDirs: [
    '/home/user/basset-hound/data',
    '/mnt/shared-storage/exports'
  ],
  strict: true,
  logViolations: true
});
```

**Violation Logging**:
Path validation violations are tracked in:
- Console logs with `[PATH VIOLATION]` prefix
- In-memory violation history
- Statistics tracking

**Testing Protection**:
```bash
# Test path validation enforcement
node tests/security/path-validation.test.js
```

---

### 4. WebSocket Connection Validation (Connection Security)

**What It Does**:
Validates incoming WebSocket connections at the transport layer to prevent unauthorized access and enforce connection security policies.

**Attack Vector Protected Against**:
- Unauthenticated local network access (controlled by rate limiting + path validation)
- Invalid WebSocket handshake exploitation
- Connection pool exhaustion
- Hijacked connections

**Implementation**:
Location: `/websocket/server.js` (connection handler)

**Security Checks**:
1. WebSocket upgrade validation
2. Connection IP/port verification
3. Transport layer security (TLS support)
4. Per-connection resource tracking
5. Connection lifecycle management
6. Graceful shutdown on security violations

**Configuration Options**:

| Option | Default | Purpose |
|--------|---------|---------|
| `port` | 8765 | WebSocket server port |
| `secure` | false | Enable TLS/SSL (set cert paths to enable) |
| `certPath` | null | Path to SSL certificate |
| `keyPath` | null | Path to SSL private key |
| `maxConnections` | unlimited | Max concurrent connections |
| `connectionTimeout` | 30000ms | Connection timeout |

**How to Enable TLS**:
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configure server
export WS_SECURE=true
export WS_CERT_PATH=/path/to/cert.pem
export WS_KEY_PATH=/path/to/key.pem

# Connect via secure WebSocket
wss://localhost:8765
```

**Connection Security in Docker**:
```bash
docker run \
  -e WS_SECURE=true \
  -v /path/to/certs:/etc/certs \
  -e WS_CERT_PATH=/etc/certs/cert.pem \
  -e WS_KEY_PATH=/etc/certs/key.pem \
  basset-hound-browser
```

---

## Security Configuration by Deployment Scenario

### Development Environment (Default)
```bash
# Default: minimal restrictions for development
RATE_LIMIT_ENABLED=true
RATE_LIMIT_UNAUTHENTICATED=100
REQUEST_SIZE_LIMIT_GLOBAL=104857600
WS_SECURE=false
```

### Testing Environment
```bash
# Tight limits for security testing
RATE_LIMIT_ENABLED=true
RATE_LIMIT_UNAUTHENTICATED=50
RATE_LIMIT_AUTHENTICATED=500
REQUEST_SIZE_LIMIT_GLOBAL=52428800
REQUEST_SIZE_LIMIT_SCREENSHOT=52428800
```

### Production Deployment
```bash
# Production hardening
RATE_LIMIT_ENABLED=true
RATE_LIMIT_UNAUTHENTICATED=25
RATE_LIMIT_AUTHENTICATED=250
REQUEST_SIZE_LIMIT_GLOBAL=52428800
REQUEST_SIZE_LIMIT_SCREENSHOT=25165824  # 24 MB
REQUEST_SIZE_LIMIT_DEFAULT=5242880      # 5 MB
WS_SECURE=true
WS_CERT_PATH=/etc/certs/cert.pem
WS_KEY_PATH=/etc/certs/key.pem
```

### Docker Deployment with Limits
```dockerfile
FROM basset-hound-browser:12.8.0

# Security hardening
ENV RATE_LIMIT_UNAUTHENTICATED=25
ENV RATE_LIMIT_AUTHENTICATED=250
ENV REQUEST_SIZE_LIMIT_GLOBAL=52428800
ENV REQUEST_SIZE_LIMIT_SCREENSHOT=25165824
ENV WS_SECURE=true

COPY certs/cert.pem /etc/certs/
COPY certs/key.pem /etc/certs/
ENV WS_CERT_PATH=/etc/certs/cert.pem
ENV WS_KEY_PATH=/etc/certs/key.pem
```

---

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Rate Limit Violations**
   - Clients hitting rate limits
   - Potential flooding attacks
   - Integration issues (legitimate clients)

2. **Request Size Violations**
   - Commands exceeding size limits
   - Potential DoS attempts
   - Memory pressure events

3. **Path Validation Violations**
   - Path traversal attempts
   - Access to restricted areas
   - Suspicious file operations

4. **Connection Health**
   - Active connections count
   - Connection errors/drops
   - TLS certificate issues

### Logging Queries

```bash
# View rate limit violations
grep "rate limited" logs/websocket.log

# View path validation violations
grep "PATH VIOLATION" logs/security.log

# View request size violations
grep "SIZE_EXCEEDED\|OVERSIZED" logs/websocket.log

# Monitor active connections
tail -f logs/websocket.log | grep "Connected\|Disconnected"
```

---

## Security Best Practices

### 1. Always Use Rate Limiting
- Never disable rate limiting in production
- Adjust limits based on your use case
- Monitor for legitimate clients hitting limits

### 2. Keep Request Sizes Reasonable
- Set limits appropriate for your workload
- Monitor actual usage to calibrate
- Error 413 (Payload Too Large) indicates oversized requests

### 3. Validate File Paths
- Always use commands that validate paths
- Never construct paths from untrusted input
- Check violation logs regularly

### 4. Enable TLS in Production
- Always use WSS (WebSocket Secure) in production
- Use valid certificates (not self-signed)
- Configure certificate rotation

### 5. Network Isolation
- Run WebSocket server only on trusted networks
- Use firewall rules to restrict access
- Never expose port 8765 to public internet

### 6. Monitoring and Alerting
- Set up alerts for rate limit violations
- Monitor request size rejections
- Track path validation failures
- Alert on TLS certificate expiration

---

## Troubleshooting Security Issues

### "Client rate limited" errors
1. Check if legitimate use case
2. Increase rate limits if needed: `RATE_LIMIT_AUTHENTICATED=5000`
3. Verify client is batching requests properly
4. Check for client-side retry loops

### "Request size exceeded" errors
1. Increase appropriate size limit
2. Check if command should handle large payload
3. Verify no binary data encoding issues
4. Review recent API changes

### "Path is outside allowed directories" errors
1. Verify path is in allowed directories
2. Check for symlinks pointing outside
3. Review allowed directories configuration
4. Add new allowed directory if needed

### "TLS connection failed" errors
1. Verify certificate and key paths exist
2. Check certificate validity
3. Verify correct port (8765)
4. Check firewall rules

---

## Security Audit Checklist

- [ ] Rate limiting enabled in production
- [ ] Request size limits configured appropriately
- [ ] Path validation whitelist reviewed
- [ ] TLS certificates valid and not expired
- [ ] No environment variables in code
- [ ] Security logs monitored regularly
- [ ] Rate limit and path violation logs reviewed
- [ ] Connection attempt logs checked
- [ ] Firewall rules restrict network access
- [ ] Documentation updated for your deployment

---

## Reporting Security Issues

If you discover a security vulnerability:

1. Do NOT open a public GitHub issue
2. Email security details to: gnelsonbusi@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

4. Allow 7-10 days for response and fix

---

## References

- [OWASP WebSocket Security](https://owasp.org/www-community/attacks/WebSocket_Protocol)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html)
- [NIST SP 800-95: Guide to Secure Web Services](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-95.pdf)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-21 | Initial security documentation for v12.8.0 |

