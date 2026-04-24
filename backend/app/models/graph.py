"""Pydantic models for the Graphology JSON serialization format used by the graph API.

:author: aprofilef293
"""

from pydantic import BaseModel, Field


class SerializedNode(BaseModel):
    """Single node in the Graphology JSON format.

    Represents an OntologyTerm from Memgraph.  The ``key`` is the OBO term id
    (e.g. "GO:0008150") and ``attributes`` carries display properties used by
    Sigma.js on the frontend: label, x/y position, color, size, namespace,
    definition, and synonyms.
    """

    key: str
    # Flexible dict — different node types carry varying properties (size, color, namespace, etc.)
    attributes: dict[str, object] = {}


class SerializedEdge(BaseModel):
    """Single edge in the Graphology JSON format.

    Maps to a Memgraph relationship between two OntologyTerm nodes.
    ``key`` is "{source}-{rel_type}-{target}" (e.g. "GO:0008150-is_a-GO:0003674"),
    and ``attributes`` includes the relationship type label and a display color.
    """

    key: str
    source: str
    target: str
    attributes: dict[str, object] = {}


class GraphData(BaseModel):
    """Top-level response for GET /api/graph.

    Conforms to the Graphology JSON serialization spec so the frontend can call
    ``graph.import(data)`` directly.  ``options`` defaults to a directed,
    non-multi graph that allows self-loops.
    """

    attributes: dict[str, object] = {}
    # Graphology requires these flags to correctly import the directed ontology graph
    options: dict[str, object] = Field(
        default_factory=lambda: {"type": "directed", "multi": True, "allowSelfLoops": True}
    )
    nodes: list[SerializedNode] = []
    edges: list[SerializedEdge] = []
