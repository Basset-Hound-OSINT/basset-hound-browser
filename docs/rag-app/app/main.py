from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import api_v2
from .chat import ChatSessionManager
from .config import settings
from .config_manager import ConfigManager
from .database import Chunk, Document, async_session, engine, get_meta, init_db, upsert_meta
from .embeddings import EmbeddingService, ensure_backend_ready
from .ingestion import ingest_directory, ingest_file
from .llm import OllamaClient
from .search import hybrid_search, keyword_search, semantic_search
from .watcher import DocumentWatcher
from .websocket_chat import StreamingChatHandler, WebSocketConnectionManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# Lifespan
# =============================================================================


async def _check_embedding_dimension() -> None:
    """Refuse startup when the stored index dimension != configured dimension.

    The rag_meta row (written at ingest) records the dimension the pgvector
    columns were populated with. Booting with a different EMBEDDING_DIMENSION
    would make every query embedding incomparable with the stored vectors, so
    fail fast with an actionable message instead of serving silent garbage.
    A model change at the same dimension only warns (scores degrade but the
    system still functions until re-index).
    """
    async with async_session() as session:
        meta = await get_meta(session)
    if meta is None:
        return  # No ingest has run yet — nothing to conflict with.
    if meta.dimension != settings.EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"Embedding dimension mismatch: the database was indexed with "
            f"dimension={meta.dimension} (model '{meta.embedding_model}') but the "
            f"current config requests EMBEDDING_DIMENSION={settings.EMBEDDING_DIMENSION} "
            f"(model '{settings.EMBEDDING_MODEL}'). Either restore "
            f"EMBEDDING_DIMENSION={meta.dimension} / EMBEDDING_MODEL={meta.embedding_model} "
            f"in .env/config.yaml, or wipe and re-index with the new model "
            f"(./deploy.sh reset, then re-ingest). Refusing to start."
        )
    if meta.embedding_model != settings.EMBEDDING_MODEL:
        logger.warning(
            "Embedding model changed ('%s' indexed vs '%s' configured) at the same "
            "dimension (%d): similarity scores will be unreliable until re-index.",
            meta.embedding_model,
            settings.EMBEDDING_MODEL,
            meta.dimension,
        )


async def _init_multi_kb_gateway(
    app: FastAPI,
    config_manager: ConfigManager,
    embedding_service: EmbeddingService,
):
    """Initialize the /api/v2 multi-KB gateway from config (lifespan-only).

    Activation is gated on a non-empty ``knowledge_bases:`` stanza — a
    single-KB deploy (no stanza) skips everything here and keeps today's
    behavior exactly (/api/v2/* answers 503 "multi-KB not configured").

    For each configured postgres KB the registry builds a dedicated engine on
    the KB's DSN (one shared postgres instance, one logical database per KB),
    creates missing databases + schema, and enforces the per-KB embedding-
    dimension guard. Failures abort startup (fail fast, mirroring the v1
    dim-mismatch guard).

    Returns the KnowledgeRegistry (stored on ``app.state.kb_registry``) or
    None when multi-KB is not configured.
    """
    config = config_manager.get_config()
    kb_configs = config.get_knowledge_bases()
    if not kb_configs:
        logger.info(
            "No knowledge_bases configured; multi-KB gateway inactive "
            "(/api/v2/* -> 503)."
        )
        return None

    from .registry import KnowledgeRegistry, resolve_kb_connection

    kb_defaults = config.get("kb_defaults", {}) or {}
    kb_registry = KnowledgeRegistry()
    try:
        for kb_name, kb_cfg in kb_configs.items():
            kb_cfg = kb_cfg or {}
            kb_type = kb_cfg.get("type", "postgres")
            if kb_type == "postgres":
                # Prefer ConfigManager.get_kb_connection when present (its
                # home is the config work zone); the registry resolver
                # implements the same plan section-3 resolution order.
                resolver = getattr(config_manager, "get_kb_connection", None)
                conn = (
                    resolver(kb_name)
                    if callable(resolver)
                    else resolve_kb_connection(kb_name, kb_cfg, kb_defaults)
                )
                await kb_registry.create(
                    kb_name,
                    "postgres",
                    {"dsn": conn["dsn"], "embedding_service": embedding_service},
                )
            else:
                await kb_registry.create(
                    kb_name,
                    kb_type,
                    {k: v for k, v in kb_cfg.items() if k != "type"},
                )
    except Exception:
        # Dispose any per-KB engines already built before failing startup.
        await kb_registry.shutdown_all()
        raise

    await api_v2.initialize_api(
        kb_registry,
        embedding_service,
        router_config=config.get_router_config(),
    )
    app.state.kb_registry = kb_registry
    logger.info(
        "Multi-KB gateway initialized with %d KBs: %s",
        len(kb_configs),
        ", ".join(kb_configs),
    )
    return kb_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await init_db()

    # Dim-mismatch startup guard (fail fast; see _check_embedding_dimension).
    await _check_embedding_dimension()

    # Backend/package pairing guard (fail fast): EMBEDDING_BACKEND=
    # sentence-transformers without the optional package aborts boot with the
    # actionable guard message instead of failing on the first embed.
    # Import-probe only — no model load; the default Ollama path is a no-op.
    ensure_backend_ready()

    logger.info("Connecting to Redis at %s", settings.REDIS_URL)
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    app.state.redis = redis_client

    embedding_service = EmbeddingService(redis_client=redis_client)
    app.state.embedding_service = embedding_service

    llm_client = OllamaClient()
    app.state.llm_client = llm_client

    # Initialize chat session manager
    chat_session_manager = ChatSessionManager()
    app.state.chat_session_manager = chat_session_manager

    # Initialize WebSocket connection manager
    ws_connection_manager = WebSocketConnectionManager()
    app.state.ws_connection_manager = ws_connection_manager

    # Initialize config manager (optional - for configuration hot-reload)
    config_manager = ConfigManager()
    app.state.config_manager = config_manager

    # Multi-KB gateway (/api/v2): active only when config declares a
    # knowledge_bases stanza; otherwise a no-op (single-KB mode unchanged).
    await _init_multi_kb_gateway(app, config_manager, embedding_service)

    # Initialize and start document watcher — OPT-IN (WATCHER_ENABLED defaults
    # to false: fleet inotify-instance exhaustion, 2026-07-04 incident) and
    # CRASH-PROOF: no watcher failure may block, crash, or wedge startup. The
    # watcher runs as a background task (its blocking inotify reads are pushed
    # to a worker thread in app/watcher.py); if it dies, the API keeps serving
    # and a loud WARNING points at explicit ingest as the primary flow.
    if settings.WATCHER_ENABLED:
        try:
            def on_watcher_event(event: dict) -> None:
                """Handle watcher events (broadcast to WebSocket clients if needed)."""
                logger.info("Watcher event: %s", event.get("type"))
                # Could broadcast to WebSocket clients here if desired

            watcher = DocumentWatcher(on_progress=on_watcher_event)

            async def ingest_file_wrapper(filepath: Path, session, embed):
                """Open a FRESH session per ingested file. (The previous
                lifespan-scoped session exited its context manager as soon as
                startup finished, handing the watcher a closed session.)"""
                from pathlib import Path as PathlibPath

                async with async_session() as db_session:
                    return await ingest_file(PathlibPath(filepath), db_session, embed)

            def on_watcher_task_done(task: asyncio.Task) -> None:
                """Surface watcher death loudly instead of a silent dead task."""
                if task.cancelled():
                    return
                exc = task.exception()
                if exc is not None:
                    logger.warning(
                        "WATCHER TASK DIED (%s: %s) — API continues serving; "
                        "auto-ingest is OFF. Use explicit ingest "
                        "(deploy.sh ingest / POST /api/ingest).",
                        type(exc).__name__,
                        exc,
                    )

            # Start watcher in background task (never awaited during startup)
            watcher_task = asyncio.create_task(
                watcher.start(
                    ingest_func=ingest_file_wrapper,
                    session=None,  # sessions are opened per-file in the wrapper
                    embed=embedding_service,
                )
            )
            watcher_task.add_done_callback(on_watcher_task_done)
            app.state.watcher = watcher
            app.state.watcher_task = watcher_task
        except Exception:
            logger.warning(
                "WATCHER FAILED TO START — continuing WITHOUT auto-ingest; the "
                "API serves normally. Likely causes: inotify instance "
                "exhaustion (check /proc/sys/fs/inotify/max_user_instances vs "
                "running stacks), permissions, or a bad WATCHER_WATCH_DIR. "
                "Explicit ingest (deploy.sh ingest / POST /api/ingest) still "
                "works. Set WATCHER_ENABLED=false to silence this.",
                exc_info=True,
            )
    else:
        logger.info(
            "Watcher disabled (WATCHER_ENABLED=false, the default); explicit "
            "ingest is the primary flow. Set WATCHER_ENABLED=true to opt in."
        )

    logger.info("Startup complete.")
    yield

    # Shutdown
    if hasattr(app.state, "watcher"):
        await app.state.watcher.stop()
    if hasattr(app.state, "watcher_task"):
        app.state.watcher_task.cancel()
        try:
            await app.state.watcher_task
        except asyncio.CancelledError:
            pass

    # Dispose per-KB engines BEFORE the shared v1 engine (ordered shutdown;
    # the registry itself never disposes the shared engine).
    kb_registry = getattr(app.state, "kb_registry", None)
    if kb_registry is not None:
        await kb_registry.shutdown_all()

    await redis_client.aclose()
    await engine.dispose()
    logger.info("Shutdown complete.")


