# Basset Hound Browser - Full Deployment & Testing Plan
**Date:** 2026-05-08  
**Goal:** Deploy Docker container, run all tests, validate real-world functionality  
**Duration:** ~2-3 hours continuous execution  

---

## Context

Phase 2 development is complete (8 tracks, 325+ tests, 10,500+ lines). The unit tests (1811+) are passing. But we haven't done a live deployment and real integration testing. The user wants everything deployed and tested end-to-end including Docker, website navigation, Tor, and bot evasion verification.

**Key facts discovered during planning:**
- Docker can be built with `docker build .` (installs Xvfb, Tor, all deps inside container)
- Healthcheck: `curl http://localhost:8765` expects HTTP 426 (WebSocket Upgrade Required)
- Browser starts WebSocket at port 8765 when `createWindow()` completes
- Docker entrypoint starts Tor first (up to 60s wait), then Xvfb, then Electron
- Auto-updater fails silently (owner/repo not configured) - non-blocking
- `BASSET_HEADLESS=true`, `ELECTRON_DISABLE_SANDBOX=1`, `DISPLAY=:99` needed

---

## Execution Plan (Sequential & Parallel)

### Phase 1: Pre-Flight & Setup (no browser needed)
1. Save this plan to `docs/archives/plans/2026-05-08_FULL-DEPLOYMENT-PLAN.md`
2. Run all no-browser-needed tests in parallel:
   - `npm run test:unit` (34 unit test files, 1811+ tests)
   - All Phase 2 evasion tests: advanced-evasion, behavioral-simulator, device-fingerprinter
   - Integration harness tests: protocol, extension-communication, extension-browser, scenarios
   - Agent/proxy/analysis tests: orchestration, residential-proxy, tech-detector
3. Capture unit test results to `tests/results/unit-test-results-2026-05-08.json`

### Phase 2: Docker Build & Deploy
4. Build Docker image: `docker build -t basset-hound:local .` with progress logging
5. Validate image built successfully (`docker images | grep basset-hound`)
6. Run container using `docker-compose up -d` (or manual docker run)
7. Wait for healthcheck to pass (HTTP 426 on port 8765) - up to 90 seconds
8. Verify WebSocket accepting connections (`nc` or Node.js WebSocket)

### Phase 3: Live Integration Testing
9. Run deployment integration test: `node tests/deployment/integration-deployment-test.js`
10. Run WebSocket API command test: `node tests/test-client.js --test`
11. Run evasion client tests: `node tests/test-client.js --evasion`
12. Run Tor deployment tests: `jest tests/deployment/tor-docker-deployment.test.js`
13. Run any remaining integration tests that need browser: `jest tests/integration/navigation.test.js --testTimeout=60000`

### Phase 4: Real Website Navigation Testing
14. Navigate to `https://example.com` - verify content extraction, screenshot, JavaScript execution
15. Navigate to `https://httpbin.org/headers` - verify headers being sent
16. Navigate to `https://whatismyipaddress.com` - record IP info (before Tor)
17. Enable Tor mode, navigate to check.torproject.org - verify Tor routing working

### Phase 5: Bot Evasion Validation  
18. Run bot detection test suite: `node tests/bot-detection/detector-tests.js` (uses Playwright + Electron)
19. Use test-client `--evasion` mode to check browser fingerprint values
20. Verify: no `webdriver` flag, canvas noise active, WebGL spoofed, timezone randomized

### Phase 6: Tor-Specific Testing
21. Verify Tor is running inside container: `docker exec basset-hound curl -sx socks5://127.0.0.1:9050 https://check.torproject.org/api/ip`
22. Test Tor mode toggle via WebSocket: `set_tor_mode`, `get_tor_mode`, `tor_renew_circuit`
23. Navigate to a clearnet site with Tor enabled, verify exit node IP differs from real IP

### Phase 7: Performance & Stability Testing
24. Take 5 screenshots in rapid succession - verify <500ms each
25. Navigate to 5 different sites - verify <5s per navigation average
26. Run a 2-minute session with 20 commands - verify no memory leaks or crashes
27. Verify Docker container health status: `docker inspect basset-hound --format='{{.State.Health.Status}}'`

### Phase 8: Documentation & Finalization
28. Generate comprehensive test report from all runs
29. Update `docs/DEPLOYMENT-TESTING-GUIDE-2026-05-08.md` with live results
30. Create final session record at `docs/archives/session_records/2026-05-08_LIVE-DEPLOYMENT-TESTING.md`
31. Update `docs/TODO.md` with Phase 2 complete, Phase 3 next
32. Update `docs/ROADMAP.md` with deployment testing complete
33. Commit all testing artifacts, results, and documentation

---

## Critical Files

| File | Role |
|------|------|
| `Dockerfile` | Container build - installs Xvfb, Tor, Electron |
| `docker-compose.yml` | Container run config - port 8765, env vars, volumes |
| `docker-entrypoint.sh` | Startup script - Tor → Xvfb → Electron |
| `main.js` | Electron app entry point (WebSocket starts at line 977) |
| `websocket/server.js` | WebSocket server (164 commands) |
| `tests/test-client.js` | Live testing client with `--test`, `--evasion` modes |
| `tests/deployment/integration-deployment-test.js` | Full integration test vs live browser |
| `tests/bot-detection/detector-tests.js` | Bot detection validation (Playwright) |
| `config/env.js` | All `BASSET_*` environment variable mappings |

---

## Agents to Spawn

- **Agent 1 (background):** Unit tests runner - runs all no-browser tests in parallel
- **Main thread:** Docker build and deploy (sequential, must finish before live tests)
- **Agent 2:** Live integration tests once container is running
- **Agent 3:** Bot detection and evasion validation tests

---

## Known Blockers & Solutions

| Blocker | Solution |
|---------|---------|
| Xvfb not installed on host | Use Docker (Xvfb inside container) |
| Auto-updater fails at startup | Non-blocking, app continues; disable via config |
| Tor takes up to 60s to bootstrap | Docker entrypoint already handles this wait |
| Docker build takes 5-15 min | Run unit tests in parallel while building |
| Port conflict on 8765 | `docker-compose down` first, kill any existing processes |

---

## Success Criteria

- [ ] Docker image builds without errors
- [ ] Container starts and becomes healthy (HTTP 426 on port 8765)
- [ ] Unit tests: 1800+ passing (99%+ pass rate)
- [ ] Integration tests: WebSocket API responds to all commands
- [ ] Navigation: example.com loads, screenshot captured, content extracted
- [ ] Evasion: `navigator.webdriver` returns `false` or `undefined`
- [ ] Tor: check.torproject.org shows Tor IP
- [ ] Performance: navigation < 5s, screenshot < 500ms
- [ ] Full test run completes without container crash
- [ ] All results documented and committed

---

## Output Artifacts

1. `tests/results/unit-test-results-2026-05-08.json` - Unit test results
2. `tests/results/deployment/live-deployment-test-2026-05-08.json` - Live test results
3. `tests/results/deployment/bot-evasion-validation-2026-05-08.json` - Evasion results
4. `docs/archives/session_records/2026-05-08_LIVE-DEPLOYMENT-TESTING.md` - Session record
5. Git commit with all artifacts
