"""FastAPI router for querying, searching, and exporting ontology graph data from Memgraph."""

import asyncio
import csv
import io
import logging
import math
import os
import time
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.models.graph import GraphData, SerializedEdge, SerializedNode

logger = logging.getLogger(__name__)

router = APIRouter()

# Maps GO namespace names to generic display types used in the frontend.
NODE_TYPE_MAP = {
    "biological_process": "Process",
    "molecular_function": "Material",
    "cellular_component": "Outcome",
}

# Maps display types to hex colours for Sigma.js node rendering.
COLOR_MAP = {
    "Process": "#2563eb",
    "Material": "#9333ea",
    "Outcome": "#10b981",
}


def _node_from_record(node_props: dict, index: int, total: int) -> SerializedNode:
    """Convert a raw Memgraph node property dict into a ``SerializedNode``.

    Uses stored x/y coordinates from t-FDP preprocessing when available,
    falling back to a deterministic circular layout. Resolves color from
    the node's stored color, namespace color map, or a default gray.

    Args:
        node_props: Property dict from a Memgraph OntologyTerm node.
        index: Position index used for the circular layout fallback.
        total: Total number of nodes, used to compute circular layout radius.

    Returns:
        A ``SerializedNode`` with Graphology-compatible attributes for Sigma.js.
    """
    # Use stored coordinates if they exist
    x = node_props.get("x")
    y = node_props.get("y")

    # Fallback to circular layout if coordinates are missing
    if x is None or y is None:
        # Evenly space nodes around a circle scaled by sqrt(total) for readable density
        angle = (2 * math.pi * index) / max(total, 1)
        radius = math.sqrt(max(total, 1)) * 2
        x = round(radius * math.cos(angle), 2)
        y = round(radius * math.sin(angle), 2)

    namespace = node_props.get("namespace", "unknown")
    node_type = NODE_TYPE_MAP.get(namespace, "Process")

    # sigma.js needs colour spelt color
    color = node_props.get("color") or node_props.get("colour") or COLOR_MAP.get(node_type, "#6b7280")
    size = round(float(node_props.get("size", 12)), 2)

    # Exclude "name" — it's promoted to "label" for Sigma.js, including both wastes bandwidth
    attrs = {k: v for k, v in node_props.items() if k not in ("name",)}
    if attrs.get("pagerank_score") is not None:
        attrs["pagerank_score"] = round(float(attrs["pagerank_score"]), 4)

    return SerializedNode(
        key=node_props["id"],
        attributes={
            **attrs,
            "label": node_props.get("name", node_props["id"]),
            "x": x,
            "y": y,
            "size": size,
            "color": color,
            "nodeType": node_type,
            "synonyms": node_props.get("synonyms", []),
        },
    )


def _build_graph_data_from_paths(records: list[dict]) -> GraphData:
    """Build a ``GraphData`` response from Memgraph MATCH query records.

    Expects each record to contain ``n`` (source node), ``r`` (relationship),
    and ``m`` (target node) columns. Deduplicates nodes by ID and edges by
    their ``{source}-{rel_type}-{target}`` key.

    Args:
        records: List of dicts from ``MemgraphService.execute_read``, each
            containing ``n``, ``r``, and ``m`` keys.

    Returns:
        A ``GraphData`` instance ready for JSON serialization.
    """
    seen_node_ids: set[str] = set()
    all_node_props: list[dict] = []
    edge_tuples: list[tuple[str, str, str]] = []

    # build graph from nodes and edges
    for record in records:
        n = record.get("n")
        m = record.get("m")
        if n:
            # Memgraph returns Node objects or plain dicts depending on query shape — normalize to dict
            n_props = dict(n) if hasattr(n, "items") else n
            if n_props.get("id") and n_props["id"] not in seen_node_ids:
                seen_node_ids.add(n_props["id"])
                all_node_props.append(n_props)
        if m:
            m_props = dict(m) if hasattr(m, "items") else m
            if m_props.get("id") and m_props["id"] not in seen_node_ids:
                seen_node_ids.add(m_props["id"])
                all_node_props.append(m_props)

        r = record.get("r")
        if r and n and m:
            n_id = (dict(n) if hasattr(n, "items") else n).get("id", "")
            m_id = (dict(m) if hasattr(m, "items") else m).get("id", "")
            # Fall back to generic RELATES_TO if the relationship object lacks a type property
            rel_type = dict(r).get("type", "RELATES_TO") if hasattr(r, "items") else "RELATES_TO"
            if n_id and m_id:
                edge_tuples.append((n_id, m_id, rel_type))

    total = len(all_node_props)
    nodes = [_node_from_record(props, i, total) for i, props in enumerate(all_node_props)]

    seen_edge_ids: set[str] = set()
    edges: list[SerializedEdge] = []
    for source, target, rel_type in edge_tuples:
        edge_id = f"{source}-{rel_type}-{target}"
        if edge_id not in seen_edge_ids:
            seen_edge_ids.add(edge_id)
            edges.append(
                SerializedEdge(
                    key=edge_id,
                    source=source,
                    target=target,
                    attributes={"color": "#334155", "type": rel_type, "label": rel_type},
                )
            )

    return GraphData(nodes=nodes, edges=edges)


