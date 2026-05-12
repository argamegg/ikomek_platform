import logging
from datetime import timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.config import (
    EMAIL_VERIFICATION_EXPIRE_MINUTES,
    EMAIL_VERIFICATION_MAX_ATTEMPTS,
    EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    db,
)
from helpers import (
    build_registration_start_response,
    build_unverified_login_response,
    create_access_token,
    generate_verification_code,
    get_current_user,
    get_password_hash,
    hash_verification_code,
    normalize_email,
    normalize_language,
    seconds_until,
    send_verification_code_email,
    utcnow,
    verify_password,
)
from schemas import (
    LanguageUpdate,
    ROLE_CITIZEN,
    RegistrationStartResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    VerificationCodeRequest,
    VerificationResendRequest,
)

router = APIRouter()

# ================================
# AUTH ENDPOINTS
# ================================

@router.post("/auth/register", response_model=RegistrationStartResponse)
async def register(user_data: UserCreate):
    email = normalize_email(user_data.email)
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Only admins can create operator/admin accounts
    role = ROLE_CITIZEN if user_data.role not in [ROLE_CITIZEN] else user_data.role
    language = normalize_language(user_data.language)
    now = utcnow()
    pending = await db.pending_registrations.find_one({"email": email})
    registration_id = pending["id"] if pending else str(uuid.uuid4())
    pending_doc = {
        "id": registration_id,
        "email": email,
        "password": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "role": role,
        "language": language,
        "created_at": pending.get("created_at", now) if pending else now,
        "updated_at": now,
        "verification_attempts": pending.get("verification_attempts", 0) if pending else 0,
    }

    can_send_new_code = pending is None or seconds_until(pending.get("resend_available_at")) == 0
    if can_send_new_code:
        code = generate_verification_code()
        code_expires_at = now + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES)
        resend_available_at = now + timedelta(seconds=EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS)

        try:
            await send_verification_code_email(email, language, code)
        except Exception as error:
            logging.exception("Failed to send verification email")
            raise HTTPException(status_code=500, detail="Unable to send verification email") from error

        pending_doc.update(
            {
                "verification_code_hash": hash_verification_code(registration_id, code),
                "code_expires_at": code_expires_at,
                "code_sent_at": now,
                "resend_available_at": resend_available_at,
                "verification_attempts": 0,
                "verified_at": None,
            }
        )
    elif pending:
        pending_doc.update(
            {
                "verification_code_hash": pending["verification_code_hash"],
                "code_expires_at": pending["code_expires_at"],
                "code_sent_at": pending["code_sent_at"],
                "resend_available_at": pending["resend_available_at"],
                "verified_at": pending.get("verified_at"),
            }
        )

    await db.pending_registrations.update_one({"id": registration_id}, {"$set": pending_doc}, upsert=True)
    return build_registration_start_response(pending_doc)

@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    email = normalize_email(credentials.email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password"]):
        pending = await db.pending_registrations.find_one({"email": email})
        if pending and verify_password(credentials.password, pending["password"]):
            return build_unverified_login_response(pending)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("is_verified", True) is False:
        pending = await db.pending_registrations.find_one({"email": email})
        if pending:
            return build_unverified_login_response(pending)
        raise HTTPException(status_code=403, detail="Your account is not verified yet")

    access_token = create_access_token({"sub": user["id"]})

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            phone=user.get("phone"),
            role=user.get("role", ROLE_CITIZEN),
            language=user.get("language", "ru"),
            created_at=user["created_at"]
        )
    )

@router.post("/auth/verify-email", response_model=TokenResponse)
async def verify_email_code(payload: VerificationCodeRequest):
    pending = await db.pending_registrations.find_one({"id": payload.registration_id})
    if not pending:
        raise HTTPException(status_code=404, detail="Verification session not found")

    now = utcnow()
    if pending.get("code_expires_at") and pending["code_expires_at"] < now:
        raise HTTPException(status_code=400, detail="Code expired")

    attempts = int(pending.get("verification_attempts", 0))
    if attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many verification attempts. Request a new code.")

    expected_hash = pending.get("verification_code_hash", "")
    received_hash = hash_verification_code(payload.registration_id, payload.code.strip())
    if not expected_hash or received_hash != expected_hash:
        await db.pending_registrations.update_one(
            {"id": payload.registration_id},
            {"$set": {"updated_at": now}, "$inc": {"verification_attempts": 1}},
        )
        remaining_attempts = max(0, EMAIL_VERIFICATION_MAX_ATTEMPTS - attempts - 1)
        if remaining_attempts == 0:
            raise HTTPException(status_code=429, detail="Too many verification attempts. Request a new code.")
        raise HTTPException(status_code=400, detail="Invalid code")

    existing_user = await db.users.find_one({"email": pending["email"]})
    if existing_user:
        await db.pending_registrations.delete_one({"id": payload.registration_id})
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": pending["email"],
        "password": pending["password"],
        "full_name": pending["full_name"],
        "phone": pending.get("phone"),
        "role": pending.get("role", ROLE_CITIZEN),
        "language": normalize_language(pending.get("language")),
        "created_at": now,
        "onboarding_completed": False,
        "is_verified": True,
        "verified_at": now,
    }
    await db.users.insert_one(user_doc)
    await db.pending_registrations.delete_one({"id": payload.registration_id})

    access_token = create_access_token({"sub": user_id})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user_doc["email"],
            full_name=user_doc["full_name"],
            phone=user_doc.get("phone"),
            role=user_doc["role"],
            language=user_doc["language"],
            created_at=user_doc["created_at"],
        ),
    )

@router.post("/auth/resend-verification", response_model=RegistrationStartResponse)
async def resend_verification_code(payload: VerificationResendRequest):
    pending = await db.pending_registrations.find_one({"id": payload.registration_id})
    if not pending:
        raise HTTPException(status_code=404, detail="Verification session not found")

    now = utcnow()
    remaining_cooldown = seconds_until(pending.get("resend_available_at"))
    if remaining_cooldown > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {remaining_cooldown} seconds before requesting a new code",
        )

    code = generate_verification_code()
    code_expires_at = now + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES)
    resend_available_at = now + timedelta(seconds=EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS)

    try:
        await send_verification_code_email(pending["email"], normalize_language(pending.get("language")), code)
    except Exception as error:
        logging.exception("Failed to resend verification email")
        raise HTTPException(status_code=500, detail="Unable to send verification email") from error

    update_data = {
        "verification_code_hash": hash_verification_code(payload.registration_id, code),
        "code_expires_at": code_expires_at,
        "code_sent_at": now,
        "resend_available_at": resend_available_at,
        "verification_attempts": 0,
        "updated_at": now,
    }
    await db.pending_registrations.update_one({"id": payload.registration_id}, {"$set": update_data})
    pending.update(update_data)
    return build_registration_start_response(pending)

@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        phone=current_user.get("phone"),
        role=current_user.get("role", ROLE_CITIZEN),
        language=current_user.get("language", "ru"),
        created_at=current_user["created_at"]
    )

@router.put("/auth/profile")
async def update_profile(
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    update_data = {}
    if full_name:
        update_data["full_name"] = full_name
    if phone:
        update_data["phone"] = phone
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated"}

@router.put("/auth/language")
async def update_language(data: LanguageUpdate, current_user: dict = Depends(get_current_user)):
    if data.language not in ["ru", "kz", "en"]:
        raise HTTPException(status_code=400, detail="Invalid language")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"language": data.language}})
    return {"message": "Language updated", "language": data.language}

@router.put("/auth/onboarding")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"onboarding_completed": True}})
    return {"message": "Onboarding completed"}
