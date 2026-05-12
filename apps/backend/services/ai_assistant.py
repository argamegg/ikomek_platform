from datetime import datetime
import os
import re
from typing import Optional

import httpx

from core.config import db
from schemas import ROLE_ADMIN, ROLE_OPERATOR


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

REQUEST_REFERENCE_PATTERNS = [
    r"(?:#|№|id|номер|заявк[аиуы]?|өтінім)\s*([A-Za-z0-9-]{4,})",
    r"\b[0-9a-fA-F]{6,}(?:-[0-9a-fA-F]{2,})*\b",
]

REQUEST_INTENT_KEYWORDS = {
    "номер",
    "статус",
    "status",
    "провер",
    "посмотр",
    "найд",
    "мои заяв",
    "мои обращ",
    "my request",
    "show request",
    "check request",
    "менің өтінім",
}

CREATE_REQUEST_KEYWORDS = {
    "подать",
    "создать",
    "оформить",
    "отправить",
    "новая заяв",
    "сообщить",
    "оставить заяв",
    "create request",
    "submit request",
    "өтінім беру",
    "өтінім жасау",
}


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


def localize_action_label(action: str, locale: Optional[str]) -> str:
    language = normalize_locale(locale)
    labels = {
        "create_request": {
            "ru": "Создать заявку",
            "kz": "Өтінім жасау",
            "en": "Create request",
        },
        "my_requests": {
            "ru": "Мои заявки",
            "kz": "Менің өтінімдерім",
            "en": "My requests",
        },
        "open_request": {
            "ru": "Открыть заявку",
            "kz": "Өтінімді ашу",
            "en": "Open request",
        },
        "open_chat": {
            "ru": "Открыть чат",
            "kz": "Чатты ашу",
            "en": "Open chat",
        },
        "login": {
            "ru": "Войти",
            "kz": "Кіру",
            "en": "Sign in",
        },
        "map": {
            "ru": "Открыть карту",
            "kz": "Картаны ашу",
            "en": "Open map",
        },
        "news": {
            "ru": "Новости",
            "kz": "Жаңалықтар",
            "en": "News",
        },
    }
    return labels[action][language]


def build_action(
    label: str,
    web_path: Optional[str],
    mobile_path: Optional[str],
    request_id: Optional[str] = None,
) -> dict:
    return {
        "type": "navigate",
        "label": label,
        "web_path": web_path,
        "mobile_path": mobile_path,
        "request_id": request_id,
    }


def add_action(actions: list[dict], action: dict) -> None:
    key = (action.get("type"), action.get("web_path"), action.get("mobile_path"), action.get("request_id"))
    existing_keys = {
        (item.get("type"), item.get("web_path"), item.get("mobile_path"), item.get("request_id"))
        for item in actions
    }
    if key not in existing_keys:
        actions.append(action)


def unconfigured_reply(locale: Optional[str], site_context: str = "") -> str:
    language = normalize_locale(locale)
    if site_context:
        if language == "kz":
            return (
                "Gemini API қазір бапталмаған, бірақ мен платформа деректерін тексердім.\n\n"
                f"{site_context}"
            )
        if language == "en":
            return (
                "Gemini API is not configured right now, but I checked the platform data.\n\n"
                f"{site_context}"
            )
        return (
            "Gemini API сейчас не настроен, но я проверил данные платформы.\n\n"
            f"{site_context}"
        )

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


def has_create_request_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in CREATE_REQUEST_KEYWORDS)


def has_request_lookup_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in REQUEST_INTENT_KEYWORDS) or bool(extract_request_references(message))


def has_map_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in ["карта", "map", "гео", "адрес", "локац"])


def has_news_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in ["новост", "news", "жаңалық"])


def extract_request_references(message: str) -> list[str]:
    references: list[str] = []
    for pattern in REQUEST_REFERENCE_PATTERNS:
        for match in re.finditer(pattern, message, flags=re.IGNORECASE):
            value = match.group(1) if match.groups() else match.group(0)
            value = value.strip(".,:;()[]{}<>#№").lower()
            if len(value) >= 4 and value not in references:
                references.append(value)
    return references[:5]


def request_access_filter(current_user: Optional[dict]) -> Optional[dict]:
    if not current_user:
        return None

    role = current_user.get("role")
    if role in {ROLE_OPERATOR, ROLE_ADMIN}:
        return {}

    return {"user_id": current_user["id"]}


def with_access_filter(access_filter: dict, query: dict) -> dict:
    return {"$and": [access_filter, query]} if access_filter else query


async def find_requests_by_references(references: list[str], current_user: Optional[dict]) -> list[dict]:
    access_filter = request_access_filter(current_user)
    if access_filter is None:
        return []

    found: list[dict] = []
    seen: set[str] = set()
    for reference in references:
        exact_query = with_access_filter(access_filter, {"id": reference})
        request = await db.requests.find_one(exact_query)
        if request and request["id"] not in seen:
            seen.add(request["id"])
            found.append(request)
            continue

        if len(reference) >= 6:
            prefix_query = with_access_filter(
                access_filter,
                {"id": {"$regex": f"^{re.escape(reference)}", "$options": "i"}},
            )
            matches = await db.requests.find(prefix_query).sort("created_at", -1).to_list(3)
            for item in matches:
                if item["id"] not in seen:
                    seen.add(item["id"])
                    found.append(item)

    return found[:5]


