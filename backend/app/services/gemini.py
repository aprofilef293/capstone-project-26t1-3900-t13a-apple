from __future__ import annotations

import asyncio
import logging

from google import genai

logger = logging.getLogger(__name__)

_MODEL = "gemini-3-flash-preview"
_PROMPT = (
    "Transform the following medical query into a comma-separated list of MeSH terms and clinical "
    "descriptors for the bge-medical-small-en-v1.5 embedding model. Use formal NLM/PubMed nomenclature. "
    'Return only the comma-separated list.\n\n"{query}"'
)

# Timeout in seconds before giving up on Gemini and falling back to direct search.
_EXPAND_TIMEOUT = 15.0


class GeminiTermExtractor:
    def __init__(self, api_key: str) -> None:
        self._client = genai.Client(api_key=api_key) if api_key else None
        #Search cache save on gemini api
        self._cache: dict[str, list[str] | None] = {}

    async def expand(self, query: str) -> list[str] | None:
        if not self._client or "," in query or len(query.split()) <= 2:
            return None

        if query in self._cache:
            cached = self._cache[query]
            logger.debug("Gemini cache hit for %r", query)
            return cached

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self._client.models.generate_content,
                    model=_MODEL,
                    contents=_PROMPT.format(query=query),
                ),
                timeout=_EXPAND_TIMEOUT,
            )
            terms = [t.strip().strip("\"'") for t in response.text.split(",") if t.strip()]
            if terms:
                logger.info("Gemini expanded %r → %s", query, terms)
                self._cache[query] = terms
                return terms
            logger.warning("Gemini returned unparseable response: %r", response.text)
        except TimeoutError:
            logger.warning("Gemini timed out after %.1fs for %r — falling back to direct semantic search", _EXPAND_TIMEOUT, query)
        except Exception as exc:
            logger.warning("Gemini expansion failed (%s): %s — falling back to direct semantic search", type(exc).__name__, exc)

        self._cache[query] = None
        return None
