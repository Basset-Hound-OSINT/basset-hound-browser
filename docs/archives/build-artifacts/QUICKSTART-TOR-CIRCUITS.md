# Quick Start: Tor Circuit Manager

**Status:** ✅ Ready to use  
**Latest Version:** 1.0.0  
**Location:** `src/proxy/tor-circuit-manager.js`

## 60-Second Overview

The Tor Circuit Manager automatically:
1. **Rotates circuits** on a schedule (time or usage-based)
2. **Tracks exit nodes** geographically for diversity
3. **Renews circuits** when they fail with smart fallback

## Installation

Already included in the codebase. No additional packages needed.

## Basic Usage

```javascript
const TorCircuitManager = require('./src/proxy/tor-circuit-manager');

// Create manager
const manager = new TorCircuitManager();

// Initialize
await manager.initialize();

// Get current circuit
const circuit = manager.getCurrentCircuit();
console.log(`Using exit node: ${circuit.exitNode.country}`);

// Clean up
manager.stopScheduling();
```

## Configuration Examples

### Stealth Mode (Aggressive Rotation)
```javascript
new TorCircuitManager({
  rotationSchedule: 'hybrid',
  timeBasedInterval: 900000,      // 15 minutes
  usageBasedThreshold: 500,       // 500 requests
  diversityThreshold: 0.8         // Strict
})
```

### Performance Mode (Minimal Overhead)
```javascript
new TorCircuitManager({
  rotationSchedule: 'usage-based',
  usageBasedThreshold: 2000,      // 2000 requests
  diversityThreshold: 0.5         // Relaxed
})
```

### Reliability Mode (Maximum Resilience)
```javascript
new TorCircuitManager({
  rotationSchedule: 'time-based',
  timeBasedInterval: 3600000,     // 1 hour
  renewalRetries: 5,              // More retries
  autoRenewalEnabled: true
})
```

## Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `initialize()` | Start manager | `{ success, circuitId }` |
| `getCurrentCircuit()` | Get active circuit | `{ circuitId, exitNode, ... }` |
| `rotateCircuitByTime()` | Force rotation | `{ success, newCircuitId }` |
| `recordRequest(id, bytes)` | Track usage | `{ success, shouldRotate }` |
| `analyzeDiversity()` | Check diversity | `{ score, countries, ... }` |
| `renewCircuit(id)` | Renew on failure | `{ success, newCircuitId }` |
| `getManagerStats()` | Get metrics | `{ created, rotated, ... }` |
| `stopScheduling()` | Clean up | Returns `void` |

## Event Listening

```javascript
// Circuit events
manager.on('circuitCreated', (data) => {
  console.log(`New circuit: ${data.circuitId}`);
});

manager.on('circuitRotated', (data) => {
  console.log(`Rotated to: ${data.newCircuitId}`);
});

manager.on('circuitRenewed', (data) => {
  console.log(`Renewed after failure`);
});

// Health events
manager.on('healthCheckComplete', (data) => {
  console.log(`Circuit health: ${data.isHealthy}`);
});

// Diversity events
manager.on('diversityWarning', (data) => {
  console.log(`Low diversity: ${data.currentScore.toFixed(3)}`);
});
```

## Integration with Proxy Manager

```javascript
const circuitManager = new TorCircuitManager();
await circuitManager.initialize();

// Listen for rotations
circuitManager.on('circuitRotated', (data) => {
  // Update proxy configuration
  const exitNode = data.exitNode;
  proxyManager.updateTorProxy({
    host: exitNode.ip,
    port: 9050,
    country: exitNode.country
  });
});
```

## Monitoring

```javascript
// Get stats
const stats = manager.getManagerStats();
console.log(`Rotations: ${stats.totalRotations}`);
console.log(`Renewals: ${stats.totalRenewals}`);
console.log(`Diversity: ${stats.diversityScore.toFixed(3)}`);

// Get history
const history = manager.getHistory(10);  // Last 10 events
history.forEach(event => {
  console.log(`${event.type}: ${event.reason} at ${event.timestamp}`);
});
```

## Common Patterns

### Track Request Usage
```javascript
async function makeRequest(url) {
  const circuitId = manager.currentCircuitId;
  
  try {
    const response = await fetch(url);
    manager.recordRequest(circuitId, response.size);
    return response;
  } catch (error) {
    // Trigger renewal on failure
    await manager.renewCircuit(circuitId, 'request_failed');
    throw error;
  }
}
```

### Check Diversity Regularly
```javascript
setInterval(() => {
  const analysis = manager.analyzeDiversity();
  if (!analysis.meetsThreshold) {
    console.warn(`Diversity below threshold: ${analysis.diversityScore}`);
  }
}, 600000); // Every 10 minutes
```

### Log All Events
```javascript
const events = ['circuitCreated', 'circuitRotated', 'circuitRenewed', 
                'healthCheckComplete', 'diversityWarning'];

events.forEach(event => {
  manager.on(event, (data) => {
    console.log(`[${new Date().toISOString()}] ${event}:`, data);
  });
});
```

## Troubleshooting

### Circuits Not Rotating
- Check `rotationSchedule` configuration
- Verify timers are running (check for errors in events)
- Ensure usage threshold is being reached for usage-based rotation

### Low Diversity Score
- Create more circuits (increase activity)
- Check if all circuits using same exit node
- Rotate manually: `await manager.rotateCircuitByTime()`

### Renewal Failures
- Check internet connection
- Increase `renewalRetries` option
- Check logs for detailed error messages
- Verify fallback circuits available

### High Memory Usage
- Reduce `maxCircuitsInCache` option
- Monitor circuit creation rate
- Clear unused circuits more aggressively

## Testing

Run tests:
```bash
npm test -- tests/proxy/tor-circuits.test.js
```

All 25 tests should pass:
- 6 rotation tests
- 6 diversity tests
- 5 renewal tests
- 8 integration tests

## Documentation

- **Full API Reference:** `docs/TOR-CIRCUIT-MANAGEMENT.md`
- **Integration Examples:** `docs/TOR-CIRCUIT-INTEGRATION-EXAMPLES.md`
- **Completion Report:** `docs/TASK-2.4-COMPLETION-REPORT.md`

## Version History

- **v1.0.0** (June 14, 2026)
  - Initial release
  - All 3 features complete
  - 25 passing tests
  - Production ready

## Support

For detailed information, see:
- `/docs/TOR-CIRCUIT-MANAGEMENT.md` - Complete reference
- `/docs/TOR-CIRCUIT-INTEGRATION-EXAMPLES.md` - Real-world examples
- `/tests/proxy/tor-circuits.test.js` - Test examples

---

**Ready to use!** Start with the basic example above and refer to full documentation for advanced features.
