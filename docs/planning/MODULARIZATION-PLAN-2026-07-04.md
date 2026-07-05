# Modularization Plan — Split all files > 1200 lines (boot-safe)

**Author:** architect@basset-hound-browser:modularization-plan
**Date:** 2026-07-04
**Scope:** Plan ONLY. No code edits performed. Splits the 13 source files that exceed the
operator's hard **1200-line cap** into sibling modules each **< 1200 lines**, without breaking
any existing `require()` (public interface preserved) and without changing runtime behavior or
boot order.

> **Hard cap target:** every resulting `.js` file < 1200 lines. New module dirs are siblings of
> the file they came from. The original path always survives as either (a) a **thin barrel**
> re-exporting the new modules, or (b) the **same class file, now slimmer**, that `require()`s
> extracted helper modules. Either way `module.exports` shape is byte-identical to today.

---

## 0. Current state (verified line counts, 2026-07-04)

| # | File | Lines | Shape | Class(es) |
|---|------|------:|-------|-----------|
| 1 | `websocket/server.js` | 12096 | 1 monolith class + 3 support classes + module helpers | `WebSocketServer` (+ `StateSnapshot`, `StateRollbackManager`, `StatefulCommandHandler`) |
| 2 | `src/main/main.js` | 3104 | Electron entry, **no exports**, side-effectful | — |
| 3 | `proxy/tor-advanced.js` | 2874 | 1 class + data consts | `AdvancedTorManager` |
| 4 | `technology/fingerprints.js` | 1929 | **data file** + 6 fns | — |
| 5 | `recording/interaction-recorder.js` | 1727 | 4 classes + consts + conv. fns | `InteractionRecorder` (+3 models) |
| 6 | `extraction/manager.js` | 1555 | 1 class + parser re-exports | `ExtractionManager` |
| 7 | `renderer/renderer.js` | 1499 | **browser-side IIFE**, no exports | — |
| 8 | `monitoring/page-monitor.js` | 1497 | 1 class + consts | `PageMonitor` |
| 9 | `config/schema.js` | 1482 | **data file** (schema) + 5 fns | — |
| 10 | `extraction/image-metadata-extractor.js` | 1475 | 1 class + consts | `ImageMetadataExtractor` |
| 11 | `proxy/manager.js` | 1364 | 1 class + consts + singleton | `ProxyManager` |
| 12 | `evasion/fingerprint-profile.js` | 1278 | 2 classes + config consts | `FingerprintProfile`, `FingerprintProfileManager` |
| 13 | `network-forensics/forensics.js` | 1270 | 1 class + consts | `NetworkForensicsCollector` |

Module system is **CommonJS** (`require`/`module.exports`; `package.json` has no `"type":"module"`).
`package.json main` = `src/main/main.js`.

---

## 1. Classification

### A. PARALLEL-SAFE / INDEPENDENT (8 files) — one agent each, can run concurrently
Single clean `module.exports` barrel, no cross-file edit contention, not under active ownership:

- `technology/fingerprints.js`
- `recording/interaction-recorder.js`
- `extraction/manager.js`
- `monitoring/page-monitor.js`
- `config/schema.js`
- `extraction/image-metadata-extractor.js`
- `evasion/fingerprint-profile.js`
- `network-forensics/forensics.js`

### B. CAREFUL / STAGED (2 files) — dedicated single agent each, serial internal steps
- `websocket/server.js` (12k) — phased split by command-domain onto the **existing**
  `register*Commands(server)` pattern. Serial because every phase edits the same
  `setupCommandHandlers()` body (edit contention).
- `src/main/main.js` (3k) — staged by concern (IPC handlers → recovery → mode-config → guards).
  Serial (same file), boot-order-sensitive.

### C. OWNERSHIP HOLD — do NOT schedule yet (wait for release)
- `proxy/manager.js` — **privacy team editing right now.**
- `proxy/tor-advanced.js` — **privacy team editing right now.**
- `renderer/renderer.js` — **GUI team just modified; also structurally special (see §6).**

Plans for these 3 are documented (§5, §6) so the split is ready the moment the teams signal release,
but they are **excluded from all execution waves below**.

---

## 2. Boot-safety gate (per file + integration)

Every file split must pass, in order:

**Per-file syntactic gate (fast, parallel-safe, no browser):**
1. `node -c <each new file>` and `node -c <original barrel>` → all "OK".
2. **Require-resolution check** — resolves the barrel and asserts the export surface is unchanged:
   ```bash
   node -e "const m=require('./<path>'); console.log(Object.keys(m).sort().join(','))"
   ```
   Compare the printed key list against the pre-split baseline (capture it BEFORE editing). Must be identical.
3. `npx eslint <changed files>` (repo has `.eslintrc.json`) → no new errors.

**Integration gate (shared, SERIAL — needs a live browser on port 8765):**
4. `npm run smoke:mvp` → must stay **all-pass** (currently reported 15/15; the runner prints
   `<n>/<n> passed` — the pass count must equal the total and the total must not drop).
5. `python3 mcp/verify_e2e.py` → exit 0 (drives MCP → WS → live browser round-trip).

