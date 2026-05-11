from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from dateutil import parser as dateparser
import jwt
from passlib.context import CryptContext
import base64
import random
import asyncio
import hashlib
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from geo import REQUEST_OUT_OF_ZONE_ERROR, is_within_astana_request_zone
from news_fixtures import build_news_fixtures
from services.ai_assistant import AIAssistantError, generate_ai_assistant_reply
from services.translation import detect_language, translate_to_all_languages

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'ikomek109-secret-key-2025-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
EMAIL_VERIFICATION_EXPIRE_MINUTES = int(os.environ.get("EMAIL_VERIFICATION_EXPIRE_MINUTES", "10"))
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = int(
    os.environ.get("EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS", "60")
)
EMAIL_VERIFICATION_MAX_ATTEMPTS = int(os.environ.get("EMAIL_VERIFICATION_MAX_ATTEMPTS", "5"))

SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
SMTP_SENDER_EMAIL = os.environ.get("SMTP_SENDER_EMAIL", SMTP_USERNAME).strip()
SMTP_SENDER_NAME = os.environ.get("SMTP_SENDER_NAME", "iKOMEK 109").strip()
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
SMTP_USE_SSL = os.environ.get("SMTP_USE_SSL", "false").lower() == "true"
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "").split(",")
    if origin.strip()
] or DEFAULT_CORS_ORIGINS
CORS_ORIGIN_REGEX = os.environ.get(
    "CORS_ORIGIN_REGEX",
    r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+",
).strip() or None

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# Create the main app
app = FastAPI(title="iKomek 109 API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ================================
# MODELS
# ================================

# User Roles
ROLE_CITIZEN = "citizen"
ROLE_OPERATOR = "operator"
ROLE_ADMIN = "admin"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    language: str = "ru"
    role: str = ROLE_CITIZEN  # Default role is citizen

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    language: str = "ru"
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RegistrationStartResponse(BaseModel):
    status: str = "verification_required"
    registration_id: str
    email: str
    expires_in_seconds: int
    resend_available_in_seconds: int

class VerificationCodeRequest(BaseModel):
    registration_id: str
    code: str = Field(min_length=4, max_length=10)

class VerificationResendRequest(BaseModel):
    registration_id: str

class SavedLocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str  # home, work, study, other
    label: str
    address: str
    latitude: float
    longitude: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SavedLocationCreate(BaseModel):
    name: str
    label: str
    address: str
    latitude: float
    longitude: float

class Category(BaseModel):
    id: str
    name: str
    name_ru: str
    name_kz: str
    icon: str
    color: str

class RequestCreate(BaseModel):
    category_id: str
    address: str
    latitude: float
    longitude: float
    place_type: Optional[str] = None
    problem_type: str
    reason: str
    description: str
    photos: List[str] = []
    source_lang: Optional[str] = "ru"

class RequestModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    category_id: str
    category_name: str
    address: str
    latitude: float
    longitude: float
    place_type: Optional[str] = None
    problem_type: str
    reason: str
    description: Optional[str] = None
    description_ru: Optional[str] = None
    description_kz: Optional[str] = None
    description_en: Optional[str] = None
    source_lang: Optional[str] = "ru"
    photos: List[str] = []
    status: str = "pending"
    priority: str = "normal"  # normal, urgent
    district: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None
    operator_id: Optional[str] = None
    operator_notes: Optional[str] = None  # Internal notes not visible to citizens
    assigned_department: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_photos: List[str] = []

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    sender_type: str  # user, operator
    sender_id: str
    sender_name: str = ""
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_read: bool = False

class MessageCreate(BaseModel):
    content: str

class AIAssistantMessage(BaseModel):
    role: str
    content: str

class AIAssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: List[AIAssistantMessage] = []
    locale: Optional[str] = "ru"

class AIAssistantResponse(BaseModel):
    reply: str
    configured: bool
    model: str

class NewsItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: Optional[str] = None
    title_ru: Optional[str] = None
    title_kz: Optional[str] = None
    title_en: Optional[str] = None
    content: Optional[str] = None
    content_ru: Optional[str] = None
    content_kz: Optional[str] = None
    content_en: Optional[str] = None
    summary_ru: Optional[str] = None
    summary_kz: Optional[str] = None
    summary_en: Optional[str] = None
    source_lang: Optional[str] = "ru"
    translation_status: Optional[str] = None
    category: str
    types: List[str] = []
    summary: Optional[str] = None
    location: Optional[str] = None
    image: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    is_active: bool = True

class NewsCreate(BaseModel):
    title: Optional[str] = None
    title_ru: Optional[str] = None
    title_kz: Optional[str] = None
    title_en: Optional[str] = None
    content: Optional[str] = None
    content_ru: Optional[str] = None
    content_kz: Optional[str] = None
    content_en: Optional[str] = None
    summary_ru: Optional[str] = None
    summary_kz: Optional[str] = None
    summary_en: Optional[str] = None
    source_lang: Optional[str] = "ru"
    translation_status: Optional[str] = None
    skip_translation: bool = False
    category: str
    types: List[str] = []
    summary: Optional[str] = None
    location: Optional[str] = None
    image: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

class StatusUpdate(BaseModel):
    status: str
    resolution_notes: Optional[str] = None
    operator_notes: Optional[str] = None
    assigned_department: Optional[str] = None
    priority: Optional[str] = None

class LanguageUpdate(BaseModel):
    language: str

# ================================
# AUTH HELPERS
# ================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def utcnow() -> datetime:
    return datetime.utcnow()

def normalize_email(email: str) -> str:
    return email.strip().lower()

def normalize_language(language: Optional[str]) -> str:
    if language in ["ru", "kz", "en"]:
        return language
    return "ru"

def normalize_content_language(language: Optional[str]) -> str:
    if language in ["kk", "kz"]:
        return "kz"
    if language == "en":
        return "en"
    return "ru"

def normalize_translation_language(language: Optional[str]) -> str:
    if language in ["kk", "kz"]:
        return "kk"
    if language == "en":
        return "en"
    return "ru"

def localize_news_document(news: dict, lang: Optional[str]) -> dict:
    news = dict(news)
    content_lang = normalize_content_language(lang)

    if content_lang == "kz":
        news["title"] = news.get("title_kz") or news.get("title_ru") or news.get("title_en") or news.get("title")
        news["content"] = news.get("content_kz") or news.get("content_ru") or news.get("content_en") or news.get("content")
        news["summary"] = news.get("summary_kz") or news.get("summary_ru") or news.get("summary") or news.get("content")
    elif content_lang == "en":
        news["title"] = news.get("title_en") or news.get("title_ru") or news.get("title_kz") or news.get("title")
        news["content"] = news.get("content_en") or news.get("content_ru") or news.get("content_kz") or news.get("content")
        news["summary"] = news.get("summary_en") or news.get("summary_ru") or news.get("summary") or news.get("content")
    else:
        news["title"] = news.get("title_ru") or news.get("title") or news.get("title_en") or news.get("title_kz")
        news["content"] = news.get("content_ru") or news.get("content") or news.get("content_en") or news.get("content_kz")
        news["summary"] = news.get("summary_ru") or news.get("summary") or news.get("content")

    return news

def localize_request_document(request: dict, lang: Optional[str]) -> dict:
    request = dict(request)
    content_lang = normalize_content_language(lang)

    if content_lang == "kz":
        request["description"] = request.get("description_kz") or request.get("description_ru") or request.get("description_en") or request.get("description")
    elif content_lang == "en":
        request["description"] = request.get("description_en") or request.get("description_ru") or request.get("description_kz") or request.get("description")
    else:
        request["description"] = request.get("description_ru") or request.get("description") or request.get("description_en") or request.get("description_kz")

    return request

def to_pagination_params(page: int, limit: int) -> tuple[int, int]:
    safe_page = max(1, page)
    safe_limit = min(max(1, limit), 100)
    return safe_page, safe_limit

def seconds_until(value: Optional[datetime]) -> int:
    if not value:
        return 0
    return max(0, int((value - utcnow()).total_seconds()))

def generate_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

def hash_verification_code(registration_id: str, code: str) -> str:
    payload = f"{SECRET_KEY}:{registration_id}:{code}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()

def email_delivery_configured() -> bool:
    return bool(SMTP_HOST and SMTP_SENDER_EMAIL)

def build_verification_email(language: str, code: str):
    expire_minutes = EMAIL_VERIFICATION_EXPIRE_MINUTES
    templates = {
        "ru": {
            "subject": "Код подтверждения iKOMEK 109",
            "body": (
                "Здравствуйте!\n\n"
                f"Ваш код подтверждения iKOMEK 109: {code}\n\n"
                f"Код действует {expire_minutes} минут. Если вы не запрашивали регистрацию, просто проигнорируйте это письмо."
            ),
        },
        "kz": {
            "subject": "iKOMEK 109 растау коды",
            "body": (
                "Сәлеметсіз бе!\n\n"
                f"Сіздің iKOMEK 109 растау кодыңыз: {code}\n\n"
                f"Код {expire_minutes} минут жарамды. Егер тіркелуді сұрамаған болсаңыз, бұл хатты елемеңіз."
            ),
        },
        "en": {
            "subject": "Your iKOMEK 109 verification code",
            "body": (
                "Hello,\n\n"
                f"Your iKOMEK 109 verification code is: {code}\n\n"
                f"This code expires in {expire_minutes} minutes. If you did not request registration, you can ignore this email."
            ),
        },
    }
    return templates.get(language, templates["en"])

def send_email_sync(recipient: str, subject: str, body: str):
    if not email_delivery_configured():
        raise RuntimeError("SMTP email delivery is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((SMTP_SENDER_NAME, SMTP_SENDER_EMAIL))
    message["To"] = recipient
    message.set_content(body)

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context()) as server:
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
        return

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        if SMTP_USE_TLS:
            server.starttls(context=ssl.create_default_context())
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)