@router.get(
    "/",
    response_model=GraphData,
    summary="Get ontology graph",
)
def get_graph(
    request: Request,
):
    """Fetch all OntologyTerm nodes and their relationships from Memgraph.

    Nodes are arranged in a circular layout and color-coded by namespace
    (biological_process, molecular_function, cellular_component).
    The response conforms to the Graphology JSON serialization format.
    """
    # In-memory cache avoids re-querying Memgraph on every page load — invalidated on new upload
    cached = getattr(request.app.state, "graph_cache", None)
    if cached is not None:
        logger.info("GET /graph served from cache")
        return cached

    t0 = time.perf_counter()
    mg = request.app.state.memgraph
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) OPTIONAL MATCH (n)-[r]->(m:OntologyTerm) RETURN n, r, m",
    )
    result = _build_graph_data_from_paths(records)
    # Cache the result — invalidated in file_upload.py when new data is ingested
    request.app.state.graph_cache = result
    logger.info(
        "GET /graph completed in %.3fs (%d nodes, %d edges)",
        time.perf_counter() - t0,
        len(result.nodes),
        len(result.edges),
    )
    return result


@router.get(
    "/node/{node_id}",
    response_model=GraphData,
    summary="Get node neighborhood",
    description="Return the variable-depth neighborhood of a single OntologyTerm node. "
    "The response includes the target node, all neighbors within the requested depth, "
    "and the edges between them. Returns 404 if the node does not exist.",
    response_description="Subgraph containing the target node, its neighbors, and connecting edges.",
)
def get_node_neighborhood(
    request: Request,
    node_id: str,
    depth: int = Query(
        1,
        ge=1,
        le=3,
        description="Number of hops from the target node (1–3). Higher values return a larger neighborhood.",
    ),
):
    """Return the variable-depth neighborhood of a single OntologyTerm node.

    Looks up the node identified by *node_id* and traverses up to *depth*
    hops to collect neighboring nodes and the edges that connect them.
    Returns **404** if no node with the given ID exists in the graph.
    """
    t0 = time.perf_counter()
    mg = request.app.state.memgraph

    # Two-phase query: first find all reachable nodes within depth hops,
    # then fetch only direct edges between them (avoids variable-length path collections)
    cypher = (
        "MATCH (n:OntologyTerm {id: $id}) "
        f"OPTIONAL MATCH (n)-[r*1..{depth}]-(m:OntologyTerm) "
        "WITH n, m "
        "OPTIONAL MATCH (n)-[r2]-(m) "
        "RETURN n, r2 AS r, m"
    )
    records = mg.execute_read(cypher, {"id": node_id})
    if not records:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    result = _build_graph_data_from_paths(records)
    logger.info("GET /node/%s (depth=%d) completed in %.3fs", node_id, depth, time.perf_counter() - t0)
    return result


