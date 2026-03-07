class TestGraphRouter:
    def test_get_graph_empty(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = []
        resp = client.get("/api/graph/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == []
        assert data["edges"] == []

    def test_get_graph_with_limit(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = []
        resp = client.get("/api/graph/?limit=50")
        assert resp.status_code == 200

    def test_get_graph_limit_exceeds_max(self, client):
        resp = client.get("/api/graph/?limit=5000")
        assert resp.status_code == 422
