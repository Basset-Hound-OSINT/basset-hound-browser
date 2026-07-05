---
title: "Differentiation Strategy — Basset Hound vs Selenium / Puppeteer / ChromeDriver"
status: AUTHORITATIVE (strategy)
date: 2026-07-04
author: pm (pm@basset-hound-browser:differentiation-strategy)
question: "What makes Basset Hound different from Selenium / Puppeteer / ChromeDriver — are we just building a Chrome clone?"
grounded_in:
  - docs/planning/PROJECT-STATUS-MATRIX.md   # authoritative "what actually works"
  - docs/architecture/SCOPE.md               # boundaries + §0 blacklist
  - websocket/commands/forensic-capture-command.js  # the one-call forensic bundle (read at source)
  - mcp/server.py                            # 17-tool MCP adapter (read at source)
  - scripts/smoke-mvp.js                     # reproducible proof harness (14/14)
cross_reference:
  - docs/findings/PRIVACY-ANONYMITY-VERIFICATION-2026-07-04.md  # PARALLEL — not on disk at write time; anonymity claims here are GAP-labelled pending it
method: Classified against source code + the two live harnesses (smoke:mvp, mcp/verify_e2e.py), NOT against legacy completion docs.
---

# Differentiation Strategy — Are We Just Building a Chrome Clone?

## TL;DR (the honest answer)

**Short answer: No — but only because of the layers on top. The engine is not the differentiator.**

Selenium, Puppeteer, ChromeDriver, Playwright, and Basset Hound all drive the **same
Chromium/Blink/V8 engine**. Basset embeds it via Electron; the others attach to it via
WebDriver or CDP. At the *engine* level, Basset genuinely **is "a Chrome."** If we stopped
at navigate / click / fill / screenshot / execute-JS, we would not be a clone — we would be
a **worse Puppeteer** (our offscreen pipeline renders 0 frames, screenshots fall back to a
`mainWindowDirect` capture, and `websocket/server.js` is ~12,090 monolithic lines). Raw
automation is **table stakes**, not a differentiator, and we should not try to win there.

The value — the entire reason to build a custom browser instead of `npm install puppeteer` —
lives in **five layers stacked on top of the shared engine**, three of which are delivered
and proven today, one of which is the single biggest gap, and one of which is a design
guarantee competitors structurally cannot make:

1. **Forensic-grade capture** — deterministic, SHA-256-hashed, chain-of-custody, one manifested bundle. **DELIVERED + proven.** Selenium/Puppeteer have none of this.
2. **Privacy / anonymity** — capture *without revealing who is capturing* (Tor + proxy + identity control). **MOSTLY GAP today.** This is differentiation priority #1.
3. **Agent-drivable single control surface** — a running *service* (WS + 17-tool MCP), not a client library you compile against. **DELIVERED + proven.**
4. **Access-to-everything in one call** — HAR/wire + storage + cookies + DOM + headers + hashes from a single `forensic_capture`. **DELIVERED + proven.**
5. **Self-contained, deterministic, model-free by charter** — no agents, no LLM calls, reproducible evidence. **DELIVERED by design + enforced.**

**Strategic conclusion:** we are not a Chrome clone; we are a **forensic capture + agent control
plane** wrapped around a commodity engine. To make that *unambiguous* — to a skeptic who says
"that's just Puppeteer with extra steps" — the one thing we must prove next is **anonymity**:
that Basset can capture a page and leave the target unable to see the operator's real IP or a
tell-tale automation fingerprint. That is the capability Selenium is naked without, and it is
currently our weakest link.

---

## 1. The core thesis: the engine is not the moat

| Tool | How it drives Chromium | What it fundamentally is | Ships a forensic layer? | Ships an anonymity layer? | Is a running service? |
| --- | --- | --- | --- | --- | --- |
| **ChromeDriver** | WebDriver protocol → Chrome | A protocol server for one browser | No | No | It's a driver process, not an agent surface |
| **Selenium** | WebDriver (via drivers) | A client library / language binding | No | No (identity is naked; `navigator.webdriver` is set) | No — you embed it in your code |
| **Puppeteer / Playwright** | CDP / BiDi → Chromium | A JS automation library | Partial (HAR via tracing/context; **no hashing, no chain-of-custody, no manifest**) | No (proxy per-context, but no Tor, no identity coherence, no evidence that identity is hidden) | No — a library you `import` |
| **Basset Hound** | Electron `<webview>` (CDP under the hood) | **A capture/control *product*: WS + MCP service over a forensic + anonymity layer** | **Yes — deterministic, hashed, manifested, chain-of-custody** | **Intended (Tor + proxy + fingerprint) — largely a GAP today** | **Yes — WS on 127.0.0.1:8765 + a 17-tool MCP server** |

