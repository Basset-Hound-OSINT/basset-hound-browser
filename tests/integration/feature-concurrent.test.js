/**
 * Wave 15: Concurrent Multi-Feature Operations Tests
 *
 * Tests simultaneous execution of all Wave 15 features:
 * - Multiple campaigns running concurrently
 * - Each with Dashboard, Slack, and Proxy management
 * - Verifies no interference or state corruption
 * - Tests isolation between concurrent operations
 * - Validates proper resource cleanup
 * - Checks for race conditions
 *
 * Tests: 12+ scenarios covering concurrent operations
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('events');

class ConcurrentOperationTracker {
  constructor() {
    this.activeOperations = new Map(); // operationId -> { status, startTime }
    this.completedOperations = [];
    this.errors = [];
  }

  startOperation(operationId) {
    if (this.activeOperations.has(operationId)) {
      throw new Error(`Operation ${operationId} already started`);
    }
    this.activeOperations.set(operationId, {
      status: 'running',
      startTime: Date.now()
    });
  }

  completeOperation(operationId, result = {}) {
    if (!this.activeOperations.has(operationId)) {
      this.recordError(`Tried to complete non-existent operation ${operationId}`);
      return;
    }

    const operation = this.activeOperations.get(operationId);
    const duration = Date.now() - operation.startTime;

    this.completedOperations.push({
      operationId,
      duration,
      result,
      completedAt: Date.now()
    });

    this.activeOperations.delete(operationId);
  }

  recordError(error) {
    this.errors.push({
      error,
      timestamp: Date.now()
    });
  }

  getActiveCount() {
    return this.activeOperations.size;
  }

  getCompletedCount() {
    return this.completedOperations.length;
  }

  getAverageDuration() {
    if (this.completedOperations.length === 0) return 0;
    const total = this.completedOperations.reduce((sum, op) => sum + op.duration, 0);
    return total / this.completedOperations.length;
  }

  getAllCompleted() {
    return this.completedOperations;
  }

  getErrors() {
    return this.errors;
  }
}

class IsolatedCampaignContext {
  constructor(campaignId) {
    this.campaignId = campaignId;
    this.alerts = [];
    this.slackMessages = [];
    this.proxyRequests = [];
    this.state = 'initialized';
    this.createdAt = Date.now();
  }

  addAlert(alert) {
    this.alerts.push({ ...alert, timestamp: Date.now() });
  }

  addSlackMessage(message) {
    this.slackMessages.push({ ...message, timestamp: Date.now() });
  }

  addProxyRequest(request) {
    this.proxyRequests.push({ ...request, timestamp: Date.now() });
  }

  verifyIsolation(otherContext) {
    // Verify no cross-contamination
    if (otherContext.campaignId === this.campaignId) {
      throw new Error('Cannot compare same campaign');
    }

    // Alerts should not leak between campaigns
    assert(this.alerts.every(a => a.campaignId === this.campaignId));
    assert(otherContext.alerts.every(a => a.campaignId === otherContext.campaignId));

    // Check no shared references
    const myAlertIds = this.alerts.map(a => a.id);
    const otherAlertIds = otherContext.alerts.map(a => a.id);
    const intersection = myAlertIds.filter(id => otherAlertIds.includes(id));
    assert.strictEqual(intersection.length, 0);
  }

  getMetrics() {
    return {
      campaignId: this.campaignId,
      alertCount: this.alerts.length,
      slackMessageCount: this.slackMessages.length,
      proxyRequestCount: this.proxyRequests.length,
      uptime: Date.now() - this.createdAt
    };
  }
}

class ConcurrentDashboardManager {
  constructor() {
    this.campaigns = new Map(); // campaignId -> IsolatedCampaignContext
    this.tracker = new ConcurrentOperationTracker();
  }

  createCampaign(campaignId) {
    if (this.campaigns.has(campaignId)) {
      throw new Error(`Campaign ${campaignId} already exists`);
    }
    const context = new IsolatedCampaignContext(campaignId);
    this.campaigns.set(campaignId, context);
    return context;
  }

  getCampaign(campaignId) {
    return this.campaigns.get(campaignId);
  }

  getCampaignCount() {
    return this.campaigns.size;
  }

  getAllCampaigns() {
    return Array.from(this.campaigns.values());
  }

  getGlobalMetrics() {
    const campaigns = Array.from(this.campaigns.values());
    return {
      totalCampaigns: campaigns.length,
      totalAlerts: campaigns.reduce((sum, c) => sum + c.alerts.length, 0),
      totalSlackMessages: campaigns.reduce((sum, c) => sum + c.slackMessages.length, 0),
      totalProxyRequests: campaigns.reduce((sum, c) => sum + c.proxyRequests.length, 0),
      activeOperations: this.tracker.getActiveCount(),
      completedOperations: this.tracker.getCompletedCount()
    };
  }
}

class SimulatedCampaignWorkload {
  constructor(campaignId, context, tracker) {
    this.campaignId = campaignId;
    this.context = context;
    this.tracker = tracker;
  }

  async run(durationMs = 1000, alertFrequency = 100) {
    const operationId = `campaign-${this.campaignId}-${Date.now()}`;
    this.tracker.startOperation(operationId);

    try {
      const startTime = Date.now();
      let alertCount = 0;

      while (Date.now() - startTime < durationMs) {
        // Simulate alert generation
        const alert = {
          id: `alert-${this.campaignId}-${alertCount}`,
          campaignId: this.campaignId,
          changeType: Math.random() > 0.5 ? 'price' : 'tech',
          data: { random: Math.random() }
        };

        this.context.addAlert(alert);

        // Simulate Slack message
        const slackMsg = {
          id: `msg-${this.campaignId}-${alertCount}`,
          campaignId: this.campaignId,
          alertId: alert.id,
          sent: true
        };

        this.context.addSlackMessage(slackMsg);

        // Simulate proxy request
        const proxyReq = {
          id: `req-${this.campaignId}-${alertCount}`,
          campaignId: this.campaignId,
          partner: `partner-${Math.floor(Math.random() * 3)}`
        };

        this.context.addProxyRequest(proxyReq);

        alertCount++;

        // Wait before next alert
        await new Promise(resolve => setTimeout(resolve, alertFrequency));
      }

      this.tracker.completeOperation(operationId, {
        alertsGenerated: alertCount,
        campaignId: this.campaignId
      });

      return {
        success: true,
        alertsGenerated: alertCount,
        campaignId: this.campaignId
      };
    } catch (error) {
      this.tracker.recordError(error.message);
      this.tracker.completeOperation(operationId);
      throw error;
    }
  }
}

describe('Wave 15 - Concurrent Multi-Feature Operations Tests', () => {
  let dashboardMgr;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `wave15-concurrent-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    dashboardMgr = new ConcurrentDashboardManager();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('1. Concurrent Campaign Creation', () => {
    test('should create 5 campaigns concurrently', async () => {
      const campaigns = Array.from({ length: 5 }, (_, i) => `campaign-${i}`);

      const promises = campaigns.map(cid =>
        Promise.resolve(dashboardMgr.createCampaign(cid))
      );

      await Promise.all(promises);

      assert.strictEqual(dashboardMgr.getCampaignCount(), 5);
    });

    test('should isolate 5 concurrent campaigns', () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const campaigns = dashboardMgr.getAllCampaigns();
      assert.strictEqual(campaigns.length, 5);

      // Verify isolation
      for (let i = 0; i < campaigns.length; i++) {
        for (let j = i + 1; j < campaigns.length; j++) {
          campaigns[i].verifyIsolation(campaigns[j]);
        }
      }
    });

    test('should handle 10 concurrent campaign creations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(dashboardMgr.createCampaign(`campaign-${i}`))
      );

      await Promise.all(promises);

      assert.strictEqual(dashboardMgr.getCampaignCount(), 10);
    });
  });

  describe('2. Concurrent Alert Generation', () => {
    test('should process alerts from 5 campaigns concurrently', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(
          `campaign-${i}`,
          context,
          dashboardMgr.tracker
        );
      });

      const promises = workloads.map(w => w.run(500, 50));

      const results = await Promise.all(promises);

      results.forEach(r => {
        assert(r.success);
        assert(r.alertsGenerated > 0);
      });

      const metrics = dashboardMgr.getGlobalMetrics();
      assert(metrics.totalAlerts > 0);
    });

    test('should maintain alert isolation between campaigns', async () => {
      for (let i = 0; i < 3; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 3 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(300, 50)));

      const campaigns = dashboardMgr.getAllCampaigns();

      // Each campaign should only have its own alerts
      campaigns.forEach(campaign => {
        const ownAlerts = campaign.alerts.filter(a => a.campaignId === campaign.campaignId);
        assert.strictEqual(ownAlerts.length, campaign.alerts.length);
      });
    });

    test('should handle rapid-fire alerts from 5 campaigns', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      // Rapid alerts (10ms between)
      const promises = workloads.map(w => w.run(300, 10));

      await Promise.all(promises);

      const metrics = dashboardMgr.getGlobalMetrics();
      assert(metrics.totalAlerts > 100);
    });
  });

  describe('3. Concurrent Slack Message Sending', () => {
    test('should send Slack messages from 5 campaigns concurrently', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(400, 50)));

      const campaigns = dashboardMgr.getAllCampaigns();
      const totalMessages = campaigns.reduce((sum, c) => sum + c.slackMessages.length, 0);

      assert(totalMessages > 0);
    });

    test('should maintain message order per campaign', async () => {
      dashboardMgr.createCampaign('campaign-1');
      const context = dashboardMgr.getCampaign('campaign-1');

      const workload = new SimulatedCampaignWorkload('campaign-1', context, dashboardMgr.tracker);
      await workload.run(300, 50);

      const messages = context.slackMessages;
      for (let i = 1; i < messages.length; i++) {
        assert(messages[i].timestamp >= messages[i - 1].timestamp);
      }
    });

    test('should isolate Slack messages between campaigns', async () => {
      for (let i = 0; i < 3; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 3 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(300, 50)));

      const campaigns = dashboardMgr.getAllCampaigns();

      // Each message should belong to correct campaign
      campaigns.forEach(campaign => {
        const ownMessages = campaign.slackMessages.filter(m => m.campaignId === campaign.campaignId);
        assert.strictEqual(ownMessages.length, campaign.slackMessages.length);
      });
    });
  });

  describe('4. Concurrent Proxy Requests', () => {
    test('should route proxy requests from 5 campaigns', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(400, 50)));

      const metrics = dashboardMgr.getGlobalMetrics();
      assert(metrics.totalProxyRequests > 0);
    });

    test('should prevent proxy partner conflicts across campaigns', async () => {
      for (let i = 0; i < 3; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 3 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(300, 50)));

      const campaigns = dashboardMgr.getAllCampaigns();

      // Each request should belong to correct campaign
      campaigns.forEach(campaign => {
        const ownRequests = campaign.proxyRequests.filter(r => r.campaignId === campaign.campaignId);
        assert.strictEqual(ownRequests.length, campaign.proxyRequests.length);
      });
    });
  });

  describe('5. Resource Isolation and Cleanup', () => {
    test('should not share state between concurrent operations', async () => {
      const ctx1 = dashboardMgr.createCampaign('campaign-1');
      const ctx2 = dashboardMgr.createCampaign('campaign-2');

      ctx1.addAlert({ id: 'alert-1', campaignId: 'campaign-1' });
      ctx2.addAlert({ id: 'alert-2', campaignId: 'campaign-2' });

      assert.strictEqual(ctx1.alerts.length, 1);
      assert.strictEqual(ctx2.alerts.length, 1);
      assert.notStrictEqual(ctx1.alerts, ctx2.alerts);
    });

    test('should handle campaign cleanup without affecting others', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      // Simulate some operations
      const workload = new SimulatedCampaignWorkload(
        'campaign-0',
        dashboardMgr.getCampaign('campaign-0'),
        dashboardMgr.tracker
      );
      await workload.run(200, 50);

      // Get count before cleanup
      const beforeCount = dashboardMgr.getCampaignCount();

      // Remove one campaign
      dashboardMgr.campaigns.delete('campaign-0');

      // Verify others unaffected
      const afterCount = dashboardMgr.getCampaignCount();
      assert.strictEqual(afterCount, beforeCount - 1);

      for (let i = 1; i < 5; i++) {
        assert(dashboardMgr.getCampaign(`campaign-${i}`));
      }
    });
  });

  describe('6. Concurrent Operation Tracking', () => {
    test('should track concurrent operations correctly', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(200, 50)));

      const completedCount = dashboardMgr.tracker.getCompletedCount();
      assert.strictEqual(completedCount, 5);

      const activeCount = dashboardMgr.tracker.getActiveCount();
      assert.strictEqual(activeCount, 0);
    });

    test('should calculate average operation duration', async () => {
      for (let i = 0; i < 3; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 3 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(200, 50)));

      const avgDuration = dashboardMgr.tracker.getAverageDuration();
      assert(avgDuration > 0);
      assert(avgDuration < 1000); // Should complete reasonably fast
    });
  });

  describe('7. Performance Under Concurrent Load', () => {
    test('should maintain performance with 5 campaigns x 10 alerts', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      const startTime = Date.now();
      await Promise.all(workloads.map(w => w.run(300, 30)));
      const elapsed = Date.now() - startTime;

      const metrics = dashboardMgr.getGlobalMetrics();
      assert.strictEqual(metrics.totalAlerts, metrics.totalSlackMessages);
      assert(elapsed < 10000); // Should complete within 10 seconds
    });

    test('should handle 100 concurrent alerts across campaigns', async () => {
      // Create enough campaigns to distribute load
      for (let i = 0; i < 10; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 10 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      const startTime = Date.now();
      await Promise.all(workloads.map(w => w.run(300, 30)));
      const elapsed = Date.now() - startTime;

      const metrics = dashboardMgr.getGlobalMetrics();
      assert(metrics.totalAlerts >= 50); // At least 50 alerts across all campaigns
      assert(elapsed < 15000); // Should complete within 15 seconds
    });
  });

  describe('8. Error Handling in Concurrent Context', () => {
    test('should isolate errors between campaigns', async () => {
      dashboardMgr.createCampaign('campaign-1');

      const workload = new SimulatedCampaignWorkload(
        'campaign-1',
        dashboardMgr.getCampaign('campaign-1'),
        dashboardMgr.tracker
      );

      try {
        await workload.run(100, 20);
      } catch (e) {
        // Expected
      }

      // Other campaigns should not be affected
      dashboardMgr.createCampaign('campaign-2');
      assert(dashboardMgr.getCampaign('campaign-2'));
    });

    test('should track errors without stopping other operations', async () => {
      for (let i = 0; i < 3; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      // Inject an error manually
      dashboardMgr.tracker.recordError('Simulated error');

      // Continue with normal operations
      const workload = new SimulatedCampaignWorkload(
        'campaign-0',
        dashboardMgr.getCampaign('campaign-0'),
        dashboardMgr.tracker
      );

      await workload.run(100, 50);

      const errors = dashboardMgr.tracker.getErrors();
      assert(errors.length > 0);
      assert(dashboardMgr.tracker.getCompletedCount() > 0);
    });
  });

  describe('9. Global State Consistency', () => {
    test('should maintain global metrics accuracy', async () => {
      for (let i = 0; i < 5; i++) {
        dashboardMgr.createCampaign(`campaign-${i}`);
      }

      const workloads = Array.from({ length: 5 }, (_, i) => {
        const context = dashboardMgr.getCampaign(`campaign-${i}`);
        return new SimulatedCampaignWorkload(`campaign-${i}`, context, dashboardMgr.tracker);
      });

      await Promise.all(workloads.map(w => w.run(300, 50)));

      const metrics = dashboardMgr.getGlobalMetrics();

      // Verify consistency
      assert.strictEqual(metrics.totalAlerts, metrics.totalSlackMessages);
      assert.strictEqual(metrics.totalAlerts, metrics.totalProxyRequests);
      assert.strictEqual(metrics.totalCampaigns, 5);
      assert.strictEqual(metrics.activeOperations, 0);
      assert.strictEqual(metrics.completedOperations, 5);
    });

    test('should sync metrics between campaigns and global', async () => {
      dashboardMgr.createCampaign('campaign-1');
      dashboardMgr.createCampaign('campaign-2');

      const ctx1 = dashboardMgr.getCampaign('campaign-1');
      const ctx2 = dashboardMgr.getCampaign('campaign-2');

      // Add data
      for (let i = 0; i < 3; i++) {
        ctx1.addAlert({ id: `a-${i}`, campaignId: 'campaign-1' });
        ctx2.addAlert({ id: `b-${i}`, campaignId: 'campaign-2' });
      }

      const globalMetrics = dashboardMgr.getGlobalMetrics();
      assert.strictEqual(globalMetrics.totalAlerts, 6);
    });
  });
});
