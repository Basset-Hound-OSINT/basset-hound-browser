/**
 * STIX/TAXII Export Integration
 * Export findings in STIX 2.1 format for incident response
 */

const crypto = require('crypto');
const { PlatformIntegration } = require('../platform-integrations-framework');

class STIXExport extends PlatformIntegration {
  constructor(config = {}) {
    super('stix', {
      stixVersion: '2.1',
      ...config
    });
  }

  /**
   * Export data to STIX format
   * @param {object} data - Session data to export
   * @param {object} options - Export options
   */
  async export(data, options = {}) {
    try {
      const {
        bundleId = null,
        createdByRef = null,
        externalReferences = []
      } = options;

      const stixBundle = this._createSTIXBundle(data, {
        bundleId,
        createdByRef,
        externalReferences
      });

      // Track export
      this._trackExport(stixBundle);

      // Send webhook if configured
      if (this.webhookUrl) {
        await this.sendWebhookNotification({
          event: 'export.stix',
          platform: 'stix',
          objectCount: stixBundle.objects.length,
          timestamp: stixBundle.timestamp
        });
      }

      return {
        success: true,
        platform: 'stix',
        format: 'json',
        stixVersion: this.config.stixVersion,
        data: stixBundle,
        objectCount: stixBundle.objects.length,
        timestamp: stixBundle.timestamp
      };
    } catch (error) {
      return {
        success: false,
        platform: 'stix',
        error: error.message
      };
    }
  }

  /**
   * Create STIX 2.1 bundle from session data
   * @private
   */
  _createSTIXBundle(data, options = {}) {
    const objects = [];
    const relationships = [];

    // Create identity (analyst/organization)
    const identityId = `identity--${this._generateUUID()}`;
    const identity = {
      type: 'identity',
      id: identityId,
      created: this.formatTimestamp(),
      modified: this.formatTimestamp(),
      name: 'Basset Hound Browser',
      identity_class: 'system'
    };
    objects.push(identity);

    // Track created objects for relationships
    const createdObjects = [];

    // Create URL indicator
    if (data.url) {
      const urlIndicatorId = `indicator--${this._generateUUID()}`;
      createdObjects.push({
        id: urlIndicatorId,
        type: 'url-indicator'
      });

      objects.push({
        type: 'indicator',
        id: urlIndicatorId,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        name: `URL: ${data.url}`,
        description: 'URL from OSINT scan',
        pattern: `[url:value = '${this._escapePattern(data.url)}']`,
        pattern_type: 'stix',
        labels: ['malicious-activity', 'osint-finding'],
        valid_from: this.formatTimestamp(),
        created_by_ref: identityId
      });
    }

    // Create domain indicator
    if (data.domain) {
      const domainIndicatorId = `indicator--${this._generateUUID()}`;
      createdObjects.push({
        id: domainIndicatorId,
        type: 'domain-indicator'
      });

      objects.push({
        type: 'indicator',
        id: domainIndicatorId,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        name: `Domain: ${data.domain}`,
        description: 'Domain from OSINT scan',
        pattern: `[domain-name:value = '${this._escapePattern(data.domain)}']`,
        pattern_type: 'stix',
        labels: ['malicious-activity', 'osint-finding'],
        valid_from: this.formatTimestamp(),
        created_by_ref: identityId
      });
    }

    // Create IP address observable
    if (data.networkData?.ip) {
      const ipObservableId = `observed-data--${this._generateUUID()}`;
      createdObjects.push({
        id: ipObservableId,
        type: 'ip-observable'
      });

      objects.push({
        type: 'observed-data',
        id: ipObservableId,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        first_observed: this.formatTimestamp(),
        last_observed: this.formatTimestamp(),
        number_observed: 1,
        objects: {
          0: {
            type: 'ipv4-addr',
            value: data.networkData.ip
          }
        },
        created_by_ref: identityId
      });
    }

    // Create email address observables
    if (data.emails && Array.isArray(data.emails)) {
      data.emails.forEach(email => {
        const emailObservableId = `indicator--${this._generateUUID()}`;
        createdObjects.push({
          id: emailObservableId,
          type: 'email-indicator'
        });

        objects.push({
          type: 'indicator',
          id: emailObservableId,
          created: this.formatTimestamp(),
          modified: this.formatTimestamp(),
          name: `Email: ${email}`,
          pattern: `[email-addr:value = '${this._escapePattern(email)}']`,
          pattern_type: 'stix',
          labels: ['malicious-activity'],
          valid_from: this.formatTimestamp(),
          created_by_ref: identityId
        });
      });
    }

    // Create file hash observables
    if (data.hashes) {
      const hashes = [];
      if (data.hashes.md5) {
        hashes.push({ algorithm: 'MD5', hash_value: data.hashes.md5 });
      }
      if (data.hashes.sha1) {
        hashes.push({ algorithm: 'SHA-1', hash_value: data.hashes.sha1 });
      }
      if (data.hashes.sha256) {
        hashes.push({ algorithm: 'SHA-256', hash_value: data.hashes.sha256 });
      }

      hashes.forEach(hashObj => {
        const hashObservableId = `observed-data--${this._generateUUID()}`;
        createdObjects.push({
          id: hashObservableId,
          type: 'file-observable'
        });

        objects.push({
          type: 'observed-data',
          id: hashObservableId,
          created: this.formatTimestamp(),
          modified: this.formatTimestamp(),
          first_observed: this.formatTimestamp(),
          last_observed: this.formatTimestamp(),
          number_observed: 1,
          objects: {
            0: {
              type: 'file',
              hashes: {
                [hashObj.algorithm]: hashObj.hash_value
              }
            }
          },
          created_by_ref: identityId
        });
      });
    }

    // Create campaign/incident object if data indicates malicious activity
    if (options.campaignName || data.isMalicious) {
      const campaignId = `campaign--${this._generateUUID()}`;
      createdObjects.push({
        id: campaignId,
        type: 'campaign'
      });

      objects.push({
        type: 'campaign',
        id: campaignId,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        name: options.campaignName || 'OSINT Investigation',
        description: 'Campaign from Basset Hound OSINT scan',
        created_by_ref: identityId
      });
    }

    // Create relationships between objects
    if (createdObjects.length > 1) {
      for (let i = 0; i < createdObjects.length - 1; i++) {
        relationships.push({
          type: 'relationship',
          id: `relationship--${this._generateUUID()}`,
          created: this.formatTimestamp(),
          modified: this.formatTimestamp(),
          relationship_type: 'related-to',
          source_ref: createdObjects[i].id,
          target_ref: createdObjects[i + 1].id
        });
      }
    }

    // Add external references if provided
    if (Array.isArray(options.externalReferences)) {
      objects.forEach(obj => {
        if (obj.type === 'indicator' || obj.type === 'observed-data') {
          obj.external_references = options.externalReferences;
        }
      });
    }

    return {
      type: 'bundle',
      id: options.bundleId || `bundle--${this._generateUUID()}`,
      created: this.formatTimestamp(),
      modified: this.formatTimestamp(),
      objects: [...objects, ...relationships],
      timestamp: this.formatTimestamp()
    };
  }

