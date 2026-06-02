"""
query.py
--------
RAG query pipeline:
  1. Embed the user question
  2. Similarity-search in Pinecone / ChromaDB (top-5)
  3. Build context from retrieved chunks
  4. Call GPT-4o with a strict grounded-answer prompt
  5. Return answer + source citations + confidence score
"""

import os
import logging
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from fastembed import TextEmbedding
from groq import Groq

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CHAT_MODEL = "llama-3.1-8b-instant"
TOP_K = 5

groq_client = Groq(api_key=GROQ_API_KEY)
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

SYSTEM_PROMPT = """You are FinSight, an expert financial document analyst.
Answer ONLY based on the provided context excerpts from financial documents.
If the answer is not present in the context, respond with exactly:
"I could not find this in the uploaded documents."

Rules:
- Be precise and factual.
- Always cite sources (document name and page number) for every claim.
- Use the format [Source: <filename>, Page <page>] inline after each fact.
- Never add information from your training data or make assumptions.
- Structure your answer clearly with bullet points where appropriate.
"""


# ---------------------------------------------------------------------------
# Confidence mapping
# ---------------------------------------------------------------------------

def score_to_confidence(avg_score: float) -> str:
    """Map average cosine similarity to high/medium/low label."""
    if avg_score >= 0.80:
        return "high"
    elif avg_score >= 0.60:
        return "medium"
    else:
        return "low"


# ---------------------------------------------------------------------------
# Query pipeline
# ---------------------------------------------------------------------------

def query_documents(
    question: str,
    filter_doc_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full RAG pipeline for a given *question*.

    Returns:
        {
          "answer": str,
          "sources": [{"filename": str, "page": int, "score": float}],
          "confidence": "high" | "medium" | "low",
          "avg_score": float,
        }
    """
    from pinecone_client import query_vectors  # lazy import

    if not question.strip():
        return {
            "answer": "Please enter a valid question.",
            "sources": [],
            "confidence": "low",
            "avg_score": 0.0,
        }

    # 1. Embed the question
    embeddings = list(embedding_model.embed([question]))
    question_embedding = embeddings[0].tolist()

    # 2. Query vector store
    filter_meta = {"doc_id": {"$eq": filter_doc_id}} if filter_doc_id else None
    matches = query_vectors(
        embedding=question_embedding,
        top_k=TOP_K,
        filter_meta=filter_meta,
    )

    if not matches:
        return {
            "answer": (
                "I could not find this in the uploaded documents. "
                "Please upload relevant financial documents first."
            ),
            "sources": [],
            "confidence": "low",
            "avg_score": 0.0,
        }

    # 3. Build context from retrieved chunks
    context_parts: List[str] = []
    sources: List[Dict[str, Any]] = []
    seen_sources = set()

    for match in matches:
        meta = match.get("metadata", {})
        text = meta.get("text", "")
        filename = meta.get("filename", "unknown")
        page = meta.get("page", 0)
        score = round(match.get("score", 0.0), 4)

        context_parts.append(
            f"[Source: {filename}, Page {page}]\n{text}"
        )

        source_key = f"{filename}_{page}"
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            sources.append(
                {"filename": filename, "page": page, "score": score}
            )

    context = "\n\n---\n\n".join(context_parts)

    # 4. Call Groq API for LLM response
    user_message = (
        f"Context from financial documents:\n\n{context}\n\n"
        f"Question: {question}"
    )

    chat_resp = groq_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.1,
        max_tokens=1024,
    )

    answer = chat_resp.choices[0].message.content.strip()

    # 5. Compute confidence
    scores = [m.get("score", 0.0) for m in matches]
    avg_score = round(sum(scores) / len(scores), 4) if scores else 0.0
    confidence = score_to_confidence(avg_score)

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "avg_score": avg_score,
    }
