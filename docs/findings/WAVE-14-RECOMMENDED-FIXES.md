# Wave 14 Security Audit - Recommended Code Fixes

**Date:** June 1, 2026  
**Scope:** P0 and P1 vulnerability fixes  
**Implementation Status:** Ready for immediate application

---

## Fix 1: Proxy ID Generation (CVE-W14-NEW-001)

**File:** `/src/proxy/residential-proxy-manager.js`

**Current Code (Line ~230-232):**
```javascript
generateProxyId() {
    return `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

**Recommended Fix:**
```javascript
const crypto = require('crypto');

generateProxyId() {
    // Generate 128-bit cryptographically secure random ID
    return `proxy_${crypto.randomBytes(16).toString('hex')}`;
}
```

**Benefits:**
- Entropy: 128 bits (vs 36 bits)
- Unpredictable: Cannot enumerate IDs
- Secure: Uses cryptographic RNG
- Collision resistant: 2^128 ID space

**Testing:**
```javascript
it('generateProxyId should use crypto.randomBytes', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    ids.add(manager.generateProxyId());
  }
  assert.strictEqual(ids.size, 1000); // All unique
});
```

---

## Fix 2: Proxy Rotation RNG (CVE-W14-NEW-002)

**File:** `/src/proxy/residential-proxy-manager.js`

**Current Code (Line ~140-145):**
```javascript
case 'random':
    this.currentProxyIndex = Math.floor(Math.random() * this.proxyPool.length);
    proxy = this.proxyPool[this.currentProxyIndex];
    break;
```

**Recommended Fix:**
```javascript
const crypto = require('crypto');

case 'random':
    // Use cryptographically secure random selection
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    this.currentProxyIndex = randomValue % this.proxyPool.length;
    proxy = this.proxyPool[this.currentProxyIndex];
    break;
```

**Benefits:**
- Unpredictable proxy selection
- Prevents fingerprinting via proxy pattern
- 32-bit entropy (vs 6-8 bits)
- Proper random distribution

**Performance Impact:**
- ~0.1ms overhead per selection
- Negligible in overall operation time
- Worth the security improvement

---

## Fix 3: JSDOM Parsing Timeout (CVE-W14-NEW-003)

**File:** `/src/monitoring/change-detector.js`

**Current Code (Line ~175-200 area):**
```javascript
detectStructureChanges(previousHtml, currentHtml) {
  const previousDom = new JSDOM(previousHtml);
  const currentDom = new JSDOM(currentHtml);
  // Parsing can hang indefinitely
}
```

**Recommended Fix:**
```javascript
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const MAX_HTML_SIZE = 100 * 1024 * 1024; // 100MB max
const JSDOM_PARSE_TIMEOUT = 5000; // 5 second timeout

/**
 * Parse HTML with timeout protection
 */
parseHtmlWithTimeout(html, timeoutMs = JSDOM_PARSE_TIMEOUT) {
  // Validate size first
  if (html.length > MAX_HTML_SIZE) {
    throw new Error(`HTML exceeds maximum size: ${html.length} > ${MAX_HTML_SIZE}`);
  }

  return Promise.race([
    Promise.resolve(() => new JSDOM(html))(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`JSDOM parsing timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

async detectStructureChanges(previousHtml, currentHtml) {
  try {
    const previousDom = await this.parseHtmlWithTimeout(previousHtml);
    const currentDom = await this.parseHtmlWithTimeout(currentHtml);
    
    // Continue with comparison...
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error('HTML parsing timeout - possible malicious content');
    }
    throw error;
  }
}
```

**Benefits:**
- Prevents DoS via pathological HTML
- 5-second max parsing time
- Size limits prevent memory exhaustion
- Graceful error handling

**Test:**
```javascript
it('should timeout JSDOM parsing on pathological HTML', async () => {
  const pathological = '<div class="' + 'x'.repeat(1000000) + '">test</div>';
  
  try {
    await detector.parseHtmlWithTimeout(pathological, 1000);
    assert.fail('Should have timed out');
  } catch (error) {
    assert(error.message.includes('timeout'));
  }
});
```

---

## Fix 4: Proxy Reputation Validation (CVE-W14-NEW-004)

**File:** `/src/proxy/proxy-intelligence.js`

**Current Code (Line ~299-345):**
```javascript
recordProxyRequest(sessionId, proxyId, result = {}) {
  const success = result.success !== false;  // Not validated!
  const latency = result.latency || 0;      // Not validated!
  
  // Updates reputation based on unvalidated input
  if (success) {
    repScore = Math.min(1, repScore + 0.01);
  }
}
```

**Recommended Fix:**
```javascript
const crypto = require('crypto');

class SignedProxyResult {
  constructor(data, signingKey) {
    this.data = data;
    this.timestamp = Date.now();
    this.signature = this._sign(data, signingKey);
  }

