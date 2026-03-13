from pydantic import BaseModel


class OntologyTerm(BaseModel):
    id: str
    name: str
    namespace: str | None = None
    definition: str | None = None
    synonyms: list[str] = []
    xrefs: list[str] = []
    is_obsolete: bool = False


class OntologyRelation(BaseModel):
    subject_id: str
    relation_type: str
    object_id: str


class OntologyUploadResponse(BaseModel):
    filename: str
    term_count: int
    relation_count: int
    namespaces: list[str]
    message: str
