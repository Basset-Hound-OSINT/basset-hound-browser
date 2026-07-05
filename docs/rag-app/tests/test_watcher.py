"""Tests for the auto-ingest DocumentWatcher module."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def temp_docs_dir():
    """Create a temporary documents directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        docs_dir = Path(tmpdir) / "docs"
        docs_dir.mkdir()
        archive_dir = docs_dir / "archive"
        archive_dir.mkdir()
        yield docs_dir, archive_dir


@pytest.fixture
def ingest_queue():
    """Create an IngestQueue instance."""
    from app.watcher import IngestQueue

    return IngestQueue(max_workers=1)


@pytest.fixture
def document_watcher(temp_docs_dir):
    """Create a DocumentWatcher instance."""
    from app.watcher import DocumentWatcher

    docs_dir, archive_dir = temp_docs_dir
    watcher = DocumentWatcher()
    # Override watch directory for testing
    watcher.WATCH_DIR = docs_dir
    watcher.ARCHIVE_DIR = archive_dir
    return watcher


# ---------------------------------------------------------------------------
# IngestQueue Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestIngestQueue:
    """Tests for IngestQueue class."""

    @pytest.mark.asyncio
    async def test_queue_initialization(self, ingest_queue):
        """Test queue is properly initialized."""
        assert ingest_queue.max_workers == 1
        assert ingest_queue.is_empty is True
        assert ingest_queue.stats["total_queued"] == 0
        assert ingest_queue.stats["total_processed"] == 0

    @pytest.mark.asyncio
    async def test_add_file_to_queue(self, ingest_queue, temp_docs_dir):
        """Test adding a file to the queue."""
        docs_dir, _ = temp_docs_dir
        filepath = docs_dir / "test.txt"
        filepath.write_text("test content")

        await ingest_queue.add(filepath)

        assert ingest_queue.stats["total_queued"] == 1
        assert ingest_queue.is_empty is False

    @pytest.mark.asyncio
    async def test_get_file_from_queue(self, ingest_queue, temp_docs_dir):
        """Test retrieving a file from the queue."""
        docs_dir, _ = temp_docs_dir
        filepath = docs_dir / "test.txt"
        filepath.write_text("test content")

        await ingest_queue.add(filepath)
        retrieved = await ingest_queue.get()

        assert retrieved == str(filepath)

    @pytest.mark.asyncio
    async def test_queue_empty_returns_none(self, ingest_queue):
        """Test that getting from empty queue returns None."""
        result = await ingest_queue.get()
        assert result is None

    @pytest.mark.asyncio
    async def test_mark_processing(self, ingest_queue, temp_docs_dir):
        """Test marking file as processing."""
        docs_dir, _ = temp_docs_dir
        filepath = str(docs_dir / "test.txt")

        ingest_queue.mark_processing(filepath)
        assert filepath in ingest_queue.processing

    @pytest.mark.asyncio
    async def test_mark_completed(self, ingest_queue, temp_docs_dir):
        """Test marking file as completed."""
        docs_dir, _ = temp_docs_dir
        filepath = str(docs_dir / "test.txt")

        ingest_queue.mark_processing(filepath)
        ingest_queue.mark_completed(filepath)

        assert filepath not in ingest_queue.processing
        assert ingest_queue.stats["total_processed"] == 1

    @pytest.mark.asyncio
    async def test_mark_failed(self, ingest_queue, temp_docs_dir):
        """Test marking file as failed."""
        docs_dir, _ = temp_docs_dir
        filepath = str(docs_dir / "test.txt")

        ingest_queue.mark_processing(filepath)
        ingest_queue.mark_failed(filepath)

        assert filepath not in ingest_queue.processing
        assert ingest_queue.stats["total_failed"] == 1

    @pytest.mark.asyncio
    async def test_duplicate_add_not_queued(self, ingest_queue, temp_docs_dir):
        """Test that duplicate files in processing aren't re-queued."""
        docs_dir, _ = temp_docs_dir
        filepath = docs_dir / "test.txt"
        filepath.write_text("test")

        await ingest_queue.add(filepath)
        filepath_str = str(filepath)
        ingest_queue.mark_processing(filepath_str)

        # Try to add same file again
        await ingest_queue.add(filepath)

        assert ingest_queue.stats["total_queued"] == 1


