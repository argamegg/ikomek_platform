from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
import sys
import uuid

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from core.config import client, db
from helpers import get_password_hash
from schemas import ROLE_ADMIN, ROLE_OPERATOR
from seed_credentials import SeedCredentialError, get_system_seed_passwords


SYSTEM_ACCOUNTS = [
    {
        "role_key": "operator",
        "role": ROLE_OPERATOR,
        "email": "operator@ikomek.kz",
        "full_name": "Оператор Колл-центра",
    },
    {
        "role_key": "admin",
        "role": ROLE_ADMIN,
        "email": "admin@ikomek.kz",
        "full_name": "Администратор",
    },
]


async def rotate_passwords() -> int:
    try:
        passwords = get_system_seed_passwords()
    except SeedCredentialError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 1

    now = datetime.utcnow()

    for account in SYSTEM_ACCOUNTS:
        existing = await db.users.find_one({"email": account["email"]})
        update_data = {
            "password": get_password_hash(passwords[account["role_key"]]),
            "role": account["role"],
            "full_name": existing.get("full_name") if existing else account["full_name"],
            "has_local_password": True,
            "is_verified": True,
            "verified_at": (existing or {}).get("verified_at") or now,
            "updated_at": now,
        }

        if existing:
            await db.users.update_one({"email": account["email"]}, {"$set": update_data})
            action = "updated"
        else:
            await db.users.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "email": account["email"],
                    "phone": None,
                    "language": "ru",
                    "created_at": now,
                    "onboarding_completed": True,
                    **update_data,
                }
            )
            action = "created"

        print(f"{account['email']}: {action}")

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(rotate_passwords()))
