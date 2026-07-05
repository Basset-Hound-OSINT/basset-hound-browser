/**
 * Basset Hound Browser - Link Extractor
 * Extracts and categorizes anchor and image-map (area) links from HTML.
 * Pure function delegated from ExtractionManager; receives the manager instance as `self`
 * for shared helpers (getHostname, decodeHtmlEntities, extractAttribute, hasAttribute, resolveUrl).
 *
 * @module extraction/manager/links
 */

/**
 * Extract all links from HTML with categorization
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for relative link resolution
 * @param {ExtractionManager} self - Manager instance providing shared helpers
 * @returns {Object} Extracted and categorized links
 */
function extractLinks(html, baseUrl = '', self) {
  const result = {
    success: true,
    data: {
      internal: [],
      external: [],
      mailto: [],
      tel: [],
      anchor: [],
      javascript: [],
      other: []
    },
    all: [],
    count: 0,
    errors: [],
    warnings: []
  };

  self.stats.totalExtractions++;
  self.stats.linkExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    const baseHostname = baseUrl ? self.getHostname(baseUrl) : '';

    // Find all anchor tags
    const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const fullTag = match[0];
      const textContent = match[2].replace(/<[^>]+>/g, '').trim();

      const link = {
        href: href,
        text: self.decodeHtmlEntities(textContent).substring(0, 200),
        title: self.extractAttribute(fullTag, 'title'),
        rel: self.extractAttribute(fullTag, 'rel'),
        target: self.extractAttribute(fullTag, 'target'),
        download: self.hasAttribute(fullTag, 'download')
      };

      result.all.push(link);
      result.count++;

      // Categorize the link
      if (href.startsWith('mailto:')) {
        link.email = href.substring(7).split('?')[0];
        result.data.mailto.push(link);
      } else if (href.startsWith('tel:')) {
        link.phone = href.substring(4);
        result.data.tel.push(link);
      } else if (href.startsWith('#')) {
        link.anchor = href.substring(1);
        result.data.anchor.push(link);
      } else if (href.startsWith('javascript:')) {
        result.data.javascript.push(link);
      } else if (href.match(/^(ftp|file|data):/i)) {
        result.data.other.push(link);
      } else {
        // HTTP/HTTPS link - resolve and categorize
        const resolvedUrl = self.resolveUrl(href, baseUrl);
        link.resolvedHref = resolvedUrl;

        const linkHostname = self.getHostname(resolvedUrl);

        if (baseHostname && linkHostname) {
          // Compare hostnames (handle www prefix)
          const normalizedBase = baseHostname.replace(/^www\./i, '');
          const normalizedLink = linkHostname.replace(/^www\./i, '');

          if (normalizedLink === normalizedBase ||
              normalizedLink.endsWith('.' + normalizedBase)) {
            result.data.internal.push(link);
          } else {
            result.data.external.push(link);
          }
        } else {
          // Assume internal if no base URL provided
          result.data.internal.push(link);
        }
      }
    }

    // Also extract links from <area> tags (image maps)
    const areaRegex = /<area\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    while ((match = areaRegex.exec(html)) !== null) {
      const href = match[1];
      const fullTag = match[0];

      const link = {
        href: href,
        alt: self.extractAttribute(fullTag, 'alt'),
        title: self.extractAttribute(fullTag, 'title'),
        shape: self.extractAttribute(fullTag, 'shape'),
        isAreaLink: true
      };

      result.all.push(link);
      result.count++;

      // Categorize (simplified for area links)
      if (href.startsWith('mailto:')) {
        result.data.mailto.push(link);
      } else if (href.startsWith('tel:')) {
        result.data.tel.push(link);
      } else if (href.startsWith('#')) {
        result.data.anchor.push(link);
      } else {
        const resolvedUrl = self.resolveUrl(href, baseUrl);
        link.resolvedHref = resolvedUrl;
        const linkHostname = self.getHostname(resolvedUrl);
        const normalizedBase = baseHostname.replace(/^www\./i, '');
        const normalizedLink = linkHostname.replace(/^www\./i, '');

        if (!baseHostname || normalizedLink === normalizedBase) {
          result.data.internal.push(link);
        } else {
          result.data.external.push(link);
        }
      }
    }

    // Summary counts
    result.summary = {
      internal: result.data.internal.length,
      external: result.data.external.length,
      mailto: result.data.mailto.length,
      tel: result.data.tel.length,
      anchor: result.data.anchor.length,
      javascript: result.data.javascript.length,
      other: result.data.other.length,
      total: result.count
    };

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

module.exports = { extractLinks };
