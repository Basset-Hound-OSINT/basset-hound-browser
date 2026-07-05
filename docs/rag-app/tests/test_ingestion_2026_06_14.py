"""Pattern-D tests for ``app/ingestion.py`` (W63 D1).

Module under test (213 LOC) exposes:

* File handlers — ``PDFHandler``, ``MarkdownHandler``, ``TextHandler``,
  ``JSONHandler``, ``YAMLHandler``.
* ``HandlerRegistry`` (class-level registry mapping suffixes to handlers).
* ``chunk_text`` — sentence-boundary token-aware chunker.
* ``ingest_file`` / ``ingest_directory`` — async pipeline coroutines.

Pattern-D discipline:

* **No live PostgreSQL / pgvector / Redis / network**.
* The ``AsyncSession`` is replaced with a ``MagicMock`` carrying
  ``AsyncMock`` attributes for ``flush``, ``commit``, ``refresh``.
* ``EmbeddingService`` is replaced by the ``mock_embedding_service``
  fixture from ``conftest.py``.
* The ``PDFHandler`` is only smoke-checked structurally (PyMuPDF import
  not exercised) — extraction is covered for ``md / txt / json / yaml``
  via the ``tmp_files`` fixture, which uses real files on ``tmp_path``.

Per W63 D1 spec: >=8 tests, >=1 happy-path + >=1 error-path per public
method, no live DB connections.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.ingestion import (
    HandlerRegistry,
    JSONHandler,
    MarkdownHandler,
    PDFHandler,
    TextHandler,
    YAMLHandler,
    chunk_text,
    ingest_directory,
    ingest_file,
)


# ---------------------------------------------------------------------------
# Helpers / fakes
# ---------------------------------------------------------------------------


def _make_fake_session() -> MagicMock:
    """Minimal ``AsyncSession`` double — only the methods ingestion uses."""
    session = MagicMock()
    session.add = MagicMock()

    # ``flush`` must assign an id to the most recently added Document so that
    # the subsequent ``Chunk(document_id=doc.id, ...)`` is non-None.  The
    # production code calls ``session.flush()`` once per ``ingest_file``;
    # we set ``doc.id`` via a side_effect that walks the ``add`` calls.
    added: list = []

    def _track_add(obj):
        added.append(obj)

    session.add = MagicMock(side_effect=_track_add)

    async def _flush():
        # First added object is the Document — assign a fake primary key
        if added and getattr(added[0], "id", None) is None:
            added[0].id = 1

    session.flush = AsyncMock(side_effect=_flush)
    session.commit = AsyncMock(return_value=None)
    session.refresh = AsyncMock(return_value=None)
    session._added = added  # for test introspection
    return session


# ---------------------------------------------------------------------------
# HandlerRegistry — happy + error paths
# ---------------------------------------------------------------------------


def test_handler_registry_known_extensions_resolve():
    """Each registered suffix maps to an instance with ``extract_text``."""
    for ext in (".md", ".txt", ".log", ".json", ".yaml", ".yml", ".pdf"):
        handler = HandlerRegistry.get(ext)
        assert handler is not None, ext
        assert hasattr(handler, "extract_text")


def test_handler_registry_unknown_extension_returns_none():
    """Unknown extensions return ``None`` (error path for lookup)."""
    assert HandlerRegistry.get(".xyz") is None
    assert HandlerRegistry.get(".doc") is None
    assert HandlerRegistry.get("") is None


def test_handler_registry_case_insensitive():
    """``HandlerRegistry.get`` lowercases its input."""
    assert HandlerRegistry.get(".MD") is HandlerRegistry.get(".md")
    assert HandlerRegistry.get(".JSON") is HandlerRegistry.get(".json")


def test_handler_registry_supported_extensions_is_set():
    """``supported_extensions`` returns a *set* with the expected keys."""
    exts = HandlerRegistry.supported_extensions()
    assert isinstance(exts, set)
    assert {".md", ".txt", ".log", ".json", ".yaml", ".yml", ".pdf"} <= exts


# ---------------------------------------------------------------------------
# Individual handlers — happy + error paths
# ---------------------------------------------------------------------------


def test_markdown_handler_reads_file(tmp_path: Path):
    p = tmp_path / "x.md"
    p.write_text("# heading\n\nbody", encoding="utf-8")
    assert MarkdownHandler().extract_text(p) == "# heading\n\nbody"


def test_text_handler_reads_file(tmp_path: Path):
    p = tmp_path / "x.txt"
    p.write_text("plain", encoding="utf-8")
    assert TextHandler().extract_text(p) == "plain"


def test_text_handler_missing_file_raises(tmp_path: Path):
    p = tmp_path / "nope.txt"
    with pytest.raises(FileNotFoundError):
        TextHandler().extract_text(p)


def test_json_handler_round_trips(tmp_path: Path):
    p = tmp_path / "x.json"
    p.write_text('{"a": 1, "b": [2, 3]}', encoding="utf-8")
    out = JSONHandler().extract_text(p)
    # Pretty-printed JSON
    assert '"a": 1' in out
    assert '"b"' in out


def test_json_handler_invalid_raises(tmp_path: Path):
    p = tmp_path / "x.json"
    p.write_text("{not json", encoding="utf-8")
    with pytest.raises(ValueError):
        JSONHandler().extract_text(p)


def test_yaml_handler_round_trips(tmp_path: Path):
    p = tmp_path / "x.yaml"
    p.write_text("k: 1\nlist:\n  - a\n  - b\n", encoding="utf-8")
    out = YAMLHandler().extract_text(p)
    assert "k: 1" in out
    assert "- a" in out


def test_yaml_handler_invalid_raises(tmp_path: Path):
    import yaml as _yaml

    p = tmp_path / "x.yaml"
    # Tab-indented YAML inside a flow-block produces a ScannerError
    p.write_text("k: [\n\t- a\n]", encoding="utf-8")
    with pytest.raises(_yaml.YAMLError):
        YAMLHandler().extract_text(p)


def test_pdf_handler_is_protocol_compliant():
    """``PDFHandler`` must expose ``extract_text`` without importing fitz.

    We don't drive the actual PyMuPDF extraction (heavy dep), but the
    class must instantiate and satisfy the ``FileHandler`` protocol.
    """
    h = PDFHandler()
    assert callable(getattr(h, "extract_text", None))


# ---------------------------------------------------------------------------
# chunk_text — happy + error/edge paths
# ---------------------------------------------------------------------------


def test_chunk_text_short_input_single_chunk():
    out = chunk_text("Short sentence.", chunk_size=100, chunk_overlap=10)
    assert out == ["Short sentence."]


def test_chunk_text_splits_on_sentence_boundary():
    text = "One two three. Four five six. Seven eight nine."
    out = chunk_text(text, chunk_size=4, chunk_overlap=1)
    # Should produce >1 chunk because total token count > chunk_size
    assert len(out) >= 2
    # No chunk should be empty
    assert all(c.strip() for c in out)


def test_chunk_text_overlap_carries_tokens():
    text = "alpha beta. gamma delta. epsilon zeta."
    out = chunk_text(text, chunk_size=3, chunk_overlap=1)
    # With chunk_size=3 every sentence (2 tokens) bundles then flushes.
    # Verify all original tokens are present in concatenation.
    flat = " ".join(out)
    for tok in ("alpha", "beta", "gamma", "delta", "epsilon", "zeta"):
        assert tok in flat


def test_chunk_text_empty_input_returns_empty():
    assert chunk_text("", chunk_size=10, chunk_overlap=2) == []
    assert chunk_text("   ", chunk_size=10, chunk_overlap=2) == []


def test_chunk_text_no_sentence_terminator_returns_whole_text():
    text = "a b c d e f g h i j"
    out = chunk_text(text, chunk_size=100, chunk_overlap=5)
    assert out == [text]


# ---------------------------------------------------------------------------
# ingest_file — happy + error paths
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ingest_file_happy_path_markdown(
    tmp_files: dict[str, Path], mock_embedding_service
):
    """Happy path: a .md file goes through extract -> chunk -> embed -> store."""
    session = _make_fake_session()
    doc = await ingest_file(tmp_files["md"], session, mock_embedding_service)

    # Document captured
    assert doc.filename == "sample.md"
    assert doc.file_type == "md"
    assert doc.chunk_count >= 1
    assert doc.content_hash  # sha256 hex
    assert len(doc.content_hash) == 64

    # Embedding service was called exactly once with the chunk list
    assert mock_embedding_service.embed_batch.await_count == 1
    (called_chunks,), _ = mock_embedding_service.embed_batch.call_args
    assert isinstance(called_chunks, list)
    assert len(called_chunks) == doc.chunk_count

    # Session lifecycle: add(doc) + add(chunks...), then flush+commit+refresh
    assert session.flush.await_count == 1
    assert session.commit.await_count == 1
    assert session.refresh.await_count == 1
    # One Document + N Chunks were added
    assert session.add.call_count == 1 + doc.chunk_count


@pytest.mark.asyncio
async def test_ingest_file_unknown_extension_raises(
    tmp_path: Path, mock_embedding_service
):
    """Error path: unsupported suffix -> ValueError (no DB calls)."""
    p = tmp_path / "weird.xyz"
    p.write_text("anything", encoding="utf-8")
    session = _make_fake_session()
    with pytest.raises(ValueError, match="Unsupported file type"):
        await ingest_file(p, session, mock_embedding_service)
    # Nothing should have been added / committed
    session.add.assert_not_called()
    mock_embedding_service.embed_batch.assert_not_awaited()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_ingest_file_missing_file_raises(
    tmp_path: Path, mock_embedding_service
):
    """Error path: missing filepath -> FileNotFoundError."""
    session = _make_fake_session()
    with pytest.raises(FileNotFoundError):
        await ingest_file(tmp_path / "nope.md", session, mock_embedding_service)
    session.add.assert_not_called()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_ingest_file_json_round_trips_through_pipeline(
    tmp_files: dict[str, Path], mock_embedding_service
):
    """JSON ingestion happy path; verifies file_type derivation."""
    session = _make_fake_session()
    doc = await ingest_file(tmp_files["json"], session, mock_embedding_service)
    assert doc.file_type == "json"
    assert doc.filename == "sample.json"
    assert doc.chunk_count >= 1


# ---------------------------------------------------------------------------
# ingest_directory — happy + error paths
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ingest_directory_happy_path_yields_all_supported(
    tmp_files: dict[str, Path], mock_embedding_service
):
    """Directory ingest returns one Document per supported file."""
    session = _make_fake_session()
    docs = await ingest_directory(tmp_files["dir"], session, mock_embedding_service)
    # tmp_files puts 4 supported files (md, txt, json, yaml) under tmp_path
    names = sorted(d.filename for d in docs)
    assert names == ["sample.json", "sample.md", "sample.txt", "sample.yaml"]


@pytest.mark.asyncio
async def test_ingest_directory_missing_dir_raises(
    tmp_path: Path, mock_embedding_service
):
    """Error path: missing directory -> FileNotFoundError."""
    session = _make_fake_session()
    with pytest.raises(FileNotFoundError):
        await ingest_directory(tmp_path / "no_such", session, mock_embedding_service)


@pytest.mark.asyncio
async def test_ingest_directory_skips_unsupported_extensions(
    tmp_path: Path, mock_embedding_service
):
    """Unsupported files do NOT raise — they are silently skipped."""
    (tmp_path / "ok.md").write_text("# title\n\nbody", encoding="utf-8")
    (tmp_path / "skip.xyz").write_text("ignored", encoding="utf-8")
    session = _make_fake_session()
    docs = await ingest_directory(tmp_path, session, mock_embedding_service)
    assert [d.filename for d in docs] == ["ok.md"]


@pytest.mark.asyncio
async def test_ingest_directory_continues_after_single_file_failure(
    tmp_path: Path, mock_embedding_service, monkeypatch
):
    """A failure in one file is logged-and-swallowed; other files still ingest."""
    good = tmp_path / "good.md"
    good.write_text("good content", encoding="utf-8")
    bad = tmp_path / "bad.md"
    bad.write_text("bad content", encoding="utf-8")

    real_ingest_file = ingest_file

    async def _maybe_fail(fp, sess, emb):
        if Path(fp).name == "bad.md":
            raise RuntimeError("boom")
        return await real_ingest_file(fp, sess, emb)

    # Patch the symbol used inside ingest_directory's module
    import app.ingestion as ing_mod

    monkeypatch.setattr(ing_mod, "ingest_file", _maybe_fail)

    session = _make_fake_session()
    docs = await ingest_directory(tmp_path, session, mock_embedding_service)
    assert [d.filename for d in docs] == ["good.md"]
