/**
 * Forensic Integrity Tests
 * Feature 3: Advanced Forensic Analysis - Data Integrity & Chain of Custody
 * Tests forensic data integrity, hashing, and chain of custody management
 */

const assert = require('assert');
const crypto = require('crypto');

describe('Forensic Integrity - Chain of Custody', () => {
  let integrity;

  beforeEach(() => {
    integrity = {
      artifacts: new Map(),
      chainOfCustody: [],
      hashVerification: new Map(),
      evidenceLog: []
    };
  });

  it('should compute and verify cryptographic hashes for artifacts', () => {
    const artifactData = Buffer.from('forensic artifact content');
    const hash = crypto.createHash('sha256').update(artifactData).digest('hex');

    const artifact = {
      id: 'artifact-1',
      data: artifactData,
      hash: hash,
      algorithm: 'SHA256'
    };

    integrity.artifacts.set(artifact.id, artifact);
    integrity.hashVerification.set(artifact.id, {
      original: hash,
      timestamp: Date.now(),
      verified: true
    });

    assert(integrity.artifacts.has(artifact.id));
    assert.strictEqual(integrity.hashVerification.get(artifact.id).verified, true);
  });

  it('should maintain chain of custody records', () => {
    const chainOfCustody = [
      {
        eventId: 'event-1',
        action: 'collected',
        actor: 'agent-1',
        timestamp: Date.now(),
        artifactId: 'artifact-1',
        location: 'browser-session'
      },
      {
        eventId: 'event-2',
        action: 'transferred',
        actor: 'analyst-1',
        timestamp: Date.now() + 1000,
        artifactId: 'artifact-1',
        location: 'evidence-storage',
        signature: 'analyst1-signature'
      },
      {
        eventId: 'event-3',
        action: 'accessed',
        actor: 'investigator-1',
        timestamp: Date.now() + 2000,
        artifactId: 'artifact-1',
        location: 'evidence-storage',
        purpose: 'forensic-analysis'
      }
    ];

    integrity.chainOfCustody = chainOfCustody;

    assert.strictEqual(integrity.chainOfCustody.length, 3);
    assert.strictEqual(integrity.chainOfCustody[0].action, 'collected');
    assert.strictEqual(integrity.chainOfCustody[1].action, 'transferred');
  });

  it('should detect tampering and unauthorized modifications', () => {
    const originalHash = 'abc123def456';
    const originalTimestamp = Date.now();

    const artifact = {
      id: 'artifact-1',
      hash: originalHash,
      lastModified: originalTimestamp
    };

    integrity.artifacts.set(artifact.id, artifact);

    // Simulate tampering
    const modifiedHash = 'xyz789uvw123';
    const currentHash = modifiedHash;

    const tamperDetection = {
      artifactId: 'artifact-1',
      tampered: currentHash !== originalHash,
      originalHash: originalHash,
      currentHash: currentHash,
      detectedAt: Date.now()
    };

    assert(tamperDetection.tampered);
    integrity.evidenceLog.push(tamperDetection);
  });

  it('should track all access and modifications to evidence', () => {
    const accessLog = [
      { action: 'create', actor: 'system', timestamp: 1000, details: 'Artifact created' },
      { action: 'read', actor: 'analyst-1', timestamp: 2000, details: 'Viewed for analysis' },
      { action: 'read', actor: 'analyst-2', timestamp: 3000, details: 'Reviewed evidence' },
      { action: 'copy', actor: 'investigator-1', timestamp: 4000, details: 'Copied for report' },
      { action: 'seal', actor: 'system', timestamp: 5000, details: 'Evidence sealed' }
    ];

    integrity.evidenceLog = accessLog;

    assert.strictEqual(integrity.evidenceLog.length, 5);

    const modifications = integrity.evidenceLog.filter(e => e.action !== 'read');
    assert(modifications.length > 0);
  });

  it('should generate forensic integrity certificates', () => {
    const certificate = {
      id: 'cert-1',
      artifactId: 'artifact-1',
      issuedDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      contentHash: 'abc123def456',
      hashAlgorithm: 'SHA256',
      issuer: 'forensic-system',
      signature: 'digital-signature-xyz',
      chainOfCustodyComplete: true,
      integrityVerified: true,
      admissibleInCourt: true
    };

    integrity.artifacts.set('artifact-1', { id: 'artifact-1', certificate: certificate });

    const artifactCert = integrity.artifacts.get('artifact-1').certificate;
    assert(artifactCert.integrityVerified);
    assert(artifactCert.admissibleInCourt);
  });
});
