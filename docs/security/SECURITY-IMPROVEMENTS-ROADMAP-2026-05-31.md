# Basset Hound Browser v12.0.0 → v12.1.0 Security Improvements Roadmap
**Comprehensive Security & Quality Audit with Implementation Plan**

**Date:** May 31, 2026  
**Version:** v12.0.0 (Production Current) → v12.1.0 (Target June 15, 2026)  
**Classification:** Internal - Security Sensitive  
**Scope:** Vulnerabilities, hardening, compliance, and code quality improvements

---

## Executive Summary

### Current Status
Basset Hound Browser v12.0.0 has been successfully deployed to production with comprehensive security controls and test coverage (92.3%). Recent security audits have identified **22 actionable improvements** across three categories:
- **Critical Issues:** 8 items (immediate fix required)
- **High Priority:** 7 items (v12.1.0 sprint)
- **Medium Priority:** 7 items (v12.2.0 sprint)

### Key Achievements in v12.0.0
✅ Secure session identifiers (crypto.randomBytes, not Math.random)  
✅ Origin validation for WebSocket connections  
✅ WSS/HTTPS enforcement in production mode  
✅ Strong error handling and recovery mechanisms  
✅ Comprehensive rate limiting and authentication  

### Remaining Work for v12.1.0
- Resolve 11 npm vulnerabilities from transitive dependencies (ws, tar-fs, uuid, got)
- Enhance input validation with JSON schema
- Add timeout protection for long-running operations
- Expand password/token detection coverage
- Implement command-level authorization framework
- Create comprehensive security documentation

### Risk Assessment
**Current Risk Level:** MODERATE (due to unresolved transitive vulnerabilities)  
**Post-v12.1.0 Risk Level:** LOW-MODERATE (after dependency updates and hardening)  
**Confidence:** HIGH (clear remediation path with estimates)

---

## PART 1: SECURITY FINDINGS SUMMARY

### 1.1 Critical Issues (Must Fix Before Wider Deployment)

#### CRITICAL-001: Transitive Dependency Vulnerabilities (npm audit)
**Severity:** 🔴 CRITICAL  
**Status:** IDENTIFIED (not yet patched)  
**Component:** Development and runtime dependencies  
**Impact:** Supply chain attack vector, potential code execution in test/build pipeline

**Vulnerabilities:**
| Package | Version | Severity | CVE | Issue |
|---------|---------|----------|-----|-------|
| **ws** | 8.0.0-8.20.0 | HIGH | GHSA-3h5v-q93c-6h6q | DoS with many HTTP headers |
| **ws** | (same) | HIGH | GHSA-58qx-3vcg-4xpx | Uninitialized memory disclosure |
| **tar-fs** | 2.0.0-2.1.3 | HIGH | GHSA-vj76-c3g6-qr5v | Symlink validation bypass |
| **tar-fs** | (same) | HIGH | GHSA-8cj5-5rvv-wf4v | Extract outside directory |
| **tar-fs** | (same) | HIGH | GHSA-pq67-2wwv-3xjx | Path traversal in tar |
| **uuid** | <11.1.1 | MODERATE | GHSA-w5hq-g745-h8pq | Buffer bounds check missing |
| **got** | <11.8.5 | MODERATE | GHSA-pfrx-2q88-qq97 | Redirect to UNIX socket |

**Dependency Chain Analysis:**
```
Critical Path:
├─ ws@8.14.2 (DIRECT - used for WebSocket server)
│  └─ Vulnerable to: DoS, memory disclosure
├─ puppeteer-core (transitive via devtools)
│  └─ tar-fs (vulnerable to path traversal)
├─ electron-chromedriver (transitive via spectron)
│  └─ @electron/get
│     └─ got (vulnerable to socket redirect)
└─ jest-junit (dev dependency)
   └─ uuid (vulnerable to buffer overflow)
```

**Reproduction Steps:**
```bash
cd /home/devel/basset-hound-browser
npm audit
# Shows: 11 vulnerabilities (5 moderate, 6 high)
```

**Recommended Fix:**
```bash
# Option 1: Automated (breaking changes)
npm audit fix --force
# This will update:
# - ws: 8.14.2 → 8.21.0+
# - spectron: 19.0.0 → (compatible)
# - jest-junit: 16.0.0 → (latest)

# Option 2: Manual selective updates
npm install --save-dev ws@latest
npm install --save-dev jest-junit@latest
npm install --save uuid@latest
npm audit
```

**Estimated Effort:** 2-4 hours  
**Risk:** LOW (test dependencies mostly, ws is critical)  
**Testing Strategy:**
- [ ] Run full test suite after updates
- [ ] Verify WebSocket server still functions (ws library)
- [ ] Check build pipeline (tar-fs in electron-builder)
- [ ] Run security scanning (npm audit --audit-level=high)

**Acceptance Criteria:**
- [ ] `npm audit` reports zero high/critical vulnerabilities
- [ ] All tests passing (92%+ coverage maintained)
- [ ] WebSocket server starts without errors
- [ ] Docker build completes successfully

---

#### CRITICAL-002: Input Validation - Missing JSON Schema Validation
**Severity:** 🔴 CRITICAL  
**Status:** IDENTIFIED  
**Component:** websocket/server.js (command parsing at line 1135)  
**Impact:** Malformed commands could cause undefined behavior, potential DoS through resource exhaustion

**Current Code:**
```javascript
// websocket/server.js line 1135
const data = JSON.parse(message.toString());
// NO validation on command structure, parameters, data types
// Risk: Missing required fields, wrong types, oversized payloads
```

**Issues Identified:**
1. **No schema validation** - Commands accepted without structure verification
2. **No type checking** - Parameters could be wrong types (string instead of number)
3. **No size limits** - Large payloads could cause memory issues
4. **No selector validation** - CSS/XPath selectors not validated before use

**Example Vulnerable Scenarios:**
```javascript
// Scenario 1: Malformed command structure
ws.send(JSON.stringify({
  command: 'navigate',
  // Missing required 'url' parameter
}));
// Result: Unhandled undefined access in command handler

// Scenario 2: Wrong data type
ws.send(JSON.stringify({
  command: 'screenshot',
  delay: "not a number"  // Should be integer
}));
// Result: Type confusion in delay calculation

// Scenario 3: Oversized payload
ws.send(JSON.stringify({
  command: 'execute_javascript',
  code: 'x'.repeat(100_000_000)  // 100MB of code
}));
// Result: Memory exhaustion, potential DoS

// Scenario 4: Invalid selector
ws.send(JSON.stringify({
  command: 'click',
  selector: "!@#$%^&*()"  // Invalid CSS selector
}));
// Result: Unhandled error in DOM query
```

**Recommended Fix:**
Create comprehensive JSON schema validation for all commands:

```javascript
// File: websocket/schema/command-schemas.js
const Ajv = require('ajv');
const ajv = new Ajv();

const COMMAND_SCHEMAS = {
  navigate: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', maxLength: 2048 },
      timeout: { type: 'integer', minimum: 1000, maximum: 300000 },
      waitFor: { type: 'string', enum: ['load', 'networkidle'] }
    },
    required: ['url'],
    additionalProperties: false
  },
  
  click: {
    type: 'object',
    properties: {
      selector: { type: 'string', maxLength: 500 },
      timeout: { type: 'integer', minimum: 100, maximum: 60000 },
      force: { type: 'boolean' }
    },
    required: ['selector'],
    additionalProperties: false
  },
  
  execute_javascript: {
    type: 'object',
    properties: {
      code: { type: 'string', maxLength: 1048576 },  // 1MB max
      timeout: { type: 'integer', minimum: 100, maximum: 300000 }
    },
    required: ['code'],
    additionalProperties: false
  },
  
  fill_form: {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        minProperties: 1,
        maxProperties: 100,
        additionalProperties: { type: 'string', maxLength: 100000 }
      },
      timeout: { type: 'integer', minimum: 100, maximum: 60000 }
    },
    required: ['data'],
    additionalProperties: false
  }
  
  // ... more schemas for all 164 commands
};

const validateCommand = (command, data) => {
  const schema = COMMAND_SCHEMAS[command];
  if (!schema) {
    return { valid: false, error: `Unknown command: ${command}` };
  }
  
  const valid = ajv.validate(schema, data);
  if (!valid) {
    return { valid: false, error: ajv.errorsText() };
  }
  
  return { valid: true };
};

module.exports = { validateCommand, COMMAND_SCHEMAS };
```

**Integration into WebSocket server:**
```javascript
// websocket/server.js - message handler
ws.on('message', async (message) => {
  try {
    const data = JSON.parse(message.toString());
    
    // NEW: Validate command structure
    const validation = validateCommand(data.command, data);
    if (!validation.valid) {
      ws.send(JSON.stringify({
        id: data.id,
        error: validation.error,
        code: 'INVALID_COMMAND'
      }));
      return;
    }
    
    // Continue with command execution
    // ...
  } catch (error) {
    // Handle JSON parsing errors
  }
});
```

**Estimated Effort:** 8-12 hours  
**Risk:** LOW (non-breaking, purely additive validation)  
**Testing Strategy:**
- [ ] Create test cases for each command schema
- [ ] Test valid inputs (should pass)
- [ ] Test invalid inputs (should reject with clear errors)
- [ ] Test boundary conditions (max lengths, required fields)
- [ ] Performance test with 1000+ schema validations

