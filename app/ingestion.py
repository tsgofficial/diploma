"""End-to-end ingestion: PDF on disk -> SQLite row + Qdrant chunks."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Optional

from . import vector_store
from .chunking import chunk_text
from .embed import embed_texts
from .extract import extract_text
from .models import create_document


def ingest_pdf(
    pdf_path: Path,
    title: str,
    category: Optional[str] = None,
    effective_date: Optional[date] = None,
    expiry_date: Optional[date] = None,
    force_ocr: bool = False,
    verbose: bool = True,
) -> int:
    """Ingest one PDF. Returns the new document_id.

    Steps: extract text -> chunk -> embed -> insert Document row -> upsert
    chunks into Qdrant with denormalized metadata in payload.
    """
    if verbose:
        print(f"  extracting {pdf_path.name}...")
    text = extract_text(pdf_path, force_ocr=force_ocr, verbose=verbose)

    if verbose:
        print(f"  {len(text)} chars -> chunking...")
    chunks = chunk_text(text)

    if verbose:
        print(f"  {len(chunks)} chunks -> embedding...")
    embeddings = embed_texts(chunks, show_progress=verbose)

    doc_id = create_document(
        title=title,
        filename=pdf_path.name,
        category=category,
        effective_date=effective_date,
        expiry_date=expiry_date,
        chunk_count=len(chunks),
    )

    if verbose:
        print(f"  document_id={doc_id} -> upserting to Qdrant...")
    vector_store.upsert_chunks(
        document_id=doc_id,
        doc_title=title,
        category=category,
        effective_date=effective_date,
        chunks=chunks,
        embeddings=embeddings,
        status="active",
    )

    if verbose:
        print(f"  done. {len(chunks)} chunks stored under document_id={doc_id}.")
    return doc_id
