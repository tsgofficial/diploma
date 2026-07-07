"""LLM-as-judge: score a RAG answer against a reference answer.

Uses the same Gemini client as the app. The judge is deliberately strict and
returns a small JSON verdict so scoring is deterministic and parseable.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from app.llm import call_gemini

JUDGE_SYSTEM = """Чи бол сургуулийн журмын асуулт-хариултын үнэлгээ хийдэг хатуу шүүгч.
Танд АСУУЛТ, ЖИШИГ ХАРИУЛТ (үнэн зөв гэж тооцох), болон ШАЛГАХ ХАРИУЛТ өгнө.

Даалгавар: ШАЛГАХ ХАРИУЛТ нь ЖИШИГ ХАРИУЛТ-тай агуулгын хувьд нийцэж байгаа эсэхийг үнэл.
- CORRECT: гол баримт, тоо, дүрэм бүрэн зөв нийцэж байна.
- PARTIAL: зарим нь зөв боловч дутуу эсвэл нэг хэсэг нь буруу/дутуу.
- INCORRECT: гол баримт буруу, эсвэл асуултад хариулаагүй, эсвэл "мэдээлэл олдсонгүй" гэсэн.

Зөвхөн дараах JSON форматаар хариул, өөр юу ч бүү бич:
{"verdict": "CORRECT|PARTIAL|INCORRECT", "reason": "<богино тайлбар>"}"""

_SCORE = {"CORRECT": 1.0, "PARTIAL": 0.5, "INCORRECT": 0.0}


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of the model output (handles code fences)."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return {"verdict": "INCORRECT", "reason": f"unparseable judge output: {text[:120]}"}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {"verdict": "INCORRECT", "reason": f"invalid json: {text[:120]}"}


def judge(question: str, reference: str, candidate: str) -> dict:
    """Return {verdict, reason, score} comparing candidate to reference."""
    user_msg = (
        f"АСУУЛТ:\n{question}\n\n"
        f"ЖИШИГ ХАРИУЛТ:\n{reference}\n\n"
        f"ШАЛГАХ ХАРИУЛТ:\n{candidate}"
    )
    resp = call_gemini(
        contents=user_msg,
        system_instruction=JUDGE_SYSTEM,
        max_output_tokens=256,
    )
    parsed = _extract_json(resp.text or "")
    verdict = str(parsed.get("verdict", "INCORRECT")).upper()
    if verdict not in _SCORE:
        verdict = "INCORRECT"
    return {
        "verdict": verdict,
        "reason": parsed.get("reason", ""),
        "score": _SCORE[verdict],
    }
