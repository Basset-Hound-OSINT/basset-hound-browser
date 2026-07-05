/**
 * Prometheus Metrics Integration Tests
 * Tests the Prometheus metrics endpoint and metric collection
 */

const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Test utilities
const makeHttpRequest = (port, path, method = 'GET') => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
};

describe('Prometheus Metrics Integration', () => {
  let server;
  let port = 18765;

  beforeAll(async () => {
    // Skip if not in test environment
    if (process.env.SKIP_METRICS_TESTS === 'true') {
      console.log('Skipping Prometheus metrics tests');
      return;
    }

    // Create a minimal HTTP server with metrics endpoint
    const http = require('http');
    const { PrometheusMetricsCollector } = require('../websocket/metrics');

    const metricsCollector = new PrometheusMetricsCollector();

    server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(metricsCollector.getMetricsText());
      } else if (req.url === '/metrics.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metricsCollector.getMetricsJSON(), null, 2));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.metricsCollector = metricsCollector;

    return new Promise((resolve) => {
      server.listen(port, '127.0.0.1', resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      return new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  test('GET /metrics returns Prometheus format text', async () => {
    const response = await makeHttpRequest(port, '/metrics');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('basset_websocket_connections_active');
    expect(response.body).toContain('HELP');
    expect(response.body).toContain('TYPE');
  });

  test('GET /metrics.json returns JSON format metrics', async () => {
    const response = await makeHttpRequest(port, '/metrics.json');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const metrics = JSON.parse(response.body);
    expect(metrics).toHaveProperty('timestamp');
    expect(metrics).toHaveProperty('uptime');
    expect(metrics).toHaveProperty('connections');
    expect(metrics).toHaveProperty('process');
    expect(metrics).toHaveProperty('system');
  });

  test('Prometheus metrics include connection metrics', async () => {
    const metricsCollector = server.metricsCollector;

    // Record some connection events
    metricsCollector.recordConnectionOpened();
    metricsCollector.recordConnectionOpened();
    metricsCollector.recordConnectionClosed(5000);

    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_websocket_connections_active');
    expect(metricsText).toContain('basset_websocket_connections_total_created');
    expect(metricsText).toContain('basset_websocket_connections_total_closed');
  });

  test('Prometheus metrics include command execution metrics', async () => {
    const metricsCollector = server.metricsCollector;

    // Record some command executions
    metricsCollector.recordCommandExecution('navigate', 150, true);
    metricsCollector.recordCommandExecution('navigate', 200, true);
    metricsCollector.recordCommandExecution('click', 50, true);
    metricsCollector.recordCommandExecution('click', 45, false);

    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_command_executions_total');
    expect(metricsText).toContain('basset_command_duration_ms');
    expect(metricsText).toContain('basset_command_errors_total');
    expect(metricsText).toContain('navigate');
    expect(metricsText).toContain('click');
  });

  test('Prometheus metrics include frame metrics', async () => {
    const metricsCollector = server.metricsCollector;

    // Record some frame events
    metricsCollector.recordMessageReceived(1024);
    metricsCollector.recordMessageReceived(2048);
    metricsCollector.recordMessageSent(512);
    metricsCollector.recordMessageError();

    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_websocket_messages_sent_total');
    expect(metricsText).toContain('basset_websocket_messages_received_total');
    expect(metricsText).toContain('basset_websocket_bytes_sent_total');
    expect(metricsText).toContain('basset_websocket_bytes_received_total');
    expect(metricsText).toContain('basset_websocket_message_errors_total');
  });

  test('Prometheus metrics include rate limiter metrics', async () => {
    const metricsCollector = server.metricsCollector;

    // Record rate limit events
    metricsCollector.recordRateLimitEvent(false); // allowed
    metricsCollector.recordRateLimitEvent(false); // allowed
    metricsCollector.recordRateLimitEvent(true);  // limited
    metricsCollector.recordClientRateLimited();

    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_rate_limiter_requests_total');
    expect(metricsText).toContain('basset_rate_limiter_clients_limited_total');
  });

  test('Prometheus metrics include request size metrics', async () => {
    const metricsCollector = server.metricsCollector;

    // Record request size validations
    metricsCollector.recordRequestSizeValidation(1024, false);
    metricsCollector.recordRequestSizeValidation(2048, false);
    metricsCollector.recordRequestSizeValidation(10000, true); // violated

    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_request_size_validations_total');
    expect(metricsText).toContain('basset_request_size_violations_total');
    expect(metricsText).toContain('basset_request_size_bytes');
  });

  test('Prometheus metrics include process metrics', async () => {
    const metricsCollector = server.metricsCollector;
    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_process_uptime_seconds');
    expect(metricsText).toContain('basset_process_resident_memory_bytes');
    expect(metricsText).toContain('basset_process_heap_used_bytes');
    expect(metricsText).toContain('basset_process_heap_total_bytes');
  });

  test('Prometheus metrics include system metrics', async () => {
    const metricsCollector = server.metricsCollector;
    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_system_memory_total_bytes');
    expect(metricsText).toContain('basset_system_memory_free_bytes');
    expect(metricsText).toContain('basset_system_cpu_cores');
    expect(metricsText).toContain('basset_system_load_average');
  });

  test('Prometheus metrics include health metrics', async () => {
    const metricsCollector = server.metricsCollector;

    // Record heartbeat events
    metricsCollector.recordHeartbeat();
    metricsCollector.recordHeartbeat();
    metricsCollector.recordHeartbeatMissed();

    const metricsText = metricsCollector.getMetricsText();

    expect(metricsText).toContain('basset_health_heartbeats_missed_total');
    expect(metricsText).toContain('basset_health_last_heartbeat_ms_ago');
  });

  test('Metrics JSON includes all sections', async () => {
    const metricsCollector = server.metricsCollector;

    metricsCollector.recordConnectionOpened();
    metricsCollector.recordCommandExecution('test_command', 100, true);
    metricsCollector.recordMessageReceived(1024);
    metricsCollector.recordMessageSent(512);

    const metricsJSON = metricsCollector.getMetricsJSON();

    expect(metricsJSON.timestamp).toBeDefined();
    expect(metricsJSON.uptime).toBeDefined();
    expect(metricsJSON.connections).toBeDefined();
    expect(metricsJSON.commands).toBeDefined();
    expect(metricsJSON.commands.topCommands).toBeDefined();
    expect(metricsJSON.frames).toBeDefined();
    expect(metricsJSON.rateLimiter).toBeDefined();
    expect(metricsJSON.requestSize).toBeDefined();
    expect(metricsJSON.health).toBeDefined();
    expect(metricsJSON.process).toBeDefined();
    expect(metricsJSON.system).toBeDefined();
  });

  test('Metrics can be reset', async () => {
    const metricsCollector = server.metricsCollector;

    // Record some events
    metricsCollector.recordConnectionOpened();
    metricsCollector.recordMessageReceived(1024);

    // Verify they're recorded
    expect(metricsCollector.connectionMetrics.activeConnections).toBeGreaterThan(0);
    expect(metricsCollector.frameMetrics.messagesReceived).toBeGreaterThan(0);

    // Reset
    metricsCollector.reset();

    // Verify reset
    expect(metricsCollector.connectionMetrics.activeConnections).toBe(0);
    expect(metricsCollector.frameMetrics.messagesReceived).toBe(0);
  });

  test('Prometheus metrics are properly formatted', async () => {
    const response = await makeHttpRequest(port, '/metrics');
    const lines = response.body.split('\n');

    // Check for proper Prometheus format
    const metricLines = lines.filter(line =>
      !line.startsWith('#') &&
      line.trim().length > 0
    );

    // Each metric line should have format: name{labels} value
    for (const line of metricLines) {
      const match = line.match(/^[\w_]+(?:\{[^}]*\})?\s+[\d.e\-]+$/);
      expect(match).toBeTruthy();
    }
  });

  test('Command execution metrics include percentiles', async () => {
    const metricsCollector = server.metricsCollector;

    // Record multiple command executions
    for (let i = 0; i < 10; i++) {
      metricsCollector.recordCommandExecution('perf_test', 10 + i * 5, true);
    }

    const metricsText = metricsCollector.getMetricsText();

    // Should include quantile labels (avg, min, max, 0.95)
    expect(metricsText).toContain('quantile=');
  });

  test('Metrics HTTP endpoint returns correct status codes', async () => {
    const metricsResponse = await makeHttpRequest(port, '/metrics');
    expect(metricsResponse.statusCode).toBe(200);

    const metricsJsonResponse = await makeHttpRequest(port, '/metrics.json');
    expect(metricsJsonResponse.statusCode).toBe(200);
  });
});
