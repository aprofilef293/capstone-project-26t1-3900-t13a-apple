"""Embedding service for semantic vector search.

Supports both local inference via sentence-transformers and remote
inference via the HuggingFace Inference API.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path

import numpy as np

_CACHE_DIR = Path("/app/.embedding_cache")

logger = logging.getLogger(__name__)


class LocalEmbeddingModel:
    """Embedding model using a local sentence-transformers instance.

    Loads the model into CPU memory on initialization and encodes text
    batches asynchronously via ``asyncio.to_thread``. Embeddings are
    L2-normalised to enable cosine similarity via dot product.

    Args:
        model_name: HuggingFace model identifier
            (default ``"BAAI/bge-small-en-v1.5"``).

    Attributes:
        _BATCH_SIZE: Number of texts per encoding batch (128).
    """

    _BATCH_SIZE = 128

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        # Lazy import — sentence-transformers is heavy and not needed when using remote HF API
        from sentence_transformers import SentenceTransformer

        self._model_name = model_name
        self._model = SentenceTransformer(model_name, device="cpu")
        logger.info("Prepared local instance of %s", model_name)

    async def encode(self, texts: list[str]) -> np.ndarray:
        """Encode a list of texts into L2-normalised embedding vectors.

        Runs the sentence-transformers model in a background thread to avoid
        blocking the async event loop.

        Args:
            texts: List of strings to encode. An empty list returns an empty array.

        Returns:
            A ``numpy.ndarray`` of shape ``(len(texts), dim)`` with dtype float32,
            where each row is a unit-length embedding vector.
        """
        if not texts:
            return np.array([], dtype=np.float32)
        return (
            await asyncio.to_thread(
                self._model.encode,
                texts,
                batch_size=self._BATCH_SIZE,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        ).astype(np.float32)


class HuggingFaceEmbeddingModel:
    """Client for generating text embeddings via the HuggingFace Inference API.

    Sends text to a remote sentence-transformer model and returns L2-normalised
    embedding vectors. Handles batching, rate-limit retries with exponential
    backoff, and caches the embedding dimension per model.

    Args:
        model_name: HuggingFace model identifier (e.g. ``"BAAI/bge-small-en-v1.5"``).
        api_token: HuggingFace API token. Free tokens can be created at
            https://huggingface.co/settings/tokens.
    """

    _BATCH_SIZE = 1024
    _MAX_CONCURRENT = 16
    _DIMENSION_CACHE: dict[str, int] = {}

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5", api_token: str = "") -> None:
        # Lazy import — httpx is only needed for remote inference mode
        import httpx

        self._model_name = model_name
        self._url = f"https://router.huggingface.co/hf-inference/models/{model_name}"
        headers = {"Content-Type": "application/json"}
        if api_token:
            headers["Authorization"] = f"Bearer {api_token}"
        self._async_client = httpx.AsyncClient(timeout=120.0, headers=headers)
        # Rate-limit concurrent requests to avoid overwhelming the HF Inference API
        self._semaphore = asyncio.Semaphore(self._MAX_CONCURRENT)

        self._dimension_val: int | None = None
        logger.info("Prepared HuggingFace Inference API client for %s", model_name)

    async def ensure_ready(self) -> None:
        """Probe the model dimension if not already known. Must be awaited once before encode."""
        if self._dimension_val is not None:
            return
        self._dimension_val = await self._probe_dimension()
        logger.info("HuggingFace model %s ready (dim=%d)", self._model_name, self._dimension_val)

    async def _probe_dimension(self) -> int:
        """Determine the embedding vector dimension by encoding a dummy input.

        Results are cached per model name so subsequent instances skip the
        network call.
        """
        if self._model_name in self._DIMENSION_CACHE:
            return self._DIMENSION_CACHE[self._model_name]
        resp = await self._request_with_retry(["hello"])
        dim = len(resp[0])
        self._DIMENSION_CACHE[self._model_name] = dim
        return dim

    async def _request_with_retry(self, texts: list[str], max_retries: int = 5) -> list[list[float]]:
        """Send a batch of texts to the HF Inference API and return raw embeddings.

        Retries up to *max_retries* times on 429 (rate-limit) and 503
        (model loading) responses using exponential backoff capped at 30 s.
        """
        for attempt in range(max_retries):
            resp = await self._async_client.post(self._url, json={"inputs": texts, "options": {"wait_for_model": True}})
            # 429 = rate-limited, 503 = model still loading on HF infrastructure — both are transient
            if resp.status_code in (429, 503):
                # Exponential backoff: 1s, 2s, 4s, 8s, 16s… capped at 30s
                wait = min(2**attempt, 30)
                logger.warning("HF API %d, retrying in %ds...", resp.status_code, wait)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        resp.raise_for_status()
        return []  # unreachable

    async def encode(self, texts: list[str]) -> np.ndarray:
        """Encode a list of texts into L2-normalised embedding vectors.

        Texts are sent as concurrent batches of ``_BATCH_SIZE`` using
        ``asyncio.gather`` with a semaphore limiting to ``_MAX_CONCURRENT``
        in-flight requests. Returns an ``(N, dim)`` float32 numpy array where
        each row is a unit-length embedding vector suitable for cosine
        similarity via dot product.
        """
        await self.ensure_ready()
        assert self._dimension_val is not None

        n = len(texts)
        arr = np.empty((n, self._dimension_val), dtype=np.float32)

        batches = [(i, texts[i : i + self._BATCH_SIZE]) for i in range(0, n, self._BATCH_SIZE)]

        async def _encode_batch(offset: int, batch: list[str]) -> tuple[int, list[list[float]]]:
            async with self._semaphore:
                result = await self._request_with_retry(batch)
                if offset > 0 and offset % (self._BATCH_SIZE * 10) == 0:
                    logger.info("HF API: encoded %d / %d texts", offset, n)
                return offset, result

        results = await asyncio.gather(*[_encode_batch(off, batch) for off, batch in batches])

        for offset, result in results:
            arr[offset : offset + len(result)] = result

        # L2-normalise so cosine similarity reduces to a simple dot product
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return arr / norms

    @property
    def dimension(self) -> int:
        """Return the dimensionality of the embedding vectors produced by this model."""
        return self._dimension_val


# Metadata fields in priority order with their search weights.
# Primary labels and definitions should dominate results; synonyms and
# comments are weak supporting signals only.  Alphanumeric identifiers
# (e.g. IAO:0000115) are excluded — they carry no semantic value for
# natural-language queries.
# Weights are applied as multipliers on raw cosine similarity at search
# time so their relative ratios matter, not their absolute values.
FIELD_WEIGHTS: dict[str, float] = {
    "name": 1.0,
    "definition": 0.7,
}


def build_field_texts(term: dict) -> dict[str, str]:
    """Extract per-field text from an ontology term for separate embedding.

    Each field that is present and non-empty gets its own text string so it
    can be embedded independently. This allows the search to weight primary
    labels and definitions higher than synonyms or comments.

    Alphanumeric identifiers (``id``) are intentionally excluded — they carry
    no semantic value for natural-language queries and add noise.

    Args:
        term: A dict (or Pydantic ``model_dump()``) with optional keys
            ``name``, ``definition``, ``synonyms`` (list[str]),
            and ``comment``.

    Returns:
        A dict mapping field names (from ``FIELD_WEIGHTS``) to their text.
        Only fields with non-empty content are included.
    """
    texts: dict[str, str] = {}
    if term.get("name"):
        texts["name"] = term["name"]
    if term.get("definition"):
        texts["definition"] = term["definition"]
    synonyms = term.get("synonyms") or []
    if synonyms:
        texts["synonyms"] = "; ".join(synonyms)
    if term.get("comment"):
        texts["comment"] = term["comment"]
    return texts


def build_embedding_text(term: dict) -> str:
    """Build a single combined text string from an ontology term's metadata.

    Convenience wrapper over ``build_field_texts`` that joins all available
    fields into one string separated by ``" . "``. Useful when only a single
    embedding per term is needed (e.g. for the startup index rebuild from
    Memgraph records).

    Args:
        term: A dict (or Pydantic ``model_dump()``) with optional keys
            ``name``, ``id``, ``definition``, ``synonyms`` (list[str]),
            and ``comment``.

    Returns:
        A joined string ready to be passed to ``HuggingFaceEmbeddingModel.encode``.
    """
    return " . ".join(build_field_texts(term).values())


class EmbeddingService:
    """In-memory vector index for semantic search over ontology terms.

    Each term is embedded **per metadata field** (name, id, definition,
    synonyms, comment) so that queries can be scored against each field
    independently. At search time, the final score is the **maximum** cosine
    similarity across all fields — an exact match on the name yields ~1.0
    without being diluted by other fields.

    The index is rebuilt from scratch each time ``build_index`` is called.

    Args:
        model: The embedding model used to encode both index texts and queries.
    """

    def __init__(self, model: LocalEmbeddingModel | HuggingFaceEmbeddingModel) -> None:
        self._model = model
        self._ids: list[str] = []
        # One embedding matrix per field, keyed by field name.
        self._field_embeddings: dict[str, np.ndarray] = {}
        # Track which terms have a value for each field (boolean mask).
        self._field_masks: dict[str, np.ndarray] = {}

    @staticmethod
    def _content_hash(term_ids: list[str], term_dicts: list[dict]) -> str:
        """Compute a deterministic hash of term content for disk cache invalidation.

        Hashes term IDs and the field values used for embedding (from
        ``FIELD_WEIGHTS``), sorted by ID for stability regardless of input order.

        Args:
            term_ids: List of ontology term identifiers.
            term_dicts: Corresponding list of term metadata dicts.

        Returns:
            A 16-character hex digest string.
        """
        h = hashlib.sha256()
        # Sort by term ID so the hash is stable regardless of input order.
        for tid, td in sorted(zip(term_ids, term_dicts), key=lambda x: x[0]):
            h.update(tid.encode())
            for key in FIELD_WEIGHTS:
                val = td.get(key)
                if val is not None:
                    h.update(str(val).encode())
        return h.hexdigest()[:16]

    def _try_load_cache(self, content_hash: str) -> bool:
        """Attempt to load a previously saved embedding index from disk.

        Looks for a ``.npz`` file in ``_CACHE_DIR`` keyed by the content hash.
        On success, populates ``_ids``, ``_field_embeddings``, and ``_field_masks``.

        Args:
            content_hash: The 16-char hex digest identifying the cached index.

        Returns:
            ``True`` if the cache was loaded successfully, ``False`` otherwise.
        """
        cache_file = _CACHE_DIR / f"index_{content_hash}.npz"
        if not cache_file.exists():
            return False
        try:
            data = np.load(cache_file, allow_pickle=True)
            self._ids = list(data["ids"])
            self._field_embeddings = {k: data[f"emb_{k}"] for k in FIELD_WEIGHTS if f"emb_{k}" in data}
            self._field_masks = {k: data[f"mask_{k}"] for k in FIELD_WEIGHTS if f"mask_{k}" in data}
            logger.info("Loaded embedding index from cache (%s)", cache_file.name)
            return True
        except Exception as e:
            logger.warning("Cache load failed, will recompute: %s", e)
            return False

    def _save_cache(self, content_hash: str) -> None:
        """Persist the current embedding index to disk for fast restarts.

        Saves term IDs, per-field embedding matrices, and field masks as a
        compressed ``.npz`` file in ``_CACHE_DIR``.

        Args:
            content_hash: The 16-char hex digest used as the cache filename.
        """
        try:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)
            arrays: dict[str, np.ndarray] = {"ids": np.array(self._ids, dtype=object)}
            for field in FIELD_WEIGHTS:
                if field in self._field_embeddings:
                    arrays[f"emb_{field}"] = self._field_embeddings[field]
                if field in self._field_masks:
                    arrays[f"mask_{field}"] = self._field_masks[field]
            cache_file = _CACHE_DIR / f"index_{content_hash}.npz"
            np.savez(cache_file, **arrays)
            logger.info("Saved embedding index cache (%s)", cache_file.name)
        except Exception as e:
            logger.warning("Failed to save embedding cache: %s", e)

    async def build_index(self, term_ids: list[str], term_dicts: list[dict]) -> None:
        """Encode per-field texts and store alongside their *term_ids*.

        Uses a disk cache keyed by content hash — if the terms haven't
        changed since the last run, the index loads from disk in
        milliseconds instead of re-encoding via the HF API.
        """
        if not term_ids:
            self._ids = []
            self._field_embeddings = {}
            self._field_masks = {}
            return

        # Check disk cache first.
        content_hash = self._content_hash(term_ids, term_dicts)
        if self._try_load_cache(content_hash):
            return

        self._ids = list(term_ids)
        n = len(term_ids)

        # Extract per-field texts for every term.
        all_field_texts: dict[str, list[str]] = {f: [] for f in FIELD_WEIGHTS}
        all_field_present: dict[str, list[bool]] = {f: [] for f in FIELD_WEIGHTS}

        for td in term_dicts:
            fields = build_field_texts(td)
            for field in FIELD_WEIGHTS:
                if field in fields:
                    all_field_texts[field].append(fields[field])
                    all_field_present[field].append(True)
                else:
                    all_field_texts[field].append("")
                    all_field_present[field].append(False)

        self._field_masks = {}
        # Collect all present texts across all fields into one flat list
        # so we can encode them in a single call with maximum parallelism.
        combined_texts: list[str] = []
        field_slices: dict[str, tuple[int, int]] = {}

        for field in FIELD_WEIGHTS:
            mask = np.array(all_field_present[field], dtype=bool)
            self._field_masks[field] = mask
            if not mask.any():
                continue
            present_texts = [t for t, m in zip(all_field_texts[field], mask) if m]
            start = len(combined_texts)
            combined_texts.extend(present_texts)
            field_slices[field] = (start, len(combined_texts))

        # Single encode call for all fields — maximises batching and concurrency.
        self._field_embeddings = {}
        if combined_texts:
            all_vecs = await self._model.encode(combined_texts)
            # Scatter encoded vectors back into per-term positions; terms missing a field stay as zero vectors
            for field, (start, end) in field_slices.items():
                mask = self._field_masks[field]
                full_vecs = np.zeros((n, all_vecs.shape[1]), dtype=np.float32)
                full_vecs[mask] = all_vecs[start:end]
                self._field_embeddings[field] = full_vecs

        total_vecs = sum(int(m.sum()) for m in self._field_masks.values())
        logger.info(
            "Built embedding index: %d terms, %d field vectors across %d fields",
            n,
            total_vecs,
            len(self._field_embeddings),
        )

        # Persist to disk for next restart.
        self._save_cache(content_hash)

    async def search(self, query: str, top_k: int = 20) -> list[tuple[str, float, str]]:
        """Find the *top_k* most similar terms to *query*.

        The query is compared against each metadata field independently. The
        final score for a term is the **maximum** raw cosine similarity across
        all its fields, so an exact match on name yields ~1.0 rather than being
        diluted by unrelated fields. When two fields have equal raw scores, the
        higher-weighted field (per ``FIELD_WEIGHTS``) is preferred as the
        reported best-match field.

        Returns:
            A list of ``(term_id, score, best_match_field)`` tuples sorted by
            descending score, or an empty list if the index has not been built.
        """
        if not self._ids or not self._field_embeddings:
            return []

        # Split on commas and strip whitespace
        terms = [t.strip() for t in query.split(",") if t.strip()]
        if not terms:
            return []

        if len(terms) == 1:
            query_vec = await self._model.encode(terms)
        else:
            # Encode all terms in a single batch call, then average + re-normalise.
            all_vecs = await self._model.encode(terms)  # (n_terms, dim)
            centroid = all_vecs.mean(axis=0)  # (dim,)
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid /= norm
            query_vec = centroid[np.newaxis, :]  # (1, dim)
            logger.debug("Multi-term query: %d terms averaged into centroid", len(terms))

        n = len(self._ids)
        # Track the best *weighted* cosine similarity per term across all
        # fields.  Each field's raw similarity is multiplied by its weight
        # so that name matches dominate and low-weight fields (synonyms,
        # comments) only surface when nothing better exists.
        best_weighted_score = np.full(n, -np.inf, dtype=np.float32)
        best_field_name: list[str] = [""] * n

        for field, weight in FIELD_WEIGHTS.items():
            if field not in self._field_embeddings:
                continue
            mask = self._field_masks[field]
            # Dot product = cosine similarity because all vectors are L2-normalised
            raw_scores = (self._field_embeddings[field] @ query_vec.T).ravel()
            weighted_scores = raw_scores * weight
            better = mask & (weighted_scores > best_weighted_score)
            for i in np.where(better)[0]:
                best_weighted_score[i] = weighted_scores[i]
                best_field_name[i] = field

        # Terms with no fields at all keep -inf; clamp to 0.
        final_scores = np.maximum(best_weighted_score, 0.0)

        k = min(top_k, n)
        # argpartition is O(n) vs O(n log n) for a full sort — we only need the top-k, not full ordering
        partitioned = np.argpartition(final_scores, -k)[-k:]
        top_indices = partitioned[np.argsort(final_scores[partitioned])[::-1]]

        return [(self._ids[i], float(final_scores[i]), best_field_name[i]) for i in top_indices]

    @property
    def is_ready(self) -> bool:
        """Return ``True`` if the index contains at least one embedded term."""
        return len(self._ids) > 0 and len(self._field_embeddings) > 0
