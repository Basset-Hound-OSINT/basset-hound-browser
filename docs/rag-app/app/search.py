from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import Chunk, Document
from .embeddings import EmbeddingService


@dataclass
class SearchResult:
    chunk_id: int
    document_id: int
    document_filename: str
    document_filepath: str
    chunk_index: int
    content: str
    score: float
    # --- intuitive relevance signals (additive, backward-compatible) ---------
    # `score` stays exactly as before (cosine-sim for semantic, ts_rank for
    # keyword, RRF for hybrid) so every existing caller is unchanged.
    # `cosine` is the raw vector cosine similarity (1.0 - cosine_distance) of the
    # chunk to the query — an intuitive [-1, 1] (in practice ~[0, 1]) signal that
    # is independent of how many lists were fused. It is None for a hit that came
    # ONLY from the keyword leg (no embedding was scored for it).
    # `normalized` is a 0-1 confidence proxy derived from `cosine` (clamped); it
    # is None when `cosine` is None.
    cosine: float | None = None
    normalized: float | None = None
    # Cross-encoder reranker logit (only set when reranking is enabled; the
    # reranker also overwrites `normalized` with sigmoid(logit) so the 0-1
    # signal reflects the more-accurate second-stage score). None otherwise.
    rerank_score: float | None = None


def _clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x


def _not_expired():
    """Filter out chunks whose source file vanished (marked by the ingester).

    `expire_stale_chunks` (app.ingestion) sets `metadata.expired = true` on
    chunks whose source path no longer exists under the ingested root;
    re-ingesting identical content clears the marker. IS DISTINCT FROM TRUE
    keeps rows with NULL/missing metadata (the common case) and rows where
    expired is false.
    """
    return Chunk.metadata_["expired"].as_boolean().is_distinct_from(True)


def _escape_like(value: str) -> str:
    """Escape SQL LIKE metacharacters (backslash first, then % and _).

    The value is already a bound parameter (no SQL injection); this makes a
    caller-supplied prefix match LITERALLY instead of `%`/`_` acting as
    wildcards (e.g. corpus `%secret%` substring-matching instead of
    prefix-matching).
    """
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _path_prefix_filter(stmt, path_prefix: str | None):
    """Optionally scope a search statement to documents under `path_prefix`.

    Additive corpus/project scoping (single stack = one corpus; this narrows
    within it by stored filepath prefix). None → no filtering (today's
    behavior, backward-compatible). LIKE metacharacters in the prefix are
    escaped so it is always a literal prefix match.
    """
    if path_prefix:
        stmt = stmt.where(
            Document.filepath.like(f"{_escape_like(path_prefix)}%", escape="\\")
        )
    return stmt


# =============================================================================
# Semantic search (pgvector cosine distance)
# =============================================================================


async def semantic_search(
    query: str,
    session: AsyncSession,
    embedding_service: EmbeddingService | None = None,
    limit: int = 10,
    embedding_vector: list[float] | None = None,
    path_prefix: str | None = None,
) -> list[SearchResult]:
    # Use provided embedding or compute from query
    if embedding_vector is not None:
        query_embedding = embedding_vector
    elif embedding_service is not None:
        query_embedding = await embedding_service.embed_text(query, task="search_query")
    else:
        raise ValueError("Must provide either embedding_vector or embedding_service")

    distance = Chunk.embedding.cosine_distance(query_embedding).label("distance")

    stmt = (
        select(Chunk, Document.filename, Document.filepath, distance)
        .join(Document, Chunk.document_id == Document.id)
        .where(_not_expired())
        .order_by(distance)
        .limit(limit)
    )
    stmt = _path_prefix_filter(stmt, path_prefix)

    rows = (await session.execute(stmt)).all()

    results = []
    for row in rows:
        cosine = 1.0 - float(row.distance)  # cosine similarity in ~[0, 1]
        results.append(
            SearchResult(
                chunk_id=row.Chunk.id,
                document_id=row.Chunk.document_id,
                document_filename=row.filename,
                document_filepath=row.filepath or "",
                chunk_index=row.Chunk.chunk_index,
                content=row.Chunk.content,
                score=cosine,  # for semantic mode, score == cosine (unchanged)
                cosine=cosine,
                normalized=_clamp01(cosine),
            )
        )
    return results


