---
title: "Obscura Deep-Dive: obscura-cli (fetch / serve / scrape / mcp)"
date: 2026-07-03
researcher: Claude (Basset Hound architecture research)
status: Complete
category: reverse-engineering / cli-architecture
---

# obscura-cli — Command-Line Front End

> Reverse-engineered from the Apache-2.0 source at `/home/devel/tmp/obscura`.
> Every claim below cites a concrete file + line/symbol. Read against
> `crates/obscura-cli/` and the `docs/` files named in the focus.

## 1. Purpose & Scope

`obscura-cli` is the user-facing binary crate that wires the Obscura engine
crates (`obscura-browser`, `obscura-cdp`, `obscura-mcp`, `obscura-net`,
`obscura-dom`, `obscura-js`) into four subcommands plus a default CDP-server
mode. It is a thin orchestration layer: it parses flags with `clap`, sets a
couple of process-global knobs (timezone, V8 flags, SSRF policy) **before** any
V8 isolate exists, then dispatches into the engine crates.

The crate produces **two** binaries (`crates/obscura-cli/Cargo.toml:6-12`):

| Binary | Path | Role |
| --- | --- | --- |
| `obscura` | `src/main.rs` | The CLI users invoke. |
| `obscura-worker` | `src/worker.rs` | A one-page-per-process helper spawned by `scrape`. |

Dependencies are declared in `crates/obscura-cli/Cargo.toml:19-33`: all six
sibling engine crates plus `tokio`, `clap`, `tracing`/`tracing-subscriber`,
`anyhow`, `url`, `serde`, `serde_json`. A single `stealth` feature
(`Cargo.toml:15-16`) fans out to `obscura-browser/stealth`, `obscura-net/stealth`,
and `obscura-mcp/stealth` — i.e. stealth is a compile-time capability, not just
a runtime flag.

## 2. Key Files

| File | Lines | Responsibility |
| --- | --- | --- |
| `src/main.rs` | 1983 | `clap` arg model, `main()` dispatch, all `fetch`/`scrape`/`serve` logic, dump formatters, batch runner, load balancer. |
| `src/worker.rs` | 145 | Long-lived subprocess driving a single `Page`; NDJSON-over-stdio command loop. |
| `build.rs` | 36 | Computes `OBSCURA_BUILD_VERSION` from env/git tag at compile time. |
| `tests/mcp_client.rs` | 301 | Integration test: spawns `obscura mcp` (stdio) and exercises the JSON-RPC/MCP surface. |

## 3. The `clap` Argument Model

### 3.1 Top-level `Args` struct — `src/main.rs:10-57`

```rust
#[derive(Parser)]
#[command(name = "obscura", version = env!("OBSCURA_BUILD_VERSION"), ...)]
struct Args {
    #[arg(short, long, global = true)] verbose: bool,          // :17
    #[command(subcommand)] command: Option<Command>,           // :20-21
    #[arg(short, long, default_value_t = 9222)] port: u16,     // :23-24
    #[arg(long, global = true)] proxy: Option<String>,         // :26-27
    #[arg(long, global = true)] stealth: bool,                 // :32-33
    #[arg(long)] obey_robots: bool,                            // :35-36
    #[arg(long)] user_agent: Option<String>,                   // :38-39
    #[arg(long)] storage_dir: Option<PathBuf>,                 // :41-42
    #[arg(long, global = true)] allow_private_network: bool,   // :49-50
    #[arg(long, value_name="FLAGS", allow_hyphen_values=true)] v8_flags: Option<String>, // :55-56
}
```

**Only four flags are actually `global = true`** (verified by
`grep "global = true"` → `src/main.rs:17,26,32,49`): `--verbose`, `--proxy`,
`--stealth`, `--allow-private-network`. Those are the flags that work *before or
after* a subcommand.

### 3.2 The `Command` enum — `src/main.rs:59-186`

Four variants (`Serve`, `Fetch`, `Scrape`, `Mcp`), each with its own inline
`#[arg]` fields. `command` is `Option<Command>` so **no subcommand is legal** and
falls through to a bare CDP server (see §4.6).

### 3.3 `DumpFormat` enum — `src/main.rs:189-209`

