/**
 * Implementation Examples for Phase 3 Optimizations
 * Shows concrete code changes needed to integrate each optimization
 */

// ==============================================================
// OPTIMIZATION 1: Connection Pool Integration
// ==============================================================

// File: websocket/server.js - In constructor (after line 383)

// ADD THIS:
const { ConnectionPool } = require('./connection-pool');

// In constructor initialization (around line 388):
this.connectionPool = new ConnectionPool(
  options.connectionPoolSize || 16,
  this._executePooledRequest.bind(this)
);

// ADD THIS METHOD to WebSocketServer class (before handleCommand):
async _executePooledRequest(request) {
  const { data, clientId } = request;
  const handler = this.commandHandlers[data.command];

  if (!handler) {
    throw new Error(`Unknown command: ${data.command}`);
  }

  return handler(data);
}

// MODIFY: Message handler (line 492-578) in ws.on('message')
// OLD: const response = await this.handleCommand(data);
// NEW:
async (message) => {
  try {
    const data = JSON.parse(message.toString());

    // ... auth checks ...

    // Use connection pool for command execution
    const response = await this.connectionPool.acquire({
      data,
      clientId: ws.clientId
    });

    this.profiler.endTimer(timerName);
    ws.send(JSON.stringify({
      id: data.id,
      command: data.command,
      ...response
    }));
  } catch (error) {
    // Handle pool backpressure
    if (error.message.includes('backpressure')) {
      ws.send(JSON.stringify({
        success: false,
        error: error.message,
        rateLimited: true,
        resetIn: 1000
      }));
    } else {
      ws.send(JSON.stringify({
        success: false,
        error: error.message
      }));
    }
  }
}

// ADD THIS COMMAND HANDLER:
this.commandHandlers.get_connection_pool_status = async () => {
  return {
    success: true,
    pool: this.connectionPool.getStatus(),
    metrics: this.connectionPool.getMetrics()
  };
};

// ==============================================================
// OPTIMIZATION 2: Tor Exit Node Cache Integration
// ==============================================================

// File: proxy/tor-advanced.js - In imports (add at top)

const { TorExitNodeCache } = require('./exit-node-cache');

// In AdvancedTorManager constructor (around line 200):
this.exitNodeCache = new TorExitNodeCache(5 * 60 * 1000); // 5-minute TTL

// REPLACE the checkExitIp() method entirely (line 1966):
async checkExitIp() {
  // Use cache for repeated calls
  return this.exitNodeCache.getOrFetch(async () => {
    // Original implementation wrapped here
    return new Promise((resolve) => {
      const options = {
        hostname: 'check.torproject.org',
        port: 443,
        path: '/api/ip',
        method: 'GET',
        timeout: 30000,
        agent: false
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({
              success: true,
              ip: json.IP,
              isTor: json.IsTor,
              message: json.IsTor ? 'Connected through Tor' : 'NOT connected through Tor'
            });
          } catch (e) {
            resolve({
              success: false,
              error: 'Failed to parse response'
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          hint: 'Make sure traffic is routed through Tor SOCKS proxy'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  });
}

// ADD THESE COMMAND HANDLERS (in WebSocketServer):
this.commandHandlers.refresh_tor_exit_node = async () => {
  if (!this.torManager) {
    return { success: false, error: 'Tor manager not available' };
  }

  const result = await this.torManager.exitNodeCache.refresh(
    this.torManager.checkExitIp.bind(this.torManager)
  );

  return {
    success: true,
    ...result
  };
};

this.commandHandlers.get_exit_node_cache_status = async () => {
  if (!this.torManager) {
    return { success: false, error: 'Tor manager not available' };
  }

  return {
    success: true,
    cache: this.torManager.exitNodeCache.getStats()
  };
};

// ==============================================================
// OPTIMIZATION 3: Screenshot Format Optimization
// ==============================================================

// File: screenshots/manager.js - In imports (add at top)

const { getOptimizedFormat, getOptimizedBatchFormats } = require('./format-optimizer');

// MODIFY captureViewport() method (line 118):
async captureViewport(options = {}) {
  // Get viewport dimensions for format selection
  const bounds = this.mainWindow.getBounds();

  // Get optimized format based on dimensions
  const optimized = getOptimizedFormat({
    width: bounds.width,
    height: bounds.height,
    type: 'viewport',
    quality: options.quality || 'normal',
    forceFormat: options.format
  });

  const {
    format = optimized.format,  // Use optimized format
    quality = optimized.quality // Use optimized quality
  } = options;

  const requestId = this.generateRequestId();

  return new Promise((resolve) => {
    this.pendingRequests.set(requestId, resolve);
    this.mainWindow.webContents.send('screenshot-viewport', {
      requestId,
      format,
      quality
    });

    setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        this.pendingRequests.delete(requestId);
        resolve({ success: false, error: 'Screenshot timeout' });
      }
    }, 30000);
  });
}

// MODIFY captureElement() method (line 185):
async captureElement(selector, options = {}) {
  // Get optimized format for element capture
  // Use assumed dimensions (can be refined with DOM inspection)
  const optimized = getOptimizedFormat({
    width: 400,  // Typical element width
    height: 300, // Typical element height
    type: 'element',
    quality: options.quality || 'normal',
    forceFormat: options.format
  });

  const {
    format = optimized.format,
    quality = optimized.quality,
    padding = 0
  } = options;

  const requestId = this.generateRequestId();

  return new Promise((resolve) => {
    this.pendingRequests.set(requestId, resolve);
    this.mainWindow.webContents.send('screenshot-element', {
      requestId,
      selector,
      format,
      quality,
      padding
    });

    setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        this.pendingRequests.delete(requestId);
        resolve({ success: false, error: 'Element screenshot timeout' });
      }
    }, 30000);
  });
}

// MODIFY captureFullPage() method (line 149):
async captureFullPage(options = {}) {
  // Full-page always uses PNG for lossless quality
  const {
    format = 'png',  // Force PNG
    quality = 1.0,   // Lossless quality
    scrollDelay = 100,
    maxHeight = 32000
  } = options;

  const requestId = this.generateRequestId();

  return new Promise((resolve) => {
    this.pendingRequests.set(requestId, resolve);
    this.mainWindow.webContents.send('screenshot-full-page', {
      requestId,
      format,
      quality,
      scrollDelay,
      maxHeight
    });

    setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        this.pendingRequests.delete(requestId);
        resolve({ success: false, error: 'Full page screenshot timeout' });
      }
    }, 120000);
  });
}

// ==============================================================
// OPTIMIZATION 4: Behavioral AI Simplification
// ==============================================================

// File: evasion/behavioral-ai.js - In imports (add at top)

const { BehavioralAIOptimizer } = require('./behavioral-ai-optimizer');

// MODIFY MouseMovementAI constructor (line 175):
class MouseMovementAI {
  constructor(behavioralProfile = null) {
    this.profile = behavioralProfile || new BehavioralProfile();

    // Initialize the behavioral AI optimizer for caching
    this.optimizer = new BehavioralAIOptimizer();
  }

  // REPLACE calculateFittsTime() method (line 186):
  calculateFittsTime(distance, targetWidth) {
    // Use optimizer's lookup table instead of calculating every time
    return this.optimizer.calculateFittsTime(
      distance,
      targetWidth,
      this.profile.speedMultiplier,
      this.profile.getFatigueFactor()
    );
  }

  // REPLACE generateMinimumJerkTrajectory() method (line 203):
  generateMinimumJerkTrajectory(start, end, duration) {
    // Use optimizer's cached trajectories instead of recalculating
    return this.optimizer.getTrajectory(start, end, duration);
  }

  // REPLACE addPhysiologicalTremor() method (line 231):
  addPhysiologicalTremor(points) {
    const intensity = PHYSICS.TREMOR_AMPLITUDE * this.profile.tremorIntensity;

    return points.map((point) => {
      // Use pre-computed tremor values from optimizer
      const tremor = this.optimizer.getTremor(point.t, 10, intensity);

      return {
        ...point,
        x: point.x + tremor.x,
        y: point.y + tremor.y
      };
    });
  }