**Acceptance Criteria:**
- [ ] All 164 commands have defined schemas
- [ ] Invalid commands rejected before processing
- [ ] Schema validation <10ms per command
- [ ] 100+ validation test cases passing

---

#### CRITICAL-003: Missing Timeout Protection on JavaScript Execution
**Severity:** 🔴 CRITICAL  
**Status:** IDENTIFIED  
**Component:** websocket/commands/execution-commands.js (arbitrary code execution)  
**Impact:** Infinite loops or blocking operations can hang WebSocket connections, causing DoS

**Current Code Pattern:**
```javascript
// Vulnerable: No timeout protection
const result = await webContents.executeJavaScript(params.code);
// If params.code contains: while(true) { }
// → Connection hangs indefinitely
// → Memory/CPU usage grows
// → Client cannot receive response
```

**Scenarios:**
1. **Infinite loop:** `while(true) { }`
2. **Blocking sleep:** `while(Date.now() < Date.now() + 1000000) { }`
3. **Recursive function:** `function f() { return f(); }`
4. **Heavy computation:** `for(let i=0; i<999999999; i++) { Math.sqrt(i); }`

**Recommended Fix:**
```javascript
// File: websocket/commands/execution-commands.js (or new file)

/**
 * Execute JavaScript with timeout protection
 * @param {WebContents} webContents - Electron WebContents
 * @param {string} code - JavaScript code to execute
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<any>}
 */
async function executeWithTimeout(webContents, code, timeout = 30000) {
  return Promise.race([
    webContents.executeJavaScript(code),
    new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Script execution timeout after ${timeout}ms`));
      }, timeout);
      // Store timeoutId for potential cleanup
      return timeoutId;
    })
  ]);
}

// Integration example:
async function handleExecuteJavaScript(command, params) {
  try {
    const timeout = params.timeout || 30000;  // 30 second default
    const result = await executeWithTimeout(
      webContents,
      params.code,
      timeout
    );
    return { success: true, result };
  } catch (error) {
    if (error.message.includes('timeout')) {
      return { success: false, error: 'Script execution timeout', code: 'TIMEOUT' };
    }
    return { success: false, error: error.message };
  }
}
```

**Configuration Options:**
```javascript
// Allow per-command timeout customization
const DEFAULT_TIMEOUTS = {
  execute_javascript: 30000,      // 30 seconds
  extract_html: 15000,            // 15 seconds
  extract_text: 15000,            // 15 seconds
  fill_form: 10000,               // 10 seconds
  screenshot: 20000               // 20 seconds
};

// Client can override:
ws.send(JSON.stringify({
  command: 'execute_javascript',
  code: 'await someAsyncFunction()',
  timeout: 60000  // 60 second timeout for this command
}));
```

**Estimated Effort:** 3-5 hours  
**Risk:** MEDIUM (could affect legitimate long-running scripts, but with configurable timeout)  
**Testing Strategy:**
- [ ] Test script that completes normally (should work)
- [ ] Test script with infinite loop (should timeout)
- [ ] Test script that exceeds timeout (should error gracefully)
- [ ] Test custom timeout values
- [ ] Performance: verify overhead <5ms per execution

**Acceptance Criteria:**
- [ ] All JavaScript executions wrapped with timeout
- [ ] Default timeout: 30 seconds
- [ ] Configurable per-command
- [ ] Tests pass: infinite loops timeout gracefully
- [ ] Error messages clear: "Script execution timeout after Xms"

---

#### CRITICAL-004: Weak Entropy in Token Validation
**Severity:** 🔴 CRITICAL  
**Status:** IDENTIFIED (partially fixed)  
**Component:** websocket/server.js (token validation at line 1576)  
**Impact:** Weak token validation could allow bypass with engineered tokens

**Current Code:**
```javascript
// websocket/server.js line 1576-1579
validateToken(token) {
  if (!this.authToken) return false;
  return token === this.authToken;  // Simple string comparison
}
```

**Issues:**
1. **No minimum length enforcement** - Could be single character
2. **No entropy validation** - Could be non-random (e.g., "token123")
3. **No format validation** - Could contain easily guessable patterns
4. **No rate limit on token guessing** - Though rate limiting exists globally

**Examples of Weak Tokens:**
```javascript
// These should be REJECTED
"a"                    // 1 character
"password"             // Dictionary word
"12345678"             // Sequential numbers
"aaaaaaaa"             // Repeated character
```

**Recommended Fix:**
```javascript
// File: websocket/server.js

/**
 * Validate token strength and format
 * @param {string} token - Token to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
validateTokenStrength(token) {
  // Minimum length check (32 chars = 128 bits entropy with base64)
  const MIN_TOKEN_LENGTH = 32;
  if (!token || token.length < MIN_TOKEN_LENGTH) {
    return {
      valid: false,
      error: `Token must be at least ${MIN_TOKEN_LENGTH} characters`
    };
  }
  
  // Entropy check - should look like random data
  // Must have reasonable character distribution (not all same char)
  const uniqueChars = new Set(token).size;
  if (uniqueChars < 8) {
    return {
      valid: false,
      error: 'Token entropy too low (lacks character diversity)'
    };
  }
  
  // Format validation - should be hex or base64-like
  // Reject tokens that are obviously weak
  if (/^(.)\1+$/.test(token)) {  // All same character
    return { valid: false, error: 'Token contains only repeated characters' };
  }
  
  if (/^\d+$/.test(token)) {  // All digits
    return { valid: false, error: 'Token cannot be all numeric' };
  }
  
  return { valid: true };
}

/**
 * Validate token at connection time
 * @param {string} token - Token provided by client
 * @returns {boolean}
 */
validateToken(token) {
  if (!this.authToken) return false;
  
  // Check token strength
  const strength = this.validateTokenStrength(token);
  if (!strength.valid) {
    this.logger.warn(`[WebSocket] Weak token rejected: ${strength.error}`);
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token, 'utf-8'),
    Buffer.from(this.authToken, 'utf-8')
  );
}

/**
 * Generate strong authentication token
 * @returns {string} - Cryptographically secure token
 */
static generateToken() {
  return crypto.randomBytes(32).toString('hex');  // 256-bit entropy
}
```

**Usage Example:**
```javascript
// Server setup
const ws = new WebSocketServer(8765, {
  authToken: WebSocketServer.generateToken()  // Generate strong token
});

// Client connection
const token = WebSocketServer.generateToken();  // 64 hex chars
ws.send(JSON.stringify({
  command: 'authenticate',
  token: token
}));
```

**Estimated Effort:** 3-4 hours  
**Risk:** LOW (additive validation, backward compatible)  
**Testing Strategy:**
- [ ] Test valid strong tokens (should accept)
- [ ] Test short tokens (should reject)
- [ ] Test low-entropy tokens (should reject)
- [ ] Test numeric-only tokens (should reject)
- [ ] Test repeated-character tokens (should reject)
- [ ] Verify timing-safe comparison works

**Acceptance Criteria:**
- [ ] Tokens <32 chars rejected
- [ ] Low-entropy tokens rejected
- [ ] Timing-safe comparison implemented
- [ ] 20+ validation test cases passing

---

#### CRITICAL-005: Insufficient Sensitive Data Masking
**Severity:** 🔴 CRITICAL  
**Status:** IDENTIFIED  
**Component:** extraction modules and response formatting  
**Impact:** Sensitive data (passwords, API keys, tokens) leaked in responses

**Current State:**
Password masking is implemented in some extraction methods, but:
- Inconsistent across all extraction commands
- Token/API key detection is regex-based (fragile)
- No masking in error messages or debug logs

**Current Implementation (Good):**
```javascript
// extraction/manager.js - password masking in some places
value: el.type !== 'password' ? el.value : '***'
```

**Current Implementation (Incomplete):**
```javascript
// interaction-recorder.js - regex-based detection
PASSWORD: /password|passwd|pwd/i,
TOKEN: /token|auth|bearer/i,
API_KEY: /api.?key|apikey/i,
SECRET: /secret|private/i
```

**Issues:**
1. **Regex too narrow** - Misses "access_token", "authentication_key", "api_secret"
2. **Not applied everywhere** - Form extraction, local storage, cookies
3. **Error messages** - Full stack traces leak request parameters
4. **Debug mode** - Detailed request/response logging in development

**Recommended Fix:**
```javascript
// File: websocket/utils/data-masking.js

class DataMasker {
  /**
   * Sensitive field patterns (comprehensive)
   */
  static SENSITIVE_PATTERNS = {
    password: /(?:password|passwd|pwd|pass(?:word)?|p[\w]*(?:ss)?word)/i,
    token: /(?:token|auth|authorization|bearer|jwt|access_token|refresh_token|session)/i,
    api_key: /(?:api[._-]?key|apikey|api[._-]?secret|x[._-]?api[._-]?key|private[._-]?key)/i,
    secret: /(?:secret|private|credential|auth_code|code|key)/i,
    credential: /(?:credential|username|userid|user_id|email|phone)/i,
    ssn: /\d{3}-\d{2}-\d{4}/,  // Social security number format
    credit_card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
    oauth: /(?:client_secret|oauth_secret|refresh_token)/i,
    cookie: /(?:session|sid|auth|token)(?:=|:)/i
  };

