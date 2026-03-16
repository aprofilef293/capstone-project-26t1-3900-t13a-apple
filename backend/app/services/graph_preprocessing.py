import colorsys
import logging
import math
import os
import random
import sys
import tempfile

import networkx as nx
import numpy as np
import scipy.io

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


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
    A script that applies PageRank, Louvain communities, View Levels, and t-FDP layouts to standard graph data.
    """

    def __init__(self, t_fdp_multiplier: float = 150.0, orbit_padding: float = 300.0):
        self.t_fdp_multiplier = t_fdp_multiplier
        self.orbit_padding = orbit_padding

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

    def preprocess(self, terms: list[OntologyTerm], relations: list[OntologyRelation]) -> list[OntologyTerm]:
        logger.info("[Preprocessor] Building Graph structures...")
        G = nx.Graph()

        term_map = {term.id: term for term in terms}

        G.add_edges_from((rel.subject_id, rel.object_id) for rel in relations)
        G.add_nodes_from(term_map.keys())

        # PageRank & Sizes
        logger.info("[Preprocessor] Calculating PageRank sizes...")
        pr = nx.pagerank(G)
        pr_values = list(pr.values())
        min_pr, max_pr = min(pr_values), max(pr_values)
        pr_range = max_pr - min_pr + 1e-9

        sorted_pr = sorted(pr.items(), key=lambda x: x[1])
        num_nodes = len(sorted_pr)
        num_nodes_minus_1 = max(1, num_nodes - 1)

        global_pr_ranks = {}
        for rank, (node_id, score) in enumerate(sorted_pr):
            term = term_map[node_id]
            term.size = round(1.0 + 14.0 * (score - min_pr) / pr_range, 2)
            term.percentile_rank = round(rank / num_nodes_minus_1, 4)
            term.pagerank_score = score

            global_pr_ranks[node_id] = (num_nodes - 1 - rank) / num_nodes

        # Louvain & View Levels
        logger.info("[Preprocessor] Detecting Communities and View Levels...")
        communities = nx.community.louvain_communities(G)
        palette = self._generate_distinct_colours(len(communities))
        degrees = dict(G.degree)

        for i, community_nodes in enumerate(communities):
            community_colour = palette[i]
            # Sort community nodes by PR descending
            comm_nodes_pr = sorted(((n, pr[n]) for n in community_nodes), key=lambda x: x[1], reverse=True)
            n_comm_nodes = len(comm_nodes_pr)

            for local_rank, (node_id, _) in enumerate(comm_nodes_pr):
                term = term_map[node_id]
                term.colour = community_colour

                rank_pct = local_rank / n_comm_nodes if n_comm_nodes > 1 else 0
                global_pct = global_pr_ranks[node_id]
                degree = degrees.get(node_id, 0)

                # View Level Logic
                if degree <= 1:
                    view_level = 1
                elif global_pct <= 0.01 or (local_rank == 0 and n_comm_nodes > 10):
                    view_level = 5
                elif global_pct <= 0.05 or (rank_pct <= 0.05 and n_comm_nodes > 5):
                    view_level = 4
                elif global_pct <= 0.15 or rank_pct <= 0.20:
                    view_level = 3
                else:
                    view_level = 2

                term.viewLevel = view_level

        # t-FDP Layout
        logger.info("[Preprocessor] Executing t-FDP Layout...")
        isolates = list(nx.isolates(G))
        connected_nodes = [n for n in G.nodes() if n not in isolates]

        # Early return if no edges exist at all
        if not connected_nodes:
            logger.info("[Preprocessor] No connected nodes found. Randomizing isolated positions.")
            for node_id in isolates:
                term = term_map[node_id]
                term.x = round(random.uniform(-50, 50), 2)
                term.y = round(random.uniform(-50, 50), 2)
            return terms

        adj = nx.to_scipy_sparse_array(G, nodelist=connected_nodes, dtype=float)

        fd, temp_mtx = tempfile.mkstemp(suffix=".mtx")
        os.close(fd)

        try:
            scipy.io.mmwrite(temp_mtx, adj)
            solver = tFDP(algo="ibFFT_CPU")
            solver.readgraph(temp_mtx)
            pos, _ = solver.optimization()
            final_pos = pos * self.t_fdp_multiplier

            for idx, node_id in enumerate(connected_nodes):
                term = term_map[node_id]
                term.x = round(float(final_pos[idx, 0]), 2)
                term.y = round(float(final_pos[idx, 1]), 2)

        except Exception as e:
            logger.error(f"[Preprocessor] t-FDP execution failed: {e}. Falling back to spring layout.")
            fallback_pos = nx.spring_layout(G.subgraph(connected_nodes), scale=self.t_fdp_multiplier)
            for node_id, coords in fallback_pos.items():
                term = term_map[node_id]
                term.x = round(float(coords[0]), 2)
                term.y = round(float(coords[1]), 2)

            final_pos = np.array([[term_map[n].x, term_map[n].y] for n in connected_nodes])

        finally:
            if os.path.exists(temp_mtx):
                os.remove(temp_mtx)

        # Isolated Nodes Orbit
        if isolates:
            logger.info(f"[Preprocessor] Positioning {len(isolates)} isolated nodes into orbit...")
            center_x = float(np.mean(final_pos[:, 0]))
            center_y = float(np.mean(final_pos[:, 1]))

            distances = np.linalg.norm(final_pos - [center_x, center_y], axis=1)
            orbit_radius = float(np.max(distances)) + self.orbit_padding

            spacing = 150
            nodes_placed = 0
            n_isolates = len(isolates)

            while nodes_placed < n_isolates:
                circumference = 2 * math.pi * orbit_radius
                nodes_in_this_ring = max(1, int(circumference / spacing))
                nodes_to_place = min(nodes_in_this_ring, n_isolates - nodes_placed)

                angle_step = 2 * math.pi / nodes_to_place if nodes_to_place > 1 else 0

                # angle/coordinate calculations
                angles = np.arange(nodes_to_place) * angle_step
                xs = center_x + orbit_radius * np.cos(angles)
                ys = center_y + orbit_radius * np.sin(angles)

                for i in range(nodes_to_place):
                    node_id = isolates[nodes_placed]
                    term = term_map[node_id]
                    term.x = round(float(xs[i]), 2)
                    term.y = round(float(ys[i]), 2)
                    nodes_placed += 1

                orbit_radius += spacing

        logger.info("[Preprocessor] Graph preprocessing complete.")
        return terms
