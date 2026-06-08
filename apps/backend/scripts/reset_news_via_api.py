from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path
import sys

import requests

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from news_fixtures import build_news_fixtures


def serialize_payload(item: dict) -> dict:
    payload = dict(item)
    for key in ("id", "created_at", "updated_at", "is_active"):
        payload.pop(key, None)
    for key in ("start_at", "end_at", "period_start", "period_end"):
        value = payload.get(key)
        if value is not None:
            payload[key] = value.isoformat()
    return payload


def read_news_items(payload) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("news"), list):
        return payload["news"]
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8001/api")
    parser.add_argument("--email", default="admin@ikomek.kz")
    parser.add_argument("--password", default=os.environ.get("SEED_ADMIN_PASSWORD"))
    args = parser.parse_args()
    if not args.password:
        parser.error("--password or SEED_ADMIN_PASSWORD is required")

    session = requests.Session()

    login_response = session.post(
        f"{args.base_url}/auth/login",
        json={"email": args.email, "password": args.password},
        timeout=15,
    )
    login_response.raise_for_status()
    token = login_response.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})

    existing_response = session.get(f"{args.base_url}/news", params={"limit": 100}, timeout=15)
    existing_response.raise_for_status()
    existing_items = read_news_items(existing_response.json())

    for item in existing_items:
        delete_response = session.delete(f"{args.base_url}/admin/news/{item['id']}", timeout=15)
        delete_response.raise_for_status()

    fixtures = build_news_fixtures(datetime.utcnow())
    for item in fixtures:
        create_response = session.post(
            f"{args.base_url}/admin/news",
            json=serialize_payload(item),
            timeout=15,
        )
        create_response.raise_for_status()

    print(f"Deleted {len(existing_items)} existing news items")
    print(f"Created {len(fixtures)} fresh news items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
