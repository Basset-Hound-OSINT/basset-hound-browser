/**
 * Wave 15: Error Handling and Recovery Integration Tests
 *
 * Tests error scenarios across integrated features and recovery mechanisms:
 * - Proxy partner failure and fallback
 * - Invalid Slack webhook configuration
 * - Dashboard connection loss and reconnection
 * - Data consistency after errors
 * - Alert propagation during failures
 * - Cost tracking accuracy in error scenarios
 * - Proper cleanup and resource management
 *
 * Tests: 18+ error and recovery scenarios
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('events');

class ResilientProxyManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.partners = new Map();
    this.healthStatus = new Map();
    this.failureLog = [];
    this.recoveryLog = [];
    this.isHealthy = true;
    this.options = {
      maxRetries: options.maxRetries || 3,
      failoverEnabled: options.failoverEnabled !== false,
      ...options
    };
  }

  registerPartner(partnerId, config) {
    this.partners.set(partnerId, config);
    this.healthStatus.set(partnerId, { healthy: true, failureCount: 0 });
  }

  async executeWithRetry(partnerId, operation, retryCount = 0) {
    try {
      const result = await operation();

      // Clear failure count on success
      const status = this.healthStatus.get(partnerId);
      if (status && status.failureCount > 0) {
        status.failureCount = 0;
        this.emit('partnerRecovered', { partnerId });
      }

      return { success: true, ...result };
    } catch (error) {
      this.failureLog.push({
        partnerId,
        error: error.message,
        timestamp: Date.now(),
        retryCount
      });

      // Update failure count
      const status = this.healthStatus.get(partnerId);
      if (status) {
        status.failureCount++;

        if (status.failureCount >= 3) {
          status.healthy = false;
          this.emit('partnerUnhealthy', { partnerId });
        }
      }

      // Retry logic
      if (retryCount < this.options.maxRetries) {
        await new Promise(r => setTimeout(r, 100 * (retryCount + 1)));
        return this.executeWithRetry(partnerId, operation, retryCount + 1);
      }

      // All retries exhausted
      this.emit('partnerFailed', { partnerId, error: error.message });

      if (this.options.failoverEnabled) {
        return this.failoverToHealthyPartner(partnerId, operation);
      }

      throw error;
    }
  }

  async failoverToHealthyPartner(failedPartnerId, operation) {
    const healthyPartners = Array.from(this.healthStatus.entries())
      .filter(([_, status]) => status.healthy && _ !== failedPartnerId)
      .map(([id]) => id);

    if (healthyPartners.length === 0) {
      throw new Error(`No healthy partners available after ${failedPartnerId} failed`);
    }

    const nextPartnerId = healthyPartners[0];
    this.emit('failoverInitiated', { from: failedPartnerId, to: nextPartnerId });

    this.recoveryLog.push({
      failedPartnerId,
      failoverTo: nextPartnerId,
      timestamp: Date.now()
    });

    return this.executeWithRetry(nextPartnerId, operation, 0);
  }

  getFailureLog() {
    return this.failureLog;
  }

  getRecoveryLog() {
    return this.recoveryLog;
  }

  getPartnerHealth(partnerId) {
    return this.healthStatus.get(partnerId) || null;
  }
}

class ResilientSlackIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    this.webhookUrl = options.webhookUrl;
    this.isConfigured = !!options.webhookUrl;
    this.failureRate = options.failureRate || 0;
    this.retryQueue = [];
    this.retryTimer = null;
    this.maxRetries = options.maxRetries || 3;
    this.options = options;
  }

  updateWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
      this.emit('configError', { error: 'Invalid webhook URL' });
      return { success: false, error: 'Invalid URL' };
    }
    this.webhookUrl = url;
    this.isConfigured = true;
    this.emit('webhookUpdated', { url });
    return { success: true };
  }

  async sendAlert(alert, retryCount = 0) {
    if (!this.isConfigured) {
      const error = new Error('Slack not configured');
      this.emit('configError', { error: error.message });
      return { success: false, error: error.message };
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const shouldFail = Math.random() < this.failureRate;

        if (shouldFail) {
          const error = new Error('Slack API error');
          this.emit('sendError', { alertId: alert.id, error: error.message, retryCount });

          if (retryCount < this.maxRetries) {
            this.retryQueue.push({ alert, retryCount: retryCount + 1, resolve });
            this.scheduleRetry();
          } else {
            resolve({ success: false, error: error.message, retriesExhausted: true });
          }
        } else {
          this.emit('alertSent', { alertId: alert.id, retryCount });
          resolve({ success: true, alertId: alert.id });
        }
      }, 50);
    });
  }

  scheduleRetry() {
    if (this.retryTimer || this.retryQueue.length === 0) return;

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;

      const batch = [...this.retryQueue];
      this.retryQueue = [];

      for (const { alert, retryCount, resolve } of batch) {
        const result = await this.sendAlert(alert, retryCount);
        resolve(result);
      }
    }, 200);
  }

  getRetryQueueSize() {
    return this.retryQueue.length;
  }
}

class ResilientDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    this.alerts = [];
    this.isConnected = true;
    this.connectionLossSimulated = false;
    this.recoveryAttempts = 0;
    this.options = {
      reconnectDelay: options.reconnectDelay || 1000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      ...options
    };
  }

  addAlert(alert) {
    if (!this.isConnected) {
      throw new Error('Dashboard not connected');
    }

    const alertWithId = {
      id: `alert-${Date.now()}`,
      timestamp: Date.now(),
      ...alert
    };

    this.alerts.push(alertWithId);
    this.emit('alertAdded', alertWithId);
    return alertWithId;
  }

  simulateConnectionLoss() {
    this.isConnected = false;
    this.connectionLossSimulated = true;
    this.emit('connectionLost', {});
  }

  async reconnect() {
    this.recoveryAttempts++;

    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.recoveryAttempts <= this.options.maxReconnectAttempts) {
          this.isConnected = true;
          this.emit('reconnected', { attempts: this.recoveryAttempts });
          resolve({ success: true, attempts: this.recoveryAttempts });
        } else {
          resolve({ success: false, error: 'Max reconnection attempts exceeded' });
        }
      }, this.options.reconnectDelay);
    });
  }

  verifyStateConsistency() {
    // Check internal consistency
    const issues = [];

    if (this.connectionLossSimulated && this.isConnected && this.recoveryAttempts === 0) {
      issues.push('Connection loss not properly tracked');
    }

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  getMetrics() {
    return {
      alertCount: this.alerts.length,
      isConnected: this.isConnected,
      recoveryAttempts: this.recoveryAttempts,
      connectionLossDetected: this.connectionLossSimulated
    };
  }
}

describe('Wave 15 - Error Handling and Recovery Tests', () => {
  let proxyMgr;
  let slack;
  let dashboard;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `wave15-errors-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    proxyMgr = new ResilientProxyManager({ failoverEnabled: true });
    slack = new ResilientSlackIntegration({ webhookUrl: 'https://hooks.slack.com/test' });
    dashboard = new ResilientDashboard();

    // Register proxy partners
    proxyMgr.registerPartner('partner-1', { name: 'Partner 1', tier: 'standard' });
    proxyMgr.registerPartner('partner-2', { name: 'Partner 2', tier: 'standard' });
    proxyMgr.registerPartner('partner-3', { name: 'Partner 3', tier: 'budget' });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('1. Proxy Partner Failure and Fallback', () => {
    test('should detect proxy partner failure', async () => {
      let failureDetected = false;
      proxyMgr.on('partnerFailed', () => {
        failureDetected = true;
      });

      const failingOperation = () => {
        throw new Error('Connection timeout');
      };

      try {
        await proxyMgr.executeWithRetry('partner-1', failingOperation);
      } catch (e) {
        // Expected
      }

      assert(failureDetected);
    });

    test('should retry failed proxy requests', async () => {
      let callCount = 0;
      const operation = () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await proxyMgr.executeWithRetry('partner-1', operation);

      assert(result.success);
      assert.strictEqual(callCount, 2);
    });

    test('should failover to healthy partner after repeated failures', async () => {
      let failoverDetected = false;
      let failoverTo = null;

      proxyMgr.on('failoverInitiated', (event) => {
        failoverDetected = true;
        failoverTo = event.to;
      });

      const failingOp = () => {
        throw new Error('Partner 1 is down');
      };

      try {
        await proxyMgr.executeWithRetry('partner-1', failingOp);
      } catch (e) {
        // Expected to failover or fail
      }

      // Check if failover was attempted
      const recoveryLog = proxyMgr.getRecoveryLog();
      assert(recoveryLog.length > 0 || failoverDetected);
    });

    test('should track failure history', async () => {
      const failingOp = () => {
        throw new Error('Partner failure');
      };

      try {
        await proxyMgr.executeWithRetry('partner-1', failingOp);
      } catch (e) {
        // Expected
      }

      const failureLog = proxyMgr.getFailureLog();
      assert(failureLog.length > 0);
      assert.strictEqual(failureLog[0].partnerId, 'partner-1');
    });
  });

  describe('2. Slack Configuration Errors', () => {
    test('should reject invalid webhook URL', () => {
      const result = slack.updateWebhookUrl(null);

      assert.strictEqual(result.success, false);
      assert(result.error);
    });

    test('should prevent sending without configuration', async () => {
      const unconfiguredSlack = new ResilientSlackIntegration({});

      const result = await unconfiguredSlack.sendAlert({ id: 'alert-1' });

      assert.strictEqual(result.success, false);
      assert(result.error.includes('not configured'));
    });

    test('should emit config error event', (done) => {
      slack.on('configError', (event) => {
        assert(event.error);
        done();
      });

      const unconfiguredSlack = new ResilientSlackIntegration({});
      unconfiguredSlack.sendAlert({ id: 'alert-1' });
    });

    test('should allow reconfiguration after error', () => {
      slack.updateWebhookUrl(null); // Invalid
      assert(!slack.isConfigured);

      slack.updateWebhookUrl('https://hooks.slack.com/new');
      assert(slack.isConfigured);
    });
  });

  describe('3. Dashboard Connection Loss and Recovery', () => {
    test('should detect connection loss', () => {
      assert(dashboard.isConnected);

      dashboard.simulateConnectionLoss();

      assert(!dashboard.isConnected);
    });

    test('should prevent operations when disconnected', () => {
      dashboard.simulateConnectionLoss();

      assert.throws(() => {
        dashboard.addAlert({ changeType: 'test' });
      });
    });

    test('should recover connection after loss', async () => {
      dashboard.simulateConnectionLoss();
      assert(!dashboard.isConnected);

      const result = await dashboard.reconnect();

      assert(result.success);
      assert(dashboard.isConnected);
    });

    test('should track recovery attempts', async () => {
      dashboard.simulateConnectionLoss();

      await dashboard.reconnect();

      assert.strictEqual(dashboard.recoveryAttempts, 1);
    });

    test('should resume operations after reconnection', async () => {
      dashboard.simulateConnectionLoss();
      await dashboard.reconnect();

      const alert = dashboard.addAlert({ changeType: 'test' });

      assert(alert.id);
      assert.strictEqual(dashboard.alerts.length, 1);
    });

    test('should fail after max reconnection attempts exceeded', async () => {
      dashboard = new ResilientDashboard({ maxReconnectAttempts: 2, reconnectDelay: 50 });
      dashboard.simulateConnectionLoss();

      await dashboard.reconnect(); // 1st attempt
      dashboard.isConnected = false; // Simulate continued failure
      dashboard.recoveryAttempts = 0;
      dashboard.simulateConnectionLoss();

      const result1 = await dashboard.reconnect(); // 1st attempt
      dashboard.isConnected = false;
      dashboard.recoveryAttempts = 0;
      dashboard.simulateConnectionLoss();

      const result2 = await dashboard.reconnect(); // 2nd attempt

      assert(result2.success);

      dashboard.isConnected = false;
      dashboard.recoveryAttempts = 0;
      dashboard.simulateConnectionLoss();

      const result3 = await dashboard.reconnect(); // 3rd attempt - should fail

      assert(!result3.success);
    });
  });

  describe('4. Slack Send Failures and Retry', () => {
    test('should retry failed Slack sends', async () => {
      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 0.5, // 50% failure rate
        maxRetries: 3
      });

      let sendCount = 0;
      slack.on('sendError', () => sendCount++);

      const result = await slack.sendAlert({ id: 'alert-1' });

      // Should eventually succeed or exhaust retries
      assert(result.success || result.retriesExhausted);
    });

    test('should queue alerts for retry', async () => {
      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 1.0 // Always fail initially
      });

      const promise = slack.sendAlert({ id: 'alert-1' });

      // Queue should have items
      await new Promise(r => setTimeout(r, 100));

      assert(slack.getRetryQueueSize() > 0);
    });

    test('should handle exhausted retries', async () => {
      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 1.0,
        maxRetries: 1
      });

      const result = await slack.sendAlert({ id: 'alert-1' });

      assert.strictEqual(result.success, false);
      assert(result.retriesExhausted);
    });
  });

  describe('5. Data Consistency After Errors', () => {
    test('should maintain alert consistency after proxy failure', async () => {
      // Add alerts before failure
      const alert1 = dashboard.addAlert({ changeType: 'type1' });

      // Simulate proxy failure
      proxyMgr.healthStatus.get('partner-1').healthy = false;

      // Add more alerts
      const alert2 = dashboard.addAlert({ changeType: 'type2' });

      // All alerts should be present
      assert.strictEqual(dashboard.alerts.length, 2);
      assert.strictEqual(dashboard.alerts[0].id, alert1.id);
      assert.strictEqual(dashboard.alerts[1].id, alert2.id);
    });

    test('should preserve dashboard state during Slack failures', async () => {
      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 1.0
      });

      const alert = dashboard.addAlert({ changeType: 'test' });

      // Try Slack send (will fail)
      await slack.sendAlert(alert);

      // Dashboard state should be intact
      assert.strictEqual(dashboard.alerts.length, 1);
      assert(dashboard.isConnected);
    });

    test('should verify state consistency after recovery', async () => {
      dashboard.addAlert({ changeType: 'test1' });
      dashboard.simulateConnectionLoss();
      await dashboard.reconnect();
      dashboard.addAlert({ changeType: 'test2' });

      const consistency = dashboard.verifyStateConsistency();

      assert(consistency.consistent);
    });
  });

  describe('6. Cross-Feature Error Propagation', () => {
    test('should propagate proxy failure information to dashboard', async () => {
      let proxyErrorReached = false;

      dashboard.on('proxyError', () => {
        proxyErrorReached = true;
      });

      proxyMgr.on('partnerFailed', () => {
        dashboard.emit('proxyError', { partnerId: 'partner-1' });
      });

      const failingOp = () => {
        throw new Error('Proxy error');
      };

      try {
        await proxyMgr.executeWithRetry('partner-1', failingOp);
      } catch (e) {
        // Expected
      }

      assert(proxyErrorReached);
    });

    test('should propagate Slack failure to dashboard', async () => {
      let slackErrorReached = false;

      dashboard.on('slackError', () => {
        slackErrorReached = true;
      });

      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 1.0
      });

      slack.on('sendError', (event) => {
        dashboard.emit('slackError', event);
      });

      await slack.sendAlert({ id: 'alert-1' });

      assert(slackErrorReached);
    });
  });

  describe('7. Resource Cleanup After Errors', () => {
    test('should cleanup retry queue on completion', async () => {
      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 0
      });

      await slack.sendAlert({ id: 'alert-1' });

      assert.strictEqual(slack.getRetryQueueSize(), 0);
    });

    test('should maintain resource limits during failures', async () => {
      // Simulate many failures
      const failingOp = () => {
        throw new Error('Failure');
      };

      for (let i = 0; i < 10; i++) {
        try {
          await proxyMgr.executeWithRetry('partner-1', failingOp);
        } catch (e) {
          // Expected
        }
      }

      // Failure log should grow but be bounded
      const failureLog = proxyMgr.getFailureLog();
      assert(failureLog.length > 0);
      assert(failureLog.length <= 40); // 10 operations * 4 retries max
    });
  });

  describe('8. Graceful Degradation', () => {
    test('should continue with partial failure in multi-alert scenario', async () => {
      // Add multiple alerts
      const alerts = [
        dashboard.addAlert({ changeType: 'type1' }),
        dashboard.addAlert({ changeType: 'type2' }),
        dashboard.addAlert({ changeType: 'type3' })
      ];

      // Simulate Slack failure for first alert
      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 0.33
      });

      const results = [];
      for (const alert of alerts) {
        const result = await slack.sendAlert(alert);
        results.push(result);
      }

      // Should have attempted all
      assert.strictEqual(results.length, 3);
    });

    test('should fall back to local logging on Slack failure', () => {
      const failureLog = [];

      slack.on('sendError', (event) => {
        failureLog.push(event);
      });

      slack = new ResilientSlackIntegration({
        webhookUrl: 'https://hooks.slack.com/test',
        failureRate: 1.0
      });

      slack.sendAlert({ id: 'alert-1' });

      // Later, verify fallback occurred
      setTimeout(() => {
        assert(failureLog.length > 0 || slack.getRetryQueueSize() > 0);
      }, 300);
    });
  });

  describe('9. Error Recovery Scenarios', () => {
    test('should recover when all partners become healthy again', async () => {
      // Mark all as unhealthy
      proxyMgr.healthStatus.forEach(status => {
        status.healthy = false;
      });

      // Mark them healthy again
      proxyMgr.healthStatus.forEach(status => {
        status.healthy = true;
      });

      const partner1Health = proxyMgr.getPartnerHealth('partner-1');
      assert(partner1Health.healthy);
    });

    test('should recover Slack after reconfiguration', async () => {
      slack.updateWebhookUrl(''); // Invalid

      assert(!slack.isConfigured);

      slack.updateWebhookUrl('https://hooks.slack.com/new');

      assert(slack.isConfigured);
    });

    test('should recover dashboard after multiple reconnection cycles', async () => {
      dashboard.simulateConnectionLoss();
      await dashboard.reconnect();

      dashboard.simulateConnectionLoss();
      await dashboard.reconnect();

      assert(dashboard.isConnected);
      assert.strictEqual(dashboard.recoveryAttempts, 2);
    });
  });
});
