/**
 * Context Builder
 * Builds rich context from multiple OSINT sources for comprehensive analysis
 * @module src/advanced/context-builder
 */

const EventEmitter = require('events');

/**
 * Context Builder Class
 */
class ContextBuilder extends EventEmitter {
  constructor(options = {}) {
    super();

    this.contexts = new Map(); // contextId -> contextData
    this.relationships = new Map(); // entity -> [relatedEntities]
    this.timelines = new Map(); // contextId -> timelineData
    this.impacts = new Map(); // impactId -> impactData
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000; // 1 hour

    // Metrics
    this.metrics = {
      contextsBuilt: 0,
      relationshipsIdentified: 0,
      timelinesCreated: 0,
      averageBuildTime: 0,
      totalBuildTime: 0
    };
  }

  /**
   * Build context from multiple data sources
   * @param {Object} targetEntity - Entity to build context for
   * @param {Object} sources - Data sources containing related information
   * @param {Object} options - Build options
   * @returns {Object} Built context
   */
  buildContext(targetEntity, sources, options = {}) {
    const startTime = Date.now();
    const contextId = options.contextId || `context-${Date.now()}`;

    const context = {
      id: contextId,
      target: targetEntity,
      sources: [],
      relationships: new Map(),
      timeline: [],
      impacts: [],
      summary: {},
      confidence: 0,
      builtAt: Date.now()
    };

    // Process each source
    for (const [sourceName, sourceData] of Object.entries(sources)) {
      if (!sourceData) continue;

      context.sources.push({
        name: sourceName,
        dataCount: this.countDataPoints(sourceData),
        quality: this.assessSourceQuality(sourceData)
      });

      // Extract relationships
      const relationships = this.extractRelationships(
        targetEntity,
        sourceData,
        sourceName
      );

      for (const [entity, relData] of Object.entries(relationships)) {
        if (!context.relationships.has(entity)) {
          context.relationships.set(entity, []);
        }
        context.relationships.get(entity).push(relData);
      }
    }

    // Build timeline from all sources
    context.timeline = this.buildTimeline(targetEntity, sources);

    // Assess impacts
    context.impacts = this.assessImpacts(context);

    // Generate summary
    context.summary = this.generateSummary(context);

    // Calculate confidence
    context.confidence = this.calculateConfidence(context);

    // Store context
    this.contexts.set(contextId, context);

    const buildTime = Date.now() - startTime;
    this.metrics.contextsBuilt++;
    this.metrics.totalBuildTime += buildTime;
    this.metrics.averageBuildTime = Math.round(
      this.metrics.totalBuildTime / this.metrics.contextsBuilt
    );

    this.emit('context-built', {
      contextId,
      targetEntity,
      relationshipCount: context.relationships.size,
      timelineEvents: context.timeline.length,
      confidence: context.confidence,
      buildTime
    });

    return context;
  }

  /**
   * Extract relationships from source data
   * @private
   */
  extractRelationships(targetEntity, sourceData, sourceName) {
    const relationships = {};

    // Extract from threat intel data
    if (sourceData.threatActors) {
      for (const actor of sourceData.threatActors) {
        if (!relationships[actor.id]) {
          relationships[actor.id] = {
            entity: actor.id,
            type: 'threat-actor',
            name: actor.name,
            relationships: [],
            sources: []
          };
        }
        relationships[actor.id].sources.push(sourceName);
        relationships[actor.id].confidence = actor.riskScore / 100;
      }
    }

    // Extract from domain intel data
    if (sourceData.registrant) {
      const registrant = sourceData.registrant;
      const registrantId = this.hashEntity(registrant);
      if (!relationships[registrantId]) {
        relationships[registrantId] = {
          entity: registrantId,
          type: 'registrant',
          name: registrant.name || registrant.organization,
          relationships: [],
          sources: []
        };
      }
      relationships[registrantId].sources.push(sourceName);
    }

    // Extract from infrastructure data
    if (sourceData.asns) {
      for (const asn of sourceData.asns) {
        if (!relationships[asn]) {
          relationships[asn] = {
            entity: asn,
            type: 'asn',
            name: asn,
            relationships: [],
            sources: []
          };
        }
        relationships[asn].sources.push(sourceName);
      }
    }

    if (sourceData.ips) {
      for (const ip of sourceData.ips) {
        if (!relationships[ip]) {
          relationships[ip] = {
            entity: ip,
            type: 'ip-address',
            name: ip,
            relationships: [],
            sources: []
          };
        }
        relationships[ip].sources.push(sourceName);
      }
    }

    // Track relationships globally
    for (const [entity, relData] of Object.entries(relationships)) {
      if (!this.relationships.has(entity)) {
        this.relationships.set(entity, []);
      }
      this.relationships.get(entity).push({
        relatedTo: targetEntity,
        type: relData.type,
        source: sourceName
      });
      this.metrics.relationshipsIdentified++;
    }

    return relationships;
  }

