/**
 * Contextual Help System
 *
 * Provides context-aware help suggestions, inline help for features,
 * video tutorials, documentation search, and support integration.
 */

const EventEmitter = require('events');

class HelpSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.helpArticles = new Map();
    this.videoLinks = new Map();
    this.faqs = [];
    this.supportChannels = new Map();
    this.helpHistory = [];
    this.contextStack = [];
    this.initializeHelp();
  }

  /**
   * Initialize built-in help articles
   */
  initializeHelp() {
    const articles = [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        category: 'dashboard',
        context: ['dashboard-main'],
        content: `
The dashboard is your central hub for monitoring competitors and tracking website changes.
It displays:
- Summary widgets showing monitor status
- Recent alerts and changes
- Performance metrics
- Quick access to all features
        `,
        keyPoints: [
          'Use the left sidebar to navigate',
          'Customize widgets by clicking settings',
          'Set your preferred auto-refresh rate',
          'Search monitors using the search bar'
        ],
        videoUrl: 'https://example.com/video/dashboard-101',
        relatedArticles: ['widget-customization', 'monitor-overview'],
        difficulty: 'beginner'
      },
      {
        id: 'monitor-creation',
        title: 'Creating a Monitor',
        category: 'monitoring',
        context: ['monitor-form', 'add-monitor-button'],
        content: `
A monitor watches a specific URL and alerts you when changes are detected.

Steps to create a monitor:
1. Click "Add Monitor" button
2. Enter the URL to monitor
3. Choose detection type (visual, text, or element)
4. Set check frequency
5. Configure notifications
6. Test your monitor
        `,
        keyPoints: [
          'One monitor per target URL',
          'Start with daily checks',
          'Use element selection for specific parts of a page',
          'Test notifications before deploying'
        ],
        videoUrl: 'https://example.com/video/create-monitor',
        relatedArticles: ['detection-types', 'notification-setup'],
        difficulty: 'beginner'
      },
      {
        id: 'proxy-configuration',
        title: 'Setting Up Proxies',
        category: 'network',
        context: ['proxy-settings', 'proxy-form'],
        content: `
Proxies route your requests through intermediary servers for privacy and access control.

Proxy Types:
- HTTP: Standard web proxy
- SOCKS5: Works with any protocol
- Tor: Maximum anonymity
- Residential: Mimics real residential IPs
        `,
        keyPoints: [
          'HTTP proxies are fastest for web traffic',
          'SOCKS5 works with all protocols',
          'Residential proxies best for evasion',
          'Always test proxy connection'
        ],
        videoUrl: 'https://example.com/video/proxy-setup',
        relatedArticles: ['proxy-testing', 'proxy-rotation'],
        difficulty: 'intermediate'
      },
      {
        id: 'slack-integration',
        title: 'Slack Integration',
        category: 'integrations',
        context: ['slack-settings', 'slack-webhook'],
        content: `
Connect Slack to receive real-time notifications directly in your workspace.

Setup Steps:
1. Create a Slack App at api.slack.com
2. Generate an incoming webhook
3. Copy the webhook URL
4. Paste it into your settings
5. Configure notification types
        `,
        keyPoints: [
          'Incoming webhooks are easiest to set up',
          'Test the connection before saving',
          'You can add multiple webhook URLs',
          'Customize which events trigger notifications'
        ],
        videoUrl: 'https://example.com/video/slack-setup',
        relatedArticles: ['notification-settings'],
        difficulty: 'beginner'
      },
      {
        id: 'detection-types',
        title: 'Monitor Detection Types',
        category: 'monitoring',
        context: ['detection-type-selector'],
        content: `
Different detection methods for different use cases:

Visual Detection: Detects pixel-level changes in screenshots
- Best for: Visual layouts, images, styling changes
- Performance: Medium, more CPU intensive

Text Detection: Detects changes in page text content
- Best for: Price changes, content updates
- Performance: Fast, low resource usage

Element Detection: Monitors specific HTML elements
- Best for: Precise monitoring of form fields, status indicators
- Performance: Fast, very low resource usage
        `,
        keyPoints: [
          'Start with visual detection for general monitoring',
          'Use text detection for performance-critical monitors',
          'Use element detection for precise monitoring'
        ],
        videoUrl: 'https://example.com/video/detection-types',
        difficulty: 'intermediate'
      },
      {
        id: 'alerts-and-notifications',
        title: 'Managing Alerts',
        category: 'alerts',
        context: ['alerts-panel', 'alert-settings'],
        content: `
Alerts notify you when your monitors detect changes.

Alert Features:
- Real-time notifications
- Multiple notification channels (email, Slack, SMS)
- Alert severity levels
- Acknowledgment tracking
- Alert history and analytics
        `,
        keyPoints: [
          'Configure notification preferences per monitor',
          'Set alert severity levels',
          'Use Slack for team notifications',
          'Set quiet hours to reduce interruptions'
        ],
        videoUrl: 'https://example.com/video/alerts',
        relatedArticles: ['slack-integration', 'notification-settings'],
        difficulty: 'beginner'
      },
      {
        id: 'advanced-selectors',
        title: 'Advanced: CSS & XPath Selectors',
        category: 'advanced',
        context: ['element-selector-advanced'],
        content: `
Use CSS selectors and XPath expressions for precise element monitoring.

CSS Selectors:
- #id → Select by ID
- .class → Select by class
- div > p → Direct child
- div p → Any descendant

XPath:
- //div[@id='main'] → By attribute
- //button[contains(text(), 'Buy')] → By partial text
        `,
        keyPoints: [
          'Test selectors in browser dev tools first',
          'Keep selectors as simple as possible',
          'Document complex selectors',
          'Update selectors when page structure changes'
        ],
        difficulty: 'advanced'
      },
      {
        id: 'performance-optimization',
        title: 'Optimizing Performance',
        category: 'advanced',
        context: ['settings-performance'],
        content: `
Tips for optimizing monitoring performance:

Check Frequency:
- Hourly: For active changes
- Daily: For most use cases
- Weekly: For stable content

Resource Usage:
- Visual detection uses more CPU
- Text detection is lightweight
- Element detection is fastest

Scaling:
- Limit concurrent monitors
- Space out check times
- Use batch operations
        `,
        keyPoints: [
          'Start conservative with frequency',
          'Monitor system resources',
          'Batch similar monitors together',
          'Use compression for large pages'
        ],
        difficulty: 'advanced'
      }
    ];

    for (const article of articles) {
      this.helpArticles.set(article.id, article);
    }

    this.initializeVideoLinks();
    this.initializeFAQs();
    this.initializeSupportChannels();
  }

  /**
   * Initialize video tutorial links
   */
  initializeVideoLinks() {
    const videos = [
      {
        id: 'video-dashboard-101',
        title: 'Dashboard 101: Getting Started',
        url: 'https://example.com/video/dashboard-101',
        duration: 480,
        category: 'dashboard'
      },
      {
        id: 'video-create-monitor',
        title: 'Creating Your First Monitor',
        url: 'https://example.com/video/create-monitor',
        duration: 600,
        category: 'monitoring'
      },
      {
        id: 'video-proxy-setup',
        title: 'Complete Proxy Setup Guide',
        url: 'https://example.com/video/proxy-setup',
        duration: 720,
        category: 'network'
      },
      {
        id: 'video-slack-integration',
        title: 'Slack Integration Tutorial',
        url: 'https://example.com/video/slack-setup',
        duration: 480,
        category: 'integrations'
      },
      {
        id: 'video-detection-types',
        title: 'Understanding Detection Types',
        url: 'https://example.com/video/detection-types',
        duration: 540,
        category: 'monitoring'
      }
    ];

    for (const video of videos) {
      this.videoLinks.set(video.id, video);
    }
  }

  /**
   * Initialize FAQ
   */
  initializeFAQs() {
    this.faqs = [
      {
        id: 'faq-1',
        question: 'How often should I check for changes?',
        answer: `It depends on your use case. For actively changing content (e-commerce prices),
use hourly checks. For mostly static content, daily checks are usually sufficient. Start with a
conservative frequency and adjust based on results.`,
        category: 'monitoring',
        votes: 45
      },
      {
        id: 'faq-2',
        question: 'Why is my monitor showing false positives?',
        answer: `Common causes include: dynamic content (ads, timestamps), animated elements,
or overly sensitive settings. Try using element-specific monitoring or adjusting your detection
sensitivity. Visual detection is more prone to false positives than text detection.`,
        category: 'troubleshooting',
        votes: 38
      },
      {
        id: 'faq-3',
        question: 'Can I monitor through a proxy?',
        answer: `Yes! Configure proxies in your settings. You can use HTTP, SOCKS5, Tor, or
residential proxies. Test your proxy connection before deploying monitors. Different proxy types
have different speed and anonymity trade-offs.`,
        category: 'network',
        votes: 32
      },
      {
        id: 'faq-4',
        question: 'How do I set up Slack notifications?',
        answer: `Create an incoming webhook at api.slack.com, copy the webhook URL, and paste
it into your settings. Then configure which events should trigger notifications. Send a test
message to verify everything is working.`,
        category: 'integrations',
        votes: 28
      },
      {
        id: 'faq-5',
        question: 'What data is stored about detected changes?',
        answer: `We store screenshots, text extracts, metadata, and a hash of the page content.
You can export this data at any time. All data is encrypted in transit and at rest.`,
        category: 'privacy',
        votes: 25
      },
      {
        id: 'faq-6',
        question: 'Can I monitor multiple URLs?',
        answer: `Yes, create a separate monitor for each URL you want to track. You can organize
them using tags and categories, and group them together for easier management.`,
        category: 'monitoring',
        votes: 22
      },
      {
        id: 'faq-7',
        question: 'How accurate is change detection?',
        answer: `Detection accuracy depends on your detection type and sensitivity settings.
Visual detection is 85-95% accurate, text detection is 95-99% accurate, and element detection
is 99%+ accurate. Test your setup to validate accuracy for your specific use case.`,
        category: 'monitoring',
        votes: 20
      },
      {
        id: 'faq-8',
        question: 'What should I do if my IP gets blocked?',
        answer: `Use a residential proxy to appear as a regular user. If blocks persist, try rotating
your IP (if using a proxy pool), increasing time between checks, or switching to a different proxy provider.`,
        category: 'troubleshooting',
        votes: 18
      }
    ];
  }

  /**
   * Initialize support channels
   */
  initializeSupportChannels() {
    this.supportChannels.set('email', {
      name: 'Email Support',
      address: 'support@example.com',
      responseTime: '24 hours',
      available: true
    });

    this.supportChannels.set('chat', {
      name: 'Live Chat',
      url: 'https://example.com/chat',
      hoursOfOperation: '9 AM - 6 PM EST',
      available: true
    });

    this.supportChannels.set('tickets', {
      name: 'Support Tickets',
      url: 'https://support.example.com',
      responseTime: '12 hours',
      available: true
    });

    this.supportChannels.set('community', {
      name: 'Community Forum',
      url: 'https://community.example.com',
      responseTime: 'Varies',
      available: true
    });
  }

  /**
   * Get help for current context
   */
  getContextualHelp(context) {
    const contextHelp = [];

    // Find articles matching current context
    for (const article of this.helpArticles.values()) {
      if (article.context.includes(context)) {
        contextHelp.push(article);
      }
    }

    return {
      context,
      articles: contextHelp,
      suggestedArticles: this.getSuggestedArticles(context),
      relatedVideos: this.getRelatedVideos(contextHelp)
    };
  }

  /**
   * Get suggested articles
   */
  getSuggestedArticles(context) {
    // Map context to commonly used article chains
    const suggestions = {
      'new-user': [
        this.helpArticles.get('dashboard-overview'),
        this.helpArticles.get('monitor-creation'),
        this.helpArticles.get('alerts-and-notifications')
      ],
      'monitoring': [
        this.helpArticles.get('monitor-creation'),
        this.helpArticles.get('detection-types'),
        this.helpArticles.get('alerts-and-notifications')
      ],
      'network': [
        this.helpArticles.get('proxy-configuration'),
        this.helpArticles.get('performance-optimization')
      ],
      'integration': [
        this.helpArticles.get('slack-integration'),
        this.helpArticles.get('alerts-and-notifications')
      ]
    };

    return suggestions[context] || [];
  }

  /**
   * Get related videos
   */
  getRelatedVideos(articles) {
    const videos = [];
    const categories = new Set(articles.map(a => a.category));

    for (const video of this.videoLinks.values()) {
      if (categories.has(video.category)) {
        videos.push(video);
      }
    }

    return videos;
  }

  /**
   * Search help articles
   */
  searchHelp(query) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const article of this.helpArticles.values()) {
      const score = this.calculateRelevanceScore(article, queryLower);
      if (score > 0) {
        results.push({
          ...article,
          relevanceScore: score
        });
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    this.helpHistory.push({
      query,
      resultCount: results.length,
      timestamp: new Date().toISOString()
    });

    return results;
  }

  /**
   * Calculate relevance score for search
   */
  calculateRelevanceScore(article, query) {
    let score = 0;

    // Exact match in title
    if (article.title.toLowerCase().includes(query)) {
      score += 100;
    }

    // Word match in title
    if (
      article.title
        .toLowerCase()
        .split(' ')
        .some(word => word.includes(query))
    ) {
      score += 50;
    }

    // Match in content
    if (article.content.toLowerCase().includes(query)) {
      score += 25;
    }

    // Match in key points
    if (article.keyPoints && article.keyPoints.some(kp => kp.toLowerCase().includes(query))) {
      score += 40;
    }

    // Category match
    if (article.category.toLowerCase().includes(query)) {
      score += 15;
    }

    return score;
  }

  /**
   * Get article by ID
   */
  getArticle(articleId) {
    return this.helpArticles.get(articleId);
  }

  /**
   * Get articles by category
   */
  getArticlesByCategory(category) {
    return Array.from(this.helpArticles.values()).filter(a => a.category === category);
  }

  /**
   * Get all articles
   */
  getAllArticles() {
    return Array.from(this.helpArticles.values());
  }

  /**
   * Get FAQ
   */
  getFAQ(limit = 10) {
    // Sort by votes (most helpful first)
    return this.faqs.sort((a, b) => b.votes - a.votes).slice(0, limit);
  }

  /**
   * Search FAQ
   */
  searchFAQ(query) {
    const queryLower = query.toLowerCase();
    return this.faqs.filter(
      faq =>
        faq.question.toLowerCase().includes(queryLower) ||
        faq.answer.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get video tutorials
   */
  getVideoTutorials(category = null) {
    let videos = Array.from(this.videoLinks.values());
    if (category) {
      videos = videos.filter(v => v.category === category);
    }
    return videos.sort((a, b) => a.duration - b.duration);
  }

  /**
   * Create support ticket
   */
  async createSupportTicket(ticketData) {
    const ticket = {
      id: `TICKET-${Date.now()}`,
      subject: ticketData.subject,
      description: ticketData.description,
      category: ticketData.category || 'general',
      priority: ticketData.priority || 'medium',
      attachments: ticketData.attachments || [],
      createdAt: new Date().toISOString(),
      status: 'open',
      assignedTo: null,
      responses: []
    };

    this.emit('support-ticket-created', ticket);
    return { success: true, ticket };
  }

  /**
   * Get support channels
   */
  getSupportChannels() {
    return Array.from(this.supportChannels.entries()).map(([key, channel]) => ({
      id: key,
      ...channel
    }));
  }

  /**
   * Get help statistics
   */
  getHelpStats() {
    return {
      totalArticles: this.helpArticles.size,
      totalVideos: this.videoLinks.size,
      totalFAQs: this.faqs.length,
      searchHistory: this.helpHistory,
      articlesPerCategory: this.countByCategory(),
      mostViewedFAQs: this.faqs.sort((a, b) => b.votes - a.votes).slice(0, 5)
    };
  }

  /**
   * Count articles by category
   */
  countByCategory() {
    const counts = {};
    for (const article of this.helpArticles.values()) {
      counts[article.category] = (counts[article.category] || 0) + 1;
    }
    return counts;
  }

  /**
   * Rate article helpfulness
   */
  rateArticle(articleId, helpful) {
    const article = this.helpArticles.get(articleId);
    if (article) {
      article.helpfulVotes = (article.helpfulVotes || 0) + (helpful ? 1 : -1);
      this.emit('article-rated', { articleId, helpful });
      return { success: true };
    }
    return { success: false };
  }

  /**
   * Push context to stack
   */
  pushContext(context) {
    this.contextStack.push(context);
    this.emit('context-changed', { context, stack: [...this.contextStack] });
  }

  /**
   * Pop context from stack
   */
  popContext() {
    if (this.contextStack.length > 0) {
      const context = this.contextStack.pop();
      this.emit('context-changed', { context, stack: [...this.contextStack] });
      return context;
    }
    return null;
  }

  /**
   * Get current context
   */
  getCurrentContext() {
    return this.contextStack[this.contextStack.length - 1] || null;
  }
}

module.exports = HelpSystem;
