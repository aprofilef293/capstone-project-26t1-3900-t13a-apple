import math

from fastapi import APIRouter, HTTPException, Query, Request, UploadFile
from pronto import Ontology, Term

from app.models.upload import OntologyRelation, OntologyTerm, OntologyUploadResponse
import io
from app.services import memgraph

router = APIRouter()

#Make sure to add settings later
memgraph = memgraph.MemgraphService(settings=None)

#This function will return the node data and all relationships relevant to the node
def memgraph_data(term: Term):
#Checking if definiton is not none
    definition = None
    if term.definition:
        definition = str(term.definition)
    
    relations = []
    
    term_insert = OntologyTerm(
        id = term.id,
        name = term.name,
        namespace=term.namespace,
        definition= definition,
        synonyms= [syn.description for syn in term.synonyms],
        xrefs= [xr.id for xr in term.xrefs],
        is_obsolete=term.obsolete  
    )
    
    #Getting is_a relationships
    for parent in term.superclasses(distance=1, with_self=False):
        relations_insert = OntologyRelation(
            subject_id= term.id,
            relation_type= "is_a",
            target_id= parent.id
        )
        relations.append(relations_insert)
    
    #Getting all other relationships
    for relation, targets in term.relationships.items():
        for target in targets:
            relations_other_insert = OntologyRelation(
                subject_id= relation.id,
                relation_type= relation.name,
                target_id= target.id
            )
            relations.append(relations_other_insert)
            
    return term_insert, relations



@router.post('obo-file-upload', summary = "Uploading a .obo file")
async def upload_obo(file: UploadFile):
    
    #Checking if file was sent    
    if not file:
        raise HTTPException(status_code=404, detail="No file sent")
    #Error checking to ensure that only .obo files are accepted
    if not file.filename.endswith(".obo"):
        raise HTTPException(status_code=404, detail="Only .obo files can be uploaded")
    
    #FastAPI
    text_stream = io.TextIOWrapper(file.file, encoding='utf-8')
    try:
        ontology_data = Ontology(text_stream)
    except:
        raise HTTPException(status_code=404,detail= "Corrupted Ontology file")
    
    terms: list[OntologyTerm] = []
    relations: list[OntologyRelation] = []
    
    for term in ontology_data.terms():
        
        term_data,relation_data = memgraph_data(term)
        
        #Appending all nodes and their relationships
        terms.append(term_data)
        for r in relation_data:
            relations.append(r)
            
    #Inserting terms into Memgraph
    
    memgraph.execute_write(
        """
        UNWIND $terms as t
        MERGE (n:OntologyTerm {id:t.id})
        ON CREATE SET 
            n.name = t.name,
            n.namespace = t.namespace,
            n.definition = t.definition,
            n.synonyms = t.synonyms,
            n.xrefs = t.xrefs,
            n.is_obselete = t.is_obselete 
        """,
        {
            "terms": [t.model_dump() for t in terms]
        }
    )  
    
    memgraph.execute_write(
        """
        UNWIND $relations as r
        MATCH (s:OntologyTerm {id: r.subject_id})
        MATCH (t:OntologyTerm {id: r.target_id})
        MERGE (s)-(relationship:r.relation_type]->(t)
        ON CREATE SET 
            n.name = t.name,
            n.namespace = t.namespace,
            n.definition = t.definition,
            n.synonyms = t.synonyms,
            n.xrefs = t.xrefs,
            n.is_obselete = t.is_obselete 
        """,
        {
            "relations": [r.model_dump() for r in relations]
        }
    )  