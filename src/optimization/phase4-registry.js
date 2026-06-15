/**
 * Phase 4 Optimization Registry
 *
 * Central registry for all Phase 4 performance optimizations.
 * Provides unified access to all modules and enables coordinated initialization.
 *
 * @module src/optimization/phase4-registry
 */

const { MessageBatchingV2 } = require('./message-batching-v2');
const { CommandParsingOptimizer } = require('./command-parsing-optimizer');
const { CompressionTuningV2 } = require('./compression-tuning-v2');
const {
  MemoryManagerV2,
  ObjectPoolV2,
  BufferPoolV2,
  MemoryEfficientStructures
} = require('./memory-optimization-v2');
const { CacheEfficiencyV2, CacheCoordinator } = require('./cache-efficiency-v2');

/**
 * Phase 4 Registry
 *
 * Manages all optimization modules and provides coordinated access.
 */
class Phase4Registry {
  constructor(options = {}) {
    this.options = {
      enableBatching: options.enableBatching !== false,
      enableParsing: options.enableParsing !== false,
      enableCompression: options.enableCompression !== false,
      enableMemory: options.enableMemory !== false,
      enableCache: options.enableCache !== false,
      ...options
    };

    // Initialize modules
    this.modules = {};
    this._initializeModules();
  }

  /**
   * Initialize all optimization modules
   * @private
   */
  _initializeModules() {
    // Module 1: Message Batching
    if (this.options.enableBatching) {
      this.modules.batching = new MessageBatchingV2({
        batchWindow: this.options.batchWindow || 5,
        maxBatchSize: this.options.maxBatchSize || 10,
        parallelThreshold: this.options.parallelThreshold || 3
      });
    }

    // Module 2: Command Parsing
    if (this.options.enableParsing) {
      this.modules.parsing = new CommandParsingOptimizer({
        enableFastPath: this.options.enableFastPath !== false,
        enableMetadataCache: this.options.enableMetadataCache !== false,
        metadataTTL: this.options.metadataTTL || 60000
      });
    }

    // Module 3: Compression Tuning
    if (this.options.enableCompression) {
      this.modules.compression = new CompressionTuningV2({
        smallPayloadThreshold: this.options.smallPayloadThreshold || 500,
        mediumPayloadThreshold: this.options.mediumPayloadThreshold || 5000,
        largePayloadThreshold: this.options.largePayloadThreshold || 50000,
        enableAdaptiveLevel: this.options.enableAdaptiveLevel !== false
      });
    }

    // Module 4: Memory Optimization
    if (this.options.enableMemory) {
      this.modules.memory = new MemoryManagerV2({
        commandPoolSize: this.options.commandPoolSize || 100,
        responsePoolSize: this.options.responsePoolSize || 100,
        gcInterval: this.options.gcInterval || 30000
      });
    }

    // Module 5: Cache Efficiency
    if (this.options.enableCache) {
      this.modules.cache = new CacheCoordinator({
        initialCapacity: this.options.cacheCapacity || 1024
      });
    }
  }

  /**
   * Get specific optimization module
   */
  getModule(moduleName) {
    return this.modules[moduleName];
  }

  /**
   * Get all enabled modules
   */
  getModules() {
    return this.modules;
  }

  /**
   * Register command handler for batching
   */
  registerCommandHandler(commandName, handler) {
    if (this.modules.batching) {
      this.modules.batching.registerHandler(commandName, handler);
    }
  }

  /**
   * Register command metadata for parsing
   */
  registerCommandMetadata(commandName, handler, metadata) {
    if (this.modules.parsing) {
      this.modules.parsing.registerCommand(commandName, handler, metadata);
    }
  }

  /**
   * Get aggregated metrics from all modules
   */
  getAllMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      modules: {}
    };

    for (const [name, module] of Object.entries(this.modules)) {
      if (typeof module.getMetrics === 'function') {
        metrics.modules[name] = module.getMetrics();
      }
    }

    return metrics;
  }

  /**
   * Reset metrics in all modules
   */
  resetAllMetrics() {
    for (const module of Object.values(this.modules)) {
      if (typeof module.resetMetrics === 'function') {
        module.resetMetrics();
      }
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      batching: null,
      parsing: null,
      compression: null,
      memory: null,
      cache: null
    };

    if (this.modules.batching) {
      const metrics = this.modules.batching.getMetrics();
      summary.batching = {
        totalCommands: metrics.totalCommands,
        averageBatchSize: metrics.averageBatchSize.toFixed(2),
        p99Latency: `${metrics.p99Latency.toFixed(3)}ms`,
        parallelBatches: metrics.parallelBatches
      };
    }

    if (this.modules.parsing) {
      const metrics = this.modules.parsing.getMetrics();
      summary.parsing = {
        totalParsed: metrics.totalParsed,
        fastPathHits: metrics.fastPathHits,
        cacheHitRate: metrics.cacheHitRate,
        averageParseTime: `${metrics.averageParseTime.toFixed(3)}ms`
      };
    }

    if (this.modules.compression) {
      const metrics = this.modules.compression.getMetrics();
      summary.compression = {
        totalPayloads: metrics.totalPayloads,
        compressionRatio: metrics.compressionRatio,
        averageCompressionTime: metrics.averageCompressionTime,
        brotliAvailable: metrics.brotliAvailable
      };
    }

    if (this.modules.memory) {
      const metrics = this.modules.memory.getMetrics();
      summary.memory = {
        commandPoolInUse: metrics.commandPool.inUse,
        bufferPoolSize: metrics.bufferPool,
        heapUsed: metrics.memory.heapUsed
      };
    }

    if (this.modules.cache) {
      const metrics = this.modules.cache.getMetrics();
      summary.cache = {
        totalHitRate: metrics.aggregate.totalHitRate,
        totalSize: metrics.aggregate.totalSize || 0,
        commandCacheSize: metrics.caches.command?.size || 0
      };
    }

    return summary;
  }

  /**
   * Health check - verify all modules are functioning
   */
  healthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      healthy: true,
      modules: {}
    };

    try {
      if (this.modules.batching) {
        health.modules.batching = {
          status: 'OK',
          pending: this.modules.batching.queue.length
        };
      }

      if (this.modules.parsing) {
        health.modules.parsing = {
          status: 'OK',
          registered: this.modules.parsing.metadataMap.size
        };
      }

      if (this.modules.compression) {
        health.modules.compression = {
          status: 'OK',
          brotli: this.modules.compression.brotliAvailable ? 'available' : 'unavailable'
        };
      }

      if (this.modules.memory) {
        const memUsage = process.memoryUsage();
        health.modules.memory = {
          status: 'OK',
          heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2)
        };
      }

      if (this.modules.cache) {
        health.modules.cache = {
          status: 'OK',
          totalCaches: this.modules.cache.caches.size
        };
      }
    } catch (error) {
      health.healthy = false;
      health.error = error.message;
    }

    return health;
  }
}

/**
 * Singleton instance of Phase 4 Registry
 */
let phase4Registry = null;

/**
 * Initialize and get Phase 4 Registry
 */
function getPhase4Registry(options = {}) {
  if (!phase4Registry) {
    phase4Registry = new Phase4Registry(options);
  }
  return phase4Registry;
}

/**
 * Reset singleton instance
 */
function resetPhase4Registry() {
  phase4Registry = null;
}

module.exports = {
  Phase4Registry,
  getPhase4Registry,
  resetPhase4Registry,
  phase4Registry: () => getPhase4Registry()
};
