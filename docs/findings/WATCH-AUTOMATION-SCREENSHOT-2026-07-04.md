# Watch-Automation + Headless-Screenshot Proof (2026-07-04)

Agent: `js-dev@basset-hound-browser:watch-automation-demo`. Two operator asks, both **proven live**
against the real browser. No browser code changed — demos only. No commits.

## TL;DR

| Ask | Result | Hard evidence |
|-----|--------|---------------|
| 1. Watch automation in a **visible GUI** window | **WORKS** | Real on-screen window on `DISPLAY=:1`; navigate → type → click → fill → scroll all fired; 3 screenshots + 5 live-DOM assertions |
| 2. Screenshot with **NO visible GUI** (headless) | **WORKS** | Headless `screenshot` returned a real **1361×660** PNG, 16.7 KB, 1080 distinct colours, 898,260 non-white pixels — a true render of example.com |

Answer to "can we reconstruct an image from memory with no GUI?" — **YES.**
`webContents.capturePage()` reads the offscreen compositor buffer; a visible window is never required.

## Deliverables (all under `tmp/real_world_test/`, stdlib-only, gitignored)

- `bhb_ws.py` — minimal **stdlib-only** WebSocket client (RFC-6455 handshake, masked client
  frames, fragmentation + ping/close) + browser launch/wait/reap helpers. No `websockets`/`ws` dep.
- `watch_automation.py` — **59 lines**, operator ask #1. Launches the browser GUI itself.
- `headless_screenshot_proof.py` — operator ask #2. Includes a stdlib (`zlib`) PNG decoder that
  defilters scanlines and counts distinct/non-white pixels to prove the frame is real.
- `demo_page.html` — local demo page (search box, form field, button, tall scroll region).
- `.scratch/` — evidence PNGs + boot logs (regenerated on every run; heavy user-data dirs reaped).

### How to run

```bash
# Ask 2 — headless screenshot proof (no display needed):
python3 tmp/real_world_test/headless_screenshot_proof.py

# Ask 1 — watchable GUI automation (point a viewer at DISPLAY :1 first, then):
python3 tmp/real_world_test/watch_automation.py
#   The script launches the GUI browser itself. Two-terminal alternative:
#   Terminal A:  BASSET_GUI=1 npm run start:gui      (visible window on :1, ws:8765)
#   Terminal B:  drive ws://127.0.0.1:8765 with the same command set
```

Each demo boots the browser on an **OS-assigned free WS port** (no 8765 collision), detached in
its own process group, with a throwaway `--user-data-dir`, and **reaps the whole group** (SIGTERM→
SIGKILL) on exit. Verified: **zero stray electron processes** after runs.

## Evidence — Ask 1 (GUI watch automation)

Boot log confirms a **genuine on-screen window**, not a headless fallback:

```
[GUI] GUI mode enabled — showing browser window (headless visibility override skipped)
```

Live run (`DISPLAY=:1`), every value read back from the live DOM via `execute_script`:

| Step | WS command | `execute_script` read-back (proof DOM changed) |
|------|-----------|-----------------------------------------------|
| navigate | `navigate` | `document.title` = `Basset Hound — Watch Automation Demo` |
| type in search box | `type_text #search` (per-key 70–170 ms) | `#search.value` = `basset hound browser` |
| click | `click #go` | `#result.textContent` = `Searched for: basset hound browser` |
| fill form field | `fill #email` | `#email.value` = `analyst@basset.example` |
| scroll | `scroll y=1200` | `window.scrollY` = `1200` |

Screenshots at 3 steps (real renders, visually verified): `.scratch/01_loaded.png` (38 KB),
`.scratch/02_clicked.png` (44 KB — shows the typed query **and** the green "Searched for:…" result
the click produced), `.scratch/03_scrolled.png` (28 KB — page scrolled to the bottom marker).

## Evidence — Ask 2 (headless screenshot)

Boot log confirms headless + offscreen rendering active:

```
[Headless] BrowserWindow configured for headless mode
[HeadlessManager] Offscreen rendering enabled at 30 fps
```

Decoded PNG (stdlib `zlib`, from `screenshot` → base64 data URL) of `https://example.com/`:

| Metric | Value | Meaning |
|--------|-------|---------|
| PNG bytes | 16,768 | non-trivial (a blank/1×1 would be tens of bytes) |
| dimensions | 1361 × 660 | > 0, real viewport (size randomised per boot; e.g. 1285×682 on another run) |
| PNG color type | 2 (RGB) | 8-bit truecolour from the compositor |
| distinct RGB colours | 1,080 | not a solid/uniform fill |
| non-white pixels | 898,260 | real text + link + page chrome, not a blank white image |
| capture path | `webview.capturePage()` (offscreen buffer) | primary path; response had no `captureMethod`, i.e. no fallback needed |

Visual check of `.scratch/headless_example.png`: renders the "Example Domain" heading, body text,
and "Learn more" link — a faithful headless render.

### Does headless capture require offscreen rendering enabled?

- **Current state (confirmed):** offscreen rendering is **enabled by default in headless mode.**
  The active preset carries `offscreenRendering: true` (`headless/manager.js`), and `main.js`
  calls `headlessManager.enableOffscreenRendering(mainWindow.webContents)` at startup — the boot log
  above confirms it firing at 30 fps. The paint pipeline this establishes is what lets a hidden
  (`show:false`) window's `capturePage()` return real pixels instead of an empty image.
- **Capture flow (`websocket/server.js` `screenshot` handler):** primary = renderer
  `webview.capturePage().toDataURL()`; fallbacks = main-window `capturePage()` (adds
  `captureMethod:"mainWindow"`), then `headlessManager.captureFromLastFrame()` off the offscreen
  frame buffer. In these runs the **primary path succeeded** — no fallback was needed.
- Not tested: capture with offscreen rendering forcibly **off** (it is on by default and there is no
  supported "headless without offscreen" config path here), so no claim is made about that mode.

## Protocol / integration notes (for future drivers)

- WS protocol is flat JSON: send `{"command","id",<params>}`; reply echoes the same `id`; event
  frames (no matching id) are skipped. `id:null` validation errors echo the `command` name.
- No auth by default (`server.auth.requireAuth` defaults false). Port via `BASSET_WS_PORT`/`BASSET_PORT`.
- GUI toggle: `--gui` flag **or** `BASSET_GUI=1` **and** a real display (`DISPLAY`). Without a display
  it warns and falls back to headless (window stays hidden).
- Loopback navigation (the local demo page) requires `BASSET_WS_ALLOW_PRIVATE_NETWORK=1` (SSRF guard);
  the launch helper sets it. `data:` and `file:` schemes are blocked by the same guard.
- `screenshot` success shape: `{ success:true, data:"data:image/png;base64,…" }`.
