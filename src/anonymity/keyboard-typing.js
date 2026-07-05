/**
 * Keyboard Typing Anonymization Module
 * Simulates realistic typing patterns (not instant text injection)
 * Features: Variable speed, typos, corrections, realistic key timing
 */

class KeyboardTyping {
  constructor() {
    this.enabled = false;
    this.typingWPM = 80; // Default typing speed in words per minute
  }

  /**
   * Enable keyboard typing anonymization
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable keyboard typing anonymization
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Set typing speed (words per minute)
   * Realistic range: 60-120 WPM
   * @param {number} wpm - words per minute
   */
  setTypingSpeed(wpm = 80) {
    // Clamp to realistic range
    this.typingWPM = Math.max(60, Math.min(120, wpm));
  }

  /**
   * Calculate delay between keystrokes
   * Based on WPM with variance
   * @param {string} key - the character being typed
   * @returns {number} delay in milliseconds
   */
  calculateKeyDelay(key = 'a') {
    // Average word = 5 characters
    // WPM = words per minute
    // Base delay = 60000 / (wpm * 5) milliseconds per character
    const baseDelay = 60000 / (this.typingWPM * 5);

    // Add variance (±20%)
    const variance = baseDelay * (0.8 + Math.random() * 0.4);

    // Some keys are slower to type (shift, numbers, special chars)
    let keyPenalty = 1.0;
    if (/[A-Z]|[!@#$%^&*()_\-+=\[\]{};:'",<.>/?\\|`~]/.test(key)) {
      keyPenalty = 1.1 + Math.random() * 0.1; // 10-20% slower for special keys
    }

    // Keep hold time realistic (50-100ms per key)
    return variance * keyPenalty;
  }

  /**
   * Calculate key hold time (how long to hold the key down)
   * @returns {number} hold time in milliseconds
   */
  calculateKeyHoldTime() {
    // Realistic key hold: 50-100ms
    return 50 + Math.random() * 50;
  }

  /**
   * Generate sequence of character inputs with realistic timing
   * Includes occasional typos and corrections
   * @param {string} text - text to type
   * @returns {Array} Array of {type: 'down'|'up', key, delay, holdTime}
   */
  generateTypingSequence(text) {
    const sequence = [];
    const typoRate = 0.05; // 5% error rate

    let charIndex = 0;
    while (charIndex < text.length) {
      const char = text[charIndex];
      const shouldTypo = Math.random() < typoRate && charIndex < text.length - 1;

      if (shouldTypo) {
        // Generate a typo
        const typoChar = this._generateTypo(char);
        const holdTime = this.calculateKeyHoldTime();
        const delay = this.calculateKeyDelay(typoChar);

        // Type the wrong character
        sequence.push({
          type: 'keydown',
          key: typoChar,
          delay,
          holdTime
        });

        sequence.push({
          type: 'keyup',
          key: typoChar,
          delay: holdTime,
          holdTime: 0
        });

        // Pause before correcting (50-200ms of realization time)
        sequence.push({
          type: 'pause',
          delay: 50 + Math.random() * 150
        });

        // Backspace to correct
        const backspaceHoldTime = this.calculateKeyHoldTime();
        sequence.push({
          type: 'keydown',
          key: 'Backspace',
          delay: this.calculateKeyDelay('Backspace'),
          holdTime: backspaceHoldTime
        });

        sequence.push({
          type: 'keyup',
          key: 'Backspace',
          delay: backspaceHoldTime,
          holdTime: 0
        });

        // Slight pause before retrying (100-300ms)
        sequence.push({
          type: 'pause',
          delay: 100 + Math.random() * 200
        });

        // Retry the correct character
        // (don't increment charIndex yet, will happen below)
      }

      // Type correct character
      const holdTime = this.calculateKeyHoldTime();
      const delay = this.calculateKeyDelay(char);

      // Handle shift for capitals
      if (/[A-Z]/.test(char)) {
        sequence.push({
          type: 'keydown',
          key: 'Shift',
          delay: delay * 0.3, // Shift goes down slightly before letter
          holdTime: 0
        });
      }

      sequence.push({
        type: 'keydown',
        key: char,
        delay: /[A-Z]/.test(char) ? 20 + Math.random() * 30 : delay,
        holdTime
      });

      sequence.push({
        type: 'keyup',
        key: char,
        delay: holdTime,
        holdTime: 0
      });

      if (/[A-Z]/.test(char)) {
        sequence.push({
          type: 'keyup',
          key: 'Shift',
          delay: 10 + Math.random() * 20,
          holdTime: 0
        });
      }

      // Inter-keystroke delay (variable, realistic)
      if (charIndex < text.length - 1) {
        sequence.push({
          type: 'pause',
          delay: this.calculateKeyDelay()
        });
      }

      charIndex++;
    }

    return sequence;
  }

  /**
   * Generate a typo (similar character to the intended one)
   * @private
   */
  _generateTypo(char) {
    // Common typos: adjacent keys on QWERTY
    const qwertyMap = {
      a: ['s', 'q', 'w'],
      b: ['v', 'n', 'g'],
      c: ['x', 'v', 'd'],
      d: ['s', 'f', 'e'],
      e: ['w', 'r', 'd'],
      f: ['d', 'g', 'r'],
      g: ['f', 'h', 't'],
      h: ['g', 'j', 'y'],
      i: ['u', 'o', 'k'],
      j: ['h', 'k', 'u'],
      k: ['j', 'l', 'i'],
      l: ['k', 'o', 'p'],
      m: ['n', ',', 'j'],
      n: ['b', 'm', 'h'],
      o: ['i', 'p', 'l'],
      p: ['o', '[', 'l'],
      q: ['w', 'a', 's'],
      r: ['e', 't', 'f'],
      s: ['a', 'd', 'w'],
      t: ['r', 'y', 'g'],
      u: ['y', 'i', 'j'],
      v: ['c', 'b', 'f'],
      w: ['q', 'e', 'a'],
      x: ['z', 'c', 's'],
      y: ['t', 'u', 'h'],
      z: ['x', 'a', 's']
    };

    const lowerChar = char.toLowerCase();
    const typos = qwertyMap[lowerChar] || [char];
    const typoChoice = typos[Math.floor(Math.random() * typos.length)];

    // Preserve case
    return /[A-Z]/.test(char) ? typoChoice.toUpperCase() : typoChoice;
  }

  /**
   * Generate pause before form submission
   * Realistic hesitation (500-1500ms)
   * @returns {number} delay in milliseconds
   */
  generateSubmitHesitation() {
    return 500 + Math.random() * 1000;
  }

  /**
   * Generate pause before/after special characters
   * Users tend to pause at punctuation/special chars
   * @returns {number} delay in milliseconds
   */
  generateSpecialCharPause() {
    return 100 + Math.random() * 300;
  }

  /**
   * Generate delay before reading and filling a form field
   * Realistic read time for field label
   * @returns {number} delay in milliseconds
   */
  generateFieldReadDelay() {
    // 100-500ms to "read" the field label
    return 100 + Math.random() * 400;
  }

  /**
   * Generate delay moving between form fields
   * Realistic navigation delay
   * @returns {number} delay in milliseconds
   */
  generateFieldTransitionDelay() {
    // 200-800ms to move to next field
    return 200 + Math.random() * 600;
  }

  /**
   * Check if text contains special characters
   * @private
   */
  _hasSpecialChars(text) {
    return /[!@#$%^&*()_\-+=\[\]{};:'",<.>/?\\|`~]/.test(text);
  }

  /**
   * Get status of keyboard typing anonymization
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      enabled: this.enabled,
      module: 'keyboard-typing',
      typingSpeed: this.typingWPM,
      features: [
        'variable-speed',
        'typos',
        'corrections',
        'key-hold-variation',
        'realistic-timing'
      ]
    };
  }
}

module.exports = KeyboardTyping;
