# Path Validation - Quick Reference Guide

## Installation

Path validator is built-in to the application. No installation required.

## Basic Usage

### Get Singleton Instance

```javascript
const { getInstance } = require('../utils/path-validator');
const validator = getInstance();
```

### Validate a Single Path

```javascript
const result = validator.validatePath('/path/to/file.txt', 'write');

if (!result.valid) {
  console.error(`Validation failed: ${result.error}`);
} else {
  // Safe to use result.realPath
  fs.writeFileSync(result.realPath, data);
}
```

### Validate Multiple Paths

```javascript
const paths = ['/path/1', '/path/2', '/path/3'];
const results = validator.validatePaths(paths, 'write');

if (!results.valid) {
  console.log('Failed paths:', results.errors);
  console.log('Valid paths:', results.validPaths);
}
```

## Common Patterns

### Pattern 1: Safe File Write

```javascript
const { getInstance } = require('../utils/path-validator');

async function saveExport(filePath, data) {
  const validator = getInstance();
  const validation = validator.validatePath(filePath, 'write');

  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`);
  }

  const dir = path.dirname(validation.realPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(validation.realPath, data);
  return validation.realPath;
}
```

### Pattern 2: Safe File Read

```javascript
const { getInstance } = require('../utils/path-validator');

function readConfig(filePath) {
  const validator = getInstance();
  const validation = validator.validatePath(filePath, 'read');

  if (!validation.valid) {
    throw new Error(`Invalid file path: ${validation.error}`);
  }

  return fs.readFileSync(validation.realPath, 'utf8');
}
```

### Pattern 3: Using Wrapper Functions

```javascript
const { safeReadFile, safeWriteFile } = require('../utils/path-validator');

// Safe read
const readResult = safeReadFile('/path/to/file.txt');
if (readResult.success) {
  console.log(readResult.data);
} else {
  console.error(readResult.error);
}

