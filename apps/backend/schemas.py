from datetime import datetime
from enum import Enum
from typing import List, Optional
import uuid

from pydantic import BaseModel, EmailStr, Field

# User Roles
ROLE_CITIZEN = "citizen"
ROLE_OPERATOR = "operator"
ROLE_ADMIN = "admin"

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

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
    display_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    language: str = "ru"
    created_at: datetime

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    display_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

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
    citizen_name: Optional[str] = None
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
    priority: Priority = Priority.medium
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
    content: str = ""
    attachment_label: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_read: bool = False

class MessageCreate(BaseModel):
    content: str = Field(default="", max_length=2000)
    attachment_label: Optional[str] = Field(default=None, max_length=160)
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = Field(default="image", max_length=32)

class AIAssistantMessage(BaseModel):
    role: str
    content: str

class AIAssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: List[AIAssistantMessage] = []
    locale: Optional[str] = "ru"

class AIAssistantAction(BaseModel):
    type: str = "navigate"
    label: str
    web_path: Optional[str] = None
    mobile_path: Optional[str] = None
    request_id: Optional[str] = None

class AIAssistantResponse(BaseModel):
    reply: str
    configured: bool
    model: str
    actions: List[AIAssistantAction] = []

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
    priority: Optional[Priority] = None

class LanguageUpdate(BaseModel):
    language: str
