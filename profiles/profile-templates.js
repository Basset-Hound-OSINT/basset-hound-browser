/**
 * Browser Profile Templates - Pre-configured browser profiles for different use cases
 *
 * This module provides ready-to-use browser profile templates that combine
 * fingerprinting, behavioral patterns, and configuration settings for specific scenarios.
 *
 * @module profiles/profile-templates
 */

const { FingerprintProfile } = require('../evasion/fingerprint-profile');
const { BehavioralProfile } = require('../evasion/behavioral-ai');
const crypto = require('crypto');

/**
 * Profile template categories
 */
const TEMPLATE_CATEGORIES = {
  OSINT: 'osint',
  TESTING: 'testing',
  SCRAPING: 'scraping',
  MONITORING: 'monitoring',
  SOCIAL_MEDIA: 'social_media',
  ECOMMERCE: 'ecommerce',
  STEALTH: 'stealth',
  RESEARCH: 'research'
};

/**
 * Risk levels for profiles
 */
const RISK_LEVELS = {
  LOW: 'low',           // Minimal evasion, normal user
  MEDIUM: 'medium',     // Standard evasion
  HIGH: 'high',         // Aggressive evasion
  PARANOID: 'paranoid'  // Maximum evasion
};

/**
 * Activity patterns
 */
const ACTIVITY_PATTERNS = {
  CASUAL: 'casual',           // Slow, exploratory browsing
  RESEARCHER: 'researcher',   // Methodical, note-taking behavior
  SHOPPER: 'shopper',         // Browse products, compare
  NEWS_READER: 'news_reader', // Scan headlines, read articles
  SOCIAL: 'social',           // Social media interactions
  POWER_USER: 'power_user',   // Fast, keyboard shortcuts
  AUTOMATED: 'automated'      // Minimal human-like behavior
};

/**
 * Pre-defined browser profile templates
 */
class ProfileTemplate {
  constructor(data) {
    this.id = data.id || `template_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name;
    this.description = data.description || '';
    this.category = data.category || TEMPLATE_CATEGORIES.OSINT;
    this.riskLevel = data.riskLevel || RISK_LEVELS.MEDIUM;
    this.activityPattern = data.activityPattern || ACTIVITY_PATTERNS.CASUAL;

    // Fingerprint settings
    this.fingerprint = {
      platform: data.fingerprint?.platform || 'Windows',
      region: data.fingerprint?.region || 'US',
      hardwareTier: data.fingerprint?.hardwareTier || 'medium',
      timezone: data.fingerprint?.timezone || null,
      language: data.fingerprint?.language || 'en-US',
      ...data.fingerprint
    };

    // Behavioral settings
    this.behavioral = {
      mouseSpeed: data.behavioral?.mouseSpeed || 'medium',
      typingSpeed: data.behavioral?.typingSpeed || 'medium',
      errorRate: data.behavioral?.errorRate || 0.02,
      pauseFrequency: data.behavioral?.pauseFrequency || 0.15,
      fatigueEnabled: data.behavioral?.fatigueEnabled || true,
      ...data.behavioral
    };

    // Browser settings
    this.browserSettings = {
      userAgent: data.browserSettings?.userAgent || null,
      viewport: data.browserSettings?.viewport || null,
      cookies: data.browserSettings?.cookies || 'enabled',
      javascript: data.browserSettings?.javascript !== false,
      images: data.browserSettings?.images !== false,
      plugins: data.browserSettings?.plugins || [],
      extensions: data.browserSettings?.extensions || [],
      doNotTrack: data.browserSettings?.doNotTrack || false,
      ...data.browserSettings
    };

    // Network settings
    this.network = {
      proxy: data.network?.proxy || null,
      tor: data.network?.tor || false,
      webrtc: data.network?.webrtc || 'enabled',
      dns: data.network?.dns || 'system',
      ...data.network
    };

    // Activity settings
    this.activity = {
      sessionDuration: data.activity?.sessionDuration || { min: 5, max: 30 }, // minutes
      pagesPerSession: data.activity?.pagesPerSession || { min: 5, max: 20 },
      scrollDepth: data.activity?.scrollDepth || { min: 0.3, max: 0.8 },
      interactionRate: data.activity?.interactionRate || 0.3, // clicks per page
      ...data.activity
    };

    // Metadata
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
    this.usageCount = data.usageCount || 0;
  }

  /**
   * Generate a browser profile from this template
   */
  generateProfile(customizations = {}) {
    const profile = {
      templateId: this.id,
      templateName: this.name,

      // Generate fingerprint
      fingerprint: this._generateFingerprint(customizations.fingerprint),

      // Generate behavioral profile
      behavioral: this._generateBehavioral(customizations.behavioral),

      // Apply browser settings
      browserSettings: { ...this.browserSettings, ...customizations.browserSettings },

      // Apply network settings
      network: { ...this.network, ...customizations.network },

      // Apply activity settings
      activity: { ...this.activity, ...customizations.activity },

      metadata: {
        category: this.category,
        riskLevel: this.riskLevel,
        activityPattern: this.activityPattern,
        generatedAt: Date.now()
      }
    };

    return profile;
  }

  /**
   * Generate fingerprint from template settings
   * @private
   */
  _generateFingerprint(customizations = {}) {
    const fpProfile = new FingerprintProfile({
      platform: customizations.platform || this.fingerprint.platform,
      region: customizations.region || this.fingerprint.region,
      hardwareTier: customizations.hardwareTier || this.fingerprint.hardwareTier,
      timezone: customizations.timezone || this.fingerprint.timezone,
      language: customizations.language || this.fingerprint.language
    });

    return fpProfile.config;
  }

  /**
   * Generate behavioral profile from template settings
   * @private
   */
  _generateBehavioral(customizations = {}) {
    const settings = { ...this.behavioral, ...customizations };

    return {
      mouseSpeed: settings.mouseSpeed,
      typingSpeed: settings.typingSpeed,
      errorRate: settings.errorRate,
      pauseFrequency: settings.pauseFrequency,
      fatigueEnabled: settings.fatigueEnabled,
      sessionId: `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    };
  }

  /**
   * Increment usage counter
   */
  recordUsage() {
    this.usageCount++;
    this.updatedAt = Date.now();
  }
}

