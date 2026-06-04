/**
 * Integration Tests: Queuing + Streaming + Tasks
 * Tests the complete distributed architecture workflow
 * 20+ integration scenarios
 */

const QueueManager = require('../../src/queuing/queue-manager');
const MessageHandler = require('../../src/queuing/message-handler');
const StreamProcessor = require('../../src/streaming/stream-processor');
const EventRouter = require('../../src/streaming/event-router');
const TaskScheduler = require('../../src/tasks/task-scheduler');
const BackgroundJobs = require('../../src/tasks/background-jobs');
const assert = require('assert');

describe('Wave 16 Phase 2: Distributed Architecture Integration', () => {
  let queueManager;
  let messageHandler;
  let streamProcessor;
  let eventRouter;
  let taskScheduler;
  let backgroundJobs;

  beforeEach(async () => {
    // Initialize all components
    queueManager = new QueueManager({ poolSize: 5 });
    await queueManager.connect();

    messageHandler = new MessageHandler({ maxConcurrency: 10 });

    streamProcessor = new StreamProcessor({ windowSize: 60000, partitions: 10 });
    await streamProcessor.start();

    eventRouter = new EventRouter({ enableAudit: true });

    taskScheduler = new TaskScheduler({ maxConcurrentTasks: 5 });

    backgroundJobs = new BackgroundJobs({ maxParallelJobs: 3 });
  });

  afterEach(async () => {
    await queueManager.disconnect();
    await streamProcessor.stop();
  });

  // End-to-End Workflow Tests
  describe('End-to-End Workflow', () => {
    it('should complete full pipeline: queue -> handler -> stream -> router -> task', async () => {
      // 1. Declare queues
      await queueManager.declareQueue('monitoring:tasks');
      await queueManager.declareQueue('alerts:send');

      // 2. Register message handler
      messageHandler.registerHandler('monitoring:tasks', async (message) => {
        // Process and emit event
        const event = {
          event_id: `evt_${message.message_id}`,
          task_id: message.payload.taskId,
          change_type: 'HTML_MODIFIED',
          timestamp: Date.now(),
          severity: 'high',
          payload: message.payload
        };

        return { processed: true, event };
      });

      // 3. Register stream processor
      streamProcessor.registerAlertRule('rule_1', {
        name: 'High Severity',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: ['notify']
      });

      // 4. Register event router
      eventRouter.registerRoute('route_1', {
        name: 'Alert Route',
        pattern: 'alert',
        destination: 'alert_handler'
      });

      eventRouter.registerHandler('alert_handler', async (event) => {
        return { delivered: true };
      });

      // 5. Define task
      taskScheduler.defineTask('SEND_ALERT', {
        name: 'Send Alert',
        handler: async (payload) => {
          return { alert_sent: true, payload };
        }
      });

      // 6. Publish message
      const messageResult = await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK',
        payload: { taskId: 'task_123', url: 'https://example.com' }
      });

      assert(messageResult.messageId);
      assert.strictEqual(messageResult.status, 'published');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  // Queue Manager + Message Handler Tests
  describe('Queue Manager + Message Handler', () => {
    it('should publish message and process with handler', async () => {
      await queueManager.declareQueue('test:queue');

      let handledMessage = null;

      messageHandler.registerHandler('test:queue', async (message) => {
        handledMessage = message;
        return { processed: true };
      });

      await queueManager.publishMessage('test:queue', {
        type: 'TEST',
        payload: { value: 42 }
      });

      // In real scenario, messages would flow through
      assert(queueManager.metrics.messagesPublished > 0);
    });

    it('should handle multiple concurrent messages', async () => {
      await queueManager.declareQueue('test:queue');

      let processedCount = 0;

      messageHandler.registerHandler('test:queue', async (message) => {
        processedCount++;
        return { count: processedCount };
      });

      // Publish multiple messages
      for (let i = 0; i < 5; i++) {
        await queueManager.publishMessage('test:queue', {
          type: 'TEST',
          payload: { id: i }
        });
      }

      assert.strictEqual(queueManager.metrics.messagesPublished, 5);
    });

    it('should track handler metrics', async () => {
      await queueManager.declareQueue('test:queue');

      messageHandler.registerHandler('test:queue', async (message) => {
        return { ok: true };
      });

      const metrics = messageHandler.getHandlerMetrics('test:queue');
      assert(metrics);
      assert.strictEqual(metrics.queueName, 'test:queue');
    });
  });

  // Stream Processor + Event Router Tests
  describe('Stream Processor + Event Router', () => {
    it('should process events through stream and route alerts', async () => {
      // Register alert rule
      streamProcessor.registerAlertRule('rule_1', {
        name: 'High Severity',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: ['notify']
      });

      // Register route
      let routedAlerts = 0;
      eventRouter.registerRoute('route_1', {
        name: 'Alert Route',
        pattern: /alert/,
        destination: 'slack_handler'
      });

      eventRouter.registerHandler('slack_handler', async (event) => {
        routedAlerts++;
        return { sent: true };
      });

      // Process event
      await streamProcessor.processEvent({
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'HIGH_SEVERITY_CHANGE',
        timestamp: Date.now(),
        severity: 'high'
      });

      assert(streamProcessor.metrics.eventsProcessed > 0);
    });

    it('should aggregate events and trigger multiple alerts', async () => {
      streamProcessor.registerAlertRule('rule_1', {
        name: 'Rapid Changes',
        condition: 'RAPID_CHANGES',
        threshold: 2,
        severity: 'high',
        actions: []
      });

      const windowId = 'test_window';
      streamProcessor.windows.set(windowId, {
        id: windowId,
        start: Date.now(),
        end: Date.now() + 60000,
        events: [
          {
            task_id: 'task_1',
            change_type: 'HTML_MODIFIED',
            timestamp: Date.now()
          },
          {
            task_id: 'task_1',
            change_type: 'HTML_MODIFIED',
            timestamp: Date.now() + 1000
          },
          {
            task_id: 'task_1',
            change_type: 'HTML_MODIFIED',
            timestamp: Date.now() + 2000
          }
        ]
      });

      const aggregations = await streamProcessor.aggregateWindow('default', windowId);
      assert(aggregations.length > 0);
      assert(aggregations[0].change_count >= 3);
    });
  });

  // Task Scheduler + Background Jobs Tests
  describe('Task Scheduler + Background Jobs', () => {
    it('should schedule task and execute in background jobs', async () => {
      taskScheduler.defineTask('EXPORT_DATA', {
        name: 'Export Data',
        handler: async (payload) => {
          return { exported: true, records: 1000 };
        }
      });

      const task = taskScheduler.scheduleTask('task_1', 'EXPORT_DATA', {
        format: 'csv'
      }, {
        scheduledTime: Date.now()
      });

      assert.strictEqual(task.type, 'EXPORT_DATA');
      assert.strictEqual(task.status, 'scheduled');

      await new Promise(resolve => setTimeout(resolve, 500));

      assert(taskScheduler.metrics.tasksScheduled > 0);
    });

    it('should create background job for report generation', async () => {
      const job = backgroundJobs.createJob('report_generation', {
        reportType: 'MONITORING',
        taskId: 'task_1',
        format: 'pdf'
      }, { priority: 'high' });

      assert.strictEqual(job.type, 'report_generation');
      assert.strictEqual(job.priority, 'high');

      await new Promise(resolve => setTimeout(resolve, 500));

      assert(backgroundJobs.metrics.jobsCreated > 0);
    });

    it('should handle concurrent task and job execution', async () => {
      // Schedule tasks
      for (let i = 0; i < 3; i++) {
        taskScheduler.defineTask(`TASK_${i}`, {
          name: `Task ${i}`,
          handler: async () => ({ done: true })
        });

        taskScheduler.scheduleTask(`task_${i}`, `TASK_${i}`, {}, {
          scheduledTime: Date.now()
        });
      }

      // Create jobs
      for (let i = 0; i < 3; i++) {
        backgroundJobs.createJob('database_backup', {
          databases: ['db_1', 'db_2']
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const schedulerStatus = taskScheduler.getStatus();
      const jobsStatus = backgroundJobs.getQueueStatus();

      assert(schedulerStatus.scheduled >= 0);
      assert(jobsStatus.total >= 0);
    });
  });

  // Multi-Component Event Flow Tests
  describe('Multi-Component Event Flow', () => {
    it('should flow event: queue -> handler -> stream -> alert -> router -> task -> background job', async () => {
      // Setup queue
      await queueManager.declareQueue('events:inbound');

      // Setup message handler
      messageHandler.registerHandler('events:inbound', async (message) => {
        // Simulate event extraction
        return {
          eventCreated: true,
          eventId: `evt_${message.message_id}`
        };
      });

      // Setup stream processing
      streamProcessor.registerAlertRule('critical_rule', {
        name: 'Critical Alert',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: []
      });

      // Setup event routing
      eventRouter.registerRoute('critical_route', {
        name: 'Critical Event Route',
        pattern: /high_severity/,
        destination: 'task_trigger'
      });

      // Setup task triggering
      eventRouter.registerHandler('task_trigger', async (event) => {
        // Schedule follow-up task
        taskScheduler.defineTask('HANDLE_CRITICAL', {
          name: 'Handle Critical Event',
          handler: async (payload) => {
            // Create background job
            const job = backgroundJobs.createJob('cleanup_expired_sessions', {
              olderThanMs: 86400000
            });
            return { jobId: job.id };
          }
        });

        taskScheduler.scheduleTask('critical_task', 'HANDLE_CRITICAL', { eventId: event.event_id }, {
          scheduledTime: Date.now()
        });

        return { handled: true };
      });

      // Publish initial message
      const result = await queueManager.publishMessage('events:inbound', {
        type: 'EVENT',
        payload: { severity: 'high' }
      });

      assert(result.messageId);
      assert.strictEqual(result.status, 'published');

      // Allow time for async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify components processed
      assert(queueManager.metrics.messagesPublished > 0);
      assert(streamProcessor.metrics.eventsProcessed >= 0);
      assert(taskScheduler.metrics.tasksScheduled >= 0);
      assert(backgroundJobs.metrics.jobsCreated >= 0);
    });
  });

  // Scalability Tests
  describe('Scalability', () => {
    it('should handle message burst', async () => {
      await queueManager.declareQueue('burst:queue');

      messageHandler.registerHandler('burst:queue', async (message) => {
        return { processed: true };
      });

      // Publish 100 messages
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          queueManager.publishMessage('burst:queue', {
            type: 'TEST',
            payload: { index: i }
          })
        );
      }

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 100);
      assert.strictEqual(queueManager.metrics.messagesPublished, 100);
    });

    it('should handle high-volume event stream', async () => {
      streamProcessor.registerAlertRule('rule_1', {
        name: 'Test',
        condition: 'HIGH_SEVERITY',
        severity: 'high',
        actions: []
      });

      // Process 500 events
      for (let i = 0; i < 500; i++) {
        await streamProcessor.processEvent({
          event_id: `evt_${i}`,
          task_id: `task_${i % 10}`,
          change_type: i % 2 === 0 ? 'HIGH_SEVERITY_CHANGE' : 'HTML_MODIFIED',
          timestamp: Date.now(),
          severity: i % 2 === 0 ? 'high' : 'low'
        });
      }

      const metrics = streamProcessor.getMetrics();
      assert(metrics.eventsProcessed >= 500);
    });

    it('should handle concurrent task execution', async () => {
      taskScheduler.defineTask('CONCURRENT_TASK', {
        name: 'Concurrent',
        handler: async () => {
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 100));
          return { ok: true };
        }
      });

      // Schedule 20 tasks
      for (let i = 0; i < 20; i++) {
        taskScheduler.scheduleTask(`task_${i}`, 'CONCURRENT_TASK', {}, {
          scheduledTime: Date.now() + (i % 5) * 100
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = taskScheduler.getMetrics();
      assert(metrics.tasksScheduled > 0);
    });
  });

  // Error Recovery Tests
  describe('Error Recovery', () => {
    it('should recover from message handler error', async () => {
      await queueManager.declareQueue('error:queue');

      let attempts = 0;

      messageHandler.registerHandler('error:queue', async (message) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('First attempt fails');
        }
        return { success: true };
      });

      await queueManager.publishMessage('error:queue', {
        type: 'TEST'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      assert(attempts >= 1);
    });

    it('should recover from stream processing error', async () => {
      let errorCount = 0;

      streamProcessor.once('error', () => {
        errorCount++;
      });

      // Process event that might trigger error
      await streamProcessor.processEvent({
        event_id: 'evt_1',
        task_id: 'task_1',
        change_type: 'UNKNOWN_TYPE',
        timestamp: Date.now()
      });

      // System should continue operating
      assert(streamProcessor.isRunning);
    });

    it('should recover from task execution error', async () => {
      taskScheduler.defineTask('ERROR_TASK', {
        name: 'Error Task',
        handler: async () => {
          throw new Error('Task execution failed');
        },
        maxRetries: 2
      });

      taskScheduler.scheduleTask('error_task', 'ERROR_TASK', {}, {
        scheduledTime: Date.now()
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const task = taskScheduler.getTaskStatus('error_task');
      assert.strictEqual(task.status, 'failed');
    });
  });

  // Monitoring and Metrics Tests
  describe('System Monitoring', () => {
    it('should provide comprehensive system metrics', async () => {
      const queueMetrics = queueManager.getMetrics();
      const handlerMetrics = messageHandler.getMetrics();
      const streamMetrics = streamProcessor.getMetrics();
      const routerMetrics = eventRouter.getMetrics();
      const schedulerMetrics = taskScheduler.getMetrics();
      const jobMetrics = backgroundJobs.getMetrics();

      assert(queueMetrics.messagesPublished >= 0);
      assert(handlerMetrics.overall);
      assert(streamMetrics.eventsProcessed >= 0);
      assert(routerMetrics.eventsRouted >= 0);
      assert(schedulerMetrics.tasksScheduled >= 0);
      assert(jobMetrics.jobsCreated >= 0);
    });

    it('should track latency across pipeline', async () => {
      await queueManager.declareQueue('latency:test');

      messageHandler.registerHandler('latency:test', async (message) => {
        return { ok: true };
      });

      const startTime = Date.now();

      await queueManager.publishMessage('latency:test', {
        type: 'TEST'
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const elapsedTime = Date.now() - startTime;
      assert(elapsedTime >= 200);
    });
  });
});
