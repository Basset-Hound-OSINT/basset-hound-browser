#!/usr/bin/env node
/**
 * Simple Certificate Generator Verification Script
 * Tests basic functionality of the certificate generator
 */

const fs = require('fs');
const path = require('path');

console.log('Certificate Generator Simple Test\n');
console.log('=' .repeat(60));

try {
  // Load the module
  const CertificateGenerator = require('../utils/cert-generator');
  console.log('✓ CertificateGenerator module loaded successfully');

  // Create instance
  const testDir = path.join(__dirname, `test-certs-${Date.now()}`);
  const gen = new CertificateGenerator({ certsDir: testDir });
  console.log('✓ CertificateGenerator instance created');

  // Check properties
  console.log('\nConfiguration:');
  console.log(`  - Certs directory: ${gen.certsDir}`);
  console.log(`  - Validity days: ${gen.certValidityDays}`);
  console.log(`  - Key size: ${gen.keySize}`);
  console.log(`  - Organization: ${gen.organization}`);
  console.log(`  - Common name: ${gen.commonName}`);

  // Check paths
  console.log('\nCertificate paths:');
  console.log(`  - CA Key: ${gen.paths.caKey}`);
  console.log(`  - CA Cert: ${gen.paths.caCert}`);
  console.log(`  - Server Key: ${gen.paths.serverKey}`);
  console.log(`  - Server Cert: ${gen.paths.serverCert}`);
  console.log(`  - OpenSSL Config: ${gen.paths.config}`);

  // Check OpenSSL availability
  const hasOpenSSL = gen._isOpenSSLAvailable();
  console.log(`\nOpenSSL available: ${hasOpenSSL ? 'YES' : 'NO'}`);

  // Test certificate generation
  console.log('\nTesting certificate generation...');
  gen.ensureCertificates().then(result => {
    console.log('✓ Certificates generated successfully!');
    console.log(`  - Cert path: ${result.certPath}`);
    console.log(`  - Key path: ${result.keyPath}`);
    console.log(`  - CA path: ${result.caPath}`);

    // Verify files exist
    const filesExist = [
      result.certPath,
      result.keyPath,
      result.caPath
    ].every(p => fs.existsSync(p));

    console.log(`\nFiles exist: ${filesExist ? 'YES' : 'NO'}`);

    if (filesExist) {
      console.log('\nFile sizes:');
      console.log(`  - CA cert: ${fs.statSync(result.caPath).size} bytes`);
      console.log(`  - Server cert: ${fs.statSync(result.certPath).size} bytes`);
      console.log(`  - Server key: ${fs.statSync(result.keyPath).size} bytes`);

      // Show certificate content (first few lines)
      const cert = fs.readFileSync(result.certPath, 'utf8');
      const lines = cert.split('\n').slice(0, 3).join('\n');
      console.log(`\nServer certificate preview:\n${lines}...`);
    }

    // Cleanup
    console.log('\nCleaning up test files...');
    gen.deleteCertificates();
    fs.rmdirSync(testDir);
    console.log('✓ Cleanup complete');

    console.log('\n' + '='.repeat(60));
    console.log('All basic tests passed! ✓');
    console.log('='.repeat(60));
  }).catch(error => {
    console.error('\n✗ Error generating certificates:');
    console.error(error);
    process.exit(1);
  });

} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
