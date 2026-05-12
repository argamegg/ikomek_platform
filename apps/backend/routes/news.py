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
    source_title = (news_dict.get("title") or "").strip()
    source_content = (news_dict.get("content") or "").strip()
    source_summary = (news_dict.get("summary") or "").strip()
    source_lang = normalize_translation_language(news_dict.get("source_lang")) if news_dict.get("source_lang") else detect_language(f"{source_title} {source_content}".strip())

    has_translations = all(
        news_dict.get(field)
        for field in ("title_ru", "title_kz", "title_en", "content_ru", "content_kz", "content_en")
    )

    if not news_dict.get("skip_translation") and not has_translations and source_title:
        try:
            title_translations = await translate_to_all_languages(source_title, source_lang)
            content_translations = await translate_to_all_languages(source_content, source_lang)

            news_dict["title_ru"] = title_translations["ru"]
            news_dict["title_kz"] = title_translations["kk"]
            news_dict["title_en"] = title_translations["en"]
            news_dict["content_ru"] = content_translations["ru"]
            news_dict["content_kz"] = content_translations["kk"]
            news_dict["content_en"] = content_translations["en"]
            if source_summary:
                summary_translations = await translate_to_all_languages(source_summary, source_lang)
                news_dict["summary_ru"] = summary_translations["ru"]
                news_dict["summary_kz"] = summary_translations["kk"]
                news_dict["summary_en"] = summary_translations["en"]
            news_dict["translation_status"] = "translated"
        except Exception:
            news_dict["translation_status"] = "failed"
    elif has_translations:
        news_dict["translation_status"] = "translated"
    elif news_dict.get("skip_translation"):
        news_dict["translation_status"] = "skipped"
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
    update_data["updated_at"] = datetime.utcnow()
    await db.news.update_one({"id": news_id}, {"$set": update_data})
    updated = await db.news.find_one({"id": news_id})
    return NewsItem(**localize_news_document(updated, existing.get("source_lang")))

@router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    result = await db.news.delete_one({"id": news_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News not found")
    return {"message": "News deleted"}
