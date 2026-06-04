import { useState, useMemo } from 'react';
import '../styles/ComparisonView.css';

/**
 * Side-by-side competitor comparison view
 */
function ComparisonView({ monitors = [], changes = {}, metrics = {} }) {
  const [selectedMonitors, setSelectedMonitors] = useState([]);

  const comparableMonitors = useMemo(() => {
    return monitors.slice(0, 5); // Limit to 5 for readability
  }, [monitors]);

  const toggleMonitor = (monitorId) => {
    if (selectedMonitors.includes(monitorId)) {
      setSelectedMonitors(selectedMonitors.filter((id) => id !== monitorId));
    } else if (selectedMonitors.length < 4) {
      setSelectedMonitors([...selectedMonitors, monitorId]);
    }
  };

  const comparisonMetrics = useMemo(() => {
    const metrics = {};
    selectedMonitors.forEach((id) => {
      const monitor = monitors.find((m) => m.id === id);
      if (monitor) {
        metrics[id] = {
          name: monitor.name,
          changeCount: monitor.changeCount || 0,
          alertCount: monitor.alertCount || 0,
          lastUpdate: monitor.lastUpdate || null,
          status: monitor.status || 'unknown',
        };
      }
    });
    return metrics;
  }, [selectedMonitors, monitors]);

  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <h2>Competitor Comparison</h2>
        <p className="subtitle">Select up to 4 competitors to compare</p>
      </div>

      <div className="monitor-selector">
        <h3>Available Competitors</h3>
        <div className="monitor-list">
          {comparableMonitors.map((monitor) => (
            <button
              key={monitor.id}
              className={`monitor-checkbox ${selectedMonitors.includes(monitor.id) ? 'selected' : ''}`}
              onClick={() => toggleMonitor(monitor.id)}
              disabled={
                !selectedMonitors.includes(monitor.id) &&
                selectedMonitors.length >= 4
              }
            >
              <input
                type="checkbox"
                checked={selectedMonitors.includes(monitor.id)}
                onChange={() => {}}
                disabled={
                  !selectedMonitors.includes(monitor.id) &&
                  selectedMonitors.length >= 4
                }
              />
              {monitor.name}
            </button>
          ))}
        </div>
      </div>

      {selectedMonitors.length > 0 && (
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {selectedMonitors.map((id) => (
                  <th key={id}>{comparisonMetrics[id].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="metric-label">Changes Detected</td>
                {selectedMonitors.map((id) => (
                  <td key={id} className="metric-value">
                    {comparisonMetrics[id].changeCount}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="metric-label">Active Alerts</td>
                {selectedMonitors.map((id) => (
                  <td key={id} className="metric-value">
                    {comparisonMetrics[id].alertCount}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="metric-label">Status</td>
                {selectedMonitors.map((id) => (
                  <td key={id}>
                    <span className={`status-badge ${comparisonMetrics[id].status}`}>
                      {comparisonMetrics[id].status}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="metric-label">Last Checked</td>
                {selectedMonitors.map((id) => (
                  <td key={id} className="time-value">
                    {formatTime(comparisonMetrics[id].lastUpdate)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {selectedMonitors.length === 0 && (
        <div className="empty-state">
          <p>Select competitors to compare</p>
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default ComparisonView;