The takeaway: **everyone shares the engine.** The competitors deliberately stop at "drive the
browser and hand you a DOM." Basset's bet is that the *unmet* need is (a) evidence you can put
in front of a reviewer with integrity guarantees, (b) doing so without being seen, and (c)
handing an external AI agent a single service to point at. None of those three are the engine.

---

## 2. The five differentiators — honest state of each

### D1 — Forensic-grade capture — **DELIVERED + PROVEN**
- **What it is:** a single WS command, `forensic_capture` (`websocket/commands/forensic-capture-command.js`), that orchestrates already-proven primitives in a fixed order and writes a **manifested, SHA-256-hashed evidence bundle** to disk: `page.html`, `network.har` (+ optional `network.warc`), `cookies.json`, `storage.json` (local/session/IndexedDB), `page_state.json`, `technologies.json`, `links/images/forms.json`, `metadata.json` (status code + response headers + UA + title), plus a **`chain_of_custody.json`** and a top-level **`manifest.json`** with a per-file `sha256`, `bytes`, `source_command`, and a deterministic **`bundle_sha256`** tamper seal.
- **Evidence it works:** registered and reachable (`registerForensicCaptureCommand`, `websocket/server.js:11782`); the `ForensicAnalyzer` core is 25/25 green with byte-for-byte hash determinism; **`smoke:mvp` Phase 4 self-proves it** — it recomputes `page.html`'s SHA-256 from disk and asserts it equals the manifest entry (`scripts/smoke-mvp.js:498-517`).
- **Scope-clean by construction:** the command explicitly does **not** import from `src/agents/*` or `src/features/ai-analysis.js`, and challenge/CAPTCHA pages are **detected and flagged** (`challenge_suspected`), *never bypassed and never silently sealed as clean*. All writes pass through `PathValidator`.
- **vs the field:** Selenium/ChromeDriver: nothing comparable. Playwright: you can assemble a HAR and screenshots, but there is **no integrity hash, no chain-of-custody, no single sealed manifest** — you'd have to build this layer yourself, which is exactly the layer we are selling.

### D2 — Privacy / anonymity (capture without revealing identity) — **MOSTLY GAP**
- **The thesis:** the differentiator is not "we can use a proxy" (so can Playwright) — it is **"we can capture forensic evidence while the target cannot see the operator's real IP or an automation fingerprint."** That is what makes Basset usable for adversarial / investigative capture where Selenium would be burned on contact.
- **What actually exists today (honest):**
  - Single-proxy set/clear/status + validation on `defaultSession` (the webview shares it); `proxy-manager.test.js` 75/76. **But live routing is unproven** — the status matrix flags "proxy actually routing live webview traffic end-to-end … architecturally plausible, still not verified vs a real proxy" (Matrix §6).
  - Tor master-switch state machine (OFF/ON/AUTO, onion detection) is wired; **but** `proxy/tor.js` only *connects to an existing external Tor daemon* (does not spawn one), the test is flaky, and there is "no live evidence it launches + routes" (Matrix §6).
  - Fingerprint control is **effectively just the `navigator.webdriver=undefined` + plugins/languages/platform stub** injected via preload — the *only* evasion reaching a real page. The 37 fingerprint/coherence modules were **pruned as dead** and evasion is honestly **~0%** (Matrix §3).
- **Verdict: this is the #1 differentiation GAP.** Right now Basset's identity posture is only marginally better than a naked Puppeteer. The one thing that would make us unambiguously not-a-clone is the one thing not yet proven end-to-end.
- **Cross-reference:** a dedicated verification, `docs/findings/PRIVACY-ANONYMITY-VERIFICATION-2026-07-04.md`, is being produced **in parallel** and was **not on disk when this doc was written**. Treat its outcome as authoritative for whether D2 is PROVEN or still GAP; this doc classifies it GAP pending that result.

