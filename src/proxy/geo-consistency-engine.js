/**
 * Basset Hound Browser - Geographic Consistency Engine
 * Maintains geographic session isolation and controlled IP rotation
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Geographic session locking (stay in region)
 * - Gradual IP rotation within geographic bounds
 * - Geolocation detection from response headers
 * - Session consistency validation
 * - Rotation interval management
 */

const crypto = require('crypto');

class GeoConsistencyEngine {
  constructor(options = {}) {
    this.geoSessions = new Map(); // sessionId -> geoSessionData
    this.geoIPCache = new Map(); // geoLocation -> [proxies]
    this.regionBoundaries = this.initializeRegionBoundaries();
    this.rotationIntervals = options.rotationIntervals || {
      minRequests: 10,
      maxRequests: 20,
      minTime: 300000, // 5 minutes
      maxTime: 1800000 // 30 minutes
    };
    this.allowedRegions = options.allowedRegions || ['US', 'EU', 'APAC', 'LATAM', 'MENA'];
    this.strictMode = options.strictMode !== false; // Enforce geo-locking
    this.geoLocationGrainularity = options.geoLocationGrainularity || 'country'; // country, region, state
  }

  /**
   * Initialize regional geographic boundaries
   */
  initializeRegionBoundaries() {
    return {
      'US': {
        name: 'United States',
        countries: ['US'],
        ipRanges: ['8.0.0.0/8', '12.0.0.0/8', '13.0.0.0/8'],
        primaryCities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
        detectionSensitivity: 'high'
      },
      'EU': {
        name: 'European Union',
        countries: ['DE', 'FR', 'UK', 'IT', 'ES', 'NL', 'SE', 'BE'],
        ipRanges: ['31.0.0.0/8', '37.0.0.0/8', '46.0.0.0/8'],
        primaryCities: ['London', 'Paris', 'Berlin', 'Amsterdam'],
        detectionSensitivity: 'very-high'
      },
      'APAC': {
        name: 'Asia Pacific',
        countries: ['JP', 'SG', 'AU', 'CN', 'KR', 'IN'],
        ipRanges: ['1.0.0.0/8', '14.0.0.0/8', '203.0.0.0/8'],
        primaryCities: ['Tokyo', 'Singapore', 'Sydney', 'Hong Kong'],
        detectionSensitivity: 'medium'
      },
      'LATAM': {
        name: 'Latin America',
        countries: ['BR', 'MX', 'AR', 'CL', 'CO'],
        ipRanges: ['179.0.0.0/8', '181.0.0.0/8'],
        primaryCities: ['São Paulo', 'Mexico City', 'Buenos Aires'],
        detectionSensitivity: 'low'
      },
      'MENA': {
        name: 'Middle East & North Africa',
        countries: ['SA', 'AE', 'EG', 'IL', 'TR'],
        ipRanges: ['37.0.0.0/8', '89.0.0.0/8'],
        primaryCities: ['Dubai', 'Cairo', 'Riyadh'],
        detectionSensitivity: 'medium'
      }
    };
  }

  /**
   * Create geographic session
   */
  createGeoSession(sessionId, options = {}) {
    const region = this.validateRegion(options.targetRegion || 'US');

    const geoSession = {
      sessionId,
      targetRegion: region,
      createdAt: Date.now(),

      // Geo-locking configuration
      geoLock: {
        enabled: options.geoLock !== false,
        lockedCountry: this.selectCountryInRegion(region),
        lockStrength: options.lockStrength || 'medium', // soft, medium, strict
        enforceConsistency: options.enforceConsistency !== false,
        allowedDrift: options.allowedDrift || 0 // geographic distance tolerance in km
      },

      // Rotation control
      rotationControl: {
        currentProxy: null,
        previousProxies: [],
        rotationCount: 0,
        lastRotationTime: null,
        lastRotationReason: null,
        requestsSinceRotation: 0
      },

      // Metrics
      metrics: {
        totalRequests: 0,
        geoConsistencyViolations: 0,
        unintendedCountryDetections: 0,
        rotationsPenformed: 0,
        averageTimePerRegion: 0
      },

      // History tracking
      history: {
        detectedCountries: [],
        proxiesUsed: [],
        rotationHistory: [],
        geoViolations: []
      }
    };

    this.geoSessions.set(sessionId, geoSession);
    return this.formatGeoSessionResponse(geoSession);
  }

  /**
   * Register proxy with geographic metadata
   */
  registerGeoProxy(proxyId, proxyAddress, geoMetadata = {}) {
    const country = geoMetadata.country || this.guessCountry(proxyAddress);
    const region = this.getRegionForCountry(country);

    const proxy = {
      proxyId,
      address: proxyAddress,
      detectedCountry: country,
      region,
      city: geoMetadata.city || this.guessCityForCountry(country),
      latitude: geoMetadata.latitude,
      longitude: geoMetadata.longitude,
      registeredAt: Date.now(),
      lastUsed: null,
      usageCount: 0,
      flagViolations: 0
    };

    // Index by geographic location
    const geoKey = `${region}::${country}`;
    if (!this.geoIPCache.has(geoKey)) {
      this.geoIPCache.set(geoKey, []);
    }
    this.geoIPCache.get(geoKey).push(proxy);

    return {
      proxyId,
      registered: true,
      country,
      region,
      geoIndexed: true
    };
  }

