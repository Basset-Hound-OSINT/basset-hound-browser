/**
 * Core Module - Central Exports
 *
 * Provides unified access to core infrastructure:
 * - Error hierarchy
 * - Base classes
 * - Utilities
 * - Patterns
 *
 * @module core
 */

// Error hierarchy
const {
  BassetError,
  BrowserError,
  BrowserConnectionError,
  WebSocketError,
  NavigationError,
  TimeoutError,
  DetectionError,
  InvalidDetectionDataError,
  ExtractionError,
  DOMExtractionError,
  ScreenshotError,
  SessionError,
  SessionNotFoundError,
  AuthenticationError,
  ProxyError,
  FileOperationError,
  ConfigurationError,
  ValidationError,
  RateLimitError,
  ResourceError,
  InternalError
} = require('./errors');

// Base classes
const BaseReportGenerator = require('./base-report-generator');

// Utilities
const {
  memoize,
  memoizeAsync,
  debounce,
  throttle,
  retry,
  withTimeout,
  sleep,
  deepClone,
  merge,
  deepMerge,
  isEmpty,
  getNestedValue,
  setNestedValue,
  flattenObject,
  isValidEmail,
  isValidUrl,
  safeJsonParse,
  safeJsonStringify
} = require('./utils');

// Command pattern support (for Phase 2)
let CommandRegistry, CommandHandler;
try {
  CommandRegistry = require('./command-registry');
  CommandHandler = require('./command-handler');
} catch (error) {
  // Graceful fallback if command infrastructure not yet available
  CommandRegistry = null;
  CommandHandler = null;
}

module.exports = {
  // Errors
  errors: {
    BassetError,
    BrowserError,
    BrowserConnectionError,
    WebSocketError,
    NavigationError,
    TimeoutError,
    DetectionError,
    InvalidDetectionDataError,
    ExtractionError,
    DOMExtractionError,
    ScreenshotError,
    SessionError,
    SessionNotFoundError,
    AuthenticationError,
    ProxyError,
    FileOperationError,
    ConfigurationError,
    ValidationError,
    RateLimitError,
    ResourceError,
    InternalError
  },

  // Classes
  BaseReportGenerator,

  // Utilities
  utils: {
    memoize,
    memoizeAsync,
    debounce,
    throttle,
    retry,
    withTimeout,
    sleep,
    deepClone,
    merge,
    deepMerge,
    isEmpty,
    getNestedValue,
    setNestedValue,
    flattenObject,
    isValidEmail,
    isValidUrl,
    safeJsonParse,
    safeJsonStringify
  },

  // Command patterns (Phase 2)
  CommandRegistry,
  CommandHandler,

  // Convenience exports
  ...{
    BassetError,
    BaseReportGenerator,
    CommandRegistry,
    CommandHandler
  }
};
