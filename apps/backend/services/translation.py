from typing import Optional

import httpx
from langdetect import LangDetectException, detect

MYMEMORY_API_URL = "https://api.mymemory.translated.net/get"


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


async def translate_text(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    if not text or not text.strip():
        return text

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                MYMEMORY_API_URL,
                params={
                    "q": text,
                    "langpair": f"{source_lang}|{target_lang}",
                },
            )
            data = response.json()
            if data.get("responseStatus") == 200:
                return data.get("responseData", {}).get("translatedText") or text
            return text
    except Exception:
        return text


async def translate_to_all_languages(text: str, source_lang: str) -> dict[str, str]:
    targets = ["ru", "kk", "en"]
    result: dict[str, str] = {}

    for target in targets:
        if target == source_lang:
            result[target] = text
        else:
            result[target] = await translate_text(text, source_lang, target) or text

    return result
