> **DISPOSITION — 2026-07-03 stabilization pass** (triage:
> `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md`; archived here as a
> point-in-time record, all items dispositioned):
>
> - I1 container-name collision → **done** (pre-pass: no `container_name:` anywhere, incl. monitoring compose)
> - I2/I3 project/network isolation keys → **done** (.env.example isolation block; deploy.sh preserves customized .env)
> - I4 wrong-corpus/no provenance → **done-in-this-pass** (`GET /api/status` whoami from `rag_meta` row)
> - I5 DB cross-contamination → **done-in-this-pass** (ingest-root guard `RAG_INGEST_ROOT_GUARD`, default on when `DOCS_PATH` set)
> - I6 contested port → **done-in-this-pass** (RAG_PORT_BASE=10000 band + preflight auto-pick)
> - I7 deploy.sh clobbers .env → **done-in-this-pass** (merge/append generate_env)
> - I8 ghost containers/networks → **done-in-this-pass** (start-path failure trap + `doctor` + `reset`)
> - I9 fastmcp version skew → **done-in-this-pass** (fastmcp==2.1.2 pinned; HTTP `/api/search` designated primary seam)
> - I10 no-root loopback Ollama → **done-in-this-pass** (`deploy.sh ollama-forwarder`: rootless socat + systemd --user unit template)
> - I11 non-openable stored paths → **done-in-this-pass** (`DOCS_PATH` same-path :ro mount, default-on)
> - R1-R7 → **done-in-this-pass** (each maps to the I-fixes above + `concurrent_files`/`retry_backoff`/batch embed for R7)
> - Future idea 1 (instance registry / `ls`) → **deferred-to-roadmap**
> - Future idea 2 (deep health) → **done-in-this-pass** (`/api/health?deep=1` embed + 1-NN probe; `/api/status` provenance)
> - Future idea 3 (symbol-aware code chunking) → **deferred-to-roadmap**
> - Future idea 4 (document_filepath in responses) → **done** (pre-pass)
> - Future idea 5 (multi-stack runbook) → **done-in-this-pass** (docs/TROUBLESHOOTING.md §6)
>
> No blacklisted items in this file (no k8s/Terraform/CI-CD asks).

# RAG Bootstrap — Suggestions

This file collects operator/setup-side friction and improvement ideas gathered
while standing up instances of this template in the field, so the core template
can absorb the fixes. Newest section first. Each dated section is self-contained.

Sibling feedback files in this repo (do not clobber; complementary scope):
- `RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md` — large-corpus (2k+ file) test.
- `SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03.md` — a *second* isolated
  instance stand-up (config.yaml/deploy.sh friction, ingest data-loss bugs).
- `SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md` — consumer-side (query-time) asks.

---

## 2026-07-03 — Multi-instance-on-one-host + no-root-Ollama stand-up

**Context (generic).** A vendored copy of this template was brought up as a
project-local documentation-RAG instance on a workstation that was **already
running two other stacks derived from / colliding with this template** (one whose
containers reused the old hardcoded `rag-bootstrap-*` names, and one whose compose
project name was the same directory name). The instance also had to reach a
**host Ollama that binds loopback-only with no root available**. The friction
below is what it took to get a *third* isolated instance coexisting cleanly. All
observations are generic; concrete values are illustrative.

### Issues Encountered

Each: **symptom → root cause → fix applied this session (if any)**.

#### I1. 🔴 Multi-instance container-name collision
- **Symptom:** bring-up failed / attached to the wrong stack because a
  container named e.g. `rag-bootstrap-api` already existed (owned by an unrelated
  live stack that had copied this template).
- **Root cause:** `docker-compose.yml` hardcoded `container_name: rag-bootstrap-*`
  on every service. A `container_name` is a **global** name on the host — it
  collides the instant a second instance (or any stack reusing those names)
  exists.
- **Fix applied:** **removed all `container_name:` lines** from
  `docker-compose.yml` and rely on Compose's automatic
  `<COMPOSE_PROJECT_NAME>-<service>-N` naming. **Upstreamed** into the template's
  `docker-compose.yml` (the `container_name` lines are gone; an inline comment
  explains why).

#### I2. 🔴 Default compose project-name collision
- **Symptom:** two unrelated instances silently shared a compose project (and thus
  network/volume namespace) — bringing one up disturbed the other.
- **Root cause:** with no `COMPOSE_PROJECT_NAME` set, Compose derives the project
  from the **directory name**. Two checkouts named the same (e.g. both `docs-rag`)
  map to the same project → shared `<project>_default` network and volume prefixes.
- **Fix applied:** set a **unique `COMPOSE_PROJECT_NAME` per instance** in `.env`
  (Compose reads it automatically). **Upstreamed** into `.env.example` with a
  prominent "INSTANCE ISOLATION — set a UNIQUE COMPOSE_PROJECT_NAME per instance"
  block.

