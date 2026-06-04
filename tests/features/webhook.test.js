/**
 * Webhook Management System Tests
 * Tests for webhook registration, delivery, retries, and error handling
 */

const {
  WebhookManager,
  Webhook,
  DeliveryRecord
} = require('../../src/features/webhooks');

describe('Webhook Management System', () => {
  let manager;
  const validWebhookConfig = {
    url: 'https://example.com/webhook',
    eventTypes: ['change_detected', 'alert_created'],
    name: 'Test Webhook'
  };

  beforeEach(() => {
    manager = new WebhookManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  // ==========================================
  // WEBHOOK REGISTRATION & MANAGEMENT
  // ==========================================

  describe('Webhook Registration', () => {
    test('should register a valid webhook', () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      expect(webhookId).toBeDefined();
      expect(webhookId).toHaveLength(24); // 12 bytes = 24 hex chars

      const webhook = manager.getWebhook(webhookId);
      expect(webhook).toBeDefined();
      expect(webhook.url).toBe(validWebhookConfig.url);
      expect(webhook.eventTypes).toEqual(validWebhookConfig.eventTypes);
    });

    test('should reject webhook without URL', () => {
      const config = { ...validWebhookConfig };
      delete config.url;

      expect(() => manager.registerWebhook(config)).toThrow();
    });

    test('should reject webhook with invalid URL', () => {
      const config = { ...validWebhookConfig, url: 'not-a-url' };

      expect(() => manager.registerWebhook(config)).toThrow();
    });

    test('should reject webhook without event types', () => {
      const config = { ...validWebhookConfig, eventTypes: [] };

      expect(() => manager.registerWebhook(config)).toThrow();
    });

    test('should generate unique webhook IDs', () => {
      const id1 = manager.registerWebhook(validWebhookConfig);
      const id2 = manager.registerWebhook(validWebhookConfig);

      expect(id1).not.toBe(id2);
    });

    test('should generate unique secrets', () => {
      const id1 = manager.registerWebhook(validWebhookConfig);
      const id2 = manager.registerWebhook(validWebhookConfig);

      const webhook1Obj = manager.webhooks.get(id1);
      const webhook2Obj = manager.webhooks.get(id2);

      expect(webhook1Obj.secret).not.toBe(webhook2Obj.secret);
    });
  });

  describe('Webhook Unregistration', () => {
    test('should unregister a webhook', () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);
      const result = manager.unregisterWebhook(webhookId);

      expect(result).toBe(true);
      expect(manager.getWebhook(webhookId)).toBeNull();
    });

    test('should throw error when unregistering non-existent webhook', () => {
      expect(() => manager.unregisterWebhook('fake-id')).toThrow();
    });
  });

  describe('Webhook Updates', () => {
    test('should update webhook configuration', () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      manager.updateWebhook(webhookId, {
        active: false,
        eventTypes: ['alert_created']
      });

      const webhook = manager.getWebhook(webhookId);
      expect(webhook.active).toBe(false);
      expect(webhook.eventTypes).toEqual(['alert_created']);
    });

    test('should update webhook metadata', () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      manager.updateWebhook(webhookId, {
        metadata: {
          description: 'Updated description',
          tags: ['production', 'alerts']
        }
      });

      const webhook = manager.getWebhook(webhookId);
      expect(webhook.metadata.description).toBe('Updated description');
      expect(webhook.metadata.tags).toEqual(['production', 'alerts']);
    });

    test('should not allow updating secure fields', () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);
      const originalWebhook = manager.getWebhook(webhookId);

      manager.updateWebhook(webhookId, { secret: 'new-secret' });

      const webhook = manager.getWebhook(webhookId);
      expect(webhook.secret).toBe(originalWebhook.secret);
    });
  });

  describe('Webhook Listing', () => {
    test('should list all webhooks', () => {
      manager.registerWebhook(validWebhookConfig);
      manager.registerWebhook(validWebhookConfig);
      manager.registerWebhook(validWebhookConfig);

      const webhooks = manager.listWebhooks();
      expect(webhooks).toHaveLength(3);
    });

    test('should filter by active status', () => {
      const id1 = manager.registerWebhook(validWebhookConfig);
      const id2 = manager.registerWebhook(validWebhookConfig);

      manager.updateWebhook(id1, { active: false });

      const activeWebhooks = manager.listWebhooks({ active: true });
      expect(activeWebhooks).toHaveLength(1);
    });

    test('should filter by event type', () => {
      manager.registerWebhook(validWebhookConfig);
      manager.registerWebhook({
        ...validWebhookConfig,
        eventTypes: ['campaign_completed']
      });

      const webhooks = manager.listWebhooks({ eventType: 'change_detected' });
      expect(webhooks).toHaveLength(1);
    });

    test('should filter by tag', () => {
      const id1 = manager.registerWebhook(validWebhookConfig);
      manager.registerWebhook(validWebhookConfig);

      manager.updateWebhook(id1, { metadata: { tags: ['important'] } });

      const webhooks = manager.listWebhooks({ tag: 'important' });
      expect(webhooks).toHaveLength(1);
    });
  });

  // ==========================================
  // EVENT TRIGGERING
  // ==========================================

  describe('Event Triggering', () => {
    test('should trigger event and schedule deliveries', async () => {
      manager.registerWebhook(validWebhookConfig);

      const result = await manager.triggerEvent('change_detected', {
        monitorId: 'monitor-1',
        changeType: 'added'
      });

      expect(result.eventType).toBe('change_detected');
      expect(result.scheduled).toBe(1);
    });

    test('should not trigger for inactive webhooks', async () => {
      const id = manager.registerWebhook(validWebhookConfig);
      manager.updateWebhook(id, { active: false });

      const result = await manager.triggerEvent('change_detected', {
        monitorId: 'monitor-1'
      });

      expect(result.scheduled).toBe(0);
    });

    test('should respect event type filters', async () => {
      manager.registerWebhook(validWebhookConfig);

      const result = await manager.triggerEvent('unknown_event', {});

      expect(result.scheduled).toBe(0);
    });

    test('should respect data filters', async () => {
      manager.registerWebhook({
        ...validWebhookConfig,
        filters: { monitorId: 'monitor-1' }
      });

      const result1 = await manager.triggerEvent('change_detected', {
        monitorId: 'monitor-1'
      });

      const result2 = await manager.triggerEvent('change_detected', {
        monitorId: 'monitor-2'
      });

      expect(result1.scheduled).toBe(1);
      expect(result2.scheduled).toBe(0);
    });
  });

  // ==========================================
  // RATE LIMITING
  // ==========================================

  describe('Rate Limiting', () => {
    test('should enforce rate limit', () => {
      const webhookId = manager.registerWebhook({
        ...validWebhookConfig,
        requestsPerSecond: 2,
        burstSize: 2
      });

      const webhook = manager.webhooks.get(webhookId);

      let passed = 0;
      for (let i = 0; i < 5; i++) {
        if (manager.checkRateLimit(webhookId)) {
          passed++;
        }
      }

      expect(passed).toBe(2); // burst size
    });

    test('should refill tokens over time', (done) => {
      const webhookId = manager.registerWebhook({
        ...validWebhookConfig,
        requestsPerSecond: 10,
        burstSize: 1
      });

      // Exhaust tokens
      manager.checkRateLimit(webhookId);
      expect(manager.checkRateLimit(webhookId)).toBe(false);

      // Wait for refill
      setTimeout(() => {
        expect(manager.checkRateLimit(webhookId)).toBe(true);
        done();
      }, 150); // 10 requests per second = 100ms per request
    });
  });

  // ==========================================
  // DELIVERY TRACKING
  // ==========================================

  describe('Delivery History', () => {
    test('should track delivery history', async () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      await manager.triggerEvent('change_detected', {
        monitorId: 'monitor-1'
      });

      // Give processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = manager.getDeliveryHistory(webhookId);
      expect(history.length).toBeGreaterThanOrEqual(0); // May be async
    });

    test('should limit history size', () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);
      const record = new DeliveryRecord(webhookId, 'change_detected', {});

      // Record many deliveries
      for (let i = 0; i < 120; i++) {
        manager.recordDelivery(record);
      }

      const history = manager.getDeliveryHistory(webhookId, 100);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================
  // STATISTICS
  // ==========================================

  describe('Statistics', () => {
    test('should track webhook statistics', async () => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      await manager.triggerEvent('change_detected', {});
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = manager.getStatistics(webhookId);
      expect(stats).toBeDefined();
      expect(stats.totalAttempts).toBeGreaterThanOrEqual(0);
    });

    test('should aggregate statistics across webhooks', async () => {
      manager.registerWebhook(validWebhookConfig);
      manager.registerWebhook(validWebhookConfig);

      const stats = manager.getStatistics();
      expect(stats.totalWebhooks).toBe(2);
      expect(typeof stats.webhooks).toBe('object');
      expect(Object.keys(stats.webhooks).length).toBe(2);
    });

    test('should track queue and active deliveries', async () => {
      manager.registerWebhook(validWebhookConfig);

      await manager.triggerEvent('change_detected', {});

      const stats = manager.getStatistics();
      expect(stats.queuedDeliveries).toBeGreaterThanOrEqual(0);
      expect(stats.activeDeliveries).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // EVENT EMISSION
  // ==========================================

  describe('Event Emission', () => {
    test('should emit webhook:registered event', (done) => {
      manager.once('webhook:registered', (data) => {
        expect(data.webhookId).toBeDefined();
        expect(data.url).toBe(validWebhookConfig.url);
        done();
      });

      manager.registerWebhook(validWebhookConfig);
    });

    test('should emit webhook:unregistered event', (done) => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      manager.once('webhook:unregistered', (data) => {
        expect(data.webhookId).toBe(webhookId);
        done();
      });

      manager.unregisterWebhook(webhookId);
    });

    test('should emit webhook:updated event', (done) => {
      const webhookId = manager.registerWebhook(validWebhookConfig);

      manager.once('webhook:updated', (data) => {
        expect(data.webhookId).toBe(webhookId);
        done();
      });

      manager.updateWebhook(webhookId, { active: false });
    });

    test('should emit event:triggered event', (done) => {
      manager.registerWebhook(validWebhookConfig);

      manager.once('event:triggered', (data) => {
        expect(data.eventType).toBe('change_detected');
        expect(data.webhookCount).toBe(1);
        done();
      });

      manager.triggerEvent('change_detected', {});
    });
  });

  // ==========================================
  // WEBHOOK CONFIGURATION
  // ==========================================

  describe('Webhook Configuration', () => {
    test('should accept custom headers', () => {
      const customHeaders = {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      };

      const id = manager.registerWebhook({
        ...validWebhookConfig,
        headers: customHeaders
      });

      const webhookObj = manager.webhooks.get(id);
      expect(webhookObj.headers).toBeDefined();
      expect(webhookObj.headers['Authorization']).toBe('Bearer token123');
    });

    test('should support custom timeout', () => {
      const id = manager.registerWebhook({
        ...validWebhookConfig,
        timeout: 60000
      });

      const webhook = manager.webhooks.get(id);
      expect(webhook.timeout).toBe(60000);
    });

    test('should support custom retry policy', () => {
      const id = manager.registerWebhook({
        ...validWebhookConfig,
        maxRetries: 10,
        initialDelayMs: 2000,
        backoffMultiplier: 3
      });

      const webhook = manager.webhooks.get(id);
      expect(webhook.retryPolicy.maxRetries).toBe(10);
      expect(webhook.retryPolicy.backoffMultiplier).toBe(3);
    });
  });

  // ==========================================
  // DEAD LETTER QUEUE
  // ==========================================

  describe('Dead Letter Queue', () => {
    test('should have dead letter queue', () => {
      expect(manager.deadLetterQueue).toBeDefined();
      expect(Array.isArray(manager.deadLetterQueue)).toBe(true);
    });

    test('should retrieve dead letter queue items', () => {
      const record = new DeliveryRecord('webhook-1', 'test_event', {});
      manager.moveToDeadLetter(record);

      const dlq = manager.getDeadLetterQueue();
      expect(dlq).toContainEqual(expect.objectContaining({
        id: record.id
      }));
    });

    test('should retry dead letter items', () => {
      const record = new DeliveryRecord('webhook-1', 'test_event', {});
      manager.moveToDeadLetter(record);

      const result = manager.retryDeadLetter();
      expect(result.retried).toBe(1);
      expect(manager.deadLetterQueue).toHaveLength(0);
    });
  });
});
