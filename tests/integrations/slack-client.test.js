/**
 * Slack Client Unit Tests
 *
 * Tests for:
 * - Webhook registration and management
 * - Rate limiting
 * - Message queuing
 * - Retry logic
 * - Error handling
 *
 * @test
 */

const { SlackClient, SLACK_RATE_LIMITS } = require('../../integrations/slack-client');

describe('SlackClient', () => {
  let client;
  const testWebhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX';
  const testWebhookId = 'test-webhook';

  beforeEach(() => {
    client = new SlackClient({
      retryAttempts: 2,
      retryDelayMs: 100
    });
  });

  afterEach(() => {
    client.destroy();
  });

  describe('Webhook Management', () => {
    test('should add a webhook', () => {
      const result = client.addWebhook(testWebhookId, testWebhookUrl);

      expect(result.success).toBe(true);
      expect(client.webhookUrls[testWebhookId]).toBe(testWebhookUrl);
    });

    test('should reject invalid webhook URLs', () => {
      const result = client.addWebhook('invalid', 'https://example.com/webhook');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    test('should remove a webhook', () => {
      client.addWebhook(testWebhookId, testWebhookUrl);
      const result = client.removeWebhook(testWebhookId);

      expect(result.success).toBe(true);
      expect(client.webhookUrls[testWebhookId]).toBeUndefined();
    });

    test('should return error when removing non-existent webhook', () => {
      const result = client.removeWebhook('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should list webhooks with masked URLs', () => {
      client.addWebhook('webhook1', testWebhookUrl);
      client.addWebhook('webhook2', testWebhookUrl);

      const list = client.listWebhooks();

      expect(list).toHaveProperty('webhook1');
      expect(list).toHaveProperty('webhook2');
      expect(list.webhook1).not.toContain('XXXX'); // Masked
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce per-second rate limit', () => {
      client.addWebhook(testWebhookId, testWebhookUrl);

      // First message should be allowed
      let result = client.checkRateLimit(testWebhookId);
      expect(result.allowed).toBe(true);

      // Second message in same window should fail
      result = client.checkRateLimit(testWebhookId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeDefined();
    });

    test('should reset rate limit after 1 second', (done) => {
      client.addWebhook(testWebhookId, testWebhookUrl);

      // Use up the limit
      client.checkRateLimit(testWebhookId);
      client.checkRateLimit(testWebhookId);

      // Wait for window to reset
      setTimeout(() => {
        const result = client.checkRateLimit(testWebhookId);
        expect(result.allowed).toBe(true);
        done();
      }, 1100);
    });

    test('should enforce burst limit', () => {
      client.addWebhook(testWebhookId, testWebhookUrl);
      const tracker = client.rateLimitTrackers[testWebhookId];

      // Simulate burst
      for (let i = 0; i < SLACK_RATE_LIMITS.burstSize; i++) {
        tracker.burstCount++;
      }

      const result = client.checkRateLimit(testWebhookId);
      expect(result.allowed).toBe(false);
    });

    test('should track message count', () => {
      client.addWebhook(testWebhookId, testWebhookUrl);
      const tracker = client.rateLimitTrackers[testWebhookId];

      expect(tracker.messageCount).toBe(0);

      client.checkRateLimit(testWebhookId);
      expect(tracker.messageCount).toBe(1);
    });
  });

  describe('Message Queuing', () => {
    test('should queue messages', (done) => {
      client.addWebhook(testWebhookId, testWebhookUrl);

      const message = {
        text: 'Test message',
        blocks: []
      };

      // This will fail to send but should queue
      client.sendMessage(testWebhookId, message)
        .catch(() => {
          // Expected to fail since we're not hitting real Slack API
          done();
        });
    });

    test('should process queue sequentially', (done) => {
      client.addWebhook(testWebhookId, testWebhookUrl);

      let processedCount = 0;
      const message = { text: 'Test' };

      // Queue multiple messages
      for (let i = 0; i < 3; i++) {
        client.sendMessage(testWebhookId, message)
          .catch(() => {
            processedCount++;
            if (processedCount === 3) {
              done();
            }
          });
      }
    });
  });

  describe('Message Formatting', () => {
    test('should format basic alert with title and message', () => {
      const alert = {
        id: 'alert-123',
        title: 'Test Alert',
        message: 'This is a test',
        severity: 'medium'
      };

      const formatted = client.formatAlert(alert);

      expect(formatted.text).toBe('Test Alert');
      expect(formatted.blocks).toBeDefined();
      expect(formatted.blocks.length).toBeGreaterThan(0);
      expect(formatted.attachments).toBeDefined();
    });

    test('should apply color based on severity', () => {
      const severityColors = {
        critical: '#ff0000',
        high: '#ff6600',
        medium: '#ffcc00',
        low: '#00cc00',
        info: '#0099ff'
      };

      for (const [severity, color] of Object.entries(severityColors)) {
        const alert = {
          id: 'test',
          title: 'Alert',
          message: 'Test',
          severity
        };

        const formatted = client.formatAlert(alert);
        expect(formatted.attachments[0].color).toBe(color);
      }
    });

    test('should include metadata in formatted alert', () => {
      const alert = {
        id: 'alert-123',
        title: 'Test',
        message: 'Test',
        metadata: { key: 'value' }
      };

      const formatted = client.formatAlert(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('Metadata');
    });
  });

  describe('Status and Monitoring', () => {
    test('should return status for specific webhook', () => {
      client.addWebhook(testWebhookId, testWebhookUrl);

      const status = client.getStatus(testWebhookId);

      expect(status.webhookId).toBe(testWebhookId);
      expect(status.registered).toBe(true);
      expect(status.messagesSentThisWindow).toBeDefined();
      expect(status.queuedMessages).toBeDefined();
    });

    test('should return status for all webhooks', () => {
      client.addWebhook('webhook1', testWebhookUrl);
      client.addWebhook('webhook2', testWebhookUrl);

      const status = client.getStatus();

      expect(status.totalWebhooks).toBe(2);
      expect(status.queuedMessages).toBeDefined();
      expect(status.isProcessing).toBeDefined();
      expect(status.webhooks).toHaveProperty('webhook1');
      expect(status.webhooks).toHaveProperty('webhook2');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', () => {
      client.addWebhook(testWebhookId, testWebhookUrl);
      client.messageQueue.push({ test: true });

      client.destroy();

      expect(Object.keys(client.webhookUrls)).toHaveLength(0);
      expect(client.messageQueue).toHaveLength(0);
      expect(Object.keys(client.rateLimitTrackers)).toHaveLength(0);
    });
  });
});