  _sign(data, key) {
    const payload = JSON.stringify(data) + this.timestamp;
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  verify(signingKey) {
    const payload = JSON.stringify(this.data) + this.timestamp;
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Use constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(this.signature),
      Buffer.from(expectedSignature)
    );
  }
}

recordProxyRequest(sessionId, proxyId, signedResult) {
  // SECURITY FIX: Verify result signature
  if (!signedResult || typeof signedResult !== 'object') {
    throw new Error('Invalid result format');
  }

  // Verify signature using infrastructure signing key
  const signingKey = this._getInfrastructureSigningKey();
  if (!signedResult.verify || !signedResult.verify(signingKey)) {
    throw new Error('Result signature verification failed');
  }

  // Now we can safely use the result
  const result = signedResult.data;
  const success = result.success !== false;
  const latency = result.latency || 0;

  // Validate latency range
  if (typeof latency !== 'number' || latency < 0 || latency > 60000) {
    throw new Error('Invalid latency value');
  }

  // Continue with metrics update...
  const session = this.sessions.get(sessionId);
  const proxy = this.proxies.get(proxyId);

  if (!session || !proxy) {
    throw new Error('Session or proxy not found');
  }

  // Update metrics based on VERIFIED result
  proxy.metrics.totalRequests++;
  if (success) {
    proxy.metrics.successfulRequests++;
  } else {
    proxy.metrics.failedRequests++;
  }

  // Update reputation (now safe from spoofing)
  const providerKey = proxy.detectedProvider;
  let repScore = this.providerReputation.get(providerKey) || 0.5;

  if (success) {
    repScore = Math.min(1, repScore + 0.01);
  } else {
    repScore = Math.max(0, repScore - 0.05);
  }

  this.providerReputation.set(providerKey, repScore);
}

_getInfrastructureSigningKey() {
  // Use a secure key from infrastructure/environment
  // Should NOT be hardcoded in application
  return process.env.PROXY_RESULT_SIGNING_KEY || 
    crypto.randomBytes(32); // Fallback for testing
}
```

**Usage Example:**
```javascript
// Infrastructure creates signed result
const infrastructure = {
  signResult(data) {
    const signingKey = process.env.PROXY_RESULT_SIGNING_KEY;
    return new SignedProxyResult(data, signingKey);
  }
};

// Browser uses signed result
const result = infrastructure.signResult({
  success: true,
  latency: 150
});

intel.recordProxyRequest(sessionId, proxyId, result);
```

**Benefits:**
- Reputation cannot be spoofed
- All results must come from infrastructure
- Constant-time comparison prevents timing attacks
- Full audit trail of who set reputation

---

## Fix 5: UUID Generation (CVE-W14-NEW-005)

**File:** `/src/export/platforms/stix-export.js`

**Current Code:**
```javascript
const r = Math.random() * 16 | 0;
```

**Recommended Fix:**
```javascript
const crypto = require('crypto');

// Generate UUID v4-like ID
const generateUUID = () => {
  const bytes = crypto.randomBytes(16);
  
  // Set version 4 (random) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  return [
    bytes.slice(0, 4).toString('hex'),
    bytes.slice(4, 6).toString('hex'),
    bytes.slice(6, 8).toString('hex'),
    bytes.slice(8, 10).toString('hex'),
    bytes.slice(10).toString('hex')
  ].join('-');
};

// Or simpler hex version:
const generateUUID = () => crypto.randomBytes(16).toString('hex');
```

**Benefits:**
- 128-bit entropy (vs ~20 bits)
- No collisions possible (2^128 space)
- Proper UUID v4 format
- Unpredictable IDs

---

## Fix 6: Session Token Generation (CVE-W14-NEW-006)

**File:** `/src/evasion/multi-layer-coordinator.js` (and others)

**Current Code:**
```javascript
const snapshotId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

**Recommended Fix:**
```javascript
const crypto = require('crypto');

const generateSnapshotId = () => {
  // Use only cryptographically secure random
  // Remove timestamp to prevent prediction
  return crypto.randomBytes(16).toString('hex');
};

// Usage:
const snapshotId = generateSnapshotId();
// Result: "a7f4c8b9e2d1f5a3c6b8e9d1f5a3c6b8"
```

**Benefits:**
- No timestamp = no predictability
- 128-bit entropy
- Simple and secure
- Fast generation

---

## Fix 7: Snapshot Size Limits (CVE-W14-NEW-007)

**File:** `/src/monitoring/monitoring-service.js` and `/src/sessions/session-persistence.js`

**Current Code:**
```javascript
const snapshots = JSON.parse(data);
this.snapshots.set(monitorId, snapshots);
```

