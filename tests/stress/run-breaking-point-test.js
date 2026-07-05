#!/usr/bin/env node

/**
 * Breaking Point Test Runner - Direct Execution
 *
 * Incremental load test:
 * - Start: 10 connections
 * - Increment: +5 every 30 seconds
 * - Continue until: Breaking point or 200 connections
 * - Duration: ~1 hour maximum
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  startConnections: 10,
  incrementConnections: 5,
  phaseInterval: 30 * 1000, // 30 seconds
  maxConnections: 200,
  serverUrl: 'ws://127.0.0.1:9999',
  messageInterval: 100, // ms
  phaseDuration: 30 * 1000, // 30 seconds
  errorThreshold: 0.10, // 10% error rate
  latencyThresholdMs: 5000, // P99 > 5 seconds
  memoryThresholdMb: 1024 // 1GB
};

class BreakingPointTestRunner {
  constructor() {
    this.clients = [];
    this.results = {
      phases: [],
      systemMetrics: [],
      breakingPoint: null,
      summary: {}
    };
    this.currentPhase = 0;
    this.totalConnections = 0;
  }

  async run() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                  BREAKING POINT ANALYSIS - STRESS TEST                    ║');
    console.log('║           Find System Breaking Points Through Incremental Load            ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    const testStartTime = performance.now();

    console.log('Configuration:');
    console.log(`  Start: ${TEST_CONFIG.startConnections} connections`);
    console.log(`  Increment: +${TEST_CONFIG.incrementConnections} every ${TEST_CONFIG.phaseInterval / 1000}s`);
    console.log(`  Max: ${TEST_CONFIG.maxConnections} connections`);
    console.log(`  Server: ${TEST_CONFIG.serverUrl}`);
    console.log(`  Phase Duration: ${TEST_CONFIG.phaseDuration / 1000}s per phase\n`);

    let targetConnections = TEST_CONFIG.startConnections;
    let continueTest = true;

    while (continueTest && targetConnections <= TEST_CONFIG.maxConnections) {
      this.currentPhase++;
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`PHASE ${this.currentPhase}: ${targetConnections} concurrent connections`);
      console.log(`${'═'.repeat(80)}`);

      // Add new connections
      const newConnectionsCount = targetConnections - this.clients.length;
      if (newConnectionsCount > 0) {
        await this.addConnections(newConnectionsCount);
      }

      // Run phase and collect metrics
      const phaseResult = await this.runPhase(targetConnections);
      this.results.phases.push(phaseResult);

      // Print results
      this.printPhaseResults(phaseResult);

      // Check if breaking point reached
      if (this.isBreakingPoint(phaseResult)) {
        console.log('\n🔴 BREAKING POINT DETECTED - Stopping test');
        this.results.breakingPoint = {
          phase: this.currentPhase,
          connections: targetConnections,
          metrics: phaseResult
        };
        continueTest = false;
      }

      // Move to next phase
      if (continueTest) {
        targetConnections += TEST_CONFIG.incrementConnections;
      }
    }

    // Cleanup
    await this.closeAllConnections();
    const totalTime = (performance.now() - testStartTime) / 1000;

    // Generate report
    this.generateReport(totalTime);
  }

  async addConnections(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.createConnection());
    }

    const newClients = await Promise.all(promises);
    const successful = newClients.filter(c => c && c.connected).length;
    this.clients.push(...newClients.filter(c => c && c.connected));
    this.totalConnections += successful;

    console.log(`[Connected] ${successful}/${count} new connections (Total: ${this.clients.length})`);
  }

  createConnection() {
    return new Promise((resolve) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let resolved = false;

      try {
        const ws = new WebSocket(TEST_CONFIG.serverUrl);

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }, 5000);

        ws.on('open', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              id: clientId,
              connected: true,
              ws: ws,
              messagesSent: 0,
              messagesReceived: 0,
              latencies: []
            });
          }
        });

        ws.on('error', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(null);
          }
        });

        ws.on('close', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(null);
          }
        });

      } catch (err) {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }
    });
  }

  async runPhase(targetConnections) {
    const phaseStartTime = performance.now();
    const phaseEndTime = phaseStartTime + TEST_CONFIG.phaseDuration;

    const metrics = {
      phase: this.currentPhase,
      targetConnections: targetConnections,
      establishedConnections: this.clients.length,
      timestamp: new Date().toISOString(),
      messages: {
        sent: 0,
        received: 0,
        failed: 0
      },
      latencies: [],
      errors: [],
      memory: {},
      cpu: 0
    };

    return new Promise((resolve) => {
      const sendInterval = setInterval(() => {
        if (performance.now() >= phaseEndTime) {
          clearInterval(sendInterval);

          // Calculate statistics
          if (metrics.latencies.length > 0) {
            metrics.latencies.sort((a, b) => a - b);
            metrics.stats = {
              p50: metrics.latencies[Math.floor(metrics.latencies.length * 0.50)],
              p95: metrics.latencies[Math.floor(metrics.latencies.length * 0.95)],
              p99: metrics.latencies[Math.floor(metrics.latencies.length * 0.99)],
              max: metrics.latencies[metrics.latencies.length - 1],
              avg: metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
            };
          }

          // Capture memory
          const mem = process.memoryUsage();
          metrics.memory = {
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            rss: Math.round(mem.rss / 1024 / 1024),
            total: Math.round((mem.heapUsed + mem.external) / 1024 / 1024)
          };

          metrics.errorRate = metrics.messages.sent > 0
            ? (metrics.messages.failed / metrics.messages.sent)
            : 0;

          metrics.successRate = metrics.messages.sent > 0
            ? ((metrics.messages.sent - metrics.messages.failed) / metrics.messages.sent)
            : 1;

          metrics.throughput = metrics.messages.sent / (TEST_CONFIG.phaseDuration / 1000);

          resolve(metrics);
          return;
        }

        // Send messages from each connected client
        for (const client of this.clients) {
          if (!client || !client.ws || client.ws.readyState !== WebSocket.OPEN) {
            continue;
          }

          const msgStart = performance.now();
          const message = JSON.stringify({
            command: 'ping',
            id: `${client.id}-${Date.now()}`,
            payload: 'x'.repeat(256)
          });

          try {
            client.ws.send(message, (err) => {
              const latency = performance.now() - msgStart;
              metrics.latencies.push(latency);
              metrics.messages.sent++;

              if (err) {
                metrics.messages.failed++;
              } else {
                metrics.messages.received++;
              }
            });
          } catch (err) {
            metrics.messages.sent++;
            metrics.messages.failed++;
          }
        }
      }, TEST_CONFIG.messageInterval);
    });
  }

  isBreakingPoint(phaseMetrics) {
    // Error rate exceeds threshold
    if (phaseMetrics.errorRate > TEST_CONFIG.errorThreshold) {
      console.log(`  → Breaking: Error rate ${(phaseMetrics.errorRate * 100).toFixed(2)}% > ${TEST_CONFIG.errorThreshold * 100}%`);
      return true;
    }

    // Connection rate drops below 90%
    if (phaseMetrics.establishedConnections < phaseMetrics.targetConnections * 0.9) {
      console.log(`  → Breaking: Only ${phaseMetrics.establishedConnections}/${phaseMetrics.targetConnections} connections`);
      return true;
    }

    // Memory exceeds threshold
    if (phaseMetrics.memory.total > TEST_CONFIG.memoryThresholdMb) {
      console.log(`  → Breaking: Memory ${phaseMetrics.memory.total}MB > ${TEST_CONFIG.memoryThresholdMb}MB`);
      return true;
    }

    // Latency explosion
    if (phaseMetrics.stats && phaseMetrics.stats.p99 > TEST_CONFIG.latencyThresholdMs) {
      console.log(`  → Breaking: P99 latency ${phaseMetrics.stats.p99.toFixed(0)}ms > ${TEST_CONFIG.latencyThresholdMs}ms`);
      return true;
    }

    return false;
  }

  printPhaseResults(metrics) {
    const s = metrics.stats || {};
    const m = metrics.memory;

    console.log(`
  Connections:  ${metrics.establishedConnections}/${metrics.targetConnections}
  Messages:     ${metrics.messages.sent} sent | ${metrics.messages.failed} failed | ${(metrics.errorRate * 100).toFixed(2)}% error
  Throughput:   ${metrics.throughput.toFixed(2)} msg/s
  Latency:      P50=${s.p50?.toFixed(2) || 'N/A'}ms P95=${s.p95?.toFixed(2) || 'N/A'}ms P99=${s.p99?.toFixed(2) || 'N/A'}ms Max=${s.max?.toFixed(2) || 'N/A'}ms
  Memory:       Heap=${m.heapUsed}MB/${m.heapTotal}MB RSS=${m.rss}MB Total=${m.total}MB
    `);
  }

  async closeAllConnections() {
    console.log('\n[Cleanup] Closing connections...');
    for (const client of this.clients) {
      if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.close();
        } catch (err) {
          // Ignore
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[Cleanup] Complete');
  }

  generateReport(totalTime) {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                          TEST RESULTS SUMMARY                              ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    const phases = this.results.phases;
    if (phases.length === 0) {
      console.log('No phases completed');
      return;
    }

    const lastPhase = phases[phases.length - 1];
    const firstPhase = phases[0];

    console.log('OVERALL METRICS:');
    console.log(`  Phases Completed: ${phases.length}`);
    console.log(`  Max Connections Tested: ${Math.max(...phases.map(p => p.targetConnections))}`);
    console.log(`  Total Duration: ${totalTime.toFixed(2)}s`);
    console.log(`  Peak Memory: ${Math.max(...phases.map(p => p.memory.total))}MB\n`);

    // Find stability boundaries
    const stablePhases = phases.filter(p => p.successRate > 0.95 && p.errorRate < 0.05);
    if (stablePhases.length > 0) {
      const maxStable = Math.max(...stablePhases.map(p => p.targetConnections));
      console.log(`STABLE CONFIGURATION:`);
      console.log(`  Maximum stable connections: ${maxStable}`);
      console.log(`  Recommended limit (80% safety): ${Math.floor(maxStable * 0.8)}`);
      console.log(`  Critical limit (70% safety): ${Math.floor(maxStable * 0.7)}\n`);
    }

    // Breaking point
    if (this.results.breakingPoint) {
      const bp = this.results.breakingPoint;
      console.log(`BREAKING POINT REACHED:`);
      console.log(`  Phase: ${bp.phase}`);
      console.log(`  Connections: ${bp.connections}`);
      console.log(`  Error Rate: ${(bp.metrics.errorRate * 100).toFixed(2)}%`);
      console.log(`  P99 Latency: ${bp.metrics.stats?.p99?.toFixed(2) || 'N/A'}ms`);
      console.log(`  Memory: ${bp.metrics.memory.total}MB\n`);
    }

    // Degradation pattern
    console.log(`DEGRADATION PATTERN (`);
    for (let i = 0; i < Math.min(phases.length, 15); i++) {
      const p = phases[i];
      console.log(`  Phase ${(i + 1).toString().padStart(2)}: ${p.targetConnections.toString().padStart(3)} conns | ` +
        `Success=${(p.successRate * 100).toFixed(1).padStart(5)}% | ` +
        `P99=${p.stats?.p99?.toFixed(0)?.padStart(4) || '   N/A'}ms | ` +
        `Mem=${p.memory.total.toString().padStart(4)}MB`);
    }
    console.log(`);\n`);

    // Save to JSON
    this.saveResults(totalTime);
  }

  saveResults(totalTime) {
    const reportDir = '/home/devel/basset-hound-browser/tests/results';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `breaking-point-${timestamp}.json`);

    const report = {
      test: 'Breaking Point Analysis',
      timestamp: new Date().toISOString(),
      duration: totalTime,
      phases: this.results.phases,
      breakingPoint: this.results.breakingPoint,
      recommendations: this.generateRecommendations()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Results saved to: ${reportPath}`);
  }

  generateRecommendations() {
    const recommendations = [];
    const phases = this.results.phases;

    if (phases.length === 0) return recommendations;

    const stablePhases = phases.filter(p => p.successRate > 0.95);
    if (stablePhases.length > 0) {
      const maxStable = Math.max(...stablePhases.map(p => p.targetConnections));
      recommendations.push(`Deploy with max ${Math.floor(maxStable * 0.8)} concurrent connections`);
    }

    if (this.results.breakingPoint) {
      const bp = this.results.breakingPoint;
      if (bp.metrics.errorRate > 0.10) {
        recommendations.push(`Implement request queuing to handle error rates above 10%`);
      }
      if (bp.metrics.stats?.p99 > 1000) {
        recommendations.push(`Optimize message processing; P99 latency exceeds 1s`);
      }
    }

    const lastPhase = phases[phases.length - 1];
    if (lastPhase.memory.total > 800) {
      recommendations.push(`Reduce memory footprint; consider connection pooling`);
    }

    recommendations.push(`Run load balancing across ${Math.ceil(Math.max(...phases.map(p => p.targetConnections)) / 50)} instances`);

    return recommendations;
  }
}

// Run test
const runner = new BreakingPointTestRunner();
runner.run().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
