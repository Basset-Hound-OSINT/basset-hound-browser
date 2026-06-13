/**
 * Behavioral Simulation Engine (Wave 16 Phase 6)
 * Generates human-like interactions to evade bot detection.
 *
 * Capabilities:
 * - Human-like mouse movements (Bézier curves, velocity variation)
 * - Realistic typing patterns (key delays, typo simulation)
 * - Scrolling behavior simulation (momentum, pause patterns)
 * - Form filling naturalization (field hesitation, delay patterns)
 * - Decision trees for behavior selection
 *
 * Evasion Targets:
 * - Mouse movement detection (trajectory analysis)
 * - Typing speed analysis (keystroke timing)
 * - Scroll pattern detection
 * - Form submission timing
 *
 * @author Wave 16 Team
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * Generates Bézier curve-based mouse movements
 * Creates natural-looking curves instead of straight lines
 */
class MouseMovementSimulator {
  constructor(options = {}) {
    this.minVelocity = options.minVelocity || 100; // px/sec
    this.maxVelocity = options.maxVelocity || 800;
    this.curveComplexity = options.curveComplexity || 0.5; // 0-1, how curved
    this.accelerationVariance = options.accelerationVariance || 0.3;
    this.pauses = options.pauses || true;
    this.pauseChance = options.pauseChance || 0.15;
  }

  /**
   * Generate Bézier curve points between two coordinates
   */
  generateBezierPath(startX, startY, endX, endY, steps = 50) {
    // Control point offset based on curve complexity
    const offsetX = (endX - startX) * this.curveComplexity;
    const offsetY = (endY - startY) * this.curveComplexity;

    // Randomize control point position slightly
    const cpX1 = startX + offsetX + (Math.random() - 0.5) * offsetX;
    const cpY1 = startY + (Math.random() - 0.5) * offsetY * 2;
    const cpX2 = endX - offsetX + (Math.random() - 0.5) * offsetX;
    const cpY2 = endY + (Math.random() - 0.5) * offsetY * 2;

    const path = [];
    for (let t = 0; t <= 1; t += 1 / steps) {
      const x = this.cubicBezier(t, startX, cpX1, cpX2, endX);
      const y = this.cubicBezier(t, startY, cpY1, cpY2, endY);
      path.push({ x: Math.round(x), y: Math.round(y) });
    }

    return path;
  }

  /**
   * Cubic Bézier curve calculation
   */
  cubicBezier(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  /**
   * Generate mouse movement with velocity variation
   */
  generateMovement(startX, startY, endX, endY, baseTime = 500) {
    const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    const velocity = this.minVelocity + Math.random() * (this.maxVelocity - this.minVelocity);
    const duration = (distance / velocity) * 1000 + (Math.random() - 0.5) * baseTime * 0.2;

    const path = this.generateBezierPath(startX, startY, endX, endY, Math.ceil(duration / 16));

    // Add pauses
    const movements = [];
    let currentTime = 0;

    for (let i = 0; i < path.length; i++) {
      movements.push({
        x: path[i].x,
        y: path[i].y,
        time: currentTime,
        pressure: 0
      });

      const stepDuration = duration / path.length;
      currentTime += stepDuration;

      // Random pause (like thinking or hesitation)
      if (this.pauses && Math.random() < this.pauseChance && i < path.length - 1) {
        const pauseDuration = 100 + Math.random() * 300;
        currentTime += pauseDuration;
      }
    }

    return {
      path: movements,
      duration: Math.round(currentTime),
      distance,
      velocity: velocity.toFixed(2)
    };
  }
}

/**
 * Simulates human-like typing patterns
 */
class TypingSimulator {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || 75; // ms between keystrokes
    this.delayVariance = options.delayVariance || 0.4; // How much variance
    this.typoRate = options.typoRate || 0.02; // 2% chance of typo
    this.backspaceDelay = options.backspaceDelay || 200;
    this.pauseChance = options.pauseChance || 0.1; // After punctuation
    this.pauseDuration = options.pauseDuration || 300;
  }