  /**
   * Build timeline from multiple sources
   * @private
   */
  buildTimeline(targetEntity, sources) {
    const events = [];

    // Extract events from threat intel timeline
    if (sources.threatIntel?.timeline) {
      events.push(...sources.threatIntel.timeline.map(event => ({
        timestamp: event.timestamp,
        type: event.type,
        description: event.description,
        source: 'threat-intel',
        severity: event.severity || 'medium'
      })));
    }

    // Extract events from domain history
    if (sources.domainIntel?.history?.changes) {
      events.push(...sources.domainIntel.history.changes.map(change => ({
        timestamp: change.date,
        type: 'domain-change',
        description: change.details,
        source: 'domain-intel',
        severity: 'low'
      })));
    }

    // Extract events from certificate transparency
    if (sources.domainIntel?.certificates) {
      events.push(...sources.domainIntel.certificates.map(cert => ({
        timestamp: cert.discoveredAt || cert.validFrom,
        type: 'certificate-issued',
        description: `Certificate issued for ${cert.subject}`,
        source: 'certificate-transparency',
        severity: 'low'
      })));
    }

    // Extract events from security incidents
    if (sources.incidents) {
      events.push(...sources.incidents.map(incident => ({
        timestamp: incident.timestamp,
        type: 'security-incident',
        description: incident.description,
        source: 'incident-reports',
        severity: incident.severity
      })));
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    // Store timeline
    const timelineId = `timeline-${Date.now()}`;
    this.timelines.set(timelineId, {
      id: timelineId,
      targetEntity,
      events,
      totalEvents: events.length,
      timespan: {
        start: events[0]?.timestamp || Date.now(),
        end: events[events.length - 1]?.timestamp || Date.now()
      }
    });

    this.metrics.timelinesCreated++;

    return events;
  }

  /**
   * Assess impacts
   * @private
   */
  assessImpacts(context) {
    const impacts = [];

    // Assess risk impact
    const maxConfidence = Math.max(...Array.from(context.relationships.values())
      .flat()
      .map(r => r.confidence || 0));

    if (maxConfidence > 0.8) {
      impacts.push({
        id: `impact-${Date.now()}`,
        type: 'threat-risk',
        severity: 'critical',
        description: 'High-confidence threat actor association detected',
        affectedSystems: Array.from(context.relationships.keys()),
        recommendation: 'Immediate investigation and response required'
      });
    }

    // Assess infrastructure impact
    const ipRelationships = Array.from(context.relationships.values())
      .filter(r => r.type === 'ip-address');

    if (ipRelationships.length > 5) {
      impacts.push({
        id: `impact-${Date.now()}`,
        type: 'infrastructure-footprint',
        severity: 'high',
        description: `Large infrastructure footprint detected across ${ipRelationships.length} IP addresses`,
        affectedSystems: ipRelationships.map(r => r.entity),
        recommendation: 'Review infrastructure for compromise indicators'
      });
    }

    // Assess timeline impact
    const events = context.timeline || [];
    const recentEvents = events.filter(e => Date.now() - e.timestamp < 30 * 86400000);

    if (recentEvents.length > 3) {
      impacts.push({
        id: `impact-${Date.now()}`,
        type: 'activity-surge',
        severity: 'medium',
        description: `Elevated activity detected with ${recentEvents.length} events in last 30 days`,
        timestamp: Date.now(),
        recommendation: 'Monitor for ongoing operations'
      });
    }

    return impacts;
  }

  /**
   * Generate context summary
   * @private
   */
  generateSummary(context) {
    const summary = {
      overview: '',
      keyFindings: [],
      threatLevel: 'low',
      relatedEntities: Array.from(context.relationships.keys()),
      actionItems: []
    };

    // Determine threat level
    if (context.impacts.length === 0) {
      summary.threatLevel = 'low';
    } else if (context.impacts.some(i => i.severity === 'critical')) {
      summary.threatLevel = 'critical';
    } else if (context.impacts.some(i => i.severity === 'high')) {
      summary.threatLevel = 'high';
    } else {
      summary.threatLevel = 'medium';
    }

    // Build overview
    summary.overview = `Context for ${context.target} with ${context.relationships.size} ` +
                     `related entities, ${context.timeline.length} timeline events, ` +
                     `and ${context.impacts.length} identified impacts. ` +
                     `Overall threat level: ${summary.threatLevel.toUpperCase()}`;

    // Extract key findings from impacts
    summary.keyFindings = context.impacts.map(i => i.description);

    // Generate action items
    for (const impact of context.impacts) {
      summary.actionItems.push({
        priority: impact.severity === 'critical' ? 'urgent' : 'normal',
        action: impact.recommendation,
        impactId: impact.id
      });
    }

    return summary;
  }

  /**
   * Calculate overall confidence
   * @private
   */
  calculateConfidence(context) {
    let confidence = 0;
    let factors = 0;

    // Confidence from source quality
    for (const source of context.sources) {
      confidence += source.quality;
      factors++;
    }

    // Confidence from relationships
    const relationships = Array.from(context.relationships.values()).flat();
    for (const rel of relationships) {
      confidence += (rel.confidence || 0.5) * 100;
      factors++;
    }

    // Confidence from timeline consistency
    if (context.timeline.length > 0) {
      confidence += 20;
      factors++;
    }

    return factors > 0 ? Math.round(confidence / factors) : 0;
  }

  /**
   * Helper: Count data points
   * @private
   */
  countDataPoints(data) {
    let count = 0;

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (value !== null && typeof value === 'object') {
        count += Object.keys(value).length;
      } else if (value !== null && value !== undefined) {
        count++;
      }
    }

    return count;
  }

