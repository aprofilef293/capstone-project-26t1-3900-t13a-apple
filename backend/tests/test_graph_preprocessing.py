"""Unit tests for app.services.graph_preprocessing — no external services."""

from __future__ import annotations

import numpy as np
import pytest

from app.models.upload import OntologyRelation, OntologyTerm
from app.services.graph_preprocessing import OntologyGraphPreprocessor

# ---------------------------------------------------------------------------
# _generate_distinct_colours
# ---------------------------------------------------------------------------


class TestGenerateDistinctColours:
    def test_zero_returns_empty(self):
        assert OntologyGraphPreprocessor._generate_distinct_colours(0) == []

    def test_returns_n_colours(self):
        colours = OntologyGraphPreprocessor._generate_distinct_colours(5)
        assert len(colours) == 5

    def test_hex_format(self):
        colours = OntologyGraphPreprocessor._generate_distinct_colours(3)
        for c in colours:
            assert c.startswith("#")
            assert len(c) == 7
            int(c[1:], 16)  # valid hex

    def test_single_colour(self):
        colours = OntologyGraphPreprocessor._generate_distinct_colours(1)
        assert len(colours) == 1


# ---------------------------------------------------------------------------
# _resolve_overlaps
# ---------------------------------------------------------------------------


class TestResolveOverlaps:
    def test_no_overlap(self):
        pos = np.array([[0.0, 0.0], [1000.0, 1000.0]])
        sizes = np.array([1.0, 1.0])
        result = OntologyGraphPreprocessor._resolve_overlaps(pos, sizes, gap=5.0, overlap_multiplier=1.2)
        # Positions should barely change since nodes are far apart
        np.testing.assert_allclose(result, pos, atol=1.0)

    def test_overlapping_nodes_pushed_apart(self):
        pos = np.array([[0.0, 0.0], [1.0, 0.0]])
        sizes = np.array([10.0, 10.0])
        result = OntologyGraphPreprocessor._resolve_overlaps(pos, sizes, gap=5.0, overlap_multiplier=1.2)
        dist = np.linalg.norm(result[0] - result[1])
        # After resolution, distance should be at least min_dist
        min_dist = 10.0 * 1.2 + 10.0 * 1.2 + 5.0
        assert dist >= min_dist * 0.8  # allow some tolerance

    def test_single_node(self):
        pos = np.array([[5.0, 5.0]])
        sizes = np.array([10.0])
        result = OntologyGraphPreprocessor._resolve_overlaps(pos, sizes, gap=5.0, overlap_multiplier=1.2)
        np.testing.assert_array_equal(result, pos)

    def test_identical_positions_jittered(self):
        pos = np.array([[0.0, 0.0], [0.0, 0.0]])
        sizes = np.array([5.0, 5.0])
        result = OntologyGraphPreprocessor._resolve_overlaps(pos, sizes, gap=1.0, overlap_multiplier=1.0)
        # Should have been pushed apart
        dist = np.linalg.norm(result[0] - result[1])
        assert dist > 0


# ---------------------------------------------------------------------------
# _content_hash
# ---------------------------------------------------------------------------


class TestPreprocessorContentHash:
    def test_deterministic(self):
        terms = [OntologyTerm(id="T:1", name="t1"), OntologyTerm(id="T:2", name="t2")]
        rels = [OntologyRelation(subject_id="T:1", relation_type="is_a", object_id="T:2")]
        h1 = OntologyGraphPreprocessor._content_hash(terms, rels)
        h2 = OntologyGraphPreprocessor._content_hash(terms, rels)
        assert h1 == h2

    def test_order_independent(self):
        t1 = OntologyTerm(id="T:1", name="a")
        t2 = OntologyTerm(id="T:2", name="b")
        rels = [OntologyRelation(subject_id="T:1", relation_type="is_a", object_id="T:2")]
        h1 = OntologyGraphPreprocessor._content_hash([t1, t2], rels)
        h2 = OntologyGraphPreprocessor._content_hash([t2, t1], rels)
        assert h1 == h2

    def test_different_graphs_different_hash(self):
        terms_a = [OntologyTerm(id="T:1", name="a")]
        terms_b = [OntologyTerm(id="T:1", name="a"), OntologyTerm(id="T:2", name="b")]
        h1 = OntologyGraphPreprocessor._content_hash(terms_a, [])
        h2 = OntologyGraphPreprocessor._content_hash(terms_b, [])
        assert h1 != h2