#### I3. 🔴 Network-name collision
- **Symptom:** a new instance joined / clashed with another instance's docker
  network.
- **Root cause:** `RAG_NETWORK_NAME` defaulted to a shared literal
  (`rag-bootstrap`), so multiple instances requested the same named network.
- **Fix applied:** set an **instance-unique `RAG_NETWORK_NAME`** in `.env`. The
  template already parameterizes it; the `.env.example` now explicitly says to
  pick an instance-unique value.

> **Net of I1–I3:** running N instances on one host is now isolation-by-`.env`
> (unique project name + unique network + free port). Recommend making this
> **isolation-by-construction** rather than by-convention (see R1).

#### I4. 🟠 Wrong-corpus served with no provenance signal
- **Symptom:** a running endpoint answered queries **from a different project's
  corpus**; agents had no way to tell they were talking to the wrong index. The
  intended endpoint was simply **dead** while a foreign one on a nearby port
  answered — indistinguishable to a client.
- **Root cause:** no endpoint exposes **which project / which docs-root / how many
  docs** an instance is serving. A client can't verify provenance before trusting
  results. Combined with the port confusion (I3/I6) this is a silent-wrong-answer
  trap.
- **Fix applied:** none in-template this session (worked around by manual
  `/api/documents` count + eyeballing paths). **See R2** — a `status`/`whoami`
  endpoint is the fix.

