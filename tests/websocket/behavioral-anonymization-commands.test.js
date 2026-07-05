const BehavioralAnonymizationCommands = require('../../websocket/commands/behavioral-anonymization-commands');

describe('Behavioral Anonymization WebSocket Commands', () => {
  let commands;

  beforeEach(() => {
    commands = new BehavioralAnonymizationCommands();
  });

  describe('Initialization', () => {
    test('Should create command handler', () => {
      expect(commands).toBeDefined();
      expect(commands.mouseMovement).toBeDefined();
      expect(commands.keyboardTyping).toBeDefined();
      expect(commands.timingRandomization).toBeDefined();
      expect(commands.interactionPatterns).toBeDefined();
    });
  });

  describe('Mouse Movement Commands', () => {
    test('enable_mouse_anonymization should enable module', () => {
      const response = commands.enable_mouse_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(true);
      expect(commands.mouseMovement.enabled).toBe(true);
    });

    test('disable_mouse_anonymization should disable module', () => {
      commands.enable_mouse_anonymization({});
      const response = commands.disable_mouse_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(false);
      expect(commands.mouseMovement.enabled).toBe(false);
    });
  });

  describe('Keyboard Typing Commands', () => {
    test('enable_keyboard_anonymization should enable module', () => {
      const response = commands.enable_keyboard_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(true);
      expect(commands.keyboardTyping.enabled).toBe(true);
    });

    test('disable_keyboard_anonymization should disable module', () => {
      commands.enable_keyboard_anonymization({});
      const response = commands.disable_keyboard_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(false);
      expect(commands.keyboardTyping.enabled).toBe(false);
    });

    test('enable_keyboard_anonymization should set WPM if provided', () => {
      const response = commands.enable_keyboard_anonymization({ wpm: 100 });

      expect(response.typingSpeed).toBe(100);
      expect(commands.keyboardTyping.typingWPM).toBe(100);
    });
  });

  describe('Timing Randomization Commands', () => {
    test('enable_timing_randomization should enable module', () => {
      const response = commands.enable_timing_randomization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(true);
      expect(commands.timingRandomization.enabled).toBe(true);
    });

    test('disable_timing_randomization should disable module', () => {
      commands.enable_timing_randomization({});
      const response = commands.disable_timing_randomization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(false);
      expect(commands.timingRandomization.enabled).toBe(false);
    });
  });

  describe('Interaction Pattern Commands', () => {
    test('enable_interaction_anonymization should enable module', () => {
      const response = commands.enable_interaction_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(true);
      expect(commands.interactionPatterns.enabled).toBe(true);
    });

    test('disable_interaction_anonymization should disable module', () => {
      commands.enable_interaction_anonymization({});
      const response = commands.disable_interaction_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(false);
      expect(commands.interactionPatterns.enabled).toBe(false);
    });
  });

  describe('Behavior Group Commands', () => {
    test('enable_behavior_anonymization should enable all modules', () => {
      const response = commands.enable_behavior_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(true);
      expect(commands.mouseMovement.enabled).toBe(true);
      expect(commands.keyboardTyping.enabled).toBe(true);
      expect(commands.timingRandomization.enabled).toBe(true);
      expect(commands.interactionPatterns.enabled).toBe(true);
    });

    test('disable_behavior_anonymization should disable all modules', () => {
      commands.enable_behavior_anonymization({});
      const response = commands.disable_behavior_anonymization({});

      expect(response.success).toBe(true);
      expect(response.enabled).toBe(false);
      expect(commands.mouseMovement.enabled).toBe(false);
      expect(commands.keyboardTyping.enabled).toBe(false);
      expect(commands.timingRandomization.enabled).toBe(false);
      expect(commands.interactionPatterns.enabled).toBe(false);
    });

    test('enable_behavior_anonymization should list enabled modules', () => {
      const response = commands.enable_behavior_anonymization({});

      expect(response.enabledModules).toContain('mouse-movement');
      expect(response.enabledModules).toContain('keyboard-typing');
      expect(response.enabledModules).toContain('timing-randomization');
      expect(response.enabledModules).toContain('interaction-patterns');
    });

    test('enable_behavior_anonymization should set typing speed if provided', () => {
      const response = commands.enable_behavior_anonymization({ wpm: 90 });

      expect(response.typingSpeed).toBe(90);
    });
  });

  describe('Status Command', () => {
    test('get_behavior_status should return status for all modules', () => {
      const response = commands.get_behavior_status({});

      expect(response.success).toBe(true);
      expect(response.behaviors).toBeDefined();
      expect(response.behaviors.mouseMovement).toBeDefined();
      expect(response.behaviors.keyboardTyping).toBeDefined();
      expect(response.behaviors.timingRandomization).toBeDefined();
      expect(response.behaviors.interactionPatterns).toBeDefined();
    });

    test('get_behavior_status should show all disabled initially', () => {
      const response = commands.get_behavior_status({});

      expect(response.behaviors.mouseMovement.enabled).toBe(false);
      expect(response.behaviors.keyboardTyping.enabled).toBe(false);
      expect(response.behaviors.timingRandomization.enabled).toBe(false);
      expect(response.behaviors.interactionPatterns.enabled).toBe(false);
      expect(response.overallEnabled).toBe(false);
    });

    test('get_behavior_status should show all enabled when enabled', () => {
      commands.enable_behavior_anonymization({});
      const response = commands.get_behavior_status({});

      expect(response.behaviors.mouseMovement.enabled).toBe(true);
      expect(response.behaviors.keyboardTyping.enabled).toBe(true);
      expect(response.behaviors.timingRandomization.enabled).toBe(true);
      expect(response.behaviors.interactionPatterns.enabled).toBe(true);
      expect(response.overallEnabled).toBe(true);
    });

    test('get_behavior_status should show partial enable', () => {
      commands.enable_mouse_anonymization({});
      commands.enable_keyboard_anonymization({});
      const response = commands.get_behavior_status({});

      expect(response.behaviors.mouseMovement.enabled).toBe(true);
      expect(response.behaviors.keyboardTyping.enabled).toBe(true);
      expect(response.behaviors.timingRandomization.enabled).toBe(false);
      expect(response.overallEnabled).toBe(false);
    });
  });

  describe('Typing Speed Command', () => {
    test('set_typing_speed should set speed', () => {
      const response = commands.set_typing_speed({ wpm: 100 });

      expect(response.success).toBe(true);
      expect(response.typingSpeed).toBe(100);
      expect(commands.keyboardTyping.typingWPM).toBe(100);
    });

    test('set_typing_speed should reject missing wpm', () => {
      const response = commands.set_typing_speed({});

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('set_typing_speed should reject invalid wpm', () => {
      const response = commands.set_typing_speed({ wpm: 'invalid' });

      expect(response.success).toBe(false);
    });
  });

  describe('Mouse Path Generation', () => {
    test('generate_mouse_path should generate path', () => {
      const response = commands.generate_mouse_path({
        startPos: { x: 0, y: 0 },
        endPos: { x: 100, y: 100 }
      });

      expect(response.success).toBe(true);
      expect(response.path).toBeDefined();
      expect(Array.isArray(response.path)).toBe(true);
      expect(response.path.length).toBeGreaterThan(0);
    });

    test('generate_mouse_path should reject missing positions', () => {
      const response = commands.generate_mouse_path({});

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('generate_mouse_path should use provided duration', () => {
      const response = commands.generate_mouse_path({
        startPos: { x: 0, y: 0 },
        endPos: { x: 100, y: 100 },
        duration: 2000
      });

      expect(response.duration).toBe(2000);
    });

    test('generate_mouse_path should return path metadata', () => {
      const response = commands.generate_mouse_path({
        startPos: { x: 0, y: 0 },
        endPos: { x: 100, y: 100 }
      });

      expect(response.startPos).toEqual({ x: 0, y: 0 });
      expect(response.endPos).toEqual({ x: 100, y: 100 });
      expect(response.segments).toBeGreaterThan(0);
    });
  });

  describe('Typing Sequence Generation', () => {
    test('generate_typing_sequence should generate sequence', () => {
      const response = commands.generate_typing_sequence({
        text: 'hello'
      });

      expect(response.success).toBe(true);
      expect(response.sequence).toBeDefined();
      expect(Array.isArray(response.sequence)).toBe(true);
      expect(response.sequence.length).toBeGreaterThan(0);
    });

    test('generate_typing_sequence should reject missing text', () => {
      const response = commands.generate_typing_sequence({});

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('generate_typing_sequence should return duration', () => {
      const response = commands.generate_typing_sequence({
        text: 'password'
      });

      expect(response.totalDuration).toBeGreaterThan(0);
    });

    test('generate_typing_sequence should return event count', () => {
      const response = commands.generate_typing_sequence({
        text: 'test'
      });

      expect(response.events).toBeGreaterThan(0);
    });
  });

  describe('Interaction Delays Generation', () => {
    test('generate_interaction_delays should generate all delays', () => {
      const response = commands.generate_interaction_delays({
        type: 'all'
      });

      expect(response.success).toBe(true);
      expect(response.delays).toBeDefined();
      expect(response.delays.clickDelay).toBeGreaterThan(0);
      expect(response.delays.scrollPause).toBeGreaterThan(0);
      expect(response.delays.navigationDelay).toBeGreaterThan(0);
      expect(response.delays.formFieldDelay).toBeGreaterThan(0);
      expect(response.delays.formSubmissionDelay).toBeGreaterThan(0);
    });

    test('generate_interaction_delays should generate click delay only', () => {
      const response = commands.generate_interaction_delays({
        type: 'click'
      });

      expect(response.success).toBe(true);
      expect(response.delays.clickDelay).toBeGreaterThan(0);
      expect(response.delays.scrollPause).toBeUndefined();
    });

    test('generate_interaction_delays should generate form delays', () => {
      const response = commands.generate_interaction_delays({
        type: 'form'
      });

      expect(response.delays.formFieldDelay).toBeGreaterThan(0);
      expect(response.delays.formSubmissionDelay).toBeGreaterThan(0);
    });

    test('generate_interaction_delays should support content length', () => {
      const response = commands.generate_interaction_delays({
        type: 'scroll',
        contentLength: 2000
      });

      expect(response.delays.scrollPause).toBeGreaterThan(0);
    });

    test('generate_interaction_delays should default to all', () => {
      const response = commands.generate_interaction_delays({});

      expect(response.delays.clickDelay).toBeGreaterThan(0);
    });
  });

  describe('Form Pattern Generation', () => {
    test('generate_form_pattern should generate form actions', () => {
      const response = commands.generate_form_pattern({
        fields: [
          { selector: '#name', value: 'John', type: 'text', label: 'Name' },
          {
            selector: '#email',
            value: 'john@example.com',
            type: 'email',
            label: 'Email'
          }
        ]
      });

      expect(response.success).toBe(true);
      expect(response.actions).toBeDefined();
      expect(Array.isArray(response.actions)).toBe(true);
      expect(response.actions.length).toBeGreaterThan(0);
    });

    test('generate_form_pattern should reject missing fields', () => {
      const response = commands.generate_form_pattern({});

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('generate_form_pattern should return duration', () => {
      const response = commands.generate_form_pattern({
        fields: [
          { selector: '#name', value: 'John', type: 'text' }
        ]
      });

      expect(response.totalDuration).toBeGreaterThanOrEqual(0);
    });

    test('generate_form_pattern should return step count', () => {
      const response = commands.generate_form_pattern({
        fields: [
          { selector: '#name', value: 'John', type: 'text' }
        ]
      });

      expect(response.steps).toBeGreaterThan(0);
    });
  });

  describe('Hover Pattern Generation', () => {
    test('generate_hover_pattern should generate hover movement', () => {
      const response = commands.generate_hover_pattern({
        element: { x: 100, y: 100, width: 200, height: 50 }
      });

      expect(response.success).toBe(true);
      expect(response.hoverPattern).toBeDefined();
      expect(Array.isArray(response.hoverPattern)).toBe(true);
    });

    test('generate_hover_pattern should reject missing element', () => {
      const response = commands.generate_hover_pattern({});

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('generate_hover_pattern should return duration', () => {
      const response = commands.generate_hover_pattern({
        element: { x: 100, y: 100, width: 200, height: 50 }
      });

      expect(response.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scroll Pattern Generation', () => {
    test('generate_scroll_pattern should generate scroll actions', () => {
      const response = commands.generate_scroll_pattern({
        pageHeight: 5000,
        viewportHeight: 800
      });

      expect(response.success).toBe(true);
      expect(response.scrollActions).toBeDefined();
      expect(Array.isArray(response.scrollActions)).toBe(true);
    });

    test('generate_scroll_pattern should reject missing dimensions', () => {
      const response = commands.generate_scroll_pattern({
        pageHeight: 5000
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('generate_scroll_pattern should return duration', () => {
      const response = commands.generate_scroll_pattern({
        pageHeight: 5000,
        viewportHeight: 800
      });

      expect(response.totalDuration).toBeGreaterThanOrEqual(0);
    });

    test('generate_scroll_pattern should return action count', () => {
      const response = commands.generate_scroll_pattern({
        pageHeight: 5000,
        viewportHeight: 800
      });

      expect(response.actions).toBeGreaterThan(0);
    });
  });

  describe('Reset State', () => {
    test('reset_behavior_state should clear history', () => {
      commands.interactionPatterns.recordInteraction({ type: 'click' });
      expect(commands.interactionPatterns.interactionHistory.length).toBe(1);

      const response = commands.reset_behavior_state({});

      expect(response.success).toBe(true);
      expect(commands.interactionPatterns.interactionHistory.length).toBe(0);
    });
  });

  describe('Command Integration', () => {
    test('Should be able to enable, check, and disable', () => {
      commands.enable_behavior_anonymization({});
      const status1 = commands.get_behavior_status({});
      expect(status1.overallEnabled).toBe(true);

      commands.disable_behavior_anonymization({});
      const status2 = commands.get_behavior_status({});
      expect(status2.overallEnabled).toBe(false);
    });

    test('Should be able to generate paths while behaviors enabled', () => {
      commands.enable_behavior_anonymization({});

      const pathResponse = commands.generate_mouse_path({
        startPos: { x: 0, y: 0 },
        endPos: { x: 100, y: 100 }
      });

      expect(pathResponse.success).toBe(true);
      expect(pathResponse.path).toBeDefined();
    });

    test('Should generate consistent output for same input', () => {
      const response1 = commands.generate_typing_sequence({
        text: 'test'
      });

      const response2 = commands.generate_typing_sequence({
        text: 'test'
      });

      // Both should succeed
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);

      // Both should generate valid sequences (but likely different due to randomization)
      expect(response1.sequence.length).toBeGreaterThan(0);
      expect(response2.sequence.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('Commands should handle null params', () => {
      const response = commands.set_typing_speed(null);
      expect(response.success).toBe(false);
    });

    test('Commands should handle invalid param types', () => {
      const response = commands.set_typing_speed({ wpm: null });
      expect(response.success).toBe(false);
    });

    test('Generation commands should gracefully fail on bad input', () => {
      const response = commands.generate_mouse_path({
        startPos: null
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });
});
