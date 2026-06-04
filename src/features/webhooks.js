/**
 * Basset Hound Browser - Webhook Management System
 * Enterprise-grade webhook system for event-driven integration
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 *
 * Features:
 * - Register webhooks per event type
 * - HTTP POST delivery with retries
 * - Event filtering and routing
 * - Signature verification (HMAC)
 * - Rate limiting per webhook
 * - Dead-letter queue for failed deliveries
 * - Webhook health monitoring
 * - Event transformation and templating
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');
const url = require('url');

/**
 * Webhook configuration and metadata
 */
class Webhook {
  constructor(config = {}) {
    this.id = crypto.randomBytes(12).toString('hex');
    this.url = config.url;
    this.eventTypes = config.eventTypes || []; // ['change_detected', 'alert_created', ...]
    this.secret = config.secret || crypto.randomBytes(32).toString('hex');
    this.active = config.active !== false;
    this.retryPolicy = {
      maxRetries: config.maxRetries || 5,
      initialDelayMs: config.initialDelayMs || 1000,
      maxDelayMs: config.maxDelayMs || 300000, // 5 minutes
      backoffMultiplier: config.backoffMultiplier || 2
    };
    this.rateLimit = {
      requestsPerSecond: config.requestsPerSecond || 10,
      burstSize: config.burstSize || 20
    };
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000; // 30 seconds
    this.filters = config.filters || {}; // Additional filtering rules
    this.transform = config.transform || null; // Custom transformation function
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.metadata = {
      name: config.name || null,
      description: config.description || null,
      tags: config.tags || []
    };
    // Tracking
    this.stats = {
      totalAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastError: null
    };
  }

