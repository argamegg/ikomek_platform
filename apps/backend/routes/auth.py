import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional
import uuid

import httpx
import jwt
from jwt import PyJWKClient
from fastapi import APIRouter, Body, Depends, HTTPException

from core.config import (
    CLERK_API_URL,
    CLERK_AUTHORIZED_PARTIES,
    CLERK_JWT_ISSUER,
    CLERK_SECRET_KEY,
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
    ClerkSessionLogin,
    LanguageUpdate,
    PasswordChange,
    PasswordSet,
    ROLE_CITIZEN,
    RegistrationStartResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserProfileUpdate,
    UserResponse,
    VerificationCodeRequest,
    VerificationResendRequest,
)

router = APIRouter()

PROFILE_NAME_RE = re.compile(r"^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]+$")
KZ_PHONE_RE = re.compile(r"^7\d{10}$")
MIN_BIRTH_DATE = date(1900, 1, 1)
JWKS_CLIENTS: dict[str, PyJWKClient] = {}


def user_has_local_password(user: dict) -> bool:
    return bool(user.get("has_local_password", not user.get("clerk_user_id")))


def validate_profile_full_name(full_name: str) -> str:
    normalized = " ".join(full_name.strip().split())
    parts = normalized.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Enter first and last name")
    if any(not PROFILE_NAME_RE.fullmatch(part) for part in parts):
        raise HTTPException(status_code=400, detail="First and last name must contain letters only")
    return normalized


def normalize_profile_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone.strip())
    if len(digits) == 11 and digits.startswith("8"):
        digits = f"7{digits[1:]}"
    if digits and not KZ_PHONE_RE.fullmatch(digits):
        raise HTTPException(status_code=400, detail="Phone must be a Kazakhstan number: 11 digits starting with 7")
    return digits


def build_phone_match_query(phone: str) -> dict:
    phone_pattern = r"^\D*" + r"\D*".join(re.escape(digit) for digit in phone) + r"\D*$"
    return {"$or": [{"phone": phone}, {"phone": {"$regex": phone_pattern}}]}


async def find_auth_documents(identifier: str) -> tuple[Optional[dict], Optional[dict], Optional[str]]:
    normalized = identifier.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Enter email or Kazakhstan phone number")

    if "@" in normalized:
        email = normalize_email(normalized)
        user = await db.users.find_one({"email": email})
        pending = await db.pending_registrations.find_one({"email": email})
        return user, pending, email

    phone = normalize_profile_phone(normalized)
    if not phone:
        raise HTTPException(status_code=400, detail="Enter email or Kazakhstan phone number")

    phone_query = build_phone_match_query(phone)
    user = await db.users.find_one(phone_query)
    pending = await db.pending_registrations.find_one(phone_query)
    return user, pending, user.get("email") if user else pending.get("email") if pending else None


def build_token_response(user: dict) -> TokenResponse:
    access_token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            phone=user.get("phone"),
            display_name=user.get("display_name"),
            gender=user.get("gender"),
            birth_date=user.get("birth_date"),
            avatar_url=user.get("avatar_url"),
            role=user.get("role", ROLE_CITIZEN),
            language=user.get("language", "ru"),
            has_local_password=user_has_local_password(user),
            created_at=user["created_at"],
        ),
    )


def verify_clerk_session_token(token: str) -> dict:
    try:
        unverified_claims = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
    except jwt.InvalidTokenError as error:
        raise HTTPException(status_code=401, detail="Invalid Clerk session token") from error

    issuer = str(unverified_claims.get("iss", "")).rstrip("/")
    if not issuer or not issuer.startswith("https://"):
        raise HTTPException(status_code=401, detail="Invalid Clerk session issuer")
    if CLERK_JWT_ISSUER and issuer != CLERK_JWT_ISSUER:
        raise HTTPException(status_code=401, detail="Clerk session issuer is not allowed")

    jwks_url = f"{issuer}/.well-known/jwks.json"
    if jwks_url not in JWKS_CLIENTS:
        JWKS_CLIENTS[jwks_url] = PyJWKClient(jwks_url, timeout=8)

    try:
        signing_key = JWKS_CLIENTS[jwks_url].get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )
    except jwt.PyJWKClientError as error:
        raise HTTPException(status_code=502, detail="Unable to verify Clerk session") from error
    except jwt.InvalidTokenError as error:
        raise HTTPException(status_code=401, detail="Invalid Clerk session token") from error

    authorized_party = str(claims.get("azp", ""))
    if CLERK_AUTHORIZED_PARTIES and authorized_party not in CLERK_AUTHORIZED_PARTIES:
        raise HTTPException(status_code=401, detail="Clerk session origin is not allowed")

    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Clerk user id is missing")

    return claims


