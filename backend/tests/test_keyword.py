import pytest
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

#Test for keyword in name
@pytest.mark.integration
def test_search_valid_keyword_name(real_client):
    real_client.post(
        '/api/ontology/upload',
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")}
    )

    response = real_client.get('/api/ontology/search?keyword=test1')
    assert response.status_code == 200
    data= response.json()
    assert len(data) == 1
    assert any(term["name"] == "test1" for term in data)
    print(data)
    

#Test for keyword in definition
@pytest.mark.integration
def test_search_valid_keyword_def(real_client):
    real_client.post(
        '/api/ontology/upload',
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")}
    )

    response = real_client.get('/api/ontology/search?keyword=cool')
    assert response.status_code == 200
    data= response.json()
    assert len(data) == 2
    assert any((term["definition"] == "cool" or term["definition"] == "not_cool") for term in data)
    print(data)


#Test for no valid keywrod given'
@pytest.mark.integration
def test_no_keyword_given(real_client):
    real_client.post(
        '/api/ontology/upload',
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")}
    )

    response = real_client.get('/api/ontology/search?keyword=')
    assert response.status_code == 400
    
#Testing no vlaid match in name
@pytest.mark.integration
def test_search_no_match_name(real_client):
    real_client.post(
        '/api/ontology/upload',
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")}
    )

    response = real_client.get('/api/ontology/search?keyword=test4')
    assert response.status_code == 200
    data= response.json()
    assert len(data) == 0
    print(data)


#Testing no vlaid match in definiton
@pytest.mark.integration
def test_no_match_def(real_client):
    real_client.post(
        '/api/ontology/upload',
        files={"file": ("test.obo", io.BytesIO(sample_data_2), "text/plain")}
    )

    response = real_client.get('/api/ontology/search?keyword=coooooooooool')
    assert response.status_code == 200
    data= response.json()
    assert len(data) == 2
    assert any((term["definition"] == "cool" or term["definition"] == "not_cool") for term in data)
    print(data)
