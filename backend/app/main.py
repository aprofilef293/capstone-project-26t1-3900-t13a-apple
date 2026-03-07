from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.routers import graph
from app.services.memgraph import MemgraphService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = Settings()
    app.state.settings = settings
    app.state.memgraph = MemgraphService(settings)
    yield
    # Shutdown
    app.state.memgraph.close()


def create_app() -> FastAPI:
    settings = Settings()
    app = FastAPI(
        title="OBO Explorer API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
    return app


app = create_app()
