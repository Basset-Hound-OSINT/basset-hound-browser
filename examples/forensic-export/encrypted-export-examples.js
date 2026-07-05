/**
 * Encrypted Export Examples
 *
 * Demonstrates usage of the EncryptedExportManager
 * Shows both WebSocket and direct API usage
 *
 * @example Run with: node examples/encrypted-export-examples.js
 */

const { EncryptedExportManager } = require('../extraction/encrypted-export-manager');
const WebSocket = require('ws');

// ============================================================================
// Example 1: Direct API Usage (No WebSocket)
// ============================================================================

async function example1_directApi() {
  console.log('\n=== Example 1: Direct API Usage ===\n');

  const manager = new EncryptedExportManager();

  // Generate a random key
  console.log('1. Generating encryption key...');
  const key = manager.generateKey();
  console.log(`   Key: ${key.toString('base64').substring(0, 20)}...`);

  // Encrypt HTML data
  console.log('\n2. Encrypting HTML export...');
  const htmlData = '<html><body><h1>Secret Page</h1></body></html>';
  const encrypted = manager.encryptExport(htmlData, key);

  console.log(`   Original size: ${encrypted.originalSize} bytes`);
  console.log(`   Encrypted size: ${encrypted.encryptedSize} bytes`);
  console.log(`   Encryption time: ${encrypted.encryptionTime.toFixed(2)}ms`);
  console.log(`   Compression ratio: ${encrypted.compressionRatio.toFixed(2)}`);

  // Decrypt
  console.log('\n3. Decrypting...');
  const decrypted = manager.decryptExport(encrypted.encrypted, key);

  console.log(`   Decryption time: ${decrypted.decryptionTime.toFixed(2)}ms`);
  console.log(`   Integrity verified: ${decrypted.integrityVerified}`);
  console.log(`   Data matches: ${decrypted.data === htmlData}`);
  console.log(`   Decrypted preview: ${decrypted.data.substring(0, 50)}...`);

  // Performance stats
  console.log('\n4. Performance Statistics');
  const stats = manager.getPerformanceStats();
  console.log(`   Encryption P95: ${stats.encryptionPerformance?.p95?.toFixed(2)}ms`);
  console.log(`   Decryption P95: ${stats.decryptionPerformance?.p95?.toFixed(2)}ms`);
  console.log(`   Within targets: E=${stats.withinTargets.encryption}, D=${stats.withinTargets.decryption}`);
}

// ============================================================================
// Example 2: Password-Based Encryption
// ============================================================================

async function example2_passwordBased() {
  console.log('\n=== Example 2: Password-Based Encryption ===\n');

  const manager = new EncryptedExportManager();
  const password = 'MySecurePassword123!';

  console.log(`1. Encrypting with password: ${password}`);
  const data = JSON.stringify({
    url: 'https://example.com',
    html: '<html>...</html>',
    timestamp: new Date().toISOString()
  });

  const encrypted = manager.encryptExport(data, password);

  console.log(`   Is password-based: ${encrypted.isPasswordBased}`);
  console.log(`   Salt: ${encrypted.salt?.toString('base64').substring(0, 20)}...`);
  console.log(`   Derivation: ${encrypted.derivation.algorithm}, ${encrypted.derivation.iterations} iterations`);

  console.log('\n2. Decrypting with same password...');
  const decrypted = manager.decryptExport(encrypted.encrypted, password);
  const parsed = JSON.parse(decrypted.data);

  console.log(`   URL: ${parsed.url}`);
  console.log(`   Data restored: ${decrypted.data.length} bytes`);

  console.log('\n3. Attempting with wrong password...');
  try {
    manager.decryptExport(encrypted.encrypted, 'WrongPassword');
    console.log('   ERROR: Should have thrown!');
  } catch (error) {
    console.log(`   Correctly rejected: ${error.message}`);
  }
}

// ============================================================================
// Example 3: Large Payload Encryption
// ============================================================================

