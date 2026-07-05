# Phase 2 Medium-Priority Security Fixes - Comprehensive Implementation Plan

**Status:** PLANNING COMPLETE  
**Document Date:** June 20, 2026  
**Priority Level:** MEDIUM  
**Total Estimated Effort:** 32-40 hours  
**Target Deployment:** June 29 - July 5, 2026  

---

## Executive Summary

This document provides detailed implementation specifications for 4 medium-priority security fixes that address enterprise-grade security gaps identified in post-deployment audits. Each fix is essential for production hardening but not immediately blocking (critical issues are addressed in parallel fast-track).

### Key Metrics
- **4 Issues to Fix**
- **8 Files to Create/Modify**
- **220+ Tests Required**
- **3 Parallel Execution Tracks**
- **2 Dependency Gates**

---

## Issue Breakdown & Implementation Details

---

## M-001: WSS/HTTPS Enforcement (4-8 hours)

### Problem Statement
Current WebSocket server supports both `ws://` (unencrypted) and `wss://` (encrypted) connections. In production, unencrypted connections expose all data to network sniffing, MITM attacks, and compliance violations.

**Current State:**
- WebSocket server accepts `ws://` and `wss://` transparently
- No enforcement of encrypted connections in production
- SSL/TLS config is optional
- Server startup doesn't validate certificate configuration

**Security Impact:**
- Data exposure (credentials, session tokens, page content)
- Man-in-the-middle injection attacks
- Session hijacking via network sniffing
- Compliance violations (GDPR, HIPAA)

### Implementation Approach

#### Phase 1: Configuration & Certificate Management

**File:** `/src/security/ssl-certificate-manager.js` (NEW - 250 lines)

```javascript
class SSLCertificateManager {
  constructor(options = {}) {
    // Certificate paths (required in production)
    this.certPath = options.certPath || process.env.SSL_CERT_PATH;
    this.keyPath = options.keyPath || process.env.SSL_KEY_PATH;
    this.caPath = options.caPath || process.env.SSL_CA_PATH;
    
    // Validation & monitoring
    this.enableValidation = options.enableValidation !== false;
    this.warningDaysBeforeExpiry = options.warningDaysBeforeExpiry || 30;
    this.expiryCheckIntervalMs = options.expiryCheckIntervalMs || 86400000; // 24h
    
    // State
    this.certificates = new Map(); // path -> { cert, key, ca, expiresAt }
    this.monitoringIntervals = [];
    this.expiryWarnings = [];
  }

  // Load and validate certificates
  loadCertificates() {
    // Implementation:
    // 1. Load cert, key, CA from files
    // 2. Parse with pem library
    // 3. Extract expiry date
    // 4. Validate certificate chain
    // 5. Verify private key matches certificate
    // 6. Return { cert, key, ca, expiresAt }
  }

  // Check if certificate will expire soon
  checkCertificateExpiry() {
    // Implementation:
    // 1. Parse expiry date from certificate
    // 2. Calculate days until expiry
    // 3. Warn if < warningDaysBeforeExpiry
    // 4. Return { isValid, expiresIn, warning }
  }

  // Validate certificate chain
  validateCertificateChain() {
    // Implementation:
    // 1. Verify certificate is signed by CA
    // 2. Check certificate validity period
    // 3. Validate CN/SAN matches domain
    // 4. Return { isValid, errors }
  }

  // Monitor certificate expiry with background task
  startExpiryMonitoring() {
    // Implementation:
    // 1. Schedule periodic checks
    // 2. Log warnings 30 days before expiry
    // 3. Log critical warnings 7 days before expiry
    // 4. Update expiryWarnings list
  }

  // Generate self-signed cert for development (NOT production)
  generateSelfSignedCertificate(domain) {
    // Implementation:
    // 1. Validate domain argument
    // 2. Generate RSA-4096 key pair
    // 3. Create certificate request
    // 4. Self-sign certificate
    // 5. Return { cert, key }
    // 6. WARNING: Only for development
  }

  // Get certificate expiry status for monitoring
  getExpiryStatus() {
    // Return { expiresIn, isExpired, warning, needsRenewal }
  }
}
```

**Features:**
- Load SSL/TLS certificates from environment variables
- Validate certificate chain integrity
- Monitor certificate expiry (warn 30 days before)
- Generate self-signed certs for development (with warnings)
- Secure key material handling
- Certificate renewal reminders

**Environment Variables:**
```bash
SSL_CERT_PATH=/etc/ssl/certs/server.crt
SSL_KEY_PATH=/etc/ssl/private/server.key
SSL_CA_PATH=/etc/ssl/certs/ca-bundle.crt
```

#### Phase 2: WebSocket Server Modifications

**File:** `/websocket/server.js` (MODIFY existing - 150 lines changed)

```javascript
class BassetHoundBrowserServer {
  constructor(port, mainWindow, options = {}) {
    this.port = port;
    this.mainWindow = mainWindow;
    
    // ENFORCEMENT: Validate SSL configuration
    if (process.env.NODE_ENV === 'production') {
      if (!options.disableHttpsEnforcement && !options.certPath && !process.env.SSL_CERT_PATH) {
        throw new Error(
          'WSS/HTTPS enforcement enabled: SSL certificate required in production. ' +
          'Set SSL_CERT_PATH or certPath option.'
        );
      }
    }

    // Load SSL certificates if provided
    if (options.certPath || process.env.SSL_CERT_PATH) {
      this.certManager = new SSLCertificateManager(options);
      this.certificates = this.certManager.loadCertificates();
      
      // Check certificate expiry on startup
      const expiryStatus = this.certManager.checkCertificateExpiry();
      if (expiryStatus.warning) {
        defaultLogger.warn(`Certificate expiry warning: ${expiryStatus.warning}`);
      }
      
      // Start background monitoring
      this.certManager.startExpiryMonitoring();
    }

    // Create HTTPS server if certificates available
    if (this.certificates) {
      this.httpServer = https.createServer(
        {
          cert: this.certificates.cert,
          key: this.certificates.key,
          ca: this.certificates.ca,
          // Security options
          ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256',
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.3'
        },
        (req, res) => {
          res.writeHead(426, { 'Content-Type': 'text/plain' });
          res.end('Use WebSocket upgrade request (wss://)');
        }
      );
    } else {
      this.httpServer = http.createServer((req, res) => {
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('Use WebSocket upgrade request (ws://)');
      });
    }

    // Create WebSocket server on HTTPS/HTTP server
    this.wss = new WebSocket.Server({ server: this.httpServer });
    
    // ENFORCEMENT: Block unencrypted connections in production
    this.wss.on('connection', (ws, req) => {
      if (process.env.NODE_ENV === 'production' && req.url.startsWith('ws://')) {
        ws.close(3000, 'Unencrypted WebSocket not allowed in production');
        defaultLogger.error('Rejected unencrypted WebSocket connection in production');
        return;
      }
      
      // Continue with normal connection handling
      this.handleConnection(ws, req);
    });
  }
}
```

**Key Changes:**
- Force HTTPS/WSS in production (throws on startup if no cert)
- Optional but recommended in development
- Load certificates from environment variables
- Monitor certificate expiry with background task
- Reject unencrypted `ws://` connections in production
- TLS 1.2+ minimum, strong ciphers

#### Phase 3: Python Client SSL/TLS Support

**File:** `/sdks/python-sdk/basset_hound_ssl.py` (NEW - 200 lines)

```python
import ssl
import asyncio
from pathlib import Path
from typing import Optional
import websockets
import logging

logger = logging.getLogger(__name__)

class SSLConfig:
    """SSL/TLS configuration for secure WebSocket connections"""
    
    def __init__(self, 
                 cert_path: Optional[str] = None,
                 key_path: Optional[str] = None,
                 ca_path: Optional[str] = None,
                 verify_cert: bool = True,
                 min_tls_version: str = 'TLSv1_2'):
        """
        Args:
            cert_path: Path to client certificate (optional)
            key_path: Path to client private key (optional)
            ca_path: Path to CA certificate bundle (optional)
            verify_cert: Whether to verify server certificate (default: True)
            min_tls_version: Minimum TLS version (TLSv1_2, TLSv1_3)
        """
        self.cert_path = cert_path
        self.key_path = key_path
        self.ca_path = ca_path
        self.verify_cert = verify_cert
        self.min_tls_version = min_tls_version
        
        # Validate certificate paths exist
        if cert_path and not Path(cert_path).exists():
            raise FileNotFoundError(f'Certificate not found: {cert_path}')
        if key_path and not Path(key_path).exists():
            raise FileNotFoundError(f'Key not found: {key_path}')
        if ca_path and not Path(ca_path).exists():
            raise FileNotFoundError(f'CA certificate not found: {ca_path}')

    def create_ssl_context(self) -> ssl.SSLContext:
        """Create SSL context for WebSocket connection"""
        
        # Select TLS version
        if self.min_tls_version == 'TLSv1_3':
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        else:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        
        # Load client certificate if provided
        if self.cert_path and self.key_path:
            context.load_cert_chain(
                certfile=self.cert_path,
                keyfile=self.key_path
            )
        
        # Load CA certificate if provided
        if self.ca_path:
            context.load_verify_locations(self.ca_path)
        
        # Verification settings
        if self.verify_cert:
            context.check_hostname = True
            context.verify_mode = ssl.CERT_REQUIRED
        else:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            logger.warning('Certificate verification disabled - use for development only')
        
        # Set strong ciphers and minimum TLS version
        context.set_ciphers('TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256')
        
        return context

class SecureBrowserClient:
    """Browser client with SSL/TLS support"""
    
    def __init__(self, url: str, ssl_config: Optional[SSLConfig] = None):
        self.url = url
        self.ssl_context = None
        
        if ssl_config:
            self.ssl_context = ssl_config.create_ssl_context()
        
        # Validate URL scheme matches SSL config
        if url.startswith('wss://') and not ssl_config:
            logger.warning('Using wss:// without SSL config - server certificate not verified')
        elif url.startswith('ws://') and ssl_config:
            raise ValueError('Cannot use SSL config with ws:// URL - use wss://')
    
    async def connect(self):
        """Connect with SSL/TLS support"""
        try:
            # websockets library handles ssl_context parameter
            self.ws = await websockets.connect(
                self.url,
                ssl=self.ssl_context if self.url.startswith('wss://') else None,
                timeout=30
            )
        except ssl.SSLError as e:
            logger.error(f'SSL/TLS connection failed: {e}')
            raise ConnectionError(f'SSL/TLS error: {e}')
        except Exception as e:
            logger.error(f'Connection failed: {e}')
            raise ConnectionError(f'Failed to connect: {e}')
```

