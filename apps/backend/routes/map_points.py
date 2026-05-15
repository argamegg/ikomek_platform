from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends

from core.config import db
from helpers import get_optional_current_user

router = APIRouter()

def parse_datetime(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None

# ================================
# MAP DATA ENDPOINTS
# ================================

@router.get("/map/points")
async def get_map_points(
    category: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 1000,
    my_only: bool = False,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status
    if my_only and current_user:
        query["user_id"] = current_user["id"]
    elif my_only:
        return []
    end = parse_datetime(date_to) or datetime.utcnow()
    start = parse_datetime(date_from) or end - timedelta(days=7)
    query["created_at"] = {"$gte": start, "$lte": end}
    
    safe_limit = 1000 if limit <= 0 else min(limit, 1000)
    requests = await db.requests.find(query).sort("created_at", -1).limit(safe_limit).to_list(safe_limit)
    
    points = []
    for req in requests:
        points.append({
            "id": req["id"],
            "lat": req["latitude"],
            "lng": req["longitude"],
            "category": req["category_id"],
            "status": req["status"],
            "is_mine": bool(current_user and req["user_id"] == current_user["id"]),
            "title": req["problem_type"],
            "address": req["address"],
            "created_at": req["created_at"].isoformat()
        })
    
    return points