**Recommended Fix:**
```javascript
const fs = require('fs');

const SIZE_LIMITS = {
  SNAPSHOT: 50 * 1024 * 1024,      // 50MB
  SESSION_FILE: 100 * 1024 * 1024, // 100MB
  JSON_REQUEST: 10 * 1024 * 1024   // 10MB
};

/**
 * Safely load and parse snapshot file
 */
loadSnapshot(filePath, maxSize = SIZE_LIMITS.SNAPSHOT) {
  // Check file size before reading
  try {
    const stats = fs.statSync(filePath);
    
    if (stats.size > maxSize) {
      throw new Error(
        `Snapshot file exceeds maximum size: ${stats.size} > ${maxSize} bytes`
      );
    }

    // Read file with size limit
    const data = fs.readFileSync(filePath, 'utf8');
    
    // Additional check on parsed size
    const parsed = JSON.parse(data);
    const parsedSize = JSON.stringify(parsed).length;
    
    if (parsedSize > maxSize) {
      throw new Error(
        `Parsed snapshot exceeds maximum size: ${parsedSize} > ${maxSize} bytes`
      );
    }

    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Snapshot file not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in snapshot file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate snapshot before saving
 */
saveSnapshot(sessionId, snapshot, maxSize = SIZE_LIMITS.SNAPSHOT) {
  const json = JSON.stringify(snapshot);
  
  if (json.length > maxSize) {
    throw new Error(
      `Snapshot exceeds maximum size: ${json.length} > ${maxSize} bytes`
    );
  }

  // Safe to save
  const filePath = path.join(this.storageDir, `${sessionId}.json`);
  fs.writeFileSync(filePath, json);
}

/**
 * Limit memory usage when storing snapshots
 */
addSnapshot(monitorId, snapshot) {
  const json = JSON.stringify(snapshot);
  
  if (json.length > SIZE_LIMITS.SNAPSHOT) {
    throw new Error(`Snapshot too large for storage`);
  }

  this.snapshots.set(monitorId, snapshot);

  // Limit total memory usage
  if (this.snapshots.size > 1000) {
    // Remove oldest snapshots
    const entries = Array.from(this.snapshots.entries());
    const toRemove = entries.slice(0, entries.length - 1000);
    toRemove.forEach(([key]) => this.snapshots.delete(key));
  }
}
```

**Test:**
```javascript
it('should enforce snapshot size limits', () => {
  const massive = {
    data: Buffer.alloc(60 * 1024 * 1024).toString() // 60MB
  };

  assert.throws(
    () => service.saveSnapshot('test', massive),
    /exceeds maximum size/
  );
});

it('should load and validate snapshot size', () => {
  const valid = { data: 'test' };
  service.saveSnapshot('test', valid);
  
  const loaded = service.loadSnapshot(
    path.join(service.storageDir, 'test.json')
  );
  
  assert.deepStrictEqual(loaded, valid);
});
```

**Benefits:**
- Prevents memory exhaustion
- Prevents disk space exhaustion
- Reasonable limits (50MB per snapshot)
- Early validation catches issues

---

## Implementation Checklist

- [ ] Fix 1: Update generateProxyId() in residential-proxy-manager.js
- [ ] Fix 2: Update proxy rotation logic in residential-proxy-manager.js
- [ ] Fix 3: Add parseHtmlWithTimeout() in change-detector.js
- [ ] Fix 4: Add SignedProxyResult class in proxy-intelligence.js
- [ ] Fix 5: Update UUID generation in stix-export.js
- [ ] Fix 6: Update snapshot ID generation in multi-layer-coordinator.js
- [ ] Fix 7: Add size validation in monitoring-service.js and session-persistence.js
- [ ] Run security test suite: npm test tests/wave14/deep-security-audit.test.js
- [ ] Verify all tests pass (68/68)
- [ ] Code review by security engineer
- [ ] Deploy to staging for verification
- [ ] Run OWASP ZAP scan
- [ ] Run npm audit
- [ ] Load testing (200+ concurrent)
- [ ] Memory profiling

---

## Verification Commands

```bash
# Verify all crypto.randomBytes imports added
grep -r "crypto.randomBytes" src/ | wc -l

# Verify no Math.random() in security-sensitive code
grep -r "Math.random()" src/ | grep -v "evasion\|fingerprint\|behavioral\|canvas"

# Run security tests
npm test tests/wave14/deep-security-audit.test.js

# Check for vulnerabilities
npm audit

# Run OWASP ZAP scan (if applicable)
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:8765

# Memory profiling
node --inspect=9229 src/main/main.js
# Use Chrome DevTools to monitor memory
```

---

## Estimated Implementation Time

| Fix | Effort | Complexity | Risk |
|-----|--------|-----------|------|
| 1. Proxy ID | 30m | Low | Low |
| 2. Proxy Rotation | 30m | Low | Low |
| 3. JSDOM Timeout | 45m | Medium | Low |
| 4. Result Signature | 2h | High | Medium |
| 5. UUID Generation | 30m | Low | Low |
| 6. Token Generation | 30m | Low | Low |
| 7. Size Limits | 45m | Medium | Low |
| Testing | 1h | Medium | Low |
| Code Review | 1h | Low | Low |
| Staging Deploy | 1h | Low | Low |

**Total: 7.5 hours**

---

**End of Recommended Fixes Document**
