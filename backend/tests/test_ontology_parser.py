"""OBO file parsing: terms, relations, synonyms, comments, and obsolete flags.

:author: aprofilef293
"""

import tempfile

from app.services.ontology_parser import parse_ontology

SAMPLE_OBO = b"""\
format-version: 1.2
ontology: test

[Typedef]
id: part_of
name: part_of

[Term]
id: TEST:0001
name: root term
namespace: test_ns
def: "The root term" [REF:001]

[Term]
id: TEST:0002
name: child term
namespace: test_ns
def: "A child term" [REF:002]
synonym: "kid term" EXACT []
is_a: TEST:0001
comment: This is a child.

[Term]
id: TEST:0003
name: related term
namespace: test_ns
relationship: part_of TEST:0001

[Term]
id: TEST:0004
name: obsolete term
namespace: test_ns
is_obsolete: true
"""


class TestParseOntology:
    def _parse(self, content: bytes = SAMPLE_OBO, suffix: str = ".obo"):
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(content)
            f.flush()
            return parse_ontology(f.name)

    def test_returns_terms_and_relations(self):
        terms, relations = self._parse()
        assert isinstance(terms, list)
        assert isinstance(relations, list)
        assert len(terms) > 0

    def test_term_count(self):
        terms, _ = self._parse()
        assert len(terms) == 4

    def test_term_fields(self):
        terms, _ = self._parse()
        term_map = {t.id: t for t in terms}

        root = term_map["TEST:0001"]
        assert root.name == "root term"
        assert root.namespace == "test_ns"
        assert root.definition is not None
        assert "root" in root.definition.lower()

    def test_synonyms_parsed(self):
        terms, _ = self._parse()
        term_map = {t.id: t for t in terms}
        child = term_map["TEST:0002"]
        assert "kid term" in child.synonyms

    def test_comment_parsed(self):
        terms, _ = self._parse()
        term_map = {t.id: t for t in terms}
        child = term_map["TEST:0002"]
        assert child.comment == "This is a child."

    def test_obsolete_flag(self):
        terms, _ = self._parse()
        term_map = {t.id: t for t in terms}
        assert term_map["TEST:0004"].is_obsolete is True
        assert term_map["TEST:0001"].is_obsolete is False

    def test_is_a_relations(self):
        _, relations = self._parse()
        is_a_rels = [r for r in relations if r.relation_type == "is_a"]
        assert any(r.subject_id == "TEST:0002" and r.object_id == "TEST:0001" for r in is_a_rels)

    def test_other_relations(self):
        _, relations = self._parse()
        part_of_rels = [r for r in relations if r.relation_type == "part_of"]
        assert any(r.subject_id == "TEST:0003" and r.object_id == "TEST:0001" for r in part_of_rels)

    def test_relation_fields(self):
        _, relations = self._parse()
        for rel in relations:
            assert rel.subject_id
            assert rel.object_id
            assert rel.relation_type

    def test_empty_ontology(self):
        content = b"format-version: 1.2\nontology: empty\n"
        terms, relations = self._parse(content)
        assert terms == []
        assert relations == []
