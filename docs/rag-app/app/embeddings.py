from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import TYPE_CHECKING

import httpx
import redis.asyncio as aioredis

from .config import settings
from .config_manager import Config, default_config_path

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_CACHE_TTL = 60 * 60 * 24 * 30  # 30 days

# -- Ollama throughput / resilience -------------------------------------------
# Concurrency and backoff *strategy* are tunable via config/config.yaml
# (ingestion.concurrent_files, ingestion.retry_backoff); attempt count and
# base delay are fixed here by design (documented in config.yaml).
_DEFAULT_CONCURRENCY = 5  # max in-flight Ollama embedding requests
_DEFAULT_RETRY_BACKOFF = "exponential"  # or "linear"
_RETRY_ATTEMPTS = 3  # total tries per request (1 initial + 2 retries)
_RETRY_BASE_DELAY = 0.5  # seconds; grows per the backoff strategy
_OLLAMA_BATCH_SIZE = 64  # texts per /api/embed batch request

_ST_GUARD_MESSAGE = (
    "EMBEDDING_BACKEND is set to 'sentence-transformers' but the "
    "'sentence-transformers' package is not installed. It is intentionally "
    "NOT bundled — the supported default backend is Ollama. Either switch to "
    "the default (EMBEDDING_BACKEND=ollama, EMBEDDING_MODEL=nomic-embed-text, "
    "EMBEDDING_DIMENSION=768, with 'ollama pull nomic-embed-text' run on the "
    "Ollama host) or install the optional dependency yourself: "
    "pip install sentence-transformers (see app/requirements.txt)."
)


def ensure_backend_ready(backend: str | None = None) -> None:
    """Startup guard: fail fast when the configured embedding backend can't work.

    Called from the app lifespan (alongside the dimension guard) so a
    misconfigured EMBEDDING_BACKEND=sentence-transformers without the optional
    package aborts boot with the actionable _ST_GUARD_MESSAGE instead of
    failing quietly on the first ingest/query. Probes package presence via
    importlib.util.find_spec — no model (or even module) import happens.
    The default Ollama backend is untouched.
    """
    backend = settings.EMBEDDING_BACKEND if backend is None else backend
    if backend != "sentence-transformers":
        return
    import importlib.util

    if importlib.util.find_spec("sentence_transformers") is None:
        raise RuntimeError(_ST_GUARD_MESSAGE)


def _ingestion_knobs() -> tuple[int, str]:
    """Read Ollama throughput knobs from config.yaml (CWD-independent).

    Returns:
        (concurrency, retry_backoff) — falling back to module defaults when
        config.yaml is absent or the keys are missing/invalid.
    """
    try:
        cfg = Config.from_file(default_config_path())
        concurrency = int(cfg.get("ingestion.concurrent_files", _DEFAULT_CONCURRENCY))
        backoff = str(cfg.get("ingestion.retry_backoff", _DEFAULT_RETRY_BACKOFF))
    except Exception:
        logger.warning("Could not read ingestion knobs from config.yaml; using defaults")
        return _DEFAULT_CONCURRENCY, _DEFAULT_RETRY_BACKOFF
    if backoff not in ("exponential", "linear"):
        logger.warning("Unknown retry_backoff %r; using %r", backoff, _DEFAULT_RETRY_BACKOFF)
        backoff = _DEFAULT_RETRY_BACKOFF
    return max(1, concurrency), backoff


