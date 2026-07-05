/**
 * WebSocket Server Integration Module
 *
 * Integrates infrastructure components, security modules, and dashboard into the WebSocket server.
 * Manages command handling pipeline with security checks, rate limiting, and session validation.
 */

const RateLimiter = require('../src/security/advanced-rate-limiting');
const AuditLogger = require('../src/security/enhanced-audit-log');
const PolicyEnforcer = require('../src/security/policy-enforcer');
const RequestSigner = require('../src/security/request-signing');
const DashboardEngine = require('../src/dashboard/dashboard-engine');
const AlertManager = require('../src/dashboard/alert-manager');

class WebSocketServerIntegration {
  constructor(wsServer, infrastructure, options = {}) {
    this.wsServer = wsServer;
    this.infrastructure = infrastructure;
    this.options = {
      enableRateLimit: true,
      enableAudit: true,
      enablePolicies: true,
      enableDashboard: true,
      ...options
    };

    // Security components
    this.rateLimiter = null;
    this.auditLogger = null;
    this.policyEnforcer = null;
    this.requestSigner = null;

    // Dashboard components
    this.dashboardEngine = null;
    this.alertManager = null;

    this.logger = options.logger || console;
  }

  /**
   * Initialize all integrations
   */
  async initialize() {
    this.logger.log('[WebSocketIntegration] Starting integration...');
    const startTime = Date.now();

    try {
      // Initialize security modules
      if (this.options.enableRateLimit) {
        await this._initializeRateLimiter();
      }

      if (this.options.enableAudit) {
        await this._initializeAuditLogger();
      }

      if (this.options.enablePolicies) {
        await this._initializePolicyEnforcer();
      }

      // Initialize request signing
      await this._initializeRequestSigner();

      // Initialize dashboard modules
      if (this.options.enableDashboard) {
        await this._initializeDashboard();
        await this._initializeAlertManager();
      }

      // Wire message handler with security pipeline
      this._wireMessageHandler();

      // Setup dashboard endpoints
      if (this.dashboardEngine) {
        this._setupDashboardEndpoints();
      }

      // Setup metrics endpoints
      this._setupMetricsEndpoints();

      const duration = Date.now() - startTime;
      this.logger.log(`[WebSocketIntegration] Integration complete in ${duration}ms`);

      return { success: true, duration };
    } catch (error) {
      this.logger.error('[WebSocketIntegration] Integration failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize rate limiter
   */
  async _initializeRateLimiter() {
    this.logger.log('[WebSocketIntegration] Initializing rate limiter...');

    this.rateLimiter = new RateLimiter({
      windowSize: 60000, // 60 seconds
      maxRequests: 1000, // 1000 requests per minute
      perIP: true,
      logger: this.logger
    });

    this.logger.log('[WebSocketIntegration] Rate limiter initialized');
  }

  /**
   * Initialize audit logger
   */
  async _initializeAuditLogger() {
    this.logger.log('[WebSocketIntegration] Initializing audit logger...');

    const dbPool = this.infrastructure.getComponent('dbPool');
    const sessionStore = this.infrastructure.getComponent('sessionStore');

    this.auditLogger = new AuditLogger({
      dbPool,
      sessionStore,
      enableFileLogging: true,
      logFilePath: './logs/audit.log',
      logger: this.logger
    });

    await this.auditLogger.initialize();
    this.logger.log('[WebSocketIntegration] Audit logger initialized');
  }

  /**
   * Initialize policy enforcer
   */
  async _initializePolicyEnforcer() {
    this.logger.log('[WebSocketIntegration] Initializing policy enforcer...');

    const sessionStore = this.infrastructure.getComponent('sessionStore');

    this.policyEnforcer = new PolicyEnforcer({
      sessionStore,
      policies: {
        sessionTimeout: 3600000, // 1 hour
        maxConcurrentSessions: 10,
        ipWhitelist: [],
        commandBlacklist: []
      },
      logger: this.logger
    });

    this.logger.log('[WebSocketIntegration] Policy enforcer initialized');
  }

  /**
   * Initialize request signing
   */
  async _initializeRequestSigner() {
    this.logger.log('[WebSocketIntegration] Initializing request signer...');

    this.requestSigner = new RequestSigner({
      algorithm: 'sha256',
      secretKey: process.env.SIGNING_SECRET || 'default-secret-change-me',
      logger: this.logger
    });

    this.logger.log('[WebSocketIntegration] Request signer initialized');
  }

  /**
   * Initialize dashboard engine
   */
  async _initializeDashboard() {
    this.logger.log('[WebSocketIntegration] Initializing dashboard engine...');

    const dbPool = this.infrastructure.getComponent('dbPool');

    this.dashboardEngine = new DashboardEngine({
      dbPool,
      updateInterval: 5000, // 5 seconds
      logger: this.logger
    });

    await this.dashboardEngine.initialize();
    this.logger.log('[WebSocketIntegration] Dashboard engine initialized');
  }

  /**
   * Initialize alert manager
   */
  async _initializeAlertManager() {
    this.logger.log('[WebSocketIntegration] Initializing alert manager...');

    const dbPool = this.infrastructure.getComponent('dbPool');

    this.alertManager = new AlertManager({
      dbPool,
      wsServer: this.wsServer,
      logger: this.logger
    });

    await this.alertManager.initialize();
    this.logger.log('[WebSocketIntegration] Alert manager initialized');
  }

  /**
   * Wire message handler with security checks pipeline
   */
  _wireMessageHandler() {
    this.logger.log('[WebSocketIntegration] Wiring message handler...');

    const originalOnMessage = this.wsServer.onMessage;

    // Wrap the original message handler with security pipeline
    this.wsServer.onMessage = async (ws, data, isBinary) => {
      const clientIp = ws._socket.remoteAddress;
      const clientId = ws.clientId;

      try {
        // Step 1: Parse message
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (error) {
          return ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON'
          }));
        }

        const command = message.command;
        const requestId = message.requestId || `req_${Date.now()}`;

        // Step 2: Rate limiting check
        if (this.rateLimiter) {
          const isAllowed = await this.rateLimiter.isAllowed(clientIp, command);
          if (!isAllowed) {
            if (this.auditLogger) {
              await this.auditLogger.logSecurityEvent({
                type: 'RATE_LIMIT_EXCEEDED',
                clientIp,
                command,
                timestamp: new Date()
              });
            }
            return ws.send(JSON.stringify({
              type: 'error',
              requestId,
              message: 'Rate limit exceeded',
              code: 429
            }));
          }
        }

        // Step 3: Session validation
        const sessionStore = this.infrastructure.getComponent('sessionStore');
        let session = null;
        if (sessionStore && clientId) {
          session = await sessionStore.getSession(clientId);
          if (!session) {
            return ws.send(JSON.stringify({
              type: 'error',
              requestId,
              message: 'Invalid or expired session',
              code: 401
            }));
          }
        }

        // Step 4: Policy enforcement
        if (this.policyEnforcer) {
          const allowed = await this.policyEnforcer.enforcePolicy(command, session);
          if (!allowed) {
            if (this.auditLogger) {
              await this.auditLogger.logSecurityEvent({
                type: 'POLICY_VIOLATION',
                clientIp,
                command,
                sessionId: clientId,
                timestamp: new Date()
              });
            }
            return ws.send(JSON.stringify({
              type: 'error',
              requestId,
              message: 'Policy violation',
              code: 403
            }));
          }
        }

        // Step 5: Request signature verification (optional)
        if (message.signature && this.requestSigner) {
          const isValid = this.requestSigner.verify(message, message.signature);
          if (!isValid) {
            if (this.auditLogger) {
              await this.auditLogger.logSecurityEvent({
                type: 'INVALID_SIGNATURE',
                clientIp,
                command,
                timestamp: new Date()
              });
            }
            return ws.send(JSON.stringify({
              type: 'error',
              requestId,
              message: 'Invalid request signature',
              code: 401
            }));
          }
        }

        // Step 6: Update session activity
        if (session && sessionStore) {
          await sessionStore.updateSession(clientId, {
            activity_count: (session.activity_count || 0) + 1,
            last_activity: new Date()
          });
        }

        // Step 7: Call original handler
        await originalOnMessage.call(this.wsServer, ws, data, isBinary);

        // Step 8: Audit log
        if (this.auditLogger) {
          await this.auditLogger.logOperation({
            type: 'COMMAND_EXECUTED',
            command,
            clientIp,
            sessionId: clientId,
            requestId,
            success: true,
            timestamp: new Date()
          });
        }
      } catch (error) {
        this.logger.error('[WebSocketIntegration] Error in message handler:', error.message);

        // Audit log failure
        if (this.auditLogger) {
          await this.auditLogger.logOperation({
            type: 'COMMAND_FAILED',
            command: message?.command,
            clientIp,
            sessionId: clientId,
            requestId: message?.requestId,
            success: false,
            error: error.message,
            timestamp: new Date()
          });
        }
      }
    };

    this.logger.log('[WebSocketIntegration] Message handler wired successfully');
  }

