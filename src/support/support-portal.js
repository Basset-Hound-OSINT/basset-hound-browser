/**
 * Support Portal - Customer Self-Service
 *
 * Public-facing customer support portal with KB search, FAQ system,
 * video tutorials, community forum integration, and ticket tracking.
 *
 * Features:
 * - Public KB search and navigation
 * - FAQ management
 * - Video tutorial integration
 * - Community forum
 * - Ticket self-service portal
 * - Knowledge rating
 * - Search analytics
 * - Mobile responsive
 */

const EventEmitter = require('events');

class SupportPortal extends EventEmitter {
  constructor(options = {}) {
    super();
    this.knowledgeBase = options.knowledgeBase;
    this.ticketManager = options.ticketManager;
    this.searchAnalytics = new Map();
    this.feedbackLog = [];
    this.communityPosts = new Map();
    this.tutorials = new Map();
    this.postCounter = 1;
  }

  /**
   * Search knowledge base
   */
  searchKnowledgeBase(query, options = {}) {
    if (!this.knowledgeBase) {
      return { success: false, error: 'Knowledge base not available' };
    }

    const results = this.knowledgeBase.searchArticles(query, options);

    // Track search
    this.recordSearch(query, results.length);

    return {
      success: true,
      query,
      resultCount: results.length,
      results: results.map(article => ({
        id: article.id,
        title: article.title,
        excerpt: article.content.substring(0, 200),
        category: article.category,
        readTime: article.estimatedReadTime,
        rating: article.rating,
        views: article.views
      }))
    };
  }

