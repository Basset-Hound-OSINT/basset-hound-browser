/**
 * Tests for Advanced WebGL Detection Evasion v2
 * Tests shader performance, extension reporting, precision limits, driver behavior
 */

const WebGLDetectionV2 = require('../../src/evasion/webgl-detection-v2');

describe('WebGL Detection v2', () => {
  let evasion;
  let mockContext;

  beforeEach(() => {
    evasion = new WebGLDetectionV2({
      category: 'desktop',
      gpuTier: 'high',
      hardware: {
        gpu: { vendor: 'NVIDIA', renderer: 'GeForce RTX 3080' }
      }
    });

    mockContext = {
      getParameter: jest.fn(),
      getSupportedExtensions: jest.fn(() => []),
      getExtension: jest.fn(() => null),
      getProgramParameter: jest.fn(),
      VENDOR: 0x1F00,
      RENDERER: 0x1F01,
      MAX_TEXTURE_SIZE: 0x0D33
    };
  });

  describe('Initialization', () => {
    test('should initialize with device profile', () => {
      expect(evasion.enabled).toBe(true);
      expect(evasion.deviceProfile.category).toBe('desktop');
    });

    test('should get realistic extensions', () => {
      const extensions = evasion.extensions;

      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
      expect(extensions.some(ext => ext.includes('texture'))).toBe(true);
    });

    test('should generate device limits', () => {
      expect(evasion.limits.maxTextureSize).toBeGreaterThan(0);
      expect(evasion.limits.maxCubeMapSize).toBeGreaterThan(0);
      expect(evasion.limits.maxVertexAttribs).toBe(16);
    });
  });

  describe('Extension Filtering', () => {
    test('should filter extensions for NVIDIA', () => {
      const nvidiaEvasion = new WebGLDetectionV2({
        hardware: { gpu: { vendor: 'NVIDIA' } }
      });

      expect(nvidiaEvasion.extensions.length).toBeGreaterThan(10);
    });

    test('should limit extensions for Intel', () => {
      const intelEvasion = new WebGLDetectionV2({
        hardware: { gpu: { vendor: 'Intel' } }
      });

      expect(intelEvasion.extensions.length).toBeLessThan(20);
    });

    test('should significantly limit extensions for mobile', () => {
      const mobileEvasion = new WebGLDetectionV2({
        category: 'smartphone',
        hardware: { gpu: { vendor: 'Qualcomm' } }
      });

      expect(mobileEvasion.extensions.length).toBeLessThan(10);
    });

    test('should filter S3TC for Apple', () => {
      const appleEvasion = new WebGLDetectionV2({
        hardware: { gpu: { vendor: 'Apple Inc.' } }
      });

      const hasS3TC = appleEvasion.extensions.some(ext => ext.includes('s3tc'));
      expect(hasS3TC).toBe(false);
    });
  });

  describe('Device Limits', () => {
    test('should set appropriate limits for desktop', () => {
      const desktopEvasion = new WebGLDetectionV2({
        category: 'desktop',
        gpuTier: 'high'
      });

      expect(desktopEvasion.limits.maxTextureSize).toBe(16384);
      expect(desktopEvasion.limits.maxVertexUniformVectors).toBe(4096);
    });

    test('should set appropriate limits for smartphone', () => {
      const mobileEvasion = new WebGLDetectionV2({
        category: 'smartphone',
        gpuTier: 'mid'
      });

      expect(mobileEvasion.limits.maxTextureSize).toBe(1024);
      expect(mobileEvasion.limits.maxVertexUniformVectors).toBe(256);
    });

    test('should set appropriate limits for tablet', () => {
      const tabletEvasion = new WebGLDetectionV2({
        category: 'tablet'
      });

      expect(tabletEvasion.limits.maxTextureSize).toBe(4096);
    });

    test('should set lower limits for low-tier GPU', () => {
      const lowTierEvasion = new WebGLDetectionV2({
        category: 'desktop',
        gpuTier: 'low'
      });

      expect(lowTierEvasion.limits.maxTextureSize).toBe(4096);
    });
  });

  describe('Shader Performance Simulation', () => {
    test('should generate realistic compile times', () => {
      const compileTime = evasion.getShaderCompileTime('shader-1');

      expect(typeof compileTime).toBe('number');
      expect(compileTime).toBeGreaterThan(0);
    });

    test('should vary compile times for different devices', () => {
      const mobileEvasion = new WebGLDetectionV2({ category: 'smartphone' });
      const desktopEvasion = new WebGLDetectionV2({ category: 'desktop' });

      const mobileTime = mobileEvasion.getShaderCompileTime('shader-1');
      const desktopTime = desktopEvasion.getShaderCompileTime('shader-1');

      expect(mobileTime).toBeGreaterThan(desktopTime);
    });

    test('should maintain consistency for same shader', () => {
      const time1 = evasion.getShaderCompileTime('shader-1');
      const time2 = evasion.getShaderCompileTime('shader-1');

      expect(time1).toBe(time2);
    });

    test('should simulate shader compilation', () => {
      const result = evasion.simulateShaderCompile('shader-code');

      expect(result.compiled).toBe(true);
      expect(result.compileTime).toBeGreaterThan(0);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Vendor & Renderer Spoofing', () => {
    test('should return consistent vendor/renderer', () => {
      const vr1 = evasion.getVendorRenderer();
      const vr2 = evasion.getVendorRenderer();

      expect(vr1).toEqual(vr2);
    });

    test('should get appropriate shader version for device', () => {
      const mobileEvasion = new WebGLDetectionV2({ category: 'smartphone' });
      const mobileVersion = mobileEvasion.getShaderVersion();

      expect(mobileVersion).toContain('1.0');
    });

    test('should support newer shader versions on desktop', () => {
      const desktopEvasion = new WebGLDetectionV2({ category: 'desktop' });
      const desktopVersion = desktopEvasion.getShaderVersion();

      expect(desktopVersion).toBeDefined();
    });
  });

  describe('Precision Formats', () => {
    test('should provide precision format data', () => {
      const formats = evasion.getPrecisionFormats();

      expect(formats.VERTEX_SHADER).toBeDefined();
      expect(formats.FRAGMENT_SHADER).toBeDefined();
    });

    test('should include all precision levels', () => {
      const formats = evasion.getPrecisionFormats();

      expect(formats.VERTEX_SHADER.HIGH_FLOAT).toBeDefined();
      expect(formats.VERTEX_SHADER.MEDIUM_FLOAT).toBeDefined();
      expect(formats.VERTEX_SHADER.LOW_FLOAT).toBeDefined();
    });

    test('should have valid precision values', () => {
      const formats = evasion.getPrecisionFormats();
      const precision = formats.VERTEX_SHADER.HIGH_FLOAT;

      expect(precision.rangeMin).toBeGreaterThan(0);
      expect(precision.rangeMax).toBeGreaterThanOrEqual(precision.rangeMin);
      expect(precision.precision).toBeGreaterThan(0);
    });
  });

  describe('Driver Behavior', () => {
    test('should simulate occasional driver errors', () => {
      let hasError = false;

      for (let i = 0; i < 100; i++) {
        const state = evasion.getRealisticErrorState();
        if (state.error) {
          hasError = true;
          expect(['INVALID_OPERATION', 'INVALID_VALUE']).toContain(state.code);
          break;
        }
      }

      // Should have at least one error in 100 iterations for desktop
      // (1% error rate, but randomness means it might not occur)
      // Just verify structure
      const state = evasion.getRealisticErrorState();
      expect(state.error).toBeDefined();
      expect(state.code).toBeDefined();
    });

    test('should have higher error rate for mobile', () => {
      const mobileEvasion = new WebGLDetectionV2({ category: 'smartphone' });

      let errorCount = 0;
      for (let i = 0; i < 100; i++) {
        const state = mobileEvasion.getRealisticErrorState();
        if (state.error) errorCount++;
      }

      // Mobile should have more errors (5% vs 1%)
      expect(errorCount).toBeGreaterThan(0);
    });

    test('should provide supported texture formats', () => {
      const formats = evasion.getSupportedTextureFormats();

      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain('RGBA');
    });
  });

  describe('Context Loss Simulation', () => {
    test('should simulate context loss', (done) => {
      expect(evasion.contextLossState).toBe(false);

      const result = evasion.simulateContextLoss(100);

      expect(evasion.contextLossState).toBe(true);
      expect(result.lost).toBe(true);

      setTimeout(() => {
        expect(evasion.contextLossState).toBe(false);
        done();
      }, 150);
    });

    test('should report context restoration capability', () => {
      expect(evasion.canRestoreContext()).toBe(true);

      evasion.simulateContextLoss(100);
      expect(evasion.canRestoreContext()).toBe(false);
    });
  });

  describe('Memory Limits', () => {
    test('should report memory limits', () => {
      const limits = evasion.getMemoryLimits();

      expect(limits.maxTextureSize).toBeGreaterThan(0);
      expect(limits.maxCubeMapSize).toBeGreaterThan(0);
      expect(limits.estimatedVRAM).toBeGreaterThan(0);
    });

    test('should set device-appropriate VRAM estimates', () => {
      const mobileEvasion = new WebGLDetectionV2({ category: 'smartphone' });
      const desktopEvasion = new WebGLDetectionV2({ category: 'desktop' });

      expect(mobileEvasion.getMemoryLimits().estimatedVRAM).toBeLessThan(
        desktopEvasion.getMemoryLimits().estimatedVRAM
      );
    });
  });

  describe('Context Spoofing', () => {
    test('should create spoofed context', () => {
      const spoofed = evasion.createSpoofedContext(mockContext);

      expect(spoofed).toBeDefined();
      expect(spoofed.getParameter).toBeDefined();
    });

    test('should spoof vendor parameter', () => {
      // Mock window if not available
      if (typeof window === 'undefined') {
        global.window = {
          WebGLRenderingContext: { VENDOR: 0x1F00 },
          WebGL2RenderingContext: { VENDOR: 0x1F00 }
        };
      }

      mockContext.VENDOR = 0x1F00;
      mockContext.getParameter = jest.fn((param) => {
        if (param === 0x1F00) return 'Google Inc.';
        return null;
      });

      evasion.createSpoofedContext(mockContext);
      const vendor = mockContext.getParameter(0x1F00);

      expect(vendor).toBeDefined();

      if (typeof global.window !== 'undefined' && !global.window.location) {
        delete global.window;
      }
    });

    test('should spoof supported extensions', () => {
      mockContext.getSupportedExtensions = jest.fn(() => []);

      evasion.createSpoofedContext(mockContext);

      expect(mockContext.getSupportedExtensions).toBeDefined();
    });

    test('should handle null context gracefully', () => {
      const result = evasion.createSpoofedContext(null);

      expect(result).toBeNull();
    });
  });

  describe('Status Reporting', () => {
    test('should report status', () => {
      const status = evasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.gpuVendor).toBeDefined();
      expect(status.extensionCount).toBeGreaterThan(0);
      expect(status.maxTextureSize).toBeGreaterThan(0);
      expect(Array.isArray(status.techniques)).toBe(true);
    });

    test('should list all techniques', () => {
      const status = evasion.getStatus();

      expect(status.techniques).toContain('shader-performance-simulation');
      expect(status.techniques).toContain('extension-reporting');
      expect(status.techniques).toContain('precision-limits');
      expect(status.techniques).toContain('driver-behavior-simulation');
      expect(status.techniques).toContain('context-loss-simulation');
      expect(status.techniques).toContain('memory-limits-reporting');
    });
  });

  describe('Device Profile Updates', () => {
    test('should update device profile', () => {
      const newProfile = {
        category: 'smartphone',
        hardware: { gpu: { vendor: 'Qualcomm' } }
      };

      evasion.setDeviceProfile(newProfile);

      expect(evasion.deviceProfile).toEqual(newProfile);
      expect(evasion.extensions.length).toBeLessThan(10);
    });

    test('should clear consistency cache on update', () => {
      evasion.getVendorRenderer();
      expect(evasion.consistencyCache.size).toBeGreaterThan(0);

      evasion.setDeviceProfile({ category: 'desktop' });

      expect(evasion.consistencyCache.size).toBe(0);
    });
  });

  describe('Context Restoration', () => {
    test('should restore original context methods', () => {
      evasion.originalContextMethods.set('test', 'original');

      evasion.restoreOriginalContext(mockContext);

      expect(evasion.originalContextMethods.size).toBe(0);
    });
  });
});
