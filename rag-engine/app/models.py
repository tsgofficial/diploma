"""Document model + CRUD. Keeps SQL out of the rest of the app."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from .db import connect


@dataclass
class Document:
    id: int
    title: str
    filename: str
    category: Optional[str]
    effective_date: Optional[str]
    expiry_date: Optional[str]
    status: str
    superseded_by_id: Optional[int]
    chunk_count: int
    uploaded_at: str


def _row_to_document(row) -> Document:
    return Document(**dict(row))


def create_document(
    title: str,
    filename: str,
    category: Optional[str] = None,
    effective_date: Optional[date] = None,
    expiry_date: Optional[date] = None,
    chunk_count: int = 0,
) -> int:
    """Insert a document row. Returns the new id."""
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO documents
                (title, filename, category, effective_date, expiry_date, chunk_count)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                title,
                filename,
                category,
                effective_date.isoformat() if effective_date else None,
                expiry_date.isoformat() if expiry_date else None,
                chunk_count,
            ),
        )
        return cur.lastrowid


def get_document(doc_id: int) -> Optional[Document]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
    return _row_to_document(row) if row else None


def list_documents(status: Optional[str] = None) -> list[Document]:
    sql = "SELECT * FROM documents"
    params: tuple = ()
    if status:
        sql += " WHERE status = ?"
        params = (status,)
    sql += " ORDER BY uploaded_at DESC"
    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_document(r) for r in rows]


def supersede(old_id: int, new_id: int) -> None:
    """Mark old_id as superseded by new_id. Caller is responsible for updating
    the Qdrant payload status on the affected chunks."""
    with connect() as conn:
        conn.execute(
            "UPDATE documents SET status = 'superseded', superseded_by_id = ? WHERE id = ?",
            (new_id, old_id),
        )


def set_status(doc_id: int, status: str) -> None:
    if status not in {"active", "deprecated", "superseded"}:
        raise ValueError(f"invalid status: {status}")
    with connect() as conn:
        conn.execute(
            "UPDATE documents SET status = ? WHERE id = ?", (status, doc_id)
        )
