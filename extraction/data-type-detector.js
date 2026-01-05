/**
 * Basset Hound Browser - Data Type Detection Engine
 *
 * Automatically detects and extracts various data types from web content
 * for ingestion into the basset-hound OSINT platform.
 *
 * Supported Data Types:
 * - Email addresses (RFC 5322 compliant)
 * - Phone numbers (international formats, E.164)
 * - Cryptocurrency addresses (BTC, ETH, XMR, etc.)
 * - Social media handles (@mentions, profile URLs)
 * - IP addresses (IPv4, IPv6)
 * - Domain names
 * - URLs
 * - Images (with metadata extraction)
 * - Addresses (US and international formats)
 * - Dates and times
 * - Prices and currency amounts
 *
 * @module extraction/data-type-detector
 */

const { BaseParser } = require('./parsers');

/**
 * Detection patterns for various data types
 * Each pattern includes regex, validator, and mapping to basset-hound orphan types
 */
const DETECTION_PATTERNS = {
  // Email addresses
  email: {
    name: 'Email Address',
    patterns: [
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g
    ],
    orphanType: 'email',
    validator: 'email',
    contextChars: 50,
    priority: 1
  },

  // Phone numbers - multiple international formats
  phone_us: {
    name: 'Phone Number (US)',
    patterns: [
      /\b(?:\+?1[-.\s]?)?\(?[2-9][0-9]{2}\)?[-.\s]?[2-9][0-9]{2}[-.\s]?[0-9]{4}\b/g
    ],
    orphanType: 'phone',
    validator: 'phone',
    contextChars: 40,
    priority: 2,
    normalize: value => {
      // Normalize to E.164 format
      const digits = value.replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      return value;
    }
  },

  phone_international: {
    name: 'Phone Number (International)',
    patterns: [
      /\+[1-9]\d{1,14}\b/g,
      /\b00[1-9]\d{1,14}\b/g
    ],
    orphanType: 'phone',
    validator: 'phone',
    contextChars: 40,
    priority: 2
  },

  phone_uk: {
    name: 'Phone Number (UK)',
    patterns: [
      /\b(?:\+?44[-.\s]?)?(?:\(?0\)?[-.\s]?)?[1-9]\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g
    ],
    orphanType: 'phone',
    validator: 'phone',
    contextChars: 40,
    priority: 2
  },

  // Cryptocurrency addresses
  crypto_btc: {
    name: 'Bitcoin Address',
    patterns: [
      /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g
    ],
    orphanType: 'crypto_address',
    validator: 'btc',
    contextChars: 60,
    priority: 3,
    metadata: { currency: 'BTC', network: 'bitcoin' }
  },

  crypto_eth: {
    name: 'Ethereum Address',
    patterns: [
      /\b0x[a-fA-F0-9]{40}\b/g
    ],
    orphanType: 'crypto_address',
    validator: 'eth',
    contextChars: 60,
    priority: 3,
    metadata: { currency: 'ETH', network: 'ethereum' }
  },

  crypto_xmr: {
    name: 'Monero Address',
    patterns: [
      /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g
    ],
    orphanType: 'crypto_address',
    validator: 'xmr',
    contextChars: 60,
    priority: 3,
    metadata: { currency: 'XMR', network: 'monero' }
  },

  crypto_ltc: {
    name: 'Litecoin Address',
    patterns: [
      /\b[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}\b/g,
      /\bltc1[a-zA-HJ-NP-Z0-9]{39,59}\b/g
    ],
    orphanType: 'crypto_address',
    validator: 'ltc',
    contextChars: 60,
    priority: 3,
    metadata: { currency: 'LTC', network: 'litecoin' }
  },

  // Social media handles and profiles
  social_twitter: {
    name: 'Twitter/X Handle',
    patterns: [
      /@([a-zA-Z0-9_]{1,15})\b/g,
      /(?:twitter|x)\.com\/([a-zA-Z0-9_]{1,15})\b/gi
    ],
    orphanType: 'social_media',
    contextChars: 40,
    priority: 4,
    metadata: { platform: 'twitter' },
    extractValue: (match) => {
      // Extract username from URL or handle
      if (match.includes('.com/')) {
        const parts = match.split('/');
        return '@' + parts[parts.length - 1];
      }
      return match.startsWith('@') ? match : '@' + match;
    }
  },

  social_instagram: {
    name: 'Instagram Handle',
    patterns: [
      /instagram\.com\/([a-zA-Z0-9_.]{1,30})\b/gi
    ],
    orphanType: 'social_media',
    contextChars: 40,
    priority: 4,
    metadata: { platform: 'instagram' },
    extractValue: (match) => {
      if (match.includes('.com/')) {
        const parts = match.split('/');
        return '@' + parts[parts.length - 1];
      }
      return match;
    }
  },

  social_linkedin: {
    name: 'LinkedIn Profile',
    patterns: [
      /linkedin\.com\/(?:in|company)\/([a-zA-Z0-9-]{3,100})\b/gi
    ],
    orphanType: 'social_media',
    contextChars: 50,
    priority: 4,
    metadata: { platform: 'linkedin' }
  },

  social_facebook: {
    name: 'Facebook Profile',
    patterns: [
      /facebook\.com\/([a-zA-Z0-9.]{5,})\b/gi,
      /fb\.com\/([a-zA-Z0-9.]{5,})\b/gi
    ],
    orphanType: 'social_media',
    contextChars: 50,
    priority: 4,
    metadata: { platform: 'facebook' }
  },

  social_github: {
    name: 'GitHub Profile',
    patterns: [
      /github\.com\/([a-zA-Z0-9-]{1,39})\b/gi
    ],
    orphanType: 'username',
    contextChars: 50,
    priority: 4,
    metadata: { platform: 'github' }
  },

  social_telegram: {
    name: 'Telegram Handle',
    patterns: [
      /t\.me\/([a-zA-Z0-9_]{5,32})\b/gi,
      /@([a-zA-Z][a-zA-Z0-9_]{4,31})\b/g
    ],
    orphanType: 'social_media',
    contextChars: 40,
    priority: 4,
    metadata: { platform: 'telegram' }
  },

  // IP addresses
  ip_v4: {
    name: 'IPv4 Address',
    patterns: [
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
    ],
    orphanType: 'ip_address',
    validator: 'ipv4',
    contextChars: 40,
    priority: 5
  },

  ip_v6: {
    name: 'IPv6 Address',
    patterns: [
      /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
      /\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b/g,
      /\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g
    ],
    orphanType: 'ip_address',
    validator: 'ipv6',
    contextChars: 50,
    priority: 5
  },

  // Domain names
  domain: {
    name: 'Domain Name',
    patterns: [
      /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g
    ],
    orphanType: 'domain',
    validator: 'domain',
    contextChars: 50,
    priority: 6,
    // Exclude common false positives
    excludePatterns: [
      /\.(jpg|jpeg|png|gif|svg|css|js|html|htm|php|asp|pdf|doc|docx|xls|xlsx)$/i
    ]
  },

  // URLs
  url: {
    name: 'URL',
    patterns: [
      /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
    ],
    orphanType: 'url',
    validator: 'url',
    contextChars: 30,
    priority: 7
  },

  // MAC addresses
  mac_address: {
    name: 'MAC Address',
    patterns: [
      /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
      /\b(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}\b/g
    ],
    orphanType: 'mac_address',
    contextChars: 40,
    priority: 8
  },

  // IMEI numbers
  imei: {
    name: 'IMEI Number',
    patterns: [
      /\b\d{15}\b/g,
      /\b\d{2}-\d{6}-\d{6}-\d\b/g
    ],
    orphanType: 'imei',
    validator: 'imei',
    contextChars: 40,
    priority: 8
  },

  // US Social Security Numbers (with appropriate caution)
  ssn: {
    name: 'SSN (US)',
    patterns: [
      /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g
    ],
    orphanType: 'ssn',
    contextChars: 40,
    priority: 9,
    sensitive: true
  },

  // Credit card numbers (for detection, not storage)
  credit_card: {
    name: 'Credit Card',
    patterns: [
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g
    ],
    orphanType: 'account_number',
    validator: 'luhn',
    contextChars: 40,
    priority: 9,
    sensitive: true
  },

  // License plates (US format)
  license_plate_us: {
    name: 'License Plate (US)',
    patterns: [
      /\b[A-Z0-9]{1,3}[-\s]?[A-Z0-9]{1,4}[-\s]?[A-Z0-9]{1,4}\b/g
    ],
    orphanType: 'license_plate',
    contextChars: 40,
    priority: 10
  },

  // Dates
  date_iso: {
    name: 'Date (ISO)',
    patterns: [
      /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g
    ],
    orphanType: 'other',
    contextChars: 30,
    priority: 11,
    metadata: { type: 'date', format: 'ISO' }
  },

  date_us: {
    name: 'Date (US)',
    patterns: [
      /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g
    ],
    orphanType: 'other',
    contextChars: 30,
    priority: 11,
    metadata: { type: 'date', format: 'US' }
  },

  // Currency/Prices
  currency_usd: {
    name: 'Price (USD)',
    patterns: [
      /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g
    ],
    orphanType: 'other',
    contextChars: 30,
    priority: 12,
    metadata: { type: 'currency', currency: 'USD' }
  },

  currency_eur: {
    name: 'Price (EUR)',
    patterns: [
      /€\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g,
      /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*€/g
    ],
    orphanType: 'other',
    contextChars: 30,
    priority: 12,
    metadata: { type: 'currency', currency: 'EUR' }
  },

  // US Addresses
  address_us: {
    name: 'US Address',
    patterns: [
      /\d{1,5}\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Circle|Cir|Trail|Tr)\.?\s*(?:,?\s*(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?/gi
    ],
    orphanType: 'other',
    contextChars: 80,
    priority: 13,
    metadata: { type: 'address', country: 'US' }
  }
};

/**
 * Validators for detected data
 */
const VALIDATORS = {
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  phone: (value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  },

  btc: (value) => {
    // Basic Bitcoin address validation
    if (value.startsWith('bc1')) {
      return value.length >= 42 && value.length <= 62;
    }
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value);
  },

  eth: (value) => {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  },

  xmr: (value) => {
    return /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/.test(value);
  },

  ltc: (value) => {
    if (value.startsWith('ltc1')) {
      return value.length >= 42 && value.length <= 62;
    }
    return /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(value);
  },

  ipv4: (value) => {
    const parts = value.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  },

  ipv6: (value) => {
    // Basic IPv6 validation
    const parts = value.split(':');
    return parts.length >= 2 && parts.length <= 8;
  },

  domain: (value) => {
    // Basic domain validation
    const parts = value.split('.');
    if (parts.length < 2) return false;
    const tld = parts[parts.length - 1];
    return tld.length >= 2 && /^[a-zA-Z]+$/.test(tld);
  },

  url: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  imei: (value) => {
    // IMEI is 15 digits with Luhn checksum
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 15) return false;
    return VALIDATORS.luhn(digits);
  },

  luhn: (value) => {
    // Luhn algorithm for credit card/IMEI validation
    const digits = value.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }
};

