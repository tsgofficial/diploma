"""Qdrant wrapper. One collection, payload denormalizes document metadata so
retrieval can filter without hitting SQLite.
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from .config import COLLECTION, EMBED_DIM, QDRANT_HOST, QDRANT_PORT

_client: Optional[QdrantClient] = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    return _client


def ensure_collection() -> None:
    """Create the collection if it doesn't exist. Idempotent — safe on every run."""
    client = get_client()
    if not client.collection_exists(COLLECTION):
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


def upsert_chunks(
    document_id: int,
    doc_title: str,
    category: Optional[str],
    effective_date: Optional[date],
    chunks: list[str],
    embeddings,
    status: str = "active",
) -> None:
    """Insert chunks for one document. Payload duplicates document metadata
    so retrieval filtering doesn't need a JOIN."""
    ensure_collection()
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=emb.tolist(),
            payload={
                "text": chunk,
                "chunk_index": i,
                "document_id": document_id,
                "doc_title": doc_title,
                "category": category,
                "effective_date": effective_date.isoformat() if effective_date else None,
                "status": status,
            },
        )
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    get_client().upsert(collection_name=COLLECTION, points=points)


def search_active(query_vector: list[float], top_k: int) -> list[Any]:
    """Return top_k points scored against query_vector, filtered to status=active."""
    ensure_collection()
    return get_client().query_points(
        collection_name=COLLECTION,
        query=query_vector,
        limit=top_k,
        query_filter=Filter(
            must=[FieldCondition(key="status", match=MatchValue(value="active"))]
        ),
    ).points


def set_status_for_document(document_id: int, status: str) -> None:
    """Update status on all chunks belonging to one document. Used by supersede."""
    ensure_collection()
    get_client().set_payload(
        collection_name=COLLECTION,
        payload={"status": status},
        points_selector=Filter(
            must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
        ),
    )


def delete_document_chunks(document_id: int) -> None:
    """Remove all chunks for one document. Used on re-ingest."""
    ensure_collection()
    get_client().delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
        ),
    )
