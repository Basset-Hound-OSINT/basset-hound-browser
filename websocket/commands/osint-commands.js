/**
 * OSINT Agent WebSocket Commands
 *
 * Phase 12: OSINT Agent Integration
 *
 * Provides commands for:
 * - Comprehensive OSINT data extraction
 * - Investigation workflow management
 * - Link investigation with depth control
 * - basset-hound integration for data storage
 * - Evidence capture with provenance
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * OSINT extraction patterns
 */
const OSINT_PATTERNS = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    orphanType: 'email',
  },
  phone: {
    pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    validator: (value) => /^\+?[\d\s()-]{10,}$/.test(value.replace(/\s/g, '')),
    orphanType: 'phone',
    normalize: (value) => value.replace(/[^\d+]/g, ''),
  },
  crypto_btc: {
    pattern: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
    validator: (value) => /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(value),
    orphanType: 'crypto_address',
    subtype: 'BTC',
  },
  crypto_eth: {
    pattern: /\b0x[a-fA-F0-9]{40}\b/g,
    validator: (value) => /^0x[a-fA-F0-9]{40}$/.test(value),
    orphanType: 'crypto_address',
    subtype: 'ETH',
  },
  crypto_xmr: {
    pattern: /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g,
    validator: (value) => /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/.test(value),
    orphanType: 'crypto_address',
    subtype: 'XMR',
  },
  social_twitter: {
    pattern: /@[a-zA-Z0-9_]{1,15}\b/g,
    validator: (value) => /^@[a-zA-Z0-9_]{1,15}$/.test(value),
    orphanType: 'social_media',
    subtype: 'twitter',
  },
  social_linkedin: {
    pattern: /linkedin\.com\/in\/([a-zA-Z0-9-]{3,100})/g,
    extract: (match) => match[1],
    orphanType: 'social_media',
    subtype: 'linkedin',
  },
  social_github: {
    pattern: /github\.com\/([a-zA-Z0-9-]{1,39})/g,
    extract: (match) => match[1],
    orphanType: 'social_media',
    subtype: 'github',
  },
  ip_address: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    validator: (value) => {
      const parts = value.split('.');
      return parts.length === 4 && parts.every(p => {
        const n = parseInt(p, 10);
        return n >= 0 && n <= 255;
      });
    },
    orphanType: 'ip_address',
  },
  domain: {
    pattern: /\b[a-zA-Z0-9][a-zA-Z0-9-]*\.(com|org|net|edu|gov|io|co|uk|de|fr|ru|cn|jp|au|ca|nl|se|ch|es|it|br|mx|in|kr|nz|za|mil|int)\b/gi,
    orphanType: 'domain',
  },
  onion: {
    pattern: /\b[a-z2-7]{16,56}\.onion\b/g,
    orphanType: 'domain',
    subtype: 'onion',
  },
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    orphanType: 'ssn',
    sensitive: true,
  },
  credit_card: {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    orphanType: 'credit_card',
    sensitive: true,
  },
};

/**
 * Investigation state manager
 */
class InvestigationManager extends EventEmitter {
  constructor() {
    super();
    this.investigations = new Map();
    this.activeInvestigation = null;
  }

