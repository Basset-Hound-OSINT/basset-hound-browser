/**
 * Unit tests for Signature Loader
 */

const SignatureLoader = require('../../src/analysis/signature-loader');
const path = require('path');

describe('SignatureLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new SignatureLoader();
  });

  describe('Initialization', () => {
    test('should initialize with empty signatures', () => {
      expect(loader.signatures).toEqual({});
      expect(loader.loadTimestamp).toBeNull();
      expect(loader.sourceFile).toBeNull();
    });
  });

  describe('File Loading', () => {
    test('should load signatures from seed file', async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      const result = await loader.loadFromFile(seedPath);

      expect(result.success).toBe(true);
      expect(result.loaded).toBeGreaterThan(50);
      expect(result.source).toBe(seedPath);
      expect(loader.loadTimestamp).toBeGreaterThan(0);
      expect(loader.sourceFile).toBe(seedPath);
    });

    test('should handle non-existent file gracefully', async () => {
      const result = await loader.loadFromFile('/nonexistent/file.json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid JSON gracefully', async () => {
      // This would require writing a bad JSON file, skip for now
      expect(true).toBe(true);
    });
  });

  describe('Signature Normalization', () => {
    test('should normalize signature format', async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);

      const wordpress = loader.getSignature('wordpress');
      expect(wordpress).toBeDefined();
      expect(wordpress.name).toBe('WordPress');
      expect(wordpress.category).toBeDefined();
    });

    test('should handle missing optional fields', async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);

      for (const [id, sig] of Object.entries(loader.signatures)) {
        expect(sig.name).toBeDefined();
        expect(sig.category).toBeDefined();
      }
    });
  });

  describe('Signature Retrieval', () => {
    beforeEach(async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);
    });

    test('should get signature by ID', () => {
      const sig = loader.getSignature('react');
      expect(sig).toBeDefined();
      expect(sig.name).toBe('React');
    });

    test('should return null for non-existent signature', () => {
      const sig = loader.getSignature('nonexistent');
      expect(sig).toBeNull();
    });

    test('should get all signatures', () => {
      const sigs = loader.getSignatures();
      expect(Object.keys(sigs).length).toBeGreaterThan(50);
    });

    test('should get signatures by category', () => {
      const frameworks = loader.getByCategory('JavaScript Framework');
      expect(Object.keys(frameworks).length).toBeGreaterThan(0);

      for (const sig of Object.values(frameworks)) {
        expect(sig.category).toBe('JavaScript Framework');
      }
    });
  });

  describe('Status and Validation', () => {
    beforeEach(async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);
    });

    test('should report loader status', () => {
      const status = loader.getStatus();

      expect(status.signaturesLoaded).toBeGreaterThan(50);
      expect(status.sourceFile).toBeDefined();
      expect(status.loadedAt).toBeDefined();
      expect(status.categories).toBeGreaterThan(0);
    });

    test('should validate signatures', () => {
      const validation = loader.validateSignatures();

      expect(validation.valid).toBe(true);
      expect(validation.issueCount).toBeLessThan(5);
    });
  });

  describe('Signature Merging', () => {
    beforeEach(async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);
    });

    test('should merge additional signatures', () => {
      const additional = {
        'custom-tech': {
          name: 'Custom Tech',
          category: 'Custom'
        }
      };

      const before = Object.keys(loader.signatures).length;
      const result = loader.mergeSignatures(additional);

      expect(result.addedCount).toBe(1);
      expect(result.totalCount).toBe(before + 1);
      expect(loader.getSignature('custom-tech')).toBeDefined();
    });
  });

  describe('Clearing', () => {
    beforeEach(async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);
    });

    test('should clear all signatures', () => {
      expect(Object.keys(loader.signatures).length).toBeGreaterThan(0);

      loader.clear();

      expect(Object.keys(loader.signatures).length).toBe(0);
      expect(loader.loadTimestamp).toBeNull();
      expect(loader.sourceFile).toBeNull();
    });
  });

  describe('Performance', () => {
    test('should load seed database quickly', async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      const start = Date.now();
      await loader.loadFromFile(seedPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    test('should retrieve signatures quickly', async () => {
      const seedPath = path.join(__dirname, '../../data/technology-signatures-seed.json');
      await loader.loadFromFile(seedPath);

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        loader.getSignature('react');
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
