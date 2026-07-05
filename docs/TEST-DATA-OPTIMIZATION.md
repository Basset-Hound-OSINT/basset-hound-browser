# Test Data Optimization Guide

## Overview

Large test data is a primary cause of heap exhaustion. This guide shows how to optimize test fixtures and data generation.

## Quick Reference

| Issue | Solution | Savings |
|-------|----------|---------|
| Array size 1M → 100K | Use `reduceTestData()` | 90% |
| Screenshot 5MB → 500KB | Use mock or compress | 90% |
| Batch 1000 items → 50 | Use `reduceBatchSize()` | 95% |
| Hold data between tests | Add afterEach cleanup | 50% |
| Unshared test fixtures | Use beforeEach factory | 80% |

## Pattern 1: Reduce Array Sizes

### ❌ Bad - Large data

```javascript
describe('Large dataset test', () => {
  const DATA = Array.from({ length: 1000000 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    data: 'x'.repeat(1000)
  }));

  it('should process array', () => {
    const result = processArray(DATA);
    expect(result.length).toBe(1000000);
  });
});
```

**Memory impact**: ~500MB for single test

### ✅ Good - Use memoryUtils

```javascript
const memoryUtils = require('../helpers/memory-utils');

describe('Large dataset test', () => {
  let DATA;

  beforeEach(() => {
    const fullData = Array.from({ length: 1000000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      data: 'x'.repeat(100)  // Reduce data per item
    }));
    
    // Limit to 10K items max
    DATA = memoryUtils.reduceTestData(fullData);
  });

  afterEach(() => {
    DATA = null;
    memoryUtils.clearCaches();
  });

  it('should process array', () => {
    const result = processArray(DATA);
    expect(result.length).toBeLessThanOrEqual(10000);
  });
});
```

**Memory impact**: ~50MB for single test

### Code Example

```javascript
// memory-utils.js
function reduceTestData(data) {
  if (!Array.isArray(data)) {
    return data;
  }

  // Limit array size
  if (data.length > CONFIG.MAX_ARRAY_LENGTH) {
    console.warn(`Reducing test data from ${data.length} to ${CONFIG.MAX_ARRAY_LENGTH}`);
    return data.slice(0, CONFIG.MAX_ARRAY_LENGTH);
  }

  return data;
}
```

## Pattern 2: Mock Large Objects

### ❌ Bad - Real screenshots

```javascript
describe('Screenshot test', () => {
  it('should capture screenshot', async () => {
    // This loads 5MB PNG into memory
    const realScreenshot = fs.readFileSync('./large-screenshot.png');
    const result = processScreenshot(realScreenshot);
    expect(result).toBeDefined();
  });
});
```

**Memory impact**: 5MB per test

### ✅ Good - Mock with minimal data

```javascript
describe('Screenshot test', () => {
  it('should capture screenshot', async () => {
    // Create minimal mock buffer (1KB)
    const mockScreenshot = Buffer.alloc(1024);
    mockScreenshot.fill(0xFF); // PNG header simulation
    
    const result = processScreenshot(mockScreenshot);
    expect(result).toBeDefined();
  });
});
```

**Memory impact**: 1KB per test

### Factory Pattern

```javascript
// Create reusable mock generator
const createMockScreenshot = (size = 'small') => {
  const sizes = {
    small: 1024,      // 1KB
    medium: 10240,    // 10KB
    large: 102400     // 100KB
  };
  
  const buf = Buffer.alloc(sizes[size]);
  buf.fill(0xFF);
  return buf;
};

describe('Screenshot processing', () => {
  it('handles small screenshots', () => {
    const screenshot = createMockScreenshot('small');
    expect(process(screenshot)).toBeDefined();
  });
  
  it('handles large screenshots', () => {
    const screenshot = createMockScreenshot('large');
    expect(process(screenshot)).toBeDefined();
  });
});
```

## Pattern 3: Batch Operation Sizing

### ❌ Bad - Unbounded batches

```javascript
describe('Batch processing', () => {
  it('processes 10000 items', () => {
    const items = generateItems(10000);  // 500MB+ memory
    const result = processBatch(items);
    expect(result.success).toBe(true);
  });
});
```

**Memory impact**: 500MB

### ✅ Good - Reduced batches

```javascript
describe('Batch processing', () => {
  it('processes batch items', () => {
    const batchSize = memoryUtils.reduceBatchSize(10000);
    const items = generateItems(batchSize);  // 25MB memory
    const result = processBatch(items);
    expect(result.success).toBe(true);
  });
});
```

**Memory impact**: 25MB

### Implementation

```javascript
function reduceBatchSize(batchSize) {
  const reduced = Math.min(batchSize, CONFIG.MAX_BATCH_SIZE);
  if (reduced < batchSize) {
    console.log(`Reduced batch from ${batchSize} to ${reduced}`);
  }
  return reduced;
}
```

