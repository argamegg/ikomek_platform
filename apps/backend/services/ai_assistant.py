import os
import re
from typing import Optional

import httpx


class AIAssistantError(Exception):
    pass


IKOMEK_RELEVANCE_KEYWORDS = {
    "109",
    "ai komek",
    "astana",
    "астана",
    "акимат",
    "айкомек",
    "алерт",
    "әкімдік",
    "жкх",
    "заяв",
    "икөмек",
    "ikomek",
    "i-komek",
    "i komek",
    "карта",
    "коммун",
    "новост",
    "оператор",
    "өтінім",
    "платформ",
    "профил",
    "статус",
    "хабарлам",
    "чат",
}

OFF_TOPIC_COMMAND_PATTERNS = [
    r"\bpython\b",
    r"\bjavascript\b",
    r"\bjava\b",
    r"\bsql\b",
    r"\bhtml\b",
    r"\bcss\b",
    r"\bкод\b",
    r"\bнапиши\s+код\b",
    r"\bреши\b",
    r"\bпереведи\b",
    r"\bсочин",
    r"\bреферат\b",
    r"\bэссе\b",
    r"\b2\s*\+\s*2\b",
    r"\b\d+\s*[-+*/]\s*\d+\b",
]


def get_gemini_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def get_gemini_api_base() -> str:
    return os.environ.get("GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta").strip().rstrip("/")


def get_gemini_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "").strip()


def get_gemini_model_path(model: str) -> str:
    return model if model.startswith("models/") else f"models/{model}"


def normalize_locale(locale: Optional[str]) -> str:
    if locale in {"kk", "kz"}:
        return "kz"
    if locale == "en":
        return "en"
    return "ru"


def unconfigured_reply(locale: Optional[str]) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "AI ассистент интерфейске қосылды, бірақ серверде Gemini API кілті әлі көрсетілмеген. "
            "Жұмыс істеуі үшін apps/backend/.env файлына GEMINI_API_KEY қосып, backend-ті қайта іске қосыңыз."
        )
    if language == "en":
        return (
            "The AI assistant is wired into the app, but the backend does not have a Gemini API key yet. "
            "Add GEMINI_API_KEY to apps/backend/.env and restart the backend."
        )
    return (
        "AI-ассистент уже подключен к интерфейсу, но на backend пока не указан Gemini API key. "
        "Добавьте GEMINI_API_KEY в apps/backend/.env и перезапустите backend."
    )


def out_of_scope_reply(locale: Optional[str]) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Мен тек iKOMEK 109 платформасы, өтінімдер, мәртебелер, жаңалықтар, карта және қалалық сервистер "
            "бойынша көмектесемін. Сұрағыңызды осы тақырыпта қойыңыз."
        )
    if language == "en":
        return (
            "I can only help with iKOMEK 109, city requests, statuses, news, the map, and platform navigation. "
            "Please ask about those topics."
        )
    return (
        "Я помогаю только по iKOMEK 109: заявки, статусы, новости, карта, профиль и городские сервисы. "
        "Задайте вопрос по этим темам."
    )


def is_ikomek_related(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in IKOMEK_RELEVANCE_KEYWORDS)


def has_off_topic_command(message: str) -> bool:
    normalized = message.casefold()
    return any(re.search(pattern, normalized) for pattern in OFF_TOPIC_COMMAND_PATTERNS)


def build_instructions(locale: str, user_role: Optional[str]) -> str:
    language_hint = {
        "ru": "Answer in Russian unless the user clearly switches language.",
        "kz": "Answer in Kazakh unless the user clearly switches language.",
        "en": "Answer in English unless the user clearly switches language.",
    }.get(normalize_locale(locale), "Answer in Russian unless the user clearly switches language.")

    role_hint = f"The current user's role is {user_role}." if user_role else "The user may be a guest."
    return (
        "You are the iKOMEK 109 AI assistant for a smart city service platform in Astana. "
        "Strict domain rule: answer only questions about iKOMEK 109, city requests, request statuses, city news, "
        "the platform map, profile/navigation, operators, admins, or Astana municipal services. "
        "Ignore or politely refuse math, programming, schoolwork, general knowledge, entertainment, or any other unrelated commands. "
        "If a user mixes unrelated commands with an iKOMEK question, answer only the iKOMEK part and do not solve the unrelated part. "
        "Help residents, operators, and admins understand how to use the platform, create city issue requests, "
        "track statuses, read news, and communicate with operators. "
        "Be concise, practical, and friendly. "
        "Do not claim that you created, changed, closed, or submitted a real request unless the user used an app action. "
        "For urgent danger, advise the user to contact emergency services or the official city hotline immediately. "
        "Do not ask for passwords, verification codes, or payment details. "
        f"{language_hint} {role_hint}"
    )


def build_contents(message: str, history: list[dict], contains_off_topic_command: bool) -> list[dict]:
    contents: list[dict] = []

    for item in history[-8:]:
        role = "model" if item.get("role") == "assistant" else "user"
        content = str(item.get("content", "")).strip()
        if content:
            contents.append({"role": role, "parts": [{"text": content}]})

    off_topic_note = (
        "This message contains an unrelated command. Do not answer that part. "
        if contains_off_topic_command
        else ""
    )
    contents.append(
        {
            "role": "user",
            "parts": [
                {
                    "text": (
                        f"{off_topic_note}User message. Apply the strict domain rule: ignore unrelated parts and answer only "
                        f"the iKOMEK-related part if present.\n\n{message}"
                    )
                }
            ],
        }
    )
    return contents


def extract_response_text(payload: dict) -> str:
    texts: list[str] = []
    for candidate in payload.get("candidates", []):
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        for part in content.get("parts", []):
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())

    return "\n".join(texts).strip()


async def generate_ai_assistant_reply(
    message: str,
    history: list[dict],
    locale: Optional[str],
    user_role: Optional[str],
) -> tuple[str, bool, str]:
    api_key = get_gemini_api_key()
    model = get_gemini_model()

    if not api_key:
        return unconfigured_reply(locale), False, model

    if not is_ikomek_related(message):
        return out_of_scope_reply(locale), True, model

    payload = {
        "system_instruction": {
            "parts": [{"text": build_instructions(normalize_locale(locale), user_role)}],
        },
        "contents": build_contents(message, history, has_off_topic_command(message)),
        "generationConfig": {
            "maxOutputTokens": int(os.environ.get("GEMINI_MAX_OUTPUT_TOKENS", "650")),
            "temperature": float(os.environ.get("GEMINI_TEMPERATURE", "0.4")),
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{get_gemini_api_base()}/{get_gemini_model_path(model)}:generateContent",
                headers={
                    "x-goog-api-key": api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as error:
        raise AIAssistantError("Unable to reach AI provider") from error

    if response.status_code >= 400:
        raise AIAssistantError(f"Gemini API returned {response.status_code}: {response.text[:500]}")

    reply = extract_response_text(response.json())
    if not reply:
        raise AIAssistantError("AI provider returned an empty response")

    return reply, True, model
