# tests/test_upload.py
import io
import json

sample_data_2 = b"""format-version: 1.2

[Typedef]
id: part_of
name: part_of
is_transitive: true

[Term]
id: TEST:0000001
name: test1
namespace: testing_space

[Term]
id: TEST:0000002
name: test2
namespace: testing_space
is_a: TEST:0000001

[Term]
id: TEST:0000003
name: test3
namespace: testing_space
relationship: part_of TEST:0000002
"""

sample_data_3 = b"""format-version: 1.2

[Typedef]
id: part_of
name: part_of
is_transitive: true

[Term]
id: TEST:0000001
name: test1
namespace: testing_space

[Term]
id: TEST:0000002
name: test2
namespace: testing_space
is_a: TEST:0000001
"""


def _parse_sse_events(response_text):
    """Parse SSE events from a response body into a list of dicts."""
    events = []
    for chunk in response_text.strip().split("\n\n"):
        for line in chunk.split("\n"):
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: ") :]))
    return events


# Testing if a file was sent
def test_file_sent(real_client):
    response = real_client.post("/api/ontology/upload", files={})

    assert response.status_code == 422


# Testing if an unsupported file type is trying to be uploaded
def test_unsupported_format(real_client):
    response = real_client.post(
        "/api/ontology/upload",
        files={"file": ("test.txt", sample_data_2, "text/plain")},
    )

    assert response.status_code == 400


# Testing obo file uploaded and querying db via SSE stream
def test_obo_integration(real_client):
    response = real_client.post(
        "/api/ontology/upload",
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")},
    )
    assert response.status_code == 200

    events = _parse_sse_events(response.text)
    assert any(e.get("stage") == "complete" for e in events)

    mg = real_client.app.state.memgraph
    total_nodes = mg.execute_read("MATCH (n) RETURN n")
    assert len(total_nodes) == 3

    response = real_client.post(
        "/api/ontology/upload",
        files={"file": ("test.obo", io.BytesIO(sample_data_3), "text/plain")},
    )
    assert response.status_code == 200

    total_nodes = mg.execute_read("MATCH (n) RETURN n")
    assert len(total_nodes) == 2


# Testing corrupted file returns an error event in the SSE stream
def test_corrupted_file(real_client):
    response = real_client.post(
        "/api/ontology/upload",
        files={"file": ("bad.obo", io.BytesIO(b"not a valid ontology"), "text/plain")},
    )
    assert response.status_code == 200  # SSE stream still returns 200

    events = _parse_sse_events(response.text)
    assert any("error" in e for e in events)


# Testing the /list endpoint returns uploaded ontologies
def test_list_ontologies(real_client):
    real_client.post(
        "/api/ontology/upload",
        files={"file": ("test.obo", io.BytesIO(sample_data_3), "text/plain")},
    )

    response = real_client.get("/api/ontology/list")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


# Testing .owl extension is accepted
def test_owl_upload(real_client):
    response = real_client.post(
        "/api/ontology/upload",
        files={"file": ("test.owl", io.BytesIO(sample_data_2), "text/plain")},
    )

    # owl parsing may fail on obo-formatted data, but it should not reject the extension
    assert response.status_code != 400 or "Unsupported file type" not in response.text
