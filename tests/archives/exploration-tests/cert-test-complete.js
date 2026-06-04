#!/usr/bin/env node
/**
 * Complete SSL Certificate Generation Test
 * Tests all three generation methods: OpenSSL, node-forge, and Node.js crypto
 */

const fs = require('fs');
const path = require('path');
const CertificateGenerator = require('../utils/cert-generator');

// Test configuration
const TEST_DIR = path.join(__dirname, `complete-cert-test-${Date.now()}`);
const RESULTS = {
  openssl: { tested: false, success: false, time: 0, error: null },
  nodeForge: { tested: false, success: false, time: 0, error: null },
  nodeCrypto: { tested: false, success: false, time: 0, error: null }
};

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, GREEN);
}

function logError(message) {
  log(`❌ ${message}`, RED);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, BLUE);
}

function logWarning(message) {
  log(`⚠️  ${message}`, YELLOW);
}

async function testMethod(method, testDir, forceMethod = null) {
  const startTime = Date.now();

  try {
    logInfo(`Testing ${method} method...`);

    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create certificate generator
    const options = {
      certsDir: testDir,
      validityDays: 365,
      organization: 'Test Org',
      commonName: 'test.local'
    };

    const generator = new CertificateGenerator(options);

    // Force specific method if requested
    if (forceMethod === 'node-forge') {
      // Temporarily disable OpenSSL detection
      const originalCheck = generator.checkOpenSSL;
      generator.checkOpenSSL = () => false;

      await generator.ensureCertificates();

      // Restore original method
      generator.checkOpenSSL = originalCheck;
    } else if (forceMethod === 'crypto') {
      // Disable both OpenSSL and node-forge
      const originalCheck = generator.checkOpenSSL;
      generator.checkOpenSSL = () => false;

      // Mock node-forge as unavailable
      const Module = require('module');
      const originalRequire = Module.prototype.require;
      Module.prototype.require = function(id) {
        if (id === 'node-forge') {
          throw new Error('Module not found (mocked)');
        }
        return originalRequire.apply(this, arguments);
      };

      await generator.ensureCertificates();

      // Restore
      Module.prototype.require = originalRequire;
      generator.checkOpenSSL = originalCheck;
    } else {
      // Normal generation (will use OpenSSL if available)
      await generator.ensureCertificates();
    }

    // Verify all files exist
    const files = ['ca.pem', 'ca-key.pem', 'cert.pem', 'key.pem'];
    for (const file of files) {
      const filePath = path.join(testDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file: ${file}`);
      }
      const stats = fs.statSync(filePath);
      logInfo(`  ${file}: ${stats.size} bytes`);
    }

    // Validate certificates exist and have content
    if (!generator._certificatesExist()) {
      throw new Error('Certificate files do not exist');
    }

    // Try to read and verify certificates have content
    const certContent = fs.readFileSync(path.join(testDir, 'cert.pem'), 'utf8');
    if (!certContent.includes('BEGIN CERTIFICATE')) {
      throw new Error('Certificate file is not a valid PEM certificate');
    }

    logInfo('  ✓ All certificate files generated and valid');

    const elapsed = Date.now() - startTime;
    logSuccess(`${method} method completed in ${elapsed}ms`);

    return { success: true, time: elapsed, error: null };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logError(`${method} method failed: ${error.message}`);
    return { success: false, time: elapsed, error: error.message };
  }
}

async function cleanup(dir) {
  try {
    if (fs.existsSync(dir)) {
      // Delete all files
      const files = fs.readdirSync(dir);
      for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
      }
      // Delete directory
      fs.rmdirSync(dir);
      logInfo(`Cleaned up test directory: ${dir}`);
    }
  } catch (error) {
    logWarning(`Cleanup failed: ${error.message}`);
  }
}

async function runTests() {
  log('\n' + '='.repeat(70), BLUE);
  log('Complete SSL Certificate Generation Test Suite', BLUE);
  log('='.repeat(70) + '\n', BLUE);

  // Test 1: OpenSSL method (if available)
  log('\n--- Test 1: OpenSSL Method ---\n', BLUE);
  const opensslDir = `${TEST_DIR}-openssl`;
  RESULTS.openssl = await testMethod('OpenSSL', opensslDir);
  RESULTS.openssl.tested = true;
  await cleanup(opensslDir);

  // Test 2: node-forge method
  log('\n--- Test 2: node-forge Method ---\n', BLUE);
  const forgeDir = `${TEST_DIR}-forge`;
  RESULTS.nodeForge = await testMethod('node-forge', forgeDir, 'node-forge');
  RESULTS.nodeForge.tested = true;
  await cleanup(forgeDir);

  // Test 3: Node.js crypto fallback
  log('\n--- Test 3: Node.js Crypto Fallback ---\n', BLUE);
  const cryptoDir = `${TEST_DIR}-crypto`;
  RESULTS.nodeCrypto = await testMethod('Node.js crypto', cryptoDir, 'crypto');
  RESULTS.nodeCrypto.tested = true;
  await cleanup(cryptoDir);

  // Summary
  log('\n' + '='.repeat(70), BLUE);
  log('Test Results Summary', BLUE);
  log('='.repeat(70) + '\n', BLUE);

  const methods = [
    { name: 'OpenSSL', result: RESULTS.openssl },
    { name: 'node-forge', result: RESULTS.nodeForge },
    { name: 'Node.js crypto', result: RESULTS.nodeCrypto }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const { name, result } of methods) {
    if (result.tested) {
      if (result.success) {
        logSuccess(`${name.padEnd(20)} PASS (${result.time}ms)`);
        passCount++;
      } else {
        logError(`${name.padEnd(20)} FAIL - ${result.error}`);
        failCount++;
      }
    } else {
      logWarning(`${name.padEnd(20)} NOT TESTED`);
    }
  }

  log('\n' + '-'.repeat(70), BLUE);
  log(`Total: ${passCount + failCount} tests, ${passCount} passed, ${failCount} failed`,
      failCount === 0 ? GREEN : RED);
  log('-'.repeat(70) + '\n', BLUE);

  // Exit code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
