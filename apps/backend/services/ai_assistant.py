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
    "адрес",
    "обращ",
    "әкімдік",
    "жкх",
    "заяв",
    "икөмек",
    "ikomek",
    "i-komek",
    "i komek",
    "карта",
    "настро",
    "коммун",
    "новост",
    "оператор",
    "парол",
    "password",
    "request",
    "settings",
    "өтінім",
    "өтініш",
    "платформ",
    "профил",
    "статус",
    "сурет",
    "фото",
    "language",
    "язык",
    "тіл",
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
    "как сделать обращ",
    "как сделать заяв",
    "как создать обращ",
    "как создать заяв",
    "как подать обращ",
    "как подать заяв",
    "сделать обращ",
    "сделать заяв",
    "создать обращ",
    "создать заяв",
    "подать обращ",
    "подать заяв",
    "оформить обращ",
    "оформить заяв",
    "оставить обращ",
    "оставить заяв",
    "подать",
    "создать",
    "оформить",
    "отправить",
    "новая заяв",
    "сообщить",
    "create request",
    "make request",
    "submit request",
    "how to create a request",
    "how to submit a request",
    "өтінім беру",
    "өтінім жасау",
    "өтініш беру",
    "өтініш жасау",
}

GREETING_KEYWORDS = {
    "привет",
    "здравств",
    "добрый день",
    "доброе утро",
    "добрый вечер",
    "салам",
    "сәлем",
    "салем",
    "hello",
    "hi",
    "hey",
}

SETTINGS_KEYWORDS = {
    "где настройки",
    "где находятся настройки",
    "настройк",
    "параметр",
    "settings",
    "setting",
    "баптау",
    "баптаулар",
    "батпаулар",
}

PROFILE_KEYWORDS = {
    "профил",
    "кабинет",
    "аккаунт",
    "личные данные",
    "данные профиля",
    "profile",
    "account",
    "жеке кабинет",
    "жеке дерек",
}

PROFILE_PHOTO_KEYWORDS = {
    "изменить фото",
    "поменять фото",
    "загрузить фото",
    "удалить фото",
    "фото",
    "фотка",
    "фотку",
    "фота",
    "аватар",
    "фотограф",
    "photo",
    "avatar",
    "profile picture",
    "сурет",
    "сурет ауыстыру",
    "сурет өзгерту",
    "фото ауыстыру",
    "фото өзгерту",
}

LANGUAGE_KEYWORDS = {
    "язык",
    "перевод",
    "language",
    "тіл",
    "қазақ",
    "english",
    "русский",
}