#### I5. 🟠 Persisted-volume cross-contamination (DB pollution)
- **Symptom:** the vector DB contained a large block of **foreign documents**
  (another project's docs, ingested from an unrelated absolute path) mixed in with
  the intended corpus.
- **Root cause:** two factors combined — (a) no per-project **volume** isolation
  by default (see I2, volumes share the project prefix), and (b) **no
  ingest-provenance guard**: `/api/ingest/directory` will ingest *any* path handed
  to it, from any source, into whatever DB it's pointed at, with no record of
  "this instance's expected docs-root." A stray ingest of a foreign path silently
  pollutes the corpus.
- **Fix applied:** wiped and re-ingested the clean corpus; enforced per-instance
  project/volume isolation (I2). **See R2** — an ingest-root guard that
  flags/refuses out-of-tree ingests would have *prevented* this.

#### I6. 🟡 Hardcoded / contested API port
- **Symptom:** the intended host port was dead or contested; helper scripts
  assumed a single fixed port.
- **Root cause:** a single default port baked in as the fallback across
  `ask.sh` / `sync_and_ingest.sh` / `deploy.sh`. Although those scripts *do* honor
  a `RAG_PORT` env override, the baked-in default is easy to hit and there is no
  **auto-pick-a-free-port** path — so two instances race for the same default.
- **Fix applied:** ran the instance on a distinct free port via `RAG_PORT`. The
  scripts already read `RAG_PORT` from `.env`/env, so no code change was strictly
  required — but a free-port auto-pick (R1) would remove the manual step.

#### I7. 🟠 `deploy.sh` rewrites `.env` from `.env.example` → drops custom settings
- **Symptom:** the isolated instance **could not be brought up with the deploy
  script** — the script regenerated `.env` from `.env.example`, **dropping the
  custom `COMPOSE_PROJECT_NAME` / network / port**, which reintroduced the very
  collisions (I1–I3) the custom `.env` was there to prevent.
- **Root cause:** the deploy path treats `.env` as a generated artifact (writes
  keys into it, or regenerates it) and is not aware of instance-isolation keys it
  must preserve.
- **Fix applied:** **bypassed the deploy script** and used `docker compose up -d`
  directly (which reads the hand-authored isolated `.env`). Documented loudly in
  the instance README ("do NOT use the deploy script for this instance"). **See
  R1** — a deploy script that *preserves* a customized `.env` is the real fix.

#### I8. 🟡 Stale ghost containers / networks from prior failed runs block bring-up
- **Symptom:** bring-up failed because leftover containers/networks from earlier
  aborted attempts still held names/ports/networks.
- **Root cause:** a failed `up` leaves partial resources behind and nothing rolls
  them back (see also the sibling file's §1.5). On a busy multi-stack host these
  ghosts accumulate and block the next attempt.
- **Fix applied:** manual `docker compose down` + `docker network rm` +
  `docker rm` of the strays. **See R6** — a pre-bring-up cleanup/`down` step (or a
  `doctor`/`reset` subcommand) would automate this.

#### I9. 🟡 FastMCP host-vs-container version skew breaks the MCP path
- **Symptom:** the MCP-stdio server rejected `FastMCP(description=...)` /
  otherwise failed to start when the **host** `fastmcp` version differed from the
  **container** version (e.g. an older host lib vs a newer containerized one). The
  MCP tool surface was unusable; agents had to fall back to the HTTP `/api/search`
  path.
- **Root cause:** `fastmcp` is not version-pinned, and its constructor/API
  signature changed across releases (`description=` accepted in one, rejected in
  another). Any host/container drift breaks stdio MCP.
- **Fix applied:** used the HTTP `ask.sh` path instead of MCP. **See R4** — pin
  `fastmcp` (host+container to the same version), or officially make HTTP the
  primary agent seam and treat MCP as best-effort.

#### I10. 🟠 No-root Ollama binding (loopback-only host Ollama, no sudo)
- **Symptom:** the api container could not reach the host's Ollama for embeddings
  — the host Ollama bound `127.0.0.1:11434` only, and a container on the default
  bridge cannot reach the host's loopback. No root was available to flip
  `OLLAMA_HOST=0.0.0.0`.
- **Root cause:** the template assumes Ollama is reachable at
  `host.docker.internal:11434` (bridge gateway), which requires the host Ollama to
  listen on a bridge-reachable interface — not the default loopback-only bind. On
  Docker-Desktop hosts this "just works"; on a rootless Linux host with a
  systemd-managed Ollama it does not.
- **Fix applied:** wrote a small **unprivileged TCP forwarder** that listens on
  the docker bridge gateway (`172.17.0.1:11434`) and relays to the host's
  `127.0.0.1:11434` — needs no root (binding a non-privileged port on a normal
  interface). Made it durable with a **systemd `--user` service** + `loginctl
  enable-linger` + an `@reboot` cron fallback, and gave it a **self-guard** (probe
  the target on start; exit 0 if something already serves it, so the unit / cron /
  manual launch coexist safely). **See R5** — first-class endpoint-config that
  includes this no-root bridge as a supported mode.

#### I11. 🟡 Path-preserving ingest is easy to misconfigure
- **Symptom:** stored `document_filepath` values were container-relative
  (`/data/docs/...`) and thus **not openable** by the querying agent on the host —
  defeating the whole point of returning file paths.
- **Root cause:** `ingest_file()` stores `str(filepath.resolve())` — the path *as
  seen inside the container*. Unless the docs are bind-mounted at the **same
  absolute path** inside the container, the stored path doesn't resolve on the
  host. This is a subtle, load-bearing mount requirement with no guardrail.
- **Fix applied:** bind-mounted the docs root **read-only at the identical
  absolute path** inside the container (`/host/docs:/host/docs:ro`) and ingested
  by that path, so stored `document_filepath` == a host-openable path. (This
  duplicates the sibling file's §2.5 finding — it recurs, so it's worth a
  first-class template pattern; see R3/R8.)

### Rate-Limiting Assessment

**Honest verdict: rag-bootstrap itself imposed NO real rate-limiting friction this
session.**

- **Ollama pulls / registry:** pulling the embedding (and a small chat) model
  completed normally — no registry throttling / 429s observed during model pulls.
- **Bulk ingest / embedding service:** the serial one-round-trip-per-chunk embed
  loop is **slow** (a throughput characteristic — see R7/§(c) batching), but it is
  **not rate-limited**; embedding POSTs returned `200 OK` steadily. No client-side
  concurrency cap, backoff, or 429 handling was exercised because none was needed.
- **API rate limits:** the template exposes no request rate limiter; none was hit.
- **The only real resource risk is shared-Ollama contention**, not HTTP rate
  limiting — multiple stacks funneling embeds/generation through one Ollama
  endpoint compete for VRAM/compute (echoing the sibling file's §3). That's a
  *contention/throughput* concern, not a rate-limit.

**Explicitly distinct:** a separate Claude-API weekly usage limit was hit by the
**orchestrator's own Claude budget** during the session. That is **unrelated to
rag-bootstrap** — it is the agent platform's API quota, not anything this template
imposes or triggers. rag-bootstrap had **no** rate-limiting issue of its own.

### Template Improvement Recommendations (prioritized)

**R1. 🔴 Isolation-by-construction (not by-convention).**
The `.env`/compose parameterization (unique `COMPOSE_PROJECT_NAME`, network, port)
already exists — make it *automatic* so N instances coexist with zero hand-editing:
- On first run, if `COMPOSE_PROJECT_NAME` is unset, **derive a unique one** (e.g.
  from the parent dir + a short hash) and persist it to `.env`.
- **Auto-pick a free host port**: preflight `ss -ltn`/`lsof` and pick the first
  free port in a range if the requested one is taken (the sibling file's §1.4 also
  asks for this) — instead of failing late on a port-bind error.
- **Per-instance volume namespace** falls out of a unique project name; assert it.
- Ship a **deploy path that PRESERVES a customized `.env`** (I7): never regenerate
  over instance-isolation keys — merge/append only, or refuse to clobber a `.env`
  that already sets `COMPOSE_PROJECT_NAME`.

**R2. 🟠 Corpus provenance + ingest guard (prevents I4/I5).**
- Stamp each instance/index with its **project name + expected docs-root** (persist
  in a DB meta row at first ingest).
- Add a **`GET /api/status` / `/whoami`** endpoint returning
  `{project_name, docs_root, documents, chunks, embedding_model, dimension,
  indexed_at}` so a client can verify it's talking to the right corpus **before**
  trusting results.
- Add an **ingest-provenance guard**: `/api/ingest/directory` flags (warn) or
  refuses (strict, configurable) a path **outside the instance's recorded
  docs-root**, so a stray foreign-path ingest can't silently pollute the DB.

**R3. 🟠 First-class same-path docs mount (fixes I11 permanently).**
Make the "mount docs read-only at their real absolute path so stored paths are
host-openable" pattern a **documented, defaulted** deploy mode (a single
`DOCS_PATH` var that drives `- ${DOCS_PATH}:${DOCS_PATH}:ro` **and** the ingest
target), rather than a gotcha each operator rediscovers. Optionally store both an
`abs_path` and a `root_relative_path` + a configurable host-prefix so results
render an openable path regardless of mount layout.

**R4. 🟠 Version-pin the MCP path — or officially prefer HTTP (fixes I9).**
Pin `fastmcp` to a single version in **both** the host tooling and the container
image so the stdio MCP path works reliably; document the required version. If MCP
is not going to be first-class, **officially designate the HTTP `/api/search` path
as the primary agent seam** and label MCP best-effort, so agents don't waste a
cycle on a broken MCP handshake.

**R5. 🟠 First-class Ollama endpoint config, incl. the no-root bridge (fixes I10).**
Promote Ollama endpoint selection to a documented deploy option with modes:
`local` (host.docker.internal, Desktop-style), `remote` (ssh-tunnel bound to
`0.0.0.0` so the bridge can reach it, or a remote provider URL), and **`bridge`**
(the no-root unprivileged TCP forwarder on the docker bridge gateway). **Ship the
forwarder script + a systemd `--user` unit template** (with the self-guard and the
linger/`@reboot` durability notes) as a supported artifact — this is the only path
that works on a rootless Linux host with a loopback-only Ollama.

**R6. 🟡 Ghost-container/network cleanup + preflight doctor (fixes I8).**
Add a pre-bring-up cleanup that `down`s the instance's own stale resources, plus a
`doctor` subcommand that checks: port free, Ollama reachable + required models
pulled, disk space, and **echoes the effective resolved config** before building
anything (the sibling file's §1.5/§6 ask for the same). A `reset` that wipes
data + re-inits (handling root-owned `./data`) closes the loop.

**R7. 🟡 Batch/concurrent embedding ingest (throughput, not rate-limit).**
The serial one-round-trip-per-chunk embed loop makes a full corpus a
tens-of-minutes job. Batch embeddings where the backend supports it and/or add a
configurable concurrency cap + retry-with-backoff, so a busy shared Ollama
degrades gracefully and ingest is faster. (Overlaps sibling file §3 / §6.F.)

### Future-Useful Ideas

1. **Instance registry / `ls` command.** A tiny host-level registry (e.g. a
   JSON file or a `docs-rag ls`) listing **which instance serves which project on
   which port**, so an operator/agent can discover the right endpoint instead of
   guessing. Directly addresses the "which of these three stacks do I query?"
   confusion (I4/I6).

2. **One-command health + doc-count + provenance check.** A single
   `health.sh`/`GET /api/health?deep=1` that returns liveness **and** proves
   retrieval end-to-end (embed a fixed string, do a 1-NN lookup) **and** reports
   `{project, docs_root, documents, chunks}` — so "is this the right, working
   index?" is one call. (Combines R2 provenance with the sibling file's deep-health
   idea.)

3. **Code-file symbol-aware ingestion (`.py`/`.js`/`.go`).** Optional
   symbol-/declaration-aware chunking for source files so a function/class stays
   whole in a chunk, instead of size-window cuts mid-body — makes the template
   useful for indexing code, not just prose docs. (Opt-in; prose path unchanged.)

4. **`document_filepath` in every response** — already upstreamed this session
   (threaded end-to-end through search/hybrid/keyword/MCP result shapes; additive,
   null-safe, no migration). Noted here for completeness; keep it in the core
   template so every fork has host-openable path references.

5. **A published deploy runbook for the multi-stack host.** A short doc: "running
   several isolated instances on one machine" — unique project/network/port,
   the same-path docs mount, the endpoint-config modes, and the cleanup/doctor
   steps — so the whole I1–I11 arc is a checklist, not a rediscovery.
