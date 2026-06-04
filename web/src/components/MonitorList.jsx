import { useState, useMemo } from 'react';
import '../styles/MonitorList.css';

/**
 * Displays all monitors in grid view
 */
function MonitorList({ monitors = [], onEdit, onDelete, onSelect }) {
  const [sortBy, setSortBy] = useState('name');
  const [filterText, setFilterText] = useState('');
  const [selectedMonitor, setSelectedMonitor] = useState(null);

  const filteredAndSorted = useMemo(() => {
    let filtered = monitors.filter((m) =>
      m.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      m.url?.toLowerCase().includes(filterText.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name?.localeCompare(b.name) || 0;
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'updated':
          return (b.lastUpdate || 0) - (a.lastUpdate || 0);
        default:
          return 0;
      }
    });
  }, [monitors, sortBy, filterText]);

  const handleSelectMonitor = (monitor) => {
    setSelectedMonitor(monitor.id === selectedMonitor ? null : monitor.id);
    onSelect?.(monitor);
  };

  return (
    <div className="monitor-list">
      <div className="monitor-list-header">
        <div className="monitor-controls">
          <input
            type="text"
            placeholder="Search monitors..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="search-input"
          />

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
            <option value="updated">Sort by Last Update</option>
          </select>
        </div>
        <div className="monitor-count">
          {filteredAndSorted.length} monitors
        </div>
      </div>

      <div className="monitor-grid">
        {filteredAndSorted.map((monitor) => (
          <div
            key={monitor.id}
            className={`monitor-card ${selectedMonitor === monitor.id ? 'selected' : ''}`}
            onClick={() => handleSelectMonitor(monitor)}
          >
            <div className="monitor-header">
              <h3 className="monitor-name">{monitor.name}</h3>
              <div className={`monitor-status ${monitor.status || 'unknown'}`}>
                {monitor.status || 'Unknown'}
              </div>
            </div>

            <div className="monitor-url">
              <a href={monitor.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                {new URL(monitor.url).hostname}
              </a>
            </div>

            <div className="monitor-stats">
              <div className="stat">
                <span className="stat-label">Changes</span>
                <span className="stat-value">{monitor.changeCount || 0}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Alerts</span>
                <span className="stat-value">{monitor.alertCount || 0}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Last Checked</span>
                <span className="stat-value">
                  {monitor.lastUpdate ? formatTime(monitor.lastUpdate) : 'Never'}
                </span>
              </div>
            </div>

            <div className="monitor-actions">
              <button
                className="btn-sm btn-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(monitor);
                }}
              >
                Edit
              </button>
              <button
                className="btn-sm btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete monitor "${monitor.name}"?`)) {
                    onDelete?.(monitor.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="empty-state">
          <p>No monitors found</p>
          {monitors.length > 0 && <p className="text-muted">Try adjusting your search</p>}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export default MonitorList;
