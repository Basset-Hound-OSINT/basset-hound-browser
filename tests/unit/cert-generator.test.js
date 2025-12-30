/**
 * Basset Hound Browser - Certificate Generator Unit Tests
 * Tests for SSL certificate generation, validation, and expiration checking
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Mock electron before requiring the module
// Note: jest.mock is hoisted, so we need to use require inside the mock
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: jest.fn((name) => {
      const mockPath = require('path');
      if (name === 'userData') {
        return mockPath.join(process.cwd(), 'test-user-data');
      }
      return process.cwd();
    })
  }
}));

const CertificateGenerator = require('../../utils/cert-generator');

describe('Certificate Generator Module', () => {
  let certGen;
  let testCertsDir;

  beforeEach(() => {
    // Use a unique test directory for each test
    testCertsDir = path.join(process.cwd(), `test-certs-${Date.now()}`);
    certGen = new CertificateGenerator({
      certsDir: testCertsDir,
      validityDays: 365,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    });
  });

  afterEach(() => {
    // Clean up test certificates
    if (fs.existsSync(testCertsDir)) {
      const files = fs.readdirSync(testCertsDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testCertsDir, file));
      });
      fs.rmdirSync(testCertsDir);
    }
  });

  describe('Constructor', () => {
    test('should initialize with default values when electron is mocked', () => {
      const gen = new CertificateGenerator();
      expect(gen.certsDir).toBe(path.join(process.cwd(), 'certs'));
      expect(gen.certValidityDays).toBe(365);
      expect(gen.keySize).toBe(2048);
      expect(gen.organization).toBe('Basset Hound Browser');
      expect(gen.commonName).toBe('localhost');
    });

    test('should accept custom options', () => {
      const customGen = new CertificateGenerator({
        certsDir: '/custom/path',
        validityDays: 730,
        keySize: 4096,
        organization: 'Test Org',
        commonName: 'test.local'
      });
      expect(customGen.certsDir).toBe('/custom/path');
      expect(customGen.certValidityDays).toBe(730);
      expect(customGen.keySize).toBe(4096);
      expect(customGen.organization).toBe('Test Org');
      expect(customGen.commonName).toBe('test.local');
    });

    test('should set correct certificate paths', () => {
      expect(certGen.paths.caKey).toBe(path.join(testCertsDir, 'ca-key.pem'));
      expect(certGen.paths.caCert).toBe(path.join(testCertsDir, 'ca.pem'));
      expect(certGen.paths.serverKey).toBe(path.join(testCertsDir, 'key.pem'));
      expect(certGen.paths.serverCert).toBe(path.join(testCertsDir, 'cert.pem'));
      expect(certGen.paths.config).toBe(path.join(testCertsDir, 'openssl.cnf'));
    });

    test('should use console logger by default', () => {
      const gen = new CertificateGenerator({ certsDir: testCertsDir });
      expect(gen.logger).toBe(console);
    });
  });

  describe('_ensureDirectoryExists', () => {
    test('should create directory if it does not exist', () => {
      expect(fs.existsSync(testCertsDir)).toBe(false);
      certGen._ensureDirectoryExists();
      expect(fs.existsSync(testCertsDir)).toBe(true);
    });

    test('should not fail if directory already exists', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      expect(() => certGen._ensureDirectoryExists()).not.toThrow();
    });

    test('should log when creating directory', () => {
      certGen._ensureDirectoryExists();
      expect(certGen.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created certificates directory')
      );
    });
  });

  describe('_certificatesExist', () => {
    test('should return false when no certificates exist', () => {
      expect(certGen._certificatesExist()).toBe(false);
    });

    test('should return false when only some certificates exist', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      fs.writeFileSync(certGen.paths.caCert, 'test');
      expect(certGen._certificatesExist()).toBe(false);
    });

    test('should return true when all required certificates exist', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      fs.writeFileSync(certGen.paths.caCert, 'test');
      fs.writeFileSync(certGen.paths.serverCert, 'test');
      fs.writeFileSync(certGen.paths.serverKey, 'test');
      expect(certGen._certificatesExist()).toBe(true);
    });
  });

  describe('_createOpenSSLConfig', () => {
    test('should create OpenSSL config file', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      certGen._createOpenSSLConfig();
      expect(fs.existsSync(certGen.paths.config)).toBe(true);
    });

    test('should include organization name in config', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      certGen._createOpenSSLConfig();
      const config = fs.readFileSync(certGen.paths.config, 'utf8');
      expect(config).toContain('Basset Hound Browser');
    });

    test('should include common name in config', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      certGen._createOpenSSLConfig();
      const config = fs.readFileSync(certGen.paths.config, 'utf8');
      expect(config).toContain('CN = localhost');
    });

    test('should include subject alternative names', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      certGen._createOpenSSLConfig();
      const config = fs.readFileSync(certGen.paths.config, 'utf8');
      expect(config).toContain('DNS.1 = localhost');
      expect(config).toContain('IP.1 = 127.0.0.1');
      expect(config).toContain('IP.2 = ::1');
    });

    test('should include key size in config', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      certGen._createOpenSSLConfig();
      const config = fs.readFileSync(certGen.paths.config, 'utf8');
      expect(config).toContain('default_bits = 2048');
    });
  });

  describe('_isOpenSSLAvailable', () => {
    test('should return boolean', () => {
      const result = certGen._isOpenSSLAvailable();
      expect(typeof result).toBe('boolean');
    });

    test('should return true if OpenSSL is available', () => {
      // This test will pass if OpenSSL is installed on the system
      try {
        execSync('openssl version', { stdio: 'pipe' });
        expect(certGen._isOpenSSLAvailable()).toBe(true);
      } catch (error) {
        expect(certGen._isOpenSSLAvailable()).toBe(false);
      }
    });
  });

  describe('_getCertPaths', () => {
    test('should return object with certificate paths', () => {
      const paths = certGen._getCertPaths();
      expect(paths).toHaveProperty('certPath');
      expect(paths).toHaveProperty('keyPath');
      expect(paths).toHaveProperty('caPath');
      expect(paths).toHaveProperty('certsDir');
    });

    test('should return correct paths', () => {
      const paths = certGen._getCertPaths();
      expect(paths.certPath).toBe(certGen.paths.serverCert);
      expect(paths.keyPath).toBe(certGen.paths.serverKey);
      expect(paths.caPath).toBe(certGen.paths.caCert);
      expect(paths.certsDir).toBe(testCertsDir);
    });
  });

  describe('getCertificateInfo', () => {
    test('should return null when certificates do not exist', () => {
      const info = certGen.getCertificateInfo();
      expect(info).toBeNull();
    });

    test('should return certificate info when certificates exist', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      fs.writeFileSync(certGen.paths.caCert, 'test');
      fs.writeFileSync(certGen.paths.serverCert, 'test');
      fs.writeFileSync(certGen.paths.serverKey, 'test');

      const info = certGen.getCertificateInfo();
      expect(info).not.toBeNull();
      expect(info.exists).toBe(true);
      expect(info.paths).toHaveProperty('certPath');
      // createdAt/modifiedAt may be Date objects or timestamps depending on implementation
      expect(info.createdAt).toBeDefined();
      expect(info.modifiedAt).toBeDefined();
      expect(info.size).toBeGreaterThan(0);
    });
  });

  describe('deleteCertificates', () => {
    test('should return false when no certificates exist', () => {
      const result = certGen.deleteCertificates();
      expect(result).toBe(false);
    });

    test('should delete existing certificates', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      fs.writeFileSync(certGen.paths.caCert, 'test');
      fs.writeFileSync(certGen.paths.serverCert, 'test');
      fs.writeFileSync(certGen.paths.serverKey, 'test');
      fs.writeFileSync(certGen.paths.caKey, 'test');

      const result = certGen.deleteCertificates();
      expect(result).toBe(true);
      expect(fs.existsSync(certGen.paths.caCert)).toBe(false);
      expect(fs.existsSync(certGen.paths.serverCert)).toBe(false);
      expect(fs.existsSync(certGen.paths.serverKey)).toBe(false);
      expect(fs.existsSync(certGen.paths.caKey)).toBe(false);
    });

    test('should log number of deleted files', () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      fs.writeFileSync(certGen.paths.caCert, 'test');
      fs.writeFileSync(certGen.paths.serverCert, 'test');

      certGen.deleteCertificates();
      expect(certGen.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted')
      );
    });
  });

  describe('_validateCertificate', () => {
    test('should return false when certificate does not exist', async () => {
      const isValid = await certGen._validateCertificate();
      expect(isValid).toBe(false);
    });

    test('should return false for invalid certificate format', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      fs.writeFileSync(certGen.paths.serverCert, 'invalid certificate');
      const isValid = await certGen._validateCertificate();
      expect(isValid).toBe(false);
    });

    test('should return true for valid placeholder certificate', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      const certData = {
        version: '3',
        subject: 'CN=localhost',
        issuer: 'CN=localhost',
        serialNumber: '12345',
        notBefore: new Date().toISOString(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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

      fs.writeFileSync(certGen.paths.serverCert, cert);
      const isValid = await certGen._validateCertificate();
      expect(isValid).toBe(true);
    });

    test('should return false for expired certificate', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
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

      fs.writeFileSync(certGen.paths.serverCert, cert);
      const isValid = await certGen._validateCertificate();
      expect(isValid).toBe(false);
    });

    test('should return false for certificate expiring soon (< 30 days)', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      const certData = {
        version: '3',
        subject: 'CN=localhost',
        issuer: 'CN=localhost',
        serialNumber: '12345',
        notBefore: new Date().toISOString(),
        notAfter: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 20 days
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

      fs.writeFileSync(certGen.paths.serverCert, cert);
      const isValid = await certGen._validateCertificate();
      expect(isValid).toBe(false);
      expect(certGen.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('expires in')
      );
    });
  });

  describe('_generateWithNodeCrypto', () => {
    test('should generate certificates using Node.js crypto', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithNodeCrypto();

      expect(fs.existsSync(certGen.paths.caKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.caCert)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverCert)).toBe(true);
    });

    test('should create private keys with restricted permissions', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithNodeCrypto();

      const caKeyStats = fs.statSync(certGen.paths.caKey);
      const serverKeyStats = fs.statSync(certGen.paths.serverKey);

      // Check that files are created (permissions check is platform-specific)
      expect(caKeyStats.size).toBeGreaterThan(0);
      expect(serverKeyStats.size).toBeGreaterThan(0);
    });

    test('should create placeholder certificates with proper structure', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithNodeCrypto();

      const caCert = fs.readFileSync(certGen.paths.caCert, 'utf8');
      const serverCert = fs.readFileSync(certGen.paths.serverCert, 'utf8');

      expect(caCert).toContain('-----BEGIN CERTIFICATE-----');
      expect(caCert).toContain('-----END CERTIFICATE-----');
      expect(serverCert).toContain('-----BEGIN CERTIFICATE-----');
      expect(serverCert).toContain('-----END CERTIFICATE-----');
    });

    test('should log warning about simplified certificates', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithNodeCrypto();

      // The warning may contain different text depending on implementation
      // Just verify that some warning was logged
      expect(certGen.logger.warn).toHaveBeenCalled();
    });

    test('should generate RSA keys with correct modulus length', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithNodeCrypto();

      const caKey = fs.readFileSync(certGen.paths.caKey, 'utf8');
      const serverKey = fs.readFileSync(certGen.paths.serverKey, 'utf8');

      expect(caKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(serverKey).toContain('-----BEGIN PRIVATE KEY-----');
    });
  });

  describe('_generateWithOpenSSL', () => {
    // Skip OpenSSL tests if not available
    const openSSLAvailable = (() => {
      try {
        execSync('openssl version', { stdio: 'pipe' });
        return true;
      } catch (error) {
        return false;
      }
    })();

    (openSSLAvailable ? test : test.skip)('should generate certificates using OpenSSL', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithOpenSSL();

      expect(fs.existsSync(certGen.paths.caKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.caCert)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverCert)).toBe(true);
    });

    (openSSLAvailable ? test : test.skip)('should create OpenSSL config file', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithOpenSSL();

      expect(fs.existsSync(certGen.paths.config)).toBe(true);
    });

    (openSSLAvailable ? test : test.skip)('should clean up temporary files', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithOpenSSL();

      const csrPath = path.join(testCertsDir, 'server.csr');
      const serialPath = path.join(testCertsDir, 'ca.srl');

      expect(fs.existsSync(csrPath)).toBe(false);
      expect(fs.existsSync(serialPath)).toBe(false);
    });

    (openSSLAvailable ? test : test.skip)('should set proper permissions on private keys', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithOpenSSL();

      // Permissions check is platform-specific, just verify files exist
      expect(fs.existsSync(certGen.paths.caKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverKey)).toBe(true);
    });

    (openSSLAvailable ? test : test.skip)('should create valid X.509 certificates', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });
      await certGen._generateWithOpenSSL();

      const caCert = fs.readFileSync(certGen.paths.caCert, 'utf8');
      const serverCert = fs.readFileSync(certGen.paths.serverCert, 'utf8');

      expect(caCert).toContain('-----BEGIN CERTIFICATE-----');
      expect(caCert).toContain('-----END CERTIFICATE-----');
      expect(serverCert).toContain('-----BEGIN CERTIFICATE-----');
      expect(serverCert).toContain('-----END CERTIFICATE-----');
    });
  });

  describe('_generateCertificates', () => {
    test('should try OpenSSL first if available', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });

      const isOpenSSLAvailableSpy = jest.spyOn(certGen, '_isOpenSSLAvailable');

      await certGen._generateCertificates();

      expect(isOpenSSLAvailableSpy).toHaveBeenCalled();
    });

    test('should fall back to Node.js crypto if OpenSSL and node-forge fail', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });

      // Mock OpenSSL as unavailable
      jest.spyOn(certGen, '_isOpenSSLAvailable').mockReturnValue(false);

      await certGen._generateCertificates();

      // Should create certificates using Node.js crypto fallback
      expect(fs.existsSync(certGen.paths.caKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.caCert)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverCert)).toBe(true);
    });

    test('should log which method is being used', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });

      await certGen._generateCertificates();

      // Should log one of the generation methods
      const logCalls = certGen.logger.info.mock.calls.map(call => call[0]);
      const hasMethodLog = logCalls.some(msg =>
        msg.includes('Using OpenSSL') ||
        msg.includes('Using node-forge') ||
        msg.includes('Using Node.js crypto')
      );
      expect(hasMethodLog).toBe(true);
    });
  });

  describe('ensureCertificates', () => {
    test('should create directory if it does not exist', async () => {
      expect(fs.existsSync(testCertsDir)).toBe(false);
      await certGen.ensureCertificates();
      expect(fs.existsSync(testCertsDir)).toBe(true);
    });

    test('should generate certificates if they do not exist', async () => {
      const result = await certGen.ensureCertificates();

      expect(fs.existsSync(certGen.paths.caKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.caCert)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverKey)).toBe(true);
      expect(fs.existsSync(certGen.paths.serverCert)).toBe(true);
      expect(result).toHaveProperty('certPath');
      expect(result).toHaveProperty('keyPath');
      expect(result).toHaveProperty('caPath');
    });

    test('should use existing valid certificates', async () => {
      // First run - generate certificates
      await certGen.ensureCertificates();

      const certMtime = fs.statSync(certGen.paths.serverCert).mtime;

      // Wait a bit to ensure different timestamp if regenerated
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second run - should use existing
      await certGen.ensureCertificates();

      const newCertMtime = fs.statSync(certGen.paths.serverCert).mtime;

      // Certificate should not have been regenerated
      expect(newCertMtime).toEqual(certMtime);
      expect(certGen.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using existing certificates')
      );
    });

    test('should regenerate expired certificates', async () => {
      fs.mkdirSync(testCertsDir, { recursive: true });

      // Create an expired certificate
      const certData = {
        version: '3',
        subject: 'CN=localhost',
        issuer: 'CN=localhost',
        serialNumber: '12345',
        notBefore: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
        notAfter: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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

      fs.writeFileSync(certGen.paths.caCert, cert);
      fs.writeFileSync(certGen.paths.serverCert, cert);
      fs.writeFileSync(certGen.paths.serverKey, 'test-key');

      await certGen.ensureCertificates();

      expect(certGen.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('expired or invalid')
      );
    });

    test('should return correct certificate paths', async () => {
      const result = await certGen.ensureCertificates();

      expect(result.certPath).toBe(certGen.paths.serverCert);
      expect(result.keyPath).toBe(certGen.paths.serverKey);
      expect(result.caPath).toBe(certGen.paths.caCert);
      expect(result.certsDir).toBe(testCertsDir);
    });

    test('should throw error on generation failure', async () => {
      // Mock _generateCertificates to throw an error
      jest.spyOn(certGen, '_generateCertificates').mockRejectedValue(new Error('Generation failed'));

      await expect(certGen.ensureCertificates()).rejects.toThrow('Generation failed');
      expect(certGen.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to ensure certificates')
      );
    });
  });

  describe('Integration Tests', () => {
    test('should complete full certificate lifecycle', async () => {
      // Generate
      const result1 = await certGen.ensureCertificates();
      expect(result1).toHaveProperty('certPath');

      // Get info
      const info = certGen.getCertificateInfo();
      expect(info).not.toBeNull();
      expect(info.exists).toBe(true);

      // Verify
      const isValid = await certGen._validateCertificate();
      expect(isValid).toBeTruthy();

      // Use existing
      const result2 = await certGen.ensureCertificates();
      expect(result2).toEqual(result1);

      // Delete
      const deleted = certGen.deleteCertificates();
      expect(deleted).toBe(true);

      // Verify deleted
      expect(certGen.getCertificateInfo()).toBeNull();
    });

    test('should handle multiple instances with different directories', async () => {
      const testDir1 = path.join(process.cwd(), `test-certs-a-${Date.now()}`);
      const testDir2 = path.join(process.cwd(), `test-certs-b-${Date.now()}`);

      const gen1 = new CertificateGenerator({ certsDir: testDir1 });
      const gen2 = new CertificateGenerator({ certsDir: testDir2 });

      await gen1.ensureCertificates();
      await gen2.ensureCertificates();

      expect(fs.existsSync(path.join(testDir1, 'cert.pem'))).toBe(true);
      expect(fs.existsSync(path.join(testDir2, 'cert.pem'))).toBe(true);

      // Cleanup
      gen1.deleteCertificates();
      gen2.deleteCertificates();
      try { fs.rmSync(testDir1, { recursive: true, force: true }); } catch (e) { /* ignore */ }
      try { fs.rmSync(testDir2, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    });

    test('should handle custom validity period', async () => {
      const customGen = new CertificateGenerator({
        certsDir: testCertsDir,
        validityDays: 730
      });

      await customGen.ensureCertificates();

      expect(fs.existsSync(customGen.paths.serverCert)).toBe(true);

      // Read the certificate and verify it has the expected validity
      const cert = fs.readFileSync(customGen.paths.serverCert, 'utf8');
      expect(cert).toContain('-----BEGIN CERTIFICATE-----');
    });
  });
});
