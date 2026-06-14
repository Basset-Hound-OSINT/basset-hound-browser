/**
 * Comprehensive Integration Test Report Generator
 *
 * Generates detailed test reports including:
 * - Test execution summary
 * - Performance metrics
 * - Edge case coverage
 * - Chaos engineering results
 * - Recommendations
 */

const fs = require('fs');
const path = require('path');

class IntegrationTestReportGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.testResults = [];
    this.performanceMetrics = {};
    this.edgeCases = [];
    this.chaosResults = [];
    this.startTime = Date.now();
  }

  addTestResult(category, testName, passed, duration, error = null) {
    this.testResults.push({
      category,
      testName,
      passed,
      duration,
      error,
      timestamp: new Date().toISOString()
    });
  }

  addPerformanceMetric(metric, value, unit = 'ms') {
    if (!this.performanceMetrics[metric]) {
      this.performanceMetrics[metric] = [];
    }
    this.performanceMetrics[metric].push({ value, unit, timestamp: Date.now() });
  }

  addEdgeCase(description, result) {
    this.edgeCases.push({
      description,
      result,
      timestamp: Date.now()
    });
  }

  addChaosResult(scenario, outcome, metrics = {}) {
    this.chaosResults.push({
      scenario,
      outcome,
      metrics,
      timestamp: Date.now()
    });
  }

  generateSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;

    const categories = {};
    this.testResults.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = { passed: 0, failed: 0 };
      }
      if (result.passed) {
        categories[result.category].passed++;
      } else {
        categories[result.category].failed++;
      }
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: `${passRate}%`,
      categories,
      duration: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  generatePerformanceReport() {
    const report = {
      metrics: {},
      summary: {},
      timestamp: new Date().toISOString()
    };

    Object.entries(this.performanceMetrics).forEach(([metric, measurements]) => {
      const values = measurements.map(m => m.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const unit = measurements[0].unit;

      report.metrics[metric] = {
        average: `${avg.toFixed(2)} ${unit}`,
        min: `${min} ${unit}`,
        max: `${max} ${unit}`,
        samples: values.length,
        unit
      };
    });

    return report;
  }

  generateEdgeCaseReport() {
    const total = this.edgeCases.length;
    const successful = this.edgeCases.filter(ec => ec.result.success).length;
    const failed = total - successful;

    return {
      total,
      successful,
      failed,
      coverage: `${((successful / total) * 100).toFixed(2)}%`,
      cases: this.edgeCases,
      timestamp: new Date().toISOString()
    };
  }

  generateChaosEngineeringReport() {
    const total = this.chaosResults.length;
    const successful = this.chaosResults.filter(r => r.outcome === 'success').length;
    const recovered = this.chaosResults.filter(r => r.outcome === 'recovered').length;
    const failed = total - successful - recovered;

    return {
      total,
      successful,
      recovered,
      failed,
      successRate: `${((successful / total) * 100).toFixed(2)}%`,
      recoveryRate: `${((recovered / total) * 100).toFixed(2)}%`,
      scenarios: this.chaosResults,
      timestamp: new Date().toISOString()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummary();

    if (parseFloat(summary.passRate) < 95) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Test Pass Rate',
        issue: `Pass rate is ${summary.passRate}%, below 95% target`,
        action: 'Investigate failed tests and fix underlying issues'
      });
    }

    const perfReport = this.generatePerformanceReport();
    Object.entries(perfReport.metrics).forEach(([metric, data]) => {
      const max = parseFloat(data.max.split(' ')[0]);
      if (max > 1000) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'Performance',
          issue: `${metric} peak value (${data.max}) exceeds targets`,
          action: 'Review performance bottlenecks'
        });
      }
    });

    const chaosReport = this.generateChaosEngineeringReport();
    if (parseFloat(chaosReport.recoveryRate) < 80) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Resilience',
        issue: `Recovery rate ${chaosReport.recoveryRate}% below 80% target`,
        action: 'Improve error handling and recovery mechanisms'
      });
    }

    return recommendations;
  }

  generateFullReport() {
    return {
      timestamp: new Date().toISOString(),
      duration: `${(Date.now() - this.startTime) / 1000}s`,
      summary: this.generateSummary(),
      performance: this.generatePerformanceReport(),
      edgeCases: this.generateEdgeCaseReport(),
      chaosEngineering: this.generateChaosEngineeringReport(),
      recommendations: this.generateRecommendations(),
      testResults: this.testResults
    };
  }

  generateMarkdownReport() {
    const report = this.generateFullReport();
    let markdown = '# Comprehensive Integration Test Report\n\n';

    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Total Duration:** ${report.duration}\n\n`;

    // Summary
    markdown += '## Executive Summary\n\n';
    markdown += `- **Total Tests:** ${report.summary.totalTests}\n`;
    markdown += `- **Passed:** ${report.summary.passedTests}\n`;
    markdown += `- **Failed:** ${report.summary.failedTests}\n`;
    markdown += `- **Pass Rate:** ${report.summary.passRate}\n\n`;

    markdown += '### Results by Category\n\n';
    Object.entries(report.summary.categories).forEach(([category, stats]) => {
      markdown += `- **${category}:** ${stats.passed}/${stats.passed + stats.failed}\n`;
    });
    markdown += '\n';

    // Performance
    markdown += '## Performance Metrics\n\n';
    Object.entries(report.performance.metrics).forEach(([metric, data]) => {
      markdown += `### ${metric}\n`;
      markdown += `- **Average:** ${data.average}\n`;
      markdown += `- **Min:** ${data.min}\n`;
      markdown += `- **Max:** ${data.max}\n`;
      markdown += `- **Samples:** ${data.samples}\n\n`;
    });

    // Edge Cases
    markdown += '## Edge Case Coverage\n\n';
    markdown += `- **Total Cases:** ${report.edgeCases.total}\n`;
    markdown += `- **Successful:** ${report.edgeCases.successful}\n`;
    markdown += `- **Failed:** ${report.edgeCases.failed}\n`;
    markdown += `- **Coverage:** ${report.edgeCases.coverage}\n\n`;

    // Chaos Engineering
    markdown += '## Chaos Engineering Results\n\n';
    markdown += `- **Total Scenarios:** ${report.chaosEngineering.total}\n`;
    markdown += `- **Successful:** ${report.chaosEngineering.successful}\n`;
    markdown += `- **Recovered:** ${report.chaosEngineering.recovered}\n`;
    markdown += `- **Failed:** ${report.chaosEngineering.failed}\n`;
    markdown += `- **Success Rate:** ${report.chaosEngineering.successRate}\n`;
    markdown += `- **Recovery Rate:** ${report.chaosEngineering.recoveryRate}\n\n`;

    // Recommendations
    markdown += '## Recommendations\n\n';
    if (report.recommendations.length === 0) {
      markdown += 'No critical issues detected. System is performing well.\n\n';
    } else {
      report.recommendations.forEach(rec => {
        markdown += `### [${rec.priority}] ${rec.category}\n`;
        markdown += `**Issue:** ${rec.issue}\n`;
        markdown += `**Action:** ${rec.action}\n\n`;
      });
    }

    return markdown;
  }

  saveReport(format = 'json') {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
      const filename = path.join(this.outputDir, `integration-test-report-${timestamp}.json`);
      const report = this.generateFullReport();
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      return filename;
    } else if (format === 'markdown') {
      const filename = path.join(this.outputDir, `integration-test-report-${timestamp}.md`);
      const markdown = this.generateMarkdownReport();
      fs.writeFileSync(filename, markdown);
      return filename;
    }
  }

  generateTestMetrics() {
    return {
      totalTestCases: this.testResults.length,
      featureCrosCompatibility: this.testResults.filter(r =>
        r.category === 'Feature Cross-Compatibility'
      ).length,
      concurrentOperations: this.testResults.filter(r =>
        r.category === 'Concurrent Operations'
      ).length,
      errorRecovery: this.testResults.filter(r =>
        r.category === 'Error Recovery'
      ).length,
      performanceUnderLoad: this.testResults.filter(r =>
        r.category === 'Performance Under Load'
      ).length,
      edgeCases: this.testResults.filter(r =>
        r.category === 'Edge Cases'
      ).length,
      securityScenarios: this.testResults.filter(r =>
        r.category === 'Security Scenarios'
      ).length
    };
  }

  logSummary() {
    const summary = this.generateSummary();
    const metrics = this.generateTestMetrics();

    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE INTEGRATION TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTimestamp: ${summary.timestamp}`);
    console.log(`Duration: ${summary.duration}ms`);
    console.log(`\nTest Results:`);
    console.log(`  Total: ${summary.totalTests}`);
    console.log(`  Passed: ${summary.passedTests}`);
    console.log(`  Failed: ${summary.failedTests}`);
    console.log(`  Pass Rate: ${summary.passRate}`);
    console.log(`\nTest Metrics:`);
    Object.entries(metrics).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('\n' + '='.repeat(80));
  }
}

module.exports = IntegrationTestReportGenerator;