# Docs/schema live under /api/* so nginx's existing `location /api/` block
# proxies them through the single published port (default 127.0.0.1:10000).
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Multi-KB gateway routes (/api/v2/*): mounted UNCONDITIONALLY (routes are
# cheap); behavior is gated on lifespan initialization — without a
# knowledge_bases config stanza every /api/v2 endpoint answers
# 503 "multi-KB not configured". v1 routes are untouched.
app.include_router(api_v2.router)


# Dev-direct convenience (uvicorn without nginx): FastAPI's default doc paths
# redirect to the /api-prefixed ones. Through nginx these never match — bare
# /docs etc. fall into the SPA `location /` as before.
@app.get("/docs", include_in_schema=False)
async def _docs_redirect() -> RedirectResponse:
    return RedirectResponse(url="/api/docs")


@app.get("/redoc", include_in_schema=False)
async def _redoc_redirect() -> RedirectResponse:
    return RedirectResponse(url="/api/redoc")


@app.get("/openapi.json", include_in_schema=False)
async def _openapi_redirect() -> RedirectResponse:
    return RedirectResponse(url="/api/openapi.json")


# =============================================================================
# Dependencies
# =============================================================================


async def get_session():
    async with async_session() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_embedding_service() -> EmbeddingService:
    return app.state.embedding_service


EmbeddingDep = Annotated[EmbeddingService, Depends(get_embedding_service)]


def get_llm_client() -> OllamaClient:
    return app.state.llm_client


LLMDep = Annotated[OllamaClient, Depends(get_llm_client)]


def get_chat_session_manager() -> ChatSessionManager:
    return app.state.chat_session_manager


ChatSessionManagerDep = Annotated[ChatSessionManager, Depends(get_chat_session_manager)]


def get_ws_connection_manager() -> WebSocketConnectionManager:
    return app.state.ws_connection_manager


WSConnectionManagerDep = Annotated[WebSocketConnectionManager, Depends(get_ws_connection_manager)]


# =============================================================================
# Schemas
# =============================================================================


class SearchMode(str, Enum):
    semantic = "semantic"
    keyword = "keyword"
    hybrid = "hybrid"


class SearchRequest(BaseModel):
    query: str
    mode: SearchMode = SearchMode.hybrid
    limit: int = Field(default=10, ge=1, le=100)
    # Cross-encoder reranking. None → env default (RAG_RERANK_ENABLED, off).
    # True/False → per-request override. DEFAULT-OFF.
    rerank: bool | None = None
    # Corpus/project scoping (additive, backward-compatible): restrict hits to
    # documents whose stored filepath starts with this prefix. One stack = one
    # corpus; this narrows within it. None → whole corpus (today's behavior).
    corpus: str | None = None


class SearchResultSchema(BaseModel):
    chunk_id: int
    document_id: int
    document_filename: str
    document_filepath: str = ""
    chunk_index: int
    content: str
    score: float
    # Intuitive relevance signals (additive, backward-compatible — all default
    # None so existing callers/tests are unaffected). `cosine` = raw vector
    # cosine similarity; `normalized` = 0-1 confidence proxy; `rerank_score` =
    # cross-encoder logit when reranking ran.
    cosine: float | None = None
    normalized: float | None = None
    rerank_score: float | None = None


class DocumentSchema(BaseModel):
    id: int
    filename: str
    filepath: str
    file_type: str
    file_size: int
    chunk_count: int
    created_at: str
    updated_at: str


class DirectoryIngestRequest(BaseModel):
    path: str
    # Optional overrides for config.yaml's ingestion.extensions/ingestion.exclude
    # (threaded straight into app.ingestion.ingest_directory; None → use config).
    extensions: list[str] | None = None
    exclude: list[str] | None = None


class IngestJobSchema(BaseModel):
    """Status of an async directory-ingest job (poll GET /api/ingest/status/{job_id})."""

    job_id: str
    status: str  # queued | running | completed | failed
    path: str
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    documents_ingested: int | None = None
    documents: list[DocumentSchema] | None = None
    error: str | None = None
    status_url: str


class StatusResponse(BaseModel):
    """Stack identity / whoami — sourced from the DB meta row (rag_meta)."""

    project_name: str
    docs_root: str | None = None
    documents: int
    chunks: int
    embedding_model: str
    dimension: int
    indexed_at: str | None = None


class IndexHealthResponse(BaseModel):
    """Index freshness for consumers (GET /health/index)."""

    indexed_at: str | None = None
    indexed_commit_sha: str | None = None
    corpus_bytes: int
    chunks: int
    documents: int
    source_root: str | None = None
    staleness_class: str  # unindexed | fresh | aging | stale


class AskRequest(BaseModel):
    question: str
    mode: SearchMode = SearchMode.hybrid
    limit: int = Field(default=5, ge=1, le=20)
    system_prompt: str | None = None
    # Cross-encoder reranking. None → env default (off). DEFAULT-OFF.
    rerank: bool | None = None


class AskResponse(BaseModel):
    answer: str
    model: str
    sources: list[SearchResultSchema]


class MultiDirectoryIngestRequest(BaseModel):
    paths: list[str]


class HealthStatus(BaseModel):
    status: str
    database: bool
    redis: bool
    embedding_service: bool
    # Why the embedding check failed; None when healthy. Additive/optional —
    # consumers verified: scripts/health-check.sh only curls the endpoint and
    # frontend/js/app.js reads only the embedding_service bool. Surfaces e.g.
    # the sentence-transformers guard message instead of a silent False.
    embedding_reason: str | None = None
    llm: bool
    # Deep check results (only set when /api/health?deep=1): embeds a probe
    # text and runs a 1-NN pgvector query end-to-end. Additive/optional so
    # existing consumers are unaffected.
    deep: bool | None = None
    deep_ok: bool | None = None


class ChatMessageSchema(BaseModel):
    role: str
    content: str
    timestamp: str | None = None
    sources: list[SearchResultSchema] | None = None


class ChatRequest(BaseModel):
    message: str
    use_rag: bool = True
    mode: SearchMode = SearchMode.hybrid


class ChatResponse(BaseModel):
    response: str
    sources: list[SearchResultSchema] | None = None
    session_id: str


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessageSchema]


class SessionListResponse(BaseModel):
    sessions: list[str]


# =============================================================================
# Reranking helper (cross-encoder, default-OFF, fail-soft)
# =============================================================================


def _rerank_env_default() -> bool:
    """Env-level reranking default (RAG_RERANK_ENABLED). Fail-soft → False."""
    try:
        import os

        return os.environ.get("RAG_RERANK_ENABLED", "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
            "enabled",
        }
    except Exception:
        return False


def _maybe_rerank(query: str, results, rerank, limit: int):
    """Optionally apply the cross-encoder reranker over `results`.

    `rerank`: per-request override (None → env default RAG_RERANK_ENABLED, off).
    DEFAULT-OFF: when reranking is not requested, returns `results` untouched and
    NEVER imports sentence_transformers. Fail-soft: any error → input order.
    """
    try:
        from .reranker import CrossEncoderReranker, is_rerank_enabled

        do_rerank = is_rerank_enabled() if rerank is None else bool(rerank)
        if not do_rerank:
            return results
        reranker = CrossEncoderReranker.get_shared()
        return reranker.rerank(query, results, top_k=limit)
    except Exception:
        logger.exception("Reranking failed; returning original results")
        return results


# =============================================================================
# Async directory-ingest jobs (in-process store)
# =============================================================================


class IngestJobState(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


@dataclass
class _IngestJob:
    job_id: str
    path: str
    status: IngestJobState = IngestJobState.queued
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    finished_at: datetime | None = None
    documents: list[DocumentSchema] | None = None
    error: str | None = None
    # Keep a strong reference to the asyncio task so it is not GC'd mid-flight.
    task: asyncio.Task | None = None


_INGEST_JOBS: dict[str, _IngestJob] = {}
_INGEST_JOBS_MAX = 100  # soft cap: prune oldest FINISHED jobs beyond this
# Hard ceiling on the whole in-memory table (queued/running included). Finished
# jobs are always evictable, so this only trips on a pathological pile-up of
# never-finishing ingests — new jobs are then refused with 429 instead of
# growing the map (and its retained per-job `documents` lists) without bound.
_INGEST_JOBS_HARD_CAP = 500


def _prune_ingest_jobs() -> None:
    if len(_INGEST_JOBS) <= _INGEST_JOBS_MAX:
        return
    finished = [
        j
        for j in _INGEST_JOBS.values()
        if j.status in (IngestJobState.completed, IngestJobState.failed)
    ]
    finished.sort(key=lambda j: j.finished_at or j.created_at)
    for job in finished[: len(_INGEST_JOBS) - _INGEST_JOBS_MAX]:
        _INGEST_JOBS.pop(job.job_id, None)


def _job_to_schema(job: _IngestJob) -> IngestJobSchema:
    return IngestJobSchema(
        job_id=job.job_id,
        status=job.status.value,
        path=job.path,
        created_at=job.created_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
        documents_ingested=len(job.documents) if job.documents is not None else None,
        documents=job.documents,
        error=job.error,
        status_url=f"/api/ingest/status/{job.job_id}",
    )


def _check_ingest_root(dirpath: Path) -> None:
    """Ingest-root guard: refuse directory ingests outside the configured docs root.

    Active only when DOCS_PATH is set (the same-path :ro mount root). Override
    per-deploy with RAG_INGEST_ROOT_GUARD=off. Keeps a stack's corpus honest:
    /api/status advertises docs_root, so silently indexing unrelated trees
    would lie to consumers.
    """
    guard = os.environ.get("RAG_INGEST_ROOT_GUARD", "on").strip().lower()
    if guard in {"off", "0", "false", "no", "disabled"}:
        return
    docs_root = os.environ.get("DOCS_PATH", "").strip()
    if not docs_root:
        return
    root = Path(docs_root).resolve()
    resolved = dirpath.resolve()
    if resolved != root and root not in resolved.parents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Ingest path {resolved} is outside the configured docs root {root} "
                f"(DOCS_PATH). Move the content under the docs root, change DOCS_PATH, "
                f"or set RAG_INGEST_ROOT_GUARD=off to disable this guard."
            ),
        )


async def _git_head_sha(root: Path) -> str | None:
    """Best-effort HEAD sha of the ingested tree (None when not a git repo)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "git",
            "-C",
            str(root),
            "rev-parse",
            "HEAD",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        out, _ = await proc.communicate()
        if proc.returncode == 0:
            sha = out.decode().strip()
            return sha[:64] or None
    except Exception:  # noqa: BLE001 — provenance is best-effort, never fatal
        pass
    return None


async def _run_ingest_job(
    job: _IngestJob,
    body: DirectoryIngestRequest,
    embed: EmbeddingService,
) -> None:
    """Background runner for an async directory ingest (own DB session)."""
    job.status = IngestJobState.running
    job.started_at = datetime.now(timezone.utc)
    try:
        async with async_session() as session:
            docs = await ingest_directory(
                body.path,
                session,
                embed,
                extensions=body.extensions,
                exclude=body.exclude,
            )
            # Record provenance in the DB meta row (DB meta contract).
            sha = await _git_head_sha(Path(body.path))
            await upsert_meta(
                session,
                docs_root=str(Path(body.path).resolve()),
                indexed_commit_sha=sha,
            )
        job.documents = [_doc_to_schema(d) for d in docs]
        job.status = IngestJobState.completed
        logger.info(
            "Ingest job %s completed: %d documents from %s",
            job.job_id,
            len(docs),
            body.path,
        )
    except Exception as exc:  # noqa: BLE001 — job surface, report via status API
        logger.exception("Ingest job %s failed for %s", job.job_id, body.path)
        job.status = IngestJobState.failed
        job.error = str(exc)
    finally:
        job.finished_at = datetime.now(timezone.utc)
        _prune_ingest_jobs()


# =============================================================================
# Routes
# =============================================================================


@app.get("/api/health", response_model=HealthStatus)
@app.get("/api/v1/health", response_model=HealthStatus)
async def health_check(session: SessionDep, embed: EmbeddingDep, deep: bool = False):
    db_ok = False
    redis_ok = False
    embed_ok = False

    try:
        await session.execute(select(func.now()))
        db_ok = True
    except Exception:
        logger.exception("DB health check failed")

    try:
        await app.state.redis.ping()
        redis_ok = True
    except Exception:
        logger.exception("Redis health check failed")

    embed_reason: str | None = None
    try:
        embed_ok = await embed.health_check()
        if not embed_ok:
            embed_reason = getattr(embed, "last_health_error", None)
    except Exception:
        logger.exception("Embedding health check failed")

    llm_ok = False
    try:
        llm_ok = await app.state.llm_client.health_check()
    except Exception:
        logger.exception("LLM health check failed")

    # Optional deep check (?deep=1): embed a probe and run a real 1-NN pgvector
    # query — proves the embed→search path end-to-end, not just liveness.
    deep_ok: bool | None = None
    if deep:
        try:
            probe = "rag-bootstrap deep health probe"
            vector = await embed.embed_text(probe, task="search_query")
            await semantic_search(probe, session, embedding_vector=vector, limit=1)
            deep_ok = True  # empty result on a fresh index is still a pass
        except Exception:
            logger.exception("Deep health check (embed + 1-NN) failed")
            deep_ok = False

    checks = [db_ok, redis_ok, embed_ok, llm_ok]
    if deep:
        checks.append(bool(deep_ok))
    overall = "healthy" if all(checks) else "degraded"
    return HealthStatus(
        status=overall,
        database=db_ok,
        redis=redis_ok,
        embedding_service=embed_ok,
        embedding_reason=embed_reason,
        llm=llm_ok,
        deep=deep if deep else None,
        deep_ok=deep_ok,
    )


@app.post("/api/ingest/file", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
async def ingest_upload(
    file: UploadFile,
    session: SessionDep,
    embed: EmbeddingDep,
):
    import tempfile

    suffix = Path(file.filename or "upload.bin").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        doc = await ingest_file(tmp_path, session, embed)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    finally:
        tmp_path.unlink(missing_ok=True)

    # Refresh indexed_at in the meta row (fail-soft: ingest already succeeded).
    try:
        await upsert_meta(session)
    except Exception:
        logger.exception("Meta refresh after file ingest failed (non-fatal)")

    return _doc_to_schema(doc)


@app.post(
    "/api/ingest/directory",
    response_model=IngestJobSchema,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_dir(
    body: DirectoryIngestRequest,
    embed: EmbeddingDep,
):
    """Start an ASYNC directory ingest and return a pollable job immediately.

    Large corpora used to run inside the request and hit proxy/read timeouts
    (504 at nginx's read cliff). Now the ingest runs as a background task with
    its own DB session; poll GET /api/ingest/status/{job_id} for progress and
    the final document list.
    """
    dirpath = Path(body.path)
    if not dirpath.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Directory not found: {body.path}",
        )
    _check_ingest_root(dirpath)

    # Hard ceiling on the in-memory job table: evict oldest finished first,
    # then refuse admission (429) rather than grow without bound (LOW-6).
    _prune_ingest_jobs()
    if len(_INGEST_JOBS) >= _INGEST_JOBS_HARD_CAP:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many in-flight ingest jobs ({_INGEST_JOBS_HARD_CAP} cap). "
                "Wait for running jobs to finish, then retry."
            ),
            headers={"Retry-After": "30"},
        )

    job = _IngestJob(job_id=uuid.uuid4().hex, path=body.path)
    _INGEST_JOBS[job.job_id] = job
    job.task = asyncio.create_task(_run_ingest_job(job, body, embed))
    return _job_to_schema(job)


@app.get("/api/ingest/status/{job_id}", response_model=IngestJobSchema)
async def ingest_job_status(job_id: str):
    """Poll the status of an async directory-ingest job."""
    job = _INGEST_JOBS.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingest job {job_id} not found (jobs are in-process and pruned).",
        )
    return _job_to_schema(job)


@app.get("/api/documents", response_model=list[DocumentSchema])
async def list_documents(session: SessionDep):
    result = await session.execute(select(Document).order_by(Document.created_at.desc()))
    return [_doc_to_schema(d) for d in result.scalars().all()]


@app.get("/api/documents/{doc_id}", response_model=DocumentSchema)
async def get_document(doc_id: int, session: SessionDep):
    doc = await session.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return _doc_to_schema(doc)


@app.delete("/api/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: int, session: SessionDep):
    doc = await session.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await session.delete(doc)
    await session.commit()


@app.post("/api/search", response_model=list[SearchResultSchema])
@app.post("/api/v1/search", response_model=list[SearchResultSchema])
async def search(body: SearchRequest, response: Response, session: SessionDep, embed: EmbeddingDep):
    """Search the corpus. /api/v1/search is an ADDITIVE alias of /api/search
    (same handler, same schema) — /api/search remains stable for existing
    consumers."""
    started = time.time()
    # Over-fetch candidates when reranking so the cross-encoder has a pool to
    # reorder, then trim to `limit`. With reranking off, fetch == limit (today).
    do_rerank = (
        body.rerank
        if body.rerank is not None
        else _rerank_env_default()
    )
    fetch = max(body.limit, body.limit * 4) if do_rerank else body.limit

    if body.mode == SearchMode.semantic:
        results = await semantic_search(body.query, session, embed, fetch, path_prefix=body.corpus)
    elif body.mode == SearchMode.keyword:
        results = await keyword_search(body.query, session, fetch, path_prefix=body.corpus)
    else:
        results = await hybrid_search(body.query, session, embed, fetch, path_prefix=body.corpus)

    results = _maybe_rerank(body.query, results, body.rerank, body.limit)
    results = results[: body.limit]

    # Token-savings telemetry: payload size of the returned chunk text, as a
    # response header plus a structured access-log line.
    chunk_bytes = sum(len(r.content.encode("utf-8")) for r in results)
    response.headers["X-Chunk-Bytes"] = str(chunk_bytes)
    logger.info(
        "search_access %s",
        json.dumps(
            {
                "event": "search",
                "mode": body.mode.value,
                "query_chars": len(body.query),
                "limit": body.limit,
                "corpus": body.corpus,
                "rerank": do_rerank,
                "results": len(results),
                "chunk_bytes": chunk_bytes,
                "duration_ms": round((time.time() - started) * 1000, 2),
            }
        ),
    )

    return [
        SearchResultSchema(
            chunk_id=r.chunk_id,
            document_id=r.document_id,
            document_filename=r.document_filename,
            document_filepath=r.document_filepath,
            chunk_index=r.chunk_index,
            content=r.content,
            score=r.score,
            cosine=r.cosine,
            normalized=r.normalized,
            rerank_score=getattr(r, "rerank_score", None),
        )
        for r in results
    ]


@app.post("/api/ask", response_model=AskResponse)
@app.post("/api/v1/ask", response_model=AskResponse)
async def ask_question(
    body: AskRequest,
    session: SessionDep,
    embed: EmbeddingDep,
    llm: LLMDep,
):
    """Ask a question and get an answer using RAG-retrieved context."""
    # First, search for relevant context (over-fetch + rerank when requested).
    do_rerank = body.rerank if body.rerank is not None else _rerank_env_default()
    fetch = max(body.limit, body.limit * 4) if do_rerank else body.limit
    if body.mode == SearchMode.semantic:
        results = await semantic_search(body.question, session, embed, fetch)
    elif body.mode == SearchMode.keyword:
        results = await keyword_search(body.question, session, fetch)
    else:
        results = await hybrid_search(body.question, session, embed, fetch)

    results = _maybe_rerank(body.question, results, body.rerank, body.limit)
    results = results[: body.limit]

    if not results:
        return AskResponse(
            answer="No relevant documents found to answer this question. Please ingest documents first.",
            model=llm.model,
            sources=[],
        )

    # Format chunks for LLM
    context_chunks = [
        {
            "content": r.content,
            "document_filename": r.document_filename,
            "score": r.score,
        }
        for r in results
    ]

    # Generate answer
    llm_response = await llm.ask_with_context(
        question=body.question,
        context_chunks=context_chunks,
        system_prompt=body.system_prompt,
    )

    sources = [
        SearchResultSchema(
            chunk_id=r.chunk_id,
            document_id=r.document_id,
            document_filename=r.document_filename,
            document_filepath=r.document_filepath,
            chunk_index=r.chunk_index,
            content=r.content,
            score=r.score,
            cosine=r.cosine,
            normalized=r.normalized,
            rerank_score=getattr(r, "rerank_score", None),
        )
        for r in results
    ]

    return AskResponse(
        answer=llm_response.answer,
        model=llm_response.model,
        sources=sources,
    )


@app.post("/api/ask/stream")
async def ask_question_stream(
    body: AskRequest,
    session: SessionDep,
    embed: EmbeddingDep,
    llm: LLMDep,
):
    """Stream tokens from a RAG-augmented question answer.

    Streams response as Server-Sent Events (SSE) with:
    - type: 'start' - Request initialization
    - type: 'search' - Search results with latency
    - type: 'sources' - Retrieved source documents
    - type: 'token' - Streamed token with latency metrics
    - type: 'done' - Completion with total latency
    - type: 'error' - Error message
    """

    async def generate_sse():
        start_time = time.time()

        # Emit start event
        yield f"data: {json.dumps({'type': 'start', 'timestamp': start_time})}\n\n"

        # Search for relevant context
        search_start = time.time()
        if body.mode == SearchMode.semantic:
            results = await semantic_search(body.question, session, embed, body.limit)
        elif body.mode == SearchMode.keyword:
            results = await keyword_search(body.question, session, body.limit)
        else:
            results = await hybrid_search(body.question, session, embed, body.limit)

        search_latency = time.time() - search_start

        if not results:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No relevant documents found to answer this question. Please ingest documents first.', 'done': True})}\n\n"
            return

        # Format chunks for LLM
        context_chunks = [
            {
                "content": r.content,
                "document_filename": r.document_filename,
                "score": r.score,
            }
            for r in results
        ]

        # Send metadata about sources before streaming
        sources_data = [
            {
                "chunk_id": r.chunk_id,
                "document_id": r.document_id,
                "document_filename": r.document_filename,
                "document_filepath": r.document_filepath,
                "chunk_index": r.chunk_index,
                "content": r.content,
                "score": r.score,
            }
            for r in results
        ]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources_data, 'search_latency_ms': round(search_latency * 1000, 2)})}\n\n"

        # Stream tokens from the LLM
        token_count = 0
        accumulated_response = ""
        first_token_time = None

        try:
            async for token in llm.ask_with_context_stream(
                question=body.question,
                context_chunks=context_chunks,
                system_prompt=body.system_prompt,
            ):
                token_count += 1
                accumulated_response += token

                # Track time to first token
                if first_token_time is None:
                    first_token_time = time.time() - start_time

                token_latency = time.time() - start_time
                yield f"data: {json.dumps({'type': 'token', 'token': token, 'token_count': token_count, 'model': llm.model, 'cumulative_latency_ms': round(token_latency * 1000, 2)})}\n\n"

            # Send completion with latency metrics
            total_latency = time.time() - start_time
            yield f"data: {json.dumps({'type': 'done', 'total_tokens': token_count, 'response': accumulated_response.strip(), 'first_token_latency_ms': round(first_token_time * 1000, 2) if first_token_time else 0, 'total_latency_ms': round(total_latency * 1000, 2)})}\n\n"

        except Exception as e:
            logger.exception("Stream error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e), 'done': True})}\n\n"

    return StreamingResponse(generate_sse(), media_type="text/event-stream")


@app.post(
    "/api/ingest/directories",
    response_model=list[DocumentSchema],
    status_code=status.HTTP_201_CREATED,
)
async def ingest_dirs(
    body: MultiDirectoryIngestRequest,
    session: SessionDep,
    embed: EmbeddingDep,
):
    """Ingest documents from multiple directories.

    NOTE: still synchronous (kept for backward compatibility). For large
    corpora prefer POST /api/ingest/directory per directory — it returns a
    pollable job_id immediately instead of holding the request open.
    """
    all_docs = []
    for path in body.paths:
        try:
            docs = await ingest_directory(path, session, embed)
            all_docs.extend(docs)
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Directory not found: {path}",
            )

    # Refresh indexed_at in the meta row (fail-soft: ingest already succeeded).
    try:
        await upsert_meta(session)
    except Exception:
        logger.exception("Meta refresh after multi-directory ingest failed (non-fatal)")

    return [_doc_to_schema(d) for d in all_docs]


@app.get("/api/models")
async def list_models(llm: LLMDep):
    """List available Ollama models."""
    models = await llm.list_models()
    return {"models": models, "current": llm.model}


@app.get("/api/watcher/status")
async def get_watcher_status():
    """Get document watcher status and statistics."""
    if not hasattr(app.state, "watcher"):
        return {"status": "not_initialized"}

    watcher = app.state.watcher
    stats = watcher.get_stats()
    return {
        "status": "running" if stats["running"] else "stopped",
        **stats,
    }


# =============================================================================
# Stack identity + index freshness (DB meta contract)
# =============================================================================


@app.get("/api/status", response_model=StatusResponse)
@app.get("/api/v1/status", response_model=StatusResponse)
async def api_status(session: SessionDep):
    """Stack identity / whoami: which corpus does this endpoint serve?

    Sourced from the rag_meta row (written at ingest) plus live counts.
    Consumers should check project_name/docs_root before bulk-querying an
    unfamiliar endpoint (see CONSUMING_AGENTS_CONTRACT.md section 8).
    """
    meta = await get_meta(session)
    documents = await session.scalar(select(func.count(Document.id))) or 0
    chunks = await session.scalar(select(func.count(Chunk.id))) or 0
    docs_root = (meta.docs_root if meta else None) or os.environ.get("DOCS_PATH") or None
    return StatusResponse(
        project_name=meta.project_name if meta else settings.PROJECT_NAME,
        docs_root=docs_root,
        documents=documents,
        chunks=chunks,
        embedding_model=meta.embedding_model if meta else settings.EMBEDDING_MODEL,
        dimension=meta.dimension if meta else settings.EMBEDDING_DIMENSION,
        indexed_at=meta.indexed_at.isoformat() if meta and meta.indexed_at else None,
    )


def _staleness_class(indexed_at: datetime | None) -> str:
    """Bucket index age: unindexed (never), fresh (<24h), aging (<7d), stale (>=7d)."""
    if indexed_at is None:
        return "unindexed"
    if indexed_at.tzinfo is None:
        indexed_at = indexed_at.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - indexed_at
    if age.total_seconds() < 24 * 3600:
        return "fresh"
    if age.total_seconds() < 7 * 24 * 3600:
        return "aging"
    return "stale"


@app.get("/health/index", response_model=IndexHealthResponse)
async def index_health(session: SessionDep):
    """Index freshness: how current is what this stack serves?

    Complements /api/health (liveness): consumers use this to decide whether
    retrieved context can be trusted as up to date.
    """
    meta = await get_meta(session)
    documents = await session.scalar(select(func.count(Document.id))) or 0
    chunks = await session.scalar(select(func.count(Chunk.id))) or 0
    corpus_bytes = await session.scalar(
        select(func.coalesce(func.sum(Document.file_size), 0))
    ) or 0
    indexed_at = meta.indexed_at if meta else None
    return IndexHealthResponse(
        indexed_at=indexed_at.isoformat() if indexed_at else None,
        indexed_commit_sha=meta.indexed_commit_sha if meta else None,
        corpus_bytes=int(corpus_bytes),
        chunks=chunks,
        documents=documents,
        source_root=(meta.docs_root if meta else None) or os.environ.get("DOCS_PATH") or None,
        staleness_class=_staleness_class(indexed_at),
    )


# =============================================================================
# Chat API v3 - Pure Chat Mode (Optional RAG)
# =============================================================================


@app.post("/api/v3/chat/session", status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    chat_manager: ChatSessionManagerDep,
    llm: LLMDep,
):
    """Create a new chat session."""
    session_id = await chat_manager.create_session(llm)
    return {"session_id": session_id}


@app.post("/api/v3/chat/{session_id}/message", response_model=ChatResponse)
async def send_chat_message(
    session_id: str,
    body: ChatRequest,
    session: SessionDep,
    embed: EmbeddingDep,
    chat_manager: ChatSessionManagerDep,
):
    """Send a message and get a response (REST-based)."""
    chat_session = chat_manager.get_session(session_id)
    if not chat_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    # Optional RAG context
    sources = []
    rag_context = ""

    if body.use_rag:
        # Search for relevant context
        if body.mode == SearchMode.semantic:
            results = await semantic_search(body.message, session, embed, limit=5)
        elif body.mode == SearchMode.keyword:
            results = await keyword_search(body.message, session, limit=5)
        else:
            results = await hybrid_search(body.message, session, embed, limit=5)

        if results:
            sources = [
                SearchResultSchema(
                    chunk_id=r.chunk_id,
                    document_id=r.document_id,
                    document_filename=r.document_filename,
                    document_filepath=r.document_filepath,
                    chunk_index=r.chunk_index,
                    content=r.content,
                    score=r.score,
                )
                for r in results
            ]

            # Format context for chat
            rag_context = "\n".join(
                [f"- {r.content[:200]}... (from {r.document_filename})" for r in results]
            )

    # Generate response (add RAG context to message if available)
    if rag_context:
        augmented_message = f"{body.message}\n\nContext:\n{rag_context}"
    else:
        augmented_message = body.message

    response = await chat_session.send_message(augmented_message, max_tokens=500)

    return ChatResponse(
        response=response,
        sources=sources if sources else None,
        session_id=session_id,
    )


@app.get("/api/v3/chat/{session_id}/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    chat_manager: ChatSessionManagerDep,
):
    """Get chat history for a session."""
    chat_session = chat_manager.get_session(session_id)
    if not chat_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    messages = chat_session.get_messages()
    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            ChatMessageSchema(
                role=msg.role,
                content=msg.content,
                timestamp=msg.timestamp.isoformat() if msg.timestamp else None,
                sources=(
                    [
                        SearchResultSchema(
                            chunk_id=0,
                            document_id=0,
                            document_filename=s.get("document_filename", ""),
                            document_filepath=s.get("document_filepath", ""),
                            chunk_index=0,
                            content=s.get("content", ""),
                            score=1.0,
                        )
                        for s in (msg.sources or [])
                    ]
                    if msg.sources
                    else None
                ),
            )
            for msg in messages
        ],
    )


@app.delete("/api/v3/chat/{session_id}")
async def delete_chat_session(
    session_id: str,
    chat_manager: ChatSessionManagerDep,
):
    """Delete a chat session."""
    deleted = await chat_manager.delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return {"status": "deleted", "session_id": session_id}


@app.get("/api/v3/chat/sessions", response_model=SessionListResponse)
async def list_chat_sessions(
    chat_manager: ChatSessionManagerDep,
):
    """List all active chat sessions."""
    sessions = chat_manager.list_sessions()
    return SessionListResponse(sessions=sessions)


@app.post("/api/v3/chat/{session_id}/clear")
async def clear_chat_history(
    session_id: str,
    chat_manager: ChatSessionManagerDep,
):
    """Clear history for a session."""
    chat_session = chat_manager.get_session(session_id)
    if not chat_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    chat_session.clear_history()
    return {"status": "cleared", "session_id": session_id}


@app.post("/api/v3/chat/{session_id}/stream")
async def stream_chat_message(
    session_id: str,
    body: ChatRequest,
    session: SessionDep,
    embed: EmbeddingDep,
    chat_manager: ChatSessionManagerDep,
    llm: LLMDep,
):
    """Stream a chat message response using Server-Sent Events (SSE).

    This is an alternative to WebSocket streaming that uses HTTP SSE.

    Streams response as Server-Sent Events with:
    - type: 'start' - Request initialization
    - type: 'search' - Search results with latency
    - type: 'sources' - Retrieved source documents
    - type: 'token' - Streamed token
    - type: 'done' - Completion with metrics
    - type: 'error' - Error message
    """

    async def generate_stream():
        start_time = time.time()

        # Get chat session
        chat_session = chat_manager.get_session(session_id)
        if not chat_session:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Session {session_id} not found', 'done': True})}\n\n"
            return

        # Emit start event
        yield f"data: {json.dumps({'type': 'start', 'session_id': session_id, 'timestamp': start_time})}\n\n"

        # Optional RAG context
        sources = []
        rag_context = ""

        if body.use_rag:
            # Search for relevant context
            search_start = time.time()
            if body.mode == SearchMode.semantic:
                results = await semantic_search(body.message, session, embed, limit=5)
            elif body.mode == SearchMode.keyword:
                results = await keyword_search(body.message, session, limit=5)
            else:
                results = await hybrid_search(body.message, session, embed, limit=5)

            search_latency = time.time() - search_start

            if results:
                sources = [
                    SearchResultSchema(
                        chunk_id=r.chunk_id,
                        document_id=r.document_id,
                        document_filename=r.document_filename,
                        document_filepath=r.document_filepath,
                        chunk_index=r.chunk_index,
                        content=r.content,
                        score=r.score,
                    )
                    for r in results
                ]

                # Format context for chat
                rag_context = "\n".join(
                    [f"- {r.content[:200]}... (from {r.document_filename})" for r in results]
                )

                # Send sources metadata
                sources_data = [s.model_dump() for s in sources]
                yield f"data: {json.dumps({'type': 'sources', 'sources': sources_data, 'search_latency_ms': round(search_latency * 1000, 2)})}\n\n"

        # Generate response (add RAG context to message if available)
        if rag_context:
            augmented_message = f"{body.message}\n\nContext:\n{rag_context}"
        else:
            augmented_message = body.message

        # Stream tokens from the LLM
        token_count = 0
        accumulated_response = ""
        first_token_time = None

        try:
            # Get streaming response from LLM
            async for token in llm.generate_stream(
                prompt=augmented_message,
                temperature=0.3,
            ):
                token_text = token.get("response", "")
                if token_text:
                    token_count += 1
                    accumulated_response += token_text

                    # Track time to first token
                    if first_token_time is None:
                        first_token_time = time.time() - start_time

                    token_latency = time.time() - start_time
                    yield f"data: {json.dumps({'type': 'token', 'token': token_text, 'token_count': token_count, 'model': llm.model, 'cumulative_latency_ms': round(token_latency * 1000, 2)})}\n\n"

            # Add message to chat history
            await chat_session.add_message(
                "user",
                body.message,
                sources=[s.model_dump() for s in sources] if sources else None,
            )
            await chat_session.add_message("assistant", accumulated_response.strip())

            # Send completion with latency metrics
            total_latency = time.time() - start_time
            yield f"data: {json.dumps({'type': 'done', 'total_tokens': token_count, 'response': accumulated_response.strip(), 'first_token_latency_ms': round(first_token_time * 1000, 2) if first_token_time else 0, 'total_latency_ms': round(total_latency * 1000, 2), 'session_id': session_id})}\n\n"

        except Exception as e:
            logger.exception("Stream error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e), 'done': True})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")


# =============================================================================
# WebSocket - Streaming Chat
# =============================================================================


@app.websocket("/api/v3/ws/chat/{session_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    session_id: str,
    chat_manager: ChatSessionManagerDep,
    ws_manager: WSConnectionManagerDep,
    llm: LLMDep,
    session: SessionDep,
    embed: EmbeddingDep,
):
    """WebSocket endpoint for streaming chat responses."""
    await ws_manager.connect(websocket, session_id)

    # Get or create chat session
    chat_session = chat_manager.get_session(session_id)
    if not chat_session:
        chat_session = await chat_manager.create_session(llm)

    handler = StreamingChatHandler(chat_session, ws_manager)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "message":
                user_input = message_data.get("content", "").strip()
                use_rag = message_data.get("use_rag", True)

                if not user_input:
                    continue

                # Send thinking indicator
                await ws_manager.send_message(
                    session_id,
                    {
                        "type": "thinking",
                        "data": "Processing...",
                    },
                )

                try:
                    # Optional RAG context
                    if use_rag:
                        search_mode = message_data.get("mode", "hybrid")
                        if search_mode == "semantic":
                            results = await semantic_search(user_input, session, embed, limit=5)
                        elif search_mode == "keyword":
                            results = await keyword_search(user_input, session, limit=5)
                        else:
                            results = await hybrid_search(user_input, session, embed, limit=5)

                        if results:
                            # Format context for chat
                            rag_context = "\n".join(
                                [
                                    f"- {r.content[:200]}... (from {r.document_filename})"
                                    for r in results
                                ]
                            )
                            augmented_input = f"{user_input}\n\nContext:\n{rag_context}"
                        else:
                            augmented_input = user_input
                    else:
                        augmented_input = user_input

                    # Generate and stream response
                    response = await handler._generate_streaming_response(
                        chat_session,
                        augmented_input,
                        session_id,
                    )

                    # Send completion
                    await ws_manager.send_message(
                        session_id,
                        {
                            "type": "complete",
                            "data": {
                                "content": response,
                                "sources": (
                                    chat_session.history.messages[-1].sources
                                    if chat_session.history.messages
                                    else []
                                ),
                            },
                        },
                    )

                except Exception as e:
                    logger.exception("Chat generation failed: %s", e)
                    await ws_manager.send_message(
                        session_id,
                        {
                            "type": "error",
                            "data": f"Generation failed: {str(e)}",
                        },
                    )

            elif message_data.get("type") == "clear":
                chat_session.clear_history()
                await ws_manager.send_message(
                    session_id,
                    {
                        "type": "cleared",
                        "data": "Conversation history cleared",
                    },
                )

            elif message_data.get("type") == "list_messages":
                messages = chat_session.get_messages()
                await ws_manager.send_message(
                    session_id,
                    {
                        "type": "messages",
                        "data": [
                            {
                                "role": m.role,
                                "content": m.content,
                                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                            }
                            for m in messages
                        ],
                    },
                )

    except WebSocketDisconnect:
        logger.info("Client disconnected: session=%s", session_id)
        await ws_manager.disconnect(session_id)
    except Exception as e:
        logger.exception("WebSocket error: %s", e)
        await ws_manager.disconnect(session_id)


# =============================================================================
# Helpers
# =============================================================================


def _doc_to_schema(doc: Document) -> DocumentSchema:
    return DocumentSchema(
        id=doc.id,
        filename=doc.filename,
        filepath=doc.filepath,
        file_type=doc.file_type,
        file_size=doc.file_size,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
    )
