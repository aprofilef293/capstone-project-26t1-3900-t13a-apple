from pydantic import BaseModel


class OntologyTerm(BaseModel):
    """A single term parsed from an OBO/OWL ontology file.

    Attributes:
        id: Unique term identifier (e.g. "GO:0008150").
        name: Human-readable term name.
        namespace: Ontology namespace (e.g. "biological_process").
        definition: Textual definition of the term.
        synonyms: Alternative names for the term.
        xrefs: Cross-references to other databases or ontologies.
        is_obsolete: Whether the term has been marked obsolete.
    """

    id: str
    name: str
    namespace: str | None = None
    definition: str | None = None
    synonyms: list[str] = []
    xrefs: list[str] = []
    is_obsolete: bool = False

    # Preprocessing attributes
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