PASSWORD_KEYWORDS = {
    "пароль",
    "сменить пароль",
    "password",
    "құпия сөз",
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
        "settings": {
            "ru": "Открыть настройки",
            "kz": "Баптауларды ашу",
            "en": "Open settings",
        },
        "profile": {
            "ru": "Открыть профиль",
            "kz": "Профильді ашу",
            "en": "Open profile",
        },
        "edit_profile": {
            "ru": "Редактировать профиль",
            "kz": "Профильді өңдеу",
            "en": "Edit profile",
        },
        "change_photo": {
            "ru": "Изменить фото",
            "kz": "Фотоны өзгерту",
            "en": "Change photo",
        },
        "add_request_photo": {
            "ru": "Открыть мои заявки",
            "kz": "Менің өтінімдерімді ашу",
            "en": "Open my requests",
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
    if has_user_facing_site_context(site_context):
        if language == "kz":
            return (
                "Gemini API қазір бапталмаған, бірақ мен платформа деректерін тексердім.\n\n"
                f"{user_facing_site_context(site_context)}"
            )
        if language == "en":
            return (
                "Gemini API is not configured right now, but I checked the platform data.\n\n"
                f"{user_facing_site_context(site_context)}"
            )
        return (
            "Gemini API сейчас не настроен, но я проверил данные платформы.\n\n"
            f"{user_facing_site_context(site_context)}"
        )

    if language == "kz":
        return (
            "Сұрағыңызды сәл нақтырақ жазыңыз: өтінім жасау, мәртебені тексеру, мекенжайды өзгерту, "
            "фото қосу, карта, жаңалықтар немесе баптаулар бойынша көмектесе аламын."
        )
    if language == "en":
        return (
            "Please make your question a little more specific. I can help with creating a request, checking status, "
            "changing an address, adding a photo, the map, news, or settings."
        )
    return (
        "Уточните вопрос немного конкретнее. Я могу помочь с созданием заявки, проверкой статуса, "
        "изменением адреса, добавлением фото, картой, новостями или настройками."
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


def create_request_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)

    if language == "kz":
        auth_note = (
            "Егер аккаунтыңызға кіріп тұрсаңыз, өтінімді бірден жіберуге болады."
            if authenticated
            else "Өтінім жіберу үшін алдымен аккаунтқа кіріңіз немесе тіркеліңіз."
        )
        return (
            "iKOMEK арқылы өтінім жасау үшін мына қадамдарды орындаңыз:\n\n"
            "1. Төмендегі “Өтінім жасау” батырмасын басыңыз немесе мәзірден жаңа өтінім бетіне өтіңіз.\n"
            "2. Мәселенің санатын таңдаңыз: қоқыс, жарық, су, жылыту, жол, кәріз немесе қоғамдық тәртіп.\n"
            "3. Мекенжайды енгізіңіз немесе картадан нүктені таңдаңыз. Жүйе нүктенің Астана аймағында екенін тексереді.\n"
            "4. Себебін және нақты орнын көрсетіңіз: аула, кіреберіс, көше, тұрақ, пәтер және т.б.\n"
            "5. Қысқаша, бірақ түсінікті сипаттама жазыңыз: не болды, қашан байқадыңыз, қаншалықты шұғыл.\n"
            "6. Қаласаңыз, фото қосыңыз. Фото операторға мәселені тезірек түсінуге көмектеседі.\n"
            "7. Соңғы тексеру экранында деректерді қарап, өтінімді жіберіңіз.\n\n"
            f"{auth_note} Жіберілгеннен кейін өтінімді “Менің өтінімдерім” бөлімінен бақылап, қажет болса чат арқылы операторға жаза аласыз."
        )

    if language == "en":
        auth_note = (
            "If you are signed in, you can submit it right away."
            if authenticated
            else "To submit the request, sign in or create an account first."
        )
        return (
            "Here is how to create a request in iKOMEK:\n\n"
            "1. Click “Create request” below or open the new request page from the menu.\n"
            "2. Choose the issue category: waste, lighting, water, heating, roads, sewage, or public order.\n"
            "3. Enter the address or pick the point on the map. The platform checks that the location is inside the Astana service zone.\n"
            "4. Select the reason and specify the exact place: yard, entrance, street, parking, apartment, and so on.\n"
            "5. Write a clear short description: what happened, when you noticed it, and whether it is urgent.\n"
            "6. Add photos if you have them. They help the operator understand the situation faster.\n"
            "7. Review the summary and submit the request.\n\n"
            f"{auth_note} After submission, you can track the status in “My requests” and message the operator in the request chat."
        )

    auth_note = (
        "Если вы уже вошли в аккаунт, обращение можно отправить сразу."
        if authenticated
        else "Чтобы отправить обращение, сначала войдите в аккаунт или зарегистрируйтесь."
    )
    return (
        "Чтобы сделать обращение в iKOMEK, действуйте так:\n\n"
        "1. Нажмите кнопку “Создать заявку” ниже или откройте страницу нового обращения в меню.\n"
        "2. Выберите категорию проблемы: мусор, освещение, вода, отопление, дороги, канализация или общественный порядок.\n"
        "3. Укажите адрес или выберите точку на карте. Платформа проверит, что точка находится в зоне обслуживания Астаны.\n"
        "4. Выберите причину и уточните место: двор, подъезд, улица, паркинг, квартира и так далее.\n"
        "5. Напишите понятное описание: что случилось, когда заметили, насколько это срочно.\n"
        "6. Если есть фото, добавьте их. Так оператор быстрее поймет проблему.\n"
        "7. На финальном экране проверьте данные и отправьте обращение.\n\n"
        f"{auth_note} После отправки вы сможете отслеживать статус в разделе “Мои заявки” и писать оператору в чате обращения."
    )


def my_requests_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Өз өтінімдеріңізді “Менің өтінімдерім” бөлімінен көре аласыз.\n\n"
            "Онда әр өтінімнің мәртебесі, күні, мекенжайы және қысқаша сипаттамасы көрсетіледі. "
            "Керек өтінімді бассаңыз, толық ақпарат пен оператор чаты ашылады.\n\n"
            f"{'Алдымен аккаунтқа кіріңіз, сонда жеке өтінімдеріңіз көрінеді.' if not authenticated else 'Төмендегі батырма сіздің өтінімдер тізіміңізді ашады.'}"
        )
    if language == "en":
        return (
            "You can view your requests in the “My requests” section.\n\n"
            "Each card shows the status, date, address, and short description. Open a request to see details and use the operator chat.\n\n"
            f"{'Sign in first to see your personal requests.' if not authenticated else 'Use the button below to open your request list.'}"
        )
    return (
        "Свои заявки можно посмотреть в разделе “Мои заявки”.\n\n"
        "Там каждая карточка показывает статус, дату, адрес и краткое описание. "
        "Нажмите на нужную заявку, чтобы открыть детали, посмотреть историю и перейти в чат с оператором.\n\n"
        f"{'Если вы ещё не вошли, сначала авторизуйтесь: личные заявки доступны только в аккаунте.' if not authenticated else 'Нажмите кнопку ниже, чтобы открыть список ваших заявок.'}"
    )


def request_status_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Өтінім мәртебесін “Менің өтінімдерім” бөлімінен тексеруге болады.\n\n"
            "Тізімнен қажет өтінімді табыңыз: карточкада мәртебе бірден көрінеді. Толық ақпарат үшін өтінімді ашыңыз. "
            "Егер түсініктеме керек болса, сол өтінімнің чатында операторға жаза аласыз.\n\n"
            f"{'Жеке мәртебені көру үшін аккаунтқа кіріңіз.' if not authenticated else 'Төмендегі батырма өтінімдер тізімін ашады.'}"
        )
    if language == "en":
        return (
            "You can check a request status in “My requests”.\n\n"
            "Find the needed request in the list: the status is shown on the card. Open it for full details and use the request chat if you need clarification from an operator.\n\n"
            f"{'Sign in first to view your personal statuses.' if not authenticated else 'Use the button below to open your requests.'}"
        )
    return (
        "Статус заявки проверяется в разделе “Мои заявки”.\n\n"
        "Найдите нужную заявку в списке: статус будет указан прямо на карточке. "
        "Если открыть заявку, вы увидите подробности, историю обработки и сможете написать оператору в чат.\n\n"
        f"{'Чтобы увидеть свои статусы, сначала войдите в аккаунт.' if not authenticated else 'Кнопка ниже откроет ваши заявки.'}"
    )


def request_address_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Мекенжайды өзгерту өтінімнің кезеңіне байланысты.\n\n"
            "Егер өтінімді әлі жібермеген болсаңыз, жасау формасында мекенжайды қайта енгізіңіз немесе картадан басқа нүкте таңдаңыз. "
            "Егер өтінім жіберілген болса, оны ашып, чат арқылы операторға дұрыс мекенжайды жазыңыз.\n\n"
            f"{'Жіберілген өтінімді ашу үшін аккаунтқа кіріңіз.' if not authenticated else 'Төмендегі батырма сіздің өтінімдеріңізді ашады.'}"
        )
    if language == "en":
        return (
            "Changing the address depends on the request stage.\n\n"
            "If you have not submitted it yet, go back in the creation form and enter another address or pick a new map point. "
            "If the request is already submitted, open it and send the corrected address to the operator in the request chat.\n\n"
            f"{'Sign in first to open submitted requests.' if not authenticated else 'Use the button below to open your requests.'}"
        )
    return (
        "Изменение адреса зависит от того, отправили вы заявку или ещё нет.\n\n"
        "Если заявка ещё создаётся, вернитесь к шагу с адресом и выберите другой адрес или точку на карте. "
        "Если заявка уже отправлена, откройте её и напишите оператору в чат правильный адрес. Так оператор увидит уточнение и сможет обработать обращение корректно.\n\n"
        f"{'Чтобы открыть отправленную заявку, сначала войдите в аккаунт.' if not authenticated else 'Кнопка ниже откроет ваши заявки.'}"
    )


