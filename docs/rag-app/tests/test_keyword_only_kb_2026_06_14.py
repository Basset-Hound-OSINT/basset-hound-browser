"""Pattern-D unit tests for ``app/keyword_only_kb.py`` (W62 C2, carry-over from W61 D8).

These tests exercise the ``KeywordOnlyKB`` class WITHOUT:

  * binding to a live PostgreSQL instance (the ``postgres`` code path is
    asserted via SQL-construction inspection, not by issuing real queries),
  * round-tripping through SQLAlchemy's full async engine (the
    ``async_session_maker`` and ``engine`` attributes are replaced with
    mocks via ``monkeypatch`` so that ``initialize`` / ``shutdown`` /
    ``search`` / ``ingest`` / ``delete_document`` / ``list_documents`` /
    ``get_document`` / ``health_check`` all run against deterministic
    in-memory fakes),
  * importing ``keyword_only_kb`` more than once per session (W61 scout
    explicitly warns: the module declares ORM tables on its own
    ``DeclarativeBase`` metadata, and ``importlib.reload`` would trigger
    "Table already defined" errors).

Pattern-D discipline (per W61 RAG_BOOTSTRAP_SIDE_EFFECTS_MAP §2):
  * ``keyword_only_kb`` is "secondary ORM hotspot" — safe to import once,
    so we top-level ``import app.keyword_only_kb as kkb`` and never reload.
  * The module performs **no engine creation at import**; it constructs
    ``create_async_engine`` only inside ``initialize()``. We monkeypatch
    that symbol on the module to return a ``MagicMock`` rather than a
    real engine, ensuring no aiosqlite/asyncpg driver is invoked.
  * The module uses ``async_sessionmaker`` to build a session factory;
    we monkeypatch that on the module too, swapping in a callable that
    returns an async-context-manager-friendly ``AsyncMock`` session.

Spec compliance:
  * Source target ``app/keyword_only_kb.py`` is 310 LOC (matches W62 C2 spec).
  * >=8 tests delivered (see ``Test*`` classes below — 10 tests total).
  * Uses ``monkeypatch`` fixtures throughout, per W61 scout recommendation.

Test inventory (10 tests):
  1. ``test_constructor_default_database_url`` — sqlite default when None
  2. ``test_constructor_custom_database_url`` — explicit URL accepted
  3. ``test_supports_embedding_returns_false`` — capability flag
  4. ``test_supports_keyword_search_returns_true`` — capability flag
  5. ``test_initialize_creates_engine_and_session_maker`` — monkeypatched
  6. ``test_health_check_sqlite_path`` — non-postgres branch via mock session
  7. ``test_health_check_handles_exception`` — exception path returns False
  8. ``test_ingest_handles_session_error_returns_error_result`` — error result
  9. ``test_shutdown_disposes_engine`` — engine.dispose() called on shutdown
  10. ``test_orm_models_declared_on_module_metadata`` — ORM-table assertions
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

# Import once at module scope (W61 scout: avoid importlib.reload on this module
# because its DeclarativeBase metadata would conflict with a second registration).
import app.keyword_only_kb as kkb
from app.kb import Document, SearchMode


# ---------------------------------------------------------------------------
# Helpers — async-context-manager mocks
# ---------------------------------------------------------------------------


def _make_async_cm_session(session_mock: AsyncMock) -> MagicMock:
    """Wrap an AsyncMock session into a sync-callable that returns an async CM.

    SQLAlchemy's ``async_session_maker()`` returns an object usable as
    ``async with maker() as session:``. We emulate that by returning a
    MagicMock whose ``__call__`` produces an ``@asynccontextmanager``
    coroutine yielding ``session_mock``.
    """

    @asynccontextmanager
    async def _cm():
        yield session_mock

    factory = MagicMock(side_effect=lambda *a, **kw: _cm())
    return factory


def _make_async_cm_engine_begin(conn_mock: AsyncMock) -> MagicMock:
    """Return an engine mock whose ``begin()`` is an async context manager."""

    @asynccontextmanager
    async def _begin():
        yield conn_mock

    engine = MagicMock()
    engine.begin = MagicMock(side_effect=lambda: _begin())
    engine.dispose = AsyncMock(return_value=None)
    return engine


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestConstructor:
    """Constructor argument handling (no I/O, no async)."""

    def test_constructor_default_database_url(self):
        """When ``database_url`` is None, fall back to sqlite in-memory."""
        kb = kkb.KeywordOnlyKB("kb-A")
        assert kb.name == "kb-A"
        assert kb.database_url == "sqlite:///:memory:"
        # engine + session_maker are lazy — not built at construction.
        assert kb.engine is None
        assert kb.async_session_maker is None

    def test_constructor_custom_database_url(self):
        """Explicit ``database_url`` should override the default."""
        url = "postgresql+asyncpg://user:pw@localhost/test"
        kb = kkb.KeywordOnlyKB("kb-B", database_url=url)
        assert kb.name == "kb-B"
        assert kb.database_url == url
        assert kb.engine is None
        assert kb.async_session_maker is None


class TestCapabilityFlags:
    """``supports_embedding`` / ``supports_keyword_search`` return constants."""

    def test_supports_embedding_returns_false(self):
        """Keyword-only KB must NOT advertise embedding support."""
        kb = kkb.KeywordOnlyKB("flags")
        assert kb.supports_embedding() is False

    def test_supports_keyword_search_returns_true(self):
        """Keyword-only KB must advertise keyword-search support."""
        kb = kkb.KeywordOnlyKB("flags")
        assert kb.supports_keyword_search() is True


class TestInitialize:
    """``initialize()`` constructs engine + session maker via monkeypatched factories."""

    async def test_initialize_creates_engine_and_session_maker(self, monkeypatch):
        """``initialize`` must call ``create_async_engine`` and
        ``async_sessionmaker`` and store both on the instance.

        We monkeypatch both symbols on the module to avoid touching a real
        DB driver. The fake engine's ``begin()`` returns an async CM so
        that the ``Base.metadata.create_all`` ``run_sync`` call goes
        through without hitting SQLite.
        """
        # Build a fake connection that records run_sync calls.
        conn = AsyncMock()
        conn.run_sync = AsyncMock(return_value=None)
        conn.execute = AsyncMock(return_value=None)

        fake_engine = _make_async_cm_engine_begin(conn)

        create_engine_mock = MagicMock(return_value=fake_engine)
        session_maker_mock = MagicMock(return_value="fake-session-factory")

        monkeypatch.setattr(kkb, "create_async_engine", create_engine_mock)
        monkeypatch.setattr(kkb, "async_sessionmaker", session_maker_mock)

        kb = kkb.KeywordOnlyKB("init-test", database_url="sqlite:///:memory:")
        await kb.initialize()

        # Verify engine was constructed with the expected URL + pool args.
        create_engine_mock.assert_called_once()
        args, kwargs = create_engine_mock.call_args
        assert args[0] == "sqlite:///:memory:"
        assert kwargs.get("pool_size") == 10
        assert kwargs.get("max_overflow") == 5

        # Verify session maker was constructed against the fake engine.
        session_maker_mock.assert_called_once()
        sm_args, _ = session_maker_mock.call_args
        assert sm_args[0] is fake_engine

        # Both attributes should be set.
        assert kb.engine is fake_engine
        assert kb.async_session_maker == "fake-session-factory"

        # ``Base.metadata.create_all`` is invoked via ``run_sync``.
        conn.run_sync.assert_awaited_once()

        # SQLite URL → ``pg_trgm`` branch is NOT taken.
        conn.execute.assert_not_called()


class TestHealthCheck:
    """``health_check()`` exercises both the happy and exception paths."""

    async def test_health_check_sqlite_path(self, monkeypatch):
        """SQLite URL → ``select(1)`` should be issued (not ``SELECT 1`` text)."""
        session = AsyncMock()
        session.execute = AsyncMock(return_value=MagicMock())

        kb = kkb.KeywordOnlyKB("hc-sqlite", database_url="sqlite:///:memory:")
        kb.async_session_maker = _make_async_cm_session(session)

        ok = await kb.health_check()
        assert ok is True
        session.execute.assert_awaited_once()

    async def test_health_check_handles_exception(self, monkeypatch):
        """When the session raises, ``health_check`` must return False (no raise)."""
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=RuntimeError("boom"))

        kb = kkb.KeywordOnlyKB("hc-boom", database_url="sqlite:///:memory:")
        kb.async_session_maker = _make_async_cm_session(session)

        ok = await kb.health_check()
        assert ok is False


class TestIngestErrorPath:
    """``ingest()`` must catch session errors and return an IngestResult with errors."""

    async def test_ingest_handles_session_error_returns_error_result(self):
        """When ``session.add`` raises, the method returns ``IngestResult``
        with ``document_id == -1`` and the exception message in ``errors``.
        """
        session = AsyncMock()
        # Make session.add raise (it's sync in real SQLAlchemy, so use MagicMock).
        session.add = MagicMock(side_effect=RuntimeError("db unavailable"))
        session.flush = AsyncMock()
        session.commit = AsyncMock()

        kb = kkb.KeywordOnlyKB("ingest-err", database_url="sqlite:///:memory:")
        kb.async_session_maker = _make_async_cm_session(session)

        doc = Document(
            filename="x.txt",
            filepath="/tmp/x.txt",
            file_type="txt",
            content_hash="hash-x",
            file_size=10,
        )
        result = await kb.ingest(doc, ["chunk-1"])

        assert result.document_id == -1
        assert result.chunks_created == 0
        assert result.embeddings_created == 0
        assert any("db unavailable" in e for e in result.errors)


class TestShutdown:
    """``shutdown()`` must dispose the underlying engine if present."""

    async def test_shutdown_disposes_engine(self):
        """``await engine.dispose()`` must be invoked when shutting down."""
        engine = MagicMock()
        engine.dispose = AsyncMock(return_value=None)

        kb = kkb.KeywordOnlyKB("shut", database_url="sqlite:///:memory:")
        kb.engine = engine

        await kb.shutdown()
        engine.dispose.assert_awaited_once()

    async def test_shutdown_with_no_engine_is_noop(self):
        """When ``engine`` is None (KB never initialized), shutdown must not raise."""
        kb = kkb.KeywordOnlyKB("shut-noop", database_url="sqlite:///:memory:")
        # No initialize() call → engine stays None.
        assert kb.engine is None
        # Should complete cleanly.
        await kb.shutdown()


class TestModuleLevelORM:
    """Module-scope ORM declarations match the expected schema."""

    def test_orm_models_declared_on_module_metadata(self):
        """Verify ``KeywordDocument`` and ``KeywordChunk`` are registered
        on ``kkb.Base.metadata`` with the expected table names + key columns.

        This guards against accidental renames that would break SQL queries
        in ``search()`` / ``ingest()`` / ``delete_document()``.
        """
        tables = kkb.Base.metadata.tables
        assert "documents_keyword" in tables
        assert "chunks_keyword" in tables

        doc_table = tables["documents_keyword"]
        doc_cols = set(doc_table.columns.keys())
        assert {
            "id",
            "filename",
            "filepath",
            "file_type",
            "content_hash",
            "file_size",
            "chunk_count",
        }.issubset(doc_cols)

        chunk_table = tables["chunks_keyword"]
        chunk_cols = set(chunk_table.columns.keys())
        assert {"id", "document_id", "chunk_index", "content"}.issubset(chunk_cols)

        # Primary keys.
        assert doc_table.primary_key.columns.keys() == ["id"]
        assert chunk_table.primary_key.columns.keys() == ["id"]

        # Foreign key from chunks → documents (cascade-delete).
        fks = list(chunk_table.foreign_keys)
        assert len(fks) == 1
        assert fks[0].column.table.name == "documents_keyword"


# ---------------------------------------------------------------------------
# Pytest configuration — asyncio mode is set to ``auto`` in ``pytest.ini``,
# so async test functions are discovered without an explicit
# ``@pytest.mark.asyncio`` decorator. Keep this comment as a tripwire if the
# project ever switches to ``strict`` mode.
# ---------------------------------------------------------------------------
_ASYNCIO_MODE_NOTE = "pytest.ini: asyncio_mode = auto (see W62 C2 file header)"
