/**
 * Advanced Threat Intelligence Engine
 * Performs threat actor profiling, campaign correlation, and attribution analysis
 * @module src/advanced/threat-intel
 */

const EventEmitter = require('events');

/**
 * Threat Actor Profile
 */
class ThreatActor {
  constructor(id, profile) {
    this.id = id;
    this.name = profile.name || `Threat-${id}`;
    this.aliases = profile.aliases || [];
    this.country = profile.country || 'Unknown';
    this.motivation = profile.motivation || 'Unknown'; // Cyber-espionage, Cybercrime, Hacktivism, Terrorism
    this.sophistication = profile.sophistication || 'Medium'; // Low, Medium, High, Very High
    this.capabilities = profile.capabilities || [];
    this.firstSeen = profile.firstSeen || Date.now();
    this.lastSeen = profile.lastSeen || Date.now();
    this.campaigns = [];
    this.infrastructure = [];
    this.indicators = {
      malware: [],
      domains: [],
      ips: [],
      emails: [],
      certificates: []
    };
    this.relationships = new Map(); // Relationship with other actors
    this.riskScore = 0;
    this.metadata = profile.metadata || {};
  }

  /**
   * Calculate threat score based on sophistication and capabilities
   */
  calculateRiskScore() {
    let score = 0;

    // Base score from sophistication
    const sophScores = {
      'Low': 20,
      'Medium': 50,
      'High': 80,
      'Very High': 100
    };
    score += sophScores[this.sophistication] || 50;

    // Adjust by capabilities
    score += this.capabilities.length * 5;

    // Adjust by campaign count
    score += Math.min(this.campaigns.length * 3, 30);

    // Adjust by infrastructure size
    score += Math.min(this.infrastructure.length * 2, 20);

    // Cap at 100
    this.riskScore = Math.min(score, 100);
    return this.riskScore;
  }
}

/**
 * Campaign Profile
 */
class Campaign {
  constructor(id, config) {
    this.id = id;
    this.name = config.name || `Campaign-${id}`;
    this.description = config.description || '';
    this.startDate = config.startDate || Date.now();
    this.endDate = config.endDate || null;
    this.threatActors = [];
    this.objectives = config.objectives || [];
    this.targetedSectors = config.targetedSectors || [];
    this.targetedCountries = config.targetedCountries || [];
    this.methods = config.methods || [];
    this.techniques = []; // ATT&CK techniques
    this.indicators = {
      malware: [],
      domains: [],
      ips: [],
      tools: []
    };
    this.incidents = [];
    this.timeline = [];
    this.status = config.status || 'active'; // active, paused, inactive
    this.riskScore = 0;
    this.metadata = config.metadata || {};
  }

  /**
   * Calculate campaign risk score
   */
  calculateRiskScore() {
    let score = 0;

    // Base score from threat actor count
    score += this.threatActors.length * 10;

    // Add points for objectives
    score += this.targetedCountries.length * 2;
    score += this.targetedSectors.length * 3;

    // Add points for techniques
    score += this.techniques.length * 2;

    // Add points for indicators
    score += this.indicators.malware.length * 5;
    score += this.indicators.domains.length * 2;
    score += this.indicators.ips.length;

    // Status modifier
    if (this.status === 'active') {
      score *= 1.5;
    } else if (this.status === 'inactive') {
      score *= 0.7;
    }

    this.riskScore = Math.min(score, 100);
    return this.riskScore;
  }
}

/**
 * Threat Intelligence Engine Class
 */
class ThreatIntelligence extends EventEmitter {
  constructor(options = {}) {
    super();

    this.threatActors = new Map(); // actorId -> ThreatActor
    this.campaigns = new Map(); // campaignId -> Campaign
    this.indicators = new Map(); // indicator -> indicatorData
    this.incidents = new Map(); // incidentId -> incidentData
    this.correlations = []; // Correlation results
    this.attributions = []; // Attribution results

    this.mlModel = null;
    this.enableML = options.enableML !== false;
    this.correlationThreshold = options.correlationThreshold || 0.7;
    this.attributionThreshold = options.attributionThreshold || 0.8;

    // Metrics
    this.metrics = {
      actorCount: 0,
      campaignCount: 0,
      indicatorCount: 0,
      correlations: 0,
      attributions: 0,
      avgRiskScore: 0
    };
  }

