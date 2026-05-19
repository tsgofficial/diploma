"""SQLite connection and schema bootstrap."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DATA_DIR, DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT    NOT NULL,
    filename         TEXT    NOT NULL,
    category         TEXT,
    effective_date   TEXT,                       -- ISO 8601 date or NULL
    expiry_date      TEXT,
    status           TEXT    NOT NULL DEFAULT 'active'
                     CHECK(status IN ('active', 'deprecated', 'superseded')),
    superseded_by_id INTEGER REFERENCES documents(id),
    chunk_count      INTEGER NOT NULL DEFAULT 0,
    uploaded_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
"""


def init_db() -> None:
    """Create data dir + tables. Idempotent."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Yield a sqlite3 connection that commits on exit, rolls back on error."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
