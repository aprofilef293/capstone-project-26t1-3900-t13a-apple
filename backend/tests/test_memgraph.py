"""MemgraphService: init, auth, read/write execution, and connectivity checks.

:author: aprofilef293
"""

from unittest.mock import MagicMock, patch

from app.config import Settings
from app.services.memgraph import MemgraphService


class TestMemgraphService:
    def _make_service(self):
        """Create a MemgraphService with a mocked driver."""
        settings = Settings(memgraph_uri="bolt://localhost:7687", memgraph_user="", memgraph_password="")
        with patch("app.services.memgraph.GraphDatabase") as mock_gdb:
            mock_driver = MagicMock()
            mock_gdb.driver.return_value = mock_driver
            svc = MemgraphService(settings)
        return svc, mock_driver

    def test_init_no_auth(self):
        settings = Settings(memgraph_uri="bolt://localhost:7687", memgraph_user="", memgraph_password="")
        with patch("app.services.memgraph.GraphDatabase") as mock_gdb:
            MemgraphService(settings)
            mock_gdb.driver.assert_called_once_with("bolt://localhost:7687", auth=None)

    def test_init_with_auth(self):
        settings = Settings(memgraph_uri="bolt://db:7687", memgraph_user="admin", memgraph_password="pass")
        with patch("app.services.memgraph.GraphDatabase") as mock_gdb:
            MemgraphService(settings)
            mock_gdb.driver.assert_called_once_with("bolt://db:7687", auth=("admin", "pass"))

    def test_close(self):
        svc, mock_driver = self._make_service()
        svc.close()
        mock_driver.close.assert_called_once()

    def test_execute_read(self):
        svc, mock_driver = self._make_service()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__ = MagicMock(return_value=mock_session)
        mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)

        mock_record = MagicMock()
        mock_record.data.return_value = {"id": "T:1", "name": "test"}
        mock_session.run.return_value = [mock_record]

        result = svc.execute_read("MATCH (n) RETURN n", {"id": "T:1"})
        assert result == [{"id": "T:1", "name": "test"}]
        mock_session.run.assert_called_once_with("MATCH (n) RETURN n", {"id": "T:1"})

    def test_execute_read_no_params(self):
        svc, mock_driver = self._make_service()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__ = MagicMock(return_value=mock_session)
        mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)
        mock_session.run.return_value = []

        result = svc.execute_read("MATCH (n) RETURN n")
        assert result == []
        mock_session.run.assert_called_once_with("MATCH (n) RETURN n", {})

    def test_execute_write(self):
        svc, mock_driver = self._make_service()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__ = MagicMock(return_value=mock_session)
        mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)
        mock_session.run.return_value = []

        result = svc.execute_write("CREATE (n:Test {id: $id})", {"id": "T:1"})
        assert result == []

    def test_verify_connectivity_success(self):
        svc, mock_driver = self._make_service()
        mock_driver.verify_connectivity.return_value = None
        assert svc.verify_connectivity() is True

    def test_verify_connectivity_failure(self):
        svc, mock_driver = self._make_service()
        mock_driver.verify_connectivity.side_effect = Exception("Connection refused")
        assert svc.verify_connectivity() is False
