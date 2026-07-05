#!/usr/bin/env node

/**
 * Advanced FPS Optimization Benchmarks
 * Tests multiple compression strategies and frame processing pipelines
 * Target: Achieve consistent 30+ fps for 1920x1080 screenshots
 */

const {
  ScreenshotOptimizer,
  CompressionWorkerPool,
  BufferPool
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
  console.log('\n' + COLORS.BOLD + '='.repeat(80) + COLORS.RESET);
  log(COLORS.CYAN, title);
  console.log(COLORS.BOLD + '='.repeat(80) + COLORS.RESET);
}

function result(pass, msg, details = '') {
  const icon = pass ? '✅' : '❌';
  log(pass ? COLORS.GREEN : COLORS.RED, `${icon} ${msg}`);
  if (details) {
    log(COLORS.BLUE, `   ${details}`);
  }
}

class FPSBenchmark {
  constructor() {
    this.results = [];
    this.report = '';
  }

  async runBenchmarks() {
    const reportLines = [];

    reportLines.push('# FPS Optimization Benchmark Report');
    reportLines.push(`Generated: ${new Date().toISOString()}\n`);

    // Benchmark 1: Single frame compression with different codecs
    header('Benchmark 1: Single Frame Compression (Codec Comparison)');
    const bench1 = await this.benchmarkSingleFrame();
    reportLines.push('## Benchmark 1: Single Frame Compression\n');
    reportLines.push(bench1.report);

    // Benchmark 2: Batch vs Sequential Processing
    header('Benchmark 2: Batch vs Sequential Processing');
    const bench2 = await this.benchmarkBatchVsSequential();
    reportLines.push('## Benchmark 2: Batch vs Sequential Processing\n');
    reportLines.push(bench2.report);

    // Benchmark 3: Worker Pool Efficiency
    header('Benchmark 3: Worker Pool Efficiency');
    const bench3 = await this.benchmarkWorkerPoolEfficiency();
    reportLines.push('## Benchmark 3: Worker Pool Efficiency\n');
    reportLines.push(bench3.report);

    // Benchmark 4: Sustained FPS Test (30 frames)
    header('Benchmark 4: Sustained FPS Test (30 Frames)');
    const bench4 = await this.benchmarkSustainedFPS();
    reportLines.push('## Benchmark 4: Sustained FPS Test\n');
    reportLines.push(bench4.report);

    // Benchmark 5: Frame Size Variations
    header('Benchmark 5: Frame Size Variations');
    const bench5 = await this.benchmarkFrameSizeVariations();
    reportLines.push('## Benchmark 5: Frame Size Variations\n');
    reportLines.push(bench5.report);

    // Benchmark 6: Memory Efficiency
    header('Benchmark 6: Memory Pool Efficiency');
    const bench6 = await this.benchmarkMemoryEfficiency();
    reportLines.push('## Benchmark 6: Memory Efficiency\n');
    reportLines.push(bench6.report);

    // Summary
    reportLines.push('## Summary\n');
    reportLines.push(`- Test Date: ${new Date().toISOString()}`);
    reportLines.push(`- Target FPS: 30+`);
    reportLines.push(`- Frame Size: 1920x1080 RGBA (8.3MB)`);
    reportLines.push(`- Compression Strategy: Deflate(2) with worker parallelization`);
    reportLines.push(`- Workers: ${Math.min(4, require('os').cpus().length)}`);

    this.report = reportLines.join('\n');
    return this.report;
  }

  async benchmarkSingleFrame() {
    const optimizer = new ScreenshotOptimizer();
    const frameSize = 1920 * 1080 * 4; // 8.3MB
    const frameData = Buffer.alloc(frameSize);
    // Create realistic compressible data
    for (let i = 0; i < frameSize; i++) {
      frameData[i] = Math.random() > 0.5 ? 0xFF : 0x00;
    }

    const startTime = Date.now();
    const compressionResult = await optimizer.compressFrame(frameData, 'image/png');
    const duration = Date.now() - startTime;

    await optimizer.cleanup();

    const pass = duration < 33;
    result(pass, `Single 1080p frame compression: ${duration}ms`,
      `Target: <33ms (30 fps), Ratio: ${compressionResult.ratio}%`);

    const report = [
      `**Single Frame Compression Time:** ${duration}ms`,
      `**Compression Ratio:** ${compressionResult.ratio}%`,
      `**Original Size:** ${(frameSize / 1024 / 1024).toFixed(2)}MB`,
      `**Compressed Size:** ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)}MB`,
      `**FPS Equivalent:** ${(1000 / duration).toFixed(2)} fps`,
      `**Target Achievement:** ${pass ? '✅ PASS' : '❌ FAIL'}`
    ];

    return { pass, report: report.join('\n') };
  }

