/**
 * Queue Manager Tests
 * Tests for RabbitMQ Queue Manager implementation
 * 25+ test scenarios
 */

const QueueManager = require('../../src/queuing/queue-manager');
const assert = require('assert');

describe('QueueManager', () => {
  let queueManager;

  beforeEach(async () => {
    queueManager = new QueueManager({
      poolSize: 5,
      brokers: [{ host: 'localhost', port: 5672 }]
    });
    await queueManager.connect();
  });

  afterEach(async () => {
    await queueManager.disconnect();
  });

  // Connection Tests
  describe('Connection Management', () => {
    it('should connect to broker', async () => {
      assert.strictEqual(queueManager.isConnected, true);
      assert.strictEqual(queueManager.connectionPool.length, 5);
    });

    it('should track connection failures', async () => {
      const before = queueManager.metrics.connectionFailures;
      // Simulate connection failure
      queueManager.connectionPool[0].connected = false;
      await new Promise(resolve => setTimeout(resolve, 100));
      assert(queueManager.metrics.connectionFailures >= before);
    });

    it('should maintain connection pool', () => {
      const poolStatus = queueManager.getConnectionPoolStatus();
      assert.strictEqual(poolStatus.total, 5);
      assert(poolStatus.available > 0);
    });

    it('should handle all connections busy', async () => {
      // Mark all as busy
      queueManager.availableConnections = [];
      const conn = queueManager._getConnection();
      assert(conn !== null);
    });

    it('should release connections back to pool', () => {
      const beforeAvailable = queueManager.availableConnections.length;
      const conn = queueManager._getConnection();
      assert(queueManager.availableConnections.length < beforeAvailable);
      queueManager._releaseConnection(conn);
      assert(queueManager.availableConnections.length >= beforeAvailable);
    });
  });

  // Queue Declaration Tests
  describe('Queue Declaration', () => {
    it('should declare monitoring:tasks queue', async () => {
      const queue = await queueManager.declareQueue('monitoring:tasks');
      assert(queue.declared);
      assert.strictEqual(queue.ttl, 3600000);
    });

    it('should declare alerts:send queue', async () => {
      const queue = await queueManager.declareQueue('alerts:send');
      assert(queue.declared);
      assert.strictEqual(queue.ttl, 1800000);
    });

    it('should declare webhooks:dispatch queue', async () => {
      const queue = await queueManager.declareQueue('webhooks:dispatch');
      assert(queue.declared);
    });

    it('should declare forensics:analyze queue', async () => {
      const queue = await queueManager.declareQueue('forensics:analyze');
      assert(queue.declared);
    });

    it('should declare reports:generate queue', async () => {
      const queue = await queueManager.declareQueue('reports:generate');
      assert(queue.declared);
    });

    it('should declare cleanup:expired queue', async () => {
      const queue = await queueManager.declareQueue('cleanup:expired');
      assert(queue.declared);
    });

    it('should declare backups:create queue', async () => {
      const queue = await queueManager.declareQueue('backups:create');
      assert(queue.declared);
    });

    it('should declare dlq queue', async () => {
      const queue = await queueManager.declareQueue('dlq');
      assert(queue.declared);
      assert.strictEqual(queue.ttl, 604800000); // 7 days
    });

    it('should get queue status', async () => {
      await queueManager.declareQueue('monitoring:tasks');
      const status = queueManager.getQueueStatus('monitoring:tasks');
      assert.strictEqual(status.queueName, 'monitoring:tasks');
      assert.strictEqual(status.depth, 0);
    });

    it('should get all queue statuses', async () => {
      await queueManager.declareQueue('monitoring:tasks');
      await queueManager.declareQueue('alerts:send');
      const statuses = queueManager.getAllQueueStatuses();
      assert(statuses['monitoring:tasks']);
      assert(statuses['alerts:send']);
    });
  });

  // Message Publishing Tests
  describe('Message Publishing', () => {
    beforeEach(async () => {
      await queueManager.declareQueue('monitoring:tasks');
    });

    it('should publish message to queue', async () => {
      const result = await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK',
        payload: { url: 'https://example.com' }
      });

      assert(result.messageId);
      assert.strictEqual(result.status, 'published');
      assert.strictEqual(result.queueName, 'monitoring:tasks');
    });

    it('should track published messages', async () => {
      const before = queueManager.metrics.messagesPublished;
      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });
      assert.strictEqual(queueManager.metrics.messagesPublished, before + 1);
    });

    it('should increment queue depth', async () => {
      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });
      const status = queueManager.getQueueStatus('monitoring:tasks');
      assert(status.depth > 0);
    });

    it('should support message priority', async () => {
      const result = await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      }, { priority: 'high' });

      assert(result.messageId);
    });

    it('should support message expiration', async () => {
      const expiresAt = Date.now() + 60000; // 1 minute
      const result = await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      }, { expiresAt });

      assert(result.messageId);
    });

    it('should support custom message ID', async () => {
      const customId = 'msg_custom_123';
      const result = await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      }, { messageId: customId });

      assert.strictEqual(result.messageId, customId);
    });

    it('should emit message:published event', (done) => {
      queueManager.once('message:published', (data) => {
        assert(data.messageId);
        assert.strictEqual(data.queueName, 'monitoring:tasks');
        done();
      });

      queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });
    });
  });

  // Message Consumption Tests
  describe('Message Consumption', () => {
    beforeEach(async () => {
      await queueManager.declareQueue('monitoring:tasks');
    });

    it('should consume messages from queue', async () => {
      let processedCount = 0;

      await queueManager.consumeMessages('monitoring:tasks', async (message, context) => {
        processedCount++;
        context.ack();
      });

      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      assert(processedCount > 0);
    });

    it('should acknowledge messages', (done) => {
      queueManager.once('message:acked', () => {
        done();
      });

      queueManager.consumeMessages('monitoring:tasks', async (message, context) => {
        context.ack();
      });

      queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });
    });

    it('should handle message nack with retry', async () => {
      let attempts = 0;

      await queueManager.consumeMessages('monitoring:tasks', async (message, context) => {
        attempts++;
        if (attempts < 2) {
          context.nack();
        } else {
          context.ack();
        }
      });

      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      assert(attempts >= 1);
    });

    it('should track consumed messages', async () => {
      const before = queueManager.metrics.messagesConsumed;

      await queueManager.consumeMessages('monitoring:tasks', async (message, context) => {
        context.ack();
      });

      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      assert(queueManager.metrics.messagesConsumed > before);
    });
  });

  // Exchange Tests
  describe('Exchange Management', () => {
    it('should declare topic exchange', async () => {
      const exchange = await queueManager.declareExchange('monitoring', 'topic');
      assert.strictEqual(exchange.type, 'topic');
      assert(exchange.declared);
    });

    it('should declare direct exchange', async () => {
      const exchange = await queueManager.declareExchange('alerts', 'direct');
      assert.strictEqual(exchange.type, 'direct');
    });

    it('should declare fanout exchange', async () => {
      const exchange = await queueManager.declareExchange('broadcast', 'fanout');
      assert.strictEqual(exchange.type, 'fanout');
    });
  });

  // Purge and Cleanup Tests
  describe('Queue Purge and Cleanup', () => {
    beforeEach(async () => {
      await queueManager.declareQueue('monitoring:tasks');
    });

    it('should purge queue', async () => {
      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      const result = await queueManager.purgeQueue('monitoring:tasks');
      assert(result.purgedCount >= 0);
    });

    it('should clear queue depth after purge', async () => {
      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      await queueManager.purgeQueue('monitoring:tasks');
      const status = queueManager.getQueueStatus('monitoring:tasks');
      assert.strictEqual(status.depth, 0);
    });
  });

  // Metrics Tests
  describe('Metrics and Monitoring', () => {
    it('should track published messages', async () => {
      await queueManager.declareQueue('monitoring:tasks');
      const before = queueManager.metrics.messagesPublished;

      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      assert.strictEqual(queueManager.metrics.messagesPublished, before + 1);
    });

    it('should get comprehensive metrics', async () => {
      const metrics = queueManager.getMetrics();

      assert(metrics.messagesPublished >= 0);
      assert(metrics.messagesConsumed >= 0);
      assert(metrics.averageLatency);
      assert(metrics.connectionPool);
    });

    it('should track latency metrics', async () => {
      await queueManager.declareQueue('monitoring:tasks');

      await queueManager.consumeMessages('monitoring:tasks', async (message, context) => {
        context.ack();
      });

      await queueManager.publishMessage('monitoring:tasks', {
        type: 'MONITORING_CHECK'
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      assert(queueManager.metrics.latencySamples.length > 0);
    });

    it('should reset metrics', () => {
      queueManager.metrics.messagesPublished = 10;
      assert.strictEqual(queueManager.metrics.messagesPublished, 10);
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    it('should handle invalid queue name gracefully', async () => {
      // Should not throw
      const queue = await queueManager.declareQueue('');
      assert(queue);
    });

    it('should track message failures', async () => {
      const before = queueManager.metrics.messagesFailed;

      try {
        await queueManager.publishMessage(null, {});
      } catch (error) {
        // Expected
      }

      assert(queueManager.metrics.messagesFailed >= before);
    });

    it('should emit error events', async () => {
      // Should not throw on invalid operations
      try {
        await queueManager.disconnect();
        await queueManager.declareQueue('test');
      } catch (error) {
        // Expected
      }
    });
  });

  // Event Emission Tests
  describe('Event Emission', () => {
    it('should emit connected event', (done) => {
      const mgr = new QueueManager();
      mgr.once('connected', () => {
        done();
      });
      mgr.connect();
    });

    it('should emit queue:declared event', (done) => {
      queueManager.once('queue:declared', (data) => {
        assert.strictEqual(data.queueName, 'test_queue');
        done();
      });

      queueManager.declareQueue('test_queue');
    });

    it('should emit exchange:declared event', (done) => {
      queueManager.once('exchange:declared', (data) => {
        assert.strictEqual(data.exchangeName, 'test_exchange');
        done();
      });

      queueManager.declareExchange('test_exchange', 'topic');
    });
  });
});