  /**
   * Get FAQ
   */
  getFAQ(options = {}) {
    if (!this.knowledgeBase) {
      return { success: false, error: 'Knowledge base not available' };
    }

    let faqs = this.knowledgeBase.getFAQ();

    if (options.category) {
      faqs = faqs.filter(f => {
        const article = this.knowledgeBase.getArticle(f.id);
        return article && article.category === options.category;
      });
    }

    if (options.limit) {
      faqs = faqs.slice(0, options.limit);
    }

    return {
      success: true,
      faqCount: faqs.length,
      faqs: faqs.map(faq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        helpful: faq.helpful,
        views: faq.views
      }))
    };
  }

  /**
   * Record search analytics
   */
  recordSearch(query, resultCount) {
    const normalizedQuery = query.toLowerCase().trim();

    if (!this.searchAnalytics.has(normalizedQuery)) {
      this.searchAnalytics.set(normalizedQuery, {
        query: normalizedQuery,
        searches: 0,
        resultCount: 0,
        noResults: 0,
        clicks: 0
      });
    }

    const analytics = this.searchAnalytics.get(normalizedQuery);
    analytics.searches += 1;
    analytics.resultCount = resultCount;

    if (resultCount === 0) {
      analytics.noResults += 1;
    }

    this.emit('search-recorded', { query: normalizedQuery, resultCount });
  }

  /**
   * Record article view
   */
  recordArticleView(articleId) {
    if (!this.knowledgeBase) return;

    this.knowledgeBase.recordView(articleId);

    this.emit('article-viewed', { articleId });
  }

  /**
   * Submit article feedback
   */
  submitArticleFeedback(articleId, helpful) {
    if (!this.knowledgeBase) {
      return { success: false, error: 'Knowledge base not available' };
    }

    this.knowledgeBase.recordFeedback(articleId, helpful);

    const feedback = {
      id: `FEEDBACK-${Date.now()}`,
      articleId,
      helpful,
      timestamp: new Date().toISOString()
    };

    this.feedbackLog.push(feedback);

    return {
      success: true,
      feedback
    };
  }

  /**
   * Get knowledge base categories
   */
  getCategories() {
    if (!this.knowledgeBase) {
      return { success: false, error: 'Knowledge base not available' };
    }

    const categories = this.knowledgeBase.getCategories();

    return {
      success: true,
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        articleCount: cat.articleCount
      }))
    };
  }

  /**
   * Get articles by category
   */
  getArticlesByCategory(categoryId) {
    if (!this.knowledgeBase) {
      return { success: false, error: 'Knowledge base not available' };
    }

    const articles = this.knowledgeBase.getArticlesByCategory(categoryId);

    return {
      success: true,
      category: categoryId,
      articles: articles.map(article => ({
        id: article.id,
        title: article.title,
        excerpt: article.content.substring(0, 150),
        readTime: article.estimatedReadTime,
        rating: article.rating,
        views: article.views
      }))
    };
  }

  /**
   * Get article details
   */
  getArticleDetails(articleId) {
    if (!this.knowledgeBase) {
      return { success: false, error: 'Knowledge base not available' };
    }

    const article = this.knowledgeBase.getArticle(articleId);
    if (!article) {
      return { success: false, error: 'Article not found' };
    }

    // Record view
    this.recordArticleView(articleId);

    return {
      success: true,
      article: {
        id: article.id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags,
        difficulty: article.difficulty,
        readTime: article.estimatedReadTime,
        rating: article.rating,
        views: article.views + 1,
        relatedArticles: article.relatedArticles,
        lastUpdated: article.updatedAt
      }
    };
  }

  /**
   * Create support ticket from portal
   */
  createTicketFromPortal(ticketData) {
    if (!this.ticketManager) {
      return { success: false, error: 'Ticket manager not available' };
    }

    return this.ticketManager.createTicket({
      ...ticketData,
      source: 'portal'
    });
  }

  /**
   * Get user tickets
   */
  getUserTickets(userId) {
    if (!this.ticketManager) {
      return { success: false, error: 'Ticket manager not available' };
    }

    const tickets = this.ticketManager.getTicketsByUser(userId);

    return {
      success: true,
      tickets: tickets.map(ticket => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        lastResponse: ticket.responses.length > 0
          ? ticket.responses[ticket.responses.length - 1].createdAt
          : null,
        responseCount: ticket.responses.length
      }))
    };
  }

  /**
   * Get ticket details
   */
  getTicketDetails(ticketId, userId) {
    if (!this.ticketManager) {
      return { success: false, error: 'Ticket manager not available' };
    }

    const ticket = this.ticketManager.getTicket(ticketId);

    if (!ticket || ticket.userId !== userId) {
      return { success: false, error: 'Ticket not found or access denied' };
    }

    return {
      success: true,
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        assignedTo: ticket.assignedTo,
        responses: ticket.responses.map(r => ({
          id: r.id,
          author: r.author,
          content: r.content,
          createdAt: r.createdAt,
          isInternal: r.isInternal
        })),
        sla: ticket.sla,
        estimatedResolution: ticket.sla.resolutionDeadline
      }
    };
  }

  /**
   * Add response to ticket
   */
  addTicketResponse(ticketId, userId, responseData) {
    if (!this.ticketManager) {
      return { success: false, error: 'Ticket manager not available' };
    }

    const ticket = this.ticketManager.getTicket(ticketId);

    if (!ticket || ticket.userId !== userId) {
      return { success: false, error: 'Ticket not found or access denied' };
    }

    return this.ticketManager.addResponse(ticketId, {
      ...responseData,
      author: userId,
      authorRole: 'customer',
      isInternal: false
    });
  }

  /**
   * Post community message
   */
  postCommunityMessage(userId, message) {
    const post = {
      id: `POST-${this.postCounter++}`,
      userId,
      content: message,
      createdAt: new Date().toISOString(),
      replies: [],
      likes: 0,
      helpful: false
    };

    this.communityPosts.set(post.id, post);

    this.emit('community-post-created', post);

    return { success: true, post };
  }

  /**
   * Reply to community message
   */
  replyCommunityMessage(postId, userId, reply) {
    const post = this.communityPosts.get(postId);

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    const replyObj = {
      id: `REPLY-${Date.now()}`,
      userId,
      content: reply,
      createdAt: new Date().toISOString(),
      likes: 0
    };

    post.replies.push(replyObj);

    this.emit('community-reply-created', { postId, reply: replyObj });

    return { success: true, reply: replyObj };
  }

  /**
   * Get community posts
   */
  getCommunityPosts(options = {}) {
    let posts = Array.from(this.communityPosts.values());

    if (options.limit) {
      posts = posts.slice(-options.limit);
    }

    return {
      success: true,
      posts: posts.map(post => ({
        id: post.id,
        userId: post.userId,
        content: post.content,
        createdAt: post.createdAt,
        replyCount: post.replies.length,
        likes: post.likes,
        helpful: post.helpful
      }))
    };
  }

  /**
   * Add video tutorial
   */
  addVideoTutorial(tutorialData) {
    const tutorial = {
      id: `VID-${Date.now()}`,
      title: tutorialData.title,
      description: tutorialData.description,
      category: tutorialData.category,
      url: tutorialData.url,
      duration: tutorialData.duration,
      views: 0,
      rating: 0,
      createdAt: new Date().toISOString()
    };

    this.tutorials.set(tutorial.id, tutorial);

    return { success: true, tutorial };
  }

  /**
   * Get video tutorials
   */
  getVideoTutorials(options = {}) {
    let tutorials = Array.from(this.tutorials.values());

    if (options.category) {
      tutorials = tutorials.filter(t => t.category === options.category);
    }

    if (options.limit) {
      tutorials = tutorials.slice(0, options.limit);
    }

    return {
      success: true,
      tutorials
    };
  }

  /**
   * Record video view
   */
  recordVideoView(videoId) {
    const tutorial = this.tutorials.get(videoId);

    if (tutorial) {
      tutorial.views += 1;
      this.emit('video-viewed', { videoId, views: tutorial.views });
    }
  }

  /**
   * Get portal statistics
   */
  getPortalStatistics() {
    const topSearches = Array.from(this.searchAnalytics.values())
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 10);

    const noResultsSearches = Array.from(this.searchAnalytics.values())
      .filter(s => s.noResults > 0)
      .sort((a, b) => b.noResults - a.noResults)
      .slice(0, 5);

    return {
      searchAnalytics: {
        totalSearches: Array.from(this.searchAnalytics.values()).reduce((sum, s) => sum + s.searches, 0),
        topSearches,
        noResultsSearches
      },
      community: {
        totalPosts: this.communityPosts.size,
        totalReplies: Array.from(this.communityPosts.values()).reduce((sum, p) => sum + p.replies.length, 0)
      },
      tutorials: {
        totalTutorials: this.tutorials.size,
        totalViews: Array.from(this.tutorials.values()).reduce((sum, t) => sum + t.views, 0)
      },
      feedback: {
        totalFeedback: this.feedbackLog.length,
        helpfulCount: this.feedbackLog.filter(f => f.helpful).length,
        unhelpfulCount: this.feedbackLog.filter(f => !f.helpful).length
      }
    };
  }

  /**
   * Get portal dashboard
   */
  getPortalDashboard(userId = null) {
    const stats = this.getPortalStatistics();
    const categories = this.getCategories();

    const dashboard = {
      categories,
      topArticles: this.knowledgeBase ? this.knowledgeBase.getTopArticles(5) : [],
      faq: this.getFAQ({ limit: 5 }),
      communityHighlights: this.getCommunityPosts({ limit: 3 }),
      tutorials: this.getVideoTutorials({ limit: 5 }),
      statistics: stats
    };

    if (userId && this.ticketManager) {
      dashboard.userTickets = this.getUserTickets(userId);
    }

    return { success: true, dashboard };
  }

  /**
   * Get search analytics summary
   */
  getSearchAnalyticsSummary() {
    const analytics = Array.from(this.searchAnalytics.values());

    return {
      totalSearches: analytics.reduce((sum, a) => sum + a.searches, 0),
      totalUniqueQueries: analytics.length,
      averageResultsPerSearch: analytics.length > 0
        ? Math.round(analytics.reduce((sum, a) => sum + a.resultCount, 0) / analytics.length)
        : 0,
      zeroResultsRate: analytics.length > 0
        ? Math.round((analytics.reduce((sum, a) => sum + a.noResults, 0) / analytics.reduce((sum, a) => sum + a.searches, 0)) * 100)
        : 0,
      topQueries: analytics
        .sort((a, b) => b.searches - a.searches)
        .slice(0, 10)
        .map(a => ({ query: a.query, searches: a.searches }))
    };
  }

  /**
   * Rate community post
   */
  rateCommunityPost(postId, rating) {
    const post = this.communityPosts.get(postId);

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    post.helpful = rating > 0;
    post.likes += rating;

    return { success: true, post };
  }

  /**
   * Get portal health check
   */
  getHealthCheck() {
    return {
      knowledgeBase: this.knowledgeBase ? 'operational' : 'unavailable',
      ticketManager: this.ticketManager ? 'operational' : 'unavailable',
      statistics: {
        articles: this.knowledgeBase ? this.knowledgeBase.getStatistics().totalArticles : 0,
        faqs: this.knowledgeBase ? this.knowledgeBase.getFAQ().length : 0,
        communityPosts: this.communityPosts.size,
        tutorials: this.tutorials.size
      }
    };
  }
}

module.exports = SupportPortal;
