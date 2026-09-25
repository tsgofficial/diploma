"""Qdrant wrapper. One collection with two named vectors per chunk:

  - "dense":  bge-m3 1024-d, cosine   (semantic similarity)
  - "sparse": bge-m3 lexical weights  (exact-token matching)

Hybrid search runs both as prefetches and fuses them with Reciprocal Rank
Fusion inside Qdrant, so a chunk that ranks well on either signal surfaces.
Payload denormalizes document metadata so retrieval can filter without
hitting SQLite, and carries section + page range for citations.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    Fusion,
    FusionQuery,
    MatchValue,
    PointStruct,
    Prefetch,
    SparseVector,
    SparseVectorParams,
    VectorParams,
)

from .chunking import Chunk
from .config import COLLECTION, EMBED_DIM, QDRANT_HOST, QDRANT_PORT
from .embed import sparse_dot, sparse_to_qdrant

DENSE = "dense"
SPARSE = "sparse"

_client: Optional[QdrantClient] = None


@dataclass
class Hit:
    """One retrieved chunk. `score` is whatever ordered the result list
    (cosine for dense-only, RRF for hybrid, reranker prob after reranking);
    the individual signals are kept so callers can report and gate on them."""

    id: str
    payload: dict[str, Any]
    score: float
    dense_score: float
    sparse_score: float = 0.0
    rerank_score: Optional[float] = None
    extra: dict[str, Any] = field(default_factory=dict)


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    return _client


def _has_hybrid_schema() -> bool:
    info = get_client().get_collection(COLLECTION)
    vectors = info.config.params.vectors
    return isinstance(vectors, dict) and DENSE in vectors and bool(info.config.params.sparse_vectors)


def ensure_collection() -> None:
    """Create the collection if it doesn't exist. Idempotent — safe on every run.

    Refuses to run against a collection created by the old dense-only schema:
    it has to be rebuilt with `python scripts/ingest_all.py --reset`.
    """
    client = get_client()
    if client.collection_exists(COLLECTION):
        if not _has_hybrid_schema():
            raise RuntimeError(
                f"Qdrant collection {COLLECTION!r} uses the old dense-only schema. "
                "Rebuild it: python scripts/ingest_all.py --reset"
            )
        return
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config={DENSE: VectorParams(size=EMBED_DIM, distance=Distance.COSINE)},
        sparse_vectors_config={SPARSE: SparseVectorParams()},
    )


def _active_filter() -> Filter:
    return Filter(must=[FieldCondition(key="status", match=MatchValue(value="active"))])


def upsert_chunks(
    document_id: int,
    doc_title: str,
    category: Optional[str],
    effective_date: Optional[date],
    chunks: list[Chunk],
    dense_embeddings,
    sparse_embeddings: list[dict[int, float]],
    status: str = "active",
) -> None:
    """Insert chunks for one document with both vectors. Payload duplicates
    document metadata so retrieval filtering doesn't need a JOIN."""
    ensure_collection()
    points = []
    for i, (chunk, dense, sparse) in enumerate(zip(chunks, dense_embeddings, sparse_embeddings)):
        idx, vals = sparse_to_qdrant(sparse)
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector={DENSE: dense.tolist(), SPARSE: SparseVector(indices=idx, values=vals)},
                payload={
                    "text": chunk.text,
                    "section": chunk.section,
                    "page_start": chunk.page_start,
                    "page_end": chunk.page_end,
                    "chunk_index": i,
                    "document_id": document_id,
                    "doc_title": doc_title,
                    "category": category,
                    "effective_date": effective_date.isoformat() if effective_date else None,
                    "status": status,
                },
            )
        )
    get_client().upsert(collection_name=COLLECTION, points=points)


def search_active(
    query_vector: list[float],
    top_k: int,
    sparse_vector: Optional[dict[int, float]] = None,
) -> list[Hit]:
    """Top-k chunks with status=active.

    Dense-only when `sparse_vector` is None (ordered by cosine). Hybrid when
    given: dense and sparse prefetches fused by RRF (ordered by fused score).
    Either way every Hit carries its own dense and sparse scores, computed
    locally from the returned vectors.
    """
    ensure_collection()
    client = get_client()
    flt = _active_filter()

    if sparse_vector:
        idx, vals = sparse_to_qdrant(sparse_vector)
        # Pull a wider net from each signal than we return, so fusion has
        # something to fuse; a chunk only in one list still gets a rank.
        prefetch_limit = max(top_k * 2, 10)
        res = client.query_points(
            collection_name=COLLECTION,
            prefetch=[
                Prefetch(query=query_vector, using=DENSE, limit=prefetch_limit, filter=flt),
                Prefetch(query=SparseVector(indices=idx, values=vals), using=SPARSE, limit=prefetch_limit, filter=flt),
            ],
            query=FusionQuery(fusion=Fusion.RRF),
            limit=top_k,
            query_filter=flt,
            with_vectors=[DENSE, SPARSE],
        )
    else:
        res = client.query_points(
            collection_name=COLLECTION,
            query=query_vector,
            using=DENSE,
            limit=top_k,
            query_filter=flt,
            with_vectors=[DENSE, SPARSE],
        )

    hits: list[Hit] = []
    for p in res.points:
        vecs = p.vector or {}
        dense_vec = vecs.get(DENSE)
        dense_score = _dot(query_vector, dense_vec) if dense_vec is not None else float(p.score)
        sparse_pt = vecs.get(SPARSE)
        sparse_score = 0.0
        if sparse_vector and sparse_pt is not None:
            sparse_score = sparse_dot(sparse_vector, dict(zip(sparse_pt.indices, sparse_pt.values)))
        hits.append(
            Hit(
                id=str(p.id),
                payload=p.payload or {},
                score=float(p.score),
                dense_score=float(dense_score),
                sparse_score=float(sparse_score),
            )
        )
    return hits


def _dot(a: list[float], b: list[float]) -> float:
    return float(sum(x * y for x, y in zip(a, b)))


def set_status_for_document(document_id: int, status: str) -> None:
    """Update status on all chunks belonging to one document. Used by supersede."""
    ensure_collection()
    get_client().set_payload(
        collection_name=COLLECTION,
        payload={"status": status},
        points=Filter(
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