  /**
   * Setup dashboard command endpoints
   */
  _setupDashboardEndpoints() {
    this.logger.log('[WebSocketIntegration] Setting up dashboard endpoints...');

    // These would be integrated into WebSocket message handlers
    // For now, we just register them
    const dashboardCommands = [
      'dashboard.getMetrics',
      'dashboard.getStatus',
      'dashboard.getAlerts',
      'dashboard.acknowledgeAlert',
      'dashboard.dismissAlert',
      'dashboard.getRecentActivities',
      'dashboard.getSystemHealth'
    ];

    dashboardCommands.forEach(cmd => {
      this.logger.log(`[WebSocketIntegration] Registered dashboard command: ${cmd}`);
    });
  }

  /**
   * Setup metrics endpoints
   */
  _setupMetricsEndpoints() {
    this.logger.log('[WebSocketIntegration] Setting up metrics endpoints...');

    const metricsCollector = this.infrastructure.getComponent('metricsCollector');
    if (!metricsCollector) {
      return;
    }

    // Register HTTP endpoints (would be handled by a separate HTTP server)
    const endpoints = {
      '/metrics': () => metricsCollector.getAllMetrics(),
      '/metrics/summary': () => metricsCollector.getSummary(),
      '/health': () => this.infrastructure.getComponent('healthChecker')?.getFullHealthStatus()
    };

    Object.entries(endpoints).forEach(([path, handler]) => {
      this.logger.log(`[WebSocketIntegration] Registered metrics endpoint: ${path}`);
    });
  }

