/**
 * Basset Hound Browser - Stylesheet Extractor
 * Extracts external stylesheets and inline <style> blocks from HTML and detects
 * common CSS frameworks.
 * `extractStylesheets` is delegated from ExtractionManager (receives the manager instance
 * as `self`); `detectCssFramework` is a pure helper with no instance dependencies.
 *
 * @module extraction/manager/stylesheets
 */

/**
 * Extract all stylesheets from HTML
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for relative stylesheet resolution
 * @param {ExtractionManager} self - Manager instance providing shared helpers
 * @returns {Object} Extracted stylesheet data
 */
function extractStylesheets(html, baseUrl = '', self) {
  const result = {
    success: true,
    data: {
      external: [],
      inline: []
    },
    count: 0,
    errors: [],
    warnings: []
  };

  self.stats.totalExtractions++;
  self.stats.stylesheetExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    // Find all link[rel="stylesheet"] tags
    const linkRegex = /<link\s+[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const linkTag = match[0];
      const href = self.extractAttribute(linkTag, 'href');

      if (href) {
        const stylesheet = {
          href: href,
          resolvedHref: self.resolveUrl(href, baseUrl),
          type: self.extractAttribute(linkTag, 'type') || 'text/css',
          media: self.extractAttribute(linkTag, 'media') || 'all',
          crossorigin: self.extractAttribute(linkTag, 'crossorigin'),
          integrity: self.extractAttribute(linkTag, 'integrity'),
          disabled: self.hasAttribute(linkTag, 'disabled'),
          title: self.extractAttribute(linkTag, 'title'),
          isExternal: true
        };

        // Detect common CSS frameworks
        stylesheet.framework = self.detectCssFramework(href);

        result.data.external.push(stylesheet);
        result.count++;
      }
    }

    // Find all style tags (inline CSS)
    const styleRegex = /<style\s*[^>]*>([\s\S]*?)<\/style>/gi;

    while ((match = styleRegex.exec(html)) !== null) {
      const startTag = match[0].match(/<style\s*[^>]*>/i)[0];
      const content = match[1].trim();

      const stylesheet = {
        type: self.extractAttribute(startTag, 'type') || 'text/css',
        media: self.extractAttribute(startTag, 'media') || 'all',
        isInline: true,
        contentLength: content.length,
        contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      };

      // Basic analysis of inline styles
      stylesheet.analysis = {
        hasMediaQueries: content.includes('@media'),
        hasKeyframes: content.includes('@keyframes'),
        hasImports: content.includes('@import'),
        hasFontFace: content.includes('@font-face'),
        hasVariables: content.includes('--') || content.includes('var('),
        ruleCount: (content.match(/\{/g) || []).length
      };

      // Extract @import URLs
      const importMatches = content.match(/@import\s+(?:url\s*\(\s*)?["']?([^"');\s]+)/gi);
      if (importMatches) {
        stylesheet.imports = importMatches.map(imp => {
          const urlMatch = imp.match(/["']?([^"');\s]+)["']?/);
          return urlMatch ? self.resolveUrl(urlMatch[1], baseUrl) : null;
        }).filter(Boolean);
      }

      result.data.inline.push(stylesheet);
      result.count++;
    }

    // Summary
    result.summary = {
      totalStylesheets: result.count,
      externalStylesheets: result.data.external.length,
      inlineStyles: result.data.inline.length,
      withIntegrity: result.data.external.filter(s => s.integrity).length,
      mediaPrint: [...result.data.external, ...result.data.inline].filter(s => s.media === 'print').length,
      mediaScreen: [...result.data.external, ...result.data.inline].filter(s => s.media === 'screen').length
    };

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

/**
 * Detect common CSS frameworks from stylesheet URL
 * @param {string} href - Stylesheet URL
 * @returns {string|null} Detected framework name or null
 */
function detectCssFramework(href) {
  const patterns = {
    'Bootstrap': /bootstrap[.-]?(\d+)?/i,
    'Tailwind CSS': /tailwind/i,
    'Bulma': /bulma/i,
    'Foundation': /foundation/i,
    'Materialize': /materialize/i,
    'Semantic UI': /semantic/i,
    'Font Awesome': /font-?awesome/i,
    'Normalize.css': /normalize/i,
    'Reset CSS': /reset/i,
    'Animate.css': /animate/i,
    'Pure CSS': /pure[.-]?(min)?\.css/i
  };

  for (const [name, pattern] of Object.entries(patterns)) {
    if (pattern.test(href)) {
      return name;
    }
  }

  return null;
}

module.exports = { extractStylesheets, detectCssFramework };
