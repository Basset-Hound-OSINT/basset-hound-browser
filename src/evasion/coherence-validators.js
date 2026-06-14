/**
 * Basset Hound Browser - Session Coherence Validators
 * 5-layer cross-request coherence validation system
 *
 * Provides specialized validators for each detection layer:
 * - Layer 1: IP/Network Consistency
 * - Layer 2: TLS/HTTP Fingerprint
 * - Layer 3: Device Fingerprint
 * - Layer 4: Behavioral Patterns
 * - Layer 5: Session Identity
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 */

/**
 * Layer 1: IP/Network Consistency Validator
 */
class IPNetworkValidator {
  constructor() {
    this.ipHistory = [];
    this.geoHistory = [];
    this.maxIPJumps = 3;  // Allow max 3 IP changes in a session
    this.geolocationDrift = 50;  // km - reasonable travel distance
  }

  /**
   * Validate IP consistency across requests
   * @param {Object} currentRequest - Current request with IP data
   * @param {Array} previousRequests - Historical requests
   * @returns {Object} Validation result
   */
  validateIPConsistency(currentRequest, previousRequests = []) {
    const violations = [];
    const score = { consistency: 1.0, confidence: 1.0 };

    if (!currentRequest.ip) {
      return { violations, score, timestamp: Date.now() };
    }

    this.ipHistory.push({
      ip: currentRequest.ip,
      timestamp: currentRequest.timestamp || Date.now(),
      asn: currentRequest.asn,
      provider: currentRequest.provider
    });

    // Check IP changes
    if (this.ipHistory.length > 1) {
      const lastIP = this.ipHistory[this.ipHistory.length - 2].ip;
      if (lastIP !== currentRequest.ip) {
        // IP changed - validate if reasonable
        const timeDelta = currentRequest.timestamp - this.ipHistory[this.ipHistory.length - 2].timestamp;
        const ipChanges = this.ipHistory.filter((h, i) => i === 0 || h.ip !== this.ipHistory[i - 1].ip).length;

        if (ipChanges > this.maxIPJumps) {
          violations.push({
            layer: 'network',
            component: 'ip_consistency',
            severity: 'high',
            reason: 'Too many IP changes in session',
            changes: ipChanges,
            threshold: this.maxIPJumps
          });
          score.consistency -= 0.2;
        }

        // Check for impossible IP changes (no VPN, change should be >30sec apart)
        if (timeDelta < 30000) {
          violations.push({
            layer: 'network',
            component: 'ip_change_timing',
            severity: 'high',
            reason: 'IP changed too quickly (impossible without VPN switch)',
            timeDelta,
            minRequired: 30000
          });
          score.consistency -= 0.15;
        }
      }
    }

    // Validate ASN consistency if available
    if (currentRequest.asn && this.ipHistory.length > 1) {
      const lastASN = this.ipHistory[this.ipHistory.length - 2].asn;
      if (lastASN && lastASN !== currentRequest.asn) {
        violations.push({
          layer: 'network',
          component: 'asn_consistency',
          severity: 'medium',
          reason: 'Different ISP/ASN detected mid-session',
          previous: lastASN,
          current: currentRequest.asn
        });
        score.consistency -= 0.1;
      }
    }

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      ipCount: this.ipHistory.length,
      currentIP: currentRequest.ip
    };
  }

  /**
   * Validate geolocation consistency
   * @param {Object} geoData - Geolocation data (lat, lon, country, city)
   * @param {Array} previousGeo - Historical geolocation
   * @returns {Object} Validation result
   */
  validateGeolocationConsistency(geoData, previousGeo = []) {
    const violations = [];
    const score = { consistency: 1.0 };

    if (!geoData.latitude || !geoData.longitude) {
      return { violations, score };
    }

    this.geoHistory.push({
      lat: geoData.latitude,
      lon: geoData.longitude,
      country: geoData.country,
      city: geoData.city,
      timestamp: geoData.timestamp || Date.now()
    });

    if (this.geoHistory.length > 1) {
      const lastGeo = this.geoHistory[this.geoHistory.length - 2];
      const distance = this.calculateDistance(
        lastGeo.lat, lastGeo.lon,
        geoData.latitude, geoData.longitude
      );

      const timeDelta = (geoData.timestamp || Date.now()) - lastGeo.timestamp;
      const maxSpeedKmh = 900;  // Max speed: ~Mach 1, assumes commercial flight
      const maxDistanceKm = (timeDelta / 3600000) * maxSpeedKmh;

      if (distance > maxDistanceKm) {
        violations.push({
          layer: 'network',
          component: 'geolocation_travel_speed',
          severity: 'high',
          reason: 'Impossible travel speed detected',
          distance,
          maxPossible: maxDistanceKm,
          timeDelta
        });
        score.consistency -= 0.3;
      }

      // Check for sudden large jumps
      if (distance > this.geolocationDrift && timeDelta < 300000) {  // 5 minutes
        violations.push({
          layer: 'network',
          component: 'geolocation_jump',
          severity: 'medium',
          reason: 'Large geolocation jump in short time',
          distance,
          maxAllowed: this.geolocationDrift
        });
        score.consistency -= 0.15;
      }

      // Country changes should be rare
      if (lastGeo.country !== geoData.country) {
        violations.push({
          layer: 'network',
          component: 'country_change',
          severity: 'medium',
          reason: 'Country changed mid-session',
          from: lastGeo.country,
          to: geoData.country
        });
        score.consistency -= 0.1;
      }
    }

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      geoCount: this.geoHistory.length,
      currentLocation: {
        lat: geoData.latitude,
        lon: geoData.longitude,
        country: geoData.country
      }
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;  // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Layer 2: TLS/HTTP Fingerprint Validator
 */
class TLSHTTPValidator {
  constructor() {
    this.tlsHistory = [];
    this.headerHistory = [];
    this.ja3Fingerprints = new Set();
  }

  /**
   * Validate TLS/JA3 fingerprint consistency
   * @param {Object} tlsData - TLS connection data
   * @returns {Object} Validation result
   */
  validateTLSConsistency(tlsData) {
    const violations = [];
    const score = { consistency: 1.0 };

    if (!tlsData.ja3) {
      return { violations, score };
    }

    this.tlsHistory.push({
      ja3: tlsData.ja3,
      tlsVersion: tlsData.tlsVersion,
      cipherSuite: tlsData.cipherSuite,
      timestamp: tlsData.timestamp || Date.now()
    });

    // JA3 fingerprint should remain consistent
    if (this.tlsHistory.length > 1) {
      const lastJA3 = this.tlsHistory[this.tlsHistory.length - 2].ja3;
      if (lastJA3 !== tlsData.ja3) {
        violations.push({
          layer: 'tls',
          component: 'ja3_consistency',
          severity: 'high',
          reason: 'TLS JA3 fingerprint changed mid-session',
          previous: lastJA3,
          current: tlsData.ja3
        });
        score.consistency -= 0.2;
      }

      // Cipher suite shouldn't change
      const lastCipher = this.tlsHistory[this.tlsHistory.length - 2].cipherSuite;
      if (lastCipher && lastCipher !== tlsData.cipherSuite) {
        violations.push({
          layer: 'tls',
          component: 'cipher_suite',
          severity: 'high',
          reason: 'Cipher suite changed mid-session',
          previous: lastCipher,
          current: tlsData.cipherSuite
        });
        score.consistency -= 0.15;
      }

      // TLS version shouldn't change
      const lastVersion = this.tlsHistory[this.tlsHistory.length - 2].tlsVersion;
      if (lastVersion && lastVersion !== tlsData.tlsVersion) {
        violations.push({
          layer: 'tls',
          component: 'tls_version',
          severity: 'high',
          reason: 'TLS version changed mid-session',
          previous: lastVersion,
          current: tlsData.tlsVersion
        });
        score.consistency -= 0.15;
      }
    }

    this.ja3Fingerprints.add(tlsData.ja3);

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      uniqueJA3Count: this.ja3Fingerprints.size,
      currentJA3: tlsData.ja3
    };
  }

  /**
   * Validate HTTP header consistency
   * @param {Object} headers - HTTP headers
   * @returns {Object} Validation result
   */
  validateHTTPHeaders(headers) {
    const violations = [];
    const score = { consistency: 1.0 };

    if (!headers || Object.keys(headers).length === 0) {
      return { violations, score };
    }

    this.headerHistory.push({
      userAgent: headers['user-agent'],
      acceptLanguage: headers['accept-language'],
      acceptEncoding: headers['accept-encoding'],
      timestamp: headers.timestamp || Date.now()
    });

    if (this.headerHistory.length > 1) {
      const lastHeaders = this.headerHistory[this.headerHistory.length - 2];

      // User-Agent should be consistent
      if (lastHeaders.userAgent && lastHeaders.userAgent !== headers['user-agent']) {
        violations.push({
          layer: 'http',
          component: 'user_agent',
          severity: 'high',
          reason: 'User-Agent changed mid-session',
          previous: lastHeaders.userAgent,
          current: headers['user-agent']
        });
        score.consistency -= 0.2;
      }

      // Accept-Language should be consistent
      if (lastHeaders.acceptLanguage && lastHeaders.acceptLanguage !== headers['accept-language']) {
        violations.push({
          layer: 'http',
          component: 'accept_language',
          severity: 'medium',
          reason: 'Accept-Language changed mid-session',
          previous: lastHeaders.acceptLanguage,
          current: headers['accept-language']
        });
        score.consistency -= 0.1;
      }

      // Accept-Encoding order matters (signature)
      if (lastHeaders.acceptEncoding && lastHeaders.acceptEncoding !== headers['accept-encoding']) {
        violations.push({
          layer: 'http',
          component: 'accept_encoding',
          severity: 'medium',
          reason: 'Accept-Encoding changed mid-session',
          previous: lastHeaders.acceptEncoding,
          current: headers['accept-encoding']
        });
        score.consistency -= 0.1;
      }
    }

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      headerCount: this.headerHistory.length
    };
  }
}

