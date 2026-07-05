"""Search Pipeline — Unified Multi-KB Search Interface

Orchestrates search across one or more knowledge bases with:
- Router-based KB selection
- Embedding fallback (semantic → keyword)
- Result merging and ranking
- Error handling and logging

Cross-KB merge soundness (multi-KB activation plan, 2026-07-04):

- **Semantic-first score comparability.** All KBs share ONE embedding space
  (enforced per-KB by the registry dimension guard), so raw cosine similarity
  is directly comparable across KBs. Per-KB scores from other modes are NOT:
  hybrid RRF scores are rank-only (~1/(k+rank), per-KB ranks), and keyword
  ts_rank is corpus-dependent. Therefore every multi-KB path (>1 KB searched)
  coerces the requested mode to SEMANTIC (plan R9). Single-KB requests keep
  all three modes. Gateways surface the coercion as a ``mode_used`` advisory
  by calling :meth:`SearchPipeline.coerce_multi_kb_mode` with the same
  arguments (it is deterministic).
- **Per-mode normalization fallback.** Results that carry no cosine signal
  (e.g. a KB without embeddings that fell back to keyword search) are merged
  on a normalized [0, 1] proxy (``SearchResult.normalized`` when present,
  else the raw score clamped to [0, 1]) so they rank on the same scale as
  cosine instead of on incomparable raw magnitudes.
- **KB namespacing.** Chunk/document ids autoincrement PER DATABASE and
  collide across KBs; global uniqueness is the ``(kb, chunk_id)`` pair.
  ``_search_kb`` stamps ``result.kb = kb.name`` on every result it returns so
  v2 responses can emit the ``kb`` field and build globally-unique citations
  ``[[RAG:{kb}:{path}#{chunk}@{score}]]``.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .kb import SearchMode
from .search import SearchResult

if TYPE_CHECKING:
    from .embeddings import EmbeddingService
    from .registry import KnowledgeRegistry
    from .router import KnowledgeRouter

logger = logging.getLogger(__name__)


class SearchPipeline:
    """Unified search interface for multi-KB systems.

    Handles:
    - Query routing to appropriate KBs
    - Embedding computation and fallback
    - Search execution with error handling
    - Result merging and ranking
    """

    def __init__(
        self,
        registry: KnowledgeRegistry,
        router: KnowledgeRouter,
        embedding_service: EmbeddingService | None = None,
    ):
        """Initialize search pipeline.

        Args:
            registry: Knowledge registry
            router: Router for KB selection
            embedding_service: For computing query embeddings
        """
        self.registry = registry
        self.router = router
        self.embedding_service = embedding_service

    @staticmethod
    def coerce_multi_kb_mode(mode: str, kb_count: int) -> str:
        """Return the mode actually executed for a search spanning `kb_count` KBs.

        Multi-KB (>1) searches force SEMANTIC: raw cosine in the shared
        embedding space is the only score directly comparable across KBs
        (per-KB hybrid RRF and keyword ts_rank are not). Single-KB searches
        keep the requested mode untouched.

        Gateways (api_v2) should call this with the request's mode and the
        number of KBs searched to populate the ``mode_used`` advisory field;
        it is deterministic and side-effect free.

        Args:
            mode: Requested SearchMode
            kb_count: Number of KBs the search spans

        Returns:
            The effective SearchMode (SEMANTIC when coerced, else `mode`)
        """
        if kb_count > 1 and mode != SearchMode.SEMANTIC:
            return SearchMode.SEMANTIC
        return mode

    async def search(
        self,
        query: str,
        mode: str = SearchMode.HYBRID,
        limit: int = 10,
        embedding_required: bool = False,
    ) -> list[SearchResult]:
        """Execute multi-KB search with intelligent routing.

        When the router selects more than one KB, the mode is coerced to
        SEMANTIC for cross-KB score comparability (see coerce_multi_kb_mode).

        Args:
            query: User query
            mode: SearchMode.SEMANTIC, KEYWORD, or HYBRID
            limit: Max results per KB
            embedding_required: Fail if embeddings unavailable (vs fallback to keyword)

        Returns:
            Merged and ranked search results from all selected KBs
        """
        # Step 1: Route query to KB(s)
        decision = await self.router.route(query)

        if not decision.kb_names:
            logger.warning("Router returned no KBs for query: %s", query)
            return []

        logger.info(
            "Routing query to KBs: %s (confidence=%.2f, reason=%s)",
            decision.kb_names,
            decision.confidence,
            decision.reason,
        )

        # Steps 2-4 (coerce mode, embed once, fan out, merge) are shared with
        # the explicit kb=[list] path.
        return await self.search_many(
            kb_names=decision.kb_names,
            query=query,
            mode=mode,
            limit=limit,
            embedding_required=embedding_required,
        )

    async def search_many(
        self,
        kb_names: list[str],
        query: str,
        mode: str = SearchMode.HYBRID,
        limit: int = 10,
        embedding_required: bool = False,
    ) -> list[SearchResult]:
        """Search an explicit list of KBs and merge soundly (v2 kb=[...] path).

        This is the sound entry point for the gateway's ``kb=["a","b"]``
        contract: mode is coerced ONCE for the whole federation (not per KB),
        the query embedding is computed ONCE, per-KB failures are logged and
        skipped (one bad KB never aborts the federation), and results are
        merged on cross-KB-comparable scores with each hit stamped with its
        source ``kb``.

        Args:
            kb_names: Names of KBs to search (order does not affect ranking)
            query: User query
            mode: Requested SearchMode (coerced to SEMANTIC when len(kb_names) > 1)
            limit: Max results per KB
            embedding_required: Fail if embeddings unavailable (vs fallback to keyword)

        Returns:
            Merged, ranked, kb-stamped results
        """
        if not kb_names:
            return []

        effective_mode = self.coerce_multi_kb_mode(mode, len(kb_names))
        if effective_mode != mode:
            logger.info(
                "Multi-KB search across %d KBs: mode '%s' coerced to '%s' "
                "for cross-KB score comparability (mode_used advisory)",
                len(kb_names),
                mode,
                effective_mode,
            )

        # Compute the query embedding ONCE for the whole fan-out.
        query_embedding = None
        if effective_mode in [SearchMode.SEMANTIC, SearchMode.HYBRID]:
            query_embedding = await self._get_embedding(query, embedding_required)

        all_results = []
        for kb_name in kb_names:
            try:
                kb = await self.registry.get(kb_name)
                results = await self._search_kb(
                    kb=kb,
                    query=query,
                    mode=effective_mode,
                    embedding=query_embedding,
                    limit=limit,
                    embedding_required=embedding_required,
                )
                all_results.extend(results)
                logger.info("KB '%s': found %d results", kb_name, len(results))
            except Exception as e:
                logger.exception("Search failed for KB '%s': %s", kb_name, e)

        merged = self._merge_results(all_results)

        logger.info("Pipeline complete: %d total results", len(merged))
        return merged

    async def search_specific(
        self,
        kb_name: str,
        query: str,
        mode: str = SearchMode.HYBRID,
        limit: int = 10,
        embedding_required: bool = False,
    ) -> list[SearchResult]:
        """Search a specific KB (bypass routing; v2 kb="name" path).

        Single-KB searches keep ALL three modes (semantic/keyword/hybrid) —
        no coercion, since cross-KB score comparability is not in play.
        Results are still kb-stamped for citation namespacing.

        Args:
            kb_name: Name of KB to search
            query: User query
            mode: SearchMode
            limit: Max results
            embedding_required: Fail if embeddings unavailable

        Returns:
            Search results from specified KB
        """
        try:
            kb = await self.registry.get(kb_name)
        except KeyError:
            logger.error("KB '%s' not found", kb_name)
            return []

        query_embedding = None
        if mode in [SearchMode.SEMANTIC, SearchMode.HYBRID]:
            query_embedding = await self._get_embedding(query, embedding_required)

        return await self._search_kb(
            kb=kb,
            query=query,
            mode=mode,
            embedding=query_embedding,
            limit=limit,
            embedding_required=embedding_required,
        )

    async def search_all(
        self,
        query: str,
        mode: str = SearchMode.HYBRID,
        limit: int = 10,
    ) -> list[SearchResult]:
        """Search all available KBs (broadcast; v2 kb="all" path).

        Mode is coerced to SEMANTIC when more than one KB is registered
        (see coerce_multi_kb_mode); the query embedding is computed once
        for the whole fan-out.

        Args:
            query: User query
            mode: SearchMode
            limit: Max results per KB

        Returns:
            Merged results from all KBs
        """
        kb_names = await self.registry.list()
        merged = await self.search_many(
            kb_names=kb_names,
            query=query,
            mode=mode,
            limit=limit,
        )
        logger.info("Broadcast search: %d results from %d KBs", len(merged), len(kb_names))
        return merged

    # -- Private methods --

    async def _get_embedding(
        self, query: str, embedding_required: bool = False
    ) -> list[float] | None:
        """Get query embedding with fallback.

        Args:
            query: Text to embed
            embedding_required: Raise error if embedding unavailable

        Returns:
            Embedding vector or None if not available
        """
        if self.embedding_service is None:
            if embedding_required:
                raise ValueError("Embedding required but embedding_service not configured")
            logger.warning("Embedding service not available; semantic search will be skipped")
            return None

        try:
            embedding = await self.embedding_service.embed_text(query, task="search_query")
            return embedding
        except Exception as e:
            if embedding_required:
                logger.exception("Failed to compute embedding")
                raise
            logger.warning("Embedding computation failed: %s; will use keyword search", e)
            return None

    async def _search_kb(
        self,
        kb,
        query: str,
        mode: str,
        embedding: list[float] | None,
        limit: int,
        embedding_required: bool,
    ) -> list[SearchResult]:
        """Search a single KB with fallback logic.

        Every returned result is stamped with ``result.kb = kb.name`` so the
        (kb, chunk_id) pair is globally unique across KBs whose per-database
        autoincrement ids collide (v2 citation namespacing).

        Args:
            kb: KnowledgeBase instance
            query: User query
            mode: SearchMode
            embedding: Query embedding (or None)
            limit: Max results
            embedding_required: Fail if embeddings needed but unavailable

        Returns:
            Search results (kb-stamped)
        """
        # Handle semantic/hybrid search without embeddings
        if mode in [SearchMode.SEMANTIC, SearchMode.HYBRID] and embedding is None:
            if embedding_required:
                raise ValueError(f"Mode {mode} requires embeddings but none available")

            # Check if KB supports keyword search as fallback
            if kb.supports_keyword_search():
                logger.info("KB doesn't have embeddings; falling back to keyword search")
                return self._stamp_kb(
                    await kb.search(query, SearchMode.KEYWORD, limit), kb.name
                )
            else:
                logger.warning("KB doesn't support keyword search either; skipping")
                return []

        # Handle semantic search on KB without embedding support
        if mode == SearchMode.SEMANTIC and not kb.supports_embedding():
            if embedding_required:
                raise ValueError(f"KB '{kb.name}' doesn't support embeddings")

            if kb.supports_keyword_search():
                logger.info("KB doesn't support semantic search; using keyword")
                return self._stamp_kb(
                    await kb.search(query, SearchMode.KEYWORD, limit), kb.name
                )
            else:
                return []

        # Execute search
        try:
            results = await kb.search(
                query=query,
                mode=mode,
                limit=limit,
                embedding=embedding,
            )
            return self._stamp_kb(results, kb.name)
        except Exception:
            logger.exception("Search failed for KB '%s'", kb.name)
            return []

    @staticmethod
    def _stamp_kb(results: list[SearchResult], kb_name: str) -> list[SearchResult]:
        """Stamp each result with its source KB name (citation namespacing).

        Chunk/document ids autoincrement per database and collide across KBs;
        ``(kb, chunk_id)`` is the globally unique identifier. The stamp is
        additive (plain attribute on the SearchResult dataclass) so v1
        callers and result equality are unaffected; a pre-existing non-None
        ``kb`` is never overwritten.

        Args:
            results: Results returned by one KB
            kb_name: Name of the KB that produced them

        Returns:
            The same list, with each result carrying ``.kb``
        """
        for result in results:
            if getattr(result, "kb", None) is None:
                try:
                    result.kb = kb_name
                except (AttributeError, TypeError):
                    # Exotic/frozen result types: skip rather than fail search.
                    logger.warning(
                        "Could not stamp kb=%r on result type %s",
                        kb_name,
                        type(result).__name__,
                    )
        return results

    @staticmethod
    def _comparable_score(result: SearchResult) -> float:
        """Cross-KB-comparable relevance for a result (semantic-first).

        Preference order:
        1. Raw cosine similarity (``result.cosine``) — all KBs share one
           embedding space, so this is directly comparable across KBs.
           Semantic hits have score == cosine; hybrid hits carry the cosine
           of their semantic leg.
        2. ``result.normalized`` — the [0, 1] confidence proxy when set.
        3. The raw score clamped to [0, 1] — per-mode normalization fallback
           for keyword-only hits (ts_rank) so they rank on the same scale
           instead of on incomparable raw magnitudes.
        """
        cosine = getattr(result, "cosine", None)
        if cosine is not None:
            return float(cosine)
        normalized = getattr(result, "normalized", None)
        if normalized is not None:
            return float(normalized)
        score = float(result.score)
        if score < 0.0:
            return 0.0
        if score > 1.0:
            return 1.0
        return score

    @staticmethod
    def _merge_results(results: list[SearchResult]) -> list[SearchResult]:
        """Merge and deduplicate results from multiple KBs.

        Ranking is semantic-first: results are ordered by their cross-KB
        comparable score (raw cosine when available — shared embedding
        space — else a [0, 1] normalized proxy; see _comparable_score),
        with the raw score as a deterministic tie-break within a mode.

        Args:
            results: Results from multiple KBs

        Returns:
            Merged, ranked results (deduplicated by content hash; the
            first-seen instance of duplicated content wins and keeps its
            ``kb`` attribution)
        """
        if not results:
            return []

        # Deduplicate by content (same chunk from different KBs)
        seen_content = {}
        for result in results:
            content_hash = hash(result.content)
            if content_hash not in seen_content:
                seen_content[content_hash] = result

        # Sort by cross-KB comparable relevance (descending), raw score as
        # tie-break.
        merged = sorted(
            seen_content.values(),
            key=lambda r: (SearchPipeline._comparable_score(r), r.score),
            reverse=True,
        )
        return merged

    async def estimate_routing(self, query: str) -> dict:
        """Estimate which KBs would be used for a query.

        Useful for debugging and understanding routing decisions.

        Args:
            query: User query

        Returns:
            Dict with routing decision info
        """
        decision = await self.router.route(query)
        return {
            "query": query,
            "selected_kbs": decision.kb_names,
            "confidence": decision.confidence,
            "reason": decision.reason,
        }
