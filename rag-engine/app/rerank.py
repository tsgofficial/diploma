"""Cross-encoder reranking (bge-reranker-v2-m3), lazy-loaded singleton.

A bi-encoder (bge-m3) scores query and chunk independently, so cosine
similarity is only a rough proxy for relevance. A cross-encoder reads the
query and the chunk *together* and is far more precise — at the cost of one
forward pass per candidate. We only run it over CANDIDATE_K fused candidates,
so the cost is a few hundred milliseconds per question.

Scores are sigmoid probabilities in [0, 1]; irrelevant pairs sit near 0,
which also makes the score a much better refusal gate than cosine.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from .config import RERANK_MODEL

if TYPE_CHECKING:
    from sentence_transformers import CrossEncoder

_model: "CrossEncoder | None" = None

RERANK_MAX_TOKENS = 1024


def get_reranker() -> "CrossEncoder":
    global _model
    if _model is None:
        import torch
        from sentence_transformers import CrossEncoder

        _model = CrossEncoder(
            RERANK_MODEL,
            max_length=RERANK_MAX_TOKENS,
            activation_fn=torch.nn.Sigmoid(),
        )
    return _model


def rerank(query: str, passages: list[str], batch_size: int = 8) -> list[float]:
    """Relevance probability of each passage for `query`, same order as input."""
    if not passages:
        return []
    scores = get_reranker().predict(
        [(query, p) for p in passages],
        batch_size=batch_size,
        show_progress_bar=False,
    )
    return [float(s) for s in scores]
