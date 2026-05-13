import asyncio
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr
import hashlib
import smtplib
import ssl
import secrets
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
import jwt

from core.config import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    ALGORITHM,
    EMAIL_VERIFICATION_EXPIRE_MINUTES,
    SECRET_KEY,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_SENDER_EMAIL,
    SMTP_SENDER_NAME,
    SMTP_USERNAME,
    SMTP_USE_SSL,
    SMTP_USE_TLS,
    db,
    optional_security,
    pwd_context,
    security,
)
from schemas import ROLE_CITIZEN, RegistrationStartResponse

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
