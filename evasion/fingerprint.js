/**
 * Basset Hound Browser - Anti-Fingerprinting Module
 * Provides evasion techniques for bot detection systems
 */

// Realistic viewport sizes for randomization
const VIEWPORT_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1280, height: 800 },
  { width: 1680, height: 1050 },
  { width: 1920, height: 1200 },
  { width: 2560, height: 1440 },
];

// Realistic user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

// Platform strings
const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64'];

// Language configurations
const LANGUAGES = [
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['en-US', 'en', 'es'],
  ['en-US'],
];

// Timezone offsets (in minutes)
const TIMEZONES = [
  { offset: -480, name: 'America/Los_Angeles' },
  { offset: -420, name: 'America/Denver' },
  { offset: -360, name: 'America/Chicago' },
  { offset: -300, name: 'America/New_York' },
  { offset: 0, name: 'Europe/London' },
  { offset: 60, name: 'Europe/Paris' },
  { offset: 120, name: 'Europe/Helsinki' },
];

// Screen configurations
const SCREEN_CONFIGS = [
  { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 },
  { width: 1366, height: 768, availWidth: 1366, availHeight: 728, colorDepth: 24 },
  { width: 1536, height: 864, availWidth: 1536, availHeight: 824, colorDepth: 24 },
  { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 30 },
  { width: 1440, height: 900, availWidth: 1440, availHeight: 860, colorDepth: 24 },
];

// WebGL renderer strings
const WEBGL_RENDERERS = [
  'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
];

const WEBGL_VENDORS = [
  'Google Inc. (NVIDIA)',
  'Google Inc. (AMD)',
  'Google Inc. (Intel)',
];

/**
 * Get a random viewport size
 */
function getRandomViewport() {
  const viewport = VIEWPORT_SIZES[Math.floor(Math.random() * VIEWPORT_SIZES.length)];
  // Add slight randomization
  return {
    width: viewport.width + Math.floor(Math.random() * 20) - 10,
    height: viewport.height + Math.floor(Math.random() * 20) - 10,
  };
}

/**
 * Get a realistic user agent string
 */
function getRealisticUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Generate a random canvas noise value
 */
function getCanvasNoise() {
  return (Math.random() * 0.0001).toFixed(10);
}

/**
 * Generate evasion script to be injected into pages
 */
