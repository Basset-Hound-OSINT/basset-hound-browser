# Security Fixes Plan - Phase 1 (v12.8.0)
**Date:** June 15, 2026  
**Status:** PLANNING  
**Priority:** HIGH  
**Effort Estimate:** 8-10 hours (4 primary fixes + 1 optional deferred)  
**Timeline:** 1-2 days for core fixes  

---

## Executive Summary

This document outlines the Phase 1 security hardening plan for Basset Hound Browser v12.8.0. Four medium-priority security enhancements address credential protection, brute force prevention, data collection ethics, and documentation standards.

| Fix | Priority | Effort | Risk | Timeline |
|-----|----------|--------|------|----------|
| WSS Enforcement for Credentials | MEDIUM | 2-3h | LOW | 1 day |
| Rate Limiting for TOTP | MEDIUM | 3-4h | LOW | 1 day |
| Monitoring Consent Control | MEDIUM | 2-3h | LOW | 1 day |
| Ethics Guidelines Doc | LOW | 1h | NONE | 2-4h |
| Command-Level ACLs | OPTIONAL | 4-6h | LOW | Phase 2 |

**Total:** 8-10 hours for Phase 1; can complete in 1-2 days with parallel implementation.

---

## Fix #1: WSS ENFORCEMENT FOR CREDENTIAL COMMANDS

**Priority:** MEDIUM  
**Objective:** Prevent plaintext transmission of credentials and secrets over unencrypted WebSocket connections  
**Impact:** All credential operations (TOTP validation, token management, secret storage)  
**Risk Level:** LOW (straightforward validation)  
**Effort:** 2-3 hours  

### Current State Analysis
- Credential commands accept unencrypted connections
- Secrets transmitted in plaintext over standard WS protocol
- No encryption requirement enforced at protocol level
- Clear security vulnerability for sensitive data

### Implementation Plan

#### 1.1 Update Credential Command Handlers
**File:** `websocket/commands/credentials-commands.js`

Add WSS enforcement at the start of each credential handler:

```javascript
// Template for all credential command handlers
const requireWSS = (ws, commandName) => {
  if (!ws.isSecure) {
    return {
      success: false,
      error: 'SECURE_CONNECTION_REQUIRED',
      message: 'Credential operations require WSS (WebSocket Secure/TLS) connection. ' +
               'Please reconnect using wss:// protocol with TLS enabled.',
      command: commandName,
      timestamp: new Date().toISOString()
    };
  }
  return null;
};

// In each credential handler (TOTP, token, secret operations)
exports.handleValidateTOTP = async (data, ws) => {
  const securityError = requireWSS(ws, 'validate-totp');
  if (securityError) {
    ws.send(JSON.stringify(securityError));
    return;
  }
  // ... rest of TOTP validation logic
};

exports.handleSetSecret = async (data, ws) => {
  const securityError = requireWSS(ws, 'set-secret');
  if (securityError) {
    ws.send(JSON.stringify(securityError));
    return;
  }
  // ... rest of secret storage logic
};

// Apply similarly to all credential-related commands:
// - validate-totp
// - get-token
// - set-secret
// - revoke-credential
// - refresh-token
// - verify-credential
```

#### 1.2 Server-Level Connection Validation
**File:** `websocket/server.js`

Add secure connection requirements to WebSocket configuration:

```javascript
const secureCredentialCommands = new Set([
  'validate-totp',
  'get-token',
  'set-secret',
  'revoke-credential',
  'refresh-token',
  'verify-credential',
  'store-api-key',
  'retrieve-api-key'
]);

// In WebSocket message handler
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    const { command } = message;
    
    // Check if this is a credential command
    if (secureCredentialCommands.has(command)) {
      if (!ws.isSecure) {
        ws.send(JSON.stringify({
          success: false,
          error: 'SECURE_CONNECTION_REQUIRED',
          message: 'Credential operations require WSS (WebSocket Secure/TLS) connection.',
          command,
          timestamp: new Date().toISOString(),
          details: {
            requiresWSS: true,
            currentProtocol: ws.isSecure ? 'WSS' : 'WS'
          }
        }));
        return;
      }
    }
    
    // Process normally if secure or non-credential command
    handleCommand(message, ws);
  } catch (err) {
    logger.error('WebSocket message error:', err);
  }
});
```

#### 1.3 Connection Initialization
Update connection initialization to document WSS requirement:

```javascript
// In connection handler
ws.on('open', () => {
  logger.info('WebSocket connection established', {
    isSecure: ws.isSecure,
    protocol: ws.isSecure ? 'WSS' : 'WS',
    remoteAddress: ws._socket.remoteAddress
  });
  
  // Send security info on connect
  ws.send(JSON.stringify({
    type: 'connection-info',
    secure: ws.isSecure,
    message: ws.isSecure 
      ? 'Secure connection established' 
      : 'WARNING: Unencrypted connection. Credential operations require WSS.',
    timestamp: new Date().toISOString()
  }));
});
```

### Testing Specifications

#### Test Suite: `tests/security/wss-enforcement.test.js`

