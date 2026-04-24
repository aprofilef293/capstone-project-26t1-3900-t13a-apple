"""Graph API endpoints — requires a running Memgraph on localhost:7687.

:author: aprofilef293
"""

import io
import json

import pytest

SAMPLE_OBO = b"""\
format-version: 1.2
ontology: test

[Typedef]
id: part_of
name: part_of
is_transitive: true

[Term]
id: TEST:0001
name: root term
namespace: test_ns
def: "The root of the ontology" [REF:001]

[Term]
id: TEST:0002
name: child term
namespace: test_ns
def: "A child of root" [REF:002]
synonym: "kid term" EXACT []
is_a: TEST:0001

[Term]
id: TEST:0003
name: related term
namespace: test_ns
def: "Related via part_of" [REF:003]
relationship: part_of TEST:0002

[Term]
id: TEST:0004
name: isolated term
namespace: test_ns
def: "No relationships" [REF:004]

[Term]
id: TEST:0005
name: deep child
namespace: test_ns
is_a: TEST:0003
"""


def _parse_sse_events(response_text):
    events = []
    for chunk in response_text.strip().split("\n\n"):
        for line in chunk.split("\n"):
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: ") :]))
    return events


@pytest.fixture(scope="module")
def seeded_client(request):
    """Start a real client and upload sample data once for the entire module."""
    import socket

    try:
        with socket.create_connection(("localhost", 7687), timeout=1):
            pass
    except OSError:
        pytest.skip("Memgraph is not running on localhost:7687")

    import os

    os.environ.setdefault("MEMGRAPH_USER", "")
    os.environ.setdefault("MEMGRAPH_PASSWORD", "")
    os.environ["EMBEDDING_ENABLED"] = "false"

    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()
    with TestClient(app, raise_server_exceptions=True) as client:
        resp = client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        assert any(e.get("stage") == "complete" for e in events)
        yield client


@pytest.mark.integration
class TestGetGraph:
    def test_returns_all_nodes(self, seeded_client):
        resp = seeded_client.get("/api/graph/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 5
        node_ids = {n["key"] for n in data["nodes"]}
        assert node_ids == {"TEST:0001", "TEST:0002", "TEST:0003", "TEST:0004", "TEST:0005"}

    def test_returns_edges(self, seeded_client):
        resp = seeded_client.get("/api/graph/")
        data = resp.json()
        assert len(data["edges"]) >= 3

    def test_node_attributes_present(self, seeded_client):
        resp = seeded_client.get("/api/graph/")
        data = resp.json()
        for node in data["nodes"]:
            attrs = node["attributes"]
            assert "label" in attrs
            assert "x" in attrs
            assert "y" in attrs
            assert "size" in attrs
            assert "color" in attrs

    def test_graphology_format(self, seeded_client):
        resp = seeded_client.get("/api/graph/")
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data
        assert "options" in data
        assert data["options"]["type"] == "directed"


@pytest.mark.integration
class TestGetNodeNeighborhood:
    def test_existing_node(self, seeded_client):
        resp = seeded_client.get("/api/graph/node/TEST:0002")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0002" in node_ids
        assert len(node_ids) >= 2

    def test_node_not_found(self, seeded_client):
        resp = seeded_client.get("/api/graph/node/FAKE:999")
        assert resp.status_code == 404

    def test_isolated_node(self, seeded_client):
        resp = seeded_client.get("/api/graph/node/TEST:0004")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0004" in node_ids

    def test_depth_2(self, seeded_client):
        resp = seeded_client.get("/api/graph/node/TEST:0001?depth=2")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids
        assert "TEST:0002" in node_ids


@pytest.mark.integration
class TestSearchGraph:
    def test_search_by_name(self, seeded_client):
        resp = seeded_client.get("/api/graph/search?q=root")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids

    def test_search_partial_match(self, seeded_client):
        resp = seeded_client.get("/api/graph/search?q=child")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0002" in node_ids
        assert "TEST:0005" in node_ids

    def test_search_case_insensitive(self, seeded_client):
        resp = seeded_client.get("/api/graph/search?q=ROOT")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids

    def test_search_no_results(self, seeded_client):
        resp = seeded_client.get("/api/graph/search?q=zzzznonexistent")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nodes"] == []

    def test_search_includes_neighbors(self, seeded_client):
        resp = seeded_client.get("/api/graph/search?q=root")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert len(node_ids) >= 1


@pytest.mark.integration
class TestShortestPath:
    def test_direct_path(self, seeded_client):
        resp = seeded_client.get("/api/graph/path?source=TEST:0001&target=TEST:0002")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids
        assert "TEST:0002" in node_ids
        assert len(data["edges"]) >= 1

    def test_multi_hop_path(self, seeded_client):
        resp = seeded_client.get("/api/graph/path?source=TEST:0001&target=TEST:0003")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids
        assert "TEST:0003" in node_ids
        assert len(data["nodes"]) >= 2

    def test_same_node(self, seeded_client):
        resp = seeded_client.get("/api/graph/path?source=TEST:0001&target=TEST:0001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 1

    def test_no_path_to_isolated(self, seeded_client):
        resp = seeded_client.get("/api/graph/path?source=TEST:0001&target=TEST:0004")
        assert resp.status_code == 404

    def test_source_not_found(self, seeded_client):
        resp = seeded_client.get("/api/graph/path?source=FAKE:1&target=TEST:0001")
        assert resp.status_code == 404

    def test_deep_path(self, seeded_client):
        resp = seeded_client.get("/api/graph/path?source=TEST:0001&target=TEST:0005")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids
        assert "TEST:0005" in node_ids


@pytest.mark.integration
class TestMultiShortestPaths:
    def test_two_connected_nodes(self, seeded_client):
        resp = seeded_client.get("/api/graph/paths?ids=TEST:0001&ids=TEST:0002")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert "TEST:0001" in node_ids
        assert "TEST:0002" in node_ids

    def test_three_nodes(self, seeded_client):
        resp = seeded_client.get("/api/graph/paths?ids=TEST:0001&ids=TEST:0002&ids=TEST:0003")
        assert resp.status_code == 200
        data = resp.json()
        node_ids = {n["key"] for n in data["nodes"]}
        assert {"TEST:0001", "TEST:0002", "TEST:0003"}.issubset(node_ids)

    def test_includes_isolated_fails(self, seeded_client):
        resp = seeded_client.get("/api/graph/paths?ids=TEST:0001&ids=TEST:0004")
        assert resp.status_code == 404

    def test_missing_node(self, seeded_client):
        resp = seeded_client.get("/api/graph/paths?ids=TEST:0001&ids=FAKE:999")
        assert resp.status_code == 404


@pytest.mark.integration
class TestSemanticSearchIntegration:
    def test_returns_503_when_disabled(self, seeded_client):
        resp = seeded_client.get("/api/graph/semantic-search?q=root")
        assert resp.status_code == 503
