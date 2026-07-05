> **DISPOSITION — 2026-07-03 stabilization pass** (triage:
> `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md`; archived here as a
> point-in-time record, all items dispositioned):
>
> - §1.1 boilerplate RAG hint → **done-in-this-pass** (`agent_hints/HOW_TO_QUERY.md` single-include header)
> - §1.2 index-freshness signal → **done-in-this-pass** (`GET /health/index` with `staleness_class`)
> - §1.3 cite-back schema → **done-in-this-pass** (`[[RAG:path#chunk@score]]` format in CONSUMING_AGENTS_CONTRACT.md §5)
> - §1.4 RAG telemetry → **done-in-this-pass** (`X-Chunk-Bytes` response header + structured `search_access` log)
> - §1.5 hardcoded URL → **done-in-this-pass** (`RAG_ENDPOINT_URL` discovery + `client/ragq.py` CLI)
> - §1.6 project scoping → **done-in-this-pass** (`corpus` path-prefix filter on search)
> - §1.7 fallback policy → **done-in-this-pass** (`client/fallback_policy.py`)
> - §2 token-budget note in PERFORMANCE.md → **done-in-this-pass** (docs/PERFORMANCE.md §3)
> - §3.1 install-for-project.sh → **deferred-to-roadmap**
> - §3.2 palletai orchestra snippet → **deferred-to-roadmap** (out-of-tree coupling; contract doc covers the seam)
> - §3.3 health preflight doc → **done-in-this-pass** (contract §3; `/api/health` + `/health/index`)
> - §3.4 version-in-URL → **done-in-this-pass** (`/api/v1/*` shipped as ADDITIVE aliases; `/api/search` unchanged)
> - §3.5 post-commit ingest hook → **done-in-this-pass** (`scripts/post_commit_rag_ingest.py` template)
> - §3.6 stale-chunk retention → **done-in-this-pass** (`expire_stale_chunks` marks vanished-path chunks expired each ingest pass)
> - §4 future features (diff-context lookups, symbol-aware chunks, CLAUDE.md-aware ranking, multi-corpus federation, full_doc_url, /stats dashboard) → **deferred-to-roadmap**
> - §5 consuming-agent contract → **done-in-this-pass** (`CONSUMING_AGENTS_CONTRACT.md`)
>
> No blacklisted items in this file (no k8s/Terraform/CI-CD asks).

# Suggestions from ResearchHub agent workflows (2026-06-23)

**Author context:** Written by a Claude Code agent operating in the
ResearchHub session (`/home/devel/researchhub`). The agent USED the
palletai standalone docs-rag at `http://127.0.0.1:8108/api/search` for
context retrieval from ~10 subagents over ~8 workflows. It did NOT
install or bootstrap rag-bootstrap directly — these observations are
from the consumer side.

**Purpose:** Feedback and improvement ideas that came up while using
docs-rag as a token-savings tool from a busy multi-agent workflow.
Compact by design; delete anything you disagree with.

---

## 1. Issues encountered (consumer-side)

### 1.1 The RAG hint is boilerplate in every prompt

Every subagent prompt across this session included a ~200-word RAG_NOTE
block:

```
DOCS-RAG retrieval: query http://127.0.0.1:8108/api/search via
curl -X POST -H Content-Type:application/json -d
{"query":"text","limit":5} for context lookup. Saves tokens vs full
Read. Fall back to grep + Read if RAG unreachable. DO NOT integrate
RAG into researchhub-api.
```

Repeated verbatim in every workflow script. **Suggestion:** ship a
lint-hint header file at the template's canonical path (e.g.
`rag-bootstrap/agent_hints/HOW_TO_QUERY.md`) that an orchestrator can
`cat` into a prompt via a single include token. Then every prompt
becomes `... {{RAG_HINT}} ...` and updates land centrally. Bonus: the
hint can name the current RAG URL, current index generation, and
current auth shape without touching every downstream script.

### 1.2 No index-freshness signal

Agents cannot tell if the RAG index reflects codebase state HEAD or a
week-old snapshot. This matters when an agent queries "current
signature of `research_operations/sync_scheduler`" — the answer might
be stale by a Sprint's worth of refactors.

**Suggestion:** expose an endpoint like `GET /health/index` returning
`{indexed_commit_sha, indexed_at, corpus_bytes, chunks, staleness_class:
fresh|hours|days|weeks}`. Every agent hint can then say "query this
first; if staleness_class ≥ days, prefer grep for authoritative
answers on code shape."

### 1.3 No cite-back schema for RAG hits

Agents that used RAG in this session self-formatted the "I used chunk X
from doc Y" sourcing in ad-hoc prose. Some cited `doc_path` from the
API response, others cited `score`, others said nothing. Downstream
verifiers had no consistent surface to audit against.