```javascript
describe('WSS Enforcement for Credential Commands', () => {
  
  describe('Non-Secure Connections (WS)', () => {
    test('validate-totp rejects unencrypted connection', async () => {
      // Setup WS (non-secure) connection
      // Send validate-totp command
      // Expect: SECURE_CONNECTION_REQUIRED error
      // Verify: Command not processed
    });
    
    test('get-token rejects unencrypted connection', async () => {
      // Setup WS connection
      // Send get-token command
      // Expect: Clear error message with wss:// protocol recommendation
    });
    
    test('set-secret rejects unencrypted connection', async () => {
      // Setup WS connection
      // Send set-secret command
      // Expect: Security error with proper guidance
    });
    
    test('revoke-credential rejects unencrypted connection', async () => {
      // Setup WS connection
      // Send revoke-credential command
      // Expect: SECURE_CONNECTION_REQUIRED error
    });
    
    test('refresh-token rejects unencrypted connection', async () => {
      // Setup WS connection
      // Send refresh-token command
      // Expect: Security enforcement
    });
  });
  
  describe('Secure Connections (WSS)', () => {
    test('validate-totp succeeds with WSS', async () => {
      // Setup WSS (secure) connection with TLS
      // Send validate-totp command with valid TOTP
      // Expect: Success response
      // Verify: Token validated normally
    });
    
    test('get-token succeeds with WSS', async () => {
      // Setup WSS connection
      // Send get-token command
      // Expect: Token returned successfully
    });
    
    test('set-secret succeeds with WSS', async () => {
      // Setup WSS connection
      // Send set-secret with secret data
      // Expect: Secret stored successfully
    });
    
    test('revoke-credential succeeds with WSS', async () => {
      // Setup WSS connection
      // Send revoke-credential
      // Expect: Credential revoked successfully
    });
    
    test('refresh-token succeeds with WSS', async () => {
      // Setup WSS connection
      // Send refresh-token
      // Expect: New token returned
    });
  });
  
  describe('Error Messages', () => {
    test('error message clearly indicates WSS requirement', async () => {
      // Send credential command over WS
      // Verify error message contains: "WSS", "TLS", "wss://"
      // Verify message is actionable (how to fix)
    });
    
    test('error response includes protocol information', async () => {
      // Send command over unencrypted connection
      // Verify response includes: requiresWSS, currentProtocol, timestamp
    });
  });
});
```

**Test Count:** 5+ tests (non-secure rejection) + 5+ tests (secure success) = 10+ total

### Implementation Checklist
- [ ] Add `requireWSS()` helper function to credentials-commands.js
- [ ] Apply to all 8+ credential command handlers
- [ ] Add server-level validation in WebSocket message handler
- [ ] Update connection initialization to send security info
- [ ] Add comprehensive error messages with WSS guidance
- [ ] Create test suite (10+ tests)
- [ ] Test with actual WSS connection (TLS certificate)
- [ ] Test with WS connection (rejection)
- [ ] Verify no false positives on non-credential commands
- [ ] Document in API reference

### Success Criteria
✓ All credential commands reject WS connections  
✓ All credential commands accept WSS connections  
✓ Error messages are clear and actionable  
✓ Non-credential commands unaffected  
✓ 10+ tests passing with 100% pass rate  
✓ No performance degradation  

---

## Fix #2: RATE LIMITING FOR CREDENTIAL VALIDATION

**Priority:** MEDIUM  
**Objective:** Prevent brute force attacks on TOTP validation and credential verification  
**Impact:** TOTP validation, token refresh, credential verification  
**Risk Level:** LOW (standard pattern)  
**Effort:** 3-4 hours  

### Current State Analysis
- No rate limiting on credential validation attempts
- Brute force attacks could enumerate TOTP codes or tokens
- No tracking of failed attempts per client
- Unlimited retry capability per connection

### Implementation Plan

#### 2.1 Create Rate Limiter Infrastructure
**File:** `src/infrastructure/rate-limiter.js` (create new)

```javascript
/**
 * Rate Limiter for credential operations
 * Tracks failed attempts per IP with exponential backoff
 */

class CredentialRateLimiter {
  constructor() {
    // Map: clientIP -> { attempts: number, timestamp: ms, backoffLevel: number }
    this.failedAttempts = new Map();
    this.ttl = 60000; // 60 seconds
    this.cleanupInterval = 30000; // Clean old entries every 30s
    
    // Start cleanup
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Calculate backoff delay in milliseconds
   * Level 0: 0ms (first attempt)
   * Level 1: 1000ms (2nd-5th)
   * Level 2: 5000ms (6th+)
   */
  getBackoffDelay(level) {
    if (level === 0) return 0;
    if (level === 1) return 1000;
    return 5000; // Level 2+
  }

  /**
   * Check if a validation attempt is allowed
   * Returns: { allowed: boolean, delay: ms, reason: string }
   */
  checkAttempt(clientIP) {
    const now = Date.now();
    const record = this.failedAttempts.get(clientIP);
    
    // First attempt or record expired
    if (!record || (now - record.timestamp > this.ttl)) {
      return {
        allowed: true,
        delay: 0,
        reason: 'First attempt',
        attemptsRemaining: 5
      };
    }
    
    // Check if still within rate limit window
    const timeSinceLastAttempt = now - record.timestamp;
    const backoffDelay = this.getBackoffDelay(record.backoffLevel);
    
    if (timeSinceLastAttempt < backoffDelay) {
      return {
        allowed: false,
        delay: backoffDelay - timeSinceLastAttempt,
        reason: `Rate limited. Exponential backoff level ${record.backoffLevel}`,
        attemptsRemaining: Math.max(0, 5 - record.attempts)
      };
    }
    
    // Allowed, but within same minute (increment backoff if max attempts exceeded)
    if (record.attempts >= 5) {
      record.backoffLevel = Math.min(2, record.backoffLevel + 1);
      return {
        allowed: false,
        delay: this.getBackoffDelay(record.backoffLevel),
        reason: `Maximum attempts exceeded. Backoff level ${record.backoffLevel}`,
        attemptsRemaining: 0
      };
    }
    
    return {
      allowed: true,
      delay: 0,
      reason: 'Attempt allowed',
      attemptsRemaining: 5 - record.attempts
    };
  }

  /**
   * Record a failed validation attempt
   */
  recordFailedAttempt(clientIP) {
    const now = Date.now();
    const record = this.failedAttempts.get(clientIP);
    
    if (!record || (now - record.timestamp > this.ttl)) {
      this.failedAttempts.set(clientIP, {
        attempts: 1,
        timestamp: now,
        backoffLevel: 0
      });
    } else {
      record.attempts += 1;
      record.timestamp = now;
      if (record.attempts > 5) {
        record.backoffLevel = Math.min(2, record.backoffLevel + 1);
      }
    }
  }

  /**
   * Clear failed attempts for a client (after successful validation)
   */
  clearFailedAttempts(clientIP) {
    this.failedAttempts.delete(clientIP);
  }

  /**
   * Clean up expired records
   */
  cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.failedAttempts.entries()) {
      if (now - record.timestamp > this.ttl) {
        this.failedAttempts.delete(ip);
      }
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    return {
      trackedIPs: this.failedAttempts.size,
      entries: Array.from(this.failedAttempts.entries()).map(([ip, record]) => ({
        ip,
        attempts: record.attempts,
        backoffLevel: record.backoffLevel,
        age: Date.now() - record.timestamp
      }))
    };
  }
}

module.exports = new CredentialRateLimiter();
```

