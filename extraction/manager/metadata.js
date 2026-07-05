/**
 * Basset Hound Browser - Metadata Extractor
 * Extracts standard meta tags, Open Graph, Twitter Cards, Dublin Core, and link metadata.
 * Pure function delegated from ExtractionManager; receives the manager instance as `self`
 * for shared helpers (decodeHtmlEntities, extractAttribute, resolveUrl) and parsers.
 *
 * @module extraction/manager/metadata
 */

/**
 * Extract all metadata from HTML
 * Includes standard meta tags, OG tags, Twitter cards, and more
 * @param {string} html - HTML content
 * @param {string} url - Page URL (for context)
 * @param {ExtractionManager} self - Manager instance providing shared helpers/parsers
 * @returns {Object} Extracted metadata
 */
function extractMetadata(html, url = '', self) {
  const result = {
    success: true,
    data: {
      basic: {},
      openGraph: {},
      twitterCard: {},
      dublin: {},
      other: {}
    },
    count: 0,
    errors: [],
    warnings: []
  };

  self.stats.totalExtractions++;
  self.stats.metadataExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      result.data.basic.title = self.decodeHtmlEntities(titleMatch[1].trim());
      result.count++;
    }

    // Extract base href if present
    const baseMatch = html.match(/<base[^>]+href\s*=\s*["']([^"']+)["']/i);
    if (baseMatch) {
      result.data.basic.baseHref = baseMatch[1];
    }

    // Extract charset
    const charsetMatch = html.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s>]+)/i) ||
                        html.match(/<meta[^>]+content\s*=\s*["'][^"']*charset=([^"'\s;]+)/i);
    if (charsetMatch) {
      result.data.basic.charset = charsetMatch[1];
      result.count++;
    }

    // Extract viewport
    const viewportMatch = html.match(/<meta[^>]+name\s*=\s*["']viewport["'][^>]+content\s*=\s*["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']viewport["']/i);
    if (viewportMatch) {
      result.data.basic.viewport = viewportMatch[1];
      result.count++;
    }

    // Extract all standard meta tags
    const metaRegex = /<meta\s+[^>]*>/gi;
    const metaTags = html.match(metaRegex) || [];

    for (const tag of metaTags) {
      const name = self.extractAttribute(tag, 'name');
      const property = self.extractAttribute(tag, 'property');
      const httpEquiv = self.extractAttribute(tag, 'http-equiv');
      const content = self.extractAttribute(tag, 'content');

      if (name && content) {
        const nameLower = name.toLowerCase();

        // Categorize by type
        if (nameLower.startsWith('dc.') || nameLower.startsWith('dcterms.')) {
          result.data.dublin[name] = content;
        } else if (nameLower.startsWith('twitter:')) {
          // Handled by Twitter parser
        } else if (['description', 'keywords', 'author', 'robots', 'generator',
          'copyright', 'language', 'rating', 'distribution',
          'revisit-after', 'classification', 'category'].includes(nameLower)) {
          result.data.basic[nameLower] = content;
        } else {
          result.data.other[name] = content;
        }
        result.count++;
      }

      if (httpEquiv && content) {
        result.data.basic[`http-equiv:${httpEquiv.toLowerCase()}`] = content;
        result.count++;
      }
    }

    // Extract canonical URL
    const canonicalMatch = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i) ||
                          html.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']canonical["']/i);
    if (canonicalMatch) {
      result.data.basic.canonical = self.resolveUrl(canonicalMatch[1], url);
      result.count++;
    }

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]+href\s*=\s*["']([^"']+)["']/i) ||
                        html.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["'](?:shortcut )?icon["']/i);
    if (faviconMatch) {
      result.data.basic.favicon = self.resolveUrl(faviconMatch[1], url);
      result.count++;
    }

    // Extract Apple touch icon
    const appleTouchMatch = html.match(/<link[^>]+rel\s*=\s*["']apple-touch-icon[^"']*["'][^>]+href\s*=\s*["']([^"']+)["']/i);
    if (appleTouchMatch) {
      result.data.basic.appleTouchIcon = self.resolveUrl(appleTouchMatch[1], url);
      result.count++;
    }

    // Extract Open Graph data
    const ogResult = self.openGraphParser.parse(html);
    if (ogResult.success && ogResult.count > 0) {
      result.data.openGraph = ogResult.data;
      result.count += ogResult.count;
      result.warnings.push(...ogResult.warnings);
    }

    // Extract Twitter Card data
    const twitterResult = self.twitterCardParser.parse(html);
    if (twitterResult.success && twitterResult.count > 0) {
      result.data.twitterCard = twitterResult.data;
      result.count += twitterResult.count;
      result.warnings.push(...twitterResult.warnings);
    }

    // Extract alternate language versions
    const alternates = [];
    const alternateRegex = /<link[^>]+rel\s*=\s*["']alternate["'][^>]*>/gi;
    let altMatch;

    while ((altMatch = alternateRegex.exec(html)) !== null) {
      const tag = altMatch[0];
      const hreflang = self.extractAttribute(tag, 'hreflang');
      const href = self.extractAttribute(tag, 'href');
      const type = self.extractAttribute(tag, 'type');

      if (href) {
        alternates.push({
          href: self.resolveUrl(href, url),
          hreflang: hreflang || null,
          type: type || null
        });
      }
    }

    if (alternates.length > 0) {
      result.data.basic.alternates = alternates;
      result.count += alternates.length;
    }

    // Add page URL to result if provided
    if (url) {
      result.data.pageUrl = url;
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

module.exports = { extractMetadata };