  /**
   * Helper: Assess source quality
   * @private
   */
  assessSourceQuality(sourceData) {
    let quality = 50;

    // Increase for data completeness
    const dataPoints = this.countDataPoints(sourceData);
    quality += Math.min(dataPoints * 5, 30);

    // Increase for structured data
    if (typeof sourceData === 'object' && !Array.isArray(sourceData)) {
      quality += 10;
    }

    return Math.min(quality, 100);
  }

  /**
   * Helper: Hash entity
   * @private
   */
  hashEntity(entity) {
    const crypto = require('crypto');
    const key = JSON.stringify(entity);
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }

  /**
   * Get context
   */
  getContext(contextId) {
    return this.contexts.get(contextId);
  }

  /**
   * List all contexts
   */
  listContexts() {
    return Array.from(this.contexts.values()).map(context => ({
      id: context.id,
      target: context.target,
      relationshipCount: context.relationships.size,
      timelineEvents: context.timeline.length,
      impacts: context.impacts.length,
      threatLevel: context.summary?.threatLevel,
      confidence: context.confidence,
      builtAt: context.builtAt
    }));
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      contextsStored: this.contexts.size,
      relationshipsTracked: this.relationships.size,
      timelinesStored: this.timelines.size
    };
  }
}

module.exports = {
  ContextBuilder,
  createContextBuilder: (options) => new ContextBuilder(options)
};