  /**
   * Generate typing events for a string
   */
  generateTypingSequence(text, startTime = 0) {
    const events = [];
    let currentTime = startTime;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const isTypo = Math.random() < this.typoRate && text.length > 1;

      if (isTypo) {
        // Simulate typo
        const typoChar = this.generateRandomChar();
        const delay = this.calculateDelay();

        events.push({
          type: 'keydown',
          key: typoChar,
          time: currentTime,
          char: typoChar
        });

        currentTime += delay;

        // Detect and fix typo (with delay)
        events.push({
          type: 'keyup',
          key: typoChar,
          time: currentTime
        });

        currentTime += this.backspaceDelay + Math.random() * 100;

        // Add backspace
        events.push({
          type: 'keydown',
          key: 'Backspace',
          time: currentTime,
          char: ''
        });

        currentTime += this.backspaceDelay;
      }

      // Type correct character
      const delay = this.calculateDelay();

      events.push({
        type: 'keydown',
        key: char,
        time: currentTime,
        char
      });

      currentTime += delay;

      events.push({
        type: 'keyup',
        key: char,
        time: currentTime
      });

      // Pause after punctuation
      if (['.', '!', '?', ','].includes(char) && Math.random() < this.pauseChance) {
        currentTime += this.pauseDuration + (Math.random() - 0.5) * 200;
      }

      i++;
    }

    return {
      text,
      events,
      totalDuration: currentTime - startTime,
      typosSimulated: events.filter(e => e.type === 'keydown' && e.key === 'Backspace').length
    };
  }

  /**
   * Calculate realistic keystroke delay
   */
  calculateDelay() {
    const variance = (Math.random() - 0.5) * 2 * this.delayVariance * this.baseDelay;
    const baseWithVariance = this.baseDelay + variance;
    return Math.max(20, baseWithVariance);
  }

  /**
   * Generate random character for typos
   */
  generateRandomChar() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return chars[Math.floor(Math.random() * chars.length)];
  }
}

/**
 * Simulates human-like scrolling behavior
 */
class ScrollSimulator {
  constructor(options = {}) {
    this.momentum = options.momentum || true;
    this.momentumDecay = options.momentumDecay || 0.95;
    this.minScrollDelay = options.minScrollDelay || 200;
    this.maxScrollDelay = options.maxScrollDelay || 2000;
    this.readingPauseChance = options.readingPauseChance || 0.3;
  }

  /**
   * Generate scrolling sequence with momentum
   */
  generateScrollSequence(distance, startTime = 0) {
    const events = [];
    let currentTime = startTime;
    let remaining = distance;
    let velocity = this.calculateInitialVelocity(distance);

    while (remaining > 0 && Math.abs(velocity) > 5) {
      // Random pause (reading content)
      if (Math.random() < this.readingPauseChance) {
        const pauseDuration = 500 + Math.random() * 2000;
        events.push({
          type: 'pause',
          duration: pauseDuration,
          time: currentTime
        });
        currentTime += pauseDuration;
      }

      // Scroll event
      const scrollAmount = Math.min(Math.abs(velocity), remaining);
      const scrollDuration = 100 + Math.random() * 200;

      events.push({
        type: 'scroll',
        delta: scrollAmount,
        time: currentTime,
        duration: scrollDuration
      });

      currentTime += scrollDuration;
      remaining -= scrollAmount;

      // Apply momentum decay
      if (this.momentum) {
        velocity *= this.momentumDecay;
      } else {
        velocity = this.calculateInitialVelocity(remaining);
      }

      // Delay between scroll events
      const delay = this.minScrollDelay + Math.random() * (this.maxScrollDelay - this.minScrollDelay);
      currentTime += delay;
    }

    return {
      distance,
      events,
      totalDuration: currentTime - startTime,
      totalScrolled: distance
    };
  }

  /**
   * Calculate initial scroll velocity based on distance
   */
  calculateInitialVelocity(distance) {
    // Further distances = higher velocity
    return Math.min(distance / 10, 200) + (Math.random() - 0.5) * 50;
  }
}

/**
 * Simulates human-like form filling behavior
 */
class FormFillingSimulator {
  constructor(options = {}) {
    this.fieldHesitation = options.fieldHesitation || 0.2; // Chance to pause before field
    this.fieldPauseDuration = options.fieldPauseDuration || 300;
    this.readingTime = options.readingTime || 1000;
    this.typoSimulator = new TypingSimulator(options);
  }

