import { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import '../styles/LatencyDistribution.css';

/**
 * Latency Distribution Graph Component
 * Displays histogram of latency percentiles
 */
function LatencyDistribution({ apiClient, refreshInterval = 10000 }) {
  const [distribution, setDistribution] = useState(null);
  const [percentiles, setPercentiles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDistribution = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/dashboards/latency/distribution');
      setDistribution(response.data);
      setPercentiles(response.data.percentiles);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchDistribution();
    const interval = setInterval(fetchDistribution, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchDistribution, refreshInterval]);

  if (loading) {
    return <div className="latency-distribution loading">Loading...</div>;
  }

  if (error) {
    return <div className="latency-distribution error">Error: {error}</div>;
  }

  if (!distribution) {
    return null;
  }

  const chartData = {
    labels: distribution.labels,
    datasets: [
      {
        label: 'Request Count',
        data: distribution.data,
        backgroundColor: '#3b82f6',
        borderColor: '#1e40af',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#666' }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff'
      }
    },
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
    <div className="latency-distribution">
      <div className="latency-header">
        <h3>Latency Distribution</h3>
        <div className="distribution-stats">
          <span className="stat">Min: {distribution.min}ms</span>
          <span className="stat">Max: {distribution.max}ms</span>
          <span className="stat">Count: {distribution.count}</span>
        </div>
      </div>

      <div className="percentiles-grid">
        {percentiles && (
          <>
            <PercentileBox label="p25" value={percentiles.p25} />
            <PercentileBox label="p50" value={percentiles.p50} />
            <PercentileBox label="p75" value={percentiles.p75} />
            <PercentileBox label="p95" value={percentiles.p95} />
            <PercentileBox label="p99" value={percentiles.p99} />
          </>
        )}
      </div>

      <div className="chart-container">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

/**
 * Percentile Box Component
 */
function PercentileBox({ label, value }) {
  let status = 'ok';
  if (value > 100) status = 'warning';
  if (value > 500) status = 'critical';

  return (
    <div className={`percentile-box status-${status}`}>
      <div className="percentile-label">{label}</div>
      <div className="percentile-value">{value.toFixed(1)}ms</div>
    </div>
  );
}

export default LatencyDistribution;
