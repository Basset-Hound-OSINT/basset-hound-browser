# Export HAR/WARC Fix — Broken `getLogs()` Callers

**Date:** 2026-07-04
**Agent:** debugger (`export-har-fix`)
**Scope of change:** `network-analysis/manager.js` only (single additive method). `websocket/server.js` NOT touched.

---

## Root Cause

`export_format_har`, `export_format_warc`, and the other `export_format_*` commands
(plus the plugin network API) call `networkAnalysisManager.getLogs(filters)` and then
iterate the result as an **array** (`.map()`, `for..of`):

- `websocket/commands/export-formats.js` — 8 call sites: lines 76, 169, 243, 327, 465, 570, 579, 648
- `plugins/api.js:346` — `self.managers.network.getLogs()`

But `NetworkAnalysisManager` **had no `getLogs()` method at all**. The only related
method was `getRequests(filter)` (`network-analysis/manager.js:356`), which returns a
**wrapper object** `{ success, count, filter, requests: [...] }` — not an array.

Result: every `getLogs()` call threw `TypeError: networkAnalysisManager.getLogs is not
a function`, so `export_format_har` / `export_format_warc` were registered but
**guaranteed-broken** — worse than absent, exactly as flagged in
`docs/planning/FEATURE-COMPLETION-ROADMAP.md` §A3.

Note: the roadmap's suggested fix (rename the 8 call sites `getLogs` → `getRequests`)
would **still be broken**, because `getRequests()` returns an object, not the array the
converters iterate. The correct fix is to provide an array-returning `getLogs()`.

## The Fix

**File:** `network-analysis/manager.js`
**Added method:** `getLogs(filter = {})` — inserted immediately after `getRequests()`
(new code at approximately **lines 378–437**, directly before `getRequestDetails()`).

It is a non-invasive alias over the same `requestTracker` that `getRequests()` uses, but
returns a **plain `Array`** of flattened log entries whose field names match what the
exporters read:

- `startTime` / `timestamp` → ISO-8601 string derived from `timing.startTime`
  (so HAR `startedDateTime` is spec-valid, not a raw epoch number)
- `duration` ← `timing.duration`
- `contentLength` ← `responseSize` (exporters read `contentLength`; tracker stores `responseSize`)
- `mimeType` ← parsed from the response `Content-Type` header
- `headers` / `responseHeaders` ← HAR-friendly `[{ name, value }]` lists via the tracker's `headersToList()`
- `cached` ← best-effort `fromCache`
- passthrough: `id`, `url`, `method`, `resourceType`, `domain`, `status`, `statusCode`, `statusLine`, `error`

No edit to `export-formats.js` was needed — its callers already expect exactly this
array shape. This single method fixes all 8 export call sites **and** the
`plugins/api.js` caller without touching `websocket/server.js`.

`node -c network-analysis/manager.js` → **OK**.
`node -c websocket/commands/export-formats.js` → **OK** (unchanged, confirmed clean).

## Verification (isolated, headless)

Ran an isolated Electron main-process harness (throwaway `--user-data-dir` under
`/home/devel/bhb-har-verify`, `ELECTRON_RUN_AS_NODE` unset, `setsid` process group,
`DISPLAY=:1`, port 8765 confirmed free). It drives the **real production modules**:
a real `BrowserWindow` loads `https://en.wikipedia.org/wiki/Web_scraping` over
`session.defaultSession` (the exact session the manager's `webRequest` handlers
monitor), then the real `NetworkAnalysisManager.getLogs()` feeds the real
`registerExportFormatCommands` `export_format_har` / `export_format_warc` handlers.

Evidence:

```
startCapture: {"success":true,...}
stopCapture capturedRequests: 34
getLogs typeof: function | isArray: true | length: 34
HAR success: true | stats.entryCount: 34
HAR log.version: 1.0 | log.entries.length: 34
entry[0] startedDateTime: 2026-07-04T06:40:38.193Z
entry[0] request:  {"method":"GET","url":"https://en.wikipedia.org/wiki/Web_scraping","headers":9}
entry[0] response: {"status":200,"statusText":"OK","mimeType":"text/html","headers":29}
HAR file: .../capture.har | stats.entryCount: 34 | parsed entries from disk: 34
WARC success: true | recordCount: 34 | bytes: 11116
VERIFY_RESULT: PASS
```

HAR structural validation (parsed from the written file):
- `log.version` = `1.0`, `log.creator` = `{ name: "Basset Hound Browser", version: "1.0.0" }`
- **34 entries**, each with populated `request` + `response`
- status codes: `{ "200": 34 }`
- MIME types: `text/html:1, text/css:2, text/javascript:7, image/svg+xml:19, image/webp:4, image/png:1`
  — confirming real sub-resources captured, not just the main document
- Request headers (9) and response headers (29) populated per entry
- WARC output non-empty (34 records, well-formed `WARC/1.0` records)

**Before fix:** `export_format_har` → `TypeError: getLogs is not a function` (0 entries).
**After fix:** valid HAR 1.0 with **34 real captured entries**, request+response each.

## Cleanup

- Throwaway temp `/home/devel/bhb-har-verify` removed.
- No stray Electron/GPU processes left (process group reaped; `pgrep` clean).
- No git commits made.

## Files Changed

| File | Change |
|------|--------|
| `network-analysis/manager.js` | Added `getLogs(filter)` method (~lines 378–437) returning an export-friendly array |

No other files modified.
