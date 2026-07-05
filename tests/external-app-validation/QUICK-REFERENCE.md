# External App Validation - Quick Reference

## Run Validation (30 seconds)
```bash
cd /home/devel/basset-hound-browser
./tests/external-app-validation/run-all-validations.js
```

**Result:** Pass/Fail with reason

---

## What Gets Tested

| Test | What | Time | Critical |
|------|------|------|----------|
| Core Workflow | nav→extract→logs works | 1 min | YES |
| Response Schema | Responses match docs | 30 sec | YES |
| Connection Stability | 5+ min session stable | 5 min | Optional* |
| Rate Limiting | Limits enforced | 2 min | Optional* |
| Error Recovery | Reconnect works | 1 min | YES |

*Skipped by default for speed. Run with `SKIP_LONG_TESTS=false` for full test.

---

## Test Results

### All Pass ✓
External apps **CAN** use this system reliably.

### Some Fail ✗
External apps **CANNOT** use this system reliably. Fix issues first.

### What External Apps Can Assume
- Workflows work as documented
- Response format is stable
- Connections don't drop unexpectedly
- Rate limits work as described
- Recovery from errors is possible

---

## Common Issues

| Problem | Check | Fix |
|---------|-------|-----|
| "Connection refused" | Is server running? | Start WebSocket server |
| "Navigation failed" | Is Electron app running? | Start browser |
| "Schema mismatch" | Did code change? | Update tests or docs |
| "Rate limit not hit" | Timing test? | Usually OK, not a failure |

---

## For CI Integration

```bash
#!/bin/bash
./tests/external-app-validation/run-all-validations.js
if [ $? -eq 0 ]; then
  echo "✓ Ready for external integration"
  exit 0
else
  echo "✗ Fix issues before release"
  exit 1
fi
```

---

## Test Locations

- **Test runner:** `/tests/external-app-validation/run-all-validations.js`
- **Individual tests:** `/tests/external-app-validation/*.test.js`
- **Documentation:** `/EXTERNAL-APP-VALIDATION-GUIDE.md`
- **Full details:** `/VALIDATION-FRAMEWORK-SUMMARY.md`

---

## Environment Variables

```bash
WS_URL=ws://localhost:8765        # Server URL (default)
SKIP_LONG_TESTS=true|false        # Skip 5-min test (default: true)
```

---

## What This Answers

✓ "Can external apps use this reliably?"  
✓ "Will the API stay stable?"  
✓ "Will connections drop unexpectedly?"  
✓ "Is error recovery working?"  
✓ "Are responses formatted correctly?"  

---

**Read full guide:** `README.md` in this directory  
**For external devs:** `/EXTERNAL-APP-VALIDATION-GUIDE.md`  
**Technical details:** `/VALIDATION-FRAMEWORK-SUMMARY.md`
