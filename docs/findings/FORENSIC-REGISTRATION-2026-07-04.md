# Forensic + Compression Command Registration Wiring

**Date:** 2026-07-04
**Agent:** js-dev @ basset-hound-browser:register-forensic-reports
**Scope:** compression + forensic ONLY (no orchestration / model-based tools, per `docs/SCOPE.md`)
**Commits:** none (as instructed)

---

## Problem

The v12.9.0 forensic-analyzer report commands (deterministic SHA-256 hashing,
chain-of-custody, artifact integrity) and the adaptive compression commands were
**defined but unreachable at runtime**: `registerV12_9_0Commands()` in
`websocket/commands/v12-9-0-integration-commands.js` was never called from the
running WebSocket server, so none of its handlers ever landed in the live
command dispatcher.

A second latent defect would have made them fail even if registered: the
handlers used the wrong calling convention (see fix #1 below).

---

## Changes

### 1. Handler signature fix — `websocket/commands/v12-9-0-integration-commands.js`

The command dispatcher (`websocket/command-dispatcher.js:156`) invokes every
handler as `handler(params, context)`, where `params` is the already-destructured
parameter object (`server.js:1855` → `const { command, id, ...params } = data`).
Every other `commandHandlers`-style module in the repo (e.g.
`credentials-commands.js`, `network-forensics-commands.js`) follows this and
destructures directly from `params`.

The v12.9.0 handlers instead declared `async (message, browserState)` and read
`message.params`. Under the real dispatcher, `message` **is** the params object,
so `message.params` was always `undefined` — every command would have returned
its "parameter required" error branch.

Fix (14 handlers):
- `async (message, browserState) =>` → `async (params, context = {}) =>`
- `message.params` → `params`  (8 read sites)

`browserState` was never referenced; `message` was only referenced via
`message.params` (the `error.message` / `message:` literals are unrelated and
untouched).

### 2. Registration wiring — `websocket/server.js:11814-11833`

Added inside `setupCommandHandlers()` (method at `server.js:2938`, called during
init at `server.js:1278`, before the `CommandDispatcher` is constructed at
`server.js:1281` with a reference to the same `this.commandHandlers` object):

```js
// v12.9.0 FEATURE COMMANDS - Compression + Forensic Analysis  (server.js:11814)
try {
  const {
    initializeV12_9_0Engines,
    registerV12_9_0Commands
  } = require('./commands/v12-9-0-integration-commands');
  initializeV12_9_0Engines();
  registerV12_9_0Commands(this.commandHandlers);
  this.logger.info('[WebSocket] Registered 14 v12.9.0 commands (5 compression + 8 forensic + 1 reset)');
} catch (v12_9_0Err) {
  this.logger.error('[WebSocket] Failed to register v12.9.0 commands: ' + (v12_9_0Err && v12_9_0Err.message));
}
```

Notes:
- Inline `require` (localized, mirrors the existing pattern used for
  `recording-commands` / `video-recording-commands` in the same method).
- Wrapped in `try/catch` so a registration failure logs and continues rather than
  aborting boot.
- The module it pulls in is already trimmed to compression + forensic only (no
  orchestration / no model-based tooling), so nothing out-of-scope is registered.
  Registering the whole module was therefore safe; no command sets had to be
  excluded.

---

## Commands now reachable (14)

**Compression (5):** `compress`, `compressMultiple`, `getCompressionMetrics`,
`getCompressionStatistics`, `resetCompressionMetrics`

**Forensic (8):** `addForensicArtifact`, `recordForensicEvent`,
`recordNavigation`, `analyzeForensicPatterns`, `getForensicArtifacts`,
`getForensicReport`, `getForensicStatistics`, `verifyArtifactIntegrity`

**Shared (1):** `resetV12_9_0`

---

## Verification

### Syntax
`node -c websocket/server.js` → OK
`node -c websocket/commands/v12-9-0-integration-commands.js` → OK

### A. Real-WS dispatcher harness (isolated, port 8799)
Used the **real** `CommandDispatcher` class and the **real**
`initializeV12_9_0Engines()` + `registerV12_9_0Commands()` functions, wired over a
real `ws` WebSocket exactly as `server.js` does (`{command,id,...params}` →
`dispatcher.execute(command, params, ...)`). All 14 commands registered. Results:

| Command | Result |
| --- | --- |
| `compress` | success, algorithm=`brotli`, 4000 → 32 bytes |
| `addForensicArtifact` | success, artifactId `1e825255-…` |
| `verifyArtifactIntegrity` | success, `verified: true` |
| `getForensicArtifacts` | artifact carries hash `aaa774e8…65c0df90` (valid 64-hex SHA-256) |
| `recordForensicEvent` | success, eventId returned |
| `getForensicReport` | success, JSON report 1778 chars |
| `getForensicStatistics` | success |
| unknown command (control) | correctly rejected by dispatcher |

**SHA-256 determinism confirmed independently:** `crypto.createHash('sha256')`
over the 33-byte artifact payload produced
`aaa774e86e9bac172923e152d37f15baf328148a1f709e98b30e0d8065c0df90`, byte-for-byte
identical to the hash reported by `ForensicAnalyzer` — i.e. real deterministic
hashing, not a stub.

### B. Full Electron boot (live server, distinct port 8801)
Launched the real app: `node_modules/.bin/electron . --no-sandbox
--user-data-dir=<throwaway>`, `ELECTRON_RUN_AS_NODE` deleted, `BASSET_WS_PORT=8801`,
detached in its own process group, temp under `/home/devel/bhb-*`. Server booted
clean and logged `Server started`. Commands run against the **live** server:

```
addForensicArtifact     -> success, artifactId 09e740a9-…
verifyArtifactIntegrity -> verified: true
getForensicReport       -> success, reportLen 1542
recordForensicEvent     -> success, eventId 28fc20d6-…
compress                -> success, algorithm=brotli, 1200 -> 15
```

Process group reaped (`kill -pgid`); port 8801 released; throwaway user-data-dir
removed. No basset-hound Electron strays remained afterward. Boot was not broken
by the wiring.

---

## Constraints honored
- Edited only `websocket/server.js` and
  `websocket/commands/v12-9-0-integration-commands.js` (the permitted work zone).
- `network-analysis/manager.js`, `renderer/`, `mcp/`, `scripts/`, `package.json`,
  `config/`, `docker-compose.yml` untouched.
- Port 8765 avoided (verified with distinct ports 8799 / 8801).
- No git commits. No k8s / terraform.
- All verification temp under `/home/devel/bhb-*`; processes reaped, no strays.