/**
 * DataTypeDetector class
 * Main engine for detecting data types in web content
 */
class DataTypeDetector extends BaseParser {
  /**
   * Create a new DataTypeDetector
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();

    this.options = {
      enabledTypes: Object.keys(DETECTION_PATTERNS),
      confidenceThreshold: 0.5,
      maxItemsPerType: 100,
      includeContext: true,
      contextChars: 50,
      validateResults: true,
      deduplicateResults: true,
      ...options
    };

    // Statistics
    this.stats = {
      totalDetections: 0,
      detectionsByType: {},
      validationFailures: 0,
      duplicatesRemoved: 0
    };
  }

  /**
   * Detect all data types in HTML content
   * @param {string} html - HTML content to analyze
   * @param {string} url - Source URL for context
   * @returns {Object} Detection results
   */
  detectAll(html, url = '') {
    const startTime = Date.now();
    const result = {
      success: true,
      pageUrl: url,
      detectedAt: new Date().toISOString(),
      totalItems: 0,
      items: [],
      summary: {
        byType: {}
      },
      processingTime: 0,
      errors: [],
      warnings: []
    };

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    // Extract text content from HTML for pattern matching
    const textContent = this.extractTextContent(html);
    const seenValues = new Set();
    let itemId = 1;

    // Process each enabled detection type
    for (const typeKey of this.options.enabledTypes) {
      const typeConfig = DETECTION_PATTERNS[typeKey];
      if (!typeConfig) continue;

      try {
        const typeResults = this.detectType(
          typeKey,
          typeConfig,
          textContent,
          html,
          seenValues,
          () => `det_${String(itemId++).padStart(3, '0')}`
        );

        result.items.push(...typeResults);
        result.summary.byType[typeKey] = typeResults.length;
        this.stats.detectionsByType[typeKey] =
          (this.stats.detectionsByType[typeKey] || 0) + typeResults.length;

      } catch (error) {
        result.errors.push(`Error detecting ${typeKey}: ${error.message}`);
      }
    }

    // Sort by priority and position
    result.items.sort((a, b) => {
      const priorityDiff = (a.priority || 99) - (b.priority || 99);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.position?.start || 0) - (b.position?.start || 0);
    });

