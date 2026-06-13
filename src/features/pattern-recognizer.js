/**
 * Advanced Pattern Recognition Engine (Wave 16 Phase 6)
 * Automatically detects and identifies website structure patterns,
 * CMS systems, form types, and dynamic content changes.
 *
 * Capabilities:
 * - Website structure pattern detection
 * - CMS system identification (WordPress, Drupal, Joomla, etc.)
 * - Form type recognition (login, contact, search, payment)
 * - Dynamic content change detection
 * - Visual layout pattern matching
 * - Navigation pattern analysis
 *
 * Detection Methods:
 * - DOM analysis (HTML structure, classes, IDs)
 * - HTTP headers analysis (Server, X-Powered-By, etc.)
 * - JavaScript library detection
 * - File/API endpoint patterns
 * - Visual hashing of page layouts
 *
 * @author Wave 16 Team
 * @version 1.0.0
 */

const crypto = require('crypto');

/**
 * CMS Detection Engine
 */
class CMSDetector {
  constructor() {
    this.patterns = {
      wordpress: {
        signatures: [
          '/wp-content/',
          '/wp-includes/',
          '/wp-admin/',
          'wp-settings.php',
          'wp-load.php',
          'wordpress_logged_in',
          'wordpress_nonce'
        ],
        headers: ['X-Powered-By: WordPress'],
        stylesheets: ['/wp-content/themes/'],
        plugins: ['/wp-content/plugins/']
      },
      drupal: {
        signatures: [
          '/sites/default/',
          '/sites/all/modules/',
          '/sites/all/themes/',
          'Drupal.settings',
          'Drupal.behaviors'
        ],
        headers: ['X-Powered-By: Drupal'],
        stylesheets: ['/sites/all/themes/']
      },
      joomla: {
        signatures: [
          '/components/com_',
          '/modules/mod_',
          '/plugins/system/',
          '/administrator/',
          'Joomla.JText'
        ],
        headers: ['X-Powered-By: Joomla'],
        scripts: ['/media/system/js/']
      },
      magento: {
        signatures: [
          '/js/mage/',
          '/skin/frontend/',
          '/app/design/',
          'Magento.Cookie'
        ],
        headers: ['X-Magento-Vary'],
        scripts: ['/js/mage/']
      },
      shopify: {
        signatures: [
          'Shopify.shop',
          '/cdn/shop/',
          '/uploads/',
          'checkout.shopifycs.com'
        ],
        headers: ['X-Shopify-Shop-Id'],
        meta: ['shopify-digital-wallet']
      },
      woocommerce: {
        signatures: [
          '/wp-content/plugins/woocommerce/',
          'woocommerce',
          'wc_add_to_cart'
        ],
        stylesheets: ['/wp-content/plugins/woocommerce/']
      }
    };
  }

  /**
   * Detect CMS system
   */
  detectCMS(pageData) {
    const scores = {};

    for (const [cmsName, cmsPatterns] of Object.entries(this.patterns)) {
      scores[cmsName] = this.calculateCMSScore(pageData, cmsPatterns);
    }

    // Sort by score
    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([cms, score]) => ({ cms, score }));

    return {
      detected: sorted[0].score > 0,
      primary: sorted[0],
      candidates: sorted.slice(0, 3),
      allScores: scores
    };
  }

  /**
   * Calculate CMS detection score
   */
  calculateCMSScore(pageData, patterns) {
    let score = 0;
    const html = pageData.html || '';
    const headers = pageData.headers || {};
    const scripts = pageData.scripts || [];
    const stylesheets = pageData.stylesheets || [];
    const meta = pageData.meta || [];
    const cookies = pageData.cookies || [];

    // Signature matches (highest weight)
    for (const sig of patterns.signatures || []) {
      if (html.includes(sig) || scripts.some(s => s.includes(sig)) || cookies.some(c => c.includes(sig))) {
        score += 10;
      }
    }

    // Header matches
    for (const header of patterns.headers || []) {
      if (Object.values(headers).join(',').includes(header)) {
        score += 15;
      }
    }

    // Stylesheet matches
    for (const sheet of patterns.stylesheets || []) {
      if (stylesheets.some(s => s.includes(sheet))) {
        score += 8;
      }
    }

    // Script matches
    for (const script of patterns.scripts || []) {
      if (scripts.some(s => s.includes(script))) {
        score += 8;
      }
    }

    // Meta tag matches
    for (const metaTag of patterns.meta || []) {
      if (meta.some(m => m.includes(metaTag))) {
        score += 5;
      }
    }

    return score;
  }
}

/**
 * Form Type Detection Engine
 */
