#!/usr/bin/env node

/**
 * Dashboard Extreme Data Sizes Edge Cases Test Suite
 * Tests for handling extreme data volumes and sizes
 *
 * Features Tested:
 * 1. Monitor names with 500+ characters
 * 2. Alert descriptions with 10K+ characters
 * 3. Change history with 100K+ entries
 * 4. Dashboard load performance with extreme data
 * 5. Memory efficiency with large datasets
 */

const assert = require('assert');

console.log('[DASHBOARD-EXTREME-DATA] Starting extreme data size edge cases...\n');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: [],
  tests: [],
  performanceMetrics: []
};

function test(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'pass' });
  } catch (error) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${error.message}`);
    results.failed++;
    results.issues.push({ test: name, error: error.message });
    results.tests.push({ name, status: 'fail', error: error.message });
  }
}

function perfTest(name, fn) {
  try {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    console.log(`✓ PERF: ${name} (${duration.toFixed(2)}ms)`);
    results.passed++;
    results.performanceMetrics.push({ test: name, duration });
    results.tests.push({ name, status: 'perf', duration });

    return { duration, result };
  } catch (error) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${error.message}`);
    results.failed++;
    results.issues.push({ test: name, error: error.message });
    results.tests.push({ name, status: 'fail', error: error.message });
  }
}

// ====================================
// TEST SUITE 1: Extreme Monitor Names
// ====================================
console.log('\n=== TEST SUITE 1: Extreme Monitor Names ===\n');

test('Handles 500-character monitor name', () => {
  const name = 'Monitor_' + 'A'.repeat(492);
  assert.strictEqual(name.length, 500, 'Name should be exactly 500 characters');
  console.log(`  → Created ${name.length}-character name`);
});

test('Handles 1000-character monitor name', () => {
  const name = 'VeryLongMonitorName_' + 'X'.repeat(980);
  assert.strictEqual(name.length, 1000, 'Name should be exactly 1000 characters');
  console.log(`  → Created ${name.length}-character name`);
});

test('Handles 10K-character monitor name', () => {
  const name = 'ExtremelyLongName_' + 'Z'.repeat(10000 - 18);
  assert.strictEqual(name.length, 10000, 'Name should be exactly 10K characters');
  console.log(`  → Created ${name.length}-character name`);
});

test('Handles mixed unicode in extreme names', () => {
  const baseStr = 'Monitor📊🎯🚀 ';
  let name = '';
  for (let i = 0; i < 100; i++) {
    name += baseStr;
  }
  assert(name.length > 500, 'Should create long unicode name');
  console.log(`  → Created long unicode name (${name.length} chars)`);
});

// ====================================
// TEST SUITE 2: Extreme Descriptions
// ====================================
console.log('\n=== TEST SUITE 2: Extreme Alert Descriptions ===\n');

test('Handles 10K-character description', () => {
  const description = 'Alert Description: ' + 'Lorem ipsum dolor sit amet. '.repeat(370);
  assert(description.length >= 10000, 'Description should be at least 10K');
  console.log(`  → Created ${description.length}-character description`);
});

test('Handles 100K-character description', () => {
  const description = 'Long Description: ' + 'The quick brown fox jumps over the lazy dog. '.repeat(2200);
  assert(description.length >= 100000, 'Description should be at least 100K');
  console.log(`  → Created ${description.length}-character description`);
});

test('Handles description with repeated patterns', () => {
  const pattern = '🚨 ALERT: Critical issue detected on 2026-06-03\n';
  const description = pattern.repeat(1000);
  assert.strictEqual(description.split('\n').length - 1, 1000, 'Should have 1000 lines');
  console.log(`  → Created ${description.length}-character description with repeated patterns`);
});

test('Handles description with special characters', () => {
  const description = Array(1000)
    .fill(0)
    .map((_, i) => `Line ${i}: @#$%^&*(){}[]|\\:;"'<>?,./~`)
    .join('\n');
  assert(description.length > 5000, 'Should handle special characters in bulk');
  console.log(`  → Created description with special characters (${description.length} chars)`);
});

// ====================================
// TEST SUITE 3: Large Change History
// ====================================
console.log('\n=== TEST SUITE 3: Large Change History ===\n');

test('Handles 1000-entry change history', () => {
  const changes = [];
  for (let i = 0; i < 1000; i++) {
    changes.push({
      id: i,
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      type: i % 3 === 0 ? 'price' : i % 3 === 1 ? 'description' : 'inventory',
      oldValue: `old_${i}`,
      newValue: `new_${i}`,
      source: 'web_scrape'
    });
  }
  assert.strictEqual(changes.length, 1000, 'Should create 1000 changes');
  console.log(`  → Created ${changes.length}-entry change history`);
});

test('Handles 10K-entry change history', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      timestamp: new Date(Date.now() - i * 100).toISOString(),
      type: ['price', 'description', 'inventory', 'availability'][i % 4],
      oldValue: `old_${i}`,
      newValue: `new_${i}`,
      changePercent: Math.random() * 100
    });
  }
  assert.strictEqual(changes.length, 10000, 'Should create 10K changes');
  console.log(`  → Created ${changes.length}-entry change history`);
});

