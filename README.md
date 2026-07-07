# University Policy RAG Chatbot

A Retrieval-Augmented-Generation assistant that answers university students'
questions about school policies, rules, and documents — grounded strictly in
official source PDFs.

## Monorepo layout

```
diploma/
├── frontend/        Next.js (App Router) + Tailwind — the chat UI
├── core-backend/    Node + TypeScript + Sequelize — auth, chat history, orchestration
└── rag-engine/      Python + FastAPI — PDF ingestion, embeddings, retrieval + LLM
```

### Request flow

```
frontend  ──HTTP──▶  core-backend  ──HTTP──▶  rag-engine
(browser)            (orchestrator,           (stateless:
                      persists history)         retrieval + Gemini)
```

The browser talks **only** to `core-backend`. The `core-backend` persists the
user message, calls `rag-engine`, persists the reply, and returns it. The
`rag-engine` is internal-only and knows nothing about users or sessions.

## Running locally

Three terminals. Prerequisites: Postgres, a running Qdrant, and a Gemini API key.

### 1. rag-engine (Python, port 8000)

```bash
cd rag-engine
pip install -r requirements.txt
# .env holds GEMINI_API_KEY (and optionally RAG_INTERNAL_KEY)
uvicorn app.main:app --reload --port 8000
```

Ingest the source PDFs once (CLI, unchanged by the API layer):

```bash
python scripts/ingest_all.py --reset
```

### 2. core-backend (Node, port 4000)

```bash
cd core-backend
npm install
cp .env.example .env        # set DATABASE_URL + RAG_INTERNAL_KEY (must match rag-engine)
npm run dev
```

### 3. frontend (Next.js, port 3000)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000, click **Start chatting**, then register or sign in.

## Auth

- `POST /api/auth/register` `{ email, password, name? }` → `{ user, token }`
- `POST /api/auth/login` `{ email, password }` → `{ user, token }`

The frontend stores the JWT and sends it as `Authorization: Bearer <token>` on
every protected call. Sessions are owned by the authenticated user — you can
only read/continue your own conversations.

## Multi-turn

The engine condenses follow-up questions ("тэгээд?", "дэлгэрэнгүй") into a
standalone query using prior turns before retrieval, so context carries across
a conversation. The core-backend forwards prior turns (excluding the current
question) with each request.

## Notes

- `RAG_INTERNAL_KEY` must be identical in `core-backend/.env` and the
  `rag-engine` environment — it's the shared secret guarding the engine.
- `core-backend` uses `sequelize.sync()` for dev convenience; switch to
  migrations before production.
- See `rag-engine/ARCHITECTURE.md` for the engine internals (extraction, OCR,
  chunking, embeddings, Qdrant, and the Gemini prompt).
```
