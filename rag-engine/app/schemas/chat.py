"""Pydantic request/response models for the chat endpoint.

These define the HTTP contract between the Node core-backend and this engine.
Kept deliberately small — the engine is stateless and knows nothing about
users, sessions, or persistence.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HistoryTurn(BaseModel):
    """One prior message in the conversation, forwarded by the core-backend."""

    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Payload sent by the core-backend for a single chat turn."""

    question: str = Field(..., min_length=1, description="The student's question")
    # History is accepted for forward-compatibility (multi-turn context). The
    # current retrieval pipeline answers per-question, so it is not yet used for
    # retrieval — see the note in routes/chat.py.
    history: list[HistoryTurn] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Answer returned to the core-backend.

    `sources` is a list of document *titles* actually used — this mirrors what
    `app.retrieval.answer_question()` produces, not an object list.
    """

    answer: str
    sources: list[str] = Field(default_factory=list)
    refused: bool = False
    top_score: float = 0.0
