/**
 * Behavioral AI Module
 *
 * Phase 17: Physics-based human behavior simulation
 *
 * Implements:
 * - Fitts's Law mouse movement
 * - Minimum-jerk trajectory
 * - Physiological tremor simulation
 * - Biometric typing patterns
 * - Session-level behavioral consistency
 */

const crypto = require('crypto');

/**
 * Physics constants for mouse movement
 */
const PHYSICS = {
  // Fitts's Law constants (empirically derived)
  FITTS_A: 0.05, // Intercept (seconds)
  FITTS_B: 0.15, // Slope (seconds per bit)

  // Physiological tremor frequency (8-12 Hz)
  TREMOR_FREQ_MIN: 8,
  TREMOR_FREQ_MAX: 12,
  TREMOR_AMPLITUDE: 0.5, // pixels

  // Minimum-jerk optimization parameters
  JERK_SMOOTHNESS: 0.85,

  // Micro-correction parameters
  CORRECTION_PROBABILITY: 0.15,
  CORRECTION_DISTANCE: 5, // pixels

  // Overshoot parameters
  OVERSHOOT_PROBABILITY: 0.12,
  OVERSHOOT_DISTANCE_FACTOR: 0.08,
};

/**
 * Typing pattern constants
 */
const TYPING = {
  // Base inter-key intervals (milliseconds)
  IKI_BASE: 100,
  IKI_STD_DEV: 30,

  // Key hold duration
  KEY_HOLD_BASE: 80,
  KEY_HOLD_STD_DEV: 20,

  // Digraph timing adjustments (common letter pairs are faster)
  DIGRAPH_SPEEDUP: 0.7,
  COMMON_DIGRAPHS: [
    'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
    'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
    'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le',
  ],

  // Hand alternation (faster when switching hands)
  LEFT_HAND_KEYS: 'qwertasdfgzxcvb',
  RIGHT_HAND_KEYS: 'yuiophjklnm',
  HAND_SWITCH_SPEEDUP: 0.85,

  // Cognitive pause parameters
  PAUSE_PROBABILITY_SENTENCE: 0.3,
  PAUSE_PROBABILITY_WORD: 0.05,
  PAUSE_DURATION_MIN: 200,
  PAUSE_DURATION_MAX: 800,

  // Typing error parameters
  ERROR_RATE: 0.02,
  ERROR_CORRECTION_DELAY: 150,
};

/**
 * BehavioralProfile class
 *
 * Creates session-consistent behavioral characteristics
 */
class BehavioralProfile {
  /**
   * Create a behavioral profile
   *
   * @param {Object} options - Profile options
   * @param {string} options.seed - Seed for reproducible behavior
   * @param {number} options.speedMultiplier - Overall speed (0.5-1.5)
   * @param {number} options.accuracyLevel - Accuracy (0.8-1.0)
   * @param {number} options.fatigueRate - How quickly fatigue sets in
   */
  constructor(options = {}) {
    this.seed = options.seed || crypto.randomBytes(16).toString('hex');
    this.rng = this._createSeededRandom(this.seed);

    // Core behavioral characteristics (consistent per session)
    this.speedMultiplier = options.speedMultiplier || (0.8 + this.rng() * 0.4);
    this.accuracyLevel = options.accuracyLevel || (0.9 + this.rng() * 0.1);
    this.fatigueRate = options.fatigueRate || (0.0001 + this.rng() * 0.0002);

    // Typing characteristics
    this.typingWPM = 40 + this.rng() * 40; // 40-80 WPM
    this.typingErrorRate = 0.01 + this.rng() * 0.04; // 1-5%

    // Mouse characteristics
    this.mouseSpeedBase = 400 + this.rng() * 400; // pixels/second
    this.mousePrecision = 0.9 + this.rng() * 0.1;
    this.tremorIntensity = 0.3 + this.rng() * 0.7;

    // Reaction time baseline
    this.reactionTimeBase = 200 + this.rng() * 200; // 200-400ms

    // Session tracking
    this.sessionStartTime = Date.now();
    this.actionCount = 0;
  }

