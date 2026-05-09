from typing import Optional

import httpx

MYMEMORY_API_URL = "https://api.mymemory.translated.net/get"


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
