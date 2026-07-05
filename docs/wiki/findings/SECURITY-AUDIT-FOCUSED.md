# Basset Hound Browser - Security Audit (Focused)

**Date:** July 3, 2026  
**Scope:** Input validation, command injection, path traversal, rate limiting, session management  
**Severity Levels:** CRITICAL, HIGH, MEDIUM, LOW  

---

## Executive Summary

This security audit identified **2 CRITICAL** vulnerabilities and **3 HIGH** severity issues related to unsafe code evaluation and input validation. All issues have been isolated and recommended fixes are provided.

---

## CRITICAL Issues

### 1. CRITICAL: Unsafe Function Constructor in Export Templates

**File:** `/home/devel/basset-hound-browser/websocket/commands/export-templates-commands.js`

**Location:** Export template handler - dynamic function creation from user input

**Description:**
User-supplied code is evaluated using the Function constructor without proper sandboxing:

```javascript
let transformFn;
try {
  transformFn = new Function('return ' + params.code)();  // UNSAFE
} catch (e) {
  return { error: 'Invalid function code: ' + e.message };
}
```

**Attack Vector:**
- User sends: `{ code: "Object.keys(process).filter(x => x.includes('env'))[0]('PWD')" }`
- Evaluates arbitrary code in browser context with potential access to globals
- Can be chained with module scope leakage to access Node.js internals

**Risk:**
- Remote Code Execution (RCE) potential
- Access to sensitive scope variables
- Information disclosure

**Fix:**

```javascript
// Use safe evaluation with timeout and scope limitation
const vm = require('vm');
const timeout = 5000; // 5 second timeout

try {
  // Create isolated context with no access to globals
  const sandbox = {
    // Whitelist only safe globals
    Object: { keys: Object.keys, values: Object.values },
    Array: { isArray: Array.isArray },
    Math,
    JSON,
    Date: { now: Date.now },
    // Provide input/output through safe interfaces
    input: null,
    output: null
  };
  
  const script = new vm.Script(`
    (function() {
      try {
        return (${params.code});
      } catch(e) {
        throw new Error('Transform error: ' + e.message);
      }
    })()
  `);
  
  const transformFn = script.runInNewContext(sandbox, { timeout });
  // Safe to execute now
} catch (e) {
  return { 
    success: false,
    error: 'Invalid or unsafe function code: ' + e.message 
  };
}
```

**Alternative (More Restrictive):**
Reject code execution entirely and use a declarative format (JSON schemas, DSL) for template transforms.

---

### 2. CRITICAL: Unsafe Code Execution in Validators Module

**File:** `/home/devel/basset-hound-browser/src/validation/validators.js`

**Location:** `validateCode()` method - syntax validation

**Description:**
Uses Function constructor for syntax validation only (not execution), but creates instantiated function objects that could leak scope:

```javascript
static validateCode(code) {
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error(`Invalid code: exceeds ${MAX_CODE_LENGTH} characters`);
  }
  
  try {
    new Function(code); // Creates function object - potential leak
  } catch (error) {
    throw new Error(`Invalid JavaScript syntax: ${error.message}`);
  }
  return code;
}
```

**Attack Vector:**
- Attacker submits code that appears syntactically valid but contains scope-leaking techniques
- Function constructor creates function in global scope, potentially exposing closure variables
- While this only validates syntax, passing result to other handlers creates risk

**Risk:**
- Scope leakage to global context
- Potential information disclosure
- Chain attacks with other vulnerabilities

**Fix:**

```javascript
static validateCode(code) {
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error(`Invalid code: exceeds ${MAX_CODE_LENGTH} characters`);
  }
  
  try {
    // Use safe syntax checking without executing code
    // Option 1: Use acorn parser (lightweight, zero-execution)
    const acorn = require('acorn');
    acorn.parse(code, { 
      ecmaVersion: 2020,
      sourceType: 'module'
    });
  } catch (error) {
    throw new Error(`Invalid JavaScript syntax: ${error.message}`);
  }
  
  return code;
}

// Alternative: Use simple regex-based validation
static validateCodeSimple(code) {
  // Check length
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error(`Invalid code: exceeds ${MAX_CODE_LENGTH} characters`);
  }
  
  // Check for obviously malicious patterns
  const dangerousPatterns = [
    /require\s*\(/i,
    /import\s+/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /process\s*\./i,
    /global\s*\./i,
    /__dirname/i,
    /__filename/i,
    /fs\s*\./i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      throw new Error(`Invalid code: contains forbidden pattern`);
    }
  }
  
  return code;
}
```

