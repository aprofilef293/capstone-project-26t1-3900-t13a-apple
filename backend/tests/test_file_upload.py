"""File upload helpers: term ingestion, relation ingestion, and batch splitting."""

from unittest.mock import MagicMock

from app.models.upload import OntologyRelation, OntologyTerm
from app.routers.file_upload import _ingest_relations, _ingest_terms


class TestIngestTerms:
    def _make_mg(self):
        mg = MagicMock()
        mg.execute_write.return_value = []
        return mg

    def test_drops_and_recreates_graph(self):
        mg = self._make_mg()
        terms = [OntologyTerm(id="T:1", name="term1")]
        _ingest_terms(mg, terms, "test.obo")

        write_calls = [c[0][0] for c in mg.execute_write.call_args_list]
        assert "STORAGE MODE IN_MEMORY_ANALYTICAL" in write_calls
        assert "DROP GRAPH" in write_calls
        assert "STORAGE MODE IN_MEMORY_TRANSACTIONAL" in write_calls
        assert any("CREATE INDEX" in c for c in write_calls)

    def test_skips_obsolete_terms(self):
        mg = self._make_mg()
        terms = [
            OntologyTerm(id="T:1", name="active"),
            OntologyTerm(id="T:2", name="obsolete", is_obsolete=True),
        ]
        _ingest_terms(mg, terms, "test.obo")

        unwind_calls = [c for c in mg.execute_write.call_args_list if "UNWIND" in str(c)]
        assert len(unwind_calls) == 1
        batch = unwind_calls[0].args[1]["terms"]
        assert len(batch) == 1
        assert batch[0]["id"] == "T:1"

    def test_adds_source_file(self):
        mg = self._make_mg()
        terms = [OntologyTerm(id="T:1", name="term1")]
        _ingest_terms(mg, terms, "myfile.obo")

        unwind_calls = [c for c in mg.execute_write.call_args_list if "UNWIND" in str(c)]
        batch = unwind_calls[0].args[1]["terms"]
        assert batch[0]["source_file"] == "myfile.obo"

    def test_batching_large_set(self):
        mg = self._make_mg()
        terms = [OntologyTerm(id=f"T:{i}", name=f"term{i}") for i in range(12000)]
        _ingest_terms(mg, terms, "big.obo")

        unwind_calls = [c for c in mg.execute_write.call_args_list if "UNWIND" in str(c)]
        assert len(unwind_calls) == 3

    def test_empty_terms(self):
        mg = self._make_mg()
        _ingest_terms(mg, [], "empty.obo")
        unwind_calls = [c for c in mg.execute_write.call_args_list if "UNWIND" in str(c)]
        assert len(unwind_calls) == 0


class TestIngestRelations:
    def _make_mg(self):
        mg = MagicMock()
        mg.execute_write.return_value = []
        return mg

    def test_creates_relations(self):
        mg = self._make_mg()
        relations = [
            OntologyRelation(subject_id="T:1", relation_type="is_a", object_id="T:2"),
            OntologyRelation(subject_id="T:2", relation_type="part_of", object_id="T:3"),
        ]
        _ingest_relations(mg, relations)

        unwind_calls = [c for c in mg.execute_write.call_args_list if "UNWIND" in str(c)]
        assert len(unwind_calls) == 1
        rels = unwind_calls[0].args[1]["rels"]
        assert len(rels) == 2
        assert rels[0] == {"subject": "T:1", "object": "T:2", "type": "is_a"}

    def test_empty_relations(self):
        mg = self._make_mg()
        _ingest_relations(mg, [])
        mg.execute_write.assert_not_called()

    def test_batching(self):
        mg = self._make_mg()
        relations = [
            OntologyRelation(subject_id=f"T:{i}", relation_type="is_a", object_id=f"T:{i + 1}") for i in range(11000)
        ]
        _ingest_relations(mg, relations)

        unwind_calls = [c for c in mg.execute_write.call_args_list if "UNWIND" in str(c)]
        assert len(unwind_calls) == 3
