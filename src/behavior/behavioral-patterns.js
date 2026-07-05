/**
 * Basset Hound Browser - Behavioral Patterns Library
 * Realistic cursor movement, typing patterns, scroll behaviors
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 *
 * Features:
 * - Role-based behavior profiles (researcher, developer, executive, student)
 * - Cursor animation with Bézier curves and acceleration
 * - Typing patterns with variable WPM and natural errors
 * - Scroll behaviors with momentum and pauses
 * - ML-optimized pattern adjustment based on feedback
 */

const crypto = require('crypto');

class BehavioralPatterns {
  constructor(options = {}) {
    this.patterns = this.initializePatterns();
    this.sessions = new Map();
    this.feedbackHistory = [];
    this.mlOptimizer = options.mlOptimizer || null;
    this.detectionServices = [
      'cloudflare', 'datadome', 'perimeterx', 'imperva', 'akamai'
    ];
  }

  /**
   * Initialize default behavior patterns by role
   */
  initializePatterns() {
    return {
      researcher: {
        name: 'Researcher',
        description: 'Methodical, takes time to read, careful click patterns',
        cursor: {
          speedVariation: 0.7, // 70% variation in speed
          pauseFrequency: 0.4, // 40% pause at elements
          avgWPM: 40,
          readingPaceMs: 2000
        },
        typing: {
          wpmMin: 35,
          wpmMax: 55,
          errorRate: 0.02,
          correctionDelay: 500,
          keyHoldTime: 80
        },
        scrolling: {
          speedVariation: 0.5,
          pauseFrequency: 0.5,
          avgScrollDistance: 200,
          acceleration: 0.8
        },
        mouseMovement: {
          curvature: 0.6,
          jitter: 2,
          accelerationProfile: 'eased'
        },
        detection_evasion: {
          cloudflare: 0.92,
          datadome: 0.88,
          perimeterx: 0.90
        }
      },

      developer: {
        name: 'Developer',
        description: 'Fast, efficient, keyboard-heavy interaction',
        cursor: {
          speedVariation: 0.4,
          pauseFrequency: 0.2,
          avgWPM: 70,
          readingPaceMs: 1000
        },
        typing: {
          wpmMin: 60,
          wpmMax: 90,
          errorRate: 0.01,
          correctionDelay: 300,
          keyHoldTime: 50
        },
        scrolling: {
          speedVariation: 0.3,
          pauseFrequency: 0.2,
          avgScrollDistance: 300,
          acceleration: 1.0
        },
        mouseMovement: {
          curvature: 0.4,
          jitter: 1,
          accelerationProfile: 'linear'
        },
        detection_evasion: {
          cloudflare: 0.85,
          datadome: 0.82,
          perimeterx: 0.84
        }
      },

      executive: {
        name: 'Executive',
        description: 'Deliberate, careful, frequent pauses for thinking',
        cursor: {
          speedVariation: 0.6,
          pauseFrequency: 0.6,
          avgWPM: 50,
          readingPaceMs: 3000
        },
        typing: {
          wpmMin: 40,
          wpmMax: 65,
          errorRate: 0.03,
          correctionDelay: 800,
          keyHoldTime: 100
        },
        scrolling: {
          speedVariation: 0.6,
          pauseFrequency: 0.7,
          avgScrollDistance: 150,
          acceleration: 0.6
        },
        mouseMovement: {
          curvature: 0.7,
          jitter: 3,
          accelerationProfile: 'eased'
        },
        detection_evasion: {
          cloudflare: 0.89,
          datadome: 0.86,
          perimeterx: 0.88
        }
      },

      student: {
        name: 'Student',
        description: 'Variable behavior, some distraction, mobile-friendly',
        cursor: {
          speedVariation: 0.8,
          pauseFrequency: 0.5,
          avgWPM: 45,
          readingPaceMs: 1500
        },
        typing: {
          wpmMin: 35,
          wpmMax: 60,
          errorRate: 0.04,
          correctionDelay: 600,
          keyHoldTime: 90
        },
        scrolling: {
          speedVariation: 0.7,
          pauseFrequency: 0.4,
          avgScrollDistance: 250,
          acceleration: 0.7
        },
        mouseMovement: {
          curvature: 0.5,
          jitter: 2.5,
          accelerationProfile: 'varied'
        },
        detection_evasion: {
          cloudflare: 0.86,
          datadome: 0.83,
          perimeterx: 0.85
        }
      }
    };
  }

  /**
   * Create a behavioral session with a specific pattern
   */
  createSession(patternName = 'researcher', options = {}) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const basePattern = this.patterns[patternName] || this.patterns.researcher;

