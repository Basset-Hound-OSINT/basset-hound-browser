/**
 * Maltego Export Integration
 * Export findings in Maltego-compatible formats (CSV, STIX)
 */

const { PlatformIntegration } = require('../platform-integrations-framework');

class MaltegoExport extends PlatformIntegration {
  constructor(config = {}) {
    super('maltego', {
      apiUrl: config.apiUrl || 'http://localhost:8080/api',
      ...config
    });
  }

  /**
   * Export data to Maltego format
   * @param {object} data - Session data to export
   * @param {object} options - Export options
   */
  async export(data, options = {}) {
    try {
      const { format = 'csv', includeRelationships = true } = options;

      let result;

      if (format === 'stix') {
        result = this._exportAsSTIX(data, options);
      } else {
        result = this._exportAsCSV(data, options);
      }

      // Track export
      this._trackExport(result);

      // Send webhook if configured
      if (this.webhookUrl) {
        await this.sendWebhookNotification({
          event: 'export.maltego',
          platform: 'maltego',
          format,
          entityCount: result.entityCount,
          timestamp: result.timestamp
        });
      }

      return {
        success: true,
        platform: 'maltego',
        format,
        data: result,
        entityCount: result.entityCount,
        timestamp: result.timestamp
      };
    } catch (error) {
      return {
        success: false,
        platform: 'maltego',
        error: error.message
      };
    }
  }

  /**
   * Export as CSV format (Maltego standard)
   * @private
   */
  _exportAsCSV(data, options = {}) {
    const rows = [];
    const entities = [];

    // Header
    rows.push('Type,Value,Description,Confidence,Tags');

    const addEntity = (type, value, description = '', confidence = 100, tags = '') => {
      if (!value) {
        return;
      }

      entities.push({
        type,
        value,
        description,
        confidence,
        tags
      });

      const escaped = String(value).replace(/"/g, '""');
      rows.push(`${type},"${escaped}","${description}",${confidence},"${tags}"`);
    };

    // Add URL
    if (data.url) {
      addEntity('URL', data.url, 'Target URL from OSINT scan', 100, 'basset-hound;osint;target');
    }

    // Add domain
    if (data.domain) {
      addEntity('Domain', data.domain, 'Target domain', 100, 'basset-hound;dns;target');
    }

    // Add IP
    if (data.networkData?.ip) {
      addEntity(
        'IPv4Address',
        data.networkData.ip,
        `IP address (${data.networkData.hostname || 'unknown'})`,
        95,
        'basset-hound;host;target'
      );
    }

    // Add technologies as Phrase entities
    if (data.technologies && Array.isArray(data.technologies)) {
      data.technologies.forEach(tech => {
        const description = tech.version ? `${tech.category} - ${tech.version}` : tech.category;
        addEntity(
          'Phrase',
          tech.name,
          description,
          this.formatConfidence(tech.confidence),
          'basset-hound;technology'
        );
      });
    }

    // Add emails
    if (data.emails && Array.isArray(data.emails)) {
      data.emails.forEach(email => {
        addEntity('EmailAddress', email, 'Email found on target', 80, 'basset-hound;contact');
      });
    }

    // Add phone numbers
    if (data.phones && Array.isArray(data.phones)) {
      data.phones.forEach(phone => {
        addEntity('PhoneNumber', phone, 'Phone number found on target', 75, 'basset-hound;contact');
      });
    }

    // Add author/person if available
    if (data.metadata?.author) {
      addEntity('Person', data.metadata.author, 'Site author/contact', 60, 'basset-hound;contact');
    }

    return {
      format: 'csv',
      content: rows.join('\n'),
      entityCount: entities.length,
      entities,
      timestamp: this.formatTimestamp()
    };
  }

  /**
   * Export as STIX format
   * @private
   */
  _exportAsSTIX(data, options = {}) {
    const objects = [];
    const relationships = [];

    // Create identity object (attribution)
    const identity = {
      type: 'identity',
      id: `identity--${this._generateUUID()}`,
      created: this.formatTimestamp(),
      modified: this.formatTimestamp(),
      name: 'Basset Hound Browser',
      identity_class: 'individual'
    };
    objects.push(identity);

    // Create URL indicator
    if (data.url) {
      const urlIndicator = {
        type: 'indicator',
        id: `indicator--${this._generateUUID()}`,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        labels: ['malicious-activity', 'osint'],
        pattern: `[url:value = '${this._escapePattern(data.url)}']`,
        valid_from: this.formatTimestamp(),
        created_by_ref: identity.id
      };
      objects.push(urlIndicator);
    }

    // Create domain indicator
    if (data.domain) {
      const domainIndicator = {
        type: 'indicator',
        id: `indicator--${this._generateUUID()}`,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        labels: ['malicious-activity', 'osint'],
        pattern: `[domain-name:value = '${this._escapePattern(data.domain)}']`,
        valid_from: this.formatTimestamp(),
        created_by_ref: identity.id
      };
      objects.push(domainIndicator);
    }

    // Create IP indicator
    if (data.networkData?.ip) {
      const ipIndicator = {
        type: 'indicator',
        id: `indicator--${this._generateUUID()}`,
        created: this.formatTimestamp(),
        modified: this.formatTimestamp(),
        labels: ['malicious-activity', 'osint'],
        pattern: `[ipv4-addr:value = '${data.networkData.ip}']`,
        valid_from: this.formatTimestamp(),
        created_by_ref: identity.id
      };
      objects.push(ipIndicator);
    }

    // Create email address observables
    if (data.emails && Array.isArray(data.emails)) {
      data.emails.forEach(email => {
        const emailObservable = {
          type: 'indicator',
          id: `indicator--${this._generateUUID()}`,
          created: this.formatTimestamp(),
          modified: this.formatTimestamp(),
          labels: ['malicious-activity'],
          pattern: `[email-addr:value = '${this._escapePattern(email)}']`,
          valid_from: this.formatTimestamp(),
          created_by_ref: identity.id
        };
        objects.push(emailObservable);
      });
    }

    return {
      type: 'bundle',
      id: `bundle--${this._generateUUID()}`,
      objects,
      relationships,
      entityCount: objects.length,
      timestamp: this.formatTimestamp()
    };
  }

  /**
   * Escape special characters in STIX pattern
   * @private
   */
  _escapePattern(value) {
    return String(value).replace(/'/g, "\\'").replace(/\\/g, '\\\\');
  }

  /**
   * Generate UUID v4
   * @private
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Format data for Maltego transform
   */
  static formatForTransform(data, options = {}) {
    return {
      entities: [
        ...(data.url ? [{
          type: 'maltego.URL',
          value: data.url,
          properties: {
            source: 'Basset Hound Browser'
          }
        }] : []),
        ...(data.domain ? [{
          type: 'maltego.DNSName',
          value: data.domain,
          properties: {
            source: 'Basset Hound Browser'
          }
        }] : []),
        ...(data.networkData?.ip ? [{
          type: 'maltego.IPv4Address',
          value: data.networkData.ip,
          properties: {
            source: 'Basset Hound Browser'
          }
        }] : []),
        ...(data.emails || []).map(email => ({
          type: 'maltego.EmailAddress',
          value: email,
          properties: {
            source: 'Basset Hound Browser'
          }
        })),
        ...(data.technologies || []).map(tech => ({
          type: 'maltego.Phrase',
          value: tech.name,
          properties: {
            category: tech.category,
            confidence: tech.confidence * 100
          }
        }))
      ]
    };
  }
}

module.exports = MaltegoExport;
