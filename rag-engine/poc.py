#!/usr/bin/env python3
"""Mongolian university policy RAG — single-file proof of concept.

Pipeline: PDF -> PyMuPDF text -> chunk -> bge-m3 embed -> Qdrant
           question -> embed -> filter status=active -> top-k -> Claude (Mongolian)

Prerequisites:
    docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant
    pip install -r requirements.txt
    export GEMINI_API_KEY=...        # from https://aistudio.google.com/apikey

Usage:
    python poc.py pdfs/-01-_2022-web_QvsstvT.pdf "Шалгалт хэдэн оноотой вэ?"
"""
from __future__ import annotations

import os
import re
import sys
import uuid
from pathlib import Path

import fitz  # PyMuPDF
from google import genai
from google.genai import types
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)
from sentence_transformers import SentenceTransformer


COLLECTION = "policies_poc"
EMBED_MODEL_NAME = "BAAI/bge-m3"
EMBED_DIM = 1024
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
TOP_K = 5
GEMINI_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = """Та Монгол улсын их сургуулийн дүрэм журмын тухай асуултад хариулдаг туслах юм.

ДҮРЭМ:
- Зөвхөн доорх "Эх сурвалж" хэсэгт өгөгдсөн мэдээлэлд тулгуурлан хариулна уу.
- Мэдээлэлд тодорхой биш бол яг "мэдээлэл олдсонгүй" гэж хариул. Юу ч таамаглаж бүү нэм.
- Хариултын төгсгөлд эх сурвалжийн нэрийг "[Эх сурвалж: <doc_title>]" хэлбэрээр заавал бич.
- Зөвхөн монгол кирилл үсгээр хариул."""


def extract_text(pdf_path: Path) -> str:
    """Read all pages of the PDF and join with blank-line separators."""
    with fitz.open(pdf_path) as doc:
        pages = [page.get_text() for page in doc]
    return "\n\n".join(pages)


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Chunk preferring paragraph then sentence boundaries.

    Pack paragraphs greedily into ~`size` chunks. Oversize paragraphs are split
    on sentence boundaries (. ! ?). After packing, prepend the last `overlap`
    chars of the previous chunk so context bleeds across boundaries.
    """
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[str] = []
    buf = ""

    def flush():
        nonlocal buf
        if buf:
            chunks.append(buf)
            buf = ""

    for para in paragraphs:
        if len(para) <= size:
            if len(buf) + len(para) + 2 <= size:
                buf = (buf + "\n\n" + para).strip()
            else:
                flush()
                buf = para
            continue

        # Paragraph itself is too big — flush, then split on sentences.
        flush()
        sentences = re.split(r"(?<=[.!?。！？])\s+", para)
        sbuf = ""
        for sent in sentences:
            if not sent:
                continue
            if len(sent) > size:
                # Pathological long sentence: hard-cut.
                if sbuf:
                    chunks.append(sbuf)
                    sbuf = ""
                for i in range(0, len(sent), size):
                    chunks.append(sent[i : i + size])
                continue
            if len(sbuf) + len(sent) + 1 <= size:
                sbuf = (sbuf + " " + sent).strip()
            else:
                chunks.append(sbuf)
                sbuf = sent
        if sbuf:
            buf = sbuf
    flush()

    if overlap > 0 and len(chunks) > 1:
        overlapped = [chunks[0]]
        for i in range(1, len(chunks)):
            tail = chunks[i - 1][-overlap:]
            overlapped.append(tail + " " + chunks[i])
        chunks = overlapped

    return chunks


def ensure_collection(qdrant: QdrantClient) -> None:
    """(Re)create the collection from scratch for repeatable POC runs."""
    if qdrant.collection_exists(COLLECTION):
        qdrant.delete_collection(COLLECTION)
    qdrant.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
    )


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <pdf_path> <question>", file=sys.stderr)
        return 1

    pdf_path = Path(sys.argv[1])
    question = sys.argv[2]

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1
    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        print("GEMINI_API_KEY (or GOOGLE_API_KEY) not set", file=sys.stderr)
        return 1

    print(f"[1/6] Extracting text from {pdf_path.name}...")
    text = extract_text(pdf_path)
    print(f"      {len(text)} chars extracted.")
    print(f"      First 300 chars (verify Cyrillic looks clean):")
    print(f"      {text[:300]!r}\n")

    print(f"[2/6] Chunking (size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})...")
    chunks = chunk_text(text)
    print(f"      {len(chunks)} chunks. Lengths: "
          f"min={min(map(len, chunks))} max={max(map(len, chunks))} "
          f"avg={sum(map(len, chunks)) // len(chunks)}")
    print(f"      Sample chunk[0][:200]:\n      {chunks[0][:200]!r}\n")

    print(f"[3/6] Loading embedding model {EMBED_MODEL_NAME}...")
    embedder = SentenceTransformer(EMBED_MODEL_NAME)

    print(f"[4/6] Embedding {len(chunks)} chunks...")
    embeddings = embedder.encode(
        chunks, show_progress_bar=True, normalize_embeddings=True
    )

    print(f"[5/6] Storing in Qdrant (collection={COLLECTION!r})...")
    qdrant = QdrantClient(host="localhost", port=6333)
    ensure_collection(qdrant)
    doc_title = pdf_path.stem
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=emb.tolist(),
            payload={
                "text": chunk,
                "doc_title": doc_title,
                "status": "active",
                "chunk_index": i,
            },
        )
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    qdrant.upsert(collection_name=COLLECTION, points=points)
    print(f"      {len(points)} points upserted.\n")

    print(f"[6/6] Question: {question}")
    q_emb = embedder.encode(question, normalize_embeddings=True).tolist()
    hits = qdrant.query_points(
        collection_name=COLLECTION,
        query=q_emb,
        limit=TOP_K,
        query_filter=Filter(
            must=[FieldCondition(key="status", match=MatchValue(value="active"))]
        ),
    ).points

    print(f"\nRetrieved {len(hits)} chunks (top {TOP_K}):")
    for i, h in enumerate(hits, 1):
        snippet = h.payload["text"].replace("\n", " ")[:140]
        print(f"  [{i}] score={h.score:.3f}  {snippet}...")

    if not hits:
        print("\nNo chunks retrieved — skipping Claude call.")
        return 0

    context = "\n\n---\n\n".join(
        f"[Эх сурвалж: {h.payload['doc_title']}]\n{h.payload['text']}"
        for h in hits
    )
    user_msg = f"Эх сурвалж:\n\n{context}\n\nАсуулт: {question}"

    print("\n--- Gemini хариулт ---")
    client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY from env
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_msg,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=2048,
            temperature=0.0,  # grounded RAG — minimize creative drift
            # Gemini 2.5 thinks by default; thinking tokens eat max_output_tokens.
            # For RAG lookups we want raw answers — disable thinking.
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    print(resp.text)

    finish = resp.candidates[0].finish_reason if resp.candidates else None
    usage = resp.usage_metadata
    print(f"\n--- finish_reason={finish}  "
          f"prompt={usage.prompt_token_count} "
          f"output={usage.candidates_token_count} "
          f"total={usage.total_token_count} ---")
    if str(finish).endswith("MAX_TOKENS"):
        print("WARNING: answer was truncated; raise max_output_tokens.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