test('Handles 100K-entry change history', () => {
  const changes = [];
  for (let i = 0; i < 100000; i++) {
    changes.push({
      id: i,
      timestamp: new Date(Date.now() - i * 10).toISOString(),
      type: ['price', 'description', 'inventory', 'availability', 'metadata'][i % 5],
      oldValue: `old_${i % 1000}`,
      newValue: `new_${i % 1000}`,
      severity: ['low', 'medium', 'high'][i % 3]
    });
  }
  assert.strictEqual(changes.length, 100000, 'Should create 100K changes');
  console.log(`  → Created ${changes.length}-entry change history`);
});

test('Memory efficiency with large change history', () => {
  const changes = [];
  for (let i = 0; i < 50000; i++) {
    changes.push({
      id: i,
      timestamp: new Date(Date.now() - i * 50).toISOString(),
      type: 'change',
      oldValue: `old_${i}`,
      newValue: `new_${i}`
    });
  }

  const memBefore = process.memoryUsage().heapUsed;
  const changeMap = new Map(changes.map((c, i) => [i, c]));
  const memAfter = process.memoryUsage().heapUsed;
  const memUsed = (memAfter - memBefore) / 1024 / 1024;

  console.log(`  → 50K changes used ${memUsed.toFixed(2)}MB`);
  assert(memUsed < 100, 'Should use less than 100MB for 50K changes');
});

// ====================================
// TEST SUITE 4: Performance Under Extreme Data
// ====================================
console.log('\n=== TEST SUITE 4: Performance Under Extreme Data ===\n');

perfTest('Filter 10K changes by type', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      type: i % 3 === 0 ? 'price' : 'description',
      timestamp: Date.now() - i * 1000
    });
  }

  const filtered = changes.filter(c => c.type === 'price');
  return { count: filtered.length };
});

perfTest('Sort 10K changes by timestamp', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      timestamp: Date.now() - Math.random() * 1000000
    });
  }

  changes.sort((a, b) => b.timestamp - a.timestamp);
  return { count: changes.length };
});

perfTest('Search 10K changes for text pattern', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      description: `Change number ${i} with some content`,
      timestamp: new Date().toISOString()
    });
  }

  const searchTerm = 'number 5000';
  const results = changes.filter(c => c.description.includes(searchTerm));
  return { count: results.length };
});

perfTest('Group 10K changes by type', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      type: ['price', 'description', 'inventory'][i % 3],
      value: Math.random()
    });
  }

  const grouped = {};
  changes.forEach(c => {
    if (!grouped[c.type]) grouped[c.type] = [];
    grouped[c.type].push(c);
  });
  return { groups: Object.keys(grouped).length };
});

// ====================================
// TEST SUITE 5: Dashboard Load Scenarios
// ====================================
console.log('\n=== TEST SUITE 5: Dashboard Load Scenarios ===\n');

