"""Settings and health endpoints.

Exposes:
    GET  /api/health                — liveness probe for the graph DB and query engine.
    GET  /api/settings/api-keys     — boolean flags indicating whether each key is configured.
    POST /api/settings/api-keys     — update API keys at runtime without a server restart.

The POST endpoint hot-swaps the relevant service instances so changes take effect
immediately without restarting the process.  Fields set to ``None`` in the request
body are left unchanged; an empty string ``""`` clears the key.
"""

from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app import key_cache

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health", summary="Liveness probe for all backend services")
async def health(request: Request) -> dict:
    """Return the live status of the graph database and the query / embedding engine.

    Always returns HTTP 200 with boolean fields — callers should never see a 500
    from this endpoint.  Failures are logged and reported as ``false``.

    Returns:
        ``{"database": bool, "query_engine": bool}``
    """
    db_ok = False
    engine_ok = False

    try:
        mg = request.app.state.memgraph
        db_ok = await asyncio.to_thread(mg.verify_connectivity)
    except Exception as exc:
        logger.warning("Health check – database ping failed: %s", exc)

    try:
        gemini = request.app.state.gemini
        engine_ok = gemini is not None and await gemini.ping()
    except Exception as exc:
        logger.warning("Health check – Gemini connectivity check failed: %s", exc)

    return {"database": db_ok, "query_engine": engine_ok}


# ---------------------------------------------------------------------------
# API-key status
# ---------------------------------------------------------------------------


@router.get(
    "/settings/api-keys",
    summary="Return whether each API key is configured — never returns the raw values",
)
async def get_api_key_status(request: Request) -> dict:
    """Expose boolean configured-flags without leaking key material.

    Returns:
        ``{"huggingface_configured": bool, "gemini_configured": bool}``
    """
    settings = request.app.state.settings
    return {
        "huggingface_configured": bool(settings.embedding_hf_token),
        "gemini_configured": bool(settings.gemini_api_key),
    }


# ---------------------------------------------------------------------------
# API-key validation
# ---------------------------------------------------------------------------
@router.get(
    "/settings/api-keys/validate",
    summary="Live-test each configured API key and return per-key validity",
)
async def validate_api_keys(request: Request) -> dict:
    """Actively probe each configured key against its external API.

    Returns:
        ``{"huggingface_valid": bool|null, "gemini_valid": bool|null}``
    """
    settings = request.app.state.settings
    hf_valid: bool | None = None
    gemini_valid: bool | None = None

    if settings.embedding_hf_token:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://huggingface.co/api/whoami-v2",
                    headers={"Authorization": f"Bearer {settings.embedding_hf_token}"},
                )
                hf_valid = resp.status_code == 200
        except Exception as exc:
            hf_valid = False
            logger.warning("HuggingFace token validation failed: %s", exc)

    gemini = request.app.state.gemini
    if gemini is not None:
        gemini_valid = await gemini.ping()

    return {"huggingface_valid": hf_valid, "gemini_valid": gemini_valid}


# ---------------------------------------------------------------------------
# API-key update
# ---------------------------------------------------------------------------


class ApiKeysPayload(BaseModel):
    """Body for ``POST /api/settings/api-keys``.

    Each field is optional:
        - ``None``  (field absent from JSON) — leave the current value unchanged.
        - ``""``    (empty string)           — clear / disable the key.
        - any other string                  — set to the new value.
    """

    huggingface_token: str | None = None
    gemini_api_key: str | None = None


@router.post(
    "/settings/api-keys",
    summary="Update API keys at runtime — hot-swaps dependent services immediately",
)
async def update_api_keys(payload: ApiKeysPayload, request: Request) -> dict:
    """Store new API key values in the live settings object
    """
    app_state = request.app.state
    settings = app_state.settings

    gemini_valid: bool | None = None
    hf_valid: bool | None = None

    # ── Gemini ───────────────────────────────────────────────────────────────
    if payload.gemini_api_key is not None:
        new_key = payload.gemini_api_key.strip()
        if new_key:
            key_changed = new_key != settings.gemini_api_key
            if key_changed:
                settings.gemini_api_key = new_key
                try:
                    from app.services.gemini import GeminiTermExtractor
                    extractor = GeminiTermExtractor(new_key, settings.gemini_model)
                    app_state.gemini = extractor
                    logger.info("Gemini reinitialised with new API key")
                except Exception as exc:
                    gemini_valid = False
                    logger.warning("Gemini failed to reinitialise: %s", exc)
            if gemini_valid is None and app_state.gemini is not None:
                try:
                    gemini_valid = await app_state.gemini.ping()
                except Exception as exc:
                    gemini_valid = False
                    logger.warning("Gemini ping failed: %s", exc)
            logger.info("Gemini key updated=%s valid=%s", key_changed, gemini_valid)
        else:
            settings.gemini_api_key = ""
            app_state.gemini = None
            logger.info("Gemini API key cleared — query expansion disabled")

    # ── HuggingFace ──────────────────────────────────────────────────────────
    if payload.huggingface_token is not None:
        new_token = payload.huggingface_token.strip()
        if new_token:
            # Always validate the submitted token
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        "https://huggingface.co/api/whoami-v2",
                        headers={"Authorization": f"Bearer {new_token}"},
                    )
                    hf_valid = resp.status_code == 200
            except Exception as exc:
                hf_valid = False
                logger.warning("HuggingFace token validation failed: %s", exc)

            if new_token != settings.embedding_hf_token:
                settings.embedding_hf_token = new_token
                logger.info("HuggingFace token updated (valid=%s)", hf_valid)
                if not settings.embedding_local and settings.embedding_enabled:
                    asyncio.create_task(
                        _reinit_hf_embedding(request.app),
                        name="reinit-hf-embedding",
                    )
        else:
            settings.embedding_hf_token = ""

    key_cache.save(settings)
    return {"huggingface_valid": hf_valid, "gemini_valid": gemini_valid}


# ---------------------------------------------------------------------------
# Internal helper — HuggingFace embedding reinitialisation
# ---------------------------------------------------------------------------


async def _reinit_hf_embedding(app) -> None:  # type: ignore[type-arg]
    """Background task: rebuild the HuggingFace embedding service after a token change.

    Creates a fresh ``HuggingFaceEmbeddingModel`` with the updated token, wraps
    it in a new ``EmbeddingService``, probes the model dimension, warms it up,
    then rebuilds the vector index from the existing Memgraph terms.

    Any exception is logged and swallowed so the background task cannot crash
    the server.
    """
    from app.services.embedding import EmbeddingService, HuggingFaceEmbeddingModel

    settings = app.state.settings
    mg = app.state.memgraph
    try:
        model = HuggingFaceEmbeddingModel(settings.embedding_model_name, settings.embedding_hf_token)
        await model.ensure_ready()
        await model.encode(["warmup"])

        new_svc = EmbeddingService(model)

        # Rebuild vector index from existing Memgraph terms
        records = await asyncio.to_thread(
            mg.execute_read,
            "MATCH (n:OntologyTerm) "
            "RETURN n.id AS id, n.name AS name, n.definition AS definition, "
            "n.synonyms AS synonyms, n.comment AS comment",
        )
        if records:
            await new_svc.build_index([r["id"] for r in records], [dict(r) for r in records])

        app.state.embedding_service = new_svc
        logger.info("HuggingFace embedding service reinitialised (%d terms indexed)", len(records))
    except Exception as exc:
        logger.warning("HuggingFace embedding reinitialisation failed: %s", exc)
        # Leave the existing (possibly stale-token) service in place rather than
        # degrading to None, so semantic search remains available.
