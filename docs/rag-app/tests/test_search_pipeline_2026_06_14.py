"""Pattern-D tests for ``app/search_pipeline.py`` (W62 C1, carry-over W61 D7).

These tests exercise ``SearchPipeline`` — the multi-KB orchestrator — WITHOUT:

  * touching PostgreSQL / Redis / Ollama (no live IO);
  * importing ``app.main`` (which would build the FastAPI app object);
  * exercising real ``KnowledgeRegistry``/``KnowledgeRouter`` backends.

Pattern-D discipline (per W61 D4 scout map):

  * ``search_pipeline.py`` itself has **NONE** import-time side-effects
    (all deps under ``TYPE_CHECKING``) — safe to import directly.
  * ``SearchResult`` is pulled from ``app.search``; that module triggers
    the ``database.py`` ENGINE side-effect on import, but only constructs
    (no TCP). We do NOT instantiate any session in this file.
  * Registry / router / embedding-service / KB collaborators are all
    AsyncMock-backed — no real backends are constructed.

Spec target: ``rag-bootstrap/app/search_pipeline.py`` (314 LOC source).
Test count target per spec: ``>=8`` tests; this file ships **12**.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.kb import SearchMode
from app.router import RoutingDecision
from app.search import SearchResult
from app.search_pipeline import SearchPipeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_result(
    *,
    chunk_id: int = 1,
    document_id: int = 100,
    filename: str = "doc.md",
    chunk_index: int = 0,
    content: str = "hello world",
    score: float = 0.9,
) -> SearchResult:
    """Build a SearchResult dataclass instance with sensible defaults."""
    return SearchResult(
        chunk_id=chunk_id,
        document_id=document_id,
        document_filename=filename,
        chunk_index=chunk_index,
        content=content,
        score=score,
    )


def _make_kb(
    *,
    name: str = "fake-kb",
    supports_embedding: bool = True,
    supports_keyword: bool = True,
    search_results: list[SearchResult] | None = None,
    search_raises: Exception | None = None,
) -> MagicMock:
    """Construct a KB mock with the surface SearchPipeline relies on."""
    kb = MagicMock()
    kb.name = name
    kb.supports_embedding = MagicMock(return_value=supports_embedding)
    kb.supports_keyword_search = MagicMock(return_value=supports_keyword)

    if search_raises is not None:
        kb.search = AsyncMock(side_effect=search_raises)
    else:
        kb.search = AsyncMock(return_value=search_results or [])
    return kb


def _make_registry(kbs: dict[str, MagicMock]) -> MagicMock:
    """Construct a registry mock backed by a dict of KB mocks."""
    reg = MagicMock()

    async def _get(name: str) -> MagicMock:
        if name not in kbs:
            raise KeyError(f"KB '{name}' not found")
        return kbs[name]

    async def _list() -> list[str]:
        return list(kbs.keys())

    reg.get = AsyncMock(side_effect=_get)
    reg.list = AsyncMock(side_effect=_list)
    return reg


def _make_router(decision: RoutingDecision) -> MagicMock:
    router = MagicMock()
    router.route = AsyncMock(return_value=decision)
    return router


def _make_embedding_service(
    *,
    vector: list[float] | None = None,
    raises: Exception | None = None,
) -> MagicMock:
    svc = MagicMock()
    if raises is not None:
        svc.embed_text = AsyncMock(side_effect=raises)
    else:
        svc.embed_text = AsyncMock(return_value=vector or [0.1, 0.2, 0.3])
    return svc


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_routes_to_selected_kb_and_returns_results() -> None:
    """Happy path: router selects one KB, embedding computed, results returned."""
    expected = [_make_result(chunk_id=1, content="alpha", score=0.95)]
    kb = _make_kb(name="docs", search_results=expected)
    registry = _make_registry({"docs": kb})
    router = _make_router(
        RoutingDecision(kb_names=["docs"], confidence=0.9, reason="pattern-match")
    )
    embedding_service = _make_embedding_service(vector=[0.42] * 3)

    pipeline = SearchPipeline(
        registry=registry,
        router=router,
        embedding_service=embedding_service,
    )
    results = await pipeline.search("alpha query", mode=SearchMode.HYBRID, limit=5)

    assert results == expected
    router.route.assert_awaited_once_with("alpha query")
    registry.get.assert_awaited_once_with("docs")
    embedding_service.embed_text.assert_awaited_once_with(
        "alpha query", task="search_query"
    )
    # The KB receives the computed embedding.
    kwargs = kb.search.await_args.kwargs
    assert kwargs["embedding"] == [0.42] * 3
    assert kwargs["mode"] == SearchMode.HYBRID
    assert kwargs["limit"] == 5


@pytest.mark.asyncio
async def test_search_returns_empty_when_router_yields_no_kbs() -> None:
    """Router empty kb_names => pipeline short-circuits to [] (no KB call)."""
    kb = _make_kb()
    registry = _make_registry({"docs": kb})
    router = _make_router(RoutingDecision(kb_names=[], confidence=0.0, reason="no-match"))

    pipeline = SearchPipeline(registry=registry, router=router, embedding_service=None)
    results = await pipeline.search("orphan query")

    assert results == []
    registry.get.assert_not_awaited()
    kb.search.assert_not_awaited()


@pytest.mark.asyncio
async def test_search_keyword_mode_skips_embedding_computation() -> None:
    """KEYWORD mode must not invoke embedding_service at all."""
    expected = [_make_result(content="kw hit", score=0.7)]
    kb = _make_kb(search_results=expected)
    registry = _make_registry({"docs": kb})
    router = _make_router(
        RoutingDecision(kb_names=["docs"], confidence=1.0, reason="kw-only")
    )
    embedding_service = _make_embedding_service()

    pipeline = SearchPipeline(
        registry=registry, router=router, embedding_service=embedding_service
    )
    results = await pipeline.search("kw", mode=SearchMode.KEYWORD)

    assert results == expected
    embedding_service.embed_text.assert_not_awaited()
    # KB receives embedding=None.
    assert kb.search.await_args.kwargs["embedding"] is None


@pytest.mark.asyncio
async def test_search_merges_and_ranks_results_across_kbs_and_dedupes() -> None:
    """Multi-KB search merges all results, sorts by score desc, dedupes by content hash."""
    # Two KBs return overlapping content; lower-score dupe must be dropped.
    kb_a = _make_kb(
        name="kb_a",
        search_results=[
            _make_result(chunk_id=1, content="shared", score=0.5),
            _make_result(chunk_id=2, content="only-a", score=0.9),
        ],
    )
    kb_b = _make_kb(
        name="kb_b",
        search_results=[
            _make_result(chunk_id=3, content="shared", score=0.8),  # dupe of "shared"
            _make_result(chunk_id=4, content="only-b", score=0.3),
        ],
    )
    registry = _make_registry({"kb_a": kb_a, "kb_b": kb_b})
    router = _make_router(
        RoutingDecision(kb_names=["kb_a", "kb_b"], confidence=0.8, reason="multi")
    )

    pipeline = SearchPipeline(
        registry=registry,
        router=router,
        embedding_service=_make_embedding_service(),
    )
    results = await pipeline.search("q", mode=SearchMode.HYBRID)

    # Dedup: only one "shared" survives — whichever was iterated first
    # (kb_a's version), per the implementation. So the surviving content set
    # must contain "shared", "only-a", "only-b" and be sorted by score desc.
    contents = [r.content for r in results]
    assert contents == ["only-a", "shared", "only-b"]
    # The deduped "shared" should be kb_a's version (score=0.5, kept first).
    shared = next(r for r in results if r.content == "shared")
    assert shared.chunk_id == 1
    assert shared.score == 0.5


@pytest.mark.asyncio
async def test_search_continues_when_a_single_kb_raises() -> None:
    """One KB raising should not abort the whole pipeline; others still contribute."""
    expected = [_make_result(content="from-good", score=0.6)]
    good_kb = _make_kb(name="good", search_results=expected)
    bad_kb = _make_kb(name="bad", search_raises=RuntimeError("boom"))
    registry = _make_registry({"good": good_kb, "bad": bad_kb})
    router = _make_router(
        RoutingDecision(kb_names=["bad", "good"], confidence=0.7, reason="multi")
    )

    pipeline = SearchPipeline(
        registry=registry,
        router=router,
        embedding_service=_make_embedding_service(),
    )
    results = await pipeline.search("q")

    assert results == expected
    good_kb.search.assert_awaited_once()
    bad_kb.search.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_embedding_returns_none_when_service_missing_and_not_required() -> None:
    """No embedding_service + embedding_required=False => returns None (graceful)."""
    pipeline = SearchPipeline(
        registry=MagicMock(),
        router=MagicMock(),
        embedding_service=None,
    )
    result = await pipeline._get_embedding("q", embedding_required=False)
    assert result is None


@pytest.mark.asyncio
async def test_get_embedding_raises_when_service_missing_and_required() -> None:
    """No embedding_service + embedding_required=True => ValueError."""
    pipeline = SearchPipeline(
        registry=MagicMock(),
        router=MagicMock(),
        embedding_service=None,
    )
    with pytest.raises(ValueError, match="Embedding required"):
        await pipeline._get_embedding("q", embedding_required=True)


@pytest.mark.asyncio
async def test_get_embedding_falls_back_to_none_when_compute_fails() -> None:
    """embed_text raising + embedding_required=False => returns None (fallback)."""
    svc = _make_embedding_service(raises=RuntimeError("model offline"))
    pipeline = SearchPipeline(
        registry=MagicMock(), router=MagicMock(), embedding_service=svc
    )
    result = await pipeline._get_embedding("q", embedding_required=False)
    assert result is None


@pytest.mark.asyncio
async def test_get_embedding_propagates_when_required_and_compute_fails() -> None:
    """embed_text raising + embedding_required=True => propagates the exception."""
    svc = _make_embedding_service(raises=RuntimeError("model offline"))
    pipeline = SearchPipeline(
        registry=MagicMock(), router=MagicMock(), embedding_service=svc
    )
    with pytest.raises(RuntimeError, match="model offline"):
        await pipeline._get_embedding("q", embedding_required=True)


@pytest.mark.asyncio
async def test_search_kb_falls_back_to_keyword_when_embedding_unavailable() -> None:
    """Hybrid mode w/ no embedding + KB supports keyword => use KEYWORD fallback."""
    expected = [_make_result(content="kw-fallback", score=0.4)]
    kb = _make_kb(supports_embedding=True, supports_keyword=True, search_results=expected)
    pipeline = SearchPipeline(
        registry=MagicMock(), router=MagicMock(), embedding_service=None
    )

    results = await pipeline._search_kb(
        kb=kb,
        query="q",
        mode=SearchMode.HYBRID,
        embedding=None,
        limit=10,
        embedding_required=False,
    )
    assert results == expected
    kb.search.assert_awaited_once_with("q", SearchMode.KEYWORD, 10)


@pytest.mark.asyncio
async def test_search_kb_returns_empty_when_no_search_modes_supported() -> None:
    """Hybrid w/o embedding + KB doesn't support keyword either => []."""
    kb = _make_kb(supports_embedding=True, supports_keyword=False)
    pipeline = SearchPipeline(
        registry=MagicMock(), router=MagicMock(), embedding_service=None
    )

    results = await pipeline._search_kb(
        kb=kb,
        query="q",
        mode=SearchMode.HYBRID,
        embedding=None,
        limit=10,
        embedding_required=False,
    )
    assert results == []
    kb.search.assert_not_awaited()


