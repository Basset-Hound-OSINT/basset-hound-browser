---
title: "Obscura Deep-Dive: Production Deployment, Concurrency & Resource Model"
date: 2026-07-03
researcher: Claude (Basset Hound architecture research)
status: Complete
category: production-deployment
---

# Obscura — Production Deployment, Multi-Worker Concurrency & Resource Footprint

## Purpose & scope

This document reverse-engineers how Obscura (Apache-2.0 headless browser,
`h4ckf0r0day/obscura`) is packaged and operated in production: the distroless
Docker image, the multi-worker/serve concurrency model, its V8/heap resource
tuning, environment-variable configuration, and the reliability backstops that
let it be pointed at hostile pages at scale. Everything below is grounded in the
on-disk source at `/home/devel/tmp/obscura`.

Two source files anchor the focus:

- `Dockerfile` — the multi-stage build and distroless runtime image.
- `docs/Run-in-production-at-scale.md` — the operator-facing runbook.

The load-bearing *implementation* lives in the CLI and CDP crates
(`crates/obscura-cli/src/main.rs`, `crates/obscura-cli/src/worker.rs`,
`crates/obscura-cdp/src/server.rs`, `crates/obscura-js/src/v8_lock.rs`,
`crates/obscura-js/src/v8_flags.rs`).

---

## 1. The Docker image (`Dockerfile`)

### 1.1 Multi-stage build

The `Dockerfile` is a two-stage build:

- **Builder stage** (`Dockerfile:1`): `FROM rust:1-slim-bookworm AS builder`.
  It installs only `curl`, `ca-certificates`, `perl`, `make`
  (`Dockerfile:3-8`) — `perl`/`make` are present to compile a vendored native
  dependency (the classic openssl-sys vendored build; see `OPENSSL_NO_VENDOR`
  escape hatch in `docs/Environment-variables.md:111-117`).
- **Runtime stage** (`Dockerfile:42`): `FROM gcr.io/distroless/cc-debian12`.
  The comment on `Dockerfile:41` states the deliberate choice: *"distroless/cc:
  glibc + libgcc + CA certs only — no shell, no package manager."* Only the two
  compiled binaries are copied in (`Dockerfile:44-45`):

```dockerfile
COPY --from=builder /build/target/release/obscura /obscura
COPY --from=builder /build/target/release/obscura-worker /obscura-worker
```

`README.md:188` reports the resulting image is *"~57 MB compressed"* on
`distroless/cc`, with no shell and no package manager.

### 1.2 Dependency-compilation caching

Before copying real source, the build copies only the workspace + per-crate
`Cargo.toml`/`Cargo.lock` (`Dockerfile:13-20`), writes stub `lib.rs`/`main.rs`
files (`Dockerfile:22-28`), and runs a throwaway
`cargo build --release --bin obscura --bin obscura-worker` (`Dockerfile:30`,
tolerant of failure via `|| true`). Only then are real sources copied and the
build re-run (`Dockerfile:35-37`). This is the standard Rust layer-caching trick
so the expensive dependency compile is cached unless a manifest changes.

The build is version-stamped through an `ARG OBSCURA_VERSION` (`Dockerfile:32`),
which `crates/obscura-cli/build.rs` turns into the `OBSCURA_BUILD_VERSION`
compile-time env used by `--version`/the banner (`build.rs:30-35`;
consumed at `crates/obscura-cli/src/main.rs:13` and `:222`).

### 1.3 Entry point and the loopback-vs-0.0.0.0 override

```dockerfile
EXPOSE 9222
ENTRYPOINT ["/obscura"]
CMD ["serve", "--port", "9222", "--host", "0.0.0.0"]
```

(`Dockerfile:47-53`.) The comment (`Dockerfile:49-51`) is important: the
**native binary defaults to `127.0.0.1` (loopback only)**; the container CMD
explicitly overrides `--host 0.0.0.0` so a `-p 9222:9222` port mapping is
reachable. This matches the CLI default `--host 127.0.0.1`
(`crates/obscura-cli/src/main.rs:69-70`). Note the container CMD does **not**
pass `--workers`, so the default image runs a **single** worker; scaling out
requires overriding the command.

### 1.4 Multi-arch CI build