  /**
   * Validate webhook configuration
   */
  validate() {
    const errors = [];

    if (!this.url) {
      errors.push('URL is required');
    } else {
      try {
        new URL(this.url);
      } catch {
        errors.push('URL is invalid');
      }
    }

    if (!Array.isArray(this.eventTypes) || this.eventTypes.length === 0) {
      errors.push('At least one event type is required');
    }

    if (this.retryPolicy.maxRetries < 0) {
      errors.push('maxRetries must be >= 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if webhook should handle event
   */
  shouldHandleEvent(eventType, eventData = {}) {
    // Check event type
    if (!this.eventTypes.includes(eventType)) {
      return false;
    }

    // Check active status
    if (!this.active) {
      return false;
    }

    // Check filters
    if (Object.keys(this.filters).length > 0) {
      for (const [key, value] of Object.entries(this.filters)) {
        if (eventData[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Transform event data if transform function provided
   */
  transformEvent(eventType, eventData) {
    if (!this.transform) {
      return {
        event: eventType,
        timestamp: Date.now(),
        data: eventData
      };
    }

    try {
      return this.transform({
        event: eventType,
        timestamp: Date.now(),
        data: eventData
      });
    } catch (err) {
      console.error(`Transform error for webhook ${this.id}:`, err);
      return null;
    }
  }
}

/**
 * Delivery attempt record
 */
class DeliveryRecord {
  constructor(webhookId, eventType, eventData, attempt = 1) {
    this.id = crypto.randomBytes(12).toString('hex');
    this.webhookId = webhookId;
    this.eventType = eventType;
    this.eventData = eventData;
    this.attempt = attempt;
    this.timestamp = Date.now();
    this.status = 'pending'; // pending, delivered, failed, deadletter
    this.statusCode = null;
    this.responseBody = null;
    this.error = null;
    this.nextRetryTime = null;
  }
}

/**
 * Main webhook management system
 */
class WebhookManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.webhooks = new Map(); // webhookId -> Webhook
    this.deliveryQueue = []; // Queue of pending deliveries
    this.deadLetterQueue = []; // Failed deliveries
    this.deliveryHistory = new Map(); // webhookId -> [DeliveryRecord]
    this.rateLimiters = new Map(); // webhookId -> rate limiter state

    this.options = {
      maxDeadLetterSize: options.maxDeadLetterSize || 10000,
      processingInterval: options.processingInterval || 1000,
      maxConcurrentDeliveries: options.maxConcurrentDeliveries || 5,
      historyRetentionDays: options.historyRetentionDays || 30
    };

    this.activeDeliveries = new Set();
    this.processingTimer = null;
    this.cleanupTimer = null;

    this.startProcessing();
    this.startCleanup();
  }

  /**
   * Register a webhook
   */
  registerWebhook(config) {
    const webhook = new Webhook(config);

    const validation = webhook.validate();
    if (!validation.valid) {
      throw new Error(`Invalid webhook: ${validation.errors.join(', ')}`);
    }

    this.webhooks.set(webhook.id, webhook);
    this.deliveryHistory.set(webhook.id, []);
    this.rateLimiters.set(webhook.id, {
      tokens: webhook.rateLimit.burstSize,
      lastRefill: Date.now()
    });

    this.emit('webhook:registered', {
      webhookId: webhook.id,
      url: webhook.url,
      eventTypes: webhook.eventTypes
    });

    return webhook.id;
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    this.webhooks.delete(webhookId);
    this.deliveryHistory.delete(webhookId);
    this.rateLimiters.delete(webhookId);

    this.emit('webhook:unregistered', { webhookId });

    return true;
  }

  /**
   * Get webhook details
   */
  getWebhook(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return null;
    }

    return {
      id: webhook.id,
      url: webhook.url,
      eventTypes: webhook.eventTypes,
      active: webhook.active,
      createdAt: webhook.createdAt,
      stats: webhook.stats,
      metadata: webhook.metadata
    };
  }

  /**
   * List all webhooks
   */
  listWebhooks(filters = {}) {
    const webhooks = Array.from(this.webhooks.values());

    return webhooks
      .filter(w => {
        if (filters.active !== undefined && w.active !== filters.active) {
          return false;
        }
        if (filters.eventType && !w.eventTypes.includes(filters.eventType)) {
          return false;
        }
        if (filters.tag && !w.metadata.tags.includes(filters.tag)) {
          return false;
        }
        return true;
      })
      .map(w => ({
        id: w.id,
        url: w.url,
        eventTypes: w.eventTypes,
        active: w.active,
        stats: w.stats,
        metadata: w.metadata
      }));
  }

  /**
   * Update webhook configuration
   */
  updateWebhook(webhookId, updates) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    // Update allowed fields
    const allowedUpdates = ['eventTypes', 'active', 'headers', 'timeout', 'filters', 'retryPolicy', 'rateLimit'];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        webhook[key] = value;
      }
    }

    if (updates.metadata) {
      webhook.metadata = { ...webhook.metadata, ...updates.metadata };
    }

    webhook.updatedAt = Date.now();

    this.emit('webhook:updated', { webhookId, updates });

    return webhook;
  }

  /**
   * Trigger an event and dispatch to subscribed webhooks
   */
  async triggerEvent(eventType, eventData) {
    const webhooksToNotify = Array.from(this.webhooks.values())
      .filter(w => w.shouldHandleEvent(eventType, eventData));

    if (webhooksToNotify.length === 0) {
      return {
        eventType,
        scheduled: 0
      };
    }

    // Schedule deliveries
    for (const webhook of webhooksToNotify) {
      const transformedData = webhook.transformEvent(eventType, eventData);

      if (transformedData) {
        const record = new DeliveryRecord(webhook.id, eventType, transformedData);
        this.deliveryQueue.push(record);
      }
    }

    this.emit('event:triggered', {
      eventType,
      webhookCount: webhooksToNotify.length
    });

    return {
      eventType,
      scheduled: webhooksToNotify.length
    };
  }

  /**
   * Process delivery queue
   */
  async processDeliveryQueue() {
    while (
      this.deliveryQueue.length > 0 &&
      this.activeDeliveries.size < this.options.maxConcurrentDeliveries
    ) {
      const record = this.deliveryQueue.shift();
      this.activeDeliveries.add(record.id);

      // Deliver in background
      this.deliverWebhook(record).catch(err => {
        console.error(`Delivery error for ${record.id}:`, err);
      });
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  async deliverWebhook(record, retryAttempt = 1) {
    const webhook = this.webhooks.get(record.webhookId);
    if (!webhook) {
      this.activeDeliveries.delete(record.id);
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(record.webhookId)) {
      // Re-queue after delay
      record.nextRetryTime = Date.now() + 1000;
      this.deliveryQueue.push(record);
      this.activeDeliveries.delete(record.id);
      return;
    }

    try {
      record.attempt = retryAttempt;
      webhook.stats.totalAttempts++;

      const result = await this.sendRequest(
        webhook.url,
        record.eventData,
        webhook,
        crypto.createHmac('sha256', webhook.secret)
          .update(JSON.stringify(record.eventData))
          .digest('hex')
      );

      record.status = 'delivered';
      record.statusCode = result.statusCode;
      record.responseBody = result.body;
      webhook.stats.successfulDeliveries++;
      webhook.stats.lastSuccess = Date.now();

      this.recordDelivery(record);
      this.emit('delivery:success', {
        webhookId: record.webhookId,
        eventType: record.eventType,
        statusCode: result.statusCode
      });

    } catch (err) {
      webhook.stats.failedDeliveries++;
      webhook.stats.lastError = err.message;
      record.error = err.message;
      record.status = 'failed';

      // Retry logic
      if (retryAttempt <= webhook.retryPolicy.maxRetries) {
        const delay = Math.min(
          webhook.retryPolicy.initialDelayMs *
            Math.pow(webhook.retryPolicy.backoffMultiplier, retryAttempt - 1),
          webhook.retryPolicy.maxDelayMs
        );

        record.nextRetryTime = Date.now() + delay;
        this.deliveryQueue.push(record);

        this.emit('delivery:retry', {
          webhookId: record.webhookId,
          attempt: retryAttempt,
          nextRetryMs: delay,
          error: err.message
        });
      } else {
        // Move to dead letter queue
        this.moveToDeadLetter(record);

        this.emit('delivery:failed', {
          webhookId: record.webhookId,
          eventType: record.eventType,
          error: err.message
        });
      }

      this.recordDelivery(record);
    }

    this.activeDeliveries.delete(record.id);
  }

  /**
   * Send HTTP request to webhook
   */
  sendRequest(targetUrl, payload, webhook, signature) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(targetUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Basset-Signature': `sha256=${signature}`,
          'X-Basset-Timestamp': Date.now().toString(),
          ...webhook.headers
        },
        timeout: webhook.timeout
      };

      const req = protocol.request(options, (res) => {
        let body = '';

        res.on('data', chunk => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              body
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  /**
   * Check rate limit for webhook
   */
  checkRateLimit(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    const limiter = this.rateLimiters.get(webhookId);

    if (!webhook || !limiter) {
      return false;
    }

    const now = Date.now();
    const timeSinceRefill = (now - limiter.lastRefill) / 1000; // seconds
    const tokensToAdd = timeSinceRefill * webhook.rateLimit.requestsPerSecond;

    limiter.tokens = Math.min(
      webhook.rateLimit.burstSize,
      limiter.tokens + tokensToAdd
    );
    limiter.lastRefill = now;

    if (limiter.tokens >= 1) {
      limiter.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Record delivery in history
   */
  recordDelivery(record) {
    const history = this.deliveryHistory.get(record.webhookId);
    if (history) {
      history.push(record);

      // Keep only recent history
      const cutoffTime = Date.now() - (this.options.historyRetentionDays * 24 * 60 * 60 * 1000);
      while (history.length > 0 && history[0].timestamp < cutoffTime) {
        history.shift();
      }
    }
  }

  /**
   * Move failed delivery to dead letter queue
   */
  moveToDeadLetter(record) {
    this.deadLetterQueue.push(record);

    // Limit DLQ size
    if (this.deadLetterQueue.length > this.options.maxDeadLetterSize) {
      this.deadLetterQueue.shift();
    }
  }

  /**
   * Get delivery history for webhook
   */
  getDeliveryHistory(webhookId, limit = 100) {
    const history = this.deliveryHistory.get(webhookId) || [];
    return history.slice(-limit);
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(limit = 100) {
    return this.deadLetterQueue.slice(-limit);
  }

  /**
   * Retry dead letter queue items
   */
  retryDeadLetter(recordIds = null) {
    let retried = 0;

    for (let i = this.deadLetterQueue.length - 1; i >= 0; i--) {
      const record = this.deadLetterQueue[i];

      if (recordIds && !recordIds.includes(record.id)) {
        continue;
      }

      record.status = 'pending';
      record.attempt = 0;
      record.nextRetryTime = null;
      record.error = null;

      this.deliveryQueue.push(record);
      this.deadLetterQueue.splice(i, 1);
      retried++;
    }

    return { retried };
  }

  /**
   * Start processing queue
   */
  startProcessing() {
    this.processingTimer = setInterval(() => {
      // Handle retries
      const now = Date.now();
      const readyForRetry = this.deliveryQueue
        .filter(r => !r.nextRetryTime || r.nextRetryTime <= now);

      this.deliveryQueue = this.deliveryQueue
        .filter(r => r.nextRetryTime && r.nextRetryTime > now);

      // Process ready items
      for (const record of readyForRetry) {
        this.deliveryQueue.unshift(record);
      }

      this.processDeliveryQueue();
    }, this.options.processingInterval);
  }

  /**
   * Start cleanup timer
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      // Clean old history entries
      const cutoffTime = Date.now() - (this.options.historyRetentionDays * 24 * 60 * 60 * 1000);

      for (const history of this.deliveryHistory.values()) {
        while (history.length > 0 && history[0].timestamp < cutoffTime) {
          history.shift();
        }
      }
    }, 60 * 60 * 1000); // Run hourly
  }

  /**
   * Get webhook statistics
   */
  getStatistics(webhookId = null) {
    if (webhookId) {
      const webhook = this.webhooks.get(webhookId);
      return webhook ? webhook.stats : null;
    }

    const stats = {
      totalWebhooks: this.webhooks.size,
      activeWebhooks: Array.from(this.webhooks.values()).filter(w => w.active).length,
      queuedDeliveries: this.deliveryQueue.length,
      activeDeliveries: this.activeDeliveries.size,
      deadLetterSize: this.deadLetterQueue.length,
      webhooks: {}
    };

    for (const webhook of this.webhooks.values()) {
      stats.webhooks[webhook.id] = webhook.stats;
    }

    return stats;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.webhooks.clear();
    this.deliveryQueue = [];
    this.deadLetterQueue = [];
    this.deliveryHistory.clear();
    this.rateLimiters.clear();
    this.activeDeliveries.clear();
  }
}

module.exports = {
  WebhookManager,
  Webhook,
  DeliveryRecord
};
