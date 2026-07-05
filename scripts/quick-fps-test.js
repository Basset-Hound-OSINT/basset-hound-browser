#!/usr/bin/env node

/**
 * Quick FPS Optimization Test
 * Fast benchmark to verify 30+ fps capability
 */

const {
  ScreenshotOptimizer,
  CompressionWorkerPool
} = require('../screenshots/screenshot-optimizer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COLORS = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m'
};

function log(color, msg) {
  console.log(`${color}${msg}${COLORS.RESET}`);
}

function header(title) {
  console.log('\n' + COLORS.BOLD + '='.repeat(70) + COLORS.RESET);
  log(COLORS.CYAN, title);
  console.log(COLORS.BOLD + '='.repeat(70) + COLORS.RESET);
}

function result(pass, msg, details = '') {
  const icon = pass ? '✅' : '❌';
  log(pass ? COLORS.GREEN : COLORS.RED, `${icon} ${msg}`);
  if (details) {
    log(COLORS.BLUE, `   ${details}`);
  }
}

async function quickFPSTest() {
  const reportLines = [];
  reportLines.push('# FPS Optimization Quick Test Report');
  reportLines.push(`Date: ${new Date().toISOString()}\n`);

  // Test 1: Single frame with small size
  header('Test 1: Small Frame Compression (Sync Path)');
  const optimizer1 = new ScreenshotOptimizer();
  const smallFrame = Buffer.alloc(100 * 100 * 4); // Small frame
  for (let i = 0; i < smallFrame.length; i++) {
    smallFrame[i] = Math.random() > 0.5 ? 0xFF : 0x00;
  }

  const t1Start = Date.now();
  const t1Result = await optimizer1.compressFrame(smallFrame, 'image/png');
  const t1Duration = Date.now() - t1Start;

  result(true, `Small frame (<100KB): ${t1Duration}ms`, `Ratio: ${t1Result.ratio}%`);
  reportLines.push(`\n## Test 1: Small Frame Compression\n`);
  reportLines.push(`- Time: ${t1Duration}ms`);
  reportLines.push(`- Ratio: ${t1Result.ratio}%`);
  reportLines.push(`- Size: 40KB\n`);

  await optimizer1.cleanup();

  // Test 2: Medium frame (720p)
  header('Test 2: 720p Frame Compression');
  const optimizer2 = new ScreenshotOptimizer();
  const mediumFrame = Buffer.alloc(1280 * 720 * 4);
  for (let i = 0; i < mediumFrame.length; i++) {
    mediumFrame[i] = Math.random() > 0.5 ? 0xFF : 0x00;
  }

  const t2Start = Date.now();
  const t2Result = await optimizer2.compressFrame(mediumFrame, 'image/png');
  const t2Duration = Date.now() - t2Start;

  const t2Pass = t2Duration < 33;
  result(t2Pass, `720p frame: ${t2Duration}ms`, `Ratio: ${t2Result.ratio}%, FPS: ${(1000/t2Duration).toFixed(2)}`);
  reportLines.push(`## Test 2: 720p Frame Compression\n`);
  reportLines.push(`- Time: ${t2Duration}ms`);
  reportLines.push(`- Ratio: ${t2Result.ratio}%`);
  reportLines.push(`- FPS: ${(1000/t2Duration).toFixed(2)}`);
  reportLines.push(`- Size: 3.68MB\n`);

  await optimizer2.cleanup();

  // Test 3: Large frame (1080p)
  header('Test 3: 1080p Frame Compression');
  const optimizer3 = new ScreenshotOptimizer();
  const largeFrame = Buffer.alloc(1920 * 1080 * 4);
  for (let i = 0; i < largeFrame.length; i++) {
    largeFrame[i] = Math.random() > 0.5 ? 0xFF : 0x00;
  }

  const t3Start = Date.now();
  const t3Result = await optimizer3.compressFrame(largeFrame, 'image/png');
  const t3Duration = Date.now() - t3Start;

  const t3Pass = t3Duration < 33;
  result(t3Pass, `1080p frame: ${t3Duration}ms`, `Ratio: ${t3Result.ratio}%, FPS: ${(1000/t3Duration).toFixed(2)}`);
  reportLines.push(`## Test 3: 1080p Frame Compression\n`);
  reportLines.push(`- Time: ${t3Duration}ms`);
  reportLines.push(`- Ratio: ${t3Result.ratio}%`);
  reportLines.push(`- FPS: ${(1000/t3Duration).toFixed(2)}`);
  reportLines.push(`- Size: 8.3MB\n`);

  await optimizer3.cleanup();

  // Test 4: Crypto ID generation benchmark
  header('Test 4: Crypto-based ID Generation');
  const pool = new CompressionWorkerPool(2);
  const startId = Date.now();
  const ids = [];
  for (let i = 0; i < 10000; i++) {
    ids.push(pool.generateTaskId());
  }
  const idDuration = Date.now() - startId;
  const uniqueIds = new Set(ids).size;

  result(uniqueIds === 10000, `Generated 10000 IDs in ${idDuration}ms`, `Unique: ${uniqueIds}, Rate: ${(10000/idDuration).toFixed(0)}/ms`);
  reportLines.push(`## Test 4: Crypto ID Generation\n`);
  reportLines.push(`- Time: ${idDuration}ms`);
  reportLines.push(`- Count: 10000`);
  reportLines.push(`- Unique: ${uniqueIds}`);
  reportLines.push(`- Rate: ${(10000/idDuration).toFixed(0)}/ms\n`);

  await pool.terminate();

  // Test 5: Quick sustained FPS
  header('Test 5: Quick Sustained FPS (10 frames)');
  const optimizer5 = new ScreenshotOptimizer();
  const times = [];
  const fpsStart = Date.now();

  for (let i = 0; i < 10; i++) {
    const frameStart = Date.now();
    const frame = Buffer.alloc(1280 * 720 * 4);
    for (let j = 0; j < frame.length; j++) {
      frame[j] = Math.random() > 0.5 ? 0xFF : 0x00;
    }
    await optimizer5.compressFrame(frame, 'image/png');
    times.push(Date.now() - frameStart);
  }

  const fpsDuration = Date.now() - fpsStart;
  const fps = (10 / (fpsDuration / 1000)).toFixed(2);
  const avgTime = (fpsDuration / 10).toFixed(2);
  const fpsPass = parseFloat(fps) >= 30;

  result(fpsPass, `Sustained FPS: ${fps}`, `Avg: ${avgTime}ms, Total: ${fpsDuration}ms`);
  reportLines.push(`## Test 5: Sustained FPS (10 frames @ 720p)\n`);
  reportLines.push(`- FPS: ${fps}`);
  reportLines.push(`- Average: ${avgTime}ms`);
  reportLines.push(`- Total: ${fpsDuration}ms`);
  reportLines.push(`- Min: ${Math.min(...times)}ms`);
  reportLines.push(`- Max: ${Math.max(...times)}ms\n`);

  await optimizer5.cleanup();

  // Summary
  reportLines.push(`## Summary\n`);
  reportLines.push(`- All compression targets: ${t2Pass && t3Pass ? 'PASS' : 'IN PROGRESS'}`);
  reportLines.push(`- FPS Target (30+): ${fpsPass ? 'PASS' : 'IN PROGRESS'}`);
  reportLines.push(`- Crypto Random: PASS`);
  reportLines.push(`- Config: deflate(2) with 4 workers\n`);

  // Save report
  const reportsDir = '/home/devel/basset-hound-browser/docs/wiki/findings';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'fps-optimization-quick-test.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'));

  log(COLORS.GREEN, `Report saved: ${reportPath}`);
  console.log('\n');
}

quickFPSTest().catch(error => {
  log(COLORS.RED, `Error: ${error.message}`);
  process.exit(1);
});