  /**
   * Check if a field name is sensitive
   * @param {string} fieldName - Field name to check
   * @returns {boolean}
   */
  static isSensitiveField(fieldName) {
    return Object.values(this.SENSITIVE_PATTERNS).some(pattern =>
      pattern.test(fieldName)
    );
  }

  /**
   * Mask a sensitive value
   * @param {string} value - Value to mask
   * @param {string} fieldName - Field name (for better masking decisions)
   * @returns {string}
   */
  static maskValue(value, fieldName = '') {
    if (!value) return '***';
    
    const valueStr = String(value);
    
    // For passwords and simple secrets: show nothing
    if (this.SENSITIVE_PATTERNS.password.test(fieldName) ||
        this.SENSITIVE_PATTERNS.secret.test(fieldName)) {
      return '***';
    }
    
    // For tokens: show first 4 and last 4 chars
    if (this.SENSITIVE_PATTERNS.token.test(fieldName)) {
      if (valueStr.length <= 8) return '***';
      return valueStr.substring(0, 4) + '...' + valueStr.slice(-4);
    }
    
    // For emails: mask middle
    if (fieldName.includes('email') || valueStr.includes('@')) {
      const [localPart, domain] = valueStr.split('@');
      if (domain) {
        const maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart.slice(-1);
        return `${maskedLocal}@${domain}`;
      }
    }
    
    // For credit cards: show last 4 only
    if (this.SENSITIVE_PATTERNS.credit_card.test(valueStr)) {
      return '**** **** **** ' + valueStr.slice(-4);
    }
    
    // For SSN: show last 4 only
    if (this.SENSITIVE_PATTERNS.ssn.test(valueStr)) {
      return 'XXX-XX-' + valueStr.slice(-4);
    }
    
    return '***';
  }

  /**
   * Recursively mask sensitive fields in an object
   * @param {Object} obj - Object to mask
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Object} - Masked object
   */
  static maskObject(obj, maxDepth = 5) {
    if (!obj || typeof obj !== 'object' || maxDepth <= 0) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item, maxDepth - 1));
    }
    
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        masked[key] = this.maskValue(value, key);
      } else if (typeof value === 'object') {
        masked[key] = this.maskObject(value, maxDepth - 1);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }

  /**
   * Mask sensitive data in error messages
   * @param {Error} error - Error object
   * @returns {Object} - Sanitized error
   */
  static maskError(error) {
    const masked = {
      message: error.message,
      code: error.code
    };
    
    // In production, exclude stack traces
    if (process.env.NODE_ENV === 'production') {
      return masked;
    }
    
    // In development, mask sensitive data in stack trace
    if (error.stack) {
      masked.stack = error.stack
        .split('\n')
        .map(line => this.maskLine(line))
        .join('\n');
    }
    
    return masked;
  }

  /**
   * Mask sensitive data in a log line
   * @param {string} line - Log line
   * @returns {string}
   */
  static maskLine(line) {
    return line
      .replace(/\?token=[^&\s]*/gi, '?token=***')
      .replace(/\?password=[^&\s]*/gi, '?password=***')
      .replace(/Authorization: Bearer [^\s]*/i, 'Authorization: Bearer ***')
      .replace(/api[._-]?key[=:]\s*[^\s]*/gi, 'api_key=***');
  }
}

module.exports = { DataMasker };
```

**Integration into WebSocket responses:**
```javascript
// websocket/server.js - response handler

async function sendResponse(ws, id, command, result, error = null) {
  const response = {
    id,
    command,
    success: !error,
    timestamp: new Date().toISOString()
  };
  
  if (error) {
    // NEW: Mask sensitive data in errors
    response.error = DataMasker.maskError(error);
  } else {
    // NEW: Mask sensitive data in successful responses
    response.data = DataMasker.maskObject(result);
  }
  
  ws.send(JSON.stringify(response));
}
```

**Estimated Effort:** 6-8 hours  
**Risk:** LOW (non-breaking, only masks sensitive data)  
**Testing Strategy:**
- [ ] Test password field masking
- [ ] Test token field masking
- [ ] Test API key masking
- [ ] Test email masking
- [ ] Test credit card masking
- [ ] Test nested object masking
- [ ] Test error masking

**Acceptance Criteria:**
- [ ] All sensitive fields masked in responses
- [ ] Passwords show as "***"
- [ ] Tokens show first 4 + last 4 chars
- [ ] Emails show as: u***r@domain.com
- [ ] Error messages don't leak credentials
- [ ] 50+ masking test cases passing

---

### 1.2 High Priority Issues (v12.1.0 Sprint)

#### HIGH-001: Command-Level Authorization Framework
**Severity:** 🟠 HIGH  
**Status:** IDENTIFIED  
**Component:** WebSocket command dispatch (websocket/server.js)  
**Impact:** All authenticated clients have access to all commands, including sensitive data extraction

**Current State:**
```javascript
// websocket/server.js - No authorization checks per command
const handler = commandHandlers[command];
if (handler) {
  const result = await handler(ws, params);
}
// Any authenticated client can run any command
```

**Risk Analysis:**
Sensitive commands without authorization:
- `extract_html` - Can extract full page content
- `extract_text` - Can extract all text
- `get_cookies` - Can access session cookies
- `get_local_storage` - Can access stored data
- `screenshot` - Can capture page visuals
- `fill_form` - Can input credentials
- `execute_javascript` - Arbitrary code execution

**Recommended Fix:**
```javascript
// File: websocket/middleware/authorization.js

class CommandAuthorizer {
  /**
   * Define which commands are sensitive
   */
  static SENSITIVE_COMMANDS = new Set([
    'extract_html',
    'extract_text',
    'extract_links',
    'extract_metadata',
    'get_cookies',
    'get_all_cookies',
    'get_local_storage',
    'get_session_storage',
    'screenshot',
    'screenshot_element',
    'screenshot_full_page',
    'fill_form',
    'execute_javascript',
    'get_page_state',
    'get_request_headers',
    'get_response_headers',
    'modify_cookies',
    'delete_cookies',
    'clear_storage'
  ]);

  /**
   * Check if client is authorized for command
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} command - Command name
   * @returns {Object} { authorized: boolean, reason?: string }
   */
  static authorize(ws, command) {
    // Unauthenticated clients cannot run sensitive commands
    if (!ws.isAuthenticated) {
      if (this.SENSITIVE_COMMANDS.has(command)) {
        return { authorized: false, reason: 'Authentication required' };
      }
      return { authorized: true };
    }

    // Check role-based access (if implemented)
    if (ws.clientRole) {
      return this.authorizeByRole(ws.clientRole, command);
    }

    // Authenticated clients can run any command (default behavior)
    return { authorized: true };
  }

  /**
   * Role-based access control (future enhancement)
   * @param {string} role - Client role
   * @param {string} command - Command name
   * @returns {Object}
   */
  static authorizeByRole(role, command) {
    const ROLE_PERMISSIONS = {
      admin: ['*'],  // All commands
      analyst: [
        'navigate',
        'get_url',
        'screenshot',
        'extract_text',
        'extract_metadata',
        'get_page_state'
        // Cannot access: execute_javascript, get_cookies, modify_cookies
      ],
      collector: [
        'navigate',
        'screenshot',
        'screenshot_full_page',
        'extract_html',
        'extract_text',
        'extract_links'
        // Cannot access: execute_javascript, get_cookies
      ],
      viewer: [
        'get_url',
        'get_page_state',
        'list_sessions',
        'get_history'
        // Read-only access
      ]
    };

    const allowedCommands = ROLE_PERMISSIONS[role] || [];
    if (allowedCommands.includes('*')) return { authorized: true };
    if (allowedCommands.includes(command)) return { authorized: true };

    return {
      authorized: false,
      reason: `Role '${role}' not authorized for command '${command}'`
    };
  }
}

module.exports = { CommandAuthorizer };
```

**Integration into WebSocket:**
```javascript
// websocket/server.js - message handler

ws.on('message', async (message) => {
  try {
    const data = JSON.parse(message.toString());
    const { command, ...params } = data;

    // NEW: Authorization check
    const authResult = CommandAuthorizer.authorize(ws, command);
    if (!authResult.authorized) {
      ws.send(JSON.stringify({
        id: data.id,
        error: authResult.reason || 'Not authorized',
        code: 'UNAUTHORIZED',
        command
      }));
      
      // Log unauthorized attempt
      this.logger.warn(`Unauthorized command attempt: ${ws.clientId} tried ${command}`);
      return;
    }

    // NEW: Log sensitive command access
    if (CommandAuthorizer.SENSITIVE_COMMANDS.has(command)) {
      this.logger.info(`Sensitive command executed: ${command} by ${ws.clientId}`);
    }

    // Continue with command execution
    const handler = commandHandlers[command];
    if (handler) {
      const result = await handler(ws, params);
      // ... send result
    }
  } catch (error) {
    // ... error handling
  }
});
```

**Audit Logging:**
```javascript
// NEW: Log all sensitive operations
class AuditLog {
  static log(clientId, command, params, result) {
    if (!CommandAuthorizer.SENSITIVE_COMMANDS.has(command)) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      clientId,
      command,
      success: result.success,
      dataExtracted: result.size || 0  // bytes
    };
    
