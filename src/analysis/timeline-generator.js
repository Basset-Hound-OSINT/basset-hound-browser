/**
 * Basset Hound Browser - Timeline Generator for Multi-Session Change Tracking
 * Aggregates changes across sessions, creates chronological event logs, analyzes trends
 *
 * Performance targets:
 * - Timeline aggregation: <500ms for 50 targets
 * - Trend analysis: <100ms
 * - Memory: <10MB for 50 sessions with 100 changes each
 */

const crypto = require('crypto');

class TimelineGenerator {
  constructor() {
    this.timelines = new Map(); // monitoringId -> Timeline
    this.sessionIndex = new Map(); // sessionId -> [monitoringIds]
    this.eventLog = []; // Global event log for cross-session queries
  }

  /**
   * Create a new monitoring timeline
   * @param {string} monitoringId - Unique monitoring session identifier
   * @param {string} sessionId - Browser session ID
   * @param {Object} metadata - Timeline metadata
   * @returns {Object} Created timeline
   */
  createTimeline(monitoringId, sessionId, metadata = {}) {
    const timeline = {
      id: monitoringId,
      sessionId,
      startTime: new Date().toISOString(),
      endTime: null,
      active: true,
      metadata: {
        url: metadata.url || '',
        monitoringIntervalMs: metadata.monitoringIntervalMs || 30000,
        sensitivityLevel: metadata.sensitivityLevel || 'medium',
        trackedElements: metadata.trackedElements || ['dom', 'content', 'layout', 'images', 'scripts', 'styles'],
        ...metadata
      },
      changes: [],
      snapshots: new Map(), // timestamp -> snapshot
      statistics: {
        totalChanges: 0,
        changeRate: 0,
        largestChange: null,
        mostFrequentElement: null,
        timeOfMostActivity: null
      },
      trend: 'STABLE' // IMPROVING, STABLE, DEGRADING
    };

    this.timelines.set(monitoringId, timeline);

    if (!this.sessionIndex.has(sessionId)) {
      this.sessionIndex.set(sessionId, []);
    }
    this.sessionIndex.get(sessionId).push(monitoringId);

    return timeline;
  }

  /**
   * Record a change in a timeline
   * @param {string} monitoringId - Timeline ID
   * @param {Object} changeRecord - Change detection record
   */
  recordChange(monitoringId, changeRecord) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    // Add timestamp if missing
    if (!changeRecord.timestamp) {
      changeRecord.timestamp = new Date().toISOString();
    }

