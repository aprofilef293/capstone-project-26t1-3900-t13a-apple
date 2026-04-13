"""Unit tests for app.config.Settings."""

from app.config import Settings


class TestSettings:
    def test_defaults(self):
        s = Settings(
            _env_file=None,  # don't read .env during tests
        )
        assert s.memgraph_uri == "bolt://localhost:7687"
        assert s.memgraph_user == ""
        assert s.memgraph_password == ""
        assert s.embedding_enabled is True
        assert s.cors_origins == ["http://localhost:5173"]
        assert s.debug is False
        assert s.upload_max_size_mb == 250

    def test_override(self):
        s = Settings(
            memgraph_uri="bolt://db:7687",
            embedding_enabled=False,
            debug=True,
            upload_max_size_mb=50,
            _env_file=None,
        )
        assert s.memgraph_uri == "bolt://db:7687"
        assert s.embedding_enabled is False
        assert s.debug is True
        assert s.upload_max_size_mb == 50

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("MEMGRAPH_URI", "bolt://custom:7687")
        monkeypatch.setenv("EMBEDDING_ENABLED", "false")
        monkeypatch.setenv("DEBUG", "true")
        s = Settings(_env_file=None)
        assert s.memgraph_uri == "bolt://custom:7687"
        assert s.embedding_enabled is False
        assert s.debug is True