  /**
   * Create a new investigation
   */
  createInvestigation(options = {}) {
    const id = `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const investigation = {
      id,
      name: options.name || 'Untitled Investigation',
      description: options.description || '',
      caseNumber: options.caseNumber || null,
      startedAt: new Date().toISOString(),
      status: 'active',
      config: {
        maxDepth: options.maxDepth || 2,
        followExternal: options.followExternal !== false,
        respectRobotsTxt: options.respectRobotsTxt !== false,
        delayMs: options.delayMs || 1000,
        maxPages: options.maxPages || 100,
        patterns: options.patterns || [],
        excludePatterns: options.excludePatterns || [],
        dataTypes: options.dataTypes || Object.keys(OSINT_PATTERNS),
      },
      stats: {
        pagesVisited: 0,
        pagesQueued: 0,
        dataExtracted: 0,
        evidenceCaptured: 0,
        errorsEncountered: 0,
      },
      queue: [],
      visited: new Set(),
      findings: [],
      evidence: [],
      errors: [],
    };

    this.investigations.set(id, investigation);
    this.activeInvestigation = id;
    this.emit('investigationCreated', { id, name: investigation.name });

    return investigation;
  }

  /**
   * Get investigation by ID
   */
  getInvestigation(id) {
    return this.investigations.get(id);
  }

  /**
   * Get active investigation
   */
  getActiveInvestigation() {
    if (!this.activeInvestigation) return null;
    return this.investigations.get(this.activeInvestigation);
  }

  /**
   * Set active investigation
   */
  setActiveInvestigation(id) {
    if (!this.investigations.has(id)) {
      throw new Error(`Investigation ${id} not found`);
    }
    this.activeInvestigation = id;
    return this.investigations.get(id);
  }

  /**
   * Add URL to investigation queue
   */
  queueUrl(url, depth = 0, sourceUrl = null) {
    const inv = this.getActiveInvestigation();
    if (!inv) throw new Error('No active investigation');

    if (inv.visited.has(url)) return false;
    if (depth > inv.config.maxDepth) return false;
    if (inv.queue.length >= inv.config.maxPages) return false;

    // Check patterns
    if (inv.config.patterns.length > 0) {
      const matches = inv.config.patterns.some(p => new RegExp(p).test(url));
      if (!matches) return false;
    }

    // Check exclude patterns
    if (inv.config.excludePatterns.length > 0) {
      const excluded = inv.config.excludePatterns.some(p => new RegExp(p).test(url));
      if (excluded) return false;
    }

    inv.queue.push({ url, depth, sourceUrl, queuedAt: new Date().toISOString() });
    inv.stats.pagesQueued++;
    return true;
  }

  /**
   * Mark URL as visited
   */
  markVisited(url) {
    const inv = this.getActiveInvestigation();
    if (!inv) return;
    inv.visited.add(url);
    inv.stats.pagesVisited++;
  }

  /**
   * Add finding to investigation
   */
  addFinding(finding) {
    const inv = this.getActiveInvestigation();
    if (!inv) return;

    finding.id = `find_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    finding.foundAt = new Date().toISOString();
    inv.findings.push(finding);
    inv.stats.dataExtracted++;

    this.emit('findingAdded', { investigationId: inv.id, finding });
    return finding;
  }

  /**
   * Add evidence to investigation
   */
  addEvidence(evidence) {
    const inv = this.getActiveInvestigation();
    if (!inv) return;

    evidence.capturedAt = new Date().toISOString();
    inv.evidence.push(evidence);
    inv.stats.evidenceCaptured++;

    this.emit('evidenceAdded', { investigationId: inv.id, evidence });
    return evidence;
  }

  /**
   * Record error
   */
  recordError(error, context = {}) {
    const inv = this.getActiveInvestigation();
    if (!inv) return;

    inv.errors.push({
      message: error.message || error,
      context,
      occurredAt: new Date().toISOString(),
    });
    inv.stats.errorsEncountered++;
  }

  /**
   * Get next URL from queue
   */
  getNextUrl() {
    const inv = this.getActiveInvestigation();
    if (!inv || inv.queue.length === 0) return null;
    return inv.queue.shift();
  }

  /**
   * Complete investigation
   */
  completeInvestigation(id = null) {
    const invId = id || this.activeInvestigation;
    const inv = this.investigations.get(invId);
    if (!inv) throw new Error(`Investigation ${invId} not found`);

    inv.status = 'completed';
    inv.completedAt = new Date().toISOString();
    inv.duration = new Date(inv.completedAt) - new Date(inv.startedAt);

    this.emit('investigationCompleted', { id: invId, stats: inv.stats });
    return inv;
  }

  /**
   * List all investigations
   */
  listInvestigations() {
    return Array.from(this.investigations.values()).map(inv => ({
      id: inv.id,
      name: inv.name,
      status: inv.status,
      startedAt: inv.startedAt,
      completedAt: inv.completedAt,
      stats: inv.stats,
    }));
  }

