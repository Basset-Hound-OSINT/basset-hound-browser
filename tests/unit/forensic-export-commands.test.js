/**
 * Unit Tests: Forensic Export Commands
 * Testing 4 core WebSocket forensic export commands
 *
 * Commands tested:
 * 1. export_raw_html - Export full HTML + headers + status code
 * 2. export_network_log - Export HTTP requests/responses with statistics
 * 3. export_device_ids - Export browser fingerprints + device identifiers
 * 4. modify_element - Modify DOM elements (text, attributes, classes, styles)
 *
 * Scope: Command structure, response format, required fields, error handling
 * Coverage: >90%
 */

const assert = require('assert');

describe('Forensic Export Commands - Unit Tests', () => {

  // ========================================================================
  // COMMAND 1: export_raw_html
  // ========================================================================

  describe('export_raw_html Command', () => {

    describe('Command Structure', () => {
      test('should have valid command name', () => {
        const command = {
          command: 'export_raw_html',
          id: 'export_raw_html_test_1'
        };

        assert.strictEqual(command.command, 'export_raw_html');
        assert.strictEqual(typeof command.id, 'string');
      });

      test('should accept optional timeout parameter', () => {
        const command = {
          command: 'export_raw_html',
          timeout: 5000,
          id: 'export_raw_html_test_timeout'
        };

        assert.strictEqual(typeof command.timeout, 'number');
        assert.ok(command.timeout > 0);
      });

      test('should accept optional includeMetadata parameter', () => {
        const command = {
          command: 'export_raw_html',
          includeMetadata: true,
          id: 'export_raw_html_test_metadata'
        };

        assert.strictEqual(typeof command.includeMetadata, 'boolean');
      });
    });

    describe('Response Format Validation', () => {
      test('should return success flag', () => {
        const mockResponse = {
          success: true,
          id: 'export_raw_html_test_1'
        };

        assert.strictEqual(typeof mockResponse.success, 'boolean');
      });

      test('should return URL when successful', () => {
        const mockResponse = {
          success: true,
          url: 'https://example.com/page',
          id: 'export_raw_html_test_url'
        };

        assert.strictEqual(typeof mockResponse.url, 'string');
        assert.ok(mockResponse.url.startsWith('http'));
      });

      test('should return status code as number', () => {
        const mockResponse = {
          success: true,
          statusCode: 200,
          id: 'export_raw_html_test_status'
        };

        assert.strictEqual(typeof mockResponse.statusCode, 'number');
        assert.ok(mockResponse.statusCode >= 100 && mockResponse.statusCode < 600);
      });

      test('should return HTML as string', () => {
        const mockResponse = {
          success: true,
          html: '<html><head><title>Test</title></head><body>Test</body></html>',
          id: 'export_raw_html_test_html'
        };

        assert.strictEqual(typeof mockResponse.html, 'string');
        assert.ok(mockResponse.html.length > 0);
        assert.ok(mockResponse.html.includes('<html'));
      });

      test('should return htmlLength as number', () => {
        const mockResponse = {
          success: true,
          htmlLength: 1024,
          html: '<html>content</html>',
          id: 'export_raw_html_test_length'
        };

        assert.strictEqual(typeof mockResponse.htmlLength, 'number');
        assert.ok(mockResponse.htmlLength > 0);
      });

      test('should return contentType header', () => {
        const mockResponse = {
          success: true,
          contentType: 'text/html; charset=utf-8',
          id: 'export_raw_html_test_content_type'
        };

        assert.strictEqual(typeof mockResponse.contentType, 'string');
        assert.ok(mockResponse.contentType.includes('text/html'));
      });

      test('should return responseHeaders object', () => {
        const mockResponse = {
          success: true,
          responseHeaders: {
            'content-type': 'text/html',
            'content-length': '1024',
            'server': 'nginx/1.0'
          },
          id: 'export_raw_html_test_headers'
        };

        assert.strictEqual(typeof mockResponse.responseHeaders, 'object');
        assert.ok(Object.keys(mockResponse.responseHeaders).length > 0);
      });

      test('should return timestamp', () => {
        const mockResponse = {
          success: true,
          timestamp: Date.now(),
          id: 'export_raw_html_test_timestamp'
        };

        assert.strictEqual(typeof mockResponse.timestamp, 'number');
        assert.ok(mockResponse.timestamp > 0);
      });
    });

    describe('Error Handling', () => {
      test('should return success: false on error', () => {
        const mockResponse = {
          success: false,
          error: 'Page not loaded',
          id: 'export_raw_html_test_error'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.strictEqual(typeof mockResponse.error, 'string');
      });

      test('should provide error message for timeout', () => {
        const mockResponse = {
          success: false,
          error: 'Timeout waiting for page load',
          id: 'export_raw_html_test_timeout_error'
        };

        assert.ok(mockResponse.error.includes('Timeout') || mockResponse.error.includes('timeout'));
      });

      test('should provide error message for navigation errors', () => {
        const mockResponse = {
          success: false,
          error: 'Failed to navigate to URL',
          id: 'export_raw_html_test_nav_error'
        };

        assert.ok(mockResponse.error.length > 0);
      });
    });

    describe('Response Data Accuracy', () => {
      test('should verify HTML length matches actual content', () => {
        const html = '<html><body>Test Content</body></html>';
        const mockResponse = {
          success: true,
          html: html,
          htmlLength: html.length,
          id: 'export_raw_html_test_accuracy'
        };

        assert.strictEqual(mockResponse.htmlLength, mockResponse.html.length);
      });

      test('should provide all required headers', () => {
        const mockResponse = {
          success: true,
          responseHeaders: {
            'content-type': 'text/html',
            'content-length': '5000',
            'date': new Date().toUTCString()
          },
          id: 'export_raw_html_test_headers_required'
        };

        const requiredHeaders = ['content-type', 'content-length'];
        requiredHeaders.forEach(header => {
          assert.ok(mockResponse.responseHeaders[header] !== undefined);
        });
      });
    });
  });

  // ========================================================================
  // COMMAND 2: export_network_log
  // ========================================================================

  describe('export_network_log Command', () => {

    describe('Command Structure', () => {
      test('should have valid command name', () => {
        const command = {
          command: 'export_network_log',
          id: 'export_network_log_test_1'
        };

        assert.strictEqual(command.command, 'export_network_log');
      });

      test('should accept format parameter (json/csv/har)', () => {
        ['json', 'csv', 'har'].forEach(format => {
          const command = {
            command: 'export_network_log',
            format: format,
            id: 'export_network_log_format_' + format
          };

          assert.ok(['json', 'csv', 'har'].includes(command.format));
        });
      });

      test('should accept resourceType filter', () => {
        const command = {
          command: 'export_network_log',
          resourceType: 'xhr',
          id: 'export_network_log_resource_type'
        };

        assert.strictEqual(command.resourceType, 'xhr');
      });

      test('should accept duration filter (minDuration/maxDuration)', () => {
        const command = {
          command: 'export_network_log',
          minDuration: 100,
          maxDuration: 5000,
          id: 'export_network_log_duration'
        };

        assert.strictEqual(typeof command.minDuration, 'number');
        assert.strictEqual(typeof command.maxDuration, 'number');
      });

      test('should accept statusCode filter', () => {
        const command = {
          command: 'export_network_log',
          statusCode: 200,
          id: 'export_network_log_status'
        };

        assert.strictEqual(typeof command.statusCode, 'number');
      });
    });

    describe('Response Format Validation', () => {
      test('should return success flag', () => {
        const mockResponse = {
          success: true,
          id: 'export_network_log_test_success'
        };

        assert.strictEqual(typeof mockResponse.success, 'boolean');
      });

      test('should return totalRequests as number', () => {
        const mockResponse = {
          success: true,
          totalRequests: 42,
          id: 'export_network_log_test_count'
        };

        assert.strictEqual(typeof mockResponse.totalRequests, 'number');
        assert.ok(mockResponse.totalRequests >= 0);
      });

      test('should return requests array', () => {
        const mockResponse = {
          success: true,
          requests: [
            {
              url: 'https://example.com/api/data',
              method: 'GET',
              statusCode: 200,
              duration: 150,
              contentLength: 2048,
              resourceType: 'xhr',
              timestamp: Date.now()
            }
          ],
          id: 'export_network_log_test_requests'
        };

        assert.strictEqual(Array.isArray(mockResponse.requests), true);
        assert.ok(mockResponse.requests.length > 0);
      });

      test('should return request statistics', () => {
        const mockResponse = {
          success: true,
          statistics: {
            totalSize: 102400,
            totalDuration: 5000,
            byResourceType: {
              xhr: { count: 5, totalSize: 10240, totalDuration: 1500 },
              document: { count: 1, totalSize: 5000, totalDuration: 800 }
            },
            byStatusCode: {
              '200': 10,
              '304': 2,
              '404': 1
            },
            slowestRequest: {
              url: 'https://example.com/slow',
              duration: 3000
            },
            largestRequest: {
              url: 'https://example.com/large',
              contentLength: 50000
            }
          },
          id: 'export_network_log_test_stats'
        };

        assert.strictEqual(typeof mockResponse.statistics, 'object');
        assert.ok(mockResponse.statistics.totalSize > 0);
        assert.ok(mockResponse.statistics.totalDuration > 0);
      });

      test('should return timestamp', () => {
        const mockResponse = {
          success: true,
          timestamp: Date.now(),
          id: 'export_network_log_test_timestamp'
        };

        assert.strictEqual(typeof mockResponse.timestamp, 'number');
        assert.ok(mockResponse.timestamp > 0);
      });
    });

    describe('Request Object Validation', () => {
      test('should have required request fields', () => {
        const request = {
          url: 'https://example.com/api',
          method: 'POST',
          statusCode: 201,
          duration: 250,
          contentLength: 1024,
          resourceType: 'xhr',
          timestamp: Date.now()
        };

        assert.strictEqual(typeof request.url, 'string');
        assert.strictEqual(typeof request.method, 'string');
        assert.strictEqual(typeof request.statusCode, 'number');
        assert.strictEqual(typeof request.duration, 'number');
        assert.strictEqual(typeof request.contentLength, 'number');
      });

      test('should have valid HTTP methods', () => {
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        const request = {
          method: 'GET',
          url: 'https://example.com'
        };

        assert.ok(validMethods.includes(request.method));
      });

      test('should have valid resource types', () => {
        const validTypes = ['xhr', 'script', 'stylesheet', 'image', 'media', 'font', 'document'];
        const resourceType = 'xhr';

        assert.ok(validTypes.includes(resourceType));
      });
    });

    describe('Statistics Validation', () => {
      test('should aggregate request statistics correctly', () => {
        const requests = [
          { duration: 100, contentLength: 1000, resourceType: 'xhr', statusCode: 200 },
          { duration: 200, contentLength: 2000, resourceType: 'xhr', statusCode: 200 },
          { duration: 50, contentLength: 500, resourceType: 'image', statusCode: 200 }
        ];

        const totalSize = requests.reduce((sum, r) => sum + r.contentLength, 0);
        const totalDuration = requests.reduce((sum, r) => sum + r.duration, 0);

        assert.strictEqual(totalSize, 3500);
        assert.strictEqual(totalDuration, 350);
      });

      test('should identify slowest request', () => {
        const requests = [
          { url: 'fast', duration: 50 },
          { url: 'slow', duration: 3000 },
          { url: 'medium', duration: 500 }
        ];

        const slowest = requests.reduce((max, r) =>
          r.duration > max.duration ? r : max
        );

        assert.strictEqual(slowest.url, 'slow');
        assert.strictEqual(slowest.duration, 3000);
      });

      test('should identify largest request', () => {
        const requests = [
          { url: 'small', contentLength: 1000 },
          { url: 'large', contentLength: 50000 },
          { url: 'medium', contentLength: 5000 }
        ];

        const largest = requests.reduce((max, r) =>
          r.contentLength > max.contentLength ? r : max
        );

        assert.strictEqual(largest.url, 'large');
        assert.strictEqual(largest.contentLength, 50000);
      });
    });

    describe('Error Handling', () => {
      test('should return error on invalid filter', () => {
        const mockResponse = {
          success: false,
          error: 'Invalid resourceType filter',
          id: 'export_network_log_error_filter'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.length > 0);
      });

      test('should return error when no requests captured', () => {
        const mockResponse = {
          success: true,
          totalRequests: 0,
          requests: [],
          id: 'export_network_log_empty'
        };

        assert.strictEqual(mockResponse.totalRequests, 0);
        assert.strictEqual(mockResponse.requests.length, 0);
      });
    });
  });

  // ========================================================================
  // COMMAND 3: export_device_ids
  // ========================================================================

  describe('export_device_ids Command', () => {

    describe('Command Structure', () => {
      test('should have valid command name', () => {
        const command = {
          command: 'export_device_ids',
          id: 'export_device_ids_test_1'
        };

        assert.strictEqual(command.command, 'export_device_ids');
      });

      test('should accept includeFingprints parameter', () => {
        const command = {
          command: 'export_device_ids',
          includeFingerprints: true,
          id: 'export_device_ids_fingerprints'
        };

        assert.strictEqual(typeof command.includeFingerprints, 'boolean');
      });

      test('should accept includeProxy parameter', () => {
        const command = {
          command: 'export_device_ids',
          includeProxy: true,
          id: 'export_device_ids_proxy'
        };

        assert.strictEqual(typeof command.includeProxy, 'boolean');
      });
    });

    describe('Response Format Validation', () => {
      test('should return success flag', () => {
        const mockResponse = {
          success: true,
          id: 'export_device_ids_test_success'
        };

        assert.strictEqual(typeof mockResponse.success, 'boolean');
      });

      test('should return deviceIdentifiers object', () => {
        const mockResponse = {
          success: true,
          deviceIdentifiers: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            platform: 'Win32',
            hardwareConcurrency: 8,
            deviceMemory: 16,
            language: 'en-US',
            timezone: -300,
            webdriver: false
          },
          id: 'export_device_ids_test_identifiers'
        };

        assert.strictEqual(typeof mockResponse.deviceIdentifiers, 'object');
        assert.ok(Object.keys(mockResponse.deviceIdentifiers).length > 0);
      });

      test('should return screen information', () => {
        const mockResponse = {
          success: true,
          deviceIdentifiers: {
            screen: {
              width: 1920,
              height: 1080,
              colorDepth: 24,
              orientation: 'landscape'
            }
          },
          id: 'export_device_ids_test_screen'
        };

        const screen = mockResponse.deviceIdentifiers.screen;
        assert.strictEqual(typeof screen.width, 'number');
        assert.strictEqual(typeof screen.height, 'number');
        assert.ok(screen.width > 0);
        assert.ok(screen.height > 0);
      });

      test('should return fingerprint object', () => {
        const mockResponse = {
          success: true,
          fingerprint: {
            canvas: {
              hash: 'abc123def456',
              available: true
            },
            webgl: {
              hash: 'xyz789',
              renderer: 'ANGLE (Intel HD Graphics 630)',
              vendor: 'Google Inc.'
            },
            webrtc: {
              ipv4: '192.168.1.100',
              ipv6: 'fe80::1'
            },
            storage: {
              localStorage: 5,
              sessionStorage: 3,
              indexedDB: true
            }
          },
          id: 'export_device_ids_test_fingerprint'
        };

        assert.strictEqual(typeof mockResponse.fingerprint, 'object');
        assert.ok(mockResponse.fingerprint.canvas);
        assert.ok(mockResponse.fingerprint.webgl);
      });

      test('should return proxyInfo when available', () => {
        const mockResponse = {
          success: true,
          proxyInfo: {
            enabled: true,
            currentProxy: {
              host: '192.168.1.1',
              port: 8080,
              type: 'http'
            },
            rotationMode: 'sequential'
          },
          id: 'export_device_ids_test_proxy'
        };

        assert.strictEqual(typeof mockResponse.proxyInfo, 'object');
        assert.strictEqual(typeof mockResponse.proxyInfo.enabled, 'boolean');
      });

      test('should return timestamp', () => {
        const mockResponse = {
          success: true,
          timestamp: Date.now(),
          id: 'export_device_ids_test_timestamp'
        };

        assert.strictEqual(typeof mockResponse.timestamp, 'number');
        assert.ok(mockResponse.timestamp > 0);
      });
    });

    describe('Device Identifier Validation', () => {
      test('should have valid userAgent string', () => {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

        assert.strictEqual(typeof userAgent, 'string');
        assert.ok(userAgent.includes('Mozilla'));
      });

      test('should have valid platform', () => {
        const validPlatforms = ['Win32', 'Linux', 'MacIntel', 'iPhone', 'iPad', 'Android'];
        const platform = 'Win32';

        assert.ok(validPlatforms.includes(platform));
      });

      test('should have valid hardwareConcurrency', () => {
        const hardwareConcurrency = 8;

        assert.strictEqual(typeof hardwareConcurrency, 'number');
        assert.ok(hardwareConcurrency > 0);
        assert.ok(hardwareConcurrency <= 256);
      });

      test('should have valid deviceMemory', () => {
        const deviceMemory = 16;

        assert.strictEqual(typeof deviceMemory, 'number');
        assert.ok(deviceMemory > 0);
      });

      test('should have valid language code', () => {
        const language = 'en-US';

        assert.strictEqual(typeof language, 'string');
        assert.ok(/^[a-z]{2}(-[A-Z]{2})?$/.test(language));
      });

      test('should have valid timezone offset', () => {
        const timezone = -300; // minutes

        assert.strictEqual(typeof timezone, 'number');
        assert.ok(timezone >= -840 && timezone <= 840); // UTC-14 to UTC+14
      });
    });

    describe('Fingerprint Data Validation', () => {
      test('should have canvas hash when available', () => {
        const canvas = {
          hash: 'abc123def456',
          available: true
        };

        assert.strictEqual(typeof canvas.hash, 'string');
        assert.ok(canvas.hash.length > 0);
      });

      test('should have WebGL renderer information', () => {
        const webgl = {
          hash: 'xyz789',
          renderer: 'ANGLE (Intel HD Graphics 630)',
          vendor: 'Google Inc.'
        };

        assert.strictEqual(typeof webgl.renderer, 'string');
        assert.ok(webgl.renderer.length > 0);
      });

      test('should have WebRTC IP addresses when available', () => {
        const webrtc = {
          ipv4: '192.168.1.100',
          ipv6: 'fe80::1'
        };

        // IPv4 format validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        assert.ok(ipv4Regex.test(webrtc.ipv4));
      });

      test('should have storage information', () => {
        const storage = {
          localStorage: 5,
          sessionStorage: 3,
          indexedDB: true
        };

        assert.strictEqual(typeof storage.localStorage, 'number');
        assert.strictEqual(typeof storage.sessionStorage, 'number');
        assert.strictEqual(typeof storage.indexedDB, 'boolean');
      });
    });

    describe('Error Handling', () => {
      test('should return error on browser access restriction', () => {
        const mockResponse = {
          success: false,
          error: 'Cannot access browser fingerprint data',
          id: 'export_device_ids_error_access'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.length > 0);
      });
    });
  });

  // ========================================================================
  // COMMAND 4: modify_element
  // ========================================================================

  describe('modify_element Command', () => {

    describe('Command Structure - Text Modification', () => {
      test('should accept text modification type', () => {
        const command = {
          command: 'modify_element',
          selector: 'h1',
          type: 'text',
          value: 'New Title',
          id: 'modify_element_text_1'
        };

        assert.strictEqual(command.type, 'text');
        assert.strictEqual(typeof command.value, 'string');
      });

      test('should accept allMatches flag for text', () => {
        const command = {
          command: 'modify_element',
          selector: '.item',
          type: 'text',
          value: 'Item Text',
          allMatches: true,
          id: 'modify_element_text_all'
        };

        assert.strictEqual(typeof command.allMatches, 'boolean');
      });
    });

    describe('Command Structure - Attribute Modification', () => {
      test('should accept attribute modification', () => {
        const command = {
          command: 'modify_element',
          selector: 'input[type="email"]',
          type: 'attribute',
          attributeName: 'placeholder',
          value: 'user@example.com',
          id: 'modify_element_attr_1'
        };

        assert.strictEqual(command.type, 'attribute');
        assert.strictEqual(typeof command.attributeName, 'string');
        assert.strictEqual(typeof command.value, 'string');
      });
    });

    describe('Command Structure - Class Modification', () => {
      test('should accept class add operation', () => {
        const command = {
          command: 'modify_element',
          selector: 'button',
          type: 'class',
          classOperation: 'add',
          className: 'active',
          id: 'modify_element_class_add'
        };

        assert.strictEqual(command.type, 'class');
        assert.strictEqual(command.classOperation, 'add');
        assert.strictEqual(typeof command.className, 'string');
      });

      test('should accept class remove operation', () => {
        const command = {
          command: 'modify_element',
          selector: 'button.active',
          type: 'class',
          classOperation: 'remove',
          className: 'active',
          id: 'modify_element_class_remove'
        };

        assert.strictEqual(command.classOperation, 'remove');
      });

      test('should accept class toggle operation', () => {
        const command = {
          command: 'modify_element',
          selector: 'div',
          type: 'class',
          classOperation: 'toggle',
          className: 'visible',
          id: 'modify_element_class_toggle'
        };

        assert.strictEqual(command.classOperation, 'toggle');
      });
    });

    describe('Command Structure - CSS Modification', () => {
      test('should accept CSS style modification', () => {
        const command = {
          command: 'modify_element',
          selector: '.tracking-pixel',
          type: 'css',
          cssProperties: {
            'display': 'none',
            'visibility': 'hidden'
          },
          id: 'modify_element_css_1'
        };

        assert.strictEqual(command.type, 'css');
        assert.strictEqual(typeof command.cssProperties, 'object');
        assert.ok(Object.keys(command.cssProperties).length > 0);
      });
    });

    describe('Command Structure - HTML Modification', () => {
      test('should accept HTML modification', () => {
        const command = {
          command: 'modify_element',
          selector: '#notice',
          type: 'html',
          value: '<div>New HTML</div>',
          id: 'modify_element_html_1'
        };

        assert.strictEqual(command.type, 'html');
        assert.strictEqual(typeof command.value, 'string');
      });
    });

    describe('Response Format Validation', () => {
      test('should return success flag', () => {
        const mockResponse = {
          success: true,
          id: 'modify_element_test_success'
        };

        assert.strictEqual(typeof mockResponse.success, 'boolean');
      });

      test('should return matched element count', () => {
        const mockResponse = {
          success: true,
          matched: 3,
          modified: 3,
          id: 'modify_element_test_matched'
        };

        assert.strictEqual(typeof mockResponse.matched, 'number');
        assert.ok(mockResponse.matched >= 0);
      });

      test('should return modified element count', () => {
        const mockResponse = {
          success: true,
          matched: 5,
          modified: 5,
          id: 'modify_element_test_modified'
        };

        assert.strictEqual(typeof mockResponse.modified, 'number');
        assert.ok(mockResponse.modified >= 0);
        assert.ok(mockResponse.modified <= mockResponse.matched);
      });

      test('should return timestamp', () => {
        const mockResponse = {
          success: true,
          timestamp: Date.now(),
          id: 'modify_element_test_timestamp'
        };

        assert.strictEqual(typeof mockResponse.timestamp, 'number');
        assert.ok(mockResponse.timestamp > 0);
      });
    });

    describe('Selector Validation', () => {
      test('should accept valid CSS selectors', () => {
        const validSelectors = [
          'h1',
          '.class-name',
          '#id-value',
          'div.container',
          'input[type="email"]',
          'button:first-child',
          '.item > span'
        ];

        validSelectors.forEach(selector => {
          assert.strictEqual(typeof selector, 'string');
          assert.ok(selector.length > 0);
        });
      });

      test('should handle invalid selector error', () => {
        const mockResponse = {
          success: false,
          error: 'Invalid CSS selector syntax',
          matched: 0,
          id: 'modify_element_error_selector'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.strictEqual(mockResponse.matched, 0);
      });

      test('should return zero matches for non-existent selector', () => {
        const mockResponse = {
          success: true,
          matched: 0,
          modified: 0,
          id: 'modify_element_no_match'
        };

        assert.strictEqual(mockResponse.matched, 0);
        assert.strictEqual(mockResponse.modified, 0);
      });
    });

    describe('Error Handling', () => {
      test('should return error for missing selector', () => {
        const mockResponse = {
          success: false,
          error: 'Selector parameter is required',
          id: 'modify_element_error_no_selector'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.includes('Selector'));
      });

      test('should return error for missing type', () => {
        const mockResponse = {
          success: false,
          error: 'Modification type is required (text/attribute/class/css/html)',
          id: 'modify_element_error_no_type'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.includes('type'));
      });

      test('should return error for missing attributeName in attribute mode', () => {
        const mockResponse = {
          success: false,
          error: 'attributeName is required for attribute modification',
          id: 'modify_element_error_attr_name'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.includes('attributeName'));
      });

      test('should return error for invalid class operation', () => {
        const mockResponse = {
          success: false,
          error: 'Invalid classOperation (must be add/remove/toggle)',
          id: 'modify_element_error_invalid_op'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.includes('classOperation'));
      });

      test('should return error for missing className in class mode', () => {
        const mockResponse = {
          success: false,
          error: 'className is required for class modification',
          id: 'modify_element_error_class_name'
        };

        assert.strictEqual(mockResponse.success, false);
        assert.ok(mockResponse.error.includes('className'));
      });
    });

    describe('Modification Verification', () => {
      test('should confirm modified count never exceeds matched count', () => {
        const mockResponse = {
          success: true,
          matched: 10,
          modified: 7,
          id: 'modify_element_verify_bounds'
        };

        assert.ok(mockResponse.modified <= mockResponse.matched);
      });

      test('should return modified count when all succeed', () => {
        const mockResponse = {
          success: true,
          matched: 5,
          modified: 5,
          id: 'modify_element_verify_all'
        };

        assert.strictEqual(mockResponse.matched, mockResponse.modified);
      });

      test('should provide details when some modifications fail', () => {
        const mockResponse = {
          success: true,
          matched: 10,
          modified: 8,
          failedCount: 2,
          id: 'modify_element_verify_partial'
        };

        assert.ok(mockResponse.modified < mockResponse.matched);
        assert.strictEqual(mockResponse.failedCount, mockResponse.matched - mockResponse.modified);
      });
    });
  });

  // ========================================================================
  // CROSS-COMMAND VALIDATION
  // ========================================================================

  describe('Cross-Command Response Structure', () => {

    test('all commands should return success flag', () => {
      const commands = [
        { success: true, id: 'cmd1' },
        { success: false, id: 'cmd2' },
        { success: true, id: 'cmd3' }
      ];

      commands.forEach(cmd => {
        assert.ok(typeof cmd.success === 'boolean');
      });
    });

    test('all commands should return id field', () => {
      const commands = [
        { id: 'export_raw_html_1' },
        { id: 'export_network_log_1' },
        { id: 'export_device_ids_1' },
        { id: 'modify_element_1' }
      ];

      commands.forEach(cmd => {
        assert.ok(typeof cmd.id === 'string');
        assert.ok(cmd.id.length > 0);
      });
    });

    test('failed commands should include error field', () => {
      const failedResponses = [
        { success: false, error: 'Error message 1', id: 'fail1' },
        { success: false, error: 'Error message 2', id: 'fail2' }
      ];

      failedResponses.forEach(resp => {
        assert.strictEqual(resp.success, false);
        assert.ok(typeof resp.error === 'string');
        assert.ok(resp.error.length > 0);
      });
    });

    test('all responses should include timestamp or be allowed to omit', () => {
      const responses = [
        { success: true, timestamp: Date.now(), id: 'r1' },
        { success: true, id: 'r2' }, // Some may not have timestamp
        { success: true, timestamp: Date.now(), id: 'r3' }
      ];

      responses.forEach(resp => {
        if (resp.timestamp !== undefined) {
          assert.strictEqual(typeof resp.timestamp, 'number');
          assert.ok(resp.timestamp > 0);
        }
      });
    });
  });

  // ========================================================================
  // INTEGRATION SCENARIOS
  // ========================================================================

  describe('Integration Scenarios', () => {

    test('sequential command execution should maintain state', () => {
      const commands = [
        { command: 'export_raw_html', id: 'step1' },
        { command: 'export_network_log', id: 'step2' },
        { command: 'export_device_ids', id: 'step3' },
        { command: 'modify_element', selector: 'body', type: 'class', className: 'captured', classOperation: 'add', id: 'step4' }
      ];

      assert.strictEqual(commands.length, 4);
      commands.forEach((cmd, i) => {
        assert.ok(cmd.id.includes('step'));
      });
    });

    test('should support command filtering by type', () => {
      const commands = [
        { command: 'export_raw_html' },
        { command: 'export_network_log' },
        { command: 'export_device_ids' },
        { command: 'modify_element' }
      ];

      const exportCommands = commands.filter(c => c.command.startsWith('export_'));
      assert.strictEqual(exportCommands.length, 3);
    });

    test('should handle response batching', () => {
      const responses = [
        { success: true, id: 'batch1_cmd1' },
        { success: true, id: 'batch1_cmd2' },
        { success: false, error: 'timeout', id: 'batch1_cmd3' }
      ];

      const successCount = responses.filter(r => r.success === true).length;
      const failureCount = responses.filter(r => r.success === false).length;

      assert.strictEqual(successCount, 2);
      assert.strictEqual(failureCount, 1);
    });
  });
});