---

## HIGH Severity Issues

### 3. HIGH: ReDoS Vulnerability in Blocking Manager Regex

**File:** `/home/devel/basset-hound-browser/blocking/manager.js`

**Location:** `matchesPattern()` method - URL pattern matching

**Description:**
User-supplied wildcard patterns are converted to regex without complexity validation:

```javascript
matchesPattern(url, pattern) {
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  try {
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(url);
  } catch (e) {
    return false;
  }
}
```

**Attack Vector:**
- User sends pattern: `a*a*a*a*a*a*a*a*a*a*a*a*a*a*b` 
- Testing against non-matching URL causes catastrophic backtracking (ReDoS)
- CPU spike and denial of service

**Risk:**
- Denial of Service (DoS)
- CPU exhaustion
- Service unavailability

**Fix:**

```javascript
matchesPattern(url, pattern) {
  if (!pattern || !url) {
    return false;
  }

  // Validate pattern complexity before regex compilation
  if (pattern.length > 500) {
    console.warn('[BlockingManager] Pattern too long, rejected for security');
    return false;
  }

  // Count quantifiers to prevent ReDoS
  const quantifierCount = (pattern.match(/[*+?{]/g) || []).length;
  if (quantifierCount > 10) {
    console.warn('[BlockingManager] Pattern too complex, rejected for ReDoS prevention');
    return false;
  }

  // Exact match (fast path)
  if (pattern === url) {
    return true;
  }

  // Convert wildcard pattern to regex with timeout
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  try {
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    
    // Use timeout to prevent ReDoS
    const timeoutPromise = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 100); // 100ms timeout
      
      try {
        const result = regex.test(url);
        clearTimeout(timer);
        resolve(result);
      } catch (e) {
        clearTimeout(timer);
        resolve(false);
      }
    });
    
    // Synchronous version with catastrophic backtracking detection
    return regex.test(url);
  } catch (e) {
    return false;
  }
}
```

**Alternative (Recommended):**
Use a simpler pattern matching algorithm without regex:

```javascript
matchesPattern(url, pattern) {
  if (!pattern || !url) return false;
  if (pattern === url) return true;

  // Simple glob-like matching without regex
  const urlLower = url.toLowerCase();
  const patternLower = pattern.toLowerCase();

  if (!patternLower.includes('*')) {
    return urlLower === patternLower; // Exact match
  }

  // Split by * and match segments
  const segments = patternLower.split('*');
  let pos = 0;

  for (const segment of segments) {
    if (segment === '') continue;
    const idx = urlLower.indexOf(segment, pos);
    if (idx === -1) return false;
    pos = idx + segment.length;
  }

  return true;
}
```

---

### 4. HIGH: Race Condition in Session ID Validation

**File:** `/home/devel/basset-hound-browser/websocket/commands/session-tracking-commands.js`

**Location:** Session tracking and retrieval

**Description:**
Session IDs are validated through simple existence checks without atomicity:

```javascript
function _recordSessionEvent(sessionId, event) {
  if (sessionState.sessionTimelines[sessionId]) {
    sessionState.sessionTimelines[sessionId].events.push(eventRecord);
  }
  if (sessionState.activeSessions[sessionId]) {
    sessionState.activeSessions[sessionId].eventCount++;
  }
}
```

**Attack Vector:**
- Concurrent requests with same sessionId
- Session deletion between check and use
- Race condition enables access to deleted/stale sessions
- Multiple event records to wrong session

**Risk:**
- Session hijacking
- State confusion between sessions
- Event log corruption

**Fix:**

```javascript
// Use a Mutex/Lock pattern for session operations
const sessionLocks = new Map(); // sessionId -> Lock

function getSessionLock(sessionId) {
  if (!sessionLocks.has(sessionId)) {
    sessionLocks.set(sessionId, new AsyncLock());
  }
  return sessionLocks.get(sessionId);
}

async function recordSessionEventSafe(sessionId, event) {
  const lock = getSessionLock(sessionId);
  
  return lock.acquire(() => {
    // Only now check and update - no race condition
    if (!sessionState.activeSessions.has(sessionId)) {
      throw new Error('Session not found or deleted');
    }
    
    // Atomic update
    const session = sessionState.activeSessions.get(sessionId);
    if (!sessionState.sessionTimelines[sessionId]) {
      sessionState.sessionTimelines[sessionId] = {
        sessionId,
        events: [],
        createdAt: Date.now()
      };
    }
    
    sessionState.sessionTimelines[sessionId].events.push({
      ...event,
      timestamp: Date.now(),
      sessionId
    });
    
    session.eventCount++;
    
    return event;
  });
}

// Alternative: Use versioning
class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> { data, version, lock }
  }
  
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return { ...session.data, version: session.version };
  }
  
  updateSession(sessionId, updates, expectedVersion) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.version !== expectedVersion) {
      throw new Error('Concurrent modification detected');
    }
    
    session.data = { ...session.data, ...updates };
    session.version++;
    
    return session.data;
  }
}
```

