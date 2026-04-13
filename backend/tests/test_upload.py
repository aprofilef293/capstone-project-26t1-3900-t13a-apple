"""Ontology upload pipeline — requires a running Memgraph on localhost:7687."""

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
namespace: testing_space
def: "The root of everything" [REF:001]

[Term]
id: TEST:0002
name: child term
namespace: testing_space
def: "A child of root" [REF:002]
synonym: "kid term" EXACT []
is_a: TEST:0001

[Term]
id: TEST:0003
name: related term
namespace: testing_space
relationship: part_of TEST:0002
"""

SAMPLE_OBO_SMALL = b"""\
format-version: 1.2
ontology: test

[Term]
id: TEST:0001
name: only term
namespace: testing_space
"""

SAMPLE_OBO_WITH_OBSOLETE = b"""\
format-version: 1.2
ontology: test

[Term]
id: TEST:0001
name: active term
namespace: testing_space

[Term]
id: TEST:0002
name: dead term
namespace: testing_space
is_obsolete: true
"""


def _parse_sse_events(response_text):
    """Parse SSE events from a response body into a list of dicts."""
    events = []
    for chunk in response_text.strip().split("\n\n"):
        for line in chunk.split("\n"):
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: ") :]))
    return events


@pytest.mark.integration
class TestUploadValidation:
    def test_no_file_returns_422(self, real_client):
        resp = real_client.post("/api/ontology/upload", files={})
        assert resp.status_code == 422

    def test_unsupported_extension_returns_400(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("data.txt", SAMPLE_OBO, "text/plain")},
        )
        assert resp.status_code == 400
        assert "not supported" in resp.json()["detail"]

    def test_csv_rejected(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("data.csv", b"a,b,c", "text/csv")},
        )
        assert resp.status_code == 400

    def test_obo_extension_accepted(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        assert resp.status_code == 200

    def test_owl_extension_accepted(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.owl", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        assert resp.status_code != 400 or "not supported" not in resp.text


@pytest.mark.integration
class TestUploadSSEStream:
    def test_successful_upload_stages(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        events = _parse_sse_events(resp.text)
        stages = [e.get("stage") for e in events if "stage" in e]
        assert "parsed" in stages
        assert "preprocessed" in stages
        assert "terms_ingested" in stages
        assert "complete" in stages

    def test_complete_event_includes_filename(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("myfile.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        events = _parse_sse_events(resp.text)
        complete = next(e for e in events if e.get("stage") == "complete")
        assert complete["filename"] == "myfile.obo"

    def test_progress_increases(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        events = _parse_sse_events(resp.text)
        progress_values = [e["progress"] for e in events if "progress" in e]
        assert progress_values == sorted(progress_values)
        assert progress_values[-1] == 100

    def test_corrupted_file_returns_error_event(self, real_client):
        resp = real_client.post(
            "/api/ontology/upload",
            files={"file": ("bad.obo", io.BytesIO(b"not valid ontology data"), "text/plain")},
        )
        assert resp.status_code == 200
        events = _parse_sse_events(resp.text)
        assert any("error" in e for e in events)


@pytest.mark.integration
class TestDataIngestion:
    def test_correct_node_count(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        nodes = mg.execute_read("MATCH (n:OntologyTerm) RETURN n.id AS id")
        assert len(nodes) == 3

    def test_term_properties_stored(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        rows = mg.execute_read(
            "MATCH (n:OntologyTerm {id: 'TEST:0001'}) "
            "RETURN n.name AS name, n.namespace AS namespace, n.definition AS definition"
        )
        assert len(rows) == 1
        assert rows[0]["name"] == "root term"
        assert rows[0]["namespace"] == "testing_space"
        assert "root" in rows[0]["definition"].lower()

    def test_synonyms_stored(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        rows = mg.execute_read("MATCH (n:OntologyTerm {id: 'TEST:0002'}) RETURN n.synonyms AS synonyms")
        assert len(rows) == 1
        assert "kid term" in rows[0]["synonyms"]

    def test_relations_created(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        rels = mg.execute_read(
            "MATCH (s:OntologyTerm)-[r:RELATES_TO]->(o:OntologyTerm) RETURN s.id AS src, r.type AS type, o.id AS tgt"
        )
        rel_tuples = {(r["src"], r["type"], r["tgt"]) for r in rels}
        assert ("TEST:0002", "is_a", "TEST:0001") in rel_tuples
        assert ("TEST:0003", "part_of", "TEST:0002") in rel_tuples

    def test_source_file_stored(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("provenance.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        rows = mg.execute_read("MATCH (n:OntologyTerm) RETURN DISTINCT n.source_file AS sf")
        assert any(r["sf"] == "provenance.obo" for r in rows)

    def test_obsolete_terms_excluded(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO_WITH_OBSOLETE), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        nodes = mg.execute_read("MATCH (n:OntologyTerm) RETURN n.id AS id")
        ids = {n["id"] for n in nodes}
        assert "TEST:0001" in ids
        assert "TEST:0002" not in ids

    def test_preprocessing_attributes_set(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        rows = mg.execute_read(
            "MATCH (n:OntologyTerm {id: 'TEST:0001'}) "
            "RETURN n.x AS x, n.y AS y, n.size AS size, "
            "n.colour AS colour, n.viewLevel AS viewLevel, "
            "n.pagerank_score AS pr"
        )
        assert len(rows) == 1
        row = rows[0]
        assert row["x"] is not None
        assert row["y"] is not None
        assert row["size"] is not None
        assert row["colour"] is not None
        assert row["viewLevel"] is not None
        assert row["pr"] is not None


@pytest.mark.integration
class TestReUpload:
    def test_reupload_replaces_graph(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        mg = real_client.app.state.memgraph
        assert len(mg.execute_read("MATCH (n:OntologyTerm) RETURN n")) == 3

        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO_SMALL), "text/plain")},
        )
        assert len(mg.execute_read("MATCH (n:OntologyTerm) RETURN n")) == 1

    def test_reupload_clears_graph_cache(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        real_client.get("/api/graph/")
        assert real_client.app.state.graph_cache is not None

        real_client.post(
            "/api/ontology/upload",
            files={"file": ("test.obo", io.BytesIO(SAMPLE_OBO_SMALL), "text/plain")},
        )
        assert real_client.app.state.graph_cache is None


@pytest.mark.integration
class TestListOntologies:
    def test_list_after_upload(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("listed.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        resp = real_client.get("/api/ontology/list")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(r["source_file"] == "listed.obo" for r in data)

    def test_list_shows_term_count(self, real_client):
        real_client.post(
            "/api/ontology/upload",
            files={"file": ("counted.obo", io.BytesIO(SAMPLE_OBO), "text/plain")},
        )
        resp = real_client.get("/api/ontology/list")
        data = resp.json()
        entry = next(r for r in data if r["source_file"] == "counted.obo")
        assert entry["term_count"] == 3
