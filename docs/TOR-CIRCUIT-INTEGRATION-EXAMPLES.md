# Tor Circuit Manager - Integration Examples

**Version:** 1.0.0  
**Date:** June 14, 2026

This document provides practical integration examples for using the Tor Circuit Manager in Basset Hound Browser.

## Basic Usage Example

### Initialize and Start Managing Circuits

```javascript
const TorCircuitManager = require('./src/proxy/tor-circuit-manager');

// Create manager with hybrid rotation
const circuitManager = new TorCircuitManager({
  rotationSchedule: 'hybrid',
  timeBasedInterval: 1800000,      // 30 minutes
  usageBasedThreshold: 1000,       // 1000 requests per circuit
  diversityThreshold: 0.7,         // 70% diversity requirement
  autoRenewalEnabled: true,
  renewalRetries: 3
});

// Initialize and get first circuit
await circuitManager.initialize();
console.log('Circuit manager ready');

// Listen for events
circuitManager.on('circuitRotated', (data) => {
  console.log(`Circuit rotated: ${data.oldCircuitId} -> ${data.newCircuitId}`);
  console.log(`Exit node: ${data.exitNode.country} (${data.exitNode.ip})`);
});

circuitManager.on('diversityWarning', (data) => {
  console.log(`Diversity warning: ${data.currentScore.toFixed(3)} < ${data.threshold}`);
});
```

---

## Integration with WebSocket Server

### Use Circuit Manager in WebSocket API

```javascript
// In your WebSocket server (websocket/server.js)
const TorCircuitManager = require('../src/proxy/tor-circuit-manager');

class WebSocketServer {
  constructor() {
    this.circuitManager = null;
  }

  async initialize() {
    // Initialize circuit manager
    this.circuitManager = new TorCircuitManager({
      rotationSchedule: 'time-based',
      timeBasedInterval: 1800000
    });

    await this.circuitManager.initialize();

    // Handle circuit rotation events
    this.circuitManager.on('circuitRotated', (data) => {
      this.broadcastToClients('circuitChanged', {
        newCircuitId: data.newCircuitId,
        exitNode: data.exitNode
      });
    });
  }

  // Add WebSocket command to get current circuit
  handleGetCircuitCommand(ws, message) {
    const current = this.circuitManager.getCurrentCircuit();
    ws.send(JSON.stringify({
      command: 'getCircuit',
      circuitId: current.circuitId,
      exitNode: current.exitNode,
      requestCount: current.requestCount,
      age: current.age
    }));
  }

  // Add WebSocket command to rotate manually
  async handleRotateCircuitCommand(ws, message) {
    const result = await this.circuitManager.rotateCircuitByTime();
    ws.send(JSON.stringify({
      command: 'rotateCircuit',
      success: result.success,
      newCircuitId: result.newCircuitId
    }));
  }

  // Add WebSocket command for diversity analysis
  handleGetDiversityCommand(ws, message) {
    const analysis = this.circuitManager.analyzeDiversity();
    ws.send(JSON.stringify({
      command: 'getDiversity',
      diversityScore: analysis.diversityScore,
      countryCount: analysis.countryCount,
      meetsThreshold: analysis.meetsThreshold,
      distribution: analysis.distributionByCountry
    }));
  }
}
```

---

## Integration with Proxy Manager

### Use Circuit Manager with Residential Proxy Manager

```javascript
const ResidentialProxyManager = require('./residential-proxy-manager');
const TorCircuitManager = require('./tor-circuit-manager');

class ProxyCoordinator {
  constructor() {
    this.residentialProxies = new ResidentialProxyManager();
    this.torCircuits = new TorCircuitManager({
      rotationSchedule: 'hybrid',
      maxCircuitsInCache: 5
    });
  }

  async initialize() {
    await this.torCircuits.initialize();

    // Setup rotation event to update proxy pool
    this.torCircuits.on('circuitRotated', (data) => {
      this.updateTorProxy(data.exitNode);
    });
  }

  updateTorProxy(exitNode) {
    // Remove old Tor proxy from pool
    const oldTorProxies = this.residentialProxies.proxyPool.filter(p => 
      p.type === 'tor' && p.source === 'tor-circuit-manager'
    );

    for (const proxy of oldTorProxies) {
      this.residentialProxies.removeProxy(proxy.id);
    }

    // Add new Tor proxy
    this.residentialProxies.addProxy({
      host: exitNode.ip,
      port: 9050,
      type: 'socks5',
      source: 'tor-circuit-manager',
      country: exitNode.country,
      reputation: exitNode.reputation
    });
  }

  // Get next proxy (will include Tor circuits)
  getNextProxy() {
    return this.residentialProxies.getNextProxy();
  }

  // Get proxy statistics including circuits
  getStats() {
    return {
      residentialProxies: this.residentialProxies.getPoolStats(),
      torCircuits: this.torCircuits.getManagerStats()
    };
  }
}
```

