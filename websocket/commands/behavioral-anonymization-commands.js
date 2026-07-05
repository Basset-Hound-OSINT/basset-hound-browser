/**
 * Behavioral Anonymization WebSocket Commands
 * Commands to enable/disable behavioral patterns
 */

const MouseMovement = require('../../src/anonymity/mouse-movement');
const KeyboardTyping = require('../../src/anonymity/keyboard-typing');
const TimingRandomization = require('../../src/anonymity/timing-randomization');
const InteractionPatterns = require('../../src/anonymity/interaction-patterns');

class BehavioralAnonymizationCommands {
  constructor() {
    // Global instances for behavioral modules
    this.mouseMovement = new MouseMovement();
    this.keyboardTyping = new KeyboardTyping();
    this.timingRandomization = new TimingRandomization();
    this.interactionPatterns = new InteractionPatterns();
  }

  /**
   * Enable mouse movement anonymization
   */
  enable_mouse_anonymization(params) {
    this.mouseMovement.enable();
    return {
      success: true,
      module: 'mouse-movement',
      enabled: true,
      message: 'Mouse movement anonymization enabled'
    };
  }

  /**
   * Disable mouse movement anonymization
   */
  disable_mouse_anonymization(params) {
    this.mouseMovement.disable();
    return {
      success: true,
      module: 'mouse-movement',
      enabled: false,
      message: 'Mouse movement anonymization disabled'
    };
  }

  /**
   * Enable keyboard typing anonymization
   */
  enable_keyboard_anonymization(params) {
    this.keyboardTyping.enable();

    // Optionally set typing speed
    if (params && params.wpm) {
      this.keyboardTyping.setTypingSpeed(params.wpm);
    }

    return {
      success: true,
      module: 'keyboard-typing',
      enabled: true,
      typingSpeed: this.keyboardTyping.typingWPM,
      message: 'Keyboard typing anonymization enabled'
    };
  }

  /**
   * Disable keyboard typing anonymization
   */
  disable_keyboard_anonymization(params) {
    this.keyboardTyping.disable();
    return {
      success: true,
      module: 'keyboard-typing',
      enabled: false,
      message: 'Keyboard typing anonymization disabled'
    };
  }

  /**
   * Enable timing randomization
   */
  enable_timing_randomization(params) {
    this.timingRandomization.enable();
    return {
      success: true,
      module: 'timing-randomization',
      enabled: true,
      message: 'Timing randomization enabled'
    };
  }

  /**
   * Disable timing randomization
   */
  disable_timing_randomization(params) {
    this.timingRandomization.disable();
    return {
      success: true,
      module: 'timing-randomization',
      enabled: false,
      message: 'Timing randomization disabled'
    };
  }

  /**
   * Enable interaction pattern anonymization
   */
  enable_interaction_anonymization(params) {
    this.interactionPatterns.enable();
    return {
      success: true,
      module: 'interaction-patterns',
      enabled: true,
      message: 'Interaction pattern anonymization enabled'
    };
  }

  /**
   * Disable interaction pattern anonymization
   */
  disable_interaction_anonymization(params) {
    this.interactionPatterns.disable();
    return {
      success: true,
      module: 'interaction-patterns',
      enabled: false,
      message: 'Interaction pattern anonymization disabled'
    };
  }

  /**
   * Enable all behavioral anonymization
   * Convenience command to enable all behaviors at once
   */
  enable_behavior_anonymization(params) {
    this.mouseMovement.enable();
    this.keyboardTyping.enable();
    this.timingRandomization.enable();
    this.interactionPatterns.enable();

    // Optionally set typing speed
    if (params && params.wpm) {
      this.keyboardTyping.setTypingSpeed(params.wpm);
    }

    return {
      success: true,
      module: 'all-behaviors',
      enabled: true,
      enabledModules: [
        'mouse-movement',
        'keyboard-typing',
        'timing-randomization',
        'interaction-patterns'
      ],
      typingSpeed: this.keyboardTyping.typingWPM,
      message: 'All behavioral anonymization enabled'
    };
  }

  /**
   * Disable all behavioral anonymization
   * Convenience command to disable all behaviors at once
   */
  disable_behavior_anonymization(params) {
    this.mouseMovement.disable();
    this.keyboardTyping.disable();
    this.timingRandomization.disable();
    this.interactionPatterns.disable();

    return {
      success: true,
      module: 'all-behaviors',
      enabled: false,
      message: 'All behavioral anonymization disabled'
    };
  }

  /**
   * Get behavioral anonymization status
   * Returns which behaviors are enabled and their settings
   */
  get_behavior_status(params) {
    return {
      success: true,
      behaviors: {
        mouseMovement: this.mouseMovement.getStatus(),
        keyboardTyping: this.keyboardTyping.getStatus(),
        timingRandomization: this.timingRandomization.getStatus(),
        interactionPatterns: this.interactionPatterns.getStatus()
      },
      overallEnabled:
        this.mouseMovement.enabled &&
        this.keyboardTyping.enabled &&
        this.timingRandomization.enabled &&
        this.interactionPatterns.enabled
    };
  }