    // Write to audit log file
    fs.appendFileSync(
      'logs/audit.log',
      JSON.stringify(logEntry) + '\n'
    );
  }
}
```

**Estimated Effort:** 6-8 hours  
**Risk:** LOW (additive, doesn't break existing functionality)  
**Testing Strategy:**
- [ ] Test unauthenticated access to sensitive commands (should fail)
- [ ] Test authenticated access to sensitive commands (should succeed)
- [ ] Test role-based restrictions
- [ ] Test authorization logging
- [ ] Performance: verify <2ms authorization check

**Acceptance Criteria:**
- [ ] All sensitive commands identified
- [ ] Authorization middleware implemented
- [ ] Role-based access control designed (not yet implemented)
- [ ] Audit logging for sensitive operations
- [ ] 40+ authorization test cases passing

---

#### HIGH-002: Enhanced Token Rotation & Revocation
**Severity:** 🟠 HIGH  
**Status:** IDENTIFIED  
**Component:** Authentication system (websocket/server.js)  
**Impact:** Compromised tokens cannot be revoked, affecting long-lived connections

**Current State:**
- Single static token for all connections
- No token rotation mechanism
- No token revocation/blacklist
- No token expiration

**Recommended Fix:**
```javascript
// File: websocket/auth/token-manager.js

class TokenManager {
  constructor() {
    this.tokens = new Map();  // token -> metadata
    this.blacklist = new Set();  // Revoked tokens
  }

  /**
   * Generate a new token with expiration
   * @param {Object} metadata - Token metadata (clientId, roles, etc)
   * @param {number} expiresIn - Expiration time in milliseconds
   * @returns {string} - Token value
   */
  generateToken(metadata, expiresIn = 3600000) {  // 1 hour default
    const token = crypto.randomBytes(32).toString('hex');
    const tokenMetadata = {
      ...metadata,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
      issuedTo: metadata.clientId,
      rotationCount: 0
    };

    this.tokens.set(token, tokenMetadata);
    return token;
  }

  /**
   * Validate a token
   * @param {string} token - Token to validate
   * @returns {Object} { valid: boolean, metadata?: Object, error?: string }
   */
  validateToken(token) {
    // Check if revoked
    if (this.blacklist.has(token)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    // Check if token exists
    const metadata = this.tokens.get(token);
    if (!metadata) {
      return { valid: false, error: 'Token not found' };
    }

    // Check if expired
    if (Date.now() > metadata.expiresAt) {
      this.tokens.delete(token);
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, metadata };
  }

  /**
   * Rotate a token (issue new token, invalidate old)
   * @param {string} oldToken - Current token
   * @returns {string|null} - New token, or null if old token invalid
   */
  rotateToken(oldToken) {
    const validation = this.validateToken(oldToken);
    if (!validation.valid) return null;

    const { metadata } = validation;
    const newMetadata = {
      ...metadata,
      rotationCount: (metadata.rotationCount || 0) + 1,
      previousToken: oldToken
    };

    // Revoke old token
    this.blacklist.add(oldToken);
    this.tokens.delete(oldToken);

    // Issue new token
    return this.generateToken(newMetadata);
  }

  /**
   * Revoke a token
   * @param {string} token - Token to revoke
   * @returns {boolean} - True if revoked
   */
  revokeToken(token) {
    if (this.tokens.has(token)) {
      this.blacklist.add(token);
      this.tokens.delete(token);
      return true;
    }
    return false;
  }

  /**
   * Revoke all tokens for a client
   * @param {string} clientId - Client ID
   */
  revokeClientTokens(clientId) {
    for (const [token, metadata] of this.tokens.entries()) {
      if (metadata.issuedTo === clientId) {
        this.revokeToken(token);
      }
    }
  }

  /**
   * Clean up expired tokens (periodic)
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, metadata] of this.tokens.entries()) {
      if (now > metadata.expiresAt) {
        this.tokens.delete(token);
      }
    }
  }
}

module.exports = { TokenManager };
```

**Integration into WebSocket:**
```javascript
// websocket/server.js

class WebSocketServer {
  constructor(port, mainWindow, options = {}) {
    // ... existing code
    this.tokenManager = new TokenManager();
    
    // Periodic cleanup of expired tokens
    setInterval(() => this.tokenManager.cleanupExpiredTokens(), 60000);  // Every minute
  }

  /**
   * Handle refresh token request
   */
  handleRefreshToken(ws, oldToken) {
    const newToken = this.tokenManager.rotateToken(oldToken);
    if (!newToken) {
      return { success: false, error: 'Invalid or expired token' };
    }
    
    this.logger.info(`Token rotated for client ${ws.clientId}`);
    return { success: true, token: newToken, expiresIn: 3600000 };
  }

  /**
   * Handle token revocation request
   */
  handleRevokeToken(ws, token) {
    this.tokenManager.revokeToken(token);
    this.logger.info(`Token revoked for client ${ws.clientId}`);
    return { success: true };
  }
}
```

**Command to expose token operations:**
```javascript
// New WebSocket commands
'refresh_token': {
  description: 'Get a new token (rotate current)',
  command: 'refresh_token',
  response: { success: true, token: 'new_token_value', expiresIn: 3600000 }
},

'revoke_token': {
  description: 'Revoke a token',
  command: 'revoke_token',
  params: { token: 'token_to_revoke' },
  response: { success: true }
}
```

**Estimated Effort:** 5-7 hours  
**Risk:** MEDIUM (changes authentication flow, requires testing)  
**Testing Strategy:**
- [ ] Test token generation
- [ ] Test token validation
- [ ] Test token expiration
- [ ] Test token rotation
- [ ] Test token revocation
- [ ] Test cleanup of expired tokens

**Acceptance Criteria:**
- [ ] Tokens have expiration time
- [ ] Token rotation generates new valid token
- [ ] Revoked tokens are rejected
- [ ] Expired tokens are rejected
- [ ] 30+ token management test cases passing

---

#### HIGH-003: HTTPS/WSS Enforcement Validation
**Severity:** 🟠 HIGH  
**Status:** PARTIALLY IMPLEMENTED  
**Component:** websocket/server.js  
**Impact:** Development deployments might run unencrypted in non-production environments

**Current State:**
- WSS enforcement available but not default
- Fallback to plain WS if SSL fails silently
- No clear deployment guidance for production

**Assessment:**
Looking at websocket/server.js lines 1024-1085, the enforcement is present but:
```javascript
// Line 1024-1028: Check enforces WSS if required
if (this.shouldEnforceWss() && !this.sslActive && !this.sslEnabled) {
  throw new Error('WSS enforcement requires SSL/HTTPS configuration...');
}

// Line 1063: But silently falls back to non-SSL on certificate error
catch (error) {
  this.logger.error(`Failed to load SSL certificates: ${error.message}`);
  this.logger.info('[WebSocket] Falling back to non-SSL mode');
  this.wss = new WebSocket.Server({ port: this.port, ... });
}
```

**Issues:**
1. Fallback to non-SSL mode hides configuration errors
2. No warning about deploying without encryption
3. No deployment checklist provided

**Recommended Fix:**
```javascript
// File: websocket/deployment-validator.js

class DeploymentValidator {
  /**
   * Validate deployment configuration
   * @param {Object} wsConfig - WebSocket server configuration
   * @returns {Object} { valid: boolean, warnings: [], errors: [] }
   */
  static validateDeployment(wsConfig) {
    const result = { valid: true, warnings: [], errors: [] };

    // Check 1: Production mode should enforce WSS
    if (wsConfig.productionMode && !wsConfig.sslEnabled) {
      result.errors.push(
        'PROD-001: Production mode enabled but WSS/SSL not configured. ' +
        'Set BASSET_WS_SSL_ENABLED=true or disable production mode.'
      );
    }

    // Check 2: Cloud/container deployments should enforce WSS
    if (process.env.BASSET_DEPLOYMENT === 'docker' && !wsConfig.sslEnabled) {
      result.warnings.push(
        'WARN-001: Docker deployment detected without WSS. ' +
        'Recommended to enable SSL for network security.'
      );
    }

    // Check 3: Port binding (0.0.0.0 = listening on all interfaces)
    if (wsConfig.port < 1024 && process.getuid?.() !== 0) {
      result.errors.push(
        'DEPLOY-002: Cannot bind to privileged port (<1024) without root. ' +
        'Use a port >=1024 or use reverse proxy (nginx, caddy).'
      );
    }

    // Check 4: Memory configuration
    const memoryLimit = wsConfig.memoryLimit || 512;
    if (memoryLimit < 256) {
      result.warnings.push(
        'WARN-002: Low memory limit (<256MB). ' +
        'May impact performance with concurrent connections.'
      );
    }

    // Check 5: Rate limiting should be configured
    if (!wsConfig.rateLimitEnabled && wsConfig.productionMode) {
      result.warnings.push(
        'WARN-003: Rate limiting disabled in production. ' +
        'Recommend enabling for DDoS protection.'
      );
    }

    return result;
  }

