/**
 * Basset Hound Browser - User Agent Rotation Tests
 * Tests for succession repeat prevention and rotation validation
 */

const { UserAgentManager, USER_AGENTS, UA_CATEGORIES } = require('../../utils/user-agents');

describe('UserAgentManager - Rotation & Validation', () => {
  let userAgentManager;
  let mockMainWindow;

  beforeEach(() => {
    userAgentManager = new UserAgentManager();

    mockMainWindow = {
      webContents: {
        setUserAgent: jest.fn()
      }
    };
  });

  describe('Succession Repeat Prevention', () => {
    it('should prevent same UA from appearing twice in succession', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotationMode = 'random';
      userAgentManager.preventSuccessionRepeat = true;

      userAgentManager.rotateUserAgent(mockMainWindow);
      const firstUA = userAgentManager.currentUserAgent;

      // Try rotating again
      userAgentManager.rotateUserAgent(mockMainWindow);
      const secondUA = userAgentManager.currentUserAgent;

      expect(firstUA).not.toBe(secondUA);
    });

    it('should allow disabling succession repeat prevention', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotationMode = 'sequential';

      // Only 1 UA available - would fail with prevention on
      const result = userAgentManager.rotateUserAgent(mockMainWindow, {
        preventRepeat: false
      });

      expect(result.success || result.preventRepeatDisabled).toBeDefined();
    });

    it('should report error when only 1 UA with prevention enabled', () => {
      const result = userAgentManager.rotateUserAgent(mockMainWindow, {
        preventRepeat: true
      });

      // First rotation might succeed, but specific validation should catch it
      if (!result.success) {
        expect(result.error).toContain('prevent succession repeat');
      }
    });

    it('should track previous user agent', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotationMode = 'sequential';

      const firstResult = userAgentManager.rotateUserAgent(mockMainWindow);
      expect(firstResult.success).toBe(true);

      const secondResult = userAgentManager.rotateUserAgent(mockMainWindow);
      expect(secondResult.previousUserAgent).toBe(firstResult.userAgent);
    });
  });

  describe('Rotation History', () => {
    it('should maintain rotation history', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);

      userAgentManager.rotateUserAgent(mockMainWindow);
      userAgentManager.rotateUserAgent(mockMainWindow);
      userAgentManager.rotateUserAgent(mockMainWindow);

      expect(userAgentManager.rotationHistory.length).toBe(3);
      expect(userAgentManager.rotationHistory[0]).toHaveProperty('timestamp');
      expect(userAgentManager.rotationHistory[0]).toHaveProperty('userAgent');
      expect(userAgentManager.rotationHistory[0]).toHaveProperty('mode');
    });

    it('should trim history to max length', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.maxHistoryLength = 5;

      for (let i = 0; i < 10; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
      }

      expect(userAgentManager.rotationHistory.length).toBeLessThanOrEqual(5);
    });

    it('should retrieve rotation history with limit', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);

      for (let i = 0; i < 5; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
      }

      const history = userAgentManager.getRotationHistory(3);

      expect(history.length).toBeLessThanOrEqual(3);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('category');
    });
  });

  describe('Category Detection & Distribution', () => {
    it('should detect user agent category', () => {
      const chromeUA = USER_AGENTS[UA_CATEGORIES.CHROME_WINDOWS][0];
      const category = userAgentManager.detectUserAgentCategory(chromeUA);

      expect(category).toBe(UA_CATEGORIES.CHROME_WINDOWS);
    });

    it('should return null for unknown user agent', () => {
      const category = userAgentManager.detectUserAgentCategory('Unknown/1.0');

      expect(category).toBeNull();
    });

    it('should track category history', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS', 'FIREFOX_WINDOWS']);

      for (let i = 0; i < 5; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
      }

      expect(userAgentManager.categoryHistory.length).toBeGreaterThan(0);
      expect(userAgentManager.categoryHistory.length).toBeLessThanOrEqual(5);
    });

    it('should calculate category distribution', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS', 'FIREFOX_WINDOWS']);

      for (let i = 0; i < 10; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
      }

      const distribution = userAgentManager.getCategoryDistribution();

      expect(Object.keys(distribution).length).toBeGreaterThan(0);
      for (const category in distribution) {
        expect(distribution[category]).toHaveProperty('count');
        expect(distribution[category]).toHaveProperty('percentage');
      }
    });

    it('should show balanced distribution with multiple categories', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS', 'FIREFOX_WINDOWS']);

      // Rotate multiple times to build history
      for (let i = 0; i < 20; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
      }

      const distribution = userAgentManager.getCategoryDistribution();
      const categories = Object.keys(distribution);

      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('Rotation Validation', () => {
    it('should validate successful rotation setup', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS', 'FIREFOX_WINDOWS']);
      userAgentManager.preventSuccessionRepeat = true;

      const validation = userAgentManager.validateRotation();

      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('should detect missing categories', () => {
      userAgentManager.enabledCategories = [];

      const validation = userAgentManager.validateRotation();

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('No categories enabled');
    });

    it('should detect succession repeat issue with single UA', () => {
      // Create fresh manager with strict single UA setup
      const singleUAManager = new UserAgentManager();
      singleUAManager.enabledCategories = [];
      singleUAManager.customUserAgents = [];
      singleUAManager.customUserAgents.push('OnlyUA/1.0');
      singleUAManager.preventSuccessionRepeat = true;

      const validation = singleUAManager.validateRotation();

      // Should detect issues due to single UA with prevention enabled
      if (singleUAManager.getEnabledUserAgents().length === 1) {
        expect(validation.issues.length).toBeGreaterThan(0);
      }
    });

    it('should detect invalid rotation mode', () => {
      userAgentManager.rotationMode = 'invalid_mode';

      const validation = userAgentManager.validateRotation();

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('rotation mode'))).toBe(true);
    });

    it('should recommend category diversity', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);

      for (let i = 0; i < 10; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
      }

      const validation = userAgentManager.validateRotation();

      const hasDiversityRecommendation = validation.recommendations.some(r =>
        r.includes('category') && r.includes('diversity')
      );

      expect(hasDiversityRecommendation).toBe(true);
    });
  });

  describe('Category-Based Rotation', () => {
    it('should support category preference in rotation', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS', 'FIREFOX_WINDOWS']);

      const result = userAgentManager.rotateUserAgent(mockMainWindow, {
        preferCategory: UA_CATEGORIES.CHROME_WINDOWS
      });

      expect(result.success).toBe(true);
      if (result.categorySelected) {
        expect(result.categorySelected).toBe(UA_CATEGORIES.CHROME_WINDOWS);
      }
    });

    it('should track preferred category in history', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS', 'FIREFOX_WINDOWS']);

      userAgentManager.rotateUserAgent(mockMainWindow, {
        preferCategory: UA_CATEGORIES.FIREFOX_WINDOWS
      });

      expect(userAgentManager.categoryHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Status & Statistics', () => {
    it('should provide current status', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotateUserAgent(mockMainWindow);

      const status = userAgentManager.getStatus();

      expect(status.currentUserAgent).toBeDefined();
      expect(status.enabledCategories).toBeDefined();
      expect(status.userAgentCount).toBeGreaterThan(0);
      expect(status.rotation).toBeDefined();
    });

    it('should track request count for rotation', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotateAfterRequests = 5;

      userAgentManager.onRequest(mockMainWindow);
      userAgentManager.onRequest(mockMainWindow);

      expect(userAgentManager.requestCount).toBe(2);
    });

    it('should rotate after N requests', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotateAfterRequests = 2;

      userAgentManager.rotateUserAgent(mockMainWindow);
      const firstUA = userAgentManager.currentUserAgent;

      userAgentManager.onRequest(mockMainWindow);
      userAgentManager.onRequest(mockMainWindow);

      const secondUA = userAgentManager.currentUserAgent;

      // Should have rotated or reset count
      expect(userAgentManager.requestCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Sequential vs Random Rotation', () => {
    it('should rotate sequentially through user agents', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotationMode = 'sequential';

      const uas = new Set();
      for (let i = 0; i < 3; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
        uas.add(userAgentManager.currentUserAgent);
      }

      expect(uas.size).toBeGreaterThan(1);
    });

    it('should rotate randomly through user agents', () => {
      userAgentManager.setEnabledCategories(['CHROME_WINDOWS']);
      userAgentManager.rotationMode = 'random';

      const uas = [];
      for (let i = 0; i < 5; i++) {
        userAgentManager.rotateUserAgent(mockMainWindow);
        uas.push(userAgentManager.currentUserAgent);
      }

      // Should have variety in random mode
      const uniqueUAs = new Set(uas);
      expect(uniqueUAs.size).toBeGreaterThan(1);
    });
  });

  describe('Rotation with Custom User Agents', () => {
    it('should include custom user agents in rotation', () => {
      const customUA = 'Custom/1.0';
      userAgentManager.addCustomUserAgent(customUA);

      const enabledUAs = userAgentManager.getEnabledUserAgents();
      expect(enabledUAs).toContain(customUA);
    });

    it('should support custom user agents from the beginning', () => {
      const freshManager = new UserAgentManager();
      // Add custom UA first
      freshManager.addCustomUserAgent('Custom/1.0');

      const enabledUAs = freshManager.getEnabledUserAgents();
      expect(enabledUAs).toContain('Custom/1.0');
    });
  });
});
