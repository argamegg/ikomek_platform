import asyncio
from typing import Optional

import httpx
from langdetect import LangDetectException, detect

MYMEMORY_API_URL = "https://api.mymemory.translated.net/get"
LIBRETRANSLATE_API_URL = "https://libretranslate.com/translate"
TRANSLATION_TIMEOUT_SECONDS = 30.0
TRANSLATION_RETRY_ATTEMPTS = 3
TRANSLATION_RETRY_DELAY_SECONDS = 1.0
TRANSLATION_SEQUENCE_DELAY_SECONDS = 0.5


def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "ru"

    try:
        lang = detect(text)
        if lang in {"kk", "kz"}:
            return "kk"
        if lang == "en":
            return "en"
        return "ru"
    except LangDetectException:
        return "ru"


def _normalize_translation_code(language: str) -> str:
    return "kk" if language in {"kz", "kk"} else language


async def translate_mymemory(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    if not text or not text.strip():
        return text

    source_lang = _normalize_translation_code(source_lang)
    target_lang = _normalize_translation_code(target_lang)

    async with httpx.AsyncClient(timeout=TRANSLATION_TIMEOUT_SECONDS) as client:
        for attempt in range(TRANSLATION_RETRY_ATTEMPTS):
            try:
                response = await client.get(
                    MYMEMORY_API_URL,
                    params={
                        "q": text,
                        "langpair": f"{source_lang}|{target_lang}",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("responseStatus") == 200:
                        return data.get("responseData", {}).get("translatedText") or None
            except (httpx.TimeoutException, httpx.RequestError, ValueError):
                pass

            if attempt < TRANSLATION_RETRY_ATTEMPTS - 1:
                await asyncio.sleep(TRANSLATION_RETRY_DELAY_SECONDS)

    return None


async def translate_libretranslate(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    if not text or not text.strip():
        return text

    source_lang = _normalize_translation_code(source_lang)
    target_lang = _normalize_translation_code(target_lang)

    async with httpx.AsyncClient(timeout=TRANSLATION_TIMEOUT_SECONDS) as client:
        for attempt in range(TRANSLATION_RETRY_ATTEMPTS):
            try:
                response = await client.post(
                    LIBRETRANSLATE_API_URL,
                    json={
                        "q": text,
                        "source": source_lang,
                        "target": target_lang,
                        "format": "text",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    translated = data.get("translatedText")
                    if translated:
                        return translated
            except (httpx.TimeoutException, httpx.RequestError, ValueError):
                pass

            if attempt < TRANSLATION_RETRY_ATTEMPTS - 1:
                await asyncio.sleep(TRANSLATION_RETRY_DELAY_SECONDS)

    return None


async def translate_with_fallback(text: str, source_lang: str, target_lang: str) -> str:
    source_lang = _normalize_translation_code(source_lang)
    target_lang = _normalize_translation_code(target_lang)

    if not text or not text.strip() or source_lang == target_lang:
        return text

    result = await translate_mymemory(text, source_lang, target_lang)
    if result is None:
        result = await translate_libretranslate(text, source_lang, target_lang)
    return result or text


async def translate_text(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    return await translate_with_fallback(text, source_lang, target_lang)


async def translate_to_all_languages(text: str, source_lang: str) -> dict[str, str]:
    source_lang = _normalize_translation_code(source_lang)
    targets = ["ru", "kk", "en"]
    result: dict[str, str] = {}

    for target in targets:
        if target == source_lang:
            result[target] = text
        else:
            result[target] = await translate_with_fallback(text, source_lang, target)
            if text and text.strip():
                await asyncio.sleep(TRANSLATION_SEQUENCE_DELAY_SECONDS)

    return result
