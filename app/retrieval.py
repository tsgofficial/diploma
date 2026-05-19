"""End-to-end retrieval: question -> embed -> Qdrant -> Gemini -> answer.

Short-circuits to the refusal answer when retrieval has no confident hit, so
we don't burn LLM tokens on a question the knowledge base clearly doesn't cover.
"""
from __future__ import annotations

from typing import Optional

from . import vector_store
from .config import MIN_RELEVANCE_SCORE, TOP_K
from .embed import embed_query
from .llm import NO_INFO_ANSWER, generate_answer


def answer_question(
    question: str,
    top_k: int = TOP_K,
    min_score: float = MIN_RELEVANCE_SCORE,
) -> dict:
    """Return {answer, sources, hits, refused, llm_usage}.

    refused=True means we short-circuited without calling the LLM (no hit
    above min_score). hits is the raw Qdrant ScoredPoint list so callers can
    show scores for debugging.
    """
    q_vec = embed_query(question)
    hits = vector_store.search_active(q_vec, top_k=top_k)

    top_score = hits[0].score if hits else 0.0
    if not hits or top_score < min_score:
        return {
            "answer": NO_INFO_ANSWER,
            "sources": [],
            "hits": hits,
            "refused": True,
            "top_score": top_score,
            "llm_usage": None,
        }

    context_chunks = [
        {"text": h.payload["text"], "doc_title": h.payload["doc_title"]}
        for h in hits
    ]
    llm_result = generate_answer(question, context_chunks)

    sources = sorted({h.payload["doc_title"] for h in hits})
    return {
        "answer": llm_result["answer"],
        "sources": sources,
        "hits": hits,
        "refused": False,
        "top_score": top_score,
        "llm_usage": {
            "finish_reason": llm_result["finish_reason"],
            "prompt_tokens": llm_result["prompt_tokens"],
            "output_tokens": llm_result["output_tokens"],
        },
    }