> The integration gate boots one browser bound to `:8765`. **Only one integration gate may run at a
> time** — parallel gates would collide on the port. Run steps 1–3 in parallel per agent; funnel
> step 4–5 through a single **merge/gate queue** (one file merged + integration-gated at a time).

---

## 3. PARALLEL-SAFE file plans (Wave 1)

General pattern for these 8: create a sibling directory `mkdir <name>/`, move cohesive blocks into
new files, rewrite the original path as a **thin barrel** (data files) or **slimmer class file that
requires helper modules** (class files). Extraction order per file is listed; `node -c` after each move.

---

### 3.1 `technology/fingerprints.js` (1929) — DATA FILE → barrel + partitioned data
`FINGERPRINTS` is a ~1795-line data object (lines 55–1849) of ~70 tech entries; `CATEGORIES`
(17–54); 6 tiny functions (`getFingerprints`, `getCategories`, `getFingerprint`,
`getTechnologiesByCategory`, `getTechnologyCount`, `searchTechnologies`, 1850–1918).

**New dir `technology/fingerprints/`:**
- `categories.js` → `CATEGORIES`.
- `data-frameworks.js` → react, vue, angular, svelte, nextjs, nuxtjs, gatsby, ember, backbone.
- `data-libraries.js` → jquery, lodash, underscore, momentjs, axios, threejs, chartjs, gsap.
- `data-css.js` → bootstrap, tailwindcss, bulma, materialui, foundation.
- `data-cms.js` → wordpress, drupal, joomla, shopify, wix, squarespace, ghost, magento, woocommerce.
- `data-servers-cdn.js` → nginx, apache, iis, litespeed, caddy, cloudflare, akamai, fastly, awscloudfront, jsdelivr, unpkg.
- `data-analytics.js` → googleanalytics, googletagmanager, mixpanel, hotjar, segment, amplitude, heap, plausible.
- `data-services.js` → recaptcha, hcaptcha, stripe, paypal, googlefonts, fontawesome, youtube, vimeo, googlemaps, mapbox, leaflet, facebookpixel, twitter, firebase.
- `data-backend.js` → php, aspnet, nodejs, ruby, django, flask, laravel.

Each data file: `module.exports = { react: {...}, ... };` (largest ≈ 300 lines, all < 1200).

**Barrel `technology/fingerprints.js`** (~120 lines): require all data files, build
`const FINGERPRINTS = { ...require('./fingerprints/data-frameworks'), ...data-libraries, ... };`
keep `CATEGORIES` (from `./fingerprints/categories`) and the 6 functions verbatim. Export:
`{ FINGERPRINTS, CATEGORIES, getFingerprints, getCategories, getFingerprint, getTechnologiesByCategory, getTechnologyCount, searchTechnologies }` — **unchanged**.

**Order:** create category+data files (copy blocks) → rewrite barrel to require+merge → delete inline
data → `node -c`. **Risk:** none (pure data). One-time check: `getTechnologyCount()` must equal the
pre-split count.

---

### 3.2 `recording/interaction-recorder.js` (1727) — barrel + split models/exporters
Consts (43–95); models `InteractionEvent` (96–150), `RecordingCheckpoint` (151–183),
`InteractionRecording` (184–359); `InteractionRecorder` (360–1606, **1246 lines** — too big);
convenience fns `record/stop/getRecording/clear` (~1607–1713). The recorder's tail
(`_generateSeleniumScript` 1240, `_generatePuppeteerScript` 1363, `_generatePlaywrightScript` 1475,
`_getEventComment` 1585, `_escape` 1606 = **~366 lines**) is pure code-gen.

**New dir `recording/interaction-recorder/`:**
- `constants.js` → `INTERACTION_TYPES`, `RECORDING_STATE`, `SENSITIVE_PATTERNS`.
- `models.js` → `InteractionEvent`, `RecordingCheckpoint`, `InteractionRecording`.
- `script-exporters.js` → the 5 generator functions as **pure fns** `buildSelenium(recording,opts)`,
  `buildPuppeteer(...)`, `buildPlaywright(...)`, `getEventComment(event)`, `escape(str)`.
- `interaction-recorder.js` → `InteractionRecorder` class **minus** generator bodies (~880 lines).
  Its `exportAsSelenium/Puppeteer/Playwright` methods delegate:
  `exportAsSelenium(o){ return buildSelenium(this.recording, o); }`.

**Barrel `recording/interaction-recorder.js`** re-exports all 11 names unchanged.

**Order:** constants → models → script-exporters → slim recorder → barrel. **Risk:** low; the
generators are self-contained. Verify a recording round-trips to each script format after split.

---

### 3.3 `extraction/manager.js` (1555) — slim class + per-domain extractor modules (delegation)
Single class `ExtractionManager extends BaseParser` (33–1543). Heavy per-domain methods are
effectively pure transforms of `(html, baseUrl)` using `this` helpers (`resolveUrl`, `getHostname`):
`extractMetadata` 230 (~164), `extractLinks` 405 (~158), `extractForms` 564 (~193),
`extractImages`+`parseSrcset` 758 (~189), `extractScripts`+`detectScriptLibrary` 949 (~137),
`extractStylesheets`+`detectCssFramework` 1087 (~145), `extractStructuredData` 1233 (~93).