#### 2.2 Integrate Rate Limiter into Credential Commands
**File:** `websocket/commands/credentials-commands.js`

```javascript
const rateLimiter = require('../../src/infrastructure/rate-limiter');

/**
 * Validate TOTP with rate limiting
 */
exports.handleValidateTOTP = async (data, ws, req) => {
  const clientIP = req.socket.remoteAddress;
  
  // Check rate limit
  const rateCheckResult = rateLimiter.checkAttempt(clientIP);
  
  if (!rateCheckResult.allowed) {
    ws.send(JSON.stringify({
      success: false,
      error: 'RATE_LIMITED',
      message: `Too many validation attempts. Please try again in ${Math.ceil(rateCheckResult.delay / 1000)} seconds.`,
      delayMs: rateCheckResult.delay,
      reason: rateCheckResult.reason,
      attemptsRemaining: rateCheckResult.attemptsRemaining,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  try {
    const { secret, code } = data;
    
    // Validate TOTP logic here
    const isValid = validateTOTP(secret, code);
    
    if (isValid) {
      // Success: Clear rate limit
      rateLimiter.clearFailedAttempts(clientIP);
      ws.send(JSON.stringify({
        success: true,
        message: 'TOTP validation successful',
        timestamp: new Date().toISOString()
      }));
    } else {
      // Failure: Record attempt
      rateLimiter.recordFailedAttempt(clientIP);
      const checkResult = rateLimiter.checkAttempt(clientIP);
      
      ws.send(JSON.stringify({
        success: false,
        error: 'INVALID_TOTP',
        message: 'Invalid TOTP code',
        attemptsRemaining: checkResult.attemptsRemaining,
        timestamp: new Date().toISOString()
      }));
    }
  } catch (err) {
    logger.error('TOTP validation error:', err);
    ws.send(JSON.stringify({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Failed to validate TOTP'
    }));
  }
};

/**
 * Verify credential with rate limiting
 */
exports.handleVerifyCredential = async (data, ws, req) => {
  const clientIP = req.socket.remoteAddress;
  
  // Check rate limit
  const rateCheckResult = rateLimiter.checkAttempt(clientIP);
  
  if (!rateCheckResult.allowed) {
    ws.send(JSON.stringify({
      success: false,
      error: 'RATE_LIMITED',
      message: `Too many verification attempts. Please try again in ${Math.ceil(rateCheckResult.delay / 1000)} seconds.`,
      delayMs: rateCheckResult.delay,
      attemptsRemaining: rateCheckResult.attemptsRemaining,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Verification logic...
  const isValid = await verifyCredential(data);
  
  if (isValid) {
    rateLimiter.clearFailedAttempts(clientIP);
    ws.send(JSON.stringify({ success: true }));
  } else {
    rateLimiter.recordFailedAttempt(clientIP);
    ws.send(JSON.stringify({
      success: false,
      error: 'INVALID_CREDENTIAL'
    }));
  }
};

/**
 * Refresh token with rate limiting
 */
exports.handleRefreshToken = async (data, ws, req) => {
  const clientIP = req.socket.remoteAddress;
  
  const rateCheckResult = rateLimiter.checkAttempt(clientIP);
  if (!rateCheckResult.allowed) {
    ws.send(JSON.stringify({
      success: false,
      error: 'RATE_LIMITED',
      message: `Too many refresh attempts. Please wait ${Math.ceil(rateCheckResult.delay / 1000)} seconds.`,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Token refresh logic...
};
```

#### 2.3 Add Monitoring Endpoint (Optional)
**File:** `websocket/commands/system-commands.js`

```javascript
/**
 * Get rate limiting statistics (admin only)
 */
exports.handleGetRateLimitStats = async (data, ws, req) => {
  // Verify admin/internal request
  const clientIP = req.socket.remoteAddress;
  
  const stats = rateLimiter.getStats();
  
  ws.send(JSON.stringify({
    success: true,
    rateLimit: stats,
    timestamp: new Date().toISOString()
  }));
};
```

### Testing Specifications

#### Test Suite: `tests/security/rate-limiting.test.js`

