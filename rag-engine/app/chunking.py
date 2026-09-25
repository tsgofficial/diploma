"""Structure- and page-aware chunking for Mongolian policy documents.

Why not plain fixed-size windows: regulations are organised into numbered
sections ("Нэг. Нийтлэг үндэслэл", "2.3. ...") and handbooks into headed
sections. A window cut at 800 characters happily splits a grading table or a
clause in half, and an embedding of that fragment has lost its subject.

This chunker:
  0. Strips running headers/footers (lines repeated across many pages) and
     bare page numbers, which would otherwise pollute nearly every chunk.
  1. Detects heading lines (Mongolian ordinal sections, numbered headings,
     ALL-CAPS Cyrillic titles) and tracks the current section for every paragraph.
     A run of short numbered items ("1. <school> <url>", "2. …") is a list, not
     headings, and stays in the text.
  2. Packs paragraphs greedily into ~CHUNK_SIZE chunks, but never across a
     section boundary (a tiny section may merge forward so we don't emit
     micro-chunks). Numbered clauses always start a new paragraph.
  3. Records the page range each chunk came from, for citations.
  4. Overlaps adjacent chunks *within* a section only, so foreign text never
     bleeds across a heading.

Each chunk's body is what the LLM sees; the ingestion step prefixes
`doc_title` + `section` for embedding so the vector carries its context.
"""
from __future__ import annotations

import re
import statistics
from dataclasses import dataclass
from typing import Optional

from .config import CHUNK_OVERLAP, CHUNK_SIZE, MIN_CHUNK_SIZE


@dataclass
class Chunk:
    text: str
    section: Optional[str]
    page_start: int  # 1-based, inclusive
    page_end: int


# "Нэг. Нийтлэг үндэслэл", "Хоёр. ...", "Арван нэг. ..." — top-level sections
# of Mongolian regulations.
_ORDINAL = (
    r"(?:Нэг|Хоёр|Гурав|Дөрөв|Тав|Зургаа|Долоо|Найм|Ес|Арав|Хорь|Гуч|Дөч"
    r"|Арван\s+\w+|Хорин\s+\w+|Гучин\s+\w+)"
)
_RE_ORDINAL_HEADING = re.compile(rf"^{_ORDINAL}\s*[\.\):]\s*\S", re.IGNORECASE)
# "1.", "2.3", "IV.", "Бүлэг 3", "3-р бүлэг", "Зүйл 5"
_RE_NUMBERED_HEADING = re.compile(r"^(?:\d{1,2}(?:\.\d{1,2}){0,2}\.?|[IVX]{1,5}\.?)\s+\S")
_RE_CHAPTER = re.compile(r"^(?:\d+\s*(?:-р|-Р|дүгээр|дугаар)?\s*)?(?:БҮЛЭГ|Бүлэг|ЗҮЙЛ|Зүйл|ХЭСЭГ|Хэсэг)\b")
# A numbered clause like "3.2. Оюутан нь ..." starts a new paragraph even when
# the PDF text layer gives us no blank line.
_RE_CLAUSE_START = re.compile(r"^\d{1,2}(?:\.\d{1,2}){1,3}\.?\s+")

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?。！？])\s+")

MAX_HEADING_LEN = 110

# Cyrillic letters that are NOT in the Mongolian alphabet (Ї, Є, Ґ, І, Ў, Ђ …).
# OCR renders Latin running headers ("UNIVERSITY OF") as garbage like
# "ОММЕКЗЇТҮ ОР"; such letters are a reliable tell.
_MONGOLIAN_CYRILLIC = set("АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмноөпрстуүфхцчшщъыьэюя")


def _has_foreign_cyrillic(line: str) -> bool:
    return any("Ѐ" <= c <= "ӿ" and c not in _MONGOLIAN_CYRILLIC for c in line)


_RE_DIGIT_IN_WORD = re.compile(r"[А-Яа-яӨҮөүЁё]\d|\d[А-Яа-яӨҮөүЁё]")


def _looks_garbled(line: str) -> bool:
    """OCR noise: mostly punctuation ("0,К,--...40,К,") or digits glued into
    words ("УММЕВ5!ТҮ")."""
    alpha = sum(1 for c in line if c.isalpha())
    return alpha < 0.6 * len(line.replace(" ", "")) or bool(_RE_DIGIT_IN_WORD.search(line))


def is_ocr_garbage(line: str) -> bool:
    """Short line that is an OCR misread of a Latin header/footer — non-Mongolian
    Cyrillic letters, or Cyrillic garbled beyond being a word — never real
    content. Lines without Cyrillic ("4.0", "A-", "0-60 F") are table cells
    and are always kept."""
    line = line.strip()
    if len(line) > 40 or not line:
        return False
    if _has_foreign_cyrillic(line):
        return True
    cyrillic = sum(1 for c in line if c in _MONGOLIAN_CYRILLIC)
    return cyrillic >= 3 and _looks_garbled(line) and not _RE_CLAUSE_START.match(line)


