---
title: "Security Hardening — Control Surface (Phase 2)"
date: 2026-07-04
author: "security-lead@basset-hound-browser:harden"
status: Complete
category: security-hardening
source_audit: docs/findings/SECURITY-AUDIT-CONTROL-SURFACE-2026-07-04.md
design_reference: docs/research/obscura/crates/obscura-net.md (§3 SSRF)
---

# Security Hardening — Basset Hound Browser Control Surface

Implements the **safe** hardening from the control-surface audit that **preserves the
open local-agent flow**. Per `SECURITY.md` ("open access by design") + operator decision:
`requireAuth` is left **OFF by default** and **no mandatory token** was added — the API stays
open on loopback. What changed is *reachability* (loopback bind), *SSRF*, and *filesystem*
confinement, all default-closed with explicit env opt-ins.

**Verification:** isolated headless Electron boot on a distinct WS port (18765), driven over the
loopback WebSocket API → **11/11 checks passed**. No auth was required to connect (open flow intact).
Process group reaped; no strays; port free after run.

---

## Fixes

### C-1 — Default the WS + HTTP listen address to loopback
The `host:'127.0.0.1'` config was ignored; the server hardcoded `0.0.0.0`. Now wired end-to-end.

| File | Line(s) | Change |
|------|---------|--------|
| `config/defaults.js` | 11-13 | Kept `host:'127.0.0.1'`; documented the `BASSET_WS_BIND` override. |
| `src/main/main.js` | 1067-1069 | Pass `host: serverConfig.host` into the `WebSocketServer` constructor options. |
| `websocket/server.js` | 1097 | `this.host = process.env.BASSET_WS_BIND \|\| options.host \|\| '127.0.0.1'` — loopback default, explicit env opt-in. |
| `websocket/server.js` | 1445 | Port-probe `_isPortAvailable` binds `this.host` (was `'0.0.0.0'`). |
| `websocket/server.js` | 1621, 1623 | Non-SSL `server.listen(port, this.host)` + log `ws://${this.host}`. |
| `websocket/server.js` | 1671, 1674 | HTTPS `httpsServer.listen(port, this.host)` + log `wss://${this.host}`. |
| `docker-compose.yml` | 17-21 | Publish `"${WS_BIND:-127.0.0.1}:${WS_PORT:-8765}:8765"` — host loopback only. |
| `docker-compose.yml` | 40-45 | Add `BASSET_WS_BIND=${BASSET_WS_BIND:-0.0.0.0}` so the app binds inside the container (isolated ns) while the host publish stays on 127.0.0.1. |

**Opt-in to expose:** set `BASSET_WS_BIND=0.0.0.0` (and, for Docker, `WS_BIND=0.0.0.0` to open the host publish).

**Evidence:** boot log `Listening on ws://127.0.0.1:18765`; `docker compose config` resolves the
published port to `host_ip: 127.0.0.1`. Auth stayed `disabled` (open flow preserved).

### H-1 — SSRF guard on navigate / navigate_tab / navigate_window
New guard modeled on the Obscura `obscura-net` design (single deny-set predicate reused for the
literal-host and DNS-resolution checks; IPv4-mapped IPv6 unwrapping; default-closed env escape hatch).

| File | Line(s) | Change |
|------|---------|--------|
| `websocket/server.js` | 234-402 | `_ssrfEnvFlag`, `_isForbiddenIPv4`, `_ipv6ToBytes`, `_isForbiddenIPv6`, `async validateNavigationUrl(url)`. |
| `websocket/server.js` | 2960-2966 | `navigate` handler: SSRF check (returns plain error object, preserving request id). |
| `websocket/server.js` | 4010-4014 | `navigate_tab` handler: SSRF check. |
| `websocket/server.js` | 10086-10090 | `navigate_window` handler: SSRF check. |

**Blocks (unless opted in):** non-http(s) schemes; `file://` (opt-in `BASSET_WS_ALLOW_FILE=1`);
loopback, RFC1918 (10/8, 172.16/12, 192.168/16), link-local `169.254.0.0/16` (incl. cloud metadata
`169.254.169.254`), unspecified/broadcast IPv4; `::1`, `::`, `fc00::/7` (incl. `fd00::/8`),
`fe80::/10`, and IPv4-mapped/compatible v6 forms — opt-in `BASSET_WS_ALLOW_PRIVATE_NETWORK=1`.
Hostnames are DNS-resolved and **every** returned address is deny-checked (DNS-rebinding defense);
`localhost`/`*.localhost` are rejected by name.

**Evidence:**
- Unit harness over `validateNavigationUrl` (13/13), incl. the `::ffff:127.0.0.1` mapped-v6 bypass
  (URL normalizes to `[::ffff:7f00:1]`) — correctly blocked.
- Live: `navigate file:///etc/passwd` → `success:false, "SSRF guard: file:// scheme is blocked…"`;
  `navigate http://169.254.169.254/` → blocked ("address … in a blocked range");
  `navigate http://127.0.0.1:22/` → blocked; `navigate https://example.com` → allowed + `get_content`
  returned the real "Example Domain" document.

