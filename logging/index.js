/**
 * Basset Hound Browser - Logging Module
 * Central export for all logging, debugging, and profiling utilities
 */

// Logger
const {
  Logger,
  LOG_LEVELS,
  LEVEL_NAMES,
  createLogger,
  defaultLogger
} = require('./logger');

// Formatters
const {
  BaseFormatter,
  JSONFormatter,
  TextFormatter,
  ColorFormatter,
  COLORS,
  createFormatter
} = require('./formatter');

// Transports
const {
  BaseTransport,
  ConsoleTransport,
  FileTransport,
  WebSocketTransport,
  MemoryTransport,
  createTransport
} = require('./transports');

// Profiler
const {
  Profiler,
  Timer,
  Metric,
  METRIC_TYPES,
  defaultProfiler
} = require('./profiler');

// Memory Monitor
const {
  MemoryMonitor,
  MEMORY_STATUS,
  DEFAULT_THRESHOLDS,
  defaultMemoryMonitor
} = require('./memory');

// Debug Manager
const {
  DebugManager,
  DEBUG_MODES,
  defaultDebugManager
} = require('./debug');

/**
 * Create a fully configured logging system
 * @param {Object} options - Configuration options
 * @returns {Object} Configured logging system
 */
function createLoggingSystem(options = {}) {
  const name = options.name || 'basset';
  const level = options.level || process.env.LOG_LEVEL || 'info';

  // Create main logger
  const logger = createLogger({
    name,
    level,
    console: options.console !== false,
    color: options.color !== false,
    file: options.file,
    memory: options.memory
  });

  // Create profiler
  const profiler = new Profiler({
    name: `${name}-profiler`,
    logger: options.profileLogging ? logger.child('profiler') : null,
    enabled: options.profiling !== false
  });

  // Create memory monitor
  const memoryMonitor = new MemoryMonitor({
    name: `${name}-memory`,
    logger: options.memoryLogging ? logger.child('memory') : null,
    enabled: options.memoryMonitoring !== false,
    interval: options.memoryInterval,
    thresholds: options.memoryThresholds
  });

  // Create debug manager
  const debugManager = new DebugManager({
    name: `${name}-debug`,
    logger: logger.child('debug'),
    enabled: options.debug !== false
  });

  return {
    logger,
    profiler,
    memoryMonitor,
    debugManager,

    // Convenience methods
    setLevel: (newLevel) => {
      logger.setLevel(newLevel);
    },

    enableDebug: () => {
      debugManager.enableDebugMode(DEBUG_MODES.VERBOSE);
      logger.setLevel('debug');
    },

    disableDebug: () => {
      debugManager.disableDebugMode();
      logger.setLevel('info');
    },

    startProfiling: () => {
      profiler.enable();
    },

    stopProfiling: () => {
      profiler.disable();
      return profiler.getSummary();
    },

    startMemoryMonitoring: (interval) => {
      return memoryMonitor.startMonitoring(interval);
    },

    stopMemoryMonitoring: () => {
      return memoryMonitor.stopMonitoring();
    },

    getStats: () => ({
      logger: logger.getStats(),
      profiler: profiler.getStats(),
      memory: memoryMonitor.getStats(),
      debug: debugManager.getStats()
    }),

    cleanup: () => {
      logger.close();
      profiler.cleanup();
      memoryMonitor.cleanup();
      debugManager.cleanup();
    }
  };
}

/**
 * Global logging system instance
 */
let globalLoggingSystem = null;

/**
 * Initialize global logging system
 * @param {Object} options - Configuration options
 * @returns {Object} Logging system
 */
function initializeLogging(options = {}) {
  if (globalLoggingSystem) {
    globalLoggingSystem.cleanup();
  }

  globalLoggingSystem = createLoggingSystem(options);
  return globalLoggingSystem;
}

/**
 * Get global logging system
 * @returns {Object|null}
 */
function getLoggingSystem() {
  return globalLoggingSystem;
}

module.exports = {
  // Logger exports
  Logger,
  LOG_LEVELS,
  LEVEL_NAMES,
  createLogger,
  defaultLogger,

  // Formatter exports
  BaseFormatter,
  JSONFormatter,
  TextFormatter,
  ColorFormatter,
  COLORS,
  createFormatter,

  // Transport exports
  BaseTransport,
  ConsoleTransport,
  FileTransport,
  WebSocketTransport,
  MemoryTransport,
  createTransport,

  // Profiler exports
  Profiler,
  Timer,
  Metric,
  METRIC_TYPES,
  defaultProfiler,

  // Memory monitor exports
  MemoryMonitor,
  MEMORY_STATUS,
  DEFAULT_THRESHOLDS,
  defaultMemoryMonitor,

  // Debug manager exports
  DebugManager,
  DEBUG_MODES,
  defaultDebugManager,

  // System creation
  createLoggingSystem,
  initializeLogging,
  getLoggingSystem
};
