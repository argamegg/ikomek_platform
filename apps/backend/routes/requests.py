from collections import defaultdict, deque
from datetime import datetime, timedelta
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from core.config import db
from data import CATEGORIES
from geo import REQUEST_OUT_OF_ZONE_ERROR, is_within_astana_request_zone
from helpers import (
    get_optional_current_user,
    get_current_user,
    localize_request_document,
    normalize_translation_language,
    require_role,
)
from schemas import ROLE_ADMIN, ROLE_OPERATOR, Priority, RequestCreate, RequestModel, StatusUpdate
from services.translation import translate_to_all_languages

router = APIRouter()
MAP_REQUEST_LIMIT = 1000
MAP_RATE_LIMIT = 30
MAP_RATE_WINDOW_SECONDS = 60
REQUEST_LIST_RATE_LIMIT = 45
REQUEST_LIST_RATE_WINDOW_SECONDS = 60
_map_rate_hits: defaultdict[str, deque[float]] = defaultdict(deque)
_request_list_rate_hits: defaultdict[str, deque[float]] = defaultdict(deque)

def _parse_datetime(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None

def _serialize_datetime(value):
    parsed = _parse_datetime(value)
    return parsed.isoformat() if parsed else None

def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"

def _rate_limit_by_ip(
    request: Request,
    hits_by_ip: defaultdict[str, deque[float]],
    limit: int,
    window_seconds: int,
    detail: str,
):
    ip = _client_ip(request)
    now = time.monotonic()
    hits = hits_by_ip[ip]

    while hits and now - hits[0] > window_seconds:
        hits.popleft()

    if len(hits) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )

    hits.append(now)

def rate_limit_map_requests(request: Request):
    _rate_limit_by_ip(
        request,
        _map_rate_hits,
        MAP_RATE_LIMIT,
        MAP_RATE_WINDOW_SECONDS,
        "Too many map requests. Please try again later.",
    )

def rate_limit_request_list(request: Request):
    _rate_limit_by_ip(
        request,
        _request_list_rate_hits,
        REQUEST_LIST_RATE_LIMIT,
        REQUEST_LIST_RATE_WINDOW_SECONDS,
        "Too many request list refreshes. Please try again later.",
    )

async def attach_citizen_names(requests: List[dict]) -> List[dict]:
    user_ids = sorted({
        request.get("user_id")
        for request in requests
        if request.get("user_id")
    })
    if not user_ids:
        return requests

    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "full_name": 1, "name": 1, "email": 1},
    ).to_list(None)
    names_by_id = {
        user.get("id"): user.get("full_name") or user.get("name") or user.get("email") or ""
        for user in users
        if user.get("id")
    }

    for request in requests:
        request["citizen_name"] = names_by_id.get(request.get("user_id"), "")

    return requests

def _date_range_query(date_from: Optional[str], date_to: Optional[str], default_last_days: Optional[int] = None) -> dict:
    end = _parse_datetime(date_to) if date_to else None
    start = _parse_datetime(date_from) if date_from else None

    if default_last_days is not None:
        end = end or datetime.utcnow()
        start = start or end - timedelta(days=default_last_days)

    created_at = {}
    if start:
        created_at["$gte"] = start
    if end:
        created_at["$lte"] = end

    return {"created_at": created_at} if created_at else {}

def _map_request_document(request: dict, current_user: Optional[dict] = None) -> dict:
    role = current_user.get("role") if current_user else None
    is_staff = role in {ROLE_OPERATOR, ROLE_ADMIN}
    is_mine = bool(current_user and request.get("user_id") == current_user.get("id"))
    created_at = _serialize_datetime(request.get("created_at"))

    return {
        "id": request.get("id", ""),
        "lat": request.get("latitude"),
        "lng": request.get("longitude"),
        "latitude": request.get("latitude"),
        "longitude": request.get("longitude"),
        "status": request.get("status", "pending"),
        "priority": request.get("priority", "medium"),
        "category": request.get("category_id", ""),
        "category_id": request.get("category_id", ""),
        "category_name": request.get("category_name", ""),
        "address": request.get("address", ""),
        "created_at": created_at,
        "createdAt": created_at,
        "title": request.get("problem_type", ""),
        "problem_type": request.get("problem_type", ""),
        "user_id": request.get("user_id", "") if (is_staff or is_mine) else "",
        "is_mine": is_mine,
    }

def _map_projection() -> dict:
    return {
        "_id": 0,
        "id": 1,
        "user_id": 1,
        "latitude": 1,
        "longitude": 1,
        "status": 1,
        "priority": 1,
        "category_id": 1,
        "category_name": 1,
        "address": 1,
        "created_at": 1,
        "problem_type": 1,
    }

def _last_six_month_keys():
    now = datetime.utcnow()
    months = []
    for offset in range(5, -1, -1):
        month = now.month - offset
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        months.append(f"{year}-{month:02d}")
    return months