**Features:**
- Load client certificates for mutual TLS (mTLS)
- Configure CA certificate for server verification
- Verify server certificate by default
- Support TLS 1.2+ only
- Strong cipher suite selection
- Clear error messages for certificate issues

#### Phase 4: Testing (40 tests)

**File:** `/tests/unit/security/wss-enforcement.test.js` (NEW - 500 lines)

```javascript
describe('WSS/HTTPS Enforcement', () => {
  // Certificate Manager Tests (12 tests)
  describe('SSLCertificateManager', () => {
    test('loads certificates from file paths', () => { /* ... */ });
    test('validates certificate chain integrity', () => { /* ... */ });
    test('extracts certificate expiry date', () => { /* ... */ });
    test('detects expired certificates', () => { /* ... */ });
    test('warns 30 days before expiry', () => { /* ... */ });
    test('generates self-signed certificates for development', () => { /* ... */ });
    test('validates private key matches certificate', () => { /* ... */ });
    test('handles missing certificate files gracefully', () => { /* ... */ });
    test('monitors certificate expiry with background task', () => { /* ... */ });
    test('logs warnings at appropriate intervals', () => { /* ... */ });
    test('validates certificate common name', () => { /* ... */ });
    test('handles certificate chain with intermediate CAs', () => { /* ... */ });
  });

  // WebSocket Server Tests (16 tests)
  describe('WebSocket Server HTTPS Enforcement', () => {
    test('requires certificates in production mode', () => { /* ... */ });
    test('accepts certificates in development mode', () => { /* ... */ });
    test('rejects unencrypted ws:// in production', () => { /* ... */ });
    test('accepts wss:// with valid certificate', () => { /* ... */ });
    test('rejects ws:// in production with SSL enforcement enabled', () => { /* ... */ });
    test('logs connection rejection events', () => { /* ... */ });
    test('uses TLS 1.2 as minimum version', () => { /* ... */ });
    test('enforces strong cipher suites', () => { /* ... */ });
    test('handles certificate loading failures gracefully', () => { /* ... */ });
    test('validates certificate paths before startup', () => { /* ... */ });
    test('supports certificate from environment variables', () => { /* ... */ });
    test('supports certificate from constructor options', () => { /* ... */ });
    test('creates HTTPS server when certificates available', () => { /* ... */ });
    test('creates HTTP server when certificates unavailable', () => { /* ... */ });
    test('performs certificate expiry check on startup', () => { /* ... */ });
    test('starts background certificate monitoring', () => { /* ... */ });
  });

  // Python Client Tests (12 tests)
  describe('Python Client SSL/TLS Support', () => {
    test('creates SSL context for wss:// URLs', () => { /* ... */ });
    test('loads client certificates for mTLS', () => { /* ... */ });
    test('validates client certificate and key match', () => { /* ... */ });
    test('loads CA certificate for server verification', () => { /* ... */ });
    test('rejects ws:// with SSL config', () => { /* ... */ });
    test('disables certificate verification in development', () => { /* ... */ });
    test('verifies server certificate by default', () => { /* ... */ });
    test('handles missing certificate files', () => { /* ... */ });
    test('connects successfully with valid certificates', () => { /* ... */ });
    test('fails gracefully with invalid certificates', () => { /* ... */ });
    test('supports TLS 1.2+ only', () => { /* ... */ });
    test('uses strong cipher suites', () => { /* ... */ });
  });
});
```

**Test Coverage:**
- Certificate loading and validation (12 tests)
- WebSocket server enforcement (16 tests)
- Python client SSL/TLS (12 tests)
- Total: 40 tests

### Effort Breakdown

| Task | Effort | Dependencies |
|------|--------|---|
| SSL Certificate Manager | 2h | None |
| WebSocket Server Modifications | 1.5h | SSL Manager |
| Python Client SSL/TLS | 2h | None |
| Testing (40 tests) | 2.5h | All code |
| **Total** | **8 hours** | - |

### Parallel Execution Opportunities
- SSL Manager and Python Client can be developed in parallel
- WebSocket modifications depend on SSL Manager only
- Testing can run alongside code development

### Quality Gates
1. ✅ All 40 tests passing
2. ✅ Certificate loading tested with real files
3. ✅ TLS 1.2+ enforced in production
4. ✅ Python client handles mTLS correctly
5. ✅ Backward compatibility maintained for development mode

---

## M-002: HTML Sanitization (16-24 hours)

### Problem Statement
The browser extracts and returns raw HTML from web pages. If this HTML is displayed in a web UI without sanitization, it creates XSS vulnerabilities. Additionally, extracted content may contain dangerous scripts that could execute in unintended contexts.

**Current State:**
- HTML extracted with `get_html` command returns raw, unfiltered content
- No sanitization of script tags, event handlers, or dangerous attributes
- Client-side sanitization optional and unreliable
- Image sources, links, and stylesheets not validated
- Data URIs and javascript: protocols allowed

**Security Impact:**
- XSS attacks via embedded scripts
- Phishing via malicious links
- Malware delivery via image sources
- CSS-based attacks via malicious stylesheets
- Event handler injection (onclick, onload, etc)
- Script execution via data URIs

### Implementation Approach

#### Phase 1: HTML Sanitizer Module

**File:** `/src/extraction/html-sanitizer.js` (NEW - 400 lines)

