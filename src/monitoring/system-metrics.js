/**
 * System Metrics Collector for Basset Hound Browser
 *
 * Collects and manages system-level metrics:
 * - CPU usage and utilization
 * - Memory consumption (heap, RSS, external)
 * - Disk I/O and available space
 * - Network I/O and connection counts
 * - Process-level metrics
 * - Operating system metrics
 *
 * @module src/monitoring/system-metrics
 * @requires os
 * @requires fs
 * @requires events
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * System Metrics Collector
 * Tracks system-level performance and resource metrics
 */
class SystemMetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      collectionInterval: options.collectionInterval || 30000, // 30 seconds
      enableDiskMetrics: options.enableDiskMetrics !== false,
      enableNetworkMetrics: options.enableNetworkMetrics !== false,
      enableProcessMetrics: options.enableProcessMetrics !== false,
      dataDir: options.dataDir || process.cwd(),
      ...options
    };

    // Current metrics
    this.metrics = {
      cpu: {},
      memory: {},
      disk: {},
      network: {},
      process: {},
      uptime: 0
    };

    // Historical data for calculations
    this.history = {
      cpu: [],
      memory: [],
      disk: [],
      network: []
    };

    this.lastMeasurement = {
      cpu: null,
      network: null,
      timestamp: Date.now()
    };

    // Start collection
    this.collectionInterval = setInterval(() => this._collect(), this.options.collectionInterval);
    this._collect(); // Initial collection
  }

  /**
   * Collect all system metrics
   * @private
   */
  _collect() {
    const timestamp = Date.now();

    // CPU metrics
    this._collectCpuMetrics();

    // Memory metrics
    this._collectMemoryMetrics();

    // Process metrics
    if (this.options.enableProcessMetrics) {
      this._collectProcessMetrics();
    }

    // Disk metrics
    if (this.options.enableDiskMetrics) {
      this._collectDiskMetrics();
    }

    // Network metrics
    if (this.options.enableNetworkMetrics) {
      this._collectNetworkMetrics();
    }

    // Uptime
    this.metrics.uptime = process.uptime();

    // Emit collection event
    this.emit('metrics:collected', {
      timestamp,
      metrics: { ...this.metrics }
    });

    // Keep history limited
    this._pruneHistory();
  }

  /**
   * Collect CPU metrics
   * @private
   */
  _collectCpuMetrics() {
    const cpus = os.cpus();
    const now = Date.now();

    // Calculate CPU usage
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) => {
      return acc + Object.values(cpu.times).reduce((a, b) => a + b, 0);
    }, 0);

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    // Load average
    const loadAverage = os.loadavg();

    this.metrics.cpu = {
      usage: usage,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAverage: {
        '1m': loadAverage[0],
        '5m': loadAverage[1],
        '15m': loadAverage[2]
      }
    };

    // Track history
    this.history.cpu.push({
      timestamp: now,
      usage
    });
  }

  /**
   * Collect memory metrics
   * @private
   */
  _collectMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Process memory
    const memUsage = process.memoryUsage();

    this.metrics.memory = {
      system: {
        total: Math.round(totalMem / 1024 / 1024), // MB
        used: Math.round(usedMem / 1024 / 1024), // MB
        free: Math.round(freeMem / 1024 / 1024), // MB
        usagePercent: (usedMem / totalMem) * 100
      },
      process: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024) // MB
      }
    };

    // Track history
    this.history.memory.push({
      timestamp: Date.now(),
      heapUsed: this.metrics.memory.process.heapUsed,
      heapTotal: this.metrics.memory.process.heapTotal,
      rss: this.metrics.memory.process.rss
    });
  }

  /**
   * Collect process metrics
   * @private
   */
  _collectProcessMetrics() {
    const now = Date.now();

    // Get process stats
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.process = {
      pid: process.pid,
      uptime: uptime,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuUser: cpuUsage.user / 1000, // Convert to ms
      cpuSystem: cpuUsage.system / 1000, // Convert to ms
      cwd: process.cwd(),
      eventLoop: {
        active: 0, // Will be calculated from handles/requests
        pending: 0
      }
    };

    // Try to get handle/request info
    try {
      const activeHandles = process._getActiveHandles?.() || [];
      const activeRequests = process._getActiveRequests?.() || [];
      this.metrics.process.eventLoop.active = activeHandles.length + activeRequests.length;
      this.metrics.process.eventLoop.pending = activeRequests.length;
    } catch (e) {
      // Silently fail if internal APIs not available
    }
  }

  /**
   * Collect disk metrics
   * @private
   */
  _collectDiskMetrics() {
    try {
      // Get disk usage for data directory
      const dataDir = this.options.dataDir;

      if (fs.existsSync(dataDir)) {
        const stats = fs.statfsSync ? fs._statSync?.(dataDir) : null;

        if (stats) {
          this.metrics.disk = {
            path: dataDir,
            total: Math.round(stats.blocks * stats.blockSize / 1024 / 1024), // MB
            available: Math.round(stats.bavail * stats.blockSize / 1024 / 1024), // MB
            used: Math.round((stats.blocks - stats.bfree) * stats.blockSize / 1024 / 1024), // MB
            usagePercent: ((stats.blocks - stats.bfree) / stats.blocks) * 100
          };
        } else {
          // Fallback: just track directory size
          this.metrics.disk = {
            path: dataDir,
            directorySize: this._getDirectorySize(dataDir)
          };
        }
      }
    } catch (e) {
      this.emit('metric:error', {
        type: 'disk',
        error: e.message
      });
    }
  }

  /**
   * Get directory size in MB
   * @private
   */
  _getDirectorySize(dirPath) {
    try {
      let totalSize = 0;

      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              totalSize += walkDir(filePath);
            } else {
              totalSize += stats.size;
            }
          } catch (e) {
            // Skip inaccessible files
          }
        }

        return totalSize;
      };

      return Math.round(walkDir(dirPath) / 1024 / 1024); // MB
    } catch (e) {
      return 0;
    }
  }

  /**
   * Collect network metrics
   * @private
   */
  _collectNetworkMetrics() {
    try {
      const interfaces = os.networkInterfaces();
      const now = Date.now();

      let ipv4Count = 0;
      let ipv6Count = 0;

      for (const ifaceList of Object.values(interfaces)) {
        for (const iface of ifaceList) {
          if (iface.family === 'IPv4') {
            ipv4Count++;
          } else if (iface.family === 'IPv6') {
            ipv6Count++;
          }
        }
      }

      // Try to get network I/O stats from /proc/net/dev on Linux
      let networkIO = {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      };

      if (process.platform === 'linux') {
        try {
          const procNet = fs.readFileSync('/proc/net/dev', 'utf8');
          let bytesIn = 0;
          let bytesOut = 0;
          let packetsIn = 0;
          let packetsOut = 0;

          const lines = procNet.split('\n');
          for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const parts = line.trim().split(/\s+/);
            // Skip loopback
            if (parts[0].startsWith('lo:')) continue;

            bytesIn += parseInt(parts[1]) || 0;
            packetsIn += parseInt(parts[2]) || 0;
            bytesOut += parseInt(parts[9]) || 0;
            packetsOut += parseInt(parts[10]) || 0;
          }

          networkIO = {
            bytesIn: Math.round(bytesIn / 1024), // KB
            bytesOut: Math.round(bytesOut / 1024), // KB
            packetsIn,
            packetsOut
          };
        } catch (e) {
          // Silently fail if /proc not available
        }
      }

      this.metrics.network = {
        interfaces: Object.keys(interfaces).length,
        ipv4Addresses: ipv4Count,
        ipv6Addresses: ipv6Count,
        ...networkIO
      };

      // Track history
      this.history.network.push({
        timestamp: now,
        bytesIn: networkIO.bytesIn,
        bytesOut: networkIO.bytesOut
      });
    } catch (e) {
      this.emit('metric:error', {
        type: 'network',
        error: e.message
      });
    }
  }

  /**
   * Prune history to keep only recent data
   * @private
   */
  _pruneHistory() {
    const cutoff = Date.now() - 3600000; // Keep 1 hour

    for (const [key, history] of Object.entries(this.history)) {
      this.history[key] = history.filter(entry => entry.timestamp > cutoff);
    }
  }

  /**
   * Get all system metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get CPU metrics
   */
  getCpuMetrics() {
    return { ...this.metrics.cpu };
  }

  /**
   * Get memory metrics
   */
  getMemoryMetrics() {
    return JSON.parse(JSON.stringify(this.metrics.memory));
  }

  /**
   * Get disk metrics
   */
  getDiskMetrics() {
    return { ...this.metrics.disk };
  }

  /**
   * Get network metrics
   */
  getNetworkMetrics() {
    return { ...this.metrics.network };
  }

  /**
   * Get process metrics
   */
  getProcessMetrics() {
    return { ...this.metrics.process };
  }

  /**
   * Get historical data for a metric type
   */
  getHistory(type, lookbackSeconds = 3600) {
    const history = this.history[type] || [];
    const cutoff = Date.now() - (lookbackSeconds * 1000);

    return history.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    return {
      timestamp: Date.now(),
      uptime: this.metrics.uptime,
      cpu: {
        usage: this.metrics.cpu.usage,
        cores: this.metrics.cpu.cores,
        loadAverage: this.metrics.cpu.loadAverage
      },
      memory: {
        systemUsage: this.metrics.memory.system?.usagePercent || 0,
        heapUsed: this.metrics.memory.process?.heapUsed || 0,
        heapTotal: this.metrics.memory.process?.heapTotal || 0,
        rss: this.metrics.memory.process?.rss || 0
      },
      disk: {
        usagePercent: this.metrics.disk?.usagePercent || 0,
        available: this.metrics.disk?.available || 0
      },
      network: this.metrics.network ? {
        interfaces: this.metrics.network.interfaces,
        bytesIn: this.metrics.network.bytesIn,
        bytesOut: this.metrics.network.bytesOut
      } : {},
      process: this.metrics.process ? {
        eventLoopPending: this.metrics.process.eventLoop?.pending || 0,
        eventLoopActive: this.metrics.process.eventLoop?.active || 0
      } : {}
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusFormat() {
    let output = '';

    const metrics = {
      'system_cpu_usage_percent': this.metrics.cpu.usage,
      'system_cpu_cores': this.metrics.cpu.cores,
      'system_cpu_load_1m': this.metrics.cpu.loadAverage['1m'],
      'system_cpu_load_5m': this.metrics.cpu.loadAverage['5m'],
      'system_cpu_load_15m': this.metrics.cpu.loadAverage['15m'],
      'system_memory_total_mb': this.metrics.memory.system.total,
      'system_memory_used_mb': this.metrics.memory.system.used,
      'system_memory_free_mb': this.metrics.memory.system.free,
      'system_memory_usage_percent': this.metrics.memory.system.usagePercent,
      'process_memory_heap_used_mb': this.metrics.memory.process.heapUsed,
      'process_memory_heap_total_mb': this.metrics.memory.process.heapTotal,
      'process_memory_rss_mb': this.metrics.memory.process.rss,
      'process_memory_external_mb': this.metrics.memory.process.external,
      'process_uptime_seconds': this.metrics.uptime
    };

    // Add disk metrics if available
    if (this.metrics.disk) {
      metrics['system_disk_total_mb'] = this.metrics.disk.total;
      metrics['system_disk_used_mb'] = this.metrics.disk.used;
      metrics['system_disk_available_mb'] = this.metrics.disk.available;
      metrics['system_disk_usage_percent'] = this.metrics.disk.usagePercent;
    }

    // Add network metrics if available
    if (this.metrics.network) {
      metrics['system_network_interfaces'] = this.metrics.network.interfaces;
      metrics['system_network_bytes_in_kb'] = this.metrics.network.bytesIn;
      metrics['system_network_bytes_out_kb'] = this.metrics.network.bytesOut;
    }

    for (const [name, value] of Object.entries(metrics)) {
      output += `${name} ${value}\n`;
    }

    return output;
  }

  /**
   * Check if system is under memory pressure
   */
  isMemoryPressure(thresholdPercent = 85) {
    return (this.metrics.memory.system.usagePercent >= thresholdPercent);
  }

  /**
   * Check if CPU usage is high
   */
  isHighCpuUsage(thresholdPercent = 80) {
    return (this.metrics.cpu.usage >= thresholdPercent);
  }

  /**
   * Check if disk usage is critical
   */
  isDiskCritical(thresholdPercent = 90) {
    return this.metrics.disk?.usagePercent >= thresholdPercent;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    this.removeAllListeners();
  }
}

module.exports = {
  SystemMetricsCollector
};
