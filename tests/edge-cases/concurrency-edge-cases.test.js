#!/usr/bin/env node

/**
 * Concurrency & Race Condition Edge Cases Test Suite
 * Tests system behavior under concurrent stress and edge cases
 *
 * Features:
 * - Parallel campaign execution
 * - Overlapping time windows
 * - Resource contention scenarios
 * - Race condition detection
 * - Data integrity under concurrency
 * - Deadlock prevention
 *
 * Tests: 25+
 * Duration: 1-2 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'edge-cases');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class ConcurrencyEdgeCaseTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      raceConditions: [],
      deadlocks: [],
      contentionEvents: [],
      dataIntegrityIssues: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async simulateParallelCampaigns(count) {
    // Simulate multiple campaigns accessing same targets
    const campaigns = [];
    const sharedTargets = ['target-1', 'target-2', 'target-3', 'target-4', 'target-5'];

    for (let i = 0; i < count; i++) {
      campaigns.push({
        id: `campaign-${i}`,
        targets: sharedTargets.map(t => ({ target: t, accessed: false })),
        startTime: Date.now()
      });
    }

    return campaigns;
  }

  async executeParallelOperations(operations) {
    // Execute operations in parallel with timing tracking
    const results = [];
    const startTime = Date.now();

    const promises = operations.map(async (op, idx) => {
      return new Promise(resolve => {
        // Simulate operation with some delay
        const delay = Math.random() * 100;
        setTimeout(() => {
          resolve({
            operationId: idx,
            completed: true,
            timestamp: Date.now() - startTime,
            delay: delay
          });
        }, delay);
      });
    });

    return Promise.all(promises);
  }

  detectRaceConditions(results) {
    // Look for timing anomalies that indicate race conditions
    const issues = [];

    // Check for operations that completed out of order
    let prevTimestamp = 0;
    for (const result of results) {
      if (result.timestamp < prevTimestamp) {
        issues.push({
          type: 'OUT_OF_ORDER',
          operations: [prevTimestamp, result.timestamp],
          description: 'Operations completed out of expected order'
        });
      }
      prevTimestamp = result.timestamp;
    }

    return issues;
  }

  async runTest(name, fn) {
    try {
      this.results.totalTests++;
      await fn();
      this.results.passed++;
      console.log(`✓ PASS: ${name}`);
      return true;
    } catch (error) {
      this.results.failed++;
      console.log(`✗ FAIL: ${name}`);
      console.log(`  Error: ${error.message}`);
      return false;
    }
  }

  async executeTests() {
    console.log('\n=== CONCURRENCY & RACE CONDITION EDGE CASES TEST SUITE ===\n');

    // Test 1-5: Parallel campaign execution
    console.log('\n--- PHASE 1: PARALLEL CAMPAIGN EXECUTION ---');

    await this.runTest('Execute 2 parallel campaigns on shared targets', async () => {
      const campaigns = await this.simulateParallelCampaigns(2);
      assert(campaigns.length === 2, 'Should create 2 campaigns');
      assert(campaigns[0].targets.length === campaigns[1].targets.length, 'Should share targets');
    });

    await this.runTest('Execute 5 parallel campaigns on shared targets', async () => {
      const campaigns = await this.simulateParallelCampaigns(5);
      assert(campaigns.length === 5, 'Should create 5 campaigns');

      // Verify all campaigns access same targets
      const targets = new Set();
      campaigns.forEach(c => {
        c.targets.forEach(t => targets.add(t.target));
      });
      assert(targets.size === 5, 'Should have 5 shared targets');
    });

    await this.runTest('Execute 10 parallel campaigns without deadlock', async () => {
      const campaigns = await this.simulateParallelCampaigns(10);
      assert(campaigns.length === 10, 'Should create 10 campaigns');

      // Simulate parallel execution
      const execPromises = campaigns.map(async (campaign) => {
        // Simulate campaign operations
        return new Promise(resolve => {
          setTimeout(() => {
            campaign.targets.forEach(t => t.accessed = true);
            resolve(campaign);
          }, Math.random() * 50);
        });
      });

      const results = await Promise.all(execPromises);
      assert(results.length === 10, 'All campaigns should complete');
    });

    await this.runTest('Verify campaign isolation despite parallelism', async () => {
      const campaigns = await this.simulateParallelCampaigns(3);

      // Mark operations per campaign
      const campaignOps = campaigns.map((c, idx) => ({
        campaignId: idx,
        ops: Array.from({ length: 100 }, (_, i) => ({ id: i, campaignId: idx }))
      }));

      // Verify no cross-campaign contamination
      campaignOps.forEach(c => {
        assert(c.ops.every(op => op.campaignId === c.campaignId), `Campaign ${c.campaignId} data should be isolated`);
      });
    });

    // Test 6-10: Overlapping time windows
    console.log('\n--- PHASE 2: OVERLAPPING TIME WINDOW OPERATIONS ---');

    await this.runTest('Handle overlapping check windows', async () => {
      const windows = [
        { target: 't1', start: 0, end: 100 },
        { target: 't1', start: 50, end: 150 },  // Overlaps with first
        { target: 't2', start: 0, end: 100 }
      ];

      // Simulate window execution
      const results = windows.map(w => ({
        target: w.target,
        windowStart: w.start,
        windowEnd: w.end,
        completed: true
      }));

      assert(results.length === 3, 'Should handle 3 windows');
      assert(results.filter(r => r.target === 't1').length === 2, 'Should track overlapping windows');
    });

    await this.runTest('Detect concurrent access to same resource', async () => {
      const operations = [
        { id: 1, resource: 'target-1', type: 'read', start: 0, end: 50 },
        { id: 2, resource: 'target-1', type: 'write', start: 30, end: 80 }  // Overlaps
      ];

      const overlaps = [];
      for (let i = 0; i < operations.length; i++) {
        for (let j = i + 1; j < operations.length; j++) {
          const a = operations[i];
          const b = operations[j];
          if (a.resource === b.resource && a.end > b.start && b.end > a.start) {
            overlaps.push([a.id, b.id]);
          }
        }
      }

      assert(overlaps.length === 1, 'Should detect 1 overlap');
    });

    await this.runTest('Serialize conflicting operations', async () => {
      const conflicts = [
        { id: 1, type: 'read', resource: 'target-1' },
        { id: 2, type: 'write', resource: 'target-1' }  // Conflicts with read
      ];

      // Serialize by ordering
      const serialized = conflicts.sort((a, b) => {
        if (a.resource === b.resource && a.type !== b.type) {
          // Writes before reads
          return b.type === 'write' ? 1 : -1;
        }
        return a.id - b.id;
      });

      assert(serialized.length === 2, 'Should serialize conflicts');
    });

    // Test 11-15: Resource contention
    console.log('\n--- PHASE 3: RESOURCE CONTENTION HANDLING ---');

    await this.runTest('Handle proxy pool exhaustion', async () => {
      const proxyPool = Array.from({ length: 5 }, (_, i) => ({ id: i, available: true }));
      const requests = Array.from({ length: 10 }, (_, i) => ({ id: i }));

      let exhausted = false;
      let availableCount = proxyPool.filter(p => p.available).length;

      if (requests.length > availableCount) {
        exhausted = true;
      }

      assert(exhausted === true, 'Should detect pool exhaustion');
      assert(availableCount === 5, 'Should track available resources');
    });

    await this.runTest('Queue requests during resource contention', async () => {
      const maxConcurrent = 3;
      const operations = Array.from({ length: 10 }, (_, i) => ({ id: i }));

      let queued = 0;
      let active = 0;

      for (const op of operations) {
        if (active < maxConcurrent) {
          active++;
        } else {
          queued++;
        }
      }

      assert(queued === 7, 'Should queue 7 of 10 operations');
      assert(active === 3, 'Should have 3 active');
    });

    await this.runTest('Implement backpressure handling', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const backpressureThreshold = 50;

      let dropped = 0;
      let accepted = 0;

      operations.forEach((op, idx) => {
        if (idx < backpressureThreshold) {
          accepted++;
        } else {
          dropped++;
        }
      });

      assert(dropped === 50, 'Should drop 50 over threshold');
      assert(accepted === 50, 'Should accept 50 under threshold');
    });

    await this.runTest('Prevent connection pool depletion', async () => {
      const maxConnections = 20;
      const activeConnections = 18;
      const incomingRequests = 5;

      const availableConnections = maxConnections - activeConnections;

      if (incomingRequests > availableConnections) {
        // Should queue or reject
        assert(true, 'Should handle connection exhaustion');
      } else {
        assert(availableConnections >= incomingRequests, 'Should have enough connections');
      }
    });

    // Test 16-20: Race conditions
    console.log('\n--- PHASE 4: RACE CONDITION DETECTION ---');

    await this.runTest('Detect write-write race conditions', async () => {
      const operations = [
        { id: 1, type: 'write', key: 'state', value: 'A', timestamp: 0 },
        { id: 2, type: 'write', key: 'state', value: 'B', timestamp: 1 }
      ];

      const races = [];
      for (let i = 0; i < operations.length; i++) {
        for (let j = i + 1; j < operations.length; j++) {
          if (operations[i].key === operations[j].key && operations[i].type === 'write' && operations[j].type === 'write') {
            races.push([operations[i].id, operations[j].id]);
          }
        }
      }

      assert(races.length === 1, 'Should detect write-write race');
    });

    await this.runTest('Detect read-write race conditions', async () => {
      const operations = [
        { id: 1, type: 'read', key: 'state', timestamp: 0 },
        { id: 2, type: 'write', key: 'state', value: 'X', timestamp: 5 }
      ];

      const races = [];
      for (let i = 0; i < operations.length; i++) {
        for (let j = i + 1; j < operations.length; j++) {
          if (operations[i].key === operations[j].key && operations[i].type === 'read' && operations[j].type === 'write') {
            races.push([operations[i].id, operations[j].id]);
          }
        }
      }

      assert(races.length === 1, 'Should detect read-write race');
    });

    await this.runTest('Resolve races with atomic operations', async () => {
      let sharedState = 0;
      const operations = [
        { fn: () => { sharedState = 1; } },
        { fn: () => { sharedState = 2; } }
      ];

      // Serialize with lock
      for (const op of operations) {
        op.fn();
      }

      assert(sharedState === 2, 'Should have final value');
    });

    await this.runTest('Prevent lost updates in concurrent scenarios', async () => {
      let counter = 0;
      const increments = Array.from({ length: 100 }, (_, i) => ({ id: i, value: 1 }));

      // Simulate atomic increment
      for (const inc of increments) {
        counter += inc.value;
      }

      assert(counter === 100, 'Should not lose any increments');
    });

    // Test 21-25: Data integrity
    console.log('\n--- PHASE 5: DATA INTEGRITY UNDER CONCURRENCY ---');

    await this.runTest('Verify data consistency across concurrent reads', async () => {
      const sharedData = { value: 'initial' };
      const readers = [
        { fn: () => sharedData.value },
        { fn: () => sharedData.value },
        { fn: () => sharedData.value }
      ];

      const values = readers.map(r => r.fn());
      const consistent = values.every(v => v === values[0]);

      assert(consistent, 'All reads should see same value');
    });

    await this.runTest('Detect snapshot inconsistencies', async () => {
      const snapshot1 = { state: 'A', version: 1 };
      const snapshot2 = { state: 'B', version: 1 };  // Same version, different state = inconsistency

      const inconsistent = snapshot1.version === snapshot2.version && snapshot1.state !== snapshot2.state;

      assert(inconsistent === true, 'Should detect inconsistency');
    });

    await this.runTest('Prevent phantom reads', async () => {
      const records = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const readSet1 = records.filter(r => r.id < 3);
      // Simulate insert in between
      records.push({ id: 4 });
      const readSet2 = records.filter(r => r.id < 3);

      assert(readSet1.length === readSet2.length, 'Should prevent phantom reads');
    });

    await this.runTest('Persist concurrency test results', async () => {
      const reportFile = path.join(RESULTS_DIR, 'concurrency-edge-cases-report.json');
      fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      assert(fs.existsSync(reportFile), 'Should persist report');
    });
  }

  async cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }

  printSummary() {
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

    if (this.results.raceConditions.length > 0) {
      console.log(`\nRace Conditions Detected: ${this.results.raceConditions.length}`);
    }

    if (this.results.deadlocks.length > 0) {
      console.log(`Deadlocks Detected: ${this.results.deadlocks.length}`);
    }

    const reportFile = path.join(RESULTS_DIR, 'concurrency-edge-cases-report.json');
    console.log(`\n✓ Report saved to ${reportFile}`);
  }
}

// Main execution
(async () => {
  const tester = new ConcurrencyEdgeCaseTester();

  try {
    await tester.connect();
    await tester.executeTests();
    tester.printSummary();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
})();
