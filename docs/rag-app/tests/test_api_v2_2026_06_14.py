"""Pattern-D tests for app/api_v2.py (Multi-KB API endpoints).

Wave 61 D6: ≥8 tests, ≥1 happy + ≥1 error path per public endpoint.

Public endpoints covered (from app/api_v2.py):
- POST   /api/v2/search                          (search)
- GET    /api/v2/estimate-routing                (estimate_routing)
- GET    /api/v2/knowledge-bases                 (list_kbs)
- GET    /api/v2/knowledge-bases/{name}          (get_kb_info)
- POST   /api/v2/knowledge-bases/{name}/{kb_type} (create_kb)
- DELETE /api/v2/knowledge-bases/{name}          (delete_kb)
- GET    /api/v2/health                          (health)

Also: initialize_api() helper (initialization smoke).

Pattern-D: pure-unit, no DB / Redis. We build a minimal FastAPI app
containing ONLY the api_v2 router, and override get_registry /
get_pipeline dependencies with AsyncMock-backed fakes. This avoids the
heavy app.main lifespan (which connects to PostgreSQL).
"""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api_v2 import (
    KBInfo,
    RoutingEstimate,
    SearchRequest,
    _api_state,
    get_pipeline,
    get_registry,
    initialize_api,
    router as api_v2_router,
)


# ---------------------------------------------------------------------------
# Test fixture: D4-style minimal app with dependency overrides
# ---------------------------------------------------------------------------


@dataclass
class _FakeSearchResult:
    """Minimal stand-in for app.search.SearchResult."""

    chunk_id: int
    document_id: int
    document_filename: str
    chunk_index: int
    content: str
    score: float


def _make_fake_kb(
    supports_embedding: bool = True,
    supports_keyword: bool = True,
    healthy: bool = True,
) -> MagicMock:
    kb = MagicMock()
    kb.supports_embedding = MagicMock(return_value=supports_embedding)
    kb.supports_keyword_search = MagicMock(return_value=supports_keyword)
    kb.health_check = AsyncMock(return_value=healthy)
    return kb


def _make_app(
    registry: MagicMock | None = None,
    pipeline: MagicMock | None = None,
) -> FastAPI:
    """Build a FastAPI app containing ONLY the api_v2 router with
    overridden dependencies. Avoids app.main lifespan/DB."""
    app = FastAPI()
    app.include_router(api_v2_router)

    if registry is None:
        registry = MagicMock()
    if pipeline is None:
        pipeline = MagicMock()

    async def _override_registry():
        return registry

    async def _override_pipeline():
        return pipeline

    app.dependency_overrides[get_registry] = _override_registry
    app.dependency_overrides[get_pipeline] = _override_pipeline
    return app


@pytest.fixture()
def fake_registry() -> MagicMock:
    reg = MagicMock()
    reg.list = AsyncMock(return_value=["docs_kb", "code_kb"])
    reg.list_with_config = AsyncMock(
        return_value={
            "docs_kb": {"type": "postgres"},
            "code_kb": {"type": "keyword-only"},
        }
    )
    reg.get = AsyncMock(side_effect=lambda name: _make_fake_kb())
    reg.create = AsyncMock(side_effect=lambda name, kb_type: _make_fake_kb())
    reg.delete = AsyncMock(return_value=None)
    return reg


@pytest.fixture()
def fake_pipeline() -> MagicMock:
    p = MagicMock()
    p.search = AsyncMock(
        return_value=[
            _FakeSearchResult(1, 10, "doc.pdf", 0, "hello world", 0.9),
        ]
    )
    p.search_all = AsyncMock(
        return_value=[
            _FakeSearchResult(2, 11, "all.pdf", 0, "broadcast", 0.8),
            _FakeSearchResult(3, 12, "all.pdf", 1, "broadcast 2", 0.7),
        ]
    )
    p.search_specific = AsyncMock(
        return_value=[
            _FakeSearchResult(4, 13, "specific.pdf", 0, "specific", 0.85),
        ]
    )
    p._merge_results = MagicMock(side_effect=lambda results: results)
    p.estimate_routing = AsyncMock(
        return_value={
            "query": "test",
            "selected_kbs": ["docs_kb"],
            "confidence": 0.75,
            "reason": "broadcast",
        }
    )
    return p


# ---------------------------------------------------------------------------
# Data-model sanity (1 test)
# ---------------------------------------------------------------------------


def test_search_request_defaults():
    """SearchRequest builds with defaults; mode defaults to 'hybrid'."""
    req = SearchRequest(query="hello")
    assert req.query == "hello"
    assert req.mode == "hybrid"
    assert req.kb is None
    assert req.limit == 10
    assert req.embedding_required is False