```javascript
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

class HTMLSanitizer {
  constructor(options = {}) {
    // Whitelist of allowed tags
    this.allowedTags = options.allowedTags || [
      'p', 'br', 'span', 'div', 'section', 'article',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'blockquote', 'pre', 'code', 'em', 'strong', 'b', 'i',
      'a', 'img', 'video', 'audio', 'source',
      'label', 'input', 'button', 'textarea', 'select', 'option',
      'form', 'fieldset', 'legend'
    ];

    // Whitelist of allowed attributes per tag
    this.allowedAttributes = options.allowedAttributes || {
      '*': ['id', 'class', 'data-*', 'title', 'aria-*'],
      'a': ['href', 'target', 'rel', 'title'],
      'img': ['src', 'alt', 'width', 'height', 'title'],
      'video': ['src', 'controls', 'width', 'height'],
      'audio': ['src', 'controls'],
      'source': ['src', 'type'],
      'input': ['type', 'name', 'value', 'placeholder', 'disabled'],
      'button': ['type', 'name', 'value', 'disabled'],
      'textarea': ['name', 'rows', 'cols', 'disabled'],
      'form': ['action', 'method', 'enctype'],
      'table': ['border', 'cellpadding', 'cellspacing'],
      'td': ['colspan', 'rowspan'],
      'th': ['colspan', 'rowspan']
    };

    // Dangerous protocols to block
    this.dangerousProtocols = [
      'javascript:',
      'data:text/html',
      'data:application/javascript',
      'vbscript:',
      'file:',
      'about:blank'
    ];

    // Event handlers to remove
    this.dangerousEventHandlers = [
      'onload', 'onerror', 'onclick', 'ondblclick',
      'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup',
      'onfocus', 'onblur', 'onchange', 'onsubmit',
      'onwheel', 'onscroll', 'ontouchstart', 'ontouchend',
      'onanimationstart', 'onanimationend', 'ontransitionend'
    ];

    // Dangerous CSS properties
    this.dangerousCssProperties = [
      'expression', 'behavior', '-moz-binding',
      'binding', 'behavior', 'javascript:' // in URLs
    ];

    // DOMPurify configuration
    this.purifyConfig = {
      ALLOWED_TAGS: this.allowedTags,
      ALLOWED_ATTR: Object.keys(this.allowedAttributes).flatMap(
        tag => this.allowedAttributes[tag]
      ),
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      FORCE_BODY: false,
      SANITIZE_DOM: true,
      IN_PLACE: false
    };
  }

  /**
   * Sanitize HTML content, removing dangerous elements and attributes
   */
  sanitize(html, options = {}) {
    const mode = options.mode || 'strict'; // strict, moderate, lenient
    const config = this.buildConfig(mode);

    try {
      // Step 1: Use DOMPurify for initial sanitization
      let sanitized = DOMPurify.sanitize(html, config);

      // Step 2: Parse with JSDOM for additional validation
      const dom = new JSDOM(sanitized);
      const document = dom.window.document;

      // Step 3: Additional validation and cleaning
      sanitized = this.validateAndClean(document, mode);

      // Step 4: Check for remaining dangerous patterns
      this.detectAnomalies(sanitized);

      return {
        html: sanitized,
        warnings: [],
        isClean: true,
        removed_elements: [],
        removed_attributes: []
      };
    } catch (error) {
      return {
        html: '', // Return empty on error
        warnings: [`Sanitization error: ${error.message}`],
        isClean: false,
        error: error.message
      };
    }
  }

  /**
   * Sanitize links, blocking dangerous protocols
   */
  sanitizeLink(href) {
    if (!href) return null;

    // Check for dangerous protocols
    const lowercaseHref = href.toLowerCase().trim();
    if (this.dangerousProtocols.some(proto => lowercaseHref.startsWith(proto))) {
      return null; // Block dangerous link
    }

    // Validate URL format
    try {
      new URL(href, 'http://example.com');
      return href;
    } catch {
      // Relative URL - allow
      if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
        return href;
      }
      return null; // Invalid URL
    }
  }

  /**
   * Sanitize image source, blocking data URIs and dangerous sources
   */
  sanitizeImageSrc(src) {
    if (!src) return null;

    const lowercaseSrc = src.toLowerCase().trim();

    // Block data URIs (can contain scripts)
    if (lowercaseSrc.startsWith('data:')) {
      return null;
    }

    // Block javascript: protocol
    if (lowercaseSrc.startsWith('javascript:')) {
      return null;
    }

    // Allow valid URLs
    try {
      new URL(src, 'http://example.com');
      return src;
    } catch {
      // Relative URL - allow
      if (src.startsWith('/') || src.startsWith('./')) {
        return src;
      }
      return null;
    }
  }

  /**
   * Remove event handlers from HTML
   */
  removeEventHandlers(html) {
    let cleaned = html;
    
    for (const handler of this.dangerousEventHandlers) {
      const regex = new RegExp(`\\s+${handler}\\s*=`, 'gi');
      cleaned = cleaned.replace(regex, ' ');
    }

    return cleaned;
  }

  /**
   * Remove dangerous style attributes
   */
  cleanStyleAttributes(html) {
    // This is complex - use regex to remove expressions and bindings
    return html
      .replace(/style\s*=\s*"[^"]*expression\s*\(/gi, 'style="')
      .replace(/style\s*=\s*"[^"]*behavior\s*:/gi, 'style="')
      .replace(/style\s*=\s*"[^"]*javascript:/gi, 'style="');
  }

  /**
   * Build sanitization config based on mode
   */
  buildConfig(mode) {
    const baseConfig = { ...this.purifyConfig };

    if (mode === 'strict') {
      // Maximum sanitization
      baseConfig.ALLOWED_TAGS = baseConfig.ALLOWED_TAGS.filter(
        tag => !['video', 'audio', 'source', 'form', 'input', 'button', 'textarea'].includes(tag)
      );
    } else if (mode === 'lenient') {
      // Allow more tags (but still safe)
      baseConfig.ALLOWED_TAGS = [
        ...baseConfig.ALLOWED_TAGS,
        'iframe', 'embed', 'script' // Still sanitized by DOMPurify
      ];
    }

    return baseConfig;
  }

  /**
   * Additional validation after DOMPurify
   */
  validateAndClean(document, mode) {
    // Remove script tags completely
    document.querySelectorAll('script').forEach(script => script.remove());

    // Clean all links
    document.querySelectorAll('a').forEach(link => {
      const sanitized = this.sanitizeLink(link.href);
      if (!sanitized) {
        link.removeAttribute('href');
        link.removeAttribute('onclick');
      }
    });

    // Clean all images
    document.querySelectorAll('img').forEach(img => {
      const sanitized = this.sanitizeImageSrc(img.src);
      if (!sanitized) {
        img.removeAttribute('src');
      }
    });

    // Remove all event handlers
    for (const handler of this.dangerousEventHandlers) {
      document.querySelectorAll('*').forEach(el => {
        el.removeAttribute(handler);
      });
    }

    return document.documentElement.outerHTML;
  }

  /**
   * Detect remaining anomalies that indicate attack
   */
  detectAnomalies(html) {
    const dangerousPatterns = [
      /javascript\s*:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /<script/gi
    ];

    const warnings = [];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(html)) {
        warnings.push(`Potential attack pattern detected: ${pattern.source}`);
      }
    }

    return warnings;
  }

  /**
   * Get sanitization statistics
   */
  getStats() {
    return {
      allowed_tags: this.allowedTags.length,
      dangerous_protocols: this.dangerousProtocols.length,
      dangerous_event_handlers: this.dangerousEventHandlers.length,
      dangerous_css_properties: this.dangerousCssProperties.length
    };
  }
}

module.exports = { HTMLSanitizer };
```

**Features:**
- DOMPurify-based sanitization
- Whitelist of safe HTML tags
- Whitelist of safe attributes per tag
- Block dangerous protocols (javascript:, data:, vbscript:)
- Remove event handlers (onclick, onload, etc)
- Clean style attributes
- Validate links and image sources
- Three sanitization modes (strict, moderate, lenient)
- Detailed reporting of what was removed

#### Phase 2: WebSocket Integration

**File:** `/websocket/server.js` (MODIFY - extract command - 50 lines)

```javascript
const { HTMLSanitizer } = require('../src/extraction/html-sanitizer');

class BassetHoundBrowserServer {
  constructor(port, mainWindow, options = {}) {
    // ... existing code ...

    // Initialize HTML sanitizer
    this.htmlSanitizer = new HTMLSanitizer({
      mode: options.htmlSanitizationMode || 'moderate', // strict, moderate, lenient
      enableSanitization: options.enableHtmlSanitization !== false
    });
  }

  async handleGetHtmlCommand(request, ws) {
    // ... existing extraction code ...
    
    let html = await this.getPageHtml(); // Original HTML
    
    // Sanitize HTML before returning
    if (this.htmlSanitizer.enabled) {
      const sanitized = this.htmlSanitizer.sanitize(html, {
        mode: request.sanitization_mode || 'moderate'
      });
      
      if (!sanitized.isClean) {
        defaultLogger.warn(`HTML sanitization issues: ${sanitized.warnings.join(', ')}`);
      }
      
      // Return sanitized HTML with metadata
      return {
        html: sanitized.html,
        html_sanitized: true,
        sanitization_warnings: sanitized.warnings,
        original_size: html.length,
        sanitized_size: sanitized.html.length,
        timestamp: new Date().toISOString(),
        // ... existing fields ...
      };
    } else {
      return {
        html: html,
        html_sanitized: false,
        timestamp: new Date().toISOString(),
        // ... existing fields ...
      };
    }
  }

  async handleExtractContentCommand(request, ws) {
    // Apply sanitization to extracted content
    // Similar pattern to get_html command
  }
}
```

**Key Changes:**
- Add HTML sanitizer to WebSocket server
- Sanitize HTML before returning from `get_html` command
- Sanitize extracted content from `extract_content`, `extract_links`, etc
- Return sanitization metadata (whether sanitized, warnings, size differences)
- Support per-request sanitization mode override

#### Phase 3: Client-Side Validation (Python SDK)

**File:** `/sdks/python-sdk/html_sanitizer.py` (NEW - 150 lines)

