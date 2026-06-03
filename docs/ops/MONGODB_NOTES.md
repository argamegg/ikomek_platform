# MongoDB Notes

The backend uses MongoDB through Motor.

## Local Development

- Start MongoDB before starting the backend.
- Keep local development data separate from production data.
- Use a dedicated `DB_NAME` for experiments.

## Resetting Local Data

For destructive local resets, prefer resetting only the development database. Confirm the active `MONGO_URL` and `DB_NAME` before dropping data.

## Troubleshooting

- Connection errors usually point to `MONGO_URL`, network access, or a stopped MongoDB service.
- Empty API responses after seeding may indicate the backend is connected to a different database.
- Slow local queries can come from large leftover test data sets.

## QA Tip

After changing database-related code, seed demo data and verify one citizen, operator, and admin flow.
