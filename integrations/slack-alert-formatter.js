/**
 * Slack Alert Formatter
 *
 * Formats various alert types into rich Slack messages:
 * - Competitor changes
 * - Technology updates
 * - Error alerts
 * - Campaign updates
 * - Custom alerts
 *
 * @module integrations/slack-alert-formatter
 */

/**
 * Alert formatter with support for multiple alert types
 */
class SlackAlertFormatter {
  constructor(config = {}) {
    this.config = {
      includeMetadata: config.includeMetadata !== false,
      emojiMap: config.emojiMap || this.getDefaultEmojiMap(),
      colorMap: config.colorMap || this.getDefaultColorMap(),
      includeButtons: config.includeButtons !== false,
      maxFieldLength: config.maxFieldLength || 300
    };
  }

  /**
   * Get default emoji mapping
   */
  getDefaultEmojiMap() {
    return {
      competitor_change: '🔄',
      technology_update: '⚡',
      error: '🚨',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️',
      campaign: '📢',
      detection: '🎯',
      evasion: '🕵️',
      monitoring: '👁️'
    };
  }

  /**
   * Get default color mapping
   */
  getDefaultColorMap() {
    return {
      critical: '#ff0000',
      high: '#ff6600',
      medium: '#ffcc00',
      low: '#00cc00',
      info: '#0099ff',
      success: '#00ff00',
      warning: '#ffcc00',
      error: '#ff0000'
    };
  }

