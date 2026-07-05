# Export Rate Limiter Configuration Guide (L-002)

## Overview

The Export Rate Limiter module provides specialized rate limiting for export operations in the Basset Hound Browser. It prevents bulk data exfiltration, resource exhaustion, and abuse of sensitive data extraction endpoints.

**Module:** `src/security/export-rate-limiter.js`  
**Tests:** `tests/unit/security/export-rate-limiter.test.js`  
**Version:** 1.0.0  
**Overhead:** <0.2ms per request

## Quick Start

```javascript
const ExportRateLimiter = require('./src/security/export-rate-limiter');

// Initialize with default configuration
const limiter = new ExportRateLimiter();

// Check if an export is allowed
const result = limiter.checkExport('client1', 'export_cookies', {
  estimatedSize: 5000  // Optional: estimated data size in bytes
});

if (result.allowed) {
  // Proceed with export
  const exportId = result.exportId;
  
  // After export completes
  limiter.recordExportCompletion(exportId, actualSize);
} else {
  // Return rate limit error to client
  res.status(429).json({
    error: result.reason,
    retryAfter: result.retryAfter
  });
}
```

## Configuration

### Global Limits

Controls system-wide export rate limiting across all clients.

```javascript
const config = {
  global: {
    maxConcurrentExports: 50,        // Max simultaneous export operations
    maxExportsPerMinute: 500,        // Global rate limit
    maxTotalBandwidth: 100 * 1024 * 1024, // 100 MB/min globally
    windowSize: 60000                // 60 second rolling window
  }
};
```

**Parameters:**

- `maxConcurrentExports` (Number, default: 50)
  - Maximum number of simultaneous export operations across all clients
  - Prevents resource exhaustion from multiple concurrent exports
  - Returns `global_concurrent_limit_exceeded` when exceeded

- `maxExportsPerMinute` (Number, default: 500)
  - Maximum exports per minute across all clients
  - Uses sliding window algorithm for precise limiting
  - Returns `global_rate_limit_exceeded` when exceeded

- `maxTotalBandwidth` (Number, default: 100 MB)
  - Maximum bytes that can be exported per minute globally
  - Tracked across all clients
  - Returns `global_bandwidth_limit_exceeded` when exceeded

- `windowSize` (Number, default: 60000ms)
  - Sliding window duration for rate limiting
  - Resets every 60 seconds

### Per-Client Limits

Controls rate limiting on a per-client basis.

```javascript
const config = {
  perClient: {
    maxExportsPerMinute: 50,         // Per client per minute
    maxConcurrentExports: 5,         // Max parallel exports per client
    maxDataPerHour: 500 * 1024 * 1024, // 500 MB/hour per client
    burstCapacity: 10 * 1024 * 1024  // 10 MB burst allowance
  }
};
```

**Parameters:**

- `maxExportsPerMinute` (Number, default: 50)
  - Maximum exports per minute per client
  - Each client has independent quota
  - Returns `client_rate_limit_exceeded` when exceeded

- `maxConcurrentExports` (Number, default: 5)
  - Maximum parallel export operations per client
  - Prevents a single client from overwhelming the system
  - Returns `client_concurrent_limit_exceeded` when exceeded

- `maxDataPerHour` (Number, default: 500 MB)
  - Maximum data per client per hour
  - Hourly rolling window
  - Returns `client_quota_exceeded` when exceeded
  - Prevents bulk exfiltration attacks

- `burstCapacity` (Number, default: 10 MB)
  - Allowance for burst traffic above baseline
  - Reserved for implementation in future versions

### Per-Export-Type Limits

Configure rate limits and size restrictions for each export type.

