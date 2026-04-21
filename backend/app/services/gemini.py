"""Gemini-based query expansion for semantic search.

Converts search queries into ontology-compatible terms via the Google Gemini LLM.
Expanded terms are searched individually and merged by best score, improving recall.
Results are cached in a bounded LRU cache; API failures fall back to direct search.
"""

from __future__ import annotations

import asyncio
import collections
import logging

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_MAX_CACHE_SIZE = 256
_EXPAND_TIMEOUT = 15.0
_DEFAULT_MODEL = "gemini-2.5-flash"
_PROMPT = (
    "You are helping search a biomedical/scientific ontology database (OBO or OWL format). "
    "Given the query below, produce a comma-separated list of ontology-compatible search terms:\n"
    "  1. The most precise ontology terms matching the query concept\n"
    "  2. Synonyms and alternate phrasings used in ontology definitions\n"
    "  3. Broader parent concepts and narrower child concepts\n"
    "  4. Related processes, functions, components, or mechanisms\n"
    "  5. Acronyms and abbreviations commonly used in the domain\n"
    "Use concise noun phrases as they would appear in ontology term names and definitions. "
    "Return ONLY the comma-separated list, no explanation.\n\n"
    'Query: "{query}"'
)


def _parse_terms(text: str) -> list[str]:
    return [t.strip().strip("\"'") for t in text.split(",") if t.strip()]


class GeminiTermExtractor:
    """Expands search queries into ontology-style terms via Gemini.

    Every non-empty query is sent to Gemini when a client is configured.
    Successful expansions are stored in a bounded LRU cache to avoid
    redundant API calls. Transient failures are not cached.

    Args:
        api_key: Google AI Studio API key. Pass an empty string to create
            a no-op extractor (``expand`` always returns ``None``).
        model: Gemini model ID (default ``gemini-2.5-flash``).
    """

    def __init__(self, api_key: str, model: str = "") -> None:
        self._client = genai.Client(api_key=api_key) if api_key else None
        self._model = model or _DEFAULT_MODEL
        self._cache: collections.OrderedDict[str, list[str]] = collections.OrderedDict()

    async def expand(self, query: str) -> list[str] | None:
        """Expand a search query into a list of ontology-compatible terms.

        Sends every non-empty query to Gemini when the client is configured.
        Returns ``None`` if the client is not set, the query is empty, the
        API call fails, or the response is unusable (e.g. safety-filtered).

        Args:
            query: The raw user search string.

        Returns:
            A list of expanded term strings on success, or ``None`` on failure.
        """
        if not self._client:
            return None

        query = query.strip()
        if not query:
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
                    config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=256),
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
        # there are no candidates. Handle separately so it's not confused
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

    async def ping(self, timeout: float = 5.0) -> bool:
        """Return True if the Gemini API key is set and the API is reachable.

        Makes a minimal models.list() call — no token consumption — to verify
        that the key is valid and the network path is open.
        """
        if not self._client:
            return False
        try:
            await asyncio.wait_for(
                asyncio.to_thread(lambda: next(iter(self._client.models.list()), None)),
                timeout=timeout,
            )
            return True
        except Exception as exc:
            logger.debug("Gemini ping failed: %s", exc)
            return False