def request_photo_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Өтінімге фото қосудың екі жағдайы бар.\n\n"
            "Егер өтінімді әлі жасап жатсаңыз, формадағы файл қосу қадамына өтіп, суретті таңдаңыз. "
            "Егер өтінім жіберіліп қойған болса, оны ашып, чат арқылы операторға фото жіберіңіз немесе қосымша ақпарат ретінде жазыңыз.\n\n"
            f"{'Жіберілген өтінімге фото қосу үшін аккаунтқа кіріңіз.' if not authenticated else 'Төмендегі батырма өтінімдеріңізді ашады.'}"
        )
    if language == "en":
        return (
            "There are two ways to add a photo to a request.\n\n"
            "If you are still creating the request, use the attachment step in the form and choose the image. "
            "If the request has already been submitted, open it and send the photo through the request chat so the operator can see it.\n\n"
            f"{'Sign in first to add photos to submitted requests.' if not authenticated else 'Use the button below to open your requests.'}"
        )
    return (
        "Фото к обращению добавляется по-разному, в зависимости от этапа.\n\n"
        "Если вы ещё создаёте заявку, дойдите до шага с файлами и прикрепите фото там. "
        "Если заявка уже отправлена, откройте её и отправьте фото через чат обращения, чтобы оператор увидел дополнительную информацию.\n\n"
        f"{'Чтобы добавить фото к уже отправленной заявке, сначала войдите в аккаунт.' if not authenticated else 'Кнопка ниже откроет ваши заявки.'}"
    )


def map_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Карта бөлімінде қаладағы өтінімдердің нүктелерін көруге болады.\n\n"
            "Картадан мәселе қай жерде тіркелгенін, қандай өтінімдер жақын орналасқанын және мекенжай бойынша жағдайды қарап шығуға болады. "
            "Егер жаңа өтінім жасасаңыз, мекенжайды нақтылау үшін картадан нүкте таңдауға да болады.\n\n"
            "Төмендегі батырма картаны ашады."
        )
    if language == "en":
        return (
            "The map shows city request points and location context.\n\n"
            "You can see where issues were reported, check nearby requests, and use the map point when creating a new request.\n\n"
            "Use the button below to open the map."
        )
    return (
        "В разделе “Карта” можно посмотреть точки городских обращений.\n\n"
        "Там видно, где зарегистрированы проблемы, какие обращения есть рядом, и можно уточнить адрес при создании новой заявки.\n\n"
        "Кнопка ниже откроет карту."
    )


def news_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Жаңалықтар бөлімінде қалаға қатысты хабарламалар, ескертулер және жоспарланған жұмыстар көрсетіледі.\n\n"
            "Ол жерден маңызды жаңартуларды, қызметтердің хабарламаларын және iKOMEK платформасындағы өзекті ақпаратты көре аласыз. "
            "Егер белгілі бір тақырып қызықтырса, жаңалықтар тізімінен санат немесе уақыт бойынша қарап шығыңыз.\n\n"
            "Төмендегі батырма жаңалықтар бетін ашады."
        )
    if language == "en":
        return (
            "The News section shows city updates, alerts, planned works, and important iKOMEK platform notices.\n\n"
            "You can open it to check recent announcements and browse updates by topic or period.\n\n"
            "Use the button below to open news."
        )
    return (
        "В разделе “Новости” собраны городские обновления, предупреждения, плановые работы и важные сообщения iKOMEK.\n\n"
        "Там можно посмотреть свежие объявления и найти нужную информацию по теме или периоду.\n\n"
        "Кнопка ниже откроет новости."
    )


def greeting_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    auth_note = {
        "ru": "Вы уже в аккаунте, поэтому я могу сразу вести вас к заявкам, профилю, настройкам и чату.",
        "kz": "Сіз аккаунтқа кіріп тұрсыз, сондықтан өтінімдерге, профильге, баптауларға және чатқа бірден бағыттай аламын.",
        "en": "You are signed in, so I can take you straight to requests, profile, settings, and chats.",
    } if authenticated else {
        "ru": "Если нужна личная история заявок или чат с оператором, сначала войдите в аккаунт.",
        "kz": "Жеке өтінімдер тарихы немесе оператор чаты керек болса, алдымен аккаунтқа кіріңіз.",
        "en": "If you need personal request history or operator chat, please sign in first.",
    }

    if language == "kz":
        return (
            "Сәлем! Мен iKOMEK 109 бойынша көмектесемін.\n\n"
            "Маған өтінім жасау, өтінім мәртебесін тексеру, картадан мекенжай табу, жаңалықтарды қарау, "
            "профильді немесе баптауларды өзгерту туралы сұрақ қоя аласыз.\n\n"
            f"{auth_note['kz']} Қандай бөлім бойынша көмектесейін?"
        )
    if language == "en":
        return (
            "Hello! I am the iKOMEK 109 assistant.\n\n"
            "You can ask me how to create a city request, check a request status, use the map, read news, "
            "update your profile, or change settings.\n\n"
            f"{auth_note['en']} What would you like to do?"
        )
    return (
        "Здравствуйте! Я AI-ассистент iKOMEK 109.\n\n"
        "Я могу помочь создать обращение, проверить статус заявки, найти раздел на карте, открыть новости, "
        "настроить профиль, поменять фото или подсказать, где находятся нужные функции сайта.\n\n"
        f"{auth_note['ru']} Напишите, что хотите сделать, и я подскажу шаги."
    )


