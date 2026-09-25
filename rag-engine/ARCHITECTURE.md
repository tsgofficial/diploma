# Architecture

Reference for the Mongolian university policy RAG chatbot. Covers every file
created so far, the role each plays, the data flow through them, and the
contracts between modules.

---

## At a glance

```
diploma/
├── app/                  ← the package (importable as `app`)
│   ├── __init__.py
│   ├── __main__.py       CLI entrypoint (`python -m app ...`)
│   ├── config.py         constants + .env loader
│   ├── db.py             SQLite connection + schema
│   ├── models.py         Document dataclass + CRUD
│   ├── extract.py        PDF text extraction (per page) with auto OCR fallback + cache
│   ├── ocr.py            Tesseract OCR wrapper
│   ├── chunking.py       section- and page-aware chunker
│   ├── embed.py          bge-m3 dense + sparse embeddings (lazy singleton)
│   ├── rerank.py         bge-reranker-v2-m3 cross-encoder (lazy singleton)
│   ├── vector_store.py   Qdrant wrapper (hybrid: dense + sparse, RRF fusion)
│   ├── llm.py            Gemini wrapper + system prompt
│   ├── ingestion.py      orchestrator: PDF → SQLite + Qdrant
│   └── retrieval.py      orchestrator: question → answer
├── scripts/
│   └── ingest_all.py     batch ingest the six source PDFs
├── data/
│   ├── policies.db       SQLite (created at runtime, gitignored)
│   └── extracted/        cached page text per PDF (content-hash keyed)
├── pdfs/                 source PDFs
├── poc.py                original single-file proof of concept (kept for reference)
├── requirements.txt      Python dependencies
├── .env                  GEMINI_API_KEY (gitignored)
└── .gitignore
```

---

## Dependency layering

Higher layers depend on lower layers; lower layers never import from higher.

```
                        ┌────────────────────┐
                        │   __main__.py      │   CLI
                        └─────────┬──────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
   ┌────────────────────┐                  ┌────────────────────┐
   │   ingestion.py     │                  │   retrieval.py     │   orchestrators
   └─────────┬──────────┘                  └─────────┬──────────┘
             │                                       │
   ┌─────────┼──────────┐                   ┌────────┼─────────┐
   ▼         ▼          ▼                   ▼        ▼         ▼
extract  chunking    embed              embed   vector_store  llm
   │
   ▼
  ocr
                                ┌────────────────────┐
                                │    models.py       │   data
                                └─────────┬──────────┘
                                          ▼
                                 ┌────────────────────┐
                                 │      db.py         │
                                 └────────────────────┘

                          config.py is imported by everyone
```

The FastAPI layer (not yet written) will sit beside `__main__.py` and call the
same two orchestrators — `ingestion.ingest_pdf()` and
`retrieval.answer_question()`.

---

## Data flow — ingest

```
PDF file
   │
   │  app.extract.extract_pages(path)          (cached in data/extracted/)
   │     ├── try PyMuPDF, page by page
   │     ├── score Cyrillic ratio
   │     └── if garbled or empty → app.ocr.ocr_pages()
   ▼
list[str]  ← one string per page (Mongolian Cyrillic)
   │
   │  app.chunking.chunk_pages(pages)
   ▼
list[Chunk]  ← {text, section, page_start, page_end}
   │           ~800 chars, never crossing a heading; overlap within section only
   │           runs of short numbered items ("1. <school> <url>") stay in the text as a
   │           list; stacked headings join as "A / B" (wrapped titles, table columns)
   │
   │  app.ingestion.embedding_text(title, chunk)  → "title\nsection\n\ntext"
   │  app.embed.embed_texts(...)        → dense  (N, 1024) L2-normalized
   │  app.embed.sparse_embed_texts(...) → sparse {token_id: weight} per chunk
   ▼
   │  app.models.create_document(...)
   ▼
SQLite row in `documents` table  → document_id
   │
   │  app.vector_store.upsert_chunks(...)
   ▼
N points in Qdrant collection `policies`, vectors {dense, sparse}, payload:
{ text, section, page_start, page_end, chunk_index, document_id, doc_title,
  category, effective_date, status }
```

## Data flow — query

