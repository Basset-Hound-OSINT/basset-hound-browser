"""Tests for Knowledge Base Abstraction Layer

Tests:
- KB interface validation
- PostgreSQL KB ingestion and search
- Keyword-Only KB ingestion and search
- KB registry management
"""

import pytest
from app.kb import Document, IngestResult, KnowledgeBase, SearchMode
from app.keyword_only_kb import KeywordOnlyKB
from app.registry import KnowledgeRegistry


class TestKBInterface:
    """Test that KnowledgeBase interface is well-defined."""

    def test_kb_is_abstract(self):
        """KnowledgeBase should not be instantiable."""
        with pytest.raises(TypeError):
            KnowledgeBase()

    def test_search_modes_defined(self):
        """SearchMode should have all modes."""
        assert SearchMode.SEMANTIC == "semantic"
        assert SearchMode.KEYWORD == "keyword"
        assert SearchMode.HYBRID == "hybrid"
        assert len(SearchMode.ALL) == 3


class TestKeywordOnlyKB:
    """Test Keyword-Only KB (no embeddings)."""

    @pytest.fixture
    async def kb(self):
        """Create a test keyword-only KB."""
        kb = KeywordOnlyKB("test-keyword", database_url="sqlite:///:memory:")
        await kb.initialize()
        yield kb
        await kb.shutdown()

    @pytest.mark.asyncio
    async def test_initialization(self):
        """KB should initialize without errors."""
        kb = KeywordOnlyKB("test", database_url="sqlite:///:memory:")
        await kb.initialize()
        assert await kb.health_check() is True
        await kb.shutdown()

    @pytest.mark.asyncio
    async def test_ingest_document(self, kb):
        """Should ingest document and chunks."""
        doc = Document(
            filename="test.txt",
            filepath="/test/test.txt",
            file_type="txt",
            content_hash="abc123",
            file_size=100,
            content="Test content",
        )
        chunks = ["Chunk 1", "Chunk 2", "Chunk 3"]

        result = await kb.ingest(doc, chunks)

        assert result.document_id > 0
        assert result.chunks_created == 3
        assert result.embeddings_created == 0
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_keyword_search(self, kb):
        """Should search documents by keyword."""
        doc = Document(
            filename="atc.txt",
            filepath="/test/atc.txt",
            file_type="txt",
            content_hash="abc456",
            file_size=200,
        )
        chunks = [
            "Prepare to descend",
            "Maintain altitude 10000 feet",
            "Contact ATC on 124.5",
        ]

        await kb.ingest(doc, chunks)

        # Search for keyword
        results = await kb.search(
            query="ATC contact",
            mode=SearchMode.KEYWORD,
            limit=10,
        )

        assert len(results) > 0
        assert any("ATC" in r.content for r in results)

    @pytest.mark.asyncio
    async def test_supports_keyword_search(self, kb):
        """KeywordOnlyKB should support keyword search."""
        assert kb.supports_keyword_search() is True

    @pytest.mark.asyncio
    async def test_does_not_support_embedding(self, kb):
        """KeywordOnlyKB should not support embeddings."""
        assert kb.supports_embedding() is False

    @pytest.mark.asyncio
    async def test_list_documents(self, kb):
        """Should list all documents."""
        doc1 = Document(
            filename="doc1.txt",
            filepath="/test/doc1.txt",
            file_type="txt",
            content_hash="hash1",
            file_size=100,
        )
        doc2 = Document(
            filename="doc2.txt",
            filepath="/test/doc2.txt",
            file_type="txt",
            content_hash="hash2",
            file_size=200,
        )

        await kb.ingest(doc1, ["Chunk 1"])
        await kb.ingest(doc2, ["Chunk 2", "Chunk 3"])

        docs = await kb.list_documents()
        assert len(docs) == 2
        assert docs[0]["filename"] in ["doc1.txt", "doc2.txt"]
        assert docs[0]["chunk_count"] > 0

    @pytest.mark.asyncio
    async def test_delete_document(self, kb):
        """Should delete a document."""
        doc = Document(
            filename="delete_me.txt",
            filepath="/test/delete_me.txt",
            file_type="txt",
            content_hash="delete_hash",
            file_size=50,
        )

        result = await kb.ingest(doc, ["Content to delete"])
        doc_id = result.document_id

        # Verify it exists
        doc_info = await kb.get_document(doc_id)
        assert doc_info is not None

        # Delete it
        await kb.delete_document(doc_id)

        # Verify it's gone
        doc_info = await kb.get_document(doc_id)
        assert doc_info is None


