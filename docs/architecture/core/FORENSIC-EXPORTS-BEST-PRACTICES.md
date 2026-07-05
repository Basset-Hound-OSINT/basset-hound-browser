# Forensic Exports - Security Best Practices & Performance Guidelines

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Security Best Practices](#security-best-practices)
2. [Data Protection](#data-protection)
3. [Performance Optimization](#performance-optimization)
4. [Compliance & Legal](#compliance--legal)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Production Checklist](#production-checklist)

---

## Security Best Practices

### 1. Secure WebSocket Connection

**Development Environment:**
```javascript
// ✗ NOT FOR PRODUCTION - Unencrypted
const ws = new WebSocket('ws://localhost:8765');
```

**Production Environment:**
```javascript
// ✓ PRODUCTION - Encrypted SSL/TLS
const ws = new WebSocket('wss://basset-hound.example.com:8765');
```

**Configuration:**
```bash
# Enable SSL/TLS for WebSocket
export ENABLE_SSL=true
export SSL_CERT_PATH=/etc/ssl/certs/basset-hound.crt
export SSL_KEY_PATH=/etc/ssl/private/basset-hound.key

docker run -d \
  -e ENABLE_SSL=true \
  -e SSL_CERT_PATH=/etc/ssl/certs/cert.pem \
  -e SSL_KEY_PATH=/etc/ssl/private/key.pem \
  -v /path/to/certs:/etc/ssl \
  -p 8765:8765 \
  basset-hound-browser:latest
```

### 2. Authentication & Authorization

**Enable API Token Authentication:**
```javascript
// Option 1: Query parameter
const token = 'your-api-token-here';
const ws = new WebSocket(`wss://basset-hound.example.com:8765?token=${token}`);

// Option 2: WebSocket header (in HTTP upgrade)
const ws = new WebSocket('wss://basset-hound.example.com:8765', {
  headers: {
    'Authorization': 'Bearer your-api-token-here'
  }
});

// Option 3: Authenticate after connection
ws.onopen = () => {
  ws.send(JSON.stringify({
    command: 'authenticate',
    token: 'your-api-token-here',
    id: 'auth_1'
  }));
};
```

**Generate Strong Tokens:**
```bash
# Generate random token (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Token Rotation Policy:**
```javascript
// Implement token rotation every 24-30 days
const tokenExpirationDays = 30;
const rotationDay = Math.floor(Math.random() * 30) + 1; // Random day

function shouldRotateToken(lastRotation) {
  const daysSinceRotation = (Date.now() - lastRotation) / (1000 * 60 * 60 * 24);
  return daysSinceRotation > tokenExpirationDays;
}
```

### 3. Request Validation

**Validate all user input:**
```javascript
function validateExportRequest(request) {
  const errors = [];
  
  // Validate command
  const validCommands = [
    'export_raw_html',
    'export_network_log',
    'export_device_ids',
    'modify_element'
  ];
  
  if (!validCommands.includes(request.command)) {
    errors.push('Invalid command');
  }
  
  // Validate selector (prevent injection)
  if (request.selector) {
    // Ensure selector is CSS-safe (no script injection)
    if (/<[^>]*script/i.test(request.selector)) {
      errors.push('Invalid selector: contains script');
    }
    
    // Limit selector length
    if (request.selector.length > 500) {
      errors.push('Selector too long (max 500 chars)');
    }
  }
  
  // Validate URL
  if (request.url) {
    try {
      const url = new URL(request.url);
      // Only allow http/https
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Invalid URL protocol');
      }
    } catch (e) {
      errors.push('Invalid URL format');
    }
  }
  
  // Validate numbers
  if (request.timeout) {
    if (typeof request.timeout !== 'number' || request.timeout < 1000 || request.timeout > 60000) {
      errors.push('Timeout must be between 1000-60000ms');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Usage
const validation = validateExportRequest(userRequest);
if (!validation.valid) {
  console.error('Invalid request:', validation.errors);
  return;
}
```

### 4. Rate Limiting

**Implement per-connection rate limiting:**
```javascript
class RateLimiter {
  constructor(maxRequests = 1000, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  isAllowed() {
    const now = Date.now();
    
    // Remove old requests outside window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if under limit
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    // Add new request
    this.requests.push(now);
    return true;
  }
  
  getStatus() {
    const now = Date.now();
    const recent = this.requests.filter(time => now - time < this.windowMs);
    
    return {
      requests: recent.length,
      maxRequests: this.maxRequests,
      percentage: (recent.length / this.maxRequests * 100).toFixed(1),
      timeToReset: Math.ceil((this.requests[0] + this.windowMs - now) / 1000)
    };
  }
}

// Usage
const limiter = new RateLimiter(1000, 60000); // 1000 per minute

function onWebSocketMessage(msg) {
  if (!limiter.isAllowed()) {
    console.error('Rate limit exceeded');
    return;
  }
  
  // Process message
}
```

---

## Data Protection

### 1. Sensitive Data Handling

**Never log sensitive information:**
```javascript
// ✗ WRONG - Logs contain password
console.log('User submission:', formData);
// Output: User submission: { email: 'user@example.com', password: 'secret123' }

// ✓ CORRECT - Sensitive fields removed
function sanitizeForLogging(data) {
  const sanitized = { ...data };
  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret',
    'creditCard', 'ssn', 'authorization'
  ];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

console.log('User submission:', sanitizeForLogging(formData));
// Output: User submission: { email: 'user@example.com', password: '[REDACTED]' }
```

**Automatically redact sensitive fields from exported data:**
```javascript
function redactSensitiveData(html) {
  // Remove password fields
  html = html.replace(/<input[^>]*type\s*=\s*["']password["'][^>]*>/gi, 
    '<!-- PASSWORD FIELD REDACTED -->');
  
  // Remove credit card patterns
  html = html.replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX');
  
  // Remove SSN patterns
  html = html.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX');
  
  // Remove email addresses (if desired)
  // html = html.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL REDACTED]');
  
  return html;
}
```

### 2. Secure Storage

**Encrypt sensitive exports:**
```javascript
const crypto = require('crypto');

class EncryptedExportStorage {
  constructor(encryptionKey) {
    this.key = Buffer.from(encryptionKey, 'hex');
  }
  
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
      algorithm: 'aes-256-cbc'
    };
  }
  
  decrypt(encrypted) {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
    
    let decrypted = decipher.update(encrypted.data, 'hex');
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return JSON.parse(decrypted.toString());
  }
}

// Usage
const storage = new EncryptedExportStorage(process.env.ENCRYPTION_KEY);

// Save encrypted export
const encryptedData = storage.encrypt(exportData);
fs.writeFileSync('export.encrypted.json', JSON.stringify(encryptedData));

// Load and decrypt
const loaded = JSON.parse(fs.readFileSync('export.encrypted.json'));
const decrypted = storage.decrypt(loaded);
```

### 3. Secure Deletion

**Securely delete sensitive files:**
```javascript
const fs = require('fs');
const crypto = require('crypto');

function secureDelete(filePath) {
  // Read file size
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  
  // Overwrite with random data 3 times
  for (let pass = 0; pass < 3; pass++) {
    const randomData = crypto.randomBytes(fileSize);
    fs.writeFileSync(filePath, randomData);
  }
  
  // Finally delete
  fs.unlinkSync(filePath);
  console.log(`Securely deleted: ${filePath}`);
}

// Usage
const exportFile = 'sensitive-export.json';
secureDelete(exportFile);
```

---

## Performance Optimization

### 1. Connection Pooling

**Reuse WebSocket connections:**
```javascript
class ConnectionPool {
  constructor(url, maxConnections = 5) {
    this.url = url;
    this.maxConnections = maxConnections;
    this.pool = [];
    this.queue = [];
  }
  
  async getConnection() {
    // Return existing connection if available
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    
    // Create new if under limit
    if (this.pool.length + this.activeConnections < this.maxConnections) {
      return this.createConnection();
    }
    
    // Wait for available connection
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  releaseConnection(ws) {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve(ws);
    } else {
      this.pool.push(ws);
    }
  }
  
  createConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.onopen = () => resolve(ws);
      ws.onerror = reject;
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }
  
  async executeCommand(command) {
    const ws = await this.getConnection();
    
    try {
      const result = await this.send(ws, command);
      return result;
    } finally {
      this.releaseConnection(ws);
    }
  }
  
  send(ws, command) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);
      
      const handler = (event) => {
        const response = JSON.parse(event.data);
        if (response.id === command.id) {
          clearTimeout(timeout);
          ws.removeEventListener('message', handler);
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error));
          }
        }
      };
      
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify(command));
    });
  }
}

// Usage
const pool = new ConnectionPool('wss://basset-hound.example.com:8765', 5);

// Execute commands using pool
const html = await pool.executeCommand({
  command: 'export_raw_html',
  id: 'html_1'
});
```

### 2. Batch Operations

**Execute multiple commands efficiently:**
```javascript
async function batchExportData(urls) {
  const results = [];
  const batchSize = 5;
  
  // Process in batches to control concurrency
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(url => captureUrl(url))
    );
    
    results.push(...batchResults);
    
    // Log progress
    console.log(`Processed ${Math.min(i + batchSize, urls.length)}/${urls.length} URLs`);
  }
  
  return results;
}

async function captureUrl(url) {
  const ws = new WebSocket('wss://basset-hound.example.com:8765');
  
  return new Promise(async (resolve, reject) => {
    ws.onopen = async () => {
      try {
        // Use batch_commands for multiple exports at once
        await send(ws, { command: 'navigate', url, id: 'nav_1' });
        await new Promise(r => setTimeout(r, 3000));
        
        const results = await send(ws, {
          command: 'batch_commands',
          commands: [
            { command: 'export_raw_html', params: { includeMetadata: true }, id: 'html_1' },
            { command: 'export_network_log', params: {}, id: 'net_1' },
            { command: 'export_device_ids', params: {}, id: 'device_1' }
          ],
          id: 'batch_1'
        });
        
        resolve({ url, data: results });
      } catch (error) {
        reject(error);
      } finally {
        ws.close();
      }
    };
    
    ws.onerror = reject;
  });
}
```

### 3. Response Caching

**Cache frequently accessed data:**
```javascript
class ExportCache {
  constructor(ttlMs = 60000) {
    this.cache = new Map();
    this.ttl = ttlMs;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  clear() {
    this.cache.clear();
  }
}

// Usage
const cache = new ExportCache(60000); // 1 minute TTL

async function getCachedExport(url) {
  const cacheKey = `html:${url}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('✓ Cache hit for', url);
    return cached;
  }
  
  // Fetch from server
  console.log('✗ Cache miss, fetching from server...');
  const result = await send(ws, {
    command: 'export_raw_html',
    includeMetadata: true,
    id: 'html_1'
  });
  
  // Store in cache
  cache.set(cacheKey, result.data);
  
  return result.data;
}
```

---

## Compliance & Legal

### 1. GDPR Compliance

**Before capturing any data:**
```javascript
/**
 * GDPR Checklist:
 * 
 * 1. User Consent
 *    - Do you have explicit user consent to capture data?
 *    - Is consent documented?
 * 
 * 2. Data Minimization
 *    - Are you capturing only necessary data?
 *    - Consider filtering exports to exclude non-essential information
 * 
 * 3. Purpose Limitation
 *    - Are you only using data for stated purpose?
 *    - Can you document the purpose?
 * 
 * 4. Data Security
 *    - Is data encrypted in transit (SSL/TLS)?
 *    - Is data encrypted at rest?
 *    - Are backups secured?
 * 
 * 5. Data Retention
 *    - How long are you keeping the data?
 *    - Do you have a deletion policy?
 * 
 * 6. Data Subject Rights
 *    - Can you provide data to the user on request?
 *    - Can you delete data on request?
 */

async function captureWithGDPRCompliance(url, userConsent) {
  // Step 1: Verify consent
  if (!userConsent) {
    throw new Error('Cannot proceed without user consent (GDPR Article 6)');
  }
  
  // Step 2: Log the consent
  logConsentRecord({
    timestamp: Date.now(),
    url: url,
    consentType: 'explicit',
    purpose: 'website_audit',
    retentionDays: 30
  });
  
  // Step 3: Capture data minimally
  const html = await send(ws, {
    command: 'export_raw_html',
    includeMetadata: true,
    id: 'html_1'
  });
  
  // Step 4: Redact personal data
  const redacted = redactPersonalData(html.data.html);
  
  // Step 5: Encrypt for storage
  const encrypted = encryptData(redacted);
  
  // Step 6: Set deletion timer (30 days)
  setDeletionTimer('export_' + Date.now(), 30 * 24 * 60 * 60 * 1000);
  
  return {
    url,
    capture: encrypted,
    consentRecorded: true,
    retentionPolicy: '30 days'
  };
}

function redactPersonalData(html) {
  // Remove email addresses
  html = html.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[EMAIL]');
  
  // Remove phone numbers
  html = html.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
  
  // Remove credit cards
  html = html.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  
  return html;
}
```

### 2. CCPA Compliance

**California Consumer Privacy Act requirements:**
```javascript
async function captureWithCCPACompliance(url, userId) {
  // Step 1: Provide notice
  console.log('INFO: Capturing data per CCPA notice provided at signup');
  
  // Step 2: Allow opt-out
  if (userHasOptedOut(userId)) {
    throw new Error('User has opted out of data collection (CCPA Section 1798.120)');
  }
  
  // Step 3: Capture data
  const data = await exportAllData(url);
  
  // Step 4: Document for right to deletion
  recordDataForDeletion(userId, {
    exportId: data.id,
    captureTime: Date.now(),
    categories: ['personal_information', 'commercial_information'],
    url: url
  });
  
  return data;
}

function recordDataForDeletion(userId, record) {
  // Store in database for easy retrieval
  // User can request deletion under CCPA Section 1798.100
  db.collection('ccpa_exports').insertOne({
    userId,
    ...record,
    canDelete: true
  });
}
```

### 3. Documentation & Audit Trail

**Maintain audit logs:**
```javascript
class AuditLogger {
  constructor() {
    this.logs = [];
  }
  
  logExport(details) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      action: 'export',
      user: details.user,
      url: details.url,
      dataTypes: details.dataTypes,
      purpose: details.purpose,
      consent: details.consent,
      retentionDays: details.retentionDays,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent
    });
  }
  
  generateReport(userId) {
    const userLogs = this.logs.filter(log => log.user === userId);
    return {
      userId,
      totalExports: userLogs.length,
      exports: userLogs,
      dataCollected: this.getDataCategories(userLogs),
      lastExport: userLogs[userLogs.length - 1]?.timestamp
    };
  }
  
  getDataCategories(logs) {
    const categories = new Set();
    logs.forEach(log => {
      log.dataTypes?.forEach(type => categories.add(type));
    });
    return Array.from(categories);
  }
}

