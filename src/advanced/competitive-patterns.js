/**
 * Competitive Intelligence Pattern Detection
 * Identifies market positioning, technology adoption, and strategic patterns
 * @module src/advanced/competitive-patterns
 */

const EventEmitter = require('events');

/**
 * Competitive Pattern Types
 */
const COMPETITIVE_PATTERNS = {
  FEATURE_RELEASE: 'feature-release',
  TECHNOLOGY_ADOPTION: 'technology-adoption',
  MARKET_POSITIONING: 'market-positioning',
  PRICING_STRATEGY: 'pricing-strategy',
  STRATEGIC_MOVE: 'strategic-move',
  COORDINATED_ACTION: 'coordinated-action'
};

/**
 * Alert Thresholds
 */
const ALERT_THRESHOLDS = {
  SIGNIFICANT_MOVE: 0.75,
  MARKET_SHIFT: 0.80,
  COORDINATED_ACTIVITY: 0.85
};

/**
 * Competitive Pattern Detector Class
 */
class CompetitivePatternDetector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      minCompetitors: options.minCompetitors || 2,
      lookbackPeriod: options.lookbackPeriod || 180 * 24 * 60 * 60 * 1000, // 180 days
      correlationThreshold: options.correlationThreshold || 0.6,
      significanceMagnitude: options.significanceMagnitude || 0.1, // 10% change
      enableAlerts: options.enableAlerts !== false,
      ...options
    };

    // Data tracking
    this.competitorActivity = new Map(); // competitor -> [activities]
    this.technologiesUsed = new Map(); // competitor -> [technologies]
    this.marketPositioning = new Map(); // competitor -> { features, priceRange, positioning }
    this.strategicEvents = new Map(); // monitorId -> [strategic events]
    this.detectedPatterns = new Map(); // monitorId -> [patterns]
  }

  /**
   * Record competitor activity
   * @param {string} competitor - Competitor name
   * @param {Object} activity - Activity data
   */
  recordActivity(competitor, activity) {
    if (!this.competitorActivity.has(competitor)) {
      this.competitorActivity.set(competitor, []);
    }

    const record = {
      ...activity,
      timestamp: activity.timestamp || Date.now(),
      datetime: new Date(activity.timestamp || Date.now()).toISOString(),
      type: activity.type || 'change'
    };

    this.competitorActivity.get(competitor).push(record);

    // Trim old data
    const cutoff = Date.now() - this.options.lookbackPeriod;
    const filtered = this.competitorActivity.get(competitor).filter(a => a.timestamp >= cutoff);
    this.competitorActivity.set(competitor, filtered);
  }

  /**
   * Track technology adoption
   * @param {string} competitor - Competitor name
   * @param {string} technology - Technology name
   * @param {Object} metadata - Additional metadata
   */
  recordTechnology(competitor, technology, metadata = {}) {
    if (!this.technologiesUsed.has(competitor)) {
      this.technologiesUsed.set(competitor, []);
    }

    const tech = {
      technology,
      adoptedAt: Date.now(),
      ...metadata
    };

    const techs = this.technologiesUsed.get(competitor);
    const existing = techs.find(t => t.technology === technology);

    if (!existing) {
      techs.push(tech);
    } else {
      existing.lastSeen = Date.now();
    }
  }

  /**
   * Update market positioning
   * @param {string} competitor - Competitor name
   * @param {Object} positioning - Positioning data
   */
  updatePositioning(competitor, positioning) {
    const current = this.marketPositioning.get(competitor) || {};

    this.marketPositioning.set(competitor, {
      ...current,
      features: positioning.features || current.features || [],
      priceRange: positioning.priceRange || current.priceRange,
      targetMarket: positioning.targetMarket || current.targetMarket,
      positioning: positioning.positioning || current.positioning,
      updatedAt: Date.now()
    });
  }

  /**
   * Analyze feature release patterns
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Feature pattern analysis
   */
  analyzeFeatureReleases(monitorId) {
    const analysis = {
      monitorId,
      patterns: [],
      competitors: {},
      trends: []
    };

    // Analyze each competitor
    this.competitorActivity.forEach((activities, competitor) => {
      const featureReleases = activities.filter(a =>
        a.type === 'feature' || a.description?.includes('feature')
      );

      if (featureReleases.length > 0) {
        // Calculate release frequency
        const timespan = activities[activities.length - 1].timestamp - activities[0].timestamp;
        const frequency = featureReleases.length / (timespan / (30 * 24 * 60 * 60 * 1000)); // per month

        analysis.competitors[competitor] = {
          featureCount: featureReleases.length,
          frequency: frequency.toFixed(2),
          lastRelease: featureReleases[featureReleases.length - 1].timestamp,
          averageInterval: Math.round(timespan / featureReleases.length / (24 * 60 * 60 * 1000))
        };
      }
    });

    // Detect patterns
    const competitors = Object.entries(analysis.competitors);
    if (competitors.length >= this.options.minCompetitors) {
      const frequencies = competitors.map(([_, data]) => parseFloat(data.frequency));
      const avgFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
      const stdDev = Math.sqrt(frequencies.reduce((sum, f) => sum + Math.pow(f - avgFrequency, 2), 0) / frequencies.length);

      // Identify leaders and laggards
      competitors.forEach(([competitor, data]) => {
        const zscore = (parseFloat(data.frequency) - avgFrequency) / (stdDev || 1);
        if (Math.abs(zscore) > 1.5) {
          analysis.patterns.push({
            type: COMPETITIVE_PATTERNS.FEATURE_RELEASE,
            competitor,
            pattern: zscore > 0 ? 'aggressive-innovator' : 'conservative',
            frequency: data.frequency,
            zscore: zscore.toFixed(2),
            confidence: Math.min(1, Math.abs(zscore) / 3),
            description: zscore > 0
              ? `${competitor} releases features ${Math.abs(zscore).toFixed(1)}x more frequently than average`
              : `${competitor} releases features ${Math.abs(zscore).toFixed(1)}x less frequently than average`
          });
        }
      });
    }

    return analysis;
  }

  /**
   * Analyze technology adoption patterns
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Technology pattern analysis
   */
  analyzeTechnologyAdoption(monitorId) {
    const analysis = {
      monitorId,
      patterns: [],
      competitors: {},
      leadersFollowers: []
    };

    // Analyze technology adoption across competitors
    const techCounts = {};
    this.technologiesUsed.forEach((techs, competitor) => {
      analysis.competitors[competitor] = {
        technologiesCount: techs.length,
        technologies: techs.map(t => ({
          name: t.technology,
          adoptedAt: new Date(t.adoptedAt).toISOString(),
          ...t
        }))
      };

      techs.forEach(tech => {
        if (!techCounts[tech.technology]) {
          techCounts[tech.technology] = { count: 0, adoption: [] };
        }
        techCounts[tech.technology].count++;
        techCounts[tech.technology].adoption.push({
          competitor,
          timestamp: tech.adoptedAt
        });
      });
    });

    // Identify technology trends
    const sortedTechs = Object.entries(techCounts)
      .filter(([_, data]) => data.count >= this.options.minCompetitors)
      .sort((a, b) => b[1].count - a[1].count);

    sortedTechs.forEach(([tech, data]) => {
      const adoptions = data.adoption.sort((a, b) => a.timestamp - b.timestamp);
      const timespans = [];

      for (let i = 1; i < adoptions.length; i++) {
        timespans.push(adoptions[i].timestamp - adoptions[i - 1].timestamp);
      }

      const avgTimespan = timespans.reduce((a, b) => a + b, 0) / timespans.length / (24 * 60 * 60 * 1000);
      const leader = adoptions[0].competitor;
      const followers = adoptions.slice(1).map(a => a.competitor);

      analysis.patterns.push({
        type: COMPETITIVE_PATTERNS.TECHNOLOGY_ADOPTION,
        technology: tech,
        adoptionCount: data.count,
        leader,
        followers,
        averageLagDays: avgTimespan.toFixed(1),
        confidence: Math.min(1, data.count / this.competitorActivity.size),
        description: `${leader} adopted ${tech} first; ${followers.length} competitors followed an average of ${avgTimespan.toFixed(1)} days later`
      });
    });

    return analysis;
  }

  /**
   * Analyze market positioning patterns
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Market positioning analysis
   */
  analyzeMarketPositioning(monitorId) {
    const analysis = {
      monitorId,
      segments: {},
      positioning: [],
      competitiveGroupings: []
    };

    // Analyze price positioning
    const priceSegments = {};
    this.marketPositioning.forEach((pos, competitor) => {
      if (pos.priceRange) {
        const segment = this.categorizePrice(pos.priceRange);
        if (!priceSegments[segment]) {
          priceSegments[segment] = [];
        }
        priceSegments[segment].push({
          competitor,
          priceRange: pos.priceRange
        });
      }
    });

    analysis.segments = priceSegments;

    // Detect feature differentiation
    const featureSets = {};
    this.marketPositioning.forEach((pos, competitor) => {
      if (pos.features && pos.features.length > 0) {
        const signature = pos.features.sort().join('|');
        if (!featureSets[signature]) {
          featureSets[signature] = [];
        }
        featureSets[signature].push(competitor);
      }
    });

    // Identify unique positioning
    this.marketPositioning.forEach((pos, competitor) => {
      const competing = Array.from(this.marketPositioning.entries())
        .filter(([name, other]) => name !== competitor && other.priceRange === pos.priceRange)
        .map(([name]) => name);

      analysis.positioning.push({
        competitor,
        priceSegment: pos.priceRange ? this.categorizePrice(pos.priceRange) : 'unknown',
        featureCount: pos.features?.length || 0,
        directCompetitors: competing.length,
        competitors: competing,
        targetMarket: pos.targetMarket || 'general',
        description: this.describePositioning(competitor, pos)
      });
    });

    return analysis;
  }

  /**
   * Detect coordinated actions across competitors
   * @returns {Object} Coordinated activity analysis
   */
  detectCoordinatedActions() {
    const analysis = {
      coordinatedEvents: [],
      timing: {}
    };

    // Check for activities happening at similar times
    const timeWindows = {}; // timestamp ranges -> activities

    this.competitorActivity.forEach((activities, competitor) => {
      activities.forEach(activity => {
        // Create 7-day window
        const windowKey = Math.floor(activity.timestamp / (7 * 24 * 60 * 60 * 1000));

        if (!timeWindows[windowKey]) {
          timeWindows[windowKey] = [];
        }

        timeWindows[windowKey].push({
          competitor,
          activity,
          timestamp: activity.timestamp
        });
      });
    });

    // Find windows with multiple competitors
    Object.entries(timeWindows).forEach(([windowKey, events]) => {
      const competitors = new Set(events.map(e => e.competitor));

      if (competitors.size >= this.options.minCompetitors) {
        const avgTimestamp = events.reduce((sum, e) => sum + e.timestamp, 0) / events.length;
        const timespan = Math.max(...events.map(e => e.timestamp)) - Math.min(...events.map(e => e.timestamp));
        const daySpan = timespan / (24 * 60 * 60 * 1000);

        if (daySpan <= 14) { // Within 2 weeks
          analysis.coordinatedEvents.push({
            type: COMPETITIVE_PATTERNS.COORDINATED_ACTION,
            competitors: Array.from(competitors),
            eventCount: events.length,
            timespan: daySpan.toFixed(1),
            confidence: Math.min(1, competitors.size / this.competitorActivity.size),
            timestamp: new Date(avgTimestamp).toISOString(),
            events: events.map(e => ({
              competitor: e.competitor,
              description: e.activity.description || e.activity.type,
              timestamp: new Date(e.timestamp).toISOString()
            })),
            description: `${competitors.size} competitors coordinated activity within ${daySpan.toFixed(1)} days`
          });
        }
      }
    });

    return analysis;
  }

  /**
   * Detect market shifts
   * @returns {Object} Market shift analysis
   */
  detectMarketShifts() {
    const analysis = {
      shifts: [],
      magnitude: 0
    };

    // Calculate positioning changes over time
    const timeSlices = this.createTimeSlices();

    if (timeSlices.length < 2) {
      return analysis;
    }

    // Compare consecutive time slices
    for (let i = 1; i < timeSlices.length; i++) {
      const before = timeSlices[i - 1];
      const after = timeSlices[i];

      const shift = this.comparePositioning(before, after);

      if (shift.magnitude >= ALERT_THRESHOLDS.MARKET_SHIFT) {
        analysis.shifts.push(shift);
      }
    }

    analysis.magnitude = analysis.shifts.reduce((sum, s) => sum + s.magnitude, 0) / Math.max(1, analysis.shifts.length);

    return analysis;
  }

  /**
   * Get strategic insights
   * @returns {Object} Strategic intelligence
   */
  getStrategicInsights() {
    const insights = {
      marketLeaders: [],
      innovations: [],
      risks: [],
      opportunities: []
    };

    // Identify market leaders
    const activityScores = new Map();
    this.competitorActivity.forEach((activities, competitor) => {
      activityScores.set(competitor, activities.length);
    });

    const sorted = Array.from(activityScores.entries())
      .sort((a, b) => b[1] - a[1]);

    insights.marketLeaders = sorted.slice(0, 3).map(([competitor, count]) => ({
      competitor,
      activityCount: count,
      description: `${competitor} shows high activity with ${count} recorded changes`
    }));

    // Identify innovations (rare features/technologies)
    const techFrequency = {};
    this.technologiesUsed.forEach((techs, competitor) => {
      techs.forEach(tech => {
        techFrequency[tech.technology] = (techFrequency[tech.technology] || 0) + 1;
      });
    });

    const rareTeches = Object.entries(techFrequency)
      .filter(([_, count]) => count === 1)
      .map(([tech, _]) => {
        const adopter = Array.from(this.technologiesUsed.entries())
          .find(([_, techs]) => techs.some(t => t.technology === tech))?.[0];

        return {
          technology: tech,
          innovator: adopter,
          description: `${adopter} uniquely adopted ${tech}`
        };
      });

    insights.innovations = rareTeches.slice(0, 5);

    return insights;
  }

  /**
   * Categorize price
   * @private
   */
  categorizePrice(priceRange) {
    if (!priceRange) return 'unknown';

    if (typeof priceRange === 'object') {
      const avg = (priceRange.min + priceRange.max) / 2;
      if (avg < 50) return 'budget';
      if (avg < 200) return 'midmarket';
      if (avg < 1000) return 'premium';
      return 'enterprise';
    }

    if (priceRange < 50) return 'budget';
    if (priceRange < 200) return 'midmarket';
    if (priceRange < 1000) return 'premium';
    return 'enterprise';
  }

  /**
   * Describe positioning
   * @private
   */
  describePositioning(competitor, positioning) {
    const features = positioning.features?.length || 0;
    const segment = this.categorizePrice(positioning.priceRange);

    return `${competitor} positions as ${segment}-tier with ${features} key features, targeting ${positioning.targetMarket || 'general market'}`;
  }

  /**
   * Create time slices for comparison
   * @private
   */
  createTimeSlices() {
    const sliceSize = 30 * 24 * 60 * 60 * 1000; // 30 days
    const slices = [];

    const now = Date.now();
    const minTime = now - this.options.lookbackPeriod;

    for (let time = minTime; time < now; time += sliceSize) {
      slices.push({
        startTime: time,
        endTime: time + sliceSize,
        positioning: this.getPositioningAt(time, time + sliceSize)
      });
    }

    return slices;
  }

  /**
   * Get positioning within time range
   * @private
   */
  getPositioningAt(start, end) {
    const positioning = {};
    this.marketPositioning.forEach((pos, competitor) => {
      if (pos.updatedAt >= start && pos.updatedAt <= end) {
        positioning[competitor] = pos;
      }
    });
    return positioning;
  }

  /**
   * Compare positioning between time periods
   * @private
   */
  comparePositioning(before, after) {
    let changes = 0;
    let competitors = new Set([
      ...Object.keys(before.positioning),
      ...Object.keys(after.positioning)
    ]);

    competitors.forEach(competitor => {
      const posBefore = before.positioning[competitor];
      const posAfter = after.positioning[competitor];

      if (!posBefore || !posAfter) {
        changes++;
        return;
      }

      // Compare features
      const beforeSet = new Set(posBefore.features || []);
      const afterSet = new Set(posAfter.features || []);
      const difference = new Set([...beforeSet].filter(f => !afterSet.has(f)));

      if (difference.size > 0) {
        changes += difference.size;
      }
    });

    const magnitude = changes / Math.max(1, competitors.size);

    return {
      magnitude,
      changes,
      competitorsAffected: competitors.size,
      description: `${changes} changes across ${competitors.size} competitors`
    };
  }

  /**
   * Get summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    return {
      competitors: this.competitorActivity.size,
      totalActivities: Array.from(this.competitorActivity.values()).reduce((sum, arr) => sum + arr.length, 0),
      technologiesTracked: Array.from(this.technologiesUsed.values()).reduce((sum, arr) => sum + arr.length, 0),
      positioningUpdates: this.marketPositioning.size,
      patterns: this.detectedPatterns.size
    };
  }
}

module.exports = {
  CompetitivePatternDetector,
  COMPETITIVE_PATTERNS,
  ALERT_THRESHOLDS
};