  /**
   * Register threat actor
   * @param {Object} profile - Actor profile
   * @returns {ThreatActor} Threat actor
   */
  registerThreatActor(profile) {
    const actorId = profile.id || `actor-${Date.now()}`;
    const actor = new ThreatActor(actorId, profile);

    actor.calculateRiskScore();
    this.threatActors.set(actorId, actor);
    this.metrics.actorCount++;

    this.emit('actor-registered', {
      actorId: actor.id,
      name: actor.name,
      riskScore: actor.riskScore
    });

    return actor;
  }

  /**
   * Register campaign
   * @param {Object} config - Campaign configuration
   * @returns {Campaign} Campaign
   */
  registerCampaign(config) {
    const campaignId = config.id || `campaign-${Date.now()}`;
    const campaign = new Campaign(campaignId, config);

    // Link threat actors
    if (config.threatActorIds) {
      config.threatActorIds.forEach(actorId => {
        if (this.threatActors.has(actorId)) {
          campaign.threatActors.push(actorId);
          this.threatActors.get(actorId).campaigns.push(campaignId);
        }
      });
    }

    campaign.calculateRiskScore();
    this.campaigns.set(campaignId, campaign);
    this.metrics.campaignCount++;

    this.emit('campaign-registered', {
      campaignId: campaign.id,
      name: campaign.name,
      riskScore: campaign.riskScore
    });

    return campaign;
  }

  /**
   * Add indicator to tracking
   * @param {string} indicatorValue - Indicator value
   * @param {Object} indicatorData - Indicator metadata
   * @returns {Object} Indicator
   */
  addIndicator(indicatorValue, indicatorData) {
    const indicator = {
      value: indicatorValue,
      type: indicatorData.type || this.classifyIndicator(indicatorValue),
      source: indicatorData.source || 'unknown',
      threatActors: indicatorData.threatActors || [],
      campaigns: indicatorData.campaigns || [],
      firstSeen: indicatorData.firstSeen || Date.now(),
      lastSeen: indicatorData.lastSeen || Date.now(),
      confidence: indicatorData.confidence || 0.5,
      severity: indicatorData.severity || 'Medium',
      metadata: indicatorData.metadata || {}
    };

    this.indicators.set(indicatorValue, indicator);
    this.metrics.indicatorCount++;

    // Link to actors and campaigns
    indicator.threatActors.forEach(actorId => {
      if (this.threatActors.has(actorId)) {
        const actor = this.threatActors.get(actorId);
        if (!actor.indicators[indicator.type]) {
          actor.indicators[indicator.type] = [];
        }
        if (!actor.indicators[indicator.type].includes(indicatorValue)) {
          actor.indicators[indicator.type].push(indicatorValue);
        }
      }
    });

    this.emit('indicator-added', {
      value: indicatorValue,
      type: indicator.type,
      severity: indicator.severity
    });

    return indicator;
  }

  /**
   * Correlate indicators and campaigns
   * @param {Object} options - Correlation options
   * @returns {Array} Correlation results
   */
  correlateData(options = {}) {
    const correlations = [];

    // Correlate campaigns by shared indicators
    const campaignArray = Array.from(this.campaigns.values());
    for (let i = 0; i < campaignArray.length; i++) {
      for (let j = i + 1; j < campaignArray.length; j++) {
        const campaign1 = campaignArray[i];
        const campaign2 = campaignArray[j];

        const sharedIndicators = this.findSharedIndicators(campaign1, campaign2);
        if (sharedIndicators.length > 0) {
          const correlation = {
            campaign1: campaign1.id,
            campaign2: campaign2.id,
            sharedIndicators,
            similarity: this.calculateSimilarity(campaign1, campaign2),
            confidence: Math.min(sharedIndicators.length * 0.15, 1.0),
            timestamp: Date.now()
          };

          if (correlation.similarity >= this.correlationThreshold) {
            correlations.push(correlation);
          }
        }
      }
    }

    this.correlations = correlations;
    this.metrics.correlations = correlations.length;

    this.emit('correlation-completed', {
      correlationCount: correlations.length,
      timestamp: Date.now()
    });

    return correlations;
  }

