/**
 * Wave 15: Slack + Proxy Intelligence Integration Tests
 *
 * Comprehensive integration testing for Slack alert enrichment with
 * proxy intelligence data. Tests inclusion of proxy details in Slack
 * notifications and multi-partner Slack routing.
 *
 * Scenarios Covered:
 * - Slack alerts include proxy partner name
 * - Slack alerts include latency and geolocation data
 * - Slack alerts show retry counts and cost
 * - Multi-channel routing based on proxy partner cost
 * - Premium vs budget monitoring channels
 * - Proxy health status in Slack notifications
 * - Cost estimation in alert messages
 *
 * Tests: 15+ scenarios
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('events');

class MockProxyIntelligence extends EventEmitter {
  constructor(options = {}) {
    super();
    this.partnerDatabase = new Map();
    this.geolocationData = new Map();
    this.costModel = options.costModel || {};
  }

  registerPartner(partnerId, config) {
    this.partnerDatabase.set(partnerId, {
      name: config.name,
      tier: config.tier, // 'premium', 'standard', 'budget'
      costPerRequest: config.costPerRequest,
      geoLocations: config.geoLocations || ['US', 'EU'],
      supportedCountries: config.supportedCountries || [],
      avgLatency: config.avgLatency || 200
    });
  }

  enrichAlertWithProxyData(alert, partnerId) {
    const partner = this.partnerDatabase.get(partnerId);

    if (!partner) {
      return alert;
    }

    return {
      ...alert,
      proxyData: {
        partnerName: partner.name,
        tier: partner.tier,
        latency: partner.avgLatency,
        costPerRequest: partner.costPerRequest,
        geoLocations: partner.geoLocations,
        estimatedCost: partner.costPerRequest * (alert.requestCount || 1),
        retryCount: alert.retryCount || 0
      }
    };
  }

  formatSlackMessage(enrichedAlert) {
    const { proxyData, changeType, competitorName } = enrichedAlert;

    let message = `*${competitorName}* - ${changeType}`;

    if (proxyData) {
      message += `\n📡 Proxy: ${proxyData.partnerName} (${proxyData.tier})`;
      message += `\n⏱️ Latency: ${proxyData.latency}ms`;
      message += `\n💰 Cost: $${proxyData.estimatedCost.toFixed(4)}`;

      if (proxyData.retryCount > 0) {
        message += `\n🔄 Retries: ${proxyData.retryCount}`;
      }

      if (proxyData.geoLocations && proxyData.geoLocations.length > 0) {
        message += `\n🌍 ${proxyData.geoLocations.join(', ')}`;
      }
    }

    return message;
  }
}

class MockSlackRouterWithProxies extends EventEmitter {
  constructor(options = {}) {
    super();
    this.webhooks = new Map(); // channelId -> webhookUrl
    this.routingRules = [];
    this.messageLog = [];
    this.costThresholds = options.costThresholds || {
      premium: 0.05,
      standard: 0.025,
      budget: 0.01
    };
  }

  addWebhook(channelId, webhookUrl) {
    this.webhooks.set(channelId, webhookUrl);
  }

  addRoutingRule(rule) {
    this.routingRules.push({
      id: `rule-${this.routingRules.length}`,
      ...rule
    });
  }

  selectChannelForAlert(alert) {
    // Route based on proxy tier or cost
    if (alert.proxyData) {
      const tier = alert.proxyData.tier;

      if (tier === 'premium') {
        return 'premium-monitoring';
      } else if (tier === 'standard') {
        return 'standard-monitoring';
      } else if (tier === 'budget') {
        return 'budget-monitoring';
      }
    }

    // Check for cost-based routing
    const cost = alert.proxyData?.estimatedCost || 0;
    if (cost > 0.05) {
      return 'premium-monitoring';
    } else if (cost > 0.025) {
      return 'standard-monitoring';
    } else {
      return 'budget-monitoring';
    }
  }

  async sendAlert(alert) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const channel = this.selectChannelForAlert(alert);
        const webhookUrl = this.webhooks.get(channel);

        if (!webhookUrl) {
          resolve({
            success: false,
            error: `No webhook configured for ${channel}`
          });
          return;
        }

        const message = {
          id: `msg-${Date.now()}`,
          channel,
          timestamp: Date.now(),
          alertId: alert.id,
          success: true
        };

        this.messageLog.push(message);
        this.emit('alertSent', message);

        resolve(message);
      }, 50);
    });
  }

  getMessageLog() {
    return this.messageLog;
  }

  getMessagesByChannel(channel) {
    return this.messageLog.filter(m => m.channel === channel);
  }

  getMessagesByPartner(partnerName) {
    return this.messageLog.filter(m => {
      // Filter based on what was in the alert that created the message
      return m.partnerName === partnerName;
    });
  }
}

class ProxyAwareSlackIntegration extends EventEmitter {
  constructor(proxyIntel, slackRouter, options = {}) {
    super();
    this.proxyIntel = proxyIntel;
    this.slackRouter = slackRouter;
    this.options = options;
    this.alertHistory = [];
    this.enrichmentStats = {
      alertsEnriched: 0,
      partnersCovered: new Set(),
      totalCostTracked: 0
    };
  }

  async sendAlertWithProxyData(alert, partnerId) {
    // Enrich with proxy data
    const enrichedAlert = this.proxyIntel.enrichAlertWithProxyData(alert, partnerId);

    // Format for Slack
    const slackMessage = this.proxyIntel.formatSlackMessage(enrichedAlert);

    // Route to appropriate channel
    const result = await this.slackRouter.sendAlert(enrichedAlert);

    this.alertHistory.push({
      originalAlert: alert,
      enrichedAlert,
      result,
      sentAt: Date.now()
    });

    // Update stats
    this.enrichmentStats.alertsEnriched++;
    this.enrichmentStats.partnersCovered.add(partnerId);
    if (enrichedAlert.proxyData) {
      this.enrichmentStats.totalCostTracked += enrichedAlert.proxyData.estimatedCost;
    }

    this.emit('alertProcessed', {
      alertId: alert.id,
      partnerName: enrichedAlert.proxyData?.partnerName,
      channel: result.channel,
      cost: enrichedAlert.proxyData?.estimatedCost
    });

    return result;
  }

  getEnrichmentStats() {
    return {
      alertsEnriched: this.enrichmentStats.alertsEnriched,
      partnersUsed: Array.from(this.enrichmentStats.partnersCovered),
      totalCost: this.enrichmentStats.totalCostTracked
    };
  }
}

describe('Wave 15 - Slack + Proxy Intelligence Integration Tests', () => {
  let proxyIntel;
  let slackRouter;
  let slackIntegration;

  beforeEach(() => {
    proxyIntel = new MockProxyIntelligence();
    slackRouter = new MockSlackRouterWithProxies();
    slackIntegration = new ProxyAwareSlackIntegration(proxyIntel, slackRouter);

    // Register proxy partners
    proxyIntel.registerPartner('partner-residential-a', {
      name: 'Residential Partner A',
      tier: 'premium',
      costPerRequest: 0.02,
      geoLocations: ['US', 'EU'],
      avgLatency: 250
    });

    proxyIntel.registerPartner('partner-datacenter-b', {
      name: 'Datacenter Partner B',
      tier: 'budget',
      costPerRequest: 0.005,
      geoLocations: ['US'],
      avgLatency: 100
    });

    proxyIntel.registerPartner('partner-rotating-c', {
      name: 'Rotating Partner C',
      tier: 'standard',
      costPerRequest: 0.01,
      geoLocations: ['US', 'EU', 'APAC'],
      avgLatency: 150
    });

    // Setup Slack webhooks
    slackRouter.addWebhook('premium-monitoring', 'https://hooks.slack.com/premium');
    slackRouter.addWebhook('standard-monitoring', 'https://hooks.slack.com/standard');
    slackRouter.addWebhook('budget-monitoring', 'https://hooks.slack.com/budget');
  });

  describe('1. Slack Alerts with Proxy Information', () => {
    test('should include proxy partner name in alert', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change'
      };

      const enriched = proxyIntel.enrichAlertWithProxyData(alert, 'partner-residential-a');

      assert(enriched.proxyData);
      assert.strictEqual(enriched.proxyData.partnerName, 'Residential Partner A');
    });

    test('should include latency data in alert', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change'
      };

      const enriched = proxyIntel.enrichAlertWithProxyData(alert, 'partner-residential-a');

      assert(enriched.proxyData.latency === 250);
    });

    test('should include geolocation data in alert', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'TechCorp',
        changeType: 'technology_update'
      };

      const enriched = proxyIntel.enrichAlertWithProxyData(alert, 'partner-rotating-c');

      assert(Array.isArray(enriched.proxyData.geoLocations));
      assert(enriched.proxyData.geoLocations.includes('APAC'));
    });

    test('should calculate and show estimated cost', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Shop Inc',
        changeType: 'feature_added',
        requestCount: 5
      };

      const enriched = proxyIntel.enrichAlertWithProxyData(alert, 'partner-residential-a');

      // 0.02 * 5 = 0.1
      assert.strictEqual(enriched.proxyData.estimatedCost, 0.1);
    });

    test('should include retry count in alert', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Shop Inc',
        changeType: 'feature_added',
        retryCount: 3
      };

      const enriched = proxyIntel.enrichAlertWithProxyData(alert, 'partner-datacenter-b');

      assert.strictEqual(enriched.proxyData.retryCount, 3);
    });
  });

  describe('2. Slack Message Formatting', () => {
    test('should format alert message with proxy data', () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change',
        proxyData: {
          partnerName: 'Residential Partner A',
          tier: 'premium',
          latency: 250,
          estimatedCost: 0.02,
          retryCount: 0,
          geoLocations: ['US']
        }
      };

      const message = proxyIntel.formatSlackMessage(alert);

      assert(message.includes('Acme Corp'));
      assert(message.includes('Residential Partner A'));
      assert(message.includes('250ms'));
      assert(message.includes('$0.02'));
    });

    test('should include retry count in formatted message', () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Test Corp',
        changeType: 'feature_added',
        proxyData: {
          partnerName: 'Datacenter Partner B',
          tier: 'budget',
          latency: 100,
          estimatedCost: 0.005,
          retryCount: 2,
          geoLocations: []
        }
      };

      const message = proxyIntel.formatSlackMessage(alert);

      assert(message.includes('Retries: 2'));
    });

    test('should include geolocation in formatted message', () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Global Corp',
        changeType: 'technology_update',
        proxyData: {
          partnerName: 'Rotating Partner C',
          tier: 'standard',
          latency: 150,
          estimatedCost: 0.01,
          retryCount: 0,
          geoLocations: ['US', 'EU', 'APAC']
        }
      };

      const message = proxyIntel.formatSlackMessage(alert);

      assert(message.includes('US, EU, APAC'));
    });
  });

  describe('3. Multi-Partner Slack Routing', () => {
    test('should route premium partner alerts to premium channel', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change',
        proxyData: {
          partnerName: 'Residential Partner A',
          tier: 'premium',
          estimatedCost: 0.02
        }
      };

      const channel = slackRouter.selectChannelForAlert(alert);
      assert.strictEqual(channel, 'premium-monitoring');
    });

    test('should route budget partner alerts to budget channel', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Shop Inc',
        changeType: 'feature_added',
        proxyData: {
          partnerName: 'Datacenter Partner B',
          tier: 'budget',
          estimatedCost: 0.005
        }
      };

      const channel = slackRouter.selectChannelForAlert(alert);
      assert.strictEqual(channel, 'budget-monitoring');
    });

    test('should route standard partner alerts to standard channel', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'TechCorp',
        changeType: 'technology_update',
        proxyData: {
          partnerName: 'Rotating Partner C',
          tier: 'standard',
          estimatedCost: 0.01
        }
      };

      const channel = slackRouter.selectChannelForAlert(alert);
      assert.strictEqual(channel, 'standard-monitoring');
    });

    test('should route based on cost thresholds', async () => {
      const expensiveAlert = {
        id: 'alert-001',
        changeType: 'price_change',
        proxyData: { estimatedCost: 0.08 }
      };

      const cheapAlert = {
        id: 'alert-002',
        changeType: 'feature_added',
        proxyData: { estimatedCost: 0.003 }
      };

      assert.strictEqual(slackRouter.selectChannelForAlert(expensiveAlert), 'premium-monitoring');
      assert.strictEqual(slackRouter.selectChannelForAlert(cheapAlert), 'budget-monitoring');
    });
  });

  describe('4. End-to-End Slack + Proxy Integration', () => {
    test('should send enriched alert through integration', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change'
      };

      const result = await slackIntegration.sendAlertWithProxyData(alert, 'partner-residential-a');

      assert(result.success);
      assert.strictEqual(result.channel, 'premium-monitoring');
    });

    test('should track enriched alerts', async () => {
      const alert1 = {
        id: 'alert-001',
        competitorName: 'Acme Corp',
        changeType: 'price_change'
      };

      const alert2 = {
        id: 'alert-002',
        competitorName: 'Shop Inc',
        changeType: 'feature_added'
      };

      await slackIntegration.sendAlertWithProxyData(alert1, 'partner-residential-a');
      await slackIntegration.sendAlertWithProxyData(alert2, 'partner-datacenter-b');

      const stats = slackIntegration.getEnrichmentStats();

      assert.strictEqual(stats.alertsEnriched, 2);
      assert(stats.partnersUsed.includes('partner-residential-a'));
      assert(stats.partnersUsed.includes('partner-datacenter-b'));
    });

    test('should accumulate costs from enriched alerts', async () => {
      const alerts = [
        { id: 'alert-001', competitorName: 'Acme', changeType: 'price', requestCount: 2 },
        { id: 'alert-002', competitorName: 'Shop', changeType: 'feature', requestCount: 1 },
        { id: 'alert-003', competitorName: 'Tech', changeType: 'tech', requestCount: 3 }
      ];

      await slackIntegration.sendAlertWithProxyData(alerts[0], 'partner-residential-a'); // 0.02 * 2
      await slackIntegration.sendAlertWithProxyData(alerts[1], 'partner-rotating-c'); // 0.01 * 1
      await slackIntegration.sendAlertWithProxyData(alerts[2], 'partner-datacenter-b'); // 0.005 * 3

      const stats = slackIntegration.getEnrichmentStats();

      // 0.04 + 0.01 + 0.015 = 0.065
      assert(Math.abs(stats.totalCost - 0.065) < 0.001);
    });
  });

  describe('5. Cost-Based Channel Routing', () => {
    test('should send high-cost monitors to premium channel', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Enterprise Corp',
        changeType: 'security_update'
      };

      await slackIntegration.sendAlertWithProxyData(alert, 'partner-residential-a');

      const messages = slackRouter.getMessagesByChannel('premium-monitoring');
      assert(messages.length > 0);
    });

    test('should send low-cost monitors to budget channel', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Budget Monitor',
        changeType: 'minor_change'
      };

      await slackIntegration.sendAlertWithProxyData(alert, 'partner-datacenter-b');

      const messages = slackRouter.getMessagesByChannel('budget-monitoring');
      assert(messages.length > 0);
    });

    test('should segregate alerts by channel appropriately', async () => {
      const alerts = [
        { id: 'alert-001', competitorName: 'Premium', changeType: 'type1' },
        { id: 'alert-002', competitorName: 'Standard', changeType: 'type2' },
        { id: 'alert-003', competitorName: 'Budget', changeType: 'type3' }
      ];

      await slackIntegration.sendAlertWithProxyData(alerts[0], 'partner-residential-a');
      await slackIntegration.sendAlertWithProxyData(alerts[1], 'partner-rotating-c');
      await slackIntegration.sendAlertWithProxyData(alerts[2], 'partner-datacenter-b');

      const premiumMsgs = slackRouter.getMessagesByChannel('premium-monitoring');
      const standardMsgs = slackRouter.getMessagesByChannel('standard-monitoring');
      const budgetMsgs = slackRouter.getMessagesByChannel('budget-monitoring');

      assert.strictEqual(premiumMsgs.length, 1);
      assert.strictEqual(standardMsgs.length, 1);
      assert.strictEqual(budgetMsgs.length, 1);
    });
  });

  describe('6. Proxy Partner Coverage', () => {
    test('should track which partners are used', async () => {
      const alerts = [
        { id: 'alert-001', competitorName: 'Corp A', changeType: 'type1' },
        { id: 'alert-002', competitorName: 'Corp B', changeType: 'type2' },
        { id: 'alert-003', competitorName: 'Corp C', changeType: 'type3' }
      ];

      await slackIntegration.sendAlertWithProxyData(alerts[0], 'partner-residential-a');
      await slackIntegration.sendAlertWithProxyData(alerts[1], 'partner-residential-a');
      await slackIntegration.sendAlertWithProxyData(alerts[2], 'partner-rotating-c');

      const stats = slackIntegration.getEnrichmentStats();

      assert.strictEqual(stats.partnersUsed.length, 2);
      assert(stats.partnersUsed.includes('partner-residential-a'));
      assert(stats.partnersUsed.includes('partner-rotating-c'));
    });

    test('should show proxy diversity across alerts', async () => {
      const partners = [
        'partner-residential-a',
        'partner-datacenter-b',
        'partner-rotating-c'
      ];

      const alerts = Array.from({ length: 9 }, (_, i) => ({
        id: `alert-${i}`,
        competitorName: `Corp ${i}`,
        changeType: 'change'
      }));

      // Distribute alerts across partners
      for (let i = 0; i < alerts.length; i++) {
        const partner = partners[i % 3];
        await slackIntegration.sendAlertWithProxyData(alerts[i], partner);
      }

      const stats = slackIntegration.getEnrichmentStats();

      assert.strictEqual(stats.partnersUsed.length, 3);
      assert.strictEqual(stats.alertsEnriched, 9);
    });
  });

  describe('7. Error Handling with Proxies', () => {
    test('should handle missing proxy partner gracefully', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Test Corp',
        changeType: 'price_change'
      };

      const enriched = proxyIntel.enrichAlertWithProxyData(alert, 'nonexistent-partner');

      // Should return original alert if partner not found
      assert.strictEqual(enriched.id, alert.id);
    });

    test('should handle alerts without proxy data', async () => {
      const alert = {
        id: 'alert-001',
        competitorName: 'Test Corp',
        changeType: 'price_change'
      };

      const message = proxyIntel.formatSlackMessage(alert);

      assert(message.includes('Test Corp'));
      assert(message.includes('price_change'));
    });
  });

  describe('8. Performance Metrics', () => {
    test('should process multiple alerts with proxy data', async () => {
      const alerts = Array.from({ length: 10 }, (_, i) => ({
        id: `alert-${i}`,
        competitorName: `Corp ${i}`,
        changeType: 'price_change'
      }));

      const startTime = Date.now();

      for (const alert of alerts) {
        await slackIntegration.sendAlertWithProxyData(alert, 'partner-residential-a');
      }

      const elapsed = Date.now() - startTime;

      assert(elapsed < 5000); // Should complete in reasonable time
    });

    test('should maintain cost tracking accuracy', async () => {
      const alerts = [
        { id: 'a1', competitorName: 'Corp1', changeType: 'type1', requestCount: 3 },
        { id: 'a2', competitorName: 'Corp2', changeType: 'type2', requestCount: 2 },
        { id: 'a3', competitorName: 'Corp3', changeType: 'type3', requestCount: 5 }
      ];

      // Same partner - costs should add
      for (const alert of alerts) {
        await slackIntegration.sendAlertWithProxyData(alert, 'partner-datacenter-b');
      }

      const stats = slackIntegration.getEnrichmentStats();

      // (3 + 2 + 5) * 0.005 = 0.05
      assert(Math.abs(stats.totalCost - 0.05) < 0.001);
    });
  });
});
