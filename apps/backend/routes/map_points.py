from typing import Optional

from fastapi import APIRouter, Depends

from core.config import db
from helpers import get_current_user

router = APIRouter()

# ================================
# MAP DATA ENDPOINTS
# ================================

@router.get("/map/points")
async def get_map_points(
    category: Optional[str] = None,
    status: Optional[str] = None,
    my_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status
    if my_only:
        query["user_id"] = current_user["id"]
    
    requests = await db.requests.find(query).to_list(500)
    
    points = []
    for req in requests:
        points.append({
            "id": req["id"],
            "lat": req["latitude"],
            "lng": req["longitude"],
            "category": req["category_id"],
            "status": req["status"],
            "is_mine": req["user_id"] == current_user["id"],
            "title": req["problem_type"],
            "address": req["address"],
            "created_at": req["created_at"].isoformat()
        })
    
    return points