  /**
   * Perform attribution analysis
   * @param {Array} indicators - Indicators to analyze
   * @param {Object} options - Attribution options
   * @returns {Array} Attribution results
   */
  performAttribution(indicators, options = {}) {
    const attributions = [];

    const indicatorSet = new Set(indicators);

    for (const [actorId, actor] of this.threatActors) {
      let matchCount = 0;
      let confidence = 0;

      // Count matching indicators
      for (const [type, typeIndicators] of Object.entries(actor.indicators)) {
        for (const ind of typeIndicators) {
          if (indicatorSet.has(ind)) {
            matchCount++;
          }
        }
      }

      if (matchCount > 0) {
        confidence = Math.min(matchCount / indicators.length, 1.0);

        if (confidence >= this.attributionThreshold) {
          attributions.push({
            actorId: actor.id,
            actorName: actor.name,
            confidence,
            matchCount,
            matchedIndicators: Array.from(indicatorSet).filter(
              ind => actor.indicators.domains?.includes(ind) ||
                     actor.indicators.ips?.includes(ind) ||
                     actor.indicators.malware?.includes(ind) ||
                     actor.indicators.emails?.includes(ind) ||
                     actor.indicators.certificates?.includes(ind)
            ),
            riskScore: actor.riskScore,
            timestamp: Date.now()
          });
        }
      }
    }

    // Sort by confidence
    attributions.sort((a, b) => b.confidence - a.confidence);

    this.attributions = attributions;
    this.metrics.attributions = attributions.length;

    this.emit('attribution-completed', {
      attributionCount: attributions.length,
      topAttribution: attributions[0] || null,
      timestamp: Date.now()
    });

    return attributions;
  }

  /**
   * Analyze timeline of events
   * @param {Array} events - Timeline events
   * @returns {Object} Timeline analysis
   */
  analyzeTimeline(events) {
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);

    const analysis = {
      totalEvents: events.length,
      timespan: {
        start: sortedEvents[0]?.timestamp || Date.now(),
        end: sortedEvents[sortedEvents.length - 1]?.timestamp || Date.now(),
        durationMs: 0
      },
      eventsByType: {},
      eventDensity: [],
      patterns: [],
      pivotPoints: []
    };

    analysis.timespan.durationMs = analysis.timespan.end - analysis.timespan.start;

    // Group events by type
    for (const event of sortedEvents) {
      if (!analysis.eventsByType[event.type]) {
        analysis.eventsByType[event.type] = [];
      }
      analysis.eventsByType[event.type].push(event);
    }

    // Calculate event density (events per day)
    const dayMs = 86400000;
    const daysCount = Math.ceil(analysis.timespan.durationMs / dayMs);
    analysis.eventDensity = Array(daysCount).fill(0);

    for (const event of sortedEvents) {
      const dayIndex = Math.floor((event.timestamp - analysis.timespan.start) / dayMs);
      if (dayIndex >= 0 && dayIndex < analysis.eventDensity.length) {
        analysis.eventDensity[dayIndex]++;
      }
    }

    // Detect pivot points (significant increases in activity)
    for (let i = 1; i < analysis.eventDensity.length; i++) {
      const previous = analysis.eventDensity[i - 1];
      const current = analysis.eventDensity[i];
      if (current > previous * 2) {
        analysis.pivotPoints.push({
          day: i,
          increase: current - previous
        });
      }
    }