`.github/workflows/docker.yml` builds and pushes on `v*` tags
(`docker.yml:4-6`). It uses QEMU + Buildx to produce
`platforms: linux/amd64,linux/arm64` (`docker.yml:17-21`, `:43`), passes
`OBSCURA_VERSION` as a build-arg from the tag (`docker.yml:29-39`), tags both
the version and `latest` (`docker.yml:40-42`), and uses GitHub Actions cache
(`cache-from/to: type=gha`, `docker.yml:44-45`).

---

## 2. Concurrency model — the single-thread V8 bottleneck

This is the single most important architectural fact for scaling Obscura, and it
is *why* multi-worker exists.

### 2.1 One OS thread, one process-wide V8 lock

`obscura serve` runs on a **current-thread** tokio runtime
(`#[tokio::main(flavor = "current_thread")]`, `crates/obscura-cli/src/main.rs:284`)
and drives all per-page `JsRuntime`s on a single OS thread via a
`tokio::task::LocalSet` + `spawn_local` (`crates/obscura-cdp/src/server.rs:177-226`).

Because V8 requires that only one `Isolate` is entered on a thread at a time,
Obscura serializes *all* V8 work behind a **process-wide async mutex**. From
`crates/obscura-js/src/v8_lock.rs:1-26`:

```rust
//! Process-wide async lock that serializes V8 work across all `JsRuntime`s.
//! ...As soon as two pages' V8-touching futures interleave across an `.await`,
//! V8 trips its `heap->isolate() == Isolate::TryGetCurrent()` check and aborts
//! the whole process...
static V8_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
pub fn global() -> &'static Mutex<()> { V8_LOCK.get_or_init(|| Mutex::new(())) }
```

The dispatcher acquires it around every V8-touching command
(`crates/obscura-cdp/src/dispatch.rs:288-293`). The doc-comment is candid that
this is *"the issue-19 'Option 1' fix"* and that true intra-process concurrency
(one `JsRuntime` per OS thread) is a **larger refactor tracked separately**
(`v8_lock.rs:15-17`).

**Consequence:** a single `obscura serve` process gives you *concurrency of I/O*
but **not parallelism of JavaScript** — pages take turns holding the V8 lock. To
use more than one CPU core for JS you must run multiple processes. That is
exactly what `--workers` does.

### 2.2 Keeping the control plane alive under V8 load

Because V8 can monopolize the LocalSet thread, the HTTP discovery endpoints
(`/json/version`, `/json`, `/json/protocol`) are served from a **dedicated OS
accept thread with blocking I/O**, not the LocalSet
(`crates/obscura-cdp/src/server.rs:125-175`, `:244-290`). WebSocket upgrades are
handed off to the LocalSet through a **bounded** channel
(`MAX_PENDING_WS_HANDOFFS = 128`, `server.rs:29`); when saturated the accept
thread *drops the new connection* rather than buffering FDs unboundedly
(`server.rs:281-289`). A second bound, `MAX_DEFERRED_MESSAGES = 256`
(`server.rs:19`), caps the per-navigation deferral queue.

---

## 3. Multi-worker serve (`--workers N`)

### 3.1 What the operator sees

`docs/Run-in-production-at-scale.md:41-49`:

> `obscura serve --workers N` runs N CDP server workers behind the listener.
> Use one worker per CPU core. Each worker handles its own pool of pages.
> Sessions are sticky to a worker.

The flag is defined at `crates/obscura-cli/src/main.rs:78-79` (`--workers`,
default `1`). When `workers > 1` the CLI calls `run_multi_worker_serve`
(`main.rs:352-354`); otherwise it goes straight to
`obscura_cdp::start_with_full_serve_options` (`main.rs:356-359`).

### 3.2 How it actually works — a round-robin TCP proxy over child processes

`run_multi_worker_serve` (`crates/obscura-cli/src/main.rs:407-537`) is a
**parent-process load balancer over N spawned child processes**, not threads:

1. **Spawn children** (`main.rs:421-440`): for each `i in 0..workers` it spawns
   `current_exe serve --port (port+1+i)` as a **separate OS process**, with
   stdout/stderr sent to `/dev/null`. Children bind their own port on the default
   host (loopback), so they are only reachable by the balancer.
2. **Fixed 500 ms warm-up** (`main.rs:442`): `sleep(500ms)` — there is no
   readiness probe; it just waits half a second before binding.
