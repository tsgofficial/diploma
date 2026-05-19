"""Gemini wrapper.

The prompt is grounded — we tell the model to refuse if the answer isn't in
the provided context. Thinking is disabled because for a factual RAG lookup
it just burns the output token budget.
"""
from __future__ import annotations

from typing import Optional

from google import genai
from google.genai import types

from .config import GEMINI_MAX_OUTPUT_TOKENS, GEMINI_MODEL


SYSTEM_PROMPT = """Та Монгол улсын их сургуулийн дүрэм журмын тухай асуултад хариулдаг туслах юм.

ДҮРЭМ:
- Зөвхөн доорх "Эх сурвалж" хэсэгт өгөгдсөн мэдээлэлд тулгуурлан хариулна уу.
- Мэдээлэлд тодорхой биш бол яг "Мэдээлэл олдсонгүй." гэж хариул. Юу ч таамаглаж бүү нэм. Энэ тохиолдолд эх сурвалж бичих хэрэггүй.
- Хариулсан тохиолдолд л төгсгөлд "[Эх сурвалж: <doc_title>]" хэлбэрээр БОДИТ ашигласан эх сурвалжийг бич. Олон эх сурвалж ашигласан бол цэг таслалаар тусгаарлан жагсаа. Ашиглаагүй эх сурвалжийг бүү бич.
- Зөвхөн монгол кирилл үсгээр хариул."""

NO_INFO_ANSWER = "Мэдээлэл олдсонгүй."

_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
    return _client


def generate_answer(question: str, context_chunks: list[dict]) -> dict:
    """Send question + retrieved chunks to Gemini. Returns dict with answer text
    and usage metadata.

    context_chunks: list of dicts each with at least `text` and `doc_title`.
    """
    context = "\n\n---\n\n".join(
        f"[Эх сурвалж: {c['doc_title']}]\n{c['text']}" for c in context_chunks
    )
    user_msg = f"Эх сурвалж:\n\n{context}\n\nАсуулт: {question}"

    resp = get_client().models.generate_content(
        model=GEMINI_MODEL,
        contents=user_msg,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
            temperature=0.0,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )

    finish_reason = (
        str(resp.candidates[0].finish_reason) if resp.candidates else "unknown"
    )
    usage = resp.usage_metadata
    return {
        "answer": resp.text or "",
        "finish_reason": finish_reason,
        "prompt_tokens": usage.prompt_token_count if usage else None,
        "output_tokens": usage.candidates_token_count if usage else None,
    }
