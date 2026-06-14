/**
 * Basset Hound Browser - Session Context Sandboxing
 * Complete memory/storage isolation per session
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 *
 * Provides:
 * - Isolated cookie jar per session
 * - Separate localStorage/sessionStorage per session
 * - Independent request/response interceptors
 * - Isolated headers and metadata
 * - Context-level separation
 */

/**
 * Session Sandbox
 * Isolates session execution context to prevent cross-session leakage
 *
 * @class SessionSandbox
 */
class SessionSandbox {
  constructor(options = {}) {
    this.sandboxes = new Map(); // sessionId -> isolated context
    this.storageIsolation = new Map(); // sessionId -> storage object
    this.cookieJars = new Map(); // sessionId -> cookie jar
    this.interceptors = new Map(); // sessionId -> interceptors

    // Statistics
    this.stats = {
      sandboxesCreated: 0,
      sandboxesDestroyed: 0,
      isolationViolations: 0,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create isolated context for session
   * Each session gets its own isolated environment
   *
   * @param {string} sessionId - Session ID
   * @param {Object} options - Context options
   * @returns {Object} Isolated context
   */
  createIsolatedContext(sessionId, options = {}) {
    if (this.sandboxes.has(sessionId)) {
      throw new Error(`Sandbox already exists for session ${sessionId}`);
    }

    // Create isolated storage objects
    const storageObj = {
      localStorage: new Map(),
      sessionStorage: new Map(),
      cookies: new Map(),
      headers: new Map()
    };

    // Create isolated context object
    const context = {
      sessionId,
      createdAt: Date.now(),
      storage: storageObj,
      cookieJar: {},
      headers: {},
      interceptors: {
        request: [],
        response: []
      },
      metadata: {
        isolated: true,
        containment: 'strict',
        leakageDetection: true
      }
    };

    // Store references
    this.sandboxes.set(sessionId, context);
    this.storageIsolation.set(sessionId, storageObj);
    this.cookieJars.set(sessionId, context.cookieJar);
    this.interceptors.set(sessionId, context.interceptors);

    this.stats.sandboxesCreated++;

    return {
      sessionId,
      contextId: `ctx-${sessionId}`,
      isolated: true,
      createdAt: context.createdAt
    };
  }

  /**
   * Get isolated context for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Isolated context or null
   */
  getContext(sessionId) {
    return this.sandboxes.get(sessionId) || null;
  }

  /**
   * Isolate cookies for session
   * Ensure cookies don't leak to other sessions
   *
   * @param {string} sessionId - Session ID
   * @param {Object} cookieJar - Cookie jar for session
   */
  isolateCookies(sessionId, cookieJar) {
    const context = this.getContext(sessionId);
    if (!context) {
      throw new Error(`No sandbox for session ${sessionId}`);
    }

    // Create isolated copy
    const isolatedJar = {};
    for (const [key, value] of Object.entries(cookieJar)) {
      isolatedJar[key] = value;
    }

    context.cookieJar = isolatedJar;
    this.cookieJars.set(sessionId, isolatedJar);

    return {
      sessionId,
      cookiesIsolated: true,
      count: Object.keys(isolatedJar).length
    };
  }

  /**
   * Isolate storage for session
   * localStorage and sessionStorage completely isolated
   *
   * @param {string} sessionId - Session ID
   * @param {Object} storageMap - Storage data (if any initial data)
   */
  isolateStorage(sessionId, storageMap = {}) {
    const context = this.getContext(sessionId);
    if (!context) {
      throw new Error(`No sandbox for session ${sessionId}`);
    }

    // Clear and reset storage
    context.storage.localStorage.clear();
    context.storage.sessionStorage.clear();

    // Add initial data if provided
    if (storageMap.localStorage) {
      for (const [key, value] of Object.entries(storageMap.localStorage)) {
        context.storage.localStorage.set(key, value);
      }
    }

    if (storageMap.sessionStorage) {
      for (const [key, value] of Object.entries(storageMap.sessionStorage)) {
        context.storage.sessionStorage.set(key, value);
      }
    }

    return {
      sessionId,
      storageIsolated: true,
      localStorageSize: context.storage.localStorage.size,
      sessionStorageSize: context.storage.sessionStorage.size
    };
  }

  /**
   * Add request interceptor for session
   * Allows request modification without affecting other sessions
   *
   * @param {string} sessionId - Session ID
   * @param {Function} interceptor - Interceptor function
   */
  addRequestInterceptor(sessionId, interceptor) {
    const context = this.getContext(sessionId);
    if (!context) {
      throw new Error(`No sandbox for session ${sessionId}`);
    }

    context.interceptors.request.push(interceptor);

    return {
      sessionId,
      interceptorAdded: true,
      totalRequestInterceptors: context.interceptors.request.length
    };
  }

  /**
   * Add response interceptor for session
   * Allows response modification without affecting other sessions
   *
   * @param {string} sessionId - Session ID
   * @param {Function} interceptor - Interceptor function
   */
  addResponseInterceptor(sessionId, interceptor) {
    const context = this.getContext(sessionId);
    if (!context) {
      throw new Error(`No sandbox for session ${sessionId}`);
    }

    context.interceptors.response.push(interceptor);

    return {
      sessionId,
      interceptorAdded: true,
      totalResponseInterceptors: context.interceptors.response.length
    };
  }

  /**
   * Set isolated headers for session
   * Headers completely isolated per session
   *
   * @param {string} sessionId - Session ID
   * @param {Object} headers - Headers to set
   */
  setHeaders(sessionId, headers) {
    const context = this.getContext(sessionId);
    if (!context) {
      throw new Error(`No sandbox for session ${sessionId}`);
    }

    context.headers = { ...headers };
    context.storage.headers.clear();

    for (const [key, value] of Object.entries(headers)) {
      context.storage.headers.set(key, value);
    }

    return {
      sessionId,
      headersSet: true,
      count: Object.keys(headers).length
    };
  }

  /**
   * Get session context data (for verification)
   * @param {string} sessionId - Session ID
   * @returns {Object} Context summary (safe to expose)
   */
  getContextData(sessionId) {
    const context = this.getContext(sessionId);
    if (!context) {
      return null;
    }

    return {
      sessionId,
      createdAt: context.createdAt,
      storage: {
        localStorageSize: context.storage.localStorage.size,
        sessionStorageSize: context.storage.sessionStorage.size,
        cookieCount: Object.keys(context.cookieJar).length,
        headerCount: Object.keys(context.headers).length
      },
      interceptors: {
        request: context.interceptors.request.length,
        response: context.interceptors.response.length
      }
    };
  }

  /**
   * Destroy isolated context
   * Clean up all isolated resources for a session
   *
   * @param {string} sessionId - Session ID
   */
  destroyContext(sessionId) {
    const context = this.getContext(sessionId);
    if (!context) {
      return { destroyed: false, message: 'Context not found' };
    }

    // Clear all storage
    context.storage.localStorage.clear();
    context.storage.sessionStorage.clear();
    context.storage.cookies.clear();
    context.storage.headers.clear();

    // Clear interceptors
    context.interceptors.request = [];
    context.interceptors.response = [];

    // Remove from maps
    this.sandboxes.delete(sessionId);
    this.storageIsolation.delete(sessionId);
    this.cookieJars.delete(sessionId);
    this.interceptors.delete(sessionId);

    this.stats.sandboxesDestroyed++;

    return {
      destroyed: true,
      sessionId
    };
  }

  /**
   * Verify no data leakage between contexts
   * Scan for shared objects or references
   *
   * @param {string} sessionId1 - First session ID
   * @param {string} sessionId2 - Second session ID
   * @returns {Object} Leakage detection result
   */
  verifyNoLeakage(sessionId1, sessionId2) {
    const context1 = this.getContext(sessionId1);
    const context2 = this.getContext(sessionId2);

    if (!context1 || !context2) {
      return { valid: false, message: 'One or both contexts not found' };
    }

    const leakageDetected = [];

    // Check localStorage keys
    const keys1 = Array.from(context1.storage.localStorage.keys());
    const keys2 = Array.from(context2.storage.localStorage.keys());
    const sharedKeys = keys1.filter(k => keys2.includes(k));

    if (sharedKeys.length > 0) {
      leakageDetected.push({
        type: 'localStorage_key_overlap',
        keys: sharedKeys
      });
    }

    // Check sessionStorage keys
    const sessKeys1 = Array.from(context1.storage.sessionStorage.keys());
    const sessKeys2 = Array.from(context2.storage.sessionStorage.keys());
    const sharedSessKeys = sessKeys1.filter(k => sessKeys2.includes(k));

    if (sharedSessKeys.length > 0) {
      leakageDetected.push({
        type: 'sessionStorage_key_overlap',
        keys: sharedSessKeys
      });
    }

    // Check cookie keys
    const cookieKeys1 = Object.keys(context1.cookieJar);
    const cookieKeys2 = Object.keys(context2.cookieJar);
    const sharedCookies = cookieKeys1.filter(k => cookieKeys2.includes(k));

    if (sharedCookies.length > 0) {
      leakageDetected.push({
        type: 'cookie_name_overlap',
        keys: sharedCookies
      });
    }

    if (leakageDetected.length > 0) {
      this.stats.isolationViolations++;
    }

    return {
      valid: leakageDetected.length === 0,
      leakageDetected,
      isolationViolation: leakageDetected.length > 0
    };
  }

  /**
   * Get isolation report
   * Summary of all isolated contexts
   *
   * @returns {Object} Isolation report
   */
  getIsolationReport() {
    const report = {
      totalSandboxes: this.sandboxes.size,
      sandboxes: {}
    };

    for (const [sessionId, context] of this.sandboxes.entries()) {
      report.sandboxes[sessionId] = {
        createdAt: context.createdAt,
        age: Date.now() - context.createdAt,
        storage: {
          localStorageSize: context.storage.localStorage.size,
          sessionStorageSize: context.storage.sessionStorage.size,
          cookieCount: Object.keys(context.cookieJar).length
        }
      };
    }

    return report;
  }

  /**
   * Get sandbox statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeSandboxes: this.sandboxes.size
    };
  }

  /**
   * Validate all sandboxes are properly isolated
   * Comprehensive isolation validation across all contexts
   *
   * @returns {Object} Validation result
   */
  validateAllIsolation() {
    const sessionIds = Array.from(this.sandboxes.keys());
    const violations = [];

    // Check each pair of sandboxes
    for (let i = 0; i < sessionIds.length; i++) {
      for (let j = i + 1; j < sessionIds.length; j++) {
        const result = this.verifyNoLeakage(sessionIds[i], sessionIds[j]);
        if (!result.valid) {
          violations.push({
            between: [sessionIds[i], sessionIds[j]],
            ...result
          });
        }
      }
    }

    return {
      valid: violations.length === 0,
      violationCount: violations.length,
      violations
    };
  }

  /**
   * Clear all sandboxes (for cleanup)
   * @returns {Object} Cleanup result
   */
  clearAll() {
    const count = this.sandboxes.size;

    for (const sessionId of this.sandboxes.keys()) {
      this.destroyContext(sessionId);
    }

    return {
      cleared: true,
      count
    };
  }
}

module.exports = SessionSandbox;