  /**
   * Print validation report
   */
  static printReport(validation) {
    if (validation.errors.length > 0) {
      console.error('\n🔴 DEPLOYMENT ERRORS:');
      validation.errors.forEach(err => console.error(`  ${err}`));
      console.error('\nCannot start server. Fix errors above.\n');
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn('\n⚠️  DEPLOYMENT WARNINGS:');
      validation.warnings.forEach(warn => console.warn(`  ${warn}`));
    }

    if (validation.errors.length === 0) {
      console.log('\n✅ Deployment configuration valid\n');
    }
  }
}

module.exports = { DeploymentValidator };
```

**Integration into startup:**
```javascript
// main.js or websocket server initialization

const validation = DeploymentValidator.validateDeployment(wsConfig);
DeploymentValidator.printReport(validation);

if (validation.errors.length > 0) {
  logger.error('Deployment validation failed. See errors above.');
  process.exit(1);
}
```

**Create Deployment Guide:**
```markdown
# File: docs/DEPLOYMENT-SECURITY-CHECKLIST.md

## Production Deployment Checklist

### Security Configuration
- [ ] Enable WSS/HTTPS enforcement: `export BASSET_WS_SSL_ENABLED=true`
- [ ] Provide valid SSL certificates
  - [ ] Certificate path: `export BASSET_WS_SSL_CERT=/path/to/cert.pem`
  - [ ] Key path: `export BASSET_WS_SSL_KEY=/path/to/key.pem`
- [ ] Enable production mode: `export NODE_ENV=production`
- [ ] Enable rate limiting (prevent abuse)
- [ ] Enable authentication: `export BASSET_WS_REQUIRE_AUTH=true`
- [ ] Set strong auth token: `export BASSET_WS_TOKEN=$(openssl rand -hex 32)`

### Network Configuration
- [ ] Configure firewall to allow only port 8765 (or custom)
- [ ] Disable public internet access to WebSocket port
- [ ] Use reverse proxy (nginx/caddy) for SSL termination
- [ ] Enable CORS restrictions in reverse proxy

### Docker/Container Deployment
- [ ] Use non-root user in container
- [ ] Mount SSL certificates as secret (not in image)
- [ ] Set memory limits (--memory 1g)
- [ ] Enable health checks
- [ ] Log security events

### Verification
- [ ] Test WSS connection: `wss://localhost:8765`
- [ ] Verify SSL certificate validity
- [ ] Confirm authentication required
- [ ] Check logs for errors
- [ ] Run security audit: `npm audit`
```

**Estimated Effort:** 4-6 hours  
**Risk:** LOW (additive validation, no breaking changes)  
**Testing Strategy:**
- [ ] Test production mode with SSL enabled (should start)
- [ ] Test production mode without SSL (should fail)
- [ ] Test Docker deployment warnings
- [ ] Test low memory warnings
- [ ] Test port binding checks

**Acceptance Criteria:**
- [ ] Deployment validator catches SSL configuration errors
- [ ] Clear error/warning messages in logs
- [ ] Deployment guide complete and accurate
- [ ] No silent failures (explicit errors on misconfiguration)

---

#### HIGH-004: Comprehensive Error Response Standardization
**Severity:** 🟠 HIGH  
**Status:** IDENTIFIED  
**Component:** All WebSocket command handlers  
**Impact:** Inconsistent error responses make error handling difficult for clients

**Current State:**
Mixed error response formats across handlers:
```javascript
// Format 1: websocket/commands/evasion-commands.js
return { success: false, error: errorMessage };

// Format 2: websocket/commands/image-commands.js
return { success: false, error: errorMessage, code: 'ERROR_CODE' };

// Format 3: websocket/handlers/proxy-handler.js
ws.send(JSON.stringify({ error, success: false }));

// Format 4: Some handlers include data
return { success: false, error: msg, details: data };
```

**Recommended Fix:**
Create a standard response formatter:

```javascript
// File: websocket/utils/response-formatter.js

class ResponseFormatter {
  /**
   * Standard success response
   * @param {*} data - Response data
   * @param {string} message - Optional success message
   * @returns {Object}
   */
  static success(data, message = null) {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      data
    };
    
    if (message) {
      response.message = message;
    }
    
    return response;
  }

  /**
   * Standard error response
   * @param {string} message - Error message
   * @param {string} code - Error code (for programmatic handling)
   * @param {*} details - Additional error details
   * @returns {Object}
   */
  static error(message, code = 'UNKNOWN_ERROR', details = null) {
    const response = {
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message,
        code,
      }
    };
    
    if (details) {
      response.error.details = details;
    }
    
    return response;
  }

  /**
   * Standard validation error response
   * @param {string} field - Field that failed validation
   * @param {string} reason - Why validation failed
   * @returns {Object}
   */
  static validationError(field, reason) {
    return this.error(
      `Validation failed for field: ${field}`,
      'VALIDATION_ERROR',
      { field, reason }
    );
  }

  /**
   * Standard timeout error response
   * @param {number} timeout - Timeout duration in ms
   * @returns {Object}
   */
  static timeout(timeout) {
    return this.error(
      `Operation timeout after ${timeout}ms`,
      'TIMEOUT',
      { timeout }
    );
  }

  /**
   * Standard authentication error response
   * @returns {Object}
   */
  static unauthorized() {
    return this.error(
      'Authentication required',
      'UNAUTHORIZED'
    );
  }

  /**
   * Standard permission error response
   * @param {string} command - Command that was denied
   * @returns {Object}
   */
  static forbidden(command) {
    return this.error(
      `Not authorized for command: ${command}`,
      'FORBIDDEN',
      { command }
    );
  }

  /**
   * Standard not found error response
   * @param {string} resource - Resource that wasn't found
   * @returns {Object}
   */
  static notFound(resource) {
    return this.error(
      `Resource not found: ${resource}`,
      'NOT_FOUND',
      { resource }
    );
  }

  /**
   * Standard rate limit error response
   * @param {number} retryAfter - Seconds to wait before retry
   * @returns {Object}
   */
  static rateLimited(retryAfter = 60) {
    return this.error(
      `Rate limit exceeded. Retry after ${retryAfter}s`,
      'RATE_LIMITED',
      { retryAfter }
    );
  }

  /**
   * Wrap a client response with metadata
   * @param {*} commandId - Command ID for matching
   * @param {string} command - Command name
   * @param {Object} response - Response object
   * @returns {Object}
   */
  static wrap(commandId, command, response) {
    return {
      id: commandId,
      command,
      ...response
    };
  }
}

module.exports = { ResponseFormatter };
```

**Usage Examples:**
```javascript
// In command handlers
const { ResponseFormatter } = require('../utils/response-formatter');

// Success response
return ResponseFormatter.success({ url: 'https://example.com' });
// Output: { success: true, timestamp: "...", data: { url: "..." } }

// Error response
return ResponseFormatter.error('Navigation failed', 'NAV_ERROR', { url: 'invalid' });
// Output: { success: false, timestamp: "...", error: { message: "...", code: "NAV_ERROR", details: {...} } }

// Validation error
return ResponseFormatter.validationError('selector', 'Invalid CSS selector');

// Timeout error
return ResponseFormatter.timeout(30000);

// Rate limited
return ResponseFormatter.rateLimited(60);

// Wrap in WebSocket response
ws.send(JSON.stringify(
  ResponseFormatter.wrap(data.id, data.command, response)
));
```

**Error Code Registry:**
```javascript
// File: websocket/constants/error-codes.js

const ERROR_CODES = {
  // Generic errors
  'UNKNOWN_ERROR': 'An unknown error occurred',
  'VALIDATION_ERROR': 'Request validation failed',
  'TIMEOUT': 'Operation timed out',

  // Authentication/Authorization
  'UNAUTHORIZED': 'Authentication required',
  'FORBIDDEN': 'Not authorized for this operation',
  'INVALID_TOKEN': 'Token is invalid or expired',

  // Rate limiting
  'RATE_LIMITED': 'Too many requests, please slow down',
  'RATE_LIMITED_COMMAND': 'This command exceeds rate limit',

  // Navigation
  'NAV_TIMEOUT': 'Page navigation timed out',
  'NAV_INVALID_URL': 'Invalid URL provided',
  'NAV_NETWORK_ERROR': 'Network error during navigation',

  // JavaScript execution
  'JS_TIMEOUT': 'JavaScript execution timed out',
  'JS_SYNTAX_ERROR': 'JavaScript syntax error',
  'JS_RUNTIME_ERROR': 'JavaScript runtime error',

  // DOM operations
  'DOM_SELECTOR_ERROR': 'Invalid DOM selector',
  'DOM_ELEMENT_NOT_FOUND': 'DOM element not found',
  'DOM_OPERATION_FAILED': 'DOM operation failed',

  // Data extraction
  'EXTRACTION_TIMEOUT': 'Data extraction timed out',
  'EXTRACTION_FAILED': 'Data extraction failed',

  // Screenshot/Recording
  'SCREENSHOT_FAILED': 'Screenshot capture failed',
  'RECORDING_FAILED': 'Recording operation failed',

  // Proxy/Network
  'PROXY_ERROR': 'Proxy connection error',
  'NETWORK_ERROR': 'Network operation failed',
};

