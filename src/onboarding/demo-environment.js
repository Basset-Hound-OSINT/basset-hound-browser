/**
 * Interactive Demo Environment
 *
 * Provides a sandboxed demo account with sample data for safe learning
 * and testing without affecting real monitoring operations.
 */

const EventEmitter = require('events');

class DemoEnvironment extends EventEmitter {
  constructor(options = {}) {
    super();
    this.demoUserId = options.demoUserId || `demo-${Date.now()}`;
    this.demoAccounts = new Map();
    this.demoMonitors = new Map();
    this.demoData = new Map();
    this.demoAlerts = [];
    this.readOnly = options.readOnly !== false;
    this.sessionStartTime = Date.now();
    this.dataRefreshInterval = options.dataRefreshInterval || 5000; // 5 seconds
    this.refreshTimer = null;
  }

  /**
   * Create demo account
   */
  async createDemoAccount(accountConfig = {}) {
    const accountId = `demo-account-${Date.now()}`;

    const account = {
      id: accountId,
      name: accountConfig.name || 'Demo Account',
      email: accountConfig.email || `demo-${Date.now()}@example.com`,
      createdAt: new Date().toISOString(),
      status: 'active',
      monitors: [],
      alerts: [],
      settings: {
        timezone: accountConfig.timezone || 'America/New_York',
        language: accountConfig.language || 'en',
        theme: accountConfig.theme || 'light',
        notificationPreferences: {
          slack: accountConfig.slackEnabled || false,
          email: accountConfig.emailEnabled || true,
          inApp: true
        }
      },
      readOnly: this.readOnly
    };

    this.demoAccounts.set(accountId, account);
    this.emit('account-created', { accountId, account });

    // Populate with sample data
    await this.populateSampleData(accountId);

    return { success: true, account };
  }

  /**
   * Populate demo account with sample data
   */
  async populateSampleData(accountId) {
    const sampleMonitors = [
      {
        id: 'demo-monitor-1',
        url: 'https://example.com/products',
        name: 'Example Store - Products',
        category: 'ecommerce',
        frequency: 'hourly',
        detectionType: 'visual',
        enabled: true,
        createdAt: new Date().toISOString(),
        checkResults: this.generateCheckResults(15)
      },
      {
        id: 'demo-monitor-2',
        url: 'https://competitor.example.com/pricing',
        name: 'Competitor Pricing Page',
        category: 'competitor-monitoring',
        frequency: 'daily',
        detectionType: 'text',
        enabled: true,
        createdAt: new Date().toISOString(),
        checkResults: this.generateCheckResults(10)
      },
      {
        id: 'demo-monitor-3',
        url: 'https://news.example.com',
        name: 'News Site',
        category: 'news',
        frequency: '4-hourly',
        detectionType: 'visual',
        enabled: true,
        createdAt: new Date().toISOString(),
        checkResults: this.generateCheckResults(20)
      },
      {
        id: 'demo-monitor-4',
        url: 'https://api.example.com/status',
        name: 'API Status Page',
        category: 'status',
        frequency: 'hourly',
        detectionType: 'text',
        enabled: true,
        createdAt: new Date().toISOString(),
        checkResults: this.generateCheckResults(25)
      },
      {
        id: 'demo-monitor-5',
        url: 'https://blog.example.com',
        name: 'Company Blog',
        category: 'content',
        frequency: 'daily',
        detectionType: 'visual',
        enabled: false,
        createdAt: new Date().toISOString(),
        checkResults: this.generateCheckResults(5)
      }
    ];

    // Store monitors
    for (const monitor of sampleMonitors) {
      this.demoMonitors.set(monitor.id, {
        ...monitor,
        accountId
      });
    }

    // Generate sample alerts
    this.generateSampleAlerts(accountId, sampleMonitors);

    // Generate sample changes
    this.generateSampleChanges(accountId);

    this.emit('sample-data-populated', { accountId, monitorCount: sampleMonitors.length });
  }

  /**
   * Generate sample check results
   */
  generateCheckResults(count) {
    const results = [];
    const now = Date.now();
    const statuses = ['success', 'changed', 'error'];
    const changeTypes = ['price', 'availability', 'content', 'structure'];

    for (let i = 0; i < count; i++) {
      const timestamp = now - i * 3600000; // Hourly intervals
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      results.push({
        timestamp: new Date(timestamp).toISOString(),
        status,
        changeDetected: status === 'changed',
        changeType: status === 'changed' ? changeTypes[Math.floor(Math.random() * changeTypes.length)] : null,
        responseTime: Math.floor(Math.random() * 2000) + 200,
        contentHash: `hash-${Math.random().toString(36).substr(2, 9)}`
      });
    }

    return results;
  }

