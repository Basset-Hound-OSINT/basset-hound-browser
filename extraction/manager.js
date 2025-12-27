/**
 * Basset Hound Browser - Content Extraction Manager
 * Provides comprehensive content extraction capabilities for HTML pages
 * Extracts metadata, links, forms, images, scripts, stylesheets, and structured data
 */

const {
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser,
  BaseParser
} = require('./parsers');

/**
 * ExtractionManager class
 * Main manager for all content extraction operations
 */
class ExtractionManager extends BaseParser {
  constructor() {
    super();

    // Initialize specialized parsers
    this.openGraphParser = new OpenGraphParser();
    this.twitterCardParser = new TwitterCardParser();
    this.jsonLdParser = new JsonLdParser();
    this.microdataParser = new MicrodataParser();
    this.rdfaParser = new RdfaParser();

    // Statistics
    this.stats = {
      totalExtractions: 0,
      metadataExtractions: 0,
      linkExtractions: 0,
      formExtractions: 0,
      imageExtractions: 0,
      scriptExtractions: 0,
      stylesheetExtractions: 0,
      structuredDataExtractions: 0
    };
  }

  /**
   * Resolve a relative URL to an absolute URL
   * @param {string} url - URL to resolve (may be relative)
   * @param {string} baseUrl - Base URL for resolution
   * @returns {string} Resolved absolute URL
   */
  resolveUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') return '';

    // Already absolute
    if (url.match(/^https?:\/\//i) || url.match(/^\/\//)) {
      if (url.startsWith('//')) {
        const baseProtocol = baseUrl ? baseUrl.split(':')[0] : 'https';
        return `${baseProtocol}:${url}`;
      }
      return url;
    }

    // Data URL or javascript
    if (url.match(/^(data:|javascript:|mailto:|tel:|#)/i)) {
      return url;
    }

    if (!baseUrl) return url;

    try {
      const base = new URL(baseUrl);

      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }

      // Relative path
      const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
      return `${base.protocol}//${base.host}${basePath}${url}`;
    } catch (e) {
      return url;
    }
  }

  /**
   * Extract hostname from URL
   * @param {string} url - URL to parse
   * @returns {string} Hostname or empty string
   */
  getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }

  // ==========================================
  // Metadata Extraction
  // ==========================================

  /**
   * Extract all metadata from HTML
   * Includes standard meta tags, OG tags, Twitter cards, and more
   * @param {string} html - HTML content
   * @param {string} url - Page URL (for context)
   * @returns {Object} Extracted metadata
   */
  extractMetadata(html, url = '') {
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

    this.stats.totalExtractions++;
    this.stats.metadataExtractions++;

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) {
        result.data.basic.title = this.decodeHtmlEntities(titleMatch[1].trim());
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
        const name = this.extractAttribute(tag, 'name');
        const property = this.extractAttribute(tag, 'property');
        const httpEquiv = this.extractAttribute(tag, 'http-equiv');
        const content = this.extractAttribute(tag, 'content');

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
        result.data.basic.canonical = this.resolveUrl(canonicalMatch[1], url);
        result.count++;
      }