async def send_verification_code_email(recipient: str, language: str, code: str):
    email_copy = build_verification_email(language, code)
    await asyncio.to_thread(send_email_sync, recipient, email_copy["subject"], email_copy["body"])

def build_registration_start_response(pending: dict) -> RegistrationStartResponse:
    return RegistrationStartResponse(
        registration_id=pending["id"],
        email=pending["email"],
        expires_in_seconds=seconds_until(pending.get("code_expires_at")),
        resend_available_in_seconds=seconds_until(pending.get("resend_available_at")),
    )

def build_unverified_login_response(pending: dict):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "detail": "Your account is not verified yet",
            "code": "email_not_verified",
            "registration_id": pending["id"],
            "email": pending["email"],
            "resend_available_in_seconds": seconds_until(pending.get("resend_available_at")),
        },
    )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    if credentials is None:
        return None

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return await db.users.find_one({"id": user_id})
    except jwt.InvalidTokenError:
        return None

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role", ROLE_CITIZEN) not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# ================================
# AUTH ENDPOINTS
# ================================

@api_router.post("/auth/register", response_model=RegistrationStartResponse)
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

@api_router.post("/auth/login", response_model=TokenResponse)
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

@api_router.post("/auth/verify-email", response_model=TokenResponse)
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

@api_router.post("/auth/resend-verification", response_model=RegistrationStartResponse)
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