  async benchmarkBatchVsSequential() {
    const optimizer = new ScreenshotOptimizer();
    const frameSize = 1920 * 1080 * 4;
    const frameCount = 4;

    // Sequential processing
    const seqFrames = Array(frameCount).fill(null).map(() => {
      const buf = Buffer.alloc(frameSize);
      for (let i = 0; i < frameSize; i++) {
        buf[i] = Math.random() > 0.5 ? 0xFF : 0x00;
      }
      return buf;
    });

    const seqStart = Date.now();
    for (const frameData of seqFrames) {
      await optimizer.compressFrame(frameData, 'image/png');
    }
    const seqDuration = Date.now() - seqStart;

    await optimizer.cleanup();

    // Batch processing
    const optimizer2 = new ScreenshotOptimizer();
    const batchFrames = Array(frameCount).fill(null).map(() => ({
      data: Buffer.alloc(frameSize),
      mimeType: 'image/png'
    }));

    batchFrames.forEach(f => {
      for (let i = 0; i < f.data.length; i++) {
        f.data[i] = Math.random() > 0.5 ? 0xFF : 0x00;
      }
    });

    const batchStart = Date.now();
    await optimizer2.compressBatch(batchFrames);
    const batchDuration = Date.now() - batchStart;

    await optimizer2.cleanup();

    const speedup = (seqDuration / batchDuration).toFixed(2);
    const pass = speedup > 1.2; // Should be at least 20% faster

    result(pass, `Batch Processing Speedup: ${speedup}x`,
      `Sequential: ${seqDuration}ms, Batch: ${batchDuration}ms`);

    const report = [
      `**Sequential Processing (4 frames):** ${seqDuration}ms`,
      `**Batch Processing (4 frames):** ${batchDuration}ms`,
      `**Speedup:** ${speedup}x`,
      `**Performance Gain:** ${((1 - batchDuration / seqDuration) * 100).toFixed(1)}%`,
      `**Target Achievement:** ${pass ? '✅ PASS' : '❌ FAIL'}`
    ];

    return { pass, report: report.join('\n') };
  }

  async benchmarkWorkerPoolEfficiency() {
    const optimizer = new ScreenshotOptimizer();
    const frameSize = 1920 * 1080 * 4;

    // Simulate heavy concurrent load
    const concurrentFrames = 8;
    const promises = Array(concurrentFrames).fill(null).map(() => {
      const buf = Buffer.alloc(frameSize);
      for (let i = 0; i < frameSize; i++) {
        buf[i] = Math.random() > 0.5 ? 0xFF : 0x00;
      }
      return optimizer.compressFrame(buf, 'image/png');
    });

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    const stats = optimizer.workerPool.getStats();
    const successRate = parseFloat(stats.successRate);

    await optimizer.cleanup();

    const avgTimePerFrame = (duration / concurrentFrames).toFixed(2);
    const pass = successRate >= 95 && parseFloat(avgTimePerFrame) < 33;

    result(pass, `Worker Pool Efficiency (8 concurrent frames)`,
      `Success Rate: ${successRate}%, Avg/Frame: ${avgTimePerFrame}ms`);

    const report = [
      `**Concurrent Frames:** ${concurrentFrames}`,
      `**Total Duration:** ${duration}ms`,
      `**Average per Frame:** ${avgTimePerFrame}ms`,
      `**Worker Success Rate:** ${successRate}%`,
      `**Completed Tasks:** ${stats.completedTasks}/${stats.totalTasks}`,
      `**Target Achievement:** ${pass ? '✅ PASS' : '❌ FAIL'}`
    ];

    return { pass, report: report.join('\n') };
  }

