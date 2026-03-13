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
    """Convert Memgraph node properties to a Graphology SerializedNode with circular layout."""
    namespace = node_props.get("namespace", "unknown")
    node_type = NODE_TYPE_MAP.get(namespace, "Process")

    angle = (2 * math.pi * index) / max(total, 1)
    radius = math.sqrt(max(total, 1)) * 2

    return SerializedNode(
        key=node_props["id"],
        attributes={
            "id": node_props["id"],
            "label": node_props.get("name", node_props["id"]),
            "x": round(radius * math.cos(angle), 2),
            "y": round(radius * math.sin(angle), 2),
            "size": 12,
            "color": COLOR_MAP.get(node_type, "#6b7280"),
            "nodeType": node_type,
            "namespace": namespace,
            "definition": node_props.get("definition", ""),
            "synonyms": node_props.get("synonyms", []),
        },
    )


def _build_graph_data(node_records: list[dict], edge_records: list[dict]) -> GraphData:
    """Build GraphData from raw Memgraph query results."""
    seen_node_ids: set[str] = set()
    all_node_props: list[dict] = []

    for record in node_records:
        props = dict(record["n"]) if hasattr(record["n"], "items") else record["n"]
        if props["id"] not in seen_node_ids:
            seen_node_ids.add(props["id"])
            all_node_props.append(props)

    total = len(all_node_props)
    nodes = [_node_from_record(props, i, total) for i, props in enumerate(all_node_props)]

    seen_edge_ids: set[str] = set()
    edges: list[SerializedEdge] = []
    for record in edge_records:
        source = record["source"]
        target = record["target"]
        rel_type = record.get("sub_type") or record.get("rel_type", "RELATES_TO")
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


def _build_graph_data_from_paths(records: list[dict]) -> GraphData:
    """Build GraphData from MATCH results that return n, r, m columns."""
    seen_node_ids: set[str] = set()
    all_node_props: list[dict] = []
    edge_tuples: list[tuple[str, str, str]] = []

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
    mg = request.app.state.memgraph
    node_records = mg.execute_read(
        "MATCH (n:OntologyTerm) RETURN n",
    )
    edge_records = mg.execute_read(
        "MATCH (n:OntologyTerm)-[r]->(m:OntologyTerm) "
        "RETURN n.id AS source, m.id AS target, type(r) AS rel_type, r.type AS sub_type",
    )
    return _build_graph_data(node_records, edge_records)


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

    check = mg.execute_read("MATCH (n:OntologyTerm {id: $id}) RETURN n", {"id": node_id})
    if not check:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")

    cypher = (
        f"MATCH (n:OntologyTerm {{id: $id}})-[r*1..{depth}]-(m:OntologyTerm) "
        "WITH n, m "
        "OPTIONAL MATCH (n)-[r2]-(m) "
        "RETURN n, r2 AS r, m"
    )
    records = mg.execute_read(cypher, {"id": node_id})
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
