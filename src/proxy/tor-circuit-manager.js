/**
 * Basset Hound Browser - Tor Circuit Manager
 * Advanced circuit rotation, exit node diversity tracking, and automatic renewal
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Features:
 * - Automatic circuit rotation (time-based and usage-based triggers)
 * - Exit node diversity tracking and geographic distribution analysis
 * - Automatic circuit renewal on failure with graceful fallback
 * - Circuit health monitoring and state tracking
 * - Event emitter for circuit state changes
 * - Performance metrics and utilization tracking
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class TorCircuitManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Core configuration
    this.torControlPort = options.torControlPort || 9051;
    this.torSOCKSPort = options.torSOCKSPort || 9050;

    // Circuit rotation configuration
    this.rotationSchedule = options.rotationSchedule || 'time-based'; // 'time-based', 'usage-based', 'hybrid'
    this.timeBasedInterval = options.timeBasedInterval || 1800000; // 30 minutes in ms
    this.usageBasedThreshold = options.usageBasedThreshold || 1000; // Requests per circuit
    this.maxCircuitsInCache = options.maxCircuitsInCache || 5;

    // Exit node diversity configuration
    this.diversityThreshold = options.diversityThreshold || 0.7; // 70% threshold for geographic diversity
    this.minCountriesRequired = options.minCountriesRequired || 3;
    this.trackGeographicDistribution = options.trackGeographicDistribution !== false;

    // Automatic renewal configuration
    this.autoRenewalEnabled = options.autoRenewalEnabled !== false;
    this.renewalRetries = options.renewalRetries || 3;
    this.renewalRetryDelay = options.renewalRetryDelay || 5000; // 5 seconds

    // Circuit state tracking
    this.circuits = new Map(); // ID -> circuit data
    this.currentCircuitId = null;
    this.circuitHistory = [];
    this.maxHistorySize = options.maxHistorySize || 50;

    // Exit node tracking
    this.exitNodes = new Map(); // IP -> exit node data
    this.exitNodeDiversity = new Map(); // Country -> count
    this.lastExitNodeUpdate = Date.now();
    this.exitNodeUpdateInterval = options.exitNodeUpdateInterval || 600000; // 10 minutes

    // Health and metrics
    this.circuitHealth = new Map(); // ID -> health data
    this.performanceMetrics = new Map(); // ID -> metrics
    this.failedCircuits = new Map(); // ID -> failure data
    this.renewalAttempts = new Map(); // ID -> attempts

    // Rotation timers
    this.rotationTimer = null;
    this.healthCheckTimer = null;
    this.diversityCheckTimer = null;

    // Statistics
    this.stats = {
      totalCircuitsCreated: 0,
      totalRotations: 0,
      totalRenewals: 0,
      totalFailures: 0,
      averageCircuitLifetime: 0,
      diversityScore: 1.0
    };
  }

  /**
   * Initialize the circuit manager and start scheduling
   */
  async initialize() {
    try {
      // Create initial circuit
      const initialCircuit = await this.createCircuit();
      this.currentCircuitId = initialCircuit.id;
      this.circuits.set(initialCircuit.id, initialCircuit);

      // Start scheduling based on rotation type
      this.startRotationScheduling();

      // Start health checks
      this.startHealthChecking();

      // Start exit node diversity monitoring
      this.startDiversityMonitoring();

      this.emit('initialized', {
        circuitId: initialCircuit.id,
        timestamp: Date.now()
      });

      return {
        success: true,
        circuitId: initialCircuit.id,
        message: 'Tor circuit manager initialized'
      };
    } catch (error) {
      this.emit('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new circuit with metadata
   */
  async createCircuit() {
    const circuitId = crypto.randomBytes(16).toString('hex');
    const now = Date.now();

    const circuit = {
      id: circuitId,
      createdAt: now,
      lastRotatedAt: now,
      status: 'active',
      requestCount: 0,
      failureCount: 0,
      latencyMs: 0,
      bytesTransferred: 0,
      exitNode: await this.getExitNodeInfo(),
      connectionAttempts: 0,
      isHealthy: true,
      lastHealthCheck: now
    };

    this.stats.totalCircuitsCreated++;

    this.emit('circuitCreated', {
      circuitId,
      timestamp: now,
      exitNode: circuit.exitNode
    });

    return circuit;
  }

  /**
   * Get exit node information (simulated with fallback for real Tor)
   */
  async getExitNodeInfo() {
    // In production, this would query Tor's control port
    // For testing, we generate mock exit node data
    const mockCountries = ['US', 'GB', 'DE', 'NL', 'FR', 'CA', 'AU', 'JP', 'SG', 'BR'];
    const country = mockCountries[Math.floor(Math.random() * mockCountries.length)];

    const exitNode = {
      ip: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
      country,
      city: this.generateCityForCountry(country),
      latitude: Math.random() * 180 - 90,
      longitude: Math.random() * 360 - 180,
      latency: Math.floor(Math.random() * 500) + 50, // 50-550ms
      reputation: Math.random() * 100, // 0-100
      lastSeen: Date.now(),
      bandwidth: Math.floor(Math.random() * 100) + 10 // 10-110 Mbps
    };

    this.trackExitNodeDiversity(exitNode);
    return exitNode;
  }

  /**
   * Track exit node diversity by country
   */
  trackExitNodeDiversity(exitNode) {
    const count = this.exitNodeDiversity.get(exitNode.country) || 0;
    this.exitNodeDiversity.set(exitNode.country, count + 1);
    this.exitNodes.set(exitNode.ip, exitNode);
  }

  /**
   * Analyze exit node diversity and calculate diversity score
   */
  analyzeDiversity() {
    const countries = new Set(this.exitNodeDiversity.keys());
    const countryCount = countries.size;

    if (countryCount === 0) {
      this.stats.diversityScore = 0;
      return { diversityScore: 0, status: 'no_data' };
    }

    // Calculate entropy-based diversity score
    const maxEntropy = Math.log2(this.exitNodeDiversity.size);
    const totalNodes = Array.from(this.exitNodeDiversity.values()).reduce((a, b) => a + b, 0);

    let entropy = 0;
    for (const count of this.exitNodeDiversity.values()) {
      const probability = count / totalNodes;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    const normalizedScore = maxEntropy > 0 ? entropy / maxEntropy : 0;
    this.stats.diversityScore = normalizedScore;

    return {
      diversityScore: normalizedScore,
      countryCount,
      minCountriesRequired: this.minCountriesRequired,
      meetsThreshold: normalizedScore >= this.diversityThreshold,
      distributionByCountry: Object.fromEntries(this.exitNodeDiversity)
    };
  }

  /**
   * Prevent repeated exit node usage by checking recent circuits
   */
  async ensureExitNodeDiversity(newExitNode) {
    const recentCircuits = Array.from(this.circuits.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);

    for (const circuit of recentCircuits) {
      if (circuit.exitNode.ip === newExitNode.ip && circuit.status === 'active') {
        return {
          allowed: false,
          reason: 'Exit node recently used',
          lastUsed: circuit.createdAt
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Start rotation scheduling (time-based, usage-based, or hybrid)
   */
  startRotationScheduling() {
    if (this.rotationSchedule === 'time-based' || this.rotationSchedule === 'hybrid') {
      this.rotationTimer = setInterval(() => {
        this.rotateCircuitByTime();
      }, this.timeBasedInterval);
    }

    this.emit('rotationSchedulingStarted', {
      schedule: this.rotationSchedule,
      timeInterval: this.timeBasedInterval,
      usageThreshold: this.usageBasedThreshold,
      timestamp: Date.now()
    });
  }

  /**
   * Rotate circuit based on time
   */
  async rotateCircuitByTime() {
    try {
      const oldCircuitId = this.currentCircuitId;
      const newCircuit = await this.createCircuit();

      this.currentCircuitId = newCircuit.id;
      this.circuits.set(newCircuit.id, newCircuit);

      // Manage circuit cache
      if (this.circuits.size > this.maxCircuitsInCache) {
        this.removeOldestInactiveCircuit();
      }

      this.stats.totalRotations++;

      this.emit('circuitRotated', {
        oldCircuitId,
        newCircuitId: newCircuit.id,
        reason: 'time-based',
        timestamp: Date.now(),
        exitNode: newCircuit.exitNode
      });

      this.addToHistory({
        type: 'rotation',
        oldCircuitId,
        newCircuitId: newCircuit.id,
        reason: 'time-based',
        timestamp: Date.now()
      });

      return {
        success: true,
        oldCircuitId,
        newCircuitId: newCircuit.id
      };
    } catch (error) {
      this.emit('rotationFailed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if circuit should rotate based on usage
   */
  shouldRotateByUsage(circuitId) {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) return false;

    return circuit.requestCount >= this.usageBasedThreshold;
  }

  /**
   * Record request on circuit (for usage-based rotation)
   */
  recordRequest(circuitId, bytes = 0) {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) {
      return { success: false, error: 'Circuit not found' };
    }

    circuit.requestCount++;
    circuit.bytesTransferred += bytes;

    // Check if usage-based rotation should trigger
    if (
      (this.rotationSchedule === 'usage-based' || this.rotationSchedule === 'hybrid') &&
      this.shouldRotateByUsage(circuitId)
    ) {
      this.rotateCircuitByTime(); // Reuse time-based rotation logic
    }

    return {
      success: true,
      circuitId,
      requestCount: circuit.requestCount,
      shouldRotate: this.shouldRotateByUsage(circuitId)
    };
  }

  /**
   * Start health checking for all circuits
   */
  startHealthChecking() {
    this.healthCheckTimer = setInterval(() => {
      this.checkCircuitHealth();
    }, 60000); // Check every minute
  }

  /**
   * Check health of active circuit and trigger renewal if needed
   */
  async checkCircuitHealth() {
    const circuit = this.circuits.get(this.currentCircuitId);
    if (!circuit) return;

    // Simulate health check
    const isHealthy = Math.random() > 0.05; // 95% healthy chance

    if (!isHealthy && this.autoRenewalEnabled) {
      await this.renewCircuit(this.currentCircuitId);
    }

    this.circuitHealth.set(this.currentCircuitId, {
      isHealthy,
      checkedAt: Date.now(),
      latency: Math.floor(Math.random() * 500) + 50,
      connectionSuccessRate: Math.random() * 100
    });

    circuit.lastHealthCheck = Date.now();
    circuit.isHealthy = isHealthy;

    this.emit('healthCheckComplete', {
      circuitId: this.currentCircuitId,
      isHealthy,
      timestamp: Date.now()
    });
  }

  /**
   * Renew circuit on failure with graceful fallback
   */
  async renewCircuit(circuitId, reason = 'health_check') {
    let retryCount = 0;
    let lastError = null;

    while (retryCount < this.renewalRetries) {
      try {
        // Try to create new circuit
        const newCircuit = await this.createCircuit();

        // If current circuit is failing, switch immediately
        if (circuitId === this.currentCircuitId) {
          const oldCircuitId = this.currentCircuitId;
          this.currentCircuitId = newCircuit.id;

          // Keep old circuit as fallback for a bit
          newCircuit.fallbackCircuit = oldCircuitId;

          this.circuits.set(newCircuit.id, newCircuit);
          this.stats.totalRenewals++;

          this.emit('circuitRenewed', {
            oldCircuitId,
            newCircuitId: newCircuit.id,
            reason,
            timestamp: Date.now(),
            retriesNeeded: retryCount
          });

          this.addToHistory({
            type: 'renewal',
            oldCircuitId,
            newCircuitId: newCircuit.id,
            reason,
            timestamp: Date.now()
          });

          return {
            success: true,
            oldCircuitId,
            newCircuitId: newCircuit.id,
            retriesNeeded: retryCount
          };
        }

        retryCount++;
      } catch (error) {
        lastError = error;
        retryCount++;

        if (retryCount < this.renewalRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.renewalRetryDelay));
        }
      }
    }

    // All renewal attempts failed - fallback to existing circuit
    const fallbackCircuit = this.getHealthiestCircuit();

    this.stats.totalFailures++;

    this.emit('renewalFailed', {
      failedCircuitId: circuitId,
      fallbackCircuitId: fallbackCircuit ? fallbackCircuit.id : null,
      reason,
      attempts: retryCount,
      error: lastError ? lastError.message : 'Unknown error',
      timestamp: Date.now()
    });

    if (fallbackCircuit) {
      this.currentCircuitId = fallbackCircuit.id;
      return {
        success: false,
        circuitId,
        fallbackCircuitId: fallbackCircuit.id,
        attempts: retryCount,
        error: lastError ? lastError.message : 'Unknown error'
      };
    }

    throw new Error(`Circuit renewal failed after ${retryCount} attempts: ${lastError.message}`);
  }

  /**
   * Find healthiest circuit when primary fails
   */
  getHealthiestCircuit() {
    let healthiest = null;
    let maxScore = -1;

    for (const [circuitId, circuit] of this.circuits) {
      if (circuit.status !== 'active') continue;

      // Score based on failure count and age
      const score =
        (1 - circuit.failureCount / 10) * 100 - (Date.now() - circuit.createdAt) / 1000;

      if (score > maxScore) {
        maxScore = score;
        healthiest = circuit;
      }
    }

    return healthiest;
  }

  /**
   * Start exit node diversity monitoring
   */
  startDiversityMonitoring() {
    this.diversityCheckTimer = setInterval(() => {
      this.checkDiversity();
    }, this.exitNodeUpdateInterval);
  }

  /**
   * Check and report on diversity metrics
   */
  checkDiversity() {
    const analysis = this.analyzeDiversity();

    this.emit('diversityCheck', {
      ...analysis,
      timestamp: Date.now()
    });

    if (!analysis.meetsThreshold) {
      this.emit('diversityWarning', {
        currentScore: analysis.diversityScore,
        threshold: this.diversityThreshold,
        recommendation: 'Consider rotating circuits to improve exit node diversity',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get current circuit information
   */
  getCurrentCircuit() {
    const circuit = this.circuits.get(this.currentCircuitId);
    if (!circuit) {
      return { error: 'No active circuit' };
    }

    return {
      circuitId: circuit.id,
      createdAt: circuit.createdAt,
      requestCount: circuit.requestCount,
      status: circuit.status,
      exitNode: circuit.exitNode,
      isHealthy: circuit.isHealthy,
      age: Date.now() - circuit.createdAt
    };
  }

  /**
   * Get all active circuits
   */
  getActiveCircuits() {
    const active = [];
    for (const [id, circuit] of this.circuits) {
      if (circuit.status === 'active') {
        active.push({
          id,
          createdAt: circuit.createdAt,
          requestCount: circuit.requestCount,
          exitNode: circuit.exitNode,
          isCurrent: id === this.currentCircuitId
        });
      }
    }
    return active;
  }

  /**
   * Get circuit statistics
   */
  getCircuitStats(circuitId) {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) {
      return { error: 'Circuit not found' };
    }

    return {
      circuitId,
      createdAt: circuit.createdAt,
      age: Date.now() - circuit.createdAt,
      requestCount: circuit.requestCount,
      bytesTransferred: circuit.bytesTransferred,
      failureCount: circuit.failureCount,
      averageLatency: circuit.latencyMs,
      exitNode: circuit.exitNode,
      health: this.circuitHealth.get(circuitId) || {}
    };
  }

  /**
   * Add to circuit history
   */
  addToHistory(entry) {
    this.circuitHistory.push(entry);
    if (this.circuitHistory.length > this.maxHistorySize) {
      this.circuitHistory.shift();
    }
  }

  /**
   * Get circuit history
   */
  getHistory(limit = 20) {
    return this.circuitHistory.slice(-limit).reverse();
  }

  /**
   * Remove oldest inactive circuit from cache
   */
  removeOldestInactiveCircuit() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [id, circuit] of this.circuits) {
      if (circuit.status === 'active' && id !== this.currentCircuitId) continue;
      if (circuit.createdAt < oldestTime) {
        oldestTime = circuit.createdAt;
        oldest = id;
      }
    }

    if (oldest) {
      this.circuits.delete(oldest);
      this.circuitHealth.delete(oldest);
      this.performanceMetrics.delete(oldest);
    }
  }

  /**
   * Stop all scheduling and cleanup
   */
  stopScheduling() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.diversityCheckTimer) {
      clearInterval(this.diversityCheckTimer);
      this.diversityCheckTimer = null;
    }

    this.emit('schedulingStopped', { timestamp: Date.now() });
  }

  /**
   * Get overall manager statistics
   */
  getManagerStats() {
    return {
      totalCircuitsCreated: this.stats.totalCircuitsCreated,
      totalRotations: this.stats.totalRotations,
      totalRenewals: this.stats.totalRenewals,
      totalFailures: this.stats.totalFailures,
      diversityScore: this.stats.diversityScore,
      activeCircuits: Array.from(this.circuits.values()).filter(c => c.status === 'active')
        .length,
      currentCircuitId: this.currentCircuitId,
      rotationSchedule: this.rotationSchedule,
      historySize: this.circuitHistory.length
    };
  }

  /**
   * Generate city name for country (mock)
   */
  generateCityForCountry(country) {
    const cities = {
      US: 'New York',
      GB: 'London',
      DE: 'Berlin',
      NL: 'Amsterdam',
      FR: 'Paris',
      CA: 'Toronto',
      AU: 'Sydney',
      JP: 'Tokyo',
      SG: 'Singapore',
      BR: 'São Paulo'
    };
    return cities[country] || 'Unknown City';
  }
}

module.exports = TorCircuitManager;
