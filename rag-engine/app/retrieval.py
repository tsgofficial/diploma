"""End-to-end retrieval: question -> embed -> Qdrant -> rerank -> Gemini.

Pipeline (each stage switchable in config for A/B evaluation):

  1. embed the query densely and sparsely (bge-m3)
  2. hybrid search: dense + sparse prefetch, RRF fusion -> CANDIDATE_K chunks
  3. cross-encoder rerank (bge-reranker-v2-m3) -> TOP_K chunks
  4. refusal gate on the best reranker score (or best cosine when rerank off);
     a question the query-understanding step marks out of scope is refused
     before any search
  5. Gemini answers from the TOP_K chunks, citing document + page

`retrieve()` is everything before the LLM and is what the eval harness calls
so retrieval quality can be scored without spending Gemini quota.

Supports multi-turn conversations: when prior `history` is supplied, a
follow-up question is first condensed into a standalone query so retrieval
still finds the right chunks (e.g. "тэгээд?" on its own retrieves nothing).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Optional

from . import vector_store
from .config import (
    CANDIDATE_K,
    HYBRID_SEARCH,
    QUERY_REWRITE,
    MIN_RELEVANCE_SCORE,
    MIN_RERANK_SCORE,
    RERANK,
    RERANK_INCLUDE_TITLE,
    RESCUE_K,
    TOP_K,
)
from .embed import embed_query, sparse_embed_query
from .llm import NO_INFO_ANSWER, condense_question, generate_answer, rewrite_query, stream_answer
from .vector_store import Hit


def passage_text(hit: Hit) -> str:
    """Section-prefixed body — what the reranker judges. The document title is
    added only when RERANK_INCLUDE_TITLE is set (see config for why not)."""
    section = hit.payload.get("section")
    body = hit.payload["text"]
    header = section or ""
    if RERANK_INCLUDE_TITLE:
        title = hit.payload.get("doc_title") or ""
        header = f"{title} — {section}" if section else title
    return f"{header}\n{body}" if header else body


def retrieve(
    query: str,
    top_k: int = TOP_K,
    candidate_k: int = CANDIDATE_K,
    hybrid: bool = HYBRID_SEARCH,
    rerank: bool = RERANK,
    min_score: Optional[float] = None,
    alt_queries: Optional[list[str]] = None,
) -> dict:
    """Search + rerank + refusal decision. No LLM calls.

    `alt_queries` are extra phrasings (from the query rewriter); each is
    searched too and the candidate sets are merged before reranking, which
    is done against the main `query`.

    Returns {hits, refused, top_score, gate, dense_top_score, sources}.
    `top_score` is the value compared against `gate`: the reranker probability
    of the best chunk when reranking, else the best dense cosine score.
    """
    n = candidate_k if rerank else top_k
    candidates: list[Hit] = []
    seen: set[str] = set()
    for q in [query, *(alt_queries or [])]:
        dense_vec = embed_query(q)
        sparse_vec = sparse_embed_query(q) if hybrid else None
        for h in vector_store.search_active(dense_vec, top_k=n, sparse_vector=sparse_vec):
            if h.id not in seen:
                seen.add(h.id)
                candidates.append(h)

    if rerank and candidates:
        from .rerank import rerank as rerank_scores

        # Score every candidate against every phrasing and keep the best: a
        # casual question and its formal rewrite rarely score the same chunk
        # alike, and we only need one of them to recognise the answer.
        passages = [passage_text(h) for h in candidates]
        best = [0.0] * len(candidates)
        for q in [query, *(alt_queries or [])]:
            for i, s in enumerate(rerank_scores(q, passages)):
                if s > best[i]:
                    best[i] = s
        for h, s in zip(candidates, best):
            h.rerank_score = s
            h.score = s
        fused_top = candidates[:RESCUE_K]  # best by dense+sparse fusion, pre-rerank
        candidates.sort(key=lambda h: h.rerank_score or 0.0, reverse=True)
        hits = candidates[:top_k]
        # Safety net: the reranker orders and gates, but the strongest fused
        # candidates stay in the context even if it demoted them.
        for h in fused_top:
            if h not in hits:
                hits.append(h)
    else:
        hits = candidates[:top_k]
    dense_top = max((h.dense_score for h in hits), default=0.0)

    if rerank:
        gate = MIN_RERANK_SCORE if min_score is None else min_score
        top_score = hits[0].rerank_score if hits else 0.0
    else:
        gate = MIN_RELEVANCE_SCORE if min_score is None else min_score
        top_score = dense_top

    refused = (not hits) or (top_score < gate)
    return {
        "hits": hits,
        "refused": refused,
        "top_score": float(top_score or 0.0),
        "gate": gate,
        "dense_top_score": float(dense_top),
        "sources": sorted({h.payload["doc_title"] for h in hits}),
    }


def _understand(question: str, history: Optional[list[dict]]) -> tuple[str, list[str], str, bool]:
    """Query understanding step → (formal search query, alternative phrasings, language, in_scope).

    With QUERY_REWRITE on this is one small LLM call that also condenses
    follow-ups and flags questions unrelated to the university; off, it falls
    back to the older condense-only behaviour (always in scope)."""
    if QUERY_REWRITE:
        rw = rewrite_query(question, history or [])
        return rw["query"], rw["alternatives"], rw["language"], rw["in_scope"]
    return condense_question(question, history or []), [], "mn", True


def citations(hits: list[Hit]) -> list[dict]:
    """Group hits into [{doc_title, document_id, pages}] for the API response."""
    pages: dict[tuple[str, Optional[int]], set[int]] = defaultdict(set)
    for h in hits:
        p = h.payload
        key = (p["doc_title"], p.get("document_id"))
        start, end = p.get("page_start"), p.get("page_end")
        if start and end:
            pages[key].update(range(int(start), int(end) + 1))
        else:
            pages.setdefault(key, set())
    return [
        {"doc_title": t, "document_id": d, "pages": sorted(ps)}
        for (t, d), ps in sorted(pages.items(), key=lambda kv: kv[0][0])
    ]


def _context_chunks(hits: list[Hit]) -> list[dict]:
    return [
        {
            "text": h.payload["text"],
            "doc_title": h.payload["doc_title"],
            "section": h.payload.get("section"),
            "page_start": h.payload.get("page_start"),
            "page_end": h.payload.get("page_end"),
        }
        for h in hits
    ]


def answer_question_stream(
    question: str,
    history: Optional[list[dict]] = None,
    top_k: int = TOP_K,
    min_score: Optional[float] = None,
):
    """Streaming variant of `answer_question`. Yields event dicts:

      {"type": "status",  "stage": "searching"}
      {"type": "sources", "sources": [...], "citations": [...], "refused": bool, "top_score": float}
      {"type": "delta",   "text": "..."}          (zero or more)
      {"type": "done",    "answer": str, "refused": bool, "llm_usage": dict | None}

    A refused question yields status → sources → done (no deltas, no LLM call).
    """
    yield {"type": "status", "stage": "searching"}
    search_query, alts, language, in_scope = _understand(question, history)
    if not in_scope:
        # Nothing to do with the university: refuse before searching. Otherwise the
        # reranker happily matches whatever chunk is closest and the gate can't tell.
        yield {"type": "sources", "sources": [], "citations": [], "refused": True, "top_score": 0.0}
        yield {"type": "done", "answer": NO_INFO_ANSWER, "refused": True, "search_query": search_query, "llm_usage": None}
        return
    r = retrieve(search_query, top_k=top_k, min_score=min_score, alt_queries=alts)
    hits = r["hits"]

    if r["refused"]:
        yield {"type": "sources", "sources": [], "citations": [], "refused": True, "top_score": r["top_score"]}
        yield {"type": "done", "answer": NO_INFO_ANSWER, "refused": True, "search_query": search_query, "llm_usage": None}
        return

    yield {
        "type": "sources",
        "sources": r["sources"],
        "citations": citations(hits),
        "refused": False,
        "top_score": r["top_score"],
    }
    yield {"type": "status", "stage": "generating"}

    parts: list[str] = []
    usage = None
    for piece in stream_answer(search_query, _context_chunks(hits), language=language, original_question=question):
        if isinstance(piece, dict):
            usage = piece
            break
        parts.append(piece)
        yield {"type": "delta", "text": piece}

    yield {
        "type": "done",
        "answer": "".join(parts),
        "refused": False,
        "search_query": search_query,
        "llm_usage": usage,
    }


def answer_question(
    question: str,
    history: Optional[list[dict]] = None,
    top_k: int = TOP_K,
    min_score: Optional[float] = None,
) -> dict:
    """Return {answer, sources, citations, hits, refused, top_score, search_query, llm_usage}.

    history: prior turns as {role, content} dicts (excluding the current
    question). When provided, the question is condensed into a standalone query
    before retrieval. refused=True means we short-circuited without calling the
    answer LLM (no hit above the gate). hits is the Hit list so callers can show
    scores for debugging.
    """
    search_query, alts, language, in_scope = _understand(question, history)
    if not in_scope:
        return {
            "answer": NO_INFO_ANSWER,
            "sources": [],
            "citations": [],
            "hits": [],
            "refused": True,
            "out_of_scope": True,
            "top_score": 0.0,
            "search_query": search_query,
            "llm_usage": None,
        }

    r = retrieve(search_query, top_k=top_k, min_score=min_score, alt_queries=alts)
    hits = r["hits"]

    if r["refused"]:
        return {
            "answer": NO_INFO_ANSWER,
            "sources": [],
            "citations": [],
            "hits": hits,
            "refused": True,
            "top_score": r["top_score"],
            "search_query": search_query,
            "llm_usage": None,
        }

    # Answer against the formal query, but show the model the original wording too.
    llm_result = generate_answer(search_query, _context_chunks(hits), language=language, original_question=question)

    return {
        "answer": llm_result["answer"],
        "sources": r["sources"],
        "citations": citations(hits),
        "hits": hits,
        "refused": False,
        "top_score": r["top_score"],
        "search_query": search_query,
        "llm_usage": {
            "finish_reason": llm_result["finish_reason"],
            "prompt_tokens": llm_result["prompt_tokens"],
            "output_tokens": llm_result["output_tokens"],
        },
    }
