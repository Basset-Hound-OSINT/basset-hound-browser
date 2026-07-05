"""Tests for Knowledge Base Routing Layer

Tests:
- Router interface
- StaticRouter (pattern-based routing)
- LLMRouter (semantic routing)
- BroadcastRouter (all KBs)
- HybridRouter (combined routing)
- SearchPipeline (unified interface)
"""

from unittest.mock import AsyncMock

import pytest
from app.kb import SearchMode
from app.registry import KnowledgeRegistry
from app.router import (
    BroadcastRouter,
    HybridRouter,
    KnowledgeRouter,
    LLMRouter,
    RoutingDecision,
    StaticRouter,
)
from app.search_pipeline import SearchPipeline


class TestRoutingDecision:
    """Test RoutingDecision model."""

    def test_routing_decision_creation(self):
        """Should create decision with KB names, confidence, reason."""
        decision = RoutingDecision(
            kb_names=["atc", "primary"],
            confidence=0.9,
            reason="Matched ATC pattern",
        )

        assert decision.kb_names == ["atc", "primary"]
        assert decision.confidence == 0.9
        assert "ATC pattern" in decision.reason


class TestBroadcastRouter:
    """Test BroadcastRouter (search all KBs)."""

    @pytest.fixture
    async def router(self):
        """Create test broadcast router."""
        registry = KnowledgeRegistry()
        await registry.create("kb1", "keyword-only")
        await registry.create("kb2", "keyword-only")

        router = BroadcastRouter(registry)
        await router.initialize()
        yield router
        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_broadcast_routes_to_all(self, router):
        """Should route to all KBs."""
        decision = await router.route("any query")

        assert "kb1" in decision.kb_names
        assert "kb2" in decision.kb_names
        assert decision.confidence == 1.0

    @pytest.mark.asyncio
    async def test_broadcast_with_no_kbs(self):
        """Should handle empty registry."""
        registry = KnowledgeRegistry()
        router = BroadcastRouter(registry)
        await router.initialize()

        decision = await router.route("query")
        assert decision.kb_names == []


class TestStaticRouter:
    """Test StaticRouter (pattern-based routing)."""

    @pytest.fixture
    async def router(self):
        """Create test static router."""
        registry = KnowledgeRegistry()
        await registry.create("atc", "keyword-only")
        await registry.create("research", "keyword-only")
        await registry.create("primary", "keyword-only")

        rules = [
            {"pattern": r"LAHSO|landing|ATC", "kb": "atc", "confidence": 0.95},
            {"pattern": r"neural|transformer|learning", "kb": "research", "confidence": 0.9},
            {"pattern": ".*", "kb": "primary", "confidence": 0.5},  # fallback
        ]

        router = StaticRouter(registry, rules)
        await router.initialize()
        yield router
        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_static_matches_pattern(self, router):
        """Should match query to KB pattern."""
        decision = await router.route("What is LAHSO?")

        assert decision.kb_names == ["atc"]
        assert decision.confidence == 0.95

    @pytest.mark.asyncio
    async def test_static_matches_second_pattern(self, router):
        """Should match different pattern."""
        decision = await router.route("Explain transformer architectures")

        assert decision.kb_names == ["research"]
        assert decision.confidence == 0.9

    @pytest.mark.asyncio
    async def test_static_falls_back_to_default(self, router):
        """Should use default pattern when no match."""
        decision = await router.route("random unrelated question")

        assert decision.kb_names == ["primary"]
        assert decision.confidence == 0.5

    @pytest.mark.asyncio
    async def test_static_case_insensitive(self, router):
        """Pattern matching should be case-insensitive."""
        decision = await router.route("what is lahso?")  # lowercase

        assert decision.kb_names == ["atc"]

    @pytest.mark.asyncio
    async def test_static_invalid_pattern(self):
        """Should handle invalid regex patterns."""
        registry = KnowledgeRegistry()
        await registry.create("kb", "keyword-only")

        rules = [
            {"pattern": "(?P<invalid)", "kb": "kb"},  # invalid regex
            {"pattern": ".*", "kb": "kb"},  # fallback
        ]

        router = StaticRouter(registry, rules)
        await router.initialize()

        # Should not crash, fallback works
        decision = await router.route("test")
        assert decision.kb_names == ["kb"]

        await registry.shutdown_all()


