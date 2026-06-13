# Core Module - Infrastructure & Patterns

The Core module provides unified infrastructure for error handling, reporting, commands, and utilities used throughout Basset Hound Browser.

**Location:** `/src/core/`  
**Version:** 1.0.0  
**Status:** Production Ready (v12.1.0+)

---

## Modules Overview

### 1. Error Hierarchy (`errors.js`)

Unified error classes with structured metadata for consistent error handling across the codebase.

**Features:**
- 19 custom error classes covering all domains
- Structured error metadata (code, statusCode, context, recoveryHint)
- Retryability flags for automatic recovery
- JSON serialization for logging
- Stack trace preservation

**Import:**
```javascript
const {
  BassetError,
  ValidationError,
  TimeoutError,
  NavigationError,
  DetectionError,
  ExtractionError,
  SessionError,
  AuthenticationError,
  ProxyError,
  FileOperationError,
  ConfigurationError,
  RateLimitError,
  ResourceError,
  InternalError
} = require('./src/core/errors');
```

**Usage:**
```javascript
// Throw with structured data
throw new ValidationError('URL is required', {
  code: 'INVALID_URL',
  statusCode: 400,
  context: { url: params.url }
});

// Error recovery hints
try {
  await connect();
} catch (error) {
  console.log(error.recoveryHint);
  // Output: "Check proxy configuration and connectivity"
}

// Automatic retryability detection
if (error.isRetryable) {
  await retry(() => operation());
}

// Structured logging
logger.error('Operation failed', error.toJSON());
// Output: { type, message, code, statusCode, context, stack, ... }
```

---

### 2. Base Report Generator (`base-report-generator.js`)

Abstract base class for all report generation modules. Provides common functionality for creating, saving, and managing reports.

**Features:**
- Event-driven architecture (EventEmitter)
- Format strategy pattern for extensibility
- File I/O operations
- Report listing and retrieval
- Metadata management

**Import:**
```javascript
const BaseReportGenerator = require('./src/core/base-report-generator');
```

**Usage:**
```javascript
class CustomReportGenerator extends BaseReportGenerator {
  constructor(options) {
    super(options);
    
    // Register output formatters
    this.registerFormat('json', new JSONFormatter());
    this.registerFormat('html', new HTMLFormatter());
    this.registerFormat('csv', new CSVFormatter());
  }
}

const generator = new CustomReportGenerator({
  reportDir: '/path/to/reports',
  autoSave: true
});

// Generate report
const data = { /* report data */ };
const html = await generator.generate(data, 'html');

// Save report
const filepath = await generator.save(html, 'report.html');

// List all reports
const reports = generator.listReports();

// Delete report
await generator.deleteReport('report.html');

// Listen for events
generator.on('report:generated', ({ format, contentLength }) => {
  console.log(`Generated ${format} report (${contentLength} bytes)`);
});

generator.on('report:error', ({ error, stage }) => {
  console.error(`Error during ${stage}: ${error.message}`);
});
```

---

### 3. Command Handler (`command-handler.js`)

Base class for WebSocket command handlers. Provides standardized execution, validation, and error handling.

**Features:**
- Standardized execution interface
- Parameter and precondition validation
- Automatic error handling and recovery
- Retry logic with exponential backoff
- Sensitive data sanitization
- Metadata tracking

**Import:**
```javascript
const CommandHandler = require('./src/core/command-handler');
```

**Usage:**
```javascript
// Create custom command handler
class NavigateCommand extends CommandHandler {
  get name() {
    return 'navigate';
  }

  get isIdempotent() {
    return true; // Safe to retry
  }

  validateParams(params) {
    if (!params.url) {
      throw new ValidationError('URL is required');
    }
  }

  async checkPreconditions(params) {
    if (!this.browser) {
      throw new InternalError('Browser not available');
    }
  }

  async execute(params) {
    const result = await this.browser.navigate(params.url);
    return {
      success: true,
      url: result.url,
      title: result.title
    };
  }

  validateResult(result) {
    if (!result.success || !result.url) {
      throw new InternalError('Invalid navigation result');
    }
  }
}

// Execute command
const handler = new NavigateCommand({ browser });
const result = await handler.handle({ url: 'https://example.com' });

// Result structure
console.log(result);
// {
//   success: true,
//   url: 'https://example.com',
//   title: 'Example Domain',
//   _metadata: {
//     command: 'navigate',
//     duration: 1234,
//     timestamp: '2026-06-13T10:30:00Z'
//   }
// }
```