```python
import re
from typing import Optional, Dict, List
from urllib.parse import urlparse

class HTMLValidator:
    """Validate HTML returned from browser for dangerous content"""
    
    DANGEROUS_TAGS = {
        'script', 'iframe', 'object', 'embed', 'link',
        'style', 'meta', 'base', 'body', 'html'
    }
    
    DANGEROUS_ATTRIBUTES = {
        'on*': 'event handlers',
        'href': 'javascript: protocol',
        'src': 'javascript: or data: protocol',
        'style': 'dangerous CSS expressions',
        'formaction': 'attribute hijacking',
        'codebase': 'code execution'
    }
    
    DANGEROUS_PROTOCOLS = [
        'javascript:', 'data:', 'vbscript:', 'file:'
    ]

    @staticmethod
    def validate_html(html: str) -> Dict[str, any]:
        """Validate HTML for dangerous content"""
        
        issues = []
        
        # Check for script tags
        if re.search(r'<script\b', html, re.I):
            issues.append('Script tags detected')
        
        # Check for event handlers
        if re.search(r'\bon\w+\s*=', html, re.I):
            issues.append('Event handlers detected')
        
        # Check for dangerous protocols
        for protocol in HTMLValidator.DANGEROUS_PROTOCOLS:
            if re.search(re.escape(protocol), html, re.I):
                issues.append(f'Dangerous protocol detected: {protocol}')
        
        # Check for iframe
        if re.search(r'<iframe\b', html, re.I):
            issues.append('IFrame detected')
        
        return {
            'is_safe': len(issues) == 0,
            'issues': issues,
            'warning_count': len(issues)
        }
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Check if URL is safe"""
        if not url:
            return False
        
        # Block dangerous protocols
        for protocol in HTMLValidator.DANGEROUS_PROTOCOLS:
            if url.lower().startswith(protocol):
                return False
        
        # Check if URL is valid
        try:
            parsed = urlparse(url)
            return parsed.scheme in ('http', 'https', '') and bool(parsed.netloc or url.startswith('/'))
        except:
            return False

class BrowserClientWithValidation:
    """Browser client with HTML validation"""
    
    async def get_html_with_validation(self, selector=None):
        """Get HTML and validate it"""
        result = await self.get_html(selector=selector)
        
        validation = HTMLValidator.validate_html(result['html'])
        
        return {
            **result,
            'validation': validation,
            'is_safe': validation['is_safe']
        }
```

**Features:**
- Validate HTML returned from server
- Warn about dangerous patterns found
- Validate links before clicking
- Validate image sources
- Optional strict mode that raises errors

#### Phase 4: Testing (60 tests)

**File:** `/tests/unit/extraction/html-sanitizer.test.js` (NEW - 800 lines)

```javascript
describe('HTML Sanitization', () => {
  // XSS Attack Prevention (20 tests)
  describe('XSS Prevention', () => {
    test('removes script tags', () => { /* ... */ });
    test('removes event handlers (onclick)', () => { /* ... */ });
    test('removes event handlers (onload)', () => { /* ... */ });
    test('removes data URIs in img src', () => { /* ... */ });
    test('blocks javascript: protocol in links', () => { /* ... */ });
    test('blocks javascript: protocol in img src', () => { /* ... */ });
    test('removes onclick attributes', () => { /* ... */ });
    test('removes style attribute with expressions', () => { /* ... */ });
    test('blocks inline scripts in script tags', () => { /* ... */ });
    test('handles encoded XSS attempts', () => { /* ... */ });
    test('removes iframe tags', () => { /* ... */ });
    test('removes object and embed tags', () => { /* ... */ });
    test('sanitizes attribute injection attempts', () => { /* ... */ });
    test('handles mutation-based XSS', () => { /* ... */ });
    test('blocks SVG script elements', () => { /* ... */ });
    test('handles polyglot vectors', () => { /* ... */ });
    test('sanitizes HTML comments with scripts', () => { /* ... */ });
    test('removes form tags with dangerous actions', () => { /* ... */ });
    test('blocks base tag hijacking', () => { /* ... */ });
    test('handles BOM and null byte attacks', () => { /* ... */ });
  });

  // Link Sanitization (10 tests)
  describe('Link Sanitization', () => {
    test('allows valid http links', () => { /* ... */ });
    test('allows valid https links', () => { /* ... */ });
    test('allows relative links', () => { /* ... */ });
    test('allows mailto: links', () => { /* ... */ });
    test('blocks javascript: links', () => { /* ... */ });
    test('blocks data: links', () => { /* ... */ });
    test('blocks vbscript: links', () => { /* ... */ });
    test('validates URL structure', () => { /* ... */ });
    test('handles encoded protocols', () => { /* ... */ });
    test('preserves link attributes like title', () => { /* ... */ });
  });

  // Image Sanitization (10 tests)
  describe('Image Sanitization', () => {
    test('allows valid image URLs', () => { /* ... */ });
    test('allows relative image paths', () => { /* ... */ });
    test('blocks data: URIs in images', () => { /* ... */ });
    test('blocks javascript: in images', () => { /* ... */ });
    test('preserves width and height attributes', () => { /* ... */ });
    test('preserves alt text', () => { /* ... */ });
    test('handles malformed image URLs', () => { /* ... */ });
    test('validates image source structure', () => { /* ... */ });
    test('allows remote CDN images', () => { /* ... */ });
    test('handles encoded image URLs', () => { /* ... */ });
  });

  // CSS Attack Prevention (8 tests)
  describe('CSS Safety', () => {
    test('removes expression() in CSS', () => { /* ... */ });
    test('removes behavior: in CSS', () => { /* ... */ });
    test('removes -moz-binding in CSS', () => { /* ... */ });
    test('preserves safe CSS properties', () => { /* ... */ });
    test('validates CSS URLs', () => { /* ... */ });
    test('handles CSS attribute selectors', () => { /* ... */ });
    test('sanitizes CSS custom properties', () => { /* ... */ });
    test('prevents CSS-based CSRF tokens', () => { /* ... */ });
  });

  // Sanitization Modes (8 tests)
  describe('Sanitization Modes', () => {
    test('strict mode removes form elements', () => { /* ... */ });
    test('moderate mode allows forms', () => { /* ... */ });
    test('lenient mode allows more tags', () => { /* ... */ });
    test('custom modes can be defined', () => { /* ... */ });
    test('mode validation works correctly', () => { /* ... */ });
    test('per-request mode override works', () => { /* ... */ });
    test('default mode is moderate', () => { /* ... */ });
    test('invalid mode falls back to default', () => { /* ... */ });
  });

  // Edge Cases (4 tests)
  describe('Edge Cases', () => {
    test('handles empty HTML', () => { /* ... */ });
    test('handles malformed HTML', () => { /* ... */ });
    test('handles very large HTML documents', () => { /* ... */ });
    test('preserves valid HTML structure', () => { /* ... */ });
  });
});
```

**Test Coverage:**
- XSS prevention (20 tests)
- Link sanitization (10 tests)
- Image sanitization (10 tests)
- CSS safety (8 tests)
- Sanitization modes (8 tests)
- Edge cases (4 tests)
- Total: 60 tests

### Effort Breakdown

| Task | Effort | Dependencies |
|------|--------|---|
| HTML Sanitizer Module | 5h | DOMPurify library |
| WebSocket Integration | 1.5h | HTML Sanitizer |
| Python SDK Validation | 2h | None |
| Testing (60 tests) | 4h | All code |
| **Total** | **12.5 hours** | - |

### Parallel Execution Opportunities
- HTML Sanitizer and Python SDK validation can be parallel
- WebSocket integration depends on HTML Sanitizer
- Testing runs alongside code development

---

## M-003: WebRTC IP Redaction (8-16 hours)

### Problem Statement
WebRTC connections can leak the browser's real local IP address through ICE candidate gathering, even when using a proxy or Tor. This defeats anonymity measures and reveals network topology.

**Current State:**
- WebRTC enabled by default
- ICE candidates not filtered
- Local IP addresses exposed in WebRTC connections
- Proxy settings don't protect against WebRTC leaks
- Tor mode doesn't block WebRTC leaks

**Security Impact:**
- IP leak even when using anonymity measures
- Network topology disclosure
- Compromises proxy/Tor effectiveness
- Enables geolocation of target
- Breaks anonymity guarantee

### Implementation Approach

#### Phase 1: WebRTC Leak Detection

**File:** `/src/security/webrtc-leak-detector.js` (NEW - 300 lines)