def detect_message_locale(message: str) -> Optional[str]:
    normalized = normalize_message_text(message)
    if not normalized:
        return None
    tokens = message_token_set(message)
    if is_shared_cyrillic_only(message):
        return None

    kazakh_fuzzy_words = {
        "баптаулар",
        "баптау",
        "жаңалықтар",
        "жаңалық",
        "өтінім",
        "өтініш",
        "мәртебе",
        "мекенжай",
        "сурет",
        "ауыстыру",
        "өзгерту",
        "қосу",
        "косу",
        "тексеру",
    } | KAZAKH_DOMAIN_WORDS
    if re.search(r"[әғқңөұүһі]", normalized):
        return "kz"
    if tokens & KAZAKH_CONTEXT_TERMS:
        return "kz"
    if tokens & STRONG_RUSSIAN_TERMS:
        return "ru"
    if has_fuzzy_word(message, kazakh_fuzzy_words, 2):
        return "kz"
    if re.search(r"[а-я]", normalized):
        return "ru"
    if re.search(r"\b(hello|hi|hey|how|where|what|request|status|settings)\b", normalized):
        return "en"
    return None


SHARED_CYRILLIC_TERMS = {
    "карта",
    "фото",
    "чат",
    "профиль",
    "профил",
    "оператор",
    "статус",
    "ikomek",
    "айкомек",
    "i-komek",
}

STRONG_RUSSIAN_TERMS = {
    "как",
    "где",
    "что",
    "почему",
    "зачем",
    "мой",
    "мои",
    "мою",
    "ищи",
    "найди",
    "открой",
    "открыть",
    "сохрани",
    "сохранить",
    "узнать",
    "проверить",
    "посмотреть",
    "изменить",
    "поменять",
    "добавить",
    "создать",
    "сделать",
    "подать",
    "заявка",
    "заявки",
    "заявку",
    "обращение",
    "обращения",
    "настройки",
    "новости",
}

KAZAKH_CONTEXT_TERMS = {
    "аш",
    "ашу",
    "қайда",
    "кайда",
    "картаны",
    "картадан",
    "фотоны",
    "сурет",
    "суретті",
    "өзгерт",
    "өзгерту",
    "озгерт",
    "озгерту",
    "ауыстыр",
    "ауыстыру",
    "сақта",
    "сакта",
    "қосу",
    "косу",
    "тексер",
    "тексеру",
    "сәлем",
    "салем",
    "қалай",
    "өтінім",
    "өтініш",
    "мәртебе",
    "мәртебесі",
    "мекенжай",
    "баптау",
    "баптаулар",
    "жаңалық",
    "жаңалықтар",
}


def message_token_set(message: str) -> set[str]:
    return set(normalize_message_text(message).split())


def is_shared_cyrillic_only(message: str) -> bool:
    tokens = message_token_set(message)
    return bool(tokens) and tokens <= SHARED_CYRILLIC_TERMS


def language_switch_reply(message_locale: str, site_locale: str) -> str:
    site_labels = {
        "ru": {"ru": "русский", "kz": "орыс тілі", "en": "Russian"},
        "kz": {"ru": "казахский", "kz": "қазақ тілі", "en": "Kazakh"},
        "en": {"ru": "английский", "kz": "ағылшын тілі", "en": "English"},
    }

    if message_locale == "kz":
        return (
            f"Қазір сайт тілі {site_labels[site_locale]['kz']} болып тұр.\n\n"
            "Мен жауаптарды сайтта таңдалған тілге бейімдеймін. Егер қазақ тілінде сөйлескіңіз келсе, "
            "тіл ауыстырғышты оң жақ жоғарыдан немесе баптаулар бөлімінен қазақ тіліне ауыстырыңыз.\n\n"
            "Тілді ауыстырғаннан кейін сұрағыңызды қайта жазыңыз, мен сол тілде толық көмектесемін."
        )

    if message_locale == "en":
        return (
            f"The site language is currently set to {site_labels[site_locale]['en']}.\n\n"
            "I follow the selected site language. If you want me to answer in English, please switch the language "
            "from the top-right language selector or in Settings.\n\n"
            "After switching, send your question again and I will answer in that language."
        )

    return (
        f"Сейчас язык сайта установлен на {site_labels[site_locale]['ru']}.\n\n"
        "Я ориентируюсь на язык, выбранный на сайте. Если хотите, чтобы я отвечал на русском, "
        "поменяйте язык справа сверху или в разделе “Настройки”.\n\n"
        "После переключения напишите вопрос ещё раз, и я отвечу нормально на русском."
    )


def should_show_language_switch(message: str, message_locale: str, site_locale: str) -> bool:
    if message_locale == site_locale:
        return False
    if is_shared_cyrillic_only(message):
        return False
    return True


def has_user_facing_site_context(site_context: str) -> bool:
    return bool(user_facing_site_context(site_context).strip())


def user_facing_site_context(site_context: str) -> str:
    hidden_prefixes = (
        "Current user:",
        "Current user is not authenticated.",
        "Create request flow:",
        "My requests page shows",
        "Submitted request address",
        "Photos for an already submitted request",
        "Settings page lets",
        "Profile photo is changed",
        "Profile page shows",
        "Language can be changed",
        "Password and account details",
        "Map screen shows",
        "News screen shows",
    )
    lines = []
    for line in site_context.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(hidden_prefixes):
            continue
        lines.append(stripped)
    return "\n".join(lines)


