# Prune Execution Report — 2026-07-04

**Agent:** dev@basset-hound-browser:prune-execute
**Source of truth:** `docs/planning/PRUNE-MANIFEST.md` (executed EXACTLY, blind-safe set + PRESERVE move only)
**Result:** SUCCESS — 78 files deleted, 3 files moved, **0 files restored**. All three boot-safety gates GREEN post-prune. No `server.js` / `main.js` edits made. No git commits.

---

## 1. Boot-safety gate (mandatory)

A **baseline** was captured BEFORE any deletion to make every failure attributable.

| Check | Baseline (pre-delete) | Post-prune | Verdict |
| --- | --- | --- | --- |
| `start:headless` boots clean (isolated port, `ELECTRON_RUN_AS_NODE` deleted, throwaway `--user-data-dir`, process-group reaped) | reaches `Server initialized on port` | reaches `[WebSocket] Server initialized on port 8803`, WS answered | PASS |
| `npm run smoke:mvp` | 14/14 | **14/14 GREEN** | PASS |
| `python3 mcp/verify_e2e.py` | PASS (after 1 transient re-run) | exit **0**, all 6 assertions true | PASS |

- **Files restored: NONE.** No check failed on the pruned tree, so no `git checkout` / backup-restore was needed.
- Process hygiene verified: no stray Electron processes, no leftover `/home/devel/bhb-*` temp dirs after runs.

**Note on MCP verify flakiness (pre-existing, NOT caused by prune):** `mcp/verify_e2e.py` asserts
`extract_links.count == document.links.length` via an *exact* match between two separate calls. Wikipedia
lazy-loads anchors, so the count can differ by 1 between the two probes. This flaked once on the *baseline*
(count 460 vs dom 459) and passed on re-run; the post-prune run passed cleanly (459 == 459). `smoke:mvp`
avoids this by using a `[before, after]` window instead of exact match. This is a test-harness timing issue,
independent of the deletions.

---

## 2. Files DELETED (78 total)

Deleted in the manifest's dependency order (Section 5): **1A first** (removes the only non-test importers of
the `src/evasion/*` cluster), then 1B → 1G. Plain `rm` used (tracked files stay `git checkout`-restorable;
all 78 also backed up to scratchpad first, since 3 targets were git-untracked and thus not `git checkout`-restorable).

### 1A — Unregistered evasion handler/command files (4)
- `websocket/handlers/behavioral-simulator-handler.js`
- `websocket/handlers/device-fingerprinter-handler.js`
- `websocket/commands/coherence-check.js`
- `websocket/commands/coherence-validation-commands.js`

### 1B — `src/evasion/*` simulator/coherence/fingerprint cluster (33)
audio-context-evasion, battery-api-evasion, behavioral-micro-timing, behavioral-simulator,
bluetooth-api-evasion, coherence-manager, coherence-validators, detection-service-testing,
device-fingerprint-database, device-fingerprinter, fingerprint-profiles, fingerprint-template-cache,
fingerprint-validator, font-enumeration-evasion, geolocation-spoofer, http2-header-ordering,
http2-priority-manipulation, multi-layer-coordinator, network-obfuscation, notification-api-evasion,
plugin-enumeration-evasion, preloader, sensor-api-evasion, session-coherence, timing-randomization,
tls-cipher-rotation, tls-extension-ordering, tls-fingerprinting, tls-version-evasion,
vendor-detection-evasion, vibration-api-evasion, webgl-detection-v2, webrtc-evasion (all under `src/evasion/`).
`src/evasion/` is now empty (preserve trio moved out — Section 3).

### 1C — v12.9.0 orphans (4)
- `src/v12-9-0/evasion-handler.js`  *(untracked)*
- `src/v12-9-0/evasion-websocket-commands.js`  *(untracked)*
- `src/v12-9-0/features/export-handler.js`
- `src/v12-9-0/features/export-websocket-commands.js`

### 1D — Out-of-scope proxy orphans (3)
- `websocket/handlers/proxy-handler.js`
- `src/proxy/residential-proxy-manager.js`
- `proxy/exit-node-cache.js`

### 1E — Dead recording/session files (6) — distinct from the LIVE recording set
- `src/recording/event-logger.js`
- `src/recording/recorder.js`
- `src/recording/session-playback.js`
- `src/recording/streaming-recorder.js`
- `src/session/session-recorder.js`
- `src/session/session-manager.js`

### 1F — Mock/archived "MCP" tests (4) — real MCP (`mcp/server.py`) untouched
- `tests/unit/mcp-server.test.js`
- `tests/archives/exploration-tests/haiku-mcp-integration.test.js`
- `tests/archives/exploration-tests/mcp_integration_test.py`
- `tests/archives/exploration-tests/production_validation_mcp.py`

