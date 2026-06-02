"""
ingest.py
---------
Document ingestion pipeline:
  1. Parse PDF / DOCX / TXT files
  2. Chunk text (512-token chunks, 50-token overlap)
  3. Generate OpenAI embeddings
  4. Store vectors + metadata in Pinecone / ChromaDB
"""

import os
import io
import uuid
import hashlib
import logging
from typing import List, Dict, Any, Tuple

import tiktoken
from dotenv import load_dotenv
from fastembed import TextEmbedding

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CHUNK_SIZE = 512   # tokens
CHUNK_OVERLAP = 50  # tokens

# Initialize FastEmbed (downloads model if not cached, runs on CPU locally)
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
tokenizer = tiktoken.get_encoding("cl100k_base")


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def parse_pdf(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Return list of {page, text} dicts from a PDF."""
    import fitz  # PyMuPDF

    pages = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text").strip()
        if text:
            pages.append({"page": page_num, "text": text})
    doc.close()
    return pages


def parse_docx(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Return list of {page, text} dicts from a DOCX (pages approximated)."""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    # Approximate page break every 40 paragraphs
    pages = []
    chunk_size = 40
    for i in range(0, len(paragraphs), chunk_size):
        page_text = "\n".join(paragraphs[i : i + chunk_size])
        pages.append({"page": i // chunk_size + 1, "text": page_text})
    return pages


def parse_txt(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Return list of {page, text} dicts from a plain-text file."""
    text = file_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()
    pages = []
    chunk_size = 100  # approximate page every 100 lines
    for i in range(0, len(lines), chunk_size):
        page_text = "\n".join(lines[i : i + chunk_size]).strip()
        if page_text:
            pages.append({"page": i // chunk_size + 1, "text": page_text})
    return pages


def parse_document(
    file_bytes: bytes, filename: str
) -> List[Dict[str, Any]]:
    """Dispatch to correct parser based on file extension."""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return parse_pdf(file_bytes, filename)
    elif lower.endswith(".docx"):
        return parse_docx(file_bytes, filename)
    elif lower.endswith(".txt"):
        return parse_txt(file_bytes, filename)
    else:
        raise ValueError(
            f"Unsupported file type: {filename}. Supported: PDF, DOCX, TXT"
        )


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str) -> List[str]:
    """
    Split *text* into overlapping token-based chunks.
    Returns a list of plain text strings.
    """
    tokens = tokenizer.encode(text)
    chunks: List[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(tokenizer.decode(chunk_tokens))
        if end == len(tokens):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Generate local embeddings using FastEmbed.
    Returns list of embedding vectors.
    """
    logger.info(f"Generating local embeddings for {len(texts)} chunks...")
    embeddings = list(embedding_model.embed(texts))
    return [e.tolist() for e in embeddings]


# ---------------------------------------------------------------------------
# Ingestion entry point
# ---------------------------------------------------------------------------

def ingest_document(
    file_bytes: bytes,
    filename: str,
) -> Tuple[str, int]:
    """
    Full pipeline: parse → chunk → embed → upsert.

    Returns (doc_id, total_chunks_indexed).
    """
    from pinecone_client import upsert_vectors  # lazy import avoids circular

    # Stable doc_id based on filename + content hash
    content_hash = hashlib.md5(file_bytes).hexdigest()[:8]
    safe_name = filename.replace(" ", "_").replace("/", "_")
    doc_id = f"{safe_name}_{content_hash}"

    logger.info(f"Ingesting '{filename}' → doc_id={doc_id}")

    # 1. Parse
    pages = parse_document(file_bytes, filename)
    if not pages:
        raise ValueError(f"No text extracted from '{filename}'.")

    # 2. Chunk each page
    all_chunks: List[Dict[str, Any]] = []
    chunk_idx = 0
    for page_info in pages:
        page_num = page_info["page"]
        page_text = page_info["text"]
        chunks = chunk_text(page_text)
        for chunk_text_str in chunks:
            all_chunks.append(
                {
                    "chunk_index": chunk_idx,
                    "page": page_num,
                    "text": chunk_text_str,
                    "doc_id": doc_id,
                    "filename": filename,
                }
            )
            chunk_idx += 1

    logger.info(f"Generated {len(all_chunks)} chunks for '{filename}'")

    # 3. Embed all chunks
    texts = [c["text"] for c in all_chunks]
    embeddings = embed_texts(texts)

    # 4. Build Pinecone-compatible vector records
    vectors = []
    for chunk, embedding in zip(all_chunks, embeddings):
        vector_id = f"{doc_id}_chunk_{chunk['chunk_index']}"
        vectors.append(
            {
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "doc_id": doc_id,
                    "filename": filename,
                    "page": chunk["page"],
                    "chunk_index": chunk["chunk_index"],
                    "text": chunk["text"][:1000],  # Pinecone metadata limit
                },
            }
        )

    # 5. Upsert to vector store
    upsert_vectors(vectors)
    logger.info(f"Upserted {len(vectors)} vectors for doc_id={doc_id}")

    return doc_id, len(vectors)
