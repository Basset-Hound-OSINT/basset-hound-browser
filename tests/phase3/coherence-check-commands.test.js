/**
 * Coherence Check WebSocket Commands Tests
 * Tests for session coherence validation WebSocket API
 */

const {
  registerCoherenceCheckCommands,
  getSessionCoherence
} = require('../../websocket/commands/coherence-check');

describe('CoherenceCheckCommands', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerCoherenceCheckCommands(commandHandlers);
  });

  describe('Session Initialization', () => {
    test('coherence_init_session should initialize session', async () => {
      const result = await commandHandlers.coherence_init_session({
        sessionId: 'session_1',
        initialData: {
          os: 'Windows',
          browser: 'Chrome',
          fingerprint: { canvas: 'test' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_1');
      expect(result.initialized).toBe(true);
    });

    test('coherence_init_session should require sessionId', async () => {
      const result = await commandHandlers.coherence_init_session({
        initialData: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId');
    });

    test('coherence_init_session should accept empty initialData', async () => {
      const result = await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Interaction Recording', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
    });

    test('coherence_record_interaction should record interaction', async () => {
      const result = await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: {
          type: 'click',
          behavior: { mouseSpeed: 50 }
        }
      });

      expect(result.success).toBe(true);
      expect(result.interactionId).toBeDefined();
    });

    test('coherence_record_interaction should provide detailed validation', async () => {
      const result = await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: {
          type: 'navigate',
          network: { ip: '192.168.1.1' },
          device: { canvas: 'hash1' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.detailedValidation).toBeDefined();
      expect(result.detailedValidation.overallScore).toBeDefined();
    });

    test('coherence_record_interaction should require params', async () => {
      const result = await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Session Coherence Validation', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
    });

    test('validate_session_coherence should perform full validation', async () => {
      const result = await commandHandlers.validate_session_coherence({
        sessionId: 'session_1',
        requestData: {
          network: {
            ip: '192.168.1.1',
            geolocation: {
              latitude: 40.7128,
              longitude: -74.0060
            }
          },
          tls: {
            ja3: 'test_ja3'
          },
          device: {
            canvas: 'canvas_hash'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_1');
      expect(result.overallCoherence).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('validate_session_coherence should provide violation summary', async () => {
      const result = await commandHandlers.validate_session_coherence({
        sessionId: 'session_1',
        requestData: {
          network: { ip: '192.168.1.1' }
        }
      });

      expect(result.violationSummary).toBeDefined();
      expect(result.violationSummary.critical).toBeDefined();
      expect(result.violationSummary.high).toBeDefined();
      expect(result.violationSummary.medium).toBeDefined();
      expect(result.violationSummary.low).toBeDefined();
    });

    test('validate_session_coherence should require sessionId', async () => {
      const result = await commandHandlers.validate_session_coherence({
        requestData: {}
      });

      expect(result.success).toBe(false);
    });

    test('validate_session_coherence should handle missing session', async () => {
      const result = await commandHandlers.validate_session_coherence({
        sessionId: 'nonexistent',
        requestData: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Coherence Score', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
      await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: {
          type: 'click'
        }
      });
    });

    test('get_coherence_score should return scores', async () => {
      const result = await commandHandlers.get_coherence_score({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(true);
      expect(result.score).toBeDefined();
      expect(result.score.overall).toBeDefined();
      expect(result.score.temporal).toBeDefined();
      expect(result.score.behavioral).toBeDefined();
      expect(result.score.network).toBeDefined();
      expect(result.score.device).toBeDefined();
      expect(result.score.timeline).toBeDefined();
    });

    test('get_coherence_score should provide components info', async () => {
      const result = await commandHandlers.get_coherence_score({
        sessionId: 'session_1'
      });

      expect(result.components).toBeDefined();
      expect(result.components.interactionCount).toBeGreaterThan(0);
    });

    test('get_coherence_score should require sessionId', async () => {
      const result = await commandHandlers.get_coherence_score({});

      expect(result.success).toBe(false);
    });
  });

  describe('Violations Retrieval', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1',
        initialData: { behavior: { typingSpeed: 50 } }
      });

      // Record interaction with violation
      await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: {
          type: 'type',
          behavior: { typingSpeed: 150 }  // Violation
        }
      });
    });

    test('get_coherence_violations should return violations', async () => {
      const result = await commandHandlers.get_coherence_violations({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(true);
      expect(result.violations).toBeDefined();
      expect(result.count).toBeLessThanOrEqual(10);
    });

    test('get_coherence_violations should support limit parameter', async () => {
      const result = await commandHandlers.get_coherence_violations({
        sessionId: 'session_1',
        limit: 5
      });

      expect(result.count).toBeLessThanOrEqual(5);
    });

    test('get_coherence_violations should support layer filter', async () => {
      const result = await commandHandlers.get_coherence_violations({
        sessionId: 'session_1',
        layer: 'behavioral'
      });

      expect(result.filtered).toBe(true);
      expect(result.filterCriteria.layer).toBe('behavioral');
    });

    test('get_coherence_violations should support severity filter', async () => {
      const result = await commandHandlers.get_coherence_violations({
        sessionId: 'session_1',
        severity: 'high'
      });

      expect(result.filtered).toBe(true);
      expect(result.filterCriteria.severity).toBe('high');
    });
  });

  describe('Coherence Report', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
      await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: { type: 'click' }
      });
    });

    test('get_coherence_report should return comprehensive report', async () => {
      const result = await commandHandlers.get_coherence_report({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_1');
      expect(result.duration).toBeDefined();
      expect(result.interactionCount).toBeGreaterThan(0);
      expect(result.overallCoherence).toBeDefined();
      expect(result.layers).toBeDefined();
    });

    test('get_coherence_report should include layer details', async () => {
      const result = await commandHandlers.get_coherence_report({
        sessionId: 'session_1'
      });

      expect(result.layers.temporal).toBeDefined();
      expect(result.layers.behavioral).toBeDefined();
      expect(result.layers.network).toBeDefined();
      expect(result.layers.device).toBeDefined();
      expect(result.layers.timeline).toBeDefined();
    });

    test('get_coherence_report should require sessionId', async () => {
      const result = await commandHandlers.get_coherence_report({});

      expect(result.success).toBe(false);
    });
  });

  describe('Recovery Mechanisms', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
      await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: {
          type: 'click',
          behavior: { typingSpeed: 200 }  // Violation
        }
      });
    });

    test('coherence_attempt_recovery should suggest recovery actions', async () => {
      const result = await commandHandlers.coherence_attempt_recovery({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(true);
      expect(result.attempt).toBeGreaterThan(0);
      expect(result.actions).toBeDefined();
    });

    test('coherence_attempt_recovery should filter by violation type', async () => {
      const result = await commandHandlers.coherence_attempt_recovery({
        sessionId: 'session_1',
        violationType: 'behavioral'
      });

      expect(result.success).toBe(true);
      if (result.actions.length > 0) {
        expect(result.actions[0].type).toBeDefined();
      }
    });

    test('coherence_attempt_recovery should require sessionId', async () => {
      const result = await commandHandlers.coherence_attempt_recovery({});

      expect(result.success).toBe(false);
    });
  });

  describe('Coherence Modes', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
    });

    test('set_coherence_mode should configure mode', async () => {
      const result = await commandHandlers.set_coherence_mode({
        sessionId: 'session_1',
        mode: 'strict'
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('strict');
      expect(result.thresholds).toBeDefined();
    });

    test('set_coherence_mode should support all modes', async () => {
      const modes = ['strict', 'moderate', 'relaxed', 'monitoring'];

      for (const mode of modes) {
        const result = await commandHandlers.set_coherence_mode({
          sessionId: 'session_1',
          mode
        });

        expect(result.success).toBe(true);
        expect(result.mode).toBe(mode);
      }
    });

    test('set_coherence_mode should reject invalid mode', async () => {
      const result = await commandHandlers.set_coherence_mode({
        sessionId: 'session_1',
        mode: 'invalid_mode'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid mode');
    });

    test('set_coherence_mode should require sessionId', async () => {
      const result = await commandHandlers.set_coherence_mode({
        mode: 'strict'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
      await commandHandlers.coherence_init_session({
        sessionId: 'session_2'
      });
      await commandHandlers.coherence_init_session({
        sessionId: 'session_3'
      });
    });

    test('list_coherence_sessions should list all sessions', async () => {
      const result = await commandHandlers.list_coherence_sessions({});

      expect(result.success).toBe(true);
      expect(result.sessions).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(3);
    });

    test('list_coherence_sessions should include session details', async () => {
      const result = await commandHandlers.list_coherence_sessions({});

      expect(result.sessions[0]).toHaveProperty('sessionId');
      expect(result.sessions[0]).toHaveProperty('duration');
      expect(result.sessions[0]).toHaveProperty('score');
      expect(result.sessions[0]).toHaveProperty('interactionCount');
    });

    test('delete_coherence_session should delete session', async () => {
      const deleteResult = await commandHandlers.delete_coherence_session({
        sessionId: 'session_1'
      });

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deleted).toBe(true);

      const listResult = await commandHandlers.list_coherence_sessions({});
      const sessionIds = listResult.sessions.map(s => s.sessionId);

      expect(sessionIds).not.toContain('session_1');
    });

    test('delete_coherence_session should require sessionId', async () => {
      const result = await commandHandlers.delete_coherence_session({});

      expect(result.success).toBe(false);
    });
  });

  describe('Layer Details', () => {
    beforeEach(async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'session_1'
      });
      await commandHandlers.coherence_record_interaction({
        sessionId: 'session_1',
        interactionData: {
          type: 'click',
          fingerprint: { canvas: 'hash1' }
        }
      });
    });

    test('get_layer_details should return layer-specific data', async () => {
      const result = await commandHandlers.get_layer_details({
        sessionId: 'session_1',
        layer: 1
      });

      expect(result.success).toBe(true);
      expect(result.layer).toBe(1);
      expect(result.layerName).toBe('temporal');
      expect(result.violations).toBeDefined();
    });

    test('get_layer_details should support detailed mode', async () => {
      const result = await commandHandlers.get_layer_details({
        sessionId: 'session_1',
        layer: 1,
        detailed: true
      });

      expect(result.success).toBe(true);
      expect(result.violations).toBeDefined();
    });

    test('get_layer_details should validate layer range', async () => {
      const resultLow = await commandHandlers.get_layer_details({
        sessionId: 'session_1',
        layer: 0
      });

      expect(resultLow.success).toBe(false);

      const resultHigh = await commandHandlers.get_layer_details({
        sessionId: 'session_1',
        layer: 6
      });

      expect(resultHigh.success).toBe(false);
    });

    test('get_layer_details should require sessionId and layer', async () => {
      const result = await commandHandlers.get_layer_details({
        sessionId: 'session_1'
      });

      expect(result.success).toBe(false);
    });

    test('get_layer_details should provide layer-specific metrics', async () => {
      const result = await commandHandlers.get_layer_details({
        sessionId: 'session_1',
        layer: 1
      });

      // Layer 1 (temporal) should have these properties
      expect(result.temporalScore).toBeDefined();
      expect(result.fpHistoryLength).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid sessionId gracefully', async () => {
      const result = await commandHandlers.get_coherence_score({
        sessionId: 'invalid_session'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing required parameters', async () => {
      const result = await commandHandlers.validate_session_coherence({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle exceptions gracefully', async () => {
      // This should not throw an exception
      const result = await commandHandlers.coherence_init_session(null);

      // Should either handle it or throw appropriately
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    test('should handle rapid command execution', async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'perf_session'
      });

      const start = Date.now();

      for (let i = 0; i < 50; i++) {
        await commandHandlers.coherence_record_interaction({
          sessionId: 'perf_session',
          interactionData: {
            type: 'click',
            behavior: { mouseSpeed: 50 }
          }
        });
      }

      const duration = Date.now() - start;

      // 50 interactions should complete in < 500ms
      expect(duration).toBeLessThan(500);
    });

    test('should retrieve score efficiently', async () => {
      await commandHandlers.coherence_init_session({
        sessionId: 'perf_session'
      });

      for (let i = 0; i < 100; i++) {
        await commandHandlers.coherence_record_interaction({
          sessionId: 'perf_session',
          interactionData: { type: 'click' }
        });
      }

      const start = Date.now();

      for (let i = 0; i < 20; i++) {
        await commandHandlers.get_coherence_score({
          sessionId: 'perf_session'
        });
      }

      const duration = Date.now() - start;

      // 20 score retrievals should complete in < 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
