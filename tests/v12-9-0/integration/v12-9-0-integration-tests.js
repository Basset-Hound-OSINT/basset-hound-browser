/**
 * v12.9.0 Feature Integration Tests
 * Combined tests for the compression and forensic features working together
 * Tests WebSocket integration, performance, and cross-feature interactions
 *
 * Version: 1.0.0
 * Created: July 3, 2026
 */

const assert = require('assert');
const { AdaptiveCompressionEngine } = require('../../../src/v12-9-0/compression-engine');
const { ForensicAnalyzer } = require('../../../src/v12-9-0/forensic-analyzer');

describe('v12.9.0 Feature Integration', () => {
  let compression;
  let forensic;

  beforeEach(() => {
    compression = new AdaptiveCompressionEngine();
    forensic = new ForensicAnalyzer();
  });

  describe('Compression + Forensic Integration', () => {
    it('should compress forensic artifacts efficiently', async () => {
      // Create forensic artifact
      const htmlData = '<html><body>' + 'x'.repeat(10000) + '</body></html>';
      const artifactId = forensic.captureHTMLSnapshot(htmlData);

      // Get artifact
      const artifact = forensic.getArtifact(artifactId);
      assert(artifact);
      assert(artifact.size > 5000);

      // Compress it
      const compressed = await compression.compress(
        Buffer.from(htmlData),
        'brotli',
        'text/html'
      );

      assert(compressed.success === undefined || compressed.success !== false);
      assert(compressed.ratio < 1);
      assert(compressed.compressedSize < artifact.size);
    });

    it('should maintain forensic integrity after compression', async () => {
      const testData = Buffer.from('forensic-test-data-' + 'a'.repeat(5000));
      const originalHash = require('crypto').createHash('sha256').update(testData).digest('hex');

      // Compress
      const compressed = await compression.compress(testData);
      assert(compressed.compressedSize < testData.length);

      // Add to forensic for tracking
      const artifactId = forensic.addArtifact('compressed-data', compressed.data, {
        metadata: { originalHash, originalSize: testData.length }
      });

      // Verify integrity
      const verified = forensic.verifyArtifactIntegrity(artifactId);
      assert(verified);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume compression without degradation', async () => {
      const iterations = 100;
      const sizes = [];
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const data = Buffer.from('performance-test-' + Math.random().toString() + 'x'.repeat(1000));
        const start = Date.now();
        const result = await compression.compress(data, 'gzip');
        const duration = Date.now() - start;

        sizes.push(result.compressedSize);
        durations.push(duration);
      }

      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      assert(avgDuration < 50); // Should be fast
      assert(avgSize > 0);
    });

    it('should maintain forensic data integrity under load', async () => {
      const artifacts = [];
      const startTime = Date.now();

      // Add many artifacts
      for (let i = 0; i < 100; i++) {
        const data = Buffer.from('artifact-' + i + '-' + 'x'.repeat(500));
        const artifactId = forensic.addArtifact(`type-${i % 5}`, data, {
          tags: [`batch-${Math.floor(i / 20)}`]
        });
        artifacts.push(artifactId);

        // Record events
        forensic.recordEvent('artifact-added', { artifactId, index: i });
      }

      const duration = Date.now() - startTime;

      // Verify all artifacts
      const allArtifacts = forensic.getArtifactsList();
      assert.strictEqual(allArtifacts.length, 100);

      // Verify integrity of random samples
      const samples = artifacts.slice(0, 10);
      for (const id of samples) {
        const verified = forensic.verifyArtifactIntegrity(id);
        assert(verified);
      }

      const stats = forensic.getStatistics();
      assert.strictEqual(stats.artifactsCollected, 100);
      assert(duration < 2000); // Should process 100 artifacts in < 2 seconds
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle compression errors gracefully', async () => {
      const result = await compression.compress(null).catch(e => ({
        error: e.message
      }));

      // Should not throw unhandled
      assert(result.error || !result.success);
    });

    it('should handle forensic artifact overflow', async () => {
      const analyzer = new ForensicAnalyzer({ maxArtifacts: 10 });

      // Add artifacts up to limit
      for (let i = 0; i < 10; i++) {
        const data = Buffer.from('data-' + i);
        analyzer.addArtifact('test', data);
      }

      // Try to add beyond limit
      try {
        analyzer.addArtifact('test', Buffer.from('overflow'));
        assert.fail('Should have thrown error');
      } catch (error) {
        assert(error.message.includes('Max artifacts'));
      }
    });
  });

  describe('Feature Isolation', () => {
    it('should handle forensic analysis independently', async () => {
      // Forensic should work independently, with no external dependencies
      const artifactId = forensic.addArtifact('test', Buffer.from('test-data'));
      assert(artifactId);

      forensic.recordEvent('test-event', { data: 'test' });
      const stats = forensic.getStatistics();
      assert.strictEqual(stats.artifactsCollected, 1);
      assert(stats.eventsCaptured > 0);
    });
  });
});