/**
 * Manager for browser profile templates
 */
class ProfileTemplateManager {
  constructor() {
    this.templates = new Map();
    this._initializeBuiltInTemplates();
  }

  /**
   * Initialize built-in templates
   * @private
   */
  _initializeBuiltInTemplates() {
    // OSINT Investigator - Balanced stealth and functionality
    this.registerTemplate(new ProfileTemplate({
      id: 'osint_investigator',
      name: 'OSINT Investigator',
      description: 'Balanced profile for open-source intelligence gathering',
      category: TEMPLATE_CATEGORIES.OSINT,
      riskLevel: RISK_LEVELS.MEDIUM,
      activityPattern: ACTIVITY_PATTERNS.RESEARCHER,
      fingerprint: {
        platform: 'Windows',
        region: 'US',
        hardwareTier: 'medium'
      },
      behavioral: {
        mouseSpeed: 'medium',
        typingSpeed: 'medium',
        errorRate: 0.02,
        pauseFrequency: 0.2
      },
      browserSettings: {
        doNotTrack: true,
        cookies: 'enabled'
      },
      tags: ['osint', 'investigation', 'balanced']
    }));

    // Stealth Mode - Maximum evasion
    this.registerTemplate(new ProfileTemplate({
      id: 'stealth_mode',
      name: 'Stealth Mode',
      description: 'Maximum evasion for high-risk targets',
      category: TEMPLATE_CATEGORIES.STEALTH,
      riskLevel: RISK_LEVELS.PARANOID,
      activityPattern: ACTIVITY_PATTERNS.CASUAL,
      fingerprint: {
        platform: 'Windows',
        region: 'US',
        hardwareTier: 'high'
      },
      behavioral: {
        mouseSpeed: 'slow',
        typingSpeed: 'slow',
        errorRate: 0.03,
        pauseFrequency: 0.25,
        fatigueEnabled: true
      },
      browserSettings: {
        doNotTrack: true,
        cookies: 'limited'
      },
      network: {
        tor: true,
        webrtc: 'disabled'
      },
      activity: {
        sessionDuration: { min: 10, max: 45 },
        pagesPerSession: { min: 3, max: 10 },
        scrollDepth: { min: 0.4, max: 0.9 }
      },
      tags: ['stealth', 'paranoid', 'tor', 'high-risk']
    }));

    // Web Scraper - Fast and efficient
    this.registerTemplate(new ProfileTemplate({
      id: 'web_scraper',
      name: 'Web Scraper',
      description: 'Optimized for fast data extraction',
      category: TEMPLATE_CATEGORIES.SCRAPING,
      riskLevel: RISK_LEVELS.LOW,
      activityPattern: ACTIVITY_PATTERNS.AUTOMATED,
      fingerprint: {
        platform: 'Linux',
        region: 'US',
        hardwareTier: 'high'
      },
      behavioral: {
        mouseSpeed: 'fast',
        typingSpeed: 'fast',
        errorRate: 0.01,
        pauseFrequency: 0.05
      },
      browserSettings: {
        images: false,
        cookies: 'disabled',
        javascript: true
      },
      activity: {
        sessionDuration: { min: 1, max: 5 },
        pagesPerSession: { min: 20, max: 100 },
        scrollDepth: { min: 0.1, max: 0.3 }
      },
      tags: ['scraping', 'fast', 'automated']
    }));

    // Social Media Monitor - Social platform optimized
    this.registerTemplate(new ProfileTemplate({
      id: 'social_media_monitor',
      name: 'Social Media Monitor',
      description: 'Optimized for social media platforms',
      category: TEMPLATE_CATEGORIES.SOCIAL_MEDIA,
      riskLevel: RISK_LEVELS.MEDIUM,
      activityPattern: ACTIVITY_PATTERNS.SOCIAL,
      fingerprint: {
        platform: 'Windows',
        region: 'US',
        hardwareTier: 'medium'
      },
      behavioral: {
        mouseSpeed: 'medium',
        typingSpeed: 'fast',
        errorRate: 0.02,
        pauseFrequency: 0.15
      },
      browserSettings: {
        cookies: 'enabled',
        javascript: true,
        images: true
      },
      activity: {
        sessionDuration: { min: 15, max: 60 },
        pagesPerSession: { min: 10, max: 50 },
        scrollDepth: { min: 0.5, max: 1.0 },
        interactionRate: 0.4
      },
      tags: ['social-media', 'monitoring', 'interactive']
    }));

    // E-commerce Shopper - Shopping behavior
    this.registerTemplate(new ProfileTemplate({
      id: 'ecommerce_shopper',
      name: 'E-commerce Shopper',
      description: 'Realistic online shopping behavior',
      category: TEMPLATE_CATEGORIES.ECOMMERCE,
      riskLevel: RISK_LEVELS.LOW,
      activityPattern: ACTIVITY_PATTERNS.SHOPPER,
      fingerprint: {
        platform: 'Windows',
        region: 'US',
        hardwareTier: 'medium'
      },
      behavioral: {
        mouseSpeed: 'medium',
        typingSpeed: 'medium',
        errorRate: 0.02,
        pauseFrequency: 0.2
      },
      browserSettings: {
        cookies: 'enabled',
        javascript: true,
        images: true,
        doNotTrack: false
      },
      activity: {
        sessionDuration: { min: 10, max: 30 },
        pagesPerSession: { min: 8, max: 25 },
        scrollDepth: { min: 0.4, max: 0.8 },
        interactionRate: 0.35
      },
      tags: ['ecommerce', 'shopping', 'consumer']
    }));

    // News Reader - Content consumption
    this.registerTemplate(new ProfileTemplate({
      id: 'news_reader',
      name: 'News Reader',
      description: 'Casual news and content browsing',
      category: TEMPLATE_CATEGORIES.RESEARCH,
      riskLevel: RISK_LEVELS.LOW,
      activityPattern: ACTIVITY_PATTERNS.NEWS_READER,
      fingerprint: {
        platform: 'Windows',
        region: 'US',
        hardwareTier: 'medium'
      },
      behavioral: {
        mouseSpeed: 'medium',
        typingSpeed: 'medium',
        errorRate: 0.02,
        pauseFrequency: 0.18
      },
      browserSettings: {
        cookies: 'enabled',
        javascript: true,
        images: true
      },
      activity: {
        sessionDuration: { min: 15, max: 45 },
        pagesPerSession: { min: 5, max: 15 },
        scrollDepth: { min: 0.6, max: 0.95 },
        interactionRate: 0.2
      },
      tags: ['news', 'research', 'reading']
    }));

    // Testing Profile - QA and testing
    this.registerTemplate(new ProfileTemplate({
      id: 'testing_profile',
      name: 'Testing Profile',
      description: 'For web application testing and QA',
      category: TEMPLATE_CATEGORIES.TESTING,
      riskLevel: RISK_LEVELS.LOW,
      activityPattern: ACTIVITY_PATTERNS.POWER_USER,
      fingerprint: {
        platform: 'Windows',
        region: 'US',
        hardwareTier: 'high'
      },
      behavioral: {
        mouseSpeed: 'fast',
        typingSpeed: 'fast',
        errorRate: 0.01,
        pauseFrequency: 0.1
      },
      browserSettings: {
        cookies: 'enabled',
        javascript: true,
        images: true
      },
      activity: {
        sessionDuration: { min: 5, max: 20 },
        pagesPerSession: { min: 10, max: 30 },
        scrollDepth: { min: 0.3, max: 0.7 },
        interactionRate: 0.5
      },
      tags: ['testing', 'qa', 'development']
    }));

    // Mobile Simulator - Mobile device behavior
    this.registerTemplate(new ProfileTemplate({
      id: 'mobile_simulator',
      name: 'Mobile Simulator',
      description: 'Simulate mobile device browsing',
      category: TEMPLATE_CATEGORIES.TESTING,
      riskLevel: RISK_LEVELS.LOW,
      activityPattern: ACTIVITY_PATTERNS.CASUAL,
      fingerprint: {
        platform: 'Android',
        region: 'US',
        hardwareTier: 'medium'
      },
      behavioral: {
        mouseSpeed: 'medium',
        typingSpeed: 'slow',
        errorRate: 0.03,
        pauseFrequency: 0.2
      },
      browserSettings: {
        viewport: { width: 375, height: 812 },
        cookies: 'enabled',
        javascript: true
      },
      activity: {
        sessionDuration: { min: 5, max: 15 },
        pagesPerSession: { min: 3, max: 10 },
        scrollDepth: { min: 0.5, max: 1.0 }
      },
      tags: ['mobile', 'testing', 'android']
    }));
  }

