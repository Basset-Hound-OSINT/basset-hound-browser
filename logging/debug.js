/**
 * Basset Hound Browser - Debug Utilities
 * Provides debugging tools for IPC, WebSocket, and state inspection
 */

const { EventEmitter } = require('events');

/**
 * Debug mode constants
 */
const DEBUG_MODES = {
  OFF: 'off',
  BASIC: 'basic',
  VERBOSE: 'verbose',
  TRACE: 'trace'
};

/**
 * DebugManager class - Central debugging utilities
 */
class DebugManager extends EventEmitter {
  /**
   * Create a new DebugManager
   * @param {Object} options - Debug options
   */
  constructor(options = {}) {
    super();

    this.name = options.name || 'debug-manager';
    this.mode = options.mode || DEBUG_MODES.OFF;
    this.enabled = options.enabled !== false;

    // Logger integration
    this.logger = options.logger || null;

    // Tracing state
    this.ipcTracing = false;
    this.wsTracing = false;
    this.eventTracing = false;

    // Trace buffers (circular buffers)
    this.ipcBuffer = [];
    this.wsBuffer = [];
    this.eventBuffer = [];
    this.maxBufferSize = options.maxBufferSize || 500;

    // References to managers (set externally)
    this.wsServer = null;
    this.mainWindow = null;
    this.tabManager = null;
    this.sessionManager = null;

    // IPC interception
    this.ipcMain = null;
    this.originalIpcOn = null;
    this.originalIpcHandle = null;

    // Statistics
    this.stats = {
      ipcMessages: 0,
      wsCommands: 0,
      wsResponses: 0,
      events: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Set logger for output
   * @param {Logger} logger - Logger instance
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Set references to browser components
   * @param {Object} refs - Component references
   */
  setReferences(refs = {}) {
    if (refs.wsServer) this.wsServer = refs.wsServer;
    if (refs.mainWindow) this.mainWindow = refs.mainWindow;
    if (refs.tabManager) this.tabManager = refs.tabManager;
    if (refs.sessionManager) this.sessionManager = refs.sessionManager;
    if (refs.ipcMain) this.ipcMain = refs.ipcMain;
  }

  /**
   * Enable debug mode
   * @param {string} mode - Debug mode level
   */
  enableDebugMode(mode = DEBUG_MODES.VERBOSE) {
    this.mode = mode;
    this.enabled = true;

    if (this.logger) {
      this.logger.info('Debug mode enabled', { mode });
    }

    // Enable verbose logging if mode is verbose or higher
    if (mode === DEBUG_MODES.VERBOSE || mode === DEBUG_MODES.TRACE) {
      if (this.logger) {
        this.logger.setLevel('debug');
      }
    }

    // Enable all tracing in trace mode
    if (mode === DEBUG_MODES.TRACE) {
      this.traceIPC();
      this.traceWebSocket();
      this.traceEvents();
    }

    return { success: true, mode };
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    this.mode = DEBUG_MODES.OFF;
    this.stopTraceIPC();
    this.stopTraceWebSocket();
    this.stopTraceEvents();

    if (this.logger) {
      this.logger.info('Debug mode disabled');
      this.logger.setLevel('info');
    }

    return { success: true };
  }

  /**
   * Get current debug mode
   * @returns {string}
   */
  getDebugMode() {
    return this.mode;
  }

  /**
   * Check if in debug mode
   * @returns {boolean}
   */
  isDebugMode() {
    return this.mode !== DEBUG_MODES.OFF && this.enabled;
  }

  // ==================== IPC Tracing ====================

  /**
   * Start tracing IPC messages
   * @returns {Object} Result
   */
  traceIPC() {
    if (this.ipcTracing) {
      return { success: false, error: 'IPC tracing already enabled' };
    }

    this.ipcTracing = true;

    if (this.logger) {
      this.logger.info('IPC tracing enabled');
    }

    return { success: true };
  }

  /**
   * Stop tracing IPC messages
   * @returns {Object} Result
   */
  stopTraceIPC() {
    if (!this.ipcTracing) {
      return { success: false, error: 'IPC tracing not enabled' };
    }

    this.ipcTracing = false;

    if (this.logger) {
      this.logger.info('IPC tracing disabled');
    }

    return { success: true };
  }

  /**
   * Log an IPC message (call this from IPC handlers)
   * @param {string} channel - IPC channel name
   * @param {string} direction - 'in' or 'out'
   * @param {*} data - Message data
   */
  logIPC(channel, direction, data) {
    if (!this.ipcTracing) return;

    const entry = {
      timestamp: Date.now(),
      channel,
      direction,
      data: this._safeSerialize(data)
    };

    this.ipcBuffer.push(entry);
    if (this.ipcBuffer.length > this.maxBufferSize) {
      this.ipcBuffer.shift();
    }

    this.stats.ipcMessages++;

    if (this.logger) {
      this.logger.trace(`IPC ${direction}: ${channel}`, { data: entry.data });
    }

    this.emit('ipc', entry);
  }

  /**
   * Get IPC trace buffer
   * @param {Object} filter - Optional filter
   * @returns {Array}
   */
  getIPCTrace(filter = {}) {
    let results = [...this.ipcBuffer];

    if (filter.channel) {
      results = results.filter(e => e.channel === filter.channel);
    }

    if (filter.direction) {
      results = results.filter(e => e.direction === filter.direction);
    }

    if (filter.since) {
      const since = new Date(filter.since).getTime();
      results = results.filter(e => e.timestamp >= since);
    }

    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  // ==================== WebSocket Tracing ====================

  /**
   * Start tracing WebSocket commands
   * @returns {Object} Result
   */
  traceWebSocket() {
    if (this.wsTracing) {
      return { success: false, error: 'WebSocket tracing already enabled' };
    }

    this.wsTracing = true;

    if (this.logger) {
      this.logger.info('WebSocket tracing enabled');
    }

    return { success: true };
  }

  /**
   * Stop tracing WebSocket commands
   * @returns {Object} Result
   */
  stopTraceWebSocket() {
    if (!this.wsTracing) {
      return { success: false, error: 'WebSocket tracing not enabled' };
    }

    this.wsTracing = false;

    if (this.logger) {
      this.logger.info('WebSocket tracing disabled');
    }

    return { success: true };
  }

  /**
   * Log a WebSocket command (call this from WS server)
   * @param {string} type - 'command' or 'response'
   * @param {Object} data - Command/response data
   * @param {string} clientId - Client identifier
   */
  logWebSocket(type, data, clientId = null) {
    if (!this.wsTracing) return;

    const entry = {
      timestamp: Date.now(),
      type,
      clientId,
      command: data.command,
      id: data.id,
      data: this._safeSerialize(data)
    };

    this.wsBuffer.push(entry);
    if (this.wsBuffer.length > this.maxBufferSize) {
      this.wsBuffer.shift();
    }

    if (type === 'command') {
      this.stats.wsCommands++;
    } else {
      this.stats.wsResponses++;
    }

    if (this.logger) {
      const logData = { command: data.command, id: data.id, clientId };
      if (type === 'response' && data.success !== undefined) {
        logData.success = data.success;
      }
      this.logger.trace(`WS ${type}: ${data.command}`, logData);
    }

    this.emit('websocket', entry);
  }

  /**
   * Get WebSocket trace buffer
   * @param {Object} filter - Optional filter
   * @returns {Array}
   */
  getWebSocketTrace(filter = {}) {
    let results = [...this.wsBuffer];

    if (filter.command) {
      results = results.filter(e => e.command === filter.command);
    }

    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }

    if (filter.clientId) {
      results = results.filter(e => e.clientId === filter.clientId);
    }

    if (filter.since) {
      const since = new Date(filter.since).getTime();
      results = results.filter(e => e.timestamp >= since);
    }

    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  // ==================== Event Tracing ====================

  /**
   * Start tracing events
   * @returns {Object} Result
   */
  traceEvents() {
    if (this.eventTracing) {
      return { success: false, error: 'Event tracing already enabled' };
    }

    this.eventTracing = true;

    if (this.logger) {
      this.logger.info('Event tracing enabled');
    }

    return { success: true };
  }

  /**
   * Stop tracing events
   * @returns {Object} Result
   */
  stopTraceEvents() {
    if (!this.eventTracing) {
      return { success: false, error: 'Event tracing not enabled' };
    }

    this.eventTracing = false;

    if (this.logger) {
      this.logger.info('Event tracing disabled');
    }

    return { success: true };
  }

  /**
   * Log an event
   * @param {string} source - Event source
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  logEvent(source, event, data) {
    if (!this.eventTracing) return;

    const entry = {
      timestamp: Date.now(),
      source,
      event,
      data: this._safeSerialize(data)
    };

    this.eventBuffer.push(entry);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }

    this.stats.events++;

    if (this.logger) {
      this.logger.trace(`Event: ${source}:${event}`, { data: entry.data });
    }

    this.emit('event', entry);
  }

  /**
   * Get event trace buffer
   * @param {Object} filter - Optional filter
   * @returns {Array}
   */
  getEventTrace(filter = {}) {
    let results = [...this.eventBuffer];

    if (filter.source) {
      results = results.filter(e => e.source === filter.source);
    }

    if (filter.event) {
      results = results.filter(e => e.event === filter.event);
    }

    if (filter.since) {
      const since = new Date(filter.since).getTime();
      results = results.filter(e => e.timestamp >= since);
    }

    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  // ==================== State Dumping ====================

  /**
   * Dump current browser state
   * @returns {Object} Browser state snapshot
   */
  dumpState() {
    const state = {
      timestamp: Date.now(),
      debugMode: this.mode,
      tracing: {
        ipc: this.ipcTracing,
        websocket: this.wsTracing,
        events: this.eventTracing
      }
    };

    // WebSocket server state
    if (this.wsServer) {
      state.websocket = {
        clients: this.wsServer.clients ? this.wsServer.clients.size : 0,
        port: this.wsServer.port,
        sslActive: this.wsServer.sslActive,
        authRequired: this.wsServer.requireAuth
      };
    }

    // Tab manager state
    if (this.tabManager) {
      const tabs = this.tabManager.listTabs();
      state.tabs = {
        count: tabs.count,
        activeTabId: tabs.activeTabId,
        tabs: tabs.tabs
      };
    }

    // Session manager state
    if (this.sessionManager) {
      const sessions = this.sessionManager.listSessions();
      state.sessions = {
        count: sessions.count,
        activeSessionId: sessions.activeSessionId,
        sessions: sessions.sessions.map(s => ({
          id: s.id,
          name: s.name,
          tabCount: s.tabCount,
          createdAt: s.createdAt
        }))
      };
    }

    // Memory state
    const memUsage = process.memoryUsage();
    state.memory = {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      externalMB: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };

    // Process info
    state.process = {
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    // Debug statistics
    state.stats = { ...this.stats };
    state.stats.uptime = Date.now() - this.stats.startTime;

    if (this.logger) {
      this.logger.debug('State dump generated');
    }

    return state;
  }

  /**
   * Dump state to log
   */
  logState() {
    const state = this.dumpState();

    if (this.logger) {
      this.logger.info('=== Browser State Dump ===');
      this.logger.info('WebSocket:', state.websocket);
      this.logger.info('Tabs:', state.tabs);
      this.logger.info('Sessions:', state.sessions);
      this.logger.info('Memory:', state.memory);
      this.logger.info('Process:', state.process);
      this.logger.info('Debug Stats:', state.stats);
      this.logger.info('=== End State Dump ===');
    }

    return state;
  }

  // ==================== Utility Methods ====================

  /**
   * Safely serialize data for logging (handles circular refs, etc)
   * @param {*} data - Data to serialize
   * @returns {*} Serializable data
   * @private
   */
  _safeSerialize(data) {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    try {
      // Try JSON stringify to detect circular refs
      const str = JSON.stringify(data, (key, value) => {
        // Skip functions
        if (typeof value === 'function') return '[Function]';
        // Skip Buffer/ArrayBuffer
        if (value instanceof Buffer) return '[Buffer]';
        if (value instanceof ArrayBuffer) return '[ArrayBuffer]';
        // Truncate long strings
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '...[truncated]';
        }
        return value;
      });
      return JSON.parse(str);
    } catch (e) {
      // Circular reference or other issue
      return { _serialized: false, type: typeof data, message: e.message };
    }
  }

  /**
   * Log an error with debug context
   * @param {Error|string} error - Error to log
   * @param {Object} context - Additional context
   */
  logError(error, context = {}) {
    this.stats.errors++;

    const entry = {
      timestamp: Date.now(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : { message: String(error) },
      context
    };

    if (this.logger) {
      this.logger.error(error instanceof Error ? error.message : error, {
        error,
        ...context
      });
    }

    this.emit('log-error', entry);
  }

  /**
   * Get debug statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      mode: this.mode,
      tracing: {
        ipc: this.ipcTracing,
        websocket: this.wsTracing,
        events: this.eventTracing
      },
      buffers: {
        ipc: this.ipcBuffer.length,
        websocket: this.wsBuffer.length,
        events: this.eventBuffer.length
      }
    };
  }

  /**
   * Clear all trace buffers
   */
  clearBuffers() {
    this.ipcBuffer = [];
    this.wsBuffer = [];
    this.eventBuffer = [];

    if (this.logger) {
      this.logger.debug('Trace buffers cleared');
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      ipcMessages: 0,
      wsCommands: 0,
      wsResponses: 0,
      events: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Clean up
   */
  cleanup() {
    this.disableDebugMode();
    this.clearBuffers();
    this.resetStats();
    this.removeAllListeners();
  }
}

// Create default instance
const defaultDebugManager = new DebugManager();

module.exports = {
  DebugManager,
  DEBUG_MODES,
  defaultDebugManager
};