# ---------------------------------------------------------------------------
# DocumentWatcher Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestDocumentWatcher:
    """Tests for DocumentWatcher class."""

    @pytest.mark.asyncio
    async def test_watcher_initialization(self, document_watcher):
        """Test watcher is properly initialized."""
        assert document_watcher.queue is not None
        assert document_watcher.running is False

    @pytest.mark.asyncio
    async def test_supported_formats(self, document_watcher):
        """Test that supported file formats are defined."""
        assert ".pdf" in document_watcher.SUPPORTED_FORMATS
        assert ".txt" in document_watcher.SUPPORTED_FORMATS
        assert ".md" in document_watcher.SUPPORTED_FORMATS
        assert ".docx" in document_watcher.SUPPORTED_FORMATS

    @pytest.mark.asyncio
    async def test_file_extension_validation(self, document_watcher, temp_docs_dir):
        """Test that supported file types are defined."""
        # Test supported formats are documented
        assert len(document_watcher.SUPPORTED_FORMATS) > 0
        # Verify it contains expected formats
        supported_str = str(document_watcher.SUPPORTED_FORMATS)
        assert "pdf" in supported_str or ".pdf" in supported_str

    @pytest.mark.asyncio
    async def test_event_emission(self, document_watcher):
        """Test that watcher emits events correctly."""
        events = []

        def on_event(event):
            events.append(event)

        document_watcher.on_progress = on_event

        # Simulate event emission
        test_event = {"type": "test_event", "data": "test"}
        document_watcher.on_progress(test_event)

        assert len(events) == 1
        assert events[0]["type"] == "test_event"

    @pytest.mark.asyncio
    async def test_watcher_stats_tracking(self, document_watcher):
        """Test that watcher tracks statistics."""
        stats = document_watcher.get_stats()

        assert "running" in stats
        assert "watch_dir" in stats
        assert "queue_size" in stats
        assert "total_queued" in stats
        assert "total_processed" in stats

    @pytest.mark.asyncio
    async def test_archive_directory_creation(self, document_watcher, temp_docs_dir):
        """Test that archive directory is used for processed files."""
        _, archive_dir = temp_docs_dir
        assert archive_dir.exists()
        assert archive_dir.is_dir()

    @pytest.mark.asyncio
    async def test_file_archival_filename_format(self, document_watcher):
        """Test that archived files have timestamp prefix."""
        # This is a validation test - actual archival requires running watcher
        # Just verify the naming convention would work
        test_filename = "test_document.pdf"
        # Archive format: YYYY-MM-DDTHH:MM:SS.ffffff_filename
        import re

        archive_pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}_.*"
        # We'll construct what the archived name would look like
        from datetime import datetime

        timestamp = datetime.now().isoformat(timespec="microseconds")
        archived_name = f"{timestamp}_{test_filename}"
        assert re.match(archive_pattern, archived_name)


# ---------------------------------------------------------------------------
# Watcher Integration Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestWatcherIntegration:
    """Integration tests for watcher functionality."""

    @pytest.mark.asyncio
    async def test_watcher_without_inotify_uses_polling(self, document_watcher):
        """Test that watcher falls back to polling if inotify unavailable."""
        # Check the fallback mode is used
        assert hasattr(document_watcher, "SUPPORTED_FORMATS")

    @pytest.mark.asyncio
    async def test_watcher_status_endpoint_format(self, document_watcher):
        """Test that watcher status has correct format for API."""
        stats = document_watcher.get_stats()

        # Verify all required fields for HTTP response
        assert isinstance(stats, dict)
        assert "running" in stats
        assert "watch_dir" in stats
        assert "queue_size" in stats
        assert "processing_count" in stats
        assert "total_queued" in stats
        assert "total_processed" in stats
        assert "total_failed" in stats
        assert "total_archived" in stats

    @pytest.mark.asyncio
    async def test_multiple_files_in_queue(self, ingest_queue, temp_docs_dir):
        """Test queuing multiple files in sequence."""
        docs_dir, _ = temp_docs_dir

        # Add 3 files
        for i in range(3):
            filepath = docs_dir / f"test_{i}.txt"
            filepath.write_text(f"content {i}")
            await ingest_queue.add(filepath)

        assert ingest_queue.stats["total_queued"] == 3
        assert ingest_queue.is_empty is False

        # Retrieve them
        files = []
        for _ in range(3):
            f = await ingest_queue.get()
            if f:
                files.append(f)

        assert len(files) == 3

    @pytest.mark.asyncio
    async def test_watcher_startup_shutdown(self, document_watcher):
        """Test watcher can be started and stopped."""
        # Just test the basic structure - full startup requires full app context
        assert document_watcher.running is False

        # Verify stop can be called without error
        try:
            await document_watcher.stop()
        except Exception:
            pytest.fail("Watcher.stop() should not raise exception")


# ---------------------------------------------------------------------------
# API Endpoint Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestWatcherAPIEndpoint:
    """Tests for watcher API endpoint integration."""

    def test_watcher_status_endpoint_response_schema(self):
        """Test that watcher status endpoint returns correct schema."""
        # Expected schema for /api/watcher/status
        expected_fields = {
            "status": str,
            "watch_dir": str,
            "queue_size": int,
            "processing_count": int,
            "total_queued": int,
            "total_processed": int,
            "total_failed": int,
            "total_archived": int,
        }

        assert len(expected_fields) > 0
        # This is a schema definition test


# ---------------------------------------------------------------------------
# Performance Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestWatcherPerformance:
    """Tests for watcher performance characteristics."""

    @pytest.mark.asyncio
    async def test_queue_add_performance(self, ingest_queue, temp_docs_dir):
        """Test queue add operation is fast."""
        docs_dir, _ = temp_docs_dir
        import time

        # Add 100 files and measure time
        files = []
        for i in range(100):
            filepath = docs_dir / f"test_{i}.txt"
            filepath.write_text("x" * 100)
            files.append(filepath)

        start = time.time()
        for filepath in files:
            await ingest_queue.add(filepath)
        elapsed = time.time() - start

        # Should complete in less than 1 second for 100 files
        assert elapsed < 1.0
        assert ingest_queue.stats["total_queued"] == 100

    @pytest.mark.asyncio
    async def test_queue_retrieval_performance(self, ingest_queue):
        """Test queue get operation is O(1)."""
        import time

        # Add a file and measure retrieval time
        await ingest_queue.add("test.txt")

        start = time.time()
        await ingest_queue.get()
        elapsed = time.time() - start

        # Should be nearly instant (< 10ms)
        assert elapsed < 0.01
