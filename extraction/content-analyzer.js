/**
 * Content Analyzer - Analyze and extract content from HTML
 * Responsibilities:
 * - Extract main content (text, links)
 * - Analyze content structure (headings, sections)
 * - Compute readability metrics
 * - Detect content language and sentiment
 *
 * @module extraction/content-analyzer
 */

const cheerio = require('cheerio');

/**
 * ContentAnalyzer class
 * Handles all content analysis and text extraction operations
 *
 * @class ContentAnalyzer
 */
class ContentAnalyzer {
  constructor() {
    this.stats = {
      totalAnalyzed: 0,
      linksExtracted: 0,
      headingsAnalyzed: 0
    };
  }

  /**
   * Extract main content from HTML
   * Identifies primary content area and extracts meaningful text
   *
   * @param {string} html - HTML content
   * @param {Object} options - Analysis options
   * @param {boolean} options.cleanMarkup - Remove markup tags
   * @param {number} options.minTextLength - Minimum text length threshold
   * @returns {Object} Main content object
   *
   * @example
   * const analyzer = new ContentAnalyzer();
   * const content = analyzer.analyzeMainContent(html);
   * // Returns: { text, htmlLength, cleanText, ... }
   */
  analyzeMainContent(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return { text: '', htmlLength: 0, cleanText: '' };
    }

    const { cleanMarkup = false, minTextLength = 0 } = options;