/**
 * Layer 3: Device Fingerprint Validator
 */
class DeviceFingerprintValidator {
  constructor() {
    this.fingerprints = {
      canvas: null,
      webgl: null,
      audio: null,
      fonts: null,
      screen: null,
      navigator: null
    };
    this.fpHistory = [];
  }

  /**
   * Validate device fingerprint stability
   * @param {Object} deviceFP - Device fingerprint data
   * @returns {Object} Validation result
   */
  validateDeviceFingerprint(deviceFP) {
    const violations = [];
    const score = { consistency: 1.0, componentScores: {} };

    const components = ['canvas', 'webgl', 'audio', 'fonts', 'screen', 'navigator'];

    for (const component of components) {
      if (!deviceFP[component]) continue;

      score.componentScores[component] = 1.0;

      if (this.fingerprints[component] !== null) {
        const similarity = this.compareFingerprints(
          this.fingerprints[component],
          deviceFP[component]
        );

        score.componentScores[component] = similarity;

        if (similarity < 0.98) {
          violations.push({
            layer: 'device',
            component,
            severity: similarity < 0.90 ? 'high' : 'medium',
            reason: `${component} fingerprint changed`,
            similarity,
            threshold: 0.98
          });
          score.consistency -= (1 - similarity) * 0.15;
        }
      }

      this.fingerprints[component] = deviceFP[component];
    }

    this.fpHistory.push({
      fingerprints: { ...deviceFP },
      timestamp: deviceFP.timestamp || Date.now(),
      scores: score.componentScores
    });

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      componentScores: score.componentScores,
      historyLength: this.fpHistory.length
    };
  }

  /**
   * Compare two fingerprints for similarity
   */
  compareFingerprints(fp1, fp2) {
    if (typeof fp1 === 'string' && typeof fp2 === 'string') {
      return fp1 === fp2 ? 1.0 : 0.0;
    }

    if (typeof fp1 === 'object' && typeof fp2 === 'object') {
      const keys = new Set([...Object.keys(fp1 || {}), ...Object.keys(fp2 || {})]);
      if (keys.size === 0) return 1.0;

      let matches = 0;
      for (const key of keys) {
        if (fp1?.[key] === fp2?.[key]) {
          matches++;
        }
      }
      return matches / keys.size;
    }

    return 0.5;
  }
}

