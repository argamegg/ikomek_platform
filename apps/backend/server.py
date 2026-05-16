import logging

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS, CORS_ORIGIN_REGEX, client, db
from routes import ROUTERS

app = FastAPI(title="iKomek 109 API")
api_router = APIRouter(prefix="/api")

for router in ROUTERS:
    api_router.include_router(router)

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
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

    print("Server started successfully")


@app.on_event("startup")
async def ensure_indexes():
    await db.requests.create_index(
        [("created_at", -1)],
        name="requests_created_at_desc_index",
    )
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
    await db.saved_locations.create_index(
        [("user_id", 1), ("created_at", -1)],
        name="saved_locations_user_created_index",
    )
    await db.messages.create_index(
        [("request_id", 1), ("created_at", 1)],
        name="messages_request_created_index",
    )