function getEvasionScript() {
  const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
  const languages = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
  const timezone = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
  const screen = SCREEN_CONFIGS[Math.floor(Math.random() * SCREEN_CONFIGS.length)];
  const webglRenderer = WEBGL_RENDERERS[Math.floor(Math.random() * WEBGL_RENDERERS.length)];
  const webglVendor = WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)];
  const canvasNoise = getCanvasNoise();

  return `
    (function() {
      'use strict';

      // ==================== NAVIGATOR PROPERTIES ====================

      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });

      // Delete webdriver from prototype
      delete Object.getPrototypeOf(navigator).webdriver;

      // Override navigator.platform
      Object.defineProperty(navigator, 'platform', {
        get: () => '${platform}',
        configurable: true
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ${JSON.stringify(languages)},
        configurable: true
      });

      // Override navigator.language
      Object.defineProperty(navigator, 'language', {
        get: () => '${languages[0]}',
        configurable: true
      });

      // Override navigator.plugins
      const mockPlugins = {
        0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
        1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
        2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
        length: 3,
        item: function(index) { return this[index]; },
        namedItem: function(name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i].name === name) return this[i];
          }
          return null;
        },
        refresh: function() {}
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
        configurable: true
      });

      // Override navigator.mimeTypes
      const mockMimeTypes = {
        0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        length: 2,
        item: function(index) { return this[index]; },
        namedItem: function(name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i].type === name) return this[i];
          }
          return null;
        }
      };

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => mockMimeTypes,
        configurable: true
      });

      // Override navigator.hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => ${[4, 8, 12, 16][Math.floor(Math.random() * 4)]},
        configurable: true
      });

      // Override navigator.deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => ${[4, 8, 16, 32][Math.floor(Math.random() * 4)]},
        configurable: true
      });

      // ==================== PERMISSIONS ====================

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = function(parameters) {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(this, parameters);
      };

      // ==================== CHROME OBJECT ====================

      window.chrome = {
        runtime: {
          connect: function() {},
          sendMessage: function() {},
          onMessage: { addListener: function() {} }
        },
        loadTimes: function() {
          return {
            requestTime: Date.now() / 1000,
            startLoadTime: Date.now() / 1000,
            commitLoadTime: Date.now() / 1000,
            finishDocumentLoadTime: Date.now() / 1000,
            finishLoadTime: Date.now() / 1000,
            firstPaintTime: Date.now() / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other'
          };
        },
        csi: function() {
          return {
            onloadT: Date.now(),
            pageT: Date.now() - performance.timing.navigationStart,
            startE: performance.timing.navigationStart,
            tran: 15
          };
        },
        app: {
          isInstalled: false,
          InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run' }
        }
      };

      // ==================== SCREEN PROPERTIES ====================

      Object.defineProperty(screen, 'width', { get: () => ${screen.width}, configurable: true });
      Object.defineProperty(screen, 'height', { get: () => ${screen.height}, configurable: true });
      Object.defineProperty(screen, 'availWidth', { get: () => ${screen.availWidth}, configurable: true });
      Object.defineProperty(screen, 'availHeight', { get: () => ${screen.availHeight}, configurable: true });
      Object.defineProperty(screen, 'colorDepth', { get: () => ${screen.colorDepth}, configurable: true });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${screen.colorDepth}, configurable: true });

      // ==================== WEBGL FINGERPRINT ====================

      const getParameterProxyHandler = {
        apply: function(target, thisArg, args) {
          const param = args[0];
          const result = Reflect.apply(target, thisArg, args);

          // UNMASKED_VENDOR_WEBGL
          if (param === 37445) {
            return '${webglVendor}';
          }
          // UNMASKED_RENDERER_WEBGL
          if (param === 37446) {
            return '${webglRenderer}';
          }

          return result;
        }
      };

      // Proxy WebGL getParameter
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = new Proxy(originalGetParameter, getParameterProxyHandler);

      if (typeof WebGL2RenderingContext !== 'undefined') {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = new Proxy(originalGetParameter2, getParameterProxyHandler);
      }

      // ==================== CANVAS FINGERPRINT ====================

      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' || type === undefined) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            // Add subtle noise to pixel data
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] ^= ${Math.floor(Math.random() * 5)};
            }
            context.putImageData(imageData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, arguments);
      };

      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        if (type === 'image/png' || type === undefined) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] ^= ${Math.floor(Math.random() * 5)};
            }
            context.putImageData(imageData, 0, 0);
          }
        }
        return originalToBlob.apply(this, arguments);
      };

      // ==================== AUDIO FINGERPRINT ====================

      const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function() {
        const analyser = originalCreateAnalyser.apply(this, arguments);
        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
        analyser.getFloatFrequencyData = function(array) {
          originalGetFloatFrequencyData(array);
          // Add noise to frequency data
          for (let i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * 0.1;
          }
        };
        return analyser;
      };

      // ==================== FONT ENUMERATION ====================

      // Limit font detection by returning consistent results
      const commonFonts = [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
        'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings'
      ];

      // ==================== DATE/TIMEZONE ====================

      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return ${timezone.offset};
      };

      // Intl timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locale, options) {
        const format = new originalDateTimeFormat(locale, options);
        const originalResolvedOptions = format.resolvedOptions.bind(format);
        format.resolvedOptions = function() {
          const resolved = originalResolvedOptions();
          resolved.timeZone = '${timezone.name}';
          return resolved;
        };
        return format;
      };
      Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

      // ==================== REMOVE AUTOMATION TRACES ====================

      const automationProps = [
        '_phantom', '__nightmare', '_selenium', 'callPhantom', 'callSelenium',
        '_Selenium_IDE_Recorder', 'bot', 'headless', '__webdriver_script_fn',
        '__driver_evaluate', '__webdriver_evaluate', '__selenium_evaluate',
        '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
        '__selenium_unwrapped', '__fxdriver_unwrapped'
      ];

      automationProps.forEach(prop => {
        try { delete window[prop]; } catch(e) {}
        try { delete document[prop]; } catch(e) {}
      });

      // ==================== IFRAME CONTENTWINDOW ====================

      // Ensure iframes don't leak automation detection
      const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          const window = originalContentWindow.get.call(this);
          if (window) {
            try {
              Object.defineProperty(window.navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
              });
            } catch(e) {}
          }
          return window;
        }
      });

      console.log('[Basset Hound] Fingerprint evasion loaded');
    })();
  `;
}

/**
 * Get fingerprint configuration for current session
 */
function getFingerprintConfig() {
  return {
    viewport: getRandomViewport(),
    userAgent: getRealisticUserAgent(),
    platform: PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)],
    languages: LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
    timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
    screen: SCREEN_CONFIGS[Math.floor(Math.random() * SCREEN_CONFIGS.length)],
    webglRenderer: WEBGL_RENDERERS[Math.floor(Math.random() * WEBGL_RENDERERS.length)],
    webglVendor: WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)],
  };
}