def visible_request_document(request: dict, lang: str, current_user: Optional[dict] = None) -> dict:
    document = localize_request_document(request, lang)
    role = current_user.get("role") if current_user else None
    is_staff = role in {ROLE_OPERATOR, ROLE_ADMIN}
    is_owner = bool(current_user and document.get("user_id") == current_user.get("id"))

    if not is_staff:
        document["operator_notes"] = None
    if current_user is None:
        document["citizen_name"] = None
    if not is_staff and not is_owner:
        document["user_id"] = ""

    return document

# ================================
# REQUESTS ENDPOINTS - CITIZEN
# ================================

@router.post("/requests", response_model=RequestModel)
async def create_request(request_data: RequestCreate, current_user: dict = Depends(get_current_user)):
    if not is_within_astana_request_zone(request_data.latitude, request_data.longitude):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=REQUEST_OUT_OF_ZONE_ERROR,
        )

    category = next((c for c in CATEGORIES if c["id"] == request_data.category_id), None)
    category_name = category["name_ru"] if category else "Другое"
    request_dict = request_data.dict()
    source_lang = normalize_translation_language(request_dict.get("source_lang", "ru"))
    description = request_dict.get("description", "")

    if description:
        translations = await translate_to_all_languages(description, source_lang)
        request_dict["description_ru"] = translations["ru"]
        request_dict["description_kz"] = translations["kk"]
        request_dict["description_en"] = translations["en"]

    request_obj = RequestModel(
        user_id=current_user["id"],
        category_id=request_data.category_id,
        category_name=category_name,
        address=request_data.address,
        latitude=request_data.latitude,
        longitude=request_data.longitude,
        place_type=request_data.place_type,
        problem_type=request_data.problem_type,
        reason=request_data.reason,
        description=description,
        description_ru=request_dict.get("description_ru"),
        description_kz=request_dict.get("description_kz"),
        description_en=request_dict.get("description_en"),
        source_lang=source_lang,
        photos=request_data.photos
    )
    await db.requests.insert_one(request_obj.dict())
    return request_obj

@router.get("/requests", response_model=List[RequestModel])
async def get_user_requests(lang: str = "ru", current_user: dict = Depends(get_current_user)):
    requests = await db.requests.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    for request in requests:
        request["citizen_name"] = current_user.get("full_name") or current_user.get("name") or current_user.get("email") or ""
    return [RequestModel(**visible_request_document(req, lang, current_user)) for req in requests]

@router.get("/requests/all", dependencies=[Depends(rate_limit_request_list)])
async def get_all_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 0,
    map: bool = False,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    lang: str = "ru",
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status

    query.update(_date_range_query(date_from, date_to))

    projection = _map_projection() if map else None
    cursor = db.requests.find(query, projection).sort("created_at", -1)
    if limit > 0:
        cursor = cursor.limit(limit)
    
    requests = await cursor.to_list(limit if limit > 0 else None)
    if map:
        return [_map_request_document(req, current_user) for req in requests]

    requests = await attach_citizen_names(requests)
    return [RequestModel(**visible_request_document(req, lang, current_user)) for req in requests]