**Suggestion:** publish a canonical response schema for the search
endpoint (`doc_path`, `chunk_index`, `chunk_text`, `score`, `corpus`,
maybe `indexed_at`) and a "recommended agent citation format" in the
template. Something like `[[RAG:doc_path#chunk_index@score]]` inline so
verify agents can grep for hits and confirm they weren't hallucinated.

### 1.4 No RAG telemetry on the orchestrator side

I have no idea how many tokens RAG saved this session vs the
counterfactual of full-doc `Read` calls. Every prompt asked agents to
"report RAG-savings rollup" — those numbers were self-reported and
non-uniform.

**Suggestion:** if the RAG server can emit access logs with
`{session_id, tool_call_id, query, chunks_returned, bytes_returned}`,
an orchestrator can post-process a session-log to produce a real
token-savings number. Even a `X-Chunk-Bytes` response header suffices.

### 1.5 Single hard-coded URL across every project

Every prompt in every workflow hard-coded `http://127.0.0.1:8108`.
Changing the RAG URL means editing dozens of workflow scripts.

**Suggestion:** each consuming project reads the URL from a single
config surface — `~/.config/rag/endpoint.json` or an env-var
`RAG_ENDPOINT_URL`. Template can ship a helper `rag-bootstrap/client/`
that exports a tiny CLI (`ragq "query" --limit 5`) so agents shell
into that instead of raw curl.

### 1.6 No project-scoping in queries

The palletai RAG index appears to serve corpus for whichever project's
docs are ingested. A ResearchHub agent asking about `SyncScheduler`
would benefit from `corpus=researchhub` scoping. If both PalletAI and
ResearchHub feed the same index, a query for "workflows" gets tangled.

**Suggestion:** add `corpus` / `project` filter to the query API.
Agents pass their project name; RAG filters. Corpuses can still share a
single index — just filter at query time.

### 1.7 Fall-back path is undefined

I told every agent "fall back to grep + Read if RAG unreachable." No
agent reported ever falling back (probably because RAG was up), but if
RAG had returned 503 mid-workflow, agents had no shared retry policy.

**Suggestion:** document the fallback shape: 1 retry on 5xx, then
grep + Read for the remaining work in that turn. Template can ship a
`rag-bootstrap/client/fallback_policy.py` that agents import; keeps
the retry logic identical across projects.

---

## 2. Rate limiting observations

**No first-hand RAG rate-limit errors seen.** All ~10 subagents queried
palletai standalone with no reported 429s or backoffs. Query volumes
were modest (typically 2-5 queries per agent, `limit=5` chunks each).

