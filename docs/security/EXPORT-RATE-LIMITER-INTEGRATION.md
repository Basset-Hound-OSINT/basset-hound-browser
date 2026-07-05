# Export Rate Limiter Integration Guide (L-002)

## Overview

This guide explains how to integrate the Export Rate Limiter module into the Basset Hound Browser WebSocket command handlers.

**Module:** `src/security/export-rate-limiter.js`  
**Integration Points:** 15+ export command handlers in `websocket/server.js`  
**Performance Overhead:** <0.2ms per request

## Quick Integration

### Step 1: Initialize the Limiter

```javascript
// In websocket/server.js, near the top of the class initialization
const ExportRateLimiter = require('../src/security/export-rate-limiter');

class WebSocketServer {
  constructor(options = {}) {
    // ... existing initialization ...

    // Initialize export rate limiter
    const exportLimiterConfig = {
      global: {
        maxConcurrentExports: 50,
        maxExportsPerMinute: 500,
        maxTotalBandwidth: 100 * 1024 * 1024
      },
      perClient: {
        maxExportsPerMinute: 50,
        maxConcurrentExports: 5,
        maxDataPerHour: 500 * 1024 * 1024
      }
    };

    this.exportRateLimiter = new ExportRateLimiter(exportLimiterConfig, {
      logger: this.logger
    });
  }
}
```

### Step 2: Wrap Export Command Handlers

Replace each export command handler with rate-limited version:

**Before:**
```javascript
this.commandHandlers.export_cookies = async (params) => {
  const { format, filter, domain } = params;
  const exportFilter = filter || (domain ? { domain } : {});
  return await this.cookieManager.exportCookies(format || 'json', exportFilter);
};
```

**After:**
```javascript
this.commandHandlers.export_cookies = async (params) => {
  const { format, filter, domain } = params;
  const clientId = params.clientId || 'unknown';

  // Check rate limit
  const limitCheck = this.exportRateLimiter.checkExport(
    clientId,
    'export_cookies',
    { estimatedSize: 5000 }  // Estimate: typical cookies are ~5KB
  );

  if (!limitCheck.allowed) {
    const error = new Error(`Export rate limit: ${limitCheck.reason}`);
    error.code = 429;
    error.reason = limitCheck.reason;
    error.retryAfter = limitCheck.retryAfter;
    throw error;
  }

  try {
    const exportFilter = filter || (domain ? { domain } : {});
    const result = await this.cookieManager.exportCookies(format || 'json', exportFilter);

    // Record completion
    const actualSize = JSON.stringify(result).length;
    this.exportRateLimiter.recordExportCompletion(limitCheck.exportId, actualSize);

    return result;
  } catch (error) {
    // Export failed - optionally penalize
    throw error;
  }
};
```

### Step 3: Apply to All Export Commands

Apply the same pattern to all 15+ export commands:

1. `export_cookies`
2. `export_cookies_file`
3. `export_session`
4. `export_history`
5. `export_request_rules`
6. `export_profile`
7. `export_storage`
8. `export_scripts`
9. `export_network_capture`
10. `export_raw_html`
11. `export_network_log`
12. `export_device_ids`
13. `export_recording`
14. `export_monitors`
15. `export_checkpoint`

### Step 4: Handle Rate Limit Errors

In the message handler, catch rate limit errors:

```javascript
async _handleMessage(ws, message) {
  try {
    const { command, params, id } = message;
    const result = await this.commandDispatcher.execute(command, params);

    ws.send(JSON.stringify({
      id,
      success: true,
      result
    }));
  } catch (error) {
    if (error.code === 429) {
      // Rate limit error
      ws.send(JSON.stringify({
        id: message.id,
        success: false,
        error: error.reason,
        retryAfter: error.retryAfter,
        message: `Rate limit exceeded: ${error.reason}`
      }));
    } else {
      // Other errors
      ws.send(JSON.stringify({
        id: message.id,
        success: false,
        error: error.message
      }));
    }
  }
}
```

### Step 5: Monitor Rate Limiting

Periodically log statistics:

```javascript
// In a monitoring loop or at regular intervals
setInterval(() => {
  const stats = this.exportRateLimiter.getStats();
  
  this.logger.info('Export Rate Limiter Stats:', {
    concurrentExports: stats.global.concurrentExports,
    lastMinuteExports: stats.global.lastMinuteExports,
    totalExports: stats.statistics.totalExports,
    rejectionRate: stats.statistics.rejectionRate,
    backpressureEvents: stats.statistics.backpressureEvents,
    topClients: stats.topClients.slice(0, 3)
  });

  // Alert on high rejection rate
  if (stats.statistics.rejectionRate > 0.1) {
    this.logger.warn('High export rate limit rejection rate detected');
  }
}, 60000);  // Every minute
```

## Estimated Sizes for Export Types

When calling `checkExport()`, use these estimated sizes:

```javascript
const estimatedSizes = {
  export_cookies: 5 * 1024,                    // ~5 KB
  export_cookies_file: 50 * 1024,              // ~50 KB
  export_session: 500 * 1024,                  // ~500 KB
  export_history: 5 * 1024 * 1024,             // ~5 MB
  export_request_rules: 100 * 1024,            // ~100 KB
  export_profile: 2 * 1024 * 1024,             // ~2 MB
  export_storage: 10 * 1024 * 1024,            // ~10 MB
  export_scripts: 500 * 1024,                  // ~500 KB
  export_network_capture: 50 * 1024 * 1024,    // ~50 MB
  export_raw_html: 5 * 1024 * 1024,            // ~5 MB
  export_network_log: 2 * 1024 * 1024,         // ~2 MB
  export_device_ids: 10 * 1024,                // ~10 KB
  export_recording: 100 * 1024 * 1024,         // ~100 MB
  export_monitors: 2 * 1024 * 1024,            // ~2 MB
  export_checkpoint: 5 * 1024 * 1024           // ~5 MB
};
```

Or calculate dynamically for file-based exports:

```javascript
const fs = require('fs');
const estimatedSize = fs.statSync(filepath).size;

const limitCheck = this.exportRateLimiter.checkExport(
  clientId,
  'export_cookies_file',
  { estimatedSize }
);
```

## Error Handling Best Practices

### Graceful Degradation

```javascript
this.commandHandlers.export_cookies = async (params) => {
  const clientId = params.clientId || 'unknown';

  const limitCheck = this.exportRateLimiter.checkExport(
    clientId,
    'export_cookies'
  );

  if (!limitCheck.allowed) {
    // Return specific error message to client
    if (limitCheck.reason === 'client_quota_exceeded') {
      throw new Error('You have exceeded your hourly export quota. Please try again in 1 hour.');
    } else if (limitCheck.reason === 'system_backpressure') {
      throw new Error('System is under high load. Please try again in a few seconds.');
    } else {
      throw new Error(`Export rate limit exceeded. Please retry after ${limitCheck.retryAfter} seconds.`);
    }
  }

  // ... rest of export logic
};
```

### Fallback Strategies

```javascript
this.commandHandlers.export_network_capture = async (params) => {
  const clientId = params.clientId || 'unknown';
  const requestedSize = params.maxBytes || (200 * 1024 * 1024); // Default 200MB

  // First attempt: try full size
  let limitCheck = this.exportRateLimiter.checkExport(
    clientId,
    'export_network_capture',
    { estimatedSize: requestedSize }
  );

  // If rejected due to size, suggest reduction
  if (!limitCheck.allowed && limitCheck.reason === 'export_size_limit_exceeded') {
    // Suggest smaller export
    const maxSize = this.exportRateLimiter.config.perType.export_network_capture.maxSize;
    throw new Error(
      `Requested size exceeds limit of ${maxSize / 1024 / 1024}MB. ` +
      `Try limiting to ${maxSize / 2 / 1024 / 1024}MB.`
    );
  }

  // If rejected due to rate limit, suggest client bypass option
  if (!limitCheck.allowed && limitCheck.reason === 'client_rate_limit_exceeded') {
    throw new Error(
      `Rate limit reached. Please contact support for a rate limit increase.`
    );
  }

  if (!limitCheck.allowed) {
    throw new Error(`Cannot proceed with export: ${limitCheck.reason}`);
  }

  // ... proceed with export
};
```