/**
 * Layer 4: Behavioral Pattern Validator
 */
class BehavioralPatternValidator {
  constructor() {
    this.behaviors = [];
    this.patterns = {
      mouseSpeed: [],
      typingSpeed: [],
      pauseTiming: [],
      clickFrequency: []
    };
  }

  /**
   * Validate behavioral consistency
   * @param {Object} behavior - Behavioral data
   * @returns {Object} Validation result
   */
  validateBehavioralPattern(behavior) {
    const violations = [];
    const score = { consistency: 1.0, patterns: {} };

    if (!behavior) {
      return { violations, score };
    }

    this.behaviors.push({
      ...behavior,
      timestamp: behavior.timestamp || Date.now()
    });

    // Validate mouse speed consistency
    if (behavior.mouseSpeed !== undefined) {
      this.patterns.mouseSpeed.push(behavior.mouseSpeed);
      const mouseDeviation = this.calculateDeviation(this.patterns.mouseSpeed, behavior.mouseSpeed);
      score.patterns.mouseSpeed = 1.0 - mouseDeviation;

      if (mouseDeviation > 0.4) {  // >40% deviation
        violations.push({
          layer: 'behavioral',
          component: 'mouse_speed',
          severity: 'medium',
          reason: 'Mouse speed deviation too high',
          deviation: mouseDeviation,
          threshold: 0.4
        });
        score.consistency -= 0.1;
      }
    }

    // Validate typing speed consistency
    if (behavior.typingSpeed !== undefined) {
      this.patterns.typingSpeed.push(behavior.typingSpeed);
      const typingDeviation = this.calculateDeviation(this.patterns.typingSpeed, behavior.typingSpeed);
      score.patterns.typingSpeed = 1.0 - typingDeviation;

      if (typingDeviation > 0.35) {  // >35% deviation
        violations.push({
          layer: 'behavioral',
          component: 'typing_speed',
          severity: 'medium',
          reason: 'Typing speed deviation too high',
          deviation: typingDeviation,
          threshold: 0.35
        });
        score.consistency -= 0.1;
      }
    }

    // Validate pause timing consistency
    if (behavior.pauseTiming !== undefined) {
      this.patterns.pauseTiming.push(behavior.pauseTiming);
      const pauseDeviation = this.calculateDeviation(this.patterns.pauseTiming, behavior.pauseTiming);
      score.patterns.pauseTiming = 1.0 - pauseDeviation;

      if (pauseDeviation > 0.5) {
        violations.push({
          layer: 'behavioral',
          component: 'pause_timing',
          severity: 'low',
          reason: 'Pause timing varies too much',
          deviation: pauseDeviation
        });
        score.consistency -= 0.05;
      }
    }

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      patterns: score.patterns,
      behaviorCount: this.behaviors.length
    };
  }

  /**
   * Calculate statistical deviation from baseline
   */
  calculateDeviation(history, current) {
    if (history.length === 0) return 0;

    const mean = history.reduce((a, b) => a + b) / history.length;
    if (mean === 0) return 0;

    return Math.abs(current - mean) / mean;
  }
}

