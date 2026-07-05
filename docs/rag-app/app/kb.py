"""Knowledge Base Abstraction Layer

Defines interface for document storage and retrieval.
Allows pluggable backends: PostgreSQL, keyword-only, custom implementations.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .search import SearchResult


@dataclass
class Document:
    """Document to be ingested into a knowledge base."""

    filename: str
    filepath: str
    file_type: str
    content_hash: str
    file_size: int
    content: str | None = None


@dataclass
class IngestResult:
    """Result of document ingestion."""

    document_id: int
    chunks_created: int
    embeddings_created: int
    errors: list[str]


class SearchMode:
    """Search mode constants."""

    SEMANTIC = "semantic"  # Vector similarity only
    KEYWORD = "keyword"  # Full-text search only
    HYBRID = "hybrid"  # Semantic + keyword with fusion
    ALL = [SEMANTIC, KEYWORD, HYBRID]


class KnowledgeBase(ABC):
    """Abstract base class for knowledge base backends.

    A knowledge base handles document storage, chunking, embedding,
    and retrieval. Implementations can use different backends:
    - PostgreSQL + pgvector (vector + keyword search)
    - Keyword-only (no embeddings)
    - Custom (vector store, file-based, etc.)
    """

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the knowledge base (create tables, connect, etc.)."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if knowledge base is healthy and accessible."""
        pass

    @abstractmethod
    async def ingest(
        self,
        document: Document,
        chunks: list[str],
        embeddings: list[list[float]] | None = None,
    ) -> IngestResult:
        """Store document and its chunks.

        Args:
            document: Document metadata
            chunks: List of text chunks
            embeddings: List of embedding vectors (None if no embedding support)

        Returns:
            Result with document_id, chunks created, any errors
        """
        pass

    @abstractmethod
    async def search(
        self,
        query: str,
        mode: str = SearchMode.HYBRID,
        limit: int = 10,
        embedding: list[float] | None = None,
    ) -> list[SearchResult]:
        """Search the knowledge base.

        Args:
            query: User query string
            mode: SearchMode.SEMANTIC, KEYWORD, or HYBRID
            limit: Max results to return
            embedding: Query embedding (for semantic search)

        Returns:
            List of search results ranked by relevance
        """
        pass

    @abstractmethod
    async def delete_document(self, document_id: int) -> None:
        """Delete a document and all its chunks."""
        pass

    @abstractmethod
    async def list_documents(self, limit: int = 100) -> list[dict]:
        """List all documents in the knowledge base.

        Returns:
            List of document metadata dicts
        """
        pass

    @abstractmethod
    async def get_document(self, document_id: int) -> dict | None:
        """Get document details by ID."""
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Clean up resources (close connections, etc.)."""
        pass

    @abstractmethod
    def supports_embedding(self) -> bool:
        """Return True if this KB supports vector search."""
        pass

    @abstractmethod
    def supports_keyword_search(self) -> bool:
        """Return True if this KB supports keyword search."""
        pass
