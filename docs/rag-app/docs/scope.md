# RAG Bootstrap — Project Scope

## FROZEN-PROJECT POLICY (load-bearing — do not delete)

> Adopted: W67 (2026-06-04). Reaffirmed: 2026-06-14.
> Source authority: MEMORY.md (`feedback_frozen_projects`) + user instructions across W67-W74 mega-arc.
> 2026-07-03: user-authorized overhaul pass (Ollama default, port base 10000, path
> portability, async ingest, docs taxonomy) supersedes the freeze for this scope;
> see `docs/findings/2026-07-03_rag_bootstrap_execution_plan.md`.

Two sub-projects in this monorepo are **FROZEN** and must NOT be touched by any agent or session for any reason short of an explicit, in-conversation user override that names the project by name:

- `rag-bootstrap/`  — STABLE, the only sub-project the user wants "perfectly stable and left alone"
- `production-atc-app/`  — STABLE, "just does not need to be touched at all"

What "frozen" means in practice:

- No edits to source files, tests, configs, scripts, or pyproject
- No edits to docs/, README.md, DEPLOY.md, or any other docs file EXCEPT this frozen-policy block itself
- No new files created inside these directories
- No deletions, renames, or moves involving these directories
- No commits that include any file under these paths
- No `pip install` / venv mutation inside these projects
- No HPC jobs that read or write files under these paths
- No test runs that import code from these projects
- Workflow agents must list both paths in their READ_ONLY / BLOCKED zone every time they are spawned

How to know you are about to violate this rule:

- A file path you are about to Edit/Write/Bash-touch starts with `/home/devel/exudeai/rag-bootstrap/` or `/home/devel/exudeai/production-atc-app/` → STOP
- A planning doc instructs you to "refresh docs across all projects" → frozen projects are excluded by default
- A grep / find / sweep returns matches inside these paths → filter them out before acting
- A workflow spec omits the frozen list from RULES → reject the spec, ask for confirmation

How to override (rare):

- User must explicitly name the project (`rag-bootstrap` or `production-atc-app`) in the same message that authorizes the touch
- A general "do everything" or "update all projects" does NOT override this rule
- This block itself is the ONLY exception that may be edited without an override (because keeping it accurate strengthens the rule)

Why the rule exists:

- `rag-bootstrap` is the user-facing RAG system; stability is more valuable than any improvement we might land
- `production-atc-app` is launch-gated by a security cluster (WP-K); any drift complicates the security review
- W67 retrospective documents the original adoption decision: see `docs/archives/session_records/2026-06-14_w47_to_w74_mega_arc_retrospective.md`

## Overview

Universal RAG bootstrap for rapid document ingestion and semantic search.
Designed to be copied into any project as a self-contained RAG layer.

## Objectives

- Provide one-command RAG deployment for any project (`./bootstrap.sh`)
- Support multiple document types and embedding backends
- Hybrid search (semantic + keyword + fusion via RRF)
- MCP integration for agent/LLM tool use
- LLM-powered Q&A via Ollama (default: llama3.2:3b)

## In Scope

- Docker Compose deployment (PostgreSQL+pgvector, Redis, FastAPI, Nginx)
- Web-based chat UI (ChatGPT-inspired, VS Code-styled sidebar)
- Document ingestion (PDF, MD, TXT, LOG, JSON, YAML)
- Configurable chunking and embedding
- REST API + MCP server
- Integration docs for copying into other projects
- Test suite
- Comprehensive deploy script (start/stop/ingest commands)
- YAML-based configuration

## Out of Scope

- Multi-tenant / multi-user
- Authentication/authorization (add in consuming project)
- Production scaling (horizontal, sharding)
- Fine-tuning integration (parent project scope)
- Complex workspace management (single knowledge base only)
- **Monitoring stacks — BLACKLISTED (2026-07-03)**: Grafana, Prometheus, Loki,
  Promtail, Alertmanager, and the exporters are completely out of scope. The
  files (`docker-compose.monitoring.yml`, `config/monitoring/`,
  `config/alertmanager.yml`, `config/alert_rules.yml`, `grafana/`) are KEPT
  in-tree but are unsupported and must not be worked on. Core diagnostics are
  `/api/health` (+`?deep=1`), `./deploy.sh doctor`, and `./deploy.sh logs`.

## Technical Decisions

| Component  | Choice                                | Notes                              |
|------------|---------------------------------------|------------------------------------|
| Vector DB  | pgvector (PostgreSQL 16)              | Cosine similarity search           |
| Cache      | Redis 7                               | Query/result caching               |
| API        | FastAPI                               | Async, OpenAPI docs                |
| MCP        | FastMCP                               | search, ingest, list, get tools    |
| Embeddings | Ollama (nomic-embed-text / 768)       | Canonical default triple; sentence-transformers optional, not installed |
| LLM        | llama3.2:3b via Ollama                | Generation and Q&A                 |
| Chunking   | 512 tokens, 50 overlap, sentence-aware| Sentence-boundary splitting        |

## Root Discipline (load-bearing — do not delete)

> Adopted: 2026-07-03 declutter pass. Applies to every agent and session.

The project root stays minimal. The ONLY files allowed at
`rag-bootstrap/` root are:

- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`
- `deploy.sh`
- `docker-compose.yml`, `docker-compose.monitoring.yml`, `docker-compose.multi-kb.yml` (any `docker-compose*.yml`)
- `pytest.ini`
- `.env`, `.env.example` (any `.env*`), `.gitignore`

Everything else has a subdirectory home — create NO other files at root:

- New docs → `docs/<taxonomy>/` (see `docs/INDEX.md`)
- Configs (monitoring, optional requirements extras) → `config/`
- Agent reports → `docs/handoffs/` or `docs/findings/`
- Generated output (benchmarks) → `results/` (gitignored)

## Constraints

- Research/template project, not production
- Ollama required for LLM features (SSH forwarded to localhost:11434)
- Single-node deployment only