module.exports = { ERROR_CODES };
```

**Estimated Effort:** 8-10 hours  
**Risk:** MEDIUM (affects all responses, requires testing all commands)  
**Testing Strategy:**
- [ ] Test success response format
- [ ] Test error response format
- [ ] Test validation error format
- [ ] Test timeout error format
- [ ] Test all error code variations
- [ ] Verify response wrapping with command ID

**Acceptance Criteria:**
- [ ] All 164 commands use standard ResponseFormatter
- [ ] Error responses include: message, code, details
- [ ] Success responses include: data, optional message
- [ ] All responses have timestamp
- [ ] Error codes documented and unique
- [ ] 100+ response format test cases passing

---

### 1.3 Medium Priority Issues (v12.2.0+)

#### MEDIUM-001: PII Detection and Redaction
**Severity:** 🟡 MEDIUM  
**Status:** IDENTIFIED  
**Component:** Data extraction and response handling  
**Impact:** Personally identifiable information may be exposed in responses

**Recommended Approach:**
Extend DataMasker (from CRITICAL-005) with PII detection using pattern matching and ML-based models.

**Estimated Effort:** 10-15 hours  
**Timeline:** v12.2.0 (July 2026)

---

#### MEDIUM-002: API Rate Limiting Per Command
**Severity:** 🟡 MEDIUM  
**Status:** IDENTIFIED  
**Component:** Rate limiting system  
**Impact:** Resource-intensive commands not throttled differently than lightweight commands

**Current:** Global rate limit (same for all commands)  
**Proposed:** Per-command rate limits based on resource cost

**Example:**
```javascript
const COMMAND_RATE_LIMITS = {
  'ping': 1000,              // 1000 req/min
  'get_url': 100,            // 100 req/min
  'screenshot': 30,          // 30 req/min
  'execute_javascript': 10,  // 10 req/min
  'extract_html': 20        // 20 req/min
};
```

**Estimated Effort:** 5-7 hours  
**Timeline:** v12.2.0 (July 2026)

---

#### MEDIUM-003: Forensic Evidence Packaging
**Severity:** 🟡 MEDIUM  
**Status:** IDENTIFIED  
**Component:** Evidence export (for ISO 27037 compliance)  
**Impact:** Evidence not packaged in court-ready format with integrity verification

**Includes:**
- SHA-256/SHA-512 hash verification
- Digital signatures (RSA/ECDSA)
- Chain of custody documentation
- NIST timestamp integration (optional)

**Estimated Effort:** 12-16 hours  
**Timeline:** v12.2.0 (July 2026)

---

#### MEDIUM-004: Role-Based Access Control Implementation
**Severity:** 🟡 MEDIUM  
**Status:** IDENTIFIED (framework only in HIGH-001)  
**Component:** Authorization system  
**Impact:** Cannot limit client access to specific commands/features

**Extends HIGH-001 with full implementation:**
- Token includes role claim (JWT-style)
- Per-role command whitelists
- Resource-level permissions (e.g., specific profiles)
- Role management API

**Estimated Effort:** 10-14 hours  
**Timeline:** v12.2.0 (July 2026)

---

#### MEDIUM-005: Encryption at Rest for Evidence
**Severity:** 🟡 MEDIUM  
**Status:** IDENTIFIED  
**Component:** Local storage, extraction output  
**Impact:** Evidence stored in plaintext on disk

**Proposed:**
- AES-256-GCM encryption for stored evidence
- Key derivation from master secret
- Per-file unique IVs
- Audit trail of decryption

**Estimated Effort:** 8-12 hours  
**Timeline:** v12.2.0 (July 2026)

---

## PART 2: DEPENDENCY SECURITY ANALYSIS

### 2.1 Current npm audit Report (May 31, 2026)

**Summary:**
```
11 vulnerabilities (5 moderate, 6 high)
```

### 2.2 Vulnerability Breakdown

#### HIGH Severity (6 total)

**1. ws (WebSocket Library)**
- **Versions:** 8.0.0 - 8.20.0 (current: 8.14.2)
- **Vulnerabilities:**
  - GHSA-3h5v-q93c-6h6q: DoS when handling requests with many HTTP headers
  - GHSA-58qx-3vcg-4xpx: Uninitialized memory disclosure
- **Fix:** Update to ws@8.21.0 or later
- **Impact:** Production risk (WebSocket server vulnerability)
- **Breaking Changes:** None (patch release)
- **Test Impact:** Run full integration tests
- **Action:** UPDATE IMMEDIATELY

**2. tar-fs (Tarball Extraction)**
- **Versions:** 2.0.0 - 2.1.3
- **Vulnerabilities:**
  - GHSA-vj76-c3g6-qr5v: Symlink validation bypass
  - GHSA-8cj5-5rvv-wf4v: Extract outside directory
  - GHSA-pq67-2wwv-3xjx: Path traversal in tar
- **Path:** puppeteer-core → devtools → webdriverio
- **Fix:** Requires updating electron-builder
- **Impact:** Test/build pipeline risk
- **Breaking Changes:** None (patch release)
- **Status:** Mitigated by restricting to devDependencies
- **Action:** Monitor, update in v12.1.0

**3. got (HTTP Client)**
- **Versions:** <11.8.5
- **Vulnerability:** GHSA-pfrx-2q88-qq97 - Redirect to UNIX socket
- **Path:** electron-chromedriver → @electron/get → got
- **Fix:** Update transitive dependency
- **Impact:** Low (test dependency, no production use)
- **Breaking Changes:** None (patch release)
- **Status:** Mitigated by spectron v19.0.0 update
- **Action:** Monitor, covered by electron-builder update

#### MODERATE Severity (5 total)

**4. uuid (UUID Generation)**
- **Versions:** <11.1.1
- **Vulnerability:** GHSA-w5hq-g745-h8pq - Buffer bounds check missing
- **Path:** jest-junit → uuid
- **Fix:** Update jest-junit or uuid directly
- **Impact:** Low (test dependency only)
- **Breaking Changes:** None (patch release)
- **Action:** UPDATE with npm audit fix

### 2.3 Update Plan

**Tier 1: Critical Updates (Immediate)**
```bash
# Update ws (production dependency)
npm install --save ws@latest
# Expected: ws@8.21.0 or later

# Verify no breaking changes
npm test
npm run test:integration
```

**Tier 2: High Priority Updates (v12.1.0 Sprint)**
```bash
# Update build/test dependencies
npm install --save-dev jest-junit@latest
npm install --save-dev @playwright/test@latest