/**
 * Generate evasion script with specific profile configuration
 * @param {Object} config - Fingerprint configuration from a profile
 * @returns {string} Evasion script
 */
function getEvasionScriptWithConfig(config) {
  if (!config) {
    return getEvasionScript();
  }

  const platform = config.platform || PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
  const languages = config.languages || LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
  const timezone = config.timezone || TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
  const screen = config.screen || SCREEN_CONFIGS[Math.floor(Math.random() * SCREEN_CONFIGS.length)];
  const webglRenderer = (config.webgl && config.webgl.renderer) || WEBGL_RENDERERS[Math.floor(Math.random() * WEBGL_RENDERERS.length)];
  const webglVendor = (config.webgl && config.webgl.vendor) || WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)];
  const canvasNoise = config.canvasNoise !== undefined ? config.canvasNoise : Math.floor(Math.random() * 5);
  const hardwareConcurrency = config.hardwareConcurrency || [4, 8, 12, 16][Math.floor(Math.random() * 4)];
  const deviceMemory = config.deviceMemory || [4, 8, 16, 32][Math.floor(Math.random() * 4)];

  return `
    (function() {
      'use strict';

      // ==================== NAVIGATOR PROPERTIES ====================

      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });

      // Delete webdriver from prototype
      delete Object.getPrototypeOf(navigator).webdriver;

      // Override navigator.platform
      Object.defineProperty(navigator, 'platform', {
        get: () => '${platform}',
        configurable: true
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ${JSON.stringify(languages)},
        configurable: true
      });

      // Override navigator.language
      Object.defineProperty(navigator, 'language', {
        get: () => '${languages[0]}',
        configurable: true
      });

      // Override navigator.plugins
      const mockPlugins = {
        0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
        1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
        2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
        length: 3,
        item: function(index) { return this[index]; },
        namedItem: function(name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i].name === name) return this[i];
          }
          return null;
        },
        refresh: function() {}
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
        configurable: true
      });

      // Override navigator.mimeTypes
      const mockMimeTypes = {
        0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        length: 2,
        item: function(index) { return this[index]; },
        namedItem: function(name) {
          for (let i = 0; i < this.length; i++) {
            if (this[i].type === name) return this[i];
          }
          return null;
        }
      };

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => mockMimeTypes,
        configurable: true
      });

      // Override navigator.hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => ${hardwareConcurrency},
        configurable: true
      });

      // Override navigator.deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => ${deviceMemory},
        configurable: true
      });

      // ==================== PERMISSIONS ====================

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = function(parameters) {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(this, parameters);
      };

      // ==================== CHROME OBJECT ====================

      window.chrome = {
        runtime: {
          connect: function() {},
          sendMessage: function() {},
          onMessage: { addListener: function() {} }
        },
        loadTimes: function() {
          return {
            requestTime: Date.now() / 1000,
            startLoadTime: Date.now() / 1000,
            commitLoadTime: Date.now() / 1000,
            finishDocumentLoadTime: Date.now() / 1000,
            finishLoadTime: Date.now() / 1000,
            firstPaintTime: Date.now() / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other'
          };
        },
        csi: function() {
          return {
            onloadT: Date.now(),
            pageT: Date.now() - performance.timing.navigationStart,
            startE: performance.timing.navigationStart,
            tran: 15
          };
        },
        app: {
          isInstalled: false,
          InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run' }
        }
      };

      // ==================== SCREEN PROPERTIES ====================

      Object.defineProperty(screen, 'width', { get: () => ${screen.width}, configurable: true });
      Object.defineProperty(screen, 'height', { get: () => ${screen.height}, configurable: true });
      Object.defineProperty(screen, 'availWidth', { get: () => ${screen.availWidth}, configurable: true });
      Object.defineProperty(screen, 'availHeight', { get: () => ${screen.availHeight}, configurable: true });
      Object.defineProperty(screen, 'colorDepth', { get: () => ${screen.colorDepth}, configurable: true });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${screen.colorDepth}, configurable: true });

      // ==================== WEBGL FINGERPRINT ====================

      const getParameterProxyHandler = {
        apply: function(target, thisArg, args) {
          const param = args[0];
          const result = Reflect.apply(target, thisArg, args);

          // UNMASKED_VENDOR_WEBGL
          if (param === 37445) {
            return '${webglVendor}';
          }
          // UNMASKED_RENDERER_WEBGL
          if (param === 37446) {
            return '${webglRenderer}';
          }

          return result;
        }
      };

      // Proxy WebGL getParameter
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = new Proxy(originalGetParameter, getParameterProxyHandler);

      if (typeof WebGL2RenderingContext !== 'undefined') {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = new Proxy(originalGetParameter2, getParameterProxyHandler);
      }

      // ==================== CANVAS FINGERPRINT ====================

      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' || type === undefined) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            // Add subtle noise to pixel data using profile-specific noise
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] ^= ${canvasNoise};
            }
            context.putImageData(imageData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, arguments);
      };

      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        if (type === 'image/png' || type === undefined) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] ^= ${canvasNoise};
            }
            context.putImageData(imageData, 0, 0);
          }
        }
        return originalToBlob.apply(this, arguments);
      };

      // ==================== AUDIO FINGERPRINT ====================

      const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function() {
        const analyser = originalCreateAnalyser.apply(this, arguments);
        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
        analyser.getFloatFrequencyData = function(array) {
          originalGetFloatFrequencyData(array);
          // Add noise to frequency data
          for (let i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * 0.1;
          }
        };
        return analyser;
      };

      // ==================== FONT ENUMERATION ====================

      // Limit font detection by returning consistent results
      const commonFonts = [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
        'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings'
      ];

      // ==================== DATE/TIMEZONE ====================

      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return ${timezone.offset};
      };

      // Intl timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locale, options) {
        const format = new originalDateTimeFormat(locale, options);
        const originalResolvedOptions = format.resolvedOptions.bind(format);
        format.resolvedOptions = function() {
          const resolved = originalResolvedOptions();
          resolved.timeZone = '${timezone.name}';
          return resolved;
        };
        return format;
      };
      Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

      // ==================== REMOVE AUTOMATION TRACES ====================

      const automationProps = [
        '_phantom', '__nightmare', '_selenium', 'callPhantom', 'callSelenium',
        '_Selenium_IDE_Recorder', 'bot', 'headless', '__webdriver_script_fn',
        '__driver_evaluate', '__webdriver_evaluate', '__selenium_evaluate',
        '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
        '__selenium_unwrapped', '__fxdriver_unwrapped'
      ];

      automationProps.forEach(prop => {
        try { delete window[prop]; } catch(e) {}
        try { delete document[prop]; } catch(e) {}
      });

      // ==================== IFRAME CONTENTWINDOW ====================

      // Ensure iframes don't leak automation detection
      const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          const window = originalContentWindow.get.call(this);
          if (window) {
            try {
              Object.defineProperty(window.navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
              });
            } catch(e) {}
          }
          return window;
        }
      });

      console.log('[Basset Hound] Profile fingerprint evasion loaded');
    })();
  `;
}