3. **Bind the balancer** on the requested `host:port` (`main.rs:449-450`). The
   comment (`main.rs:444-448`) notes the balancer must honor `--host 0.0.0.0` in
   Docker while workers stay on loopback (issue #336).
4. **Accept loop** (`main.rs:454-536`): each incoming connection is assigned a
   worker by **pure round-robin**:

```rust
let worker_port = port + 1 + (next_worker % workers);
next_worker = next_worker.wrapping_add(1);
```

   For `GET /json*` requests it proxies to the worker's HTTP endpoint
   (`main.rs:464-515`); everything else (the WebSocket upgrade) is bridged with
   `tokio::io::copy_bidirectional` (`main.rs:518-535`). If the chosen worker
   can't be reached the balancer returns `HTTP/1.1 502 Bad Gateway`
   (`main.rs:507-511`, `:526-533`).

### 3.3 "Sticky sessions" — what that really means

The routing key is the **TCP connection**, not a CDP session id. A Puppeteer/
Playwright client opens **one** WebSocket to `/devtools/browser` and multiplexes
all its CDP sessions over that single connection; round-robin runs at
`accept()` time, so every session on that connection lands on **one** worker.
That per-connection pinning is the "sticky" property — there is **no
session-id-aware routing** and **no re-balancing** of an existing connection.

### 3.4 Gaps in the multi-worker path (verified in source)

The child-spawn command builder (`crates/obscura-cli/src/main.rs:423-433`) only
forwards `--proxy`, `--user-agent`, and `--stealth`. It does **not** propagate:

- `--v8-flags` — **workers run with default V8 flags only**; a user's
  `--v8-flags` on the parent is silently *not* inherited by the children.
- `--storage-dir` — persistent cookie/localStorage dir is not passed to workers.
- `--allow-file-access`, `--allow-private-network` — security toggles are lost.
- `--quiet`/`--verbose`, port `--host` — children default to loopback (intended)
  but also to default logging.

There is also **no supervision**: the parent keeps the `children` handles in a
`Vec` (`main.rs:419`, `:439`) but never `wait()`s on them or restarts a crashed
worker. A dead worker keeps receiving ~`1/N` of new connections and answers them
with `502` until the whole container is restarted. There is no health check,
graceful drain, or backoff.

---

## 4. Parallel `scrape` — process-per-URL fan-out

Separate from `serve --workers`, the `scrape` subcommand
(`crates/obscura-cli/src/main.rs:150-167`, `run_parallel_scrape` at
`main.rs:1000-1237`) fans a URL list across the **`obscura-worker` binary**:

- Concurrency is a `NonZeroUsize` (`--concurrency`, default `10`,
  `main.rs:156-157`) enforced by a `tokio::sync::Semaphore` (`main.rs:1037`,
  `:1053`). `NonZeroUsize` means `--concurrency 0` is a *parse error*, not a
  zero-permit hang (test at `main.rs:1447-1452`).
- It locates `obscura-worker` **next to the `obscura` binary** and errors out if
  missing (`main.rs:1024-1035`) — the doc restates this requirement
  (`docs/Run-in-production-at-scale.md:79`).
- **One child process per URL** (`TokioCommand::new(worker_path)`,
  `main.rs:1056-1063`), talking newline-delimited JSON over stdin/stdout:
  `navigate` → optional `evaluate` → `shutdown` (`main.rs:1098-1163`). Proxy and
  stealth reach the worker via `OBSCURA_PROXY` / `OBSCURA_STEALTH` env vars
  (`main.rs:1060-1061`), which `worker.rs:50-57` reads.
- Two nested timeouts: a per-worker overall `timeout_secs`
  (`--timeout`, default `60`, `main.rs:162-163`, `:1040`) and a per-read timeout
  of `min(timeout, 30)s` (`main.rs:1041`). On overrun the child is killed
  (`main.rs:1180-1188`).

The worker itself (`crates/obscura-cli/src/worker.rs`) is a minimal
current-thread tokio loop (`worker.rs:43-48`) over a `BrowserContext`/`Page`
(`worker.rs:57-58`) with a tiny command enum (`worker.rs:8-23`). It is a
throwaway, isolated process — heavier per-URL than a page pool, but a crash or
hang is contained to one URL.

`fetch --file … --concurrency N` (`main.rs:363-376`, `run_batch_fetch` at
`main.rs:745-851`) is a *third*, lighter fan-out: it does **raw HTTP only**
(`--dump original`), never rendering, using an in-process semaphore
(`main.rs:767`) — no child processes, no browser stack.

---

## 5. V8 heap & RSS tuning

### 5.1 Defaults

`crates/obscura-cli/src/main.rs:272-275` sets architecture-dependent defaults:

```rust
#[cfg(target_pointer_width = "64")]
const DEFAULT_V8_FLAGS: &str = "--max-old-space-size=4096 --max-semi-space-size=4 --optimize-for-size";
#[cfg(not(target_pointer_width = "64"))]
const DEFAULT_V8_FLAGS: &str = "--max-old-space-size=1024 --max-semi-space-size=4 --optimize-for-size";
```

The rationale (`main.rs:260-271`): a ~4 GB old-space matches headless Chrome so
heavy fingerprinting/analytics bundles don't `SIGTRAP` out of the box (issue
#199); `--max-semi-space-size=4` caps the young generation and
`--optimize-for-size` trades codegen footprint for RSS, together cutting RSS
"~18% on heavy pages (ycombinator.com 173 MB → 140 MB) at no measurable speed
cost." `docs/Run-in-production-at-scale.md:52-59` and
`docs/Environment-variables.md:119-127` document the same.

### 5.2 User override semantics

`effective_v8_flags` (`main.rs:277-282`) **appends** the user string after the
defaults: `format!("{} {}", DEFAULT_V8_FLAGS, u)`. Because V8 parses left-to-
right and *last wins*, a user's `--max-old-space-size=2048` overrides the default
while the memory-tuning flags stay in effect (`main.rs:264-266`,
`docs/Run-in-production-at-scale.md:59`).

Flags are applied exactly once, before the first isolate, via a `Once` guard in
`crates/obscura-js/src/v8_flags.rs:16-24` (`V8::set_flags_from_string`). An empty
/whitespace string is a no-op that does **not** consume the guard
(`v8_flags.rs:17-20`). The CLI calls `set_v8_flags` early in `main`
(`main.rs:312-314`). V8 flags are passed **only** via `--v8-flags`, never an env
var (`docs/Environment-variables.md:119-127`).

### 5.3 Per-process memory caps are external

Obscura enforces no cgroup/RLIMIT memory cap itself. The runbook delegates this
to the platform: systemd `MemoryMax=4G`/`MemoryHigh=3G`
(`docs/Run-in-production-at-scale.md:82-89`) or Docker `--memory=4g --cpus=2`
(`:91-95`). The `LimitNOFILE=65536` in the sample unit (`:30`) is the only FD
tuning suggested.

---

## 6. Environment-variable configuration surface

All runtime tunables are read directly from the process environment (documented
in `docs/Environment-variables.md`), verified in source:

| Env var | Default | Source of truth |
| --- | --- | --- |
| `OBSCURA_NAV_TIMEOUT_MS` | `30000` | `crates/obscura-browser/src/page.rs:792-795` |
| `OBSCURA_CDP_COMMAND_TIMEOUT_MS` | `60000` (`0` disables) | `crates/obscura-cdp/src/dispatch.rs:304-307` |
| `OBSCURA_FETCH_TIMEOUT_MS` | `30000` | `crates/obscura-js/src/ops.rs:567-570` |
| `OBSCURA_ALLOW_PRIVATE_NETWORK` | off (SSRF blocked) | mirrored from `--allow-private-network` at `main.rs:320-325`; consumed by the SSRF gate |
| `OBSCURA_TIMEZONE` | `Europe/Berlin` | `main.rs:296-300` (sets `TZ` before V8/ICU init) |
| `OBSCURA_GEOLOCATION`, `OBSCURA_PROFILE`, `OBSCURA_ROTATE_PROFILE` | see docs | `docs/Environment-variables.md:61-83` |
| `OBSCURA_PROXY` | none | worker reads it at `worker.rs:50-53`; scrape sets it at `main.rs:1060` |
| `OBSCURA_STEALTH` | off | worker reads it at `worker.rs:54-56` |
| `OBSCURA_MCP_ALLOWED_ORIGINS` | off (permissive) | `crates/obscura-mcp/src/http.rs:15-19`, gate at `:143-152` |
| `RUST_LOG` | `warn`/`info`/`off` selected by flags | `main.rs:225-233`, `:304-310` |

Note `OBSCURA_TIMEZONE`/`TZ` must be set *before* any isolate starts; the CLI
does this at the very top of `main` and marks the `set_var` `unsafe` precisely
because it must run single-threaded (`main.rs:288-300`).

Obscura deliberately **ignores** the conventional `HTTP_PROXY`/`HTTPS_PROXY`/
`NO_PROXY` variables; you must use `--proxy` or `OBSCURA_PROXY`
(`docs/Environment-variables.md:129-131`).

---

## 7. Reliability & timeout backstops (hostile-page hardening)

`docs/Run-in-production-at-scale.md:143-156` promises that *"one page cannot
hang, crash, or wedge a worker."* The mechanisms:

- **Per-CDP-command V8 watchdog** (`crates/obscura-cdp/src/dispatch.rs:295-314`,
  `:353-367`): since a handler holds the process-wide V8 lock, a runaway
  `Runtime.evaluate`/synchronous DOM op is terminated after
  `OBSCURA_CDP_COMMAND_TIMEOUT_MS` by `cdp_watchdog::arm`, which terminates just
  that isolate so it cannot stall the shared lock. On fire it logs and clears the
  termination flag (`dispatch.rs:356-366`).
- **Per-navigation ceiling** via `OBSCURA_NAV_TIMEOUT_MS`
  (`crates/obscura-browser/src/page.rs:792-800`, `tokio::time::timeout`).
- **Scripted-fetch/XHR/module-load bound** via `OBSCURA_FETCH_TIMEOUT_MS`
  passed to `reqwest::Client::builder().timeout(...)`
  (`crates/obscura-js/src/ops.rs:567-573`).
- **Process-level hard deadline** — but only in the *one-shot* `fetch` path: a
  daemon thread `std::process::exit(124)` if the whole op overruns
  `timeout + wait + 10s` (`main.rs:604-611`). The long-running `serve` cannot
  force-exit, which is exactly why it uses the per-command watchdog instead
  (`dispatch.rs:298-300`).

---

## 8. Security posture in production

- **No built-in authentication.** `docs/Run-in-production-at-scale.md:113-121`:
  *"Obscura's CDP server has no built-in auth. Anyone who can reach the port can
  drive the browser."* Mitigations are operational: bind loopback (the default,
  `main.rs:69-70`), reverse proxy with auth, or Docker network isolation.