def test_search_request_validation_limit_bounds():
    """SearchRequest rejects limit < 1 and limit > 100."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        SearchRequest(query="q", limit=0)
    with pytest.raises(ValidationError):
        SearchRequest(query="q", limit=101)


# ---------------------------------------------------------------------------
# POST /api/v2/search  (4 tests: 1 happy + 3 branch/error)
# ---------------------------------------------------------------------------


def test_search_routed_default_path(fake_registry, fake_pipeline):
    """kb=None -> pipeline.search() is called (routed path)."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post(
        "/api/v2/search",
        json={"query": "hello", "limit": 5},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["chunk_id"] == 1
    assert body[0]["document_filename"] == "doc.pdf"
    fake_pipeline.search.assert_awaited_once()


def test_search_broadcast_all(fake_registry, fake_pipeline):
    """kb='all' -> pipeline.search_all() is called."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post(
        "/api/v2/search",
        json={"query": "hello", "kb": "all", "mode": "semantic"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 2
    fake_pipeline.search_all.assert_awaited_once()
    fake_pipeline.search.assert_not_called()


def test_search_specific_kb(fake_registry, fake_pipeline):
    """kb='docs_kb' (str) -> pipeline.search_specific() called once."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post(
        "/api/v2/search",
        json={"query": "hello", "kb": "docs_kb"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body[0]["document_filename"] == "specific.pdf"
    fake_pipeline.search_specific.assert_awaited_once()


def test_search_multi_kb_list(fake_registry, fake_pipeline):
    """kb=['a','b'] -> search_specific called per kb, _merge_results invoked."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post(
        "/api/v2/search",
        json={"query": "hello", "kb": ["docs_kb", "code_kb"]},
    )

    assert resp.status_code == 200, resp.text
    assert fake_pipeline.search_specific.await_count == 2
    fake_pipeline._merge_results.assert_called_once()


def test_search_pipeline_error_returns_400(fake_registry, fake_pipeline):
    """Pipeline raising any Exception -> HTTP 400 with detail."""
    fake_pipeline.search.side_effect = RuntimeError("pipeline boom")
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post("/api/v2/search", json={"query": "hello"})

    assert resp.status_code == 400
    assert "pipeline boom" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# GET /api/v2/estimate-routing  (1 happy)
# ---------------------------------------------------------------------------


def test_estimate_routing_happy(fake_registry, fake_pipeline):
    """estimate-routing returns the pipeline.estimate_routing() payload."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/estimate-routing?query=what+is+rag")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["query"] == "test"
    assert body["selected_kbs"] == ["docs_kb"]
    assert body["confidence"] == 0.75
    fake_pipeline.estimate_routing.assert_awaited_once_with("what is rag")


# ---------------------------------------------------------------------------
# GET /api/v2/knowledge-bases  (1 happy + 1 partial-failure)
# ---------------------------------------------------------------------------


def test_list_kbs_happy(fake_registry, fake_pipeline):
    """Returns one KBInfo per registered kb name."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/knowledge-bases")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    names = {kb["name"] for kb in body}
    assert names == {"docs_kb", "code_kb"}
    # config type carries through
    docs_entry = next(kb for kb in body if kb["name"] == "docs_kb")
    assert docs_entry["kb_type"] == "postgres"


def test_list_kbs_skips_failing_entries(fake_registry, fake_pipeline):
    """If registry.get() raises for a kb, that kb is silently skipped."""

    async def _flaky_get(name):
        if name == "code_kb":
            raise RuntimeError("kb broken")
        return _make_fake_kb()

    fake_registry.get.side_effect = _flaky_get

    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/knowledge-bases")

    assert resp.status_code == 200
    body = resp.json()
    assert {kb["name"] for kb in body} == {"docs_kb"}


# ---------------------------------------------------------------------------
# GET /api/v2/knowledge-bases/{name}  (1 happy + 1 error)
# ---------------------------------------------------------------------------


def test_get_kb_info_happy(fake_registry, fake_pipeline):
    """Returns KBInfo for an existing kb."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/knowledge-bases/docs_kb")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "docs_kb"
    assert body["kb_type"] == "postgres"
    assert body["supports_embedding"] is True


def test_get_kb_info_missing_returns_404(fake_registry, fake_pipeline):
    """If registry.get() raises KeyError, endpoint returns 404."""
    fake_registry.get.side_effect = KeyError("not found")

    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/knowledge-bases/nope")

    assert resp.status_code == 404
    assert "nope" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# POST /api/v2/knowledge-bases/{name}/{kb_type}  (1 happy + 1 error)
# ---------------------------------------------------------------------------


def test_create_kb_happy(fake_registry, fake_pipeline):
    """Creating a kb returns KBInfo with the requested name/type."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post("/api/v2/knowledge-bases/new_kb/postgres")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "new_kb"
    assert body["kb_type"] == "postgres"
    fake_registry.create.assert_awaited_once_with("new_kb", "postgres")


def test_create_kb_invalid_type_returns_400(fake_registry, fake_pipeline):
    """registry.create() raising ValueError -> HTTP 400."""
    fake_registry.create.side_effect = ValueError("unknown type")

    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.post("/api/v2/knowledge-bases/x/bogus")

    assert resp.status_code == 400
    assert "unknown type" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# DELETE /api/v2/knowledge-bases/{name}  (1 happy + 1 error)
# ---------------------------------------------------------------------------


def test_delete_kb_happy(fake_registry, fake_pipeline):
    """Successful delete returns {'status': 'deleted', 'kb': name}."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.delete("/api/v2/knowledge-bases/docs_kb")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {"status": "deleted", "kb": "docs_kb"}
    fake_registry.delete.assert_awaited_once_with("docs_kb")


