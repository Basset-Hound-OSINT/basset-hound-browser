import { useState, useEffect, useCallback } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import '../styles/PerformanceMetrics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Real-time Performance Metrics Component
 */
function PerformanceMetrics({ apiClient, refreshInterval = 5000 }) {
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('latency');

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dashboards/metrics');
      setMetrics(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const fetchChartData = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/dashboards/metrics/${selectedMetric}/chart`);
      setChartData(response.data);
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
    }
  }, [apiClient, selectedMetric]);

  useEffect(() => {
    fetchMetrics();
    fetchChartData();

    const metricInterval = setInterval(fetchMetrics, refreshInterval);
    const chartInterval = setInterval(fetchChartData, refreshInterval * 2);

    return () => {
      clearInterval(metricInterval);
      clearInterval(chartInterval);
    };
  }, [fetchMetrics, fetchChartData, refreshInterval]);

  if (loading) {
    return <div className="performance-metrics loading">Loading metrics...</div>;
  }

  if (error) {
    return <div className="performance-metrics error">Error: {error}</div>;
  }

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <h2>Performance Metrics</h2>
        <div className="metric-selector">
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>
            <option value="latency">Latency</option>
            <option value="throughput">Throughput</option>
            <option value="cpu">CPU Usage</option>
            <option value="memory">Memory Usage</option>
            <option value="errorRate">Error Rate</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        {metrics && (
          <>
            <MetricCard
              title="Current"
              value={metrics.current}
              unit={metrics.unit}
              status={metrics.status}
            />
            <MetricCard
              title="Average"
              value={metrics.avg}
              unit={metrics.unit}
              status="neutral"
            />
            <MetricCard
              title="P95"
              value={metrics.p95}
              unit={metrics.unit}
              status={metrics.p95 > metrics.threshold ? 'warning' : 'ok'}
            />
            <MetricCard
              title="P99"
              value={metrics.p99}
              unit={metrics.unit}
              status={metrics.p99 > metrics.threshold ? 'critical' : 'ok'}
            />
          </>
        )}
      </div>

      {/* Chart */}
      {chartData.type === 'line' && (
        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {chartData.type === 'bar' && (
        <div className="chart-container">
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}

      {chartData.type === 'pie' && (
        <div className="chart-container pie-chart">
          <Pie data={chartData} options={pieChartOptions} />
        </div>
      )}
    </div>
  );
}

/**
 * Individual Metric Card Component
 */
function MetricCard({ title, value, unit, status = 'neutral' }) {
  return (
    <div className={`metric-card status-${status}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {value}
        <span className="metric-unit">{unit}</span>
      </div>
      <div className={`metric-status ${status}`}>{status.toUpperCase()}</div>
    </div>
  );
}

/**
 * Chart options
 */
const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#666',
        font: { size: 12 }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0,0,0,0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#3b82f6',
      borderWidth: 1
    }
  },
  scales: {
    x: {
      grid: {
        display: false,
        color: '#e5e7eb'
      },
      ticks: {
        color: '#666',
        font: { size: 11 }
      }
    },
    y: {
      grid: {
        color: '#e5e7eb',
        drawBorder: false
      },
      ticks: {
        color: '#666',
        font: { size: 11 }
      }
    }
  }
};

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#666',
        padding: 15,
        font: { size: 12 }
      }
    }
  }
};

export default PerformanceMetrics;
