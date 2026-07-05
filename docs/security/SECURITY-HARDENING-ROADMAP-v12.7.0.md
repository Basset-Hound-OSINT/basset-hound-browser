# Security Hardening Roadmap - Basset Hound Browser v12.7.0
**Document Version:** 1.0  
**Created:** June 20, 2026  
**Target Release:** v12.8.0 (Production Security Hardening)  
**Status:** DRAFT IMPLEMENTATION PLAN

---

## Executive Summary

This roadmap addresses 9 critical security vulnerabilities in forensic export functionality, WebSocket communication, and data persistence. The implementation is sequenced into 3 phases over 4-6 weeks, with parallel execution paths to minimize timeline.

**Budget:** 88-112 total engineering hours
- HIGH priority: 40-64 hours (blocking production)
- MEDIUM priority: 32-40 hours (pre-production requirement)
- LOW priority: 16-20 hours (nice-to-have hardening)

**Risk Level:** LOW (existing crypto infrastructure available, no architectural changes needed)

---

## Phase Breakdown

### Phase 1: Critical Export Security (Weeks 1-2, 40-64h)
**Objective:** Fix unfiltered request/response bodies and at-rest encryption  
**Deliverables:** H-001 + H-002 complete, tested, documented  
**Team Allocation:** 2-3 engineers  

### Phase 2: Communication & Client Hardening (Weeks 2-3, 32-40h)
**Objective:** Secure transport layer and Python client  
**Deliverables:** M-001 through M-004 complete  
**Team Allocation:** 2 engineers (parallel tracks)  

### Phase 3: Additional Hardening (Weeks 3-4, 16-20h)
**Objective:** Complete remaining security enhancements  
**Deliverables:** L-001 through L-003 complete  
**Team Allocation:** 1-2 engineers  

---

## Detailed Issue Analysis & Solutions

---

## HIGH PRIORITY ISSUES

### H-001: Unfiltered Request/Response Bodies in Network Logs
**Severity:** CRITICAL - Credentials in plaintext  
**Affected Files:** `websocket/server.js` (lines 7939-8052)  
**Effort:** 16-24 hours  
**Timeline:** Days 1-3 of Phase 1

#### Problem Statement
The `export_network_log` command exports request and response bodies without sanitization:
```javascript
// Current vulnerable code (line 7972-7973)
requestBody: req.requestBody || null,
responseBody: req.responseBody ? req.responseBody.substring(0, 10000) : null,
```

**Attack Vector:** Exported logs contain:
- OAuth tokens, API keys
- Session cookies (in body)
- Password reset tokens
- Credit card numbers (PII in responses)
- Personal identification data
- Authentication credentials

**Impact:** HIGH - Any storage/transmission of exports leaks sensitive data

#### Solution Architecture

**Step 1: Create Sensitive Data Masking Module** (6-8h)
**File:** `src/security/sensitive-data-masker.js` (new)

```javascript
/**
 * Sensitive Data Masker
 * Redacts credentials, API keys, PII from network logs
 * Supports multiple masking strategies and audit trail
 */

class SensitiveDataMasker {
  constructor(options = {}) {
    this.patterns = {
      // API Keys & Tokens
      apiKey: /(?:api[_-]?key|apikey|api_token|access_token)['"]?\s*[:=]\s*['"]?([a-zA-Z0-9\-_.]{20,})/gi,
      bearerToken: /Bearer\s+([a-zA-Z0-9\-_.]+)/gi,
      jwtToken: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
      
      // Credentials
      basicAuth: /Basic\s+([a-zA-Z0-9+/=]+)/gi,
      password: /(?:password|passwd|pwd)['"]?\s*[:=]\s*['"]?([^'",\s}\]]{6,})/gi,
      
      // OAuth
      clientSecret: /(?:client_secret|oauth_secret)['"]?\s*[:=]\s*['"]?([a-zA-Z0-9\-_.]{20,})/gi,
      refreshToken: /(?:refresh_token|refresh)['"]?\s*[:=]\s*['"]?([a-zA-Z0-9\-_.]{20,})/gi,
      
      // PII
      email: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      phone: /\b(?:\+?1)?[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      
      // Database credentials
      connectionString: /(?:mongodb|mysql|postgres|postgresql)(?:\+srv)?:\/\/([^@]+)@/gi,
      dbPassword: /(?:db_password|database_password)['"]?\s*[:=]\s*['"]?([^'",\s}\]]{6,})/gi,
      
      // AWS/Cloud
      awsAccessKey: /AKIA[0-9A-Z]{16}/g,
      awsSecretKey: /aws_secret_access_key['"]?\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{40})/gi,
      
      // Private keys
      privateKey: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
      
      // Session identifiers
      sessionId: /(?:session_?id|sessionid|JSESSIONID)['"]?\s*[:=]\s*['"]?([a-zA-Z0-9]{20,})/gi,
      
      // Authorization headers
      authHeader: /Authorization['"]?\s*[:=]\s*['"]?([^'",\s}\]]{20,})/gi
    };
    
    this.maskLength = options.maskLength || 8;
    this.auditLog = [];
    this.maskingStrategies = options.maskingStrategies || {
      full: (value) => '*'.repeat(this.maskLength),
      partial: (value) => value.substring(0, 3) + '*'.repeat(this.maskLength) + value.substring(value.length - 3),
      hash: (value) => '[HASH:' + crypto.createHash('sha256').update(value).digest('hex').substring(0, 8) + ']'
    };
  }

  /**
   * Mask sensitive data in HTTP body
   * @param {string|object} data - Request/response body
   * @param {string} bodyType - 'request' or 'response'
   * @param {string} contentType - Content-Type header value
   * @returns {object} Masked data + audit info
   */
  maskHttpBody(data, bodyType = 'request', contentType = 'application/json') {
    if (!data) {
      return { masked: data, maskingApplied: false, foundPatterns: [] };
    }

    let text = typeof data === 'string' ? data : JSON.stringify(data);
    const original = text;
    const foundPatterns = [];
    
    // Apply pattern-based masking
    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        foundPatterns.push({
          type: patternName,
          position: match.index,
          matchLength: match[0].length
        });
        text = text.replace(match[0], this._getMaskedValue(match[0], patternName));
      }
    }

    const maskingApplied = foundPatterns.length > 0;
    
    // Log masking action for audit trail
    if (maskingApplied) {
      this._logMasking(bodyType, foundPatterns, text.length);
    }

    // Parse back to original type if JSON
    let masked = text;
    if (contentType.includes('application/json')) {
      try {
        masked = JSON.parse(text);
      } catch (e) {
        // Return as string if parsing fails
      }
    }

    return {
      masked,
      maskingApplied,
      foundPatterns,
      summary: {
        apiKeysFound: foundPatterns.filter(p => p.type === 'apiKey').length,
        credentialsFound: foundPatterns.filter(p => p.type === 'password').length,
        tokensFound: foundPatterns.filter(p => p.type.includes('Token')).length,
        piiFound: foundPatterns.filter(p => ['email', 'ssn', 'creditCard', 'phone'].includes(p.type)).length,
        totalPatterns: foundPatterns.length
      }
    };
  }

  /**
   * Mask sensitive headers
   * @param {object} headers - HTTP headers object
   * @returns {object} Masked headers
   */
  maskHeaders(headers) {
    if (!headers) return { masked: headers, changes: 0 };

    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-access-token',
      'x-csrf-token',
      'x-api-secret',
      'client-token',
      'private-token',
      'x-token'
    ];

    const masked = { ...headers };
    let changes = 0;

    for (const [key, value] of Object.entries(masked)) {
      if (sensitiveHeaders.includes(key.toLowerCase()) && value) {
        masked[key] = this._getMaskedValue(value, 'header');
        changes++;
      }
    }

    return { masked, changes };
  }

  /**
   * Mask sensitive query parameters
   * @param {string} url - Full URL with query string
   * @returns {object} URL with masked parameters
   */
  maskQueryParams(url) {
    if (!url) return { masked: url, changes: 0 };

    try {
      const urlObj = new URL(url);
      const sensitiveParams = [
        'api_key', 'apikey', 'token', 'access_token', 'refresh_token',
        'password', 'pwd', 'secret', 'auth', 'key', 'credential'
      ];

      let changes = 0;
      for (const [key, value] of urlObj.searchParams) {
        if (sensitiveParams.includes(key.toLowerCase())) {
          urlObj.searchParams.set(key, this._getMaskedValue(value, 'queryParam'));
          changes++;
        }
      }

      return { masked: urlObj.toString(), changes };
    } catch (e) {
      return { masked: url, changes: 0, error: e.message };
    }
  }

  /**
   * Get masked value using appropriate strategy
   * @private
   */
  _getMaskedValue(value, patternType) {
    // Use partial masking for sensitive headers to preserve length
    if (patternType === 'header') {
      if (value.length <= 10) return '*'.repeat(value.length);
      return value.substring(0, 3) + '*'.repeat(this.maskLength) + value.substring(value.length - 3);
    }
    
    // Use hash for tokens/keys
    if (['apiKey', 'bearerToken', 'clientSecret', 'sessionId'].includes(patternType)) {
      return '[REDACTED:' + crypto.createHash('sha256').update(value).digest('hex').substring(0, 8) + ']';
    }
    
    // Full masking for passwords/PII
    return '*'.repeat(Math.min(this.maskLength, value.length));
  }

  /**
   * Log masking for audit trail
   * @private
   */
  _logMasking(bodyType, patterns, resultLength) {
    this.auditLog.push({
      timestamp: new Date(),
      bodyType,
      patternsFound: patterns.length,
      resultLength,
      patternSummary: this._summarizePatterns(patterns)
    });

    // Trim audit log to last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  /**
   * Summarize pattern findings
   * @private
   */
  _summarizePatterns(patterns) {
    const summary = {};
    patterns.forEach(p => {
      summary[p.type] = (summary[p.type] || 0) + 1;
    });
    return summary;
  }

  /**
   * Get masking statistics
   */
  getStatistics() {
    return {
      totalMaskingOperations: this.auditLog.length,
      recentMaskings: this.auditLog.slice(-10),
      patternStats: this._aggregatePatternStats()
    };
  }

  /**
   * Aggregate statistics across all maskings
   * @private
   */
  _aggregatePatternStats() {
    const stats = {};
    this.auditLog.forEach(entry => {
      for (const [type, count] of Object.entries(entry.patternSummary)) {
        stats[type] = (stats[type] || 0) + count;
      }
    });
    return stats;
  }
}

module.exports = { SensitiveDataMasker };
```

