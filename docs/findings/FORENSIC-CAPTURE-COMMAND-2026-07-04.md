---
title: Forensic Capture Command (Feature A) — Build + Live Verification
date: 2026-07-04
agent: js-dev@basset-hound-browser:forensic-capture
spec_ref: docs/planning/GUI-AND-SIMPLE-CAPTURE-PLAN.md (Feature A)
status: complete — all acceptance criteria met, live-verified
---

# Forensic Capture Command — Report

One-shot server-side `forensic_capture` WS command + thin Python client, built
exactly per the plan (Feature A). Orchestrates already-proven handlers; writes a
SHA-256-manifested evidence bundle through PathValidator. No scoring, no entity
extraction, no imports from `src/agents/*` or `src/features/ai-analysis.js`.

## Files changed (work zone only)
- **NEW** `websocket/commands/forensic-capture-command.js` (~330 lines incl. docs)
  — exports `registerForensicCaptureCommand(server, { networkAnalysisManager })`
  and (for testability) the pure `detectChallenge()`.
- `websocket/server.js` — **2 additive blocks only**: a `require` beside
  `registerExportFormatCommands` (L101) and a `registerForensicCaptureCommand(this, …)`
  call immediately after the export-format registration (L11781). No existing
  handler modified (verified by `git diff`).
- `scripts/smoke-mvp.js` — added `crypto` require, set
  `env.BASSET_ALLOWED_WRITE_DIRS = TMP_DIR` in the child launcher, and added one
  Phase-4 verification row.
- **NEW** `tmp/real_world_test/capture_client.py` — 19-line client (tmp/ is
  gitignored, file present on disk).

## Command design
Deterministic macro. Orchestration order (the core value — fixes the empty-HAR trap):
1. `start_network_capture` **FIRST** (webRequest hooks installed before any request
   fires; capture is not auto-started at boot).
2. `navigate(url)` (reuses the SSRF-guarded handler).
3. Settle: optional `wait_for_element(wait_for_selector)` + `settle_ms` (default 1500).
4. `get_url` → authoritative post-redirect final URL.
5. `export_raw_html` → raw HTML + statusCode + responseHeaders + contentType.
6. `screenshot` → base64 PNG decoded to bytes (never fails the capture; records a
   warning + writes `screenshot_note.txt` if no image bytes).
7. `get_all_cookies`.
8. `get_local_storage` + `get_session_storage` + `get_indexeddb` (origin-scoped).
9. `get_page_state` + `detect_technologies` + `extract_links/images/forms`.
10. `networkAnalysisManager.getLogs()` → in-memory HAR 1.0 + `network.json`
    (+ optional WARC).
11. SHA-256 every artifact (exact written bytes); ChainOfCustody + timeline via
    `ForensicAnalyzer`.
12. All writes through a dedicated `PathValidator` honoring `BASSET_ALLOWED_WRITE_DIRS`
    (the shared singleton uses default dirs and does NOT read that env var — so the
    command builds its own validator, mirroring `screenshots/manager.js`). Emits
    `manifest.json` (per-file `{name,sha256,bytes,mime,source_command,iso_ts}` +
    `bundle_sha256` tamper seal over stable `{name,sha256,bytes}` entries) and
    `chain_of_custody.json`.

**Hard rules honored:** never throws on a single missing sub-capture (→ `warnings[]`);
challenge DETECTION not bypass; small WS reply (bytes on disk, not in the frame).

### Challenge detection (detect-not-bypass)
`metadata.json` always carries `statusCode` + `challenge_suspected` + `challenge_reasons`.
Signals are PRECISE to avoid false alarms: challenge HTTP statuses (401/403/429/503),
redirect into a challenge URL path (`/sorry/`, `/cdn-cgi/challenge`, …), and
interstitial phrases / challenge-widget markers (`our systems have detected unusual
traffic`, `checking your browser before accessing`, `g-recaptcha`, `cf-challenge`,
`challenge-platform`, `datadome`, …). Bare `captcha` / body `/sorry/` substrings were
deliberately NOT used — Google's own bot-detection JS embeds `/sorry/index` and
`captcha` on every legitimate HTTP-200 SERP, which would flag every result page.
Unit-tested both directions (6/6 pass): clean SERP → false; 429 / `/sorry/` redirect /
Cloudflare interstitial / reCAPTCHA widget → true.

## Live verification — operator's real example
Launched a throwaway headless browser on a distinct free port (ELECTRON_RUN_AS_NODE
deleted, isolated `--user-data-dir`, detached process group), ran
`forensic_capture` on `https://www.google.com/search?q=department+of+state+news`
via the Python client, then reaped the process group. Bundle produced:

```
BUNDLE: capture_2026-07-04T20-19-18-901Z_66dda08d      (13 files)
  bytes  file
  523633 page.html
  364737 network.har        (71 HAR entries; main document status 200)
  286023 network.json
   81136 links.json
   40434 images.json
   26472 page_state.json
   21373 screenshot.png
    6616 forms.json
    3314 metadata.json
    3193 chain_of_custody.json
    3992 manifest.json
    1952 storage.json
    1918 cookies.json
    1825 technologies.json
```

- **HAR non-empty:** 71 entries (network capture started before navigate). ✓
- **statusCode:** 200; **title:** "department of state news - Google Search". ✓
- **challenge_suspected:** `false` — Google served a real results page, not a
  challenge; the refined heuristic correctly does not false-alarm. (Had Google
  served `/sorry/`, it would be `true`.) ✓
- **Hash determinism:** manifest `page.html` sha256
  `20949c49…c34165` == independent recompute over the on-disk bytes. ✓
- **PathValidator gate:** a call with `output_dir=/home/devel/outside_capture_dir`
  returned `success:false, error:"output_dir rejected by PathValidator: Path is
  outside allowed directories…", bundle_dir:null`, and no directory was created. ✓

## The <20-line Python client
`tmp/real_world_test/capture_client.py` (19 lines) — connects with `max_size=None`,
sends `forensic_capture`, id-correlates the reply (skipping event frames), prints
`bundle_dir` + the file list. Verified live against the running browser:
```
bundle_dir: …/capture_2026-07-04T20-19-18-901Z_66dda08d
files: ['page.html','screenshot.png','network.har','network.json','cookies.json',
        'storage.json','page_state.json','technologies.json','links.json',
        'images.json','forms.json','metadata.json','chain_of_custody.json']
```

## Smoke test
`npm run smoke:mvp` → **15/15 PASS** (was 14/14; new Phase-4 row
`forensic_capture (bundle + page.html sha256 determinism)` → PASS, "13 files,
page.html sha256 verified"). The row hashes the STABLE artifact (`page.html`), not
volatile metadata, per the hash-determinism rule. No standalone throwaway scripts
left behind; all live-verification scratch used `tmp/_scratch/` and was removed.

## Notes / caveats
- `node -c` passes on all changed JS; `py_compile` passes on the client.
- HAR is built in-memory from `getLogs()` (the export-formats `export_format_har`
  handler returns only stats — no `data` — when no `output_path`, so it cannot yield
  HAR bytes without an unvalidated write; a small HAR builder was inlined to keep all
  writes validated).
- The shared PathValidator singleton does not honor `BASSET_ALLOWED_WRITE_DIRS`; the
  command uses its own validator that does. Operational prereq documented in the
  client header + smoke setup.
- No commits made.
