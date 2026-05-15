#!/usr/bin/env python3
import argparse
import asyncio
import os
from pathlib import Path
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

VALID_PRIORITIES = ["low", "medium", "high"]


async def migrate_request_priorities(dry_run: bool) -> None:
    mongo_url = os.environ["MONGO_URL"]
    database_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[database_name]

    try:
        normal_count = await db.requests.count_documents({"priority": "normal"})
        invalid_query = {
            "$or": [
                {"priority": {"$exists": False}},
                {"priority": {"$nin": [*VALID_PRIORITIES, "normal"]}},
            ],
        }
        invalid_count = await db.requests.count_documents(invalid_query)

        normal_modified = 0
        invalid_modified = 0

        if not dry_run:
            normal_result = await db.requests.update_many(
                {"priority": "normal"},
                {"$set": {"priority": "medium"}},
            )
            invalid_result = await db.requests.update_many(
                {
                    "$or": [
                        {"priority": {"$exists": False}},
                        {"priority": {"$nin": VALID_PRIORITIES}},
                    ],
                },
                {"$set": {"priority": "medium"}},
            )
            normal_modified = normal_result.modified_count
            invalid_modified = invalid_result.modified_count

        print(f"normal_to_medium_found={normal_count}")
        print(f"invalid_to_medium_found={invalid_count}")
        print(f"normal_to_medium_modified={normal_modified}")
        print(f"invalid_to_medium_modified={invalid_modified}")
        print(f"dry_run={'true' if dry_run else 'false'}")
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize request priorities to low, medium, or high.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only count requests that need priority migration.",
    )
    args = parser.parse_args()
    asyncio.run(migrate_request_priorities(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
