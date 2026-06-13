import { useState, useEffect, useCallback } from 'react';
import '../styles/MobileDashboard.css';

/**
 * Mobile Dashboard Component
 * Responsive design for mobile and tablet viewing
 */
function MobileDashboard({ apiClient, refreshInterval = 10000 }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dashboards/mobile/summary');
      setDashboard(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchDashboard, refreshInterval]);

  if (loading) {
    return <div className="mobile-dashboard loading">Loading...</div>;
  }

  if (error) {
    return <div className="mobile-dashboard error">Error: {error}</div>;
  }

  if (!dashboard) {
    return null;
  }

  const getStatusClass = (status) => {
    if (status >= 90) return 'excellent';
    if (status >= 75) return 'good';
    if (status >= 50) return 'warning';
    return 'critical';
  };

  return (
    <div className="mobile-dashboard">
      {/* Header with Status Indicator */}
      <div className="mobile-header">
        <h1>Status</h1>
        <div className={`status-indicator ${getStatusClass(dashboard.healthScore)}`}>
          <div className="status-dot"></div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats-mobile">
        <div className="stat-item">
          <div className="stat-icon">📊</div>
          <div className="stat-data">
            <div className="stat-label">Health</div>
            <div className="stat-value">{dashboard.healthScore}%</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⚡</div>
          <div className="stat-data">
            <div className="stat-label">Latency</div>
            <div className="stat-value">{dashboard.latency}ms</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">🔄</div>
          <div className="stat-data">
            <div className="stat-label">Uptime</div>
            <div className="stat-value">{dashboard.uptime}%</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mobile-tabs">
        <button
          className={`tab ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSection('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeSection === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveSection('metrics')}
        >
          Metrics
        </button>
        <button
          className={`tab ${activeSection === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveSection('errors')}
        >
          Errors
        </button>
      </div>

      {/* Tab Content */}
      <div className="mobile-content">
        {activeSection === 'overview' && (
          <div className="overview-section">
            <div className="section-card">
              <h3>Active Connections</h3>
              <div className="value-large">{dashboard.connections}</div>
            </div>

            <div className="section-card">
              <h3>Messages/sec</h3>
              <div className="value-large">{dashboard.throughput}</div>
            </div>

            <div className="section-card">
              <h3>System Resources</h3>
              <div className="resource-item">
                <span className="resource-label">CPU</span>
                <div className="resource-bar">
                  <div
                    className="resource-fill"
                    style={{ width: `${dashboard.cpu}%` }}
                  ></div>
                </div>
                <span className="resource-value">{dashboard.cpu}%</span>
              </div>
              <div className="resource-item">
                <span className="resource-label">Memory</span>
                <div className="resource-bar">
                  <div
                    className="resource-fill"
                    style={{ width: `${dashboard.memory}%` }}
                  ></div>
                </div>
                <span className="resource-value">{dashboard.memory}%</span>
              </div>
              <div className="resource-item">
                <span className="resource-label">Disk</span>
                <div className="resource-bar">
                  <div
                    className="resource-fill"
                    style={{ width: `${dashboard.disk}%` }}
                  ></div>
                </div>
                <span className="resource-value">{dashboard.disk}%</span>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'metrics' && (
          <div className="metrics-section">
            {dashboard.topMetrics?.map((metric, index) => (
              <div key={index} className="metric-item">
                <div className="metric-name">{metric.name}</div>
                <div className="metric-bar">
                  <div
                    className={`metric-fill ${metric.status}`}
                    style={{ width: `${Math.min(100, metric.value / metric.max * 100)}%` }}
                  ></div>
                </div>
                <div className="metric-value">
                  {metric.value}{metric.unit}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'errors' && (
          <div className="errors-section">
            {dashboard.recentErrors?.length > 0 ? (
              dashboard.recentErrors.slice(0, 5).map((err, index) => (
                <div key={index} className={`error-item severity-${err.severity}`}>
                  <div className="error-badge">{err.severity}</div>
                  <div className="error-details">
                    <div className="error-title">{err.title}</div>
                    <div className="error-time">{formatTime(err.timestamp)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-errors">No recent errors</div>
            )}
          </div>
        )}
      </div>

      {/* SOS Button */}
      <button className="sos-button" title="Quick status report">
        SOS
      </button>

      {/* Last Updated */}
      <div className="last-updated">
        Updated {formatLastUpdated(dashboard.lastUpdate)}
      </div>
    </div>
  );
}

/**
 * Format time difference
 */
function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

/**
 * Format last updated
 */
function formatLastUpdated(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return `now`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default MobileDashboard;
