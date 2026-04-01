"""Embedding-based semantic search over ontology terms.

Uses sentence-transformers to generate embeddings locally — no external API
required. Maintains an in-memory cache of term embeddings (id -> vector) and
persists them to a JSON file so they survive server restarts. Uses cosine
similarity for ranking search results.
"""

import json
import logging
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "all-MiniLM-L6-v2"
CACHE_PATH = Path("/tmp/obo_embeddings.json")
BATCH_SIZE = 256


class EmbeddingService:
    """Generates, caches, and searches text embeddings for ontology terms."""

    def __init__(self, model_name: str = DEFAULT_MODEL):
        logger.info("Loading embedding model: %s", model_name)
        self._model = SentenceTransformer(model_name)
        self._vectors: dict[str, np.ndarray] = {}
        self._metadata: dict[str, dict] = {}
        self._load_cache()

    @property
    def count(self) -> int:
        return len(self._vectors)

    def embed_terms(self, terms: list[dict]) -> None:
        """Generate embeddings for a list of ontology term dicts.

        Each dict should have at minimum ``id`` and ``name``.  Optional keys:
        ``definition``, ``synonyms`` (list[str]).
        """
        to_embed: list[tuple[str, str, dict]] = []
        for t in terms:
            tid = t["id"]
            text = self._term_to_text(t)
            meta = {"id": tid, "name": t.get("name", tid), "namespace": t.get("namespace")}
            to_embed.append((tid, text, meta))

        if not to_embed:
            return

        logger.info("Embedding %d terms", len(to_embed))

        ids = [x[0] for x in to_embed]
        texts = [x[1] for x in to_embed]
        metas = [x[2] for x in to_embed]

        vectors = self._model.encode(texts, batch_size=BATCH_SIZE, normalize_embeddings=True)

        for tid, vec, meta in zip(ids, vectors, metas):
            self._vectors[tid] = np.array(vec, dtype=np.float32)
            self._metadata[tid] = meta

        self._save_cache()
        logger.info("Embedded and cached %d terms", len(to_embed))

    def search(self, query: str, top_k: int = 20) -> list[dict]:
        """Semantic search: embed the query, return top-k terms by cosine similarity."""
        if not self._vectors:
            return []

        query_vec = self._model.encode([query], normalize_embeddings=True)[0].astype(np.float32)

        ids = list(self._vectors.keys())
        matrix = np.stack([self._vectors[tid] for tid in ids])

        scores = matrix @ query_vec  # vectors are L2-normalised
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            tid = ids[idx]
            results.append({
                **self._metadata.get(tid, {"id": tid}),
                "score": float(scores[idx]),
            })
        return results

    def clear(self) -> None:
        """Drop all cached embeddings (called before re-ingesting an ontology)."""
        self._vectors.clear()
        self._metadata.clear()
        if CACHE_PATH.exists():
            CACHE_PATH.unlink()

    @staticmethod
    def _term_to_text(term: dict) -> str:
        parts = [term.get("name", "")]
        defn = term.get("definition")
        if defn:
            parts.append(defn)
        syns = term.get("synonyms")
        if syns:
            parts.append("Synonyms: " + ", ".join(syns))
        return ". ".join(parts)

    def _save_cache(self) -> None:
        data = {
            tid: {
                "vector": self._vectors[tid].tolist(),
                "meta": self._metadata.get(tid, {}),
            }
            for tid in self._vectors
        }
        CACHE_PATH.write_text(json.dumps(data))
        logger.info("Saved %d embeddings to %s", len(data), CACHE_PATH)

    def _load_cache(self) -> None:
        if not CACHE_PATH.exists():
            return
        try:
            data = json.loads(CACHE_PATH.read_text())
            for tid, entry in data.items():
                vec = np.array(entry["vector"], dtype=np.float32)
                vec /= np.linalg.norm(vec)
                self._vectors[tid] = vec
                self._metadata[tid] = entry.get("meta", {"id": tid})
            logger.info("Loaded %d cached embeddings from %s", len(self._vectors), CACHE_PATH)
        except Exception as e:
            logger.warning("Failed to load embedding cache: %s", e)
