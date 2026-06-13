import { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import '../styles/ThroughputTrends.css';

/**
 * Throughput Trends Component
 * Displays throughput trends over time with moving averages
 */
function ThroughputTrends({ apiClient, refreshInterval = 10000 }) {
  const [trends, setTrends] = useState(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchTrends = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dashboards/throughput/trends', {
        params: { range: timeRange }
      });
      setTrends(response.data);
      setStats(response.data.stats);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, timeRange]);

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTrends, refreshInterval]);

  if (loading) {
    return <div className="throughput-trends loading">Loading trends...</div>;
  }

  if (error) {
    return <div className="throughput-trends error">Error: {error}</div>;
  }

  if (!trends) {
    return null;
  }

  const chartData = {
    labels: trends.labels,
    datasets: [
      {
        label: 'Actual Throughput',
        data: trends.actual,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6
      },
      {
        label: 'Moving Average (5m)',
        data: trends.movingAverage,
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#666', padding: 15 }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        padding: 10,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#666', maxTicksLimit: 10 }
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#666' }
      }
    }
  };

  return (
    <div className="throughput-trends">
      <div className="trends-header">
        <h3>Throughput Trends</h3>
        <div className="time-range-selector">
          {['1h', '4h', '24h', '7d'].map(range => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="trends-stats">
          <StatBox label="Current" value={stats.current} unit="msg/s" />
          <StatBox label="Average" value={stats.avg} unit="msg/s" />
          <StatBox label="Peak" value={stats.peak} unit="msg/s" />
          <StatBox
            label="Trend"
            value={stats.trend}
            unit={stats.trendDirection}
            className={`trend-${stats.trendDirection}`}
          />
        </div>
      )}

      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>

      {trends.anomalies && trends.anomalies.length > 0 && (
        <div className="anomalies-section">
          <h4>Detected Anomalies</h4>
          <div className="anomalies-list">
            {trends.anomalies.slice(0, 5).map((anomaly, index) => (
              <div key={index} className={`anomaly-item severity-${anomaly.severity}`}>
                <span className="anomaly-time">{anomaly.time}</span>
                <span className="anomaly-value">{anomaly.value.toFixed(0)} msg/s</span>
                <span className="anomaly-badge">{anomaly.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Stat Box Component
 */
function StatBox({ label, value, unit, className = '' }) {
  return (
    <div className={`stat-box ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value.toFixed(1)}
        <span className="stat-unit">{unit}</span>
      </div>
    </div>
  );
}

export default ThroughputTrends;
