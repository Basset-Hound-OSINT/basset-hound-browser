#!/usr/bin/env node

/**
 * Performance Comparison & Analysis Utility
 * Compares stress test results and identifies trends
 */

const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, '../results/stress');

function compareResults() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       BASSET HOUND BROWSER - PERFORMANCE ANALYSIS           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {};
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('-results.json'));

  console.log(`Found ${files.length} test result files...\n`);

  // Load all results
  for (const file of files) {
    const name = file.replace('-results.json', '');
    const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
    try {
      results[name] = JSON.parse(content);
    } catch (e) {
      console.error(`Failed to parse ${file}: ${e.message}`);
    }
  }

  // Display summary
  console.log('═════════════════════════════════════════════════════════════');
  console.log('                   STRESS TEST SUMMARY');
  console.log('═════════════════════════════════════════════════════════════\n');

  for (const [name, data] of Object.entries(results)) {
    console.log(`\n📊 ${name}`);
    console.log('─' .repeat(60));

    if (data.test_categories) {
      // Error recovery test
      const categories = data.test_categories;
      let totalPassed = 0, totalTests = 0;

      for (const [catName, catData] of Object.entries(categories)) {
        totalPassed += catData.passed;
        totalTests += catData.tests;
        console.log(`  ${catName}: ${catData.passed}/${catData.tests} ✓`);
      }

      console.log(`  \n  Overall: ${totalPassed}/${totalTests} (${(totalPassed/totalTests*100).toFixed(1)}%)`);

      if (data.issues_found && data.issues_found.length > 0) {
        console.log(`  Issues: ${data.issues_found.length}`);
        data.issues_found.forEach(issue => console.log(`    - ${issue}`));
      }
    } else if (data.success_rate !== undefined) {
      // Stress test
      console.log(`  Success Rate: ${(data.success_rate * 100).toFixed(1)}%`);
      console.log(`  Tests: ${data.total_commands || 'N/A'}`);
      console.log(`  Duration: ${data.test_duration_seconds}s`);

      if (data.latency) {
        console.log(`  Latency:`);
        console.log(`    p50: ${data.latency.p50 || 'N/A'}ms`);
        console.log(`    p95: ${data.latency.p95 || 'N/A'}ms`);
        console.log(`    p99: ${data.latency.p99 || 'N/A'}ms`);
      }

      if (data.memory_peak_mb) {
        console.log(`  Memory Peak: ${data.memory_peak_mb}MB`);
      }

      if (data.issues_found && data.issues_found.length > 0) {
        console.log(`  Issues: ${data.issues_found.length}`);
      }
    }
  }

  // Performance trends
  console.log('\n\n═════════════════════════════════════════════════════════════');
  console.log('                   PERFORMANCE TRENDS');
  console.log('═════════════════════════════════════════════════════════════\n');

  if (results['memory-monitor']) {
    const memData = results['memory-monitor'];
    if (memData.memory_samples && memData.memory_samples.length > 1) {
      console.log('Memory Growth Analysis:');
      const samples = memData.memory_samples;
      const first = samples[0].heap_mb;
      const last = samples[samples.length - 1].heap_mb;
      const growth = last - first;
      const duration = samples[samples.length - 1].time_seconds / 3600; // hours
      const ratePerHour = duration > 0 ? growth / duration : 0;

      console.log(`  Initial: ${first}MB`);
      console.log(`  Peak: ${Math.max(...samples.map(s => s.heap_mb))}MB`);
      console.log(`  Final: ${last}MB`);
      console.log(`  Growth: ${growth}MB over ${duration.toFixed(2)} hours`);
      console.log(`  Rate: ${ratePerHour.toFixed(2)}MB/hour`);

      if (ratePerHour > 10) {
        console.log(`  ⚠️  WARNING: High memory growth rate detected`);
      } else if (ratePerHour > 0) {
        console.log(`  ⚠️  WARNING: Memory growth detected (potential leak)`);
      } else {
        console.log(`  ✅ No memory growth detected`);
      }
    }
  }

  // Bot evasion analysis
  if (results['evasion-validator']) {
    const evasionData = results['evasion-validator'];
    console.log('\nBot Evasion Effectiveness:');

    if (evasionData.evasion_techniques) {
      let totalEffectiveness = 0;
      let count = 0;

      for (const [technique, data] of Object.entries(evasionData.evasion_techniques)) {
        console.log(`  ${technique}: ${(data.effectiveness * 100).toFixed(1)}% (consistency: ${(data.consistency_rate * 100).toFixed(1)}%)`);
        totalEffectiveness += data.effectiveness;
        count++;
      }

      console.log(`  \n  Overall: ${(totalEffectiveness / count * 100).toFixed(1)}% (target: 85-90%)`);
    }
  }

  // WebSocket performance
  if (results['websocket-stress']) {
    const wsData = results['websocket-stress'];
    console.log('\nWebSocket API Performance:');

    if (wsData.concurrent_connections) {
      console.log(`  Concurrent Connections: ${wsData.concurrent_connections}`);
    }
    if (wsData.throughput_cmds_per_sec) {
      console.log(`  Throughput: ${wsData.throughput_cmds_per_sec} commands/sec`);
    }
    if (wsData.latency) {
      console.log(`  Latency p95: ${wsData.latency.p95}ms`);
    }
  }

  // Browser automation performance
  if (results['browser-stress']) {
    const browserData = results['browser-stress'];
    console.log('\nBrowser Automation Performance:');

    if (browserData.concurrent_navigations) {
      console.log(`  Concurrent Navigations: ${browserData.concurrent_navigations}`);
    }
    if (browserData.avg_navigation_time_ms) {
      console.log(`  Avg Navigation: ${browserData.avg_navigation_time_ms}ms`);
    }
    if (browserData.avg_screenshot_time_ms) {
      console.log(`  Avg Screenshot: ${browserData.avg_screenshot_time_ms}ms`);
    }
  }

  // Recommendations
  console.log('\n\n═════════════════════════════════════════════════════════════');
  console.log('                   RECOMMENDATIONS');
  console.log('═════════════════════════════════════════════════════════════\n');

  const recommendations = [];

  // Check for memory issues
  if (results['memory-monitor']) {
    const memData = results['memory-monitor'];
    if (memData.memory_samples && memData.memory_samples.length > 1) {
      const first = memData.memory_samples[0].heap_mb;
      const last = memData.memory_samples[memData.memory_samples.length - 1].heap_mb;
      if (last - first > 20) {
        recommendations.push('🔴 CRITICAL: Memory growth detected - investigate memory leaks');
      }
    }
  }

  // Check for evasion issues
  if (results['evasion-validator']) {
    const evasionData = results['evasion-validator'];
    if (evasionData.overall_evasion_effectiveness < 0.85) {
      recommendations.push('🟡 WARNING: Evasion effectiveness below 85% target');
    }
  }

  // Check for error recovery issues
  if (results['error-recovery']) {
    const errorData = results['error-recovery'];
    if (errorData.success_rate < 0.9) {
      recommendations.push('🟡 WARNING: Error recovery success rate below 90%');
    }
  }

  // Check for WebSocket issues
  if (results['websocket-stress']) {
    const wsData = results['websocket-stress'];
    if (wsData.success_rate < 0.95) {
      recommendations.push('🟡 WARNING: WebSocket success rate below 95%');
    }
  }

  if (recommendations.length === 0) {
    console.log('✅ No critical issues detected');
    console.log('✅ All systems operating within acceptable parameters');
  } else {
    recommendations.forEach(rec => console.log(rec));
  }

  console.log('\n═════════════════════════════════════════════════════════════\n');
}

try {
  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory not found: ${resultsDir}`);
    process.exit(1);
  }
  compareResults();
} catch (e) {
  console.error('Error during analysis:', e);
  process.exit(1);
}
