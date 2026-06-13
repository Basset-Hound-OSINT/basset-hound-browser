/**
 * Tests for Advanced Pattern Recognition Engine (Wave 16 Phase 6)
 * Tests CMS detection, form type recognition, dynamic content detection, and structure analysis.
 */

const {
  PatternRecognitionManager,
  CMSDetector,
  FormTypeDetector,
  DynamicContentDetector,
  StructurePatternAnalyzer
} = require('../../src/features/pattern-recognizer');

describe('Pattern Recognition Engine - Wave 16 Phase 6', () => {
  // ==========================================
  // CMS DETECTION
  // ==========================================

  describe('CMS Detector', () => {
    let detector;

    beforeEach(() => {
      detector = new CMSDetector();
    });

    test('should detect WordPress sites', () => {
      const pageData = {
        html: `
          <link rel="stylesheet" href="/wp-content/themes/theme/style.css">
          <script src="/wp-includes/js/jquery.js"></script>
        `,
        headers: { 'X-Powered-By': 'WordPress' },
        scripts: ['/wp-includes/js/script.js'],
        cookies: ['wordpress_logged_in=abc123']
      };

      const result = detector.detectCMS(pageData);

      expect(result.detected).toBe(true);
      expect(result.primary.cms).toBe('wordpress');
      expect(result.primary.score).toBeGreaterThan(0);
    });

    test('should detect Drupal sites', () => {
      const pageData = {
        html: `
          <link rel="stylesheet" href="/sites/all/themes/theme/style.css">
          <script>if(typeof Drupal !== "undefined") {}</script>
        `,
        headers: { 'X-Powered-By': 'Drupal' },
        scripts: ['/sites/all/modules/module.js']
      };

      const result = detector.detectCMS(pageData);

      expect(result.detected).toBe(true);
      expect(result.primary.cms).toBe('drupal');
    });

    test('should detect Shopify stores', () => {
      const pageData = {
        html: `
          <div id="shopify-digital-wallet"></div>
          <script>Shopify.shop = "mystore.myshopify.com";</script>
        `,
        headers: { 'X-Shopify-Shop-Id': '123456' },
        meta: ['shopify-digital-wallet']
      };

      const result = detector.detectCMS(pageData);

      expect(result.detected).toBe(true);
      expect(result.candidates.some(c => c.cms === 'shopify')).toBe(true);
    });

    test('should handle unknown CMS', () => {
      const pageData = {
        html: '<html><body>Unknown site</body></html>',
        headers: {},
        scripts: []
      };

      const result = detector.detectCMS(pageData);

      expect(result.detected).toBe(false);
    });

    test('should rank CMS candidates by score', () => {
      const pageData = {
        html: `
          <link href="/wp-content/themes/theme.css">
          <script src="/wp-includes/js/jquery.js"></script>
        `,
        headers: { 'X-Powered-By': 'WordPress' },
        scripts: ['/wp-includes/script.js']
      };

      const result = detector.detectCMS(pageData);

      expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score);
    });
  });

  // ==========================================
  // FORM TYPE DETECTION
  // ==========================================

  describe('Form Type Detector', () => {
    let detector;

    beforeEach(() => {
      detector = new FormTypeDetector();
    });

    test('should detect login forms', () => {
      const formData = {
        html: '<form id="login-form">',
        label: 'Sign in',
        fields: [
          { name: 'username', type: 'text', label: 'Username' },
          { name: 'password', type: 'password', label: 'Password' }
        ],
        submitText: 'Login'
      };

      const result = detector.detectFormType(formData);

      expect(result.primary.type).toBe('login');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should detect registration forms', () => {
      const formData = {
        html: '<form id="signup-form">',
        label: 'Create Account',
        fields: [
          { name: 'email', type: 'email' },
          { name: 'password', type: 'password' },
          { name: 'confirm_password', type: 'password' }
        ],
        submitText: 'Register'
      };

      const result = detector.detectFormType(formData);

      expect(result.primary.type).toBe('registration');
    });

    test('should detect contact forms', () => {
      const formData = {
        html: '<form>',
        label: 'Contact Us',
        fields: [
          { name: 'name', type: 'text' },
          { name: 'email', type: 'email' },
          { name: 'message', type: 'textarea' }
        ],
        submitText: 'Send Message'
      };

      const result = detector.detectFormType(formData);

      expect(result.primary.type).toBe('contact');
    });

    test('should detect payment forms', () => {
      const formData = {
        html: '<form class="payment">',
        label: 'Checkout',
        fields: [
          { name: 'card_number', type: 'text' },
          { name: 'card_cvc', type: 'text' },
          { name: 'expiry_date', type: 'text' }
        ],
        submitText: 'Pay Now'
      };

      const result = detector.detectFormType(formData);

      expect(result.primary.type).toBe('payment');
    });

    test('should extract form fields correctly', () => {
      const mockForm = {
        querySelectorAll: () => [
          {
            name: 'email',
            id: 'email-field',
            type: 'email',
            placeholder: 'Enter email',
            required: true,
            value: ''
          },
          {
            name: 'password',
            id: 'password-field',
            type: 'password',
            placeholder: 'Enter password',
            required: true,
            value: ''
          }
        ],
        querySelector: () => null
      };

      const fields = detector.extractFormFields(mockForm);

      expect(fields.length).toBe(2);
      expect(fields[0].name).toBe('email');
      expect(fields[0].type).toBe('email');
      expect(fields[1].name).toBe('password');
    });

    test('should provide multiple form type candidates', () => {
      const formData = {
        html: '<form>',
        label: 'Search',
        fields: [{ name: 'q', type: 'text' }],
        submitText: 'Search'
      };

      const result = detector.detectFormType(formData);

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].type).toBe('search');
    });
  });

  // ==========================================
  // DYNAMIC CONTENT DETECTION
  // ==========================================

  describe('Dynamic Content Detector', () => {
    let detector;

    beforeEach(() => {
      detector = new DynamicContentDetector();
    });

    test('should create page snapshot', () => {
      const pageData = {
        html: '<html><body><h1>Test</h1><p>Content</p></body></html>',
        scripts: ['/js/app.js'],
        stylesheets: ['/css/style.css'],
        iframes: [],
        images: ['/img/test.jpg'],
        links: []
      };

      const snapshot = detector.createSnapshot('page-001', pageData);

      expect(snapshot.pageId).toBe('page-001');
      expect(snapshot.contentHash).toBeDefined();
      expect(snapshot.domStructure).toBeDefined();
      expect(snapshot.scripts.length).toBe(1);
    });

    test('should detect content changes', () => {
      const originalData = {
        html: '<html><body><h1>Title</h1></body></html>',
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      const updatedData = {
        html: '<html><body><h1>Title</h1><p>New content</p></body></html>',
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      detector.createSnapshot('page-001', originalData);
      const changes = detector.detectChanges('page-001', updatedData);

      expect(changes.detected).toBe(true);
      expect(changes.changes.length).toBeGreaterThan(0);
    });

    test('should detect script additions', () => {
      const originalData = {
        html: '<html></html>',
        scripts: ['/js/app.js'],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      const updatedData = {
        html: '<html></html>',
        scripts: ['/js/app.js', '/js/tracking.js'],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      detector.createSnapshot('page-001', originalData);
      const changes = detector.detectChanges('page-001', updatedData);

      expect(changes.detected).toBe(true);
      const scriptChange = changes.changes.find(c => c.type === 'script-change');
      expect(scriptChange).toBeDefined();
      expect(scriptChange.added.length).toBeGreaterThan(0);
    });

    test('should detect DOM structure changes', () => {
      const originalData = {
        html: '<html><body><h1>Title</h1></body></html>',
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      const updatedData = {
        html: '<html><body><h1>Title</h1><p>Para</p><p>Para</p><p>Para</p></body></html>',
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      detector.createSnapshot('page-001', originalData);
      const changes = detector.detectChanges('page-001', updatedData);

      expect(changes.detected).toBe(true);
      const domChange = changes.changes.find(c => c.type === 'dom-change');
      expect(domChange).toBeDefined();
    });

    test('should handle pages with no baseline', () => {
      const pageData = {
        html: '<html></html>',
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: []
      };

      const changes = detector.detectChanges('new-page', pageData);

      expect(changes.detected).toBe(false);
      expect(changes.reason).toBe('no-baseline');
    });
  });

  // ==========================================
  // STRUCTURE PATTERN ANALYZER
  // ==========================================

  describe('Structure Pattern Analyzer', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new StructurePatternAnalyzer();
    });

    test('should identify e-commerce sites', () => {
      const pageData = {
        html: `
          <div class="product-grid">
            <div class="product-card">
              <span class="price">$99.99</span>
              <button class="add-to-cart">Add</button>
            </div>
          </div>
        `,
        classes: ['product-grid', 'shopping-cart', 'checkout-form']
      };

      const result = analyzer.identifyPattern(pageData);

      expect(result.primary.pattern).toBe('ecommerce');
    });

    test('should identify blog sites', () => {
      const pageData = {
        html: `
          <article class="post">
            <h1>Article Title</h1>
            <div class="comments">Comments here</div>
          </article>
        `,
        classes: ['post-list', 'article-content', 'sidebar']
      };

      const result = analyzer.identifyPattern(pageData);

      expect(result.primary.pattern).toBe('blog');
    });

    test('should identify SaaS applications', () => {
      const pageData = {
        html: `
          <div class="dashboard-grid">
            <div class="sidebar-nav">Navigation</div>
            <div class="settings-panel">Settings</div>
          </div>
        `,
        classes: ['sidebar-nav', 'dashboard-grid', 'settings-panel']
      };

      const result = analyzer.identifyPattern(pageData);

      expect(result.primary.pattern).toBe('saas');
    });

    test('should identify social media sites', () => {
      const pageData = {
        html: `
          <div class="feed-stream">
            <div class="user-profile">Profile</div>
            <div class="post-card">Post content</div>
          </div>
        `,
        classes: ['feed-stream', 'user-profile', 'post-card']
      };

      const result = analyzer.identifyPattern(pageData);

      expect(result.primary.pattern).toBe('social');
    });

    test('should provide pattern candidates', () => {
      const pageData = {
        html: '<html></html>',
        classes: []
      };

      const result = analyzer.identifyPattern(pageData);

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].pattern).toBeDefined();
    });
  });

  // ==========================================
  // PATTERN RECOGNITION MANAGER
  // ==========================================

  describe('Pattern Recognition Manager', () => {
    let manager;

    beforeEach(() => {
      manager = new PatternRecognitionManager();
    });

    test('should perform comprehensive page analysis', () => {
      const pageData = {
        html: `
          <html>
            <link rel="stylesheet" href="/wp-content/themes/theme.css">
            <form id="login">
              <input name="username" type="text">
              <input name="password" type="password">
              <button>Login</button>
            </form>
          </html>
        `,
        classes: [],
        headers: { 'X-Powered-By': 'WordPress' },
        scripts: ['/wp-includes/js/jquery.js'],
        stylesheets: ['/wp-content/themes/style.css'],
        iframes: [],
        images: [],
        links: [],
        cookies: [],
        forms: []
      };

      const result = manager.analyzePagePatterns('page-001', pageData);

      expect(result.pageId).toBe('page-001');
      expect(result.cms.detected).toBe(true);
      expect(Array.isArray(result.forms)).toBe(true);
      expect(result.summary).toBeDefined();
    });

    test('should cache analysis results', () => {
      const pageData = {
        html: '<html></html>',
        headers: {},
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: [],
        cookies: [],
        forms: []
      };

      const result1 = manager.analyzePagePatterns('page-001', pageData, true);
      const result2 = manager.analyzePagePatterns('page-001', pageData, true);

      expect(result1).toEqual(result2);
    });

    test('should clear cache', () => {
      const pageData = {
        html: '<html></html>',
        headers: {},
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: [],
        cookies: [],
        forms: []
      };

      manager.analyzePagePatterns('page-001', pageData);
      const clearResult = manager.clearCache('page-001');

      expect(clearResult.success).toBe(true);
    });

    test('should detect form types in analysis', () => {
      const pageData = {
        html: `<html></html>`,
        headers: {},
        scripts: [],
        stylesheets: [],
        iframes: [],
        images: [],
        links: [],
        cookies: [],
        forms: []
      };

      const result = manager.analyzePagePatterns('page-001', pageData);

      expect(Array.isArray(result.forms)).toBe(true);
      expect(result.summary).toBeDefined();
    });

    test('should create summary with findings', () => {
      const pageData = {
        html: `
          <html>
            <link rel="stylesheet" href="/wp-content/themes/theme.css">
            <script src="/wp-includes/js/jquery.js"></script>
            <form id="login">
              <input name="username">
              <input name="password" type="password">
            </form>
          </html>
        `,
        headers: { 'X-Powered-By': 'WordPress' },
        scripts: ['/wp-includes/js/jquery.js'],
        stylesheets: ['/wp-content/themes/theme.css'],
        iframes: [],
        images: [],
        links: [],
        cookies: [],
        forms: []
      };

      const result = manager.analyzePagePatterns('page-001', pageData);

      expect(result.summary.likelyCMS).toBe('wordpress');
      expect(result.summary).toBeDefined();
      expect(result.summary.formCount).toBe(0);
    });
  });
});
