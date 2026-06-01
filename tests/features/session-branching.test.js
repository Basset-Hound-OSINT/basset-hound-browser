/**
 * Tests for Session Branching & Recovery Feature (v12.2.0)
 * Tests checkpoint creation, rollback, branching, and failure recovery
 */

const { SessionBranchingManager, SessionCheckpoint } = require('../../src/features/session-branching');

describe('Session Branching Feature - v12.2.0', () => {
  let manager;
  const sessionId = 'test-session-001';
  const mockSessionState = {
    url: 'https://example.com',
    cookies: { sessionToken: 'abc123' },
    localStorage: { theme: 'dark' },
    sessionStorage: { temp: 'value' },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    userAgent: 'Mozilla/5.0',
    proxy: { host: 'proxy.example.com', port: 8080 },
    viewport: { width: 1920, height: 1080 },
    deviceProfile: 'desktop-chrome',
    requestCount: 42
  };

  beforeEach(() => {
    manager = new SessionBranchingManager();
  });

  // ==========================================
  // CHECKPOINT CREATION & MANAGEMENT
  // ==========================================

  describe('Checkpoint Creation', () => {
    test('should create a checkpoint successfully', () => {
      const result = manager.createCheckpoint(
        sessionId,
        'checkpoint-1',
        mockSessionState
      );

      expect(result.success).toBe(true);
      expect(result.checkpointId).toBeDefined();
      expect(result.checkpointName).toBe('checkpoint-1');
      expect(result.requestCount).toBe(42);
      expect(result.checksum).toHaveLength(16); // Hex string, 16 chars
    });

    test('should reject missing sessionId', () => {
      expect(() => {
        manager.createCheckpoint(null, 'checkpoint-1', mockSessionState);
      }).toThrow('sessionId and checkpointName are required');
    });

    test('should reject missing checkpoint name', () => {
      expect(() => {
        manager.createCheckpoint(sessionId, null, mockSessionState);
      }).toThrow('sessionId and checkpointName are required');
    });

    test('should enforce max checkpoints limit', () => {
      const tinyManager = new SessionBranchingManager({ maxCheckpoints: 3 });

      // Create 5 checkpoints
      for (let i = 0; i < 5; i++) {
        tinyManager.createCheckpoint(
          sessionId,
          `checkpoint-${i}`,
          mockSessionState
        );
      }

      const checkpoints = tinyManager.listCheckpoints(sessionId);
      expect(checkpoints.length).toBe(3); // Should only keep last 3
      expect(checkpoints[0].name).toBe('checkpoint-2'); // First should be checkpoint-2
      expect(checkpoints[2].name).toBe('checkpoint-4'); // Last should be checkpoint-4
    });

    test('should preserve checkpoint integrity', () => {
      const result = manager.createCheckpoint(
        sessionId,
        'test-checkpoint',
        mockSessionState
      );

      const details = manager.getCheckpointDetails(sessionId, result.checkpointId);
      expect(details.validation.valid).toBe(true);
      expect(details.validation.checksum).toBe(result.checksum);
    });
  });

  describe('Checkpoint Listing & Retrieval', () => {
    test('should list all checkpoints for a session', () => {
      manager.createCheckpoint(sessionId, 'cp1', mockSessionState);
      manager.createCheckpoint(sessionId, 'cp2', mockSessionState);
      manager.createCheckpoint(sessionId, 'cp3', mockSessionState);

      const checkpoints = manager.listCheckpoints(sessionId);
      expect(checkpoints.length).toBe(3);
      expect(checkpoints[0].name).toBe('cp1');
      expect(checkpoints[1].name).toBe('cp2');
      expect(checkpoints[2].name).toBe('cp3');
    });

    test('should return empty array for unknown session', () => {
      const checkpoints = manager.listCheckpoints('unknown-session');
      expect(checkpoints).toEqual([]);
    });

    test('should retrieve full checkpoint details', () => {
      const created = manager.createCheckpoint(
        sessionId,
        'detail-test',
        mockSessionState
      );

      const details = manager.getCheckpointDetails(sessionId, created.checkpointId);
      expect(details.id).toBe(created.checkpointId);
      expect(details.name).toBe('detail-test');
      expect(details.state).toEqual(expect.objectContaining({
        url: 'https://example.com',
        userAgent: 'Mozilla/5.0'
      }));
      expect(details.metadata.requestCount).toBe(42);
    });

    test('should throw for non-existent checkpoint', () => {
      expect(() => {
        manager.getCheckpointDetails(sessionId, 'non-existent-id');
      }).toThrow('Checkpoint not found');
    });
  });

  describe('Checkpoint Deletion', () => {
    test('should delete checkpoint successfully', () => {
      const cp1 = manager.createCheckpoint(sessionId, 'cp1', mockSessionState);
      const cp2 = manager.createCheckpoint(sessionId, 'cp2', mockSessionState);
      const cp3 = manager.createCheckpoint(sessionId, 'cp3', mockSessionState);

      const result = manager.deleteCheckpoint(sessionId, cp2.checkpointId);
      expect(result.success).toBe(true);
      expect(result.remainingCheckpoints).toBe(2);

      const remaining = manager.listCheckpoints(sessionId);
      expect(remaining.length).toBe(2);
      expect(remaining.map(c => c.name)).toEqual(['cp1', 'cp3']);
    });

    test('should throw when deleting non-existent checkpoint', () => {
      expect(() => {
        manager.deleteCheckpoint(sessionId, 'non-existent');
      }).toThrow('Checkpoint not found');
    });
  });

  // ==========================================
  // CHECKPOINT ROLLBACK
  // ==========================================

  describe('Checkpoint Rollback', () => {
    test('should rollback to checkpoint successfully', () => {
      const cp = manager.createCheckpoint(sessionId, 'rollback-test', mockSessionState);

      const result = manager.rollbackToCheckpoint(sessionId, cp.checkpointId);
      expect(result.success).toBe(true);
      expect(result.checkpointId).toBe(cp.checkpointId);
      expect(result.restoredAt).toBeDefined();
      expect(result.state.url).toBe('https://example.com');
      expect(result.requestCountRestored).toBe(42);
    });

    test('should throw on invalid checkpoint', () => {
      expect(() => {
        manager.rollbackToCheckpoint(sessionId, 'invalid-id');
      }).toThrow('Checkpoint not found');
    });

    test('should preserve all state on rollback', () => {
      const cp = manager.createCheckpoint(sessionId, 'state-test', mockSessionState);
      const result = manager.rollbackToCheckpoint(sessionId, cp.checkpointId);

      expect(result.state.cookies).toEqual({ sessionToken: 'abc123' });
      expect(result.state.localStorage).toEqual({ theme: 'dark' });
      expect(result.state.headers).toEqual({ 'User-Agent': 'Mozilla/5.0' });
    });
  });

  // ==========================================
  // SESSION BRANCHING (A/B TESTING)
  // ==========================================

  describe('Session Branching', () => {
    test('should branch session successfully', () => {
      const cp = manager.createCheckpoint(sessionId, 'branch-test', mockSessionState);

      const result = manager.branchSession(sessionId, cp.checkpointId, 'branch-a');
      expect(result.success).toBe(true);
      expect(result.branchId).toBeDefined();
      expect(result.branchName).toBe('branch-a');
      expect(result.parentSessionId).toBe(sessionId);
      expect(result.initialState).toEqual(mockSessionState);
    });

    test('should generate branch name if not provided', () => {
      const cp = manager.createCheckpoint(sessionId, 'auto-branch', mockSessionState);
      const result = manager.branchSession(sessionId, cp.checkpointId);

      expect(result.branchName).toMatch(/^branch-[a-f0-9]{8}$/);
    });

    test('should throw when branching from non-existent checkpoint', () => {
      expect(() => {
        manager.branchSession(sessionId, 'invalid-checkpoint');
      }).toThrow('Checkpoint not found');
    });

    test('should list all branches from parent session', () => {
      const cp = manager.createCheckpoint(sessionId, 'multi-branch', mockSessionState);

      const branch1 = manager.branchSession(sessionId, cp.checkpointId, 'branch-a');
      const branch2 = manager.branchSession(sessionId, cp.checkpointId, 'branch-b');
      const branch3 = manager.branchSession(sessionId, cp.checkpointId, 'branch-c');

      const branches = manager.listBranches(sessionId);
      expect(branches.length).toBe(3);
      expect(branches.map(b => b.name)).toEqual(['branch-a', 'branch-b', 'branch-c']);
    });

    test('should track branch creation time', () => {
      const cp = manager.createCheckpoint(sessionId, 'timing-test', mockSessionState);
      const before = Date.now();
      const result = manager.branchSession(sessionId, cp.checkpointId, 'timing');
      const after = Date.now();

      const branches = manager.listBranches(sessionId);
      expect(branches[0].createdAt).toBeGreaterThanOrEqual(before);
      expect(branches[0].createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('Branch Merging', () => {
    test('should merge branch results to parent', () => {
      const cp = manager.createCheckpoint(sessionId, 'merge-test', mockSessionState);
      const branch = manager.branchSession(sessionId, cp.checkpointId, 'test-branch');

      const testResults = {
        success: true,
        conversionRate: 0.45,
        userEngagement: 'high',
        performanceScore: 89
      };

      const result = manager.mergeBranch(branch.branchId, testResults);
      expect(result.success).toBe(true);
      expect(result.branchId).toBe(branch.branchId);
      expect(result.testResults).toEqual(testResults);
      expect(result.mergeTimestamp).toBeDefined();
    });

    test('should update branch status to merged', () => {
      const cp = manager.createCheckpoint(sessionId, 'status-test', mockSessionState);
      const branch = manager.branchSession(sessionId, cp.checkpointId, 'status');

      manager.mergeBranch(branch.branchId, {});

      const branches = manager.listBranches(sessionId);
      expect(branches[0].status).toBe('merged');
    });

    test('should throw when merging non-existent branch', () => {
      expect(() => {
        manager.mergeBranch('invalid-branch-id', {});
      }).toThrow('Branch not found');
    });
  });

  // ==========================================
  // FAILURE DETECTION & RECOVERY
  // ==========================================

  describe('Failure Detection', () => {
    test('should detect rate limit failure', () => {
      const result = manager.detectFailure({
        message: 'Rate limit exceeded',
        statusCode: 429
      });

      expect(result.failureType).toBe('rate_limit');
      expect(result.severity).toBe('high');
      expect(result.recoverable).toBe(true);
      expect(result.confidence).toBe(0.95);
    });

    test('should detect forbidden/auth failure', () => {
      const result = manager.detectFailure({
        statusCode: 403,
        message: 'Access Denied'
      });

      expect(result.failureType).toBe('forbidden');
      expect(result.severity).toBe('high');
    });

    test('should detect bot detection', () => {
      const result = manager.detectFailure({
        message: 'Bot challenge detected'
      });

      expect(result.failureType).toBe('bot_detected');
      expect(result.severity).toBe('critical');
    });

    test('should detect connection loss', () => {
      const result = manager.detectFailure({
        message: 'Connection timeout'
      });

      expect(result.failureType).toBe('connection_lost');
      expect(result.severity).toBe('medium');
    });

    test('should detect server error', () => {
      const result = manager.detectFailure({
        statusCode: 503,
        message: 'Service Unavailable'
      });

      expect(result.failureType).toBe('server_error');
      expect(result.severity).toBe('low');
    });

    test('should detect network error', () => {
      const result = manager.detectFailure({
        message: 'DNS lookup failed'
      });

      expect(result.failureType).toBe('network_error');
      expect(result.severity).toBe('medium');
    });

    test('should return unknown for unrecognized errors', () => {
      const result = manager.detectFailure({
        message: 'Some weird error'
      });

      expect(result.failureType).toBe('unknown');
    });
  });

  describe('Recovery Strategies', () => {
    test('should provide recovery strategies for rate limit', () => {
      const strategies = manager.getRecoveryStrategies('rate_limit');

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].priority).toBe(1);
      expect(strategies[0].action).toBe('wait');
      expect(strategies[0].successRate).toBeGreaterThan(0);
      expect(strategies[0].successRate).toBeLessThanOrEqual(1);
    });

    test('should provide recovery strategies for bot detection', () => {
      const strategies = manager.getRecoveryStrategies('bot_detected');

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.map(s => s.action)).toContain('rotate_fingerprint');
      expect(strategies.map(s => s.action)).toContain('enable_behavioral_patterns');
    });

    test('should provide strategies for connection loss', () => {
      const strategies = manager.getRecoveryStrategies('connection_lost');

      expect(strategies[0].action).toBe('restore_from_checkpoint');
      expect(strategies[0].successRate).toBeGreaterThan(0.9); // High success rate
    });

    test('should prioritize recovery strategies', () => {
      const strategies = manager.getRecoveryStrategies('rate_limit');

      for (let i = 1; i < strategies.length; i++) {
        expect(strategies[i].priority).toBeGreaterThan(strategies[i - 1].priority);
      }
    });

    test('should provide fallback strategies for unknown types', () => {
      const strategies = manager.getRecoveryStrategies('unknown_type');

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].action).toBe('wait');
    });
  });

  // ==========================================
  // SESSION RESUMPTION
  // ==========================================

  describe('Session Resumption', () => {
    test('should resume from checkpoint after failure', () => {
      const cp = manager.createCheckpoint(sessionId, 'resume-test', mockSessionState);

      const result = manager.resumeSession(sessionId, cp.checkpointId, {
        strategy: 'rotate_proxy',
        retryAttempt: 1
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.checkpointId).toBe(cp.checkpointId);
      expect(result.resumedAt).toBeDefined();
      expect(result.attemptNumber).toBe(1);
    });

    test('should restore full state on resume', () => {
      const cp = manager.createCheckpoint(sessionId, 'state-resume', mockSessionState);
      const result = manager.resumeSession(sessionId, cp.checkpointId, {});

      expect(result.state).toEqual(mockSessionState);
    });

    test('should track multiple recovery attempts', () => {
      const cp = manager.createCheckpoint(sessionId, 'multi-attempt', mockSessionState);

      manager.resumeSession(sessionId, cp.checkpointId, { attempt: 1 });
      manager.resumeSession(sessionId, cp.checkpointId, { attempt: 2 });
      manager.resumeSession(sessionId, cp.checkpointId, { attempt: 3 });

      const result = manager.resumeSession(sessionId, cp.checkpointId, { attempt: 4 });
      expect(result.attemptNumber).toBe(4);
    });

    test('should throw for invalid checkpoint on resume', () => {
      expect(() => {
        manager.resumeSession(sessionId, 'invalid-id', {});
      }).toThrow('Checkpoint not found');
    });
  });

  // ==========================================
  // CHECKPOINT EXPORT
  // ==========================================

  describe('Checkpoint Export', () => {
    test('should export checkpoint successfully', () => {
      const cp = manager.createCheckpoint(sessionId, 'export-test', mockSessionState);
      const result = manager.exportCheckpoint(sessionId, cp.checkpointId);

      expect(result.exported).toBe(true);
      expect(result.exportedAt).toBeDefined();
      expect(result.checkpoint.id).toBe(cp.checkpointId);
      expect(result.checkpoint.name).toBe('export-test');
      expect(result.checkpoint.state).toEqual(mockSessionState);
      expect(result.checksum).toBeDefined();
    });

    test('should throw for non-existent checkpoint', () => {
      expect(() => {
        manager.exportCheckpoint(sessionId, 'non-existent');
      }).toThrow('Checkpoint not found');
    });

    test('should preserve checksum in export', () => {
      const cp1 = manager.createCheckpoint(sessionId, 'checksum1', mockSessionState);
      const cp2 = manager.createCheckpoint(sessionId, 'checksum2', mockSessionState);

      const export1 = manager.exportCheckpoint(sessionId, cp1.checkpointId);
      const export2 = manager.exportCheckpoint(sessionId, cp2.checkpointId);

      // Same state should produce same checksum
      expect(export1.checksum).toBe(export2.checksum);
    });
  });

  // ==========================================
  // INTEGRATION SCENARIOS
  // ==========================================

  describe('Integration Scenarios', () => {
    test('A/B testing workflow', () => {
      // Create initial checkpoint after successful navigation
      const baselineCP = manager.createCheckpoint(
        sessionId,
        'baseline',
        mockSessionState
      );

      // Branch for experiment A
      const branchA = manager.branchSession(
        sessionId,
        baselineCP.checkpointId,
        'experiment-a'
      );

      // Branch for experiment B
      const branchB = manager.branchSession(
        sessionId,
        baselineCP.checkpointId,
        'experiment-b'
      );

      // Merge results
      const resultA = manager.mergeBranch(branchA.branchId, {
        conversionRate: 0.35,
        bounceRate: 0.42
      });

      const resultB = manager.mergeBranch(branchB.branchId, {
        conversionRate: 0.52,
        bounceRate: 0.28
      });

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);

      const branches = manager.listBranches(sessionId);
      expect(branches.length).toBe(2);
      expect(branches.every(b => b.status === 'merged')).toBe(true);
    });

    test('Failure detection and recovery workflow', () => {
      const cp = manager.createCheckpoint(sessionId, 'recovery-test', mockSessionState);

      // Detect failure
      const failure = manager.detectFailure({
        message: 'Rate limit exceeded',
        statusCode: 429
      });

      expect(failure.failureType).toBe('rate_limit');
      expect(failure.recoverable).toBe(true);

      // Get recovery strategies
      const strategies = manager.getRecoveryStrategies(failure.failureType);
      expect(strategies.length).toBeGreaterThan(0);

      // Resume session with first strategy
      const resume = manager.resumeSession(sessionId, cp.checkpointId, {
        appliedStrategy: strategies[0].action
      });

      expect(resume.success).toBe(true);
      expect(resume.state).toBeDefined();
    });

    test('Complex multi-branch scenario', () => {
      const cp1 = manager.createCheckpoint(sessionId, 'stage-1', mockSessionState);

      // Create 3 test branches
      const branches = [
        manager.branchSession(sessionId, cp1.checkpointId, 'variant-a'),
        manager.branchSession(sessionId, cp1.checkpointId, 'variant-b'),
        manager.branchSession(sessionId, cp1.checkpointId, 'variant-c')
      ];

      // Create checkpoints in each branch
      branches.forEach((branch, idx) => {
        const branchState = {
          ...mockSessionState,
          url: `https://example.com/variant-${String.fromCharCode(97 + idx)}`
        };
        manager.createCheckpoint(branch.branchId, `variant-checkpoint-${idx}`, branchState);
      });

      // Merge all branches
      branches.forEach((branch, idx) => {
        manager.mergeBranch(branch.branchId, {
          variant: String.fromCharCode(97 + idx),
          successScore: 0.5 + idx * 0.1
        });
      });

      const finalBranches = manager.listBranches(sessionId);
      expect(finalBranches.length).toBe(3);
      expect(finalBranches.every(b => b.status === 'merged')).toBe(true);
    });
  });

  // ==========================================
  // EDGE CASES & STRESS TESTS
  // ==========================================

  describe('Edge Cases & Stress Tests', () => {
    test('should handle many sequential checkpoints', () => {
      for (let i = 0; i < 100; i++) {
        manager.createCheckpoint(sessionId, `checkpoint-${i}`, {
          ...mockSessionState,
          requestCount: i
        });
      }

      const checkpoints = manager.listCheckpoints(sessionId);
      expect(checkpoints.length).toBe(20); // Max checkpoints
      expect(checkpoints[0].name).toBe('checkpoint-80'); // First in list is 80
      expect(checkpoints[19].name).toBe('checkpoint-99'); // Last is 99
    });

    test('should handle deep checkpoint state with large objects', () => {
      const largeState = {
        ...mockSessionState,
        localStorage: Object.fromEntries(
          Array.from({ length: 100 }).map((_, i) => [`key-${i}`, `value-${i}`])
        )
      };

      const cp = manager.createCheckpoint(sessionId, 'large-state', largeState);
      const details = manager.getCheckpointDetails(sessionId, cp.checkpointId);

      expect(Object.keys(details.state.localStorage)).toHaveLength(100);
    });

    test('should handle concurrent operations', () => {
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      sessionIds.forEach(id => {
        manager.createCheckpoint(id, 'cp1', mockSessionState);
        manager.createCheckpoint(id, 'cp2', mockSessionState);
      });

      sessionIds.forEach(id => {
        expect(manager.listCheckpoints(id).length).toBe(2);
      });
    });
  });
});
