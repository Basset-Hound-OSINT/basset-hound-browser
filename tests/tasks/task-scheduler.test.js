/**
 * Task Scheduler Tests
 * Tests for Task Scheduling and Execution
 * 15+ test scenarios
 */

const TaskScheduler = require('../../src/tasks/task-scheduler');
const assert = require('assert');

describe('TaskScheduler', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler({
      maxConcurrentTasks: 3,
      taskTimeout: 10000,
      maxTaskRetries: 2
    });
  });

  afterEach(() => {
    // Clean up
  });

  // Task Definition Tests
  describe('Task Definition', () => {
    it('should define task type', () => {
      const definition = scheduler.defineTask('REPORT_GENERATION', {
        name: 'Generate Report',
        handler: async (payload) => ({ status: 'ok' }),
        timeout: 30000
      });

      assert.strictEqual(definition.type, 'REPORT_GENERATION');
      assert.strictEqual(definition.name, 'Generate Report');
    });

    it('should define data export task', () => {
      const definition = scheduler.defineTask('DATA_EXPORT', {
        name: 'Export Data',
        handler: async (payload) => ({ exported: true }),
        priority: 'high'
      });

      assert.strictEqual(definition.type, 'DATA_EXPORT');
    });

    it('should define cleanup task', () => {
      const definition = scheduler.defineTask('CLEANUP_SESSIONS', {
        name: 'Cleanup Sessions',
        handler: async (payload) => ({ cleaned: true })
      });

      assert.strictEqual(definition.type, 'CLEANUP_SESSIONS');
    });

    it('should get task definition', () => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({})
      });

      const def = scheduler.getTaskDefinition('TEST_TASK');
      assert.strictEqual(def.type, 'TEST_TASK');
    });

    it('should get all task definitions', () => {
      scheduler.defineTask('TASK_1', {
        name: 'Task 1',
        handler: async () => ({})
      });
      scheduler.defineTask('TASK_2', {
        name: 'Task 2',
        handler: async () => ({})
      });

      const defs = scheduler.getTaskDefinitions();
      assert(defs.length >= 2);
    });

    it('should emit task:defined event', (done) => {
      scheduler.once('task:defined', () => {
        done();
      });

      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({})
      });
    });
  });

  // Task Scheduling Tests
  describe('Task Scheduling', () => {
    beforeEach(() => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test Task',
        handler: async () => ({ result: 'ok' })
      });
    });

    it('should schedule task', () => {
      const task = scheduler.scheduleTask('task_1', 'TEST_TASK', {
        param1: 'value1'
      });

      assert.strictEqual(task.id, 'task_1');
      assert.strictEqual(task.type, 'TEST_TASK');
      assert.strictEqual(task.status, 'scheduled');
    });

    it('should schedule with custom time', () => {
      const scheduledTime = Date.now() + 60000; // 1 minute from now

      const task = scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime
      });

      assert.strictEqual(task.scheduledTime, scheduledTime);
    });

    it('should schedule recurring task', () => {
      const task = scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        recurrence: 'DAILY'
      });

      assert.strictEqual(task.recurrence, 'DAILY');
    });

    it('should schedule with priority', () => {
      const task = scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        priority: 'high'
      });

      assert.strictEqual(task.priority, 'high');
    });

    it('should get scheduled tasks', () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {});
      scheduler.scheduleTask('task_2', 'TEST_TASK', {});

      const scheduled = scheduler.getScheduledTasks();
      assert(scheduled.length >= 2);
    });

    it('should track scheduled tasks count', () => {
      const before = scheduler.metrics.tasksScheduled;

      scheduler.scheduleTask('task_1', 'TEST_TASK', {});

      assert.strictEqual(scheduler.metrics.tasksScheduled, before + 1);
    });

    it('should emit task:scheduled event', (done) => {
      scheduler.once('task:scheduled', () => {
        done();
      });

      scheduler.scheduleTask('task_1', 'TEST_TASK', {});
    });
  });

  // Task Execution Tests
  describe('Task Execution', () => {
    beforeEach(() => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test Task',
        handler: async (payload) => ({
          status: 'completed',
          payload
        })
      });
    });

    it('should execute scheduled task', async () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', { value: 42 }, {
        scheduledTime: Date.now() // Execute immediately
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const task = scheduler.getTaskStatus('task_1');
      assert.strictEqual(task.status, 'completed');
    });

    it('should track executed tasks', async () => {
      const before = scheduler.metrics.tasksExecuted;

      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      assert(scheduler.metrics.tasksExecuted > before);
    });

    it('should record execution time', async () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      assert(scheduler.metrics.executionTimes.length > 0);
    });

    it('should emit task:completed event', (done) => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({ ok: true })
      });

      scheduler.once('task:completed', () => {
        done();
      });

      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now()
      });
    });

    it('should get completed tasks', async () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const completed = scheduler.getCompletedTasks();
      assert(completed.length > 0);
    });

    it('should handle concurrent task limits', async () => {
      for (let i = 0; i < 5; i++) {
        scheduler.scheduleTask(`task_${i}`, 'TEST_TASK', {}, {
          scheduledTime: Date.now()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const running = scheduler.getRunningTasks();
      assert(running.length <= 3); // maxConcurrentTasks = 3
    });
  });

  // Task Retry Tests
  describe('Task Retry', () => {
    let attemptCount = 0;

    beforeEach(() => {
      attemptCount = 0;

      scheduler.defineTask('RETRY_TASK', {
        name: 'Retry Task',
        handler: async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Intentional failure');
          }
          return { retried: true };
        },
        retryable: true,
        maxRetries: 2
      });
    });

    it('should retry failed task', async () => {
      scheduler.scheduleTask('task_1', 'RETRY_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      assert(attemptCount >= 2);
    });

    it('should track retried tasks', async () => {
      const before = scheduler.metrics.tasksRetried;

      scheduler.scheduleTask('task_1', 'RETRY_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      assert(scheduler.metrics.tasksRetried > before);
    });

    it('should fail after max retries', async () => {
      scheduler.defineTask('FAIL_TASK', {
        name: 'Fail Task',
        handler: async () => {
          throw new Error('Always fails');
        },
        maxRetries: 1
      });

      scheduler.scheduleTask('task_1', 'FAIL_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const task = scheduler.getTaskStatus('task_1');
      assert.strictEqual(task.status, 'failed');
    });

    it('should emit task:retrying event', (done) => {
      scheduler.once('task:retrying', () => {
        done();
      });

      scheduler.scheduleTask('task_1', 'RETRY_TASK', {}, {
        scheduledTime: Date.now()
      });
    });
  });

  // Task Cancellation Tests
  describe('Task Cancellation', () => {
    beforeEach(() => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({ ok: true })
      });
    });

    it('should cancel scheduled task', () => {
      const task = scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now() + 60000 // 1 minute from now
      });

      assert.strictEqual(task.status, 'scheduled');

      const cancelled = scheduler.cancelTask('task_1');
      assert(cancelled);

      const cancelledTask = scheduler.getTaskStatus('task_1');
      assert.strictEqual(cancelledTask.status, 'cancelled');
    });

    it('should emit task:cancelled event', (done) => {
      scheduler.once('task:cancelled', () => {
        done();
      });

      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now() + 60000
      });

      scheduler.cancelTask('task_1');
    });
  });

  // Task Rescheduling Tests
  describe('Task Rescheduling', () => {
    beforeEach(() => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({ ok: true })
      });
    });

    it('should reschedule task', () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now() + 60000
      });

      const newTime = Date.now() + 120000;
      const result = scheduler.rescheduleTask('task_1', newTime);

      assert(result);

      const task = scheduler.getTaskStatus('task_1');
      assert.strictEqual(task.nextExecutionTime, newTime);
    });

    it('should emit task:rescheduled event', (done) => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now() + 60000
      });

      scheduler.once('task:rescheduled', () => {
        done();
      });

      scheduler.rescheduleTask('task_1', Date.now() + 120000);
    });
  });

  // Recurring Task Tests
  describe('Recurring Tasks', () => {
    let executionCount = 0;

    beforeEach(() => {
      executionCount = 0;

      scheduler.defineTask('RECURRING_TASK', {
        name: 'Recurring',
        handler: async () => {
          executionCount++;
          return { executed: executionCount };
        }
      });
    });

    it('should handle DAILY recurrence', () => {
      const task = scheduler.scheduleTask('task_1', 'RECURRING_TASK', {}, {
        recurrence: 'DAILY',
        scheduledTime: Date.now()
      });

      assert.strictEqual(task.recurrence, 'DAILY');
      assert.strictEqual(task.recurringPattern, 86400000);
    });

    it('should handle HOURLY recurrence', () => {
      const task = scheduler.scheduleTask('task_1', 'RECURRING_TASK', {}, {
        recurrence: 'HOURLY'
      });

      assert.strictEqual(task.recurringPattern, 3600000);
    });

    it('should handle WEEKLY recurrence', () => {
      const task = scheduler.scheduleTask('task_1', 'RECURRING_TASK', {}, {
        recurrence: 'WEEKLY'
      });

      assert.strictEqual(task.recurringPattern, 604800000);
    });

    it('should handle ONCE (non-recurring)', () => {
      const task = scheduler.scheduleTask('task_1', 'RECURRING_TASK', {}, {
        recurrence: 'ONCE'
      });

      assert.strictEqual(task.recurringPattern, null);
    });
  });

  // Metrics Tests
  describe('Metrics', () => {
    beforeEach(() => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({ ok: true })
      });
    });

    it('should get comprehensive metrics', () => {
      const metrics = scheduler.getMetrics();

      assert(metrics.tasksScheduled >= 0);
      assert(metrics.tasksExecuted >= 0);
      assert(metrics.tasksFailed >= 0);
      assert(metrics.averageExecutionTime);
    });

    it('should get scheduler status', () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {});

      const status = scheduler.getStatus();

      assert(status.running >= 0);
      assert(status.scheduled >= 1);
      assert(status.metrics);
    });

    it('should get upcoming tasks', () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now() + 1000
      });

      const upcoming = scheduler.getUpcomingTasks({ window: 10000 });
      assert(upcoming.length > 0);
    });

    it('should get task type metrics', async () => {
      scheduler.scheduleTask('task_1', 'TEST_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = scheduler.getTaskMetrics('TEST_TASK');
      assert(metrics.scheduled > 0);
    });
  });

  // Pause/Resume Tests
  describe('Scheduler Pause/Resume', () => {
    beforeEach(() => {
      scheduler.defineTask('TEST_TASK', {
        name: 'Test',
        handler: async () => ({ ok: true })
      });
    });

    it('should pause scheduler', () => {
      scheduler.pause();
      assert(scheduler.options.paused);
    });

    it('should resume scheduler', () => {
      scheduler.pause();
      scheduler.resume();
      assert(!scheduler.options.paused);
    });

    it('should emit paused event', (done) => {
      scheduler.once('paused', () => {
        done();
      });
      scheduler.pause();
    });

    it('should emit resumed event', (done) => {
      scheduler.pause();

      scheduler.once('resumed', () => {
        done();
      });
      scheduler.resume();
    });
  });
});