---

## Advanced Usage: Request Tracking

### Track Usage and Trigger Rotation

```javascript
const TorCircuitManager = require('./tor-circuit-manager');

class BrowserSession {
  constructor() {
    this.circuitManager = new TorCircuitManager({
      rotationSchedule: 'usage-based',
      usageBasedThreshold: 500     // Rotate after 500 requests
    });
  }

  async initialize() {
    await this.circuitManager.initialize();
  }

  async performRequest(url, options = {}) {
    const circuitId = this.circuitManager.currentCircuitId;

    try {
      // Make request (assume this is implemented)
      const response = await this.makeHTTPRequest(url, options);

      // Track usage (important for usage-based rotation)
      const bytesTransferred = response.headers['content-length'] || 0;
      this.circuitManager.recordRequest(circuitId, bytesTransferred);

      return response;
    } catch (error) {
      // On failure, trigger renewal
      console.error(`Request failed on circuit ${circuitId}:`, error.message);
      
      const renewal = await this.circuitManager.renewCircuit(
        circuitId,
        `request_failure: ${error.message}`
      );

      if (renewal.success) {
        console.log(`Circuit renewed to ${renewal.newCircuitId}`);
        // Retry request with new circuit
        return this.performRequest(url, options);
      } else {
        throw new Error('Circuit renewal failed');
      }
    }
  }

  getSessionStats() {
    const current = this.circuitManager.getCurrentCircuit();
    return {
      circuitId: current.circuitId,
      requestCount: current.requestCount,
      exitNode: current.exitNode,
      age: current.age,
      health: current.isHealthy ? 'healthy' : 'unhealthy'
    };
  }
}

// Usage
const session = new BrowserSession();
await session.initialize();

const response = await session.performRequest('https://api.example.com/data');
console.log(session.getSessionStats());
```

---

## Monitoring and Logging

### Setup Comprehensive Event Logging

