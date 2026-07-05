/**
 * Jest Custom Reporter - Memory Usage Reporter
 * Tracks and reports heap usage per test suite
 */

const fs = require('fs');
const path = require('path');

class MemoryReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.outputFile = this.options.outputFile || 'memory-report.json';
    this.suiteMemory = new Map();
    this.testResults = [];
  }

  onTestResult(test, testResult) {
    const heapUsed = process.memoryUsage().heapUsed;
    const heapMB = Math.round(heapUsed / 1024 / 1024);

    const suitePath = testResult.testFilePath;
    const suiteResult = {
      filePath: suitePath,
      filename: path.basename(suitePath),
      heapMB,
      numTests: testResult.numPassingTests + testResult.numFailingTests,
      numPassed: testResult.numPassingTests,
      numFailed: testResult.numFailingTests,
      duration: testResult.perfStats.end - testResult.perfStats.start
    };

    this.testResults.push(suiteResult);

    // Print warning if heap usage high
    if (heapMB > 400) {
      console.warn(`\n⚠️  High memory in ${path.basename(suitePath)}: ${heapMB}MB`);
    }
  }

  onRunComplete() {
    // Sort by memory usage
    const sorted = this.testResults.sort((a, b) => b.heapMB - a.heapMB);

    // Calculate stats
    const stats = {
      totalSuites: sorted.length,
      totalTests: sorted.reduce((sum, s) => sum + s.numTests, 0),
      totalPassed: sorted.reduce((sum, s) => sum + s.numPassed, 0),
      totalFailed: sorted.reduce((sum, s) => sum + s.numFailed, 0),
      totalDuration: sorted.reduce((sum, s) => sum + s.duration, 0),
      peakHeapMB: Math.max(...sorted.map(s => s.heapMB)),
      averageHeapMB: Math.round(
        sorted.reduce((sum, s) => sum + s.heapMB, 0) / sorted.length
      ),
      timestamp: new Date().toISOString(),
      suites: sorted
    };

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('MEMORY USAGE BY TEST SUITE');
    console.log('='.repeat(70));
    console.log(`Peak heap:         ${stats.peakHeapMB} MB`);
    console.log(`Average heap:      ${stats.averageHeapMB} MB`);
    console.log(`Total tests:       ${stats.totalTests}`);
    console.log(`Passed/Failed:     ${stats.totalPassed}/${stats.totalFailed}`);

    console.log('\nTop 10 memory consumers:');
    sorted.slice(0, 10).forEach((suite, i) => {
      const status = suite.numFailed > 0 ? '❌' : '✅';
      console.log(
        `  ${i + 1}. ${suite.filename.padEnd(40)} ${suite.heapMB}MB ${status}`
      );
    });

    console.log('='.repeat(70) + '\n');

    // Write JSON report
    if (this.outputFile) {
      const dir = path.dirname(this.outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.outputFile, JSON.stringify(stats, null, 2));
      console.log(`Memory report saved to: ${this.outputFile}`);
    }

    // Alert if peak heap too high
    if (stats.peakHeapMB > 613) {
      console.error(`\n❌ HEAP EXHAUSTION DETECTED: ${stats.peakHeapMB}MB exceeds 613MB limit!`);
      console.error('   Action: Review test data sizes, enable aggressive GC, reduce workers\n');
    } else if (stats.peakHeapMB > 500) {
      console.warn(`\n⚠️  WARNING: Peak heap near limit: ${stats.peakHeapMB}MB (target: <400MB)\n`);
    }
  }
}

module.exports = MemoryReporter;
