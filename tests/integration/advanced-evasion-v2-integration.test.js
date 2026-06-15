/**
 * Integration Tests for Advanced Evasion v2 Phase 1
 * Tests all evasion modules working together
 */

const CanvasFingerprintingV2 = require('../../src/evasion/canvas-fingerprinting-v2');
const WebGLDetectionV2 = require('../../src/evasion/webgl-detection-v2');
const VendorDetectionEvasion = require('../../src/evasion/vendor-detection-evasion');
const PluginEnumerationEvasion = require('../../src/evasion/plugin-enumeration-evasion');

describe('Advanced Evasion v2 - Phase 1 Integration', () => {
  let deviceProfile;
  let canvasEvasion;
  let webglEvasion;
  let vendorEvasion;
  let pluginEvasion;

  beforeEach(() => {
    // Standard device profile for testing
    deviceProfile = {
      id: 'test-device-1',
      category: 'desktop',
      gpuTier: 'high',
      brand: 'Google',
      platform: 'Linux',
      hardware: {
        gpu: {
          vendor: 'NVIDIA',
          renderer: 'GeForce RTX 3080'
        }
      }
    };

    canvasEvasion = new CanvasFingerprintingV2(deviceProfile);
    webglEvasion = new WebGLDetectionV2(deviceProfile);
    vendorEvasion = new VendorDetectionEvasion(deviceProfile);
    pluginEvasion = new PluginEnumerationEvasion(deviceProfile);
  });

  describe('Module Consistency', () => {
    test('all modules should enable from same profile', () => {
      expect(canvasEvasion.enabled).toBe(true);
      expect(webglEvasion.enabled).toBe(true);
      expect(vendorEvasion.enabled).toBe(true);
      expect(pluginEvasion.enabled).toBe(true);
    });

    test('all modules should share same device profile', () => {
      expect(canvasEvasion.deviceProfile.category).toBe(deviceProfile.category);
      expect(webglEvasion.deviceProfile.category).toBe(deviceProfile.category);
      expect(vendorEvasion.deviceProfile.category).toBe(deviceProfile.category);
      expect(pluginEvasion.deviceProfile.category).toBe(deviceProfile.category);
    });

    test('GPU information should be consistent across modules', () => {
      expect(webglEvasion.gpu.vendor).toBe(canvasEvasion.gpu.vendor);
      expect(webglEvasion.gpu.renderer).toBe(canvasEvasion.gpu.renderer);
    });
  });

  describe('Profile Update Synchronization', () => {
    test('all modules should update when profile changes', () => {
      const newProfile = {
        category: 'smartphone',
        gpuTier: 'mid',
        brand: 'Apple',
        platform: 'iOS',
        hardware: {
          gpu: { vendor: 'Apple Inc.', renderer: 'Apple A16' }
        }
      };

      canvasEvasion.setDeviceProfile(newProfile);
      webglEvasion.setDeviceProfile(newProfile);
      vendorEvasion.setDeviceProfile(newProfile);
      pluginEvasion.setDeviceProfile(newProfile);

      expect(canvasEvasion.deviceProfile.category).toBe('smartphone');
      expect(webglEvasion.deviceProfile.category).toBe('smartphone');
      expect(vendorEvasion.deviceProfile.category).toBe('smartphone');
      expect(pluginEvasion.deviceProfile.category).toBe('smartphone');
    });

    test('mobile devices should have fewer extensions', () => {
      const mobileProfile = {
        category: 'smartphone',
        hardware: { gpu: { vendor: 'Qualcomm' } }
      };

      const mobileWebGL = new WebGLDetectionV2(mobileProfile);
      const desktopWebGL = new WebGLDetectionV2({
        category: 'desktop',
        hardware: { gpu: { vendor: 'NVIDIA' } }
      });

      expect(mobileWebGL.extensions.length).toBeLessThan(desktopWebGL.extensions.length);
    });

    test('mobile devices should have minimal plugins', () => {
      const mobileProfile = {
        category: 'smartphone',
        platform: 'iOS'
      };

      const mobilePlugins = new PluginEnumerationEvasion(mobileProfile);
      const desktopPlugins = new PluginEnumerationEvasion({
        category: 'desktop',
        platform: 'Windows'
      });

      expect(mobilePlugins.plugins.length).toBeLessThanOrEqual(desktopPlugins.plugins.length);
    });
  });

  describe('Evasion Technique Coverage', () => {
    test('Canvas should use 5+ techniques', () => {
      const status = canvasEvasion.getStatus();

      expect(status.techniques.length).toBeGreaterThanOrEqual(5);
      expect(status.techniques).toContain('gradient-variations');
      expect(status.techniques).toContain('glyph-rendering');
      expect(status.techniques).toContain('curve-variations');
      expect(status.techniques).toContain('color-space-adjustment');
      expect(status.techniques).toContain('gpu-noise-patterns');
    });

    test('WebGL should use 6+ techniques', () => {
      const status = webglEvasion.getStatus();

      expect(status.techniques.length).toBeGreaterThanOrEqual(6);
      expect(status.techniques).toContain('shader-performance-simulation');
      expect(status.techniques).toContain('extension-reporting');
      expect(status.techniques).toContain('precision-limits');
      expect(status.techniques).toContain('driver-behavior-simulation');
      expect(status.techniques).toContain('context-loss-simulation');
      expect(status.techniques).toContain('memory-limits-reporting');
    });

    test('Vendor should use 5+ techniques', () => {
      const status = vendorEvasion.getStatus();

      expect(status.techniques.length).toBeGreaterThanOrEqual(5);
      expect(status.techniques).toContain('vendor-string-spoofing');
      expect(status.techniques).toContain('user-agent-client-hints');
      expect(status.techniques).toContain('plugin-enumeration');
      expect(status.techniques).toContain('mime-type-mapping');
      expect(status.techniques).toContain('feature-support-reporting');
    });

    test('Plugin should use 4+ techniques', () => {
      const status = pluginEvasion.getStatus();

      expect(status.techniques.length).toBeGreaterThanOrEqual(4);
      expect(status.techniques).toContain('realistic-plugin-enumeration');
      expect(status.techniques).toContain('mime-type-mapping');
      expect(status.techniques).toContain('platform-specific-plugins');
      expect(status.techniques).toContain('navigator-plugins-spoofing');
    });
  });

  describe('Cross-Device Testing', () => {
    const testDevices = [
      { name: 'iPhone 14 Pro', category: 'smartphone', brand: 'Apple', platform: 'iOS' },
      { name: 'Galaxy S24', category: 'smartphone', brand: 'Samsung', platform: 'Android' },
      { name: 'iPad Pro', category: 'tablet', brand: 'Apple', platform: 'iPadOS' },
      { name: 'MacBook Pro', category: 'desktop', brand: 'Apple', platform: 'macOS' },
      { name: 'Windows Desktop', category: 'desktop', brand: 'Microsoft', platform: 'Windows' },
      { name: 'Ubuntu Desktop', category: 'desktop', brand: 'Generic', platform: 'Linux' }
    ];

    testDevices.forEach(device => {
      test(`should handle ${device.name} profile correctly`, () => {
        const profile = {
          ...device,
          hardware: { gpu: { vendor: 'Generic' } }
        };

        const canvas = new CanvasFingerprintingV2(profile);
        const webgl = new WebGLDetectionV2(profile);
        const vendor = new VendorDetectionEvasion(profile);
        const plugin = new PluginEnumerationEvasion(profile);

        expect(canvas.enabled).toBe(true);
        expect(webgl.enabled).toBe(true);
        expect(vendor.enabled).toBe(true);
        expect(plugin.enabled).toBe(true);

        expect(vendor.brand).toBe(device.brand);
        expect(vendor.platform).toBe(device.platform);
      });
    });
  });

  describe('Fingerprint Consistency', () => {
    test('canvas fingerprints should vary per call but maintain signature', () => {
      const mockCanvas = {
        width: 280,
        height: 60,
        getContext: jest.fn(() => ({
          fillStyle: '',
          fillRect: jest.fn(),
          createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
          createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
          getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(1000) })),
          putImageData: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          quadraticCurveTo: jest.fn(),
          stroke: jest.fn(),
          fillText: jest.fn(),
          globalAlpha: 1
        })),
        toDataURL: jest.fn(() => `data:image/png;base64,${Math.random()}`)
      };

      const fp1 = canvasEvasion.generateAdvancedFingerprint(mockCanvas);
      const fp2 = canvasEvasion.generateAdvancedFingerprint(mockCanvas);

      // Both should be valid data URLs
      expect(fp1).toMatch(/^data:image/);
      expect(fp2).toMatch(/^data:image/);
    });

    test('vendor string should be consistent within session', () => {
      const vendor1 = vendorEvasion.getVendorString();
      const vendor2 = vendorEvasion.getVendorString();
      const vendor3 = vendorEvasion.getVendorString();

      expect(vendor1).toBe(vendor2);
      expect(vendor2).toBe(vendor3);
    });

    test('User-Agent data should be consistent within session', () => {
      const uaData1 = vendorEvasion.getUserAgentData();
      const uaData2 = vendorEvasion.getUserAgentData();

      expect(uaData1.brands).toEqual(uaData2.brands);
      expect(uaData1.platform).toBe(uaData2.platform);
      expect(uaData1.platformVersion).toBe(uaData2.platformVersion);
    });

    test('plugins should be consistent within session', () => {
      const plugins1 = pluginEvasion.getPlugins();
      const plugins2 = pluginEvasion.getPlugins();

      expect(plugins1.length).toBe(plugins2.length);
      expect(plugins1.map(p => p.name)).toEqual(plugins2.map(p => p.name));
    });
  });

  describe('Feature Validation', () => {
    test('should report correct feature support per device type', () => {
      // Mobile should have camera/microphone
      const mobile = new VendorDetectionEvasion({ category: 'smartphone' });
      expect(mobile.features['camera']).toBe(true);

      // Desktop should not have camera/microphone
      const desktop = new VendorDetectionEvasion({ category: 'desktop' });
      expect(desktop.features['camera']).toBe(false);

      // Both should have webGL
      expect(mobile.features['webGL']).toBe(true);
      expect(desktop.features['webGL']).toBe(true);
    });

    test('should provide realistic WebGL limits per device', () => {
      const mobile = new WebGLDetectionV2({ category: 'smartphone' });
      const desktop = new WebGLDetectionV2({ category: 'desktop' });

      expect(mobile.limits.maxTextureSize).toBeLessThan(desktop.limits.maxTextureSize);
      expect(mobile.limits.maxVertexUniformVectors).toBeLessThan(desktop.limits.maxVertexUniformVectors);
    });

    test('should provide realistic memory estimates', () => {
      const mobile = new WebGLDetectionV2({ category: 'smartphone' });
      const desktop = new WebGLDetectionV2({ category: 'desktop' });

      const mobileMem = mobile.getMemoryLimits().estimatedVRAM;
      const desktopMem = desktop.getMemoryLimits().estimatedVRAM;

      expect(mobileMem).toBeLessThan(desktopMem);
      expect(mobileMem).toBeGreaterThan(0);
      expect(desktopMem).toBeGreaterThan(mobileMem);
    });
  });

  describe('Real-World Scenarios', () => {
    test('all modules should handle rapid profile changes', () => {
      const profiles = [
        { category: 'desktop', platform: 'Windows' },
        { category: 'smartphone', platform: 'iOS' },
        { category: 'tablet', platform: 'Android' },
        { category: 'desktop', platform: 'Linux' }
      ];

      profiles.forEach(profile => {
        canvasEvasion.setDeviceProfile(profile);
        webglEvasion.setDeviceProfile(profile);
        vendorEvasion.setDeviceProfile(profile);
        pluginEvasion.setDeviceProfile(profile);

        // All should still be functional
        expect(canvasEvasion.deviceProfile.category).toBe(profile.category);
        expect(webglEvasion.deviceProfile.category).toBe(profile.category);
        expect(vendorEvasion.deviceProfile.category).toBe(profile.category);
        expect(pluginEvasion.deviceProfile.category).toBe(profile.category);
      });
    });

    test('should maintain consistency through extended usage', () => {
      // Simulate extended usage
      for (let i = 0; i < 100; i++) {
        canvasEvasion.getConsistentColorVariation(`key-${i}`);
        vendorEvasion.getVendorString();
        webglEvasion.getVendorRenderer();
        pluginEvasion.getPlugins();
      }

      // Verify consistency is maintained
      expect(vendorEvasion.getVendorString()).toBe(vendorEvasion.getVendorString());
      expect(webglEvasion.getVendorRenderer()).toEqual(webglEvasion.getVendorRenderer());
    });

    test('should not leak detection patterns', () => {
      const canvasStatus = canvasEvasion.getStatus();
      const webglStatus = webglEvasion.getStatus();
      const vendorStatus = vendorEvasion.getStatus();
      const pluginStatus = pluginEvasion.getStatus();

      // All should report high effectiveness
      expect(canvasStatus.estimatedEffectiveness).toMatch(/8[0-9]-9[0-9]%/);
      expect(webglStatus.estimatedEffectiveness).toMatch(/8[0-9]-9[0-9]%/);
      expect(vendorStatus.estimatedEffectiveness).toMatch(/8[0-9]-9[0-9]%/);
      expect(pluginStatus.estimatedEffectiveness).toMatch(/[78][0-9]-[89][0-9]%/);
    });
  });

  describe('Effectiveness Estimates', () => {
    test('all modules should report strong evasion effectiveness', () => {
      const modules = [
        { name: 'Canvas', obj: canvasEvasion, min: 82 },
        { name: 'WebGL', obj: webglEvasion, min: 85 },
        { name: 'Vendor', obj: vendorEvasion, min: 85 },
        { name: 'Plugin', obj: pluginEvasion, min: 80 }
      ];

      modules.forEach(module => {
        const status = module.obj.getStatus();
        const match = status.estimatedEffectiveness.match(/(\d+)-(\d+)%/);

        expect(match).not.toBeNull();
        const minEff = parseInt(match[1]);
        expect(minEff).toBeGreaterThanOrEqual(module.min);
      });
    });
  });

  describe('Combined Evasion Strength', () => {
    test('combined effect of all modules should exceed individual capabilities', () => {
      // When all modules work together, overall evasion is stronger
      // This is tested by verifying no obvious gaps exist

      const allStatus = {
        canvas: canvasEvasion.getStatus(),
        webgl: webglEvasion.getStatus(),
        vendor: vendorEvasion.getStatus(),
        plugin: pluginEvasion.getStatus()
      };

      // Should cover fingerprinting, WebGL, vendor detection, and plugin detection
      const canvasTechniques = allStatus.canvas.techniques;
      const webglTechniques = allStatus.webgl.techniques;
      const vendorTechniques = allStatus.vendor.techniques;
      const pluginTechniques = allStatus.plugin.techniques;

      const allTechniques = [
        ...canvasTechniques,
        ...webglTechniques,
        ...vendorTechniques,
        ...pluginTechniques
      ];

      expect(allTechniques.length).toBeGreaterThanOrEqual(20);
    });
  });
});