def _is_heading(line: str) -> bool:
    line = line.strip()
    if not line or len(line) > MAX_HEADING_LEN or _has_foreign_cyrillic(line) or _looks_garbled(line):
        return False
    if _RE_ORDINAL_HEADING.match(line) or _RE_CHAPTER.match(line):
        return True
    letters = [c for c in line if c.isalpha()]
    if len(letters) >= 4:
        upper = sum(1 for c in letters if c.isupper())
        cyrillic = sum(1 for c in letters if "Ѐ" <= c <= "ӿ")
        # ALL-CAPS Cyrillic title. Latin all-caps lines in these documents are
        # running headers ("MONGOLIAN UNIVERSITY OF ...") — not sections.
        if upper / len(letters) >= 0.85 and cyrillic / len(letters) >= 0.5 and len(line) <= 90:
            return True
    # Short numbered title: "2.3 Үнэлгээний журам". Wrapped list items
    # ("3. Сургуулийн талаарх мэдээллийг ... сайт, холбогдох") are longer,
    # have more words, or end mid-sentence with punctuation.
    if _RE_NUMBERED_HEADING.match(line) and len(line) <= 60:
        words = line.split()
        body = " ".join(words[1:])
        if 1 <= len(words) - 1 <= 5 and body[:1].isupper() and not line.endswith((".", ";", ",", ":", "-")):
            return True
    return False


def _clean_heading(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip())[:MAX_HEADING_LEN]


# "1. Барилга, архитектурын сургууль" — a single-level number, which may open a
# section or may just be one item of a numbered list.
_RE_LIST_NUMBER = re.compile(r"^(\d{1,2})\.?\s+\S")
LIST_ITEM_MAX_BODY = 120  # median text under a numbered "heading" below this → it's a list


def _numbered_list_items(lines: list[str], heading: list[bool]) -> set[int]:
    """Indexes of numbered "headings" that are really items of a list.

    A list of short named things ("1. Барилга, архитектурын сургууль" followed
    only by its URL, "2. …") passes every heading test, and treating each item
    as a section drops its name from the text. A run of ≥3 consecutively
    numbered headings whose typical body is short is a list, not an outline."""
    cands = [i for i, h in enumerate(heading) if h and _RE_LIST_NUMBER.match(lines[i])]
    body: dict[int, int] = {}
    for i in cands:
        n = 0
        for j in range(i + 1, len(lines)):
            if heading[j]:
                break
            n += len(lines[j])
        body[i] = n

    items: set[int] = set()
    run: list[int] = []

    def close() -> None:
        if len(run) >= 3 and statistics.median(body[i] for i in run) < LIST_ITEM_MAX_BODY:
            items.update(run)

    prev_num = None
    for i in cands:
        num = int(_RE_LIST_NUMBER.match(lines[i]).group(1))
        if run and num == prev_num + 1:
            run.append(i)
        else:
            close()
            run = [i]
        prev_num = num
    close()
    return items


def _units(pages: list[str]) -> list[tuple[str, int, Optional[str]]]:
    """Split the document into (paragraph, page, section) units, tracking the
    current section as headings are met. Paragraphs never span pages.

    Headings with no text between them ("БҮЛЭГ 2" then its title, or a table's
    column titles) join into one "A / B" section instead of keeping only the
    last. Numbered list items stay in the text and start a new paragraph."""
    lines = [(no, raw.strip()) for no, text in enumerate(pages, start=1) for raw in text.splitlines()]
    texts = [line for _, line in lines]
    heading = [bool(line) and _is_heading(line) for line in texts]
    list_items = _numbered_list_items(texts, heading)
    for i in list_items:
        heading[i] = False

    units: list[tuple[str, int, Optional[str]]] = []
    buf: list[str] = []
    buf_page = 0
    section: Optional[str] = None
    after_heading = False

    def flush() -> None:
        if buf:
            para = re.sub(r"[ \t]+", " ", " ".join(buf)).strip()
            if para:
                units.append((para, buf_page, section))
            buf.clear()

    for i, (page, line) in enumerate(lines):
        if buf and page != buf_page:
            flush()
        if not line:
            flush()
            continue
        if heading[i]:
            flush()
            h = _clean_heading(line)
            last = section.rsplit(" / ", 1)[-1] if section else ""
            # Wrapped titles and parent → child join; numbered siblings
            # ("6. …" then "7. …") replace each other.
            sibling = bool(_RE_NUMBERED_HEADING.match(last) and _RE_NUMBERED_HEADING.match(h))
            joined = f"{section} / {h}" if after_heading and section and not sibling else h
            section = joined if len(joined) <= MAX_HEADING_LEN else h
            after_heading = True
            continue
        after_heading = False
        if i in list_items or _RE_CLAUSE_START.match(line):
            flush()
        buf.append(line)
        buf_page = page
    flush()
    return units


