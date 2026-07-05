"""Updated API Routes for Multi-KB RAG System

Extends FastAPI with:
- Multi-KB search endpoints
- Router configuration
- KB management endpoints
- Routing estimation (debugging)
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .kb import SearchMode
from .registry import KnowledgeRegistry
from .router import BroadcastRouter, StaticRouter
from .search_pipeline import SearchPipeline

logger = logging.getLogger(__name__)

# ============================================================================
# Data Models
# ============================================================================


class SearchRequest(BaseModel):
    """Search request with KB selection."""

    query: str = Field(..., description="User query")
    mode: str = Field(
        default=SearchMode.HYBRID,
        description="Search mode: semantic, keyword, hybrid",
    )
    kb: str | list[str] | None = Field(
        default=None,
        description='KB name(s) to search. Use "all" for broadcast, None for routed',
    )
    limit: int = Field(default=10, ge=1, le=100, description="Max results")
    embedding_required: bool = Field(
        default=False,
        description="Fail if embeddings unavailable (vs fallback to keyword)",
    )


class SearchResponse(BaseModel):
    """Search result.

    ``kb`` names the knowledge base the hit came from. chunk/document ids
    autoincrement per-KB database and WILL collide across KBs; uniqueness is
    the ``(kb, chunk_id)`` pair. Citation grammar for multi-KB hits:
    ``[[RAG:{kb}:{path}#{chunk}@{score}]]``.
    """

    chunk_id: int
    document_id: int
    document_filename: str
    document_filepath: str = ""
    chunk_index: int
    content: str
    score: float
    kb: str = ""


class SearchEnvelope(BaseModel):
    """Search response envelope.

    ``mode_used`` is an advisory: multi-KB requests are force-coerced to
    semantic mode (raw cosine is the only cross-KB-comparable score — all KBs
    share one embedding space, enforced by the per-KB dimension guard).
    Single-KB requests keep the requested mode.
    """

    results: list[SearchResponse]
    mode_used: str
    total: int


class RoutingEstimate(BaseModel):
    """Routing decision estimate."""

    query: str
    selected_kbs: list[str]
    confidence: float
    reason: str


class KBInfo(BaseModel):
    """Knowledge base information."""

    name: str
    kb_type: str
    supports_embedding: bool
    supports_keyword_search: bool


# ============================================================================
# Dependencies
# ============================================================================


class APIState:
    """Shared API state."""

    def __init__(self):
        self.registry: KnowledgeRegistry | None = None
        self.pipeline: SearchPipeline | None = None
        self.router: BroadcastRouter | StaticRouter | None = None


_api_state = APIState()


async def get_registry() -> KnowledgeRegistry:
    """Get knowledge registry.

    503 (not 500) on single-corpus deploys: the router is always mounted, but
    the registry/pipeline are only initialized when a ``knowledge_bases``
    stanza is configured — a truthful, probe-friendly signal.
    """
    if _api_state.registry is None:
        raise HTTPException(
            status_code=503,
            detail="multi-KB not configured (no knowledge_bases stanza in config)",
        )
    return _api_state.registry


async def get_pipeline() -> SearchPipeline:
    """Get search pipeline."""
    if _api_state.pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="multi-KB not configured (no knowledge_bases stanza in config)",
        )
    return _api_state.pipeline


RegistryDep = Annotated[KnowledgeRegistry, Depends(get_registry)]
PipelineDep = Annotated[SearchPipeline, Depends(get_pipeline)]

# ============================================================================
# Routers
# ============================================================================

router = APIRouter(prefix="/api/v2", tags=["multi-kb"])


def _tag_kb(results: list, kb_name: str) -> list:
    """Fallback KB attribution for results the search core did not stamp.

    The search core stamps ``SearchResult.kb`` in ``_search_kb`` (search-core
    work zone); this no-ops once that lands and covers the gap until then for
    the branches where the gateway knows the KB.
    """
    for r in results:
        if getattr(r, "kb", None) in (None, ""):
            try:
                r.kb = kb_name
            except Exception:  # slotted/frozen result types: skip silently
                pass
    return results


async def _require_kb(registry: KnowledgeRegistry, kb_name: str) -> None:
    """404 on an explicitly named KB that is not registered."""
    try:
        await registry.get(kb_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"KB '{kb_name}' not found")


@router.post("/search")
async def search(
    request: SearchRequest,
    pipeline: PipelineDep,
    registry: RegistryDep,
) -> SearchEnvelope:
    """Search knowledge base(s).

    Query routing:
    - kb=None: Use configured router (default)
    - kb="all": Broadcast to all KBs
    - kb="name": Search specific KB
    - kb=["name1", "name2"]: Search multiple KBs

    Multi-KB requests (kb="all" or a list of >1 KBs) are force-coerced to
    semantic mode — per-KB hybrid/keyword scores (RRF, ts_rank) are not
    cross-KB comparable, raw cosine is. The response's ``mode_used`` field
    advises the mode actually executed. Single-KB requests keep all modes.
    """
    try:
        effective_mode = request.mode

        if request.kb == "all":
            # Broadcast search (pipeline coerces to semantic for >1 KB)
            kb_names = await registry.list()
            effective_mode = SearchPipeline.coerce_multi_kb_mode(
                request.mode, len(kb_names)
            )
            results = await pipeline.search_all(
                query=request.query,
                mode=request.mode,
                limit=request.limit,
            )
        elif isinstance(request.kb, str):
            # Search specific KB (single-KB: all modes supported, no coercion)
            await _require_kb(registry, request.kb)
            results = await pipeline.search_specific(
                kb_name=request.kb,
                query=request.query,
                mode=effective_mode,
                limit=request.limit,
                embedding_required=request.embedding_required,
            )
            _tag_kb(results, request.kb)
        elif isinstance(request.kb, list):
            # Subset federation: sound multi-KB entry point (mode coerced
            # once, embedding computed once, results kb-stamped + merged).
            for kb_name in request.kb:
                await _require_kb(registry, kb_name)
            effective_mode = SearchPipeline.coerce_multi_kb_mode(
                request.mode, len(request.kb)
            )
            results = await pipeline.search_many(
                kb_names=request.kb,
                query=request.query,
                mode=request.mode,
                limit=request.limit,
                embedding_required=request.embedding_required,
            )
        else:
            # Use router (default; static router routes to a single KB).
            # The pipeline coerces internally if the router fans out; the
            # advisory is corrected post-hoc from the kb-stamped results.
            results = await pipeline.search(
                query=request.query,
                mode=effective_mode,
                limit=request.limit,
                embedding_required=request.embedding_required,
            )
            kbs_seen = {getattr(r, "kb", None) for r in results} - {None, ""}
            effective_mode = SearchPipeline.coerce_multi_kb_mode(
                request.mode, max(len(kbs_seen), 1)
            )

        return SearchEnvelope(
            results=[
                SearchResponse(
                    chunk_id=r.chunk_id,
                    document_id=r.document_id,
                    document_filename=r.document_filename,
                    document_filepath=getattr(r, "document_filepath", "") or "",
                    chunk_index=r.chunk_index,
                    content=r.content,
                    score=r.score,
                    kb=getattr(r, "kb", None) or "",
                )
                for r in results
            ],
            mode_used=effective_mode,
            total=len(results),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/estimate-routing")
async def estimate_routing(
    pipeline: PipelineDep,
    query: str = Query(..., description="User query"),
) -> RoutingEstimate:
    """Estimate which KBs would be used for a query.

    Useful for debugging routing decisions.
    """
    estimate = await pipeline.estimate_routing(query)
    return RoutingEstimate(**estimate)


# ============================================================================
# Knowledge Base Management
# ============================================================================


@router.get("/knowledge-bases")
async def list_kbs(registry: RegistryDep) -> list[KBInfo]:
    """List all registered knowledge bases."""
    kb_names = await registry.list()
    configs = await registry.list_with_config()

    results = []
    for name in kb_names:
        try:
            kb = await registry.get(name)
            config = configs.get(name, {})
            results.append(
                KBInfo(
                    name=name,
                    kb_type=config.get("type", "unknown"),
                    supports_embedding=kb.supports_embedding(),
                    supports_keyword_search=kb.supports_keyword_search(),
                )
            )
        except Exception:
            pass

    return results


@router.get("/knowledge-bases/{name}")
async def get_kb_info(
    name: str,
    registry: RegistryDep,
) -> KBInfo:
    """Get info about specific knowledge base."""
    try:
        kb = await registry.get(name)
        configs = await registry.list_with_config()
        config = configs.get(name, {})

        return KBInfo(
            name=name,
            kb_type=config.get("type", "unknown"),
            supports_embedding=kb.supports_embedding(),
            supports_keyword_search=kb.supports_keyword_search(),
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"KB '{name}' not found")


@router.post("/knowledge-bases/{name}/{kb_type}")
async def create_kb(
    name: str,
    kb_type: str,
    registry: RegistryDep,
) -> KBInfo:
    """Create a new knowledge base.

    Args:
        name: KB name
        kb_type: "postgres" or "keyword-only"
    """
    try:
        kb = await registry.create(name, kb_type)

        return KBInfo(
            name=name,
            kb_type=kb_type,
            supports_embedding=kb.supports_embedding(),
            supports_keyword_search=kb.supports_keyword_search(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/knowledge-bases/{name}")
async def delete_kb(
    name: str,
    registry: RegistryDep,
) -> dict:
    """Delete a knowledge base."""
    try:
        await registry.delete(name)
        return {"status": "deleted", "kb": name}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"KB '{name}' not found")


# ============================================================================
# Health & Status
# ============================================================================


@router.get("/health")
async def health(registry: RegistryDep) -> dict:
    """Check health of all knowledge bases."""
    kb_names = await registry.list()
    status = {}

    for name in kb_names:
        try:
            kb = await registry.get(name)
            is_healthy = await kb.health_check()
            status[name] = "healthy" if is_healthy else "unhealthy"
        except Exception:
            status[name] = "error"

    overall = "healthy" if all(s == "healthy" for s in status.values()) else "degraded"
    return {
        "status": overall,
        "knowledge_bases": status,
        "total_kbs": len(kb_names),
    }


# ============================================================================
# Initialization
# ============================================================================


async def initialize_api(
    registry: KnowledgeRegistry,
    embedding_service=None,
    router_config: dict | None = None,
) -> None:
    """Initialize API with knowledge registry and pipeline.

    Call this during app startup.

    Args:
        registry: Knowledge registry (pre-configured with KBs)
        embedding_service: Embedding service for semantic search
        router_config: ``router:`` config section (ConfigManager
            ``get_router_config()`` shape). ``type: static`` honors either
            explicit ``static.rules`` or the ``static.default`` shorthand
            (catch-all rule to one KB — the plan's MVP default routing).
            Anything else (or None) keeps today's broadcast behavior.
            LLM/hybrid routing is deferred.
    """
    _api_state.registry = registry

    router_config = router_config or {}
    router_type = router_config.get("type", "broadcast")

    if router_type == "static":
        static_cfg = router_config.get("static") or {}
        rules = static_cfg.get("rules")
        if not rules:
            default_kb = static_cfg.get("default", "primary")
            rules = [{"pattern": ".*", "kb": default_kb, "confidence": 0.5}]
        router_instance: BroadcastRouter | StaticRouter = StaticRouter(registry, rules)
        logger.info("api_v2 router: static (%d rules)", len(rules))
    else:
        if router_type not in ("broadcast",):
            logger.warning(
                "api_v2 router type '%s' not supported yet; using broadcast",
                router_type,
            )
        router_instance = BroadcastRouter(registry)

    await router_instance.initialize()
    _api_state.router = router_instance

    # Create pipeline
    pipeline = SearchPipeline(registry, router_instance, embedding_service)
    _api_state.pipeline = pipeline
