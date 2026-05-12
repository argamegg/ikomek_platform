from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from helpers import require_role
from schemas import ROLE_ADMIN, ROLE_CITIZEN, ROLE_OPERATOR

router = APIRouter()

# ================================
# ADMIN: USER MANAGEMENT
# ================================

@router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    users = await db.users.find().to_list(1000)
    return [{
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "role": u.get("role", ROLE_CITIZEN),
        "created_at": u["created_at"]
    } for u in users]

@router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    if role not in [ROLE_CITIZEN, ROLE_OPERATOR, ROLE_ADMIN]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User role updated to {role}"}
