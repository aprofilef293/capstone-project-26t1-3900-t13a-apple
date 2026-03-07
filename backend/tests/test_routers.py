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

    def test_node_not_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = []
        resp = client.get("/api/graph/node/FAKE:001")
        assert resp.status_code == 404

    def test_node_neighborhood(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [{"n": {"id": "T:1", "name": "term1", "namespace": "biological_process"}}],
            [
                {
                    "n": {"id": "T:1", "name": "term1", "namespace": "biological_process"},
                    "r": {"type": "is_a"},
                    "m": {"id": "T:2", "name": "term2", "namespace": "biological_process"},
                }
            ],
        ]
        resp = client.get("/api/graph/node/T:1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) >= 1
        assert data["edges"][0]["attributes"]["type"] == "is_a"
        assert data["edges"][0]["attributes"]["label"] == "is_a"
        node = data["nodes"][0]
        assert "id" in node["attributes"]
        assert "synonyms" in node["attributes"]
        assert isinstance(node["attributes"]["synonyms"], list)

    def test_search_graph(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "n": {
                    "id": "T:1",
                    "name": "cell growth",
                    "namespace": "biological_process",
                    "synonyms": ["growth of cell"],
                },
                "r": None,
                "m": None,
            }
        ]
        resp = client.get("/api/graph/search?q=cell")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 1
        node = data["nodes"][0]
        assert node["attributes"]["id"] == "T:1"
        assert node["attributes"]["synonyms"] == ["growth of cell"]

    def test_search_graph_empty_query(self, client):
        resp = client.get("/api/graph/search?q=")
        assert resp.status_code == 422