**New dir `extraction/extractors/`** (each exports pure fns taking `(html, baseUrl, self)` where
`self` is the manager instance for `self.resolveUrl(...)`):
- `metadata.js`, `links.js`, `forms.js`, `images.js`, `scripts.js`, `stylesheets.js`, `structured-data.js`.

**Slim `extraction/manager.js`** keeps: constructor, `configureDomWait`, `detectIncompleteDom`,
`resolveUrl`, `getHostname`, `getStats`, `resetStats`, `extractAll`, `extractAllWithRetry`, and thin
delegating wrappers:
```js
extractLinks(html, baseUrl='') { return extractLinks(html, baseUrl, this); }
```
Result ≈ 470 lines. **Barrel export unchanged**: `{ ExtractionManager, OpenGraphParser,
TwitterCardParser, JsonLdParser, MicrodataParser, RdfaParser }` (parser re-exports keep their
current requires).

**Order:** extract one domain at a time (links → forms → images → scripts → stylesheets →
structured-data → metadata), `node -c` + a smoke `extract_all` check after each.
**Risk:** medium — `this`-binding. Delegation (pass `self`) avoids prototype surgery. Confirm
`extract_all` output is unchanged on a sample page.

---

### 3.4 `monitoring/page-monitor.js` (1497) — slim class + detector/report modules (delegation)
Class `PageMonitor` (59–1471). Extractable pure clusters:
- Change detection: `compareSnapshots` 498, `detectHashChanges` 570, `detectDOMChanges` 611,
  `detectTextChanges` 669, `detectAttributeChanges` 694, `detectStructureChanges` 729,
  `detectVisualChanges` 752, `deduplicateChanges` 795, `categorizeChanges` 810,
  `generateChangeSummary` 835, `calculateSignificance` 857 (**~360 lines**).
- Reporting: `exportChangeReport` 1090, `generateCSVReport` 1203, `generateHTMLReport` 1222,
  `generateMarkdownReport` 1264 (**~210 lines**).

**New dir `monitoring/page-monitor/`:**
- `constants.js` → `DETECTION_METHODS`, `CHANGE_TYPES`, `MONITOR_STATUS`.
- `change-detectors.js` → the detect/compare/dedupe/categorize/significance fns (pure).
- `report-generators.js` → the export/CSV/HTML/Markdown fns (pure).

**Slim `page-monitor.js`** keeps lifecycle (start/stop/pause/resume/schedule), `captureSnapshot`,
`checkForChanges` (delegates to detectors), notify, zones, stats, `cleanup` (~700 lines).
**Barrel export unchanged**: `{ PageMonitor, DETECTION_METHODS, CHANGE_TYPES, MONITOR_STATUS }`.

**Order:** constants → report-generators → change-detectors → slim class. **Risk:** medium; verify
`add_monitor` + `run_monitor_check` still produce identical change objects.

---

### 3.5 `config/schema.js` (1482) — barrel + per-section schema modules
`Types` (11–25), `field()` helper (26–46), `schema` (47–1309, 10 top-level sections each wrapped
`name: field({ type: OBJECT, properties: {...} })`), validators `validateField` 1310,
`getValueType` 1397, `validateConfig` 1412, `getDefault` 1431, `getSchema` 1456.

Sections (verified): `server` 49, `browser` 157, `evasion` 325, `network` 576, `logging` 777,
`automation` 916, `profiles` 1010, `headless` 1063, `memory` 1114, `updater` 1205.

**New dir `config/schema/`:**
- `field.js` → `Types` + `field()` + require of `defaults` (shared by all sections). Export `{ Types, field }`.
- `sections/server.js` … `sections/updater.js` (10 files) → each `module.exports = field({ ... });`
  using `const { field, Types } = require('../field'); const defaults = require(<same source as today>);`
  (largest, `evasion` ≈ 250 lines).

**Barrel `config/schema.js`** (~230 lines): require `field.js` + all 10 sections, assemble
`const schema = { server: require('./schema/sections/server'), ... };`, keep the 5 validator fns.
Export unchanged: `{ Types, schema, field, validateField, validateConfig, getDefault, getSchema, getValueType }`.

**Order:** `field.js` first (everything depends on it) → 10 section files → barrel. **Risk:** low, but
this file is required **early in `main.js` boot** — after split, run `npm run start:headless` boot
check (config parses) in addition to the standard gate. Confirm `getDefault('server.port')` etc.
resolve identically.

---

### 3.6 `extraction/image-metadata-extractor.js` (1475) — slim class + helper modules (delegation)
Class `ImageMetadataExtractor extends BaseParser` (69–1451). Clusters:
- Lazy loaders `_loadExifr/_loadExifReader/_loadTesseract/_loadSharp/_loadJimp` 106–207 (~100).
- EXIF/normalizers `_extractExifWithExifr` 353, `_normalizeExif` 387, `_extractGps` 437,
  `_extractWithExifReader` 465, `_normalizeIptc` 504, `_normalizeXmp` 536, `_normalizeArray` 563 (~232).
