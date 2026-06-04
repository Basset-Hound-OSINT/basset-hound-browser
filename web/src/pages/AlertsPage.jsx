import { useDashboard } from '../hooks/useDashboard';
import AlertPanel from '../components/AlertPanel';
import '../styles/AlertsPage.css';

/**
 * Dedicated alerts management page
 */
function AlertsPage() {
  const { alerts, loading, error, markAlertRead, dismissAlert } = useDashboard();

  const stats = {
    total: alerts.length,
    unread: alerts.filter((a) => !a.read).length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
  };

  return (
    <div className="alerts-page">
      <div className="page-header">
        <h1>Alert Management</h1>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {/* Alert Stats */}
      <div className="alert-stats">
        <div className="alert-stat-card">
          <span className="stat-label">Total Alerts</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="alert-stat-card unread">
          <span className="stat-label">Unread</span>
          <span className="stat-value">{stats.unread}</span>
        </div>
        <div className="alert-stat-card critical">
          <span className="stat-label">Critical</span>
          <span className="stat-value">{stats.critical}</span>
        </div>
        <div className="alert-stat-card acknowledged">
          <span className="stat-label">Acknowledged</span>
          <span className="stat-value">{stats.acknowledged}</span>
        </div>
      </div>

      {/* Alert Panel */}
      {loading ? (
        <div className="loading">
          <p>Loading alerts...</p>
        </div>
      ) : (
        <AlertPanel
          alerts={alerts}
          onMarkRead={markAlertRead}
          onDismiss={dismissAlert}
        />
      )}
    </div>
  );
}

export default AlertsPage;