class FormTypeDetector {
  constructor() {
    this.formTypes = {
      login: {
        keywords: ['login', 'signin', 'user', 'password', 'authenticate', 'session', 'credentials'],
        fieldPatterns: {
          username: ['username', 'email', 'user', 'login', 'account', 'phone'],
          password: ['password', 'pass', 'pwd', 'secret']
        },
        submitKeywords: ['login', 'signin', 'connect', 'authenticate', 'enter']
      },
      registration: {
        keywords: ['register', 'signup', 'join', 'create', 'account', 'enrollment'],
        fieldPatterns: {
          email: ['email', 'mail'],
          password: ['password', 'pass', 'pwd'],
          confirm: ['confirm', 'verify', 'repeat', 'retype']
        },
        submitKeywords: ['register', 'signup', 'create', 'join']
      },
      contact: {
        keywords: ['contact', 'message', 'inquiry', 'support', 'feedback', 'form'],
        fieldPatterns: {
          name: ['name', 'fullname', 'author'],
          email: ['email', 'address', 'contact'],
          message: ['message', 'comment', 'body', 'text', 'content']
        },
        submitKeywords: ['send', 'submit', 'contact', 'inquiry']
      },
      search: {
        keywords: ['search', 'query', 'find', 'look', 'browse'],
        fieldPatterns: {
          query: ['search', 'query', 'q', 'keywords', 'term']
        },
        submitKeywords: ['search', 'find', 'go', 'query']
      },
      payment: {
        keywords: ['payment', 'checkout', 'purchase', 'billing', 'order', 'cart', 'pay'],
        fieldPatterns: {
          cardNumber: ['card', 'number', 'cc', 'creditcard'],
          cardCVC: ['cvc', 'cvv', 'cvv2', 'security'],
          expiryDate: ['expiry', 'exp', 'expires', 'month', 'year']
        },
        submitKeywords: ['pay', 'checkout', 'purchase', 'submit']
      },
      filter: {
        keywords: ['filter', 'sort', 'refine', 'search', 'criteria'],
        fieldPatterns: {
          category: ['category', 'type', 'class'],
          price: ['price', 'cost', 'amount'],
          date: ['date', 'time', 'range']
        },
        submitKeywords: ['filter', 'apply', 'submit', 'refine']
      }
    };
  }

  /**
   * Detect form type
   */
  detectFormType(formData) {
    const scores = {};

    for (const [formType, patterns] of Object.entries(this.formTypes)) {
      scores[formType] = this.calculateFormScore(formData, patterns);
    }

    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([type, score]) => ({ type, score }));

    return {
      primary: sorted[0],
      candidates: sorted.slice(0, 3),
      allScores: scores,
      confidence: sorted[0].score
    };
  }

  /**
   * Calculate form type detection score
   */
  calculateFormScore(formData, patterns) {
    let score = 0;
    const html = formData.html || '';
    const label = formData.label || '';
    const fields = formData.fields || [];
    const submitText = formData.submitText || '';

    // Keyword matches in form HTML and label
    const combinedText = (html + label + submitText).toLowerCase();
    for (const keyword of patterns.keywords || []) {
      if (combinedText.includes(keyword)) {
        score += 10;
      }
    }

    // Field pattern matches
    for (const [fieldType, fieldKeywords] of Object.entries(patterns.fieldPatterns || {})) {
      for (const field of fields) {
        const fieldName = (field.name + field.id + field.placeholder).toLowerCase();
        for (const keyword of fieldKeywords) {
          if (fieldName.includes(keyword)) {
            score += 5;
          }
        }
      }
    }

    // Submit button keywords
    for (const keyword of patterns.submitKeywords || []) {
      if (submitText.toLowerCase().includes(keyword)) {
        score += 8;
      }
    }

    return score;
  }

  /**
   * Extract form fields
   */
  extractFormFields(formElement) {
    const fields = [];
    const inputs = formElement.querySelectorAll('input, textarea, select');

    for (const input of inputs) {
      const field = {
        name: input.name || '',
        id: input.id || '',
        type: input.type || 'text',
        placeholder: input.placeholder || '',
        required: input.required || false,
        value: input.value || ''
      };

      // Get associated label
      if (input.id) {
        const label = formElement.querySelector(`label[for="${input.id}"]`);
        if (label) {
          field.label = label.textContent;
        }
      }

      fields.push(field);
    }

    return fields;
  }
}

/**
 * Dynamic Content Change Detector
 */
class DynamicContentDetector {
  constructor() {
    this.snapshots = new Map(); // pageId -> snapshot
    this.changeThreshold = 0.15; // 15% change triggers detection
  }

