/**
 * Prometheus Metrics Exporter
 *
 * Exposes collected metrics in Prometheus exposition format
 * Provides /metrics endpoint for Prometheus scraping
 * Supports custom histogram buckets and metric aggregation
 *
 * @module src/monitoring/prometheus-exporter
 * @requires express
 * @requires http
 */

const EventEmitter = require('events');

/**
 * Prometheus Exporter
 * Exposes metrics in Prometheus format
 */
class PrometheusExporter extends EventEmitter {
  constructor(appMetrics, systemMetrics, options = {}) {
    super();

    this.appMetrics = appMetrics;
    this.systemMetrics = systemMetrics;

    this.options = {
      port: options.port || 9090,
      path: options.path || '/metrics',
      hostname: options.hostname || 'localhost',
      includeSystemMetrics: options.includeSystemMetrics !== false,
      includeAppMetrics: options.includeAppMetrics !== false,
      enableHttpServer: options.enableHttpServer !== false,
      ...options
    };

    this.httpServer = null;
    this.isRunning = false;

    // Start HTTP server if enabled
    if (this.options.enableHttpServer) {
      this._initializeHttpServer();
    }
  }

  /**
   * Initialize HTTP server for metrics endpoint
   * @private
   */
  _initializeHttpServer() {
    try {
      const http = require('http');

      this.httpServer = http.createServer((req, res) => {
        if (req.url === this.options.path) {
          res.writeHead(200, {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
          });
          res.end(this.export());
        } else if (req.url === '/health') {
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({
            status: 'up',
            timestamp: Date.now()
          }));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.httpServer.listen(this.options.port, this.options.hostname, () => {
        this.isRunning = true;
        this.emit('exporter:started', {
          url: `http://${this.options.hostname}:${this.options.port}${this.options.path}`,
          timestamp: Date.now()
        });
      });

      this.httpServer.on('error', (err) => {
        this.emit('exporter:error', {
          error: err.message,
          timestamp: Date.now()
        });
      });
    } catch (e) {
      this.emit('exporter:error', {
        error: e.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  export() {
    let output = this._getHeader();

    // Include app metrics
    if (this.options.includeAppMetrics && this.appMetrics) {
      output += this._formatAppMetrics();
    }

    // Include system metrics
    if (this.options.includeSystemMetrics && this.systemMetrics) {
      output += this._formatSystemMetrics();
    }

    return output;
  }

  /**
   * Get Prometheus header with metadata
   * @private
   */
  _getHeader() {
    return `# HELP basset_hound_metrics Basset Hound Browser metrics
# TYPE basset_hound_metrics untyped
# Exported at ${new Date().toISOString()}

`;
  }

  /**
   * Format application metrics
   * @private
   */
  _formatAppMetrics() {
    let output = '# ===== APPLICATION METRICS =====\n\n';

    const metrics = this.appMetrics.getAllMetrics();

    for (const [name, metric] of Object.entries(metrics)) {
      if (!metric) continue;

      // HELP and TYPE
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      if (metric.type === 'histogram') {
        // Histogram format
        for (const [bucket, count] of Object.entries(metric.buckets || {})) {
          output += `${name}_bucket{le="${bucket}"} ${count}\n`;
        }
        output += `${name}_sum ${metric.sum || 0}\n`;
        output += `${name}_count ${metric.count || 0}\n`;
      } else {
        // Counter/Gauge format
        output += `${name} ${metric.value || 0}\n`;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Format system metrics
   * @private
   */
  _formatSystemMetrics() {
    let output = '# ===== SYSTEM METRICS =====\n\n';

    const systemMetrics = this.systemMetrics.getMetrics();

    // CPU Metrics
    output += `# HELP system_cpu_usage_percent CPU usage percentage (0-100)\n`;
    output += `# TYPE system_cpu_usage_percent gauge\n`;
    output += `system_cpu_usage_percent ${systemMetrics.cpu.usage || 0}\n\n`;

    output += `# HELP system_cpu_cores Number of CPU cores\n`;
    output += `# TYPE system_cpu_cores gauge\n`;
    output += `system_cpu_cores ${systemMetrics.cpu.cores || 0}\n\n`;

    output += `# HELP system_cpu_load_1m CPU load average over 1 minute\n`;
    output += `# TYPE system_cpu_load_1m gauge\n`;
    output += `system_cpu_load_1m ${systemMetrics.cpu.loadAverage?.['1m'] || 0}\n\n`;

    output += `# HELP system_cpu_load_5m CPU load average over 5 minutes\n`;
    output += `# TYPE system_cpu_load_5m gauge\n`;
    output += `system_cpu_load_5m ${systemMetrics.cpu.loadAverage?.['5m'] || 0}\n\n`;

    output += `# HELP system_cpu_load_15m CPU load average over 15 minutes\n`;
    output += `# TYPE system_cpu_load_15m gauge\n`;
    output += `system_cpu_load_15m ${systemMetrics.cpu.loadAverage?.['15m'] || 0}\n\n`;

    // Memory Metrics
    output += `# HELP system_memory_total_mb Total system memory in MB\n`;
    output += `# TYPE system_memory_total_mb gauge\n`;
    output += `system_memory_total_mb ${systemMetrics.memory.system.total || 0}\n\n`;

    output += `# HELP system_memory_used_mb Used system memory in MB\n`;
    output += `# TYPE system_memory_used_mb gauge\n`;
    output += `system_memory_used_mb ${systemMetrics.memory.system.used || 0}\n\n`;

    output += `# HELP system_memory_free_mb Free system memory in MB\n`;
    output += `# TYPE system_memory_free_mb gauge\n`;
    output += `system_memory_free_mb ${systemMetrics.memory.system.free || 0}\n\n`;

    output += `# HELP system_memory_usage_percent System memory usage percentage\n`;
    output += `# TYPE system_memory_usage_percent gauge\n`;
    output += `system_memory_usage_percent ${systemMetrics.memory.system.usagePercent || 0}\n\n`;

    // Process Memory Metrics
    output += `# HELP process_memory_heap_used_mb Heap memory used by process in MB\n`;
    output += `# TYPE process_memory_heap_used_mb gauge\n`;
    output += `process_memory_heap_used_mb ${systemMetrics.memory.process.heapUsed || 0}\n\n`;

    output += `# HELP process_memory_heap_total_mb Total heap memory available in MB\n`;
    output += `# TYPE process_memory_heap_total_mb gauge\n`;
    output += `process_memory_heap_total_mb ${systemMetrics.memory.process.heapTotal || 0}\n\n`;

    output += `# HELP process_memory_rss_mb Resident set size in MB\n`;
    output += `# TYPE process_memory_rss_mb gauge\n`;
    output += `process_memory_rss_mb ${systemMetrics.memory.process.rss || 0}\n\n`;

    output += `# HELP process_memory_external_mb External memory in MB\n`;
    output += `# TYPE process_memory_external_mb gauge\n`;
    output += `process_memory_external_mb ${systemMetrics.memory.process.external || 0}\n\n`;

    // Disk Metrics
    if (systemMetrics.disk) {
      output += `# HELP system_disk_total_mb Total disk space in MB\n`;
      output += `# TYPE system_disk_total_mb gauge\n`;
      output += `system_disk_total_mb ${systemMetrics.disk.total || 0}\n\n`;

      output += `# HELP system_disk_used_mb Used disk space in MB\n`;
      output += `# TYPE system_disk_used_mb gauge\n`;
      output += `system_disk_used_mb ${systemMetrics.disk.used || 0}\n\n`;

      output += `# HELP system_disk_available_mb Available disk space in MB\n`;
      output += `# TYPE system_disk_available_mb gauge\n`;
      output += `system_disk_available_mb ${systemMetrics.disk.available || 0}\n\n`;

      output += `# HELP system_disk_usage_percent Disk usage percentage\n`;
      output += `# TYPE system_disk_usage_percent gauge\n`;
      output += `system_disk_usage_percent ${systemMetrics.disk.usagePercent || 0}\n\n`;
    }

    // Network Metrics
    if (systemMetrics.network) {
      output += `# HELP system_network_interfaces Number of network interfaces\n`;
      output += `# TYPE system_network_interfaces gauge\n`;
      output += `system_network_interfaces ${systemMetrics.network.interfaces || 0}\n\n`;

      output += `# HELP system_network_bytes_in_kb Network bytes in (KB)\n`;
      output += `# TYPE system_network_bytes_in_kb gauge\n`;
      output += `system_network_bytes_in_kb ${systemMetrics.network.bytesIn || 0}\n\n`;

      output += `# HELP system_network_bytes_out_kb Network bytes out (KB)\n`;
      output += `# TYPE system_network_bytes_out_kb gauge\n`;
      output += `system_network_bytes_out_kb ${systemMetrics.network.bytesOut || 0}\n\n`;
    }

    // Process Metrics
    output += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE process_uptime_seconds gauge\n`;
    output += `process_uptime_seconds ${systemMetrics.uptime || 0}\n\n`;

    if (systemMetrics.process) {
      output += `# HELP process_event_loop_pending Pending event loop operations\n`;
      output += `# TYPE process_event_loop_pending gauge\n`;
      output += `process_event_loop_pending ${systemMetrics.process.eventLoop?.pending || 0}\n\n`;

      output += `# HELP process_event_loop_active Active event loop operations\n`;
      output += `# TYPE process_event_loop_active gauge\n`;
      output += `process_event_loop_active ${systemMetrics.process.eventLoop?.active || 0}\n\n`;
    }

    return output;
  }

  /**
   * Get metrics as JSON
   */
  exportJson() {
    return {
      timestamp: Date.now(),
      app: this.appMetrics ? this.appMetrics.getSummary() : null,
      system: this.systemMetrics ? this.systemMetrics.getSummary() : null
    };
  }

  /**
   * Get specific metric
   */
  getMetric(name) {
    if (this.appMetrics) {
      const metric = this.appMetrics.getMetric(name);
      if (metric) return metric;
    }

    return null;
  }

  /**
   * Get all metrics summary
   */
  getSummary() {
    return {
      timestamp: Date.now(),
      app: this.appMetrics ? this.appMetrics.getSummary() : null,
      system: this.systemMetrics ? this.systemMetrics.getSummary() : null,
      exporter: {
        running: this.isRunning,
        url: this.isRunning ?
          `http://${this.options.hostname}:${this.options.port}${this.options.path}` :
          null
      }
    };
  }

  /**
   * Start exporter (if not using built-in HTTP server)
   */
  start() {
    if (!this.isRunning && this.options.enableHttpServer) {
      this._initializeHttpServer();
    }
  }

  /**
   * Stop exporter
   */
  stop() {
    if (this.httpServer && this.isRunning) {
      this.httpServer.close(() => {
        this.isRunning = false;
        this.emit('exporter:stopped', { timestamp: Date.now() });
      });
    }
  }

  /**
   * Get health status
   */
  getHealth() {
    return {
      status: 'up',
      running: this.isRunning,
      timestamp: Date.now(),
      url: this.isRunning ?
        `http://${this.options.hostname}:${this.options.port}${this.options.path}` :
        null
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    this.removeAllListeners();
  }
}

module.exports = {
  PrometheusExporter
};
