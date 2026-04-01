from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import Settings
from app.routers import file_upload, graph
from app.services.langchain_search import LangChainSearchService
from app.services.memgraph import MemgraphService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context that owns shared singletons.

    On startup: creates a ``Settings`` instance and a ``MemgraphService``,
    storing both on ``app.state`` so route handlers can access them via
    ``request.app.state.memgraph``.

    On shutdown: closes the Memgraph Bolt driver to release the connection.
    """
    settings = Settings()
    app.state.settings = settings
    app.state.memgraph = MemgraphService(settings)

    if settings.llm_api_url and settings.llm_api_key:
        app.state.langchain_search = LangChainSearchService(settings)
    else:
        app.state.langchain_search = None

    yield
    # Shutdown
    app.state.memgraph.close()


def create_app() -> FastAPI:
    """Construct the FastAPI app, wire up CORS and the /api/graph router.

    CORS ``allow_origins`` is read from ``Settings.cors_origins`` so the Vite
    frontend (default http://localhost:5173) can call the API during development.
    """
    settings = Settings()
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
