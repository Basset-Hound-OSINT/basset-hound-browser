# Phase 2 Medium-Priority Fixes - Architecture & Context

**Date:** June 20, 2026  
**Context:** How these 4 issues fit into the overall system  

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     External Consumers                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   AI Agents  │  │  Python SDK  │  │  Web UIs     │            │
│  │  (palletai)  │  │  (clients)   │  │  (dashboards)│            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          │   WebSocket      │   WebSocket      │   HTTP
          │   (encrypted)    │   (encrypted)    │   (UI)
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼───────────────────┐
│                  Basset Hound Browser                              │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │          WebSocket Server (websocket/server.js)             │ │
│  │                                                              │ │
│  │  M-001: HTTPS/WSS Enforcement ──────┐                       │ │
│  │  ├─ SSL Certificate Manager          │                       │ │
│  │  ├─ TLS 1.2+ Minimum                 │                       │ │
│  │  └─ Reject ws:// in production       │                       │ │
│  │                                       │                       │ │
│  │  Connection Pool ◄─────────────────────┘                     │ │
│  │  Command Dispatcher                                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────┼──────────────────────────────────┐   │
│  │                        │                                  │   │
│  │  ┌──────────────────────▼───────────────────┐             │   │
│  │  │  Extraction Module                       │             │   │
│  │  │  (extraction/)                           │             │   │
│  │  │  ┌────────────────────────────────────┐  │             │   │
│  │  │  │ M-002: HTML Sanitization           │  │             │   │
│  │  │  │ ├─ DOMPurify-based sanitizer      │  │             │   │
│  │  │  │ ├─ XSS prevention (20 tests)       │  │             │   │
│  │  │  │ ├─ Link/image sanitization        │  │             │   │
│  │  │  │ ├─ CSS attack prevention          │  │             │   │
│  │  │  │ └─ 3 sanitization modes           │  │             │   │
│  │  │  │    (strict/moderate/lenient)      │  │             │   │
│  │  │  └────────────────────────────────────┘  │             │   │
│  │  │  get_html (sanitized)                    │             │   │
│  │  │  extract_content (sanitized)             │             │   │
│  │  │  extract_links (sanitized)               │             │   │
│  │  └────────────────────────────────────────────────────────┘   │
│  │                                                                │
│  │  ┌──────────────────────────────────────┐                     │
│  │  │  Browser Control Module              │                     │
│  │  │  (browser/)                          │                     │
│  │  │  ┌────────────────────────────────┐  │                     │
│  │  │  │ M-003: WebRTC IP Redaction     │  │                     │
│  │  │  │ ├─ Leak detection engine       │  │                     │
│  │  │  │ ├─ ICE candidate monitoring    │  │                     │
│  │  │  │ ├─ IP leak blocking            │  │                     │
│  │  │  │ ├─ Proxy/Tor integration       │  │                     │
│  │  │  │ └─ Leak status reporting       │  │                     │
│  │  │  └────────────────────────────────┘  │                     │
│  │  │  navigate (with WebRTC blocking)     │                     │
│  │  │  get_url (leak detection possible)   │                     │
│  │  │  screenshot (after WebRTC audit)     │                     │
│  │  └──────────────────────────────────────┘                     │
│  │                                                                │
│  │  ┌──────────────────────────────────────┐                     │
│  │  │  Security Module (src/security/)     │                     │
│  │  │  ├─ SSL Cert Manager (M-001)        │                     │
│  │  │  ├─ Input Validator                 │                     │
│  │  │  ├─ Key Derivation Manager          │                     │
│  │  │  ├─ Access Control Manager          │                     │
│  │  │  ├─ Data Protection Manager         │                     │
│  │  │  ├─ HTML Sanitizer (M-002)          │                     │
│  │  │  ├─ WebRTC Leak Detector (M-003)    │                     │
│  │  │  └─ ... other security modules      │                     │
│  │  └──────────────────────────────────────┘                     │
│  │                                                                │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Python SDK (sdks/python-sdk/)                            │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │ M-004: Client SSL/TLS Support                        │  │   │
│  │  │ ├─ SSLConfig (cert/key/CA loading)                  │  │   │
│  │  │ ├─ SSLConfigLoader (env/file-based)                 │  │   │
│  │  │ ├─ SecureBrowserClient (wss:// enforcement)         │  │   │
│  │  │ ├─ MutualTLSClient (mTLS support)                   │  │   │
│  │  │ ├─ CertificatePinningClient (pinning support)       │  │   │
│  │  │ └─ HTMLValidator (sanitization validation)          │  │   │
│  │  │                                                      │  │   │
│  │  │ BrowserClient                                        │  │   │
│  │  │ ├─ connect() → wss:// with TLS validation           │  │   │
│  │  │ ├─ send_command()                                    │  │   │
│  │  │ ├─ get_html() (with validation)                      │  │   │
│  │  │ └─ ... all commands with SSL support                │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## How Each Issue Fits Into the System

### M-001: WSS/HTTPS Enforcement

**Location:** Network layer (websocket/server.js, src/security/ssl-certificate-manager.js)

**Why It Matters:**
- **Current Gap:** WebSocket server accepts unencrypted `ws://` connections
- **Impact:** All data traveling over the network is visible to network sniffers
- **Risk:** Credentials, session tokens, page content exposed to MITM attacks

**How It's Fixed:**
1. **SSL Certificate Manager** - Loads, validates, and monitors SSL/TLS certificates
2. **WebSocket HTTPS Enforcement** - Rejects `ws://` in production, requires `wss://`
3. **TLS Version Enforcement** - Minimum TLS 1.2, strong cipher suites
4. **Certificate Expiry Monitoring** - Warns 30 days before expiry

**Integration Points:**
- Affects ALL connections to the browser WebSocket server
- Transparent to existing command handlers (all work the same, just encrypted)
- Optional in development mode (backward compatible)
- Mandatory in production mode (security-first)

**Dependencies:**
- ✅ No dependencies on other Phase 2 issues
- ✅ Can be deployed independently
- ⬇️ Required before M-004 (Python client SSL)

---

### M-002: HTML Sanitization

**Location:** Content extraction layer (src/extraction/html-sanitizer.js)

**Why It Matters:**
- **Current Gap:** HTML extracted from web pages is returned raw without sanitization
- **Impact:** If consumed by a web UI without sanitization, XSS vulnerabilities emerge
- **Risk:** Attacker injects malicious scripts that execute in consumer's context

**How It's Fixed:**
1. **DOMPurify-based Sanitization** - Battle-tested HTML sanitizer library
2. **Whitelist Approach** - Only allow safe HTML elements and attributes
3. **Multiple Sanitization Modes** - Strict (safest), moderate (balanced), lenient (minimal)
4. **Per-Endpoint Enforcement** - Automatically sanitize get_html, extract_content, etc.
5. **Python Client Validation** - Optional server-side validation on Python SDK

**Integration Points:**
- `get_html()` command returns sanitized HTML + metadata
- `extract_content()` command returns sanitized content
- `extract_links()` command sanitizes link URLs
- `extract_images()` command sanitizes image sources
- All commands can specify sanitization_mode per-request

**Dependencies:**
- ✅ No dependencies on other Phase 2 issues
- ✅ Can be deployed independently
- ✅ Runs in parallel with other tracks

---

### M-003: WebRTC IP Redaction

**Location:** Privacy layer (src/security/webrtc-leak-detector.js, src/security/webrtc-blocker.js)

**Why It Matters:**
- **Current Gap:** WebRTC connections leak local IP addresses via ICE candidates
- **Impact:** Real IP exposed even when using proxy/Tor (defeats anonymity)
- **Risk:** Attacker can identify target despite anonymity measures

**How It's Fixed:**
1. **ICE Candidate Monitoring** - Detect IP leaks through WebRTC
2. **Leak Detection API** - `detect_webrtc_leaks` command to identify leaks
3. **WebRTC Blocking** - Disable WebRTC API to prevent leaks
4. **Proxy Integration** - Auto-enable blocking when proxy is active
5. **Tor Integration** - Auto-enable blocking when Tor mode is ON

**Integration Points:**
- New commands: `detect_webrtc_leaks`, `block_webrtc`, `get_webrtc_status`
- Auto-blocking when Tor mode is enabled
- Leak detection happens automatically on page navigation
- Status available via `get_webrtc_status` command

**Dependencies:**
- ✅ No dependencies on other Phase 2 issues
- ✅ Can be deployed independently
- ✅ Runs in parallel with other tracks
- ⬇️ Auto-integrates with Tor mode

---

### M-004: Python Client SSL/TLS

**Location:** Client layer (sdks/python-sdk/)

**Why It Matters:**
- **Current Gap:** Python SDK connects via plain `ws://` without cert validation
- **Impact:** MITM attacker can intercept, modify, or inject commands
- **Risk:** Command injection, response tampering, forensic integrity compromised

**How It's Fixed:**
1. **Enforce wss:// by default** - Reject `ws://` unless explicitly allowed
2. **Certificate Validation** - Verify server SSL/TLS certificate
3. **Mutual TLS Support** - Load client certificates for mTLS authentication
4. **Certificate Pinning** - Pin specific server certificates for extra security
5. **Config Loader** - Load SSL config from environment variables or files

**Integration Points:**
- `SecureBrowserClient` class enforces SSL/TLS
- `connect()` method validates certificate automatically
- `MutualTLSClient` class for mTLS authentication
- `CertificatePinningClient` class for certificate pinning
- All commands inherit SSL protection from connection

**Dependencies:**
- ⬆️ Depends on M-001 (server must support HTTPS)
- ✅ Can be developed in parallel with M-001
- ✅ Ready for integration once M-001 is complete

---

## Data Flow Through All 4 Issues

### Secure Data Flow (Post Phase 2)

```
1. CLIENT (Python SDK)
   └─ M-004: Create SecureBrowserClient with SSL config
      └─ Verify server SSL certificate
         └─ Establish wss:// connection with TLS 1.2+
            
2. NETWORK (M-001: HTTPS Enforcement)
   └─ Server receives connection on wss:// only
      └─ Verify client SSL/TLS handshake
         └─ Encrypt all subsequent data
            └─ Decrypt commands, encrypt responses

3. COMMAND HANDLER
   └─ Validate input (existing Input Validator)
      └─ Check authorization (existing Access Control)
         └─ Execute command
            └─ Prepare response

4. EXTRACTION (if get_html command)
   └─ Extract HTML from page
      └─ M-002: Sanitize HTML (DOMPurify)
         └─ Remove XSS, event handlers, data URIs
            └─ Return sanitized HTML

5. PRIVACY (if navigate command)
   └─ Navigate to URL
      └─ M-003: Monitor WebRTC for leaks
         └─ Block WebRTC if configured
            └─ Detect any IP leaks
               └─ Report leak status

6. RESPONSE
   └─ Prepare response (HTML sanitized, privacy verified)
      └─ Sign with HMAC (existing)
         └─ Encrypt with TLS (M-001)
            └─ Send to client

7. CLIENT RECEIVES (Python SDK)
   └─ M-004: Verify SSL/TLS connection still secure
      └─ Receive encrypted response
         └─ Decrypt with TLS
            └─ Verify HMAC signature
               └─ M-002: Optional validate HTML sanitization
                  └─ Use data in application
```

---

## Security Architecture

### Before Phase 2

```
                    ┌────────────────────────┐
                    │   Unencrypted ws://    │  ← Anyone can sniff
                    │   (no certificate)     │
                    └────────────────────────┘
                              │
                         Eavesdropping
                         MITM Attacks
                         Session Theft
```

### After Phase 2

```
    ┌─────────────────────────────────────────────────┐
    │  NETWORK SECURITY (M-001: WSS/HTTPS)           │
    │  ├─ TLS 1.2+ encryption                        │
    │  ├─ Valid SSL/TLS certificates                 │
    │  ├─ Strong cipher suites                       │
    │  └─ Certificate expiry monitoring              │
    └─────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────────────────────────────┐
    │  CONTENT SECURITY (M-002: HTML Sanitization)   │
    │  ├─ XSS attack prevention (20 test vectors)    │
    │  ├─ Event handler removal                      │
    │  ├─ Data URI blocking                          │
    │  └─ CSS attack prevention                      │
    └─────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────────────────────────────┐
    │  PRIVACY SECURITY (M-003: WebRTC Redaction)    │
    │  ├─ IP leak detection                          │
    │  ├─ WebRTC blocking                            │
    │  ├─ Proxy integration                          │
    │  └─ Tor integration                            │
    └─────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────────────────────────────┐
    │  CLIENT SECURITY (M-004: Python SSL/TLS)       │
    │  ├─ Certificate validation                     │
    │  ├─ Mutual TLS (mTLS)                          │
    │  ├─ Certificate pinning                        │
    │  └─ Config management                          │
    └─────────────────────────────────────────────────┘
```

---

## Testing Architecture

### Test Coverage Matrix

| Layer | Issue | Test Suite | Count | Coverage |
|-------|-------|-----------|-------|----------|
| Network | M-001 | wss-enforcement.test.js | 40 | 100% |
| Content | M-002 | html-sanitizer.test.js | 60 | 100% |
| Privacy | M-003 | webrtc-leak-detection.test.js | 30 | 100% |
| Client | M-004 | python-client-ssl.test.js | 20 | 100% |
| **TOTAL** | | | **150** | **100%** |

### Test Types

**Unit Tests** (140 tests)
- Individual module functionality
- Input/output validation
- Error handling
- Edge cases

**Integration Tests** (10 tests)
- Module interactions
- WebSocket command handling
- Full request/response cycle

**Security Tests** (included above)
- XSS payload testing (M-002)
- IP leak detection (M-003)
- Certificate validation (M-001, M-004)
- MITM attack scenarios

---

## Performance Impact Analysis

### M-001: WSS/HTTPS Enforcement
- **SSL Handshake:** ~50-100ms (one-time per connection)
- **Per-command overhead:** <1ms (negligible)
- **Expected impact:** Minimal (handshake only occurs at connection)

### M-002: HTML Sanitization
- **Small HTML (<10KB):** 2-5ms
- **Medium HTML (10-100KB):** 5-10ms
- **Large HTML (>100KB):** 10-50ms
- **Optimization:** DOMPurify is highly optimized, C++ based
- **Caching opportunity:** Results could be cached per URL

### M-003: WebRTC IP Redaction
- **Leak Detection:** 50-200ms (one-time per page)
- **Per-command overhead:** <1ms (monitoring only)
- **Blocking overhead:** <1ms (JavaScript injection)
- **Expected impact:** Low (async detection)

### M-004: Python Client SSL/TLS
- **Certificate Validation:** 10-50ms (per connection)
- **Per-command overhead:** <1ms (TLS layer handles it)
- **Expected impact:** Minimal (standard SSL/TLS overhead)

**Total Combined Impact:** <5ms per command (with caching)

---

## Integration Verification Checklist

### M-001 Integration
- [ ] SSL certificates load correctly from environment variables
- [ ] Server rejects `ws://` connections in production
- [ ] `wss://` connections succeed with valid certificates
- [ ] Certificate expiry warnings logged appropriately
- [ ] All 164 WebSocket commands work over wss://
- [ ] Backward compatibility: development mode accepts `ws://`

### M-002 Integration
- [ ] `get_html` returns sanitized HTML
- [ ] `extract_content` returns sanitized content
- [ ] `extract_links` returns clean link URLs
- [ ] `extract_images` returns clean image sources
- [ ] Sanitization metadata included in responses
- [ ] Per-request sanitization_mode override works
- [ ] Python SDK validation accepts/rejects HTML correctly

### M-003 Integration
- [ ] `detect_webrtc_leaks` command available
- [ ] `block_webrtc` command available
- [ ] `get_webrtc_status` command available
- [ ] WebRTC blocking applies before page load
- [ ] Proxy/Tor integration auto-enables blocking
- [ ] Leak detection works across page navigations

### M-004 Integration
- [ ] Python SDK accepts `wss://` URLs
- [ ] Python SDK rejects `ws://` URLs (by default)
- [ ] Certificate validation working
- [ ] mTLS authentication working
- [ ] Certificate pinning working
- [ ] Config loader works with env vars
- [ ] Config loader works with files

---

## Maintenance & Monitoring

### Post-Deployment Monitoring

**M-001: Certificate Management**
- Monitor certificate expiry dates
- Alert when certificates expire within 30 days
- Track SSL/TLS handshake failures
- Monitor TLS version distribution (ensure 1.2+)

**M-002: HTML Sanitization**
- Track sanitization rate (% of HTML requiring sanitization)
- Monitor for false positives (legitimate HTML being removed)
- Track sanitization performance (ms per command)
- Analyze most common XSS patterns blocked

**M-003: WebRTC Privacy**
- Track IP leak detection rate
- Monitor for WebRTC-related errors
- Analyze leak patterns (which sites leak most)
- Verify blocking effectiveness

**M-004: Client SSL/TLS**
- Monitor certificate validation failures
- Track mTLS authentication success rate
- Monitor connection errors (SSL/TLS related)
- Analyze SSL/TLS version distribution from clients

---

## Documentation Structure

### User-Facing Documentation
- **Deployment Guide:** How to enable SSL/TLS, load certificates
- **Client Guide:** How to use SecureBrowserClient, mTLS, certificate pinning
- **API Reference:** New WebRTC commands, sanitization options
- **Troubleshooting:** Common SSL/TLS issues, certificate problems

### Developer Documentation
- **Architecture Guide:** How each module fits together (this document)
- **Implementation Specs:** Detailed code specifications
- **Test Documentation:** Test case documentation, expected results
- **Integration Guide:** How to integrate modules with WebSocket server

---

## Future Enhancements

### Short-term (v12.2.0)
- [ ] Automatic certificate renewal
- [ ] HTML sanitization caching
- [ ] WebRTC exception whitelisting
- [ ] Cipher suite configuration

### Medium-term (v12.3.0)
- [ ] Certificate pinning in Python SDK
- [ ] Advanced WebRTC detection analytics
- [ ] HTML sanitization performance optimization
- [ ] MCP server SSL/TLS support

### Long-term (v12.4.0+)
- [ ] Hardware security module (HSM) integration
- [ ] Advanced threat detection in sanitization
- [ ] WebRTC analytics dashboard
- [ ] Automated certificate management

---

## Success Definition

**Phase 2 is successful when:**

1. ✅ All 150 tests passing
2. ✅ All 4 modules integrated with WebSocket server
3. ✅ Zero regressions in existing functionality
4. ✅ Performance impact <5ms per command
5. ✅ Security audit passed
6. ✅ Documentation complete and accurate
7. ✅ Deployed to staging successfully
8. ✅ Production deployment approved and tested

---

**Architecture Document Version:** 1.0  
**Status:** COMPLETE  
**Next Action:** Begin implementation with assigned teams

For implementation details, see: `/docs/PHASE2-MEDIUM-PRIORITY-SECURITY-FIXES-PLAN.md`  
For team assignments, see: `/docs/PHASE2-TEAM-ASSIGNMENTS-AND-DEPENDENCIES.md`