```javascript
const config = {
  perType: {
    export_cookies: {
      maxPerMinute: 100,
      maxSize: 1 * 1024 * 1024,      // 1 MB
      cost: 1
    },
    export_session: {
      maxPerMinute: 30,
      maxSize: 10 * 1024 * 1024,     // 10 MB
      cost: 10
    },
    export_storage: {
      maxPerMinute: 40,
      maxSize: 100 * 1024 * 1024,    // 100 MB
      cost: 15
    },
    export_network_capture: {
      maxPerMinute: 20,
      maxSize: 200 * 1024 * 1024,    // 200 MB
      cost: 25
    },
    // ... more types
  }
};
```

**Supported Export Types (15+):**

1. `export_cookies` - Cookie data export
2. `export_cookies_file` - Cookies to file
3. `export_session` - Session state export
4. `export_history` - Browser history export
5. `export_request_rules` - Network request rules
6. `export_profile` - Browser profile export
7. `export_storage` - LocalStorage/SessionStorage
8. `export_scripts` - JavaScript code export
9. `export_network_capture` - Network traffic capture
10. `export_raw_html` - HTML content export
11. `export_network_log` - Network logs
12. `export_device_ids` - Device identifiers
13. `export_recording` - Session recordings
14. `export_monitors` - Competitor monitoring data
15. `export_checkpoint` - State checkpoint

**Per-Type Parameters:**

- `maxPerMinute` (Number)
  - Maximum exports of this type per minute
  - Type-specific limit across all clients

- `maxSize` (Number)
  - Maximum individual export size in bytes
  - Returns `export_size_limit_exceeded` if exceeded

- `cost` (Number)
  - Resource cost of this export type
  - Used for weighted rate limiting (reserved for future use)

### Backpressure Configuration

Automatically reduce rate limits when system resources are constrained.

```javascript
const config = {
  backpressure: {
    enabled: true,                   // Enable/disable backpressure
    memoryThreshold: 0.85,           // Trigger at 85% memory usage
    cpuThreshold: 0.90,              // Trigger at 90% CPU usage
    reducedRateMultiplier: 0.5       // Reduce rate by 50% under pressure
  }
};
```

**Parameters:**

- `enabled` (Boolean, default: true)
  - Enable adaptive backpressure based on system metrics

- `memoryThreshold` (Number, default: 0.85)
  - Memory usage threshold (0-1) to trigger backpressure
  - At 85% memory usage, activate backpressure

- `cpuThreshold` (Number, default: 0.90)
  - CPU usage threshold (0-1) to trigger backpressure
  - At 90% CPU usage, activate backpressure

- `reducedRateMultiplier` (Number, default: 0.5)
  - Multiplier for rate limits under backpressure
  - 0.5 = 50% of normal rate

**When Backpressure Activates:**

- `checkExport()` returns `system_backpressure` reason
- Client is asked to retry after 2 seconds
- Allows system to recover under high load

### Cleanup Configuration

Configure automatic cleanup of old tracking data.

```javascript
const config = {
  cleanup: {
    interval: 300000,                // 5 minutes
    maxHistoryAge: 3600000,          // 1 hour
    maxClientTracking: 10000         // Max unique clients
  }
};
```

**Parameters:**

- `interval` (Number, default: 300000ms)
  - How often cleanup runs
  - Set to 0 to disable automatic cleanup

- `maxHistoryAge` (Number, default: 3600000ms)
  - Maximum age of history entries before removal
  - Prevents unbounded memory growth

- `maxClientTracking` (Number, default: 10000)
  - Maximum unique clients to track simultaneously
  - When exceeded, keeps only top 80% by data volume

### Bypass Configuration

Allow specific clients to bypass rate limits.

```javascript
const config = {
  bypass: {
    enabled: true,                   // Enable/disable bypass
    bypassClients: [],               // Client IDs to bypass
    bypassPatterns: []               // Regex patterns for bypass
  }
};
```

**Parameters:**

- `enabled` (Boolean, default: true)
  - Enable/disable bypass functionality

- `bypassClients` (Array<String>)
  - List of client IDs that bypass all limits
  - Example: `['internal-service', 'admin-panel']`

- `bypassPatterns` (Array<String>)
  - Regex patterns for client IDs to bypass
  - Example: `['^admin-.*', '.*-internal$']`