@router.get("/requests/map", dependencies=[Depends(rate_limit_map_requests)])
async def get_map_requests(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = MAP_REQUEST_LIMIT,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    query = _date_range_query(date_from, date_to, default_last_days=7)
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status

    safe_limit = MAP_REQUEST_LIMIT if limit <= 0 else min(limit, MAP_REQUEST_LIMIT)
    cursor = db.requests.find(query, _map_projection()).sort("created_at", -1)
    if safe_limit > 0:
        cursor = cursor.limit(safe_limit)

    requests = await cursor.to_list(safe_limit if safe_limit > 0 else None)
    return [_map_request_document(req, current_user) for req in requests]

@router.get("/requests/{request_id}", response_model=RequestModel)
async def get_request(
    request_id: str,
    lang: str = "ru",
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    await attach_citizen_names([request])
    return RequestModel(**visible_request_document(request, lang, current_user))

# ================================
# REQUESTS ENDPOINTS - OPERATOR
# ================================

@router.get("/admin/platform-stats")
async def get_admin_platform_stats(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    total_requests = await db.requests.count_documents({})
    pending = await db.requests.count_documents({"status": "pending"})
    in_progress = await db.requests.count_documents({"status": "in_progress"})
    closed = await db.requests.count_documents({"status": "closed"})
    total_users = await db.users.count_documents({"role": "citizen"})
    total_operators = await db.users.count_documents({"role": "operator"})

    all_requests = await db.requests.find({}).to_list(10000)
    category_counts = {}
    category_names = {}
    month_keys = _last_six_month_keys()
    monthly_counts = {month: 0 for month in month_keys}

    for request in all_requests:
        category_id = request.get("category_id") or "other"
        category_counts[category_id] = category_counts.get(category_id, 0) + 1
        category_names[category_id] = request.get("category_name") or category_id

        created_at = _parse_datetime(request.get("created_at"))
        if not created_at:
            continue
        month_key = f"{created_at.year}-{created_at.month:02d}"
        if month_key in monthly_counts:
            monthly_counts[month_key] += 1

    top_categories = [
        {"id": category_id, "name": category_names.get(category_id, category_id), "count": count}
        for category_id, count in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    operators = await db.users.find({"role": "operator"}).to_list(500)
    operators_workload = []
    for operator in operators:
        operator_id = operator.get("id")
        if not operator_id:
            continue

        operator_query = {"operator_id": operator_id}
        operator_in_progress = await db.requests.count_documents({**operator_query, "status": "in_progress"})
        operator_closed = await db.requests.count_documents({**operator_query, "status": "closed"})
        operator_total = await db.requests.count_documents(operator_query)
        operators_workload.append({
            "operator_id": operator_id,
            "operator_name": operator.get("full_name") or operator.get("email") or operator_id,
            "in_progress": operator_in_progress,
            "closed": operator_closed,
            "total": operator_total,
        })

    operators_workload.sort(key=lambda item: item["total"], reverse=True)

    return {
        "total_requests": total_requests,
        "pending": pending,
        "in_progress": in_progress,
        "closed": closed,
        "total_users": total_users,
        "total_operators": total_operators,
        "top_categories": top_categories,
        "monthly_activity": [
            {"month": month, "count": monthly_counts[month]}
            for month in month_keys
        ],
        "operators_workload": operators_workload,
    }

@router.get("/operator/my-stats")
async def get_operator_my_stats(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != ROLE_OPERATOR:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    operator_id = current_user["id"]
    assigned_query = {"operator_id": operator_id}
    pending_queue_query = {
        "status": "pending",
        "$or": [
            {"operator_id": None},
            {"operator_id": {"$exists": False}},
        ],
    }

    total_assigned = await db.requests.count_documents(assigned_query)
    in_progress = await db.requests.count_documents({**assigned_query, "status": "in_progress"})
    closed = await db.requests.count_documents({**assigned_query, "status": "closed"})
    pending_queue = await db.requests.count_documents(pending_queue_query)

    operator_requests = await db.requests.find(assigned_query).sort("updated_at", -1).to_list(500)
    closed_durations = []
    for request in operator_requests:
        if request.get("status") != "closed":
            continue
        created_at = _parse_datetime(request.get("created_at"))
        closed_at = _parse_datetime(request.get("closed_at")) or _parse_datetime(request.get("updated_at"))
        if created_at and closed_at:
            closed_durations.append(max((closed_at - created_at).total_seconds(), 0) / 86400)

    avg_close_days = 0
    if closed_durations:
        avg_close_days = round(sum(closed_durations) / len(closed_durations), 1)

    month_keys = _last_six_month_keys()
    monthly_counts = {month: 0 for month in month_keys}
    for request in operator_requests:
        created_at = _parse_datetime(request.get("created_at"))
        if not created_at:
            continue
        month_key = f"{created_at.year}-{created_at.month:02d}"
        if month_key in monthly_counts:
            monthly_counts[month_key] += 1

    recent_requests = []
    for request in operator_requests[:5]:
        recent_requests.append({
            "id": request.get("id"),
            "address": request.get("address", ""),
            "category_name": request.get("category_name", ""),
            "status": request.get("status", "pending"),
            "created_at": _serialize_datetime(request.get("created_at")),
            "updated_at": _serialize_datetime(request.get("updated_at")),
        })

    return {
        "total_assigned": total_assigned,
        "in_progress": in_progress,
        "closed": closed,
        "pending_queue": pending_queue,
        "avg_close_days": avg_close_days,
        "monthly_activity": [
            {"month": month, "count": monthly_counts[month]}
            for month in month_keys
        ],
        "recent_requests": recent_requests,
    }

@router.get("/operator/requests")
async def get_operator_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[Priority] = None,
    district: Optional[str] = None,
    lang: str = "ru",
    current_user: dict = Depends(require_role([ROLE_OPERATOR, ROLE_ADMIN]))
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority.value
    if district:
        query["district"] = district
    
    requests = await db.requests.find(query).sort("created_at", -1).to_list(500)
    return [RequestModel(**localize_request_document(req, lang)) for req in requests]

@router.put("/operator/requests/{request_id}")
async def update_request_operator(
    request_id: str,
    status_update: StatusUpdate,
    current_user: dict = Depends(require_role([ROLE_OPERATOR, ROLE_ADMIN]))
):
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {
        "status": status_update.status,
        "updated_at": datetime.utcnow(),
        "operator_id": current_user["id"]
    }
    
    if status_update.status == "closed":
        update_data["closed_at"] = datetime.utcnow()
    if status_update.resolution_notes:
        update_data["resolution_notes"] = status_update.resolution_notes
    if status_update.operator_notes:
        update_data["operator_notes"] = status_update.operator_notes
    if status_update.assigned_department:
        update_data["assigned_department"] = status_update.assigned_department
    if status_update.priority is not None:
        update_data["priority"] = status_update.priority.value
    
    await db.requests.update_one({"id": request_id}, {"$set": update_data})
    return {"message": "Request updated"}
