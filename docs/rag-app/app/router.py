"""Knowledge Base Router — Intelligent KB Selection

Routes queries to appropriate knowledge base(s) based on:
- Static configuration (pattern matching)
- LLM-based routing (semantic understanding)
- Broadcast routing (search all KBs)
- Custom routing logic

v2 gateway contract (app/api_v2.py, verified 2026-07-04):
- ``initialize_api`` installs **BroadcastRouter as the default** router.
- Routers are consulted ONLY for ``kb=None`` requests (``pipeline.search``).
  Explicit selection bypasses routing entirely:
  ``kb="name"`` → ``search_specific``, ``kb=["a","b"]`` → per-KB
  ``search_specific``/``search_many``, ``kb="all"`` → ``search_all``.
- A RoutingDecision spanning >1 KB makes SearchPipeline coerce the search
  mode to SEMANTIC for cross-KB score comparability (see search_pipeline).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .registry import KnowledgeRegistry

logger = logging.getLogger(__name__)


@dataclass
class RoutingDecision:
    """Result of routing logic."""

    kb_names: list[str]  # Which KBs to search
    confidence: float  # Confidence in decision (0.0-1.0)
    reason: str  # Why these KBs were selected


class KnowledgeRouter(ABC):
    """Abstract base class for KB routing strategies.

    A router decides which knowledge base(s) to search given a query.
    This enables multi-KB systems to intelligently distribute queries.
    """

    @abstractmethod
    async def route(self, query: str) -> RoutingDecision:
        """Route a query to one or more knowledge bases.

        Args:
            query: User query string

        Returns:
            RoutingDecision with KB names, confidence, and reason
        """
        pass

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the router (load configs, models, etc.)."""
        pass


class BroadcastRouter(KnowledgeRouter):
    """Route to all available knowledge bases.

    Useful when:
    - You want comprehensive search across all domains
    - Query intent is unclear
    - Merging results from multiple sources
    """

    def __init__(self, registry: KnowledgeRegistry):
        """Initialize broadcast router.

        Args:
            registry: Knowledge registry to get list of KBs
        """
        self.registry = registry

    async def initialize(self) -> None:
        """No initialization needed for broadcast."""
        logger.info("BroadcastRouter initialized")

    async def route(self, query: str) -> RoutingDecision:
        """Route to all KBs.

        Args:
            query: User query (unused)

        Returns:
            RoutingDecision routing to all available KBs
        """
        kb_names = await self.registry.list()

        if not kb_names:
            return RoutingDecision(
                kb_names=[],
                confidence=0.0,
                reason="No knowledge bases registered",
            )

        return RoutingDecision(
            kb_names=kb_names,
            confidence=1.0,  # 100% confident: search all
            reason=f"Broadcast to all {len(kb_names)} KBs: {', '.join(kb_names)}",
        )


