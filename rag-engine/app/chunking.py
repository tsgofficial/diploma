"""Chunk text preferring paragraph then sentence boundaries.

Same algorithm as the POC. Kept in its own module so we can tune in one place.
"""
from __future__ import annotations

import re

from .config import CHUNK_OVERLAP, CHUNK_SIZE


def chunk_text(
    text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """Pack paragraphs greedily into ~`size` chunks. Oversize paragraphs are
    split on sentence boundaries. After packing, prepend the last `overlap`
    chars of the previous chunk so context bleeds across boundaries.
    """
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[str] = []
    buf = ""

    def flush() -> None:
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
                # Pathological long sentence: hard-cut at size boundaries.
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