  /**
   * Generate sample alerts
   */
  generateSampleAlerts(accountId, monitors) {
    const alertTypes = ['price_change', 'stock_change', 'content_change', 'availability_change'];
    const severities = ['low', 'medium', 'high'];

    for (let i = 0; i < 8; i++) {
      const monitor = monitors[Math.floor(Math.random() * monitors.length)];
      const alert = {
        id: `alert-${Date.now()}-${i}`,
        monitorId: monitor.id,
        monitorName: monitor.name,
        type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        message: `Change detected in ${monitor.name}`,
        description: this.generateAlertDescription(),
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        read: Math.random() > 0.5,
        acknowledged: Math.random() > 0.7,
        accountId
      };

      this.demoAlerts.push(alert);
    }
  }

  /**
   * Generate alert description
   */
  generateAlertDescription() {
    const descriptions = [
      'Price has changed from $99.99 to $89.99',
      'Product availability changed to out of stock',
      'New product added to category',
      'Product description updated',
      'Images changed on product page',
      'Price promotion started',
      'Stock count reduced by 50%'
    ];

    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  /**
   * Generate sample changes
   */
  generateSampleChanges(accountId) {
    const changes = [];
    const changeCategories = ['price', 'product', 'content', 'layout', 'availability'];

    for (let i = 0; i < 12; i++) {
      changes.push({
        id: `change-${i}`,
        accountId,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        category: changeCategories[Math.floor(Math.random() * changeCategories.length)],
        title: `Sample Change #${i + 1}`,
        description: 'This is a sample change in the demo environment',
        oldValue: `Old Value ${i}`,
        newValue: `New Value ${i}`,
        impact: Math.floor(Math.random() * 100),
        screenshots: {
          before: `/demo-data/screenshot-${i}-before.png`,
          after: `/demo-data/screenshot-${i}-after.png`
        }
      });
    }

    this.demoData.set(`${accountId}-changes`, changes);
  }

  /**
   * Get demo account
   */
  getDemoAccount(accountId) {
    return this.demoAccounts.get(accountId);
  }

  /**
   * Get demo monitors
   */
  getDemoMonitors(accountId) {
    return Array.from(this.demoMonitors.values()).filter(m => m.accountId === accountId);
  }

  /**
   * Get demo monitor details
   */
  getDemoMonitor(monitorId) {
    return this.demoMonitors.get(monitorId);
  }

  /**
   * Get demo alerts
   */
  getDemoAlerts(accountId, options = {}) {
    let alerts = this.demoAlerts.filter(a => a.accountId === accountId);

    // Apply filters
    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }

    if (options.unreadOnly) {
      alerts = alerts.filter(a => !a.read);
    }

    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Get sample changes
   */
  getSampleChanges(accountId, options = {}) {
    const changes = this.demoData.get(`${accountId}-changes`) || [];

    let filtered = changes;
    if (options.category) {
      filtered = filtered.filter(c => c.category === options.category);
    }

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Mark alert as read
   */
  markAlertAsRead(alertId) {
    const alert = this.demoAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.read = true;
      this.emit('alert-read', { alertId });
      return { success: true };
    }
    return { success: false, reason: 'Alert not found' };
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.demoAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', { alertId });
      return { success: true };
    }
    return { success: false, reason: 'Alert not found' };
  }

  /**
   * Update demo monitor settings
   */
  updateMonitorSettings(monitorId, settings) {
    if (this.readOnly) {
      return { success: false, reason: 'Demo environment is read-only' };
    }

    const monitor = this.demoMonitors.get(monitorId);
    if (!monitor) {
      return { success: false, reason: 'Monitor not found' };
    }

    Object.assign(monitor, settings);
    this.emit('monitor-updated', { monitorId, settings });
    return { success: true, monitor };
  }

  /**
   * Run test check on demo monitor
   */
  async runTestCheck(monitorId) {
    const monitor = this.demoMonitors.get(monitorId);
    if (!monitor) {
      return { success: false, reason: 'Monitor not found' };
    }

    const result = {
      timestamp: new Date().toISOString(),
      status: Math.random() > 0.1 ? 'success' : 'error',
      responseTime: Math.floor(Math.random() * 2000) + 200,
      contentSize: Math.floor(Math.random() * 500000) + 50000,
      htmlHash: `hash-${Math.random().toString(36).substr(2, 9)}`
    };

    if (result.status === 'success' && Math.random() > 0.85) {
      result.changeDetected = true;
      result.changeType = 'price';
      result.changeDescription = 'Price has been updated';
    }

    monitor.lastCheckResult = result;
    this.emit('test-check-complete', { monitorId, result });

    return { success: true, result };
  }