**Rate-limits that DID fire** this session were on the Claude Code
side (session limits + weekly limits + occasional server-side "please
slow down" 429s during heavy parallel workflow dispatch). Those are
not RAG issues but they DO shape how the RAG hint should be worded:
if a caller is going to hit its own rate limit anyway, adding
RAG queries below the ceiling helps overall throughput.

**Suggestion:** in the template's `PERFORMANCE.md` (if any), add a
note like "each RAG query is roughly N tokens output; count it against
your own budget when computing a parallel workflow's fanout." A
consuming orchestrator can then pick a fanout that keeps everyone
under both RAG server AND Claude API rate limits.

---

## 3. Template improvements — infra + docs

### 3.1 First-run bootstrap script

I don't know if this exists yet. From ResearchHub's earlier audit
(`docs/findings/docs_rag_standalone_deployment_plan_2026-06-22.md` +
`docs_rag_4_way_impl_audit_2026-06-22.md`), the palletai standalone
was described as the canonical deployment but the "how do I install
this for a new project" recipe wasn't visible from the consumer side.

**Suggestion:** ship a `rag-bootstrap/install-for-project.sh <project_name>`
that:

- Creates a new corpus dir under the RAG server's data root
- Registers the project name in the corpus registry
- Prints the exact env vars the project's agent hints need
- Idempotent (safe to re-run)

Bonus if it can also print a `CLAUDE.md` snippet the consuming project
can copy into its own memory ("this project queries RAG at X for
corpus Y").

### 3.2 Composability with palletai orchestra

The palletai orchestra context file at
`/home/devel/palletai/claude_code_orchestra/CONTEXT_FOR_NEW_CONVERSATIONS.md`
names 31 agent roles + inter-team handoff protocol but doesn't cross
into RAG. If rag-bootstrap ships an "agent role: rag-querier" or a
"tool: rag_search" adapter that the orchestra context can enumerate,
consumers get uniform "how do agents talk to the RAG" out of the box.

**Suggestion:** publish `rag-bootstrap/orchestra/context_snippet.md`
that the orchestra CONTEXT file can `include:`. Every consuming project's
orchestrator learns the RAG tool the same way.

### 3.3 Health-endpoint doc for pre-flight

Related to §1.2: a pre-flight `curl -sS http://<rag>/health` that
agents can run at the top of a workflow to short-circuit if RAG is
down. Currently agents don't check — they just curl the search
endpoint and hope. If RAG happens to be down when a workflow starts,
some agents catch it and fall back, some don't.

**Suggestion:** document a `/health` (or `/ready`) contract explicitly
and put it in agent hints as "always call this first."

### 3.4 Version-in-URL or version-in-header

If the search API changes shape (e.g. adds `corpus` per §1.6), old
agents need to break gracefully. `v1/search` vs `v2/search` in the
path, or `X-API-Version: 2` header, lets consumers pin.

**Suggestion:** even if there's only one version today, ship it as
`/api/v1/search` so v2 is trivial to introduce.

### 3.5 Per-project corpus ingest hooks

The 4-way impl audit noted a `post_commit_backup.py` pattern for
snapshotting content-addressed backups. Same idea for RAG:
`post_commit_rag_ingest.py` that reindexes a project's `docs/` +
selected code paths after each commit.

**Suggestion:** ship a template hook. Consumers copy into their
`.git/hooks/post-commit`, RAG stays fresh automatically.

### 3.6 Retention policy on stale chunks

When a doc is deleted or renamed, its RAG chunks become orphaned.
Long-lived corpuses accumulate stale hits.

**Suggestion:** ingestion pass computes a set of "currently-known
paths" and marks chunks whose path is missing as expired. Serve
expired chunks with a `score` penalty (or filter them out entirely
by default; expose `include_expired=true` for forensic queries).

---

## 4. Future features that would have paid off this session

- **Diff-context lookups.** "What signals does `sync_scheduler`
  currently expose?" is a common agent question. Instead of returning
  the top-5 chunks by embedding similarity, return the chunks whose
  path matches `research_operations/sync_scheduler*` first, then fall
  through to similarity. Reduces the "we're editing X, we want to
  know about X" latency.
- **Symbol-aware chunks.** Chunk `.py` files at function/class
  boundaries, not fixed 400-token windows. Then a query for
  "class QuestionGraph" retrieves that class's definition, not the
  middle of a random neighbor.
- **CLAUDE.md-aware ranking.** If a consuming project's `CLAUDE.md`
  names files or paths as canonical, boost their chunks in ranking.
  Right now the consuming project's own doctrine has no signal at
  the RAG layer.
- **Multi-corpus federation.** A ResearchHub agent asking a
  cross-project question ("how does PalletAI handle X?") could
  federate across corpora. Each corpus tagged, results interleaved
  or scored per-corpus, cite `corpus` in the response.
- **"Show me the raw doc" convenience.** After a chunk hit, if the
  agent wants the whole doc, having `chunk_response.full_doc_url`
  saves a second grep. Small quality-of-life.
- **Cost / freshness dashboard.** A single page (`GET /stats`) with
  index-size, last-ingest-at, query-rate, top-queries. Operators
  running the standalone RAG want visibility.

---

## 5. Meta suggestion for the core template

**Publish a "consuming-agent contract" doc.** One page. What every
Claude-agent-based consuming project can rely on. Concretely:

1. Endpoint URL discovery (env var + default).
2. Query API shape (fields, response schema, pagination).
3. Health-check endpoint + expected response.
4. Fallback policy.
5. Recommended citation format.
6. Rate-limit posture (does the RAG server enforce; what does the
   client see on limit; recommended backoff).
7. Version pinning.
8. Corpus / project scoping.

If that doc exists as `rag-bootstrap/CONSUMING_AGENTS_CONTRACT.md` and
every consuming project's `CLAUDE.md` links to it, all the "how do I
use this from an agent workflow" boilerplate collapses into one line
per prompt: "Follow ~/exudeai/rag-bootstrap/CONSUMING_AGENTS_CONTRACT.md."

That would have cut ~200 words of RAG_NOTE from every subagent prompt
this session — measurable token savings before any actual RAG query
fires.

---

## 6. Cross-references (ResearchHub-side)

Prior audits I'm building on:

- `~/researchhub/docs/findings/docs_rag_4_way_impl_audit_2026-06-22.md`
  — 4-way implementation audit that recommended upstream backport to
  this repo (was queued on 72h soak; if that soak has completed, the
  backport should proceed).
- `~/researchhub/docs/findings/docs_rag_standalone_deployment_plan_2026-06-22.md`
  — canonical standalone deployment plan.
- `~/researchhub/CLAUDE.md` §6 #3a — the researchhub-side blacklist
  on in-process RAG integration (retrieval-only OK, wiring blacklisted).

---

## 7. Word count

~1610 words. Compact by design.
