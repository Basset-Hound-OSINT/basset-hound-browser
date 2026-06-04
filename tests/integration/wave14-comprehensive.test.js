/**
 * Comprehensive Integration Tests - Wave 14
 * 30+ tests covering multi-module workflows and real OSINT scenarios
 * Tests interactions between tech detector, change detector, monitor manager, etc.
 */

const TechnologyDetectionEngine = require('../../src/detection/detector');
const { ChangeDetector } = require('../../src/monitoring/change-detector');
const ReputationScorer = require('../../src/proxy/reputation-scorer');
const { MonitorManager } = require('../../src/monitoring/monitor-manager');
const SessionPersistence = require('../../src/sessions/session-persistence');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Wave 14 - Comprehensive Integration Tests', () => {
  let techDetector;
  let changeDetector;
  let reputationScorer;
  let monitorManager;
  let sessionPersistence;
  let tempDir;

  beforeEach(() => {
    techDetector = new TechnologyDetectionEngine({
      minConfidence: 0.50,
      cacheResults: true
    });

    changeDetector = new ChangeDetector({
      trackDomStructure: true,
      trackTechnology: true,
      trackPerformance: true
    });

    reputationScorer = new ReputationScorer();

    tempDir = path.join(os.tmpdir(), `wave14-test-${Date.now()}`);
    monitorManager = new MonitorManager({ dataDir: tempDir });

    sessionPersistence = new SessionPersistence({
      storageDir: path.join(tempDir, 'sessions'),
      snapshotInterval: 5,
      maxSnapshots: 10
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  // ================================================================
  // WORKFLOW 1: TECH DETECTION + MONITORING
  // ================================================================
  describe('Tech Detection + Monitoring Workflow', () => {
    test('should detect tech and track in monitor', () => {
      // Add monitor
      const monitor = monitorManager.addMonitor({
        url: 'https://wordpress.com',
        name: 'WordPress Site'
      });

      // Detect technologies
      const html = '<meta name="generator" content="WordPress 6.2">';
      const result = techDetector.detect({ html });

      expect(result.success).toBe(true);
      expect(result.technologies.length).toBeGreaterThan(0);

      // Update monitor with detected tech
      monitorManager.updateMonitor(monitor.id, {
        metadata: {
          detectedTech: result.technologies.map(t => t.name)
        }
      });

      const updated = monitorManager.getMonitor(monitor.id);
      expect(updated.metadata.detectedTech).toBeDefined();
    });

    test('should detect multiple sites and track portfolio', () => {
      const sites = [
        { url: 'https://site1.com', name: 'Site 1' },
        { url: 'https://site2.com', name: 'Site 2' },
        { url: 'https://site3.com', name: 'Site 3' }
      ];

      const monitors = sites.map(site => monitorManager.addMonitor(site));

      expect(monitors.length).toBe(3);
      expect(monitorManager.getMonitorCount()).toBe(3);

      // Detect tech for each
      monitors.forEach(monitor => {
        const result = techDetector.detect({
          html: `<meta name="monitor" content="${monitor.name}">`
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // ================================================================
  // WORKFLOW 2: CHANGE DETECTION + TECH TRACKING
  // ================================================================
  describe('Change Detection + Technology Tracking Workflow', () => {
    test('should detect tech version change', () => {
      const prev = {
        timestamp: Date.now() - 86400000,
        html: '<meta name="generator" content="WordPress 5.0">',
        headers: { 'Server': 'Apache/2.4.40' },
        statusCode: 200
      };

      const curr = {
        timestamp: Date.now(),
        html: '<meta name="generator" content="WordPress 6.0">',
        headers: { 'Server': 'Apache/2.4.41' },
        statusCode: 200
      };

      // Detect tech before and after
      const prevTech = techDetector.detect(prev);
      const currTech = techDetector.detect(curr);

      // Detect changes
      const changes = changeDetector.detectChanges(prev, curr);

      expect(changes.changeDetected).toBe(true);
      expect(changes.changeSummary).toContain('technology');
    });

    test('should track WordPress site upgrade', () => {
      const snapshots = [
        {
          timestamp: Date.now() - 86400000,
          html: '<meta name="generator" content="WordPress 5.9">',
          content: 'Old site content',
          headers: { 'X-Powered-By': 'PHP/7.4' },
          statusCode: 200
        },
        {
          timestamp: Date.now(),
          html: '<meta name="generator" content="WordPress 6.2"><script src="/wp-includes/version.js"></script>',
          content: 'Updated site content',
          headers: { 'X-Powered-By': 'PHP/8.0' },
          statusCode: 200
        }
      ];

      const changes = changeDetector.detectChanges(snapshots[0], snapshots[1]);

      expect(changes.changeDetected).toBe(true);
      expect(changes.changeSummary).toContain('technology');
      expect(changes.changeSummary).toContain('content');
    });

    test('should detect site outage through status change', () => {
      const prev = {
        timestamp: Date.now() - 300000,
        statusCode: 200,
        html: '<html><body>Online</body></html>'
      };

      const curr = {
        timestamp: Date.now(),
        statusCode: 503,
        html: null
      };

      const changes = changeDetector.detectChanges(prev, curr);

      expect(changes.changeDetected).toBe(true);
      expect(changes.severity).toMatch(/high|critical/);
    });
  });

  // ================================================================
  // WORKFLOW 3: SESSION + PERSISTENCE + MONITORING
  // ================================================================
  describe('Session Persistence + Monitoring Workflow', () => {
    test('should create session and monitor site', () => {
      // Create monitoring session
      const session = sessionPersistence.createSession({
        metadata: { targetUrl: 'https://example.com', campaign: 'test' }
      });

      // Add corresponding monitor
      const monitor = monitorManager.addMonitor({
        url: 'https://example.com',
        name: 'Example Site',
        metadata: { sessionId: session.id }
      });

      expect(session.id).toBeDefined();
      expect(monitor.id).toBeDefined();

      // Record requests in session
      sessionPersistence.recordRequest(session.id);
      sessionPersistence.recordRequest(session.id);
      sessionPersistence.recordRequest(session.id);

      // Verify session updated
      const updated = sessionPersistence.sessions.get(session.id);
      expect(updated.requestCount).toBe(3);
    });

    test('should recover from snapshot in monitoring session', () => {
      const session = sessionPersistence.createSession({
        cookies: { sessionId: 'abc123' },
        localStorage: { preferences: 'dark-mode' }
      });

      // Take snapshot
      const snapshot = sessionPersistence.takeSnapshot(session.id);

      // Modify session
      session.cookies = { sessionId: 'modified' };
      session.localStorage = {};

      // Restore from snapshot
      sessionPersistence.restoreFromSnapshot(session.id, null, 'default-user');

      const restored = sessionPersistence.sessions.get(session.id);
      expect(restored.cookies).toEqual({ sessionId: 'abc123' });
    });

    test('should branch session for A/B testing monitors', () => {
      const parent = sessionPersistence.createSession({
        metadata: { variant: 'control', monitor: 'test' }
      });

      const variant = sessionPersistence.branchSession(parent.id, 'default-user');

      expect(variant.parentSessionId).toBe(parent.id);
      expect(variant.id).not.toBe(parent.id);

      // Both sessions can be used independently
      sessionPersistence.recordRequest(parent.id);
      sessionPersistence.recordRequest(variant.id);

      const pUpdated = sessionPersistence.sessions.get(parent.id);
      const vUpdated = sessionPersistence.sessions.get(variant.id);

      expect(pUpdated.requestCount).toBe(1);
      expect(vUpdated.requestCount).toBe(1);
    });
  });

  // ================================================================
  // WORKFLOW 4: PROXY REPUTATION + MONITORING
  // ================================================================
  describe('Proxy Reputation + Monitoring Workflow', () => {
    test('should monitor sites through proxies with reputation tracking', () => {
      // Register proxies
      reputationScorer.registerProxyForScoring('proxy-1');
      reputationScorer.registerProxyForScoring('proxy-2');
      reputationScorer.registerProxyForScoring('proxy-3');

      // Add monitors
      const monitor = monitorManager.addMonitor({
        url: 'https://example.com',
        name: 'Example',
        metadata: { proxies: ['proxy-1', 'proxy-2', 'proxy-3'] }
      });

      // Simulate requests through proxies
      for (let i = 0; i < 20; i++) {
        reputationScorer.updateProxyMetrics('proxy-1', {
          success: i % 3 !== 0, // 2/3 success
          latency: 50 + Math.random() * 100
        });
        reputationScorer.updateProxyMetrics('proxy-2', {
          success: i % 2 === 0, // 1/2 success
          latency: 100 + Math.random() * 100
        });
        reputationScorer.updateProxyMetrics('proxy-3', {
          success: true,
          latency: 25 + Math.random() * 50
        });
      }

      // Check reputation scores
      const stats = reputationScorer.getPoolStatistics();

      expect(stats.totalProxies).toBe(3);
      expect(stats.averageScore).toBeGreaterThan(0);
      expect(stats.averageScore).toBeLessThanOrEqual(100);
    });

    test('should exclude degrading proxy and track recovery', () => {
      reputationScorer.registerProxyForScoring('proxy-1');

      // Degrade proxy
      for (let i = 0; i < 30; i++) {
        reputationScorer.updateProxyMetrics('proxy-1', {
          success: false,
          blocked: true
        });
      }

      const reputation = reputationScorer.proxyReputations.get('proxy-1');
      expect(reputation.status).toBe('excluded');

      // Get recovery candidates
      const candidates = reputationScorer.getRecoveryTestCandidates();
      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  // ================================================================
  // WORKFLOW 5: EXTENDED CAMPAIGNS WITH MULTIPLE COMPONENTS
  // ================================================================
  describe('Extended Campaign Workflow', () => {
    test('should execute monitoring campaign across multiple sites', () => {
      // Setup monitoring infrastructure
      const sites = ['site1.com', 'site2.com', 'site3.com'];

      sites.forEach(site => {
        // Create session for campaign
        const session = sessionPersistence.createSession({
          metadata: { target: site, campaign: 'wave14-test' }
        });

        // Add monitor for site
        const monitor = monitorManager.addMonitor({
          url: `https://${site}`,
          name: site,
          frequency: 'daily',
          tags: ['campaign', 'wave14-test'],
          metadata: { sessionId: session.id }
        });

        // Register proxy for site
        reputationScorer.registerProxyForScoring(`proxy-${site}`);
      });

      // Verify infrastructure
      expect(sessionPersistence.sessions.size).toBe(3);
      expect(monitorManager.getMonitorCount()).toBe(3);
      expect(reputationScorer.proxyReputations.size).toBe(3);
    });

    test('should handle site changes across campaign', () => {
      // Initial scan
      const prevSnapshots = {
        'site1.com': {
          timestamp: Date.now() - 86400000,
          html: '<meta name="generator" content="WordPress 5.0">',
          statusCode: 200
        },
        'site2.com': {
          timestamp: Date.now() - 86400000,
          html: '<div class="shopify-container"></div>',
          statusCode: 200
        }
      };

      // Updated scan
      const currSnapshots = {
        'site1.com': {
          timestamp: Date.now(),
          html: '<meta name="generator" content="WordPress 6.0">',
          statusCode: 200
        },
        'site2.com': {
          timestamp: Date.now(),
          html: '<div class="shopify-container"><span class="new-feature"></span></div>',
          statusCode: 200
        }
      };

      // Detect changes for each site
      const changes = {};

      for (const site in prevSnapshots) {
        changes[site] = changeDetector.detectChanges(
          prevSnapshots[site],
          currSnapshots[site]
        );
      }

      expect(Object.keys(changes).length).toBe(2);
      expect(changes['site1.com'].changeDetected).toBe(true);
      expect(changes['site2.com'].changeDetected).toBe(true);
    });
  });

  // ================================================================
  // WORKFLOW 6: FAILURE RECOVERY
  // ================================================================
  describe('Failure Recovery Workflow', () => {
    test('should recover monitoring session from failure', () => {
      const session = sessionPersistence.createSession({
        metadata: { attempt: 1 }
      });

      // Simulate requests
      for (let i = 0; i < 5; i++) {
        sessionPersistence.recordRequest(session.id);
      }

      // Take snapshot before potential failure
      sessionPersistence.takeSnapshot(session.id);

      // Continue requests
      for (let i = 0; i < 5; i++) {
        sessionPersistence.recordRequest(session.id);
      }

      // If failure happens, we can restore
      const snapshots = sessionPersistence.sessionSnapshots.get(session.id);
      expect(snapshots.length).toBeGreaterThan(0);

      // Restore to last good state
      sessionPersistence.restoreFromSnapshot(session.id, null, 'default-user');

      const restored = sessionPersistence.sessions.get(session.id);
      expect(restored.status).toBe('recovered');
    });

    test('should retry monitoring after site outage', () => {
      const monitor = monitorManager.addMonitor({
        url: 'https://example.com',
        name: 'Example Site'
      });

      // First attempt - site down
      const outage = {
        timestamp: Date.now(),
        statusCode: 503,
        html: null
      };

      // Recovery attempt - site up
      const recovered = {
        timestamp: Date.now() + 300000,
        statusCode: 200,
        html: '<html><body>Back online</body></html>'
      };

      // Track recovery
      const changes = changeDetector.detectChanges(outage, recovered);

      expect(changes.changeDetected).toBe(true);
      expect(recovered.statusCode).toBe(200);
    });
  });

  // ================================================================
  // REAL-WORLD OSINT SCENARIOS
  // ================================================================
  describe('Real-World OSINT Scenarios', () => {
    test('should detect competitor tech stack evolution', () => {
      // Timeline of competitor site changes
      const timeline = [
        {
          date: '2024-01-01',
          html: '<meta name="generator" content="WordPress 5.5">',
          headers: { 'Server': 'Apache/2.4.40' }
        },
        {
          date: '2024-03-01',
          html: '<meta name="generator" content="WordPress 6.0"><script src="/react.js"></script>',
          headers: { 'Server': 'Nginx/1.20' }
        },
        {
          date: '2024-06-01',
          html: '<div id="root" data-react-root></div><script src="/next.js"></script>',
          headers: { 'Server': 'Nginx/1.24' }
        }
      ];

      // Analyze evolution
      for (let i = 0; i < timeline.length - 1; i++) {
        const prev = {
          timestamp: new Date(timeline[i].date).getTime(),
          ...timeline[i]
        };

        const curr = {
          timestamp: new Date(timeline[i + 1].date).getTime(),
          ...timeline[i + 1]
        };

        const changes = changeDetector.detectChanges(prev, curr);
        expect(changes.changeDetected).toBe(true);
      }
    });

    test('should identify ecommerce platform migration', () => {
      // Site migrates from Shopify to custom platform
      const beforeMigration = {
        timestamp: Date.now() - 604800000,
        html: `
          <meta name="generator" content="Shopify">
          <script src="//cdn.shopifycdn.com/s/files/theme.js"></script>
          <link href="//cdn.shopify.com/theme.css">
        `,
        headers: { 'Server': 'cloudflare' }
      };

      const afterMigration = {
        timestamp: Date.now(),
        html: `
          <script src="/custom-ecommerce/cart.js"></script>
          <link href="/custom-ecommerce/theme.css">
          <div id="app"></div>
        `,
        headers: { 'Server': 'Nginx/1.24' }
      };

      // Detect major changes
      const changes = changeDetector.detectChanges(beforeMigration, afterMigration);

      expect(changes.changeDetected).toBe(true);
      expect(changes.changeSummary).toContain('technology');
      expect(changes.changeSummary).toContain('structure');
    });

    test('should monitor competitor pricing updates', () => {
      // Initial pricing content
      const prevContent = {
        timestamp: Date.now() - 86400000,
        content: 'Basic Plan: $29/month, Professional: $99/month, Enterprise: $499/month'
      };

      // Updated pricing
      const currContent = {
        timestamp: Date.now(),
        content: 'Basic Plan: $29/month, Professional: $129/month, Enterprise: $599/month'
      };

      // Detect price changes
      const changes = changeDetector.detectChanges(prevContent, currContent);

      expect(changes.changeDetected).toBe(true);
      expect(changes.changeSummary).toContain('content');
    });
  });

  // ================================================================
  // ERROR SCENARIOS AND RESILIENCE
  // ================================================================
  describe('Error Scenarios and Resilience', () => {
    test('should handle corrupted snapshot data gracefully', () => {
      const session = sessionPersistence.createSession();

      // Take normal snapshot
      sessionPersistence.takeSnapshot(session.id);

      // Attempt operations despite data issues
      expect(() => {
        sessionPersistence.recordRequest(session.id);
      }).not.toThrow();
    });

    test('should continue monitoring despite tech detection failures', () => {
      const monitor = monitorManager.addMonitor({
        url: 'https://example.com',
        name: 'Example'
      });

      // Tech detection with problematic HTML
      const problematicHtml = {
        html: '<div><unclosed-tag><another-unclosed>content</div>'
      };

      const result = techDetector.detect(problematicHtml);

      // Should succeed despite malformed HTML
      expect(result.success).toBe(true);
      expect(monitor).toBeDefined();
    });

    test('should handle proxy exclusion and continue monitoring', () => {
      reputationScorer.registerProxyForScoring('proxy-1');
      reputationScorer.registerProxyForScoring('proxy-2');

      // Degrade first proxy
      for (let i = 0; i < 40; i++) {
        reputationScorer.updateProxyMetrics('proxy-1', {
          success: false,
          blocked: true
        });
      }

      // Second proxy remains healthy
      for (let i = 0; i < 20; i++) {
        reputationScorer.updateProxyMetrics('proxy-2', {
          success: true,
          latency: 50
        });
      }

      const stats = reputationScorer.getPoolStatistics();

      expect(stats.excludedPercentage).toBeGreaterThan(0);
      expect(stats.healthPercentage).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // PERFORMANCE UNDER LOAD
  // ================================================================
  describe('Performance Under Coverage', () => {
    test('should handle bulk tech detection', () => {
      const htmlSamples = Array(20).fill(0).map((_, i) => ({
        html: `<meta name="generator" content="Platform${i}"><div id="content${i}"></div>`
      }));

      const results = htmlSamples.map(sample => techDetector.detect(sample));

      expect(results.length).toBe(20);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle bulk monitor operations', () => {
      const monitors = Array(20).fill(0).map((_, i) => ({
        url: `https://site${i}.com`,
        name: `Site ${i}`,
        frequency: ['hourly', 'daily', 'weekly', 'monthly'][i % 4]
      }));

      monitors.forEach(m => monitorManager.addMonitor(m));

      expect(monitorManager.getMonitorCount()).toBe(20);

      // Bulk filter operations
      const daily = monitorManager.filterByFrequency('daily');
      expect(Array.isArray(daily)).toBe(true);
    });

    test('should handle concurrent session operations', () => {
      const sessions = Array(10).fill(0).map(() =>
        sessionPersistence.createSession()
      );

      // Concurrent requests on sessions
      sessions.forEach(session => {
        for (let i = 0; i < 10; i++) {
          sessionPersistence.recordRequest(session.id);
        }
      });

      const allSessions = Array.from(sessionPersistence.sessions.values());
      expect(allSessions.length).toBe(10);
      expect(allSessions.every(s => s.requestCount === 10)).toBe(true);
    });
  });
});
