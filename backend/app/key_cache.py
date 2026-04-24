"""Persist runtime-set API keys across server restarts.

The cache file contains keys in plaintext and should never be committed.
The file is written with mode ``0600`` on POSIX filesystems that support it.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import Settings

logger = logging.getLogger(__name__)

_MANAGED = ("embedding_hf_token", "gemini_api_key")

# Guard against rename drift: a typo or field rename in Settings would silently
# stop the cache from restoring that field.  Fail loudly at import time instead.
for _name in _MANAGED:
    assert _name in Settings.model_fields, f"_MANAGED refers to missing Settings field: {_name!r}"


def load(settings) -> None:
    """Apply cached key values to *settings* in-place.

    Only populates a field if it is currently empty, so operator-set
    env vars always take precedence over the cache.
    """
    path = Path(settings.key_cache_path)
    if not path.exists():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        for field in _MANAGED:
            cached = data.get(field) or ""
            if cached and not getattr(settings, field, ""):
                setattr(settings, field, cached)
                logger.info("Key cache: restored %s", field)
    except Exception as exc:
        logger.warning("Key cache: failed to read %s — %s", path, exc)


def save(settings) -> None:
    """Write current managed key values from *settings* to the cache file."""
    path = Path(settings.key_cache_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {field: getattr(settings, field, "") for field in _MANAGED}
        path.write_text(json.dumps(data), encoding="utf-8")
        # Best-effort owner-only permissions; silently skipped on filesystems
        # that don't support POSIX modes (e.g. some Windows/WSL mounts).
        try:
            path.chmod(0o600)
        except OSError:
            pass
    except Exception as exc:
        logger.warning("Key cache: failed to write %s — %s", path, exc)
