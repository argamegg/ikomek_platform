import asyncio
import logging

from fastapi import APIRouter, FastAPI, Request
from pymongo.errors import PyMongoError
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

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

VALID_REQUEST_PRIORITIES = ["unset", "low", "medium", "high"]


async def migrate_request_priorities():
    normal_result = await db.requests.update_many(
        {"priority": "normal"},
        {"$set": {"priority": "medium"}},
    )
    missing_or_invalid_result = await db.requests.update_many(
        {
            "$or": [
                {"priority": {"$exists": False}},
                {"priority": None},
                {"priority": {"$nin": VALID_REQUEST_PRIORITIES}},
            ],
        },
        {"$set": {"priority": "unset"}},
    )
    if normal_result.modified_count or missing_or_invalid_result.modified_count:
        logger.info(
            "Request priority migration updated normal=%s invalid=%s.",
            normal_result.modified_count,
            missing_or_invalid_result.modified_count,
        )


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "iKOMEK 109"}


@app.get("/api/health/db")
async def database_health_check():
    try:
        await db.command("ping")
    except PyMongoError as exc:
        logger.warning("MongoDB health check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "service": "mongodb",
                "detail": "Database is temporarily unavailable",
            },
        )

    return {"status": "ok", "service": "mongodb"}


@app.exception_handler(PyMongoError)
async def mongo_exception_handler(request: Request, exc: PyMongoError):
    logger.exception("MongoDB request failed for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is temporarily unavailable"},
    )


async def create_indexes():
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


async def ensure_indexes_with_retries():
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        try:
            await create_indexes()
            await migrate_request_priorities()
            logger.info("MongoDB indexes and request priority migration are ready.")
            return
        except PyMongoError as exc:
            logger.warning(
                "MongoDB index creation failed on attempt %s/%s: %s",
                attempt,
                max_attempts,
                exc,
            )

        if attempt < max_attempts:
            await asyncio.sleep(5 * attempt)

    logger.error(
        "MongoDB indexes were not created after %s attempts. "
        "The API stays online, but database-backed endpoints can fail until MongoDB is reachable.",
        max_attempts,
    )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.on_event("startup")
async def schedule_index_creation():
    asyncio.create_task(ensure_indexes_with_retries())
    logger.info("Server startup complete; MongoDB index creation scheduled.")
