---
title: "Phase 1 — Command-Surface Verification & Repair"
subtitle: "Turn 904 registered commands into a true, tested 'all tools working' map"
status: EXECUTABLE PLAN
date: 2026-07-04
author: planner@basset-hound-browser:phase1-command-verification-plan
scope: docs/architecture/SCOPE.md — deterministic capture/control tool; NO internal agents, NO AI/ML models, evasion deferred
sources:
  - docs/planning/PROJECT-STATUS-MATRIX.md   # authoritative "what actually works"
  - docs/planning/QA-VERIFICATION-PLAN.md    # §3 self-test recommendation is the seed of this plan
  - docs/findings/BROKEN-COMMANDS-FIX-2026-07-04.md
  - docs/findings/SHELL-VS-WEBVIEW-FIX-2026-07-04.md
  - docs/findings/MODULARIZE-server-js-2026-07-04.md   # the 904/934 split + file→handler ranges
acceptance: docs/planning/COMMAND-SURFACE-MAP.md (NEW) + `run_self_test` green + `npm run smoke:mvp` green + `mcp/verify_e2e.py` exit 0
---

# Phase 1 — Command-Surface Verification & Repair

## 0. The problem in one paragraph

`websocket/server.js` + the `websocket/commands/*` modules register **904 unique commands**
(934 total registrations, 30 duplicate last-writer-wins — per
`MODULARIZE-server-js-2026-07-04.md`). Only **~70** are PROVEN working
(`PROJECT-STATUS-MATRIX.md`). The middle **~830 are unverified**, and this session already
found that several "registered" commands were silently broken in ways a registration count
cannot see: reading the browser **shell** instead of the guest `<webview>`
(`extract_*`, storage, tech-detect), a **forensic double-registration** that shadowed
`get_cookies`, a **lossy response serializer** that dropped payload fields, and a
**wrong manager method name** (`getLogs` vs `getRequests`) that hard-errored HAR/WARC export.
Registered ≠ real. Phase 1 closes that gap: **every command classified, the high-value
broken ones fixed, the dead ones pruned, and the whole thing self-verifiable on demand from
inside the running browser.**

## 1. Principles (operator directives — these govern every decision below)

1. **Self-test-first.** The PRIMARY verification mechanism is an in-server `run_self_test`
   that drives real commands against a live page and returns a PASS/FAIL matrix. It extends
   the existing `HealthEndpointManager.registerCheck()` registry (`websocket/health-endpoint.js:52`,
   already wired at `server.js:364`). It is exposed three ways over **one** implementation:
   the WS command `run_self_test`, `GET /api/v1/diagnostics?selftest=1`, and
   `npm run smoke:mvp` (which becomes a thin client of it). See §4.
2. **No test-sprawl.** We do NOT accumulate hundreds of throwaway per-command scripts.
   Verification uses **exactly two durable artifacts** — one reusable driver harness
   (`scripts/verify/drive-commands.js`) and the in-server self-test registry — plus
   **ephemeral** JSON result files that are git-ignored and deleted at converge. Minimal
   feature checks live *inside* the self-test, not as lingering files.
3. **Programmatic inventory.** Enumerate all 904 commands from the registry itself, grouped
   by domain — never a hand-typed list (§3).
4. **Classify with evidence.** Every command is driven with representative params against a
   real page and labelled WORKS / BROKEN / STUB / DEAD-ALIAS / UNTESTABLE, each with a
   captured observable (§5).
5. **Repair the high-value broken, prune the dead.** Fix the commands an external agent
   actually needs; delete confirmed dead/stub so **registered == real** and the count is
   asserted by a gate (§6, §7).
6. **One convergent workflow, not reactive one-at-a-time spawning.** A staggered fan-out by
   command domain → repair by file-ownership → single converged map, with work-zone
   isolation and boot-contention staggering (§8). No ad-hoc "spawn an agent per bug."

---

## 2. Deliverables (what exists when Phase 1 is DONE)