---

### 4. Command Registry (`command-registry.js`)

Centralized registry for WebSocket command handlers. Replaces hardcoded command routing in the server.

**Features:**
- Dynamic command registration
- Handler lookup and discovery
- Batch registration
- Command aliases
- Metadata management
- Registry export/statistics

**Import:**
```javascript
const CommandRegistry = require('./src/core/command-registry');
```

**Usage:**
```javascript
// Create registry
const registry = new CommandRegistry();

// Register single command
registry.register('navigate', new NavigateCommand({ browser }), {
  retryable: true,
  timeout: 30000
});

// Register multiple commands
registry.registerBatch({
  'navigate': new NavigateCommand({ browser }),
  'click': new ClickCommand({ browser }),
  'screenshot': new ScreenshotCommand({ browser }),
  'fill': new FillCommand({ browser })
});

// Add command alias
registry.registerAlias('img', 'screenshot');

// Check if command exists
if (registry.has('navigate')) {
  const result = await registry.execute('navigate', { url: '...' });
}

// List all commands
const commands = registry.listAll();
commands.forEach(cmd => {
  console.log(`${cmd.name} (${cmd.retryable ? 'retryable' : 'non-retryable'})`);
});

// Get statistics
const stats = registry.getStats();
console.log(`Total commands: ${stats.totalCommands}`);
console.log(`Retryable commands: ${stats.retryableCount}`);

// Export for documentation
const exported = registry.export();
fs.writeFileSync('commands.json', JSON.stringify(exported, null, 2));
```

---

### 5. Core Utilities (`utils.js`)

Common utility functions for memoization, timing, object manipulation, and validation.

**Features:**
- 30+ utility functions
- Memoization and caching
- Timing utilities (debounce, throttle, retry)
- Object manipulation (clone, merge, flatten)
- Validation helpers
- Safe JSON utilities

**Import:**
```javascript
const {
  // Memoization
  memoize,
  memoizeAsync,
  
  // Timing
  debounce,
  throttle,
  retry,
  withTimeout,
  sleep,
  
  // Objects
  deepClone,
  merge,
  deepMerge,
  isEmpty,
  getNestedValue,
  setNestedValue,
  flattenObject,
  
  // Validation
  isValidEmail,
  isValidUrl,
  
  // JSON
  safeJsonParse,
  safeJsonStringify
} = require('./src/core/utils');
```

**Usage Examples:**

```javascript
// Memoization
const cachedFetch = memoize(async (url) => {
  return await fetch(url);
}, 3600000); // 1 hour TTL

// Debounce
const debouncedSearch = debounce((query) => {
  performSearch(query);
}, 300);

// Retry with backoff
const result = await retry(
  () => connectToServer(),
  {
    maxAttempts: 3,
    delay: 1000,
    backoff: 2,
    onRetry: (attempt, delay, error) => {
      console.log(`Retry ${attempt} in ${delay}ms: ${error.message}`);
    }
  }
);

// Object utilities
const clone = deepClone(original);
const merged = deepMerge(obj1, obj2);
const value = getNestedValue(data, 'user.profile.email');
setNestedValue(config, 'database.host', 'localhost');

// Validation
if (isValidEmail(email) && isValidUrl(url)) {
  proceed();
}

// Safe JSON
const data = safeJsonParse(jsonString, { fallback: 'default' });
const json = safeJsonStringify(object, '{}');
```

---

### 6. Core Index (`index.js`)

Unified entry point for core infrastructure. Provides convenient access to all core modules.

**Import:**
```javascript
// Recommended: Use specific imports
const core = require('./src/core');
const { ValidationError } = core.errors;
const { retry } = core.utils;

// Or individual imports
const { ValidationError } = require('./src/core/errors');
const { retry } = require('./src/core/utils');
```

---

## Architecture Patterns

### Error Handling Pattern

```javascript
const { ValidationError, TimeoutError } = require('./src/core/errors');

async function operation(params) {
  try {
    // Validate
    if (!params.url) {
      throw new ValidationError('URL required');
    }

    // Execute with timeout
    const result = await withTimeout(
      fetchData(params.url),
      30000 // 30 second timeout
    );

    return result;
  } catch (error) {
    if (error instanceof ValidationError) {
      // Handle validation errors
      console.log(error.recoveryHint);
    } else if (error instanceof TimeoutError) {
      // Handle timeout
      console.log('Operation timed out, retrying...');
    } else {
      // Handle other errors
      throw error;
    }
  }
}
```

