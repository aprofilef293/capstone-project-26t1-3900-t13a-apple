class TestSemanticSearch:
    def test_returns_results(self, client, mock_embedding_service):
        client.app.state.embedding_service = mock_embedding_service
        resp = client.get("/api/graph/semantic-search?q=apoptosis")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 2
        assert data["results"][0]["id"] == "GO:0006915"
        assert data["results"][0]["score"] == 0.92
        mock_embedding_service.search.assert_called_once_with("apoptosis", top_k=20)

    def test_empty_results(self, client):
        resp = client.get("/api/graph/semantic-search?q=nonexistent")
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_empty_query_rejected(self, client):
        resp = client.get("/api/graph/semantic-search?q=")
        assert resp.status_code == 422

    def test_missing_query_rejected(self, client):
        resp = client.get("/api/graph/semantic-search")
        assert resp.status_code == 422

    def test_returns_500_on_failure(self, client, mock_embedding_service):
        mock_embedding_service.search.side_effect = RuntimeError("model error")
        client.app.state.embedding_service = mock_embedding_service
        resp = client.get("/api/graph/semantic-search?q=apoptosis")
        assert resp.status_code == 500
        assert "Semantic search failed" in resp.json()["detail"]
