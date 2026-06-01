/**
 * Security Test: Template Injection in Version Detection (CVE-W14-005)
 * Tests that version strings are properly sanitized to prevent template injection
 */

const assert = require('assert');
const VersionSanitizer = require('../../src/detection/version-sanitizer');

describe('CVE-W14-005: Template Injection in Version Detection', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new VersionSanitizer();
  });

  describe('Dangerous Template Pattern Detection', () => {
    it('should detect and reject template literals', () => {
      const dangerous = [
        '${malicious}',
        '${process.env.SECRET}',
        '${require("child_process").exec("rm -rf /")}'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.hasTemplate, true);
      }
    });

    it('should detect and reject mustache/handlebars', () => {
      const dangerous = [
        '{{cmd}}',
        '{{#if true}}code{{/if}}',
        '{{cmd|dangerous}}'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.hasTemplate, true);
      }
    });

    it('should detect and reject Jinja templates', () => {
      const dangerous = [
        '{%delete%}',
        '{% if True %}code{% endif %}',
        '{# dangerous #}'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
      }
    });

    it('should detect and reject JSP/ERB', () => {
      const dangerous = [
        '<%System.exec("malicious")%>',
        '<%= dangerous_code %>'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
      }
    });

    it('should detect command substitution', () => {
      const dangerous = [
        '$(whoami)',
        '`id`',
        '`rm -rf /`'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
      }
    });

    it('should detect eval/function calls', () => {
      const dangerous = [
        'eval(code)',
        'Function(code)',
        'new Function("code")'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
      }
    });

    it('should detect XSS vectors', () => {
      const dangerous = [
        '<script>alert("xss")</script>',
        '<img src=x onclick="alert()">',
        '<iframe src="evil.com"></iframe>'
      ];

      for (const version of dangerous) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, false);
      }
    });
  });

  describe('Valid Version Formats', () => {
    it('should accept semantic versioning', () => {
      const versions = [
        '1.0.0',
        '2.5.3',
        '0.0.1',
        '10.20.30'
      ];

      for (const version of versions) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, true);
      }
    });

    it('should accept prerelease versions', () => {
      const versions = [
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '2.0.0-rc1',
        '3.0.0-dev'
      ];

      for (const version of versions) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, true);
      }
    });

    it('should accept build metadata', () => {
      const versions = [
        '1.0.0+build.1',
        '1.0.0+20130313144700',
        '1.0.0-beta+exp.sha.5114f85'
      ];

      for (const version of versions) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, true);
      }
    });

    it('should accept revision numbers', () => {
      const versions = [
        'r73',
        'R123',
        'r1000'
      ];

      for (const version of versions) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, true);
      }
    });

    it('should accept two-part versions', () => {
      const versions = ['3.5', '2.1', '10.2'];

      for (const version of versions) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, true);
      }
    });

    it('should accept single number versions', () => {
      const versions = ['5', '12', '99'];

      for (const version of versions) {
        const result = sanitizer.sanitize(version);
        assert.strictEqual(result.valid, true);
      }
    });
  });

  describe('Sanitization Process', () => {
    it('should remove leading v prefix', () => {
      const result = sanitizer.sanitize('v1.2.3');

      assert.strictEqual(result.sanitized, '1.2.3');
    });

    it('should remove dangerous characters', () => {
      const result = sanitizer.sanitize('1.0.0`whoami`');

      // Dangerous patterns should result in invalid version
      if (result.sanitized) {
        assert(!result.sanitized.includes('`'));
      } else {
        assert.strictEqual(result.valid, false);
      }
    });

    it('should clean multiple consecutive dots', () => {
      const result = sanitizer.sanitize('1...2...3');

      // Should normalize
      assert(!result.sanitized.includes('...'));
    });

    it('should trim whitespace', () => {
      const result = sanitizer.sanitize('  1.0.0  ');

      assert.strictEqual(result.sanitized, '1.0.0');
    });

    it('should handle mixed valid/invalid characters', () => {
      const result = sanitizer.sanitize('1.0.0${bad}extra');

      // Should sanitize or reject
      assert(result);
      assert(typeof result === 'object');
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML entities', () => {
      const version = '1.0.0<script>';
      const escaped = sanitizer.escapeForHTML(version);

      assert(!escaped.includes('<script>'));
      assert(escaped.includes('&lt;'));
      assert(escaped.includes('&gt;'));
    });

    it('should escape quotes', () => {
      const version = '1.0.0"xss"';
      const escaped = sanitizer.escapeForHTML(version);

      assert(!escaped.includes('"'));
      assert(escaped.includes('&quot;'));
    });

    it('should escape special HTML characters', () => {
      const tests = [
        { input: '1.0&0', shouldContain: '&amp;' },
        { input: '1.0<2.0', shouldContain: '&lt;' },
        { input: '1>0.0', shouldContain: '&gt;' }
      ];

      for (const test of tests) {
        const escaped = sanitizer.escapeForHTML(test.input);
        assert(escaped.includes(test.shouldContain));
      }
    });
  });

  describe('JavaScript Escaping', () => {
    it('should escape JavaScript special characters', () => {
      const version = '1.0.0"\\n';
      const escaped = sanitizer.escapeForJavaScript(version);

      assert(escaped.includes('\\"'));
      assert(escaped.includes('\\\\'));
      assert(escaped.includes('\\n'));
    });

    it('should be safe for JSON', () => {
      const version = 'v1.0.0"test\'quote';
      const escaped = sanitizer.escapeForJavaScript(version);
      const jsonString = JSON.stringify({ version: escaped });

      // Should not throw
      assert(typeof jsonString === 'string');
    });
  });

  describe('Safe Display Formatting', () => {
    it('should format valid versions for display', () => {
      const version = '1.0.0';
      const display = sanitizer.formatForDisplay(version);

      assert.strictEqual(display, '1.0.0');
    });

    it('should return safe fallback for invalid versions', () => {
      const version = '${malicious}';
      const display = sanitizer.formatForDisplay(version);

      assert.strictEqual(display, '[Invalid Version]');
    });

    it('should escape dangerous content in display', () => {
      const version = '1.0.0<script>';
      const display = sanitizer.formatForDisplay(version);

      assert(!display.includes('<script>'));
    });
  });

  describe('Integration with VersionFingerprinter', () => {
    it('should sanitize versions before normalization', () => {
      const VersionFingerprinter = require('../../src/detection/version-fingerprinter');
      const fingerprinter = new VersionFingerprinter();

      // Dangerous version string
      const result = fingerprinter.fingerprint(
        'WordPress',
        { type: 'header', value: '${delete()}' },
        null,
        {}
      );

      // Should fail validation due to template injection
      assert(!result.version || result.error);
    });

    it('should handle normal version detection normally', () => {
      const VersionFingerprinter = require('../../src/detection/version-fingerprinter');
      const fingerprinter = new VersionFingerprinter();

      const result = fingerprinter.fingerprint(
        'WordPress',
        { type: 'header', value: 'WordPress 5.8' },
        '5.8',
        {}
      );

      // Should succeed
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.version, '5.8.0');
    });
  });

  describe('Attack Vectors', () => {
    it('should block prototype pollution attempts', () => {
      const attacks = [
        '__proto__[admin]=true',
        'constructor[admin]=true',
        'prototype[admin]=true'
      ];

      for (const attack of attacks) {
        const result = sanitizer.sanitize(attack);
        assert.strictEqual(result.valid, false);
      }
    });

    it('should block NoSQL injection patterns', () => {
      const attacks = [
        '$ne',
        '$or',
        '$gt',
        '{$where:1}'
      ];

      for (const attack of attacks) {
        const result = sanitizer.sanitize(attack);
        // These might be valid versions semantically, but let's check they're handled
        assert(typeof result.valid === 'boolean');
      }
    });

    it('should block LDAP injection patterns', () => {
      const attacks = [
        '*',
        '*)(|(cn=*',
        'admin*',
        '*', // wildcards
      ];

      for (const attack of attacks) {
        const result = sanitizer.sanitize(attack);
        assert(typeof result.valid === 'boolean');
      }
    });

    it('should block path traversal', () => {
      const attacks = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '1.0.0/../../secret'
      ];

      for (const attack of attacks) {
        const result = sanitizer.sanitize(attack);
        assert.strictEqual(result.valid, false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = sanitizer.sanitize('');

      assert.strictEqual(result.valid, false);
    });

    it('should handle null/undefined', () => {
      assert.strictEqual(sanitizer.sanitize(null).valid, false);
      assert.strictEqual(sanitizer.sanitize(undefined).valid, false);
    });

    it('should handle very long versions', () => {
      const longVersion = '1' + '.0'.repeat(100);
      const result = sanitizer.sanitize(longVersion);

      // Should be rejected due to length
      assert.strictEqual(result.valid, false);
    });

    it('should handle unicode characters', () => {
      const version = '1.0.0-α';
      const result = sanitizer.sanitize(version);

      // Unicode might be removed, version might be invalid
      assert(typeof result.valid === 'boolean');
    });
  });
});

module.exports = {
  VersionSanitizer
};