  /**
   * Register a new template
   */
  registerTemplate(template) {
    if (!(template instanceof ProfileTemplate)) {
      throw new Error('Template must be instance of ProfileTemplate');
    }
    this.templates.set(template.id, template);
    return template;
  }

  /**
   * Get template by ID
   */
  getTemplate(id) {
    return this.templates.get(id);
  }

  /**
   * List all templates
   */
  listTemplates(filter = {}) {
    let templates = Array.from(this.templates.values());

    // Filter by category
    if (filter.category) {
      templates = templates.filter(t => t.category === filter.category);
    }

    // Filter by risk level
    if (filter.riskLevel) {
      templates = templates.filter(t => t.riskLevel === filter.riskLevel);
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      templates = templates.filter(t =>
        filter.tags.some(tag => t.tags.includes(tag))
      );
    }

    // Sort by usage
    if (filter.sortBy === 'usage') {
      templates.sort((a, b) => b.usageCount - a.usageCount);
    } else if (filter.sortBy === 'name') {
      templates.sort((a, b) => a.name.localeCompare(b.name));
    }

    return templates;
  }

  /**
   * Search templates
   */
  searchTemplates(query) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Delete template
   */
  deleteTemplate(id) {
    return this.templates.delete(id);
  }

  /**
   * Create custom template
   */
  createCustomTemplate(data) {
    const template = new ProfileTemplate(data);
    this.registerTemplate(template);
    return template;
  }