# =============================================================================
# Keyword search (PostgreSQL full-text search)
# =============================================================================


async def keyword_search(
    query: str,
    session: AsyncSession,
    limit: int = 10,
    path_prefix: str | None = None,
) -> list[SearchResult]:
    ts_query = func.plainto_tsquery("english", query)
    ts_vector = func.to_tsvector("english", Chunk.content)
    rank = func.ts_rank(ts_vector, ts_query).label("rank")

    stmt = (
        select(Chunk, Document.filename, Document.filepath, rank)
        .join(Document, Chunk.document_id == Document.id)
        .where(ts_vector.op("@@")(ts_query))
        .where(_not_expired())
        .order_by(rank.desc())
        .limit(limit)
    )
    stmt = _path_prefix_filter(stmt, path_prefix)

    rows = (await session.execute(stmt)).all()

    return [
        SearchResult(
            chunk_id=row.Chunk.id,
            document_id=row.Chunk.document_id,
            document_filename=row.filename,
            document_filepath=row.filepath or "",
            chunk_index=row.Chunk.chunk_index,
            content=row.Chunk.content,
            score=float(row.rank),
        )
        for row in rows
    ]


# =============================================================================
# Hybrid search (Reciprocal Rank Fusion)
# =============================================================================


def _rrf(
    semantic_results: list[SearchResult],
    keyword_results: list[SearchResult],
    semantic_weight: float = 0.7,
    k: int = 60,
) -> list[SearchResult]:
    """Combine two ranked lists using Reciprocal Rank Fusion."""
    keyword_weight = 1.0 - semantic_weight
    scores: dict[int, float] = {}
    result_map: dict[int, SearchResult] = {}

    for rank, r in enumerate(semantic_results, start=1):
        scores[r.chunk_id] = scores.get(r.chunk_id, 0.0) + semantic_weight / (k + rank)
        result_map[r.chunk_id] = r

    for rank, r in enumerate(keyword_results, start=1):
        scores[r.chunk_id] = scores.get(r.chunk_id, 0.0) + keyword_weight / (k + rank)
        result_map.setdefault(r.chunk_id, r)

    # Carry the raw cosine similarity from the SEMANTIC leg per chunk, so the
    # fused hybrid hit still exposes an intuitive vector-relevance signal
    # alongside the (tiny, rank-only) RRF score. A hit that came ONLY from the
    # keyword leg has no cosine (stays None).
    cosine_map: dict[int, float] = {
        r.chunk_id: r.cosine for r in semantic_results if r.cosine is not None
    }

    ranked_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)
    fused: list[SearchResult] = []
    for cid in ranked_ids:
        src = result_map[cid]
        cosine = cosine_map.get(cid)
        fused.append(
            SearchResult(
                chunk_id=src.chunk_id,
                document_id=src.document_id,
                document_filename=src.document_filename,
                document_filepath=src.document_filepath,
                chunk_index=src.chunk_index,
                content=src.content,
                score=scores[cid],  # RRF fusion score (unchanged, backward-compatible)
                cosine=cosine,
                normalized=(_clamp01(cosine) if cosine is not None else None),
            )
        )
    return fused


async def hybrid_search(
    query: str,
    session: AsyncSession,
    embedding_service: EmbeddingService | None = None,
    limit: int = 10,
    semantic_weight: float = 0.7,
    embedding_vector: list[float] | None = None,
    path_prefix: str | None = None,
) -> list[SearchResult]:
    # Fetch more candidates than final limit for better fusion
    fetch_limit = limit * 3
    sem_results = await semantic_search(
        query, session, embedding_service, fetch_limit, embedding_vector, path_prefix
    )
    kw_results = await keyword_search(query, session, fetch_limit, path_prefix)
    fused = _rrf(sem_results, kw_results, semantic_weight)
    return fused[:limit]
