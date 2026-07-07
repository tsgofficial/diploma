"""OCR fallback for PDFs whose text layer is unusable.

Two failure modes this handles:
  1. Image-scanned PDFs (no text layer at all)
  2. PDFs with custom font encodings where Latin code points are drawn as
     Cyrillic glyphs — the rendered image is correct Cyrillic, but the text
     extracted by PyMuPDF/pdfplumber is Latin-glyph garbage.

System dependencies:
    brew install tesseract tesseract-lang poppler

`tesseract-lang` is the package that includes the Mongolian (`mon`) model.
"""
from __future__ import annotations

import shutil
from pathlib import Path


OCR_DPI = 300            # 300dpi is the standard Tesseract recommendation
OCR_LANG = "mon"         # Mongolian Cyrillic; add "+eng" if mixed-language
SAMPLE_PAGES = None      # process all pages; set to e.g. 5 to limit for dev


def check_dependencies() -> tuple[bool, str]:
    """Return (ok, message). Used to fail loudly before doing expensive work."""
    if shutil.which("tesseract") is None:
        return False, (
            "tesseract binary not found. Install with:\n"
            "  brew install tesseract tesseract-lang"
        )
    if shutil.which("pdftoppm") is None:
        return False, (
            "poppler (pdftoppm) not found. Install with:\n"
            "  brew install poppler"
        )
    try:
        import pytesseract  # noqa: F401
        import pdf2image  # noqa: F401
    except ImportError as exc:
        return False, (
            f"Python OCR libs missing: {exc.name}. Install with:\n"
            "  pip install pytesseract pdf2image"
        )

    # Verify Mongolian language model is present
    import pytesseract
    try:
        langs = pytesseract.get_languages(config="")
    except Exception as exc:
        return False, f"tesseract installed but unusable: {exc}"
    if OCR_LANG not in langs:
        return False, (
            f"tesseract '{OCR_LANG}' language model missing. Available: {langs}. "
            "Install with: brew install tesseract-lang"
        )

    return True, "ok"


def extract_with_ocr(pdf_path: Path, verbose: bool = True) -> str:
    """OCR every page of `pdf_path` and return the joined text."""
    ok, msg = check_dependencies()
    if not ok:
        raise RuntimeError(f"OCR not available: {msg}")

    # Imports here (not at top) so users without OCR deps can still import
    # the rest of the app.
    import pdf2image
    import pytesseract

    if verbose:
        print(f"  OCR: rasterizing {pdf_path.name} at {OCR_DPI}dpi...")
    images = pdf2image.convert_from_path(pdf_path, dpi=OCR_DPI)
    if SAMPLE_PAGES:
        images = images[:SAMPLE_PAGES]

    page_texts: list[str] = []
    for i, img in enumerate(images, 1):
        if verbose:
            print(f"  OCR: page {i}/{len(images)}...", end="\r", flush=True)
        text = pytesseract.image_to_string(img, lang=OCR_LANG)
        page_texts.append(text)

    if verbose:
        print(" " * 60, end="\r")  # clear the in-place progress line
        total = sum(len(t) for t in page_texts)
        print(f"  OCR: done. {total} chars over {len(images)} pages.")

    return "\n\n".join(page_texts)
