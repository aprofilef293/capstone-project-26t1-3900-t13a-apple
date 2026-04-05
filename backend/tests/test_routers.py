class TestNodeFromRecord:
    """Unit tests for the _node_from_record helper."""

    def test_basic_node(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "cell growth", "namespace": "biological_process"}
        node = _node_from_record(props, 0, 1)
        assert node.key == "GO:001"
        assert node.attributes["label"] == "cell growth"
        assert node.attributes["color"] == "#2563eb"  # biological_process -> Process -> blue
        assert node.attributes["nodeType"] == "Process"

    def test_molecular_function_namespace(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:002", "name": "binding", "namespace": "molecular_function"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["nodeType"] == "Material"
        assert node.attributes["color"] == "#9333ea"

    def test_cellular_component_namespace(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:003", "name": "membrane", "namespace": "cellular_component"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["nodeType"] == "Outcome"

    def test_stored_coordinates_used(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test", "x": 42.0, "y": -7.5}
        node = _node_from_record(props, 0, 10)
        assert node.attributes["x"] == 42.0
        assert node.attributes["y"] == -7.5

    def test_fallback_circular_layout(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test"}  # no x, y
        node = _node_from_record(props, 0, 4)
        assert isinstance(node.attributes["x"], float)
        assert isinstance(node.attributes["y"], float)

    def test_custom_colour_preserved(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test", "colour": "#ff0000"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["color"] == "#ff0000"

    def test_color_field_preserved(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test", "color": "#00ff00"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["color"] == "#00ff00"

    def test_size_default(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["size"] == 12.0

    def test_size_from_props(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test", "size": 5.678}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["size"] == 5.68

    def test_pagerank_rounded(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test", "pagerank_score": 0.123456789}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["pagerank_score"] == 0.1235

    def test_synonyms_default_empty(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "test"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["synonyms"] == []

    def test_name_used_as_label(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "my label"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["label"] == "my label"

    def test_missing_name_falls_back_to_id(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001"}
        node = _node_from_record(props, 0, 1)
        assert node.attributes["label"] == "GO:001"


class TestBuildGraphDataFromPaths:
    """Unit tests for the _build_graph_data_from_paths helper."""

    def test_empty_records(self):
        from app.routers.graph import _build_graph_data_from_paths

        result = _build_graph_data_from_paths([])
        assert result.nodes == []
        assert result.edges == []

    def test_single_node_no_edges(self):
        from app.routers.graph import _build_graph_data_from_paths

        records = [{"n": {"id": "T:1", "name": "term1"}, "r": None, "m": None}]
        result = _build_graph_data_from_paths(records)
        assert len(result.nodes) == 1
        assert result.edges == []

    def test_deduplicates_nodes(self):
        from app.routers.graph import _build_graph_data_from_paths

        records = [
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "is_a"}, "m": {"id": "T:2", "name": "b"}},
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "part_of"}, "m": {"id": "T:3", "name": "c"}},
        ]
        result = _build_graph_data_from_paths(records)
        assert len(result.nodes) == 3
        node_keys = {n.key for n in result.nodes}
        assert node_keys == {"T:1", "T:2", "T:3"}

    def test_deduplicates_edges(self):
        from app.routers.graph import _build_graph_data_from_paths

        records = [
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "is_a"}, "m": {"id": "T:2", "name": "b"}},
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "is_a"}, "m": {"id": "T:2", "name": "b"}},
        ]
        result = _build_graph_data_from_paths(records)
        assert len(result.edges) == 1

    def test_edge_attributes(self):
        from app.routers.graph import _build_graph_data_from_paths

        records = [
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "is_a"}, "m": {"id": "T:2", "name": "b"}},
        ]
        result = _build_graph_data_from_paths(records)
        edge = result.edges[0]
        assert edge.source == "T:1"
        assert edge.target == "T:2"
        assert edge.attributes["type"] == "is_a"
        assert edge.attributes["label"] == "is_a"

    def test_node_without_id_skipped(self):
        from app.routers.graph import _build_graph_data_from_paths

        records = [{"n": {"name": "no_id"}, "r": None, "m": None}]
        result = _build_graph_data_from_paths(records)
        assert len(result.nodes) == 0


class TestGraphRouter:
    def test_get_graph_empty(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = []
        resp = client.get("/api/graph/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == []
        assert data["edges"] == []

    def test_node_not_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = []
        resp = client.get("/api/graph/node/FAKE:001")
        assert resp.status_code == 404

    def test_node_neighborhood(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "n": {"id": "T:1", "name": "term1", "namespace": "biological_process"},
                "r": {"type": "is_a"},
                "m": {"id": "T:2", "name": "term2", "namespace": "biological_process"},
            }
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

    def test_node_neighborhood_with_depth(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "is_a"}, "m": {"id": "T:2", "name": "b"}},
        ]
        resp = client.get("/api/graph/node/T:1?depth=2")
        assert resp.status_code == 200

    def test_node_neighborhood_depth_validation(self, client):
        resp = client.get("/api/graph/node/T:1?depth=0")
        assert resp.status_code == 422
        resp = client.get("/api/graph/node/T:1?depth=4")
        assert resp.status_code == 422

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

    def test_shortest_path(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "n": {"id": "T:1", "name": "term1", "namespace": "biological_process"},
                "r": {"type": "is_a"},
                "m": {"id": "T:2", "name": "term2", "namespace": "biological_process"},
            },
            {
                "n": {"id": "T:2", "name": "term2", "namespace": "biological_process"},
                "r": {"type": "part_of"},
                "m": {"id": "T:3", "name": "term3", "namespace": "molecular_function"},
            },
        ]
        resp = client.get("/api/graph/path?source=T:1&target=T:3")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 3
        assert len(data["edges"]) == 2

    def test_shortest_path_source_not_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [],  # main BFS query returns nothing
            [],  # existence check also returns nothing
        ]
        resp = client.get("/api/graph/path?source=FAKE:1&target=FAKE:2")
        assert resp.status_code == 404

    def test_shortest_path_no_path(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [],  # main BFS query returns nothing
            [{"id": "T:1"}, {"id": "T:2"}],  # existence check finds both nodes
        ]
        resp = client.get("/api/graph/path?source=T:1&target=T:2")
        assert resp.status_code == 404

    def test_shortest_path_same_node(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {"n": {"id": "T:1", "name": "term1", "namespace": "biological_process"}, "r": None, "m": None},
        ]
        resp = client.get("/api/graph/path?source=T:1&target=T:1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 1

    # ----- /paths endpoint -----

    def test_multi_paths(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {"n": {"id": "T:1", "name": "a"}, "r": {"type": "is_a"}, "m": {"id": "T:2", "name": "b"}},
            {"n": {"id": "T:2", "name": "b"}, "r": {"type": "is_a"}, "m": {"id": "T:3", "name": "c"}},
        ]
        resp = client.get("/api/graph/paths?ids=T:1&ids=T:2&ids=T:3")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 3

    def test_multi_paths_too_few_ids(self, client):
        resp = client.get("/api/graph/paths?ids=T:1")
        assert resp.status_code == 422

    def test_multi_paths_too_many_ids(self, client):
        ids = "&".join(f"ids=T:{i}" for i in range(11))
        resp = client.get(f"/api/graph/paths?{ids}")
        assert resp.status_code == 422

    def test_multi_paths_not_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [],  # BFS returns nothing
            [{"id": "T:1"}],  # only T:1 found
        ]
        resp = client.get("/api/graph/paths?ids=T:1&ids=T:2")
        assert resp.status_code == 404
        assert "T:2" in resp.json()["detail"]

    def test_multi_paths_no_path_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [],  # BFS returns nothing
            [{"id": "T:1"}, {"id": "T:2"}],  # both nodes exist
        ]
        resp = client.get("/api/graph/paths?ids=T:1&ids=T:2")
        assert resp.status_code == 404
        assert "No paths found" in resp.json()["detail"]

    # ----- /semantic-search endpoint -----

    def test_semantic_search_unavailable(self, client):
        # client fixture has no embedding_service set
        resp = client.get("/api/graph/semantic-search?q=test")
        assert resp.status_code == 503

    def test_semantic_search_returns_results(self, client, mock_memgraph):
        from unittest.mock import AsyncMock

        mock_svc = AsyncMock()
        mock_svc.is_ready = True
        mock_svc.search = AsyncMock(return_value=[("T:1", 0.95, "name"), ("T:2", 0.8, "definition")])
        client.app.state.embedding_service = mock_svc

        mock_memgraph.execute_read.return_value = [
            {"n": {"id": "T:1", "name": "cell"}, "r": None, "m": None},
            {"n": {"id": "T:2", "name": "growth"}, "r": None, "m": None},
        ]

        resp = client.get("/api/graph/semantic-search?q=cell+growth")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 2
        # Nodes should have searchScore attribute
        node_map = {n["key"]: n for n in data["nodes"]}
        assert node_map["T:1"]["attributes"]["searchScore"] == 0.95

    def test_semantic_search_empty_results(self, client):
        from unittest.mock import AsyncMock

        mock_svc = AsyncMock()
        mock_svc.is_ready = True
        mock_svc.search = AsyncMock(return_value=[])
        client.app.state.embedding_service = mock_svc

        resp = client.get("/api/graph/semantic-search?q=nonexistent")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == []

    def test_semantic_search_threshold_filters(self, client):
        from unittest.mock import AsyncMock

        mock_svc = AsyncMock()
        mock_svc.is_ready = True
        # All results below the threshold
        mock_svc.search = AsyncMock(return_value=[("T:1", 0.3, "name")])
        client.app.state.embedding_service = mock_svc

        resp = client.get("/api/graph/semantic-search?q=test&threshold=0.5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == []

    # ----- GET /graph caching -----

    def test_get_graph_caches_result(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [{"n": {"id": "T:1", "name": "a"}, "r": None, "m": None}]
        # First call populates cache
        resp1 = client.get("/api/graph/")
        assert resp1.status_code == 200
        # Second call should use cache
        resp2 = client.get("/api/graph/")
        assert resp2.status_code == 200
        # execute_read should only have been called once
        assert mock_memgraph.execute_read.call_count == 1
