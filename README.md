# FinSight RAG — AI-Powered Investment Document Q&A Engine

> Upload financial documents (PDFs, DOCX, TXT) and ask natural language questions.  
> Every answer is grounded in your documents and includes source citations.
> Features a new dual-mode engine: Fast responses or High-Accuracy Cohere reranking.

![Tech Stack](https://img.shields.io/badge/Groq-Cohere-blue?style=flat-square)
![Vector DB](https://img.shields.io/badge/Pinecone-ChromaDB-green?style=flat-square)
![Frontend](https://img.shields.io/badge/React-TailwindCSS-purple?style=flat-square)
![Backend](https://img.shields.io/badge/FastAPI-Python-orange?style=flat-square)

---

## Features

- **Document Ingestion** — PDF, DOCX, TXT via drag-and-drop upload
- **Intelligent Chunking** — 512-token chunks with 50-token overlap
- **FastEmbed Embeddings** — `BAAI/bge-small-en-v1.5` for semantic search
- **Grounded Q&A** — Groq (Llama 3.1) answers strictly from your document context
- **Fast & Accurate Modes** — Choose between instantaneous retrieval ("Fast") or advanced semantic reranking using Cohere's API ("Accurate") for complex queries.
- **Source Citations** — Every answer shows the filename + page number
- **Confidence Scores** — High / Medium / Low based on cosine similarity
- **Dual Vector DB** — Pinecone (cloud) or ChromaDB (local fallback)
- **Document Management** — List and delete indexed documents

---

## Project Structure

```
finsight-rag/
├── backend/
│   ├── main.py              # FastAPI app (routes, CORS, registry)
│   ├── ingest.py            # Parse → chunk → embed → store pipeline
│   ├── query.py             # RAG query pipeline (embed → search → Cohere rerank → Groq)
│   ├── pinecone_client.py   # Pinecone / ChromaDB dual backend
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── App.jsx          # Root component (layout, header, panels)
│   │   ├── main.jsx         # React entry point
│   │   ├── index.css        # Tailwind + global styles
│   │   ├── services/
│   │   │   └── api.js       # Axios API service layer
│   │   └── components/
│   │       ├── UploadPanel.jsx   # Drag-and-drop upload + document list
│   │       ├── ChatPanel.jsx     # Q&A chat interface (with Fast/Accurate toggle)
│   │       └── AnswerCard.jsx    # Answer + sources + confidence display
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── .env.example             # Required environment variables
└── README.md
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- **Groq API key** — [console.groq.com](https://console.groq.com)
- **Cohere API key** — [dashboard.cohere.com](https://dashboard.cohere.com)
- **Pinecone API key** (optional, or use ChromaDB) — [pinecone.io](https://pinecone.io)

---

## Quick Start

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd finsight-rag
```

Copy and fill in your environment variables:

```bash
cp .env.example backend/.env
```

Edit `backend/.env`:
```env
GROQ_API_KEY=gsk-...
COHERE_API_KEY=cohere_...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=finsight-rag-384

# Use ChromaDB locally (no Pinecone needed):
# USE_CHROMA=true
```

---

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload
```

The API will be available at: **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

---

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at: **http://localhost:5173**

---

## Using ChromaDB (Local, No Pinecone Required)

If you don't have a Pinecone account, you can run everything locally:

1. In `backend/.env`, set: `USE_CHROMA=true`
2. ChromaDB will automatically persist data to `./chroma_store/`
3. No additional setup needed!

---

## API Reference

### `POST /upload`
Upload and index a document.
```
Content-Type: multipart/form-data
Body: file=<PDF|DOCX|TXT>

Response: { doc_id, filename, total_chunks, message }
```

### `POST /query`
Ask a question and get a grounded answer.
```json
{ 
  "question": "What is the net profit?", 
  "filter_doc_id": null,
  "mode": "accurate" 
}

Response: { "answer": "...", "sources": [...], "confidence": "high", "avg_score": 0.87 }
```

### `GET /documents`
List all indexed documents.
```
Response: { "documents": [...], "total": 3 }
```

### `DELETE /documents/{doc_id}`
Remove a document from the index.
```
Response: { "success": true, "filename": "...", "message": "..." }
```

---

## UI Design

- **Theme**: Dark navy + gold accent (finance-grade aesthetic)
- **Left Panel**: Drag-and-drop upload area + indexed document list
- **Right Panel**: Chat interface with message history and Fast/Accurate modes toggle
- **Answer Cards**: Answer text + source badges + confidence bar
- **Glassmorphism**: Frosted glass panels with subtle borders
- **Animations**: Slide-up entries, shimmer loading, pulse indicators

---

## Grounding & Safety

The system prompt enforces strict document-grounded answers:

> *"Answer ONLY based on the provided context excerpts. If the answer is not present in the context, respond with 'I could not find this in the uploaded documents.'"*

Groq (Llama 3.1) is called with `temperature=0.1` to minimise hallucination.
When "Accurate" mode is used, Cohere's `rerank-english-v3.0` ensures only the most semantically relevant top 5 chunks out of the top 20 Pinecone hits are passed into the LLM context.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | Required for Llama 3.1 inference |
| `COHERE_API_KEY`| — | Required for accurate reranking |
| `PINECONE_API_KEY` | — | Required if `USE_CHROMA=false` |
| `PINECONE_ENVIRONMENT` | `us-east-1` | Pinecone region |
| `PINECONE_INDEX_NAME` | `finsight-rag-384` | Pinecone index name |
| `USE_CHROMA` | `false` | Use local ChromaDB instead |

Chunking parameters (in `backend/ingest.py`):
- `CHUNK_SIZE = 512` tokens
- `CHUNK_OVERLAP = 50` tokens

---

## Troubleshooting

**CORS errors** — Ensure the backend is running on port 8000 and the Vite proxy is configured.

**`PINECONE_API_KEY is not set`** — Either add your key to `.env` or set `USE_CHROMA=true`.

**Empty answers** — Upload documents first before querying. Ensure your API key has sufficient credits.

**Slow first query** — Pinecone index creation takes ~30 seconds on first run.

---

## License

MIT License — see [LICENSE](LICENSE) for details.