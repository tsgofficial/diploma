"""bge-m3 embeddings, lazy-loaded singleton.

Loading the model takes ~5–10s on first call. Subsequent calls in the same
process reuse it. CLI commands that don't embed (e.g. `list`) pay nothing.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from .config import EMBED_MODEL_NAME

if TYPE_CHECKING:
    import numpy as np
    from sentence_transformers import SentenceTransformer

_model: "SentenceTransformer | None" = None


def get_model() -> "SentenceTransformer":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBED_MODEL_NAME)
    return _model


def embed_texts(texts: list[str], show_progress: bool = False) -> "np.ndarray":
    """Returns (N, EMBED_DIM) float array; rows are L2-normalized."""
    return get_model().encode(
        texts, normalize_embeddings=True, show_progress_bar=show_progress
    )


def embed_query(query: str) -> list[float]:
    """Embed one query string. Returns a plain list so it goes straight into Qdrant."""
    vec = get_model().encode(query, normalize_embeddings=True)
    return vec.tolist()
