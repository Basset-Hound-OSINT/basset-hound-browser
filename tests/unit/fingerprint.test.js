/**
 * Basset Hound Browser - Fingerprint Evasion Unit Tests
 * Tests for anti-fingerprinting and bot detection evasion functions
 */

const {
  getRandomViewport,
  getRealisticUserAgent,
  getEvasionScript,
  getFingerprintConfig,
  VIEWPORT_SIZES,
  USER_AGENTS,
  PLATFORMS,
  LANGUAGES,
  TIMEZONES,
  SCREEN_CONFIGS,
  WEBGL_RENDERERS,
  WEBGL_VENDORS
} = require('../../evasion/fingerprint');

describe('Fingerprint Evasion Module', () => {
  describe('Constants', () => {
    test('VIEWPORT_SIZES should contain valid viewport configurations', () => {
      expect(Array.isArray(VIEWPORT_SIZES)).toBe(true);
      expect(VIEWPORT_SIZES.length).toBeGreaterThan(0);

      VIEWPORT_SIZES.forEach(viewport => {
        expect(viewport).toHaveProperty('width');
        expect(viewport).toHaveProperty('height');
        expect(typeof viewport.width).toBe('number');
        expect(typeof viewport.height).toBe('number');
        expect(viewport.width).toBeGreaterThan(0);
        expect(viewport.height).toBeGreaterThan(0);
      });
    });

    test('USER_AGENTS should contain valid user agent strings', () => {
      expect(Array.isArray(USER_AGENTS)).toBe(true);
      expect(USER_AGENTS.length).toBeGreaterThan(0);

      USER_AGENTS.forEach(ua => {
        expect(typeof ua).toBe('string');
        expect(ua.length).toBeGreaterThan(50);
        // Should contain browser identifier
        expect(
          ua.includes('Chrome') ||
          ua.includes('Firefox') ||
          ua.includes('Safari') ||
          ua.includes('Edge')
        ).toBe(true);
      });
    });

    test('PLATFORMS should contain valid platform strings', () => {
      expect(Array.isArray(PLATFORMS)).toBe(true);
      expect(PLATFORMS.length).toBeGreaterThan(0);

      const validPlatforms = ['Win32', 'MacIntel', 'Linux x86_64', 'Linux armv7l'];
      PLATFORMS.forEach(platform => {
        expect(typeof platform).toBe('string');
        expect(validPlatforms).toContain(platform);
      });
    });

    test('LANGUAGES should contain valid language configurations', () => {
      expect(Array.isArray(LANGUAGES)).toBe(true);
      expect(LANGUAGES.length).toBeGreaterThan(0);

      LANGUAGES.forEach(langConfig => {
        expect(Array.isArray(langConfig)).toBe(true);
        expect(langConfig.length).toBeGreaterThan(0);
        langConfig.forEach(lang => {
          expect(typeof lang).toBe('string');
          expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
        });
      });
    });

    test('TIMEZONES should contain valid timezone configurations', () => {
      expect(Array.isArray(TIMEZONES)).toBe(true);
      expect(TIMEZONES.length).toBeGreaterThan(0);

      TIMEZONES.forEach(tz => {
        expect(tz).toHaveProperty('offset');
        expect(tz).toHaveProperty('name');
        expect(typeof tz.offset).toBe('number');
        expect(typeof tz.name).toBe('string');
        expect(tz.offset).toBeGreaterThanOrEqual(-720);
        expect(tz.offset).toBeLessThanOrEqual(720);
      });
    });

    test('SCREEN_CONFIGS should contain valid screen configurations', () => {
      expect(Array.isArray(SCREEN_CONFIGS)).toBe(true);
      expect(SCREEN_CONFIGS.length).toBeGreaterThan(0);

      SCREEN_CONFIGS.forEach(screen => {
        expect(screen).toHaveProperty('width');
        expect(screen).toHaveProperty('height');
        expect(screen).toHaveProperty('availWidth');
        expect(screen).toHaveProperty('availHeight');
        expect(screen).toHaveProperty('colorDepth');
        expect(screen.width).toBeGreaterThan(0);
        expect(screen.height).toBeGreaterThan(0);
        expect(screen.availWidth).toBeLessThanOrEqual(screen.width);
        expect(screen.availHeight).toBeLessThanOrEqual(screen.height);
        expect([24, 30, 32]).toContain(screen.colorDepth);
      });
    });

    test('WEBGL_RENDERERS should contain valid GPU renderer strings', () => {
      expect(Array.isArray(WEBGL_RENDERERS)).toBe(true);
      expect(WEBGL_RENDERERS.length).toBeGreaterThan(0);

      WEBGL_RENDERERS.forEach(renderer => {
        expect(typeof renderer).toBe('string');
        expect(renderer.length).toBeGreaterThan(0);
        expect(renderer.includes('ANGLE') || renderer.includes('NVIDIA') ||
               renderer.includes('AMD') || renderer.includes('Intel')).toBe(true);
      });
    });

    test('WEBGL_VENDORS should contain valid GPU vendor strings', () => {
      expect(Array.isArray(WEBGL_VENDORS)).toBe(true);
      expect(WEBGL_VENDORS.length).toBeGreaterThan(0);

      WEBGL_VENDORS.forEach(vendor => {
        expect(typeof vendor).toBe('string');
        expect(vendor.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getRandomViewport', () => {
    test('should return a viewport object with width and height', () => {
      const viewport = getRandomViewport();
      expect(viewport).toHaveProperty('width');
      expect(viewport).toHaveProperty('height');
      expect(typeof viewport.width).toBe('number');
      expect(typeof viewport.height).toBe('number');
    });

    test('should return viewport with reasonable dimensions', () => {
      for (let i = 0; i < 100; i++) {
        const viewport = getRandomViewport();
        expect(viewport.width).toBeGreaterThan(1000);
        expect(viewport.width).toBeLessThan(3000);
        expect(viewport.height).toBeGreaterThan(600);
        expect(viewport.height).toBeLessThan(2000);
      }
    });

    test('should add slight randomization to base viewport sizes', () => {
      const viewports = [];
      for (let i = 0; i < 100; i++) {
        viewports.push(getRandomViewport());
      }

      // Check that we get some variation (not all identical)
      const uniqueWidths = new Set(viewports.map(v => v.width));
      const uniqueHeights = new Set(viewports.map(v => v.height));

      expect(uniqueWidths.size).toBeGreaterThan(1);
      expect(uniqueHeights.size).toBeGreaterThan(1);
    });

    test('should return different results on multiple calls', () => {
      const results = new Set();
      for (let i = 0; i < 50; i++) {
        const viewport = getRandomViewport();
        results.add(`${viewport.width}x${viewport.height}`);
      }
      // Should have multiple unique viewport sizes
      expect(results.size).toBeGreaterThan(3);
    });
  });

  describe('getRealisticUserAgent', () => {
    test('should return a valid user agent string', () => {
      const ua = getRealisticUserAgent();
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(50);
    });

    test('should return a user agent from the predefined list', () => {
      for (let i = 0; i < 50; i++) {
        const ua = getRealisticUserAgent();
        expect(USER_AGENTS).toContain(ua);
      }
    });

    test('should include browser identifier', () => {
      for (let i = 0; i < 20; i++) {
        const ua = getRealisticUserAgent();
        expect(
          ua.includes('Chrome') ||
          ua.includes('Firefox') ||
          ua.includes('Safari') ||
          ua.includes('Edge')
        ).toBe(true);
      }
    });

    test('should include OS identifier', () => {
      for (let i = 0; i < 20; i++) {
        const ua = getRealisticUserAgent();
        expect(
          ua.includes('Windows') ||
          ua.includes('Macintosh') ||
          ua.includes('Linux')
        ).toBe(true);
      }
    });
  });

  describe('getEvasionScript', () => {
    test('should return a non-empty string', () => {
      const script = getEvasionScript();
      expect(typeof script).toBe('string');
      expect(script.length).toBeGreaterThan(1000);
    });

    test('should contain navigator.webdriver override', () => {
      const script = getEvasionScript();
      expect(script).toContain('navigator');
      expect(script).toContain('webdriver');
      expect(script).toContain('undefined');
    });

    test('should contain navigator.platform override', () => {
      const script = getEvasionScript();
      expect(script).toContain("navigator, 'platform'");
    });

    test('should contain navigator.languages override', () => {
      const script = getEvasionScript();
      expect(script).toContain("navigator, 'languages'");
    });

    test('should contain plugins override', () => {
      const script = getEvasionScript();
      expect(script).toContain('plugins');
      expect(script).toContain('Chrome PDF');
    });

    test('should contain window.chrome override', () => {
      const script = getEvasionScript();
      expect(script).toContain('window.chrome');
    });

    test('should contain screen property overrides', () => {
      const script = getEvasionScript();
      expect(script).toContain("screen, 'width'");
      expect(script).toContain("screen, 'height'");
      expect(script).toContain('colorDepth');
    });

    test('should contain WebGL fingerprint evasion', () => {
      const script = getEvasionScript();
      expect(script).toContain('WebGLRenderingContext');
      expect(script).toContain('getParameter');
      expect(script).toContain('37445'); // UNMASKED_VENDOR_WEBGL
      expect(script).toContain('37446'); // UNMASKED_RENDERER_WEBGL
    });

    test('should contain canvas fingerprint evasion', () => {
      const script = getEvasionScript();
      expect(script).toContain('HTMLCanvasElement');
      expect(script).toContain('toDataURL');
      expect(script).toContain('toBlob');
    });

    test('should contain audio fingerprint evasion', () => {
      const script = getEvasionScript();
      expect(script).toContain('AudioContext');
      expect(script).toContain('createAnalyser');
    });

    test('should contain timezone override', () => {
      const script = getEvasionScript();
      expect(script).toContain('getTimezoneOffset');
      expect(script).toContain('DateTimeFormat');
    });

    test('should remove automation traces', () => {
      const script = getEvasionScript();
      expect(script).toContain('_phantom');
      expect(script).toContain('_selenium');
      expect(script).toContain('__webdriver');
    });

    test('should handle iframe contentWindow', () => {
      const script = getEvasionScript();
      expect(script).toContain('HTMLIFrameElement');
      expect(script).toContain('contentWindow');
    });

    test('should be a valid IIFE', () => {
      const script = getEvasionScript();
      expect(script.trim()).toMatch(/^\(function\(\)/);
      expect(script.trim()).toMatch(/\}\)\(\);$/);
    });

    test('should produce different scripts on each call due to random values', () => {
      const scripts = new Set();
      for (let i = 0; i < 10; i++) {
        scripts.add(getEvasionScript());
      }
      // Scripts should vary due to random selections
      expect(scripts.size).toBeGreaterThan(1);
    });
  });

  describe('getFingerprintConfig', () => {
    test('should return a complete fingerprint configuration', () => {
      const config = getFingerprintConfig();

      expect(config).toHaveProperty('viewport');
      expect(config).toHaveProperty('userAgent');
      expect(config).toHaveProperty('platform');
      expect(config).toHaveProperty('languages');
      expect(config).toHaveProperty('timezone');
      expect(config).toHaveProperty('screen');
      expect(config).toHaveProperty('webglRenderer');
      expect(config).toHaveProperty('webglVendor');
    });

    test('should return valid viewport configuration', () => {
      const config = getFingerprintConfig();
      expect(config.viewport).toHaveProperty('width');
      expect(config.viewport).toHaveProperty('height');
      expect(typeof config.viewport.width).toBe('number');
      expect(typeof config.viewport.height).toBe('number');
    });

    test('should return valid user agent', () => {
      const config = getFingerprintConfig();
      expect(typeof config.userAgent).toBe('string');
      expect(USER_AGENTS).toContain(config.userAgent);
    });

    test('should return valid platform', () => {
      const config = getFingerprintConfig();
      expect(typeof config.platform).toBe('string');
      expect(PLATFORMS).toContain(config.platform);
    });

    test('should return valid languages array', () => {
      const config = getFingerprintConfig();
      expect(Array.isArray(config.languages)).toBe(true);
      expect(config.languages.length).toBeGreaterThan(0);
    });

    test('should return valid timezone', () => {
      const config = getFingerprintConfig();
      expect(config.timezone).toHaveProperty('offset');
      expect(config.timezone).toHaveProperty('name');
    });

    test('should return valid screen configuration', () => {
      const config = getFingerprintConfig();
      expect(config.screen).toHaveProperty('width');
      expect(config.screen).toHaveProperty('height');
      expect(config.screen).toHaveProperty('colorDepth');
    });

    test('should return valid WebGL strings', () => {
      const config = getFingerprintConfig();
      expect(typeof config.webglRenderer).toBe('string');
      expect(typeof config.webglVendor).toBe('string');
      expect(WEBGL_RENDERERS).toContain(config.webglRenderer);
      expect(WEBGL_VENDORS).toContain(config.webglVendor);
    });

    test('should produce different configurations on each call', () => {
      const configs = [];
      for (let i = 0; i < 20; i++) {
        configs.push(getFingerprintConfig());
      }

      // Check for variety in user agents
      const uniqueUserAgents = new Set(configs.map(c => c.userAgent));
      expect(uniqueUserAgents.size).toBeGreaterThan(1);

      // Check for variety in platforms
      const uniquePlatforms = new Set(configs.map(c => c.platform));
      expect(uniquePlatforms.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Consistency Checks', () => {
    test('screen config should match viewport sizes', () => {
      // Verify that there are matching screen configs for viewport sizes
      const viewportSizes = VIEWPORT_SIZES.map(v => `${v.width}x${v.height}`);
      const screenSizes = SCREEN_CONFIGS.map(s => `${s.width}x${s.height}`);

      // At least some should overlap
      const overlap = viewportSizes.filter(v => screenSizes.includes(v));
      expect(overlap.length).toBeGreaterThan(0);
    });

    test('user agents should match common browser patterns', () => {
      USER_AGENTS.forEach(ua => {
        // Each user agent should have a version number pattern
        expect(ua).toMatch(/\d+\.\d+/);
        // Each should have AppleWebKit for Chrome/Safari
        if (ua.includes('Chrome') || ua.includes('Safari')) {
          expect(ua).toContain('AppleWebKit');
        }
        // Each should have Gecko for Firefox
        if (ua.includes('Firefox')) {
          expect(ua).toContain('Gecko');
        }
      });
    });

    test('timezone names should be valid IANA timezone names', () => {
      TIMEZONES.forEach(tz => {
        expect(tz.name).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$/);
      });
    });

    test('WebGL vendors and renderers should be compatible pairs', () => {
      // Check that NVIDIA renderers exist if NVIDIA vendor exists
      const hasNvidiaVendor = WEBGL_VENDORS.some(v => v.includes('NVIDIA'));
      const hasNvidiaRenderer = WEBGL_RENDERERS.some(r => r.includes('NVIDIA'));
      expect(hasNvidiaVendor).toBe(hasNvidiaRenderer);

      // Check that AMD renderers exist if AMD vendor exists
      const hasAmdVendor = WEBGL_VENDORS.some(v => v.includes('AMD'));
      const hasAmdRenderer = WEBGL_RENDERERS.some(r => r.includes('AMD'));
      expect(hasAmdVendor).toBe(hasAmdRenderer);

      // Check that Intel renderers exist if Intel vendor exists
      const hasIntelVendor = WEBGL_VENDORS.some(v => v.includes('Intel'));
      const hasIntelRenderer = WEBGL_RENDERERS.some(r => r.includes('Intel'));
      expect(hasIntelVendor).toBe(hasIntelRenderer);
    });
  });

  describe('Evasion Script Syntax', () => {
    test('script should be syntactically valid JavaScript', () => {
      const script = getEvasionScript();
      // This will throw if syntax is invalid
      expect(() => {
        new Function(script);
      }).not.toThrow();
    });

    test('script should not contain undefined variables in substitutions', () => {
      const script = getEvasionScript();
      // Check for template substitution failures (e.g., ${undefined} or string concatenation with undefined)
      // Note: The script intentionally contains 'undefined' keyword for things like:
      // - `get: () => undefined` (setting navigator.webdriver to undefined)
      // - `typeof X !== 'undefined'` (type checks)
      // - `=== undefined` (equality checks)
      // These are valid JavaScript, not substitution errors.
      expect(script).not.toContain('${undefined}');
      expect(script).not.toMatch(/\+ undefined/);
      expect(script).not.toMatch(/undefined \+/);
      expect(script).not.toContain('${NaN}');
      expect(script).not.toMatch(/\+ NaN[^a-zA-Z]/);
      expect(script).not.toMatch(/NaN \+/);
    });

    test('script should properly escape strings', () => {
      for (let i = 0; i < 20; i++) {
        const script = getEvasionScript();
        // Verify the script is syntactically valid JavaScript
        // This ensures strings are properly escaped
        expect(() => {
          new Function(script);
        }).not.toThrow();
      }
    });
  });
});