`clap::ValueEnum` with seven variants: `Html`, `Text`, `Links`, `Markdown`,
`Original`, `Assets`, `Cookies`. The doc comments are the authoritative spec:
`Original` (:195-198) "bypasses the browser/JS layer", `Assets` (:199-204) emits
NDJSON of every sub-resource, `Cookies` (:205-208) dumps the jar including
HttpOnly cookies.

## 4. Control Flow: `main()` — `src/main.rs:284-405`

`#[tokio::main(flavor = "current_thread")]` (:284) — the whole CLI runs on a
**single-threaded** tokio runtime. Sequence:

1. **Parse** args (:286).
2. **Pin timezone** (:296-300) *before* V8/ICU initialises. Honors an existing
   `TZ`, else `OBSCURA_TIMEZONE`, else defaults to `Europe/Berlin`. The `unsafe
   set_var` is justified in-comment because it runs before any worker thread /
   isolate exists (:294-295).
3. **Init logging** (:302-310): `select_log_filter` (:225-233) chooses `debug`
   (verbose) / `off` (quiet) / `warn` (default); `RUST_LOG` from the environment
   overrides via `EnvFilter::try_from_default_env` (:306-307). Logs go to
   **stderr** (:309) so stdout stays clean for piped output.
4. **Apply V8 flags** (:312-314): `effective_v8_flags` merges defaults + user
   string, then `obscura_js::set_v8_flags`.
