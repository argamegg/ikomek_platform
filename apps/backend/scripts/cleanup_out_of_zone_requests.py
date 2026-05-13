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

from geo import ASTANA_MAX_RADIUS_KM, extract_coordinates_from_record, get_distance_to_astana_km


async def cleanup_requests(dry_run: bool) -> None:
    mongo_url = os.environ["MONGO_URL"]
    database_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[database_name]

    try:
        requests = await db.requests.find({}).to_list(None)
        out_of_zone_ids: list[str] = []
        missing_coordinates = 0

        for request in requests:
            latitude, longitude = extract_coordinates_from_record(request)
            if latitude is None or longitude is None:
                missing_coordinates += 1
                continue

            if get_distance_to_astana_km(latitude, longitude) > ASTANA_MAX_RADIUS_KM:
                out_of_zone_ids.append(request["id"])

        deleted_count = 0
        if out_of_zone_ids and not dry_run:
            result = await db.requests.delete_many({"id": {"$in": out_of_zone_ids}})
            deleted_count = result.deleted_count

        remaining_count = await db.requests.count_documents({})

        print(f"total_requests={len(requests)}")
        print(f"out_of_zone_found={len(out_of_zone_ids)}")
        print(f"deleted={deleted_count}")
        print(f"remaining={remaining_count}")
        print(f"skipped_missing_coordinates={missing_coordinates}")
        print(f"dry_run={'true' if dry_run else 'false'}")
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Delete requests that are outside the allowed Astana radius.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only count requests outside the zone without deleting them.",
    )
    args = parser.parse_args()
    asyncio.run(cleanup_requests(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