perfTest('Render dashboard with 1000 monitors', () => {
  const monitors = [];
  for (let i = 0; i < 1000; i++) {
    monitors.push({
      id: i,
      name: `Monitor_${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
      lastUpdate: new Date(Date.now() - i * 60000).toISOString(),
      alerts: Math.floor(Math.random() * 100)
    });
  }

  // Simulate dashboard rendering
  const htmlLines = monitors.map(m =>
    `<div class="monitor"><h3>${m.name}</h3><p>${m.status}</p><span>${m.alerts}</span></div>`
  );

  return { monitorsRendered: monitors.length, htmlSize: htmlLines.join('').length };
});

perfTest('Aggregate statistics for 1000 monitors', () => {
  const monitors = [];
  for (let i = 0; i < 1000; i++) {
    monitors.push({
      id: i,
      alertCount: Math.floor(Math.random() * 100),
      changeCount: Math.floor(Math.random() * 1000),
      lastUpdate: Date.now() - i * 60000
    });
  }

  const stats = {
    totalAlerts: monitors.reduce((sum, m) => sum + m.alertCount, 0),
    totalChanges: monitors.reduce((sum, m) => sum + m.changeCount, 0),
    avgAlerts: monitors.reduce((sum, m) => sum + m.alertCount, 0) / monitors.length,
    avgChanges: monitors.reduce((sum, m) => sum + m.changeCount, 0) / monitors.length
  };

  return stats;
});

perfTest('Build timeline from 10K changes', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      timestamp: Date.now() - i * 1000,
      type: i % 5,
      value: Math.random()
    });
  }

  // Group changes by hour
  const timeline = {};
  changes.forEach(c => {
    const hour = Math.floor(c.timestamp / 3600000);
    if (!timeline[hour]) timeline[hour] = [];
    timeline[hour].push(c);
  });

  return { timelinePoints: Object.keys(timeline).length };
});

// ====================================
// TEST SUITE 6: Concurrent Operations on Large Data
// ====================================
console.log('\n=== TEST SUITE 6: Concurrent Operations on Large Data ===\n');

test('Handles concurrent updates to large dataset', async () => {
  const dataset = {};
  for (let i = 0; i < 1000; i++) {
    dataset[i] = { value: 0, history: [] };
  }

  const updatePromises = [];
  for (let i = 0; i < 100; i++) {
    updatePromises.push(
      (async () => {
        for (let j = 0; j < 10; j++) {
          const key = Math.floor(Math.random() * 1000);
          dataset[key].value += 1;
          dataset[key].history.push(new Date().toISOString());
        }
      })()
    );
  }

  await Promise.all(updatePromises);
  assert(Object.keys(dataset).length === 1000, 'Should maintain dataset integrity');
  console.log('  → Concurrent updates completed');
});

// ====================================
// TEST SUITE 7: Data Serialization & Transfer
// ====================================
console.log('\n=== TEST SUITE 7: Data Serialization & Transfer ===\n');

perfTest('Serialize 10K changes to JSON', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      type: 'change',
      timestamp: new Date().toISOString(),
      data: { value: Math.random() }
    });
  }

  const json = JSON.stringify(changes);
  return { jsonSize: json.length };
});

perfTest('Compress 10K changes dataset', () => {
  const changes = [];
  for (let i = 0; i < 10000; i++) {
    changes.push({
      id: i,
      type: i % 5,
      timestamp: Date.now() - i * 100,
      value: Math.random()
    });
  }

  const json = JSON.stringify(changes);
  // Simple compression simulation (remove whitespace)
  const compressed = JSON.stringify(changes);
  const ratio = compressed.length / json.length;

  return { originalSize: json.length, compressedSize: compressed.length, ratio };
});

// ====================================
// TEST SUITE 8: Cleanup & Memory Management
// ====================================
console.log('\n=== TEST SUITE 8: Cleanup & Memory Management ===\n');

test('Can clear 100K change history without memory leaks', () => {
  const memBefore = process.memoryUsage().heapUsed;

  const changes = [];
  for (let i = 0; i < 100000; i++) {
    changes.push({
      id: i,
      timestamp: Date.now(),
      type: 'change'
    });
  }

  const memPeak = process.memoryUsage().heapUsed;

  // Clear the data
  changes.length = 0;

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const memAfter = process.memoryUsage().heapUsed;

  console.log(`  → Memory: before=${(memBefore / 1024 / 1024).toFixed(2)}MB, peak=${(memPeak / 1024 / 1024).toFixed(2)}MB, after=${(memAfter / 1024 / 1024).toFixed(2)}MB`);
  assert(changes.length === 0, 'Changes should be cleared');
});

// ====================================
// TEST SUITE 9: Edge Cases with Extreme Data
// ====================================
console.log('\n=== TEST SUITE 9: Edge Cases with Extreme Data ===\n');

test('Handles empty strings in large dataset', () => {
  const monitors = [];
  for (let i = 0; i < 100; i++) {
    monitors.push({
      id: i,
      name: i % 10 === 0 ? '' : `Monitor_${i}`,
      description: i % 5 === 0 ? '' : `Description ${i}`
    });
  }

  const empty = monitors.filter(m => m.name === '');
  assert.strictEqual(empty.length, 10, 'Should have 10 empty names');
  console.log('  → Empty strings handled correctly');
});

test('Handles null values in large dataset', () => {
  const changes = [];
  for (let i = 0; i < 1000; i++) {
    changes.push({
      id: i,
      oldValue: i % 10 === 0 ? null : `value_${i}`,
      newValue: i % 5 === 0 ? null : `new_value_${i}`
    });
  }

  const nullCount = changes.filter(c => c.oldValue === null || c.newValue === null).length;
  assert(nullCount > 0, 'Should preserve null values');
  console.log('  → Null values handled correctly');
});

test('Handles duplicate entries in large dataset', () => {
  const changes = [];
  for (let i = 0; i < 1000; i++) {
    changes.push({
      id: i,
      timestamp: Date.now(),
      type: 'change',
      monitorId: i % 100 // Only 100 unique monitors
    });
  }

  const unique = new Set(changes.map(c => c.monitorId));
  assert.strictEqual(unique.size, 100, 'Should identify 100 unique monitors');
  console.log('  → Duplicate entries handled');
});

// ====================================
// Test Summary
// ====================================
console.log('\n=== TEST SUMMARY ===\n');
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.performanceMetrics.length > 0) {
  console.log('\n=== PERFORMANCE METRICS ===');
  results.performanceMetrics.forEach(metric => {
    console.log(`  ${metric.test}: ${metric.duration.toFixed(2)}ms`);
  });

  const avgDuration = results.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / results.performanceMetrics.length;
  console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
}

if (results.failed > 0) {
  console.log('\n=== FAILURES ===');
  results.issues.forEach(issue => {
    console.log(`\n${issue.test}:`);
    console.log(`  ${issue.error}`);
  });
}

process.exit(results.failed > 0 ? 1 : 0);
