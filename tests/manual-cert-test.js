#!/usr/bin/env node
/**
 * Manual Test Script for Certificate Generator
 * This script tests the certificate generator without requiring Jest
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mock electron
const electronMock = {
  app: {
    isPackaged: false,
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(process.cwd(), 'test-user-data');
      }
      return process.cwd();
    }
  }
};

// Inject electron mock before requiring CertificateGenerator
require.cache.electron = { exports: electronMock };

const CertificateGenerator = require('../utils/cert-generator');

// Test utilities
let passedTests = 0;
let failedTests = 0;
const failedTestNames = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    failedTests++;
    failedTestNames.push(name);
  }
}

async function asyncTest(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    failedTests++;
    failedTestNames.push(name);
  }
}

// Cleanup helper
function cleanup(dir) {
  if (fs.existsSync(dir)) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        fs.unlinkSync(path.join(dir, file));
      });
      fs.rmdirSync(dir);
    } catch (error) {
      console.warn(`Cleanup warning: ${error.message}`);
    }
  }
}

// Main test suite
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Certificate Generator Test Suite');
  console.log('═══════════════════════════════════════════════════════════\n');

  const testDir = path.join(process.cwd(), `manual-test-certs-${Date.now()}`);

  try {
    // Test 1: Constructor with default values
    test('Constructor with default values', () => {
      const gen = new CertificateGenerator({ certsDir: testDir });
      assert(gen.certValidityDays === 365, 'Default validity should be 365 days');
      assert(gen.keySize === 2048, 'Default key size should be 2048');
      assert(gen.organization === 'Basset Hound Browser', 'Default organization should be set');
      assert(gen.commonName === 'localhost', 'Default common name should be localhost');
    });

    // Test 2: Constructor with custom options
    test('Constructor with custom options', () => {
      const gen = new CertificateGenerator({
        certsDir: testDir,
        validityDays: 730,
        keySize: 4096,
        organization: 'Test Org',
        commonName: 'test.local'
      });
      assert(gen.certValidityDays === 730, 'Custom validity should be 730 days');
      assert(gen.keySize === 4096, 'Custom key size should be 4096');
      assert(gen.organization === 'Test Org', 'Custom organization should be set');
      assert(gen.commonName === 'test.local', 'Custom common name should be set');
    });

    // Test 3: Check if OpenSSL is available
    test('Check OpenSSL availability', () => {
      const gen = new CertificateGenerator({ certsDir: testDir });
      const available = gen._isOpenSSLAvailable();
      console.log(`   OpenSSL available: ${available}`);
      assert(typeof available === 'boolean', 'Should return boolean');
    });

    // Test 4: Certificate paths are set correctly
    test('Certificate paths are set correctly', () => {
      const gen = new CertificateGenerator({ certsDir: testDir });
      assert(gen.paths.caKey === path.join(testDir, 'ca-key.pem'), 'CA key path should be correct');
      assert(gen.paths.caCert === path.join(testDir, 'ca.pem'), 'CA cert path should be correct');
      assert(gen.paths.serverKey === path.join(testDir, 'key.pem'), 'Server key path should be correct');
      assert(gen.paths.serverCert === path.join(testDir, 'cert.pem'), 'Server cert path should be correct');
    });

    // Test 5: Ensure directory exists
    await asyncTest('Ensure directory exists', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });
      assert(!fs.existsSync(testDir), 'Directory should not exist initially');
      gen._ensureDirectoryExists();
      assert(fs.existsSync(testDir), 'Directory should be created');
    });

    // Test 6: Certificates do not exist initially
    test('Certificates do not exist initially', () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });
      assert(!gen._certificatesExist(), 'Certificates should not exist');
    });

    // Test 7: Generate certificates with Node.js crypto
    await asyncTest('Generate certificates with Node.js crypto', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });
      fs.mkdirSync(testDir, { recursive: true });
      await gen._generateWithNodeCrypto();

      assert(fs.existsSync(gen.paths.caKey), 'CA key should exist');
      assert(fs.existsSync(gen.paths.caCert), 'CA cert should exist');
      assert(fs.existsSync(gen.paths.serverKey), 'Server key should exist');
      assert(fs.existsSync(gen.paths.serverCert), 'Server cert should exist');

      const caCert = fs.readFileSync(gen.paths.caCert, 'utf8');
      assert(caCert.includes('-----BEGIN CERTIFICATE-----'), 'CA cert should have proper format');
      assert(caCert.includes('-----END CERTIFICATE-----'), 'CA cert should have proper format');
    });

    // Test 8: OpenSSL config file creation
    test('OpenSSL config file creation', () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });
      fs.mkdirSync(testDir, { recursive: true });
      gen._createOpenSSLConfig();

      assert(fs.existsSync(gen.paths.config), 'Config file should exist');
      const config = fs.readFileSync(gen.paths.config, 'utf8');
      assert(config.includes('Basset Hound Browser'), 'Config should include organization');
      assert(config.includes('CN = localhost'), 'Config should include common name');
      assert(config.includes('DNS.1 = localhost'), 'Config should include SANs');
      assert(config.includes('IP.1 = 127.0.0.1'), 'Config should include IP SANs');
    });

    // Test 9: Generate certificates with OpenSSL (if available)
    await asyncTest('Generate certificates with OpenSSL (if available)', async () => {
      const gen = new CertificateGenerator({ certsDir: testDir });

      if (!gen._isOpenSSLAvailable()) {
        console.log('   ⚠️  OpenSSL not available, skipping test');
        return;
      }

      cleanup(testDir);
      fs.mkdirSync(testDir, { recursive: true });
      await gen._generateWithOpenSSL();

      assert(fs.existsSync(gen.paths.caKey), 'CA key should exist');
      assert(fs.existsSync(gen.paths.caCert), 'CA cert should exist');
      assert(fs.existsSync(gen.paths.serverKey), 'Server key should exist');
      assert(fs.existsSync(gen.paths.serverCert), 'Server cert should exist');

      // Verify it's a real X.509 certificate
      const caCert = fs.readFileSync(gen.paths.caCert, 'utf8');
      assert(caCert.includes('-----BEGIN CERTIFICATE-----'), 'CA cert should be in PEM format');

      // Try to verify the certificate with OpenSSL
      try {
        execSync(`openssl x509 -in "${gen.paths.serverCert}" -noout -text`, { stdio: 'pipe' });
        console.log('   ✓ OpenSSL successfully verified the certificate');
      } catch (error) {
        throw new Error('OpenSSL could not verify the generated certificate');
      }
    });

    // Test 10: Full certificate generation with ensureCertificates
    await asyncTest('Full certificate generation with ensureCertificates', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });

      const result = await gen.ensureCertificates();

      assert(result.certPath === gen.paths.serverCert, 'Should return correct cert path');
      assert(result.keyPath === gen.paths.serverKey, 'Should return correct key path');
      assert(result.caPath === gen.paths.caCert, 'Should return correct CA path');
      assert(fs.existsSync(result.certPath), 'Certificate file should exist');
      assert(fs.existsSync(result.keyPath), 'Key file should exist');
      assert(fs.existsSync(result.caPath), 'CA file should exist');
    });

    // Test 11: Use existing certificates
    await asyncTest('Use existing certificates (no regeneration)', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });

      // Generate first time
      await gen.ensureCertificates();
      const mtime1 = fs.statSync(gen.paths.serverCert).mtime;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate second time - should use existing
      await gen.ensureCertificates();
      const mtime2 = fs.statSync(gen.paths.serverCert).mtime;

      assert(mtime1.getTime() === mtime2.getTime(), 'Certificate should not be regenerated');
    });

    // Test 12: Validate certificate
    await asyncTest('Validate certificate', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });

      await gen.ensureCertificates();
      const isValid = await gen._validateCertificate();

      assert(isValid, 'Certificate should be valid');
    });

    // Test 13: Certificate info
    await asyncTest('Get certificate info', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });

      // No certificates yet
      let info = gen.getCertificateInfo();
      assert(info === null, 'Should return null when no certificates exist');

      // Generate certificates
      await gen.ensureCertificates();
      info = gen.getCertificateInfo();

      assert(info !== null, 'Should return info object');
      assert(info.exists === true, 'Should indicate certificates exist');
      assert(info.createdAt instanceof Date, 'Should have creation date');
      assert(info.size > 0, 'Should have file size');
    });

    // Test 14: Delete certificates
    await asyncTest('Delete certificates', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });

      // Generate certificates
      await gen.ensureCertificates();
      assert(gen._certificatesExist(), 'Certificates should exist');

      // Delete certificates
      const deleted = gen.deleteCertificates();
      assert(deleted === true, 'Should return true when certificates deleted');
      assert(!gen._certificatesExist(), 'Certificates should not exist after deletion');
    });

    // Test 15: Expired certificate detection
    await asyncTest('Detect expired certificate', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });
      fs.mkdirSync(testDir, { recursive: true });

      // Create an expired certificate
      const certData = {
        version: '3',
        subject: 'CN=localhost',
        issuer: 'CN=localhost',
        serialNumber: '12345',
        notBefore: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
        notAfter: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
        publicKey: 'test-key',
        note: 'Test certificate'
      };
      const base64 = Buffer.from(JSON.stringify(certData)).toString('base64');
      const lines = base64.match(/.{1,64}/g) || [];
      const cert = [
        '-----BEGIN CERTIFICATE-----',
        ...lines,
        '-----END CERTIFICATE-----'
      ].join('\n');

      fs.writeFileSync(gen.paths.serverCert, cert);

      const isValid = await gen._validateCertificate();
      assert(!isValid, 'Expired certificate should be invalid');
    });

    // Test 16: Certificate expiring soon
    await asyncTest('Detect certificate expiring soon', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });
      fs.mkdirSync(testDir, { recursive: true });

      // Create a certificate expiring in 20 days
      const certData = {
        version: '3',
        subject: 'CN=localhost',
        issuer: 'CN=localhost',
        serialNumber: '12345',
        notBefore: new Date().toISOString(),
        notAfter: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        publicKey: 'test-key',
        note: 'Test certificate'
      };
      const base64 = Buffer.from(JSON.stringify(certData)).toString('base64');
      const lines = base64.match(/.{1,64}/g) || [];
      const cert = [
        '-----BEGIN CERTIFICATE-----',
        ...lines,
        '-----END CERTIFICATE-----'
      ].join('\n');

      fs.writeFileSync(gen.paths.serverCert, cert);

      const isValid = await gen._validateCertificate();
      assert(!isValid, 'Certificate expiring soon should be invalid');
    });

    // Test 17: Full lifecycle test
    await asyncTest('Full certificate lifecycle', async () => {
      cleanup(testDir);
      const gen = new CertificateGenerator({ certsDir: testDir });

      // Generate
      const paths = await gen.ensureCertificates();
      assert(paths.certPath, 'Should return cert path');

      // Verify
      const isValid = await gen._validateCertificate();
      assert(isValid, 'Certificate should be valid');

      // Get info
      const info = gen.getCertificateInfo();
      assert(info.exists, 'Should show certificates exist');

      // Delete
      const deleted = gen.deleteCertificates();
      assert(deleted, 'Should delete certificates');

      // Verify deletion
      assert(!gen._certificatesExist(), 'Certificates should be gone');
    });

  } finally {
    // Final cleanup
    cleanup(testDir);
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total tests: ${passedTests + failedTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.log('\nFailed tests:');
    failedTestNames.forEach(name => console.log(`  - ${name}`));
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
