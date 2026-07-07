"""PDF text extraction.

Strategy: try PyMuPDF first (fast, works for most PDFs). If the output looks
empty or Latin-garbled (because the PDF uses custom font encodings where Latin
code points are rendered as Cyrillic glyphs), fall back to OCR via Tesseract.

The Cyrillic-ratio heuristic catches the two failure modes the spec flagged:
image-scanned PDFs (zero text) and Mongolian PDFs with custom fonts (Latin
glyphs draw as Cyrillic but text extraction returns the Latin code points).
"""
from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF

from .ocr import extract_with_ocr


# Below this Cyrillic-letter fraction, we treat the extraction as garbled
# and fall back to OCR. Real Mongolian policy docs are ~95%+ Cyrillic letters
# (mixed with numbers and punctuation); the broken Tushaal PDFs are ~5%.
MIN_CYRILLIC_RATIO = 0.50
MIN_CHARS_PER_PAGE = 20  # below this, pages are effectively empty


def _cyrillic_ratio(text: str) -> float:
    """Fraction of alphabetic chars that are in the Cyrillic Unicode range."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    cyrillic = sum(1 for c in letters if "Ѐ" <= c <= "ӿ")
    return cyrillic / len(letters)


def _extract_with_pymupdf(pdf_path: Path) -> tuple[str, int]:
    """Return (joined_text, page_count)."""
    with fitz.open(pdf_path) as doc:
        pages = [page.get_text() for page in doc]
    return "\n\n".join(pages), len(pages)


def extract_text(pdf_path: Path, force_ocr: bool = False, verbose: bool = True) -> str:
    """Extract text from `pdf_path`. Auto-falls back to OCR if PyMuPDF output
    is empty or Latin-garbled. Pass `force_ocr=True` to skip PyMuPDF entirely.
    """
    if force_ocr:
        if verbose:
            print(f"  force_ocr=True -> running OCR on {pdf_path.name}")
        return extract_with_ocr(pdf_path, verbose=verbose)

    text, page_count = _extract_with_pymupdf(pdf_path)
    avg_chars = (len(text) / page_count) if page_count else 0
    ratio = _cyrillic_ratio(text)

    if avg_chars < MIN_CHARS_PER_PAGE:
        if verbose:
            print(
                f"  PyMuPDF returned {len(text)} chars over {page_count} pages "
                f"(avg {avg_chars:.0f} chars/page) — looks image-scanned. Falling back to OCR."
            )
        return extract_with_ocr(pdf_path, verbose=verbose)

    if ratio < MIN_CYRILLIC_RATIO:
        if verbose:
            print(
                f"  PyMuPDF extracted {len(text)} chars but only {ratio:.1%} are Cyrillic — "
                f"likely custom font encoding. Falling back to OCR."
            )
        return extract_with_ocr(pdf_path, verbose=verbose)

    if verbose:
        print(
            f"  PyMuPDF: {len(text)} chars, {ratio:.1%} Cyrillic — using text layer."
        )
    return text
