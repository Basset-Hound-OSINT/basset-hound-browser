/**
 * Slack Alert Formatter Tests
 *
 * Tests for alert formatting into Slack messages:
 * - Competitor changes
 * - Technology updates
 * - Errors
 * - Campaigns
 * - Generic alerts
 *
 * @test
 */

const { SlackAlertFormatter } = require('../../integrations/slack-alert-formatter');

describe('SlackAlertFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new SlackAlertFormatter({
      includeMetadata: true,
      includeButtons: true
    });
  });

  describe('Competitor Change Formatting', () => {
    test('should format competitor change alert', () => {
      const alert = {
        id: 'alert-001',
        alertType: 'competitor_change',
        competitorName: 'Acme Corp',
        changeType: 'pricing',
        changeDetails: { oldPrice: '$100', newPrice: '$80' },
        url: 'https://acme.com/pricing',
        severity: 'high',
        timestamp: Date.now()
      };

      const formatted = formatter.formatCompetitorChange(alert);

      expect(formatted.text).toContain('Acme Corp');
      expect(formatted.blocks).toBeDefined();
      expect(formatted.blocks.length).toBeGreaterThan(0);
      expect(formatted.attachments).toBeDefined();
    });

    test('should include action buttons in competitor change', () => {
      const alert = {
        id: 'alert-001',
        alertType: 'competitor_change',
        competitorName: 'Test Corp',
        changeType: 'feature',
        url: 'https://test.com',
        severity: 'medium',
        timestamp: Date.now()
      };

      const formatted = formatter.formatCompetitorChange(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('View Details');
      expect(json).toContain('Acknowledge');
    });

    test('should apply severity color to competitor change', () => {
      const alert = {
        id: 'test',
        alertType: 'competitor_change',
        competitorName: 'Test',
        changeType: 'feature',
        severity: 'critical',
        timestamp: Date.now()
      };

      const formatted = formatter.formatCompetitorChange(alert);

      expect(formatted.attachments[0].color).toBe('#ff0000');
    });
  });

  describe('Technology Update Formatting', () => {
    test('should format technology update alert', () => {
      const alert = {
        id: 'alert-002',
        alertType: 'technology_update',
        competitorName: 'Tech Corp',
        technology: 'React',
        previousVersion: '17.0.0',
        newVersion: '18.0.0',
        changes: ['Hooks support', 'Concurrent rendering'],
        url: 'https://techcorp.com',
        severity: 'info',
        timestamp: Date.now()
      };

      const formatted = formatter.formatTechnologyUpdate(alert);

      expect(formatted.text).toContain('Technology Update');
      expect(formatted.blocks).toBeDefined();
      expect(JSON.stringify(formatted)).toContain('React');
      expect(JSON.stringify(formatted)).toContain('18.0.0');
    });

    test('should include changes list in technology alert', () => {
      const alert = {
        id: 'test',
        alertType: 'technology_update',
        competitorName: 'Test',
        technology: 'Node.js',
        previousVersion: '14.0.0',
        newVersion: '16.0.0',
        changes: ['Improved performance', 'New API', 'Breaking changes'],
        severity: 'medium',
        timestamp: Date.now()
      };

      const formatted = formatter.formatTechnologyUpdate(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('Improved performance');
      expect(json).toContain('New API');
    });
  });

  describe('Error Alert Formatting', () => {
    test('should format error alert', () => {
      const alert = {
        id: 'alert-003',
        alertType: 'error',
        errorType: 'NetworkError',
        errorMessage: 'Failed to connect to server',
        stackTrace: 'Error: Network\n  at connect (index.js:10)',
        severity: 'high',
        timestamp: Date.now()
      };

      const formatted = formatter.formatErrorAlert(alert);

      expect(formatted.text).toContain('Error');
      expect(formatted.blocks).toBeDefined();
      expect(JSON.stringify(formatted)).toContain('NetworkError');
      expect(JSON.stringify(formatted)).toContain('Failed to connect');
    });

    test('should include stack trace in error alert', () => {
      const stackTrace = `Error: Test error
  at Function.test (test.js:5)
  at Object.<anonymous> (test.js:10)`;

      const alert = {
        id: 'test',
        alertType: 'error',
        errorType: 'TestError',
        errorMessage: 'Test failed',
        stackTrace,
        severity: 'critical',
        timestamp: Date.now()
      };

      const formatted = formatter.formatErrorAlert(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('Stack Trace');
      expect(json).toContain('Error: Test error');
    });

    test('should include context in error alert', () => {
      const alert = {
        id: 'test',
        alertType: 'error',
        errorType: 'ValidationError',
        errorMessage: 'Invalid input',
        context: { field: 'email', value: 'invalid' },
        severity: 'medium',
        timestamp: Date.now()
      };

      const formatted = formatter.formatErrorAlert(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('Context');
      expect(json).toContain('email');
    });
  });

  describe('Campaign Alert Formatting', () => {
    test('should format campaign update alert', () => {
      const alert = {
        id: 'alert-004',
        alertType: 'campaign_update',
        campaignId: 'campaign-001',
        campaignName: 'Q1 2024 Monitor',
        updateType: 'target_added',
        affectedCompetitors: ['Acme Corp', 'Tech Inc'],
        severity: 'info',
        timestamp: Date.now()
      };

      const formatted = formatter.formatCampaignUpdate(alert);

      expect(formatted.text).toContain('Campaign Update');
      expect(formatted.blocks).toBeDefined();
      expect(JSON.stringify(formatted)).toContain('Q1 2024 Monitor');
      expect(JSON.stringify(formatted)).toContain('2 competitors');
    });

    test('should list affected competitors', () => {
      const alert = {
        id: 'test',
        alertType: 'campaign_update',
        campaignId: 'camp-001',
        campaignName: 'Monitor',
        updateType: 'update',
        affectedCompetitors: ['Competitor A', 'Competitor B', 'Competitor C'],
        severity: 'low',
        timestamp: Date.now()
      };

      const formatted = formatter.formatCampaignUpdate(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('Affected Competitors');
      expect(json).toContain('Competitor A');
      expect(json).toContain('Competitor B');
      expect(json).toContain('Competitor C');
    });
  });

  describe('Generic Alert Formatting', () => {
    test('should format generic alert', () => {
      const alert = {
        id: 'alert-005',
        title: 'Custom Alert',
        message: 'This is a custom alert message',
        severity: 'info',
        source: 'browser',
        timestamp: Date.now()
      };

      const formatted = formatter.formatGenericAlert(alert);

      expect(formatted.text).toBe('Custom Alert');
      expect(formatted.blocks).toBeDefined();
      expect(JSON.stringify(formatted)).toContain('Custom Alert');
      expect(JSON.stringify(formatted)).toContain('This is a custom alert message');
    });

    test('should include metadata in generic alert', () => {
      const alert = {
        id: 'test',
        title: 'Alert',
        message: 'Test',
        metadata: { userId: 123, action: 'update' },
        severity: 'medium',
        timestamp: Date.now()
      };

      const formatted = formatter.formatGenericAlert(alert);
      const json = JSON.stringify(formatted);

      expect(json).toContain('Details');
      expect(json).toContain('userId');
    });
  });

  describe('Alert Type Routing', () => {
    test('should route competitor_change type', () => {
      const alert = {
        id: 'test',
        type: 'competitor_change',
        competitorName: 'Test',
        changeType: 'feature',
        timestamp: Date.now()
      };

      const formatted = formatter.formatAlert(alert);
      expect(formatted.text).toContain('Competitor Change Detected');
    });

    test('should route technology_update type', () => {
      const alert = {
        id: 'test',
        type: 'technology_update',
        competitorName: 'Test',
        technology: 'React',
        previousVersion: '17',
        newVersion: '18',
        timestamp: Date.now()
      };

      const formatted = formatter.formatAlert(alert);
      expect(formatted.text).toContain('Technology Update');
    });

    test('should route error type', () => {
      const alert = {
        id: 'test',
        type: 'error',
        errorType: 'TestError',
        errorMessage: 'Test',
        timestamp: Date.now()
      };

      const formatted = formatter.formatAlert(alert);
      expect(formatted.text).toContain('Error');
    });

    test('should route campaign type', () => {
      const alert = {
        id: 'test',
        type: 'campaign_update',
        campaignName: 'Test Campaign',
        updateType: 'update',
        timestamp: Date.now()
      };

      const formatted = formatter.formatAlert(alert);
      expect(formatted.text).toContain('Campaign Update');
    });

    test('should default to generic for unknown type', () => {
      const alert = {
        id: 'test',
        type: 'unknown_type',
        title: 'Custom',
        message: 'Test',
        timestamp: Date.now()
      };

      const formatted = formatter.formatAlert(alert);
      expect(formatted.text).toBe('Custom');
    });
  });

  describe('Utility Methods', () => {
    test('should truncate long text', () => {
      const text = 'A'.repeat(500);
      const truncated = formatter.truncate(text, 100);

      expect(truncated.length).toBeLessThanOrEqual(100);
      expect(truncated).toContain('...');
    });

    test('should not truncate short text', () => {
      const text = 'Short text';
      const truncated = formatter.truncate(text, 100);

      expect(truncated).toBe(text);
    });

    test('should format timestamps', () => {
      const now = Date.now();
      const formatted = formatter.formatTime(now);

      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
    });

    test('should handle missing timestamps', () => {
      const formatted = formatter.formatTime(null);

      expect(formatted).toBeTruthy();
      expect(formatted).toMatch(/\d{4}/); // Should contain year
    });
  });

  describe('Custom Configuration', () => {
    test('should use custom emoji map', () => {
      const customFormatter = new SlackAlertFormatter({
        emojiMap: {
          competitor_change: '🎯'
        }
      });

      expect(customFormatter.config.emojiMap.competitor_change).toBe('🎯');
    });

    test('should use custom color map', () => {
      const customFormatter = new SlackAlertFormatter({
        colorMap: {
          critical: '#000000'
        }
      });

      expect(customFormatter.config.colorMap.critical).toBe('#000000');
    });

    test('should respect includeButtons setting', () => {
      const noButtonFormatter = new SlackAlertFormatter({
        includeButtons: false
      });

      const alert = {
        id: 'test',
        alertType: 'competitor_change',
        competitorName: 'Test',
        changeType: 'feature',
        severity: 'high',
        timestamp: Date.now()
      };

      const formatted = noButtonFormatter.formatCompetitorChange(alert);
      const json = JSON.stringify(formatted);

      expect(json).not.toContain('View Details');
    });
  });
});
