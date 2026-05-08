# State Rollback - Quick Reference Card
**For:** Developers integrating state rollback into new commands

## TL;DR Pattern

```javascript
// Apply this pattern to any state-modifying command:

this.commandHandlers.my_command = async (params) => {
  // 1️⃣  VALIDATE (before snapshot)
  if (!isValid(params)) {
    return { success: false, error: 'Validation failed' };
  }

  // 2️⃣  SNAPSHOT (capture state)
  const snapshot = StateSnapshot.captureMyState(manager);
  this.stateManager.saveSnapshot(snapshot.id, snapshot);

  // 3️⃣  EXECUTE WITH ROLLBACK (try -> fail -> restore)
  const handler = new StatefulCommandHandler('my_command', this.stateManager);
  return await handler.executeWithRollback(
    async () => {
      // Your logic here
      return { success: true, result: ... };
    },
    snapshot,
    null,
    async (snapshot) => {
      // Optional: Custom rollback if needed
    }
  );
};
```

## Command Integration Checklist

- [ ] **Step 1:** Move all validation BEFORE snapshot
- [ ] **Step 2:** Create appropriate StateSnapshot
- [ ] **Step 3:** Save snapshot in state manager
- [ ] **Step 4:** Wrap logic in executeWithRollback
- [ ] **Step 5:** Add custom rollback if needed
- [ ] **Step 6:** Test with invalid inputs
- [ ] **Step 7:** Verify rollback works

## StateSnapshot Factory Methods

```javascript
// For proxy commands:
StateSnapshot.captureProxy(proxyManager)
// Returns: { type: 'proxy', config, torMode, torStatus }

// For navigation:
StateSnapshot.captureNavigation(mainWindow, currentUrl)
// Returns: { type: 'navigation', currentUrl, timestamp }

// For Tor mode:
StateSnapshot.captureTorMode(proxyManager)
// Returns: { type: 'tor_mode', torMode, torStatus, ... }

// For storage:
StateSnapshot.captureStorage(storageManager, origin, 'localStorage')
// Returns: { type: 'localStorage', origin, items: {} }
```

## Common Commands to Update (Priority Order)

### 🔴 CRITICAL (High Impact)
```javascript
set_proxy          // Changes network routing
set_tor_mode       // Changes security boundary
set_local_storage  // Modifies persistent data
set_session_storage // Modifies session data
set_user_agent     // Changes identity
```

### 🟡 HIGH (State Impact)
```javascript
set_proxy_list      // Changes rotation config
set_geolocation     // Changes location spoofing
set_headers         // Changes request headers
set_request_interceptor // Changes filtering
clear_cookies       // Destructive operation
```

### 🟢 MEDIUM (Configuration)
```javascript
enable_headless     // Changes render mode
add_script          // Injects runtime code
enable_devtools     // Changes debug state
```

## Error Handling

### When Command Fails with Rollback

```javascript
{
  success: false,
  error: "Description of what failed",
  rollbackAttempted: true,
  rollbackSucceeded: true  // or false
}
```

### Check Rollback Status

```javascript
if (result.rollbackSucceeded === false) {
  // Rollback failed - state may be corrupted
  logger.error('Rollback failed:', result);
  // Manual recovery may be needed
}
```

## StateRollbackManager API (Quick Reference)

```javascript
// Save snapshot
this.stateManager.saveSnapshot(id, snapshot);

// Restore snapshot
await this.stateManager.restoreSnapshot(id, customRestoreFn);

// Discard snapshot (after successful command)
this.stateManager.discardSnapshot(id);

// Transaction support
const txId = this.stateManager.beginTransaction();
// ... do work ...
this.stateManager.commitTransaction();
// or
await this.stateManager.rollbackTransaction();

// Register custom rollback handler
this.stateManager.registerRollbackListener('mystate', async (snapshot) => {
  // Custom rollback logic
});

// Get statistics
const stats = this.stateManager.getStats();
// { snapshotCount, maxSnapshots, totalSizeBytes, transactionDepth, listenerCount }
```

## Validation Examples

### ✅ CORRECT: Validate Before Snapshot

```javascript
// URL validation
try {
  new URL(url);  // Throws if invalid
} catch (error) {
  return { success: false, error: 'Invalid URL' };
}
// If we get here, URL is valid and no state changed yet
```

### ✅ CORRECT: Check Required Parameters

```javascript
if (!params.required_field) {
  return { success: false, error: 'required_field is required' };
}
// If we get here, validation passed and no state changed yet
```

### ✅ CORRECT: Multiple Validations

