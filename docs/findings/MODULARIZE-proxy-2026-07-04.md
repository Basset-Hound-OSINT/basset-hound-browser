# Modularize proxy: `tor-advanced.js` + `manager.js` (2026-07-04)

Agent: `js-dev@basset-hound-browser:modularize-proxy`
Task: split two oversized proxy files into a thin barrel + modules `<1200` lines,
preserving `module.exports` byte-for-byte. **Move code only — no logic rewrite.**
Routing/session logic (proven working by the privacy verification) was **not touched**.

## Result: DONE — all gates green

- Every new/changed file passes `node -c`.
- Export keys **identical** to baseline for both barrels.
- Every file `< 1200` lines (largest = 952).
- All moved method bodies confirmed **verbatim** vs the pre-split originals.
- Runtime method sets identical (Tor 54/54, ProxyManager 38/38 — none dropped/added).
- No commits made.

## Approach

Each file is a single large class plus constants. Splitting a class while keeping
method bodies byte-for-byte was done with a **class-inheritance chain**: a base
class in one file, each subsequent layer `extends` the previous, and the final
layer keeps the original class name. Method bodies were sliced by exact line range
and moved unchanged; only file headers + `require`s + `class X extends Y {` wrappers
were added. The two barrels re-create the singleton and re-export the same keys.

Two mechanical adjustments were required because the new files live one directory
deeper (`proxy/tor-advanced/`, `proxy/manager/`) — these preserve identical runtime
behavior, they do not change logic:
- `EMBEDDED_PATHS` / `_findTorBinary` / `_getTransportPath`: `path.join(__dirname, '..', 'bin', …)`
  → `path.join(__dirname, '..', '..', 'bin', …)` (5 + 4 occurrences). Verified the
  embedded binary still resolves to `…/basset-hound-browser/bin/tor/tor/tor` (same as baseline).
- `tor-helpers.js`: `require('./tor')` → `require('../tor')` (1 occurrence). `proxy/tor.js` confirmed to exist.

No cross-require exists between the two modules (manager requires `../tor`, not
tor-advanced). All external consumers require only the barrels — none were changed.

## Module map — `proxy/tor-advanced.js` (was 2874 lines)

| File | Lines | Contents |
|---|---:|---|
| `proxy/tor-advanced.js` (barrel) | 38 | requires constants + final class, builds `advancedTorManager` singleton (`{ killOnExit: false }`), re-exports the 9 keys |
| `proxy/tor-advanced/constants.js` | 159 | `TOR_STATES, TRANSPORT_TYPES, ISOLATION_MODES, TOR_DEFAULTS, EMBEDDED_PATHS, COUNTRY_CODES, BUILTIN_BRIDGES` (orig 58–193) |
| `proxy/tor-advanced/manager-base.js` | 952 | `AdvancedTorManagerBase extends EventEmitter`: constructor, setup/config helpers, process lifecycle (start/stop/restart), control-port comms (orig 235–1156) |
| `proxy/tor-advanced/manager-routing.js` | 794 | `AdvancedTorManagerRouting extends …Base`: circuit mgmt, exit/entry node control, bridges, stream isolation (orig 1158–1929) |
| `proxy/tor-advanced/manager.js` | 950 | `AdvancedTorManager extends …Routing`: exit-IP detection, bandwidth/stats, status/config, onion services, consensus, connectExisting, cleanup (orig 1931–2855) |

Export keys (unchanged):
`AdvancedTorManager, BUILTIN_BRIDGES, COUNTRY_CODES, EMBEDDED_PATHS, ISOLATION_MODES, TOR_DEFAULTS, TOR_STATES, TRANSPORT_TYPES, advancedTorManager`

## Module map — `proxy/manager.js` (was 1364 lines)

| File | Lines | Contents |
|---|---:|---|
| `proxy/manager.js` (barrel) | 34 | requires constants + tor-helpers + final class, builds `proxyManager` singleton, re-exports the 7 keys |
| `proxy/manager/constants.js` | 46 | `PROXY_TYPES, PROXY_MODES, TOR_MASTER_MODES` (orig 18–48) |
| `proxy/manager/tor-helpers.js` | 41 | lazy `getTorManager` (`require('../tor')`) + deprecated `getProxyChainManager` (orig 13–16, 50–73) |
| `proxy/manager/proxy-manager-base.js` | 598 | `ProxyManagerBase`: validate/format, set/clear/status, rotation list + auto-rotation, auth handler, stats, testProxy (orig 80–652) |
| `proxy/manager/proxy-manager.js` | 719 | `ProxyManager extends ProxyManagerBase`: Tor integration, dynamic routing, Tor master switch (off/on/auto), proxy-chain integration, extended status (orig 654–1350) |

Export keys (unchanged):
`PROXY_MODES, PROXY_TYPES, ProxyManager, TOR_MASTER_MODES, getProxyChainManager, getTorManager, proxyManager`

## Verification performed (lightweight, per instructions — no smoke:mvp)

1. `node -c` on all 10 files — OK.
2. `Object.keys(require(barrel)).sort()` == captured baseline — identical for both.
3. `wc -l` on every file — max 952, all `< 1200`.
4. Byte-for-byte: every moved slice re-derived from the pre-split backups (with the
   two intended path transforms) is present verbatim in the new files; leftover-count
   checks confirm no stray un-transformed / over-transformed occurrences.
5. Runtime prototype-chain method set equals the set of method names in the original
   source — Tor 54==54, ProxyManager 38==38, empty symmetric difference.
6. Functional spot-checks of pure methods returned expected values (getCountryCodes →
   30, getTransportTypes → none,obfs4,meek,snowflake,webtunnel, isOnionUrl v3 → true,
   getProxyRules socks5, formatProxyUrl, validateProxy, getModeDescription).
7. Consumers (`websocket/server.js`, `websocket/core/handler-deps.js`,
   `utils/tor-auto-setup.js`, tests) all require the barrels only — unaffected.

Integration gate (smoke:mvp) runs after, per the task.
