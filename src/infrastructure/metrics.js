/**
 * Metrics Collection System
 *
 * Collects and exposes metrics in Prometheus format:
 * - HTTP request/response metrics
 * - Database query metrics
 * - Redis operation metrics
 * - System resource metrics
 */

const EventEmitter = require('events');

class MetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      windowSize: config.windowSize || 300000, // 5 minutes
      ...config
    };

    // Metrics storage
    this.metrics = {
      http: {
        requests: {
          total: 0,
          byMethod: {},
          byEndpoint: {},
          byStatusCode: {}
        },
        responses: {
          total: 0,
          latency: [],
          errors: 0
        }
      },
      database: {
        queries: {
          total: 0,
          byType: {},
          latency: [],
          errors: 0
        }
      },
      redis: {
        operations: {
          total: 0,
          byCommand: {},
          latency: [],
          errors: 0
        }
      },
      system: {
        memory: {
          current: 0,
          peak: 0,
          average: 0
        },
        cpu: {
          usage: 0,
          average: 0
        }
      }
    };

    // Time-based windows for rate calculations
    this.windows = new Map();
    this.startTime = Date.now();
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method, endpoint) {
    this.metrics.http.requests.total++;

    if (!this.metrics.http.requests.byMethod[method]) {
      this.metrics.http.requests.byMethod[method] = 0;
    }
    this.metrics.http.requests.byMethod[method]++;

    if (!this.metrics.http.requests.byEndpoint[endpoint]) {
      this.metrics.http.requests.byEndpoint[endpoint] = 0;
    }
    this.metrics.http.requests.byEndpoint[endpoint]++;
  }

  /**
   * Record HTTP response
   */
  recordHttpResponse(statusCode, latencyMs) {
    this.metrics.http.responses.total++;

    if (!this.metrics.http.requests.byStatusCode[statusCode]) {
      this.metrics.http.requests.byStatusCode[statusCode] = 0;
    }
    this.metrics.http.requests.byStatusCode[statusCode]++;

    this.metrics.http.responses.latency.push(latencyMs);

    // Keep only last 1000 samples
    if (this.metrics.http.responses.latency.length > 1000) {
      this.metrics.http.responses.latency.shift();
    }

    if (statusCode >= 500) {
      this.metrics.http.responses.errors++;
    }
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(queryType, latencyMs, error = false) {
    this.metrics.database.queries.total++;

    if (!this.metrics.database.queries.byType[queryType]) {
      this.metrics.database.queries.byType[queryType] = 0;
    }
    this.metrics.database.queries.byType[queryType]++;

    this.metrics.database.queries.latency.push(latencyMs);

    // Keep only last 1000 samples
    if (this.metrics.database.queries.latency.length > 1000) {
      this.metrics.database.queries.latency.shift();
    }

    if (error) {
      this.metrics.database.queries.errors++;
    }
  }

  /**
   * Record Redis operation
   */
  recordRedisOperation(command, latencyMs, error = false) {
    this.metrics.redis.operations.total++;

    if (!this.metrics.redis.operations.byCommand[command]) {
      this.metrics.redis.operations.byCommand[command] = 0;
    }
    this.metrics.redis.operations.byCommand[command]++;

    this.metrics.redis.operations.latency.push(latencyMs);

    // Keep only last 1000 samples
    if (this.metrics.redis.operations.latency.length > 1000) {
      this.metrics.redis.operations.latency.shift();
    }

    if (error) {
      this.metrics.redis.operations.errors++;
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(memoryUsage, cpuUsage) {
    this.metrics.system.memory.current = memoryUsage;

    if (memoryUsage > this.metrics.system.memory.peak) {
      this.metrics.system.memory.peak = memoryUsage;
    }

    this.metrics.system.cpu.usage = cpuUsage;
  }

  /**
   * Calculate percentiles from an array of values
   */
  calculatePercentiles(values, percentiles = [50, 90, 95, 99]) {
    if (values.length === 0) {
      return {};
    }

    const sorted = values.sort((a, b) => a - b);
    const result = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Get HTTP metrics in Prometheus format
   */
  getHttpMetrics() {
    const lines = [];

    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.metrics.http.requests.total}`);

    lines.push('# HELP http_requests_by_method HTTP requests by method');
    lines.push('# TYPE http_requests_by_method gauge');
    for (const [method, count] of Object.entries(this.metrics.http.requests.byMethod)) {
      lines.push(`http_requests_by_method{method="${method}"} ${count}`);
    }

    lines.push('# HELP http_requests_by_status HTTP requests by status code');
    lines.push('# TYPE http_requests_by_status gauge');
    for (const [status, count] of Object.entries(this.metrics.http.requests.byStatusCode)) {
      lines.push(`http_requests_by_status{status="${status}"} ${count}`);
    }

    const latencyPercentiles = this.calculatePercentiles(this.metrics.http.responses.latency);
    lines.push('# HELP http_response_latency_ms HTTP response latency percentiles');
    lines.push('# TYPE http_response_latency_ms gauge');
    for (const [percentile, value] of Object.entries(latencyPercentiles)) {
      lines.push(`http_response_latency_ms{percentile="${percentile}"} ${value}`);
    }

    lines.push('# HELP http_response_errors_total HTTP response errors');
    lines.push('# TYPE http_response_errors_total counter');
    lines.push(`http_response_errors_total ${this.metrics.http.responses.errors}`);

    return lines.join('\n');
  }

  /**
   * Get database metrics in Prometheus format
   */
  getDatabaseMetrics() {
    const lines = [];

    lines.push('# HELP db_queries_total Total database queries');
    lines.push('# TYPE db_queries_total counter');
    lines.push(`db_queries_total ${this.metrics.database.queries.total}`);

    lines.push('# HELP db_queries_by_type Database queries by type');
    lines.push('# TYPE db_queries_by_type gauge');
    for (const [type, count] of Object.entries(this.metrics.database.queries.byType)) {
      lines.push(`db_queries_by_type{type="${type}"} ${count}`);
    }

    const latencyPercentiles = this.calculatePercentiles(this.metrics.database.queries.latency);
    lines.push('# HELP db_query_latency_ms Database query latency percentiles');
    lines.push('# TYPE db_query_latency_ms gauge');
    for (const [percentile, value] of Object.entries(latencyPercentiles)) {
      lines.push(`db_query_latency_ms{percentile="${percentile}"} ${value}`);
    }

    lines.push('# HELP db_query_errors_total Database query errors');
    lines.push('# TYPE db_query_errors_total counter');
    lines.push(`db_query_errors_total ${this.metrics.database.queries.errors}`);

    return lines.join('\n');
  }

  /**
   * Get Redis metrics in Prometheus format
   */
  getRedisMetrics() {
    const lines = [];

    lines.push('# HELP redis_operations_total Total Redis operations');
    lines.push('# TYPE redis_operations_total counter');
    lines.push(`redis_operations_total ${this.metrics.redis.operations.total}`);

    lines.push('# HELP redis_operations_by_command Redis operations by command');
    lines.push('# TYPE redis_operations_by_command gauge');
    for (const [command, count] of Object.entries(this.metrics.redis.operations.byCommand)) {
      lines.push(`redis_operations_by_command{command="${command}"} ${count}`);
    }

    const latencyPercentiles = this.calculatePercentiles(this.metrics.redis.operations.latency);
    lines.push('# HELP redis_operation_latency_ms Redis operation latency percentiles');
    lines.push('# TYPE redis_operation_latency_ms gauge');
    for (const [percentile, value] of Object.entries(latencyPercentiles)) {
      lines.push(`redis_operation_latency_ms{percentile="${percentile}"} ${value}`);
    }

    lines.push('# HELP redis_operation_errors_total Redis operation errors');
    lines.push('# TYPE redis_operation_errors_total counter');
    lines.push(`redis_operation_errors_total ${this.metrics.redis.operations.errors}`);

    return lines.join('\n');
  }

  /**
   * Get system metrics in Prometheus format
   */
  getSystemMetrics() {
    const lines = [];

    lines.push('# HELP system_memory_current_bytes Current memory usage');
    lines.push('# TYPE system_memory_current_bytes gauge');
    lines.push(`system_memory_current_bytes ${this.metrics.system.memory.current}`);

    lines.push('# HELP system_memory_peak_bytes Peak memory usage');
    lines.push('# TYPE system_memory_peak_bytes gauge');
    lines.push(`system_memory_peak_bytes ${this.metrics.system.memory.peak}`);

    lines.push('# HELP system_cpu_usage Current CPU usage');
    lines.push('# TYPE system_cpu_usage gauge');
    lines.push(`system_cpu_usage ${this.metrics.system.cpu.usage}`);

    lines.push('# HELP process_uptime_seconds Process uptime');
    lines.push('# TYPE process_uptime_seconds gauge');
    const uptime = (Date.now() - this.startTime) / 1000;
    lines.push(`process_uptime_seconds ${uptime.toFixed(2)}`);

    return lines.join('\n');
  }

  /**
   * Get all metrics in Prometheus format
   */
  getAllMetrics() {
    const sections = [
      this.getHttpMetrics(),
      this.getDatabaseMetrics(),
      this.getRedisMetrics(),
      this.getSystemMetrics()
    ];

    return sections.join('\n\n');
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      http: {
        totalRequests: this.metrics.http.requests.total,
        totalResponses: this.metrics.http.responses.total,
        errors: this.metrics.http.responses.errors,
        avgLatency: this.metrics.http.responses.latency.length > 0
          ? (this.metrics.http.responses.latency.reduce((a, b) => a + b) / this.metrics.http.responses.latency.length).toFixed(2)
          : 0
      },
      database: {
        totalQueries: this.metrics.database.queries.total,
        errors: this.metrics.database.queries.errors,
        avgLatency: this.metrics.database.queries.latency.length > 0
          ? (this.metrics.database.queries.latency.reduce((a, b) => a + b) / this.metrics.database.queries.latency.length).toFixed(2)
          : 0
      },
      redis: {
        totalOperations: this.metrics.redis.operations.total,
        errors: this.metrics.redis.operations.errors,
        avgLatency: this.metrics.redis.operations.latency.length > 0
          ? (this.metrics.redis.operations.latency.reduce((a, b) => a + b) / this.metrics.redis.operations.latency.length).toFixed(2)
          : 0
      },
      system: {
        currentMemory: this.metrics.system.memory.current,
        peakMemory: this.metrics.system.memory.peak,
        cpuUsage: this.metrics.system.cpu.usage,
        uptime: ((Date.now() - this.startTime) / 1000).toFixed(2)
      }
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      http: {
        requests: {
          total: 0,
          byMethod: {},
          byEndpoint: {},
          byStatusCode: {}
        },
        responses: {
          total: 0,
          latency: [],
          errors: 0
        }
      },
      database: {
        queries: {
          total: 0,
          byType: {},
          latency: [],
          errors: 0
        }
      },
      redis: {
        operations: {
          total: 0,
          byCommand: {},
          latency: [],
          errors: 0
        }
      },
      system: {
        memory: {
          current: 0,
          peak: 0,
          average: 0
        },
        cpu: {
          usage: 0,
          average: 0
        }
      }
    };
  }
}

module.exports = MetricsCollector;