@router.get(
    "/path",
    response_model=GraphData,
    summary="Shortest path between two nodes",
    description="Return the shortest undirected path between two OntologyTerm nodes. "
    "Returns 404 if either node does not exist, or 404 if no path is found.",
    response_description="Subgraph containing all nodes and edges along the shortest path.",
)
def get_shortest_path(
    request: Request,
    source: str = Query(..., description="ID of the start node (e.g. GO:0008150)"),
    target: str = Query(..., description="ID of the end node (e.g. GO:0003674)"),
    max_depth: int = Query(
        50,
        ge=1,
        le=50,
        description="Maximum path length to search (1–50).",
    ),
):
    """Return the shortest path between two OntologyTerm nodes.

    Uses Memgraph's ``shortestPath`` to find the shortest undirected path
    between *source* and *target*, bounded by *max_depth* hops.
    """
    t0 = time.perf_counter()
    mg = request.app.state.memgraph

    # Degenerate case: return the single node without running BFS
    if source == target:
        records = mg.execute_read(
            "MATCH (n:OntologyTerm {id: $id}) RETURN n, null AS r, null AS m",
            {"id": source},
        )
        if not records:
            raise HTTPException(status_code=404, detail=f"Node '{source}' not found")
        return _build_graph_data_from_paths(records)

    # BFS finds the shortest path; UNWIND flattens it into n/r/m triples for _build_graph_data_from_paths
    cypher = (
        f"MATCH p = (a:OntologyTerm {{id: $source}})"
        f"-[*BFS ..{max_depth}]-"
        f"(b:OntologyTerm {{id: $target}}) "
        "WITH nodes(p) AS ns, relationships(p) AS rs "
        "UNWIND range(0, size(rs)-1) AS i "
        "RETURN ns[i] AS n, rs[i] AS r, ns[i+1] AS m"
    )
    records = mg.execute_read(cypher, {"source": source, "target": target})

    # If BFS returned nothing, distinguish "node doesn't exist" from "no path between them"
    if not records:
        check = mg.execute_read(
            "MATCH (n:OntologyTerm) WHERE n.id IN [$source, $target] RETURN n.id AS id",
            {"source": source, "target": target},
        )
        found_ids = {r["id"] for r in check}
        if source not in found_ids:
            raise HTTPException(status_code=404, detail=f"Node '{source}' not found")
        if target not in found_ids:
            raise HTTPException(status_code=404, detail=f"Node '{target}' not found")
        raise HTTPException(
            status_code=404,
            detail=f"No path found between '{source}' and '{target}' within {max_depth} hops",
        )

    result = _build_graph_data_from_paths(records)
    logger.info("GET /path %s -> %s completed in %.3fs", source, target, time.perf_counter() - t0)
    return result


@router.get(
    "/paths",
    response_model=GraphData,
    summary="Shortest paths between multiple nodes",
    description="Return the union of shortest undirected paths for all pairs among the supplied "
    "node IDs in a single Memgraph query. Returns 404 if any node does not exist or no paths "
    "are found.",
    response_description="Subgraph containing all nodes and edges along all shortest paths.",
)
def get_multi_shortest_paths(
    request: Request,
    ids: list[str] = Query(..., description="Node IDs to find paths between (min 2, max 10)"),
    max_depth: int = Query(
        50,
        ge=1,
        le=50,
        description="Maximum path length to search (1–50).",
    ),
):
    """Return the union of shortest paths between all pairs of the supplied nodes.

    Runs a single Memgraph BFS query via UNWIND over all pairs.
    """
    if len(ids) < 2:
        raise HTTPException(status_code=422, detail="At least 2 node IDs are required")
    if len(ids) > 10:
        raise HTTPException(status_code=422, detail="At most 10 node IDs are allowed")

    t0 = time.perf_counter()
    mg = request.app.state.memgraph

    # Generate all unique pairs for pairwise BFS
    pairs = [[ids[i], ids[j]] for i in range(len(ids)) for j in range(i + 1, len(ids))]

    cypher = (
        f"UNWIND $pairs AS pair "
        f"MATCH p = (a:OntologyTerm {{id: pair[0]}})"
        f"-[*BFS ..{max_depth}]-"
        f"(b:OntologyTerm {{id: pair[1]}}) "
        "WITH nodes(p) AS ns, relationships(p) AS rs "
        "UNWIND range(0, size(rs)-1) AS i "
        "RETURN ns[i] AS n, rs[i] AS r, ns[i+1] AS m"
    )
    records = mg.execute_read(cypher, {"pairs": pairs})

    if not records:
        check = mg.execute_read(
            "MATCH (n:OntologyTerm) WHERE n.id IN $ids RETURN n.id AS id",
            {"ids": ids},
        )
        found_ids = {r["id"] for r in check}
        missing = [i for i in ids if i not in found_ids]
        if missing:
            raise HTTPException(status_code=404, detail=f"Nodes not found: {missing}")
        raise HTTPException(
            status_code=404,
            detail=f"No paths found between any of the supplied nodes within {max_depth} hops",
        )

    result = _build_graph_data_from_paths(records)
    logger.info("GET /paths (%d nodes, %d pairs) completed in %.3fs", len(ids), len(pairs), time.perf_counter() - t0)
    return result


