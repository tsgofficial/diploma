"""PDF text extraction, page by page.

Strategy: try PyMuPDF first (fast, works for most PDFs). If the output looks
empty or Latin-garbled (because the PDF uses custom font encodings where Latin
code points are rendered as Cyrillic glyphs), fall back to OCR via Tesseract.

The Cyrillic-ratio heuristic catches the two failure modes the spec flagged:
image-scanned PDFs (zero text) and Mongolian PDFs with custom fonts (Latin
glyphs draw as Cyrillic but text extraction returns the Latin code points).

Pages are kept separate so chunks can carry page numbers for citations.
Extraction results are cached under data/extracted/ keyed by the PDF's
content hash — OCR of a 40-page document takes minutes, and re-ingesting
(e.g. after a chunking change) should not pay that again.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import fitz  # PyMuPDF

from .config import DATA_DIR
from .ocr import ocr_pages


# Below this Cyrillic-letter fraction, we treat the extraction as garbled
# and fall back to OCR. Real Mongolian policy docs are ~95%+ Cyrillic letters
# (mixed with numbers and punctuation); the broken Tushaal PDFs are ~5%.
MIN_CYRILLIC_RATIO = 0.50
MIN_CHARS_PER_PAGE = 20  # below this, pages are effectively empty

EXTRACT_CACHE_DIR = DATA_DIR / "extracted"


def _cyrillic_ratio(text: str) -> float:
    """Fraction of alphabetic chars that are in the Cyrillic Unicode range."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    cyrillic = sum(1 for c in letters if "Ѐ" <= c <= "ӿ")
    return cyrillic / len(letters)


def _pymupdf_pages(pdf_path: Path) -> list[str]:
    with fitz.open(pdf_path) as doc:
        return [page.get_text() for page in doc]


def _content_hash(pdf_path: Path) -> str:
    h = hashlib.sha1()
    with open(pdf_path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()[:12]


def _cache_path(pdf_path: Path) -> Path:
    return EXTRACT_CACHE_DIR / f"{pdf_path.stem}.{_content_hash(pdf_path)}.json"


def extract_pages(
    pdf_path: Path,
    force_ocr: bool = False,
    verbose: bool = True,
    use_cache: bool = True,
) -> list[str]:
    """Extract text from `pdf_path`, one string per page.

    Auto-falls back to OCR if PyMuPDF output is empty or Latin-garbled. Pass
    `force_ocr=True` to skip PyMuPDF entirely. Results are cached by content
    hash (+ method) so a re-ingest never re-runs OCR on an unchanged PDF.
    """
    cache = _cache_path(pdf_path)
    if use_cache and cache.exists():
        data = json.loads(cache.read_text(encoding="utf-8"))
        if data.get("force_ocr") == force_ocr:
            if verbose:
                print(f"  cache: {len(data['pages'])} pages via {data['method']} ({cache.name})")
            return data["pages"]

    pages, method = _extract_uncached(pdf_path, force_ocr, verbose)

    if use_cache:
        EXTRACT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache.write_text(
            json.dumps(
                {"file": pdf_path.name, "method": method, "force_ocr": force_ocr, "pages": pages},
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    return pages


def _extract_uncached(pdf_path: Path, force_ocr: bool, verbose: bool) -> tuple[list[str], str]:
    if force_ocr:
        if verbose:
            print(f"  force_ocr=True -> running OCR on {pdf_path.name}")
        return ocr_pages(pdf_path, verbose=verbose), "ocr"

    pages = _pymupdf_pages(pdf_path)
    text = "\n\n".join(pages)
    page_count = len(pages)
    avg_chars = (len(text) / page_count) if page_count else 0
    ratio = _cyrillic_ratio(text)

    if avg_chars < MIN_CHARS_PER_PAGE:
        if verbose:
            print(
                f"  PyMuPDF returned {len(text)} chars over {page_count} pages "
                f"(avg {avg_chars:.0f} chars/page) — looks image-scanned. Falling back to OCR."
            )
        return ocr_pages(pdf_path, verbose=verbose), "ocr"

    if ratio < MIN_CYRILLIC_RATIO:
        if verbose:
            print(
                f"  PyMuPDF extracted {len(text)} chars but only {ratio:.1%} are Cyrillic — "
                f"likely custom font encoding. Falling back to OCR."
            )
        return ocr_pages(pdf_path, verbose=verbose), "ocr"

    if verbose:
        print(f"  PyMuPDF: {len(text)} chars, {ratio:.1%} Cyrillic — using text layer.")
    return pages, "pymupdf"


def extract_text(pdf_path: Path, force_ocr: bool = False, verbose: bool = True) -> str:
    """Joined full text. Kept for callers that don't need page boundaries."""
    return "\n\n".join(extract_pages(pdf_path, force_ocr=force_ocr, verbose=verbose))
