"""PostgreSQL + pgvector Knowledge Base Implementation

Stores documents, embeddings, and supports semantic + keyword search.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sqlalchemy import select, text

from .database import Chunk
from .database import Document as DocumentModel
from .kb import Document, IngestResult, KnowledgeBase, SearchMode
from .search import SearchResult, hybrid_search, keyword_search, semantic_search

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncEngine

    from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class PostgresKB(KnowledgeBase):
    """PostgreSQL + pgvector knowledge base backend.

    Supports:
    - Vector search (semantic) via pgvector cosine distance
    - Full-text search (keyword) via PostgreSQL tsvector
    - Hybrid search (semantic + keyword with RRF)
    """

    def __init__(
        self,
        name: str,
        engine: AsyncEngine,
        async_session_maker,
        embedding_service: EmbeddingService | None = None,
    ):
        """Initialize PostgreSQL KB.

        Args:
            name: KB name (for logging, identification)
            engine: SQLAlchemy async engine
            async_session_maker: AsyncSession factory
            embedding_service: EmbeddingService (required for semantic search)
        """
        self.name = name
        self.engine = engine
        self.async_session_maker = async_session_maker
        self.embedding_service = embedding_service

    async def initialize(self) -> None:
        """Create database tables if they don't exist."""
        from .database import Base

        # Ensure the pgvector extension exists BEFORE create_all: the tables
        # use the `vector` column type, so create_all fails on a fresh
        # database unless the extension is already installed (same ordering
        # as v1 init_db() in database.py). Runs in its own transaction so a
        # privilege/availability failure (warned below) cannot abort the
        # create_all transaction.
        try:
            async with self.engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception as e:
            logger.warning("pgvector extension creation failed: %s", e)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("PostgresKB %s initialized", self.name)

    async def health_check(self) -> bool:
        """Check if database is accessible."""
        try:
            async with self.async_session_maker() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.exception("PostgresKB health check failed: %s", e)
            return False

    async def ingest(
        self,
        document: Document,
        chunks: list[str],
        embeddings: list[list[float]] | None = None,
    ) -> IngestResult:
        """Ingest document and chunks into PostgreSQL."""
        try:
            async with self.async_session_maker() as session:
                # Create document record
                doc_model = DocumentModel(
                    filename=document.filename,
                    filepath=document.filepath,
                    file_type=document.file_type,
                    content_hash=document.content_hash,
                    file_size=document.file_size,
                    content=document.content,
                    chunk_count=len(chunks),
                )
                session.add(doc_model)
                await session.flush()  # Get doc_model.id

                # Create chunk records with embeddings
                for idx, chunk_text in enumerate(chunks):
                    chunk = Chunk(
                        document_id=doc_model.id,
                        chunk_index=idx,
                        content=chunk_text,
                        embedding=embeddings[idx] if embeddings else None,
                    )
                    session.add(chunk)

                await session.commit()

                return IngestResult(
                    document_id=doc_model.id,
                    chunks_created=len(chunks),
                    embeddings_created=len(embeddings) if embeddings else 0,
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
        mode: str = SearchMode.HYBRID,
        limit: int = 10,
        embedding: list[float] | None = None,
    ) -> list[SearchResult]:
        """Search knowledge base.

        Args:
            query: User query
            mode: SearchMode.SEMANTIC, KEYWORD, or HYBRID
            limit: Max results
            embedding: Query embedding (if None, will be computed)

        Returns:
            List of search results
        """
        async with self.async_session_maker() as session:
            if mode == SearchMode.SEMANTIC:
                if not self.embedding_service or embedding is None:
                    raise ValueError(
                        "Semantic search requires embedding_service and query embedding"
                    )
                return await semantic_search(
                    query=query,
                    session=session,
                    embedding_vector=embedding,
                    limit=limit,
                )

            elif mode == SearchMode.KEYWORD:
                return await keyword_search(
                    query=query,
                    session=session,
                    limit=limit,
                )

            elif mode == SearchMode.HYBRID:
                if not self.embedding_service or embedding is None:
                    # Fallback to keyword-only if no embeddings
                    logger.warning(
                        "Hybrid search requested but no embeddings; falling back to keyword"
                    )
                    return await keyword_search(
                        query=query,
                        session=session,
                        limit=limit,
                    )
                return await hybrid_search(
                    query=query,
                    session=session,
                    embedding_vector=embedding,
                    limit=limit,
                )

            else:
                raise ValueError(f"Unknown search mode: {mode}")

    async def delete_document(self, document_id: int) -> None:
        """Delete document and all associated chunks."""
        try:
            async with self.async_session_maker() as session:
                doc = await session.get(DocumentModel, document_id)
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
                stmt = select(DocumentModel).limit(limit)
                docs = (await session.execute(stmt)).scalars().all()
                return [
                    {
                        "id": doc.id,
                        "filename": doc.filename,
                        "file_type": doc.file_type,
                        "chunk_count": doc.chunk_count,
                        "created_at": doc.created_at.isoformat() if doc.created_at else None,
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
                doc = await session.get(DocumentModel, document_id)
                if doc:
                    return {
                        "id": doc.id,
                        "filename": doc.filename,
                        "filepath": doc.filepath,
                        "file_type": doc.file_type,
                        "file_size": doc.file_size,
                        "chunk_count": doc.chunk_count,
                        "created_at": doc.created_at.isoformat() if doc.created_at else None,
                    }
                return None
        except Exception:
            logger.exception("Failed to get document %d", document_id)
            return None

    async def shutdown(self) -> None:
        """Close database connection."""
        await self.engine.dispose()
        logger.info("PostgresKB %s shutdown", self.name)

    def supports_embedding(self) -> bool:
        """PostgreSQL KB always supports embeddings via pgvector."""
        return True

    def supports_keyword_search(self) -> bool:
        """PostgreSQL KB always supports keyword search via tsvector."""
        return True