  /**
   * Generate form filling sequence for multiple fields
   */
  generateFormFillingSequence(fields, startTime = 0) {
    const events = [];
    let currentTime = startTime;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      // Hesitation before field (reading label)
      if (Math.random() < this.fieldHesitation) {
        events.push({
          type: 'field-read',
          fieldName: field.name,
          duration: this.readingTime + (Math.random() - 0.5) * 500,
          time: currentTime
        });
        currentTime += this.readingTime + (Math.random() - 0.5) * 500;
      }

      // Click on field
      events.push({
        type: 'field-focus',
        fieldName: field.name,
        time: currentTime
      });

      currentTime += 50 + Math.random() * 100;

      // Type value
      if (field.value) {
        const typingSeq = this.typoSimulator.generateTypingSequence(field.value, currentTime);
        events.push({
          type: 'field-input',
          fieldName: field.name,
          value: field.value,
          duration: typingSeq.totalDuration,
          time: currentTime,
          keyEvents: typingSeq.events
        });
        currentTime += typingSeq.totalDuration;
      }

      // Blur from field
      events.push({
        type: 'field-blur',
        fieldName: field.name,
        time: currentTime
      });

      currentTime += 50 + Math.random() * 100;

      // Pause before next field
      if (i < fields.length - 1) {
        const pauseTime = 200 + Math.random() * 300;
        currentTime += pauseTime;
      }
    }

    return {
      fields: fields.length,
      events,
      totalDuration: currentTime - startTime
    };
  }

  /**
   * Estimate time to fill form naturally
   */
  estimateFillTime(fields) {
    const baseTime = fields.reduce((sum, f) => {
      return sum + (f.value ? f.value.length * this.typoSimulator.baseDelay : 0);
    }, 0);

    const fieldCount = fields.length;
    const fieldTransitionTime = fieldCount * 200;
    const hesitationTime = fieldCount * this.fieldHesitation * this.fieldPauseDuration;

    return baseTime + fieldTransitionTime + hesitationTime;
  }
}

/**
 * Behavioral Decision Tree - Selects behavior based on context
 */
class BehavioralDecisionTree {
  constructor() {
    this.profiles = {
      human: {
        mouseComplexity: 0.8,
        typoRate: 0.02,
        pauseFrequency: 0.3,
        scrollMomentum: true,
        formHesitation: 0.3
      },
      speedreader: {
        mouseComplexity: 0.5,
        typoRate: 0.01,
        pauseFrequency: 0.05,
        scrollMomentum: true,
        formHesitation: 0.1
      },
      careful: {
        mouseComplexity: 0.9,
        typoRate: 0.05,
        pauseFrequency: 0.5,
        scrollMomentum: false,
        formHesitation: 0.5
      },
      casual: {
        mouseComplexity: 0.6,
        typoRate: 0.03,
        pauseFrequency: 0.2,
        scrollMomentum: true,
        formHesitation: 0.2
      }
    };
  }

  /**
   * Select profile based on context
   */
  selectProfile(context = {}) {
    const { site, isRepeat = false, urgency = 'normal' } = context;

    // If user is familiar with site, they might be faster
    if (isRepeat && urgency === 'low') {
      return this.profiles.speedreader;
    }

    // If filling important form, more careful
    if (context.isImportantForm) {
      return this.profiles.careful;
    }

    // Default to natural human behavior
    return this.profiles.human;
  }

  /**
   * Generate simulator instances based on profile
   */
  createSimulators(profile) {
    return {
      mouse: new MouseMovementSimulator({
        curveComplexity: profile.mouseComplexity
      }),
      typing: new TypingSimulator({
        typoRate: profile.typoRate,
        pauseChance: profile.pauseFrequency
      }),
      scroll: new ScrollSimulator({
        momentum: profile.scrollMomentum,
        readingPauseChance: profile.pauseFrequency
      }),
      formFilling: new FormFillingSimulator({
        fieldHesitation: profile.formHesitation,
        typoRate: profile.typoRate
      })
    };
  }
}

/**
 * Main Behavioral Simulator Manager
 */
class BehavioralSimulatorManager {
  constructor(options = {}) {
    this.decisionTree = new BehavioralDecisionTree();
    this.simulators = new Map(); // sessionId -> simulators
    this.behaviorLog = new Map(); // sessionId -> behaviors[]
  }