  /**
   * Create seeded random number generator
   */
  _createSeededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }

    return () => {
      hash = Math.sin(hash) * 10000;
      return hash - Math.floor(hash);
    };
  }

  /**
   * Get current fatigue factor (increases over time)
   */
  getFatigueFactor() {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const fatigue = 1 + (sessionDuration * this.fatigueRate);
    return Math.min(fatigue, 1.5); // Cap at 50% slowdown
  }

  /**
   * Record an action (for fatigue tracking)
   */
  recordAction() {
    this.actionCount++;
  }

  /**
   * Get profile configuration
   */
  getConfig() {
    return {
      seed: this.seed,
      speedMultiplier: this.speedMultiplier,
      accuracyLevel: this.accuracyLevel,
      fatigueRate: this.fatigueRate,
      typingWPM: this.typingWPM,
      typingErrorRate: this.typingErrorRate,
      mouseSpeedBase: this.mouseSpeedBase,
      mousePrecision: this.mousePrecision,
      tremorIntensity: this.tremorIntensity,
      reactionTimeBase: this.reactionTimeBase,
    };
  }
}

/**
 * MouseMovementAI class
 *
 * Physics-based mouse movement simulation
 */
class MouseMovementAI {
  constructor(behavioralProfile = null) {
    this.profile = behavioralProfile || new BehavioralProfile();
  }

  /**
   * Calculate movement time using Fitts's Law
   *
   * @param {number} distance - Distance to target in pixels
   * @param {number} targetWidth - Width of target in pixels
   * @returns {number} Predicted movement time in milliseconds
   */
  calculateFittsTime(distance, targetWidth) {
    // Fitts's Law: MT = a + b * log2(2D/W)
    const indexOfDifficulty = Math.log2((2 * distance) / targetWidth + 1);
    const time = (PHYSICS.FITTS_A + PHYSICS.FITTS_B * indexOfDifficulty) * 1000;

    // Apply profile modifiers
    return time * this.profile.getFatigueFactor() / this.profile.speedMultiplier;
  }

  /**
   * Generate minimum-jerk trajectory points
   *
   * @param {Object} start - Start position {x, y}
   * @param {Object} end - End position {x, y}
   * @param {number} duration - Movement duration in milliseconds
   * @returns {Array} Array of {x, y, t} points
   */
  generateMinimumJerkTrajectory(start, end, duration) {
    const points = [];
    const numPoints = Math.max(10, Math.floor(duration / 10));

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const tau = t;

      // Minimum-jerk position formula
      // x(τ) = x0 + (x1 - x0) * (10τ³ - 15τ⁴ + 6τ⁵)
      const s = 10 * Math.pow(tau, 3) - 15 * Math.pow(tau, 4) + 6 * Math.pow(tau, 5);

      points.push({
        x: start.x + (end.x - start.x) * s,
        y: start.y + (end.y - start.y) * s,
        t: (duration * t),
      });
    }

