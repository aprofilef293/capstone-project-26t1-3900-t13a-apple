"""FastAPI application factory for the OBO Explorer API.

Wires up CORS, GZip compression, API routers, and the optional
``EmbeddingService`` used for semantic search.  The single entry point
is :func:`create_app`, which returns a fully configured ``FastAPI``
instance ready to be served by Uvicorn.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import Settings
from app.routers import file_upload, graph
from app.services.embedding import (
    EmbeddingService,
    HuggingFaceEmbeddingModel,
    LocalEmbeddingModel,
)
from app.services.gemini import GeminiTermExtractor
from app.services.memgraph import MemgraphService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def _rebuild_embedding_index(mg: MemgraphService, embedding_svc: EmbeddingService) -> None:
    """Populate the vector index from terms already stored in Memgraph.

    Queries all ``OntologyTerm`` nodes from Memgraph (id, name, definition,
    synonyms, and comment) and passes them to
    ``EmbeddingService.build_index`` so that the semantic search feature is
    available immediately after startup.

    Args:
        mg: Active ``MemgraphService`` used to read ontology terms.
        embedding_svc: ``EmbeddingService`` whose index will be rebuilt.
    """
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) "
        "RETURN n.id AS id, n.name AS name, n.definition AS definition, "
        "n.synonyms AS synonyms, n.comment AS comment"
    )
    if not records:
        logger.info("No terms in Memgraph – embedding index left empty")
        return
    ids = [r["id"] for r in records]
    term_dicts = [dict(r) for r in records]
    await embedding_svc.build_index(ids, term_dicts)


def create_app() -> FastAPI:
    """Construct the FastAPI app, wire up CORS and the /api/graph router.

    CORS ``allow_origins`` is read from ``Settings.cors_origins`` so the Vite
    frontend (default http://localhost:5173) can call the API during development.

    Returns:
        FastAPI: The fully configured application instance with CORS,
        GZip middleware, and all API routers mounted.
    """
    settings = Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Manage application startup and shutdown lifecycle.

        On startup, initialises ``MemgraphService`` and, when
        ``Settings.embedding_enabled`` is ``True``, creates an
        ``EmbeddingService`` and rebuilds its vector index.  On
        shutdown, closes the Memgraph connection.

        Args:
            app: The ``FastAPI`` instance whose ``state`` will be populated.
        """
        app.state.settings = settings
        app.state.memgraph = MemgraphService(settings)

        # Graceful degradation — semantic search is unavailable if embedding setup fails, but the app still runs
        app.state.embedding_service = None
        if settings.embedding_enabled:
            if settings.embedding_local:
                model = LocalEmbeddingModel(settings.embedding_model_name)
                mode = "local"
            else:
                model = HuggingFaceEmbeddingModel(settings.embedding_model_name, settings.embedding_hf_token)
                mode = "remote"
            try:
                logger.info("Launching %s embedding service...", mode)
                app.state.embedding_service = EmbeddingService(model)
                # Warm up the model with a dummy encode so first search isn't so slow
                await model.encode(["warmup"])
                logger.info("Embedding model warmed up")
                # Restore the vector index from existing DB data so semantic search works immediately after restart
                await _rebuild_embedding_index(app.state.memgraph, app.state.embedding_service)
            except Exception as e:
                logger.warning("Embedding service failed to start, search will be unavailable: %s", e)
                app.state.embedding_service = None

        app.state.gemini = None
        if settings.gemini_enabled and settings.gemini_api_key:
            try:
                app.state.gemini = GeminiTermExtractor(settings.gemini_api_key, settings.gemini_model)
                logger.info("Gemini query expansion enabled")
            except Exception as e:
                logger.warning("Gemini failed to initialise, query expansion disabled: %s", e)
        else:
            logger.info("Gemini query expansion disabled (set GEMINI_API_KEY to enable)")

        # --- startup complete / shutdown begins ---
        yield
        app.state.memgraph.close()

    app = FastAPI(
        title="OBO Explorer API",
        version="0.1.0",
        description=(
            "REST API for browsing OBO ontology graphs stored in Memgraph. "
            "Returns nodes and edges in Graphology JSON format for rendering "
            "with Sigma.js on the frontend."
        ),
        lifespan=lifespan,
    )
    # Graph responses can be large JSON payloads — GZip cuts transfer size significantly
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
    app.include_router(file_upload.router, prefix="/api/ontology", tags=["upload"])

    return app


app = create_app()
