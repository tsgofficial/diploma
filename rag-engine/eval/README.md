# RAG Accuracy Evaluation

A harness for measuring how accurate the assistant's answers are, on three
independent dimensions:

| Dimension | What it measures | Needs Gemini? |
|---|---|---|
| **Retrieval accuracy** | Is the *expected document* among the top-k sources? | No |
| **Retrieval top-1** | Is the expected document the single best-ranked chunk? | No |
| **Refusal accuracy** | Do out-of-scope questions refuse, and in-scope ones answer? | No |
| **Answer correctness** | Does the generated answer match the reference? (LLM judge) | Yes |

Retrieval, top-1 and refusal are scored by calling the app's own
`retrieval.retrieve()` — embed → hybrid search → rerank → gate — with
**zero LLM calls**. Only answer-correctness needs Gemini.

The pipeline stages can be switched off for A/B comparison:

```bash
python -m eval.run_eval --testset eval/testset.*.json --retrieval-only --no-hybrid --no-rerank --label "dense only"   --md-out eval/report.dense.md   --json-out eval/report.dense.json
python -m eval.run_eval --testset eval/testset.*.json --retrieval-only             --no-rerank --label "hybrid"       --md-out eval/report.hybrid.md  --json-out eval/report.hybrid.json
python -m eval.run_eval --testset eval/testset.*.json --retrieval-only                         --label "hybrid+rerank" --md-out eval/report.md         --json-out eval/report.json
```

## Files

- `testset.seed.json` — hand-curated, verified cases (in-scope facts + out-of-scope refusal cases).
  Every seed question comes in three phrasings — `en` (casual English), `mn` (Mongolian
  Cyrillic) and `mn-latin` (Mongolian typed in Latin letters, e.g. "ulirliin dunduur heden
  shalgalt avdag ve?") — so the report can show accuracy per phrasing style.
- `testset.docs.json` — 12 questions per knowledge-base document (72 seeds × `en`/`mn`/`mn-latin` = 216
  items). Every reference answer was checked against the rendered PDF page (the OCR'd orders №199, №27 and
  the journal rules in particular); each item records its PDF `page`.
- `testset.expanded.json` — second curated batch: covers every document, plus near-miss
  refusal cases (university-sounding questions the documents do not answer).
- `testset.generated.json` — auto-generated grounded Q&A (see below). **Review before trusting.**
- `gen_testset.py` — samples real chunks, asks Gemini to write a Q + reference answer grounded in each chunk.
- `judge.py` — LLM-as-judge scoring (CORRECT / PARTIAL / INCORRECT).
- `run_eval.py` — runs a test set through the real pipeline and writes `report.json` + `report.md`.

## Test-set item schema

```json
{
  "id": "seed-grade-A-mn",
  "seed_id": "seed-grade-A",                // groups the phrasings of one question (optional)
  "variant": "mn",                          // "en" | "mn" | "mn-latin" (optional; enables the per-phrasing table)
  "question": "A үнэлгээ авахын тулд хэдэн оноо авах ёстой вэ?",
  "reference_answer": "96-100 оноо ...",   // ground truth for the judge; null for refusal cases
  "expected_source": "гарын авлага 2022",  // substring matched against returned sources; a list when several
                                            // documents answer it (any match counts); null if N/A
  "should_refuse": false,                   // true => the system should decline
  "category": "in-scope",                   // or "refusal"
  "origin": "curated"                       // or "generated"
}
```

## Usage

Run from the `rag-engine/` directory, with Qdrant up and the KB ingested.

```bash
# Retrieval + refusal only — NO Gemini calls (works even with exhausted quota)
python -m eval.run_eval --testset eval/testset.seed.json eval/testset.generated.json --retrieval-only

# Full eval incl. answer correctness (needs Gemini quota)
python -m eval.run_eval --testset eval/testset.seed.json eval/testset.generated.json

# Generate more grounded questions (2 per document)
python -m eval.gen_testset --per-doc 2 --out eval/testset.generated.json
```

### Free-tier Gemini quota

The free tier allows only **~20 generate requests/day** and ~5–10/minute. Full
answer-correctness scoring and test-set generation consume that fast. To stay
under the per-minute cap, throttle every Gemini call:

```bash
GEMINI_MIN_INTERVAL_SEC=13 python -m eval.run_eval --testset eval/testset.seed.json
```

All Gemini calls go through `app.llm.call_gemini`, which retries on 429 and
honors `GEMINI_MIN_INTERVAL_SEC`. For a full run, use a billing-enabled key.

## Latest results (2026-09-24, full 6-document KB, 314 items; retrieval-only)

Test sets: seed (42) + docs (216) + expanded (50) + generated (6) = 288 in-scope, 26 refusal.
`eval/report.md` (production pipeline) and `eval/report.norewrite.md`.

| Pipeline | Refusal | Retrieval@k | Top-1 |
|---|---|---|---|
| hybrid + rerank, no query rewrite | 53.5% | 94.1% | 76.4% |
| **hybrid + rerank + query rewrite (production)** | **96.8%** | **98.3%** | **84.4%** |

By phrasing (the 258 items that come in three variants):

| Variant | Refusal (no rewrite → rewrite) | Retrieval | Top-1 |
|---|---|---|---|
| `en` | 20.9% → 97.7% | 98.8% → 97.6% | 82.9% → 84.1% |
| `mn` | 87.2% → 100% | 98.8% → 98.8% | 95.1% → 85.4% |
| `mn-latin` | 22.1% → 98.8% | 81.7% → 97.6% | 40.2% → 78.0% |

Without the rewrite, English and Latin-script questions usually find the right
document but the reranker gate refuses them (scores near 0). The rewrite fixes
that, but it also frames off-topic questions in university terms ("Messi's goals"
→ "a question unrelated to university rules"), so 7 of the 26 refusal items now
pass the gate (out-of-scope max 0.994); the answer prompt is then the only
refusal. Remaining in-scope misses: 3 false refusals just under the gate
(0.149–0.186) and 5 wrong-document retrievals.

**Fix (2026-09-25):** the rewriter now returns `in_scope`, and questions unrelated to
the university are refused before any search; it also no longer adds topics the
question doesn't contain. On an 82-item validation run (all 26 refusal items, the 8
misses above, 48 in-scope items): refusal items 19/26 → 24/26, in-scope answered
52/55 → 55/55, retrieval 50/55 → 55/55 (3 of those from relabelling
`qms-course-selection-raci`, whose answer is also in №199 clause 9.5). The two
refusal items still passing the gate — dorm fee and rector's phone — are university
topics the documents don't answer, so the answer prompt handles them. A full
314-item rerun is pending.