/**
 * Layer 5: Session Identity Validator
 */
class SessionIdentityValidator {
  constructor() {
    this.sessionData = {
      cookies: new Map(),
      localStorage: new Map(),
      sessionStorage: new Map(),
      cache: new Map()
    };
    this.sessionHistory = [];
  }

  /**
   * Validate cookie consistency
   * @param {Array} cookies - Array of cookies
   * @returns {Object} Validation result
   */
  validateCookieConsistency(cookies) {
    const violations = [];
    const score = { consistency: 1.0 };

    if (!cookies || cookies.length === 0) {
      return { violations, score };
    }

    // Create current cookie map
    const currentCookies = new Map();
    for (const cookie of cookies) {
      currentCookies.set(cookie.name, {
        value: cookie.value,
        domain: cookie.domain,
        timestamp: Date.now()
      });
    }

    // Check for unexpected cookie changes
    for (const [name, current] of currentCookies.entries()) {
      if (this.sessionData.cookies.has(name)) {
        const previous = this.sessionData.cookies.get(name);

        // Important cookies shouldn't change value
        if (this.isImportantCookie(name) && previous.value !== current.value) {
          violations.push({
            layer: 'session',
            component: 'cookie_change',
            severity: 'medium',
            reason: `Important cookie changed: ${name}`,
            name,
            previous: previous.value.substring(0, 20) + '...',
            current: current.value.substring(0, 20) + '...'
          });
          score.consistency -= 0.1;
        }
      }
      this.sessionData.cookies.set(name, current);
    }

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      cookieCount: currentCookies.size
    };
  }

  /**
   * Validate localStorage persistence
   * @param {Array} items - localStorage items
   * @returns {Object} Validation result
   */
  validateLocalStoragePersistence(items) {
    const violations = [];
    const score = { consistency: 1.0 };

    if (!items || items.length === 0) {
      return { violations, score };
    }

    for (const item of items) {
      if (this.sessionData.localStorage.has(item.key)) {
        const previous = this.sessionData.localStorage.get(item.key);

        if (previous.value !== item.value) {
          violations.push({
            layer: 'session',
            component: 'localstorage_change',
            severity: 'medium',
            reason: `localStorage value changed: ${item.key}`,
            key: item.key
          });
          score.consistency -= 0.05;
        }
      }
      this.sessionData.localStorage.set(item.key, {
        value: item.value,
        timestamp: Date.now()
      });
    }

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      itemCount: items.length
    };
  }

  /**
   * Validate cache behavior consistency
   * @param {Object} cacheData - Cache metadata
   * @returns {Object} Validation result
   */
  validateCacheBehavior(cacheData) {
    const violations = [];
    const score = { consistency: 1.0 };

    if (!cacheData) {
      return { violations, score };
    }

    if (this.sessionData.cache.size > 0) {
      const lastCache = Array.from(this.sessionData.cache.values()).pop();

      // Cache size shouldn't decrease (unless explicitly cleared)
      if (cacheData.size < lastCache.size && !cacheData.cleared) {
        violations.push({
          layer: 'session',
          component: 'cache_behavior',
          severity: 'low',
          reason: 'Cache size decreased unexpectedly',
          previous: lastCache.size,
          current: cacheData.size
        });
        score.consistency -= 0.05;
      }
    }

    this.sessionData.cache.set(Date.now(), {
      size: cacheData.size,
      items: cacheData.items || 0
    });

    return {
      violations,
      score: Math.max(0, Math.min(1, score.consistency)),
      cacheSize: cacheData.size
    };
  }

  /**
   * Check if a cookie is important (should not change)
   */
  isImportantCookie(name) {
    const importantPatterns = [
      'session', 'auth', 'token', 'login', 'user',
      'csrf', 'nonce', 'state', 'tracking'
    ];
    return importantPatterns.some(pattern => name.toLowerCase().includes(pattern));
  }
}

