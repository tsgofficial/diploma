"""Chat endpoint.

Receives a question (plus prior history) from the Node core-backend, runs the
existing retrieval + generation pipeline, and returns the grounded answer with
its source document titles. This layer is a thin HTTP wrapper — all the real
work lives in `app.retrieval.answer_question()`, which is left untouched.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import INTERNAL_API_KEY
from app.retrieval import answer_question
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])


def verify_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Guard: only the core-backend, holding the shared secret, may call us."""
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing internal key",
        )


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, _: None = Depends(verify_internal_key)) -> ChatResponse:
    # Forward prior turns so the engine can condense follow-ups into a
    # standalone query before retrieval (multi-turn support).
    history = [turn.model_dump() for turn in payload.history]
    result = answer_question(payload.question, history=history)

    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        refused=result["refused"],
        top_score=result["top_score"],
    )
