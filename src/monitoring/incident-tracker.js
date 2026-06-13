/**
 * Incident Tracking and Management
 *
 * Tracks:
 * - Auto-create incidents from critical alerts
 * - Incident timeline and context
 * - Resolution tracking
 * - Post-mortem documentation
 * - Metrics and trends analysis
 *
 * @module src/monitoring/incident-tracker
 * @requires events
 * @requires fs
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Incident Status
 */
const INCIDENT_STATUS = {
  CREATED: 'created',
  ACKNOWLEDGED: 'acknowledged',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

/**
 * Incident Impact Level
 */
const IMPACT_LEVEL = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Incident Tracker
 * Manages incident lifecycle and documentation
 */
class IncidentTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), '.basset-hound', 'incidents'),
      autoCreateFromAlerts: options.autoCreateFromAlerts !== false,
      alertThreshold: options.alertThreshold || 'high', // Alert severity threshold for auto-creation
      ...options
    };

    // Incident storage
    this.incidents = new Map();
    this.events = new Map(); // Timeline of events
    this.postMortems = new Map();

    // Counter
    this.incidentCounter = 1;

    // Ensure data directory exists
    this._ensureDataDir();
  }

  /**
   * Ensure data directory exists
   * @private
   */
  _ensureDataDir() {
    try {
      if (!fs.existsSync(this.options.dataDir)) {
        fs.mkdirSync(this.options.dataDir, { recursive: true });
      }
    } catch (e) {
      this.emit('error', {
        message: 'Failed to create incidents directory',
        error: e.message
      });
    }
  }

  /**
   * Create an incident from alert
   */
  createIncidentFromAlert(alert) {
    // Check if incident should be auto-created
    if (!this.options.autoCreateFromAlerts) {
      return null;
    }

    // Check severity threshold
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const thresholdOrder = severityOrder[this.options.alertThreshold];

    if (severityOrder[alert.severity] > thresholdOrder) {
      return null; // Alert not severe enough
    }

    // Check if incident already exists for this alert
    const existingIncident = this._findIncidentByAlert(alert);
    if (existingIncident) {
      // Add event to existing incident
      this.addEvent(existingIncident.id, {
        type: 'alert_triggered',
        alert,
        description: `Alert triggered: ${alert.description}`
      });
      return existingIncident;
    }

    // Create new incident
    const incident = {
      id: `INC-${String(this.incidentCounter).padStart(6, '0')}`,
      title: alert.ruleName,
      description: alert.description,
      severity: alert.severity,
      impact: this._mapAlertSeverityToImpact(alert.severity),
      status: INCIDENT_STATUS.CREATED,
      createdAt: Date.now(),
      createdBy: 'automated',
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      closedBy: null,
      duration: 0,
      metrics: {},
      events: [],
      assignee: null,
      tags: ['auto-created', alert.severity],
      relatedAlerts: [alert.ruleId]
    };

    this.incidents.set(incident.id, incident);
    this.incidentCounter++;

    // Add initial event
    this.addEvent(incident.id, {
      type: 'created',
      author: 'system',
      description: 'Incident auto-created from alert'
    });

    this.emit('incident:created', incident);
    return incident;
  }

  /**
   * Create a manual incident
   */
  createManualIncident(config) {
    const incident = {
      id: `INC-${String(this.incidentCounter).padStart(6, '0')}`,
      title: config.title,
      description: config.description,
      severity: config.severity || 'high',
      impact: config.impact || IMPACT_LEVEL.HIGH,
      status: INCIDENT_STATUS.CREATED,
      createdAt: Date.now(),
      createdBy: config.createdBy || 'manual',
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      closedBy: null,
      duration: 0,
      metrics: config.metrics || {},
      events: [],
      assignee: config.assignee || null,
      tags: config.tags || [],
      relatedAlerts: config.relatedAlerts || []
    };

    this.incidents.set(incident.id, incident);
    this.incidentCounter++;

    this.addEvent(incident.id, {
      type: 'created',
      author: config.createdBy || 'system',
      description: 'Manual incident created'
    });

    this.emit('incident:created', incident);
    return incident;
  }

  /**
   * Acknowledge an incident
   */
  acknowledgeIncident(incidentId, acknowledgedBy) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    incident.status = INCIDENT_STATUS.ACKNOWLEDGED;
    incident.acknowledgedAt = Date.now();
    incident.acknowledgedBy = acknowledgedBy;

    this.addEvent(incidentId, {
      type: 'acknowledged',
      author: acknowledgedBy,
      description: `Incident acknowledged by ${acknowledgedBy}`
    });

    this.emit('incident:acknowledged', { incidentId, acknowledgedBy });
    return incident;
  }

  /**
   * Update incident status
   */
  updateIncidentStatus(incidentId, newStatus, updatedBy) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const oldStatus = incident.status;
    incident.status = newStatus;

    if (newStatus === INCIDENT_STATUS.IN_PROGRESS && !incident.acknowledgedAt) {
      incident.acknowledgedAt = Date.now();
      incident.acknowledgedBy = updatedBy;
    }

    this.addEvent(incidentId, {
      type: 'status_changed',
      author: updatedBy,
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      metadata: { oldStatus, newStatus }
    });

    this.emit('incident:status_changed', { incidentId, oldStatus, newStatus });
    return incident;
  }

  /**
   * Resolve an incident
   */
  resolveIncident(incidentId, resolution, resolvedBy) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    incident.status = INCIDENT_STATUS.RESOLVED;
    incident.resolvedAt = Date.now();
    incident.resolvedBy = resolvedBy;
    incident.duration = incident.resolvedAt - incident.createdAt;

    this.addEvent(incidentId, {
      type: 'resolved',
      author: resolvedBy,
      description: `Incident resolved by ${resolvedBy}: ${resolution}`
    });

    this.emit('incident:resolved', {
      incidentId,
      resolution,
      duration: incident.duration,
      resolvedBy
    });

    return incident;
  }

  /**
   * Close an incident
   */
  closeIncident(incidentId, closedBy) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    incident.status = INCIDENT_STATUS.CLOSED;
    incident.closedAt = Date.now();
    incident.closedBy = closedBy;

    this.addEvent(incidentId, {
      type: 'closed',
      author: closedBy,
      description: `Incident closed by ${closedBy}`
    });

    // Save incident to disk
    this._saveIncident(incident);

    this.emit('incident:closed', { incidentId, closedBy });
    return incident;
  }

  /**
   * Add event to incident
   */
  addEvent(incidentId, eventConfig) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const event = {
      id: `${incidentId}-EVT-${incident.events.length}`,
      timestamp: Date.now(),
      type: eventConfig.type || 'event',
      author: eventConfig.author || 'system',
      description: eventConfig.description || '',
      metadata: eventConfig.metadata || {}
    };

    incident.events.push(event);
    this.emit('incident:event_added', { incidentId, event });

    return event;
  }

  /**
   * Get incident timeline
   */
  getIncidentTimeline(incidentId) {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    return {
      incidentId,
      title: incident.title,
      duration: incident.duration || (Date.now() - incident.createdAt),
      status: incident.status,
      events: incident.events.map(event => ({
        timestamp: event.timestamp,
        type: event.type,
        author: event.author,
        description: event.description
      }))
    };
  }

  /**
   * Create post-mortem
   */
  createPostMortem(incidentId, config) {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const postMortem = {
      incidentId,
      title: config.title || incident.title,
      summary: config.summary || '',
      timeline: this.getIncidentTimeline(incidentId),
      rootCause: config.rootCause || '',
      impactAnalysis: config.impactAnalysis || {},
      preventiveMeasures: config.preventiveMeasures || [],
      followUpActions: config.followUpActions || [],
      createdAt: Date.now(),
      createdBy: config.createdBy || 'system',
      reviewedAt: null,
      reviewedBy: null,
      approved: false
    };

    this.postMortems.set(incidentId, postMortem);

    this.addEvent(incidentId, {
      type: 'post_mortem_created',
      author: config.createdBy || 'system',
      description: 'Post-mortem documentation created'
    });

    this.emit('post_mortem:created', postMortem);
    this._savePostMortem(postMortem);

    return postMortem;
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId) {
    return this.incidents.get(incidentId) || null;
  }

  /**
   * Get all incidents
   */
  getAllIncidents(filter = {}) {
    let incidents = Array.from(this.incidents.values());

    // Apply filters
    if (filter.status) {
      incidents = incidents.filter(i => i.status === filter.status);
    }

    if (filter.severity) {
      incidents = incidents.filter(i => i.severity === filter.severity);
    }

    if (filter.assignee) {
      incidents = incidents.filter(i => i.assignee === filter.assignee);
    }

    // Sort by created date descending
    return incidents.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get open incidents
   */
  getOpenIncidents() {
    return this.getAllIncidents({
      status: [INCIDENT_STATUS.CREATED, INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.IN_PROGRESS]
    }).filter(i => [INCIDENT_STATUS.CREATED, INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.IN_PROGRESS].includes(i.status));
  }

  /**
   * Get incident statistics
   */
  getStatistics(days = 30) {
    const cutoff = Date.now() - (days * 24 * 3600 * 1000);
    const relevantIncidents = Array.from(this.incidents.values())
      .filter(i => i.createdAt > cutoff);

    const stats = {
      total: relevantIncidents.length,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      byStatus: { created: 0, acknowledged: 0, in_progress: 0, resolved: 0, closed: 0 },
      avgResolutionTime: 0,
      avgDuration: 0,
      criticalCount: 0
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let totalDuration = 0;

    for (const incident of relevantIncidents) {
      stats.bySeverity[incident.severity]++;

      const status = incident.status.toLowerCase().replace(/\s+/g, '_');
      if (stats.byStatus.hasOwnProperty(status)) {
        stats.byStatus[status]++;
      }

      if (incident.severity === 'critical') {
        stats.criticalCount++;
      }

      if (incident.duration) {
        totalDuration += incident.duration;
        totalResolutionTime += incident.resolvedAt ? incident.duration : 0;
        if (incident.resolvedAt) resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      stats.avgResolutionTime = totalResolutionTime / resolvedCount;
    }

    if (relevantIncidents.length > 0) {
      stats.avgDuration = totalDuration / relevantIncidents.length;
    }

    return stats;
  }

  /**
   * Find incident by alert
   * @private
   */
  _findIncidentByAlert(alert) {
    for (const incident of this.incidents.values()) {
      if (incident.relatedAlerts.includes(alert.ruleId) &&
          [INCIDENT_STATUS.CREATED, INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.IN_PROGRESS].includes(incident.status)) {
        return incident;
      }
    }
    return null;
  }

  /**
   * Map alert severity to impact level
   * @private
   */
  _mapAlertSeverityToImpact(severity) {
    const mapping = {
      critical: IMPACT_LEVEL.CRITICAL,
      high: IMPACT_LEVEL.HIGH,
      medium: IMPACT_LEVEL.MEDIUM,
      low: IMPACT_LEVEL.LOW
    };
    return mapping[severity] || IMPACT_LEVEL.MEDIUM;
  }

  /**
   * Save incident to disk
   * @private
   */
  _saveIncident(incident) {
    try {
      const filename = path.join(this.options.dataDir, `${incident.id}.json`);
      fs.writeFileSync(filename, JSON.stringify(incident, null, 2));
    } catch (e) {
      this.emit('error', {
        message: 'Failed to save incident',
        error: e.message
      });
    }
  }

  /**
   * Save post-mortem to disk
   * @private
   */
  _savePostMortem(postMortem) {
    try {
      const filename = path.join(this.options.dataDir, `${postMortem.incidentId}-postmortem.json`);
      fs.writeFileSync(filename, JSON.stringify(postMortem, null, 2));
    } catch (e) {
      this.emit('error', {
        message: 'Failed to save post-mortem',
        error: e.message
      });
    }
  }

  /**
   * Load incidents from disk
   */
  loadIncidents() {
    try {
      const files = fs.readdirSync(this.options.dataDir);

      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('postmortem')) {
          const filepath = path.join(this.options.dataDir, file);
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          this.incidents.set(data.id, data);
        }
      }

      this.emit('incidents:loaded', { count: this.incidents.size });
    } catch (e) {
      this.emit('error', {
        message: 'Failed to load incidents',
        error: e.message
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.removeAllListeners();
  }
}

module.exports = {
  IncidentTracker,
  INCIDENT_STATUS,
  IMPACT_LEVEL
};
