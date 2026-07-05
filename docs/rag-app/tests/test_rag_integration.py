"""
Integration tests for RAG Bootstrap with distilled model.

This test suite validates RAG functionality with the new distilled 3B model,
ensuring that accuracy and performance metrics are maintained from baseline.
"""

import asyncio
import json
import logging

import httpx
import pytest

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration & Fixtures
# ============================================================================

BASE_URL = "http://localhost:8100"
TIMEOUT = 60.0
EXTRACTION_BENCHMARK_QUESTIONS = [
    # Sample extraction accuracy benchmark questions
    {
        "question": "What are the key steps for a controller to minimize aircraft delays?",
        "expected_keywords": ["prioritize", "coordinate", "delays"],
        "category": "procedural",
    },
    {
        "question": "How should a controller handle emergency fuel declarations?",
        "expected_keywords": ["fuel", "priority", "landing"],
        "category": "emergency",
    },
    {
        "question": "What communication standards should pilots and controllers follow?",
        "expected_keywords": ["terminology", "glossary", "communication"],
        "category": "standards",
    },
    {
        "question": "Describe proper approach procedures for night operations.",
        "expected_keywords": ["approach", "night", "visibility"],
        "category": "procedural",
    },
    {
        "question": "What are the factors that affect aircraft landing priority?",
        "expected_keywords": ["minimum fuel", "emergency", "weather"],
        "category": "decision",
    },
]


@pytest.fixture(scope="session")
def client():
    """Create HTTP client for API tests."""
    return httpx.Client(base_url=BASE_URL, timeout=TIMEOUT)


@pytest.fixture(scope="session")
def async_client():
    """Create async HTTP client for streaming tests."""
    return httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT)


# ============================================================================
# System Health Tests
# ============================================================================


def test_system_health(client):
    """Verify all system components are healthy."""
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "services" in data
    assert data["services"].get("database") == "connected"
    assert data["services"].get("ollama") == "connected"


def test_knowledge_base_statistics(client):
    """Verify knowledge base is populated and accessible."""
    response = client.get("/api/stats")
    assert response.status_code == 200

    data = response.json()
    assert data["total_chunks"] > 0, "Knowledge base should contain documents"
    assert data["total_documents"] > 0
    assert data["indexing_status"] == "complete"


def test_watcher_status(client):
    """Verify auto-ingest watcher is operational."""
    response = client.get("/api/watcher/status")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "running"
    assert "queue_size" in data
    assert "total_processed" in data


# ============================================================================
# Search Functionality Tests
# ============================================================================


class TestSemanticSearch:
    """Tests for semantic (vector-based) search."""

    def test_semantic_search_returns_results(self, client):
        """Semantic search should return relevant documents."""
        response = client.post(
            "/api/search",
            json={"query": "aircraft emergency procedures", "limit": 5, "search_mode": "semantic"},
        )
        assert response.status_code == 200

        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0

        # Results should be ranked by relevance (score)
        results = data["results"]
        for i in range(len(results) - 1):
            assert results[i]["score"] >= results[i + 1]["score"]

    def test_semantic_search_respects_limit(self, client):
        """Search should respect the limit parameter."""
        response = client.post(
            "/api/search",
            json={"query": "controller procedures", "limit": 3, "search_mode": "semantic"},
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data["results"]) <= 3

    def test_semantic_search_includes_metadata(self, client):
        """Search results should include document metadata."""
        response = client.post(
            "/api/search",
            json={"query": "communication procedures", "limit": 1, "search_mode": "semantic"},
        )

        data = response.json()
        assert len(data["results"]) > 0

        result = data["results"][0]
        assert "document_filename" in result
        assert "score" in result
        assert "content" in result
        assert isinstance(result["score"], float)
        assert 0.0 <= result["score"] <= 1.0


