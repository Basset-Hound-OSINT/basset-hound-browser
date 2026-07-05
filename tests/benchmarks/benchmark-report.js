/**
 * Comprehensive Benchmark Report Generator
 *
 * Generates human-readable markdown reports and JSON data
 * for before/after comparisons
 */

const fs = require('fs');
const path = require('path');

class BenchmarkReportGenerator {
  constructor(beforeResults, afterResults, regressionResults, memoryResults) {
    this.before = beforeResults;
    this.after = afterResults;
    this.regression = regressionResults;
    this.memory = memoryResults;
  }

  /**
   * Generate comprehensive markdown report
   */
  generateMarkdownReport() {
    const timestamp = new Date().toISOString();
    const date = new Date().toLocaleDateString();

    let markdown = `# Performance Benchmark Report\n\n`;
    markdown += `**Generated:** ${timestamp}  \n`;
    markdown += `**Date:** ${date}  \n\n`;

    // Executive Summary
    markdown += this.generateExecutiveSummary();

    // Before/After Comparison
    markdown += this.generateComparison();

    // Detailed Metrics
    markdown += this.generateDetailedMetrics();

    // Regression Analysis
    markdown += this.generateRegressionAnalysis();

    // Memory Stability
    markdown += this.generateMemoryStability();

    // Recommendations
    markdown += this.generateRecommendations();

    // Test Configuration
    markdown += this.generateTestConfiguration();

    return markdown;
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary() {
    const throughputChange = (
      (this.after.metrics.throughput.commandsPerSecond - this.before.metrics.throughput.commandsPerSecond) /
      this.before.metrics.throughput.commandsPerSecond
    ) * 100;

    const latencyChange = (
      (this.after.metrics.latency.p99 - this.before.metrics.latency.p99) /
      this.before.metrics.latency.p99
    ) * 100;

    const memoryChange = (
      (this.after.metrics.memory.growth - this.before.metrics.memory.growth) /
      this.before.metrics.memory.growth
    ) * 100;

    const reliabilityChange = this.after.metrics.reliability.successRate - this.before.metrics.reliability.successRate;

    let summary = `## Executive Summary\n\n`;
    summary += `### Key Findings\n\n`;

    if (throughputChange >= 0) {
      summary += `- **Throughput:** ${Math.round(throughputChange * 100) / 100}% improvement\n`;
    } else {
      summary += `- **Throughput:** ${Math.abs(Math.round(throughputChange * 100) / 100)}% degradation\n`;
    }

    if (latencyChange <= 0) {
      summary += `- **Latency (P99):** ${Math.abs(Math.round(latencyChange * 100) / 100)}% improvement\n`;
    } else {
      summary += `- **Latency (P99):** ${Math.round(latencyChange * 100) / 100}% increase\n`;
    }

    if (memoryChange <= 0) {
      summary += `- **Memory Growth:** ${Math.abs(Math.round(memoryChange * 100) / 100)}% reduction\n`;
    } else {
      summary += `- **Memory Growth:** ${Math.round(memoryChange * 100) / 100}% increase\n`;
    }

    summary += `- **Reliability:** ${reliabilityChange >= 0 ? '+' : ''}${Math.round(reliabilityChange * 100) / 100}% change\n\n`;

    summary += `### Overall Status\n\n`;
    const hasRegressions = this.regression.hasRegressions;
    summary += `**${hasRegressions ? '⚠️ REGRESSIONS DETECTED' : '✅ NO REGRESSIONS DETECTED'}**\n\n`;

    return summary;
  }

  /**
   * Generate comparison table
   */
  generateComparison() {
    let comparison = `## Performance Comparison\n\n`;
    comparison += `| Metric | Before | After | Change | Unit |\n`;
    comparison += `|--------|--------|-------|--------|------|\n`;

    // Throughput
    const tpBefore = this.before.metrics.throughput.commandsPerSecond;
    const tpAfter = this.after.metrics.throughput.commandsPerSecond;
    const tpChange = ((tpAfter - tpBefore) / tpBefore * 100).toFixed(2);
    comparison += `| Throughput | ${tpBefore} | ${tpAfter} | ${tpChange}% | msg/sec |\n`;

    // Latency P99
    const latBefore = this.before.metrics.latency.p99;
    const latAfter = this.after.metrics.latency.p99;
    const latChange = ((latAfter - latBefore) / latBefore * 100).toFixed(2);
    comparison += `| Latency P99 | ${latBefore} | ${latAfter} | ${latChange}% | ms |\n`;

    // Memory Growth
    const memBefore = this.before.metrics.memory.growth;
    const memAfter = this.after.metrics.memory.growth;
    const memChange = ((memAfter - memBefore) / memBefore * 100).toFixed(2);
    comparison += `| Memory Growth | ${memBefore} | ${memAfter} | ${memChange}% | MB |\n`;

    // Success Rate
    const relBefore = this.before.metrics.reliability.successRate;
    const relAfter = this.after.metrics.reliability.successRate;
    const relChange = (relAfter - relBefore).toFixed(2);
    comparison += `| Success Rate | ${relBefore}% | ${relAfter}% | ${relChange}% | % |\n\n`;

    return comparison;
  }

  /**
   * Generate detailed metrics
   */
  generateDetailedMetrics() {
    let detailed = `## Detailed Metrics\n\n`;

    detailed += `### Throughput\n\n`;
    detailed += `**Before:**\n`;
    detailed += `- Commands/sec: ${this.before.metrics.throughput.commandsPerSecond}\n`;
    detailed += `- Total Commands: ${this.before.metrics.throughput.totalCommands}\n`;
    detailed += `- Duration: ${this.before.metrics.throughput.totalDuration}ms\n\n`;

    detailed += `**After:**\n`;
    detailed += `- Commands/sec: ${this.after.metrics.throughput.commandsPerSecond}\n`;
    detailed += `- Total Commands: ${this.after.metrics.throughput.totalCommands}\n`;
    detailed += `- Duration: ${this.after.metrics.throughput.totalDuration}ms\n\n`;

    detailed += `### Latency\n\n`;
    detailed += `| Percentile | Before (ms) | After (ms) |\n`;
    detailed += `|-----------|------------|----------|\n`;
    detailed += `| P50 | ${this.before.metrics.latency.p50} | ${this.after.metrics.latency.p50} |\n`;
    detailed += `| P95 | ${this.before.metrics.latency.p95} | ${this.after.metrics.latency.p95} |\n`;
    detailed += `| P99 | ${this.before.metrics.latency.p99} | ${this.after.metrics.latency.p99} |\n`;
    detailed += `| Min | ${this.before.metrics.latency.min} | ${this.after.metrics.latency.min} |\n`;
    detailed += `| Max | ${this.before.metrics.latency.max} | ${this.after.metrics.latency.max} |\n\n`;

    detailed += `### Memory\n\n`;
    detailed += `| Metric | Before (MB) | After (MB) |\n`;
    detailed += `|--------|-----------|----------|\n`;
    detailed += `| Baseline | ${this.before.metrics.memory.baseline} | ${this.after.metrics.memory.baseline} |\n`;
    detailed += `| Peak | ${this.before.metrics.memory.peak} | ${this.after.metrics.memory.peak} |\n`;
    detailed += `| Growth | ${this.before.metrics.memory.growth} | ${this.after.metrics.memory.growth} |\n`;
    detailed += `| Growth Rate | ${this.before.metrics.memory.growthRate} | ${this.after.metrics.memory.growthRate} |\n\n`;

    detailed += `### Reliability\n\n`;
    detailed += `| Metric | Before | After |\n`;
    detailed += `|--------|--------|-------|\n`;
    detailed += `| Success Rate | ${this.before.metrics.reliability.successRate}% | ${this.after.metrics.reliability.successRate}% |\n`;
    detailed += `| Succeeded | ${this.before.metrics.reliability.succeeded} | ${this.after.metrics.reliability.succeeded} |\n`;
    detailed += `| Failed | ${this.before.metrics.reliability.failed} | ${this.after.metrics.reliability.failed} |\n\n`;

    return detailed;
  }

  /**
   * Generate regression analysis
   */
  generateRegressionAnalysis() {
    let analysis = `## Regression Analysis\n\n`;

    if (this.regression.hasRegressions) {
      analysis += `### Detected Regressions\n\n`;

      this.regression.regressions.forEach(reg => {
        analysis += `#### ${reg.metric}\n\n`;
        analysis += `- **Before:** ${reg.before}\n`;
        analysis += `- **After:** ${reg.after}\n`;
        analysis += `- **Change:** ${reg.change}%\n`;
        analysis += `- **Severity:** ${reg.severity}\n`;
        analysis += `- **Recommendation:** ${reg.recommendation}\n\n`;
      });
    } else {
      analysis += `### ✅ No Regressions Detected\n\n`;
      analysis += `All metrics are within acceptable thresholds.\n\n`;
    }

    if (this.regression.improvements.length > 0) {
      analysis += `### Improvements\n\n`;

      this.regression.improvements.forEach(imp => {
        analysis += `- **${imp.metric}:** ${Math.abs(imp.change).toFixed(2)}% improvement\n`;
      });

      analysis += `\n`;
    }

    return analysis;
  }

  /**
   * Generate memory stability analysis
   */
  generateMemoryStability() {
    let stability = `## Memory Stability Analysis\n\n`;

    if (this.memory) {
      const a = this.memory.analysis;

      stability += `### Phase Analysis\n\n`;
      stability += `| Phase | Growth (MB/min) | Start | End |\n`;
      stability += `|-------|-----------------|-------|-----|\n`;
      stability += `| Early (0-5 min) | ${a.phases.early.growthRate} | ${a.phases.early.start} | ${a.phases.early.end} |\n`;
      stability += `| Middle (5-15 min) | ${a.phases.middle.growthRate} | ${a.phases.middle.start} | ${a.phases.middle.end} |\n`;
      stability += `| Late (15-30 min) | ${a.phases.late.growthRate} | ${a.phases.late.start} | ${a.phases.late.end} |\n\n`;

      stability += `### Stability Assessment\n\n`;
      stability += `- **Status:** ${a.status}\n`;
      stability += `- **Is Stable:** ${a.stability.isStable ? '✅' : '❌'}\n`;
      stability += `- **No Leak Detected:** ${a.stability.noLeak ? '✅' : '❌'}\n`;
      stability += `- **Low Volatility:** ${a.stability.lowVolatility ? '✅' : '⚠️'}\n`;
      stability += `- **Memory Volatility:** ${a.stability.volatility} MB\n\n`;

      stability += `### Command Metrics\n\n`;
      stability += `- **Total Commands:** ${this.memory.commandMetrics.totalCommands}\n`;
      stability += `- **Succeeded:** ${this.memory.commandMetrics.succeeded}\n`;
      stability += `- **Failed:** ${this.memory.commandMetrics.failed}\n`;
      stability += `- **Success Rate:** ${this.memory.commandMetrics.successRate}%\n\n`;
    }

    return stability;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    let recommendations = `## Recommendations\n\n`;

    if (this.regression.hasRegressions) {
      recommendations += `### Critical Actions\n\n`;

      this.regression.regressions.forEach(reg => {
        if (reg.severity === 'CRITICAL' && reg.recommendation) {
          recommendations += `- **${reg.metric}:** ${reg.recommendation}\n`;
        }
      });

      recommendations += `\n`;
    }

    recommendations += `### Next Steps\n\n`;
    recommendations += `1. **Review Code Changes:** Examine modifications between benchmark runs\n`;
    recommendations += `2. **Profile Hotspots:** Use profiler to identify bottlenecks\n`;
    recommendations += `3. **Verify in Production:** Test changes under realistic load\n`;
    recommendations += `4. **Monitor Continuously:** Set up alerts for performance degradation\n\n`;

    return recommendations;
  }

  /**
   * Generate test configuration section
   */
  generateTestConfiguration() {
    let config = `## Test Configuration\n\n`;

    config += `### Before Benchmark\n\n`;
    config += `- **Concurrent Clients:** ${this.before.config.concurrentClients}\n`;
    config += `- **Commands per Client:** ${this.before.config.commandsPerClient}\n`;
    config += `- **WebSocket URL:** ${this.before.config.url}\n\n`;

    config += `### After Benchmark\n\n`;
    config += `- **Concurrent Clients:** ${this.after.config.concurrentClients}\n`;
    config += `- **Commands per Client:** ${this.after.config.commandsPerClient}\n`;
    config += `- **WebSocket URL:** ${this.after.config.url}\n\n`;

    return config;
  }

  /**
   * Save report to file
   */
  saveMarkdownReport(filename) {
    const dir = path.join(__dirname, '../../tests/results/benchmarks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = this.generateMarkdownReport();
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, markdown);
    console.log(`Markdown report saved to: ${filepath}`);
    return filepath;
  }

  /**
   * Save comprehensive JSON report
   */
  saveJsonReport(filename) {
    const dir = path.join(__dirname, '../../tests/results/benchmarks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      before: this.before,
      after: this.after,
      regression: this.regression,
      memory: this.memory
    };

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`JSON report saved to: ${filepath}`);
    return filepath;
  }
}

module.exports = { BenchmarkReportGenerator };
