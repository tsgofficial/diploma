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

from app.config import HYBRID_SEARCH, RERANK
from app.llm import rewrite_query
from app.retrieval import answer_question, retrieve
from eval.judge import judge


def _expected_sources(value) -> list[str]:
    """`expected_source` is one title substring, or a list when several
    documents answer the question (e.g. the 2022 handbook and the 2025 order)."""
    if not value:
        return []
    return [value] if isinstance(value, str) else list(value)


def load_testsets(paths: list[str]) -> list[dict]:
    items: list[dict] = []
    for path in paths:
        with open(path, encoding="utf-8") as f:
            items.extend(json.load(f))
    return items


def _retrieve_only(question: str, hybrid: bool, rerank: bool, rewrite: bool = False) -> dict:
    """Retrieval + rerank + refusal decision — no answer generation.

    Calls the same `retrieve()` the app uses before the LLM, so retrieval and
    refusal accuracy are measured on the real pipeline without spending
    generation quota. `hybrid` / `rerank` let one run A/B the stages;
    `rewrite` adds the query-understanding LLM call (one small Gemini call
    per question) so its effect on casual phrasings can be measured.
    """
    alts: list[str] = []
    query = question
    if rewrite:
        rw = rewrite_query(question)
        query, alts = rw["query"], rw["alternatives"]
        if not rw["in_scope"]:  # the app refuses these before searching
            return {"answer": None, "search_query": query, "sources": [], "top_source": None, "refused": True,
                    "in_scope": False, "top_score": 0.0, "dense_top_score": 0.0, "gate": None, "hits": []}
    r = retrieve(query, hybrid=hybrid, rerank=rerank, alt_queries=alts)
    hits = r["hits"]
    return {
        "answer": None,
        "search_query": query,
        "sources": r["sources"],
        "top_source": hits[0].payload["doc_title"] if hits else None,
        "refused": r["refused"],
        "top_score": r["top_score"],
        "dense_top_score": r["dense_top_score"],
        "gate": r["gate"],
        "hits": [
            {
                "doc_title": h.payload["doc_title"],
                "section": h.payload.get("section"),
                "pages": [h.payload.get("page_start"), h.payload.get("page_end")],
                "dense": round(h.dense_score, 4),
                "sparse": round(h.sparse_score, 4),
                "rerank": None if h.rerank_score is None else round(h.rerank_score, 4),
            }
            for h in hits
        ],
    }


def evaluate_item(
    item: dict, use_judge: bool, retrieval_only: bool, hybrid: bool = HYBRID_SEARCH, rerank: bool = RERANK, rewrite: bool = False
) -> dict:
    """Run one item and score every applicable dimension.

    retrieval_only=True skips answer generation + judging (zero Gemini calls),
    scoring only retrieval and the gate-based refusal decision.
    """
    if retrieval_only:
        res = _retrieve_only(item["question"], hybrid=hybrid, rerank=rerank, rewrite=rewrite)
    else:
        res = answer_question(item["question"])
        hits = res["hits"]
        res["top_source"] = hits[0].payload["doc_title"] if hits else None
    answer = res["answer"]
    sources = res["sources"]
    refused = res["refused"]

    should_refuse = bool(item.get("should_refuse"))
    expected_source = item.get("expected_source")
    expected = _expected_sources(expected_source)
    reference = item.get("reference_answer")

    # --- Refusal dimension (applies to every item) ---
    refusal_ok = (refused == should_refuse)

    # --- Retrieval dimension (in-scope items that name an expected source) ---
    retrieval_ok = None   # an expected doc anywhere in the TOP_K sources
    top1_ok = None        # an expected doc is the single best-ranked chunk
    if not should_refuse and expected:
        retrieval_ok = any(e in s for e in expected for s in sources)
        top1_ok = bool(res.get("top_source")) and any(e in res["top_source"] for e in expected)

    # --- Answer-correctness dimension (in-scope, answered, has a reference) ---
    correctness = None  # dict {verdict, reason, score} or None
    if not retrieval_only and not should_refuse and reference and not refused and use_judge:
        correctness = judge(item["question"], reference, answer)

    return {
        "id": item.get("id"),
        "variant": item.get("variant"),
        "category": item.get("category"),
        "origin": item.get("origin"),
        "question": item["question"],
        "answer": answer,
        "sources": sources,
        "refused": refused,
        "should_refuse": should_refuse,
        "expected_source": expected_source,
        "top_score": res.get("top_score"),
        "search_query": res.get("search_query"),
        "in_scope": res.get("in_scope", not res.get("out_of_scope", False)),
        "dense_top_score": res.get("dense_top_score"),
        "gate": res.get("gate"),
        "hits": res.get("hits"),
        "refusal_ok": refusal_ok,
        "retrieval_ok": retrieval_ok,
        "top1_ok": top1_ok,
        "correctness": correctness,
    }


def summarize(all_results: list[dict]) -> dict:
    # Items that raised (e.g. quota exhausted) have no scores; count them, don't score them.
    results = [r for r in all_results if not r.get("error")]
    refusal_ok = [r["refusal_ok"] for r in results]
    retrieval = [r["retrieval_ok"] for r in results if r["retrieval_ok"] is not None]
    top1 = [r["top1_ok"] for r in results if r.get("top1_ok") is not None]
    scores = [r["correctness"]["score"] for r in results if r["correctness"] is not None]

    def pct(xs: list[bool]) -> float:
        return round(100 * sum(xs) / len(xs), 1) if xs else float("nan")

    # Per-document retrieval breakdown.
    by_doc: dict[str, list[bool]] = defaultdict(list)
    for r in results:
        if r["retrieval_ok"] is not None:
            by_doc[" | ".join(_expected_sources(r["expected_source"]))].append(r["retrieval_ok"])

    # Per-phrasing breakdown (en / mn / mn-latin) for items that carry a variant.
    by_variant: dict[str, dict] = {}
    for v in sorted({r["variant"] for r in results if r.get("variant")}):
        rs = [r for r in results if r.get("variant") == v]
        judged = [r["correctness"]["score"] for r in rs if r["correctness"] is not None]
        by_variant[v] = {
            "n": len(rs),
            "refusal_accuracy_pct": pct([r["refusal_ok"] for r in rs]),
            "retrieval_accuracy_pct": pct([r["retrieval_ok"] for r in rs if r["retrieval_ok"] is not None]),
            "retrieval_top1_pct": pct([r["top1_ok"] for r in rs if r.get("top1_ok") is not None]),
            "answer_correctness_pct": round(100 * sum(judged) / len(judged), 1) if judged else float("nan"),
        }

    in_scores = [r["top_score"] for r in results if not r.get("should_refuse") and r.get("top_score") is not None]
    out_scores = [r["top_score"] for r in results if r.get("should_refuse") and r.get("top_score") is not None]

    return {
        "n_items": len(results),
        "n_errors": len(all_results) - len(results),
        "in_scope_min_top_score": round(min(in_scores), 4) if in_scores else None,
        "out_of_scope_max_top_score": round(max(out_scores), 4) if out_scores else None,
        "refusal_accuracy_pct": pct(refusal_ok),
        "retrieval_accuracy_pct": pct(retrieval),
        "retrieval_top1_pct": pct(top1),
        "answer_correctness_pct": round(100 * sum(scores) / len(scores), 1) if scores else float("nan"),
        "n_judged": len(scores),
        "retrieval_by_doc": {k: pct(v) for k, v in by_doc.items()},
        "by_variant": by_variant,
    }


def write_markdown(results: list[dict], summary: dict, path: str, label: str = "") -> None:
    lines = [f"# RAG Accuracy Report{' — ' + label if label else ''}", ""]
    lines += [
        f"- Items evaluated: **{summary['n_items']}**",
        f"- Pipeline: hybrid={summary.get('hybrid')} rerank={summary.get('rerank')}",
        f"- Refusal accuracy: **{summary['refusal_accuracy_pct']}%** (in-scope answered, out-of-scope refused)",
        f"- Retrieval accuracy: **{summary['retrieval_accuracy_pct']}%** (expected document among top-k sources)",
        f"- Retrieval top-1: **{summary['retrieval_top1_pct']}%** (expected document is the best-ranked chunk)",
        f"- Gate margin: in-scope min top_score {summary['in_scope_min_top_score']} vs out-of-scope max {summary['out_of_scope_max_top_score']}",
        f"- Answer correctness (LLM judge): **{summary['answer_correctness_pct']}%** over {summary['n_judged']} judged answers",
        "",
        "## Retrieval by document",
        "",
        "| Document | Recall |",
        "|---|---|",
    ]
    for doc, val in summary["retrieval_by_doc"].items():
        lines.append(f"| {doc} | {val}% |")

    if summary.get("by_variant"):
        lines += ["", "## By phrasing", "", "| Variant | Items | Refusal | Retrieval | Top-1 | Answer |", "|---|---|---|---|---|---|"]
        for v, s in summary["by_variant"].items():
            lines.append(
                f"| {v} | {s['n']} | {s['refusal_accuracy_pct']}% | {s['retrieval_accuracy_pct']}% "
                f"| {s['retrieval_top1_pct']}% | {s['answer_correctness_pct']}% |"
            )

    lines += ["", "## Per-question", "", "| id | refusal | retrieval | top-1 | top_score | answer | question |", "|---|---|---|---|---|---|---|"]
    for r in results:
        def mark(v):
            return "—" if v is None else ("✓" if v else "✗")
        ans = r["correctness"]["verdict"] if r["correctness"] else "—"
        q = r["question"].replace("|", "\\|")[:60]
        ts = f"{r['top_score']:.3f}" if r.get("top_score") is not None else "—"
        lines.append(f"| {r['id']} | {mark(r['refusal_ok'])} | {mark(r['retrieval_ok'])} | {mark(r.get('top1_ok'))} | {ts} | {ans} | {q} |")

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
    ap.add_argument("--no-hybrid", action="store_true", help="dense-only search (A/B: disable sparse fusion)")
    ap.add_argument("--no-rerank", action="store_true", help="skip the cross-encoder rerank (A/B)")
    ap.add_argument("--rewrite", action="store_true", help="run the query-understanding LLM step before retrieval (Gemini calls)")
    ap.add_argument("--label", default="", help="free-text label written into the report header")
    ap.add_argument("--json-out", default="eval/report.json")
    ap.add_argument("--md-out", default="eval/report.md")
    args = ap.parse_args()
    hybrid = HYBRID_SEARCH and not args.no_hybrid
    rerank = RERANK and not args.no_rerank

    items = load_testsets(args.testset)
    mode = "retrieval-only (no Gemini)" if args.retrieval_only else "full"
    print(f"Evaluating {len(items)} items from {', '.join(args.testset)} — mode: {mode}, hybrid={hybrid}, rerank={rerank}\n")

    results = []
    for i, item in enumerate(items, 1):
        try:
            r = evaluate_item(
                item, use_judge=not args.no_judge, retrieval_only=args.retrieval_only,
                hybrid=hybrid, rerank=rerank, rewrite=args.rewrite,
            )
        except Exception as exc:  # keep going; a failed item shouldn't lose the run
            print(f"[{i}/{len(items)}] {item.get('id'):<24} ERROR: {type(exc).__name__}: {str(exc)[:90]}")
            results.append({"id": item.get("id"), "error": str(exc), "question": item.get("question"),
                            "refusal_ok": None, "retrieval_ok": None, "top1_ok": None, "correctness": None,
                            "top_score": None, "should_refuse": item.get("should_refuse"),
                            "category": item.get("category"), "origin": item.get("origin"),
                            "expected_source": item.get("expected_source")})
            continue
        results.append(r)
        v = r["correctness"]["verdict"] if r["correctness"] else "-"
        print(
            f"[{i}/{len(items)}] {r['id']:<32} "
            f"refusal={'ok' if r['refusal_ok'] else 'FAIL'} "
            f"retrieval={'-' if r['retrieval_ok'] is None else ('ok' if r['retrieval_ok'] else 'FAIL')} "
            f"top1={'-' if r['top1_ok'] is None else ('ok' if r['top1_ok'] else 'FAIL')} "
            f"answer={v}  (top_score={r['top_score']:.3f} dense={r['dense_top_score'] or 0:.3f})"
        )

    summary = summarize(results)
    summary["hybrid"] = hybrid
    summary["rerank"] = rerank
    summary["label"] = args.label
    with open(args.json_out, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, ensure_ascii=False, indent=2)
    write_markdown(results, summary, args.md_out, label=args.label)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  items:               {summary['n_items']}" + (f"   ({summary['n_errors']} errored, not scored)" if summary["n_errors"] else ""))
    print(f"  refusal accuracy:    {summary['refusal_accuracy_pct']}%")
    print(f"  retrieval accuracy:  {summary['retrieval_accuracy_pct']}%   (top-1: {summary['retrieval_top1_pct']}%)")
    print(f"  gate margin:         in-scope min {summary['in_scope_min_top_score']}  vs  out-of-scope max {summary['out_of_scope_max_top_score']}")
    print(f"  answer correctness:  {summary['answer_correctness_pct']}%  (n={summary['n_judged']})")
    for v, s in summary["by_variant"].items():
        print(f"  [{v:<8}] n={s['n']:<3} refusal {s['refusal_accuracy_pct']}%  retrieval {s['retrieval_accuracy_pct']}%  "
              f"top-1 {s['retrieval_top1_pct']}%  answer {s['answer_correctness_pct']}%")
    print(f"\n  wrote {args.json_out} and {args.md_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