5. **Mirror SSRF flag** (:320-325): if `--allow-private-network`, set
   `OBSCURA_ALLOW_PRIVATE_NETWORK=1` so the JS-side fetch op (`op_fetch_url`)
   and the `http_client` layer share one policy (issue #33, commented :316-319).
6. **Dispatch** on `args.command` (:330-402).

### 4.1 Timezone / V8 / SSRF are set process-wide, once

These three side effects are the crate's real reason to exist as a wrapper —
they must happen before isolate creation. `set_v8_flags`
(`crates/obscura-js/src/v8_flags.rs:16-25`) uses a `std::sync::Once` and
`deno_core::v8::V8::set_flags_from_string`; **an empty string is a no-op that
does not consume the guard** (:17-19), so the CLI can call it unconditionally.

Default V8 flags are architecture-dependent (`src/main.rs:272-275`):
- 64-bit: `--max-old-space-size=4096 --max-semi-space-size=4 --optimize-for-size`
- non-64-bit: `--max-old-space-size=1024 --max-semi-space-size=4 --optimize-for-size`

`effective_v8_flags` (:277-282) appends the user string **after** the defaults so
"later wins" in V8's left-to-right parse (test at :1698-1706 pins this).

### 4.2 `fetch` — `src/main.rs:362-383` → `run_fetch` (:539-682)

Two paths gated on `--file`:

- **`--file` present** (:363-376): batch mode. Rejects a positional URL +
  `--file` together (:364-366). **Only `--dump original` (or no `--dump`) is
  allowed in batch mode** (:369-374) — any rendered format bails with a message
  pointing at `scrape`. Reads URLs via `read_urls_from_file` and calls
  `run_batch_fetch`.
- **single URL** (:377-382): `run_fetch`.

`run_fetch` control flow:
1. `dump_specified` records whether the user passed `--dump` explicitly (:558);
   default is `Html` (:559). This matters for `--eval` (see below).
2. **`--dump original` short-circuit** (:565-575): calls `fetch_original_bytes`
   (raw HTTP, no browser) and streams bytes verbatim via `write_or_print_bytes`.
   `unreachable!` guards the later match arm (:674).
3. Otherwise build a `BrowserContext::with_storage_and_network` (:577-584) and a
   `Page` (:585), set UA on the http_client if provided (:587-589).
4. `wait_until` string → `WaitUntil` enum via
   `obscura_browser::lifecycle::WaitUntil::from_str` (:591; enum at
   `crates/obscura-browser/src/lifecycle.rs:34-41` — recognises
   `domcontentloaded`, `networkidle0`/`networkidle`, `networkidle2`, else
   `Load`).
5. **Hard-timeout daemon thread** (:604-611): a detached `std::thread` sleeps
   `timeout + wait + 10s` then `std::process::exit(124)`. This is the backstop
   for a synchronous hang inside a native Rust op that neither tokio nor the V8
   watchdog can cancel (rationale commented at :597-603).
6. `navigate_with_wait` wrapped in a tokio `timeout` (:613-620).
7. `page.settle(wait_secs*1000)` (:630) drives the event loop until idle.
8. **`--eval` handling** (:632-657): a *bare* `--eval` (no `--selector`, no
   `--dump`) returns the eval value directly (:640-649) — String/Null/other are
   rendered specially. Combined with `--selector`/`--dump` it settles again
   (:656) then falls through so async DOM writes complete (issue #248).
9. `--selector` waits for the node via `wait_for_selector` (:659-664, poll loop
   at :888-905, 100 ms cadence); prints a warning if not found but does **not**
   fail.
10. Dispatch on `DumpFormat` (:666-675) to the dump formatters, then
    `write_or_print` and `context.save_cookies()` (:676-679).

### 4.3 Dump formatters

| Format | Function | Notes |
| --- | --- | --- |
| `html` | `dump_html` (:912-922) | `outer_html` of `<html>`, prefixed `<!DOCTYPE html>`. |
| `text` | `dump_text` (:924-933) → `extract_readable_text` (:940-998) | Recursive DOM walk; **strips `script/style/nav/header/footer/aside`** as boilerplate (:971-976); inserts newlines around block elements. |
| `markdown` | `dump_markdown` (:935-938) | Runs `obscura_browser::HTML_TO_MARKDOWN_JS` in-page (re-exported from obscura-js, `crates/obscura-browser/src/lib.rs:9`). |
| `links` | `dump_links` (:1239-1269) | Every `<a href>`, resolved against base URL, `TAB`-separated `url\ttext`. |
| `assets` | `dump_assets` (:1353-1379) → `extract_assets` (:1327-1351) | NDJSON, one `{"url","type"}` per sub-resource from `ASSET_SELECTORS` (:1274-1284), **plus** JS `fetch()`/XHR URLs via `page.fetched_urls()` tagged `"fetch"`, de-duplicated against static DOM URLs (:1364-1376, issue #301). |
| `original` | `fetch_original_bytes` (:708-715) | Raw HTTP body, handled before navigation. |
| `cookies` | `dump_cookies` (:907-910) | `page.context.cookie_jar.get_all_cookies()` as pretty JSON. |

`extract_assets` is written **pure over `DomTree`/`Url`** (:1327) specifically so
unit tests (:1871-1981) can drive it without a live browser. `link_kind_from_rel`
(:1290-1303) maps `<link rel>` tokens to specific kinds (stylesheet/icon/manifest/…).

### 4.4 Batch fetch — `run_batch_fetch` (:745-851)

- Input read by `read_urls_from_file` (:720-739): reads a file or **stdin when
  path is `-`** (:721-727); trims whitespace, **skips blank lines and `#`
  comments** (:733-738). Test at :1455-1473.
- Concurrency via a `tokio::sync::Semaphore` sized to `--concurrency`
  (:767, default `NonZeroUsize(1)` at :119-120). Using `NonZeroUsize` means
  `--concurrency 0` is a **parse error**, not a zero-permit deadlock (test
  :1447-1452).
- Each task calls `fetch_original_response` (raw HTTP via
  `obscura_net::ObscuraHttpClient`, :684-706) and builds a JSON status object:
  on success `{url, ok:(200..400), status, content_type, bytes, elapsed_ms}`
  (:786-793); on error `{url, ok:false, error, elapsed_ms}` (:794-799).
- **Output stays in input order** regardless of completion order — results are
  slotted by index into a `Vec<Option<_>>` (:805-816), then emitted as NDJSON
  (:818-822). A `--quiet`-gated summary line goes to stderr (:840-848).
- Batch mode is **raw HTTP only** — no proxy merging beyond `global_proxy`, no
  stealth, no UA rotation, no browser. This is by design (comment :367-368).

### 4.5 `scrape` — `src/main.rs:384-386` → `run_parallel_scrape` (:1000-1237)

The only subcommand that uses the **separate `obscura-worker` process** model:

1. Locate `obscura-worker` (`obscura-worker.exe` on Windows) **next to the
   current exe** (:1024-1028); bail with a build hint if missing (:1030-1035).
2. Semaphore-bounded concurrency, default **10** (:156-157, :1037).
3. Per URL, spawn one worker with piped stdin/stdout, null stderr (:1056-1063),
   passing **proxy + stealth via env vars** `OBSCURA_PROXY` / `OBSCURA_STEALTH`
   (:1060-1061) — *not* CLI flags.
4. Protocol per worker (all wrapped in a `worker_timeout`, :1098):
   - send `{"cmd":"navigate","url":…}` (:1099-1107), read one JSON line
     (:1109-1114); bail on `ok:false` (:1119-1126); capture `result.title`
     (:1128-1131).
   - if `--eval`, send `{"cmd":"evaluate","expression":…}` (:1134-1153) and
     capture `result`.
   - send `{"cmd":"shutdown"}` (:1158-1163) and `child.wait()`.
   - On any error/timeout, `child.kill()` (:1077, :1088, :1182).
5. Output: aggregate `{total_urls, concurrency, total_time_ms, avg_time_ms,
   results:[…]}` — **`--format json` (default)** pretty-prints this whole object
   (:1205-1213); **any other format value** falls to a tab-separated
   `time_ms\turl\ttitle|eval` line loop (:1214-1234). `--format` is a bare
   `String` (:159-160), so it is **not validated** — `--format html` silently
   yields the TSV fallback, not HTML.

`read_timeout` is `min(timeout, 30)` s (:1041) and `shutdown_timeout` is 5 s
(:1042).

### 4.6 `serve` and the no-subcommand default

- **Single worker** (:355-360): `obscura_cdp::start_with_full_serve_options`
  (`crates/obscura-cdp/src/server.rs:110-119`) receives port, host, proxy,
  stealth, UA, `allow_file_access`, `storage_dir`, `allow_private_network`.
- **`--workers > 1`** (:352-354): `run_multi_worker_serve` (:407-537) — a
  round-robin TCP load balancer:
  - Spawns N child `obscura serve --port <port+1+i>` processes
    (:421-440), forwarding `--proxy/--user-agent/--stealth` **but not**
    `--storage-dir`, `--allow-file-access`, `--allow-private-network`, or
    `--host` (children stay on loopback default).
  - Binds the balancer to the requested `host` so Docker `-p` mapping works
    (:449-450, issue #336).
  - Round-robins via `next_worker % workers` (:456-457).
  - Peeks the first bytes; `GET …/json` requests get a fresh worker connection
    with a std-stream round-trip (:461-515); everything else (WebSocket CDP) is
    proxied via `copy_bidirectional` (:518-535). Unreachable workers → raw
    `502 Bad Gateway` (:506-511, :527-532).
- **No subcommand** (:395-401): prints the banner and calls
  `obscura_cdp::start_with_options(args.port, args.proxy, stealth)` — the
  minimal CDP server. This is the *only* place the top-level `--port`
  (default 9222) and top-level `--proxy` are read.

### 4.7 `mcp` — `src/main.rs:387-394`

Merges proxy (:388), then either `obscura_mcp::http::run(host, port, proxy, ua,
stealth)` (`crates/obscura-mcp/src/http.rs:64`) for `--http`, or
`obscura_mcp::run(proxy, ua, stealth)` (`crates/obscura-mcp/src/lib.rs:173`) for
the default **stdio** transport. `tests/mcp_client.rs` exercises the stdio path
end-to-end (JSON-RPC `initialize`/`tools/list`/`tools/call`, :112-301) and lists
the expected tool names (:142-157, e.g. `browser_navigate`, `browser_snapshot`,
`browser_evaluate`).

## 5. The Worker Protocol — `src/worker.rs`

A separate binary running its own `current_thread` runtime (:43-44). It:
- Reads `OBSCURA_PROXY` (trimmed, empty→None, :50-53) and `OBSCURA_STEALTH`
  (truthy set `1/true/yes/on`, :54-56).
- Builds `BrowserContext::with_options(id, proxy, stealth)` (:57) — the
  **minimal** constructor. **No UA, no storage_dir, no allow_private_network,
  no timezone override** flow into the worker context.
- Loops over newline-delimited JSON on stdin (:65-144), dispatching a
  `#[serde(tag="cmd")]` `WorkerCommand` enum (:8-23): `navigate`, `evaluate`,
  `title`, `dump_html`, `dump_text`, `shutdown`. Replies are one-line
  `WorkerResponse {ok, result?, error?}` (:25-41).

**Coverage gap:** the parent `run_parallel_scrape` only ever sends `navigate`,
`evaluate`, and `shutdown` (:1099, :1134, :1158). The worker's `title`,
`dump_html`, and `dump_text` commands (:14-20, :107-129) are **defined but never
invoked by the CLI** — there is no CLI path that returns rendered HTML/text from
a parallel scrape. To get HTML you must fetch URLs one at a time.

## 6. Build-Time Version — `build.rs`

`OBSCURA_BUILD_VERSION` is resolved with precedence (:30-33): `OBSCURA_VERSION`
env → GitHub tag (`GITHUB_REF_TYPE==tag` ⇒ `GITHUB_REF_NAME`, else
`refs/tags/…` from `GITHUB_REF`, :14-22) → `CARGO_PKG_VERSION`. Leading `v` is
stripped (`normalize_version`, :10-12). It is consumed via
`env!("OBSCURA_BUILD_VERSION")` in the `#[command(version=…)]` attribute
(`main.rs:13`) and the banner (`main.rs:220-222`).

## 7. Configuration Surface Summary

### 7.1 Flag → engine mapping

| Flag | Scope | Where consumed |
| --- | --- | --- |
| `--verbose/-v` | global | `select_log_filter` (:225) |
| `--proxy` | global | merged per subcommand via `merge_proxy` (:244-246); command value wins over global |
| `--stealth` | global | threaded into every context/server; compile-gated by `stealth` feature |
| `--allow-private-network` | global | mirrored to env (:320-325) + passed to context/serve |
| `--v8-flags` | top-level (NOT global) | `effective_v8_flags` (:312) |
| `--port/-p` | top-level | only the no-subcommand default server (:396-400) |
| per-subcommand `--proxy/--user-agent/--storage-dir/--quiet/--timeout/...` | subcommand | destructured in the `match` |

### 7.2 Environment variables (cross-referenced with `docs/Environment-variables.md`)

Read directly by obscura-cli code:
- `OBSCURA_TIMEZONE` / `TZ` — `main.rs:296-300`.
- `OBSCURA_ALLOW_PRIVATE_NETWORK` — mirrored *from* the flag (`main.rs:324`);
  read by the net/JS layers.
- `OBSCURA_PROXY`, `OBSCURA_STEALTH` — set by scrape parent (`main.rs:1060-1061`),
  read by the worker (`worker.rs:50-56`).
- `RUST_LOG` — via `EnvFilter::try_from_default_env` (`main.rs:306`).

Documented but consumed in sibling crates (not obscura-cli): `OBSCURA_NAV_TIMEOUT_MS`,
`OBSCURA_CDP_COMMAND_TIMEOUT_MS`, `OBSCURA_FETCH_TIMEOUT_MS`, `OBSCURA_GEOLOCATION`,
`OBSCURA_PROFILE`, `OBSCURA_ROTATE_PROFILE`, `OBSCURA_MCP_ALLOWED_ORIGINS`
(`docs/Environment-variables.md:17-93`). Notably Obscura **ignores
`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`** (`docs/Environment-variables.md:129-131`).

## 8. Notable Design Decisions

1. **Single-threaded tokio runtime** (`main.rs:284`, `worker.rs:43`) — V8 is not
   `Send`; one isolate per process keeps the model simple. Concurrency in
   `scrape` is achieved by **spawning OS processes**, not threads.
2. **stdout is a data channel; stderr is for logs.** Logs → stderr
   (`main.rs:309`), and `write_or_print_bytes` deliberately avoids `println!` to
   not append a newline that would corrupt binary payloads (:864-886, regression
   test :1507-1528).
3. **Layered timeouts.** Per-op tokio `timeout` (:613), plus a native
   hard-timeout thread that `exit(124)`s the whole process (:604-611) because a
   synchronous native op can't be cancelled cooperatively.
4. **`--dump original` bypasses the engine entirely** (:565-575) so binary/non-
   HTML resources round-trip byte-exact (PNG round-trip test :1475-1505).
5. **Deterministic asset ordering** — `ASSET_SELECTORS` is a fixed-order const
   slice (:1273-1284) so `--dump assets` output is stable across runs.
6. **`NonZeroUsize` concurrency** turns a foot-gun (0 permits) into a parse
   error (:119-120, :156-157).
7. **Proxy precedence via `merge_proxy`** (:244-246): subcommand `--proxy`
   overrides the global one (tests :1793-1808).

## 9. Limitations & Coverage Gaps

1. **Dead top-level flags.** `--obey-robots` (:36), top-level `--user-agent`
   (:39), and top-level `--storage-dir` (:42) are parsed but **never read** in
   `main()` (grep of `args.*` shows no use). The per-subcommand `--user-agent`/
   `--storage-dir` are the live ones. Worse, `context.obey_robots` defaults to
   `false` (`crates/obscura-browser/src/context.rs:131`) and is never set from
   the CLI — so **`--obey-robots` is a complete no-op**; robots.txt is never
   honored via the CLI even though `page.rs:921` checks the field.
2. **Doc vs. code on "global."** `docs/CLI-reference.md:1-3` says "Top-level
   flags apply to every subcommand," but only 4 flags carry `global = true`;
   `--v8-flags` must be positioned **before** the subcommand (tests place it
   there, :1601-1650). `--port`, top-level `--user-agent`, `--storage-dir`,
   `--obey-robots` are neither global nor (mostly) used.
3. **`scrape` cannot return page content.** Only `title` + `eval` result are
   surfaced (:1165-1171); the worker's `dump_html`/`dump_text` are never called
   (§5). No `--dump`/`--selector`/`--output` on `scrape`.
4. **`scrape` config is thin.** Worker context has no UA, storage, timezone, or
   private-network policy (`worker.rs:57`); `scrape` also lacks its own
   `--proxy` flag (relies on `global_proxy`, :385) and `--allow-private-network`
   is not forwarded to workers.
5. **`--format` is unvalidated free text** (:159-160). Anything other than
   `"json"` silently means TSV; there is no `text`/`csv`/`ndjson` enum.
6. **Multi-worker `serve` drops flags.** `storage_dir`, `allow_file_access`,
   and `allow_private_network` are not propagated to child workers
   (:421-440), and there is **no health-check/restart** — a crashed worker just
   yields `502`s until the port is dead (:527-532). The balancer is naive
   round-robin with no load awareness.
7. **Batch `fetch` is raw HTTP only** (:367-374) — no rendering, stealth, or UA
   rotation; JSON status only, no body capture to per-URL files.
8. **`--output` semantics differ by path.** `run_fetch`/`run_batch_fetch` write
   a single file; there is no templated per-URL output for batch/scrape — batch
   writes one concatenated NDJSON blob (:824-838).

## 10. How obscura-cli Connects to the Rest of Obscura

```
                         obscura (src/main.rs)
   ┌───────────┬──────────────┬─────────────────┬───────────────┐
 fetch        serve          scrape             mcp        (no subcmd)
   │            │               │                 │              │
   │            │               │        obscura_mcp::run /      │
   │   obscura_cdp::start_*     │        http::run              obscura_cdp::
   │   (server.rs:48,110)       │        (lib.rs:173 /          start_with_options
   │            │        spawn obscura-worker    http.rs:64)    (server.rs:48)
   │            │        (src/worker.rs)          │
   ▼            ▼               ▼                 ▼
 BrowserContext + Page  ◄──── obscura_browser (context.rs, page.rs, lifecycle.rs)
 obscura_net (ObscuraHttpClient, CookieJar)  ◄── raw HTTP + SSRF gate
 obscura_dom (DomTree, query_selector, parse_html)  ◄── dump formatters
 obscura_js (set_v8_flags, HTML_TO_MARKDOWN_JS)  ◄── V8 + markdown
```

- `fetch`/no-subcommand/`serve`(single) build `Page`/`BrowserContext` directly
  and drive the DOM (`obscura-dom`) for dump output.
- `scrape` is the outlier: it shells out to `obscura-worker`, a *sibling binary
  in the same crate*, over stdio JSON. The two binaries are a matched pair and
  must live in the same directory (`docs/Installation.md:60`,
  `docs/CLI-reference.md:96`).
- `mcp` and `serve` hand control to `obscura-mcp` / `obscura-cdp` respectively
  and never return until the server exits.

The crate contributes **zero** browser/network/DOM logic of its own beyond the
CLI-only dump formatters and the batch/load-balancer plumbing; everything
substantive is delegated. Its distinctive value is (a) the pre-isolate process
setup (timezone, V8 flags, SSRF mirror) and (b) the process-per-page `scrape`
concurrency model.
