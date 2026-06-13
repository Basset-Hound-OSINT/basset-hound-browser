import { useState, useEffect, useCallback } from 'react';
import '../styles/ConnectionStatus.css';

/**
 * Connection Status Display Component
 * Shows real-time connection health and status
 */
function ConnectionStatus({ apiClient, refreshInterval = 5000 }) {
  const [status, setStatus] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dashboards/connections/status');
      setStatus(response.data);
      setConnections(response.data.activeConnections || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, refreshInterval]);

  if (loading) {
    return <div className="connection-status loading">Loading...</div>;
  }

  if (error) {
    return <div className="connection-status error">Error: {error}</div>;
  }

  if (!status) {
    return null;
  }

  const healthStatus = getHealthStatus(status.healthScore);

  return (
    <div className="connection-status">
      <div className="status-header">
        <h3>Connection Status</h3>
        <div className={`health-indicator status-${healthStatus}`}>
          <div className="health-dot"></div>
          <span>{healthStatus.toUpperCase()}</span>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="health-metrics">
        <MetricLine
          label="Health Score"
          value={status.healthScore}
          max={100}
          unit="%"
        />
        <MetricLine
          label="Uptime"
          value={status.uptime}
          max={100}
          unit="%"
        />
        <MetricLine
          label="Latency"
          value={status.avgLatency}
          max={100}
          unit="ms"
          isLatency={true}
        />
        <MetricLine
          label="Success Rate"
          value={status.successRate}
          max={100}
          unit="%"
        />
      </div>

      {/* Connection Details */}
      <div className="connection-details">
        <div className="details-row">
          <span className="detail-label">Active Connections:</span>
          <span className="detail-value">{status.activeCount}</span>
        </div>
        <div className="details-row">
          <span className="detail-label">Peak Connections:</span>
          <span className="detail-value">{status.peakCount}</span>
        </div>
        <div className="details-row">
          <span className="detail-label">Total Reconnects:</span>
          <span className="detail-value">{status.reconnectCount}</span>
        </div>
        <div className="details-row">
          <span className="detail-label">Connection Errors:</span>
          <span className={`detail-value ${status.errorCount > 0 ? 'error' : ''}`}>
            {status.errorCount}
          </span>
        </div>
      </div>

      {/* Active Connections List */}
      {connections.length > 0 && (
        <div className="connections-list">
          <h4>Active Connections ({connections.length})</h4>
          <div className="connections-table">
            <div className="table-header">
              <div className="col-id">ID</div>
              <div className="col-status">Status</div>
              <div className="col-latency">Latency</div>
              <div className="col-messages">Messages</div>
              <div className="col-uptime">Uptime</div>
            </div>
            {connections.slice(0, 10).map((conn) => (
              <div key={conn.id} className="table-row">
                <div className="col-id">{conn.id.substring(0, 8)}</div>
                <div className={`col-status status-${conn.status}`}>
                  {conn.status}
                </div>
                <div className="col-latency">{conn.latency}ms</div>
                <div className="col-messages">{conn.messages}</div>
                <div className="col-uptime">{formatUptime(conn.uptime)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Issues */}
      {status.issues && status.issues.length > 0 && (
        <div className="connection-issues">
          <h4>⚠️ Issues Detected</h4>
          <ul className="issues-list">
            {status.issues.map((issue, index) => (
              <li key={index} className={`issue severity-${issue.severity}`}>
                <span className="issue-time">{formatTime(issue.timestamp)}</span>
                <span className="issue-message">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Metric Line Component
 */
function MetricLine({ label, value, max, unit, isLatency = false }) {
  let percentage = isLatency ? Math.min(100, (value / 1000) * 100) : (value / max) * 100;
  let barColor = 'ok';

  if (isLatency) {
    if (value > 500) barColor = 'critical';
    else if (value > 200) barColor = 'warning';
  } else {
    if (value < 50) barColor = 'critical';
    else if (value < 80) barColor = 'warning';
  }

  return (
    <div className="metric-line">
      <div className="metric-label">{label}</div>
      <div className="metric-bar-container">
        <div
          className={`metric-bar ${barColor}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        ></div>
      </div>
      <div className="metric-value">
        {value}{unit}
      </div>
    </div>
  );
}

/**
 * Get health status based on score
 */
function getHealthStatus(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

/**
 * Format uptime
 */
function formatUptime(uptime) {
  if (uptime < 60) return `${uptime}s`;
  if (uptime < 3600) return `${Math.floor(uptime / 60)}m`;
  return `${Math.floor(uptime / 3600)}h`;
}

/**
 * Format time ago
 */
function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default ConnectionStatus;