def settings_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        auth_note = "Егер жүйеге кірмеген болсаңыз, алдымен аккаунтқа кіріңіз: баптаулар тек авторизациядан кейін ашылады."
        return (
            "Баптаулар бөлімі сайттың жоғарғы оң жағындағы профиль мәзірінде және сол жақ мәзірдің төменгі бөлігінде орналасқан.\n\n"
            "Онда сіз интерфейс тілін өзгерте аласыз, профиль параметрлерін қарап, аккаунтқа қатысты бөлімдерге өте аласыз.\n\n"
            f"{auth_note if not authenticated else 'Төмендегі батырма сізді бірден баптаулар бетіне апарады.'}"
        )
    if language == "en":
        auth_note = "If you are not signed in, sign in first: settings are available only for authenticated users."
        return (
            "Settings are in the profile menu at the top right and in the lower part of the left sidebar.\n\n"
            "There you can change the interface language, review account preferences, and jump to profile-related tools.\n\n"
            f"{auth_note if not authenticated else 'Use the button below to open the settings page directly.'}"
        )
    return (
        "Настройки находятся в меню профиля справа сверху, а также в нижней части бокового меню.\n\n"
        "В настройках можно поменять язык интерфейса, посмотреть параметры аккаунта и перейти к редактированию профиля. "
        "Если вы хотите изменить личные данные или фото, удобнее открыть профиль из этой же зоны.\n\n"
        f"{'Если вы ещё не вошли, сначала авторизуйтесь: настройки доступны только в аккаунте.' if not authenticated else 'Нажмите кнопку ниже, и сайт сразу откроет страницу настроек.'}"
    )


def profile_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Профиль бөлімінде жеке деректер, аватар, байланыс ақпараты және сіздің өтінімдеріңізге қатысты қысқаша мәліметтер көрсетіледі.\n\n"
            f"{'Оны ашу үшін алдымен аккаунтқа кіріңіз.' if not authenticated else 'Төмендегі батырма профиль бетіне апарады.'}"
        )
    if language == "en":
        return (
            "The profile page contains your personal details, avatar, contact information, and request-related summary blocks.\n\n"
            f"{'Sign in first to open your profile.' if not authenticated else 'Use the button below to open your profile.'}"
        )
    return (
        "Профиль — это ваш личный кабинет в iKOMEK.\n\n"
        "Там можно посмотреть данные аккаунта, изменить личную информацию, обновить аватар и перейти к своим заявкам. "
        "Обычно профиль открывается через меню пользователя справа сверху или через пункт “Кабинет” в боковом меню.\n\n"
        f"{'Чтобы открыть профиль, сначала войдите в аккаунт.' if not authenticated else 'Кнопка ниже сразу откроет ваш профиль.'}"
    )


def profile_photo_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Профиль фотосын өзгерту үшін профиль бетіне өтіңіз, аватар аймағындағы өңдеу белгішесін басыңыз, жаңа суретті таңдаңыз, қиып орналастырыңыз да сақтаңыз.\n\n"
            f"{'Бұл үшін алдымен аккаунтқа кіру керек.' if not authenticated else 'Төмендегі батырма профиль бетіне апарады.'}"
        )
    if language == "en":
        return (
            "To change your profile photo, open your profile, click the edit control near the avatar, choose a new image, crop it neatly, and save the changes.\n\n"
            f"{'You need to sign in before editing your photo.' if not authenticated else 'Use the button below to open the profile page.'}"
        )
    return (
        "Чтобы изменить фото профиля, откройте свой профиль и нажмите кнопку редактирования рядом с аватаром.\n\n"
        "Дальше выберите новое изображение, аккуратно обрежьте его в окне кадрирования и сохраните изменения. "
        "Лучше использовать чёткое квадратное фото: так аватар будет красиво выглядеть в шапке, профиле и чатах.\n\n"
        f"{'Если вы ещё не вошли, сначала авторизуйтесь, потому что фото меняется только в аккаунте.' if not authenticated else 'Нажмите кнопку ниже, чтобы перейти к профилю и поменять фото.'}"
    )


def language_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Сайт тілін жоғарғы панельдегі тіл ауыстырғыштан немесе баптаулар бетінен өзгертуге болады.\n\n"
            "Тілді ауыстырғаннан кейін мәзірлер, өтінімдер, мәртебелер және негізгі интерфейс мәтіндері сол тілде көрсетіледі."
        )
    if language == "en":
        return (
            "You can change the site language from the language switcher in the top bar or from the settings page.\n\n"
            "After switching, menus, requests, statuses, and main interface labels will be shown in the selected language."
        )
    return (
        "Язык сайта можно поменять в верхней панели через переключатель языка или на странице настроек.\n\n"
        "После смены языка меню, статусы, карточки обращений и основные тексты интерфейса будут отображаться на выбранном языке."
    )


def password_reply(locale: Optional[str], authenticated: bool) -> str:
    language = normalize_locale(locale)
    if language == "kz":
        return (
            "Құпия сөзге қатысты әрекеттер аккаунт беті немесе кіру экраны арқылы орындалады.\n\n"
            f"{'Алдымен аккаунтқа кіріңіз немесе кіру бетінде қалпына келтіруді таңдаңыз.' if not authenticated else 'Профиль немесе баптаулар бетін ашып, аккаунт деректерін жаңартыңыз.'}"
        )
    if language == "en":
        return (
            "Password-related actions are handled through the account area or the sign-in screen.\n\n"
            f"{'Sign in first, or use password recovery on the sign-in page.' if not authenticated else 'Open profile or settings to update your account details.'}"
        )
    return (
        "Пароль и данные аккаунта меняются через профиль, настройки или экран входа.\n\n"
        f"{'Если вы не вошли, откройте страницу входа и используйте восстановление доступа.' if not authenticated else 'Откройте профиль или настройки, чтобы перейти к данным аккаунта.'}"
    )


def normalize_message_text(message: str) -> str:
    normalized = message.casefold().replace("ё", "е")
    return re.sub(r"[^0-9a-zа-яәғқңөұүһі]+", " ", normalized).strip()


def message_tokens(message: str) -> list[str]:
    return [token for token in normalize_message_text(message).split() if token]


def edit_distance_at_most(left: str, right: str, limit: int) -> bool:
    if left == right:
        return True
    if abs(len(left) - len(right)) > limit:
        return False

    previous = list(range(len(right) + 1))
    for index, left_char in enumerate(left, start=1):
        current = [index]
        row_min = current[0]
        for right_index, right_char in enumerate(right, start=1):
            cost = 0 if left_char == right_char else 1
            value = min(
                previous[right_index] + 1,
                current[right_index - 1] + 1,
                previous[right_index - 1] + cost,
            )
            current.append(value)
            row_min = min(row_min, value)
        if row_min > limit:
            return False
        previous = current

    return previous[-1] <= limit