| # | Artifact | Kind | Purpose |
|---|----------|------|---------|
| D1 | `docs/planning/COMMAND-SURFACE-MAP.md` | **doc (acceptance)** | Every one of 904 commands: domain, source file, classification, evidence, action. |
| D2 | `websocket/self-test/registry.js` (+ wiring) | **durable code** | In-server self-test registry; `run_self_test` WS command + `?selftest=1`. The canonical smoke set, server-owned. |
| D3 | `scripts/verify/enumerate-commands.js` | **durable tool** | Dumps the live registry → `command-inventory.json` grouped by domain (the §3 inventory). |
| D4 | `scripts/verify/drive-commands.js` | **durable tool** | The ONE reusable classifier: drives each command with representative params, emits classification + evidence. Replaces all throwaway scripts. |
| D5 | `scripts/verify/params.js` | **durable data** | Representative-params table, seeded from `websocket/command-schemas.js` (136 schemas) + curated overrides. |
| D6 | Fixes in `websocket/commands/*` + prunes | **code delta** | High-value BROKEN repaired; DEAD-ALIAS/STUB removed; registry count reconciled. |
| D7 | Updated `PROJECT-STATUS-MATRIX.md` counts | **doc delta** | Proven/broken/pruned counts refreshed to match the map. |

Ephemeral (git-ignored, deleted at converge, NOT deliverables): `command-inventory.json`,
`command-surface-raw.json`, per-domain result slices under `scripts/verify/out/`.

---

## 3. Inventory — enumerate 904 programmatically, grouped by domain (`enumerate-commands.js`, D3)

**Mechanism.** Boot the browser headless (or construct `WebSocketServer` with a mock
`mainWindow` under the Node-18 `File`-shim already documented in
`MODULARIZE-server-js-2026-07-04.md`), then read `server.commandHandlers` — the single
authoritative map every handler lands in (`dispatch.js:333` reads `this.commandHandlers[command]`).
Emit for each name: `{ name, sourceFile, domain, isDuplicateRegistration, hasSchema }`.

- `sourceFile` is resolved by instrumenting each `register*` call to tag the keys it adds
  (wrap `commandHandlers` in a `Proxy` whose `set` trap records the current registering
  module). This also yields the **duplicate-registration set** for free (any key `set` more
  than once) — the 30 last-writer-wins names, of which `start_recording`, `add_block_rule`,
  `get_memory_stats` are known examples; these are the prime DEAD-ALIAS suspects (§5).
- `hasSchema` = present in `websocket/command-schemas.js` (136 commands) → seeds params (§5).

**Domain buckets** (deterministic prefix/keyword + source-file mapping; the driver groups by
these). Approx. counts are estimates to be replaced by the real dump:

| # | Domain | Signature (prefix / keyword / file) | Primary source files | ~Value |
|---|--------|-------------------------------------|----------------------|:------:|
| A | Navigation & page lifecycle | `navigate, reload, go_back/forward, get_url, get_content, get_page_state, wait_*, stop` | core-cmds-01 | **P0** |
| B | Interaction | `click, fill, type_text, scroll, mouse_*, key*, hover, drag, select, focus, submit` | core-cmds-04/05 | **P0** |
| C | Extraction & tech-detect | `extract_*, detect_technologies, identify_cms/analytics, get_element_tree, inspect_element, analyze_page_structure` | core-cmds-06/07, extraction-commands, tech-detection | **P0** |
| D | Capture: screenshots & HTML | `screenshot, capture_*, capture_full_page, export_raw_html, dom_snapshot` | screenshot-commands, html-capture, image-commands, dom-snapshot | **P0** |
| E | DevTools & scripting | `execute_script, inspect_element, console extraction, CDP` | core-cmds-05, javascript-console-extraction | **P0** |
| F | Cookies & storage | `set/get_cookie(s), *_local_storage, *_session_storage, indexeddb, cookie jars, analyze_cookies` | cookie-commands, core-cmds-0x, forensic/network | **P1** |
| G | Session / state / profile | `*_session, save/restore_session_state, snapshot, *_profile, branch_session` | session-management, session-persistence*, profile-template | **P1** |
| H | Network & privacy | `set_proxy*, add/remove proxy, proxy_chain/pool, tor_*, user_agent, block/allow/header rules, throttling, anonymity` | core-cmds-03/04/11, core-tor-commands, anonymity, behavioral-anonymization | **P1** |
| I | Tabs & windows | `*_tab, *_window, broadcast_windows, window pool` | core-cmds-01/02 | **P1** |
| J | Recording & replay | `start/stop_recording, *_replay, step_replay, video_*, interaction recorder` | recording-commands, video-recording, core-cmds-07/08 | **P2** |
| K | Forensics & evidence | `forensic capture, *_evidence, evidence package, correlation, legal-compliance, capture_*_evidence, HAR/WARC, timestamp` | forensic-capture-command, forensic/**, export-formats | **P2** |
| L | Monitoring & change-detection | `add_monitor, competitor_*, change/anomaly, alerts, metrics, monitoring_*` | monitoring-*, competitor-monitoring, change-detection, core-cmds-10 | **P2** |
| M | Export & reporting | `export_format_*, export_template*, report_*, encrypted_export, batch_export` | export-formats, export-templates, report-generation, encrypted-export | **P2** |
| N | v12.9.0 features | compression / forensic-analyzer / collaboration commands | v12-9-0-integration, collaboration-commands | **P2** |
| O | Misc / admin | `status, health, updater, plugin_*, memory, dashboard, slack, credentials, fake_data, behavior_scoring, location` | updater, dashboard, slack-*, credentials, fake-data, behavior-scoring, location, core-cmds-09 | **P3** |

> **Note on domain↔file mismatch.** Domains do NOT map 1:1 to files — `core-cmds-06` holds
> both element-tree (C) and part of D; `core-cmds-01` holds nav (A) and tab-open (I).
> **Classification** groups by domain (read-only, no collisions). **Repair** groups by
> FILE (§8) so no two agents edit the same file. Both partitions are emitted by D3.

---

## 4. The self-test mechanism (D2) — PRIMARY verification, built first

The QA plan (`QA-VERIFICATION-PLAN.md §3`) already specifies this; Phase 1 builds it and
makes it the backbone. It is a small, in-scope addition: it only **calls existing proven
commands** — no models, no intelligence.

### 4.1 Registry (extends the existing HealthEndpoint registry)

- Add `websocket/self-test/registry.js`: a `SelfTestRegistry` with
  `registerSelfTest(name, domain, asyncFn)` and `run(filter)` → `{ results:[{name, domain,
  ok, observable, ms}], summary:{pass,fail,skip} }`.
- Keep it **off the readiness path.** A live navigation is too heavy for a K8s probe, so we
  do NOT overload `registerCheck` (that stays cheap/static). The self-test registry is a
  sibling, but reuses the same `{ok, message}` check contract so the two feel identical.
- Each self-test drives commands through the **in-process dispatch path**
  (`server.handleCommand({command, id, ...params})` from `dispatch.js:319`) against a
  **bundled loopback fixture page** (the same self-contained jQuery/Bootstrap form page
  `scripts/smoke-mvp.js` already builds) so checks are **hermetic** — no external-network
  dependency, deterministic markers, cross-checkable (`execute_script` reads a DOM fact,
  the capture command must match it — the strongest single proof, per BROKEN-COMMANDS-FIX).

### 4.2 Three entry points, one implementation

| Entry point | Wiring | Use |
|-------------|--------|-----|
| WS `run_self_test` | new handler in `setupCommandHandlers`; params `{domain?, verbose?}` → matrix | agents / palletai / on-demand |
| `GET /api/v1/diagnostics?selftest=1` | branch in `diagnostics-api.js` (routes on `req.url`, `diagnostics-api.js:70`) → runs registry, returns JSON | ops / post-deploy curl |
| `npm run smoke:mvp` | rewrite `scripts/smoke-mvp.js` to **connect + send `run_self_test`** and print the table | CI / operator |

This yields the operator's outcome: **exactly one server-owned implementation of the smoke
set, invoked three ways** — no per-session throwaway driver lingers.

### 4.3 What goes IN the self-test vs the map

The self-test is the **shippable core gate**, not a home for all 904 checks. Only
**WORKS-classified P0/P1** commands are promoted into it (target ~40–60 checks: the Tier-A/B
set + each domain's proven representatives). Everything else lives classified in the MAP
(D1). Rule: a command is promoted iff it is hermetic (drivable against the fixture with no
external resource) and WORKS. `mcp/verify_e2e.py` stays as the MCP-layer counterpart
(it proves the adapter, which an in-server self-test cannot reach) — extend it to the
interaction tools while here.

---

## 5. Auto-test & classification (`drive-commands.js` D4 + `params.js` D5)

**One driver, run per domain.** It reads `command-inventory.json`, and for each command:
1. looks up representative params (`params.js`: schema-derived defaults from
   `command-schemas.js` `required`/`properties`/`default`, plus a curated override table for
   stateful commands — e.g. `get_cookies{url}` needs a prior `set_cookie`);
2. establishes preconditions (navigate the fixture / prior-command setup) per a small
   per-domain `setup()`;
3. dispatches over the **live WS API** and records the reply;
4. classifies:

| Label | Meaning | Detection signal | Action |
|-------|---------|------------------|--------|
| **WORKS** ✓ | round-trips against real DOM, observable asserts pass | success + cross-check matches (e.g. `extract_links.count === document.links.length`) | keep; promote P0/P1 to self-test |
| **BROKEN** ✗ | registered + reachable, errors or returns wrong/shell/empty data | error string, empty payload on a non-empty page, shell-HTML markers, `not available` | **repair** (§6) |
| **STUB** ◐ | returns success but does nothing real / placeholder / hardcoded | `TODO`/`not implemented`, static payload, no state change on readback | implement-or-prune decision |
| **DEAD-ALIAS** ⊘ | duplicate registration shadowed (last-writer-wins), or handler bound to an always-null manager | in duplicate set (§3) and the winner is a different domain; or `manager === null` always | **prune** / rename |
| **UNTESTABLE** ⊙ | real but unsafe to auto-drive (spawns Tor, needs a real proxy/download/external host) | requires external resource | flag for a **gated manual evidence run**, not a failure |

**Known bug classes to look for** (from this session — expect more of the same):

- **shell-vs-webview** — handler reads `this.mainWindow.webContents` (the empty shell)
  instead of the guest `<webview>` via `getWebviewPageContent()` /
  `get-page-content` IPC. Fixed already for `extract_*`; **still suspect**:
  `export_device_ids` (server.js ~8939), `modify_element` (~9061), and any other content
  handler grepping `outerHTML` off `mainWindow`. (`detect_technologies`/`identify_cms`/
  `identify_analytics`/`export_raw_html` were fixed per the matrix — re-confirm live.)
- **registration-shape / override shadow** — a later `register*` overwrites an earlier
  handler (the `get_cookies` forensic-override pattern, `BROKEN-COMMANDS-FIX §Bug 2`). The
  30 duplicate names are the starting DEAD-ALIAS list.
- **manager-null** — handler calls `this.someManager.x()` where the manager is never
  constructed → always `"... not available"`.
- **method-name mismatch** — handler calls a manager method that doesn't exist
  (`getLogs` vs `getRequests`, the HAR/WARC bug, `EXPORT-HAR-FIX-2026-07-04.md`).
- **lossy custom frame** — a handler that sends its own frame (not via `_sendResponse`)
  can still hit the old template-drop bug; verify id/payload survive.

**Boot-contention control.** Each driver run boots one headless browser on an isolated
ephemeral port (the `smoke-mvp` pattern: detached process group, throwaway `--user-data-dir`,
`kill(-pid)` reap). Runs are **staggered by wave** (§8), never all 15 domains at once.

---

## 6. Repair — fix the high-value broken

Repair is scoped to **P0/P1 BROKEN** first (an external agent's real needs), then P2 where
cheap. For each fix: apply the pattern (usually reroute to `getWebviewPageContent()`, restore
an overridden handler, correct a manager method name, or construct/guard a null manager),
then **prove it live** with the driver's cross-check, then **promote it into `run_self_test`**
if hermetic. Repairs are batched **by file** (§8) so the edit is a single coherent pass per
module — not one-command-at-a-time.

Fixes must not regress the 904→real count silently: every repaired command flips
BROKEN→WORKS in the map with new evidence; every pruned command is removed from both the
registry and the map's live count.

---

## 7. Prune — make `registered == real`

- **DEAD-ALIAS**: remove the shadowed registration (or rename the survivor to a documented
  distinct name, as was done with `get_cookies_network`). Start from the 30-name duplicate set.
- **STUB**: if P2/P3 and no consumer, delete; if P0/P1, ticket to implement (do not fake).
- **Out-of-scope** (evasion effectiveness, dark-web, proxy-intelligence, orchestration):
  already largely pruned; any survivors get removed or explicitly deferred with a reason.
- **Gate:** `enumerate-commands.js` re-run after prune must report the new lower count, and
  that number is asserted in the map header and in a CI check (`registered === real`).

---

## 8. The workflow — ONE convergent fan-out (not reactive spawning)

Three stages, staggered, work-zone-isolated. Orchestra discipline: each agent edits only its
work zone, READ-only elsewhere, NO commits.

### Stage 1 — Foundation (1 agent, runs ALONE first; everything depends on it)

Builds D2–D5: the self-test registry + `run_self_test`/`?selftest=1` wiring, the enumerator,
the driver, and the params table; produces the real `command-inventory.json` (904 grouped +
duplicate set + file-ownership map). **Work zone:** `websocket/self-test/**`,
`scripts/verify/**`, and the minimal wiring edits (`server.js` self-test handler line,
`diagnostics-api.js` selftest branch, `scripts/smoke-mvp.js` rewrite). Gate: `run_self_test`
returns the current proven core green; `smoke:mvp` still green; `mcp verify_e2e` exit 0.

### Stage 2 — Fan-out verification + repair (batched by WAVE, staggered)

Launched in value order. Within a wave, agents run **concurrently** but with staggered
browser boots. Two responsibilities per agent: (a) classify its domain via the driver,
(b) repair BROKEN + prune DEAD/STUB in the files it OWNS. **Ownership is by file** to
guarantee zero edit collisions:

| Wave | Domains | Owned files (repair work zone) | Why this wave |
|:----:|---------|--------------------------------|---------------|
| **W1** (P0) | A, B, C, D, E | `core-cmds-01/04/05/06/07`, `extraction-commands`, `tech-detection`, `screenshot-commands`, `html-capture-commands`, `image-commands`, `dom-snapshot-commands`, `javascript-console-extraction` | The capture/control core an agent needs; most already WORKS — lock them into `run_self_test`. Highest trust payoff. |
| **W2** (P1) | F, G, H, I | `cookie-commands`, `session-management`, `session-persistence*`, `profile-template-commands`, `core-cmds-02/03/11`, `core-tor-commands`, `anonymity-commands`, `behavioral-anonymization-commands` | State/privacy/tabs — the known repair-heavy wave (shell-vs-webview, session-switch no-op, override shadows). |
| **W3** (P2) | J, K, L, M, N | `recording-commands`, `video-recording-commands`, `forensic-capture-command`, `forensic/**`, `export-formats`, `export-templates-commands`, `report-generation`, `encrypted-export-commands`, `monitoring-*`, `competitor-monitoring-commands`, `change-detection`, `core-cmds-08/10`, `v12-9-0-integration-commands`, `collaboration-commands` | Forensics/monitoring/export — verify + heavy prune; HAR/WARC + registration reconciliation live here. |
| **W4** (P3) | O + residue | `updater`, `dashboard-commands`, `slack-*`, `credentials-commands`, `fake-data-commands`, `behavior-scoring`, `location-commands`, `core-cmds-09`, plus any straggler modules | Lowest value; mostly classify → prune stubs/dead-aliases → defer. |

- **Staggering rule:** at most **2 concurrent driver runs** (2 headless browsers) at a time;
  a wave's agents coordinate boot slots. This avoids the Electron-boot contention that made
  earlier ad-hoc runs flaky.
- **Contract:** each agent writes its slice to `scripts/verify/out/<domain>.json` (schema:
  the §5 classification row) — the converge step just concatenates.
- **No new throwaway scripts:** agents reuse `drive-commands.js`; any command-specific setup
  goes into that driver's per-domain `setup()` table, not a new file.

### Stage 3 — Converge (1 agent)

Merges all `out/*.json` into **`COMMAND-SURFACE-MAP.md`** (D1), dedups cross-domain rows,
re-runs `enumerate-commands.js` to assert `registered === real` post-prune, runs the full
acceptance gate (§9), promotes the final WORKS-P0/P1 set into `run_self_test`, updates the
status-matrix counts (D7), and **deletes the ephemeral JSON**. Only the two durable tools +
the in-server registry remain.

**Why this shape:** fan-out is bounded (15 domains → 4 waves), convergence is mechanical
(one JSON contract → one map), work zones never overlap (file ownership), and the browser
verifies itself (self-test) instead of leaving a debris field of scripts.

---

## 9. Acceptance criteria (Phase 1 is DONE when ALL hold)

1. **Every one of the 904 commands** appears in `COMMAND-SURFACE-MAP.md` with
   `{domain, sourceFile, classification, evidence-observable, action}`. No "unknown".
2. **`registered == real`**: DEAD-ALIAS/STUB pruned (or explicitly deferred with reason);
   `enumerate-commands.js` reports the reconciled count and the map header states it; a CI
   assertion guards it.
3. **`run_self_test` green** for every promoted command, exposed and passing via all three
   entry points (WS command, `?selftest=1`, `npm run smoke:mvp`).
4. **`npm run smoke:mvp` green** (now backed by `run_self_test`) and
   **`python3 mcp/verify_e2e.py` exit 0** and **`npm run start:headless`** boots WS cleanly.
5. **Every P0/P1 BROKEN found is either fixed (→WORKS with live evidence) or ticketed** with
   a root-cause and a repair note; no P0/P1 command is left silently broken.
6. **Only two durable verification artifacts remain** (`drive-commands.js`,
   `self-test/registry.js`); ephemeral result JSON removed; no per-command script debris.
7. **Docs reconciled**: `PROJECT-STATUS-MATRIX.md` proven/broken/pruned counts match the map.

---

## 10. Execution order & effort (quick reference)

| Step | Owner | Effort | Blocks |
|------|-------|:------:|--------|
| S1 Foundation (D2–D5 + inventory) | 1 agent | **L** | all of Stage 2 |
| W1 P0 verify+lock (A–E) | ≤2 concurrent | **M** (mostly confirm + promote) | — |
| W2 P1 verify+repair (F–I) | ≤2 concurrent | **L** (repair-heavy) | — |
| W3 P2 verify+prune (J–N) | ≤2 concurrent | **L** (prune + HAR/WARC + reconcile) | — |
| W4 P3 classify+prune (O) | 1–2 | **S–M** | — |
| S3 Converge + map + gate | 1 agent | **M** | needs W1–W4 slices |

Effort: **S** ≤ one verify pass; **M** params/state setup or light fixes; **L** structural
fixes / heavy prune / external-resource gating. Value: **P0** core capture/control an agent
needs → **P3** niche/prune-lean.

**Start condition:** Stage 1 only. Do not fan out Stage 2 until `run_self_test` exists and
the real `command-inventory.json` is produced — that inventory is the map's spine and the
fan-out's task list.
