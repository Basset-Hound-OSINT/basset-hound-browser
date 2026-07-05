"""Keyword-Only Knowledge Base Implementation

For lightweight deployments without embeddings.
Supports only full-text search (no semantic/vector search).
Minimal storage overhead, no embedding dependencies.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .kb import Document, IngestResult, KnowledgeBase, SearchMode
from .search import SearchResult

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class KeywordDocument(Base):
    """Document record (no vector storage)."""

    __tablename__ = "documents_keyword"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    filepath: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)

    chunks: Mapped[list[KeywordChunk]] = relationship(
        "KeywordChunk", back_populates="document", cascade="all, delete-orphan"
    )


class KeywordChunk(Base):
    """Chunk record (no embeddings, no vector column)."""

    __tablename__ = "chunks_keyword"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents_keyword.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    document: Mapped[KeywordDocument] = relationship("KeywordDocument", back_populates="chunks")


class KeywordOnlyKB(KnowledgeBase):
    """Keyword-only knowledge base (no embeddings).

    Lightweight alternative to PostgreSQL + pgvector.
    Uses standard PostgreSQL full-text search (tsvector/tsquery).
    No vector storage, no embedding service required.
    """

    def __init__(self, name: str, database_url: str | None = None):
        """Initialize keyword-only KB.

        Args:
            name: KB name
            database_url: PostgreSQL connection string
                         (default: sqlite:///:memory: for testing)
        """
        self.name = name
        self.database_url = database_url or "sqlite:///:memory:"
        self.engine = None
        self.async_session_maker = None

    async def initialize(self) -> None:
        """Create database and tables."""

        self.engine = create_async_engine(
            self.database_url, echo=False, pool_size=10, max_overflow=5
        )
        self.async_session_maker = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Enable full-text search (PostgreSQL only)
            if "postgres" in self.database_url.lower():
                try:
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                except Exception as e:
                    logger.warning("pg_trgm extension creation failed: %s", e)

        logger.info("KeywordOnlyKB %s initialized", self.name)

    async def health_check(self) -> bool:
        """Check if database is accessible."""
        try:
            async with self.async_session_maker() as session:
                if "postgres" in self.database_url.lower():
                    await session.execute(text("SELECT 1"))
                else:
                    # SQLite
                    await session.execute(select(1))
            return True
        except Exception as e:
            logger.exception("KeywordOnlyKB health check failed: %s", e)
            return False

    async def ingest(
        self,
        document: Document,
        chunks: list[str],
        embeddings: list[list[float]] | None = None,
    ) -> IngestResult:
        """Ingest document (ignores embeddings).

        Args:
            document: Document metadata
            chunks: List of text chunks
            embeddings: Ignored (not supported)

        Returns:
            IngestResult
        """
        try:
            async with self.async_session_maker() as session:
                doc = KeywordDocument(
                    filename=document.filename,
                    filepath=document.filepath,
                    file_type=document.file_type,
                    content_hash=document.content_hash,
                    file_size=document.file_size,
                    chunk_count=len(chunks),
                )
                session.add(doc)
                await session.flush()  # Get doc.id

                # Create chunks (no embeddings)
                for idx, chunk_text in enumerate(chunks):
                    chunk = KeywordChunk(
                        document_id=doc.id,
                        chunk_index=idx,
                        content=chunk_text,
                    )
                    session.add(chunk)

                await session.commit()

                return IngestResult(
                    document_id=doc.id,
                    chunks_created=len(chunks),
                    embeddings_created=0,  # No embeddings
                    errors=[],
                )
        except Exception as e:
            logger.exception("Ingestion failed for %s", document.filename)
            return IngestResult(
                document_id=-1,
                chunks_created=0,
                embeddings_created=0,
                errors=[str(e)],
            )

    async def search(
        self,
        query: str,
        mode: str = SearchMode.KEYWORD,
        limit: int = 10,
        embedding: list[float] | None = None,
    ) -> list[SearchResult]:
        """Search knowledge base (keyword-only).

        Args:
            query: User query
            mode: Only SearchMode.KEYWORD is supported
            limit: Max results
            embedding: Ignored

        Returns:
            List of search results
        """
        if mode in [SearchMode.SEMANTIC, SearchMode.HYBRID]:
            logger.warning("Mode %s not supported by KeywordOnlyKB; using keyword search", mode)

        async with self.async_session_maker() as session:
            # Full-text search on chunk content
            if "postgres" in self.database_url.lower():
                # PostgreSQL full-text search
                ts_query = func.plainto_tsquery("english", query)
                ts_vector = func.to_tsvector("english", KeywordChunk.content)
                rank = func.ts_rank(ts_vector, ts_query).label("rank")

                stmt = (
                    select(KeywordChunk, KeywordDocument.filename, KeywordDocument.filepath, rank)
                    .join(KeywordDocument, KeywordChunk.document_id == KeywordDocument.id)
                    .where(ts_vector.op("@@")(ts_query))
                    .order_by(rank.desc())
                    .limit(limit)
                )

                rows = (await session.execute(stmt)).all()

                return [
                    SearchResult(
                        chunk_id=row.KeywordChunk.id,
                        document_id=row.KeywordChunk.document_id,
                        document_filename=row.filename,
                        document_filepath=row.filepath or "",
                        chunk_index=row.KeywordChunk.chunk_index,
                        content=row.KeywordChunk.content,
                        score=float(row.rank),
                    )
                    for row in rows
                ]
            else:
                # SQLite: simple substring match (slower but works)
                query_lower = query.lower()
                stmt = (
                    select(KeywordChunk, KeywordDocument.filename, KeywordDocument.filepath)
                    .join(KeywordDocument, KeywordChunk.document_id == KeywordDocument.id)
                    .where(KeywordChunk.content.ilike(f"%{query_lower}%"))
                    .limit(limit)
                )

                rows = (await session.execute(stmt)).all()

                return [
                    SearchResult(
                        chunk_id=row.KeywordChunk.id,
                        document_id=row.KeywordChunk.document_id,
                        document_filename=row.filename,
                        document_filepath=row.filepath or "",
                        chunk_index=row.KeywordChunk.chunk_index,
                        content=row.KeywordChunk.content,
                        score=1.0,  # No ranking in simple substring match
                    )
                    for row in rows
                ]

    async def delete_document(self, document_id: int) -> None:
        """Delete document and chunks."""
        try:
            async with self.async_session_maker() as session:
                doc = await session.get(KeywordDocument, document_id)
                if doc:
                    await session.delete(doc)
                    await session.commit()
                    logger.info("Deleted document %d from %s", document_id, self.name)
        except Exception:
            logger.exception("Failed to delete document %d", document_id)

    async def list_documents(self, limit: int = 100) -> list[dict]:
        """List all documents."""
        try:
            async with self.async_session_maker() as session:
                stmt = select(KeywordDocument).limit(limit)
                docs = (await session.execute(stmt)).scalars().all()
                return [
                    {
                        "id": doc.id,
                        "filename": doc.filename,
                        "file_type": doc.file_type,
                        "chunk_count": doc.chunk_count,
                    }
                    for doc in docs
                ]
        except Exception:
            logger.exception("Failed to list documents")
            return []

    async def get_document(self, document_id: int) -> dict | None:
        """Get document details."""
        try:
            async with self.async_session_maker() as session:
                doc = await session.get(KeywordDocument, document_id)
                if doc:
                    return {
                        "id": doc.id,
                        "filename": doc.filename,
                        "filepath": doc.filepath,
                        "file_type": doc.file_type,
                        "file_size": doc.file_size,
                        "chunk_count": doc.chunk_count,
                    }
                return None
        except Exception:
            logger.exception("Failed to get document %d", document_id)
            return None

    async def shutdown(self) -> None:
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
        logger.info("KeywordOnlyKB %s shutdown", self.name)

    def supports_embedding(self) -> bool:
        """KeywordOnlyKB does not support embeddings."""
        return False

    def supports_keyword_search(self) -> bool:
        """KeywordOnlyKB supports keyword search."""
        return True