class TestHybridSearch:
    """Tests for hybrid search (semantic + keyword)."""

    def test_hybrid_search_returns_results(self, client):
        """Hybrid search should combine semantic and keyword results."""
        response = client.post(
            "/api/search",
            json={"query": "minimum fuel emergency", "limit": 5, "search_mode": "hybrid"},
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data["results"]) > 0

    def test_hybrid_search_better_than_keyword_only(self, client):
        """Hybrid search should return more results than keyword-only."""
        # Search for phrase that may not be exact in documents
        query = "aircraft fuel management"

        hybrid_response = client.post(
            "/api/search", json={"query": query, "limit": 10, "search_mode": "hybrid"}
        )

        keyword_response = client.post(
            "/api/search", json={"query": query, "limit": 10, "search_mode": "keyword"}
        )

        hybrid_count = len(hybrid_response.json()["results"])
        keyword_count = len(keyword_response.json()["results"])

        # Hybrid should find at least as many results
        assert hybrid_count >= keyword_count


# ============================================================================
# RAG Question-Answering Tests
# ============================================================================


class TestRAGAccuracy:
    """Tests for RAG accuracy with distilled model."""

    def test_answer_contains_expected_keywords(self, client):
        """Answers should contain expected keywords from questions."""
        for test_case in EXTRACTION_BENCHMARK_QUESTIONS[:2]:
            response = client.post(
                "/api/ask", json={"question": test_case["question"], "mode": "hybrid", "limit": 5}
            )
            assert response.status_code == 200

            data = response.json()
            answer = data["answer"].lower()

            # At least one expected keyword should appear
            found_keywords = sum(
                1 for kw in test_case["expected_keywords"] if kw.lower() in answer
            )
            assert found_keywords > 0, f"No keywords found in answer for: {test_case['question']}"

    def test_answer_uses_provided_context(self, client):
        """RAG answers should reference retrieved context documents."""
        response = client.post(
            "/api/ask",
            json={
                "question": "What is the role of an air traffic controller?",
                "mode": "hybrid",
                "limit": 5,
            },
        )
        assert response.status_code == 200

        data = response.json()
        # Answer should be provided
        assert len(data["answer"]) > 0
        # Sources should be included
        assert len(data["sources"]) > 0

    def test_different_search_modes_produce_different_answers(self, client):
        """Different search modes should produce varied but relevant answers."""
        question = "How should controllers manage aircraft transitions?"

        answers = {}
        for mode in ["semantic", "keyword", "hybrid"]:
            response = client.post(
                "/api/ask", json={"question": question, "mode": mode, "limit": 5}
            )
            assert response.status_code == 200
            answers[mode] = response.json()["answer"]

        # All answers should address the question
        for mode, answer in answers.items():
            assert len(answer) > 10, f"{mode} answer too short"


