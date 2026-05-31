/**
 * MISP Export Integration
 * Export findings in MISP event format
 */

const { PlatformIntegration } = require('../platform-integrations-framework');

class MISPExport extends PlatformIntegration {
  constructor(config = {}) {
    super('misp', {
      apiUrl: config.apiUrl || 'https://misp.example.com/api',
      ...config
    });
  }

  /**
   * Export data to MISP format
   * @param {object} data - Session data to export
   * @param {object} options - Export options
   */
  async export(data, options = {}) {
    try {
      const {
        eventName = 'OSINT Investigation',
        eventDescription = 'Findings from Basset Hound OSINT scan',
        threatLevel = 2,
        analysis = 1,
        distribution = 0
      } = options;

      // Create MISP event
      const mispEvent = {
        Event: {
          info: eventName,
          threat_level_id: threatLevel,
          analysis,
          distribution,
          date: new Date().toISOString().split('T')[0],
          timestamp: Math.floor(Date.now() / 1000),
          Attribute: this._createAttributes(data, eventDescription)
        }
      };

      // Add tags if available
      if (options.tags && Array.isArray(options.tags)) {
        mispEvent.Event.Tag = options.tags.map(tag => ({
          name: tag,
          exportable: true
        }));
      }

      // Track export
      this._trackExport(mispEvent);

      // Send webhook if configured
      if (this.webhookUrl) {
        await this.sendWebhookNotification({
          event: 'export.misp',
          platform: 'misp',
          eventName,
          attributeCount: mispEvent.Event.Attribute.length,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        platform: 'misp',
        format: 'json',
        data: mispEvent,
        attributeCount: mispEvent.Event.Attribute.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        platform: 'misp',
        error: error.message
      };
    }
  }

  /**
   * Create MISP attributes from session data
   * @private
   */
  _createAttributes(data, description = '') {
    const attributes = [];

    const addAttribute = (type, value, comment = '', toIds = true) => {
      if (!value) return;

      attributes.push({
        type,
        value,
        comment: comment || description,
        to_ids: toIds,
        timestamp: Math.floor(Date.now() / 1000)
      });
    };

    // URL attribute
    if (data.url) {
      addAttribute('url', data.url, 'Target URL from OSINT scan');
    }

    // IP attributes
    if (data.networkData?.ip) {
      addAttribute('ip-dst', data.networkData.ip, 'Target IP address');
    }

    // Domain attributes
    if (data.domain) {
      addAttribute('domain', data.domain, 'Target domain');
      // Also add as hostname if it's a full hostname
      if (data.networkData?.hostname && data.networkData.hostname !== data.domain) {
        addAttribute('hostname', data.networkData.hostname, 'Target hostname');
      }
    }

    // Email attributes
    if (data.emails && Array.isArray(data.emails)) {
      data.emails.forEach(email => {
        addAttribute('email-src', email, 'Email found on target');
      });
    }

    // Phone attributes (as comment pattern since MISP doesn't have phone type)
    if (data.phones && Array.isArray(data.phones)) {
      data.phones.forEach(phone => {
        addAttribute('comment', `Phone: ${phone}`, 'Phone number found on target', false);
      });
    }

    // Hash attributes
    if (data.hashes) {
      if (data.hashes.md5) {
        addAttribute('md5', data.hashes.md5, 'File MD5 hash');
      }
      if (data.hashes.sha1) {
        addAttribute('sha1', data.hashes.sha1, 'File SHA-1 hash');
      }
      if (data.hashes.sha256) {
        addAttribute('sha-256', data.hashes.sha256, 'File SHA-256 hash');
      }
    }

    // User-Agent attribute
    if (data.userAgent) {
      addAttribute('user-agent', data.userAgent, 'User-Agent string from target', false);
    }

    // HTTP header attributes
    if (data.headers) {
      if (data.headers['server']) {
        addAttribute('comment', `Server: ${data.headers['server']}`, 'Server header', false);
      }
      if (data.headers['x-powered-by']) {
        addAttribute('comment', `Powered-By: ${data.headers['x-powered-by']}`, 'Framework indicator', false);
      }
    }

    // Technology attributes (as tags or comments)
    if (data.technologies && Array.isArray(data.technologies)) {
      data.technologies.forEach(tech => {
        const version = tech.version ? ` (${tech.version})` : '';
        addAttribute(
          'comment',
          `Technology: ${tech.name}${version}`,
          `${tech.category} detected with ${this.formatConfidence(tech.confidence)}% confidence`,
          false
        );
      });
    }

    // Metadata attributes
    if (data.metadata) {
      if (data.metadata.author) {
        addAttribute('comment', `Author: ${data.metadata.author}`, 'Site author/contact', false);
      }
      if (data.metadata.generator) {
        addAttribute('comment', `Generator: ${data.metadata.generator}`, 'Page generator', false);
      }
    }

    // Generic comment with findings summary
    if (attributes.length > 0) {
      const summary = `Found ${attributes.length} attributes during OSINT scan with Basset Hound Browser`;
      addAttribute('comment', summary, 'Scan summary', false);
    }

    return attributes;
  }

  /**
   * Format attributes by type
   */
  static getAttributeTypes() {
    return {
      network: ['ip-dst', 'ip-src', 'domain', 'hostname', 'url'],
      email: ['email-src', 'email-dst'],
      hash: ['md5', 'sha1', 'sha-256'],
      file: ['filename', 'file-size'],
      domain_ip: ['domain|ip'],
      comment: ['comment'],
      user_agent: ['user-agent']
    };
  }

  /**
   * Create event from OSINT scan
   */
  static createEvent(data, options = {}) {
    return {
      Event: {
        info: options.eventName || 'OSINT Investigation',
        threat_level_id: options.threatLevel || 2,
        analysis: options.analysis || 1,
        distribution: options.distribution || 0,
        date: new Date().toISOString().split('T')[0],
        timestamp: Math.floor(Date.now() / 1000),
        ...options
      }
    };
  }
}

module.exports = MISPExport;
