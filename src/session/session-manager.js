/**
 * Basset Hound Browser - Session Manager
 * Manages session lifecycle, profile rotation, and coherence validation
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const crypto = require('crypto');

class SessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.currentSessionId = null;
    this.profileRotationInterval = options.profileRotationInterval || 25; // 10-50 interactions
    this.interactionCount = 0;
    this.sessionHistory = [];
  }

  /**
   * Create new session
   * Uses 16 bytes (128 bits) of entropy for session IDs
   */
  createSession(options = {}) {
    const sessionId = `session-${crypto.randomBytes(16).toString('hex')}`;

    const session = {
      id: sessionId,
      createdAt: Date.now(),
      deviceProfile: options.deviceProfile || null,
      proxyConfig: options.proxyConfig || null,
      behaviorPattern: options.behaviorPattern || 'natural',
      interactionCount: 0,
      lastActivity: Date.now(),
      coherence: {
        ip: true,
        device: true,
        browser: true,
        behavioral: true,
        session: true
      },
      metadata: options.metadata || {}
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.sessionHistory.push({
      sessionId,
      action: 'created',
      timestamp: Date.now()
    });

    return session;
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId);
  }

  /**
   * Record interaction (increments counter for rotation checks)
   */
  recordInteraction() {
    const session = this.getCurrentSession();
    if (!session) return false;

    session.interactionCount++;
    session.lastActivity = Date.now();
    this.interactionCount++;

    return {
      sessionId: this.currentSessionId,
      interactionCount: session.interactionCount,
      shouldRotate: session.interactionCount >= this.profileRotationInterval
    };
  }

  /**
   * Check if profile rotation needed
   */
  shouldRotateProfile() {
    const session = this.getCurrentSession();
    if (!session) return false;
    return session.interactionCount >= this.profileRotationInterval;
  }

  /**
   * Rotate device profile (create new session)
   */
  rotateProfile(newProfile) {
    const oldSessionId = this.currentSessionId;

    // Create new session with new profile
    const newSession = this.createSession({
      deviceProfile: newProfile,
      proxyConfig: this.getCurrentSession()?.proxyConfig
    });

    // Log rotation
    this.sessionHistory.push({
      sessionId: oldSessionId,
      action: 'rotated',
      newSessionId: newSession.id,
      timestamp: Date.now(),
      interactionsCompleted: this.sessions.get(oldSessionId)?.interactionCount
    });

    return newSession;
  }

  /**
   * Validate session coherence across 5 layers
   */
  validateCoherence() {
    const session = this.getCurrentSession();
    if (!session) return null;

    const coherenceReport = {
      sessionId: session.id,
      timestamp: Date.now(),
      layers: {
        ip: this.validateIPCoherence(session),
        device: this.validateDeviceCoherence(session),
        browser: this.validateBrowserCoherence(session),
        session: this.validateSessionCoherence(session),
        behavioral: this.validateBehavioralCoherence(session)
      },
      overallCoherent: true
    };

    // Check if all layers are coherent
    for (const [layer, result] of Object.entries(coherenceReport.layers)) {
      if (!result.coherent) {
        coherenceReport.overallCoherent = false;
      }
    }

    return coherenceReport;
  }

  /**
   * Validate IP layer coherence
   */
  validateIPCoherence(session) {
    return {
      layer: 'ip',
      coherent: !!session.proxyConfig,
      checks: {
        proxyConfigured: !!session.proxyConfig,
        geoConsistent: session.metadata?.geoLocation === session.metadata?.lastGeoLocation
      }
    };
  }

  /**
   * Validate device layer coherence
   */
  validateDeviceCoherence(session) {
    return {
      layer: 'device',
      coherent: !!session.deviceProfile,
      checks: {
        profileSet: !!session.deviceProfile,
        screenResolutionConsistent: session.metadata?.screenResolution === session.metadata?.lastScreenResolution,
        hardwareConcurrencyConsistent: session.metadata?.hardwareConcurrency === session.metadata?.lastHardwareConcurrency
      }
    };
  }

  /**
   * Validate browser layer coherence
   */
  validateBrowserCoherence(session) {
    return {
      layer: 'browser',
      coherent: true,
      checks: {
        userAgentConsistent: session.metadata?.userAgent === session.metadata?.lastUserAgent,
        timezoneConsistent: session.metadata?.timezone === session.metadata?.lastTimezone,
        languageConsistent: session.metadata?.language === session.metadata?.lastLanguage
      }
    };
  }

  /**
   * Validate session layer coherence (cookies, storage)
   */
  validateSessionCoherence(session) {
    return {
      layer: 'session',
      coherent: true,
      checks: {
        cookiesPresent: !!session.metadata?.cookieCount && session.metadata.cookieCount > 0,
        storagePersistent: !!session.metadata?.localStorageSize,
        sessionTimingConsistent: (Date.now() - session.lastActivity) < 300000 // 5 minutes
      }
    };
  }

  /**
   * Validate behavioral layer coherence
   */
  validateBehavioralCoherence(session) {
    return {
      layer: 'behavioral',
      coherent: session.interactionCount > 0,
      checks: {
        mousePatternConsistent: session.metadata?.mousePattern === session.metadata?.lastMousePattern,
        typingSpeedConsistent: Math.abs((session.metadata?.wpm || 0) - (session.metadata?.lastWPM || 0)) < 20,
        interactionSequenceNatural: session.interactionCount > 0
      }
    };
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId = null) {
    const sid = sessionId || this.currentSessionId;
    if (!sid) return null;

    const session = this.sessions.get(sid);
    if (!session) return null;

    return {
      sessionId: sid,
      active: sid === this.currentSessionId,
      duration: Date.now() - session.createdAt,
      interactions: session.interactionCount,
      deviceProfile: session.deviceProfile,
      lastActivity: Date.now() - session.lastActivity,
      coherent: this.validateCoherence()?.overallCoherent
    };
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      sessions.push({
        id,
        duration: Date.now() - session.createdAt,
        interactions: session.interactionCount,
        active: id === this.currentSessionId
      });
    }
    return sessions;
  }

  /**
   * End session
   */
  endSession(sessionId = null) {
    const sid = sessionId || this.currentSessionId;
    if (!sid) return false;

    this.sessionHistory.push({
      sessionId: sid,
      action: 'ended',
      timestamp: Date.now(),
      totalInteractions: this.sessions.get(sid)?.interactionCount
    });

    this.sessions.delete(sid);

    if (sid === this.currentSessionId) {
      this.currentSessionId = null;
    }

    return true;
  }

  /**
   * Get session history
   */
  getSessionHistory(limit = 20) {
    return this.sessionHistory.slice(-limit);
  }

  /**
   * Get manager status
   */
  getStatus() {
    return {
      currentSessionId: this.currentSessionId,
      totalSessionsCreated: this.sessionHistory.length,
      activeSessions: this.sessions.size,
      totalInteractions: this.interactionCount,
      profileRotationInterval: this.profileRotationInterval,
      currentSession: this.getSessionSummary()
    };
  }
}

module.exports = SessionManager;