async function example3_largePayload() {
  console.log('\n=== Example 3: Large Payload Encryption ===\n');

  const manager = new EncryptedExportManager();
  const key = manager.generateKey();

  // Create 10MB of network logs
  console.log('1. Creating large payload (10MB)...');
  const requests = Array(100000).fill({
    url: 'https://api.example.com/data',
    method: 'GET',
    status: 200,
    duration: 150,
    headers: { 'content-type': 'application/json' },
    size: 1024
  });

  const largeData = JSON.stringify({
    timestamp: new Date().toISOString(),
    requestCount: requests.length,
    requests
  });

  console.log(`   Payload size: ${(largeData.length / 1024 / 1024).toFixed(2)}MB`);

  // Encrypt
  console.log('\n2. Encrypting large payload...');
  const start = Date.now();
  const encrypted = manager.encryptExport(largeData, key);
  const encTime = Date.now() - start;

  console.log(`   Encrypted size: ${(encrypted.encryptedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Encryption time: ${encTime.toFixed(0)}ms`);
  console.log(`   Within target (<50ms): ${encTime < 50 ? 'YES' : 'NO'}`);

  // Decrypt
  console.log('\n3. Decrypting large payload...');
  const decStart = Date.now();
  const decrypted = manager.decryptExport(encrypted.encrypted, key);
  const decTime = Date.now() - decStart;

  console.log(`   Decrypted size: ${(decrypted.originalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Decryption time: ${decTime.toFixed(0)}ms`);
  console.log(`   Within target (<200ms): ${decTime < 200 ? 'YES' : 'NO'}`);

  const parsed = JSON.parse(decrypted.data);
  console.log(`   Verified: ${parsed.requestCount} requests intact`);
}

// ============================================================================
// Example 4: HMAC Integrity Verification
// ============================================================================

async function example4_hmacIntegrity() {
  console.log('\n=== Example 4: HMAC Integrity Verification ===\n');

  const manager = new EncryptedExportManager();
  const key = manager.generateKey();
  const data = 'Sensitive forensic data';

  console.log('1. Encrypting with HMAC...');
  const encrypted = manager.encryptExportWithHmac(data, key);

  console.log(`   Encrypted: ${encrypted.encrypted.length} bytes`);
  console.log(`   HMAC: ${encrypted.hmac.toString('base64').substring(0, 20)}...`);
  console.log(`   HMAC Key: ${encrypted.hmacKey.toString('base64').substring(0, 20)}...`);

  console.log('\n2. Verifying HMAC...');
  const isValid = manager.verifyHmac(
    encrypted.encrypted,
    encrypted.hmac,
    encrypted.hmacKey
  );

  console.log(`   HMAC valid: ${isValid}`);

  console.log('\n3. Tampering with data (corrupting a byte)...');
  const corrupted = Buffer.from(encrypted.encrypted);
  corrupted[50]++;

  try {
    manager.verifyHmac(corrupted, encrypted.hmac, encrypted.hmacKey);
    console.log('   ERROR: Should have detected tampering!');
  } catch (error) {
    console.log(`   Correctly detected: ${error.message}`);
  }
}

// ============================================================================
// Example 5: WebSocket Integration
// ============================================================================

