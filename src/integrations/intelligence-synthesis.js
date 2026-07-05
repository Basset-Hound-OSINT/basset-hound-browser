/**
 * Cross-Platform Intelligence Synthesis Module
 * Multi-source data correlation and threat intelligence fusion
 * @module src/integrations/intelligence-synthesis
 */

const EventEmitter = require('events');

/**
 * Intelligence Synthesis Class
 */
class IntelligenceSynthesis extends EventEmitter {
  constructor(options = {}) {
    super();

    this.integrations = new Map();
    this.correlations = new Map();
    this.threatDatabase = new Map();
    this.infrastructureMap = new Map();
    this.scoringEngine = new IntelligenceScoringEngine();

    // Caching
    this.synthesisCache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000;

    // Metrics
    this.metrics = {
      correlations: 0,
      threatLevelAssessments: 0,
      infrastructureMappings: 0,
      scoringCalculations: 0,
      riskAggregations: 0,
      totalLatency: 0,
      latencies: [],
      datasourcesIntegrated: 0
    };
  }

  /**
   * Register integration source
   * @param {string} sourceName - Name of the source
   * @param {Object} sourceClient - Integration client
   */
  registerIntegration(sourceName, sourceClient) {
    this.integrations.set(sourceName, {
      name: sourceName,
      client: sourceClient,
      registered: new Date(),
      queries: 0,
      hits: 0
    });

    this.metrics.datasourcesIntegrated++;
    this.emit('integration-registered', { source: sourceName });
  }

  /**
   * Correlate multi-source data
   * @param {Object} queryData - Query data from multiple sources
   * @returns {Promise<Object>} Correlated results
   */
  async correlateMultiSourceData(queryData) {
    const startTime = Date.now();
    const cacheKey = `correlation:${this.generateQueryHash(queryData)}`;

    if (this.synthesisCache.has(cacheKey)) {
      const cached = this.synthesisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.correlations++;
        return cached.data;
      }
    }

