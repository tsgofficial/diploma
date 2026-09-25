"""bge-m3 embeddings — dense and sparse — from one lazy-loaded model.

Dense: the usual 1024-d CLS vector via sentence-transformers (cosine search).
Sparse: bge-m3's learned *lexical weights* — a ReLU'd linear head over the
same token hidden states, max-pooled per vocabulary id. This is exactly what
FlagEmbedding's `BGEM3FlagModel.encode(return_sparse=True)` computes, done
here directly so we need no extra dependency and load the weights once.

Sparse vectors give exact-token matching (order numbers, dates, course codes,
rare Mongolian terms) that dense vectors blur. Qdrant fuses both at query time.

Loading the model takes ~5–10s on first call. Subsequent calls in the same
process reuse it. CLI commands that don't embed (e.g. `list`) pay nothing.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from .config import EMBED_MODEL_NAME

if TYPE_CHECKING:
    import numpy as np
    import torch
    from sentence_transformers import SentenceTransformer

_model: "SentenceTransformer | None" = None
_sparse_head: "torch.nn.Linear | None" = None

SPARSE_MAX_TOKENS = 1024  # bge-m3 supports 8192; our chunks are far shorter


def get_model() -> "SentenceTransformer":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBED_MODEL_NAME)
    return _model


def _get_sparse_head() -> "torch.nn.Linear":
    """bge-m3 ships `sparse_linear.pt` (hidden_size -> 1) next to the weights."""
    global _sparse_head
    if _sparse_head is None:
        import torch
        from huggingface_hub import hf_hub_download

        model = get_model()
        hidden = model[0].auto_model.config.hidden_size
        state = torch.load(
            hf_hub_download(EMBED_MODEL_NAME, "sparse_linear.pt"), map_location="cpu"
        )
        head = torch.nn.Linear(hidden, 1)
        head.load_state_dict(state)
        head.eval()
        head.to(model.device)
        _sparse_head = head
    return _sparse_head


# ---------------------------------------------------------------- dense ----

def embed_texts(texts: list[str], show_progress: bool = False) -> "np.ndarray":
    """Returns (N, EMBED_DIM) float array; rows are L2-normalized."""
    return get_model().encode(
        texts, normalize_embeddings=True, show_progress_bar=show_progress
    )


def embed_query(query: str) -> list[float]:
    """Embed one query string. Returns a plain list so it goes straight into Qdrant."""
    vec = get_model().encode(query, normalize_embeddings=True)
    return vec.tolist()


# --------------------------------------------------------------- sparse ----

def sparse_embed_texts(
    texts: list[str], batch_size: int = 16, show_progress: bool = False
) -> list[dict[int, float]]:
    """Lexical weights per text: {token_id: weight}. Special tokens dropped."""
    import torch

    model = get_model()
    transformer = model[0].auto_model
    tokenizer = model.tokenizer
    head = _get_sparse_head()
    special = set(tokenizer.all_special_ids)

    out: list[dict[int, float]] = []
    iterator = range(0, len(texts), batch_size)
    if show_progress:
        try:
            from tqdm import tqdm
            iterator = tqdm(iterator, desc="sparse", unit="batch")
        except ImportError:
            pass

    for start in iterator:
        batch = texts[start : start + batch_size]
        enc = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=SPARSE_MAX_TOKENS,
            return_tensors="pt",
        ).to(model.device)
        with torch.no_grad():
            hidden = transformer(**enc).last_hidden_state
            weights = torch.relu(head(hidden)).squeeze(-1).cpu()
        ids = enc["input_ids"].cpu()
        for row in range(len(batch)):
            vec: dict[int, float] = {}
            for tid, w in zip(ids[row].tolist(), weights[row].tolist()):
                if tid in special or w <= 0.0:
                    continue
                if w > vec.get(tid, 0.0):
                    vec[tid] = w
            out.append(vec)
    return out


def sparse_embed_query(query: str) -> dict[int, float]:
    return sparse_embed_texts([query])[0]


def sparse_to_qdrant(vec: dict[int, float]) -> tuple[list[int], list[float]]:
    """Split {id: weight} into the parallel (indices, values) lists Qdrant wants."""
    if not vec:
        return [], []
    indices, values = zip(*sorted(vec.items()))
    return list(indices), list(values)


def sparse_dot(a: dict[int, float], b: Optional[dict[int, float]]) -> float:
    if not a or not b:
        return 0.0
    if len(b) < len(a):
        a, b = b, a
    return float(sum(w * b[t] for t, w in a.items() if t in b))
