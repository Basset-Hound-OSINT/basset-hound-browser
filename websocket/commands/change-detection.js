/**
 * Basset Hound Browser - WebSocket Commands for Change Detection & Timeline
 * Handles multi-session change monitoring and timeline management
 */

// Import both classes and singletons
const changeDetectorModule = require('../../src/analysis/change-detector');
const changeDetectorSingleton = changeDetectorModule;
const { ChangeDetector } = changeDetectorModule;

const { TimelineGenerator, timelineGenerator: timelineGeneratorSingleton } = require('../../src/analysis/timeline-generator');

// Singleton instances
let changeDetector = changeDetectorSingleton;
let timelineGenerator = timelineGeneratorSingleton;
const monitoringSessions = new Map(); // monitoringId -> session state

/**
 * Initialize change detection handlers
 * @param {Object} managers - Managers object from server
 */
function initializeChangeDetection(managers) {
  if (managers && managers.changeDetector) {
    changeDetector = managers.changeDetector;
  }
  if (managers && managers.timelineGenerator) {
    timelineGenerator = managers.timelineGenerator;
  }
}

const commandHandlers = {};

/**
 * Start monitoring a page for changes
 * Command: enable_change_tracking
 *
 * Params:
 * - sessionId (string): Browser session ID
 * - url (string): URL to monitor
 * - monitoringIntervalMs (number): Check interval in milliseconds (default: 30000)
 * - trackedElements (array): What to track (dom, content, layout, images, scripts, styles)
 * - sensitivityLevel (string): low, medium, high
 *
 * Response: { monitoringId, active, interval, trackedElements }
 */