### Command Handler Pattern

```javascript
class MyCommand extends CommandHandler {
  get name() { return 'my-command'; }
  get isIdempotent() { return true; }

  validateParams(params) {
    // Validation logic
  }

  async checkPreconditions(params) {
    // Precondition checks
  }

  async execute(params) {
    // Command implementation
    return { success: true, /* data */ };
  }
}

// Use in registry
const registry = new CommandRegistry();
registry.register('my-command', new MyCommand({ browser }));
```

### Utility Pattern

```javascript
// Memoize expensive operations
const getCachedData = memoize(async () => {
  return await database.query('SELECT * FROM data');
}, 3600000); // Cache for 1 hour

// Debounce UI updates
const saveOnInput = debounce(async (text) => {
  await api.save(text);
}, 500); // Wait 500ms after last input

// Retry with exponential backoff
const data = await retry(
  () => fetchFromApi(),
  { maxAttempts: 3, delay: 1000, backoff: 2 }
);
```

---

## Migration Guide

### From Old to New

**Old Error Handling:**
```javascript
try {
  await operation();
} catch (error) {
  console.error('Error:', error.message);
}
```

**New Error Handling:**
```javascript
const { ValidationError, InternalError } = require('./src/core/errors');

try {
  await operation();
} catch (error) {
  if (error instanceof ValidationError) {
    // Structured error with recovery hint
    logger.error(error.toJSON());
  } else {
    throw new InternalError(`Operation failed: ${error.message}`);
  }
}
```

**Old Report Generation:**
```javascript
const generator = new ForensicReportGenerator();
const html = generator.generateHTML(data);
fs.writeFileSync('report.html', html);
```

**New Report Generation:**
```javascript
const { UnifiedForensicGenerator } = require('./src/reporting/forensic-generator');
const generator = new UnifiedForensicGenerator();
const html = await generator.generateReport(data, 'html');
await generator.saveReport(html, 'report.html');
```

---

## Best Practices

1. **Always use typed errors:**
   - Throw specific error classes (ValidationError, TimeoutError, etc.)
   - Include recovery hints for user-facing errors

2. **Use command handlers for WebSocket operations:**
   - Extends CommandHandler for consistency
   - Register with CommandRegistry
   - Separate business logic from protocol handling

3. **Memoize expensive operations:**
   - Cache network requests
   - Cache calculations
   - Memoize expensive regexes

4. **Use structured logging with errors:**
   - Use error.toJSON() for consistent structure
   - Include context for debugging
   - Never log sensitive data

5. **Validate early, fail fast:**
   - Use ValidationError for input validation
   - Check preconditions before execution
   - Provide clear error messages

---

## Testing

All core modules include comprehensive test coverage:

```javascript
// Test error hierarchy
const error = new ValidationError('Test', { code: 'TEST_ERROR' });
expect(error.isRetryable).toBe(false);
expect(error.toJSON()).toHaveProperty('code');

// Test utilities
const memoized = memoize(() => computeExpensive());
memoized(); // Returns computed value
memoized(); // Returns cached value

// Test command handlers
const command = new TestCommand();
const result = await command.handle({ param: 'value' });
expect(result.success).toBe(true);
expect(result._metadata).toBeDefined();
```

---

## Performance Considerations

- **Memoization:** Reduce duplicate computations by up to 90%
- **Command Registry:** O(1) command lookup vs O(n) in switch statements
- **Utilities:** Single implementation vs scattered duplication
- **Error Classes:** Minimal overhead vs generic Error

---

## Troubleshooting

### Import Errors
```
Error: Cannot find module './src/core/errors'
```
Ensure `/src/core/` directory exists with all module files.

### Command Not Found
```
Unknown command: navigate
```
Register command with registry before execution.

### Retry Not Working
```
Command not retried after failure
```
Ensure `isIdempotent` is true on CommandHandler and command is registered as retryable.

---

## Contributing

When adding new modules to core:

1. Create file in `/src/core/`
2. Add exports to `index.js`
3. Add tests in `/tests/core/`
4. Update this README
5. Run full test suite

---

**Version:** 1.0.0  
**Last Updated:** June 13, 2026  
**Maintained By:** Basset Hound Team