  /**
   * Clone template with modifications
   */
  cloneTemplate(id, modifications = {}) {
    const original = this.getTemplate(id);
    if (!original) {
      throw new Error(`Template not found: ${id}`);
    }

    const clonedData = {
      name: modifications.name || `${original.name} (Copy)`,
      description: modifications.description || original.description,
      category: modifications.category || original.category,
      riskLevel: modifications.riskLevel || original.riskLevel,
      activityPattern: modifications.activityPattern || original.activityPattern,
      fingerprint: { ...original.fingerprint, ...modifications.fingerprint },
      behavioral: { ...original.behavioral, ...modifications.behavioral },
      browserSettings: { ...original.browserSettings, ...modifications.browserSettings },
      network: { ...original.network, ...modifications.network },
      activity: { ...original.activity, ...modifications.activity },
      tags: modifications.tags || [...original.tags, 'custom']
    };

    return this.createCustomTemplate(clonedData);
  }

  /**
   * Export template
   */
  exportTemplate(id) {
    const template = this.getTemplate(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      riskLevel: template.riskLevel,
      activityPattern: template.activityPattern,
      fingerprint: template.fingerprint,
      behavioral: template.behavioral,
      browserSettings: template.browserSettings,
      network: template.network,
      activity: template.activity,
      tags: template.tags,
      createdAt: template.createdAt,
      usageCount: template.usageCount
    };
  }

  /**
   * Import template
   */
  importTemplate(data) {
    return this.createCustomTemplate(data);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const templates = Array.from(this.templates.values());

    return {
      totalTemplates: templates.length,
      byCategory: this._countBy(templates, 'category'),
      byRiskLevel: this._countBy(templates, 'riskLevel'),
      byActivityPattern: this._countBy(templates, 'activityPattern'),
      mostUsed: templates
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5)
        .map(t => ({ id: t.id, name: t.name, usageCount: t.usageCount })),
      allTags: [...new Set(templates.flatMap(t => t.tags))].sort()
    };
  }

  /**
   * Count templates by property
   * @private
   */
  _countBy(templates, property) {
    return templates.reduce((acc, t) => {
      const value = t[property];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}

module.exports = {
  ProfileTemplate,
  ProfileTemplateManager,
  TEMPLATE_CATEGORIES,
  RISK_LEVELS,
  ACTIVITY_PATTERNS
};
