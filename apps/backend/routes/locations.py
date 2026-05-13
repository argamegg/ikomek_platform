from typing import List

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from helpers import get_current_user
from schemas import SavedLocation, SavedLocationCreate

router = APIRouter()

# ================================
# SAVED LOCATIONS ENDPOINTS
# ================================

@router.get("/locations", response_model=List[SavedLocation])
async def get_saved_locations(current_user: dict = Depends(get_current_user)):
    locations = await db.saved_locations.find({"user_id": current_user["id"]}).to_list(100)
    return [SavedLocation(**loc) for loc in locations]

@router.post("/locations", response_model=SavedLocation)
async def create_saved_location(location: SavedLocationCreate, current_user: dict = Depends(get_current_user)):
    loc_dict = location.dict()
    loc_obj = SavedLocation(user_id=current_user["id"], **loc_dict)
    await db.saved_locations.insert_one(loc_obj.dict())
    return loc_obj

@router.delete("/locations/{location_id}")
async def delete_saved_location(location_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.saved_locations.delete_one({"id": location_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted"}
