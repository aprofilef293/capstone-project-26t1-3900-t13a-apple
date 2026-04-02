import math

from fastapi import APIRouter, HTTPException, Query, Request

from app.models.graph import GraphData, SerializedEdge, SerializedNode

router = APIRouter()

NODE_TYPE_MAP = {
    "biological_process": "Process",
    "molecular_function": "Material",
    "cellular_component": "Outcome",
}

COLOR_MAP = {
    "Process": "#2563eb",
    "Material": "#9333ea",
    "Outcome": "#10b981",
}


def _node_from_record(node_props: dict, index: int, total: int) -> SerializedNode:
    # Use stored coordinates if they exist
    x = node_props.get("x")
    y = node_props.get("y")

    # Fallback to circular layout if coordinates are missing
    if x is None or y is None:
        angle = (2 * math.pi * index) / max(total, 1)
        radius = math.sqrt(max(total, 1)) * 2
        x = round(radius * math.cos(angle), 2)
        y = round(radius * math.sin(angle), 2)

    namespace = node_props.get("namespace", "unknown")
    node_type = NODE_TYPE_MAP.get(namespace, "Process")

    # sigma.js needs colour spelt color
    color = node_props.get("color") or node_props.get("colour") or COLOR_MAP.get(node_type, "#6b7280")
    size = round(float(node_props.get("size", 12)), 2)

    # Drop fields duplicated by label/color; round floats to reduce send size
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
    """Build GraphData from MATCH results that return n, r, m columns."""
    seen_node_ids: set[str] = set()
    all_node_props: list[dict] = []
    edge_tuples: list[tuple[str, str, str]] = []

    # build graph from nodes and edges
    for record in records:
        n = record.get("n")
        m = record.get("m")
        if n:
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
    cached = getattr(request.app.state, "graph_cache", None)
    if cached is not None:
        return cached

    mg = request.app.state.memgraph
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) OPTIONAL MATCH (n)-[r]->(m:OntologyTerm) RETURN n, r, m",
    )
    result = _build_graph_data_from_paths(records)
    request.app.state.graph_cache = result
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
    mg = request.app.state.memgraph

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
    return _build_graph_data_from_paths(records)


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
    mg = request.app.state.memgraph

    if source == target:
        records = mg.execute_read(
            "MATCH (n:OntologyTerm {id: $id}) RETURN n, null AS r, null AS m",
            {"id": source},
        )
        if not records:
            raise HTTPException(status_code=404, detail=f"Node '{source}' not found")
        return _build_graph_data_from_paths(records)

    cypher = (
        f"MATCH p = (a:OntologyTerm {{id: $source}})"
        f"-[*BFS ..{max_depth}]-"
        f"(b:OntologyTerm {{id: $target}}) "
        "WITH nodes(p) AS ns, relationships(p) AS rs "
        "UNWIND range(0, size(rs)-1) AS i "
        "RETURN ns[i] AS n, rs[i] AS r, ns[i+1] AS m"
    )
    records = mg.execute_read(cypher, {"source": source, "target": target})

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

    return _build_graph_data_from_paths(records)


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

    mg = request.app.state.memgraph

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

    return _build_graph_data_from_paths(records)


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
    mg = request.app.state.memgraph
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) WHERE toLower(n.name) CONTAINS toLower($q) "
        "OPTIONAL MATCH (n)-[r]-(m:OntologyTerm) "
        "RETURN n, r, m LIMIT 100",
        {"q": q},
    )
    return _build_graph_data_from_paths(records)
