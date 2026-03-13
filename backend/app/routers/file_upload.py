import io

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pronto import Ontology, Term

from app.models.upload import OntologyRelation, OntologyTerm, OntologyUploadResponse
from app.services.memgraph import MemgraphService

router = APIRouter()


# This function will return the node data and all relationships relevant to the node
def memgraph_data(term: Term):
    # Checking if definiton is not none
    definition = None
    if term.definition:
        definition = str(term.definition)

    relations = []

    term_insert = OntologyTerm(
        id=term.id,
        name=term.name,
        namespace=term.namespace,
        definition=definition,
        synonyms=[syn.description for syn in term.synonyms],
        xrefs=[xr.id for xr in term.xrefs],
        is_obsolete=term.obsolete,
    )

    # Getting is_a relationships
    for parent in term.superclasses(distance=1, with_self=False):
        relations_insert = OntologyRelation(subject_id=term.id, relation_type="is_a", target_id=parent.id)
        relations.append(relations_insert)

    # Getting all other relationships
    for relation, targets in term.relationships.items():
        for target in targets:
            relations_other_insert = OntologyRelation(
                subject_id=term.id, relation_type=relation.name, target_id=target.id
            )
            relations.append(relations_other_insert)

    return term_insert, relations


@router.post("/upload", response_model=OntologyUploadResponse, summary="Uploading a .obo file")
async def upload_obo(request: Request, file: UploadFile = File(...)):

    mg: MemgraphService = request.app.state.memgraph
    # Checking if file was sent

    # Error checking to ensure that only .obo files are accepted
    if not file.filename.endswith(".obo"):
        raise HTTPException(status_code=400, detail="Only .obo files can be uploaded")

    # FastAPI
    byte_stream = await file.read()
    try:
        ontology_data = Ontology(io.BytesIO(byte_stream))
    except Exception as e:
        print(e)
        raise HTTPException(status_code=404, detail="Corrupted Ontology file")

    terms: list[OntologyTerm] = []
    relations: list[OntologyRelation] = []

    for term in ontology_data.terms():
        term_data, relation_data = memgraph_data(term)
        # Appending all nodes and their relationships
        terms.append(term_data)
        for r in relation_data:
            relations.append(r)

    # Deleting all old terms and relationships from memgraph
    mg.execute_write(
        """
        MATCH (n)
        DETACH DELETE n
        """
    )
    # Inserting terms into Memgraph
    mg.execute_write(
        """
        UNWIND $terms as t
        MERGE (n:OntologyTerm {id:t.id})
        ON CREATE SET
            n.name = t.name,
            n.namespace = t.namespace,
            n.definition = t.definition,
            n.synonyms = t.synonyms,
            n.xrefs = t.xrefs,
            n.is_obsolete = t.is_obsolete
        """,
        {"terms": [t.model_dump() for t in terms]},
    )

    mg.execute_write(
        """
        UNWIND $relations as r
        MATCH (s:OntologyTerm {id: r.subject_id})
        MATCH (t:OntologyTerm {id: r.target_id})
        MERGE (s)-[:RELATED_TO {type: r.relation_type}]->(t)
        """,
        {"relations": [r.model_dump() for r in relations]},
    )

    namespaces = list({t.namespace for t in terms if t.namespace})

    return OntologyUploadResponse(
        filename=file.filename,
        term_count=len(terms),
        relation_count=len(relations),
        namespaces=namespaces,
        message=f"Successfully uploaded {file.filename}",
    )


@router.get("/", summary="testing backend")
async def test_backend():
    return {"Backend going"}
