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

## Student helper: graduation plan and class times

Course registration itself happens in the university's own system; this app
helps students plan around it.

- **Төгсөлтийн төлөвлөгөө** (`/registration/plan`): a term-by-term plan to
  graduation from the student's wishes — when to graduate (3 / 3.5 / 4 / 4.5 / 5
  years; each option says whether it is reachable and, if not, which prerequisite
  chain prevents it), credits per semester, summer terms, semesters to keep light
  (e.g. the diploma semester) and interests that pick the electives — plus the
  program's curriculum blocks and their courses.
- **Хичээл сонголт 2** (`/registration/schedule`): recommended timetables from
  mornings / afternoons / evenings and free days, each as a wish or a must
  ("only evenings — I work"); when a must cannot be met it names the class and
  when it actually meets, and still shows the closest timetables. Works at any
  time — it is a plan, not a registration. It works on the
  courses and class sections from Хичээл сонголт 1 (demo data until the real
  data is connected).

Class-time plans are checked by a **configurable rule engine**: rules are JSON in
`registration_rules` (time conflicts, every class component chosen…; the planner
reads its credit limits 9.6/9.7 from the same rules). Seats and tuition are not
checked — the app plans; registering happens in the university's system. Each rule cites its clause, and the UI opens
that page of the regulation. The registrar can change a limit or switch a rule off via
`PATCH /api/admin/registration/rules/:code`; edits are validated against the fact catalog
and written to the audit log.

```
core-backend/src/domain/          pure logic, no DB/HTTP, unit-tested
  rule-engine/                    evaluator, operators, validator
  registration/facts.ts           records → facts for the rules
  scheduling/                     time conflicts (odd/even weeks), timetable search
  academics/                      №199 grading + GPA, degree audit, graduation planner
```

```bash
cd core-backend
npm run seed:demo -- --reset   # SE curriculum, spring timetable, 84 students
npm test                       # unit tests (rule engine, scheduling, audit, planner)
```

Demo students (password `student123`): `bat@stud.must.edu.mn` (2nd year; has a full
evening option), `saraa@…` (failed a prerequisite → 4.5 years), `tuvshin@…` (retaking
failed courses), `nomin@…` (final year), `anu@…` (1st year → whole 8-semester plan, or 3.5
years). Open class-time picking under **Admin → Registration**.

## Notes

- `RAG_INTERNAL_KEY` must be identical in `core-backend/.env` and the
  `rag-engine` environment — it's the shared secret guarding the engine.
- `core-backend` uses `sequelize.sync()` for dev convenience; switch to
  migrations before production.
- See `rag-engine/ARCHITECTURE.md` for the engine internals (extraction, OCR,
  chunking, embeddings, Qdrant, and the Gemini prompt).
```