def extract_clerk_email(user_data: dict) -> Optional[str]:
    primary_email_id = user_data.get("primary_email_address_id")
    email_addresses = user_data.get("email_addresses") or []
    primary_email = next(
        (
            email
            for email in email_addresses
            if primary_email_id and email.get("id") == primary_email_id
        ),
        None,
    )
    selected_email = primary_email or (email_addresses[0] if email_addresses else None)
    if not selected_email:
        return None
    email = selected_email.get("email_address")
    return normalize_email(email) if email else None


def extract_clerk_name(user_data: dict) -> str:
    first_name = str(user_data.get("first_name") or "").strip()
    last_name = str(user_data.get("last_name") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    return full_name or str(user_data.get("username") or "").strip()


def extract_clerk_metadata(user_data: dict) -> dict:
    metadata = {}
    for field in ["public_metadata", "unsafe_metadata", "private_metadata"]:
        value = user_data.get(field)
        if isinstance(value, dict):
            metadata.update(value)
    return metadata


def first_non_empty(*values: object) -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def extract_clerk_first_name(user_data: dict) -> str:
    metadata = extract_clerk_metadata(user_data)
    return first_non_empty(user_data.get("first_name"), metadata.get("first_name"), metadata.get("firstName"))


def extract_clerk_last_name(user_data: dict) -> str:
    metadata = extract_clerk_metadata(user_data)
    return first_non_empty(user_data.get("last_name"), metadata.get("last_name"), metadata.get("lastName"))


def extract_clerk_phone(user_data: dict) -> Optional[str]:
    metadata = extract_clerk_metadata(user_data)
    primary_phone_id = user_data.get("primary_phone_number_id")
    phone_numbers = user_data.get("phone_numbers") or []
    primary_phone = next(
        (
            phone
            for phone in phone_numbers
            if primary_phone_id and phone.get("id") == primary_phone_id
        ),
        None,
    )
    selected_phone = primary_phone or (phone_numbers[0] if phone_numbers else None)
    phone_value = first_non_empty(
        selected_phone.get("phone_number") if selected_phone else None,
        metadata.get("phone"),
        metadata.get("phone_number"),
        metadata.get("phoneNumber"),
    )
    if not phone_value:
        return None
    try:
        return normalize_profile_phone(phone_value) or None
    except HTTPException:
        return None


def extract_clerk_gender(user_data: dict) -> Optional[str]:
    metadata = extract_clerk_metadata(user_data)
    normalized = first_non_empty(
        user_data.get("gender"),
        user_data.get("sex"),
        metadata.get("gender"),
        metadata.get("sex"),
    ).lower()
    if normalized in ["male", "m", "man", "мужской", "ер"]:
        return "male"
    if normalized in ["female", "f", "woman", "женский", "әйел"]:
        return "female"
    return None


def normalize_optional_gender(gender: Optional[str]) -> Optional[str]:
    if not gender:
        return None
    return extract_clerk_gender({"gender": gender})


def extract_clerk_birth_date(user_data: dict) -> Optional[str]:
    metadata = extract_clerk_metadata(user_data)
    birth_date = first_non_empty(
        user_data.get("birth_date"),
        user_data.get("birthday"),
        user_data.get("date_of_birth"),
        metadata.get("birth_date"),
        metadata.get("birthDate"),
        metadata.get("birthday"),
        metadata.get("date_of_birth"),
    )
    if not birth_date:
        return None
    try:
        return validate_profile_birth_date(birth_date) or None
    except HTTPException:
        return None


def extract_clerk_avatar(user_data: dict) -> str:
    external_accounts = user_data.get("external_accounts") or []
    first_external = external_accounts[0] if external_accounts else {}
    return first_non_empty(
        user_data.get("image_url"),
        user_data.get("profile_image_url"),
        first_external.get("image_url") if isinstance(first_external, dict) else None,
        first_external.get("avatar_url") if isinstance(first_external, dict) else None,
    )


async def fetch_clerk_user(clerk_user_id: str) -> Optional[dict]:
    if not CLERK_SECRET_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{CLERK_API_URL}/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as error:
        logging.exception("Failed to fetch Clerk user")
        raise HTTPException(status_code=502, detail="Unable to fetch Clerk user profile") from error


def fallback_clerk_email(clerk_user_id: str) -> str:
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", clerk_user_id)[:48] or "user"
    return f"clerk-{safe_id}@ikomek.local"


def validate_profile_birth_date(birth_date: str) -> str:
    normalized = birth_date.strip()
    if not normalized:
        return ""
    try:
        parsed = datetime.strptime(normalized, "%Y-%m-%d").date()
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Birth date must use YYYY-MM-DD format") from error
    if parsed < MIN_BIRTH_DATE or parsed > date.today():
        raise HTTPException(status_code=400, detail="Birth date is out of allowed range")
    return normalized

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
    phone = normalize_profile_phone(user_data.phone) if user_data.phone else None
    now = utcnow()
    pending = await db.pending_registrations.find_one({"email": email})
    registration_id = pending["id"] if pending else str(uuid.uuid4())
    pending_doc = {
        "id": registration_id,
        "email": email,
        "password": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "phone": phone,
        "role": role,
        "language": language,
        "has_local_password": True,
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
    user, pending, email = await find_auth_documents(credentials.email)
    if not user or not verify_password(credentials.password, user["password"]):
        if pending and verify_password(credentials.password, pending["password"]):
            return build_unverified_login_response(pending)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("is_verified", True) is False:
        pending = await db.pending_registrations.find_one({"email": email}) if email else None
        if pending:
            return build_unverified_login_response(pending)
        raise HTTPException(status_code=403, detail="Your account is not verified yet")

    if not user.get("has_local_password", True):
        await db.users.update_one({"id": user["id"]}, {"$set": {"has_local_password": True, "updated_at": utcnow()}})
        user["has_local_password"] = True

    return build_token_response(user)


@router.post("/auth/clerk", response_model=TokenResponse)
async def clerk_login(payload: ClerkSessionLogin):
    claims = verify_clerk_session_token(payload.token)
    clerk_user_id = claims["sub"]
    now = utcnow()

    clerk_user = await fetch_clerk_user(clerk_user_id)
    profile_email = extract_clerk_email(clerk_user) if clerk_user else None
    profile_name = extract_clerk_name(clerk_user) if clerk_user else ""
    profile_first_name = extract_clerk_first_name(clerk_user) if clerk_user else ""
    profile_last_name = extract_clerk_last_name(clerk_user) if clerk_user else ""
    profile_phone = extract_clerk_phone(clerk_user) if clerk_user else None
    profile_gender = extract_clerk_gender(clerk_user) if clerk_user else None
    profile_birth_date = extract_clerk_birth_date(clerk_user) if clerk_user else None
    profile_avatar = extract_clerk_avatar(clerk_user) if clerk_user else ""

    fallback_email = normalize_email(payload.email) if payload.email else None
    full_name = profile_name or (payload.full_name or "").strip() or "iKOMEK user"
    fallback_phone = None
    if payload.phone:
        try:
            fallback_phone = normalize_profile_phone(payload.phone) or None
        except HTTPException:
            fallback_phone = None
    fallback_birth_date = None
    if payload.birth_date:
        try:
            fallback_birth_date = validate_profile_birth_date(payload.birth_date) or None
        except HTTPException:
            fallback_birth_date = None
    avatar_url = profile_avatar or (payload.avatar_url or "").strip()
    email = profile_email or fallback_email or fallback_clerk_email(clerk_user_id)
    phone = profile_phone or fallback_phone
    gender = profile_gender or normalize_optional_gender(payload.gender)
    birth_date = profile_birth_date or fallback_birth_date

    user = await db.users.find_one({"clerk_user_id": clerk_user_id})
    if not user and profile_email:
        user = await db.users.find_one({"email": profile_email})

    if not user and fallback_email:
        existing_email_user = await db.users.find_one({"email": fallback_email})
        if existing_email_user:
            raise HTTPException(
                status_code=409,
                detail="Add CLERK_SECRET_KEY to the backend to link this existing iKOMEK email account safely.",
            )

    if user:
        update_data = {
            "clerk_user_id": clerk_user_id,
            "updated_at": now,
            "is_verified": True,
        }
        if profile_email and user.get("email") != profile_email:
            update_data["email"] = profile_email
        if profile_first_name:
            update_data["first_name"] = profile_first_name
        if profile_last_name:
            update_data["last_name"] = profile_last_name
        if full_name and user.get("full_name") in [None, "", "iKOMEK user"]:
            update_data["full_name"] = full_name
        if phone and not user.get("phone"):
            update_data["phone"] = phone
        if gender and not user.get("gender"):
            update_data["gender"] = gender
        if birth_date and not user.get("birth_date"):
            update_data["birth_date"] = birth_date
        if avatar_url:
            update_data["avatar_url"] = avatar_url
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
        user = await db.users.find_one({"id": user["id"]})
        return build_token_response(user)

    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": get_password_hash(str(uuid.uuid4())),
        "full_name": full_name,
        "first_name": profile_first_name or None,
        "last_name": profile_last_name or None,
        "phone": phone,
        "gender": gender,
        "birth_date": birth_date,
        "role": ROLE_CITIZEN,
        "language": "ru",
        "has_local_password": False,
        "created_at": now,
        "updated_at": now,
        "is_verified": True,
        "clerk_user_id": clerk_user_id,
        "avatar_url": avatar_url or None,
    }
    await db.users.insert_one(user_doc)
    return build_token_response(user_doc)

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
        "has_local_password": True,
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
            display_name=user_doc.get("display_name"),
            gender=user_doc.get("gender"),
            birth_date=user_doc.get("birth_date"),
            avatar_url=user_doc.get("avatar_url"),
            role=user_doc["role"],
            language=user_doc["language"],
            has_local_password=user_has_local_password(user_doc),
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
        display_name=current_user.get("display_name"),
        gender=current_user.get("gender"),
        birth_date=current_user.get("birth_date"),
        avatar_url=current_user.get("avatar_url"),
        role=current_user.get("role", ROLE_CITIZEN),
        language=current_user.get("language", "ru"),
        has_local_password=user_has_local_password(current_user),
        created_at=current_user["created_at"]
    )

