from __future__ import annotations

import datetime
import fnmatch
import hashlib
import json
import logging
import re
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol, runtime_checkable

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .config_manager import Config, default_config_path
from .database import Chunk, Document, get_document_by_hash, insert_document_dedup
from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)

# =============================================================================
# File handlers
# =============================================================================


@runtime_checkable
class FileHandler(Protocol):
    def extract_text(self, filepath: Path) -> str:
        ...


class PDFHandler:
    def extract_text(self, filepath: Path) -> str:
        import fitz  # pymupdf

        text_parts: list[str] = []
        with fitz.open(filepath) as doc:
            for page in doc:
                text_parts.append(page.get_text())
        return "\n".join(text_parts)


class MarkdownHandler:
    def extract_text(self, filepath: Path) -> str:
        return filepath.read_text(encoding="utf-8")


class TextHandler:
    def extract_text(self, filepath: Path) -> str:
        return filepath.read_text(encoding="utf-8")


class JSONHandler:
    def extract_text(self, filepath: Path) -> str:
        data = json.loads(filepath.read_text(encoding="utf-8"))
        return json.dumps(data, indent=2, ensure_ascii=False)


class YAMLHandler:
    def extract_text(self, filepath: Path) -> str:
        data = yaml.safe_load(filepath.read_text(encoding="utf-8"))
        return yaml.dump(data, default_flow_style=False, allow_unicode=True)


class HandlerRegistry:
    _handlers: dict[str, FileHandler] = {
        ".pdf": PDFHandler(),
        ".md": MarkdownHandler(),
        ".txt": TextHandler(),
        ".log": TextHandler(),
        ".json": JSONHandler(),
        ".yaml": YAMLHandler(),
        ".yml": YAMLHandler(),
    }

    @classmethod
    def get(cls, extension: str) -> FileHandler | None:
        return cls._handlers.get(extension.lower())

    @classmethod
    def supported_extensions(cls) -> set[str]:
        return set(cls._handlers.keys())