- OSINT `_extractOsintFromText` 781, `_extractOsintFromMetadata` 834, `generateOrphanData` 976 (~233).
- webContents capture `captureCanvasElements` 1015, `extractSVGElements` 1116,
  `extractFaviconAndOGImages` 1284 (**~417** — biggest, and naturally standalone: take `webContents`).

**New dir `extraction/image/`:**
- `lazy-loaders.js`, `exif-normalizers.js`, `osint-extractors.js`, `webcontents-capture.js`.

**Slim class** keeps constructor, `extract` 208, image ops (`_extractThumbnail`, `_getDimensions`,
`_generatePerceptualHash`, `_extractText`, `_detectFaces`), `_getSourceInfo`, `cleanup`, `getStats`
(~600 lines). **Barrel export unchanged**: `{ ImageMetadataExtractor, createImageExtractor,
DEFAULT_OPTIONS, IMAGE_ORPHAN_MAPPINGS }`.

**Order:** lazy-loaders → exif-normalizers → osint-extractors → webcontents-capture → slim class.
**Risk:** medium — the `_load*` methods cache module handles on `this`; keep them as methods OR pass
`self`. Verify `extract` on a sample image yields identical metadata.

---

### 3.7 `evasion/fingerprint-profile.js` (1278) — barrel + configs + injection-script + 2 classes
Config consts (16–273, ~257: `PLATFORM_CONFIGS`, `CHROME_VERSIONS`, `SCREEN_CONFIGS`,
`TIMEZONE_CONFIGS`, `HARDWARE_CONFIGS`, `CANVAS_NOISE_CONFIGS`, `WEBGL_NOISE_CONFIGS`,
`AUDIO_NOISE_CONFIGS`, `FONT_EVASION_CONFIGS`, `COMMON_DECOY_FONTS`); class `FingerprintProfile`
(275–1037, includes `getInjectionScript` 639–985 = **~346-line template string**); class
`FingerprintProfileManager` (1038–1264).

**New dir `evasion/fingerprint-profile/`:**
- `configs.js` → all 10 config consts.
- `injection-script.js` → `buildInjectionScript(profile)` (the 346-line template extracted from
  `getInjectionScript`).
- `fingerprint-profile.js` → `FingerprintProfile` minus the injection template (~416 lines);
  `getInjectionScript()` delegates to `buildInjectionScript(this)`.
- `profile-manager.js` → `FingerprintProfileManager` (~226).

**Barrel `evasion/fingerprint-profile.js`** re-exports all 11 names unchanged.

**Order:** configs → injection-script → profile class → manager → barrel. **Risk:** low; the
injection script is a self-contained string builder. Verify `getInjectionScript()` output byte-length
is unchanged for a fixed seed.

---

### 3.8 `network-forensics/forensics.js` (1270) — slim class + exporters module (delegation)
Class `NetworkForensicsCollector` (49–1250). Only ~70 lines over cap → **one extraction suffices**:
- Exporters `_exportJson` 1009, `_exportCsv` 1022, `_exportHtml` 1069, `_exportTimeline` 1185,
  `_summarizeTimelineEvent` 1206 (**~228 lines**) → `network-forensics/exporters.js` (pure fns of
  `(report, options)`). `exportForensicReport` delegates by format.

Result: `forensics.js` ≈ **1042 lines** (< 1200). If a safety margin is wanted, additionally move the
`analyze*` methods (`analyzeDnsQueries`, `analyzeTlsCertificates`, `analyzeWebSocketConnections`,
`analyzeHttpHeaders`, `analyzeCookies`) into `network-forensics/analyzers.js` (~200 more). **Export
unchanged**: `{ NetworkForensicsCollector, FORENSICS_TYPES, EXPORT_FORMATS }`.

**Order:** exporters.js → slim class (→ analyzers.js only if still tight). **Risk:** low.

---

## 4. CAREFUL / STAGED — `websocket/server.js` (12096)

**Anatomy:** module-scope helpers/consts (123–640), 3 support classes (643–1091: `StateSnapshot`,
`StateRollbackManager`, `StatefulCommandHandler`), class `WebSocketServer` (1092–12095). Inside it,
`setupCommandHandlers()` (2947–11851, **~8900 lines**) registers **~360 inline handlers** as
`this.commandHandlers.<name> = async (params) => {...}`. The tail of that method (10884–11851)
**already** delegates ~30 domains to `websocket/commands/*.js` via the established pattern:

```js
const { registerRecordingCommands } = require('./commands/recording-commands');
registerRecordingCommands(this.commandHandlers);          // or registerX(this, this.mainWindow)
```
where a module is `function registerX(server, mainWindow){ const h = server.commandHandlers || server; h.foo = async (p)=>{...}; }`.

**Strategy: extend that exact pattern to the ~360 still-inline handlers.** This is a proven,
low-risk transform. It must be **serial** (every step edits the same `setupCommandHandlers` body).

