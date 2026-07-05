/**
 * Session Management Service
 * Pure business logic for managing browser sessions
 * Separated from WebSocket/infrastructure concerns
 *
 * Responsibilities:
 * - Session creation and initialization
 * - Session state tracking
 * - Session isolation enforcement
 * - Session cleanup
 * - Session metadata management
 *
 * Dependencies:
 * - (None - pure logic)
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 */

class SessionManagementService {
  /**
   * Create session management service
   * @param {Object} options - Configuration
   * @param {number} options.maxSessions - Maximum concurrent sessions (default: 100)
   * @param {number} options.sessionTimeout - Session idle timeout in ms (default: 30 min)
   */
  constructor(options = {}) {
    this.maxSessions = options.maxSessions || 100;
    this.sessionTimeout = options.sessionTimeout || 30 * 60 * 1000;

    this.sessions = new Map(); // sessionId -> session
    this.metadata = new Map(); // sessionId -> metadata

    this.stats = {
      sessionsCreated: 0,
      sessionsDestroyed: 0,
      sessionTimeouts: 0,
      currentActiveSessions: 0,
      totalSessionTime: 0
    };
  }

  /**
   * Create a new session
   * @param {Object} options - Session options
   * @param {string} options.sessionId - Session ID (generated if not provided)
   * @param {Object} options.profile - Browser profile
   * @param {Object} options.proxy - Proxy configuration
   * @param {Object} options.userAgent - User agent configuration
   * @returns {Object} Session object
   */
  createSession(options = {}) {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum sessions (${this.maxSessions}) reached`);
    }

    const sessionId = options.sessionId || this._generateSessionId();

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const session = {
      id: sessionId,
      state: 'initialized',
      profile: options.profile || null,
      proxy: options.proxy || null,
      userAgent: options.userAgent || null,
      cookies: new Map(),
      localStorage: new Map(),
      sessionStorage: new Map(),
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      tabs: new Set(),
      history: [],
      networkLogs: [],
      consoleLogs: []
    };

    this.sessions.set(sessionId, session);
    this.metadata.set(sessionId, {
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      isActive: true,
      activityCount: 0
    });

    this.stats.sessionsCreated++;
    this.stats.currentActiveSessions = this.sessions.size;

    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session or null
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      const meta = this.metadata.get(sessionId);
      if (meta) {
        meta.lastActivityAt = Date.now();
        meta.activityCount++;
      }
    }
    return session || null;
  }

  /**
   * Destroy a session
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if session was destroyed
   */
  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Calculate session duration
    const duration = Date.now() - session.createdAt;
    this.stats.totalSessionTime += duration;

    this.sessions.delete(sessionId);
    this.metadata.delete(sessionId);

    this.stats.sessionsDestroyed++;
    this.stats.currentActiveSessions = this.sessions.size;

    return true;
  }

  /**
   * Check if session is active
   * @param {string} sessionId - Session ID
   * @returns {boolean}
   */
  isSessionActive(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * Set session state
   * @param {string} sessionId - Session ID
   * @param {string} state - New state ('initialized', 'loading', 'ready', 'idle', 'error')
   */
  setSessionState(sessionId, state) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Get session state
   * @param {string} sessionId - Session ID
   * @returns {string|null}
   */
  getSessionState(sessionId) {
    const session = this.sessions.get(sessionId);
    return session?.state || null;
  }

  /**
   * Add cookie to session
   * @param {string} sessionId - Session ID
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {Object} options - Cookie options
   */
  addCookie(sessionId, name, value, options = {}) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cookies.set(name, {
        value,
        ...options,
        addedAt: Date.now()
      });
    }
  }

  /**
   * Get cookies for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Cookies map
   */
  getCookies(sessionId) {
    const session = this.sessions.get(sessionId);
    return session?.cookies || new Map();
  }

  /**
   * Clear cookies for session
   * @param {string} sessionId - Session ID
   */
  clearCookies(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cookies.clear();
    }
  }

  /**
   * Log network activity
   * @param {string} sessionId - Session ID
   * @param {Object} log - Network log entry
   */
  logNetwork(sessionId, log) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.networkLogs.push({
        ...log,
        timestamp: Date.now()
      });

      // Limit history size
      if (session.networkLogs.length > 1000) {
        session.networkLogs.shift();
      }
    }
  }

  /**
   * Log console output
   * @param {string} sessionId - Session ID
   * @param {string} message - Console message
   * @param {string} level - Log level ('log', 'warn', 'error', etc.)
   */
  logConsole(sessionId, message, level = 'log') {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.consoleLogs.push({
        message,
        level,
        timestamp: Date.now()
      });

      // Limit history size
      if (session.consoleLogs.length > 500) {
        session.consoleLogs.shift();
      }
    }
  }

  /**
   * Add history entry
   * @param {string} sessionId - Session ID
   * @param {Object} entry - History entry
   */
  addHistory(sessionId, entry) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push({
        ...entry,
        timestamp: Date.now()
      });

      // Limit history size
      if (session.history.length > 100) {
        session.history.shift();
      }
    }
  }

  /**
   * Get all active sessions
   * @returns {Object[]}
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up idle sessions
   * @returns {number} Number of sessions cleaned up
   */
  cleanupIdleSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > this.sessionTimeout) {
        this.destroySession(sessionId);
        this.stats.sessionTimeouts++;
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get session metadata
   * @param {string} sessionId - Session ID
   * @returns {Object|null}
   */
  getSessionMetadata(sessionId) {
    return this.metadata.get(sessionId) || null;
  }

  /**
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    const avgSessionTime = this.stats.sessionsDestroyed > 0
      ? (this.stats.totalSessionTime / this.stats.sessionsDestroyed).toFixed(0)
      : 0;

    return {
      ...this.stats,
      averageSessionTimeMs: avgSessionTime,
      currentActiveSessions: this.stats.currentActiveSessions,
      maxSessions: this.maxSessions,
      utilizationPercent: ((this.stats.currentActiveSessions / this.maxSessions) * 100).toFixed(1)
    };
  }

  /**
   * Generate a unique session ID
   * @private
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = SessionManagementService;