```javascript
class WebRTCLeakDetector {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.blockLeaks = options.blockLeaks !== false; // Block by default
    this.expectedIPs = options.expectedIPs || []; // List of IPs that should be used
    this.logLeaks = options.logLeaks !== false;
    
    // Detection results storage
    this.detectedLeaks = new Map(); // Map of sessionId -> { ips, timestamp, severity }
    this.leakPatterns = [];
  }

  /**
   * Inject detection script into page to capture WebRTC connections
   * @returns {string} JavaScript code to inject
   */
  getDetectionScript() {
    return `
      window.__webrtcLeakDetector__ = {
        detectedIPs: [],
        leakLog: [],
        
        captureICECandidates() {
          const originalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
          
          if (!originalRTCPeerConnection) return;
          
          window.RTCPeerConnection = class extends originalRTCPeerConnection {
            constructor(...args) {
              super(...args);
              this.__iceLog__ = [];
              
              this.addEventListener('icecandidate', (event) => {
                if (event.candidate) {
                  const candidate = event.candidate.candidate;
                  const ipMatch = candidate.match(/([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})/);
                  
                  if (ipMatch) {
                    const ip = ipMatch[1];
                    window.__webrtcLeakDetector__.detectedIPs.push(ip);
                    window.__webrtcLeakDetector__.leakLog.push({
                      ip: ip,
                      candidate: candidate,
                      timestamp: new Date().toISOString()
                    });
                  }
                }
              });
            }
          };
          
          window.webkitRTCPeerConnection = window.RTCPeerConnection;
        },
        
        captureDataChannel() {
          const originalRTCDataChannel = window.RTCDataChannel;
          // Similar interception for data channel creation
        }
      };
      
      window.__webrtcLeakDetector__.captureICECandidates();
    `;
  }

  /**
   * Detect WebRTC leaks in page
   */
  async detectLeaks(page, sessionId) {
    try {
      // Inject detection script
      await page.evaluateOnNewDocument(this.getDetectionScript());
      
      // Wait for WebRTC activity
      await page.waitForFunction(
        () => window.__webrtcLeakDetector__.detectedIPs.length > 0,
        { timeout: 5000 }
      ).catch(() => null); // Timeout is OK - no WebRTC activity
      
      // Get detected IPs
      const results = await page.evaluate(() => ({
        detectedIPs: window.__webrtcLeakDetector__.detectedIPs,
        leakLog: window.__webrtcLeakDetector__.leakLog
      }));
      
      // Analyze results
      const analysis = this.analyzeLeaks(results.detectedIPs, results.leakLog);
      
      // Store for later review
      if (analysis.leaksDetected) {
        this.detectedLeaks.set(sessionId, {
          ips: results.detectedIPs,
          log: results.leakLog,
          analysis: analysis,
          timestamp: new Date().toISOString()
        });
      }
      
      return analysis;
    } catch (error) {
      console.error('WebRTC leak detection error:', error);
      return {
        leaksDetected: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze detected IPs to determine if they're leaks
   */
  analyzeLeaks(detectedIPs, leakLog) {
    if (!detectedIPs || detectedIPs.length === 0) {
      return {
        leaksDetected: false,
        detectedIPs: [],
        severity: 'none'
      };
    }

    // Filter out loopback and link-local
    const filtered = detectedIPs.filter(ip => {
      if (ip.startsWith('127.')) return false; // loopback
      if (ip.startsWith('169.254')) return false; // link-local
      return true;
    });

    // Check against expected IPs (from proxy/Tor)
    const leaks = filtered.filter(ip => !this.expectedIPs.includes(ip));

    return {
      leaksDetected: leaks.length > 0,
      detectedIPs: filtered,
      leakingIPs: leaks,
      expectedIPs: this.expectedIPs,
      severity: leaks.length > 0 ? 'critical' : 'low',
      leakCount: leaks.length,
      fullLog: leakLog
    };
  }

  /**
   * Block WebRTC to prevent leaks
   */
  getBlockScript() {
    return `
      // Block RTCPeerConnection creation
      window.RTCPeerConnection = undefined;
      window.webkitRTCPeerConnection = undefined;
      window.mozRTCPeerConnection = undefined;
      
      // Block getUserMedia
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new Error('getUserMedia blocked for privacy');
        };
      }
      
      // Block old-style getUserMedia
      navigator.getUserMedia = () => {
        throw new Error('getUserMedia blocked for privacy');
      };
    `;
  }

  /**
   * Get detected leaks for a session
   */
  getSessionLeaks(sessionId) {
    return this.detectedLeaks.get(sessionId) || null;
  }

  /**
   * Get all detected leaks
   */
  getAllLeaks() {
    return Array.from(this.detectedLeaks.values());
  }

  /**
   * Clear leak detection data
   */
  clearLeaks() {
    this.detectedLeaks.clear();
  }
}

module.exports = { WebRTCLeakDetector };
```

#### Phase 2: WebRTC Blocking

**File:** `/src/security/webrtc-blocker.js` (NEW - 200 lines)

```javascript
class WebRTCBlocker {
  constructor(options = {}) {
    this.blockingMode = options.blockingMode || 'disable-non-proxied'; // disable, disable-non-proxied
    this.enabled = options.enabled !== false;
    this.exceptions = options.exceptions || []; // URLs that allow WebRTC
  }

  /**
   * Get JavaScript to disable WebRTC entirely
   */
  getDisableScript() {
    return `
      // Disable WebRTC API
      (function() {
        // Block RTCPeerConnection
        ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection'].forEach(api => {
          if (window[api]) {
            window[api] = function() {
              throw new Error('WebRTC disabled for privacy protection');
            };
            window[api].prototype = {};
          }
        });
        
        // Block getUserMedia and getDisplayMedia
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = async () => {
            throw new Error('getUserMedia disabled for privacy protection');
          };
          navigator.mediaDevices.getDisplayMedia = async () => {
            throw new Error('getDisplayMedia disabled for privacy protection');
          };
        }
        
        // Block legacy getUserMedia
        ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia'].forEach(api => {
          if (navigator[api]) {
            navigator[api] = function() {
              throw new Error('getUserMedia disabled for privacy protection');
            };
          }
        });
      })();
    `;
  }

  /**
   * Get JavaScript to disable non-proxied WebRTC only
   */
  getBlockNonProxiedScript() {
    return `
      (function() {
        const originalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        
        if (!originalRTCPeerConnection) return;
        
        window.RTCPeerConnection = class extends originalRTCPeerConnection {
          constructor(config) {
            // Force all connections through proxy
            if (!config) config = {};
            if (!config.iceServers) config.iceServers = [];
            
            // Remove default ICE servers (which bypass proxy)
            config.iceServers = config.iceServers.filter(server => {
              // Keep only proxied servers
              if (server.urls) {
                return Array.isArray(server.urls) ? 
                  server.urls.every(url => url.includes('proxy') || url.includes('socks')) :
                  server.urls.includes('proxy') || server.urls.includes('socks');
              }
              return true; // Keep if no URLs specified
            });
            
            super(config);
            
            // Monitor and block non-proxied candidates
            this.addEventListener('icecandidate', (event) => {
              if (event.candidate) {
                const candidate = event.candidate.candidate;
                // Block host candidates (local IPs)
                if (candidate.includes('host ')) {
                  event.candidate = null;
                }
              }
            });
          }
        };
      })();
    `;
  }

  /**
   * Should block WebRTC for URL
   */
  shouldBlock(url) {
    if (!this.enabled) return false;
    
    // Check against exceptions
    return !this.exceptions.some(exc => url.includes(exc));
  }

  /**
   * Get appropriate blocking script
   */
  getBlockingScript() {
    if (this.blockingMode === 'disable-non-proxied') {
      return this.getBlockNonProxiedScript();
    } else {
      return this.getDisableScript();
    }
  }
}

module.exports = { WebRTCBlocker };
```

#### Phase 3: WebSocket Command Implementation

**File:** `/websocket/server.js` (MODIFY - add WebRTC commands - 50 lines)

```javascript
// Add to WebSocket command handlers
async handleWebRTCDetectLeaksCommand(request, ws) {
  const sessionId = request.session_id || 'default';
  const expectedIPs = request.expected_ips || [];
  
  try {
    const detector = new WebRTCLeakDetector({
      expectedIPs: expectedIPs
    });
    
    const analysis = await detector.detectLeaks(this.page, sessionId);
    
    return {
      leaks_detected: analysis.leaksDetected,
      severity: analysis.severity,
      detected_ips: analysis.detectedIPs,
      leaking_ips: analysis.leakingIPs,
      expected_ips: analysis.expectedIPs,
      leak_count: analysis.leakCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error.message,
      leaks_detected: null
    };
  }
}

async handleWebRTCBlockCommand(request, ws) {
  const blockMode = request.block_mode || 'disable'; // disable, disable-non-proxied
  
  try {
    const blocker = new WebRTCBlocker({
      blockingMode: blockMode,
      exceptions: request.exceptions || []
    });
    
    const blockScript = blocker.getBlockingScript();
    await this.page.evaluateOnNewDocument(blockScript);
    
    return {
      webrtc_blocked: true,
      block_mode: blockMode,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error.message,
      webrtc_blocked: false
    };
  }
}

async handleWebRTCStatusCommand(request, ws) {
  const sessionId = request.session_id || 'default';
  
  try {
    const detector = new WebRTCLeakDetector();
    const leaks = detector.getSessionLeaks(sessionId);
    
    return {
      webrtc_leaks: leaks ? {
        leaked_ips: leaks.ips,
        analysis: leaks.analysis,
        timestamp: leaks.timestamp
      } : null,
      session_id: sessionId
    };
  } catch (error) {
    return {
      error: error.message
    };
  }
}
```

**New WebSocket Commands:**
- `detect_webrtc_leaks` - Detect IP leaks via WebRTC
- `block_webrtc` - Block WebRTC to prevent leaks
- `get_webrtc_status` - Get WebRTC leak status for session

#### Phase 4: Testing (30 tests)

**File:** `/tests/unit/security/webrtc-leak-detection.test.js` (NEW - 600 lines)

