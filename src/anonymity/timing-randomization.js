/**
 * Timing Randomization Module
 * Generates realistic delays using Gaussian distribution
 * Features: Click delays, scroll pauses, navigation delays, context-aware timing
 */

class TimingRandomization {
  constructor() {
    this.enabled = false;
  }

  /**
   * Enable timing randomization
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable timing randomization
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Generate Gaussian (normal distribution) random number
   * Mean = 0, StdDev = 1
   * Using Box-Muller transform
   * @private
   */
  _gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) {
      u = Math.random();
    } // Convert [0,1) to (0,1)
    while (v === 0) {
      v = Math.random();
    }
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z;
  }

  /**
   * Generate random delay with Gaussian distribution
   * More common around average, rare extremes
   * @param {number} mean - average delay in milliseconds
   * @param {number} stddev - standard deviation
   * @returns {number} delay in milliseconds (never negative)
   */
  gaussianDelay(mean = 300, stddev = 100) {
    const delay = mean + this._gaussianRandom() * stddev;
    return Math.max(0, Math.round(delay));
  }

  /**
   * Generate click reaction delay
   * Human reaction time: 100-500ms, typically ~300ms
   * Gaussian distribution centered at 300ms
   * @returns {number} delay in milliseconds
   */
  generateClickDelay() {
    // 300ms average, 80ms std dev
    return this.gaussianDelay(300, 80);
  }

  /**
   * Generate scroll pause duration
   * Reading time depends on content length
   * @param {number} contentLength - estimated text length (optional)
   * @returns {number} pause duration in milliseconds
   */
  generateScrollPause(contentLength = null) {
    if (contentLength === null) {
      // Generic scroll pause: 1-3 seconds
      // 2000ms average (reading a section)
      return this.gaussianDelay(2000, 400);
    }

    // Reading time: ~250 words per minute = 4.2 words/second
    const estimatedWords = Math.ceil(contentLength / 5); // Rough word estimate
    const readingTime = (estimatedWords / 250) * 60000; // ms
    const variance = Math.max(100, readingTime * 0.3);

    return Math.max(500, Math.round(this.gaussianDelay(readingTime, variance)));
  }

  /**
   * Generate navigation delay (before clicking next link)
   * Time to visually locate and process link before clicking
   * @param {string} type - 'normal' | 'quick' | 'careful'
   * @returns {number} delay in milliseconds
   */
  generateNavigationDelay(type = 'normal') {
    switch (type) {
    case 'quick':
      // Quickly scanning and clicking: 200-400ms
      return this.gaussianDelay(300, 50);
    case 'careful':
      // Careful reading and consideration: 500-1500ms
      return this.gaussianDelay(1000, 200);
    case 'normal':
    default:
      // Average user: 300-800ms
      return this.gaussianDelay(500, 100);
    }
  }

  /**
   * Generate form field delay
   * Time to read field label, understand, and prepare to type
   * @returns {number} delay in milliseconds
   */
  generateFormFieldDelay() {
    // 150-500ms to read and prepare
    return this.gaussianDelay(300, 80);
  }

  /**
   * Generate form submission delay
   * Hesitation before submitting form
   * @returns {number} delay in milliseconds
   */
  generateFormSubmissionDelay() {
    // Longer pause: 500-2000ms
    return this.gaussianDelay(1000, 300);
  }

  /**
   * Generate page load wait time
   * Realistic expectation time before scrolling/clicking
   * @param {number} estimatedLoadTime - estimated page load time (ms)
   * @returns {number} wait time in milliseconds
   */
  generatePageLoadWait(estimatedLoadTime = 2000) {
    // Wait a bit after estimated load time
    // Accounts for JavaScript execution, image loading, etc.
    const extraWait = this.gaussianDelay(500, 200);
    return estimatedLoadTime + extraWait;
  }

  /**
   * Generate focus delay (time to focus an element before interacting)
   * @returns {number} delay in milliseconds
   */
  generateFocusDelay() {
    // 50-300ms to focus and prepare
    return this.gaussianDelay(150, 50);
  }

  /**
   * Generate double-click delay (time between two clicks)
   * Human double-click is typically 300-500ms apart
   * @returns {number} delay in milliseconds
   */
  generateDoubleClickDelay() {
    return this.gaussianDelay(350, 80);
  }

  /**
   * Generate right-click context menu delay
   * Time before right-clicking (context menu preparation)
   * @returns {number} delay in milliseconds
   */
  generateContextMenuDelay() {
    return this.gaussianDelay(400, 100);
  }

  /**
   * Generate modal/dialog appearance wait time
   * Accounts for animation and readiness
   * @returns {number} delay in milliseconds
   */
  generateModalWaitTime() {
    // 300-800ms for modal to appear and be ready
    return this.gaussianDelay(500, 100);
  }

  /**
   * Generate CAPTCHA solving think time
   * User must read, understand, and solve CAPTCHA
   * @returns {number} delay in milliseconds
   */
  generateCaptchaThinkTime() {
    // 2-8 seconds to solve a CAPTCHA
    return this.gaussianDelay(4000, 1500);
  }

  /**
   * Generate keyboard pause time
   * Thinking about what to type next
   * @param {boolean} isSpecialInput - is this a special/password field?
   * @returns {number} delay in milliseconds
   */
  generateKeyboardPause(isSpecialInput = false) {
    if (isSpecialInput) {
      // More careful for passwords: 200-800ms
      return this.gaussianDelay(500, 150);
    }
    // Regular typing: 100-400ms
    return this.gaussianDelay(250, 75);
  }

  /**
   * Generate browser action sequence delay
   * Delay after completing an action before next action
   * @param {string} actionType - 'click' | 'type' | 'scroll' | 'navigate'
   * @returns {number} delay in milliseconds
   */
  generateActionSequenceDelay(actionType = 'click') {
    switch (actionType) {
    case 'type':
      // After typing, user might pause: 100-300ms
      return this.gaussianDelay(200, 50);
    case 'scroll':
      // After scrolling, pause to read: 500-2000ms
      return this.gaussianDelay(1200, 400);
    case 'navigate':
      // After navigation, wait for page: varies
      return this.gaussianDelay(1000, 300);
    case 'click':
    default:
      // After click, wait for action: 150-500ms
      return this.gaussianDelay(300, 80);
    }
  }

  /**
   * Verify delay is in realistic range
   * @param {number} delay - delay in milliseconds
   * @returns {boolean} true if realistic
   */
  isRealisticDelay(delay) {
    // Realistic delays: 10ms to 30 seconds
    return delay >= 10 && delay <= 30000;
  }

  /**
   * Get status of timing randomization
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      enabled: this.enabled,
      module: 'timing-randomization',
      distribution: 'gaussian',
      features: [
        'click-delays',
        'scroll-pauses',
        'navigation-delays',
        'form-delays',
        'gaussian-distribution',
        'context-aware'
      ]
    };
  }
}

module.exports = TimingRandomization;
