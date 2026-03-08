import math

from fastapi import APIRouter, HTTPException, Query, Request, UploadFile
from pronto import Ontology

from app.models.graph import GraphData, SerializedEdge, SerializedNode

router = APIRouter()

@router.post('obo-file-upload', summary = "Uploading a .obo file")
async def upload_obo(file: UploadFile):
    
    #Checking if file was sent    
    if not file:
        raise HTTPException(status_code=404, detail="No file sent")
    #Error checking to ensure that only .obo files are accepted
    if not file.filename.endswith(".obo"):
        raise HTTPException(status_code=404, detail="Only .obo files can be uploaded")
    
    try:
        ontology_data = Ontology(file.file)
    except:
        raise HTTPException(status_code=404,detail= "Corrupted Ontology file")
    
    terms = ontology_data.terms()
    
    term_data = []
    
    #Getting all attributes and values of a term
    for term in terms:
        term_dict = {}
        for k,v in vars(term).items():
            term_dict[k] = v
        term_data.append(term_dict)     
        
        
    
    