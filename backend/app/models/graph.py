from pydantic import BaseModel, Field


class SerializedNode(BaseModel):
    """Single node in the Graphology JSON format.

    Represents an OntologyTerm from Memgraph.  The ``key`` is the OBO term id
    (e.g. "GO:0008150") and ``attributes`` carries display properties used by
    Sigma.js on the frontend: label, x/y position, color, size, namespace,
    definition, and synonyms.
    """

    key: str
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


class SemanticSearchResult(BaseModel):
    """A single result from the embedding-based semantic search."""

    id: str
    name: str
    namespace: str | None = None
    score: float


class SemanticSearchResponse(BaseModel):
    """Response from the semantic search endpoint."""

    results: list[SemanticSearchResult] = []


class GraphData(BaseModel):
    """Top-level response for GET /api/graph.

    Conforms to the Graphology JSON serialization spec so the frontend can call
    ``graph.import(data)`` directly.  ``options`` defaults to a directed,
    non-multi graph that allows self-loops.
    """

    attributes: dict[str, object] = {}
    options: dict[str, object] = Field(
        default_factory=lambda: {"type": "directed", "multi": True, "allowSelfLoops": True}
    )
    nodes: list[SerializedNode] = []
    edges: list[SerializedEdge] = []
