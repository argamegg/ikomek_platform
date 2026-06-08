from datetime import datetime
from typing import Optional

from dateutil import parser as dateparser
from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from helpers import (
    localize_news_document,
    normalize_translation_language,
    require_role,
    to_pagination_params,
)
from schemas import NewsCreate, NewsItem, ROLE_ADMIN
from services.translation import detect_language, translate_to_all_languages

router = APIRouter()

# ================================
# NEWS ENDPOINTS
# ================================

NEWS_TRANSLATION_LANGUAGES = ("ru", "kk", "en")
NEWS_LOCALIZED_SUFFIXES = {
    "ru": "ru",
    "kk": "kz",
    "en": "en",
}


def _clean_text(value) -> str:
    return str(value).strip() if value is not None else ""


def _localized_news_field(base: str, language: str) -> str:
    return f"{base}_{NEWS_LOCALIZED_SUFFIXES[language]}"


def _first_localized_value(news_dict: dict, base: str) -> str:
    for language in NEWS_TRANSLATION_LANGUAGES:
        value = _clean_text(news_dict.get(_localized_news_field(base, language)))
        if value:
            return value
    return ""


def _pick_news_source_text(news_dict: dict, base: str, source_lang: Optional[str]) -> str:
    if source_lang:
        value = _clean_text(news_dict.get(_localized_news_field(base, source_lang)))
        if value:
            return value

    return _clean_text(news_dict.get(base)) or _first_localized_value(news_dict, base)


def _has_localized_fields(news_dict: dict, bases: tuple[str, ...]) -> bool:
    return all(
        _clean_text(news_dict.get(_localized_news_field(base, language)))
        for base in bases
        for language in NEWS_TRANSLATION_LANGUAGES
    )


def _needs_translation(news_dict: dict, base: str, language: str, source_text: str, source_lang: str) -> bool:
    current = _clean_text(news_dict.get(_localized_news_field(base, language)))
    if not current:
        return True
    return language != source_lang and current == source_text


async def _ensure_news_field_translations(
    news_dict: dict,
    base: str,
    source_text: str,
    source_lang: str,
) -> bool:
    if not source_text:
        return False

    if not any(
        _needs_translation(news_dict, base, language, source_text, source_lang)
        for language in NEWS_TRANSLATION_LANGUAGES
    ):
        return False

    translations = await translate_to_all_languages(source_text, source_lang)
    for language in NEWS_TRANSLATION_LANGUAGES:
        if _needs_translation(news_dict, base, language, source_text, source_lang):
            news_dict[_localized_news_field(base, language)] = translations[language]

    return True


async def _ensure_news_translations(
    news_dict: dict,
    *,
    source_title: str,
    source_content: str,
    source_summary: str,
    source_lang: str,
) -> None:
    await _ensure_news_field_translations(news_dict, "title", source_title, source_lang)
    await _ensure_news_field_translations(news_dict, "content", source_content, source_lang)
    await _ensure_news_field_translations(news_dict, "summary", source_summary, source_lang)


def _set_news_translation_status(news_dict: dict, source_summary: str) -> None:
    text_translated = _has_localized_fields(news_dict, ("title", "content"))
    summary_translated = not source_summary or _has_localized_fields(news_dict, ("summary",))
    news_dict["translation_status"] = "translated" if text_translated and summary_translated else "failed"


def _prepare_news_source_fields(news_dict: dict) -> tuple[str, str, str, str]:
    requested_source_lang = (
        normalize_translation_language(news_dict.get("source_lang"))
        if news_dict.get("source_lang")
        else None
    )
    source_title = _pick_news_source_text(news_dict, "title", requested_source_lang)
    source_content = _pick_news_source_text(news_dict, "content", requested_source_lang)
    source_summary = _pick_news_source_text(news_dict, "summary", requested_source_lang)
    source_lang = requested_source_lang or detect_language(f"{source_title} {source_content}".strip() or source_summary)

    return (
        _pick_news_source_text(news_dict, "title", source_lang),
        _pick_news_source_text(news_dict, "content", source_lang),
        _pick_news_source_text(news_dict, "summary", source_lang),
        source_lang,
    )

@router.get("/news")
async def get_news(
    lang: str = "ru",
    search: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    period: Optional[str] = "all",
    sort: Optional[str] = "date_desc",
    page: int = 1,
    limit: int = 20,
):
    query = {"is_active": True}
    now = datetime.utcnow()
    now_str = now.isoformat()

    if category:
        query["category"] = category

    if type:
        query["types"] = {"$in": [type]}

    if period == "active":
        query["$and"] = [
            {"start_at": {"$exists": True}},
            {"end_at": {"$exists": True}},
            {"start_at": {"$ne": None}},
            {"end_at": {"$ne": None}},
            {
                "$or": [
                    {
                        "$and": [
                            {"start_at": {"$lte": now}},
                            {"end_at": {"$gte": now}},
                        ],
                    },
                    {
                        "$and": [
                            {"start_at": {"$lte": now_str}},
                            {"end_at": {"$gte": now_str}},
                        ],
                    },
                ],
            },
        ]
    elif period == "finished":
        query["$or"] = [
            {"end_at": {"$lt": now}},
            {"end_at": {"$lt": now_str}},
        ]
    elif period == "no_period":
        query["$or"] = [
            {"start_at": None},
            {"start_at": {"$exists": False}},
            {"end_at": None},
            {"end_at": {"$exists": False}},
        ]

    if search:
        query["$text"] = {"$search": search}

    sort_order = -1 if sort != "date_asc" else 1
    safe_page, safe_limit = to_pagination_params(page, limit)
    skip = (safe_page - 1) * safe_limit

    cursor = db.news.find(query).sort("created_at", sort_order).skip(skip).limit(safe_limit)
    news = await cursor.to_list(safe_limit)
    total = await db.news.count_documents(query)

    localized_news = [NewsItem(**localize_news_document(item, lang)).dict() for item in news]
    return {
        "news": localized_news,
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
    }