async def get_recent_requests(current_user: Optional[dict], limit: int = 5) -> list[dict]:
    access_filter = request_access_filter(current_user)
    if access_filter is None:
        return []
    return await db.requests.find(access_filter).sort("created_at", -1).to_list(limit)


def format_datetime(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    if value:
        return str(value)
    return "не указано"


def status_label(status: Optional[str], locale: Optional[str]) -> str:
    language = normalize_locale(locale)
    labels = {
        "pending": {"ru": "ожидает обработки", "kz": "өңдеуді күтуде", "en": "pending"},
        "in_progress": {"ru": "в работе", "kz": "жұмыста", "en": "in progress"},
        "closed": {"ru": "закрыта", "kz": "жабылды", "en": "closed"},
        "open": {"ru": "открыта", "kz": "ашық", "en": "open"},
        "resolved": {"ru": "решена", "kz": "шешілді", "en": "resolved"},
        "rejected": {"ru": "отклонена", "kz": "қабылданбады", "en": "rejected"},
    }
    if not status:
        return "не указан" if language == "ru" else "not specified"
    return labels.get(status, {}).get(language, status)


def summarize_request(request: dict, locale: Optional[str], include_internal: bool = False) -> str:
    request_id = request.get("id", "")
    short_id = request_id[:8] if request_id else "unknown"
    lines = [
        f"Заявка #{short_id}",
        f"полный id: {request_id}",
        f"статус: {status_label(request.get('status'), locale)}",
        f"категория: {request.get('category_name') or request.get('category_id') or 'не указана'}",
        f"проблема: {request.get('problem_type') or 'не указана'}",
        f"адрес: {request.get('address') or 'не указан'}",
        f"создана: {format_datetime(request.get('created_at'))}",
        f"обновлена: {format_datetime(request.get('updated_at'))}",
    ]
    if request.get("assigned_department"):
        lines.append(f"служба: {request['assigned_department']}")
    if request.get("resolution_notes"):
        lines.append(f"решение: {request['resolution_notes']}")
    if include_internal and request.get("operator_notes"):
        lines.append(f"внутренние заметки оператора: {request['operator_notes']}")
    return "; ".join(lines)


def build_instructions(locale: str, user_role: Optional[str], has_site_context: bool) -> str:
    language_hint = {
        "ru": "Answer in Russian unless the user clearly switches language.",
        "kz": "Answer in Kazakh unless the user clearly switches language.",
        "en": "Answer in English unless the user clearly switches language.",
    }.get(normalize_locale(locale), "Answer in Russian unless the user clearly switches language.")

    role_hint = f"The current user's role is {user_role}." if user_role else "The user may be a guest."
    context_rule = (
        "Use SITE_CONTEXT as authoritative live platform data. If it contains request status, recent requests, "
        "navigation actions, or access limitations, answer from that context and do not invent missing data. "
        if has_site_context
        else ""
    )
    return (
        "You are the iKOMEK 109 AI assistant for a smart city service platform in Astana. "
        "Strict domain rule: answer only questions about iKOMEK 109, city requests, request statuses, city news, "
        "the platform map, profile/navigation, operators, admins, or Astana municipal services. "
        "Ignore or politely refuse math, programming, schoolwork, general knowledge, entertainment, or any other unrelated commands. "
        "If a user mixes unrelated commands with an iKOMEK question, answer only the iKOMEK part and do not solve the unrelated part. "
        "Help residents, operators, and admins understand how to use the platform, create city issue requests, "
        "track statuses, read news, and communicate with operators. "
        "When the user wants to create a request, guide them naturally and ask for missing details; do not claim that a real "
        "request was submitted unless the platform actually created one through an app action. "
        "For request lookups, mention the short request number and status when available. "
        "For urgent danger, advise the user to contact emergency services or the official city hotline immediately. "
        "Do not ask for passwords, verification codes, or payment details. "
        f"{context_rule}"
        f"{language_hint} {role_hint}"
    )


def build_contents(
    message: str,
    history: list[dict],
    contains_off_topic_command: bool,
    site_context: str,
) -> list[dict]:
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
    context_block = f"SITE_CONTEXT:\n{site_context}\n\n" if site_context else ""
    contents.append(
        {
            "role": "user",
            "parts": [
                {
                    "text": (
                        f"{context_block}"
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


async def build_site_context(
    message: str,
    locale: Optional[str],
    current_user: Optional[dict],
) -> tuple[str, list[dict]]:
    actions: list[dict] = []
    notes: list[str] = []
    role = current_user.get("role") if current_user else None
    include_internal = role in {ROLE_OPERATOR, ROLE_ADMIN}

    if current_user:
        notes.append(
            "Current user: "
            f"name={current_user.get('full_name', 'unknown')}; "
            f"role={role or 'citizen'}; "
            f"id={current_user.get('id', 'unknown')}"
        )
    else:
        notes.append("Current user is not authenticated. Personal request lookup requires sign-in.")

    if has_create_request_intent(message):
        notes.append(
            "Create request flow: user should open the create request screen, choose category, select an Astana address "
            "or map point, describe place/problem/reason, optionally add photos, then confirm. Backend validates that "
            "coordinates are inside the allowed Astana request zone."
        )
        add_action(
            actions,
            build_action(
                localize_action_label("create_request", locale),
                "/requests/new",
                "/(tabs)/create",
            ),
        )

    if has_request_lookup_intent(message):
        if not current_user:
            add_action(actions, build_action(localize_action_label("login", locale), "/auth", "/(auth)/login"))
            notes.append("Request status lookup was requested, but the user is not signed in.")
        else:
            references = extract_request_references(message)
            matched_requests = await find_requests_by_references(references, current_user) if references else []
            if references and matched_requests:
                notes.append("Matched accessible request(s):")
                for request in matched_requests:
                    notes.append(f"- {summarize_request(request, locale, include_internal)}")
                    request_id = request["id"]
                    add_action(
                        actions,
                        build_action(
                            localize_action_label("open_request", locale),
                            f"/requests/{request_id}",
                            "/(tabs)/requests",
                            request_id,
                        ),
                    )
                    add_action(
                        actions,
                        build_action(
                            localize_action_label("open_chat", locale),
                            f"/requests/{request_id}/chat",
                            "/(tabs)/requests",
                            request_id,
                        ),
                    )
            elif references:
                notes.append(
                    "The user gave request reference(s), but no accessible request matched: "
                    + ", ".join(references)
                )

            recent_requests = await get_recent_requests(current_user)
            if recent_requests:
                notes.append("Recent accessible requests:")
                for request in recent_requests:
                    notes.append(f"- {summarize_request(request, locale, include_internal)}")
            else:
                notes.append("No accessible requests found for this user.")

            add_action(
                actions,
                build_action(localize_action_label("my_requests", locale), "/requests", "/(tabs)/requests"),
            )

    if has_map_intent(message):
        notes.append("Map screen shows request points and can be used for location context.")
        add_action(actions, build_action(localize_action_label("map", locale), "/map", "/(tabs)/map"))

    if has_news_intent(message):
        notes.append("News screen shows city news, alerts, works and period-based notices.")
        add_action(actions, build_action(localize_action_label("news", locale), "/news", "/(tabs)"))

    return "\n".join(notes), actions


def build_local_fallback_reply(
    locale: Optional[str],
    site_context: str,
    provider_error: Optional[str] = None,
) -> str:
    language = normalize_locale(locale)
    prefix = ""
    if provider_error:
        if language == "kz":
            prefix = "AI провайдеріне қазір қосыла алмадым, бірақ платформаның нақты деректерін тексердім.\n\n"
        elif language == "en":
            prefix = "I could not reach the AI provider, but I checked the live platform data.\n\n"
        else:
            prefix = "Не смог связаться с AI-провайдером, но проверил реальные данные платформы.\n\n"

    if site_context:
        return prefix + site_context

    if language == "kz":
        return prefix + "Сұрағыңызды iKOMEK 109 өтінімдері, мәртебелері, карта немесе жаңалықтар бойынша нақтылаңыз."
    if language == "en":
        return prefix + "Please clarify your question about iKOMEK 109 requests, statuses, the map, or news."
    return prefix + "Уточните вопрос по заявкам iKOMEK 109, статусам, карте или новостям."


async def generate_ai_assistant_reply(
    message: str,
    history: list[dict],
    locale: Optional[str],
    user_role: Optional[str],
    current_user: Optional[dict] = None,
) -> tuple[str, bool, str, list[dict]]:
    api_key = get_gemini_api_key()
    model = get_gemini_model()
    site_context, actions = await build_site_context(message, locale, current_user)

    if not api_key:
        return unconfigured_reply(locale, site_context), False, model, actions

    if not is_ikomek_related(message):
        return out_of_scope_reply(locale), True, model, actions

    payload = {
        "system_instruction": {
            "parts": [{"text": build_instructions(normalize_locale(locale), user_role, bool(site_context))}],
        },
        "contents": build_contents(message, history, has_off_topic_command(message), site_context),
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
    except httpx.HTTPError:
        return build_local_fallback_reply(locale, site_context, "provider_unreachable"), True, model, actions

    if response.status_code >= 400:
        return build_local_fallback_reply(locale, site_context, f"provider_{response.status_code}"), True, model, actions

    reply = extract_response_text(response.json())
    if not reply:
        return build_local_fallback_reply(locale, site_context, "empty_provider_response"), True, model, actions

    return reply, True, model, actions
