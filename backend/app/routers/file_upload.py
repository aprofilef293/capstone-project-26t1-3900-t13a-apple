import os
import tempfile

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.models.upload import OntologyRelation, OntologyTerm, OntologyUploadResponse
from app.services.memgraph import MemgraphService
from app.services.ontology_parser import parse_ontology

router = APIRouter()

ALLOWED_EXTENSIONS = {".obo", ".owl"}

NAMESPACE_COLORS = {
    "biological_process": "#2563eb",
    "molecular_function": "#9333ea",
    "cellular_component": "#10b981",
}


def _ingest_ontology(
    mg: MemgraphService,
    terms: list[OntologyTerm],
    relations: list[OntologyRelation],
    source_file: str,
) -> None:
    """Batch ingest validated ontology terms and relations into Memgraph."""
    # Clear existing data before ingesting new file
    mg.execute_write("MATCH (n:OntologyTerm) DETACH DELETE n;")

    # Create index for faster lookups
    mg.execute_write("CREATE INDEX ON :OntologyTerm(id);")

    # Filter obsolete terms and dump all attributes for dynamic insertion
    term_dicts = [{**t.model_dump(), "source_file": source_file} for t in terms if not t.is_obsolete]

    # Batch in chunks of 5000 for large ontologies
    batch_size = 5000
    for i in range(0, len(term_dicts), batch_size):
        batch = term_dicts[i : i + batch_size]
        mg.execute_write(
            """
            UNWIND $terms AS t
            MERGE (n:OntologyTerm {id: t.id})
            SET n += t
            """,
            {"terms": batch},
        )

    # Batch create relationships
    rel_dicts = [{"subject": r.subject_id, "object": r.object_id, "type": r.relation_type} for r in relations]

    for i in range(0, len(rel_dicts), batch_size):
        batch = rel_dicts[i : i + batch_size]
        mg.execute_write(
            """
            UNWIND $rels AS r
            MATCH (s:OntologyTerm {id: r.subject})
            MATCH (o:OntologyTerm {id: r.object})
            MERGE (s)-[rel:RELATES_TO {type: r.type}]->(o)
            """,
            {"rels": batch},
        )


@router.post("/upload", response_model=OntologyUploadResponse)
async def upload_ontology(request: Request, file: UploadFile = File(...)):
    """Upload and ingest an OBO/OWL ontology file."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Use .obo or .owl")

    # Save to temp file (Pronto reads from disk)
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        terms, relations = parse_ontology(tmp_path)
        mg = request.app.state.memgraph
        _ingest_ontology(mg, terms, relations, file.filename or "unknown")
    finally:
        os.unlink(tmp_path)

    namespaces = sorted({t.namespace for t in terms if t.namespace})
    non_obsolete = sum(1 for t in terms if not t.is_obsolete)

    return OntologyUploadResponse(
        filename=file.filename or "unknown",
        term_count=non_obsolete,
        relation_count=len(relations),
        namespaces=namespaces,
        message=f"Successfully ingested {non_obsolete} terms and {len(relations)} relations.",
    )


@router.get("/list")
def list_ontologies(request: Request):
    """List distinct ontology sources that have been ingested."""
    mg = request.app.state.memgraph
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) RETURN DISTINCT n.source_file AS source_file, count(n) AS term_count"
    )
    return records