  /**
   * Create page snapshot for comparison
   */
  createSnapshot(pageId, pageData) {
    const snapshot = {
      pageId,
      timestamp: Date.now(),
      contentHash: this.hashContent(pageData.html || ''),
      domStructure: this.extractDOMStructure(pageData.html || ''),
      scripts: pageData.scripts || [],
      stylesheets: pageData.stylesheets || [],
      iframes: pageData.iframes || [],
      images: pageData.images || [],
      links: pageData.links || []
    };

    this.snapshots.set(pageId, snapshot);
    return snapshot;
  }

  /**
   * Detect changes between current state and previous snapshot
   */
  detectChanges(pageId, currentPageData) {
    const previous = this.snapshots.get(pageId);
    if (!previous) {
      // No previous snapshot, create one
      return {
        detected: false,
        reason: 'no-baseline',
        changes: []
      };
    }

    const current = this.createSnapshot(pageId, currentPageData);
    const changes = [];

    // Hash comparison (rough change detection)
    if (current.contentHash !== previous.contentHash) {
      changes.push({
        type: 'content-change',
        severity: this.calculateContentSimilarity(previous.contentHash, current.contentHash) < this.changeThreshold ? 'high' : 'low'
      });
    }

    // DOM structure comparison
    const domDiff = this.compareDOMStructures(previous.domStructure, current.domStructure);
    if (domDiff.differences.length > 0) {
      changes.push({
        type: 'dom-change',
        differences: domDiff.differences,
        severity: domDiff.changePercentage > 0.3 ? 'high' : 'low'
      });
    }

    // Script additions/removals
    const scriptChanges = this.compareArrays(previous.scripts, current.scripts);
    if (scriptChanges.added.length > 0 || scriptChanges.removed.length > 0) {
      changes.push({
        type: 'script-change',
        added: scriptChanges.added,
        removed: scriptChanges.removed
      });
    }

    // Image changes
    const imageChanges = this.compareArrays(previous.images, current.images);
    if (imageChanges.added.length > 0 || imageChanges.removed.length > 0) {
      changes.push({
        type: 'image-change',
        count: imageChanges.added.length + imageChanges.removed.length
      });
    }

    return {
      detected: changes.length > 0,
      changes,
      changePercentage: changes.length > 0 ? (changes.length / 4) * 100 : 0
    };
  }

  /**
   * Hash page content
   */
  hashContent(html) {
    return crypto.createHash('md5').update(html).digest('hex');
  }

  /**
   * Extract DOM structure
   */
  extractDOMStructure(html) {
    // Simple regex-based extraction of major elements
    const structure = {
      headers: (html.match(/<h[1-6]/g) || []).length,
      paragraphs: (html.match(/<p/g) || []).length,
      divs: (html.match(/<div/g) || []).length,
      forms: (html.match(/<form/g) || []).length,
      inputs: (html.match(/<input/g) || []).length,
      buttons: (html.match(/<button/g) || []).length,
      links: (html.match(/<a/g) || []).length,
      images: (html.match(/<img/g) || []).length
    };

    return structure;
  }

  /**
   * Compare two DOM structures
   */
  compareDOMStructures(prev, curr) {
    const differences = [];
    let totalChanges = 0;
    const totalElements = Object.values(prev).reduce((a, b) => a + b, 0);

    for (const [key, prevValue] of Object.entries(prev)) {
      const currValue = curr[key] || 0;
      const change = Math.abs(prevValue - currValue);

      if (change > 0) {
        differences.push({
          element: key,
          before: prevValue,
          after: currValue,
          delta: change
        });
        totalChanges += change;
      }
    }

    return {
      differences,
      changePercentage: totalElements > 0 ? totalChanges / totalElements : 0
    };
  }

  /**
   * Compare arrays for differences
   */
  compareArrays(before, after) {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    return {
      added: Array.from(afterSet).filter(item => !beforeSet.has(item)),
      removed: Array.from(beforeSet).filter(item => !afterSet.has(item)),
      unchanged: Array.from(beforeSet).filter(item => afterSet.has(item))
    };
  }

  /**
   * Calculate similarity between two hashes (rough approximation)
   */
  calculateContentSimilarity(hash1, hash2) {
    const differences = hash1
      .split('')
      .filter((char, idx) => char !== hash2[idx]).length;
    return differences / hash1.length;
  }
}

/**
 * Website Structure Pattern Analyzer
 */