class StaticRouter(KnowledgeRouter):
    """Route based on static configuration rules.

    Matches query patterns to KB names using regex or keyword matching.

    Example config:
        rules = [
            {"pattern": r"LAHSO|landing|approach", "kb": "atc", "confidence": 0.9},
            {"pattern": r"neural|transformer|attention", "kb": "research", "confidence": 0.8},
            {"pattern": r".*", "kb": "primary", "confidence": 0.5},  # fallback
        ]
    """

    def __init__(self, registry: KnowledgeRegistry, rules: list[dict] | None = None):
        """Initialize static router.

        Args:
            registry: Knowledge registry
            rules: List of routing rules (pattern → KB name)
                  Each rule: {"pattern": str, "kb": str, "confidence": float}
        """
        self.registry = registry
        self.rules = rules or [{"pattern": ".*", "kb": "primary", "confidence": 0.5}]  # default
        self._compiled_rules: list[tuple[str, str, float]] | None = None

    async def initialize(self) -> None:
        """Compile regex patterns for efficiency."""
        import re

        compiled = []
        for rule in self.rules:
            try:
                pattern = re.compile(rule["pattern"], re.IGNORECASE)
                kb = rule["kb"]
                confidence = rule.get("confidence", 0.7)
                compiled.append((pattern, kb, confidence))
            except Exception as e:
                logger.warning("Failed to compile pattern '%s': %s", rule["pattern"], e)

        self._compiled_rules = compiled
        logger.info("StaticRouter initialized with %d rules", len(compiled))

    async def route(self, query: str) -> RoutingDecision:
        """Route based on query pattern matching.

        Args:
            query: User query

        Returns:
            RoutingDecision with first matching KB
        """
        if not self._compiled_rules:
            await self.initialize()

        # Find first matching rule
        for pattern, kb, confidence in self._compiled_rules:
            if pattern.search(query):
                # Verify KB exists
                try:
                    await self.registry.get(kb)
                    return RoutingDecision(
                        kb_names=[kb],
                        confidence=confidence,
                        reason=f"Matched pattern '{pattern.pattern}' → KB '{kb}'",
                    )
                except KeyError:
                    logger.warning("Pattern matched KB '%s' but KB not found", kb)

        # Fallback: prefer 'primary' when registered, else first available.
        # Never return a KB name that isn't actually registered (the pipeline
        # would just log a KeyError and yield zero results).
        kb_names = await self.registry.list()
        if not kb_names:
            return RoutingDecision(
                kb_names=[],
                confidence=0.0,
                reason="No pattern matched and no KBs registered",
            )
        kb = "primary" if "primary" in kb_names else kb_names[0]

        return RoutingDecision(
            kb_names=[kb],
            confidence=0.3,
            reason=f"No pattern matched; fell back to '{kb}'",
        )


class LLMRouter(KnowledgeRouter):
    """Route based on LLM analysis of query.

    Uses an LLM to understand query intent and select appropriate KB(s).

    Supported strategies:
    - Single KB: LLM picks one best KB
    - Multi KB: LLM picks multiple relevant KBs
    - Scoring: LLM scores all KBs by relevance
    """

    def __init__(
        self,
        registry: KnowledgeRegistry,
        llm_client=None,
        strategy: str = "single",
    ):
        """Initialize LLM router.

        Args:
            registry: Knowledge registry
            llm_client: Ollama or other LLM client (from app.llm)
            strategy: "single" (pick 1 KB) or "multi" (pick multiple)
        """
        self.registry = registry
        self.llm_client = llm_client
        self.strategy = strategy

    async def initialize(self) -> None:
        """Initialize LLM client if needed."""
        if self.llm_client is None:
            from .llm import OllamaClient

            self.llm_client = OllamaClient()
        logger.info("LLMRouter initialized with strategy='%s'", self.strategy)

    async def route(self, query: str) -> RoutingDecision:
        """Route using LLM analysis.

        Args:
            query: User query

        Returns:
            RoutingDecision with LLM-selected KBs
        """
        kb_names = await self.registry.list()

        if not kb_names:
            return RoutingDecision(
                kb_names=[],
                confidence=0.0,
                reason="No KBs available",
            )

        if len(kb_names) == 1:
            return RoutingDecision(
                kb_names=kb_names,
                confidence=0.9,
                reason=f"Only KB available: {kb_names[0]}",
            )

        # Use LLM to analyze query and select KB(s)
        if self.strategy == "single":
            return await self._route_single(query, kb_names)
        elif self.strategy == "multi":
            return await self._route_multi(query, kb_names)
        else:
            raise ValueError(f"Unknown strategy: {self.strategy}")

    async def _route_single(self, query: str, kb_names: list[str]) -> RoutingDecision:
        """Use LLM to pick best KB.

        Args:
            query: User query
            kb_names: Available KB names

        Returns:
            RoutingDecision with single KB
        """
        prompt = f"""Given this query, which knowledge base would be most helpful?

Query: {query}

Available knowledge bases:
{chr(10).join(f"- {name}" for name in kb_names)}

Reply with ONLY the KB name (no explanation)."""

        try:
            response = await self.llm_client.generate(prompt, max_tokens=10)
            selected_kb = response.strip().lower()

            # Verify KB exists
            if selected_kb in kb_names:
                return RoutingDecision(
                    kb_names=[selected_kb],
                    confidence=0.8,
                    reason=f"LLM selected: {selected_kb}",
                )

            # Fallback if LLM returned invalid KB
            fallback = kb_names[0]
            return RoutingDecision(
                kb_names=[fallback],
                confidence=0.5,
                reason=f"LLM returned invalid KB '{selected_kb}'; fell back to '{fallback}'",
            )
        except Exception as e:
            logger.exception("LLM routing failed: %s", e)
            return RoutingDecision(
                kb_names=[kb_names[0]],
                confidence=0.3,
                reason=f"LLM routing failed; fell back to '{kb_names[0]}'",
            )

    async def _route_multi(self, query: str, kb_names: list[str]) -> RoutingDecision:
        """Use LLM to pick multiple relevant KBs.

        Args:
            query: User query
            kb_names: Available KB names

        Returns:
            RoutingDecision with multiple KBs
        """
        prompt = f"""Given this query, which knowledge bases would be helpful?

Query: {query}

Available knowledge bases:
{chr(10).join(f"- {name}" for name in kb_names)}

Reply with KB names separated by commas (no explanation)."""

        try:
            response = await self.llm_client.generate(prompt, max_tokens=100)
            selected_kbs = [kb.strip().lower() for kb in response.split(",")]

            # Filter to valid KBs
            valid_kbs = [kb for kb in selected_kbs if kb in kb_names]

            if valid_kbs:
                return RoutingDecision(
                    kb_names=valid_kbs,
                    confidence=0.75,
                    reason=f"LLM selected: {', '.join(valid_kbs)}",
                )

            # Fallback: search all
            return RoutingDecision(
                kb_names=kb_names,
                confidence=0.4,
                reason="LLM returned invalid KBs; fell back to all KBs",
            )
        except Exception as e:
            logger.exception("LLM multi-routing failed: %s", e)
            return RoutingDecision(
                kb_names=kb_names,
                confidence=0.3,
                reason="LLM routing failed; fell back to all KBs",
            )


