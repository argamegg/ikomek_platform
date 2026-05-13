from typing import List

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from helpers import get_current_user
from schemas import Message, MessageCreate, ROLE_ADMIN, ROLE_OPERATOR

router = APIRouter()

# ================================
# MESSAGES ENDPOINTS
# ================================

@router.get("/requests/{request_id}/messages", response_model=List[Message])
async def get_messages(request_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"request_id": request_id}).sort("created_at", 1).to_list(100)
    return [Message(**msg) for msg in messages]

@router.post("/requests/{request_id}/messages", response_model=Message)
async def send_message(request_id: str, message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    sender_type = "operator" if current_user.get("role") in [ROLE_OPERATOR, ROLE_ADMIN] else "user"
    
    message = Message(
        request_id=request_id,
        sender_type=sender_type,
        sender_id=current_user["id"],
        sender_name=current_user["full_name"],
        content=message_data.content
    )
    await db.messages.insert_one(message.dict())
    return message
