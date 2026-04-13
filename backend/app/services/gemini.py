from __future__ import annotations

import logging

from google import genai

logger = logging.getLogger(__name__)

_MODEL = "gemini-3-flash-preview"
_PROMPT = (
    "Transform the following medical query into a comma-separated list of MeSH terms and clinical "
    "descriptors for the bge-medical-small-en-v1.5 embedding model. Use formal NLM/PubMed nomenclature. "
    'Return only the comma-separated list.\n\n"{query}"'
)


class GeminiTermExtractor:
    def __init__(self, api_key: str) -> None:
        self._client = genai.Client(api_key=api_key) if api_key else None

    async def expand(self, query: str) -> list[str] | None:
        if not self._client or "," in query or len(query.split()) <= 2:
            return None
        try:
            response = self._client.models.generate_content(
                model=_MODEL,
                contents=_PROMPT.format(query=query),
            )
            terms = [t.strip().strip("\"'") for t in response.text.split(",") if t.strip()]
            if terms:
                logger.info("Gemini expanded %r → %s", query, terms)
                return terms
            logger.warning("Gemini returned unparseable response: %r", response.text)
        except Exception as exc:
            logger.warning("Gemini expansion failed (%s): %s", type(exc).__name__, exc)
        return None
