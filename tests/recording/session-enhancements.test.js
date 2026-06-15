/**
 * Basset Hound Browser - Session Recording Enhancements Tests
 *
 * Tests for:
 * - Video Quality Improvements (Task 2.2.1)
 * - Session Playback Implementation (Task 2.2.2)
 * - Event Log Extraction (Task 2.2.3)
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const {
  VideoEncoder,
  QUALITY_PROFILES,
  BITRATE_PROFILES
} = require('../../src/recording/video-encoder');

const {
  SessionPlayback,
  PlaybackSession,
  PLAYBACK_SPEEDS
} = require('../../src/recording/session-playback');

const {
  EventLogger,
  EventLoggingSession,
  EVENT_TYPES,
  EVENT_SEVERITY
} = require('../../src/recording/event-logger');

describe('Task 2.2: Session Recording Enhancements', () => {
  // ===== Task 2.2.1: Video Quality Improvements =====
  describe('Task 2.2.1: Video Quality Improvements', () => {
    let encoder;

    beforeEach(() => {
      encoder = new VideoEncoder({
        codec: 'vp9',
        fps: 30,
        outputDir: '/tmp/test-videos'
      });
    });

    test('should support quality level profiles', () => {
      const profiles = encoder.getQualityProfiles();
      expect(profiles).toHaveProperty('low');
      expect(profiles).toHaveProperty('medium');
      expect(profiles).toHaveProperty('high');
      expect(profiles).toHaveProperty('ultra');
    });

    test('should apply low quality profile', () => {
      const profile = encoder.getQualityProfiles().low;
      expect(profile.vp9).toHaveProperty('crf');
      expect(profile.vp9.crf).toBeGreaterThan(40); // Lower quality = higher CRF
    });

    test('should apply high quality profile', () => {
      const profile = encoder.getQualityProfiles().high;
      expect(profile.vp9).toHaveProperty('crf');
      expect(profile.vp9.crf).toBeLessThan(30); // Higher quality = lower CRF
    });

    test('should create session with quality level', () => {
      const session = encoder.createSession('test-session', {}, 'high');
      expect(session).toBeDefined();
      expect(session.options.qualityLevel).toBe('high');
      expect(session.options.qualitySettings).toBeDefined();
    });

    test('should support bitrate optimization', () => {
      const optimizedBitrate = encoder.calculateOptimizedBitrate('high', 'vp9', 'high_quality');
      expect(optimizedBitrate).toBeDefined();
      expect(optimizedBitrate).toMatch(/^[\d.]+[kM]$/);
    });

    test('should apply bandwidth-constrained profile', () => {
      const optimized = encoder.calculateOptimizedBitrate('medium', 'h264', 'bandwidth_constrained');
      const standard = encoder.calculateOptimizedBitrate('medium', 'h264', 'standard');

      // Parse and compare bitrates
      const optimizedValue = parseFloat(optimized);
      const standardValue = parseFloat(standard);
      expect(optimizedValue).toBeLessThan(standardValue);
    });

    test('should list quality profiles', () => {
      const profiles = encoder.getQualityProfiles();
      expect(Object.keys(profiles).length).toBeGreaterThanOrEqual(4);
    });

    test('should list bitrate profiles', () => {
      const profiles = encoder.getBitrateProfiles();
      expect(profiles).toHaveProperty('bandwidth_constrained');
      expect(profiles).toHaveProperty('standard');
      expect(profiles).toHaveProperty('high_quality');
    });
  });

  // ===== Task 2.2.2: Session Playback Implementation =====
  describe('Task 2.2.2: Session Playback Implementation', () => {
    let playbackManager;
    let mockSessionData;

    beforeEach(() => {
      playbackManager = new SessionPlayback({ defaultSpeed: 1.0 });

      // Create mock session data
      mockSessionData = {
        frames: [
          { timestamp: 0, data: 'frame1.png' },
          { timestamp: 33, data: 'frame2.png' },
          { timestamp: 66, data: 'frame3.png' },
          { timestamp: 99, data: 'frame4.png' },
          { timestamp: 132, data: 'frame5.png' }
        ],
        metadata: { title: 'Test Session' }
      };
    });

    test('should create playback session', () => {
      const playbackSession = playbackManager.createPlaybackSession('session-1', mockSessionData);
      expect(playbackSession).toBeDefined();
      expect(playbackSession.sessionId).toBe('session-1');
    });

    test('should validate session data structure', () => {
      const invalidData = { frames: null };
      expect(() => {
        playbackManager.createPlaybackSession('session-invalid', invalidData);
      }).toThrow();
    });

    test('should support play/pause/resume', (done) => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);

      session.play();
      expect(session.state).toBe('playing');

      // Use immediate check to avoid timing issues
      setImmediate(() => {
        session.pause();
        expect(session.state).toBe('paused');

        session.resume();
        expect(session.state).toBe('playing');

        // Stop after resume
        session.stop();
        expect(session.state).toBe('stopped');
        done();
      });
    }, 1000);

    test('should seek to timestamp', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);

      // Seek to a value within the duration
      const seekValue = Math.min(50, session.duration);
      session.seek(seekValue);
      expect(session.currentTime).toBeCloseTo(seekValue, 0);
    });

    test('should seek by percentage', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);
      const duration = session.duration;

      session.seekByPercentage(0.5);
      expect(session.currentTime).toBeCloseTo(duration * 0.5, 0);
    });

    test('should support frame navigation', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);

      const initialIndex = session.currentFrameIndex;
      session.nextFrame();
      expect(session.currentFrameIndex).toBe(initialIndex + 1);

      session.previousFrame();
      expect(session.currentFrameIndex).toBe(initialIndex);
    });

    test('should set playback speed', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);

      session.setSpeed(2.0);
      expect(session.speed).toBe(2.0);
    });

    test('should support all playback speeds', () => {
      const speeds = Object.keys(PLAYBACK_SPEEDS);
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);

      for (const speed of speeds) {
        expect(() => {
          session.setSpeed(parseFloat(speed));
        }).not.toThrow();
      }
    });

    test('should reject invalid speed', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);

      expect(() => {
        session.setSpeed(3.5);
      }).toThrow();
    });

    test('should get playback state', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);
      const state = session.getState();

      expect(state).toHaveProperty('sessionId');
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('currentFrameIndex');
      expect(state).toHaveProperty('totalFrames');
      expect(state).toHaveProperty('duration');
      expect(state).toHaveProperty('speed');
    });

    test('should export playback state', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);
      const exported = session.exportState();

      expect(exported).toHaveProperty('sessionId', 'session-1');
      expect(exported).toHaveProperty('metadata');
    });

    test('should list playback sessions', () => {
      playbackManager.createPlaybackSession('session-1', mockSessionData);
      playbackManager.createPlaybackSession('session-2', mockSessionData);

      const sessions = playbackManager.listPlaybackSessions();
      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
      expect(sessions.length).toBe(2);
    });

    test('should get available playback speeds', () => {
      const speeds = playbackManager.getAvailableSpeeds();
      expect(Object.keys(speeds)).toContain('0.5');
      expect(Object.keys(speeds)).toContain('1');
      expect(Object.keys(speeds)).toContain('2');
      expect(Object.keys(speeds)).toContain('4');
    });

    test('should restart playback', () => {
      const session = playbackManager.createPlaybackSession('session-1', mockSessionData);
      session.currentFrameIndex = 3;

      session.restart();
      expect(session.currentFrameIndex).toBe(0);
      expect(session.state).toBe('playing');
    });
  });

  // ===== Task 2.2.3: Event Log Extraction =====
  describe('Task 2.2.3: Event Log Extraction', () => {
    let eventLogger;

    beforeEach(() => {
      eventLogger = new EventLogger({
        enableAutoCapture: true,
        maxEvents: 1000
      });
    });

    test('should create event logging session', () => {
      const session = eventLogger.createSession('log-session-1');
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('log-session-1');
    });

    test('should log click events', () => {
      const session = eventLogger.createSession('log-session-1');

      const event = session.logEvent({
        type: EVENT_TYPES.CLICK,
        x: 100,
        y: 200,
        targetId: 'button-1'
      });

      expect(event.type).toBe(EVENT_TYPES.CLICK);
      expect(event.x).toBe(100);
      expect(event.y).toBe(200);
    });

    test('should log typing events', () => {
      const session = eventLogger.createSession('log-session-1');

      const event = session.logEvent({
        type: EVENT_TYPES.TYPING,
        text: 'Hello',
        targetId: 'input-1'
      });

      expect(event.type).toBe(EVENT_TYPES.TYPING);
      expect(event.text).toBe('Hello');
      expect(event.textLength).toBe(5);
    });

    test('should log navigation events', () => {
      const session = eventLogger.createSession('log-session-1');

      const event = session.logEvent({
        type: EVENT_TYPES.NAVIGATION,
        url: 'https://example.com'
      });

      expect(event.type).toBe(EVENT_TYPES.NAVIGATION);
      expect(event.url).toBe('https://example.com');
    });

    test('should get events by type', () => {
      const session = eventLogger.createSession('log-session-1');

      session.logEvent({ type: EVENT_TYPES.CLICK });
      session.logEvent({ type: EVENT_TYPES.CLICK });
      session.logEvent({ type: EVENT_TYPES.TYPING, text: 'test' });

      const clicks = session.getEventsByType(EVENT_TYPES.CLICK);
      expect(clicks.length).toBe(2);
    });

    test('should get events by time range', () => {
      const session = eventLogger.createSession('log-session-1');
      const startTime = Date.now();

      session.logEvent({ type: EVENT_TYPES.CLICK, timestamp: startTime });
      session.logEvent({ type: EVENT_TYPES.CLICK, timestamp: startTime + 100 });
      session.logEvent({ type: EVENT_TYPES.CLICK, timestamp: startTime + 2000 });

      const rangeEvents = session.getEventsByTimeRange(startTime, startTime + 500);
      expect(rangeEvents.length).toBe(2);
    });

    test('should get events by target', () => {
      const session = eventLogger.createSession('log-session-1');

      session.logEvent({ type: EVENT_TYPES.CLICK, targetId: 'element-1' });
      session.logEvent({ type: EVENT_TYPES.CLICK, targetId: 'element-1' });
      session.logEvent({ type: EVENT_TYPES.CLICK, targetId: 'element-2' });

      const targetEvents = session.getEventsByTarget('element-1');
      expect(targetEvents.length).toBe(2);
    });

    test('should get event timeline', () => {
      const session = eventLogger.createSession('log-session-1');

      session.logEvent({ type: EVENT_TYPES.CLICK });
      session.logEvent({ type: EVENT_TYPES.TYPING, text: 'test' });
      session.logEvent({ type: EVENT_TYPES.NAVIGATION });

      const timeline = session.getTimeline();
      expect(timeline.totalEvents).toBe(3);
      expect(timeline.eventTypes[EVENT_TYPES.CLICK]).toBe(1);
      expect(timeline.eventTypes[EVENT_TYPES.TYPING]).toBe(1);
    });

    test('should get events by severity', () => {
      const session = eventLogger.createSession('log-session-1');

      session.logEvent({
        type: EVENT_TYPES.CLICK,
        severity: EVENT_SEVERITY.CRITICAL
      });
      session.logEvent({
        type: EVENT_TYPES.CLICK,
        severity: EVENT_SEVERITY.LOW
      });

      const bySeverity = session.getEventsBySeverity();
      expect(bySeverity[0].severity).toBe(EVENT_SEVERITY.CRITICAL);
      expect(bySeverity[1].severity).toBe(EVENT_SEVERITY.LOW);
    });

    test('should export events as JSON', () => {
      const session = eventLogger.createSession('log-session-1');
      session.logEvent({ type: EVENT_TYPES.CLICK });
      session.logEvent({ type: EVENT_TYPES.TYPING, text: 'test' });

      const exported = session.exportEvents();
      expect(exported.sessionId).toBe('log-session-1');
      expect(exported.totalEvents).toBe(2);
      expect(exported.events).toHaveLength(2);
    });

    test('should import events from JSON', () => {
      const session = eventLogger.createSession('log-session-1');

      const importData = [
        { type: EVENT_TYPES.CLICK, x: 100, y: 200 },
        { type: EVENT_TYPES.TYPING, text: 'hello' }
      ];

      session.importEvents(importData);
      expect(session.getEvents().length).toBe(2);
    });

    test('should get event statistics', () => {
      const session = eventLogger.createSession('log-session-1');

      session.logEvent({ type: EVENT_TYPES.CLICK });
      session.logEvent({ type: EVENT_TYPES.CLICK });
      session.logEvent({ type: EVENT_TYPES.TYPING, text: 'test' });
      session.logEvent({ type: EVENT_TYPES.NAVIGATION });

      const stats = session.getStatistics();
      expect(stats.totalEvents).toBe(4);
      expect(stats.clickCount).toBe(2);
      expect(stats.typeCount).toBe(1);
      expect(stats.navigationCount).toBe(1);
    });

    test('should end session', () => {
      const session = eventLogger.createSession('log-session-1');
      session.logEvent({ type: EVENT_TYPES.CLICK });

      const summary = session.endSession();
      expect(summary.sessionId).toBe('log-session-1');
      expect(summary.totalEvents).toBe(1);
      expect(session.isActive).toBe(false);
    });

    test('should reject events after session ends', () => {
      const session = eventLogger.createSession('log-session-1');
      session.endSession();

      expect(() => {
        session.logEvent({ type: EVENT_TYPES.CLICK });
      }).toThrow();
    });

    test('should list all event types', () => {
      const types = EventLogger.getEventTypes();
      expect(types).toHaveProperty('CLICK');
      expect(types).toHaveProperty('TYPING');
      expect(types).toHaveProperty('NAVIGATION');
      expect(types).toHaveProperty('SCROLL');
    });

    test('should list all event severities', () => {
      const severities = EventLogger.getEventSeverities();
      expect(severities).toHaveProperty('LOW');
      expect(severities).toHaveProperty('MEDIUM');
      expect(severities).toHaveProperty('HIGH');
      expect(severities).toHaveProperty('CRITICAL');
    });

    test('should respect max events limit', () => {
      const limitedLogger = new EventLogger({ maxEvents: 5 });
      const session = limitedLogger.createSession('limited-session');

      for (let i = 0; i < 10; i++) {
        session.logEvent({ type: EVENT_TYPES.CLICK });
      }

      expect(session.getEvents().length).toBeLessThanOrEqual(5);
    });
  });
});
