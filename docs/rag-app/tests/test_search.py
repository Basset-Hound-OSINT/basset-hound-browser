"""Tests for search utilities - especially the _rrf fusion function."""

from __future__ import annotations

import pytest
from app.search import SearchResult, _rrf


def _result(chunk_id: int, doc_id: int = 1, score: float = 0.0) -> SearchResult:
    return SearchResult(
        chunk_id=chunk_id,
        document_id=doc_id,
        document_filename=f"doc{doc_id}.txt",
        chunk_index=0,
        content=f"chunk {chunk_id}",
        score=score,
    )


@pytest.mark.unit
class TestRRF:
    def test_empty_inputs(self):
        assert _rrf([], []) == []

    def test_empty_semantic(self):
        kw = [_result(1), _result(2)]
        results = _rrf([], kw)
        assert len(results) == 2

    def test_empty_keyword(self):
        sem = [_result(1), _result(2)]
        results = _rrf(sem, [])
        assert len(results) == 2

    def test_scoring_order(self):
        # chunk 1 is rank-1 in both lists, chunk 2 is rank-2
        sem = [_result(1), _result(2)]
        kw = [_result(1), _result(2)]
        results = _rrf(sem, kw)
        assert results[0].chunk_id == 1
        assert results[1].chunk_id == 2
        assert results[0].score > results[1].score

    def test_disjoint_lists(self):
        sem = [_result(1), _result(2)]
        kw = [_result(3), _result(4)]
        results = _rrf(sem, kw)
        assert len(results) == 4
        ids = [r.chunk_id for r in results]
        assert set(ids) == {1, 2, 3, 4}

    def test_semantic_weight_affects_ranking(self):
        # chunk A: rank-1 semantic, rank-2 keyword
        # chunk B: rank-2 semantic, rank-1 keyword
        sem = [_result(10), _result(20)]
        kw = [_result(20), _result(10)]

        # High semantic weight -> chunk 10 (semantic rank-1) should win
        high_sem = _rrf(sem, kw, semantic_weight=0.9)
        assert high_sem[0].chunk_id == 10

        # Low semantic weight -> chunk 20 (keyword rank-1) should win
        low_sem = _rrf(sem, kw, semantic_weight=0.1)
        assert low_sem[0].chunk_id == 20

    def test_scores_are_positive(self):
        sem = [_result(1)]
        kw = [_result(2)]
        results = _rrf(sem, kw)
        for r in results:
            assert r.score > 0

    def test_duplicate_chunk_in_both_lists(self):
        sem = [_result(1)]
        kw = [_result(1)]
        results = _rrf(sem, kw)
        assert len(results) == 1
        # Score should be sum of both RRF contributions
        k = 60
        expected = 0.7 / (k + 1) + 0.3 / (k + 1)
        assert abs(results[0].score - expected) < 1e-9