- **SSRF blocked by default.** Private/loopback/link-local (incl. the
  `169.254.169.254` cloud-metadata endpoint) fetches are denied unless
  `--allow-private-network`/`OBSCURA_ALLOW_PRIVATE_NETWORK` is set, and the guard
  validates at **DNS-resolution** time to be DNS-rebinding-safe
  (`docs/Environment-variables.md:3-15`; resolver wired at `ops.rs:575`).
- **`file://` navigation off by default** — `--allow-file-access` gates it so a
  CDP connection cannot read arbitrary local files
  (`main.rs:81-86`; warning logged at `server.rs:143-145`).
- **MCP HTTP transport** caps request bodies at `16 MiB`
  (`MAX_BODY_BYTES = 16 * 1024 * 1024`, `crates/obscura-mcp/src/http.rs:13`,
  enforced at `:204`) and supports an `Origin` allowlist
  (`OBSCURA_MCP_ALLOWED_ORIGINS`) so a browser page can't drive a loopback MCP
  port cross-origin (`http.rs:143-152`); non-browser clients that send no
  `Origin` are always allowed (`docs/Environment-variables.md:85-93`). It, too,
  has no built-in auth.
- **Reverse proxy** guidance requires WebSocket upgrade headers and long read
  timeouts because CDP is a persistent WS
  (`docs/Run-in-production-at-scale.md:97-111`).