```javascript
const TorCircuitManager = require('./tor-circuit-manager');
const fs = require('fs');

class CircuitMonitor {
  constructor(logPath = './logs/circuits.log') {
    this.manager = new TorCircuitManager();
    this.logPath = logPath;
  }

  async initialize() {
    await this.manager.initialize();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Log circuit events
    this.manager.on('circuitCreated', (data) => {
      this.log('CIRCUIT_CREATED', data);
    });

    this.manager.on('circuitRotated', (data) => {
      this.log('CIRCUIT_ROTATED', {
        old: data.oldCircuitId.substring(0, 8),
        new: data.newCircuitId.substring(0, 8),
        exitCountry: data.exitNode.country,
        reason: data.reason
      });
    });

    this.manager.on('circuitRenewed', (data) => {
      this.log('CIRCUIT_RENEWED', {
        failed: data.oldCircuitId.substring(0, 8),
        new: data.newCircuitId.substring(0, 8),
        reason: data.reason,
        retriesNeeded: data.retriesNeeded
      });
    });

    // Log health events
    this.manager.on('healthCheckComplete', (data) => {
      this.log('HEALTH_CHECK', {
        circuitId: data.circuitId.substring(0, 8),
        healthy: data.isHealthy
      });
    });

    // Log diversity events
    this.manager.on('diversityCheck', (data) => {
      this.log('DIVERSITY_CHECK', {
        score: data.diversityScore.toFixed(3),
        countries: data.countryCount,
        meetsThreshold: data.meetsThreshold
      });
    });

    this.manager.on('diversityWarning', (data) => {
      this.log('DIVERSITY_WARNING', {
        currentScore: data.currentScore.toFixed(3),
        threshold: data.threshold,
        recommendation: data.recommendation
      });
    });

    // Log errors
    this.manager.on('error', (data) => {
      this.log('ERROR', data);
    });
  }

  log(event, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      data
    };

    console.log(`[${timestamp}] ${event}:`, JSON.stringify(data, null, 2));

    // Write to file
    fs.appendFileSync(
      this.logPath,
      JSON.stringify(logEntry) + '\n'
    );
  }

  getStats() {
    return this.manager.getManagerStats();
  }

  printReport() {
    const stats = this.getStats();
    const diversity = this.manager.analyzeDiversity();

    console.log('\n=== Tor Circuit Manager Report ===');
    console.log(`Total Circuits Created: ${stats.totalCircuitsCreated}`);
    console.log(`Total Rotations: ${stats.totalRotations}`);
    console.log(`Total Renewals: ${stats.totalRenewals}`);
    console.log(`Total Failures: ${stats.totalFailures}`);
    console.log(`Active Circuits: ${stats.activeCircuits}`);
    console.log(`Diversity Score: ${diversity.diversityScore.toFixed(3)}`);
    console.log(`Unique Countries: ${diversity.countryCount}`);
    console.log('\nDistribution by Country:');
    for (const [country, count] of Object.entries(diversity.distributionByCountry)) {
      console.log(`  ${country}: ${count}`);
    }
    console.log('=================================\n');
  }
}

// Usage
const monitor = new CircuitMonitor();
await monitor.initialize();

// Periodic reporting
setInterval(() => {
  monitor.printReport();
}, 3600000); // Every hour
```

---

## Multi-Session Management

### Manage Multiple Concurrent Sessions with Different Circuits

```javascript
const TorCircuitManager = require('./tor-circuit-manager');

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  async createSession(sessionId, options = {}) {
    const circuitManager = new TorCircuitManager(options);
    await circuitManager.initialize();

    const session = {
      id: sessionId,
      circuitManager,
      createdAt: Date.now(),
      requestCount: 0,
      bytesTransferred: 0
    };

    this.sessions.set(sessionId, session);

    return {
      sessionId,
      circuitId: circuitManager.currentCircuitId,
      exitNode: circuitManager.getCurrentCircuit().exitNode
    };
  }

  async performRequest(sessionId, url, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const circuitId = session.circuitManager.currentCircuitId;

    try {
      // Make request
      const response = await this.makeRequest(url, options);

      // Track usage
      session.requestCount++;
      session.bytesTransferred += response.size || 0;

      session.circuitManager.recordRequest(circuitId, response.size || 0);

      return response;
    } catch (error) {
      console.error(`Request failed in session ${sessionId}`);
      
      // Attempt renewal
      const renewal = await session.circuitManager.renewCircuit(
        circuitId,
        'request_failure'
      );

      if (renewal.success) {
        // Retry
        return this.performRequest(sessionId, url, options);
      }

      throw error;
    }
  }

  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const current = session.circuitManager.getCurrentCircuit();
    const stats = session.circuitManager.getManagerStats();

    return {
      sessionId,
      circuitId: current.circuitId,
      requestCount: session.requestCount,
      bytesTransferred: session.bytesTransferred,
      exitNode: current.exitNode,
      rotations: stats.totalRotations,
      renewals: stats.totalRenewals
    };
  }

  getAllStats() {
    const stats = [];
    for (const [sessionId, session] of this.sessions) {
      stats.push(this.getSessionStats(sessionId));
    }
    return stats;
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.circuitManager.stopScheduling();
    this.sessions.delete(sessionId);
  }
}

// Usage
const manager = new SessionManager();

// Create multiple sessions with different strategies
const session1 = await manager.createSession('user-1', {
  rotationSchedule: 'time-based',
  timeBasedInterval: 900000      // 15 minutes
});

const session2 = await manager.createSession('user-2', {
  rotationSchedule: 'usage-based',
  usageBasedThreshold: 500        // Rotate frequently
});

// Use sessions
await manager.performRequest('user-1', 'https://api.example.com');
await manager.performRequest('user-2', 'https://api.example.com');

// Get stats
console.log(manager.getAllStats());
```

