---
title: "Bot-Detection Research Corpus — Index"
date: 2026-07-03
category: bot-detection
status: Complete
---

# Bot-Detection Research Corpus

Honest, source-verified audit of Basset Hound Browser's bot-detection posture: for each
detection surface, what modern (2024–2026) anti-bot stacks fingerprint, what we actually
ship against it, and where the gaps are. A wrong "we're covered" is treated as worse than
a flagged gap.

## ▶ Start here

**[`BOT-DETECTION-GAP-ANALYSIS.md`](./BOT-DETECTION-GAP-ANALYSIS.md)** — the master
synthesis. Answers *"what is blocking us as a bot, and how do we fix it?"* with the
weakest-signal-wins framing, the ranked top blockers today, a prioritized (impact ÷ effort)
remediation roadmap tagged Quick-Win / Medium / Hard, and the cross-signal coherence
scorecard. Read this first; drill into a surface doc for any fix you pick up.

## The 8 surface audits

| Surface | Verify | Top leak | Doc |
|---------|--------|----------|-----|
| TLS / HTTP-2 fingerprinting | SOLID | Real Chromium-142 JA4 vs spoofed old-Chrome UA (pre-JS block); TLS layer is test-only | [tls-http2-fingerprinting.md](./tls-http2-fingerprinting.md) |
| Canvas / WebGL / Audio / Fonts | SOLID | No spoofing by default; stub fires post-load; real Linux surface leaks | [canvas-webgl-audio.md](./canvas-webgl-audio.md) |
| navigator.* & Device APIs | SOLID | No UA-Client-Hints spoofing; `userAgentData` leaks Linux/Chromium | [navigator-device-apis.md](./navigator-device-apis.md) |
| Automation / CDP / Electron artifacts | MAJOR_ISSUES | Guest `<webview>` UA leaks `Electron/39.2.7` on first request | [automation-cdp-electron-artifacts.md](./automation-cdp-electron-artifacts.md) |
| Behavioral biometrics | MINOR_ISSUES | Every synthetic event is `isTrusted === false` | [behavioral-biometrics.md](./behavioral-biometrics.md) |
| Cross-layer coherence | MINOR_ISSUES | JA4-vs-UA never validated; only temporal JA3 self-check exists | [cross-layer-coherence.md](./cross-layer-coherence.md) |
| Network / IP / Proxy / WebRTC | SOLID | WebRTC STUN leaks the real public IP past the proxy | [network-ip-proxy-webrtc.md](./network-ip-proxy-webrtc.md) |
| Challenge & CAPTCHA systems | MINOR_ISSUES | No solve path; interstitial HTML returned as page content | [challenge-captcha-systems.md](./challenge-captcha-systems.md) |

## Two things to keep in mind

- **Weakest-signal-wins.** Detectors take the *max* confidence across signals, not the
  average. Your single worst tell decides the request. Fix leaks in request-lifecycle
  order (wire → headers → document-start → interaction).
- **The "85–90% effective" numbers are false confidence.** Every effectiveness figure in
  the codebase is a hardcoded constant or a `Math.random()` simulator against fake
  endpoints. Treat as 0% until validated against a live detector.

## Scope guardrail

All remediation keeps the browser a **deterministic, model-free capture/control tool**
(`docs/architecture/SCOPE.md §0`). Evasion logic and CAPTCHA strategy are in scope;
**no internal AI agents, no LLM/model integration** in browser source. CAPTCHA solvers, if
used, are external services called through the WebSocket/HTTP API — never embedded.
