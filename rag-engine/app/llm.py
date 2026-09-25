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

import json
import re

from .config import GEMINI_MAX_OUTPUT_TOKENS, GEMINI_MODEL, GEMINI_REWRITE_MODEL

# Optional minimum spacing between Gemini calls (seconds). Defaults to 0 (no
# throttle). Set GEMINI_MIN_INTERVAL_SEC to stay under a free-tier RPM limit —
# e.g. "13" keeps under the 5 requests/minute free tier.
_MIN_INTERVAL = float(os.environ.get("GEMINI_MIN_INTERVAL_SEC", "0"))
_last_call_ts = 0.0


SYSTEM_PROMPT = """Та Монгол улсын их сургуулийн дүрэм журмын тухай асуултад хариулдаг туслах юм.

ДҮРЭМ:
- Зөвхөн доорх "Эх сурвалж" хэсэгт өгөгдсөн мэдээлэлд тулгуурлан хариулна уу.
- Оюутнууд асуултаа энгийн, товч, алдаатай, товчилсон үгээр бичдэг. Асуултын САНААГ ойлгож, эх сурвалжид тухайн санааны хариулт байвал хариул. Жишээ нь "100 оноо юунаас бүрддэг вэ" гэвэл явцын болон улирлын шалгалтын онооны хуваарилалтыг тайлбарла.
- Эх сурвалжид асуултын яг хариулт байхгүй ч тухайн сэдвээр холбоотой дүрэм, тоо баримт байвал "Мэдээлэл олдсонгүй" гэж БҮҮ хариул. Харин асуусан зүйл баримт бичигт тодорхой заагаагүйг эхэнд нь хэлээд, холбоотой баримтыг товч бичиж эх сурвалжийг нь заа (жишээ: асуусан тоо заагаагүй ч тухайн асуудлыг зохицуулсан журам байвал журмыг нь тайлбарла). Юу ч таамаглаж бүү нэм.
- Эх сурвалж асуултын сэдэвтэй огт хамааралгүй бол л яг "Мэдээлэл олдсонгүй." гэж хариул. Энэ тохиолдолд эх сурвалж бичих хэрэггүй.
- Хариулсан тохиолдолд л төгсгөлд "[Эх сурвалж: <doc_title>, х. <хуудас>]" хэлбэрээр БОДИТ ашигласан эх сурвалж болон хуудсыг бич. Олон эх сурвалж ашигласан бол цэг таслалаар тусгаарлан жагсаа. Ашиглаагүй эх сурвалжийг бүү бич.
- {language_rule}"""

LANGUAGE_RULES = {
    "mn": "Зөвхөн монгол кирилл үсгээр хариул.",
    "en": "The student asked in English: answer in clear English, but keep document titles, official terms and the source line exactly as written in the sources (Mongolian). If the sources only partly answer or contain related rules or figures on the topic, do not refuse: say in English that the documents don't state it exactly, then give the related facts. Only if they are unrelated to the topic, reply exactly \"Мэдээлэл олдсонгүй.\".",
}

REWRITE_PROMPT = """Та их сургуулийн дүрэм журмын хайлтын системд зориулж оюутны асуултыг боловсруулдаг туслах юм.
Оюутнууд асуултаа энгийн ярианы хэлээр, товчилсон үгээр, алдаатай, заримдаа англиар бичдэг. Албан ёсны баримт бичиг (гарын авлага, дүрэм, тушаал) нь монгол кирилл, албан хэлээр бичигдсэн.

Даалгавар — ЗӨВХӨН JSON буцаа:
{
  "in_scope": true эсвэл false — асуулт ШУТИС-ийн сургалт, элсэлт, оюутны амьдрал, үйлчилгээ, төлбөр, тэтгэлэг, дүрэм журам, судалгаа, их сургуулийн бүтэц, хөгжлийн төлөвлөгөөтэй холбоотой бол true. Их сургуультай огт хамааралгүй (спорт, хоолны жор, цаг агаар, криптовалют, барааны үнэ, банк, алдартан, ерөнхий мэдлэг, програмчлал г.м.) эсвэл өөр их сургуулийн тухай бол false. Эргэлзвэл true,
  "language": "mn" эсвэл "en"  — оюутны асуултын хэл,
  "query": "…"                 — асуултыг ярианы түүхтэй нь уялдуулан бие даасан, албан ёсны монгол хайлтын асуулт болгон дахин бичсэн хувилбар. Англи бол монгол руу орчуул. Товчлол, үсгэн тэмдэглэгээ (E, U, R, W, GPA, A-, кредит г.м.) -г баримт бичигт хэрэглэдэг бүтэн нэр томьёогоор тайлбарлан нэм (жишээ: "E, U, R тэмдэглэгээ" → "дүнгийн хуудасны E, U, R тэмдэглэгээний утга, үнэлгээний оноо"). Тоо, код, огноог хэвээр хадгал.
  "alternatives": ["…", "…"]   — баримт бичигт байж болох өөр 2 хэллэг, түлхүүр үгсийн хувилбар (монголоор, богино).
}
Тайлбар, markdown, ``` бүү бич. Асуулт аль хэдийн албан ёсны монгол бол query-г бараг хэвээр үлдээ.
Асуултад байхгүй сэдвийг query, alternatives-д бүү нэм. in_scope=false үед асуултыг утгаар нь л монгол руу буулга — "их сургуулийн дүрэм журамд" гэх мэт их сургуулийн утга БҮҮ нэм.

Оюутны үг → баримт бичигт хэрэглэдэг нэр томьёо (query, alternatives-д баримт бичгийн нэр томьёог хэрэглэ):
- midterm, mid-term, quiz, явцын тест → явцын шалгалт, явцын үнэлгээ, багшийн үнэлгээний оноо
- final exam → улирлын шалгалт
- pass, passing grade, not fail → хичээлд тэнцэх, тэнцэх доод оноо, үсгэн үнэлгээний хүснэгт
- fail, F → F үнэлгээ, унасан үнэлгээ
- dorm, dormitory → оюутны байр
- GPA → үнэлгээний голч дүн (GPA)
- kicked out, expelled → сургуулиас хасагдах
- retake → дахин суралцах; withdraw → хичээлээс татгалзах
- branch school, campus → бүрэлдэхүүн сургууль, орон нутаг дахь сургууль
- tuition → сургалтын төлбөр; scholarship → тэтгэлэг; advisor → зөвлөх багш
- program selection, choosing a major (элсэгч) → хөтөлбөр сонголт; course selection → хичээл сонголт (эдгээрийг бүү хольж хэрэглэ)
- skill exam → ур чадварын шалгалт; scaled score → хэмжээст оноо; entrance exam → элсэлтийн ерөнхий шалгалт (ЭЕШ)
Англи хэлц үгийг үгчилж бүү орчуул, утгаар нь ойлго (жишээ: оюутны ярианд "pass the bar", "make the cut" = тэнцэх босго, доод шаардлага)."""

