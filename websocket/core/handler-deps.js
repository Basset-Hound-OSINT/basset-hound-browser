// AUTO-GENERATED barrel of module-scope dependencies for extracted command
// handlers (see MODULARIZE-server-js). Re-exports every symbol an inline handler
// body can reference so extracted core-*-commands.js modules resolve identically
// to the original module scope. Singletons stay identical (Node module cache).

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { ipcMain } = require('electron');
const { humanDelay, humanType, humanMouseMove, humanScroll } = require('./../../evasion/humanize');
const { ScreenshotManager, validateAnnotation, applyAnnotationDefaults } = require('./../../screenshots/manager');
const { CompressedScreenshotCache } = require('./../../screenshots/cache');
const { RecordingManager, RecordingState } = require('./../../recording/manager');
const keyboard = require('./../../input/keyboard');
const mouse = require('./../../input/mouse');
const { proxyManager, PROXY_TYPES } = require('./../../proxy/manager');
const { userAgentManager, UA_CATEGORIES } = require('./../../utils/user-agents');
const { requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES } = require('./../../utils/request-interceptor');
const { DOMInspector } = require('./../../inspector/manager');
const { HeaderManager } = require('./../../headers/manager');
const { PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames } = require('./../../headers/profiles');
const { memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus } = require('./../../utils/memory-manager');
const { TechnologyManager } = require('./../../technology');
const { ExtractionManager } = require('./../../extraction');
const { NetworkAnalysisManager } = require('./../../network-analysis/manager');
const { SessionRecordingManager, RECORDING_STATE } = require('./../../recording/session-recorder');
const { ReplayEngine, REPLAY_STATE, ERROR_MODE } = require('./../../recording/replay');
const { headlessManager, HEADLESS_PRESETS } = require('./../../headless/manager');
const { WindowManager, WindowState } = require('./../../windows/manager');
const { WindowPool, PoolEntryState } = require('./../../windows/pool');
const { PluginManager, PLUGIN_STATE } = require('./../../plugins');
const { ConnectionPool } = require('./../connection-pool');
const { CommandDispatcher } = require('./../command-dispatcher');
const { ConnectionLifecycleManager } = require('./../connection-manager');
const { WebSocketRateLimiter } = require('./../rate-limiter');
const PriorityQueue = require('./../priority-queue');
const {
  createLogger,
  defaultLogger,
  defaultProfiler,
  defaultMemoryMonitor,
  defaultDebugManager,
  LOG_LEVELS,
  LEVEL_NAMES,
  WebSocketTransport
} = require('./../../logging');
const { getSerializer } = require('./../response-serializer');
const { LazyManagerRegistry } = require('./../../src/managers/lazy-initializer');
const {
  initializeGCTuning,
  initializeAdvancedGCTuning,
  getAdaptiveGCManager
} = require('./../../utils/gc-tuning');
const { CloudflareDetector } = require('./../../src/cloudflare/detector');
const { RequestSizeValidator } = require('./../request-validator');
const { PathValidator, getInstance: getPathValidator } = require('./../../utils/path-validator');
const { ErrorFormatter } = require('./../error-formatter');
const { HttpResponseDecorator } = require('./../http-response-decorator');
const { ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS } = require('./../reliability-manager');
const { HealthEndpointManager } = require('./../health-endpoint');
const { DiagnosticsAPI } = require('./../diagnostics-api');
const { PrometheusMetricsCollector } = require('./../metrics');
const { getConsentManager } = require('./../middleware/monitoring-consent');
const { isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl } = require('./url-guards');
const { IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout } = require('./timing');
const { ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion } = require('./retry');
const { StateSnapshot, StateRollbackManager, StatefulCommandHandler } = require('./state-management');

module.exports = {
  WebSocket,
  https,
  fs,
  path,
  crypto,
  execSync,
  ipcMain,
  humanDelay,
  humanType,
  humanMouseMove,
  humanScroll,
  ScreenshotManager,
  validateAnnotation,
  applyAnnotationDefaults,
  CompressedScreenshotCache,
  RecordingManager,
  RecordingState,
  keyboard,
  mouse,
  proxyManager,
  PROXY_TYPES,
  userAgentManager,
  UA_CATEGORIES,
  requestInterceptor,
  RESOURCE_TYPES,
  PREDEFINED_BLOCK_RULES,
  DOMInspector,
  HeaderManager,
  PREDEFINED_PROFILES,
  profileStorage,
  getPredefinedProfileNames,
  memoryManager,
  MemoryManager,
  MEMORY_THRESHOLDS,
  MemoryStatus,
  TechnologyManager,
  ExtractionManager,
  NetworkAnalysisManager,
  SessionRecordingManager,
  RECORDING_STATE,
  ReplayEngine,
  REPLAY_STATE,
  ERROR_MODE,
  headlessManager,
  HEADLESS_PRESETS,
  WindowManager,
  WindowState,
  WindowPool,
  PoolEntryState,
  PluginManager,
  PLUGIN_STATE,
  ConnectionPool,
  CommandDispatcher,
  ConnectionLifecycleManager,
  WebSocketRateLimiter,
  PriorityQueue,
  createLogger,
  defaultLogger,
  defaultProfiler,
  defaultMemoryMonitor,
  defaultDebugManager,
  LOG_LEVELS,
  LEVEL_NAMES,
  WebSocketTransport,
  getSerializer,
  LazyManagerRegistry,
  initializeGCTuning,
  initializeAdvancedGCTuning,
  getAdaptiveGCManager,
  CloudflareDetector,
  RequestSizeValidator,
  PathValidator,
  getPathValidator,
  ErrorFormatter,
  HttpResponseDecorator,
  ReliabilityManager,
  TRANSIENT_ERRORS,
  PERMANENT_ERRORS,
  HealthEndpointManager,
  DiagnosticsAPI,
  PrometheusMetricsCollector,
  getConsentManager,
  isOnionUrl,
  isTorModeEnabled,
  checkOnionWithoutTor,
  _ssrfEnvFlag,
  _isForbiddenIPv4,
  _ipv6ToBytes,
  _isForbiddenIPv6,
  validateNavigationUrl,
  IPC_DEFAULT_TIMEOUT,
  ADAPTIVE_TIMEOUT_CONFIG,
  calculateAdaptiveTimeout,
  ipcWithTimeout,
  ERROR_RECOVERY_CONFIG,
  isRetryableError,
  isRetryableCommand,
  calculateRetryDelay,
  sleep,
  generateRecoverySuggestion,
  StateSnapshot,
  StateRollbackManager,
  StatefulCommandHandler
};
