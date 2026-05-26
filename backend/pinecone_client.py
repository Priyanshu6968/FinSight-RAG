"""
pinecone_client.py
------------------
Initializes Pinecone (or a local numpy-based fallback) and exposes helper
functions used across the FinSight RAG backend.

Local fallback (USE_CHROMA=true or PINECONE_API_KEY not set) uses a
simple JSON + numpy cosine-similarity store — no C++ compiler required.
"""

import os
import json
import uuid
import numpy as np
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

USE_CHROMA = os.getenv("USE_CHROMA", "false").lower() == "true"
_PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")

# Use local fallback if explicitly requested OR if no Pinecone key is set
USE_LOCAL = USE_CHROMA or not _PINECONE_API_KEY

# ---------------------------------------------------------------------------
# Local numpy-based vector store (no external dependencies beyond numpy)
# ---------------------------------------------------------------------------
if USE_LOCAL:
    import json, numpy as np

    _STORE_PATH = "./local_vector_store.json"

    def _load_store() -> List[Dict[str, Any]]:
        if os.path.exists(_STORE_PATH):
            with open(_STORE_PATH, "r") as f:
                return json.load(f)
        return []

    def _save_store(records: List[Dict[str, Any]]) -> None:
        with open(_STORE_PATH, "w") as f:
            json.dump(records, f)

    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        a, b = np.array(a), np.array(b)
        norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def upsert_vectors(
        vectors: List[Dict[str, Any]], namespace: str = ""
    ) -> None:
        store = _load_store()
        existing_ids = {r["id"] for r in store}
        for v in vectors:
            if v["id"] in existing_ids:
                store = [r for r in store if r["id"] != v["id"]]
            store.append({
                "id": v["id"],
                "values": v["values"],
                "metadata": v.get("metadata", {}),
            })
        _save_store(store)

    def query_vectors(
        embedding: List[float],
        top_k: int = 5,
        filter_meta: Optional[Dict] = None,
        namespace: str = "",
    ) -> List[Dict[str, Any]]:
        store = _load_store()
        if not store:
            return []

        results = []
        for record in store:
            # Apply metadata filter if provided
            if filter_meta:
                match = True
                for key, cond in filter_meta.items():
                    val = record["metadata"].get(key, "")
                    if isinstance(cond, dict):
                        op = list(cond.keys())[0]
                        expected = cond[op]
                        if op == "$eq" and val != expected:
                            match = False
                    elif val != cond:
                        match = False
                if not match:
                    continue

            score = _cosine_similarity(embedding, record["values"])
            results.append({
                "id": record["id"],
                "score": score,
                "metadata": record["metadata"],
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def delete_vectors_by_doc(doc_id: str) -> None:
        store = _load_store()
        store = [r for r in store if r["metadata"].get("doc_id") != doc_id]
        _save_store(store)

    def list_documents() -> List[Dict[str, Any]]:
        store = _load_store()
        seen: Dict[str, Dict] = {}
        for record in store:
            did = record["metadata"].get("doc_id", "")
            if did and did not in seen:
                seen[did] = {
                    "doc_id": did,
                    "filename": record["metadata"].get("filename", ""),
                    "total_chunks": 0,
                }
            if did:
                seen[did]["total_chunks"] += 1
        return list(seen.values())

# ---------------------------------------------------------------------------
# Pinecone backend
# ---------------------------------------------------------------------------
else:
    from pinecone import Pinecone, ServerlessSpec

    _PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME", "finsight-rag")
    _PINECONE_ENV = os.getenv("PINECONE_ENVIRONMENT", "us-east-1")

    _pc: Optional[Any] = None
    _index = None

    def _get_index():
        global _pc, _index
        if _index is not None:
            return _index
        _pc = Pinecone(api_key=_PINECONE_API_KEY)
        existing = [i.name for i in _pc.list_indexes()]
        if _PINECONE_INDEX not in existing:
            _pc.create_index(
                name=_PINECONE_INDEX,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region=_PINECONE_ENV),
            )
        _index = _pc.Index(_PINECONE_INDEX)
        return _index

    def upsert_vectors(
        vectors: List[Dict[str, Any]], namespace: str = ""
    ) -> None:
        idx = _get_index()
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i: i + batch_size]
            idx.upsert(vectors=batch, namespace=namespace)

    def query_vectors(
        embedding: List[float],
        top_k: int = 5,
        filter_meta: Optional[Dict] = None,
        namespace: str = "",
    ) -> List[Dict[str, Any]]:
        idx = _get_index()
        resp = idx.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter=filter_meta,
            namespace=namespace,
        )
        return [
            {
                "id": m["id"],
                "score": m["score"],
                "metadata": m.get("metadata", {}),
            }
            for m in resp.get("matches", [])
        ]

    def delete_vectors_by_doc(doc_id: str) -> None:
        idx = _get_index()
        idx.delete(filter={"doc_id": {"$eq": doc_id}})

    def list_documents() -> List[Dict[str, Any]]:
        idx = _get_index()
        stats = idx.describe_index_stats()
        total = stats.get("total_vector_count", 0)
        return [{"total_vectors": total, "note": "Use /documents for details"}]
