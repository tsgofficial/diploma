"""End-to-end ingestion: PDF on disk -> SQLite row + Qdrant chunks."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Optional

from . import vector_store
from .chunking import Chunk, chunk_pages
from .config import COLLECTION, PDFS_DIR
from .embed import embed_texts, sparse_embed_texts
from .extract import extract_pages
from .models import Document, create_document, delete_document, get_document, list_documents


def embedding_text(doc_title: str, chunk: Chunk) -> str:
    """What gets embedded: the chunk body prefixed with its document title
    and section heading, so the vector carries the context a bare fragment
    ("...70 хүртэл оноо...") would otherwise lose. The LLM still sees only
    the body plus a structured source header."""
    if chunk.section:
        return f"{doc_title}\n{chunk.section}\n\n{chunk.text}"
    return f"{doc_title}\n\n{chunk.text}"


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

    Steps: extract pages -> section/page-aware chunks -> dense + sparse
    embeddings -> insert Document row -> upsert chunks into Qdrant with
    denormalized metadata (incl. section + page range) in payload.
    """
    if verbose:
        print(f"  extracting {pdf_path.name}...")
    pages = extract_pages(pdf_path, force_ocr=force_ocr, verbose=verbose)

    if verbose:
        print(f"  {sum(len(p) for p in pages)} chars over {len(pages)} pages -> chunking...")
    chunks = chunk_pages(pages)
    texts = [embedding_text(title, c) for c in chunks]

    if verbose:
        sections = len({c.section for c in chunks if c.section})
        print(f"  {len(chunks)} chunks / {sections} sections -> embedding (dense + sparse)...")
    dense = embed_texts(texts, show_progress=verbose)
    sparse = sparse_embed_texts(texts, show_progress=verbose)

    doc_id = create_document(
        title=title,
        filename=pdf_path.name,
        category=category,
        effective_date=effective_date,
        expiry_date=expiry_date,
        chunk_count=len(chunks),
        page_count=len(pages),
    )

    if verbose:
        print(f"  document_id={doc_id} -> upserting to Qdrant...")
    vector_store.upsert_chunks(
        document_id=doc_id,
        doc_title=title,
        category=category,
        effective_date=effective_date,
        chunks=chunks,
        dense_embeddings=dense,
        sparse_embeddings=sparse,
        status="active",
    )

    if verbose:
        print(f"  done. {len(chunks)} chunks stored under document_id={doc_id}.")
    return doc_id


def remove_document(doc_id: int, delete_file: bool = False) -> Document:
    """Delete a document's chunks from Qdrant and its row from SQLite.
    Optionally removes the PDF from disk. Returns the deleted record."""
    doc = get_document(doc_id)
    if doc is None:
        raise KeyError(f"document {doc_id} not found")
    vector_store.delete_document_chunks(doc_id)
    delete_document(doc_id)
    if delete_file:
        path = PDFS_DIR / doc.filename
        if path.exists():
            path.unlink()
    return doc


def reingest_all(verbose: bool = True, progress=None) -> dict:
    """Rebuild the whole knowledge base from the PDFs on disk, keeping each
    document's metadata (title, category, dates, status). Used after a
    chunking/embedding change. Extraction is cached, so this is mostly
    embedding time. `progress(msg)` is called per step when given."""
    from datetime import date as _date

    from .models import set_status, supersede

    docs = list_documents()
    client = vector_store.get_client()
    if client.collection_exists(COLLECTION):
        client.delete_collection(COLLECTION)
    vector_store.ensure_collection()

    id_map: dict[int, int] = {}
    failures: list[tuple[str, str]] = []
    for i, old in enumerate(docs, 1):
        path = PDFS_DIR / old.filename
        if progress:
            progress(f"[{i}/{len(docs)}] {old.title}")
        if not path.exists():
            failures.append((old.filename, "file not found"))
            continue
        try:
            new_id = ingest_pdf(
                pdf_path=path,
                title=old.title,
                category=old.category,
                effective_date=_date.fromisoformat(old.effective_date) if old.effective_date else None,
                expiry_date=_date.fromisoformat(old.expiry_date) if old.expiry_date else None,
                verbose=verbose,
            )
            id_map[old.id] = new_id
            delete_document(old.id)
        except Exception as exc:  # keep going; report at the end
            failures.append((old.filename, str(exc)))

    # Restore statuses / supersede links onto the new ids.
    for old in docs:
        new_id = id_map.get(old.id)
        if new_id is None:
            continue
        if old.status == "superseded" and old.superseded_by_id in id_map:
            supersede(new_id, id_map[old.superseded_by_id])
            vector_store.set_status_for_document(new_id, "superseded")
        elif old.status != "active":
            set_status(new_id, old.status)
            vector_store.set_status_for_document(new_id, old.status)

    return {"reingested": len(id_map), "failures": failures}
