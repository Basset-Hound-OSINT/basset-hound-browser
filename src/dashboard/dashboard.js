/**
 * Dashboard Client JavaScript
 * Real-time competitor monitoring dashboard with WebSocket integration
 */

class CompetitorDashboard {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || `ws://${window.location.hostname}:8765`;
    this.ws = null;
    this.autoRefreshInterval = options.autoRefreshInterval || 30000; // 30s
    this.refreshTimer = null;
    this.charts = {};
    this.selectedAlerts = new Set();
    this.currentFilters = {
      monitorIds: [],
      category: null,
      severity: null
    };

    this.init();
  }

  async init() {
    try {
      // Setup event listeners
      this.setupEventListeners();

      // Load settings from localStorage
      this.loadSettings();

      // Connect WebSocket
      this.connect();

      // Load initial data
      await this.loadDashboardData();

      // Start auto-refresh
      this.startAutoRefresh();
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      this.showError('Failed to initialize dashboard');
    }
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Buttons
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadDashboardData());
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('markReadBtn').addEventListener('click', () => this.markSelectedAsRead());
    document.getElementById('dismissBtn').addEventListener('click', () => this.dismissSelectedAlerts());
    document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearFilters());
    document.getElementById('compareBtn').addEventListener('click', () => this.compareMonitors());

    // Filters
    document.getElementById('monitorFilter').addEventListener('change', (e) => {
      this.currentFilters.monitorIds = Array.from(e.target.selectedOptions).map(o => o.value).filter(Boolean);
      this.applyFilters();
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.currentFilters.category = e.target.value || null;
      this.applyFilters();
    });

    document.getElementById('severityFilter').addEventListener('change', (e) => {
      this.currentFilters.severity = e.target.value || null;
      this.applyFilters();
    });

    // Settings modal
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeSettings());
    });
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

    // Alert selection
    document.getElementById('selectAllAlerts').addEventListener('change', (e) => {
      document.querySelectorAll('tbody input[type="checkbox"]').forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) {
          this.selectedAlerts.add(cb.dataset.alertId);
        } else {
          this.selectedAlerts.delete(cb.dataset.alertId);
        }
      });
    });
  }

  connect() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.addEventListener('open', () => {
        this.updateConnectionStatus(true);
        console.log('Dashboard connected to WebSocket');
      });

      this.ws.addEventListener('message', (event) => {
        this.handleWebSocketMessage(event.data);
      });

      this.ws.addEventListener('close', () => {
        this.updateConnectionStatus(false);
        // Attempt reconnect after 5 seconds
        setTimeout(() => this.connect(), 5000);
      });

      this.ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus(false);
      });
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.updateConnectionStatus(false);
    }
  }

  sendCommand(command, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return null;
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${command} timeout`));
      }, 10000);

      const handler = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.requestId === requestId) {
            clearTimeout(timeout);
            this.ws.removeEventListener('message', handler);
            resolve(message);
          }
        } catch (error) {
          // Handle non-JSON messages
        }
      };

      this.ws.addEventListener('message', handler);

      this.ws.send(JSON.stringify({
        command,
        params,
        requestId
      }));
    });
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);

      if (message.type === 'dashboard-update') {
        this.handleDashboardUpdate(message.data);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  handleDashboardUpdate(update) {
    switch (update.type) {
    case 'change-added':
      this.addChangeToTimeline(update.change);
      break;
    case 'alert-added':
      this.addAlertToList(update.alert);
      break;
    case 'metrics-updated':
      this.updateMetrics(update.metrics);
      break;
    }
  }

  async loadDashboardData() {
    try {
      const response = await this.sendCommand('get_dashboard_data');

      if (!response.success) {
        throw new Error(response.error);
      }

      const dashboard = response.dashboard;

      // Update monitors list
      this.updateMonitorsList(dashboard.overview.monitors);

      // Update metrics
      this.updateMetrics(dashboard.metrics);

      // Update timeline
      this.displayTimeline(dashboard.timeline);

      // Update alerts
      if (dashboard.alerts) {
        this.displayAlerts(dashboard.alerts);
      }

      this.showSuccess('Dashboard updated');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  updateMonitorsList(monitors) {
    const select = document.getElementById('monitorFilter');
    const comparisonSelect = document.getElementById('comparisonSelect');

    // Clear existing options
    while (select.options.length > 1) {
      select.remove(1);
    }
    while (comparisonSelect.options.length > 1) {
      comparisonSelect.remove(1);
    }

    // Add monitors
    for (const monitor of monitors) {
      const option = document.createElement('option');
      option.value = monitor.id;
      option.textContent = monitor.name;
      select.appendChild(option);

      const compOption = document.createElement('option');
      compOption.value = monitor.id;
      compOption.textContent = monitor.name;
      comparisonSelect.appendChild(compOption);
    }

    // Update metrics
    document.getElementById('activeMonitors').textContent = monitors.filter(m => m.stats.totalChanges > 0).length;
    document.getElementById('monitorCount').textContent = monitors.length;
  }

  updateMetrics(metricsData) {
    const metrics = metricsData.metrics;

    document.getElementById('totalChanges').textContent = metricsData.stats.totalChanges;

    // Update change count metric
    if (metrics.change_count) {
      const metric = metrics.change_count;
      document.getElementById('changeTrend').textContent = metric.trend || 'stable';
      this.updateChart('changeChart', [metric.value], 'Change Count');
    }

    // Create category chart data
    const categoryData = Object.entries(metrics).reduce((acc, [key, val]) => {
      if (key.includes('category')) {
        acc.push(val);
      }
      return acc;
    }, []);

    if (categoryData.length > 0) {
      this.updateChart('categoryChart', categoryData.map(c => c.value || 0), 'Categories');
    }
  }

  displayTimeline(timeline) {
    const tbody = document.getElementById('timelineBody');
    tbody.innerHTML = '';

    if (!timeline.entries || timeline.entries.length === 0) {
      tbody.innerHTML = '<tr class="empty-state"><td colspan="5">No changes recorded</td></tr>';
      return;
    }

    for (const entry of timeline.entries) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${this.formatTime(entry.dashboardTimestamp)}</td>
        <td>${entry.monitorName}</td>
        <td><span class="category-badge">${entry.category || 'N/A'}</span></td>
        <td>${entry.description || 'No description'}</td>
        <td>${entry.type || 'N/A'}</td>
      `;
      tbody.appendChild(row);
    }
  }

  displayAlerts(alertsData) {
    const summary = alertsData.summary;

    document.getElementById('unreadCount').textContent = summary.unreadCount;
    document.getElementById('criticalCount').textContent = summary.bySeverity.critical || 0;
    document.getElementById('highCount').textContent = summary.bySeverity.high || 0;

    const tbody = document.getElementById('alertsBody');
    tbody.innerHTML = '';

    if (!alertsData.unread || alertsData.unread.alerts.length === 0) {
      tbody.innerHTML = '<tr class="empty-state"><td colspan="7">No alerts</td></tr>';
      return;
    }

    for (const alert of alertsData.unread.alerts) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" data-alert-id="${alert.id}" class="alert-checkbox"></td>
        <td>${this.formatTime(alert.dashboardTimestamp)}</td>
        <td>${alert.monitorName}</td>
        <td>${alert.title}</td>
        <td><span class="severity-badge severity-${alert.severity}">${alert.severity}</span></td>
        <td>${alert.status}</td>
        <td>
          <button class="btn-sm" onclick="dashboard.acknowledgeAlert('${alert.id}')">Ack</button>
          <button class="btn-sm" onclick="dashboard.dismissAlert('${alert.id}')">Dismiss</button>
        </td>
      `;
      tbody.appendChild(row);

      // Add checkbox event listener
      row.querySelector('.alert-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedAlerts.add(alert.id);
        } else {
          this.selectedAlerts.delete(alert.id);
        }
      });
    }
  }

  async compareMonitors() {
    const select = document.getElementById('comparisonSelect');
    const selected = Array.from(select.selectedOptions).map(o => o.value);

    if (selected.length < 2) {
      this.showError('Please select at least 2 competitors');
      return;
    }

    try {
      const response = await this.sendCommand('get_competitor_comparison', {
        monitor_ids: selected,
        options: { timeframe: 24 * 60 * 60 * 1000 }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      this.displayComparison(response.comparison);
    } catch (error) {
      console.error('Comparison error:', error);
      this.showError('Failed to compare competitors');
    }
  }

  displayComparison(comparison) {
    const resultsDiv = document.getElementById('comparisonResults');
    resultsDiv.innerHTML = '';

    const summary = comparison.summary;

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'comparison-item';
    summaryDiv.innerHTML = `
      <h4>Comparison Summary</h4>
      <p>Total Changes: ${summary.totalChanges}</p>
      <p>Most Active: ${summary.mostActive || 'N/A'}</p>
      <p>Least Active: ${summary.leastActive || 'N/A'}</p>
    `;
    resultsDiv.appendChild(summaryDiv);

    for (const [monitorId, data] of Object.entries(comparison.monitors)) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'comparison-item';
      itemDiv.innerHTML = `
        <h4>${data.name}</h4>
        <p>Changes: ${data.changeCount}</p>
        <p>Categories: ${data.categoryBreakdown ? Object.keys(data.categoryBreakdown).join(', ') : 'N/A'}</p>
        <p>Avg Frequency: ${this.formatDuration(data.averageFrequency)}</p>
      `;
      resultsDiv.appendChild(itemDiv);
    }
  }

  switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });

    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Show selected tab
    const tab = document.getElementById(tabName);
    if (tab) {
      tab.classList.add('active');
    }

    // Activate selected button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Initialize charts on tab switch
    if (tabName === 'timeline') {
      this.loadDashboardData();
    }
  }

  applyFilters() {
    // Filter displayed data based on current filters
    this.loadDashboardData();
  }

  clearFilters() {
    this.currentFilters = {
      monitorIds: [],
      category: null,
      severity: null
    };

    document.getElementById('monitorFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('severityFilter').value = '';

    this.loadDashboardData();
  }

  async markSelectedAsRead() {
    if (this.selectedAlerts.size === 0) {
      this.showError('No alerts selected');
      return;
    }

    try {
      const response = await this.sendCommand('batch_mark_alerts_read', {
        alert_ids: Array.from(this.selectedAlerts)
      });

      if (response.success) {
        this.selectedAlerts.clear();
        this.loadDashboardData();
        this.showSuccess(`${response.count} alerts marked as read`);
      }
    } catch (error) {
      this.showError('Failed to mark alerts as read');
    }
  }

  async dismissSelectedAlerts() {
    if (this.selectedAlerts.size === 0) {
      this.showError('No alerts selected');
      return;
    }

    try {
      const response = await this.sendCommand('batch_dismiss_alerts', {
        alert_ids: Array.from(this.selectedAlerts)
      });

      if (response.success) {
        this.selectedAlerts.clear();
        this.loadDashboardData();
        this.showSuccess(`${response.count} alerts dismissed`);
      }
    } catch (error) {
      this.showError('Failed to dismiss alerts');
    }
  }

  async acknowledgeAlert(alertId) {
    try {
      const response = await this.sendCommand('acknowledge_alert', {
        alert_id: alertId
      });

      if (response.success) {
        this.loadDashboardData();
        this.showSuccess('Alert acknowledged');
      }
    } catch (error) {
      this.showError('Failed to acknowledge alert');
    }
  }

  async dismissAlert(alertId) {
    try {
      const response = await this.sendCommand('dismiss_alert', {
        alert_id: alertId
      });

      if (response.success) {
        this.loadDashboardData();
        this.showSuccess('Alert dismissed');
      }
    } catch (error) {
      this.showError('Failed to dismiss alert');
    }
  }

  addChangeToTimeline(change) {
    const tbody = document.getElementById('timelineBody');
    if (tbody.querySelector('.empty-state')) {
      tbody.innerHTML = '';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${this.formatTime(change.dashboardTimestamp)}</td>
      <td>${change.monitorName}</td>
      <td><span class="category-badge">${change.category || 'N/A'}</span></td>
      <td>${change.description || 'No description'}</td>
      <td>${change.type || 'N/A'}</td>
    `;

    tbody.insertBefore(row, tbody.firstChild);

    // Keep only last 100 rows
    while (tbody.children.length > 100) {
      tbody.removeChild(tbody.lastChild);
    }

    // Update metrics
    document.getElementById('totalChanges').textContent = parseInt(document.getElementById('totalChanges').textContent) + 1;
  }

  addAlertToList(alert) {
    const tbody = document.getElementById('alertsBody');
    if (tbody.querySelector('.empty-state')) {
      tbody.innerHTML = '';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" data-alert-id="${alert.id}" class="alert-checkbox"></td>
      <td>${this.formatTime(alert.dashboardTimestamp)}</td>
      <td>${alert.monitorName}</td>
      <td>${alert.title}</td>
      <td><span class="severity-badge severity-${alert.severity}">${alert.severity}</span></td>
      <td>${alert.status}</td>
      <td>
        <button class="btn-sm" onclick="dashboard.acknowledgeAlert('${alert.id}')">Ack</button>
        <button class="btn-sm" onclick="dashboard.dismissAlert('${alert.id}')">Dismiss</button>
      </td>
    `;

    tbody.insertBefore(row, tbody.firstChild);

    // Update unread count
    document.getElementById('unreadCount').textContent = parseInt(document.getElementById('unreadCount').textContent) + 1;
  }

  updateChart(canvasId, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      return;
    }

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [label],
        datasets: [{
          label: label,
          data: data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  openSettings() {
    document.getElementById('settingsModal').classList.add('active');
  }

  closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
  }

  saveSettings() {
    const settings = {
      refreshInterval: parseInt(document.getElementById('refreshInterval').value),
      theme: document.getElementById('theme').value,
      soundEnabled: document.getElementById('soundEnabled').checked,
      notificationsEnabled: document.getElementById('notificationsEnabled').checked
    };

    localStorage.setItem('dashboardSettings', JSON.stringify(settings));

    // Apply theme
    this.applyTheme(settings.theme);

    // Update refresh interval
    this.stopAutoRefresh();
    this.autoRefreshInterval = settings.refreshInterval * 1000;
    this.startAutoRefresh();

    this.closeSettings();
    this.showSuccess('Settings saved');
  }

  loadSettings() {
    const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');

    if (settings.refreshInterval) {
      document.getElementById('refreshInterval').value = settings.refreshInterval;
      this.autoRefreshInterval = settings.refreshInterval * 1000;
    }

    if (settings.theme) {
      document.getElementById('theme').value = settings.theme;
      this.applyTheme(settings.theme);
    }

    if (settings.soundEnabled !== undefined) {
      document.getElementById('soundEnabled').checked = settings.soundEnabled;
    }

    if (settings.notificationsEnabled !== undefined) {
      document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
    }
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.style.colorScheme = 'dark';
    } else if (theme === 'light') {
      document.documentElement.style.colorScheme = 'light';
    } else {
      document.documentElement.style.colorScheme = '';
    }
  }

  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.loadDashboardData();
    }, this.autoRefreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionIndicator');
    const text = document.getElementById('connectionText');

    if (connected) {
      indicator.classList.remove('disconnected');
      indicator.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      indicator.classList.remove('connected');
      indicator.classList.add('disconnected');
      text.textContent = 'Disconnected';
    }
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  formatDuration(ms) {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    }
    if (ms < 3600000) {
      return `${Math.round(ms / 60000)}m`;
    }
    return `${Math.round(ms / 3600000)}h`;
  }

  showError(message) {
    console.error(message);
    // Can be extended with toast notification
  }

  showSuccess(message) {
    console.log(message);
    // Can be extended with toast notification
  }

  destroy() {
    this.stopAutoRefresh();
    if (this.ws) {
      this.ws.close();
    }
    Object.values(this.charts).forEach(chart => chart.destroy());
  }
}

// Initialize dashboard when DOM is ready
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new CompetitorDashboard({
    wsUrl: `ws://${window.location.hostname}:8765`
  });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (dashboard) {
    dashboard.destroy();
  }
});