```
question (str) [+ history]
   │
   │  app.llm.rewrite_query()   one Gemini call → {query, alternatives, language, in_scope}
   │     translates English / Latin-script Mongolian to formal Mongolian, expands
   │     abbreviations, condenses follow-ups (QUERY_REWRITE=0 → condense_question() only)
   │
   ├─ in_scope == false (nothing to do with the university) → return refusal
   │     before any search — otherwise the reranker scores the closest chunk highly
   ▼
standalone query (+ alternative phrasings: each is searched, every candidate is
                  reranked against every phrasing, best score kept)
   │
   │  app.embed.embed_query(q)        → dense  list[float] (1024)
   │  app.embed.sparse_embed_query(q) → sparse {token_id: weight}
   ▼
   │  app.vector_store.search_active(dense, sparse, top_k=CANDIDATE_K)
   │     ├── prefetch dense  (cosine, status == "active")
   │     ├── prefetch sparse (dot,    status == "active")
   │     └── FusionQuery(RRF)  → 20 candidates
   ▼
   │  app.rerank.rerank(q, candidates)  → bge-reranker-v2-m3 probability each
   │  sort, keep TOP_K (+ the RESCUE_K best fused candidates if demoted)
   ▼
list[Hit]  {payload, dense_score, sparse_score, rerank_score}
   │
   ├─ if best rerank_score < MIN_RERANK_SCORE → return refusal (no LLM call)
   │
   │  app.llm.generate_answer(question, context_chunks)
   │     ├── each chunk headed "[Эх сурвалж: <title>, х. <pages> | <section>]"
   │     ├── system prompt: answer only from context, cite title + page;
   │     │   if only related facts exist, say it isn't stated, then give them
   │     ├── temperature=0, thinking disabled
   │     └── Gemini 3.1-flash-lite (daily-quota 429 → GeminiQuotaExceeded, surfaced to
   │         the user instead of a false "мэдээлэл олдсонгүй"; 5xx retried twice)
   ▼
{ answer, sources, citations[{doc_title, document_id, pages}], hits, refused, top_score, llm_usage }
```

`retrieval.retrieve()` is everything above the LLM call; the eval harness
calls it directly so retrieval quality is measured with zero Gemini calls.

---

## File-by-file reference

### `app/__init__.py`
Empty. Marks `app/` as a Python package so `from app import ...` works.

### `app/__main__.py`
CLI entrypoint. Enables `python -m app <subcommand>`. Five subcommands:

| Subcommand | Purpose |
|---|---|
| `ingest <pdf>` | Add one PDF to the knowledge base. Flags: `--title`, `--category`, `--effective-date`, `--expiry-date`, `--force-ocr` |
| `chat "<question>"` | Run a query end-to-end. Prints retrieved chunks (with scores) and the LLM answer |
| `list [--status ...]` | Show ingested documents from SQLite |
| `supersede <old_id> --by <new_id>` | Mark a document as superseded by another; updates BOTH SQLite (status, superseded_by_id) AND the Qdrant payload status |
| `set-status <doc_id> <active\|deprecated\|superseded>` | Manual status override; also propagates to Qdrant |

### `app/config.py`
All tunable constants in one place. Loads `.env` at import time via
`python-dotenv` (optional). Holds:

- **Paths** — `ROOT`, `DATA_DIR`, `PDFS_DIR`, `DB_PATH`
- **Qdrant** — `QDRANT_HOST`, `QDRANT_PORT`, `COLLECTION`
- **Embeddings** — `EMBED_MODEL_NAME` (`BAAI/bge-m3`), `EMBED_DIM` (1024)
- **Chunking** — `CHUNK_SIZE` (800), `CHUNK_OVERLAP` (100)
- **Retrieval** — `TOP_K` (5), `CANDIDATE_K` (20), `HYBRID_SEARCH`, `RERANK`, `RERANK_MODEL`, `MIN_RERANK_SCORE`, `MIN_RELEVANCE_SCORE` (0.54)
- **LLM** — `GEMINI_MODEL` (`gemini-3.1-flash-lite`, env-overridable), `GEMINI_MAX_OUTPUT_TOKENS` (2048)

To tune retrieval behavior or swap models, edit this file alone.

### `app/db.py`
SQLite connection management. Exports:

- `init_db()` — creates `data/` and runs the `CREATE TABLE IF NOT EXISTS` schema. Idempotent — safe to call on every CLI invocation.
- `connect()` — context manager yielding a `sqlite3.Connection` with `row_factory = sqlite3.Row` and foreign keys enabled. Commits on clean exit, rolls back on exception.

No SQL outside this module and `models.py`.

### `app/models.py`
Domain model for `Document`. Thin layer over `db.connect()`.