## Advanced Configurations

### High-Traffic Production Setup

```javascript
const config = {
  global: {
    maxConcurrentExports: 100,
    maxExportsPerMinute: 1000,
    maxTotalBandwidth: 500 * 1024 * 1024  // 500 MB/min
  },
  perClient: {
    maxExportsPerMinute: 100,
    maxConcurrentExports: 10,
    maxDataPerHour: 2000 * 1024 * 1024    // 2 GB/hour
  },
  backpressure: {
    enabled: true,
    memoryThreshold: 0.80,
    cpuThreshold: 0.85,
    reducedRateMultiplier: 0.7
  }
};
```

### Conservative Security Setup

```javascript
const config = {
  global: {
    maxConcurrentExports: 20,
    maxExportsPerMinute: 100,
    maxTotalBandwidth: 10 * 1024 * 1024   // 10 MB/min
  },
  perClient: {
    maxExportsPerMinute: 10,
    maxConcurrentExports: 2,
    maxDataPerHour: 50 * 1024 * 1024      // 50 MB/hour
  },
  perType: {
    export_network_capture: {
      maxPerMinute: 2,
      maxSize: 50 * 1024 * 1024
    },
    export_recording: {
      maxPerMinute: 1,
      maxSize: 100 * 1024 * 1024
    }
  },
  bypass: {
    enabled: true,
    bypassClients: [],                    // No bypass in security mode
    bypassPatterns: []
  }
};
```

### Internal Service Setup

```javascript
const config = {
  global: {
    maxConcurrentExports: 500,
    maxExportsPerMinute: 5000,
    maxTotalBandwidth: 1024 * 1024 * 1024 // 1 GB/min
  },
  perClient: {
    maxExportsPerMinute: 1000,
    maxConcurrentExports: 100,
    maxDataPerHour: 10000 * 1024 * 1024   // 10 GB/hour
  },
  bypass: {
    enabled: true,
    bypassClients: ['internal-analytics', 'system-backup'],
    bypassPatterns: ['^internal-.*', '^system-.*']
  }
};
```

## Cleanup and Lifecycle

### Shutdown

```javascript
class WebSocketServer {
  async shutdown() {
    // ... other shutdown logic ...

    // Clean up export rate limiter
    if (this.exportRateLimiter) {
      this.exportRateLimiter.destroy();
    }
  }
}
```

### Testing

```javascript
describe('Export Rate Limiting Integration', () => {
  let server;
  let limiter;

  beforeEach(() => {
    limiter = new ExportRateLimiter();
    server = new WebSocketServer({ rateLimiter: limiter });
  });

  afterEach(() => {
    if (limiter) limiter.destroy();
  });

  test('rejects exports when rate limited', async () => {
    const maxPerMinute = limiter.config.perClient.maxExportsPerMinute;

    // Fill quota
    for (let i = 0; i < maxPerMinute; i++) {
      const result = limiter.checkExport('test-client', 'export_cookies');
      if (result.allowed && result.exportId) {
        limiter.recordExportCompletion(result.exportId, 0);
      }
    }

    // Next should fail
    const result = limiter.checkExport('test-client', 'export_cookies');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('client_rate_limit_exceeded');
  });
});
```

## Monitoring Integration

### Prometheus Metrics Export

```javascript
// Export rate limiter metrics for Prometheus
function getExportRateLimiterMetrics(limiter) {
  const stats = limiter.getStats();

  return {
    // Global metrics
    'export_limiter_concurrent_exports': stats.global.concurrentExports,
    'export_limiter_minute_exports': stats.global.lastMinuteExports,
    'export_limiter_bandwidth_bytes': stats.global.bandwidthUsed,

    // Statistics
    'export_limiter_total_exports': stats.statistics.totalExports,
    'export_limiter_total_rejected': stats.statistics.totalRejected,
    'export_limiter_rejection_rate': stats.statistics.rejectionRate,
    'export_limiter_total_bytes': stats.statistics.totalBytesTransferred,
    'export_limiter_avg_size_bytes': stats.statistics.averageExportSize,
    'export_limiter_backpressure_events': stats.statistics.backpressureEvents
  };
}
```

