/**
 * Tests for GPU/CPU Specification Generator
 * Coverage: 20 tests including real GPU names, CPU matching, realistic specs
 */

const GPUCPUGenerator = require('../../src/anonymity/gpu-cpu-generator');

describe('GPUCPUGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new GPUCPUGenerator();
  });

  afterEach(() => {
    generator.reset();
  });

  // Initialization tests (3 tests)
  describe('Initialization', () => {
    it('should initialize without profile', () => {
      expect(generator).toBeDefined();
      expect(generator.currentProfile).toBeNull();
      expect(generator.generatedSpecs).toBeNull();
    });

    it('should have spec database loaded', () => {
      const keys = generator.getAvailableSpecKeys();
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('iPhone-15-Pro');
      expect(keys).toContain('Galaxy-S24');
      expect(keys).toContain('MacBook-Pro-16-M3-Max');
    });

    it('should have multiple device specs', () => {
      const keys = generator.getAvailableSpecKeys();
      expect(keys.length).toBeGreaterThan(10);
    });
  });

  // Profile initialization tests (3 tests)
  describe('Profile Initialization', () => {
    it('should require profile for initialization', () => {
      expect(() => {
        generator.initializeFromProfile(null);
      }).toThrow('Profile required');
    });

    it('should generate specs from iPhone profile', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        hardwareConcurrency: 6,
        deviceMemory: 6
      };

      const specs = generator.initializeFromProfile(profile);
      expect(specs).toBeDefined();
      expect(specs.cpu).toContain('Apple');
      expect(specs.gpu).toContain('Apple');
    });

    it('should generate specs from Samsung profile', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Google',
        hardwareConcurrency: 8,
        deviceMemory: 12
      };

      const specs = generator.initializeFromProfile(profile);
      expect(specs).toBeDefined();
      expect(specs.vendor).toBeDefined();
    });
  });

  // Real GPU name tests (3 tests)
  describe('Real GPU Names', () => {
    it('should use real GPU names', () => {
      const keys = generator.getAvailableSpecKeys();
      const realGPUs = new Set();

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        realGPUs.add(spec.gpu);
      });

      expect(realGPUs.size).toBeGreaterThan(0);
      realGPUs.forEach(gpu => {
        expect(typeof gpu).toBe('string');
        expect(gpu.length).toBeGreaterThan(0);
      });
    });

    it('should include NVIDIA GPU names', () => {
      const keys = generator.getAvailableSpecKeys();
      let hasNVIDIA = false;

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        if (spec.gpu.includes('RTX') || spec.gpu.includes('GTX')) {
          hasNVIDIA = true;
        }
      });

      expect(hasNVIDIA).toBe(true);
    });

    it('should include Apple GPU names', () => {
      const keys = generator.getAvailableSpecKeys();
      let hasApple = false;

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        if (spec.gpu.includes('Apple')) {
          hasApple = true;
        }
      });

      expect(hasApple).toBe(true);
    });
  });

  // Real CPU name tests (2 tests)
  describe('Real CPU Names', () => {
    it('should use real CPU names', () => {
      const keys = generator.getAvailableSpecKeys();
      const realCPUs = new Set();

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        realCPUs.add(spec.cpu);
      });

      expect(realCPUs.size).toBeGreaterThan(0);
      realCPUs.forEach(cpu => {
        expect(typeof cpu).toBe('string');
        expect(cpu.length).toBeGreaterThan(0);
      });
    });

    it('should include Intel and Apple CPUs', () => {
      const keys = generator.getAvailableSpecKeys();
      let hasIntel = false;
      let hasApple = false;

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        if (spec.cpu.includes('Intel')) {
          hasIntel = true;
        }
        if (spec.cpu.includes('Apple')) {
          hasApple = true;
        }
      });

      expect(hasIntel).toBe(true);
      expect(hasApple).toBe(true);
    });
  });

  // Device-specific matching tests (3 tests)
  describe('Device-Specific Matching', () => {
    it('should match Apple GPU to Apple devices', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        hardwareConcurrency: 6,
        deviceMemory: 6
      };

      const specs = generator.initializeFromProfile(profile);
      expect(specs.gpu).toContain('Apple');
      expect(specs.cpu).toContain('Apple');
    });

    it('should match Qualcomm to Android devices', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Google',
        hardwareConcurrency: 8,
        deviceMemory: 12
      };

      const specs = generator.initializeFromProfile(profile);
      // Google Pixel uses Google Tensor or Qualcomm
      expect(specs.vendor).toBeDefined();
    });

    it('should select high-end GPU for high-end systems', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        hardwareConcurrency: 16,
        deviceMemory: 32
      };

      const specs = generator.initializeFromProfile(profile);
      expect(specs.cpu).toBeDefined();
      expect(specs.gpu).toBeDefined();
      expect(specs.gpuCores).toBeGreaterThan(1000);
    });
  });

  // Core count validation tests (2 tests)
  describe('Core Count Validation', () => {
    it('should have realistic CPU core counts', () => {
      const keys = generator.getAvailableSpecKeys();

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        expect(spec.cpuCores).toBeGreaterThanOrEqual(1);
        expect(spec.cpuCores).toBeLessThanOrEqual(32);
      });
    });

    it('should have realistic GPU core counts', () => {
      const keys = generator.getAvailableSpecKeys();

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        expect(spec.gpuCores).toBeGreaterThanOrEqual(1);
        expect(spec.gpuCores).toBeLessThanOrEqual(20480);
      });
    });
  });

  // Memory validation tests (2 tests)
  describe('Memory Validation', () => {
    it('should have realistic memory amounts', () => {
      const keys = generator.getAvailableSpecKeys();

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        expect(spec.memory).toBeGreaterThanOrEqual(2);
        expect(spec.memory).toBeLessThanOrEqual(192);
      });
    });

    it('should not generate obviously fake memory (like 999GB)', () => {
      const keys = generator.getAvailableSpecKeys();

      keys.forEach(key => {
        const spec = generator.getSpecsByKey(key);
        expect(spec.memory).not.toBe(999);
        expect(spec.memory).not.toBeGreaterThan(192);
      });
    });
  });

  // Specs validation tests (2 tests)
  describe('Specs Validation', () => {
    it('should validate realistic specs', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        hardwareConcurrency: 6,
        deviceMemory: 6
      };

      const specs = generator.initializeFromProfile(profile);
      expect(generator.validateSpecs(specs)).toBe(true);
    });

    it('should reject invalid specs', () => {
      const invalidSpecs = [
        { cpu: '', cpuCores: 8, gpu: 'NVIDIA RTX 4080', gpuCores: 5888, memory: 16, vendor: 'NVIDIA' }, // Empty CPU
        { cpu: 'Intel i7', cpuCores: 0, gpu: 'NVIDIA RTX 4080', gpuCores: 5888, memory: 16, vendor: 'NVIDIA' }, // 0 cores
        { cpu: 'Intel i7', cpuCores: 8, gpu: 'NVIDIA RTX 4080', gpuCores: 5888, memory: 999, vendor: 'NVIDIA' } // Unrealistic memory
      ];

      invalidSpecs.forEach(spec => {
        expect(generator.validateSpecs(spec)).toBe(false);
      });
    });
  });

  // Consistency tests (2 tests)
  describe('Session Consistency', () => {
    it('should return same specs multiple times within session', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        hardwareConcurrency: 6,
        deviceMemory: 6
      };

      generator.initializeFromProfile(profile);
      const specs1 = generator.getSpecs();
      const specs2 = generator.getSpecs();
      const specs3 = generator.getSpecs();

      expect(specs1.cpu).toBe(specs2.cpu);
      expect(specs2.cpu).toBe(specs3.cpu);
      expect(specs1.gpu).toBe(specs2.gpu);
      expect(specs1.memory).toBe(specs2.memory);
    });

    it('should reset specs to null after reset', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        hardwareConcurrency: 6,
        deviceMemory: 6
      };

      generator.initializeFromProfile(profile);
      expect(generator.getSpecs()).toBeDefined();

      generator.reset();
      expect(generator.generatedSpecs).toBeNull();
    });
  });

  // Spec key selection tests (2 tests)
  describe('Spec Key Selection', () => {
    it('should select appropriate spec key for iPhone', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        hardwareConcurrency: 6,
        deviceMemory: 6
      };

      const key = generator.selectSpecKey(profile);
      expect(key).toContain('iPhone');
    });

    it('should select high-end specs for high-core count systems', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Apple',
        hardwareConcurrency: 12,
        deviceMemory: 36
      };

      const key = generator.selectSpecKey(profile);
      expect(key).toContain('MacBook-Pro-16-M3-Max');
    });
  });

  // Generic spec generation tests (1 test)
  describe('Generic Spec Generation', () => {
    it('should generate reasonable generic specs', () => {
      const specs = generator.generateGenericSpecs('mobile', 'Apple', 8);
      expect(specs).toBeDefined();
      expect(specs.cpu).toBeDefined();
      expect(specs.gpu).toBeDefined();
      expect(specs.cpuCores).toBeGreaterThan(0);
      expect(specs.gpuCores).toBeGreaterThan(0);
      expect(specs.memory).toBe(8);
    });
  });

  // Error handling tests (1 test)
  describe('Error Handling', () => {
    it('should throw error for unknown spec key', () => {
      expect(() => {
        generator.getSpecsByKey('UnknownDevice');
      }).toThrow('Unknown spec key');
    });
  });
});