NO_INFO_ANSWER = "Мэдээлэл олдсонгүй."

# Rewrites a follow-up question into a standalone one using the conversation
# history, so retrieval works for turns like "тэгээд?" / "дэлгэрэнгүй".
CONDENSE_PROMPT = """Доор ярианы түүх болон хэрэглэгчийн шинэ асуултыг өгсөн.
Шинэ асуултыг ярианы түүхээс ХАМААРАЛГҮЙГЭЭР бие даан ойлгогдох нэг бүрэн асуулт болгон дахин бич.

ДҮРЭМ:
- Зөвхөн эцсийн бие даасан асуултыг буцаа. Тайлбар, оршил бүү нэм.
- Шинэ асуулт аль хэдийн бие даасан бол яг хэвээр нь буцаа.
- Зөвхөн монгол кирилл үсгээр бич."""

QUOTA_MESSAGE = (
    "Gemini-ийн өдрийн хязгаар дууссан тул одоогоор хариулах боломжгүй, дараа дахин оролдоно уу. "
    "(Daily AI quota reached — please try again later.)"
)


class GeminiQuotaExceeded(RuntimeError):
    """The key's daily Gemini quota is used up. Retrying won't help until it
    resets, and answering "мэдээлэл олдсонгүй" instead would be misleading."""


def _is_daily_quota(exc: errors.ClientError) -> bool:
    return getattr(exc, "code", None) == 429 and "PerDay" in str(getattr(exc, "details", ""))


