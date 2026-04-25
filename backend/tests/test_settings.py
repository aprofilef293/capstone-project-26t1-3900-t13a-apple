"""Tests for the settings / API-key management endpoints.

Focus: the validate-before-commit logic in ``update_api_keys`` — a key or
token that fails its validation probe must not displace the running service
nor get persisted to the cache.

:author: aprofilef293
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    """Override conftest's ``settings`` so the key cache writes into tmp_path."""
    return Settings(
        memgraph_uri="bolt://localhost:7687",
        memgraph_user="",
        memgraph_password="",
        embedding_enabled=False,
        key_cache_path=str(tmp_path / "keys.json"),
    )


@pytest.fixture
def client(settings, mock_memgraph):
    """Fresh app with the local settings/memgraph fixtures wired in."""
    app = create_app()
    app.state.settings = settings
    app.state.memgraph = mock_memgraph
    return TestClient(app, raise_server_exceptions=False)


def _make_gemini(ping_result: bool) -> MagicMock:
    """Build a stand-in for ``GeminiTermExtractor`` whose ``ping()`` is controllable."""
    mock = MagicMock()
    mock.ping = AsyncMock(return_value=ping_result)
    return mock


class TestUpdateApiKeysGemini:
    def test_bad_key_does_not_replace_working_extractor(self, client, settings):
        """A new key that fails ping() must not displace the live extractor or persist."""
        working = _make_gemini(ping_result=True)
        client.app.state.gemini = working
        settings.gemini_api_key = "existing-good-key"

        with patch("app.routers.settings.GeminiTermExtractor") as MockExtractor:
            MockExtractor.return_value = _make_gemini(ping_result=False)
            resp = client.post("/api/settings/api-keys", json={"gemini_api_key": "brand-new-bad-key"})

        assert resp.status_code == 200
        assert resp.json()["gemini_valid"] is False
        assert client.app.state.gemini is working
        assert settings.gemini_api_key == "existing-good-key"

    def test_valid_new_key_replaces_extractor(self, client, settings):
        """A new key whose ping() succeeds replaces the live extractor and is persisted to settings."""
        client.app.state.gemini = _make_gemini(ping_result=True)
        settings.gemini_api_key = "old-key"

        candidate = _make_gemini(ping_result=True)
        with patch("app.routers.settings.GeminiTermExtractor") as MockExtractor:
            MockExtractor.return_value = candidate
            resp = client.post("/api/settings/api-keys", json={"gemini_api_key": "new-good-key"})

        assert resp.status_code == 200
        assert resp.json()["gemini_valid"] is True
        assert client.app.state.gemini is candidate
        assert settings.gemini_api_key == "new-good-key"

    def test_unchanged_key_probes_live_extractor_without_reconstruction(self, client, settings):
        """POSTing the same key as current should not build a new extractor, just probe the live one."""
        live = _make_gemini(ping_result=True)
        client.app.state.gemini = live
        settings.gemini_api_key = "same-key"

        with patch("app.routers.settings.GeminiTermExtractor") as MockExtractor:
            resp = client.post("/api/settings/api-keys", json={"gemini_api_key": "same-key"})

        assert resp.status_code == 200
        assert resp.json()["gemini_valid"] is True
        MockExtractor.assert_not_called()
        live.ping.assert_awaited_once()
        assert client.app.state.gemini is live

    def test_clear_nulls_state(self, client, settings):
        """Empty-string key clears both settings and the live extractor."""
        client.app.state.gemini = _make_gemini(ping_result=True)
        settings.gemini_api_key = "some-key"

        resp = client.post("/api/settings/api-keys", json={"gemini_api_key": ""})

        assert resp.status_code == 200
        assert settings.gemini_api_key == ""
        assert client.app.state.gemini is None


class TestUpdateApiKeysHuggingFace:
    def test_invalid_token_not_committed(self, client, settings):
        """A token that fails whoami-v2 must not overwrite settings or trigger a reinit."""
        settings.embedding_hf_token = "existing-good"

        with (
            patch("app.routers.settings._probe_hf_token", new=AsyncMock(return_value=False)),
            patch("app.routers.settings._reinit_hf_embedding", new=AsyncMock()) as mock_reinit,
        ):
            resp = client.post("/api/settings/api-keys", json={"huggingface_token": "brand-new-bad"})

        assert resp.status_code == 200
        assert resp.json()["huggingface_valid"] is False
        assert settings.embedding_hf_token == "existing-good"
        mock_reinit.assert_not_called()

    def test_valid_token_commits_and_triggers_reinit_when_remote(self, client, settings):
        """A valid new token updates settings and kicks off the remote-embedding reinit."""
        settings.embedding_local = False
        settings.embedding_enabled = True
        settings.embedding_hf_token = "old"

        with (
            patch("app.routers.settings._probe_hf_token", new=AsyncMock(return_value=True)),
            patch("app.routers.settings._reinit_hf_embedding", new=AsyncMock()) as mock_reinit,
        ):
            resp = client.post("/api/settings/api-keys", json={"huggingface_token": "new-good"})

        assert resp.status_code == 200
        assert resp.json()["huggingface_valid"] is True
        assert settings.embedding_hf_token == "new-good"
        mock_reinit.assert_called_once()

    def test_clear_nulls_embedding_service_when_remote(self, client, settings):
        """Clearing the token in remote mode must drop the running embedding service."""
        settings.embedding_local = False
        settings.embedding_hf_token = "old"
        running_svc = MagicMock()
        client.app.state.embedding_service = running_svc

        resp = client.post("/api/settings/api-keys", json={"huggingface_token": ""})

        assert resp.status_code == 200
        assert settings.embedding_hf_token == ""
        assert client.app.state.embedding_service is None

    def test_clear_preserves_embedding_service_when_local(self, client, settings):
        """Clearing the token in local mode leaves the local embedding service alone."""
        settings.embedding_local = True
        settings.embedding_hf_token = "old"
        local_svc = MagicMock()
        client.app.state.embedding_service = local_svc

        resp = client.post("/api/settings/api-keys", json={"huggingface_token": ""})

        assert resp.status_code == 200
        assert settings.embedding_hf_token == ""
        assert client.app.state.embedding_service is local_svc
