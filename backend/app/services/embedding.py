"""Embedding service for semantic vector search via HuggingFace Inference API."""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

logger = logging.getLogger(__name__)


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

    _BATCH_SIZE = 64
    _MAX_WORKERS = 4
    _DIMENSION_CACHE: dict[str, int] = {}

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5", api_token: str = "") -> None:
        import httpx

        self._model_name = model_name
        self._url = f"https://router.huggingface.co/hf-inference/models/{model_name}"
        headers = {"Content-Type": "application/json"}
        if api_token:
            headers["Authorization"] = f"Bearer {api_token}"
        self._client = httpx.Client(timeout=120.0, headers=headers)

        self._dimension_val = self._probe_dimension()
        logger.info("Using HuggingFace Inference API for %s  (dim=%d)", model_name, self._dimension_val)

    def _probe_dimension(self) -> int:
        """Determine the embedding vector dimension by encoding a dummy input.

        Results are cached per model name so subsequent instances skip the
        network call.
        """
        if self._model_name in self._DIMENSION_CACHE:
            return self._DIMENSION_CACHE[self._model_name]
        resp = self._request_with_retry(["hello"])
        dim = len(resp[0])
        self._DIMENSION_CACHE[self._model_name] = dim
        return dim

    def _request_with_retry(self, texts: list[str], max_retries: int = 5) -> list[list[float]]:
        """Send a batch of texts to the HF Inference API and return raw embeddings.

        Retries up to *max_retries* times on 429 (rate-limit) and 503
        (model loading) responses using exponential backoff capped at 30 s.
        """
        for attempt in range(max_retries):
            resp = self._client.post(self._url, json={"inputs": texts, "options": {"wait_for_model": True}})
            if resp.status_code in (429, 503):
                wait = min(2 ** attempt, 30)
                logger.warning("HF API %d, retrying in %ds...", resp.status_code, wait)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        resp.raise_for_status()
        return []  # unreachable

    def encode(self, texts: list[str]) -> np.ndarray:
        """Encode a list of texts into L2-normalised embedding vectors.

        Texts are sent in concurrent batches of ``_BATCH_SIZE`` using a thread
        pool (up to ``_MAX_WORKERS`` in-flight requests). Progress is logged
        every 640 texts. Returns an ``(N, dim)`` float32 numpy array where each
        row is a unit-length embedding vector suitable for cosine similarity via
        dot product.
        """
        n = len(texts)
        arr = np.empty((n, self._dimension_val), dtype=np.float32)

        batches = [
            (i, texts[i : i + self._BATCH_SIZE])
            for i in range(0, n, self._BATCH_SIZE)
        ]

        def _encode_batch(item: tuple[int, list[str]]) -> tuple[int, list[list[float]]]:
            offset, batch = item
            return offset, self._request_with_retry(batch)

        with ThreadPoolExecutor(max_workers=self._MAX_WORKERS) as pool:
            for offset, result in pool.map(_encode_batch, batches):
                arr[offset : offset + len(result)] = result
                if offset > 0 and offset % (self._BATCH_SIZE * 10) == 0:
                    logger.info("HF API: encoded %d / %d texts", offset, n)

        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return arr / norms

    @property
    def dimension(self) -> int:
        """Return the dimensionality of the embedding vectors produced by this model."""
        return self._dimension_val


def build_embedding_text(term: dict) -> str:
    """Build a single text string from an ontology term's metadata fields.

    Concatenates *name*, *definition*, *synonyms*, and *comment* (when present)
    separated by ``" . "`` so the embedding model captures the full semantic
    meaning of the term.

    Args:
        term: A dict (or Pydantic ``model_dump()``) with optional keys
            ``name``, ``definition``, ``synonyms`` (list[str]), and ``comment``.

    Returns:
        A joined string ready to be passed to ``HuggingFaceEmbeddingModel.encode``.
    """
    parts: list[str] = []
    if term.get("name"):
        parts.append(term["name"])
    if term.get("definition"):
        parts.append(term["definition"])
    synonyms = term.get("synonyms") or []
    if synonyms:
        parts.append("; ".join(synonyms))
    if term.get("comment"):
        parts.append(term["comment"])
    return " . ".join(parts)


class EmbeddingService:
    """In-memory vector index for semantic search over ontology terms.

    Stores pre-computed embeddings and performs brute-force cosine similarity
    search (via dot product on unit vectors). The index is rebuilt from scratch
    each time ``build_index`` is called — there is no incremental update.

    Args:
        model: The embedding model used to encode both index texts and queries.
    """

    def __init__(self, model: HuggingFaceEmbeddingModel) -> None:
        self._model = model
        self._ids: list[str] = []
        self._embeddings: np.ndarray | None = None

    def build_index(self, term_ids: list[str], texts: list[str]) -> None:
        """Encode *texts* and store the vectors alongside their *term_ids*.

        Replaces any existing index. If *term_ids* is empty the index is
        cleared and ``is_ready`` will return ``False``.

        Args:
            term_ids: Ontology term identifiers (e.g. ``"HP:0001250"``),
                one per text.
            texts: Human-readable strings to embed, typically produced by
                ``build_embedding_text``.
        """
        if not term_ids:
            self._ids = []
            self._embeddings = None
            return
        self._embeddings = self._model.encode(texts)
        self._ids = list(term_ids)
        logger.info("Built embedding index: %d terms, dim=%d", len(self._ids), self._embeddings.shape[1])

    def search(self, query: str, top_k: int = 20) -> list[tuple[str, float]]:
        """Find the *top_k* most similar terms to *query*.

        Returns:
            A list of ``(term_id, cosine_score)`` tuples sorted by descending
            similarity, or an empty list if the index has not been built.
        """
        if self._embeddings is None or len(self._ids) == 0:
            return []
        query_vec = self._model.encode([query])
        scores = (self._embeddings @ query_vec.T).ravel()
        k = min(top_k, len(scores))
        partitioned = np.argpartition(scores, -k)[-k:]
        top_indices = partitioned[np.argsort(scores[partitioned])[::-1]]
        return [(self._ids[i], float(scores[i])) for i in top_indices]

    @property
    def is_ready(self) -> bool:
        """Return ``True`` if the index contains at least one embedded term."""
        return self._embeddings is not None and len(self._ids) > 0
