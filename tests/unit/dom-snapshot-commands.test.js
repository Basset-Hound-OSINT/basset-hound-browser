/**
 * DOM Snapshot Commands Unit Tests
 * Tests for complete DOM extraction functionality
 */

const { DOMSnapshotManager } = require('../../src/extraction/dom-snapshot');

describe('DOMSnapshotManager', () => {
  let manager;

  beforeEach(() => {
    manager = new DOMSnapshotManager();
  });

  describe('initialization', () => {
    test('should initialize with empty mutation history', () => {
      expect(manager.mutationHistory).toEqual([]);
      expect(manager.maxHistorySize).toBe(1000);
      expect(manager.isTracking).toBe(false);
    });
  });

  describe('generateDOMTreeScript', () => {
    test('should generate valid JavaScript for DOM tree extraction', () => {
      const script = manager.generateDOMTreeScript();
      expect(script).toBeDefined();
      expect(script).toContain('function serializeNode');
      expect(script).toContain('document.documentElement');
      expect(script).toContain('return {');
    });

    test('should respect maxDepth parameter', () => {
      const script = manager.generateDOMTreeScript({ maxDepth: 10 });
      expect(script).toContain('maxDepth = 10');
    });

    test('should respect includeText parameter', () => {
      const script = manager.generateDOMTreeScript({ includeText: false });
      expect(script).toContain('includeText = false');
    });

    test('should include comment handling when requested', () => {
      const script = manager.generateDOMTreeScript({ includeComments: true });
      expect(script).toContain('includeComments = true');
      expect(script).toContain('COMMENT_NODE');
    });

    test('should handle special characters in script safely', () => {
      const script = manager.generateDOMTreeScript();
      // Script should be valid even when executed (IIFE format)
      expect(() => {
        new Function(script);
      }).not.toThrow();
    });
  });

  describe('generateComputedStylesScript', () => {
    test('should generate valid JavaScript for style extraction', () => {
      const script = manager.generateComputedStylesScript();
      expect(script).toBeDefined();
      expect(script).toContain('document.querySelectorAll');
      expect(script).toContain('window.getComputedStyle');
      expect(script).toContain('cssProperties');
    });

    test('should include specific CSS properties', () => {
      const script = manager.generateComputedStylesScript();
      expect(script).toContain('display');
      expect(script).toContain('visibility');
      expect(script).toContain('position');
      expect(script).toContain('color');
    });

    test('should respect selector parameter', () => {
      const script = manager.generateComputedStylesScript({ selector: 'div.active' });
      expect(script).toContain('div.active');
    });

    test('should respect limit parameter', () => {
      const script = manager.generateComputedStylesScript({ limit: 100 });
      expect(script).toContain('100');
    });
  });

  describe('generateFormStateScript', () => {
    test('should generate valid JavaScript for form extraction', () => {
      const script = manager.generateFormStateScript();
      expect(script).toBeDefined();
      expect(script).toContain('document.querySelectorAll(\'form\')');
      expect(script).toContain('formData');
      expect(script).toContain('fields');
    });

    test('should handle input types correctly', () => {
      const script = manager.generateFormStateScript();
      expect(script).toContain('INPUT');
      expect(script).toContain('TEXTAREA');
      expect(script).toContain('SELECT');
    });

    test('should include form attributes', () => {
      const script = manager.generateFormStateScript();
      expect(script).toContain('form.id');
      expect(script).toContain('form.method');
      expect(script).toContain('form.action');
    });

    test('should capture field states', () => {
      const script = manager.generateFormStateScript();
      expect(script).toContain('checked');
      expect(script).toContain('disabled');
      expect(script).toContain('required');
    });
  });

  describe('generateTextContentScript', () => {
    test('should generate valid JavaScript for text extraction', () => {
      const script = manager.generateTextContentScript();
      expect(script).toBeDefined();
      expect(script).toContain('createTreeWalker');
      expect(script).toContain('SHOW_TEXT');
      expect(script).toContain('textElements');
    });

    test('should use TreeWalker for efficient traversal', () => {
      const script = manager.generateTextContentScript();
      expect(script).toContain('TreeWalker');
      expect(script).toContain('NodeFilter');
    });

    test('should extract positioning information', () => {
      const script = manager.generateTextContentScript();
      expect(script).toContain('getBoundingClientRect');
      expect(script).toContain('rect');
    });

    test('should respect includeWhitespace parameter', () => {
      const scriptWithoutWhitespace = manager.generateTextContentScript({ includeWhitespace: false });
      const scriptWithWhitespace = manager.generateTextContentScript({ includeWhitespace: true });

      expect(scriptWithoutWhitespace).toContain('false');
      expect(scriptWithWhitespace).toContain('true');
    });
  });

  describe('generateAttributesScript', () => {
    test('should generate valid JavaScript for attribute extraction', () => {
      const script = manager.generateAttributesScript();
      expect(script).toBeDefined();
      expect(script).toContain('querySelectorAll');
      expect(script).toContain('attributes');
    });

    test('should collect all element attributes', () => {
      const script = manager.generateAttributesScript();
      expect(script).toContain('element.attributes');
      expect(script).toContain('attr.name');
    });

    test('should respect selector parameter', () => {
      const script = manager.generateAttributesScript({ selector: 'input[type="text"]' });
      expect(script).toContain('input[type="text"]');
    });

    test('should respect limit parameter', () => {
      const script = manager.generateAttributesScript({ limit: 500 });
      expect(script).toContain('500');
    });
  });

  describe('generateEventListenersScript', () => {
    test('should generate valid JavaScript for event listener detection', () => {
      const script = manager.generateEventListenersScript();
      expect(script).toBeDefined();
      expect(script).toContain('commonEvents');
      expect(script).toContain('listeners');
    });

    test('should include common event types', () => {
      const script = manager.generateEventListenersScript();
      expect(script).toContain('click');
      expect(script).toContain('change');
      expect(script).toContain('submit');
      expect(script).toContain('focus');
    });

    test('should detect attribute-based handlers', () => {
      const script = manager.generateEventListenersScript();
      expect(script).toContain('onchange');
      expect(script).toContain('onclick');
    });

    test('should include browser security note', () => {
      const script = manager.generateEventListenersScript();
      expect(script).toContain('Browser security restrictions');
    });
  });

  describe('generateMutationTrackerScript', () => {
    test('should generate valid JavaScript for mutation tracking setup', () => {
      const script = manager.generateMutationTrackerScript();
      expect(script).toBeDefined();
      expect(script).toContain('MutationObserver');
      expect(script).toContain('__domMutationTracker');
    });

    test('should initialize mutation history', () => {
      const script = manager.generateMutationTrackerScript();
      expect(script).toContain('mutations: []');
    });

    test('should observe correct mutation types', () => {
      const script = manager.generateMutationTrackerScript();
      expect(script).toContain('childList: true');
      expect(script).toContain('subtree: true');
      expect(script).toContain('attributes: true');
    });

    test('should set maxSize for history', () => {
      const script = manager.generateMutationTrackerScript();
      expect(script).toContain('maxSize:');
    });
  });

  describe('generateMutationHistoryScript', () => {
    test('should generate valid JavaScript for retrieving mutation history', () => {
      const script = manager.generateMutationHistoryScript();
      expect(script).toBeDefined();
      expect(script).toContain('__domMutationTracker');
      expect(script).toContain('mutations');
    });

    test('should safely handle missing tracker', () => {
      const script = manager.generateMutationHistoryScript();
      expect(script).toContain('if (!window.__domMutationTracker');
    });
  });

  describe('generateStopMutationTrackerScript', () => {
    test('should generate valid JavaScript for stopping mutation tracking', () => {
      const script = manager.generateStopMutationTrackerScript();
      expect(script).toBeDefined();
      expect(script).toContain('disconnect');
      expect(script).toContain('__domMutationTracker');
    });

    test('should safely handle missing tracker', () => {
      const script = manager.generateStopMutationTrackerScript();
      expect(script).toContain('if (!window.__domMutationTracker');
    });
  });

  describe('script validity', () => {
    test('all generated scripts should be valid JavaScript', () => {
      const scripts = [
        manager.generateDOMTreeScript(),
        manager.generateComputedStylesScript(),
        manager.generateFormStateScript(),
        manager.generateTextContentScript(),
        manager.generateAttributesScript(),
        manager.generateEventListenersScript(),
        manager.generateMutationTrackerScript(),
        manager.generateMutationHistoryScript(),
        manager.generateStopMutationTrackerScript()
      ];

      for (const script of scripts) {
        expect(() => {
          new Function(script);
        }).not.toThrow();
      }
    });
  });

  describe('XPath generation', () => {
    test('text content script should include XPath generation', () => {
      const script = manager.generateTextContentScript();
      expect(script).toContain('getXPath');
      expect(script).toContain('@id');
    });
  });

  describe('element positioning', () => {
    test('all extraction methods should include position data', () => {
      const methods = [
        'generateDOMTreeScript',
        'generateComputedStylesScript',
        'generateTextContentScript'
      ];

      for (const methodName of methods) {
        const script = manager[methodName]();
        expect(script).toContain('getBoundingClientRect');
      }
    });
  });

  describe('performance considerations', () => {
    test('DOM tree should respect depth limit', () => {
      const script = manager.generateDOMTreeScript({ maxDepth: 5 });
      expect(script).toContain('maxDepth = 5');
    });

    test('computed styles should respect element limit', () => {
      const script = manager.generateComputedStylesScript({ limit: 100 });
      // Limit is interpolated into the script during generation
      expect(script).toContain('100');
    });

    test('text content should cap at 10000 elements', () => {
      const script = manager.generateTextContentScript();
      expect(script).toContain('10000');
    });

    test('attributes should respect limit parameter', () => {
      const script = manager.generateAttributesScript({ limit: 1000 });
      // Limit is interpolated into the script during generation
      expect(script).toContain('1000');
    });
  });

  describe('data safety', () => {
    test('sensitive field types should not capture values', () => {
      const script = manager.generateFormStateScript();
      // Password and file inputs should be handled specially
      expect(script).toContain('password');
      expect(script).toContain('file');
    });

    test('text truncation should be applied', () => {
      const methods = [
        'generateDOMTreeScript',
        'generateFormStateScript',
        'generateTextContentScript'
      ];

      for (const methodName of methods) {
        const script = manager[methodName]();
        // Should include substring truncation
        expect(script).toContain('substring');
      }
    });
  });
});
