"""Tests for the chunk_text function in app.ingestion."""

from __future__ import annotations

import pytest
from app.ingestion import chunk_text


@pytest.mark.unit
class TestChunkText:
    def test_normal_text_produces_multiple_chunks(self):
        # ~200 words, chunk_size=50 should yield several chunks
        text = " ".join(f"Word number {i} here." for i in range(200))
        chunks = chunk_text(text, chunk_size=50, chunk_overlap=10)
        assert len(chunks) > 1
        # Every word should appear at least once across all chunks
        all_words = " ".join(chunks)
        for i in range(200):
            assert f"number {i}" in all_words

    def test_short_text_single_chunk(self):
        text = "Short sentence."
        chunks = chunk_text(text, chunk_size=512, chunk_overlap=50)
        assert len(chunks) == 1
        assert chunks[0] == "Short sentence."

    def test_empty_string_returns_empty(self):
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_overlap_produces_shared_tokens(self):
        # Build text with clear sentence boundaries
        sentences = [f"Sentence {i} has several words in it." for i in range(20)]
        text = " ".join(sentences)
        chunks = chunk_text(text, chunk_size=20, chunk_overlap=5)
        assert len(chunks) >= 2
        # Check overlap: last tokens of chunk N should appear at start of chunk N+1
        for i in range(len(chunks) - 1):
            tail_tokens = chunks[i].split()[-5:]
            head_tokens = chunks[i + 1].split()[:5]
            # At least some overlap tokens should match
            overlap = set(tail_tokens) & set(head_tokens)
            assert len(overlap) > 0, f"No overlap between chunk {i} and {i+1}"

    def test_sentence_boundary_splitting(self):
        text = "First sentence. Second sentence. Third sentence."
        chunks = chunk_text(text, chunk_size=4, chunk_overlap=0)
        # Each sentence is 2 tokens, chunk_size=4 fits 2 sentences per chunk
        assert len(chunks) >= 1
        # Verify sentences are not split mid-word
        for chunk in chunks:
            assert not chunk.startswith(" ")

    def test_single_long_sentence(self):
        # No sentence-ending punctuation, so regex won't split
        text = " ".join(f"w{i}" for i in range(100))
        chunks = chunk_text(text, chunk_size=20, chunk_overlap=5)
        # Should still produce at least one chunk
        assert len(chunks) >= 1
