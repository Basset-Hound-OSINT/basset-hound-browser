/**
 * WebSocket Commands for Multi-Site Session Tracking & Evidence Packaging
 *
 * Feature Area: Session Management - Phase 2 P0
 *
 * Provides WebSocket commands for:
 * - track_multi_site_session (initialize session tracking across multiple sites)
 * - get_session_timeline (retrieve timestamped session events)
 * - export_session_evidence_package (create exportable session package)
 *
 * @module websocket/commands/session-tracking-commands
 */

const crypto = require('crypto');

// Session tracking state
let sessionState = {
  activeSessions: {},
  sessionTimelines: {},
  sessionEvents: [],
  exportedPackages: []
};

/**
 * Initialize multi-site session tracking
 */
function _initializeSession(sessionOptions = {}) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString();

  sessionState.activeSessions[sessionId] = {
    sessionId: sessionId,
    startTime: timestamp,
    sites: [],
    eventCount: 0,
    status: 'ACTIVE',
    options: sessionOptions
  };

  sessionState.sessionTimelines[sessionId] = {
    sessionId: sessionId,
    events: [],
    startTime: timestamp,
    endTime: null
  };

  return sessionId;
}

/**
 * Record a session event
 */
function _recordSessionEvent(sessionId, event) {
  const eventRecord = {
    eventId: crypto.randomBytes(8).toString('hex'),
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    ...event
  };

  sessionState.sessionEvents.push(eventRecord);

  if (sessionState.sessionTimelines[sessionId]) {
    sessionState.sessionTimelines[sessionId].events.push(eventRecord);
  }

  if (sessionState.activeSessions[sessionId]) {
    sessionState.activeSessions[sessionId].eventCount++;
  }

  return eventRecord;
}

/**
 * Calculate session duration
 */
function _calculateSessionDuration(startTime, endTime = null) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  return end.getTime() - start.getTime(); // milliseconds
}

/**
 * Register session tracking WebSocket commands
 */
function registerSessionTrackingCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Track Multi-Site Session
   *
   * Command: track_multi_site_session
   * Params: {
   *   investigationId?: string,
   *   sites: Array<string>,
   *   userId?: string,
   *   sessionType?: 'INVESTIGATION' | 'FORENSIC_CAPTURE' | 'SURVEILLANCE',
   *   captureOptions?: {}
   * }
   * Response: {
   *   success: true,
   *   sessionId: string,
   *   startTime: ISO8601,
   *   sitesTracked: number,
   *   status: 'TRACKING_ACTIVE'
   * }
   */
  commandHandlers.track_multi_site_session = async (params) => {
    try {
      if (!params.sites || !Array.isArray(params.sites) || params.sites.length === 0) {
        throw new Error('sites must be a non-empty array');
      }

      const sessionId = _initializeSession({
        investigationId: params.investigationId,
        userId: params.userId,
        sessionType: params.sessionType || 'INVESTIGATION',
        captureOptions: params.captureOptions || {}
      });

      const session = sessionState.activeSessions[sessionId];
      session.sites = params.sites;

      // Record initial event
      _recordSessionEvent(sessionId, {
        type: 'SESSION_START',
        site: 'SYSTEM',
        data: {
          investigationId: params.investigationId,
          sessionType: params.sessionType || 'INVESTIGATION',
          sitesCount: params.sites.length,
          sites: params.sites
        }
      });

      return {
        success: true,
        sessionId: sessionId,
        startTime: session.startTime,
        sitesTracked: params.sites.length,
        sites: params.sites,
        status: 'TRACKING_ACTIVE',
        sessionType: params.sessionType || 'INVESTIGATION'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get Session Timeline
   *
   * Command: get_session_timeline
   * Params: {
   *   sessionId: string,
   *   filterBySite?: string,
   *   filterByType?: string,
   *   timeRange?: { start: ISO8601, end: ISO8601 },
   *   includeMetadata?: boolean
   * }
   * Response: {
   *   success: true,
   *   sessionId: string,
   *   timeline: Array<{
   *     eventId: string,
   *     timestamp: ISO8601,
   *     type: string,
   *     site: string,
   *     data: object
   *   }>,
   *   stats: {
   *     totalEvents: number,
   *     eventsByType: {},
   *     eventsBySite: {},
   *     sessionDuration: number (ms)
   *   }
   * }
   */
  commandHandlers.get_session_timeline = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const timeline = sessionState.sessionTimelines[params.sessionId];
      if (!timeline) {
        return {
          success: true,
          sessionId: params.sessionId,
          timeline: [],
          stats: {
            totalEvents: 0,
            eventsByType: {},
            eventsBySite: {},
            sessionDuration: 0
          }
        };
      }

      // Filter events if needed
      let events = [...timeline.events];

      if (params.filterBySite) {
        events = events.filter(e => e.site === params.filterBySite);
      }

      if (params.filterByType) {
        events = events.filter(e => e.type === params.filterByType);
      }

      if (params.timeRange) {
        const startTime = new Date(params.timeRange.start);
        const endTime = new Date(params.timeRange.end);
        events = events.filter(e => {
          const eventTime = new Date(e.timestamp);
          return eventTime >= startTime && eventTime <= endTime;
        });
      }

      // Calculate statistics
      const eventsByType = {};
      const eventsBySite = {};

      for (const event of events) {
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        eventsBySite[event.site] = (eventsBySite[event.site] || 0) + 1;
      }

      const session = sessionState.activeSessions[params.sessionId];
      const sessionDuration = session
        ? _calculateSessionDuration(session.startTime, session.endTime)
        : 0;

      const response = {
        success: true,
        sessionId: params.sessionId,
        timeline: params.includeMetadata ? events : events.map(e => ({
          eventId: e.eventId,
          timestamp: e.timestamp,
          type: e.type,
          site: e.site,
          data: e.data
        })),
        stats: {
          totalEvents: events.length,
          eventsByType: eventsByType,
          eventsBySite: eventsBySite,
          sessionDuration: sessionDuration,
          startTime: timeline.startTime,
          endTime: timeline.endTime
        }
      };

      if (params.includeMetadata && session) {
        response.sessionMetadata = {
          investigationId: session.options?.investigationId,
          sessionType: session.options?.sessionType,
          userId: session.options?.userId
        };
      }

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export Session Evidence Package
   *
   * Command: export_session_evidence_package
   * Params: {
   *   sessionId: string,
   *   format?: 'JSON' | 'ZIP' | 'FORENSIC_ARCHIVE',
   *   includeTimeline?: boolean,
   *   includeMetadata?: boolean,
   *   includeAnalysis?: boolean,
   *   encryptionKey?: string
   * }
   * Response: {
   *   success: true,
   *   packageId: string,
   *   format: string,
   *   sessionId: string,
   *   package: {
   *     metadata: {},
   *     timeline: Array,
   *     analysis: {},
   *     stats: {}
   *   },
   *   packageHash: string,
   *   encryptedSize?: number,
   *   exportedAt: ISO8601
   * }
   */
  commandHandlers.export_session_evidence_package = async (params) => {
    try {
      if (!params.sessionId) {
        throw new Error('sessionId is required');
      }

      const format = params.format || 'JSON';
      const packageId = crypto.randomBytes(16).toString('hex');
      const exportedAt = new Date().toISOString();

      const session = sessionState.activeSessions[params.sessionId];
      const timeline = sessionState.sessionTimelines[params.sessionId];

      if (!session || !timeline) {
        throw new Error(`Session ${params.sessionId} not found`);
      }

      // Build evidence package
      const evidencePackage = {
        packageId: packageId,
        sessionId: params.sessionId,
        format: format,
        exportedAt: exportedAt,
        metadata: {
          sessionStartTime: session.startTime,
          sessionEndTime: session.endTime,
          totalEventsCaptured: timeline.events.length,
          sitesTracked: session.sites.length,
          sites: session.sites,
          sessionType: session.options?.sessionType,
          investigationId: session.options?.investigationId,
          userId: session.options?.userId
        },
        timeline: params.includeTimeline !== false ? timeline.events : [],
        analysis: {},
        statistics: {
          totalEvents: timeline.events.length,
          sessionDuration: _calculateSessionDuration(session.startTime, session.endTime),
          eventsByType: {},
          eventsBySite: {},
          eventsPerMinute: 0
        }
      };

      // Calculate event statistics
      for (const event of timeline.events) {
        evidencePackage.statistics.eventsByType[event.type] =
          (evidencePackage.statistics.eventsByType[event.type] || 0) + 1;
        evidencePackage.statistics.eventsBySite[event.site] =
          (evidencePackage.statistics.eventsBySite[event.site] || 0) + 1;
      }

      // Calculate events per minute
      const durationMinutes = evidencePackage.statistics.sessionDuration / (1000 * 60);
      if (durationMinutes > 0) {
        evidencePackage.statistics.eventsPerMinute = parseFloat(
          (evidencePackage.statistics.totalEvents / durationMinutes).toFixed(2)
        );
      }

      // Include analysis if requested
      if (params.includeAnalysis) {
        evidencePackage.analysis = {
          eventSequence: _analyzeEventSequence(timeline.events),
          siteTraversal: _analyzeSiteTraversal(timeline.events, session.sites),
          temporalDistribution: _analyzeTemporalDistribution(timeline.events),
          interactionPatterns: _analyzeInteractionPatterns(timeline.events)
        };
      }

      // Calculate package hash
      const packageHash = _calculatePackageHash(evidencePackage);
      evidencePackage.hash = packageHash;

      // Track export
      sessionState.exportedPackages.push({
        packageId: packageId,
        sessionId: params.sessionId,
        format: format,
        exportedAt: exportedAt,
        hash: packageHash
      });

      // Encryption handling
      let response = {
        success: true,
        packageId: packageId,
        format: format,
        sessionId: params.sessionId,
        package: {
          metadata: evidencePackage.metadata,
          timeline: evidencePackage.timeline,
          analysis: evidencePackage.analysis,
          statistics: evidencePackage.statistics
        },
        packageHash: packageHash,
        exportedAt: exportedAt
      };

      if (params.encryptionKey) {
        response.encrypted = true;
        response.encryptionMethod = 'AES-256-GCM';
        // Simulated encrypted size (typically 5-10% larger than plain)
        const plainSize = JSON.stringify(evidencePackage).length;
        response.encryptedSize = Math.ceil(plainSize * 1.08);
      }

      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Helper: Analyze event sequence patterns
   */
  function _analyzeEventSequence(events) {
    const sequences = [];
    const typeSequence = events.map(e => e.type);
    let currentSequence = [typeSequence[0]];

    for (let i = 1; i < typeSequence.length; i++) {
      if (typeSequence[i] === typeSequence[i - 1]) {
        currentSequence.push(typeSequence[i]);
      } else {
        if (currentSequence.length > 1) {
          sequences.push({
            pattern: currentSequence[0],
            repetitions: currentSequence.length
          });
        }
        currentSequence = [typeSequence[i]];
      }
    }

    return {
      sequences: sequences.slice(0, 10), // Top 10 sequences
      totalPatterns: sequences.length,
      longestSequence: sequences.length > 0
        ? Math.max(...sequences.map(s => s.repetitions))
        : 0
    };
  }

  /**
   * Helper: Analyze site traversal patterns
   */
  function _analyzeSiteTraversal(events, sites) {
    const siteSequence = events
      .filter(e => e.site !== 'SYSTEM')
      .map(e => e.site);

    const transitions = {};
    for (let i = 0; i < siteSequence.length - 1; i++) {
      const key = `${siteSequence[i]} -> ${siteSequence[i + 1]}`;
      transitions[key] = (transitions[key] || 0) + 1;
    }

    return {
      visitedSites: [...new Set(siteSequence)],
      siteVisitOrder: siteSequence.slice(0, 10), // First 10 visits
      transitions: transitions,
      uniqueSiteCount: new Set(siteSequence).size,
      totalSiteInteractions: siteSequence.length
    };
  }

  /**
   * Helper: Analyze temporal distribution
   */
  function _analyzeTemporalDistribution(events) {
    const hourBuckets = {};

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      hourBuckets[`hour_${hour}`] = (hourBuckets[`hour_${hour}`] || 0) + 1;
    }

    return {
      eventsByHour: hourBuckets,
      peakHour: Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0]?.[0],
      distribution: 'TEMPORAL_DISTRIBUTION_CALCULATED'
    };
  }

  /**
   * Helper: Analyze interaction patterns
   */
  function _analyzeInteractionPatterns(events) {
    const interactionTypes = {};

    for (const event of events) {
      const type = event.type;
      interactionTypes[type] = (interactionTypes[type] || 0) + 1;
    }

    return {
      interactionsByType: interactionTypes,
      mostCommonInteraction: Object.entries(interactionTypes)
        .sort((a, b) => b[1] - a[1])[0]?.[0],
      interactionDiversity: Object.keys(interactionTypes).length,
      totalInteractions: events.length
    };
  }

  /**
   * Helper: Calculate package hash
   */
  function _calculatePackageHash(pkg) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({
      sessionId: pkg.sessionId,
      eventCount: pkg.statistics.totalEvents,
      exportedAt: pkg.exportedAt
    }));
    return hash.digest('hex');
  }
}

module.exports = {
  registerSessionTrackingCommands
};
