import { useState, useMemo } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import ChangeTimeline from '../components/ChangeTimeline';
import AlertPanel from '../components/AlertPanel';
import ComparisonView from '../components/ComparisonView';
import '../styles/DashboardPage.css';

/**
 * Main dashboard page with overview and tabs
 */
function DashboardPage() {
  const { monitors, alerts, timeline, metrics, loading, error, markAlertRead, dismissAlert } =
    useDashboard();
  const [activeTab, setActiveTab] = useState('overview');
  const [timelineFilters, setTimelineFilters] = useState({});

  const stats = useMemo(() => {
    return {
      totalMonitors: monitors.length,
      activeAlerts: alerts.filter((a) => !a.dismissed).length,
      totalChanges: timeline.length,
      criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
    };
  }, [monitors, alerts, timeline]);

  if (loading) {
    return (
      <div className="dashboard-page loading">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👁️</div>
          <div className="stat-content">
            <div className="stat-label">Active Monitors</div>
            <div className="stat-value">{stats.totalMonitors}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Total Changes</div>
            <div className="stat-value">{stats.totalChanges}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔔</div>
          <div className="stat-content">
            <div className="stat-label">Active Alerts</div>
            <div className="stat-value alert-value">{stats.activeAlerts}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon critical">🚨</div>
          <div className="stat-content">
            <div className="stat-label">Critical</div>
            <div className="stat-value critical">{stats.criticalAlerts}</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts
        </button>
        <button
          className={`tab-button ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          Comparison
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-section">
              <h2>Quick Stats</h2>
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="quick-stat-label">Latest Changes</span>
                  <div className="quick-stat-items">
                    {timeline.slice(0, 5).map((change, idx) => (
                      <div key={idx} className="quick-stat-item">
                        <span className={`badge ${change.severity}`}>
                          {change.severity}
                        </span>
                        <span>{change.description?.substring(0, 40)}...</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="quick-stat">
                  <span className="quick-stat-label">Top Alerts</span>
                  <div className="quick-stat-items">
                    {alerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className={`quick-stat-item severity-${alert.severity}`}>
                        <span className="badge">{alert.severity}</span>
                        <span>{alert.title?.substring(0, 40)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {metrics && (
              <div className="overview-section">
                <h2>Metrics Summary</h2>
                <div className="metrics-display">
                  <div className="metric">
                    <span className="metric-name">Change Frequency</span>
                    <span className="metric-value">
                      {metrics.changeFrequency || 'N/A'}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Detection Rate</span>
                    <span className="metric-value">
                      {metrics.detectionRate ? `${metrics.detectionRate}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-name">Average Response Time</span>
                    <span className="metric-value">
                      {metrics.avgResponseTime ? `${metrics.avgResponseTime}ms` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-tab">
            <ChangeTimeline changes={timeline} filters={timelineFilters} />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="alerts-tab">
            <AlertPanel
              alerts={alerts}
              onMarkRead={markAlertRead}
              onDismiss={dismissAlert}
            />
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="comparison-tab">
            <ComparisonView
              monitors={monitors}
              changes={{}}
              metrics={metrics}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
