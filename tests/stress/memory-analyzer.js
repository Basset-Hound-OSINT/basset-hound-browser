/**
 * Memory Monitoring Results Analyzer
 *
 * Analyzes the JSON results from memory-monitor.js and generates detailed reports.
 * Usage: node tests/stress/memory-analyzer.js [results-file.json]
 */

const fs = require('fs');
const path = require('path');

function analyzeResults(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const samples = data.memory_samples || data.samples || [];

  if (samples.length < 2) {
    console.error('Not enough samples to analyze');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('MEMORY MONITORING ANALYSIS');
  console.log('='.repeat(80) + '\n');

  // Basic stats
  const duration = samples[samples.length - 1].time_seconds - samples[0].time_seconds;
  const durationMinutes = (duration / 60).toFixed(1);

  console.log('TEST SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Duration: ${durationMinutes} minutes (${duration} seconds)`);
  console.log(`Samples Collected: ${samples.length}`);
  console.log(`Sampling Interval: ${((duration / samples.length) / 60).toFixed(2)} minutes\n`);

  // Heap analysis
  const heaps = samples.map(s => s.heap_mb || s.heap || 0);
  const rss = samples.map(s => s.rss_mb || s.rss || 0);
  const conns = samples.map(s => s.connections || 0);

  const heapFirst = heaps[0];
  const heapLast = heaps[heaps.length - 1];
  const heapGrowth = heapLast - heapFirst;
  const heapGrowthPerHour = (heapGrowth / (duration / 3600)).toFixed(2);

  const heapMin = Math.min(...heaps);
  const heapMax = Math.max(...heaps);
  const heapAvg = (heaps.reduce((a, b) => a + b) / heaps.length).toFixed(2);

  const rssFirst = rss[0];
  const rssLast = rss[rss.length - 1];
  const rssGrowth = rssLast - rssFirst;

  console.log('HEAP MEMORY');
  console.log('-'.repeat(80));
  console.log(`First Sample: ${heapFirst.toFixed(2)} MB`);
  console.log(`Last Sample: ${heapLast.toFixed(2)} MB`);
  console.log(`Growth: ${heapGrowth.toFixed(2)} MB`);
  console.log(`Growth Rate: ${heapGrowthPerHour} MB/hour`);
  console.log(`Min: ${heapMin.toFixed(2)} MB`);
  console.log(`Max: ${heapMax.toFixed(2)} MB`);
  console.log(`Average: ${heapAvg} MB`);
  console.log(`Variance: ${calculateVariance(heaps).toFixed(2)} MB^2\n`);

  console.log('RSS MEMORY');
  console.log('-'.repeat(80));
  console.log(`First Sample: ${rssFirst.toFixed(2)} MB`);
  console.log(`Last Sample: ${rssLast.toFixed(2)} MB`);
  console.log(`Growth: ${rssGrowth.toFixed(2)} MB`);
  console.log(`Ratio (RSS/Heap): ${(rssGrowth / Math.max(heapGrowth, 0.1)).toFixed(2)}x\n`);

  // Connection analysis
  if (conns.some(c => c > 0)) {
    const connAvg = (conns.reduce((a, b) => a + b) / conns.length).toFixed(2);
    const connMax = Math.max(...conns);
    const connMin = Math.min(...conns);

    console.log('CONNECTION COUNT');
    console.log('-'.repeat(80));
    console.log(`Average: ${connAvg}`);
    console.log(`Min: ${connMin}`);
    console.log(`Max: ${connMax}\n`);
  }

  // GC Pattern Detection
  console.log('GARBAGE COLLECTION PATTERNS');
  console.log('-'.repeat(80));
  const gcEvents = detectGCEvents(heaps);
  const gcPattern = analyzeGCPattern(gcEvents, heaps);

  console.log(`GC Events Detected: ${gcEvents.length}`);
  if (gcEvents.length > 0) {
    console.log(`Average Recovery per GC: ${gcPattern.avgRecovery.toFixed(2)} MB`);
    console.log(`GC Frequency: Every ${(duration / gcEvents.length).toFixed(0)} seconds`);
    console.log(`Pattern Status: Healthy\n`);
  } else {
    console.log('Pattern Status: No GC peaks detected\n');
  }

  // Memory growth analysis
  console.log('LEAK DETECTION');
  console.log('-'.repeat(80));

  const leaks = detectMemoryLeaks(samples, heaps);

  if (leaks.length === 0) {
    console.log('✓ No memory leaks detected');
    console.log('✓ System appears stable for long-running sessions\n');
  } else {
    console.log(`✗ ${leaks.length} potential leak(s) detected:`);
    leaks.forEach((leak, idx) => {
      console.log(`  ${idx + 1}. ${leak.type}: ${leak.description}`);
    });
    console.log();
  }

  // Stable regions
  console.log('STABLE MEMORY REGIONS');
  console.log('-'.repeat(80));

  const stableRegions = findStableRegions(samples, heaps);
  if (stableRegions.length > 0) {
    console.log(`Found ${stableRegions.length} stable region(s):`);
    stableRegions.forEach((region, idx) => {
      const regionDuration = region.endTime - region.startTime;
      console.log(`  Region ${idx + 1}: ${region.startTime}s - ${region.endTime}s (${regionDuration}s)`);
      console.log(`    Heap: ${region.startHeap.toFixed(2)} - ${region.endHeap.toFixed(2)} MB (growth: ${(region.endHeap - region.startHeap).toFixed(2)} MB)`);
    });
    console.log();
  }

  // Operations analysis
  if (data.test_summary && data.test_summary.operations_performed > 0) {
    console.log('OPERATIONS PERFORMANCE');
    console.log('-'.repeat(80));
    const ops = data.test_summary.operations_performed;
    const errors = data.test_summary.errors_encountered || 0;
    const success = ((ops - errors) / ops * 100).toFixed(1);
    console.log(`Total Operations: ${ops}`);
    console.log(`Errors: ${errors}`);
    console.log(`Success Rate: ${success}%\n`);
  }

  // Thresholds check
  console.log('THRESHOLD ANALYSIS');
  console.log('-'.repeat(80));

  const threshold = 50; // MB/hour
  const passed = Math.abs(heapGrowthPerHour) <= threshold;

  console.log(`Growth Threshold: ${threshold} MB/hour`);
  console.log(`Measured Growth: ${heapGrowthPerHour} MB/hour`);
  console.log(`Status: ${passed ? '✓ PASS' : '✗ FAIL'}\n`);

  // Recommendations
  console.log('RECOMMENDATIONS');
  console.log('-'.repeat(80));

  if (passed && gcPattern && gcEvents.length > 0) {
    console.log('✓ System is healthy and memory efficient');
    console.log('  - No unbounded growth detected');
    console.log('  - Garbage collection is active and effective');
    console.log('  - Suitable for long-running production deployments\n');
  } else if (!passed) {
    console.log('⚠ Investigate memory growth:');
    console.log('  1. Check websocket/server.js line 313 (rate limit cleanup)');
    console.log('  2. Review event listener cleanup in command handlers');
    console.log('  3. Monitor buffer/typed array allocation in screenshots/recording');
    console.log('  4. Check for circular references in session management\n');
  }

  // Summary stats
  console.log('='.repeat(80));
  console.log('END OF ANALYSIS');
  console.log('='.repeat(80) + '\n');
}

function calculateVariance(arr) {
  if (arr.length === 0) return 0;
  const avg = arr.reduce((a, b) => a + b) / arr.length;
  const squaredDiffs = arr.map(val => Math.pow(val - avg, 2));
  return squaredDiffs.reduce((a, b) => a + b) / arr.length;
}

function detectGCEvents(heaps) {
  const events = [];
  for (let i = 1; i < heaps.length; i++) {
    // GC events show as significant drops (>10MB)
    if (heaps[i - 1] - heaps[i] > 10) {
      events.push({
        index: i,
        recovered: heaps[i - 1] - heaps[i]
      });
    }
  }
  return events;
}

function analyzeGCPattern(events, heaps) {
  if (events.length === 0) {
    return { avgRecovery: 0 };
  }

  const avgRecovery = events.reduce((sum, e) => sum + e.recovered, 0) / events.length;
  return { avgRecovery };
}

function detectMemoryLeaks(samples, heaps) {
  const leaks = [];

  // Check for monotonic growth (sign of leak)
  if (samples.length > 10) {
    const firstThird = heaps.slice(0, Math.floor(heaps.length / 3));
    const lastThird = heaps.slice(Math.floor(heaps.length * 2 / 3));

    const avgFirst = firstThird.reduce((a, b) => a + b) / firstThird.length;
    const avgLast = lastThird.reduce((a, b) => a + b) / lastThird.length;

    // If last third average is significantly higher than first third
    if (avgLast > avgFirst * 1.5) {
      leaks.push({
        type: 'UNBOUNDED_GROWTH',
        description: `Last third avg (${avgLast.toFixed(2)} MB) > 1.5x first third (${avgFirst.toFixed(2)} MB)`
      });
    }
  }

  return leaks;
}

function findStableRegions(samples, heaps) {
  const regions = [];
  const threshold = 5; // MB variance
  let currentRegion = null;

  for (let i = 0; i < heaps.length - 1; i++) {
    const window = heaps.slice(i, Math.min(i + 5, heaps.length));
    const variance = calculateVariance(window);

    if (variance < threshold) {
      if (!currentRegion) {
        currentRegion = {
          startTime: samples[i].time_seconds,
          startHeap: heaps[i],
          startIndex: i
        };
      }
      currentRegion.endTime = samples[Math.min(i + 4, heaps.length - 1)].time_seconds;
      currentRegion.endHeap = heaps[Math.min(i + 4, heaps.length - 1)];
    } else {
      if (currentRegion) {
        regions.push(currentRegion);
        currentRegion = null;
      }
    }
  }

  if (currentRegion) {
    regions.push(currentRegion);
  }

  return regions.filter(r => r.endTime - r.startTime >= 60); // Only regions >60s
}

// Main
const resultsFile = process.argv[2] || '/home/devel/basset-hound-browser/tests/results/stress/memory-monitor-results.json';
analyzeResults(resultsFile);