```javascript
describe('Rate Limiting for Credential Operations', () => {
  
  describe('TOTP Validation Rate Limiting', () => {
    test('first 5 attempts within 60s succeed rate check', async () => {
      // Simulate 5 failed TOTP attempts from same IP
      // Expect: All 5 attempts rate-check passes
      // Verify: Attempts tracked in limiter
    });
    
    test('6th attempt within 60s is rate limited (backoff level 1)', async () => {
      // Simulate 6 failed attempts
      // 6th attempt should be delayed 1000ms (level 1)
      // Send immediately: get RATE_LIMITED error
      // Response includes: delayMs, attemptsRemaining
    });
    
    test('7th attempt with backoff level 2 requires 5s wait', async () => {
      // After 6+ failures, enter backoff level 2
      // 7th attempt immediately: delayed 5000ms
      // Response indicates longer backoff
    });
    
    test('successful TOTP validation clears rate limit', async () => {
      // Record 2 failed attempts
      // Send valid TOTP
      // Expect: Success, rate limit cleared
      // Verify: Next attempt doesn't count previous failures
    });
  });
  
  describe('Exponential Backoff', () => {
    test('backoff escalates: 0ms -> 1s -> 5s', async () => {
      // Track backoff levels
      // Level 0: 0ms delay
      // Level 1 (after 5 failures): 1000ms delay
      // Level 2 (after 6+ failures): 5000ms delay
      // Verify: Delays match expected values
    });
    
    test('time window resets after 60 seconds', async () => {
      // Record failed attempts
      // Wait 61 seconds
      // Next attempt should have 0ms delay (new window)
    });
    
    test('backoff level persists within rate limit window', async () => {
      // Record failures → reach level 2
      // Multiple denied attempts
      // Each stays at level 2 (5s delay) until window expires
    });
  });
  
  describe('Multiple Operations', () => {
    test('rate limiting applies to verify-credential', async () => {
      // Send 6 verify-credential attempts
      // 6th attempt rate limited
    });
    
    test('rate limiting applies to refresh-token', async () => {
      // Send 6 refresh-token attempts
      // 6th attempt rate limited
    });
    
    test('different IPs tracked separately', async () => {
      // IP1: 5 failed attempts
      // IP2: 5 failed attempts
      // Each IP tracked independently
      // Neither blocked (both at 5 attempts)
    });
  });
  
  describe('Error Responses', () => {
    test('RATE_LIMITED response includes delay in seconds', async () => {
      // Trigger rate limit
      // Verify response includes:
      // - error: 'RATE_LIMITED'
      // - delayMs: number
      // - attemptsRemaining: number
      // - message with "try again in X seconds"
    });
    
    test('response includes actionable guidance', async () => {
      // Trigger rate limit
      // Verify message clearly states: wait time and action
    });
  });
});
```

**Test Count:** 3 tests (basic rate limiting) + 3 tests (exponential backoff) + 3 tests (multiple operations) + 2 tests (error responses) = 11+ total

### Implementation Checklist
- [ ] Create `src/infrastructure/rate-limiter.js`
- [ ] Implement `CredentialRateLimiter` class with all methods
- [ ] Add rate limiter to `credentials-commands.js`
- [ ] Integrate into `validate-totp` handler
- [ ] Integrate into `verify-credential` handler
- [ ] Integrate into `refresh-token` handler
- [ ] Add error response formatting
- [ ] Create comprehensive test suite (11+ tests)
- [ ] Test exponential backoff timing
- [ ] Test TTL expiration (60-second window)
- [ ] Test multiple IP tracking
- [ ] Document in API reference

### Success Criteria
✓ First 5 attempts allowed per 60-second window  
✓ 6th+ attempts rejected with exponential backoff  
✓ Backoff: 0ms → 1000ms → 5000ms escalation  
✓ Clear error messages with wait times  
✓ Rate limits reset after 60 seconds  
✓ Multiple IPs tracked independently  
✓ 11+ tests passing with 100% pass rate  

---

## Fix #3: MONITORING CONSENT CONTROL

**Priority:** MEDIUM  
**Objective:** Require explicit opt-in for behavioral data collection and monitoring  
**Impact:** Metrics collection, behavioral analysis, performance monitoring  
**Risk Level:** LOW (flag-based)  
**Effort:** 2-3 hours  

### Current State Analysis
- Behavioral monitoring runs by default
- No explicit consent mechanism for data collection
- No opt-in/opt-out capability
- Privacy concern for users who don't expect data collection

### Implementation Plan

#### 3.1 Update WebSocket Initialization
**File:** `websocket/server.js`

```javascript
/**
 * Enhanced WebSocket server with consent-based monitoring
 */

// Add to connection handler
ws.on('connection', (ws, req) => {
  const clientId = generateClientId();
  
  // Initialize client context with consent tracking
  ws.clientContext = {
    id: clientId,
    connectedAt: Date.now(),
    monitoringConsent: false, // Default: no consent
    consentTimestamp: null,
    consentRevoked: false,
    behaviors: [],
    metrics: {}
  };
  
  // Send initialization message requiring explicit consent
  ws.send(JSON.stringify({
    type: 'initialize',
    clientId,
    message: 'Connection established',
    consentRequired: true,
    monitoring: {
      enabled: false,
      message: 'Behavioral monitoring is disabled by default. ' +
               'Send command: {"command": "set-monitoring-consent", "enabled": true} to enable.',
      details: {
        tracked: ['command-patterns', 'timing', 'error-rates', 'resource-usage'],
        retention: '30 days',
        usage: 'Performance analysis and optimization only'
      }
    },
    timestamp: new Date().toISOString()
  }));
});

// Add message handler for consent management
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    
    // Handle monitoring consent command
    if (message.command === 'set-monitoring-consent') {
      handleMonitoringConsent(message, ws);
      return;
    }
    
    // Handle consent revocation
    if (message.command === 'revoke-monitoring-consent') {
      handleRevokeMonitoringConsent(ws);
      return;
    }
    
    // Check if monitoring is allowed before collecting data
    if (ws.clientContext && !ws.clientContext.monitoringConsent) {
      // Don't track behavior if consent not granted
    }
    
    // Process command normally
    handleCommand(message, ws);
  } catch (err) {
    logger.error('WebSocket message error:', err);
  }
});

/**
 * Handle monitoring consent grant
 */
function handleMonitoringConsent(data, ws) {
  const { enabled } = data;
  
  if (!enabled) {
    ws.send(JSON.stringify({
      success: false,
      error: 'INVALID_CONSENT',
      message: 'set-monitoring-consent requires enabled: true'
    }));
    return;
  }
  
  ws.clientContext.monitoringConsent = true;
  ws.clientContext.consentTimestamp = new Date().toISOString();
  
  // Log consent grant for audit trail
  logger.info('Monitoring consent granted', {
    clientId: ws.clientContext.id,
    timestamp: ws.clientContext.consentTimestamp,
    remoteAddress: ws._socket.remoteAddress
  });
  
  ws.send(JSON.stringify({
    success: true,
    message: 'Behavioral monitoring enabled',
    consentStatus: {
      enabled: true,
      grantedAt: ws.clientContext.consentTimestamp,
      tracking: {
        commandPatterns: true,
        timing: true,
        errorRates: true,
        resourceUsage: true
      },
      retention: '30 days',
      canRevoke: true
    },
    timestamp: new Date().toISOString()
  }));
}

/**
 * Handle consent revocation
 */
function handleRevokeMonitoringConsent(ws) {
  const wasMonitoring = ws.clientContext.monitoringConsent;
  
  ws.clientContext.monitoringConsent = false;
  ws.clientContext.consentRevoked = true;
  
  // Log revocation for audit trail
  logger.info('Monitoring consent revoked', {
    clientId: ws.clientContext.id,
    wasMonitoring,
    revokedAt: new Date().toISOString()
  });
  
  ws.send(JSON.stringify({
    success: true,
    message: 'Behavioral monitoring disabled',
    consentStatus: {
      enabled: false,
      revokedAt: new Date().toISOString(),
      details: 'All behavioral tracking stopped. Historical data retained for 30 days.'
    },
    timestamp: new Date().toISOString()
  }));
}
```

