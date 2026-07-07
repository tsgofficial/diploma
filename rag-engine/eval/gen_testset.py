"""Generate a grounded Q&A test set from the ingested documents.

Methodology (RAGAS-style synthetic evaluation): for a sample of real chunks we
ask Gemini to write ONE factual question plus the correct reference answer,
answerable SOLELY from that chunk. The chunk's document title is recorded as the
expected retrieval source. Because the reference answer is grounded in the
actual source text — and generated independently of the retrieval pipeline being
tested — the resulting set measures whether the RAG system retrieves the right
document and answers it correctly.

The output is a starting point: REVIEW `testset.generated.json` and fix or drop
weak items before trusting the numbers.

Run from the rag-engine/ directory:
    python -m eval.gen_testset --per-doc 2 --out eval/testset.generated.json
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict

from app import vector_store
from app.config import COLLECTION
from app.llm import call_gemini

GEN_SYSTEM = """Чи сургуулийн журмын баримтаас шалгалтын асуулт зохиодог туслах.
Танд нэг эх сурвалжийн хэсэг өгнө. Түүнд ТУЛГУУРЛАН дараахыг гарга:
- Оюутны асууж болох нэг ТОДОРХОЙ, баримтад суурилсан асуулт.
- Тухайн хэсгээс ГАРЧ БОЛОХ богино, үнэн зөв хариулт.

Шаардлага:
- Асуулт нь тухайн хэсгийн мэдээллээр л хариулагдахуйц байх (тоо, дүрэм, нэр гэх мэт тодорхой баримт).
- Ерөнхий/тодорхойгүй асуулт бүү зохио.
- Зөвхөн монгол кириллээр.

Зөвхөн дараах JSON-оор хариул:
{"question": "...", "reference_answer": "..."}"""


def _extract_json(text: str) -> dict | None:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _sample_chunks(per_doc: int, min_len: int) -> dict[str, list[str]]:
    """Deterministically sample `per_doc` substantial chunks per document."""
    client = vector_store.get_client()
    by_doc: dict[str, list[str]] = defaultdict(list)
    offset = None
    while True:
        points, offset = client.scroll(
            collection_name=COLLECTION, limit=256, offset=offset, with_payload=True
        )
        for p in points:
            text = (p.payload or {}).get("text", "")
            title = (p.payload or {}).get("doc_title", "?")
            if len(text) >= min_len:
                by_doc[title].append(text)
        if offset is None:
            break

    # Even stride through each doc's chunks for reproducible, spread-out samples.
    sampled: dict[str, list[str]] = {}
    for title, texts in by_doc.items():
        if not texts:
            continue
        step = max(1, len(texts) // per_doc)
        sampled[title] = [texts[i * step] for i in range(per_doc) if i * step < len(texts)]
    return sampled


def _gen_qa(chunk: str) -> dict | None:
    resp = call_gemini(
        contents=f"Эх сурвалжийн хэсэг:\n\n{chunk}",
        system_instruction=GEN_SYSTEM,
        max_output_tokens=512,
        temperature=0.2,
    )
    return _extract_json(resp.text or "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-doc", type=int, default=2, help="Q&A pairs per document")
    ap.add_argument("--min-len", type=int, default=350, help="min chunk length to use")
    ap.add_argument("--out", default="eval/testset.generated.json")
    args = ap.parse_args()

    samples = _sample_chunks(args.per_doc, args.min_len)
    items: list[dict] = []
    n = 0
    for title, chunks in samples.items():
        for i, chunk in enumerate(chunks):
            qa = _gen_qa(chunk)
            if not qa or "question" not in qa or "reference_answer" not in qa:
                print(f"  skip: {title} #{i} (no usable Q&A)")
                continue
            n += 1
            items.append(
                {
                    "id": f"gen-{n:03d}",
                    "question": qa["question"].strip(),
                    "reference_answer": qa["reference_answer"].strip(),
                    "expected_source": title,
                    "should_refuse": False,
                    "category": "in-scope",
                    "origin": "generated",
                }
            )
            print(f"  [{n}] {title}: {qa['question'][:70]}")

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"\nwrote {len(items)} items -> {args.out}")
    print("REVIEW these before trusting eval numbers.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
