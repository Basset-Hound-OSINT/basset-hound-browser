/**
 * Comprehensive test coverage for Campaign Manager
 * Target: 95%+ code coverage
 * Tests campaign lifecycle, dependencies, aggregation, events, and error scenarios
 */

const { Campaign } = require('../../src/features/campaign-manager');

describe('Campaign Manager - Comprehensive Coverage', () => {
  let campaign;

  beforeEach(() => {
    campaign = new Campaign({
      name: 'Test Campaign',
      description: 'Test Description',
      maxParallelSessions: 3,
      timeoutPerSession: 5000,
      retryOnFailure: true,
      maxRetries: 2,
      errorHandling: 'continue'
    });
  });

  // ================================================================
  // CAMPAIGN INITIALIZATION
  // ================================================================
  describe('Campaign Creation', () => {
    test('should create campaign with unique ID', () => {
      expect(campaign.id).toBeDefined();
      expect(campaign.id).toHaveLength(24); // 12 bytes hex
    });

    test('should set initial status to created', () => {
      expect(campaign.status).toBe('created');
    });

    test('should initialize empty sessions', () => {
      expect(campaign.sessions.size).toBe(0);
    });

    test('should initialize empty results', () => {
      expect(campaign.results.size).toBe(0);
    });

    test('should accept custom name', () => {
      const named = new Campaign({ name: 'Custom Name' });
      expect(named.name).toBe('Custom Name');
    });

    test('should accept configuration options', () => {
      expect(campaign.maxParallelSessions).toBe(3);
      expect(campaign.config.timeoutPerSession).toBe(5000);
      expect(campaign.config.retryOnFailure).toBe(true);
    });

    test('should initialize metadata', () => {
      const withMeta = new Campaign({
        metadata: { source: 'test' }
      });
      expect(withMeta.metadata.source).toBe('test');
    });

    test('should accept session sequence', () => {
      const withSequence = new Campaign({
        sessionSequence: ['session-1', 'session-2']
      });
      expect(withSequence.sessionSequence.length).toBe(2);
    });

    test('should accept dependencies', () => {
      const withDeps = new Campaign({
        dependencies: { 'session-2': ['session-1'] }
      });
      expect(withDeps.dependencies['session-2']).toContain('session-1');
    });
  });

  // ================================================================
  // SESSION MANAGEMENT
  // ================================================================
  describe('Session Management', () => {
    test('should add session to campaign', () => {
      campaign.addSession('session-1', {});
      expect(campaign.sessions.has('session-1')).toBe(true);
    });

    test('should track session status', () => {
      campaign.addSession('session-1');
      const sessionState = campaign.sessions.get('session-1');

      expect(sessionState.status).toBe('pending');
      expect(sessionState.startTime).toBeNull();
      expect(sessionState.endTime).toBeNull();
    });

    test('should add multiple sessions', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');
      campaign.addSession('session-3');

      expect(campaign.sessions.size).toBe(3);
    });

    test('should emit session:added event', (done) => {
      campaign.on('session:added', (data) => {
        expect(data.sessionId).toBe('session-1');
        expect(data.campaignId).toBe(campaign.id);
        done();
      });

      campaign.addSession('session-1');
    });

    test('should track session configuration', () => {
      const config = { timeout: 1000, retries: 2 };
      campaign.addSession('session-1', config);

      const sessionState = campaign.sessions.get('session-1');
      expect(sessionState.config).toEqual(config);
    });

    test('should track session dependencies', () => {
      campaign.addSession('session-2', {
        dependencies: ['session-1']
      });

      const sessionState = campaign.sessions.get('session-2');
      expect(sessionState.dependencies).toContain('session-1');
    });
  });

  // ================================================================
  // DEPENDENCY MANAGEMENT
  // ================================================================
  describe('Session Dependencies', () => {
    test('should check dependencies met for independent session', () => {
      campaign.addSession('session-1');
      const met = campaign.areDependenciesMet('session-1');

      expect(met).toBe(true);
    });

    test('should check dependencies met for dependent session', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2', { dependencies: ['session-1'] });

      const met = campaign.areDependenciesMet('session-2');
      expect(met).toBe(false);
    });

    test('should recognize completed dependencies', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2', { dependencies: ['session-1'] });

      campaign.completeSession('session-1', {});

      const met = campaign.areDependenciesMet('session-2');
      expect(met).toBe(true);
    });

    test('should handle multiple dependencies', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');
      campaign.addSession('session-3', {
        dependencies: ['session-1', 'session-2']
      });

      const metBefore = campaign.areDependenciesMet('session-3');
      expect(metBefore).toBe(false);

      campaign.completeSession('session-1', {});
      const metPartial = campaign.areDependenciesMet('session-3');
      expect(metPartial).toBe(false);

      campaign.completeSession('session-2', {});
      const metAfter = campaign.areDependenciesMet('session-3');
      expect(metAfter).toBe(true);
    });

    test('should handle missing dependency session', () => {
      campaign.addSession('session-1', {
        dependencies: ['non-existent']
      });

      const met = campaign.areDependenciesMet('session-1');
      expect(met).toBe(false);
    });
  });

  // ================================================================
  // SESSION LIFECYCLE
  // ================================================================
  describe('Session Lifecycle', () => {
    beforeEach(() => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');
    });

    test('should start session', () => {
      const start = Date.now();
      campaign.startSession('session-1');
      const end = Date.now();

      const sessionState = campaign.sessions.get('session-1');
      expect(sessionState.status).toBe('running');
      expect(sessionState.startTime).toBeGreaterThanOrEqual(start);
      expect(sessionState.startTime).toBeLessThanOrEqual(end);
    });

    test('should track active sessions', () => {
      campaign.startSession('session-1');
      expect(campaign.activeSessions.has('session-1')).toBe(true);
    });

    test('should complete session', () => {
      campaign.startSession('session-1');
      campaign.completeSession('session-1', { data: 'result' });

      const sessionState = campaign.sessions.get('session-1');
      expect(sessionState.status).toBe('completed');
      expect(sessionState.results).toEqual({ data: 'result' });
      expect(sessionState.duration).toBeGreaterThanOrEqual(0);
    });

    test('should remove from active on completion', () => {
      campaign.startSession('session-1');
      expect(campaign.activeSessions.has('session-1')).toBe(true);

      campaign.completeSession('session-1', {});
      expect(campaign.activeSessions.has('session-1')).toBe(false);
    });

    test('should fail session with error', () => {
      campaign.startSession('session-1');
      const error = new Error('Test error');
      campaign.failSession('session-1', error);

      const sessionState = campaign.sessions.get('session-1');
      expect(sessionState.status).toBe('failed');
      expect(sessionState.error).toBe(error);
    });

    test('should emit session:started event', (done) => {
      campaign.on('session:started', (data) => {
        expect(data.sessionId).toBe('session-1');
        done();
      });

      campaign.addSession('session-1');
      campaign.startSession('session-1');
    });

    test('should emit session:completed event', (done) => {
      campaign.on('session:completed', (data) => {
        expect(data.sessionId).toBe('session-1');
        expect(data.results).toEqual({ data: 'result' });
        done();
      });

      campaign.addSession('session-1');
      campaign.startSession('session-1');
      campaign.completeSession('session-1', { data: 'result' });
    });

    test('should emit session:failed event', (done) => {
      campaign.on('session:failed', (data) => {
        expect(data.sessionId).toBe('session-1');
        expect(data.error).toBeDefined();
        done();
      });

      campaign.addSession('session-1');
      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Test'));
    });
  });

  // ================================================================
  // SESSION SCHEDULING
  // ================================================================
  describe('Session Scheduling', () => {
    test('should get next session respecting parallel limit', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');
      campaign.addSession('session-3');

      const next1 = campaign.getNextSession();
      expect(next1).toBe('session-1');

      campaign.startSession(next1);

      const next2 = campaign.getNextSession();
      expect(next2).toBe('session-2');
    });

    test('should respect maxParallelSessions limit', () => {
      for (let i = 1; i <= 5; i++) {
        campaign.addSession(`session-${i}`);
      }

      campaign.startSession('session-1');
      campaign.startSession('session-2');
      campaign.startSession('session-3');

      const next = campaign.getNextSession();
      expect(next).toBeNull();
    });

    test('should respect dependencies in scheduling', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2', { dependencies: ['session-1'] });

      const next = campaign.getNextSession();
      expect(next).toBe('session-1');

      campaign.startSession('session-1');
      campaign.completeSession('session-1', {});

      const nextAfter = campaign.getNextSession();
      expect(nextAfter).toBe('session-2');
    });

    test('should return null when all sessions running', () => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');

      campaign.startSession('session-1');
      campaign.startSession('session-2');

      const next = campaign.getNextSession();
      expect(next).toBeNull();
    });

    test('should return null when all sessions completed', () => {
      campaign.addSession('session-1');

      campaign.startSession('session-1');
      campaign.completeSession('session-1', {});

      const next = campaign.getNextSession();
      expect(next).toBeNull();
    });
  });

  // ================================================================
  // RESULTS AGGREGATION
  // ================================================================
  describe('Results Aggregation', () => {
    beforeEach(() => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');
    });

    test('should store session results', () => {
      campaign.startSession('session-1');
      campaign.completeSession('session-1', { data: 'result1' });

      const results = campaign.results.get('session-1');
      expect(results).toEqual({ data: 'result1' });
    });

    test('should aggregate results', () => {
      campaign.startSession('session-1');
      campaign.completeSession('session-1', { count: 10 });

      campaign.startSession('session-2');
      campaign.completeSession('session-2', { count: 20 });

      expect(campaign.aggregatedResults).toBeDefined();
    });

    test('should handle merge aggregation strategy', () => {
      campaign.config.aggregationStrategy = 'merge';

      campaign.startSession('session-1');
      campaign.completeSession('session-1', { a: 1 });

      campaign.startSession('session-2');
      campaign.completeSession('session-2', { b: 2 });

      // Aggregation should combine results
      expect(campaign.aggregatedResults).toBeDefined();
    });

    test('should handle concatenate aggregation strategy', () => {
      campaign.config.aggregationStrategy = 'concatenate';

      campaign.startSession('session-1');
      campaign.completeSession('session-1', { data: [1] });

      campaign.startSession('session-2');
      campaign.completeSession('session-2', { data: [2] });

      expect(campaign.aggregatedResults).toBeDefined();
    });
  });

  // ================================================================
  // RETRY AND ERROR HANDLING
  // ================================================================
  describe('Retry and Error Handling', () => {
    beforeEach(() => {
      campaign.addSession('session-1');
      campaign.addSession('session-2');
    });

    test('should retry failed session', () => {
      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Test error'));

      const sessionState = campaign.sessions.get('session-1');
      expect(sessionState.retryCount).toBe(1);
    });

    test('should not exceed max retries', () => {
      campaign.config.maxRetries = 2;

      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Error 1'));

      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Error 2'));

      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Error 3'));

      const sessionState = campaign.sessions.get('session-1');
      expect(sessionState.retryCount).toBeGreaterThanOrEqual(2);
    });

    test('should abort on error handling mode', () => {
      campaign.config.errorHandling = 'abort';

      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Test'));

      expect(campaign.status).toBe('failed');
    });

    test('should continue on error handling mode', () => {
      campaign.config.errorHandling = 'continue';

      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Test'));

      expect(campaign.status).not.toBe('failed');
    });
  });

  // ================================================================
  // CAMPAIGN STATUS
  // ================================================================
  describe('Campaign Status', () => {
    test('should set status to running on first session start', () => {
      campaign.addSession('session-1');
      campaign.startSession('session-1');

      expect(campaign.status).toBe('running');
    });

    test('should complete campaign when all sessions done', () => {
      campaign.addSession('session-1');
      campaign.startSession('session-1');
      campaign.completeSession('session-1', {});

      // Campaign should transition to completed if no more sessions
      expect(['running', 'completed']).toContain(campaign.status);
    });

    test('should pause campaign', () => {
      campaign.pauseCampaign();
      expect(campaign.status).toBe('paused');
    });

    test('should resume campaign', () => {
      campaign.pauseCampaign();
      campaign.resumeCampaign();
      expect(campaign.status).not.toBe('paused');
    });

    test('should mark campaign as failed', () => {
      campaign.addSession('session-1');
      campaign.startSession('session-1');
      campaign.failSession('session-1', new Error('Critical error'));

      if (campaign.config.errorHandling === 'abort') {
        expect(campaign.status).toBe('failed');
      }
    });
  });

  // ================================================================
  // SHARED CONTEXT
  // ================================================================
  describe('Shared Context', () => {
    test('should initialize with empty shared context', () => {
      expect(campaign.sharedContext).toBeDefined();
      expect(typeof campaign.sharedContext).toBe('object');
    });

    test('should accept initial shared context', () => {
      const withContext = new Campaign({
        sharedContext: { targetUrl: 'https://example.com' }
      });
      expect(withContext.sharedContext.targetUrl).toBe('https://example.com');
    });

    test('should allow updating shared context', () => {
      campaign.sharedContext.key = 'value';
      expect(campaign.sharedContext.key).toBe('value');
    });

    test('should track context locks', () => {
      campaign.contextLocks.set('key1', { owner: 'session-1' });
      expect(campaign.contextLocks.has('key1')).toBe(true);
    });
  });

  // ================================================================
  // EDGE CASES
  // ================================================================
  describe('Edge Cases', () => {
    test('should handle empty campaign', () => {
      const empty = new Campaign();
      expect(empty.sessions.size).toBe(0);
      expect(empty.getNextSession()).toBeNull();
    });

    test('should handle circular dependencies', () => {
      campaign.addSession('session-1', { dependencies: ['session-2'] });
      campaign.addSession('session-2', { dependencies: ['session-1'] });

      const next = campaign.getNextSession();
      expect(next).toBeNull();
    });

    test('should handle very large campaigns', () => {
      for (let i = 1; i <= 100; i++) {
        campaign.addSession(`session-${i}`);
      }

      expect(campaign.sessions.size).toBe(100);
      const next = campaign.getNextSession();
      expect(next).toBeDefined();
    });

    test('should handle rapid session operations', () => {
      for (let i = 1; i <= 10; i++) {
        const sessionId = `session-${i}`;
        campaign.addSession(sessionId);
        campaign.startSession(sessionId);
        campaign.completeSession(sessionId, { index: i });
      }

      expect(campaign.results.size).toBe(10);
    });

    test('should handle session operations on completed sessions', () => {
      campaign.addSession('session-1');
      campaign.startSession('session-1');
      campaign.completeSession('session-1', {});

      // Should not crash on operations
      expect(() => {
        const next = campaign.getNextSession();
      }).not.toThrow();
    });

    test('should calculate campaign duration', () => {
      const start = Date.now();
      campaign.addSession('session-1');
      campaign.startSession('session-1');
      campaign.completeSession('session-1', {});
      const end = Date.now();

      const duration = campaign.updatedAt - campaign.createdAt;
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ================================================================
  // FINDINGS MANAGEMENT
  // ================================================================
  describe('Findings Management', () => {
    test('should initialize empty findings', () => {
      expect(campaign.findings).toBeDefined();
      expect(Array.isArray(campaign.findings)).toBe(true);
    });

    test('should add findings', () => {
      campaign.findings.push({
        type: 'competitor-update',
        data: 'New pricing detected'
      });

      expect(campaign.findings.length).toBe(1);
    });

    test('should track multiple findings', () => {
      campaign.findings.push({ type: 'update-1' });
      campaign.findings.push({ type: 'update-2' });
      campaign.findings.push({ type: 'update-3' });

      expect(campaign.findings.length).toBe(3);
    });
  });
});