#### 3.2 Update Metrics Collector
**File:** `src/monitoring/metrics-collector.js`

```javascript
/**
 * Enhanced metrics collector respecting consent
 */

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Record a metric only if consent is granted
   */
  recordMetric(clientContext, metricName, value) {
    // Check consent before recording
    if (!clientContext || !clientContext.monitoringConsent) {
      return; // Silently ignore if no consent
    }
    
    const clientId = clientContext.id;
    
    if (!this.metrics.has(clientId)) {
      this.metrics.set(clientId, {
        clientId,
        consentAt: clientContext.consentTimestamp,
        recordedAt: Date.now(),
        metrics: {}
      });
    }
    
    const clientMetrics = this.metrics.get(clientId);
    if (!clientMetrics.metrics[metricName]) {
      clientMetrics.metrics[metricName] = [];
    }
    
    clientMetrics.metrics[metricName].push({
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Record behavioral pattern only if consent is granted
   */
  recordBehavior(clientContext, behavior) {
    if (!clientContext || !clientContext.monitoringConsent) {
      return; // Silently ignore if no consent
    }
    
    clientContext.behaviors.push({
      behavior,
      timestamp: Date.now()
    });
  }

  /**
   * Get metrics for a client (with consent validation)
   */
  getMetrics(clientId) {
    return this.metrics.get(clientId) || null;
  }

  /**
   * Delete metrics when consent is revoked
   */
  deleteMetrics(clientId) {
    this.metrics.delete(clientId);
  }

  /**
   * Get statistics about monitoring
   */
  getMonitoringStats() {
    return {
      clientsWithConsent: this.metrics.size,
      totalMetrics: Array.from(this.metrics.values())
        .reduce((sum, client) => sum + Object.keys(client.metrics).length, 0)
    };
  }
}

module.exports = new MetricsCollector();
```

#### 3.3 Update Command Handlers
**File:** `websocket/commands/monitoring-commands.js` (or relevant command files)

```javascript
const metricsCollector = require('../../src/monitoring/metrics-collector');

/**
 * Command handler with consent-aware monitoring
 */
exports.handleCommand = (command, data, ws) => {
  const startTime = Date.now();
  
  try {
    // Execute command logic
    const result = executeCommand(command, data);
    
    // Only record metrics if consent granted
    if (ws.clientContext && ws.clientContext.monitoringConsent) {
      const duration = Date.now() - startTime;
      metricsCollector.recordMetric(ws.clientContext, `command_${command}_duration`, duration);
      metricsCollector.recordBehavior(ws.clientContext, {
        type: 'command_executed',
        command,
        success: true
      });
    }
    
    return result;
  } catch (err) {
    // Record error even with monitoring (optional - depends on policy)
    if (ws.clientContext && ws.clientContext.monitoringConsent) {
      metricsCollector.recordBehavior(ws.clientContext, {
        type: 'command_error',
        command,
        error: err.message
      });
    }
    
    throw err;
  }
};
```

### Testing Specifications

#### Test Suite: `tests/security/monitoring-consent.test.js`

```javascript
describe('Monitoring Consent Control', () => {
  
  describe('Default State (No Consent)', () => {
    test('monitoring disabled by default on connection', async () => {
      // Connect to WebSocket
      // Verify: consentStatus.enabled === false
      // Verify: initialization message includes consent requirement
    });
    
    test('metrics not recorded without consent', async () => {
      // Connect without granting consent
      // Execute commands
      // Verify: No metrics collected in collector
      // Verify: clientContext.monitoringConsent === false
    });
    
    test('behavioral data not tracked without consent', async () => {
      // Connect, execute multiple commands
      // Without consent: behaviors array empty
      // Verify: No tracking in metrics collector
    });
    
    test('initialization message explains monitoring option', async () => {
      // Connect
      // Verify init message includes:
      // - consentRequired: true
      // - What data would be tracked
      // - How to enable it
      // - Retention policy
    });
  });
  
  describe('Granting Consent', () => {
    test('send set-monitoring-consent enables monitoring', async () => {
      // Connect
      // Send: {"command": "set-monitoring-consent", "enabled": true}
      // Verify response: success: true, consentStatus.enabled: true
      // Verify: clientContext.monitoringConsent === true
    });
    
    test('consent grant includes timestamp', async () => {
      // Grant consent
      // Verify response includes: grantedAt timestamp
      // Verify: timestamp recorded in clientContext
    });
    
    test('metrics collected after consent granted', async () => {
      // Grant consent
      // Execute commands
      // Verify: Metrics recorded in collector
      // Verify: Behavioral data tracked
    });
    
    test('invalid consent request rejected', async () => {
      // Send: {"command": "set-monitoring-consent", "enabled": false}
      // Verify: error: 'INVALID_CONSENT'
      // Send: {"command": "set-monitoring-consent"} (missing enabled)
      // Verify: rejected with clear error
    });
  });
  
  describe('Revoking Consent', () => {
    test('revoke-monitoring-consent stops tracking', async () => {
      // Grant consent, execute commands (metrics recorded)
      // Send: {"command": "revoke-monitoring-consent"}
      // Verify response: success: true, consentStatus.enabled: false
      // Verify: clientContext.monitoringConsent === false
    });
    
    test('revocation stops new metrics collection', async () => {
      // Grant consent, execute commands (5 metrics)
      // Revoke consent
      // Execute more commands
      // Verify: Only 5 metrics (new ones not recorded)
    });
    
    test('revocation logged for audit trail', async () => {
      // Grant consent
      // Revoke consent
      // Verify: Audit log entry for revocation
      // Includes: clientId, timestamp, wasMonitoring: true
    });
    
    test('can re-grant consent after revocation', async () => {
      // Grant → Execute → Revoke
      // Send: set-monitoring-consent enabled: true
      // Verify: Monitoring re-enabled
      // Execute commands
      // Verify: New metrics recorded
    });
  });
  
  describe('Consent Management', () => {
    test('consent status includes tracking details', async () => {
      // Grant consent
      // Verify response includes all tracked categories:
      // - commandPatterns
      // - timing
      // - errorRates
      // - resourceUsage
    });
    
    test('retention policy clearly stated', async () => {
      // Get initialization or consent status
      // Verify: retention policy mentioned (e.g., "30 days")
    });
  });
});
```

