"""Gemini-based query expansion for semantic search.

Converts search queries into ontology-compatible terms via the Google Gemini LLM.
Expanded terms are searched individually and merged by best score, improving recall.
Results are cached in a bounded LRU cache; API failures fall back to direct search.

:author: Josephh21, aprofilef293
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
_DEFAULT_MODEL = "gemini-3-flash-preview"
_PROMPT = (
    "You are helping search a biomedical/scientific ontology database (OBO or OWL format). "
    "Your goal is to ANSWER the user's question by returning terms that satisfy what they "
    "are actually asking for — not just terms that describe the topic mentioned.\n\n"
    "Decide which case the query falls into:\n"
    "  - If the user is asking HOW TO TREAT or ADDRESS a condition (e.g. \"how to treat X\", "
    "\"ways to manage Y\", \"implementation plan for alcohol dependency\"), return GENERIC "
    "TREATMENT METHODS — broad categories of therapies, interventions, procedures, and "
    "clinical management strategies (e.g. \"cognitive behavioral therapy\", \"detoxification\", "
    "\"pharmacotherapy\", \"behavioral intervention\", \"relapse prevention\"). "
    "Do NOT return specific drug or brand names (e.g. naltrexone, acamprosate, disulfiram). "
    "Do NOT return terms describing the condition itself.\n"
    "  - If the user is asking for EXAMPLES or INSTANCES of something (e.g. \"genes that are "
    "hereditary\", \"diseases caused by mitochondrial dysfunction\", \"enzymes involved in "
    "glycolysis\"), return actual examples that answer the question — specific genes, "
    "diseases, enzymes, etc. — not generic terms about the category.\n"
    "  - If the user is asking ABOUT a concept or thing (e.g. \"alcohol dependency\", "
    "\"mitochondria\", \"what is X\"), return terms RELATING TO that thing — synonyms, "
    "broader/narrower concepts, related processes, components, and mechanisms.\n\n"
    "In every case, produce a comma-separated list of concise noun phrases as they would "
    "appear in ontology term names and definitions, including synonyms, alternate phrasings, "
    "and common acronyms. Return ONLY the comma-separated list, no explanation.\n\n"
    'Query: "{query}"'
)


def _parse_terms(text: str) -> list[str]:
    """Split a comma-separated Gemini response into cleaned terms.

    Strips surrounding whitespace and quote characters from each term and
    discards empty segments.

    Args:
        text: Raw comma-separated string returned by the Gemini model.

    Returns:
        A list of cleaned term strings, possibly empty.
    """
    return [t.strip().strip("\"'") for t in text.split(",") if t.strip()]


class GeminiTermExtractor:
    """Expands search queries into ontology-style terms via Gemini.

    Queries that already contain commas are treated as pre-structured
    term lists and are not expanded; every other non-empty query is
    sent to Gemini when a client is configured. Successful expansions
    are stored in a bounded LRU cache to avoid redundant API calls.
    Transient failures are not cached.

    Args:
        api_key: Google AI Studio API key. Pass an empty string to create
            a no-op extractor (``expand`` always returns ``None``).
        model: Gemini model ID (default ``gemini-3-flash-preview``).
    """

    def __init__(self, api_key: str, model: str = "") -> None:
        self._client = genai.Client(api_key=api_key) if api_key else None
        self._model = model or _DEFAULT_MODEL
        self._cache: collections.OrderedDict[str, list[str]] = collections.OrderedDict()

    async def expand(self, query: str) -> list[str] | None:
        """Expand a search query into a list of ontology-compatible terms.

        Returns ``None`` without calling Gemini if the client is not set,
        the query is empty, or the query already contains a comma (treated
        as an explicit term list supplied by the caller). Otherwise the
        query is sent to Gemini; returns ``None`` if the API call fails
        or the response is unusable (e.g. safety-filtered).

        Args:
            query: The raw user search string.

        Returns:
            A list of expanded term strings on success, or ``None`` on failure.
        """
        if not self._client:
            return None

        query = query.strip()
        if not query or "," in query:
            return None

        if query in self._cache:
            self._cache.move_to_end(query)
            return self._cache[query]

        config_kwargs: dict = {"temperature": 0.0, "max_output_tokens": 256}
        if self._model.startswith("gemini-3"):
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="medium")

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self._client.models.generate_content,
                    model=self._model,
                    contents=_PROMPT.format(query=query),
                    config=types.GenerateContentConfig(**config_kwargs),
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

        logger.debug("Gemini expanded %r → %s", query, terms)
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
