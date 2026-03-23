class TestSemanticSearch:
    def test_returns_503_when_not_configured(self, client):
        resp = client.get("/api/graph/semantic-search?q=what+is+apoptosis")
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"]

    def test_returns_answer(self, client, mock_langchain_search):
        client.app.state.langchain_search = mock_langchain_search
        resp = client.get("/api/graph/semantic-search?q=what+is+apoptosis")
        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"] == "Apoptosis is programmed cell death."
        assert "MATCH" in data["cypher"]
        assert data["context"] != ""
        mock_langchain_search.query.assert_called_once_with("what is apoptosis")

    def test_empty_query_rejected(self, client):
        resp = client.get("/api/graph/semantic-search?q=")
        assert resp.status_code == 422

    def test_missing_query_rejected(self, client):
        resp = client.get("/api/graph/semantic-search")
        assert resp.status_code == 422

    def test_returns_500_on_llm_failure(self, client, mock_langchain_search):
        mock_langchain_search.query.side_effect = RuntimeError("LLM timeout")
        client.app.state.langchain_search = mock_langchain_search
        resp = client.get("/api/graph/semantic-search?q=what+is+apoptosis")
        assert resp.status_code == 500
        assert "Semantic search failed" in resp.json()["detail"]