class HybridRouter(KnowledgeRouter):
    """Combine multiple routers with confidence weighting.

    Example: StaticRouter (high confidence matches) + LLMRouter (fallback)
    """

    def __init__(
        self,
        registry: KnowledgeRegistry,
        routers: list[tuple[KnowledgeRouter, float]] | None = None,
    ):
        """Initialize hybrid router.

        Args:
            registry: Knowledge registry
            routers: List of (router, weight) tuples
                    Weight determines priority (higher = higher priority)
        """
        self.registry = registry
        self.routers = routers or []

    async def initialize(self) -> None:
        """Initialize all sub-routers."""
        for router, _ in self.routers:
            await router.initialize()
        logger.info("HybridRouter initialized with %d routers", len(self.routers))

    async def route(self, query: str) -> RoutingDecision:
        """Route using weighted combination of routers.

        Args:
            query: User query

        Returns:
            RoutingDecision from highest-confidence router
        """
        if not self.routers:
            # Fallback: broadcast to all
            broadcast = BroadcastRouter(self.registry)
            return await broadcast.route(query)

        # Get decisions from all routers
        decisions = []
        for router, weight in self.routers:
            try:
                decision = await router.route(query)
                # Weight the confidence on a COPY — never mutate a
                # sub-router's decision object (it may be cached/reused).
                decisions.append(
                    RoutingDecision(
                        kb_names=decision.kb_names,
                        confidence=decision.confidence * weight,
                        reason=decision.reason,
                    )
                )
            except Exception as e:
                logger.warning("Router failed: %s", e)

        # Return highest-confidence decision
        if decisions:
            best = max(decisions, key=lambda d: d.confidence)
            return best

        # Fallback
        return RoutingDecision(
            kb_names=[],
            confidence=0.0,
            reason="All routers failed",
        )