**Test Count:** 4 tests (default state) + 4 tests (granting consent) + 4 tests (revoking consent) + 2 tests (management) = 14+ total

### Implementation Checklist
- [ ] Update WebSocket initialization to require consent
- [ ] Add `clientContext` with `monitoringConsent` flag
- [ ] Implement `set-monitoring-consent` command handler
- [ ] Implement `revoke-monitoring-consent` command handler
- [ ] Update metrics collector to check consent
- [ ] Update behavior tracking to check consent
- [ ] Add audit logging for consent grant/revoke
- [ ] Create comprehensive test suite (14+ tests)
- [ ] Test default state (no consent)
- [ ] Test consent grant and tracking
- [ ] Test consent revocation and tracking stop
- [ ] Test re-granting after revocation
- [ ] Document in API reference and user guide

### Success Criteria
✓ Monitoring disabled by default  
✓ Explicit consent required for tracking  
✓ Clear messaging about what's tracked  
✓ Metrics only recorded with consent  
✓ Consent can be revoked at any time  
✓ Consent management audited  
✓ 14+ tests passing with 100% pass rate  

---

## Fix #4: ETHICS GUIDELINES DOCUMENTATION

**Priority:** LOW  
**Objective:** Document legitimate vs prohibited use cases and ethical boundaries  
**Impact:** User education, legal compliance, responsible disclosure  
**Risk Level:** NONE (documentation only)  
**Effort:** 1 hour  

### Current State Analysis
- No formal ethics guidelines
- No guidance on legitimate vs prohibited use
- Risk of misuse without clear boundaries
- Missing responsibility statements

### Implementation Plan

#### 4.1 Create Ethics Guidelines Document
**File:** `docs/guides/EVASION-ETHICS-GUIDELINES.md`

