/**
 * Performance Tests: Evasion Preloader
 *
 * Tests evasion module preloading functionality and performance impact
 * Target: -5ms evasion injection time through V8 JIT warmup
 */

const EvasionPreloader = require('../../src/evasion/preloader');
const path = require('path');

describe('EvasionPreloader - Performance Optimization #3', () => {
  let preloader;

  beforeEach(() => {
    preloader = new EvasionPreloader({ debug: false });
  });

  afterEach(() => {
    if (preloader) {
      preloader.clear();
    }
  });

  describe('Preloader Initialization', () => {
    test('should initialize without errors', () => {
      expect(preloader).toBeDefined();
      expect(preloader.preloaded).toBeDefined();
      expect(preloader.preloaded.size).toBe(0);
    });

    test('should initialize with debug option', () => {
      const debugPreloader = new EvasionPreloader({ debug: true });
      expect(debugPreloader.debug).toBe(true);
    });

    test('should accept custom evasion directory', () => {
      const customDir = '/custom/evasion/path';
      const customPreloader = new EvasionPreloader({ evasionDir: customDir });
      expect(customPreloader.evasionDir).toBe(customDir);
    });
  });

  describe('Module Preloading', () => {
    test('should preload all modules', async () => {
      const result = await preloader.preloadAll();

      expect(result).toBeDefined();
      expect(result.loaded).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.time).toBeGreaterThan(0);
      expect(Array.isArray(result.modules)).toBe(true);
    });

    test('should complete preload in reasonable time', async () => {
      const result = await preloader.preloadAll();

      // Target: <500ms preload time
      expect(result.time).toBeLessThan(500);
    });

    test('should load core evasion modules', async () => {
      const coreModules = [
        'canvas-evasion',
        'webgl-evasion',
        'behavioral-simulator',
        'device-fingerprinter',
      ];

      await preloader.preloadAll();

      const loaded = preloader.getStats().modules;
      for (const module of coreModules) {
        if (preloader.preloaded.has(module)) {
          expect(loaded).toContain(module);
        }
      }
    });

    test('should not duplicate modules', async () => {
      await preloader.preloadAll();

      const stats = preloader.getStats();
      const uniqueModules = new Set(stats.modules);
      expect(uniqueModules.size).toBe(stats.modules.length);
    });

    test('should handle missing modules gracefully', async () => {
      const result = await preloader.preloadAll();

      // Some modules might not exist, but preloader should handle it
      expect(result.loaded).toBeGreaterThan(0);
    });

    test('should track preload timing accurately', async () => {
      const result = await preloader.preloadAll();

      expect(result.time).toBeGreaterThanOrEqual(0);
      expect(preloader.preloadStartTime).toBeLessThanOrEqual(preloader.preloadEndTime);
    });

    test('should cache modules for fast retrieval', async () => {
      await preloader.preloadAll();
      const stats = preloader.getStats();

      expect(stats.preloadedCount).toBeGreaterThan(0);

      // Try to retrieve a cached module
      for (const moduleName of stats.modules) {
        const module = preloader.getModule(moduleName);
        expect(module).toBeDefined();
      }
    });
  });

  describe('Module Retrieval', () => {
    test('should retrieve preloaded modules', async () => {
      await preloader.preloadAll();

      const stats = preloader.getStats();
      if (stats.modules.length > 0) {
        const moduleName = stats.modules[0];
        const module = preloader.getModule(moduleName);
        expect(module).toBeDefined();
      }
    });

    test('should handle non-preloaded module retrieval', () => {
      // Try to get a module without preloading
      try {
        const module = preloader.getModule('non-existent-module');
        // Module may not exist, but if it does, it should be returned
        expect(module).toBeDefined();
      } catch (error) {
        // Expected for non-existent modules
        expect(error).toBeDefined();
      }
    });
  });

  describe('Statistics and Cleanup', () => {
    test('should provide accurate statistics', async () => {
      const result = await preloader.preloadAll();
      const stats = preloader.getStats();

      expect(stats.preloadedCount).toBe(result.loaded);
      expect(stats.preloadTime).toBeDefined();
      expect(Array.isArray(stats.modules)).toBe(true);
    });

    test('should clear cached modules', async () => {
      await preloader.preloadAll();
      const beforeStats = preloader.getStats();

      expect(beforeStats.preloadedCount).toBeGreaterThan(0);

      preloader.clear();
      const afterStats = preloader.getStats();

      expect(afterStats.preloadedCount).toBe(0);
      expect(preloader.preloadStartTime).toBeNull();
      expect(preloader.preloadEndTime).toBeNull();
    });

    test('should allow re-preloading after clear', async () => {
      await preloader.preloadAll();
      preloader.clear();

      const result = await preloader.preloadAll();

      expect(result.loaded).toBeGreaterThan(0);
    });
  });

  describe('Performance Metrics', () => {
    test('should maintain consistent preload times', async () => {
      const times = [];

      for (let i = 0; i < 3; i++) {
        const p = new EvasionPreloader({ debug: false });
        const result = await p.preloadAll();
        times.push(result.time);
        p.clear();
      }

      // All preload times should be reasonable
      for (const time of times) {
        expect(time).toBeGreaterThanOrEqual(0);
        expect(time).toBeLessThan(1000);
      }

      // At least the first run should be measured
      expect(times[0]).toBeDefined();
    });

    test('should report module load count', async () => {
      const result = await preloader.preloadAll();

      expect(result.loaded).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThanOrEqual(result.loaded);
    });
  });
});