### Health Check Integration

```javascript
function isExportRateLimiterHealthy(limiter) {
  const stats = limiter.getStats();

  const issues = [];

  // Check rejection rate
  if (stats.statistics.rejectionRate > 0.15) {
    issues.push(`High rejection rate: ${(stats.statistics.rejectionRate * 100).toFixed(2)}%`);
  }

  // Check backpressure
  if (stats.statistics.backpressureEvents > 100) {
    issues.push(`Excessive backpressure events: ${stats.statistics.backpressureEvents}`);
  }

  // Check concurrent exports
  if (stats.global.concurrentExports > stats.global.maxConcurrent * 0.9) {
    issues.push(`Near concurrent export limit: ${stats.global.concurrentExports}/${stats.global.maxConcurrent}`);
  }

  return {
    healthy: issues.length === 0,
    issues
  };
}
```

## Testing Checklist

Before deploying to production, verify:

- [ ] All 15 export commands are wrapped with rate limiter
- [ ] Rate limit errors return 429 status code
- [ ] Client bypass works as configured
- [ ] Statistics are being collected
- [ ] Metrics are being exported
- [ ] Error messages are user-friendly
- [ ] Logging shows rate limit events
- [ ] Performance overhead is <1ms
- [ ] Memory usage is stable over time
- [ ] System handles high concurrency gracefully

## Troubleshooting

### High Rejection Rate

If seeing >10% rejection rate:

1. Check client behavior - are they respecting backoff?
2. Increase per-client limits if legitimate high-volume clients exist
3. Check if exports are legitimately large (use `getStats()` to see average size)
4. Monitor system resources - may need infrastructure scaling

### Memory Leaks

If memory usage grows continuously:

1. Check cleanup interval - should be 5 minutes
2. Verify `recordExportCompletion()` is called for all exports
3. Check `maxClientTracking` - may need reduction
4. Review test code - may be creating limiter instances without cleanup

### Unexpected Rejections

If seeing unexpected rate limit rejections:

1. Enable detailed logging in checkExport()
2. Check configuration - limits may be too aggressive
3. Verify estimated sizes are accurate
4. Use bypass patterns for internal services if appropriate
5. Check for clock skew if using distributed system

## Support and Debugging

### Enable Debug Logging

```javascript
const config = { /* ... */ };
const logger = {
  warn: (...args) => console.warn('[EXPORT-LIMITER]', ...args),
  error: (...args) => console.error('[EXPORT-LIMITER]', ...args),
  info: (...args) => console.log('[EXPORT-LIMITER]', ...args)
};

const limiter = new ExportRateLimiter(config, { logger });
```

### Collect Diagnostics

```javascript
function getExportLimiterDiagnostics(limiter) {
  return {
    stats: limiter.getStats(),
    config: {
      global: limiter.config.global,
      perClient: limiter.config.perClient,
      perType: Object.keys(limiter.config.perType).reduce((acc, key) => {
        acc[key] = {
          maxPerMinute: limiter.config.perType[key].maxPerMinute,
          maxSize: limiter.config.perType[key].maxSize
        };
        return acc;
      }, {})
    },
    internalState: {
      activeExportsCount: limiter.activeExports.size,
      clientsTracked: limiter.clientState.size,
      typesTracked: limiter.typeState.size
    }
  };
}
```

## Migration from Previous System

If migrating from an older rate limiting system:

1. Run both systems in parallel for verification
2. Compare statistics and rejection patterns
3. Adjust configuration based on historical data
4. Gradually increase limits to match previous system
5. Monitor for differences in client behavior
6. Run full regression tests

## Version History

- **1.0.0** (June 20, 2026) - Initial integration guide
  - Complete integration instructions
  - Configuration examples
  - Error handling patterns
  - Monitoring integration
  - Troubleshooting guide