### Phase S0 — extract shared module scope (PREREQUISITE, linchpin)
Handler closures reference module-scope helpers. Those must become importable **before** any handler
moves out. Create `websocket/core/`:
- `url-guards.js` → `isOnionUrl` 197, `isTorModeEnabled` 211, `checkOnionWithoutTor` 225,
  `_ssrfEnvFlag`/`_isForbiddenIPv4`/`_ipv6ToBytes`/`_isForbiddenIPv6` 252–337, `validateNavigationUrl` 338.
- `timing.js` → `IPC_DEFAULT_TIMEOUT`, `ADAPTIVE_TIMEOUT_CONFIG`, `calculateAdaptiveTimeout` 442,
  `ipcWithTimeout` 488. (`humanDelay` is already imported from `../evasion/humanize` — leave as-is.)
- `retry.js` → `ERROR_RECOVERY_CONFIG` 123, `isRetryableError` 154, `isRetryableCommand` 166,
  `calculateRetryDelay` 175, `sleep` 184, `generateRecoverySuggestion` 574.
- `state-management.js` → `StateSnapshot`, `StateRollbackManager`, `StatefulCommandHandler` (643–1091).

`server.js` requires them back at top (`const { validateNavigationUrl } = require('./core/url-guards')`),
so existing references keep working. Removes ~950 lines and makes helpers reachable by command modules.
**Gate after S0.**

### Phases S1…Sn — extract inline handler clusters (SERIAL, gate after each)
Each cluster → `websocket/commands/core-<domain>-commands.js` exporting
`registerCore<Domain>Commands(server)`, and the inline block in `setupCommandHandlers` is replaced by
a `require()` + call. Command modules `require('../core/url-guards')` etc. for shared helpers, and reach
state via the passed `server` (`server.mainWindow`, `server.stateManager`, `server.logger`,
`server.commandHandlers`). Cluster map (line ranges approx, from the handler inventory):

| Phase | Module | Domain (handlers) | Approx range |
|------|--------|-------------------|-------------|
| S1 | `core-interaction-commands.js` | navigate, click, fill, get_content, screenshot, get_page_state, execute_script, wait_for_element, scroll, get_url | 2949–3351, 3536–3551 |
| S2 | `core-cookies-commands.js` | get_cookies…flush_cookies | 3352–3535 |
| S3 | `core-sessions-commands.js` | create/switch/delete/list/export/import_session… | 3552–3660 |
| S4 | `core-history-commands.js` | get_history…get_history_stats | 3661–3781 |
| S5 | `core-downloads-commands.js` | start/pause/resume/cancel/get_download… | 3782–3898 |
| S6 | `core-tabs-commands.js` | new_tab…tab_navigate | 3899–4267 |
| S7 | `core-utility-commands.js` | ping, status, getHealth, request_size_metrics | 4268–4375 |
| S8 | `core-screenshots-commands.js` | screenshot_full_page…screenshot_formats | 4376–4575 |
| S9 | `core-screen-recording-commands.js` | start/stop/pause/resume_recording, recording_sources/formats | 4576–4670 |
| S10 | `core-proxy-commands.js` | set/clear/get_proxy, proxy_list, rotation, test_proxy… | 4671–4844 |
| S11 | `core-tor-connection-commands.js` | connect/disconnect_tor, tor_status, connection_metrics, new_tor_identity, get_exit_ip | 4845–4981 |
| S12 | `core-tor-control-commands.js` | tor_enable…get_proxy_modes (routing, circuits, bridges, onion, isolation) | 4982–5757 (large — split into 2 modules if either exceeds 1200) |
| S13 | `core-useragent-commands.js` | set/get/rotate_user_agent… | 5758–5930 |
| S14 | `core-request-interception-commands.js` | set_request_rules…disable_request_interceptor | 5931–6216 |
| S15 | `core-blocking-commands.js` | enable/disable_blocking, block_rule, filter_list, whitelist | 6217–6344 |
| S16 | `core-input-commands.js` | key_press…get_mouse_position (keyboard+mouse) | 6345–6861 |
| S17 | `core-throttling-commands.js` | set_network_throttling…get_throttling_status | 6862–6955 |
| S18 | `core-geolocation-commands.js` | set/get_geolocation… | 6956–7098 |
| S19 | `core-headers-commands.js` | set/remove_request_header…header_profiles | 7099–7270 |
| S20 | `core-profiles-commands.js` | create/delete/get/list/switch_profile… | 7271–7425 |
| S21 | `core-storage-commands.js` | get/set/clear_local/session_storage, indexeddb… | 7426–7659 |
| S22 | `core-dom-inspector-commands.js` | inspect_element…get_element_children | 7660–7841 |
| S23 | `core-devtools-commands.js` | open/close_devtools, network/console logs | 7842–7936 |
| S24 | `core-scripts-commands.js` | create/update/delete/run_script… | 7937–8114 |
| S25 | `core-memory-commands.js` | get_memory_usage…check_memory | 8115–8320 |
| S26 | `core-recovery-commands.js` | get_recovery_config, is_command_retryable, retry_command | 8321–8413 |
| S27 | `core-technology-commands.js` | detect_technologies…identify_analytics | 8414–8570 |
| S28 | `core-extraction-commands.js` | extract_metadata…get_extraction_stats | 8571–8769 |
| S29 | `core-network-capture-commands.js` | start/stop_network_capture…security_headers_list | 8770–8918 |
| S30 | `core-export-commands.js` | export_raw_html, export_network_log, export_device_ids | 8919–9219 |
| S31 | `core-modify-element-command.js` | modify_element | 9220–9363 |
| S32 | `core-replay-commands.js` | interaction start/stop_recording + replay engine | 9364–9777 |
| S33 | `core-headless-commands.js` | get_headless_status…detect_headless_environment | 9778–9931 |
| S34 | `core-multiwindow-commands.js` | spawn_window…drain_window_pool | 9932–10235 |
| S35 | `core-logging-commands.js` | set/get_log_level, get_logs, log_stats | 10236–10310 |
| S36 | `core-profiling-commands.js` | start/stop_profiling, timers, metrics | 10311–10423 |
| S37 | `core-debug-commands.js` | memory-debug + enable/disable_debug, tracing, dump_state | 10424–10610 |
| S38 | `core-plugins-commands.js` | load/unload/reload_plugin… | 10611–10908 |
| S39 | `core-proxy-analytics-commands.js` | get_proxy_reputation, set_geo_lock, get_proxy_analytics | 10909–11140 |
| S40 | `core-checkpoints-commands.js` | create_session_checkpoint…export_checkpoint (branches, recovery) | 11141–11530 |
| S41 | `core-updates-commands.js` | check_for_updates…get_rollback_versions | 11531–11745 |

