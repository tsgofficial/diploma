"""Admin endpoints — manage the knowledge base.

Guarded by the same internal key as chat; the Node core-backend enforces
*who* may call these (its admin role) and simply proxies here. Ingestion runs
as a background job (see app.jobs) because OCR + embedding takes minutes.
"""
from __future__ import annotations

import re
from dataclasses import asdict
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse

from app import jobs, vector_store
from app.api.routes.chat import verify_internal_key
from app.config import PDFS_DIR
from app.ingestion import ingest_pdf, reingest_all, remove_document
from app.models import get_document, list_documents, set_status, supersede

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(verify_internal_key)])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
VALID_STATUSES = {"active", "deprecated", "superseded"}


@router.get("/documents")
def documents(status: str | None = None) -> dict:
    """Return ingested documents, optionally filtered by status."""
    return {"documents": [asdict(d) for d in list_documents(status=status)]}


@router.get("/documents/{doc_id}")
def document(doc_id: int) -> dict:
    doc = get_document(doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    return asdict(doc)


def _pdf_path(doc_id: int) -> Path:
    """The stored PDF of a document — only ever a file directly inside PDFS_DIR."""
    doc = get_document(doc_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    path = (PDFS_DIR / doc.filename).resolve()
    if path.parent != PDFS_DIR.resolve() or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "PDF file not found")
    return path


@lru_cache(maxsize=64)
def _render_page(path: str, mtime: float, page: int, dpi: int) -> bytes:
    """PNG of one page (1-based). `mtime` is only part of the cache key, so a
    replaced file is re-rendered. Raises IndexError past the last page."""
    with fitz.open(path) as pdf:
        if page > pdf.page_count:
            raise IndexError(page)
        return pdf[page - 1].get_pixmap(dpi=dpi).tobytes("png")


@router.get("/documents/{doc_id}/file")
def document_file(doc_id: int) -> FileResponse:
    """The original PDF, for opening the whole document from a citation."""
    return FileResponse(_pdf_path(doc_id), media_type="application/pdf", headers={"Content-Disposition": "inline"})


@router.get("/documents/{doc_id}/pages/{page}")
def document_page(doc_id: int, page: int, dpi: int = 144) -> Response:
    """One page of the original PDF as an image, so a citation can show the
    page exactly as printed (tables, stamps, layout) rather than extracted text."""
    if page < 1:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "page not found")
    path = _pdf_path(doc_id)
    try:
        png = _render_page(str(path), path.stat().st_mtime, page, max(72, min(dpi, 200)))
    except IndexError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "page not found")
    return Response(png, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


def _safe_filename(name: str) -> str:
    stem = Path(name).stem
    stem = re.sub(r"[^\w\-]+", "-", stem, flags=re.UNICODE).strip("-") or "document"
    return f"{stem[:80]}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.pdf"


def _parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{field} must be YYYY-MM-DD")


@router.post("/documents", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=1),
    category: str | None = Form(None),
    effective_date: str | None = Form(None),
    expiry_date: str | None = Form(None),
    force_ocr: bool = Form(False),
    supersedes_id: int | None = Form(None),
) -> dict:
    """Store the PDF and queue its ingestion. Returns a job id to poll.
    `supersedes_id` marks an existing document as replaced once ingest succeeds."""
    if not (file.filename or "").lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "only PDF files are accepted")
    if supersedes_id is not None and get_document(supersedes_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"supersedes_id {supersedes_id} not found")
    eff = _parse_date(effective_date, "effective_date")
    exp = _parse_date(expiry_date, "expiry_date")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "PDF larger than 50 MB")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "file is not a PDF")

    PDFS_DIR.mkdir(parents=True, exist_ok=True)
    path = PDFS_DIR / _safe_filename(file.filename or "document.pdf")
    path.write_bytes(data)

    def work(progress):
        progress(f"extracting {path.name}")
        doc_id = ingest_pdf(
            pdf_path=path, title=title.strip(), category=category or None,
            effective_date=eff, expiry_date=exp, force_ocr=force_ocr, verbose=False,
        )
        if supersedes_id is not None:
            supersede(supersedes_id, doc_id)
            vector_store.set_status_for_document(supersedes_id, "superseded")
            progress(f"document {supersedes_id} marked superseded by {doc_id}")
        doc = get_document(doc_id)
        return {"document": asdict(doc) if doc else {"id": doc_id}}

    job = jobs.submit("ingest", work)
    return {"job_id": job.id, "filename": path.name}


@router.post("/documents/{doc_id}/supersede")
def supersede_document(doc_id: int, by: int) -> dict:
    """Mark `doc_id` as replaced by document `by` (both SQLite + Qdrant)."""
    if doc_id == by:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "a document cannot supersede itself")
    if get_document(doc_id) is None or get_document(by) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    supersede(doc_id, by)
    vector_store.set_status_for_document(doc_id, "superseded")
    return asdict(get_document(doc_id))


@router.patch("/documents/{doc_id}/status")
def set_document_status(doc_id: int, new_status: str) -> dict:
    """Manual status change: active | deprecated | superseded. Retrieval only
    searches active chunks, so deprecating hides a document without deleting it."""
    if new_status not in VALID_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"status must be one of {sorted(VALID_STATUSES)}")
    if get_document(doc_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    set_status(doc_id, new_status)
    vector_store.set_status_for_document(doc_id, new_status)
    return asdict(get_document(doc_id))


@router.delete("/documents/{doc_id}")
def delete_document_route(doc_id: int, delete_file: bool = False) -> dict:
    """Remove chunks + metadata (and optionally the PDF from disk)."""
    try:
        doc = remove_document(doc_id, delete_file=delete_file)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")
    return {"deleted": asdict(doc)}


@router.post("/reingest", status_code=status.HTTP_202_ACCEPTED)
def reingest() -> dict:
    """Rebuild the whole knowledge base from the stored PDFs, keeping metadata.
    Use after a chunking/embedding change. Returns a job id to poll."""
    job = jobs.submit("reingest", lambda progress: reingest_all(verbose=False, progress=progress))
    return {"job_id": job.id}


@router.get("/jobs")
def jobs_list() -> dict:
    return {"jobs": [j.to_dict() for j in jobs.list_jobs()]}


@router.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
    return job.to_dict()
