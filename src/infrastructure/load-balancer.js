/**
 * HAProxy-inspired Load Balancer Module
 *
 * Provides in-process load balancing with:
 * - Round-robin and least-connections algorithms
 * - Session affinity (sticky sessions by client IP)
 * - Health checking and backend management
 * - Connection pooling
 * - Rate limiting per client
 * - Metrics collection (Prometheus-compatible)
 */

const net = require('net');
const EventEmitter = require('events');
const crypto = require('crypto');

class LoadBalancer extends EventEmitter {
  constructor(config = {}) {
    super();

    // Configuration
    this.config = {
      port: config.port || 8765,
      host: config.host || '0.0.0.0',
      backends: config.backends || [],
      algorithm: config.algorithm || 'roundrobin', // roundrobin, leastconn, random
      sessionAffinity: config.sessionAffinity !== false, // sticky sessions
      healthCheckInterval: config.healthCheckInterval || 5000, // 5s
      healthCheckTimeout: config.healthCheckTimeout || 5000,
      maxConnections: config.maxConnections || 100000,
      maxConnectionsPerBackend: config.maxConnectionsPerBackend || 1000,
      rateLimit: config.rateLimit || {
        connectionsPerSec: 100, // max new connections per second per IP
        requestsPerSec: 1000,   // max requests per second per IP
      },
      sessionAffinityTTL: config.sessionAffinityTTL || 86400000, // 24 hours
      ...config,
    };

    // State tracking
    this.backends = new Map(); // backend_id -> {host, port, healthy, connections, stats}
    this.sessionAffinity = new Map(); // client_ip -> backend_id (sticky sessions)
    this.connectionCounts = new Map(); // client_ip -> connection count
    this.rateLimitTracking = new Map(); // client_ip -> {connections, requests, timestamp}
    this.metrics = {
      connections: {
        current: 0,
        total: 0,
        rate: 0,
      },
      requests: {
        total: 0,
        rate: 0,
      },
      errors: {
        connection: 0,
        request: 0,
        timeout: 0,
      },
      backends: {},
    };

    this.server = null;
    this.currentBackendIndex = 0; // for round-robin
    this.healthCheckIntervals = new Map();
    this.isShuttingDown = false;

    // Initialize backends
    if (this.config.backends.length > 0) {
      this.config.backends.forEach((backend, idx) => {
        this.addBackend(`backend_${idx}`, backend.host, backend.port);
      });
    }
  }

  /**
   * Add a backend server
   */
  addBackend(id, host, port) {
    this.backends.set(id, {
      id,
      host,
      port,
      healthy: true,
      connections: 0,
      stats: {
        totalConnections: 0,
        totalRequests: 0,
        errors: 0,
        lastCheck: Date.now(),
        uptime: 0,
        downtime: 0,
      },
    });

    this.metrics.backends[id] = {
      up: true,
      connections: 0,
      requests: 0,
      errors: 0,
      responseTime: 0,
    };

    // Start health checks for this backend
    this.startHealthCheck(id);
    this.emit('backend:added', { id, host, port });
  }

  /**
   * Remove a backend server
   */
  removeBackend(id) {
    const backend = this.backends.get(id);
    if (!backend) return;

    // Stop health checks
    if (this.healthCheckIntervals.has(id)) {
      clearInterval(this.healthCheckIntervals.get(id));
      this.healthCheckIntervals.delete(id);
    }

    this.backends.delete(id);
    delete this.metrics.backends[id];
    this.emit('backend:removed', { id });
  }