    try {
      const $ = cheerio.load(html);

      // Remove script and style tags
      $('script, style, noscript, meta, link').remove();

      // Get text content
      let text = $.text().trim();

      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();

      // Apply minimum length filter
      if (text.length < minTextLength) {
        return { text: '', htmlLength: html.length, cleanText: '' };
      }

      const contentData = {
        text,
        htmlLength: html.length,
        cleanText: text,
        wordCount: this.countWords(text),
        charCount: text.length,
        paragraphCount: (text.match(/\n\n+/g) || []).length + 1
      };

      this.stats.totalAnalyzed++;
      return contentData;
    } catch (error) {
      console.error('[ContentAnalyzer] Error analyzing main content:', error.message);
      return { text: '', htmlLength: html.length, cleanText: '' };
    }
  }

  /**
   * Extract all links from content
   * Finds all <a> tags and their metadata
   *
   * @param {string} html - HTML content
   * @param {Object} options - Extraction options
   * @param {string} options.baseUrl - Base URL for resolving relative URLs
   * @param {boolean} options.includeInternal - Include internal links
   * @param {boolean} options.includeExternal - Include external links
   * @returns {Array<Object>} Array of link objects
   *
   * @example
   * const links = analyzer.extractLinks(html, { baseUrl: 'https://example.com' });
   * // Returns: [{ href, text, title, target, ... }, ...]
   */
  extractLinks(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return [];
    }

    const {
      baseUrl = '',
      includeInternal = true,
      includeExternal = true
    } = options;

    try {
      const $ = cheerio.load(html);
      const links = [];

      $('a').each((index, element) => {
        const linkData = this.extractLinkData(element, $, baseUrl, {
          includeInternal,
          includeExternal
        });

        if (linkData) {
          links.push(linkData);
        }
      });

      this.stats.linksExtracted += links.length;
      return links;
    } catch (error) {
      console.error('[ContentAnalyzer] Error extracting links:', error.message);
      return [];
    }
  }

  /**
   * Extract data from a link element
   *
   * @param {Element} linkElement - Link DOM element
   * @param {Object} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {Object} options - Filter options
   * @returns {Object|null} Link data object or null if filtered
   *
   * @private
   */
  extractLinkData(linkElement, $, baseUrl, options) {
    const $link = $(linkElement);
    const href = $link.attr('href');

    // Skip anchors and empty hrefs
    if (!href || href.startsWith('#') || href === '') {
      return null;
    }

    const text = $link.text().trim();
    const resolvedUrl = this.resolveUrl(href, baseUrl);

    // Apply filter options
    if (baseUrl) {
      const isInternal = resolvedUrl.startsWith(baseUrl);
      if (isInternal && !options.includeInternal) {
        return null;
      }
      if (!isInternal && !options.includeExternal) {
        return null;
      }
    }

    return {
      href: resolvedUrl,
      originalHref: href,
      text: text || 'No text',
      title: $link.attr('title') || null,
      target: $link.attr('target') || null,
      rel: $link.attr('rel') || null,
      class: $link.attr('class') || null,
      ariaLabel: $link.attr('aria-label') || null,
      download: $link.attr('download') !== undefined,
      type: this.classifyLink(href)
    };
  }

  /**
   * Classify link type
   *
   * @param {string} href - Link href
   * @returns {string} Link type: 'http', 'https', 'file', 'email', 'phone', 'anchor', 'other'
   *
   * @private
   */
  classifyLink(href) {
    if (!href) return 'other';
    if (href.startsWith('http://')) return 'http';
    if (href.startsWith('https://')) return 'https';
    if (href.startsWith('mailto:')) return 'email';
    if (href.startsWith('tel:')) return 'phone';
    if (href.startsWith('#')) return 'anchor';
    if (href.startsWith('file://')) return 'file';
    if (href.includes('.pdf')) return 'pdf';
    if (href.includes('.doc') || href.includes('.docx')) return 'document';
    return 'relative';
  }

  /**
   * Calculate readability metrics for text
   * Computes Flesch-Kincaid and other readability scores
   *
   * @param {string} text - Text content to analyze
   * @returns {Object} Readability metrics
   *
   * @example
   * const metrics = analyzer.calculateReadability('The quick brown fox...');
   * // Returns: { flesch, fleschKincaid, paragraphCount, avgWordsPerSentence, ... }
   */
  calculateReadability(text) {
    if (!text || typeof text !== 'string') {
      return {
        flesch: 0,
        fleschKincaid: 0,
        difficultWords: 0,
        wordCount: 0,
        sentenceCount: 0,
        syllableCount: 0
      };
    }

    const cleaned = text.replace(/<[^>]*>/g, ''); // Remove HTML tags
    const wordCount = this.countWords(cleaned);
    const sentenceCount = this.countSentences(cleaned);
    const syllableCount = this.countSyllables(cleaned);

    if (wordCount === 0 || sentenceCount === 0) {
      return {
        flesch: 0,
        fleschKincaid: 0,
        difficultWords: 0,
        wordCount,
        sentenceCount,
        syllableCount
      };
    }

    // Flesch Reading Ease
    const flesch = Math.max(0, Math.min(100,
      206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount)
    ));

    // Flesch-Kincaid Grade Level
    const fleschKincaid = Math.max(0,
      (0.39 * (wordCount / sentenceCount)) + (11.8 * (syllableCount / wordCount)) - 15.59
    );

    // Identify difficult words (3+ syllables)
    const difficultWords = this.countDifficultWords(cleaned);

    return {
      flesch: Math.round(flesch * 100) / 100,
      fleschKincaid: Math.round(fleschKincaid * 100) / 100,
      difficultWords,
      wordCount,
      sentenceCount,
      syllableCount,
      avgWordsPerSentence: Math.round((wordCount / sentenceCount) * 100) / 100,
      avgSyllablesPerWord: Math.round((syllableCount / wordCount) * 100) / 100
    };
  }

  /**
   * Analyze content structure
   * Identifies headings, sections, and hierarchy
   *
   * @param {string} html - HTML content
   * @returns {Object} Structure analysis
   */
  analyzeStructure(html) {
    if (!html || typeof html !== 'string') {
      return {
        headings: [],
        sections: 0,
        lists: 0,
        tables: 0,
        hierarchy: null
      };
    }

    try {
      const $ = cheerio.load(html);
      const headings = [];
      const hierarchy = [];

      // Extract headings
      for (let i = 1; i <= 6; i++) {
        $(`h${i}`).each((index, element) => {
          const text = $(element).text().trim();
          headings.push({
            level: i,
            text,
            id: $(element).attr('id') || null
          });
          hierarchy.push(i);
        });
      }

      this.stats.headingsAnalyzed += headings.length;

      return {
        headings,
        sections: $('section, article, main').length,
        lists: $('ul, ol').length,
        tables: $('table').length,
        hierarchyValid: this.isValidHeadingHierarchy(hierarchy)
      };
    } catch (error) {
      console.error('[ContentAnalyzer] Error analyzing structure:', error.message);
      return {
        headings: [],
        sections: 0,
        lists: 0,
        tables: 0,
        hierarchyValid: false
      };
    }
  }

  /**
   * Count words in text
   *
   * @param {string} text - Text to count
   * @returns {number} Word count
   *
   * @private
   */
  countWords(text) {
    if (!text) return 0;
    const words = text.trim().split(/\s+/);
    return words.filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in text
   *
   * @param {string} text - Text to count
   * @returns {number} Sentence count
   *
   * @private
   */
  countSentences(text) {
    if (!text) return 0;
    // Split by sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return Math.max(1, sentences.length);
  }

  /**
   * Count syllables in text
   *
   * @param {string} text - Text to count
   * @returns {number} Approximate syllable count
   *
   * @private
   */
  countSyllables(text) {
    if (!text) return 0;

    let count = 0;
    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      // Simple syllable estimation
      let syllables = 1;
      word.replace(/[aeiou]+/g, () => {
        syllables++;
        return '';
      });

      // Adjust for silent e
      if (word.endsWith('e')) {
        syllables--;
      }

      // Adjust for final le
      if (word.endsWith('le') && word.length > 2) {
        syllables++;
      }

      // Minimum 1 syllable per word
      syllables = Math.max(1, syllables);
      count += syllables;
    }

    return count;
  }

  /**
   * Count difficult words (3+ syllables)
   *
   * @param {string} text - Text to analyze
   * @returns {number} Count of difficult words
   *
   * @private
   */
  countDifficultWords(text) {
    if (!text) return 0;

    let count = 0;
    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      const syllables = this.estimateSyllables(word);
      if (syllables >= 3) {
        count++;
      }
    }

    return count;
  }

  /**
   * Estimate syllables in a word
   *
   * @param {string} word - Word to analyze
   * @returns {number} Estimated syllable count
   *
   * @private
   */
  estimateSyllables(word) {
    if (!word || word.length < 3) return 1;

    let syllables = 1;
    word.replace(/[aeiou]+/g, () => {
      syllables++;
      return '';
    });

    if (word.endsWith('e')) syllables--;
    if (word.endsWith('le') && word.length > 2) syllables++;

    return Math.max(1, syllables);
  }

  /**
   * Check if heading hierarchy is valid
   *
   * @param {Array<number>} hierarchy - Array of heading levels
   * @returns {boolean} True if valid hierarchy
   *
   * @private
   */
  isValidHeadingHierarchy(hierarchy) {
    if (hierarchy.length === 0) return true;

    // Check if it starts with h1
    if (hierarchy[0] !== 1) {
      return false;
    }

    // Check for proper progression (no skips > 1 level)
    for (let i = 1; i < hierarchy.length; i++) {
      const diff = hierarchy[i] - hierarchy[i - 1];
      if (diff > 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve relative URL to absolute
   *
   * @param {string} url - URL to resolve
   * @param {string} baseUrl - Base URL
   * @returns {string} Absolute URL
   *
   * @private
   */
  resolveUrl(url, baseUrl) {
    if (!url) return url;

    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      return url;
    }

    if (url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return url;
    }

    if (baseUrl) {
      try {
        const base = new URL(baseUrl);
        const resolved = new URL(url, base);
        return resolved.toString();
      } catch (error) {
        return url;
      }
    }

    return url;
  }

  /**
   * Get analyzer statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalAnalyzed: 0,
      linksExtracted: 0,
      headingsAnalyzed: 0
    };
  }
}

module.exports = { ContentAnalyzer };