**Step 2: Integrate Masking into export_network_log** (4-6h)
**File:** `websocket/server.js` (lines 7939-8052)

```javascript
// Add import at top
const { SensitiveDataMasker } = require('../src/security/sensitive-data-masker');

// In WebSocketServer constructor
this.sensitiveDataMasker = new SensitiveDataMasker({
  maskLength: 8,
  maskingStrategies: {
    full: (val) => '*'.repeat(Math.min(8, val.length)),
    partial: (val) => val.substring(0, 2) + '*'.repeat(6) + val.substring(val.length - 2)
  }
});

// Replace export_network_log handler (lines 7939-8052)
this.commandHandlers.export_network_log = async (params) => {
  try {
    if (!this.networkAnalysisManager) {
      return { success: false, error: 'Network analysis manager not available' };
    }

    const timestamp = new Date().toISOString();
    const format = params.format || 'json';
    const resourceType = params.resourceType || null;
    const minDuration = params.minDuration || 0;
    const includeSensitiveData = params.includeSensitiveData === true; // Explicit opt-in
    const maskingLevel = params.maskingLevel || 'full'; // 'full', 'partial', 'none' (if authorized)

    // Get all captured requests
    const baseExport = this.networkAnalysisManager.exportCapture();
    let requests = baseExport.requests || [];

    // Apply filters
    if (resourceType) {
      requests = requests.filter(r => r.resourceType === resourceType);
    }
    if (minDuration > 0) {
      requests = requests.filter(r => (r.duration || 0) >= minDuration);
    }

    // Enrich and MASK requests
    const enrichedRequests = requests.map(req => {
      const processed = {
        id: req.id,
        url: req.url,
        method: req.method || 'GET',
        resourceType: req.resourceType,
        statusCode: req.statusCode,
        statusMessage: req.statusMessage || '',
        requestHeaders: req.requestHeaders || {},
        responseHeaders: req.responseHeaders || {},
        contentLength: req.contentLength || 0,
        duration: req.duration || 0,
        startTime: req.startTime,
        endTime: req.endTime,
        fromCache: req.fromCache || false,
        error: req.error || null,
        initiator: req.initiator || null,
        priority: req.priority || null
      };

      // MASKING: Apply sensitive data redaction
      if (!includeSensitiveData || maskingLevel !== 'none') {
        // Mask URL query parameters
        const urlMasking = this.sensitiveDataMasker.maskQueryParams(req.url);
        processed.url = urlMasking.masked;

        // Mask request headers (authorization, cookies, etc.)
        const requestHeaderMasking = this.sensitiveDataMasker.maskHeaders(req.requestHeaders);
        processed.requestHeaders = requestHeaderMasking.masked;

        // Mask response headers
        const responseHeaderMasking = this.sensitiveDataMasker.maskHeaders(req.responseHeaders);
        processed.responseHeaders = responseHeaderMasking.masked;

        // Mask request body
        if (req.requestBody) {
          const contentType = (req.requestHeaders && req.requestHeaders['content-type']) || 'text/plain';
          const bodyMasking = this.sensitiveDataMasker.maskHttpBody(req.requestBody, 'request', contentType);
          processed.requestBody = bodyMasking.masked;
          processed.requestBodyMasked = true;
          processed.requestBodyMaskingSummary = bodyMasking.summary;
        } else {
          processed.requestBody = null;
        }

        // Mask response body
        if (req.responseBody) {
          const contentType = (req.responseHeaders && req.responseHeaders['content-type']) || 'text/plain';
          const bodyMasking = this.sensitiveDataMasker.maskHttpBody(
            req.responseBody.substring(0, 10000), 
            'response', 
            contentType
          );
          processed.responseBody = bodyMasking.masked;
          processed.responseBodyMasked = true;
          processed.responseBodyMaskingSummary = bodyMasking.summary;
        } else {
          processed.responseBody = null;
        }
      } else {
        // Include unmasked (requires explicit authorization)
        processed.requestBody = req.requestBody || null;
        processed.responseBody = req.responseBody ? req.responseBody.substring(0, 10000) : null;
        processed.securityWarning = 'UNMASKED_SENSITIVE_DATA_INCLUDED';
      }

      return processed;
    });

    // Compile result
    const result = {
      success: true,
      timestamp,
      format,
      exportedAt: timestamp,
      totalRequests: enrichedRequests.length,
      maskingApplied: !includeSensitiveData || maskingLevel !== 'none',
      maskingLevel,
      requests: enrichedRequests
    };

    // Statistics
    result.statistics = {
      byResourceType: {},
      byStatusCode: {},
      totalSize: 0,
      totalDuration: 0,
      slowestRequest: null,
      largestRequest: null,
      sensitiveDataFound: 0,
      itemsMasked: 0
    };

    let maxDuration = 0;
    let maxSize = 0;
    let totalMasked = 0;

    enrichedRequests.forEach(req => {
      // Count masking operations
      if (req.requestBodyMaskingSummary) {
        totalMasked += req.requestBodyMaskingSummary.totalPatterns || 0;
      }
      if (req.responseBodyMaskingSummary) {
        totalMasked += req.responseBodyMaskingSummary.totalPatterns || 0;
      }

      // Resource type statistics
      if (!result.statistics.byResourceType[req.resourceType]) {
        result.statistics.byResourceType[req.resourceType] = { count: 0, totalSize: 0, totalDuration: 0 };
      }
      result.statistics.byResourceType[req.resourceType].count++;
      result.statistics.byResourceType[req.resourceType].totalSize += req.contentLength || 0;
      result.statistics.byResourceType[req.resourceType].totalDuration += req.duration || 0;

      // Status code statistics
      const statusKey = `${req.statusCode}`;
      if (!result.statistics.byStatusCode[statusKey]) {
        result.statistics.byStatusCode[statusKey] = 0;
      }
      result.statistics.byStatusCode[statusKey]++;

      // Overall statistics
      result.statistics.totalSize += req.contentLength || 0;
      result.statistics.totalDuration += req.duration || 0;

      // Track slowest and largest
      if (req.duration && req.duration > maxDuration) {
        maxDuration = req.duration;
        result.statistics.slowestRequest = {
          url: req.url,
          duration: req.duration
        };
      }
      if (req.contentLength && req.contentLength > maxSize) {
        maxSize = req.contentLength;
        result.statistics.largestRequest = {
          url: req.url,
          contentLength: req.contentLength
        };
      }
    });

    result.statistics.itemsMasked = totalMasked;

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};
```

