/**
 * Insights Engine - Generate actionable business intelligence from monitoring data
 * Analyzes patterns, correlations, and competitive movements to produce strategic insights
 * @module src/advanced/insights-engine
 */

const EventEmitter = require('events');

/**
 * Insight Types
 */
const INSIGHT_TYPES = {
  COMPETITIVE_MOVE: 'competitive-move',
  MARKET_TREND: 'market-trend',
  PRICING_INTELLIGENCE: 'pricing-intelligence',
  TECHNOLOGY_SHIFT: 'technology-shift',
  STRATEGIC_OPPORTUNITY: 'strategic-opportunity',
  THREAT_DETECTION: 'threat-detection',
  ANOMALY_INSIGHT: 'anomaly-insight'
};

/**
 * Insight Confidence Levels
 */
const CONFIDENCE_LEVELS = {
  VERY_HIGH: 0.9,
  HIGH: 0.75,
  MEDIUM: 0.6,
  LOW: 0.4
};

/**
 * Insights Engine Class
 */
class InsightsEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      minDataPoints: options.minDataPoints || 10,
      insightHorizon: options.insightHorizon || 7 * 24 * 60 * 60 * 1000, // 7 days
      correlationThreshold: options.correlationThreshold || 0.6,
      enableAlerts: options.enableAlerts !== false,
      retentionDays: options.retentionDays || 30,
      ...options
    };

    // Storage
    this.insights = [];
    this.analysisHistory = new Map(); // analysisId -> analysis data
    this.correlations = new Map(); // pair -> correlation data
  }

  /**
   * Generate insights from multiple data sources
   * @param {Object} data - Analysis data containing monitoring information
   * @returns {Array} Generated insights
   */
  generateInsights(data) {
    const insights = [];

    // Extract insights from different data sources
    if (data.anomalies) {
      insights.push(...this.analyzeAnomalies(data.anomalies));
    }

    if (data.priceData) {
      insights.push(...this.analyzePrices(data.priceData));
    }

    if (data.patterns) {
      insights.push(...this.analyzePatterns(data.patterns));
    }

    if (data.competitiveActivity) {
      insights.push(...this.analyzeCompetitiveActivity(data.competitiveActivity));
    }

    if (data.technologies) {
      insights.push(...this.analyzeTechnologyShifts(data.technologies));
    }

    // Synthesize cross-cutting insights
    if (insights.length > 0) {
      insights.push(...this.synthesizeInsights(insights));
    }

    // Rank and deduplicate
    const rankedInsights = this.rankInsights(insights);

    // Store insights
    rankedInsights.forEach(insight => {
      insight.id = this.generateInsightId();
      insight.timestamp = Date.now();
      insight.datetime = new Date().toISOString();
      this.insights.push(insight);
    });

    // Emit events
    if (this.options.enableAlerts) {
      rankedInsights.filter(i => i.confidence >= CONFIDENCE_LEVELS.HIGH)
        .forEach(insight => {
          this.emit('high-confidence-insight', insight);
        });
    }

    // Cleanup old insights
    this.cleanup();

    return rankedInsights;
  }

  /**
   * Analyze anomalies for insights
   * @private
   */
  analyzeAnomalies(anomalies) {
    const insights = [];

    if (!anomalies || anomalies.length === 0) return insights;

    // Group anomalies by type
    const byType = {};
    anomalies.forEach(anomaly => {
      const type = anomaly.severity || 'medium';
      if (!byType[type]) byType[type] = [];
      byType[type].push(anomaly);
    });

    // Detect anomaly clusters
    Object.entries(byType).forEach(([severity, items]) => {
      if (items.length >= 3) {
        const timespan = items[items.length - 1].timestamp - items[0].timestamp;
        const hoursSpan = timespan / (60 * 60 * 1000);

        if (hoursSpan <= 24) {
          insights.push({
            type: INSIGHT_TYPES.ANOMALY_INSIGHT,
            title: `${items.length} ${severity} anomalies detected within 24 hours`,
            description: `Unusual activity surge detected: ${items.length} anomalies of ${severity} severity clustered within ${Math.round(hoursSpan)} hours`,
            details: {
              anomalyCount: items.length,
              severity,
              timespan: hoursSpan,
              monitors: new Set(items.map(a => a.monitorId)).size
            },
            confidence: Math.min(CONFIDENCE_LEVELS.VERY_HIGH, 0.5 + (items.length * 0.1)),
            severity: severity,
            actionable: true,
            recommendation: 'Review recent competitor activities and market conditions'
          });
        }
      }
    });

    return insights;
  }

  /**
   * Analyze pricing data for insights
   * @private
   */
  analyzePrices(priceData) {
    const insights = [];

    if (!priceData || Object.keys(priceData).length === 0) return insights;

    // Analyze price movements
    const priceMovements = {};
    Object.entries(priceData).forEach(([competitor, history]) => {
      if (history && history.length >= 2) {
        const recent = history.slice(-5);
        const older = history.slice(0, 5);

        const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
        const olderAvg = older.reduce((sum, p) => sum + p, 0) / older.length;

        const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (Math.abs(changePercent) > 5) {
          priceMovements[competitor] = changePercent;
        }
      }
    });

    // Identify price leaders
    const sortedMovements = Object.entries(priceMovements)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (sortedMovements.length > 0) {
      const [leader, movement] = sortedMovements[0];
      const direction = movement > 0 ? 'increased' : 'decreased';

      insights.push({
        type: INSIGHT_TYPES.PRICING_INTELLIGENCE,
        title: `${leader} leads pricing movement with ${Math.abs(movement).toFixed(1)}% ${direction}`,
        description: `Competitor pricing analysis shows ${leader} ${direction} prices by ${Math.abs(movement).toFixed(1)}%, which may indicate market positioning shift or competitive response`,
        details: {
          leader,
          movement: movement.toFixed(1),
          direction,
          followers: sortedMovements.slice(1, 4).map(([c, m]) => ({ competitor: c, movement: m.toFixed(1) }))
        },
        confidence: CONFIDENCE_LEVELS.HIGH,
        severity: Math.abs(movement) > 10 ? 'high' : 'medium',
        actionable: true,
        recommendation: `Monitor ${leader}'s market response and adjust pricing strategy accordingly`
      });
    }

    // Detect price convergence
    const competitors = Object.keys(priceData);
    if (competitors.length >= 2) {
      const prices = competitors.map(c => {
        const history = priceData[c];
        return history ? history[history.length - 1] : null;
      }).filter(p => p !== null);

      if (prices.length >= 2) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const convergenceScore = (range / avg) * 100;

        if (convergenceScore < 10) {
          insights.push({
            type: INSIGHT_TYPES.MARKET_TREND,
            title: 'Market price convergence detected',
            description: `Competitors' prices are converging (${convergenceScore.toFixed(1)}% range), indicating commoditization or stable market equilibrium`,
            details: {
              convergenceScore,
              priceRange: `$${min.toFixed(2)} - $${max.toFixed(2)}`
            },
            confidence: CONFIDENCE_LEVELS.MEDIUM,
            severity: 'low',
            actionable: true,
            recommendation: 'Focus on differentiation through features or service rather than price competition'
          });
        }
      }
    }

    return insights;
  }

  /**
   * Analyze patterns for insights
   * @private
   */
  analyzePatterns(patterns) {
    const insights = [];

    if (!patterns || patterns.length === 0) return insights;

    // Identify consistent patterns
    const consistentPatterns = patterns.filter(p => p.confidence >= CONFIDENCE_LEVELS.MEDIUM);

    if (consistentPatterns.length >= 2) {
      insights.push({
        type: INSIGHT_TYPES.MARKET_TREND,
        title: `${consistentPatterns.length} consistent patterns detected`,
        description: `Multiple predictable patterns identified across monitors, enabling proactive monitoring and prediction of competitive moves`,
        details: {
          patternCount: consistentPatterns.length,
          patterns: consistentPatterns.map(p => ({
            type: p.type,
            description: p.description,
            confidence: p.confidence.toFixed(2)
          }))
        },
        confidence: CONFIDENCE_LEVELS.HIGH,
        severity: 'low',
        actionable: false,
        recommendation: 'Use detected patterns for predictive alerting'
      });
    }

    // Identify release cycles
    const releasePatterns = patterns.filter(p => p.type === 'release-schedule');
    if (releasePatterns.length > 0) {
      const pattern = releasePatterns[0];
      insights.push({
        type: INSIGHT_TYPES.COMPETITIVE_MOVE,
        title: `Release schedule identified: Every ${pattern.intervalDays} days`,
        description: `Competitor releases updates on a consistent ${pattern.intervalDays}-day cycle with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
        details: {
          cycle: `${pattern.intervalDays} days`,
          confidence: pattern.confidence,
          nextPredicted: pattern.nextPredicted
        },
        confidence: pattern.confidence,
        severity: 'low',
        actionable: true,
        recommendation: 'Plan feature releases strategically around competitor cycles'
      });
    }

    return insights;
  }

  /**
   * Analyze competitive activity for insights
   * @private
   */
  analyzeCompetitiveActivity(activities) {
    const insights = [];

    if (!activities || activities.length === 0) return insights;

    // Analyze activity intensity
    const activityByCompetitor = {};
    activities.forEach(activity => {
      if (!activityByCompetitor[activity.competitor]) {
        activityByCompetitor[activity.competitor] = [];
      }
      activityByCompetitor[activity.competitor].push(activity);
    });

    // Identify market leaders
    const competitors = Object.entries(activityByCompetitor)
      .map(([competitor, acts]) => ({
        competitor,
        count: acts.length,
        recent: acts.filter(a => Date.now() - a.timestamp < 30 * 24 * 60 * 60 * 1000).length
      }))
      .sort((a, b) => b.count - a.count);

    if (competitors.length > 0) {
      const leader = competitors[0];
      const avg = competitors.reduce((sum, c) => sum + c.count, 0) / competitors.length;

      if (leader.count > avg * 1.5) {
        insights.push({
          type: INSIGHT_TYPES.COMPETITIVE_MOVE,
          title: `${leader.competitor} showing aggressive activity`,
          description: `${leader.competitor} is ${(leader.count / avg).toFixed(1)}x more active than competitors, indicating aggressive growth strategy`,
          details: {
            competitor: leader.competitor,
            activityCount: leader.count,
            recentActivity: leader.recent,
            averageCompetitor: avg.toFixed(0)
          },
          confidence: CONFIDENCE_LEVELS.HIGH,
          severity: 'high',
          actionable: true,
          recommendation: `Increase monitoring intensity for ${leader.competitor} and review their strategic initiatives`
        });
      }
    }

    // Detect coordinated moves
    if (activities.length >= 3) {
      const timeWindows = {};
      activities.forEach(activity => {
        const window = Math.floor(activity.timestamp / (7 * 24 * 60 * 60 * 1000));
        if (!timeWindows[window]) timeWindows[window] = [];
        timeWindows[window].push(activity);
      });

      Object.entries(timeWindows).forEach(([window, acts]) => {
        const competitors = new Set(acts.map(a => a.competitor));
        if (competitors.size >= 3) {
          insights.push({
            type: INSIGHT_TYPES.THREAT_DETECTION,
            title: `Coordinated competitor activity detected`,
            description: `${competitors.size} competitors made moves within the same week, suggesting market response to shared stimulus`,
            details: {
              competitors: Array.from(competitors),
              count: acts.length
            },
            confidence: CONFIDENCE_LEVELS.MEDIUM,
            severity: 'medium',
            actionable: true,
            recommendation: 'Investigate potential market catalysts affecting multiple competitors'
          });
        }
      });
    }

    return insights;
  }

  /**
   * Analyze technology shifts for insights
   * @private
   */
  analyzeTechnologyShifts(technologies) {
    const insights = [];

    if (!technologies || technologies.length === 0) return insights;

    // Identify technology trends
    const techCounts = {};
    const techAdopters = {};

    technologies.forEach(tech => {
      const name = tech.technology || tech.name;
      if (!techCounts[name]) {
        techCounts[name] = 0;
        techAdopters[name] = [];
      }
      techCounts[name]++;
      techAdopters[name].push(tech.competitor);
    });

    // Identify trending technologies
    const trending = Object.entries(techCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (trending.length > 0) {
      const [tech, count] = trending[0];

      insights.push({
        type: INSIGHT_TYPES.TECHNOLOGY_SHIFT,
        title: `${tech} adoption accelerating across market`,
        description: `${count} competitors have adopted ${tech}, indicating emerging technology standard in the market`,
        details: {
          technology: tech,
          adopters: techAdopters[tech].slice(0, 5),
          adoptionRate: count
        },
        confidence: CONFIDENCE_LEVELS.HIGH,
        severity: 'medium',
        actionable: true,
        recommendation: `Evaluate adoption of ${tech} to maintain competitive parity`
      });
    }

    // Identify unique technology positions
    const rareTeches = Object.entries(techCounts)
      .filter(([_, count]) => count === 1);

    if (rareTeches.length > 0) {
      rareTeches.slice(0, 1).forEach(([tech, _]) => {
        const adopter = techAdopters[tech][0];

        insights.push({
          type: INSIGHT_TYPES.STRATEGIC_OPPORTUNITY,
          title: `${adopter} has unique technology advantage`,
          description: `${adopter} is the only competitor using ${tech}, representing a potential innovation advantage or market differentiation`,
          details: {
            technology: tech,
            innovator: adopter
          },
          confidence: CONFIDENCE_LEVELS.MEDIUM,
          severity: 'low',
          actionable: true,
          recommendation: `Monitor ${adopter}'s success with ${tech} for potential adoption roadmap`
        });
      });
    }

    return insights;
  }

  /**
   * Synthesize cross-cutting insights
   * @private
   */
  synthesizeInsights(baseInsights) {
    const synthesized = [];

    // Combine related insights
    const byType = {};
    baseInsights.forEach(insight => {
      const type = insight.type;
      if (!byType[type]) byType[type] = [];
      byType[type].push(insight);
    });

    // Detect patterns across insight types
    if (byType[INSIGHT_TYPES.COMPETITIVE_MOVE]?.length >= 2) {
      const avgSeverity = byType[INSIGHT_TYPES.COMPETITIVE_MOVE]
        .reduce((sum, i) => sum + (i.severity === 'high' ? 1 : 0), 0) / byType[INSIGHT_TYPES.COMPETITIVE_MOVE].length;

      if (avgSeverity > 0.5) {
        synthesized.push({
          type: INSIGHT_TYPES.STRATEGIC_OPPORTUNITY,
          title: 'Market consolidation trend detected',
          description: 'Multiple competitors showing coordinated competitive moves, indicating potential market consolidation phase',
          details: {
            moveCount: byType[INSIGHT_TYPES.COMPETITIVE_MOVE].length
          },
          confidence: CONFIDENCE_LEVELS.MEDIUM,
          severity: 'high',
          actionable: true,
          recommendation: 'Prepare strategic response to market consolidation'
        });
      }
    }

    return synthesized;
  }

  /**
   * Rank insights by importance and actionability
   * @private
   */
  rankInsights(insights) {
    return insights.sort((a, b) => {
      // Priority: high severity, high confidence, actionable
      const scoreA = (a.severity === 'high' ? 10 : 5) + (a.confidence * 5) + (a.actionable ? 3 : 0);
      const scoreB = (b.severity === 'high' ? 10 : 5) + (b.confidence * 5) + (b.actionable ? 3 : 0);
      return scoreB - scoreA;
    });
  }

  /**
   * Generate insight ID
   * @private
   */
  generateInsightId() {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get insights filtered
   * @param {Object} filter - Filter criteria
   * @returns {Array} Filtered insights
   */
  getInsights(filter = {}) {
    let result = this.insights;

    if (filter.type) {
      result = result.filter(i => i.type === filter.type);
    }

    if (filter.severity) {
      result = result.filter(i => i.severity === filter.severity);
    }

    if (filter.actionable !== undefined) {
      result = result.filter(i => i.actionable === filter.actionable);
    }

    if (filter.minConfidence) {
      result = result.filter(i => i.confidence >= filter.minConfidence);
    }

    if (filter.since) {
      result = result.filter(i => i.timestamp >= filter.since);
    }

    if (filter.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * Get top insights
   * @param {number} count - Number of insights
   * @returns {Array} Top insights
   */
  getTopInsights(count = 5) {
    return this.insights
      .filter(i => i.confidence >= CONFIDENCE_LEVELS.MEDIUM)
      .sort((a, b) => {
        const scoreA = (a.severity === 'high' ? 10 : 5) + (a.confidence * 5);
        const scoreB = (b.severity === 'high' ? 10 : 5) + (b.confidence * 5);
        return scoreB - scoreA;
      })
      .slice(0, count);
  }

  /**
   * Cleanup old insights
   */
  cleanup() {
    const cutoff = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);
    this.insights = this.insights.filter(i => i.timestamp >= cutoff);
  }

  /**
   * Get summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const actionable = this.insights.filter(i => i.actionable);
    const high = this.insights.filter(i => i.severity === 'high');

    return {
      total: this.insights.length,
      actionable: actionable.length,
      highSeverity: high.length,
      byType: this.insights.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {}),
      topInsights: this.getTopInsights(3)
    };
  }
}

module.exports = {
  InsightsEngine,
  INSIGHT_TYPES,
  CONFIDENCE_LEVELS
};