// Safe write
const writeResult = safeWriteFile('/path/to/output.txt', 'content');
if (writeResult.success) {
  console.log(`Written to: ${writeResult.path}`);
} else {
  console.error(writeResult.error);
}
```

### Pattern 4: Command Handler

```javascript
server.commandHandlers.my_export = async (params = {}) => {
  const { output_path, data } = params;

  try {
    if (output_path) {
      const validator = getInstance();
      const validation = validator.validatePath(output_path, 'write');

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      fs.writeFileSync(validation.realPath, data);
      return {
        success: true,
        path: validation.realPath
      };
    } else {
      return {
        success: true,
        data: data
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

## Configuration

### Default Allowed Directories

```
$HOME/tmp
./tmp
./exports
./logs
./data
```

### Add Directory

```javascript
const validator = getInstance();
validator.addAllowedDir('/custom/export/dir');
```

### Remove Directory

```javascript
validator.removeAllowedDir('/custom/export/dir');
```

### Get Current Allowlist

```javascript
const dirs = validator.getAllowedDirs();
console.log('Allowed directories:', dirs);
```

## Monitoring

### Get Statistics

```javascript
const stats = validator.getStats();
console.log('Total validations:', stats.totalValidations);
console.log('Passed:', stats.passedValidations);
console.log('Failed:', stats.failedValidations);
console.log('Failure rate:', stats.failureRate);
console.log('Violations:', stats.violationCount);
```

### Get Violations

```javascript
// Get last 10 violations
const violations = validator.getViolations(10);

violations.forEach(v => {
  console.log({
    when: v.timestamp,
    what: v.reason,
    path: v.filePath,
    operation: v.operation
  });
});
```

### Listen to Events

```javascript
// Violation detected
validator.on('violation', (violation) => {
  console.error('SECURITY: Path validation violation', {
    reason: violation.reason,
    path: violation.filePath
  });
  // Send to security monitoring
});

// Directory added
validator.on('allowed-dir:added', (event) => {
  console.log('Directory added to allowlist:', event.directory);
});

// Directory removed
validator.on('allowed-dir:removed', (event) => {
  console.log('Directory removed from allowlist:', event.directory);
});
```

## Validation Operations

### Read Operations

```javascript
const validation = validator.validatePath(filePath, 'read');
// Use for: fs.readFileSync, fs.readFile, fs.access
```

### Write Operations

```javascript
const validation = validator.validatePath(filePath, 'write');
// Use for: fs.writeFileSync, fs.writeFile, fs.mkdirSync
```

### Delete Operations

```javascript
const validation = validator.validatePath(filePath, 'delete');
// Use for: fs.unlinkSync, fs.rmSync
```

## What Gets Rejected?

### Path Traversal
```javascript
validator.validatePath('/allowed/dir/../../etc/passwd', 'read');
// Result: { valid: false, error: 'Path is outside allowed directories' }
```

### Absolute Paths Outside Allowed Dirs
```javascript
validator.validatePath('/root/.ssh/id_rsa', 'read');
// Result: { valid: false, error: 'Path is outside allowed directories' }
```

### Null Bytes
```javascript
validator.validatePath('/allowed/file\0.txt', 'read');
// Result: { valid: false, error: 'Null byte detected in path' }
```

### Symlink Escapes
```javascript
// Symlink points outside allowed dir
validator.validatePath('/allowed/link', 'write');
// Result: { valid: false, error: 'Symlink target is outside allowed directories' }
```

## Error Handling

### Pattern: Graceful Error Handling

```javascript
async function exportData(filePath, data) {
  const validator = getInstance();
  const validation = validator.validatePath(filePath, 'write');

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      code: 'INVALID_PATH'
    };
  }

  try {
    const dir = path.dirname(validation.realPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(validation.realPath, data);
    
    return {
      success: true,
      path: validation.realPath
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      code: 'WRITE_FAILED'
    };
  }
}
```

## Testing

### Unit Tests

```bash
npx mocha tests/unit/path-validator.test.js --timeout 10000
```

### Integration Tests

```bash
npx mocha tests/integration/path-validator-integration.test.js --timeout 10000
```

### All Path Validation Tests

```bash
npx mocha "tests/unit/path-validator.test.js" \
         "tests/integration/path-validator-integration.test.js" \
         --timeout 10000
```

## Troubleshooting

### Path Validation Fails Unexpectedly

1. Check if directory is in allowlist:
   ```javascript
   const dirs = validator.getAllowedDirs();
   console.log(dirs);
   ```

2. Add directory if needed:
   ```javascript
   validator.addAllowedDir('/your/path');
   ```

3. Check for symlink issues:
   ```javascript
   const violations = validator.getViolations();
   console.log(violations);
   ```

### Performance Concerns

Use batch validation for multiple paths:
```javascript
// DON'T: Multiple individual validations
paths.forEach(p => validator.validatePath(p, 'write'));

// DO: Batch validation
validator.validatePaths(paths, 'write');
```

## API Reference

### Methods

| Method | Description |
|--------|-------------|
| `validatePath(path, op)` | Validate single path |
| `validatePaths(paths, op)` | Validate multiple paths |
| `addAllowedDir(dir)` | Add to allowlist |
| `removeAllowedDir(dir)` | Remove from allowlist |
| `getAllowedDirs()` | Get current allowlist |
| `getStats()` | Get validation statistics |
| `getViolations(count)` | Get recent violations |
| `clearViolations()` | Clear violation history |

### Helper Functions

| Function | Description |
|----------|-------------|
| `getInstance(options)` | Get singleton validator |
| `validateReadPath(path)` | Quick read validation |
| `validateWritePath(path)` | Quick write validation |
| `validateDeletePath(path)` | Quick delete validation |
| `safeReadFile(path, enc)` | Safe file read |
| `safeWriteFile(path, data)` | Safe file write |

### Events

| Event | Description |
|-------|-------------|
| `violation` | Path validation failed |
| `allowed-dir:added` | Directory added to allowlist |
| `allowed-dir:removed` | Directory removed from allowlist |

## Resources

- **Full Documentation:** `docs/SECURITY-PATH-VALIDATION.md`
- **Implementation Details:** `docs/PATH-VALIDATION-IMPLEMENTATION.md`
- **Unit Tests:** `tests/unit/path-validator.test.js`
- **Integration Tests:** `tests/integration/path-validator-integration.test.js`
- **Module Source:** `utils/path-validator.js`

## Security Best Practices

1. **Always validate user paths:** Never skip validation
2. **Use operation type correctly:** 'read', 'write', 'delete'
3. **Monitor violations:** Set up event listeners for violations
4. **Review statistics:** Check failure rates regularly
5. **Keep allowlist minimal:** Only add needed directories
6. **Log everything:** Maintain audit trail of all validations

---

**Version:** 1.0  
**Last Updated:** 2026-06-21