/**
 * Master Coherence Validator - Orchestrates all 5 layers
 */
class MasterCoherenceValidator {
  constructor() {
    this.layer1 = new IPNetworkValidator();
    this.layer2 = new TLSHTTPValidator();
    this.layer3 = new DeviceFingerprintValidator();
    this.layer4 = new BehavioralPatternValidator();
    this.layer5 = new SessionIdentityValidator();

    this.validationHistory = [];
    this.overallScore = 1.0;
  }

  /**
   * Perform comprehensive 5-layer validation
   * @param {Object} requestData - Complete request/session data
   * @returns {Object} Comprehensive validation result
   */
  validateAllLayers(requestData) {
    const results = {
      timestamp: Date.now(),
      layers: {},
      overallScore: 1.0,
      violations: [],
      recommendations: []
    };

    // Layer 1: IP/Network
    if (requestData.network) {
      results.layers.layer1 = this.layer1.validateIPConsistency(requestData.network);
      if (requestData.network.geolocation) {
        const geoResult = this.layer1.validateGeolocationConsistency(requestData.network.geolocation);
        results.layers.layer1.geolocation = geoResult;
      }
    }

    // Layer 2: TLS/HTTP
    if (requestData.tls) {
      results.layers.layer2 = this.layer2.validateTLSConsistency(requestData.tls);
    }
    if (requestData.headers) {
      const headerResult = this.layer2.validateHTTPHeaders(requestData.headers);
      results.layers.layer2 = results.layers.layer2 || {};
      results.layers.layer2.headers = headerResult;
    }

    // Layer 3: Device Fingerprint
    if (requestData.device) {
      results.layers.layer3 = this.layer3.validateDeviceFingerprint(requestData.device);
    }

    // Layer 4: Behavioral Pattern
    if (requestData.behavior) {
      results.layers.layer4 = this.layer4.validateBehavioralPattern(requestData.behavior);
    }

    // Layer 5: Session Identity
    if (requestData.cookies) {
      results.layers.layer5 = this.layer5.validateCookieConsistency(requestData.cookies);
    }
    if (requestData.localStorage) {
      const storageResult = this.layer5.validateLocalStoragePersistence(requestData.localStorage);
      results.layers.layer5 = results.layers.layer5 || {};
      results.layers.layer5.storage = storageResult;
    }
    if (requestData.cache) {
      const cacheResult = this.layer5.validateCacheBehavior(requestData.cache);
      results.layers.layer5 = results.layers.layer5 || {};
      results.layers.layer5.cache = cacheResult;
    }

    // Aggregate violations
    for (const layer of Object.values(results.layers)) {
      if (layer && layer.violations) {
        results.violations.push(...layer.violations);
      }
    }

    // Calculate overall score
    const scores = [];
    for (const layer of Object.values(results.layers)) {
      if (layer && layer.score !== undefined) {
        scores.push(layer.score);
      }
    }
    results.overallScore = scores.length > 0
      ? scores.reduce((a, b) => a + b) / scores.length
      : 1.0;

    // Generate recommendations
    results.recommendations = this.generateRecommendations(results.violations);

    // Store in history
    this.validationHistory.push(results);
    this.overallScore = results.overallScore;

    return results;
  }