@router.get(
    "/paths/export",
    summary="Export path, neighbours, and relationships as CSV",
    description="Export pre-computed path nodes and their first-level neighbours "
    "as a CSV containing node metadata and relationships.",
)
def export_paths_csv(
    request: Request,
    path_ids: list[str] = Query(..., description="All node IDs along the path (from frontend)"),
    selected_ids: list[str] = Query(default=[], description="User-selected endpoint node IDs"),
):
    """Export path nodes, their first-level neighbours, and all relationships as CSV.

    Queries Memgraph for the given path node IDs and their immediate
    neighbours, then generates a CSV file with columns for term metadata
    (ID, URL, name, definition, synonyms, xrefs), relationship information
    (subclass hierarchy, other relationships), and graph analysis data
    (community, path position, role).

    Nodes are sorted with selected endpoints first, then path nodes, then
    neighbours. The filename includes a timestamp and the source ontology name.

    Args:
        request: FastAPI request (used to access ``app.state.memgraph``).
        path_ids: Ordered list of node IDs along the path.
        selected_ids: User-selected endpoint node IDs (highlighted in the export).

    Returns:
        A ``StreamingResponse`` with ``text/csv`` content type and a
        ``Content-Disposition`` header for file download.

    Raises:
        HTTPException 422: If ``path_ids`` is empty.
        HTTPException 404: If no nodes are found for the given IDs.
    """
    if not path_ids:
        raise HTTPException(status_code=422, detail="No path node IDs provided")

    t0 = time.perf_counter()
    mg = request.app.state.memgraph
    path_node_ids = set(path_ids)
    selected_set = set(selected_ids)

    # Single query: path nodes + neighbours + all relationships
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) WHERE n.id IN $path_ids "
        "OPTIONAL MATCH (n)--(m:OntologyTerm) "
        "WITH COLLECT(DISTINCT n) + COLLECT(DISTINCT m) AS all_nodes "
        "UNWIND all_nodes AS node "
        "WITH DISTINCT node "
        "OPTIONAL MATCH (node)-[r:RELATES_TO]->(target:OntologyTerm) "
        "RETURN node, r.type AS rel_type, target.id AS target_id, target.name AS target_name",
        {"path_ids": path_ids},
    )

    if not records:
        raise HTTPException(status_code=404, detail="No nodes found for the given path IDs")

    node_map: dict[str, dict] = {}
    outgoing: dict[str, list[tuple[str, str, str]]] = {}
    for rec in records:
        raw = rec.get("node")
        if raw is None:
            continue
        props = dict(raw) if hasattr(raw, "items") else raw
        nid = props.get("id")
        if not nid:
            continue
        if nid not in node_map:
            node_map[nid] = props

        rel_type = rec.get("rel_type")
        target_id = rec.get("target_id")
        if rel_type and target_id:
            target_name = rec.get("target_name") or target_id
            outgoing.setdefault(nid, []).append((rel_type, target_id, target_name))

    all_node_ids = list(node_map.keys())

    incoming: dict[str, list[tuple[str, str, str]]] = {}
    for nid, rels in outgoing.items():
        src_name = node_map.get(nid, {}).get("name", nid)
        for rel_type, target_id, _ in rels:
            incoming.setdefault(target_id, []).append((rel_type, nid, src_name))

    output = io.StringIO()
    # UTF-8 BOM so Excel auto-detects encoding and displays special characters correctly
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "URL",
            "Name",
            "Definition",
            "Synonyms",
            "Cross-references",
            "Subclass Of",
            "Has Subclasses",
            "Other Relationships",
            "Comments",
            "Namespace",
            "Obsolete",
            "Role",
            "Path Position",
            "Community",
        ]
    )

    def _sort_key(nid: str) -> tuple[int, str]:
        if nid in selected_set:
            return (0, nid)
        if nid in path_node_ids:
            return (1, nid)
        return (2, nid)

    def _clean(val: object) -> str:
        """Return a clean string — never 'None', no leading/trailing whitespace."""
        if val is None:
            return ""
        s = str(val).strip()
        return "" if s == "None" else s

    def _short_id(raw_id: str) -> str:
        """Extract short ID from a full URL, or return as-is."""
        if raw_id.startswith("http://") or raw_id.startswith("https://"):
            return raw_id.rsplit("/", 1)[-1]
        return raw_id

    def _split_id(nid: str, props: dict) -> tuple[str, str]:
        """Return (short_id, url) for a node.

        If the id itself is a URL (e.g. from OWL files), extract the
        short id from the last path segment and use the full id as the URL.
        """
        if nid.startswith("http://") or nid.startswith("https://"):
            return nid.rsplit("/", 1)[-1], nid
        return nid, _clean(props.get("url"))

    def _rel_label(rel_type: str) -> str:
        """'part_of' -> 'part of'."""
        return rel_type.replace("_", " ")

    def _join_list(vals: object) -> str:
        """Join a list with '; ' or return empty string."""
        if isinstance(vals, list):
            return "; ".join(_clean(v) for v in vals if _clean(v))
        return _clean(vals)

    # Build path position lookup from the original ordered path_ids
    path_position: dict[str, int] = {pid: idx + 1 for idx, pid in enumerate(path_ids)}

    for nid in sorted(all_node_ids, key=_sort_key):
        props = node_map[nid]

        if nid in selected_set:
            role = "Selected"
        elif nid in path_node_ids:
            role = "Path Node"
        else:
            role = "Neighbour"

        short_id, url = _split_id(nid, props)

        # Separate is_a (subclass hierarchy) from other relations for distinct CSV columns
        isa_parents = [
            f"{_clean(tname)} [{_short_id(tid)}]" for rtype, tid, tname in outgoing.get(nid, []) if rtype == "is_a"
        ]
        isa_children = [
            f"{_clean(sname)} [{_short_id(sid)}]" for rtype, sid, sname in incoming.get(nid, []) if rtype == "is_a"
        ]
        other_rels: list[str] = []
        for rtype, tid, tname in outgoing.get(nid, []):
            if rtype != "is_a":
                other_rels.append(f"{_rel_label(rtype)} {_clean(tname)} [{_short_id(tid)}]")
        for rtype, sid, sname in incoming.get(nid, []):
            if rtype != "is_a":
                other_rels.append(f"{_rel_label(rtype)} from {_clean(sname)} [{_short_id(sid)}]")

        obsolete = "Yes" if props.get("is_obsolete") else ""
        position = path_position.get(nid, "")
        community = _clean(props.get("louvain"))

        writer.writerow(
            [
                short_id,
                url,
                _clean(props.get("name")),
                _clean(props.get("definition")),
                _join_list(props.get("synonyms")),
                _join_list(props.get("xrefs")),
                "; ".join(isa_parents),
                "; ".join(isa_children),
                "; ".join(other_rels),
                _clean(props.get("comment")),
                _clean(props.get("namespace")),
                obsolete,
                role,
                position,
                community,
            ]
        )

    output.seek(0)
    logger.info(
        "GET /paths/export (%d selected, %d path, %d total) completed in %.3fs",
        len(selected_ids),
        len(path_node_ids),
        len(all_node_ids),
        time.perf_counter() - t0,
    )

    # Derive filename from the source ontology, with timestamp prefix for uniqueness
    source_file = next(
        (props.get("source_file") for props in node_map.values() if props.get("source_file")),
        None,
    )
    if source_file:
        base = os.path.splitext(source_file)[0]
    else:
        base = "path_export"
    filename = f"{datetime.now().strftime('%Y-%m-%d_%H%M%S')}_{base}_subset.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/search",
    response_model=GraphData,
    summary="Search graph nodes",
    description="Perform a case-insensitive substring search over OntologyTerm node names. "
    "Matching nodes are returned together with their immediate neighbors and connecting edges. "
    "Results are capped at 100 rows.",
    response_description="Subgraph of matching nodes, their neighbors, and connecting edges.",
)
def search_graph(
    request: Request,
    q: str = Query(
        ...,
        min_length=1,
        description="Case-insensitive search term matched against node names using CONTAINS.",
    ),
):
    """Search OntologyTerm nodes by name and return the matching subgraph.

    Performs a case-insensitive CONTAINS match on the *name* property of
    every OntologyTerm node. Each matching node is returned along with its
    immediate neighbors and the edges between them. The total number of
    result rows is limited to 100.
    """
    t0 = time.perf_counter()
    mg = request.app.state.memgraph
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) WHERE toLower(n.name) CONTAINS toLower($q) "
        "OPTIONAL MATCH (n)-[r]-(m:OntologyTerm) "
        "RETURN n, r, m LIMIT 100",
        {"q": q},
    )
    result = _build_graph_data_from_paths(records)
    logger.info("GET /search q=%r completed in %.3fs (%d results)", q, time.perf_counter() - t0, len(result.nodes))
    return result


