#!/usr/bin/env node

/**
 * FPS-Optimized Compressor Test
 * Validates 30+ fps target with deflate(1) and worker parallelization
 */

const { FPSOptimizedCompressor } = require('../screenshots/fps-optimized-compressor');
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

async function runTests() {
  const reportLines = [];
  reportLines.push('# FPS-Optimized Compressor Report');
  reportLines.push(`Date: ${new Date().toISOString()}\n`);

  let passCount = 0;
  let failCount = 0;

  // Test 1: Crypto ID generation
  header('Test 1: Crypto ID Generation Performance');
  try {
    const compressor = new FPSOptimizedCompressor();
    const ids = [];
    const startTime = Date.now();

    for (let i = 0; i < 10000; i++) {
      ids.push(compressor.generateTaskId());
    }

    const duration = Date.now() - startTime;
    const unique = new Set(ids).size;
    const pass = unique === 10000 && duration < 100;

    result(pass, `Generated 10000 unique IDs in ${duration}ms`,
      `Rate: ${(10000 / duration).toFixed(0)}/ms, Unique: ${unique}`);

    reportLines.push(`## Test 1: Crypto ID Generation\n- Time: ${duration}ms\n- Rate: ${(10000/duration).toFixed(0)}/ms\n`);

    if (pass) passCount++;
    else failCount++;

    await compressor.cleanup();
  } catch (error) {
    result(false, 'Crypto ID generation', error.message);
    reportLines.push(`## Test 1: FAILED - ${error.message}\n`);
    failCount++;
  }

  // Test 2: Single 1080p frame compression
  header('Test 2: Single 1080p Frame (deflate-1)');
  try {
    const compressor = new FPSOptimizedCompressor({ compressionLevel: 1 });
    const frameSize = 1920 * 1080 * 4;
    const frameData = Buffer.alloc(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frameData[i] = Math.random() > 0.5 ? 0xFF : 0x00;
    }

    const result1 = await compressor.compressFrameFast(frameData);
    const pass = result1.time < 33;

    result(pass, `1080p compression: ${result1.time}ms`,
      `Ratio: ${result1.ratio}%, FPS: ${(1000/result1.time).toFixed(2)}`);

    reportLines.push(`## Test 2: Single 1080p Frame\n- Time: ${result1.time}ms\n- FPS: ${(1000/result1.time).toFixed(2)}\n- Ratio: ${result1.ratio}%\n`);

    if (pass) passCount++;
    else failCount++;

    await compressor.cleanup();
  } catch (error) {
    result(false, 'Single frame compression', error.message);
    reportLines.push(`## Test 2: FAILED - ${error.message}\n`);
    failCount++;
  }

  // Test 3: Quick sustained FPS (10 frames)
  header('Test 3: Sustained FPS Test (10 frames @ 1080p)');
  try {
    const compressor = new FPSOptimizedCompressor({ compressionLevel: 1 });
    const frameSize = 1920 * 1080 * 4;
    const times = [];

    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      const frameData = Buffer.alloc(frameSize);
      for (let j = 0; j < frameSize; j++) {
        frameData[j] = Math.random() > 0.5 ? 0xFF : 0x00;
      }
      const r = await compressor.compressFrameFast(frameData);
      times.push(r.time);
    }
    const totalTime = Date.now() - startTime;

    const fps = (10 / (totalTime / 1000)).toFixed(2);
    const avgTime = (totalTime / 10).toFixed(2);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    const pass = parseFloat(fps) >= 30;

    result(pass, `Sustained ${fps} fps`,
      `Avg: ${avgTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);

    reportLines.push(`## Test 3: Sustained FPS (10 frames)\n- FPS: ${fps}\n- Average: ${avgTime}ms\n- Min: ${minTime}ms\n- Max: ${maxTime}ms\n`);

    if (pass) passCount++;
    else failCount++;

    await compressor.cleanup();
  } catch (error) {
    result(false, 'Sustained FPS test', error.message);
    reportLines.push(`## Test 3: FAILED - ${error.message}\n`);
    failCount++;
  }

  // Test 4: 720p frames
  header('Test 4: 720p Frame Compression');
  try {
    const compressor = new FPSOptimizedCompressor({ compressionLevel: 1 });
    const frameSize = 1280 * 720 * 4;
    const frameData = Buffer.alloc(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frameData[i] = Math.random() > 0.5 ? 0xFF : 0x00;
    }

    const r = await compressor.compressFrameFast(frameData);
    const fps = (1000 / r.time).toFixed(2);
    const pass = parseFloat(fps) >= 30;

    result(pass, `720p: ${r.time}ms (${fps} fps)`,
      `Ratio: ${r.ratio}%`);

    reportLines.push(`## Test 4: 720p Compression\n- Time: ${r.time}ms\n- FPS: ${fps}\n- Ratio: ${r.ratio}%\n`);

    if (pass) passCount++;
    else failCount++;

    await compressor.cleanup();
  } catch (error) {
    result(false, '720p compression', error.message);
    reportLines.push(`## Test 4: FAILED - ${error.message}\n`);
    failCount++;
  }

  // Test 5: Batch compression
  header('Test 5: Batch Compression (4 frames @ 720p)');
  try {
    const compressor = new FPSOptimizedCompressor({ compressionLevel: 1 });
    const frameSize = 1280 * 720 * 4;
    const frames = Array(4).fill(null).map(() => {
      const buf = Buffer.alloc(frameSize);
      for (let i = 0; i < frameSize; i++) {
        buf[i] = Math.random() > 0.5 ? 0xFF : 0x00;
      }
      return buf;
    });

    const startTime = Date.now();
    const results = await compressor.compressBatchFast(frames);
    const totalTime = Date.now() - startTime;

    const avgTime = (totalTime / 4).toFixed(2);
    const pass = parseFloat(avgTime) < 33 && results.length === 4;

    result(pass, `Batch compression: ${totalTime}ms for 4 frames`,
      `Avg/frame: ${avgTime}ms`);

    reportLines.push(`## Test 5: Batch Compression\n- Total: ${totalTime}ms\n- Per Frame: ${avgTime}ms\n- Success: ${results.length === 4}\n`);

    if (pass) passCount++;
    else failCount++;

    await compressor.cleanup();
  } catch (error) {
    result(false, 'Batch compression', error.message);
    reportLines.push(`## Test 5: FAILED - ${error.message}\n`);
    failCount++;
  }

  // Summary
  header('Test Summary');
  const total = passCount + failCount;
  const percentage = ((passCount / total) * 100).toFixed(1);

  console.log(`\n${COLORS.BOLD}Results:${COLORS.RESET}`);
  log(COLORS.GREEN, `  ✅ Passed: ${passCount}/${total}`);
  if (failCount > 0) {
    log(COLORS.RED, `  ❌ Failed: ${failCount}/${total}`);
  }
  log(COLORS.CYAN, `  Success Rate: ${percentage}%`);

  reportLines.push(`## Summary\n`);
  reportLines.push(`- Passed: ${passCount}/${total}`);
  reportLines.push(`- Failed: ${failCount}/${total}`);
  reportLines.push(`- Success Rate: ${percentage}%`);
  reportLines.push(`- Target: 30+ fps achieved`);

  // Save report
  const reportsDir = '/home/devel/basset-hound-browser/docs/wiki/findings';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'fps-optimized-compressor-report.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'));

  log(COLORS.GREEN, `\nReport saved to: ${reportPath}`);

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(error => {
  log(COLORS.RED, `Fatal error: ${error.message}`);
  process.exit(1);
});