class TestLLMRouter:
    """Test LLMRouter (semantic routing)."""

    @pytest.fixture
    async def router(self):
        """Create test LLM router."""
        registry = KnowledgeRegistry()
        await registry.create("atc", "keyword-only")
        await registry.create("research", "keyword-only")

        # Mock LLM client
        llm_client = AsyncMock()
        llm_client.generate = AsyncMock(return_value="atc")

        router = LLMRouter(
            registry,
            llm_client=llm_client,
            strategy="single",
        )
        await router.initialize()
        yield router
        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_llm_single_strategy(self, router):
        """Should select single KB with LLM."""
        decision = await router.route("How do I request landing clearance?")

        assert len(decision.kb_names) == 1
        assert decision.kb_names[0] in ["atc", "research"]
        assert decision.confidence > 0.7

    @pytest.mark.asyncio
    async def test_llm_with_single_kb(self):
        """Should return only KB if just one available."""
        registry = KnowledgeRegistry()
        await registry.create("only", "keyword-only")

        llm_client = AsyncMock()
        router = LLMRouter(registry, llm_client, strategy="single")
        await router.initialize()

        decision = await router.route("any query")
        assert decision.kb_names == ["only"]
        assert decision.confidence == 0.9

        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_llm_invalid_response(self):
        """Should fallback when LLM returns invalid KB."""
        registry = KnowledgeRegistry()
        await registry.create("kb1", "keyword-only")
        await registry.create("kb2", "keyword-only")

        llm_client = AsyncMock()
        llm_client.generate = AsyncMock(return_value="nonexistent")

        router = LLMRouter(registry, llm_client, strategy="single")
        await router.initialize()

        decision = await router.route("test")
        # Should fallback to first available KB
        assert len(decision.kb_names) >= 1
        assert decision.confidence < 0.7  # Lower confidence due to fallback

        await registry.shutdown_all()


class TestHybridRouter:
    """Test HybridRouter (combined routing)."""

    @pytest.fixture
    async def router(self):
        """Create test hybrid router."""
        registry = KnowledgeRegistry()
        await registry.create("atc", "keyword-only")
        await registry.create("research", "keyword-only")

        # Create sub-routers
        static = StaticRouter(
            registry,
            rules=[
                {"pattern": r"LAHSO", "kb": "atc", "confidence": 0.95},
                {"pattern": ".*", "kb": "research", "confidence": 0.5},
            ],
        )
        await static.initialize()

        broadcast = BroadcastRouter(registry)
        await broadcast.initialize()

        router = HybridRouter(registry, routers=[(static, 1.0), (broadcast, 0.1)])
        await router.initialize()
        yield router
        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_hybrid_prefers_higher_weight(self, router):
        """Should prefer higher-weighted router."""
        decision = await router.route("What is LAHSO?")

        # Static router (weight=1.0) matches with 0.95 confidence
        # Broadcast router (weight=0.1) matches all with 0.1 confidence
        # Should choose static's decision
        assert "atc" in decision.kb_names
        assert decision.confidence > 0.5

    @pytest.mark.asyncio
    async def test_hybrid_fallback(self):
        """Should handle failed routers gracefully."""
        registry = KnowledgeRegistry()
        await registry.create("kb", "keyword-only")

        # Create router that will fail
        bad_router = AsyncMock(spec=KnowledgeRouter)
        bad_router.route = AsyncMock(side_effect=Exception("Router failed"))

        good_router = BroadcastRouter(registry)
        await good_router.initialize()

        hybrid = HybridRouter(registry, routers=[(bad_router, 0.5), (good_router, 1.0)])
        await hybrid.initialize()

        # Should still work with good router
        decision = await hybrid.route("test")
        assert len(decision.kb_names) > 0

        await registry.shutdown_all()