class EmbeddingService:
    """Generates embeddings via Ollama (default) or sentence-transformers (optional).

    Ollama requests run under a bounded-concurrency semaphore and retry
    transient failures (timeouts / 5xx) with configurable backoff. Batch
    embedding prefers Ollama's /api/embed batch endpoint where available.

    For nomic-embed-text v1.5, automatically adds task prefixes:
    - 'search_document:' for document chunks (ingestion)
    - 'search_query:' for user queries (search)
    """

    def __init__(
        self,
        backend: str = settings.EMBEDDING_BACKEND,
        model_name: str = settings.EMBEDDING_MODEL,
        ollama_base_url: str = settings.OLLAMA_BASE_URL,
        redis_client: aioredis.Redis | None = None,
        concurrency: int | None = None,
        retry_backoff: str | None = None,
    ) -> None:
        self.backend = backend
        self.model_name = model_name
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.redis: aioredis.Redis | None = redis_client
        self._local_model: SentenceTransformer | None = None

        # Reason the last health_check() failed (None when healthy). Lets
        # /api/health surface actionable messages (e.g. _ST_GUARD_MESSAGE)
        # instead of a silent False.
        self.last_health_error: str | None = None

        # Throughput/resilience knobs (config.yaml unless explicitly passed)
        knob_concurrency, knob_backoff = _ingestion_knobs()
        self.concurrency = concurrency if concurrency is not None else knob_concurrency
        self.retry_backoff = retry_backoff if retry_backoff is not None else knob_backoff
        self._semaphore = asyncio.Semaphore(max(1, self.concurrency))

        # /api/embed batch support probed lazily; None = unknown yet
        self._ollama_batch_supported: bool | None = None

        # Enable task prefixes for nomic-embed-text v1.5
        self.use_task_prefix = "nomic-embed-text" in model_name.lower()

    # -- task prefix helpers (for nomic-embed-text v1.5) ------------------------

    def _add_task_prefix(self, text: str, task: str = "search_document") -> str:
        """Add task prefix for nomic-embed-text v1.5 optimization.

        Args:
            text: The text to embed
            task: One of 'search_document', 'search_query', 'classification', 'clustering'

        Returns:
            Text with task prefix if model supports it, otherwise unchanged
        """
        if not self.use_task_prefix:
            return text

        # Don't add prefix if it already has one
        known_prefixes = ["search_document:", "search_query:", "classification:", "clustering:"]
        if any(text.startswith(prefix) for prefix in known_prefixes):
            return text

        return f"{task}: {text}"

    # -- lazy loading for sentence-transformers ---------------------------------

    def _get_local_model(self) -> SentenceTransformer:
        if self._local_model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise ImportError(_ST_GUARD_MESSAGE) from exc

            logger.info("Loading sentence-transformers model: %s", self.model_name)
            self._local_model = SentenceTransformer(self.model_name)
        return self._local_model

    # -- cache helpers ----------------------------------------------------------

    @staticmethod
    def _cache_key(text: str) -> str:
        h = hashlib.sha256(text.encode()).hexdigest()
        return f"emb:{h}"

    async def _cache_get(self, text: str) -> list[float] | None:
        if self.redis is None:
            return None
        raw = await self.redis.get(self._cache_key(text))
        if raw is not None:
            return json.loads(raw)
        return None

    async def _cache_set(self, text: str, vector: list[float]) -> None:
        if self.redis is None:
            return
        await self.redis.set(self._cache_key(text), json.dumps(vector), ex=_CACHE_TTL)

    # -- public API -------------------------------------------------------------

    async def embed_text(self, text: str, task: str = "search_document") -> list[float]:
        """Embed a single text string.

        Args:
            text: The text to embed
            task: Task type for nomic-embed-text ('search_document' or 'search_query')

        Returns:
            Embedding vector as list of floats
        """
        # Add task prefix if model supports it
        prefixed_text = self._add_task_prefix(text, task)

        cached = await self._cache_get(prefixed_text)
        if cached is not None:
            return cached

        if self.backend == "ollama":
            vector = await self._embed_ollama(prefixed_text)
        else:
            vector = self._embed_local(prefixed_text)

        await self._cache_set(prefixed_text, vector)
        return vector

    async def embed_batch(
        self, texts: list[str], task: str = "search_document"
    ) -> list[list[float]]:
        """Embed a batch of text strings.

        Args:
            texts: List of texts to embed
            task: Task type for nomic-embed-text ('search_document' or 'search_query')

        Returns:
            List of embedding vectors
        """
        # Add task prefixes if model supports it
        prefixed_texts = [self._add_task_prefix(t, task) for t in texts]

        results: list[list[float] | None] = [None] * len(prefixed_texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        # Check cache first
        for i, t in enumerate(prefixed_texts):
            cached = await self._cache_get(t)
            if cached is not None:
                results[i] = cached
            else:
                uncached_indices.append(i)
                uncached_texts.append(t)

        if uncached_texts:
            if self.backend == "ollama":
                vectors = await self._embed_ollama_batch(uncached_texts)
            else:
                vectors = self._embed_local_batch(uncached_texts)

            for idx, text, vec in zip(uncached_indices, uncached_texts, vectors):
                results[idx] = vec
                await self._cache_set(text, vec)

        return results  # type: ignore[return-value]

    # -- backends ---------------------------------------------------------------

    def _embed_local(self, text: str) -> list[float]:
        model = self._get_local_model()
        return model.encode(text, normalize_embeddings=True).tolist()

    def _embed_local_batch(self, texts: list[str]) -> list[list[float]]:
        model = self._get_local_model()
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=64)
        return [e.tolist() for e in embeddings]

    def _retry_delay(self, attempt: int) -> float:
        """Delay before the next try after 0-indexed failed ``attempt``."""
        if self.retry_backoff == "linear":
            return _RETRY_BASE_DELAY * (attempt + 1)
        return _RETRY_BASE_DELAY * (2**attempt)

    async def _post_ollama(self, path: str, payload: dict) -> dict:
        """POST to Ollama under the concurrency cap, retrying transient failures.

        Retries timeouts/connection errors and 5xx responses per the configured
        backoff strategy. 4xx responses (e.g. 404 for an unsupported endpoint)
        are raised immediately — they are not transient.
        """
        url = f"{self.ollama_base_url}{path}"
        async with self._semaphore:
            last_exc: Exception | None = None
            for attempt in range(_RETRY_ATTEMPTS):
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        resp = await client.post(url, json=payload)
                        resp.raise_for_status()
                        return resp.json()
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code < 500:
                        raise  # 4xx: caller/endpoint problem, retrying won't help
                    last_exc = exc
                except httpx.TransportError as exc:  # timeouts, connect errors
                    last_exc = exc
                if attempt + 1 < _RETRY_ATTEMPTS:
                    delay = self._retry_delay(attempt)
                    logger.warning(
                        "Ollama embed request to %s failed (attempt %d/%d: %s); "
                        "retrying in %.1fs",
                        path,
                        attempt + 1,
                        _RETRY_ATTEMPTS,
                        last_exc,
                        delay,
                    )
                    await asyncio.sleep(delay)
            logger.error(
                "Ollama embed request to %s failed after %d attempts", path, _RETRY_ATTEMPTS
            )
            assert last_exc is not None
            raise last_exc

    async def _embed_ollama(self, text: str) -> list[float]:
        data = await self._post_ollama(
            "/api/embeddings", {"model": self.model_name, "prompt": text}
        )
        return data["embedding"]

    async def _embed_ollama_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed many texts, preferring Ollama's /api/embed batch endpoint.

        Falls back (once, then remembered) to per-text /api/embeddings calls
        under the same concurrency cap when the batch endpoint is unavailable
        (older Ollama) or returns an unexpected shape.
        """
        if self._ollama_batch_supported is not False:
            try:
                slices = [
                    texts[i : i + _OLLAMA_BATCH_SIZE]
                    for i in range(0, len(texts), _OLLAMA_BATCH_SIZE)
                ]
                responses = await asyncio.gather(
                    *(
                        self._post_ollama("/api/embed", {"model": self.model_name, "input": s})
                        for s in slices
                    )
                )
                vectors: list[list[float]] = []
                for s, data in zip(slices, responses):
                    embeddings = data.get("embeddings")
                    if not isinstance(embeddings, list) or len(embeddings) != len(s):
                        raise ValueError("unexpected /api/embed response shape")
                    vectors.extend(embeddings)
                self._ollama_batch_supported = True
                return vectors
            except (httpx.HTTPStatusError, ValueError, KeyError) as exc:
                if (
                    isinstance(exc, httpx.HTTPStatusError)
                    and exc.response.status_code >= 500
                ):
                    raise  # real outage (retries already exhausted), not lack of support
                if self._ollama_batch_supported is None:
                    logger.info(
                        "Ollama /api/embed batch endpoint unavailable (%s); "
                        "falling back to per-text /api/embeddings",
                        exc,
                    )
                self._ollama_batch_supported = False

        # Per-text fallback; _post_ollama's semaphore bounds the fan-out.
        return list(await asyncio.gather(*(self._embed_ollama(t) for t in texts)))

    # -- health -----------------------------------------------------------------

    async def health_check(self) -> bool:
        """Probe the embedding path end-to-end.

        Returns the same bool as always (backward-compatible). On failure the
        reason (e.g. the sentence-transformers guard message from
        _get_local_model) is retained on ``self.last_health_error`` so
        /api/health can surface it instead of a silent False.
        """
        self.last_health_error = None
        try:
            await self.embed_text("health check")
            return True
        except Exception as exc:
            self.last_health_error = str(exc) or exc.__class__.__name__
            logger.exception("Embedding service health check failed")
            return False