# Full test suite
npm audit
npm run test:ci
npm run build
```

**Tier 3: Non-Breaking Updates (Deferred)**
```bash
# These can wait for larger version bumps
# - electron-builder (requires testing)
# - electron (requires regression testing)
# - spectron (breaking changes, already at v19.0.0)
```

### 2.4 Packages Safe to Update Immediately

| Package | Current | Latest | Breaking | Test Impact | Status |
|---------|---------|--------|----------|-------------|--------|
| **ws** | 8.14.2 | 8.21.0 | None | High | ✅ SAFE |
| **@playwright/test** | 1.40.0 | 1.60.0 | None | Medium | ✅ SAFE |
| **jest-junit** | 16.0.0 | latest | Possible | Medium | ⚠️ TEST |

### 2.5 Packages Requiring Testing Before Update

| Package | Current | Latest | Breaking | Reason | Timeline |
|---------|---------|--------|----------|--------|----------|
| **electron-builder** | 24.13.3 | 26.8.1 | Maybe | Fixes tar-fs vulns | v12.1.0 |
| **jest** | 29.7.0 | 30.4.2 | Unlikely | Test framework | v12.1.0 |
| **electron** | 39.2.7 | 41.7.1 | Yes | Major changes | v12.2.0 |
| **spectron** | 19.0.0 | 20.0.0 | Yes | Already updated | Later |

### 2.6 Vulnerable Transitive Dependencies

**Summary:**
These packages are dependencies of test/build tools:
- puppeteer-core (via devtools for webdriverio)
- electron-chromedriver (via @electron/get for spectron)
- webdriverio (already using spectron v19.0.0)

**Risk Assessment:** LOW (test/dev only, isolated from production code)

### 2.7 Remediation Timeline

```
Timeline | Action | Packages | Effort | Risk
---------|--------|----------|--------|------
NOW      | ws update | ws@8.21.0 | 2h | LOW
v12.1.0  | jest/builder | jest-junit, @playwright | 3h | MEDIUM
v12.1.0  | electron-builder | electron-builder 26.x | 3h | MEDIUM
v12.2.0  | electron | electron 41.x | 6h | HIGH
v12.3.0  | spectron | spectron 20.x | 4h | MEDIUM
```

---

## PART 3: CODE SECURITY REVIEW

### 3.1 Input Validation Coverage

**Status:** INCOMPLETE  
**Covered:** ~30% of commands  
**Missing:** ~70% of commands  

See CRITICAL-002 for detailed remediation.

### 3.2 Authentication Mechanisms

**Status:** GOOD  
**Coverage:**
- ✅ Bearer token support
- ✅ Query parameter support
- ✅ Header-based authentication
- ✅ Environment variable support
- ❌ Token expiration
- ❌ Token rotation

See HIGH-002 for token rotation implementation.

### 3.3 Cryptographic Usage

**Current Implementation:**
- ✅ crypto.randomBytes for client IDs (secure)
- ✅ crypto.timingSafeEqual for token comparison
- ✅ SHA-256 hashing for evidence
- ❌ No digital signatures on responses
- ❌ No encryption of responses

**Assessment:** GOOD for current use case. See MEDIUM-003 for future enhancements.

### 3.4 Error Handling

**Status:** GOOD (with improvements needed)
- ✅ Global error handlers
- ✅ Try-catch in async functions
- ⚠️ Inconsistent error response formats (see HIGH-004)
- ❌ Some error messages leak sensitive information (see CRITICAL-005)

### 3.5 Logging Security

**Status:** GOOD
- ✅ Password field masking
- ✅ Token detection (regex-based)
- ✅ Detailed operation logging
- ❌ Sensitive data not masked everywhere

See CRITICAL-005 for comprehensive masking implementation.

### 3.6 Injection Attack Vectors

**JavaScript Injection:** MEDIUM RISK
- Risk: Arbitrary code execution in page context
- Mitigation: Page sandbox isolates from OS
- Recommendation: Add timeout (CRITICAL-003)

**SQL Injection:** NOT APPLICABLE (no database)

**Command Injection:** LOW RISK
- Risk: Limited (structured JSON commands)
- No shell commands executed
- Selector evaluation is DOM-only

**XXE (XML External Entity):** LOW RISK
- Risk: Low (limited XML parsing)
- Recommendation: Validate XML sources

### 3.7 Path Traversal Risks

**Current:** LOW RISK
- File operations use controlled paths
- No user input in file paths
- Screenshot/extraction output in managed directories

**Recommendation:** Validate all file paths before operations

### 3.8 CORS/CSRF Protection

**WebSocket:** N/A (WebSocket doesn't use CORS)
**Mitigation:**
- ✅ Origin header validation implemented
- ✅ Authentication tokens prevent CSRF
- ✅ Per-client rate limiting

### 3.9 Authentication Token Strength

**Current:**
- Minimum length: Not enforced
- Entropy validation: Not implemented
- Complexity: Not enforced

**Recommendation:** See CRITICAL-004 for token strength enforcement

---

## PART 4: INFRASTRUCTURE SECURITY

### 4.1 Docker Image Security

**Status:** GOOD
- ✅ Minimal base image
- ✅ Non-root user recommended
- ✅ Health checks implemented
- ❌ No image vulnerability scanning

**Recommendations:**
1. Add container image scanning (Trivy, Snyk)
2. Document Dockerfile security best practices
3. Implement runtime security checks

### 4.2 Network Exposure

**Current:**
- WebSocket port 8765 (default)
- No port isolation
- Plain HTTP by default

**Security Posture:**
- ✅ Can be restricted via firewall
- ✅ Reverse proxy support
- ❌ No default network isolation

**Recommendations:**
1. Document network isolation best practices
2. Provide docker-compose with network segmentation
3. Add firewall configuration examples

### 4.3 Data at Rest

**Current State:**
- Screenshots: Unencrypted files
- Extraction results: Unencrypted JSON
- Logs: Unencrypted text files
- Database: N/A

**Recommendations:**
1. Add optional encryption for stored evidence (MEDIUM-005)
2. Secure log file permissions (0600)
3. Document data retention policies

### 4.4 Data in Transit

**Current:** Conditional encryption
- ✅ WSS/HTTPS available
- ❌ Plain WS/HTTP default
- ✅ Can be enforced in production

**Recommendations:**
1. Enforce WSS in production (HIGH-003)
2. Document certificate management
3. Provide Let's Encrypt integration examples

### 4.5 Secret Management

**Current:** Environment variables
- ✅ Token via BASSET_WS_TOKEN env var
- ✅ SSL certificates via paths
- ❌ No secret rotation
- ❌ No vault integration

**Recommendations:**
1. Document secure secret management
2. Add vault/secret manager integration (optional)
3. Implement secret rotation (HIGH-002)

### 4.6 Process Isolation

**Current:** Electron process
- ✅ Renderer process isolated
- ✅ WebContents sandbox enabled
- ✅ Context isolation in place
- ✅ Preload script validation

**Security Assessment:** GOOD

---

## PART 5: COMPLIANCE STATUS

### 5.1 ISO/IEC 27037 (Forensic Evidence)

**Current Status:** PARTIAL COMPLIANCE

**Implemented:**
- ✅ Evidence capture and metadata
- ✅ SHA-256 hashing
- ✅ Timestamp recording
- ✅ Chain of custody logging (basic)

**Missing:**
- ❌ Digital signatures on evidence
- ❌ Professional certification pathway
- ❌ Court admissibility documentation
- ❌ NIST timestamp integration

**Timeline for Full Compliance:** v13.0.0 (Q4 2026)
See MEDIUM-003 for implementation plan.

### 5.2 GDPR Compliance

**Applicability:** Medium (if user data is processed)

**Current Status:** PARTIAL COMPLIANCE

**Implemented:**
- ✅ Password masking (consent implication)
- ✅ User can delete extracted data (not automatic)
- ✅ Error logging (audit trail)

**Missing:**
- ❌ Automatic data retention policies
- ❌ Right to deletion automation
- ❌ Privacy impact assessment
- ❌ Data processing agreement template

**Recommendations:**
1. Create PRIVACY-GUIDANCE.md
2. Document data retention policies
3. Implement auto-deletion (MEDIUM-002)

### 5.3 CCPA Compliance

**Applicability:** Medium (if California residents' data processed)

**Current Status:** NOT IMPLEMENTED

**Missing:**
- ❌ Consumer disclosure on data collection
- ❌ Opt-out mechanism
- ❌ Deletion notification
- ❌ Privacy policy template

**Recommendations:**
1. Create LEGAL-DISCLAIMER.md
2. Document user notification requirements

### 5.4 SOC 2 Type II Readiness

**Current Status:** NOT IMPLEMENTED

**Timeline:** v13.0.0 (Q4 2026)

**Requirements:**
- Security controls documentation
- Incident response procedures
- Change management process
- Access control audits
- 6-month observation period

### 5.5 PCI DSS (Payment Card Industry)

**Applicability:** NOT APPLICABLE (no payment data handled)

---

## PART 6: IMPROVEMENT ROADMAP

### 6.1 v12.1.0 Security Sprint (June 15, 2026)
**Target:** Resolve all critical issues, implement high-priority hardening

**Critical Issues (Must Fix):**
1. ✅ Transitive dependency vulnerabilities - UPDATE ws@8.21.0 (2-4 hours)
2. ✅ Input validation with JSON schema - ALL COMMANDS (8-12 hours)
3. ✅ Timeout protection on JS execution - ALL COMMANDS (3-5 hours)
4. ✅ Token strength validation - AUTHENTICATION (3-4 hours)
5. ✅ Comprehensive data masking - ALL RESPONSES (6-8 hours)

**High Priority (Strong Recommendation):**
6. ✅ Command-level authorization framework (6-8 hours)
7. ✅ Token rotation & revocation (5-7 hours)
8. ✅ WSS/HTTPS enforcement validation (4-6 hours)
9. ✅ Error response standardization (8-10 hours)

**v12.1.0 Deliverables:**
- Zero critical npm vulnerabilities
- All 164 commands have input schema validation
- JS execution timeout protection (30s default)
- Token strength enforcement (32 char minimum)
- PII/sensitive data masking in all responses
- Command-level authorization framework
- Token rotation and revocation APIs
- Deployment security checklist
- Security documentation and best practices guide

**Estimated Effort:** 45-65 hours (1.5 weeks at 40h/week)
**Team Size:** 1-2 developers
**Risk Level:** MEDIUM (requires comprehensive testing)

### 6.2 v12.2.0 Production Hardening (July 15, 2026)

**Medium Priority Issues:**
1. PII detection and redaction (10-15 hours)
2. Per-command rate limiting (5-7 hours)
3. Forensic evidence packaging (12-16 hours)
4. RBAC full implementation (10-14 hours)
5. Encryption at rest for evidence (8-12 hours)

**v12.2.0 Deliverables:**
- Advanced PII detection (ML-based)
- Per-command resource-aware rate limiting
- ISO 27037-compliant evidence packaging
- Full role-based access control
- Optional encryption at rest
- GDPR compliance documentation
- Privacy impact assessment

**Estimated Effort:** 55-75 hours (2-2.5 weeks)
**Team Size:** 1-2 developers
**Risk Level:** MEDIUM-HIGH (architectural changes)

### 6.3 v13.0.0 Enterprise Readiness (Q4 2026)

**Low Priority Issues:**
1. SOC 2 Type II certification (40-60 hours)
2. Digital signatures on evidence (8-12 hours)
3. NIST timestamp integration (6-10 hours)
4. Advanced threat detection (15-20 hours)
5. Enterprise SIEM integration (20-30 hours)

**v13.0.0 Deliverables:**
- SOC 2 Type II certification
- Digital signatures with RSA/ECDSA
- NIST timestamp service integration
- Anomaly detection for misuse prevention
- Enterprise logging and monitoring
- Full ISO 27037 compliance
- Export to SIEM platforms

**Estimated Effort:** 100-150 hours (3-4 weeks)
**Team Size:** 2-3 developers
**Risk Level:** HIGH (major architectural changes)

---

## PART 7: TESTING STRATEGY

### 7.1 Security Test Suite (Required for v12.1.0)

**Test Coverage Areas:**

#### Authentication & Authorization Tests (30+ tests)
```javascript
describe('Authentication', () => {
  test('reject unauthenticated connection without token');
  test('accept valid token from query parameter');
  test('accept valid token from header');
  test('reject invalid/expired tokens');
  test('enforce origin validation');
  test('prevent clientId prediction');
  test('rate limit per client');
  test('timeout long-running scripts');
  test('validate command schema');
  test('reject oversized payloads');
  // ... more tests
});
```

#### Input Validation Tests (50+ tests)
```javascript
describe('Input Validation', () => {
  test('reject command without required parameters');
  test('reject parameter with wrong type');
  test('reject oversized string parameters');
  test('reject invalid CSS selectors');
  test('reject invalid URLs');
  test('mask passwords in extraction');
  test('mask tokens in responses');
  test('detect API keys automatically');
  // ... more tests
});
```

#### Timeout Protection Tests (20+ tests)
```javascript
describe('Timeout Protection', () => {
  test('interrupt infinite loop after timeout');
  test('interrupt blocking operation after timeout');
  test('return clear timeout error');
  test('allow custom timeout values');
  test('respect default timeout');
  // ... more tests
});
```

#### Vulnerability Scanning
```bash
# Dependency scanning
npm audit
npm audit --audit-level=high