# =============================================================================
# Chunking
# =============================================================================

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def chunk_text(
    text: str,
    chunk_size: int = settings.CHUNK_SIZE,
    chunk_overlap: int = settings.CHUNK_OVERLAP,
) -> list[str]:
    """Split *text* into token-aware chunks along sentence boundaries.

    ``chunk_size`` and ``chunk_overlap`` are measured in *whitespace tokens*
    (a good-enough proxy that avoids a tokenizer dependency).
    """
    sentences = _SENTENCE_RE.split(text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks: list[str] = []
    current_tokens: list[str] = []
    current_len = 0

    for sentence in sentences:
        tokens = sentence.split()
        token_count = len(tokens)

        if current_len + token_count > chunk_size and current_tokens:
            chunks.append(" ".join(current_tokens))
            # Keep overlap tokens from the end
            overlap_tokens: list[str] = []
            overlap_len = 0
            for t in reversed(current_tokens):
                if overlap_len + 1 > chunk_overlap:
                    break
                overlap_tokens.insert(0, t)
                overlap_len += 1
            current_tokens = overlap_tokens
            current_len = overlap_len

        current_tokens.extend(tokens)
        current_len += token_count

    if current_tokens:
        chunks.append(" ".join(current_tokens))

    return chunks if chunks else [text.strip()] if text.strip() else []


# =============================================================================
# Config threading (ingestion.extensions / ingestion.exclude from config.yaml)
# =============================================================================


def _load_ingestion_config() -> dict:
    """Return the ``ingestion`` block from config.yaml ({} when absent)."""
    return Config.from_file(default_config_path()).get("ingestion", {}) or {}


def _normalize_extensions(extensions: Sequence[str] | None) -> set[str]:
    """Normalize user extensions ("md" or ".md") to handler-supported suffixes.

    Returns the full handler-supported set when *extensions* is falsy.
    Listed-but-unsupported extensions are dropped with a warning (no handler
    can extract them).
    """
    supported = HandlerRegistry.supported_extensions()
    if not extensions:
        return supported

    normalized = {f".{ext.lstrip('.').lower()}" for ext in extensions}
    unsupported = normalized - supported
    if unsupported:
        logger.warning(
            "Ignoring extensions with no registered handler: %s (supported: %s)",
            sorted(unsupported),
            sorted(supported),
        )
    return normalized & supported


def _is_excluded(rel_path: Path, patterns: Sequence[str]) -> bool:
    """True when *rel_path* (relative to the ingest root) matches any exclude glob.

    Semantics (matching config.yaml's documented defaults):
    - ``"name/"`` — directory pattern: excludes anything under a path component
      named ``name`` (e.g. ``.git/``, ``node_modules/``, ``data/``).
    - ``"*.pdf"`` etc. — fnmatch glob, tested against both the filename and the
      full relative POSIX path.
    Exclude wins over extensions.
    """
    rel_posix = rel_path.as_posix()
    for pattern in patterns:
        if pattern.endswith("/"):
            if pattern.rstrip("/") in rel_path.parts:
                return True
        elif fnmatch.fnmatch(rel_path.name, pattern) or fnmatch.fnmatch(rel_posix, pattern):
            return True
    return False


# =============================================================================
# Ingestion pipeline
# =============================================================================


async def ingest_file(
    filepath: str | Path,
    session: AsyncSession,
    embedding_service: EmbeddingService,
) -> Document:
    filepath = Path(filepath)
    if not filepath.is_file():
        raise FileNotFoundError(f"File not found: {filepath}")

    handler = HandlerRegistry.get(filepath.suffix)
    if handler is None:
        raise ValueError(
            f"Unsupported file type: {filepath.suffix}. "
            f"Supported: {HandlerRegistry.supported_extensions()}"
        )

    # Extract
    text = handler.extract_text(filepath)

    # Dedup pre-check BEFORE the (expensive) embedding call: identical content
    # is skipped idempotently instead of raising IntegrityError on the unique
    # content_hash and poisoning the session.
    content_hash = hashlib.sha256(text.encode()).hexdigest()
    existing = await get_document_by_hash(session, content_hash)
    if existing is not None:
        await _unexpire_chunks(session, existing.id)
        await session.commit()
        logger.info("Skipped duplicate (content_hash match): %s", filepath.name)
        return existing

    # Chunk
    chunks_text = chunk_text(text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)

    # Embed
    embeddings = await embedding_service.embed_batch(chunks_text)

    # Store. filepath.resolve() is host-openable under the DOCS_PATH same-path
    # ro mount (container path == host path); consumers can open it directly.
    doc = await insert_document_dedup(
        session,
        filename=filepath.name,
        filepath=str(filepath.resolve()),
        file_type=filepath.suffix.lstrip("."),
        content_hash=content_hash,
        file_size=filepath.stat().st_size,
        content=text,
        chunk_count=len(chunks_text),
    )
    if doc is None:
        # Lost a race with a concurrent ingest of identical content — the ON
        # CONFLICT DO NOTHING insert skipped silently; reuse the winner's row.
        existing = await get_document_by_hash(session, content_hash)
        if existing is None:  # pragma: no cover — conflict guarantees the row
            raise RuntimeError(f"Dedup conflict but no document for hash {content_hash}")
        await _unexpire_chunks(session, existing.id)
        await session.commit()
        logger.info("Skipped duplicate (concurrent ingest): %s", filepath.name)
        return existing

    for idx, (chunk_content, embedding) in enumerate(zip(chunks_text, embeddings)):
        chunk = Chunk(
            document_id=doc.id,
            content=chunk_content,
            chunk_index=idx,
            embedding=embedding,
        )
        session.add(chunk)

    await session.commit()
    await session.refresh(doc)
    logger.info("Ingested %s (%d chunks)", filepath.name, len(chunks_text))
    return doc


async def ingest_directory(
    dirpath: str | Path,
    session: AsyncSession,
    embedding_service: EmbeddingService,
    extensions: Sequence[str] | None = None,
    exclude: Sequence[str] | None = None,
) -> list[Document]:
    """Recursively ingest *dirpath*, honoring config extensions/exclude globs.

    ``extensions``/``exclude`` override the ``ingestion.extensions`` /
    ``ingestion.exclude`` blocks in config.yaml when given (e.g. from an API
    request); exclude wins over extensions. After the walk, chunks whose
    source files vanished from under *dirpath* are marked expired.
    """
    dirpath = Path(dirpath)
    if not dirpath.is_dir():
        raise FileNotFoundError(f"Directory not found: {dirpath}")

    ingestion_cfg = _load_ingestion_config()
    if extensions is None:
        extensions = ingestion_cfg.get("extensions")
    if exclude is None:
        exclude = ingestion_cfg.get("exclude") or []

    allowed = _normalize_extensions(extensions)
    documents: list[Document] = []

    for entry in sorted(dirpath.rglob("*")):
        if not entry.is_file() or entry.suffix.lower() not in allowed:
            continue
        if _is_excluded(entry.relative_to(dirpath), exclude):
            logger.debug("Excluded by glob: %s", entry)
            continue
        try:
            doc = await ingest_file(entry, session, embedding_service)
            documents.append(doc)
        except Exception:
            logger.exception("Failed to ingest %s", entry)
            # Reset the poisoned transaction so one bad file (e.g. an
            # IntegrityError) cannot cascade PendingRollbackError over the
            # rest of the walk.
            await session.rollback()

    expired = await expire_stale_chunks(session, dirpath)
    if expired:
        logger.info("Marked %d stale document(s) expired under %s", expired, dirpath)

    return documents


# =============================================================================
# Stale-chunk expiry (source file vanished)
# =============================================================================

_EXPIRED_KEY = "expired"
_EXPIRED_AT_KEY = "expired_at"


async def expire_stale_chunks(session: AsyncSession, root: Path) -> int:
    """Mark chunks of documents whose source path vanished under *root* expired.

    Only documents stored below *root* are considered, so paths that are
    simply not mounted in this container are never expired by an unrelated
    ingest pass. Expiry is recorded in the chunk ``metadata`` JSON
    (``expired``/``expired_at``); re-ingesting the same content clears it.
    Returns the number of newly expired documents. Commits.
    """
    root = Path(root).resolve()
    result = await session.execute(
        select(Document).where(Document.filepath.like(f"{root}/%"))
    )
    stale_docs = [doc for doc in result.scalars() if not Path(doc.filepath).exists()]
    if not stale_docs:
        return 0

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    expired_count = 0
    for doc in stale_docs:
        chunks = await session.execute(select(Chunk).where(Chunk.document_id == doc.id))
        newly_expired = False
        for chunk in chunks.scalars():
            meta = dict(chunk.metadata_ or {})
            if not meta.get(_EXPIRED_KEY):
                meta[_EXPIRED_KEY] = True
                meta[_EXPIRED_AT_KEY] = now
                chunk.metadata_ = meta
                newly_expired = True
        if newly_expired:
            expired_count += 1
            logger.warning("Source vanished, chunks marked expired: %s", doc.filepath)

    await session.commit()
    return expired_count


async def _unexpire_chunks(session: AsyncSession, document_id: int) -> None:
    """Clear the expired markers on a document's chunks (source re-appeared).

    Does NOT commit; the caller owns the transaction.
    """
    chunks = await session.execute(select(Chunk).where(Chunk.document_id == document_id))
    for chunk in chunks.scalars():
        meta = dict(chunk.metadata_ or {})
        if meta.pop(_EXPIRED_KEY, None) is not None:
            meta.pop(_EXPIRED_AT_KEY, None)
            chunk.metadata_ = meta


# NOTE (deferred, sugg-F22): opt-in symbol-aware chunking for .py/.js/.go was
# explicitly deferred by design decision — see the WS-INGEST handoff report.
