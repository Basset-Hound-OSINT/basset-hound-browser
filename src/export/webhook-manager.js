/**
 * Webhook Manager
 * Handles real-time notifications for platform exports
 */

class WebhookManager {
  constructor(config = {}) {
    this.webhooks = new Map();
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 5000,
      ...config
    };
  }

  /**
   * Register a webhook
   * @param {string} webhookId - Unique webhook ID
   * @param {string} webhookUrl - Webhook URL
   * @param {object} config - Webhook configuration
   */
  registerWebhook(webhookId, webhookUrl, config = {}) {
    if (!webhookId || !webhookUrl) {
      throw new Error('webhookId and webhookUrl are required');
    }

    if (!this._isValidUrl(webhookUrl)) {
      throw new Error('Invalid webhook URL format');
    }

    this.webhooks.set(webhookId, {
      url: webhookUrl,
      createdAt: new Date().toISOString(),
      enabled: true,
      retries: 0,
      lastError: null,
      lastSuccess: null,
      eventCount: 0,
      ...config
    });

    return {
      success: true,
      webhookId,
      message: 'Webhook registered successfully'
    };
  }

  /**
   * Unregister a webhook
   * @param {string} webhookId - Webhook ID to remove
   */
  unregisterWebhook(webhookId) {
    if (!this.webhooks.has(webhookId)) {
      return {
        success: false,
        error: 'Webhook not found'
      };
    }

    this.webhooks.delete(webhookId);
    return {
      success: true,
      webhookId,
      message: 'Webhook removed successfully'
    };
  }

  /**
   * List all registered webhooks
   */
  listWebhooks() {
    const webhookList = Array.from(this.webhooks.entries()).map(([id, config]) => ({
      webhookId: id,
      url: config.url,
      enabled: config.enabled,
      createdAt: config.createdAt,
      lastSuccess: config.lastSuccess,
      lastError: config.lastError,
      eventCount: config.eventCount
    }));

    return {
      total: webhookList.length,
      webhooks: webhookList
    };
  }

  /**
   * Trigger event on all registered webhooks
   * @param {string} eventType - Type of event
   * @param {object} payload - Event payload
   */
  async triggerEvent(eventType, payload) {
    const results = [];

    for (const [webhookId, config] of this.webhooks.entries()) {
      if (!config.enabled) continue;

      const result = await this._sendWebhook(webhookId, eventType, payload);
      results.push(result);
    }

    return {
      event: eventType,
      webhooksTriggered: results.length,
      results
    };
  }

  /**
   * Send webhook with retry logic
   * @private
   */
  async _sendWebhook(webhookId, eventType, payload) {
    const config = this.webhooks.get(webhookId);
    const webhookPayload = {
      webhookId,
      eventType,
      timestamp: new Date().toISOString(),
      data: payload
    };

    let lastError = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Basset-Hound-Browser/1.0',
            'X-Webhook-ID': webhookId,
            'X-Event-Type': eventType
          },
          body: JSON.stringify(webhookPayload),
          timeout: this.config.timeout
        });

        if (response.ok) {
          config.lastSuccess = new Date().toISOString();
          config.eventCount = (config.eventCount || 0) + 1;
          config.lastError = null;

          return {
            webhookId,
            success: true,
            statusCode: response.status,
            attempt: attempt + 1,
            timestamp: new Date().toISOString()
          };
        } else if (attempt < this.config.maxRetries - 1) {
          // Retry on server errors
          lastError = `HTTP ${response.status}`;
          await this._delay(this.config.retryDelay * (attempt + 1));
        } else {
          lastError = `HTTP ${response.status} - Max retries exceeded`;
        }
      } catch (error) {
        lastError = error.message;

        if (attempt < this.config.maxRetries - 1) {
          await this._delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    // All retries failed
    config.lastError = lastError;

    return {
      webhookId,
      success: false,
      error: lastError,
      attempts: this.config.maxRetries,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get webhook health/status
   * @param {string} webhookId - Webhook ID
   */
  getWebhookHealth(webhookId) {
    if (!this.webhooks.has(webhookId)) {
      return {
        success: false,
        error: 'Webhook not found'
      };
    }

    const config = this.webhooks.get(webhookId);

    return {
      webhookId,
      url: config.url,
      enabled: config.enabled,
      status: this._determineStatus(config),
      createdAt: config.createdAt,
      lastSuccess: config.lastSuccess,
      lastError: config.lastError,
      eventCount: config.eventCount
    };
  }

  /**
   * Test webhook connectivity
   * @param {string} webhookId - Webhook ID
   */
  async testWebhook(webhookId) {
    if (!this.webhooks.has(webhookId)) {
      return {
        success: false,
        error: 'Webhook not found'
      };
    }

    const config = this.webhooks.get(webhookId);
    const testPayload = {
      webhookId,
      eventType: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Test event from Basset Hound Browser'
      }
    };

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Basset-Hound-Browser/1.0',
          'X-Webhook-ID': webhookId,
          'X-Event-Type': 'test'
        },
        body: JSON.stringify(testPayload),
        timeout: this.config.timeout
      });

      if (response.ok) {
        return {
          success: true,
          webhookId,
          statusCode: response.status,
          message: 'Webhook test successful'
        };
      } else {
        return {
          success: false,
          webhookId,
          statusCode: response.status,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        webhookId,
        error: error.message
      };
    }
  }

  /**
   * Enable/disable webhook
   * @param {string} webhookId - Webhook ID
   * @param {boolean} enabled - Enable or disable
   */
  setWebhookEnabled(webhookId, enabled) {
    if (!this.webhooks.has(webhookId)) {
      return {
        success: false,
        error: 'Webhook not found'
      };
    }

    const config = this.webhooks.get(webhookId);
    config.enabled = Boolean(enabled);

    return {
      success: true,
      webhookId,
      enabled: config.enabled
    };
  }

  /**
   * Determine webhook status
   * @private
   */
  _determineStatus(config) {
    if (!config.enabled) return 'disabled';
    if (!config.lastSuccess) return 'never_tested';
    if (config.lastError) return 'failing';
    return 'healthy';
  }

  /**
   * Validate URL format
   * @private
   */
  _isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delay helper for retry logic
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear old webhooks
   */
  cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    const now = Date.now();
    const toDelete = [];

    for (const [webhookId, config] of this.webhooks.entries()) {
      const createdAt = new Date(config.createdAt).getTime();
      if (now - createdAt > maxAge && !config.enabled) {
        toDelete.push(webhookId);
      }
    }

    toDelete.forEach(id => this.webhooks.delete(id));

    return {
      cleaned: toDelete.length,
      deletedWebhooks: toDelete
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const webhooks = Array.from(this.webhooks.values());

    return {
      totalWebhooks: webhooks.length,
      enabledWebhooks: webhooks.filter(w => w.enabled).length,
      disabledWebhooks: webhooks.filter(w => !w.enabled).length,
      totalEvents: webhooks.reduce((sum, w) => sum + (w.eventCount || 0), 0),
      failingWebhooks: webhooks.filter(w => w.lastError).length,
      healthyWebhooks: webhooks.filter(w => !w.lastError && w.lastSuccess).length
    };
  }
}

module.exports = WebhookManager;