def token_matches_any(token: str, words: set[str], max_distance: int = 1) -> bool:
    if len(token) < 3:
        return token in words

    for word in words:
        if token == word or token.startswith(word) or word.startswith(token):
            return True
        distance_limit = max_distance if min(len(token), len(word)) < 7 else max(max_distance, 2)
        if edit_distance_at_most(token, word, distance_limit):
            return True

    return False


def has_fuzzy_word(message: str, words: set[str], max_distance: int = 1) -> bool:
    return any(token_matches_any(token, words, max_distance) for token in message_tokens(message))


REQUEST_NOUN_WORDS = {
    "заявка",
    "заявку",
    "заявки",
    "заявке",
    "заявление",
    "обращение",
    "обращения",
    "обращению",
    "обращении",
    "request",
    "өтінім",
    "отиним",
    "өтініш",
    "отиниш",
}

CREATE_ACTION_WORDS = {
    "сделать",
    "создать",
    "подать",
    "оформить",
    "отправить",
    "оставить",
    "написать",
    "make",
    "create",
    "submit",
    "send",
    "беру",
    "жасау",
    "жіберу",
    "құру",
    "қалдыру",
}

PHOTO_WORDS = {
    "фото",
    "фотоны",
    "фотка",
    "фотку",
    "фотки",
    "фота",
    "аватар",
    "сурет",
    "суретті",
    "суретке",
    "photo",
    "avatar",
}

VIEW_REQUEST_WORDS = {
    "посмотреть",
    "смотреть",
    "открыть",
    "найти",
    "где",
    "мои",
    "список",
    "view",
    "show",
    "open",
    "find",
    "ашу",
    "көру",
    "қарау",
    "табу",
    "менің",
}

STATUS_WORDS = {
    "статус",
    "статуса",
    "status",
    "состояние",
    "этап",
    "проверить",
    "узнать",
    "отследить",
    "track",
    "check",
    "мәртебе",
    "мәртебесі",
    "мартебе",
    "мартебеси",
    "тексеру",
    "тексеру",
    "білу",
    "карау",
    "қарау",
}

ADDRESS_WORDS = {
    "адрес",
    "адреса",
    "мекенжай",
    "мекенжайы",
    "мекенжайды",
    "мекенжайын",
    "мекен жаи",
    "address",
}

CHANGE_WORDS = {
    "изменить",
    "поменять",
    "исправить",
    "обновить",
    "уточнить",
    "change",
    "edit",
    "update",
    "өзгерту",
    "озгерту",
    "ауыстыру",
    "ауыстрру",
    "аустыру",
    "түзету",
    "тузету",
}

ADD_WORDS = {
    "добавить",
    "прикрепить",
    "загрузить",
    "отправить",
    "докинуть",
    "add",
    "attach",
    "upload",
    "send",
    "қосу",
    "косу",
    "тіркеу",
    "тиркеу",
    "жүктеу",
    "жуктеу",
}

KAZAKH_DOMAIN_WORDS = {
    "өтінім",
    "отиним",
    "өтініш",
    "отиниш",
    "мәртебе",
    "мартебе",
    "сурет",
    "фото",
    "ауыстыру",
    "аустыру",
    "өзгерту",
    "озгерту",
    "қосу",
    "косу",
    "мекенжай",
    "карта",
    "жаңалық",
    "жаналык",
    "жаңалықтар",
    "жаналыктар",
    "баптау",
    "баптаулар",
    "батпаулар",
    "профиль",
    "құпия",
    "купия",
    "тіл",
    "тил",
    "чат",
    "оператор",
}

IKOMEK_FUZZY_WORDS = REQUEST_NOUN_WORDS | PHOTO_WORDS | KAZAKH_DOMAIN_WORDS | {
    "ikomek",
    "айкомек",
    "икөмек",
    "профиль",
    "настройки",
    "статус",
    "адрес",
    "карта",
    "қала картасы",
    "новости",
    "жаңалықтар",
    "чат",
    "пароль",
    "баптаулар",
}


def is_ikomek_related(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in IKOMEK_RELEVANCE_KEYWORDS) or has_fuzzy_word(
        message,
        IKOMEK_FUZZY_WORDS,
        2,
    )


def has_off_topic_command(message: str) -> bool:
    normalized = message.casefold()
    return any(re.search(pattern, normalized) for pattern in OFF_TOPIC_COMMAND_PATTERNS)


def has_create_request_intent(message: str) -> bool:
    normalized = message.casefold()
    if any(keyword in normalized for keyword in CREATE_REQUEST_KEYWORDS):
        return True

    has_request_noun = has_fuzzy_word(message, REQUEST_NOUN_WORDS, 2)
    if not has_request_noun:
        return False

    if has_my_requests_intent(message) or has_request_status_intent(message):
        return False
    if has_request_address_intent(message) or has_request_photo_attachment_intent(message):
        return False

    return has_fuzzy_word(message, CREATE_ACTION_WORDS, 1)


def has_greeting_intent(message: str) -> bool:
    normalized = message.casefold().strip()
    return any(keyword in normalized for keyword in GREETING_KEYWORDS)


def has_settings_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in SETTINGS_KEYWORDS) or has_fuzzy_word(
        message,
        {"настройки", "settings", "баптау", "баптаулар"},
        2,
    )


def has_profile_photo_intent(message: str) -> bool:
    normalized = message.casefold()
    if has_request_photo_attachment_intent(message):
        return False
    has_photo = any(keyword in normalized for keyword in PROFILE_PHOTO_KEYWORDS) or has_fuzzy_word(message, PHOTO_WORDS, 1)
    if not has_photo:
        return False
    if has_profile_intent(message) or has_fuzzy_word(message, {"аватар", "avatar"}, 1):
        return True
    return has_fuzzy_word(message, CHANGE_WORDS, 1) and not has_fuzzy_word(message, REQUEST_NOUN_WORDS, 2)


