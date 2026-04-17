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

from fastapi import APIRouter, Request
from pydantic import BaseModel

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
        emb = request.app.state.embedding_service
        engine_ok = emb is not None and emb.is_ready
    except Exception as exc:
        logger.warning("Health check – embedding service check failed: %s", exc)

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
    status_code=204,
    summary="Update API keys at runtime — hot-swaps dependent services immediately",
)
async def update_api_keys(payload: ApiKeysPayload, request: Request) -> None:
    """Store new API key values in the live settings object and reinitialise
    any services that depend on them.

    *Gemini* is reinitialised synchronously — it is a lightweight client init.

    *HuggingFace remote embeddings* are reinitialised in a background task
    because rebuilding the vector index can take tens of seconds.  The 204
    response is returned immediately; the service remains available (using the
    old model/token) until the background task completes.

    Args:
        payload: JSON body with optional ``huggingface_token`` and/or
            ``gemini_api_key`` fields.
        request: FastAPI request carrying ``app.state``.
    """
    app_state = request.app.state
    settings = app_state.settings

    # ── Gemini ───────────────────────────────────────────────────────────────
    if payload.gemini_api_key is not None:
        new_key = payload.gemini_api_key.strip()
        if new_key != settings.gemini_api_key:
            settings.gemini_api_key = new_key
            if new_key:
                try:
                    from app.services.gemini import GeminiTermExtractor

                    app_state.gemini = GeminiTermExtractor(new_key, settings.gemini_model)
                    logger.info("Gemini reinitialised with new API key")
                except Exception as exc:
                    logger.warning("Gemini failed to reinitialise: %s", exc)
            else:
                app_state.gemini = None
                logger.info("Gemini API key cleared — query expansion disabled")

    # ── HuggingFace ──────────────────────────────────────────────────────────
    if payload.huggingface_token is not None:
        new_token = payload.huggingface_token.strip()
        if new_token != settings.embedding_hf_token:
            settings.embedding_hf_token = new_token
            # Only reinitialise if the app is configured for remote inference;
            # local sentence-transformers mode ignores the token entirely.
            if not settings.embedding_local and settings.embedding_enabled:
                asyncio.create_task(
                    _reinit_hf_embedding(request.app),
                    name="reinit-hf-embedding",
                )
                logger.info(
                    "HuggingFace token updated — reinitialising embedding service in background"
                )


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
        logger.info(
            "HuggingFace embedding service reinitialised (%d terms indexed)", len(records)
        )
    except Exception as exc:
        logger.warning("HuggingFace embedding reinitialisation failed: %s", exc)
        # Leave the existing (possibly stale-token) service in place rather than
        # degrading to None, so semantic search remains available.