**Example:**

```javascript
const config = {
  bypass: {
    enabled: true,
    bypassClients: ['internal-analytics'],
    bypassPatterns: ['^internal-.*', '^system-.*']
  }
};

const limiter = new ExportRateLimiter(config);

// These clients bypass all limits
limiter.checkExport('internal-analytics', 'export_cookies');  // → allowed
limiter.checkExport('internal-service', 'export_storage');    // → allowed
limiter.checkExport('system-monitor', 'export_history');      // → allowed
```

## Integration with WebSocket Commands

### Step 1: Wrap Export Command Handlers

```javascript
const ExportRateLimiter = require('./src/security/export-rate-limiter');
const limiter = new ExportRateLimiter();

this.commandHandlers.export_cookies = async (params) => {
  const clientId = params.clientId;
  const estimatedSize = 5000; // Estimate or calculate

  // Check rate limit
  const result = limiter.checkExport(clientId, 'export_cookies', {
    estimatedSize
  });

  if (!result.allowed) {
    throw new Error(`Rate limit exceeded: ${result.reason}`);
  }

  try {
    // Perform export
    const cookies = await this.cookieManager.exportCookies(
      params.format || 'json'
    );

    // Record completion
    const actualSize = JSON.stringify(cookies).length;
    limiter.recordExportCompletion(result.exportId, actualSize);

    return cookies;
  } catch (error) {
    // Optional: penalize failed exports if appropriate
    throw error;
  }
};
```

### Step 2: Apply to All Export Commands

Wrap all 15+ export command handlers with the limiter check.

### Step 3: Handle Rate Limit Errors

```javascript
catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    const reason = error.message.split(': ')[1];
    const response = {
      success: false,
      error: reason,
      retryAfter: limiter.getStats().global.windowResetIn
    };
    
    // Send 429 Conflict status
    ws.send(JSON.stringify({
      id: params.id,
      ...response
    }));
  } else {
    // Handle other errors
  }
}
```

### Step 4: Monitor Rate Limiting

```javascript
// Get current statistics
const stats = limiter.getStats();

console.log('Active exports:', stats.global.concurrentExports);
console.log('Last minute exports:', stats.global.lastMinuteExports);
console.log('Top clients:', stats.topClients);
console.log('Rejection rate:', stats.statistics.rejectionRate);
```

## API Reference

### checkExport(clientId, exportType, options)

Check if an export operation is allowed.

**Parameters:**

- `clientId` (String) - Client identifier
- `exportType` (String) - Type of export (e.g., 'export_cookies')
- `options` (Object)
  - `estimatedSize` (Number) - Estimated data size in bytes (optional)

**Returns:**

Success case:
```javascript
{
  allowed: true,
  exportId: 'exp_1718907234567_abc1234de',
  quotaRemaining: {
    global: 450,
    client: 45,
    type: 85
  }
}
```

Error cases:
```javascript
{
  allowed: false,
  reason: 'global_concurrent_limit_exceeded' | 'client_rate_limit_exceeded' | ...,
  retryAfter: 5,  // Seconds to wait before retry
  quotaRemaining: { /* ... */ }
}
```

### recordExportCompletion(exportId, actualSize)

Record the completion of an export operation.

**Parameters:**

- `exportId` (String) - Export ID from checkExport()
- `actualSize` (Number) - Actual bytes transferred

**Returns:**

```javascript
{
  recorded: true,
  duration: 1234,      // Milliseconds
  throughput: 5234,    // Bytes/second
  totalBytes: 6300
}
```

### getStats()

Get current rate limiting statistics.

**Returns:**