  async benchmarkSustainedFPS() {
    const optimizer = new ScreenshotOptimizer();
    const frameSize = 1920 * 1080 * 4;
    const framesToProcess = 30;

    const frameTimes = [];
    const startTime = Date.now();

    for (let i = 0; i < framesToProcess; i++) {
      const frameStart = Date.now();
      const buf = Buffer.alloc(frameSize);
      for (let j = 0; j < frameSize; j++) {
        buf[j] = Math.random() > 0.5 ? 0xFF : 0x00;
      }
      await optimizer.compressFrame(buf, 'image/png');
      frameTimes.push(Date.now() - frameStart);
    }

    const totalDuration = Date.now() - startTime;
    const fps = (framesToProcess / (totalDuration / 1000)).toFixed(2);
    const avgTime = (totalDuration / framesToProcess).toFixed(2);
    const maxTime = Math.max(...frameTimes).toFixed(2);
    const minTime = Math.min(...frameTimes).toFixed(2);

    await optimizer.cleanup();

    const pass = parseFloat(fps) >= 30;

    result(pass, `Sustained ${framesToProcess} Frame Processing`,
      `${fps} fps, Avg: ${avgTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);

    const report = [
      `**Frames Processed:** ${framesToProcess}`,
      `**Total Duration:** ${totalDuration}ms`,
      `**FPS Achieved:** ${fps}`,
      `**Average Frame Time:** ${avgTime}ms`,
      `**Min Frame Time:** ${minTime}ms`,
      `**Max Frame Time:** ${maxTime}ms`,
      `**Jitter (Max-Min):** ${(parseFloat(maxTime) - parseFloat(minTime)).toFixed(2)}ms`,
      `**Target Achievement:** ${pass ? '✅ PASS' : '❌ FAIL'}`
    ];

    return { pass, report: report.join('\n') };
  }

  async benchmarkFrameSizeVariations() {
    const sizes = [
      { name: 'QVGA (320x240)', width: 320, height: 240 },
      { name: 'VGA (640x480)', width: 640, height: 480 },
      { name: '720p (1280x720)', width: 1280, height: 720 },
      { name: '1080p (1920x1080)', width: 1920, height: 1080 }
    ];

    const results = [];
    const reportLines = [];

    for (const size of sizes) {
      const optimizer = new ScreenshotOptimizer();
      const frameSize = size.width * size.height * 4;
      const frameData = Buffer.alloc(frameSize);
      for (let i = 0; i < frameSize; i++) {
        frameData[i] = Math.random() > 0.5 ? 0xFF : 0x00;
      }

      const startTime = Date.now();
      const result = await optimizer.compressFrame(frameData, 'image/png');
      const duration = Date.now() - startTime;

      await optimizer.cleanup();

      const fps = (1000 / duration).toFixed(2);
      results.push({
        name: size.name,
        duration,
        fps,
        ratio: result.ratio,
        pass: duration < 33
      });

      reportLines.push(`| ${size.name} | ${duration}ms | ${fps} fps | ${result.ratio}% |`);
    }

    header('Frame Size Benchmarks');
    log(COLORS.CYAN, '| Resolution | Time | FPS | Ratio |');
    log(COLORS.CYAN, '|---|---|---|---|');
    results.forEach(r => {
      log(r.pass ? COLORS.GREEN : COLORS.YELLOW, `| ${r.name} | ${r.duration}ms | ${r.fps} | ${r.ratio}% |`);
    });

    const report = [
      '| Resolution | Time | FPS | Compression Ratio |',
      '|---|---|---|---|',
      ...reportLines
    ];

    return { pass: true, report: report.join('\n') };
  }

  async benchmarkMemoryEfficiency() {
    const pool = new BufferPool(32);
    const optimizer = new ScreenshotOptimizer();

    // Simulate frame allocation and reuse
    const buffers = [];
    for (let i = 0; i < 10; i++) {
      const buf = pool.acquire(1920 * 1080 * 4);
      buffers.push(buf);
    }

    buffers.forEach(buf => pool.release(buf));

    // Re-acquire should hit pool
    const reacquired = [];
    for (let i = 0; i < 8; i++) {
      reacquired.push(pool.acquire(1920 * 1080 * 4));
    }

    const poolStats = pool.getStats();
    const pass = poolStats.poolHits > 0;

    result(pass, 'Memory Pool Reuse Efficiency',
      `Hits: ${poolStats.poolHits}, Reuses: ${poolStats.reuses}, Allocations: ${poolStats.allocations}`);

    const report = [
      `**Pool Acquisitions:** 10`,
      `**Pool Reuses:** ${poolStats.reuses}`,
      `**Direct Allocations:** ${poolStats.allocations}`,
      `**Pool Hit Rate:** ${((poolStats.poolHits / 18) * 100).toFixed(1)}%`,
      `**Memory Efficiency:** ${pass ? '✅ PASS' : '❌ FAIL'}`
    ];

    return { pass, report: report.join('\n') };
  }

  saveReport(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, this.report);
    log(COLORS.GREEN, `Report saved to: ${outputPath}`);
  }
}

async function main() {
  const benchmark = new FPSBenchmark();
  const report = await benchmark.runBenchmarks();

  // Save report
  const reportsDir = '/home/devel/basset-hound-browser/docs/wiki/findings';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  benchmark.saveReport(path.join(reportsDir, 'fps-optimization-benchmark.md'));

  console.log('\n');
  header('Benchmark Complete');
  log(COLORS.GREEN, 'Report generated successfully');
}

main().catch(error => {
  log(COLORS.RED, `Fatal error: ${error.message}`);
  process.exit(1);
});