  /**
   * Export investigation
   */
  exportInvestigation(id = null) {
    const invId = id || this.activeInvestigation;
    const inv = this.investigations.get(invId);
    if (!inv) throw new Error(`Investigation ${invId} not found`);

    return {
      ...inv,
      visited: Array.from(inv.visited),
      exportedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let investigationManager = null;

/**
 * Get investigation manager
 */
function getInvestigationManager() {
  if (!investigationManager) {
    investigationManager = new InvestigationManager();
  }
  return investigationManager;
}

/**
 * Extract OSINT data from text
 */
function extractOsintData(text, types = null) {
  const results = [];
  const typesToExtract = types || Object.keys(OSINT_PATTERNS);

  for (const type of typesToExtract) {
    const config = OSINT_PATTERNS[type];
    if (!config) continue;

    let matches;
    if (config.pattern.global) {
      matches = text.matchAll(config.pattern);
    } else {
      const match = text.match(config.pattern);
      matches = match ? [match] : [];
    }

    const seen = new Set();
    for (const match of matches) {
      let value = config.extract ? config.extract(match) : match[0];

      // Normalize if configured
      if (config.normalize) {
        value = config.normalize(value);
      }

      // Skip duplicates
      if (seen.has(value)) continue;
      seen.add(value);

      // Validate if configured
      if (config.validator && !config.validator(value)) continue;

      // Get context
      const index = match.index || text.indexOf(value);
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + value.length + 50);
      const context = text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim();

      results.push({
        type,
        value,
        orphanType: config.orphanType,
        subtype: config.subtype || null,
        sensitive: config.sensitive || false,
        context,
        confidence: config.validator ? (config.validator(value) ? 0.9 : 0.5) : 0.7,
      });
    }
  }

  return results;
}

/**
 * Generate provenance for extracted data
 */
function generateProvenance(url, options = {}) {
  return {
    sourceType: 'website',
    sourceUrl: url,
    capturedAt: new Date().toISOString(),
    capturedBy: options.capturedBy || 'basset-hound-browser',
    investigationId: options.investigationId || null,
    caseNumber: options.caseNumber || null,
    browserProfile: options.browserProfile || null,
    torCircuit: options.torCircuit || null,
  };
}

/**
 * Register OSINT commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 * @param {Function} executeInRenderer - Function to execute code in renderer
 * @param {Object} options - Additional options (browser instance, etc.)
 */
function registerOsintCommands(commandHandlers, executeInRenderer, options = {}) {
  const manager = getInvestigationManager();

  // ==========================================
  // INVESTIGATION MANAGEMENT
  // ==========================================

  /**
   * Create new investigation
   *
   * Command: create_investigation
   * Params:
   *   - name: string
   *   - description: string (optional)
   *   - caseNumber: string (optional)
   *   - maxDepth: number (optional, default 2)
   *   - maxPages: number (optional, default 100)
   *   - delayMs: number (optional, default 1000)
   *   - patterns: string[] (optional, URL patterns to follow)
   *   - excludePatterns: string[] (optional, URL patterns to exclude)
   *   - dataTypes: string[] (optional, data types to extract)
   */
  commandHandlers.create_investigation = async (params) => {
    try {
      const investigation = manager.createInvestigation(params);
      return {
        success: true,
        investigation: {
          id: investigation.id,
          name: investigation.name,
          config: investigation.config,
          startedAt: investigation.startedAt,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get investigation by ID
   *
   * Command: get_investigation
   * Params:
   *   - id: string (optional, uses active if not specified)
   */
  commandHandlers.get_investigation = async (params) => {
    try {
      const id = params.id || manager.activeInvestigation;
      const inv = manager.getInvestigation(id);
      if (!inv) {
        return { success: false, error: `Investigation ${id} not found` };
      }

      return {
        success: true,
        investigation: {
          id: inv.id,
          name: inv.name,
          description: inv.description,
          caseNumber: inv.caseNumber,
          status: inv.status,
          config: inv.config,
          stats: inv.stats,
          startedAt: inv.startedAt,
          completedAt: inv.completedAt,
          queueLength: inv.queue.length,
          findingsCount: inv.findings.length,
          evidenceCount: inv.evidence.length,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * List all investigations
   *
   * Command: list_investigations
   */
  commandHandlers.list_investigations = async () => {
    try {
      return {
        success: true,
        investigations: manager.listInvestigations(),
        activeId: manager.activeInvestigation,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Set active investigation
   *
   * Command: set_active_investigation
   * Params:
   *   - id: string
   */
  commandHandlers.set_active_investigation = async (params) => {
    try {
      const inv = manager.setActiveInvestigation(params.id);
      return {
        success: true,
        investigation: { id: inv.id, name: inv.name },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Complete investigation
   *
   * Command: complete_investigation
   * Params:
   *   - id: string (optional)
   */
  commandHandlers.complete_investigation = async (params) => {
    try {
      const inv = manager.completeInvestigation(params.id);
      return {
        success: true,
        investigation: {
          id: inv.id,
          name: inv.name,
          status: inv.status,
          stats: inv.stats,
          completedAt: inv.completedAt,
          duration: inv.duration,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Export investigation
   *
   * Command: export_investigation
   * Params:
   *   - id: string (optional)
   */
  commandHandlers.export_investigation = async (params) => {
    try {
      const exported = manager.exportInvestigation(params.id);
      return {
        success: true,
        export: exported,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ==========================================
  // OSINT DATA EXTRACTION
  // ==========================================

  /**
   * Extract OSINT data from current page
   *
   * Command: extract_osint_data
   * Params:
   *   - types: string[] (optional, defaults to all)
   *   - includeContext: boolean (optional, default true)
   *   - addToInvestigation: boolean (optional, default true)
   */
  commandHandlers.extract_osint_data = async (params, context) => {
    try {
      // Get page content
      let text, url, title;
      if (executeInRenderer) {
        const pageData = await executeInRenderer(`
          ({
            text: document.body.innerText,
            url: window.location.href,
            title: document.title
          })
        `);
        text = pageData.text;
        url = pageData.url;
        title = pageData.title;
      } else if (params.text) {
        text = params.text;
        url = params.url || 'unknown';
        title = params.title || '';
      } else {
        return { success: false, error: 'No page content available' };
      }

      // Extract data
      const types = params.types || null;
      const findings = extractOsintData(text, types);

      // Generate provenance
      const inv = manager.getActiveInvestigation();
      const provenance = generateProvenance(url, {
        investigationId: inv?.id,
        caseNumber: inv?.caseNumber,
      });

      // Add to investigation if active
      if (inv && params.addToInvestigation !== false) {
        for (const finding of findings) {
          manager.addFinding({
            ...finding,
            sourceUrl: url,
            sourceTitle: title,
            provenance,
          });
        }
      }

      // Group by type
      const grouped = {};
      for (const finding of findings) {
        if (!grouped[finding.type]) {
          grouped[finding.type] = [];
        }
        grouped[finding.type].push(finding);
      }

      return {
        success: true,
        url,
        title,
        totalFindings: findings.length,
        findings: params.includeContext === false
          ? findings.map(({ context, ...rest }) => rest)
          : findings,
        byType: Object.fromEntries(
          Object.entries(grouped).map(([k, v]) => [k, v.length])
        ),
        provenance,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get available OSINT data types
   *
   * Command: get_osint_data_types
   */
  commandHandlers.get_osint_data_types = async () => {
    return {
      success: true,
      types: Object.entries(OSINT_PATTERNS).map(([key, config]) => ({
        type: key,
        orphanType: config.orphanType,
        subtype: config.subtype || null,
        sensitive: config.sensitive || false,
      })),
    };
  };

  // ==========================================
  // LINK INVESTIGATION
  // ==========================================

  /**
   * Queue URL for investigation
   *
   * Command: queue_investigation_url
   * Params:
   *   - url: string
   *   - depth: number (optional, default 0)
   */
  commandHandlers.queue_investigation_url = async (params) => {
    try {
      if (!params.url) {
        return { success: false, error: 'URL is required' };
      }

      const queued = manager.queueUrl(params.url, params.depth || 0);
      const inv = manager.getActiveInvestigation();

      return {
        success: true,
        queued,
        queueLength: inv?.queue.length || 0,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get investigation queue
   *
   * Command: get_investigation_queue
   */
  commandHandlers.get_investigation_queue = async () => {
    try {
      const inv = manager.getActiveInvestigation();
      if (!inv) {
        return { success: false, error: 'No active investigation' };
      }

      return {
        success: true,
        queue: inv.queue.slice(0, 50), // Return first 50
        totalQueued: inv.queue.length,
        visited: inv.visited.size,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get next URL from queue
   *
   * Command: get_next_investigation_url
   */
  commandHandlers.get_next_investigation_url = async () => {
    try {
      const next = manager.getNextUrl();
      if (!next) {
        return { success: true, hasNext: false, url: null };
      }

      return {
        success: true,
        hasNext: true,
        ...next,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Investigate links on current page
   *
   * Command: investigate_links
   * Params:
   *   - patterns: string[] (optional, patterns to match)
   *   - maxLinks: number (optional, default 50)
   *   - followExternal: boolean (optional, default from config)
   */
  commandHandlers.investigate_links = async (params, context) => {
    try {
      const inv = manager.getActiveInvestigation();
      if (!inv) {
        return { success: false, error: 'No active investigation' };
      }

      // Get links from page
      let links, currentUrl;
      if (executeInRenderer) {
        const pageData = await executeInRenderer(`
          ({
            links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
              href: a.href,
              text: a.innerText.trim().slice(0, 100),
              rel: a.rel
            })),
            currentUrl: window.location.href
          })
        `);
        links = pageData.links;
        currentUrl = pageData.currentUrl;
      } else {
        return { success: false, error: 'Cannot access page content' };
      }

      const currentDomain = new URL(currentUrl).hostname;
      const patterns = params.patterns || inv.config.patterns;
      const maxLinks = params.maxLinks || 50;
      const followExternal = params.followExternal ?? inv.config.followExternal;

      let queued = 0;
      let skipped = 0;
      const queuedUrls = [];

      for (const link of links) {
        if (queued >= maxLinks) break;

        try {
          const linkUrl = new URL(link.href);

          // Skip non-http(s)
          if (!['http:', 'https:'].includes(linkUrl.protocol)) {
            skipped++;
            continue;
          }

          // Check external
          if (!followExternal && linkUrl.hostname !== currentDomain) {
            skipped++;
            continue;
          }

          // Check patterns
          if (patterns.length > 0) {
            const matches = patterns.some(p => new RegExp(p).test(link.href));
            if (!matches) {
              skipped++;
              continue;
            }
          }

          // Get current depth
          const currentQueueItem = inv.queue.find(q => q.url === currentUrl);
          const currentDepth = currentQueueItem?.depth || 0;

          if (manager.queueUrl(link.href, currentDepth + 1, currentUrl)) {
            queued++;
            queuedUrls.push({ url: link.href, text: link.text });
          } else {
            skipped++;
          }
        } catch (e) {
          skipped++;
        }
      }

      // Mark current URL as visited
      manager.markVisited(currentUrl);

      return {
        success: true,
        currentUrl,
        linksFound: links.length,
        queued,
        skipped,
        queuedUrls: queuedUrls.slice(0, 20), // Return first 20
        totalInQueue: inv.queue.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ==========================================
  // INVESTIGATION FINDINGS
  // ==========================================

  /**
   * Get investigation findings
   *
   * Command: get_investigation_findings
   * Params:
   *   - id: string (optional)
   *   - type: string (optional, filter by type)
   *   - limit: number (optional, default 100)
   *   - offset: number (optional, default 0)
   */
  commandHandlers.get_investigation_findings = async (params) => {
    try {
      const id = params.id || manager.activeInvestigation;
      const inv = manager.getInvestigation(id);
      if (!inv) {
        return { success: false, error: `Investigation ${id} not found` };
      }

      let findings = inv.findings;

      // Filter by type
      if (params.type) {
        findings = findings.filter(f => f.type === params.type);
      }

      // Paginate
      const limit = params.limit || 100;
      const offset = params.offset || 0;
      const paginated = findings.slice(offset, offset + limit);

      return {
        success: true,
        findings: paginated,
        total: findings.length,
        offset,
        limit,
        hasMore: offset + limit < findings.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Get findings summary by type
   *
   * Command: get_findings_summary
   * Params:
   *   - id: string (optional)
   */
  commandHandlers.get_findings_summary = async (params) => {
    try {
      const id = params.id || manager.activeInvestigation;
      const inv = manager.getInvestigation(id);
      if (!inv) {
        return { success: false, error: `Investigation ${id} not found` };
      }

      // Group by type
      const byType = {};
      const bySource = {};
      const sensitiveCount = { ssn: 0, credit_card: 0 };

      for (const finding of inv.findings) {
        byType[finding.type] = (byType[finding.type] || 0) + 1;
        bySource[finding.sourceUrl] = (bySource[finding.sourceUrl] || 0) + 1;

        if (finding.sensitive) {
          sensitiveCount[finding.type] = (sensitiveCount[finding.type] || 0) + 1;
        }
      }

      return {
        success: true,
        summary: {
          total: inv.findings.length,
          byType,
          bySource: Object.entries(bySource)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([url, count]) => ({ url, count })),
          sensitiveData: sensitiveCount,
          uniqueEmails: inv.findings.filter(f => f.type === 'email').length,
          uniquePhones: inv.findings.filter(f => f.type === 'phone').length,
          cryptoAddresses: inv.findings.filter(f => f.type.startsWith('crypto_')).length,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ==========================================
  // BASSET-HOUND INTEGRATION
  // ==========================================

  /**
   * Prepare findings for basset-hound ingestion
   *
   * Command: prepare_for_basset_hound
   * Params:
   *   - id: string (optional)
   *   - types: string[] (optional, filter types)
   *   - includeSensitive: boolean (optional, default false)
   */
  commandHandlers.prepare_for_basset_hound = async (params) => {
    try {
      const id = params.id || manager.activeInvestigation;
      const inv = manager.getInvestigation(id);
      if (!inv) {
        return { success: false, error: `Investigation ${id} not found` };
      }

      let findings = inv.findings;

      // Filter by type
      if (params.types && params.types.length > 0) {
        findings = findings.filter(f => params.types.includes(f.type));
      }

      // Filter sensitive unless explicitly included
      if (!params.includeSensitive) {
        findings = findings.filter(f => !f.sensitive);
      }

      // Convert to basset-hound orphan format
      const orphans = findings.map(f => ({
        identifier_type: f.orphanType.toUpperCase(),
        identifier_value: f.value,
        metadata: {
          source_type: f.type,
          subtype: f.subtype,
          context: f.context,
          confidence: f.confidence,
        },
        provenance: f.provenance,
        tags: [
          `investigation:${inv.id}`,
          f.type,
          f.subtype ? `subtype:${f.subtype}` : null,
        ].filter(Boolean),
      }));

      return {
        success: true,
        orphans,
        count: orphans.length,
        investigationId: inv.id,
        caseNumber: inv.caseNumber,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ==========================================
  // FULL PAGE INVESTIGATION
  // ==========================================

  /**
   * Run full OSINT investigation on current page
   *
   * Command: investigate_page
   * Params:
   *   - captureEvidence: boolean (optional, default true)
   *   - extractData: boolean (optional, default true)
   *   - followLinks: boolean (optional, default false)
   */
  commandHandlers.investigate_page = async (params, context) => {
    try {
      const results = {
        url: null,
        title: null,
        osintData: null,
        evidence: null,
        linksQueued: 0,
      };

      // Get page info
      if (executeInRenderer) {
        const pageInfo = await executeInRenderer(`
          ({
            url: window.location.href,
            title: document.title
          })
        `);
        results.url = pageInfo.url;
        results.title = pageInfo.title;
      }

      // Extract OSINT data
      if (params.extractData !== false) {
        const extraction = await commandHandlers.extract_osint_data({
          addToInvestigation: true,
        });
        results.osintData = {
          totalFindings: extraction.totalFindings,
          byType: extraction.byType,
        };
      }

      // Capture evidence
      if (params.captureEvidence !== false) {
        // Use evidence collection if available
        if (commandHandlers.capture_screenshot_evidence) {
          const evidenceResult = await commandHandlers.capture_screenshot_evidence({
            url: results.url,
            title: results.title,
          });
          results.evidence = {
            captured: evidenceResult.success,
            evidenceId: evidenceResult.evidenceId,
          };
        }
      }

      // Queue links for further investigation
      if (params.followLinks) {
        const linkResult = await commandHandlers.investigate_links({});
        results.linksQueued = linkResult.queued;
      }

      return {
        success: true,
        ...results,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  console.log('[OSINT] 18 OSINT commands registered');
}

module.exports = {
  registerOsintCommands,
  getInvestigationManager,
  InvestigationManager,
  extractOsintData,
  generateProvenance,
  OSINT_PATTERNS,
};
