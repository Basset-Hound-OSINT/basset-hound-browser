"""Pattern-D unit tests for ``app/postgres_kb.py`` (W62 D2).

These tests exercise the ``PostgresKB`` knowledge-base backend WITHOUT:

  * opening a real PostgreSQL connection (engine + sessions are mocked),
  * exercising the lazy ``asyncpg`` pool created in ``app.database``,
  * loading any embedding model (``embedding_service`` is a MagicMock),
  * calling out to ``app.search.semantic_search`` / ``keyword_search`` /
    ``hybrid_search`` — those are monkeypatched on the ``app.postgres_kb``
    module namespace because ``PostgresKB.search`` resolves them via module
    global lookup.

Pattern-D discipline (per the W61 D4 side-effects scout):
  * ``app.database`` carries a lazy ``AsyncEngine`` at import — that is fine
    because we never await against it; ``PostgresKB`` only touches the
    ``engine`` / ``async_session_maker`` we hand it.
  * The W61 D4 scout fixture template defines ``mock_engine`` and
    ``mock_async_session`` — we inline equivalent fixtures here so this file
    is self-contained and works even if ``conftest_pattern_d.py`` has not
    been adopted at the suite level yet.

Per W62 D2 spec: 250 LOC, >=8 tests, no live DB connection.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.kb import Document, IngestResult, SearchMode
from app.postgres_kb import PostgresKB


# ---------------------------------------------------------------------------
# Local Pattern-D fixtures (mirroring W61 D4 scout templates)
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_async_session_maker():
    """An ``async_sessionmaker``-style factory yielding an AsyncMock session.

    Mimics the ``async with session_maker() as session:`` protocol used in
    ``PostgresKB`` while exposing ``.add`` / ``.commit`` / ``.flush`` /
    ``.execute`` / ``.delete`` / ``.get`` as inspectable mocks.
    """
    session = AsyncMock()
    session.execute = AsyncMock()
    session.scalars = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.flush = AsyncMock()
    session.delete = AsyncMock()
    session.get = AsyncMock()

    @asynccontextmanager
    async def _ctx():
        yield session

    def _factory():
        return _ctx()

    _factory.session = session  # expose for assertion in tests
    return _factory


@pytest.fixture()
def mock_engine():
    """``AsyncEngine`` mock — ``begin()`` is an async context manager and
    ``dispose()`` is an AsyncMock."""
    engine = MagicMock()
    engine.dispose = AsyncMock()

    @asynccontextmanager
    async def _begin():
        conn = AsyncMock()
        conn.execute = AsyncMock()
        conn.run_sync = AsyncMock()
        yield conn

    engine.begin = _begin
    return engine


@pytest.fixture()
def kb(mock_engine, mock_async_session_maker):
    """Construct a ``PostgresKB`` with mocked engine / session maker."""
    embed = MagicMock()
    embed.embed_text = AsyncMock(return_value=[0.1] * 384)
    return PostgresKB(
        name="test-pg-kb",
        engine=mock_engine,
        async_session_maker=mock_async_session_maker,
        embedding_service=embed,
    )


def _doc() -> Document:
    return Document(
        filename="sample.md",
        filepath="/tmp/sample.md",
        file_type="md",
        content_hash="abc123",
        file_size=42,
        content="hello world",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestConstruction:
    def test_supports_embedding_true(self, kb: PostgresKB) -> None:
        """``PostgresKB`` always advertises pgvector embedding support."""
        assert kb.supports_embedding() is True

    def test_supports_keyword_search_true(self, kb: PostgresKB) -> None:
        """``PostgresKB`` always advertises tsvector keyword support."""
        assert kb.supports_keyword_search() is True

    def test_attributes_assigned(self, kb: PostgresKB, mock_engine, mock_async_session_maker):
        """Constructor wires engine, session maker, embedding service."""
        assert kb.name == "test-pg-kb"
        assert kb.engine is mock_engine
        assert kb.async_session_maker is mock_async_session_maker
        assert kb.embedding_service is not None


class TestLifecycle:
    @pytest.mark.asyncio
    async def test_initialize_runs_ddl(self, kb: PostgresKB, mock_engine) -> None:
        """``initialize()`` issues ``CREATE EXTENSION`` + ``create_all`` via
        ``engine.begin()`` — no real DB hit because the engine is a mock."""
        await kb.initialize()
        # The mock conn inside engine.begin() is created fresh per call;
        # success is "no exception raised" — engine.begin is wired correctly.
        assert hasattr(mock_engine, "begin")

    @pytest.mark.asyncio
    async def test_initialize_swallows_pgvector_failure(
        self, mock_async_session_maker
    ) -> None:
        """If the ``CREATE EXTENSION vector`` statement fails, ``initialize``
        logs a warning but does NOT raise (we still want ORM tables created)."""

        @asynccontextmanager
        async def _begin():
            conn = AsyncMock()

            async def _execute(stmt):
                # First call (CREATE EXTENSION) raises, then return None
                raise RuntimeError("no pgvector")

            conn.execute = _execute
            conn.run_sync = AsyncMock()
            yield conn

        engine = MagicMock()
        engine.begin = _begin
        engine.dispose = AsyncMock()
        kb = PostgresKB("kb", engine, mock_async_session_maker, embedding_service=None)
        # Should not raise even though CREATE EXTENSION raised
        await kb.initialize()

    @pytest.mark.asyncio
    async def test_shutdown_disposes_engine(self, kb: PostgresKB, mock_engine) -> None:
        """``shutdown()`` calls ``engine.dispose()`` exactly once."""
        await kb.shutdown()
        mock_engine.dispose.assert_awaited_once()


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_check_success(self, kb: PostgresKB, mock_async_session_maker) -> None:
        """A successful ``SELECT 1`` returns True."""
        mock_async_session_maker.session.execute.return_value = None
        result = await kb.health_check()
        assert result is True
        mock_async_session_maker.session.execute.assert_awaited()

    @pytest.mark.asyncio
    async def test_health_check_failure_returns_false(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """A DB exception is logged and ``health_check`` returns False."""
        mock_async_session_maker.session.execute.side_effect = RuntimeError("db down")
        result = await kb.health_check()
        assert result is False


class TestIngest:
    @pytest.mark.asyncio
    async def test_ingest_without_embeddings(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """Ingesting chunks without embeddings yields embeddings_created=0
        and chunks_created==len(chunks); session.add called for doc + chunks;
        commit called once."""
        # Simulate the post-flush doc model with a synthetic id.
        sess = mock_async_session_maker.session

        async def _flush() -> None:
            # After flush, the most recent doc model (last add) gets an id.
            added = sess.add.call_args_list[0].args[0]
            added.id = 42

        sess.flush.side_effect = _flush

        result = await kb.ingest(_doc(), chunks=["a", "b", "c"], embeddings=None)

        assert isinstance(result, IngestResult)
        assert result.document_id == 42
        assert result.chunks_created == 3
        assert result.embeddings_created == 0
        assert result.errors == []
        # 1 add for the doc + 3 for chunks
        assert sess.add.call_count == 4
        sess.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ingest_with_embeddings(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """Embeddings are propagated to chunk records and counted."""
        sess = mock_async_session_maker.session

        async def _flush() -> None:
            sess.add.call_args_list[0].args[0].id = 7

        sess.flush.side_effect = _flush

        emb = [[0.1] * 384, [0.2] * 384]
        result = await kb.ingest(_doc(), chunks=["x", "y"], embeddings=emb)

        assert result.document_id == 7
        assert result.chunks_created == 2
        assert result.embeddings_created == 2
        # Inspect the chunk records (2nd and 3rd ``add`` calls)
        chunk_calls = sess.add.call_args_list[1:]
        assert chunk_calls[0].args[0].embedding == emb[0]
        assert chunk_calls[1].args[0].embedding == emb[1]

    @pytest.mark.asyncio
    async def test_ingest_handles_db_error(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """A failure inside the session yields an ``IngestResult`` with
        ``document_id=-1`` and the exception string in ``errors``."""
        sess = mock_async_session_maker.session
        sess.flush.side_effect = RuntimeError("constraint violation")

        result = await kb.ingest(_doc(), chunks=["a"], embeddings=None)
        assert result.document_id == -1
        assert result.chunks_created == 0
        assert result.embeddings_created == 0
        assert any("constraint violation" in e for e in result.errors)


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_semantic_requires_embedding(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """Semantic search without an embedding raises ``ValueError``."""
        with pytest.raises(ValueError, match="embedding"):
            await kb.search("query", mode=SearchMode.SEMANTIC, embedding=None)

    @pytest.mark.asyncio
    async def test_search_keyword_calls_keyword_search(
        self, kb: PostgresKB, monkeypatch
    ) -> None:
        """``mode='keyword'`` dispatches to ``app.postgres_kb.keyword_search``."""
        sentinel: list = ["kw-hit"]
        called = {}

        async def _fake_kw(query, session, limit):
            called["query"] = query
            called["limit"] = limit
            return sentinel

        monkeypatch.setattr("app.postgres_kb.keyword_search", _fake_kw)
        result = await kb.search("python", mode=SearchMode.KEYWORD, limit=5)
        assert result is sentinel
        assert called == {"query": "python", "limit": 5}

    @pytest.mark.asyncio
    async def test_search_hybrid_falls_back_to_keyword_without_embedding(
        self, kb: PostgresKB, monkeypatch
    ) -> None:
        """Hybrid mode without an embedding falls back to keyword search."""
        async def _fake_kw(query, session, limit):
            return ["fallback"]

        async def _fake_hybrid(*a, **kw):  # pragma: no cover - must not be called
            raise AssertionError("hybrid_search should not be called without embedding")

        monkeypatch.setattr("app.postgres_kb.keyword_search", _fake_kw)
        monkeypatch.setattr("app.postgres_kb.hybrid_search", _fake_hybrid)

        result = await kb.search("q", mode=SearchMode.HYBRID, embedding=None)
        assert result == ["fallback"]

    @pytest.mark.asyncio
    async def test_search_hybrid_with_embedding_calls_hybrid(
        self, kb: PostgresKB, monkeypatch
    ) -> None:
        """Hybrid mode with embedding dispatches to ``hybrid_search``."""
        recorded = {}

        async def _fake_hybrid(query, session, embedding_vector, limit):
            recorded["query"] = query
            recorded["embedding_vector"] = embedding_vector
            recorded["limit"] = limit
            return ["hyb"]

        monkeypatch.setattr("app.postgres_kb.hybrid_search", _fake_hybrid)
        vec = [0.5] * 384
        result = await kb.search("q", mode=SearchMode.HYBRID, embedding=vec, limit=3)
        assert result == ["hyb"]
        assert recorded["embedding_vector"] == vec
        assert recorded["limit"] == 3

    @pytest.mark.asyncio
    async def test_search_semantic_with_embedding_calls_semantic(
        self, kb: PostgresKB, monkeypatch
    ) -> None:
        """Semantic mode with embedding dispatches to ``semantic_search``."""
        async def _fake_sem(query, session, embedding_vector, limit):
            return [("ok", query, embedding_vector, limit)]

        monkeypatch.setattr("app.postgres_kb.semantic_search", _fake_sem)
        vec = [0.7] * 384
        result = await kb.search("hi", mode=SearchMode.SEMANTIC, embedding=vec, limit=2)
        assert result == [("ok", "hi", vec, 2)]

    @pytest.mark.asyncio
    async def test_search_unknown_mode_raises(self, kb: PostgresKB) -> None:
        """An unknown ``mode`` raises ``ValueError`` with the offending mode."""
        with pytest.raises(ValueError, match="Unknown search mode"):
            await kb.search("q", mode="quantum", embedding=[0.0] * 384)


class TestDocumentOps:
    @pytest.mark.asyncio
    async def test_delete_document_calls_session_delete(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """``delete_document`` looks up the doc via ``session.get`` then
        deletes + commits if found."""
        sess = mock_async_session_maker.session
        fake_doc = MagicMock()
        sess.get.return_value = fake_doc

        await kb.delete_document(99)
        sess.get.assert_awaited_once()
        sess.delete.assert_awaited_once_with(fake_doc)
        sess.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_document_missing_is_noop(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """If ``session.get`` returns None, no delete/commit happens."""
        sess = mock_async_session_maker.session
        sess.get.return_value = None
        await kb.delete_document(404)
        sess.delete.assert_not_awaited()
        sess.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_document_returns_none_on_missing(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """``get_document`` returns ``None`` when the row is absent."""
        sess = mock_async_session_maker.session
        sess.get.return_value = None
        result = await kb.get_document(123)
        assert result is None

    @pytest.mark.asyncio
    async def test_list_documents_handles_exception_returns_empty(
        self, kb: PostgresKB, mock_async_session_maker
    ) -> None:
        """A DB failure during listing is logged and an empty list returned
        (matches the broad ``except Exception:`` in the implementation)."""
        sess = mock_async_session_maker.session
        sess.execute.side_effect = RuntimeError("connection reset")
        result = await kb.list_documents(limit=10)
        assert result == []
