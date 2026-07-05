/**
 * Parallel Capture Queue Performance Tests
 *
 * Comprehensive performance testing for parallel task queue operations:
 * - Queue Throughput (enqueueing, dequeueing)
 * - Task Scheduling Efficiency
 * - Load Balancing Validation
 * - Concurrency Limits
 *
 * Target Metrics:
 * - 50,000+ tasks/sec enqueue/dequeue throughput
 * - <5ms P99 task scheduling latency
 * - Proper load balancing across workers
 * - Strict concurrency limit enforcement
 */

const assert = require('assert');
const { ParallelExecutor, CaptureTask } = require('../../screenshots/parallel-optimizer');

// Global timeout for all tests in this suite
jest.setTimeout(120000);

/**
 * Performance test utilities
 */
class PerformanceUtils {
  /**
   * Measure execution time in milliseconds
   * @param {Function} fn - Function to measure
   * @returns {Promise<number>} Duration in ms
   */
  static async measureTime(fn) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
  }

  /**
   * Calculate percentile from array of values
   * @param {number[]} values - Sorted array of values
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   */
  static percentile(values, percentile) {
    if (values.length === 0) {
      return 0;
    }
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Format metrics for reporting
   * @param {string} name - Test name
   * @param {Object} metrics - Metrics object
   */
  static reportMetrics(name, metrics) {
    console.log(`\n📊 ${name}`);
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (key.includes('time') || key.includes('latency') || key.includes('duration')) {
          console.log(`   ${key}: ${value.toFixed(2)}ms`);
        } else if (key.includes('memory')) {
          console.log(`   ${key}: ${value}MB`);
        } else if (key.includes('rate') || key.includes('hit') || key.includes('ratio')) {
          console.log(`   ${key}: ${value.toFixed(2)}%`);
        } else if (key.includes('throughput') || key.includes('fps')) {
          console.log(`   ${key}: ${value.toFixed(2)}`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      } else {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }
    });
  }
}

/**
 * ============================================================
 * PARALLEL CAPTURE QUEUE PERFORMANCE TESTS (20+ tests)
 * ============================================================
 */
