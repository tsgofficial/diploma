"""Run the RAG accuracy evaluation.

Loads one or more test sets, runs every question through the REAL pipeline
(`app.retrieval.answer_question`, i.e. the same Qdrant + Gemini path the app
uses), and scores three independent dimensions:

  1. Retrieval accuracy — for in-scope items with an `expected_source`, is that
     document among the returned sources? (did we find the right document)
  2. Refusal accuracy — do out-of-scope items refuse, and in-scope items NOT
     refuse? (does the groundedness guard behave)
  3. Answer correctness — an LLM judge compares the answer to the reference
     (CORRECT=1.0 / PARTIAL=0.5 / INCORRECT=0.0). Only for in-scope items that
     were actually answered.

Writes `eval/report.json` (full detail) and `eval/report.md` (summary table),
and prints the summary. Run from the rag-engine/ directory:

    python -m eval.run_eval --testset eval/testset.seed.json
    python -m eval.run_eval --testset eval/testset.seed.json eval/testset.generated.json
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict

from app import vector_store
from app.config import MIN_RELEVANCE_SCORE, TOP_K
from app.embed import embed_query
from app.retrieval import answer_question
from eval.judge import judge


def load_testsets(paths: list[str]) -> list[dict]:
    items: list[dict] = []
    for path in paths:
        with open(path, encoding="utf-8") as f:
            items.extend(json.load(f))
    return items


def _retrieve_only(question: str) -> dict:
    """Retrieval + threshold refusal decision — NO Gemini calls.

    Mirrors exactly what `answer_question` does before the LLM: embed, search,
    and gate on MIN_RELEVANCE_SCORE. Lets us measure retrieval and refusal
    accuracy without spending any generation quota.
    """
    vec = embed_query(question)
    hits = vector_store.search_active(vec, top_k=TOP_K)
    top_score = hits[0].score if hits else 0.0
    refused = (not hits) or top_score < MIN_RELEVANCE_SCORE
    sources = sorted({h.payload["doc_title"] for h in hits})
    return {"answer": None, "sources": sources, "refused": refused, "top_score": top_score}


def evaluate_item(item: dict, use_judge: bool, retrieval_only: bool) -> dict:
    """Run one item and score every applicable dimension.

    retrieval_only=True skips answer generation + judging (zero Gemini calls),
    scoring only retrieval and the threshold-based refusal decision.
    """
    res = _retrieve_only(item["question"]) if retrieval_only else answer_question(item["question"])
    answer = res["answer"]
    sources = res["sources"]
    refused = res["refused"]

    should_refuse = bool(item.get("should_refuse"))
    expected_source = item.get("expected_source")
    reference = item.get("reference_answer")

    # --- Refusal dimension (applies to every item) ---
    refusal_ok = (refused == should_refuse)

    # --- Retrieval dimension (in-scope items that name an expected source) ---
    retrieval_ok = None
    if not should_refuse and expected_source:
        retrieval_ok = any(expected_source in s for s in sources)

    # --- Answer-correctness dimension (in-scope, answered, has a reference) ---
    correctness = None  # dict {verdict, reason, score} or None
    if not retrieval_only and not should_refuse and reference and not refused and use_judge:
        correctness = judge(item["question"], reference, answer)

    return {
        "id": item.get("id"),
        "category": item.get("category"),
        "origin": item.get("origin"),
        "question": item["question"],
        "answer": answer,
        "sources": sources,
        "refused": refused,
        "should_refuse": should_refuse,
        "expected_source": expected_source,
        "top_score": res.get("top_score"),
        "refusal_ok": refusal_ok,
        "retrieval_ok": retrieval_ok,
        "correctness": correctness,
    }


def summarize(results: list[dict]) -> dict:
    refusal_ok = [r["refusal_ok"] for r in results]
    retrieval = [r["retrieval_ok"] for r in results if r["retrieval_ok"] is not None]
    scores = [r["correctness"]["score"] for r in results if r["correctness"] is not None]

    def pct(xs: list[bool]) -> float:
        return round(100 * sum(xs) / len(xs), 1) if xs else float("nan")

    # Per-document retrieval breakdown.
    by_doc: dict[str, list[bool]] = defaultdict(list)
    for r in results:
        if r["retrieval_ok"] is not None:
            by_doc[r["expected_source"]].append(r["retrieval_ok"])

    return {
        "n_items": len(results),
        "refusal_accuracy_pct": pct(refusal_ok),
        "retrieval_accuracy_pct": pct(retrieval),
        "answer_correctness_pct": round(100 * sum(scores) / len(scores), 1) if scores else float("nan"),
        "n_judged": len(scores),
        "retrieval_by_doc": {k: pct(v) for k, v in by_doc.items()},
    }


def write_markdown(results: list[dict], summary: dict, path: str) -> None:
    lines = ["# RAG Accuracy Report", ""]
    lines += [
        f"- Items evaluated: **{summary['n_items']}**",
        f"- Refusal accuracy: **{summary['refusal_accuracy_pct']}%** (in-scope answered, out-of-scope refused)",
        f"- Retrieval accuracy: **{summary['retrieval_accuracy_pct']}%** (expected document among sources)",
        f"- Answer correctness (LLM judge): **{summary['answer_correctness_pct']}%** over {summary['n_judged']} judged answers",
        "",
        "## Retrieval by document",
        "",
        "| Document | Recall |",
        "|---|---|",
    ]
    for doc, val in summary["retrieval_by_doc"].items():
        lines.append(f"| {doc} | {val}% |")

    lines += ["", "## Per-question", "", "| id | refusal | retrieval | answer | question |", "|---|---|---|---|---|"]
    for r in results:
        def mark(v):
            return "—" if v is None else ("✓" if v else "✗")
        ans = r["correctness"]["verdict"] if r["correctness"] else "—"
        q = r["question"].replace("|", "\\|")[:60]
        lines.append(f"| {r['id']} | {mark(r['refusal_ok'])} | {mark(r['retrieval_ok'])} | {ans} | {q} |")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--testset", nargs="+", default=["eval/testset.seed.json"])
    ap.add_argument("--no-judge", action="store_true", help="skip the LLM judge (still generates answers)")
    ap.add_argument(
        "--retrieval-only",
        action="store_true",
        help="score retrieval + refusal only, with ZERO Gemini calls",
    )
    ap.add_argument("--json-out", default="eval/report.json")
    ap.add_argument("--md-out", default="eval/report.md")
    args = ap.parse_args()

    items = load_testsets(args.testset)
    mode = "retrieval-only (no Gemini)" if args.retrieval_only else "full"
    print(f"Evaluating {len(items)} items from {', '.join(args.testset)} — mode: {mode}\n")

    results = []
    for i, item in enumerate(items, 1):
        try:
            r = evaluate_item(
                item, use_judge=not args.no_judge, retrieval_only=args.retrieval_only
            )
        except Exception as exc:  # keep going; a failed item shouldn't lose the run
            print(f"[{i}/{len(items)}] {item.get('id'):<24} ERROR: {type(exc).__name__}: {str(exc)[:90]}")
            results.append({"id": item.get("id"), "error": str(exc), "question": item.get("question"),
                            "refusal_ok": None, "retrieval_ok": None, "correctness": None,
                            "category": item.get("category"), "origin": item.get("origin"),
                            "expected_source": item.get("expected_source")})
            continue
        results.append(r)
        v = r["correctness"]["verdict"] if r["correctness"] else "-"
        print(
            f"[{i}/{len(items)}] {r['id']:<24} "
            f"refusal={'ok' if r['refusal_ok'] else 'FAIL'} "
            f"retrieval={'-' if r['retrieval_ok'] is None else ('ok' if r['retrieval_ok'] else 'FAIL')} "
            f"answer={v}  (top_score={r['top_score']:.3f})"
        )

    summary = summarize(results)
    with open(args.json_out, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, ensure_ascii=False, indent=2)
    write_markdown(results, summary, args.md_out)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  items:               {summary['n_items']}")
    print(f"  refusal accuracy:    {summary['refusal_accuracy_pct']}%")
    print(f"  retrieval accuracy:  {summary['retrieval_accuracy_pct']}%")
    print(f"  answer correctness:  {summary['answer_correctness_pct']}%  (n={summary['n_judged']})")
    print(f"\n  wrote {args.json_out} and {args.md_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
