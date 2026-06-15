/**
 * Extended Features Test Suite - Phase 3 Validation
 *
 * Tests for all 22 new WebSocket commands:
 * - Video Recording Enhancements (5 tests)
 * - Full-Page Screenshot (3 tests)
 * - Session Recording & Playback (6 tests)
 * - Advanced DOM Queries (8 tests)
 *
 * @module tests/features/extended-features
 */

const {
  startVideoRecording,
  getVideoRecordingStatus,
  stopVideoRecording,
  pauseVideoRecording,
  resumeVideoRecording,
  captureFullPage,
  captureWithScrollback,
  stitchScreenshots,
  startSessionRecording,
  getSessionRecording,
  replaySession,
  compareSessions,
  exportSessionRecording,
  findElementsByText,
  getElementProperties,
  getElementState,
  findClickableElements,
  getFormFields,
  analyzePageStructure,
  findTextRegions,
  evaluateCssSelector,
  xpathQuery
} = require('../../websocket/commands/extended-features-commands');

describe('Extended Features - Phase 3', () => {

  // ==========================================
  // VIDEO RECORDING ENHANCEMENTS
  // ==========================================

  describe('Video Recording Enhancements', () => {

    let context;

    beforeEach(() => {
      context = { videoRecordings: {} };
    });

    test('should start video recording with default options', () => {
      const result = startVideoRecording(context, {});
      expect(result.success).toBe(true);
      expect(result.recordingId).toBeDefined();
      expect(result.started).toBe(true);
      expect(result.options.quality).toBe('high');
      expect(result.options.fps).toBe(30);
      expect(result.options.codec).toBe('h264');
    });

    test('should start video recording with custom options', () => {
      const result = startVideoRecording(context, {
        options: {
          quality: 'medium',
          fps: 24,
          codec: 'vp9',
          includeAudio: true,
          format: 'webm'
        }
      });
      expect(result.success).toBe(true);
      expect(result.options.quality).toBe('medium');
      expect(result.options.fps).toBe(24);
      expect(result.options.codec).toBe('vp9');
      expect(result.options.includeAudio).toBe(true);
    });

    test('should reject invalid quality option', () => {
      const result = startVideoRecording(context, {
        options: { quality: 'ultra' }
      });
      expect(result.error).toContain('Invalid quality');
    });

    test('should reject invalid codec option', () => {
      const result = startVideoRecording(context, {
        options: { codec: 'unknown' }
      });
      expect(result.error).toContain('Invalid codec');
    });

    test('should reject invalid FPS', () => {
      const result = startVideoRecording(context, {
        options: { fps: 120 }
      });
      expect(result.error).toContain('FPS must be between 1 and 60');
    });

    test('should get video recording status', () => {
      const startResult = startVideoRecording(context, {
        options: { quality: 'high', fps: 30 }
      });
      const recordingId = startResult.recordingId;

      const statusResult = getVideoRecordingStatus(context, { recordingId });
      expect(statusResult.recording).toBe(true);
      expect(statusResult.fps).toBe(30);
      expect(statusResult.codec).toBe('h264');
    });

    test('should get video recording status for non-existent recording', () => {
      const result = getVideoRecordingStatus(context, { recordingId: 'invalid' });
      expect(result.error).toContain('not found');
    });

    test('should stop video recording', () => {
      const startResult = startVideoRecording(context, {});
      const recordingId = startResult.recordingId;

      const stopResult = stopVideoRecording(context, { recordingId });
      expect(stopResult.success).toBe(true);
      expect(stopResult.recordingId).toBe(recordingId);
      expect(stopResult.duration).toBeGreaterThanOrEqual(0);
      expect(stopResult.fileSize).toBeGreaterThan(0);
    });

    test('should pause video recording', () => {
      const startResult = startVideoRecording(context, {});
      const recordingId = startResult.recordingId;

      const pauseResult = pauseVideoRecording(context, { recordingId });
      expect(pauseResult.success).toBe(true);
      expect(pauseResult.paused).toBe(true);
    });

    test('should resume video recording', () => {
      const startResult = startVideoRecording(context, {});
      const recordingId = startResult.recordingId;

      pauseVideoRecording(context, { recordingId });
      const resumeResult = resumeVideoRecording(context, { recordingId });
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.recording).toBe(true);
    });

    test('should not stop non-existent recording', () => {
      const result = stopVideoRecording(context, { recordingId: 'invalid' });
      expect(result.error).toContain('not found');
    });

    test('should not pause inactive recording', () => {
      const startResult = startVideoRecording(context, {});
      const recordingId = startResult.recordingId;

      stopVideoRecording(context, { recordingId });
      const result = pauseVideoRecording(context, { recordingId });
      expect(result.error).toContain('not active');
    });

  });

  // ==========================================
  // FULL-PAGE SCREENSHOT
  // ==========================================

  describe('Full-Page Screenshot', () => {

    let context;
    const mainWindow = {};

    beforeEach(() => {
      context = { screenshots: {} };
    });

    test('should capture full page with default options', () => {
      const result = captureFullPage(context, mainWindow, {});
      expect(result.success).toBe(true);
      expect(result.captureId).toBeDefined();
      expect(result.type).toBe('full-page');
      expect(result.format).toBe('png');
      expect(result.quality).toBe(0.95);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(4800);
    });

    test('should capture full page with custom format', () => {
      const result = captureFullPage(context, mainWindow, {
        options: { format: 'jpeg', quality: 0.85 }
      });
      expect(result.success).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.quality).toBe(0.85);
    });

    test('should reject invalid format', () => {
      const result = captureFullPage(context, mainWindow, {
        options: { format: 'bmp' }
      });
      expect(result.error).toContain('Invalid format');
    });

    test('should reject invalid quality', () => {
      const result = captureFullPage(context, mainWindow, {
        options: { quality: 1.5 }
      });
      expect(result.error).toContain('Quality must be between 0 and 1');
    });

    test('should capture with scrollback', () => {
      const result = captureWithScrollback(context, mainWindow, {
        options: { scrollSteps: 5 }
      });
      expect(result.success).toBe(true);
      expect(result.type).toBe('scroll-captures');
      expect(result.scrollSteps).toBe(5);
      expect(result.images.length).toBe(5);
    });

    test('should reject invalid scroll steps', () => {
      const result = captureWithScrollback(context, mainWindow, {
        options: { scrollSteps: 0 }
      });
      expect(result.error).toContain('scrollSteps must be between 1 and 20');
    });

    test('should stitch multiple screenshots', () => {
      const result = stitchScreenshots(context, {
        imageFiles: ['img1.png', 'img2.png', 'img3.png']
      });
      expect(result.success).toBe(true);
      expect(result.stitchedId).toBeDefined();
      expect(result.imageCount).toBe(3);
      expect(result.format).toBe('png');
    });

    test('should require at least 2 images for stitching', () => {
      const result = stitchScreenshots(context, {
        imageFiles: ['img1.png']
      });
      expect(result.error).toContain('At least 2 image files');
    });

  });

  // ==========================================
  // SESSION RECORDING & PLAYBACK
  // ==========================================

  describe('Session Recording & Playback', () => {

    let context;
    const mainWindow = {};

    beforeEach(() => {
      context = { sessionRecordings: {} };
    });

    test('should start session recording with default options', () => {
      const result = startSessionRecording(context, {});
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.recordingStarted).toBe(true);
    });

    test('should start session recording with custom name', () => {
      const result = startSessionRecording(context, {
        sessionName: 'my-test-session',
        captureScreenshots: true
      });
      expect(result.success).toBe(true);
      expect(result.sessionName).toBe('my-test-session');
    });

    test('should get session recording data', () => {
      const startResult = startSessionRecording(context, {
        sessionName: 'test-session'
      });
      const sessionId = startResult.sessionId;

      const getResult = getSessionRecording(context, { sessionId });
      expect(getResult.sessionId).toBe(sessionId);
      expect(getResult.name).toBe('test-session');
      expect(getResult.commandCount).toBeDefined();
    });

    test('should reject get for non-existent session', () => {
      const result = getSessionRecording(context, { sessionId: 'invalid' });
      expect(result.error).toContain('not found');
    });

    test('should replay session at normal speed', () => {
      const startResult = startSessionRecording(context, {});
      const sessionId = startResult.sessionId;

      const replayResult = replaySession(context, { sessionId, speed: 1.0 });
      expect(replayResult.success).toBe(true);
      expect(replayResult.replaying).toBe(true);
      expect(replayResult.speed).toBe(1.0);
    });

    test('should replay session at custom speed', () => {
      const startResult = startSessionRecording(context, {});
      const sessionId = startResult.sessionId;

      const replayResult = replaySession(context, { sessionId, speed: 2.0 });
      expect(replayResult.success).toBe(true);
      expect(replayResult.speed).toBe(2.0);
    });

    test('should reject invalid replay speed', () => {
      const startResult = startSessionRecording(context, {});
      const sessionId = startResult.sessionId;

      const result = replaySession(context, { sessionId, speed: 10.0 });
      expect(result.error).toContain('Speed must be between 0.1 and 5');
    });

    test('should compare two sessions', () => {
      const startResult1 = startSessionRecording(context, {});
      const startResult2 = startSessionRecording(context, {});

      const result = compareSessions(context, {
        session1Id: startResult1.sessionId,
        session2Id: startResult2.sessionId,
        compareType: 'all'
      });
      expect(result.success).toBe(true);
      expect(result.differenceCount).toBeGreaterThanOrEqual(0);
    });

    test('should export session recording to JSON', () => {
      const startResult = startSessionRecording(context, {});
      const sessionId = startResult.sessionId;

      const result = exportSessionRecording(context, {
        sessionId,
        format: 'json'
      });
      expect(result.success).toBe(true);
      expect(result.filename).toContain('.json');
    });

    test('should export session recording to HTML', () => {
      const startResult = startSessionRecording(context, {});
      const sessionId = startResult.sessionId;

      const result = exportSessionRecording(context, {
        sessionId,
        format: 'html-replay'
      });
      expect(result.success).toBe(true);
      expect(result.filename).toContain('.html');
    });

    test('should reject invalid export format', () => {
      const startResult = startSessionRecording(context, {});
      const sessionId = startResult.sessionId;

      const result = exportSessionRecording(context, {
        sessionId,
        format: 'xml'
      });
      expect(result.error).toContain('Invalid format');
    });

  });

  // ==========================================
  // ADVANCED DOM QUERIES
  // ==========================================

  describe('Advanced DOM Queries', () => {

    let context;
    const mainWindow = {};

    beforeEach(() => {
      context = {};
    });

    test('should find elements by text', () => {
      const result = findElementsByText(context, mainWindow, {
        text: 'Submit',
        partial: true,
        caseSensitive: false
      });
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.selectors).toBeDefined();
      expect(Array.isArray(result.selectors)).toBe(true);
    });

    test('should reject empty text', () => {
      const result = findElementsByText(context, mainWindow, { text: '' });
      expect(result.error).toBeDefined();
    });

    test('should get element properties', () => {
      const result = getElementProperties(context, mainWindow, {
        selector: '.button',
        properties: ['id', 'class', 'value']
      });
      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
      expect(result.element.id).toBeDefined();
      expect(result.element.class).toBeDefined();
    });

    test('should reject empty selector', () => {
      const result = getElementProperties(context, mainWindow, {
        selector: '',
        properties: ['id']
      });
      expect(result.error).toBeDefined();
    });

    test('should get element state', () => {
      const result = getElementState(context, mainWindow, {
        selector: 'input[name="email"]'
      });
      expect(result.success).toBe(true);
      expect(result.element).toBeDefined();
      expect(result.element.visible).toBeDefined();
      expect(result.element.enabled).toBeDefined();
      expect(result.element.focusable).toBeDefined();
    });

    test('should find clickable elements', () => {
      const result = findClickableElements(context, mainWindow, {
        visibleOnly: true
      });
      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.elements)).toBe(true);
    });

    test('should get form fields', () => {
      const result = getFormFields(context, mainWindow, {
        formSelector: '#login-form'
      });
      expect(result.success).toBe(true);
      expect(result.form).toBeDefined();
      expect(result.form.fields).toBeDefined();
      expect(Array.isArray(result.form.fields)).toBe(true);
      expect(result.form.fieldCount).toBeGreaterThan(0);
    });

    test('should reject empty form selector', () => {
      const result = getFormFields(context, mainWindow, {
        formSelector: ''
      });
      expect(result.error).toBeDefined();
    });

    test('should analyze page structure', () => {
      const result = analyzePageStructure(context, mainWindow, {});
      expect(result.success).toBe(true);
      expect(result.page).toBeDefined();
      expect(result.page.title).toBeDefined();
      expect(result.page.headings).toBeDefined();
      expect(result.page.forms).toBeDefined();
      expect(result.page.images).toBeDefined();
      expect(result.page.links).toBeDefined();
    });

    test('should find text regions', () => {
      const result = findTextRegions(context, mainWindow, {
        minWidth: 100,
        minHeight: 50
      });
      expect(result.success).toBe(true);
      expect(Array.isArray(result.regions)).toBe(true);
      expect(result.regionCount).toBeGreaterThanOrEqual(0);
    });

    test('should evaluate CSS selector', () => {
      const result = evaluateCssSelector(context, mainWindow, {
        selector: '.button'
      });
      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.matches).toBeGreaterThanOrEqual(0);
    });

    test('should query elements by XPath', () => {
      const result = xpathQuery(context, mainWindow, {
        xpath: '//button[contains(text(), "Submit")]'
      });
      expect(result.success).toBe(true);
      expect(result.matches).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.elements)).toBe(true);
    });

    test('should reject empty XPath', () => {
      const result = xpathQuery(context, mainWindow, { xpath: '' });
      expect(result.error).toBeDefined();
    });

  });

  // ==========================================
  // INTEGRATION TESTS
  // ==========================================

  describe('Integration Tests', () => {

    test('should handle multiple concurrent video recordings', () => {
      const context = { videoRecordings: {} };

      const rec1 = startVideoRecording(context, { options: { quality: 'high' } });
      const rec2 = startVideoRecording(context, { options: { quality: 'medium' } });
      const rec3 = startVideoRecording(context, { options: { quality: 'low' } });

      expect(rec1.recordingId).not.toBe(rec2.recordingId);
      expect(rec2.recordingId).not.toBe(rec3.recordingId);

      const status1 = getVideoRecordingStatus(context, { recordingId: rec1.recordingId });
      const status2 = getVideoRecordingStatus(context, { recordingId: rec2.recordingId });

      expect(status1.quality).toBe('high');
      expect(status2.quality).toBe('medium');
    });

    test('should handle multiple session recordings', () => {
      const context = { sessionRecordings: {} };

      const session1 = startSessionRecording(context, { sessionName: 'session-1' });
      const session2 = startSessionRecording(context, { sessionName: 'session-2' });

      expect(session1.sessionId).not.toBe(session2.sessionId);

      const data1 = getSessionRecording(context, { sessionId: session1.sessionId });
      const data2 = getSessionRecording(context, { sessionId: session2.sessionId });

      expect(data1.name).toBe('session-1');
      expect(data2.name).toBe('session-2');
    });

    test('should validate all DOM query parameter requirements', () => {
      const context = {};
      const mainWindow = {};

      const tests = [
        () => findElementsByText(context, mainWindow, { text: '' }),
        () => getElementProperties(context, mainWindow, { selector: '' }),
        () => getElementState(context, mainWindow, { selector: '' }),
        () => getFormFields(context, mainWindow, { formSelector: '' }),
        () => xpathQuery(context, mainWindow, { xpath: '' })
      ];

      tests.forEach(test => {
        const result = test();
        expect(result.error).toBeDefined();
      });
    });

    test('should maintain recording state consistency', () => {
      const context = { videoRecordings: {} };

      const start = startVideoRecording(context, {
        options: { quality: 'high', fps: 30, codec: 'h264' }
      });
      const recordingId = start.recordingId;

      // Verify initial state
      let status = getVideoRecordingStatus(context, { recordingId });
      expect(status.recording).toBe(true);

      // Pause
      pauseVideoRecording(context, { recordingId });
      status = getVideoRecordingStatus(context, { recordingId });
      expect(status.paused).toBe(true);

      // Resume
      resumeVideoRecording(context, { recordingId });
      status = getVideoRecordingStatus(context, { recordingId });
      expect(status.paused).toBe(false);

      // Stop
      const stop = stopVideoRecording(context, { recordingId });
      expect(stop.success).toBe(true);

      status = getVideoRecordingStatus(context, { recordingId });
      expect(status.recording).toBe(false);
    });

  });

});
