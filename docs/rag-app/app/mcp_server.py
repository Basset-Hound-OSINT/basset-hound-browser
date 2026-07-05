"""
FastMCP server exposing the RAG system as MCP tools.

Allows LLM agents to search, ingest, and manage documents
through the Model Context Protocol.

SEAM POLICY: HTTP `POST /api/search` (and its `/api/v1/search` alias) is the
PRIMARY, stable integration seam for consuming agents — see
CONSUMING_AGENTS_CONTRACT.md. This MCP surface is BEST-EFFORT: fastmcp's
constructor/tool APIs have broken across releases (the pin is
fastmcp==2.1.2 in app/requirements.txt), so construction below is hardened
to degrade gracefully rather than take the process down.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastmcp import FastMCP
from sqlalchemy import select

from .database import Document, async_session, init_db
from .embeddings import EmbeddingService
from .ingestion import ingest_file as _ingest_file
from .search import hybrid_search, keyword_search, semantic_search

_SERVER_NAME = "rag-bootstrap"
_SERVER_DESCRIPTION = "RAG document search and ingestion system"


def _build_mcp() -> FastMCP:
    """Construct the FastMCP server, tolerating constructor drift.

    fastmcp has renamed/removed the ``description=`` kwarg across releases
    (2.x moved server guidance to ``instructions=``). Try the richest
    signature first and fall back so an out-of-pin fastmcp upgrade degrades
    to a nameless-but-working server instead of a TypeError at import time.
    """
    for kwargs in (
        {"name": _SERVER_NAME, "description": _SERVER_DESCRIPTION},
        {"name": _SERVER_NAME, "instructions": _SERVER_DESCRIPTION},
        {"name": _SERVER_NAME},
    ):
        try:
            return FastMCP(**kwargs)
        except TypeError:
            continue
    return FastMCP()


mcp = _build_mcp()

# ---------------------------------------------------------------------------
# Shared embedding service (lazy init)
# ---------------------------------------------------------------------------

_embedding_service: EmbeddingService | None = None


def _get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


# ---------------------------------------------------------------------------
# Multi-KB (v2) support — lazy, in-process reuse of the api_v2 gateway
# ---------------------------------------------------------------------------

_multi_kb_lock = asyncio.Lock()


async def _ensure_multi_kb():
    """Return ``(registry, pipeline)`` for the multi-KB gateway, or ``(None, None)``.

    Reuses the SAME state object api_v2 serves HTTP from (``api_v2._api_state``):
    when the MCP server runs in a process where the FastAPI lifespan already
    initialized the gateway, that registry/pipeline is used as-is. In a
    standalone MCP process the gateway is lazily built here from the same
    ``knowledge_bases:`` config stanza via ``api_v2.initialize_api`` —
    mirroring ``main._init_multi_kb_gateway`` — so kb-routed MCP searches
    execute the exact SearchPipeline code path (embed-once, kb-stamping,
    mode coercion, merge) the HTTP v2 gateway uses.

    ``(None, None)`` means multi-KB is not configured (no stanza) — the MCP
    equivalent of api_v2's 503.
    """
    from . import api_v2  # lazy: keep v1-only MCP usage import-light

    state = api_v2._api_state
    if state.registry is not None and state.pipeline is not None:
        return state.registry, state.pipeline

    async with _multi_kb_lock:
        state = api_v2._api_state
        if state.registry is not None and state.pipeline is not None:
            return state.registry, state.pipeline

        from .config_manager import ConfigManager
        from .registry import KnowledgeRegistry, resolve_kb_connection

        config_manager = ConfigManager()
        config = config_manager.get_config()
        kb_configs = config.get_knowledge_bases()
        if not kb_configs:
            return None, None

        kb_defaults = config.get("kb_defaults", {}) or {}
        registry = KnowledgeRegistry()
        try:
            for kb_name, kb_cfg in kb_configs.items():
                kb_cfg = kb_cfg or {}
                kb_type = kb_cfg.get("type", "postgres")
                if kb_type == "postgres":
                    resolver = getattr(config_manager, "get_kb_connection", None)
                    conn = (
                        resolver(kb_name)
                        if callable(resolver)
                        else resolve_kb_connection(kb_name, kb_cfg, kb_defaults)
                    )
                    await registry.create(
                        kb_name,
                        "postgres",
                        {
                            "dsn": conn["dsn"],
                            "embedding_service": _get_embedding_service(),
                        },
                    )
                else:
                    await registry.create(
                        kb_name,
                        kb_type,
                        {k: v for k, v in kb_cfg.items() if k != "type"},
                    )
        except Exception:
            # Dispose any per-KB engines already built before failing.
            await registry.shutdown_all()
            raise

        await api_v2.initialize_api(
            registry,
            _get_embedding_service(),
            router_config=config.get_router_config(),
        )
        return api_v2._api_state.registry, api_v2._api_state.pipeline


def _parse_kb_selector(kb: str | None) -> str | list[str] | None:
    """Parse the MCP ``kb`` string into api_v2's selector shape.

    None/blank -> None (v1 path); "all" -> "all"; "a,b" -> ["a", "b"];
    "name" -> "name". Mirrors ``api_v2.SearchRequest.kb``
    (``str | list[str] | None``) — MCP tools take a flat string, so a comma
    is the list syntax.
    """
    if kb is None:
        return None
    text = kb.strip()
    if not text:
        return None
    if text.lower() == "all":
        return "all"
    if "," in text:
        names = [part.strip() for part in text.split(",") if part.strip()]
        if not names:
            return None
        return names[0] if len(names) == 1 else names
    return text


def _format_citation(result: dict[str, Any]) -> str:
    """Render the kb-namespaced citation grammar for one hit.

    ``[[RAG:{kb}:{doc_path}#{chunk_index}@{score}]]`` — the same grammar as
    the client formatter (``client/fallback_policy.py::format_citation``),
    inlined here because the api image ships ``app/`` only. Hits without a
    ``kb`` render the v1 form ``[[RAG:{doc_path}#{chunk_index}@{score}]]``.
    """
    kb = result.get("kb") or ""
    kb_prefix = f"{kb}:" if kb else ""
    path = result.get("document_filepath") or result.get("document_filename") or "?"
    chunk_index = result.get("chunk_index", "?")
    try:
        score = f"{float(result.get('score', 0.0)):.3f}"
    except (TypeError, ValueError):
        score = "?"
    return f"[[RAG:{kb_prefix}{path}#{chunk_index}@{score}]]"


async def _search_documents_v2(
    query: str,
    mode: str,
    limit: int,
    kb_selector: str | list[str],
) -> dict[str, Any]:
    """Execute a kb-routed search through the api_v2 pipeline (in-process).

    Mirrors ``api_v2.search()``'s kb resolution branch-for-branch
    (kb="all" -> search_all; kb="name" -> search_specific + _tag_kb;
    kb=[...] -> search_many). Merge and mode-coercion logic lives in
    ``SearchPipeline`` — nothing is duplicated here.
    """
    from . import api_v2
    from .search_pipeline import SearchPipeline

    try:
        registry, pipeline = await _ensure_multi_kb()
    except Exception as e:  # init failure (bad DSN, dim mismatch, ...)
        return {"error": f"multi-KB initialization failed: {e}"}
    if registry is None or pipeline is None:
        return {
            "error": (
                "multi-KB not configured (no knowledge_bases stanza in "
                "config); omit 'kb' for single-corpus search"
            )
        }

    async def _kb_exists(name: str) -> bool:
        try:
            await registry.get(name)
            return True
        except KeyError:
            return False

    try:
        effective_mode = mode
        if kb_selector == "all":
            kb_names = await registry.list()
            effective_mode = SearchPipeline.coerce_multi_kb_mode(mode, len(kb_names))
            results = await pipeline.search_all(query=query, mode=mode, limit=limit)
        elif isinstance(kb_selector, str):
            if not await _kb_exists(kb_selector):
                return {"error": f"KB '{kb_selector}' not found"}
            results = await pipeline.search_specific(
                kb_name=kb_selector,
                query=query,
                mode=effective_mode,
                limit=limit,
            )
            api_v2._tag_kb(results, kb_selector)
        else:
            for name in kb_selector:
                if not await _kb_exists(name):
                    return {"error": f"KB '{name}' not found"}
            effective_mode = SearchPipeline.coerce_multi_kb_mode(
                mode, len(kb_selector)
            )
            results = await pipeline.search_many(
                kb_names=kb_selector,
                query=query,
                mode=mode,
                limit=limit,
            )
    except Exception as e:
        return {"error": str(e)}

    payload_results: list[dict[str, Any]] = []
    for r in results:
        filepath = getattr(r, "document_filepath", "") or ""
        item: dict[str, Any] = {
            "chunk_id": r.chunk_id,
            "document_id": r.document_id,
            "document_filename": r.document_filename,
            "document_filepath": filepath,
            "filepath": filepath,
            "chunk_index": r.chunk_index,
            "content": r.content,
            "score": r.score,
            # KB the hit came from. chunk/document ids autoincrement PER KB
            # and collide across KBs; uniqueness is the (kb, chunk_id) pair.
            "kb": getattr(r, "kb", None) or "",
        }
        item["citation"] = _format_citation(item)
        payload_results.append(item)

    return {
        "query": query,
        "mode": mode,
        # Advisory: multi-KB requests are force-coerced to semantic (raw
        # cosine is the only cross-KB-comparable score); single-KB requests
        # keep the requested mode. Same contract as HTTP /api/v2/search.
        "mode_used": effective_mode,
        "kb": kb_selector,
        "count": len(payload_results),
        "results": payload_results,
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------


@mcp.tool()
async def search_documents(
    query: str,
    mode: str = "hybrid",
    limit: int = 10,
    kb: str | None = None,
) -> dict[str, Any]:
    """Search ingested documents using semantic, keyword, or hybrid search.

    On multi-KB deployments the optional `kb` parameter selects which
    knowledge base(s) to search: a single KB name (e.g. "primary"), a
    comma-separated list (e.g. "atc,cfo"), or "all" to federate across every
    registered KB. Omit `kb` for the classic single-corpus search. kb-routed
    searches run the same pipeline as HTTP POST /api/v2/search: requests
    spanning >1 KB are coerced to semantic mode (reported in `mode_used`),
    and every result carries a `kb` field plus a `citation` string in the
    kb-namespaced grammar [[RAG:{kb}:{path}#{chunk_index}@{score}]].

    Args:
        query: The search query string.
        mode: Search mode - one of "semantic", "keyword", or "hybrid".
        limit: Maximum number of results to return (1-100).
        kb: Optional KB selector - a KB name, comma-separated names, or
            "all". Absent/blank keeps the default single-corpus behavior.
            Errors if the deployment has no knowledge_bases configured or a
            named KB does not exist.
    """
    if mode not in ("semantic", "keyword", "hybrid"):
        return {"error": f"Invalid mode '{mode}'. Use 'semantic', 'keyword', or 'hybrid'."}

    limit = max(1, min(limit, 100))

    kb_selector = _parse_kb_selector(kb)
    if kb_selector is not None:
        return await _search_documents_v2(query, mode, limit, kb_selector)

    embed_svc = _get_embedding_service()

    async with async_session() as session:
        if mode == "semantic":
            results = await semantic_search(query, session, embed_svc, limit)
        elif mode == "keyword":
            results = await keyword_search(query, session, limit)
        else:
            results = await hybrid_search(query, session, embed_svc, limit)

    return {
        "query": query,
        "mode": mode,
        "count": len(results),
        "results": [
            {
                "chunk_id": r.chunk_id,
                "document_id": r.document_id,
                "document_filename": r.document_filename,
                # Absolute, Read-able path to the source document for this hit.
                # `document_filepath` mirrors the HTTP /search field name so MCP
                # and HTTP responses are consistent; `filepath` is kept as an
                # alias for backward compatibility with existing MCP callers.
                "document_filepath": r.document_filepath,
                "filepath": r.document_filepath,
                "chunk_index": r.chunk_index,
                "content": r.content,
                "score": r.score,
            }
            for r in results
        ],
    }


@mcp.tool()
async def ingest_file(filepath: str) -> dict[str, Any]:
    """Ingest a single file into the RAG system.

    Args:
        filepath: Absolute path to the file to ingest.
    """
    embed_svc = _get_embedding_service()

    async with async_session() as session:
        doc = await _ingest_file(filepath, session, embed_svc)

    return {
        "status": "ok",
        "document_id": doc.id,
        "filename": doc.filename,
        "chunk_count": doc.chunk_count,
    }


@mcp.tool()
async def list_documents() -> dict[str, Any]:
    """List all documents that have been ingested into the RAG system."""
    async with async_session() as session:
        stmt = select(Document).order_by(Document.id)
        result = await session.execute(stmt)
        documents = result.scalars().all()

    return {
        "count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "filepath": doc.filepath,
                "file_type": doc.file_type,
                "chunk_count": doc.chunk_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc in documents
        ],
    }


@mcp.tool()
async def get_document(document_id: int) -> dict[str, Any]:
    """Get detailed information about a specific ingested document.

    Args:
        document_id: The numeric ID of the document to retrieve.
    """
    async with async_session() as session:
        doc = await session.get(Document, document_id)

    if doc is None:
        return {"error": f"Document with id {document_id} not found."}

    return {
        "id": doc.id,
        "filename": doc.filename,
        "filepath": doc.filepath,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "chunk_count": doc.chunk_count,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


# ---------------------------------------------------------------------------
# Server entry point
# ---------------------------------------------------------------------------


async def _startup() -> None:
    """Initialise the database before serving requests."""
    await init_db()


def run_mcp_server() -> None:
    """Run the MCP server (stdio transport by default)."""
    asyncio.get_event_loop().run_until_complete(_startup())
    mcp.run()


if __name__ == "__main__":
    run_mcp_server()