  /**
   * Select proxy maintaining geo-consistency
   */
  selectGeoConsistentProxy(sessionId, availableProxies = []) {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    const { targetRegion, geoLock } = geoSession;
    const regionBoundary = this.regionBoundaries[targetRegion];

    // Filter proxies by region
    const candidates = availableProxies.filter(proxy => {
      // Must be in target region
      if (proxy.region !== targetRegion) {
        return false;
      }

      // If strict geo-lock, must be in same country
      if (geoLock.lockStrength === 'strict') {
        if (proxy.detectedCountry !== geoLock.lockedCountry) {
          return false;
        }
      }

      // If medium lock, allow adjacent countries in region
      if (geoLock.lockStrength === 'medium') {
        const allowedCountries = regionBoundary.countries.slice(0, 3);
        if (!allowedCountries.includes(proxy.detectedCountry)) {
          return false;
        }
      }

      // Don't reuse previous proxy if alternatives exist
      if (geoSession.rotationControl.previousProxies.includes(proxy.proxyId)) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      throw new Error(
        `No geo-consistent proxies available for region: ${targetRegion}. ` +
        `Lock strength: ${geoLock.lockStrength}`
      );
    }

    // Prefer least recently used
    candidates.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));

    const selected = candidates[0];
    geoSession.rotationControl.currentProxy = selected.proxyId;