class TestKnowledgeRegistry:
    """Test Knowledge Base Registry."""

    @pytest.fixture
    async def registry(self):
        """Create a test registry."""
        reg = KnowledgeRegistry()
        yield reg
        # Cleanup
        await reg.shutdown_all()

    @pytest.mark.asyncio
    async def test_create_keyword_kb(self, registry):
        """Should create a keyword-only KB."""
        kb = await registry.create("test-kb", "keyword-only")
        assert kb is not None
        assert kb.supports_keyword_search() is True

    @pytest.mark.asyncio
    async def test_get_kb(self, registry):
        """Should retrieve created KB."""
        await registry.create("my-kb", "keyword-only")
        kb = await registry.get("my-kb")
        assert kb is not None

    @pytest.mark.asyncio
    async def test_get_nonexistent_kb(self, registry):
        """Should raise error for nonexistent KB."""
        with pytest.raises(KeyError):
            await registry.get("nonexistent")

    @pytest.mark.asyncio
    async def test_list_kbs(self, registry):
        """Should list all KB names."""
        await registry.create("kb1", "keyword-only")
        await registry.create("kb2", "keyword-only")

        names = await registry.list()
        assert "kb1" in names
        assert "kb2" in names
        assert len(names) == 2

    @pytest.mark.asyncio
    async def test_list_with_config(self, registry):
        """Should list KBs with configuration."""
        await registry.create("kb1", "keyword-only")

        config = await registry.list_with_config()
        assert "kb1" in config
        assert config["kb1"]["type"] == "keyword-only"

    @pytest.mark.asyncio
    async def test_create_duplicate_kb(self, registry):
        """Should raise error when creating duplicate KB name."""
        await registry.create("duplicate", "keyword-only")

        with pytest.raises(ValueError, match="already exists"):
            await registry.create("duplicate", "keyword-only")

    @pytest.mark.asyncio
    async def test_create_unknown_type(self, registry):
        """Should raise error for unknown KB type."""
        with pytest.raises(ValueError, match="Unknown KB type"):
            await registry.create("kb", "unknown-type")

    @pytest.mark.asyncio
    async def test_delete_kb(self, registry):
        """Should delete a KB."""
        await registry.create("to-delete", "keyword-only")
        await registry.delete("to-delete")

        with pytest.raises(KeyError):
            await registry.get("to-delete")

    @pytest.mark.asyncio
    async def test_delete_nonexistent_kb(self, registry):
        """Should raise error when deleting nonexistent KB."""
        with pytest.raises(KeyError):
            await registry.delete("nonexistent")


class TestDocumentModel:
    """Test Document model."""

    def test_document_creation(self):
        """Should create Document with required fields."""
        doc = Document(
            filename="test.pdf",
            filepath="/test/test.pdf",
            file_type="pdf",
            content_hash="abc123",
            file_size=1000,
            content="Content here",
        )

        assert doc.filename == "test.pdf"
        assert doc.file_type == "pdf"
        assert doc.content_hash == "abc123"

    def test_document_optional_content(self):
        """Content should be optional."""
        doc = Document(
            filename="test.txt",
            filepath="/test/test.txt",
            file_type="txt",
            content_hash="xyz789",
            file_size=500,
        )

        assert doc.content is None


class TestIngestResult:
    """Test IngestResult model."""

    def test_ingest_result_success(self):
        """Should create successful result."""
        result = IngestResult(
            document_id=1,
            chunks_created=5,
            embeddings_created=5,
            errors=[],
        )

        assert result.document_id == 1
        assert result.chunks_created == 5
        assert len(result.errors) == 0

    def test_ingest_result_with_errors(self):
        """Should track errors."""
        result = IngestResult(
            document_id=-1,
            chunks_created=0,
            embeddings_created=0,
            errors=["File too large", "Unsupported format"],
        )

        assert len(result.errors) == 2
        assert "File too large" in result.errors
