#!/usr/bin/env node

/**
 * Prometheus Metrics Integration Demo
 *
 * This script demonstrates the Prometheus metrics integration:
 * 1. Creates an HTTP server with /metrics endpoint
 * 2. Simulates WebSocket activity
 * 3. Shows metrics in both Prometheus and JSON formats
 * 4. Tests curl commands for Prometheus scraping
 */

const http = require('http');
const { PrometheusMetricsCollector } = require('../websocket/metrics');

const PORT = 9001;

// Create metrics collector
const metricsCollector = new PrometheusMetricsCollector();

// Create HTTP server with metrics endpoints
const server = http.createServer((req, res) => {
  try {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(metricsCollector.getMetricsText());
      return;
    }

    if (req.url === '/metrics.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metricsCollector.getMetricsJSON(), null, 2));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      availableEndpoints: [
        'GET /metrics (Prometheus format)',
        'GET /metrics.json (JSON format)'
      ]
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

// Function to simulate WebSocket activity
function simulateActivity() {
  console.log('\n📊 Simulating WebSocket Activity...\n');

  // Simulate connections
  console.log('  - Recording 5 client connections');
  for (let i = 0; i < 5; i++) {
    metricsCollector.recordConnectionOpened();
  }

  // Simulate some closures
  console.log('  - Closing 2 connections');
  metricsCollector.recordConnectionClosed(15000);
  metricsCollector.recordConnectionClosed(32000);

  // Simulate command execution
  console.log('  - Recording command executions');
  const commands = ['navigate', 'click', 'type', 'screenshot', 'extract', 'scroll'];
  for (const cmd of commands) {
    for (let i = 0; i < 3; i++) {
      const duration = Math.random() * 500 + 50;
      const success = Math.random() > 0.1; // 90% success rate
      metricsCollector.recordCommandExecution(cmd, duration, success);
    }
  }

  // Simulate messages
  console.log('  - Recording message traffic');
  for (let i = 0; i < 50; i++) {
    const size = Math.random() * 4096 + 256;
    metricsCollector.recordMessageReceived(size);

    const responseSize = Math.random() * 2048 + 128;
    metricsCollector.recordMessageSent(responseSize);
  }

  // Simulate rate limiting
  console.log('  - Recording rate limit events');
  for (let i = 0; i < 100; i++) {
    const rateLimited = Math.random() < 0.05; // 5% rate limited
    metricsCollector.recordRateLimitEvent(rateLimited);
    if (rateLimited) {
      metricsCollector.recordClientRateLimited();
    }
  }

  // Simulate request size validation
  console.log('  - Recording request size validations');
  for (let i = 0; i < 1000; i++) {
    const size = Math.random() * 100000;
    const violated = size > 50000;
    metricsCollector.recordRequestSizeValidation(size, violated);
  }

  // Simulate heartbeats
  console.log('  - Recording heartbeat events');
  for (let i = 0; i < 60; i++) {
    metricsCollector.recordHeartbeat();
  }

  console.log('\n✅ Simulation complete\n');
}

// Main execution
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n' + '='.repeat(70));
  console.log('  Prometheus Metrics Integration Demo');
  console.log('='.repeat(70));

  console.log(`\n📡 Server listening on http://localhost:${PORT}`);
  console.log('\n📍 Endpoints:');
  console.log(`   - Prometheus format: http://localhost:${PORT}/metrics`);
  console.log(`   - JSON format:       http://localhost:${PORT}/metrics.json`);

  // Simulate activity
  simulateActivity();

  // Display sample metrics
  console.log('\n' + '='.repeat(70));
  console.log('  Sample Prometheus Metrics Output (first 50 lines)');
  console.log('='.repeat(70) + '\n');

  const prometheusText = metricsCollector.getMetricsText();
  const lines = prometheusText.split('\n');
  lines.slice(0, 50).forEach(line => console.log(line));
  console.log('\n... (truncated for display)\n');

  // Display JSON metrics
  console.log('='.repeat(70));
  console.log('  Sample JSON Metrics Output');
  console.log('='.repeat(70) + '\n');

  const jsonMetrics = metricsCollector.getMetricsJSON();
  console.log(JSON.stringify({
    timestamp: jsonMetrics.timestamp,
    uptime: jsonMetrics.uptime,
    connections: jsonMetrics.connections,
    commands: {
      registry: jsonMetrics.commands.registry,
      topCommands: jsonMetrics.commands.topCommands.slice(0, 3)
    },
    frames: jsonMetrics.frames,
    rateLimiter: jsonMetrics.rateLimiter,
    requestSize: jsonMetrics.requestSize,
    health: jsonMetrics.health
  }, null, 2));

  console.log('\n='.repeat(70));
  console.log('  Testing Endpoints');
  console.log('='.repeat(70));

  // Test endpoints with curl examples
  console.log('\n🔍 You can test the endpoints with:');
  console.log(`\n   # Get Prometheus format metrics:`);
  console.log(`   curl http://localhost:${PORT}/metrics`);
  console.log(`\n   # Get JSON format metrics:`);
  console.log(`   curl http://localhost:${PORT}/metrics.json`);
  console.log(`\n   # Use with Prometheus scrape_configs:`);
  console.log(`   global:`);
  console.log(`     scrape_interval: 15s`);
  console.log(`\n   scrape_configs:`);
  console.log(`     - job_name: 'basset-hound'`);
  console.log(`       static_configs:`);
  console.log(`         - targets: ['localhost:${PORT}']`);

  console.log('\n\n✅ Integration working correctly!');
  console.log('\n⏱️  Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📍 Shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
