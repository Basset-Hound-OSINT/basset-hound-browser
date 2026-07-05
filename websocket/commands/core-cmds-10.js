// Command handlers (add_monitor .. clear_all_monitors) — extracted from
// server.js setupCommandHandlers. 23 handlers. Order preserved.
const D = require('../core/handler-deps');
const { WebSocket, https, fs, path, crypto, execSync, ipcMain, humanDelay, humanType, humanMouseMove, humanScroll, ScreenshotManager, validateAnnotation, applyAnnotationDefaults, CompressedScreenshotCache, RecordingManager, RecordingState, keyboard, mouse, proxyManager, PROXY_TYPES, userAgentManager, UA_CATEGORIES, requestInterceptor, RESOURCE_TYPES, PREDEFINED_BLOCK_RULES, DOMInspector, HeaderManager, PREDEFINED_PROFILES, profileStorage, getPredefinedProfileNames, memoryManager, MemoryManager, MEMORY_THRESHOLDS, MemoryStatus, TechnologyManager, ExtractionManager, NetworkAnalysisManager, SessionRecordingManager, RECORDING_STATE, ReplayEngine, REPLAY_STATE, ERROR_MODE, headlessManager, HEADLESS_PRESETS, WindowManager, WindowState, WindowPool, PoolEntryState, PluginManager, PLUGIN_STATE, ConnectionPool, CommandDispatcher, ConnectionLifecycleManager, WebSocketRateLimiter, PriorityQueue, createLogger, defaultLogger, defaultProfiler, defaultMemoryMonitor, defaultDebugManager, LOG_LEVELS, LEVEL_NAMES, WebSocketTransport, getSerializer, LazyManagerRegistry, initializeGCTuning, initializeAdvancedGCTuning, getAdaptiveGCManager, CloudflareDetector, RequestSizeValidator, PathValidator, getPathValidator, ErrorFormatter, HttpResponseDecorator, ReliabilityManager, TRANSIENT_ERRORS, PERMANENT_ERRORS, HealthEndpointManager, DiagnosticsAPI, PrometheusMetricsCollector, getConsentManager, isOnionUrl, isTorModeEnabled, checkOnionWithoutTor, _ssrfEnvFlag, _isForbiddenIPv4, _ipv6ToBytes, _isForbiddenIPv6, validateNavigationUrl, IPC_DEFAULT_TIMEOUT, ADAPTIVE_TIMEOUT_CONFIG, calculateAdaptiveTimeout, ipcWithTimeout, ERROR_RECOVERY_CONFIG, isRetryableError, isRetryableCommand, calculateRetryDelay, sleep, generateRecoverySuggestion, StateSnapshot, StateRollbackManager, StatefulCommandHandler } = D;

function registerCoreCmds10(server) {
    server.commandHandlers.add_monitor = server.commandHandlers.add_competitor_monitor;
    server.commandHandlers.remove_monitor = server.commandHandlers.remove_competitor_monitor;
    server.commandHandlers.update_monitor = server.commandHandlers.update_competitor_monitor;
    server.commandHandlers.get_monitor = server.commandHandlers.get_competitor_monitor;
    server.commandHandlers.list_monitors = server.commandHandlers.list_competitor_monitors;
    server.commandHandlers.pause_monitor = server.commandHandlers.pause_competitor_monitor;
    server.commandHandlers.resume_monitor = server.commandHandlers.resume_competitor_monitor;
    server.commandHandlers.check_monitor = server.commandHandlers.check_competitor_monitor;

    // Change history (3)
    server.commandHandlers.get_monitor_changes = server.commandHandlers.get_competitor_changes;
    server.commandHandlers.get_monitor_snapshots = server.commandHandlers.get_competitor_snapshots;
    server.commandHandlers.get_monitor_stats = server.commandHandlers.get_competitor_stats;

    // Service control (6)
    server.commandHandlers.start_monitoring_service = server.commandHandlers.start_competitor_monitoring;
    server.commandHandlers.stop_monitoring_service = server.commandHandlers.stop_competitor_monitoring;
    server.commandHandlers.pause_monitoring_service = server.commandHandlers.pause_competitor_monitoring;
    server.commandHandlers.resume_monitoring_service = server.commandHandlers.resume_competitor_monitoring;
    server.commandHandlers.get_monitoring_service_status = server.commandHandlers.get_competitor_monitoring_status;
    server.commandHandlers.get_monitoring_service_stats = server.commandHandlers.get_competitor_monitoring_stats;

    // Configuration (6)
    server.commandHandlers.configure_monitor_alerts = server.commandHandlers.configure_competitor_alerts;
    server.commandHandlers.run_monitor_check = server.commandHandlers.run_competitor_monitoring_checks;
    server.commandHandlers.export_monitors = server.commandHandlers.export_competitor_monitoring_data;
    server.commandHandlers.import_monitors = server.commandHandlers.import_competitor_monitoring_config;
    server.commandHandlers.cleanup_monitoring_data = server.commandHandlers.cleanup_competitor_monitoring_data;
    server.commandHandlers.clear_all_monitors = server.commandHandlers.clear_all_competitor_monitors;
}

module.exports = { registerCoreCmds10 };