    return points;
  }

  /**
   * Add physiological tremor to trajectory
   *
   * @param {Array} points - Trajectory points
   * @returns {Array} Points with tremor added
   */
  addPhysiologicalTremor(points) {
    const tremorFreq = PHYSICS.TREMOR_FREQ_MIN +
      Math.random() * (PHYSICS.TREMOR_FREQ_MAX - PHYSICS.TREMOR_FREQ_MIN);

    const intensity = PHYSICS.TREMOR_AMPLITUDE * this.profile.tremorIntensity;

    return points.map((point, i) => {
      const phase = (point.t / 1000) * tremorFreq * 2 * Math.PI;
      const tremorX = Math.sin(phase) * intensity * (Math.random() * 0.5 + 0.5);
      const tremorY = Math.cos(phase * 1.1) * intensity * (Math.random() * 0.5 + 0.5);

      return {
        ...point,
        x: point.x + tremorX,
        y: point.y + tremorY,
      };
    });
  }

  /**
   * Add micro-corrections near target
   *
   * @param {Array} points - Trajectory points
   * @param {Object} target - Target position
   * @returns {Array} Points with corrections
   */
  addMicroCorrections(points, target) {
    if (Math.random() > PHYSICS.CORRECTION_PROBABILITY) {
      return points;
    }

    // Add a small correction in the last 20% of movement
    const correctionStart = Math.floor(points.length * 0.8);
    const correctedPoints = [...points];

    // Slight overshoot followed by correction
    const overshootX = (Math.random() - 0.5) * PHYSICS.CORRECTION_DISTANCE * 2;
    const overshootY = (Math.random() - 0.5) * PHYSICS.CORRECTION_DISTANCE * 2;

    for (let i = correctionStart; i < points.length - 2; i++) {
      const progress = (i - correctionStart) / (points.length - correctionStart);
      const correctionFactor = Math.sin(progress * Math.PI);

      correctedPoints[i] = {
        ...correctedPoints[i],
        x: correctedPoints[i].x + overshootX * correctionFactor,
        y: correctedPoints[i].y + overshootY * correctionFactor,
      };
    }

    return correctedPoints;
  }

  /**
   * Potentially add overshoot behavior
   *
   * @param {Array} points - Trajectory points
   * @param {Object} target - Target position
   * @returns {Array} Points with potential overshoot
   */
  addOvershoot(points, target) {
    if (Math.random() > PHYSICS.OVERSHOOT_PROBABILITY) {
      return points;
    }

    const lastPoint = points[points.length - 1];
    const distance = Math.sqrt(
      Math.pow(target.x - points[0].x, 2) +
      Math.pow(target.y - points[0].y, 2)
    );

    const overshootDistance = distance * PHYSICS.OVERSHOOT_DISTANCE_FACTOR;
    const angle = Math.atan2(target.y - points[0].y, target.x - points[0].x);

    // Overshoot point
    const overshootPoint = {
      x: target.x + Math.cos(angle) * overshootDistance,
      y: target.y + Math.sin(angle) * overshootDistance,
      t: lastPoint.t + 50,
    };

    // Correction back to target
    const correctionPoint = {
      x: target.x,
      y: target.y,
      t: lastPoint.t + 100,
    };

    return [...points, overshootPoint, correctionPoint];
  }

  /**
   * Generate complete mouse movement path
   *
   * @param {Object} start - Start position {x, y}
   * @param {Object} end - End position {x, y}
   * @param {number} targetWidth - Width of target element
   * @returns {Object} Movement path and metadata
   */
  generatePath(start, end, targetWidth = 20) {
    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );

    // Calculate movement time using Fitts's Law
    const duration = this.calculateFittsTime(distance, targetWidth);

    // Generate base trajectory
    let points = this.generateMinimumJerkTrajectory(start, end, duration);

    // Add human-like variations
    points = this.addPhysiologicalTremor(points);
    points = this.addMicroCorrections(points, end);
    points = this.addOvershoot(points, end);

    this.profile.recordAction();

    return {
      points,
      duration: points[points.length - 1].t,
      distance,
      targetWidth,
      fittsTime: duration,
    };
  }

  /**
   * Generate scroll behavior
   *
   * @param {number} distance - Scroll distance in pixels
   * @param {string} direction - 'up' or 'down'
   * @returns {Array} Scroll events with timing
   */
  generateScrollBehavior(distance, direction = 'down') {
    const events = [];
    const sign = direction === 'down' ? 1 : -1;

    // Human scrolling tends to be in chunks
    let remaining = Math.abs(distance);
    let time = 0;

    while (remaining > 0) {
      // Variable scroll amounts
      const scrollAmount = Math.min(
        remaining,
        100 + Math.random() * 200 // 100-300 pixels per scroll
      );

      // Variable timing between scrolls
      const delay = 50 + Math.random() * 150;

      events.push({
        deltaY: scrollAmount * sign,
        t: time,
      });

      remaining -= scrollAmount;
      time += delay;

      // Occasional pause
      if (Math.random() < 0.1) {
        time += 200 + Math.random() * 500;
      }
    }

    return events;
  }
}

/**
 * TypingAI class
 *
 * Biometric typing pattern simulation
 */
class TypingAI {
  constructor(behavioralProfile = null) {
    this.profile = behavioralProfile || new BehavioralProfile();
  }

  /**
   * Determine which hand types a key
   */
  getKeyHand(key) {
    const lower = key.toLowerCase();
    if (TYPING.LEFT_HAND_KEYS.includes(lower)) return 'left';
    if (TYPING.RIGHT_HAND_KEYS.includes(lower)) return 'right';
    return 'either';
  }

  /**
   * Check if two characters form a common digraph
   */
  isCommonDigraph(char1, char2) {
    return TYPING.COMMON_DIGRAPHS.includes(
      (char1 + char2).toLowerCase()
    );
  }

