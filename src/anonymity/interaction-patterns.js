/**
 * Interaction Pattern Anonymization Module
 * Simulates realistic user interaction patterns
 * Features: Smooth scrolling, hover detection, natural click sequences, form filling
 */

class InteractionPatterns {
  constructor() {
    this.enabled = false;
    this.interactionHistory = [];
  }

  /**
   * Enable interaction pattern anonymization
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable interaction pattern anonymization
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Generate smooth scrolling simulation
   * Not instant jumps, but continuous smooth movement
   * @param {number} startPosition - current scroll position
   * @param {number} endPosition - target scroll position
   * @param {number} duration - duration in milliseconds
   * @returns {Array} Array of {position, timestamp}
   */
  generateSmoothScroll(startPosition, endPosition, duration = 1000) {
    const scrollSteps = [];
    const distance = endPosition - startPosition;
    const steps = Math.ceil(duration / 16); // ~60fps

    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      // Ease-out for natural scroll deceleration
      const easeOut = 1 - Math.pow(1 - ratio, 3);
      const position = startPosition + distance * easeOut;
      const timestamp = (i / steps) * duration;

      scrollSteps.push({
        position: Math.round(position),
        timestamp,
      });
    }

    return scrollSteps;
  }

  /**
   * Generate hover pattern before clicking
   * Natural eye tracking: hover over element before clicking
   * @param {Object} element - {x, y, width, height}
   * @returns {Array} Array of {x, y, timestamp}
   */
  generateHoverPattern(element) {
    const hoverPoints = [];

    // Hover moves: start outside, move to center, possibly slight movement
    // Realistic hover time: 100-500ms before click
    const hoverDuration = 100 + Math.random() * 400;
    const steps = Math.ceil(hoverDuration / 16);

    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;

    // Start from random edge
    const startX = element.x + Math.random() * element.width;
    const startY = element.y - 30 - Math.random() * 50; // Above element

    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      // Ease-in for natural eye movement to element
      const easeIn = ratio * ratio;

      const x = startX + (centerX - startX) * easeIn;
      const y = startY + (centerY - startY) * easeIn;
      const timestamp = (i / steps) * hoverDuration;

      hoverPoints.push({
        x: Math.round(x),
        y: Math.round(y),
        timestamp,
      });
    }

    return hoverPoints;
  }

  /**
   * Generate natural click sequence
   * Users click top-to-bottom, left-to-right (reading order)
   * @param {Array} elements - Array of {x, y, width, height, type, label}
   * @returns {Array} Array of {element, timestamp, action}
   */
  generateClickSequence(elements) {
    // Sort by natural reading order: top-to-bottom, left-to-right
    const sortedElements = elements.sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 50) return yDiff; // Different rows
      return a.x - b.x; // Same row, sort by x
    });

    const sequence = [];
    let cumulativeTime = 0;

    sortedElements.forEach((element, index) => {
      // Add hover time before click
      const hoverTime = 150 + Math.random() * 350;
      cumulativeTime += hoverTime;

      sequence.push({
        element,
        timestamp: cumulativeTime,
        action: 'hover',
      });

      // Add click action
      cumulativeTime += 50 + Math.random() * 150; // Click delay
      sequence.push({
        element,
        timestamp: cumulativeTime,
        action: 'click',
      });

      // Add pause between clicks (except last)
      if (index < sortedElements.length - 1) {
        const pauseTime = 300 + Math.random() * 400;
        cumulativeTime += pauseTime;
      }
    });

    return sequence;
  }

  /**
   * Generate form filling pattern
   * Realistic field-by-field filling with reading time
   * @param {Array} fields - Array of {selector, value, type, label}
   * @returns {Array} Array of actions: {type: 'focus'|'type'|'click', field, timestamp}
   */
  generateFormFillingPattern(fields) {
    const actions = [];
    let cumulativeTime = 0;

    fields.forEach((field, index) => {
      // Focus delay (read field label)
      const focusDelay = 100 + Math.random() * 300;
      cumulativeTime += focusDelay;

      actions.push({
        type: 'focus',
        field,
        timestamp: cumulativeTime,
      });

      // Mental prep before typing
      const typingDelay = 50 + Math.random() * 150;
      cumulativeTime += typingDelay;

      // Type action (includes inter-keystroke delays)
      const typeTime = this._estimateTypingTime(field.value);
      actions.push({
        type: 'type',
        field,
        value: field.value,
        duration: typeTime,
        timestamp: cumulativeTime,
      });

      cumulativeTime += typeTime;

      // Pause to read next field (except on last field)
      if (index < fields.length - 1) {
        const nextFieldReadTime = 200 + Math.random() * 400;
        cumulativeTime += nextFieldReadTime;
      }
    });

    // Add submit delay (hesitation before submitting)
    const submitHesitation = 500 + Math.random() * 1000;
    cumulativeTime += submitHesitation;

    actions.push({
      type: 'submit',
      timestamp: cumulativeTime,
    });

    return actions;
  }

  /**
   * Estimate time to type a text value
   * @private
   */
  _estimateTypingTime(text) {
    // Assume 80 WPM = 400 characters per minute
    // = 6.67 characters per second = 150ms per character average
    const baseTimePerChar = 150;
    const variancePerChar = 30;

    let totalTime = 0;
    for (let i = 0; i < text.length; i++) {
      // Add typo correction time (5% chance)
      const typoTime = Math.random() < 0.05 ? 500 : 0;
      const charTime = baseTimePerChar + Math.random() * variancePerChar;
      totalTime += charTime + typoTime;
    }

    return Math.round(totalTime);
  }

  /**
   * Avoid copy/paste pattern
   * Detect if user would likely copy/paste (very long password, repeated data)
   * Returns suggestion whether to use copy/paste
   * @param {string} value - value to fill
   * @returns {boolean} true if should use copy/paste, false for typing
   */
  shouldUseCopyPaste(value) {
    // Long passwords (>30 chars) might be copy-pasted
    if (value.length > 30) return Math.random() < 0.3; // 30% chance
    // Very short passwords always typed
    if (value.length <= 8) return false;
    // Normal passwords: very rarely copy-pasted
    return Math.random() < 0.05; // 5% chance
  }

  /**
   * Generate realistic scroll exploration pattern
   * User scrolls page, pauses to read, scrolls more
   * @param {number} pageHeight - total page height
   * @param {number} viewportHeight - visible viewport height
   * @returns {Array} Array of {action: 'scroll'|'pause', distance, duration, timestamp}
   */
  generateScrollExploration(pageHeight, viewportHeight) {
    const scrollActions = [];
    let currentPosition = 0;
    let cumulativeTime = 0;

    // Initial page read (before scrolling)
    let readTime = 1000 + Math.random() * 1500;
    scrollActions.push({
      action: 'pause',
      reason: 'reading-initial',
      duration: readTime,
      timestamp: cumulativeTime,
    });

    cumulativeTime += readTime;

    // Scroll through page in chunks
    while (currentPosition < pageHeight - viewportHeight) {
      // Determine scroll distance (natural section breaks)
      const maxScroll = Math.min(
        500 + Math.random() * 500,
        pageHeight - viewportHeight - currentPosition
      );

      // Scroll action
      const scrollDuration = 300 + Math.random() * 400;
      scrollActions.push({
        action: 'scroll',
        distance: Math.round(maxScroll),
        duration: scrollDuration,
        timestamp: cumulativeTime,
      });

      cumulativeTime += scrollDuration;
      currentPosition += maxScroll;

      // Pause to read content
      readTime = 800 + Math.random() * 2000;
      scrollActions.push({
        action: 'pause',
        reason: 'reading-content',
        duration: readTime,
        timestamp: cumulativeTime,
      });

      cumulativeTime += readTime;

      // Chance to scroll back up slightly (re-reading)
      if (Math.random() < 0.1) {
        const scrollBackDistance = 100 + Math.random() * 200;
        scrollActions.push({
          action: 'scroll',
          distance: -scrollBackDistance,
          duration: 200,
          timestamp: cumulativeTime,
        });

        cumulativeTime += 200;
        currentPosition -= scrollBackDistance;

        // Quick re-read pause
        scrollActions.push({
          action: 'pause',
          reason: 're-reading',
          duration: 500 + Math.random() * 1000,
          timestamp: cumulativeTime,
        });

        cumulativeTime += 500 + Math.random() * 1000;
      }
    }

    return scrollActions;
  }

  /**
   * Generate focus pattern for form fields
   * Realistic tabbing/clicking between fields
   * @param {Array} fieldSelectors - array of field selectors
   * @returns {Array} Array of {field, action: 'tab'|'click', timestamp}
   */
  generateFocusPattern(fieldSelectors) {
    const focusActions = [];
    let cumulativeTime = 0;

    // First field: usually clicked
    cumulativeTime += 100 + Math.random() * 200;
    focusActions.push({
      field: fieldSelectors[0],
      action: 'click',
      timestamp: cumulativeTime,
    });

    // Subsequent fields: sometimes tabbed, sometimes clicked
    for (let i = 1; i < fieldSelectors.length; i++) {
      const useTab = Math.random() < 0.6; // 60% use tab, 40% click
      const action = useTab ? 'tab' : 'click';

      const delayBetweenFields = 200 + Math.random() * 300;
      cumulativeTime += delayBetweenFields;

      focusActions.push({
        field: fieldSelectors[i],
        action,
        timestamp: cumulativeTime,
      });
    }

    return focusActions;
  }

  /**
   * Record interaction in history for analysis
   * @param {Object} interaction - {type, timestamp, details}
   */
  recordInteraction(interaction) {
    this.interactionHistory.push({
      ...interaction,
      timestamp: interaction.timestamp || Date.now(),
    });

    // Keep history size manageable (last 1000 interactions)
    if (this.interactionHistory.length > 1000) {
      this.interactionHistory = this.interactionHistory.slice(-1000);
    }
  }

  /**
   * Get interaction history
   * @returns {Array} interaction history
   */
  getInteractionHistory() {
    return [...this.interactionHistory];
  }

  /**
   * Clear interaction history
   */
  clearHistory() {
    this.interactionHistory = [];
  }

  /**
   * Get status of interaction pattern anonymization
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      enabled: this.enabled,
      module: 'interaction-patterns',
      historySize: this.interactionHistory.length,
      features: [
        'smooth-scrolling',
        'hover-detection',
        'natural-click-sequence',
        'form-filling',
        'scroll-exploration',
        'focus-patterns',
      ],
    };
  }
}

module.exports = InteractionPatterns;
