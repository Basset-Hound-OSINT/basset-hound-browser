# Root Suggestions Triage — rag-bootstrap

Scope: the 4 root-level suggestions files. Every claim verified against current code.

## Verified ALREADY-DONE (do not re-plan)
- Container-name collision (I1/§1.3): `docker-compose.yml` has NO `container_name:` on any service; inline comment at lines 37-41 explains why. DONE.
- Instance isolation keys in `.env.example` (I2/I3): `COMPOSE_PROJECT_NAME` block (lines 10-21) + `RAG_NETWORK_NAME` (line 25). DONE (but deploy.sh drops them — see F2).
- MissingGreenlet on ingest (§2.6): `app/database.py:21` already sets `expire_on_commit=False`; `_doc_to_schema` (main.py:1094) only reads eager cols. Effectively FIXED.
- `document_filepath` in responses (SUGGESTIONS item 4): `SearchResultSchema.document_filepath` (main.py:191) + `DocumentSchema.filepath` (1098). DONE. (The *host-openability* of that path is still open — F12.)
- host.docker.internal on Linux (partial of Issue #9): compose adds `host.docker.internal:host-gateway` extra_host (docker-compose.yml:149). Works on native Linux Docker; the no-root loopback case (I10) is still open — F7.

## No BLOCKED (infra-scaling) items to plan
The only k8s reference is contextual (Issue #9 lists "Kubernetes deployments" as a place `host.docker.internal` fails — no k8s work requested). No Terraform/CI-CD/infra-scaling tasks. The systemd `--user` Ollama forwarder (R5) and post-commit git hook (rh §3.5) are local host/tooling artifacts, not infra-scaling — allowed, low priority.

## Overlap map for synthesizer
- EMBEDDINGS concern: F3 (dim guard), F5 (st dep), F14 (concurrency/batch/backoff), F28 (multi-model/rate-limit knobs), F6 (ollama health), F7 (ollama endpoint modes).
- PORTS concern: F1 (config path drives port), F2 (.env clobber includes RAG_PORT), F4 (port preflight).
- PATHS concern: F1 (config.yaml canonical path), F8 (extensions/exclude globs), F12 (document_filepath / same-path mount).

## Findings — see StructuredOutput. Evidence anchors:
- F1 deploy.sh:41,53-54,63-70; only config/config.yaml exists (no ./config.yaml).
- F2 deploy.sh:148-182 (`cat > $ENV_FILE`, no COMPOSE_PROJECT_NAME, defaults 384/sentence-transformers at 163-165).
- F3 app/database.py:63 Vector(EMBEDDING_DIMENSION), no meta table/preflight.
- F4 deploy.sh:114-142 network-only autopick; no port check anywhere.
- F5 app/requirements.txt:20 (sentence-transformers commented out); app/embeddings.py local backend path.
- F6 deploy.sh has no ollama /api/tags probe / doctor.
- F7 I10 no-root bridge; no forwarder/systemd unit shipped; no endpoint-mode config.
- F8 app/ingestion.py:201 supported_extensions() unconditional; DirectoryIngestRequest main.py:216-217 (path only).
- F9 app/ingestion.py:204-211 except with NO rollback; database.py:35 content_hash unique=True throws.
- F10 app/main.py:380-394 sync ingest; frontend/nginx.conf:29 proxy_read_timeout 300s.
- F11 app/watcher.py:362-373 shutil.move archive, not opt-in.
- F12 app/ingestion.py:167 str(filepath.resolve()); compose mounts RAG_DOCS_VOLUME:/data/docs (not same-path).
- F14 app/embeddings.py:154 serial list-comp; _embed_ollama:175-181 no retry/backoff.
- F16 no /api/status|/whoami; no ingest-root guard.
- F17 only /api/health liveness (main.py:321); no freshness endpoint.
- F18 app/requirements.txt:32 fastmcp unpinned; mcp_server.py:23 description= (broke on skew).
- F19 deploy.sh:471-497 clean rm -rf as normal user fails on root-owned ./data/docker/postgres; no doctor/reset/ghost-cleanup.
- F20-F28 consumer-side + future: no agent_hints/, client/, orchestra/, CONSUMING_AGENTS_CONTRACT.md, install-for-project.sh, PERFORMANCE.md, TROUBLESHOOTING.md.
