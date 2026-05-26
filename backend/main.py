"""
main.py
-------
FastAPI application for FinSight RAG.

Routes:
  POST /upload          → Ingest a document file
  POST /query           → RAG Q&A
  GET  /documents       → List indexed documents
  DELETE /documents/{doc_id} → Remove a document
"""

import os
import json
import logging
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="FinSight RAG API",
    description="AI-powered Investment Document Q&A Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory registry of uploaded documents (supplements vector store metadata)
_document_registry: dict = {}
REGISTRY_PATH = "./document_registry.json"


def _load_registry():
    global _document_registry
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH) as f:
            _document_registry = json.load(f)


def _save_registry():
    with open(REGISTRY_PATH, "w") as f:
        json.dump(_document_registry, f, indent=2)


_load_registry()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str
    filter_doc_id: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    sources: list
    confidence: str
    avg_score: float


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "FinSight RAG API"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


@app.post("/upload", tags=["Documents"])
async def upload_document(file: UploadFile = File(...)):
    """
    Accept a PDF, DOCX, or TXT file.
    Parse → chunk → embed → store in Pinecone/ChromaDB.
    """
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 50 MB."
        )

    try:
        from ingest import ingest_document

        doc_id, total_chunks = ingest_document(file_bytes, filename)

        # Register document metadata
        _document_registry[doc_id] = {
            "doc_id": doc_id,
            "filename": filename,
            "size_bytes": len(file_bytes),
            "total_chunks": total_chunks,
            "file_type": ext.lstrip(".").upper(),
        }
        _save_registry()

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": filename,
            "total_chunks": total_chunks,
            "message": f"Successfully indexed {total_chunks} chunks from '{filename}'.",
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception(f"Upload failed for '{filename}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {str(e)}",
        )


@app.post("/query", response_model=QueryResponse, tags=["Q&A"])
async def query_documents_endpoint(request: QueryRequest):
    """
    Accept a natural language question and return a grounded answer
    with source citations and a confidence score.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        from query import query_documents

        result = query_documents(
            question=request.question,
            filter_doc_id=request.filter_doc_id,
        )
        return QueryResponse(**result)

    except Exception as e:
        logger.exception(f"Query failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Query processing failed: {str(e)}"
        )


@app.get("/documents", tags=["Documents"])
async def list_documents():
    """Return a list of all indexed documents from the local registry."""
    docs = list(_document_registry.values())
    return {"documents": docs, "total": len(docs)}


@app.delete("/documents/{doc_id}", tags=["Documents"])
async def delete_document(doc_id: str):
    """
    Remove a document and all its chunks from the vector store.
    """
    if doc_id not in _document_registry:
        raise HTTPException(
            status_code=404,
            detail=f"Document '{doc_id}' not found in registry.",
        )

    try:
        from pinecone_client import delete_vectors_by_doc

        delete_vectors_by_doc(doc_id)
        doc_info = _document_registry.pop(doc_id)
        _save_registry()

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": doc_info.get("filename"),
            "message": f"Document '{doc_info.get('filename')}' removed successfully.",
        }

    except Exception as e:
        logger.exception(f"Delete failed for doc_id={doc_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Deletion failed: {str(e)}"
        )