  /**
   * Calculate inter-key interval for a specific key pair
   *
   * @param {string} prevChar - Previous character
   * @param {string} currentChar - Current character
   * @returns {number} Delay in milliseconds
   */
  calculateIKI(prevChar, currentChar) {
    // Base IKI with normal distribution
    let iki = this.gaussianRandom(
      TYPING.IKI_BASE,
      TYPING.IKI_STD_DEV
    );

    // Adjust for profile typing speed
    const baseMultiplier = 60000 / (this.profile.typingWPM * 5); // 5 chars per word average
    iki *= baseMultiplier / TYPING.IKI_BASE;

    // Speed up for common digraphs
    if (prevChar && this.isCommonDigraph(prevChar, currentChar)) {
      iki *= TYPING.DIGRAPH_SPEEDUP;
    }

    // Speed up for hand alternation
    if (prevChar) {
      const prevHand = this.getKeyHand(prevChar);
      const currHand = this.getKeyHand(currentChar);
      if (prevHand !== currHand && prevHand !== 'either' && currHand !== 'either') {
        iki *= TYPING.HAND_SWITCH_SPEEDUP;
      }
    }

    // Apply fatigue
    iki *= this.profile.getFatigueFactor();

    return Math.max(20, iki);
  }

  /**
   * Calculate key hold duration
   */
  calculateKeyHoldDuration(char) {
    let duration = this.gaussianRandom(
      TYPING.KEY_HOLD_BASE,
      TYPING.KEY_HOLD_STD_DEV
    );

    // Shift key adds time for uppercase
    if (char !== char.toLowerCase()) {
      duration += 30 + Math.random() * 20;
    }

    return Math.max(30, duration);
  }

  /**
   * Determine if there should be a cognitive pause
   */
  shouldPause(char, prevChar) {
    // Pause after sentence-ending punctuation
    if (prevChar && ['.', '!', '?'].includes(prevChar)) {
      return Math.random() < TYPING.PAUSE_PROBABILITY_SENTENCE;
    }

    // Occasional pause after words
    if (char === ' ') {
      return Math.random() < TYPING.PAUSE_PROBABILITY_WORD;
    }

    return false;
  }

  /**
   * Generate typing events for text
   *
   * @param {string} text - Text to type
   * @returns {Array} Array of typing events
   */
  generateTypingEvents(text) {
    const events = [];
    let currentTime = 0;
    let prevChar = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Check for cognitive pause
      if (this.shouldPause(char, prevChar)) {
        const pauseDuration = TYPING.PAUSE_DURATION_MIN +
          Math.random() * (TYPING.PAUSE_DURATION_MAX - TYPING.PAUSE_DURATION_MIN);
        currentTime += pauseDuration;
      }

      // Calculate inter-key interval
      const iki = this.calculateIKI(prevChar, char);
      currentTime += iki;

      // Calculate key hold duration
      const holdDuration = this.calculateKeyHoldDuration(char);

      // Simulate typing errors
      if (Math.random() < this.profile.typingErrorRate) {
        // Wrong key press
        const wrongChar = this.getAdjacentKey(char);
        events.push({
          type: 'keydown',
          key: wrongChar,
          t: currentTime,
        });
        events.push({
          type: 'keyup',
          key: wrongChar,
          t: currentTime + holdDuration,
        });

        // Pause and backspace
        currentTime += TYPING.ERROR_CORRECTION_DELAY;
        events.push({
          type: 'keydown',
          key: 'Backspace',
          t: currentTime,
        });
        events.push({
          type: 'keyup',
          key: 'Backspace',
          t: currentTime + 50,
        });

        // Type correct character
        currentTime += iki * 0.8;
      }

      // Correct key press
      events.push({
        type: 'keydown',
        key: char,
        t: currentTime,
      });
      events.push({
        type: 'keyup',
        key: char,
        t: currentTime + holdDuration,
      });

      prevChar = char;
    }

    this.profile.recordAction();