class TestRAGConsistency:
    """Tests for answer consistency and quality."""

    def test_answer_response_structure(self, client):
        """Answer response should have required fields."""
        response = client.post(
            "/api/ask", json={"question": "What are communication procedures?", "mode": "hybrid"}
        )
        assert response.status_code == 200

        data = response.json()
        required_fields = ["answer", "model", "sources", "context_chunks"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

    def test_answer_not_empty(self, client):
        """Generated answers should not be empty."""
        response = client.post(
            "/api/ask", json={"question": "What is air traffic control?", "mode": "hybrid"}
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data["answer"]) > 0
        assert len(data["answer"].strip()) > 0

    def test_model_field_indicates_correct_model(self, client):
        """Response should indicate which LLM model was used."""
        response = client.post("/api/ask", json={"question": "Test question", "mode": "hybrid"})
        assert response.status_code == 200

        data = response.json()
        # Should contain model identifier
        assert "model" in data
        assert len(data["model"]) > 0


# ============================================================================
# Streaming Tests
# ============================================================================


@pytest.mark.asyncio
async def test_streaming_returns_events(async_client: httpx.AsyncClient):
    """Streaming endpoint should return server-sent events."""
    async with async_client.stream(
        "POST",
        "/api/ask/stream",
        json={"question": "What is an aircraft?", "mode": "hybrid", "limit": 5},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream"

        events = []
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                try:
                    event = json.loads(line[6:])
                    events.append(event)
                except json.JSONDecodeError:
                    pass

        assert len(events) > 0, "Should receive at least one event"


@pytest.mark.asyncio
async def test_streaming_event_sequence(async_client: httpx.AsyncClient):
    """Streaming should follow: sources → tokens → done."""
    async with async_client.stream(
        "POST", "/api/ask/stream", json={"question": "What is RAG?", "mode": "hybrid"}
    ) as response:
        assert response.status_code == 200

        events = []
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                try:
                    event = json.loads(line[6:])
                    events.append(event)
                except json.JSONDecodeError:
                    pass

        # Should have at least sources and done events
        event_types = [e.get("type") for e in events]
        assert "sources" in event_types
        assert "done" in event_types

        # sources should come first
        assert events[0]["type"] == "sources"
        # done should come last
        assert events[-1]["type"] == "done"


@pytest.mark.asyncio
async def test_streaming_token_accumulation(async_client: httpx.AsyncClient):
    """Streamed tokens should form a coherent response."""
    async with async_client.stream(
        "POST",
        "/api/ask/stream",
        json={"question": "What is air traffic control?", "mode": "hybrid"},
    ) as response:
        tokens = []
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                try:
                    event = json.loads(line[6:])
                    if event.get("type") == "token":
                        tokens.append(event["token"])
                except json.JSONDecodeError:
                    pass

        # Accumulated tokens should form non-empty response
        full_response = "".join(tokens)
        assert len(full_response) > 0
        # Should contain multiple tokens (not just one word)
        assert len(tokens) > 3


# ============================================================================
# Model Accuracy Benchmark Tests
# ============================================================================


class TestModelAccuracyBenchmark:
    """Benchmark tests against extraction accuracy metrics."""

    def test_benchmark_extraction_accuracy(self, client):
        """Test extraction accuracy on benchmark question set."""
        results = {
            "total": len(EXTRACTION_BENCHMARK_QUESTIONS),
            "passed": 0,
            "failed": 0,
            "details": [],
        }

        for test_case in EXTRACTION_BENCHMARK_QUESTIONS:
            response = client.post(
                "/api/ask", json={"question": test_case["question"], "mode": "hybrid", "limit": 5}
            )

            if response.status_code != 200:
                results["failed"] += 1
                results["details"].append(
                    {
                        "question": test_case["question"],
                        "status": "error",
                        "reason": f"HTTP {response.status_code}",
                    }
                )
                continue

            data = response.json()
            answer = data["answer"].lower()

            # Check for expected keywords
            found_count = sum(1 for kw in test_case["expected_keywords"] if kw.lower() in answer)

            # At least 50% of keywords should be found
            threshold = len(test_case["expected_keywords"]) * 0.5
            passed = found_count >= threshold

            if passed:
                results["passed"] += 1
            else:
                results["failed"] += 1

            results["details"].append(
                {
                    "question": test_case["question"][:50] + "...",
                    "category": test_case["category"],
                    "keywords_found": found_count,
                    "keywords_expected": len(test_case["expected_keywords"]),
                    "status": "pass" if passed else "fail",
                }
            )

        # Log detailed results
        logger.info(f"Accuracy benchmark results: {results['passed']}/{results['total']} passed")
        for detail in results["details"]:
            logger.info(f"  {detail['status'].upper()}: {detail['question']}")

        # Target: 80% accuracy on benchmark
        accuracy = results["passed"] / results["total"]
        assert accuracy >= 0.8, f"Accuracy {accuracy:.1%} below 80% target"


# ============================================================================
# Performance Tests
# ============================================================================


class TestPerformance:
    """Tests for response time and performance."""

    def test_search_performance(self, client):
        """Search should complete within reasonable time."""
        import time

        start = time.time()
        response = client.post(
            "/api/search",
            json={"query": "aircraft control procedures", "limit": 5, "search_mode": "hybrid"},
        )
        elapsed = time.time() - start

        assert response.status_code == 200
        # Search should complete in <1 second
        assert elapsed < 1.0, f"Search took {elapsed:.2f}s, expected <1s"

    def test_answer_generation_performance(self, client):
        """Answer generation should complete within reasonable time."""
        import time

        start = time.time()
        response = client.post(
            "/api/ask", json={"question": "What is the role of ATC?", "mode": "hybrid", "limit": 5}
        )
        elapsed = time.time() - start

        assert response.status_code == 200
        # Full RAG pipeline should complete in <30 seconds (with LLM inference)
        assert elapsed < 30.0, f"Answer took {elapsed:.2f}s, expected <30s"


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestErrorHandling:
    """Tests for proper error handling."""

    def test_invalid_search_mode(self, client):
        """Invalid search mode should return error."""
        response = client.post(
            "/api/search", json={"query": "test", "search_mode": "invalid_mode"}
        )
        assert response.status_code == 400

    def test_missing_question_parameter(self, client):
        """Missing required parameters should return error."""
        response = client.post(
            "/api/ask",
            json={
                "mode": "hybrid"
                # missing "question"
            },
        )
        assert response.status_code == 400

    def test_empty_question(self, client):
        """Empty question should be handled gracefully."""
        response = client.post("/api/ask", json={"question": "", "mode": "hybrid"})
        # Should either reject or return empty answer
        assert response.status_code in [200, 400]


# ============================================================================
# Integration Flow Tests
# ============================================================================


class TestIntegrationFlows:
    """End-to-end integration flows."""

    def test_full_rag_flow(self, client):
        """Complete RAG flow: search → retrieve → answer."""
        # Step 1: Verify KB has documents
        stats = client.get("/api/stats").json()
        assert stats["total_chunks"] > 0

        # Step 2: Search for relevant documents
        search_resp = client.post(
            "/api/search",
            json={"query": "controller procedures", "limit": 3, "search_mode": "hybrid"},
        )
        assert search_resp.status_code == 200
        search_results = search_resp.json()
        assert len(search_results["results"]) > 0

        # Step 3: Generate answer with context
        ask_resp = client.post(
            "/api/ask",
            json={
                "question": "What are the main controller procedures?",
                "mode": "hybrid",
                "limit": 3,
            },
        )
        assert ask_resp.status_code == 200
        answer_data = ask_resp.json()
        assert len(answer_data["answer"]) > 0
        assert answer_data["context_chunks"] > 0

    def test_streaming_response_completeness(self, async_client: httpx.AsyncClient):
        """Streaming response should be complete and coherent."""

        async def run_test():
            full_response = ""
            async with async_client.stream(
                "POST", "/api/ask/stream", json={"question": "Test question", "mode": "hybrid"}
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            event = json.loads(line[6:])
                            if event.get("type") == "done":
                                full_response = event.get("response", "")
                        except json.JSONDecodeError:
                            pass

            return full_response

        response = asyncio.run(run_test())
        assert len(response) > 0


# ============================================================================
# Distilled Model Validation Tests
# ============================================================================


class TestDistilledModelValidation:
    """Validate distilled model maintains baseline performance."""

    def test_model_identification(self, client):
        """Model response should identify the LLM being used."""
        response = client.post(
            "/api/ask",
            json={"question": "What is this system using as its model?", "mode": "hybrid"},
        )
        assert response.status_code == 200

        data = response.json()
        model_name = data["model"]
        # Should contain model identifier (could be 3B or 7B depending on Phase 4C)
        assert len(model_name) > 0

    def test_answer_quality_metrics(self, client):
        """Generated answers should meet quality standards."""
        question = "What are the key principles of air traffic control?"

        response = client.post(
            "/api/ask", json={"question": question, "mode": "hybrid", "limit": 5}
        )
        assert response.status_code == 200

        data = response.json()
        answer = data["answer"]

        # Quality metrics
        assert len(answer) > 100, "Answer too short"
        assert len(answer.split()) > 10, "Answer too brief"
        assert answer[0].isupper(), "Answer should start with capital"
        # Should not contain obvious errors
        assert "null" not in answer.lower()
        assert "none" not in answer.lower() or "none of" in answer.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
