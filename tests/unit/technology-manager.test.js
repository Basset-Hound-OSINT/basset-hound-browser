/**
 * Technology Manager Unit Tests
 */

const { TechnologyManager } = require('../../technology');

describe('TechnologyManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TechnologyManager();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      expect(manager).toBeDefined();
      expect(manager.isEnabled).toBe(true);
    });

    test('should accept custom options', () => {
      const customManager = new TechnologyManager({
        minConfidence: 50,
        maxResults: 50
      });
      expect(customManager).toBeDefined();
    });
  });

  describe('detectTechnologies', () => {
    test('should return error when disabled', async () => {
      manager.isEnabled = false;
      const result = await manager.detectTechnologies({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    test('should return error when page data is missing', async () => {
      const result = await manager.detectTechnologies(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    test('should detect jQuery from script URL', async () => {
      const result = await manager.detectTechnologies({
        url: 'https://example.com',
        html: '<html><body></body></html>',
        scripts: ['https://code.jquery.com/jquery-3.6.0.min.js']
      });
      expect(result.success).toBe(true);
      expect(result.technologies).toBeDefined();
    });

    test('should detect WordPress from meta generator', async () => {
      const result = await manager.detectTechnologies({
        url: 'https://example.com',
        html: '<html><head><meta name="generator" content="WordPress 6.0"></head><body></body></html>'
      });
      expect(result.success).toBe(true);
    });

    test('should detect React from HTML patterns', async () => {
      const result = await manager.detectTechnologies({
        url: 'https://example.com',
        html: '<html><body><div id="root" data-reactroot=""></div></body></html>'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getCategories', () => {
    test('should return available categories', () => {
      const result = manager.getCategories();
      expect(result.success).toBe(true);
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.totalCategories).toBeGreaterThan(0);
    });
  });

  describe('getTechnologyInfo', () => {
    test('should return error when name is missing', () => {
      const result = manager.getTechnologyInfo(null);
      expect(result.success).toBe(false);
    });

    test('should return info for known technology', () => {
      const result = manager.getTechnologyInfo('jQuery');
      expect(result.success).toBe(true);
      expect(result.technology).toBeDefined();
    });
  });

  describe('caching', () => {
    test('should cache detection results', async () => {
      const pageData = {
        url: 'https://example.com/test',
        html: '<html><body></body></html>'
      };

      await manager.detectTechnologies(pageData);
      const cachedResult = await manager.detectTechnologies(pageData);

      expect(cachedResult.cached).toBe(true);
    });
  });
});
