/**
 * Detection Evasion v2 Tests (Wave 16 Phase 6)
 * 32+ test scenarios for 50+ detection vectors
 */

const DetectionEvasionV2 = require('../../src/features/detection-evasion-v2');

describe('DetectionEvasionV2', () => {
  let engine;

  beforeEach(() => {
    engine = new DetectionEvasionV2({
      targetEvasionRate: 0.92,
      adaptiveMode: true,
      mlEnabled: true,
      autoTuning: true
    });
  });

  describe('Initialization', () => {
    test('should initialize with 50+ detection vectors', () => {
      expect(engine.vectorCount).toBeGreaterThanOrEqual(50);
    });

    test('should register all vector types', () => {
      const vectorTypes = new Set();
      for (const [id, vector] of engine.tracker.vectors) {
        vectorTypes.add(vector.type);
      }

      expect(vectorTypes.size).toBeGreaterThan(5);
    });

    test('should initialize detection tracker', () => {
      expect(engine.tracker).toBeDefined();
      expect(engine.tracker.vectors.size).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    test('should create evasion session', () => {
      const result = engine.createEvasionSession('session-1', {
        targetEvasionRate: 0.92
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-1');
    });

    test('should initialize all vectors for session', () => {
      engine.createEvasionSession('session-1');
      const session = engine.activeSessions.get('session-1');

      expect(session.vectorStatus.size).toBeGreaterThan(0);
    });

    test('should allow custom vector selection', () => {
      const vectorIds = ['canvas-basic', 'webgl-vendor'];
      const result = engine.createEvasionSession('session-1', {
        enabledVectors: vectorIds
      });

      expect(result.success).toBe(true);
      expect(result.vectorCount).toBe(2);
    });
  });

  describe('Evasion Application', () => {
    beforeEach(() => {
      engine.createEvasionSession('session-1');
    });

    test('should apply evasion configuration', () => {
      const result = engine.applyEvasion('session-1');

      expect(result.success).toBe(true);
      expect(Object.keys(result.evasionConfig).length).toBeGreaterThan(0);
    });

    test('should apply selective evasion', () => {
      const vectors = ['canvas-basic', 'webgl-vendor'];
      const result = engine.applyEvasion('session-1', vectors);

      expect(result.success).toBe(true);
      expect(Object.keys(result.evasionConfig).length).toBeGreaterThanOrEqual(1);
    });

    test('should include evasion strategies', () => {
      const result = engine.applyEvasion('session-1');

      for (const [vectorId, config] of Object.entries(result.evasionConfig)) {
        expect(config.strategy).toBeDefined();
        expect(config.config).toBeDefined();
      }
    });
  });

  describe('Detection Reporting', () => {
    beforeEach(() => {
      engine.createEvasionSession('session-1');
      engine.applyEvasion('session-1');
    });

    test('should report successful evasion', () => {
      const result = engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);

      expect(result.success).toBe(true);
    });

    test('should report detection failure', () => {
      const result = engine.reportDetection('session-1', 'canvas-basic', 'fpjs', true);

      expect(result.success).toBe(true);
    });

    test('should update success rates', () => {
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', true);

      const metrics = engine.getSessionMetrics('session-1');
      expect(metrics.metrics.vectorDetails['canvas-basic'].successRate).toBeGreaterThan(0);
    });

    test('should trigger adaptation on failure', () => {
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', true);

      const session = engine.activeSessions.get('session-1');
      const status = session.vectorStatus.get('canvas-basic');

      expect(status.adaptations).toBeGreaterThan(0);
    });
  });

  describe('Vector Coverage', () => {
    test('should cover canvas fingerprinting vectors', () => {
      const canvasVectors = Array.from(engine.tracker.vectors.values())
        .filter(v => v.type === 'canvas');

      expect(canvasVectors.length).toBeGreaterThanOrEqual(5);
    });

    test('should cover WebGL vectors', () => {
      const webglVectors = Array.from(engine.tracker.vectors.values())
        .filter(v => v.type === 'webgl');

      expect(webglVectors.length).toBeGreaterThanOrEqual(5);
    });

    test('should cover audio vectors', () => {
      const audioVectors = Array.from(engine.tracker.vectors.values())
        .filter(v => v.type === 'audio');

      expect(audioVectors.length).toBeGreaterThanOrEqual(5);
    });

    test('should cover WebRTC vectors', () => {
      const webrtcVectors = Array.from(engine.tracker.vectors.values())
        .filter(v => v.type === 'webrtc');

      expect(webrtcVectors.length).toBeGreaterThanOrEqual(5);
    });

    test('should cover behavioral vectors', () => {
      const behavioralVectors = Array.from(engine.tracker.vectors.values())
        .filter(v => v.type === 'behavioral');

      expect(behavioralVectors.length).toBeGreaterThanOrEqual(5);
    });

    test('should cover network vectors', () => {
      const networkVectors = Array.from(engine.tracker.vectors.values())
        .filter(v => v.type === 'network');

      expect(networkVectors.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Session Metrics', () => {
    beforeEach(() => {
      engine.createEvasionSession('session-1');
    });

    test('should calculate session metrics', () => {
      const result = engine.getSessionMetrics('session-1');

      expect(result.success).toBe(true);
      expect(result.metrics.totalVectors).toBeGreaterThan(0);
    });

    test('should calculate average success rate', () => {
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);
      engine.reportDetection('session-1', 'webgl-vendor', 'fpjs', false);

      const result = engine.getSessionMetrics('session-1');
      expect(result.metrics.averageSuccessRate).toBeGreaterThanOrEqual(0);
    });

    test('should track individual vector status', () => {
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);

      const result = engine.getSessionMetrics('session-1');
      expect(result.metrics.vectorDetails['canvas-basic']).toBeDefined();
    });
  });

  describe('Adaptive Mode', () => {
    test('should enable adaptive mode', () => {
      const adaptiveEngine = new DetectionEvasionV2({ adaptiveMode: true });
      adaptiveEngine.createEvasionSession('session-1');

      expect(adaptiveEngine.adaptiveMode).toBe(true);
    });

    test('should trigger adaptation on detection', () => {
      engine.createEvasionSession('session-1');

      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', true);
      const session = engine.activeSessions.get('session-1');
      const status = session.vectorStatus.get('canvas-basic');

      expect(status.adaptations).toBeGreaterThan(0);
    });

    test('should record adaptation history', () => {
      engine.createEvasionSession('session-1');

      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', true);
      engine.reportDetection('session-1', 'webgl-vendor', 'fpjs', true);

      const session = engine.activeSessions.get('session-1');
      expect(session.adaptationHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Overall Statistics', () => {
    test('should calculate overall statistics', () => {
      engine.createEvasionSession('session-1');
      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);

      const result = engine.getOverallStats();

      expect(result.success).toBe(true);
      expect(result.stats.totalVectors).toBeGreaterThan(0);
      expect(result.stats.activeSessions).toBeGreaterThan(0);
    });

    test('should track evasion rate', () => {
      engine.createEvasionSession('session-1');

      for (let i = 0; i < 10; i++) {
        engine.reportDetection('session-1', 'canvas-basic', 'fpjs', i % 2 === 0);
      }

      const result = engine.getOverallStats();
      expect(result.stats.overallEvasionRate).toBeGreaterThanOrEqual(0);
      expect(result.stats.overallEvasionRate).toBeLessThanOrEqual(1);
    });

    test('should compare against target evasion rate', () => {
      const result = engine.getOverallStats();

      expect(result.stats.targetEvasionRate).toBe(0.92);
      expect(result.stats.targetMet).toBeDefined();
    });
  });

  describe('Session Closure', () => {
    test('should close session', () => {
      engine.createEvasionSession('session-1');

      const result = engine.closeSession('session-1');

      expect(result.success).toBe(true);
      expect(result.finalMetrics).toBeDefined();
    });

    test('should prevent operations on closed session', () => {
      engine.createEvasionSession('session-1');
      engine.closeSession('session-1');

      const result = engine.applyEvasion('session-1');
      expect(result.success).toBe(false);
    });

    test('should emit session closed event', (done) => {
      engine.createEvasionSession('session-1');

      engine.on('session:closed', (event) => {
        expect(event.sessionId).toBe('session-1');
        done();
      });

      engine.closeSession('session-1');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid session ID', () => {
      const result = engine.applyEvasion('nonexistent');
      expect(result.success).toBe(false);
    });

    test('should handle invalid vector ID', () => {
      engine.createEvasionSession('session-1');

      const result = engine.applyEvasion('session-1', ['invalid-vector']);
      expect(result.success).toBe(true);
    });

    test('should handle detection on closed session', () => {
      engine.createEvasionSession('session-1');
      engine.closeSession('session-1');

      const result = engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);
      expect(result.success).toBe(false);
    });
  });

  describe('Events', () => {
    test('should emit vectors initialized event', (done) => {
      const newEngine = new DetectionEvasionV2();

      newEngine.on('vectors:initialized', (event) => {
        expect(event.count).toBeGreaterThan(0);
        done();
      });
    });

    test('should emit session created event', (done) => {
      engine.on('session:created', (event) => {
        expect(event.sessionId).toBe('session-1');
        done();
      });

      engine.createEvasionSession('session-1');
    });

    test('should emit evasion applied event', (done) => {
      engine.createEvasionSession('session-1');

      engine.on('evasion:applied', (event) => {
        expect(event.sessionId).toBe('session-1');
        done();
      });

      engine.applyEvasion('session-1');
    });

    test('should emit detection reported event', (done) => {
      engine.createEvasionSession('session-1');

      engine.on('detection:reported', (event) => {
        expect(event.sessionId).toBe('session-1');
        done();
      });

      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', false);
    });

    test('should emit vector adapted event', (done) => {
      engine.createEvasionSession('session-1');

      engine.on('vector:adapted', (event) => {
        expect(event.vectorId).toBeDefined();
        done();
      });

      engine.reportDetection('session-1', 'canvas-basic', 'fpjs', true);
    });
  });

  describe('Performance', () => {
    test('should handle multiple concurrent sessions', () => {
      for (let i = 0; i < 10; i++) {
        engine.createEvasionSession(`session-${i}`);
      }

      expect(engine.activeSessions.size).toBe(10);
    });

    test('should handle rapid detection reports', () => {
      engine.createEvasionSession('session-1');

      for (let i = 0; i < 100; i++) {
        engine.reportDetection('session-1', 'canvas-basic', 'fpjs', i % 2 === 0);
      }

      const metrics = engine.getSessionMetrics('session-1');
      expect(metrics.success).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should respect target evasion rate', () => {
      const highTargetEngine = new DetectionEvasionV2({
        targetEvasionRate: 0.99
      });

      expect(highTargetEngine.targetEvasionRate).toBe(0.99);
    });

    test('should support ML mode', () => {
      const mlEngine = new DetectionEvasionV2({ mlEnabled: true });
      expect(mlEngine.mlEnabled).toBe(true);
    });

    test('should support auto-tuning', () => {
      const tuningEngine = new DetectionEvasionV2({ autoTuning: true });
      expect(tuningEngine.autoTuning).toBe(true);
    });
  });
});
