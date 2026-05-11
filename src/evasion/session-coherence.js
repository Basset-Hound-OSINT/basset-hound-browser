/**
 * Basset Hound Browser - Session Coherence Framework
 * Implements 5-layer cross-request consistency validation
 * Ensures behaviors, fingerprints, and patterns remain coherent across multiple interactions
 *
 * Version: 1.0.0
 * Created: May 11, 2026
 */

class SessionCoherence {
  constructor() {
    this.sessions = new Map();
    this.coherenceThresholds = {
      temporal: 0.95,      // Fingerprint shouldn't change much in short time
      behavioral: 0.92,    // Behavior patterns should be consistent
      network: 0.90,       // Network patterns consistent
      device: 0.95,        // Device info shouldn't contradict itself
      timeline: 0.94       // Overall timeline coherence
    };
    this.violationLog = [];
  }

  /**
   * Initialize a new session with baseline coherence data
   */
  initializeSession(sessionId, initialData = {}) {
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      interactions: [],
      coherenceScores: {
        temporal: null,
        behavioral: null,
        network: null,
        device: null,
        timeline: null
      },
      violations: [],
      recoveryAttempts: 0,
      metadata: {
        os: initialData.os || null,
        browser: initialData.browser || null,
        userAgent: initialData.userAgent || null
      }
    };

    // Layer 1: Temporal Baseline (fingerprint state at session start)
    session.layers = {
      temporal: {
        initialFingerprint: initialData.fingerprint || {},
        history: [{ timestamp: Date.now(), fingerprint: initialData.fingerprint || {} }],
        maxDrift: 0.02  // Max 2% drift between requests
      },
      behavioral: {
        initialBehavior: initialData.behavior || {},
        patterns: [{ timestamp: Date.now(), behavior: initialData.behavior || {} }],
        coherenceMinimum: 0.92
      },
      network: {
        requests: [],
        patterns: [],
        consistency: null
      },
      device: {
        initialDevice: initialData.device || {},
        changes: [],
        impossibilities: []
      },
      timeline: {
        events: [{ timestamp: Date.now(), type: 'session_init', data: initialData }],
        gaps: []
      }
    };

    this.sessions.set(sessionId, session);

