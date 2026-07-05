/**
 * HTML Content Extractor Module
 * Responsibility: Extract HTML structure and content
 * - Full HTML content
 * - Inner HTML
 * - Text content
 * - DOM structure analysis
 *
 * This module is part of Extraction Manager refactoring to reduce monolithic complexity
 * Extracted from: extraction/manager.js
 */

class HTMLExtractor {
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Extract full HTML content
   * @param {Document} document - DOM document
   * @returns {string} Full HTML
   */
  extractFullHTML(document) {
    try {
      return document.documentElement.outerHTML;
    } catch (error) {
      this.logger.error('Failed to extract full HTML', error);
      return '';
    }
  }

  /**
   * Extract body HTML only
   * @param {Document} document - DOM document
   * @returns {string} Body HTML
   */
  extractBodyHTML(document) {
    try {
      const body = document.body;
      return body ? body.innerHTML : '';
    } catch (error) {
      this.logger.error('Failed to extract body HTML', error);
      return '';
    }
  }

  /**
   * Extract text content (no tags)
   * @param {Document} document - DOM document
   * @returns {string} Text content
   */
  extractTextContent(document) {
    try {
      return document.body?.innerText || '';
    } catch (error) {
      this.logger.error('Failed to extract text content', error);
      return '';
    }
  }

  /**
   * Extract DOM structure metadata
   * @param {Document} document - DOM document
   * @returns {Object} DOM metadata
   */
  extractDOMMetadata(document) {
    try {
      return {
        elementCount: document.querySelectorAll('*').length,
        titleTag: document.title,
        langAttribute: document.documentElement.lang,
        characterSet: document.characterSet,
        docType: document.doctype?.name || 'unknown',
        URL: document.URL,
        domain: new URL(document.URL).hostname,
        readyState: document.readyState
      };
    } catch (error) {
      this.logger.error('Failed to extract DOM metadata', error);
      return {};
    }
  }
}

module.exports = { HTMLExtractor };
