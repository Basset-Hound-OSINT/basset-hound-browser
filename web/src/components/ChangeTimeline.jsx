import { useMemo, useState } from 'react';
import '../styles/ChangeTimeline.css';

/**
 * Displays timeline of changes
 */
function ChangeTimeline({ changes = [], filters = {} }) {
  const [selectedChange, setSelectedChange] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const filteredChanges = useMemo(() => {
    let result = changes;

    if (filters.monitorId) {
      result = result.filter((c) => c.monitorId === filters.monitorId);
    }

    if (filters.type) {
      result = result.filter((c) => c.type === filters.type);
    }

    if (filters.severity) {
      result = result.filter((c) => c.severity === filters.severity);
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).getTime();
      const end = new Date(filters.endDate).getTime();
      result = result.filter((c) => {
        const time = new Date(c.timestamp).getTime();
        return time >= start && time <= end;
      });
    }

    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [changes, filters]);

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
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

  return (
    <div className="change-timeline">
      <div className="timeline-header">
        <h2>Change Timeline</h2>
        <div className="timeline-count">
          {filteredChanges.length} changes
        </div>
      </div>

      <div className="timeline-list">
        {filteredChanges.map((change, index) => (
          <div
            key={change.id || `change-${index}`}
            className={`timeline-item ${selectedChange === change.id ? 'selected' : ''}`}
          >
            <div className="timeline-marker">
              <div className={`marker-dot ${severityColor(change.severity)}`} />
              {index < filteredChanges.length - 1 && <div className="marker-line" />}
            </div>

            <div className="timeline-content">
              <div className="timeline-header-row" onClick={() => toggleExpanded(change.id)}>
                <div className="timeline-title">
                  <span className={`severity-badge ${severityColor(change.severity)}`}>
                    {change.severity?.toUpperCase()}
                  </span>
                  <h3>{change.description}</h3>
                </div>

                <div className="timeline-meta">
                  <span className="timeline-type">{change.type}</span>
                  <span className="timeline-time">{formatTime(change.timestamp)}</span>
                  <button
                    className="expand-btn"
                    aria-expanded={expandedIds.has(change.id)}
                  >
                    {expandedIds.has(change.id) ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {expandedIds.has(change.id) && (
                <div className="timeline-details">
                  <div className="detail-row">
                    <span className="detail-label">Monitor</span>
                    <span className="detail-value">{change.monitorName}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Category</span>
                    <span className="detail-value">{change.category}</span>
                  </div>

                  {change.details && (
                    <div className="detail-row">
                      <span className="detail-label">Details</span>
                      <div className="detail-value details-text">
                        {typeof change.details === 'string' ? change.details : JSON.stringify(change.details, null, 2)}
                      </div>
                    </div>
                  )}

                  {change.url && (
                    <div className="detail-row">
                      <span className="detail-label">Source</span>
                      <a href={change.url} target="_blank" rel="noopener noreferrer" className="detail-value">
                        View Source
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredChanges.length === 0 && (
        <div className="empty-state">
          <p>No changes found</p>
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default ChangeTimeline;
