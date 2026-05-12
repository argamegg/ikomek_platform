from fastapi import APIRouter, Depends

from core.config import db
from helpers import require_role
from schemas import ROLE_ADMIN, ROLE_OPERATOR

router = APIRouter()

# ================================
# ANALYTICS - ADMIN
# ================================

@router.get("/admin/analytics")
async def get_analytics(current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    total_requests = await db.requests.count_documents({})
    pending = await db.requests.count_documents({"status": "pending"})
    in_progress = await db.requests.count_documents({"status": "in_progress"})
    closed = await db.requests.count_documents({"status": "closed"})
    
    # Category breakdown
    pipeline = [
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}}
    ]
    category_stats = await db.requests.aggregate(pipeline).to_list(20)
    
    # Users stats
    total_users = await db.users.count_documents({})
    operators = await db.users.count_documents({"role": ROLE_OPERATOR})
    admins = await db.users.count_documents({"role": ROLE_ADMIN})
    
    return {
        "requests": {
            "total": total_requests,
            "pending": pending,
            "in_progress": in_progress,
            "closed": closed
        },
        "categories": {item["_id"]: item["count"] for item in category_stats},
        "users": {
            "total": total_users,
            "citizens": total_users - operators - admins,
            "operators": operators,
            "admins": admins
        }
    }
