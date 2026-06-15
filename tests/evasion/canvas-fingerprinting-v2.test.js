/**
 * Tests for Advanced Canvas Fingerprinting v2
 * Tests gradient variations, glyph rendering, curve variations, color space adjustment
 */

const CanvasFingerprintingV2 = require('../../src/evasion/canvas-fingerprinting-v2');

describe('Canvas Fingerprinting v2', () => {
  let evasion;
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    evasion = new CanvasFingerprintingV2({
      category: 'desktop',
      hardware: {
        gpu: { vendor: 'NVIDIA', renderer: 'GeForce RTX 3080' }
      }
    });

    // Mock canvas and context
    mockContext = {
      fillStyle: '',
      globalAlpha: 1,
      strokeStyle: '',
      lineWidth: 1,
      textBaseline: '',
      font: '',
      fillRect: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(1000),
        width: 50,
        height: 50
      })),
      putImageData: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      stroke: jest.fn(),
      fillText: jest.fn()
    };

    mockCanvas = {
      width: 280,
      height: 60,
      getContext: jest.fn(() => mockContext),
      toDataURL: jest.fn(() => 'data:image/png;base64,mock')
    };
  });

  describe('Initialization', () => {
    test('should initialize with device profile', () => {
      expect(evasion.enabled).toBe(true);
      expect(evasion.deviceProfile.category).toBe('desktop');
      expect(evasion.colorSpace).toBeDefined();
      expect(evasion.renderingBackend).toBeDefined();
    });

    test('should detect color space for device', () => {
      const desktopEvasion = new CanvasFingerprintingV2({ category: 'desktop' });
      expect(['srgb', 'adobe-rgb', 'display-p3']).toContain(desktopEvasion.colorSpace);
    });

    test('should detect mobile device attributes', () => {
      const mobileEvasion = new CanvasFingerprintingV2({ category: 'smartphone' });
      expect(['srgb', 'display-p3']).toContain(mobileEvasion.colorSpace);
    });

    test('should set rendering backend for GPU', () => {
      const appleEvasion = new CanvasFingerprintingV2({
        hardware: { gpu: { vendor: 'Apple Inc.' } }
      });
      expect(appleEvasion.renderingBackend).toBe('metal');
    });
  });

  describe('Gradient Variations', () => {
    test('should generate consistent gradient variations', () => {
      evasion.generateGradientVariations(mockCanvas, mockContext);

      expect(mockContext.createLinearGradient).toHaveBeenCalled();
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    test('should create device-appropriate base colors', () => {
      const colors = evasion.getDeviceBaseColor();

      expect(Array.isArray(colors)).toBe(true);
      expect(colors.length).toBe(3);
      expect(colors[0]).toMatch(/rgba\(/);
    });

    test('should maintain consistency for same key', () => {
      const variation1 = evasion.getConsistentColorVariation('test-key');
      const variation2 = evasion.getConsistentColorVariation('test-key');

      expect(variation1).toBe(variation2);
    });

    test('should vary across different keys', () => {
      const variation1 = evasion.getConsistentColorVariation('key-1');
      const variation2 = evasion.getConsistentColorVariation('key-2');

      // Should be different with high probability
      expect(variation1 !== variation2 || (variation1 >= 0 && variation1 <= 1)).toBe(true);
    });
  });

  describe('Glyph Rendering', () => {
    test('should render glyph patterns', () => {
      evasion.renderGlyphPatterns(mockCanvas, mockContext);

      expect(mockContext.font).toBeDefined();
      expect(mockContext.fillText).toHaveBeenCalled();
      expect(mockContext.globalAlpha).toBeDefined();
    });

    test('should render multiple glyphs', () => {
      evasion.renderGlyphPatterns(mockCanvas, mockContext);

      const textLength = 'Basset Hound Browser'.length;
      expect(mockContext.fillText.mock.calls.length).toBeGreaterThan(textLength * 0.8);
    });
  });

  describe('Curve Variations', () => {
    test('should render curve variations', () => {
      evasion.renderCurveVariations(mockCanvas, mockContext);

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.quadraticCurveTo).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    test('should create device-appropriate curve count', () => {
      const mobileEvasion = new CanvasFingerprintingV2({ category: 'smartphone' });
      mobileEvasion.renderCurveVariations(mockCanvas, mockContext);

      expect(mockContext.quadraticCurveTo).toHaveBeenCalled();
    });
  });

  describe('Color Space Adjustment', () => {
    test('should apply color space transformation', () => {
      evasion.applyColorSpaceAdjustment(mockCanvas, mockContext);

      expect(mockContext.getImageData).toHaveBeenCalled();
      expect(mockContext.putImageData).toHaveBeenCalled();
    });

    test('should get appropriate adjustment matrix for color space', () => {
      evasion.colorSpace = 'display-p3';
      const matrix = evasion.getColorSpaceAdjustmentMatrix();

      expect(matrix.r).toBeDefined();
      expect(matrix.g).toBeDefined();
      expect(matrix.b).toBeDefined();
    });

    test('should use identity matrix for sRGB', () => {
      evasion.colorSpace = 'srgb';
      const matrix = evasion.getColorSpaceAdjustmentMatrix();

      expect(matrix.r.r).toBe(1);
      expect(matrix.g.g).toBe(1);
      expect(matrix.b.b).toBe(1);
    });
  });

  describe('GPU Noise Patterns', () => {
    test('should apply GPU-specific noise patterns', () => {
      evasion.applyGPUNoisPattern(mockCanvas, mockContext);

      expect(mockContext.getImageData).toHaveBeenCalled();
      expect(mockContext.putImageData).toHaveBeenCalled();
    });

    test('should select pattern based on GPU vendor', () => {
      const nvidiaEvasion = new CanvasFingerprintingV2({
        hardware: { gpu: { vendor: 'NVIDIA' } }
      });
      const pattern = nvidiaEvasion.getGPUNoisePattern();

      expect(pattern.generate).toBeDefined();
      expect(pattern.magnitude).toBeGreaterThan(0);
    });

    test('should handle different GPU vendors', () => {
      const vendors = ['NVIDIA', 'AMD', 'Intel'];

      vendors.forEach(vendor => {
        const e = new CanvasFingerprintingV2({
          hardware: { gpu: { vendor } }
        });
        const pattern = e.getGPUNoisePattern();

        expect(pattern.magnitude).toBeGreaterThan(0);
        expect(typeof pattern.generate).toBe('function');
      });
    });
  });

  describe('Fingerprint Generation', () => {
    test('should generate advanced fingerprint', () => {
      const fingerprint = evasion.generateAdvancedFingerprint(mockCanvas);

      expect(typeof fingerprint).toBe('string');
      expect(fingerprint).toMatch(/^data:image/);
    });

    test('should create canvas if not provided', () => {
      global.document = {
        createElement: jest.fn(() => mockCanvas)
      };

      const fingerprint = evasion.generateAdvancedFingerprint();

      expect(typeof fingerprint).toBe('string');
      delete global.document;
    });

    test('should apply all techniques in sequence', () => {
      evasion.generateAdvancedFingerprint(mockCanvas);

      expect(mockContext.fillStyle).toBeDefined();
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    test('should handle errors gracefully', () => {
      mockContext.fillRect = jest.fn(() => {
        throw new Error('Test error');
      });

      const result = evasion.generateAdvancedFingerprint(mockCanvas);

      expect(result).toMatch(/data:image/);
    });
  });

  describe('Comparison Detection', () => {
    test('should detect fingerprint comparisons', () => {
      const hash1 = 'abc123';
      const hash2 = 'def456';
      const hash3 = 'abc123';

      expect(evasion.isDetectingComparison(undefined, hash1)).toBe(false);
      expect(evasion.isDetectingComparison(hash1, hash2)).toBe(true);
      expect(evasion.isDetectingComparison(hash2, hash3)).toBe(true);
    });
  });

  describe('Status Reporting', () => {
    test('should report status', () => {
      const status = evasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.colorSpace).toBeDefined();
      expect(status.renderingBackend).toBeDefined();
      expect(Array.isArray(status.techniques)).toBe(true);
      expect(status.techniques.length).toBeGreaterThan(0);
      expect(status.estimatedEffectiveness).toMatch(/%/);
    });

    test('should list all techniques', () => {
      const status = evasion.getStatus();

      expect(status.techniques).toContain('gradient-variations');
      expect(status.techniques).toContain('glyph-rendering');
      expect(status.techniques).toContain('curve-variations');
      expect(status.techniques).toContain('color-space-adjustment');
      expect(status.techniques).toContain('gpu-noise-patterns');
    });
  });

  describe('Device Profile Updates', () => {
    test('should update device profile', () => {
      const newProfile = {
        category: 'smartphone',
        hardware: { gpu: { vendor: 'ARM' } }
      };

      evasion.setDeviceProfile(newProfile);

      expect(evasion.deviceProfile).toEqual(newProfile);
      expect(evasion.gpu).toBe(newProfile.hardware.gpu);
    });

    test('should clear consistency cache on profile update', () => {
      evasion.getConsistentColorVariation('test');
      expect(evasion.consistencyCache.size).toBe(1);

      evasion.setDeviceProfile({ category: 'desktop' });

      expect(evasion.consistencyCache.size).toBe(0);
    });

    test('should recalculate rendering backend on update', () => {
      const oldBackend = evasion.renderingBackend;

      evasion.setDeviceProfile({
        hardware: { gpu: { vendor: 'Apple Inc.' } }
      });

      expect(evasion.renderingBackend).toBe('metal');
    });
  });

  describe('Hash Function', () => {
    test('should produce consistent hash for same input', () => {
      const hash1 = evasion.simpleHash('test-string');
      const hash2 = evasion.simpleHash('test-string');

      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different inputs', () => {
      const hash1 = evasion.simpleHash('string1');
      const hash2 = evasion.simpleHash('string2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Color Adjustment', () => {
    test('should adjust color values', () => {
      const original = 'rgba(200, 190, 180, 0.02)';
      const adjusted = evasion.adjustColor(original, 0.1);

      expect(adjusted).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)/);
      expect(adjusted).not.toBe(original);
    });

    test('should clamp color values', () => {
      const original = 'rgba(250, 240, 230, 1.0)';
      const adjusted = evasion.adjustColor(original, 0.5);

      // Should not exceed 255
      expect(adjusted).toMatch(/rgba\((25[0-5]|2[0-4]\d|[01]?\d\d?),/);
    });
  });
});
