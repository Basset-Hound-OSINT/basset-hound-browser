"""Cross-encoder reranker — second-stage relevance scoring over the candidate set.

WHY THIS EXISTS
---------------
Hybrid RRF fusion ranks by *rank position* in two lists, so its scores are tiny
and rank-only (rank-1 ≈ 0.016) and it can leave a clearly-on-topic chunk below a
keyword-coincidental one. A cross-encoder scores each (query, chunk) PAIR jointly
(the query and the chunk attend to each other in one forward pass), which is far
more accurate at judging topical relevance than the bi-encoder cosine used for
first-stage retrieval — at the cost of one model forward pass per candidate.

REACHABILITY / DEFAULT-OFF
--------------------------
The reranker was previously a roadmap TODO (docs/roadmap.md, docs/todo.md) with NO
query-path wiring — i.e. unreachable. This module makes it reachable, but it is
DEFAULT-OFF in two independent ways:

  1. It is only invoked when a caller passes `rerank=True` on /api/search (or the
     RAG_RERANK_ENABLED env flag is on). With the flag/param off, this module is
     never imported or constructed, so startup and the default query path are
     byte-for-byte unchanged.
  2. The heavy `sentence-transformers` import + model load is LAZY (first use
     only) and fail-soft: any load/scoring error returns the input order
     untouched, so a missing dependency or model can never break search.

The model is the canonical lightweight cross-encoder `cross-encoder/
ms-marco-MiniLM-L-6-v2` (~80 MB, CPU-friendly), overridable via RERANK_MODEL.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - typing only
    from sentence_transformers import CrossEncoder

    from .search import SearchResult

logger = logging.getLogger(__name__)

DEFAULT_RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def is_rerank_enabled() -> bool:
    """Env-level default for reranking (the per-request `rerank` param wins).

    OFF unless RAG_RERANK_ENABLED is a truthy token. Fail-soft: any error → OFF.
    """
    try:
        raw = os.environ.get("RAG_RERANK_ENABLED", "").strip().lower()
        return raw in {"1", "true", "yes", "on", "enabled"}
    except Exception:  # pragma: no cover - defensive
        return False


class CrossEncoderReranker:
    """Lazy, process-wide, fail-soft cross-encoder reranker.

    A single shared instance is reused across requests (one model load). The
    `sentence_transformers` import + model construction happen on FIRST `rerank`
    call only — never at import or app startup.
    """

    _instance: CrossEncoderReranker | None = None
    _instance_lock = threading.Lock()

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or os.environ.get("RERANK_MODEL", DEFAULT_RERANK_MODEL)
        self._model: CrossEncoder | None = None
        self._load_failed = False
        self._load_lock = threading.Lock()

    @classmethod
    def get_shared(cls) -> CrossEncoderReranker:
        """Process-wide singleton so the model is loaded at most once."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _get_model(self) -> CrossEncoder | None:
        if self._model is not None:
            return self._model
        if self._load_failed:
            return None
        with self._load_lock:
            if self._model is not None:
                return self._model
            if self._load_failed:
                return None
            try:
                from sentence_transformers import CrossEncoder

                logger.info("Loading cross-encoder reranker model: %s", self.model_name)
                self._model = CrossEncoder(self.model_name)
                return self._model
            except Exception:
                # Missing dependency / no network for model download / OOM, etc.
                self._load_failed = True
                logger.exception(
                    "Cross-encoder reranker unavailable (model=%s); reranking will be a no-op",
                    self.model_name,
                )
                return None

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int | None = None,
    ) -> list[SearchResult]:
        """Reorder `results` by cross-encoder (query, chunk) relevance.

        Fail-soft: if the model is unavailable or scoring raises, the INPUT order
        is returned unchanged (sliced to top_k). The cross-encoder logit is
        attached as `rerank_score` and surfaced as the primary `normalized` 0-1
        signal (sigmoid of the logit) so a caller still gets an intuitive number.
        The original RRF/cosine fields are PRESERVED on each result.
        """
        if not results:
            return results
        if not query:
            return results if top_k is None else results[:top_k]

        model = self._get_model()
        if model is None:
            return results if top_k is None else results[:top_k]

        try:
            import math

            pairs = [(query, r.content) for r in results]
            scores = model.predict(pairs)  # list[float] cross-encoder logits

            scored = []
            for r, raw in zip(results, scores):
                logit = float(raw)
                r.rerank_score = logit
                # ms-marco cross-encoders emit a relevance logit; sigmoid → 0-1.
                try:
                    r.normalized = 1.0 / (1.0 + math.exp(-logit))
                except OverflowError:  # pragma: no cover - extreme logit
                    r.normalized = 0.0 if logit < 0 else 1.0
                scored.append((logit, r))

            scored.sort(key=lambda t: t[0], reverse=True)
            reordered = [r for _, r in scored]
            return reordered if top_k is None else reordered[:top_k]
        except Exception:
            logger.exception("Cross-encoder rerank failed; returning input order")
            return results if top_k is None else results[:top_k]
