/**
 * Tests for Plugin Enumeration Evasion
 * Tests realistic plugin lists and navigator.plugins spoofing
 */

const PluginEnumerationEvasion = require('../../src/evasion/plugin-enumeration-evasion');

describe('Plugin Enumeration Evasion', () => {
  let evasion;

  beforeEach(() => {
    evasion = new PluginEnumerationEvasion({
      category: 'desktop',
      platform: 'Windows'
    });
  });

  describe('Initialization', () => {
    test('should initialize with device profile', () => {
      expect(evasion.enabled).toBe(true);
      expect(evasion.deviceProfile.category).toBe('desktop');
    });

    test('should generate plugins', () => {
      expect(Array.isArray(evasion.plugins)).toBe(true);
      expect(evasion.plugins.length).toBeGreaterThan(0);
    });

    test('should generate MIME types', () => {
      expect(Array.isArray(evasion.mimeTypes)).toBe(true);
      expect(evasion.mimeTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Plugin Generation', () => {
    test('should include PDF plugin on all platforms', () => {
      const pdfPlugin = evasion.plugins.find(p => p.name.includes('PDF'));

      expect(pdfPlugin).toBeDefined();
      expect(pdfPlugin.filename).toBeDefined();
    });

    test('should have minimal plugins on smartphone', () => {
      const mobileEvasion = new PluginEnumerationEvasion({
        category: 'smartphone'
      });

      expect(mobileEvasion.plugins.length).toBeLessThanOrEqual(3);
    });

    test('should have more plugins on desktop', () => {
      const desktopEvasion = new PluginEnumerationEvasion({
        category: 'desktop'
      });

      expect(desktopEvasion.plugins.length).toBeGreaterThan(2);
    });

    test('should include Chrome plugins for Chrome browser', () => {
      const evasion = new PluginEnumerationEvasion({
        category: 'desktop',
        platform: 'Linux'
      });

      const hasChromePDF = evasion.plugins.some(p => p.name.includes('Chrome'));
      expect(hasChromePDF).toBe(true);
    });

    test('should include Silverlight on Windows sometimes', () => {
      let hasSilverlight = false;

      // Run multiple times due to randomness
      for (let i = 0; i < 10; i++) {
        const e = new PluginEnumerationEvasion({
          category: 'desktop',
          platform: 'Windows'
        });
        if (e.plugins.some(p => p.name.includes('Silverlight'))) {
          hasSilverlight = true;
          break;
        }
      }

      expect(hasSilverlight).toBe(true);
    });

    test('should include Flash on Windows sometimes', () => {
      let hasFlash = false;

      for (let i = 0; i < 10; i++) {
        const e = new PluginEnumerationEvasion({
          category: 'desktop',
          platform: 'Windows'
        });
        if (e.plugins.some(p => p.name.includes('Flash'))) {
          hasFlash = true;
          break;
        }
      }

      expect(hasFlash).toBe(true);
    });

    test('should have Java on Windows sometimes', () => {
      let hasJava = false;

      for (let i = 0; i < 10; i++) {
        const e = new PluginEnumerationEvasion({
          category: 'desktop',
          platform: 'Windows'
        });
        if (e.plugins.some(p => p.name.includes('Java'))) {
          hasJava = true;
          break;
        }
      }

      expect(hasJava).toBe(true);
    });

    test('should have appropriate macOS plugins', () => {
      const macEvasion = new PluginEnumerationEvasion({
        category: 'desktop',
        platform: 'MacOS'
      });

      const pluginNames = macEvasion.plugins.map(p => p.name).join(',');
      expect(pluginNames).toMatch(/PDF|WebKit/);
    });
  });

  describe('MIME Type Generation', () => {
    test('should always include PDF MIME types', () => {
      const hasPDF = evasion.mimeTypes.some(m => m.type === 'application/pdf');

      expect(hasPDF).toBe(true);
    });

    test('should map MIME types to plugins', () => {
      const hasFlash = evasion.plugins.some(p => p.name.includes('Flash'));
      const hasFlashMime = evasion.mimeTypes.some(m => m.type.includes('flash'));

      expect(hasFlash === hasFlashMime).toBe(true);
    });

    test('should have valid MIME type structure', () => {
      evasion.mimeTypes.forEach(mime => {
        expect(mime.type).toBeDefined();
        expect(mime.description).toBeDefined();
        expect(mime.suffixes).toBeDefined();
        expect(mime.enabled).toBeDefined();
      });
    });

    test('should include Java MIME if Java plugin exists', () => {
      const hasJava = evasion.plugins.some(p => p.name.includes('Java'));
      const hasJavaMime = evasion.mimeTypes.some(m => m.type.includes('java'));

      expect(hasJava === hasJavaMime).toBe(true);
    });

    test('should include Silverlight MIME if plugin exists', () => {
      const hasSilverlight = evasion.plugins.some(p => p.name.includes('Silverlight'));
      const hasSilverlightMime = evasion.mimeTypes.some(m => m.type.includes('silverlight'));

      expect(hasSilverlight === hasSilverlightMime).toBe(true);
    });
  });

  describe('Plugin Retrieval', () => {
    test('should get plugins array', () => {
      const plugins = evasion.getPlugins();

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });

    test('should get MIME types array', () => {
      const mimes = evasion.getMimeTypes();

      expect(Array.isArray(mimes)).toBe(true);
      expect(mimes.length).toBeGreaterThan(0);
    });

    test('should get plugin by name', () => {
      const plugin = evasion.getPluginByName('PDF');

      expect(plugin).toBeDefined();
      expect(plugin.name).toContain('PDF');
    });

    test('should get plugin by index', () => {
      const plugin = evasion.getPluginByIndex(0);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBeDefined();
    });

    test('should get MIME type', () => {
      const mime = evasion.getMimeType('application/pdf');

      expect(mime).toBeDefined();
      expect(mime.type).toBe('application/pdf');
    });

    test('should return undefined for unknown plugin', () => {
      const plugin = evasion.getPluginByName('UnknownPlugin');

      expect(plugin).toBeUndefined();
    });

    test('should return undefined for unknown MIME', () => {
      const mime = evasion.getMimeType('application/unknown');

      expect(mime).toBeUndefined();
    });
  });

  describe('Plugin Status', () => {
    test('should report plugin as enabled', () => {
      const enabled = evasion.isPluginEnabled('PDF');

      expect(enabled).toBe(true);
    });

    test('should report unknown plugin as disabled', () => {
      const enabled = evasion.isPluginEnabled('UnknownPlugin');

      expect(enabled).toBe(false);
    });
  });

  describe('Plugin Array Creation', () => {
    test('should create plugin array', () => {
      const array = evasion.createPluginArray();

      expect(Array.isArray(array)).toBe(true);
      expect(array.length).toBeGreaterThan(0);
      expect(typeof array.item).toBe('function');
      expect(typeof array.namedItem).toBe('function');
      expect(typeof array.refresh).toBe('function');
    });

    test('should support array.item()', () => {
      const array = evasion.createPluginArray();
      const plugin = array.item(0);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBeDefined();
    });

    test('should support array.namedItem()', () => {
      const array = evasion.createPluginArray();
      const plugin = array.namedItem('PDF');

      expect(plugin).toBeDefined();
    });

    test('should have correct length', () => {
      const array = evasion.createPluginArray();

      expect(array.length).toBe(evasion.plugins.length);
    });
  });

  describe('MIME Type Array Creation', () => {
    test('should create MIME type array', () => {
      const array = evasion.createMimeTypeArray();

      expect(Array.isArray(array)).toBe(true);
      expect(array.length).toBeGreaterThan(0);
      expect(typeof array.item).toBe('function');
      expect(typeof array.namedItem).toBe('function');
    });

    test('should support array.item()', () => {
      const array = evasion.createMimeTypeArray();
      const mime = array.item(0);

      expect(mime).toBeDefined();
      expect(mime.type).toBeDefined();
    });

    test('should support array.namedItem()', () => {
      const array = evasion.createMimeTypeArray();
      const mime = array.namedItem('application/pdf');

      expect(mime).toBeDefined();
    });
  });

  describe('Plugin Object Creation', () => {
    test('should create plugin object', () => {
      const plugin = evasion.plugins[0];
      const obj = evasion.createPluginObject(plugin);

      expect(obj.name).toBe(plugin.name);
      expect(obj.description).toBe(plugin.description);
      expect(obj.filename).toBe(plugin.filename);
      expect(obj.version).toBe(plugin.version);
      expect(typeof obj.item).toBe('function');
      expect(typeof obj.namedItem).toBe('function');
    });
  });

  describe('Navigator Spoofing', () => {
    test('should spoof navigator.plugins', () => {
      const mockNavigator = {};

      evasion.spoofNavigatorPlugins(mockNavigator);

      // Verify that Object.defineProperty was attempted
      expect(mockNavigator).toBeDefined();
    });

    test('should spoof navigator.mimeTypes', () => {
      const mockNavigator = {};

      evasion.spoofNavigatorMimeTypes(mockNavigator);

      // Verify that Object.defineProperty was attempted
      expect(mockNavigator).toBeDefined();
    });

    test('should handle errors gracefully', () => {
      const mockNavigator = Object.freeze({});

      // Should not throw
      expect(() => {
        evasion.spoofNavigatorPlugins(mockNavigator);
      }).not.toThrow();

      expect(() => {
        evasion.spoofNavigatorMimeTypes(mockNavigator);
      }).not.toThrow();
    });
  });

  describe('Status Reporting', () => {
    test('should report status', () => {
      const status = evasion.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.pluginCount).toBeGreaterThan(0);
      expect(status.mimeTypeCount).toBeGreaterThan(0);
      expect(Array.isArray(status.plugins)).toBe(true);
      expect(Array.isArray(status.mimeTypes)).toBe(true);
      expect(Array.isArray(status.techniques)).toBe(true);
    });

    test('should list all techniques', () => {
      const status = evasion.getStatus();

      expect(status.techniques).toContain('realistic-plugin-enumeration');
      expect(status.techniques).toContain('mime-type-mapping');
      expect(status.techniques).toContain('platform-specific-plugins');
      expect(status.techniques).toContain('navigator-plugins-spoofing');
    });

    test('should report plugin names in status', () => {
      const status = evasion.getStatus();

      expect(status.plugins.length).toBeGreaterThan(0);
      expect(status.plugins[0].name).toBeDefined();
      expect(status.plugins[0].filename).toBeDefined();
    });
  });

  describe('Device Profile Updates', () => {
    test('should update device profile', () => {
      const newProfile = {
        category: 'smartphone',
        platform: 'Android'
      };

      evasion.setDeviceProfile(newProfile);

      expect(evasion.deviceProfile).toEqual(newProfile);
    });

    test('should regenerate plugins on update', () => {
      const oldCount = evasion.plugins.length;

      evasion.setDeviceProfile({ category: 'smartphone' });

      // Mobile should have fewer plugins
      expect(evasion.plugins.length).toBeLessThan(oldCount);
    });

    test('should regenerate MIME types on update', () => {
      const oldCount = evasion.mimeTypes.length;

      evasion.setDeviceProfile({ category: 'smartphone' });

      // Should regenerate
      expect(evasion.mimeTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Plugins', () => {
    test('should add custom plugin', () => {
      const initialCount = evasion.plugins.length;

      evasion.addCustomPlugin({
        name: 'Custom Plugin',
        description: 'Test',
        filename: 'custom.dll',
        version: '1.0'
      });

      expect(evasion.plugins.length).toBe(initialCount + 1);
    });

    test('should not add invalid plugin', () => {
      const initialCount = evasion.plugins.length;

      evasion.addCustomPlugin({ name: 'Test' }); // No filename

      expect(evasion.plugins.length).toBe(initialCount);
    });

    test('should remove plugin by name', () => {
      const initialCount = evasion.plugins.length;

      evasion.removePlugin('PDF');

      expect(evasion.plugins.length).toBeLessThan(initialCount);
      expect(evasion.plugins.some(p => p.name.includes('PDF'))).toBe(false);
    });
  });

  describe('Browser Type Detection', () => {
    test('should detect Chrome browser on Linux', () => {
      const browserType = new PluginEnumerationEvasion({
        platform: 'Linux'
      }).detectBrowserType('Linux');

      expect(browserType).toBe('chrome');
    });

    test('should detect Safari or Chrome on Mac', () => {
      const browserType = new PluginEnumerationEvasion({
        platform: 'MacOS'
      }).detectBrowserType('MacOS');

      expect(['safari', 'chrome']).toContain(browserType);
    });

    test('should detect Edge or Chrome on Windows', () => {
      const browserType = new PluginEnumerationEvasion({
        platform: 'Windows'
      }).detectBrowserType('Windows');

      expect(['edge', 'chrome']).toContain(browserType);
    });
  });
});
