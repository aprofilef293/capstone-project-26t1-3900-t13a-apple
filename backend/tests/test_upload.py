# tests/test_upload.py
import io


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

#Testing if a file was sent
def test_file_sent(real_client):
    response = real_client.post(
        "/api/obo-file-upload",
        files={}
    )
    
    assert response.status_code == 422

#Testing if a non .obo file is trying to be uploaded
def test_obo_format(real_client):
    response = real_client.post(
        "/api/obo-file-upload",
        files={"file": ("test.txt", sample_data_2, "text/plain")},
    )
    
    assert response.status_code == 400
        
#Testing obo file uploaded and querying db
def test_obo_integration(real_client):
    
    response = real_client.post(
        "/api/obo-file-upload",
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")},
    )
    
    mg = real_client.app.state.memgraph
    total_nodes = mg.execute_read("MATCH (n) RETURN n")
    assert len(total_nodes) == 3
    
    response = real_client.post(
        "/api/obo-file-upload",
        files={"file": ("test.obo", io.BytesIO(sample_data_3), "text/plain")},
    )
    total_nodes = mg.execute_read("MATCH (n) RETURN n")
    assert len(total_nodes) == 2
    print(response.text)
    assert response.status_code == 200
