# RAG Accuracy Evaluation

A harness for measuring how accurate the assistant's answers are, on three
independent dimensions:

| Dimension | What it measures | Needs Gemini? |
|---|---|---|
| **Retrieval accuracy** | Is the *expected document* among the retrieved sources? | No |
| **Refusal accuracy** | Do out-of-scope questions refuse, and in-scope ones answer? | No |
| **Answer correctness** | Does the generated answer match the reference? (LLM judge) | Yes |

Retrieval + refusal are scored purely from the embedding + Qdrant search + the
`MIN_RELEVANCE_SCORE` threshold — **zero LLM calls**. Only answer-correctness
needs Gemini.

## Files

- `testset.seed.json` — hand-curated, verified cases (in-scope facts + out-of-scope refusal cases).
- `testset.generated.json` — auto-generated grounded Q&A (see below). **Review before trusting.**
- `gen_testset.py` — samples real chunks, asks Gemini to write a Q + reference answer grounded in each chunk.
- `judge.py` — LLM-as-judge scoring (CORRECT / PARTIAL / INCORRECT).
- `run_eval.py` — runs a test set through the real pipeline and writes `report.json` + `report.md`.

## Test-set item schema

```json
{
  "id": "seed-grade-A",
  "question": "A үнэлгээ авахын тулд хэдэн оноо авах ёстой вэ?",
  "reference_answer": "96-100 оноо ...",   // ground truth for the judge; null for refusal cases
  "expected_source": "гарын авлага 2022",  // substring matched against returned sources; null if N/A
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

## Interpreting results

- **Retrieval accuracy** is the most reliable signal (deterministic, no LLM).
  A miss can mean either a genuine retrieval failure *or* a wrong
  `expected_source` label — check the `sources` in `report.json`.
- **Refusal accuracy** is gated by `MIN_RELEVANCE_SCORE` in `app/config.py`.
  If out-of-scope questions leak through, inspect the `top_score` values in the
  report and raise the threshold to sit between the out-of-scope max and the
  in-scope min.
- **Answer correctness** uses an LLM judge; PARTIAL is common when the answer is
  right but less complete than the reference (or vice-versa).