    return {
      success: true,
      sessionId,
      initialized: true
    };
  }

  /**
   * Record a new interaction and validate coherence
   */
  recordInteraction(sessionId, interactionData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const timestamp = Date.now();

    // Create interaction record
    const interaction = {
      id: this.generateInteractionId(),
      timestamp,
      type: interactionData.type,
      data: interactionData,
      coherenceValidation: null,
      violations: []
    };

    // Layer 1: Temporal Coherence (fingerprint evolution)
    if (interactionData.fingerprint) {
      const temporalResult = this.validateTemporalCoherence(session, interactionData.fingerprint, timestamp);
      interaction.coherenceValidation = temporalResult;
      interaction.violations.push(...temporalResult.violations);
    }

    // Layer 2: Behavioral Coherence
    if (interactionData.behavior) {
      const behavioralResult = this.validateBehavioralCoherence(session, interactionData.behavior);
      interaction.violations.push(...behavioralResult.violations);
    }

    // Layer 3: Network Coherence
    if (interactionData.network) {
      const networkResult = this.validateNetworkCoherence(session, interactionData.network);
      interaction.violations.push(...networkResult.violations);
    }

    // Layer 4: Device Coherence
    if (interactionData.device) {
      const deviceResult = this.validateDeviceCoherence(session, interactionData.device);
      interaction.violations.push(...deviceResult.violations);
    }

    // Layer 5: Timeline Coherence
    const timelineResult = this.validateTimelineCoherence(session, interaction);
    interaction.violations.push(...timelineResult.violations);

    // Record interaction
    session.interactions.push(interaction);

    // Update layer histories
    if (interactionData.fingerprint) {
      session.layers.temporal.history.push({
        timestamp,
        fingerprint: interactionData.fingerprint
      });
    }

    if (interactionData.behavior) {
      session.layers.behavioral.patterns.push({
        timestamp,
        behavior: interactionData.behavior
      });
    }

    if (interactionData.network) {
      session.layers.network.requests.push({
        timestamp,
        ...interactionData.network
      });
    }

    session.layers.timeline.events.push({
      timestamp,
      type: interactionData.type,
      data: interactionData
    });

    // Calculate overall coherence
    const overallCoherence = this.calculateOverallCoherence(session);

    return {
      success: true,
      interactionId: interaction.id,
      coherence: overallCoherence,
      violations: interaction.violations.length,
      requiresRecovery: interaction.violations.length > 0
    };
  }

  /**
   * Layer 1: Validate temporal coherence (fingerprint stability)
   */
  validateTemporalCoherence(session, newFingerprint, timestamp) {
    const violations = [];
    const scores = [];

    if (session.layers.temporal.history.length === 0) {
      return { score: 1.0, violations: [] };
    }

    const lastRecord = session.layers.temporal.history[session.layers.temporal.history.length - 1];
    const timeDeltaMs = timestamp - lastRecord.timestamp;

    // Check each fingerprint component
    const components = ['canvas', 'webgl', 'audio', 'fonts', 'screen', 'navigator'];

    for (const component of components) {
      if (!newFingerprint[component] || !lastRecord.fingerprint[component]) {
        continue;
      }

      const similarity = this.calculateSimilarity(
        lastRecord.fingerprint[component],
        newFingerprint[component]
      );

      scores.push(similarity);

      // Fingerprints shouldn't change much within 2 minutes
      if (timeDeltaMs < 120000 && similarity < 0.98) {
        violations.push({
          layer: 'temporal',
          component,
          severity: 'medium',
          reason: 'Fingerprint changed too quickly',
          timeDelta: timeDeltaMs,
          similarity
        });
      }

      // Fingerprints can evolve, but not drastically (max 2% drift)
      if (similarity < 0.98) {
        if ((1 - similarity) > session.layers.temporal.maxDrift) {
          violations.push({
            layer: 'temporal',
            component,
            severity: 'high',
            reason: 'Fingerprint drift exceeds threshold',
            drift: 1 - similarity,
            threshold: session.layers.temporal.maxDrift
          });
        }
      }
    }

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 1.0;

    return {
      score: avgScore,
      violations,
      timeDelta: timeDeltaMs,
      componentScores: scores
    };
  }

  /**
   * Layer 2: Validate behavioral coherence
   */
  validateBehavioralCoherence(session, newBehavior) {
    const violations = [];

    if (session.layers.behavioral.patterns.length === 0) {
      return { score: 1.0, violations: [] };
    }

    const allBehaviors = session.layers.behavioral.patterns.map(p => p.behavior);

    // Check typing speed consistency
    if (newBehavior.typingSpeed !== undefined) {
      const speeds = allBehaviors
        .map(b => b.typingSpeed)
        .filter(v => v !== undefined);

      if (speeds.length > 0) {
        const avgSpeed = speeds.reduce((a, b) => a + b) / speeds.length;
        const deviation = Math.abs(newBehavior.typingSpeed - avgSpeed) / avgSpeed;

        if (deviation > 0.3) {  // More than 30% deviation
          violations.push({
            layer: 'behavioral',
            component: 'typing_speed',
            severity: 'medium',
            reason: 'Typing speed inconsistent with session pattern',
            deviation,
            current: newBehavior.typingSpeed,
            average: avgSpeed
          });
        }
      }
    }

    // Check mouse speed consistency
    if (newBehavior.mouseSpeed !== undefined) {
      const speeds = allBehaviors
        .map(b => b.mouseSpeed)
        .filter(v => v !== undefined);

      if (speeds.length > 0) {
        const speedMatch = speeds.filter(s => s === newBehavior.mouseSpeed).length / speeds.length;

        if (speedMatch < 0.7) {
          violations.push({
            layer: 'behavioral',
            component: 'mouse_speed',
            severity: 'medium',
            reason: 'Mouse speed inconsistent with session pattern',
            consistency: speedMatch
          });
        }
      }
    }

    // Check pause patterns
    if (newBehavior.pausePatterns) {
      const avgPauses = allBehaviors
        .filter(b => b.pausePatterns)
        .reduce((sum, b) => sum + (b.pausePatterns.average || 0), 0) / allBehaviors.length || 0;

      const pauseDeviation = Math.abs(
        (newBehavior.pausePatterns.average || 0) - avgPauses
      ) / (avgPauses || 1000);

      if (pauseDeviation > 0.5) {
        violations.push({
          layer: 'behavioral',
          component: 'pause_patterns',
          severity: 'low',
          reason: 'Pause patterns diverging from session baseline'
        });
      }
    }

    const score = Math.max(0, 1 - (violations.length * 0.05));

    return {
      score: Math.min(score, 1.0),
      violations
    };
  }

  /**
   * Layer 3: Validate network coherence
   */
  validateNetworkCoherence(session, networkData) {
    const violations = [];

    if (session.layers.network.requests.length === 0) {
      return { score: 1.0, violations: [] };
    }

    // Check User-Agent consistency
    if (networkData.userAgent) {
      const prevUA = session.layers.network.requests[session.layers.network.requests.length - 1]?.userAgent;

      if (prevUA && prevUA !== networkData.userAgent) {
        violations.push({
          layer: 'network',
          component: 'user_agent',
          severity: 'high',
          reason: 'User-Agent changed mid-session',
          previous: prevUA,
          current: networkData.userAgent
        });
      }
    }

    // Check request timing patterns
    if (session.layers.network.requests.length > 1) {
      const lastRequest = session.layers.network.requests[session.layers.network.requests.length - 1];
      const timeSinceLastRequest = networkData.timestamp - lastRequest.timestamp;

      // Requests should be spaced reasonably (at least 100ms apart for human-like behavior)
      if (timeSinceLastRequest < 100) {
        violations.push({
          layer: 'network',
          component: 'request_timing',
          severity: 'medium',
          reason: 'Requests too close together (non-human-like)',
          interval: timeSinceLastRequest
        });
      }

      // Check request pattern (shouldn't be perfectly regular)
      const recentIntervals = session.layers.network.requests
        .slice(-5)
        .reduce((acc, req, idx, arr) => {
          if (idx > 0) acc.push(req.timestamp - arr[idx - 1].timestamp);
          return acc;
        }, []);

      if (recentIntervals.length > 2) {
        const variance = this.calculateVariance(recentIntervals);
        if (variance < 100) {  // Intervals are too regular
          violations.push({
            layer: 'network',
            component: 'request_pattern',
            severity: 'low',
            reason: 'Request timing too regular (robotic)',
            variance
          });
        }
      }
    }

    const score = Math.max(0, 1 - (violations.length * 0.1));

    return {
      score: Math.min(score, 1.0),
      violations
    };
  }

  /**
   * Layer 4: Validate device coherence (no impossible hardware combinations)
   */
  validateDeviceCoherence(session, deviceData) {
    const violations = [];

    // Check for impossible device combinations
    const impossibilities = this.detectImpossibleCombinations(deviceData);
    violations.push(...impossibilities);

    // Compare with initial device state
    if (session.layers.device.initialDevice) {
      // OS shouldn't change
      if (deviceData.os &&
          session.layers.device.initialDevice.os &&
          deviceData.os !== session.layers.device.initialDevice.os) {
        violations.push({
          layer: 'device',
          component: 'os',
          severity: 'critical',
          reason: 'Operating system changed mid-session',
          initial: session.layers.device.initialDevice.os,
          current: deviceData.os
        });
      }

      // Browser vendor shouldn't change drastically
      if (deviceData.browserVendor &&
          session.layers.device.initialDevice.browserVendor) {
        // Allow minor browser updates but not switching browsers
        const sameBrowser = deviceData.browserVendor === session.layers.device.initialDevice.browserVendor;
        if (!sameBrowser) {
          violations.push({
            layer: 'device',
            component: 'browser_vendor',
            severity: 'critical',
            reason: 'Browser vendor changed mid-session',
            initial: session.layers.device.initialDevice.browserVendor,
            current: deviceData.browserVendor
          });
        }
      }

      // Screen resolution shouldn't change (except orientation)
      if (deviceData.screenWidth && session.layers.device.initialDevice.screenWidth) {
        const area = deviceData.screenWidth * (deviceData.screenHeight || 1);
        const initialArea = session.layers.device.initialDevice.screenWidth *
                          (session.layers.device.initialDevice.screenHeight || 1);

        // Allow 5% variance for orientation changes
        const variance = Math.abs(area - initialArea) / initialArea;
        if (variance > 0.15) {
          violations.push({
            layer: 'device',
            component: 'screen_resolution',
            severity: 'high',
            reason: 'Screen resolution changed significantly',
            variance
          });
        }
      }
    }

    session.layers.device.changes.push({
      timestamp: Date.now(),
      data: deviceData,
      violations: violations.length
    });

    const score = Math.max(0, 1 - (violations.length * 0.15));

    return {
      score: Math.min(score, 1.0),
      violations
    };
  }

  /**
   * Layer 5: Validate timeline coherence
   */
  validateTimelineCoherence(session, interaction) {
    const violations = [];

    if (session.layers.timeline.events.length === 0) {
      return { score: 1.0, violations: [] };
    }

    const lastEvent = session.layers.timeline.events[session.layers.timeline.events.length - 1];
    const timeDelta = interaction.timestamp - lastEvent.timestamp;

    // Check for time travel
    if (timeDelta < 0) {
      violations.push({
        layer: 'timeline',
        component: 'time_ordering',
        severity: 'critical',
        reason: 'Time travel detected (event timestamp before previous event)',
        delta: timeDelta
      });
    }

    // Check for gaps
    if (timeDelta > 300000) {  // 5 minute gap
      session.layers.timeline.gaps.push({
        start: lastEvent.timestamp,
        end: interaction.timestamp,
        duration: timeDelta
      });
    }

    // Check session age vs interaction count
    const sessionAge = interaction.timestamp - session.createdAt;
    const interactionRate = session.interactions.length / (sessionAge / 1000);  // interactions per second

    if (interactionRate > 10) {  // More than 10 interactions per second is suspicious
      violations.push({
        layer: 'timeline',
        component: 'interaction_rate',
        severity: 'medium',
        reason: 'Interactions too frequent (non-human-like)',
        rate: interactionRate
      });
    }

    const score = Math.max(0, 1 - (violations.length * 0.2));

    return {
      score: Math.min(score, 1.0),
      violations
    };
  }

  /**
   * Detect impossible hardware/software combinations
   */
  detectImpossibleCombinations(deviceData) {
    const violations = [];

    // iOS devices don't run Chrome
    if (deviceData.os === 'iOS' && deviceData.browser === 'Chrome') {
      violations.push({
        layer: 'device',
        component: 'impossibility',
        severity: 'critical',
        reason: 'Impossible combination: iOS + Chrome'
      });
    }

    // Android tablets typically don't run Safari
    if (deviceData.os === 'Android' &&
        deviceData.browser === 'Safari' &&
        deviceData.deviceType === 'tablet') {
      violations.push({
        layer: 'device',
        component: 'impossibility',
        severity: 'high',
        reason: 'Unlikely combination: Android tablet + Safari'
      });
    }

    // iPads run Safari by default
    if (deviceData.model && deviceData.model.includes('iPad') &&
        deviceData.browser && deviceData.browser !== 'Safari') {
      violations.push({
        layer: 'device',
        component: 'impossibility',
        severity: 'high',
        reason: 'Suspicious: iPad with non-Safari browser'
      });
    }

    return violations;
  }

  /**
   * Calculate overall session coherence score
   */
  calculateOverallCoherence(session) {
    const scores = [];

    // Layer scores from latest interaction
    if (session.interactions.length > 0) {
      const lastInteraction = session.interactions[session.interactions.length - 1];
      if (lastInteraction.coherenceValidation) {
        scores.push(lastInteraction.coherenceValidation.score);
      }
    }

    // Historical coherence
    if (session.layers.temporal.history.length > 1) {
      const tempScore = 1 - (session.violations.filter(v => v.layer === 'temporal').length * 0.05);
      scores.push(Math.max(0, tempScore));
    }

    if (session.layers.behavioral.patterns.length > 1) {
      const behavScore = 1 - (session.violations.filter(v => v.layer === 'behavioral').length * 0.05);
      scores.push(Math.max(0, behavScore));
    }

    if (session.layers.network.requests.length > 1) {
      const netScore = 1 - (session.violations.filter(v => v.layer === 'network').length * 0.1);
      scores.push(Math.max(0, netScore));
    }

    if (session.layers.device.changes.length > 0) {
      const devScore = 1 - (session.violations.filter(v => v.layer === 'device').length * 0.15);
      scores.push(Math.max(0, devScore));
    }

    const overallScore = scores.length > 0
      ? scores.reduce((a, b) => a + b) / scores.length
      : 1.0;

    return Math.min(Math.max(overallScore, 0), 1.0);
  }

  /**
   * Recover from coherence violations
   */
  attemptRecovery(sessionId, violationType = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.recoveryAttempts++;

    // Get violations to address
    const violations = violationType
      ? session.violations.filter(v => v.layer === violationType)
      : session.violations.slice(-5);  // Last 5 violations

    const recovery = {
      sessionId,
      attempt: session.recoveryAttempts,
      violationCount: violations.length,
      actions: []
    };

    for (const violation of violations) {
      switch (violation.layer) {
        case 'temporal':
          recovery.actions.push({
            type: 'reset_fingerprint',
            target: violation.component,
            reason: violation.reason
          });
          break;

        case 'behavioral':
          recovery.actions.push({
            type: 'normalize_behavior',
            target: violation.component,
            reason: violation.reason
          });
          break;

        case 'network':
          recovery.actions.push({
            type: 'add_request_delay',
            duration: Math.random() * 500 + 200,
            reason: violation.reason
          });
          break;

        case 'device':
          recovery.actions.push({
            type: violation.severity === 'critical' ? 'restart_session' : 'log_warning',
            target: violation.component,
            reason: violation.reason
          });
          break;

        case 'timeline':
          if (violation.component === 'time_ordering') {
            recovery.actions.push({
              type: 'sync_time',
              reason: violation.reason
            });
          }
          break;
      }
    }

    return recovery;
  }

  /**
   * Calculate similarity between two objects (0-1)
   */
  calculateSimilarity(obj1, obj2) {
    const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
    if (keys.size === 0) return 1.0;

    let matches = 0;
    for (const key of keys) {
      if (obj1?.[key] === obj2?.[key]) {
        matches++;
      }
    }

    return matches / keys.size;
  }

  /**
   * Calculate variance of an array
   */
  calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / arr.length;
  }

  /**
   * Generate interaction ID
   */
  generateInteractionId() {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session coherence report
   */
  getCoherenceReport(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: 'Session not found' };
    }

    const overallCoherence = this.calculateOverallCoherence(session);

    return {
      sessionId,
      createdAt: session.createdAt,
      duration: Date.now() - session.createdAt,
      interactionCount: session.interactions.length,
      overallCoherence,
      layers: {
        temporal: {
          score: session.coherenceScores.temporal,
          violations: session.violations.filter(v => v.layer === 'temporal').length
        },
        behavioral: {
          score: session.coherenceScores.behavioral,
          violations: session.violations.filter(v => v.layer === 'behavioral').length
        },
        network: {
          score: session.coherenceScores.network,
          violations: session.violations.filter(v => v.layer === 'network').length
        },
        device: {
          score: session.coherenceScores.device,
          violations: session.violations.filter(v => v.layer === 'device').length
        },
        timeline: {
          score: session.coherenceScores.timeline,
          violations: session.violations.filter(v => v.layer === 'timeline').length,
          gaps: session.layers.timeline.gaps.length
        }
      },
      violations: session.violations.slice(-10),  // Last 10 violations
      recoveryAttempts: session.recoveryAttempts
    };
  }

  /**
   * Cleanup session
   */
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }
}

module.exports = {
  SessionCoherence
};