      // Extract favicon
      const faviconMatch = html.match(/<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]+href\s*=\s*["']([^"']+)["']/i) ||
                          html.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["'](?:shortcut )?icon["']/i);
      if (faviconMatch) {
        result.data.basic.favicon = this.resolveUrl(faviconMatch[1], url);
        result.count++;
      }

      // Extract Apple touch icon
      const appleTouchMatch = html.match(/<link[^>]+rel\s*=\s*["']apple-touch-icon[^"']*["'][^>]+href\s*=\s*["']([^"']+)["']/i);
      if (appleTouchMatch) {
        result.data.basic.appleTouchIcon = this.resolveUrl(appleTouchMatch[1], url);
        result.count++;
      }

      // Extract Open Graph data
      const ogResult = this.openGraphParser.parse(html);
      if (ogResult.success && ogResult.count > 0) {
        result.data.openGraph = ogResult.data;
        result.count += ogResult.count;
        result.warnings.push(...ogResult.warnings);
      }

      // Extract Twitter Card data
      const twitterResult = this.twitterCardParser.parse(html);
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
        const hreflang = this.extractAttribute(tag, 'hreflang');
        const href = this.extractAttribute(tag, 'href');
        const type = this.extractAttribute(tag, 'type');

        if (href) {
          alternates.push({
            href: this.resolveUrl(href, url),
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

  // ==========================================
  // Link Extraction
  // ==========================================

  /**
   * Extract all links from HTML with categorization
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative link resolution
   * @returns {Object} Extracted and categorized links
   */
  extractLinks(html, baseUrl = '') {
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

    this.stats.totalExtractions++;
    this.stats.linkExtractions++;

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      const baseHostname = baseUrl ? this.getHostname(baseUrl) : '';

      // Find all anchor tags
      const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;

      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const fullTag = match[0];
        const textContent = match[2].replace(/<[^>]+>/g, '').trim();

        const link = {
          href: href,
          text: this.decodeHtmlEntities(textContent).substring(0, 200),
          title: this.extractAttribute(fullTag, 'title'),
          rel: this.extractAttribute(fullTag, 'rel'),
          target: this.extractAttribute(fullTag, 'target'),
          download: this.hasAttribute(fullTag, 'download')
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
          const resolvedUrl = this.resolveUrl(href, baseUrl);
          link.resolvedHref = resolvedUrl;

          const linkHostname = this.getHostname(resolvedUrl);

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
          alt: this.extractAttribute(fullTag, 'alt'),
          title: this.extractAttribute(fullTag, 'title'),
          shape: this.extractAttribute(fullTag, 'shape'),
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
          const resolvedUrl = this.resolveUrl(href, baseUrl);
          link.resolvedHref = resolvedUrl;
          const linkHostname = this.getHostname(resolvedUrl);
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

  // ==========================================
  // Form Extraction
  // ==========================================

  /**
   * Extract all forms and their fields from HTML
   * @param {string} html - HTML content
   * @returns {Object} Extracted form data
   */
  extractForms(html) {
    const result = {
      success: true,
      data: [],
      count: 0,
      fieldCount: 0,
      errors: [],
      warnings: []
    };

    this.stats.totalExtractions++;
    this.stats.formExtractions++;

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Find all form tags
      const formRegex = /<form\s+[^>]*>([\s\S]*?)<\/form>/gi;
      let formMatch;

      while ((formMatch = formRegex.exec(html)) !== null) {
        const fullTag = formMatch[0];
        const formStartTag = fullTag.match(/<form\s+[^>]*>/i)[0];
        const formContent = formMatch[1];

        const form = {
          action: this.extractAttribute(formStartTag, 'action') || '',
          method: (this.extractAttribute(formStartTag, 'method') || 'get').toUpperCase(),
          enctype: this.extractAttribute(formStartTag, 'enctype') || 'application/x-www-form-urlencoded',
          name: this.extractAttribute(formStartTag, 'name'),
          id: this.extractAttribute(formStartTag, 'id'),
          target: this.extractAttribute(formStartTag, 'target'),
          autocomplete: this.extractAttribute(formStartTag, 'autocomplete'),
          novalidate: this.hasAttribute(formStartTag, 'novalidate'),
          fields: [],
          buttons: []
        };

        // Extract input fields
        const inputRegex = /<input\s+[^>]*>/gi;
        let inputMatch;

        while ((inputMatch = inputRegex.exec(formContent)) !== null) {
          const inputTag = inputMatch[0];
          const field = {
            tag: 'input',
            type: this.extractAttribute(inputTag, 'type') || 'text',
            name: this.extractAttribute(inputTag, 'name'),
            id: this.extractAttribute(inputTag, 'id'),
            value: this.extractAttribute(inputTag, 'value'),
            placeholder: this.extractAttribute(inputTag, 'placeholder'),
            required: this.hasAttribute(inputTag, 'required'),
            disabled: this.hasAttribute(inputTag, 'disabled'),
            readonly: this.hasAttribute(inputTag, 'readonly'),
            pattern: this.extractAttribute(inputTag, 'pattern'),
            min: this.extractAttribute(inputTag, 'min'),
            max: this.extractAttribute(inputTag, 'max'),
            minlength: this.extractAttribute(inputTag, 'minlength'),
            maxlength: this.extractAttribute(inputTag, 'maxlength'),
            autocomplete: this.extractAttribute(inputTag, 'autocomplete')
          };

          // Handle specific input types
          if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = this.hasAttribute(inputTag, 'checked');
          }

          if (field.type === 'submit' || field.type === 'reset' || field.type === 'button') {
            form.buttons.push(field);
          } else {
            form.fields.push(field);
            result.fieldCount++;
          }
        }

        // Extract textarea fields
        const textareaRegex = /<textarea\s+[^>]*>([\s\S]*?)<\/textarea>/gi;
        let textareaMatch;

        while ((textareaMatch = textareaRegex.exec(formContent)) !== null) {
          const textareaTag = textareaMatch[0];
          const field = {
            tag: 'textarea',
            type: 'textarea',
            name: this.extractAttribute(textareaTag, 'name'),
            id: this.extractAttribute(textareaTag, 'id'),
            value: this.decodeHtmlEntities(textareaMatch[1]),
            placeholder: this.extractAttribute(textareaTag, 'placeholder'),
            required: this.hasAttribute(textareaTag, 'required'),
            disabled: this.hasAttribute(textareaTag, 'disabled'),
            readonly: this.hasAttribute(textareaTag, 'readonly'),
            rows: this.extractAttribute(textareaTag, 'rows'),
            cols: this.extractAttribute(textareaTag, 'cols'),
            maxlength: this.extractAttribute(textareaTag, 'maxlength')
          };

          form.fields.push(field);
          result.fieldCount++;
        }

        // Extract select fields
        const selectRegex = /<select\s+[^>]*>([\s\S]*?)<\/select>/gi;
        let selectMatch;

        while ((selectMatch = selectRegex.exec(formContent)) !== null) {
          const selectTag = selectMatch[0];
          const selectStartTag = selectTag.match(/<select\s+[^>]*>/i)[0];
          const selectContent = selectMatch[1];

          const field = {
            tag: 'select',
            type: 'select',
            name: this.extractAttribute(selectStartTag, 'name'),
            id: this.extractAttribute(selectStartTag, 'id'),
            required: this.hasAttribute(selectStartTag, 'required'),
            disabled: this.hasAttribute(selectStartTag, 'disabled'),
            multiple: this.hasAttribute(selectStartTag, 'multiple'),
            options: []
          };

          // Extract options
          const optionRegex = /<option\s*[^>]*>([^<]*)<\/option>/gi;
          let optionMatch;

          while ((optionMatch = optionRegex.exec(selectContent)) !== null) {
            const optionTag = optionMatch[0];
            field.options.push({
              value: this.extractAttribute(optionTag, 'value'),
              text: this.decodeHtmlEntities(optionMatch[1].trim()),
              selected: this.hasAttribute(optionTag, 'selected'),
              disabled: this.hasAttribute(optionTag, 'disabled')
            });
          }

          form.fields.push(field);
          result.fieldCount++;
        }

        // Extract button elements
        const buttonRegex = /<button\s+[^>]*>([\s\S]*?)<\/button>/gi;
        let buttonMatch;

        while ((buttonMatch = buttonRegex.exec(formContent)) !== null) {
          const buttonTag = buttonMatch[0];
          const button = {
            tag: 'button',
            type: this.extractAttribute(buttonTag, 'type') || 'submit',
            name: this.extractAttribute(buttonTag, 'name'),
            id: this.extractAttribute(buttonTag, 'id'),
            value: this.extractAttribute(buttonTag, 'value'),
            text: this.decodeHtmlEntities(buttonMatch[1].replace(/<[^>]+>/g, '').trim()),
            disabled: this.hasAttribute(buttonTag, 'disabled')
          };

          form.buttons.push(button);
        }

        result.data.push(form);
        result.count++;
      }

      // Summary
      result.summary = {
        formCount: result.count,
        totalFields: result.fieldCount,
        methods: {
          get: result.data.filter(f => f.method === 'GET').length,
          post: result.data.filter(f => f.method === 'POST').length,
          other: result.data.filter(f => !['GET', 'POST'].includes(f.method)).length
        }
      };

    } catch (error) {
      result.success = false;
      result.errors.push(`Extraction error: ${error.message}`);
    }

    return result;
  }

  // ==========================================
  // Image Extraction
  // ==========================================

  /**
   * Extract all images from HTML
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative image resolution
   * @returns {Object} Extracted image data
   */
  extractImages(html, baseUrl = '') {
    const result = {
      success: true,
      data: [],
      count: 0,
      errors: [],
      warnings: []
    };

    this.stats.totalExtractions++;
    this.stats.imageExtractions++;

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Find all img tags
      const imgRegex = /<img\s+[^>]*>/gi;
      let match;

      while ((match = imgRegex.exec(html)) !== null) {
        const imgTag = match[0];

        const image = {
          src: this.extractAttribute(imgTag, 'src'),
          alt: this.extractAttribute(imgTag, 'alt') || '',
          title: this.extractAttribute(imgTag, 'title'),
          width: this.extractAttribute(imgTag, 'width'),
          height: this.extractAttribute(imgTag, 'height'),
          loading: this.extractAttribute(imgTag, 'loading'),
          decoding: this.extractAttribute(imgTag, 'decoding'),
          crossorigin: this.extractAttribute(imgTag, 'crossorigin'),
          referrerpolicy: this.extractAttribute(imgTag, 'referrerpolicy'),
          ismap: this.hasAttribute(imgTag, 'ismap'),
          usemap: this.extractAttribute(imgTag, 'usemap')
        };

        // Handle srcset for responsive images
        const srcset = this.extractAttribute(imgTag, 'srcset');
        if (srcset) {
          image.srcset = this.parseSrcset(srcset, baseUrl);
        }

        // Handle sizes attribute
        image.sizes = this.extractAttribute(imgTag, 'sizes');

        // Handle data-src (lazy loading)
        const dataSrc = this.extractAttribute(imgTag, 'data-src');
        if (dataSrc) {
          image.dataSrc = dataSrc;
          image.isLazyLoad = true;
        }

        const dataLazy = this.extractAttribute(imgTag, 'data-lazy') ||
                        this.extractAttribute(imgTag, 'data-lazy-src');
        if (dataLazy) {
          image.dataLazy = dataLazy;
          image.isLazyLoad = true;
        }

        // Resolve URL
        if (image.src) {
          image.resolvedSrc = this.resolveUrl(image.src, baseUrl);
        }

        // Detect image type from URL
        if (image.src) {
          const ext = image.src.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
          if (ext) {
            image.fileType = ext[1].toLowerCase();
          }
        }

        // Check for missing alt text (accessibility warning)
        if (!image.alt && image.alt !== '') {
          result.warnings.push(`Image missing alt text: ${image.src || 'unknown'}`);
        }

        result.data.push(image);
        result.count++;
      }

      // Also extract picture element sources
      const pictureRegex = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;

      while ((match = pictureRegex.exec(html)) !== null) {
        const pictureContent = match[1];

        // Find source elements
        const sourceRegex = /<source\s+[^>]*>/gi;
        let sourceMatch;

        while ((sourceMatch = sourceRegex.exec(pictureContent)) !== null) {
          const sourceTag = sourceMatch[0];
          const source = {
            srcset: this.extractAttribute(sourceTag, 'srcset'),
            type: this.extractAttribute(sourceTag, 'type'),
            media: this.extractAttribute(sourceTag, 'media'),
            sizes: this.extractAttribute(sourceTag, 'sizes'),
            isPictureSource: true
          };

          if (source.srcset) {
            source.parsedSrcset = this.parseSrcset(source.srcset, baseUrl);
            result.data.push(source);
            result.count++;
          }
        }
      }

      // Extract background images from inline styles
      const bgImageRegex = /style\s*=\s*["'][^"']*background(?:-image)?\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;

      while ((match = bgImageRegex.exec(html)) !== null) {
        const bgUrl = match[1];
        result.data.push({
          src: bgUrl,
          resolvedSrc: this.resolveUrl(bgUrl, baseUrl),
          isBackgroundImage: true
        });
        result.count++;
      }

      // Summary
      result.summary = {
        totalImages: result.count,
        withAlt: result.data.filter(i => i.alt && i.alt !== '').length,
        withoutAlt: result.data.filter(i => !i.alt || i.alt === '').length,
        lazyLoaded: result.data.filter(i => i.isLazyLoad).length,
        backgroundImages: result.data.filter(i => i.isBackgroundImage).length,
        pictureSourcesCount: result.data.filter(i => i.isPictureSource).length
      };

    } catch (error) {
      result.success = false;
      result.errors.push(`Extraction error: ${error.message}`);
    }

    return result;
  }

  /**
   * Parse srcset attribute into structured data
   * @param {string} srcset - srcset attribute value
   * @param {string} baseUrl - Base URL for resolution
   * @returns {Array} Parsed srcset entries
   */
  parseSrcset(srcset, baseUrl) {
    const entries = [];
    const parts = srcset.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      const match = trimmed.match(/^(\S+)\s*(.*)$/);

      if (match) {
        const entry = {
          url: match[1],
          resolvedUrl: this.resolveUrl(match[1], baseUrl),
          descriptor: match[2].trim() || null
        };

        // Parse descriptor (width or pixel density)
        if (entry.descriptor) {
          if (entry.descriptor.endsWith('w')) {
            entry.width = parseInt(entry.descriptor, 10);
          } else if (entry.descriptor.endsWith('x')) {
            entry.density = parseFloat(entry.descriptor);
          }
        }

        entries.push(entry);
      }
    }

    return entries;
  }

  // ==========================================
  // Script Extraction
  // ==========================================

  /**
   * Extract all scripts from HTML
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative script resolution
   * @returns {Object} Extracted script data
   */
  extractScripts(html, baseUrl = '') {
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

    this.stats.totalExtractions++;
    this.stats.scriptExtractions++;

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
          src: this.extractAttribute(startTag, 'src'),
          type: this.extractAttribute(startTag, 'type') || 'text/javascript',
          async: this.hasAttribute(startTag, 'async'),
          defer: this.hasAttribute(startTag, 'defer'),
          crossorigin: this.extractAttribute(startTag, 'crossorigin'),
          integrity: this.extractAttribute(startTag, 'integrity'),
          nomodule: this.hasAttribute(startTag, 'nomodule'),
          nonce: this.extractAttribute(startTag, 'nonce'),
          referrerpolicy: this.extractAttribute(startTag, 'referrerpolicy'),
          id: this.extractAttribute(startTag, 'id')
        };

        if (script.src) {
          // External script
          script.resolvedSrc = this.resolveUrl(script.src, baseUrl);
          script.isExternal = true;

          // Detect common libraries
          script.library = this.detectScriptLibrary(script.src);

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
  detectScriptLibrary(src) {
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

  // ==========================================
  // Stylesheet Extraction
  // ==========================================

  /**
   * Extract all stylesheets from HTML
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for relative stylesheet resolution
   * @returns {Object} Extracted stylesheet data
   */
  extractStylesheets(html, baseUrl = '') {
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

    this.stats.totalExtractions++;
    this.stats.stylesheetExtractions++;

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
        const href = this.extractAttribute(linkTag, 'href');

        if (href) {
          const stylesheet = {
            href: href,
            resolvedHref: this.resolveUrl(href, baseUrl),
            type: this.extractAttribute(linkTag, 'type') || 'text/css',
            media: this.extractAttribute(linkTag, 'media') || 'all',
            crossorigin: this.extractAttribute(linkTag, 'crossorigin'),
            integrity: this.extractAttribute(linkTag, 'integrity'),
            disabled: this.hasAttribute(linkTag, 'disabled'),
            title: this.extractAttribute(linkTag, 'title'),
            isExternal: true
          };

          // Detect common CSS frameworks
          stylesheet.framework = this.detectCssFramework(href);

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
          type: this.extractAttribute(startTag, 'type') || 'text/css',
          media: this.extractAttribute(startTag, 'media') || 'all',
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
            return urlMatch ? this.resolveUrl(urlMatch[1], baseUrl) : null;
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
  detectCssFramework(href) {
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

  // ==========================================
  // Structured Data Extraction
  // ==========================================

  /**
   * Extract all structured data from HTML
   * Includes JSON-LD, Microdata, and RDFa
   * @param {string} html - HTML content
   * @returns {Object} Extracted structured data
   */
  extractStructuredData(html) {
    const result = {
      success: true,
      data: {
        jsonLd: null,
        microdata: null,
        rdfa: null
      },
      types: [],
      count: 0,
      errors: [],
      warnings: []
    };

    this.stats.totalExtractions++;
    this.stats.structuredDataExtractions++;

    if (!html || typeof html !== 'string') {
      result.success = false;
      result.errors.push('Invalid HTML input');
      return result;
    }

    try {
      // Extract JSON-LD
      const jsonLdResult = this.jsonLdParser.parse(html);
      result.data.jsonLd = {
        data: jsonLdResult.data,
        types: jsonLdResult.types,
        count: jsonLdResult.count
      };
      result.count += jsonLdResult.count;
      result.types.push(...jsonLdResult.types);
      result.errors.push(...jsonLdResult.errors);
      result.warnings.push(...jsonLdResult.warnings);

      // Extract Microdata
      const microdataResult = this.microdataParser.parse(html);
      result.data.microdata = {
        data: microdataResult.data,
        types: microdataResult.types,
        count: microdataResult.count
      };
      result.count += microdataResult.count;
      for (const type of microdataResult.types) {
        if (!result.types.includes(type)) {
          result.types.push(type);
        }
      }
      result.errors.push(...microdataResult.errors);
      result.warnings.push(...microdataResult.warnings);

      // Extract RDFa
      const rdfaResult = this.rdfaParser.parse(html);
      result.data.rdfa = {
        data: rdfaResult.data,
        prefixes: rdfaResult.prefixes,
        count: rdfaResult.count
      };
      result.count += rdfaResult.count;
      result.errors.push(...rdfaResult.errors);
      result.warnings.push(...rdfaResult.warnings);

      // Deduplicate types
      result.types = [...new Set(result.types)];

      // Summary
      result.summary = {
        hasJsonLd: jsonLdResult.count > 0,
        hasMicrodata: microdataResult.count > 0,
        hasRdfa: rdfaResult.count > 0,
        jsonLdCount: jsonLdResult.count,
        microdataCount: microdataResult.count,
        rdfaCount: rdfaResult.count,
        totalEntities: result.count,
        uniqueTypes: result.types.length
      };

    } catch (error) {
      result.success = false;
      result.errors.push(`Extraction error: ${error.message}`);
    }

    return result;
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Get current extraction statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset extraction statistics
   * @returns {Object} Previous stats before reset
   */
  resetStats() {
    const previousStats = { ...this.stats };
    this.stats = {
      totalExtractions: 0,
      metadataExtractions: 0,
      linkExtractions: 0,
      formExtractions: 0,
      imageExtractions: 0,
      scriptExtractions: 0,
      stylesheetExtractions: 0,
      structuredDataExtractions: 0
    };
    return { success: true, previousStats };
  }

  /**
   * Extract all content types from HTML at once
   * @param {string} html - HTML content
   * @param {string} url - Page URL
   * @returns {Object} All extracted data
   */
  extractAll(html, url = '') {
    return {
      success: true,
      url: url,
      metadata: this.extractMetadata(html, url),
      links: this.extractLinks(html, url),
      forms: this.extractForms(html),
      images: this.extractImages(html, url),
      scripts: this.extractScripts(html, url),
      stylesheets: this.extractStylesheets(html, url),
      structuredData: this.extractStructuredData(html),
      extractedAt: new Date().toISOString()
    };
  }
}

// Export the manager and parsers
module.exports = {
  ExtractionManager,
  // Re-export parsers for direct access if needed
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser
};