@api_router.get("/auth/me", response_model=UserResponse)
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

@api_router.put("/auth/profile")
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

@api_router.put("/auth/language")
async def update_language(data: LanguageUpdate, current_user: dict = Depends(get_current_user)):
    if data.language not in ["ru", "kz", "en"]:
        raise HTTPException(status_code=400, detail="Invalid language")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"language": data.language}})
    return {"message": "Language updated", "language": data.language}

@api_router.put("/auth/onboarding")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"onboarding_completed": True}})
    return {"message": "Onboarding completed"}

# ================================
# ADMIN: USER MANAGEMENT
# ================================

@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    users = await db.users.find().to_list(1000)
    return [{
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "role": u.get("role", ROLE_CITIZEN),
        "created_at": u["created_at"]
    } for u in users]

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    if role not in [ROLE_CITIZEN, ROLE_OPERATOR, ROLE_ADMIN]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User role updated to {role}"}

# ================================
# CATEGORIES ENDPOINTS
# ================================

CATEGORIES = [
    {"id": "electricity", "name": "Electricity", "name_ru": "Электричество", "name_kz": "Электр қуаты", "icon": "flash", "color": "#FFB300"},
    {"id": "water", "name": "Water Supply", "name_ru": "Водоснабжение", "name_kz": "Сумен қамтамасыз ету", "icon": "water", "color": "#2196F3"},
    {"id": "heating", "name": "Heating", "name_ru": "Отопление", "name_kz": "Жылыту", "icon": "flame", "color": "#FF5722"},
    {"id": "public_order", "name": "Public Order", "name_ru": "Нарушение порядка", "name_kz": "Тәртіп бұзушылық", "icon": "shield-checkmark", "color": "#4CAF50"},
    {"id": "sewage", "name": "Sewage", "name_ru": "Канализация", "name_kz": "Кәріз", "icon": "water-outline", "color": "#607D8B"},
    {"id": "waste", "name": "Waste", "name_ru": "Мусор", "name_kz": "Қоқыс", "icon": "trash", "color": "#795548"},
    {"id": "roads", "name": "Roads", "name_ru": "Дороги", "name_kz": "Жолдар", "icon": "car", "color": "#9E9E9E"},
    {"id": "other", "name": "Other", "name_ru": "Другое", "name_kz": "Басқа", "icon": "ellipsis-horizontal", "color": "#9E9E9E"},
]

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    return CATEGORIES

