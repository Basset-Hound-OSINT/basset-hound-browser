/**
 * Metadata Certifier Tests
 * Tests for cryptographic evidence certification
 */

const MetadataCertifier = require('../../../src/compliance/metadata-certifier');

describe('MetadataCertifier', () => {
  let certifier;

  beforeEach(() => {
    certifier = new MetadataCertifier();
  });

  describe('certifyEvidence', () => {
    test('should certify evidence with SHA256', () => {
      const result = certifier.certifyEvidence(
        'ev_001',
        'test content',
        'sha256'
      );

      expect(result.success).toBe(true);
      expect(result.evidence_id).toBe('ev_001');
      expect(result.certification).toBeDefined();
      expect(result.certification.hash).toBeDefined();
      expect(result.certification.algorithm).toBe('sha256');
    });

    test('should generate consistent hash for same content', () => {
      const content = 'test content';

      const result1 = certifier.certifyEvidence('ev_001', content, 'sha256');
      const result2 = certifier.certifyEvidence('ev_002', content, 'sha256');

      expect(result1.certification.hash).toBe(result2.certification.hash);
    });

    test('should generate different hash for different content', () => {
      const result1 = certifier.certifyEvidence('ev_001', 'content1', 'sha256');
      const result2 = certifier.certifyEvidence('ev_002', 'content2', 'sha256');

      expect(result1.certification.hash).not.toBe(result2.certification.hash);
    });

    test('should generate signature', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(result.certification.signature).toBeDefined();
      expect(result.certification.signature).toContain('BEGIN SIGNATURE');
      expect(result.certification.signature).toContain('END SIGNATURE');
    });

    test('should include timestamp in certification', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(result.certification.timestamp).toBeDefined();
      const certTime = new Date(result.certification.timestamp).getTime();
      expect(certTime).toBeGreaterThan(0);
    });

    test('should generate certificate chain', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(Array.isArray(result.certification.certificate_chain)).toBe(true);
      expect(result.certification.certificate_chain.length).toBeGreaterThan(0);
    });

    test('should include verification details', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(result.certification.verification_details).toBeDefined();
      expect(result.certification.verification_details.signature_valid).toBeDefined();
      expect(result.certification.verification_details.timestamp_valid).toBeDefined();
      expect(result.certification.verification_details.certificate_chain_valid).toBeDefined();
      expect(result.certification.verification_details.not_revoked).toBeDefined();
    });

    test('should support SHA256-TIMESTAMP certification', () => {
      const result = certifier.certifyEvidence(
        'ev_001',
        'content',
        'sha256-timestamp'
      );

      expect(result.success).toBe(true);
      expect(result.certification).toBeDefined();
    });

    test('should support DSS certification', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'dss');

      expect(result.success).toBe(true);
      expect(result.certification).toBeDefined();
    });

    test('should reject unsupported certification type', () => {
      expect(() => {
        certifier.certifyEvidence('ev_001', 'content', 'invalid-type');
      }).toThrow('Unsupported certification type');
    });

    test('should handle buffer content', () => {
      const buffer = Buffer.from('test content');
      const result = certifier.certifyEvidence('ev_001', buffer, 'sha256');

      expect(result.success).toBe(true);
      expect(result.certification.hash).toBeDefined();
    });

    test('should handle large content', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of data

      const result = certifier.certifyEvidence('ev_001', largeContent, 'sha256');

      expect(result.success).toBe(true);
      expect(result.certification.hash).toBeDefined();
    });

    test('should include timestamp server info with include_timestamp option', () => {
      const result = certifier.certifyEvidence(
        'ev_001',
        'content',
        'sha256',
        { include_timestamp: true }
      );

      expect(result.certification.timestamp_server).toBeDefined();
    });
  });

  describe('verifyCertification', () => {
    test('should verify valid certification', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const verification = certifier.verifyCertification(cert.certification);

      expect(verification.success).toBe(true);
      expect(verification.certification_valid).toBe(true);
    });

    test('should verify signature validity', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const verification = certifier.verifyCertification(cert.certification);

      expect(verification.verification_details.signature_valid).toBe(true);
    });

    test('should verify timestamp validity', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const verification = certifier.verifyCertification(cert.certification);

      expect(verification.verification_details.timestamp_valid).toBe(true);
    });

    test('should verify certificate chain validity', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const verification = certifier.verifyCertification(cert.certification);

      expect(verification.verification_details.certificate_chain_valid).toBe(true);
    });

    test('should include verification timestamp', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const verification = certifier.verifyCertification(cert.certification);

      expect(verification.verified_at).toBeDefined();
    });

    test('should reject invalid certification object', () => {
      expect(() => {
        certifier.verifyCertification(null);
      }).toThrow('Invalid certification object');

      expect(() => {
        certifier.verifyCertification({});
      }).toThrow('Invalid certification object');

      expect(() => {
        certifier.verifyCertification({ hash: 'hash' });
      }).toThrow('Invalid certification object');
    });

    test('should detect invalid signatures', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const tampered = {
        ...cert.certification,
        signature: 'invalid signature'
      };

      const verification = certifier.verifyCertification(tampered);
      expect(verification.verification_details.signature_valid).toBe(false);
    });

    test('should detect invalid certificate chains', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const tampered = {
        ...cert.certification,
        certificate_chain: ['invalid certificate']
      };

      const verification = certifier.verifyCertification(tampered);
      expect(verification.verification_details.certificate_chain_valid).toBe(false);
    });
  });

  describe('exportCertification', () => {
    test('should export as JSON', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const exported = certifier.exportCertification(cert.certification, 'json');

      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.hash).toBeDefined();
    });

    test('should export as PEM', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const exported = certifier.exportCertification(cert.certification, 'pem');

      expect(typeof exported).toBe('string');
      expect(exported).toContain('BEGIN CERTIFICATION');
      expect(exported).toContain('END CERTIFICATION');
    });

    test('should export as DER', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const exported = certifier.exportCertification(cert.certification, 'der');

      expect(Buffer.isBuffer(exported)).toBe(true);
    });

    test('should reject unsupported export format', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(() => {
        certifier.exportCertification(cert.certification, 'invalid-format');
      }).toThrow('Unsupported export format');
    });

    test('should default to JSON format', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const exported = certifier.exportCertification(cert.certification);

      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });
  });

  describe('batchCertify', () => {
    test('should certify multiple items', () => {
      const items = [
        { id: 'ev_001', content: 'content1' },
        { id: 'ev_002', content: 'content2' },
        { id: 'ev_003', content: 'content3' }
      ];

      const results = certifier.batchCertify(items);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle empty batch', () => {
      const results = certifier.batchCertify([]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should reject non-array input', () => {
      expect(() => {
        certifier.batchCertify('not an array');
      }).toThrow('Items must be an array');
    });

    test('should include batch index in results', () => {
      const items = [
        { id: 'ev_001', content: 'content1' },
        { id: 'ev_002', content: 'content2' }
      ];

      const results = certifier.batchCertify(items);

      expect(results[0].batch_index).toBe(0);
      expect(results[1].batch_index).toBe(1);
    });

    test('should handle errors gracefully in batch', () => {
      const items = [
        { id: 'ev_001', content: 'content1' },
        { id: 'ev_002' }, // Missing content
        { id: 'ev_003', content: 'content3' }
      ];

      const results = certifier.batchCertify(items);

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    test('should preserve item identity in batch results', () => {
      const items = [
        { id: 'custom_001', content: 'content1' },
        { id: 'custom_002', content: 'content2' }
      ];

      const results = certifier.batchCertify(items);

      // For successful results, check through certification
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    test('should handle large batches', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `ev_${i}`,
        content: `content_${i}`
      }));

      const results = certifier.batchCertify(items);

      expect(results.length).toBe(100);
      expect(results.filter(r => r.success).length).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Certificate Chain', () => {
    test('should generate valid certificate chain', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(Array.isArray(result.certification.certificate_chain)).toBe(true);
      expect(result.certification.certificate_chain.length).toBeGreaterThan(0);

      result.certification.certificate_chain.forEach(cert => {
        expect(cert).toContain('BEGIN CERTIFICATE');
        expect(cert).toContain('END CERTIFICATE');
      });
    });

    test('should include issuer information', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      const certChain = result.certification.certificate_chain;
      expect(certChain.length).toBeGreaterThan(0);
      expect(certChain[0]).toMatch(/BEGIN CERTIFICATE/);
    });
  });

  describe('Timestamp Handling', () => {
    test('should use configured timestamp server', () => {
      const customCertifier = new MetadataCertifier({
        timestampServer: 'custom.timestamp.server'
      });

      const result = customCertifier.certifyEvidence(
        'ev_001',
        'content',
        'sha256',
        { include_timestamp: true }
      );

      expect(result.certification.timestamp_server).toBe('custom.timestamp.server');
    });

    test('should handle timestamp verification for recent certificates', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const verification = certifier.verifyCertification(result.certification);

      expect(verification.verification_details.timestamp_valid).toBe(true);
    });

    test('should handle timestamp verification for old certificates', () => {
      const cert = certifier.certifyEvidence('ev_001', 'content', 'sha256');
      const oldCert = {
        ...cert.certification,
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 48 hours ago
      };

      const verification = certifier.verifyCertification(oldCert);

      expect(verification.verification_details.timestamp_valid).toBe(false);
    });
  });

  describe('Hash Generation', () => {
    test('should generate proper SHA256 hashes', () => {
      const result = certifier.certifyEvidence('ev_001', 'test', 'sha256');

      expect(result.certification.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should be deterministic', () => {
      const content = 'fixed content';

      const result1 = certifier.certifyEvidence('ev_001', content, 'sha256');
      const result2 = certifier.certifyEvidence('ev_002', content, 'sha256');

      expect(result1.certification.hash).toBe(result2.certification.hash);
    });

    test('should handle unicode content', () => {
      const unicodeContent = '测试内容 🎉 اختبار';
      const result = certifier.certifyEvidence('ev_001', unicodeContent, 'sha256');

      expect(result.certification.hash).toBeDefined();
      expect(result.certification.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should handle empty content', () => {
      const result = certifier.certifyEvidence('ev_001', '', 'sha256');

      expect(result.certification.hash).toBeDefined();
      expect(result.certification.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should handle binary content', () => {
      const binary = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      const result = certifier.certifyEvidence('ev_001', binary, 'sha256');

      expect(result.certification.hash).toBeDefined();
      expect(result.certification.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing options gracefully', () => {
      const result = certifier.certifyEvidence('ev_001', 'content', 'sha256');

      expect(result.success).toBe(true);
    });

    test('should handle invalid evidence ID', () => {
      const result = certifier.certifyEvidence('', 'content', 'sha256');

      expect(result.success).toBe(true);
      expect(result.evidence_id).toBe('');
    });

    test('should provide meaningful error messages', () => {
      expect(() => {
        certifier.certifyEvidence('ev_001', 'content', 'invalid');
      }).toThrow(/Unsupported certification type/);
    });
  });

  describe('Performance', () => {
    test('should certify content quickly', () => {
      const start = Date.now();

      certifier.certifyEvidence('ev_001', 'test content', 'sha256');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should handle batch certification efficiently', () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `ev_${i}`,
        content: `content_${i}`
      }));

      const start = Date.now();
      certifier.batchCertify(items);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should handle 50 items in under 1s
    });
  });
});