```javascript
describe('WebRTC IP Redaction', () => {
  // Leak Detection (12 tests)
  describe('WebRTC Leak Detection', () => {
    test('detects IP leak via ICE candidates', () => { /* ... */ });
    test('captures ICE candidate information', () => { /* ... */ });
    test('filters loopback addresses', () => { /* ... */ });
    test('filters link-local addresses', () => { /* ... */ });
    test('identifies leaking IPs vs expected IPs', () => { /* ... */ });
    test('logs full leak information', () => { /* ... */ });
    test('handles no WebRTC activity', () => { /* ... */ });
    test('handles multiple ICE candidates', () => { /* ... */ });
    test('detects both IPv4 and IPv6 leaks', () => { /* ... */ });
    test('timestamps leak detection events', () => { /* ... */ });
    test('stores leaks by session ID', () => { /* ... */ });
    test('provides leak analysis summary', () => { /* ... */ });
  });

  // Leak Blocking (10 tests)
  describe('WebRTC Leak Blocking', () => {
    test('completely disables RTCPeerConnection', () => { /* ... */ });
    test('completely disables getUserMedia', () => { /* ... */ });
    test('blocks all WebRTC APIs', () => { /* ... */ });
    test('allows proxied WebRTC connections', () => { /* ... */ });
    test('blocks non-proxied host candidates', () => { /* ... */ });
    test('supports disable-non-proxied mode', () => { /* ... */ });
    test('supports full disable mode', () => { /* ... */ });
    test('applies to page before script execution', () => { /* ... */ });
    test('prevents WebRTC before page load', () => { /* ... */ });
    test('can be applied post-load to new pages', () => { /* ... */ });
  });

  // Integration (8 tests)
  describe('WebRTC Integration with Proxy/Tor', () => {
    test('blocks WebRTC when Tor is enabled', () => { /* ... */ });
    test('blocks WebRTC when proxy is configured', () => { /* ... */ });
    test('detects leaks when bypass proxy is used', () => { /* ... */ });
    test('maintains blocking across page navigations', () => { /* ... */ });
    test('works with multiple sessions', () => { /* ... */ });
    test('prevents cross-session IP identification', () => { /* ... */ });
    test('logs all WebRTC blocking events', () => { /* ... */ });
    test('allows monitoring of WebRTC status', () => { /* ... */ });
  });
});
```

### Effort Breakdown

| Task | Effort | Dependencies |
|------|--------|---|
| WebRTC Leak Detection | 3h | None |
| WebRTC Blocking Module | 2h | Detection module |
| WebSocket Integration | 1.5h | Both modules |
| Testing (30 tests) | 2.5h | All code |
| **Total** | **9 hours** | - |

### Parallel Execution Opportunities
- Detection and blocking modules can be developed in parallel (after initial design)
- WebSocket integration depends on both modules
- Testing runs alongside code development

---

## M-004: Python Client SSL/TLS (4-8 hours)

### Problem Statement
The Python SDK currently connects via plain `ws://` without SSL/TLS validation. This allows MITM attacks where attackers can intercept, modify, or inject commands. The SDK doesn't support mutual TLS (mTLS) for mutual authentication.

**Current State:**
- Python SDK uses `websockets` library without SSL context
- No certificate validation for server
- No support for client certificates (mTLS)
- Plain `ws://` connections in production examples
- No certificate pinning or validation

**Security Impact:**
- MITM attacks possible
- Command injection by attacker
- Response tampering
- Credential theft via response modification
- Breach of forensic chain of custody

### Implementation Approach

#### Phase 1: SSL Configuration Module (ALREADY DONE IN M-001)

See M-001 Section "Python Client SSL/TLS Support" - This is Phase 4 of that issue.

#### Phase 2: Enhanced Python SDK Integration

**File:** `/sdks/python-sdk/basset_hound_secure.py` (NEW - 250 lines)

```python
"""
Enhanced Basset Hound Browser SDK with full SSL/TLS support
"""

import asyncio
import ssl
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import websockets
from websockets.exceptions import InvalidStatusException, InvalidHeaderException

from basset_hound import BrowserClient
from basset_hound_ssl import SSLConfig

logger = logging.getLogger(__name__)


class SecureBrowserClient(BrowserClient):
    """Browser client with mandatory SSL/TLS support"""
    
    def __init__(self, 
                 url: str, 
                 ssl_config: Optional[SSLConfig] = None,
                 require_ssl: bool = True):
        """
        Initialize secure browser client
        
        Args:
            url: WebSocket URL (wss:// recommended)
            ssl_config: SSL/TLS configuration
            require_ssl: Require wss:// and certificate validation (default: True)
        
        Raises:
            ValueError: If require_ssl=True and url uses ws://
        """
        
        # Validate URL/SSL config combination
        if require_ssl:
            if url.startswith('ws://'):
                raise ValueError(
                    'require_ssl=True requires wss:// URL. '
                    'Either use wss:// or set require_ssl=False (not recommended)'
                )
            if not ssl_config:
                # Create minimal SSL config for certificate validation
                ssl_config = SSLConfig(verify_cert=True)
                logger.info('Using default SSL config with server cert validation')
        
        self.url = url
        self.ssl_config = ssl_config
        self.require_ssl = require_ssl
        self.ssl_context = None
        
        if ssl_config:
            self.ssl_context = ssl_config.create_ssl_context()
        
        super().__init__(url)
    
    async def connect(self):
        """Connect with SSL/TLS validation"""
        try:
            # Determine SSL context
            ssl_context = None
            if self.url.startswith('wss://'):
                ssl_context = self.ssl_context
                if not ssl_context and self.require_ssl:
                    # Create default SSL context for server cert validation
                    ssl_context = ssl.create_default_context()
            elif self.require_ssl:
                raise ValueError('wss:// URL required when require_ssl=True')
            
            # Connect with SSL context
            self.ws = await asyncio.wait_for(
                websockets.connect(
                    self.url,
                    ssl=ssl_context,
                    max_size=10 * 1024 * 1024,  # 10MB max message size
                    close_timeout=10,
                    ping_interval=30,
                    ping_timeout=10
                ),
                timeout=30.0
            )
            
            logger.info(f'Connected securely to {self.url}')
            return self.ws
            
        except ssl.SSLError as e:
            logger.error(f'SSL/TLS connection failed: {e}')
            raise ConnectionError(f'SSL/TLS handshake failed: {e}')
        except asyncio.TimeoutError:
            logger.error(f'Connection timeout to {self.url}')
            raise ConnectionError(f'Connection timeout after 30s: {self.url}')
        except InvalidStatusException as e:
            logger.error(f'Invalid WebSocket status: {e}')
            raise ConnectionError(f'Server returned invalid status: {e}')
        except Exception as e:
            logger.error(f'Connection failed: {type(e).__name__}: {e}')
            raise ConnectionError(f'Failed to connect: {e}')
    
    async def send_command(self, command: str, **kwargs) -> Dict[str, Any]:
        """Send command with SSL validation"""
        if not self.ws:
            raise ConnectionError('Not connected')
        
        try:
            return await super().send_command(command, **kwargs)
        except Exception as e:
            # Re-raise with context
            raise
    
    async def disconnect(self):
        """Disconnect cleanly"""
        if self.ws:
            await self.ws.close()
            logger.info('Disconnected from server')


class CertificatePinningClient(SecureBrowserClient):
    """Browser client with certificate pinning for extra security"""
    
    def __init__(self, 
                 url: str, 
                 pinned_cert_path: str,
                 ssl_config: Optional[SSLConfig] = None):
        """
        Initialize client with certificate pinning
        
        Args:
            url: WebSocket URL
            pinned_cert_path: Path to certificate to pin
            ssl_config: Additional SSL configuration
        """
        
        if not Path(pinned_cert_path).exists():
            raise FileNotFoundError(f'Pinned certificate not found: {pinned_cert_path}')
        
        self.pinned_cert_path = pinned_cert_path
        self.pinned_cert_hash = self._compute_cert_hash(pinned_cert_path)
        
        # Create SSL config with CA set to pinned cert
        if not ssl_config:
            ssl_config = SSLConfig(ca_path=pinned_cert_path, verify_cert=True)
        
        super().__init__(url, ssl_config=ssl_config)
    
    def _compute_cert_hash(self, cert_path: str) -> str:
        """Compute SHA-256 hash of certificate for pinning"""
        import hashlib
        with open(cert_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    
    async def connect(self):
        """Connect and verify pinned certificate"""
        try:
            # Get server certificate
            ws = await super().connect()
            
            # Verify pinned certificate
            # Note: Full verification requires additional work with ssl module
            logger.info(f'Connected with pinned certificate')
            
            return ws
        except Exception as e:
            logger.error(f'Certificate pinning validation failed: {e}')
            raise


class MutualTLSClient(SecureBrowserClient):
    """Browser client with mutual TLS (mTLS) authentication"""
    
    def __init__(self,
                 url: str,
                 client_cert_path: str,
                 client_key_path: str,
                 ca_cert_path: str):
        """
        Initialize mTLS client
        
        Args:
            url: WebSocket URL
            client_cert_path: Path to client certificate
            client_key_path: Path to client private key
            ca_cert_path: Path to CA certificate
        """
        
        ssl_config = SSLConfig(
            cert_path=client_cert_path,
            key_path=client_key_path,
            ca_path=ca_cert_path,
            verify_cert=True
        )
        
        super().__init__(url, ssl_config=ssl_config)
        logger.info('Mutual TLS (mTLS) configured')
    
    async def connect(self):
        """Connect with mutual TLS"""
        try:
            ws = await super().connect()
            logger.info('Connected with mutual TLS authentication')
            return ws
        except ssl.SSLError as e:
            logger.error(f'mTLS authentication failed: {e}')
            raise ConnectionError(f'mTLS failed: {e}')


# Usage examples
async def example_basic_ssl():
    """Basic SSL/TLS connection"""
    client = SecureBrowserClient('wss://localhost:8765')
    try:
        await client.connect()
        content = await client.get_content()
        print(content)
    finally:
        await client.disconnect()


async def example_with_config():
    """Connection with custom SSL config"""
    ssl_config = SSLConfig(
        ca_path='/etc/ssl/certs/ca-bundle.crt',
        verify_cert=True
    )
    client = SecureBrowserClient('wss://browser.example.com:8765', ssl_config=ssl_config)
    await client.connect()
    # ... commands ...
    await client.disconnect()


async def example_mtls():
    """Mutual TLS connection"""
    client = MutualTLSClient(
        'wss://browser.example.com:8765',
        client_cert_path='/etc/ssl/certs/client.crt',
        client_key_path='/etc/ssl/private/client.key',
        ca_cert_path='/etc/ssl/certs/ca-bundle.crt'
    )
    await client.connect()
    # ... commands ...
    await client.disconnect()


if __name__ == '__main__':
    asyncio.run(example_basic_ssl())
```

