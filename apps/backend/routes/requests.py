from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.config import db
from data import CATEGORIES
from geo import REQUEST_OUT_OF_ZONE_ERROR, is_within_astana_request_zone
from helpers import (
    get_current_user,
    localize_request_document,
    normalize_translation_language,
    require_role,
)
from schemas import ROLE_ADMIN, ROLE_OPERATOR, RequestCreate, RequestModel, StatusUpdate
from services.translation import translate_to_all_languages

router = APIRouter()

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
    return [RequestModel(**localize_request_document(req, lang)) for req in requests]

@router.get("/requests/all", response_model=List[RequestModel])
async def get_all_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    lang: str = "ru",
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status
    
    requests = await db.requests.find(query).sort("created_at", -1).to_list(500)
    return [RequestModel(**localize_request_document(req, lang)) for req in requests]

@router.get("/requests/{request_id}", response_model=RequestModel)
async def get_request(request_id: str, lang: str = "ru", current_user: dict = Depends(get_current_user)):
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return RequestModel(**localize_request_document(request, lang))

# ================================
# REQUESTS ENDPOINTS - OPERATOR
# ================================

@router.get("/operator/requests")
async def get_operator_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
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
        query["priority"] = priority
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
    if status_update.priority:
        update_data["priority"] = status_update.priority
    
    await db.requests.update_one({"id": request_id}, {"$set": update_data})
    return {"message": "Request updated"}
