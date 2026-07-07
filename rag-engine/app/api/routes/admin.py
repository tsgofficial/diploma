"""Admin (read) endpoints — list the ingested knowledge base.

Ingestion itself stays on the CLI (`python -m app ingest ...`) for now; this
endpoint just exposes what has been ingested so an admin UI can render it.
Guarded by the same internal key as chat.
"""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.api.routes.chat import verify_internal_key
from app.models import list_documents

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/documents")
def documents(status: str | None = None, _: None = Depends(verify_internal_key)) -> dict:
    """Return ingested documents, optionally filtered by status."""
    docs = list_documents(status=status)
    return {"documents": [asdict(d) for d in docs]}