class StructurePatternAnalyzer {
  constructor() {
    this.commonPatterns = {
      ecommerce: {
        indicators: ['product', 'cart', 'checkout', 'price', 'add-to-cart', 'payment'],
        elements: ['product-grid', 'shopping-cart', 'payment-form']
      },
      blog: {
        indicators: ['post', 'article', 'comment', 'author', 'category', 'tag', 'archive'],
        elements: ['post-list', 'article-content', 'sidebar', 'comments']
      },
      social: {
        indicators: ['profile', 'feed', 'post', 'like', 'share', 'follow', 'comment'],
        elements: ['feed-stream', 'user-profile', 'post-card']
      },
      news: {
        indicators: ['article', 'news', 'headline', 'byline', 'publish', 'category'],
        elements: ['article-list', 'featured-article', 'news-grid']
      },
      saas: {
        indicators: ['dashboard', 'app', 'settings', 'user', 'account', 'subscription'],
        elements: ['sidebar-nav', 'dashboard-grid', 'settings-panel']
      }
    };
  }

  /**
   * Identify website pattern type
   */
  identifyPattern(pageData) {
    const scores = {};
    const html = pageData.html || '';
    const classes = pageData.classes || [];

    for (const [patternName, pattern] of Object.entries(this.commonPatterns)) {
      let score = 0;

      // Check indicators
      for (const indicator of pattern.indicators) {
        if (html.toLowerCase().includes(indicator)) {
          score += 5;
        }
      }

      // Check CSS classes
      for (const element of pattern.elements) {
        if (classes.some(c => c.includes(element))) {
          score += 10;
        }
      }

      scores[patternName] = score;
    }

    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([pattern, score]) => ({ pattern, score }));

    return {
      primary: sorted[0],
      candidates: sorted.slice(0, 3)
    };
  }
}

/**
 * Main Pattern Recognition Manager
 */
class PatternRecognitionManager {
  constructor(options = {}) {
    this.cmsDetector = new CMSDetector();
    this.formDetector = new FormTypeDetector();
    this.contentDetector = new DynamicContentDetector();
    this.structureAnalyzer = new StructurePatternAnalyzer();
    this.analysisCache = new Map();
    this.cacheExpiry = options.cacheExpiry || 3600000; // 1 hour
  }

  /**
   * Perform comprehensive pattern analysis on a page
   */
  analyzePagePatterns(pageId, pageData, useCache = true) {
    const cacheKey = crypto.createHash('md5').update(pageId + JSON.stringify(pageData)).digest('hex');

    if (useCache && this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.analysis;
      }
    }

    const analysis = {
      pageId,
      timestamp: Date.now(),
      cms: this.cmsDetector.detectCMS(pageData),
      contentChanges: this.contentDetector.detectChanges(pageId, pageData),
      structure: this.structureAnalyzer.identifyPattern(pageData),
      forms: [],
      summary: {}
    };

    // Detect forms
    if (pageData.forms) {
      for (const form of pageData.forms) {
        const formAnalysis = {
          id: form.id || form.name || 'unknown',
          type: this.formDetector.detectFormType(form),
          fields: this.formDetector.extractFormFields(form)
        };
        analysis.forms.push(formAnalysis);
      }
    }

    // Create summary
    analysis.summary = {
      likelyCMS: analysis.cms.detected ? analysis.cms.primary.cms : 'unknown',
      siteType: analysis.structure.primary.pattern,
      hasLoginForm: analysis.forms.some(f => f.type.primary.type === 'login'),
      formCount: analysis.forms.length,
      isDynamic: analysis.contentChanges.detected
    };

    // Cache result
    this.analysisCache.set(cacheKey, { analysis, timestamp: Date.now() });

    return analysis;
  }

  /**
   * Quick CMS detection
   */
  detectCMS(pageData) {
    return this.cmsDetector.detectCMS(pageData);
  }

  /**
   * Quick form type detection
   */
  detectFormTypes(pageData) {
    if (!pageData.forms) return [];
    return pageData.forms.map(form => this.formDetector.detectFormType(form));
  }

  /**
   * Monitor page for dynamic changes
   */
  monitorForChanges(pageId, pageData) {
    return this.contentDetector.detectChanges(pageId, pageData);
  }

  /**
   * Clear cache
   */
  clearCache(pageId = null) {
    if (pageId) {
      for (const [key, value] of this.analysisCache) {
        if (value.analysis.pageId === pageId) {
          this.analysisCache.delete(key);
        }
      }
    } else {
      this.analysisCache.clear();
    }
    return { success: true };
  }
}

module.exports = {
  PatternRecognitionManager,
  CMSDetector,
  FormTypeDetector,
  DynamicContentDetector,
  StructurePatternAnalyzer
};
