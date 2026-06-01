/**
 * Technology Signatures Database Tests
 *
 * Tests for:
 * - Signature retrieval
 * - Category management
 * - Technology classification
 * - Accuracy coverage
 */

const {
  TECH_SIGNATURES,
  getSignature,
  getAllSignatures,
  getTechnologyNames,
  getTechnologiesByCategory,
  getCategories
} = require('../../src/detection/tech-signatures');

describe('Technology Signatures Database', () => {
  describe('Database Structure', () => {
    test('should have 50+ technologies', () => {
      const count = Object.keys(TECH_SIGNATURES).length;
      expect(count).toBeGreaterThanOrEqual(50);
    });

    test('should have diverse categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThanOrEqual(10);
      expect(categories).toContain('JavaScript Framework');
      expect(categories).toContain('CMS');
      expect(categories).toContain('Web Server');
      expect(categories).toContain('Analytics');
    });

    test('should have all required signature fields', () => {
      Object.entries(TECH_SIGNATURES).forEach(([name, sig]) => {
        expect(sig).toHaveProperty('category');
        expect(sig).toHaveProperty('accuracy');
        expect(sig).toHaveProperty('detection');
        expect(Array.isArray(sig.detection)).toBe(true);
        expect(sig.accuracy).toBeGreaterThanOrEqual(0.5);
        expect(sig.accuracy).toBeLessThanOrEqual(1);
      });
    });

    test('should have valid detection rules', () => {
      Object.entries(TECH_SIGNATURES).forEach(([name, sig]) => {
        expect(Array.isArray(sig.detection)).toBe(true);
        expect(sig.detection.length).toBeGreaterThan(0);

        sig.detection.forEach((rule, idx) => {
          expect(rule).toHaveProperty('type');
          expect(['header', 'html', 'meta', 'script', 'cookie', 'endpoint', 'js-global']).toContain(rule.type);
          expect(rule).toHaveProperty('pattern');
        });
      });
    });
  });

  describe('Signature Retrieval', () => {
    test('should retrieve known signatures by name', () => {
      const sig = getSignature('WordPress');
      expect(sig).toBeDefined();
      expect(sig.category).toBe('CMS');
      expect(sig.accuracy).toBeGreaterThan(0.9);
    });

    test('should return null for unknown signatures', () => {
      const sig = getSignature('UnknownTech');
      expect(sig).toBeNull();
    });

    test('should get all signatures', () => {
      const all = getAllSignatures();
      expect(Object.keys(all).length).toBeGreaterThanOrEqual(50);
      expect(all.React).toBeDefined();
      expect(all.WordPress).toBeDefined();
    });

    test('should get all technology names', () => {
      const names = getTechnologyNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThanOrEqual(50);
      expect(names).toContain('React');
      expect(names).toContain('WordPress');
      // Check sorted
      for (let i = 1; i < names.length; i++) {
        expect(names[i].localeCompare(names[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Category Management', () => {
    test('should retrieve technologies by category', () => {
      const frameworks = getTechnologiesByCategory('JavaScript Framework');
      expect(Array.isArray(frameworks)).toBe(true);
      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks).toContain('React');
      expect(frameworks).toContain('Vue.js');
      expect(frameworks).toContain('Angular');
    });

    test('should retrieve CMS platforms', () => {
      const cms = getTechnologiesByCategory('CMS');
      expect(cms.length).toBeGreaterThan(0);
      expect(cms).toContain('WordPress');
      expect(cms).toContain('Drupal');
    });

    test('should retrieve analytics tools', () => {
      const analytics = getTechnologiesByCategory('Analytics');
      expect(analytics.length).toBeGreaterThan(0);
      expect(analytics).toContain('Google Analytics');
    });

    test('should return sorted results', () => {
      const techs = getTechnologiesByCategory('JavaScript Framework');
      for (let i = 1; i < techs.length; i++) {
        expect(techs[i].localeCompare(techs[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });

    test('should get all categories', () => {
      const categories = getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(10);
      // Check sorted
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].localeCompare(categories[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Signature Coverage', () => {
    test('should have signatures for popular frameworks', () => {
      const required = ['React', 'Vue.js', 'Angular', 'Next.js', 'jQuery'];
      required.forEach(name => {
        expect(TECH_SIGNATURES[name]).toBeDefined();
      });
    });

    test('should have signatures for popular CMS', () => {
      const required = ['WordPress', 'Drupal', 'Joomla', 'Ghost'];
      required.forEach(name => {
        expect(TECH_SIGNATURES[name]).toBeDefined();
      });
    });

    test('should have signatures for web servers', () => {
      const required = ['Nginx', 'Apache', 'IIS'];
      required.forEach(name => {
        expect(TECH_SIGNATURES[name]).toBeDefined();
      });
    });

    test('should have signatures for analytics', () => {
      const required = ['Google Analytics', 'Mixpanel', 'Amplitude'];
      required.forEach(name => {
        expect(TECH_SIGNATURES[name]).toBeDefined();
      });
    });

    test('should have high accuracy for critical detections', () => {
      const critical = ['WordPress', 'Shopify', 'Google Analytics', 'Cloudflare'];
      critical.forEach(name => {
        const sig = TECH_SIGNATURES[name];
        expect(sig.accuracy).toBeGreaterThan(0.85);
      });
    });
  });

  describe('Detection Rules', () => {
    test('React should have multiple detection methods', () => {
      const sig = getSignature('React');
      const types = sig.detection.map(r => r.type);
      expect(types).toContain('js-global');
      expect(types).toContain('html');
    });

    test('WordPress should have header detection', () => {
      const sig = getSignature('WordPress');
      const hasHeader = sig.detection.some(r => r.type === 'header');
      expect(hasHeader).toBe(true);
    });

    test('jQuery should have script detection', () => {
      const sig = getSignature('jQuery');
      const hasScript = sig.detection.some(r => r.type === 'script');
      expect(hasScript).toBe(true);
    });

    test('Nginx should have header detection', () => {
      const sig = getSignature('Nginx');
      const rules = sig.detection.filter(r => r.type === 'header');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].pattern).toBe('server');
    });

    test('Shopify should have multiple detection methods', () => {
      const sig = getSignature('Shopify');
      expect(sig.detection.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Version Detection', () => {
    test('should have version patterns for major techs', () => {
      const withVersions = ['React', 'WordPress', 'Drupal', 'Django', 'Nginx'];
      withVersions.forEach(name => {
        const sig = getSignature(name);
        expect(sig.version).toBeDefined();
      });
    });

    test('should have valid regex version patterns', () => {
      Object.entries(TECH_SIGNATURES).forEach(([name, sig]) => {
        if (sig.version) {
          expect(sig.version).toBeInstanceOf(RegExp);
        }
      });
    });
  });

  describe('Accuracy Weights', () => {
    test('should have accuracy between 0.5 and 1.0', () => {
      Object.entries(TECH_SIGNATURES).forEach(([name, sig]) => {
        expect(sig.accuracy).toBeGreaterThanOrEqual(0.5);
        expect(sig.accuracy).toBeLessThanOrEqual(1.0);
      });
    });

    test('should have higher accuracy for distinctive signatures', () => {
      const wordpress = getSignature('WordPress');
      const angular = getSignature('Angular');
      // WordPress has more distinctive patterns
      expect(wordpress.accuracy).toBeGreaterThan(angular.accuracy);
    });

    test('should have consistent accuracy distribution', () => {
      const accuracies = Object.values(TECH_SIGNATURES).map(s => s.accuracy);
      const avg = accuracies.reduce((a, b) => a + b) / accuracies.length;
      expect(avg).toBeGreaterThan(0.75);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null inputs safely', () => {
      expect(getSignature(null)).toBeNull();
      expect(getSignature(undefined)).toBeNull();
    });

    test('should handle case-sensitive tech names', () => {
      expect(getSignature('react')).toBeNull(); // lowercase
      expect(getSignature('React')).toBeDefined(); // correct case
    });

    test('should handle category search with non-existent category', () => {
      const results = getTechnologiesByCategory('NonExistentCategory');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});