  /**
   * Set keyboard typing speed
   */
  set_typing_speed(params) {
    if (!params || typeof params.wpm !== 'number') {
      return {
        success: false,
        error: 'wpm parameter required (60-120)'
      };
    }

    this.keyboardTyping.setTypingSpeed(params.wpm);
    return {
      success: true,
      module: 'keyboard-typing',
      typingSpeed: this.keyboardTyping.typingWPM,
      message: `Typing speed set to ${this.keyboardTyping.typingWPM} WPM`
    };
  }

  /**
   * Generate mouse movement path
   * Returns path from start to end position
   */
  generate_mouse_path(params) {
    if (
      !params ||
      !params.startPos ||
      !params.endPos ||
      typeof params.startPos.x !== 'number'
    ) {
      return {
        success: false,
        error:
          'params.startPos and params.endPos required {x: number, y: number}'
      };
    }

    const duration =
      params.duration ||
      this.mouseMovement.calculateMovementDuration(
        Math.sqrt(
          Math.pow(params.endPos.x - params.startPos.x, 2) +
            Math.pow(params.endPos.y - params.startPos.y, 2)
        )
      );

    const path = this.mouseMovement.generateBezierPath(
      params.startPos,
      params.endPos,
      duration
    );

    return {
      success: true,
      path,
      startPos: params.startPos,
      endPos: params.endPos,
      duration,
      segments: path.length
    };
  }

  /**
   * Generate keyboard typing sequence
   * Returns sequence of key events with timing
   */
  generate_typing_sequence(params) {
    if (!params || !params.text) {
      return {
        success: false,
        error: 'params.text required (string to type)'
      };
    }

    const sequence = this.keyboardTyping.generateTypingSequence(params.text);

    return {
      success: true,
      text: params.text,
      sequence,
      totalDuration: sequence.reduce((sum, event) => sum + event.delay, 0),
      events: sequence.length
    };
  }

  /**
   * Generate interaction delays
   * Returns various timing delays for different interaction types
   */
  generate_interaction_delays(params) {
    const delayType = (params && params.type) || 'all';

    const delays = {};

    if (delayType === 'all' || delayType === 'click') {
      delays.clickDelay = this.timingRandomization.generateClickDelay();
    }

    if (delayType === 'all' || delayType === 'scroll') {
      delays.scrollPause =
        this.timingRandomization.generateScrollPause(params?.contentLength);
    }

    if (delayType === 'all' || delayType === 'navigation') {
      delays.navigationDelay =
        this.timingRandomization.generateNavigationDelay(params?.navType);
    }

    if (delayType === 'all' || delayType === 'form') {
      delays.formFieldDelay = this.timingRandomization.generateFormFieldDelay();
      delays.formSubmissionDelay =
        this.timingRandomization.generateFormSubmissionDelay();
    }

    if (delayType === 'all' || delayType === 'focus') {
      delays.focusDelay = this.timingRandomization.generateFocusDelay();
    }

    if (delayType === 'all' || delayType === 'modal') {
      delays.modalWaitTime = this.timingRandomization.generateModalWaitTime();
    }

    if (delayType === 'all' || delayType === 'captcha') {
      delays.captchaThinkTime =
        this.timingRandomization.generateCaptchaThinkTime();
    }

    return {
      success: true,
      delayType,
      delays
    };
  }

  /**
   * Generate form filling pattern
   * Returns realistic sequence of form field interactions
   */
  generate_form_pattern(params) {
    if (!params || !params.fields || !Array.isArray(params.fields)) {
      return {
        success: false,
        error: 'params.fields required (array of {label, value, type, selector})'
      };
    }

    const actions = this.interactionPatterns.generateFormFillingPattern(
      params.fields
    );

    return {
      success: true,
      actions,
      totalDuration:
        actions.length > 0
          ? actions[actions.length - 1].timestamp || 0
          : 0,
      steps: actions.length
    };
  }

  /**
   * Generate hover pattern before click
   * Returns realistic hover movement
   */
  generate_hover_pattern(params) {
    if (!params || !params.element) {
      return {
        success: false,
        error: 'params.element required {x, y, width, height}'
      };
    }

    const hoverPattern = this.interactionPatterns.generateHoverPattern(
      params.element
    );

    return {
      success: true,
      element: params.element,
      hoverPattern,
      duration:
        hoverPattern.length > 0
          ? hoverPattern[hoverPattern.length - 1].timestamp
          : 0,
      steps: hoverPattern.length
    };
  }

  /**
   * Generate scroll exploration pattern
   * Returns realistic scrolling through page
   */
  generate_scroll_pattern(params) {
    if (
      !params ||
      typeof params.pageHeight !== 'number' ||
      typeof params.viewportHeight !== 'number'
    ) {
      return {
        success: false,
        error: 'params.pageHeight and params.viewportHeight required (numbers)'
      };
    }

    const scrollPattern = this.interactionPatterns.generateScrollExploration(
      params.pageHeight,
      params.viewportHeight
    );

    return {
      success: true,
      pageHeight: params.pageHeight,
      viewportHeight: params.viewportHeight,
      scrollActions: scrollPattern,
      totalDuration:
        scrollPattern.length > 0
          ? scrollPattern[scrollPattern.length - 1].timestamp
          : 0,
      actions: scrollPattern.length
    };
  }

  /**
   * Reset all behavioral state
   */
  reset_behavior_state(params) {
    this.interactionPatterns.clearHistory();

    return {
      success: true,
      message: 'Behavioral state reset',
      clearedHistory: true
    };
  }
}

module.exports = BehavioralAnonymizationCommands;