```markdown
# Bot Evasion & Browser Automation Ethics Guidelines

**Last Updated:** June 15, 2026  
**Status:** FINAL  
**Version:** 1.0

## Executive Summary

Basset Hound Browser provides advanced bot evasion and browser automation capabilities 
for legitimate purposes including privacy protection, security testing, and research. 
This document defines ethical boundaries and prohibited uses.

---

## Legitimate Use Cases

### 1. Privacy & Anonymity Protection
- **Personal Privacy:** Hiding browsing patterns from ISPs, network administrators, etc.
- **Journalist Protection:** Secure, evasion-enabled research in hostile environments
- **Activist Security:** Protecting dissidents accessing restricted information
- **Academic Research:** Studying detection mechanisms and evasion techniques
- **Security Testing:** Testing own systems' ability to detect bot behavior

### 2. Security & Vulnerability Research
- **Authorized Testing:** Penetration testing on systems you own or have written permission
- **Bug Bounty Programs:** Finding and reporting vulnerabilities responsibly
- **Detection System Validation:** Testing security tools' effectiveness
- **Threat Modeling:** Understanding attack methodologies for defense
- **Compliance Auditing:** Testing systems meet security standards

### 3. Business & Operational Use
- **Web Scraping (Legal):** Extracting data from sites that permit it (check robots.txt, ToS)
- **Price Monitoring:** Tracking competitor pricing on permitted sites
- **Accessibility Testing:** Ensuring websites work across user profiles
- **Quality Assurance:** Testing web applications with realistic browsers
- **Content Backup:** Archiving public content you have rights to access

### 4. Personal Productivity
- **Automation:** Automating repetitive tasks on sites you own
- **Testing:** Validating your own web applications
- **Learning:** Educational exploration of web technologies
- **Data Portability:** Exporting your own data from platforms

---

## Prohibited Use Cases

### ABSOLUTELY PROHIBITED
❌ **Fraud & Financial Crime**
- Credit card testing (carding)
- Account takeover (ATO)
- Credential stuffing
- Identity theft
- Financial institution fraud
- Payment fraud

❌ **Copyright & IP Violation**
- Scraping copyrighted content for republication
- Circumventing DRM/DMCA protections
- Mass downloading to redistribute
- Patent evasion

❌ **Abuse & Harassment**
- Automated harassment campaigns
- Spam generation
- Doxxing assistance
- Coordinated attacks

❌ **Illegal Access**
- Unauthorized access to systems (CFAA violation)
- Credential compromise
- Malware distribution
- Data exfiltration

❌ **Market Manipulation**
- Price fixing assistance
- Artificial scarcity creation
- Coordinated bidding schemes
- Manipulation of reviews/ratings

### STRONGLY DISCOURAGED
⚠️ **Against Platform Terms of Service**
- Scraping without permission (most platforms prohibit)
- Circumventing rate limits
- Evading access controls (even if not illegal)
- Bulk data extraction
- Automation on platforms that explicitly forbid it

⚠️ **Unethical Even If Legal**
- Impersonation (fake profiles)
- Spreading misinformation
- Manipulating social systems
- Competitive intelligence via unauthorized access
- Honeypot evasion in adversarial contexts

---

## Responsibility Statements

### User Responsibilities
You are responsible for:
- Understanding applicable laws (CFAA, GDPR, CCPA, etc.)
- Respecting platform terms of service
- Obtaining written permission for testing on systems you don't own
- Reporting security vulnerabilities responsibly
- Not using this tool for illegal purposes
- Understanding your jurisdiction's specific laws

### Developer Responsibility
Basset Hound Browser is provided "as is" without warranty. We:
- Make no guarantees about evasion effectiveness
- Will not assist with illegal use
- Will not modify the tool for prohibited purposes
- Encourage responsible disclosure of vulnerabilities
- Support legitimate privacy and security research

### Liability
Users assume all risk for their use of this tool. The developers are not liable for:
- Unauthorized access to systems (CFAA violations)
- Violations of terms of service
- Fraud, theft, or other criminal activity
- Civil liability for damages
- Use outside its intended legitimate purposes

---

## Legal Considerations by Jurisdiction

### United States
- **CFAA (Computer Fraud & Abuse Act):** Unauthorized access is federal crime
  - Even if technically possible, unauthorized testing = violation
  - Exception: Systems you own/manage or explicit written authorization
  - Scraping can violate CFAA if it exceeds authorized access

- **DMCA (Digital Millennium Copyright Act):** Circumventing protection is illegal
  - Even if you own the content
  - Even if you're accessing your own data

- **Terms of Service:** Not legally binding in criminal sense
  - But violations can support CFAA charges
  - Civil liability risk

- **CAN-SPAM & TCELEC:** Spam generation is federal offense

### European Union
- **GDPR:** Personal data handling requires consent/legal basis
  - Behavioral data collection requires explicit consent
  - Right to be forgotten applies

- **ePrivacy Directive:** Cookie/tracking restrictions
  - Consent required for tracking
  - Applies even to bots

### United Kingdom
- **Computer Misuse Act:** Similar to CFAA
  - Unauthorized access = criminal offense
  - No legitimate access without authorization

---

## Responsible Disclosure

If you discover security vulnerabilities:

1. **Do Not Exploit:** Do not expand access beyond initial discovery
2. **Document Carefully:** Record steps to reproduce
3. **Notify Vendor:** Contact security team directly (security@company.com)
4. **Wait 90 Days:** Give vendor time to patch before disclosure
5. **Disclosure:** After patch, consider responsible disclosure

### Bug Bounty Programs
- Prioritize official bug bounty programs
- Follow their specific disclosure policy
- Document your authorization to test

---

## Red Flags: When NOT to Use This Tool

Do not proceed if any of these apply:

🚫 You're accessing a system you don't own without permission  
🚫 The system explicitly forbids automation/bots  
🚫 You're trying to hide what you're doing  
🚫 The intended target has legal protections (financial, government, etc.)  
🚫 You're doing this for financial gain illegally  
🚫 You're accessing personal data you shouldn't have  
🚫 You're circumventing security measures that protect others' rights  
🚫 You wouldn't do this if you had to sign a contract about it  

---

## Ethical Bot Development Principles

### Transparency
- When possible, identify your automated requests
- Use appropriate User-Agent headers
- Document your automated access

### Respect for Resources
- Limit request rates to not harm target systems
- Respect robots.txt and rate-limit headers
- Cache results to minimize requests
- Clean up after yourself

### Data Minimization
- Collect only necessary data
- Delete when no longer needed
- Aggregate instead of individual records
- Anonymize where possible

### Legal Compliance
- Obtain written permission before testing
- Understand local laws
- Follow platform ToS when possible
- Implement audit trails

---

## Questions? Get Clarity

Before using Basset Hound Browser for any automated access:

1. **Ask yourself:** Would I be willing to sign a contract saying I'm doing this?
2. **Get permission:** Do I have written authorization?
3. **Check legality:** Is this legal in my jurisdiction?
4. **Read ToS:** Does the platform explicitly allow this?
5. **Consider ethics:** Am I harming anyone?

If you answer "no" to any of these, don't proceed.

---

## Updates & Feedback

This document is version 1.0 and will be updated as practices evolve.

If you have feedback or suggestions, contact: [contact info]

---

## Acknowledgments

These guidelines are informed by:
- OWASP ethical hacking principles
- Electronic Frontier Foundation privacy standards
- Academic research ethics boards (IRB standards)
- Bug bounty community best practices
- Legal analysis from multiple jurisdictions

---

**IMPORTANT:** These guidelines are for informational purposes and do not constitute 
legal advice. Consult with a qualified attorney in your jurisdiction for legal 
concerns specific to your situation.
```

#### 4.2 Create Quick Reference Card
**File:** `docs/guides/ETHICS-QUICK-REFERENCE.md`

```markdown
# Ethics Quick Reference Card

## Legitimate Uses ✅
- Your own systems/data
- With written permission
- Legal in your jurisdiction
- Authorized security testing
- Privacy/anonymity for yourself
- Research/education with consent

## Prohibited Uses ❌
- Systems you don't own (without permission)
- Fraud, theft, financial crime
- Unauthorized access
- Circumventing DRM/protections
- Harassment, spam, abuse
- Terms of Service violations (when illegal)

## The Test
**Before you automate, ask:**
1. Do I own this system or have written permission?
2. Is this legal where I live?
3. Does the platform allow this?
4. Would I admit to doing this openly?
5. Am I harming anyone?

**If you said "no" to any question → Don't do it.**

## Red Flags 🚩
- Hiding what you're doing
- Financial motivation that's illegal
- Accessing others' personal data
- Circumventing security
- Not willing to sign a contract about it

## Get Help
- Check local laws (consult attorney)
- Get written permission from system owner
- Review platform Terms of Service
- Use official bug bounty programs
- Contact security@[domain] for vulnerabilities
```

### Testing Specifications