@router.get(
    "/semantic-search",
    response_model=GraphData,
    summary="Vector semantic search over graph nodes",
    description=(
        "Search OntologyTerm nodes using dense vector embeddings. "
        "The query is encoded with the same model used to embed term metadata "
        "(name, definition, synonyms, comment) and ranked by cosine similarity. "
        "Returns matching nodes with their immediate neighbors and edges."
    ),
)
async def embedding_search(
    request: Request,
    q: str = Query(
        ...,
        min_length=1,
        description=("Free-text search query. Separate multiple terms with commas "),
    ),
    limit: int = Query(20, ge=1, le=100, description="Max results (1-100)."),
    threshold: float = Query(0.35, ge=0.0, le=1.0, description="Minimum similarity score (0-1)."),
):
    """Semantic search powered by dense vector embeddings.

    If the query looks like a sentence (no commas, more than two words) and the
    Gemini service is configured, the sentence is first expanded into a list of
    ontology-style terms via Gemini.  Those terms are then averaged into a
    semantic centroid for the vector search.  Falls back to a direct search if
    Gemini is unavailable or returns nothing useful.
    """
    t0 = time.perf_counter()
    embedding_svc = getattr(request.app.state, "embedding_service", None)
    if embedding_svc is None or not embedding_svc.is_ready:
        return JSONResponse(
            status_code=503,
            content={"detail": "Embedding index not available. Upload an ontology first."},
        )

    # Run the original embedding search and Gemini expansion concurrently
    # so we don't wait for Gemini before starting the search.
    gemini = getattr(request.app.state, "gemini", None)

    async def _safe_expand() -> list[str] | None:
        if gemini is None:
            return None
        try:
            return await gemini.expand(q)
        except Exception:
            return None

    results, expanded_terms = await asyncio.gather(
        embedding_svc.search(q, top_k=limit),
        _safe_expand(),
    )

    # If Gemini expanded, search the centroid too and merge the higher score per term
    if expanded_terms:
        gemini_query = ", ".join(expanded_terms)
        gemini_results = await embedding_svc.search(gemini_query, top_k=limit)
        score_map = {tid: (score, field) for tid, score, field in results}
        for tid, score, field in gemini_results:
            if tid not in score_map or score > score_map[tid][0]:
                score_map[tid] = (score, field)
        results = [(tid, score, field) for tid, (score, field) in score_map.items()]
        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:limit]

    if not results:
        return GraphData()

    # Filter results by threshold
    results = [(tid, score, field) for tid, score, field in results if score >= threshold]
    if not results:
        return GraphData()

    score_map = {term_id: (score, field) for term_id, score, field in results}
    top_ids = list(score_map.keys())

    mg = request.app.state.memgraph
    neighbor_records = mg.execute_read(
        "MATCH (n:OntologyTerm) WHERE n.id IN $ids OPTIONAL MATCH (n)-[r]-(m:OntologyTerm) RETURN n, r, m",
        {"ids": top_ids},
    )

    graph = _build_graph_data_from_paths(neighbor_records)

    # Annotate matched nodes with their similarity score and best-matching field for the frontend
    for node in graph.nodes:
        if node.key in score_map:
            score, best_field = score_map[node.key]
            node.attributes["searchScore"] = round(score, 4)
            node.attributes["matchFields"] = [best_field]
            if expanded_terms:
                node.attributes["expandedTerms"] = expanded_terms

    # Return nodes sorted by score descending (matched nodes first, then neighbors)
    graph.nodes.sort(key=lambda n: n.attributes.get("searchScore", -1), reverse=True)

    logger.info(
        "GET /semantic-search q=%r%s completed in %.3fs (%d matches)",
        q,
        f" expanded={expanded_terms}" if expanded_terms else "",
        time.perf_counter() - t0,
        len(top_ids),
    )
    return graph