---

## 9. Observability

Observability is **logs only**. `--verbose` maps to info-level, `RUST_LOG`
selects the `tracing` filter, and everything goes to **stderr**
(`docs/Run-in-production-at-scale.md:134-141`; filter selection at
`main.rs:225-233`, subscriber writing to `std::io::stderr` at `main.rs:304-310`).
There are **no** Prometheus/OpenTelemetry metrics, no structured `/healthz`, and
no request counters. The `/json/version` and `/json` endpoints
(`crates/obscura-cdp/src/server.rs:303-320`) exist for CDP client discovery, not
health — though `/json/version` can double as a liveness probe since it is served
off the always-available accept thread.

---

## 10. Deployment recipes shipped in the docs

`docs/Run-in-production-at-scale.md` provides three ready-made patterns:

- **Docker** (`:1-13`): `docker run -d --restart unless-stopped -p
  127.0.0.1:9222:9222 -v /srv/obscura/data:/data … serve --host 0.0.0.0
  --storage-dir /data --stealth`. Note the host-side bind pins to `127.0.0.1`
  even while the in-container `--host` is `0.0.0.0`.
- **systemd** (`:15-39`): a unit with `Restart=always`, `RestartSec=5`, a
  dedicated `obscura` user/group, and `LimitNOFILE=65536`.
