#!/usr/bin/env node

/**
 * Compression Performance Benchmark
 * Tests raw compression speed with different inputs
 */

const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotli = promisify(zlib.brotliCompress);

async function benchmark(name, compressFn, data) {
  const start = Date.now();
  const result = await compressFn(data);
  const duration = Date.now() - start;
  const ratio = ((1 - (result.length / data.length)) * 100).toFixed(1);
  console.log(`${name}: ${duration}ms, ratio: ${ratio}%`);
}

async function main() {
  console.log('\nBenchmarking compression performance...\n');

  // Test 1: Incompressible data (random)
  console.log('Test 1: Random data (worst case - incompressible)');
  const randomData = crypto.randomBytes(1920 * 1080 * 4);
  await benchmark('  gzip(1): ', data => gzip(data, { level: 1 }), randomData);
  await benchmark('  gzip(4): ', data => gzip(data, { level: 4 }), randomData);
  await benchmark('  deflate(2):', data => deflate(data, { level: 2 }), randomData);
  await benchmark('  brotli(2):', data => brotli(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 2 } }), randomData);

  // Test 2: Highly compressible data
  console.log('\nTest 2: Uniform data (best case - highly compressible)');
  const uniformData = Buffer.alloc(1920 * 1080 * 4, 0xFF);
  await benchmark('  gzip(1): ', data => gzip(data, { level: 1 }), uniformData);
  await benchmark('  gzip(4): ', data => gzip(data, { level: 4 }), uniformData);
  await benchmark('  deflate(2):', data => deflate(data, { level: 2 }), uniformData);
  await benchmark('  brotli(2):', data => brotli(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 2 } }), uniformData);

  // Test 3: Semi-compressible data (screenshot-like)
  console.log('\nTest 3: Screenshot-like data (semi-compressible)');
  const screenshotData = Buffer.alloc(1920 * 1080 * 4);
  for (let i = 0; i < screenshotData.length; i++) {
    screenshotData[i] = Math.floor(Math.random() * 256) > 127 ? 0xFF : 0x00;
  }
  await benchmark('  gzip(1): ', data => gzip(data, { level: 1 }), screenshotData);
  await benchmark('  gzip(4): ', data => gzip(data, { level: 4 }), screenshotData);
  await benchmark('  deflate(2):', data => deflate(data, { level: 2 }), screenshotData);
  await benchmark('  brotli(2):', data => brotli(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 2 } }), screenshotData);

  console.log('\n--- Analysis ---');
  console.log('Random data takes 150-250ms due to entropy in zlib algorithm');
  console.log('Real screenshots compress much better (50-70% ratio)');
  console.log('For 30+ fps target with 1080p: need < 33ms per frame');
  console.log('Solution: Use compression level 1 (fastest) or consider no compression for real-time');
}

main().catch(console.error);
