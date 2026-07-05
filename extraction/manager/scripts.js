/**
 * Basset Hound Browser - Script Extractor
 * Extracts external and inline scripts from HTML and detects common JS libraries.
 * `extractScripts` is delegated from ExtractionManager (receives the manager instance
 * as `self`); `detectScriptLibrary` is a pure helper with no instance dependencies.
 *
 * @module extraction/manager/scripts
 */

/**
 * Extract all scripts from HTML
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for relative script resolution
 * @param {ExtractionManager} self - Manager instance providing shared helpers
 * @returns {Object} Extracted script data
 */
function extractScripts(html, baseUrl = '', self) {
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
  self.stats.scriptExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    // Find all script tags
    const scriptRegex = /<script\s*[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const fullTag = match[0];
      const startTag = fullTag.match(/<script\s*[^>]*>/i)[0];
      const content = match[1].trim();

      const script = {
        src: self.extractAttribute(startTag, 'src'),
        type: self.extractAttribute(startTag, 'type') || 'text/javascript',
        async: self.hasAttribute(startTag, 'async'),
        defer: self.hasAttribute(startTag, 'defer'),
        crossorigin: self.extractAttribute(startTag, 'crossorigin'),
        integrity: self.extractAttribute(startTag, 'integrity'),
        nomodule: self.hasAttribute(startTag, 'nomodule'),
        nonce: self.extractAttribute(startTag, 'nonce'),
        referrerpolicy: self.extractAttribute(startTag, 'referrerpolicy'),
        id: self.extractAttribute(startTag, 'id')
      };

      if (script.src) {
        // External script
        script.resolvedSrc = self.resolveUrl(script.src, baseUrl);
        script.isExternal = true;

        // Detect common libraries
        script.library = self.detectScriptLibrary(script.src);

        result.data.external.push(script);
      } else if (content) {
        // Inline script
        script.isInline = true;
        script.contentLength = content.length;
        script.contentPreview = content.substring(0, 200) + (content.length > 200 ? '...' : '');

        // Check for common patterns
        if (content.includes('application/ld+json')) {
          script.containsJsonLd = true;
        }
        if (content.match(/gtag|ga\(|_gaq|GoogleAnalytics/i)) {
          script.containsAnalytics = true;
        }
        if (content.match(/fbq|facebook|fb\.init/i)) {
          script.containsFacebookPixel = true;
        }

        result.data.inline.push(script);
      }

      result.count++;
    }

    // Summary
    result.summary = {
      totalScripts: result.count,
      externalScripts: result.data.external.length,
      inlineScripts: result.data.inline.length,
      asyncScripts: result.data.external.filter(s => s.async).length,
      deferScripts: result.data.external.filter(s => s.defer).length,
      moduleScripts: [...result.data.external, ...result.data.inline].filter(s => s.type === 'module').length,
      withIntegrity: result.data.external.filter(s => s.integrity).length
    };

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

/**
 * Detect common JavaScript libraries from script URL
 * @param {string} src - Script source URL
 * @returns {string|null} Detected library name or null
 */
function detectScriptLibrary(src) {
  const patterns = {
    'jQuery': /jquery[.-]?(\d+)?/i,
    'React': /react[.-]?(\d+)?(?:\.min)?\.js/i,
    'Vue': /vue[.-]?(\d+)?(?:\.min)?\.js/i,
    'Angular': /angular[.-]?(\d+)?/i,
    'Bootstrap': /bootstrap[.-]?(\d+)?/i,
    'Google Analytics': /google-analytics|googletagmanager|gtag/i,
    'Google Tag Manager': /googletagmanager/i,
    'Facebook Pixel': /fbevents|connect\.facebook/i,
    'Lodash': /lodash/i,
    'Moment.js': /moment[.-]?(\d+)?/i,
    'Chart.js': /chart[.-]?(\d+)?/i,
    'D3.js': /d3[.-]?(\d+)?/i,
    'Three.js': /three[.-]?(\d+)?/i,
    'Axios': /axios/i,
    'Webpack': /webpack/i
  };

  for (const [name, pattern] of Object.entries(patterns)) {
    if (pattern.test(src)) {
      return name;
    }
  }

  return null;
}

module.exports = { extractScripts, detectScriptLibrary };
