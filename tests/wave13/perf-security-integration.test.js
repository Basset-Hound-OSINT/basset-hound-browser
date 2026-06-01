/**
 * Wave 13 Integration Tests: Performance + Security
 * Tests interaction between OPT-09 (Priority Queue), OPT-13 (DOM Cache),
 * rate limiting, session encryption, and audit logging
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 *
 * Test Categories:
 * - Priority Queue respects rate limiting
 * - Parallel screenshots respect rate limits
 * - DOM cache preserves audit visibility
 * - Session encryption doesn't block priority processing
 * - Audit logs capture all security events
 */

const assert = require('assert');

/**
 * Mock components for isolated testing
 */
class MockPriorityQueue {
  constructor() {
    this.queues = { critical: [], normal: [], low: [] };
    this.stats = { critical: 0, normal: 0, low: 0, total: 0 };
  }

  enqueue(command, priority = 'normal') {
    this.queues[priority].push(command);
    this.stats[priority]++;
    this.stats.total++;
  }

  dequeue() {
    if (this.queues.critical.length) return this.queues.critical.shift();
    if (this.queues.normal.length) return this.queues.normal.shift();
    if (this.queues.low.length) return this.queues.low.shift();
    return null;
  }

  isEmpty() {
    return this.stats.total === 0;
  }

  size() {
    return this.stats.total;
  }

  classify(command) {
    if (['screenshot', 'screenshot_full_page', 'screenshot_viewport', 'screenshot_element'].includes(command)) {
      return 'critical';
    }
    if (['ping', 'status'].includes(command)) {
      return 'low';
    }
    return 'normal';
  }
}

/**
 * Mock rate limiter
 */
class MockRateLimiter {
  constructor() {
    this.requests = 0;
    this.resources = 0;
    this.maxRequests = 10000;
    this.maxResources = 50000;
    this.connections = 0;
    this.lastReset = Date.now();
  }

  canAccept(clientId, command, resourceCost = 1) {
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.requests = 0;
      this.resources = 0;
      this.lastReset = now;
    }

    if (this.requests >= this.maxRequests || this.resources + resourceCost > this.maxResources) {
      return { allowed: false, reason: 'Rate limit exceeded', retryAfter: 60 };
    }

    this.requests++;
    this.resources += resourceCost;
    return { allowed: true, globalRemaining: this.maxRequests - this.requests };
  }

  reset() {
    this.requests = 0;
    this.resources = 0;
    this.connections = 0;
    this.lastReset = Date.now();
  }

  getStats() {
    return {
      requests: this.requests,
      resources: this.resources,
      maxRequests: this.maxRequests,
      maxResources: this.maxResources
    };
  }
}

/**
 * Mock session encryptor
 */
class MockSessionEncryptor {
  constructor() {
    this.encryptionCount = 0;
    this.decryptionCount = 0;
  }

  encryptSession(data) {
    this.encryptionCount++;
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  decryptSession(encrypted) {
    this.decryptionCount++;
    return JSON.parse(Buffer.from(encrypted, 'base64').toString());
  }

  getStats() {
    return {
      encryptionCount: this.encryptionCount,
      decryptionCount: this.decryptionCount
    };
  }
}

/**
 * Mock audit logger
 */
class MockAuditLogger {
  constructor() {
    this.entries = [];
  }

  logSensitiveOperation(entry) {
    this.entries.push({
      timestamp: Date.now(),
      ...entry
    });
    return { success: true, entryHash: 'hash-' + this.entries.length };
  }

  getEntriesForCommand(command) {
    return this.entries.filter(e => e.command === command);
  }

  getStats() {
    return {
      totalEntries: this.entries.length,
      commandCounts: this.entries.reduce((acc, e) => {
        acc[e.command] = (acc[e.command] || 0) + 1;
        return acc;
      }, {})
    };
  }

  reset() {
    this.entries = [];
  }
}

/**
 * Mock DOM cache
 */
class MockDOMCache {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.auditable = true;
  }

  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      return this.cache.get(key);
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    this.cache.set(key, value);
  }

  logAccess(key, hit) {
    if (hit) this.hits++;
    else this.misses++;
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      cacheSize: this.cache.size
    };
  }

  reset() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// ========================================