### 1G — Companion tests / test-hygiene (24: 10 explicit + `tests/evasion/` = 14)
- `tests/evasion/` — whole directory (14 files: advanced-evasion-comprehensive, advanced-evasion,
  advanced-evasion-vectors, behavioral-simulator, bug-fix-validation, **canvas-fingerprinting-v2**,
  device-fingerprinter, evasion-extended-http2, evasion-extended-network, evasion-extended-timing,
  evasion-extended-tls, plugin-enumeration-evasion, vendor-detection-evasion, webgl-detection-v2 `.test.js`)
- `tests/p3-002-session-coherence-edge-cases.test.js`
- `tests/phase3/session-coherence.test.js`
- `tests/phase3/coherence-validators.test.js`
- `tests/phase3/fingerprint-profiles.test.js`
- `tests/features/session-coherence-validation.test.js`
- `tests/performance/evasion-preload.test.js`
- `tests/unit/evasion/fingerprint-validator.test.js`
- `tests/real-world/validation-framework.js`
- `tests/v12-9-0/evasion-handler.test.js`  *(untracked)*
- `tests/integration/advanced-evasion-v2-integration.test.js` — per the manifest CAUTION note: imports the
  now-deleted `webgl-detection-v2.js`, so deleted regardless of the preserve move.

---

## 3. Files MOVED (PRESERVE trio → deferred research, git history preserved)

Moved via `git mv` (all three were tracked) to the manifest-recommended location
`docs/research/bot-detection/salvage/`:

| From | To |
| --- | --- |
| `src/evasion/canvas-fingerprinting-v2.js` | `docs/research/bot-detection/salvage/canvas-fingerprinting-v2.js` |
| `src/evasion/canvas-evasion.js` | `docs/research/bot-detection/salvage/canvas-evasion.js` |
| `src/evasion/webgl-evasion.js` | `docs/research/bot-detection/salvage/webgl-evasion.js` |

The live navigator-property stub (`renderer/renderer.js` → `src/preload/preload.js`) was NOT touched.

---

## 4. Regression-guard greps (Section 6) — all clean post-prune

- `grep -rn "src/evasion/" websocket/ src/main/ renderer/ src/preload/` → **NONE**
- `grep -rn "v12-9-0/evasion-handler\|features/export-handler" websocket/ src/` → **NONE**
- `grep -rn "residential-proxy-manager\|handlers/proxy-handler\|exit-node-cache" websocket/ src/main/ proxy/ src/proxy/` → **NONE**
- No stale requires of the deleted 1E recording/session files anywhere loaded → **NONE**

## 5. NOT touched (per manifest — LIVE / out of scope)

- **Recording subsystem (LIVE, Section 2 NEEDS-UNREGISTER-FIRST):** all 7 files present and untouched —
  `recording/{manager,session-recorder,replay,interaction-recorder}.js`,
  `src/recording/video-{encoder,storage,player}.js`. (Manifest corrected the roadmap: these are command-registered;
  deleting them breaks boot. Left for a separate reviewed change.)
- **v12.9.0 registered code (DO-NOT-DELETE):** `src/v12-9-0/forensic-analyzer.js`,
  `src/v12-9-0/compression-engine.js`, `websocket/commands/v12-9-0-integration-commands.js`,
  `websocket/commands/export-formats.js` — all present.
- `mcp/` (real thin MCP server), `websocket/server.js`, `src/main/main.js`, live root `evasion/*` — untouched.

## 6. Counts

| Category | Count |
| --- | --- |
| 1A handler/command | 4 |
| 1B `src/evasion/*` | 33 |
| 1C v12.9.0 orphans | 4 |
| 1D proxy orphans | 3 |
| 1E dead recording/session | 6 |
| 1F mock/archived MCP tests | 4 |
| **Subtotal (source/handler/mock — manifest's "~48")** | **54** |
| 1G companion tests (10 explicit + 14 in `tests/evasion/`) | 24 |
| **TOTAL DELETED** | **78** |
| MOVED (preserve trio) | 3 |
| RESTORED (boot-safety failures) | **0** |
| `server.js` / `main.js` edits | 0 |
| git commits | 0 |

> Arithmetic note: the manifest's Section 7 states "48" for the blind source/handler/mock set, but the sum of
> its own explicit 1A–1F lists is **54** (4+33+4+3+6+4). All 54 were listed by name and deleted; "48" is a
> manifest tally slip, not a scope change. 1G (companion tests) is explicitly "not counted in the 48".