_client: Optional[genai.Client] = None
_rewrite_model = GEMINI_REWRITE_MODEL


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
    model: str = GEMINI_MODEL,
):
    """Single entry point for Gemini generation with rate-limit resilience.

    - Optionally throttles to `GEMINI_MIN_INTERVAL_SEC` between calls.
    - Retries on 429 RESOURCE_EXHAUSTED with exponential backoff so a free-tier
      quota spike doesn't crash the request. Returns the raw response.
    - A 429 on the *daily* quota raises GeminiQuotaExceeded at once.
    - Retries a 5xx (overloaded model) twice after a short pause.
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
                model=model,
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
            if _is_daily_quota(exc):
                raise GeminiQuotaExceeded(QUOTA_MESSAGE) from exc
            is_rate_limit = getattr(exc, "code", None) == 429
            if is_rate_limit and attempt < max_retries - 1:
                time.sleep(backoff)
                backoff = min(backoff * 2, 90)
                continue
            raise
        except errors.ServerError:
            # 503 "high demand" spikes are short; two quick retries, then give up.
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _guess_language(text: str) -> str:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "mn"
    latin = sum(1 for c in letters if c.isascii())
    return "en" if latin / len(letters) > 0.7 else "mn"


def rewrite_query(question: str, history: Optional[list[dict]] = None) -> dict:
    """Turn the student's message into retrieval-ready queries.

    Returns {"query": str, "alternatives": list[str], "language": "mn"|"en", "in_scope": bool}.
    One call handles translation, abbreviation expansion, slang → formal
    wording, condensing a follow-up against the conversation history, and
    deciding whether the question is about the university at all.
    Falls back to the original question on any failure, so retrieval always
    has something to work with.
    """
    global _rewrite_model
    fallback = {"query": question, "alternatives": [], "language": _guess_language(question), "in_scope": True}
    convo = "\n".join(f"{t['role']}: {t['content']}" for t in (history or [])[-6:])
    user_msg = (f"Ярианы түүх:\n{convo}\n\n" if convo else "") + f"Оюутны асуулт: {question}"
    try:
        try:
            resp = call_gemini(contents=user_msg, system_instruction=REWRITE_PROMPT, max_output_tokens=400, model=_rewrite_model)
        except errors.ClientError as exc:
            # The cheap model may be retired / incompatible on this key → use the main model from now on.
            if getattr(exc, "code", None) not in (400, 404) or _rewrite_model == GEMINI_MODEL:
                raise
            _rewrite_model = GEMINI_MODEL
            resp = call_gemini(contents=user_msg, system_instruction=REWRITE_PROMPT, max_output_tokens=400, model=_rewrite_model)
        data = json.loads(_strip_code_fence(resp.text or ""))
    except GeminiQuotaExceeded:
        raise  # the answer call would fail too; falling back would only produce a false refusal
    except Exception as exc:  # noqa: BLE001 — never let query understanding block the answer
        print(f"[rewrite_query] falling back to raw question: {type(exc).__name__}: {str(exc)[:120]}")
        return fallback
    query = str(data.get("query") or "").strip() or question
    alts = [str(a).strip() for a in (data.get("alternatives") or []) if str(a).strip()][:3]
    language = "en" if str(data.get("language", "")).lower().startswith("en") else "mn"
    # Only an explicit false counts: a missing or malformed flag keeps the question in scope.
    in_scope = str(data.get("in_scope", True)).strip().lower() != "false"
    return {"query": query, "alternatives": alts, "language": language, "in_scope": in_scope}


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


def _source_header(c: dict) -> str:
    """[Эх сурвалж: <title>, х. 4-5 | <section>] — pages/section when known."""
    parts = [c["doc_title"]]
    start, end = c.get("page_start"), c.get("page_end")
    if start:
        parts.append(f"х. {start}" if not end or end == start else f"х. {start}-{end}")
    header = ", ".join(parts)
    if c.get("section"):
        header += f" | {c['section']}"
    return f"[Эх сурвалж: {header}]"


def _build_answer_prompt(question: str, context_chunks: list[dict], original_question: Optional[str] = None) -> str:
    context = "\n\n---\n\n".join(
        f"{_source_header(c)}\n{c['text']}" for c in context_chunks
    )
    asked = f"Оюутны бичсэн асуулт: {original_question}\nАсуултын албан ёсны хэлбэр: {question}" if original_question and original_question != question else f"Асуулт: {question}"
    return f"Эх сурвалж:\n\n{context}\n\n{asked}"


def _system_prompt(language: str) -> str:
    return SYSTEM_PROMPT.format(language_rule=LANGUAGE_RULES.get(language, LANGUAGE_RULES["mn"]))


def stream_answer(question: str, context_chunks: list[dict], language: str = "mn", original_question: Optional[str] = None):
    """Yield the answer as text deltas while Gemini generates it.

    Generator of str pieces. The final item is a dict with usage metadata
    ({"finish_reason", "prompt_tokens", "output_tokens"}) so callers can
    persist the same diagnostics `generate_answer` returns.
    """
    global _last_call_ts
    if _MIN_INTERVAL > 0:
        wait = _MIN_INTERVAL - (time.monotonic() - _last_call_ts)
        if wait > 0:
            time.sleep(wait)

    finish_reason = "unknown"
    usage = None
    try:
        stream = get_client().models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=_build_answer_prompt(question, context_chunks, original_question),
            config=types.GenerateContentConfig(
                system_instruction=_system_prompt(language),
                max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
                temperature=0.0,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        _last_call_ts = time.monotonic()
        for event in stream:
            if event.text:
                yield event.text
            if event.candidates and event.candidates[0].finish_reason:
                finish_reason = str(event.candidates[0].finish_reason)
            if event.usage_metadata:
                usage = event.usage_metadata
    except errors.ClientError as exc:
        if _is_daily_quota(exc):
            raise GeminiQuotaExceeded(QUOTA_MESSAGE) from exc
        raise

    yield {
        "finish_reason": finish_reason,
        "prompt_tokens": usage.prompt_token_count if usage else None,
        "output_tokens": usage.candidates_token_count if usage else None,
    }


def generate_answer(question: str, context_chunks: list[dict], language: str = "mn", original_question: Optional[str] = None) -> dict:
    """Send question + retrieved chunks to Gemini. Returns dict with answer text
    and usage metadata.

    context_chunks: list of dicts with `text`, `doc_title` and optionally
    `section`, `page_start`, `page_end`.
    """
    resp = call_gemini(
        contents=_build_answer_prompt(question, context_chunks, original_question),
        system_instruction=_system_prompt(language),
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
