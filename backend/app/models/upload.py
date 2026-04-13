"""Pydantic models for ontology data parsed from OBO/OWL files."""

from pydantic import BaseModel


class OntologyTerm(BaseModel):
    """A single term parsed from an OBO/OWL ontology file.

    Attributes:
        id: Unique term identifier (e.g. ``"GO:0008150"``).
        name: Human-readable term name.
        namespace: Ontology namespace (e.g. ``"biological_process"``).
        definition: Textual definition of the term.
        synonyms: Alternative names for the term.
        xrefs: Cross-references to other databases or ontologies.
        comment: Informal notes, examples of usage, or editorial remarks.
        is_obsolete: Whether the term has been marked obsolete.
        url: Resolved URL for the term (e.g. OBO PURL or OWL IRI).
        size: Display size computed from ``PageRank`` score during graph
            preprocessing.
        percentile_rank: Percentile rank of the term's ``PageRank`` score
            (0.0 to 1.0).
        pagerank_score: Raw ``PageRank`` score from the graph analysis.
        colour: Hex color code assigned by Louvain community detection.
        louvain: Louvain community index for this term.
        viewLevel: Visibility tier (1--5) based on ``PageRank`` and community
            rank, used by the frontend to control level-of-detail rendering.
        x: Horizontal position from t-FDP layout.
        y: Vertical position from t-FDP layout.
    """

    id: str
    name: str
    namespace: str | None = None
    definition: str | None = None
    synonyms: list[str] = []
    xrefs: list[str] = []
    comment: str | None = None
    is_obsolete: bool = False
    url: str | None = None

    # Populated by OntologyGraphPreprocessor.preprocess() — None until graph analysis runs
    size: float | None = None
    percentile_rank: float | None = None
    pagerank_score: float | None = None
    colour: str | None = None
    louvain: int | None = None
    viewLevel: int | None = None
    x: float | None = None
    y: float | None = None


class OntologyRelation(BaseModel):
    """A directed relationship between two ontology terms.

    Attributes:
        subject_id: The source term identifier.
        relation_type: The type of relationship (e.g. "is_a", "part_of").
        object_id: The target term identifier.
    """

    subject_id: str
    relation_type: str
    object_id: str


class OntologyUploadResponse(BaseModel):
    """Response returned after a successful ontology file upload.

    Attributes:
        filename: Name of the uploaded file.
        term_count: Number of non-obsolete terms ingested.
        relation_count: Number of relationships ingested.
        namespaces: Distinct namespaces found in the file.
        message: Summary message of the ingestion result.
    """

    filename: str
    term_count: int
    relation_count: int
    namespaces: list[str]
    message: str