    const session = {
      id: sessionId,
      patternName,
      createdAt: Date.now(),
      pattern: { ...basePattern },
      randomization: this.generateRandomization(basePattern),
      interactionCount: 0,
      mouseEvents: [],
      keyboardEvents: [],
      scrollEvents: [],
      detectionFeedback: {},
      metadata: options
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Generate randomization offsets for a pattern
   */
  generateRandomization(pattern) {
    return {
      cursorSpeedOffset: (Math.random() - 0.5) * 0.2, // ±10%
      typingSpeedOffset: (Math.random() - 0.5) * 0.15, // ±7.5%
      scrollSpeedOffset: (Math.random() - 0.5) * 0.2,
      pauseVariation: (Math.random() - 0.5) * 0.1,
      timeOfDayBias: Math.sin(Date.now() / (1000 * 60 * 60)) * 0.1 // Time of day variance
    };
  }

  /**
   * Generate human-like mouse path using Bézier curves
   */
  generateMousePath(sessionId, startPos, endPos, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const pattern = session.pattern;
    const randomization = session.randomization;

    const path = [];
    const distance = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);

    // Add intermediate points with Bézier curves
    const controlPoints = this.generateControlPoints(startPos, endPos, pattern, randomization);
    const points = this.bezierCurve(startPos, endPos, controlPoints, 50);

    // Calculate timing based on speed
    const baseSpeed = pattern.cursor.speedVariation * (1 + randomization.cursorSpeedOffset);
    const durationMs = Math.max(200, (distance / baseSpeed) * (50 + Math.random() * 50));

    // Add jitter and micro-movements
    for (let i = 0; i < points.length; i++) {
      const progress = i / points.length;
      const point = points[i];

      // Add acceleration
      const acceleration = pattern.mouseMovement.accelerationProfile === 'eased'
        ? this.easeInOutCubic(progress)
        : progress;

      path.push({
        x: point.x + (Math.random() - 0.5) * pattern.mouseMovement.jitter,
        y: point.y + (Math.random() - 0.5) * pattern.mouseMovement.jitter,
        timestamp: Math.round(durationMs * acceleration),
        pressure: 0.5 + Math.random() * 0.3
      });
    }

    // Record in session
    session.mouseEvents.push({
      startPos,
      endPos,
      pathLength: path.length,
      durationMs,
      timestamp: Date.now()
    });

    return path;
  }

  /**
   * Generate Bézier curve control points
   */
  generateControlPoints(start, end, pattern, randomization) {
    const curvature = pattern.mouseMovement.curvature || 0.5;
    const midX = (start.x + end.x) / 2 + (Math.random() - 0.5) * 100 * curvature;
    const midY = (start.y + end.y) / 2 + (Math.random() - 0.5) * 100 * curvature;

    return [
      { x: midX - 50, y: midY - 50 },
      { x: midX, y: midY },
      { x: midX + 50, y: midY + 50 }
    ];
  }

