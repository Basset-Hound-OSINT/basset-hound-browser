# Basset Hound Browser - TODO

**Last Updated:** January 31, 2026
**Version:** 11.0.0

## Current Status

**Project Status:** Feature Complete - Ready for Integration Testing
**Deployment Status:** Docker configuration validated, awaiting registry connectivity

---

## Immediate Tasks

### Infrastructure (Completed Jan 31, 2026)
- [x] Add Docker network `basset-hound-browser` to docker-compose.yml
- [x] Update deployment scripts (deploy.sh, redeploy.sh) for network
- [x] Update test files to output to `tests/results/`
- [x] Fix hardcoded `/app/node_modules/ws` paths in test files
- [x] Move session summaries to `docs/archive/`
- [x] Clean up root directory (remove buildlog.txt, move .txt files)
- [x] Update .gitignore for test outputs

### Integration Testing (Priority 1)
- [ ] Deploy Docker container with new network configuration
- [ ] Run comprehensive WebSocket API tests
- [ ] Test MCP server connectivity with palletai agents
- [ ] Validate bot detection evasion on real platforms

### Bot Detection Validation (Priority 2)
- [ ] Test against bot.sannysoft.com
- [ ] Test against browserleaks.com
- [ ] Test against fingerprintjs.com/demo
- [ ] Document evasion success/failure rates

---

## Deferred Tasks

### Memory Leak Fix
- [ ] Add cleanup for rate limit data in `websocket/server.js:313`
- [ ] Test long-running sessions for memory growth

### Test Coverage Gaps
- [ ] `tests/unit/tor-master-switch.test.js` - Test Tor mode switching
- [ ] `tests/unit/error-recovery.test.js` - Test retry logic
- [ ] `tests/unit/rate-limiting.test.js` - Test rate limit behavior

### Documentation
- [ ] `docs/features/rate-limiting.md` - Document rate limit configuration
- [ ] `docs/features/memory-management.md` - Document memory thresholds

---

## Completed (Recent)

### January 31, 2026 - Infrastructure Session
- Docker network `basset-hound-browser` added
- Test output paths standardized to `tests/results/`
- 9 test files fixed for portability (require('ws') instead of hardcoded paths)
- Deployment scripts updated with network support
- Root directory cleaned up

### January 21, 2026 - Tor Master Switch & Scope Cleanup
- Tor Master Switch implemented (ON/OFF/AUTO modes)
- Evidence system cleaned up (removed out-of-scope commands)
- MCP server verified (164 tools)
- Deployment testing completed (91% → 100% with timing)

---

## Project Metrics

| Metric | Value |
|--------|-------|
| WebSocket Commands | 164 |
| MCP Tools | 166 |
| Unit Tests | 680+ |
| Phases Complete | 12 (19-31) |
| Docker Config | Valid |
| Network | `basset-hound-browser` |

---

## Next Release Criteria

For v11.1.0 release:
1. Docker deployment verified working
2. Integration tests pass with palletai
3. Bot detection validated on real sites
4. No critical bugs discovered

---

*See [ROADMAP.md](ROADMAP.md) for full project history and architecture.*