### D3 — Agent-drivable single control surface — **DELIVERED + PROVEN**
- **What it is:** Basset is a **running service**, not a library. External agents talk to it two ways: a WebSocket API (`ws://127.0.0.1:8765`, flat JSON `{command,id,...params}`) and a real **FastMCP 2.1.2 MCP server** (`mcp/server.py`) exposing **17 tools** (`navigate, get_url, get_content, get_page_state, execute_script, screenshot, scroll, wait_for_element, click, fill, type_text, set_cookie, get_all_cookies, get_cookies, extract_links, extract_forms, extract_images`).
- **Evidence it works:** `smoke:mvp` 14/14 GREEN over the WS surface; `python3 mcp/verify_e2e.py` exit 0 through the full `call_tool → pydantic → WS bridge → browser` path.
- **vs the field:** Selenium/Puppeteer/Playwright are **libraries** — an agent author must write and host the driver code themselves. Basset is a **daemon you point Claude Desktop / palletai at** (`python3 mcp/server.py`). For an AI-agent-driven architecture (our whole reason for existing per SCOPE.md), "it's already a service with an MCP contract" is a real, delivered structural advantage.
- **Honest caveats:** auth is deliberately **OFF** (local-agent trust model, loopback bind); `forensic_capture` and Tor/proxy control are **not yet exposed as MCP tools** (only over raw WS); the Collaboration API is broken/unwired (Matrix §7).

### D4 — Access-to-everything in one call — **DELIVERED + PROVEN**
- **What it is:** the *combination* is the product. One `forensic_capture` call returns, correlated to a single navigation and a single manifest: full HTML + wire-level HAR (headers/timing/status) + WARC + all cookies + local/session/IndexedDB storage + DOM page-state + detected technologies + links/images/forms + response headers + user-agent + per-artifact hashes. Heavy bytes go to disk; the WS reply is just the manifest + `bundle_dir`.
- **Evidence:** same as D1 — `smoke:mvp` Phase 4 asserts the bundle contains `page.html, network.har, cookies.json, storage.json, metadata.json, manifest.json, chain_of_custody.json` and verifies a hash.
- **vs the field:** with Puppeteer you make ~8 separate API calls, correlate them yourself, and get no integrity envelope. Basset's "**one call, everything, hashed, on disk**" is a genuine ergonomic + forensic differentiator.
- **Honest caveat:** the HAR is built from flattened `getLogs()` entries — it captures **headers, timing, status, sizes but NOT response bodies**; full live network coverage is Electron-gated; the screenshot can be absent under headless (0-frame offscreen; `mainWindowDirect` fallback). So "everything" today means "everything except response bodies and a guaranteed screenshot."

### D5 — Self-contained, deterministic, model-free tool — **DELIVERED (by charter + enforced)**
- **What it is:** SCOPE.md §0 is a hard **blacklist** — no in-process agents/orchestrators, no LLM/model calls, no embeddings. The browser is deterministic and reproducible on purpose: same page → same hashes. `forensic_capture` provably honors this (no agent/AI imports; challenge *detect-not-bypass*).
- **Why it's a differentiator, not just a limitation:** forensic reproducibility *requires* determinism. A tool that quietly ran an ML classifier or an LLM over captured data could not offer byte-stable, court-defensible evidence. Competitors don't make this promise because they aren't trying to; for Basset it's a positioning guarantee.
- **Honest caveat:** two known scope violators remain on disk, **deferred** not active: `src/agents/orchestrator.js` and `src/features/ai-analysis.js` (a real Claude API call). They are not wired into the capture path but should eventually be removed to keep the charter airtight.

---

## 3. Honest scorecard

| # | Differentiator | Delivered today? | Evidence | Gap / caveat |
| --- | --- | --- | --- | --- |
| **D1** | Forensic-grade capture (deterministic, SHA-256, chain-of-custody, manifested bundle) | **YES — proven** | `forensic-capture-command.js` registered `server.js:11782`; `smoke:mvp` Phase 4 recomputes `page.html` sha256 vs manifest; `ForensicAnalyzer` 25/25 | Not exposed as an MCP tool; screenshot bytes can be absent headless; evidence-sealing/RFC-3161/court-package intentionally out of scope |
| **D2** | Privacy / anonymity (Tor + proxy + fingerprint = capture unseen) | **NO — mostly GAP** | proxy set/status `proxy-manager.test.js` 75/76; Tor master-switch wired | Live proxy/Tor routing **unproven** vs a real endpoint; Tor connects to external daemon only; fingerprint control = only the `webdriver` stub (evasion ~0%). See parallel `PRIVACY-ANONYMITY-VERIFICATION-2026-07-04.md` |
| **D3** | Agent-drivable single control surface (WS + 17-tool MCP *service*) | **YES — proven** | `smoke:mvp` 14/14; `mcp/verify_e2e.py` exit 0; `mcp/server.py` FastMCP 2.1.2, 17 tools | Auth OFF (local-agent model); `forensic_capture` + Tor/proxy not yet MCP-exposed; Collaboration API broken |
| **D4** | Access-to-everything in one call (HAR/wire + storage + cookies + DOM + headers + hashes) | **YES — proven** | `forensic_capture` single-call bundle; `smoke:mvp` Phase 4 asserts 7 artifact files + hash | HAR has **no response bodies** (headers/timing/status only); screenshot may be missing headless; full live network coverage Electron-gated |
| **D5** | Self-contained, deterministic, model-free by charter | **YES — by design + enforced** | SCOPE.md §0 blacklist; `forensic_capture` imports no agent/AI code; challenge detect-not-bypass | Two deferred scope violators still on disk (`src/agents/orchestrator.js`, `src/features/ai-analysis.js`) |
| **A1** | *(anti-differentiator)* Raw automation: navigate/click/fill/JS/screenshot | **NOT a differentiator** | Table stakes; `smoke:mvp` proves it works | Playwright/Puppeteer do this **as well or better**; our offscreen renders 0 frames, code is monolithic. **Do not compete here.** |

