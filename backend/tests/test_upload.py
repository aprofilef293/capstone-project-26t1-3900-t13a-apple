# tests/test_upload.py
import io
import pytest

sample_data = b"""format-version: 1.2
                    
[Term]
id: TEST:0000001
name: test1
namespace: test1
"""

VALID_OBO_RELATIONS = b"""format-version: 1.2

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

#Testing if a file was sent
def test_file_sent(client):
    response = client.post(
        "/api/obo-file-upload",
        files={}
    )
    
    assert response.status_code == 422

#Testing if a non .obo file is trying to be uploaded
def test_obo_format(client):
    response = client.post(
        "/api/obo-file-upload",
        files={"file": ("test.txt", sample_data, "text/plain")},
    )
    
    assert response.status_code == 400
    

def test_valid_data_sent(client):
    
    response = client.post(
        "/api/obo-file-upload",
        files={"file": ("test.obo", io.BytesIO(VALID_OBO_RELATIONS), "text/plain")},
    )
    
    
    assert response.status_code == 200