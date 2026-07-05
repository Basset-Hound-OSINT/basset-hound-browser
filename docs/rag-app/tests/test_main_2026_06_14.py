"""Pattern-D unit tests for ``app/main.py`` (W61 D5).

These tests exercise the FastAPI route handlers, dependency-injection wiring,
schema validators, and helper functions WITHOUT:

  * spinning up the real ``lifespan`` startup (no live PostgreSQL, no Redis,
    no Ollama, no filesystem watcher),
  * making any network calls (search/ingest/LLM are monkeypatched),
  * touching the on-disk database (sessions are replaced via
    ``app.dependency_overrides``).

Pattern-D discipline:
  * Module-import-time side effects (engine, async_session, init_db) are
    avoided because we never enter the ``with TestClient(app):`` context
    manager — TestClient only fires the lifespan when used as a context
    manager (Starlette behaviour). We instantiate it bare, then call
    ``client.get(...)`` / ``client.post(...)`` which dispatch through
    Starlette's router without firing startup.
  * Dependencies (``get_session``, ``get_embedding_service``,
    ``get_llm_client``, ``get_chat_session_manager``) are stubbed via
    ``app.dependency_overrides``.
  * Module-level free functions (``semantic_search``, ``keyword_search``,
    ``hybrid_search``, ``ingest_file``, ``ingest_directory``) are
    monkeypatched on the ``app.main`` module namespace because the route
    handlers resolve them via module global lookup.

Per W61 D5 spec: >=10 tests, no live DB / FastAPI startup.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app.main as main_mod
from app.main import (
    AskRequest,
    AskResponse,
    ChatRequest,
    DirectoryIngestRequest,
    MultiDirectoryIngestRequest,
    SearchMode,
    SearchRequest,
    SearchResultSchema,
    _doc_to_schema,
    app,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_doc(
    *,
    doc_id: int = 1,
    filename: str = "sample.md",
    filepath: str = "/tmp/sample.md",
    file_type: str = "md",
    file_size: int = 123,
    chunk_count: int = 3,
):
    """Build a duck-typed Document-shaped object for ``_doc_to_schema``."""
    ts = datetime(2026, 6, 14, 12, 0, 0, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=doc_id,
        filename=filename,
        filepath=filepath,
        file_type=file_type,
        file_size=file_size,
        chunk_count=chunk_count,
        created_at=ts,
        updated_at=ts,
    )


def _make_search_result(score: float = 0.91, chunk_id: int = 10):
    return SimpleNamespace(
        chunk_id=chunk_id,
        document_id=1,
        document_filename="sample.md",
        chunk_index=0,
        content="some helpful content",
        score=score,
    )


@pytest.fixture()
def patched_app(monkeypatch):
    """Wire up dependency overrides + monkeypatches so route handlers run
    without any live infra.

    Yields a SimpleNamespace with:
      * client      — bare TestClient (lifespan NOT triggered)
      * embed       — AsyncMock EmbeddingService
      * llm         — AsyncMock OllamaClient
      * chat_mgr    — MagicMock chat session manager
      * ws_mgr      — MagicMock WS connection manager
      * session     — AsyncMock AsyncSession-like object
    """
    embed = AsyncMock()
    embed.health_check = AsyncMock(return_value=True)
    embed.embed_text = AsyncMock(return_value=[0.1] * 384)

    llm = AsyncMock()
    llm.model = "test-model"
    llm.health_check = AsyncMock(return_value=True)
    llm.list_models = AsyncMock(return_value=["test-model", "other-model"])
    llm.ask_with_context = AsyncMock(
        return_value=SimpleNamespace(answer="42", model="test-model")
    )

    chat_mgr = MagicMock()
    ws_mgr = MagicMock()

    session = AsyncMock()

    async def _override_session():
        yield session

    main_mod.app.dependency_overrides[main_mod.get_session] = _override_session
    main_mod.app.dependency_overrides[main_mod.get_embedding_service] = lambda: embed
    main_mod.app.dependency_overrides[main_mod.get_llm_client] = lambda: llm
    main_mod.app.dependency_overrides[main_mod.get_chat_session_manager] = lambda: chat_mgr
    main_mod.app.dependency_overrides[main_mod.get_ws_connection_manager] = lambda: ws_mgr

    # Patch app.state for routes that read state directly (health_check,
    # get_watcher_status).
    fake_redis = AsyncMock()
    fake_redis.ping = AsyncMock(return_value=True)
    monkeypatch.setattr(main_mod.app.state, "redis", fake_redis, raising=False)
    monkeypatch.setattr(main_mod.app.state, "llm_client", llm, raising=False)
    # Deliberately don't set app.state.watcher so we can test the
    # not_initialized branch of get_watcher_status.

    client = TestClient(main_mod.app, raise_server_exceptions=True)

    yield SimpleNamespace(
        client=client,
        embed=embed,
        llm=llm,
        chat_mgr=chat_mgr,
        ws_mgr=ws_mgr,
        session=session,
        fake_redis=fake_redis,
    )

    # Cleanup
    main_mod.app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Pure-helper tests (no FastAPI involvement)
# ---------------------------------------------------------------------------


def test_doc_to_schema_roundtrips_iso_timestamps():
    """_doc_to_schema converts datetime fields to ISO 8601 strings."""
    doc = _make_doc(doc_id=7, filename="readme.md", chunk_count=42)
    schema = _doc_to_schema(doc)
    assert schema.id == 7
    assert schema.filename == "readme.md"
    assert schema.chunk_count == 42
    # ISO format produced
    assert schema.created_at.startswith("2026-06-14T12:00:00")
    assert schema.updated_at.startswith("2026-06-14T12:00:00")


def test_doc_to_schema_handles_missing_timestamps():
    """_doc_to_schema returns empty string when created_at/updated_at are falsy."""
    doc = _make_doc()
    doc.created_at = None
    doc.updated_at = None
    schema = _doc_to_schema(doc)
    assert schema.created_at == ""
    assert schema.updated_at == ""


def test_search_request_defaults_to_hybrid_mode():
    """SearchRequest default mode is hybrid and limit is 10."""
    req = SearchRequest(query="hi")
    assert req.mode == SearchMode.hybrid
    assert req.limit == 10


def test_search_request_rejects_limit_out_of_range():
    """SearchRequest validation: limit must be 1<=limit<=100."""
    with pytest.raises(Exception):
        SearchRequest(query="hi", limit=0)
    with pytest.raises(Exception):
        SearchRequest(query="hi", limit=101)


def test_ask_request_defaults_and_optional_system_prompt():
    """AskRequest carries optional system_prompt and a 1..20 limit."""
    req = AskRequest(question="why?")
    assert req.mode == SearchMode.hybrid
    assert req.limit == 5
    assert req.system_prompt is None
    req2 = AskRequest(question="why?", system_prompt="be brief", limit=20)
    assert req2.system_prompt == "be brief"
    assert req2.limit == 20


def test_search_mode_enum_values():
    """SearchMode enum exposes exactly three named values."""
    assert SearchMode.semantic == "semantic"
    assert SearchMode.keyword == "keyword"
    assert SearchMode.hybrid == "hybrid"
    assert {m.value for m in SearchMode} == {"semantic", "keyword", "hybrid"}


def test_directory_ingest_request_schema():
    """DirectoryIngestRequest accepts a path string."""
    req = DirectoryIngestRequest(path="/some/dir")
    assert req.path == "/some/dir"


def test_multi_directory_ingest_request_schema():
    """MultiDirectoryIngestRequest accepts a list of path strings."""
    req = MultiDirectoryIngestRequest(paths=["/a", "/b"])
    assert req.paths == ["/a", "/b"]


def test_chat_request_defaults():
    """ChatRequest defaults: use_rag=True, mode=hybrid."""
    req = ChatRequest(message="hi")
    assert req.message == "hi"
    assert req.use_rag is True
    assert req.mode == SearchMode.hybrid


def test_ask_response_carries_sources():
    """AskResponse holds a list of SearchResultSchema sources."""
    src = SearchResultSchema(
        chunk_id=1,
        document_id=2,
        document_filename="f.md",
        chunk_index=0,
        content="x",
        score=0.5,
    )
    resp = AskResponse(answer="hello", model="m", sources=[src])
    assert resp.answer == "hello"
    assert resp.sources[0].chunk_id == 1


# ---------------------------------------------------------------------------
# 2. Route tests via TestClient + dependency_overrides
# ---------------------------------------------------------------------------


def test_health_endpoint_returns_healthy_when_all_up(patched_app, monkeypatch):
    """/api/health returns 'healthy' when every probe returns True."""
    # DB probe: session.execute(...) returns successfully
    patched_app.session.execute = AsyncMock(return_value=MagicMock())

    resp = patched_app.client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["database"] is True
    assert body["redis"] is True
    assert body["embedding_service"] is True
    assert body["llm"] is True


def test_health_endpoint_returns_degraded_when_redis_fails(patched_app, monkeypatch):
    """/api/health reports degraded when redis ping raises."""
    patched_app.session.execute = AsyncMock(return_value=MagicMock())
    # Make redis ping blow up
    patched_app.fake_redis.ping = AsyncMock(side_effect=RuntimeError("conn refused"))

    resp = patched_app.client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["redis"] is False
    # Others still up
    assert body["database"] is True


def test_list_documents_returns_doc_schemas(patched_app, monkeypatch):
    """/api/documents iterates session.execute results and serialises them."""
    docs = [_make_doc(doc_id=1, filename="a.md"), _make_doc(doc_id=2, filename="b.md")]

    fake_scalars = MagicMock()
    fake_scalars.all = MagicMock(return_value=docs)
    fake_result = MagicMock()
    fake_result.scalars = MagicMock(return_value=fake_scalars)

    patched_app.session.execute = AsyncMock(return_value=fake_result)

    resp = patched_app.client.get("/api/documents")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["filename"] == "a.md"
    assert body[1]["filename"] == "b.md"


def test_get_document_404_when_missing(patched_app):
    """/api/documents/{id} returns 404 when session.get yields None."""
    patched_app.session.get = AsyncMock(return_value=None)

    resp = patched_app.client.get("/api/documents/9999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Document not found"


def test_get_document_200_when_present(patched_app):
    """/api/documents/{id} returns the document schema on hit."""
    doc = _make_doc(doc_id=5, filename="found.md", chunk_count=7)
    patched_app.session.get = AsyncMock(return_value=doc)

    resp = patched_app.client.get("/api/documents/5")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == 5
    assert body["filename"] == "found.md"
    assert body["chunk_count"] == 7


def test_delete_document_404_when_missing(patched_app):
    """/api/documents/{id} DELETE returns 404 when not found."""
    patched_app.session.get = AsyncMock(return_value=None)

    resp = patched_app.client.delete("/api/documents/1234")
    assert resp.status_code == 404


def test_delete_document_204_when_present(patched_app):
    """/api/documents/{id} DELETE returns 204 and commits when found."""
    doc = _make_doc(doc_id=42)
    patched_app.session.get = AsyncMock(return_value=doc)
    patched_app.session.delete = AsyncMock()
    patched_app.session.commit = AsyncMock()

    resp = patched_app.client.delete("/api/documents/42")
    assert resp.status_code == 204
    patched_app.session.delete.assert_awaited_once_with(doc)
    patched_app.session.commit.assert_awaited_once()


def test_search_route_dispatches_to_hybrid_search_by_default(patched_app, monkeypatch):
    """/api/search default-mode invokes hybrid_search and returns rows."""
    captured = {}

    async def fake_hybrid(query, session, embed, limit):
        captured["called"] = ("hybrid", query, limit)
        return [_make_search_result(score=0.8, chunk_id=99)]

    monkeypatch.setattr(main_mod, "hybrid_search", fake_hybrid)

    resp = patched_app.client.post("/api/search", json={"query": "what is rag"})
    assert resp.status_code == 200
    body = resp.json()
    assert captured["called"] == ("hybrid", "what is rag", 10)
    assert len(body) == 1
    assert body[0]["chunk_id"] == 99
    assert body[0]["score"] == 0.8


def test_search_route_dispatches_to_semantic_when_mode_semantic(patched_app, monkeypatch):
    """/api/search with mode=semantic dispatches semantic_search."""
    captured = {}

    async def fake_semantic(query, session, embed, limit):
        captured["called"] = ("semantic", query, limit)
        return []

    async def boom(*a, **kw):
        raise AssertionError("should not be called")

    monkeypatch.setattr(main_mod, "semantic_search", fake_semantic)
    monkeypatch.setattr(main_mod, "keyword_search", boom)
    monkeypatch.setattr(main_mod, "hybrid_search", boom)

    resp = patched_app.client.post(
        "/api/search",
        json={"query": "vector", "mode": "semantic", "limit": 3},
    )
    assert resp.status_code == 200
    assert resp.json() == []
    assert captured["called"] == ("semantic", "vector", 3)


def test_search_route_dispatches_to_keyword_when_mode_keyword(patched_app, monkeypatch):
    """/api/search with mode=keyword dispatches keyword_search."""
    captured = {}

    async def fake_keyword(query, session, limit):
        captured["called"] = ("keyword", query, limit)
        return [_make_search_result(score=0.42)]

    monkeypatch.setattr(main_mod, "keyword_search", fake_keyword)

    resp = patched_app.client.post(
        "/api/search",
        json={"query": "needle", "mode": "keyword", "limit": 5},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert captured["called"] == ("keyword", "needle", 5)
    assert body[0]["score"] == 0.42


def test_ask_returns_no_documents_message_when_search_empty(patched_app, monkeypatch):
    """/api/ask returns a graceful 'no documents found' answer when search empty."""

    async def empty_hybrid(*args, **kwargs):
        return []

    monkeypatch.setattr(main_mod, "hybrid_search", empty_hybrid)

    resp = patched_app.client.post("/api/ask", json={"question": "why?"})
    assert resp.status_code == 200
    body = resp.json()
    assert "No relevant documents" in body["answer"]
    assert body["model"] == "test-model"
    assert body["sources"] == []
    # The LLM should NOT have been called when search returned nothing
    patched_app.llm.ask_with_context.assert_not_awaited()


def test_ask_calls_llm_with_context_chunks_when_results_present(patched_app, monkeypatch):
    """/api/ask formats results and dispatches to llm.ask_with_context."""

    async def fake_hybrid(*args, **kwargs):
        return [
            _make_search_result(score=0.9, chunk_id=11),
            _make_search_result(score=0.7, chunk_id=12),
        ]

    monkeypatch.setattr(main_mod, "hybrid_search", fake_hybrid)

    resp = patched_app.client.post(
        "/api/ask",
        json={"question": "what is rag?", "system_prompt": "be terse"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == "42"
    assert body["model"] == "test-model"
    assert len(body["sources"]) == 2

    # Verify LLM was called with the expected payload shape
    patched_app.llm.ask_with_context.assert_awaited_once()
    kwargs = patched_app.llm.ask_with_context.await_args.kwargs
    assert kwargs["question"] == "what is rag?"
    assert kwargs["system_prompt"] == "be terse"
    assert len(kwargs["context_chunks"]) == 2
    assert kwargs["context_chunks"][0]["score"] == 0.9


def test_ingest_directory_400_when_path_not_found(patched_app):
    """/api/ingest/directory returns 400 when the directory does not exist.

    The async endpoint validates the path synchronously (before queueing a
    job), so no ingest monkeypatch is needed — the handler never reaches
    ingest_directory.
    """
    resp = patched_app.client.post(
        "/api/ingest/directory", json={"path": "/missing/path"}
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert "Directory not found" in detail
    assert "/missing/path" in detail


def test_ingest_directory_202_returns_pollable_job(patched_app, monkeypatch, tmp_path):
    """/api/ingest/directory returns 202 + IngestJobSchema, pollable via status_url."""
    docs = [_make_doc(doc_id=1, filename="doc1.md"), _make_doc(doc_id=2, filename="doc2.md")]

    async def fake_ingest(path, session, embed, extensions=None, exclude=None):
        return docs

    monkeypatch.setattr(main_mod, "ingest_directory", fake_ingest)
    # Keep the background job hermetic: no live DB session, meta write, or git probe.
    monkeypatch.setattr(main_mod, "upsert_meta", AsyncMock())
    monkeypatch.setattr(main_mod, "_git_head_sha", AsyncMock(return_value=None))

    @asynccontextmanager
    async def fake_session_ctx():
        yield AsyncMock()

    monkeypatch.setattr(main_mod, "async_session", fake_session_ctx)
    # Ingest-root guard only activates when DOCS_PATH is set — keep it out of scope.
    monkeypatch.delenv("DOCS_PATH", raising=False)

    resp = patched_app.client.post(
        "/api/ingest/directory", json={"path": str(tmp_path)}
    )
    assert resp.status_code == 202
    body = resp.json()
    job_id = body["job_id"]
    assert job_id
    # The response is a snapshot taken before the background task runs.
    assert body["status"] == "queued"
    assert body["path"] == str(tmp_path)
    assert body["created_at"]
    assert body["status_url"] == f"/api/ingest/status/{job_id}"

    # Follow-up poll: the job is retrievable at its advertised status URL.
    poll = patched_app.client.get(body["status_url"])
    assert poll.status_code == 200
    polled = poll.json()
    assert polled["job_id"] == job_id
    assert polled["path"] == str(tmp_path)
    # Bare TestClient (no lifespan CM) gives no scheduling guarantee for the
    # background task, so only assert the status is a legal job state.
    assert polled["status"] in {"queued", "running", "completed", "failed"}

    # Drop the job from the module-level store so tests stay independent.
    main_mod._INGEST_JOBS.pop(job_id, None)


def test_ingest_directories_400_when_any_path_missing(patched_app, monkeypatch):
    """/api/ingest/directories returns 400 with the specific path that failed."""
    call_count = {"n": 0}

    async def maybe_fail(path, session, embed):
        call_count["n"] += 1
        if path == "/bad":
            raise FileNotFoundError("nope")
        return []

    monkeypatch.setattr(main_mod, "ingest_directory", maybe_fail)

    resp = patched_app.client.post(
        "/api/ingest/directories",
        json={"paths": ["/good", "/bad", "/other"]},
    )
    assert resp.status_code == 400
    assert "/bad" in resp.json()["detail"]
    # Should bail after the failing path (no /other call)
    assert call_count["n"] == 2


def test_list_models_returns_llm_models_and_current(patched_app):
    """/api/models returns the LLM client's list_models output plus current."""
    resp = patched_app.client.get("/api/models")
    assert resp.status_code == 200
    body = resp.json()
    assert body["models"] == ["test-model", "other-model"]
    assert body["current"] == "test-model"


def test_watcher_status_returns_not_initialized_when_state_unset(patched_app):
    """/api/watcher/status reports not_initialized when app.state.watcher is missing."""
    # patched_app fixture intentionally does NOT set app.state.watcher
    resp = patched_app.client.get("/api/watcher/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "not_initialized"


def test_watcher_status_reports_running_when_watcher_present(patched_app, monkeypatch):
    """/api/watcher/status reports running + stats when watcher attached."""
    fake_watcher = MagicMock()
    fake_watcher.get_stats = MagicMock(
        return_value={"running": True, "files_processed": 17}
    )
    monkeypatch.setattr(main_mod.app.state, "watcher", fake_watcher, raising=False)

    resp = patched_app.client.get("/api/watcher/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "running"
    assert body["files_processed"] == 17


def test_search_route_rejects_invalid_mode_via_pydantic(patched_app):
    """/api/search rejects unknown mode strings with 422 from Pydantic."""
    resp = patched_app.client.post(
        "/api/search",
        json={"query": "x", "mode": "bogus-mode"},
    )
    assert resp.status_code == 422
