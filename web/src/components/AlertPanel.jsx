import { useMemo, useState } from 'react';
import '../styles/AlertPanel.css';

/**
 * Displays and manages alerts
 */
function AlertPanel({ alerts = [], onMarkRead, onDismiss, onAcknowledge }) {
  const [sortBy, setSortBy] = useState('date');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedAlerts, setSelectedAlerts] = useState(new Set());

  const filteredAndSorted = useMemo(() => {
    let result = alerts;

    if (filterSeverity !== 'all') {
      result = result.filter((a) => a.severity === filterSeverity);
    }

    return result.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.timestamp) - new Date(a.timestamp);
        case 'severity':
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
          return (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        default:
          return 0;
      }
    });
  }, [alerts, sortBy, filterSeverity]);

  const toggleSelectAll = () => {
    if (selectedAlerts.size === filteredAndSorted.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(filteredAndSorted.map((a) => a.id)));
    }
  };

  const toggleSelectAlert = (alertId) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  const handleBatchAction = (action) => {
    const ids = Array.from(selectedAlerts);
    switch (action) {
      case 'read':
        ids.forEach((id) => onMarkRead?.(id));
        break;
      case 'acknowledge':
        ids.forEach((id) => onAcknowledge?.(id));
        break;
      case 'dismiss':
        ids.forEach((id) => onDismiss?.(id));
        break;
      default:
        break;
    }
    setSelectedAlerts(new Set());
  };

  const severityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'info';
    }
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="alert-panel">
      <div className="alert-header">
        <h2>Alerts</h2>
        {unreadCount > 0 && (
          <div className="unread-badge">{unreadCount} unread</div>
        )}
      </div>

      <div className="alert-controls">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="date">Sort by Date</option>
          <option value="severity">Sort by Severity</option>
          <option value="type">Sort by Type</option>
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>

      {selectedAlerts.size > 0 && (
        <div className="batch-actions">
          <span className="selected-count">{selectedAlerts.size} selected</span>
          <button
            className="btn-action"
            onClick={() => handleBatchAction('read')}
          >
            Mark as Read
          </button>
          <button
            className="btn-action"
            onClick={() => handleBatchAction('acknowledge')}
          >
            Acknowledge
          </button>
          <button
            className="btn-action btn-danger"
            onClick={() => handleBatchAction('dismiss')}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="alert-list">
        <div className="alert-list-header">
          <input
            type="checkbox"
            checked={selectedAlerts.size === filteredAndSorted.length && filteredAndSorted.length > 0}
            onChange={toggleSelectAll}
            className="select-all"
            aria-label="Select all alerts"
          />
          <span>Severity</span>
          <span>Title</span>
          <span>Type</span>
          <span>Time</span>
        </div>

        {filteredAndSorted.map((alert) => (
          <div
            key={alert.id}
            className={`alert-item ${alert.read ? '' : 'unread'} ${severityColor(alert.severity)}`}
          >
            <input
              type="checkbox"
              checked={selectedAlerts.has(alert.id)}
              onChange={() => toggleSelectAlert(alert.id)}
              className="alert-checkbox"
            />

            <div className={`severity-indicator ${severityColor(alert.severity)}`}>
              {alert.severity?.[0].toUpperCase()}
            </div>

            <div className="alert-title">
              {alert.title}
              {alert.message && (
                <p className="alert-message">{alert.message}</p>
              )}
            </div>

            <div className="alert-type">
              {alert.type || 'unknown'}
            </div>

            <div className="alert-time">
              {formatTime(alert.timestamp)}
            </div>

            <div className="alert-item-actions">
              {!alert.read && (
                <button
                  className="btn-sm"
                  onClick={() => onMarkRead?.(alert.id)}
                  title="Mark as read"
                >
                  ✓
                </button>
              )}
              {alert.status !== 'acknowledged' && (
                <button
                  className="btn-sm"
                  onClick={() => onAcknowledge?.(alert.id)}
                  title="Acknowledge"
                >
                  ✓✓
                </button>
              )}
              <button
                className="btn-sm btn-close"
                onClick={() => onDismiss?.(alert.id)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="empty-state">
          <p>No alerts</p>
          {alerts.length > 0 && filterSeverity !== 'all' && (
            <p className="text-muted">Try changing the severity filter</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString();
}

export default AlertPanel;