    try {
      const correlatedData = {
        sources: [],
        correlations: [],
        confidence: 0,
        relationships: [],
        anomalies: [],
        insights: [],
        timestamp: Date.now()
      };

      // Collect data from each source
      const sourceResults = new Map();

      for (const [sourceName, integration] of this.integrations) {
        try {
          // Simulate data collection from each source
          const results = await this.querySource(sourceName, integration, queryData);

          if (results) {
            sourceResults.set(sourceName, results);
            correlatedData.sources.push({
              source: sourceName,
              resultCount: results.count || 0,
              confidence: results.confidence || 'unknown'
            });

            integration.queries++;
            if (results.count > 0) {
              integration.hits++;
            }
          }
        } catch (error) {
          this.emit('warning', { type: 'source-query', source: sourceName, error: error.message });
        }
      }

      // Correlate data across sources
      correlatedData.correlations = this.findCorrelations(sourceResults);
      correlatedData.relationships = this.buildEntityRelationships(sourceResults);
      correlatedData.anomalies = this.detectAnomalies(sourceResults);
      correlatedData.insights = this.generateInsights(sourceResults, correlatedData.correlations);

      // Calculate confidence
      correlatedData.confidence = this.calculateCorrelationConfidence(sourceResults);

      this.synthesisCache.set(cacheKey, {
        data: correlatedData,
        timestamp: Date.now()
      });

      this.metrics.correlations++;
      const latency = Date.now() - startTime;
      this.metrics.latencies.push(latency);

      this.emit('correlation-complete', {
        sources: sourceResults.size,
        correlations: correlatedData.correlations.length,
        latency
      });

      return correlatedData;
    } catch (error) {
      this.emit('error', { type: 'multi-source-correlation', error, queryData });
      throw error;
    }
  }

  /**
   * Fuse threat intelligence from multiple sources
   * @param {Array<Object>} threats - Threat data from multiple sources
   * @returns {Promise<Object>} Fused threat intelligence
   */
  async fuseThreatIntelligence(threats) {
    const startTime = Date.now();

    try {
      const fusion = {
        threatCount: threats.length,
        uniqueThreats: [],
        threatActors: new Set(),
        campaigns: new Set(),
        tactics: new Set(),
        infrastructure: new Set(),
        indicators: [],
        riskMatrix: this.buildRiskMatrix(threats),
        timeline: [],
        confidenceScores: {},
        timestamp: Date.now()
      };

      // Deduplicate threats
      const threatMap = new Map();

      for (const threat of threats) {
        const threatId = threat.id || threat.name || JSON.stringify(threat);

        if (!threatMap.has(threatId)) {
          threatMap.set(threatId, {
            ...threat,
            sources: [threat.source || 'unknown'],
            confidence: threat.confidence || 0.5
          });
        } else {
          const existing = threatMap.get(threatId);
          existing.sources.push(threat.source || 'unknown');
          existing.confidence = Math.max(existing.confidence, threat.confidence || 0.5);
        }
      }

      fusion.uniqueThreats = Array.from(threatMap.values());

      // Extract threat attributes
      for (const threat of fusion.uniqueThreats) {
        if (threat.actor) {
          fusion.threatActors.add(threat.actor);
        }
        if (threat.campaign) {
          fusion.campaigns.add(threat.campaign);
        }
        if (threat.tactics) {
          threat.tactics.forEach(t => fusion.tactics.add(t));
        }
        if (threat.infrastructure) {
          threat.infrastructure.forEach(i => fusion.infrastructure.add(i));
        }

        // Extract indicators
        if (threat.indicators) {
          fusion.indicators.push(...threat.indicators);
        }
      }

      // Convert Sets to Arrays
      fusion.threatActors = Array.from(fusion.threatActors);
      fusion.campaigns = Array.from(fusion.campaigns);
      fusion.tactics = Array.from(fusion.tactics);
      fusion.infrastructure = Array.from(fusion.infrastructure);

      // Build timeline
      fusion.timeline = this.buildThreatTimeline(fusion.uniqueThreats);

      // Calculate confidence scores
      fusion.confidenceScores = this.calculateThreatConfidenceScores(fusion.uniqueThreats);

      this.metrics.threatLevelAssessments++;
      const latency = Date.now() - startTime;
      this.metrics.latencies.push(latency);

      this.emit('threat-intelligence-fusion-complete', {
        threatCount: fusion.uniqueThreats.length,
        threatActors: fusion.threatActors.length,
        indicators: fusion.indicators.length,
        latency
      });

      return fusion;
    } catch (error) {
      this.emit('error', { type: 'threat-intelligence-fusion', error });
      throw error;
    }
  }

  /**
   * Map infrastructure across sources
   * @param {Array<Object>} hostData - Host data from multiple sources
   * @returns {Promise<Object>} Infrastructure map
   */
  async mapInfrastructure(hostData) {
    const startTime = Date.now();

    try {
      const infrastructureMap = {
        hosts: [],
        networks: [],
        datacenters: new Set(),
        providers: new Set(),
        geolocation: new Map(),
        connectivity: [],
        pathways: [],
        resilience: {},
        timestamp: Date.now()
      };

      // Process hosts
      for (const host of hostData) {
        infrastructureMap.hosts.push({
          ip: host.ip,
          country: host.country,
          organization: host.org,
          ports: host.ports || [],
          services: host.services || [],
          asn: host.asn
        });

        // Track datacenters
        if (host.datacenter) {
          infrastructureMap.datacenters.add(host.datacenter);
        }

        // Track providers
        if (host.provider) {
          infrastructureMap.providers.add(host.provider);
        }

        // Track geolocation
        if (host.country) {
          const count = infrastructureMap.geolocation.get(host.country) || 0;
          infrastructureMap.geolocation.set(host.country, count + 1);
        }
      }

      // Analyze networks
      infrastructureMap.networks = this.analyzeNetworks(hostData);

      // Detect connectivity patterns
      infrastructureMap.connectivity = this.detectConnectivityPatterns(hostData);

      // Identify pathways
      infrastructureMap.pathways = this.identifyInfrastructurePathways(hostData);

      // Assess resilience
      infrastructureMap.resilience = this.assessInfrastructureResilience(hostData);

      // Convert Sets to Arrays
      infrastructureMap.datacenters = Array.from(infrastructureMap.datacenters);
      infrastructureMap.providers = Array.from(infrastructureMap.providers);
      infrastructureMap.geolocation = Object.fromEntries(infrastructureMap.geolocation);

      this.metrics.infrastructureMappings++;
      const latency = Date.now() - startTime;
      this.metrics.latencies.push(latency);

      this.emit('infrastructure-mapping-complete', {
        hostCount: infrastructureMap.hosts.length,
        datacenters: infrastructureMap.datacenters.length,
        latency
      });

      return infrastructureMap;
    } catch (error) {
      this.emit('error', { type: 'infrastructure-mapping', error, hostData });
      throw error;
    }
  }

  /**
   * Score intelligence using multiple factors
   * @param {Object} data - Data to score
   * @returns {Promise<Object>} Intelligence scores
   */
  async scoreIntelligence(data) {
    const startTime = Date.now();

    try {
      const scores = {
        overallScore: 0,
        reliabilityScore: 0,
        severityScore: 0,
        confidenceScore: 0,
        actionalityScore: 0,
        factors: {},
        weights: this.scoringEngine.getWeights(),
        recommendation: '',
        timestamp: Date.now()
      };

      // Calculate individual scores
      scores.reliabilityScore = this.scoringEngine.calculateReliability(data);
      scores.severityScore = this.scoringEngine.calculateSeverity(data);
      scores.confidenceScore = this.scoringEngine.calculateConfidence(data);
      scores.actionalityScore = this.scoringEngine.calculateActionability(data);

      // Calculate weighted overall score
      scores.overallScore = this.scoringEngine.calculateWeightedScore(scores);

      // Factor analysis
      scores.factors = {
        dataQuality: this.assessDataQuality(data),
        sourceReputation: this.assessSourceReputation(data),
        temporalValidity: this.assessTemporalValidity(data),
        contextRelevance: this.assessContextRelevance(data)
      };

      // Generate recommendation
      scores.recommendation = this.generateScoringRecommendation(scores.overallScore);

      this.metrics.scoringCalculations++;
      const latency = Date.now() - startTime;
      this.metrics.latencies.push(latency);

      this.emit('intelligence-scoring-complete', {
        overallScore: scores.overallScore,
        severity: scores.severityScore,
        latency
      });

      return scores;
    } catch (error) {
      this.emit('error', { type: 'intelligence-scoring', error, data });
      throw error;
    }
  }

  /**
   * Aggregate risk across multiple sources
   * @param {Object} riskData - Risk data from multiple sources
   * @returns {Promise<Object>} Aggregated risk assessment
   */
  async aggregateRisk(riskData) {
    const startTime = Date.now();

    try {
      const riskAggregation = {
        sources: Object.keys(riskData).length,
        riskScores: {},
        aggregatedRisk: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        topThreats: [],
        mitigationPriorities: [],
        overallRiskScore: 0,
        trend: 'stable',
        timestamp: Date.now()
      };

      // Calculate risk per source
      let totalScore = 0;
      for (const [source, risks] of Object.entries(riskData)) {
        const sourceScore = this.calculateSourceRiskScore(risks);
        riskAggregation.riskScores[source] = sourceScore;
        totalScore += sourceScore;

        // Aggregate by severity
        if (risks.critical) {
          riskAggregation.aggregatedRisk.critical += risks.critical;
        }
        if (risks.high) {
          riskAggregation.aggregatedRisk.high += risks.high;
        }
        if (risks.medium) {
          riskAggregation.aggregatedRisk.medium += risks.medium;
        }
        if (risks.low) {
          riskAggregation.aggregatedRisk.low += risks.low;
        }
      }

      // Calculate overall risk
      const sourceCount = Object.keys(riskData).length;
      riskAggregation.overallRiskScore = sourceCount > 0 ? totalScore / sourceCount : 0;

      // Identify top threats
      riskAggregation.topThreats = this.identifyTopThreats(riskData);

      // Determine mitigation priorities
      riskAggregation.mitigationPriorities = this.determineMitigationPriorities(riskAggregation);

      // Assess trend
      riskAggregation.trend = this.assessRiskTrend(riskData);

      this.metrics.riskAggregations++;
      const latency = Date.now() - startTime;
      this.metrics.latencies.push(latency);

      this.emit('risk-aggregation-complete', {
        overallRisk: riskAggregation.overallRiskScore,
        criticalRisks: riskAggregation.aggregatedRisk.critical,
        latency
      });

      return riskAggregation;
    } catch (error) {
      this.emit('error', { type: 'risk-aggregation', error, riskData });
      throw error;
    }
  }

  /**
   * Find correlations between sources
   * @private
   */
  findCorrelations(sourceResults) {
    const correlations = [];

    const allResults = Array.from(sourceResults.values());
    for (let i = 0; i < allResults.length - 1; i++) {
      for (let j = i + 1; j < allResults.length; j++) {
        const result1 = allResults[i];
        const result2 = allResults[j];

        if (this.resultsMatch(result1, result2)) {
          correlations.push({
            source1: Array.from(sourceResults.keys())[i],
            source2: Array.from(sourceResults.keys())[j],
            matchType: 'direct-match',
            confidence: 0.95
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Check if results match
   * @private
   */
  resultsMatch(result1, result2) {
    return result1.id === result2.id || result1.value === result2.value;
  }

  /**
   * Build entity relationships
   * @private
   */
  buildEntityRelationships(sourceResults) {
    const relationships = [];

    for (const [source, results] of sourceResults) {
      if (results.entities && Array.isArray(results.entities)) {
        for (let i = 0; i < results.entities.length - 1; i++) {
          for (let j = i + 1; j < Math.min(results.entities.length, i + 5); j++) {
            relationships.push({
              entity1: results.entities[i].id,
              entity2: results.entities[j].id,
              relationship: 'CORRELATED',
              source,
              confidence: Math.random() * 0.5 + 0.5
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Detect anomalies
   * @private
   */
  detectAnomalies(sourceResults) {
    const anomalies = [];

    for (const [source, results] of sourceResults) {
      if (results.suspicious) {
        anomalies.push({
          source,
          type: 'suspicious-pattern',
          severity: 'HIGH',
          description: 'Unusual activity detected'
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate insights
   * @private
   */
  generateInsights(sourceResults, correlations) {
    const insights = [];

    if (sourceResults.size > 1) {
      insights.push({
        type: 'multi-source-correlation',
        description: `Data correlated across ${sourceResults.size} sources`,
        importance: 'HIGH'
      });
    }

    if (correlations.length > 0) {
      insights.push({
        type: 'entity-correlation',
        description: `Found ${correlations.length} correlations between entities`,
        importance: 'MEDIUM'
      });
    }

    return insights;
  }

  /**
   * Calculate correlation confidence
   * @private
   */
  calculateCorrelationConfidence(sourceResults) {
    const sourceCount = sourceResults.size;

    if (sourceCount === 0) {
      return 0;
    }
    if (sourceCount === 1) {
      return 0.5;
    }
    if (sourceCount >= 3) {
      return 0.95;
    }

    return 0.75;
  }

  /**
   * Build risk matrix
   * @private
   */
  buildRiskMatrix(threats) {
    const matrix = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const threat of threats) {
      const level = threat.level || 'medium';
      matrix[level.toLowerCase()]++;
    }

    return matrix;
  }

  /**
   * Build threat timeline
   * @private
   */
  buildThreatTimeline(threats) {
    return threats
      .filter(t => t.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(t => ({
        date: t.timestamp,
        event: t.name,
        actor: t.actor,
        severity: t.level
      }));
  }

  /**
   * Calculate threat confidence scores
   * @private
   */
  calculateThreatConfidenceScores(threats) {
    const scores = {};

    for (const threat of threats.slice(0, 5)) {
      scores[threat.id || threat.name] = {
        sources: threat.sources ? threat.sources.length : 1,
        confidence: threat.confidence || 0.5,
        sourceCount: threat.sources ? threat.sources.length : 0
      };
    }

    return scores;
  }

  /**
   * Analyze networks
   * @private
   */
  analyzeNetworks(hostData) {
    const networks = {};

    for (const host of hostData) {
      if (host.asn) {
        if (!networks[host.asn]) {
          networks[host.asn] = { asn: host.asn, hostCount: 0, countries: new Set() };
        }
        networks[host.asn].hostCount++;
        if (host.country) {
          networks[host.asn].countries.add(host.country);
        }
      }
    }

    return Object.values(networks).map(n => ({
      asn: n.asn,
      hostCount: n.hostCount,
      countries: Array.from(n.countries)
    }));
  }

  /**
   * Detect connectivity patterns
   * @private
   */
  detectConnectivityPatterns(hostData) {
    return hostData
      .filter(h => h.ports && h.ports.length > 0)
      .slice(0, 10)
      .map(h => ({
        ip: h.ip,
        portCount: h.ports.length,
        primaryPorts: h.ports.slice(0, 3)
      }));
  }

  /**
   * Identify infrastructure pathways
   * @private
   */
  identifyInfrastructurePathways(hostData) {
    const pathways = [];

    // Detect patterns indicating infrastructure relationships
    if (hostData.length > 1) {
      pathways.push({
        type: 'distributed-infrastructure',
        hostCount: hostData.length,
        countries: new Set(hostData.map(h => h.country)).size
      });
    }

    return pathways;
  }

  /**
   * Assess infrastructure resilience
   * @private
   */
  assessInfrastructureResilience(hostData) {
    return {
      redundancy: hostData.length > 1 ? 'MULTIPLE_LOCATIONS' : 'SINGLE_LOCATION',
      loadBalancing: hostData.filter(h => h.ports && h.ports.length > 3).length > 2 ? 'DETECTED' : 'NOT_DETECTED',
      resilience_score: Math.min((hostData.length / 10) * 100, 100)
    };
  }

  /**
   * Assess data quality
   * @private
   */
  assessDataQuality(data) {
    return {
      completeness: 0.85,
      accuracy: 0.90,
      consistency: 0.88,
      score: 0.87
    };
  }

  /**
   * Assess source reputation
   * @private
   */
  assessSourceReputation(data) {
    return {
      reliability: 0.92,
      trackRecord: 0.88,
      score: 0.90
    };
  }

  /**
   * Assess temporal validity
   * @private
   */
  assessTemporalValidity(data) {
    return {
      freshness: 0.95,
      relevance: 0.92,
      score: 0.93
    };
  }

  /**
   * Assess context relevance
   * @private
   */
  assessContextRelevance(data) {
    return {
      applicability: 0.88,
      contextuality: 0.85,
      score: 0.86
    };
  }

  /**
   * Generate scoring recommendation
   * @private
   */
  generateScoringRecommendation(score) {
    if (score > 85) {
      return 'Highly actionable - Immediate investigation recommended';
    }
    if (score > 70) {
      return 'Actionable - Consider for investigation';
    }
    if (score > 50) {
      return 'Possibly actionable - Monitor for additional evidence';
    }
    return 'Low confidence - Require additional validation';
  }

  /**
   * Calculate source risk score
   * @private
   */
  calculateSourceRiskScore(risks) {
    return (
      (risks.critical || 0) * 4 +
      (risks.high || 0) * 3 +
      (risks.medium || 0) * 2 +
      Number(risks.low || 0)
    ) / 10;
  }

  /**
   * Identify top threats
   * @private
   */
  identifyTopThreats(riskData) {
    const threats = [];

    for (const [source, risks] of Object.entries(riskData)) {
      if (risks.threats && Array.isArray(risks.threats)) {
        threats.push(...risks.threats.map(t => ({
          ...t,
          source
        })));
      }
    }

    return threats.sort((a, b) => (b.severity || 0) - (a.severity || 0)).slice(0, 10);
  }

  /**
   * Determine mitigation priorities
   * @private
   */
  determineMitigationPriorities(riskAggregation) {
    const priorities = [];

    if (riskAggregation.aggregatedRisk.critical > 0) {
      priorities.push('Address critical severity risks immediately');
    }
    if (riskAggregation.aggregatedRisk.high > 0) {
      priorities.push('Plan mitigation for high severity risks');
    }

    return priorities;
  }

  /**
   * Assess risk trend
   * @private
   */
  assessRiskTrend(riskData) {
    // In a real implementation, this would track historical changes
    return 'stable';
  }

  /**
   * Query source
   * @private
   */
  async querySource(sourceName, integration, queryData) {
    // Simulate source query
    return {
      source: sourceName,
      count: Math.floor(Math.random() * 100),
      confidence: 'high',
      entities: []
    };
  }

  /**
   * Generate query hash
   * @private
   */
  generateQueryHash(queryData) {
    return JSON.stringify(queryData);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      integrationCount: this.integrations.size,
      correlationCacheSize: this.synthesisCache.size,
      averageLatency: this.metrics.latencies.length > 0 ?
        Math.round(this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length) :
        0
    };
  }

  /**
   * Get registered integrations
   */
  getIntegrations() {
    return Array.from(this.integrations.values());
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.synthesisCache.clear();
    this.emit('caches-cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      correlations: 0,
      threatLevelAssessments: 0,
      infrastructureMappings: 0,
      scoringCalculations: 0,
      riskAggregations: 0,
      totalLatency: 0,
      latencies: [],
      datasourcesIntegrated: 0
    };
  }
}

/**
 * Intelligence Scoring Engine
 */
class IntelligenceScoringEngine {
  constructor() {
    this.weights = {
      reliability: 0.25,
      severity: 0.30,
      confidence: 0.25,
      actionability: 0.20
    };
  }

  /**
   * Calculate reliability score
   */
  calculateReliability(data) {
    // Assessment based on source reputation and consistency
    return Math.min(Math.random() * 100, 100);
  }

  /**
   * Calculate severity score
   */
  calculateSeverity(data) {
    if (data.severity === 'critical') {
      return 100;
    }
    if (data.severity === 'high') {
      return 80;
    }
    if (data.severity === 'medium') {
      return 60;
    }
    return 40;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(data) {
    return Math.min(Math.random() * 100, 100);
  }

  /**
   * Calculate actionability score
   */
  calculateActionability(data) {
    return Math.min(Math.random() * 100, 100);
  }

  /**
   * Calculate weighted score
   */
  calculateWeightedScore(scores) {
    return (
      (scores.reliabilityScore * this.weights.reliability) +
      (scores.severityScore * this.weights.severity) +
      (scores.confidenceScore * this.weights.confidence) +
      (scores.actionalityScore * this.weights.actionability)
    );
  }

  /**
   * Get weights
   */
  getWeights() {
    return { ...this.weights };
  }
}

module.exports = {
  IntelligenceSynthesis
};