@router.get("/news/{news_id}", response_model=NewsItem)
async def get_news_item(news_id: str, lang: str = "ru"):
    news = await db.news.find_one({"id": news_id})
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return NewsItem(**localize_news_document(news, lang))

@router.post("/admin/news/translate-preview")
async def translate_preview(
    data: dict,
    current_user: dict = Depends(require_role([ROLE_ADMIN])),
):
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    summary = (data.get("summary") or "").strip()
    source_lang = detect_language(f"{title} {content}".strip())

    title_translations = await translate_to_all_languages(title, source_lang)
    content_translations = await translate_to_all_languages(content, source_lang)
    summary_translations = await translate_to_all_languages(summary, source_lang) if summary else {"ru": "", "kk": "", "en": ""}

    return {
        "source_lang": source_lang,
        "translations": {
            "ru": {
                "title": title_translations["ru"],
                "content": content_translations["ru"],
                "summary": summary_translations["ru"],
            },
            "kk": {
                "title": title_translations["kk"],
                "content": content_translations["kk"],
                "summary": summary_translations["kk"],
            },
            "en": {
                "title": title_translations["en"],
                "content": content_translations["en"],
                "summary": summary_translations["en"],
            },
        },
    }

@router.post("/admin/news", response_model=NewsItem)
async def create_news(news_data: NewsCreate, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    news_dict = news_data.dict()
    source_title, source_content, source_summary, source_lang = _prepare_news_source_fields(news_dict)

    if news_dict.get("skip_translation"):
        news_dict["translation_status"] = "skipped"
    elif source_title or source_content or source_summary:
        try:
            await _ensure_news_translations(
                news_dict,
                source_title=source_title,
                source_content=source_content,
                source_summary=source_summary,
                source_lang=source_lang,
            )
            _set_news_translation_status(news_dict, source_summary)
        except Exception:
            news_dict["translation_status"] = "failed"
    else:
        news_dict["translation_status"] = news_dict.get("translation_status") or "failed"

    news_dict["title"] = source_title or news_dict.get("title_ru") or news_dict.get("title_kz") or news_dict.get("title_en")
    news_dict["content"] = source_content or news_dict.get("content_ru") or news_dict.get("content_kz") or news_dict.get("content_en")
    news_dict["summary"] = source_summary or news_dict.get("summary_ru") or news_dict.get("summary_kz") or news_dict.get("summary_en") or (news_dict["content"] or "")[:180]
    news_dict["source_lang"] = source_lang
    news_dict["created_at"] = news_dict.get("created_at") or datetime.utcnow()
    news_dict["updated_at"] = datetime.utcnow()
    news_dict.pop("skip_translation", None)

    news_item = NewsItem(**news_dict)
    await db.news.insert_one(news_item.dict())
    return news_item

@router.put("/admin/news/{news_id}", response_model=NewsItem)
async def update_news(
    news_id: str,
    news_data: dict,
    current_user: dict = Depends(require_role([ROLE_ADMIN])),
):
    existing = await db.news.find_one({"id": news_id})
    if not existing:
        raise HTTPException(status_code=404, detail="News not found")

    update_data = {key: value for key, value in news_data.items() if value is not None}
    for date_field in ["start_at", "end_at"]:
        if date_field in update_data and isinstance(update_data[date_field], str):
            try:
                update_data[date_field] = dateparser.parse(update_data[date_field])
            except Exception:
                pass

    skip_translation = bool(update_data.pop("skip_translation", False))
    merged = dict(existing)
    merged.update(update_data)
    source_title, source_content, source_summary, source_lang = _prepare_news_source_fields(merged)

    if skip_translation:
        update_data["translation_status"] = "skipped"
    elif merged.get("translation_status") != "skipped" and (source_title or source_content or source_summary):
        try:
            await _ensure_news_translations(
                merged,
                source_title=source_title,
                source_content=source_content,
                source_summary=source_summary,
                source_lang=source_lang,
            )
            _set_news_translation_status(merged, source_summary)

            for base in ("title", "content", "summary"):
                for language in NEWS_TRANSLATION_LANGUAGES:
                    field = _localized_news_field(base, language)
                    update_data[field] = merged.get(field)
            update_data["translation_status"] = merged.get("translation_status")
        except Exception:
            update_data["translation_status"] = "failed"

    update_data["title"] = source_title or merged.get("title_ru") or merged.get("title_kz") or merged.get("title_en")
    update_data["content"] = source_content or merged.get("content_ru") or merged.get("content_kz") or merged.get("content_en")
    update_data["summary"] = source_summary or merged.get("summary_ru") or merged.get("summary_kz") or merged.get("summary_en") or (update_data["content"] or "")[:180]
    update_data["source_lang"] = source_lang
    update_data["updated_at"] = datetime.utcnow()
    await db.news.update_one({"id": news_id}, {"$set": update_data})
    updated = await db.news.find_one({"id": news_id})
    return NewsItem(**localize_news_document(updated, updated.get("source_lang")))

@router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    result = await db.news.delete_one({"id": news_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News not found")
    return {"message": "News deleted"}