# ================================
# SAVED LOCATIONS ENDPOINTS
# ================================

@api_router.get("/locations", response_model=List[SavedLocation])
async def get_saved_locations(current_user: dict = Depends(get_current_user)):
    locations = await db.saved_locations.find({"user_id": current_user["id"]}).to_list(100)
    return [SavedLocation(**loc) for loc in locations]

@api_router.post("/locations", response_model=SavedLocation)
async def create_saved_location(location: SavedLocationCreate, current_user: dict = Depends(get_current_user)):
    loc_dict = location.dict()
    loc_obj = SavedLocation(user_id=current_user["id"], **loc_dict)
    await db.saved_locations.insert_one(loc_obj.dict())
    return loc_obj

@api_router.delete("/locations/{location_id}")
async def delete_saved_location(location_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.saved_locations.delete_one({"id": location_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted"}

# ================================
# REQUESTS ENDPOINTS - CITIZEN
# ================================

@api_router.post("/requests", response_model=RequestModel)
async def create_request(request_data: RequestCreate, current_user: dict = Depends(get_current_user)):
    if not is_within_astana_request_zone(request_data.latitude, request_data.longitude):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=REQUEST_OUT_OF_ZONE_ERROR,
        )

    category = next((c for c in CATEGORIES if c["id"] == request_data.category_id), None)
    category_name = category["name_ru"] if category else "Другое"
    request_dict = request_data.dict()
    source_lang = normalize_translation_language(request_dict.get("source_lang", "ru"))
    description = request_dict.get("description", "")

    if description:
        translations = await translate_to_all_languages(description, source_lang)
        request_dict["description_ru"] = translations["ru"]
        request_dict["description_kz"] = translations["kk"]
        request_dict["description_en"] = translations["en"]

    request_obj = RequestModel(
        user_id=current_user["id"],
        category_id=request_data.category_id,
        category_name=category_name,
        address=request_data.address,
        latitude=request_data.latitude,
        longitude=request_data.longitude,
        place_type=request_data.place_type,
        problem_type=request_data.problem_type,
        reason=request_data.reason,
        description=description,
        description_ru=request_dict.get("description_ru"),
        description_kz=request_dict.get("description_kz"),
        description_en=request_dict.get("description_en"),
        source_lang=source_lang,
        photos=request_data.photos
    )
    await db.requests.insert_one(request_obj.dict())
    return request_obj

@api_router.get("/requests", response_model=List[RequestModel])
async def get_user_requests(lang: str = "ru", current_user: dict = Depends(get_current_user)):
    requests = await db.requests.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [RequestModel(**localize_request_document(req, lang)) for req in requests]

@api_router.get("/requests/all", response_model=List[RequestModel])
async def get_all_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    lang: str = "ru",
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status
    
    requests = await db.requests.find(query).sort("created_at", -1).to_list(500)
    return [RequestModel(**localize_request_document(req, lang)) for req in requests]

@api_router.get("/requests/{request_id}", response_model=RequestModel)
async def get_request(request_id: str, lang: str = "ru", current_user: dict = Depends(get_current_user)):
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return RequestModel(**localize_request_document(request, lang))

# ================================
# REQUESTS ENDPOINTS - OPERATOR
# ================================

@api_router.get("/operator/requests")
async def get_operator_requests(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    district: Optional[str] = None,
    lang: str = "ru",
    current_user: dict = Depends(require_role([ROLE_OPERATOR, ROLE_ADMIN]))
):
    query = {}
    if category:
        query["category_id"] = category
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if district:
        query["district"] = district
    
    requests = await db.requests.find(query).sort("created_at", -1).to_list(500)
    return [RequestModel(**localize_request_document(req, lang)) for req in requests]

@api_router.put("/operator/requests/{request_id}")
async def update_request_operator(
    request_id: str,
    status_update: StatusUpdate,
    current_user: dict = Depends(require_role([ROLE_OPERATOR, ROLE_ADMIN]))
):
    request = await db.requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {
        "status": status_update.status,
        "updated_at": datetime.utcnow(),
        "operator_id": current_user["id"]
    }
    
    if status_update.status == "closed":
        update_data["closed_at"] = datetime.utcnow()
    if status_update.resolution_notes:
        update_data["resolution_notes"] = status_update.resolution_notes
    if status_update.operator_notes:
        update_data["operator_notes"] = status_update.operator_notes
    if status_update.assigned_department:
        update_data["assigned_department"] = status_update.assigned_department
    if status_update.priority:
        update_data["priority"] = status_update.priority
    
    await db.requests.update_one({"id": request_id}, {"$set": update_data})
    return {"message": "Request updated"}

# ================================
# MESSAGES ENDPOINTS
# ================================

@api_router.get("/requests/{request_id}/messages", response_model=List[Message])
async def get_messages(request_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"request_id": request_id}).sort("created_at", 1).to_list(100)
    return [Message(**msg) for msg in messages]

@api_router.post("/requests/{request_id}/messages", response_model=Message)
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

# ================================
# AI ASSISTANT ENDPOINTS
# ================================

@api_router.post("/ai/assistant", response_model=AIAssistantResponse)
async def ai_assistant(
    payload: AIAssistantRequest,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    try:
        reply, configured, model = await generate_ai_assistant_reply(
            message=payload.message.strip(),
            history=[item.dict() for item in payload.history],
            locale=payload.locale,
            user_role=current_user.get("role") if current_user else None,
        )
    except AIAssistantError as error:
        logging.exception("AI assistant request failed")
        raise HTTPException(status_code=502, detail=str(error)) from error

    return AIAssistantResponse(reply=reply, configured=configured, model=model)

# ================================
# NEWS ENDPOINTS
# ================================

@api_router.get("/news")
async def get_news(
    lang: str = "ru",
    search: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    period: Optional[str] = "all",
    sort: Optional[str] = "date_desc",
    page: int = 1,
    limit: int = 20,
):
    query = {"is_active": True}
    now = datetime.utcnow()
    now_str = now.isoformat()

    if category:
        query["category"] = category

    if type:
        query["types"] = {"$in": [type]}

    if period == "active":
        query["$and"] = [
            {"start_at": {"$exists": True}},
            {"end_at": {"$exists": True}},
            {"start_at": {"$ne": None}},
            {"end_at": {"$ne": None}},
            {
                "$or": [
                    {
                        "$and": [
                            {"start_at": {"$lte": now}},
                            {"end_at": {"$gte": now}},
                        ],
                    },
                    {
                        "$and": [
                            {"start_at": {"$lte": now_str}},
                            {"end_at": {"$gte": now_str}},
                        ],
                    },
                ],
            },
        ]
    elif period == "finished":
        query["$or"] = [
            {"end_at": {"$lt": now}},
            {"end_at": {"$lt": now_str}},
        ]
    elif period == "no_period":
        query["$or"] = [
            {"start_at": None},
            {"start_at": {"$exists": False}},
            {"end_at": None},
            {"end_at": {"$exists": False}},
        ]

    if search:
        query["$text"] = {"$search": search}

    sort_order = -1 if sort != "date_asc" else 1
    safe_page, safe_limit = to_pagination_params(page, limit)
    skip = (safe_page - 1) * safe_limit

    cursor = db.news.find(query).sort("created_at", sort_order).skip(skip).limit(safe_limit)
    news = await cursor.to_list(safe_limit)
    total = await db.news.count_documents(query)

    localized_news = [NewsItem(**localize_news_document(item, lang)).dict() for item in news]
    return {
        "news": localized_news,
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
    }

@api_router.get("/news/{news_id}", response_model=NewsItem)
async def get_news_item(news_id: str, lang: str = "ru"):
    news = await db.news.find_one({"id": news_id})
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return NewsItem(**localize_news_document(news, lang))

@api_router.post("/admin/news/translate-preview")
async def translate_preview(
    data: dict,
    current_user: dict = Depends(require_role([ROLE_ADMIN])),
):
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    summary = (data.get("summary") or "").strip()
    source_lang = detect_language(f"{title} {content}".strip())

    title_translations = await translate_to_all_languages(title, source_lang)
    content_translations = await translate_to_all_languages(content, source_lang)
    summary_translations = await translate_to_all_languages(summary, source_lang) if summary else {"ru": "", "kk": "", "en": ""}

    return {
        "source_lang": source_lang,
        "translations": {
            "ru": {
                "title": title_translations["ru"],
                "content": content_translations["ru"],
                "summary": summary_translations["ru"],
            },
            "kk": {
                "title": title_translations["kk"],
                "content": content_translations["kk"],
                "summary": summary_translations["kk"],
            },
            "en": {
                "title": title_translations["en"],
                "content": content_translations["en"],
                "summary": summary_translations["en"],
            },
        },
    }

@api_router.post("/admin/news", response_model=NewsItem)
async def create_news(news_data: NewsCreate, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    news_dict = news_data.dict()
    source_title = (news_dict.get("title") or "").strip()
    source_content = (news_dict.get("content") or "").strip()
    source_summary = (news_dict.get("summary") or "").strip()
    source_lang = normalize_translation_language(news_dict.get("source_lang")) if news_dict.get("source_lang") else detect_language(f"{source_title} {source_content}".strip())

    has_translations = all(
        news_dict.get(field)
        for field in ("title_ru", "title_kz", "title_en", "content_ru", "content_kz", "content_en")
    )

    if not news_dict.get("skip_translation") and not has_translations and source_title:
        try:
            title_translations = await translate_to_all_languages(source_title, source_lang)
            content_translations = await translate_to_all_languages(source_content, source_lang)

            news_dict["title_ru"] = title_translations["ru"]
            news_dict["title_kz"] = title_translations["kk"]
            news_dict["title_en"] = title_translations["en"]
            news_dict["content_ru"] = content_translations["ru"]
            news_dict["content_kz"] = content_translations["kk"]
            news_dict["content_en"] = content_translations["en"]
            if source_summary:
                summary_translations = await translate_to_all_languages(source_summary, source_lang)
                news_dict["summary_ru"] = summary_translations["ru"]
                news_dict["summary_kz"] = summary_translations["kk"]
                news_dict["summary_en"] = summary_translations["en"]
            news_dict["translation_status"] = "translated"
        except Exception:
            news_dict["translation_status"] = "failed"
    elif has_translations:
        news_dict["translation_status"] = "translated"
    elif news_dict.get("skip_translation"):
        news_dict["translation_status"] = "skipped"
    else:
        news_dict["translation_status"] = news_dict.get("translation_status") or "failed"

    news_dict["title"] = source_title or news_dict.get("title_ru") or news_dict.get("title_kz") or news_dict.get("title_en")
    news_dict["content"] = source_content or news_dict.get("content_ru") or news_dict.get("content_kz") or news_dict.get("content_en")
    news_dict["summary"] = source_summary or news_dict.get("summary_ru") or news_dict.get("summary_kz") or news_dict.get("summary_en") or (news_dict["content"] or "")[:180]
    news_dict["source_lang"] = source_lang
    news_dict["created_at"] = news_dict.get("created_at") or datetime.utcnow()
    news_dict["updated_at"] = datetime.utcnow()
    news_dict.pop("skip_translation", None)

    news_item = NewsItem(**news_dict)
    await db.news.insert_one(news_item.dict())
    return news_item

@api_router.put("/admin/news/{news_id}", response_model=NewsItem)
async def update_news(
    news_id: str,
    news_data: dict,
    current_user: dict = Depends(require_role([ROLE_ADMIN])),
):
    existing = await db.news.find_one({"id": news_id})
    if not existing:
        raise HTTPException(status_code=404, detail="News not found")

    update_data = {key: value for key, value in news_data.items() if value is not None}
    for date_field in ["start_at", "end_at"]:
        if date_field in update_data and isinstance(update_data[date_field], str):
            try:
                update_data[date_field] = dateparser.parse(update_data[date_field])
            except Exception:
                pass
    update_data["updated_at"] = datetime.utcnow()
    await db.news.update_one({"id": news_id}, {"$set": update_data})
    updated = await db.news.find_one({"id": news_id})
    return NewsItem(**localize_news_document(updated, existing.get("source_lang")))

@api_router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, current_user: dict = Depends(require_role([ROLE_ADMIN]))):
    result = await db.news.delete_one({"id": news_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="News not found")
    return {"message": "News deleted"}

# ================================
# MAP DATA ENDPOINTS
# ================================

@api_router.get("/map/points")
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

# ================================
# ANALYTICS - ADMIN
# ================================

@api_router.get("/admin/analytics")
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

# ================================
# SEED DATA
# ================================

@api_router.post("/seed")
async def seed_demo_data():
    existing = await db.requests.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded", "count": existing}
    
    # Real Astana locations
    astana_locations = [
        {"name": "Байтерек", "lat": 51.1282, "lng": 71.4306, "address": "ул. Сарайшык, 20", "district": "Есиль"},
        {"name": "Хан Шатыр", "lat": 51.1326, "lng": 71.4035, "address": "пр. Туран, 37", "district": "Есиль"},
        {"name": "Мечеть Нур-Астана", "lat": 51.1246, "lng": 71.4686, "address": "пр. Кабанбай батыра, 62", "district": "Есиль"},
        {"name": "Дворец Мира", "lat": 51.1108, "lng": 71.4692, "address": "пр. Тәуелсіздік, 57", "district": "Есиль"},
        {"name": "Ак Орда", "lat": 51.1250, "lng": 71.4594, "address": "пр. Мәңгілік Ел, 6", "district": "Есиль"},
        {"name": "Мега Силк Вей", "lat": 51.0897, "lng": 71.4175, "address": "ул. Кабанбай батыра, 62/2", "district": "Есиль"},
        {"name": "Центральный парк", "lat": 51.1283, "lng": 71.4189, "address": "Центральный парк", "district": "Есиль"},
        {"name": "Назарбаев Университет", "lat": 51.0905, "lng": 71.3975, "address": "ул. Кабанбай батыра, 53", "district": "Есиль"},
        {"name": "Астана Арена", "lat": 51.1031, "lng": 71.4025, "address": "ул. Туран, 57", "district": "Есиль"},
        {"name": "Абу-Даби Плаза", "lat": 51.1344, "lng": 71.4264, "address": "пр. Достык, 5", "district": "Алматы"},
        {"name": "Национальный музей", "lat": 51.1217, "lng": 71.4631, "address": "пр. Тәуелсіздік, 54", "district": "Есиль"},
        {"name": "Барыс Арена", "lat": 51.1436, "lng": 71.4197, "address": "пр. Туран, 57", "district": "Сарыарка"},
        {"name": "Набережная Есиль", "lat": 51.1306, "lng": 71.4142, "address": "Набережная Есиль", "district": "Есиль"},
        {"name": "Район Сарыарка", "lat": 51.1667, "lng": 71.4500, "address": "Сарыарка район", "district": "Сарыарка"},
        {"name": "Район Алматы", "lat": 51.1350, "lng": 71.4850, "address": "Алматы район", "district": "Алматы"},
        {"name": "ЭКСПО", "lat": 51.0875, "lng": 71.4158, "address": "Территория ЭКСПО", "district": "Есиль"},
        {"name": "Зеленый квартал", "lat": 51.1400, "lng": 71.4600, "address": "Зеленый квартал", "district": "Алматы"},
        {"name": "Талан Тауэрс", "lat": 51.0983, "lng": 71.4186, "address": "ул. Кунаева, 14", "district": "Есиль"},
        {"name": "Кормэ", "lat": 51.1156, "lng": 71.4269, "address": "ул. Мангилик Ел, 2", "district": "Есиль"},
        {"name": "Старый центр", "lat": 51.1700, "lng": 71.4300, "address": "Старый центр", "district": "Сарыарка"},
    ]
    
    categories = ["electricity", "water", "heating", "public_order", "sewage", "waste", "roads"]
    statuses = ["pending", "in_progress", "closed"]
    priorities = ["normal", "urgent"]
    
    problem_types_ru = {
        "electricity": ["Отключение света", "Скачки напряжения", "Повреждение кабеля", "Не работает фонарь"],
        "water": ["Нет воды", "Слабое давление", "Утечка трубы", "Грязная вода"],
        "heating": ["Нет отопления", "Утечка радиатора", "Холодно в квартире", "Перегрев"],
        "public_order": ["Шумовое нарушение", "Незаконная парковка", "Вандализм", "Брошенное авто"],
        "sewage": ["Засор канализации", "Утечка", "Неприятный запах", "Переполнение"],
        "waste": ["Переполненный бак", "Незаконная свалка", "Пропущен вывоз", "Опасные отходы"],
        "roads": ["Яма на дороге", "Поврежденное покрытие", "Нет знака", "Не работает светофор"],
    }
    
    reasons_ru = {
        "electricity": ["Нарушение общественного порядка", "Повреждение имущества", "Аварийная ситуация"],
        "water": ["Авария на сетях", "Плановые работы", "Износ оборудования"],
        "heating": ["Поломка котельной", "Авария на трассе", "Засор системы"],
        "public_order": ["Нарушение общественного порядка", "Распитие алкогольных напитков", "Шумовое нарушение"],
        "sewage": ["Засор", "Износ труб", "Неправильная эксплуатация"],
        "waste": ["Нарушение графика", "Переполнение", "Незаконный сброс"],
        "roads": ["Погодные условия", "Износ покрытия", "Повреждение"],
    }
    
    # Create demo users
    demo_citizen_id = str(uuid.uuid4())
    demo_operator_id = str(uuid.uuid4())
    demo_admin_id = str(uuid.uuid4())
    
    demo_users = [
        {
            "id": demo_citizen_id,
            "email": "demo@ikomek.kz",
            "password": get_password_hash("demo123"),
            "full_name": "Демо Пользователь",
            "phone": "+7 777 123 4567",
            "role": ROLE_CITIZEN,
            "language": "ru",
            "created_at": datetime.utcnow(),
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": datetime.utcnow(),
        },
        {
            "id": demo_operator_id,
            "email": "operator@ikomek.kz",
            "password": get_password_hash("operator123"),
            "full_name": "Оператор Колл-центра",
            "phone": "+7 777 111 2222",
            "role": ROLE_OPERATOR,
            "language": "ru",
            "created_at": datetime.utcnow(),
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": datetime.utcnow(),
        },
        {
            "id": demo_admin_id,
            "email": "admin@ikomek.kz",
            "password": get_password_hash("admin123"),
            "full_name": "Администратор",
            "phone": "+7 777 000 0000",
            "role": ROLE_ADMIN,
            "language": "ru",
            "created_at": datetime.utcnow(),
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": datetime.utcnow(),
        }
    ]
    
    for user in demo_users:
        await db.users.insert_one(user)
    
    # Create demo requests
    requests_to_insert = []
    for i, loc in enumerate(astana_locations):
        lat_offset = random.uniform(-0.005, 0.005)
        lng_offset = random.uniform(-0.005, 0.005)
        
        category = random.choice(categories)
        status = random.choice(statuses)
        priority = random.choice(priorities)
        problem_type = random.choice(problem_types_ru[category])
        reason = random.choice(reasons_ru[category])
        
        days_ago = random.randint(0, 30)
        created_at = datetime.utcnow() - timedelta(days=days_ago)
        
        request_obj = {
            "id": str(uuid.uuid4()),
            "user_id": demo_citizen_id if i < 10 else str(uuid.uuid4()),
            "category_id": category,
            "category_name": next(c["name_ru"] for c in CATEGORIES if c["id"] == category),
            "address": loc["address"],
            "latitude": loc["lat"] + lat_offset,
            "longitude": loc["lng"] + lng_offset,
            "district": loc["district"],
            "place_type": random.choice(["Квартира", "Подъезд", "Двор", "Паркинг", "Другое"]),
            "problem_type": problem_type,
            "reason": reason,
            "description": f"Обращение по адресу {loc['name']}: {problem_type}. {reason}.",
            "photos": [],
            "status": status,
            "priority": priority,
            "created_at": created_at,
            "updated_at": created_at + timedelta(hours=random.randint(1, 48)) if status != "pending" else created_at,
            "closed_at": created_at + timedelta(days=random.randint(1, 7)) if status == "closed" else None,
            "operator_id": demo_operator_id if status != "pending" else None,
            "operator_notes": "Передано в соответствующую службу" if status != "pending" else None,
            "resolution_notes": "Проблема устранена бригадой." if status == "closed" else None,
            "resolution_photos": []
        }
        requests_to_insert.append(request_obj)
    
    # Add more random points
    for i in range(30):
        lat = 51.1 + random.uniform(-0.1, 0.1)
        lng = 71.4 + random.uniform(-0.15, 0.15)
        category = random.choice(categories)
        status = random.choice(statuses)
        
        request_obj = {
            "id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
            "category_id": category,
            "category_name": next(c["name_ru"] for c in CATEGORIES if c["id"] == category),
            "address": f"ул. Астана, {random.randint(1, 200)}",
            "latitude": lat,
            "longitude": lng,
            "district": random.choice(["Есиль", "Сарыарка", "Алматы", "Байконыр"]),
            "place_type": random.choice(["Квартира", "Подъезд", "Двор", "Улица"]),
            "problem_type": random.choice(problem_types_ru[category]),
            "reason": random.choice(reasons_ru[category]),
            "description": "Автоматически сгенерированная заявка.",
            "photos": [],
            "status": status,
            "priority": random.choice(priorities),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
            "updated_at": datetime.utcnow(),
            "closed_at": None,
            "operator_id": None,
            "operator_notes": None,
            "resolution_notes": None,
            "resolution_photos": []
        }
        requests_to_insert.append(request_obj)
    
    await db.requests.insert_many(requests_to_insert)
    
    # Create demo news
    news_items = build_news_fixtures(datetime.utcnow())
    await db.news.insert_many(news_items)
    
    return {
        "message": "Demo data seeded successfully",
        "requests": len(requests_to_insert),
        "news": len(news_items),
        "users": {
            "citizen": "demo@ikomek.kz / demo123",
            "operator": "operator@ikomek.kz / operator123",
            "admin": "admin@ikomek.kz / admin123"
        }
    }
#eto root api endpoint  
@api_router.get("/")
async def root():
    return {"message": "iKomek 109 API", "version": "2.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

    print("Server started successfully")

@app.on_event("startup")
async def ensure_indexes():
    await db.news.create_index(
        [
            ("title_ru", "text"),
            ("title_kz", "text"),
            ("title_en", "text"),
            ("content_ru", "text"),
            ("content_kz", "text"),
            ("content_en", "text"),
        ],
        default_language="russian",
        name="news_text_search_index",
    )