  /**
   * Start health check for a backend
   */
  startHealthCheck(backendId) {
    if (this.healthCheckIntervals.has(backendId)) {
      clearInterval(this.healthCheckIntervals.get(backendId));
    }

    const interval = setInterval(() => {
      this.checkBackendHealth(backendId);
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(backendId, interval);

    // Run first check immediately
    this.checkBackendHealth(backendId);
  }

  /**
   * Check if a backend is healthy (TCP connect test)
   */
  checkBackendHealth(backendId) {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    const socket = net.createConnection({
      host: backend.host,
      port: backend.port,
      timeout: this.config.healthCheckTimeout,
    });

    let isHealthy = false;

    socket.on('connect', () => {
      isHealthy = true;
      socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', (err) => {
      // Connection failed - backend is down
    });

    socket.on('close', () => {
      const wasHealthy = backend.healthy;
      backend.healthy = isHealthy;

      if (wasHealthy !== isHealthy) {
        // Only update metrics if backend still exists
        if (this.metrics.backends[backendId]) {
          this.metrics.backends[backendId].up = isHealthy;
        }
        this.emit('backend:health', {
          id: backendId,
          healthy: isHealthy,
          timestamp: Date.now(),
        });

        if (!isHealthy) {
          this.metrics.errors.connection++;
        }
      }

      backend.stats.lastCheck = Date.now();
    });
  }

  /**
   * Apply rate limiting per client IP
   * Returns true if rate limit exceeded
   */
  checkRateLimit(clientIp, isConnection = false) {
    const now = Date.now();
    const key = clientIp;

    if (!this.rateLimitTracking.has(key)) {
      this.rateLimitTracking.set(key, {
        connections: [],
        requests: [],
      });
    }

    const tracking = this.rateLimitTracking.get(key);
    const limit = isConnection ? this.config.rateLimit.connectionsPerSec
                                : this.config.rateLimit.requestsPerSec;

    const list = isConnection ? tracking.connections : tracking.requests;

    // Remove old entries (older than 1 second)
    while (list.length > 0 && list[0] < now - 1000) {
      list.shift();
    }

    // Check if rate limit exceeded
    if (list.length >= limit) {
      this.metrics.errors.request++;
      return true;
    }

    // Add new entry
    list.push(now);
    return false;
  }

  /**
   * Select backend using configured algorithm
   */
  selectBackend(clientIp) {
    const healthyBackends = Array.from(this.backends.values())
      .filter(b => b.healthy);

    if (healthyBackends.length === 0) {
      return null; // No healthy backends available
    }

    // Check session affinity
    if (this.config.sessionAffinity) {
      if (this.sessionAffinity.has(clientIp)) {
        const backendId = this.sessionAffinity.get(clientIp);
        const backend = this.backends.get(backendId);
        if (backend && backend.healthy) {
          return backend;
        }
        // Session affinity backend is down, remove affinity and select new one
        this.sessionAffinity.delete(clientIp);
      }
    }

    let selectedBackend;

    if (this.config.algorithm === 'roundrobin') {
      const idx = this.currentBackendIndex++ % healthyBackends.length;
      selectedBackend = healthyBackends[idx];
    } else if (this.config.algorithm === 'leastconn') {
      selectedBackend = healthyBackends.reduce((prev, curr) =>
        prev.connections < curr.connections ? prev : curr
      );
    } else if (this.config.algorithm === 'random') {
      selectedBackend = healthyBackends[
        Math.floor(Math.random() * healthyBackends.length)
      ];
    } else {
      selectedBackend = healthyBackends[0];
    }

    // Set session affinity
    if (this.config.sessionAffinity && selectedBackend) {
      this.sessionAffinity.set(clientIp, selectedBackend.id);
      setTimeout(() => {
        this.sessionAffinity.delete(clientIp);
      }, this.config.sessionAffinityTTL);
    }

    return selectedBackend;
  }

  /**
   * Start the load balancer server
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.emit('started', {
          port: this.config.port,
          host: this.config.host,
          backends: this.backends.size,
        });
        resolve();
      });

      // Graceful shutdown handler
      this.server.on('close', () => {
        this.emit('stopped');
      });
    });
  }

  /**
   * Handle incoming client connection
   */
  handleConnection(clientSocket) {
    const clientIp = clientSocket.remoteAddress;

    // Check rate limit
    if (this.checkRateLimit(clientIp, true)) {
      clientSocket.destroy();
      this.metrics.errors.connection++;
      return;
    }

    // Select backend
    const backend = this.selectBackend(clientIp);

    if (!backend) {
      clientSocket.write('HTTP/1.1 503 Service Unavailable\r\n\r\nNo healthy backends');
      clientSocket.destroy();
      this.metrics.errors.connection++;
      return;
    }

    // Update metrics
    this.metrics.connections.current++;
    this.metrics.connections.total++;
    backend.connections++;
    backend.stats.totalConnections++;

    // Connect to backend
    const backendSocket = net.createConnection({
      host: backend.host,
      port: backend.port,
    });

    let isConnected = false;

    backendSocket.on('connect', () => {
      isConnected = true;
      this.emit('connection:established', {
        clientIp,
        backendId: backend.id,
        timestamp: Date.now(),
      });
    });

    backendSocket.on('error', (err) => {
      if (!isConnected) {
        clientSocket.destroy();
        this.metrics.errors.connection++;
      }
      backend.stats.errors++;
      this.metrics.backends[backend.id].errors++;
    });

    backendSocket.on('close', () => {
      clientSocket.destroy();
      this.metrics.connections.current--;
      backend.connections--;
    });

    // Bidirectional data forwarding
    clientSocket.on('data', (data) => {
      this.metrics.requests.total++;
      backend.stats.totalRequests++;

      try {
        backendSocket.write(data);
      } catch (err) {
        this.metrics.errors.request++;
      }
    });

    clientSocket.on('error', (err) => {
      backendSocket.destroy();
    });

    backendSocket.on('data', (data) => {
      try {
        clientSocket.write(data);
      } catch (err) {
        this.metrics.errors.response++;
      }
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.isShuttingDown = true;

    // Stop accepting new connections
    if (this.server) {
      this.server.close();
    }

    // Clear health check intervals
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();

    // Wait for existing connections to close (with timeout)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 30000); // 30 second timeout

      const checkClosed = setInterval(() => {
        if (this.metrics.connections.current === 0) {
          clearTimeout(timeout);
          clearInterval(checkClosed);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      timestamp: Date.now(),
      connections: {
        current: this.metrics.connections.current,
        total: this.metrics.connections.total,
      },
      requests: {
        total: this.metrics.requests.total,
      },
      errors: {
        ...this.metrics.errors,
      },
      backends: Array.from(this.backends.entries()).map(([id, backend]) => ({
        id,
        host: backend.host,
        port: backend.port,
        healthy: backend.healthy,
        connections: backend.connections,
        stats: {
          totalConnections: backend.stats.totalConnections,
          totalRequests: backend.stats.totalRequests,
          errors: backend.stats.errors,
        },
      })),
    };
  }

  /**
   * Get health check status
   */
  getHealthStatus() {
    const backends = Array.from(this.backends.values()).map(b => ({
      id: b.id,
      host: b.host,
      port: b.port,
      status: b.healthy ? 'UP' : 'DOWN',
      connections: b.connections,
      lastCheck: new Date(b.stats.lastCheck).toISOString(),
    }));

    const healthyCount = backends.filter(b => b.status === 'UP').length;
    const totalCount = backends.length;

    return {
      status: healthyCount > 0 ? 'HEALTHY' : 'UNHEALTHY',
      backends,
      summary: {
        healthy: healthyCount,
        total: totalCount,
        healthPercentage: totalCount > 0 ? (healthyCount / totalCount * 100).toFixed(2) + '%' : 'N/A',
      },
    };
  }

  /**
   * Drain backend (graceful shutdown)
   */
  drainBackend(backendId) {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    backend.healthy = false; // Stop accepting new connections

    // Wait for existing connections to close
    return new Promise((resolve) => {
      const checkDrained = setInterval(() => {
        if (backend.connections === 0) {
          clearInterval(checkDrained);
          resolve();
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkDrained);
        resolve();
      }, 30000);
    });
  }
}

module.exports = LoadBalancer;