This is documentation only. Quality assurance involves:

```markdown
## Documentation Audit Checklist

- [ ] All prohibited uses clearly listed
- [ ] Legitimate use cases explained with examples
- [ ] Legal considerations by jurisdiction covered
- [ ] User responsibilities clearly stated
- [ ] Developer liability limitations documented
- [ ] Responsible disclosure process outlined
- [ ] Red flags clearly identified
- [ ] "Test before using" decision framework provided
- [ ] No legalese; plain language used
- [ ] Formatted for easy reading/scanning
- [ ] Links to resources provided
- [ ] Version control with update history

## Review Quality

- [ ] Reviewed by legal advisor (if available)
- [ ] Reviewed by security team
- [ ] Reviewed by ethics board (if available)
- [ ] Tested for clarity with non-technical reader
- [ ] Verified all claims are accurate
- [ ] Disclaimer included
```

### Implementation Checklist
- [ ] Create `docs/guides/EVASION-ETHICS-GUIDELINES.md`
- [ ] Create `docs/guides/ETHICS-QUICK-REFERENCE.md`
- [ ] Add links from main README
- [ ] Add links from API documentation
- [ ] Add disclaimer to tool startup message
- [ ] Include in onboarding process
- [ ] Update project footer with ethics link
- [ ] Review by legal/security team (if available)

### Success Criteria
✓ Clear definition of legitimate use cases  
✓ Explicit prohibition of illegal use  
✓ Legal considerations by jurisdiction covered  
✓ User responsibilities documented  
✓ Developer liability clarified  
✓ Easy-to-use decision framework included  
✓ Professional tone and comprehensive coverage  

---

## Fix #5: COMMAND-LEVEL ACLs (OPTIONAL - PHASE 2)

**Priority:** OPTIONAL  
**Objective:** Fine-grained access control per command or command group  
**Impact:** Advanced authorization scenarios, multi-tenant support  
**Risk Level:** MEDIUM (requires careful implementation)  
**Effort:** 4-6 hours  
**Status:** Defer to Phase 2 / v12.8.0 (if time allows)  

### Recommendation
Can implement if time allows after primary 4 fixes, or defer to v12.8.0 Phase 2. 
Provides advanced capabilities but not critical for security baseline.

**Scope:** Role-based access control (RBAC) with per-command authorization

---

## Implementation Timeline

### Day 1 (4-5 hours)
- **Morning (2h):** Fix #1 - WSS Enforcement
  - Implement requireWSS() helper
  - Add to all credential commands
  - Create 10+ tests
  
- **Afternoon (2-3h):** Fix #2 - Rate Limiting
  - Create rate-limiter.js
  - Integrate into handlers
  - Create 11+ tests

### Day 2 (4-5 hours)
- **Morning (2-3h):** Fix #3 - Monitoring Consent
  - Update WebSocket init
  - Add consent handlers
  - Create 14+ tests
  
- **Afternoon (1h):** Fix #4 - Ethics Documentation
  - Create guidelines document
  - Create quick reference
  - Add links to docs

**Total:** 8-10 hours for complete Phase 1 security fixes

---

## Testing Summary

| Fix | Test Count | Coverage |
|-----|-----------|----------|
| WSS Enforcement | 10+ | All credential commands |
| Rate Limiting | 11+ | TOTP, verify, refresh |
| Monitoring Consent | 14+ | All consent scenarios |
| Ethics Docs | N/A | Documentation audit |
| **Total** | **35+ tests** | **Complete security baseline** |

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| WSS cert missing in dev | MEDIUM | Test both WS and WSS paths |
| Rate limiting false positives | LOW | Generous limits (5/min) |
| Consent migration issues | LOW | Flag-based, backward compatible |
| Ethics guideline liability | LOW | Include legal disclaimer |

---

## Success Metrics

### Functionality
- ✓ WSS enforcement blocks 100% of unencrypted credential operations
- ✓ Rate limiting triggers at correct thresholds
- ✓ Monitoring disabled by default, consent-driven
- ✓ Ethics guidelines clear and comprehensive

### Testing
- ✓ 35+ security tests (100% pass rate)
- ✓ All command handlers tested
- ✓ Error messages validated
- ✓ Edge cases covered

### Documentation
- ✓ API reference updated
- ✓ Deployment guide updated
- ✓ Ethics guidelines published
- ✓ User guide updated

---

## Deliverables Checklist

### Code Changes
- [ ] `websocket/commands/credentials-commands.js` - WSS enforcement
- [ ] `websocket/server.js` - Server-level validation + consent
- [ ] `src/infrastructure/rate-limiter.js` - New rate limiter (NEW FILE)
- [ ] `src/monitoring/metrics-collector.js` - Consent checking

### Tests
- [ ] `tests/security/wss-enforcement.test.js` (10+ tests)
- [ ] `tests/security/rate-limiting.test.js` (11+ tests)
- [ ] `tests/security/monitoring-consent.test.js` (14+ tests)

### Documentation
- [ ] `docs/guides/EVASION-ETHICS-GUIDELINES.md` (NEW FILE)
- [ ] `docs/guides/ETHICS-QUICK-REFERENCE.md` (NEW FILE)
- [ ] `docs/API-REFERENCE.md` - Updated with new requirements
- [ ] `docs/DEPLOYMENT-GUIDE.md` - Updated with WSS setup

### Verification
- [ ] All 35+ tests passing
- [ ] No regressions on existing tests
- [ ] Security review of implementations
- [ ] Documentation review

---

## Notes for Developer Agents

1. **WSS Enforcement:** Focus on clear error messages. Users need to know to use `wss://` instead of `ws://`
2. **Rate Limiting:** TTL and cleanup are critical. Test with time-based scenarios
3. **Consent Control:** Audit logging is essential. Track grant/revoke events
4. **Ethics Docs:** Plain language is key. Non-technical users should understand
5. **Testing:** Each fix should have independent test suite for isolation

---

**Ready for implementation. Deploy in priority order (Fix #1 → #2 → #3 → #4).**