| Function | Purpose |
|---|---|
| `create_document(...)` | Insert; returns new `id` |
| `get_document(doc_id)` | Single lookup |
| `list_documents(status=None)` | Optionally filter by status; ordered newest-first |
| `supersede(old_id, new_id)` | Mark old as superseded by new. **Does not** touch Qdrant — callers must also call `vector_store.set_status_for_document(old_id, "superseded")`. The CLI `supersede` command pairs them; FastAPI's admin endpoint will too. |
| `set_status(doc_id, status)` | Manual status change |

`Document` is a `@dataclass`, not an ORM — keeps SQLite out of the rest of the codebase.

### `app/extract.py`
PDF text extraction with auto-routing. Strategy:

1. Run PyMuPDF (`fitz`) on the PDF.
2. Compute the fraction of alphabetic characters in the Cyrillic Unicode range (`Ѐ`–`ӿ`).
3. If avg chars/page < 20 → empty/scanned → fall back to `ocr.extract_with_ocr()`.
4. If Cyrillic ratio < `MIN_CYRILLIC_RATIO` (0.50) → custom-font encoded as Latin glyphs → fall back to OCR.
5. Otherwise return PyMuPDF text.

The CLI flag `--force-ocr` bypasses detection entirely. Verbose mode prints the
routing decision so you can see why a particular PDF took which path.

Why this exists: three of the six source PDFs failed PyMuPDF — two had custom
font encodings (Cyrillic glyphs at Latin code points), one was image-scanned.
The heuristic catches both failure modes from the same code path.

### `app/ocr.py`
Tesseract OCR wrapper. Pipeline: `pdf2image` rasterizes pages at 300 DPI →
`pytesseract.image_to_string(lang="mon")` reads them.

- `check_dependencies()` — verifies tesseract binary, poppler (pdftoppm), the Python wrappers, and that the `mon` language model is installed. Returns `(ok: bool, message: str)`. Called before doing expensive work to fail loudly with installation hints.
- `extract_with_ocr(path)` — does the full pipeline. Prints `OCR: page N/M` progress in-place.

System dependencies: `brew install tesseract tesseract-lang poppler`.
Python dependencies: `pytesseract`, `pdf2image`.

### `app/chunking.py`
Single function: `chunk_text(text, size, overlap)`. Algorithm:

1. Normalize multiple blank lines to one.
2. Greedily pack paragraphs into chunks ≤ `size` chars.
3. If a single paragraph exceeds `size`, split it on sentence-ending punctuation (`.!?。！？`).
4. After packing, prepend the last `overlap` chars of the previous chunk to each successor.

Defaults from `config.py`: 800 chars per chunk, 100 char overlap. Pure
function, no I/O, no model loading — cheap to call.

### `app/embed.py`
bge-m3 embeddings via `sentence-transformers`. Lazy singleton — the model
(~2.3 GB) loads on first call only, so CLI commands that don't embed (e.g.
`list`) start instantly.

- `get_model()` — lazy loader; subsequent calls reuse the same instance.
- `embed_texts(texts)` — returns `(N, 1024)` numpy array, L2-normalized. Use for chunks.
- `embed_query(query)` — returns `list[float]`, ready for Qdrant. Use for questions.

bge-m3 is multilingual including Mongolian Cyrillic, which is why we picked it
over English-tuned models like all-MiniLM.

### `app/vector_store.py`
Qdrant wrapper. One collection (`policies`) with denormalized payloads — the
document's status/category/effective_date is duplicated on every chunk so we
can filter at query time without joining back to SQLite.

| Function | Purpose |
|---|---|
| `get_client()` | Lazy `QdrantClient` singleton |
| `ensure_collection()` | Idempotent — creates collection if missing |
| `upsert_chunks(document_id, ..., chunks, embeddings)` | Insert N points with full payload |
| `search_active(vec, top_k)` | Top-k cosine search, filtered to `status == "active"` |
| `set_status_for_document(doc_id, status)` | Bulk-update payload status for one doc's chunks |
| `delete_document_chunks(doc_id)` | Remove all chunks for one doc (used when re-ingesting) |

### `app/llm.py`
Gemini wrapper. Holds the system prompt and the single
`generate_answer(question, context_chunks)` function.

The prompt is grounded — instructs the model to answer only from the supplied
"Эх сурвалж" context, return `"Мэдээлэл олдсонгүй."` otherwise, and cite source
documents only when actually used. Generation config:

