"""Embedding service: field extraction, text building, indexing, search, and HF model."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from app.services.embedding import (
    EmbeddingService,
    HuggingFaceEmbeddingModel,
    build_embedding_text,
    build_field_texts,
)


class TestBuildFieldTexts:
    def test_all_fields_present(self):
        term = {
            "name": "cell growth",
            "definition": "The process of cell enlargement",
            "synonyms": ["growth", "enlargement"],
            "comment": "A note",
        }
        result = build_field_texts(term)
        assert result["name"] == "cell growth"
        assert result["definition"] == "The process of cell enlargement"
        assert result["synonyms"] == "growth; enlargement"
        assert result["comment"] == "A note"

    def test_only_name(self):
        term = {"name": "mitosis"}
        result = build_field_texts(term)
        assert result == {"name": "mitosis"}

    def test_empty_term(self):
        assert build_field_texts({}) == {}

    def test_empty_name_excluded(self):
        term = {"name": "", "definition": "something"}
        result = build_field_texts(term)
        assert "name" not in result
        assert result["definition"] == "something"

    def test_empty_synonyms_excluded(self):
        term = {"name": "x", "synonyms": []}
        result = build_field_texts(term)
        assert "synonyms" not in result

    def test_none_values_excluded(self):
        term = {"name": "x", "definition": None, "comment": None}
        result = build_field_texts(term)
        assert result == {"name": "x"}


class TestBuildEmbeddingText:
    def test_joins_fields(self):
        term = {"name": "apoptosis", "definition": "Programmed cell death"}
        result = build_embedding_text(term)
        assert "apoptosis" in result
        assert "Programmed cell death" in result
        assert " . " in result

    def test_empty_term(self):
        assert build_embedding_text({}) == ""

    def test_single_field(self):
        assert build_embedding_text({"name": "foo"}) == "foo"


class TestContentHash:
    def test_deterministic(self):
        ids = ["A:1", "A:2"]
        dicts = [{"name": "alpha"}, {"name": "beta"}]
        h1 = EmbeddingService._content_hash(ids, dicts)
        h2 = EmbeddingService._content_hash(ids, dicts)
        assert h1 == h2

    def test_order_independent(self):
        ids_a = ["A:1", "A:2"]
        dicts_a = [{"name": "alpha"}, {"name": "beta"}]
        ids_b = ["A:2", "A:1"]
        dicts_b = [{"name": "beta"}, {"name": "alpha"}]
        assert EmbeddingService._content_hash(ids_a, dicts_a) == EmbeddingService._content_hash(ids_b, dicts_b)

    def test_different_content_different_hash(self):
        h1 = EmbeddingService._content_hash(["A:1"], [{"name": "alpha"}])
        h2 = EmbeddingService._content_hash(["A:1"], [{"name": "beta"}])
        assert h1 != h2

    def test_returns_16_char_hex(self):
        h = EmbeddingService._content_hash(["X:1"], [{"name": "x"}])
        assert len(h) == 16
        int(h, 16)


class TestIsReady:
    def test_not_ready_initially(self):
        model = MagicMock()
        svc = EmbeddingService(model)
        assert svc.is_ready is False

    def test_ready_after_ids_and_embeddings_set(self):
        model = MagicMock()
        svc = EmbeddingService(model)
        svc._ids = ["A:1"]
        svc._field_embeddings = {"name": np.array([[1.0, 0.0]])}
        assert svc.is_ready is True


def _make_mock_model(dim: int = 4):
    """Create a mock HuggingFaceEmbeddingModel that returns random unit vectors."""
    model = AsyncMock()
    model.dimension = dim

    async def fake_encode(texts):
        vecs = np.random.randn(len(texts), dim).astype(np.float32)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return vecs / norms

    model.encode = AsyncMock(side_effect=fake_encode)
    return model


class TestBuildIndex:
    @pytest.mark.asyncio
    async def test_empty_index(self):
        model = _make_mock_model()
        svc = EmbeddingService(model)
        await svc.build_index([], [])
        assert svc.is_ready is False
        assert svc._ids == []

    @pytest.mark.asyncio
    async def test_builds_index(self):
        model = _make_mock_model(dim=4)
        svc = EmbeddingService(model)
        ids = ["T:1", "T:2"]
        dicts = [
            {"name": "cell growth", "definition": "growth of cells"},
            {"name": "apoptosis"},
        ]
        with patch.object(svc, "_try_load_cache", return_value=False), patch.object(svc, "_save_cache"):
            await svc.build_index(ids, dicts)

        assert svc.is_ready is True
        assert svc._ids == ["T:1", "T:2"]
        assert "name" in svc._field_embeddings
        assert svc._field_embeddings["name"].shape == (2, 4)
        model.encode.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_hit_skips_encode(self):
        model = _make_mock_model()
        svc = EmbeddingService(model)
        with patch.object(svc, "_try_load_cache", return_value=True):
            await svc.build_index(["T:1"], [{"name": "x"}])
        model.encode.assert_not_called()


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_empty_index(self):
        model = _make_mock_model()
        svc = EmbeddingService(model)
        results = await svc.search("anything")
        assert results == []

    @pytest.mark.asyncio
    async def test_search_returns_results(self):
        dim = 8
        model = _make_mock_model(dim=dim)
        svc = EmbeddingService(model)

        ids = ["T:1", "T:2", "T:3"]
        dicts = [
            {"name": "cell growth"},
            {"name": "apoptosis", "definition": "programmed cell death"},
            {"name": "mitosis"},
        ]
        with patch.object(svc, "_try_load_cache", return_value=False), patch.object(svc, "_save_cache"):
            await svc.build_index(ids, dicts)

        results = await svc.search("cell", top_k=2)
        assert len(results) <= 2
        for tid, score, field in results:
            assert tid in ids
            assert isinstance(score, float)
            assert isinstance(field, str)

    @pytest.mark.asyncio
    async def test_search_top_k_limits(self):
        dim = 4
        model = _make_mock_model(dim=dim)
        svc = EmbeddingService(model)

        ids = [f"T:{i}" for i in range(20)]
        dicts = [{"name": f"term{i}"} for i in range(20)]
        with patch.object(svc, "_try_load_cache", return_value=False), patch.object(svc, "_save_cache"):
            await svc.build_index(ids, dicts)

        results = await svc.search("term", top_k=5)
        assert len(results) == 5


class TestHuggingFaceEmbeddingModel:
    @pytest.fixture(autouse=True)
    def _patch_httpx(self):
        """Patch httpx.AsyncClient so __init__ never opens a real connection."""
        with patch("httpx.AsyncClient"):
            yield

    def test_init_sets_url(self):
        model = HuggingFaceEmbeddingModel("test/model", "tok123")
        assert model._model_name == "test/model"
        assert "test/model" in model._url

    def test_dimension_none_initially(self):
        model = HuggingFaceEmbeddingModel()
        assert model.dimension is None

    @pytest.mark.asyncio
    async def test_request_with_retry_success(self):
        model = HuggingFaceEmbeddingModel("test/model", "tok")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [[0.1, 0.2, 0.3]]
        model._async_client = AsyncMock()
        model._async_client.post = AsyncMock(return_value=mock_resp)

        result = await model._request_with_retry(["hello"])
        assert result == [[0.1, 0.2, 0.3]]

    @pytest.mark.asyncio
    async def test_request_with_retry_retries_on_429(self):
        model = HuggingFaceEmbeddingModel("test/model", "tok")

        rate_limit_resp = MagicMock()
        rate_limit_resp.status_code = 429

        ok_resp = MagicMock()
        ok_resp.status_code = 200
        ok_resp.json.return_value = [[0.1, 0.2]]

        model._async_client = AsyncMock()
        model._async_client.post = AsyncMock(side_effect=[rate_limit_resp, ok_resp])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await model._request_with_retry(["hello"], max_retries=3)
        assert result == [[0.1, 0.2]]

    @pytest.mark.asyncio
    async def test_ensure_ready_caches_dimension(self):
        model = HuggingFaceEmbeddingModel("test/model", "tok")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [[0.1, 0.2, 0.3]]
        model._async_client = AsyncMock()
        model._async_client.post = AsyncMock(return_value=mock_resp)

        HuggingFaceEmbeddingModel._DIMENSION_CACHE.pop("test/model", None)

        await model.ensure_ready()
        assert model.dimension == 3

        model._async_client.post.reset_mock()
        await model.ensure_ready()
        model._async_client.post.assert_not_called()

    @pytest.mark.asyncio
    async def test_encode_returns_normalised_vectors(self):
        model = HuggingFaceEmbeddingModel("encode-test/model", "tok")

        model._dimension_val = 3

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [[3.0, 0.0, 4.0], [0.0, 1.0, 0.0]]
        model._async_client = AsyncMock()
        model._async_client.post = AsyncMock(return_value=mock_resp)

        result = await model.encode(["text1", "text2"])
        assert result.shape == (2, 3)
        norms = np.linalg.norm(result, axis=1)
        np.testing.assert_allclose(norms, 1.0, atol=1e-6)