def test_delete_kb_missing_returns_404(fake_registry, fake_pipeline):
    """registry.delete() raising KeyError -> HTTP 404."""
    fake_registry.delete.side_effect = KeyError("nope")

    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.delete("/api/v2/knowledge-bases/missing")

    assert resp.status_code == 404
    assert "missing" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# GET /api/v2/health  (1 happy + 1 degraded)
# ---------------------------------------------------------------------------


def test_health_all_healthy(fake_registry, fake_pipeline):
    """All KBs healthy -> overall status 'healthy'."""
    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/health")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["total_kbs"] == 2
    assert body["knowledge_bases"] == {"docs_kb": "healthy", "code_kb": "healthy"}


def test_health_degraded_when_kb_unhealthy(fake_registry, fake_pipeline):
    """One unhealthy kb -> overall 'degraded'."""

    async def _flaky_get(name):
        return _make_fake_kb(healthy=(name == "docs_kb"))

    fake_registry.get.side_effect = _flaky_get

    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["knowledge_bases"]["docs_kb"] == "healthy"
    assert body["knowledge_bases"]["code_kb"] == "unhealthy"


def test_health_marks_error_on_get_exception(fake_registry, fake_pipeline):
    """registry.get() raising -> kb reported as 'error' (degraded overall)."""
    fake_registry.get.side_effect = RuntimeError("get exploded")

    app = _make_app(fake_registry, fake_pipeline)
    client = TestClient(app)

    resp = client.get("/api/v2/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert all(v == "error" for v in body["knowledge_bases"].values())


# ---------------------------------------------------------------------------
# Dependency error paths (uninitialized registry / pipeline)
# ---------------------------------------------------------------------------


def test_get_registry_uninitialized_raises_500():
    """get_registry() raises HTTPException(500) when state is empty."""
    from fastapi import HTTPException

    saved = _api_state.registry
    _api_state.registry = None
    try:
        import asyncio

        with pytest.raises(HTTPException) as exc:
            asyncio.run(get_registry())
        assert exc.value.status_code == 500
    finally:
        _api_state.registry = saved


def test_get_pipeline_uninitialized_raises_500():
    """get_pipeline() raises HTTPException(500) when state is empty."""
    from fastapi import HTTPException

    saved = _api_state.pipeline
    _api_state.pipeline = None
    try:
        import asyncio

        with pytest.raises(HTTPException) as exc:
            asyncio.run(get_pipeline())
        assert exc.value.status_code == 500
    finally:
        _api_state.pipeline = saved


# ---------------------------------------------------------------------------
# initialize_api smoke
# ---------------------------------------------------------------------------


def test_initialize_api_populates_state(monkeypatch, fake_registry):
    """initialize_api() wires registry, router_instance, pipeline into state."""
    import asyncio

    # Patch BroadcastRouter / SearchPipeline so we don't construct real ones.
    fake_router_instance = MagicMock()
    fake_router_instance.initialize = AsyncMock(return_value=None)
    fake_pipeline_instance = MagicMock()

    monkeypatch.setattr(
        "app.api_v2.BroadcastRouter",
        MagicMock(return_value=fake_router_instance),
    )
    monkeypatch.setattr(
        "app.api_v2.SearchPipeline",
        MagicMock(return_value=fake_pipeline_instance),
    )

    saved_reg, saved_pipe, saved_router = (
        _api_state.registry,
        _api_state.pipeline,
        _api_state.router,
    )
    try:
        asyncio.run(initialize_api(fake_registry, embedding_service=None))
        assert _api_state.registry is fake_registry
        assert _api_state.router is fake_router_instance
        assert _api_state.pipeline is fake_pipeline_instance
        fake_router_instance.initialize.assert_awaited_once()
    finally:
        _api_state.registry = saved_reg
        _api_state.pipeline = saved_pipe
        _api_state.router = saved_router


# ---------------------------------------------------------------------------
# Model construction sanity (for completeness)
# ---------------------------------------------------------------------------


def test_routing_estimate_and_kb_info_construct():
    """RoutingEstimate and KBInfo build from primitive types."""
    est = RoutingEstimate(
        query="q", selected_kbs=["a"], confidence=0.5, reason="r"
    )
    assert est.confidence == 0.5

    info = KBInfo(
        name="x",
        kb_type="postgres",
        supports_embedding=True,
        supports_keyword_search=False,
    )
    assert info.supports_keyword_search is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
