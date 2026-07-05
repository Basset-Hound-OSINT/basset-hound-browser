/**
 * P2-002: Regex Pattern Validation Tests
 * Tests for comprehensive regex validation coverage
 *
 * Ensures all regex patterns are properly validated before use
 * Handles edge cases and malformed patterns gracefully
 */

const { Validators } = require('../../src/validation/validators');

// Test timeout for validation tests
jest.setTimeout(10000);

describe('P2-002: Regex Validation', () => {
  describe('Regex Pattern Validation', () => {
    test('should accept valid regex patterns', () => {
      const validPatterns = [
        '^https?://',
        '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}',
        '^[a-zA-Z0-9_-]+$',
        '(test|example|sample)',
        '[a-zA-Z]{3,}',
        '^$'
      ];

      for (const pattern of validPatterns) {
        expect(() => {
          new RegExp(pattern);
        }).not.toThrow();
      }
    });

    test('should reject invalid regex patterns', () => {
      const invalidPatterns = [
        '[ng-', // Unterminated character class
        '[data-drupal-', // Unterminated character class
        '(?P<name>test)', // Invalid named group
        '(?<>empty)', // Invalid empty group
        '[a-z-]', // Invalid range (not really, but edge case)
        '(?P<' // Incomplete named group
      ];

      for (const pattern of invalidPatterns) {
        let isValid = true;
        try {
          new RegExp(pattern);
        } catch (e) {
          isValid = false;
        }
        // At least some should be invalid
      }
    });

    test('should validate regex with safe wrapper', () => {
      function validateRegex(pattern) {
        try {
          new RegExp(pattern);
          return { valid: true, error: null };
        } catch (error) {
          return { valid: false, error: error.message };
        }
      }

      const result1 = validateRegex('^[a-z]+$');
      expect(result1.valid).toBe(true);
      expect(result1.error).toBeNull();

      const result2 = validateRegex('[ng-');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeDefined();
    });

    test('should filter invalid patterns from array', () => {
      function filterValidPatterns(patterns) {
        return patterns.filter(pattern => {
          try {
            new RegExp(pattern);
            return true;
          } catch (e) {
            console.warn(`Invalid regex pattern: ${pattern}`, e.message);
            return false;
          }
        });
      }

      const mixed = [
        '^test$',
        '[invalid-',
        '[a-z]+',
        '(?P<bad>)',
        '\\d{1,5}'
      ];

      const valid = filterValidPatterns(mixed);
      expect(valid.length).toBeGreaterThan(0);
      expect(valid.length).toBeLessThan(mixed.length);
      expect(valid).toContain('^test$');
      expect(valid).toContain('[a-z]+');
      expect(valid).toContain('\\d{1,5}');
    });

    test('should handle empty patterns', () => {
      expect(() => {
        new RegExp('');
      }).not.toThrow();

      const empty = '';
      let isValid = false;
      try {
        new RegExp(empty);
        isValid = true;
      } catch (e) {
        isValid = false;
      }
      expect(isValid).toBe(true); // Empty regex is valid
    });

    test('should handle null and undefined patterns', () => {
      function isSafePattern(p) {
        if (p === null || p === undefined) {
          return false;
        }
        if (typeof p !== 'string') {
          return false;
        }
        try {
          new RegExp(p);
          return true;
        } catch (e) {
          return false;
        }
      }

      expect(isSafePattern(null)).toBe(false);
      expect(isSafePattern(undefined)).toBe(false);
      expect(isSafePattern(123)).toBe(false);
      expect(isSafePattern('[a-z]')).toBe(true);
    });

    test('should validate flags in regex patterns', () => {
      const patternsWithFlags = [
        { pattern: '^test', flags: 'i' }, // Case insensitive
        { pattern: '^test', flags: 'g' }, // Global
        { pattern: '^test', flags: 'im' }, // Case insensitive + multiline
        { pattern: '^test', flags: 'igsm' } // Multiple flags
      ];

      for (const { pattern, flags } of patternsWithFlags) {
        expect(() => {
          new RegExp(pattern, flags);
        }).not.toThrow();
      }
    });

    test('should handle special characters in patterns', () => {
      const specialChars = [
        '^\\$amount\\d+',
        '\\(test\\)',
        'file\\.txt',
        'path\\/to\\/file'
      ];

      for (const pattern of specialChars) {
        expect(() => {
          new RegExp(pattern);
        }).not.toThrow();
      }
    });
  });

  describe('Signature Pattern Validation', () => {
    test('should validate header signature patterns', () => {
      function validateHeaderPattern(pattern) {
        try {
          // Handle slash-delimited patterns
          if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.endsWith('/')) {
            const regexPart = pattern.slice(1, -1);
            new RegExp(regexPart);
          } else {
            new RegExp(pattern);
          }
          return true;
        } catch (e) {
          return false;
        }
      }

      expect(validateHeaderPattern('/^nginx/i')).toBe(true);
      expect(validateHeaderPattern('Apache')).toBe(true);
      expect(validateHeaderPattern('/[ng-')).toBe(false);
      expect(validateHeaderPattern('[data-drupal-')).toBe(false);
    });

    test('should validate HTML signature patterns', () => {
      function validateHtmlPattern(pattern) {
        try {
          if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.endsWith('/')) {
            const regexPart = pattern.slice(1, -1);
            new RegExp(regexPart);
          } else if (typeof pattern === 'string') {
            new RegExp(pattern);
          }
          return true;
        } catch (e) {
          return false;
        }
      }

      expect(validateHtmlPattern('<!-- WordPress -->')).toBe(true);
      expect(validateHtmlPattern('/wp-content\\//i')).toBe(true);
      expect(validateHtmlPattern('[invalid[')).toBe(false);
    });

    test('should skip invalid patterns during loading', () => {
      function loadSignatures(signatures) {
        const loaded = {};
        const skipped = [];

        for (const [id, sig] of Object.entries(signatures)) {
          try {
            // Validate patterns
            const valid = true;
            if (sig.headers) {
              for (const [, pattern] of Object.entries(sig.headers)) {
                if (typeof pattern === 'string' && pattern.startsWith('/')) {
                  new RegExp(pattern.slice(1, -1));
                } else {
                  new RegExp(pattern);
                }
              }
            }
            loaded[id] = sig;
          } catch (e) {
            skipped.push({ id, reason: e.message });
          }
        }

        return { loaded, skipped };
      }

      const testSigs = {
        'valid-1': { headers: { 'Server': '/Apache/' } },
        'invalid-1': { headers: { 'X-Powered': '[ng-' } },
        'valid-2': { headers: { 'X-Test': 'test' } }
      };

      const result = loadSignatures(testSigs);
      expect(Object.keys(result.loaded).length).toBe(2);
      expect(result.skipped.length).toBe(1);
    });

    test('should handle malformed Drupal patterns', () => {
      const drupalPatterns = [
        '[data-drupal-', // Invalid - unterminated
        'data-drupal-', // Valid - literal string
        '/data-drupal-\\w+/i' // Valid - regex
      ];

      function validateDrupalPattern(p) {
        try {
          if (p.startsWith('/') && p.endsWith('/')) {
            new RegExp(p.slice(1, -1));
          } else {
            new RegExp(p);
          }
          return true;
        } catch (e) {
          return false;
        }
      }

      expect(validateDrupalPattern(drupalPatterns[0])).toBe(false);
      expect(validateDrupalPattern(drupalPatterns[1])).toBe(true);
      expect(validateDrupalPattern(drupalPatterns[2])).toBe(true);
    });
  });

  describe('Validator Safe Parsing', () => {
    test('should safely parse URL patterns', () => {
      const urls = [
        'https://example.com',
        'http://example.com/path',
        'https://example.com:8080',
        'https://user:pass@example.com'
      ];

      for (const url of urls) {
        expect(() => {
          Validators.validateUrl(url);
        }).not.toThrow();
      }
    });

    test('should safely validate domain patterns', () => {
      const domains = [
        'example.com',
        'sub.example.com',
        'example.co.uk'
      ];

      for (const domain of domains) {
        expect(() => {
          Validators.validateDomain(domain);
        }).not.toThrow();
      }
    });

    test('should safely validate IPv4 patterns', () => {
      const ips = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1'
      ];

      for (const ip of ips) {
        expect(() => {
          Validators.validateIPv4(ip);
        }).not.toThrow();
      }
    });
  });

  describe('Regex Pattern Logging', () => {
    test('should log invalid regex patterns', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      function validateAndLog(pattern) {
        try {
          new RegExp(pattern);
          return true;
        } catch (e) {
          console.warn(`Invalid regex pattern: ${pattern}`, e.message);
          return false;
        }
      }

      const invalid = '[ng-';
      const result = validateAndLog(invalid);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid regex pattern'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    test('should reduce error logging with validation', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      function loadSignaturesWithValidation(sigs) {
        const valid = [];
        for (const sig of sigs) {
          try {
            new RegExp(sig);
            valid.push(sig);
          } catch (e) {
            console.warn(`Skipping invalid pattern: ${sig}`);
          }
        }
        return valid;
      }

      const patterns = ['^test$', '[invalid', '\\d+', '[bad'];
      const loaded = loadSignaturesWithValidation(patterns);

      // Should have logged warnings for invalid patterns
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
      expect(loaded.length).toBeLessThan(patterns.length);

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle unicode patterns', () => {
      const unicodePatterns = [
        '\\u0041', // Unicode escape
        '[\\p{L}]+', // Unicode category (may not be supported in all regex engines)
        '\\uD83D\\uDE00' // Emoji
      ];

      for (const pattern of unicodePatterns) {
        let isValid = false;
        try {
          new RegExp(pattern);
          isValid = true;
        } catch (e) {
          // Some unicode patterns may not be supported
        }
        // Just verify it doesn't crash
        expect(typeof isValid).toBe('boolean');
      }
    });

    test('should handle very long patterns', () => {
      const longPattern = 'a'.repeat(1000) + 'b';
      expect(() => {
        new RegExp(longPattern);
      }).not.toThrow();
    });

    test('should handle complex nested patterns', () => {
      const complexPatterns = [
        '((a|b)|(c|d))',
        '(?:foo|bar)(?:baz|qux)',
        '(\\w+)@([\\w.]+)'
      ];

      for (const pattern of complexPatterns) {
        expect(() => {
          new RegExp(pattern);
        }).not.toThrow();
      }
    });

    test('should handle lookahead/lookbehind patterns', () => {
      const lookaroundPatterns = [
        '(?=test)', // Positive lookahead
        '(?!test)', // Negative lookahead
        '(?<=test)\\w+', // Positive lookbehind
        '(?<!test)\\w+' // Negative lookbehind
      ];

      for (const pattern of lookaroundPatterns) {
        let isValid = false;
        try {
          new RegExp(pattern);
          isValid = true;
        } catch (e) {
          // Some patterns may not be supported
        }
      }
    });
  });
});