- **Reverse proxy** nginx snippet with `Upgrade`/`Connection: upgrade` and
  `proxy_read_timeout 86400` (`:99-111`).

---

## 11. Limitations & gaps (what production deployment does NOT do)

1. **No intra-process JS parallelism.** A single `serve` process serializes all
   V8 behind a process-wide mutex (`v8_lock.rs:22-26`); more cores requires more
   processes. The "true concurrency" fix is explicitly deferred (`v8_lock.rs:15-17`).
2. **Multi-worker is an unsupervised round-robin proxy.** No health checks, no
   restart of crashed children, no session-aware routing, no graceful drain; a
   dead worker returns `502` for its share of traffic until manual restart
   (`main.rs:407-537`, esp. `:439`, `:507-511`).
3. **Config drops on the worker path.** `--v8-flags`, `--storage-dir`,
   `--allow-file-access`, and `--allow-private-network` are **not** forwarded to
   spawned workers — only `--proxy`, `--user-agent`, `--stealth` are
   (`main.rs:423-433`). Operators who rely on those flags plus `--workers >1`
   get different behavior than they configured.
4. **No built-in auth on either the CDP or MCP server** (`Run-in-production…:113-121`,
   `:123-132`). Security is entirely operational (loopback bind, proxy, network
   isolation).
5. **No metrics/health endpoint.** Observability is stderr logs only (§9); there
   is no Prometheus surface, request rate/latency counter, or dedicated health
   check.
6. **No auto-scaling / no worker pool reuse in `scrape`.** `scrape` spawns a
   fresh `obscura-worker` process *per URL* (`main.rs:1056`), not a persistent
   pool — robust isolation, but process-spawn overhead per URL.
7. **No in-process memory cap.** RSS is bounded only by V8 heap flags plus
   external systemd/Docker limits (§5.3); a burst of concurrent heavy pages in
   one process can still climb toward the 4 GB old-space ceiling.
8. **Default image is single-worker.** The shipped `CMD` omits `--workers`
   (`Dockerfile:53`); horizontal scaling inside one container requires overriding
   the command, and cross-container scaling needs an external load balancer.

---

## 12. How this connects to the rest of Obscura

- **CLI (`crates/obscura-cli`)** is the deployment surface: `main.rs` owns
  argument parsing, the multi-worker balancer, `scrape`/`fetch` fan-out, and V8
  flag/timezone bootstrapping; `worker.rs` is the `obscura-worker` child used by
  `scrape`.
- **CDP server (`crates/obscura-cdp`)** is what `serve` runs per process
  (`server.rs`), including the accept-thread/LocalSet split and the per-command
  watchdog (`dispatch.rs`) that make one process safe under hostile pages.
- **JS engine (`crates/obscura-js`)** provides the process-wide V8 lock
  (`v8_lock.rs`), the one-shot flag applier (`v8_flags.rs`), and the fetch op
  whose timeout/SSRF guard bound network I/O (`ops.rs`).
- **Browser (`crates/obscura-browser`)** owns navigation timeouts (`page.rs`).
- **MCP (`crates/obscura-mcp`)** is an alternate front-end with its own HTTP
  hardening (`http.rs`) reachable via `obscura mcp --http`.

The production story is therefore: **process = unit of parallelism**, hardened
internally by timeouts/watchdogs/bounded queues, packaged as a tiny distroless
image, and scaled either by `--workers N` (a built-in round-robin proxy over
sibling processes) or by an external orchestrator running many containers behind
a real load balancer.
