import { useState, useEffect, useCallback } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import '../styles/ErrorTracking.css';

/**
 * Error Tracking Component
 * Monitors errors, warnings, and system health
 */
function ErrorTracking({ apiClient, refreshInterval = 10000 }) {
  const [errorData, setErrorData] = useState(null);
  const [errorsByType, setErrorsByType] = useState(null);
  const [errorTrend, setErrorTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');

  const fetchErrors = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dashboards/errors', {
        params: { severity: filterSeverity }
      });
      setErrorData(response.data);
      setErrorsByType(response.data.byType);
      setErrorTrend(response.data.trend);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, filterSeverity]);

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchErrors, refreshInterval]);

  if (loading) {
    return <div className="error-tracking loading">Loading error data...</div>;
  }

  if (error) {
    return <div className="error-tracking error">Error: {error}</div>;
  }

  if (!errorData) {
    return null;
  }

  const pieChartData = {
    labels: errorsByType?.map(item => item.type) || [],
    datasets: [
      {
        data: errorsByType?.map(item => item.count) || [],
        backgroundColor: [
          '#ef4444',
          '#f97316',
          '#eab308',
          '#3b82f6',
          '#6366f1'
        ]
      }
    ]
  };

  const barChartData = {
    labels: errorTrend?.map(item => item.time) || [],
    datasets: [
      {
        label: 'Errors',
        data: errorTrend?.map(item => item.errors) || [],
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 1
      },
      {
        label: 'Warnings',
        data: errorTrend?.map(item => item.warnings) || [],
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#666', padding: 15 }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff'
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#666' }
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#666' }
      }
    }
  };

  return (
    <div className="error-tracking">
      <div className="error-header">
        <h3>Error Tracking & Alerts</h3>
        <div className="severity-filter">
          <button
            className={`filter-btn ${filterSeverity === 'all' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterSeverity === 'critical' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('critical')}
          >
            Critical
          </button>
          <button
            className={`filter-btn ${filterSeverity === 'warning' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('warning')}
          >
            Warnings
          </button>
        </div>
      </div>

      {/* Error Summary Cards */}
      <div className="error-summary">
        <ErrorCard
          title="Total Errors"
          value={errorData.totalErrors}
          status={errorData.totalErrors > 100 ? 'critical' : 'warning'}
          trend={errorData.errorTrend}
        />
        <ErrorCard
          title="Error Rate"
          value={`${(errorData.errorRate * 100).toFixed(2)}%`}
          status={errorData.errorRate > 0.05 ? 'critical' : 'ok'}
        />
        <ErrorCard
          title="Critical Errors"
          value={errorData.criticalCount}
          status={errorData.criticalCount > 0 ? 'critical' : 'ok'}
        />
        <ErrorCard
          title="Last Error"
          value={formatTime(errorData.lastErrorTime)}
          status="neutral"
        />
      </div>

      {/* Error Distribution by Type */}
      <div className="error-charts">
        <div className="chart-section">
          <h4>Errors by Type</h4>
          <div className="chart-container pie-chart">
            <Pie data={pieChartData} options={chartOptions} />
          </div>
        </div>

        {/* Error Trend */}
        <div className="chart-section">
          <h4>Error Trend</h4>
          <div className="chart-container">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      <div className="recent-errors">
        <h4>Recent Errors</h4>
        <div className="errors-list">
          {errorData.recentErrors?.slice(0, 10).map((err, index) => (
            <div key={index} className={`error-item severity-${err.severity}`}>
              <div className="error-time">{formatTime(err.timestamp)}</div>
              <div className="error-message">{err.message}</div>
              <div className="error-source">{err.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Error Card Component
 */
function ErrorCard({ title, value, status, trend }) {
  return (
    <div className={`error-card status-${status}`}>
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
      {trend && <div className={`card-trend trend-${trend}`}>{trend}</div>}
    </div>
  );
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return `${Math.floor(diff / 1000)}s ago`;
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}m ago`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}h ago`;
  }

  return date.toLocaleString();
}

export default ErrorTracking;
