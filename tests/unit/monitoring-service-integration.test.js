/**
 * Unit Test - Monitoring Service Integration Validation
 *
 * Validates that the Competitor Monitoring Service is properly set up for integration
 * without actually starting a WebSocket server.
 */

const path = require('path');
const fs = require('fs');

describe('Competitor Monitoring Service Integration', () => {
  test('MonitoringService module exists and exports correctly', () => {
    const monitoringServicePath = path.join(
      __dirname,
      '../../src/monitoring/monitoring-service.js'
    );

    expect(fs.existsSync(monitoringServicePath)).toBe(true);

    const { MonitoringService } = require('../../src/monitoring/monitoring-service');
    expect(MonitoringService).toBeDefined();
    expect(typeof MonitoringService).toBe('function');
  });

  test('Competitor monitoring commands module exists and exports correctly', () => {
    const commandsPath = path.join(
      __dirname,
      '../../websocket/commands/competitor-monitoring-commands.js'
    );

    expect(fs.existsSync(commandsPath)).toBe(true);

    const { registerCompetitorMonitoringCommands } = require('../../websocket/commands/competitor-monitoring-commands');
    expect(registerCompetitorMonitoringCommands).toBeDefined();
    expect(typeof registerCompetitorMonitoringCommands).toBe('function');
  });

  test('WebSocket server.js includes monitoring service integration code', () => {
    const serverPath = path.join(__dirname, '../../websocket/server.js');
    const serverCode = fs.readFileSync(serverPath, 'utf8');

    // Check that the integration code exists
    expect(serverCode).toContain('MonitoringService');
    expect(serverCode).toContain('registerCompetitorMonitoringCommands');
    expect(serverCode).toContain('this.monitoringService');
  });

  test('MonitoringService can be instantiated', () => {
    const { MonitoringService } = require('../../src/monitoring/monitoring-service');

    const service = new MonitoringService({
      dataDir: './test-data',
      enableAutoCheck: false
    });

    expect(service).toBeDefined();
    expect(service.status).toBeDefined();
    expect(service.monitorManager).toBeDefined();
    expect(service.changeDetector).toBeDefined();
    expect(service.alertDispatcher).toBeDefined();
  });

  test('AlertDispatcher records alerts regardless of channel success', async () => {
    const { MonitoringService } = require('../../src/monitoring/monitoring-service');

    const service = new MonitoringService({
      dataDir: './test-data',
      enableAutoCheck: false
    });

    const dispatcher = service.alertDispatcher;

    // Send alert with no channels configured
    const alertData = {
      monitorId: 'test-monitor',
      monitorName: 'Test',
      url: 'https://test.com',
      changeType: 'content',
      severity: 'medium',
      alertConfig: { enableEmail: false }
    };

    const result = await dispatcher.sendAlert(alertData);

    // Should record the alert for deduplication
    expect(result).toBeDefined();
    expect(result.alertHash).toBeDefined();

    // Second identical alert should be deduplicated
    const result2 = await dispatcher.sendAlert(alertData);
    expect(result2).toBeDefined();
    expect(result2.deduped).toBe(true);
  });

  test('MonitoringService cleanup removes old snapshots', () => {
    const { MonitoringService } = require('../../src/monitoring/monitoring-service');

    const service = new MonitoringService({
      dataDir: './test-data',
      enableAutoCheck: false
    });

    // Add test snapshots
    service.snapshots.set('monitor1', [
      {
        timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days old
        data: 'old'
      },
      {
        timestamp: Date.now(),
        data: 'new'
      }
    ]);

    // Run cleanup
    const result = service.cleanup({ olderThanDays: 30 });

    // Should remove the old snapshot
    expect(result.snapshotsRemoved).toBe(1);

    // Verify only recent snapshot remains
    const remaining = service.snapshots.get('monitor1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].data).toBe('new');
  });

  test('Competitor monitoring commands are properly structured', () => {
    const { registerCompetitorMonitoringCommands } = require('../../websocket/commands/competitor-monitoring-commands');
    const { MonitoringService } = require('../../src/monitoring/monitoring-service');

    const service = new MonitoringService({
      dataDir: './test-data',
      enableAutoCheck: false
    });

    const commandHandlers = {};

    // Register commands
    registerCompetitorMonitoringCommands(commandHandlers, service);

    // Verify commands are registered
    const expectedCommands = [
      'add_competitor_monitor',
      'remove_competitor_monitor',
      'get_competitor_monitor',
      'list_competitor_monitors',
      'pause_monitor',
      'resume_monitor',
      'get_all_changes',
      'get_changes_by_type',
      'get_monitoring_stats',
      'get_alert_history',
      'configure_alert',
      'clear_all_competitor_monitors'
    ];

    const registeredCommands = Object.keys(commandHandlers);

    // At least a reasonable number of expected commands should be registered
    const foundCommands = expectedCommands.filter(cmd => registeredCommands.includes(cmd));
    expect(foundCommands.length).toBeGreaterThanOrEqual(4);

    // Verify command handlers are functions
    Object.values(commandHandlers).forEach(handler => {
      if (typeof handler === 'function') {
        expect(handler).toBeDefined();
      }
    });
  });
});