  /**
   * Initialize simulators for a session with a behavior profile
   */
  initializeSession(sessionId, context = {}) {
    const profile = this.decisionTree.selectProfile(context);
    const simulators = this.decisionTree.createSimulators(profile);

    this.simulators.set(sessionId, simulators);
    this.behaviorLog.set(sessionId, []);

    return {
      success: true,
      sessionId,
      profile: Object.keys(this.decisionTree.profiles).find(
        k => this.decisionTree.profiles[k] === profile
      ),
      simulators: {
        mouse: 'MouseMovementSimulator',
        typing: 'TypingSimulator',
        scroll: 'ScrollSimulator',
        formFilling: 'FormFillingSimulator'
      }
    };
  }

  /**
   * Simulate mouse movement
   */
  simulateMouseMovement(sessionId, startX, startY, endX, endY) {
    const simulators = this.simulators.get(sessionId);
    if (!simulators) {
      return { success: false, error: 'session-not-initialized' };
    }

    const movement = simulators.mouse.generateMovement(startX, startY, endX, endY);

    const log = this.behaviorLog.get(sessionId);
    log.push({
      type: 'mouse-movement',
      timestamp: Date.now(),
      data: movement
    });

    return {
      success: true,
      movement
    };
  }

  /**
   * Simulate typing
   */
  simulateTyping(sessionId, text) {
    const simulators = this.simulators.get(sessionId);
    if (!simulators) {
      return { success: false, error: 'session-not-initialized' };
    }

    const sequence = simulators.typing.generateTypingSequence(text);

    const log = this.behaviorLog.get(sessionId);
    log.push({
      type: 'typing',
      timestamp: Date.now(),
      data: sequence
    });

    return {
      success: true,
      sequence
    };
  }

  /**
   * Simulate scrolling
   */
  simulateScrolling(sessionId, distance) {
    const simulators = this.simulators.get(sessionId);
    if (!simulators) {
      return { success: false, error: 'session-not-initialized' };
    }

    const sequence = simulators.scroll.generateScrollSequence(distance);

    const log = this.behaviorLog.get(sessionId);
    log.push({
      type: 'scrolling',
      timestamp: Date.now(),
      data: sequence
    });

    return {
      success: true,
      sequence
    };
  }

  /**
   * Simulate form filling
   */
  simulateFormFilling(sessionId, fields) {
    const simulators = this.simulators.get(sessionId);
    if (!simulators) {
      return { success: false, error: 'session-not-initialized' };
    }

    const sequence = simulators.formFilling.generateFormFillingSequence(fields);
    const estimatedTime = simulators.formFilling.estimateFillTime(fields);

    const log = this.behaviorLog.get(sessionId);
    log.push({
      type: 'form-filling',
      timestamp: Date.now(),
      data: sequence
    });

    return {
      success: true,
      sequence,
      estimatedTime
    };
  }

  /**
   * Get behavior analysis for a session
   */
  getBehaviorAnalysis(sessionId) {
    const log = this.behaviorLog.get(sessionId);
    if (!log) {
      return { success: false, error: 'session-not-found' };
    }

    const analysis = {
      sessionId,
      totalEvents: log.length,
      eventBreakdown: {},
      totalDuration: 0,
      averageEventDuration: 0
    };

    for (const event of log) {
      analysis.eventBreakdown[event.type] = (analysis.eventBreakdown[event.type] || 0) + 1;
      if (event.data.duration) {
        analysis.totalDuration += event.data.duration;
      } else if (event.data.totalDuration) {
        analysis.totalDuration += event.data.totalDuration;
      }
    }

    analysis.averageEventDuration = log.length > 0 ? analysis.totalDuration / log.length : 0;

    return {
      success: true,
      analysis
    };
  }

  /**
   * Clear session simulators
   */
  clearSession(sessionId) {
    this.simulators.delete(sessionId);
    this.behaviorLog.delete(sessionId);
    return { success: true };
  }
}

module.exports = {
  BehavioralSimulatorManager,
  MouseMovementSimulator,
  TypingSimulator,
  ScrollSimulator,
  FormFillingSimulator,
  BehavioralDecisionTree
};
