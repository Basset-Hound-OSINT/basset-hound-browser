/**
 * Basset Hound Browser - Behavioral Simulator Module
 * Generates human-like interaction patterns to avoid detection
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

class BehavioralSimulator {
  constructor(options = {}) {
    this.patterns = options.patterns || this.getDefaultPatterns();
    this.currentPattern = options.defaultPattern || 'natural';
    this.seed = options.seed || Math.random();
  }

  /**
   * Simulate realistic mouse movement with Bézier curves
   */
  async simulateMouseMovement(startPos, endPos, patternType = null) {
    const pattern = patternType || this.currentPattern;
    const config = this.patterns.mouse[pattern] || this.patterns.mouse.natural;

    const distance = Math.hypot(
      endPos.x - startPos.x,
      endPos.y - startPos.y
    );

    // Base duration (pixels/second) adjusted by pattern
    const baseSpeed = 200;
    const speedVariation = config.speedVariation || 0.1;
    const speed = baseSpeed * (1 - speedVariation + Math.random() * speedVariation * 2);
    const duration = (distance / speed) * 1000;

    // Generate Bézier curve path
    const controlPoint1 = this.generateControlPoint(startPos, endPos, 0.33);
    const controlPoint2 = this.generateControlPoint(startPos, endPos, 0.66);

    const path = [];
    const steps = Math.ceil(duration / 16); // ~60fps

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.calculateBézierPoint(
        t,
        startPos,
        controlPoint1,
        controlPoint2,
        endPos
      );
      path.push(point);
    }

    // Add jerkiness based on pattern
    const jerkinessReduction = config.jerkinessReduction || 0.9;
    if (jerkinessReduction < 1) {
      this.applyJerkiness(path, 1 - jerkinessReduction);
    }

    return {
      path,
      duration: Math.round(duration),
      distance,
      points: path.length,
      pattern: pattern
    };
  }

  /**
   * Simulate realistic typing with speed variation and occasional errors
   */
  async simulateTyping(text, patternType = null) {
    const pattern = patternType || this.currentPattern;
    const config = this.patterns.typing[pattern] || this.patterns.typing.natural;

    const keystrokes = [];
    let totalTime = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const baseDelay = (60000 / config.wpm) / 5; // Average char duration
      const variation = config.wpmVariation || 10;
      const charDelay = baseDelay * (1 + (Math.random() - 0.5) * variation / 100);

      keystrokes.push({
        character: char,
        timestamp: Math.round(totalTime),
        duration: Math.round(charDelay),
        type: 'keypress'
      });

      totalTime += charDelay;

      // Occasional pause (thinking)
      if (Math.random() < 0.05) {
        totalTime += (100 + Math.random() * 200);
        keystrokes.push({
          type: 'pause',
          timestamp: Math.round(totalTime),
          duration: 100
        });
      }
    }

    return {
      keystrokes,
      totalDuration: Math.round(totalTime),
      wpm: config.wpm,
      characterCount: text.length,
      pattern: pattern
    };
  }

  /**
   * Simulate realistic scrolling with natural acceleration/deceleration
   */
  async simulateScrolling(distance, patternType = null) {
    const pattern = patternType || this.currentPattern;
    const config = this.patterns.scroll[pattern] || this.patterns.scroll.natural;

    const scrollEvents = [];
    let currentScroll = 0;
    const acceleration = config.acceleration || 0.3;
    let velocity = 0;
    let timestamp = 0;

    // Scroll in multiple events (not one giant scroll)
    while (currentScroll < distance) {
      const eventDistance = Math.min(
        Math.random() * 100 + 20,
        distance - currentScroll
      );

      velocity += acceleration;
      const eventDuration = eventDistance / velocity * 100;

      scrollEvents.push({
        distance: Math.round(eventDistance),
        timestamp: Math.round(timestamp),
        duration: Math.round(eventDuration),
        velocity: velocity.toFixed(2)
      });

      currentScroll += eventDistance;
      timestamp += eventDuration;

      // Occasional pause while "reading"
      if (Math.random() < config.pauseFrequency) {
        const pauseDuration = 500 + Math.random() * 2000;
        scrollEvents.push({
          type: 'pause',
          timestamp: Math.round(timestamp),
          duration: pauseDuration
        });
        timestamp += pauseDuration;
      }
    }

    return {
      scrollEvents,
      totalDistance: currentScroll,
      totalDuration: Math.round(timestamp),
      eventCount: scrollEvents.length,
      pattern: pattern
    };
  }

  /**
   * Simulate realistic pause/delay (human reading/thinking time)
   */
  async simulatePause(durationRange = null) {
    const range = durationRange || { min: 1000, max: 5000 };
    const pauseStyle = {
      thinking: { min: 500, max: 3000 },
      reading: { min: 1000, max: 5000 },
      processing: { min: 300, max: 1000 }
    };

    // Random pause duration
    const minDuration = range.min || pauseStyle.reading.min;
    const maxDuration = range.max || pauseStyle.reading.max;
    const duration = minDuration + Math.random() * (maxDuration - minDuration);

    return {
      duration: Math.round(duration),
      type: 'pause',
      timestamp: Date.now()
    };
  }

  /**
   * Verify behavior plausibility - check if generated patterns look human-like
   */
  verifyBehaviorPlausibility(events) {
    let plausibilityScore = 100;
    const anomalies = [];

    // Check for unrealistic speeds
    for (const event of events) {
      if (event.type === 'scroll' && event.velocity > 10) {
        plausibilityScore -= 5;
        anomalies.push(`Unrealistic scroll velocity: ${event.velocity}px/ms`);
      }

      if (event.type === 'mousemove' && event.duration < 10) {
        plausibilityScore -= 3;
        anomalies.push('Mouse movement too fast');
      }
    }

    // Check for unnatural sequences
    let lastEventType = null;
    for (const event of events) {
      // Many scrolls without any pauses = unnatural
      if (lastEventType === 'scroll' && event.type === 'scroll') {
        plausibilityScore -= 2;
      }
      lastEventType = event.type;
    }

    return {
      plausibility: Math.max(0, plausibilityScore),
      anomalies,
      acceptable: plausibilityScore >= 70
    };
  }

  /**
   * Get available patterns
   */
  getMousePatterns() {
    return Object.keys(this.patterns.mouse);
  }

  getTypingPatterns() {
    return Object.keys(this.patterns.typing);
  }

  getScrollPatterns() {
    return Object.keys(this.patterns.scroll);
  }

  /**
   * Set current pattern
   */
  setPattern(patternType) {
    if (this.patterns.mouse[patternType]) {
      this.currentPattern = patternType;
      return true;
    }
    return false;
  }

  /**
   * Get default behavior patterns
   */
  getDefaultPatterns() {
    return {
      mouse: {
        smooth: {
          curveType: 'ease-in-out',
          speedVariation: 0.1,
          jerkinessReduction: 0.95,
          description: 'Smooth, fluid movements'
        },
        natural: {
          curveType: 'cubic-bezier',
          speedVariation: 0.2,
          jerkinessReduction: 0.8,
          description: 'Natural, human-like movements'
        },
        erratic: {
          curveType: 'linear',
          speedVariation: 0.4,
          jerkinessReduction: 0.7,
          description: 'Slightly erratic, imprecise'
        },
        precise: {
          curveType: 'ease-out',
          speedVariation: 0.05,
          jerkinessReduction: 0.99,
          description: 'Precise, intentional movements'
        }
      },
      typing: {
        consistent: {
          wpm: 60,
          wpmVariation: 5,
          errorRate: 0.01,
          description: 'Consistent, professional typist'
        },
        natural: {
          wpm: 55,
          wpmVariation: 15,
          errorRate: 0.02,
          description: 'Natural, human-like typing'
        },
        variable: {
          wpm: 50,
          wpmVariation: 20,
          errorRate: 0.03,
          description: 'Variable speed, occasional mistakes'
        },
        fast: {
          wpm: 80,
          wpmVariation: 10,
          errorRate: 0.01,
          description: 'Fast, proficient typist'
        },
        slow: {
          wpm: 30,
          wpmVariation: 10,
          errorRate: 0.05,
          description: 'Slow, deliberate typing'
        }
      },
      scroll: {
        smooth: {
          acceleration: 0.2,
          duration: 500,
          pauseFrequency: 0.2,
          description: 'Smooth scrolling'
        },
        natural: {
          acceleration: 0.3,
          duration: 600,
          pauseFrequency: 0.3,
          description: 'Natural, human-like scrolling'
        },
        jerky: {
          acceleration: 0.5,
          duration: 300,
          pauseFrequency: 0.6,
          description: 'Jerky, imprecise scrolling'
        },
        slow: {
          acceleration: 0.1,
          duration: 1000,
          pauseFrequency: 0.5,
          description: 'Slow, deliberate scrolling'
        }
      }
    };
  }

  /**
   * Helper: Calculate Bézier curve point
   */
  calculateBézierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Helper: Generate control point for Bézier curve
   */
  generateControlPoint(p0, p3, offset) {
    const randomness = 20;
    return {
      x: p0.x + (p3.x - p0.x) * offset + (Math.random() - 0.5) * randomness,
      y: p0.y + (p3.y - p0.y) * offset + (Math.random() - 0.5) * randomness
    };
  }

  /**
   * Helper: Apply jerkiness to path
   */
  applyJerkiness(path, amount) {
    for (let i = 1; i < path.length - 1; i++) {
      const randomness = amount * 5;
      path[i].x += (Math.random() - 0.5) * randomness;
      path[i].y += (Math.random() - 0.5) * randomness;
    }
  }
}

module.exports = BehavioralSimulator;
