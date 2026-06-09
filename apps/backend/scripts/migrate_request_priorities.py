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

VALID_PRIORITIES = ["unset", "low", "medium", "high"]


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
                {"priority": None},
                {"priority": {"$nin": [*VALID_PRIORITIES, "normal"]}},
            ],
        }
        invalid_count = await db.requests.count_documents(invalid_query)
        assigned_unset_query = {"status": {"$in": ["in_progress", "closed"]}, "priority": "unset"}
        assigned_unset_count = await db.requests.count_documents(assigned_unset_query)
        normal_modified = 0
        invalid_modified = 0
        assigned_unset_modified = 0

        if not dry_run:
            normal_result = await db.requests.update_many(
                {"priority": "normal"},
                {"$set": {"priority": "medium"}},
            )
            invalid_result = await db.requests.update_many(
                {
                    "$or": [
                        {"priority": {"$exists": False}},
                        {"priority": None},
                        {"priority": {"$nin": VALID_PRIORITIES}},
                    ],
                },
                {"$set": {"priority": "unset"}},
            )
            normal_modified = normal_result.modified_count
            invalid_modified = invalid_result.modified_count
            assigned_unset_result = await db.requests.update_many(
                assigned_unset_query,
                {"$set": {"priority": "medium"}},
            )
            assigned_unset_modified = assigned_unset_result.modified_count

        print(f"normal_to_medium_found={normal_count}")
        print(f"invalid_to_unset_found={invalid_count}")
        print(f"assigned_unset_to_medium_found={assigned_unset_count}")
        print(f"normal_to_medium_modified={normal_modified}")
        print(f"invalid_to_unset_modified={invalid_modified}")
        print(f"assigned_unset_to_medium_modified={assigned_unset_modified}")
        print(f"dry_run={'true' if dry_run else 'false'}")
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize legacy request priority values.",
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
