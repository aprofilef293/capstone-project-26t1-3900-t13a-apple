import socket
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def _memgraph_available(host="localhost", port=7687):
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


_memgraph_running = _memgraph_available()


@pytest.fixture
def settings():
    return Settings(
        memgraph_uri="bolt://localhost:7687",
        memgraph_user="",
        memgraph_password="",
    )


@pytest.fixture
def mock_memgraph():
    mg = MagicMock()
    mg.verify_connectivity.return_value = True
    mg.execute_read.return_value = []
    mg.execute_write.return_value = []
    return mg


@pytest.fixture
def mock_embedding_service():
    svc = MagicMock()
    svc.search.return_value = [
        {"id": "GO:0006915", "name": "apoptotic process", "namespace": "biological_process", "score": 0.92},
        {"id": "GO:0012501", "name": "programmed cell death", "namespace": "biological_process", "score": 0.87},
    ]
    return svc


@pytest.fixture
def client(settings, mock_memgraph):
    app = create_app()
    app.state.settings = settings
    app.state.memgraph = mock_memgraph
    app.state.embedding_service = MagicMock()
    app.state.embedding_service.search.return_value = []
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def real_client(monkeypatch):
    if not _memgraph_running:
        pytest.skip("Memgraph is not running on localhost:7687")
    monkeypatch.setenv("MEMGRAPH_USER", "memgraph")
    monkeypatch.setenv("MEMGRAPH_PASSWORD", "memgraph")
    app = create_app()
    with TestClient(app, raise_server_exceptions=True) as client:
        yield client
