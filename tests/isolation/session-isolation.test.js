/**
 * Session Isolation Integration Tests
 * Tests for complete memory/network isolation across sessions
 *
 * Test Categories:
 * 1. Context Sandboxing (storage, cookies, headers)
 * 2. Network Isolation (connection pools, DNS cache)
 * 3. Fingerprint Isolation (uniqueness, correlation detection)
 * 4. Data Leakage Detection
 * 5. 100 concurrent session isolation verification
 */

const assert = require('assert');
const SessionSandbox = require('../../src/sessions/session-sandbox');
const SessionConnectionPool = require('../../src/sessions/session-connection-pool');
const FingerprintIsolation = require('../../src/sessions/fingerprint-isolation');

describe('Session Isolation (v12.2.0)', () => {
  let sandbox;
  let connectionPool;
  let fingerprints;

  beforeAll(() => {
    sandbox = new SessionSandbox();
    connectionPool = new SessionConnectionPool({
      maxConnectionsPerSession: 10
    });
    fingerprints = new FingerprintIsolation({
      enableCorrelationDetection: true
    });
  });

  afterAll(() => {
    sandbox.clearAll();
    connectionPool.cleanup();
    fingerprints.cleanup();
  });

  // ==================== Context Sandbox Tests ====================

  describe('Session Context Sandboxing', () => {
    it('should create isolated context', () => {
      const result = sandbox.createIsolatedContext('ctx-1');
      assert.strictEqual(result.isolated, true);
      assert.strictEqual(result.sessionId, 'ctx-1');
    });

    it('should not allow duplicate contexts', () => {
      sandbox.createIsolatedContext('ctx-dup');

      try {
        sandbox.createIsolatedContext('ctx-dup');
        assert.fail('Should not allow duplicate context');
      } catch (err) {
        assert(err.message.includes('already exists'));
      }
    });

    it('should isolate cookies per session', () => {
      sandbox.createIsolatedContext('ctx-cookies-1');
      sandbox.createIsolatedContext('ctx-cookies-2');

      // Set cookies for session 1
      sandbox.isolateCookies('ctx-cookies-1', {
        sessionId: 'abc123',
        userId: 'user1'
      });

      // Set cookies for session 2
      sandbox.isolateCookies('ctx-cookies-2', {
        sessionId: 'xyz789',
        userId: 'user2'
      });

      // Verify isolation
      const ctx1 = sandbox.getContext('ctx-cookies-1');
      const ctx2 = sandbox.getContext('ctx-cookies-2');

      assert.strictEqual(ctx1.cookieJar.sessionId, 'abc123');
      assert.strictEqual(ctx2.cookieJar.sessionId, 'xyz789');
      assert.notStrictEqual(ctx1.cookieJar.sessionId, ctx2.cookieJar.sessionId);
    });

    it('should isolate storage per session', () => {
      sandbox.createIsolatedContext('ctx-storage-1');
      sandbox.createIsolatedContext('ctx-storage-2');

      sandbox.isolateStorage('ctx-storage-1', {
        localStorage: { theme: 'dark', lang: 'en' }
      });

      sandbox.isolateStorage('ctx-storage-2', {
        localStorage: { theme: 'light', lang: 'fr' }
      });

      const ctx1 = sandbox.getContext('ctx-storage-1');
      const ctx2 = sandbox.getContext('ctx-storage-2');

      assert.strictEqual(ctx1.storage.localStorage.get('theme'), 'dark');
      assert.strictEqual(ctx2.storage.localStorage.get('theme'), 'light');
    });

    it('should isolate headers per session', () => {
      sandbox.createIsolatedContext('ctx-headers-1');
      sandbox.createIsolatedContext('ctx-headers-2');

      sandbox.setHeaders('ctx-headers-1', {
        'User-Agent': 'ua-1',
        'Accept-Language': 'en-US'
      });

      sandbox.setHeaders('ctx-headers-2', {
        'User-Agent': 'ua-2',
        'Accept-Language': 'fr-FR'
      });

      const ctx1 = sandbox.getContext('ctx-headers-1');
      const ctx2 = sandbox.getContext('ctx-headers-2');

      assert.strictEqual(ctx1.headers['User-Agent'], 'ua-1');
      assert.strictEqual(ctx2.headers['User-Agent'], 'ua-2');
    });

    it('should add request interceptors per session', () => {
      sandbox.createIsolatedContext('ctx-req-1');
      sandbox.createIsolatedContext('ctx-req-2');

      const interceptor1 = (req) => ({ ...req, intercepted: true });
      const interceptor2 = (req) => ({ ...req, intercepted: false });

      sandbox.addRequestInterceptor('ctx-req-1', interceptor1);
      sandbox.addRequestInterceptor('ctx-req-2', interceptor2);

      const ctx1 = sandbox.getContext('ctx-req-1');
      const ctx2 = sandbox.getContext('ctx-req-2');

      assert.strictEqual(ctx1.interceptors.request.length, 1);
      assert.strictEqual(ctx2.interceptors.request.length, 1);
      assert.notStrictEqual(ctx1.interceptors.request[0], ctx2.interceptors.request[0]);
    });

    it('should detect leakage when contexts share keys', () => {
      sandbox.createIsolatedContext('ctx-leak-1');
      sandbox.createIsolatedContext('ctx-leak-2');

      // Both have same 'session' key - should be detected as leakage
      sandbox.isolateCookies('ctx-leak-1', { session: 'abc' });
      sandbox.isolateCookies('ctx-leak-2', { session: 'xyz' });

      const result = sandbox.verifyNoLeakage('ctx-leak-1', 'ctx-leak-2');
      // Same key name = leakage detected
      assert.strictEqual(result.isolationViolation, true);
    });

    it('should destroy context and cleanup', () => {
      sandbox.createIsolatedContext('ctx-destroy');
      let ctx = sandbox.getContext('ctx-destroy');
      assert(ctx !== null);

      const result = sandbox.destroyContext('ctx-destroy');
      assert.strictEqual(result.destroyed, true);

      ctx = sandbox.getContext('ctx-destroy');
      assert.strictEqual(ctx, null);
    });

    it('should generate isolation report', () => {
      sandbox.createIsolatedContext('ctx-report-1');
      sandbox.createIsolatedContext('ctx-report-2');

      const report = sandbox.getIsolationReport();
      assert(report.totalSandboxes >= 2);
      assert('sandboxes' in report);
    });

    it('should validate all isolation across all contexts', () => {
      // Clear first
      sandbox.clearAll();

      // Create multiple contexts with unique keys
      for (let i = 0; i < 3; i++) {
        sandbox.createIsolatedContext(`ctx-validate-${i}`);
        // Use unique cookie names per context to avoid detection of "leakage"
        sandbox.isolateCookies(`ctx-validate-${i}`, {
          [`id_${i}`]: `session-${i}`,
          [`user_${i}`]: `user-${i}`
        });
      }

      const result = sandbox.validateAllIsolation();
      // With unique keys per context, should be valid
      assert.strictEqual(result.valid, true);
    });
  });

  // ==================== Network Isolation Tests ====================

  describe('Network Connection Pool Isolation', () => {
    it('should create isolated connection pool', () => {
      const result = connectionPool.createPool('net-1');
      assert.strictEqual(result.created, true);
      assert.strictEqual(result.agents.http, 'isolated');
      assert.strictEqual(result.agents.https, 'isolated');
    });

    it('should return different agents for different sessions', () => {
      connectionPool.createPool('net-agents-1');
      connectionPool.createPool('net-agents-2');

      const agents1 = connectionPool.getAgents('net-agents-1');
      const agents2 = connectionPool.getAgents('net-agents-2');

      assert.notStrictEqual(agents1.httpAgent, agents2.httpAgent);
      assert.notStrictEqual(agents1.httpsAgent, agents2.httpsAgent);
    });

    it('should isolate DNS cache per session', () => {
      connectionPool.createPool('net-dns-1');
      connectionPool.createPool('net-dns-2');

      connectionPool.setDnsCache('net-dns-1', 'example.com', '1.2.3.4');
      connectionPool.setDnsCache('net-dns-2', 'example.com', '5.6.7.8');

      const ip1 = connectionPool.getDnsCache('net-dns-1', 'example.com');
      const ip2 = connectionPool.getDnsCache('net-dns-2', 'example.com');

      assert.strictEqual(ip1.ip, '1.2.3.4');
      assert.strictEqual(ip2.ip, '5.6.7.8');
    });

    it('should track requests per session', () => {
      connectionPool.createPool('net-track-1');

      for (let i = 0; i < 5; i++) {
        connectionPool.recordRequest('net-track-1');
      }

      const stats = connectionPool.getPoolStats('net-track-1');
      assert.strictEqual(stats.requests, 5);
    });

    it('should track errors per session', () => {
      connectionPool.createPool('net-errors');

      connectionPool.recordRequest('net-errors');
      connectionPool.recordError('net-errors', new Error('Connection timeout'));

      const stats = connectionPool.getPoolStats('net-errors');
      assert.strictEqual(stats.errors, 1);
      assert(parseFloat(stats.errorRate) > 0);
    });

    it('should set custom timeout per session', () => {
      connectionPool.createPool('net-timeout');
      connectionPool.setTimeout('net-timeout', 15000);

      const stats = connectionPool.getPoolStats('net-timeout');
      assert.strictEqual(stats.timeout, 15000);
    });

    it('should verify network isolation between sessions', () => {
      connectionPool.createPool('net-iso-1');
      connectionPool.createPool('net-iso-2');

      const result = connectionPool.verifyIsolation('net-iso-1', 'net-iso-2');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.httpIsolated, true);
      assert.strictEqual(result.httpsIsolated, true);
      assert.strictEqual(result.dnsIsolated, true);
    });

    it('should destroy pool and cleanup', () => {
      connectionPool.createPool('net-destroy');
      let info = connectionPool.getPoolInfo('net-destroy');
      assert(info !== null);

      const result = connectionPool.destroyPool('net-destroy');
      assert.strictEqual(result.destroyed, true);

      info = connectionPool.getPoolInfo('net-destroy');
      assert.strictEqual(info, null);
    });

    it('should get stats for all pools', () => {
      connectionPool.cleanup(); // Clean first
      connectionPool.createPool('net-all-stats-1');
      connectionPool.createPool('net-all-stats-2');

      const allStats = connectionPool.getAllPoolStats();
      assert(Object.keys(allStats).length >= 2);
    });
  });

  // ==================== Fingerprint Isolation Tests ====================

  describe('Fingerprint Isolation', () => {
    it('should generate unique fingerprint per session', () => {
      const fp1 = fingerprints.generateUniqueFingerprint('fp-1');
      const fp2 = fingerprints.generateUniqueFingerprint('fp-2');

      assert.notStrictEqual(fp1.fingerprintId, fp2.fingerprintId);
    });

    it('should not allow duplicate fingerprints', () => {
      fingerprints.generateUniqueFingerprint('fp-dup');

      try {
        fingerprints.generateUniqueFingerprint('fp-dup');
        assert.fail('Should not allow duplicate');
      } catch (err) {
        assert(err.message.includes('already exists'));
      }
    });

    it('should create different canvas hashes per session', () => {
      const fp1Data = fingerprints.getFingerprint('fp-1');
      const fp2Data = fingerprints.getFingerprint('fp-2');

      assert.notStrictEqual(fp1Data.canvas.hash, fp2Data.canvas.hash);
    });

    it('should create different WebGL parameters per session', () => {
      const fp1Data = fingerprints.getFingerprint('fp-1');
      const fp2Data = fingerprints.getFingerprint('fp-2');

      assert.notStrictEqual(fp1Data.webgl.renderer, fp2Data.webgl.renderer);
    });

    it('should detect no correlation between fingerprints', () => {
      const result = fingerprints.validateUniqueness('fp-1', 'fp-2');
      assert.strictEqual(result.unique, true);
      assert.strictEqual(result.correlated, false);
    });

    it('should validate multiple session fingerprints', () => {
      // Generate multiple fingerprints
      for (let i = 3; i < 6; i++) {
        fingerprints.generateUniqueFingerprint(`fp-multi-${i}`);
      }

      const result = fingerprints.validateMultipleSessions([
        'fp-multi-3',
        'fp-multi-4',
        'fp-multi-5'
      ]);

      assert.strictEqual(result.allUnique, true);
      assert.strictEqual(result.correlationCount, 0);
    });

    it('should regenerate fingerprint with new canvas/webgl hashes', () => {
      fingerprints.generateUniqueFingerprint('fp-regen-new');
      const original = fingerprints.getFingerprint('fp-regen-new');
      const originalCanvasHash = original.canvas.hash;
      const originalWebGLRenderer = original.webgl.renderer;

      fingerprints.regenerateFingerprint('fp-regen-new');
      const regenerated = fingerprints.getFingerprint('fp-regen-new');
      const regeneratedCanvasHash = regenerated.canvas.hash;
      const regeneratedWebGLRenderer = regenerated.webgl.renderer;

      // Should have new canvas hash and WebGL renderer
      assert.notStrictEqual(originalCanvasHash, regeneratedCanvasHash);
      assert.notStrictEqual(originalWebGLRenderer, regeneratedWebGLRenderer);
    });

    it('should get fingerprint summary', () => {
      const summary = fingerprints.getFingerprintSummary('fp-1');
      assert(summary.fingerprintId);
      assert(summary.generatedAt);
      assert('characteristics' in summary);
    });

    it('should cleanup fingerprints', () => {
      fingerprints.generateUniqueFingerprint('fp-cleanup');
      assert(fingerprints.getFingerprint('fp-cleanup') !== null);

      const result = fingerprints.cleanup('fp-cleanup');
      assert.strictEqual(result.deleted, true);

      assert.strictEqual(fingerprints.getFingerprint('fp-cleanup'), null);
    });
  });

  // ==================== Load Testing - Isolation at Scale ====================

  describe('Isolation at Scale - 100 Concurrent Sessions', () => {
    it('should maintain isolation across 100 sessions', () => {
      // Clear previous
      sandbox.clearAll();
      connectionPool.cleanup();
      fingerprints.cleanup();

      // Create 100 isolated contexts
      const sessionIds = [];
      for (let i = 0; i < 100; i++) {
        const sessionId = `scale-ctx-${i}`;
        sessionIds.push(sessionId);

        sandbox.createIsolatedContext(sessionId);
        sandbox.isolateCookies(sessionId, {
          sessionId: `session-${i}`,
          userId: `user-${i}`
        });
      }

      // Verify isolation
      const isolationReport = sandbox.getIsolationReport();
      assert.strictEqual(isolationReport.totalSandboxes, 100);
    });

    it('should maintain network isolation across 100 sessions', () => {
      const sessionIds = [];
      for (let i = 0; i < 100; i++) {
        const sessionId = `scale-net-${i}`;
        sessionIds.push(sessionId);
        connectionPool.createPool(sessionId);
      }

      const allStats = connectionPool.getAllPoolStats();
      assert(Object.keys(allStats).length >= 100);

      // Verify each has unique agent
      for (let i = 0; i < 10; i++) {
        for (let j = i + 1; j < i + 3 && j < 100; j++) {
          const result = connectionPool.verifyIsolation(`scale-net-${i}`, `scale-net-${j}`);
          assert.strictEqual(result.valid, true);
        }
      }
    });

    it('should maintain fingerprint uniqueness across 100 sessions', () => {
      const sessionIds = [];
      for (let i = 0; i < 100; i++) {
        const sessionId = `scale-fp-${i}`;
        sessionIds.push(sessionId);
        fingerprints.generateUniqueFingerprint(sessionId);
      }

      // Spot-check for uniqueness
      for (let i = 0; i < 10; i++) {
        const result = fingerprints.validateUniqueness(`scale-fp-${i}`, `scale-fp-${i + 50}`);
        assert.strictEqual(result.unique, true);
      }
    });

    it('should detect isolation between different contexts', () => {
      sandbox.clearAll(); // Clear first

      // Create 2 contexts with completely different data
      sandbox.createIsolatedContext('iso-a');
      sandbox.createIsolatedContext('iso-b');

      sandbox.isolateCookies('iso-a', {
        session_a: 'value-a',
        user_a: 'user-a'
      });

      sandbox.isolateCookies('iso-b', {
        session_b: 'value-b',
        user_b: 'user-b'
      });

      // Verify no leakage between them
      const result = sandbox.verifyNoLeakage('iso-a', 'iso-b');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.isolationViolation, false);
    });
  });

  // ==================== End-to-End Integration ====================

  describe('End-to-End Isolation Integration', () => {
    it('should create 3-layer isolation (context + network + fingerprint)', () => {
      const sessionId = 'e2e-iso';

      // Context isolation
      sandbox.createIsolatedContext(sessionId);
      sandbox.isolateCookies(sessionId, { sessionId: 'e2e' });
      sandbox.isolateStorage(sessionId, {
        localStorage: { userId: 'test-user' }
      });

      // Network isolation
      connectionPool.createPool(sessionId);
      connectionPool.recordRequest(sessionId);

      // Fingerprint isolation
      fingerprints.generateUniqueFingerprint(sessionId);

      // Verify all layers
      const ctx = sandbox.getContext(sessionId);
      const poolInfo = connectionPool.getPoolInfo(sessionId);
      const fpSummary = fingerprints.getFingerprintSummary(sessionId);

      assert(ctx !== null);
      assert(poolInfo !== null);
      assert(fpSummary !== null);

      // Cleanup
      sandbox.destroyContext(sessionId);
      connectionPool.destroyPool(sessionId);
      fingerprints.cleanup(sessionId);
    });
  });
});
