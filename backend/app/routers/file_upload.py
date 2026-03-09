import math

from fastapi import APIRouter, HTTPException, Query, Request, UploadFile
from pronto import Ontology

from app.models.upload import OntologyRelation, OntologyTerm, OntologyUploadResponse
import io

router = APIRouter()

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
        
        #Checking if definiton is not none
        definition = None
        if term.definition:
            definition = str(term.definition)
        
            
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
        
        #Getting all other relationships
        for relation, targets in term.relationships.items():
            for target in targets:
                relations_other_insert = OntologyRelation(
                    subject_id= relation.id,
                    relation_type= relation.name,
                    target_id= target.id
                )
            
        
        
        relations.append(relations_insert)
        relations.append(relations_other_insert)
        terms.append(term_insert)
    
    
    
    
        
        
    
    