import os
from pathlib import Path

import certifi
from dotenv import load_dotenv
from fastapi.security import HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
mongo_client_options = {
    "serverSelectionTimeoutMS": int(os.environ.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", "10000")),
}
mongo_tls_ca_file = os.environ.get("MONGO_TLS_CA_FILE", "").strip()

if mongo_tls_ca_file:
    mongo_client_options["tlsCAFile"] = mongo_tls_ca_file
elif mongo_url.startswith("mongodb+srv://") or "mongodb.net" in mongo_url:
    mongo_client_options["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(mongo_url, **mongo_client_options)
db = client[os.environ["DB_NAME"]]

SECRET_KEY = os.environ["JWT_SECRET"]
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
    "https://ikomek-platform.vercel.app",
]
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "").split(",")
    if origin.strip()
] or DEFAULT_CORS_ORIGINS
CORS_ORIGIN_REGEX = os.environ.get(
    "CORS_ORIGIN_REGEX",
    r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+|https://[a-z0-9-]+\.vercel\.app",
).strip() or None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
