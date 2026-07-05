#!/usr/bin/env node

/**
 * Load Testing Executor - Wave 15 Load Testing at Scale
 *
 * Orchestrates Phase 1-4 load tests:
 * 1. Production load profile (300+ concurrent)
 * 2. Dashboard load test (50 competitors × 300 users)
 * 3. Spike testing (0→200→500 concurrent)
 * 4. Sustained load test (300 concurrent, 8+ hours)
 * 5. Breaking point test (find max connections)
 * 6. Network degradation test (resilience)
 *
 * Creates comprehensive load testing report
 *
 * Date: June 2, 2026
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ProductionLoadProfile = require('./production-load-profile.test.js');
const DashboardLoad = require('./dashboard-load.test.js');
const SpikeTest = require('./spike-test.test.js');
const SustainedLoad = require('./sustained-load.test.js');
const BreakingPoint = require('../stress/breaking-point.test.js');
const NetworkDegradation = require('../stress/network-degradation.test.js');

class LoadTestingExecutor {
  constructor(options = {}) {
    this.testPhases = options.phases || [
      'production-profile',
      'dashboard-load',
      'spike-test',
      'sustained-load',
      'breaking-point',
      'network-degradation'
    ];

    this.resultsDir = path.join(__dirname, '../results');
    this.reportFile = path.join(__dirname, '../results/LOAD-TESTING-REPORT.md');
    this.summaryFile = path.join(__dirname, '../results/LOAD-TESTING-COMPLETE.txt');

    this.results = {
      timestamp: new Date().toISOString(),
      phases: {},
      summary: {
        passed: [],
        failed: [],
        warnings: [],
        capacity: null,
        scalingRecommendations: []
      }
    };

    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async executeAllTests() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                   LOAD TESTING AT SCALE - EXECUTOR                      ║');
    console.log('║                    Basset Hound Browser v12.0.0+                       ║');
    console.log('║                   Phase 1-4: Comprehensive Load Analysis                ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    const executorStartTime = performance.now();

    // Execute each test phase
    for (const phase of this.testPhases) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`EXECUTING PHASE: ${phase.toUpperCase()}`);
      console.log(`${'='.repeat(80)}\n`);

      try {
        const result = await this.executePhase(phase);
        this.results.phases[phase] = result;
        this.results.summary.passed.push(phase);
      } catch (err) {
        console.error(`ERROR in ${phase}:`, err.message);
        this.results.phases[phase] = null;
        this.results.summary.failed.push({
          phase,
          error: err.message
        });
      }

      // Add delay between phases for system recovery
      console.log('\n>>> Waiting 5 minutes for system recovery...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }

    const executorElapsed = (performance.now() - executorStartTime) / 1000;

    console.log(`\n${'='.repeat(80)}`);
    console.log('ALL PHASES COMPLETED');
    console.log(`${'='.repeat(80)}\n`);

    this.generateAnalysis();
    this.generateReport();
    this.generateSummary(executorElapsed);

    return this.results;
  }

  async executePhase(phase) {
    switch (phase) {
    case 'production-profile':
      const prodTest = new ProductionLoadProfile({
        concurrent: 300,
        duration: 120 * 60 * 1000 // 2 hours
      });
      return await prodTest.runTest();

    case 'dashboard-load':
      const dashTest = new DashboardLoad({
        competitors: 50,
        users: 300,
        duration: 30 * 60 * 1000 // 30 minutes
      });
      return await dashTest.runTest();

    case 'spike-test':
      const spikeTest = new SpikeTest({
        serverUrl: 'ws://localhost:8765'
      });
      return await spikeTest.runTest();

    case 'sustained-load':
      const sustainedTest = new SustainedLoad({
        concurrent: 300,
        duration: 8 * 60 * 60 * 1000, // 8 hours
        checkpointInterval: 30 * 60 * 1000
      });
      return await sustainedTest.runTest();

    case 'breaking-point':
      const breakTest = new BreakingPoint({
        startConnections: 100,
        incrementStep: 100,
        iterationDuration: 2 * 60 * 1000,
        maxConnections: 2000
      });
      return await breakTest.runTest();

    case 'network-degradation':
      const netTest = new NetworkDegradation({
        concurrent: 100,
        duration: 20 * 60 * 1000 // 20 minutes
      });
      return await netTest.runTest();

    default:
      throw new Error(`Unknown phase: ${phase}`);
    }
  }

  generateAnalysis() {
    const allResults = Object.values(this.results.phases).filter(r => r);

    // Analyze production profile
    if (this.results.phases['production-profile']) {
      const prod = this.results.phases['production-profile'];
      if (prod.aggregated.throughput > 200) {
        this.results.summary.passed.push('high-throughput');
      } else {
        this.results.summary.warnings.push('Throughput below 200 msgs/sec target');
      }

      if (prod.aggregated.p99Latency < 100) {
        this.results.summary.passed.push('low-latency');
      } else {
        this.results.summary.warnings.push('P99 latency exceeds 100ms');
      }
    }

    // Analyze spike test
    if (this.results.phases['spike-test']) {
      const spike = this.results.phases['spike-test'];
      const lastPhase = spike.phases[spike.phases.length - 1];
      if (lastPhase && lastPhase.actualConnections === lastPhase.targetConnections) {
        this.results.summary.passed.push('spike-recovery');
      } else {
        this.results.summary.warnings.push('System did not fully recover from spike');
      }
    }

    // Analyze sustained load
    if (this.results.phases['sustained-load']) {
      const sustained = this.results.phases['sustained-load'];
      const memoryGrowthPerHour = sustained.aggregated.memoryGrowthPerHour / 1024 / 1024;
      if (memoryGrowthPerHour < 100) { // < 100MB/hour
        this.results.summary.passed.push('memory-stable');
      } else {
        this.results.summary.warnings.push(`High memory growth: ${memoryGrowthPerHour.toFixed(2)}MB/hr`);
      }
    }

    // Analyze breaking point
    if (this.results.phases['breaking-point']) {
      const breaking = this.results.phases['breaking-point'];
      const maxTested = breaking.breakingPoint.maxConnectionsTested;
      this.results.summary.capacity = {
        maxTested,
        recommended: Math.floor(maxTested * 0.8),
        observations: breaking.breakingPoint.recommendations
      };
    }

    // Analyze network degradation
    if (this.results.phases['network-degradation']) {
      const network = this.results.phases['network-degradation'];
      const allRecovered = network.scenarios.every(s => s.recovered);
      if (allRecovered) {
        this.results.summary.passed.push('network-recovery');
      } else {
        this.results.summary.warnings.push('System did not recover from all network degradation scenarios');
      }
    }
  }

  generateReport() {
    let report = `# Load Testing Report - Wave 15 - Basset Hound v12.0.0+

Generated: ${new Date().toISOString()}

## Executive Summary

This report contains comprehensive load testing results for the Basset Hound Browser system at scale. Testing covers production load profiles, dashboard functionality, spike recovery, sustained load stability, breaking points, and network resilience.

### Key Metrics

`;

    if (this.results.phases['production-profile']) {
      const prod = this.results.phases['production-profile'];
      report += `
#### Production Load Profile (300 concurrent, 2 hours)
- Successful Connections: ${prod.aggregated.successfulConnections}/${prod.aggregated.totalConnections}
- Throughput: ${prod.aggregated.throughput.toFixed(2)} msgs/sec
- P99 Latency: ${prod.aggregated.p99Latency.toFixed(2)}ms
- Error Rate: ${(prod.aggregated.errorRate * 100).toFixed(2)}%

`;
    }

    if (this.results.phases['dashboard-load']) {
      const dash = this.results.phases['dashboard-load'];
      report += `
#### Dashboard Load (50 competitors, 300 users)
- Successful Updates: ${dash.aggregated.successfulUpdates}/${dash.aggregated.totalUpdates}
- Dashboard P99 Latency: ${dash.aggregated.p99DashboardLatency.toFixed(2)}ms
- Connection Success Rate: ${((dash.aggregated.successfulConnections / dash.aggregated.totalConnections) * 100).toFixed(2)}%

`;
    }

    if (this.results.phases['spike-test']) {
      const spike = this.results.phases['spike-test'];
      report += `
#### Spike Testing Results
- Phases Completed: ${spike.phases.length}
- Peak Load: ${Math.max(...spike.phases.map(p => p.targetConnections))} concurrent
- Recovery Status: ${spike.phases[spike.phases.length - 1].actualConnections}/${spike.phases[spike.phases.length - 1].targetConnections}

`;
    }

    if (this.results.phases['breaking-point']) {
      const breaking = this.results.phases['breaking-point'];
      report += `
#### Breaking Point Analysis
- Maximum Tested: ${breaking.breakingPoint.maxConnectionsTested} connections
- Failure Mode: ${breaking.breakingPoint.failureMode || 'None'}
- Recommended Capacity: ${breaking.breakingPoint.recommendations[0] || 'N/A'}

`;
    }

    report += `
## Warnings & Issues

${this.results.summary.warnings.length > 0
    ? this.results.summary.warnings.map(w => `- ${w}`).join('\n')
    : '- No critical warnings'
}

## Capacity Assessment

${this.results.summary.capacity
    ? `Maximum Sustainable Connections: ${this.results.summary.capacity.maxTested}\nRecommended Limit: ${this.results.summary.capacity.recommended}\n\nRecommendations:\n${this.results.summary.capacity.observations.map(o => `- ${o}`).join('\n')}`
    : 'Capacity assessment not completed'
}

## Scaling Recommendations

${this.results.summary.scalingRecommendations.length > 0
    ? this.results.summary.scalingRecommendations.join('\n')
    : '- Monitor at recommended capacity before attempting higher loads\n- Implement connection pooling for optimal resource utilization\n- Consider horizontal scaling beyond recommended capacity'
}

## Detailed Results Files

- Production Profile: \`/tests/results/load-profile-*.json\`
- Dashboard Load: \`/tests/results/dashboard-load-*.json\`
- Spike Test: \`/tests/results/spike-test-*.json\`
- Sustained Load: \`/tests/results/sustained-load-*.json\`
- Breaking Point: \`/tests/results/breaking-point-*.json\`
- Network Degradation: \`/tests/results/network-degradation-*.json\`

---
Generated by Load Testing Executor - $(date)
`;

    fs.writeFileSync(this.reportFile, report);
    console.log(`\nDetailed report written to: ${this.reportFile}`);
  }

  generateSummary(totalElapsed) {
    const summary = `
╔════════════════════════════════════════════════════════════════════════════╗
║              LOAD TESTING AT SCALE - EXECUTION COMPLETE                   ║
║                    Wave 15 - Basset Hound v12.0.0+                        ║
╚════════════════════════════════════════════════════════════════════════════╝

Execution Summary
================
Total Duration: ${totalElapsed.toFixed(0)} seconds (${(totalElapsed / 3600).toFixed(1)} hours)
Timestamp: ${new Date().toISOString()}

Test Phases Completed
====================
${this.results.testPhases.map((p, i) => `${i + 1}. ${p.toUpperCase()}`).join('\n')}

Results
=======
Passed Tests: ${this.results.summary.passed.length}
Failed Tests: ${this.results.summary.failed.length}
Warnings: ${this.results.summary.warnings.length}

${this.results.summary.failed.length > 0 ? `
Failed Phases:
${this.results.summary.failed.map(f => `- ${f.phase}: ${f.error}`).join('\n')}
` : ''}

${this.results.summary.warnings.length > 0 ? `
Warnings:
${this.results.summary.warnings.map(w => `- ${w}`).join('\n')}
` : ''}

${this.results.summary.capacity ? `
Capacity Assessment
===================
Maximum Sustainable: ${this.results.summary.capacity.maxTested} connections
Recommended Limit: ${this.results.summary.capacity.recommended} connections (80% safety margin)
` : ''}

Detailed Report
===============
Full report: ${this.reportFile}
Results directory: ${this.resultsDir}

Next Steps
==========
1. Review detailed report for performance metrics
2. Analyze bottlenecks and failure modes
3. Implement recommendations for production deployment
4. Monitor real-world performance against test baselines
5. Schedule quarterly load testing

═══════════════════════════════════════════════════════════════════════════════
`;

    fs.writeFileSync(this.summaryFile, summary);
    console.log(summary);
    console.log(`\nSummary written to: ${this.summaryFile}`);
  }
}

// Run executor
if (require.main === module) {
  const phases = process.argv.includes('--all')
    ? ['production-profile', 'dashboard-load', 'spike-test', 'sustained-load', 'breaking-point', 'network-degradation']
    : process.argv.includes('--quick')
      ? ['spike-test', 'breaking-point', 'network-degradation']
      : ['production-profile', 'spike-test', 'breaking-point'];

  const executor = new LoadTestingExecutor({ phases });

  executor.executeAllTests()
    .then(() => {
      console.log('\n>>> Load testing execution complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n>>> Error during load testing:', err);
      process.exit(1);
    });
}

module.exports = LoadTestingExecutor;
