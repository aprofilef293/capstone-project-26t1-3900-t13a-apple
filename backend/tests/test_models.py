"""Unit tests for Pydantic models in app.models.graph and app.models.upload."""

import pytest
from pydantic import ValidationError

from app.models.graph import GraphData, SerializedEdge, SerializedNode
from app.models.upload import OntologyRelation, OntologyTerm, OntologyUploadResponse



class TestOntologyTerm:
    def test_minimal(self):
        term = OntologyTerm(id="GO:001", name="test")
        assert term.id == "GO:001"
        assert term.name == "test"
        assert term.namespace is None
        assert term.definition is None
        assert term.synonyms == []
        assert term.xrefs == []
        assert term.comment is None
        assert term.is_obsolete is False

    def test_full(self):
        term = OntologyTerm(
            id="GO:002",
            name="cell growth",
            namespace="biological_process",
            definition="The process of cell enlargement",
            synonyms=["growth", "enlargement"],
            xrefs=["PMID:123"],
            comment="A note",
            is_obsolete=True,
        )
        assert term.namespace == "biological_process"
        assert len(term.synonyms) == 2
        assert term.is_obsolete is True

    def test_preprocessing_defaults(self):
        term = OntologyTerm(id="X:1", name="x")
        assert term.size is None
        assert term.percentile_rank is None
        assert term.pagerank_score is None
        assert term.colour is None
        assert term.louvain is None
        assert term.viewLevel is None
        assert term.x is None
        assert term.y is None

    def test_preprocessing_attributes_settable(self):
        term = OntologyTerm(id="X:1", name="x")
        term.size = 5.0
        term.x = 100.5
        term.y = -50.3
        term.colour = "#ff0000"
        term.viewLevel = 3
        assert term.size == 5.0
        assert term.colour == "#ff0000"

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            OntologyTerm(id="X:1")  # missing name
        with pytest.raises(ValidationError):
            OntologyTerm(name="x")  # missing id

    def test_model_dump(self):
        term = OntologyTerm(id="T:1", name="test", synonyms=["a", "b"])
        d = term.model_dump()
        assert d["id"] == "T:1"
        assert d["synonyms"] == ["a", "b"]




class TestOntologyRelation:
    def test_creation(self):
        rel = OntologyRelation(subject_id="T:1", relation_type="is_a", object_id="T:2")
        assert rel.subject_id == "T:1"
        assert rel.relation_type == "is_a"
        assert rel.object_id == "T:2"

    def test_missing_fields(self):
        with pytest.raises(ValidationError):
            OntologyRelation(subject_id="T:1", relation_type="is_a")




class TestOntologyUploadResponse:
    def test_creation(self):
        resp = OntologyUploadResponse(
            filename="test.obo",
            term_count=100,
            relation_count=50,
            namespaces=["biological_process"],
            message="OK",
        )
        assert resp.filename == "test.obo"
        assert resp.term_count == 100
        assert resp.namespaces == ["biological_process"]




class TestSerializedNode:
    def test_minimal(self):
        node = SerializedNode(key="GO:001")
        assert node.key == "GO:001"
        assert node.attributes == {}

    def test_with_attributes(self):
        node = SerializedNode(key="GO:001", attributes={"label": "test", "x": 1.0})
        assert node.attributes["label"] == "test"




class TestSerializedEdge:
    def test_creation(self):
        edge = SerializedEdge(key="a-is_a-b", source="a", target="b")
        assert edge.source == "a"
        assert edge.target == "b"
        assert edge.attributes == {}

    def test_with_attributes(self):
        edge = SerializedEdge(
            key="a-is_a-b",
            source="a",
            target="b",
            attributes={"type": "is_a", "color": "#000"},
        )
        assert edge.attributes["type"] == "is_a"




class TestGraphData:
    def test_defaults(self):
        g = GraphData()
        assert g.nodes == []
        assert g.edges == []
        assert g.options["type"] == "directed"
        assert g.options["multi"] is True
        assert g.options["allowSelfLoops"] is True

    def test_with_data(self):
        g = GraphData(
            nodes=[SerializedNode(key="A")],
            edges=[SerializedEdge(key="A-B", source="A", target="B")],
        )
        assert len(g.nodes) == 1
        assert len(g.edges) == 1