---

## Testing and Validation

### Validate Circuit Manager Setup

```javascript
const TorCircuitManager = require('./tor-circuit-manager');

async function validateSetup() {
  console.log('Validating Tor Circuit Manager setup...\n');

  const manager = new TorCircuitManager({
    rotationSchedule: 'hybrid',
    timeBasedInterval: 100,
    usageBasedThreshold: 5
  });

  // Test 1: Initialization
  try {
    await manager.initialize();
    console.log('✓ Initialization successful');
  } catch (error) {
    console.error('✗ Initialization failed:', error.message);
    return false;
  }

  // Test 2: Circuit creation
  const current = manager.getCurrentCircuit();
  if (current.circuitId && current.exitNode) {
    console.log('✓ Circuit created with exit node');
  } else {
    console.error('✗ Circuit creation failed');
    return false;
  }

  // Test 3: Rotation
  try {
    const result = await manager.rotateCircuitByTime();
    if (result.success) {
      console.log('✓ Circuit rotation works');
    } else {
      console.error('✗ Circuit rotation failed');
      return false;
    }
  } catch (error) {
    console.error('✗ Rotation error:', error.message);
    return false;
  }

  // Test 4: Diversity analysis
  const diversity = manager.analyzeDiversity();
  if (diversity.diversityScore !== undefined) {
    console.log(`✓ Diversity analysis works (score: ${diversity.diversityScore.toFixed(3)})`);
  } else {
    console.error('✗ Diversity analysis failed');
    return false;
  }

  // Test 5: Request tracking
  const tracked = manager.recordRequest(current.circuitId, 1024);
  if (tracked.success) {
    console.log('✓ Request tracking works');
  } else {
    console.error('✗ Request tracking failed');
    return false;
  }

  // Test 6: Health check
  await manager.checkCircuitHealth();
  const stats = manager.getCircuitStats(current.circuitId);
  if (stats.health) {
    console.log('✓ Health checking works');
  } else {
    console.error('✗ Health checking failed');
    return false;
  }

  // Cleanup
  manager.stopScheduling();

  console.log('\n✓ All validation tests passed!');
  return true;
}

// Run validation
validateSetup().then(success => {
  process.exit(success ? 0 : 1);
});
```

---

## Performance Tips

1. **Adjust rotation intervals based on use case:**
   - Stealth: 15 minutes, 500 requests
   - Performance: 1 hour, 2000 requests
   - Balanced: 30 minutes, 1000 requests

2. **Manage circuit cache size:**
   - Limit to 3-5 for memory-constrained environments
   - Use 10+ for high-traffic scenarios

3. **Monitor diversity regularly:**
   - Check every 10 minutes in high-security scenarios
   - Adjust threshold based on geographic requirements

4. **Setup comprehensive logging:**
   - Log all state changes for debugging
   - Archive logs periodically
   - Monitor for diversity warnings

5. **Test renewal logic:**
   - Simulate circuit failures
   - Verify fallback mechanisms
   - Monitor renewal success rates

---

## Troubleshooting

### Circuits Not Rotating
- Check rotation schedule configuration
- Verify timers are started
- Monitor system time changes

### Low Diversity Score
- Create more circuits (increase cache size)
- Check exit node distribution
- Consider geographic restrictions

### Renewal Failures
- Increase renewal retry attempts
- Reduce retry delay
- Check error logs for root cause
- Verify fallback circuits available

### High Memory Usage
- Reduce max circuits in cache
- Clean up old circuits more aggressively
- Monitor circuit creation rate

---

## Summary

These examples demonstrate how to effectively integrate the Tor Circuit Manager into your Basset Hound Browser applications. Key integration points:

1. WebSocket server commands
2. Proxy manager coordination
3. Request tracking and usage
4. Event monitoring and logging
5. Multi-session management
6. Validation and testing

For more details, see the main documentation: `/docs/TOR-CIRCUIT-MANAGEMENT.md`