    result.totalItems = result.items.length;
    result.processingTime = Date.now() - startTime;
    this.stats.totalDetections += result.totalItems;

    return result;
  }

  /**
   * Detect a specific data type
   * @param {string} typeKey - Type identifier
   * @param {Object} typeConfig - Type configuration
   * @param {string} text - Text content to search
   * @param {string} html - Original HTML for context
   * @param {Set} seenValues - Set of already detected values (for deduplication)
   * @param {Function} idGenerator - Function to generate unique IDs
   * @returns {Array} Array of detected items
   */
  detectType(typeKey, typeConfig, text, html, seenValues, idGenerator) {
    const results = [];
    const { patterns, orphanType, validator, contextChars, priority, metadata,
            extractValue, normalize, excludePatterns, sensitive } = typeConfig;

    for (const pattern of patterns) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        let value = match[0];

        // Apply value extraction if defined
        if (extractValue) {
          value = extractValue(value);
        }

        // Apply normalization if defined
        const normalizedValue = normalize ? normalize(value) : value;

        // Check exclude patterns
        if (excludePatterns) {
          const shouldExclude = excludePatterns.some(ep => ep.test(value));
          if (shouldExclude) continue;
        }

        // Deduplication
        if (this.options.deduplicateResults) {
          const dedupeKey = `${typeKey}:${normalizedValue}`;
          if (seenValues.has(dedupeKey)) {
            this.stats.duplicatesRemoved++;
            continue;
          }
          seenValues.add(dedupeKey);
        }

        // Validation
        let confidence = 0.8; // Base confidence
        if (this.options.validateResults && validator && VALIDATORS[validator]) {
          const isValid = VALIDATORS[validator](normalizedValue);
          if (!isValid) {
            this.stats.validationFailures++;
            confidence = 0.3;
          } else {
            confidence = 0.95;
          }
        }

        // Skip if below confidence threshold
        if (confidence < this.options.confidenceThreshold) {
          continue;
        }

        // Limit items per type
        if (results.length >= this.options.maxItemsPerType) {
          break;
        }

        // Build result item
        const item = {
          id: idGenerator(),
          type: typeKey,
          typeName: typeConfig.name,
          value: value,
          confidence: confidence,
          orphanType: orphanType,
          priority: priority || 99,
          sensitive: sensitive || false
        };

        // Add normalized value if different
        if (normalizedValue !== value) {
          item.normalized = normalizedValue;
        }

        // Add context
        if (this.options.includeContext) {
          const chars = contextChars || this.options.contextChars;
          item.context = this.extractContext(text, match.index, value.length, chars);
          item.position = {
            start: match.index,
            end: match.index + value.length
          };
        }

        // Add metadata
        if (metadata) {
          item.metadata = { ...metadata };
        }

        // Add suggested tags
        item.suggestedTags = this.generateTags(typeKey, value, metadata);

        results.push(item);
      }
    }

    return results;
  }

  /**
   * Detect specific data types only
   * @param {string} html - HTML content
   * @param {string[]} types - Array of type keys to detect
   * @param {string} url - Source URL
   * @returns {Object} Detection results
   */
  detectTypes(html, types, url = '') {
    const savedTypes = this.options.enabledTypes;
    this.options.enabledTypes = types.filter(t => DETECTION_PATTERNS[t]);
    const result = this.detectAll(html, url);
    this.options.enabledTypes = savedTypes;
    return result;
  }

  /**
   * Extract text content from HTML (removing tags)
   * @param {string} html - HTML content
   * @returns {string} Plain text content
   */
  extractTextContent(html) {
    // Remove script and style tags with content
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');

    // Replace tags with spaces to preserve word boundaries
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ');

    return text;
  }

  /**
   * Extract context around a match
   * @param {string} text - Full text
   * @param {number} index - Match start index
   * @param {number} matchLength - Length of match
   * @param {number} contextChars - Characters of context to include
   * @returns {string} Context string with match highlighted
   */
  extractContext(text, index, matchLength, contextChars) {
    const start = Math.max(0, index - contextChars);
    const end = Math.min(text.length, index + matchLength + contextChars);

    let context = '';
    if (start > 0) context += '...';
    context += text.substring(start, end).trim();
    if (end < text.length) context += '...';

    return context;
  }

  /**
   * Generate suggested tags for a detection
   * @param {string} typeKey - Detection type
   * @param {string} value - Detected value
   * @param {Object} metadata - Type metadata
   * @returns {string[]} Array of suggested tags
   */
  generateTags(typeKey, value, metadata) {
    const tags = [typeKey.replace(/_/g, '-')];

    if (metadata) {
      if (metadata.platform) tags.push(metadata.platform);
      if (metadata.currency) tags.push(metadata.currency.toLowerCase());
      if (metadata.network) tags.push(metadata.network);
      if (metadata.type) tags.push(metadata.type);
    }

    // Add specific tags based on value patterns
    if (typeKey === 'email') {
      const domain = value.split('@')[1];
      if (domain) {
        if (domain.includes('gmail')) tags.push('gmail');
        else if (domain.includes('yahoo')) tags.push('yahoo');
        else if (domain.includes('hotmail') || domain.includes('outlook')) tags.push('microsoft');
        else if (domain.includes('proton')) tags.push('protonmail');
      }
    }

    return tags;
  }

  /**
   * Get available detection types
   * @returns {Object} Map of type keys to type names
   */
  getAvailableTypes() {
    const types = {};
    for (const [key, config] of Object.entries(DETECTION_PATTERNS)) {
      types[key] = {
        name: config.name,
        orphanType: config.orphanType,
        priority: config.priority,
        sensitive: config.sensitive || false
      };
    }
    return types;
  }

  /**
   * Configure detection options
   * @param {Object} options - New options
   */
  configure(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get detection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset detection statistics
   */
  resetStats() {
    this.stats = {
      totalDetections: 0,
      detectionsByType: {},
      validationFailures: 0,
      duplicatesRemoved: 0
    };
  }

  /**
   * Add a custom detection pattern
   * @param {string} key - Unique key for the pattern
   * @param {Object} config - Pattern configuration
   */
  addPattern(key, config) {
    if (!config.patterns || !Array.isArray(config.patterns)) {
      throw new Error('Pattern configuration must include patterns array');
    }
    DETECTION_PATTERNS[key] = {
      name: config.name || key,
      patterns: config.patterns.map(p => typeof p === 'string' ? new RegExp(p, 'g') : p),
      orphanType: config.orphanType || 'other',
      validator: config.validator,
      contextChars: config.contextChars || 50,
      priority: config.priority || 99,
      metadata: config.metadata,
      extractValue: config.extractValue,
      normalize: config.normalize,
      excludePatterns: config.excludePatterns,
      sensitive: config.sensitive || false
    };
  }

  /**
   * Remove a detection pattern
   * @param {string} key - Pattern key to remove
   */
  removePattern(key) {
    delete DETECTION_PATTERNS[key];
  }
}

/**
 * Factory function to create a configured DataTypeDetector
 * @param {Object} options - Configuration options
 * @returns {DataTypeDetector}
 */
function createDetector(options = {}) {
  return new DataTypeDetector(options);
}

module.exports = {
  DataTypeDetector,
  createDetector,
  DETECTION_PATTERNS,
  VALIDATORS
};