## Pattern 4: Proper Cleanup

### ❌ Bad - Global data accumulates

```javascript
describe('Memory leak test', () => {
  const CACHE = new Map();

  it('test 1', () => {
    CACHE.set('key1', generateLargeData()); // 50MB
  });

  it('test 2', () => {
    CACHE.set('key2', generateLargeData()); // +50MB = 100MB
  });

  it('test 3', () => {
    CACHE.set('key3', generateLargeData()); // +50MB = 150MB
  });
  // Data never cleaned up!
});
```

**Memory impact**: 50MB per test accumulates = 150MB

### ✅ Good - Cleanup hooks

```javascript
describe('Memory efficient test', () => {
  let cache;

  beforeEach(() => {
    cache = memoryUtils.createCache(100); // Max 100 items
  });

  afterEach(() => {
    cache.clear();
    memoryUtils.clearCaches();
  });

  it('test 1', () => {
    cache.set('key1', generateLargeData());
    // ~50MB in memory during test
  });

  it('test 2', () => {
    // Previous cache cleaned up (0MB)
    cache.set('key2', generateLargeData());
    // ~50MB in memory during test
  });

  it('test 3', () => {
    // Previous cache cleaned up (0MB)
    cache.set('key3', generateLargeData());
    // ~50MB in memory during test
  });
  // Total memory: 50MB max
});
```

**Memory impact**: Max 50MB instead of 150MB

## Pattern 5: Lazy Data Generation

### ❌ Bad - All data upfront

```javascript
describe('Many tests', () => {
  const FIXTURES = {
    users: Array.from({ length: 10000 }, createUser),      // 100MB
    posts: Array.from({ length: 10000 }, createPost),      // 100MB
    comments: Array.from({ length: 10000 }, createComment) // 100MB
  };

  // 300MB loaded even if only some tests use it!

  it('test 1', () => {
    expect(FIXTURES.users).toBeDefined();
  });

  it('test 100', () => {
    expect(FIXTURES.posts).toBeDefined();
  });
});
```

**Memory impact**: 300MB upfront

### ✅ Good - Lazy loading

```javascript
describe('Many tests', () => {
  let fixtures = {};

  // Lazy getters
  const getUsers = () => {
    if (!fixtures.users) {
      fixtures.users = Array.from({ length: 10000 }, createUser);
    }
    return fixtures.users;
  };

  const getPosts = () => {
    if (!fixtures.posts) {
      fixtures.posts = Array.from({ length: 10000 }, createPost);
    }
    return fixtures.posts;
  };

  afterEach(() => {
    fixtures = {};
    memoryUtils.clearCaches();
  });

  it('test 1', () => {
    expect(getUsers()).toBeDefined();  // Only loads users
  });

  it('test 100', () => {
    expect(getPosts()).toBeDefined();  // Only loads posts
  });
  // Memory: max 100MB instead of 300MB
});
```

**Memory impact**: ~100MB (only needed data)

## Pattern 6: Streaming Large Data

### ❌ Bad - Load all at once

```javascript
describe('Process file', () => {
  it('processes 1GB file', () => {
    const data = fs.readFileSync('/large/file.json'); // 1GB in memory!
    const result = processData(data);
    expect(result).toBeDefined();
  });
});
```

**Memory impact**: 1GB

### ✅ Good - Stream processing

```javascript
describe('Process file', () => {
  it('processes file in chunks', async () => {
    const stream = fs.createReadStream('/large/file.json');
    let processedCount = 0;

    for await (const chunk of stream) {
      processedCount += processChunk(chunk);
    }

    expect(processedCount).toBeGreaterThan(0);
  });
});
```

**Memory impact**: ~10MB (buffer size)

## Checklist for Test Data

- [ ] Arrays limited to 10,000 items (or less)
- [ ] Large objects mocked when possible
- [ ] Batch sizes capped at 50 items
- [ ] `afterEach` hook clears all caches
- [ ] No global data accumulation across tests
- [ ] Fixtures loaded lazily or per-test
- [ ] Screenshots/media use mocks or compression
- [ ] Memory report checked: `cat tests/results/memory-report.json`

## Memory Audit

Run memory audit on test file:

```bash
# Check memory usage per suite
npm test -- --logHeapUsage

# Review report
cat tests/results/memory-report.json | grep -A 20 "suites"

# Find problem tests (>100MB)
cat tests/results/memory-report.json | jq '.suites | sort_by(.heapMB) | reverse | .[0:5]'
```

## Expected Savings

By applying these patterns to a typical test suite:

| Optimization | Typical Savings |
|--------------|-----------------|
| Array size reduction | 300-500MB |
| Mock screenshots | 100-200MB |
| Batch size limiting | 50-100MB |
| Proper cleanup | 100-150MB |
| Lazy loading | 200-400MB |
| **Total** | **750-1350MB** |

This makes it possible to run full test suites in <2GB instead of crashing at 613MB.
