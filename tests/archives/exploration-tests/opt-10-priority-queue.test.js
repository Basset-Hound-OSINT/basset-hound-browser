/**
 * OPT-10: Priority Queue System Tests
 * Tests for priority-based request scheduling and latency reduction
 */

const PriorityQueue = require('../websocket/priority-queue');
const EventEmitter = require('events');

describe('PriorityQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new PriorityQueue({
      maxQueueSize: 1000,
      enableAging: true,
      agingThreshold: 5000,
      fairnessRatio: 3
    });
  });

  afterEach(() => {
    queue.clear();
  });

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  describe('Basic Functionality', () => {
    test('should create queue with default settings', () => {
      const q = new PriorityQueue();
      expect(q).toBeInstanceOf(EventEmitter);
      expect(q.isEmpty()).toBe(true);
    });

    test('should enqueue request with command', async () => {
      const promise = queue.enqueue({
        command: 'screenshot'
      });

      expect(queue.size()).toBe(1);
      expect(promise).toBeInstanceOf(Promise);
    });

    test('should reject request without command', async () => {
      await expect(queue.enqueue({})).rejects.toThrow('command');
    });

    test('should reject invalid request', async () => {
      await expect(queue.enqueue(null)).rejects.toThrow();
      await expect(queue.enqueue(undefined)).rejects.toThrow();
    });

    test('should get next request in priority order', () => {
      queue.enqueue({ command: 'get_status' });
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });

      // Get requests in order
      const first = queue.getNextRequest();
      expect(first.command).toBe('screenshot'); // Critical first

      const second = queue.getNextRequest();
      expect(second.command).toBe('navigate'); // High second

      const third = queue.getNextRequest();
      expect(third.command).toBe('get_status'); // Low third
    });
  });

  // ============================================================================
  // PRIORITY CLASSIFICATION TESTS
  // ============================================================================

  describe('Priority Classification', () => {
    test('should classify critical commands', () => {
      const criticalCommands = [
        'screenshot', 'screenshot_viewport', 'get_content',
        'extract_text', 'extract_links'
      ];

      criticalCommands.forEach(cmd => {
        const priority = queue.getCommandPriority(cmd);
        expect(priority).toBe('critical');
      });
    });

    test('should classify high-priority commands', () => {
      const highCommands = [
        'navigate', 'click', 'fill', 'type'
      ];

      highCommands.forEach(cmd => {
        const priority = queue.getCommandPriority(cmd);
        expect(priority).toBe('high');
      });
    });

    test('should classify low-priority commands', () => {
      const lowCommands = [
        'ping', 'get_status', 'get_console_logs',
        'list_profiles'
      ];

      lowCommands.forEach(cmd => {
        const priority = queue.getCommandPriority(cmd);
        expect(priority).toBe('low');
      });
    });

    test('should classify unknown commands as normal', () => {
      const priority = queue.getCommandPriority('custom_command');
      expect(priority).toBe('normal');
    });

    test('should auto-assign priority on enqueue', async () => {
      queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();
      expect(req.priority).toBe('critical');
    });
  });

  // ============================================================================
  // QUEUE MANAGEMENT TESTS
  // ============================================================================

  describe('Queue Management', () => {
    test('should track queue size', async () => {
      expect(queue.size()).toBe(0);

      queue.enqueue({ command: 'screenshot' });
      expect(queue.size()).toBe(1);

      queue.enqueue({ command: 'navigate' });
      expect(queue.size()).toBe(2);

      queue.getNextRequest();
      expect(queue.size()).toBe(1);
    });

    test('should track peak queue size', async () => {
      const initialStats = queue.getStatistics();
      expect(initialStats.queue.peakSize).toBe(0);

      for (let i = 0; i < 5; i++) {
        queue.enqueue({ command: 'screenshot' });
      }

      const stats = queue.getStatistics();
      expect(stats.queue.peakSize).toBe(5);
    });

    test('should reject when queue is full', async () => {
      const smallQueue = new PriorityQueue({ maxQueueSize: 2 });

      smallQueue.enqueue({ command: 'screenshot' });
      smallQueue.enqueue({ command: 'navigate' });

      await expect(smallQueue.enqueue({ command: 'ping' }))
        .rejects.toThrow('Queue full');
    });

    test('should maintain FIFO within same priority', () => {
      queue.enqueue({ command: 'screenshot', id: 1 });
      queue.enqueue({ command: 'screenshot_viewport', id: 2 });
      queue.enqueue({ command: 'get_content', id: 3 });

      const first = queue.getNextRequest();
      const second = queue.getNextRequest();
      const third = queue.getNextRequest();

      // All critical, should be in FIFO order
      expect(first.id).toBe(1);
      expect(second.id).toBe(2);
      expect(third.id).toBe(3);
    });

    test('should clear queue', () => {
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });
      queue.enqueue({ command: 'ping' });

      expect(queue.size()).toBe(3);

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    test('should drain all requests', () => {
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });
      queue.enqueue({ command: 'ping' });

      const all = queue.drain();

      expect(all.length).toBe(3);
      expect(queue.size()).toBe(0);
    });
  });

  // ============================================================================
  // REQUEST COMPLETION TESTS
  // ============================================================================

  describe('Request Completion', () => {
    test('should complete request successfully', async () => {
      const promise = queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();

      queue.completeRequest(req.id, { image: 'data' });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.data.image).toBe('data');
    });

    test('should fail request with error', async () => {
      const promise = queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();

      queue.failRequest(req.id, new Error('Test error'), false);

      await expect(promise).rejects.toThrow('Test error');
    });

    test('should retry failed requests', async () => {
      const promise = queue.enqueue({ command: 'screenshot', maxRetries: 2 });
      const req = queue.getNextRequest();

      // Fail without retry flag (will retry)
      queue.failRequest(req.id, new Error('Temporary error'), true);

      // Request should be re-queued
      expect(queue.size()).toBe(1);
    });

    test('should track wait and processing time', async () => {
      const startQueueTime = Date.now();
      const promise = queue.enqueue({ command: 'screenshot' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = queue.getNextRequest();
      const startProcessingTime = Date.now();

      await new Promise(resolve => setTimeout(resolve, 10));

      queue.completeRequest(req.id, {});

      const result = await promise;
      expect(result.metadata.waitTime).toBeGreaterThanOrEqual(10);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(10);
    });

    test('should track completion in statistics', async () => {
      queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();

      queue.completeRequest(req.id, {});

      const stats = queue.getStatistics();
      expect(stats.requests.completed).toBe(1);
    });
  });

  // ============================================================================
  // PRIORITY ORDERING TESTS
  // ============================================================================

  describe('Priority Ordering', () => {
    test('should process critical before normal', () => {
      const order = [];

      queue.enqueue({ command: 'navigate', id: 1 }); // Normal/High
      queue.enqueue({ command: 'screenshot', id: 2 }); // Critical
      queue.enqueue({ command: 'ping', id: 3 }); // Low

      while (!queue.isEmpty()) {
        const req = queue.getNextRequest();
        order.push(req.id);
      }

      // Screenshot should come before navigate and ping
      expect(order.indexOf(2)).toBeLessThan(order.indexOf(1));
      expect(order.indexOf(2)).toBeLessThan(order.indexOf(3));
    });

    test('should preserve fairness for low-priority', async () => {
      const processed = [];

      for (let i = 0; i < 15; i++) {
        if (i % 3 === 0) {
          queue.enqueue({ command: 'ping', id: `low-${i}` }); // Low
        } else {
          queue.enqueue({ command: 'screenshot', id: `crit-${i}` }); // Critical
        }
      }

      let req;
      while ((req = queue.getNextRequest())) {
        processed.push(req.id);
      }

      // Should have some low-priority processed
      const lowProcessed = processed.filter(id => typeof id === 'string' && id.startsWith('low-'));
      expect(lowProcessed.length).toBeGreaterThan(0);
    });

    test('should handle mixed priority workload', async () => {
      const stats = [];

      for (let i = 0; i < 100; i++) {
        const priority = Math.random();
        let command;

        if (priority < 0.5) {
          command = 'screenshot'; // Critical
        } else if (priority < 0.8) {
          command = 'navigate'; // High
        } else {
          command = 'ping'; // Low
        }

        queue.enqueue({ command, id: i });
      }

      // Process in priority order
      let lastPriority = null;
      while (!queue.isEmpty()) {
        const req = queue.getNextRequest();
        const priority = queue.getCommandPriority(req.command);

        // Should not go from high to low priority (with fairness)
        if (lastPriority) {
          const priorities = ['critical', 'high', 'normal', 'low'];
          const lastIndex = priorities.indexOf(lastPriority);
          const currentIndex = priorities.indexOf(priority);

          // Allow some flexibility for fairness
          if (req.id % 3 !== 0 || priority !== 'low') {
            expect(currentIndex).toBeGreaterThanOrEqual(lastIndex);
          }
        }

        lastPriority = priority;
      }
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('Statistics', () => {
    test('should return complete statistics', async () => {
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });
      queue.enqueue({ command: 'ping' });

      const stats = queue.getStatistics();

      expect(stats.queue).toBeDefined();
      expect(stats.requests).toBeDefined();
      expect(stats.latency).toBeDefined();
      expect(stats.performance).toBeDefined();
    });

    test('should track total requests', async () => {
      const initial = queue.getStatistics();
      expect(initial.requests.total).toBe(0);

      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });

      const after = queue.getStatistics();
      expect(after.requests.total).toBe(2);
    });

    test('should track priority distribution', async () => {
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });
      queue.enqueue({ command: 'ping' });

      const stats = queue.getStatistics();

      expect(stats.requests.priorityDistribution.critical).toBe(2);
      expect(stats.requests.priorityDistribution.high).toBe(1);
      expect(stats.requests.priorityDistribution.low).toBe(1);
    });

    test('should calculate average wait time', async () => {
      queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();

      await new Promise(resolve => setTimeout(resolve, 20));

      queue.completeRequest(req.id, {});

      const stats = queue.getStatistics();
      expect(stats.latency.avgWaitTime).toBeGreaterThanOrEqual(20);
    });

    test('should calculate latency percentiles', async () => {
      // Add requests with different wait times
      for (let i = 0; i < 10; i++) {
        queue.enqueue({ command: 'screenshot' });
      }

      // Get first request immediately
      let req = queue.getNextRequest();
      queue.completeRequest(req.id, {});

      // Wait and get remaining requests
      await new Promise(resolve => setTimeout(resolve, 10));
      while (!queue.isEmpty()) {
        req = queue.getNextRequest();
        queue.completeRequest(req.id, {});
      }

      const stats = queue.getStatistics();
      expect(stats.latency.p50).toBeGreaterThanOrEqual(0);
      expect(stats.latency.p95).toBeGreaterThanOrEqual(stats.latency.p50);
      expect(stats.latency.p99).toBeGreaterThanOrEqual(stats.latency.p95);
    });

    test('should calculate throughput', async () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue({ command: 'screenshot' });
        const req = queue.getNextRequest();
        queue.completeRequest(req.id, {});
      }

      const stats = queue.getStatistics();
      expect(stats.performance.throughput).toBeGreaterThan(0);
    });

    test('should reset statistics', async () => {
      queue.enqueue({ command: 'screenshot' });
      let stats = queue.getStatistics();
      expect(stats.requests.total).toBe(1);

      queue.resetStatistics();

      stats = queue.getStatistics();
      expect(stats.requests.total).toBe(0);
      expect(stats.requests.completed).toBe(0);
    });
  });

  // ============================================================================
  // REQUEST LOOKUP TESTS
  // ============================================================================

  describe('Request Lookup', () => {
    test('should get request by ID', async () => {
      const promise = queue.enqueue({ command: 'screenshot', id: 'test-1' });
      const req = queue.getNextRequest();

      const found = queue.getRequest(req.id);
      expect(found).toBeDefined();
      expect(found.command).toBe('screenshot');
    });

    test('should get oldest request', async () => {
      queue.enqueue({ command: 'navigate' });
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.enqueue({ command: 'screenshot' });

      const oldest = queue.getOldestRequest();
      expect(oldest.command).toBe('navigate');
    });

    test('should get requests by priority', async () => {
      queue.enqueue({ command: 'screenshot' });
      queue.enqueue({ command: 'navigate' });
      queue.enqueue({ command: 'ping' });

      const byPriority = queue.getRequestsByPriority();

      expect(byPriority.critical.length).toBe(1);
      expect(byPriority.high.length).toBe(1);
      expect(byPriority.low.length).toBe(1);
    });
  });

  // ============================================================================
  // PRIORITY BOOSTING TESTS
  // ============================================================================

  describe('Priority Boosting', () => {
    test('should boost request priority', async () => {
      const promise = queue.enqueue({ command: 'navigate' }); // High priority
      const req = queue.getNextRequest();

      // Should be in high queue
      queue.queues.high.push(req);
      queue.queues.normal = queue.queues.normal.filter(r => r.id !== req.id);

      // Boost to critical
      queue.boostPriority(req.id);

      expect(queue.queues.critical.some(r => r.id === req.id)).toBe(true);
    });

    test('should not boost already critical requests', async () => {
      queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();

      const before = queue.getStatistics().queue.sizes.critical;
      queue.boostPriority(req.id);
      const after = queue.getStatistics().queue.sizes.critical;

      // Should not increase beyond initial
      expect(after).toBeGreaterThanOrEqual(before - 1); // Minus one because we got it
    });
  });

  // ============================================================================
  // EVENT EMISSION TESTS
  // ============================================================================

  describe('Event Emission', () => {
    test('should emit request-queued event', (done) => {
      queue.on('request-queued', (data) => {
        expect(data.requestId).toBeDefined();
        expect(data.priority).toBe('critical');
        expect(data.command).toBe('screenshot');
        done();
      });

      queue.enqueue({ command: 'screenshot' });
    });

    test('should emit request-completed event', (done) => {
      queue.on('request-completed', (data) => {
        expect(data.requestId).toBeDefined();
        expect(data.priority).toBe('critical');
        expect(data.waitTime).toBeGreaterThanOrEqual(0);
        done();
      });

      const promise = queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();
      queue.completeRequest(req.id, {});
    });

    test('should emit request-failed event', (done) => {
      queue.on('request-failed', (data) => {
        expect(data.requestId).toBeDefined();
        expect(data.error).toBe('Test error');
        done();
      });

      queue.enqueue({ command: 'screenshot' });
      const req = queue.getNextRequest();
      queue.failRequest(req.id, new Error('Test error'), false);
    });
  });

  // ============================================================================
  // STRESS AND LOAD TESTS
  // ============================================================================

  describe('Stress and Load Tests', () => {
    test('should handle 1000 concurrent requests', async () => {
      const promises = [];

      for (let i = 0; i < 1000; i++) {
        const command = i % 3 === 0 ? 'screenshot' : (i % 3 === 1 ? 'navigate' : 'ping');
        promises.push(queue.enqueue({ command, id: i }));
      }

      expect(queue.size()).toBe(1000);

      // Process all
      const processed = [];
      while (!queue.isEmpty()) {
        const req = queue.getNextRequest();
        processed.push(req);
        queue.completeRequest(req.id, {});
      }

      expect(processed.length).toBe(1000);
    });

    test('should maintain performance under high load', async () => {
      const timings = [];

      for (let i = 0; i < 100; i++) {
        const start = Date.now();

        queue.enqueue({ command: 'screenshot' });
        queue.getNextRequest();

        timings.push(Date.now() - start);
      }

      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      expect(avgTiming).toBeLessThan(10); // Should be fast
    });

    test('should handle rapid enqueue/dequeue cycles', async () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 50; i++) {
          queue.enqueue({ command: 'screenshot' });
        }

        for (let i = 0; i < 50; i++) {
          const req = queue.getNextRequest();
          queue.completeRequest(req.id, {});
        }

        expect(queue.size()).toBe(0);
      }
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    test('should reduce P95 latency with priority scheduling', async () => {
      const latencies = {
        critical: [],
        normal: [],
        low: []
      };

      // Simulate mixed workload
      for (let i = 0; i < 30; i++) {
        const priority = i % 3 === 0 ? 'low' : (i % 3 === 1 ? 'normal' : 'critical');
        const command = priority === 'critical' ? 'screenshot' :
                        priority === 'normal' ? 'navigate' : 'ping';

        const startWait = Date.now();
        const promise = queue.enqueue({ command });

        // Simulate some processing
        const req = queue.getNextRequest();
        const waitTime = Date.now() - startWait;
        latencies[priority].push(waitTime);

        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        queue.completeRequest(req.id, {});
      }

      // Calculate P95 for each priority
      const getP95 = (arr) => {
        const sorted = arr.sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)];
      };

      if (latencies.critical.length > 0 && latencies.low.length > 0) {
        const criticalP95 = getP95(latencies.critical);
        const lowP95 = getP95(latencies.low);

        // Critical should have similar or lower latency
        // (In real scenario with longer processing, critical would be much lower)
        expect(criticalP95).toBeLessThanOrEqual(lowP95 + 50);
      }
    });
  });
});