commandHandlers.enable_change_tracking = async (params, webContents) => {
  try {
    const {
      sessionId,
      url,
      monitoringIntervalMs = 30000,
      trackedElements = ['dom', 'content', 'layout'],
      sensitivityLevel = 'medium'
    } = params;

    if (!sessionId || !url) {
      throw new Error('sessionId and url are required');
    }

    // Create unique monitoring ID
    const monitoringId = `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create timeline
    const timeline = timelineGenerator.createTimeline(monitoringId, sessionId, {
      url,
      monitoringIntervalMs,
      trackedElements,
      sensitivityLevel
    });

    // Create initial snapshot
    const initialSnapshot = await changeDetector.createSnapshot(webContents, url);
    timelineGenerator.addSnapshot(monitoringId, initialSnapshot, Date.now());

    // Store session state
    const session = {
      monitoringId,
      sessionId,
      url,
      webContents,
      interval: null,
      lastSnapshot: initialSnapshot,
      nextCheckTime: Date.now() + monitoringIntervalMs,
      paused: false
    };

    monitoringSessions.set(monitoringId, session);

    // Start periodic monitoring
    if (params.autoStart !== false) {
      _startMonitoring(monitoringId, monitoringIntervalMs);
    }

    return {
      success: true,
      data: {
        monitoringId,
        sessionId,
        url,
        active: true,
        interval: monitoringIntervalMs,
        trackedElements,
        startTime: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Detect changes between two snapshots
 * Command: detect_changes
 *
 * Params:
 * - sessionId (string): Browser session ID
 * - url (string): URL being monitored
 * - compareWith (string): 'last' or snapshot ID to compare against
 *
 * Response: { changes: [], changeCount, timeline }
 */
commandHandlers.detect_changes = async (params, webContents) => {
  try {
    const { sessionId, url, compareWith = 'last' } = params;

    if (!sessionId || !url) {
      throw new Error('sessionId and url are required');
    }

    // Create current snapshot
    const currentSnapshot = await changeDetector.createSnapshot(webContents, url);

    // Compare with previous or specified snapshot
    let diff;
    if (compareWith === 'last') {
      diff = changeDetector.compareSnapshots(url, url); // Compares last two
    } else {
      diff = changeDetector.compareSnapshots(compareWith, url);
    }

    // Get monitoring sessions for this session/URL
    const relevantMonitoring = Array.from(monitoringSessions.values())
      .filter(s => s.sessionId === sessionId && s.url === url);

    const changes = [];
    if (diff.overall_changed) {
      // Parse detailed changes
      Object.entries(diff.changes).forEach(([changeType, changeData]) => {
        if (changeData === true || (typeof changeData === 'object' && changeData)) {
          changes.push({
            timestamp: new Date().toISOString(),
            type: changeType,
            detected: true,
            details: changeData
          });
        }
      });
    }

    return {
      success: true,
      data: {
        url,
        changeDetected: diff.overall_changed,
        changePercentage: parseFloat(diff.change_percentage),
        changeCount: changes.length,
        changes,
        timeSinceLastCheck: diff.time_difference_seconds,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get timeline of all changes for a monitoring session
 * Command: get_timeline
 *
 * Params:
 * - monitoringId (string): Monitoring session ID
 * - timeWindow (array): [startTime, endTime] ISO timestamps (optional)
 * - changeTypes (array): Filter by change types (optional)
 *
 * Response: { timeline, changeCount, statistics, trend }
 */
commandHandlers.get_timeline = async (params) => {
  try {
    const { monitoringId, timeWindow, changeTypes, minConfidence } = params;

    if (!monitoringId) {
      throw new Error('monitoringId is required');
    }

    const options = {};
    if (timeWindow) {
      options.timeWindow = timeWindow;
    }
    if (changeTypes) {
      options.changeTypes = changeTypes;
    }
    if (minConfidence !== undefined) {
      options.minConfidence = minConfidence;
    }

    const changesData = timelineGenerator.getChanges(monitoringId, options);
    const timelineData = timelineGenerator.getTimeline(monitoringId);

    return {
      success: true,
      data: {
        monitoringId,
        changeCount: changesData.changeCount,
        changes: changesData.changes,
        timeline: timelineData.timelineData,
        statistics: changesData.statistics,
        trend: changesData.trend,
        metadata: changesData.metadata
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Compare changes across multiple monitoring sessions
 * Command: compare_sessions
 *
 * Params:
 * - monitoringIds (array): Array of monitoring IDs to compare
 *
 * Response: { comparison details }
 */
commandHandlers.compare_sessions = async (params) => {
  try {
    const { monitoringIds } = params;

    if (!Array.isArray(monitoringIds) || monitoringIds.length < 2) {
      throw new Error('At least 2 monitoringIds required for comparison');
    }

    const comparison = timelineGenerator.compareTimelines(monitoringIds);
    const trends = {};

    monitoringIds.forEach(id => {
      trends[id] = timelineGenerator.analyzeTrend(id);
    });

    return {
      success: true,
      data: {
        monitoringCount: monitoringIds.length,
        comparison,
        trends,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Export timeline in various formats
 * Command: export_timeline
 *
 * Params:
 * - monitoringId (string): Monitoring ID
 * - format (string): json, csv, html, markdown
 * - includeSnapshots (boolean): Include snapshot data
 * - includeVisualDiffs (boolean): Include visual diff images
 *
 * Response: { fileName, content, format }
 */
commandHandlers.export_timeline = async (params) => {
  try {
    const {
      monitoringId,
      format = 'json',
      includeSnapshots = false,
      includeVisualDiffs = false
    } = params;

    if (!monitoringId) {
      throw new Error('monitoringId is required');
    }

    const content = timelineGenerator.exportTimeline(monitoringId, format, {
      includeSnapshots,
      includeVisualDiffs
    });

    const fileExtensions = {
      json: 'json',
      csv: 'csv',
      html: 'html',
      markdown: 'md'
    };

    const extension = fileExtensions[format] || format;
    const fileName = `change_timeline_${monitoringId}.${extension}`;

    return {
      success: true,
      data: {
        fileName,
        format,
        content,
        exported: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Stop monitoring a session
 * Command: stop_change_monitoring
 *
 * Params:
 * - monitoringId (string): Monitoring ID
 *
 * Response: { monitoringId, stoppedAt }
 */
commandHandlers.stop_change_monitoring = async (params) => {
  try {
    const { monitoringId } = params;

    if (!monitoringId) {
      throw new Error('monitoringId is required');
    }

    const session = monitoringSessions.get(monitoringId);
    if (!session) {
      throw new Error(`Monitoring session not found: ${monitoringId}`);
    }

    // Clear interval
    if (session.interval) {
      clearInterval(session.interval);
    }

    // Update timeline
    timelineGenerator.stopMonitoring(monitoringId);

    // Remove session
    monitoringSessions.delete(monitoringId);

    return {
      success: true,
      data: {
        monitoringId,
        stopped: true,
        stoppedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all active monitoring sessions for a browser session
 * Command: list_active_monitoring
 *
 * Params:
 * - sessionId (string): Browser session ID
 *
 * Response: { sessions: [] }
 */
commandHandlers.list_active_monitoring = async (params) => {
  try {
    const { sessionId } = params;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const activeSessions = Array.from(monitoringSessions.values())
      .filter(s => s.sessionId === sessionId)
      .map(s => ({
        monitoringId: s.monitoringId,
        url: s.url,
        active: !s.paused,
        changeCount: timelineGenerator.timelines.get(s.monitoringId)?.statistics.totalChanges || 0
      }));

    return {
      success: true,
      data: {
        sessionId,
        count: activeSessions.length,
        sessions: activeSessions
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Query changes across sessions
 * Command: query_changes
 *
 * Params:
 * - sessionId (string): Filter by session
 * - monitoringId (string): Filter by monitoring ID
 * - startTime (string): ISO timestamp
 * - endTime (string): ISO timestamp
 * - changeType (string): Filter by change type
 * - minConfidence (number): Minimum confidence (0-1)
 * - limit (number): Max results
 *
 * Response: { events: [], count }
 */
commandHandlers.query_changes = async (params) => {
  try {
    const events = timelineGenerator.queryEvents(params);

    return {
      success: true,
      data: {
        count: events.length,
        events,
        query: params,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get trend analysis for a timeline
 * Command: analyze_change_trend
 *
 * Params:
 * - monitoringId (string): Monitoring ID
 * - windowSize (number): Analysis window (default: 10)
 *
 * Response: { trend, confidence, analysis }
 */
commandHandlers.analyze_change_trend = async (params) => {
  try {
    const { monitoringId, windowSize = 10 } = params;

    if (!monitoringId) {
      throw new Error('monitoringId is required');
    }

    const trendAnalysis = timelineGenerator.analyzeTrend(monitoringId, windowSize);

    return {
      success: true,
      data: {
        monitoringId,
        ...trendAnalysis,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// ==================== PRIVATE FUNCTIONS ====================

/**
 * Start periodic monitoring for a session
 */
function _startMonitoring(monitoringId, intervalMs) {
  const session = monitoringSessions.get(monitoringId);
  if (!session) {
    return;
  }

  const checkChanges = async () => {
    try {
      if (session.paused || !session.webContents) {
        return;
      }

      const newSnapshot = await changeDetector.createSnapshot(session.webContents, session.url);
      const diff = changeDetector.compareSnapshots(session.url, session.url);

      if (diff.overall_changed) {
        const change = {
          timestamp: new Date().toISOString(),
          type: 'page_change',
          changeDescription: `Change detected (${diff.change_percentage}% modified)`,
          elementSelector: null,
          elementPath: [],
          beforeSnapshot: { contentHash: session.lastSnapshot.hash },
          afterSnapshot: { contentHash: newSnapshot.hash },
          diffType: 'modification',
          confidence: Math.min(1, parseFloat(diff.change_percentage) / 100),
          impact: parseFloat(diff.change_percentage) > 50 ? 'HIGH' : 'MEDIUM',
          metadata: {
            changeSize: 0,
            percentageChange: parseFloat(diff.change_percentage)
          }
        };

        timelineGenerator.recordChange(monitoringId, change);
      }

      session.lastSnapshot = newSnapshot;
      session.nextCheckTime = Date.now() + intervalMs;
    } catch (error) {
      console.error(`Error in change monitoring for ${monitoringId}:`, error);
    }
  };

  // Run immediately first
  checkChanges();

  // Schedule recurring checks
  session.interval = setInterval(checkChanges, intervalMs);
}

module.exports = {
  commandHandlers,
  initializeChangeDetection
};