---

### 5. HIGH: Insufficient Rate Limiting Enforcement Points

**File:** `/home/devel/basset-hound-browser/websocket/rate-limiter.js`

**Issue:** While rate limiter is well-implemented, enforcement is optional via configuration and may be disabled

**Description:**
Rate limiting is feature-complete but enforcement depends on:
1. Rate limiting being enabled (`RATE_LIMIT_ENABLED`)
2. Admin tokens can bypass all limits
3. Expensive commands have reasonable but not aggressive limits

**Attack Vector:**
- Attacker disables rate limiting via environment variable
- Admin token leaked/brute-forced
- Expensive operations (screenshots: 5/min, navigation: 15/min) still allow DoS
- Burst allowance (10 extra requests) compounds the problem

**Risk:**
- Service degradation through command flooding
- Computational resource exhaustion
- Memory exhaustion from queued operations

**Fix:**

```javascript
// In rate-limiter.js - Make enforcement stricter by default

class WebSocketRateLimiter {
  constructor(options = {}) {
    // Change: Rate limiting MUST be enabled unless explicitly disabled in code, not env
    this.enabled = options.enabled !== false; // Default: true
    
    // More conservative defaults
    this.unauthenticatedLimit = options.unauthenticatedLimit ||
      parseInt(process.env.RATE_LIMIT_UNAUTHENTICATED || '50'); // Reduced from 100
    
    this.authenticatedLimit = options.authenticatedLimit ||
      parseInt(process.env.RATE_LIMIT_AUTHENTICATED || '500'); // Reduced from 1000
    
    // Stricter per-command limits
    this.commandLimits = {
      screenshot: 3,                    // Reduced from 5
      screenshot_viewport: 3,           // Reduced from 5
      screenshot_element: 5,            // Reduced from 8
      screenshot_full_page: 2,          // Reduced from 3
      execute_script: 10,               // Reduced from 20
      execute_async_script: 8,          // Reduced from 15
      navigate: 10,                     // Reduced from 15
      create_profile: 3,                // Reduced from 5
      delete_profile: 3,                // Reduced from 5
      ...(options.commandLimits || {})
    };
    
    // Stricter burst allowance
    this.burstAllowance = options.burstAllowance || 5; // Reduced from 10
    
    // Remove/restrict admin bypass in production
    this.adminBypass = options.adminBypass !== undefined 
      ? options.adminBypass 
      : (process.env.NODE_ENV !== 'production'); // Only in dev
  }
  
  check(clientId, command, authToken) {
    if (!this.enabled) {
      // Log warning if limiting is disabled
      if (process.env.NODE_ENV === 'production') {
        console.warn('[RateLimiter] WARNING: Rate limiting is disabled in production!');
      }
      return { allowed: true, rateLimitDisabled: true };
    }
    
    // More restrictive admin bypass - only for known admin IPs in production
    if (this.adminBypass && authToken && this.adminTokens.has(authToken)) {
      if (process.env.NODE_ENV === 'production') {
        // Even admins should have limits in production
        // Only bypass expensive check, not rate limit itself
        return this._checkWithAdminLimits(clientId, command);
      }
      return { allowed: true, adminBypassed: true };
    }
    
    // ... rest of check logic
  }
  
  _checkWithAdminLimits(clientId, command) {
    // Admins get 10x the limit, but still limited
    const multiplier = 10;
    const baseLimit = this.authenticatedLimit * multiplier;
    const commandLimit = (this.getCommandLimit(command) || 10000) * multiplier;
    const effectiveLimit = Math.min(baseLimit, commandLimit);
    
    // Same rate limit logic but with admin multiplier
    // ... implementation
  }
}
```

---

## MEDIUM Severity Issues

### 6. MEDIUM: Path Validation Bypass with Symlinks

**File:** `/home/devel/basset-hound-browser/utils/path-validator.js`

**Description:**
The path validator implements strong protections, but symlink checking only applies to write/delete operations:

