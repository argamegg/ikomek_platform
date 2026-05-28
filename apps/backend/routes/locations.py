from typing import List

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from geo import SAVED_LOCATION_OUT_OF_ZONE_ERROR, is_within_astana_request_zone
from helpers import get_current_user
from schemas import ROLE_CITIZEN, SavedLocation, SavedLocationCreate

router = APIRouter()
SAVED_LOCATION_TYPES = {"home", "work", "study", "family", "other"}

def _normalize_saved_location(location: dict) -> dict:
    name = location.get("name")
    if name not in SAVED_LOCATION_TYPES:
        location["name"] = "other"
    return location

def _require_citizen(current_user: dict):
    if current_user.get("role", ROLE_CITIZEN) != ROLE_CITIZEN:
        raise HTTPException(status_code=403, detail="Saved locations are available only for citizens")

# ================================
# SAVED LOCATIONS ENDPOINTS
# ================================

@router.get("/locations", response_model=List[SavedLocation])
async def get_saved_locations(current_user: dict = Depends(get_current_user)):
    if current_user.get("role", ROLE_CITIZEN) != ROLE_CITIZEN:
        return []

    locations = await db.saved_locations.find({"user_id": current_user["id"]}).to_list(100)
    return [SavedLocation(**_normalize_saved_location(loc)) for loc in locations]

@router.post("/locations", response_model=SavedLocation)
async def create_saved_location(location: SavedLocationCreate, current_user: dict = Depends(get_current_user)):
    _require_citizen(current_user)
    if location.name not in SAVED_LOCATION_TYPES:
        raise HTTPException(status_code=422, detail="Invalid saved location type")
    if not is_within_astana_request_zone(location.latitude, location.longitude):
        raise HTTPException(status_code=422, detail=SAVED_LOCATION_OUT_OF_ZONE_ERROR)

    loc_dict = location.dict()
    loc_obj = SavedLocation(user_id=current_user["id"], **loc_dict)
    await db.saved_locations.insert_one(loc_obj.dict())
    return loc_obj

@router.delete("/locations/{location_id}")
async def delete_saved_location(location_id: str, current_user: dict = Depends(get_current_user)):
    _require_citizen(current_user)
    result = await db.saved_locations.delete_one({"id": location_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted"}