@pytest.mark.asyncio
async def test_search_kb_raises_when_embedding_required_but_missing() -> None:
    """Hybrid w/o embedding + embedding_required=True => ValueError surfaced."""
    kb = _make_kb(supports_embedding=True, supports_keyword=True)
    pipeline = SearchPipeline(
        registry=MagicMock(), router=MagicMock(), embedding_service=None
    )
    with pytest.raises(ValueError, match="requires embeddings"):
        await pipeline._search_kb(
            kb=kb,
            query="q",
            mode=SearchMode.HYBRID,
            embedding=None,
            limit=10,
            embedding_required=True,
        )


@pytest.mark.asyncio
async def test_search_kb_returns_empty_when_kb_search_raises() -> None:
    """Underlying kb.search raising => caller gets [] (not propagated)."""
    kb = _make_kb(search_raises=RuntimeError("kaboom"))
    pipeline = SearchPipeline(
        registry=MagicMock(), router=MagicMock(), embedding_service=None
    )
    results = await pipeline._search_kb(
        kb=kb,
        query="q",
        mode=SearchMode.KEYWORD,
        embedding=None,
        limit=5,
        embedding_required=False,
    )
    assert results == []


@pytest.mark.asyncio
async def test_search_specific_returns_empty_when_kb_not_found() -> None:
    """search_specific: KeyError from registry.get => [] (logged, not raised)."""
    registry = _make_registry({})  # empty registry
    pipeline = SearchPipeline(
        registry=registry,
        router=MagicMock(),
        embedding_service=_make_embedding_service(),
    )
    results = await pipeline.search_specific(kb_name="ghost", query="q")
    assert results == []