```javascript
if (!params.a) return { success: false, error: 'a required' };
if (!params.b) return { success: false, error: 'b required' };
if (typeof params.a !== 'string') return { success: false, error: 'a must be string' };
// All validations passed before snapshot
```

### ❌ WRONG: Snapshot Before Validation

```javascript
// DON'T DO THIS - wastes memory
const snapshot = StateSnapshot.capture...();
this.stateManager.saveSnapshot(snapshot.id, snapshot);

if (!isValid(params)) {
  return { success: false, error: 'Invalid' };
  // Snapshot is still in memory even though validation failed
}
```

### ❌ WRONG: Modifying State Before Snapshot

```javascript
// DON'T DO THIS - defeats purpose
this.state.value = 'temporary';  // State already changed!
const snapshot = StateSnapshot.capture...();  // Too late!
// If validation fails, original state is lost
```

## Debug/Monitor Commands

```javascript
// Check snapshot statistics
const stats = this.stateManager.getStats();
console.log(`Snapshots: ${stats.snapshotCount}/${stats.maxSnapshots}`);
console.log(`Memory: ${(stats.totalSizeBytes / 1024).toFixed(1)}KB`);

// List all snapshots
const snapshots = this.stateManager.listSnapshots();
snapshots.forEach(s => console.log(s.toString()));

// Check if rollback listeners are registered
const listeners = this.stateManager.rollbackListeners;
console.log('Registered listeners:', Array.from(listeners.keys()));
```

## Testing Checklist

For each command updated:

```javascript
// Test 1: Valid input succeeds
const result = await command(validParams);
assert(result.success === true);

// Test 2: Invalid input fails without state change
const before = captureState();
const result = await command(invalidParams);
assert(result.success === false);
const after = captureState();
assert(before === after); // State unchanged

// Test 3: Failed execution rolls back
const result = await command(paramsFailsDuringExecution);
assert(result.rollbackAttempted === true);
assert(result.rollbackSucceeded === true);

// Test 4: Memory doesn't grow unbounded
for (let i = 0; i < 100; i++) {
  await command(validParams);
}
const stats = stateManager.getStats();
assert(stats.snapshotCount <= maxSnapshots);
```

## Common Mistakes to Avoid

| Mistake | Problem | Fix |
|---------|---------|-----|
| Validate after snapshot | Wastes memory | Move validation before snapshot |
| Modify state before snapshot | Loses original state | Capture snapshot before modifications |
| Forget to discard snapshot | Memory leak | Let executeWithRollback handle it |
| Wrong snapshot type | Can't restore properly | Use correct factory method |
| Synchronous rollback for async state | State inconsistent | Make rollback async and await |
| No custom rollback for complex state | Incomplete restoration | Provide rollbackFn parameter |
| Ignore rollbackSucceeded flag | Silent failures | Check and log rollback status |

## Performance Tips

```javascript
// ✅ GOOD: Reuse existing snapshots
const snapshot = StateSnapshot.captureProxy(proxyManager);
// Use for multiple related operations

// ❌ BAD: Create too many snapshots
for (let i = 0; i < 1000; i++) {
  const snapshot = StateSnapshot.capture...();  // Excessive!
}

// ✅ GOOD: Use transactions for grouped changes
const txId = this.stateManager.beginTransaction();
// Multiple state changes
this.stateManager.commitTransaction();  // All or nothing

// ❌ BAD: Create snapshot but never use
const snapshot = StateSnapshot.capture...();
// ... then ignore rollback
```

## Reference: Navigate Command Implementation

The `navigate` command is a complete reference implementation:

```
Location: websocket/server.js lines 1609-1723

Key aspects:
✓ URL validation with try/catch
✓ StateSnapshot.captureNavigation()
✓ StatefulCommandHandler with custom rollback
✓ Custom rollback function navigates back
✓ Handles timeouts gracefully
✓ Returns proper rollback status

Use as template when updating other commands!
```

## Links to Full Documentation

- **Design:** `docs/STATE-ROLLBACK-DESIGN-2026-05-08.md`
- **Implementation Guide:** `docs/STATE-ROLLBACK-IMPLEMENTATION-GUIDE.md`
- **Completion Summary:** `docs/STATE-ROLLBACK-COMPLETION-SUMMARY.md`
- **Test Suite:** `tests/state-rollback-test.js`

## Support

For questions or issues:

1. Check the full Implementation Guide for detailed explanations
2. Review the navigate command implementation as reference
3. Run the test suite: `npm test -- tests/state-rollback-test.js`
4. Check state manager stats: `stateManager.getStats()`
5. Review rollback listeners: `stateManager.rollbackListeners`

---
**Last Updated:** May 8, 2026  
**Version:** 1.0  
**Status:** Production Ready
