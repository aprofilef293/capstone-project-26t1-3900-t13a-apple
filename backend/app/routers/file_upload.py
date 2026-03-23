import asyncio
import json
import os
import tempfile

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.models.upload import OntologyRelation, OntologyTerm
from app.services.graph_preprocessing import OntologyGraphPreprocessor
from app.services.memgraph import MemgraphService
from app.services.ontology_parser import parse_ontology

router = APIRouter()

ALLOWED_EXTENSIONS = {".obo", ".owl"}

NAMESPACE_COLORS = {
    "biological_process": "#2563eb",
    "molecular_function": "#9333ea",
    "cellular_component": "#10b981",
}


def _ingest_terms(
    mg: MemgraphService,
    terms: list[OntologyTerm],
    source_file: str,
) -> None:
    """Batch ingest validated ontology terms and relations into Memgraph.

    Drops the entire graph, creates an index on the term id,
    then inserts non-obsolete terms and their relationships in batches of 5000.
    All term model attributes are dynamically set on nodes via ``SET n += t``.

    Args:
        mg: MemgraphService instance for executing Cypher queries.
        terms: Parsed ontology terms to insert.
        source_file: Original filename, stored on each node for provenance.
    """
    mg.execute_write("STORAGE MODE IN_MEMORY_ANALYTICAL;")
    mg.execute_write("DROP GRAPH;")
    mg.execute_write("STORAGE MODE IN_MEMORY_TRANSACTIONAL;")
    mg.execute_write("CREATE INDEX ON :OntologyTerm(id);")
    term_dicts = [{**t.model_dump(), "source_file": source_file} for t in terms if not t.is_obsolete]
    batch_size = 5000
    for i in range(0, len(term_dicts), batch_size):
        mg.execute_write(
            "UNWIND $terms AS t MERGE (n:OntologyTerm {id: t.id}) SET n += t",
            {"terms": term_dicts[i : i + batch_size]},
        )


def _ingest_relations(mg: MemgraphService, relations: list[OntologyRelation]) -> None:
    """Batch-create RELATES_TO edges between existing OntologyTerm nodes.

    Args:
        mg: MemgraphService instance for executing Cypher queries.
        relations: Parsed relationships to insert.
    """
    rel_dicts = [{"subject": r.subject_id, "object": r.object_id, "type": r.relation_type} for r in relations]
    batch_size = 5000
    for i in range(0, len(rel_dicts), batch_size):
        mg.execute_write(
            """
            UNWIND $rels AS r
            MATCH (s:OntologyTerm {id: r.subject})
            MATCH (o:OntologyTerm {id: r.object})
            MERGE (s)-[rel:RELATES_TO {type: r.type}]->(o)
            """,
            {"rels": rel_dicts[i : i + batch_size]},
        )


@router.post("/upload")
async def upload_ontology(request: Request, file: UploadFile = File(...)):
    """Upload and ingest an OBO/OWL ontology file via Server-Sent Events.

    Accepts a .obo or .owl file, then returns an SSE stream that reports
    progress as the file is parsed and ingested into Memgraph.

    SSE events:
        - ``{progress: 25, stage: "parsed"}`` — file successfully parsed.
        - ``{progress: 60, stage: "terms_ingested"}`` — terms written to DB.
        - ``{progress: 100, stage: "complete", filename: "..."}`` — ingestion complete.
        - ``{error: "..."}`` — an error occurred during processing.

    Args:
        request: FastAPI request (used to access app.state.memgraph).
        file: The uploaded ontology file (.obo or .owl).

    Raises:
        HTTPException 400: If the file extension is not .obo or .owl.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Use .obo or .owl")

    content = await file.read()
    filename = file.filename or "unknown"

    async def event_stream():
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            terms, relations = await asyncio.to_thread(parse_ontology, tmp_path)
            yield f"data: {json.dumps({'progress': 25, 'stage': 'parsed'})}\n\n"
            await asyncio.sleep(0)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'error_code': 422})}\n\n"
            return

        try:
            # Preprocessing step
            preprocessor = OntologyGraphPreprocessor()
            terms = await asyncio.to_thread(preprocessor.preprocess, terms, relations)
            yield f"data: {json.dumps({'progress': 50, 'stage': 'preprocessed'})}\n\n"
            await asyncio.sleep(0)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'error_code': 500})}\n\n"
            return

        try:
            mg = request.app.state.memgraph
            await asyncio.to_thread(_ingest_terms, mg, terms, filename)
            yield f"data: {json.dumps({'progress': 75, 'stage': 'terms_ingested'})}\n\n"
            await asyncio.sleep(0)

            await asyncio.to_thread(_ingest_relations, mg, relations)

            langchain_search = getattr(request.app.state, "langchain_search", None)
            if langchain_search is not None:
                langchain_search.refresh_schema()

            yield f"data: {json.dumps({'progress': 100, 'stage': 'complete', 'filename': filename})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'error_code': 503})}\n\n"
        finally:
            os.unlink(tmp_path)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/list")
def list_ontologies(request: Request):
    """List distinct ontology sources that have been ingested.

    Returns a list of records with the source filename and the number
    of terms ingested from each file.
    """
    mg = request.app.state.memgraph
    records = mg.execute_read(
        "MATCH (n:OntologyTerm) RETURN DISTINCT n.source_file AS source_file, count(n) AS term_count"
    )
    return records
