/**
 * Resource Tracking for Basset Hound Browser
 *
 * Provides:
 * - Memory usage per operation
 * - CPU time tracking
 * - Disk I/O metrics
 * - Resource allocation efficiency
 *
 * Features:
 * - Per-span resource metrics
 * - Resource trend analysis
 * - Allocation optimization detection
 * - Memory leak detection
 * - Resource efficiency scoring
 */

const EventEmitter = require('events');
const os = require('os');

class ResourceTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableMemoryTracking: options.enableMemoryTracking !== false,
      enableCPUTracking: options.enableCPUTracking !== false,
      enableDiskTracking: options.enableDiskTracking !== false,
      memoryThresholds: options.memoryThresholds || { warning: 100, critical: 250 }, // MB
      cpuThresholds: options.cpuThresholds || { warning: 80, critical: 95 }, // percentage
      diskThresholds: options.diskThresholds || { warning: 100, critical: 500 }, // MB
      historySize: options.historySize || 1000,
      ...options
    };

    this.spanResources = new Map();
    this.resourceMetrics = new Map();
    this.memoryHistory = [];
    this.cpuHistory = [];
    this.diskHistory = [];
    this.resourceTrends = new Map();
    this.memoryLeakSuspects = new Map();
    this.resourceAlerts = [];
  }

  /**
   * Track memory usage for span
   */
  trackMemory(spanId, memoryData) {
    const heapUsedBefore = process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB

    const memory = {
      spanId,
      heapUsedBefore: memoryData.heapUsedBefore || heapUsedBefore,
      heapUsedAfter: memoryData.heapUsedAfter || heapUsedBefore,
      heapTotalBefore: memoryData.heapTotalBefore || (process.memoryUsage().heapTotal / 1024 / 1024),
      heapTotalAfter: memoryData.heapTotalAfter || (process.memoryUsage().heapTotal / 1024 / 1024),
      externalMemory: memoryData.externalMemory || 0,
      arrayBuffers: memoryData.arrayBuffers || 0,
      memoryDelta: 0,
      allocations: memoryData.allocations || 0,
      deallocations: memoryData.deallocations || 0,
      netAllocations: 0,
      recordedAt: Date.now(),
      peakMemory: memoryData.peakMemory || heapUsedBefore,
      averageMemory: memoryData.averageMemory || heapUsedBefore,
      memoryEfficiency: 0,
      garbageCollections: memoryData.garbageCollections || 0,
      memoryLeakIndicators: []
    };

    // Calculate deltas
    memory.memoryDelta = memory.heapUsedAfter - memory.heapUsedBefore;
    memory.netAllocations = memory.allocations - memory.deallocations;
    memory.memoryEfficiency = this._calculateMemoryEfficiency(memory);

    // Check for memory leak indicators
    if (memory.memoryDelta > 0 && memory.garbageCollections === 0) {
      memory.memoryLeakIndicators.push('no_gc_after_allocation');
    }
    if (memory.netAllocations > 1000) {
      memory.memoryLeakIndicators.push('high_net_allocations');
    }
    if (memory.heapUsedAfter > memory.heapTotalAfter * 0.9) {
      memory.memoryLeakIndicators.push('heap_near_limit');
    }

    this._updateSpanResources(spanId, 'memory', memory);
    this._updateMemoryHistory(memory);

    // Check thresholds
    this._checkMemoryThreshold(memory);

    this.emit('memory:tracked', {
      spanId,
      heapUsed: memory.heapUsedAfter,
      delta: memory.memoryDelta,
      efficiency: memory.memoryEfficiency
    });

    return memory;
  }

  /**
   * Track CPU time for span
   */
  trackCPU(spanId, cpuData) {
    const cpu = {
      spanId,
      userCpuTime: cpuData.userCpuTime || 0,
      systemCpuTime: cpuData.systemCpuTime || 0,
      totalCpuTime: (cpuData.userCpuTime || 0) + (cpuData.systemCpuTime || 0),
      cpuUsagePercent: cpuData.cpuUsagePercent || 0,
      wallClockTime: cpuData.wallClockTime || 0,
      cpuEfficiency: 0, // CPU time / wall clock time
      threadCount: cpuData.threadCount || 0,
      recordedAt: Date.now(),
      cpuLoadAverage: os.loadavg() || [0, 0, 0],
      recordedCpuUsage: process.cpuUsage() || { user: 0, system: 0 }
    };

    if (cpu.wallClockTime > 0) {
      cpu.cpuEfficiency = (cpu.totalCpuTime / cpu.wallClockTime) * 100;
    }

    this._updateSpanResources(spanId, 'cpu', cpu);
    this._updateCPUHistory(cpu);

    // Check thresholds
    this._checkCPUThreshold(cpu);

    this.emit('cpu:tracked', {
      spanId,
      totalTime: cpu.totalCpuTime,
      efficiency: cpu.cpuEfficiency,
      loadAverage: cpu.cpuLoadAverage[0]
    });

    return cpu;
  }

  /**
   * Track disk I/O for span
   */
  trackDiskIO(spanId, ioData) {
    const diskIO = {
      spanId,
      bytesRead: ioData.bytesRead || 0,
      bytesWritten: ioData.bytesWritten || 0,
      totalBytesIO: (ioData.bytesRead || 0) + (ioData.bytesWritten || 0),
      readOperations: ioData.readOperations || 0,
      writeOperations: ioData.writeOperations || 0,
      totalOperations: (ioData.readOperations || 0) + (ioData.writeOperations || 0),
      readLatency: ioData.readLatency || 0, // ms
      writeLatency: ioData.writeLatency || 0, // ms
      averageLatency: 0,
      cacheHitRate: ioData.cacheHitRate || 0,
      iopsRate: 0, // Operations per second
      throughputMBps: 0, // MB per second
      duration: ioData.duration || 0, // ms
      recordedAt: Date.now(),
      fsync: ioData.fsync || 0,
      seek: ioData.seek || 0,
      ioEfficiency: 0
    };

    // Calculate metrics
    if (diskIO.totalOperations > 0) {
      diskIO.averageLatency = (diskIO.readLatency + diskIO.writeLatency) / diskIO.totalOperations;
    }

    if (diskIO.duration > 0) {
      diskIO.iopsRate = (diskIO.totalOperations / diskIO.duration) * 1000; // Convert to per second
      diskIO.throughputMBps = (diskIO.totalBytesIO / 1024 / 1024) / (diskIO.duration / 1000); // Convert to MB/s
    }

    if (diskIO.totalBytesIO > 0 && diskIO.cacheHitRate > 0) {
      diskIO.ioEfficiency = diskIO.cacheHitRate + ((1 - diskIO.cacheHitRate) * 0.2); // Partial credit for misses
    }

    this._updateSpanResources(spanId, 'diskIO', diskIO);
    this._updateDiskHistory(diskIO);

    // Check thresholds
    this._checkDiskThreshold(diskIO);

    this.emit('diskIO:tracked', {
      spanId,
      bytesIO: diskIO.totalBytesIO,
      operations: diskIO.totalOperations,
      efficiency: diskIO.ioEfficiency
    });

    return diskIO;
  }

  /**
   * Get complete resource profile for span
   */
  getResourceProfile(spanId) {
    const resources = this.spanResources.get(spanId) || {};

    return {
      spanId,
      memory: resources.memory || null,
      cpu: resources.cpu || null,
      diskIO: resources.diskIO || null,
      totalResourcesTracked: Object.keys(resources).length,
      overallEfficiency: this._calculateOverallEfficiency(resources),
      recommendedOptimizations: this._getOptimizations(resources)
    };
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks() {
    const allMemoryData = Array.from(this.spanResources.values())
      .map(r => r.memory)
      .filter(m => m !== undefined);

    const leakSuspects = [];
    const memoryIncreases = [];

    for (let i = 0; i < allMemoryData.length - 1; i++) {
      const current = allMemoryData[i];
      const next = allMemoryData[i + 1];

      if (current && next && next.heapUsedAfter > current.heapUsedAfter) {
        const increase = next.heapUsedAfter - current.heapUsedAfter;
        memoryIncreases.push({
          from: current.spanId,
          to: next.spanId,
          increase,
          timestamp: next.recordedAt
        });
      }
    }

    // Find patterns suggesting leaks
    const recentIncreases = memoryIncreases.slice(-20);
    if (recentIncreases.length > 10) {
      const avgIncrease = recentIncreases.reduce((sum, m) => sum + m.increase, 0) / recentIncreases.length;
      if (avgIncrease > 1) { // More than 1MB increase per operation
        leakSuspects.push({
          pattern: 'consistent_increase',
          averageIncrease: avgIncrease,
          samples: recentIncreases.length,
          severity: avgIncrease > 5 ? 'critical' : 'warning'
        });
      }
    }

    // Check for allocation without deallocation
    for (const [spanId, resources] of this.spanResources) {
      if (resources.memory && resources.memory.netAllocations > 100) {
        leakSuspects.push({
          spanId,
          pattern: 'net_positive_allocations',
          netAllocations: resources.memory.netAllocations,
          severity: 'warning'
        });
      }
    }

    this.memoryLeakSuspects = new Map(leakSuspects.map((s, i) => [i, s]));

    this.emit('memoryLeaks:detected', {
      suspectCount: leakSuspects.length,
      topSuspects: leakSuspects.slice(0, 5)
    });

    return leakSuspects;
  }

  /**
   * Get resource efficiency comparison
   */
  getEfficiencyComparison() {
    const spans = Array.from(this.spanResources.entries());
    const comparison = {
      spanCount: spans.length,
      spans: []
    };

    spans.forEach(([spanId, resources]) => {
      comparison.spans.push({
        spanId,
        memory: resources.memory ? {
          heapUsed: resources.memory.heapUsedAfter,
          efficiency: resources.memory.memoryEfficiency
        } : null,
        cpu: resources.cpu ? {
          totalTime: resources.cpu.totalCpuTime,
          efficiency: resources.cpu.cpuEfficiency
        } : null,
        diskIO: resources.diskIO ? {
          throughput: resources.diskIO.throughputMBps,
          efficiency: resources.diskIO.ioEfficiency
        } : null
      });
    });

    return comparison;
  }

  /**
   * Get resource trend analysis
   */
  getResourceTrend(timeWindowMs = 300000) {
    const now = Date.now();
    const startTime = now - timeWindowMs;

    const memoryTrend = this.memoryHistory
      .filter(m => m.recordedAt >= startTime)
      .map(m => m.heapUsedAfter);

    const cpuTrend = this.cpuHistory
      .filter(c => c.recordedAt >= startTime)
      .map(c => c.cpuUsagePercent);

    return {
      timeWindowMs,
      memory: {
        samples: memoryTrend.length,
        current: memoryTrend.length > 0 ? memoryTrend[memoryTrend.length - 1] : 0,
        min: memoryTrend.length > 0 ? Math.min(...memoryTrend) : 0,
        max: memoryTrend.length > 0 ? Math.max(...memoryTrend) : 0,
        avg: memoryTrend.length > 0 ? memoryTrend.reduce((a, b) => a + b, 0) / memoryTrend.length : 0,
        trend: this._calculateTrend(memoryTrend)
      },
      cpu: {
        samples: cpuTrend.length,
        current: cpuTrend.length > 0 ? cpuTrend[cpuTrend.length - 1] : 0,
        min: cpuTrend.length > 0 ? Math.min(...cpuTrend) : 0,
        max: cpuTrend.length > 0 ? Math.max(...cpuTrend) : 0,
        avg: cpuTrend.length > 0 ? cpuTrend.reduce((a, b) => a + b, 0) / cpuTrend.length : 0,
        trend: this._calculateTrend(cpuTrend)
      }
    };
  }

  /**
   * Update span resources tracking
   */
  _updateSpanResources(spanId, resourceType, data) {
    if (!this.spanResources.has(spanId)) {
      this.spanResources.set(spanId, {});
    }
    const resources = this.spanResources.get(spanId);
    resources[resourceType] = data;
  }

  /**
   * Update memory history
   */
  _updateMemoryHistory(memory) {
    this.memoryHistory.push(memory);
    if (this.memoryHistory.length > this.options.historySize) {
      this.memoryHistory.shift();
    }
  }

  /**
   * Update CPU history
   */
  _updateCPUHistory(cpu) {
    this.cpuHistory.push(cpu);
    if (this.cpuHistory.length > this.options.historySize) {
      this.cpuHistory.shift();
    }
  }

  /**
   * Update disk history
   */
  _updateDiskHistory(disk) {
    this.diskHistory.push(disk);
    if (this.diskHistory.length > this.options.historySize) {
      this.diskHistory.shift();
    }
  }

  /**
   * Check memory threshold
   */
  _checkMemoryThreshold(memory) {
    const thresholds = this.options.memoryThresholds;
    if (memory.heapUsedAfter > thresholds.critical) {
      this.resourceAlerts.push({
        type: 'memory_critical',
        spanId: memory.spanId,
        value: memory.heapUsedAfter,
        threshold: thresholds.critical,
        timestamp: Date.now()
      });
      this.emit('alert:memory_critical', memory);
    } else if (memory.heapUsedAfter > thresholds.warning) {
      this.emit('alert:memory_warning', memory);
    }
  }

  /**
   * Check CPU threshold
   */
  _checkCPUThreshold(cpu) {
    const thresholds = this.options.cpuThresholds;
    if (cpu.cpuUsagePercent > thresholds.critical) {
      this.resourceAlerts.push({
        type: 'cpu_critical',
        spanId: cpu.spanId,
        value: cpu.cpuUsagePercent,
        threshold: thresholds.critical,
        timestamp: Date.now()
      });
      this.emit('alert:cpu_critical', cpu);
    } else if (cpu.cpuUsagePercent > thresholds.warning) {
      this.emit('alert:cpu_warning', cpu);
    }
  }

  /**
   * Check disk threshold
   */
  _checkDiskThreshold(disk) {
    const thresholds = this.options.diskThresholds;
    const diskUsage = disk.totalBytesIO / 1024 / 1024; // Convert to MB

    if (diskUsage > thresholds.critical) {
      this.resourceAlerts.push({
        type: 'disk_critical',
        spanId: disk.spanId,
        value: diskUsage,
        threshold: thresholds.critical,
        timestamp: Date.now()
      });
      this.emit('alert:disk_critical', disk);
    } else if (diskUsage > thresholds.warning) {
      this.emit('alert:disk_warning', disk);
    }
  }

  /**
   * Calculate memory efficiency
   */
  _calculateMemoryEfficiency(memory) {
    if (memory.heapTotalAfter === 0) {
      return 0;
    }
    return (memory.heapUsedAfter / memory.heapTotalAfter) * 100;
  }

  /**
   * Calculate overall efficiency
   */
  _calculateOverallEfficiency(resources) {
    const efficiencyScores = [];

    if (resources.memory) {
      efficiencyScores.push(Math.max(0, 100 - resources.memory.memoryEfficiency));
    }
    if (resources.cpu) {
      efficiencyScores.push(resources.cpu.cpuEfficiency);
    }
    if (resources.diskIO) {
      efficiencyScores.push(resources.diskIO.ioEfficiency * 100);
    }

    if (efficiencyScores.length === 0) {
      return 0;
    }
    return efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length;
  }

  /**
   * Get optimizations
   */
  _getOptimizations(resources) {
    const optimizations = [];

    if (resources.memory && resources.memory.memoryEfficiency > 80) {
      optimizations.push('Consider memory pooling to reduce allocation overhead');
    }

    if (resources.cpu && resources.cpu.cpuEfficiency < 30) {
      optimizations.push('CPU efficiency is low; consider parallelization');
    }

    if (resources.diskIO && resources.diskIO.cacheHitRate < 0.5) {
      optimizations.push('Cache hit rate is low; consider caching strategies');
    }

    return optimizations;
  }

  /**
   * Calculate trend
   */
  _calculateTrend(values) {
    if (values.length < 2) {
      return 'insufficient_data';
    }
    const recent = values.slice(-5);
    const older = values.slice(0, Math.max(1, Math.floor(values.length / 2)));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 10) {
      return 'increasing';
    }
    if (change < -10) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Close system
   */
  close() {
    this.spanResources.clear();
    this.resourceMetrics.clear();
    this.memoryHistory = [];
    this.cpuHistory = [];
    this.diskHistory = [];
    this.resourceTrends.clear();
    this.memoryLeakSuspects.clear();
    this.resourceAlerts = [];
    this.emit('system:closed');
  }
}

module.exports = ResourceTracker;