    return analysis;
  }

  /**
   * Get infrastructure map
   * @returns {Object} Infrastructure data
   */
  getInfrastructureMap() {
    const infrastructure = {
      domains: new Set(),
      ips: new Set(),
      certificates: new Set(),
      malware: new Set(),
      relationships: []
    };

    for (const [, actor] of this.threatActors) {
      actor.indicators.domains?.forEach(d => infrastructure.domains.add(d));
      actor.indicators.ips?.forEach(ip => infrastructure.ips.add(ip));
      actor.indicators.certificates?.forEach(c => infrastructure.certificates.add(c));
      actor.indicators.malware?.forEach(m => infrastructure.malware.add(m));
    }

    // Build relationship graph
    for (const [, actor] of this.threatActors) {
      for (const targetId of actor.relationships.keys()) {
        infrastructure.relationships.push({
          source: actor.id,
          target: targetId,
          type: actor.relationships.get(targetId)
        });
      }
    }

    return {
      domainCount: infrastructure.domains.size,
      domains: Array.from(infrastructure.domains),
      ipCount: infrastructure.ips.size,
      ips: Array.from(infrastructure.ips),
      certificateCount: infrastructure.certificates.size,
      certificates: Array.from(infrastructure.certificates),
      malwareCount: infrastructure.malware.size,
      malware: Array.from(infrastructure.malware),
      relationshipCount: infrastructure.relationships.length,
      relationships: infrastructure.relationships,
      timestamp: Date.now()
    };
  }

  /**
   * Generate threat report
   * @param {string} type - Report type (summary, detailed, actor, campaign)
   * @returns {Object} Report
   */
  generateThreatReport(type = 'summary') {
    const report = {
      type,
      generatedAt: Date.now(),
      executive: {
        totalActors: this.threatActors.size,
        totalCampaigns: this.campaigns.size,
        totalIndicators: this.indicators.size,
        avgRiskScore: this.calculateAverageRiskScore()
      },
      detailedMetrics: {
        ...this.metrics
      }
    };

    if (type === 'summary' || type === 'detailed') {
      report.topThreats = Array.from(this.threatActors.values())
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10)
        .map(actor => ({
          id: actor.id,
          name: actor.name,
          riskScore: actor.riskScore,
          campaigns: actor.campaigns.length,
          indicators: Object.values(actor.indicators).flat().length
        }));

      report.activeCampaigns = Array.from(this.campaigns.values())
        .filter(c => c.status === 'active')
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10)
        .map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          riskScore: campaign.riskScore,
          actors: campaign.threatActors.length,
          targets: campaign.targetedCountries.length
        }));

      report.recentIndicators = Array.from(this.indicators.values())
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, 20)
        .map(ind => ({
          value: ind.value,
          type: ind.type,
          severity: ind.severity,
          lastSeen: ind.lastSeen
        }));
    }

    if (type === 'detailed') {
      report.correlations = this.correlations;
      report.attributions = this.attributions;
      report.infrastructure = this.getInfrastructureMap();
    }

    return report;
  }

  /**
   * Helper: Classify indicator by value
   * @private
   */
  classifyIndicator(value) {
    if (value.includes('@')) {
      return 'email';
    }
    if (value.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      return 'ip';
    }
    if (value.match(/^[a-f0-9]{64}$/)) {
      return 'hash';
    }
    if (value.match(/^[a-f0-9]{32}$/)) {
      return 'hash';
    }
    if (value.includes('.')) {
      return 'domain';
    }
    return 'unknown';
  }

  /**
   * Helper: Find shared indicators
   * @private
   */
  findSharedIndicators(campaign1, campaign2) {
    const shared = [];
    const indicators1 = new Set(
      Object.values(campaign1.indicators).flat()
    );
    const indicators2 = new Set(
      Object.values(campaign2.indicators).flat()
    );

    for (const ind of indicators1) {
      if (indicators2.has(ind)) {
        shared.push(ind);
      }
    }

    return shared;
  }

  /**
   * Helper: Calculate similarity score
   * @private
   */
  calculateSimilarity(campaign1, campaign2) {
    let similarity = 0;
    let factors = 0;

    // Shared target countries
    const countries1 = new Set(campaign1.targetedCountries);
    const countries2 = new Set(campaign2.targetedCountries);
    const sharedCountries = new Set([...countries1].filter(x => countries2.has(x)));
    if (countries1.size > 0) {
      similarity += sharedCountries.size / Math.max(countries1.size, countries2.size);
      factors++;
    }

    // Shared target sectors
    const sectors1 = new Set(campaign1.targetedSectors);
    const sectors2 = new Set(campaign2.targetedSectors);
    const sharedSectors = new Set([...sectors1].filter(x => sectors2.has(x)));
    if (sectors1.size > 0) {
      similarity += sharedSectors.size / Math.max(sectors1.size, sectors2.size);
      factors++;
    }

    // Shared techniques
    const techniques1 = new Set(campaign1.techniques);
    const techniques2 = new Set(campaign2.techniques);
    const sharedTechniques = new Set([...techniques1].filter(x => techniques2.has(x)));
    if (techniques1.size > 0) {
      similarity += sharedTechniques.size / Math.max(techniques1.size, techniques2.size);
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Helper: Calculate average risk score
   * @private
   */
  calculateAverageRiskScore() {
    if (this.threatActors.size === 0) {
      return 0;
    }

    const total = Array.from(this.threatActors.values())
      .reduce((sum, actor) => sum + actor.riskScore, 0);

    return Math.round(total / this.threatActors.size);
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgRiskScore: this.calculateAverageRiskScore()
    };
  }
}

module.exports = {
  ThreatIntelligence,
  ThreatActor,
  Campaign,
  createThreatIntelligence: (options) => new ThreatIntelligence(options)
};
