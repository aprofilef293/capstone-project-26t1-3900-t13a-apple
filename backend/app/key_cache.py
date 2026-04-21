"""Persist runtime-set API keys across server restarts.
The cache file contains keys in plaintext it should not be committed"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_CACHE_PATH = Path("/app/.runtime_config/keys.json")
_MANAGED = ("embedding_hf_token", "gemini_api_key")


def load(settings) -> None:
    """Apply cached key values to *settings* in-place.

    Only populates a field if it is currently empty, so operator-set
    env vars always take precedence over the cache.
    """
    if not _CACHE_PATH.exists():
        return
    try:
        data = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
        for field in _MANAGED:
            cached = data.get(field) or ""
            if cached and not getattr(settings, field, ""):
                setattr(settings, field, cached)
                logger.info("Key cache: restored %s", field)
    except Exception as exc:
        logger.warning("Key cache: failed to read %s — %s", _CACHE_PATH, exc)


def save(settings) -> None:
    """Write current managed key values from *settings* to the cache file."""
    try:
        _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {field: getattr(settings, field, "") for field in _MANAGED}
        _CACHE_PATH.write_text(json.dumps(data), encoding="utf-8")
    except Exception as exc:
        logger.warning("Key cache: failed to write %s — %s", _CACHE_PATH, exc)
