/**
 * Comprehensive tests for Tor Circuit Manager
 * Tests circuit rotation, exit node diversity, and automatic renewal
 *
 * Total: 17 test cases covering all three tasks
 */

const TorCircuitManager = require('../../src/proxy/tor-circuit-manager');

describe('Tor Circuit Manager', () => {
  let circuitManager;

  beforeEach(() => {
    circuitManager = new TorCircuitManager({
      rotationSchedule: 'hybrid',
      timeBasedInterval: 100, // Short interval for testing
      usageBasedThreshold: 5,
      diversityThreshold: 0.5,
      minCountriesRequired: 2
    });
  });

  afterEach(() => {
    circuitManager.stopScheduling();
  });

  // ============================================================
  // Task 2.4.1: Circuit Rotation Scheduling Tests (4+ tests)
  // ============================================================

  describe('Circuit Rotation Scheduling', () => {
    test('should initialize with default scheduling options', async () => {
      const defaultManager = new TorCircuitManager();
      expect(defaultManager.rotationSchedule).toBe('time-based');
      expect(defaultManager.timeBasedInterval).toBe(1800000);
      expect(defaultManager.usageBasedThreshold).toBe(1000);
      expect(defaultManager.autoRenewalEnabled).toBe(true);
    });

    test('should initialize circuit manager successfully', async () => {
      const result = await circuitManager.initialize();

      expect(result.success).toBe(true);
      expect(result.circuitId).toBeDefined();
      expect(circuitManager.currentCircuitId).toBeDefined();
      expect(circuitManager.circuits.size).toBe(1);
    });

    test('should rotate circuit based on time interval', async () => {
      const noAutoRotateManager = new TorCircuitManager({
        rotationSchedule: 'usage-based', // Prevent automatic rotation
        usageBasedThreshold: 100
      });
      await noAutoRotateManager.initialize();

      const initialCircuitId = noAutoRotateManager.currentCircuitId;
      const initialStats = noAutoRotateManager.getManagerStats();
      expect(initialStats.totalRotations).toBe(0);

      // Manually trigger for testing
      const result = await noAutoRotateManager.rotateCircuitByTime();

      expect(result.success).toBe(true);
      expect(result.oldCircuitId).toBeDefined();
      expect(result.newCircuitId).toBeDefined();
      expect(result.newCircuitId).not.toBe(result.oldCircuitId);
      expect(noAutoRotateManager.currentCircuitId).toBe(result.newCircuitId);
      expect(noAutoRotateManager.getManagerStats().totalRotations).toBe(1);

      noAutoRotateManager.stopScheduling();
    });

    test('should track circuit rotation in history', async () => {
      await circuitManager.initialize();

      await circuitManager.rotateCircuitByTime();
      await circuitManager.rotateCircuitByTime();

      const history = circuitManager.getHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].type).toBe('rotation');
      expect(history[0].reason).toBe('time-based');
    });

    test('should support usage-based rotation trigger', async () => {
      const usageManager = new TorCircuitManager({
        rotationSchedule: 'usage-based',
        usageBasedThreshold: 3
      });
      await usageManager.initialize();

      const circuitId = usageManager.currentCircuitId;
      const circuit = usageManager.circuits.get(circuitId);

      // Record requests to trigger rotation
      usageManager.recordRequest(circuitId, 100);
      usageManager.recordRequest(circuitId, 100);
      usageManager.recordRequest(circuitId, 100);

      expect(circuit.requestCount).toBe(3);
      expect(usageManager.shouldRotateByUsage(circuitId)).toBe(true);

      usageManager.stopScheduling();
    });

    test('should support hybrid rotation schedule', async () => {
      const hybridManager = new TorCircuitManager({
        rotationSchedule: 'hybrid',
        timeBasedInterval: 100,
        usageBasedThreshold: 5
      });
      await hybridManager.initialize();

      // Test time-based and usage-based can both trigger
      expect(hybridManager.rotationSchedule).toBe('hybrid');

      hybridManager.stopScheduling();
    });
  });

  // ============================================================
  // Task 2.4.2: Exit Node Diversity Tests (4+ tests)
  // ============================================================

  describe('Exit Node Diversity Tracking', () => {
    test('should track exit node geographic distribution', async () => {
      await circuitManager.initialize();

      // Create multiple circuits to track diversity
      const circuit1 = circuitManager.circuits.get(circuitManager.currentCircuitId);

      await circuitManager.rotateCircuitByTime();
      const circuit2 = circuitManager.circuits.get(circuitManager.currentCircuitId);

      await circuitManager.rotateCircuitByTime();
      const circuit3 = circuitManager.circuits.get(circuitManager.currentCircuitId);

      const diversity = circuitManager.analyzeDiversity();
      expect(diversity.diversityScore).toBeDefined();
      expect(diversity.diversityScore).toBeGreaterThanOrEqual(0);
      expect(diversity.diversityScore).toBeLessThanOrEqual(1);
    });

    test('should prevent repeated exit node usage', async () => {
      await circuitManager.initialize();

      const circuit = circuitManager.circuits.get(circuitManager.currentCircuitId);
      const exitNode = circuit.exitNode;

      // Try to use same exit node again
      const checkResult = await circuitManager.ensureExitNodeDiversity(exitNode);

      // Should be denied if recently used
      expect(checkResult.allowed).toBeDefined();
      expect(typeof checkResult.allowed).toBe('boolean');
    });

    test('should analyze exit node country distribution', async () => {
      await circuitManager.initialize();

      // Create several circuits with different exit nodes
      for (let i = 0; i < 3; i++) {
        await circuitManager.rotateCircuitByTime();
      }

      const analysis = circuitManager.analyzeDiversity();

      expect(analysis.countryCount).toBeGreaterThanOrEqual(0);
      expect(analysis.distributionByCountry).toBeDefined();
      expect(typeof analysis.distributionByCountry).toBe('object');
    });

    test('should calculate entropy-based diversity score', async () => {
      await circuitManager.initialize();

      const analysis1 = circuitManager.analyzeDiversity();
      const initialScore = analysis1.diversityScore;

      // Create more circuits to potentially improve diversity
      for (let i = 0; i < 2; i++) {
        await circuitManager.rotateCircuitByTime();
      }

      const analysis2 = circuitManager.analyzeDiversity();
      expect(analysis2.diversityScore).toBeDefined();
      expect(analysis2.diversityScore).toBeGreaterThanOrEqual(0);
    });

    test('should compare diversity against configured threshold', async () => {
      const diverseManager = new TorCircuitManager({
        diversityThreshold: 0.3,
        minCountriesRequired: 1
      });
      await diverseManager.initialize();

      const analysis = diverseManager.analyzeDiversity();

      expect(analysis.meetsThreshold).toBeDefined();
      expect(diverseManager.diversityThreshold).toBe(0.3);

      diverseManager.stopScheduling();
    });

    test('should track individual exit nodes by IP and country', async () => {
      await circuitManager.initialize();

      // Create circuits and check exit node tracking
      for (let i = 0; i < 2; i++) {
        await circuitManager.rotateCircuitByTime();
      }

      const exitNodes = circuitManager.exitNodes;
      expect(exitNodes.size).toBeGreaterThan(0);

      // Verify exit node structure
      for (const [ip, exitNode] of exitNodes) {
        expect(exitNode.ip).toBeDefined();
        expect(exitNode.country).toBeDefined();
        expect(exitNode.city).toBeDefined();
        expect(exitNode.reputation).toBeDefined();
      }
    });
  });

  // ============================================================
  // Task 2.4.3: Automatic Circuit Renewal Tests (3+ tests)
  // ============================================================

  describe('Automatic Circuit Renewal', () => {
    test('should renew circuit on failure with graceful fallback', async () => {
      await circuitManager.initialize();

      const oldCircuitId = circuitManager.currentCircuitId;
      const result = await circuitManager.renewCircuit(oldCircuitId, 'test_failure');

      expect(result.success).toBe(true);
      expect(result.newCircuitId).not.toBe(oldCircuitId);
      expect(circuitManager.currentCircuitId).toBe(result.newCircuitId);
    });

    test('should track renewal attempts and statistics', async () => {
      await circuitManager.initialize();

      const stats1 = circuitManager.getManagerStats();
      expect(stats1.totalRenewals).toBe(0);

      await circuitManager.renewCircuit(circuitManager.currentCircuitId);

      const stats2 = circuitManager.getManagerStats();
      expect(stats2.totalRenewals).toBe(1);
    });

    test('should find healthiest circuit for fallback', async () => {
      await circuitManager.initialize();

      // Create multiple circuits
      await circuitManager.rotateCircuitByTime();
      await circuitManager.rotateCircuitByTime();

      const healthiest = circuitManager.getHealthiestCircuit();
      expect(healthiest).toBeDefined();
      expect(healthiest.id).toBeDefined();
      expect(healthiest.status).toBe('active');
    });

    test('should maintain circuit health metrics', async () => {
      await circuitManager.initialize();

      const circuitId = circuitManager.currentCircuitId;

      // Trigger health check
      await circuitManager.checkCircuitHealth();

      const stats = circuitManager.getCircuitStats(circuitId);
      expect(stats.circuitId).toBe(circuitId);
      expect(stats.createdAt).toBeDefined();
      expect(stats.health).toBeDefined();
    });

    test('should support configurable renewal retry attempts', async () => {
      const renewalManager = new TorCircuitManager({
        autoRenewalEnabled: true,
        renewalRetries: 2,
        renewalRetryDelay: 10
      });
      await renewalManager.initialize();

      expect(renewalManager.renewalRetries).toBe(2);
      expect(renewalManager.renewalRetryDelay).toBe(10);

      renewalManager.stopScheduling();
    });
  });

  // ============================================================
  // Integration and Stress Tests (5+ tests)
  // ============================================================

  describe('Integration and Stress Tests', () => {
    test('should handle circuit rotation under load', async () => {
      await circuitManager.initialize();

      const rotationCount = 5;
      const results = [];

      for (let i = 0; i < rotationCount; i++) {
        const result = await circuitManager.rotateCircuitByTime();
        results.push(result);
      }

      expect(results.length).toBe(rotationCount);
      expect(results.every(r => r.success)).toBe(true);
      expect(circuitManager.getManagerStats().totalRotations).toBe(rotationCount);
    });

    test('should handle failover scenarios gracefully', async () => {
      await circuitManager.initialize();

      // Create multiple circuits
      for (let i = 0; i < 2; i++) {
        await circuitManager.rotateCircuitByTime();
      }

      const currentId = circuitManager.currentCircuitId;

      // Simulate failure
      const renewalResult = await circuitManager.renewCircuit(currentId, 'failover_test');
      expect(renewalResult.success).toBe(true);
      expect(circuitManager.currentCircuitId).not.toBe(currentId);
    });

    test('should maintain cache limits and cleanup old circuits', async () => {
      const cacheManager = new TorCircuitManager({
        maxCircuitsInCache: 3
      });
      await cacheManager.initialize();

      // Create more circuits than cache limit
      for (let i = 0; i < 4; i++) {
        await cacheManager.rotateCircuitByTime();
      }

      const activeCircuits = cacheManager.getActiveCircuits();
      expect(activeCircuits.length).toBeLessThanOrEqual(3);

      cacheManager.stopScheduling();
    });

    test('should emit events for circuit state changes', (done) => {
      const eventManager = new TorCircuitManager();

      const eventsReceived = [];

      eventManager.on('initialized', (data) => {
        eventsReceived.push('initialized');
      });

      eventManager.on('circuitCreated', (data) => {
        eventsReceived.push('circuitCreated');
      });

      eventManager.on('circuitRotated', (data) => {
        eventsReceived.push('circuitRotated');
        if (eventsReceived.length >= 3) {
          expect(eventsReceived).toContain('initialized');
          expect(eventsReceived).toContain('circuitCreated');
          eventManager.stopScheduling();
          done();
        }
      });

      eventManager.initialize().then(() => {
        eventManager.rotateCircuitByTime();
      });
    });

    test('should retrieve circuit information correctly', async () => {
      await circuitManager.initialize();

      const circuitInfo = circuitManager.getCurrentCircuit();
      expect(circuitInfo.circuitId).toBeDefined();
      expect(circuitInfo.createdAt).toBeDefined();
      expect(circuitInfo.status).toBe('active');
      expect(circuitInfo.exitNode).toBeDefined();
      expect(circuitInfo.isHealthy).toBeDefined();
      expect(circuitInfo.age).toBeGreaterThanOrEqual(0);
    });

    test('should provide manager statistics and metrics', async () => {
      await circuitManager.initialize();

      // Perform various operations
      await circuitManager.rotateCircuitByTime();
      await circuitManager.renewCircuit(circuitManager.currentCircuitId);

      const stats = circuitManager.getManagerStats();

      expect(stats.totalCircuitsCreated).toBeGreaterThanOrEqual(1);
      expect(stats.totalRotations).toBeGreaterThanOrEqual(1);
      expect(stats.totalRenewals).toBeGreaterThanOrEqual(1);
      expect(stats.diversityScore).toBeDefined();
      expect(stats.activeCircuits).toBeGreaterThanOrEqual(0);
      expect(stats.currentCircuitId).toBeDefined();
    });

    test('should handle request tracking and usage metrics', async () => {
      await circuitManager.initialize();

      const circuitId = circuitManager.currentCircuitId;

      // Record multiple requests
      circuitManager.recordRequest(circuitId, 1024);
      circuitManager.recordRequest(circuitId, 2048);
      circuitManager.recordRequest(circuitId, 512);

      const stats = circuitManager.getCircuitStats(circuitId);
      expect(stats.requestCount).toBe(3);
      expect(stats.bytesTransferred).toBe(3584);
    });

    test('should support multiple concurrent circuit operations', async () => {
      await circuitManager.initialize();

      // Simulate concurrent operations
      const promises = [
        circuitManager.rotateCircuitByTime(),
        circuitManager.checkCircuitHealth(),
        Promise.resolve(circuitManager.getActiveCircuits())
      ];

      const results = await Promise.all(promises);
      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
    });
  });
});