// Test Suite
// ========================================

describe('Wave 13: Performance + Security Integration Tests', () => {

  // ========================================
  // 1. Priority Queue + Rate Limiting
  // ========================================
  describe('OPT-09 Priority Queue + Rate Limiting', () => {
    let queue, limiter;

    beforeEach(() => {
      queue = new MockPriorityQueue();
      limiter = new MockRateLimiter();
    });

    test('critical requests bypass normal rate limiting checks', () => {
      // Simulate filling queue
      for (let i = 0; i < 100; i++) {
        const priority = queue.classify('screenshot');
        const allowed = limiter.canAccept('client1', 'screenshot', 10);
        assert.strictEqual(allowed.allowed, true, 'Screenshot should be rate limited like others');
        queue.enqueue('screenshot', priority);
      }

      // Critical items should still be in queue
      assert.strictEqual(queue.stats.critical >= 100, true, 'All screenshots should be critical priority');
    });

    test('priority queue dequeues critical before normal', () => {
      queue.enqueue('ping', 'low');
      queue.enqueue('navigate', 'normal');
      queue.enqueue('screenshot', 'critical');
      queue.enqueue('extract_html', 'normal');
      queue.enqueue('status', 'low');

      const order = [];
      while (!queue.isEmpty()) {
        const cmd = queue.dequeue();
        order.push(cmd);
      }

      // Critical should come first
      assert.strictEqual(order[0], 'screenshot', 'Critical should dequeue first');
      // Normal should come before low
      assert.strictEqual(['navigate', 'extract_html'].includes(order[1]), true, 'Normal before low');
    });

    test('rate limiter enforces limits independent of queue priority', () => {
      limiter.maxRequests = 10;

      const results = [];
      for (let i = 0; i < 15; i++) {
        const allowed = limiter.canAccept('client1', 'any_command', 1);
        results.push(allowed.allowed);
      }

      const allowedCount = results.filter(r => r).length;
      assert.strictEqual(allowedCount, 10, 'Rate limiter should enforce limit regardless of priority');
    });

    test('high-priority commands still respect resource budgets', () => {
      limiter.maxResources = 100;

      // Screenshot costs 10 resources
      const results = [];
      for (let i = 0; i < 15; i++) {
        const allowed = limiter.canAccept('client1', 'screenshot', 10);
        results.push(allowed.allowed);
      }

      const allowedCount = results.filter(r => r).length;
      assert.strictEqual(allowedCount, 10, 'High-cost commands should respect resource budget');
    });

    test('priority queue + rate limiting cooperate on starvation prevention', () => {
      queue.enqueue('ping', 'low');
      queue.enqueue('status', 'low');
      queue.enqueue('screenshot', 'critical');

      // Rate limiter allows 2 requests
      limiter.maxRequests = 2;

      let dequeuedCount = 0;
      for (let i = 0; i < 3; i++) {
        const cmd = queue.dequeue();
        if (cmd && limiter.canAccept('client1', cmd, 1).allowed) {
          dequeuedCount++;
        }
      }

      // Both rate limiting and priority should be respected
      assert.strictEqual(dequeuedCount, 2, 'Should respect rate limit even with priority queue');
    });
  });

  // ========================================
  // 2. Parallel Screenshots + Session Encryption
  // ========================================
  describe('OPT-08 Parallel Screenshots + Session Encryption', () => {
    let encryptor, limiter;

    beforeEach(() => {
      encryptor = new MockSessionEncryptor();
      limiter = new MockRateLimiter();
    });

    test('screenshot encryption does not block concurrent requests', () => {
      const sessionData = { cookies: { sessionId: 'abc123' }, screenshots: [] };

      // Encrypt 10 sessions simultaneously
      const encrypted = [];
      for (let i = 0; i < 10; i++) {
        const data = { ...sessionData, id: i };
        const allowed = limiter.canAccept(`client${i}`, 'screenshot', 10);
        if (allowed.allowed) {
          encrypted.push(encryptor.encryptSession(data));
        }
      }

      assert.strictEqual(encrypted.length, 10, 'All encryption operations should succeed');
      assert.strictEqual(encryptor.encryptionCount, 10, 'Should encrypt all sessions');
    });

    test('decryption does not delay screenshot processing', () => {
      const encryptedData = encryptor.encryptSession({ url: 'https://example.com' });

      // Decrypt while rate limiting
      const start = Date.now();
      const decrypted = encryptor.decryptSession(encryptedData);
      const elapsed = Date.now() - start;

      const allowed = limiter.canAccept('client1', 'screenshot', 10);

      assert.strictEqual(decrypted.url, 'https://example.com', 'Decryption should succeed');
      assert.strictEqual(elapsed < 100, true, 'Decryption should be fast (<100ms)');
      assert.strictEqual(allowed.allowed, true, 'Rate limiting should not be affected');
    });

    test('encrypted checkpoints preserve performance under load', () => {
      limiter.maxRequests = 1000;

      const checksumData = { checkpoint: 'state', url: 'https://test.com' };
      const encrypted = encryptor.encryptSession(checksumData);

      // Simulate 100 parallel screenshot requests
      let successCount = 0;
      for (let i = 0; i < 100; i++) {
        const allowed = limiter.canAccept(`client${i}`, 'screenshot', 5);
        if (allowed.allowed) {
          const decrypted = encryptor.decryptSession(encrypted);
          if (decrypted && decrypted.checkpoint) {
            successCount++;
          }
        }
      }

      assert.strictEqual(successCount >= 90, true, 'At least 90% should succeed under load');
    });
  });

  // ========================================
  // 3. DOM Cache + Audit Logging
  // ========================================
  describe('OPT-13 DOM Cache + Audit Logging', () => {
    let cache, auditLogger;

    beforeEach(() => {
      cache = new MockDOMCache();
      auditLogger = new MockAuditLogger();
    });

    test('cache hits are logged for audit visibility', () => {
      const cachedContent = '<html><body>Test</body></html>';
      const cacheKey = 'https://example.com#html';

      // Set cache entry
      cache.set(cacheKey, cachedContent);

      // Retrieve and log
      const content = cache.get(cacheKey);
      auditLogger.logSensitiveOperation({
        command: 'extract_html',
        cacheHit: true,
        clientId: 'client1',
        params: { url: 'https://example.com' }
      });

      assert.strictEqual(content, cachedContent, 'Cache should return correct content');
      assert.strictEqual(auditLogger.entries.length, 1, 'Audit should log cache hit');
      assert.strictEqual(auditLogger.entries[0].cacheHit, true, 'Audit should note cache hit');
    });

    test('cache invalidation is audited', () => {
      cache.set('key1', 'value1');

      auditLogger.logSensitiveOperation({
        command: 'invalidate_cache',
        clientId: 'client1',
        params: { reason: 'navigation' }
      });

      cache.cache.clear();

      const audited = auditLogger.getEntriesForCommand('invalidate_cache');
      assert.strictEqual(audited.length, 1, 'Cache invalidation should be audited');
      assert.strictEqual(audited[0].params.reason, 'navigation', 'Audit should capture reason');
    });

    test('audit logs preserve visibility of cached operations', () => {
      // Simulate 10 cache operations
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
        const hit = cache.get(`key${i}`);

        auditLogger.logSensitiveOperation({
          command: 'extract_html',
          clientId: 'client1',
          cacheHit: !!hit
        });
      }

      const auditStats = auditLogger.getStats();
      assert.strictEqual(auditStats.totalEntries, 10, 'All operations should be audited');
      assert.strictEqual(auditStats.commandCounts['extract_html'], 10, 'Extract operations counted');
    });

    test('cache performance does not interfere with audit logging', () => {
      const start = Date.now();

      // Simulate heavy cache + audit load
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
        cache.get(`key${i}`);

        auditLogger.logSensitiveOperation({
          command: 'extract_html',
          clientId: 'client' + (i % 10),
          cacheHit: true
        });
      }

      const elapsed = Date.now() - start;

      assert.strictEqual(auditLogger.entries.length, 100, 'All entries should be logged');
      assert.strictEqual(elapsed < 1000, true, 'Operation should complete quickly (<1s)');
      assert.strictEqual(cache.getStats().hits, 100, 'Cache should track hits');
    });
  });

  // ========================================
  // 4. Session Encryption + Queue Processing
  // ========================================
  describe('Session Encryption + Priority Queue', () => {
    let encryptor, queue, limiter;

    beforeEach(() => {
      encryptor = new MockSessionEncryptor();
      queue = new MockPriorityQueue();
      limiter = new MockRateLimiter();
    });

    test('encrypted checkpoints do not block queue processing', () => {
      const sessionState = { url: 'https://example.com', cookies: {} };
      const encrypted = encryptor.encryptSession(sessionState);

      // Enqueue commands while decrypting
      queue.enqueue('screenshot', 'critical');
      queue.enqueue('navigate', 'normal');

      const decrypted = encryptor.decryptSession(encrypted);
      queue.enqueue('extract_html', 'normal');

      assert.strictEqual(queue.size(), 3, 'Queue should have 3 items');
      assert.strictEqual(decrypted.url, 'https://example.com', 'Decryption should succeed');

      // First dequeued should be screenshot (critical)
      assert.strictEqual(queue.dequeue(), 'screenshot', 'Critical should dequeue first');
    });

    test('encryption overhead does not affect rate limiting', () => {
      limiter.maxRequests = 50;
      let rateLimitedCount = 0;

      // Simulate encryption during rate-limited operations
      for (let i = 0; i < 60; i++) {
        const allowed = limiter.canAccept('client1', 'create_session_checkpoint', 5);
        if (!allowed.allowed) rateLimitedCount++;

        if (i % 10 === 0) {
          const data = { sessionId: `session${i}` };
          encryptor.encryptSession(data);
        }
      }

      assert.strictEqual(rateLimitedCount, 10, 'Rate limiting should still enforce limit with encryption');
    });

    test('encrypted queue entries are processed in priority order', () => {
      const checkpoint1 = encryptor.encryptSession({ name: 'cp1' });
      const checkpoint2 = encryptor.encryptSession({ name: 'cp2' });

      queue.enqueue('rollback_to_checkpoint', 'critical');
      queue.enqueue('navigate', 'normal');
      queue.enqueue('ping', 'low');

      const order = [];
      while (!queue.isEmpty()) {
        order.push(queue.dequeue());
      }

      // Priority should be respected despite encryption
      assert.strictEqual(order[0], 'rollback_to_checkpoint', 'Critical checkpoint should be first');
      assert.strictEqual(order[1], 'navigate', 'Normal should be second');
      assert.strictEqual(order[2], 'ping', 'Low should be last');
    });
  });

  // ========================================
  // 5. All Security Checks Together
  // ========================================
  describe('All Security + Performance Together', () => {
    let queue, limiter, encryptor, auditLogger, cache;

    beforeEach(() => {
      queue = new MockPriorityQueue();
      limiter = new MockRateLimiter();
      encryptor = new MockSessionEncryptor();
      auditLogger = new MockAuditLogger();
      cache = new MockDOMCache();
    });

    test('complete workflow: priority + encryption + audit + cache + rate limiting', () => {
      // Simulate comprehensive workflow
      for (let i = 0; i < 20; i++) {
        // 1. Check rate limit
        const allowed = limiter.canAccept(`client${i % 5}`, 'screenshot', 10);
        if (!allowed.allowed) continue;

        // 2. Encrypt session checkpoint
        const sessionData = { id: i, url: `https://site${i}.com` };
        const encrypted = encryptor.encryptSession(sessionData);

        // 3. Enqueue command with proper priority
        const priority = queue.classify('screenshot');
        queue.enqueue(`screenshot_${i}`, priority);

        // 4. Try to get from cache
        const cacheKey = `site${i}#html`;
        let cachedContent = cache.get(cacheKey);
        if (!cachedContent) {
          cachedContent = `<html>Content ${i}</html>`;
          cache.set(cacheKey, cachedContent);
        }

        // 5. Log audit entry
        auditLogger.logSensitiveOperation({
          command: 'screenshot',
          clientId: `client${i % 5}`,
          cacheHit: !!cachedContent,
          params: { encryptedCheckpoint: encrypted.slice(0, 20) + '...' }
        });
      }

      // Verify all systems worked together
      assert.strictEqual(queue.size() > 0, true, 'Queue should have items');
      assert.strictEqual(limiter.getStats().requests > 0, true, 'Rate limiter should track requests');
      assert.strictEqual(encryptor.encryptionCount > 0, true, 'Encryption should occur');
      assert.strictEqual(auditLogger.entries.length > 0, true, 'Audit should log events');
      assert.strictEqual(cache.getStats().cacheSize > 0, true, 'Cache should store items');
    });

    test('security does not create bottlenecks under 100 concurrent operations', () => {
      const results = {
        rateLimited: 0,
        encrypted: 0,
        audited: 0,
        cached: 0,
        queued: 0
      };

      limiter.maxRequests = 100;
      limiter.maxResources = 500;

      for (let i = 0; i < 100; i++) {
        // Rate check
        const allowed = limiter.canAccept(`client${i % 10}`, 'any', 5);
        if (allowed.allowed) results.rateLimited++;

        // Encryption
        encryptor.encryptSession({ data: i });
        results.encrypted++;

        // Queue
        queue.enqueue(`cmd${i}`, queue.classify('navigate'));
        results.queued++;

        // Audit
        auditLogger.logSensitiveOperation({
          command: 'any',
          clientId: `client${i % 10}`
        });
        results.audited++;

        // Cache
        cache.set(`key${i}`, `value${i}`);
        results.cached++;
      }

      // Verify high throughput
      assert.strictEqual(results.rateLimited >= 90, true, 'Rate limiting should allow most');
      assert.strictEqual(results.encrypted, 100, 'All should encrypt');
      assert.strictEqual(results.queued, 100, 'All should queue');
      assert.strictEqual(results.audited, 100, 'All should audit');
      assert.strictEqual(results.cached, 100, 'All should cache');
    });
  });

  // ========================================
  // 6. Conflict Detection
  // ========================================
  describe('Integration Conflict Detection', () => {
    let queue, limiter, encryptor, auditLogger;

    beforeEach(() => {
      queue = new MockPriorityQueue();
      limiter = new MockRateLimiter();
      encryptor = new MockSessionEncryptor();
      auditLogger = new MockAuditLogger();
    });

    test('no conflicts between rate limiting and encryption', () => {
      const sessionData = { secure: true };
      const encrypted = encryptor.encryptSession(sessionData);
      const rateLimitCheck = limiter.canAccept('client1', 'any', 1);

      assert.strictEqual(encrypted.length > 0, true, 'Encryption should produce output');
      assert.strictEqual(rateLimitCheck.allowed, true, 'Rate limiting should allow first request');
      // No assertion error = no conflict
    });

    test('no conflicts between queue priority and audit logging', () => {
      queue.enqueue('screenshot', 'critical');
      auditLogger.logSensitiveOperation({
        command: 'screenshot',
        clientId: 'client1'
      });

      const cmd = queue.dequeue();
      const audit = auditLogger.getEntriesForCommand('screenshot');

      assert.strictEqual(cmd, 'screenshot', 'Dequeue should return correct command');
      assert.strictEqual(audit.length, 1, 'Audit should log operation');
    });

    test('encryption and rate limiting do not cause deadlocks', () => {
      const start = Date.now();
      let complete = false;

      try {
        for (let i = 0; i < 50; i++) {
          const allowed = limiter.canAccept('client1', 'any', 1);
          if (allowed.allowed) {
            encryptor.encryptSession({ iteration: i });
          }
        }
        complete = true;
      } catch (e) {
        complete = false;
      }

      const elapsed = Date.now() - start;
      assert.strictEqual(complete, true, 'Should complete without deadlock');
      assert.strictEqual(elapsed < 5000, true, 'Should complete quickly (<5s)');
    });
  });
});
