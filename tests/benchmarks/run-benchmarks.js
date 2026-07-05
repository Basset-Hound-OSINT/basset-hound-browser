#!/usr/bin/env node

/**
 * Benchmark Suite Driver
 *
 * Orchestrates the complete benchmark process:
 * 1. Measure BEFORE baseline (current code)
 * 2. Apply fixes
 * 3. Measure AFTER
 * 4. Detect regressions
 * 5. Generate reports
 *
 * Usage:
 *   node run-benchmarks.js [--phase before|after|both] [--duration 300000] [--clients 10]
 */

const fs = require('fs');
const path = require('path');
const { PerformanceBenchmark, BenchmarkComparison } = require('./performance-baseline.test');
const { MemoryStabilityTest } = require('./memory-stability.test');
const { RegressionDetector } = require('./regression-detector');
const { BenchmarkReportGenerator } = require('./benchmark-report');

class BenchmarkSuite {
  constructor(options = {}) {
    this.phase = options.phase || 'both'; // 'before', 'after', or 'both'
    this.duration = options.duration || 300000; // 5 minutes
    this.clients = options.clients || 10;
    this.memoryDuration = options.memoryDuration || 1800000; // 30 minutes
    this.resultsDir = path.join(__dirname, '../../tests/results/benchmarks');
    this.beforeResults = null;
    this.afterResults = null;
    this.memoryResults = null;
  }