  // REPLACE addMicroCorrections() method (line 257):
  addMicroCorrections(points, target) {
    if (Math.random() > PHYSICS.CORRECTION_PROBABILITY) {
      return points;
    }

    const distance = Math.sqrt(
      Math.pow(target.x - points[0].x, 2) +
      Math.pow(target.y - points[0].y, 2)
    );

    // Use simplified correction calculation
    const correction = this.optimizer.getSimplifiedMicroCorrection(distance);
    const correctedPoints = [...points];
    const correctionStart = Math.floor(points.length * 0.8);

    for (let i = correctionStart; i < points.length - 2; i++) {
      const progress = (i - correctionStart) / (points.length - correctionStart);
      const correctionFactor = Math.sin(progress * Math.PI);

      correctedPoints[i] = {
        ...correctedPoints[i],
        x: correctedPoints[i].x + correction.x * correctionFactor,
        y: correctedPoints[i].y + correction.y * correctionFactor
      };
    }

    return correctedPoints;
  }
}

// ADD COMMAND HANDLER (in WebSocketServer):
this.commandHandlers.get_behavioral_ai_stats = async () => {
  if (!this.mouseMovementAI) {
    return { success: false, error: 'Behavioral AI not initialized' };
  }

  return {
    success: true,
    stats: this.mouseMovementAI.optimizer.getStats()
  };
};

// ==============================================================
// PERFORMANCE MONITORING
// ==============================================================

// Add to WebSocketServer for comprehensive monitoring:

this.commandHandlers.get_optimization_metrics = async () => {
  const metrics = {
    connectionPool: this.connectionPool?.getMetrics() || null,
    torExitNodeCache: this.torManager?.exitNodeCache?.getStats() || null,
    behavioralAI: this.mouseMovementAI?.optimizer?.getStats() || null,
    timestamp: new Date().toISOString()
  };

  return {
    success: true,
    metrics
  };
};

// ==============================================================
// TESTING EXAMPLES
// ==============================================================

// Test connection pool performance:
async function testConnectionPoolPerformance() {
  const start = Date.now();
  const promises = [];

  // Simulate 50 concurrent requests
  for (let i = 0; i < 50; i++) {
    promises.push(server.connectionPool.acquire({
      data: { command: 'ping' },
      clientId: `test-${i}`
    }));
  }

  await Promise.all(promises);
  const elapsed = Date.now() - start;

  console.log(`50 concurrent requests: ${elapsed}ms`);
  console.log(`Pool metrics:`, server.connectionPool.getMetrics());
}

// Test exit node cache performance:
async function testExitNodeCachePerformance() {
  console.time('First call (fetch)');
  const result1 = await torManager.checkExitIp();
  console.timeEnd('First call (fetch)');

  console.time('Second call (cached)');
  const result2 = await torManager.checkExitIp();
  console.timeEnd('Second call (cached)');

  console.log('Cache stats:', torManager.exitNodeCache.getStats());
}

// Test format optimization:
function testFormatOptimization() {
  const captures = [
    { width: 400, height: 300, type: 'element' },
    { width: 1920, height: 1080, type: 'viewport' },
    { width: 1920, height: 5000, type: 'full-page' },
    { width: 800, height: 600, type: 'area' }
  ];

  const optimized = getOptimizedBatchFormats(captures);
  console.log('Optimized batch formats:', optimized);
  console.log(`Total estimated size: ${(optimized.totalEstimatedSize / 1024 / 1024).toFixed(2)} MB`);
}

// Test behavioral AI optimizer:
function testBehavioralAIOptimizer() {
  const optimizer = new BehavioralAIOptimizer();

  console.time('100 Fitts calculations');
  for (let i = 0; i < 100; i++) {
    optimizer.calculateFittsTime(Math.random() * 1000, 20);
  }
  console.timeEnd('100 Fitts calculations');

  console.log('AI optimizer stats:', optimizer.getStats());
}

module.exports = {
  testConnectionPoolPerformance,
  testExitNodeCachePerformance,
  testFormatOptimization,
  testBehavioralAIOptimizer
};