- `temperature=0.0` — minimize creative drift for factual lookups
- `thinking_budget=0` — disable Gemini 2.5's default thinking; RAG doesn't need it
- `max_output_tokens=2048`

Returns `{answer, finish_reason, prompt_tokens, output_tokens}`.

`NO_INFO_ANSWER` is exported so `retrieval.py` can use the same string when
short-circuiting before the LLM call.

### `app/ingestion.py`
Single function: `ingest_pdf(path, title, category, effective_date,
expiry_date, force_ocr, verbose)`. Orchestrates the full ingest pipeline and
returns the new `document_id`.

Order of operations matters: SQLite insert happens **before** Qdrant upsert
because the chunks need `document_id` in their payload.

### `app/retrieval.py`
Single function: `answer_question(question, top_k, min_score)`. Returns:

```python
{
    "answer": str,         # the LLM's answer, or NO_INFO_ANSWER
    "sources": list[str],  # unique doc titles from the top hits
    "hits": list,          # raw Qdrant ScoredPoints — for debug/UI
    "refused": bool,       # True if we short-circuited without calling LLM
    "top_score": float,    # top retrieval score
    "llm_usage": dict | None,  # finish_reason + token counts, or None if refused
}
```

This is the function the chat endpoint will call.

### `scripts/ingest_all.py`
Batch ingest of the six PDFs in `pdfs/`. Per-PDF metadata is hardcoded in the
`DOCS` list at the top — edit titles/categories/dates there before running.

Flags:
- `--reset` — drop the SQLite DB and Qdrant collection first (fresh start)
- `--pdfs-dir` — point at a different source dir (default `pdfs/`)

Uses `sys.path.insert(0, ...)` to find the `app` package when run as a script
from the repo root. Prints a per-doc summary and a failure list at the end.

---

## Data model

### SQLite `documents` table

```sql
CREATE TABLE documents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT    NOT NULL,
    filename         TEXT    NOT NULL,
    category         TEXT,                       -- handbook / regulation / journal / ...
    effective_date   TEXT,                       -- ISO 8601 date or NULL
    expiry_date      TEXT,
    status           TEXT    NOT NULL DEFAULT 'active'
                     CHECK(status IN ('active', 'deprecated', 'superseded')),
    superseded_by_id INTEGER REFERENCES documents(id),
    chunk_count      INTEGER NOT NULL DEFAULT 0,
    uploaded_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_documents_status ON documents(status);
```

### Qdrant point payload (per chunk)

```python
{
    "text":           str,           # the chunk text itself
    "chunk_index":    int,           # 0-based position within the document
    "document_id":    int,           # foreign key to SQLite
    "doc_title":      str,           # denormalized for citation rendering
    "category":       str | None,
    "effective_date": str | None,    # ISO date
    "status":         str,           # active / deprecated / superseded
}
```

The denormalization is deliberate. Retrieval is read-heavy and a JOIN per
search would couple SQLite read-availability to chat latency. The cost is that
status changes have to propagate to Qdrant — handled by
`vector_store.set_status_for_document()`, always called alongside the SQLite
update.

---

## Configuration knobs you might tune

| Constant (in `app/config.py`) | Default | What it controls |
|---|---|---|
| `CHUNK_SIZE` | 800 | Target chunk length in chars. Bigger → fewer chunks, more context per hit, but more diluted relevance |
| `CHUNK_OVERLAP` | 100 | Chars repeated between adjacent chunks. Higher → less boundary loss, more storage |
| `MIN_CHUNK_SIZE` | 200 | A section shorter than this merges into the following chunk instead of becoming a micro-chunk |
| `TOP_K` | 5 | How many chunks reach the LLM. Higher → more input tokens, possibly more noise |
| `CANDIDATE_K` | 20 | How many fused candidates the reranker scores |
| `HYBRID_SEARCH` | on | Dense + sparse RRF fusion. `HYBRID_SEARCH=0` env → dense only |
| `RERANK` | on | Cross-encoder rerank. `RERANK=0` env → skip |
| `RERANK_MODEL` | `BAAI/bge-reranker-v2-m3` | Multilingual cross-encoder, ~2.2 GB, runs locally |
| `RERANK_INCLUDE_TITLE` | on | Prefix doc title to the passage the reranker judges. `RERANK_INCLUDE_TITLE=0` env → section + body only |
| `RESCUE_K` | 5 | Best fused candidates kept in the LLM context even if the reranker demoted them (cross-encoders misjudge terse table rows) |
| `MIN_RERANK_SCORE` | see config | Refusal gate on the best reranker probability (reranker on) |
| `MIN_RELEVANCE_SCORE` | 0.54 | Refusal gate on the best dense cosine score (reranker off) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Env var. Free tier: ~500 req/day vs ~20 for `gemini-2.5-flash`; each model has its own quota |
| `GEMINI_MAX_OUTPUT_TOKENS` | 2048 | Raise if answers are getting truncated (check `finish_reason == MAX_TOKENS`) |

