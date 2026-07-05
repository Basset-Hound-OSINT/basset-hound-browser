#!/usr/bin/env node

/**
 * Load Testing Orchestrator - Master Test Controller
 *
 * Coordinates:
 * 1. Comprehensive load testing (50, 100, 200 concurrent)
 * 2. Stress testing (200, 500, 1000 concurrent)
 * 3. Quick soak testing (5 minutes)
 * 4. Chaos engineering tests
 * 5. Report generation
 */

const { LoadTester } = require('./comprehensive-load-test');
const { SoakTestRunner } = require('./soak-testing');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class TestOrchestrator {
  constructor() {
    this.resultsDir = path.join(__dirname, '../results');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logDir = path.join(this.resultsDir, `load-testing-${this.timestamp}`);
    this.allResults = {
      orchestrator: {
        timestamp: new Date().toISOString(),
        startTime: Date.now(),
        phases: {
          load: null,
          stress: null,
          soak: null,
          chaos: null
        }
      },
      summary: {}
    };

    this._ensureDirectories();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
  }

  async _runExternalTest(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
      this._log(`Starting test: ${path.basename(scriptPath)}`);

      const child = spawn('node', [scriptPath, ...args], {
        cwd: __dirname,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          this._log(`Test completed: ${path.basename(scriptPath)}`, 'SUCCESS');
          resolve();
        } else {
          this._log(`Test failed with code ${code}: ${path.basename(scriptPath)}`, 'ERROR');
          reject(new Error(`Test failed with exit code ${code}`));
        }
      });

      child.on('error', (err) => {
        this._log(`Failed to start test: ${err.message}`, 'ERROR');
        reject(err);
      });
    });
  }

  async runLoadTestPhase() {
    this._log('='.repeat(80));
    this._log('PHASE 1: LOAD TESTING');
    this._log('='.repeat(80));

    try {
      const tester = new LoadTester();
      const results = await tester.runAllTests();
      this.allResults.orchestrator.phases.load = results;

      return results;
    } catch (err) {
      this._log(`Load testing phase failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  async runSoakTestPhase() {
    this._log('='.repeat(80));
    this._log('PHASE 2: SOAK TESTING (Quick - 5 minutes)');
    this._log('='.repeat(80));

    try {
      const runner = new SoakTestRunner();
      const connected = await runner.connectPool(50);

      if (connected === 0) {
        throw new Error('Failed to establish connections for soak test');
      }

      // 5-minute quick soak
      const testDuration = 300000;
      await runner.sendMessages(testDuration, 5);
      await runner.disconnect();

      const results = runner.getResults();
      this.allResults.orchestrator.phases.soak = results;

      return results;
    } catch (err) {
      this._log(`Soak testing phase failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  async runChaosTestPhase() {
    this._log('='.repeat(80));
    this._log('PHASE 3: CHAOS ENGINEERING');
    this._log('='.repeat(80));

    try {
      // Run chaos tests in external process
      await this._runExternalTest(path.join(__dirname, 'chaos-engineering.js'));

      // Read the generated chaos test results
      const resultsDir = this.resultsDir;
      const files = fs.readdirSync(resultsDir)
        .filter(f => f.startsWith('chaos-engineering-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length > 0) {
        const latestChaosResult = JSON.parse(
          fs.readFileSync(path.join(resultsDir, files[0]), 'utf8')
        );
        this.allResults.orchestrator.phases.chaos = latestChaosResult;
      }

      return this.allResults.orchestrator.phases.chaos;
    } catch (err) {
      this._log(`Chaos testing phase failed: ${err.message}`, 'ERROR');
      throw err;
    }
  }

  _generateSummary() {
    const phases = this.allResults.orchestrator.phases;
    const summary = {
      total_phases_completed: Object.values(phases).filter(p => p !== null).length,
      total_tests: 0,
      total_messages_sent: 0,
      total_messages_received: 0,
      overall_success_rate: 0,
      execution_time_seconds: 0,
      phases_status: {}
    };

    // Load test phase summary
    if (phases.load) {
      const loadTests = phases.load.tests || [];
      summary.total_tests += loadTests.length;
      loadTests.forEach(test => {
        summary.total_messages_sent += test.messages.sent;
        summary.total_messages_received += test.messages.received;
      });
      summary.phases_status.load = {
        tests: loadTests.length,
        success_rate: phases.load.summary?.overall_success_rate || 0
      };
    }

    // Soak test phase summary
    if (phases.soak) {
      summary.total_messages_sent += phases.soak.messages.received || 0;
      summary.total_messages_received += phases.soak.messages.received || 0;
      summary.phases_status.soak = {
        duration_hours: phases.soak.duration_hours,
        memory_growth_mb: phases.soak.memory?.growth_mb || 0
      };
    }

    // Chaos test phase summary
    if (phases.chaos) {
      const chaosTests = phases.chaos.tests || [];
      summary.total_tests += chaosTests.length;
      summary.phases_status.chaos = {
        tests: chaosTests.length,
        avg_success_rate: chaosTests.length > 0
          ? (chaosTests.reduce((sum, t) => sum + parseFloat(t.connection_success_rate), 0) / chaosTests.length).toFixed(2)
          : 0
      };
    }

    // Calculate overall success rate
    if (summary.total_messages_sent > 0) {
      summary.overall_success_rate = (summary.total_messages_received / summary.total_messages_sent * 100).toFixed(2);
    }

    summary.execution_time_seconds = ((Date.now() - this.allResults.orchestrator.startTime) / 1000).toFixed(2);

    this.allResults.summary = summary;
  }

  generateReport() {
    this._generateSummary();

    const report = {
      title: 'COMPREHENSIVE LOAD & STRESS TESTING REPORT',
      timestamp: new Date().toISOString(),
      duration_seconds: ((Date.now() - this.allResults.orchestrator.startTime) / 1000).toFixed(2),

      executive_summary: {
        total_phases: this.allResults.summary.total_phases_completed,
        total_tests: this.allResults.summary.total_tests,
        overall_success_rate: `${this.allResults.summary.overall_success_rate}%`,
        total_messages_processed: this.allResults.summary.total_messages_received
      },

      phase_results: {
        load_testing: this._formatLoadTestResults(),
        soak_testing: this._formatSoakTestResults(),
        chaos_engineering: this._formatChaosTestResults()
      },

      performance_metrics: this._calculatePerformanceMetrics(),
      recommendations: this._generateRecommendations(),
      conclusion: this._generateConclusion()
    };

    return report;
  }

  _formatLoadTestResults() {
    const phase = this.allResults.orchestrator.phases.load;
    if (!phase) {
      return null;
    }

    return {
      status: 'COMPLETED',
      tests_run: phase.tests?.length || 0,
      summary: phase.summary,
      test_details: phase.tests?.map(t => ({
        name: t.name,
        success_rate: `${t.messages.success_rate}%`,
        throughput: `${t.throughput.avg_msgs_per_sec} msg/s`,
        latency_p99: `${t.latency.p99}ms`,
        memory_growth: `${t.memory.growth_mb}MB`
      })) || []
    };
  }

  _formatSoakTestResults() {
    const phase = this.allResults.orchestrator.phases.soak;
    if (!phase) {
      return null;
    }

    return {
      status: 'COMPLETED',
      duration_hours: phase.duration_hours,
      messages_received: phase.messages.received,
      throughput: `${phase.messages.throughput_msg_per_sec} msg/s`,
      connection_stability: {
        drops: phase.connections.dropped,
        recycles: phase.connections.recycled
      },
      memory_analysis: phase.memory,
      leak_detected: phase.memory?.trend_analysis?.leak_detected || false
    };
  }

  _formatChaosTestResults() {
    const phase = this.allResults.orchestrator.phases.chaos;
    if (!phase) {
      return null;
    }

    return {
      status: 'COMPLETED',
      tests_run: phase.tests?.length || 0,
      test_details: phase.tests?.map(t => ({
        name: t.name,
        connection_success_rate: `${t.connection_success_rate}%`,
        messages_sent: t.metrics.messages_sent,
        recovery_successful: t.recovery?.recoverySuccess || false,
        time_to_recovery: t.recovery?.timeToRecovery ? `${t.recovery.timeToRecovery}s` : 'N/A'
      })) || []
    };
  }

  _calculatePerformanceMetrics() {
    const load = this.allResults.orchestrator.phases.load;
    if (!load || !load.tests || load.tests.length === 0) {
      return null;
    }

    const throughputs = load.tests.map(t => parseFloat(t.throughput.avg_msgs_per_sec));
    const latencies = load.tests.map(t => t.latency.p99);
    const memoryGrowths = load.tests.map(t => t.memory.growth_mb);

    return {
      average_throughput: (throughputs.reduce((a, b) => a + b, 0) / throughputs.length).toFixed(2),
      peak_throughput: Math.max(...throughputs).toFixed(2),
      average_p99_latency: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
      max_p99_latency: Math.max(...latencies),
      average_memory_growth: (memoryGrowths.reduce((a, b) => a + b, 0) / memoryGrowths.length).toFixed(2),
      max_memory_growth: Math.max(...memoryGrowths)
    };
  }

  _generateRecommendations() {
    const metrics = this._calculatePerformanceMetrics();
    const recommendations = [];

    if (!metrics) {
      return recommendations;
    }

    const avgThroughput = parseFloat(metrics.average_throughput);
    if (avgThroughput < 400) {
      recommendations.push({
        category: 'Performance',
        priority: 'HIGH',
        issue: 'Throughput below 400 msg/s target',
        suggestion: 'Profile WebSocket message handling and optimize serialization'
      });
    }

    const maxLatency = metrics.max_p99_latency;
    if (maxLatency > 100) {
      recommendations.push({
        category: 'Latency',
        priority: 'MEDIUM',
        issue: `P99 latency ${maxLatency}ms exceeds 100ms threshold`,
        suggestion: 'Investigate event loop blocking and optimize command dispatch'
      });
    }

    const maxMemory = metrics.max_memory_growth;
    if (maxMemory > 500) {
      recommendations.push({
        category: 'Memory',
        priority: 'MEDIUM',
        issue: `Memory growth ${maxMemory}MB during load test`,
        suggestion: 'Review object lifecycle and implement resource pooling'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        category: 'General',
        priority: 'LOW',
        issue: 'No critical issues detected',
        suggestion: 'Continue monitoring in production'
      });
    }

    return recommendations;
  }

  _generateConclusion() {
    const summary = this.allResults.summary;
    const successRate = parseFloat(summary.overall_success_rate);

    let status = 'EXCELLENT';
    let details = 'System is performing at expected levels';

    if (successRate < 95) {
      status = 'GOOD';
      details = 'System is functional but may benefit from optimization';
    }

    if (successRate < 85) {
      status = 'ACCEPTABLE';
      details = 'System is handling load but optimization recommended';
    }

    if (successRate < 75) {
      status = 'CONCERNING';
      details = 'System may need architectural review or scaling';
    }

    return {
      overall_status: status,
      summary: details,
      recommendations_count: (this._generateRecommendations() || []).length,
      next_steps: this._getNextSteps(status)
    };
  }

  _getNextSteps(status) {
    const steps = [
      'Review detailed metrics in generated test files',
      'Monitor production deployment metrics'
    ];

    if (status === 'EXCELLENT' || status === 'GOOD') {
      steps.push('Run extended soak tests (24-48 hours) for production validation');
    } else {
      steps.push('Address identified bottlenecks before production deployment');
      steps.push('Re-run load tests after optimization');
    }

    return steps;
  }

  async saveAllResults() {
    const report = this.generateReport();

    // Save detailed results
    const detailedPath = path.join(this.logDir, 'detailed-results.json');
    fs.writeFileSync(detailedPath, JSON.stringify(this.allResults, null, 2));

    // Save summary report
    const reportPath = path.join(this.logDir, 'summary-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save human-readable report
    const humanPath = path.join(this.logDir, 'report.txt');
    fs.writeFileSync(humanPath, this._formatReportAsText(report));

    console.log(`\nResults saved to: ${this.logDir}`);
    console.log(`  - detailed-results.json`);
    console.log(`  - summary-report.json`);
    console.log(`  - report.txt`);

    return { detailedPath, reportPath, humanPath };
  }

  _formatReportAsText(report) {
    let text = '';

    text += '='.repeat(80) + '\n';
    text += `${report.title}\n`;
    text += '='.repeat(80) + '\n';
    text += `Timestamp: ${report.timestamp}\n`;
    text += `Total Duration: ${report.duration_seconds}s\n\n`;

    text += 'EXECUTIVE SUMMARY\n';
    text += '-'.repeat(80) + '\n';
    text += `Total Phases: ${report.executive_summary.total_phases}\n`;
    text += `Total Tests: ${report.executive_summary.total_tests}\n`;
    text += `Overall Success Rate: ${report.executive_summary.overall_success_rate}\n`;
    text += `Total Messages Processed: ${report.executive_summary.total_messages_processed}\n\n`;

    if (report.phase_results.load_testing) {
      text += 'LOAD TESTING RESULTS\n';
      text += '-'.repeat(80) + '\n';
      text += `Tests Run: ${report.phase_results.load_testing.tests_run}\n`;
      report.phase_results.load_testing.test_details.forEach(t => {
        text += `  ${t.name}:\n`;
        text += `    Success Rate: ${t.success_rate}\n`;
        text += `    Throughput: ${t.throughput}\n`;
        text += `    P99 Latency: ${t.latency_p99}\n`;
        text += `    Memory Growth: ${t.memory_growth}\n`;
      });
      text += '\n';
    }

    if (report.phase_results.soak_testing) {
      text += 'SOAK TESTING RESULTS\n';
      text += '-'.repeat(80) + '\n';
      text += `Duration: ${report.phase_results.soak_testing.duration_hours} hours\n`;
      text += `Messages Received: ${report.phase_results.soak_testing.messages_received}\n`;
      text += `Throughput: ${report.phase_results.soak_testing.throughput}\n`;
      text += `Memory Leak Detected: ${report.phase_results.soak_testing.leak_detected}\n\n`;
    }

    if (report.performance_metrics) {
      text += 'PERFORMANCE METRICS\n';
      text += '-'.repeat(80) + '\n';
      text += `Average Throughput: ${report.performance_metrics.average_throughput} msg/s\n`;
      text += `Peak Throughput: ${report.performance_metrics.peak_throughput} msg/s\n`;
      text += `Average P99 Latency: ${report.performance_metrics.average_p99_latency}ms\n`;
      text += `Max P99 Latency: ${report.performance_metrics.max_p99_latency}ms\n`;
      text += `Average Memory Growth: ${report.performance_metrics.average_memory_growth}MB\n`;
      text += `Max Memory Growth: ${report.performance_metrics.max_memory_growth}MB\n\n`;
    }

    text += 'RECOMMENDATIONS\n';
    text += '-'.repeat(80) + '\n';
    report.recommendations.forEach(rec => {
      text += `[${rec.priority}] ${rec.category}: ${rec.issue}\n`;
      text += `  → ${rec.suggestion}\n\n`;
    });

    text += 'CONCLUSION\n';
    text += '-'.repeat(80) + '\n';
    text += `Status: ${report.conclusion.overall_status}\n`;
    text += `Summary: ${report.conclusion.summary}\n\n`;
    text += 'Next Steps:\n';
    report.conclusion.next_steps.forEach(step => {
      text += `  • ${step}\n`;
    });

    text += '\n' + '='.repeat(80) + '\n';

    return text;
  }

  async runAll() {
    try {
      this._log('='.repeat(80));
      this._log('STARTING COMPREHENSIVE LOAD & STRESS TEST SUITE');
      this._log('='.repeat(80));

      // Run load tests
      try {
        await this.runLoadTestPhase();
      } catch (err) {
        this._log(`Load test phase error: ${err.message}`, 'WARN');
      }

      // Wait between phases
      this._log('Waiting 30 seconds before next phase...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Run soak tests
      try {
        await this.runSoakTestPhase();
      } catch (err) {
        this._log(`Soak test phase error: ${err.message}`, 'WARN');
      }

      // Wait between phases
      this._log('Waiting 30 seconds before next phase...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Run chaos tests
      try {
        await this.runChaosTestPhase();
      } catch (err) {
        this._log(`Chaos test phase error: ${err.message}`, 'WARN');
      }

      // Save results
      await this.saveAllResults();

      this._log('='.repeat(80));
      this._log('ALL TEST PHASES COMPLETED');
      this._log('='.repeat(80));

      return this.allResults;
    } catch (err) {
      this._log(`Fatal error: ${err.message}`, 'ERROR');
      throw err;
    }
  }
}

async function main() {
  const orchestrator = new TestOrchestrator();

  try {
    await orchestrator.runAll();
    process.exit(0);
  } catch (err) {
    console.error('Orchestrator failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { TestOrchestrator };
