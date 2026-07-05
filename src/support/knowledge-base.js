/**
 * Knowledge Base & Self-Service System
 *
 * Provides comprehensive knowledge base management, intelligent solution suggestions,
 * auto-resolution capabilities, customer self-service portal, and solution tracking.
 *
 * Features:
 * - Article creation and management
 * - Full-text search and semantic search
 * - Intelligent solution suggestions based on ticket content
 * - Auto-resolution for common issues
 * - Customer self-service portal
 * - Solution tracking and effectiveness metrics
 * - FAQ management
 * - Category organization
 * - Article versioning
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class KnowledgeBase extends EventEmitter {
  constructor(options = {}) {
    super();
    this.articles = new Map();
    this.categories = new Map();
    this.faqs = new Map();
    this.solutions = new Map();
    this.articleCounter = options.startCounter || 1;
    this.searchIndex = new Map();
    this.autoResolutionRules = new Map();

    this.initializeDefaultCategories();
    this.initializeAutoResolutionRules();
  }

  /**
   * Initialize default KB categories
   */
  initializeDefaultCategories() {
    const categories = [
      { id: 'getting-started', name: 'Getting Started', description: 'Beginner guides and setup' },
      { id: 'account', name: 'Account Management', description: 'Account and profile help' },
      { id: 'billing', name: 'Billing & Payments', description: 'Billing and payment issues' },
      { id: 'technical', name: 'Technical Issues', description: 'Troubleshooting technical problems' },
      { id: 'features', name: 'Features & Usage', description: 'How to use features' },
      { id: 'integration', name: 'Integrations', description: 'Third-party integrations' },
      { id: 'security', name: 'Security & Privacy', description: 'Security and privacy topics' },
      { id: 'advanced', name: 'Advanced Topics', description: 'Advanced configuration and usage' }
    ];

    for (const category of categories) {
      this.categories.set(category.id, {
        ...category,
        articleCount: 0,
        views: 0,
        rating: 0
      });
    }
  }

  /**
   * Initialize auto-resolution rules
   */
  initializeAutoResolutionRules() {
    this.autoResolutionRules.set('password-reset', {
      keywords: ['password', 'reset', 'forgot', 'login', 'account locked'],
      solution: 'KB-1001',
      confidence: 0.9
    });

    this.autoResolutionRules.set('payment-failed', {
      keywords: ['payment', 'declined', 'card', 'billing', 'transaction failed'],
      solution: 'KB-1002',
      confidence: 0.85
    });

    this.autoResolutionRules.set('browser-issues', {
      keywords: ['browser', 'crash', 'not working', 'slow', 'freeze', 'unresponsive'],
      solution: 'KB-1003',
      confidence: 0.8
    });

    this.autoResolutionRules.set('integration-error', {
      keywords: ['integration', 'api', 'connection', 'webhook', 'error'],
      solution: 'KB-1004',
      confidence: 0.75
    });

    this.autoResolutionRules.set('export-import', {
      keywords: ['export', 'import', 'data', 'csv', 'download'],
      solution: 'KB-1005',
      confidence: 0.8
    });
  }

  /**
   * Create knowledge base article
   */
  async createArticle(articleData) {
    try {
      if (!articleData.title || !articleData.category) {
        return {
          success: false,
          error: 'Missing required fields: title, category'
        };
      }

      if (!this.categories.has(articleData.category)) {
        return {
          success: false,
          error: `Invalid category: ${articleData.category}`
        };
      }

      const articleId = `KB-${1000 + this.articleCounter++}`;
      const now = new Date();

      const article = {
        id: articleId,
        title: articleData.title,
        content: articleData.content || '',
        category: articleData.category,
        status: articleData.status || 'published',
        author: articleData.author,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        publishedAt: articleData.status === 'published' ? now.toISOString() : null,
        tags: articleData.tags || [],
        relatedArticles: articleData.relatedArticles || [],
        keywords: this.extractKeywords(articleData.content),
        views: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
        rating: 0,
        versions: [
          {
            version: 1,
            content: articleData.content,
            author: articleData.author,
            timestamp: now.toISOString(),
            changes: 'Initial version'
          }
        ],
        attachments: articleData.attachments || [],
        faq: articleData.faq || false,
        difficulty: articleData.difficulty || 'beginner',
        estimatedReadTime: this.estimateReadTime(articleData.content)
      };

      this.articles.set(articleId, article);

      // Update category
      const category = this.categories.get(articleData.category);
      category.articleCount += 1;

      // Index for search
      this.indexArticle(articleId, article);

      // Add to FAQ if marked
      if (article.faq) {
        this.faqs.set(articleId, {
          id: articleId,
          question: articleData.title,
          answer: articleData.content,
          helpful: 0,
          views: 0
        });
      }

      this.emit('article-created', article);

      return { success: true, article };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract keywords from content
   */
  extractKeywords(content) {
    if (!content) {
      return [];
    }

    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'is', 'are', 'was', 'be', 'been', 'if', 'how', 'what', 'when'
    ]);

    const words = content
      .toLowerCase()
      .match(/\b\w+\b/g) || [];

    const frequency = {};
    for (const word of words) {
      if (!commonWords.has(word) && word.length > 3) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    }

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Index article for search
   */
  indexArticle(articleId, article) {
    const allTerms = [
      ...article.keywords,
      ...article.tags,
      article.title.toLowerCase().split(/\s+/)
    ].flat();

    for (const term of allTerms) {
      if (!this.searchIndex.has(term)) {
        this.searchIndex.set(term, []);
      }

      if (!this.searchIndex.get(term).includes(articleId)) {
        this.searchIndex.get(term).push(articleId);
      }
    }
  }

  /**
   * Estimate read time in minutes
   */
  estimateReadTime(content) {
    if (!content) {
      return 0;
    }
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / 200); // Average reading speed: 200 words/minute
  }

  /**
   * Search articles
   */
  searchArticles(query, options = {}) {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results = new Map();

    // Find articles matching query terms
    for (const term of queryTerms) {
      const matchingArticles = this.searchIndex.get(term) || [];

      for (const articleId of matchingArticles) {
        if (!results.has(articleId)) {
          results.set(articleId, { score: 0, article: this.articles.get(articleId) });
        }

        // Increment score for each matching term
        const result = results.get(articleId);
        result.score += 1;

        // Boost score for title matches
        if (result.article.title.toLowerCase().includes(term)) {
          result.score += 3;
        }

        // Boost score for tag matches
        if (result.article.tags.some(tag => tag.toLowerCase().includes(term))) {
          result.score += 2;
        }
      }
    }

    // Filter by category if specified
    if (options.category) {
      for (const [key, result] of results.entries()) {
        if (result.article.category !== options.category) {
          results.delete(key);
        }
      }
    }

    // Filter by difficulty if specified
    if (options.difficulty) {
      for (const [key, result] of results.entries()) {
        if (result.article.difficulty !== options.difficulty) {
          results.delete(key);
        }
      }
    }

    // Sort by score (relevance)
    const sorted = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);

    return sorted.map(r => r.article);
  }

  /**
   * Suggest solutions based on ticket content
   */
  suggestSolutions(ticketContent) {
    const suggestions = [];
    const contentLower = ticketContent.toLowerCase();

    // Check auto-resolution rules
    for (const [ruleId, rule] of this.autoResolutionRules) {
      let matchCount = 0;

      for (const keyword of rule.keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          matchCount += 1;
        }
      }

      if (matchCount > 0) {
        const confidence = (matchCount / rule.keywords.length) * rule.confidence;

        suggestions.push({
          ruleId,
          confidence: Math.min(confidence, 1),
          solutionId: rule.solution,
          article: this.articles.get(rule.solution)
        });
      }
    }

    // Search KB articles
    const searchResults = this.searchArticles(ticketContent, { limit: 5 });

    for (const article of searchResults) {
      if (!suggestions.some(s => s.solutionId === article.id)) {
        suggestions.push({
          type: 'search',
          confidence: 0.6,
          solutionId: article.id,
          article
        });
      }
    }

    // Sort by confidence
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Auto-resolve ticket if high-confidence solution exists
   */
  async autoResolveTicket(ticket) {
    const suggestions = this.suggestSolutions(ticket.description);

    if (suggestions.length === 0) {
      return { success: false, reason: 'No matching solutions found' };
    }

    const topSuggestion = suggestions[0];

    // Only auto-resolve if confidence is very high
    if (topSuggestion.confidence < 0.85) {
      return { success: false, reason: 'Confidence too low for auto-resolution' };
    }

    const resolution = {
      method: 'auto-resolved',
      articleId: topSuggestion.solutionId,
      article: topSuggestion.article,
      confidence: topSuggestion.confidence,
      timestamp: new Date().toISOString()
    };

    // Track solution usage
    await this.trackSolutionUsage(topSuggestion.solutionId, ticket.id, true);

    this.emit('ticket-auto-resolved', {
      ticketId: ticket.id,
      resolution
    });

    return {
      success: true,
      resolution
    };
  }

  /**
   * Track solution usage
   */
  async trackSolutionUsage(solutionId, ticketId, resolved = false) {
    const article = this.articles.get(solutionId);
    if (!article) {
      return;
    }

    if (!this.solutions.has(solutionId)) {
      this.solutions.set(solutionId, {
        articleId: solutionId,
        usageCount: 0,
        successCount: 0,
        resolutionRate: 0,
        lastUsed: null,
        tickets: []
      });
    }

    const solution = this.solutions.get(solutionId);
    solution.usageCount += 1;
    if (resolved) {
      solution.successCount += 1;
    }
    solution.resolutionRate = (solution.successCount / solution.usageCount) * 100;
    solution.lastUsed = new Date().toISOString();
    solution.tickets.push(ticketId);

    // Limit tickets array to last 100
    if (solution.tickets.length > 100) {
      solution.tickets = solution.tickets.slice(-100);
    }
  }

  /**
   * Record article view
   */
  recordView(articleId) {
    const article = this.articles.get(articleId);
    if (article) {
      article.views += 1;

      const category = this.categories.get(article.category);
      if (category) {
        category.views += 1;
      }

      this.emit('article-viewed', { articleId, views: article.views });
    }
  }

  /**
   * Record article feedback
   */
  recordFeedback(articleId, helpful) {
    const article = this.articles.get(articleId);
    if (!article) {
      return;
    }

    if (helpful) {
      article.helpfulCount += 1;
    } else {
      article.unhelpfulCount += 1;
    }

    const total = article.helpfulCount + article.unhelpfulCount;
    article.rating = (article.helpfulCount / total) * 100;

    this.emit('article-feedback', {
      articleId,
      helpful,
      rating: article.rating
    });
  }

  /**
   * Update article
   */
  async updateArticle(articleId, updates) {
    const article = this.articles.get(articleId);
    if (!article) {
      return { success: false, error: 'Article not found' };
    }

    const oldContent = article.content;

    // Create version history
    if (updates.content && updates.content !== article.content) {
      article.versions.push({
        version: article.versions.length + 1,
        content: oldContent,
        author: updates.author,
        timestamp: new Date().toISOString(),
        changes: updates.changes || 'Content updated'
      });
    }

    // Update fields
    if (updates.title) {
      article.title = updates.title;
    }
    if (updates.content) {
      article.content = updates.content;
    }
    if (updates.status) {
      article.status = updates.status;
    }
    if (updates.tags) {
      article.tags = updates.tags;
    }
    if (updates.difficulty) {
      article.difficulty = updates.difficulty;
    }

    article.updatedAt = new Date().toISOString();
    article.keywords = this.extractKeywords(article.content);
    article.estimatedReadTime = this.estimateReadTime(article.content);

    // Re-index
    this.indexArticle(articleId, article);

    this.emit('article-updated', article);

    return { success: true, article };
  }

  /**
   * Delete article
   */
  async deleteArticle(articleId) {
    const article = this.articles.get(articleId);
    if (!article) {
      return { success: false, error: 'Article not found' };
    }

    // Remove from category
    const category = this.categories.get(article.category);
    if (category) {
      category.articleCount = Math.max(0, category.articleCount - 1);
    }

    // Remove from FAQ
    if (this.faqs.has(articleId)) {
      this.faqs.delete(articleId);
    }

    // Remove from articles
    this.articles.delete(articleId);

    this.emit('article-deleted', { articleId });

    return { success: true };
  }

  /**
   * Get article by ID
   */
  getArticle(articleId) {
    return this.articles.get(articleId);
  }

  /**
   * Get articles by category
   */
  getArticlesByCategory(categoryId) {
    return Array.from(this.articles.values()).filter(a => a.category === categoryId);
  }

  /**
   * Get FAQ articles
   */
  getFAQ() {
    return Array.from(this.faqs.values());
  }

  /**
   * Get top articles by views
   */
  getTopArticles(limit = 10) {
    return Array.from(this.articles.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  /**
   * Get top articles by rating
   */
  getMostHelpfulArticles(limit = 10) {
    return Array.from(this.articles.values())
      .filter(a => a.helpfulCount + a.unhelpfulCount > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  /**
   * Get categories with statistics
   */
  getCategories() {
    return Array.from(this.categories.values());
  }

  /**
   * Get knowledge base statistics
   */
  getStatistics() {
    const articles = Array.from(this.articles.values());

    return {
      totalArticles: articles.length,
      publishedArticles: articles.filter(a => a.status === 'published').length,
      draftArticles: articles.filter(a => a.status === 'draft').length,
      totalViews: articles.reduce((sum, a) => sum + a.views, 0),
      averageRating: articles.length > 0
        ? articles.reduce((sum, a) => sum + a.rating, 0) / articles.length
        : 0,
      mostViewedArticle: articles.length > 0 ? articles.sort((a, b) => b.views - a.views)[0] : null,
      mostHelpfulArticle: articles.length > 0
        ? articles.filter(a => a.helpfulCount + a.unhelpfulCount > 0)
          .sort((a, b) => b.rating - a.rating)[0]
        : null,
      categories: Array.from(this.categories.values()),
      faqCount: this.faqs.size,
      solutionStats: Array.from(this.solutions.values()).map(s => ({
        articleId: s.articleId,
        usageCount: s.usageCount,
        successCount: s.successCount,
        resolutionRate: Math.round(s.resolutionRate * 100) / 100
      }))
    };
  }

  /**
   * Get self-service portal content
   */
  getSelfServicePortal(options = {}) {
    const categories = this.getCategories();

    const portal = {
      categories: categories.map(cat => ({
        ...cat,
        articles: this.getArticlesByCategory(cat.id).map(a => ({
          id: a.id,
          title: a.title,
          views: a.views,
          rating: a.rating,
          readTime: a.estimatedReadTime
        }))
      })),
      faq: this.getFAQ().slice(0, 10),
      topArticles: this.getTopArticles(5),
      helpfulArticles: this.getMostHelpfulArticles(5)
    };

    return portal;
  }

  /**
   * Get article version history
   */
  getVersionHistory(articleId) {
    const article = this.articles.get(articleId);
    if (!article) {
      return null;
    }

    return article.versions;
  }

  /**
   * Restore article version
   */
  async restoreVersion(articleId, versionNumber) {
    const article = this.articles.get(articleId);
    if (!article) {
      return { success: false, error: 'Article not found' };
    }

    const version = article.versions.find(v => v.version === versionNumber);
    if (!version) {
      return { success: false, error: 'Version not found' };
    }

    // Create backup of current version
    article.versions.push({
      version: article.versions.length + 1,
      content: article.content,
      author: 'system',
      timestamp: new Date().toISOString(),
      changes: `Reverted to version ${versionNumber}`
    });

    article.content = version.content;
    article.updatedAt = new Date().toISOString();

    return { success: true, article };
  }
}

module.exports = KnowledgeBase;