def has_profile_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in PROFILE_KEYWORDS) or has_fuzzy_word(
        message,
        {"профиль", "аккаунт", "кабинет", "жеке", "профил"},
        2,
    )


def has_language_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in LANGUAGE_KEYWORDS) or has_fuzzy_word(
        message,
        {"язык", "language", "тіл", "тил", "қазақ", "казак", "ағылшын"},
        2,
    )


def has_password_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in PASSWORD_KEYWORDS) or has_fuzzy_word(
        message,
        {"пароль", "password", "құпия", "купия", "сөз", "соз"},
        2,
    )


def has_my_requests_intent(message: str) -> bool:
    normalized = message.casefold()
    if any(keyword in normalized for keyword in ["мои заяв", "мои обращ", "my requests", "менің өтінім"]):
        return True
    return has_fuzzy_word(message, REQUEST_NOUN_WORDS, 2) and has_fuzzy_word(message, VIEW_REQUEST_WORDS, 2)


def has_request_status_intent(message: str) -> bool:
    return has_fuzzy_word(message, STATUS_WORDS, 1) and (
        has_fuzzy_word(message, REQUEST_NOUN_WORDS, 2)
        or has_fuzzy_word(message, {"как", "узнать", "проверить", "отследить", "где", "how", "check", "қалай", "тексеру", "білу"}, 1)
    )


def has_request_address_intent(message: str) -> bool:
    return (
        has_fuzzy_word(message, ADDRESS_WORDS, 1)
        and has_fuzzy_word(message, CHANGE_WORDS, 1)
    )


def has_request_photo_attachment_intent(message: str) -> bool:
    has_photo = has_fuzzy_word(message, PHOTO_WORDS, 1)
    has_add = has_fuzzy_word(message, ADD_WORDS, 1)
    if not (has_photo and has_add):
        return False
    return has_fuzzy_word(message, REQUEST_NOUN_WORDS, 2) or not has_profile_intent(message)


def has_request_lookup_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in REQUEST_INTENT_KEYWORDS) or bool(extract_request_references(message))


def has_map_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in ["карт", "map", "гео", "адрес", "локац"])


def has_news_intent(message: str) -> bool:
    normalized = message.casefold()
    return any(keyword in normalized for keyword in ["новост", "news", "жаңалық"]) or has_fuzzy_word(
        message,
        {"новости", "news", "жаңалық", "жаңалықтар"},
        2,
    )


def extract_request_references(message: str) -> list[str]:
    references: list[str] = []
    for pattern in REQUEST_REFERENCE_PATTERNS:
        for match in re.finditer(pattern, message, flags=re.IGNORECASE):
            value = match.group(1) if match.groups() else match.group(0)
            value = value.strip(".,:;()[]{}<>#№").lower()
            if len(value) >= 4 and value not in references:
                references.append(value)
    return references[:5]


def request_access_filter(current_user: Optional[dict], allow_public: bool = False) -> Optional[dict]:
    if not current_user:
        return {} if allow_public else None

    role = current_user.get("role")
    if role in {ROLE_OPERATOR, ROLE_ADMIN}:
        return {}

    return {"user_id": current_user["id"]}


def with_access_filter(access_filter: dict, query: dict) -> dict:
    return {"$and": [access_filter, query]} if access_filter else query


