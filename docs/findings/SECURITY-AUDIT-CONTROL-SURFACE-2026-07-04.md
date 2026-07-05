---
title: "Security Audit — Control Surface"
date: 2026-07-04
auditor: "security-reviewer@basset-hound-browser:control-surface (read-only)"
status: Complete
category: security-findings
severity_counts: { critical: 1, high: 4, medium: 3, low: 3 }
---

# Security Audit — Basset Hound Browser Control Surface

> Read-only audit. No code modified. Feeds the Phase 2 security-hardening team.
> NOTE the design tension: SECURITY.md states "open access by design." The fixes below
> should HARDEN safely (default to loopback bind + wire the EXISTING PathValidator/SSRF guard)
> WITHOUT breaking the local-agent-driven flow — not force mandatory auth that breaks local scripts.

## Posture summary
Powerful control API (arbitrary JS, unrestricted navigation, arbitrary file write, cookie/session
dump, proxy reconfig) over a WS+HTTP server that **binds `0.0.0.0` unconditionally with auth OFF by
default** and is **published by docker-compose**. The codebase HAS good building blocks (PathValidator,
rate limiter, constant-time token compare, SSL enforcer, per-command authorizer) but the load-bearing
ones (path validation, per-command authz, host binding) are **not wired into the request path or are
overridden**. No SSRF guard at all. Dominant risk is architectural exposure, not third-party CVEs.

## CRITICAL
### C-1. Control API network-reachable + unauthenticated by default
- Hardcoded `0.0.0.0` bind: `websocket/server.js:1445` (`server.listen(port,'0.0.0.0')`), `:1495` (HTTPS), `:1269` (probe). Logs `ws://0.0.0.0` at `:1447,:1498`.
- Host config IGNORED: `config/defaults.js:11` (`host:'127.0.0.1'`) and `.env.prod.example:48` set loopback, but no `host` is passed to the constructor (`src/main/main.js:1062-1069`) and `server.js` never reads it — false assurance.
- Auth off by default: `server.js:939-940`, `src/main/main.js:1069`, `config/defaults.js:26`; when not required every client is auto-authed (`server.js:1548`), gate skipped (`server.js:1628-1632`).
- Docker publishes it: `docker-compose.yml:17-18` (`${WS_PORT:-8765}:8765`), token commented out (`:41`). Vendor acknowledges (`SECURITY.md:13`).
- Impact: anyone reaching 8765 → `execute_script`, `get_all_cookies`/`export_cookies` (`server.js:3182,:3254`), `navigate` to internal svcs, `save_screenshot_to_file` (arbitrary write), `set_proxy`.
- Fix: default `requireAuth` true OR refuse non-loopback bind without a token; actually consume `host` and default listen to `127.0.0.1` (explicit `BASSET_WS_BIND=0.0.0.0` to expose); docker publish `127.0.0.1:8765:8765`. Fail closed.

## HIGH
### H-1. SSRF via `navigate` — no scheme/host allow/deny-list
- `server.js:2764-2782`: only `new URL(url)` syntactic check. No block on `file://`, loopback, RFC1918, `169.254.169.254`. Repo-wide search for guards found none in the request path.
- Chained with get_page_content/execute_script → read `file:///etc/passwd`, `http://127.0.0.1:<admin>`, cloud metadata. Fix: SSRF guard per `docs/research/obscura/` (block non-http(s), loopback, link-local, RFC1918, metadata unless allowlisted); apply to navigate/navigate_tab/navigate_window + image/tech fetches.

### H-2. Arbitrary file write (path traversal) — PathValidator bypassed
- `screenshots/manager.js:396-421` `saveToFile()` writes with no validation; `websocket/commands/screenshot-commands.js:466-511` `save_screenshot_to_file` takes both attacker `imageData` + `filePath`; `server.js:4194/4227/4261/4321` pass user `savePath` through; `server.js:3278-3289` `export_cookies_file`→`cookies/manager.js:522` `fs.writeFile` unvalidated. `utils/path-validator.js` exists but only wired into `export-formats.js:108-109` + SSL cert load. Fix: route every param-derived write through `getPathValidator().validatePath(p,'write')`.

### H-3. Arbitrary file read — `import_cookies_file`
- `server.js:3291-3302` → `cookies/manager.js:547` `fs.readFile(filepath)` unvalidated. With C-1 = unauth local file read. Fix: `validatePath(p,'read')`, confine to allowed dir.

### H-4. `execute_script` = unsandboxed arbitrary JS; safe executor unused
- `server.js:3092-3112` → IPC `execute-in-webview` (`main.js:1267-1268`) → `renderer.js:646` `webview.executeJavaScript(script)`, no allowlist/sanitization. Mitigating: webview `nodeIntegration=no` (`renderer.js:92`), main `contextIsolation:true` (`main.js:770-771`) — runs in page context not Node. But arbitrary JS vs loaded origin (+ file:///internal via H-1). Hardened `src/execution/safe-js-executor.js` exists but NOT on this path. Electron `--no-sandbox` under Docker/root (`main.js:638-641,2828-2829`, `webPreferences.sandbox:false` `:774`). Fix: gate behind auth + permission level (M-2), keep Chromium sandbox where possible.

## MEDIUM
- **M-1.** Unauth HTTP endpoints `/metrics`,`/api/*`,`/health*` (`server.js:1344-1407`) — info disclosure. Require token for `/api/*`+`/metrics`.
- **M-2.** Per-command authorizer `src/auth/command-authorizer.js:309` is DEAD CODE (not referenced by server/dispatcher); dispatcher does no schema validation/authz — high-impact cmds treated like `status`. Wire it in + validate params vs `websocket/command-schemas.js`.
- **M-3.** Host/CORS config gives false assurance (`.env.prod.example:48,147`); no `Origin`/`verifyClient` check (`server.js:1521`). Honor host env + validate Origin.

## LOW
- **L-1.** Token compare leaks length via timing (`server.js:2439-2456`, timingSafeEqual throws on length mismatch → catch false). Hash both sides to fixed length first.
- **L-2.** `set_proxy` reachable unauth (C-1) → attacker MITMs all traffic. Creds themselves handled OK (`proxy/manager.js:251-256,324,543`).
- **L-3.** Deps small/modern (`package.json:72-94`); keep Electron patched given `--no-sandbox` renderer exposure.

## Remediation priority (for Phase 2 hardening team; owns server.js AFTER broken-commands agent releases it)
1. C-1: default loopback bind + wire `host` config + require token for network exposure + docker `127.0.0.1:` publish.
2. H-1: SSRF guard on navigate (adapt the Obscura design).
3. H-2/H-3: wire `PathValidator` into all param-derived file writes/reads.
4. M-2: wire the existing command-authorizer + schema validation into the dispatch path.
5. H-4/L-1/M-1/M-3: gate execute_script, fix token compare, protect /api + /metrics, validate Origin.