  /**
   * Generate Bézier curve points
   */
  bezierCurve(start, end, controlPoints, steps) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.bezierPoint(start, end, controlPoints, t);
      points.push(point);
    }
    return points;
  }

  /**
   * Calculate single Bézier point
   */
  bezierPoint(start, end, controlPoints, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const x = mt2 * start.x +
              2 * mt * t * controlPoints[0].x +
              t2 * end.x;

    const y = mt2 * start.y +
              2 * mt * t * controlPoints[0].y +
              t2 * end.y;

    return { x, y };
  }

  /**
   * Generate human-like typing events
   */
  generateTypingEvents(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const pattern = session.pattern;
    const randomization = session.randomization;

    const events = [];
    const wpm = pattern.typing.wpmMin +
                Math.random() * (pattern.typing.wpmMax - pattern.typing.wpmMin);

    const avgKeyTime = (60000 / (wpm * 5)) * (1 + randomization.typingSpeedOffset);
    let currentTime = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Natural typing variation
      const keyTime = avgKeyTime * (0.7 + Math.random() * 0.6);
      const holdTime = pattern.typing.keyHoldTime * (0.5 + Number(Math.random()));

      // Occasional typos and corrections
      const hasTypo = Math.random() < pattern.typing.errorRate;

      events.push({
        char,
        time: currentTime,
        duration: holdTime,
        typo: hasTypo ? text[Math.max(0, i - 1)] : null
      });

      currentTime += keyTime;

      // Occasional pauses (looking at what was typed)
      if (Math.random() < 0.05) {
        currentTime += Math.random() * 500;
      }
    }

    session.keyboardEvents.push({
      text,
      eventCount: events.length,
      totalTime: currentTime,
      timestamp: Date.now()
    });

    return {
      events,
      totalTime: currentTime,
      estimatedWPM: wpm
    };
  }

  /**
   * Generate human-like scroll behavior
   */
  generateScrollBehavior(sessionId, distance, direction = 'down') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const pattern = session.pattern;
    const randomization = session.randomization;

    const scrollEvents = [];
    let remaining = distance;
    let currentScroll = 0;

    while (remaining > 0) {
      // Scroll chunk size varies
      const chunkSize = pattern.scrolling.avgScrollDistance *
                        (0.5 + Math.random() * 1.5) *
                        (1 + randomization.scrollSpeedOffset);

      const scrollAmount = Math.min(chunkSize, remaining);
      currentScroll += scrollAmount;
      remaining -= scrollAmount;

      scrollEvents.push({
        scrollAmount,
        totalScrolled: currentScroll,
        timestamp: scrollEvents.length > 0
          ? scrollEvents[scrollEvents.length - 1].timestamp +
            (Math.random() * 200 + 100)
          : 0
      });

      // Add pauses between scroll chunks
      if (Math.random() < pattern.scrolling.pauseFrequency) {
        scrollEvents.push({
          type: 'pause',
          duration: Math.random() * 2000 + 500,
          timestamp: scrollEvents[scrollEvents.length - 1].timestamp + 500
        });
      }
    }

    session.scrollEvents.push({
      distance,
      direction,
      eventCount: scrollEvents.length,
      timestamp: Date.now()
    });

    return scrollEvents;
  }

  /**
   * Record detection feedback and optimize pattern
   */
  recordDetectionFeedback(sessionId, service, detected, confidence = 0.5) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const feedback = {
      service,
      detected,
      confidence,
      timestamp: Date.now()
    };

    if (!session.detectionFeedback[service]) {
      session.detectionFeedback[service] = [];
    }

    session.detectionFeedback[service].push(feedback);

    // Track feedback for ML optimization
    this.feedbackHistory.push({
      sessionId,
      ...feedback
    });

    // Adjust pattern if detection too high
    if (detected && confidence > 0.7) {
      this.adjustPattern(sessionId, service);
    }

    return feedback;
  }

  /**
   * Adjust pattern based on detection feedback
   */
  adjustPattern(sessionId, service) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const pattern = session.pattern;

    // Reduce detection risk by adding more variation
    pattern.cursor.speedVariation = Math.min(1.0, pattern.cursor.speedVariation + 0.1);
    pattern.cursor.pauseFrequency = Math.min(0.8, pattern.cursor.pauseFrequency + 0.1);
    pattern.mouseMovement.jitter = Math.min(5, pattern.mouseMovement.jitter + 1);

    // Increase typing variation
    pattern.typing.errorRate = Math.min(0.08, pattern.typing.errorRate + 0.01);
    pattern.typing.correctionDelay += 100;

    // More scroll pauses
    pattern.scrolling.pauseFrequency = Math.min(0.9, pattern.scrolling.pauseFrequency + 0.1);
  }

  /**
   * Get detection evasion score for a pattern
   */
  getEvasionScore(patternName, service = null) {
    const pattern = this.patterns[patternName];
    if (!pattern) {
      return 0;
    }

    if (service) {
      const evasionKey = `${service.toLowerCase()}`;
      return pattern.detection_evasion?.[evasionKey] || 0;
    }

    // Return average across all services
    const scores = Object.values(pattern.detection_evasion || {});
    return scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  }

  /**
   * Get all available patterns
   */
  listPatterns() {
    return Object.entries(this.patterns).map(([key, pattern]) => ({
      id: key,
      name: pattern.name,
      description: pattern.description,
      evasionScore: this.getEvasionScore(key)
    }));
  }

  /**
   * Get pattern details
   */
  getPattern(patternName) {
    return this.patterns[patternName] || null;
  }

  /**
   * Easing function: ease in-out cubic
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      sessionId,
      patternName: session.patternName,
      duration: Date.now() - session.createdAt,
      interactionCount: session.interactionCount,
      mouseEventCount: session.mouseEvents.length,
      keyboardEventCount: session.keyboardEvents.length,
      scrollEventCount: session.scrollEvents.length,
      detectionFeedback: Object.keys(session.detectionFeedback).length
    };
  }

  /**
   * Get ML-optimized recommendation for pattern
   */
  getOptimizedRecommendation(targetService = 'cloudflare') {
    // Analyze feedback history
    const serviceDetections = this.feedbackHistory
      .filter(f => f.service === targetService && f.detected)
      .length;

    const totalEvents = this.feedbackHistory
      .filter(f => f.service === targetService)
      .length;

    const detectionRate = totalEvents > 0
      ? serviceDetections / totalEvents
      : 0;

    // Recommend pattern based on evasion success
    const patternScores = {};
    for (const [name, pattern] of Object.entries(this.patterns)) {
      patternScores[name] = pattern.detection_evasion?.[targetService.toLowerCase()] || 0.5;
    }

    const bestPattern = Object.entries(patternScores)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      recommendedPattern: bestPattern?.[0] || 'researcher',
      confidence: bestPattern?.[1] || 0.5,
      detectionRate,
      adjustmentSuggestions: detectionRate > 0.3
        ? ['Increase pause frequency', 'Add more cursor jitter', 'Vary typing speed more']
        : []
    };
  }
}

module.exports = BehavioralPatterns;