> **Duplicate-name caveat:** several names are registered twice (e.g. `start_recording` appears for
> screen recording S9 and interaction recording S32; `add_block_rule` in S14 and S15; `get_memory_stats`
> in S25 and S37). Preserve the **current last-writer-wins order** — keep the phases in ascending line
> order so the later registration still wins exactly as today. Do NOT reorder register calls.

### Phase S42 — slim the `WebSocketServer` core class (REQUIRED to hit < 1200)
After S0–S41, `server.js` still holds the core class (constructor + transport + auth + rate-limit +
heartbeat + `handleCommand` + a now-thin `setupCommandHandlers` that's just ~40 register calls).
Estimated ~1600 lines → still over cap. Extract as prototype-mixin/helper modules into
`websocket/core/`:
- `transport.js` ← `_createCompositeHttpHandler` 1523, `_startNonSSLServer` 1593,
  `_startWebSocketServer` 1642, `_loadSslCertificates` 2227, `isSslEnabled`, `getProtocol`,
  `getConnectionUrl`, `_isPortAvailable`, `_findAvailablePort`, `_ensurePortAvailability` (~900).
- `rate-limit.js` ← `initRateLimitData`…`cleanupRateLimitData`, `setRateLimitEnabled` (2681–2929, ~248).
- `heartbeat.js` ← `startHeartbeat`/`stopHeartbeat`/`_checkForZombieConnections` (2428–2540, ~110).

Attach via `Object.assign(WebSocketServer.prototype, require('./core/transport'), require('./core/rate-limit'), require('./core/heartbeat'))` (methods written as functions using `this`). Leaves the
core class file (`server.js` barrel) < 1200 with `module.exports = WebSocketServer` unchanged.

**Gate after every phase** (S0…S42). Because all phases touch `setupCommandHandlers`, run them with a
**single dedicated agent, sequentially**, each phase = 1 commit + full gate. Group into review
batches of ~6 phases for sanity, but keep edits serial.

---

## 5. CAREFUL / STAGED — `src/main/main.js` (3104)

Electron **entry point**, `package.json main`. **No `module.exports`** → no barrel; instead move
function *definitions* to sibling modules under `src/main/`, `require` them, and **call at the exact
same points** to preserve boot side-effect order. Extracted modules must be **side-effect-free at
require time** (define & export functions only; nothing runs on import).

**Boot-order-critical facts to preserve:**
- Early headless init (`initializeHeadlessModeEarly` 2842) runs **before** `app.whenReady()` (2907).
- GC tuning, lazy-manager registration, config parse (top ~30–159) run at module load.
- `createWindow` (786–1269) wires webContents + IPC; `setupIPCHandlers` (1300–2776) registers 195
  `ipcMain.handle/on` handlers.

**Staged extraction (serial, gate after each):**

| Stage | New module | Moves | Lines |
|------|-----------|-------|------:|
| M1 | `src/main/ipc/` (by domain: `navigation.js`, `cookies.js`, `sessions.js`, `screenshots.js`, `recording.js`, `proxy-ua.js`, `storage.js`, …) | the 195 handlers in `setupIPCHandlers` 1300–2776, grouped like the WS domains; `setupIPCHandlers()` becomes calls `registerNavigationIpc(ipcMain, ctx)` … | ~1476 |
| M2 | `src/main/session-recovery.js` | `initializeRecoveryPaths`, `createLockFile`, `removeLockFile`, `detectUncleanShutdown`, `saveSessionState`, `loadSessionState`, `clearSessionState`, `startAutoSave`, `stopAutoSave`, `offerRecovery`, `restoreSession` (182–429) | ~247 |
| M3 | `src/main/mode-config.js` | `getHeadlessOptions`, `getGuiOptions`, `configureHeadlessMode`, `getTorOptions`, `configureTorMode`, `getViewportConfig` (585–785) | ~200 |
| M4 | `src/main/runtime-guards.js` | `setupGlobalErrorHandlers` (430), `setupMemoryManager` (469) | ~150 |
| M5 (optional) | `src/main/window-factory.js` | `createWindow` (786–1269) as `createWindow(deps)` | ~483 |

`main.js` retains: module-load bootstrap (module resolution, headless early init, GC, config), the
`app.whenReady`/`app.on(...)`/`process.on(...)` lifecycle block (2904–3104), and thin wiring that
calls the extracted registrars. Target < 1200 after M1–M4 (M5 only if still over).

**Gate:** in addition to smoke + verify_e2e, each stage must pass `npm run start:headless` **boots
cleanly** (main entry is what boots) — this is the real regression surface for main.js.
Single dedicated agent, sequential (same file). **Do M1 first** (largest win); IPC handler groups map
1:1 to the WS domains so they're mechanical.

---

## 6. OWNERSHIP-HOLD plans (do NOT schedule — ready when released)

### 6.1 `proxy/manager.js` (1364) — privacy team (HOLD)
Class `ProxyManager` (79–1352) + consts + singleton. When released: `proxy/manager/` with
- `constants.js` (`PROXY_TYPES`, `PROXY_MODES`, `TOR_MASTER_MODES`),
- `tor-routing.js` (delegation targets: `enableTorRouting` 846…`getTorMasterMode`, `handleAutoModeNavigation` 1108, `getModeDescription` — ~500),
- `proxy-chain.js` (`setProxyChain` 1178…`clearProxyChain` — ~150),
- slim class keeps validate/format/set/clear/rotate/rotation/testProxy/connectTor basics.
Preserve exports `{ proxyManager, ProxyManager, PROXY_TYPES, PROXY_MODES, TOR_MASTER_MODES,
getTorManager, getProxyChainManager }` (singleton `proxyManager` must remain the same instance).

### 6.2 `proxy/tor-advanced.js` (2874) — privacy team (HOLD)
Class `AdvancedTorManager extends EventEmitter` (234–2862, ~54 methods) + data consts. When released:
`proxy/tor-advanced/` with `constants.js` (TOR_STATES/TRANSPORT_TYPES/ISOLATION_MODES/TOR_DEFAULTS/
EMBEDDED_PATHS/COUNTRY_CODES/BUILTIN_BRIDGES), and mixin modules by concern:
`process-lifecycle.js` (binary find, torrc gen, start/stop/restart, bootstrap parse, exit handlers),
`control-port.js` (connect/authenticate/sendCommand/newIdentity), `circuits.js` (circuit info/path/
node-info/close/rebuild), `geo-policy.js` (exit/entry countries, restrictions), `bridges.js`
(enable/add/disable/fetch/transport/isolation), `onion-services.js` (create/remove/list, onion-url,
onion-location), `status.js` (getStatus/isRunning/proxy config/bandwidth/consensus/relay-count).
`Object.assign(AdvancedTorManager.prototype, ...)`. Preserve exports incl. singleton
`advancedTorManager`. **~2874 → needs 3+ modules to clear 1200.**

### 6.3 `renderer/renderer.js` (1499) — GUI team (HOLD) — STRUCTURAL SPECIAL CASE
**Not a CommonJS module.** The entire file is one
`document.addEventListener('DOMContentLoaded', () => { ... })` closure (line 8→end). All functions
(`createTab`, `switchToTab`, `closeTab`, `navigateTo`, `setupNavigationListeners`, …) are **nested in
that closure** and read closure-scoped DOM consts (`tabsContainer`, `urlInput`, `btnBack`, …). They
**cannot** be moved to sibling files by plain `require` — they'd lose the closure scope, and the file
loads via `<script>`/`window.electronAPI`, not `require`.

**Approach when released (GUI team owns semantics):** the repo already extracts pure logic to
`renderer/gui-logic.js` (unit-tested, exposed as `globalThis.GuiLogic`). Continue that:
1. Move pure/DOM-agnostic helpers (`resolveNavigationUrl`, `escapeHtml`, URL/title formatting, tab-state
   reducers) into `renderer/gui-logic.js` (already loaded first) — these don't need the closure.
2. Split DOM-bound code into cooperating scripts that receive an explicit `ctx` object (the DOM refs)
   instead of relying on closure capture, e.g. `renderer/tabs.js`, `renderer/navigation.js`,
   `renderer/status.js`, each exposing `initTabs(ctx)` on a `window.RendererModules` namespace; the
   `DOMContentLoaded` handler builds `ctx` and calls each `init*`.
3. Load order in the HTML: `gui-logic.js` → module scripts → `renderer.js` (thin bootstrap).
**Gate:** `npm run start:gui` (or headless render smoke) — DOM wiring can't be caught by `node -c` alone.

---

## 7. ORDERED EXECUTION PLAN

> Integration gate (smoke + verify_e2e) is a **shared, serial** resource (one browser on :8765).
> Per-file syntactic gates run in parallel; merges + integration gates funnel through one queue.

### WAVE 1 — Parallel-safe (8 agents concurrent) — START NOW
Assign one agent per file (§3.1–§3.8). Each: capture export-key baseline → split → per-file syntactic
gate (node -c + require-key diff + eslint) → hand to merge queue.
- fingerprints.js, interaction-recorder.js, extraction/manager.js, page-monitor.js, config/schema.js,
  image-metadata-extractor.js, evasion/fingerprint-profile.js, network-forensics/forensics.js.
- **Merge/integration-gate queue order (serial):** forensics → fingerprint-profile → page-monitor →
  interaction-recorder → image-metadata-extractor → extraction/manager → fingerprints → **schema last**
  (schema is boot-critical: it also runs `start:headless` boot check). One `smoke+verify_e2e` per merge.
- **Resource staggering:** cap concurrent editing agents; the browser-backed integration gate is
  single-flight regardless of how many agents edit in parallel.

### WAVE 2 — `websocket/server.js` (1 dedicated serial agent) — may run in PARALLEL with Wave 1
Touches only `websocket/server.js` + new `websocket/core/*` + new `websocket/commands/core-*` files →
**no file overlap** with Wave 1, so it can start concurrently. But its integration gates share the
:8765 browser → interleave on the same queue. Order: **S0 (helpers) → S1…S41 (clusters, ascending line
order, preserve last-writer-wins) → S42 (core-class mixins)**. Gate after every phase.

### WAVE 3 — `src/main/main.js` (1 dedicated serial agent) — after Wave 2
No file overlap with server.js, but both are the highest-risk boot surfaces; sequence after server.js
to keep the boot-regression signal clean. Order: **M1 (IPC) → M2 (recovery) → M3 (mode-config) →
M4 (guards) → M5 if needed**. Gate = start:headless boot + smoke + verify_e2e per stage.

### WAVE 4 — OWNERSHIP-HOLD (BLOCKED) — schedule only on team release signal
- `proxy/manager.js`, `proxy/tor-advanced.js` — after **privacy team** releases (§6.1, §6.2). Run
  serially with each other (both touch the proxy/Tor surface + shared singletons).
- `renderer/renderer.js` — after **GUI team** releases; uses the structural IIFE approach (§6.3),
  gated with `start:gui`, not `node -c` alone.

### Global invariants for every wave
1. `module.exports` key set **unchanged** per file (require-key diff must be empty).
2. Singletons stay the same instance (`proxyManager`, `advancedTorManager`, `interactionRecorder`).
3. New modules are **side-effect-free at import** (esp. anything main.js loads at boot).
4. No behavior change — only relocation. Any duplicate-registration order is preserved.
5. Every merge is gated; the integration gate is single-flight on :8765.

---

## 8. Summary

- **8 parallel-safe files** (Wave 1): fingerprints, interaction-recorder, extraction/manager,
  page-monitor, config/schema, image-metadata-extractor, evasion/fingerprint-profile,
  network-forensics/forensics. Each = one agent; barrel/delegation split; `module.exports` preserved.
- **Monolith 1 — `websocket/server.js` (12k):** phased split onto the **existing**
  `register*Commands(server)` pattern. **S0** extracts shared module-scope helpers + support classes
  into `websocket/core/` (the linchpin that makes handlers importable); **S1–S41** peel ~360 inline
  handlers into ~41 `websocket/commands/core-*-commands.js` domain modules (serial — same
  `setupCommandHandlers` body; preserve last-writer-wins order); **S42** mixes transport/rate-limit/
  heartbeat out of the core class so `server.js` clears 1200 with `module.exports = WebSocketServer`
  intact. One dedicated serial agent, gate after every phase.
- **Monolith 2 — `src/main/main.js` (3k):** staged by concern, no barrel (entry point) — move function
  *definitions* to `src/main/ipc/*` (195 handlers), `session-recovery.js`, `mode-config.js`,
  `runtime-guards.js` (+ optional `window-factory.js`), calling them at the same points to preserve
  boot side-effect order; modules must be import-side-effect-free. Gate includes `start:headless` boot.
- **3 files HELD** (`proxy/manager.js`, `proxy/tor-advanced.js` — privacy team; `renderer/renderer.js`
  — GUI team, plus it's a DOM-closure IIFE needing a namespace refactor, not plain require). Plans
  documented (§6); excluded from Waves 1–3, scheduled in Wave 4 on release.
- **Boot-safety gate** per file: `node -c` + require-key-diff + eslint (parallel); integration gate
  `npm run smoke:mvp` (all-pass, count unchanged) + `python3 mcp/verify_e2e.py` (exit 0), single-flight
  on port 8765.