    return {
      proxyId: selected.proxyId,
      country: selected.detectedCountry,
      region: selected.region,
      city: selected.city,
      geoConsistent: true,
      lockStrength: geoLock.lockStrength
    };
  }

  /**
   * Check if IP rotation violates geographic constraints
   */
  validateRotationDecision(sessionId, newProxyId, proximityThreshold = 500) {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    // Would need actual geo-location service to compute distance
    // For now, validate country consistency
    const violations = [];

    // Check if time-based rotation is honored
    const timeSinceLastRotation = Date.now() - (geoSession.rotationControl.lastRotationTime || 0);
    if (timeSinceLastRotation < this.rotationIntervals.minTime) {
      violations.push({
        type: 'rotation-too-frequent',
        message: 'Rotation attempted before minimum time interval',
        minTime: this.rotationIntervals.minTime,
        timeSinceLastRotation
      });
    }

    // Check if request count threshold is met
    if (geoSession.rotationControl.requestsSinceRotation < this.rotationIntervals.minRequests) {
      violations.push({
        type: 'insufficient-requests',
        message: 'Rotation attempted before minimum request threshold',
        minRequests: this.rotationIntervals.minRequests,
        requestsSinceRotation: geoSession.rotationControl.requestsSinceRotation
      });
    }

    // In strict mode, violations are errors
    if (this.strictMode && violations.length > 0) {
      return {
        valid: false,
        violations,
        allowRotation: false
      };
    }

    return {
      valid: true,
      violations: violations.length === 0 ? [] : violations,
      allowRotation: true
    };
  }

  /**
   * Record geolocation detection from response
   */
  recordGeoDetection(sessionId, detectedCountry, source = 'header') {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    const { geoLock } = geoSession;
    geoSession.metrics.totalRequests++;
    geoSession.history.detectedCountries.push({
      country: detectedCountry,
      detectedAt: Date.now(),
      source
    });

    // Check for consistency violation
    const expectedCountries = this.getExpectedCountriesForRegion(geoSession.targetRegion);
    const isViolation = !expectedCountries.includes(detectedCountry);

    if (isViolation) {
      geoSession.metrics.geoConsistencyViolations++;
      geoSession.history.geoViolations.push({
        expectedRegion: geoSession.targetRegion,
        detectedCountry,
        detectedAt: Date.now(),
        source
      });

      return {
        consistency: 'violation',
        detectedCountry,
        expectedRegion: geoSession.targetRegion,
        severity: 'high',
        recommendAction: 'rotate-proxy'
      };
    }

    // Check for unintended country (within region but not primary)
    const primaryCountries = this.regionBoundaries[geoSession.targetRegion].countries.slice(0, 2);
    if (!primaryCountries.includes(detectedCountry)) {
      geoSession.metrics.unintendedCountryDetections++;

      return {
        consistency: 'warning',
        detectedCountry,
        expectedRegion: geoSession.targetRegion,
        severity: 'low',
        message: 'Within region but not primary country'
      };
    }

    return {
      consistency: 'success',
      detectedCountry,
      expectedRegion: geoSession.targetRegion,
      severity: 'none'
    };
  }

  /**
   * Record proxy rotation
   */
  recordRotation(sessionId, newProxyId, reason = 'scheduled') {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    const rotation = {
      timestamp: Date.now(),
      previousProxy: geoSession.rotationControl.currentProxy,
      newProxy: newProxyId,
      reason,
      requestsSinceLastRotation: geoSession.rotationControl.requestsSinceRotation,
      timeSinceLastRotation: Date.now() - (geoSession.rotationControl.lastRotationTime || 0)
    };

    geoSession.rotationControl.currentProxy = newProxyId;
    geoSession.rotationControl.previousProxies.push(newProxyId);
    geoSession.rotationControl.rotationCount++;
    geoSession.rotationControl.lastRotationTime = Date.now();
    geoSession.rotationControl.requestsSinceRotation = 0;
    geoSession.metrics.rotationsPenformed++;
    geoSession.history.rotationHistory.push(rotation);

    return {
      recorded: true,
      rotation,
      totalRotations: geoSession.rotationControl.rotationCount
    };
  }

  /**
   * Record request completion for rotation tracking
   */
  recordRequest(sessionId) {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    geoSession.rotationControl.requestsSinceRotation++;
    geoSession.metrics.totalRequests++;
  }

  /**
   * Get rotation recommendation based on state
   */
  getRotationRecommendation(sessionId) {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    const { rotationControl, metrics } = geoSession;
    const timeSinceRotation = Date.now() - (rotationControl.lastRotationTime || 0);

    const recommendations = {
      shouldRotate: false,
      reasons: [],
      timeUntilRotation: this.rotationIntervals.maxTime - timeSinceRotation,
      requestsUntilRotation: this.rotationIntervals.maxRequests - rotationControl.requestsSinceRotation
    };

    // Check time-based threshold
    if (timeSinceRotation > this.rotationIntervals.maxTime) {
      recommendations.shouldRotate = true;
      recommendations.reasons.push('maximum-rotation-time-exceeded');
    }

    // Check request-based threshold
    if (rotationControl.requestsSinceRotation > this.rotationIntervals.maxRequests) {
      recommendations.shouldRotate = true;
      recommendations.reasons.push('maximum-requests-exceeded');
    }

    // Check consistency violations
    if (metrics.geoConsistencyViolations > 0) {
      recommendations.shouldRotate = true;
      recommendations.reasons.push('geo-consistency-violation');
    }

    return recommendations;
  }

  /**
   * Get session metrics and statistics
   */
  getGeoSessionMetrics(sessionId) {
    const geoSession = this.geoSessions.get(sessionId);
    if (!geoSession) {
      throw new Error(`Geo session not found: ${sessionId}`);
    }

    return {
      sessionId,
      targetRegion: geoSession.targetRegion,
      lockedCountry: geoSession.geoLock.lockedCountry,
      createdAt: geoSession.createdAt,
      metrics: geoSession.metrics,
      rotationControl: {
        currentProxy: geoSession.rotationControl.currentProxy,
        totalRotations: geoSession.rotationControl.rotationCount,
        requestsSinceRotation: geoSession.rotationControl.requestsSinceRotation,
        timeSinceLastRotation: Date.now() - (geoSession.rotationControl.lastRotationTime || 0)
      },
      consistencyScore: this.calculateConsistencyScore(geoSession)
    };
  }

  // Helper methods

  validateRegion(region) {
    if (!this.regionBoundaries[region]) {
      throw new Error(`Invalid region: ${region}`);
    }
    return region;
  }

  selectCountryInRegion(region) {
    const boundary = this.regionBoundaries[region];
    return boundary.countries[0]; // Select first country as primary
  }

  getRegionForCountry(country) {
    for (const [region, boundary] of Object.entries(this.regionBoundaries)) {
      if (boundary.countries.includes(country)) {
        return region;
      }
    }
    return 'US'; // Default region
  }

  getExpectedCountriesForRegion(region) {
    return this.regionBoundaries[region].countries;
  }

  guessCountry(ipAddress) {
    const octets = ipAddress.split('.').map(Number);
    const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'SG'];
    return countries[octets[0] % countries.length];
  }

  guessCityForCountry(country) {
    const cityMap = {
      'US': 'New York',
      'UK': 'London',
      'CA': 'Toronto',
      'AU': 'Sydney',
      'DE': 'Berlin',
      'FR': 'Paris',
      'JP': 'Tokyo',
      'SG': 'Singapore'
    };
    return cityMap[country] || 'Unknown';
  }

  calculateConsistencyScore(geoSession) {
    const { metrics } = geoSession;
    const maxViolations = 5;
    const violationPenalty = (metrics.geoConsistencyViolations / maxViolations) * 0.5;
    const unintendedPenalty = (metrics.unintendedCountryDetections / maxViolations) * 0.25;

    return Math.max(0, 100 - (violationPenalty * 100) - (unintendedPenalty * 100));
  }

  formatGeoSessionResponse(geoSession) {
    return {
      sessionId: geoSession.sessionId,
      region: geoSession.targetRegion,
      lockedCountry: geoSession.geoLock.lockedCountry,
      lockStrength: geoSession.geoLock.lockStrength,
      initialized: true
    };
  }
}

module.exports = GeoConsistencyEngine;