async function example5_websocketIntegration() {
  console.log('\n=== Example 5: WebSocket Integration ===\n');

  // Note: This requires a running Basset Hound server
  // In a real environment, update 'localhost:8765' to your server

  const serverUrl = 'ws://localhost:8765';

  console.log(`Connecting to ${serverUrl}...`);

  return new Promise((resolve) => {
    const ws = new WebSocket(serverUrl);

    ws.on('open', async () => {
      console.log('Connected!\n');

      try {
        // 1. Generate key
        console.log('1. Requesting key generation...');
        ws.send(JSON.stringify({
          command: 'generate_export_key',
          params: {}
        }));

        ws.on('message', (data) => {
          const response = JSON.parse(data);

          if (response.command === 'generate_export_key') {
            console.log(`   Generated key: ${response.result.key.substring(0, 20)}...`);

            // 2. Derive from password
            console.log('\n2. Requesting password derivation...');
            ws.send(JSON.stringify({
              command: 'derive_export_key',
              params: { password: 'test-password' }
            }));
          } else if (response.command === 'derive_export_key') {
            console.log(`   Derived key: ${response.result.key.substring(0, 20)}...`);
            console.log(`   Salt: ${response.result.salt.substring(0, 20)}...`);

            // 3. Encrypt
            console.log('\n3. Requesting encryption...');
            ws.send(JSON.stringify({
              command: 'encrypt_export',
              params: {
                data: 'Test data to encrypt',
                password: 'test-password'
              }
            }));
          } else if (response.command === 'encrypt_export') {
            console.log(`   Encrypted: ${response.result.encryptedSize} bytes`);
            console.log(`   Time: ${response.result.encryptionTime.toFixed(2)}ms`);
            console.log(`   IV: ${response.result.iv.substring(0, 20)}...`);

            // 4. Get stats
            console.log('\n4. Requesting stats...');
            ws.send(JSON.stringify({
              command: 'get_encryption_stats',
              params: {}
            }));
          } else if (response.command === 'get_encryption_stats') {
            const stats = response.result.stats;
            console.log(`   Operations: ${stats.operations.encryptionOperations} encrypt, ${stats.operations.decryptionOperations} decrypt`);
            console.log(`   Throughput: ${(stats.operations.totalDataEncrypted / 1024 / 1024).toFixed(2)}MB encrypted`);

            ws.close();
            resolve();
          }
        });
      } catch (error) {
        console.error(`Error: ${error.message}`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error: ${error.message}`);
      console.log('(Make sure Basset Hound server is running on port 8765)');
      resolve();
    });
  });
}

// ============================================================================
// Example 6: Unicode and Binary Data
// ============================================================================

async function example6_unicodeBinary() {
  console.log('\n=== Example 6: Unicode and Binary Data ===\n');

  const manager = new EncryptedExportManager();
  const key = manager.generateKey();

  console.log('1. Encrypting Unicode data...');
  const unicodeData = '你好世界 🎉 مرحبا بالعالم 🔐';
  const encrypted = manager.encryptExport(unicodeData, key);

  console.log(`   Original: ${unicodeData}`);
  console.log(`   Size: ${encrypted.originalSize} bytes`);

  const decrypted = manager.decryptExport(encrypted.encrypted, key);
  console.log(`   Decrypted: ${decrypted.data}`);
  console.log(`   Match: ${decrypted.data === unicodeData}`);

  console.log('\n2. Encrypting data with null bytes...');
  const binaryData = Buffer.from('data\x00\x00\x00data');
  const encBinary = manager.encryptExport(binaryData, key);

  console.log(`   Original length: ${binaryData.length}`);
  console.log(`   Encrypted length: ${encBinary.encryptedSize}`);

  const decBinary = manager.decryptExport(encBinary.encrypted, key);
  console.log(`   Decrypted matches: ${Buffer.from(decBinary.data).equals(binaryData)}`);
}

// ============================================================================
// Example 7: Performance Benchmarking
// ============================================================================

async function example7_performanceBenchmark() {
  console.log('\n=== Example 7: Performance Benchmarking ===\n');

  const manager = new EncryptedExportManager();
  const key = manager.generateKey();

  console.log('Running encryption benchmarks...\n');

  const sizes = [1024, 10 * 1024, 100 * 1024, 1024 * 1024];
  const results = [];

  for (const size of sizes) {
    const data = 'X'.repeat(size);
    let totalTime = 0;

    for (let i = 0; i < 10; i++) {
      const encrypted = manager.encryptExport(data, key);
      totalTime += encrypted.encryptionTime;
    }

    const avgTime = totalTime / 10;
    results.push({
      size: (size / 1024).toFixed(1),
      avgTime: avgTime.toFixed(2)
    });

    console.log(`  ${(size / 1024).toFixed(0)}KB: ${avgTime.toFixed(2)}ms avg`);
  }

  console.log('\nFinal statistics:');
  const stats = manager.getPerformanceStats();
  console.log(`  Total operations: ${stats.operations.encryptionOperations}`);
  console.log(`  P95 encryption: ${stats.encryptionPerformance.p95.toFixed(2)}ms`);
  console.log(`  P99 encryption: ${stats.encryptionPerformance.p99.toFixed(2)}ms`);
  console.log(`  Within target: ${stats.withinTargets.encryption ? 'YES' : 'NO'}`);
}

// ============================================================================
// Main: Run examples
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Encrypted Export Manager - Examples                   ║');
  console.log('║         AES-256-GCM Encryption for Forensic Exports           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    await example1_directApi();
    await example2_passwordBased();
    await example3_largePayload();
    await example4_hmacIntegrity();
    await example6_unicodeBinary();
    await example7_performanceBenchmark();

    // Skip WebSocket example if server not running
    // await example5_websocketIntegration();

    console.log('\n' +
      '╔════════════════════════════════════════════════════════════════╗\n' +
      '║                  All Examples Complete!                        ║\n' +
      '╚════════════════════════════════════════════════════════════════╝\n'
    );
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
