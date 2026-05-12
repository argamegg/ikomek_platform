import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from helpers import get_optional_current_user
from schemas import AIAssistantAction, AIAssistantRequest, AIAssistantResponse
from services.ai_assistant import AIAssistantError, generate_ai_assistant_reply

router = APIRouter()

# ================================
# AI ASSISTANT ENDPOINTS
# ================================

@router.post("/ai/assistant", response_model=AIAssistantResponse)
async def ai_assistant(
    payload: AIAssistantRequest,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    try:
        reply, configured, model, actions = await generate_ai_assistant_reply(
            message=payload.message.strip(),
            history=[item.dict() for item in payload.history],
            locale=payload.locale,
            current_user=current_user,
            user_role=current_user.get("role") if current_user else None,
        )
    except AIAssistantError as error:
        logging.exception("AI assistant request failed")
        raise HTTPException(status_code=502, detail=str(error)) from error

    return AIAssistantResponse(
        reply=reply,
        configured=configured,
        model=model,
        actions=[AIAssistantAction(**action) for action in actions],
    )
