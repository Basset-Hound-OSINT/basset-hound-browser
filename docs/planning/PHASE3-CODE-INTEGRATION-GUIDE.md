# Phase 3 Code Integration Guide

**Detailed Code Examples and Line References**  
**Version:** 1.0  
**Date:** June 13, 2026

---

## File: `/websocket/server.js` - Integration Points

### Import Section (Lines 1-32)

**Current state:** Lines 1-32 contain all imports, with CommandDispatcher at line 31.

**Add after line 31:**
```javascript
const { OptimizedResponseSerializer } = require('./response-serializer');
const { LazyManager, LazyManagerRegistry } = require('../src/managers/lazy-initializer');
const { initializeGCTuning, initializeAdvancedGCTuning } = require('../utils/gc-tuning');
```

**New line count after imports:** 35 (3 lines added)

---

### Startup Section - Server Initialization (Lines 970-1020)

**Current:** WebSocket server creation with compression config

**Location:** After line 987 (after compressionConfig definition)

**Add Response Serializer:**
```javascript
    // ==========================================
    // Phase 3 Optimization Components
    // ==========================================
    
    // Initialize response serializer (OPT-11)
    this.responseSerializer = new OptimizedResponseSerializer({
      enableStatsCollection: true,
      bufferPoolSize: 100,
      maxStringBufferSize: 64 * 1024
    });
    this.logger.info('[Phase3] Response serializer initialized');

    // Initialize lazy manager registry (OPT-9)
    this.lazyManagerRegistry = new LazyManagerRegistry();
    
    // Register lazy managers for non-critical systems
    this.lazyManagerRegistry.register('screenshot',
      new LazyManager('ScreenshotManager', async () => new ScreenshotManager())
    );
    this.lazyManagerRegistry.register('technology',
      new LazyManager('TechnologyManager', async () => new TechnologyManager())
    );
    this.lazyManagerRegistry.register('extraction',
      new LazyManager('ExtractionManager', async () => new ExtractionManager())
    );
    this.lazyManagerRegistry.register('networkAnalysis',
      new LazyManager('NetworkAnalysisManager', async () => new NetworkAnalysisManager())
    );
    this.lazyManagerRegistry.register('sessionRecording',
      new LazyManager('SessionRecordingManager', async () => new SessionRecordingManager())
    );
    this.lazyManagerRegistry.register('replay',
      new LazyManager('ReplayEngine', async () => new ReplayEngine())
    );
    this.lazyManagerRegistry.register('headless',
      new LazyManager('HeadlessManager', async () => new HeadlessManager())
    );
    this.lazyManagerRegistry.register('windows',
      new LazyManager('WindowManager', async () => new WindowManager())
    );
    this.lazyManagerRegistry.register('plugins',
      new LazyManager('PluginManager', async () => new PluginManager())
    );
    this.logger.info('[Phase3] Lazy manager registry initialized with 9 managers');

    // Initialize GC tuning (OPT-12)
    const gcConfig = initializeGCTuning({
      maxHeapSize: 512,           // MB
      enableGCMonitoring: true,
      enablePeriodicCleanup: true,
      cleanupInterval: 60000      // 1 minute
    });
    this.gcConfig = gcConfig;
    this.logger.info('[Phase3] GC tuning initialized');
```

**New line count for startup section:** Approx +60 lines

---

### Template Registration (After WebSocket Server Creation)

**Current:** Lines 1005-1020 create WebSocket server

**Location:** After line 1020 (after wss created), before SSL setup

**Add template registration:**
```javascript
    // ==========================================
    // Register Response Templates for OPT-11
    // ==========================================
    
    // Success response template
    this.responseSerializer.registerTemplate('success', {
      success: true,
      command: undefined,
      id: undefined
    });

    // Error response template
    this.responseSerializer.registerTemplate('error', {
      success: false,
      command: undefined,
      error: undefined,
      id: undefined
    });

    // Status response template
    this.responseSerializer.registerTemplate('status', {
      success: true,
      status: undefined,
      command: 'status',
      id: undefined
    });

    // Pong response template
    this.responseSerializer.registerTemplate('pong', {
      command: 'pong',
      id: undefined
    });

    // Screenshot response template
    this.responseSerializer.registerTemplate('screenshot', {
      success: true,
      command: 'screenshot',
      image: undefined,
      id: undefined
    });

    this.logger.info('[Phase3] Response templates registered (5 templates)');
```