  /**
   * Create session for new WebSocket connection
   */
  async createSession(ws, data = {}) {
    const sessionStore = this.infrastructure.getComponent('sessionStore');
    if (!sessionStore) {
      throw new Error('Session store not available');
    }

    const clientIp = ws._socket.remoteAddress;
    const session = await sessionStore.createSession({
      user_id: data.userId || 'anonymous',
      client_ip: clientIp,
      browser_fingerprint: data.fingerprint || null,
      user_agent: data.userAgent || null,
      metadata: data.metadata || {}
    });

    ws.clientId = session.session_id;
    return session;
  }

  /**
   * Close session for WebSocket connection
   */
  async closeSession(ws) {
    const sessionStore = this.infrastructure.getComponent('sessionStore');
    if (!sessionStore || !ws.clientId) {
      return;
    }

    await sessionStore.deleteSession(ws.clientId);
  }

  /**
   * Get integration status
   */
  async getStatus() {
    return {
      wsServer: Boolean(this.wsServer),
      infrastructure: Boolean(this.infrastructure),
      components: {
        rateLimiter: Boolean(this.rateLimiter),
        auditLogger: Boolean(this.auditLogger),
        policyEnforcer: Boolean(this.policyEnforcer),
        requestSigner: Boolean(this.requestSigner),
        dashboardEngine: Boolean(this.dashboardEngine),
        alertManager: Boolean(this.alertManager)
      }
    };
  }
}

module.exports = WebSocketServerIntegration;