```javascript
{
  global: {
    concurrentExports: 12,
    maxConcurrent: 50,
    lastMinuteExports: 234,
    maxPerMinute: 500,
    bandwidthUsed: 45000000,
    maxBandwidth: 104857600
  },
  statistics: {
    totalExports: 12345,
    totalRejected: 234,
    rejectionRate: 0.0186,
    totalBytesTransferred: 567890000,
    averageExportSize: 46000,
    backpressureEvents: 2
  },
  activeExports: [
    {
      id: 'exp_1718907234567_abc1234de',
      type: 'export_cookies',
      clientId: 'client1',
      estimatedSize: 5000,
      duration: 234
    }
  ],
  topClients: [
    {
      clientId: 'client1',
      exportsCount: 45,
      totalBytes: 2300000,
      avgSize: 51111
    }
  ],
  clientTracking: 456,
  typeTracking: 15
}
```

### reset()

Reset all rate limiting state (for testing).

### destroy()

Cleanup resources and stop timers.

## Error Responses

The module returns specific error reasons:

| Reason | HTTP Code | Meaning | Solution |
|--------|-----------|---------|----------|
| `global_concurrent_limit_exceeded` | 429 | Too many concurrent exports globally | Wait for some exports to complete |
| `global_rate_limit_exceeded` | 429 | Global rate limit hit | Wait for window reset |
| `global_bandwidth_limit_exceeded` | 429 | Global bandwidth limit hit | Reduce export size or wait |
| `client_rate_limit_exceeded` | 429 | Per-client rate limit hit | Wait for window reset |
| `client_concurrent_limit_exceeded` | 429 | Too many concurrent exports for client | Wait for exports to complete |
| `client_quota_exceeded` | 429 | Hourly data quota exhausted | Wait for quota reset (1 hour) |
| `export_size_limit_exceeded` | 413 | Export data exceeds maximum size | Reduce scope of export |
| `system_backpressure` | 503 | System under load | Retry after 2 seconds |
| `unknown_export_type` | 400 | Invalid export type | Use valid export type |

## Performance Characteristics

### Throughput

- **checkExport():** <0.2ms per operation
- **recordExportCompletion():** <0.2ms per operation
- **getStats():** <1ms per call

### Memory

- Tracks up to 10,000 unique clients
- Maintains 1-hour history per client
- Automatic cleanup every 5 minutes
- Typical memory usage: 5-50 MB depending on activity

### Scalability

- Handles 50+ concurrent exports
- Supports 500+ exports/minute
- 100 MB/minute bandwidth tracking
- Linear complexity O(1) for most operations

## Example Configurations

### Strict Security (High-Traffic API)

```javascript
const config = {
  global: {
    maxConcurrentExports: 20,
    maxExportsPerMinute: 100,
    maxTotalBandwidth: 10 * 1024 * 1024  // 10 MB/min
  },
  perClient: {
    maxExportsPerMinute: 10,
    maxConcurrentExports: 2,
    maxDataPerHour: 50 * 1024 * 1024   // 50 MB/hour
  },
  perType: {
    export_recording: {
      maxPerMinute: 2,
      maxSize: 50 * 1024 * 1024
    },
    export_network_capture: {
      maxPerMinute: 5,
      maxSize: 100 * 1024 * 1024
    }
  }
};
```

### Relaxed (Internal Service)

```javascript
const config = {
  global: {
    maxConcurrentExports: 100,
    maxExportsPerMinute: 1000,
    maxTotalBandwidth: 500 * 1024 * 1024
  },
  perClient: {
    maxExportsPerMinute: 200,
    maxConcurrentExports: 20,
    maxDataPerHour: 5000 * 1024 * 1024
  },
  bypass: {
    enabled: true,
    bypassClients: ['internal-service'],
    bypassPatterns: ['^system-.*']
  }
};
```

### Development/Testing

