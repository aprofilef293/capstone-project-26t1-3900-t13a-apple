import math

from fastapi import APIRouter, Query, Request

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


@router.get("/", response_model=GraphData)
def get_graph(request: Request, limit: int = Query(200, le=1000)):
    """Return all graph nodes and edges, paginated by limit."""
    mg = request.app.state.memgraph
    node_records = mg.execute_read(
        "MATCH (n:OntologyTerm) RETURN n LIMIT $limit",
        {"limit": limit},
    )
    edge_records = mg.execute_read(
        "MATCH (n:OntologyTerm)-[r]->(m:OntologyTerm) "
        "RETURN n.id AS source, m.id AS target, type(r) AS rel_type, r.type AS sub_type "
        "LIMIT $limit",
        {"limit": limit * 3},
    )
    return _build_graph_data(node_records, edge_records)
