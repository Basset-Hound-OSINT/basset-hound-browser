/**
 * Trace Visualization for Basset Hound Browser
 *
 * Provides:
 * - Interactive trace tree visualization
 * - Timeline visualization
 * - Critical path analysis
 * - Trace-to-diagram conversion
 *
 * Features:
 * - Flamegraph-style visualization
 * - Trace waterfall charts
 * - Service dependency graphs
 * - Critical path highlighting
 * - Performance hotspot identification
 */

const EventEmitter = require('events');

class TraceVisualizer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableFlameGraph: options.enableFlameGraph !== false,
      enableWaterfall: options.enableWaterfall !== false,
      enableCriticalPath: options.enableCriticalPath !== false,
      maxDepth: options.maxDepth || 10,
      timelineGranularity: options.timelineGranularity || 1, // ms
      ...options
    };

    this.visualizations = new Map();
    this.traceGraphs = new Map();
    this.flamegraphs = new Map();
    this.waterfalls = new Map();
    this.criticalPaths = new Map();
  }

  /**
   * Generate trace tree visualization
   */
  generateTraceTree(traceId, traceData) {
    const tree = {
      traceId,
      rootSpans: [],
      spanMap: new Map(),
      spanHierarchy: new Map(),
      spanCount: 0,
      totalDuration: 0,
      startTime: Infinity,
      endTime: 0,
      depth: 0,
      services: new Set(),
      generatedAt: Date.now()
    };

    // Build span map and identify root spans
    for (const span of (traceData.spans || [])) {
      tree.spanMap.set(span.spanId, {
        id: span.spanId,
        name: span.spanName,
        duration: span.duration || 0,
        startTime: span.startTime || 0,
        endTime: span.endTime || 0,
        component: span.component || null,
        service: span.service || null,
        status: span.status || 'ok',
        tags: span.tags || {},
        children: [],
        parentId: span.parentSpanId || null,
        level: 0
      });

      tree.spanCount++;
      tree.totalDuration = Math.max(tree.totalDuration, span.duration || 0);
      tree.startTime = Math.min(tree.startTime, span.startTime || Infinity);
      tree.endTime = Math.max(tree.endTime, span.endTime || 0);

      if (span.service) {
        tree.services.add(span.service);
      }

      // Track as root if no parent
      if (!span.parentSpanId) {
        tree.rootSpans.push(span.spanId);
      }
    }

    // Build hierarchy
    for (const [spanId, spanNode] of tree.spanMap) {
      if (spanNode.parentId) {
        const parentNode = tree.spanMap.get(spanNode.parentId);
        if (parentNode) {
          parentNode.children.push(spanId);
          spanNode.level = parentNode.level + 1;
          tree.depth = Math.max(tree.depth, spanNode.level);
        }
      }
    }

    this.visualizations.set(traceId, tree);

    this.emit('tree:generated', {
      traceId,
      spanCount: tree.spanCount,
      depth: tree.depth,
      services: Array.from(tree.services)
    });

    return tree;
  }

  /**
   * Generate flamegraph representation
   */
  generateFlameGraph(traceId, traceData) {
    const tree = this.visualizations.get(traceId);
    if (!tree) {
      this.generateTraceTree(traceId, traceData);
    }

    const flamegraph = {
      traceId,
      stacks: [],
      totalTime: 0,
      maxDepth: 0,
      generatedAt: Date.now()
    };

    // Process each root span
    for (const rootSpanId of (tree.rootSpans || [])) {
      this._buildFlameGraphStack(rootSpanId, tree, [], flamegraph);
    }

    // Sort stacks by total time descending
    flamegraph.stacks.sort((a, b) => b.totalTime - a.totalTime);

    this.flamegraphs.set(traceId, flamegraph);

    this.emit('flamegraph:generated', {
      traceId,
      stackCount: flamegraph.stacks.length,
      totalTime: flamegraph.totalTime,
      maxDepth: flamegraph.maxDepth
    });

    return flamegraph;
  }

  /**
   * Generate waterfall chart representation
   */
  generateWaterfall(traceId, traceData) {
    const tree = this.visualizations.get(traceId);
    if (!tree) {
      this.generateTraceTree(traceId, traceData);
    }

    const waterfall = {
      traceId,
      timeline: [],
      spanBars: [],
      criticalPath: [],
      parallelRanges: [],
      generatedAt: Date.now()
    };

    const timelineStart = tree.startTime;

    // Create timeline entries for each span
    for (const [spanId, span] of tree.spanMap) {
      const relativeStart = (span.startTime - timelineStart);
      const duration = span.duration;

      waterfall.spanBars.push({
        spanId,
        spanName: span.name,
        startOffset: relativeStart,
        duration,
        endOffset: relativeStart + duration,
        level: span.level,
        service: span.service,
        status: span.status,
        color: this._getStatusColor(span.status)
      });
    }

    // Sort by start time
    waterfall.spanBars.sort((a, b) => a.startOffset - b.startOffset);

    // Find parallel ranges (spans that overlap)
    for (let i = 0; i < waterfall.spanBars.length; i++) {
      const current = waterfall.spanBars[i];
      const parallels = waterfall.spanBars.filter(s =>
        s !== current &&
        s.startOffset < current.endOffset &&
        s.endOffset > current.startOffset
      );

      if (parallels.length > 0) {
        waterfall.parallelRanges.push({
          spanId: current.spanId,
          parallelSpans: parallels.map(p => p.spanId),
          parallelCount: parallels.length
        });
      }
    }

    this.waterfalls.set(traceId, waterfall);

    this.emit('waterfall:generated', {
      traceId,
      spanCount: waterfall.spanBars.length,
      parallelCount: waterfall.parallelRanges.length
    });

    return waterfall;
  }

  /**
   * Analyze and visualize critical path
   */
  analyzeCriticalPath(traceId, traceData) {
    const tree = this.visualizations.get(traceId);
    if (!tree) {
      this.generateTraceTree(traceId, traceData);
    }

    const criticalPath = {
      traceId,
      path: [],
      spans: [],
      totalDuration: 0,
      spanCount: 0,
      potentialParallelization: [],
      generatedAt: Date.now()
    };

    // Find the longest path through the span tree
    for (const rootSpanId of (tree.rootSpans || [])) {
      const pathResult = this._findCriticalPath(rootSpanId, tree);
      if (pathResult.duration > criticalPath.totalDuration) {
        criticalPath.path = pathResult.path;
        criticalPath.spans = pathResult.spans;
        criticalPath.totalDuration = pathResult.duration;
      }
    }

    criticalPath.spanCount = criticalPath.spans.length;

    // Identify spans that could be parallelized
    for (const [spanId, span] of tree.spanMap) {
      if (!criticalPath.spans.includes(spanId) && span.children.length === 0) {
        criticalPath.potentialParallelization.push({
          spanId,
          spanName: span.name,
          duration: span.duration
        });
      }
    }

    this.criticalPaths.set(traceId, criticalPath);

    this.emit('criticalPath:analyzed', {
      traceId,
      pathLength: criticalPath.spanCount,
      totalDuration: criticalPath.totalDuration,
      parallelizationOpportunities: criticalPath.potentialParallelization.length
    });

    return criticalPath;
  }

  /**
   * Generate service dependency graph
   */
  generateServiceDependencyGraph(traces) {
    const graph = {
      nodes: new Map(),
      edges: new Map(),
      clusters: [],
      generatedAt: Date.now()
    };

    // Collect all services and their interactions
    const serviceInteractions = new Map();

    for (const traceId of (Array.isArray(traces) ? traces : [traces])) {
      const tree = this.visualizations.get(traceId);
      if (!tree) continue;

      for (const [spanId, span] of tree.spanMap) {
        if (span.service) {
          if (!graph.nodes.has(span.service)) {
            graph.nodes.set(span.service, {
              name: span.service,
              spanCount: 0,
              totalDuration: 0,
              status: 'healthy',
              errorCount: 0
            });
          }

          const node = graph.nodes.get(span.service);
          node.spanCount++;
          node.totalDuration += span.duration;

          if (span.status === 'error') {
            node.errorCount++;
          }

          // Track interactions (parent-child between services)
          if (span.parentId) {
            const parentSpan = tree.spanMap.get(span.parentId);
            if (parentSpan && parentSpan.service && parentSpan.service !== span.service) {
              const edgeKey = `${parentSpan.service}->${span.service}`;
              if (!serviceInteractions.has(edgeKey)) {
                serviceInteractions.set(edgeKey, { count: 0, avgLatency: 0, totalLatency: 0 });
              }

              const interaction = serviceInteractions.get(edgeKey);
              interaction.count++;
              interaction.totalLatency += span.duration || 0;
              interaction.avgLatency = interaction.totalLatency / interaction.count;
            }
          }
        }
      }
    }

    // Convert interactions to edges
    for (const [edgeKey, interaction] of serviceInteractions) {
      const [source, target] = edgeKey.split('->');
      graph.edges.set(edgeKey, {
        source,
        target,
        weight: interaction.count,
        avgLatency: interaction.avgLatency,
        interactions: interaction.count
      });
    }

    this.emit('dependencyGraph:generated', {
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.size
    });

    return graph;
  }

  /**
   * Get trace visualization export (JSON format)
   */
  exportVisualization(traceId, format = 'json') {
    const tree = this.visualizations.get(traceId);
    const waterfall = this.waterfalls.get(traceId);
    const flamegraph = this.flamegraphs.get(traceId);
    const criticalPath = this.criticalPaths.get(traceId);

    if (!tree) {
      return null;
    }

    const export_data = {
      traceId,
      metadata: {
        spanCount: tree.spanCount,
        totalDuration: tree.totalDuration,
        services: Array.from(tree.services),
        depth: tree.depth,
        generatedAt: Date.now()
      },
      tree: {
        rootSpans: tree.rootSpans,
        spanHierarchy: Array.from(tree.spanMap.entries()).map(([id, span]) => ({
          spanId: id,
          name: span.name,
          duration: span.duration,
          children: span.children,
          parentId: span.parentId,
          level: span.level
        }))
      },
      waterfall: waterfall ? {
        spanBars: waterfall.spanBars,
        parallelRanges: waterfall.parallelRanges
      } : null,
      flamegraph: flamegraph ? {
        stacks: flamegraph.stacks,
        totalTime: flamegraph.totalTime
      } : null,
      criticalPath: criticalPath ? {
        path: criticalPath.path,
        totalDuration: criticalPath.totalDuration,
        spanCount: criticalPath.spanCount,
        opportunities: criticalPath.potentialParallelization
      } : null
    };

    return export_data;
  }

  /**
   * Get trace statistics
   */
  getTraceStats(traceId) {
    const tree = this.visualizations.get(traceId);
    if (!tree) return null;

    const spans = Array.from(tree.spanMap.values());
    const durations = spans.map(s => s.duration).sort((a, b) => a - b);

    return {
      traceId,
      spanCount: tree.spanCount,
      services: Array.from(tree.services),
      totalDuration: tree.totalDuration,
      depth: tree.depth,
      spanDurationStats: {
        min: durations[0],
        max: durations[durations.length - 1],
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: durations[Math.floor(durations.length / 2)]
      },
      statusDistribution: {
        ok: spans.filter(s => s.status === 'ok').length,
        slow: spans.filter(s => s.status === 'slow').length,
        error: spans.filter(s => s.status === 'error').length
      }
    };
  }

  /**
   * Build flamegraph stack recursively
   */
  _buildFlameGraphStack(spanId, tree, ancestorNames, flamegraph) {
    const span = tree.spanMap.get(spanId);
    if (!span) return;

    const stackNames = [...ancestorNames, span.name];
    const stack = {
      stack: stackNames.join(';'),
      duration: span.duration,
      count: 1,
      totalTime: 0
    };

    flamegraph.stacks.push(stack);
    flamegraph.totalTime += span.duration;
    flamegraph.maxDepth = Math.max(flamegraph.maxDepth, stackNames.length);

    for (const childSpanId of (span.children || [])) {
      this._buildFlameGraphStack(childSpanId, tree, stackNames, flamegraph);
    }
  }

  /**
   * Find critical path recursively
   */
  _findCriticalPath(spanId, tree) {
    const span = tree.spanMap.get(spanId);
    if (!span) {
      return { path: [], spans: [], duration: 0 };
    }

    if (span.children.length === 0) {
      return {
        path: [spanId],
        spans: [spanId],
        duration: span.duration
      };
    }

    let maxChild = { path: [], spans: [], duration: 0 };
    for (const childSpanId of span.children) {
      const childPath = this._findCriticalPath(childSpanId, tree);
      if (childPath.duration > maxChild.duration) {
        maxChild = childPath;
      }
    }

    return {
      path: [spanId, ...maxChild.path],
      spans: [spanId, ...maxChild.spans],
      duration: span.duration + maxChild.duration
    };
  }

  /**
   * Get status color for visualization
   */
  _getStatusColor(status) {
    const colors = {
      ok: '#4CAF50',
      slow: '#FFC107',
      error: '#F44336',
      timeout: '#9C27B0'
    };
    return colors[status] || '#2196F3';
  }

  /**
   * Close system
   */
  close() {
    this.visualizations.clear();
    this.traceGraphs.clear();
    this.flamegraphs.clear();
    this.waterfalls.clear();
    this.criticalPaths.clear();
    this.emit('system:closed');
  }
}

module.exports = TraceVisualizer;
