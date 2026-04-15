"""Gemini-based query expansion for semantic search.

Converts natural-language medical queries into formal MeSH terms and
clinical descriptors via the Google Gemini LLM.  Expanded terms are
averaged into a semantic centroid by the embedding service, improving
recall for sentence-style searches.  Results are cached in a bounded
LRU cache; API failures fall back gracefully to direct search.
"""

from __future__ import annotations

import asyncio
import collections
import logging

from google import genai

logger = logging.getLogger(__name__)

_MAX_CACHE_SIZE = 256
_EXPAND_TIMEOUT = 15.0
_DEFAULT_MODEL = "gemini-2.5-flash"
_PROMPT = (
    "Transform the following medical query into a comma-separated list of MeSH terms and clinical "
    "descriptors for the bge-medical-small-en-v1.5 embedding model. Use formal NLM/PubMed nomenclature. "
    'Return only the comma-separated list.\n\n"{query}"'
)


def _parse_terms(text: str) -> list[str]:
    """Split a comma-separated Gemini response into cleaned terms.

    Strips leading/trailing whitespace and surrounding quotes from each
    term.  Empty segments are discarded.

    Args:
        text: Raw comma-separated string returned by the Gemini model.

    Returns:
        A list of cleaned term strings, possibly empty.
    """
    return [t.strip().strip("\"'") for t in text.split(",") if t.strip()]


class GeminiTermExtractor:
    """Expands natural-language queries into ontology-style terms via Gemini.

    Sends the query to the Gemini LLM with a prompt that requests MeSH
    terms and clinical descriptors.  Successful expansions are stored in
    a bounded LRU cache (up to ``_MAX_CACHE_SIZE`` entries) to avoid
    redundant API calls.  Transient failures are **not** cached so the
    same query can be retried on the next request.

    Args:
        api_key: Google AI Studio API key.  Pass an empty string to
            create a no-op extractor (``expand`` always returns ``None``).
        model: Gemini model ID (default ``gemini-2.5-flash``).
    """

    def __init__(self, api_key: str, model: str = "") -> None:
        self._client = genai.Client(api_key=api_key) if api_key else None
        self._model = model or _DEFAULT_MODEL
        self._cache: collections.OrderedDict[str, list[str]] = collections.OrderedDict()

    async def expand(self, query: str) -> list[str] | None:
        """Expand a search query into a list of formal medical terms.

        The query is sent to Gemini only when it looks like a sentence
        (no commas and more than two words).  Queries that already
        contain comma-separated terms or are very short are returned as
        ``None`` so the caller can fall back to a direct search.

        Args:
            query: The raw user search string.

        Returns:
            A list of expanded term strings on success, or ``None`` if
            expansion was skipped, the API call failed, or the response
            was unusable (e.g. safety-filtered).
        """
        if not self._client or "," in query:
            return None

        q_lower = query.lower().strip()
        first_word = q_lower.split()[0] if q_lower else ""
        is_question = q_lower.endswith("?") or first_word in (
            "what", "how", "why", "who", "where", "when", "which",
            "is", "are", "does", "do", "can", "could", "would", "should",
            "tell", "explain", "describe", "find", "show",
        )
        if not is_question:
            return None

        if query in self._cache:
            self._cache.move_to_end(query)
            return self._cache[query]

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self._client.models.generate_content,
                    model=self._model,
                    contents=_PROMPT.format(query=query),
                ),
                timeout=_EXPAND_TIMEOUT,
            )
        except TimeoutError:
            logger.warning("Gemini timed out after %.1fs for %r", _EXPAND_TIMEOUT, query)
            return None
        except Exception as exc:
            logger.warning("Gemini expansion failed for %r: %s", query, exc)
            return None

        # response.text raises if the safety filter blocked the response or
        # there are no candidates.  Handle separately so it's not confused
        # with an API/network error above.
        try:
            text = response.text
        except (ValueError, AttributeError):
            logger.warning("Gemini response had no usable text for %r (likely safety-filtered)", query)
            return None

        terms = _parse_terms(text)

        if not terms:
            logger.warning("Gemini returned no usable terms for %r", query)
            return None

        logger.info("Gemini expanded %r → %s", query, terms)
        self._cache[query] = terms
        if len(self._cache) > _MAX_CACHE_SIZE:
            self._cache.popitem(last=False)
        return terms