  /**
   * Format competitor change alert
   *
   * @param {Object} alert - Alert data
   * @returns {Object} Slack message payload
   */
  formatCompetitorChange(alert) {
    const {
      competitorName,
      changeType,
      changeDetails,
      url,
      timestamp,
      severity = 'medium',
      screenshot
    } = alert;

    const emoji = this.config.emojiMap.competitor_change;
    const color = this.config.colorMap[severity] || this.config.colorMap.info;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Competitor Change Detected`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Competitor:*\n${competitorName}`
          },
          {
            type: 'mrkdwn',
            text: `*Change Type:*\n${changeType || 'unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${severity.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Detected:*\n${this.formatTime(timestamp)}`
          }
        ]
      }
    ];

    // Add change details
    if (changeDetails) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Changes:*\n\`\`\`${this.truncate(JSON.stringify(changeDetails, null, 2), this.config.maxFieldLength)}\`\`\``
        }
      });
    }

    // Add URL if available
    if (url) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*URL:* <${url}|View Page>`
        }
      });
    }

    // Add action buttons
    if (this.config.includeButtons) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true
            },
            url: url || '#',
            action_id: 'view_competitor_change'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Acknowledge',
              emoji: true
            },
            value: alert.id || 'unknown',
            action_id: 'ack_competitor_change'
          }
        ]
      });
    }

    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Basset Hound Browser | Alert ID: ${alert.id || 'unknown'}_`
        }
      ]
    });

    return {
      text: `Competitor Change: ${competitorName}`,
      blocks,
      attachments: screenshot ? [
        {
          color,
          image_url: screenshot,
          title: 'Screenshot',
          title_link: url
        }
      ] : [
        {
          color,
          fields: this.config.includeMetadata && alert.metadata ? [
            {
              title: 'Metadata',
              value: this.truncate(JSON.stringify(alert.metadata, null, 2), 500),
              short: false
            }
          ] : []
        }
      ]
    };
  }

  /**
   * Format technology update alert
   *
   * @param {Object} alert - Alert data
   * @returns {Object} Slack message payload
   */
  formatTechnologyUpdate(alert) {
    const {
      competitorName,
      technology,
      changes,
      previousVersion,
      newVersion,
      timestamp,
      severity = 'info',
      url
    } = alert;

    const emoji = this.config.emojiMap.technology_update;
    const color = this.config.colorMap[severity] || this.config.colorMap.info;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Technology Update Detected`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Competitor:*\n${competitorName}`
          },
          {
            type: 'mrkdwn',
            text: `*Technology:*\n${technology}`
          },
          {
            type: 'mrkdwn',
            text: `*Previous:*\n${previousVersion || 'unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*New:*\n${newVersion || 'unknown'}`
          }
        ]
      }
    ];

    // Add changes if available
    if (changes) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Changes:*\n• ${changes.join('\n• ')}`
        }
      });
    }

    // Add URL
    if (url) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Detected at:* <${url}|${this.formatTime(timestamp)}>`
        }
      });
    }

    if (this.config.includeButtons) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Verify',
              emoji: true
            },
            url: url || '#',
            action_id: 'verify_tech_update'
          }
        ]
      });
    }

    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Basset Hound Browser | Alert ID: ${alert.id || 'unknown'}_`
        }
      ]
    });

    return {
      text: `Technology Update: ${technology}`,
      blocks,
      attachments: [
        {
          color,
          fields: []
        }
      ]
    };
  }

  /**
   * Format error alert
   *
   * @param {Object} alert - Alert data
   * @returns {Object} Slack message payload
   */
  formatErrorAlert(alert) {
    const {
      errorType,
      errorMessage,
      stackTrace,
      context,
      timestamp,
      severity = 'high'
    } = alert;

    const emoji = this.config.emojiMap.error;
    const color = this.config.colorMap[severity] || '#ff0000';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Error Alert`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Error Type:*\n${errorType || 'Unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${severity.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${this.formatTime(timestamp)}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Message:*\n${errorMessage || 'No message provided'}`
        }
      }
    ];

    // Add stack trace if available
    if (stackTrace) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`${this.truncate(stackTrace, 300)}\`\`\``
        }
      });
    }

    // Add context if available
    if (context) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Context:*\n${this.truncate(JSON.stringify(context, null, 2), this.config.maxFieldLength)}`
        }
      });
    }

    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Basset Hound Browser | Alert ID: ${alert.id || 'unknown'}_`
        }
      ]
    });

    return {
      text: `Error: ${errorType}`,
      blocks,
      attachments: [
        {
          color,
          fields: []
        }
      ]
    };
  }

  /**
   * Format campaign update alert
   *
   * @param {Object} alert - Alert data
   * @returns {Object} Slack message payload
   */
  formatCampaignUpdate(alert) {
    const {
      campaignId,
      campaignName,
      updateType,
      updateData,
      affectedCompetitors,
      timestamp,
      severity = 'info'
    } = alert;

    const emoji = this.config.emojiMap.campaign;
    const color = this.config.colorMap[severity] || this.config.colorMap.info;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Campaign Update`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Campaign:*\n${campaignName || campaignId}`
          },
          {
            type: 'mrkdwn',
            text: `*Update Type:*\n${updateType}`
          },
          {
            type: 'mrkdwn',
            text: `*Updated:*\n${this.formatTime(timestamp)}`
          },
          {
            type: 'mrkdwn',
            text: `*Affected:*\n${affectedCompetitors?.length || 0} competitors`
          }
        ]
      }
    ];

    // Add update details
    if (updateData) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Update Details:*\n${this.truncate(JSON.stringify(updateData, null, 2), this.config.maxFieldLength)}`
        }
      });
    }

    // Add affected competitors
    if (affectedCompetitors && affectedCompetitors.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected Competitors:*\n• ${affectedCompetitors.join('\n• ')}`
        }
      });
    }

    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Basset Hound Browser | Campaign ID: ${campaignId || 'unknown'}_`
        }
      ]
    });

    return {
      text: `Campaign Update: ${campaignName || campaignId}`,
      blocks,
      attachments: [
        {
          color,
          fields: []
        }
      ]
    };
  }

  /**
   * Format generic alert
   *
   * @param {Object} alert - Alert data
   * @returns {Object} Slack message payload
   */
  formatGenericAlert(alert) {
    const {
      title,
      message,
      metadata,
      severity = 'info',
      source = 'browser',
      timestamp
    } = alert;

    const color = this.config.colorMap[severity] || this.config.colorMap.info;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title || 'Alert',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Source:*\n${source}`
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${severity.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${this.formatTime(timestamp)}`
          }
        ]
      }
    ];

    // Add message
    if (message) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: this.truncate(message, this.config.maxFieldLength * 2)
        }
      });
    }

    // Add metadata
    if (metadata && this.config.includeMetadata) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Details:*\n\`\`\`${this.truncate(JSON.stringify(metadata, null, 2), 300)}\`\`\``
        }
      });
    }

    blocks.push({
      type: 'divider'
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Basset Hound Browser | Alert ID: ${alert.id || 'unknown'}_`
        }
      ]
    });

    return {
      text: title || 'Alert',
      blocks,
      attachments: [
        {
          color,
          fields: []
        }
      ]
    };
  }

  /**
   * Route alert to appropriate formatter based on type
   *
   * @param {Object} alert - Alert data with type field
   * @returns {Object} Slack message payload
   */
  formatAlert(alert) {
    const { alertType, type } = alert;
    const alertTypeNormalized = (alertType || type || 'generic').toLowerCase();

    switch (alertTypeNormalized) {
    case 'competitor_change':
    case 'competitor':
      return this.formatCompetitorChange(alert);

    case 'technology_update':
    case 'technology':
      return this.formatTechnologyUpdate(alert);

    case 'error':
      return this.formatErrorAlert(alert);

    case 'campaign_update':
    case 'campaign':
      return this.formatCampaignUpdate(alert);

    default:
      return this.formatGenericAlert(alert);
    }
  }

  /**
   * Truncate text to max length with ellipsis
   *
   * @private
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format timestamp to readable string
   *
   * @private
   */
  formatTime(timestamp) {
    if (!timestamp) {
      return new Date().toISOString();
    }

    const date = new Date(timestamp);
    return date.toLocaleString();
  }
}

module.exports = { SlackAlertFormatter };