    // Assign change ID
    changeRecord.changeId = `chg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    timeline.changes.push(changeRecord);
    timeline.statistics.totalChanges++;

    // Update statistics
    this._updateStatistics(timeline);

    // Add to global event log
    this.eventLog.push({
      monitoringId,
      sessionId: timeline.sessionId,
      ...changeRecord
    });
  }

  /**
   * Add a page snapshot to timeline
   * @param {string} monitoringId - Timeline ID
   * @param {Object} snapshot - Page snapshot data
   * @param {number} timestamp - Snapshot timestamp (ms)
   */
  addSnapshot(monitoringId, snapshot, timestamp) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    timeline.snapshots.set(timestamp, snapshot);
  }

  /**
   * Get all changes in a timeline
   * @param {string} monitoringId - Timeline ID
   * @param {Object} options - Query options (timeWindow, types, etc.)
   * @returns {Object} Changes with metadata
   */
  getChanges(monitoringId, options = {}) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    let changes = [...timeline.changes];

    // Filter by time window
    if (options.timeWindow) {
      const [startTime, endTime] = options.timeWindow;
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();

      changes = changes.filter(c => {
        const ts = new Date(c.timestamp).getTime();
        return ts >= startMs && ts <= endMs;
      });
    }

    // Filter by change type
    if (options.changeTypes && Array.isArray(options.changeTypes)) {
      changes = changes.filter(c => options.changeTypes.includes(c.type));
    }

    // Filter by confidence threshold
    if (options.minConfidence !== undefined) {
      changes = changes.filter(c => c.confidence >= options.minConfidence);
    }

    // Sort by timestamp
    changes.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      monitoringId,
      changeCount: changes.length,
      changes,
      metadata: timeline.metadata,
      statistics: timeline.statistics,
      trend: timeline.trend,
      timeWindow: options.timeWindow || null
    };
  }

  /**
   * Get timeline data structure
   * @param {string} monitoringId - Timeline ID
   * @returns {Object} Chronological timeline view
   */
  getTimeline(monitoringId, bucketIntervalMs = 60000) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    const startTime = new Date(timeline.startTime).getTime();
    const currentTime = Date.now();
    const numBuckets = Math.ceil((currentTime - startTime) / bucketIntervalMs);

    const buckets = new Map();
    for (let i = 0; i < numBuckets; i++) {
      const bucketTime = startTime + (i * bucketIntervalMs);
      buckets.set(bucketTime, []);
    }

    // Distribute changes into buckets
    timeline.changes.forEach(change => {
      const changeTime = new Date(change.timestamp).getTime();
      const bucketIndex = Math.floor((changeTime - startTime) / bucketIntervalMs);
      const bucketTime = startTime + (bucketIndex * bucketIntervalMs);
      const bucket = buckets.get(bucketTime);
      if (bucket) {
        bucket.push(change.changeId);
      }
    });

    const timelineData = [];
    for (const [bucketTime, changeIds] of buckets) {
      if (changeIds.length > 0) {
        timelineData.push({
          timestamp: new Date(bucketTime).toISOString(),
          changeCount: changeIds.length,
          changes: changeIds
        });
      }
    }

    return {
      monitoringId,
      timelineData,
      bucketIntervalMs,
      totalBuckets: numBuckets,
      activeBuckets: timelineData.length,
      startTime: timeline.startTime,
      endTime: timeline.endTime || new Date().toISOString()
    };
  }

  /**
   * Compare changes across multiple sessions
   * @param {string[]} monitoringIds - Array of timeline IDs to compare
   * @returns {Object} Comparison analysis
   */
  compareTimelines(monitoringIds) {
    const timelines = monitoringIds.map(id => {
      const tl = this.timelines.get(id);
      if (!tl) {
        throw new Error(`Timeline not found: ${id}`);
      }
      return tl;
    });

    const comparison = {
      timelineCount: timelines.length,
      totalChanges: 0,
      changeBreakdown: {},
      timespan: {
        earliest: null,
        latest: null,
        duration: 0
      },
      patterns: {
        mostCommonChangeType: null,
        averageChangeRate: 0,
        peakActivityTime: null
      }
    };

    let earliestTime = Infinity;
    let latestTime = -Infinity;
    const changeTypeCounts = {};

    timelines.forEach(timeline => {
      comparison.totalChanges += timeline.changes.length;

      timeline.changes.forEach(change => {
        const changeTime = new Date(change.timestamp).getTime();
        earliestTime = Math.min(earliestTime, changeTime);
        latestTime = Math.max(latestTime, changeTime);

        const type = change.type || 'unknown';
        changeTypeCounts[type] = (changeTypeCounts[type] || 0) + 1;
      });
    });

    if (earliestTime !== Infinity) {
      comparison.timespan.earliest = new Date(earliestTime).toISOString();
      comparison.timespan.latest = new Date(latestTime).toISOString();
      comparison.timespan.duration = (latestTime - earliestTime) / 1000; // seconds
    }

    // Find most common change type
    let maxCount = 0;
    for (const [type, count] of Object.entries(changeTypeCounts)) {
      comparison.changeBreakdown[type] = count;
      if (count > maxCount) {
        maxCount = count;
        comparison.patterns.mostCommonChangeType = type;
      }
    }

    // Calculate change rate
    if (comparison.timespan.duration > 0) {
      comparison.patterns.averageChangeRate =
        (comparison.totalChanges / comparison.timespan.duration * 3600).toFixed(2); // changes per hour
    }

    return comparison;
  }

  /**
   * Analyze trend for a timeline
   * @param {string} monitoringId - Timeline ID
   * @param {number} windowSize - Number of recent changes to analyze
   * @returns {Object} Trend analysis
   */
  analyzeTrend(monitoringId, windowSize = 10) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    const allChanges = [...timeline.changes];
    if (allChanges.length === 0) {
      return { trend: 'STABLE', analysis: 'No changes recorded' };
    }

    // Divide into two windows
    const midpoint = Math.floor(allChanges.length / 2);
    const firstHalf = allChanges.slice(0, midpoint);
    const secondHalf = allChanges.slice(midpoint);

    const firstHalfRate = firstHalf.length;
    const secondHalfRate = secondHalf.length;

    let trend = 'STABLE';
    if (secondHalfRate > firstHalfRate * 1.2) {
      trend = 'DEGRADING'; // More changes recently
    } else if (secondHalfRate < firstHalfRate * 0.8) {
      trend = 'IMPROVING'; // Fewer changes recently
    }

    // Update timeline trend
    timeline.trend = trend;

    // Calculate confidence metrics
    const recentChanges = allChanges.slice(-windowSize);
    const avgConfidence = recentChanges.reduce((sum, c) => sum + (c.confidence || 0.8), 0) / recentChanges.length;
    const avgImpact = recentChanges.filter(c => c.impact === 'HIGH').length / recentChanges.length;

    return {
      trend,
      confidence: avgConfidence,
      recentActivityLevel: secondHalfRate,
      expectedChangeFrequency: `${((secondHalfRate / (allChanges.length - firstHalfRate)) * 100).toFixed(1)}%`,
      highImpactChanges: recentChanges.filter(c => c.impact === 'HIGH').length,
      analysis: this._generateTrendAnalysis(trend, avgConfidence, avgImpact)
    };
  }

  /**
   * Export timeline in multiple formats
   * @param {string} monitoringId - Timeline ID
   * @param {string} format - Export format (json, csv, html, markdown)
   * @param {Object} options - Export options
   * @returns {string} Exported data
   */
  exportTimeline(monitoringId, format = 'json', options = {}) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    const includeSnapshots = options.includeSnapshots !== false;
    const includeVisualDiffs = options.includeVisualDiffs === true;

    switch (format.toLowerCase()) {
    case 'json':
      return this._exportJSON(timeline, includeSnapshots, includeVisualDiffs);
    case 'csv':
      return this._exportCSV(timeline);
    case 'html':
      return this._exportHTML(timeline, includeSnapshots);
    case 'markdown':
      return this._exportMarkdown(timeline);
    default:
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Query changes across multiple sessions
   * @param {Object} query - Query parameters
   * @returns {Array} Matching events
   */
  queryEvents(query = {}) {
    let results = [...this.eventLog];

    // Filter by session ID
    if (query.sessionId) {
      results = results.filter(e => e.sessionId === query.sessionId);
    }

    // Filter by monitoring ID
    if (query.monitoringId) {
      results = results.filter(e => e.monitoringId === query.monitoringId);
    }

    // Filter by time range
    if (query.startTime && query.endTime) {
      const startMs = new Date(query.startTime).getTime();
      const endMs = new Date(query.endTime).getTime();
      results = results.filter(e => {
        const ts = new Date(e.timestamp).getTime();
        return ts >= startMs && ts <= endMs;
      });
    }

    // Filter by change type
    if (query.changeType) {
      results = results.filter(e => e.type === query.changeType);
    }

    // Filter by confidence
    if (query.minConfidence) {
      results = results.filter(e => e.confidence >= query.minConfidence);
    }

    // Sort by timestamp
    results.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Limit results
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Stop monitoring a timeline
   * @param {string} monitoringId - Timeline ID
   */
  stopMonitoring(monitoringId) {
    const timeline = this.timelines.get(monitoringId);
    if (!timeline) {
      throw new Error(`Timeline not found: ${monitoringId}`);
    }

    timeline.active = false;
    timeline.endTime = new Date().toISOString();
  }

  /**
   * Get all active timelines for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Active timelines
   */
  getSessionTimelines(sessionId) {
    const monitoringIds = this.sessionIndex.get(sessionId) || [];
    return monitoringIds
      .map(id => this.timelines.get(id))
      .filter(tl => tl && tl.active);
  }

  // ==================== PRIVATE METHODS ====================

  _updateStatistics(timeline) {
    const changes = timeline.changes;
    if (changes.length === 0) {
      return;
    }

    // Largest change
    timeline.statistics.largestChange = changes.reduce((max, c) =>
      (c.metadata?.changeSize || 0) > (max.metadata?.changeSize || 0) ? c : max
    );

    // Most frequent element
    const elementFreq = {};
    changes.forEach(c => {
      const elem = c.elementSelector || 'unknown';
      elementFreq[elem] = (elementFreq[elem] || 0) + 1;
    });
    timeline.statistics.mostFrequentElement =
      Object.entries(elementFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Time of most activity
    const timeFreq = {};
    changes.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      timeFreq[hour] = (timeFreq[hour] || 0) + 1;
    });
    const peakHour = Object.entries(timeFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (peakHour !== undefined) {
      timeline.statistics.timeOfMostActivity = `${peakHour}:00 UTC`;
    }

    // Change rate (changes per hour)
    const duration = (Date.now() - new Date(timeline.startTime).getTime()) / 3600000; // hours
    timeline.statistics.changeRate = duration > 0 ? (changes.length / duration).toFixed(2) : 0;
  }

  _generateTrendAnalysis(trend, confidence, impactRatio) {
    const descriptions = {
      'IMPROVING': `Changes are decreasing over time. Site appears stable. Confidence: ${(confidence * 100).toFixed(1)}%`,
      'STABLE': `Changes are occurring at a consistent rate. Normal activity detected. Confidence: ${(confidence * 100).toFixed(1)}%`,
      'DEGRADING': `Changes are increasing over time. Higher activity detected. ${(impactRatio * 100).toFixed(1)}% are high-impact changes.`
    };
    return descriptions[trend] || 'Unknown trend';
  }

  _exportJSON(timeline, includeSnapshots, includeVisualDiffs) {
    return JSON.stringify({
      id: timeline.id,
      sessionId: timeline.sessionId,
      startTime: timeline.startTime,
      endTime: timeline.endTime,
      metadata: timeline.metadata,
      changes: timeline.changes.map(c => ({
        ...c,
        visualDiff: includeVisualDiffs ? c.visualDiff : undefined
      })),
      statistics: timeline.statistics,
      trend: timeline.trend,
      snapshotCount: timeline.snapshots.size
    }, null, 2);
  }

  _exportCSV(timeline) {
    const header = 'timestamp,type,elementSelector,changeDescription,confidence,impact,diffType\n';
    const rows = timeline.changes.map(c =>
      `"${c.timestamp}","${c.type}","${c.elementSelector || ''}","${c.changeDescription || ''}",${c.confidence || 0},"${c.impact || 'MEDIUM'}","${c.diffType || ''}"`
    ).join('\n');
    return header + rows;
  }

  _exportHTML(timeline, includeSnapshots) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Change Timeline - ${timeline.metadata.url}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #2c3e50; color: white; padding: 20px; border-radius: 4px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .stat { background: white; padding: 15px; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #3498db; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    .timeline { position: relative; padding: 20px 0; }
    .event { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #3498db; border-radius: 4px; }
    .event.high-impact { border-left-color: #e74c3c; }
    .event-time { font-weight: bold; color: #2c3e50; }
    .event-type { display: inline-block; background: #ecf0f1; color: #2c3e50; padding: 3px 8px; border-radius: 3px; font-size: 12px; margin-left: 10px; }
    .confidence { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Change Timeline Report</h1>
    <p><strong>URL:</strong> ${timeline.metadata.url}</p>
    <p><strong>Monitoring Period:</strong> ${timeline.startTime} to ${timeline.endTime || 'Active'}</p>
  </div>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${timeline.statistics.totalChanges}</div>
      <div class="stat-label">Total Changes</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.statistics.changeRate}</div>
      <div class="stat-label">Changes/Hour</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.trend}</div>
      <div class="stat-label">Trend</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.statistics.mostFrequentElement || 'N/A'}</div>
      <div class="stat-label">Most Changed Element</div>
    </div>
  </div>

  <div class="timeline">
    ${timeline.changes.map(change => `
      <div class="event ${change.impact === 'HIGH' ? 'high-impact' : ''}">
        <div class="event-time">${change.timestamp}</div>
        <div>
          <strong>${change.changeDescription || change.type}</strong>
          <span class="event-type">${change.type}</span>
          ${change.elementSelector ? `<span class="event-type">${change.elementSelector}</span>` : ''}
        </div>
        <div class="confidence">Confidence: ${((change.confidence || 0) * 100).toFixed(0)}% | Impact: ${change.impact || 'MEDIUM'}</div>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;
    return html;
  }

  _exportMarkdown(timeline) {
    const md = `# Change Timeline Report

**URL:** ${timeline.metadata.url}
**Monitoring Period:** ${timeline.startTime} to ${timeline.endTime || 'Active'}

## Summary

| Metric | Value |
|--------|-------|
| Total Changes | ${timeline.statistics.totalChanges} |
| Change Rate | ${timeline.statistics.changeRate} changes/hour |
| Trend | ${timeline.trend} |
| Most Changed Element | ${timeline.statistics.mostFrequentElement || 'N/A'} |

## Changes

${timeline.changes.map((c, i) => `
### Change ${i + 1}
- **Time:** ${c.timestamp}
- **Type:** ${c.type}
- **Description:** ${c.changeDescription || 'No description'}
- **Element:** ${c.elementSelector || 'N/A'}
- **Confidence:** ${((c.confidence || 0) * 100).toFixed(0)}%
- **Impact:** ${c.impact || 'MEDIUM'}
`).join('\n')}
    `;
    return md;
  }
}

// Export both class and singleton instance
module.exports = {
  TimelineGenerator,
  timelineGenerator: new TimelineGenerator()
};