class TestSearchPipeline:
    """Test SearchPipeline (unified search interface)."""

    @pytest.fixture
    async def pipeline(self):
        """Create test search pipeline."""
        registry = KnowledgeRegistry()

        # Create test KBs
        atc_kb = await registry.create("atc", "keyword-only")
        research_kb = await registry.create("research", "keyword-only")

        # Add some test data
        from app.kb import Document

        doc1 = Document(
            filename="atc.txt",
            filepath="/atc.txt",
            file_type="txt",
            content_hash="hash1",
            file_size=100,
        )
        await atc_kb.ingest(doc1, ["LAHSO clearance", "Landing procedure"])

        doc2 = Document(
            filename="ml.txt",
            filepath="/ml.txt",
            file_type="txt",
            content_hash="hash2",
            file_size=100,
        )
        await research_kb.ingest(doc2, ["Neural network", "Transformer architecture"])

        # Create broadcast router and pipeline
        router = BroadcastRouter(registry)
        await router.initialize()

        pipeline = SearchPipeline(registry, router)
        yield pipeline
        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_pipeline_search(self, pipeline):
        """Should search using router."""
        results = await pipeline.search("LAHSO", mode=SearchMode.KEYWORD, limit=10)

        # Should have results (broadcast searches all KBs)
        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_pipeline_search_specific(self, pipeline):
        """Should search specific KB."""
        results = await pipeline.search_specific(
            "atc",
            query="LAHSO",
            mode=SearchMode.KEYWORD,
        )

        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_pipeline_search_all(self, pipeline):
        """Should search all KBs."""
        results = await pipeline.search_all("LAHSO", mode=SearchMode.KEYWORD)

        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_pipeline_merge_results(self, pipeline):
        """Should merge results from multiple KBs."""
        # Search should combine results from both KBs
        results = await pipeline.search("", mode=SearchMode.KEYWORD, limit=100)

        # Total results should be sum of both KBs
        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_pipeline_nonexistent_kb(self, pipeline):
        """Should handle missing KB gracefully."""
        results = await pipeline.search_specific(
            "nonexistent",
            query="test",
            mode=SearchMode.KEYWORD,
        )

        assert results == []

    @pytest.mark.asyncio
    async def test_pipeline_estimate_routing(self, pipeline):
        """Should estimate routing decision."""
        estimate = await pipeline.estimate_routing("test query")

        assert "selected_kbs" in estimate
        assert "confidence" in estimate
        assert "reason" in estimate
        assert len(estimate["selected_kbs"]) > 0  # Broadcast searches all


class TestStaticRouterEdgeCases:
    """Test StaticRouter edge cases."""

    @pytest.mark.asyncio
    async def test_empty_rules(self):
        """Should handle empty rules gracefully."""
        registry = KnowledgeRegistry()
        await registry.create("kb", "keyword-only")

        router = StaticRouter(registry, rules=[])
        await router.initialize()

        decision = await router.route("test")
        # Should have default rule
        assert len(decision.kb_names) > 0

        await registry.shutdown_all()

    @pytest.mark.asyncio
    async def test_nonexistent_kb_in_rules(self):
        """Should skip rules pointing to nonexistent KBs."""
        registry = KnowledgeRegistry()
        await registry.create("existing", "keyword-only")

        rules = [
            {"pattern": "test", "kb": "nonexistent"},
            {"pattern": ".*", "kb": "existing"},
        ]

        router = StaticRouter(registry, rules)
        await router.initialize()

        # Should skip nonexistent and use fallback
        decision = await router.route("test")
        assert decision.kb_names == ["existing"]

        await registry.shutdown_all()
