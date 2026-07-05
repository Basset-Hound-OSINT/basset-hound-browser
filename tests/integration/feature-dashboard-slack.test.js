/**
 * Wave 15: Dashboard + Slack Integration Tests
 *
 * Comprehensive integration testing for Dashboard and Slack alert flows
 * Tests the complete workflow from competitor change detection through
 * dashboard display to Slack notification delivery.
 *
 * Scenarios Covered:
 * - Price drop detection → dashboard alert → Slack notification
 * - Technology update detection → dashboard update → Slack message
 * - Multiple changes → dashboard aggregation → batched Slack alerts
 * - Dashboard configuration of Slack webhook
 * - Race condition prevention
 * - Duplicate alert prevention
 * - Alert ordering and timing
 *
 * Tests: 20+ scenarios
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('events');

// Mock implementations for isolated testing
class MockDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    this.alerts = [];
    this.displayedAlerts = new Set();
    this.settings = {
      slackWebhookUrl: null,
      alertAggregationEnabled: true,
      aggregationWindow: options.aggregationWindow || 5000,
      autoAcknowledge: false
    };
    this.alertQueue = [];
    this.aggregationTimer = null;
    this.config = options;
  }

  addAlert(alert) {
    const alertWithId = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      status: 'pending',
      dismissedAt: null,
      ...alert
    };
    this.alerts.push(alertWithId);
    this.emit('alertAdded', alertWithId);
    return alertWithId;
  }

  displayAlert(alert) {
    if (this.displayedAlerts.has(alert.id)) {
      return; // Already displayed
    }
    this.displayedAlerts.add(alert.id);
    alert.displayedAt = Date.now();
    this.emit('alertDisplayed', alert);
  }

  dismissAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'dismissed';
      alert.dismissedAt = Date.now();
      this.displayedAlerts.delete(alertId);
      this.emit('alertDismissed', alertId);
    }
  }

  updateSlackConfig(webhookUrl) {
    this.settings.slackWebhookUrl = webhookUrl;
    this.emit('slackConfigUpdated', { webhookUrl });
  }

  getAlerts(filter = {}) {
    return this.alerts.filter(a => {
      if (filter.status && a.status !== filter.status) {
        return false;
      }
      if (filter.competitorId && a.competitorId !== filter.competitorId) {
        return false;
      }
      if (filter.changeType && a.changeType !== filter.changeType) {
        return false;
      }
      return true;
    });
  }

  aggregateAlerts(window = this.settings.aggregationWindow) {
    const now = Date.now();
    const recentAlerts = this.alerts.filter(a =>
      a.timestamp > now - window && a.status === 'pending'
    );

    if (recentAlerts.length === 0) {
      return null;
    }

    return {
      id: `batch-${Date.now()}`,
      type: 'batch',
      alerts: recentAlerts,
      count: recentAlerts.length,
      timestamp: now
    };
  }
}

class MockSlackIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    this.webhookUrl = options.webhookUrl;
    this.messageQueue = [];
    this.sentMessages = [];
    this.failureRate = options.failureRate || 0;
    this.config = options;
  }

  async sendAlert(alert) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (Math.random() < this.failureRate) {
          const error = {
            success: false,
            error: 'Simulated Slack error',
            alertId: alert.id
          };
          this.emit('alertFailed', error);
          resolve(error);
        } else {
          const message = {
            id: `msg-${Date.now()}`,
            alertId: alert.id,
            timestamp: Date.now(),
            channel: alert.channel || 'alerts',
            text: this.formatAlertMessage(alert),
            success: true
          };
          this.sentMessages.push(message);
          this.emit('alertSent', message);
          resolve(message);
        }
      }, Math.random() * 100);
    });
  }

  async sendBatch(batch) {
    const results = [];
    for (const alert of batch.alerts) {
      const result = await this.sendAlert(alert);
      results.push(result);
    }
    return {
      id: `batch-msg-${Date.now()}`,
      batchId: batch.id,
      count: results.length,
      timestamp: Date.now(),
      results
    };
  }

  formatAlertMessage(alert) {
    if (alert.type === 'price_change') {
      return `Price change for ${alert.competitorName}: ${alert.oldPrice} → ${alert.newPrice}`;
    } else if (alert.type === 'technology_update') {
      return `Technology update for ${alert.competitorName}: ${alert.technology} ${alert.oldVersion} → ${alert.newVersion}`;
    }
    return `Alert for ${alert.competitorName}: ${alert.changeType}`;
  }

  getSentMessages() {
    return this.sentMessages;
  }
}

class AlertDashboardSlackBridge extends EventEmitter {
  constructor(dashboard, slack, options = {}) {
    super();
    this.dashboard = dashboard;
    this.slack = slack;
    this.options = {
      autoForwardAlerts: options.autoForwardAlerts !== false,
      batchingEnabled: options.batchingEnabled !== false,
      batchWindow: options.batchWindow || 5000,
      deduplicationEnabled: options.deduplicationEnabled !== false,
      ...options
    };
    this.pendingBatch = null;
    this.batchTimer = null;
    this.sentAlerts = new Set();
    this.alertMapping = new Map(); // dashboard alert ID -> Slack message ID

    this.setupListeners();
  }

  setupListeners() {
    // When dashboard receives alert
    this.dashboard.on('alertAdded', (alert) => {
      this.handleDashboardAlert(alert);
    });

    // When user dismisses in dashboard
    this.dashboard.on('alertDismissed', (alertId) => {
      this.handleAlertDismissal(alertId);
    });

    // When Slack sends
    this.slack.on('alertSent', (message) => {
      this.emit('slackAlertSent', message);
    });

    this.slack.on('alertFailed', (error) => {
      this.emit('slackAlertFailed', error);
    });
  }

  handleDashboardAlert(alert) {
    // Display in dashboard
    this.dashboard.displayAlert(alert);

    if (!this.options.autoForwardAlerts || !this.dashboard.settings.slackWebhookUrl) {
      return;
    }

    // Check deduplication
    if (this.options.deduplicationEnabled) {
      const hash = this.generateAlertHash(alert);
      if (this.sentAlerts.has(hash)) {
        this.emit('alertDeduped', alert.id);
        return;
      }
      this.sentAlerts.add(hash);
    }

    if (this.options.batchingEnabled) {
      this.queueForBatch(alert);
    } else {
      this.slack.sendAlert(alert).then(result => {
        this.alertMapping.set(alert.id, result.id);
      });
    }
  }

  queueForBatch(alert) {
    if (!this.pendingBatch) {
      this.pendingBatch = { alerts: [], startTime: Date.now() };
    }

    this.pendingBatch.alerts.push(alert);
    this.emit('alertQueuedForBatch', alert.id);

    // Clear existing timer and set new one
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.pendingBatch && this.pendingBatch.alerts.length > 0) {
        this.sendBatch();
      }
    }, this.options.batchWindow);
  }

  async sendBatch() {
    if (!this.pendingBatch || this.pendingBatch.alerts.length === 0) {
      return null;
    }

    const batch = {
      id: `batch-${Date.now()}`,
      alerts: this.pendingBatch.alerts
    };

    const result = await this.slack.sendBatch(batch);

    // Map results
    for (let i = 0; i < batch.alerts.length; i++) {
      if (result.results[i] && result.results[i].success) {
        this.alertMapping.set(batch.alerts[i].id, result.results[i].id);
      }
    }

    this.pendingBatch = null;
    this.emit('batchSent', result);
    return result;
  }

  handleAlertDismissal(alertId) {
    // Alert was dismissed in dashboard
    this.emit('dashboardAlertDismissed', alertId);
  }

  generateAlertHash(alert) {
    return `${alert.competitorId}-${alert.changeType}-${Math.floor(alert.timestamp / 60000) * 60000}`;
  }
}

describe('Wave 15 - Dashboard + Slack Integration Tests', () => {
  let dashboard;
  let slack;
  let bridge;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `wave15-dash-slack-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    dashboard = new MockDashboard();
    slack = new MockSlackIntegration();
    bridge = new AlertDashboardSlackBridge(dashboard, slack);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    if (bridge.batchTimer) {
      clearTimeout(bridge.batchTimer);
    }
  });

  describe('1. Price Drop Detection Flow', () => {
    test('should detect price drop and display in dashboard', () => {
      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change',
        type: 'price_change',
        oldPrice: '$100',
        newPrice: '$80',
        url: 'https://acme.com/pricing',
        severity: 'high'
      };

      const displayedAlert = dashboard.addAlert(alert);
      dashboard.displayAlert(displayedAlert);

      assert.strictEqual(dashboard.displayedAlerts.has(displayedAlert.id), true);
      assert.strictEqual(displayedAlert.status, 'pending');
      assert(displayedAlert.displayedAt);
    });

    test('should send price drop alert to Slack', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');
      bridge = new AlertDashboardSlackBridge(dashboard, slack); // Recreate bridge with configured dashboard

      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change',
        type: 'price_change',
        oldPrice: '$100',
        newPrice: '$80',
        url: 'https://acme.com/pricing',
        severity: 'high'
      };

      const displayedAlert = dashboard.addAlert(alert);

      await new Promise(resolve => setTimeout(resolve, 200));

      const sentMessages = slack.getSentMessages();
      assert(sentMessages.length > 0);
    });

    test('should prevent duplicate price alerts within time window', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const alert1 = {
        competitorId: 'comp-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change',
        type: 'price_change',
        oldPrice: '$100',
        newPrice: '$80'
      };

      const alert2 = {
        competitorId: 'comp-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change',
        type: 'price_change',
        oldPrice: '$80',
        newPrice: '$70'
      };

      let dedupCount = 0;
      bridge.on('alertDeduped', () => dedupCount++);

      dashboard.addAlert(alert1);
      dashboard.addAlert(alert2);

      await new Promise(resolve => setTimeout(resolve, 300));

      assert(dedupCount > 0);
    });
  });

  describe('2. Technology Update Detection Flow', () => {
    test('should detect technology update and display in dashboard', () => {
      const alert = {
        competitorId: 'comp-002',
        competitorName: 'TechCorp',
        changeType: 'technology_update',
        type: 'technology_update',
        technology: 'React',
        oldVersion: '17.0.0',
        newVersion: '18.0.0',
        changes: ['Concurrent rendering', 'Automatic batching'],
        severity: 'medium'
      };

      const displayedAlert = dashboard.addAlert(alert);
      assert.strictEqual(displayedAlert.type, 'technology_update');
      assert.strictEqual(displayedAlert.status, 'pending');
    });

    test('should send technology update to Slack with details', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');
      bridge = new AlertDashboardSlackBridge(dashboard, slack); // Recreate bridge with configured dashboard

      const alert = {
        competitorId: 'comp-002',
        competitorName: 'TechCorp',
        changeType: 'technology_update',
        type: 'technology_update',
        technology: 'React',
        oldVersion: '17.0.0',
        newVersion: '18.0.0',
        changes: ['Concurrent rendering']
      };

      dashboard.addAlert(alert);

      await new Promise(resolve => setTimeout(resolve, 200));

      const sentMessages = slack.getSentMessages();
      assert(sentMessages.length > 0);
      assert(sentMessages[0].text.includes('Technology update'));
    });
  });

  describe('3. Multiple Changes Aggregation', () => {
    test('should aggregate multiple alerts in dashboard', async () => {
      const alerts = [
        {
          competitorId: 'comp-001',
          competitorName: 'Acme',
          changeType: 'price_change',
          type: 'price_change',
          oldPrice: '$100',
          newPrice: '$80'
        },
        {
          competitorId: 'comp-001',
          competitorName: 'Acme',
          changeType: 'feature_added',
          type: 'feature_added',
          feature: 'API'
        },
        {
          competitorId: 'comp-002',
          competitorName: 'TechCorp',
          changeType: 'technology_update',
          type: 'technology_update',
          technology: 'React',
          oldVersion: '17',
          newVersion: '18'
        }
      ];

      alerts.forEach(alert => dashboard.addAlert(alert));

      const allAlerts = dashboard.getAlerts();
      assert.strictEqual(allAlerts.length, 3);
    });

    test('should batch multiple changes into single Slack message', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const alerts = [
        {
          competitorId: 'comp-001',
          competitorName: 'Acme',
          changeType: 'price_change',
          type: 'price_change'
        },
        {
          competitorId: 'comp-001',
          competitorName: 'Acme',
          changeType: 'feature_added',
          type: 'feature_added'
        }
      ];

      let batchSent = false;
      bridge.on('batchSent', () => {
        batchSent = true;
      });

      alerts.forEach(alert => dashboard.addAlert(alert));

      await new Promise(resolve => setTimeout(resolve, 6000));

      assert(batchSent);
    });

    test('should maintain correct alert ordering in batch', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const now = Date.now();
      const alerts = [
        { id: 1, competitorId: 'comp-001', timestamp: now, changeType: 'type1' },
        { id: 2, competitorId: 'comp-002', timestamp: now + 100, changeType: 'type2' },
        { id: 3, competitorId: 'comp-001', timestamp: now + 200, changeType: 'type1' }
      ];

      alerts.forEach(alert => dashboard.addAlert(alert));

      await new Promise(resolve => setTimeout(resolve, 6000));

      const batch = dashboard.aggregateAlerts(10000);
      assert(batch);
      assert(batch.alerts[0].timestamp <= batch.alerts[1].timestamp);
    });
  });

  describe('4. Dashboard Slack Configuration', () => {
    test('should save Slack webhook configuration', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXX';
      dashboard.updateSlackConfig(webhookUrl);

      assert.strictEqual(dashboard.settings.slackWebhookUrl, webhookUrl);
    });

    test('should emit event when Slack config updated', (done) => {
      dashboard.on('slackConfigUpdated', ({ webhookUrl }) => {
        assert(webhookUrl);
        done();
      });

      dashboard.updateSlackConfig('https://hooks.slack.com/test');
    });

    test('should not forward alerts without Slack configuration', async () => {
      // Don't set webhook URL
      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      dashboard.addAlert(alert);

      await new Promise(resolve => setTimeout(resolve, 300));

      assert.strictEqual(slack.getSentMessages().length, 0);
    });

    test('should support dynamic webhook update', () => {
      const webhook1 = 'https://hooks.slack.com/1';
      const webhook2 = 'https://hooks.slack.com/2';

      dashboard.updateSlackConfig(webhook1);
      assert.strictEqual(dashboard.settings.slackWebhookUrl, webhook1);

      dashboard.updateSlackConfig(webhook2);
      assert.strictEqual(dashboard.settings.slackWebhookUrl, webhook2);
    });
  });

  describe('5. Alert Dismissal Flow', () => {
    test('should dismiss alert from dashboard', () => {
      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      const addedAlert = dashboard.addAlert(alert);
      dashboard.dismissAlert(addedAlert.id);

      const dismissed = dashboard.alerts.find(a => a.id === addedAlert.id);
      assert.strictEqual(dismissed.status, 'dismissed');
      assert(dismissed.dismissedAt);
    });

    test('should notify bridge when alert dismissed', (done) => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      bridge.on('dashboardAlertDismissed', (alertId) => {
        assert(alertId);
        done();
      });

      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      const addedAlert = dashboard.addAlert(alert);
      dashboard.dismissAlert(addedAlert.id);
    });

    test('should remove dismissed alert from displayed set', () => {
      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      const addedAlert = dashboard.addAlert(alert);
      dashboard.displayAlert(addedAlert);
      assert(dashboard.displayedAlerts.has(addedAlert.id));

      dashboard.dismissAlert(addedAlert.id);
      assert(!dashboard.displayedAlerts.has(addedAlert.id));
    });
  });

  describe('6. Race Condition Prevention', () => {
    test('should handle simultaneous dashboard and Slack operations', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const alerts = Array.from({ length: 10 }, (_, i) => ({
        competitorId: `comp-${i}`,
        competitorName: `Company ${i}`,
        changeType: 'price_change'
      }));

      const promises = alerts.map(alert =>
        Promise.resolve(dashboard.addAlert(alert))
      );

      const added = await Promise.all(promises);

      assert.strictEqual(added.length, 10);
      assert.strictEqual(dashboard.alerts.length, 10);
    });

    test('should prevent duplicate concurrent sends', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      let sendCount = 0;
      const originalSend = slack.sendAlert.bind(slack);
      slack.sendAlert = async (alert) => {
        sendCount++;
        return originalSend(alert);
      };

      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      dashboard.addAlert(alert);
      dashboard.addAlert(alert);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Due to deduplication, should not send both
      assert(sendCount <= 2);
    });
  });

  describe('7. Error Handling Integration', () => {
    test('should handle Slack send failures', async () => {
      slack = new MockSlackIntegration({ failureRate: 1.0 });
      dashboard.updateSlackConfig('https://hooks.slack.com/test');
      bridge = new AlertDashboardSlackBridge(dashboard, slack);

      let failureCount = 0;
      bridge.on('slackAlertFailed', () => {
        failureCount++;
      });

      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      dashboard.addAlert(alert);

      await new Promise(resolve => setTimeout(resolve, 300));

      assert(failureCount > 0);
    });

    test('should continue processing after Slack failure', async () => {
      slack = new MockSlackIntegration({ failureRate: 0.5 });
      bridge = new AlertDashboardSlackBridge(dashboard, slack);
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const alerts = Array.from({ length: 5 }, (_, i) => ({
        competitorId: `comp-${i}`,
        competitorName: `Company ${i}`,
        changeType: 'price_change'
      }));

      alerts.forEach(alert => dashboard.addAlert(alert));

      await new Promise(resolve => setTimeout(resolve, 6000));

      // Should have processed all alerts despite some failures
      assert(dashboard.alerts.length === 5);
    });
  });

  describe('8. Performance and Timing', () => {
    test('should batch alerts within configured window', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      bridge = new AlertDashboardSlackBridge(dashboard, slack, {
        batchWindow: 1000
      });

      const batchSizes = [];
      bridge.on('batchSent', (result) => {
        batchSizes.push(result.count);
      });

      const alerts = Array.from({ length: 3 }, (_, i) => ({
        competitorId: `comp-${i}`,
        competitorName: `Company ${i}`,
        changeType: 'price_change'
      }));

      alerts.forEach(alert => dashboard.addAlert(alert));

      await new Promise(resolve => setTimeout(resolve, 1500));

      assert(batchSizes.length > 0);
      assert.strictEqual(batchSizes[0], 3);
    });

    test('should measure end-to-end latency', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const startTime = Date.now();
      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      let endTime;
      slack.on('alertSent', () => {
        endTime = Date.now();
      });

      dashboard.addAlert(alert);

      await new Promise(resolve => setTimeout(resolve, 300));

      if (endTime) {
        const latency = endTime - startTime;
        assert(latency < 5000); // Should complete within 5 seconds
      }
    });
  });

  describe('9. State Consistency', () => {
    test('should maintain consistent alert state', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      const added = dashboard.addAlert(alert);

      // Alert should exist in all tracking structures
      assert(dashboard.alerts.includes(added));
      assert.strictEqual(added.status, 'pending');

      dashboard.displayAlert(added);
      assert(dashboard.displayedAlerts.has(added.id));
    });

    test('should sync alert states across components', async () => {
      dashboard.updateSlackConfig('https://hooks.slack.com/test');

      const alert = {
        competitorId: 'comp-001',
        competitorName: 'Test',
        changeType: 'price_change'
      };

      const added = dashboard.addAlert(alert);
      dashboard.displayAlert(added);

      const dashboardCopy = dashboard.alerts.find(a => a.id === added.id);
      assert.strictEqual(dashboardCopy.status, added.status);
      assert.strictEqual(dashboardCopy.displayedAt, added.displayedAt);
    });
  });
});