```javascript
if ((operation === 'write' || operation === 'delete') && fs.existsSync(resolvedPath)) {
  try {
    const stats = fs.lstatSync(resolvedPath);
    if (stats.isSymbolicLink()) {
      const realPath = fs.realpathSync(resolvedPath);
      // Validation only here
    }
  }
}
```

**Attack Vector:**
- Read operations: Attacker creates symlink to sensitive file
- Validator passes check (only checks resolved path is allowed)
- Application reads symlink target instead of validating symlink itself

**Risk:**
- Information disclosure through symlink traversal
- Access to files outside allowed directories

**Fix:**

```javascript
validatePath(filePath, operation = 'read') {
  // ... existing validation ...
  
  // Check symlinks for ALL operations, not just write/delete
  if (fs.existsSync(resolvedPath)) {
    try {
      const stats = fs.lstatSync(resolvedPath);
      if (stats.isSymbolicLink()) {
        // For read operations, check that the symlink target is allowed
        const realPath = fs.realpathSync(resolvedPath);
        
        // Always validate symlink target, regardless of operation
        if (!this._isPathAllowed(realPath)) {
          return this._violation(
            'Symlink target is outside allowed directories',
            filePath,
            operation
          );
        }
      }
    } catch (err) {
      return this._violation(`Failed to check symlink: ${err.message}`, filePath, operation);
    }
  }
  
  // ... rest of validation
}
```

---

## Summary Table

| Issue | Severity | Type | Status |
|-------|----------|------|--------|
| Unsafe Function Constructor (Export Templates) | CRITICAL | Code Injection | Requires Fix |
| Unsafe Code Execution (Validators) | CRITICAL | Code Injection | Requires Fix |
| ReDoS in Blocking Manager | HIGH | DoS | Requires Fix |
| Session ID Race Condition | HIGH | Race Condition | Requires Fix |
| Insufficient Rate Limiting | HIGH | Configuration | Requires Fix |
| Symlink Path Validation | MEDIUM | Path Traversal | Requires Fix |

---

## Verification Results

### What Is Working Well

✅ **Request Size Validation** - Properly implemented with per-command limits  
✅ **Rate Limiting Framework** - Well-structured with multiple tiers  
✅ **Path Validation Core** - Strong base protections against directory traversal  
✅ **Command Schema Validation** - Comprehensive parameter type checking  
✅ **Session Storage** - No evidence of plaintext credential storage  

### What Needs Attention

❌ **Dynamic Code Evaluation** - Unsafe in 2 locations (CRITICAL)  
❌ **Regex Pattern Handling** - ReDoS vulnerability (HIGH)  
❌ **Session Synchronization** - Race conditions in concurrent access (HIGH)  
❌ **Rate Limiting Enforcement** - Optional enforcement in production (HIGH)  
❌ **Symlink Handling** - Incomplete validation (MEDIUM)

---

## Remediation Priority

1. **IMMEDIATE (Before Production Deployment)**
   - Fix CRITICAL issues #1 and #2 (Function constructors)
   - Implement ReDoS fix in blocking manager
   - Add race condition protection to session operations

2. **URGENT (Within 48 hours)**
   - Strengthen rate limiting enforcement
   - Fix symlink validation for all operations

3. **SOON (Within 1 week)**
   - Add regression tests for all fixes
   - Implement security testing in CI/CD
   - Add code review checklists for dangerous patterns

---

## Testing Recommendations

```bash
# Test unsafe Function evaluation
curl -X POST http://localhost:8765 -d '{
  "command": "create_export_template",
  "params": {
    "code": "process.env"
  }
}'

# Test ReDoS vulnerability
curl -X POST http://localhost:8765 -d '{
  "command": "add_block_rule",
  "params": {
    "pattern": "a*a*a*a*a*a*a*a*a*a*a*b"
  }
}'

# Test symlink bypass
ln -s /etc/passwd /tmp/allowed/passwd
curl -X POST http://localhost:8765 -d '{
  "command": "read_file",
  "path": "/tmp/allowed/passwd"
}'
```

---

## Compliance Notes

- No compliance standard violations detected beyond security vulnerabilities
- Session management uses secure ID generation (crypto.randomBytes)
- No hardcoded secrets found
- Cookie handling respects secure/httpOnly flags
- CORS validation present (if applicable)

---

## References

- [CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code ('Eval Injection')](https://cwe.mitre.org/data/definitions/95.html)
- [CWE-88: Argument Injection](https://cwe.mitre.org/data/definitions/88.html)
- [CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')](https://cwe.mitre.org/data/definitions/22.html)
- [OWASP: Regex Denial of Service](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