**New line count:** Approx +45 lines

---

### WebSocket Connection Handler - Listening Event

**Current:** Lines 1065-1080+ contain connection setup

**Location:** Inside `this.wss.on('listening', ...)` callback (near the end)

**Add Advanced GC and Preloading:**
```javascript
      // ==========================================
      // Phase 3 Post-Startup Initialization
      // ==========================================
      
      // Initialize advanced GC tuning after server is listening (OPT-12)
      try {
        const advancedGCConfig = initializeAdvancedGCTuning({
          adaptiveMode: true,
          heapGrowthThreshold: 20,   // % threshold before adaptive GC
          enableHeapSnapshots: false // Set true for diagnostics only
        });
        
        this.advancedGCConfig = advancedGCConfig;
        this.logger.info('[Phase3] Advanced GC tuning initialized');
      } catch (error) {
        this.logger.warn(`[Phase3] Advanced GC tuning failed: ${error.message}`);
        // Continue without advanced GC - not critical
      }

      // Preload critical managers in background (OPT-9)
      setImmediate(async () => {
        try {
          const startTime = Date.now();
          const results = await this.lazyManagerRegistry.preloadCritical();
          const duration = Date.now() - startTime;
          this.logger.info(
            `[Phase3] Preloaded ${results.length} critical managers in ${duration}ms`
          );
        } catch (error) {
          this.logger.warn(`[Phase3] Error preloading managers: ${error.message}`);
          // Non-critical - managers will load on first use
        }
      });
```

**New line count:** Approx +30 lines

---

### Message Handler - Authentication Response (Line 1082)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id,
              command: 'authenticate',
              ...authResult
            }));
```

**Replace with:**
```javascript
            const authResponse = this.responseSerializer.serialize('success', {
              id: data.id,
              command: 'authenticate',
              ...authResult
            });
            ws.send(authResponse);
```

**Location:** Line 1082 (ws.send call in authentication handler)

---

### Message Handler - Auth Check Failure (Line 1092)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id,
              command: data.command,
              success: false,
              error: 'Authentication required. Send authenticate command with token.'
            }));
```

**Replace with:**
```javascript
            const errorResponse = this.responseSerializer.serialize('error', {
              id: data.id,
              command: data.command,
              error: 'Authentication required. Send authenticate command with token.'
            });
            ws.send(errorResponse);
```

**Location:** Line 1092 (auth check failure response)

---

### Message Handler - Rate Limit Status (Line 1104)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id,
              command: 'get_rate_limit_status',
              success: true,
              ...status
            }));
```

**Replace with:**
```javascript
            const statusResponse = this.responseSerializer.serialize('status', {
              id: data.id,
              command: 'get_rate_limit_status',
              ...status
            });
            ws.send(statusResponse);
```

**Location:** Line 1104 (rate limit status response)

---

### Message Handler - Rate Limited Response (Line 1116)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id,
              command: data.command,
              success: false,
              error: rateLimitResult.error,
              rateLimited: true,
              resetIn: rateLimitResult.resetIn,
              remaining: rateLimitResult.remaining
            }));
```

**Replace with:**
```javascript
            const rateLimitResponse = this.responseSerializer.serialize('error', {
              id: data.id,
              command: data.command,
              error: rateLimitResult.error,
              rateLimited: true,
              resetIn: rateLimitResult.resetIn,
              remaining: rateLimitResult.remaining
            });
            ws.send(rateLimitResponse);
```

**Location:** Line 1116 (rate limit exceeded response)

---

### Message Handler - Concurrency Limited (Line 1131)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id,
              command: data.command,
              success: false,
              error: concurrencyCheck.error,
              concurrencyLimited: true,
              current: concurrencyCheck.current,
              max: concurrencyCheck.max
            }));
