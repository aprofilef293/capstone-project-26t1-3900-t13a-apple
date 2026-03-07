from pydantic import BaseModel, Field


class SerializedNode(BaseModel):
    key: str
    attributes: dict[str, object] = {}


class SerializedEdge(BaseModel):
    key: str
    source: str
    target: str
    attributes: dict[str, object] = {}


class GraphData(BaseModel):
    attributes: dict[str, object] = {}
    options: dict[str, object] = Field(
        default_factory=lambda: {"type": "directed", "multi": False, "allowSelfLoops": True}
    )
    nodes: list[SerializedNode] = []
    edges: list[SerializedEdge] = []