```javascript
const config = {
  global: {
    maxConcurrentExports: 1000,
    maxExportsPerMinute: 10000,
    maxTotalBandwidth: 1024 * 1024 * 1024  // 1 GB/min
  },
  perClient: {
    maxExportsPerMinute: 1000,
    maxConcurrentExports: 100,
    maxDataPerHour: 10000 * 1024 * 1024
  },
  cleanup: {
    interval: 60000,  // 1 minute for faster cleanup
    maxHistoryAge: 600000  // 10 minutes
  }
};
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Rejection Rate**
   ```javascript
   const stats = limiter.getStats();
   if (stats.statistics.rejectionRate > 0.05) {
     console.warn('High rejection rate detected');
   }
   ```

2. **Backpressure Events**
   ```javascript
   if (stats.statistics.backpressureEvents > 10) {
     console.warn('Frequent backpressure activations');
   }
   ```

3. **Concurrent Exports**
   ```javascript
   if (stats.global.concurrentExports > stats.global.maxConcurrent * 0.8) {
     console.warn('High concurrent export load');
   }
   ```

4. **Client Behavior**
   ```javascript
   stats.topClients.forEach(client => {
     if (client.totalBytes > limiter.config.perClient.maxDataPerHour) {
       console.warn(`Client ${client.clientId} approaching hourly quota`);
     }
   });
   ```

## Testing

Run the test suite:

```bash
npm test tests/unit/security/export-rate-limiter.test.js
```

Test coverage includes:

- Basic export checking
- Per-client rate limiting
- Per-type rate limiting
- Global rate limiting
- Export completion tracking
- Client bypass functionality
- Statistics and reporting
- Reset and cleanup
- Export type coverage
- Edge cases
- Performance benchmarks

## Troubleshooting

### Clients Frequently Hitting Rate Limits

1. **Increase per-client limits:**
   ```javascript
   config.perClient.maxExportsPerMinute = 100;
   config.perClient.maxDataPerHour = 1000 * 1024 * 1024;
   ```

2. **Check if estimates are accurate:**
   - If `estimatedSize` is much lower than actual, increase margins
   - Consider pre-fetching size information

3. **Monitor for backpressure:**
   ```javascript
   const stats = limiter.getStats();
   if (stats.statistics.backpressureEvents > 0) {
     // Increase system resources or reduce global limits
   }
   ```

### High Memory Usage

1. **Reduce cleanup interval:**
   ```javascript
   config.cleanup.maxHistoryAge = 600000;  // 10 minutes instead of 1 hour
   ```

2. **Reduce client tracking:**
   ```javascript
   config.cleanup.maxClientTracking = 1000;  // Fewer clients tracked
   ```

3. **Monitor cleanup effectiveness:**
   ```javascript
   const stats = limiter.getStats();
   console.log(`Tracking ${stats.clientTracking} clients`);
   ```

### Rate Limits Too Aggressive

1. **Start with relaxed limits and gradually tighten:**
   ```javascript
   // Phase 1: High limits
   config.perClient.maxExportsPerMinute = 500;
   
   // Phase 2: After analysis, reduce gradually
   config.perClient.maxExportsPerMinute = 250;
   ```

2. **Use bypass for trusted clients:**
   ```javascript
   config.bypass.bypassClients = ['trusted-internal-service'];
   ```

3. **Adjust per-type limits individually:**
   ```javascript
   config.perType.export_cookies.maxPerMinute = 200;
   config.perType.export_recording.maxPerMinute = 5;
   ```

## Best Practices

1. **Always check allowed before proceeding with export**
2. **Record actual size, not estimated size**
3. **Monitor statistics regularly**
4. **Use bypass sparingly for trusted services**
5. **Start with conservative limits and relax as needed**
6. **Monitor for backpressure events**
7. **Clean up resources when limiter is no longer needed**
8. **Test configurations before production deployment**
9. **Use estimatedSize to plan ahead**
10. **Handle rate limit errors gracefully with 429 responses**

## Version History

- **1.0.0** (June 20, 2026) - Initial release
  - 15+ export type support
  - Global, per-client, per-type rate limiting
  - System backpressure detection
  - Comprehensive metrics and reporting
  - 28+ unit tests
  - <0.2ms overhead

## Support

For issues or questions:
- Check this configuration guide
- Review test cases for usage examples
- Examine error responses and troubleshooting section
- Monitor getStats() output for diagnostics