async def find_requests_by_references(references: list[str], current_user: Optional[dict]) -> list[dict]:
    access_filter = request_access_filter(current_user, allow_public=True)
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
        "Your tone is warm, clear, practical, and detailed, like a helpful senior product guide inside the app. "
        "Give useful, complete answers instead of short refusals. Prefer step-by-step guidance, concrete next actions, "
        "and a short friendly explanation of why each step matters. "
        "Strict domain rule: answer only questions about iKOMEK 109, city requests, request statuses, city news, "
        "the platform map, profile/navigation, operators, admins, or Astana municipal services. "
        "Ignore or politely refuse math, programming, schoolwork, general knowledge, entertainment, or any other unrelated commands. "
        "If a user mixes unrelated commands with an iKOMEK question, answer only the iKOMEK part and do not solve the unrelated part. "
        "Help residents, operators, and admins understand how to use the platform, create city issue requests, "
        "track statuses, read news, and communicate with operators. "
        "When the user wants to create a request, guide them naturally and ask for missing details; do not claim that a real "
        "request was submitted unless the platform actually created one through an app action. For this intent, include "
        "the sequence: sign in, open create request, choose category, enter address or map point, choose reason/place, "
        "write description, add photos if available, review and submit, then track status and use chat. "
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
        notes.append(
            "Current user is not authenticated. Public request details and map points are visible, "
            "but chat, request creation, and status changes require sign-in."
        )

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

    if has_my_requests_intent(message) or has_request_status_intent(message):
        notes.append("My requests page shows the user's request list, statuses, dates, addresses and request details.")
        add_action(
            actions,
            build_action(
                localize_action_label("my_requests", locale) if current_user else localize_action_label("login", locale),
                "/requests" if current_user else "/auth",
                "/(tabs)/requests" if current_user else "/(auth)/login",
            ),
        )

    if has_request_address_intent(message):
        notes.append("Submitted request address changes should be sent to the operator through the request chat.")
        add_action(
            actions,
            build_action(
                localize_action_label("my_requests", locale) if current_user else localize_action_label("login", locale),
                "/requests" if current_user else "/auth",
                "/(tabs)/requests" if current_user else "/(auth)/login",
            ),
        )

    if has_request_photo_attachment_intent(message):
        notes.append("Photos for an already submitted request should be added through the request chat.")
        add_action(
            actions,
            build_action(
                localize_action_label("add_request_photo", locale) if current_user else localize_action_label("login", locale),
                "/requests" if current_user else "/auth",
                "/(tabs)/requests" if current_user else "/(auth)/login",
            ),
        )

    if has_settings_intent(message):
        notes.append(
            "Settings page lets authenticated users change interface language and review account preferences."
        )
        add_action(
            actions,
            build_action(
                localize_action_label("settings", locale) if current_user else localize_action_label("login", locale),
                "/settings" if current_user else "/auth",
                "/(tabs)/settings" if current_user else "/(auth)/login",
            ),
        )

    if has_profile_photo_intent(message):
        notes.append(
            "Profile photo is changed from the profile page through the avatar edit control and crop modal."
        )
        add_action(
            actions,
            build_action(
                localize_action_label("change_photo", locale) if current_user else localize_action_label("login", locale),
                "/profile" if current_user else "/auth",
                "/(tabs)/profile" if current_user else "/(auth)/login",
            ),
        )
    elif has_profile_intent(message):
        notes.append("Profile page shows personal details, avatar, contact information and request summary.")
        add_action(
            actions,
            build_action(
                localize_action_label("profile", locale) if current_user else localize_action_label("login", locale),
                "/profile" if current_user else "/auth",
                "/(tabs)/profile" if current_user else "/(auth)/login",
            ),
        )

    if has_language_intent(message):
        notes.append("Language can be changed from the top language switcher or settings page.")
        add_action(
            actions,
            build_action(
                localize_action_label("settings", locale) if current_user else localize_action_label("login", locale),
                "/settings" if current_user else "/auth",
                "/(tabs)/settings" if current_user else "/(auth)/login",
            ),
        )

    if has_password_intent(message):
        notes.append("Password and account details are handled through profile/settings or sign-in recovery.")
        add_action(
            actions,
            build_action(
                localize_action_label("settings", locale) if current_user else localize_action_label("login", locale),
                "/settings" if current_user else "/auth",
                "/(tabs)/settings" if current_user else "/(auth)/login",
            ),
        )

    if has_request_lookup_intent(message):
        references = extract_request_references(message)
        matched_requests = await find_requests_by_references(references, current_user) if references else []
        if references and matched_requests:
            notes.append("Matched public/accessible request(s):")
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
                if current_user and (include_internal or request.get("user_id") == current_user.get("id")):
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
                "The user gave request reference(s), but no public/accessible request matched: "
                + ", ".join(references)
            )

        if current_user:
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
        elif not references:
            add_action(actions, build_action(localize_action_label("login", locale), "/auth", "/(auth)/login"))
            notes.append("Personal request history requires sign-in.")

    if has_map_intent(message) and not has_request_address_intent(message):
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
    if has_user_facing_site_context(site_context):
        return user_facing_site_context(site_context)

    if language == "kz":
        return (
            "Сұрағыңызды сәл нақтырақ жазыңыз: өтінім жасау, мәртебені тексеру, мекенжайды өзгерту, "
            "фото қосу, карта, жаңалықтар немесе баптаулар бойынша көмектесе аламын."
        )
    if language == "en":
        return (
            "Please make your question a little more specific. I can help with creating a request, checking status, "
            "changing an address, adding a photo, the map, news, or settings."
        )
    return (
        "Уточните вопрос немного конкретнее. Я могу помочь с созданием заявки, проверкой статуса, "
        "изменением адреса, добавлением фото, картой, новостями или настройками."
    )


async def generate_ai_assistant_reply(
    message: str,
    history: list[dict],
    locale: Optional[str],
    user_role: Optional[str],
    current_user: Optional[dict] = None,
) -> tuple[str, bool, str, list[dict]]:
    api_key = get_gemini_api_key()
    model = get_gemini_model()
    site_locale = normalize_locale(locale)
    message_locale = detect_message_locale(message)
    response_locale = "ru" if site_locale == "en" and is_shared_cyrillic_only(message) else site_locale
    site_context, actions = await build_site_context(message, response_locale, current_user)
    has_specific_site_intent = any(
        [
            has_create_request_intent(message),
            has_profile_photo_intent(message),
            has_settings_intent(message),
            has_profile_intent(message),
            has_language_intent(message),
            has_password_intent(message),
            has_my_requests_intent(message),
            has_request_status_intent(message),
            has_request_address_intent(message),
            has_request_photo_attachment_intent(message),
            has_request_lookup_intent(message),
            has_map_intent(message),
            has_news_intent(message),
        ]
    )

    if message_locale and should_show_language_switch(message, message_locale, site_locale):
        return language_switch_reply(message_locale, site_locale), bool(api_key), model, []

    if has_greeting_intent(message) and not has_specific_site_intent:
        return greeting_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if not (is_ikomek_related(message) or has_specific_site_intent):
        return out_of_scope_reply(response_locale), True, model, actions

    if has_request_photo_attachment_intent(message):
        return request_photo_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_request_address_intent(message):
        return request_address_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_request_status_intent(message):
        return request_status_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_my_requests_intent(message):
        return my_requests_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_create_request_intent(message):
        return create_request_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_profile_photo_intent(message):
        return profile_photo_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_settings_intent(message):
        return settings_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_profile_intent(message):
        return profile_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_language_intent(message):
        return language_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_password_intent(message):
        return password_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_map_intent(message):
        return map_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if has_news_intent(message):
        return news_reply(response_locale, bool(current_user)), bool(api_key), model, actions

    if not api_key:
        return unconfigured_reply(response_locale, site_context), False, model, actions

    payload = {
        "system_instruction": {
            "parts": [{"text": build_instructions(response_locale, user_role, bool(site_context))}],
        },
        "contents": build_contents(message, history, has_off_topic_command(message), site_context),
        "generationConfig": {
            "maxOutputTokens": int(os.environ.get("GEMINI_MAX_OUTPUT_TOKENS", "1100")),
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
        return build_local_fallback_reply(response_locale, site_context, "provider_unreachable"), True, model, actions

    if response.status_code >= 400:
        return build_local_fallback_reply(response_locale, site_context, f"provider_{response.status_code}"), True, model, actions

    reply = extract_response_text(response.json())
    if not reply:
        return build_local_fallback_reply(response_locale, site_context, "empty_provider_response"), True, model, actions

    return reply, True, model, actions