/**
 * Generate geolocation spoofing script for injection
 * @param {Object} locationData - Geolocation configuration
 * @param {number} locationData.latitude - Latitude coordinate
 * @param {number} locationData.longitude - Longitude coordinate
 * @param {number} locationData.accuracy - Accuracy in meters (default: 100)
 * @param {number|null} locationData.altitude - Altitude in meters (optional)
 * @param {number|null} locationData.altitudeAccuracy - Altitude accuracy (optional)
 * @param {number|null} locationData.heading - Heading in degrees (optional)
 * @param {number|null} locationData.speed - Speed in m/s (optional)
 * @returns {string} Geolocation spoofing script
 */
function getGeolocationSpoofScript(locationData) {
  const {
    latitude = 40.7128,
    longitude = -74.0060,
    accuracy = 100,
    altitude = null,
    altitudeAccuracy = null,
    heading = null,
    speed = null
  } = locationData || {};

  return `
    (function() {
      'use strict';

      // Store original geolocation methods
      const originalGeolocation = navigator.geolocation;
      const originalGetCurrentPosition = originalGeolocation.getCurrentPosition.bind(originalGeolocation);
      const originalWatchPosition = originalGeolocation.watchPosition.bind(originalGeolocation);
      const originalClearWatch = originalGeolocation.clearWatch.bind(originalGeolocation);

      // Spoofed position data
      const spoofedPosition = {
        coords: {
          latitude: ${latitude},
          longitude: ${longitude},
          accuracy: ${accuracy},
          altitude: ${altitude === null ? 'null' : altitude},
          altitudeAccuracy: ${altitudeAccuracy === null ? 'null' : altitudeAccuracy},
          heading: ${heading === null ? 'null' : heading},
          speed: ${speed === null ? 'null' : speed}
        },
        timestamp: Date.now()
      };

      // Store watch callbacks for position updates
      const watchCallbacks = new Map();
      let watchIdCounter = 0;

      // Override getCurrentPosition
      navigator.geolocation.getCurrentPosition = function(successCallback, errorCallback, options) {
        if (typeof successCallback === 'function') {
          // Add slight delay to simulate real geolocation lookup
          setTimeout(() => {
            successCallback({
              ...spoofedPosition,
              timestamp: Date.now()
            });
          }, Math.random() * 100 + 50);
        }
      };

      // Override watchPosition
      navigator.geolocation.watchPosition = function(successCallback, errorCallback, options) {
        const watchId = ++watchIdCounter;

        if (typeof successCallback === 'function') {
          // Store callback for future updates
          watchCallbacks.set(watchId, successCallback);

          // Initial position update
          setTimeout(() => {
            successCallback({
              ...spoofedPosition,
              timestamp: Date.now()
            });
          }, Math.random() * 100 + 50);

          // Simulate periodic updates (every 5 seconds) with slight position variation
          const intervalId = setInterval(() => {
            if (watchCallbacks.has(watchId)) {
              // Add slight random variation to simulate GPS drift
              const variation = 0.00001;
              successCallback({
                coords: {
                  ...spoofedPosition.coords,
                  latitude: spoofedPosition.coords.latitude + (Math.random() - 0.5) * variation,
                  longitude: spoofedPosition.coords.longitude + (Math.random() - 0.5) * variation
                },
                timestamp: Date.now()
              });
            } else {
              clearInterval(intervalId);
            }
          }, 5000);
        }

        return watchId;
      };

      // Override clearWatch
      navigator.geolocation.clearWatch = function(watchId) {
        watchCallbacks.delete(watchId);
      };

      // Override permissions query for geolocation
      const originalPermissionsQuery = navigator.permissions.query;
      navigator.permissions.query = function(permissionDesc) {
        if (permissionDesc.name === 'geolocation') {
          return Promise.resolve({
            state: 'granted',
            onchange: null
          });
        }
        return originalPermissionsQuery.call(this, permissionDesc);
      };

      console.log('[Basset Hound] Geolocation spoofing active: ${latitude}, ${longitude}');
    })();
  `;
}

