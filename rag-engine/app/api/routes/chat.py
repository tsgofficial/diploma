"""Chat endpoint.

Receives a question (plus prior history) from the Node core-backend, runs the
existing retrieval + generation pipeline, and returns the grounded answer with
its source document titles. This layer is a thin HTTP wrapper — all the real
work lives in `app.retrieval.answer_question()`, which is left untouched.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import StreamingResponse

from app.config import INTERNAL_API_KEY
from app.llm import GeminiQuotaExceeded
from app.retrieval import answer_question, answer_question_stream
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
    try:
        result = answer_question(payload.question, history=history)
    except GeminiQuotaExceeded as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        citations=result.get("citations", []),
        refused=result["refused"],
        top_score=result["top_score"],
    )


def _sse(event: dict) -> str:
    """One server-sent event: `event:` is the type, `data:` the JSON payload."""
    return f"event: {event['type']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
def chat_stream(payload: ChatRequest, _: None = Depends(verify_internal_key)) -> StreamingResponse:
    """Same pipeline as /chat, delivered as server-sent events so the client
    can show the answer while Gemini is still writing it. Event sequence:
    status → sources → delta* → done (or status → sources → done when refused).
    A pipeline failure is reported as an `error` event, not a broken stream."""
    history = [turn.model_dump() for turn in payload.history]

    def generate():
        try:
            for event in answer_question_stream(payload.question, history=history):
                yield _sse(event)
        except GeminiQuotaExceeded as exc:
            yield _sse({"type": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001 — surface to the client, keep the stream well-formed
            yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"[:300]})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
