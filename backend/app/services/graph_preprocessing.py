import colorsys
import hashlib
import json
import logging
import math
import os
import random
import sys
from pathlib import Path

import networkx as nx
import numpy as np
import scipy.sparse
import scipy.spatial

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_CACHE_DIR = Path("/app/.preprocessing_cache")


# Sample usage

# preprocessor = OntologyGraphPreprocessor()
# terms = preprocessor.preprocess(terms, relations)

try:
    from app.models.upload import OntologyRelation, OntologyTerm

    t_fdp_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "t-fdp"))
    if t_fdp_path not in sys.path:
        sys.path.append(t_fdp_path)

    from tfdp import tFDP
except ImportError as e:
    logger.warning(f"Missing library for GraphEnricher: {e}")


class OntologyGraphPreprocessor:
    """
    Applies PageRank, Louvain communities, view levels, and t-FDP layout
    to standard graph data, then resolves node overlaps.
    """

    def __init__(
        self,
        t_fdp_multiplier: float = 150.0,
        orbit_padding: float = 300.0,
        gap: float = 5.0,
        overlap_multiplier: float = 1.2,
    ):
        self.t_fdp_multiplier = t_fdp_multiplier
        self.orbit_padding = orbit_padding
        self.gap = gap  # minimum pixels between node surfaces
        self.overlap_multiplier = overlap_multiplier

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_distinct_colours(n: int) -> list[str]:
        if n == 0:
            return []
        colours = [
            "#{:02x}{:02x}{:02x}".format(*(int(c * 255) for c in colorsys.hsv_to_rgb(i / n, 0.7, 0.85)))
            for i in range(n)
        ]
        random.shuffle(colours)
        return colours

    @staticmethod
    def _resolve_overlaps(
        pos: np.ndarray,
        sizes: np.ndarray,
        gap: float,
        overlap_multiplier: float,
        max_iter: int = 50,
    ) -> np.ndarray:

        radii = sizes * overlap_multiplier

        # Upper bound on largest possible pair interaction distance
        max_search = float(np.max(radii) * 2 + gap + 1.0)

        for _ in range(max_iter):
            tree = scipy.spatial.KDTree(pos)
            pairs = tree.query_pairs(r=max_search, output_type="ndarray")
            if len(pairs) == 0:
                break

            i_idx = pairs[:, 0]
            j_idx = pairs[:, 1]

            vec = pos[i_idx] - pos[j_idx]  # shape (P, 2)
            dist = np.linalg.norm(vec, axis=1)  # shape (P,)

            min_dist = radii[i_idx] + radii[j_idx] + gap
            mask = dist < min_dist
            if not np.any(mask):
                break

            # Keep only truly overlapping pairs
            i_idx, j_idx = i_idx[mask], j_idx[mask]
            vec, dist, min_dist = vec[mask], dist[mask], min_dist[mask]
            ri, rj = radii[i_idx], radii[j_idx]

            zero = dist == 0
            if np.any(zero):
                vec[zero] = np.random.uniform(-0.1, 0.1, (zero.sum(), 2))
                dist[zero] = np.linalg.norm(vec[zero], axis=1)
                dist[dist == 0] = 1e-6

            overlap = min_dist - dist
            total_r = ri + rj
            total_r[total_r == 0] = 1.0

            # Larger nodes move less (weighted by the partner's radius)
            unit = vec / dist[:, None]
            push_i = unit * (overlap * rj / total_r * 0.9)[:, None]
            push_j = -unit * (overlap * ri / total_r * 0.9)[:, None]

            disp = np.zeros_like(pos)
            np.add.at(disp, i_idx, push_i)
            np.add.at(disp, j_idx, push_j)
            pos += disp

        return pos

    @staticmethod
    def _content_hash(terms: list[OntologyTerm], relations: list[OntologyRelation]) -> str:
        """Hash graph topology (node IDs + edges) for cache keying."""
        h = hashlib.sha256()
        for t in sorted(terms, key=lambda t: t.id):
            h.update(t.id.encode())
        for r in sorted(relations, key=lambda r: (r.subject_id, r.object_id, r.relation_type)):
            h.update(f"{r.subject_id}:{r.relation_type}:{r.object_id}".encode())
        return h.hexdigest()[:16]

    def _try_load_cache(self, content_hash: str, term_map: dict[str, OntologyTerm]) -> bool:
        """Load cached preprocessing results if available."""
        cache_file = _CACHE_DIR / f"preprocess_{content_hash}.npz"
        if not cache_file.exists():
            return False
        try:
            data = np.load(cache_file, allow_pickle=True)
            node_ids = list(data["node_ids"])
            attrs = json.loads(str(data["attrs"]))
            for nid in node_ids:
                if nid not in term_map or nid not in attrs:
                    return False
                a = attrs[nid]
                term = term_map[nid]
                term.x = a["x"]
                term.y = a["y"]
                term.size = a["size"]
                term.colour = a["colour"]
                term.viewLevel = a["viewLevel"]
                term.pagerank_score = a["pagerank_score"]
                term.percentile_rank = a["percentile_rank"]
            logger.info("[Preprocessor] Loaded from cache (%s)", cache_file.name)
            return True
        except Exception as e:
            logger.warning("[Preprocessor] Cache load failed, will recompute: %s", e)
            return False

    def _save_cache(self, content_hash: str, terms: list[OntologyTerm]) -> None:
        """Persist preprocessing results to disk."""
        try:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)
            node_ids = [t.id for t in terms]
            attrs = {}
            for t in terms:
                attrs[t.id] = {
                    "x": t.x,
                    "y": t.y,
                    "size": t.size,
                    "colour": t.colour,
                    "viewLevel": t.viewLevel,
                    "pagerank_score": t.pagerank_score,
                    "percentile_rank": t.percentile_rank,
                }
            cache_file = _CACHE_DIR / f"preprocess_{content_hash}.npz"
            np.savez(cache_file, node_ids=np.array(node_ids, dtype=object), attrs=json.dumps(attrs))
            logger.info("[Preprocessor] Saved cache (%s)", cache_file.name)
        except Exception as e:
            logger.warning("[Preprocessor] Failed to save cache: %s", e)

    def preprocess(self, terms: list[OntologyTerm], relations: list[OntologyRelation]) -> list[OntologyTerm]:
        logger.info("[Preprocessor] Building graph structures...")
        term_map = {term.id: term for term in terms}

        # Check cache first
        content_hash = self._content_hash(terms, relations)
        if self._try_load_cache(content_hash, term_map):
            terms.sort(key=lambda t: t.size, reverse=True)
            return terms
        G = nx.Graph()

        G.add_edges_from((rel.subject_id, rel.object_id) for rel in relations)
        G.add_nodes_from(term_map.keys())

        # PageRank & Sizes
        logger.info("[Preprocessor] Calculating PageRank sizes...")
        pr = nx.pagerank(G, tol=1e-4)
        pr_values = list(pr.values())
        min_pr, max_pr = min(pr_values), max(pr_values)
        pr_range = max_pr - min_pr + 1e-9

        sorted_pr = sorted(pr.items(), key=lambda x: x[1])
        num_nodes = len(sorted_pr)
        denom = max(1, num_nodes - 1)

        global_pr_ranks: dict[int, float] = {}
        for rank, (node_id, score) in enumerate(sorted_pr):
            term = term_map[node_id]
            term.size = round(1.0 + 14.0 * (score - min_pr) / pr_range, 2)
            term.percentile_rank = round(rank / denom, 4)
            term.pagerank_score = score
            global_pr_ranks[node_id] = (num_nodes - 1 - rank) / num_nodes

        # Louvain & View Levels
        logger.info("[Preprocessor] Detecting Communities and View Levels...")
        communities = nx.community.louvain_communities(G)
        palette = self._generate_distinct_colours(len(communities))
        degrees = dict(G.degree)

        for i, community_nodes in enumerate(communities):
            colour = palette[i]
            comm_sorted = sorted(((n, pr[n]) for n in community_nodes), key=lambda x: x[1], reverse=True)
            n_comm = len(comm_sorted)
            for local_rank, (node_id, _) in enumerate(comm_sorted):
                term = term_map[node_id]
                term.colour = colour

                rank_pct = local_rank / n_comm if n_comm > 1 else 0
                global_pct = global_pr_ranks[node_id]
                degree = degrees.get(node_id, 0)

                if degree <= 1:
                    term.viewLevel = 1
                elif global_pct <= 0.01 or (local_rank == 0 and n_comm > 10):
                    term.viewLevel = 5
                elif global_pct <= 0.05 or (rank_pct <= 0.05 and n_comm > 5):
                    term.viewLevel = 4
                elif global_pct <= 0.15 or rank_pct <= 0.20:
                    term.viewLevel = 3
                else:
                    term.viewLevel = 2

        # t-FDP Layout
        logger.info("[Preprocessor] Executing t-FDP Layout...")
        isolates = list(nx.isolates(G))
        connected_nodes = [n for n in G.nodes() if n not in isolates]

        if not connected_nodes:
            logger.info("[Preprocessor] No connected nodes found. Randomizing isolated positions.")
            for node_id in isolates:
                term = term_map[node_id]
                term.x = round(random.uniform(-50, 50), 2)
                term.y = round(random.uniform(-50, 50), 2)
            return terms

        adj = nx.to_scipy_sparse_array(G, nodelist=connected_nodes, format="csr", dtype=float)

        try:
            solver = tFDP(algo="ibFFT_CPU")
            solver.graph = scipy.sparse.tril(adj).tocsr()
            solver.edgesrc = adj.indptr
            solver.edgetgt = adj.indices
            pos, _ = solver.optimization()
            final_pos = pos * self.t_fdp_multiplier
        except Exception as e:
            logger.error(f"[Preprocessor] t-FDP execution failed: {e}")
            raise RuntimeError(f"t-FDP execution failed: {e}") from e

        # Overlap Resolution
        logger.info("[Preprocessor] Resolving node overlaps...")
        sizes = np.array([term_map[n].size for n in connected_nodes], dtype=float)
        final_pos = self._resolve_overlaps(final_pos, sizes, self.gap, self.overlap_multiplier)

        for idx, node_id in enumerate(connected_nodes):
            term = term_map[node_id]
            term.x = round(float(final_pos[idx, 0]), 2)
            term.y = round(float(final_pos[idx, 1]), 2)

        # Isolated Nodes – concentric orbit rings
        if isolates:
            logger.info(f"[Preprocessor] Placing {len(isolates)} isolated nodes in orbit...")
            cx = float(np.mean(final_pos[:, 0]))
            cy = float(np.mean(final_pos[:, 1]))
            orbit_r = float(np.max(np.linalg.norm(final_pos - [cx, cy], axis=1))) + self.orbit_padding
            spacing = 150
            placed = 0
            n_iso = len(isolates)

            while placed < n_iso:
                slots = max(1, int(2 * math.pi * orbit_r / spacing))
                batch = min(slots, n_iso - placed)
                angles = np.arange(batch) * (2 * math.pi / batch if batch > 1 else 0)
                xs = cx + orbit_r * np.cos(angles)
                ys = cy + orbit_r * np.sin(angles)
                for k in range(batch):
                    term = term_map[isolates[placed]]
                    term.x = round(float(xs[k]), 2)
                    term.y = round(float(ys[k]), 2)
                    placed += 1
                orbit_r += spacing

        logger.info("[Preprocessor] Graph preprocessing complete.")
        self._save_cache(content_hash, terms)
        terms.sort(key=lambda t: t.size, reverse=True)
        return terms
