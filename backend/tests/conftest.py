from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings():
    return Settings(
        memgraph_uri="bolt://localhost:7687",
        memgraph_user="",
        memgraph_password="",
        medgemma_api_url="",
        medgemma_api_key="",
    )


@pytest.fixture
def mock_memgraph():
    mg = MagicMock()
    mg.verify_connectivity.return_value = True
    mg.execute_read.return_value = []
    mg.execute_write.return_value = []
    return mg


@pytest.fixture
def client(settings, mock_memgraph):
    app = create_app()
    app.state.settings = settings
    app.state.memgraph = mock_memgraph
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def real_client():
    app = create_app()
    with TestClient(app, raise_server_exceptions=True) as client:
        yield client