/**
 * Generate timezone spoofing script to match geolocation
 * @param {string} timezone - IANA timezone name (e.g., 'America/New_York')
 * @param {number} timezoneOffset - Timezone offset in minutes
 * @returns {string} Timezone spoofing script
 */
function getTimezoneSpoofScript(timezone = 'America/New_York', timezoneOffset = -300) {
  return `
    (function() {
      'use strict';

      // Override Date.prototype.getTimezoneOffset
      const targetOffset = ${timezoneOffset};

      Date.prototype.getTimezoneOffset = function() {
        return -targetOffset; // getTimezoneOffset returns negative of actual offset
      };

      // Override Intl.DateTimeFormat for timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locale, options) {
        const format = new originalDateTimeFormat(locale, options);
        const originalResolvedOptions = format.resolvedOptions.bind(format);
        format.resolvedOptions = function() {
          const resolved = originalResolvedOptions();
          resolved.timeZone = '${timezone}';
          return resolved;
        };
        return format;
      };
      Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
      Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;

      console.log('[Basset Hound] Timezone spoofing active: ${timezone}');
    })();
  `;
}

/**
 * Generate combined geolocation and timezone spoofing script
 * @param {Object} config - Configuration object
 * @param {Object} config.location - Location data
 * @param {string} config.timezone - Timezone name
 * @param {number} config.timezoneOffset - Timezone offset in minutes
 * @returns {string} Combined spoofing script
 */
function getFullLocationSpoofScript(config = {}) {
  const locationScript = getGeolocationSpoofScript(config.location);
  const timezoneScript = getTimezoneSpoofScript(config.timezone, config.timezoneOffset);

  return `
    ${locationScript}
    ${timezoneScript}
  `;
}

module.exports = {
  getRandomViewport,
  getRealisticUserAgent,
  getEvasionScript,
  getEvasionScriptWithConfig,
  getFingerprintConfig,
  getGeolocationSpoofScript,
  getTimezoneSpoofScript,
  getFullLocationSpoofScript,
  VIEWPORT_SIZES,
  USER_AGENTS,
  PLATFORMS,
  LANGUAGES,
  TIMEZONES,
  SCREEN_CONFIGS,
  WEBGL_RENDERERS,
  WEBGL_VENDORS,
};
