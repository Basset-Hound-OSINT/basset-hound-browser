/**
 * Fingerprint Injection Script Builder
 *
 * Builds the JavaScript code injected into a page to apply a fingerprint
 * profile. Extracted verbatim from FingerprintProfile#getInjectionScript so the
 * generated script is byte-for-byte identical.
 */

/**
 * Build the injection script for a given fingerprint config.
 *
 * @param {Object} config - The output of FingerprintProfile#getConfig()
 * @returns {string} JavaScript code to inject
 */
function buildInjectionScript(config) {
  return `
      (function() {
        'use strict';

        const config = ${JSON.stringify(config)};

        // Override navigator properties
        const navigatorProps = {
          userAgent: { value: config.userAgent },
          platform: { value: config.platform },
          languages: { value: Object.freeze(config.languages) },
          language: { value: config.languages[0] },
          hardwareConcurrency: { value: config.hardwareConcurrency },
          deviceMemory: { value: config.deviceMemory },
          doNotTrack: { value: config.doNotTrack },
          cookieEnabled: { value: config.cookieEnabled },
          pdfViewerEnabled: { value: config.pdfViewerEnabled },
          webdriver: { value: false },
          maxTouchPoints: { value: config.maxTouchPoints },
        };

        for (const [prop, descriptor] of Object.entries(navigatorProps)) {
          try {
            Object.defineProperty(navigator, prop, descriptor);
          } catch (e) {}
        }

        // Override screen properties
        const screenProps = {
          width: { value: config.screen.width },
          height: { value: config.screen.height },
          availWidth: { value: config.screen.availWidth },
          availHeight: { value: config.screen.availHeight },
          colorDepth: { value: config.screen.colorDepth },
          pixelDepth: { value: config.screen.pixelDepth },
        };

        for (const [prop, descriptor] of Object.entries(screenProps)) {
          try {
            Object.defineProperty(screen, prop, descriptor);
          } catch (e) {}
        }

        // Override devicePixelRatio
        Object.defineProperty(window, 'devicePixelRatio', {
          value: config.screen.devicePixelRatio,
        });

        // Override timezone
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locale, options) {
          if (!options) options = {};
          if (!options.timeZone) options.timeZone = config.timezoneName;
          return new originalDateTimeFormat(locale, options);
        };
        Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {
          return config.timezoneOffset;
        };

        // ==========================================
        // ADVANCED WEBGL NOISE INJECTION
        // ==========================================
        const webglConfig = config.evasion.webgl.config;

        // WebGL parameter noise for numeric values
        function addWebGLNoise(value, noise) {
          if (typeof value !== 'number' || !webglConfig.enabled) return value;
          const variation = value * noise * (Math.random() - 0.5);
          return Math.round(value + variation);
        }

        // Override WebGL getParameter with noise injection
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          // Vendor and renderer strings
          if (param === 37445) return config.webgl.vendor;
          if (param === 37446) return config.webgl.renderer;

          const result = originalGetParameter.call(this, param);

          // Apply noise to numeric WebGL parameters
          if (webglConfig.enabled && webglConfig.parameterNoise > 0) {
            // MAX_TEXTURE_SIZE, MAX_RENDERBUFFER_SIZE, etc.
            if ([3379, 34024, 3386, 36347, 36348, 35661].includes(param)) {
              return addWebGLNoise(result, webglConfig.parameterNoise);
            }
          }

          return result;
        };

        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return config.webgl.vendor;
          if (param === 37446) return config.webgl.renderer;

          const result = originalGetParameter2.call(this, param);

          if (webglConfig.enabled && webglConfig.parameterNoise > 0) {
            if ([3379, 34024, 3386, 36347, 36348, 35661].includes(param)) {
              return addWebGLNoise(result, webglConfig.parameterNoise);
            }
          }

          return result;
        };

        // Randomize WebGL extensions if enabled
        if (webglConfig.enabled && webglConfig.randomizeExtensions) {
          const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
          WebGLRenderingContext.prototype.getSupportedExtensions = function() {
            const extensions = originalGetSupportedExtensions.call(this);
            if (!extensions) return extensions;
            // Randomly filter out some extensions
            return extensions.filter(() => Math.random() > webglConfig.extensionRemovalChance);
          };

          const originalGetSupportedExtensions2 = WebGL2RenderingContext.prototype.getSupportedExtensions;
          WebGL2RenderingContext.prototype.getSupportedExtensions = function() {
            const extensions = originalGetSupportedExtensions2.call(this);
            if (!extensions) return extensions;
            return extensions.filter(() => Math.random() > webglConfig.extensionRemovalChance);
          };
        }

        // Override shader precision if enabled
        if (webglConfig.enabled && webglConfig.precisionNoise) {
          const originalGetShaderPrecisionFormat = WebGLRenderingContext.prototype.getShaderPrecisionFormat;
          WebGLRenderingContext.prototype.getShaderPrecisionFormat = function(shaderType, precisionType) {
            const result = originalGetShaderPrecisionFormat.call(this, shaderType, precisionType);
            if (result && Math.random() < 0.1) {
              // Occasionally vary the precision slightly
              return {
                rangeMin: result.rangeMin,
                rangeMax: result.rangeMax,
                precision: Math.max(0, result.precision - Math.floor(Math.random() * 2)),
              };
            }
            return result;
          };
        }

        // ==========================================
        // ADVANCED CANVAS NOISE INJECTION
        // ==========================================
        const canvasConfig = config.evasion.canvas.config;

        if (canvasConfig.enabled) {
          // Enhanced toDataURL with configurable noise
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              try {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                const data = imageData.data;
                const channels = canvasConfig.affectedChannels || ['r', 'g', 'b'];
                const intensity = canvasConfig.intensity || 0.0001;
                const maxShift = canvasConfig.maxPixelShift || 1;

                for (let i = 0; i < data.length; i += 4) {
                  const noise = () => Math.floor((Math.random() - 0.5) * maxShift * 2);

                  if (channels.includes('r')) {
                    data[i] = Math.max(0, Math.min(255, data[i] + noise()));
                  }
                  if (channels.includes('g')) {
                    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
                  }
                  if (channels.includes('b')) {
                    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
                  }
                  if (channels.includes('a')) {
                    data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise()));
                  }
                }
                ctx.putImageData(imageData, 0, 0);
              } catch (e) {
                // Canvas may be tainted, skip noise injection
              }
            }
            return originalToDataURL.call(this, type, quality);
          };

          // Also override toBlob for completeness
          const originalToBlob = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              try {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                const data = imageData.data;
                const channels = canvasConfig.affectedChannels || ['r', 'g', 'b'];
                const maxShift = canvasConfig.maxPixelShift || 1;

                for (let i = 0; i < data.length; i += 4) {
                  const noise = () => Math.floor((Math.random() - 0.5) * maxShift * 2);
                  if (channels.includes('r')) data[i] = Math.max(0, Math.min(255, data[i] + noise()));
                  if (channels.includes('g')) data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
                  if (channels.includes('b')) data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
                  if (channels.includes('a')) data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise()));
                }
                ctx.putImageData(imageData, 0, 0);
              } catch (e) {}
            }
            return originalToBlob.call(this, callback, type, quality);
          };

          // Override getImageData to add noise on read as well
          const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
            const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
            const data = imageData.data;
            const channels = canvasConfig.affectedChannels || ['r', 'g', 'b'];
            const maxShift = canvasConfig.maxPixelShift || 1;

            for (let i = 0; i < data.length; i += 4) {
              const noise = () => Math.floor((Math.random() - 0.5) * maxShift * 2);
              if (channels.includes('r')) data[i] = Math.max(0, Math.min(255, data[i] + noise()));
              if (channels.includes('g')) data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
              if (channels.includes('b')) data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
              if (channels.includes('a')) data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise()));
            }
            return imageData;
          };
        }

        // ==========================================
        // ADVANCED AUDIO FINGERPRINT NOISE
        // ==========================================
        const audioConfig = config.evasion.audio.config;

        if (audioConfig.enabled) {
          // Override AudioBuffer.getChannelData with configurable noise
          const originalGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function(channel) {
            const result = originalGetChannelData.call(this, channel);
            const intensity = audioConfig.intensity || 0.00001;

            for (let i = 0; i < result.length; i++) {
              // White noise or pink noise based on config
              if (audioConfig.noiseType === 'pink') {
                // Pink noise has more low frequency content (1/f distribution)
                const pink = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
                result[i] += pink * intensity;
              } else {
                // White noise (uniform distribution)
                result[i] += (Math.random() - 0.5) * intensity * 2;
              }
            }
            return result;
          };

          // Override AnalyserNode.getFloatFrequencyData
          if (audioConfig.affectOscillator && typeof AnalyserNode !== 'undefined') {
            const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
            AnalyserNode.prototype.getFloatFrequencyData = function(array) {
              originalGetFloatFrequencyData.call(this, array);
              const intensity = audioConfig.intensity || 0.00001;
              for (let i = 0; i < array.length; i++) {
                array[i] += (Math.random() - 0.5) * intensity * 100;
              }
            };

            const originalGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
            AnalyserNode.prototype.getByteFrequencyData = function(array) {
              originalGetByteFrequencyData.call(this, array);
              const intensity = audioConfig.intensity || 0.00001;
              for (let i = 0; i < array.length; i++) {
                array[i] = Math.max(0, Math.min(255, array[i] + Math.floor((Math.random() - 0.5) * intensity * 1000)));
              }
            };
          }

          // Override OscillatorNode frequency if enabled
          if (audioConfig.affectOscillator && typeof OscillatorNode !== 'undefined') {
            const originalOscillatorStart = OscillatorNode.prototype.start;
            OscillatorNode.prototype.start = function(when) {
              // Add tiny frequency variation
              if (this.frequency && this.frequency.value) {
                const variation = this.frequency.value * audioConfig.intensity;
                this.frequency.value += (Math.random() - 0.5) * variation;
              }
              return originalOscillatorStart.call(this, when);
            };
          }
        }

        // ==========================================
        // FONT ENUMERATION EVASION
        // ==========================================
        // Override fonts property if available
        if (config.fonts && config.fonts.length > 0) {
          // The fonts are already randomized in the profile generation
          // This just ensures the font list is properly exposed
          try {
            if (document.fonts && document.fonts.check) {
              const originalCheck = document.fonts.check.bind(document.fonts);
              document.fonts.check = function(font, text) {
                // Only report fonts in our configured list
                const fontFamily = font.split(' ').pop().replace(/['"]/g, '');
                if (config.fonts.includes(fontFamily)) {
                  return originalCheck(font, text);
                }
                // For fonts not in our list, randomly return false to vary fingerprint
                return Math.random() > 0.8 ? originalCheck(font, text) : false;
              };
            }
          } catch (e) {}
        }

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: function() {
            const plugins = config.plugins.map(p => ({
              name: p.name,
              filename: p.filename,
              description: p.description,
              length: 1,
              item: () => null,
              namedItem: () => null,
            }));
            plugins.item = (i) => plugins[i];
            plugins.namedItem = (name) => plugins.find(p => p.name === name);
            plugins.refresh = () => {};
            return plugins;
          }
        });

        console.log('[Fingerprint] Advanced profile applied:', config.platformType, config.timezone,
          'Canvas:', config.evasion.canvas.level,
          'WebGL:', config.evasion.webgl.level,
          'Audio:', config.evasion.audio.level,
          'Fonts:', config.evasion.fonts.level);
      })();
    `;
}

module.exports = { buildInjectionScript };