**Features:**
- Mandatory SSL/TLS by default
- Certificate validation
- Certificate pinning support
- Mutual TLS (mTLS) support
- Clear error messages
- Logging of SSL/TLS events
- Timeout handling
- Connection validation

#### Phase 3: Configuration Management

**File:** `/sdks/python-sdk/ssl_config_loader.py` (NEW - 150 lines)

```python
"""
Load SSL configuration from environment variables or files
"""

import os
from pathlib import Path
from typing import Optional
from basset_hound_ssl import SSLConfig
import logging

logger = logging.getLogger(__name__)


class SSLConfigLoader:
    """Load SSL configuration from environment or config file"""
    
    ENV_VARS = {
        'cert': 'BASSET_SSL_CERT_PATH',
        'key': 'BASSET_SSL_KEY_PATH',
        'ca': 'BASSET_SSL_CA_PATH',
        'verify': 'BASSET_SSL_VERIFY_CERT',
        'min_tls': 'BASSET_SSL_MIN_TLS_VERSION'
    }
    
    @staticmethod
    def from_environment() -> Optional[SSLConfig]:
        """Load SSL config from environment variables"""
        
        cert_path = os.getenv(SSLConfigLoader.ENV_VARS['cert'])
        key_path = os.getenv(SSLConfigLoader.ENV_VARS['key'])
        ca_path = os.getenv(SSLConfigLoader.ENV_VARS['ca'])
        verify = os.getenv(SSLConfigLoader.ENV_VARS['verify'], 'true').lower() == 'true'
        min_tls = os.getenv(SSLConfigLoader.ENV_VARS['min_tls'], 'TLSv1_2')
        
        # If no SSL env vars, return None
        if not any([cert_path, key_path, ca_path]):
            return None
        
        # Validate paths exist
        for path_name, path_var in [('cert', cert_path), ('key', key_path), ('ca', ca_path)]:
            if path_var and not Path(path_var).exists():
                logger.warning(f'{path_name} path does not exist: {path_var}')
        
        return SSLConfig(
            cert_path=cert_path,
            key_path=key_path,
            ca_path=ca_path,
            verify_cert=verify,
            min_tls_version=min_tls
        )
    
    @staticmethod
    def from_file(config_path: str) -> Optional[SSLConfig]:
        """Load SSL config from JSON or YAML file"""
        import json
        
        if not Path(config_path).exists():
            raise FileNotFoundError(f'Config file not found: {config_path}')
        
        with open(config_path) as f:
            config = json.load(f)
        
        # Validate required fields
        if 'ssl' not in config:
            return None
        
        ssl_config = config['ssl']
        
        return SSLConfig(
            cert_path=ssl_config.get('cert_path'),
            key_path=ssl_config.get('key_path'),
            ca_path=ssl_config.get('ca_path'),
            verify_cert=ssl_config.get('verify_cert', True),
            min_tls_version=ssl_config.get('min_tls_version', 'TLSv1_2')
        )
    
    @staticmethod
    def auto_load() -> Optional[SSLConfig]:
        """Auto-load SSL config from environment or default paths"""
        
        # Try environment variables first
        config = SSLConfigLoader.from_environment()
        if config:
            logger.info('Loaded SSL config from environment variables')
            return config
        
        # Try default config files
        default_paths = [
            '/etc/basset-hound/ssl-config.json',
            '~/.basset-hound/ssl-config.json',
            './ssl-config.json'
        ]
        
        for path in default_paths:
            expanded_path = os.path.expanduser(path)
            if Path(expanded_path).exists():
                try:
                    config = SSLConfigLoader.from_file(expanded_path)
                    if config:
                        logger.info(f'Loaded SSL config from {expanded_path}')
                        return config
                except Exception as e:
                    logger.warning(f'Failed to load SSL config from {expanded_path}: {e}')
        
        logger.debug('No SSL config found in environment or default paths')
        return None
```

#### Phase 4: Testing (20 tests)

**File:** `/tests/unit/sdks/python-client-ssl.test.js` (NEW - 400 lines)

Note: These would be Python tests, but shown here in test framework format for clarity.

```python
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from basset_hound_secure import SecureBrowserClient, MutualTLSClient, CertificatePinningClient
from basset_hound_ssl import SSLConfig


class TestSecureBrowserClient:
    """Test SSL/TLS-enabled browser client"""
    
    @pytest.mark.asyncio
    async def test_rejects_ws_url_when_ssl_required(self):
        """Should reject plain ws:// when SSL required"""
        with pytest.raises(ValueError, match='wss://'):
            SecureBrowserClient('ws://localhost:8765', require_ssl=True)
    
    @pytest.mark.asyncio
    async def test_accepts_wss_url_when_ssl_required(self):
        """Should accept wss:// when SSL required"""
        client = SecureBrowserClient('wss://localhost:8765', require_ssl=True)
        assert client.url == 'wss://localhost:8765'
    
    @pytest.mark.asyncio
    async def test_creates_ssl_context(self):
        """Should create SSL context from config"""
        ssl_config = SSLConfig(verify_cert=True)
        client = SecureBrowserClient('wss://localhost:8765', ssl_config=ssl_config)
        assert client.ssl_context is not None
    
    @pytest.mark.asyncio
    async def test_validates_certificate(self):
        """Should validate server certificate"""
        # This test requires a real server with valid cert
        pass
    
    @pytest.mark.asyncio
    async def test_handles_ssl_error(self):
        """Should handle SSL connection errors gracefully"""
        # Mock websockets.connect to raise SSL error
        pass
    
    @pytest.mark.asyncio
    async def test_handles_timeout(self):
        """Should handle connection timeout"""
        # Mock asyncio.wait_for to timeout
        pass
    
    @pytest.mark.asyncio
    async def test_sends_command_securely(self):
        """Should send commands over SSL"""
        # Mock WebSocket connection
        pass
    
    @pytest.mark.asyncio
    async def test_disconnects_cleanly(self):
        """Should close connection cleanly"""
        # Mock WebSocket
        pass


class TestMutualTLSClient:
    """Test mutual TLS (mTLS) client"""
    
    def test_requires_all_certificates(self):
        """Should require cert, key, and CA"""
        # Test that missing any certificate raises error
        pass
    
    def test_loads_client_certificate(self):
        """Should load client certificate and key"""
        pass
    
    def test_loads_ca_certificate(self):
        """Should load CA certificate"""
        pass
    
    @pytest.mark.asyncio
    async def test_authenticates_with_client_cert(self):
        """Should authenticate with client certificate"""
        pass
    
    @pytest.mark.asyncio
    async def test_fails_without_valid_client_cert(self):
        """Should fail if client cert is invalid"""
        pass
    
    @pytest.mark.asyncio
    async def test_fails_without_ca_validation(self):
        """Should fail if CA doesn't match"""
        pass


class TestCertificatePinning:
    """Test certificate pinning"""
    
    def test_requires_pinned_cert(self):
        """Should require pinned certificate path"""
        pass
    
    def test_validates_cert_exists(self):
        """Should validate certificate file exists"""
        pass
    
    def test_computes_cert_hash(self):
        """Should compute certificate hash"""
        pass
    
    @pytest.mark.asyncio
    async def test_fails_with_wrong_cert(self):
        """Should fail if server cert doesn't match pin"""
        pass
    
    @pytest.mark.asyncio
    async def test_succeeds_with_correct_cert(self):
        """Should succeed with correct cert"""
        pass


class TestSSLConfigLoader:
    """Test SSL configuration loading"""
    
    def test_loads_from_environment(self):
        """Should load config from env vars"""
        pass
    
    def test_loads_from_file(self):
        """Should load config from JSON file"""
        pass
    
    def test_auto_loads_config(self):
        """Should auto-load from env or files"""
        pass
    
    def test_validates_config_file(self):
        """Should validate config file format"""
        pass
    
    def test_returns_none_if_no_config(self):
        """Should return None if no config found"""
        pass
```

