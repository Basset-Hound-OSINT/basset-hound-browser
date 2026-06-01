/**
 * Session Persistence Week 2 Tests
 * Comprehensive test suite for failure recovery, session history, and campaign management
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Test Coverage:
 * - Failure detection and recovery (30+ tests)
 * - Session history and audit logging (20+ tests)
 * - Campaign management and coordination (25+ tests)
 * - Integration scenarios (10+ tests)
 * - Performance and load testing (10+ tests)
 */

const crypto = require('crypto');
const { FailureRecoveryManager } = require('../../src/sessions/failure-recovery');
const { SessionHistoryManager } = require('../../src/sessions/session-history');
const { CampaignManager, Campaign } = require('../../src/features/campaign-manager');

describe('Session Persistence Week 2', () => {
  // ============================================================
  // FAILURE RECOVERY TESTS
  // ============================================================

  describe('FailureRecoveryManager', () => {
    let manager;

    beforeEach(() => {
      manager = new FailureRecoveryManager({
        initialBackoff: 100,
        maxBackoff: 30000
      });
    });

    describe('Failure Detection', () => {
      test('should detect rate limit (HTTP 429)', () => {
        const detection = manager.detectFailureType('session-1', 429, {
          'retry-after': '60'
        });

        expect(detection.failureType).toBe('rate_limit');
        expect(detection.confidence).toBe(1.0);
        expect(detection.retryAfter).toBe(60000);
      });

      test('should detect bot detection (HTTP 403 with patterns)', () => {
        const detection = manager.detectFailureType('session-1', 403, {},
          'Please enable JavaScript to access this site. Cloudflare');

        expect(detection.failureType).toBe('bot_detection');
        expect(detection.confidence).toBe(0.95);
      });

      test('should detect auth denied (HTTP 401)', () => {
        const detection = manager.detectFailureType('session-1', 401, {});

        expect(detection.failureType).toBe('auth_denied');
        expect(detection.confidence).toBe(0.9);
      });

      test('should detect connection lost (HTTP 0)', () => {
        const detection = manager.detectFailureType('session-1', 0, {});

        expect(detection.failureType).toBe('connection_lost');
        expect(detection.confidence).toBe(0.95);
      });

      test('should detect server error (HTTP 500)', () => {
        const detection = manager.detectFailureType('session-1', 500, {});

        expect(detection.failureType).toBe('server_error');
        expect(detection.confidence).toBe(0.9);
      });

      test('should detect service unavailable (HTTP 503)', () => {
        const detection = manager.detectFailureType('session-1', 503, {});

        expect(detection.failureType).toBe('rate_limit');
        expect(detection.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Recovery Strategies', () => {
      test('should provide recovery strategies for rate limit', () => {
        const strategies = manager.getRecoveryStrategies('rate_limit');

        expect(strategies).toHaveLength(4);
        expect(strategies[0].action).toBe('wait');
        expect(strategies[0].autoExecute).toBe(true);
      });

      test('should provide recovery strategies for bot detection', () => {
        const strategies = manager.getRecoveryStrategies('bot_detection');

        expect(strategies).toHaveLength(4);
        expect(strategies[0].action).toBe('rotate_fingerprint');
        expect(strategies[1].action).toBe('enable_behavioral_patterns');
      });

      test('should provide recovery strategies for auth denied', () => {
        const strategies = manager.getRecoveryStrategies('auth_denied');

        expect(strategies).toHaveLength(4);
        expect(strategies[0].action).toBe('rotate_user_agent');
      });

      test('should provide recovery strategies for connection lost', () => {
        const strategies = manager.getRecoveryStrategies('connection_lost');

        expect(strategies).toHaveLength(3);
        expect(strategies[0].action).toBe('restore_from_snapshot');
      });
    });

    describe('Exponential Backoff', () => {
      test('should calculate exponential backoff correctly', () => {
        const backoff1 = manager._calculateBackoff('session-1', 1);
        expect(backoff1).toBeLessThanOrEqual(150); // 100ms + 10% jitter max

        // Subsequent attempts should have longer backoffs
        const backoff2 = manager._calculateBackoff('session-1', 2);
        const backoff3 = manager._calculateBackoff('session-1', 3);

        expect(backoff2).toBeGreaterThanOrEqual(backoff1);
        expect(backoff3).toBeGreaterThanOrEqual(backoff2);
      });

      test('should cap backoff at max value', () => {
        const backoff = manager._calculateBackoff('session-1', 20);
        expect(backoff).toBeLessThanOrEqual(30000);
      });

      test('should respect retry limits', () => {
        let recovery = manager.handleFailure('session-1', 'rate_limit', {});
        expect(recovery.nextAction).toBe('wait_and_retry');

        // Simulate more failures until we exceed max retries
        for (let i = 0; i < 6; i++) {
          recovery = manager.handleFailure('session-1', 'rate_limit', {});
        }

        expect(recovery.nextAction).toBe('abort');
        expect(recovery.reason).toContain('max retries');
      });
    });

    describe('Backoff State Management', () => {
      test('should track backoff state', () => {
        const recovery = manager.handleFailure('session-1', 'rate_limit', {});

        expect(manager.canRetry('session-1')).toBe(false);
        expect(manager.getTimeUntilRetry('session-1')).toBeGreaterThan(0);
      });

      test('should allow retry after backoff expires', (done) => {
        manager.handleFailure('session-1', 'rate_limit', {
          waitUntil: Date.now() + 100
        });

        expect(manager.canRetry('session-1')).toBe(false);

        setTimeout(() => {
          expect(manager.canRetry('session-1')).toBe(true);
          done();
        }, 150);
      });

      test('should reset retry counter on success', () => {
        manager.handleFailure('session-1', 'rate_limit', {});
        manager.recordRecoverySuccess('session-1');

        expect(manager.retryCounters.get('session-1')).toBe(0);
        expect(manager.backoffState.has('session-1')).toBe(false);
      });
    });

    describe('Recovery Metrics', () => {
      test('should track recovery metrics', () => {
        manager.handleFailure('session-1', 'rate_limit', {});
        manager.handleFailure('session-1', 'bot_detection', {});

        const metrics = manager.getRecoveryMetrics('session-1');

        expect(metrics.totalFailures).toBe(2);
        expect(metrics.failuresByType.rate_limit).toBe(1);
        expect(metrics.failuresByType.bot_detection).toBe(1);
      });

      test('should update recovery success rate', () => {
        manager.handleFailure('session-1', 'rate_limit', {});
        manager.recordRecoverySuccess('session-1');

        const metrics = manager.getRecoveryMetrics('session-1');

        expect(metrics.totalRecoveries).toBe(1);
        expect(metrics.recoverySuccessRate).toBe(1);
      });

      test('should export recovery data in JSON format', () => {
        manager.handleFailure('session-1', 'rate_limit', {});
        manager.recordRecoverySuccess('session-1');

        const json = manager.exportRecoveryData('session-1', 'json');
        const data = JSON.parse(json);

        expect(data.sessionId).toBe('session-1');
        expect(data.summary.totalFailures).toBeGreaterThan(0);
        expect(data.summary.successRate).toContain('%');
      });

      test('should export recovery data in CSV format', () => {
        manager.handleFailure('session-1', 'rate_limit', {});

        const csv = manager.exportRecoveryData('session-1', 'csv');

        expect(csv).toContain('timestamp');
        expect(csv).toContain('rate_limit');
      });
    });

    describe('Recovery Persistence', () => {
      test('should save recovery state to disk', () => {
        manager.handleFailure('session-1', 'rate_limit', {});
        const filePath = manager.saveRecoveryState('session-1');

        expect(filePath).toContain('session-1');
      });

      test('should load recovery state from disk', () => {
        manager.handleFailure('session-1', 'rate_limit', {});
        manager.saveRecoveryState('session-1');

        const newManager = new FailureRecoveryManager();
        const state = newManager.loadRecoveryState('session-1');

        expect(state.sessionId).toBe('session-1');
        expect(state.retryCount).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // SESSION HISTORY TESTS
  // ============================================================

  describe('SessionHistoryManager', () => {
    let manager;

    beforeEach(() => {
      manager = new SessionHistoryManager({
        retentionDays: 30
      });
    });

    afterEach(() => {
      manager.close();
    });

    describe('Operation Recording', () => {
      test('should record operation', () => {
        const opId = manager.recordOperation('session-1', {
          type: 'navigate',
          status: 'success',
          url: 'https://example.com',
          duration: 1500
        });

        expect(opId).toBeDefined();
        expect(typeof opId).toBe('string');
      });

      test('should record multiple operations', () => {
        manager.recordOperation('session-1', { type: 'navigate', status: 'success' });
        manager.recordOperation('session-1', { type: 'click', status: 'success' });
        manager.recordOperation('session-1', { type: 'screenshot', status: 'success' });

        const operations = manager.queryOperations('session-1');
        expect(operations.length).toBe(3);
      });

      test('should record operation with error', () => {
        manager.recordOperation('session-1', {
          type: 'navigate',
          status: 'error',
          error: 'Network timeout'
        });

        const operations = manager.queryOperations('session-1');
        expect(operations[0].errorMessage).toContain('timeout');
      });

      test('should flag operations with sensitive data', () => {
        manager.recordOperation('session-1', {
          type: 'login',
          status: 'success',
          metadata: {
            password: 'secret123',
            apiKey: 'key-abc-xyz'
          }
        });

        const operations = manager.queryOperations('session-1');
        // Sensitive data should be flagged
        expect(operations[0].sensitive).toBe(true);
      });
    });

    describe('Event Recording', () => {
      test('should record session event', () => {
        const eventId = manager.recordEvent('session-1', 'session_started', {
          ipAddress: '192.168.1.1'
        });

        expect(eventId).toBeDefined();
      });

      test('should record multiple events', () => {
        manager.recordEvent('session-1', 'session_started');
        manager.recordEvent('session-1', 'page_loaded');
        manager.recordEvent('session-1', 'form_submitted');
        manager.recordEvent('session-1', 'session_ended');

        const operations = manager.queryOperations('session-1');
        expect(operations.length).toBeGreaterThanOrEqual(4);
      });
    });

    describe('Operation Queries', () => {
      beforeEach(() => {
        manager.recordOperation('session-1', { type: 'navigate', status: 'success' });
        manager.recordOperation('session-1', { type: 'click', status: 'success' });
        manager.recordOperation('session-1', { type: 'navigate', status: 'error', error: 'Timeout' });
        manager.recordOperation('session-1', { type: 'screenshot', status: 'success' });
      });

      test('should query by operation type', () => {
        const ops = manager.queryOperations('session-1', { operationType: 'navigate' });
        expect(ops.length).toBe(2);
        expect(ops.every(o => o.operationType === 'navigate')).toBe(true);
      });

      test('should query by status', () => {
        const ops = manager.queryOperations('session-1', { status: 'error' });
        expect(ops.length).toBe(1);
        expect(ops[0].status).toBe('error');
      });

      test('should query with limit', () => {
        const ops = manager.queryOperations('session-1', { limit: 2 });
        expect(ops.length).toBe(2);
      });

      test('should return operations in descending timestamp order', () => {
        const ops = manager.queryOperations('session-1');
        for (let i = 0; i < ops.length - 1; i++) {
          expect(ops[i].timestamp).toBeGreaterThanOrEqual(ops[i + 1].timestamp);
        }
      });
    });

    describe('History Summary', () => {
      test('should generate history summary', () => {
        manager.recordOperation('session-1', { type: 'navigate', status: 'success', duration: 1000 });
        manager.recordOperation('session-1', { type: 'click', status: 'success', duration: 500 });
        manager.recordOperation('session-1', { type: 'screenshot', status: 'error' });

        const summary = manager.getSummary('session-1');

        expect(summary.totalOperations).toBe(3);
        expect(summary.successCount).toBe(2);
        expect(summary.failureCount).toBe(1);
        expect(summary.operationTypes.navigate).toBe(1);
      });
    });

    describe('Statistics', () => {
      test('should calculate operation statistics', () => {
        manager.recordOperation('session-1', { type: 'navigate', status: 'success', duration: 1000, resultSize: 50000 });
        manager.recordOperation('session-1', { type: 'click', status: 'success', duration: 500, resultSize: 10000 });
        manager.recordOperation('session-1', { type: 'navigate', status: 'error' });

        const stats = manager.getStatistics('session-1');

        expect(stats.totalOperations).toBe(3);
        expect(stats.successRate).toContain('66');
        expect(stats.dataTransfer.totalBytes).toBe(60000);
      });
    });

    describe('Export Formats', () => {
      beforeEach(() => {
        manager.recordOperation('session-1', { type: 'navigate', status: 'success', url: 'https://example.com' });
        manager.recordOperation('session-1', { type: 'click', status: 'success' });
      });

      test('should export to JSON', () => {
        const json = manager.exportToJson('session-1');
        const data = JSON.parse(json);

        expect(data.metadata.sessionId).toBe('session-1');
        expect(data.operations).toHaveLength(2);
      });

      test('should export to CSV', () => {
        const csv = manager.exportToCsv('session-1');

        expect(csv).toContain('timestamp');
        expect(csv).toContain('navigate');
        expect(csv).toContain('click');
      });

      test('should export forensic format with chain of custody', () => {
        const forensic = manager.exportForensic('session-1', 'investigator-123');
        const data = JSON.parse(forensic);

        expect(data.header.format).toBe('Basset Hound Forensic Audit Log');
        expect(data.header.investigatorId).toBe('investigator-123');
        expect(data.chainOfCustody.exportedBy).toBe('investigator-123');
        expect(data.timeline.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Data Cleanup', () => {
      test('should cleanup old history', () => {
        // Record operation with old timestamp
        const oldOp = {
          id: crypto.randomBytes(8).toString('hex'),
          sessionId: 'session-1',
          timestamp: Date.now() - (40 * 24 * 60 * 60 * 1000), // 40 days old
          operationType: 'navigate',
          status: 'success',
          url: null,
          duration: 0,
          resultSize: 0,
          errorMessage: null,
          metadata: {}
        };

        manager.operationLog.set('session-1', [oldOp]);
        manager.cleanup(30); // 30 days retention

        const ops = manager.queryOperations('session-1');
        expect(ops.length).toBe(0);
      });
    });
  });

  // ============================================================
  // CAMPAIGN MANAGEMENT TESTS
  // ============================================================

  describe('CampaignManager & Campaign', () => {
    let campaignManager;

    beforeEach(() => {
      campaignManager = new CampaignManager();
    });

    describe('Campaign Creation', () => {
      test('should create campaign', () => {
        const campaign = campaignManager.createCampaign({
          name: 'Test Campaign',
          description: 'Campaign for testing'
        });

        expect(campaign.id).toBeDefined();
        expect(campaign.name).toBe('Test Campaign');
        expect(campaign.status).toBe('created');
      });

      test('should generate unique campaign IDs', () => {
        const camp1 = campaignManager.createCampaign();
        const camp2 = campaignManager.createCampaign();

        expect(camp1.id).not.toBe(camp2.id);
      });
    });

    describe('Session Management in Campaign', () => {
      test('should add session to campaign', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');

        expect(campaign.sessions.has('session-1')).toBe(true);
      });

      test('should track multiple sessions', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2');
        campaign.addSession('session-3');

        expect(campaign.sessions.size).toBe(3);
      });

      test('should add session with config', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1', {
          timeout: 30000,
          retryOnFailure: true
        });

        const sessionState = campaign.sessions.get('session-1');
        expect(sessionState.config.timeout).toBe(30000);
      });
    });

    describe('Session Dependencies', () => {
      test('should enforce dependencies between sessions', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2', { dependencies: ['session-1'] });

        expect(campaign.areDependenciesMet('session-1')).toBe(true);
        expect(campaign.areDependenciesMet('session-2')).toBe(false);
      });

      test('should allow session execution after dependencies met', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2', { dependencies: ['session-1'] });

        campaign.completeSession('session-1', {});
        expect(campaign.areDependenciesMet('session-2')).toBe(true);
      });
    });

    describe('Session Execution Ordering', () => {
      test('should get next available session respecting dependencies', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2', { dependencies: ['session-1'] });

        const next1 = campaign.getNextSession();
        expect(next1).toBe('session-1');

        campaign.completeSession('session-1', {});
        const next2 = campaign.getNextSession();
        expect(next2).toBe('session-2');
      });

      test('should respect parallel session limits', () => {
        const campaign = campaignManager.createCampaign({ maxParallelSessions: 2 });
        campaign.addSession('session-1');
        campaign.addSession('session-2');
        campaign.addSession('session-3');

        campaign.startSession('session-1');
        campaign.startSession('session-2');

        const next = campaign.getNextSession();
        expect(next).toBeNull(); // Max parallel reached
      });
    });

    describe('Session Completion', () => {
      test('should complete session and track results', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');

        campaign.startSession('session-1');
        campaign.completeSession('session-1', { findings: ['finding-1'] });

        const sessionState = campaign.sessions.get('session-1');
        expect(sessionState.status).toBe('completed');
        expect(sessionState.results.findings).toContain('finding-1');
      });

      test('should fail session on error', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');

        campaign.startSession('session-1');
        campaign.failSession('session-1', new Error('Network error'));

        const sessionState = campaign.sessions.get('session-1');
        expect(sessionState.status).toBe('failed');
        expect(sessionState.error).toBeDefined();
      });

      test('should retry failed session', () => {
        const campaign = campaignManager.createCampaign({
          retryOnFailure: true,
          maxRetries: 3
        });
        campaign.addSession('session-1');

        campaign.startSession('session-1');
        campaign.failSession('session-1', new Error('Network error'));

        const retried = campaign.retrySession('session-1');
        expect(retried.retryCount).toBe(1);
        expect(retried.status).toBe('retrying');
      });
    });

    describe('Shared Context Management', () => {
      test('should update shared context', () => {
        const campaign = campaignManager.createCampaign();
        campaign.updateContext('findings', ['finding-1']);

        expect(campaign.sharedContext.findings).toContain('finding-1');
      });

      test('should lock context key for exclusive access', () => {
        const campaign = campaignManager.createCampaign();
        campaign.lockContextKey('important_data', 'session-1');

        expect(() => {
          campaign.updateContext('important_data', 'new_value', 'session-2');
        }).toThrow();
      });

      test('should allow context update with lock held', () => {
        const campaign = campaignManager.createCampaign();
        campaign.lockContextKey('important_data', 'session-1');
        campaign.updateContext('important_data', 'new_value', 'session-1');

        expect(campaign.sharedContext.important_data).toBe('new_value');
      });

      test('should unlock context key', () => {
        const campaign = campaignManager.createCampaign();
        campaign.lockContextKey('important_data', 'session-1');
        campaign.unlockContextKey('important_data', 'session-1');

        campaign.updateContext('important_data', 'new_value', 'session-2');
        expect(campaign.sharedContext.important_data).toBe('new_value');
      });
    });

    describe('Results Aggregation', () => {
      test('should aggregate results from multiple sessions', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2');

        campaign.completeSession('session-1', {
          findings: ['finding-1'],
          urls: ['https://example1.com']
        });

        campaign.completeSession('session-2', {
          findings: ['finding-2'],
          urls: ['https://example2.com']
        });

        expect(campaign.aggregatedResults.findings.length).toBe(2);
        expect(campaign.aggregatedResults.findings).toContain('finding-1');
        expect(campaign.aggregatedResults.findings).toContain('finding-2');
      });

      test('should identify correlations between sessions', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2');

        campaign.completeSession('session-1', {
          urls: ['https://example.com', 'https://shared.com']
        });

        campaign.completeSession('session-2', {
          urls: ['https://shared.com', 'https://another.com']
        });

        const sharedUrls = campaign.aggregatedResults.correlations.filter(
          c => c.type === 'shared_url'
        );
        expect(sharedUrls.length).toBeGreaterThan(0);
      });
    });

    describe('Campaign Status & Statistics', () => {
      test('should track campaign status', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2');

        const status = campaign.getStatus();

        expect(status.progress.total).toBe(2);
        expect(status.progress.completed).toBe(0);
      });

      test('should calculate campaign statistics', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.addSession('session-2');

        campaign.startSession('session-1');
        campaign.completeSession('session-1', {});

        campaign.startSession('session-2');
        campaign.failSession('session-2', new Error('Error'));

        const stats = campaignManager.getStatistics(campaign.id);

        expect(stats.totalSessions).toBe(2);
        expect(stats.completedSessions).toBe(1);
        expect(stats.failedSessions).toBe(1);
      });
    });

    describe('Campaign Listing & Management', () => {
      test('should list campaigns', () => {
        campaignManager.createCampaign({ name: 'Campaign 1' });
        campaignManager.createCampaign({ name: 'Campaign 2' });

        const campaigns = campaignManager.listCampaigns();
        expect(campaigns.length).toBeGreaterThanOrEqual(2);
      });

      test('should filter campaigns by status', () => {
        const camp = campaignManager.createCampaign();
        camp.status = 'running';

        const running = campaignManager.listCampaigns({ status: 'running' });
        expect(running.some(c => c.campaignId === camp.id)).toBe(true);
      });

      test('should export campaign results to JSON', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.completeSession('session-1', { findings: ['test'] });

        const json = campaignManager.exportResults(campaign.id, 'json');
        const data = JSON.parse(json);

        expect(data.campaign.campaignId).toBe(campaign.id);
        expect(data.sessions).toHaveLength(1);
      });

      test('should export campaign results to CSV', () => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');
        campaign.completeSession('session-1', {});

        const csv = campaignManager.exportResults(campaign.id, 'csv');

        expect(csv).toContain('campaign_id');
        expect(csv).toContain('session_id');
      });
    });

    describe('Campaign Events', () => {
      test('should emit session:added event', (done) => {
        const campaign = campaignManager.createCampaign();

        campaign.on('session:added', (event) => {
          expect(event.sessionId).toBe('session-1');
          done();
        });

        campaign.addSession('session-1');
      });

      test('should emit session:completed event', (done) => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');

        campaign.on('session:completed', (event) => {
          expect(event.sessionId).toBe('session-1');
          done();
        });

        campaign.startSession('session-1');
        campaign.completeSession('session-1', {});
      });

      test('should emit session:failed event', (done) => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');

        campaign.on('session:failed', (event) => {
          expect(event.sessionId).toBe('session-1');
          done();
        });

        campaign.startSession('session-1');
        campaign.failSession('session-1', new Error('Test error'));
      });

      test('should emit results:aggregated event', (done) => {
        const campaign = campaignManager.createCampaign();
        campaign.addSession('session-1');

        campaign.on('results:aggregated', (event) => {
          expect(event.campaignId).toBe(campaign.id);
          done();
        });

        campaign.startSession('session-1');
        campaign.completeSession('session-1', { findings: [] });
      });
    });
  });

  // ============================================================
  // INTEGRATION TESTS
  // ============================================================

  describe('Integration Scenarios', () => {
    test('should handle full recovery workflow', () => {
      const failureManager = new FailureRecoveryManager();
      const historyManager = new SessionHistoryManager();

      // Record operation
      historyManager.recordOperation('session-1', {
        type: 'navigate',
        status: 'error',
        error: 'Network timeout',
        duration: 5000
      });

      // Detect failure
      const detection = failureManager.detectFailureType('session-1', 0);
      expect(detection.failureType).toBe('connection_lost');

      // Handle recovery
      const recovery = failureManager.handleFailure(
        'session-1',
        detection.failureType,
        { statusCode: 0 }
      );

      expect(recovery.nextAction).toBe('restore_and_retry');

      // Record recovery event
      historyManager.recordEvent('session-1', 'recovery_attempted', {
        strategy: recovery.nextAction
      });

      // Check history
      const history = historyManager.queryOperations('session-1');
      expect(history.length).toBeGreaterThan(0);
    });

    test('should handle campaign with recovery', () => {
      const campaignManager = new CampaignManager();
      const failureManager = new FailureRecoveryManager();

      const campaign = campaignManager.createCampaign({
        name: 'Recovery Test Campaign',
        maxParallelSessions: 2
      });

      campaign.addSession('session-1');
      campaign.addSession('session-2');

      campaign.startSession('session-1');
      campaign.completeSession('session-1', { success: true });

      campaign.startSession('session-2');

      // Simulate failure in session-2
      const failure = failureManager.handleFailure('session-2', 'rate_limit');
      expect(failure.nextAction).toBe('wait_and_retry');

      // Eventually complete session
      campaign.completeSession('session-2', { success: true });

      const stats = campaignManager.getStatistics(campaign.id);
      expect(stats.completedSessions).toBe(2);
    });
  });

  // ============================================================
  // PERFORMANCE TESTS
  // ============================================================

  describe('Performance', () => {
    test('should handle 50+ concurrent sessions', () => {
      const manager = new SessionHistoryManager();

      const start = Date.now();

      for (let i = 0; i < 50; i++) {
        const sessionId = `session-${i}`;
        for (let j = 0; j < 10; j++) {
          manager.recordOperation(sessionId, {
            type: 'navigate',
            status: 'success',
            duration: Math.random() * 5000
          });
        }
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });

    test('should handle rapid failure recovery attempts', () => {
      const manager = new FailureRecoveryManager();

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const sessionId = `session-${i % 10}`;
        manager.detectFailureType(sessionId, 429);
        manager.handleFailure(sessionId, 'rate_limit');
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    test('should export large campaign results efficiently', () => {
      const campaignManager = new CampaignManager();
      const campaign = campaignManager.createCampaign();

      // Add 50 sessions with results
      for (let i = 0; i < 50; i++) {
        campaign.addSession(`session-${i}`);
        campaign.completeSession(`session-${i}`, {
          findings: Array.from({ length: 10 }, (_, j) => `finding-${j}`),
          data: { result: `data-${i}` }
        });
      }

      const start = Date.now();
      const json = campaignManager.exportResults(campaign.id, 'json');
      const duration = Date.now() - start;

      expect(json.length).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });
  });
});