def _split_oversize(text: str, size: int) -> list[str]:
    """Split a paragraph longer than `size` on sentence boundaries, hard-cutting
    any single sentence that is still too long."""
    pieces: list[str] = []
    sbuf = ""
    for sent in _SENTENCE_SPLIT.split(text):
        if not sent:
            continue
        if len(sent) > size:
            if sbuf:
                pieces.append(sbuf)
                sbuf = ""
            pieces.extend(sent[i : i + size] for i in range(0, len(sent), size))
            continue
        if len(sbuf) + len(sent) + 1 <= size:
            sbuf = (sbuf + " " + sent).strip()
        else:
            pieces.append(sbuf)
            sbuf = sent
    if sbuf:
        pieces.append(sbuf)
    return pieces


_RE_PAGE_NUMBER = re.compile(r"^\d{1,3}$")


def _boilerplate_key(line: str) -> str:
    """Normalise a line for repeated-header detection: lowercase, digits and
    punctuation stripped, whitespace collapsed."""
    return re.sub(r"[\W\d_]+", " ", line.lower()).strip()


def strip_boilerplate(pages: list[str], min_pages: int = 3, min_fraction: float = 0.25) -> list[str]:
    """Remove running headers/footers and bare page numbers.

    A line whose normalised form appears on at least `min_pages` pages *and*
    at least `min_fraction` of all pages is a running header/footer (document
    title, "…тушаалын хавсралт", department name). Left in, it lands inside
    almost every chunk and drags every embedding toward the same words.
    """
    if len(pages) < min_pages:
        return [_drop_page_numbers(p) for p in pages]
    seen_on: dict[str, set[int]] = {}
    for i, page in enumerate(pages):
        for raw in page.splitlines():
            key = _boilerplate_key(raw)
            if len(key) >= 6:
                seen_on.setdefault(key, set()).add(i)
    threshold = max(min_pages, int(len(pages) * min_fraction))
    repeated = {k for k, pgs in seen_on.items() if len(pgs) >= threshold}

    cleaned = []
    for page in pages:
        kept = [
            raw for raw in page.splitlines()
            if _boilerplate_key(raw) not in repeated
            and not _RE_PAGE_NUMBER.match(raw.strip())
            and not is_ocr_garbage(raw)
        ]
        cleaned.append("\n".join(kept))
    return cleaned


def _drop_page_numbers(page: str) -> str:
    return "\n".join(
        l for l in page.splitlines() if not _RE_PAGE_NUMBER.match(l.strip()) and not is_ocr_garbage(l)
    )


def chunk_pages(
    pages: list[str],
    size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    min_size: int = MIN_CHUNK_SIZE,
) -> list[Chunk]:
    """Chunk a document given as a list of page strings (1-based page numbers)."""
    pages = strip_boilerplate(pages)

    # 1. Paragraph units with page + section, headings tracked across pages.
    units = _units(pages)

    # Oversize paragraphs -> sentence pieces carrying the same page/section.
    expanded: list[tuple[str, int, Optional[str]]] = []
    for text, page, sec in units:
        if len(text) <= size:
            expanded.append((text, page, sec))
        else:
            expanded.extend((piece, page, sec) for piece in _split_oversize(text, size))

    # 2. Greedy packing, flushing at section boundaries (unless the buffer is
    #    tiny, in which case the small section merges forward).
    chunks: list[Chunk] = []
    buf_text = ""
    buf_section: Optional[str] = None
    last_sec: Optional[str] = None  # section of the latest unit in the buffer
    buf_pstart = buf_pend = 0

    def flush() -> None:
        nonlocal buf_text, buf_section, buf_pstart, buf_pend
        if buf_text:
            chunks.append(Chunk(buf_text, buf_section, buf_pstart, buf_pend))
        buf_text = ""
        buf_section = None
        buf_pstart = buf_pend = 0

    for text, page, sec in expanded:
        section_changed = buf_text and sec != buf_section and len(buf_text) >= min_size
        fits = len(buf_text) + len(text) + 2 <= size
        if section_changed or not fits:
            flush()
        if not buf_text:
            buf_text = text
            buf_section = sec
            buf_pstart = buf_pend = page
        else:
            # A tiny section merged forward: the chunk keeps the first
            # section's label, so the new heading stays in the text.
            if sec and sec != last_sec:
                text = f"{sec}\n{text}"
            buf_text = buf_text + "\n\n" + text
            buf_pend = page
        last_sec = sec
    flush()

    # 3. Overlap within a section only.
    if overlap > 0 and len(chunks) > 1:
        for i in range(1, len(chunks)):
            prev, cur = chunks[i - 1], chunks[i]
            if prev.section == cur.section:
                tail = prev.text[-overlap:]
                cur.text = tail + " " + cur.text
                cur.page_start = min(cur.page_start, prev.page_end)

    return chunks


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Plain-text convenience wrapper (single page). Returns chunk bodies."""
    return [c.text for c in chunk_pages([text], size=size, overlap=overlap)]
