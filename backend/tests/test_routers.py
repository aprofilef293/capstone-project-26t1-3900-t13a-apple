"""Graph router helpers and endpoint behaviour with mocked Memgraph."""


class TestNodeFromRecord:
    """Unit tests for the _node_from_record helper."""

    def test_basic_node(self):
        from app.routers.graph import _node_from_record

        props = {"id": "GO:001", "name": "cell growth", "namespace": "biological_process"}
        node = _node_from_record(props, 0, 1)
        assert node.key == "GO:001"
        assert node.attributes["label"] == "cell growth"
        assert node.attributes["color"] == "#2563eb"
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

        props = {"id": "GO:001", "name": "test"}
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
            [],
            [],
        ]
        resp = client.get("/api/graph/path?source=FAKE:1&target=FAKE:2")
        assert resp.status_code == 404

    def test_shortest_path_no_path(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [],
            [{"id": "T:1"}, {"id": "T:2"}],
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
            [],
            [{"id": "T:1"}],
        ]
        resp = client.get("/api/graph/paths?ids=T:1&ids=T:2")
        assert resp.status_code == 404
        assert "T:2" in resp.json()["detail"]

    def test_multi_paths_no_path_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.side_effect = [
            [],
            [{"id": "T:1"}, {"id": "T:2"}],
        ]
        resp = client.get("/api/graph/paths?ids=T:1&ids=T:2")
        assert resp.status_code == 404
        assert "No paths found" in resp.json()["detail"]

    def test_export_csv_basic(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {
                    "id": "T:1",
                    "name": "cell growth",
                    "namespace": "biological_process",
                    "definition": "The process of growing",
                    "synonyms": ["growth"],
                    "xrefs": ["PMID:123"],
                    "comment": "A comment",
                    "is_obsolete": False,
                },
                "rel_type": "is_a",
                "target_id": "T:2",
                "target_name": "biological process",
            },
            {
                "node": {"id": "T:2", "name": "biological process", "namespace": "biological_process"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1&path_ids=T:2&selected_ids=T:1")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in resp.headers["content-disposition"]
        assert "path_export" in resp.headers["content-disposition"]

        lines = resp.text.lstrip("\ufeff").splitlines()
        assert len(lines) >= 3
        header = lines[0]
        assert "ID" in header
        assert "URL" in header
        assert "Name" in header
        assert "Definition" in header
        assert "Subclass Of" in header
        assert "Path Position" in header
        assert "Community" in header

    def test_export_csv_columns(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {
                    "id": "T:1",
                    "name": "term1",
                    "namespace": "biological_process",
                    "definition": "A definition",
                    "synonyms": ["syn1", "syn2"],
                    "xrefs": ["DB:001"],
                    "comment": "Some comment",
                    "is_obsolete": True,
                },
                "rel_type": "is_a",
                "target_id": "T:2",
                "target_name": "parent term",
            },
            {
                "node": {"id": "T:2", "name": "parent term", "namespace": "biological_process"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1&path_ids=T:2&selected_ids=T:1")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)

        t1 = next(r for r in rows if r["ID"] == "T:1")
        assert t1["Name"] == "term1"
        assert t1["Definition"] == "A definition"
        assert "syn1" in t1["Synonyms"]
        assert "syn2" in t1["Synonyms"]
        assert "DB:001" in t1["Cross-references"]
        assert "Some comment" in t1["Comments"]
        assert t1["Obsolete"] == "Yes"
        assert t1["Role"] == "Selected"
        assert "parent term [T:2]" in t1["Subclass Of"]

        t2 = next(r for r in rows if r["ID"] == "T:2")
        assert t2["Role"] == "Path Node"
        assert "term1 [T:1]" in t2["Has Subclasses"]

    def test_export_csv_neighbour_role(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {"id": "T:1", "name": "path node"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
            {
                "node": {"id": "T:3", "name": "neighbour node"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1&selected_ids=T:1")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        t3 = next((r for r in rows if r["ID"] == "T:3"), None)
        if t3:
            assert t3["Role"] == "Neighbour"

    def test_export_csv_other_relationships(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {"id": "T:1", "name": "term1"},
                "rel_type": "part_of",
                "target_id": "T:2",
                "target_name": "term2",
            },
            {
                "node": {"id": "T:2", "name": "term2"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1&path_ids=T:2")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        t1 = next(r for r in rows if r["ID"] == "T:1")
        assert "part of" in t1["Other Relationships"]
        assert "term2 [T:2]" in t1["Other Relationships"]

    def test_export_csv_no_path_ids(self, client):
        resp = client.get("/api/graph/paths/export")
        assert resp.status_code == 422

    def test_export_csv_not_found(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = []
        resp = client.get("/api/graph/paths/export?path_ids=FAKE:1")
        assert resp.status_code == 404

    def test_export_csv_none_values_cleaned(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {
                    "id": "T:1",
                    "name": "term1",
                    "definition": None,
                    "comment": None,
                    "synonyms": None,
                    "xrefs": None,
                    "namespace": None,
                },
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1")
        assert resp.status_code == 200
        assert "None" not in resp.text.replace("none", "").replace("content-disposition", "")

    def test_export_csv_sort_order(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {"node": {"id": "T:3", "name": "neighbour"}, "rel_type": None, "target_id": None, "target_name": None},
            {"node": {"id": "T:2", "name": "path"}, "rel_type": None, "target_id": None, "target_name": None},
            {"node": {"id": "T:1", "name": "selected"}, "rel_type": None, "target_id": None, "target_name": None},
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1&path_ids=T:2&selected_ids=T:1")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        roles = [r["Role"] for r in rows]
        assert roles.index("Selected") < roles.index("Path Node")
        assert roles.index("Path Node") < roles.index("Neighbour")

    def test_export_csv_url_id_split(self, client, mock_memgraph):
        """When the node id is a full URL, ID shows the short form and URL shows the full URL."""
        mock_memgraph.execute_read.return_value = [
            {
                "node": {
                    "id": "http://humanbehaviourchange.org/ontology/BCIO_006049",
                    "name": "some term",
                },
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=http://humanbehaviourchange.org/ontology/BCIO_006049")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        row = rows[0]
        assert row["ID"] == "BCIO_006049"
        assert row["URL"] == "http://humanbehaviourchange.org/ontology/BCIO_006049"

    def test_export_csv_url_ids_shortened_in_relationships(self, client, mock_memgraph):
        """URL-based IDs in relationship columns should be shortened."""
        mock_memgraph.execute_read.return_value = [
            {
                "node": {"id": "http://example.org/ont/T_1", "name": "term1"},
                "rel_type": "is_a",
                "target_id": "http://example.org/ont/T_2",
                "target_name": "term2",
            },
            {
                "node": {"id": "http://example.org/ont/T_2", "name": "term2"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get(
            "/api/graph/paths/export?path_ids=http://example.org/ont/T_1&path_ids=http://example.org/ont/T_2"
        )
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        t1 = next(r for r in rows if r["ID"] == "T_1")
        assert "term2 [T_2]" in t1["Subclass Of"]
        assert "http://" not in t1["Subclass Of"]

    def test_export_csv_path_position(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {"node": {"id": "T:1", "name": "first"}, "rel_type": None, "target_id": None, "target_name": None},
            {"node": {"id": "T:2", "name": "second"}, "rel_type": None, "target_id": None, "target_name": None},
            {"node": {"id": "T:3", "name": "neighbour"}, "rel_type": None, "target_id": None, "target_name": None},
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1&path_ids=T:2&selected_ids=T:1")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        t1 = next(r for r in rows if r["ID"] == "T:1")
        t2 = next(r for r in rows if r["ID"] == "T:2")
        t3 = next(r for r in rows if r["ID"] == "T:3")
        assert t1["Path Position"] == "1"
        assert t2["Path Position"] == "2"
        assert t3["Path Position"] == ""

    def test_export_csv_community(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {"id": "T:1", "name": "term1", "louvain": 3},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1")
        assert resp.status_code == 200

        import csv
        import io

        reader = csv.DictReader(io.StringIO(resp.text.lstrip("\ufeff")))
        rows = list(reader)
        assert rows[0]["Community"] == "3"

    def test_export_csv_filename_from_source(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [
            {
                "node": {"id": "T:1", "name": "term1", "source_file": "doid.obo"},
                "rel_type": None,
                "target_id": None,
                "target_name": None,
            },
        ]
        resp = client.get("/api/graph/paths/export?path_ids=T:1")
        assert resp.status_code == 200
        disposition = resp.headers["content-disposition"]
        assert "doid_subset.csv" in disposition

    def test_semantic_search_unavailable(self, client):
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
        mock_svc.search = AsyncMock(return_value=[("T:1", 0.3, "name")])
        client.app.state.embedding_service = mock_svc

        resp = client.get("/api/graph/semantic-search?q=test&threshold=0.5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == []

    def test_get_graph_caches_result(self, client, mock_memgraph):
        mock_memgraph.execute_read.return_value = [{"n": {"id": "T:1", "name": "a"}, "r": None, "m": None}]
        resp1 = client.get("/api/graph/")
        assert resp1.status_code == 200
        resp2 = client.get("/api/graph/")
        assert resp2.status_code == 200
        assert mock_memgraph.execute_read.call_count == 1