**Step 3: Add Masking Command** (2-3h)
**File:** `websocket/server.js` (new command handler)

```javascript
// Add new command to retrieve masking statistics
this.commandHandlers.get_sensitive_data_masking_stats = async (params) => {
  try {
    if (!this.sensitiveDataMasker) {
      return { success: false, error: 'Sensitive data masker not initialized' };
    }

    return {
      success: true,
      statistics: this.sensitiveDataMasker.getStatistics(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

#### Testing Strategy for H-001

**Unit Tests:** `tests/unit/security-sensitive-data-masker.test.js` (new)
```javascript
describe('SensitiveDataMasker', () => {
  let masker;

  beforeEach(() => {
    masker = new SensitiveDataMasker();
  });

  describe('API Key Detection', () => {
    test('should mask API keys in JSON bodies', () => {
      const body = '{"api_key": "sk-1234567890abcdef"}';
      const result = masker.maskHttpBody(body, 'request', 'application/json');
      expect(result.maskingApplied).toBe(true);
      expect(result.summary.apiKeysFound).toBeGreaterThan(0);
      expect(result.masked).not.toContain('sk-1234567890abcdef');
    });

    test('should detect multiple API keys', () => {
      const body = '{"api_key": "sk-abc123", "api_key_secondary": "sk-xyz789"}';
      const result = masker.maskHttpBody(body);
      expect(result.summary.apiKeysFound).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Credential Detection', () => {
    test('should mask passwords', () => {
      const body = '{"password": "SuperSecret123!"}';
      const result = masker.maskHttpBody(body);
      expect(result.maskingApplied).toBe(true);
      expect(result.summary.credentialsFound).toBeGreaterThan(0);
    });

    test('should mask OAuth tokens', () => {
      const body = '{"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}';
      const result = masker.maskHttpBody(body);
      expect(result.maskingApplied).toBe(true);
    });
  });

  describe('PII Detection', () => {
    test('should mask email addresses', () => {
      const body = '{"email": "user@example.com"}';
      const result = masker.maskHttpBody(body);
      expect(result.summary.piiFound).toBeGreaterThan(0);
    });

    test('should mask credit card numbers', () => {
      const body = '{"card": "4532-1234-5678-9010"}';
      const result = masker.maskHttpBody(body);
      expect(result.summary.piiFound).toBeGreaterThan(0);
    });

    test('should mask SSN', () => {
      const body = '{"ssn": "123-45-6789"}';
      const result = masker.maskHttpBody(body);
      expect(result.summary.piiFound).toBeGreaterThan(0);
    });
  });

  describe('Header Masking', () => {
    test('should mask Authorization header', () => {
      const headers = { 'Authorization': 'Bearer token123abc...' };
      const result = masker.maskHeaders(headers);
      expect(result.changes).toBe(1);
      expect(result.masked.Authorization).not.toBe(headers.Authorization);
    });

    test('should mask multiple sensitive headers', () => {
      const headers = {
        'Authorization': 'Bearer token',
        'X-API-Key': 'sk-123',
        'Cookie': 'sessionid=abc123'
      };
      const result = masker.maskHeaders(headers);
      expect(result.changes).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Query Parameter Masking', () => {
    test('should mask API key in query params', () => {
      const url = 'https://api.example.com/endpoint?api_key=sk-123&other=value';
      const result = masker.maskQueryParams(url);
      expect(result.changes).toBe(1);
      expect(result.masked).not.toContain('sk-123');
    });
  });
});
```

**Integration Tests:** `tests/integration/security-export-masking.test.js` (new)
```javascript
describe('Network Export with Sensitive Data Masking', () => {
  let client;
  let server;

  beforeAll(async () => {
    server = new WebSocketServer({ port: 8765, sslEnabled: false });
    client = new BassetHoundClient();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
    server.close();
  });

  test('export_network_log should mask sensitive data by default', async () => {
    // Simulate network request with credentials
    await client.navigate('https://api.example.com/login?api_key=sk-abc123');
    
    const result = await client.exportNetworkLog({
      format: 'json',
      includeSensitiveData: false
    });

    expect(result.success).toBe(true);
    expect(result.maskingApplied).toBe(true);
    
    // Verify sensitive data is masked
    const requestText = JSON.stringify(result.requests);
    expect(requestText).not.toContain('sk-abc123');
    expect(requestText).not.toContain('api_key');
  });

  test('should require explicit authorization for unmasked data', async () => {
    const result = await client.exportNetworkLog({
      includeSensitiveData: true,
      maskingLevel: 'none'
      // Should fail without proper authorization
    });

    // Should either be denied or include security warning
    if (result.success) {
      expect(result.requests.some(r => r.securityWarning)).toBe(true);
    }
  });

  test('should provide masking statistics', async () => {
    const result = await client.exportNetworkLog();
    
    if (result.maskingApplied) {
      expect(result.statistics.itemsMasked).toBeDefined();
      expect(result.requests.every(r => 
        !r.requestBodyMasked || r.requestBodyMaskingSummary
      )).toBe(true);
    }
  });
});
```

#### Risk Mitigation for H-001
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Regex DoS on large bodies | LOW | HIGH | Add input size limits (10MB max), use streaming for large exports |
| False positives in masking | MEDIUM | LOW | Maintain whitelist of known safe patterns, provide audit trail |
| Performance degradation | MEDIUM | MEDIUM | Cache compiled regexes, benchmark masking operation |
| Breaking existing clients | HIGH | MEDIUM | Add `includeSensitiveData` parameter (defaults to false), maintain backward compatibility in response structure |

#### Rollout Strategy for H-001
1. **Day 1**: Code review and unit testing
2. **Day 2**: Integration testing with real network captures
3. **Day 3**: Staging deployment with analytics
4. **Production**: Automatic masking with no opt-in required

---

### H-002: Missing Encryption at Rest for Exported Files
**Severity:** CRITICAL - Unencrypted forensic data on disk  
**Affected Files:** Export storage layer, Python client file handling  
**Effort:** 24-40 hours  
**Timeline:** Days 3-7 of Phase 1  
**Dependencies:** H-001 (masking must be in place first)

#### Problem Statement
Exported forensic data is written to disk in plaintext:
- Network logs, HTML captures, screenshots
- Session data, authentication tokens
- Evidence files with investigative data

**Attack Vector:**
- Disk imaging/forensic analysis
- Backup file extraction
- Local privilege escalation
- Cloud storage exposure

#### Solution Architecture

**Step 1: Create Encrypted Export Manager** (10-12h)
**File:** `src/export/encrypted-export-manager.js` (new)

```javascript
/**
 * Encrypted Export Manager
 * Handles secure export file creation with encryption at rest
 * Integrates with SecretVault for key management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SecretVault } = require('../security/secret-vault');
const { SessionEncryptor } = require('../security/session-encryptor');

class EncryptedExportManager {
  constructor(options = {}) {
    this.exportBasePath = options.exportBasePath || path.join(process.env.HOME, '.basset-hound', 'exports');
    this.encryptExports = options.encryptExports !== false; // Default: enabled
    this.encryptionAlgorithm = 'aes-256-gcm';
    this.compressionEnabled = options.compressionEnabled !== false;
    
    // Initialize encryption components
    this.secretVault = new SecretVault(options.vaultConfig);
    this.sessionEncryptor = new SessionEncryptor(options.encryptorConfig);
    
    // File index for tracking exports
    this.exportIndex = new Map();
    this.exportMetadata = new Map();
    
    // Ensure export directory exists with proper permissions
    this._ensureExportDirectory();
  }

  /**
   * Export data with automatic encryption
   * @param {string} exportId - Unique export identifier
   * @param {object} data - Data to export (JSON)
   * @param {object} options - Export options
   * @returns {object} Export result with file path and encryption metadata
   */
  async exportData(exportId, data, options = {}) {
    try {
      if (!exportId || !data) {
        return { success: false, error: 'Missing exportId or data' };
      }

      const timestamp = new Date().toISOString();
      const contentType = options.contentType || 'application/json';
      const exportType = options.exportType || 'generic'; // 'network-log', 'screenshot', 'html', etc.
      
      // Validate data
      let serialized;
      try {
        serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      } catch (e) {
        return { success: false, error: `Failed to serialize data: ${e.message}` };
      }

      // Compress if enabled
      let processedData = serialized;
      let compressionApplied = false;
      
      if (this.compressionEnabled && serialized.length > 1024) { // Only compress if > 1KB
        const compressed = await this._compressData(serialized);
        if (compressed.success) {
          processedData = compressed.data;
          compressionApplied = true;
        }
      }

      // Create export file
      const exportDir = path.join(this.exportBasePath, exportType);
      this._ensureDirectory(exportDir);
      
      const fileName = `${exportId}-${crypto.randomBytes(8).toString('hex')}.export`;
      const filePath = path.join(exportDir, fileName);

      // Encrypt and write
      let encryptedData = processedData;
      let encryptionMetadata = null;

      if (this.encryptExports) {
        const encryptionResult = this._encryptExportData(processedData, exportId);
        if (!encryptionResult.success) {
          return { success: false, error: `Encryption failed: ${encryptionResult.error}` };
        }

        encryptedData = encryptionResult.encryptedData;
        encryptionMetadata = {
          algorithm: this.encryptionAlgorithm,
          iv: encryptionResult.iv,
          authTag: encryptionResult.authTag,
          masterKeyId: encryptionResult.masterKeyId,
          nonce: encryptionResult.nonce
        };
      }

      // Write to disk with restricted permissions
      try {
        fs.writeFileSync(filePath, encryptedData, { mode: 0o600 });
      } catch (e) {
        return { success: false, error: `Failed to write export file: ${e.message}` };
      }

      // Store metadata
      const metadata = {
        exportId,
        filePath,
        fileName,
        exportType,
        contentType,
        originalSize: serialized.length,
        compressedSize: processedData.length,
        compressionApplied,
        encrypted: this.encryptExports,
        encryptionMetadata,
        createdAt: timestamp,
        updatedAt: timestamp,
        checksum: crypto.createHash('sha256').update(serialized).digest('hex')
      };

      this.exportIndex.set(exportId, filePath);
      this.exportMetadata.set(exportId, metadata);

      // Store metadata in vault if encryption enabled
      if (this.encryptExports) {
        this.secretVault.storeSecret(
          `export-metadata-${exportId}`,
          JSON.stringify(metadata),
          {
            type: 'export-metadata',
            owner: 'export-manager',
            exportId
          }
        );
      }

      return {
        success: true,
        exportId,
        filePath,
        metadata,
        fileSize: encryptedData.length,
        encrypted: this.encryptExports,
        compressionApplied,
        message: 'Export created successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve encrypted export data
   * @param {string} exportId - Export identifier
   * @param {string} accessorId - Accessor identifier
   * @returns {object} Decrypted export data
   */
  async retrieveExportData(exportId, accessorId) {
    try {
      if (!exportId || !accessorId) {
        return { success: false, error: 'Missing exportId or accessorId' };
      }

      const filePath = this.exportIndex.get(exportId);
      if (!filePath) {
        return { success: false, error: 'Export not found' };
      }

      const metadata = this.exportMetadata.get(exportId);
      if (!metadata) {
        return { success: false, error: 'Export metadata not found' };
      }

      // Check access control via vault
      const vaultResult = this.secretVault.retrieveSecret(
        `export-metadata-${exportId}`,
        accessorId
      );
      
      if (!vaultResult.success) {
        return { success: false, error: 'Access denied' };
      }

      // Read encrypted file
      let fileData;
      try {
        fileData = fs.readFileSync(filePath);
      } catch (e) {
        return { success: false, error: `Failed to read export file: ${e.message}` };
      }

      // Decrypt if needed
      let decryptedData = fileData.toString();
      
      if (metadata.encrypted && metadata.encryptionMetadata) {
        const decryptionResult = this._decryptExportData(
          fileData,
          metadata.encryptionMetadata,
          exportId
        );
        
        if (!decryptionResult.success) {
          return { success: false, error: `Decryption failed: ${decryptionResult.error}` };
        }

        decryptedData = decryptionResult.decryptedData;
      }

      // Decompress if needed
      if (metadata.compressionApplied) {
        const decompressed = await this._decompressData(decryptedData);
        if (decompressed.success) {
          decryptedData = decompressed.data;
        }
      }

      // Parse JSON if applicable
      let parsedData = decryptedData;
      if (metadata.contentType.includes('application/json')) {
        try {
          parsedData = JSON.parse(decryptedData);
        } catch (e) {
          // Return as string if parsing fails
        }
      }

      return {
        success: true,
        exportId,
        data: parsedData,
        metadata: {
          ...metadata,
          accessedAt: new Date().toISOString(),
          accessedBy: accessorId
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all exports
   * @param {object} options - Filter options
   * @returns {array} List of exports
   */
  listExports(options = {}) {
    try {
      let exports = Array.from(this.exportMetadata.values());

      // Filter by type
      if (options.exportType) {
        exports = exports.filter(e => e.exportType === options.exportType);
      }

      // Filter by date range
      if (options.createdAfter) {
        exports = exports.filter(e => new Date(e.createdAt) > new Date(options.createdAfter));
      }

      if (options.createdBefore) {
        exports = exports.filter(e => new Date(e.createdAt) < new Date(options.createdBefore));
      }

      // Sort by creation date
      exports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Limit results
      if (options.limit) {
        exports = exports.slice(0, options.limit);
      }

      return {
        success: true,
        total: exports.length,
        exports: exports.map(e => ({
          exportId: e.exportId,
          exportType: e.exportType,
          createdAt: e.createdAt,
          originalSize: e.originalSize,
          encrypted: e.encrypted,
          compressionApplied: e.compressionApplied
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete export securely
   * @param {string} exportId - Export to delete
   * @returns {object} Deletion result
   */
  async deleteExport(exportId) {
    try {
      const filePath = this.exportIndex.get(exportId);
      if (!filePath) {
        return { success: false, error: 'Export not found' };
      }

      // Securely overwrite file before deletion
      const metadata = this.exportMetadata.get(exportId);
      if (metadata && metadata.fileSize) {
        // Overwrite with random data 3 times
        for (let i = 0; i < 3; i++) {
          const randomData = crypto.randomBytes(metadata.fileSize);
          fs.writeFileSync(filePath, randomData, { mode: 0o600 });
        }
      }

      // Delete file
      fs.unlinkSync(filePath);

      // Remove metadata
      this.exportIndex.delete(exportId);
      this.exportMetadata.delete(exportId);

      // Remove from vault
      this.secretVault.revokeAccess(`export-metadata-${exportId}`, 'system');

      return { success: true, message: 'Export deleted securely' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Encrypt export data
   * @private
   */
  _encryptExportData(data, exportId) {
    try {
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const masterKey = this.sessionEncryptor.masterKey;
      
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, masterKey, iv);
      
      // Use exportId as AAD (Additional Authenticated Data)
      cipher.setAAD(Buffer.from(exportId, 'utf8'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return {
        success: true,
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        masterKeyId: 'session-master-key',
        nonce: crypto.randomBytes(16).toString('hex')
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Decrypt export data
   * @private
   */
  _decryptExportData(encryptedData, encryptionMetadata, exportId) {
    try {
      const masterKey = this.sessionEncryptor.masterKey;
      const decipher = crypto.createDecipheriv(
        this.encryptionAlgorithm,
        masterKey,
        Buffer.from(encryptionMetadata.iv, 'hex')
      );

      decipher.setAAD(Buffer.from(exportId, 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptionMetadata.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return { success: true, decryptedData: decrypted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Compress data
   * @private
   */
  async _compressData(data) {
    try {
      const zlib = require('zlib');
      const compressed = await new Promise((resolve, reject) => {
        zlib.gzip(data, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      return {
        success: true,
        data: compressed,
        originalSize: data.length,
        compressedSize: compressed.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Decompress data
   * @private
   */
  async _decompressData(data) {
    try {
      const zlib = require('zlib');
      const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(data, (err, result) => {
          if (err) reject(err);
          else resolve(result.toString());
        });
      });

      return { success: true, data: decompressed };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Ensure export directory exists with proper permissions
   * @private
   */
  _ensureExportDirectory() {
    try {
      if (!fs.existsSync(this.exportBasePath)) {
        fs.mkdirSync(this.exportBasePath, { recursive: true, mode: 0o700 });
      }
    } catch (e) {
      throw new Error(`Failed to initialize export directory: ${e.message}`);
    }
  }

  /**
   * Ensure directory exists
   * @private
   */
  _ensureDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
      }
    } catch (e) {
      throw new Error(`Failed to create directory ${dirPath}: ${e.message}`);
    }
  }

  /**
   * Get encryption status
   */
  getEncryptionStatus() {
    return {
      exportEncryptionEnabled: this.encryptExports,
      algorithm: this.encryptionAlgorithm,
      compressionEnabled: this.compressionEnabled,
      totalExports: this.exportIndex.size,
      encryptedExports: Array.from(this.exportMetadata.values()).filter(e => e.encrypted).length,
      unencryptedExports: Array.from(this.exportMetadata.values()).filter(e => !e.encrypted).length,
      totalStorageSize: Array.from(this.exportMetadata.values())
        .reduce((sum, e) => sum + (e.compressedSize || 0), 0),
      vaultStatus: this.secretVault.getVaultStatus()
    };
  }
}

module.exports = { EncryptedExportManager };
```

**Step 2: Integrate EncryptedExportManager into WebSocketServer** (6-8h)
**File:** `websocket/server.js`

```javascript
// Add import
const { EncryptedExportManager } = require('../src/export/encrypted-export-manager');

// In WebSocketServer constructor
this.encryptedExportManager = new EncryptedExportManager({
  encryptExports: options.encryptExports !== false,
  compressionEnabled: options.compressionEnabled !== false,
  vaultConfig: options.vaultConfig || {},
  encryptorConfig: options.encryptorConfig || {}
});

// Modify export_network_log to use encrypted export
this.commandHandlers.export_network_log = async (params) => {
  try {
    // ... existing masking logic ...
    
    const exportId = crypto.randomUUID();
    
    // Save to encrypted export
    const exportResult = await this.encryptedExportManager.exportData(
      exportId,
      result,
      {
        exportType: 'network-log',
        contentType: 'application/json'
      }
    );

    if (!exportResult.success) {
      return { success: false, error: `Export failed: ${exportResult.error}` };
    }

    return {
      ...result,
      exportId,
      filePath: exportResult.filePath,
      encrypted: exportResult.encrypted,
      compressionApplied: exportResult.compressionApplied
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Add command to retrieve encrypted exports
this.commandHandlers.retrieve_export = async (params) => {
  try {
    if (!params.exportId) {
      return { success: false, error: 'Missing exportId' };
    }

    const result = await this.encryptedExportManager.retrieveExportData(
      params.exportId,
      params.accessorId || 'anonymous'
    );

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Add command to list exports
this.commandHandlers.list_exports = async (params) => {
  try {
    return this.encryptedExportManager.listExports(params);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Add command to get encryption status
this.commandHandlers.get_export_encryption_status = async (params) => {
  try {
    return {
      success: true,
      status: this.encryptedExportManager.getEncryptionStatus(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

**Step 3: Update Python Client** (4-6h)
**File:** `clients/python/basset_hound/client.py`

```python
import asyncio
import os
from cryptography.fernet import Fernet

class BassetHoundClient:
    # ... existing code ...
    
    def export_network_log(self, format='json', resourceType=None, 
                          minDuration=0, includeSensitiveData=False, 
                          maskingLevel='full', save_to_file=None, decrypt_key=None):
        """
        Export network log with encryption support.
        
        Args:
            format: Export format ('json', 'csv', 'har')
            resourceType: Filter by resource type
            minDuration: Minimum request duration
            includeSensitiveData: Include unmasked sensitive data (requires auth)
            maskingLevel: 'full', 'partial', or 'none'
            save_to_file: Path to save export (optional)
            decrypt_key: Decryption key if needed (optional)
        
        Returns:
            Export data or file path
        """
        result = self.send_command('export_network_log', {
            'format': format,
            'resourceType': resourceType,
            'minDuration': minDuration,
            'includeSensitiveData': includeSensitiveData,
            'maskingLevel': maskingLevel
        })

        if not result.get('success'):
            raise CommandError(result.get('error', 'Export failed'))

        # Save to file if requested
        if save_to_file:
            export_data = result.get('data') or result
            with open(save_to_file, 'w') as f:
                if isinstance(export_data, dict):
                    import json
                    json.dump(export_data, f, indent=2)
                else:
                    f.write(str(export_data))
            
            # Secure file permissions
            os.chmod(save_to_file, 0o600)
            return {'file': save_to_file, 'size': os.path.getsize(save_to_file)}

        return result

    def retrieve_export(self, export_id):
        """Retrieve encrypted export."""
        result = self.send_command('retrieve_export', {
            'exportId': export_id,
            'accessorId': os.getenv('USER', 'anonymous')
        })
        return result

    def list_exports(self, export_type=None, limit=10):
        """List available exports."""
        result = self.send_command('list_exports', {
            'exportType': export_type,
            'limit': limit
        })
        return result

    def get_export_encryption_status(self):
        """Get export encryption status."""
        result = self.send_command('get_export_encryption_status')
        return result.get('status') if result.get('success') else None
```

#### Testing Strategy for H-002

**Unit Tests:** `tests/unit/security-encrypted-export.test.js` (new)
**Integration Tests:** `tests/integration/security-export-encryption.test.js` (new)

#### Risk Mitigation for H-002
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Key compromise | LOW | CRITICAL | Use HSM for production key storage, rotate keys monthly |
| Decrypt performance hit | MEDIUM | MEDIUM | Implement async decryption, cache frequently accessed exports |
| Backward compatibility | HIGH | MEDIUM | Add migration script for existing exports, support both encrypted/unencrypted |
| File system issues | LOW | HIGH | Implement RAID backup, monitor disk space, implement export rotation |

---

## MEDIUM PRIORITY ISSUES

### M-001: Unencrypted WebSocket (ws:// instead of wss://)
**Severity:** HIGH - Man-in-the-middle vulnerability  
**Affected Files:** `websocket/server.js` (lines 1200-1400), Python client  
**Effort:** 4-8 hours  
**Timeline:** Days 3-4 of Phase 2

#### Problem Statement
WebSocket server defaults to unencrypted ws:// protocol. MITM attacks can capture:
- Command parameters (URLs, credentials)
- Response data (HTML, extracted info)
- Session identifiers

#### Solution
Integrate existing SSL/TLS support from server.js into default configuration:

**Changes Required:**
1. Default SSL/TLS to ENABLED in WebSocketServer constructor
2. Auto-generate self-signed certs if none provided (development mode)
3. Enforce wss:// for all production instances
4. Add certificate validation in Python client

**Implementation:** 4-8h

---

### M-002: HTML Sanitization in Exported Content
**Severity:** MEDIUM - XSS in forensic HTML exports  
**Affected Files:** `extraction/` modules, export handlers  
**Effort:** 16-24 hours  
**Timeline:** Days 5-7 of Phase 2

#### Problem Statement
Exported HTML from websites contains:
- JavaScript payloads
- Event handlers (onload, onclick)
- External resource references
- Embedded exploits

#### Solution
Implement HTML5 sanitization for all exported HTML:

**File:** `src/security/html-sanitizer.js` (new)

Use DOMPurify-compatible library:
```javascript
const createDOMPurify = require('isomorphic-dompurify');

class HTMLSanitizer {
  constructor() {
    this.DOMPurify = createDOMPurify();
    this.config = {
      ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'p', 'br', 'div', 'span', 'table', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'img', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
      KEEP_CONTENT: true
    };
  }

  sanitize(htmlContent) {
    return this.DOMPurify.sanitize(htmlContent, this.config);
  }
}
```

---

### M-003: WebRTC IP Leakage via Internal/Local Addresses
**Severity:** MEDIUM - Privacy leak of local network info  
**Affected Files:** `src/evasion/webrtc-evasion.js`  
**Effort:** 8-16 hours  
**Timeline:** Days 4-6 of Phase 2

#### Problem Statement
WebRTC candidates expose:
- Local IP addresses (192.168.x.x, 10.x.x.x)
- mDNS names revealing hostnames
- Network topology information

#### Solution
Enhance existing WebRTC evasion module to block all local IP leakage:

**File:** `src/evasion/webrtc-evasion.js` (enhancement)

```javascript
/**
 * Technique 4: Complete Candidate Filtering
 * Blocks all candidates that reveal local network info
 */
blockLocalNetworkCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return { success: true, filtered: [] };
  }

  const blockedPatterns = [
    /^10\./,              // Class A private
    /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Class B private
    /^192\.168\./,        // Class C private
    /^127\./,             // Loopback
    /^169\.254\./,        // Link-local
    /^fc00:/,             // IPv6 unique local
    /^fe80:/,             // IPv6 link-local
    /\.local$/,           // mDNS
    /localhost/,          // Hostname
    /^::1$/               // IPv6 loopback
  ];

  const filtered = candidates.filter(candidate => {
    for (const pattern of blockedPatterns) {
      if (pattern.test(candidate)) {
        return false;
      }
    }
    return true;
  });

  return {
    success: true,
    technique: 'complete-local-blocking',
    originalCount: candidates.length,
    filteredCount: filtered.length,
    filtered,
    blockedCount: candidates.length - filtered.length
  };
}
```

---

### M-004: Python Client SSL/TLS Certificate Validation
**Severity:** HIGH - MITM attacks against Python clients  
**Affected Files:** `clients/python/basset_hound/client.py`  
**Effort:** 4-8 hours  
**Timeline:** Days 7-8 of Phase 2

#### Problem Statement
Python client connects without certificate validation:
```python
# Current vulnerable code
def connect(self):
    self._ws = websocket.WebSocketApp(
        self.url,
        # No certificate validation
    )
```

#### Solution
Implement strict SSL/TLS validation:

```python
import ssl
import certifi

def connect(self):
    # Create SSL context
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED
    
    # Add optional custom CA
    if self.ca_cert:
        ssl_context.load_verify_locations(self.ca_cert)
    
    self._ws = websocket.WebSocketApp(
        self.url,
        on_open=self._on_open,
        on_message=self._on_message,
        on_error=self._on_error,
        on_close=self._on_close,
        sslopt={"cert_reqs": ssl.CERT_REQUIRED, "ca_certs": certifi.where()}
    )
```

---

## LOW PRIORITY ISSUES

### L-001: CSS Injection in HTML Exports
**Severity:** LOW - Style-only attacks  
**Effort:** 4-6 hours  
**Integration:** Part of M-002 (HTML Sanitization)

### L-002: Rate Limiting on Forensic Exports
**Severity:** LOW - Resource exhaustion  
**Effort:** 4-6 hours  
**Integration:** Existing rate limiting module (`websocket/server.js:2027`)

### L-003: Integrity Verification for Exported Data
**Severity:** LOW - Nice-to-have audit trail  
**Effort:** 8-10 hours  
**Solution:** Add HMAC-SHA256 signatures to all exports

---

## Implementation Timeline

### Phase 1: Critical Fixes (Weeks 1-2)

| Day | Task | Owner | Hours | Dependencies |
|-----|------|-------|-------|--------------|
| 1-2 | H-001: Sensitive Data Masker Module | Engineer A | 8 | None |
| 2-3 | H-001: Integration into export_network_log | Engineer A | 6 | H-001 prep |
| 3-4 | H-001: Testing & Validation | Engineer B | 8 | H-001 integration |
| 3-5 | H-002: EncryptedExportManager | Engineer C | 12 | H-001 complete |
| 5-6 | H-002: WebSocketServer Integration | Engineer C | 8 | H-002 module |
| 6-7 | H-002: Python Client Updates | Engineer A | 6 | H-002 integration |
| 7 | H-001 & H-002: Staging Deployment | Engineer B | 4 | All integration complete |

**Phase 1 Total:** 52 hours (2 weeks, 2-3 engineers)

### Phase 2: Communication & Client (Weeks 2-3)

| Day | Task | Owner | Hours |
|-----|------|-------|-------|
| 8-9 | M-001: Enable SSL/TLS by Default | Engineer A | 6 |
| 9-10 | M-002: HTML Sanitizer Module | Engineer B | 16 |
| 10-11 | M-003: WebRTC IP Blocking | Engineer A | 10 |
| 11 | M-004: Python Client SSL/TLS | Engineer C | 6 |
| 11 | Phase 2: Full Testing | Engineer B | 4 |

**Phase 2 Total:** 42 hours (2 weeks, 3 engineers)

### Phase 3: Additional Hardening (Weeks 3-4)

| Day | Task | Owner | Hours |
|-----|------|-------|-------|
| 12 | L-001: CSS Injection Filter | Engineer A | 4 |
| 12-13 | L-002: Rate Limiting Configuration | Engineer B | 6 |
| 13-14 | L-003: HMAC Integrity Verification | Engineer A | 10 |
| 14 | Phase 3: QA & Documentation | Engineer C | 4 |

**Phase 3 Total:** 24 hours (1 week, 2 engineers)

---

## Parallel Execution Plan

### Week 1
- **Track A (Engineer 1):** H-001 Masker (days 1-3) → H-002 module start (day 3)
- **Track B (Engineer 2):** H-001 Testing setup (day 1) → H-001 Testing (days 2-4)
- **Track C (Engineer 3):** Infrastructure prep, documentation

### Week 2
- **Track A:** Complete H-002 module → Integration
- **Track B:** H-001 production hardening
- **Track C:** Begin M-001 & M-002

### Week 3
- **Track A:** M-003 & L-003
- **Track B:** M-002 & L-002
- **Track C:** M-004 & L-001

---

## Code Change Specifications

### File Additions
1. **`src/security/sensitive-data-masker.js`** (650 lines)
2. **`src/export/encrypted-export-manager.js`** (550 lines)
3. **`src/security/html-sanitizer.js`** (200 lines)
4. **`tests/unit/security-sensitive-data-masker.test.js`** (450 lines)
5. **`tests/unit/security-encrypted-export.test.js`** (400 lines)
6. **`tests/integration/security-export-masking.test.js`** (300 lines)
7. **`tests/integration/security-export-encryption.test.js`** (350 lines)

### File Modifications
1. **`websocket/server.js`**
   - Add imports (5 lines)
   - Add masking initialization (3 lines)
   - Add encryption initialization (3 lines)
   - Modify `export_network_log` handler (60 lines)
   - Add new command handlers (80 lines)
   - Total: ~150 line changes

2. **`clients/python/basset_hound/client.py`**
   - Add export retrieval methods (50 lines)
   - Add SSL/TLS validation (15 lines)
   - Add encryption support (20 lines)
   - Total: ~85 line changes

3. **`src/evasion/webrtc-evasion.js`**
   - Add local IP blocking technique (30 lines)

---

## Testing Strategy

### Unit Tests (1,200+ lines)
- **Sensitive Data Masker:** 450 lines
  - Pattern detection (API keys, credentials, PII)
  - Header masking
  - Query parameter masking
  - False positive handling

- **Encrypted Export Manager:** 400 lines
  - Encryption/decryption cycle
  - Access control
  - Metadata management
  - Compression/decompression

- **HTML Sanitizer:** 200 lines
  - XSS prevention
  - Allowed tag preservation
  - Script removal

- **WebRTC Evasion:** 150 lines
  - Local IP filtering
  - mDNS filtering
  - Candidate type filtering

### Integration Tests (1,000+ lines)
- **Export Masking:** 300 lines
  - Real network capture masking
  - Multiple request types
  - Performance benchmarks

- **Export Encryption:** 350 lines
  - Full encrypt/decrypt cycle
  - File persistence
  - Key rotation

- **Communication Security:** 200 lines
  - WSS handshake
  - Certificate validation
  - Client compatibility

- **Python Client:** 150 lines
  - SSL/TLS connectivity
  - Export retrieval
  - Error handling

### Acceptance Tests
- Real-world website captures with sensitive data
- Verify no plaintext credentials in exports
- Verify encrypted files unreadable without key
- Performance benchmarks (< 100ms overhead for masking)

---

## Risk Assessment & Mitigation

### HIGH RISKS

#### 1. Breaking Existing Integrations
**Risk:** Clients expecting unmasked data  
**Probability:** HIGH  
**Impact:** MEDIUM  
**Mitigation:**
- Add `includeSensitiveData` parameter (backward compatible)
- Provide migration guide
- Version bump to v12.8.0
- Add deprecation warnings in logs

#### 2. Performance Degradation
**Risk:** Regex masking adds 50-200ms per export  
**Probability:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Benchmark masking operation
- Cache compiled regexes
- Implement streaming for large exports
- Add async processing option

#### 3. Key Management Failures
**Risk:** Lost/compromised encryption keys  
**Probability:** LOW  
**Impact:** CRITICAL  
**Mitigation:**
- Implement key rotation monthly
- Store backup keys securely
- Use HSM in production
- Document key recovery procedures

#### 4. Compatibility Issues
**Risk:** Older Python client versions incompatible  
**Probability:** MEDIUM  
**Impact:** LOW  
**Mitigation:**
- Maintain backward-compatible API
- Version detection in client
- Provide client upgrade path

### MEDIUM RISKS

#### 1. False Positive Masking
**Risk:** Legitimate data masked incorrectly  
**Probability:** MEDIUM  
**Impact:** MEDIUM  
**Mitigation:**
- Maintain audit trail of masking operations
- Provide whitelist for known safe patterns
- Include summary statistics in exports

#### 2. Encryption Overhead
**Risk:** Large exports take longer to decrypt  
**Probability:** LOW  
**Impact:** LOW  
**Mitigation:**
- Implement async decryption
- Add caching for frequent exports
- Stream large files instead of buffering

---

## Success Criteria

### Phase 1 Completion (H-001, H-002)
- ✅ All sensitive data patterns detected and masked
- ✅ 100% of exported data encrypted at rest
- ✅ 95%+ unit test coverage
- ✅ < 150ms overhead for masking + encryption
- ✅ Zero backward compatibility issues
- ✅ Staging deployment successful

### Phase 2 Completion (M-001 through M-004)
- ✅ All WebSocket connections use WSS (SSL/TLS)
- ✅ HTML exports sanitized (no JavaScript)
- ✅ WebRTC candidates filtered (no local IPs)
- ✅ Python client validates certificates
- ✅ Zero security vulnerabilities in communication

### Phase 3 Completion (L-001 through L-003)
- ✅ CSS injection prevented
- ✅ Rate limiting enforced on exports
- ✅ All exports have HMAC signatures
- ✅ Full security audit passed

### Overall Success Criteria
- ✅ OWASP Top 10 compliance
- ✅ Zero high-severity vulnerabilities
- ✅ Security audit report generated
- ✅ Production deployment approved
- ✅ v12.8.0 release ready

---

## Deployment Checklist

### Pre-Deployment
- [ ] Code review of all changes
- [ ] Security review by dedicated team
- [ ] Unit test coverage > 95%
- [ ] Integration tests pass
- [ ] Performance benchmarks meet targets
- [ ] Documentation complete
- [ ] Migration scripts prepared

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Verify encryption/masking in production-like environment
- [ ] Measure performance impact
- [ ] Collect logs and metrics
- [ ] Get sign-off from security team

### Production Deployment
- [ ] Create deployment runbook
- [ ] Prepare rollback plan
- [ ] Deploy Phase 1 (H-001, H-002)
- [ ] Monitor for 24 hours
- [ ] Deploy Phase 2 (M-001-M-004)
- [ ] Monitor for 24 hours
- [ ] Deploy Phase 3 (L-001-L-003)
- [ ] Final security audit

---

## Documentation Plan

### Technical Documentation
1. **Security Architecture Guide** (10 pages)
   - Masking patterns and strategy
   - Encryption at rest implementation
   - Key management procedures

2. **API Changes Documentation** (5 pages)
   - New parameters for export commands
   - Encryption status endpoints
   - Client library updates

3. **Operational Guide** (8 pages)
   - Key rotation procedures
   - Audit trail review
   - Troubleshooting guide

### User Documentation
1. **Security Best Practices** (5 pages)
2. **Export Handling Guide** (3 pages)
3. **Migration Guide** (4 pages)

---

## Conclusion

This roadmap provides a structured approach to hardening Basset Hound Browser's security posture with:

- **88-112 total engineering hours** distributed across 4-6 weeks
- **3 parallel execution tracks** to minimize timeline
- **Detailed implementation specifications** for each issue
- **Comprehensive testing strategy** covering unit, integration, and acceptance tests
- **Risk mitigation plans** for all identified hazards
- **Clear success criteria** for each phase

**Estimated Completion:** v12.8.0 release within 6 weeks from start date  
**Risk Level:** LOW (existing infrastructure, no architectural changes)  
**Security Impact:** CRITICAL (eliminates 9 major vulnerability classes)