# ---------------------------------------------------------------------------
# preprocess  (mocked tFDP)
# ---------------------------------------------------------------------------


class TestPreprocess:
    def _make_terms_and_relations(self, n_terms=5):
        """Create a small connected graph for testing."""
        terms = [OntologyTerm(id=f"T:{i}", name=f"term{i}") for i in range(n_terms)]
        relations = [
            OntologyRelation(subject_id=f"T:{i}", relation_type="is_a", object_id=f"T:{i + 1}")
            for i in range(n_terms - 1)
        ]
        return terms, relations

    def test_preprocess_sets_attributes(self):
        terms, relations = self._make_terms_and_relations(5)
        preprocessor = OntologyGraphPreprocessor()

        with pytest.MonkeyPatch.context() as mp:
            # Mock cache to avoid filesystem access
            mp.setattr(preprocessor, "_try_load_cache", lambda *a: False)
            mp.setattr(preprocessor, "_save_cache", lambda *a: None)

            # Mock tFDP solver
            import app.services.graph_preprocessing as gp_module

            class FakeTFDP:
                def __init__(self, algo="ibFFT_CPU"):
                    self.graph = None
                    self.edgesrc = None
                    self.edgetgt = None

                def optimization(self):
                    n = self.edgesrc.shape[0] - 1  # CSR indptr has n+1 entries
                    pos = np.random.randn(n, 2).astype(np.float64)
                    return pos, None

            mp.setattr(gp_module, "tFDP", FakeTFDP)

            result = preprocessor.preprocess(terms, relations)

        assert len(result) == 5
        for term in result:
            assert term.x is not None
            assert term.y is not None
            assert term.size is not None
            assert term.colour is not None
            assert term.viewLevel is not None
            assert term.pagerank_score is not None
            assert term.percentile_rank is not None

    def test_preprocess_isolated_nodes(self):
        """Test that isolated nodes (no edges) get positioned."""
        terms = [OntologyTerm(id=f"T:{i}", name=f"term{i}") for i in range(3)]
        # No relations — all nodes are isolated
        preprocessor = OntologyGraphPreprocessor()

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(preprocessor, "_try_load_cache", lambda *a: False)
            mp.setattr(preprocessor, "_save_cache", lambda *a: None)

            result = preprocessor.preprocess(terms, [])

        for term in result:
            assert term.x is not None
            assert term.y is not None

    def test_preprocess_sorted_by_size_descending(self):
        terms, relations = self._make_terms_and_relations(5)
        preprocessor = OntologyGraphPreprocessor()

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(preprocessor, "_try_load_cache", lambda *a: False)
            mp.setattr(preprocessor, "_save_cache", lambda *a: None)

            import app.services.graph_preprocessing as gp_module

            class FakeTFDP:
                def __init__(self, algo="ibFFT_CPU"):
                    self.graph = None
                    self.edgesrc = None
                    self.edgetgt = None

                def optimization(self):
                    n = self.edgesrc.shape[0] - 1
                    return np.random.randn(n, 2), None

            mp.setattr(gp_module, "tFDP", FakeTFDP)

            result = preprocessor.preprocess(terms, relations)

        sizes = [t.size for t in result]
        assert sizes == sorted(sizes, reverse=True)

    def test_preprocess_single_node(self):
        terms = [OntologyTerm(id="T:0", name="lone")]
        preprocessor = OntologyGraphPreprocessor()

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(preprocessor, "_try_load_cache", lambda *a: False)
            mp.setattr(preprocessor, "_save_cache", lambda *a: None)

            result = preprocessor.preprocess(terms, [])

        assert len(result) == 1
        assert result[0].x is not None
        assert result[0].y is not None