// Usage
const auditLog = new AuditLogger();

auditLog.logExport({
  user: 'user@example.com',
  url: 'https://example.com',
  dataTypes: ['html', 'network_log', 'device_ids'],
  purpose: 'compliance_audit',
  consent: true,
  retentionDays: 30,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Generate report for user
const report = auditLog.generateReport('user@example.com');
console.log('Data collection report:', report);
```

---

## Monitoring & Alerting

### 1. Performance Monitoring

**Track key metrics:**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = [];
  }
  
  recordCommand(command, duration, success) {
    this.metrics.push({
      timestamp: Date.now(),
      command,
      duration,
      success,
      memory: process.memoryUsage()
    });
  }
  
  getStats(command, timeWindowMs = 3600000) {
    const now = Date.now();
    const relevant = this.metrics.filter(m => 
      m.command === command && 
      now - m.timestamp < timeWindowMs
    );
    
    if (relevant.length === 0) return null;
    
    const durations = relevant.map(m => m.duration);
    const successful = relevant.filter(m => m.success).length;
    
    return {
      totalRequests: relevant.length,
      successRate: (successful / relevant.length * 100).toFixed(2) + '%',
      avgDuration: (durations.reduce((a, b) => a + b) / durations.length).toFixed(0) + 'ms',
      minDuration: Math.min(...durations) + 'ms',
      maxDuration: Math.max(...durations) + 'ms',
      p95Duration: this.percentile(durations, 95) + 'ms',
      p99Duration: this.percentile(durations, 99) + 'ms'
    };
  }
  
  percentile(sorted, p) {
    const index = Math.ceil(sorted.length * (p / 100)) - 1;
    return sorted[index] || sorted[sorted.length - 1];
  }
}

// Usage
const monitor = new PerformanceMonitor();

const start = Date.now();
const result = await send(ws, {
  command: 'export_network_log',
  id: 'net_1'
});
const duration = Date.now() - start;

monitor.recordCommand('export_network_log', duration, result.success);

// Get stats
const stats = monitor.getStats('export_network_log');
console.log('export_network_log stats:', stats);
```

### 2. Error Alerting

**Set up alerts for errors:**
```javascript
class ErrorAlertSystem {
  constructor(alertThreshold = 5) {
    this.errorCounts = new Map();
    this.threshold = alertThreshold;
    this.alertHandlers = [];
  }
  
  recordError(errorType, message) {
    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);
    
    // Check if threshold exceeded
    if (count + 1 > this.threshold) {
      this.triggerAlert({
        type: errorType,
        count: count + 1,
        message,
        severity: this.calculateSeverity(count + 1)
      });
    }
  }
  
  calculateSeverity(count) {
    if (count > 50) return 'CRITICAL';
    if (count > 20) return 'HIGH';
    if (count > 10) return 'MEDIUM';
    return 'LOW';
  }
  
  triggerAlert(alert) {
    this.alertHandlers.forEach(handler => handler(alert));
  }
  
  onAlert(handler) {
    this.alertHandlers.push(handler);
  }
}

// Usage
const alerts = new ErrorAlertSystem(5);

// Slack notification
alerts.onAlert(async (alert) => {
  await fetch('https://hooks.slack.com/...', {
    method: 'POST',
    body: JSON.stringify({
      text: `⚠️ ${alert.severity}: ${alert.type}`,
      attachments: [{
        color: alert.severity === 'CRITICAL' ? 'danger' : 'warning',
        text: `${alert.count} errors: ${alert.message}`
      }]
    })
  });
});

// Record errors
try {
  // ... command execution ...
} catch (error) {
  alerts.recordError('network_export_failed', error.message);
}
```

---

## Production Checklist

Use this checklist before deploying to production:

- [ ] **Security**
  - [ ] SSL/TLS enabled (wss://)
  - [ ] API tokens configured and rotated
  - [ ] Input validation implemented
  - [ ] Rate limiting enabled
  - [ ] CORS properly configured
  - [ ] Security headers set

- [ ] **Data Protection**
  - [ ] Encryption at rest enabled
  - [ ] Encryption in transit (SSL/TLS) verified
  - [ ] Sensitive data redaction implemented
  - [ ] Audit logging enabled
  - [ ] Data retention policy defined
  - [ ] Secure deletion procedure documented

- [ ] **Performance**
  - [ ] Connection pooling configured
  - [ ] Response caching enabled
  - [ ] Compression working (70%+ reduction)
  - [ ] Load testing completed (200+ concurrent)
  - [ ] Performance metrics monitoring active
  - [ ] Scaling plan documented

- [ ] **Compliance**
  - [ ] GDPR compliance verified (if applicable)
  - [ ] CCPA compliance verified (if applicable)
  - [ ] User consent management implemented
  - [ ] Privacy policy updated
  - [ ] Data processing agreement signed
  - [ ] Legal review completed

- [ ] **Operations**
  - [ ] Monitoring and alerting configured
  - [ ] Error handling and recovery procedures documented
  - [ ] Backup and disaster recovery tested
  - [ ] Runbooks created for common issues
  - [ ] On-call rotation established
  - [ ] Incident response plan documented

- [ ] **Documentation**
  - [ ] API documentation complete
  - [ ] Error codes documented
  - [ ] Examples provided
  - [ ] Troubleshooting guide reviewed
  - [ ] Security guidelines documented
  - [ ] SLA defined and communicated

---

**Ready for production?** Run through the checklist above, then use the [Quick Start Guide](./FORENSIC-EXPORTS-QUICK-START.md) to onboard new users.