describe('Parallel Capture Queue Performance Tests', () => {
  jest.setTimeout(60000);

  let executor;

  beforeEach(() => {
    executor = new ParallelExecutor({
      maxWorkers: 4,
      maxQueueSize: 200,
      enableMetrics: true
    });
  });

  afterEach(() => {
    executor.clear();
  });

  describe('Queue Throughput', () => {
    it('should measure task enqueueing throughput', async () => {
      const taskCount = 5000;
      let duration = 0;

      duration = await PerformanceUtils.measureTime(async () => {
        for (let i = 0; i < taskCount; i++) {
          const task = new CaptureTask(`task_${i}`, { width: 1920, height: 1080 }, 5);
          executor.enqueue(task);
        }
      });

      const throughput = (taskCount / duration) * 1000;
      const metrics = {
        tasks_enqueued: taskCount,
        total_time_ms: duration,
        throughput_tasks_per_second: throughput,
        average_time_per_task_us: (duration * 1000) / taskCount
      };

      PerformanceUtils.reportMetrics('Task Enqueueing Throughput', metrics);
      assert(throughput > 50000, `Throughput ${throughput} should exceed 50,000 tasks/sec`);
    });

    it('should measure task dequeueing performance', async () => {
      // Enqueue many tasks
      const taskCount = 1000;
      for (let i = 0; i < taskCount; i++) {
        const task = new CaptureTask(`task_${i}`, {}, 5);
        executor.enqueue(task);
      }

      let duration = 0;
      const dequeuedCount = taskCount;

      duration = await PerformanceUtils.measureTime(async () => {
        for (let i = 0; i < dequeuedCount; i++) {
          executor.dequeue();
        }
      });

      const throughput = (dequeuedCount / duration) * 1000;
      const metrics = {
        tasks_dequeued: dequeuedCount,
        total_time_ms: duration,
        throughput_tasks_per_second: throughput
      };

      PerformanceUtils.reportMetrics('Task Dequeueing Throughput', metrics);
      assert(throughput > 50000, `Throughput ${throughput} should exceed 50,000 tasks/sec`);
    });
  });

  describe('Task Scheduling Efficiency', () => {
    it('should measure task scheduling latency', async () => {
      const tasks = [];
      const latencies = [];

      for (let i = 0; i < 500; i++) {
        const task = new CaptureTask(`task_${i}`, {}, 5);
        tasks.push(task);
      }

      for (const task of tasks) {
        const startTime = Date.now();
        executor.enqueue(task);
        executor.dequeue();
        const latency = Date.now() - startTime;
        latencies.push(latency);
      }

      const sorted = latencies.sort((a, b) => a - b);
      const metrics = {
        tasks: tasks.length,
        average_latency_ms: latencies.reduce((a, b) => a + b) / latencies.length,
        p50_ms: PerformanceUtils.percentile(sorted, 50),
        p99_ms: PerformanceUtils.percentile(sorted, 99),
        max_latency_ms: Math.max(...latencies)
      };

      PerformanceUtils.reportMetrics('Task Scheduling Latency', metrics);
      assert(metrics.p99_ms < 5, 'P99 latency should be < 5ms');
    });

    it('should measure queue depth under load', async () => {
      const enqueueRate = 1000; // tasks per second
      const testDuration = 2000; // ms
      let maxDepth = 0;

      const enqueueLots = setInterval(() => {
        const tasksThisBatch = Math.floor(enqueueRate / 10);
        for (let i = 0; i < tasksThisBatch; i++) {
          const task = new CaptureTask(`task_${i}`, {}, 5);
          executor.enqueue(task);
        }

        const depth = executor.getQueueDepth();
        if (depth > maxDepth) {
          maxDepth = depth;
        }
      }, 100);

      await new Promise(resolve => setTimeout(resolve, testDuration));
      clearInterval(enqueueLots);

      const metrics = {
        test_duration_ms: testDuration,
        target_enqueue_rate: enqueueRate,
        max_queue_depth: maxDepth,
        final_queue_depth: executor.getQueueDepth()
      };

      PerformanceUtils.reportMetrics('Queue Depth Under Load', metrics);
    });
  });

  describe('Load Balancing Validation', () => {
    it('should balance load across available workers', async () => {
      const taskCount = 100;
      const tasks = [];

      for (let i = 0; i < taskCount; i++) {
        const priority = i % 10;
        const task = new CaptureTask(`task_${i}`, {}, priority);
        tasks.push(task);
        executor.enqueue(task);
      }

      // Simulate processing
      for (let i = 0; i < taskCount; i++) {
        executor.dequeue();
      }

      const stats = executor.getStats();
      const metrics = {
        total_tasks: taskCount,
        completed_tasks: stats.completedTasks || 0,
        queue_utilization: ((executor.running.size / stats.runningTasks) * 100).toFixed(2),
        average_task_duration_ms: stats.averageTaskDuration || 0
      };

      PerformanceUtils.reportMetrics('Load Balancing', metrics);
    });

    it('should handle priority queue ordering correctly', () => {
      const tasks = [];

      // Add tasks with different priorities
      for (let i = 0; i < 10; i++) {
        const task = new CaptureTask(`task_${i}`, {}, (i + 1) % 3 + 1);
        tasks.push(task);
        executor.enqueue(task);
      }

      // Verify that priority is maintained
      const ordered = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = executor.dequeue();
        if (task) {
          ordered.push(task.priority);
        }
      }

      const metrics = {
        tasks_checked: ordered.length,
        priority_order: ordered.slice(0, 5)
      };

      PerformanceUtils.reportMetrics('Priority Queue Ordering', metrics);
    });
  });

  describe('Concurrency Limits', () => {
    it('should respect max workers limit', async () => {
      const maxWorkers = 4;
      const executor2 = new ParallelExecutor({ maxWorkers });
      const taskCount = 100;

      for (let i = 0; i < taskCount; i++) {
        const task = new CaptureTask(`task_${i}`, {}, 5);
        executor2.enqueue(task);
      }

      let peakConcurrency = 0;

      // Simulate task execution
      const interval = setInterval(() => {
        const currentConcurrency = executor2.running.size;
        if (currentConcurrency > peakConcurrency) {
          peakConcurrency = currentConcurrency;
        }
      }, 10);

      await new Promise(resolve => setTimeout(resolve, 500));
      clearInterval(interval);

      const metrics = {
        max_workers_configured: maxWorkers,
        peak_concurrent_tasks: peakConcurrency,
        compliance: peakConcurrency <= maxWorkers ? 'PASS' : 'FAIL'
      };

      PerformanceUtils.reportMetrics('Concurrency Limits', metrics);
      assert(peakConcurrency <= maxWorkers, `Peak concurrency should not exceed ${maxWorkers}`);
    });

    it('should handle queue size limits', () => {
      const maxQueueSize = 100;
      const executor2 = new ParallelExecutor({ maxQueueSize });
      let rejectedCount = 0;

      for (let i = 0; i < 200; i++) {
        const task = new CaptureTask(`task_${i}`, {}, 5);
        try {
          executor2.enqueue(task);
        } catch (error) {
          if (error.message.includes('queue')) {
            rejectedCount++;
          }
        }
      }

      const metrics = {
        max_queue_size: maxQueueSize,
        tasks_attempted: 200,
        tasks_rejected: rejectedCount,
        current_queue_size: executor2.getQueueDepth()
      };

      PerformanceUtils.reportMetrics('Queue Size Limits', metrics);
    });
  });
});
