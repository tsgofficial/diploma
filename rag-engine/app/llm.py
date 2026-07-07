"""Gemini wrapper.

The prompt is grounded — we tell the model to refuse if the answer isn't in
the provided context. Thinking is disabled because for a factual RAG lookup
it just burns the output token budget.
"""
from __future__ import annotations

import os
import time
from typing import Optional

from google import genai
from google.genai import errors, types

from .config import GEMINI_MAX_OUTPUT_TOKENS, GEMINI_MODEL

# Optional minimum spacing between Gemini calls (seconds). Defaults to 0 (no
# throttle). Set GEMINI_MIN_INTERVAL_SEC to stay under a free-tier RPM limit —
# e.g. "13" keeps under the 5 requests/minute free tier.
_MIN_INTERVAL = float(os.environ.get("GEMINI_MIN_INTERVAL_SEC", "0"))
_last_call_ts = 0.0


SYSTEM_PROMPT = """Та Монгол улсын их сургуулийн дүрэм журмын тухай асуултад хариулдаг туслах юм.

ДҮРЭМ:
- Зөвхөн доорх "Эх сурвалж" хэсэгт өгөгдсөн мэдээлэлд тулгуурлан хариулна уу.
- Мэдээлэлд тодорхой биш бол яг "Мэдээлэл олдсонгүй." гэж хариул. Юу ч таамаглаж бүү нэм. Энэ тохиолдолд эх сурвалж бичих хэрэггүй.
- Хариулсан тохиолдолд л төгсгөлд "[Эх сурвалж: <doc_title>]" хэлбэрээр БОДИТ ашигласан эх сурвалжийг бич. Олон эх сурвалж ашигласан бол цэг таслалаар тусгаарлан жагсаа. Ашиглаагүй эх сурвалжийг бүү бич.
- Зөвхөн монгол кирилл үсгээр хариул."""

NO_INFO_ANSWER = "Мэдээлэл олдсонгүй."

# Rewrites a follow-up question into a standalone one using the conversation
# history, so retrieval works for turns like "тэгээд?" / "дэлгэрэнгүй".
CONDENSE_PROMPT = """Доор ярианы түүх болон хэрэглэгчийн шинэ асуултыг өгсөн.
Шинэ асуултыг ярианы түүхээс ХАМААРАЛГҮЙГЭЭР бие даан ойлгогдох нэг бүрэн асуулт болгон дахин бич.

ДҮРЭМ:
- Зөвхөн эцсийн бие даасан асуултыг буцаа. Тайлбар, оршил бүү нэм.
- Шинэ асуулт аль хэдийн бие даасан бол яг хэвээр нь буцаа.
- Зөвхөн монгол кирилл үсгээр бич."""

_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
    return _client


def call_gemini(
    contents: str,
    system_instruction: str,
    max_output_tokens: int,
    temperature: float = 0.0,
    max_retries: int = 6,
):
    """Single entry point for Gemini generation with rate-limit resilience.

    - Optionally throttles to `GEMINI_MIN_INTERVAL_SEC` between calls.
    - Retries on 429 RESOURCE_EXHAUSTED with exponential backoff so a free-tier
      quota spike doesn't crash the request. Returns the raw response.
    """
    global _last_call_ts

    backoff = 15.0
    for attempt in range(max_retries):
        # Client-side pacing (no-op when _MIN_INTERVAL is 0).
        if _MIN_INTERVAL > 0:
            wait = _MIN_INTERVAL - (time.monotonic() - _last_call_ts)
            if wait > 0:
                time.sleep(wait)

        try:
            resp = get_client().models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    max_output_tokens=max_output_tokens,
                    temperature=temperature,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            _last_call_ts = time.monotonic()
            return resp
        except errors.ClientError as exc:
            is_rate_limit = getattr(exc, "code", None) == 429
            if is_rate_limit and attempt < max_retries - 1:
                time.sleep(backoff)
                backoff = min(backoff * 2, 90)
                continue
            raise


def condense_question(question: str, history: list[dict]) -> str:
    """Rewrite a possibly-context-dependent question into a standalone one.

    `history` is a list of {role, content} dicts (prior turns only, excluding
    the current question). Returns the original question unchanged when there
    is no history or the model returns nothing useful — so the caller can
    always retrieve on the result safely.
    """
    if not history:
        return question

    convo = "\n".join(f"{turn['role']}: {turn['content']}" for turn in history)
    user_msg = (
        f"Ярианы түүх:\n{convo}\n\n"
        f"Шинэ асуулт: {question}\n\n"
        "Бие даасан асуулт:"
    )

    resp = call_gemini(
        contents=user_msg,
        system_instruction=CONDENSE_PROMPT,
        max_output_tokens=256,
    )
    condensed = (resp.text or "").strip()
    return condensed or question


def generate_answer(question: str, context_chunks: list[dict]) -> dict:
    """Send question + retrieved chunks to Gemini. Returns dict with answer text
    and usage metadata.

    context_chunks: list of dicts each with at least `text` and `doc_title`.
    """
    context = "\n\n---\n\n".join(
        f"[Эх сурвалж: {c['doc_title']}]\n{c['text']}" for c in context_chunks
    )
    user_msg = f"Эх сурвалж:\n\n{context}\n\nАсуулт: {question}"

    resp = call_gemini(
        contents=user_msg,
        system_instruction=SYSTEM_PROMPT,
        max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
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