  /**
   * Escape special characters in STIX pattern
   * @private
   */
  _escapePattern(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Generate UUID v4 (CVE-W14-NEW-005: FIXED)
   * Uses Node.js crypto.randomUUID() for secure UUID generation
   * @private
   */
  _generateUUID() {
    // Use Node.js built-in crypto.randomUUID() (available in Node.js 15.7+)
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback for older Node versions - use secure random bytes
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Set version to 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Set variant to RFC 4122

    return [
      bytes.slice(0, 4).toString('hex'),
      bytes.slice(4, 6).toString('hex'),
      bytes.slice(6, 8).toString('hex'),
      bytes.slice(8, 10).toString('hex'),
      bytes.slice(10, 16).toString('hex')
    ].join('-');
  }

  /**
   * Create STIX 2.1 pattern from observable
   */
  static createPattern(type, value) {
    const escaped = String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");

    const patterns = {
      'url': `[url:value = '${escaped}']`,
      'domain': `[domain-name:value = '${escaped}']`,
      'ipv4': `[ipv4-addr:value = '${escaped}']`,
      'ipv6': `[ipv6-addr:value = '${escaped}']`,
      'email': `[email-addr:value = '${escaped}']`,
      'file': `[file:hashes.MD5 = '${escaped}']`,
      'hash': `[file:hashes.'${type}' = '${escaped}']`
    };

    return patterns[type] || null;
  }

  /**
   * Format for TAXII 2.0 transmission
   */
  static formatForTAXII(stixBundle) {
    return {
      media_type: 'application/stix+json;version=2.1',
      objects: stixBundle.objects
    };
  }
}

module.exports = STIXExport;
