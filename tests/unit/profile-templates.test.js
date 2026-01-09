/**
 * Tests for Profile Templates
 */

const {
  ProfileTemplate,
  ProfileTemplateManager,
  TEMPLATE_CATEGORIES,
  RISK_LEVELS,
  ACTIVITY_PATTERNS
} = require('../../profiles/profile-templates');

describe('Profile Templates', () => {
  // ==========================================
  // ProfileTemplate Tests
  // ==========================================

  describe('ProfileTemplate', () => {
    test('should create template with defaults', () => {
      const template = new ProfileTemplate({
        name: 'Test Template'
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.category).toBe(TEMPLATE_CATEGORIES.OSINT);
      expect(template.riskLevel).toBe(RISK_LEVELS.MEDIUM);
      expect(template.activityPattern).toBe(ACTIVITY_PATTERNS.CASUAL);
    });

    test('should create template with custom settings', () => {
      const template = new ProfileTemplate({
        name: 'Custom Template',
        category: TEMPLATE_CATEGORIES.STEALTH,
        riskLevel: RISK_LEVELS.PARANOID,
        activityPattern: ACTIVITY_PATTERNS.RESEARCHER,
        fingerprint: {
          platform: 'Linux',
          region: 'EU'
        }
      });

      expect(template.category).toBe(TEMPLATE_CATEGORIES.STEALTH);
      expect(template.riskLevel).toBe(RISK_LEVELS.PARANOID);
      expect(template.activityPattern).toBe(ACTIVITY_PATTERNS.RESEARCHER);
      expect(template.fingerprint.platform).toBe('Linux');
      expect(template.fingerprint.region).toBe('EU');
    });

    test('should generate profile from template', () => {
      const template = new ProfileTemplate({
        name: 'Test',
        fingerprint: { platform: 'Windows' },
        behavioral: { mouseSpeed: 'fast' }
      });

      const profile = template.generateProfile();

      expect(profile.templateId).toBe(template.id);
      expect(profile.templateName).toBe('Test');
      expect(profile.fingerprint).toBeDefined();
      expect(profile.behavioral).toBeDefined();
      expect(profile.metadata.generatedAt).toBeDefined();
    });

    test('should apply customizations when generating profile', () => {
      const template = new ProfileTemplate({
        name: 'Test',
        fingerprint: { platform: 'Windows', region: 'US' }
      });

      const profile = template.generateProfile({
        fingerprint: { region: 'EU' }
      });

      expect(profile.fingerprint.region).toBeDefined();
    });

    test('should record usage', () => {
      const template = new ProfileTemplate({ name: 'Test' });
      expect(template.usageCount).toBe(0);

      template.recordUsage();
      expect(template.usageCount).toBe(1);

      template.recordUsage();
      expect(template.usageCount).toBe(2);
    });

    test('should update timestamp on usage', () => {
      const template = new ProfileTemplate({ name: 'Test' });
      const originalTimestamp = template.updatedAt;

      // Wait a bit
      setTimeout(() => {
        template.recordUsage();
        expect(template.updatedAt).toBeGreaterThan(originalTimestamp);
      }, 10);
    });
  });

  // ==========================================
  // ProfileTemplateManager Tests
  // ==========================================

  describe('ProfileTemplateManager', () => {
    let manager;

    beforeEach(() => {
      manager = new ProfileTemplateManager();
    });

    test('should initialize with built-in templates', () => {
      const templates = manager.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    test('should have osint_investigator template', () => {
      const template = manager.getTemplate('osint_investigator');
      expect(template).toBeDefined();
      expect(template.name).toBe('OSINT Investigator');
      expect(template.category).toBe(TEMPLATE_CATEGORIES.OSINT);
    });

    test('should have stealth_mode template', () => {
      const template = manager.getTemplate('stealth_mode');
      expect(template).toBeDefined();
      expect(template.riskLevel).toBe(RISK_LEVELS.PARANOID);
      expect(template.network.tor).toBe(true);
    });

    test('should have web_scraper template', () => {
      const template = manager.getTemplate('web_scraper');
      expect(template).toBeDefined();
      expect(template.category).toBe(TEMPLATE_CATEGORIES.SCRAPING);
      expect(template.browserSettings.images).toBe(false);
    });

    test('should register new template', () => {
      const template = new ProfileTemplate({
        name: 'Custom Test'
      });

      manager.registerTemplate(template);
      const retrieved = manager.getTemplate(template.id);

      expect(retrieved).toBe(template);
    });

    test('should throw error when registering invalid template', () => {
      expect(() => {
        manager.registerTemplate({ name: 'Invalid' });
      }).toThrow('Template must be instance of ProfileTemplate');
    });

    test('should list all templates', () => {
      const templates = manager.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toBeInstanceOf(ProfileTemplate);
    });

    test('should filter templates by category', () => {
      const osintTemplates = manager.listTemplates({
        category: TEMPLATE_CATEGORIES.OSINT
      });

      expect(osintTemplates.length).toBeGreaterThan(0);
      osintTemplates.forEach(t => {
        expect(t.category).toBe(TEMPLATE_CATEGORIES.OSINT);
      });
    });

    test('should filter templates by risk level', () => {
      const paranoidTemplates = manager.listTemplates({
        riskLevel: RISK_LEVELS.PARANOID
      });

      expect(paranoidTemplates.length).toBeGreaterThan(0);
      paranoidTemplates.forEach(t => {
        expect(t.riskLevel).toBe(RISK_LEVELS.PARANOID);
      });
    });

    test('should filter templates by tags', () => {
      const stealthTemplates = manager.listTemplates({
        tags: ['stealth']
      });

      expect(stealthTemplates.length).toBeGreaterThan(0);
      stealthTemplates.forEach(t => {
        expect(t.tags).toContain('stealth');
      });
    });

    test('should sort templates by usage', () => {
      const t1 = manager.getTemplate('osint_investigator');
      const t2 = manager.getTemplate('stealth_mode');

      t1.usageCount = 10;
      t2.usageCount = 5;

      const sorted = manager.listTemplates({ sortBy: 'usage' });

      expect(sorted[0].usageCount).toBeGreaterThanOrEqual(sorted[1].usageCount);
    });

    test('should sort templates by name', () => {
      const sorted = manager.listTemplates({ sortBy: 'name' });

      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].name.localeCompare(sorted[i - 1].name)).toBeGreaterThanOrEqual(0);
      }
    });

    test('should search templates by name', () => {
      const results = manager.searchTemplates('OSINT');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('OSINT');
    });

    test('should search templates by description', () => {
      const results = manager.searchTemplates('stealth');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should search templates by tags', () => {
      const results = manager.searchTemplates('social');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should return empty array for no search results', () => {
      const results = manager.searchTemplates('nonexistent12345');
      expect(results).toEqual([]);
    });

    test('should delete template', () => {
      const template = new ProfileTemplate({ name: 'To Delete' });
      manager.registerTemplate(template);

      expect(manager.getTemplate(template.id)).toBeDefined();

      const deleted = manager.deleteTemplate(template.id);
      expect(deleted).toBe(true);
      expect(manager.getTemplate(template.id)).toBeUndefined();
    });

    test('should return false when deleting non-existent template', () => {
      const deleted = manager.deleteTemplate('nonexistent');
      expect(deleted).toBe(false);
    });

    test('should create custom template', () => {
      const custom = manager.createCustomTemplate({
        name: 'My Custom',
        category: TEMPLATE_CATEGORIES.TESTING,
        riskLevel: RISK_LEVELS.LOW
      });

      expect(custom).toBeInstanceOf(ProfileTemplate);
      expect(custom.name).toBe('My Custom');
      expect(manager.getTemplate(custom.id)).toBe(custom);
    });

    test('should clone template', () => {
      const cloned = manager.cloneTemplate('osint_investigator');

      expect(cloned).toBeInstanceOf(ProfileTemplate);
      expect(cloned.name).toContain('(Copy)');
      expect(cloned.id).not.toBe('osint_investigator');
      expect(manager.getTemplate(cloned.id)).toBe(cloned);
    });

    test('should clone template with modifications', () => {
      const cloned = manager.cloneTemplate('osint_investigator', {
        name: 'Modified OSINT',
        riskLevel: RISK_LEVELS.HIGH
      });

      expect(cloned.name).toBe('Modified OSINT');
      expect(cloned.riskLevel).toBe(RISK_LEVELS.HIGH);
    });

    test('should throw error when cloning non-existent template', () => {
      expect(() => {
        manager.cloneTemplate('nonexistent');
      }).toThrow('Template not found');
    });

    test('should export template', () => {
      const exported = manager.exportTemplate('osint_investigator');

      expect(exported.id).toBe('osint_investigator');
      expect(exported.name).toBe('OSINT Investigator');
      expect(exported.fingerprint).toBeDefined();
      expect(exported.behavioral).toBeDefined();
      expect(exported.browserSettings).toBeDefined();
    });

    test('should throw error when exporting non-existent template', () => {
      expect(() => {
        manager.exportTemplate('nonexistent');
      }).toThrow('Template not found');
    });

    test('should import template', () => {
      const data = {
        name: 'Imported Template',
        category: TEMPLATE_CATEGORIES.TESTING,
        fingerprint: { platform: 'Linux' }
      };

      const imported = manager.importTemplate(data);

      expect(imported).toBeInstanceOf(ProfileTemplate);
      expect(imported.name).toBe('Imported Template');
      expect(manager.getTemplate(imported.id)).toBe(imported);
    });

    test('should get statistics', () => {
      const stats = manager.getStatistics();

      expect(stats.totalTemplates).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byRiskLevel).toBeDefined();
      expect(stats.byActivityPattern).toBeDefined();
      expect(stats.mostUsed).toBeInstanceOf(Array);
      expect(stats.allTags).toBeInstanceOf(Array);
    });

    test('should count templates by category', () => {
      const stats = manager.getStatistics();
      const categoryCount = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
      expect(categoryCount).toBe(stats.totalTemplates);
    });

    test('should list all tags', () => {
      const stats = manager.getStatistics();
      expect(stats.allTags.length).toBeGreaterThan(0);
      expect(stats.allTags).toContain('osint');
    });

    test('should sort most used templates', () => {
      const t1 = manager.getTemplate('osint_investigator');
      const t2 = manager.getTemplate('stealth_mode');
      const t3 = manager.getTemplate('web_scraper');

      t1.usageCount = 100;
      t2.usageCount = 50;
      t3.usageCount = 25;

      const stats = manager.getStatistics();

      expect(stats.mostUsed.length).toBeGreaterThan(0);
      expect(stats.mostUsed[0].id).toBe('osint_investigator');
      expect(stats.mostUsed[0].usageCount).toBe(100);
    });
  });

  // ==========================================
  // Built-in Templates Tests
  // ==========================================

  describe('Built-in Templates', () => {
    let manager;

    beforeEach(() => {
      manager = new ProfileTemplateManager();
    });

    test('osint_investigator should have balanced settings', () => {
      const template = manager.getTemplate('osint_investigator');
      expect(template.riskLevel).toBe(RISK_LEVELS.MEDIUM);
      expect(template.behavioral.mouseSpeed).toBe('medium');
      expect(template.browserSettings.doNotTrack).toBe(true);
    });

    test('stealth_mode should have maximum evasion', () => {
      const template = manager.getTemplate('stealth_mode');
      expect(template.riskLevel).toBe(RISK_LEVELS.PARANOID);
      expect(template.network.tor).toBe(true);
      expect(template.network.webrtc).toBe('disabled');
      expect(template.behavioral.mouseSpeed).toBe('slow');
    });

    test('web_scraper should be optimized for speed', () => {
      const template = manager.getTemplate('web_scraper');
      expect(template.browserSettings.images).toBe(false);
      expect(template.behavioral.mouseSpeed).toBe('fast');
      expect(template.activity.pagesPerSession.min).toBeGreaterThan(10);
    });

    test('social_media_monitor should allow cookies', () => {
      const template = manager.getTemplate('social_media_monitor');
      expect(template.browserSettings.cookies).toBe('enabled');
      expect(template.browserSettings.javascript).toBe(true);
      expect(template.activity.interactionRate).toBeGreaterThan(0.3);
    });

    test('ecommerce_shopper should have realistic shopping behavior', () => {
      const template = manager.getTemplate('ecommerce_shopper');
      expect(template.category).toBe(TEMPLATE_CATEGORIES.ECOMMERCE);
      expect(template.activityPattern).toBe(ACTIVITY_PATTERNS.SHOPPER);
      expect(template.browserSettings.cookies).toBe('enabled');
    });

    test('news_reader should have content-focused settings', () => {
      const template = manager.getTemplate('news_reader');
      expect(template.activityPattern).toBe(ACTIVITY_PATTERNS.NEWS_READER);
      expect(template.activity.scrollDepth.min).toBeGreaterThan(0.5);
    });

    test('testing_profile should have fast settings', () => {
      const template = manager.getTemplate('testing_profile');
      expect(template.category).toBe(TEMPLATE_CATEGORIES.TESTING);
      expect(template.behavioral.mouseSpeed).toBe('fast');
      expect(template.riskLevel).toBe(RISK_LEVELS.LOW);
    });

    test('mobile_simulator should have mobile settings', () => {
      const template = manager.getTemplate('mobile_simulator');
      expect(template.fingerprint.platform).toBe('Android');
      expect(template.browserSettings.viewport).toBeDefined();
      expect(template.browserSettings.viewport.width).toBeLessThan(500);
    });
  });

  // ==========================================
  // Constants Tests
  // ==========================================

  describe('Constants', () => {
    test('should export TEMPLATE_CATEGORIES', () => {
      expect(TEMPLATE_CATEGORIES.OSINT).toBe('osint');
      expect(TEMPLATE_CATEGORIES.TESTING).toBe('testing');
      expect(TEMPLATE_CATEGORIES.SCRAPING).toBe('scraping');
      expect(TEMPLATE_CATEGORIES.STEALTH).toBe('stealth');
    });

    test('should export RISK_LEVELS', () => {
      expect(RISK_LEVELS.LOW).toBe('low');
      expect(RISK_LEVELS.MEDIUM).toBe('medium');
      expect(RISK_LEVELS.HIGH).toBe('high');
      expect(RISK_LEVELS.PARANOID).toBe('paranoid');
    });

    test('should export ACTIVITY_PATTERNS', () => {
      expect(ACTIVITY_PATTERNS.CASUAL).toBe('casual');
      expect(ACTIVITY_PATTERNS.RESEARCHER).toBe('researcher');
      expect(ACTIVITY_PATTERNS.SHOPPER).toBe('shopper');
      expect(ACTIVITY_PATTERNS.AUTOMATED).toBe('automated');
    });
  });

  // ==========================================
  // Profile Generation Tests
  // ==========================================

  describe('Profile Generation', () => {
    let manager;

    beforeEach(() => {
      manager = new ProfileTemplateManager();
    });

    test('should generate complete profile', () => {
      const template = manager.getTemplate('osint_investigator');
      const profile = template.generateProfile();

      expect(profile.templateId).toBe('osint_investigator');
      expect(profile.fingerprint).toBeDefined();
      expect(profile.behavioral).toBeDefined();
      expect(profile.browserSettings).toBeDefined();
      expect(profile.network).toBeDefined();
      expect(profile.activity).toBeDefined();
      expect(profile.metadata).toBeDefined();
    });

    test('should include metadata in generated profile', () => {
      const template = manager.getTemplate('osint_investigator');
      const profile = template.generateProfile();

      expect(profile.metadata.category).toBe(TEMPLATE_CATEGORIES.OSINT);
      expect(profile.metadata.riskLevel).toBe(RISK_LEVELS.MEDIUM);
      expect(profile.metadata.generatedAt).toBeDefined();
    });

    test('should increment usage count on generation', () => {
      const template = manager.getTemplate('osint_investigator');
      const initialCount = template.usageCount;

      template.generateProfile();

      expect(template.usageCount).toBe(initialCount + 1);
    });

    test('should apply customizations to generated profile', () => {
      const template = manager.getTemplate('osint_investigator');
      const profile = template.generateProfile({
        fingerprint: { platform: 'Linux' },
        behavioral: { mouseSpeed: 'fast' }
      });

      expect(profile.fingerprint.platform).toBeDefined();
      expect(profile.behavioral.mouseSpeed).toBeDefined();
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    let manager;

    beforeEach(() => {
      manager = new ProfileTemplateManager();
    });

    test('should handle empty filter', () => {
      const templates = manager.listTemplates({});
      expect(templates.length).toBeGreaterThan(0);
    });

    test('should handle filter with no matches', () => {
      const templates = manager.listTemplates({
        tags: ['nonexistent_tag_12345']
      });
      expect(templates).toEqual([]);
    });

    test('should handle case-insensitive search', () => {
      const lower = manager.searchTemplates('osint');
      const upper = manager.searchTemplates('OSINT');
      const mixed = manager.searchTemplates('OsInT');

      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    test('should handle template with minimal data', () => {
      const minimal = manager.createCustomTemplate({
        name: 'Minimal'
      });

      expect(minimal.id).toBeDefined();
      expect(minimal.category).toBeDefined();
      expect(minimal.riskLevel).toBeDefined();
    });

    test('should handle export/import cycle', () => {
      const original = manager.getTemplate('osint_investigator');
      const exported = manager.exportTemplate(original.id);
      const imported = manager.importTemplate(exported);

      expect(imported.name).toBe(original.name);
      expect(imported.category).toBe(original.category);
      expect(imported.riskLevel).toBe(original.riskLevel);
    });
  });
});