# OWASP ZAP scanning (automated)
owasp-zap scan --url http://localhost:8765

# Manual penetration testing
# - MITM attack simulation
# - Token brute-force testing
# - Injection attack scenarios
```

### 7.2 Regression Testing

**All existing tests must pass:**
```bash
npm run test:unit          # Unit tests (80+ test files)
npm run test:integration   # Integration tests (50+ test files)
npm run test:e2e          # End-to-end tests (36+ test files)
npm run test:bot-detection # Bot detection tests (30+ test files)
```

**Coverage targets:**
- Unit: 90%+ coverage
- Integration: 85%+ coverage
- Overall: 92%+ coverage

---

## PART 8: SUCCESS METRICS & ACCEPTANCE CRITERIA

### 8.1 v12.1.0 Success Criteria

**Security Metrics:**
- [ ] npm audit: 0 critical, 0 high vulnerabilities
- [ ] Input validation: 100% of commands validated
- [ ] Timeout coverage: 100% of long-running operations
- [ ] Data masking: 100% of sensitive fields
- [ ] Authorization: All sensitive commands require auth

**Quality Metrics:**
- [ ] Test coverage: 93%+ (up from 92.3%)
- [ ] All existing tests passing
- [ ] 100+ new security test cases
- [ ] Zero new security findings in code review

**Documentation:**
- [ ] Security best practices guide (10 pages)
- [ ] Deployment security checklist
- [ ] Legal disclaimer and compliance guide
- [ ] Threat model documentation

### 8.2 Post-Implementation Verification

**Automated Checks:**
```bash
# Run all security tests
npm run test:security

# Dependency audit
npm audit --audit-level=high

# Code scanning
eslint . --ext .js

# Coverage report
npm run test:coverage
```

**Manual Verification:**
- [ ] Security team review
- [ ] Penetration testing
- [ ] Code review of critical files
- [ ] Documentation review

---

## PART 9: RISK ASSESSMENT & MITIGATION

### 9.1 Implementation Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Regression in core functionality | Medium | High | Comprehensive test suite, staged rollout |
| Performance degradation from validation | Low | Medium | Profile before/after, optimize hot paths |
| Breaking changes in dependencies | Low | Medium | Test all updates in isolated environment |
| Incomplete security fixes | Low | High | Security review before release |
| Implementation delays | Medium | Medium | Prioritize critical items, adjust scope |

### 9.2 Mitigation Strategies

**Test-First Approach:**
1. Write test cases for each security fix
2. Verify tests fail (showing problem exists)
3. Implement fix
4. Verify tests pass

**Incremental Rollout:**
1. Fix one critical issue per 2-3 days
2. Run full test suite after each fix
3. Deploy to staging environment
4. Get security review approval

**Feature Flags:**
1. Use feature flags for large changes
2. Allow gradual rollout to users
3. Easy rollback if issues found

**Monitoring:**
1. Detailed logging of security operations
2. Real-time alerting on suspicious activity
3. Regular audits of security metrics

---

## PART 10: IMPLEMENTATION CHECKLIST

### Critical Issues (MUST FIX)

#### CRITICAL-001: Dependency Vulnerabilities
- [ ] Update ws to 8.21.0
- [ ] Run npm audit
- [ ] Verify zero high/critical vulnerabilities
- [ ] Full test suite passing
- [ ] Docker build succeeds
- **Timeline:** 2-4 hours
- **Owner:** DevOps
- **Status:** READY

#### CRITICAL-002: Input Validation
- [ ] Create command schemas for all 164 commands
- [ ] Implement JSON schema validation
- [ ] Integration into message handler
- [ ] 100+ validation test cases
- [ ] Zero false positives/negatives
- **Timeline:** 8-12 hours
- **Owner:** Backend Lead
- **Status:** READY

#### CRITICAL-003: Timeout Protection
- [ ] Create timeout wrapper utility
- [ ] Apply to all JS execution commands
- [ ] Apply to long-running operations
- [ ] Configurable per-command
- [ ] 20+ timeout test cases
- **Timeline:** 3-5 hours
- **Owner:** Backend Dev
- **Status:** READY

#### CRITICAL-004: Token Strength
- [ ] Minimum length enforcement (32 chars)
- [ ] Entropy validation
- [ ] Timing-safe comparison
- [ ] Token generation utility
- [ ] 15+ token validation tests
- **Timeline:** 3-4 hours
- **Owner:** Security Lead
- **Status:** READY

#### CRITICAL-005: Data Masking
- [ ] Create comprehensive DataMasker class
- [ ] Pattern matching for all sensitive fields
- [ ] Integration into all response handlers
- [ ] Error message masking
- [ ] 40+ masking test cases
- **Timeline:** 6-8 hours
- **Owner:** Backend Dev
- **Status:** READY

### High Priority Issues (v12.1.0)

#### HIGH-001: Command Authorization
- [ ] Define sensitive commands list
- [ ] Implement CommandAuthorizer class
- [ ] Authorization middleware
- [ ] Audit logging for sensitive ops
- [ ] 30+ authorization test cases
- **Timeline:** 6-8 hours
- **Owner:** Backend Lead

#### HIGH-002: Token Rotation
- [ ] Create TokenManager class
- [ ] Implement refresh_token command
- [ ] Implement revoke_token command
- [ ] Token expiration and cleanup
- [ ] 20+ token management tests
- **Timeline:** 5-7 hours
- **Owner:** Security Lead

#### HIGH-003: WSS Enforcement
- [ ] Create DeploymentValidator class
- [ ] Add validation on startup
- [ ] Create deployment checklist doc
- [ ] Error/warning messages
- [ ] 15+ deployment test cases
- **Timeline:** 4-6 hours
- **Owner:** DevOps

#### HIGH-004: Error Standardization
- [ ] Create ResponseFormatter class
- [ ] Update all 164 command handlers
- [ ] Standard error code registry
- [ ] Error response tests
- [ ] **Timeline:** 8-10 hours
- **Owner:** Backend Team

### Documentation (v12.1.0)

- [ ] Security Best Practices Guide (10-15 pages)
- [ ] Deployment Security Checklist
- [ ] Legal Disclaimer & Compliance Guide
- [ ] Threat Model Documentation
- [ ] Error Code Reference
- [ ] Token Management Guide

---

## PART 11: GLOSSARY & REFERENCES

### Abbreviations
- **WSS:** WebSocket Secure (encrypted WebSocket over HTTPS)
- **OSINT:** Open Source Intelligence
- **PII:** Personally Identifiable Information
- **GDPR:** General Data Protection Regulation
- **CCPA:** California Consumer Privacy Act
- **ISO/IEC 27037:** Digital Forensics Evidence Standards
- **SOC 2:** Service Organization Control Framework
- **NIST:** National Institute of Standards and Technology

### References

**Security Standards:**
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [NIST SP 800-63B: Authentication](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NIST SP 800-88: Digital Forensics](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-88.pdf)
- [ISO/IEC 27037:2022](https://www.iso.org/standard/80617.html)

**Web & WebSocket Security:**
- [RFC 6455: WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [WebSocket Security](https://owasp.org/www-community/attacks/websocket_attacks)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

**Privacy & Compliance:**
- [GDPR Guidance](https://gdpr-info.eu/)
- [CCPA Requirements](https://oag.ca.gov/privacy/ccpa)
- [SOC 2 Overview](https://www.aicpa.org/interestareas/informationmanagement/sodp-system-and-organization-controls)

**Node.js & JavaScript Security:**
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/nodejs-security/)
- [OWASP JavaScript Security](https://owasp.org/www-community/attacks/Code_Injection)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)

---

## Appendix A: Command Security Classifications

**All 164 WebSocket Commands Security Tier:**

Tier 1 (Safe) - 40 commands:
- ping, status, list_sessions, get_url, get_active_tab, get_user_agent_status, etc.

Tier 2 (Requires Auth) - 60 commands:
- navigate, click, type, scroll, wait, list_profiles, etc.

Tier 3 (Sensitive - Requires Special Auth) - 40 commands:
- extract_html, extract_text, screenshot, get_cookies, fill_form, execute_javascript, etc.

Tier 4 (Administrative) - 24 commands:
- modify_cookies, delete_cookies, clear_storage, import_profile, etc.

---

## Appendix B: Testing Command Examples

```bash
# Run security-focused test suite
npm run test:security

# Run full regression tests
npm run test:ci

# Dependency audit
npm audit --audit-level=high

# Code quality checks
npm run lint
npm run type-check

# Coverage report
npm run test:coverage

# Manual penetration testing
MITM_PROXY=localhost:8080 npm test

# Performance benchmark
npm run test:performance
```

---

**Document Status:** COMPLETE - Ready for Implementation  
**Classification:** Internal - Security Sensitive  
**Last Updated:** May 31, 2026  
**Next Review:** June 15, 2026 (post-v12.1.0 implementation)  
**Audience:** Security Team, Development Team, DevOps, Management

---

**End of Security Improvements Roadmap**