```

**Replace with:**
```javascript
            const concurrencyResponse = this.responseSerializer.serialize('error', {
              id: data.id,
              command: data.command,
              error: concurrencyCheck.error,
              concurrencyLimited: true,
              current: concurrencyCheck.current,
              max: concurrencyCheck.max
            });
            ws.send(concurrencyResponse);
```

**Location:** Line 1131 (concurrency limit exceeded)

---

### Message Handler - Command Response (Line 1175)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id,
              command: data.command,
              ...response
            }));
```

**Replace with:**
```javascript
            const commandResponse = this.responseSerializer.serialize('success', {
              id: data.id,
              command: data.command,
              ...response
            });
            ws.send(commandResponse);
```

**Location:** Line 1175 (main command response after dispatcher execution)

---

### Message Handler - Error Response (Line 1202)

**Current:**
```javascript
            ws.send(JSON.stringify({
              id: data.id || null,
              command: data.command || null,
              success: false,
              error: errorMessage,
              errorCode: errorCode,
              details: errorDetails
            }));
```

**Replace with:**
```javascript
            const errorMsg = this.responseSerializer.serialize('error', {
              id: data.id || null,
              command: data.command || null,
              error: errorMessage,
              errorCode: errorCode,
              details: errorDetails
            });
            ws.send(errorMsg);
```

**Location:** Line 1202 (error response in catch block)

---

### Connection Open Handler (Line 1573)

**Current:**
```javascript
        ws.send(JSON.stringify({
          type: 'system',
          event: 'connection_open',
          clientId: clientId,
          timestamp: new Date().toISOString()
        }));
```

**Replace with:**
```javascript
        const openMsg = this.responseSerializer.serialize('status', {
          type: 'system',
          event: 'connection_open',
          clientId: clientId,
          timestamp: new Date().toISOString(),
          command: 'connection_open'
        });
        ws.send(openMsg);
```

**Location:** Line 1573 (connection open event)

---

### Connection Close Handler (Line 1587)

**Current:**
```javascript
        ws.send(JSON.stringify({
          type: 'system',
          event: 'connection_closed',
          clientId: clientId,
          timestamp: new Date().toISOString()
        }));
```

**Replace with:**
```javascript
        const closeMsg = this.responseSerializer.serialize('status', {
          type: 'system',
          event: 'connection_closed',
          clientId: clientId,
          timestamp: new Date().toISOString(),
          command: 'connection_closed'
        });
        ws.send(closeMsg);
```

**Location:** Line 1587 (connection close event)

---

### Status Command - Main Response (Line 9739)

**Current:** Status command response with full metrics

**Location:** Status command handler (search for `'status'` command)

**Add serializer stats to response:**
```javascript
        serializerStats: this.responseSerializer.getStats(),
        lazyManagerStatus: this.lazyManagerRegistry.getStatus(),
        gc: {
          heapStats: this.gcConfig ? this.gcConfig.getHeapStats() : null,
          gcStats: this.gcConfig ? this.gcConfig.getGCStats() : null
        }
```

**Insert location:** Within status response object construction

---

### Server Shutdown - Cleanup (New method)

**Location:** Server cleanup/shutdown handler

**Add cleanup calls:**
```javascript
    // Cleanup Phase 3 optimization components on shutdown
    if (this.responseSerializer) {
      this.responseSerializer.cleanup();
    }
    
    if (this.gcConfig && this.gcConfig.cleanup) {
      this.gcConfig.cleanup();
    }
    
    this.logger.info('[Phase3] Cleanup completed');
```

---

## File: `/src/managers/lazy-initializer.js` - Verification

### Verify LazyManagerRegistry Exists

**Required class structure:**
```javascript
class LazyManagerRegistry {
  constructor() {
    this.managers = new Map();
  }

  register(name, lazyManager) {
    this.managers.set(name, lazyManager);
  }

  get(name) {
    return this.managers.get(name);
  }

  async preloadCritical() {
    const criticalManagers = [
      'proxy',
      'userAgent', 
      'requestInterceptor',
      'screenshot'
    ];
    
    const results = await Promise.all(
      criticalManagers
        .filter(name => this.managers.has(name))
        .map(name => this.managers.get(name).forceInitialize())
    );
    
    return results;
  }

  getStatus() {
    const status = {};
    for (const [name, manager] of this.managers) {
      status[name] = manager.getStatus();
    }
    return status;
  }
}

module.exports = { LazyManager, LazyManagerRegistry };
```