*Scope note:* the guard runs pre-navigation. Redirect targets are then followed natively by the
Electron webview and are not re-validated per hop (the app has no interception layer on that path).

### H-2 / H-3 — Path validation on param-derived file writes/reads
Wired the existing `utils/path-validator.js` into every attacker-controllable file path.

| File | Line(s) | Change |
|------|---------|--------|
| `screenshots/manager.js` | 8, 15, 22-40 | Require `PathValidator`; `buildScreenshotAllowedDirs()` (screenshots/exports/data/tmp/downloads/`os.tmpdir()`, extend via `BASSET_ALLOWED_WRITE_DIRS`). |
| `screenshots/manager.js` | 97-98 | Construct `this.pathValidator`. |
| `screenshots/manager.js` | 424-448 | `saveToFile()` → `validatePath(filePath,'write')`, write to `realPath`. Covers all 4 `savePath` callers in server.js **and** `save_screenshot_to_file` (screenshot-commands.js:493) which routes through the same method. |
| `cookies/manager.js` | 5, 13-31 | Require `PathValidator`; `buildCookieAllowedDirs()`. |
| `cookies/manager.js` | 45-46 | Construct `this.pathValidator`. |
| `cookies/manager.js` | 537-544 | `exportToFile()` → `validatePath(filepath,'write')` (H-2). |
| `cookies/manager.js` | 576-583 | `importFromFile()` → `validatePath(filepath,'read')` (H-3). |

**Evidence:**
- Live `save_screenshot_to_file` with `filePath:'../../etc/x'` → `success:false,
  "Path validation failed: Path contains parent directory references"`; target file **not** created.
- Live in-bounds save `filePath:'tmp/verify-shot.png'` → `success:true` (legit usage still works).

### Structural fix — identify_cms / identify_analytics empty results
The detector emits `category` (singular string); the post-filters read `tech.categories` (array) →
always `undefined` → always empty.

| File | Line(s) | Change |
|------|---------|--------|
| `websocket/server.js` | 8488-8491 | `identify_cms` filter normalizes `tech.category` → `[tech.category]` (tolerates `categories` array too). |
| `websocket/server.js` | 8538-8541 | Same for `identify_analytics`. |

**Evidence:** unit test on a WordPress HTML snippet — detector yields
`category:'Content Management Systems'`; **fixed** filter → `['WordPress']`, **old** filter → `[]`.
Live `identify_cms` on example.com → `success:true, cms:[]` (no error; example.com has no CMS).

---

## Verification summary (isolated, headless, port 18765)

```
PASS  server boots + listens on loopback  ws://127.0.0.1:18765
PASS  ws connect on 127.0.0.1:18765 (no auth required — open flow intact)
PASS  navigate https://example.com (allowed)
PASS  get_content returns content (Example Domain)
PASS  navigate file:///etc/passwd BLOCKED
PASS  navigate http://169.254.169.254/ BLOCKED
PASS  navigate http://127.0.0.1:22/ BLOCKED
PASS  save_screenshot_to_file ../../etc/x REJECTED
PASS  traversal target file not written
PASS  save_screenshot_to_file to tmp/ ALLOWED
PASS  identify_cms returns array (filter fixed)
SUMMARY: 11/11 checks passed
```

Process group reaped (detached spawn + `kill(-pid)`), no electron strays, port 18765 free afterward,
temp confined to `/home/devel/bhb-verify/`.

## New environment variables
| Var | Default | Effect |
|-----|---------|--------|
| `BASSET_WS_BIND` | `127.0.0.1` | Listen address; `0.0.0.0` to expose on all interfaces. |
| `BASSET_WS_ALLOW_PRIVATE_NETWORK` | off | `1/true/yes/on` disables the SSRF private/loopback/metadata deny-set. |
| `BASSET_WS_ALLOW_FILE` | off | `1/true/yes/on` permits `file://` navigation. |
| `BASSET_ALLOWED_WRITE_DIRS` | — | Path-delimiter list of extra allowed dirs for cookie/screenshot file IO. |
| `WS_BIND` (compose) | `127.0.0.1` | Host interface for the published Docker port. |

## Out of scope (left for other agents / not touched)
H-4 (`execute_script` sandboxing), M-1 (`/api`,`/metrics` auth), M-2 (command-authorizer wiring),
M-3 (Origin check), L-1 (token-compare timing). Auth remained OFF by operator decision.
Not modified: `renderer/`, `mcp/`, `session-persistence-commands.js`, `scripts/`, `package.json`,
`docs/planning/`. No git commits made.

### Incidental note (pre-existing, not fixed)
`ErrorFormatter.validationError` injects `id:null`, which the server response envelope
(`{ id, command, ...response }`, server.js:~1870) then lets override the real request id — so
**all** `navigate` validation errors return `id:null` and can't be client-correlated. To avoid
shipping the SSRF blocks with this defect, the `navigate` SSRF path returns a **plain** error object
(no `id` key) so the request id is preserved (verified: id 3/4/5 correlated). The underlying
`error-formatter.js` quirk is outside this work zone and is flagged for follow-up.
