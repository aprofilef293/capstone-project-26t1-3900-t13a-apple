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
)
from app.services.memgraph import MemgraphService

logger = logging.getLogger(__name__)


def _rebuild_embedding_index(mg: MemgraphService, embedding_svc: EmbeddingService) -> None:
    """Populate the vector index from terms already stored in Memgraph."""
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
    embedding_svc.build_index(ids, term_dicts)


def create_app() -> FastAPI:
    """Construct the FastAPI app, wire up CORS and the /api/graph router.

    CORS ``allow_origins`` is read from ``Settings.cors_origins`` so the Vite
    frontend (default http://localhost:5173) can call the API during development.
    """
    settings = Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings
        app.state.memgraph = MemgraphService(settings)

        app.state.embedding_service = None
        if settings.embedding_enabled:
            try:
                logger.info(
                    "Connecting to HuggingFace Inference API (token=%s...)",
                    settings.embedding_hf_token[:10] if settings.embedding_hf_token else "NONE",
                )
                model = HuggingFaceEmbeddingModel(settings.embedding_model_name, settings.embedding_hf_token)
                app.state.embedding_service = EmbeddingService(model)
                _rebuild_embedding_index(app.state.memgraph, app.state.embedding_service)
            except Exception as e:
                logger.warning("Embedding service failed to start, search will be unavailable: %s", e)
                app.state.embedding_service = None

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
