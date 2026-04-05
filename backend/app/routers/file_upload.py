import asyncio
import json
import logging
import os
import tempfile
import time

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.models.upload import OntologyRelation, OntologyTerm
from app.services.graph_preprocessing import OntologyGraphPreprocessor
from app.services.memgraph import MemgraphService
from app.services.ontology_parser import parse_ontology

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".obo", ".owl"}

# User-friendly error messages keyed by error code / pipeline stage.
# The raw exception is still logged for debugging.
USER_FRIENDLY_ERRORS: dict[int, str] = {
    400: ("The file type you uploaded is not supported. Please upload a .obo or .owl file."),
    413: ("The file is too large to process. Please reduce the file size and try again."),
    422: (
        "The file could not be parsed."
        " It may be malformed or contain unsupported syntax."
        " Please check the file and try again."
    ),
    500: ("Something went wrong while processing the ontology structure. Please try again or contact support."),
    503: ("The database could not store the ontology data. Please try again later or contact support."),
}

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
    mg.execute_write("STORAGE MODE IN_MEMORY_ANALYTICAL")
    mg.execute_write("DROP GRAPH")
    mg.execute_write("STORAGE MODE IN_MEMORY_TRANSACTIONAL")
    mg.execute_write("CREATE INDEX ON :OntologyTerm(id)")
    mg.execute_write("CREATE INDEX ON :OntologyTerm(name)")
    mg.execute_write("CREATE INDEX ON :OntologyTerm(namespace)")
    mg.execute_write("CREATE INDEX ON :OntologyTerm(synonyms)")
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
        raise HTTPException(status_code=400, detail=USER_FRIENDLY_ERRORS[400])

    max_size = request.app.state.settings.upload_max_size_mb * 1024 * 1024
    content = bytearray()
    while chunk := await file.read(8192):
        content += chunk
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=USER_FRIENDLY_ERRORS[413],
            )
    content = bytes(content)
    filename = file.filename or "unknown"

    async def event_stream():
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        pipeline_start = time.perf_counter()

        try:
            t0 = time.perf_counter()
            terms, relations = await asyncio.to_thread(parse_ontology, tmp_path)
            logger.info(
                "Parsing completed in %.3fs (%d terms, %d relations)",
                time.perf_counter() - t0,
                len(terms),
                len(relations),
            )
            yield f"data: {json.dumps({'progress': 25, 'stage': 'parsed'})}\n\n"
            await asyncio.sleep(0)
        except Exception as e:
            logger.error("Parse error for %s: %s", filename, e, exc_info=True)
            yield f"data: {json.dumps({'error': USER_FRIENDLY_ERRORS[422], 'error_code': 422})}\n\n"
            return

        # Kick off embedding computation early — it only needs the parsed
        # terms and is independent of preprocessing / Memgraph ingestion.
        embedding_svc = getattr(request.app.state, "embedding_service", None)
        embedding_task: asyncio.Task | None = None
        embedding_start: float | None = None
        if embedding_svc is not None:
            active_terms = [t for t in terms if not t.is_obsolete]
            ids = [t.id for t in active_terms]
            term_dicts = [t.model_dump() for t in active_terms]
            embedding_start = time.perf_counter()
            embedding_task = asyncio.create_task(embedding_svc.build_index(ids, term_dicts))

        try:
            # Preprocessing step
            t0 = time.perf_counter()
            preprocessor = OntologyGraphPreprocessor()
            terms = await asyncio.to_thread(preprocessor.preprocess, terms, relations)
            logger.info("Preprocessing completed in %.3fs", time.perf_counter() - t0)
            yield f"data: {json.dumps({'progress': 50, 'stage': 'preprocessed'})}\n\n"
            await asyncio.sleep(0)
        except Exception as e:
            if embedding_task:
                embedding_task.cancel()
            logger.error("Preprocessing error for %s: %s", filename, e, exc_info=True)
            yield f"data: {json.dumps({'error': USER_FRIENDLY_ERRORS[500], 'error_code': 500})}\n\n"
            return

        try:
            mg = request.app.state.memgraph

            t0 = time.perf_counter()
            await asyncio.to_thread(_ingest_terms, mg, terms, filename)
            logger.info("Term ingestion completed in %.3fs", time.perf_counter() - t0)
            yield f"data: {json.dumps({'progress': 75, 'stage': 'terms_ingested'})}\n\n"
            await asyncio.sleep(0)

            t0 = time.perf_counter()
            await asyncio.to_thread(_ingest_relations, mg, relations)
            logger.info("Relation ingestion completed in %.3fs", time.perf_counter() - t0)
            request.app.state.graph_cache = None

            # Wait for embeddings to finish (may already be done).
            if embedding_task:
                try:
                    await embedding_task
                    logger.info("Embedding index built in %.3fs", time.perf_counter() - embedding_start)
                except Exception as emb_err:
                    logger.warning("Embedding index failed (non-fatal): %s", emb_err)

            logger.info("Total upload pipeline completed in %.3fs", time.perf_counter() - pipeline_start)
            yield f"data: {json.dumps({'progress': 100, 'stage': 'complete', 'filename': filename})}\n\n"
        except Exception as e:
            logger.error("Ingestion error for %s: %s", filename, e, exc_info=True)
            yield f"data: {json.dumps({'error': USER_FRIENDLY_ERRORS[503], 'error_code': 503})}\n\n"
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