**If LazyManagerRegistry missing:** Add the class above to file

---

## File: `/utils/gc-tuning.js` - Verification

### Verify Functions Exist

**Required functions:**
1. `initializeGCTuning(options)` - Base GC setup
2. `initializeAdvancedGCTuning(options)` - Advanced V8 optimization
3. `setupGCMonitoring(gcEventLog)` - Real-time monitoring
4. `setupPeriodicCleanup(interval)` - Scheduled cleanup

**Return object from initializeGCTuning must include:**
```javascript
{
  getHeapStats: function,
  getGCStats: function,
  forceGarbageCollection: function,
  cleanup: function
}
```

**Return object from initializeAdvancedGCTuning should exist**

If missing, create or verify functions exist in file.

---

## File: `/websocket/response-serializer.js` - Verification

### Key Methods to Verify

1. **Constructor:**
```javascript
new OptimizedResponseSerializer(options)
```

2. **Methods:**
```javascript
.registerTemplate(name, template)
.serialize(templateName, values)
.getStats()
.cleanup()
```

3. **Stats returned from getStats():**
```javascript
{
  totalSerialized: number,
  templateHits: number,
  templateMisses: number,
  avgSerializationTime: number,
  bufferPoolStats: object
}
```

If any method missing, implement before integration.

---

## Testing Integration Points

### Test 1: Serializer Integration
```javascript
const { OptimizedResponseSerializer } = require('./response-serializer');
const serializer = new OptimizedResponseSerializer();

// Should not throw
serializer.registerTemplate('success', { success: true, command: undefined });
const result = serializer.serialize('success', { command: 'test' });
console.log(typeof result); // Should be 'string'
```

### Test 2: Lazy Manager Integration
```javascript
const { LazyManager, LazyManagerRegistry } = require('../src/managers/lazy-initializer');
const registry = new LazyManagerRegistry();

// Should not throw
registry.register('test', new LazyManager('Test', async () => ({test: true})));
const status = registry.getStatus();
console.log(status); // Should contain 'test' entry
```

### Test 3: GC Tuning Integration
```javascript
const { initializeGCTuning, initializeAdvancedGCTuning } = require('../utils/gc-tuning');

// Should not throw
const gc1 = initializeGCTuning();
const gc2 = initializeAdvancedGCTuning();
console.log(typeof gc1.getHeapStats); // 'function'
```

---

## Summary of Changes by File

### `/websocket/server.js` - Major Changes
| Section | Lines | Changes | Type |
|---------|-------|---------|------|
| Imports | 1-35 | +3 imports | Addition |
| Startup init | ~987-1050 | +60 lines | Addition |
| Template registration | ~1020-1070 | +45 lines | Addition |
| Message handler (auth) | 1082 | 3 lines modified | Replacement |
| Message handler (auth check) | 1092 | 3 lines modified | Replacement |
| Message handler (rate limit) | 1104 | 3 lines modified | Replacement |
| Message handler (rate limit exceeded) | 1116 | 3 lines modified | Replacement |
| Message handler (concurrency) | 1131 | 3 lines modified | Replacement |
| Message handler (command resp) | 1175 | 3 lines modified | Replacement |
| Message handler (error) | 1202 | 3 lines modified | Replacement |
| Connection open | 1573 | 3 lines modified | Replacement |
| Connection close | 1587 | 3 lines modified | Replacement |
| Status command | ~9739 | +3 lines | Addition |
| Listening event | ~1280 | +30 lines | Addition |
| Shutdown | New | +5 lines | Addition |

**Total estimated changes:** 160-180 lines

---

## Verification Checklist

After each integration step:

- [ ] File opens without errors
- [ ] No undefined references
- [ ] Syntax highlighting shows no errors
- [ ] Application starts without errors
- [ ] Correct log messages appear
- [ ] Status command includes new fields

---

**Version:** 1.0  
**Last Updated:** June 13, 2026  
**Status:** Ready for Development