@router.put("/auth/profile")
async def update_profile(
    data: Optional[UserProfileUpdate] = Body(default=None),
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    display_name: Optional[str] = None,
    gender: Optional[str] = None,
    birth_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if data:
        full_name = data.full_name if data.full_name is not None else full_name
        phone = data.phone if data.phone is not None else phone
        display_name = data.display_name if data.display_name is not None else display_name
        gender = data.gender if data.gender is not None else gender
        birth_date = data.birth_date if data.birth_date is not None else birth_date
        avatar_url = data.avatar_url
    else:
        avatar_url = None

    if full_name is not None:
        full_name = validate_profile_full_name(full_name)
    if phone is not None:
        phone = normalize_profile_phone(phone)
    if birth_date is not None:
        birth_date = validate_profile_birth_date(birth_date)

    update_data = {}
    if full_name is not None:
        update_data["full_name"] = full_name
    if phone is not None:
        update_data["phone"] = phone
    if display_name is not None:
        update_data["display_name"] = display_name
    if gender is not None:
        update_data["gender"] = gender
    if birth_date is not None:
        update_data["birth_date"] = birth_date
    if avatar_url is not None:
        update_data["avatar_url"] = avatar_url
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated"}

@router.put("/auth/language")
async def update_language(data: LanguageUpdate, current_user: dict = Depends(get_current_user)):
    if data.language not in ["ru", "kz", "en"]:
        raise HTTPException(status_code=400, detail="Invalid language")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"language": data.language}})
    return {"message": "Language updated", "language": data.language}

@router.put("/auth/password")
async def update_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": get_password_hash(data.new_password), "has_local_password": True, "updated_at": utcnow()}},
    )
    return {"message": "Password updated"}


@router.put("/auth/local-password", response_model=UserResponse)
async def set_local_password(data: PasswordSet, current_user: dict = Depends(get_current_user)):
    if user_has_local_password(current_user):
        raise HTTPException(status_code=400, detail="Use password change to update an existing password")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": get_password_hash(data.new_password), "has_local_password": True, "updated_at": utcnow()}},
    )
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        full_name=updated_user["full_name"],
        phone=updated_user.get("phone"),
        display_name=updated_user.get("display_name"),
        gender=updated_user.get("gender"),
        birth_date=updated_user.get("birth_date"),
        avatar_url=updated_user.get("avatar_url"),
        role=updated_user.get("role", ROLE_CITIZEN),
        language=updated_user.get("language", "ru"),
        has_local_password=user_has_local_password(updated_user),
        created_at=updated_user["created_at"],
    )


@router.put("/auth/onboarding")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"onboarding_completed": True}})
    return {"message": "Onboarding completed"}
