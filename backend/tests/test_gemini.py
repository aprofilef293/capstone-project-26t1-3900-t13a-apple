"""Tests for the Gemini query expansion service."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.gemini import GeminiTermExtractor, _parse_terms


class TestParseTerms:
    def test_basic(self):
        assert _parse_terms("heart failure, stroke, diabetes") == [
            "heart failure",
            "stroke",
            "diabetes",
        ]

    def test_strips_quotes(self):
        assert _parse_terms("\"heart failure\", 'stroke'") == ["heart failure", "stroke"]

    def test_empty_string(self):
        assert _parse_terms("") == []

    def test_whitespace_only(self):
        assert _parse_terms("  ,  , ") == []

    def test_single_term(self):
        assert _parse_terms("hypertension") == ["hypertension"]


class TestExpandBypass:
    """Tests for conditions that skip the Gemini API call entirely."""

    @pytest.mark.asyncio
    async def test_no_client(self):
        extractor = GeminiTermExtractor(api_key="")
        assert await extractor.expand("heart failure treatment") is None

    @pytest.mark.asyncio
    async def test_query_contains_comma(self):
        with patch("app.services.gemini.genai"):
            extractor = GeminiTermExtractor(api_key="fake-key")
        assert await extractor.expand("heart failure, stroke") is None

    @pytest.mark.asyncio
    async def test_query_two_words_or_fewer(self):
        with patch("app.services.gemini.genai"):
            extractor = GeminiTermExtractor(api_key="fake-key")
        assert await extractor.expand("heart") is None
        assert await extractor.expand("heart failure") is None

    @pytest.mark.asyncio
    async def test_three_words_not_bypassed(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        mock_response.text = "Heart Failure, Cardiac Output"
        mock_genai.Client.return_value.models.generate_content = MagicMock(return_value=mock_response)

        result = await extractor.expand("heart failure treatment")
        assert result == ["Heart Failure", "Cardiac Output"]


class TestExpandSuccess:
    @pytest.mark.asyncio
    async def test_returns_parsed_terms(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        mock_response.text = "Myocardial Infarction, Troponin, Chest Pain"
        mock_genai.Client.return_value.models.generate_content = MagicMock(return_value=mock_response)

        result = await extractor.expand("signs of a heart attack")
        assert result == ["Myocardial Infarction", "Troponin", "Chest Pain"]

    @pytest.mark.asyncio
    async def test_custom_model_passed_through(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key", model="gemini-custom")
        mock_response = MagicMock()
        mock_response.text = "Term A, Term B"
        mock_client = mock_genai.Client.return_value
        mock_client.models.generate_content = MagicMock(return_value=mock_response)

        await extractor.expand("some medical query here")
        mock_client.models.generate_content.assert_called_once()
        call_kwargs = mock_client.models.generate_content.call_args
        assert call_kwargs[1]["model"] == "gemini-custom" or call_kwargs.kwargs.get("model") == "gemini-custom"


class TestExpandCache:
    @pytest.mark.asyncio
    async def test_cache_hit(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        mock_response.text = "Term A, Term B"
        mock_client = mock_genai.Client.return_value
        mock_client.models.generate_content = MagicMock(return_value=mock_response)

        result1 = await extractor.expand("heart failure treatment options")
        result2 = await extractor.expand("heart failure treatment options")
        assert result1 == result2
        assert mock_client.models.generate_content.call_count == 1

    @pytest.mark.asyncio
    async def test_lru_eviction(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        mock_response.text = "Term A, Term B"
        mock_client = mock_genai.Client.return_value
        mock_client.models.generate_content = MagicMock(return_value=mock_response)

        # Fill cache beyond _MAX_CACHE_SIZE
        from app.services.gemini import _MAX_CACHE_SIZE

        for i in range(_MAX_CACHE_SIZE + 1):
            await extractor.expand(f"query number {i} words here")

        assert len(extractor._cache) == _MAX_CACHE_SIZE


class TestExpandErrors:
    @pytest.mark.asyncio
    async def test_timeout_returns_none(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_client = mock_genai.Client.return_value
        mock_client.models.generate_content = MagicMock(side_effect=TimeoutError)

        with patch("app.services.gemini._EXPAND_TIMEOUT", 0.001):
            result = await extractor.expand("heart failure treatment options")
        assert result is None

    @pytest.mark.asyncio
    async def test_api_error_returns_none(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_client = mock_genai.Client.return_value
        mock_client.models.generate_content = MagicMock(side_effect=RuntimeError("API down"))

        result = await extractor.expand("heart failure treatment options")
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_response_returns_none(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        mock_response.text = "  ,  , "
        mock_genai.Client.return_value.models.generate_content = MagicMock(return_value=mock_response)

        result = await extractor.expand("heart failure treatment options")
        assert result is None

    @pytest.mark.asyncio
    async def test_failure_not_cached(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_client = mock_genai.Client.return_value
        mock_client.models.generate_content = MagicMock(side_effect=RuntimeError("API down"))

        await extractor.expand("heart failure treatment options")
        assert "heart failure treatment options" not in extractor._cache

    @pytest.mark.asyncio
    async def test_safety_filtered_value_error(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        mock_response.text = property(lambda self: (_ for _ in ()).throw(ValueError("no candidates")))
        type(mock_response).text = property(lambda self: (_ for _ in ()).throw(ValueError("no candidates")))
        mock_genai.Client.return_value.models.generate_content = MagicMock(return_value=mock_response)

        result = await extractor.expand("heart failure treatment options")
        assert result is None

    @pytest.mark.asyncio
    async def test_safety_filtered_attribute_error(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        type(mock_response).text = property(lambda self: (_ for _ in ()).throw(AttributeError("no text")))
        mock_genai.Client.return_value.models.generate_content = MagicMock(return_value=mock_response)

        result = await extractor.expand("heart failure treatment options")
        assert result is None

    @pytest.mark.asyncio
    async def test_safety_filtered_not_cached(self):
        with patch("app.services.gemini.genai") as mock_genai:
            extractor = GeminiTermExtractor(api_key="fake-key")
        mock_response = MagicMock()
        type(mock_response).text = property(lambda self: (_ for _ in ()).throw(ValueError("no candidates")))
        mock_genai.Client.return_value.models.generate_content = MagicMock(return_value=mock_response)

        await extractor.expand("heart failure treatment options")
        assert "heart failure treatment options" not in extractor._cache