  /**
   * Main entry point
   */
  async run() {
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# BASSET HOUND BROWSER - PERFORMANCE BENCHMARK SUITE`);
    console.log(`#`.repeat(70)}\n`);

    try {
      // Create results directory
      if (!fs.existsSync(this.resultsDir)) {
        fs.mkdirSync(this.resultsDir, { recursive: true });
      }

      // Phase 1: BEFORE benchmarks
      if (this.phase === 'before' || this.phase === 'both') {
        console.log('\n' + '='.repeat(70));
        console.log('PHASE 1: BASELINE MEASUREMENT (BEFORE FIXES)');
        console.log('='.repeat(70));
        await this.runBeforeBenchmarks();
      }

      // Phase 2: AFTER benchmarks
      if (this.phase === 'after' || this.phase === 'both') {
        console.log('\n' + '='.repeat(70));
        console.log('PHASE 2: POST-FIX MEASUREMENT (AFTER FIXES)');
        console.log('='.repeat(70));
        await this.runAfterBenchmarks();
      }

      // Phase 3: Memory Stability
      if (this.phase === 'both') {
        console.log('\n' + '='.repeat(70));
        console.log('PHASE 3: MEMORY STABILITY TEST (30 minutes)');
        console.log('='.repeat(70));
        await this.runMemoryStability();
      }

      // Phase 4: Analysis and Reports
      if (this.phase === 'both' && this.beforeResults && this.afterResults) {
        console.log('\n' + '='.repeat(70));
        console.log('PHASE 4: ANALYSIS AND REPORTING');
        console.log('='.repeat(70));
        await this.generateReports();
      }

      console.log('\n' + '#'.repeat(70));
      console.log('# BENCHMARK SUITE COMPLETE');
      console.log('#'.repeat(70) + '\n');

    } catch (error) {
      console.error('\n❌ Benchmark suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Run BEFORE benchmarks
   */
  async runBeforeBenchmarks() {
    try {
      console.log('\nStarting BEFORE baseline benchmarks...\n');

      const benchmark = new PerformanceBenchmark({
        phase: 'BEFORE',
        concurrentClients: this.clients,
        commandsPerClient: Math.floor(1000 / this.clients), // Total ~1000 commands
        duration: this.duration,
        url: 'ws://localhost:8765'
      });

      this.beforeResults = await benchmark.run();

      // Save results
      const beforeFile = path.join(this.resultsDir, 'before-results.json');
      fs.writeFileSync(beforeFile, JSON.stringify(this.beforeResults, null, 2));
      console.log(`\n✅ BEFORE results saved to: ${beforeFile}`);

    } catch (error) {
      console.error('❌ BEFORE benchmarks failed:', error.message);
      throw error;
    }
  }

  /**
   * Run AFTER benchmarks
   */
  async runAfterBenchmarks() {
    try {
      console.log('\nStarting AFTER optimization benchmarks...\n');

      const benchmark = new PerformanceBenchmark({
        phase: 'AFTER',
        concurrentClients: this.clients,
        commandsPerClient: Math.floor(1000 / this.clients),
        duration: this.duration,
        url: 'ws://localhost:8765'
      });

      this.afterResults = await benchmark.run();

      // Save results
      const afterFile = path.join(this.resultsDir, 'after-results.json');
      fs.writeFileSync(afterFile, JSON.stringify(this.afterResults, null, 2));
      console.log(`\n✅ AFTER results saved to: ${afterFile}`);

    } catch (error) {
      console.error('❌ AFTER benchmarks failed:', error.message);
      throw error;
    }
  }

  /**
   * Run memory stability test
   */
  async runMemoryStability() {
    try {
      console.log('\nStarting memory stability test (30 minutes)...\n');

      const test = new MemoryStabilityTest({
        duration: this.memoryDuration,
        clientCount: 5,
        commandsPerSecond: 20,
        sampleInterval: 5000,
        url: 'ws://localhost:8765'
      });

      this.memoryResults = await test.run();
      test.printAnalysis(this.memoryResults);

      // Save results
      const memFile = path.join(this.resultsDir, 'memory-stability-results.json');
      fs.writeFileSync(memFile, JSON.stringify(this.memoryResults, null, 2));
      console.log(`\n✅ Memory stability results saved to: ${memFile}`);

    } catch (error) {
      console.error('❌ Memory stability test failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate comparison and regression reports
   */
  async generateReports() {
    try {
      console.log('\nGenerating analysis reports...\n');

      // Regression detection
      const regressionDetector = new RegressionDetector(
        this.beforeResults,
        this.afterResults,
        {
          throughputThreshold: -5,
          latencyThreshold: 10,
          memoryThreshold: 10,
          reliabilityThreshold: -1
        }
      );

      const regressionResults = regressionDetector.printReport();

      // Save regression report
      const regressionFile = path.join(this.resultsDir, 'regression-analysis.json');
      fs.writeFileSync(regressionFile, JSON.stringify(regressionResults, null, 2));
      console.log(`✅ Regression analysis saved to: ${regressionFile}`);

      // Generate comprehensive reports
      const reportGen = new BenchmarkReportGenerator(
        this.beforeResults,
        this.afterResults,
        regressionResults,
        this.memoryResults
      );

      // Save markdown report
      const mdFile = reportGen.saveMarkdownReport('BENCHMARK-REPORT.md');
      console.log(`✅ Markdown report saved to: ${mdFile}`);

      // Save JSON report
      const jsonFile = reportGen.saveJsonReport('comprehensive-benchmark-report.json');
      console.log(`✅ Comprehensive JSON report saved to: ${jsonFile}`);

      // Print markdown report to console
      console.log('\n' + '='.repeat(70));
      console.log('BENCHMARK REPORT');
      console.log('='.repeat(70) + '\n');
      console.log(reportGen.generateMarkdownReport());

    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      throw error;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    phase: 'both',
    duration: 300000,
    clients: 10,
    memoryDuration: 1800000
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && args[i + 1]) {
      options.phase = args[++i];
    } else if (args[i] === '--duration' && args[i + 1]) {
      options.duration = parseInt(args[++i], 10);
    } else if (args[i] === '--clients' && args[i + 1]) {
      options.clients = parseInt(args[++i], 10);
    } else if (args[i] === '--memory-duration' && args[i + 1]) {
      options.memoryDuration = parseInt(args[++i], 10);
    }
  }

  return options;
}

/**
 * Main
 */
async function main() {
  const options = parseArgs();
  const suite = new BenchmarkSuite(options);

  try {
    await suite.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { BenchmarkSuite };
