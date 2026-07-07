"""Batch ingest all six PDFs with placeholder metadata.

Metadata here is a best guess from filenames — edit before re-running, or fix
in SQLite afterward. The point of running this is to:

  1. Confirm every PDF extracts cleanly (catches OCR-only docs early).
  2. Stress-test chunking on the larger files (21MB ones).
  3. Populate Qdrant with content from multiple documents so we can verify
     retrieval picks the *right* document, not just the right chunk.

Usage:
    python scripts/ingest_all.py
    python scripts/ingest_all.py --reset    # wipe DB + Qdrant first
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

# Allow running as a script from repo root: `python scripts/ingest_all.py`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import vector_store  # noqa: E402
from app.config import COLLECTION, DB_PATH  # noqa: E402
from app.db import init_db  # noqa: E402
from app.ingestion import ingest_pdf  # noqa: E402


# One row per PDF in pdfs/. Edit titles/dates to taste.
DOCS = [
    {
        "filename": "garin-awlaga-2022-5.pdf",
        "title": "Шинэ оюутанд зориулсан гарын авлага 2022",
        "category": "handbook",
        "effective_date": date(2022, 9, 1),
    },
    {
        "filename": "-01-_2022-web_QvsstvT.pdf",
        "title": "ШУТИС дүрэм 2022 (web)",
        "category": "regulation",
        "effective_date": date(2022, 1, 1),
    },
    {
        "filename": "2030-gariin-avlaga.pdf",
        "title": "2030 хөтөлбөрийн гарын авлага",
        "category": "handbook",
        "effective_date": None,
    },
    {
        "filename": "27-2025-2026.pdf",
        "title": "Тушаал №27 (2025-2026 хичээлийн жил)",
        "category": "regulation",
        "effective_date": date(2025, 9, 1),
    },
    {
        "filename": "920250606-199_-must-1.pdf",
        "title": "ШУТИС тушаал №199 (2025-06-06)",
        "category": "regulation",
        "effective_date": date(2025, 6, 6),
    },
    {
        "filename": "must-journal-.pdf",
        "title": "ШУТИС сэтгүүл",
        "category": "journal",
        "effective_date": None,
    },
]


def reset() -> None:
    """Wipe SQLite DB and Qdrant collection for a fresh ingest."""
    if DB_PATH.exists():
        DB_PATH.unlink()
        print(f"removed {DB_PATH}")
    client = vector_store.get_client()
    if client.collection_exists(COLLECTION):
        client.delete_collection(COLLECTION)
        print(f"dropped Qdrant collection {COLLECTION!r}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="wipe DB + Qdrant first")
    ap.add_argument("--pdfs-dir", default="pdfs")
    args = ap.parse_args()

    if args.reset:
        reset()

    init_db()

    pdfs_dir = Path(args.pdfs_dir)
    failures: list[tuple[str, str]] = []

    for i, doc in enumerate(DOCS, 1):
        path = pdfs_dir / doc["filename"]
        print(f"\n[{i}/{len(DOCS)}] {doc['filename']}")
        if not path.exists():
            print(f"  SKIP: file not found at {path}")
            failures.append((doc["filename"], "file not found"))
            continue
        try:
            ingest_pdf(
                pdf_path=path,
                title=doc["title"],
                category=doc["category"],
                effective_date=doc["effective_date"],
            )
        except Exception as exc:
            print(f"  FAILED: {exc}")
            failures.append((doc["filename"], str(exc)))

    print("\n" + "=" * 60)
    print(f"done. {len(DOCS) - len(failures)} succeeded, {len(failures)} failed.")
    for fname, reason in failures:
        print(f"  - {fname}: {reason}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