  /**
   * Generate recommendations based on violations
   */
  generateRecommendations(violations) {
    const recommendations = [];
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');

    if (criticalViolations.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Restart session immediately',
        reason: `${criticalViolations.length} critical violations detected`
      });
    }

    if (highViolations.length >= 2) {
      recommendations.push({
        priority: 'high',
        action: 'Apply evasion recovery measures',
        reason: `${highViolations.length} high-severity violations detected`
      });
    }

    if (violations.some(v => v.component === 'ip_consistency')) {
      recommendations.push({
        priority: 'high',
        action: 'Stabilize IP address - avoid rapid IP changes',
        reason: 'Multiple IP changes detected'
      });
    }

    if (violations.some(v => v.component === 'ja3_consistency')) {
      recommendations.push({
        priority: 'high',
        action: 'Maintain consistent TLS fingerprint',
        reason: 'TLS fingerprint changed'
      });
    }

    if (violations.some(v => v.component === 'user_agent')) {
      recommendations.push({
        priority: 'high',
        action: 'Keep User-Agent constant',
        reason: 'User-Agent changed mid-session'
      });
    }

    return recommendations;
  }

  /**
   * Get coherence report
   */
  getReport() {
    return {
      currentScore: this.overallScore,
      validationCount: this.validationHistory.length,
      recentValidations: this.validationHistory.slice(-5),
      scoreHistory: this.validationHistory.map(v => ({
        timestamp: v.timestamp,
        score: v.overallScore
      }))
    };
  }

  /**
   * Reset validator state
   */
  reset() {
    this.layer1 = new IPNetworkValidator();
    this.layer2 = new TLSHTTPValidator();
    this.layer3 = new DeviceFingerprintValidator();
    this.layer4 = new BehavioralPatternValidator();
    this.layer5 = new SessionIdentityValidator();
    this.validationHistory = [];
    this.overallScore = 1.0;
  }
}

module.exports = {
  IPNetworkValidator,
  TLSHTTPValidator,
  DeviceFingerprintValidator,
  BehavioralPatternValidator,
  SessionIdentityValidator,
  MasterCoherenceValidator
};