@pytest.mark.asyncio
async def test_search_all_iterates_every_kb_in_registry() -> None:
    """search_all: calls search_specific for every KB returned by registry.list()."""
    kb_a = _make_kb(
        name="kb_a",
        search_results=[_make_result(content="a", score=0.5)],
    )
    kb_b = _make_kb(
        name="kb_b",
        search_results=[_make_result(content="b", score=0.9)],
    )
    registry = _make_registry({"kb_a": kb_a, "kb_b": kb_b})

    pipeline = SearchPipeline(
        registry=registry,
        router=MagicMock(),  # NOT used by search_all (bypasses routing)
        embedding_service=_make_embedding_service(),
    )
    results = await pipeline.search_all("q", mode=SearchMode.HYBRID, limit=10)

    # Both KBs were queried and merged with score-desc ordering.
    contents = [r.content for r in results]
    assert contents == ["b", "a"]
    kb_a.search.assert_awaited_once()
    kb_b.search.assert_awaited_once()


@pytest.mark.asyncio
async def test_estimate_routing_returns_decision_dict() -> None:
    """estimate_routing surfaces router decision fields verbatim (debug helper)."""
    decision = RoutingDecision(
        kb_names=["docs", "code"], confidence=0.83, reason="llm-router"
    )
    router = _make_router(decision)
    pipeline = SearchPipeline(
        registry=MagicMock(), router=router, embedding_service=None
    )

    info = await pipeline.estimate_routing("how do I deploy?")
    assert info == {
        "query": "how do I deploy?",
        "selected_kbs": ["docs", "code"],
        "confidence": 0.83,
        "reason": "llm-router",
    }


@pytest.mark.asyncio
async def test_merge_results_empty_input_returns_empty() -> None:
    """Static helper: empty input => empty output (defensive)."""
    assert SearchPipeline._merge_results([]) == []
