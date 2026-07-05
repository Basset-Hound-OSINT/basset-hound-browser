/**
 * Integration tests for Multi-Site Session Tracking WebSocket commands
 *
 * Tests all 3 session tracking P0 commands with real-world scenarios
 */

const { registerSessionTrackingCommands } = require('../../websocket/commands/session-tracking-commands');

describe('Session Tracking WebSocket Commands Integration', () => {
  let mockServer;
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    mockServer = {
      commandHandlers: commandHandlers
    };

    registerSessionTrackingCommands(mockServer, null);
  });

  // ============================================================
  // 1. track_multi_site_session Command Tests
  // ============================================================
  describe('track_multi_site_session command', () => {
    test('should initialize multi-site session tracking', async () => {
      const result = await commandHandlers.track_multi_site_session({
        investigationId: 'INV-2024-001',
        sites: ['example.com', 'payment.example.com', 'account.example.com'],
        userId: 'investigator_001',
        sessionType: 'FORENSIC_CAPTURE'
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId.length).toBeGreaterThan(0);
      expect(result.startTime).toBeDefined();
      expect(result.sitesTracked).toBe(3);
      expect(result.status).toBe('TRACKING_ACTIVE');
    });

    test('should support different session types', async () => {
      const types = ['INVESTIGATION', 'FORENSIC_CAPTURE', 'SURVEILLANCE'];

      for (const type of types) {
        const result = await commandHandlers.track_multi_site_session({
          sites: ['site1.com', 'site2.com'],
          sessionType: type
        });

        expect(result.success).toBe(true);
        expect(result.sessionType).toBe(type);
      }
    });

    test('should track capture options', async () => {
      const result = await commandHandlers.track_multi_site_session({
        sites: ['site1.com'],
        captureOptions: {
          screenshotsEnabled: true,
          htmlEnabled: true,
          networkEnabled: true,
          compressionLevel: 9
        }
      });

      expect(result.success).toBe(true);
      expect(result.sitesTracked).toBe(1);
    });

    test('should include all tracked sites in response', async () => {
      const sites = ['site1.com', 'site2.com', 'site3.com', 'site4.com'];

      const result = await commandHandlers.track_multi_site_session({
        sites: sites
      });

      expect(result.sites).toEqual(sites);
      expect(result.sitesTracked).toBe(4);
    });

    test('should require sites parameter', async () => {
      const result = await commandHandlers.track_multi_site_session({
        investigationId: 'INV-001'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sites');
    });

    test('should require non-empty sites array', async () => {
      const result = await commandHandlers.track_multi_site_session({
        sites: []
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // 2. get_session_timeline Command Tests
  // ============================================================
  describe('get_session_timeline command', () => {
    test('should retrieve session timeline', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com', 'site2.com']
      });

      const result = await commandHandlers.get_session_timeline({
        sessionId: sessionResult.sessionId
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionResult.sessionId);
      expect(result.timeline).toBeDefined();
      expect(Array.isArray(result.timeline)).toBe(true);
      expect(result.stats).toBeDefined();
    });

    test('should include event statistics', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result = await commandHandlers.get_session_timeline({
        sessionId: sessionResult.sessionId
      });

      expect(result.stats.totalEvents).toBeGreaterThanOrEqual(0);
      expect(result.stats.eventsByType).toBeDefined();
      expect(result.stats.eventsBySite).toBeDefined();
      expect(result.stats.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    test('should filter timeline by site', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com', 'site2.com']
      });

      const result = await commandHandlers.get_session_timeline({
        sessionId: sessionResult.sessionId,
        filterBySite: 'site1.com'
      });

      expect(result.success).toBe(true);
      // All events should be from site1.com
      for (const event of result.timeline) {
        expect(event.site).toBe('site1.com');
      }
    });

    test('should filter timeline by event type', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result = await commandHandlers.get_session_timeline({
        sessionId: sessionResult.sessionId,
        filterByType: 'SESSION_START'
      });

      expect(result.success).toBe(true);
      // Filter may result in subset or empty
      for (const event of result.timeline) {
        expect(event.type).toBe('SESSION_START');
      }
    });

    test('should support time range filtering', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      const result = await commandHandlers.get_session_timeline({
        sessionId: sessionResult.sessionId,
        timeRange: {
          start: oneHourAgo.toISOString(),
          end: now.toISOString()
        }
      });

      expect(result.success).toBe(true);
    });

    test('should include metadata when requested', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        investigationId: 'INV-TEST-001',
        sites: ['site1.com'],
        userId: 'test_user'
      });

      const result = await commandHandlers.get_session_timeline({
        sessionId: sessionResult.sessionId,
        includeMetadata: true
      });

      expect(result.sessionMetadata).toBeDefined();
      expect(result.sessionMetadata.investigationId).toBe('INV-TEST-001');
      expect(result.sessionMetadata.userId).toBe('test_user');
    });

    test('should require sessionId parameter', async () => {
      const result = await commandHandlers.get_session_timeline({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId');
    });

    test('should handle non-existent session gracefully', async () => {
      const result = await commandHandlers.get_session_timeline({
        sessionId: 'non_existent_session_id'
      });

      expect(result.success).toBe(true);
      expect(result.timeline).toEqual([]);
    });
  });

  // ============================================================
  // 3. export_session_evidence_package Command Tests
  // ============================================================
  describe('export_session_evidence_package command', () => {
    test('should export session evidence package', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com', 'site2.com']
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId,
        format: 'JSON'
      });

      expect(result.success).toBe(true);
      expect(result.packageId).toBeDefined();
      expect(result.format).toBe('JSON');
      expect(result.sessionId).toBe(sessionResult.sessionId);
      expect(result.package).toBeDefined();
      expect(result.packageHash).toBeDefined();
      expect(result.exportedAt).toBeDefined();
    });

    test('should support multiple export formats', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const formats = ['JSON', 'ZIP', 'FORENSIC_ARCHIVE'];

      for (const format of formats) {
        const result = await commandHandlers.export_session_evidence_package({
          sessionId: sessionResult.sessionId,
          format: format
        });

        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
      }
    });

    test('should include package metadata', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        investigationId: 'INV-2024-TEST',
        sites: ['site1.com', 'site2.com'],
        userId: 'test_examiner'
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId
      });

      expect(result.package.metadata).toBeDefined();
      expect(result.package.metadata.investigationId).toBe('INV-2024-TEST');
      expect(result.package.metadata.userId).toBe('test_examiner');
      expect(result.package.metadata.sitesTracked).toBe(2);
    });

    test('should include timeline when requested', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId,
        includeTimeline: true
      });

      expect(result.package.timeline).toBeDefined();
      expect(Array.isArray(result.package.timeline)).toBe(true);
    });

    test('should exclude timeline when requested', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId,
        includeTimeline: false
      });

      expect(result.package.timeline).toBeDefined();
      expect(result.package.timeline.length).toBe(0);
    });

    test('should include analysis when requested', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com', 'site2.com']
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId,
        includeAnalysis: true
      });

      expect(result.package.analysis).toBeDefined();
      expect(result.package.analysis.eventSequence).toBeDefined();
      expect(result.package.analysis.siteTraversal).toBeDefined();
      expect(result.package.analysis.temporalDistribution).toBeDefined();
      expect(result.package.analysis.interactionPatterns).toBeDefined();
    });

    test('should provide package statistics', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId
      });

      expect(result.package.statistics).toBeDefined();
      expect(result.package.statistics.totalEvents).toBeGreaterThanOrEqual(0);
      expect(result.package.statistics.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(result.package.statistics.eventsByType).toBeDefined();
      expect(result.package.statistics.eventsBySite).toBeDefined();
      expect(result.package.statistics.eventsPerMinute).toBeGreaterThanOrEqual(0);
    });

    test('should support encryption', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId,
        encryptionKey: 'test_encryption_key_12345'
      });

      expect(result.success).toBe(true);
      expect(result.encrypted).toBe(true);
      expect(result.encryptionMethod).toBe('AES-256-GCM');
      expect(result.encryptedSize).toBeDefined();
      expect(result.encryptedSize).toBeGreaterThan(0);
    });

    test('should generate unique package IDs', async () => {
      const sessionResult = await commandHandlers.track_multi_site_session({
        sites: ['site1.com']
      });

      const result1 = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId
      });

      const result2 = await commandHandlers.export_session_evidence_package({
        sessionId: sessionResult.sessionId
      });

      expect(result1.packageId).not.toEqual(result2.packageId);
    });

    test('should require sessionId parameter', async () => {
      const result = await commandHandlers.export_session_evidence_package({
        format: 'JSON'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId');
    });
  });

  // ============================================================
  // Real-World Scenario Tests
  // ============================================================
  describe('Real-World Session Tracking Scenarios', () => {
    test('should track complete multi-site investigation workflow', async () => {
      // 1. Initialize session tracking
      const sessionInit = await commandHandlers.track_multi_site_session({
        investigationId: 'CASE-2024-9999',
        sites: [
          'suspect-store.example.com',
          'payment-processor.example.com',
          'shipping-provider.example.com',
          'social-platform.example.com'
        ],
        userId: 'detective_smith',
        sessionType: 'FORENSIC_CAPTURE',
        captureOptions: {
          screenshotsEnabled: true,
          htmlEnabled: true,
          networkEnabled: true,
          javascriptEnabled: true
        }
      });

      expect(sessionInit.success).toBe(true);
      expect(sessionInit.sitesTracked).toBe(4);

      const sessionId = sessionInit.sessionId;

      // 2. Retrieve session timeline
      const timelineResult = await commandHandlers.get_session_timeline({
        sessionId: sessionId,
        includeMetadata: true
      });

      expect(timelineResult.success).toBe(true);
      expect(timelineResult.sessionMetadata.investigationId).toBe('CASE-2024-9999');
      expect(timelineResult.sessionMetadata.userId).toBe('detective_smith');

      // 3. Get timeline for specific site
      const siteTimelineResult = await commandHandlers.get_session_timeline({
        sessionId: sessionId,
        filterBySite: 'suspect-store.example.com'
      });

      expect(siteTimelineResult.success).toBe(true);

      // 4. Get timeline for specific event type
      const eventTypeResult = await commandHandlers.get_session_timeline({
        sessionId: sessionId,
        filterByType: 'SESSION_START'
      });

      expect(eventTypeResult.success).toBe(true);

      // 5. Export complete evidence package with analysis
      const packageResult = await commandHandlers.export_session_evidence_package({
        sessionId: sessionId,
        format: 'FORENSIC_ARCHIVE',
        includeTimeline: true,
        includeMetadata: true,
        includeAnalysis: true
      });

      expect(packageResult.success).toBe(true);
      expect(packageResult.package.metadata.sitesTracked).toBe(4);
      expect(packageResult.package.analysis.siteTraversal.visitedSites.length).toBeGreaterThanOrEqual(0);
      expect(packageResult.package.statistics.totalEvents).toBeGreaterThanOrEqual(0);

      // 6. Export encrypted package
      const encryptedResult = await commandHandlers.export_session_evidence_package({
        sessionId: sessionId,
        format: 'ZIP',
        encryptionKey: 'case_evidence_key_12345',
        includeAnalysis: true
      });

      expect(encryptedResult.success).toBe(true);
      expect(encryptedResult.encrypted).toBe(true);
      expect(encryptedResult.encryptedSize).toBeGreaterThan(0);
    });
  });
});
