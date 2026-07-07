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
│   ├── extract.py        PDF text extraction with auto OCR fallback
│   ├── ocr.py            Tesseract OCR wrapper
│   ├── chunking.py       paragraph/sentence chunker
│   ├── embed.py          bge-m3 embeddings (lazy singleton)
│   ├── vector_store.py   Qdrant wrapper
│   ├── llm.py            Gemini wrapper + system prompt
│   ├── ingestion.py      orchestrator: PDF → SQLite + Qdrant
│   └── retrieval.py      orchestrator: question → answer
├── scripts/
│   └── ingest_all.py     batch ingest the six source PDFs
├── data/
│   └── policies.db       SQLite (created at runtime, gitignored)
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
   │  app.extract.extract_text(path)
   │     ├── try PyMuPDF
   │     ├── score Cyrillic ratio
   │     └── if garbled or empty → app.ocr.extract_with_ocr()
   ▼
plain text (Mongolian Cyrillic)
   │
   │  app.chunking.chunk_text(text)
   ▼
list[str]  ← chunks (~800 chars, 100 overlap, paragraph-aware)
   │
   │  app.embed.embed_texts(chunks)
   ▼
ndarray (N, 1024)  ← bge-m3 vectors, L2-normalized
   │
   │  app.models.create_document(...)
   ▼
SQLite row in `documents` table  → document_id
   │
   │  app.vector_store.upsert_chunks(document_id, ..., chunks, embeddings)
   ▼
N points in Qdrant collection `policies`, each with payload:
{ text, chunk_index, document_id, doc_title, category, effective_date, status }
```

## Data flow — query

```
question (str)
   │
   │  app.embed.embed_query(q)
   ▼
list[float] (1024)
   │
   │  app.vector_store.search_active(vec, top_k=5)
   │     └── filter: payload.status == "active"
   ▼
list[ScoredPoint]
   │
   ├─ if top_score < MIN_RELEVANCE_SCORE → return refusal (no LLM call)
   │
   │  app.llm.generate_answer(question, context_chunks)
   │     ├── system prompt: "answer only from context, refuse otherwise"
   │     ├── temperature=0, thinking disabled
   │     └── Gemini 2.5-flash
   ▼
{ answer, sources, hits, refused, top_score, llm_usage }
```

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
- **Retrieval** — `TOP_K` (5), `MIN_RELEVANCE_SCORE` (0.45)
- **LLM** — `GEMINI_MODEL` (`gemini-2.5-flash`), `GEMINI_MAX_OUTPUT_TOKENS` (2048)

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
| `TOP_K` | 5 | How many chunks to retrieve per question. Higher → more LLM input tokens, possibly more noise |
| `MIN_RELEVANCE_SCORE` | 0.45 | Below this top cosine score, short-circuit to refusal without calling the LLM |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Swap to `gemini-2.5-pro` if quality matters more than cost |
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

## What's NOT here yet

For reference — the next layers, in build order:

1. **FastAPI app** (`app/api/`) — `POST /chat`, `POST /admin/upload`, `GET /admin/documents`, `POST /admin/documents/{id}/supersede`. Will import `ingestion.ingest_pdf` and `retrieval.answer_question` directly.
2. **Admin auth** — `ADMIN_PASSWORD` env var + HTTP Basic or signed session cookie.
3. **Templates** — Jinja2 + HTMX for admin upload form and student chat UI. Or React + JSON API if richer interactivity is needed.
4. **Supersedes UI** — admin marks new uploads as superseding existing docs; retrieval already filters by `status="active"` so this Just Works once the metadata is right.
5. **Re-ingest workflow** — currently re-ingesting a PDF creates a duplicate. Need either content-hash deduplication or an explicit "replace document N" flow that calls `vector_store.delete_document_chunks(N)` first.
