/**
 * Tests for Vendor Detection Evasion
 * Tests vendor string, User-Agent Client Hints, plugin enumeration, feature detection
 */

const VendorDetectionEvasion = require('../../src/evasion/vendor-detection-evasion');

describe('Vendor Detection Evasion', () => {
  let evasion;

  beforeEach(() => {
    evasion = new VendorDetectionEvasion({
      category: 'desktop',
      brand: 'Google',
      platform: 'Linux'
    });
  });

  describe('Initialization', () => {
    test('should initialize with device profile', () => {
      expect(evasion.enabled).toBe(true);
      expect(evasion.brand).toBe('Google');
      expect(evasion.platform).toBe('Linux');
    });

    test('should generate realistic plugins', () => {
      expect(Array.isArray(evasion.plugins)).toBe(true);
      expect(evasion.plugins.length).toBeGreaterThan(0);
    });

    test('should generate MIME types', () => {
      expect(Array.isArray(evasion.mimeTypes)).toBe(true);
      expect(evasion.mimeTypes.length).toBeGreaterThan(0);
    });

    test('should generate feature support map', () => {
      expect(typeof evasion.features).toBe('object');
      expect(Object.keys(evasion.features).length).toBeGreaterThan(0);
    });
  });

  describe('Vendor String Spoofing', () => {
    test('should return consistent vendor string', () => {
      const vendor1 = evasion.getVendorString();
      const vendor2 = evasion.getVendorString();

      expect(vendor1).toBe(vendor2);
    });

    test('should spoof Apple vendor', () => {
      const appleEvasion = new VendorDetectionEvasion({ brand: 'Apple' });
      const vendor = appleEvasion.getVendorString();

      expect(vendor).toBe('Apple Computer, Inc.');
    });

    test('should spoof Google vendor', () => {
      const vendor = evasion.getVendorString();

      expect(vendor).toBe('Google Inc.');
    });

    test('should spoof Samsung vendor', () => {
      const samsungEvasion = new VendorDetectionEvasion({ brand: 'Samsung' });
      const vendor = samsungEvasion.getVendorString();

      expect(vendor).toBe('Samsung Electronics Co., Ltd.');
    });

    test('should default to Mozilla for generic brand', () => {
      const genericEvasion = new VendorDetectionEvasion({ brand: 'Generic' });
      const vendor = genericEvasion.getVendorString();

      expect(vendor).toBe('Mozilla');
    });
  });

  describe('User-Agent Data', () => {
    test('should return User-Agent data', () => {
      const uaData = evasion.getUserAgentData();

      expect(uaData.brands).toBeDefined();
      expect(uaData.mobile).toBeDefined();
      expect(uaData.platform).toBeDefined();
      expect(uaData.platformVersion).toBeDefined();
      expect(uaData.bitness).toBe('64');
      expect(typeof uaData.getHighEntropyValues).toBe('function');
    });

    test('should return consistent data', () => {
      const uaData1 = evasion.getUserAgentData();
      const uaData2 = evasion.getUserAgentData();

      expect(uaData1.brands).toEqual(uaData2.brands);
      expect(uaData1.platform).toBe(uaData2.platform);
    });

    test('should set mobile flag correctly', () => {
      const desktopEvasion = new VendorDetectionEvasion({ category: 'desktop' });
      expect(desktopEvasion.getUserAgentData().mobile).toBe(false);

      const mobileEvasion = new VendorDetectionEvasion({ category: 'smartphone' });
      expect(mobileEvasion.getUserAgentData().mobile).toBe(true);
    });
  });

  describe('User-Agent Brands', () => {
    test('should return brands array', () => {
      const brands = evasion.getUserAgentBrands();

      expect(Array.isArray(brands)).toBe(true);
      expect(brands.length).toBeGreaterThan(0);
      expect(brands[0].brand).toBeDefined();
      expect(brands[0].version).toBeDefined();
    });

    test('should return Chrome brands for Linux', () => {
      const brands = evasion.getUserAgentBrands();

      const hasChrome = brands.some(b => b.brand.includes('Chrome') || b.brand.includes('Chromium'));
      expect(hasChrome).toBe(true);
    });

    test('should return Safari or Chrome for Mac', () => {
      const macEvasion = new VendorDetectionEvasion({ platform: 'MacOS' });
      const brands = macEvasion.getUserAgentBrands();

      const hasBrowser = brands.some(b =>
        b.brand.includes('Safari') || b.brand.includes('Chrome')
      );
      expect(hasBrowser).toBe(true);
    });

    test('should return Edge or Chrome for Windows', () => {
      const winEvasion = new VendorDetectionEvasion({ platform: 'Windows' });
      const brands = winEvasion.getUserAgentBrands();

      const hasBrowser = brands.some(b =>
        b.brand.includes('Edge') || b.brand.includes('Chrome')
      );
      expect(hasBrowser).toBe(true);
    });
  });

  describe('Browser Type Detection', () => {
    test('should detect browser type', () => {
      const browserType = evasion.getBrowserType();

      expect(['chrome', 'firefox', 'safari', 'edge']).toContain(browserType);
    });

    test('should return consistent browser type', () => {
      const type1 = evasion.getBrowserType();
      const type2 = evasion.getBrowserType();

      expect(type1).toBe(type2);
    });

    test('should prefer Chrome on Linux', () => {
      const linuxEvasion = new VendorDetectionEvasion({ platform: 'Linux' });
      const browserType = linuxEvasion.getBrowserType();

      expect(browserType).toBe('chrome');
    });
  });

  describe('Platform Information', () => {
    test('should return correct platform string', () => {
      const macEvasion = new VendorDetectionEvasion({ platform: 'MacOS' });
      expect(macEvasion.getPlatformString()).toBe('macOS');

      const winEvasion = new VendorDetectionEvasion({ platform: 'Windows' });
      expect(winEvasion.getPlatformString()).toBe('Windows');

      const linuxEvasion = new VendorDetectionEvasion({ platform: 'Linux' });
      expect(linuxEvasion.getPlatformString()).toBe('Linux');
    });

    test('should generate platform version', () => {
      const version = evasion.getPlatformVersion();

      expect(typeof version).toBe('string');
      expect(version.includes('.')).toBe(true);
    });

    test('should return different versions for Mac', () => {
      const macEvasion = new VendorDetectionEvasion({ platform: 'MacOS' });
      const version = macEvasion.getPlatformVersion();

      expect(version).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should return valid Windows versions', () => {
      const winEvasion = new VendorDetectionEvasion({ platform: 'Windows' });
      const version = winEvasion.getPlatformVersion();

      expect(['10.0', '11.0']).toContain(version);
    });
  });

  describe('Architecture', () => {
    test('should return architecture string', () => {
      const arch = evasion.getArchitecture();

      expect(['arm', 'arm64', 'x86']).toContain(arch);
    });

    test('should return ARM variants for mobile', () => {
      const mobileEvasion = new VendorDetectionEvasion({ category: 'smartphone' });
      const arch = mobileEvasion.getArchitecture();

      expect(['arm', 'arm64']).toContain(arch);
    });

    test('should return x86 or arm64 for desktop', () => {
      const desktopEvasion = new VendorDetectionEvasion({ category: 'desktop' });
      const arch = desktopEvasion.getArchitecture();

      expect(['x86', 'arm64']).toContain(arch);
    });
  });

  describe('Device Model', () => {
    test('should return device model', () => {
      const model = evasion.getDeviceModel();

      expect(typeof model).toBe('string');
    });

    test('should return iPhone model for Apple smartphone', () => {
      const appleEvasion = new VendorDetectionEvasion({
        brand: 'Apple',
        category: 'smartphone'
      });
      const model = appleEvasion.getDeviceModel();

      expect(model).toContain('iPhone');
    });

    test('should return Galaxy model for Samsung', () => {
      const samsungEvasion = new VendorDetectionEvasion({
        brand: 'Samsung'
      });
      const model = samsungEvasion.getDeviceModel();

      expect(model).toContain('Galaxy');
    });

    test('should return Pixel model for Google', () => {
      const googleEvasion = new VendorDetectionEvasion({
        brand: 'Google'
      });
      const model = googleEvasion.getDeviceModel();

      expect(model).toContain('Pixel');
    });
  });

  describe('High Entropy Values', () => {
    test('should return high entropy values', async () => {
      const values = await evasion.getHighEntropyValues(['platform', 'platformVersion']);

      expect(values.platform).toBeDefined();
      expect(values.platformVersion).toBeDefined();
    });

    test('should return all requested hints', async () => {
      const hints = ['platform', 'model', 'bitness'];
      const values = await evasion.getHighEntropyValues(hints);

      hints.forEach(hint => {
        if (hint !== 'model' || evasion.getDeviceModel()) {
          expect(values[hint]).toBeDefined();
        }
      });
    });

    test('should ignore unknown hints', async () => {
      const values = await evasion.getHighEntropyValues(['unknown-hint']);

      expect(values['unknown-hint']).toBeUndefined();
    });
  });

  describe('Plugin Management', () => {
    test('should return plugins array', () => {
      const plugins = evasion.plugins;

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });

    test('should get plugin by name', () => {
      const plugin = evasion.getPlugin('PDF');

      expect(plugin).toBeDefined();
      expect(plugin.name).toContain('PDF');
    });

    test('should return undefined for unknown plugin', () => {
      const plugin = evasion.getPlugin('UnknownPlugin');

      expect(plugin).toBeUndefined();
    });

    test('should have realistic desktop plugins', () => {
      const desktopEvasion = new VendorDetectionEvasion({ category: 'desktop' });
      const pluginNames = desktopEvasion.plugins.map(p => p.name).join(',');

      expect(pluginNames).toContain('PDF');
    });

    test('should have minimal mobile plugins', () => {
      const mobileEvasion = new VendorDetectionEvasion({ category: 'smartphone' });

      expect(mobileEvasion.plugins.length).toBeLessThan(3);
    });
  });

  describe('MIME Type Management', () => {
    test('should return MIME types', () => {
      expect(Array.isArray(evasion.mimeTypes)).toBe(true);
      expect(evasion.mimeTypes.length).toBeGreaterThan(0);
    });

    test('should get MIME type handler', () => {
      const mimeType = evasion.getMimeTypeHandler('application/pdf');

      expect(mimeType).toBeDefined();
      expect(mimeType.type).toBe('application/pdf');
    });

    test('should return undefined for unknown MIME type', () => {
      const mimeType = evasion.getMimeTypeHandler('application/unknown');

      expect(mimeType).toBeUndefined();
    });

    test('should map plugins to MIME types', () => {
      const hasFlash = evasion.plugins.some(p => p.name.includes('Flash'));
      const hasFlashMime = evasion.mimeTypes.some(m => m.type.includes('flash'));

      expect(hasFlash === hasFlashMime).toBe(true);
    });
  });

  describe('Feature Support', () => {
    test('should report feature support', () => {
      expect(evasion.features['localStorage']).toBe(true);
      expect(evasion.features['webGL']).toBe(true);
    });

    test('should support mobile-specific features', () => {
      const mobileEvasion = new VendorDetectionEvasion({ category: 'smartphone' });

      expect(mobileEvasion.features['camera']).toBe(true);
      expect(mobileEvasion.features['microphone']).toBe(true);
      expect(mobileEvasion.features['accelerometer']).toBe(true);
    });

    test('should not support mobile features on desktop', () => {
      const desktopEvasion = new VendorDetectionEvasion({ category: 'desktop' });

      expect(desktopEvasion.features['camera']).toBe(false);
      expect(desktopEvasion.features['accelerometer']).toBe(false);
    });

    test('should check feature support', () => {
      const supported = evasion.isFeatureSupported('localStorage');

      expect(typeof supported).toBe('boolean');
    });
  });

  describe('Status Reporting', () => {
    test('should report status', () => {
      const status = evasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.vendor).toBeDefined();
      expect(status.platform).toBeDefined();
      expect(status.pluginCount).toBeGreaterThan(0);
      expect(status.mimeTypeCount).toBeGreaterThan(0);
      expect(Array.isArray(status.techniques)).toBe(true);
    });

    test('should list all techniques', () => {
      const status = evasion.getStatus();

      expect(status.techniques).toContain('vendor-string-spoofing');
      expect(status.techniques).toContain('user-agent-client-hints');
      expect(status.techniques).toContain('plugin-enumeration');
      expect(status.techniques).toContain('mime-type-mapping');
      expect(status.techniques).toContain('feature-support-reporting');
    });
  });

  describe('Device Profile Updates', () => {
    test('should update device profile', () => {
      const newProfile = {
        category: 'tablet',
        brand: 'Samsung',
        platform: 'Android'
      };

      evasion.setDeviceProfile(newProfile);

      expect(evasion.deviceProfile).toEqual(newProfile);
      expect(evasion.brand).toBe('Samsung');
      expect(evasion.platform).toBe('Android');
    });

    test('should regenerate plugins on profile update', () => {
      const plugins1 = evasion.plugins.length;

      evasion.setDeviceProfile({ category: 'smartphone' });

      const plugins2 = evasion.plugins.length;
      expect(plugins2).toBeLessThan(plugins1);
    });

    test('should clear consistency cache on update', () => {
      evasion.getVendorString();
      expect(evasion.consistencyCache.size).toBeGreaterThan(0);

      evasion.setDeviceProfile({ brand: 'Apple' });

      expect(evasion.consistencyCache.size).toBe(0);
    });
  });
});