## Earlier results (2026-09-18, 64 items: 46 in-scope, 18 refusal; retrieval-only)

| Pipeline | Refusal | Retrieval@5 | Top-1 |
|---|---|---|---|
| dense only (cosine gate 0.54) | 93.8% | 97.8% | 93.5% |
| hybrid dense+sparse, no rerank | 93.8% | 100% | 93.5% |
| **hybrid + rerank (gate 0.20)** | **96.9%** | **100%** | 93.5% |

What the reranker buys: the three near-miss leaks (dorm fee, rector's phone,
another university's exam) score 0.58–0.69 cosine but ≤ 0.18 reranker, so
they are refused. What it costs: two table-lookup questions (A grade points,
F grade GPA) score 0.09–0.15 and are falsely refused — the cross-encoder does
not read the terse grading table well. Run `--no-rerank` to see the trade-off.

## Interpreting results

- **Retrieval accuracy** is the most reliable signal (deterministic, no LLM).
  A miss can mean either a genuine retrieval failure *or* a wrong
  `expected_source` label — check the `sources` in `report.json`.
- **Refusal accuracy** is gated by `MIN_RERANK_SCORE` (reranker on) or
  `MIN_RELEVANCE_SCORE` (reranker off) in `app/config.py`. The report prints the
  gate margin — in-scope minimum vs out-of-scope maximum `top_score`. If they
  overlap, some items must fail; if they don't, put the gate between them.
- **Top-1** is where hybrid search and reranking show up: the expected document
  may already be *somewhere* in the top-5 with dense-only search, but the
  reranker is what puts the right chunk first, which is what the LLM reads most.
- **Answer correctness** uses an LLM judge; PARTIAL is common when the answer is
  right but less complete than the reference (or vice-versa).
