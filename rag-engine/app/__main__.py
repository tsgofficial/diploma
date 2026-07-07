"""CLI: python -m app {ingest|chat|list|supersede}

Examples:
    python -m app ingest pdfs/garin-awlaga-2022-5.pdf --title "Student Handbook 2022" \\
        --category handbook --effective-date 2022-09-01
    python -m app chat "Шалгалт хэдэн оноотой вэ?"
    python -m app list
    python -m app supersede 1 --by 2
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

from . import vector_store
from .db import init_db
from .ingestion import ingest_pdf
from .models import list_documents, set_status, supersede as supersede_doc
from .retrieval import answer_question


def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def cmd_ingest(args: argparse.Namespace) -> int:
    init_db()
    pdf = Path(args.pdf)
    if not pdf.exists():
        print(f"PDF not found: {pdf}", file=sys.stderr)
        return 1
    doc_id = ingest_pdf(
        pdf_path=pdf,
        title=args.title or pdf.stem,
        category=args.category,
        effective_date=_parse_date(args.effective_date) if args.effective_date else None,
        expiry_date=_parse_date(args.expiry_date) if args.expiry_date else None,
        force_ocr=args.force_ocr,
    )
    print(f"\ningested as document_id={doc_id}")
    return 0


def cmd_chat(args: argparse.Namespace) -> int:
    init_db()
    result = answer_question(args.question, top_k=args.top_k)

    print(f"\nQuestion: {args.question}")
    print(f"Top score: {result['top_score']:.3f}  refused={result['refused']}")
    print(f"\nRetrieved chunks:")
    for i, h in enumerate(result["hits"], 1):
        snippet = h.payload["text"].replace("\n", " ")[:120]
        print(f"  [{i}] {h.score:.3f}  {h.payload['doc_title']}: {snippet}...")

    print(f"\n--- Answer ---\n{result['answer']}")

    if result["llm_usage"]:
        u = result["llm_usage"]
        print(
            f"\n--- finish={u['finish_reason']} "
            f"prompt={u['prompt_tokens']} output={u['output_tokens']} ---"
        )
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    init_db()
    docs = list_documents(status=args.status)
    if not docs:
        print("(no documents)")
        return 0
    print(f"{'id':>3}  {'status':12}  {'category':12}  {'chunks':>6}  title")
    print("-" * 80)
    for d in docs:
        print(
            f"{d.id:>3}  {d.status:12}  {(d.category or '-'):12}  "
            f"{d.chunk_count:>6}  {d.title}"
        )
    return 0


def cmd_supersede(args: argparse.Namespace) -> int:
    init_db()
    supersede_doc(old_id=args.old_id, new_id=args.by)
    vector_store.set_status_for_document(args.old_id, "superseded")
    print(f"document_id={args.old_id} marked superseded by document_id={args.by}")
    return 0


def cmd_set_status(args: argparse.Namespace) -> int:
    init_db()
    set_status(args.doc_id, args.status)
    vector_store.set_status_for_document(args.doc_id, args.status)
    print(f"document_id={args.doc_id} status -> {args.status}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="app", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("ingest", help="ingest one PDF")
    pi.add_argument("pdf", help="path to PDF")
    pi.add_argument("--title", help="display title (default: filename stem)")
    pi.add_argument("--category", help="e.g. handbook, regulation, journal")
    pi.add_argument("--effective-date", help="YYYY-MM-DD")
    pi.add_argument("--expiry-date", help="YYYY-MM-DD")
    pi.add_argument("--force-ocr", action="store_true",
                    help="skip PyMuPDF text layer; OCR every page")
    pi.set_defaults(func=cmd_ingest)

    pc = sub.add_parser("chat", help="ask a question")
    pc.add_argument("question")
    pc.add_argument("--top-k", type=int, default=5)
    pc.set_defaults(func=cmd_chat)

    pl = sub.add_parser("list", help="list ingested documents")
    pl.add_argument("--status", choices=["active", "deprecated", "superseded"])
    pl.set_defaults(func=cmd_list)

    ps = sub.add_parser("supersede", help="mark one document as superseded by another")
    ps.add_argument("old_id", type=int)
    ps.add_argument("--by", type=int, required=True, help="new document_id")
    ps.set_defaults(func=cmd_supersede)

    pt = sub.add_parser("set-status", help="manually set a document's status")
    pt.add_argument("doc_id", type=int)
    pt.add_argument("status", choices=["active", "deprecated", "superseded"])
    pt.set_defaults(func=cmd_set_status)

    return p


def main() -> int:
    args = build_parser().parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
