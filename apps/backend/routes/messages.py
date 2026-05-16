from typing import Dict, List, Set

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
import jwt

from core.config import ALGORITHM, SECRET_KEY, db
from helpers import get_current_user
from schemas import Message, MessageCreate, ROLE_ADMIN, ROLE_OPERATOR

router = APIRouter()


def can_access_request_chat(request: dict, current_user: dict) -> bool:
    if current_user.get("role") in [ROLE_OPERATOR, ROLE_ADMIN]:
        return True
    return request.get("user_id") == current_user.get("id")


def serialize_message(message: Message) -> dict:
    return message.model_dump(mode="json")


async def get_user_from_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if not user_id:
            return None
        return await db.users.find_one({"id": user_id})
    except jwt.InvalidTokenError:
        return None


class RequestChatConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, request_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(request_id, set()).add(websocket)

    def disconnect(self, request_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(request_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(request_id, None)

    async def broadcast(self, request_id: str, payload: dict) -> None:
        connections = list(self.active_connections.get(request_id, set()))
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:
                self.disconnect(request_id, websocket)


chat_manager = RequestChatConnectionManager()


async def ensure_chat_access(request_id: str, current_user: dict) -> dict:
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if not can_access_request_chat(request, current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return request


async def create_chat_message(
    request_id: str,
    message_data: MessageCreate,
    current_user: dict,
) -> Message:
    content = message_data.content.strip()
    attachment_url = (message_data.attachment_url or "").strip()
    attachment_label = (message_data.attachment_label or "").strip()
    attachment_type = (message_data.attachment_type or "image").strip() or "image"

    if not content and not attachment_url:
        raise HTTPException(status_code=400, detail="Message or attachment is required")

    sender_type = "operator" if current_user.get("role") in [ROLE_OPERATOR, ROLE_ADMIN] else "user"

    message = Message(
        request_id=request_id,
        sender_type=sender_type,
        sender_id=current_user["id"],
        sender_name=current_user.get("full_name") or current_user.get("display_name") or "",
        content=content,
        attachment_label=attachment_label or None,
        attachment_url=attachment_url or None,
        attachment_type=attachment_type if attachment_url else None,
    )
    await db.messages.insert_one(message.model_dump())
    await chat_manager.broadcast(
        request_id,
        {
            "type": "message",
            "message": serialize_message(message),
        },
    )
    return message


@router.get("/requests/{request_id}/messages", response_model=List[Message])
async def get_messages(request_id: str, current_user: dict = Depends(get_current_user)):
    await ensure_chat_access(request_id, current_user)
    messages = await db.messages.find({"request_id": request_id}).sort("created_at", 1).to_list(500)
    return [Message(**msg) for msg in messages]


@router.post("/requests/{request_id}/messages", response_model=Message)
async def send_message(
    request_id: str,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    await ensure_chat_access(request_id, current_user)
    return await create_chat_message(request_id, message_data, current_user)


@router.websocket("/requests/{request_id}/messages/ws")
async def request_messages_websocket(
    websocket: WebSocket,
    request_id: str,
    token: str = Query(default=""),
):
    current_user = await get_user_from_token(token)
    if not current_user:
        await websocket.close(code=1008)
        return

    try:
        await ensure_chat_access(request_id, current_user)
    except HTTPException:
        await websocket.close(code=1008)
        return

    await chat_manager.connect(request_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "request_id": request_id})
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif payload.get("type") == "message":
                message_data = MessageCreate(
                    content=str(payload.get("content") or ""),
                    attachment_label=payload.get("attachment_label"),
                    attachment_url=payload.get("attachment_url"),
                    attachment_type=payload.get("attachment_type") or "image",
                )
                await create_chat_message(request_id, message_data, current_user)
    except WebSocketDisconnect:
        chat_manager.disconnect(request_id, websocket)
    except Exception:
        chat_manager.disconnect(request_id, websocket)
        await websocket.close(code=1011)