**Reading the scorecard:** 3 of 5 differentiators are delivered and reproducibly proven (D1, D3,
D4, D5 → four if you count the design guarantee). The gap that decides whether the skeptic is
right is **D2**. Everything in row **A1** is where we are *weaker* than the field and must not
pretend otherwise.

---

## 4. Differentiation roadmap (prioritized) — how to become unambiguously not-a-clone

Ordered by how much each moves us from "fancy Puppeteer" to "distinct product." Every item is
tied to SCOPE.md and stays **deterministic, model-free, detect-not-bypass**.

### Priority 1 — Prove ANONYMITY end-to-end (closes the D2 gap; highest leverage)
- **Prove live routing:** navigate through a configured proxy **and** through Tor and assert the exit IP the target sees is **not** the host IP (capture it in the bundle). Today this is "architecturally plausible, unproven" (Matrix §6) — turning it into a reproducible assertion is the single highest-value move.
- **Decide the identity posture, deterministically:** not the pruned fake-evasion, but a **coherent, deterministic identity** (UA + navigator + Accept-Language + timezone consistent with the chosen proxy geography) so a capture doesn't trivially out itself. Stay within SCOPE §0 (no ML, no adaptive models) and §4 (detection, not bypass).
- **Wire it into `forensic_capture`:** record the observed egress IP / Tor circuit / active identity into `metadata.json` so the bundle *proves* the capture was anonymous.
- **SCOPE tie:** §7 (Tor in scope for network forensics), §0 (deterministic), §4 (evasion best-effort, detect not bypass). **Consumes the parallel `PRIVACY-ANONYMITY-VERIFICATION-2026-07-04.md`.**

### Priority 2 — Deepen wire-level capture (widens the D1/D4 moat)
- **Capture response bodies** into HAR/WARC, not just headers/timing/status — this is the biggest honest hole in "access to everything."
- **Add the passive network-forensics signals SCOPE §6 already blesses:** TLS certificate chains, DNS queries, WebSocket frames, cookie provenance — all deterministic, all passive observation of what the browser already sees.
- **Expose `forensic_capture` as an MCP tool** so an AI agent gets the one-call sealed bundle, not just the 17 primitives. (Currently WS-only.)
- **SCOPE tie:** §6 Network Monitoring & Forensics (browser-level, passive) — explicitly in scope.

### Priority 3 — Harden and prove the surface (removes "unproven" asterisks)
- Verify live proxy routing (feeds P1); make offscreen screenshots real **or** formally document `mainWindowDirect` as the supported headless capture path; fix or formally shelve the broken Collaboration API (Matrix §7). These convert "?" rows in the status matrix into "✓".

### Priority 4 — Deferred evasion research (lowest; research-only, bounded)
- Only enough fingerprint coherence to not be trivially detected as automation — **strictly detect-not-bypass, deterministic, model-free**. The plan already exists: `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`. This is deferred by design and must not pull ML or live-adaptive logic into the browser (SCOPE §0 / §6).

---

## 5. One-paragraph answer for the operator

> **"Are we just building a Chrome clone?"** At the engine layer, yes — we embed the same
> Chromium everyone else drives, and if we only shipped automation we'd be a weaker Puppeteer.
> But that isn't the product. The product is the **forensic capture layer** (one call →
> SHA-256-hashed, chain-of-custody, manifested evidence bundle — *proven today*), the
> **agent-facing service surface** (WS + a 17-tool MCP server you point an AI at — *proven
> today*), and the **anonymity layer** (Tor + proxy + identity control so we capture without
> being seen — *our #1 gap, not yet proven*). Selenium and Puppeteer deliberately ship none of
> these; they hand you a DOM and leave forensics, evidence integrity, and identity to you.
> We are a **forensic capture + agent control plane**, not a browser. To make that undeniable,
> the next thing to prove is anonymity — that's the capability the naked drivers can't touch.