In `app/extract.py`:

| Constant | Default | What it controls |
|---|---|---|
| `MIN_CYRILLIC_RATIO` | 0.50 | Below this fraction of Cyrillic letters in PyMuPDF output, route to OCR |
| `MIN_CHARS_PER_PAGE` | 20 | Below this average, route to OCR (catches image-scanned PDFs) |

In `app/ocr.py`:

| Constant | Default | What it controls |
|---|---|---|
| `OCR_DPI` | 300 | Rasterization resolution. Lower → faster but worse OCR; higher → slower with diminishing returns |
| `OCR_LANG` | `mon` | Tesseract language code(s). Set to `mon+eng` for mixed-language docs |

---

## CLI usage

```bash
# One-time setup
brew install tesseract tesseract-lang poppler   # OCR system deps
pip install -r requirements.txt
echo "GEMINI_API_KEY=..." > .env

# Ingest the source set (all 6 PDFs with metadata from the script)
python -m app list                              # show what's in the KB
python scripts/ingest_all.py --reset            # wipe and re-ingest

# Ingest a new PDF interactively
python -m app ingest pdfs/new.pdf \
    --title "New Policy 2026" \
    --category regulation \
    --effective-date 2026-01-01

# Force OCR (skip PyMuPDF detection)
python -m app ingest pdfs/weird.pdf --force-ocr

# Ask a question
python -m app chat "Шалгалт хэдэн оноотой вэ?"

# Mark a document superseded (also propagates to Qdrant payload)
python -m app supersede 1 --by 4

# Manual status change
python -m app set-status 6 deprecated
```

---

## HTTP API (FastAPI, `app/api/routes/`)

All routes require the `x-internal-key` header; only the Node core-backend
holds it. The engine has no notion of users — the backend enforces roles.

| Route | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /api/chat` | one-shot answer `{answer, sources, citations, refused, top_score}` |
| `POST /api/chat/stream` | same pipeline as server-sent events: `status` → `sources` → `delta`* → `done` (or `error`) |
| `GET /api/admin/documents[?status=]` | list documents (SQLite `documents`) |
| `GET /api/admin/documents/{id}` | one document |
| `GET /api/admin/documents/{id}/pages/{page}[?dpi=]` | one page of the original PDF as PNG (PyMuPDF, LRU-cached) — the chat's source viewer |
| `GET /api/admin/documents/{id}/file` | the original PDF, inline |
| `POST /api/admin/documents` | multipart upload (`file`, `title`, `category`, `effective_date`, `expiry_date`, `force_ocr`, `supersedes_id`) → `202 {job_id}` |
| `POST /api/admin/documents/{id}/supersede?by=` | mark replaced (SQLite + Qdrant payload) |
| `PATCH /api/admin/documents/{id}/status?new_status=` | active / deprecated / superseded; retrieval searches active only |
| `DELETE /api/admin/documents/{id}?delete_file=` | remove chunks + row (+ PDF) |
| `POST /api/admin/reingest` | rebuild the whole KB from `pdfs/`, keeping metadata → `202 {job_id}` |
| `GET /api/admin/jobs`, `GET /api/admin/jobs/{id}` | background job status: `queued/running/done/failed`, progress lines, result |

Ingest jobs (`app/jobs.py`) run on a single worker thread because the
embedding models are process-wide singletons. State is in-memory; a job lost
to a restart is simply re-run. Extraction is cached, so a full reingest of the
six source PDFs takes ~100 s (embedding only).

## What's NOT here yet

- **Migrations** — SQLite columns added after v1 are applied by guarded `ALTER TABLE` in `db.py`; fine for one deployment, not a migration system.
- **Content-hash dedup on upload** — uploading the same PDF twice creates two documents. Use `supersedes_id` to replace.
- **Job persistence** — jobs live in memory; a restart during ingest loses the status (not the data already stored).