**Test Coverage:**
- Secure client basic functionality (8 tests)
- Mutual TLS (6 tests)
- Certificate pinning (5 tests)
- Configuration loading (4 tests)
- Total: 23 tests (rounded to 20 for conservative estimate)

### Effort Breakdown

| Task | Effort | Dependencies |
|------|--------|---|
| SSL Configuration Module | 1.5h | (Part of M-001) |
| Secure Browser Client | 2h | SSL module |
| Configuration Loader | 1h | None |
| Testing (20 tests) | 1.5h | All code |
| **Total** | **6 hours** | - |

Note: This issue builds on M-001's SSL/TLS infrastructure

---

# Summary & Parallel Execution Plan

## Issue Summary Table

| Issue | Title | Effort | Files | Tests |
|-------|-------|--------|-------|-------|
| **M-001** | WSS/HTTPS Enforcement | 8h | 3 create, 1 modify | 40 |
| **M-002** | HTML Sanitization | 12.5h | 2 create, 1 modify | 60 |
| **M-003** | WebRTC IP Redaction | 9h | 3 create, 1 modify | 30 |
| **M-004** | Python Client SSL/TLS | 6h | 3 create, 0 modify | 20 |
| **TOTAL** | | **35.5h** | **11-12** | **150** |

## Quick Wins (High Value, Low Effort)

1. **M-004: Python Client SSL Config Loader** (1 hour)
   - Load SSL config from environment variables
   - Value: Immediate production hardening path for clients
   - Can be deployed independently

2. **M-001: WebSocket Server HTTPS Check** (1 hour)
   - Add production HTTPS enforcement to server startup
   - Value: Prevents accidental unencrypted deployments
   - Minimum viable but high impact

3. **M-003: WebRTC Disable Script** (1 hour)
   - Simple JavaScript to disable WebRTC API
   - Value: Immediate IP leak prevention
   - Can be applied to existing pages

**Quick Wins Total: 3 hours, immediately deployable as hotfixes**

## Feature Gaps & Performance Improvements

### Feature Gaps Identified
1. **Certificate Renewal Automation** - Manual process currently
2. **SSL Cipher Suite Configuration** - Hardcoded currently
3. **WebRTC Exception Whitelisting** - For services that require it
4. **HTML Sanitization Caching** - Repeated sanitization overhead
5. **Leak Detection Analytics** - Summary reports missing

### Performance Improvements Possible
1. **HTML Sanitizer Caching** (1-2h) - Cache sanitized HTML per URL
2. **WebRTC Detection Preloading** (1h) - Pre-compute leak detection
3. **Certificate Checking Async** (0.5h) - Don't block on cert validation
4. **Python Client Connection Pool** (2h) - Reuse SSL contexts

**Potential Performance Gains: 0.5-1ms per command after caching**

## Integration Issues to Fix

1. **M-001 + Server**: Ensure backward compatibility with development ws://
2. **M-002 + Extraction**: Apply sanitization consistently to all HTML endpoints
3. **M-003 + Proxy/Tor**: Auto-enable WebRTC blocking when proxy active
4. **M-004 + MCP**: MCP server also needs SSL support (separate issue)

## Parallel Execution Tracks

### Track 1: Network Security (M-001, M-004)
- **Duration:** 14 hours (can run in parallel 8h + 6h)
- **Dependencies:** None until integration
- **Integration:** 2 hours (WebSocket modifications)
- **Parallelism:** 100% (independent)

### Track 2: Content Security (M-002)
- **Duration:** 12.5 hours
- **Dependencies:** None until integration
- **Integration:** 1 hour (WebSocket modifications)
- **Parallelism:** 100% (independent)

### Track 3: Browser Privacy (M-003)
- **Duration:** 9 hours
- **Dependencies:** None until integration
- **Integration:** 1 hour (WebSocket modifications)
- **Parallelism:** 100% (independent)

**Total Parallel Timeline: 12.5 hours (longest track) + 4 hours integration = 16.5 hours**
vs. Sequential: 35.5 hours
**Parallelism Gain: 53% time savings**

## Team/Track Assignments

### Recommended Team Structure (4 developers)

| Developer | Track | Issues | Hours | Focus |
|-----------|-------|--------|-------|-------|
| **Dev 1** | Network | M-001, M-004 | 14h | SSL/TLS infrastructure |
| **Dev 2** | Content | M-002 | 12.5h | HTML sanitization |
| **Dev 3** | Privacy | M-003 | 9h | WebRTC blocking |
| **Dev 4** | Integration & Testing | All | 8h | Testing & integration |

### Dependency Graph

```
M-001 (SSL Cert Mgmt) ──┐
                        ├─ M-004 (Python Client) ─┐
M-001 (WebSocket Mods) ─┤                         │
                        │                         └─ Integration (2h)
                        │
M-002 (HTML Sanitizer) ──┤ Integration (1h)
M-002 (WebSocket Mods) ──┤
                        │
M-003 (WebRTC Detector) ─┤ Integration (1h)
M-003 (WebSocket Mods) ──┤
                        │
                 Testing (4h)
```

**Critical Path:** M-001 → M-004 integration (14h + 2h = 16h)
**Parallel Tracks:** M-002 (12.5h), M-003 (9h) run in parallel

## Dependency Gates & Decision Points

### Gate 1: M-001 Completion (Day 1-2)
- **Requirement:** SSL Cert Manager + WebSocket integration working
- **Decision:** Proceed to M-004 integration, or fix issues?
- **Success Criteria:** 40/40 tests passing, production HTTPS enforcing

### Gate 2: HTML Sanitizer Testing (Day 2-3)
- **Requirement:** All 60 tests passing
- **Decision:** Proceed to production integration?
- **Success Criteria:** XSS tests 20/20, link tests 10/10, image tests 10/10

### Gate 3: WebRTC Blocking Validation (Day 2-3)
- **Requirement:** Leak detection working end-to-end
- **Decision:** Enable auto-blocking for all sessions?
- **Success Criteria:** Detection 12/12 tests, blocking 10/10 tests

### Gate 4: Full Integration Testing (Day 3-4)
- **Requirement:** All 4 modules integrated with WebSocket
- **Decision:** Ready for staging deployment?
- **Success Criteria:** 150/150 tests passing, no regressions

## Recommended Priority Order

### Phase 1: Foundation (Days 1-2)
1. **M-001: SSL/TLS Enforcement** - Required for M-004 and production readiness
2. **M-003: WebRTC Blocking** - Quick wins (3h), immediate impact

### Phase 2: Hardening (Days 2-3)
3. **M-002: HTML Sanitization** - Large task (12.5h), run in parallel with Phase 1
4. **M-004: Python Client SSL** - Depends on M-001, completes after Phase 1

### Phase 3: Integration & Testing (Day 3-4)
5. **Integration Testing** - Combine all modules
6. **Regression Testing** - Ensure nothing breaks
7. **Documentation** - Update guides and API reference

## Realistic Effort Breakdown

| Phase | Task | Effort | Actual | Buffer |
|-------|------|--------|--------|--------|
| Implementation | Code | 26.5h | 26.5h | 0% |
| Testing | Unit + Integration | 8h | 12h | +50% |
| Integration | WebSocket + System | 4h | 6h | +50% |
| Documentation | Guides + API | 2h | 3h | +50% |
| **Total** | | **40.5h** | **47.5h** | **17% buffer** |

**Realistic Total: 47-50 hours (6-7 person-days)**
**Recommended Timeline: 6-7 days with 4 developers**

---

# Deployment Checklist

## Pre-Deployment (Day 5)
- [ ] All 150 unit tests passing
- [ ] All 4 issues fully integrated
- [ ] Backward compatibility verified
- [ ] Performance impact measured (<5ms added latency)
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Deployment runbook reviewed

## Deployment (Day 6-7)
- [ ] Staging deployment successful
- [ ] Smoke tests passing
- [ ] Load testing (100+ concurrent connections)
- [ ] Production SSL certificates installed
- [ ] Monitoring alerts configured
- [ ] Rollback procedure tested

## Post-Deployment (Day 8+)
- [ ] Production health checks passing
- [ ] No certificate expiry warnings
- [ ] No WebRTC leaks detected
- [ ] HTML sanitization working
- [ ] Python client connections secure
- [ ] Performance metrics nominal

---

# Reference Documents

- **M-001 Details:** See "WSS/HTTPS Enforcement" section above
- **M-002 Details:** See "HTML Sanitization" section above
- **M-003 Details:** See "WebRTC IP Redaction" section above
- **M-004 Details:** See "Python Client SSL/TLS" section above
- **Testing Strategy:** See "Testing (XX tests)" section in each issue
- **Integration Guide:** See "WebSocket Integration" section in each issue

---

**Document Version:** 1.0  
**Last Updated:** June 20, 2026  
**Status:** READY FOR IMPLEMENTATION  
**Next Action:** Assign teams and begin Track 1 (M-001, M-004)