    return events;
  }

  /**
   * Get an adjacent key (for simulating typos)
   */
  getAdjacentKey(key) {
    const keyboard = [
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    const lower = key.toLowerCase();
    for (let row = 0; row < keyboard.length; row++) {
      const col = keyboard[row].indexOf(lower);
      if (col !== -1) {
        // Get adjacent key
        const offsets = [-1, 1];
        const offset = offsets[Math.floor(Math.random() * offsets.length)];
        const newCol = Math.max(0, Math.min(keyboard[row].length - 1, col + offset));
        const newChar = keyboard[row][newCol];
        return key === key.toUpperCase() ? newChar.toUpperCase() : newChar;
      }
    }

    return key;
  }

  /**
   * Gaussian random number
   */
  gaussianRandom(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  /**
   * Calculate typing speed from events
   */
  calculateTypingSpeed(events, textLength) {
    if (events.length < 2) return 0;

    const duration = events[events.length - 1].t - events[0].t;
    const minutes = duration / 60000;
    const words = textLength / 5;

    return words / minutes;
  }
}

/**
 * HoneypotDetector class
 *
 * Detects hidden honeypot form fields
 */
class HoneypotDetector {
  /**
   * Check if an element is a honeypot
   *
   * @param {Object} element - Element info from page
   * @returns {Object} Detection result
   */
  static isHoneypot(element) {
    const indicators = [];

    // Check CSS visibility
    if (element.style) {
      if (element.style.display === 'none') {
        indicators.push('display:none');
      }
      if (element.style.visibility === 'hidden') {
        indicators.push('visibility:hidden');
      }
      if (element.style.opacity === '0') {
        indicators.push('opacity:0');
      }
      if (element.style.position === 'absolute') {
        if (parseInt(element.style.left) < -1000 || parseInt(element.style.top) < -1000) {
          indicators.push('off-screen positioning');
        }
      }
    }

    // Check dimensions
    if (element.width === 0 || element.height === 0) {
      indicators.push('zero dimensions');
    }
    if (element.width === 1 && element.height === 1) {
      indicators.push('1x1 pixel');
    }

    // Check suspicious names
    const suspiciousNames = [
      'honeypot', 'honey', 'pot', 'trap', 'ohnohoney', 'website', 'url',
      'email2', 'phone2', 'address2', 'fax', 'confirm_email', 'your-website',
    ];

    const name = (element.name || '').toLowerCase();
    const id = (element.id || '').toLowerCase();

    for (const suspicious of suspiciousNames) {
      if (name.includes(suspicious) || id.includes(suspicious)) {
        indicators.push(`suspicious name: ${suspicious}`);
      }
    }

    // Check tabindex
    if (element.tabindex === -1) {
      indicators.push('tabindex:-1');
    }

    // Check autocomplete off with hidden
    if (element.autocomplete === 'off' && indicators.length > 0) {
      indicators.push('autocomplete:off with other indicators');
    }

    return {
      isHoneypot: indicators.length >= 2,
      indicators,
      confidence: Math.min(1, indicators.length * 0.3),
    };
  }

  /**
   * Filter honeypot fields from a form
   *
   * @param {Array} fields - Form field elements
   * @returns {Object} Filtered fields and detected honeypots
   */
  static filterHoneypots(fields) {
    const safeFields = [];
    const honeypots = [];

    for (const field of fields) {
      const result = this.isHoneypot(field);
      if (result.isHoneypot) {
        honeypots.push({ field, ...result });
      } else {
        safeFields.push(field);
      }
    }

    return { safeFields, honeypots };
  }
}

/**
 * RateLimitAdapter class
 *
 * Adapts request timing based on detected rate limits
 */
class RateLimitAdapter {
  constructor() {
    this.baseDelay = 1000; // 1 second base
    this.currentDelay = this.baseDelay;
    this.maxDelay = 60000; // 1 minute max
    this.minDelay = 500; // 500ms min
    this.successStreak = 0;
    this.failureCount = 0;
  }

  /**
   * Record a successful request
   */
  recordSuccess() {
    this.successStreak++;
    this.failureCount = 0;

    // Gradually reduce delay after consecutive successes
    if (this.successStreak >= 5) {
      this.currentDelay = Math.max(
        this.minDelay,
        this.currentDelay * 0.95
      );
    }
  }

  /**
   * Record a rate limit hit
   *
   * @param {Object} response - Response info
   */
  recordRateLimit(response) {
    this.successStreak = 0;
    this.failureCount++;

    // Exponential backoff
    this.currentDelay = Math.min(
      this.maxDelay,
      this.currentDelay * (2 ** this.failureCount)
    );

    // Respect Retry-After header if present
    if (response.retryAfter) {
      this.currentDelay = Math.max(
        this.currentDelay,
        parseInt(response.retryAfter) * 1000
      );
    }
  }

  /**
   * Get delay before next request
   *
   * @returns {number} Delay in milliseconds with jitter
   */
  getDelay() {
    // Add random jitter (±20%)
    const jitter = this.currentDelay * 0.2 * (Math.random() - 0.5);
    return Math.floor(this.currentDelay + jitter);
  }

  /**
   * Check if a response indicates rate limiting
   */
  static isRateLimited(statusCode) {
    return statusCode === 429 || statusCode === 503;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      currentDelay: this.currentDelay,
      successStreak: this.successStreak,
      failureCount: this.failureCount,
    };
  }
}

module.exports = {
  BehavioralProfile,
  MouseMovementAI,
  TypingAI,
  HoneypotDetector,
  RateLimitAdapter,
  PHYSICS,
  TYPING,
};
