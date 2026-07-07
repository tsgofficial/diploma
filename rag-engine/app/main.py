"""FastAPI application factory for the RAG engine.

Run locally:
    uvicorn app.main:app --reload --port 8000

This service is internal — it is called only by the Node core-backend, never
directly by the browser. It ensures the DB schema and Qdrant collection exist
on startup, then serves the chat + admin routers.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import vector_store
from app.api.routes import admin, chat
from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Idempotent bootstrap so a fresh checkout serves requests immediately.
    init_db()
    vector_store.ensure_collection()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="University RAG Engine", version="0.1.0", lifespan=lifespan)
    app.include_router(chat.router)
    app.include_router(admin.router)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
