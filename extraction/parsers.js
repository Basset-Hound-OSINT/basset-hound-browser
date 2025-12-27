/**
 * Basset Hound Browser - Content Parsers Module
 * Provides specialized parsers for extracting structured data from HTML
 * Includes OpenGraph, Twitter Card, JSON-LD/Schema.org, and Microdata parsers
 */

/**
 * Base Parser class with common utility methods
 */
class BaseParser {
  /**
   * Decode HTML entities in a string
   * @param {string} str - String with potential HTML entities
   * @returns {string} Decoded string
   */
  decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return '';

    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '=',
      '&nbsp;': ' ',
      '&copy;': '\u00A9',
      '&reg;': '\u00AE',
      '&trade;': '\u2122',
      '&mdash;': '\u2014',
      '&ndash;': '\u2013',
      '&hellip;': '\u2026',
      '&lsquo;': '\u2018',
      '&rsquo;': '\u2019',
      '&ldquo;': '\u201C',
      '&rdquo;': '\u201D'
    };

    let result = str;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'gi'), char);
    }

    // Handle numeric entities
    result = result.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

    return result;
  }

  /**
   * Extract attribute value from a tag string
   * @param {string} tag - HTML tag string
   * @param {string} attrName - Attribute name to extract
   * @returns {string|null} Attribute value or null
   */
  extractAttribute(tag, attrName) {
    const patterns = [
      new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i'),
      new RegExp(`${attrName}\\s*=\\s*'([^']*)'`, 'i'),
      new RegExp(`${attrName}\\s*=\\s*([^\\s>]+)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = tag.match(pattern);
      if (match) {
        return this.decodeHtmlEntities(match[1].trim());
      }
    }

    return null;
  }

  /**
   * Check if attribute exists in tag (for boolean attributes)
   * @param {string} tag - HTML tag string
   * @param {string} attrName - Attribute name to check
   * @returns {boolean} Whether attribute exists
   */
  hasAttribute(tag, attrName) {
    const pattern = new RegExp(`\\s${attrName}(?:\\s|=|>|$)`, 'i');
    return pattern.test(tag);
  }

  /**
   * Trim and clean a string value
   * @param {string} str - String to clean
   * @returns {string} Cleaned string
   */
  cleanString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().replace(/\s+/g, ' ');
  }
}

/**
 * OpenGraph Parser
 * Extracts Open Graph meta tags from HTML
 * Reference: https://ogp.me/
 */
class OpenGraphParser extends BaseParser {
  constructor() {
    super();
    this.prefix = 'og:';

    // Standard OG properties
    this.standardProperties = [
      'title', 'type', 'url', 'image', 'description',
      'site_name', 'locale', 'locale:alternate', 'determiner'
    ];

    // Structured properties (with sub-properties)
    this.structuredProperties = {
      'image': ['url', 'secure_url', 'type', 'width', 'height', 'alt'],
      'video': ['url', 'secure_url', 'type', 'width', 'height', 'tag'],
      'audio': ['url', 'secure_url', 'type'],
      'music': ['duration', 'album', 'album:disc', 'album:track', 'musician', 'song', 'song:disc', 'song:track', 'release_date', 'creator'],
      'article': ['published_time', 'modified_time', 'expiration_time', 'author', 'section', 'tag'],
      'book': ['author', 'isbn', 'release_date', 'tag'],
      'profile': ['first_name', 'last_name', 'username', 'gender']
    };
  }

  /**
   * Parse Open Graph tags from HTML
   * @param {string} html - HTML content
   * @returns {Object} Parsed Open Graph data
   */
  parse(html) {
    const result = {
      success: true,
      data: {},
      properties: [],
      errors: [],
      warnings: []
    };

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Find all meta tags with property starting with "og:"
      const metaRegex = /<meta\s+[^>]*(?:property|name)\s*=\s*["']og:[^"']*["'][^>]*>/gi;
      const metaTags = html.match(metaRegex) || [];

      for (const tag of metaTags) {
        const property = this.extractAttribute(tag, 'property') || this.extractAttribute(tag, 'name');
        const content = this.extractAttribute(tag, 'content');

        if (property && property.startsWith('og:')) {
          const propName = property.substring(3); // Remove "og:" prefix

          result.properties.push({
            property: property,
            content: content || ''
          });

          // Handle structured properties (e.g., og:image:width)
          if (propName.includes(':')) {
            const parts = propName.split(':');
            const mainProp = parts[0];
            const subProp = parts.slice(1).join(':');

            if (!result.data[mainProp]) {
              result.data[mainProp] = {};
            }

            if (typeof result.data[mainProp] === 'string') {
              // Convert to object with 'value' and sub-property
              const existingValue = result.data[mainProp];
              result.data[mainProp] = { value: existingValue };
            }

            result.data[mainProp][subProp] = content;
          } else {
            // Check if we already have structured data for this property
            if (result.data[propName] && typeof result.data[propName] === 'object') {
              result.data[propName].value = content;
            } else {
              result.data[propName] = content;
            }
          }
        }
      }

      // Add warnings for missing required properties
      const requiredProps = ['title', 'type', 'image', 'url'];
      for (const prop of requiredProps) {
        if (!result.data[prop]) {
          result.warnings.push(`Missing recommended og:${prop} property`);
        }
      }

      result.count = result.properties.length;

    } catch (error) {
      result.success = false;
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }
}

/**
 * Twitter Card Parser
 * Extracts Twitter Card meta tags from HTML
 * Reference: https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup
 */
class TwitterCardParser extends BaseParser {
  constructor() {
    super();
    this.prefix = 'twitter:';

    // Supported Twitter Card properties
    this.properties = [
      'card', 'site', 'site:id', 'creator', 'creator:id',
      'description', 'title', 'image', 'image:alt',
      'player', 'player:width', 'player:height', 'player:stream',
      'app:name:iphone', 'app:id:iphone', 'app:url:iphone',
      'app:name:ipad', 'app:id:ipad', 'app:url:ipad',
      'app:name:googleplay', 'app:id:googleplay', 'app:url:googleplay'
    ];

    // Valid card types
    this.cardTypes = ['summary', 'summary_large_image', 'app', 'player'];
  }

  /**
   * Parse Twitter Card tags from HTML
   * @param {string} html - HTML content
   * @returns {Object} Parsed Twitter Card data
   */
  parse(html) {
    const result = {
      success: true,
      data: {},
      properties: [],
      errors: [],
      warnings: []
    };

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Find all meta tags with name starting with "twitter:"
      const metaRegex = /<meta\s+[^>]*(?:property|name)\s*=\s*["']twitter:[^"']*["'][^>]*>/gi;
      const metaTags = html.match(metaRegex) || [];

      for (const tag of metaTags) {
        const name = this.extractAttribute(tag, 'name') || this.extractAttribute(tag, 'property');
        const content = this.extractAttribute(tag, 'content');

        if (name && name.startsWith('twitter:')) {
          const propName = name.substring(8); // Remove "twitter:" prefix

          result.properties.push({
            name: name,
            content: content || ''
          });

          // Handle structured properties (e.g., twitter:player:width)
          if (propName.includes(':')) {
            const parts = propName.split(':');
            const mainProp = parts[0];
            const subProp = parts.slice(1).join(':');

            if (!result.data[mainProp]) {
              result.data[mainProp] = {};
            }

            if (typeof result.data[mainProp] === 'string') {
              const existingValue = result.data[mainProp];
              result.data[mainProp] = { value: existingValue };
            }

            result.data[mainProp][subProp] = content;
          } else {
            if (result.data[propName] && typeof result.data[propName] === 'object') {
              result.data[propName].value = content;
            } else {
              result.data[propName] = content;
            }
          }
        }
      }

      // Validate card type
      if (result.data.card && !this.cardTypes.includes(result.data.card)) {
        result.warnings.push(`Unknown card type: ${result.data.card}`);
      }

      // Add warnings for missing required properties
      if (!result.data.card) {
        result.warnings.push('Missing required twitter:card property');
      }

      result.count = result.properties.length;

    } catch (error) {
      result.success = false;
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }
}

/**
 * JSON-LD / Schema.org Parser
 * Extracts JSON-LD structured data from HTML
 * Reference: https://json-ld.org/ and https://schema.org/
 */
class JsonLdParser extends BaseParser {
  constructor() {
    super();

    // Common Schema.org types
    this.commonTypes = [
      'Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'WebSite',
      'Product', 'Offer', 'Review', 'Rating', 'AggregateRating',
      'Organization', 'LocalBusiness', 'Person', 'Place',
      'Event', 'Recipe', 'FAQPage', 'HowTo', 'BreadcrumbList',
      'VideoObject', 'ImageObject', 'SoftwareApplication'
    ];
  }

  /**
   * Parse JSON-LD scripts from HTML
   * @param {string} html - HTML content
   * @returns {Object} Parsed JSON-LD data
   */
  parse(html) {
    const result = {
      success: true,
      data: [],
      types: [],
      errors: [],
      warnings: []
    };

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Find all script tags with type="application/ld+json"
      const scriptRegex = /<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;

      while ((match = scriptRegex.exec(html)) !== null) {
        const jsonContent = match[1].trim();

        if (jsonContent) {
          try {
            const parsed = JSON.parse(jsonContent);

            // Handle both single objects and arrays
            const items = Array.isArray(parsed) ? parsed : [parsed];

            for (const item of items) {
              result.data.push(item);

              // Extract type information
              const type = item['@type'];
              if (type) {
                const types = Array.isArray(type) ? type : [type];
                for (const t of types) {
                  if (!result.types.includes(t)) {
                    result.types.push(t);
                  }
                }
              }

              // Handle @graph property (multiple entities in one script)
              if (item['@graph'] && Array.isArray(item['@graph'])) {
                for (const graphItem of item['@graph']) {
                  if (graphItem['@type']) {
                    const graphTypes = Array.isArray(graphItem['@type']) ? graphItem['@type'] : [graphItem['@type']];
                    for (const gt of graphTypes) {
                      if (!result.types.includes(gt)) {
                        result.types.push(gt);
                      }
                    }
                  }
                }
              }
            }
          } catch (parseError) {
            result.errors.push(`JSON parse error: ${parseError.message}`);
          }
        }
      }

      result.count = result.data.length;

      // Add warnings for empty results
      if (result.data.length === 0 && result.errors.length === 0) {
        result.warnings.push('No JSON-LD structured data found');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Get entities of a specific type from parsed data
   * @param {Array} data - Parsed JSON-LD data array
   * @param {string} typeName - Schema.org type to filter by
   * @returns {Array} Filtered entities
   */
  getByType(data, typeName) {
    const entities = [];

    for (const item of data) {
      const itemType = item['@type'];
      if (itemType) {
        const types = Array.isArray(itemType) ? itemType : [itemType];
        if (types.includes(typeName)) {
          entities.push(item);
        }
      }

      // Also check @graph
      if (item['@graph'] && Array.isArray(item['@graph'])) {
        for (const graphItem of item['@graph']) {
          const graphType = graphItem['@type'];
          if (graphType) {
            const types = Array.isArray(graphType) ? graphType : [graphType];
            if (types.includes(typeName)) {
              entities.push(graphItem);
            }
          }
        }
      }
    }

    return entities;
  }
}

/**
 * Microdata Parser
 * Extracts HTML5 Microdata (itemscope, itemtype, itemprop) from HTML
 * Reference: https://html.spec.whatwg.org/multipage/microdata.html
 */
class MicrodataParser extends BaseParser {
  constructor() {
    super();
  }

  /**
   * Parse Microdata from HTML
   * @param {string} html - HTML content
   * @returns {Object} Parsed Microdata
   */
  parse(html) {
    const result = {
      success: true,
      data: [],
      types: [],
      properties: [],
      errors: [],
      warnings: []
    };

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Find all elements with itemscope
      const items = this.extractItemScopes(html);

      for (const item of items) {
        result.data.push(item);
        if (item.type && !result.types.includes(item.type)) {
          result.types.push(item.type);
        }
      }

      // Also extract standalone itemprop elements
      const propRegex = /<[^>]+\sitemprop\s*=\s*["']([^"']+)["'][^>]*>([^<]*)</gi;
      let match;

      while ((match = propRegex.exec(html)) !== null) {
        const propName = match[1];
        if (!result.properties.some(p => p.name === propName)) {
          result.properties.push({
            name: propName,
            found: true
          });
        }
      }

      result.count = result.data.length;

      if (result.data.length === 0 && result.errors.length === 0) {
        result.warnings.push('No Microdata found in HTML');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Extract itemscope elements and their properties
   * @param {string} html - HTML content
   * @returns {Array} Array of item objects
   */
  extractItemScopes(html) {
    const items = [];

    // Find tags with itemscope
    const itemscopeRegex = /<([a-z][a-z0-9]*)\s+[^>]*itemscope[^>]*>/gi;
    let match;

    while ((match = itemscopeRegex.exec(html)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];

      const item = {
        tag: tagName,
        type: null,
        id: null,
        properties: {}
      };

      // Extract itemtype
      const itemtype = this.extractAttribute(fullTag, 'itemtype');
      if (itemtype) {
        item.type = itemtype;
        // Extract the type name from the URL
        const typeMatch = itemtype.match(/schema\.org\/(\w+)/i);
        if (typeMatch) {
          item.typeName = typeMatch[1];
        }
      }

      // Extract itemid
      const itemid = this.extractAttribute(fullTag, 'itemid');
      if (itemid) {
        item.id = itemid;
      }

      // Find the matching closing tag and extract properties within
      const startIndex = match.index;
      const closingTag = this.findClosingTag(html, tagName, startIndex);

      if (closingTag > startIndex) {
        const itemContent = html.substring(startIndex, closingTag);
        item.properties = this.extractItemProperties(itemContent);
      }

      items.push(item);
    }

    return items;
  }

  /**
   * Find the closing tag position
   * @param {string} html - HTML content
   * @param {string} tagName - Tag name to find
   * @param {number} startIndex - Starting position
   * @returns {number} Position of closing tag
   */
  findClosingTag(html, tagName, startIndex) {
    const openPattern = new RegExp(`<${tagName}[\\s>]`, 'gi');
    const closePattern = new RegExp(`</${tagName}>`, 'gi');

    let depth = 1;
    let pos = startIndex + 1;

    while (depth > 0 && pos < html.length) {
      openPattern.lastIndex = pos;
      closePattern.lastIndex = pos;

      const openMatch = openPattern.exec(html);
      const closeMatch = closePattern.exec(html);

      if (!closeMatch) {
        break;
      }

      if (openMatch && openMatch.index < closeMatch.index) {
        depth++;
        pos = openMatch.index + 1;
      } else {
        depth--;
        pos = closeMatch.index + closeMatch[0].length;
        if (depth === 0) {
          return pos;
        }
      }
    }

    return html.length;
  }

  /**
   * Extract itemprop values from item content
   * @param {string} content - HTML content within an itemscope
   * @returns {Object} Properties object
   */
  extractItemProperties(content) {
    const properties = {};

    // Match elements with itemprop attribute
    const propRegex = /<([a-z][a-z0-9]*)\s+[^>]*itemprop\s*=\s*["']([^"']+)["'][^>]*(?:\/>|>([^<]*)<)/gi;
    let match;

    while ((match = propRegex.exec(content)) !== null) {
      const tagName = match[1].toLowerCase();
      const propName = match[2];
      const textContent = match[3] || '';
      const fullTag = match[0];

      let value;

      // Determine value based on tag type
      switch (tagName) {
        case 'meta':
          value = this.extractAttribute(fullTag, 'content');
          break;
        case 'img':
          value = this.extractAttribute(fullTag, 'src');
          break;
        case 'a':
        case 'link':
          value = this.extractAttribute(fullTag, 'href');
          break;
        case 'time':
          value = this.extractAttribute(fullTag, 'datetime') || this.cleanString(textContent);
          break;
        case 'data':
          value = this.extractAttribute(fullTag, 'value') || this.cleanString(textContent);
          break;
        default:
          value = this.cleanString(this.decodeHtmlEntities(textContent));
      }

      // Handle multiple values for same property
      if (properties[propName]) {
        if (!Array.isArray(properties[propName])) {
          properties[propName] = [properties[propName]];
        }
        properties[propName].push(value);
      } else {
        properties[propName] = value;
      }
    }

    return properties;
  }
}

/**
 * RDFa Parser (basic support)
 * Extracts RDFa attributes from HTML
 * Reference: https://www.w3.org/TR/rdfa-primer/
 */
class RdfaParser extends BaseParser {
  constructor() {
    super();

    // Common RDFa prefixes
    this.knownPrefixes = {
      'schema': 'http://schema.org/',
      'og': 'http://ogp.me/ns#',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
    };
  }

  /**
   * Parse RDFa from HTML
   * @param {string} html - HTML content
   * @returns {Object} Parsed RDFa data
   */
  parse(html) {
    const result = {
      success: true,
      data: [],
      prefixes: {},
      errors: [],
      warnings: []
    };

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Extract prefix declarations
      const prefixRegex = /prefix\s*=\s*["']([^"']+)["']/gi;
      let match;

      while ((match = prefixRegex.exec(html)) !== null) {
        const prefixDecl = match[1];
        const prefixParts = prefixDecl.split(/\s+/);

        for (let i = 0; i < prefixParts.length - 1; i += 2) {
          const prefix = prefixParts[i].replace(':', '');
          const uri = prefixParts[i + 1];
          result.prefixes[prefix] = uri;
        }
      }

      // Find elements with typeof attribute (main RDFa resource declarations)
      const typeofRegex = /<([a-z][a-z0-9]*)\s+[^>]*typeof\s*=\s*["']([^"']+)["'][^>]*>/gi;

      while ((match = typeofRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const typeValue = match[2];

        const item = {
          tag: tagName,
          typeof: typeValue,
          vocab: this.extractAttribute(fullTag, 'vocab'),
          resource: this.extractAttribute(fullTag, 'resource'),
          about: this.extractAttribute(fullTag, 'about'),
          properties: []
        };

        result.data.push(item);
      }

      // Find elements with property attribute
      const propertyRegex = /<([a-z][a-z0-9]*)\s+[^>]*property\s*=\s*["']([^"']+)["'][^>]*>([^<]*)?</gi;

      while ((match = propertyRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const property = match[2];
        const textContent = match[3] || '';

        let value = this.extractAttribute(fullTag, 'content') ||
                    this.extractAttribute(fullTag, 'href') ||
                    this.extractAttribute(fullTag, 'src') ||
                    this.cleanString(this.decodeHtmlEntities(textContent));

        result.data.push({
          tag: tagName,
          property: property,
          value: value
        });
      }

      result.count = result.data.length;

      if (result.data.length === 0 && result.errors.length === 0) {
        result.warnings.push('No RDFa structured data found');
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
  }
}

// Export all parsers
module.exports = {
  BaseParser,
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser
};