  /**
   * Start auto-refresh of demo data
   */
  startAutoRefresh() {
    if (this.refreshTimer) return;

    this.refreshTimer = setInterval(() => {
      this.refreshDemoData();
    }, this.dataRefreshInterval);

    this.emit('auto-refresh-started');
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      this.emit('auto-refresh-stopped');
    }
  }

  /**
   * Refresh demo data
   */
  refreshDemoData() {
    // Randomly update some monitors with new check results
    const monitorsToUpdate = Array.from(this.demoMonitors.values()).filter(
      () => Math.random() > 0.7
    );

    for (const monitor of monitorsToUpdate) {
      const newResult = {
        timestamp: new Date().toISOString(),
        status: Math.random() > 0.1 ? 'success' : 'error',
        responseTime: Math.floor(Math.random() * 2000) + 200,
        contentHash: `hash-${Math.random().toString(36).substr(2, 9)}`
      };

      if (Math.random() > 0.8) {
        newResult.changeDetected = true;
        newResult.changeType = ['price', 'content', 'availability'][
          Math.floor(Math.random() * 3)
        ];
      }

      monitor.checkResults.unshift(newResult);
      if (monitor.checkResults.length > 100) {
        monitor.checkResults.pop();
      }
    }

    this.emit('demo-data-refreshed', { updatedMonitors: monitorsToUpdate.length });
  }

  /**
   * Get dashboard summary
   */
  getDashboardSummary(accountId) {
    const monitors = this.getDemoMonitors(accountId);
    const alerts = this.getDemoAlerts(accountId);
    const changes = this.getSampleChanges(accountId);

    const summary = {
      accountId,
      totalMonitors: monitors.length,
      activeMonitors: monitors.filter(m => m.enabled).length,
      totalAlerts: alerts.length,
      unresolvedAlerts: alerts.filter(a => !a.acknowledged).length,
      criticalAlerts: alerts.filter(a => a.severity === 'high').length,
      recentChanges: changes.length,
      monitorsByCategory: this.getMonitorsByCategory(monitors),
      alertsByType: this.getAlertsByType(alerts),
      changesByCategory: this.getChangesByCategory(changes),
      systemHealth: {
        uptime: '99.95%',
        lastCheck: new Date(Date.now() - 3600000).toISOString(),
        averageResponseTime: '420ms'
      }
    };

    return summary;
  }

  /**
   * Get monitors by category
   */
  getMonitorsByCategory(monitors) {
    const byCategory = {};
    for (const monitor of monitors) {
      if (!byCategory[monitor.category]) {
        byCategory[monitor.category] = 0;
      }
      byCategory[monitor.category]++;
    }
    return byCategory;
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(alerts) {
    const byType = {};
    for (const alert of alerts) {
      if (!byType[alert.type]) {
        byType[alert.type] = 0;
      }
      byType[alert.type]++;
    }
    return byType;
  }

  /**
   * Get changes by category
   */
  getChangesByCategory(changes) {
    const byCategory = {};
    for (const change of changes) {
      if (!byCategory[change.category]) {
        byCategory[change.category] = 0;
      }
      byCategory[change.category]++;
    }
    return byCategory;
  }

  /**
   * Export demo account data
   */
  exportAccountData(accountId) {
    const account = this.getDemoAccount(accountId);
    if (!account) {
      return null;
    }

    return {
      account,
      monitors: this.getDemoMonitors(accountId),
      alerts: this.getDemoAlerts(accountId),
      changes: this.getSampleChanges(accountId),
      summary: this.getDashboardSummary(accountId),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Delete demo account
   */
  async deleteDemoAccount(accountId) {
    const account = this.demoAccounts.get(accountId);
    if (!account) {
      return { success: false, reason: 'Account not found' };
    }

    // Remove all associated data
    this.demoMonitors.forEach((monitor, id) => {
      if (monitor.accountId === accountId) {
        this.demoMonitors.delete(id);
      }
    });

    this.demoAlerts = this.demoAlerts.filter(a => a.accountId !== accountId);
    this.demoData.delete(`${accountId}-changes`);
    this.demoAccounts.delete(accountId);

    this.emit('account-deleted', { accountId });
    return { success: true };
  }

  /**
   * Get environment statistics
   */
  getEnvironmentStats() {
    return {
      totalAccounts: this.demoAccounts.size,
      totalMonitors: this.demoMonitors.size,
      totalAlerts: this.demoAlerts.length,
      sessionDuration: Date.now() - this.sessionStartTime,
      readOnly: this.readOnly,
      autoRefreshActive: this.refreshTimer !== null,
      dataRefreshInterval: this.dataRefreshInterval
    };
  }

  /**
   * Reset environment
   */
  async resetEnvironment() {
    this.stopAutoRefresh();
    this.demoAccounts.clear();
    this.demoMonitors.clear();
    this.demoAlerts = [];
    this.demoData.clear();
    this.sessionStartTime = Date.now();

    this.emit('environment-reset');
    return { success: true };
  }
}

module.exports = DemoEnvironment;
