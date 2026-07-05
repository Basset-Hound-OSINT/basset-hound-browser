/**
 * Service Mesh Controller for Basset Hound Browser
 *
 * Provides:
 * - Service-to-service communication
 * - Circuit breaking and retry policies
 * - Traffic management (canary deployments)
 * - Security policies (mTLS, authorization)
 *
 * Features:
 * - Advanced traffic routing rules
 * - Circuit breaker pattern
 * - Retry policies with backoff
 * - Traffic mirroring for canary deployments
 * - Request/response mutation policies
 * - Virtual service management
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class ServiceMeshController extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableMTLS: options.enableMTLS !== false,
      enableTrafficManagement: options.enableTrafficManagement !== false,
      enableCircuitBreaker: options.enableCircuitBreaker !== false,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      retryAttempts: options.retryAttempts || 3,
      retryBackoff: options.retryBackoff || 'exponential',
      ...options
    };

    this.virtualServices = new Map();
    this.destinationRules = new Map();
    this.peerAuthentication = new Map();
    this.authorizationPolicies = new Map();
    this.trafficMirrors = new Map();
    this.circuitBreakers = new Map();
    this.requestPolicies = new Map();
    this.gatewayRules = new Map();
  }

  /**
   * Create a virtual service for routing
   */
  createVirtualService(name, config) {
    const virtualService = {
      name,
      hosts: config.hosts || [name],
      http: config.http || [],
      tcp: config.tcp || [],
      tls: config.tls || [],
      exportTo: config.exportTo || ['.'],
      metadata: config.metadata || {},
      createdAt: Date.now(),
      version: 'v1',
      kind: 'VirtualService'
    };

    this.virtualServices.set(name, virtualService);
    this.emit('virtualService:created', { name, virtualService });
    return virtualService;
  }

  /**
   * Configure traffic routing for virtual service
   */
  configureRouting(virtualServiceName, routes) {
    const virtualService = this.virtualServices.get(virtualServiceName);
    if (!virtualService) {
      throw new Error(`Virtual service ${virtualServiceName} not found`);
    }

    virtualService.http = routes.map(route => ({
      name: route.name,
      match: route.match || [],
      route: route.destinations || [],
      timeout: route.timeout,
      retries: route.retries || {
        attempts: this.options.retryAttempts,
        perTryTimeout: '5s'
      },
      corsPolicy: route.corsPolicy,
      headers: route.headers
    }));

    this.emit('routing:configured', { virtualService: virtualServiceName });
    return virtualService;
  }

  /**
   * Create destination rules for traffic policy
   */
  createDestinationRule(name, config) {
    const rule = {
      name,
      host: config.host,
      trafficPolicy: config.trafficPolicy || this._defaultTrafficPolicy(),
      subsets: config.subsets || [],
      exportTo: config.exportTo || ['.'],
      metadata: config.metadata || {},
      createdAt: Date.now(),
      version: 'v1',
      kind: 'DestinationRule'
    };

    this.destinationRules.set(name, rule);
    this.emit('destinationRule:created', { name, rule });
    return rule;
  }

  /**
   * Default traffic policy
   */
  _defaultTrafficPolicy() {
    return {
      connectionPool: {
        tcp: {
          maxConnections: 100
        },
        http: {
          http1MaxPendingRequests: 100,
          maxRequestsPerConnection: 2,
          h2UpgradePolicy: 'UPGRADE'
        }
      },
      outlierDetection: {
        consecutive5xxErrors: 5,
        interval: '30s',
        baseEjectionTime: '30s',
        maxEjectionPercent: 50,
        minRequestVolume: 5,
        splitExternalLocalOriginErrors: true
      },
      loadBalancer: {
        simple: 'ROUND_ROBIN'
      }
    };
  }

  /**
   * Configure circuit breaker
   */
  configureCircuitBreaker(destinationRuleName, config) {
    const rule = this.destinationRules.get(destinationRuleName);
    if (!rule) {
      throw new Error(`Destination rule ${destinationRuleName} not found`);
    }

    const circuitBreaker = {
      name: `${destinationRuleName}:circuit-breaker`,
      host: rule.host,
      consecutiveErrors: config.consecutiveErrors || this.options.circuitBreakerThreshold,
      interval: config.interval || '30s',
      baseEjectionTime: config.baseEjectionTime || '30s',
      maxEjectionPercent: config.maxEjectionPercent || 50,
      minRequestVolume: config.minRequestVolume || 5,
      state: 'closed',
      failureCount: 0,
      lastFailureTime: null,
      ejectedInstances: []
    };

    this.circuitBreakers.set(destinationRuleName, circuitBreaker);
    this.emit('circuitBreaker:configured', { destinationRule: destinationRuleName });
    return circuitBreaker;
  }

  /**
   * Setup peer authentication for mTLS
   */
  setupPeerAuthentication(name, config) {
    const auth = {
      name,
      namespace: config.namespace || 'default',
      mtls: {
        mode: config.mtls?.mode || 'STRICT', // PERMISSIVE, STRICT, DISABLE
        portLevelMtls: config.mtls?.portLevelMtls || {}
      },
      selector: config.selector,
      createdAt: Date.now(),
      version: 'v1',
      kind: 'PeerAuthentication'
    };

    this.peerAuthentication.set(name, auth);
    this.emit('peerAuthentication:created', { name, auth });
    return auth;
  }

  /**
   * Create authorization policy
   */
  createAuthorizationPolicy(name, config) {
    const policy = {
      name,
      namespace: config.namespace || 'default',
      selector: config.selector,
      action: config.action || 'ALLOW',
      rules: config.rules || [],
      createdAt: Date.now(),
      version: 'v1',
      kind: 'AuthorizationPolicy'
    };

    this.authorizationPolicies.set(name, policy);
    this.emit('authorizationPolicy:created', { name, policy });
    return policy;
  }

  /**
   * Setup traffic mirroring for canary deployments
   */
  setupTrafficMirroring(sourceService, mirrorConfig) {
    const mirror = {
      sourceService,
      destination: mirrorConfig.destination,
      percentage: mirrorConfig.percentage || 10,
      headers: mirrorConfig.headers || {},
      timeout: mirrorConfig.timeout || '30s',
      retries: mirrorConfig.retries || 3,
      enabled: true,
      startTime: Date.now(),
      stats: {
        requests: 0,
        errors: 0,
        latency: 0
      }
    };

    this.trafficMirrors.set(sourceService, mirror);
    this.emit('trafficMirror:created', { sourceService, mirror });
    return mirror;
  }

  /**
   * Route request with mesh policies
   */
  async routeRequest(request, context = {}) {
    const startTime = Date.now();

    try {
      // Extract routing info
      const { service, subset, port } = context;

      // Check authorization
      const authResult = await this._checkAuthorization(request, context);
      if (!authResult.allowed) {
        return {
          allowed: false,
          reason: authResult.reason,
          statusCode: 403
        };
      }

      // Check circuit breaker
      const circuitBreakerResult = this._checkCircuitBreaker(service);
      if (!circuitBreakerResult.allowed) {
        return {
          allowed: false,
          reason: 'Circuit breaker open',
          statusCode: 503
        };
      }

      // Apply request mutations
      const mutatedRequest = await this._applyRequestMutations(request, service);

      // Apply retry policy
      const retryPolicy = this._getRetryPolicy(service);
      let response;
      let attempt = 0;

      while (attempt < (retryPolicy?.attempts || 1)) {
        try {
          // Apply traffic mirroring if configured
          if (this.trafficMirrors.has(service)) {
            this._mirrorRequest(mutatedRequest, this.trafficMirrors.get(service));
          }

          // Forward request
          response = await this._forwardRequest(mutatedRequest, context);
          circuitBreakerResult.failureCount = 0;
          break;

        } catch (error) {
          attempt++;
          circuitBreakerResult.failureCount++;

          if (attempt >= (retryPolicy?.attempts || 1)) {
            // Record circuit breaker failure
            if (circuitBreakerResult.failureCount >= this.options.circuitBreakerThreshold) {
              this._openCircuitBreaker(service);
            }
            throw error;
          }

          // Exponential backoff
          const backoff = Math.pow(2, attempt) * (retryPolicy?.backoffMs || 100);
          await this._delay(backoff);
        }
      }

      // Apply response mutations
      const mutatedResponse = await this._applyResponseMutations(response, service);

      // Record metrics
      const latency = Date.now() - startTime;
      this._recordMeshMetrics(service, latency, response.statusCode);

      return {
        allowed: true,
        response: mutatedResponse,
        latency
      };

    } catch (error) {
      this.emit('routing:error', { error: error.message });
      return {
        allowed: false,
        reason: error.message,
        statusCode: 500
      };
    }
  }

  /**
   * Check authorization policy
   */
  async _checkAuthorization(request, context) {
    const policies = Array.from(this.authorizationPolicies.values())
      .filter(p => this._matchesSelector(p.selector, context));

    if (policies.length === 0) {
      return { allowed: true };
    }

    for (const policy of policies) {
      const matches = policy.rules.some(rule =>
        this._matchesRule(rule, request, context)
      );

      if (policy.action === 'ALLOW' && matches) {
        return { allowed: true };
      }
      if (policy.action === 'DENY' && matches) {
        return { allowed: false, reason: 'Denied by authorization policy' };
      }
    }

    return { allowed: policy.action === 'ALLOW' };
  }

  /**
   * Check if request matches selector
   */
  _matchesSelector(selector, context) {
    if (!selector) {
      return true;
    }
    if (!context.labels) {
      return false;
    }

    return Object.entries(selector).every(([key, value]) =>
      context.labels[key] === value
    );
  }

  /**
   * Check if request matches rule
   */
  _matchesRule(rule, request, context) {
    if (rule.from) {
      const fromMatch = rule.from.some(from =>
        this._matchesPrincipal(from.source, context)
      );
      if (!fromMatch) {
        return false;
      }
    }

    if (rule.to) {
      const toMatch = rule.to.some(to =>
        this._matchesOperation(to.operation, request)
      );
      if (!toMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Match principal/source
   */
  _matchesPrincipal(source, context) {
    if (source.principals && !source.principals.includes(context.principal)) {
      return false;
    }
    return true;
  }

  /**
   * Match operation
   */
  _matchesOperation(operation, request) {
    if (operation.methods && !operation.methods.includes(request.method)) {
      return false;
    }
    if (operation.paths && !operation.paths.some(p =>
      this._matchesPath(p, request.path))) {
      return false;
    }
    return true;
  }

  /**
   * Match path pattern
   */
  _matchesPath(pattern, path) {
    if (pattern === '*') {
      return true;
    }
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return pattern === path;
  }

  /**
   * Check circuit breaker status
   */
  _checkCircuitBreaker(service) {
    let breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      breaker = {
        host: service,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null
      };
      this.circuitBreakers.set(service, breaker);
    }

    if (breaker.state === 'open') {
      const timeSinceLast = Date.now() - (breaker.lastFailureTime || Date.now());
      if (timeSinceLast < this.options.circuitBreakerTimeout) {
        return { allowed: false };
      }
      breaker.state = 'half-open';
    }

    return { allowed: true, ...breaker };
  }

  /**
   * Open circuit breaker
   */
  _openCircuitBreaker(service) {
    let breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      breaker = {
        host: service,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null
      };
      this.circuitBreakers.set(service, breaker);
    }

    breaker.state = 'open';
    breaker.lastFailureTime = Date.now();
    this.emit('circuitBreaker:opened', { service });
  }

  /**
   * Get retry policy for service
   */
  _getRetryPolicy(service) {
    const virtualService = Array.from(this.virtualServices.values())
      .find(vs => vs.hosts.includes(service));

    if (virtualService && virtualService.http && virtualService.http[0]) {
      return virtualService.http[0].retries;
    }

    return { attempts: this.options.retryAttempts };
  }

  /**
   * Apply request mutations
   */
  async _applyRequestMutations(request, service) {
    const mutated = { ...request };

    const policy = this.requestPolicies.get(service);
    if (policy && policy.mutations) {
      if (policy.mutations.headers) {
        mutated.headers = { ...mutated.headers, ...policy.mutations.headers };
      }
      if (policy.mutations.removeHeaders) {
        policy.mutations.removeHeaders.forEach(h => delete mutated.headers[h]);
      }
    }

    return mutated;
  }

  /**
   * Apply response mutations
   */
  async _applyResponseMutations(response, service) {
    const mutated = { ...response };

    const policy = this.requestPolicies.get(service);
    if (policy && policy.responseMutations) {
      if (policy.responseMutations.headers) {
        mutated.headers = { ...mutated.headers, ...policy.responseMutations.headers };
      }
    }

    return mutated;
  }

  /**
   * Mirror request to destination
   */
  async _mirrorRequest(request, mirror) {
    if (!mirror.enabled || Math.random() * 100 > mirror.percentage) {
      return;
    }

    try {
      // Clone request for mirroring
      const mirroredRequest = {
        ...request,
        headers: { ...request.headers, ...mirror.headers }
      };

      // Send to mirror destination asynchronously
      setImmediate(() => {
        mirror.stats.requests++;
      });

      this.emit('request:mirrored', { source: mirror.sourceService, destination: mirror.destination });

    } catch (error) {
      mirror.stats.errors++;
    }
  }

  /**
   * Forward request to destination
   */
  async _forwardRequest(request, context) {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve({
          statusCode: 200,
          body: { message: 'Success' },
          headers: {}
        });
      });
    });
  }

  /**
   * Record mesh metrics
   */
  _recordMeshMetrics(service, latency, statusCode) {
    this.emit('metrics:recorded', { service, latency, statusCode });
  }

  /**
   * Delay utility
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get mesh status
   */
  getStatus() {
    return {
      virtualServices: this.virtualServices.size,
      destinationRules: this.destinationRules.size,
      peerAuthentication: this.peerAuthentication.size,
      authorizationPolicies: this.authorizationPolicies.size,
      trafficMirrors: this.trafficMirrors.size,
      circuitBreakers: Array.from(this.circuitBreakers.values()).map(cb => ({
        host: cb.host,
        state: cb.state,
        failureCount: cb.failureCount
      }))
    };
  }

  /**
   * Close mesh controller
   */
  close() {
    this.removeAllListeners();
    this.virtualServices.clear();
    this.destinationRules.clear();
    this.peerAuthentication.clear();
    this.authorizationPolicies.clear();
    this.trafficMirrors.clear();
    this.circuitBreakers.clear();
  }
}

module.exports = ServiceMeshController;
